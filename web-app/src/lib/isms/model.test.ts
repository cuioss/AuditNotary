import { describe, expect, it } from 'vitest';
import type { Revision } from '../api/types';
import { parseHref } from '../routes';
import {
  DOCUMENT_KINDS,
  DOCUMENT_ROUTES,
  ISMS_DOCUMENTS,
  compareAddress,
  documentAddress,
  documentsAddress,
  isDocumentKind,
  neighbourPairs,
  newDocumentAddress,
  releaseAddress,
  releasesOf,
  reviewOf,
} from './model';

/**
 * What the lens ISMS knows of its documents: the addresses, the releases and the pairs of them, the review date. The present
 * is always handed in, never read from the clock (the day of the mock is 2026-11-26).
 */
const ID = '01JZB1C3E5G7J9M1P3R5T7W9Y2';
const TODAY = new Date('2026-11-26T10:00:00Z');

/** @returns a revision of the list, newest first as the server lists them */
function revision(ref: string, kind: Revision['kind'], tag: string | null = null): Revision {
  return {
    ref,
    commit: ref,
    kind,
    tag,
    version: 1,
    at: '2026-01-01T00:00:00Z',
    by: { pseudonym: 'p-7d2e58', name: 'Noor Haddad' },
  };
}

describe('the category', () => {
  it('has the four document types of isms-core and is no generic category', () => {
    expect(DOCUMENT_KINDS).toEqual(['policy', 'isms-scope', 'audit-report', 'management-review']);
    expect(ISMS_DOCUMENTS.generic).toBe(false);
    expect(ISMS_DOCUMENTS.kinds.map((kind) => kind.repository)).toEqual(
      DOCUMENT_KINDS.map(() => 'isms-core'),
    );
  });

  it('knows a document type, and the risk is none of them', () => {
    expect(isDocumentKind('policy')).toBe(true);
    expect(isDocumentKind('risk')).toBe(false);
    expect(isDocumentKind(null)).toBe(false);
    expect(isDocumentKind(undefined)).toBe(false);
  });

  it('draws only routes that the canonical addresses have', () => {
    for (const route of DOCUMENT_ROUTES) {
      expect(parseHref(route === 'isms' ? '/isms' : '/isms/documents')).not.toBeNull();
    }
    expect(DOCUMENT_ROUTES).not.toContain('isms.risks');
    expect(DOCUMENT_ROUTES).not.toContain('isms.document.release');
  });
});

describe('the addresses', () => {
  it.each([
    [documentsAddress(), '/isms/documents'],
    [documentsAddress('policy'), '/isms/documents?kind=policy'],
    [newDocumentAddress(), '/isms/documents/new'],
    [newDocumentAddress('isms-scope'), '/isms/documents/new?kind=isms-scope'],
    [documentAddress(ID), `/isms/documents/${ID}`],
    [documentAddress(ID, 'v2'), `/isms/documents/${ID}?at=v2`],
    [documentAddress(ID, null), `/isms/documents/${ID}`],
    [releaseAddress(ID), `/isms/documents/${ID}/release`],
    [compareAddress(ID), `/isms/documents/${ID}/compare`],
    [compareAddress(ID, 'v1', 'v2'), `/isms/documents/${ID}/compare?from=v1&to=v2`],
    [compareAddress(ID, 'v2'), `/isms/documents/${ID}/compare?from=v2`],
  ])('writes %s', (written, expected) => {
    expect(written).toBe(expected);
  });

  it('reads every address it writes back to its route', () => {
    expect(parseHref(documentAddress(ID, 'v2'))).toEqual({
      route: 'isms.document',
      params: { ismsdocument: ID },
      query: { at: 'v2' },
    });
    expect(parseHref(compareAddress(ID, 'v1', 'v2'))).toEqual({
      route: 'isms.document.compare',
      params: { ismsdocument: ID },
      query: { from: 'v1', to: 'v2' },
    });
    expect(parseHref(newDocumentAddress('policy'))?.route).toBe('isms.documents.new');
    expect(parseHref(releaseAddress(ID))?.route).toBe('isms.document.release');
  });

  it('keeps `new` apart from a document', () => {
    expect(parseHref('/isms/documents/new')?.route).toBe('isms.documents.new');
  });
});

describe('the releases of a document', () => {
  const list = [
    revision('a0879b6', 'submit'),
    revision('v3', 'release', `policies/${ID}/v3`),
    revision('6a8c177', 'save'),
    revision('v2', 'release', `policies/${ID}/v2`),
    revision('v1', 'release', `policies/${ID}/v1`),
    revision('88f2501', 'create'),
  ];

  it('picks the releases out of the revisions, newest first', () => {
    expect(releasesOf(list).map((entry) => entry.ref)).toEqual(['v3', 'v2', 'v1']);
    expect(releasesOf(null)).toEqual([]);
  });

  it('pairs neighbouring releases, the newest pair first', () => {
    expect(neighbourPairs(releasesOf(list)).map((pair) => [pair.from.ref, pair.to.ref])).toEqual([
      ['v2', 'v3'],
      ['v1', 'v2'],
    ]);
  });

  it('has no pair for fewer than two releases', () => {
    expect(neighbourPairs([])).toEqual([]);
    expect(neighbourPairs(releasesOf(list).slice(0, 1))).toEqual([]);
  });
});

describe('the review date', () => {
  it('is overdue before today, with the days that passed', () => {
    expect(reviewOf('2026-11-18', TODAY)).toEqual({
      date: '2026-11-18',
      standing: 'overdue',
      days: -8,
    });
  });

  it('is due soon today and up to thirty days ahead, and fine after that', () => {
    expect(reviewOf('2026-11-26', TODAY)?.standing).toBe('due-soon');
    expect(reviewOf('2026-12-26', TODAY)).toMatchObject({ standing: 'due-soon', days: 30 });
    expect(reviewOf('2026-12-27', TODAY)).toMatchObject({ standing: 'ok', days: 31 });
  });

  it('has none for a document without a date or with something else', () => {
    expect(reviewOf(undefined, TODAY)).toBeNull();
    expect(reviewOf(null, TODAY)).toBeNull();
    expect(reviewOf('', TODAY)).toBeNull();
    expect(reviewOf('soon', TODAY)).toBeNull();
    expect(reviewOf('2026-13-45', TODAY)).toBeNull();
    expect(reviewOf(20261126, TODAY)).toBeNull();
  });
});
