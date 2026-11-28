import { expect, test } from '@playwright/test';
import { expectNoSeriousViolations } from './helpers/a11y.js';
import { NOTES, noteAddress, sentTo, submitPath, useLanguage } from './helpers/documents.js';
import { acts, broadcast, clearActs, gotoState, useScenario } from './helpers/mock.js';
import { login } from './helpers/login.js';

/**
 * The release of a document of the generic lens and what leads to it (UC-DOC-7, UC-DOC-8, UC-DOC-9; AUN-WEB-6): the
 * review with its diff, the release by every way of confirming, every refusal with its text, the release request in
 * Due, and the search of the documents in the palette, against the `note-release-*` and `note-search-*` states of the
 * mock (web-mock/README.adoc, Document Lifecycle). The release of a SAMM assessment stays in `samm.spec.js`.
 */

/** @returns the address of the release of a note */
function releaseAddress(id) {
  return `${noteAddress(id)}/release`;
}

/** @returns the path of the release of a note at the mock */
function releasePath(id) {
  return `/api/v1/releases/test-notes/${id}`;
}

/** @returns the line of the page that a refusal or a success is announced in */
function notices(page) {
  return page.getByTestId('release-view').getByTestId('notice');
}

test.describe('the review', () => {
  test('shows the document, the checks and the changes in the words of the domain', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await login(page, releaseAddress(NOTES.N4));
    await expect(page.getByTestId('release-view')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Release Supplier security questionnaire',
    );
    await expect(page.getByTestId('release-act')).toHaveText('Release');
    await expect(page.getByTestId('release-facts')).toContainText('Version');
    await expect(page.getByText('The first release: everything in the document')).toBeVisible();
    // A person is shown by the name, an option by its text.
    await expect(page.getByTestId('record-owner')).toContainText('Jordan Weber');
    await expect(page.getByTestId('record-owner')).not.toContainText('p-2b7f10');
    await expect(page.getByTestId('record-status')).toContainText('Open');
    await expect(page.getByText('Every mandatory field is filled in')).toBeVisible();
    await expect(
      page.getByText('You confirm your identity once more before the release.'),
    ).toBeVisible();
    // The control names the act only: no method on it.
    await expect(page.getByTestId('release-act')).not.toContainText(/password|step|MFA|token/i);
    await expectNoSeriousViolations(page, 'release review');
  });

  test('compares with the last release and reads the request of the agent', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await login(page, releaseAddress(NOTES.N5));
    await expect(page.getByText('Changes since v1.')).toBeVisible();
    const summary = page.getByTestId('record-summary');
    await expect(summary.locator('del')).toContainText('Review who has access');
    await expect(summary.locator('ins')).toContainText('service accounts every half year');
    await expect(page.getByTestId('record-actions')).toContainText('Row 2, Done');
    await expect(page.getByTestId('release-request')).toContainText('Jordan Weber asked');
    await expect(page.getByTestId('release-request')).toContainText(
      'Reviewed with the team; ready to release.',
    );
  });

  test('is read in German with the words of the domain only', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await login(page, releaseAddress(NOTES.N4));
    await useLanguage(page, 'de');
    await expect(page.getByTestId('release-act')).toHaveText('Freigeben');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Supplier security questionnaire freigeben',
    );
    await expect(
      page.getByText('Vor der Freigabe bestätigen Sie noch einmal Ihre Identität.'),
    ).toBeVisible();
    await expect(page.getByText('Alle Pflichtfelder sind ausgefüllt')).toBeVisible();
    await expect(page.getByTestId('release-back')).toHaveText('Zurück zum Dokument');
    await expect(page.getByTestId('release-act')).not.toContainText(/Passwort|Schritt|MFA|Token/i);
  });

  test('goes back to the document without writing anything', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await clearActs(request);
    await login(page, releaseAddress(NOTES.N4));
    await page.getByTestId('release-back').click();
    await expect(page).toHaveURL(noteAddress(NOTES.N4));
    await expect(page.getByTestId('document-sheet')).toBeVisible();
    expect(await acts(request)).toEqual([]);
  });

  test('leads from the sheet of a document in review to its release', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await login(page, noteAddress(NOTES.N4));
    await page.getByTestId('transition-test-note.release').click();
    await expect(page).toHaveURL(releaseAddress(NOTES.N4));
    await expect(page.getByTestId('release-record')).toBeVisible();
  });
});

