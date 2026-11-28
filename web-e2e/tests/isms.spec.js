import { expect, test } from '@playwright/test';
import { expectNoSeriousViolations } from './helpers/a11y.js';
import { field, sentTo, useLanguage } from './helpers/documents.js';
import {
  ACCESS_POLICY,
  AUDIT_2025,
  AUDIT_2026,
  CREATED,
  CREATE_PATH,
  DOCUMENTS,
  ISMS_ADDRESS,
  KINDS,
  POLICY,
  REGISTER_ADDRESS,
  SCOPE,
  SECURE_DEVELOPMENT,
  compareAddress,
  countDiffReads,
  diffPath,
  documentAddress,
  documentsAddress,
  listedIds,
  loginToCompare,
  loginToIsms,
  loginToRelease,
  loginToSheet,
  newAddress,
  releaseAddress,
  releasePath,
  savePath,
} from './helpers/isms.js';
import { changes } from './helpers/incidents.js';
import { acts, clearActs, useScenario } from './helpers/mock.js';
import { patchRead } from './helpers/samm.js';

/**
 * The lens ISMS, the documents (UC-ISMS-1, AUN-WEB-3, AUN-WEB-4, AUN-WEB-6, rest-api.adoc, ISMS Requests): the types with
 * their counts, the documents of a type, the sheet and an earlier state of it, the comparison of two releases, a new
 * document and the review and release with its diff. They run against the profiles `workshop`, `read-only`, `release` and
 * `empty` of the mock and its `isms-*` states (web-mock/README.adoc, ISMS). Every page is pinned to the instant the mock
 * reads at (2026-11-26T10:00:00Z), and the suite pins the zone to Europe/Berlin. The risk register is the next part of the
 * lens.
 */

/** @returns the line of the release page that a refusal or a success is announced in */
function notices(page) {
  return page.getByTestId('release-view').getByTestId('notice');
}

/** @returns the test ids of the rows of a column list, without the prefix */
async function rowIds(list, prefix) {
  return list
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll(
      (rows, start) => rows.map((row) => row.getAttribute('data-testid').slice(start.length)),
      prefix,
    );
}

