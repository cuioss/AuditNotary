import { expect, test } from '@playwright/test';
import { expectNoSeriousViolations, useTheme } from './helpers/a11y.js';
import { expectScenario, gotoState, useScenario } from './helpers/mock.js';
import { login, loginLocal } from './helpers/login.js';
import { NOTES, field, noteAddress } from './helpers/documents.js';
import {
  CANDIDATES,
  DESCRIPTOR,
  IMPORT_ADDRESS,
  PERSONS_ADDRESS,
  PROFILE_ADDRESS,
  WELCOME_ADDRESS,
  fillPerson,
  pasteDescriptor,
} from './helpers/directory.js';
import {
  catalogAddress,
  entryAddress,
  fillNewService,
  newEntryAddress,
} from './helpers/catalogs.js';
import {
  NEW_SCOPE_ADDRESS,
  OPEN,
  RELEASED,
  assessmentAddress,
  choose,
  fillNewAssessment,
  newAssessmentAddress,
  patchRead,
  trendPath,
} from './helpers/samm.js';
import {
  PAIR,
  REPORTS_ADDRESS,
  RISKS_ADDRESS,
  RISKS_PATH,
  SUMMARY_PATH,
  THREATS_ADDRESS,
  TREND_ADDRESS,
  TREND_PATH,
  compareAddress,
  risksAddress,
  trendAddress,
} from './helpers/reports.js';

import {
  CHECKOUT,
  LENS_ADDRESS,
  editThreat,
  newAddress,
  releaseAddress,
  serviceAddress,
} from './helpers/threats.js';
import {
  ARCHIVE,
  CARD_DATA,
  CREDENTIAL_STUFFING,
  OUTAGE,
  PHISHING,
  SUSPICIOUS,
  WRONG_RECIPIENT,
  incidentAddress,
  createPath,
  newIncidentAddress,
  pinClock,
  readPath,
  releaseAddress as incidentReleaseAddress,
  withOpenDeadlines,
  yearAddress,
  yearPath,
} from './helpers/incidents.js';
import {
  ACCESS_POLICY,
  AUDIT_2025,
  AUDIT_2026,
  KINDS as ISMS_KINDS,
  POLICY,
  SCOPE,
  SECURE_DEVELOPMENT,
  compareAddress as ismsCompareAddress,
  diffPath as ismsDiffPath,
  documentAddress as ismsDocumentAddress,
  documentsAddress as ismsDocumentsAddress,
  newAddress as ismsNewAddress,
  releaseAddress as ismsReleaseAddress,
} from './helpers/isms.js';
import {
  addRow,
  addThreat,
  fillName,
  goOn,
  routeCreate,
  stepField,
  stepHeading,
  walkEmpty,
} from './helpers/wizard.js';

/**
 * AUN-WEB-2: axe-core on every view in both themes; no violation of impact serious or critical.
 */
const VIEWS = [
  ['workshop', '/', 'due-view'],
  ['empty', '/', 'due-view'],
  ['workshop', '/samm', 'samm-overview'],
  ['workshop', '/samm/payments', 'scope-sheet'],
  ['workshop', '/samm/payments/2026-q4', 'assessment-sheet'],
  ['workshop', '/samm/payments/2026-q4/sm', 'practice-sheet'],
  ['read-only', '/samm/payments/2026-q4/sm', 'practice-sheet'],
  ['release', '/samm/payments/2026-q4/release', 'release-view'],
  ['workshop', '/threat-models', 'threat-evaluation-table'],
  ['release', '/threat-models', 'threat-forbidden'],
  ['workshop', '/threat-models/payment-api', 'model-list'],
  ['workshop', '/threat-models/report-scheduler/new', 'new-threat-model-sheet'],
  ['workshop', '/threat-models/payment-api/checkout-flow', 'threat-model-sheet'],
  ['workshop', '/threat-models/payment-api/checkout-flow?at=v1', 'threat-model-sheet'],
  ['read-only', '/threat-models/payment-api/checkout-flow', 'threat-model-sheet'],
  [
    'workshop#threat-model-in-review',
    '/threat-models/payment-api/checkout-flow/release',
    'release-record',
  ],
  ['workshop', '/reports', 'reports-view'],
  ['workshop', '/reports/samm-trend', 'trend-chart'],
  ['workshop', '/reports/samm-trend?scope=payments', 'trend-functions-chart'],
  ['workshop', '/reports/samm-compare?scope=payments&from=2025-q4&to=2026-q2', 'compare-chart'],
  ['workshop', '/reports/threat-evaluation', 'threat-evaluation-table'],
  ['release', '/reports/threat-evaluation', 'threat-forbidden'],
  ['workshop', '/reports/risk-register', 'risk-table'],
  ['workshop', '/reports/risk-register?as-of=2027-01-01', 'risk-refused'],
  ['empty', '/reports', 'reports-view'],
  ['workshop', '/settings', 'settings-view'],
  ['workshop', '/no/such/view/at/all', 'not-found-view'],
  ['degraded', '/', 'due-view'],
  ['first-login', '/welcome', 'welcome-view'],
  // The notice of local test accounts on a shell page, and a session without a right (UC-ACC-7).
  ['local', '/', 'due-view'],
  ['no-rights', '/', 'no-rights-view'],
  ['no-rights', '/samm', 'no-rights-view'],
];

/**
 * The states of the documents lens (UC-DOC-1 to UC-DOC-6): each one is reached on the page, after the theme is chosen,
 * because choosing it reloads the page and a state that was reached by acting would be gone.
 */