test.describe('the release', () => {
  test('with the identity provider: the step-up first, then the seal', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-release-step-up');
    await clearActs(request);
    await login(page, releaseAddress(NOTES.N4));
    const demanded = page.waitForResponse(
      (response) => response.url().includes('/api/v1/releases/') && response.status() === 403,
    );
    await page.getByTestId('release-act').click();
    await demanded;
    // The step-up address returns to the release; the act is chosen again.
    await expect(page).toHaveURL(releaseAddress(NOTES.N4));
    await expect(page.getByTestId('release-act')).not.toHaveAttribute('aria-busy', 'true');
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toContainText('Released as v1');
    await expect(page.getByTestId('release-seal')).toHaveAttribute('data-sealed', 'v1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Supplier security questionnaire is released',
    );
    await expect(page.getByTestId('release-tag')).toContainText('notes/');
    expect(sentTo(await acts(request), releasePath(NOTES.N4), 'POST').length).toBeGreaterThan(0);
    await expectNoSeriousViolations(page, 'release done');
    await page.getByTestId('release-open').click();
    await expect(page).toHaveURL(noteAddress(NOTES.N4));
    await expect(page.getByTestId('document-sheet')).toBeVisible();
  });

  test('with the password of a local user: a wrong one is refused, the right one releases', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-release-wrong-password');
    await login(page, releaseAddress(NOTES.N4));
    await page.getByTestId('release-act').click();
    await expect(page.getByRole('dialog')).toContainText('Confirm your identity');
    await expect(page.getByRole('dialog')).toContainText(
      'Enter your password to release Supplier security questionnaire.',
    );
    await page.getByTestId('release-password').fill('wrong');
    await page.getByTestId('release-confirm').click();
    await expect(page.getByRole('dialog')).toContainText(
      'The password is not right. Nothing was changed.',
    );
    await expect(page.getByTestId('release-done')).toHaveCount(0);
    await gotoState(request, 'note-release-password');
    await page.getByTestId('release-password').fill('right');
    await page.getByTestId('release-confirm').click();
    await expect(page.getByTestId('release-done')).toBeVisible();
    await expect(page.getByTestId('release-seal')).toHaveAttribute('data-sealed', 'v1');
  });

  test('asks the password before anything is sent and lets the person cancel', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-release-password');
    await clearActs(request);
    await login(page, releaseAddress(NOTES.N4));
    await page.getByTestId('release-act').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(sentTo(await acts(request), releasePath(NOTES.N4))).toHaveLength(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(sentTo(await acts(request), releasePath(NOTES.N4))).toHaveLength(0);
    await expect(page.getByTestId('release-act')).toBeEnabled();
  });

  test('reads the new diff when someone saved meanwhile, then releases what was shown', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-release-changed');
    await login(page, releaseAddress(NOTES.N4));
    await expect(page.getByTestId('record-summary')).toContainText('in January');
    const demanded = page.waitForResponse(
      (response) => response.url().includes('/api/v1/releases/') && response.status() === 409,
    );
    await page.getByTestId('release-act').click();
    await demanded;
    await expect(notices(page).first()).toContainText(
      'Someone saved after you opened the release. Check the changes again.',
    );
    await expect(page.getByTestId('release-done')).toHaveCount(0);
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toBeVisible();
  });

  test('says what is missing when the server finds a mandatory field empty', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-release-incomplete');
    await login(page, releaseAddress(NOTES.N4));
    await page.getByTestId('release-act').click();
    await expect(notices(page).first()).toContainText('Some mandatory fields are empty.');
    await expect(
      page.getByText('Fill in Owner, then release again. Nothing was changed.'),
    ).toBeVisible();
    await expect(page.getByTestId('release-done')).toHaveCount(0);
    await expectNoSeriousViolations(page, 'release refused');
  });

  test('shows the document as released when someone released it meanwhile', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await login(page, releaseAddress(NOTES.N4));
    await expect(page.getByTestId('release-act')).toBeEnabled();
    await gotoState(request, 'note-release-released-meanwhile');
    await page.getByTestId('release-act').click();
    await expect(notices(page).first()).toContainText(
      'Someone released this document while you were reviewing it. Nothing was changed.',
    );
    await expect(page.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('This document is released already.')).toBeVisible();
    await expect(page.getByTestId('release-done')).toHaveCount(0);
  });

  test('tells a release the Git server refused, and one it cannot reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-rejected');
    await login(page, releaseAddress(NOTES.N4));
    await page.getByTestId('release-act').click();
    await expect(page.getByRole('alert')).toContainText('The Git server refused the change.');
    await gotoState(request, 'note-git-unavailable');
    await page.getByTestId('release-act').click();
    await expect(page.getByRole('alert')).toContainText('The Git server cannot be reached.');
    await expect(page.getByTestId('release-done')).toHaveCount(0);
    await expect(page.getByTestId('release-act')).toBeEnabled();
  });

  test('says that many people are logging in, and keeps the review', async ({ page, request }) => {
    await useScenario(request, 'workshop#note-release-too-many-logins');
    await login(page, releaseAddress(NOTES.N4));
    await page.getByTestId('release-act').click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Many people are logging in' }),
    ).toBeVisible();
    await expect(page.getByTestId('release-record')).toBeVisible();
    await expect(page.getByTestId('release-act')).toBeEnabled();
  });

  test('the approver without the right is told why, and a draft asks for the submit first', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await login(page, releaseAddress(NOTES.N4));
    await expect(page.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Releasing needs the approve right.')).toBeVisible();
    await useScenario(request, 'workshop');
    await page.goto(releaseAddress(NOTES.N2));
    await expect(page.getByText('Submit the document for review first.')).toBeVisible();
    await expect(page.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
  });

  test('an address that is no document is the not-found view', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await page.goto('/categories/test-note/01JZZZZZZZZZZZZZZZZZZZZZZZ/release');
    await expect(page.getByTestId('not-found-view')).toBeVisible();
    await page.goto('/categories/samm/01JZ8T5C7E9G1J3M5P7R9V1X3Z/release');
    await expect(page.getByTestId('not-found-view')).toBeVisible();
  });
});