test.describe('the types of the ISMS documents (UC-ISMS-1)', () => {
  test('the first column lists the four types with how many documents each holds, and the way to the register', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await expect(page.getByTestId('view-title')).toHaveText('ISMS');
    expect(await rowIds(page.getByTestId('type-list'), 'type-')).toEqual([
      'all',
      ...KINDS.map((kind) => kind.id),
    ]);
    await expect(page.getByTestId('type-all')).toContainText('All documents');
    await expect(page.getByTestId('type-all')).toContainText('8 documents');
    await expect(page.getByTestId('type-policy')).toContainText('Policy');
    await expect(page.getByTestId('type-policy')).toContainText('3 documents');
    // One policy is in review: the row says so in words, and no other type does.
    await expect(page.getByTestId('type-policy')).toContainText('1 in review');
    await expect(page.getByTestId('type-isms-scope')).toContainText('Scope of the ISMS');
    await expect(page.getByTestId('type-isms-scope')).toContainText('One document');
    await expect(page.getByTestId('type-audit-report')).toContainText('2 documents');
    await expect(page.getByTestId('type-management-review')).toContainText('2 documents');
    await expect(page.getByTestId('type-list').getByText('in review')).toHaveCount(1);
    // The way into the risk register is a row of its own below the types.
    await expect(page.getByTestId('register-link')).toContainText('Risk register');
    await expect(page.getByTestId('register-link')).toHaveAttribute('href', REGISTER_ADDRESS);
    // Nothing is chosen yet: no list of documents, no selected row.
    await expect(page.getByTestId('documents-column')).toHaveCount(0);
    await expect(page.locator('[data-testid^="type-"][aria-current]')).toHaveCount(0);
    await expectNoSeriousViolations(page, 'isms types');
  });

  test('a type opens the documents of that type at its own address, and a reload restores them', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await page.getByTestId('type-policy').click();
    await expect(page).toHaveURL(documentsAddress('policy'));
    await expect(page.getByTestId('documents-column')).toBeVisible();
    await expect(page.getByTestId('type-policy')).toHaveAttribute('aria-current', 'page');
    // The column is named by the type and counts its documents.
    await expect(page.getByTestId('documents-column')).toContainText('Document type');
    await expect(page.getByTestId('documents-column')).toContainText('3 documents');
    // Newest change first: the policy in review, the released one, the older one.
    expect(await listedIds(page)).toEqual([SECURE_DEVELOPMENT.id, POLICY.id, ACCESS_POLICY.id]);
    const review = page.getByTestId(`document-${SECURE_DEVELOPMENT.id}`);
    await expect(review).toContainText('In review');
    await expect(review).toContainText('Last release v1, Feb 12, 2026');
    await expect(review).toContainText('Version 2 in work, changed Nov 25, 2026 by Jordan Weber');
    // A released document says the version of its last release; the release is the whole story, so no "in work" line.
    const released = page.getByTestId(`document-${POLICY.id}`);
    await expect(released).toContainText('Released as v3');
    await expect(released).toContainText('Last release v3, May 20, 2026');
    await expect(released).not.toContainText('in work');
    // The type is in no row: the column already says it.
    await expect(released).not.toContainText('Management review');
    await page.reload();
    await expect(page).toHaveURL(documentsAddress('policy'));
    await expect(page.getByTestId('document-list')).toBeVisible();
    expect(await listedIds(page)).toHaveLength(3);
    await expect(page.getByTestId('type-policy')).toHaveAttribute('aria-current', 'page');
    await expectNoSeriousViolations(page, 'isms documents of a type');
  });

  test('"All documents" lists the eight documents with their type, and a row opens the sheet', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await page.getByTestId('type-all').click();
    await expect(page).toHaveURL(documentsAddress());
    await expect(page.getByTestId('type-all')).toHaveAttribute('aria-current', 'page');
    expect(await listedIds(page)).toEqual(DOCUMENTS.map((entry) => entry.id));
    // A row of the list of every type names the type.
    await expect(page.getByTestId(`document-${AUDIT_2026.id}`)).toContainText('Audit report');
    await expect(page.getByTestId(`document-${AUDIT_2026.id}`)).toContainText('Draft');
    await expect(page.getByTestId(`document-${SCOPE.id}`)).toContainText('Scope of the ISMS');
    await page.getByTestId(`document-${SCOPE.id}`).click();
    await expect(page).toHaveURL(documentAddress(SCOPE));
    await expect(page.getByTestId('document-sheet')).toBeVisible();
    // The address of a document names no type: the way up leads to the list of the type of the document.
    await expect(page.getByRole('link', { name: 'Up to Scope of the ISMS' })).toHaveAttribute(
      'href',
      documentsAddress('isms-scope'),
    );
  });

  test('the way to the register leads to its address', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await page.getByTestId('register-link').click();
    await expect(page).toHaveURL(REGISTER_ADDRESS);
  });

  test('a person who may not read the documents is told so, and still finds the register', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'release');
    await loginToIsms(page, ISMS_ADDRESS);
    await expect(page.getByTestId('isms-forbidden')).toContainText(
      'You may not read the ISMS documents',
    );
    await expect(page.getByTestId('type-list')).toHaveCount(0);
    await expect(page.getByTestId('register-link')).toBeVisible();
    await expectNoSeriousViolations(page, 'isms forbidden');
    await page.goto(documentsAddress('policy'));
    await expect(page.getByTestId('isms-forbidden').first()).toBeVisible();
    await expect(page.getByTestId('document-list')).toHaveCount(0);
  });

  test('an installation without a document says so in the first column and offers the first one', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'empty');
    await loginToIsms(page, documentsAddress());
    await expect(page.getByTestId('types-empty')).toContainText('No ISMS documents yet');
    await expect(page.getByTestId('type-all')).toContainText('0 documents');
    await expect(page.getByTestId('document-list')).toHaveCount(0);
    await expect(page.getByTestId('new-document')).toBeVisible();
    await expectNoSeriousViolations(page, 'isms empty');
  });

  test('a person who may only read cannot start a document, and the list says why', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToIsms(page, documentsAddress('policy'));
    await expect(page.getByTestId('new-document')).toHaveCount(0);
    await expect(page.getByTestId('document-new')).toContainText(
      'Creating a document needs the edit right.',
    );
    await expect(page.getByTestId('document-new').getByRole('button')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(await listedIds(page)).toHaveLength(3);
  });

  test('is written in German: the types, the counts and the states', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await useLanguage(page, 'de');
    await expect(page.getByTestId('type-all')).toContainText('Alle Dokumente');
    await expect(page.getByTestId('type-all')).toContainText('8 Dokumente');
    for (const kind of KINDS) {
      await expect(page.getByTestId(`type-${kind.id}`)).toContainText(kind.de);
    }
    await expect(page.getByTestId('type-policy')).toContainText('1 in Prüfung');
    await expect(page.getByTestId('type-isms-scope')).toContainText('Ein Dokument');
    await expect(page.getByTestId('register-link')).toContainText('Risikoregister');
    await page.getByTestId('type-policy').click();
    await expect(page.getByTestId(`document-${SECURE_DEVELOPMENT.id}`)).toContainText('In Prüfung');
    await expect(page.getByTestId(`document-${SECURE_DEVELOPMENT.id}`)).toContainText(
      'Version 2 in Arbeit, geändert am 25.11.2026 von Jordan Weber',
    );
    await expect(page.getByTestId(`document-${POLICY.id}`)).toContainText(
      'Letzte Freigabe v3, 20.05.2026',
    );
    await expect(page.getByTestId('new-document')).toHaveText('Neues Dokument');
    await expectNoSeriousViolations(page, 'isms documents (de)');
  });
});

