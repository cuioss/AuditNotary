import { expect, test } from '@playwright/test';
import { useScenario } from './helpers/mock.js';
import { expectNoSeriousViolations } from './helpers/a11y.js';
import { LOCAL_ACCOUNT, login, loginLocal } from './helpers/login.js';
import { NOTES, field, loginToDocuments, noteAddress } from './helpers/documents.js';
import {
  catalogAddress,
  entryAddress,
  fillNewService,
  loginToCatalogs,
  newEntryAddress,
} from './helpers/catalogs.js';
import {
  NEW_SCOPE_ADDRESS,
  OPEN,
  RELEASED,
  assessmentAddress,
  choose,
  fillNewAssessment,
  loginToSamm,
  newAssessmentAddress,
} from './helpers/samm.js';
import {
  PAIR,
  REPORTS_ADDRESS,
  RISKS_ADDRESS,
  THREATS_ADDRESS,
  TREND_ADDRESS,
  compareAddress,
  expectLegibleText,
  loginToReports,
  risksAddress,
  trendAddress,
} from './helpers/reports.js';
import {
  CHECKOUT,
  LENS_ADDRESS,
  editThreat,
  loginToSheet,
  loginToThreats,
  newAddress,
  releaseAddress,
  serviceAddress,
} from './helpers/threats.js';
import {
  addRow,
  addThreat,
  addZone,
  fillName,
  goOn,
  loginToChoice,
  loginToWizard,
  routeCreate,
  stepField,
  stepHeading,
  walkEmpty,
  walkQuickStart,
} from './helpers/wizard.js';
import {
  ARCHIVE,
  CARD_DATA,
  CREDENTIAL_STUFFING,
  OUTAGE,
  PHISHING,
  STAGES,
  SUSPICIOUS,
  WRONG_RECIPIENT,
  createPath,
  incidentAddress,
  loginToIncidents,
  loginToNew,
  loginToRelease,
  loginToSheet as loginToIncident,
  newIncidentAddress,
  pinClock,
  readPath,
  withOpenDeadlines,
} from './helpers/incidents.js';
import { patchRead } from './helpers/samm.js';
import {
  AUDIT_2025,
  KINDS as ISMS_KINDS,
  POLICY,
  SCOPE,
  SECURE_DEVELOPMENT,
  compareAddress as ismsCompareAddress,
  documentAddress as ismsDocumentAddress,
  documentsAddress as ismsDocumentsAddress,
  listedIds as ismsListedIds,
  loginToCompare as loginToIsmsCompare,
  loginToIsms,
  loginToRelease as loginToIsmsRelease,
  loginToSheet as loginToIsmsSheet,
  newAddress as ismsNewAddress,
} from './helpers/isms.js';
import {
  CANDIDATES,
  DESCRIPTOR,
  IMPORT_ADDRESS,
  PERSONS_ADDRESS,
  PROFILE_ADDRESS,
  WELCOME_ADDRESS,
  fillPerson,
  loginToDirectory,
  pasteDescriptor,
} from './helpers/directory.js';

/**
 * The phone layout (pm-web-app design, below 768 px): the rail gives way to the bottom bar with "More".
 */
test('the bottom bar replaces the rail and "More" holds the other lenses', async ({
  page,
  request,
}) => {
  await useScenario(request, 'workshop');
  await login(page, '/');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await expect(page.getByTestId('bottom-nav-samm')).toBeVisible();
  await page.getByTestId('bottom-more').click();
  await page.getByRole('dialog').getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
});

/**
 * The pages outside the shell and the notices of the shell at 390 px (UC-ACC-1, -2, -7): one column, nothing wider
 * than the screen, the acts reachable.
 */