test.describe('the flow of a note from submit to the next version', () => {
  test('is submitted, released and edited again as version 2', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await gotoState(request, 'ready');
    await clearActs(request);
    await login(page, noteAddress(NOTES.N9));
    await page.getByTestId('transition-test-note.submit').click();
    await expect(page.getByTestId('document-state')).toContainText('In review');
    expect(sentTo(await acts(request), submitPath(NOTES.N9), 'POST')).toHaveLength(1);
    await page.getByTestId('transition-test-note.release').click();
    await expect(page).toHaveURL(releaseAddress(NOTES.N9));
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toContainText('Released as v1');
    await page.getByTestId('release-open').click();
    await expect(page).toHaveURL(noteAddress(NOTES.N9));
    await expect(page.getByTestId('document-state')).toContainText('Released as v1');
    expect(sentTo(await acts(request), releasePath(NOTES.N9), 'POST')).toHaveLength(1);
  });
});

test.describe('a release request in Due', () => {
  test('shows who asked and the comment, opens the address it names, and leaves Due with the release', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-release-request');
    await login(page, '/');
    const list = page.getByTestId('due-list');
    const requested = list.locator('li', { hasText: 'Access review cadence' });
    await expect(requested.getByTestId('due-request')).toContainText(
      'Jordan Weber asked for the release.',
    );
    await expect(requested.getByTestId('due-request')).toContainText(
      'Reviewed with the team; ready to release.',
    );
    // The review of an approver with no request says nothing of one.
    const review = list.locator('li', { hasText: 'Supplier security questionnaire' });
    await expect(review.getByTestId('due-request')).toHaveCount(0);
    // The own request of the person opens the document, where they submit it.
    const own = list.locator('li', { hasText: 'Retention schedule for audit evidence' });
    await expect(own.getByTestId('due-request')).toContainText('You asked for the release.');
    await expect(own.getByRole('link')).toHaveAttribute('href', noteAddress(NOTES.N2));
    await expectNoSeriousViolations(page, 'due with release requests');
    await requested.getByRole('link').click();
    await expect(page).toHaveURL(releaseAddress(NOTES.N5));
    await expect(page.getByTestId('release-request')).toContainText(
      'Reviewed with the team; ready to release.',
    );
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toContainText('Released as v2');
    await page.getByTestId('nav-due').click();
    await expect(page.getByTestId('due-list')).toBeVisible();
    await expect(page.getByTestId('due-list').getByText('Access review cadence')).toHaveCount(0);
    // The review of the other note stays.
    await expect(
      page.getByTestId('due-list').getByText('Supplier security questionnaire'),
    ).toBeVisible();
  });

  test('is read in German', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await useLanguage(page, 'de');
    const list = page.getByTestId('due-list');
    await expect(
      list.locator('li', { hasText: 'Access review cadence' }).getByTestId('due-request'),
    ).toContainText('Jordan Weber hat um die Freigabe gebeten.');
    await expect(list.getByTestId('due-request').filter({ hasText: 'Sie haben' })).toHaveCount(1);
  });

  test('follows a request that arrives while the list is open', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await expect(page.getByTestId('due-list')).toBeVisible();
    await useScenario(request, 'workshop#note-release-request-done');
    await broadcast(request, 'document-transitioned', {
      repository: 'test-notes',
      id: NOTES.N5,
      state: 'released',
      version: 2,
    });
    await expect(page.getByTestId('due-list').getByText('Access review cadence')).toHaveCount(0);
  });
});