test.describe('the sheet of an ISMS document (UC-ISMS-1)', () => {
  test('shows the document, its review date and the way to compare its last two releases', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page, POLICY);
    const sheet = page.getByTestId('document-sheet');
    await expect(sheet).toContainText(POLICY.title);
    await expect(sheet).toContainText('Released as v3');
    // The review date stands under the title as a fact, in words: it is more than a month ahead, so it is only the date.
    await expect(sheet).toContainText('Review due');
    await expect(sheet).toContainText('May 20, 2027');
    await expect(sheet).not.toContainText('overdue');
    // A released document without a change shows no warning on any row: its `applies-to` reference is a well-formed one.
    await expect(sheet).not.toContainText('Check this row');
    await expect(page.getByTestId('release-block')).toContainText('Released by Noor Haddad');
    await expect(page.getByTestId('release-block')).toContainText(`${POLICY.tag}/v3`);
    await expect(page.getByTestId('compare-block')).toContainText('Compare releases');
    const link = page.getByTestId('compare-link');
    await expect(link).toHaveText('Compare v2 and v3');
    await expect(link).toHaveAttribute('href', compareAddress(POLICY, 'v2', 'v3'));
    // The strip of the hidden root level ("Documents and register") is clipped to its width: the page never scrolls sideways.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId('triage-strip-left')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await link.click();
    await expect(page).toHaveURL(compareAddress(POLICY, 'v2', 'v3'));
    await expect(page.getByTestId('compare-result')).toBeVisible();
    await expectNoSeriousViolations(page, 'isms document sheet');
  });

  test('says in words that the review is overdue or due soon, as of today', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page, SCOPE);
    await expect(page.getByTestId('document-sheet')).toContainText('Nov 20, 2026, 6 days overdue');
    await expect(page.getByTestId('compare-link')).toHaveText('Compare v1 and v2');
    await page.goto(documentAddress(ACCESS_POLICY));
    await expect(page.getByTestId('document-sheet')).toContainText('Dec 8, 2026, in 12 days');
  });

  test('an earlier state is read only, as it was, and its review date says nothing of today', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page, POLICY, 'v1');
    await expect(page.getByTestId('revision-notice')).toContainText(
      'You are reading an earlier state',
    );
    await expect(page.getByTestId('revision-notice')).toContainText('Released as v1');
    await expect(page.getByTestId('document-sheet')).toContainText('Released as v1');
    // The date of v1 is long past; read as it was, it is the date and nothing about being overdue.
    await expect(page.getByTestId('document-sheet')).toContainText('Mar 10, 2026');
    await expect(page.getByTestId('document-sheet')).not.toContainText('overdue');
    await expect(page.getByTestId('save-everyone')).toHaveCount(0);
    await expect(page.getByTestId('release-block')).toContainText(`${POLICY.tag}/v1`);
    // The comparison of the last two releases is still on offer, from the earlier state too.
    await expect(page.getByTestId('compare-link')).toHaveText('Compare v2 and v3');
    await expectNoSeriousViolations(page, 'isms document earlier state');
  });

  test('a document with fewer than two releases says that a comparison needs two', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page, AUDIT_2025);
    await expect(page.getByTestId('compare-none')).toContainText(
      'A comparison needs two releases. This document has fewer.',
    );
    await expect(page.getByTestId('compare-link')).toHaveCount(0);
    await page.goto(documentAddress(SECURE_DEVELOPMENT));
    await expect(page.getByTestId('compare-none')).toBeVisible();
  });

  test('a document in review leads to its release', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page, SECURE_DEVELOPMENT);
    await expect(page.getByTestId('document-state')).toContainText('In review');
    await page.getByTestId('transition-isms.release').click();
    await expect(page).toHaveURL(releaseAddress(SECURE_DEVELOPMENT));
    await expect(page.getByTestId('release-record')).toBeVisible();
  });

  test('an address that is no document, and an earlier state that does not exist, are not found', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await page.goto('/isms/documents/01JZZZZZZZZZZZZZZZZZZZZZZZ');
    await expect(page.getByTestId('not-found-view')).toBeVisible();
    await page.goto(documentAddress(POLICY, 'v9'));
    await expect(page.getByTestId('not-found-view')).toBeVisible();
  });

  test('is read in German with its review date, release and comparison', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page, SCOPE);
    await useLanguage(page, 'de');
    await expect(page.getByTestId('document-sheet')).toContainText('Nächste Überprüfung');
    await expect(page.getByTestId('document-sheet')).toContainText(
      '20.11.2026, seit 6 Tagen überfällig',
    );
    await expect(page.getByTestId('compare-block')).toContainText('Freigaben vergleichen');
    await expect(page.getByTestId('compare-link')).toHaveText('v1 und v2 vergleichen');
    await expectNoSeriousViolations(page, 'isms document sheet (de)');
  });
});

