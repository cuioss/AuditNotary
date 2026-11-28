/**
 * What the lens ISMS knows of its documents (rest-api.adoc, ISMS Requests): the category and its document types, the
 * addresses, the releases of a document and the pairs of them that can be compared, and the review date as the sheet
 * words it.
 *
 * Nothing here touches the network or a component.
 */
import type { Category, Revision } from '../api/types';
import { daysFrom, parseInstant } from '../format';
import { formatAddress, routesUnder } from '../routes';

/** The category of the ISMS, for the texts of the form and the transitions. */
export const ISMS_CATEGORY = 'isms';

/** The repository of the four document types; the risks are in `isms-register`. */
export const DOCUMENTS_REPOSITORY = 'isms-core';

/** The repository of the risk register, which the lens offers a way into. */
export const REGISTER_REPOSITORY = 'isms-register';

/** The document types of `isms-core`, in the order the lens lists them (rest-api.adoc, the five types). */
export const DOCUMENT_KINDS = [
  'policy',
  'isms-scope',
  'audit-report',
  'management-review',
] as const;

/** A document type of `isms-core`. */
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** The address of the first column of the lens. */
export const ISMS_ADDRESS = '/isms';

/** The address of the risk register, a lens of its own in the next part. */
export const REGISTER_ADDRESS = '/isms/risks';

/**
 * The ISMS as the documents lens needs the category: not a generic one (the rail's lens *Documents* never lists it), so it
 * is not read from `GET /api/v1/categories` but known here, with the four document types of `isms-core`.
 */
export const ISMS_DOCUMENTS: Category = {
  id: ISMS_CATEGORY,
  generic: false,
  kinds: DOCUMENT_KINDS.map((id) => ({ id, repository: DOCUMENTS_REPOSITORY })),
};

/**
 * The routes this part of the lens draws: the start, the documents, a new one, one, the comparison of two releases. They are
 * derived from the canonical addresses, the routes under `/isms` without the risk register (a lens of its own in the next
 * part) and without the release of a document (a page of its own), so a canonical document address added later is drawn
 * without an edit here.
 */
export const DOCUMENT_ROUTES: readonly string[] = routesUnder('isms').filter(
  (route) => !route.startsWith('isms.risk') && route !== 'isms.document.release',
);

/**
 * @param kind a document type id
 * @returns whether it is one of the four types of `isms-core`
 */
export function isDocumentKind(kind: string | null | undefined): kind is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(kind ?? '');
}

/**
 * @param kind a document type; the documents of every type without one
 * @returns the address of the list of the documents
 */
export function documentsAddress(kind?: string | null): string {
  return formatAddress({
    route: 'isms.documents',
    params: {},
    ...(kind ? { query: { kind } } : {}),
  });
}

/**
 * @param kind a document type; the choice among the types without one
 * @returns the address of the form of a new document
 */
export function newDocumentAddress(kind?: string | null): string {
  return formatAddress({
    route: 'isms.documents.new',
    params: {},
    ...(kind ? { query: { kind } } : {}),
  });
}

/**
 * @param id the document id, a ULID
 * @param at a revision (`v<n>` or a commit id) for the document as it was then; the current state without one
 * @returns the address of the document
 */
export function documentAddress(id: string, at?: string | null): string {
  return formatAddress({
    route: 'isms.document',
    params: { ismsdocument: id },
    ...(at ? { query: { at } } : {}),
  });
}

/**
 * @param id the document id
 * @returns the address of the review and release of the document
 */
export function releaseAddress(id: string): string {
  return formatAddress({ route: 'isms.document.release', params: { ismsdocument: id } });
}

/**
 * @param id the document id
 * @param from the earlier revision; none offers the pairs of neighbouring releases
 * @param to the later revision; none is the current state
 * @returns the address of the comparison
 */
export function compareAddress(id: string, from?: string | null, to?: string | null): string {
  const query: Record<string, string> = {};
  if (from) query.from = from;
  if (to) query.to = to;
  return formatAddress({
    route: 'isms.document.compare',
    params: { ismsdocument: id },
    ...(Object.keys(query).length > 0 ? { query } : {}),
  });
}

/**
 * @param revisions the revisions of a document, newest first
 * @returns the releases among them, newest first
 */
export function releasesOf(revisions: Revision[] | null): Revision[] {
  return (revisions ?? []).filter((revision) => revision.kind === 'release');
}

/** Two releases that are next to each other: the earlier and the later. */
export interface ReleasePair {
  from: Revision;
  to: Revision;
}

/**
 * @param releases the releases of a document, newest first
 * @returns the pairs of neighbouring releases, newest pair first: `v2` and `v3`, then `v1` and `v2`
 */
export function neighbourPairs(releases: Revision[]): ReleasePair[] {
  return releases.slice(0, -1).map((to, index) => ({ from: releases[index + 1], to }));
}

/** How a review date stands against today. */
export type ReviewStanding = 'overdue' | 'due-soon' | 'ok';

/** The days before a review date that it counts as due soon (rest-api.adoc, point 62). */
export const REVIEW_SOON_DAYS = 30;

/** A review date and where it stands. */
export interface Review {
  /** The date, `YYYY-MM-DD`. */
  date: string;
  /** The standing: before today is overdue, within 30 days is due soon. */
  standing: ReviewStanding;
  /** The whole days from today to the date; negative once it is overdue. */
  days: number;
}

/**
 * @param date a date of the shape `YYYY-MM-DD`
 * @returns whether it is a day of the calendar: the month and the day are the ones that the date is parsed to (a leap day
 * is one, `2026-02-30` is none)
 */
function isCalendarDate(date: string): boolean {
  const parsed = parseInstant(date);
  if (Number.isNaN(parsed.getTime())) return false;
  const [year, month, day] = date.split('-').map(Number);
  return (
    parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day
  );
}

/**
 * @param date the review date of the document's value, or anything else
 * @param now the present
 * @returns where the review stands; `null` for a document without a date (or with one that is none), which has no review
 */
export function reviewOf(date: unknown, now: Date): Review | null {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // A date of the shape that is none (`2026-13-45`, `2026-02-30`) has no standing; it is not told as an overdue review of
  // NaN days, nor read as the day it is normalised to (`2026-03-02`).
  if (!isCalendarDate(date)) return null;
  const days = daysFrom(date, now);
  return {
    date,
    days,
    standing: days < 0 ? 'overdue' : days <= REVIEW_SOON_DAYS ? 'due-soon' : 'ok',
  };
}