test.describe('at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** Fails when the page scrolls sideways. */
  async function expectNoSideways(page) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }

  test('the login page of local test accounts fits and logs in', async ({ page, request }) => {
    await useScenario(request, 'local');
    await page.goto('/login?return=%2Fsamm');
    await expect(page.getByTestId('login-view')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
    await expect(page.getByTestId('bottom-nav-samm')).toHaveCount(0);
    await expect(page.getByTestId('notice').first()).toContainText('local test accounts');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'login (phone)');
    await page.getByTestId('login-username').fill(LOCAL_ACCOUNT.username);
    await page.getByTestId('login-password').fill(LOCAL_ACCOUNT.password);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/samm');
    await expect(page.getByTestId('bottom-nav-samm')).toBeVisible();
  });

  test('the signed-out page fits and its act is reachable', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await page.goto('/signed-out');
    await expect(page.getByTestId('signed-out-view')).toBeVisible();
    await expect(page.getByTestId('signed-out-login')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'signed-out (phone)');
  });

  for (const reason of ['idp-unavailable', 'too-many-logins', 'unknown-transaction']) {
    test(`the login problem ${reason} fits and its act is reachable`, async ({ page, request }) => {
      await useScenario(request, `login-trouble#${reason}`);
      await page.goto(`/login-problem?reason=${reason}`);
      await expect(page.getByTestId('login-problem-view')).toBeVisible();
      await expect(page.getByTestId('login-problem-retry')).toBeInViewport();
      await expectNoSideways(page);
      await expectNoSeriousViolations(page, `login-problem ${reason} (phone)`);
    });
  }

  test('the notice of local test accounts on a shell page fits', async ({ page, request }) => {
    await useScenario(request, 'local');
    await loginLocal(page, '/');
    await expect(page.getByTestId('notice').first()).toContainText('local test accounts');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'local notice (phone)');
  });

  test('a session without a right shows the notice and the empty state', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'no-rights');
    await login(page, '/samm');
    await expect(page.getByTestId('no-rights-view')).toBeVisible();
    await expect(page.getByTestId('bottom-nav-samm')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'no rights (phone)');
  });

  test('the documents list fits, and the act to start a document is reachable', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToDocuments(page, '/categories/test-note');
    await expect(page.getByTestId('document-list')).toBeVisible();
    await expect(page.getByTestId('new-document')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'documents list (phone)');
  });

  test('a document sheet fits, and saving and its steps are reachable', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToDocuments(page, noteAddress(NOTES.N2));
    await expect(page.getByTestId('document-sheet')).toBeVisible();
    await expect(page.getByTestId('save-everyone')).toBeInViewport();
    await page.getByTestId('transition-test-note.submit').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('transition-test-note.submit')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'document sheet (phone)');
  });

  test('the table of a document fits, and its row editor is a dialog in the viewport', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToDocuments(page, noteAddress(NOTES.N2));
    await page.getByTestId('table--actions').getByRole('button', { name: 'Add row' }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'document row editor (phone)');
  });

  test('the conflict panel fits, and each field can be decided', async ({ page, request }) => {
    await useScenario(request, 'workshop#note-conflict');
    await loginToDocuments(page, noteAddress(NOTES.N2));
    await field(page, '/status').getByRole('combobox').selectOption({ label: 'Agreed' });
    await field(page, '/summary').getByRole('textbox').fill('Rotate every 90 days.');
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('conflict-panel')).toBeVisible();
    await expect(page.getByTestId('keep-own-/summary')).toBeVisible();
    await page.getByTestId('keep-own-/summary').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('keep-own-/summary')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'document conflict (phone)');
  });

  test('the list of empty mandatory fields fits, and leads back to editing', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToDocuments(page, noteAddress(NOTES.N3));
    await page.getByTestId('transition-test-note.submit').click();
    await expect(page.getByTestId('missing-fields')).toBeVisible();
    await expect(page.getByTestId('back-to-editing')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'document missing fields (phone)');
    await page.getByTestId('back-to-editing').click();
    await expect(page.getByTestId('missing-fields')).toHaveCount(0);
  });

  test('an earlier state and the revision picker fit', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await loginToDocuments(page, noteAddress(NOTES.N6, '?at=v1'));
    await expect(page.getByTestId('revision-notice')).toBeVisible();
    await page.getByTestId('revision-select').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('revision-select')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'document earlier state (phone)');
  });

  test('a new document fits, and the question before leaving is in the viewport', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToDocuments(page, '/categories/test-note/new');
    await field(page, '/title').getByRole('textbox').fill('Typed on a phone');
    await expect(page.getByTestId('save-everyone')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new document (phone)');
    await page.getByTestId('bottom-more').click();
    await page.getByRole('dialog').getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByTestId('leave-confirm')).toBeInViewport();
    await expectNoSeriousViolations(page, 'leave question (phone)');
  });

  test('a sheet that is read only fits', async ({ page, request }) => {
    await useScenario(request, 'read-only');
    await loginToDocuments(page, noteAddress(NOTES.N2));
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'read-only');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'document read only (phone)');
  });

  test('the release of a note fits, its act is reachable, and the seal fits', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await page.goto(
      `/api/v1/auth/login?return=${encodeURIComponent(`${noteAddress(NOTES.N5)}/release`)}`,
    );
    await expect(page.getByTestId('release-view')).toBeVisible();
    // The act stays in reach above the record, as the save state of a sheet does.
    await expect(page.getByTestId('release-act')).toBeInViewport();
    await expect(page.getByTestId('release-request')).toBeVisible();
    await page.getByTestId('record-actions').scrollIntoViewIfNeeded();
    // The summary of a group of the record is a target of the phone size, in every release that draws one.
    await expectTarget(page.getByTestId('record-actions').locator('summary'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'release review (phone)');
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-seal')).toBeVisible();
    await expect(page.getByTestId('release-open')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'release done (phone)');
  });

  test('the palette with results fits, and a hit is reachable', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await page.goto('/api/v1/auth/login?return=%2F');
    await expect(page.getByTestId('due-view')).toBeVisible();
    await page.getByTestId('search-open').click();
    await page.getByTestId('search-input').fill('Q4');
    await expect(page.getByTestId('search-documents')).toBeVisible();
    await expect(page.getByTestId(`search-document-${NOTES.N3}`)).toBeVisible();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'palette with results (phone)');
  });

  test('the release requests in Due fit', async ({ page, request }) => {
    await useScenario(request, 'workshop');
    await page.goto('/api/v1/auth/login?return=%2F');
    await expect(page.getByTestId('due-list')).toBeVisible();
    await expect(page.getByTestId('due-request').first()).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'due with release requests (phone)');
  });
  test('the catalogs and the entries of a catalog fit, and the act to add one is reachable', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin');
    await loginToCatalogs(page, catalogAddress('service'));
    await expect(page.getByTestId('entry-list')).toBeVisible();
    await expect(page.getByTestId('new-entry')).toBeInViewport();
    await expect(page.getByTestId('entry-ledger')).toContainText('Retired');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'catalog entries (phone)');
  });

  test('the sheet of a service fits, with its needs and its dependencies as stacked rows', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin');
    await loginToCatalogs(page, entryAddress('service', 'payment-api'));
    await expect(page.getByTestId('entry-sheet')).toBeVisible();
    await expect(page.getByTestId('save-entry')).toBeInViewport();
    await page.getByTestId('service-needs').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('needs-confidentiality')).toBeVisible();
    await page.getByTestId('depends-table').scrollIntoViewIfNeeded();
    // Below 40 rem the table stacks: each cell names itself, and the head row is not drawn.
    await expect(page.getByTestId('depends-service:customer-db')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'service sheet (phone)');
  });

  test('a list of one column and a reason that wraps keep their width, their dot and their targets', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin');
    await loginToCatalogs(page, entryAddress('service', 'payment-api'));
    await expect(page.getByTestId('entry-sheet')).toBeVisible();
    // A list of one column has no label column: its cell and its caption take the width of the list.
    const list = field(page, '/repositories');
    await list.scrollIntoViewIfNeeded();
    const frame = await list.locator('table').boundingBox();
    const cell = await list.locator('tbody td').first().boundingBox();
    const caption = await list.locator('caption').boundingBox();
    expect(cell.width).toBeGreaterThan(frame.width - 2);
    expect(caption.width).toBeGreaterThan(frame.width - 2);
    // The reason of an entry that does not count is a sentence: it wraps, and the dot stays beside its first line.
    const row = page.getByTestId('depends-external:psp-provider');
    await row.scrollIntoViewIfNeeded();
    const measure = await row.locator('[data-tone]').evaluate((label) => {
      const dot = label.querySelector('.status__dot').getBoundingClientRect();
      const word = label.querySelector('.status__word');
      const box = word.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(word).lineHeight);
      return {
        lines: Math.round(box.height / line),
        offset: dot.top + dot.height / 2 - (box.top + line / 2),
      };
    });
    expect(measure.lines).toBeGreaterThan(1);
    expect(Math.abs(measure.offset)).toBeLessThan(3);
    // The links of the stacked rows are targets of the phone's size.
    for (const link of await page.getByTestId('service-needs').getByRole('link').all()) {
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('a circle of dependencies and the retired entry fit', async ({ page, request }) => {
    await useScenario(request, 'catalog-admin');
    await loginToCatalogs(page, entryAddress('service', 'reporting'));
    await expect(page.getByTestId('cycle-notice')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'service on a circle (phone)');
    await page.goto(entryAddress('service', 'ledger'));
    await expect(page.getByTestId('retired-notice')).toBeVisible();
    await expect(page.getByTestId('entry-state')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'retired entry (phone)');
  });

  test('the form of a new service fits, and saving is reachable', async ({ page, request }) => {
    await useScenario(request, 'catalog-admin');
    await loginToCatalogs(page, newEntryAddress('service'));
    await expect(page.getByTestId('entry-form')).toBeVisible();
    await expect(page.getByTestId('save-entry')).toBeInViewport();
    await fillNewService(page, field, { id: 'notification-gateway', name: 'Notification gateway' });
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'changed');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new catalog entry (phone)');
  });

  test('the question before a retirement is a dialog in the viewport, and both answers are reachable', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin');
    await loginToCatalogs(page, entryAddress('service', 'customer-portal'));
    await page.getByTestId('retire-entry').scrollIntoViewIfNeeded();
    await page.getByTestId('retire-entry').click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expect(page.getByTestId('retire-cancel')).toBeInViewport();
    await expect(page.getByTestId('retire-confirm')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'retire question (phone)');
  });

  test('a sheet without the right fits and says why nothing can be changed', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToCatalogs(page, entryAddress('service', 'payment-api'));
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'read-only');
    await expect(page.getByTestId('save-state')).toContainText('Changing it needs the right');
    await expect(page.getByTestId('no-right-notice')).toHaveCount(0);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'catalog entry read only (phone)');
  });

  test('a refusal on the form fits, and the field it marks is reachable', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin#catalog-invalid');
    await loginToCatalogs(page, newEntryAddress('service'));
    await fillNewService(page, field, { id: 'notification-gateway', name: 'Notification gateway' });
    await page.getByTestId('save-entry').click();
    await expect(page.getByTestId('failure-notice')).toBeVisible();
    await field(page, '/owner/team').scrollIntoViewIfNeeded();
    await expect(field(page, '/owner/team')).toContainText('This reference leads nowhere.');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'catalog entry with errors (phone)');
  });

  test('the pages of the directory are reached from the catalogs, with targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin');
    await loginToCatalogs(page, catalogAddress('team'));
    await page.getByTestId('triage-up').click();
    await expect(page.getByTestId('directory-nav')).toBeVisible();
    for (const link of await page.getByTestId('directory-nav').getByRole('link').all()) {
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
    }
    await page.getByTestId('directory-import').click();
    await expect(page).toHaveURL(IMPORT_ADDRESS);
    await expect(page.getByTestId('import-view')).toBeVisible();
  });

  test('the import fits in every step, and its acts are in reach', async ({ page, request }) => {
    await useScenario(request, 'catalog-admin');
    await loginToDirectory(page, IMPORT_ADDRESS, 'import-view');
    await page.getByTestId('import-check').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('import-check')).toBeInViewport();
    await expect(page.getByTestId('import-view')).toContainText(
      'Choose or paste a document first.',
    );
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'import choose (phone)');
    await pasteDescriptor(page, DESCRIPTOR);
    await page.getByTestId('import-check').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('import-check')).toBeInViewport();
    await expectNoSideways(page);
    await page.getByTestId('import-check').click();
    await expect(page.getByTestId('import-result')).toBeVisible();
    // The tables stack: each cell names itself.
    await page.getByTestId('import-left-out').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('left-out-0')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'import check (phone)');
    await page.getByTestId('import-apply').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('import-apply')).toBeInViewport();
    await expect(page.getByTestId('import-back')).toBeInViewport();
    await page.getByTestId('import-apply').click();
    await expect(page.getByTestId('import-again')).toBeVisible();
    await expect(page.getByTestId('import-open')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'import result (phone)');
  });

  test('a refusal of the import and the page without the right fit', async ({ page, request }) => {
    await useScenario(request, 'catalog-admin#import-too-large');
    await loginToDirectory(page, IMPORT_ADDRESS, 'import-view');
    await pasteDescriptor(page, DESCRIPTOR);
    await page.getByTestId('import-check').click();
    await expect(page.getByTestId('import-failure')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'import refused (phone)');
    await useScenario(request, 'workshop');
    await page.goto(IMPORT_ADDRESS);
    await expect(page.getByTestId('import-view')).toContainText('Importing needs the right');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'import without the right (phone)');
  });

  test('the table of the persons fits, the erase act of a row and the question before it are in reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin');
    await loginToDirectory(page, PERSONS_ADDRESS, 'persons-view');
    await expect(page.getByTestId('person-p-2b7f10')).toContainText('Payments, Developer');
    await page.getByTestId('erase-p-2b7f10').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('erase-p-2b7f10')).toBeInViewport();
    expect((await page.getByTestId('erase-p-2b7f10').boundingBox()).height).toBeGreaterThanOrEqual(
      43.5,
    );
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'persons (phone)');
    await page.getByTestId('erase-p-2b7f10').click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expect(page.getByTestId('erase-cancel')).toBeInViewport();
    await expect(page.getByTestId('erase-confirm')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'erase question (phone)');
  });

  test('the prefill fits, and its acts and the refusal on a row are in reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'catalog-admin#persons-invalid');
    await loginToDirectory(page, PERSONS_ADDRESS, 'persons-view');
    await page.getByTestId('persons-add').scrollIntoViewIfNeeded();
    await fillPerson(page, 0, { name: 'Nadia Kovac' });
    await page.getByTestId('persons-add-row').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('persons-add-row')).toBeInViewport();
    await page.getByTestId('persons-submit').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('persons-submit')).toBeInViewport();
    await expectNoSideways(page);
    await page.getByTestId('persons-add-row').click();
    await fillPerson(page, 1, { name: 'Omar Haddad' });
    await page.getByTestId('persons-submit').click();
    await page.getByTestId('person-row-1').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('person-row-1')).toContainText('leads nowhere');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'prefill refused (phone)');
  });

  test('the persons without the right fit and offer no act', async ({ page, request }) => {
    await useScenario(request, 'read-only');
    await loginToDirectory(page, PERSONS_ADDRESS, 'persons-view');
    await expect(page.getByTestId('persons-read-only')).toBeVisible();
    await expect(page.getByTestId('persons-add')).toHaveCount(0);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'persons read only (phone)');
  });

  test('the candidates of a first login fit, and choosing and continuing are in reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'first-login#candidates-not-bindable');
    await loginToDirectory(page, WELCOME_ADDRESS, 'welcome-view');
    await page.getByTestId('welcome-role').selectOption({ label: 'Developer' });
    await page.getByTestId('welcome-save').click();
    await expect(page.getByTestId('welcome-candidates')).toBeVisible();
    const choice = page.getByRole('radio', { name: CANDIDATES[0].label });
    await choice.scrollIntoViewIfNeeded();
    await expect(choice).toBeInViewport();
    // The radio itself is small; the whole label is the target and holds the phone size.
    expect(
      (await choice.locator('xpath=ancestor::label').boundingBox()).height,
    ).toBeGreaterThanOrEqual(43.5);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'welcome candidates (phone)');
    await choice.check();
    await page.getByTestId('welcome-continue').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('welcome-continue')).toBeInViewport();
    await page.getByTestId('welcome-continue').click();
    await expect(page.getByTestId('welcome-candidates')).toContainText('cannot be taken over');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'welcome not bindable (phone)');
  });

  test('the notice of a due confirmation fits, its link is a target of the phone size, and the entry fits', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#confirmation-due');
    await loginToDirectory(page, '/', 'due-view');
    await expect(page.getByTestId('confirmation-notice')).toBeVisible();
    await expect(page.getByTestId('confirmation-link')).toBeInViewport();
    expect(
      (await page.getByTestId('confirmation-link').boundingBox()).height,
    ).toBeGreaterThanOrEqual(43.5);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'confirmation notice (phone)');
    await page.getByTestId('confirmation-link').click();
    await expect(page.getByTestId('profile-view')).toBeVisible();
    await expect(page.getByTestId('profile-confirm-act')).toBeVisible();
    await page.getByTestId('profile-confirm-act').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('profile-confirm-act')).toBeInViewport();
    await expect(page.getByTestId('profile-save')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'profile confirmation (phone)');
  });

  test('the own entry fits, saving is in reach, and the question before leaving is in the viewport', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToDirectory(page, PROFILE_ADDRESS, 'profile-view');
    await page.getByTestId('profile-name').fill('Alexandra Example');
    await page.getByTestId('profile-membership-add').click();
    await expect(page.getByTestId('profile-membership-1')).toBeVisible();
    await page.getByTestId('profile-save').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('profile-save')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'profile (phone)');
    await page.getByTestId('bottom-nav-samm').click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expect(page.getByTestId('leave-stay')).toBeInViewport();
    await expect(page.getByTestId('leave-confirm')).toBeInViewport();
    await expectNoSeriousViolations(page, 'profile leave question (phone)');
  });
  /** Fails when a control is smaller than the phone size of a target (AUN-WEB-2): 44 px, with the rounding of a box. */
  async function expectTarget(locator) {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeInViewport();
    const box = await locator.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    expect(box.width).toBeGreaterThanOrEqual(43.5);
  }

  test('the form of a new scope fits, its controls are targets of the phone size and its targets are a list', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSamm(page, NEW_SCOPE_ADDRESS);
    await expect(page.getByTestId('new-scope-sheet')).toBeVisible();
    await expectNoSideways(page);
    await expectTarget(page.getByTestId('new-scope-title'));
    await expectTarget(page.getByTestId('new-scope-model'));
    await expectTarget(page.getByTestId('new-scope-subject'));
    // The targets collapse to a list: the column heads are gone, each control names what it sets.
    const row = page.getByTestId('new-scope-targets-editor').locator('[data-practice="sm"]');
    await row.scrollIntoViewIfNeeded();
    await expect(
      page.getByTestId('new-scope-targets-editor').locator('.head').first(),
    ).toBeHidden();
    await expect(row.locator('.row__cap').first()).toBeVisible();
    await expectTarget(page.getByTestId('new-scope-targets-editor-sm-target'));
    await choose(page, 'new-scope-targets-editor-sm-target', '2');
    await expectTarget(page.getByTestId('new-scope-targets-editor-sm-due'));
    await expectNoSideways(page);
    await page.getByTestId('create-scope').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('create-scope')).toBeInViewport();
    await expectNoSeriousViolations(page, 'new scope (phone)');
    await page.getByTestId('new-scope-title').fill('Typed');
    await page.getByTestId('bottom-nav-samm').click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expect(page.getByTestId('leave-stay')).toBeInViewport();
    await expect(page.getByTestId('leave-confirm')).toBeInViewport();
    await expectNoSeriousViolations(page, 'new scope leave question (phone)');
  });

  test('the form of a new scope that was refused fits, and the refusal is at its fields', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#scope-invalid');
    await loginToSamm(page, NEW_SCOPE_ADDRESS);
    await page.getByTestId('new-scope-title').fill('Bad');
    await choose(page, 'new-scope-subject', 'Payments');
    await choose(page, 'new-scope-targets-editor-ta-target', '2.5');
    await page.getByTestId('create-scope').scrollIntoViewIfNeeded();
    await page.getByTestId('create-scope').click();
    await expect(page.getByTestId('save-state')).toContainText('Nothing was created.');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new scope refused (phone)');
  });

  test('the form of a new assessment fits, its acts are in reach, and the open notice links to the open one', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSamm(page, newAssessmentAddress('shop'));
    await expect(page.getByTestId('new-assessment-sheet')).toBeVisible();
    await expectTarget(page.getByTestId('new-assessment-title'));
    await expectTarget(page.getByTestId('new-assessment-date'));
    await expectTarget(page.getByTestId('new-assessment-model'));
    await expectTarget(page.getByTestId('assessor-add'));
    await page.getByTestId('assessor-add').click();
    await expectTarget(page.getByTestId('assessor-0-remove'));
    await expectTarget(page.getByTestId('assessor-0-person'));
    await fillNewAssessment(page, 'Web shop 2026 Q4');
    await page.getByTestId('create-assessment').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('create-assessment')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new assessment (phone)');
    await page.goto(newAssessmentAddress('payments'));
    await expect(page.getByTestId('open-notice')).toBeVisible();
    await expectTarget(page.getByTestId('open-notice').getByRole('link'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new assessment while one is open (phone)');
  });

  test('the targets of a scope are a list, their controls are targets of the phone size, and the save is in reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSamm(page, '/samm/payments');
    await expect(page.getByTestId('targets-ta-target')).toBeVisible();
    await expect(page.getByTestId('targets').locator('.head').first()).toBeHidden();
    await expect(
      page.getByTestId('targets').locator('[data-practice="ta"] .row__cap').first(),
    ).toBeVisible();
    await expectTarget(page.getByTestId('targets-ta-target'));
    await expectTarget(page.getByTestId('targets-ta-due'));
    await expectNoSideways(page);
    await choose(page, 'targets-ta-target', '3');
    await page.getByTestId('save-targets').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('save-targets')).toBeInViewport();
    await expectTarget(page.getByTestId('save-targets'));
    await expectNoSeriousViolations(page, 'targets (phone)');
    await expect(page.getByRole('img', { name: /Overall score of the released/ })).toBeVisible();
  });

  test('the conflict of the targets fits, and both ways of deciding are targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#targets-conflict');
    await loginToSamm(page, '/samm/payments');
    await choose(page, 'targets-ta-target', '3');
    await page.getByTestId('save-targets').scrollIntoViewIfNeeded();
    await page.getByTestId('save-targets').click();
    const conflict = page.getByTestId('conflict-target-ta');
    await expect(conflict).toBeVisible();
    await expectTarget(conflict.getByRole('button', { name: 'Keep mine' }));
    await expectTarget(conflict.getByRole('button', { name: 'Take the target of Jordan Weber' }));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'targets conflict (phone)');
  });

  test('the targets read only fit and offer no control', async ({ page, request }) => {
    await useScenario(request, 'read-only');
    await loginToSamm(page, '/samm/payments');
    await expect(page.getByTestId('targets')).toBeVisible();
    await expect(page.getByTestId('targets-ta-target')).toHaveCount(0);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'targets read only (phone)');
  });

  test('the evidence of a practice is a list of cards, its acts are targets of the phone size, and the editor and the question are in the viewport', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSamm(page, assessmentAddress(OPEN.scope, OPEN.assessment, 'sb'));
    await expect(page.getByTestId('evidence-editor-table')).toBeVisible();
    await page.getByTestId('evidence').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectTarget(page.getByRole('button', { name: 'Edit row 1' }));
    await expectTarget(page.getByRole('button', { name: 'Remove row 1' }));
    await expectTarget(page.getByRole('button', { name: 'Add row' }));
    await expectNoSeriousViolations(page, 'evidence (phone)');
    await page.getByRole('button', { name: 'Add row' }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expect(page.getByTestId('evidence-editor-apply')).toBeInViewport();
    await expectTarget(page.getByTestId('evidence-editor-field-title'));
    await expectTarget(page.getByTestId('evidence-editor-field-url'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'evidence editor (phone)');
    await page.getByTestId('evidence-editor-cancel').click();
    await page.getByRole('button', { name: 'Remove row 1' }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expect(page.getByTestId('evidence-editor-remove-cancel')).toBeInViewport();
    await expect(page.getByTestId('evidence-editor-remove-confirm')).toBeInViewport();
    await expectNoSeriousViolations(page, 'evidence removal question (phone)');
  });

  test('the evidence that was refused fits, with the rows marked', async ({ page, request }) => {
    await useScenario(request, 'workshop#evidence-invalid');
    await loginToSamm(page, assessmentAddress(OPEN.scope, OPEN.assessment, 'sb'));
    await page.getByTestId('comment-sb-b-1').fill('x');
    await page.getByTestId('save-everyone').scrollIntoViewIfNeeded();
    await page.getByTestId('save-everyone').click();
    await page.getByTestId('evidence-editor-errors').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('evidence-editor-errors')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'evidence refused (phone)');
  });

  test('a frozen practice and a frozen assessment fit, and the way on is a target of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSamm(page, assessmentAddress(RELEASED.scope, RELEASED.assessment, 'sb'));
    await expect(page.getByTestId('practice-sheet')).toBeVisible();
    await expectTarget(page.getByTestId('start-new-assessment'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'frozen practice (phone)');
    await page.goto(assessmentAddress(RELEASED.scope, RELEASED.assessment));
    await expect(page.getByTestId('assessment-sheet')).toBeVisible();
    await expectTarget(page.getByTestId('start-new-assessment'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'frozen assessment (phone)');
  });

  test('the links of the overview, the address of an evidence link and the view switch are targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSamm(page, '/samm');
    await expect(page.getByTestId('samm-overview')).toBeVisible();
    for (const link of await page.getByTestId('samm-overview').locator('a.link').all()) {
      await expectTarget(link);
    }
    await page.goto(assessmentAddress(RELEASED.scope, RELEASED.assessment, 'sb'));
    await expectTarget(page.getByTestId('evidence-editor-table').getByRole('link').first());
    await page.goto(assessmentAddress(RELEASED.scope, RELEASED.assessment));
    await expect(page.getByTestId('assessment-sheet')).toBeVisible();
    await expectTarget(page.locator('label', { hasText: 'Table' }));
    await expectNoSideways(page);
  });

  test('the form of a new assessment keeps the removal of an assessor under the person it removes', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSamm(page, newAssessmentAddress('shop'));
    await page.getByTestId('assessor-add').click();
    const remove = page.getByTestId('assessor-0-remove');
    await expectTarget(remove);
    // Both boxes are read after the scroll of the check: a box is relative to the viewport.
    const select = await page.getByTestId('assessor-0-person').boundingBox();
    expect((await remove.boundingBox()).y).toBeGreaterThanOrEqual(select.y + select.height);
    await expect(remove).toHaveAccessibleName('Remove assessor 2');
    await expectNoSideways(page);
  });

  test('the refused comparison and the trend with the left-out versions fit', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#model-versions-differ');
    await loginToSamm(page, assessmentAddress(RELEASED.scope, RELEASED.assessment));
    await expect(page.getByTestId('versions-differ')).toBeVisible();
    await page.getByTestId('versions-differ').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'versions differ (phone)');
  });

  /** Fails when a table is not a list of stacked rows: its column heads are taken out of the flow (a 1 px clip). */
  async function expectStacked(table) {
    const box = await table.locator('thead').boundingBox();
    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
  }

  /** Fails when a chart is drawn smaller than the width its figure has: its text would shrink with it. */
  async function expectDrawnAtItsWidth(page, chart) {
    const scale = await page.getByTestId(chart).evaluate((figure) => {
      const svg = figure.querySelector('svg.chart__figure');
      return svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    });
    expect(scale).toBeGreaterThan(0.99);
    expect(scale).toBeLessThan(1.01);
  }

  test('the dashboard of the reports fits, its sections are single columns and its links are targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, REPORTS_ADDRESS, 'reports-view');
    // The links exist once the figures are read: wait for them before the links are counted.
    const row = page.getByTestId('reports-latest-payments');
    await expect(row).toBeVisible();
    await expectNoSideways(page);
    const links = await page.getByTestId('reports-view').locator('a.link').all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      await expectTarget(link);
    }
    // The latest assessments stack: the score and the change come under the name.
    await row.scrollIntoViewIfNeeded();
    const name = await row.locator('.latest__name').boundingBox();
    const change = await row.locator('.latest__change').boundingBox();
    expect(change.y).toBeGreaterThan(name.y);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'reports dashboard (phone)');
  });

  test('the trend of every scope fits, is drawn at its width with legible text, and its table stacks', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, TREND_ADDRESS, 'samm-trend-view');
    await page.getByTestId('trend-chart').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectDrawnAtItsWidth(page, 'trend-chart');
    await expectLegibleText(page, 'trend-chart');
    // The end values stay inside the figure; the first and the last axis label too.
    const outside = await page.getByTestId('trend-chart').evaluate((figure) => {
      const box = figure.querySelector('svg.chart__figure').getBoundingClientRect();
      return [...figure.querySelectorAll('text')].filter((text) => {
        const at = text.getBoundingClientRect();
        return at.left < box.left - 1 || at.right > box.right + 1;
      }).length;
    });
    expect(outside).toBe(0);
    await expectTarget(page.getByTestId('trend-scope'));
    for (const link of await page.getByTestId('trend-table').locator('a.link').all()) {
      await expectTarget(link);
    }
    // The table is a list of stacked rows: no column heads, each cell names itself.
    await expectStacked(page.getByTestId('trend-table'));
    await expect(
      page.getByTestId('trend-row-payments-2026-q2').locator('td[data-label]').first(),
    ).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'trend (phone)');
  });

  test('the trend of one scope fits with its five lines, and the mixed versions and the omitted ones fit', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, trendAddress('payments'), 'samm-trend-view');
    await page.getByTestId('trend-functions-chart').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectDrawnAtItsWidth(page, 'trend-functions-chart');
    await expectLegibleText(page, 'trend-functions-chart');
    for (const link of await page.getByTestId('trend-scope-section').locator('a.link').all()) {
      await expectTarget(link);
    }
    await expectNoSeriousViolations(page, 'trend by function (phone)');
    await useScenario(request, 'workshop#trend-mixed-models');
    await page.goto(TREND_ADDRESS);
    await expect(page.getByTestId('trend-versions')).toBeVisible();
    await page.getByTestId('trend-versions').scrollIntoViewIfNeeded();
    await page.getByTestId('trend-omitted').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'trend with other versions (phone)');
  });

  test('the comparison fits: the pickers, the pairs and the act are targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, compareAddress(PAIR.scope), 'samm-compare-view');
    await expectTarget(page.getByTestId('compare-scope'));
    await expectTarget(page.getByTestId('compare-from'));
    await expectTarget(page.getByTestId('compare-to'));
    await expectTarget(page.getByTestId('compare-show'));
    await expectTarget(page.getByTestId('compare-pairs').getByRole('link'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'compare pairs (phone)');
  });

  test('the dumbbell fits at 390 px: every row says its scores, the ring and the dot are drawn, and the practices open', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, compareAddress(PAIR.scope, PAIR.from, PAIR.to), 'samm-compare-view');
    await page.getByTestId('compare-chart').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    // The scale of figures stays, above the tracks and over the same stretch, and the rows carry their words as well.
    const ticks = page.getByTestId('compare-chart').locator('.dumbbell__ticks');
    await expect(ticks).toBeVisible();
    const first = await ticks.boundingBox();
    const firstTrack = await page
      .getByTestId('dumbbell-overall')
      .locator('.dumbbell__track')
      .boundingBox();
    expect(Math.abs(first.x - firstTrack.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.width - firstTrack.width)).toBeLessThanOrEqual(1);
    await expectLegibleText(page, 'compare-chart', 12);
    for (const row of PAIR.functions) {
      const line = page.getByTestId(`dumbbell-${row.id}`);
      await expect(line.locator('.dumbbell__values')).toHaveText(`${row.from} to ${row.to}`);
      await expect(line.locator('.dumbbell__change')).toHaveText(row.change);
      // The track holds its ring and its dot, each a visible shape of at least 12 px.
      const track = await line.locator('.dumbbell__track').boundingBox();
      expect(track.width).toBeGreaterThan(100);
      for (const mark of ['.dumbbell__ring--at', '.dumbbell__dot--at']) {
        const box = await line.locator(mark).boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(12);
        expect(box.x).toBeGreaterThanOrEqual(track.x - box.width);
        expect(box.x + box.width).toBeLessThanOrEqual(track.x + track.width + box.width);
      }
    }
    // The legend of the ring and the dot is drawn above the rows and fits.
    await expect(page.getByTestId('compare-chart').locator('.dumbbell__legend')).toBeVisible();
    // The disclosure is a target of the phone size, and the rows of the practices fit when it is open.
    const summary = page.getByTestId('compare-practices-governance').locator('summary');
    await expectTarget(summary);
    await summary.click();
    await expect(page.getByTestId('dumbbell-governance-sm-A')).toBeVisible();
    await page.getByTestId('dumbbell-governance-sm-A').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'compare dumbbell (phone)');
    await expectTarget(page.getByTestId('compare-trend'));
  });

  test('the refused comparison and the missing assessment fit', async ({ page, request }) => {
    await useScenario(request, 'workshop#model-versions-differ');
    await loginToReports(page, compareAddress(PAIR.scope, PAIR.from, PAIR.to), 'samm-compare-view');
    await page.getByTestId('compare-differ').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('compare-differ')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'compare refused (phone)');
    await useScenario(request, 'workshop');
    await page.goto(compareAddress(PAIR.scope, 'nope', PAIR.to));
    await expect(page.getByTestId('compare-missing')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'compare missing (phone)');
  });

  test('the threat evaluation fits: the order is a target, the rows stack, and the reviews that need the person show their words', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, THREATS_ADDRESS, 'threat-evaluation-view');
    await expectTarget(page.getByTestId('threat-evaluation-sort'));
    await expectNoSideways(page);
    await expectStacked(page.getByTestId('threat-evaluation-table'));
    for (const link of await page.getByTestId('threat-evaluation-view').locator('a.link').all()) {
      await expectTarget(link);
    }
    // Every line of a cell stands in the column of its value, a row without a review date included.
    for (const id of ['customer-portal-portal', 'notification-service-notification-flows']) {
      const row = page.getByTestId(`threat-row-${id}`);
      const values = await row
        .locator('td[data-label] > *')
        .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
      expect(new Set(values).size, `${id}: the cells start at one column`).toBe(1);
    }
    await page.getByTestId('threat-status-customer-portal-portal').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('threat-status-customer-portal-portal')).toBeInViewport();
    await expect(page.getByTestId('threat-status-customer-portal-portal')).toHaveText(
      'Overdue by 177 days',
    );
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat evaluation (phone)');
    await useScenario(request, 'release');
    await page.goto(THREATS_ADDRESS);
    await expect(page.getByTestId('threat-forbidden')).toBeVisible();
    await expectNoSideways(page);
  });

  test('the risk register fits: the field, the tags and the act are targets of the phone size, and the table stacks', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, RISKS_ADDRESS, 'risk-register-view');
    await expectTarget(page.getByTestId('risk-asof'));
    await expectTarget(page.getByTestId('risk-tag'));
    await expectTarget(page.getByTestId('risk-show'));
    await expectStacked(page.getByTestId('risk-table'));
    for (const link of await page.getByTestId('risk-table').locator('a.link').all()) {
      await expectTarget(link);
    }
    // The badge and the date of the review stand in the column of the value, not under the label.
    const badge = await page.getByTestId('risk-review-r-007').boundingBox();
    const date = await page.getByTestId('risk-row-r-007').locator('.date').boundingBox();
    expect(Math.abs(badge.x - date.x)).toBeLessThanOrEqual(1);
    await page.getByTestId('risk-review-r-007').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('risk-review-r-007')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'risk register (phone)');
    await page.goto(risksAddress('2026-03-01'));
    await expect(page.getByTestId('risk-earlier-commit')).toBeVisible();
    await expectTarget(page.getByTestId('risk-link-r-004'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'risk register of a day (phone)');
  });

  test('the refusals of the risk register fit, and the way back to the register as it is now is a target', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToReports(page, risksAddress('2027-01-01'), 'risk-register-view');
    await expect(page.getByTestId('risk-refused')).toBeVisible();
    await expect(page.getByTestId('risk-asof')).toHaveValue('2027-01-01');
    await expectTarget(page.getByTestId('risk-now'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'risk register refused (phone)');
    await useScenario(request, 'workshop#risk-register-git-unavailable');
    await page.goto(risksAddress('2026-03-01'));
    await expect(page.getByTestId('risk-git-unavailable')).toBeVisible();
    await page.getByTestId('risk-git-unavailable').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'risk register git unavailable (phone)');
  });

  test('the evaluation of the lens Threat models fits: its rows stack, and the way to a new model is a target', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToThreats(page, LENS_ADDRESS);
    await expect(page.getByTestId('threat-evaluation-table')).toBeVisible();
    await expectStacked(page.getByTestId('threat-evaluation-table'));
    await expectStacked(page.getByTestId('threat-evaluation-without-table'));
    for (const link of await page.getByTestId('evaluation-column').locator('a.link').all()) {
      await expectTarget(link);
    }
    await expectTarget(page.getByTestId('threat-new-report-scheduler'));
    await expect(page.getByTestId('threat-new-report-scheduler')).toBeInViewport();
    await page.getByTestId('threat-status-customer-portal-portal').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('threat-status-customer-portal-portal')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models evaluation (phone)');
    await page.getByTestId('threat-new-report-scheduler').click();
    await expect(page.getByTestId('new-threat-model-sheet')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models new (phone)');
  });

  test('the page of a service fits: a model, the way to a new one and the recipe to continue are targets', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToThreats(page, serviceAddress('payment-api'));
    await expect(page.getByTestId('model-checkout-flow')).toBeVisible();
    await expectTarget(page.getByTestId('model-checkout-flow'));
    await expectTarget(page.getByTestId('new-threat-model-link'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models service (phone)');
    await useScenario(request, 'workshop#recipe-draft-saved');
    await page.goto(serviceAddress('report-scheduler'));
    await expect(page.getByTestId('continue-quick-start')).toBeVisible();
    await expectTarget(page.getByTestId('continue-quick-start'));
    await expectTarget(page.getByTestId('new-threat-model-link'));
    await expectNoSideways(page);
    await useScenario(request, 'workshop');
    await page.goto(serviceAddress('ledger'));
    await expect(page.getByTestId('service-retired')).toBeVisible();
    await expectNoSideways(page);
  });

  test('the sheet of a model fits: the diagram scrolls in its own region, the tables stack and the acts are targets', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page);
    await expectNoSideways(page);
    // The diagram keeps the size of its image so that its text stays readable; the region that scrolls it fits the
    // screen, can be reached by keyboard and says that it scrolls. The page itself does not scroll sideways.
    const image = page.getByTestId('diagram-image');
    await image.scrollIntoViewIfNeeded();
    const region = page.getByRole('group', { name: 'Diagram' });
    const regionBox = await region.boundingBox();
    expect(regionBox.width).toBeLessThanOrEqual(390);
    expect(regionBox.width).toBeGreaterThan(200);
    expect((await image.boundingBox()).width).toBeGreaterThan(regionBox.width);
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(page.getByTestId('diagram-scrolls')).toBeVisible();
    await expectStacked(page.getByTestId('threats-table'));
    await expectStacked(page.getByTestId('mitigations-table'));
    await expectTarget(page.getByTestId('start-review'));
    await expectTarget(page.getByTestId('save-everyone'));
    await expectTarget(page.getByTestId('threat-status-T-01'));
    await expectTarget(page.getByRole('button', { name: 'Edit T-01', exact: true }));
    await expectTarget(page.getByRole('button', { name: 'Remove T-01', exact: true }));
    await expectTarget(page.getByRole('button', { name: 'Add a threat' }));
    await expectTarget(page.getByRole('button', { name: 'Edit M-03', exact: true }));
    await expectTarget(page.getByRole('button', { name: 'Add a countermeasure' }));
    await expectTarget(page.getByTestId('threat-transferred-T-07').getByRole('link'));
    await expectTarget(page.getByTestId('revision-select'));
    // A row of the threats is stacked: its cells stand under each other, each with its label.
    const row = page.getByTestId('threats-table').locator('tbody tr').first();
    const cells = await row
      .locator('td')
      .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
    expect(new Set(cells).size, 'the cells of a threat start at one column').toBe(1);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat model sheet (phone)');
  });

  test('the dialogs of a threat and of a countermeasure are in the viewport with targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToSheet(page);
    await editThreat(page, 'T-02');
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectTarget(page.getByTestId('threats-field-name'));
    await expectTarget(page.getByTestId('threats-field-likelihood'));
    await expectTarget(page.getByTestId('threats-field-status'));
    await expectTarget(page.getByTestId('threats-category-tampering'));
    await expectTarget(page.getByTestId('threats-apply'));
    await expectTarget(page.getByTestId('threats-cancel'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat dialog (phone)');
    await page.getByTestId('threats-cancel').click();
    await page.getByRole('button', { name: 'Remove T-03', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expect(page.getByTestId('threats-remove-treatments')).toBeVisible();
    await expectTarget(page.getByTestId('threats-remove-confirm'));
    await expectTarget(page.getByTestId('threats-remove-cancel'));
    await expectNoSeriousViolations(page, 'threat removal question (phone)');
    await page.getByTestId('threats-remove-cancel').click();
    await page.getByRole('button', { name: 'Edit M-03', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectTarget(page.getByTestId('mitigations-field-threat'));
    await expectTarget(page.getByTestId('mitigations-field-issues'));
    await expectTarget(page.getByTestId('mitigations-apply'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'countermeasure dialog (phone)');
  });

  test('a conflict, the errors of rows and a refusal of the Git server fit, and each act is a target', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#threat-model-saved-by-other');
    await loginToSheet(page);
    await page.getByTestId('threat-status-T-01').selectOption({ label: 'Mitigated' });
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('conflict-panel')).toBeVisible();
    await page.getByTestId('conflict-panel').scrollIntoViewIfNeeded();
    await expectTarget(page.getByTestId('keep-own-/threats'));
    await expectTarget(page.getByTestId('take-other-/threats'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat model conflict (phone)');
    await useScenario(request, 'workshop#threat-model-invalid');
    await page.goto(CHECKOUT.address);
    await expect(page.getByTestId('threats-table')).toBeVisible();
    await page.getByTestId('threat-status-T-01').selectOption({ label: 'Mitigated' });
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('threats-errors')).toBeVisible();
    await page.getByTestId('threats-errors').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('threats-errors')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat model errors (phone)');
    await useScenario(request, 'workshop#threat-model-git-unavailable');
    await page.goto(CHECKOUT.address);
    await page.getByTestId('threat-status-T-01').selectOption({ label: 'Mitigated' });
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('failure-notice')).toBeVisible();
    await expectNoSideways(page);
  });

  test('a model that is read only and an earlier state of it fit, without a control to change them', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToSheet(page);
    await expect(page.getByTestId('save-everyone')).toHaveCount(0);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat model read only (phone)');
    await useScenario(request, 'workshop');
    await page.goto(`${CHECKOUT.address}?at=v2`);
    await expect(page.getByTestId('revision-notice')).toBeVisible();
    await expectStacked(page.getByTestId('threats-table'));
    await expectNoSideways(page);
  });

  test('the release of a threat model fits: the changes are readable, the groups are targets and the act is in reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#threat-model-in-review');
    await page.goto(
      `/api/v1/auth/login?return=${encodeURIComponent(releaseAddress(CHECKOUT.service, CHECKOUT.model))}`,
    );
    await expect(page.getByTestId('release-view')).toBeVisible();
    await expect(page.getByTestId('release-record')).toBeVisible();
    await expectNoSideways(page);
    // The summary of each group of the record is a target of the phone size.
    // The groups are read from the record, so a group the release gains is checked too; the three of this state must be there.
    const summaries = page.getByTestId('release-record').locator('summary');
    expect(await summaries.count()).toBeGreaterThanOrEqual(3);
    for (const group of [
      'record-data:last-review',
      'record-model:threats',
      'record-model:mitigations',
    ]) {
      await expect(page.getByTestId(group)).toBeVisible();
    }
    for (const summary of await summaries.all()) await expectTarget(summary);
    await page.getByTestId('release-act').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('release-act')).toBeInViewport();
    await expectTarget(page.getByTestId('release-act'));
    await expectTarget(page.getByTestId('release-back'));
    await expectNoSeriousViolations(page, 'threat model release (phone)');
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toBeVisible();
    await expect(page.getByTestId('release-seal')).toBeVisible();
    await expectTarget(page.getByTestId('release-open'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat model released (phone)');
  });

  test('the choice of a recipe fits: each recipe is a row and its act is a target, also for one that was started', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToChoice(page);
    await expectNoSideways(page);
    for (const recipe of ['quick-start', 'stride']) {
      await expect(page.getByTestId(`recipe-${recipe}`)).toBeInViewport({ ratio: 0.1 });
      await expectTarget(page.getByTestId(`recipe-open-${recipe}`));
    }
    await expectNoSeriousViolations(page, 'threat models recipe choice (phone)');
    await useScenario(request, 'workshop#recipe-draft-saved');
    await page.goto(newAddress('report-scheduler'));
    await expect(page.getByTestId('recipe-started-quick-start')).toBeVisible();
    await expectTarget(page.getByTestId('recipe-open-quick-start'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models recipe started (phone)');
  });

  test('the refusals of the wizard fit: no right, a retired service, a recipe that does not exist, no recipe', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToThreats(page, newAddress('report-scheduler', 'quick-start'));
    await expect(page.getByTestId('new-threat-model-no-right')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models wizard without a right (phone)');
    await useScenario(request, 'workshop');
    await page.goto(newAddress('ledger'));
    await expect(page.getByTestId('new-threat-model-retired')).toBeVisible();
    await expectNoSideways(page);
    await page.goto(newAddress('report-scheduler', 'nope'));
    await expect(page.getByTestId('recipe-missing')).toBeVisible();
    await expectTarget(page.getByTestId('recipe-choose'));
    await expectNoSideways(page);
    await useScenario(request, 'workshop#threat-model-recipes-none');
    await page.goto(newAddress('report-scheduler'));
    await expect(page.getByTestId('new-threat-model-sheet')).toContainText(
      'No recipe is available',
    );
    await expectNoSideways(page);
  });

  test('a step fits: the list of the steps gives way to the count, the form and the acts are targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToWizard(page);
    await expectNoSideways(page);
    // On a phone only the step the person is on and its count stay: the list never takes the room of the form.
    await expect(page.getByTestId('recipe-stepper-count')).toBeVisible();
    await expect(page.getByTestId('recipe-stepper-count')).toHaveText('Step 1 of 5');
    await expect(page.getByTestId('recipe-stepper-1')).toBeHidden();
    await expect(page.getByTestId('recipe-stepper-4')).toBeHidden();
    await expectTarget(stepField(page, 'Name'));
    await expectTarget(stepField(page, 'Description'));
    await fillName(page);
    await expectTarget(page.getByTestId('step-next'));
    await expect(page.getByTestId('save-state')).toBeVisible();
    await expectNoSeriousViolations(page, 'threat models wizard first step (phone)');
    await page.getByTestId('step-next').click();
    await expect(stepHeading(page)).toHaveText('Trust zones');
    await expect(page.getByTestId('recipe-stepper-count')).toHaveText('Step 2 of 5');
    await expectTarget(page.getByTestId('step-back'));
    await expectTarget(page.getByTestId('step-next'));
    await expectTarget(page.getByRole('button', { name: 'Add row' }));
    await expectNoSideways(page);
  });

  test('the dialogs of a row, of a threat and of a countermeasure of the wizard are in the viewport with targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToWizard(page, 'stride');
    await fillName(page);
    await goOn(page, 'Trust zones');
    await addRow(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeInViewport();
    await expectTarget(dialog.getByRole('textbox', { name: /^Id/ }));
    await expectTarget(dialog.getByRole('textbox', { name: /^Name/ }));
    await expectTarget(dialog.getByRole('spinbutton'));
    await expectTarget(dialog.getByRole('button', { name: 'Add to the list' }));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models wizard row dialog (phone)');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await addZone(page);
    // The table of the rows is a list of stacked rows with its acts as targets.
    await expectStacked(page.getByRole('table', { name: 'Trust zones' }));
    await expectTarget(page.getByRole('button', { name: 'Edit row 1' }));
    await expectTarget(page.getByRole('button', { name: 'Remove row 1' }));
    await goOn(page, 'Components');
    await goOn(page, 'Data flows');
    await goOn(page, 'Threats (STRIDE)');
    await expectTarget(page.getByRole('button', { name: 'Add a threat' }));
    await page.getByRole('button', { name: 'Add a threat' }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectTarget(page.getByTestId('wizard-threats-field-name'));
    await expectTarget(page.getByTestId('wizard-threats-field-likelihood'));
    await expectTarget(page.getByTestId('wizard-threats-category-tampering'));
    await expectTarget(page.getByTestId('wizard-threats-apply'));
    await expectTarget(page.getByTestId('wizard-threats-cancel'));
    await expectNoSeriousViolations(page, 'threat models wizard threat dialog (phone)');
    await page.getByTestId('wizard-threats-cancel').click();
    await addThreat(page);
    await expectStacked(page.getByTestId('wizard-threats-table'));
    await expectTarget(page.getByTestId('threat-status-T-01'));
    await expectTarget(page.getByRole('button', { name: 'Edit T-01', exact: true }));
    await expectNoSideways(page);
    await goOn(page, 'Countermeasures');
    await expectTarget(page.getByRole('button', { name: 'Add a countermeasure' }));
    await page.getByRole('button', { name: 'Add a countermeasure' }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectTarget(page.getByTestId('wizard-mitigations-field-threat'));
    await expectTarget(page.getByTestId('wizard-mitigations-field-issues'));
    await expectTarget(page.getByTestId('wizard-mitigations-apply'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models wizard countermeasure dialog (phone)');
  });

  test('the last page fits: the summary rows and their acts, the owner, the review date and the create are targets in reach', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToWizard(page);
    await walkQuickStart(page);
    await expectNoSideways(page);
    for (const step of ['project', 'zones', 'components', 'threats']) {
      await expect(page.getByTestId(`summary-${step}`)).toBeVisible();
      await expectTarget(page.getByTestId(`summary-change-${step}`));
    }
    const data = page.getByTestId('review-data');
    await expectTarget(data.getByRole('combobox', { name: /^Owner/ }));
    await expectTarget(data.getByLabel(/^Review date/));
    await expectTarget(page.getByTestId('create-model'));
    await expect(page.getByTestId('create-model')).toBeInViewport();
    await expectTarget(page.getByTestId('step-back'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models wizard last page (phone)');
    await page.getByTestId('create-model').click();
    await expect(page).toHaveURL(`/threat-models/report-scheduler/scheduler-overview`);
    await expect(page.getByTestId('threat-model-sheet')).toBeVisible();
    await expectNoSideways(page);
  });

  test('the reason a model cannot be created, the refusals of a create and the questions of the wizard fit', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToWizard(page);
    await goOn(page, 'Trust zones');
    await goOn(page, 'Components');
    await goOn(page, 'Threats');
    await goOn(page, 'Review and create');
    await expect(
      page.getByText('The model needs a name. You give it in the step "The frame".'),
    ).toBeVisible();
    await expect(page.getByTestId('create-model')).toBeInViewport();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models wizard without a name (phone)');

    await useScenario(request, 'workshop#threat-model-create-invalid');
    await loginToWizard(page);
    await walkEmpty(page);
    await page.getByTestId('create-model').click();
    await expect(stepHeading(page)).toHaveText('The frame');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
    await expect(stepField(page, 'Name')).toHaveAttribute('aria-invalid', 'true');
    await stepField(page, 'Name').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models wizard create refused (phone)');

    await useScenario(request, 'workshop#threat-model-git-unavailable');
    await loginToWizard(page);
    await walkEmpty(page);
    await page.getByTestId('create-model').click();
    await expect(page.getByTestId('new-threat-model-sheet').getByRole('alert')).toBeVisible();
    await expectTarget(page.getByTestId('create-model'));
    await expectNoSideways(page);

    // The question before a page with what is kept nowhere is left, and the question for the password.
    await useScenario(request, 'workshop#note-release-password');
    await loginToWizard(page);
    await fillName(page);
    await page.getByTestId('bottom-more').click();
    await page.getByRole('dialog').getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog')).toContainText('Leave this page?');
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectTarget(page.getByTestId('leave-stay'));
    await expectTarget(page.getByTestId('leave-confirm'));
    await expectNoSeriousViolations(page, 'threat models wizard leave question (phone)');
    await page.getByTestId('leave-stay').click();
    await goOn(page, 'Trust zones');
    await goOn(page, 'Components');
    await goOn(page, 'Threats');
    await goOn(page, 'Review and create');
    await routeCreate(page, (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ outcome: 'STEP_UP_REQUIRED' }),
      }),
    );
    await page.getByTestId('create-model').click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectTarget(page.getByTestId('create-password'));
    await expectTarget(page.getByTestId('create-confirm'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'threat models wizard password question (phone)');
  });
  test('the years and the incidents of a year fit: every row is a target, the stages are a list and nothing scrolls sideways', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIncidents(page, '/incidents');
    await expect(page.getByTestId('year-list')).toBeVisible();
    await expectTarget(page.getByTestId('year-2026'));
    await expectTarget(page.getByTestId('year-2025'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incidents years (phone)');
    await page.getByTestId('year-2026').click();
    await expect(page.getByTestId('incident-list')).toBeVisible();
    await expectTarget(page.getByTestId('new-incident-link'));
    for (const row of await page.getByTestId('incident-list').locator('> li > a').all()) {
      await expectTarget(row);
      // The row does not grow wider than the screen: the five stages and the deadlines wrap.
      const box = await row.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    }
    await expect(page.getByTestId(`incident-${CARD_DATA.id}`)).toContainText('2 deadlines missed');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incidents year (phone)');
  });

  test('the sheet of an incident fits: the stages are rows of the phone size, the clock fits, and the acts are targets', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIncident(page, CARD_DATA, 'privacy-assessment');
    await expectNoSideways(page);
    // The tabs are a list of full-width rows, each a target, with its status in words.
    const tabs = page.getByTestId('stage-tabs');
    await tabs.scrollIntoViewIfNeeded();
    const list = await tabs.boundingBox();
    for (const stage of STAGES) {
      const tab = page.getByTestId(`stage-tabs-${stage}`);
      await expectTarget(tab);
      const box = await tab.boundingBox();
      expect(box.width).toBeGreaterThan(list.width - 2);
    }
    // The clock: every deadline stands inside the screen with its state in words, whatever the length of its basis.
    const clock = page.getByTestId('deadline-clock');
    await clock.scrollIntoViewIfNeeded();
    for (const row of await clock.locator('li').all()) {
      const box = await row.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    }
    await expect(page.getByTestId('deadline-clock-gdpr-art33-')).toContainText('Missed');
    await expectTarget(page.getByTestId('stage-complete'));
    await expectTarget(page.getByTestId('save-everyone'));
    await expectTarget(page.getByTestId('report-toggle'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident sheet (phone)');
    // The stages that do not apply and the marker fit as rows as well.
    await loginToIncident(page, WRONG_RECIPIENT, 'response');
    for (const stage of STAGES) await expectTarget(page.getByTestId(`stage-tabs-${stage}`));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident stages with a marker (phone)');
    await loginToIncident(page, SUSPICIOUS, 'triage');
    await expectNoSideways(page);
    await loginToIncident(page, CREDENTIAL_STUFFING, 'privacy-assessment');
    await expect(page.getByTestId('stage-not-applicable')).toBeVisible();
    await expectNoSideways(page);
  });

  test('the notices are stacked rows, the form to record one fits, and the clock without a date fits', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIncident(page, CARD_DATA, 'notifications');
    await expect(page.getByTestId('notifications-table')).toBeVisible();
    await expectStacked(page.getByTestId('notifications-table'));
    for (const row of await page.getByTestId('notifications-table').locator('tbody tr').all()) {
      const box = await row.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    }
    await expect(page.getByTestId('notification-nis2-notification')).toContainText('Sent late');
    const authority = field(page.getByTestId('stage-form'), '/supervisory-authority');
    await expectTarget(authority.getByLabel('Sent at'));
    await expectTarget(authority.getByLabel('Recipient'));
    await expectTarget(authority.getByLabel('Channel'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident notices (phone)');
    await loginToIncident(page, ARCHIVE, 'notifications');
    await expectStacked(page.getByTestId('notifications-table'));
    await expect(
      page.getByTestId('deadline-clock-nis2-final-report-after-handling-'),
    ).toContainText('The clock starts when');
    await expectNoSideways(page);
  });

  test('the refusal of a stage fits: each missing field and the way back are targets, and the open stages are links', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIncident(page, SUSPICIOUS, 'triage');
    await page.getByTestId('stage-complete').click();
    await expect(page.getByTestId('missing-fields')).toBeVisible();
    await page.getByTestId('stage-refusal').scrollIntoViewIfNeeded();
    // The three open questions of the triage: a layout that hid them would leave nothing to measure.
    await expect(page.getByTestId('missing-fields').getByRole('button')).toHaveCount(3);
    for (const button of await page.getByTestId('missing-fields').getByRole('button').all()) {
      await expectTarget(button);
    }
    await expectTarget(page.getByTestId('back-to-editing'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident refusal (phone)');
    await patchRead(page, `**${readPath(SUSPICIOUS)}`, (body) => ({
      ...body,
      stages: body.stages.map((stage) =>
        stage.id === 'response' ? { ...stage, blockedBy: [] } : stage,
      ),
    }));
    await page.goto(incidentAddress(SUSPICIOUS, { stage: 'response' }));
    await page.getByTestId('stage-complete').click();
    await expect(page.getByTestId('stage-open-before')).toBeVisible();
    await expectTarget(page.getByTestId('stage-open-before').getByRole('link'));
    await expectNoSideways(page);
    // A stage that waits for another says why, inside the screen.
    await page.goto(incidentAddress(CARD_DATA, { stage: 'review' }));
    await page.getByTestId('stage-bar').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('stage-bar')).toContainText('Complete Response first.');
    await expectNoSideways(page);
  });

  test('the question to save first, the question for the password and the conflict are in the viewport with targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#incident-review-stepped-up');
    await patchRead(page, '**/api/v1/status', (body) => ({
      ...body,
      loginProvider: 'local',
      stepUp: 'password',
    }));
    await loginToIncident(page, CREDENTIAL_STUFFING, 'review');
    await expect(page.getByTestId('stage-step-up-note')).toBeVisible();
    await page.getByTestId('stage-complete').click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await expectTarget(page.getByTestId('document-password'));
    await expectTarget(page.getByTestId('document-confirm'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident password question (phone)');
    await page.keyboard.press('Escape');
    await useScenario(request, 'workshop');
    await page.goto(incidentAddress(CARD_DATA, { stage: 'privacy-assessment' }));
    await field(page.getByTestId('stage-form'), '/risk')
      .getByRole('combobox')
      .selectOption({ label: 'Risk' });
    await page.getByTestId('stage-complete').click();
    await expect(page.getByTestId('stage-save-first')).toBeVisible();
    await expectTarget(page.getByTestId('stage-save-first'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident save first (phone)');
    await useScenario(request, 'workshop#incident-saved-by-other');
    await page.goto(incidentAddress(CARD_DATA, { stage: 'notifications' }));
    const authority = field(page.getByTestId('stage-form'), '/supervisory-authority');
    await authority.getByLabel('Sent at').fill('2026-11-26T10:45');
    await authority.getByLabel('Recipient').fill('State data protection authority');
    await authority.getByLabel('Channel').selectOption({ label: 'Reporting portal' });
    await page.getByTestId('save-everyone').click();
    await expect(page.getByTestId('conflict-panel')).toBeVisible();
    await page.getByTestId('conflict-panel').scrollIntoViewIfNeeded();
    await expectTarget(page.getByTestId('keep-own-/supervisory-authority'));
    await expectTarget(page.getByTestId('take-other-/supervisory-authority'));
    await expect(page.getByTestId('stage-tabs-notifications')).toContainText('Conflict');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident conflict (phone)');
  });

  test('the report preview, the submit with its reason and the release step fit', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIncident(page, CARD_DATA);
    const submit = page.getByTestId('transition-incident.submit');
    await submit.scrollIntoViewIfNeeded();
    await expectTarget(submit);
    await expect(page.getByTestId('transition-bar')).toContainText('Complete these stages first');
    await expectNoSideways(page);
    await page.getByTestId('report-toggle').click();
    await expect(page.getByTestId('report-section')).toHaveCount(8);
    await page.getByTestId('report-preview').scrollIntoViewIfNeeded();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident report (phone)');
    await useScenario(request, 'workshop#incident-submitted');
    await page.goto(incidentAddress(CREDENTIAL_STUFFING));
    const release = page.getByTestId('transition-incident.release');
    await release.scrollIntoViewIfNeeded();
    await expectTarget(release);
    await expectNoSideways(page);
  });

  test('a released incident, an earlier state of it and a person who may only read fit, without a control to change them', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIncident(page, OUTAGE, 'notifications');
    await expect(page.getByTestId('clock-stopped')).toBeVisible();
    await expectStacked(page.getByTestId('notifications-table'));
    await expect(page.getByTestId('save-everyone')).toHaveCount(0);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident released (phone)');
    await page.goto(incidentAddress(OUTAGE, { at: 'v1' }));
    await expect(page.getByTestId('revision-notice')).toBeVisible();
    await expectTarget(page.getByTestId('revision-back'));
    await expectNoSideways(page);
    await useScenario(request, 'read-only');
    await page.goto(incidentAddress(CARD_DATA));
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'read-only');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident read only (phone)');
  });

  /** Fails when a box is not wholly inside the screen of 390 px. */
  async function expectInsideScreen(locator) {
    const box = await locator.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
  }

  /** Fails when a dialog is not wholly inside the viewport, so that its acts are reachable without a scroll of the page. */
  async function expectDialogFits(dialog) {
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    expect(box.y + box.height).toBeLessThanOrEqual(844.5);
  }

  test('the release of an incident fits: the record is in groups of the phone size, and the act and the way back are targets', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#incident-submitted');
    await loginToRelease(page, CREDENTIAL_STUFFING);
    await expectNoSideways(page);
    await expect(page.getByTestId('release-facts')).toBeVisible();
    await expectInsideScreen(page.getByTestId('release-facts'));
    for (const group of ['data', 'triage', 'response', 'review']) {
      await page.getByTestId(`record-${group}`).scrollIntoViewIfNeeded();
      await expectInsideScreen(page.getByTestId(`record-${group}`));
    }
    await expectTarget(page.getByTestId('release-act'));
    await expectTarget(page.getByTestId('release-back'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident release (phone)');
  });

  test('the release of an incident with deadlines still open fits: every deadline stands inside the screen, and the way to the notices is a target', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#incident-submitted');
    // The mock has no incident in review with a deadline still open: the read is patched.
    await withOpenDeadlines(page, CREDENTIAL_STUFFING);
    await loginToRelease(page, CREDENTIAL_STUFFING);
    const open = page.getByTestId('release-deadlines');
    await open.scrollIntoViewIfNeeded();
    for (const row of await open.locator('li').all()) await expectInsideScreen(row);
    await expect(page.getByTestId('release-deadlines-gdpr-art33-')).toContainText('Overdue by');
    await expectTarget(page.getByTestId('release-record-notice'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident release, deadlines open (phone)');
    await expectTarget(page.getByTestId('release-act'));
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toBeVisible();
    await expect(page.getByTestId('release-seal')).toBeVisible();
    await page.getByTestId('release-clock-stopped').scrollIntoViewIfNeeded();
    await expectInsideScreen(page.getByTestId('release-clock-stopped'));
    await expectTarget(page.getByTestId('release-open'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident released, clock stopped (phone)');
  });

  test('the refusal of a release because a stage is open fits, and its links are targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#incident-release-stages-open');
    await loginToRelease(page, CREDENTIAL_STUFFING);
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-refusal')).toBeVisible();
    await page.getByTestId('release-refusal').scrollIntoViewIfNeeded();
    await expectInsideScreen(page.getByTestId('release-refusal'));
    await expectTarget(page.getByTestId('release-refusal-review'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident release refused (phone)');
  });

  test('the release of an incident that cannot be taken, and the confirmation of it, fit', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToRelease(page, CREDENTIAL_STUFFING);
    await expect(page.getByText('Releasing needs the approve right.')).toBeVisible();
    await expectTarget(page.getByTestId('release-act'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident release, no right (phone)');
    await useScenario(request, 'workshop#incident-release-stepped-up');
    await patchRead(page, '**/api/v1/status', (body) => ({
      ...body,
      loginProvider: 'local',
      stepUp: 'password',
    }));
    await page.reload();
    await expect(page.getByTestId('release-record')).toBeVisible();
    await expectTarget(page.getByTestId('release-act'));
    await page.getByTestId('release-act').click();
    await expectDialogFits(page.getByRole('dialog'));
    await expectTarget(page.getByTestId('release-password'));
    await expectTarget(page.getByTestId('release-confirm'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'incident release password question (phone)');
  });

  test('the form of a new incident fits: the fields and the act are targets, and the reason of the act stands inside the screen', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToNew(page);
    const sheet = page.getByTestId('new-incident-sheet');
    await expectInsideScreen(sheet);
    await expectTarget(sheet.getByLabel('Title'));
    await expectTarget(sheet.getByLabel('Became aware at'));
    await expectTarget(page.getByTestId('create-incident'));
    await expect(sheet).toContainText('Enter a title first.');
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new incident (phone)');
    await sheet.getByLabel('Title').fill('Suspicious logins from the VPN gateway');
    await expectTarget(page.getByTestId('create-incident'));
    // The question before the form is left, and the question for the password of a create, stand inside the screen.
    await page.getByTestId('bottom-more').click();
    await page.getByRole('dialog').getByRole('link', { name: 'Settings' }).click();
    await expectDialogFits(page.getByRole('dialog'));
    await expectTarget(page.getByTestId('leave-stay'));
    await expectTarget(page.getByTestId('leave-confirm'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new incident leave question (phone)');
    await page.getByTestId('leave-stay').click();
    await expect(page).toHaveURL(newIncidentAddress(2026));
  });

  test('the refusals of a new incident fit, and so does the question for the password of a create', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop#incident-create-invalid');
    await loginToNew(page);
    const sheet = page.getByTestId('new-incident-sheet');
    await sheet.getByLabel('Title').fill('A title');
    await page.getByTestId('create-incident').click();
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
    await expectInsideScreen(page.getByTestId('save-state'));
    await expectInsideScreen(sheet.locator('[data-pointer="/title"]'));
    await expectTarget(page.getByTestId('create-incident'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new incident refused (phone)');
    await useScenario(request, 'workshop');
    await patchRead(page, '**/api/v1/status', (body) => ({
      ...body,
      loginProvider: 'local',
      stepUp: 'password',
    }));
    // The mock has no state that asks a local user for the password on a create: the create is answered here.
    await page.route(`**${createPath(2026)}`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 403, json: { outcome: 'STEP_UP_REQUIRED' } })
        : route.continue(),
    );
    await page.goto(newIncidentAddress(2026));
    await sheet.getByLabel('Title').fill('A title');
    await page.getByTestId('create-incident').click();
    await expectDialogFits(page.getByRole('dialog'));
    await expectTarget(page.getByTestId('create-password'));
    await expectTarget(page.getByTestId('create-confirm'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new incident password question (phone)');
  });

  test('the form of a new incident of a person who may only read fits, and its way back is a target', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'read-only');
    await loginToIncidents(page, newIncidentAddress(2026));
    await expect(page.getByTestId('new-incident-blocked')).toBeVisible();
    await expectInsideScreen(page.getByTestId('new-incident-blocked'));
    await expectTarget(page.getByTestId('new-incident-back'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'new incident blocked (phone)');
  });

  test('the deadlines in the Due list fit, and their links are targets of the phone size', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await pinClock(page);
    await page.goto('/api/v1/auth/login?return=%2F');
    await expect(page.getByTestId('due-list')).toBeVisible();
    const link = page.getByTestId('due-list').getByRole('link', { name: /Phishing mail/ });
    await expectTarget(link);
    await expect(page.getByTestId('due-list')).toContainText(PHISHING.title);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'due deadlines (phone)');
  });
  test('the types and the documents of the ISMS fit: every row is a target and nothing scrolls sideways', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, '/isms');
    await expect(page.getByTestId('type-list')).toBeVisible();
    await expectTarget(page.getByTestId('type-all'));
    for (const kind of ISMS_KINDS) await expectTarget(page.getByTestId(`type-${kind.id}`));
    await expectTarget(page.getByTestId('register-link'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms types (phone)');
    await page.getByTestId('type-policy').click();
    await expect(page.getByTestId('document-list')).toBeVisible();
    await expectTarget(page.getByTestId('new-document'));
    for (const row of await page.getByTestId('document-list').locator('> li > a').all()) {
      await expectTarget(row);
      await expectInsideScreen(row);
    }
    expect(await ismsListedIds(page)).toHaveLength(3);
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms documents (phone)');
    await page.goto(ismsDocumentsAddress());
    await expect(page.getByTestId('document-list')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms every document (phone)');
  });

  test('the sheet of an ISMS document fits: the save and the way to compare are reachable', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsmsSheet(page, SCOPE);
    await expect(page.getByTestId('save-everyone')).toBeAttached();
    await expectNoSideways(page);
    await expect(page.getByTestId('document-sheet')).toContainText('6 days overdue');
    await expectTarget(page.getByTestId('compare-link'));
    await expectInsideScreen(page.getByTestId('compare-link'));
    await expectNoSeriousViolations(page, 'isms sheet (phone)');
    await page.goto(ismsDocumentAddress(POLICY, 'v1'));
    await expect(page.getByTestId('revision-notice')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms earlier state (phone)');
  });

  test('the ISMS comparison fits: the pickers and the act are targets, the pairs are links of the phone size and the changes stay inside the screen', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsmsCompare(page, POLICY);
    await expectTarget(page.getByTestId('compare-from'));
    await expectTarget(page.getByTestId('compare-to'));
    await expectTarget(page.getByTestId('compare-show'));
    for (const link of await page.getByTestId('compare-pairs').getByRole('link').all()) {
      await expectTarget(link);
      await expectInsideScreen(link);
    }
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms compare pairs (phone)');
    await page.getByTestId('compare-pairs').getByRole('link').first().click();
    await expect(page.getByTestId('compare-record')).toBeVisible();
    await expectInsideScreen(page.getByTestId('compare-record'));
    for (const group of await page.getByTestId('compare-record').locator('summary').all()) {
      await expectInsideScreen(group);
    }
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms compare result (phone)');
    await page.goto(ismsCompareAddress(POLICY, 'v1', 'v1'));
    await expect(page.getByTestId('compare-same')).toBeVisible();
    await expectInsideScreen(page.getByTestId('compare-same'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms compare same (phone)');
    await page.goto(ismsCompareAddress(AUDIT_2025));
    await expect(page.getByTestId('compare-too-few')).toBeVisible();
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms compare too few (phone)');
  });

  test('the release of an ISMS document fits: the record is in groups, and the act and the way back are targets', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsmsRelease(page, SECURE_DEVELOPMENT);
    await expectTarget(page.getByTestId('release-act'));
    await expectTarget(page.getByTestId('release-back'));
    await expectInsideScreen(page.getByTestId('release-record'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms release (phone)');
    await page.getByTestId('release-act').click();
    await expect(page.getByTestId('release-done')).toBeVisible();
    await expectTarget(page.getByTestId('release-open'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms release done (phone)');
  });

  test('the form of a new ISMS document and the choice of its type fit, and the choices are targets', async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await loginToIsms(page, ismsNewAddress());
    await expect(page.getByTestId('new-document-choice')).toBeVisible();
    for (const kind of ISMS_KINDS) await expectTarget(page.getByTestId(`choose-${kind.id}`));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms new document choice (phone)');
    await page.getByTestId('choose-policy').click();
    await expect(page.getByTestId('new-document-sheet')).toBeVisible();
    await expectTarget(page.getByTestId('save-everyone'));
    await expectInsideScreen(page.getByTestId('new-document-sheet'));
    await expectNoSideways(page);
    await expectNoSeriousViolations(page, 'isms new document (phone)');
  });
});