test.describe('the comparison of two releases (UC-ISMS-1)', () => {
  test('without a pair it offers the pickers and the pairs of neighbouring releases', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, POLICY);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Compare releases of Information security policy',
    );
    // The earlier side lists the releases, newest first; the later side may also be the current state.
    const from = page.getByTestId('compare-from');
    const to = page.getByTestId('compare-to');
    await expect(from.locator('option')).toHaveText([
      'Choose a release',
      'v3, May 20, 2026, Noor Haddad',
      'v2, Nov 18, 2025, Noor Haddad',
      'v1, Mar 10, 2025, Noor Haddad',
    ]);
    await expect(to.locator('option')).toHaveText([
      'Current state',
      'v3, May 20, 2026, Noor Haddad',
      'v2, Nov 18, 2025, Noor Haddad',
      'v1, Mar 10, 2025, Noor Haddad',
    ]);
    // Nothing is chosen: the act is out of reach and says what is missing.
    await expect(page.getByTestId('compare-show')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('document-compare-view')).toContainText(
      'Choose the earlier version first.',
    );
    // The pairs, newest first, each a link to its comparison.
    const pairs = page.getByTestId('compare-pairs').getByRole('link');
    await expect(pairs).toHaveText([
      'v2 and v3, released May 20, 2026',
      'v1 and v2, released Nov 18, 2025',
    ]);
    await expect(pairs.first()).toHaveAttribute('href', compareAddress(POLICY, 'v2', 'v3'));
    await expect(pairs.last()).toHaveAttribute('href', compareAddress(POLICY, 'v1', 'v2'));
    await expect(page.getByTestId('compare-result')).toHaveCount(0);
    await expectNoSeriousViolations(page, 'isms compare pairs');
  });

  test('a neighbouring pair shows what changed field by field, the value before struck out and the value after marked', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await clearActs(request);
    await loginToCompare(page, POLICY);
    await page.getByTestId('compare-pairs').getByRole('link').first().click();
    await expect(page).toHaveURL(compareAddress(POLICY, 'v2', 'v3'));
    const result = page.getByTestId('compare-result');
    await expect(result).toContainText('What changed');
    await expect(page.getByTestId('compare-side-from')).toContainText(
      'v2, Nov 18, 2025, Noor Haddad',
    );
    await expect(page.getByTestId('compare-side-to')).toContainText(
      'v3, May 20, 2026, Noor Haddad',
    );
    await expect(page.getByTestId('compare-side-from').getByRole('link')).toHaveAttribute(
      'href',
      documentAddress(POLICY, 'v2'),
    );
    await expect(page.getByTestId('compare-side-to').getByRole('link')).toHaveAttribute(
      'href',
      documentAddress(POLICY, 'v3'),
    );
    await expect(result).toContainText('3 changes');
    // The sections of the record are the fields that changed, in the words of the form.
    const record = page.getByTestId('compare-record');
    await expect(record.locator('[data-testid^="record-"]')).toHaveCount(3);
    const statements = page.getByTestId('record-statements');
    await expect(statements).toContainText('Policy statements');
    await expect(statements.locator('del')).toContainText('Suppliers that process our information');
    await expect(statements.locator('ins')).toContainText(
      'A change of the security rules is released only after the review',
    );
    await expect(page.getByTestId('record-applies-to')).toContainText('Applies to');
    await expect(page.getByTestId('record-applies-to').locator('del')).toContainText('Payments');
    // A reference inside a struck value is struck as well (an inline-flex wrapper does not inherit the strike).
    await expect(page.getByTestId('record-applies-to').locator('del a')).toHaveCSS(
      'text-decoration-line',
      /line-through/,
    );
    await expect(page.getByTestId('record-applies-to').locator('ins')).toContainText(
      'Organisation',
    );
    const due = page.getByTestId('record-review-due');
    await expect(due).toContainText('Review due');
    await expect(due.locator('del')).toContainText('Nov 18, 2026');
    await expect(due.locator('ins')).toContainText('May 20, 2027');
    // Looking writes nothing.
    expect(changes(await acts(request))).toEqual([]);
    await expectNoSeriousViolations(page, 'isms compare result');
  });

  test('every pair of the mock reads: v1 with v2, v1 with v3 over two releases, and the scope with its list', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, POLICY, 'v1', 'v2');
    await expect(page.getByTestId('compare-result')).toContainText('3 changes');
    await expect(
      page.getByTestId('compare-record').locator('[data-testid^="record-"]'),
    ).toHaveCount(3);
    await expect(page.getByTestId('record-applies-to')).toHaveCount(0);
    await page.goto(compareAddress(POLICY, 'v1', 'v3'));
    await expect(page.getByTestId('compare-result')).toContainText('4 changes');
    await expect(page.getByTestId('compare-side-from')).toContainText('v1, Mar 10, 2025');
    await expect(page.getByTestId('compare-side-to')).toContainText('v3, May 20, 2026');
    await expect(page.getByTestId('record-purpose')).toContainText('Purpose');
    await expect(page.getByTestId('record-applies-to')).toBeVisible();
    await page.goto(compareAddress(SCOPE, 'v1', 'v2'));
    await expect(page.getByTestId('compare-result')).toContainText('3 changes');
    await expect(page.getByTestId('record-boundaries')).toContainText('Boundaries of the ISMS');
    await expect(page.getByTestId('record-exclusions')).toContainText('Office printers');
    await expect(page.getByTestId('record-review-due')).toContainText('Nov 20, 2026');
  });

  test('the pickers choose two releases, and the act leads to the comparison', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, POLICY);
    const show = page.getByTestId('compare-show');
    await page.getByTestId('compare-from').selectOption('v1');
    // The later side is the current state until one is chosen: v1 against the current state is a pair the mock does not
    // route, so the pair is chosen explicitly.
    await page.getByTestId('compare-to').selectOption('v2');
    await expect(show).not.toHaveAttribute('aria-disabled', 'true');
    await expect(show).toHaveAttribute('href', compareAddress(POLICY, 'v1', 'v2'));
    await show.click();
    await expect(page).toHaveURL(compareAddress(POLICY, 'v1', 'v2'));
    await expect(page.getByTestId('compare-result')).toContainText('3 changes');
    // The pickers follow the address.
    await expect(page.getByTestId('compare-from')).toHaveValue('v1');
    await expect(page.getByTestId('compare-to')).toHaveValue('v2');
    // The pairs are the way in; once a pair is chosen they step aside for the result.
    await expect(page.getByTestId('compare-pairs')).toHaveCount(0);
  });

  test('the same version on both sides is refused at the pickers and at the address, with no request', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, POLICY);
    await page.getByTestId('compare-from').selectOption('v2');
    await page.getByTestId('compare-to').selectOption('v2');
    await expect(page.getByTestId('compare-show')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('document-compare-view')).toContainText(
      'Choose two different versions.',
    );
    // The address with the same version twice says the same and asks the server for nothing.
    const reads = countDiffReads(page);
    await page.goto(compareAddress(POLICY, 'v1', 'v1'));
    await expect(page.getByTestId('compare-same')).toContainText('Choose two different versions.');
    await expect(page.getByTestId('compare-result')).toHaveCount(0);
    await expect(page.getByTestId('compare-record')).toHaveCount(0);
    expect(reads()).toBe(0);
    await expectNoSeriousViolations(page, 'isms compare same');
  });

  test('two versions with the same content say so, with no list of changes', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await patchRead(page, `**${diffPath(POLICY)}**`, (body) => ({ ...body, sections: [] }));
    await loginToCompare(page, POLICY, 'v1', 'v2');
    await expect(page.getByTestId('compare-equal')).toContainText(
      'The two versions hold the same content.',
    );
    await expect(page.getByTestId('compare-record')).toHaveCount(0);
    await expect(page.getByTestId('compare-result')).toBeVisible();
    await expectNoSeriousViolations(page, 'isms compare equal');
  });

  test('a version that does not exist is refused in words, the server refusal of a pair is told, and the pickers stay', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, POLICY, 'v9', 'v3');
    await expect(page.getByTestId('compare-refused')).toContainText(
      'One of the two versions does not exist for this document.',
    );
    await expect(page.getByTestId('compare-result')).toHaveCount(0);
    // A version of the address that is none of the releases stays a choice, named as it is written.
    await expect(page.getByTestId('compare-from')).toHaveValue('v9');
    await expect(page.getByTestId('compare-from').locator('option').nth(1)).toHaveText('v9');
    await expect(page.getByTestId('compare-show')).toBeVisible();
    // The mock routes three pairs of this document; another pair is the validation answer of the server.
    await page.goto(compareAddress(POLICY, 'v3', 'v2'));
    await expect(page.getByTestId('compare-refused')).toContainText('These two versions could not be compared');
    await expectNoSeriousViolations(page, 'isms compare refused');
  });

  test('a document with fewer than two releases says that it cannot be compared yet', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, AUDIT_2025);
    await expect(page.getByTestId('compare-too-few')).toContainText('Not two releases yet');
    await expect(page.getByTestId('compare-from')).toHaveCount(0);
    await expectNoSeriousViolations(page, 'isms compare too few');
  });

  test('an address of a document that does not exist is not found', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await page.goto('/isms/documents/01JZZZZZZZZZZZZZZZZZZZZZZZ/compare');
    await expect(page.getByTestId('not-found-view')).toBeVisible();
  });

  test('the breadcrumb leads back to the type and to the document', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, POLICY, 'v2', 'v3');
    const crumbs = page.getByRole('navigation', { name: 'You are here' });
    await expect(crumbs.getByRole('link', { name: 'Policy', exact: true })).toBeVisible();
    await expect(crumbs).toContainText(POLICY.title);
    await expect(crumbs).toContainText('Compare');
    await crumbs.getByRole('link', { name: POLICY.title }).click();
    await expect(page).toHaveURL(documentAddress(POLICY));
    await expect(page.getByTestId('document-sheet')).toBeVisible();
  });

  test('is written in German: the pickers, the pairs and the result', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToCompare(page, POLICY);
    await useLanguage(page, 'de');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Freigaben von Information security policy vergleichen',
    );
    await expect(page.getByTestId('compare-from').locator('option').first()).toHaveText(
      'Freigabe wählen',
    );
    await expect(page.getByTestId('compare-to').locator('option').first()).toHaveText(
      'Aktueller Stand',
    );
    await expect(page.getByTestId('compare-show')).toHaveText('Änderungen anzeigen');
    await expect(page.getByTestId('document-compare-view')).toContainText(
      'Wählen Sie zuerst die frühere Version.',
    );
    await expect(page.getByTestId('compare-pairs').getByRole('link').first()).toHaveText(
      'v2 und v3, freigegeben am 20.05.2026',
    );
    await expectNoSeriousViolations(page, 'isms compare pairs (de)');
    await page.getByTestId('compare-pairs').getByRole('link').first().click();
    await expect(page.getByTestId('compare-result')).toContainText('Was sich geändert hat');
    await expect(page.getByTestId('compare-result')).toContainText('3 Änderungen');
    await expect(page.getByTestId('record-review-due')).toContainText('Nächste Überprüfung');
    await expect(page.getByTestId('compare-side-from').getByRole('link')).toHaveText('v2 lesen');
    await expectNoSeriousViolations(page, 'isms compare result (de)');
    await page.goto(compareAddress(POLICY, 'v1', 'v1'));
    await expect(page.getByTestId('compare-same')).toContainText(
      'Wählen Sie zwei verschiedene Versionen.',
    );
    await page.goto(compareAddress(POLICY, 'v9', 'v3'));
    await expect(page.getByTestId('compare-refused')).toContainText(
      'Eine der beiden Versionen gibt es für dieses Dokument nicht.',
    );
  });
});