const DOCUMENT_STATES = [
  ['the list', 'workshop', '/categories/test-note', 'document-list', async () => {}],
  ['the sheet', 'workshop', noteAddress(NOTES.N2), 'document-sheet', async () => {}],
  [
    'a conflict to decide',
    'workshop#note-conflict',
    noteAddress(NOTES.N2),
    'conflict-panel',
    async (page) => {
      await field(page, '/summary').getByRole('textbox').fill('Rotate every 90 days.');
      await field(page, '/status').getByRole('combobox').selectOption({ label: 'Agreed' });
      await page.getByTestId('save-everyone').click();
    },
  ],
  [
    'an earlier state',
    'workshop',
    noteAddress(NOTES.N6, '?at=v1'),
    'revision-notice',
    async () => {},
  ],
  ['a new document', 'workshop', '/categories/test-note/new', 'new-document-sheet', async () => {}],
  [
    'the mandatory fields that are empty',
    'workshop',
    noteAddress(NOTES.N3),
    'missing-fields',
    async (page) => {
      await page.getByTestId('transition-test-note.submit').click();
    },
  ],
  [
    'a sheet that is read only',
    'read-only',
    noteAddress(NOTES.N2),
    'document-sheet',
    async () => {},
  ],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, prepare] of DOCUMENT_STATES) {
    test(`documents: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId('documents-view')).toBeVisible();
      await prepare(page);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectNoSeriousViolations(page, `documents: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The release of a note (UC-DOC-7) and the search of the documents (UC-DOC-1), each state reached on the page after the
 * theme is chosen. The Due list of `workshop` holds the release requests (UC-DOC-8), so its row above audits them too.
 */
const RELEASE_STATES = [
  [
    'the review of a first release',
    'workshop',
    `${noteAddress(NOTES.N4)}/release`,
    'release-record',
    async () => {},
  ],
  [
    'the review against the last release, with the request',
    'workshop',
    `${noteAddress(NOTES.N5)}/release`,
    'release-request',
    async () => {},
  ],
  [
    'the seal of a release',
    'workshop#note-release-request',
    `${noteAddress(NOTES.N5)}/release`,
    'release-seal',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-done')).toBeVisible();
    },
  ],
  [
    'a refused release',
    'workshop#note-release-incomplete',
    `${noteAddress(NOTES.N4)}/release`,
    'release-record',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-view').getByTestId('notice').first()).toBeVisible();
    },
  ],
  [
    'the confirmation of the release',
    'workshop#note-release-password',
    `${noteAddress(NOTES.N4)}/release`,
    'release-password',
    async (page) => {
      await page.getByTestId('release-act').click();
    },
  ],
  [
    'a release that cannot be taken',
    'read-only',
    `${noteAddress(NOTES.N4)}/release`,
    'release-act',
    async () => {},
  ],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, prepare] of RELEASE_STATES) {
    test(`release: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId('release-view')).toBeVisible();
      await prepare(page);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectNoSeriousViolations(page, `release: ${name} (${scenario}, ${theme})`);
    });
  }

  test(`the command palette with results of workshop in the ${theme} theme`, async ({
    page,
    request,
  }) => {
    await useScenario(request, 'workshop');
    await login(page, '/');
    await useTheme(page, theme);
    await page.getByTestId('search-open').click();
    await page.getByTestId('search-input').fill('Q4');
    await expect(page.getByTestId('search-documents')).toBeVisible();
    await expectNoSeriousViolations(page, `command palette with results (${theme})`);
    await page.getByTestId('search-input').fill('zzzz');
    await expect(page.getByTestId('search-status')).toContainText('No document matches.');
    await expectNoSeriousViolations(page, `command palette without a match (${theme})`);
  });
}

/**
 * The states of the catalogs lens (UC-CAT-1, UC-CAT-2): each one is reached on the page, after the theme is chosen,
 * because choosing it reloads the page and a state that was reached by acting would be gone.
 */
const CATALOG_STATES = [
  [
    'the catalogs and the entries of the first',
    'workshop',
    catalogAddress('team'),
    'entry-list',
    async () => {},
  ],
  ['the list of the services', 'workshop', catalogAddress('service'), 'entry-list', async () => {}],
  [
    'the filter without a match',
    'workshop',
    catalogAddress('service'),
    'catalog-list',
    async (page) => {
      await page.getByTestId('filter-name').fill('no such service');
      await expect(page.getByText('No entry matches')).toBeVisible();
    },
  ],
  [
    'a catalog without entries',
    'empty',
    catalogAddress('service'),
    'catalog-list',
    async (page) => {
      await expect(page.getByText('No entries yet')).toBeVisible();
    },
  ],
  [
    'the sheet of a service with its needs',
    'workshop',
    entryAddress('service', 'payment-api'),
    'service-needs',
    async () => {},
  ],
  [
    'the sheet of a service on a circle',
    'workshop',
    entryAddress('service', 'reporting'),
    'cycle-notice',
    async () => {},
  ],
  [
    'the sheet of a team',
    'workshop',
    entryAddress('team', 'payments'),
    'entry-sheet',
    async () => {},
  ],
  [
    'a sheet without the right',
    'read-only',
    entryAddress('service', 'payment-api'),
    'save-state',
    async () => {},
  ],
  [
    'the form of a new service',
    'catalog-admin',
    newEntryAddress('service'),
    'entry-form',
    async () => {},
  ],
  [
    'a retired entry',
    'catalog-admin',
    entryAddress('service', 'ledger'),
    'retired-notice',
    async () => {},
  ],
  [
    'the question before a retirement',
    'catalog-admin',
    entryAddress('service', 'customer-portal'),
    'retire-confirm',
    async (page) => {
      await page.getByTestId('retire-entry').click();
    },
  ],
  [
    'the question before a retirement with changes',
    'catalog-admin',
    entryAddress('service', 'customer-portal'),
    'retire-dirty',
    async (page) => {
      await field(page, '/description').getByRole('textbox').fill('Typed, not saved.');
      await page.getByTestId('retire-entry').click();
    },
  ],
  [
    'a form with field errors',
    'catalog-admin#catalog-invalid',
    newEntryAddress('service'),
    'failure-notice',
    async (page) => {
      await fillNewService(page, field, {
        id: 'notification-gateway',
        name: 'Notification gateway',
      });
      await page.getByTestId('save-entry').click();
    },
  ],
  [
    'an id that is taken',
    'catalog-admin#catalog-id-taken',
    newEntryAddress('service'),
    'failure-notice',
    async (page) => {
      await fillNewService(page, field, { id: 'ledger', name: 'Ledger again' });
      await page.getByTestId('save-entry').click();
    },
  ],
  [
    'a Git server that cannot be reached',
    'catalog-admin#git-unavailable',
    entryAddress('service', 'payment-api'),
    'failure-notice',
    async (page) => {
      await field(page, '/description').getByRole('textbox').fill('Kept.');
      await page.getByTestId('save-entry').click();
    },
  ],
  [
    'a change by someone else over an edit',
    'catalog-admin',
    entryAddress('service', 'payment-api'),
    'stale-notice',
    async (page, request) => {
      await field(page, '/description').getByRole('textbox').fill('My own wording.');
      await gotoState(request, 'catalog-changed-elsewhere');
    },
  ],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, prepare] of CATALOG_STATES) {
    test(`catalogs: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId('catalogs-view')).toBeVisible();
      await prepare(page, request);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectNoSeriousViolations(page, `catalogs: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The directory pages (UC-ACC-4, UC-ACC-5, UC-CAT-3 to UC-CAT-5): each state is reached on the page, after the theme is
 * chosen, because choosing it reloads the page. `view` is the root of the page; `shown` is what the state must show.
 */
const DIRECTORY_STATES = [
  [
    'the choice of the documents',
    'catalog-admin',
    IMPORT_ADDRESS,
    'import-view',
    'import-choose',
    async () => {},
  ],
  [
    'the chosen documents',
    'catalog-admin',
    IMPORT_ADDRESS,
    'import-view',
    'import-documents',
    async (page) => {
      await pasteDescriptor(page, DESCRIPTOR);
    },
  ],
  [
    'the check of the import',
    'catalog-admin',
    IMPORT_ADDRESS,
    'import-view',
    'import-left-out',
    async (page) => {
      await pasteDescriptor(page, DESCRIPTOR);
      await page.getByTestId('import-check').click();
    },
  ],
  [
    'the result of the import',
    'catalog-admin',
    IMPORT_ADDRESS,
    'import-view',
    'import-updated',
    async (page) => {
      await pasteDescriptor(page, DESCRIPTOR);
      await page.getByTestId('import-check').click();
      await page.getByTestId('import-apply').click();
      await expect(page.getByTestId('import-again')).toBeVisible();
    },
  ],
  [
    'an import without news',
    'catalog-admin#import-nothing-new',
    IMPORT_ADDRESS,
    'import-view',
    'import-left-out',
    async (page) => {
      await pasteDescriptor(page, DESCRIPTOR);
      await page.getByTestId('import-check').click();
    },
  ],
  [
    'a descriptor that is not valid',
    'catalog-admin#import-invalid',
    IMPORT_ADDRESS,
    'import-view',
    'import-document-invalid',
    async (page) => {
      await pasteDescriptor(page, DESCRIPTOR);
      await page.getByTestId('import-check').click();
    },
  ],
  [
    'a request that is too large',
    'catalog-admin#import-too-large',
    IMPORT_ADDRESS,
    'import-view',
    'import-failure',
    async (page) => {
      await pasteDescriptor(page, DESCRIPTOR);
      await page.getByTestId('import-check').click();
    },
  ],
  [
    'the import without the right',
    'workshop',
    IMPORT_ADDRESS,
    'import-view',
    'import-view',
    async () => {},
  ],
  [
    'the persons with the prefill',
    'catalog-admin',
    PERSONS_ADDRESS,
    'persons-view',
    'persons-add',
    async () => {},
  ],
  [
    'the persons without the right',
    'read-only',
    PERSONS_ADDRESS,
    'persons-view',
    'persons-read-only',
    async () => {},
  ],
  [
    'the persons of an empty installation',
    'empty',
    PERSONS_ADDRESS,
    'persons-view',
    'persons-add',
    async () => {},
  ],
  [
    'the prefill with a refusal on its row',
    'catalog-admin#persons-invalid',
    PERSONS_ADDRESS,
    'persons-view',
    'person-row-0',
    async (page) => {
      await fillPerson(page, 0, { name: 'Nadia Kovac' });
      await page.getByTestId('persons-add-row').click();
      await fillPerson(page, 1, { name: 'Omar Haddad' });
      await page.getByTestId('persons-submit').click();
      await expect(page.getByTestId('person-row-1')).toContainText('leads nowhere');
    },
  ],
  [
    'the question before an erasure',
    'catalog-admin',
    PERSONS_ADDRESS,
    'persons-view',
    'erase-confirm',
    async (page) => {
      await page.getByTestId('erase-p-2b7f10').click();
    },
  ],
  [
    'persons kept in the source of the organisation',
    'catalog-admin#erase-managed-by-source',
    PERSONS_ADDRESS,
    'persons-view',
    'managed-notice',
    async (page) => {
      await page.getByTestId('erase-p-2b7f10').click();
      await page.getByTestId('erase-confirm').click();
    },
  ],
  [
    'the own entry',
    'workshop',
    PROFILE_ADDRESS,
    'profile-view',
    'profile-last-confirmed',
    async () => {},
  ],
  [
    'the own entry with the question "Is this still right?"',
    'workshop#confirmation-due',
    PROFILE_ADDRESS,
    'profile-view',
    'profile-confirm',
    async () => {},
  ],
  [
    'the own entry with changes that are not saved',
    'workshop#confirmation-due',
    PROFILE_ADDRESS,
    'profile-view',
    'profile-confirm',
    async (page) => {
      await page.getByTestId('profile-name').fill('Alexandra Example');
      await expect(page.getByTestId('profile-confirm-act')).toBeDisabled();
    },
  ],
  [
    'the own entry refused by the server',
    'workshop#entry-invalid',
    PROFILE_ADDRESS,
    'profile-view',
    'profile-save',
    async (page) => {
      await page.getByTestId('profile-name').fill('Alexandra Example');
      await page.getByTestId('profile-save').click();
      await expect(page.getByTestId('profile-view')).toContainText('leads nowhere');
    },
  ],
  [
    'the notice of a due confirmation on a shell page',
    'workshop#confirmation-due',
    '/',
    'due-view',
    'confirmation-notice',
    async () => {},
  ],
  [
    'the entries a first login is offered',
    'first-login#candidates',
    WELCOME_ADDRESS,
    'welcome-view',
    'welcome-candidates',
    async (page) => {
      await page.getByTestId('welcome-role').selectOption({ label: 'Developer' });
      await page.getByTestId('welcome-save').click();
      await expect(page.getByRole('radio', { name: CANDIDATES[0].label })).toBeVisible();
    },
  ],
  [
    'an entry that cannot be taken over',
    'first-login#candidates-not-bindable',
    WELCOME_ADDRESS,
    'welcome-view',
    'welcome-candidates',
    async (page) => {
      await page.getByTestId('welcome-role').selectOption({ label: 'Developer' });
      await page.getByTestId('welcome-save').click();
      await page.getByRole('radio', { name: CANDIDATES[0].label }).check();
      await page.getByTestId('welcome-continue').click();
      await expect(page.getByTestId('welcome-candidates')).toContainText('cannot be taken over');
    },
  ],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, shown, prepare] of DIRECTORY_STATES) {
    test(`directory: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId(view)).toBeVisible();
      await prepare(page);
      await expect(page.getByTestId(shown).first()).toBeVisible();
      await expectNoSeriousViolations(page, `directory: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The SAMM completion (UC-SAMM-1 to UC-SAMM-5), each state reached on the page after the theme is chosen: the forms of a
 * new scope and a new assessment with their refusals and notices, the targets with their conflict and refusal, the
 * evidence links with the editor, the question before a removal and a refusal, the frozen practice, the refused comparison and
 * the trend with the model versions it leaves out. `shown` is the test id that proves the state is on the page.
 */
const SAMM_COMPLETION_STATES = [
  [
    'a new scope',
    'workshop',
    NEW_SCOPE_ADDRESS,
    'new-scope-sheet',
    'new-scope-targets-editor',
    async () => {},
  ],
  [
    'a new scope that was refused',
    'workshop#scope-invalid',
    NEW_SCOPE_ADDRESS,
    'new-scope-sheet',
    'notice',
    async (page) => {
      await page.getByTestId('new-scope-title').fill('Bad');
      await choose(page, 'new-scope-subject', 'Payments');
      await choose(page, 'new-scope-targets-editor-ta-target', '2.5');
      await page.getByTestId('create-scope').click();
    },
  ],
  [
    'a new scope without the right',
    'read-only',
    NEW_SCOPE_ADDRESS,
    'new-scope-no-right',
    'new-scope-no-right',
    async () => {},
  ],
  [
    'a new scope without a pinned model',
    'workshop#models-none',
    NEW_SCOPE_ADDRESS,
    'new-scope-no-model',
    'new-scope-no-model',
    async () => {},
  ],
  [
    'a new assessment',
    'workshop',
    newAssessmentAddress('shop'),
    'new-assessment-sheet',
    'assessor-self',
    async (page) => {
      await page.getByTestId('assessor-add').click();
    },
  ],
  [
    'a new assessment while one is open',
    'workshop',
    newAssessmentAddress('payments'),
    'new-assessment-sheet',
    'open-notice',
    async () => {},
  ],
  [
    'a new assessment that was refused',
    'workshop#assessment-invalid',
    newAssessmentAddress('shop'),
    'new-assessment-sheet',
    'save-state',
    async (page) => {
      await fillNewAssessment(page, 'Web shop 2026 Q4');
      await page.getByTestId('create-assessment').click();
      await expect(page.getByTestId('new-assessment-date')).toHaveAttribute('aria-invalid', 'true');
    },
  ],
  [
    'the targets of a scope',
    'workshop',
    '/samm/payments',
    'scope-sheet',
    'targets-ta-target',
    async () => {},
  ],
  [
    'the targets that were changed',
    'workshop',
    '/samm/payments',
    'scope-sheet',
    'save-targets',
    async (page) => {
      await choose(page, 'targets-ta-target', '3');
    },
  ],
  [
    'a conflict of the targets',
    'workshop#targets-conflict',
    '/samm/payments',
    'scope-sheet',
    'conflict-target-ta',
    async (page) => {
      await choose(page, 'targets-ta-target', '3');
      await page.getByTestId('save-targets').click();
    },
  ],
  [
    'the targets that were refused',
    'workshop#targets-invalid',
    '/samm/payments',
    'scope-sheet',
    'targets-failure',
    async (page) => {
      await choose(page, 'targets-ta-target', '3');
      await page.getByTestId('save-targets').click();
      await expect(page.getByTestId('targets-ta-target')).toHaveAttribute('aria-invalid', 'true');
    },
  ],
  [
    'the targets read only',
    'read-only',
    '/samm/payments',
    'scope-sheet',
    'targets',
    async () => {},
  ],
  [
    'the trend with the versions it leaves out',
    'workshop',
    '/samm/payments',
    'scope-sheet',
    'trend-omitted',
    async (page) => {
      await patchRead(page, `**${trendPath('payments')}`, (trend) => ({ ...trend, omitted: 2 }));
      await page.reload();
    },
  ],
  [
    'the evidence of a practice',
    'workshop',
    assessmentAddress(OPEN.scope, OPEN.assessment, 'sb'),
    'practice-sheet',
    'evidence-editor-table',
    async () => {},
  ],
  [
    'the editor of an evidence link',
    'workshop',
    assessmentAddress(OPEN.scope, OPEN.assessment, 'sb'),
    'practice-sheet',
    'evidence-editor-field-url',
    async (page) => {
      await page.getByRole('button', { name: 'Add row' }).click();
      await page.getByTestId('evidence-editor-apply').click();
    },
  ],
  [
    'the question before an evidence link is removed',
    'workshop',
    assessmentAddress(OPEN.scope, OPEN.assessment, 'sb'),
    'practice-sheet',
    'evidence-editor-remove-confirm',
    async (page) => {
      await page.getByRole('button', { name: 'Remove row 1' }).click();
    },
  ],
  [
    'the evidence that was refused',
    'workshop#evidence-invalid',
    assessmentAddress(OPEN.scope, OPEN.assessment, 'sb'),
    'practice-sheet',
    'evidence-editor-errors',
    async (page) => {
      await page.getByTestId('comment-sb-b-1').fill('x');
      await page.getByTestId('save-everyone').click();
    },
  ],
  [
    'a frozen practice with its evidence',
    'workshop',
    assessmentAddress(RELEASED.scope, RELEASED.assessment, 'sb'),
    'practice-sheet',
    'start-new-assessment',
    async () => {},
  ],
  [
    'a frozen assessment',
    'workshop',
    assessmentAddress(RELEASED.scope, RELEASED.assessment),
    'assessment-sheet',
    'start-new-assessment',
    async () => {},
  ],
  [
    'the refused comparison',
    'workshop#model-versions-differ',
    assessmentAddress(RELEASED.scope, RELEASED.assessment),
    'assessment-sheet',
    'versions-differ',
    async () => {},
  ],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, shown, prepare] of SAMM_COMPLETION_STATES) {
    test(`samm completion: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId(view)).toBeVisible();
      await prepare(page);
      await expect(page.getByTestId(shown).first()).toBeVisible();
      await expectNoSeriousViolations(page, `samm completion: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The states of the lens Reports (UC-SAMM-5, UC-TM-4, UC-ISMS-3) beside the views above: the notices, the refusals, the empty
 * and the unavailable registers, the trend of one scope with what it leaves out, the comparison with its practices
 * opened. Each is reached on the page after the theme is chosen, which reloads it.
 */
const REPORT_STATES = [
  [
    'the dashboard of a person who may read no register',
    'workshop',
    REPORTS_ADDRESS,
    'reports-view',
    'reports-view',
    async (page) => {
      // The mock has no such session; the answer is cut down to its date.
      await patchRead(page, `**${SUMMARY_PATH}`, ({ today }) => ({ today }));
      await page.reload();
      await expect(page.getByText('No report to show')).toBeVisible();
    },
  ],
  [
    'the dashboard without threat models',
    'workshop#no-threat-models',
    REPORTS_ADDRESS,
    'reports-view',
    'reports-threats',
    async () => {},
  ],
  [
    'the dashboard of a person who may not read the threat models',
    'release',
    REPORTS_ADDRESS,
    'reports-view',
    'reports-risks',
    async () => {},
  ],
  [
    'the trend with the versions of the model',
    'workshop#trend-mixed-models',
    TREND_ADDRESS,
    'samm-trend-view',
    'trend-versions',
    async () => {},
  ],
  [
    'the trend with an assessment it leaves out',
    'workshop#trend-mixed-models',
    TREND_ADDRESS,
    'samm-trend-view',
    'trend-omitted',
    async () => {},
  ],
  [
    'the trend of a scope that is not there',
    'workshop',
    trendAddress('nope'),
    'samm-trend-view',
    'trend-scope-unknown',
    async () => {},
  ],
  [
    'the trend of a scope without a release',
    'workshop',
    trendAddress('identity'),
    'samm-trend-view',
    'trend-scope-section',
    async () => {},
  ],
  [
    'the trend of a scope with one assessment',
    'workshop',
    trendAddress('shop'),
    'samm-trend-view',
    'trend-functions-chart',
    async () => {},
  ],
  [
    'the trend with a sixth scope in the table only',
    'workshop',
    TREND_ADDRESS,
    'samm-trend-view',
    'trend-beyond',
    async (page) => {
      await patchRead(page, `**${TREND_PATH}`, (trend) => {
        const shop = trend.scopes.find((scope) => scope.scope === 'shop');
        const copy = (id) => ({
          ...shop,
          scope: id,
          title: id,
          points: shop.points.map((point) => ({ ...point, assessment: `${id}-1`, title: id })),
        });
        return { ...trend, scopes: [...trend.scopes, copy('extra-a'), copy('extra-b')] };
      });
      await page.reload();
    },
  ],
  [
    'the trend of the empty installation',
    'empty',
    TREND_ADDRESS,
    'samm-trend-view',
    'samm-trend-view',
    async () => {},
  ],
  [
    'the pairs of a scope and its pickers',
    'workshop',
    compareAddress('payments'),
    'samm-compare-view',
    'compare-pairs',
    async () => {},
  ],
  [
    'the scope that has too few assessments to compare',
    'workshop',
    compareAddress('shop'),
    'samm-compare-view',
    'compare-too-few',
    async () => {},
  ],
  [
    'the practices of a business function opened',
    'workshop',
    compareAddress(PAIR.scope, PAIR.from, PAIR.to),
    'samm-compare-view',
    'dumbbell-governance-sm-A',
    async (page) => {
      await page.getByText('Practices of Governance').click();
    },
  ],
  [
    'the comparison of two model versions that is refused',
    'workshop#model-versions-differ',
    compareAddress(PAIR.scope, PAIR.from, PAIR.to),
    'samm-compare-view',
    'compare-differ',
    async () => {},
  ],
  [
    'the comparison with an assessment that is missing',
    'workshop',
    compareAddress(PAIR.scope, 'nope', PAIR.to),
    'samm-compare-view',
    'compare-missing',
    async () => {},
  ],
  [
    'the threat evaluation in another order',
    'workshop',
    THREATS_ADDRESS,
    'threat-evaluation-view',
    'threat-evaluation-table',
    async (page) => {
      await choose(page, 'threat-evaluation-sort', 'Open threats');
    },
  ],
  [
    'the threat evaluation without a model',
    'workshop#no-threat-models',
    THREATS_ADDRESS,
    'threat-evaluation-view',
    'threat-evaluation-none',
    async () => {},
  ],
  [
    'the threat evaluation of the empty installation',
    'empty',
    THREATS_ADDRESS,
    'threat-evaluation-view',
    'threat-evaluation-view',
    async () => {},
  ],
  [
    'the risk register of a day',
    'workshop',
    risksAddress('2026-03-01'),
    'risk-register-view',
    'risk-earlier-commit',
    async () => {},
  ],
  [
    'the risk register of a tag',
    'workshop',
    risksAddress('audit-2026-03'),
    'risk-register-view',
    'risk-table',
    async () => {},
  ],
  [
    'the risk register of a day before its first commit',
    'workshop',
    risksAddress('2025-06-01'),
    'risk-register-view',
    'risk-before-first',
    async () => {},
  ],
  [
    'the risk register of a day that has not come',
    'workshop',
    risksAddress('2027-01-01'),
    'risk-register-view',
    'risk-refused',
    async () => {},
  ],
  [
    'the risk register of a name that is no tag',
    'workshop',
    risksAddress('no-such-tag'),
    'risk-register-view',
    'risk-refused',
    async () => {},
  ],
  [
    'the risk register while the Git server is down',
    'workshop#risk-register-git-unavailable',
    risksAddress('2026-03-01'),
    'risk-register-view',
    'risk-git-unavailable',
    async () => {},
  ],
  [
    'the empty risk register',
    'workshop#risk-register-empty',
    RISKS_ADDRESS,
    'risk-register-view',
    'risk-result',
    async () => {},
  ],
  [
    'the risk register of a person who may not read it',
    'workshop',
    RISKS_ADDRESS,
    'risk-register-view',
    'risk-forbidden',
    async (page) => {
      // The mock has no profile that reads the reports and not the register; the register answers as the server does.
      await page.route(`**${RISKS_PATH}**`, (route) =>
        route.fulfill({ status: 403, json: { outcome: 'FORBIDDEN' } }),
      );
      await page.reload();
    },
  ],
];

/**
 * Waits for the part of the page an audit exists for, then checks that the mock is still in the state the page read: the
 * page reloaded after the first check (the theme), so a run that switched the shared mock meanwhile is named here and not
 * audited under the wrong state. A part that does not appear is checked first, so that the mismatch is the failure.
 */
async function shownInScenario(page, request, reference, testId) {
  try {
    await expect(page.getByTestId(testId).first()).toBeVisible();
  } catch (error) {
    await expectScenario(request, reference);
    throw error;
  }
  await expectScenario(request, reference);
}

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, shown, prepare] of REPORT_STATES) {
    test(`reports: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      // The page reads what the profile answers: a mock that is no longer in it is named, not drawn.
      await useTheme(page, theme);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectScenario(request, scenario);
      await prepare(page);
      await shownInScenario(page, request, scenario, shown);
      await expectNoSeriousViolations(page, `reports: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The states of the lens Threat models (UC-TM-1, UC-TM-2, UC-TM-4) beside the views above: the evaluation of a person who
 * may only read and of an installation without a model or a service, the pages of a service, the sheet with its dialogs, its
 * review, its refusals and its steps, and the release with its refusals. Each is reached on the page after the theme is
 * chosen, which reloads it, so what a state needs (a change, a save, a click) is done by `prepare`.
 */
const THREAT_ADDRESS = CHECKOUT.address;
const RELEASE_ADDRESS = releaseAddress(CHECKOUT.service, CHECKOUT.model);

/** Changes a threat and saves for everyone: the way to the refusals of a save. */
async function changeAndSave(page) {
  await page.getByTestId('threat-status-T-01').selectOption({ label: 'Mitigated' });
  await page.getByTestId('save-everyone').click();
}

const THREAT_STATES = [
  [
    'the evaluation of a person who may only read',
    'read-only',
    LENS_ADDRESS,
    'threat-models-view',
    'threat-evaluation-without-table',
    async () => {},
  ],
  [
    'the lens without threat models',
    'workshop#no-threat-models',
    LENS_ADDRESS,
    'threat-models-view',
    'threat-evaluation-none',
    async () => {},
  ],
  [
    'the lens of the empty installation',
    'empty',
    LENS_ADDRESS,
    'threat-models-view',
    'evaluation-column',
    // The column is drawn while the evaluation is read: the audit waits for the notice it exists for.
    async (page) => {
      await expect(page.getByText('No service in the catalog')).toBeVisible();
    },
  ],
  [
    'a service with a recipe that was started',
    'workshop#recipe-draft-saved',
    serviceAddress('report-scheduler'),
    'threat-models-view',
    'recipe-drafts',
    async () => {},
  ],
  [
    'a service without a model',
    'workshop',
    serviceAddress('notification-gateway'),
    'threat-models-view',
    'service-no-models',
    async () => {},
  ],
  [
    'a service that is retired',
    'workshop',
    serviceAddress('ledger'),
    'threat-models-view',
    'service-retired',
    async () => {},
  ],
  [
    'a model that was never released',
    'workshop',
    '/threat-models/notification-service/notification-flows',
    'threat-model-sheet',
    'review-status',
    async () => {},
  ],
  [
    'the review that was started',
    'workshop',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'review-next-due',
    async (page) => {
      await page.getByTestId('start-review').click();
    },
  ],
  [
    'the dialog of a threat with its fields wrong',
    'workshop',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'threats-field-name',
    async (page) => {
      await page.getByRole('button', { name: 'Add a threat' }).click();
      await page.getByTestId('threats-field-likelihood').fill('150');
      await page.getByTestId('threats-apply').click();
      await expect(page.getByRole('dialog')).toContainText('Fill in this field.');
    },
  ],
  [
    'the dialog that changes a threat',
    'workshop',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'threats-field-status',
    async (page) => {
      await editThreat(page, 'T-02');
    },
  ],
  [
    'the question before a threat and its countermeasures are removed',
    'workshop',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'threats-remove-treatments',
    async (page) => {
      await page.getByRole('button', { name: 'Remove T-03', exact: true }).click();
    },
  ],
  [
    'the dialog of a countermeasure with its fields wrong',
    'workshop',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'mitigations-field-issues',
    async (page) => {
      await page.getByRole('button', { name: 'Add a countermeasure' }).click();
      await page.getByTestId('mitigations-field-issues').fill('X'.repeat(65));
      await page.getByTestId('mitigations-apply').click();
      await expect(page.getByRole('dialog')).toContainText('Fill in this field.');
    },
  ],
  [
    'the question before a countermeasure is removed',
    'workshop',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'mitigations-remove-confirm',
    async (page) => {
      await page.getByRole('button', { name: 'Remove M-03', exact: true }).click();
    },
  ],
  [
    'a model with a threat that was added and not saved',
    'workshop',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'threat-untreated-T-10',
    async (page) => {
      await page.getByRole('button', { name: 'Add a threat' }).click();
      await page.getByTestId('threats-field-name').fill('Log injection');
      await page.getByTestId('threats-apply').click();
    },
  ],
  [
    'a model saved after its release',
    'workshop#threat-model-reopened',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'transition-threat-model.submit',
    async () => {},
  ],
  [
    'a model in review',
    'workshop#threat-model-in-review',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'transition-threat-model.release',
    async () => {},
  ],
  [
    'a model after its release',
    'workshop#threat-model-released',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'release-block',
    async () => {},
  ],
  [
    'a model with rows and fields the server refused',
    'workshop#threat-model-invalid',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'threats-errors',
    async (page) => {
      await page.getByTestId('start-review').click();
      await changeAndSave(page);
    },
  ],
  [
    'a model with a conflict to decide',
    'workshop#threat-model-saved-by-other',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'conflict-/threats',
    changeAndSave,
  ],
  [
    'a model while the Git server is down',
    'workshop#threat-model-git-unavailable',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'failure-notice',
    changeAndSave,
  ],
  [
    'a model submitted with fields missing',
    'workshop#threat-model-submit-incomplete',
    THREAT_ADDRESS,
    'threat-model-sheet',
    'missing-fields',
    async (page) => {
      await page.getByTestId('transition-threat-model.submit').click();
    },
  ],
  [
    'the release of a model that is released already',
    'workshop',
    RELEASE_ADDRESS,
    'release-view',
    'release-act',
    async () => {},
  ],
  [
    'the seal of a release',
    'workshop#threat-model-in-review',
    RELEASE_ADDRESS,
    'release-view',
    'release-seal',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-done')).toBeVisible();
    },
    // The release moved the mock on: the state the page ends in.
    'workshop#threat-model-released',
  ],
  [
    'a release that is to be checked again',
    'workshop#threat-model-release-changed',
    RELEASE_ADDRESS,
    'release-view',
    'notice',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-view').getByTestId('notice').first()).toContainText(
        'Someone saved after you opened the release.',
      );
    },
    // The refused release moved the mock on: the state the page ends in.
    'workshop#threat-model-release-changed-reviewed',
  ],
  [
    'a release the Git server cannot make',
    'workshop#threat-model-in-review',
    RELEASE_ADDRESS,
    'release-view',
    'notice',
    async (page, request) => {
      await gotoState(request, 'threat-model-git-unavailable');
      await page.getByTestId('release-act').click();
      await expect(page.getByRole('alert')).toContainText('The Git server cannot be reached.');
    },
    // The act moved the mock on: the state the page ends in.
    'workshop#threat-model-git-unavailable',
  ],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, shown, prepare, after = scenario] of THREAT_STATES) {
    test(`threat models: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectScenario(request, scenario);
      await prepare(page, request);
      await shownInScenario(page, request, after, shown);
      await expectNoSeriousViolations(page, `threat models: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The recipe wizard of a new threat model (UC-TM-1) beside the views above: the choice of a recipe and what stands in its
 * place (no right, a retired service, a recipe that does not exist, no recipe), the steps with their tables and dialogs, the
 * last page, the refusals of the create and the questions the wizard asks. Each is reached on the page after the theme is
 * chosen, which reloads it, so what a state needs (a step, a click, a request) is done by `prepare`.
 */
const NEW_ADDRESS = newAddress('report-scheduler');
const QUICK_START = newAddress('report-scheduler', 'quick-start');

/** Goes on from the step the wizard is on to the last page, step by step. */
async function toLastPage(page, titles) {
  for (const title of titles) await goOn(page, title);
}

const WIZARD_STATES = [
  [
    'the choice of a recipe that was started',
    'workshop#recipe-draft-saved',
    NEW_ADDRESS,
    'new-threat-model-sheet',
    'recipe-started-quick-start',
    async () => {},
  ],
  [
    'an installation without a recipe',
    'workshop#threat-model-recipes-none',
    NEW_ADDRESS,
    'new-threat-model-sheet',
    'new-threat-model-sheet',
    // The sheet stands before the recipes are read: the audit waits for the empty state, not for the loading text.
    async (page) => {
      await expect(page.getByRole('heading', { name: 'No recipe is available' })).toBeVisible();
    },
  ],
  [
    'a recipe that does not exist',
    'workshop',
    newAddress('report-scheduler', 'nope'),
    'recipe-missing',
    'recipe-choose',
    async () => {},
  ],
  [
    'a person who may not create a model',
    'read-only',
    QUICK_START,
    'new-threat-model-no-right',
    'new-threat-model-no-right',
    async () => {},
  ],
  [
    'a retired service',
    'workshop',
    newAddress('ledger', 'quick-start'),
    'new-threat-model-retired',
    'new-threat-model-retired',
    async () => {},
  ],
  [
    'the first step of a recipe',
    'workshop',
    QUICK_START,
    'recipe-step',
    'step-guidance',
    async () => {},
  ],
  [
    'a draft that was continued',
    'workshop#recipe-draft-saved',
    QUICK_START,
    'recipe-step',
    'step-next',
    async () => {},
  ],
  [
    'a step with a field that is marked',
    'workshop',
    QUICK_START,
    'recipe-step',
    'step-next',
    async (page) => {
      await stepField(page, 'Name').fill('x'.repeat(201));
      await expect(page.getByTestId('step-next')).toHaveAttribute('aria-disabled', 'true');
    },
  ],
  [
    'a step with a table and its dialog',
    'workshop#recipe-draft-saved',
    QUICK_START,
    'recipe-step',
    'step-form',
    async (page) => {
      await page.getByTestId('step-back').click();
      await expect(page.getByRole('table', { name: 'Trust zones' })).toBeVisible();
      await addRow(page);
    },
  ],
  [
    'the dialog of a threat of the wizard with its fields wrong',
    'workshop#recipe-draft-saved',
    QUICK_START,
    'recipe-step',
    'wizard-threats-field-name',
    async (page) => {
      await goOn(page, 'Threats');
      await page.getByRole('button', { name: 'Add a threat' }).click();
      await page.getByTestId('wizard-threats-field-likelihood').fill('150');
      await page.getByTestId('wizard-threats-apply').click();
      await expect(page.getByRole('dialog')).toContainText('Fill in this field.');
    },
  ],
  [
    'the threats of the wizard with one that nothing treats',
    'workshop#recipe-draft-saved',
    QUICK_START,
    'recipe-step',
    'threat-untreated-T-01',
    async (page) => {
      await goOn(page, 'Threats');
      await addThreat(page);
    },
  ],
  [
    'the countermeasures of STRIDE with no threat to attach them to',
    'workshop',
    newAddress('report-scheduler', 'stride'),
    'recipe-step',
    'wizard-mitigations',
    async (page) => {
      await fillName(page);
      await toLastPage(page, [
        'Trust zones',
        'Components',
        'Data flows',
        'Threats (STRIDE)',
        'Countermeasures',
      ]);
    },
  ],
  [
    'the countermeasures of STRIDE with one',
    'workshop',
    newAddress('report-scheduler', 'stride'),
    'recipe-step',
    'mitigation-M-01',
    async (page) => {
      await fillName(page);
      await toLastPage(page, ['Trust zones', 'Components', 'Data flows', 'Threats (STRIDE)']);
      await addThreat(page);
      await goOn(page, 'Countermeasures');
      await page.getByRole('button', { name: 'Add a countermeasure' }).click();
      await page.getByTestId('wizard-mitigations-field-name').fill('Check the addressees');
      await page.getByTestId('wizard-mitigations-field-threat').selectOption({ value: 'T-01' });
      await page.getByTestId('wizard-mitigations-field-status').selectOption({ label: 'Planned' });
      await page.getByTestId('wizard-mitigations-field-reduction').fill('50');
      await page.getByTestId('wizard-mitigations-apply').click();
    },
  ],
  [
    'the last page with what was filled in',
    'workshop#recipe-draft-saved',
    QUICK_START,
    'recipe-step',
    'review-data',
    async (page) => {
      await toLastPage(page, ['Threats', 'Review and create']);
    },
  ],
  [
    'the last page of a model without a name',
    'workshop',
    QUICK_START,
    'recipe-step',
    'create-model',
    async (page) => {
      await toLastPage(page, ['Trust zones', 'Components', 'Threats', 'Review and create']);
      await expect(page.getByTestId('create-model')).toHaveAttribute('aria-disabled', 'true');
    },
  ],
  [
    'a create that the server refused at a field',
    'workshop#threat-model-create-invalid',
    QUICK_START,
    'recipe-step',
    'step-form',
    async (page) => {
      await fillName(page);
      await toLastPage(page, ['Trust zones', 'Components', 'Threats', 'Review and create']);
      await page.getByTestId('create-model').click();
      await expect(stepHeading(page)).toHaveText('The frame');
      await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
    },
  ],
  [
    'a create while the Git server is down',
    'workshop#threat-model-git-unavailable',
    QUICK_START,
    'recipe-step',
    'create-model',
    async (page) => {
      await walkEmpty(page);
      await page.getByTestId('create-model').click();
      await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
    },
  ],
  [
    'the question before a wizard with what is kept nowhere is left',
    'workshop',
    QUICK_START,
    'recipe-step',
    'leave-stay',
    async (page) => {
      await fillName(page);
      await page.getByTestId('nav-settings').click();
      await expect(page.getByRole('dialog')).toContainText('Leave this page?');
    },
  ],
  [
    'the question for the password before a create',
    'workshop#note-release-password',
    QUICK_START,
    'recipe-step',
    'create-password',
    async (page) => {
      await walkEmpty(page);
      await routeCreate(page, (route) =>
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ outcome: 'STEP_UP_REQUIRED' }),
        }),
      );
      await page.getByTestId('create-model').click();
      await expect(page.getByRole('dialog')).toContainText('Confirm your identity');
    },
  ],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, shown, prepare, after = scenario] of WIZARD_STATES) {
    test(`threat model wizard: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectScenario(request, scenario);
      await prepare(page, request);
      await shownInScenario(page, request, after, shown);
      await expectNoSeriousViolations(page, `threat model wizard: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The lens Incidents (UC-IR-1, UC-IR-2, UC-IR-3) beside the views above: the years and the years that are not there, the
 * list of a year, the sheet with its stages (the ones that do not apply, the marker, the refusals), the deadline clock in
 * each of its states, the notices, the report, the confirmation of the review, the conflict and the refusals of a save, the
 * incident in review and the released one. Each is reached on the page after the theme is chosen, which reloads it, so what
 * a state needs (a click, a change, a route) is done by `prepare`. The clock of the page is pinned to the instant the mock
 * reads at, so a deadline is open or missed the same way on every run.
 */
const INCIDENT_STATES = [
  ['the years', 'workshop', '/incidents', 'incidents-view', 'year-list', async () => {}],
  [
    'the years of a repository that is not set up',
    'workshop#incident-year-missing',
    '/incidents',
    'incidents-view',
    'year-missing',
    async () => {},
  ],
  [
    'the years of a person without a right',
    'release',
    '/incidents',
    'incidents-view',
    'years-none',
    async () => {},
  ],
  [
    'the years of the empty installation',
    'empty',
    '/incidents',
    'incidents-view',
    'years-none',
    async () => {},
  ],
  [
    'the incidents of a year',
    'workshop',
    yearAddress(2026),
    'incident-list',
    'incident-list',
    async () => {},
  ],
  [
    'the incidents of a year that is over',
    'workshop',
    yearAddress(2025),
    'incident-list',
    'incident-list',
    async () => {},
  ],
  [
    'a year the server refuses',
    'workshop',
    yearAddress(2026),
    'incident-list',
    'incidents-forbidden',
    async (page) => {
      await page.route(`**${yearPath(2026)}`, (route) =>
        route.fulfill({ status: 403, json: { outcome: 'FORBIDDEN' } }),
      );
      await page.reload();
    },
  ],
  [
    'a year without an incident',
    'workshop',
    yearAddress(2026),
    'incident-list',
    'year-no-incidents',
    async (page) => {
      await patchRead(page, `**${yearPath(2026)}`, (body) => ({ ...body, incidents: [] }));
      await page.reload();
    },
  ],
  [
    'the sheet with the clock of the card data',
    'workshop',
    incidentAddress(CARD_DATA),
    'incident-sheet',
    'deadline-clock',
    async () => {},
  ],
  [
    'the notices of the card data',
    'workshop',
    incidentAddress(CARD_DATA, { stage: 'notifications' }),
    'incident-sheet',
    'notifications-table',
    async () => {},
  ],
  [
    'a stage that is completed',
    'workshop',
    incidentAddress(CARD_DATA, { stage: 'triage' }),
    'incident-sheet',
    'stage-reopen',
    async () => {},
  ],
  [
    'the triage with its title and protection needs',
    'workshop',
    incidentAddress(SUSPICIOUS, { stage: 'triage' }),
    'incident-sheet',
    'protection-needs',
    async () => {},
  ],
  [
    'an incident whose questions are not answered',
    'workshop',
    incidentAddress(SUSPICIOUS),
    'incident-sheet',
    'clock-none',
    async () => {},
  ],
  [
    'the refusal of a stage with its missing fields',
    'workshop',
    incidentAddress(SUSPICIOUS, { stage: 'triage' }),
    'incident-sheet',
    'missing-fields',
    async (page) => {
      await page.getByTestId('stage-complete').click();
    },
  ],
  [
    'the open stages before a stage that is refused',
    'workshop',
    incidentAddress(SUSPICIOUS, { stage: 'response' }),
    'incident-sheet',
    'stage-open-before',
    async (page) => {
      await patchRead(page, `**${readPath(SUSPICIOUS)}`, (body) => ({
        ...body,
        stages: body.stages.map((stage) =>
          stage.id === 'response' ? { ...stage, blockedBy: [] } : stage,
        ),
      }));
      await page.reload();
      await page.getByTestId('stage-complete').click();
    },
  ],
  [
    'a stage that waits for another',
    'workshop',
    incidentAddress(CARD_DATA, { stage: 'review' }),
    'incident-sheet',
    'stage-bar',
    async () => {},
  ],
  [
    'a stage that does not apply',
    'workshop',
    incidentAddress(CREDENTIAL_STUFFING, { stage: 'privacy-assessment' }),
    'incident-sheet',
    'stage-not-applicable',
    async () => {},
  ],
  [
    'the stages signed off before a stage was reopened',
    'workshop',
    incidentAddress(WRONG_RECIPIENT, { stage: 'response' }),
    'incident-sheet',
    'stage-predecessor-reopened',
    async () => {},
  ],
  [
    'the review that asks for a confirmation',
    'workshop',
    incidentAddress(CREDENTIAL_STUFFING, { stage: 'review' }),
    'incident-sheet',
    'stage-step-up-note',
    async () => {},
  ],
  [
    'the question for the password before the review is completed',
    'workshop#incident-review-stepped-up',
    incidentAddress(CREDENTIAL_STUFFING, { stage: 'review' }),
    'incident-sheet',
    'document-password',
    async (page) => {
      await patchRead(page, '**/api/v1/status', (body) => ({
        ...body,
        loginProvider: 'local',
        stepUp: 'password',
      }));
      await page.reload();
      await page.getByTestId('stage-complete').click();
      await expect(page.getByRole('dialog')).toContainText('Confirm your identity');
    },
  ],
  [
    'the question to save before a stage is completed',
    'workshop',
    incidentAddress(CARD_DATA, { stage: 'privacy-assessment' }),
    'incident-sheet',
    'stage-save-first',
    async (page) => {
      await field(page.getByTestId('stage-form'), '/risk')
        .getByRole('combobox')
        .selectOption({ label: 'Risk' });
      await page.getByTestId('stage-complete').click();
    },
  ],
  [
    'a deadline without a date and a progress report',
    'workshop',
    incidentAddress(ARCHIVE, { stage: 'notifications' }),
    'incident-sheet',
    'deadline-clock',
    async () => {},
  ],
  [
    'a deadline the page has overtaken',
    'workshop',
    incidentAddress(PHISHING),
    'incident-sheet',
    'deadline-clock',
    async (page) => {
      await pinClock(page, '2026-11-27T10:00:00Z');
      await page.reload();
      // The audit is of the overdue state: wait for the row to stand in it.
      const row = page.getByTestId('deadline-clock-gdpr-art33-');
      await expect(row).toHaveAttribute('data-status', 'MISSED');
      await expect(row).toContainText('Overdue by');
    },
  ],
  [
    'the deadlines of the next day',
    'workshop#incident-clock-advanced',
    incidentAddress(PHISHING),
    'incident-sheet',
    'deadline-clock',
    async (page) => {
      await pinClock(page, '2026-11-27T10:00:00Z');
      await page.reload();
      // The audit is of the overdue state: wait for the row to stand in it.
      const row = page.getByTestId('deadline-clock-gdpr-art33-');
      await expect(row).toHaveAttribute('data-status', 'MISSED');
      await expect(row).toContainText('Overdue by');
    },
  ],
  [
    'the report preview',
    'workshop',
    incidentAddress(CARD_DATA),
    'incident-sheet',
    'report-preview',
    async (page) => {
      await page.getByTestId('report-toggle').click();
      await expect(page.getByTestId('report-section')).toHaveCount(8);
    },
  ],
  [
    'the report that a release committed',
    'workshop',
    incidentAddress(OUTAGE),
    'incident-sheet',
    'report-preview',
    async (page) => {
      await page.getByTestId('report-toggle').click();
      await expect(page.getByTestId('report-source')).toContainText('committed');
    },
  ],
  [
    'an incident that was released',
    'workshop',
    incidentAddress(OUTAGE),
    'incident-sheet',
    'clock-stopped',
    async () => {},
  ],
  [
    'an earlier state of an incident',
    'workshop',
    incidentAddress(OUTAGE, { at: 'v1' }),
    'incident-sheet',
    'revision-notice',
    async () => {},
  ],
  [
    'an incident of a person who may only read',
    'read-only',
    incidentAddress(CARD_DATA),
    'incident-sheet',
    'save-state',
    async () => {},
  ],
  [
    'an incident in review',
    'workshop#incident-submitted',
    incidentAddress(CREDENTIAL_STUFFING),
    'incident-sheet',
    'transition-incident.release',
    async () => {},
  ],
  [
    'an incident that was released meanwhile',
    'workshop#incident-released',
    incidentAddress(CREDENTIAL_STUFFING),
    'incident-sheet',
    'released-notice',
    async () => {},
  ],
  [
    'a conflict of the notices to decide',
    'workshop#incident-saved-by-other',
    incidentAddress(CARD_DATA, { stage: 'notifications' }),
    'incident-sheet',
    'conflict-panel',
    async (page) => {
      const authority = field(page.getByTestId('stage-form'), '/supervisory-authority');
      await authority.getByLabel('Sent at').fill('2026-11-26T10:45');
      await authority.getByLabel('Recipient').fill('State data protection authority');
      await authority.getByLabel('Channel').selectOption({ label: 'Reporting portal' });
      await page.getByTestId('save-everyone').click();
    },
  ],
  [
    'a stage that was completed meanwhile',
    'workshop#incident-stage-locked',
    incidentAddress(CARD_DATA, { stage: 'privacy-assessment' }),
    'incident-sheet',
    'stage-failure',
    async (page) => {
      await field(page.getByTestId('stage-form'), '/risk')
        .getByRole('combobox')
        .selectOption({ label: 'Risk' });
      await page.getByTestId('save-everyone').click();
    },
  ],
  [
    'fields the server refused',
    'workshop#incident-invalid',
    incidentAddress(CARD_DATA, { stage: 'notifications' }),
    'incident-sheet',
    'save-state',
    async (page) => {
      const authority = field(page.getByTestId('stage-form'), '/supervisory-authority');
      await authority.getByLabel('Sent at').fill('2026-11-26T10:45');
      await authority.getByLabel('Recipient').fill('State data protection authority');
      await authority.getByLabel('Channel').selectOption({ label: 'Reporting portal' });
      await page.getByTestId('save-everyone').click();
      await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
    },
  ],
  [
    'a save while the Git server is down',
    'workshop#incident-git-unavailable',
    incidentAddress(CARD_DATA, { stage: 'privacy-assessment' }),
    'incident-sheet',
    'stage-failure',
    async (page) => {
      await field(page.getByTestId('stage-form'), '/risk')
        .getByRole('combobox')
        .selectOption({ label: 'Risk' });
      await page.getByTestId('save-everyone').click();
    },
  ],
  [
    'a completion that is read again',
    'workshop#incident-complete-changed',
    incidentAddress(PHISHING, { stage: 'privacy-assessment' }),
    'incident-sheet',
    'stage-failure',
    async (page) => {
      await page.getByTestId('stage-complete').click();
    },
  ],
  [
    'the release of an incident in review',
    'workshop#incident-submitted',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-record',
    async () => {},
  ],
  [
    'the release of an incident with deadlines still open',
    'workshop#incident-submitted',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-deadlines',
    async (page) => {
      // The mock has no incident in review with a deadline still open: the read is patched.
      await withOpenDeadlines(page, CREDENTIAL_STUFFING);
      await page.reload();
      await expect(page.getByTestId('release-deadlines').locator('li')).toHaveCount(2);
    },
  ],
  [
    'the seal of the release of an incident',
    'workshop#incident-submitted',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-seal',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-done')).toBeVisible();
    },
    // The release moved the mock on: the state the page ends in.
    'workshop#incident-released',
  ],
  [
    'the seal of the release of an incident whose deadlines were open',
    'workshop#incident-submitted',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-clock-stopped',
    async (page) => {
      await withOpenDeadlines(page, CREDENTIAL_STUFFING);
      await page.reload();
      await expect(page.getByTestId('release-deadlines').locator('li')).toHaveCount(2);
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-done')).toBeVisible();
    },
    'workshop#incident-released',
  ],
  [
    'a release refused because a stage is not completed',
    'workshop#incident-release-stages-open',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-refusal',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-refusal-review')).toBeVisible();
    },
    'workshop#incident-release-stages-open-refused',
  ],
  [
    'a release of an incident that is to be checked again',
    'workshop#incident-release-changed',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'notice',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-view').getByTestId('notice').first()).toContainText(
        'Someone saved after you opened the release.',
      );
    },
    // The refused release moved the mock on: the state the page ends in.
    'workshop#incident-release-changed-reviewed',
  ],
  [
    'a release of an incident that the Git server cannot make',
    'workshop#incident-submitted',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'notice',
    async (page, request) => {
      await gotoState(request, 'incident-git-unavailable');
      await page.getByTestId('release-act').click();
      await expect(page.getByRole('alert')).toContainText('The Git server cannot be reached.');
    },
    'workshop#incident-git-unavailable',
  ],
  [
    'the confirmation of the release of an incident',
    'workshop#incident-release-stepped-up',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-password',
    async (page) => {
      await patchRead(page, '**/api/v1/status', (body) => ({
        ...body,
        loginProvider: 'local',
        stepUp: 'password',
      }));
      await page.reload();
      await page.getByTestId('release-act').click();
      await expect(page.getByRole('dialog')).toContainText('Confirm your identity');
    },
  ],
  [
    'a release that cannot be taken by a person who may only read',
    'read-only',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-act',
    async () => {},
  ],
  [
    'the release of an incident that is released already',
    'workshop',
    incidentReleaseAddress(OUTAGE),
    'release-view',
    'release-act',
    async () => {},
  ],
  [
    'the release of an incident that is a draft',
    'workshop',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'release-act',
    async () => {},
  ],
  [
    'the release of an incident that cannot be read',
    'workshop#incident-submitted',
    incidentReleaseAddress(CREDENTIAL_STUFFING),
    'release-view',
    'notice',
    async (page) => {
      await page.route(`**${readPath(CREDENTIAL_STUFFING)}`, (route) =>
        route.fulfill({ status: 503, json: { outcome: 'GIT_UNAVAILABLE' } }),
      );
      await page.reload();
    },
  ],
  [
    'the form of a new incident',
    'workshop',
    newIncidentAddress(2026),
    'incidents-view',
    'new-incident-sheet',
    async () => {},
  ],
  [
    'the form of a new incident, typed',
    'workshop',
    newIncidentAddress(2026),
    'incidents-view',
    'create-incident',
    async (page) => {
      const sheet = page.getByTestId('new-incident-sheet');
      await sheet.getByLabel('Title').fill('Suspicious logins from the VPN gateway');
      await sheet.getByLabel('Became aware at').fill('2026-11-26T09:30');
      await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'changed');
    },
  ],
  [
    'the form of a new incident, refused at the title',
    'workshop#incident-create-invalid',
    newIncidentAddress(2026),
    'incidents-view',
    'new-incident-sheet',
    async (page) => {
      await page.getByTestId('new-incident-sheet').getByLabel('Title').fill('A title');
      await page.getByTestId('create-incident').click();
      await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
      await expect(field(page.getByTestId('new-incident-sheet'), '/title')).toContainText(
        'Fill in this field.',
      );
    },
  ],
  [
    'the form of a new incident, refused at the awareness',
    'workshop',
    newIncidentAddress(2026),
    'incidents-view',
    'new-incident-sheet',
    async (page) => {
      // The mock has no state that refuses a create for the year: the create is answered here.
      await page.route(`**${createPath(2026)}`, (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 422,
              json: {
                outcome: 'VALIDATION',
                errors: [{ part: 'triage', pointer: '/aware-at', code: 'OUT_OF_YEAR' }],
              },
            })
          : route.continue(),
      );
      const sheet = page.getByTestId('new-incident-sheet');
      await sheet.getByLabel('Title').fill('A title');
      await sheet.getByLabel('Became aware at').fill('2025-12-31T23:30');
      await page.getByTestId('create-incident').click();
      await expect(field(sheet, '/aware-at')).toContainText('not in the year of the incident');
    },
  ],
  [
    'the form of a new incident while the Git server is down',
    'workshop#incident-git-unavailable',
    newIncidentAddress(2026),
    'incidents-view',
    'new-incident-sheet',
    async (page) => {
      await page.getByTestId('new-incident-sheet').getByLabel('Title').fill('A title');
      await page.getByTestId('create-incident').click();
      await expect(page.getByRole('alert')).toContainText('The Git server cannot be reached.');
    },
  ],
  [
    'the confirmation of a new incident',
    'workshop',
    newIncidentAddress(2026),
    'incidents-view',
    'create-password',
    async (page) => {
      await patchRead(page, '**/api/v1/status', (body) => ({
        ...body,
        loginProvider: 'local',
        stepUp: 'password',
      }));
      await page.reload();
      // The mock has no state that asks a local user for the password on a create: the create is answered here.
      await page.route(`**${createPath(2026)}`, (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 403, json: { outcome: 'STEP_UP_REQUIRED' } })
          : route.continue(),
      );
      await page.getByTestId('new-incident-sheet').getByLabel('Title').fill('A title');
      await page.getByTestId('create-incident').click();
      await expect(page.getByRole('dialog')).toContainText('Confirm your identity');
    },
  ],
  [
    'the question before the form of a new incident is left',
    'workshop',
    newIncidentAddress(2026),
    'incidents-view',
    'leave-stay',
    async (page) => {
      await page.getByTestId('new-incident-sheet').getByLabel('Title').fill('A title');
      await page.getByTestId('nav-settings').click();
      await expect(page.getByRole('dialog')).toContainText('Leave this page?');
    },
  ],
  [
    'a new incident of a person who may only read',
    'read-only',
    newIncidentAddress(2026),
    'incidents-view',
    'new-incident-blocked',
    async () => {},
  ],
  [
    'a new incident of a year that is not the current one',
    'workshop',
    newIncidentAddress(2026),
    'incidents-view',
    'new-incident-blocked',
    async (page) => {
      await patchRead(page, '**/api/v1/incidents', (body) => ({
        ...body,
        years: body.years.map((year) => (year.year === 2026 ? { ...year, current: false } : year)),
      }));
      await page.reload();
    },
  ],
  [
    'a new incident in a year without a repository',
    'workshop#incident-year-missing',
    newIncidentAddress(2026),
    'not-found-view',
    'not-found-view',
    async () => {},
  ],
  ['the deadlines in the Due list', 'workshop', '/', 'due-view', 'due-list', async () => {}],
];

for (const theme of ['light', 'dark']) {
  for (const [name, scenario, address, view, shown, prepare, after = scenario] of INCIDENT_STATES) {
    test(`incidents: ${name} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await pinClock(page);
      await login(page, address);
      await useTheme(page, theme);
      await expect(page.getByTestId(view).first()).toBeVisible();
      await expectScenario(request, scenario);
      await prepare(page, request);
      await shownInScenario(page, request, after, shown);
      await expectNoSeriousViolations(page, `incidents: ${name} (${scenario}, ${theme})`);
    });
  }
}

/**
 * The lens ISMS, the documents (UC-ISMS-1): the types, a list, the sheet (with its review date overdue and due soon, an
 * earlier state, a conflict and the refusals of a save), the comparison of two releases in each of its states, a new document
 * and the review and release. Each is reached on the page after the theme and the language are chosen, which reload it, so
 * what a state needs (a click, a route) is done by `prepare`. Both themes in both languages, the clock pinned to the instant
 * the mock reads at.
 */
const ISMS_STATES = [
  ['the types', 'workshop', '/isms', 'isms-view', 'type-list', async () => {}],
  [
    'the types of a person who may not read the documents',
    'release',
    '/isms',
    'isms-view',
    'isms-forbidden',
    async () => {},
  ],
  ['no document yet', 'empty', ismsDocumentsAddress(), 'isms-view', 'types-empty', async () => {}],
  [
    'the documents of a type',
    'workshop',
    ismsDocumentsAddress(ISMS_KINDS[0].id),
    'isms-view',
    'document-list',
    async () => {},
  ],
  [
    'every document',
    'workshop',
    ismsDocumentsAddress(),
    'isms-view',
    'document-list',
    async () => {},
  ],
  [
    'the documents of a person who may only read',
    'read-only',
    ismsDocumentsAddress(ISMS_KINDS[0].id),
    'isms-view',
    'document-new',
    async () => {},
  ],
  [
    'the sheet of a released document',
    'workshop',
    ismsDocumentAddress(POLICY),
    'isms-view',
    'compare-link',
    async () => {},
  ],
  [
    'the sheet of a document whose review is overdue',
    'workshop',
    ismsDocumentAddress(SCOPE),
    'isms-view',
    'compare-link',
    async () => {},
  ],
  [
    'the sheet of a document whose review is due soon',
    'workshop',
    ismsDocumentAddress(ACCESS_POLICY),
    'isms-view',
    'compare-link',
    async () => {},
  ],
  [
    'the sheet of a document that cannot be compared yet',
    'workshop',
    ismsDocumentAddress(AUDIT_2025),
    'isms-view',
    'compare-none',
    async () => {},
  ],
  [
    'the sheet of a document in review',
    'workshop',
    ismsDocumentAddress(SECURE_DEVELOPMENT),
    'isms-view',
    'transition-isms.release',
    async () => {},
  ],
  [
    'an earlier state of a document',
    'workshop',
    ismsDocumentAddress(POLICY, 'v1'),
    'isms-view',
    'revision-notice',
    async () => {},
  ],
  [
    'a conflict of the statements to decide',
    'workshop#isms-document-saved-by-other',
    ismsDocumentAddress(POLICY),
    'isms-view',
    'conflict-panel',
    async (page) => {
      await field(page, '/statements')
        .getByRole('textbox')
        .first()
        .fill('Every exception to these rules is recorded and reviewed.');
      await page.getByTestId('save-everyone').click();
    },
  ],
  [
    'fields the server refused',
    'workshop#isms-document-invalid',
    ismsDocumentAddress(POLICY),
    'isms-view',
    'failure-notice',
    async (page) => {
      await field(page, '/title').getByRole('textbox').fill('Information security policy, 2027');
      await page.getByTestId('save-everyone').click();
      await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'failed');
    },
  ],
  [
    'the comparison, the pairs to choose from',
    'workshop',
    ismsCompareAddress(POLICY),
    'document-compare-view',
    'compare-pairs',
    async () => {},
  ],
  [
    'the comparison of two releases',
    'workshop',
    ismsCompareAddress(POLICY, 'v2', 'v3'),
    'document-compare-view',
    'compare-record',
    async () => {},
  ],
  [
    'the comparison of two releases of the scope',
    'workshop',
    ismsCompareAddress(SCOPE, 'v1', 'v2'),
    'document-compare-view',
    'compare-record',
    async () => {},
  ],
  [
    'the comparison of the same version twice',
    'workshop',
    ismsCompareAddress(POLICY, 'v1', 'v1'),
    'document-compare-view',
    'compare-same',
    async () => {},
  ],
  [
    'the comparison of two versions that are equal',
    'workshop',
    ismsCompareAddress(POLICY, 'v1', 'v2'),
    'document-compare-view',
    'compare-equal',
    async (page) => {
      await patchRead(page, `**${ismsDiffPath(POLICY)}**`, (body) => ({ ...body, sections: [] }));
      await page.reload();
    },
  ],
  [
    'the comparison with a version that does not exist',
    'workshop',
    ismsCompareAddress(POLICY, 'v9', 'v3'),
    'document-compare-view',
    'compare-refused',
    async () => {},
  ],
  [
    'the comparison of a document with one release',
    'workshop',
    ismsCompareAddress(AUDIT_2025),
    'document-compare-view',
    'compare-too-few',
    async () => {},
  ],
  [
    'the choice of the type of a new document',
    'workshop',
    ismsNewAddress(),
    'isms-view',
    'new-document-choice',
    async () => {},
  ],
  [
    'the form of a new document',
    'workshop',
    ismsNewAddress('policy'),
    'isms-view',
    'new-document-sheet',
    async () => {},
  ],
  [
    'the form of a new document while the Git server is down',
    'workshop#isms-git-unavailable',
    ismsNewAddress('policy'),
    'isms-view',
    'save-state',
    async (page) => {
      await field(page, '/title').getByRole('textbox').fill('A title');
      await page.getByTestId('save-everyone').click();
      await expect(page.getByRole('alert')).toBeVisible();
    },
  ],
  [
    'a new document of a person who may only read',
    'read-only',
    ismsNewAddress('policy'),
    'isms-view',
    'new-document-sheet',
    async () => {},
  ],
  [
    'the review of a release',
    'workshop',
    ismsReleaseAddress(SECURE_DEVELOPMENT),
    'release-view',
    'release-record',
    async () => {},
  ],
  [
    'the seal of a release',
    'workshop',
    ismsReleaseAddress(SECURE_DEVELOPMENT),
    'release-view',
    'release-seal',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByTestId('release-done')).toBeVisible();
    },
    'workshop#isms-document-released',
  ],
  [
    'a release that asks for a fresh login',
    'workshop#isms-document-release-step-up',
    ismsReleaseAddress(SECURE_DEVELOPMENT),
    'release-view',
    'release-act',
    async () => {},
  ],
  [
    'a release the Git server cannot make',
    'workshop#isms-git-unavailable',
    ismsReleaseAddress(SECURE_DEVELOPMENT),
    'release-view',
    'notice',
    async (page) => {
      await page.getByTestId('release-act').click();
      await expect(page.getByRole('alert')).toBeVisible();
    },
  ],
  [
    'a release of a person who may only read',
    'read-only',
    ismsReleaseAddress(SECURE_DEVELOPMENT),
    'release-view',
    'release-act',
    async () => {},
  ],
  [
    'the release of a draft',
    'workshop',
    ismsReleaseAddress(AUDIT_2026),
    'release-view',
    'release-act',
    async () => {},
  ],
];

