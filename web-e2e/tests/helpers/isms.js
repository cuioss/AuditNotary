import { expect } from '@playwright/test';
import { pinClock } from './incidents.js';

/**
 * What the lens ISMS (documents) of the end-to-end suite needs of the page and of the mock (web-mock/README.adoc, ISMS): the
 * addresses, the paths of the requests, the documents the spec uses and the shared steps. The fixtures are static: a
 * change of the mock fails the tests that read the value.
 *
 * The clock of the page is the real one, and the review date of a document is compared with it; every step that opens a
 * page here pins it to the instant the mock reads at (`pinClock` of `incidents.js`, 2026-11-26T10:00:00Z).
 */

/** The canonical address of the first column of the lens. */
export const ISMS_ADDRESS = '/isms';

/** The address of the risk register, a lens of its own in the next part. */
export const REGISTER_ADDRESS = '/isms/risks';

/** The repository of the documents. */
export const REPOSITORY = 'isms-core';

/** The document types in the order of the first column, with their names in English and German. */
export const KINDS = [
  { id: 'policy', en: 'Policy', de: 'Richtlinie', count: 3 },
  { id: 'isms-scope', en: 'Scope of the ISMS', de: 'Geltungsbereich des ISMS', count: 1 },
  { id: 'audit-report', en: 'Audit report', de: 'Auditbericht', count: 2 },
  { id: 'management-review', en: 'Management review', de: 'Managementbewertung', count: 2 },
];

/** The information security policy: released three times, the document to compare (three diffs). */
export const POLICY = {
  id: '01JZB1C3E5G7J9M1P3R5T7W9Y2',
  kind: 'policy',
  title: 'Information security policy',
  tag: 'policies/01JZB1C3E5G7J9M1P3R5T7W9Y2',
};

/** The access control policy: released twice, its review is due soon. */
export const ACCESS_POLICY = {
  id: '01JZB2D4F6H8K0N2Q4S6V8X0Z3',
  kind: 'policy',
  title: 'Access control policy',
};

/** The secure development policy: in review, released once before; the policy that is released. */
export const SECURE_DEVELOPMENT = {
  id: '01JZB3E5G7J9M1P3R5T7W9Y1B4',
  kind: 'policy',
  title: 'Secure development policy',
  tag: 'policies/01JZB3E5G7J9M1P3R5T7W9Y1B4',
};

/** The scope of the ISMS: released twice, its review is overdue; one diff (v1 and v2). */
export const SCOPE = {
  id: '01JZB4F6H8K0N2Q4S6V8X0Z2C5',
  kind: 'isms-scope',
  title: 'Scope of the ISMS',
};

/** The internal audit 2025: released once, so it cannot be compared. */
export const AUDIT_2025 = {
  id: '01JZB5G7J9M1P3R5T7W9Y1B3D6',
  kind: 'audit-report',
  title: 'Internal audit 2025',
};

/** The internal audit 2026: a draft. */
export const AUDIT_2026 = {
  id: '01JZB6H8K0N2Q4S6V8X0Z2C4E7',
  kind: 'audit-report',
  title: 'Internal audit 2026',
};

/** The documents in the order of the list: the newest change first. */
export const DOCUMENTS = [
  SECURE_DEVELOPMENT,
  AUDIT_2026,
  {
    id: '01JZB7J9M1P3R5T7W9Y1B3D5F8',
    kind: 'management-review',
    title: 'Management review 2026 H1',
  },
  SCOPE,
  POLICY,
  AUDIT_2025,
  { id: '01JZB8K0N2Q4S6V8X0Z2C4E6G9', kind: 'management-review', title: 'Management review 2025' },
  ACCESS_POLICY,
];

/** The document `isms-document-created` adds. */
export const CREATED = {
  id: '01JZB9M1P3R5T7W9Y1B3D5F7H0',
  title: 'Incident communication policy',
};

/** @returns the address of the documents of a type, of every type without one */
export function documentsAddress(kind) {
  return kind ? `/isms/documents?kind=${kind}` : '/isms/documents';
}

/** @returns the address of a document, as it was at a release when one is named */
export function documentAddress(document, at) {
  return `/isms/documents/${document.id}${at ? `?at=${at}` : ''}`;
}

/** @returns the address of the form of a new document of a type, the choice of the type without one */
export function newAddress(kind) {
  return `/isms/documents/new${kind ? `?kind=${kind}` : ''}`;
}

/** @returns the address of the review and release of a document */
export function releaseAddress(document) {
  return `/isms/documents/${document.id}/release`;
}

/** @returns the address of the comparison of a document; the pairs of neighbouring releases without `from` */
export function compareAddress(document, from, to) {
  const query = [from ? `from=${from}` : null, to ? `to=${to}` : null].filter(Boolean);
  return `/isms/documents/${document.id}/compare${query.length > 0 ? `?${query.join('&')}` : ''}`;
}

/** @returns the path of a request of a document at the mock; `tail` starts with a `/` */
export function documentPath(document, tail = '') {
  return `/api/v1/documents/${REPOSITORY}/${document.id}${tail}`;
}

/** @returns the path of the save of a document at the mock */
export function savePath(document) {
  return documentPath(document, '/save');
}

/** @returns the path of the release of a document at the mock */
export function releasePath(document) {
  return `/api/v1/releases/${REPOSITORY}/${document.id}`;
}

/** @returns the path of the diff of a document at the mock */
export function diffPath(document) {
  return documentPath(document, '/diff');
}

/** The path of the create of a document at the mock. */
export const CREATE_PATH = `/api/v1/documents/${REPOSITORY}`;

/**
 * Signs in at the mock and waits for the page of the lens at the returned address. On a phone the top bar shows only the
 * last step of a path, so the title of the lens (which `login` waits for) is not visible there.
 *
 * @param page the page
 * @param address the canonical address to return to
 * @param view the test id of the view that is drawn there
 */
export async function loginToIsms(page, address = ISMS_ADDRESS, view = 'isms-view') {
  await pinClock(page);
  await page.goto(`/api/v1/auth/login?return=${encodeURIComponent(address)}`);
  await expect(page).toHaveURL(address);
  await expect(page.getByTestId(view)).toBeVisible();
}

/** Signs in and waits for the sheet of a document. */
export async function loginToSheet(page, document, at) {
  await loginToIsms(page, documentAddress(document, at));
  await expect(page.getByTestId('document-sheet')).toBeVisible();
}

/** Signs in and waits for the page that compares releases of a document. */
export async function loginToCompare(page, document, from, to) {
  await loginToIsms(page, compareAddress(document, from, to), 'document-compare-view');
}

/** Signs in and waits for the release page of a document with its record read. */
export async function loginToRelease(page, document) {
  await loginToIsms(page, releaseAddress(document), 'release-view');
  await expect(page.getByTestId('release-record')).toBeVisible();
}

/**
 * @param page the page
 * @returns the test ids of the rows of the list of documents, in the order shown
 */
export async function listedIds(page) {
  return page
    .getByTestId('document-list')
    .locator('[data-testid^="document-"]')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-testid').replace('document-', '')),
    );
}

/**
 * Counts the reads of the diff the page sends from now on, for the tests that say that a comparison asks for none.
 *
 * @param page the page
 * @returns a function that gives the number of reads so far
 */
export function countDiffReads(page) {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/diff')) count += 1;
  });
  return () => count;
}