test.describe('a new ISMS document (UC-ISMS-1)', () => {
  test('the list of a type leads to the form of that type; the first save creates the document and opens it', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await clearActs(request);
    await loginToIsms(page, documentsAddress('policy'));
    await page.getByTestId('new-document').click();
    await expect(page).toHaveURL(newAddress('policy'));
    await expect(page.getByTestId('new-document-sheet')).toBeVisible();
    // The chain is the type, then the form; the way up leads to the list of the type.
    await expect(page.getByRole('link', { name: 'Up to Policy' })).toHaveAttribute(
      'href',
      documentsAddress('policy'),
    );
    await expect(page.getByTestId('save-state')).toContainText('Not saved yet');
    await expect(page.getByTestId('save-everyone')).toHaveAttribute('aria-disabled', 'true');
    await field(page, '/title').getByRole('textbox').fill(CREATED.title);
    await field(page, '/owner')
      .getByRole('combobox')
      .selectOption({ label: 'Chief Information Security Officer' });
    await field(page, '/statements')
      .getByRole('textbox')
      .first()
      .fill('Incidents are reported to the security office without delay.');
    await page.getByTestId('save-everyone').click();
    await expect(page).toHaveURL(documentAddress(CREATED));
    await expect(page.getByTestId('document-sheet')).toContainText(CREATED.title);
    await expect(page.getByTestId('document-state')).toContainText('Draft');
    // The create was one request, of the type of the form.
    const created = sentTo(await acts(request), CREATE_PATH, 'POST');
    expect(created).toHaveLength(1);
    expect(created[0].body).toMatchObject({
      kind: 'policy',
      parts: { data: { fields: { '/title': CREATED.title } } },
    });
    // The list of the type knows the document at once (the nine rows of the created state).
    await page.getByRole('link', { name: 'Up to Policy' }).click();
    await expect(page).toHaveURL(documentsAddress('policy'));
    await expect(page.getByTestId(`document-${CREATED.id}`)).toBeVisible();
    expect(await listedIds(page)).toHaveLength(4);
  });

  test('the form without a type offers the four types, and a type opens its form', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, newAddress());
    await expect(page.getByTestId('new-document-choice')).toBeVisible();
    for (const kind of KINDS) {
      await expect(page.getByTestId(`choose-${kind.id}`)).toHaveText(kind.en);
    }
    await expectNoSeriousViolations(page, 'isms new document choice');
    await page.getByTestId('choose-isms-scope').click();
    await expect(page).toHaveURL(newAddress('isms-scope'));
    await expect(page.getByTestId('new-document-sheet')).toContainText('Boundaries of the ISMS');
    await expect(page.getByTestId('new-document-sheet')).toContainText('Interested parties');
    await expectNoSeriousViolations(page, 'isms new document form');
  });

  test('a type that is none of the four is not found', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await page.goto(newAddress('risk'));
    await expect(page.getByTestId('not-found-view')).toBeVisible();
    await page.goto(newAddress('nonsense'));
    await expect(page.getByTestId('not-found-view')).toBeVisible();
  });

  test('a person who may only read is told that a document needs the edit right, and the way back is the list', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToIsms(page, newAddress('policy'));
    await expect(page.getByTestId('new-document-sheet')).toContainText(
      'Creating a document needs the edit right.',
    );
    await expect(page.getByTestId('new-document-sheet').getByRole('link')).toHaveAttribute(
      'href',
      documentsAddress(),
    );
  });

  test('an unreachable Git server keeps what was typed, and says so', async ({ page, request }) => {
    await useScenario(request, 'workshop#isms-git-unavailable');
    await loginToIsms(page, newAddress('policy'));
    await field(page, '/title').getByRole('textbox').fill('Kept text');
    await page.getByTestId('save-everyone').click();
    await expect(page.getByText('The Git server cannot be reached')).toBeVisible();
    await expect(page.getByTestId('save-state')).toContainText('Your text stays');
    await expect(field(page, '/title').getByRole('textbox')).toHaveValue('Kept text');
    await expect(page).toHaveURL(newAddress('policy'));
  });

  test('the form is written in German', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, newAddress('policy'));
    await useLanguage(page, 'de');
    await expect(page.getByTestId('new-document-sheet')).toContainText('Richtlinie');
    await expect(page.getByTestId('new-document-sheet')).toContainText('Titel');
    await expect(page.getByTestId('save-state')).toContainText('Noch nicht gespeichert');
    await expectNoSeriousViolations(page, 'isms new document (de)');
  });
});