/** The states that are audited in German too: one of each kind of page, so that the longer words are drawn on each. */
const ISMS_GERMAN = new Set([
  'the types',
  'the documents of a type',
  'every document',
  'the sheet of a document whose review is overdue',
  'an earlier state of a document',
  'a conflict of the statements to decide',
  'fields the server refused',
  'the comparison, the pairs to choose from',
  'the comparison of two releases',
  'the comparison of the same version twice',
  'the comparison with a version that does not exist',
  'the choice of the type of a new document',
  'the form of a new document',
  'the review of a release',
  'the seal of a release',
  'a release of a person who may only read',
]);

for (const theme of ['light', 'dark']) {
  for (const language of ['en', 'de']) {
    for (const [name, scenario, address, view, shown, prepare, after = scenario] of ISMS_STATES) {
      if (language === 'de' && !ISMS_GERMAN.has(name)) continue;
      test(`isms: ${name} of ${scenario} at ${address} in the ${theme} theme in ${language}`, async ({
        page,
        request,
      }) => {
        await useScenario(request, scenario);
        await pinClock(page);
        await login(page, address);
        await page.evaluate(
          (value) => window.localStorage.setItem('audit_notary_locale', value),
          language,
        );
        await useTheme(page, theme);
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        await expect(page.getByTestId(view).first()).toBeVisible();
        await expectScenario(request, scenario);
        await prepare(page, request, language);
        await shownInScenario(page, request, after, shown);
        await expectNoSeriousViolations(page, `isms: ${name} (${scenario}, ${theme}, ${language})`);
      });
    }
  }
}