test.describe('the search of the documents in the palette', () => {
  /** Opens the palette with the keyboard and types. */
  async function search(page, text) {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-input')).toBeFocused();
    await page.getByTestId('search-input').fill(text);
  }

  test('finds a note by its title and opens it', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await search(page, 'rotation');
    const hit = page.getByTestId(`search-document-${NOTES.N1}`);
    await expect(hit).toContainText('Key rotation, decision of 24 November');
    await expect(hit).toContainText('Test notes');
    await expect(hit).toContainText('Released');
    await expect(page.getByTestId('search-status')).toContainText('One document matches.');
    await expectNoSeriousViolations(page, 'command palette with results');
    await hit.click();
    await expect(page).toHaveURL(noteAddress(NOTES.N1));
    await expect(page.getByTestId('document-sheet')).toBeVisible();
    await expect(page.getByTestId('search-input')).toBeHidden();
  });

  test('finds the documents of every category, SAMM assessments and notes together', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await search(page, 'Q4');
    const list = page.getByTestId('search-documents');
    await expect(list).toContainText('Backup restore test, Q4');
    await expect(list).toContainText('Payments 2026 Q4');
    await expect(list).toContainText('SAMM');
    await expect(list).toContainText('Test notes');
    await list
      .getByRole('link', { name: /Payments 2026 Q4/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/samm\//);
  });

  test('is operated by the keyboard: the arrow keys, Enter on a match, Escape', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await search(page, 'access');
    await expect(page.getByTestId('search-documents')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('search-documents').getByRole('link').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('search-input')).toBeFocused();
    // No view is named "access": Enter opens the first document, the Access control policy of the lens ISMS.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/isms/documents/01JZB2D4F6H8K0N2Q4S6V8X0Z3');
    await expect(page.getByTestId('document-sheet')).toBeVisible();
    await search(page, 'zzzz');
    await expect(page.getByTestId('search-status')).toContainText('No document matches.');
    // The first Escape clears the text of the search field, as in every browser; the next closes the palette.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('search-input')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('search-input')).toBeHidden();
  });

  test('asks for two characters, and a view still opens first on Enter', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await search(page, 'r');
    await expect(page.getByTestId('search-hint')).toContainText('at least two characters');
    await expect(page.getByTestId('search-documents')).toHaveCount(0);
    await page.getByTestId('search-input').fill('thre');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/threat-models');
  });

  test('says in a neutral notice that the documents cannot be searched', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#note-search-refused');
    await login(page, '/');
    await search(page, 'due');
    await expect(page.getByTestId('search-status')).toContainText(
      'The documents cannot be searched right now. The views still work.',
    );
    await expect(page.getByTestId('search-result-due')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('is served while the Git server cannot be reached', async ({ page, request }) => {
    await useScenario(request, 'workshop#note-git-unavailable');
    await login(page, '/');
    await search(page, 'rotation');
    await expect(page.getByTestId(`search-document-${NOTES.N1}`)).toBeVisible();
  });

  test('is read in German', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await useLanguage(page, 'de');
    await search(page, 'rotation');
    await expect(page.getByRole('heading', { name: 'Dokumente', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ansichten', exact: true })).toBeVisible();
    await expect(page.getByTestId('search-status')).toContainText('Ein Dokument passt.');
    await expect(page.getByTestId(`search-document-${NOTES.N1}`)).toContainText('Freigegeben');
    await page.getByTestId('search-input').fill('zzzz');
    await expect(page.getByTestId('search-status')).toContainText('Kein Dokument passt.');
  });
});