test.describe('the review and release of an ISMS document (UC-ISMS-1, AUN-WEB-6)', () => {
  test('shows what is released: the facts, the diff against the last release in the words of the form, and the checks', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await clearActs(request);
    await loginToRelease(page, SECURE_DEVELOPMENT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Release Secure development policy',
    );
    await expect(page.getByTestId('release-facts')).toContainText(SECURE_DEVELOPMENT.title);
    await expect(page.getByTestId('release-facts')).toContainText('Jordan Weber');
    // A document is released more than once: the diff is the change since the last release.
    await expect(page.getByText('Changes since v1.')).toBeVisible();
    const statements = page.getByTestId('record-statements');
    await expect(statements).toContainText('Policy statements');
    await expect(statements.locator('del')).toContainText('Dependencies are checked');
    await expect(statements.locator('ins')).toContainText(
      'A threat model exists for every service',
    );
    await expect(page.getByTestId('record-applies-to').locator('ins')).toContainText('Mobile Apps');
    await expect(page.getByText('Every mandatory field is filled in')).toBeVisible();
    await expect(page.getByText('Submitted for review by Jordan Weber')).toBeVisible();
    // The act is the word of the act only; no control names how the person is confirmed.
    await expect(page.getByTestId('release-act')).toHaveText('Release');
    await expect(page.getByTestId('release-act')).not.toHaveAttribute('aria-disabled', 'true');
    for (const text of await page
      .getByTestId('release-view')
      .locator('button, a[href]')
      .allInnerTexts()) {
      expect(text).not.toMatch(/password|step|MFA|token|tag|sign/i);
    }
    await expect(page.getByTestId('release-back')).toHaveText('Back to the document');
    expect(changes(await acts(request))).toEqual([]);
    await expectNoSeriousViolations(page, 'isms release: review');
  });

  test('the way back is the sheet of the document, and nothing is written', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await clearActs(request);
    await loginToRelease(page, SECURE_DEVELOPMENT);
    await page.getByTestId('release-back').click();
    await expect(page).toHaveURL(documentAddress(SECURE_DEVELOPMENT));
    await expect(page.getByTestId('document-sheet')).toBeVisible();
    expect(await acts(request)).toEqual([]);
  });

  test('is written in German: the act is "Freigeben" and no mechanism stands on a control', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToRelease(page, SECURE_DEVELOPMENT);
    await useLanguage(page, 'de');
    await expect(page.getByTestId('release-record')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Secure development policy freigeben',
    );
    await expect(page.getByTestId('release-act')).toHaveText('Freigeben');
    await expect(page.getByTestId('release-back')).toHaveText('Zurück zum Dokument');
    for (const text of await page
      .getByTestId('release-view')
      .locator('button, a[href]')
      .allInnerTexts()) {
      expect(text).not.toMatch(/Passwort|Schritt|MFA|Token|Tag|signier/i);
    }
    await expectNoSeriousViolations(page, 'isms release: review (de)');
  });

  test('releases after the fresh login, as the next version, and the sheet then reads it released', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#isms-document-release-step-up');
    await clearActs(request);
    await loginToRelease(page, SECURE_DEVELOPMENT);
    const demanded = page.waitForResponse(
      (response) => response.url().includes('/api/v1/releases/') && response.status() === 403,
    );
    await page.getByTestId('release-act').click();
    await demanded;
    // The step-up returns to the release; the act is chosen again.
    await expect(page).toHaveURL(releaseAddress(SECURE_DEVELOPMENT));
    await expect(page.getByTestId('release-act')).not.toHaveAttribute('aria-busy', 'true');
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toContainText('Released as v2');
    await expect(page.getByTestId('release-seal')).toHaveAttribute('data-sealed', 'v2');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Secure development policy is released',
    );
    await expect(page.getByTestId('release-tag')).toContainText(`${SECURE_DEVELOPMENT.tag}/v2`);
    expect(sentTo(await acts(request), releasePath(SECURE_DEVELOPMENT), 'POST')).toHaveLength(2);
    await expectNoSeriousViolations(page, 'isms release: done');
    await page.getByTestId('release-open').click();
    await expect(page).toHaveURL(documentAddress(SECURE_DEVELOPMENT));
    await expect(page.getByTestId('document-state')).toContainText('Released as v2');
    // The release made a second one: the sheet now offers to compare it with the first.
    await expect(page.getByTestId('compare-link')).toHaveText('Compare v1 and v2');
    // The sheet is the released one: the release and its tag stand in the margin.
    await expect(page.getByTestId('release-block')).toContainText('Released by Noor Haddad');
  });

  test('a document that was released by the release of the mock reads released, frozen at its version', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#isms-document-released');
    await loginToSheet(page, SECURE_DEVELOPMENT);
    await expect(page.getByTestId('document-state')).toContainText('Released as v2');
    await expect(page.getByTestId('compare-link')).toHaveText('Compare v1 and v2');
    await page.goto(documentAddress(SECURE_DEVELOPMENT, 'v2'));
    await expect(page.getByTestId('revision-notice')).toContainText('Released as v2');
    await expect(page.getByTestId('save-everyone')).toHaveCount(0);
    await page.goto(documentsAddress('policy'));
    await expect(page.getByTestId(`document-${SECURE_DEVELOPMENT.id}`)).toContainText(
      'Released as v2',
    );
    await expect(page.getByTestId('type-policy')).not.toContainText('in review');
  });

  test('releases at once when no fresh login is asked', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToRelease(page, SECURE_DEVELOPMENT);
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toContainText('Released as v2');
    await expect(page.getByTestId('release-seal')).toHaveAttribute('data-sealed', 'v2');
  });

  test('an unreachable Git server stops the release and keeps the review', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#isms-git-unavailable');
    await loginToRelease(page, SECURE_DEVELOPMENT);
    await page.getByTestId('release-act').click();
    await expect(page.getByRole('alert')).toContainText('The Git server cannot be reached.');
    await expect(page.getByTestId('release-done')).toHaveCount(0);
    await expect(page.getByTestId('release-record')).toBeVisible();
    await expect(page.getByTestId('release-act')).toBeEnabled();
    await expect(notices(page).first()).toBeVisible();
    await expectNoSeriousViolations(page, 'isms release: git unavailable');
  });

  test('a person who may only read is told why the release is out of reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToRelease(page, SECURE_DEVELOPMENT);
    await expect(page.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Releasing needs the approve right.')).toBeVisible();
  });

  test('a document that is a draft asks for the submit first', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, releaseAddress(AUDIT_2026), 'release-view');
    await expect(page.getByText('Submit the document for review first.')).toBeVisible();
    await expect(page.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
  });

  test('an address of a document that does not exist is not found', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ISMS_ADDRESS);
    await page.goto('/isms/documents/01JZZZZZZZZZZZZZZZZZZZZZZZ/release');
    await expect(page.getByTestId('not-found-view')).toBeVisible();
  });
});