/** The pages outside the shell: no login, no shell (UC-ACC-1, UC-ACC-2). */
const OUTSIDE_VIEWS = [
  ['local', '/login', 'login-view'],
  ['workshop', '/signed-out', 'signed-out-view'],
  ['login-trouble#idp-unavailable', '/login-problem?reason=idp-unavailable', 'login-problem-view'],
  ['login-trouble#too-many-logins', '/login-problem?reason=too-many-logins', 'login-problem-view'],
  [
    'login-trouble#unknown-transaction',
    '/login-problem?reason=unknown-transaction',
    'login-problem-view',
  ],
  ['login-trouble#recovered', '/login-problem', 'login-problem-view'],
];

for (const theme of ['light', 'dark']) {
  for (const [scenario, address, view] of VIEWS) {
    test(`${view} of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await (scenario === 'local' ? loginLocal : login)(
        page,
        address === '/no/such/view/at/all' ? '/' : address,
      );
      if (address === '/no/such/view/at/all') await page.goto(address);
      await useTheme(page, theme);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectNoSeriousViolations(page, `${view} (${scenario}, ${theme})`);
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const [scenario, address, view] of OUTSIDE_VIEWS) {
    test(`${view} outside the shell of ${scenario} at ${address} in the ${theme} theme`, async ({
      page,
      request,
    }) => {
      await useScenario(request, scenario);
      await page.goto(address);
      await expect(page.getByTestId(view)).toBeVisible();
      await useTheme(page, theme);
      await expect(page.getByTestId(view)).toBeVisible();
      await expectNoSeriousViolations(page, `${view} (${scenario}, ${theme})`);
    });
  }
}

test('the command palette passes the audit', async ({ page, request }) => {
  await useScenario(request, 'workshop');
  await login(page, '/');
  await page.getByTestId('search-open').click();
  await expect(page.getByTestId('search-input')).toBeVisible();
  await expectNoSeriousViolations(page, 'command palette');
});