test.describe('the save of an ISMS document (UC-ISMS-1, UC-DOC-4)', () => {
  test('a save by another person is decided per field: both versions stand side by side', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#isms-document-saved-by-other');
    await loginToSheet(page, POLICY);
    await field(page, '/statements')
      .getByRole('textbox')
      .first()
      .fill('Every exception to these rules is recorded and reviewed.');
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('conflict-panel')).toBeVisible();
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'conflict');
    const statements = page.getByTestId('conflict-/statements');
    await expect(statements).toContainText('Version of Jordan Weber');
    await expect(statements).toContainText('Information that is no longer needed is deleted.');
    await expect(page.getByTestId('save-everyone')).toHaveAttribute('aria-disabled', 'true');
    await expectNoSeriousViolations(page, 'isms document conflict');
  });

  test('the server verdict shows at the fields and the text stays', async ({ page, request }) => {
    await useScenario(request, 'workshop#isms-document-invalid');
    await loginToSheet(page, POLICY);
    await field(page, '/title').getByRole('textbox').fill('Information security policy, 2027');
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
    await expect(page.getByTestId('save-state')).toContainText('Some entries need a correction');
    await expect(field(page, '/owner')).toContainText('This reference leads nowhere');
    await expect(page.getByTestId('failure-notice')).toContainText('Some entries are not valid');
    await expect(field(page, '/title').getByRole('textbox')).toHaveValue(
      'Information security policy, 2027',
    );
    await expectNoSeriousViolations(page, 'isms document invalid');
  });

  test('an unreachable Git server keeps the work and says so', async ({ page, request }) => {
    await useScenario(request, 'workshop#isms-git-unavailable');
    await clearActs(request);
    await loginToSheet(page, POLICY);
    await field(page, '/title').getByRole('textbox').fill('Information security policy, 2027');
    await page.getByTestId('save-everyone').click();
    await expect(page.getByText('The Git server cannot be reached')).toBeVisible();
    await expect(field(page, '/title').getByRole('textbox')).toHaveValue(
      'Information security policy, 2027',
    );
    expect(sentTo(await acts(request), savePath(POLICY), 'POST').length).toBeGreaterThan(0);
  });

  test('a change is kept as a draft for the person, then saved for everyone, as in the generic lens', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page, POLICY);
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'clean');
    await field(page, '/title').getByRole('textbox').fill('Information security policy, 2027');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'draft');
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  });
});
