import { expect, test } from '@playwright/test';
import { useScenario } from './helpers/mock.js';
import { login, loginLocal } from './helpers/login.js';

/**
 * AUN-WEB-3: the lenses on the rail (the ninth, Documents, where a generic category exists), one canonical address per view, and a reload restores it.
 */
const NOTE = '01JZ8W1E3G5J7M9P1R3T5X7Z9B';
const POLICY = '01JZB1C3E5G7J9M1P3R5T7W9Y2';

// [address, view, lens in the breadcrumb, page title]
const ADDRESSES = [
  ['/', 'due-view', 'Due', 'Due'],
  ['/samm', 'samm-view', 'SAMM', 'SAMM'],
  ['/samm/payments/2026-q4/sm', 'samm-view', 'SAMM', 'SAMM'],
  // The forms of the SAMM completion: `new` is reserved in the place of a scope and of an assessment.
  ['/samm/new', 'samm-view', 'SAMM', 'SAMM'],
  ['/samm/shop/new', 'samm-view', 'SAMM', 'SAMM'],
  ['/samm/payments/2026-q4/release', 'release-view', 'SAMM', 'Release'],
  ['/threat-models', 'threat-models-view', 'Threat models', 'Threat models'],
  ['/threat-models/payment-api', 'threat-models-view', 'Threat models', 'Threat models'],
  ['/threat-models/report-scheduler/new', 'threat-models-view', 'Threat models', 'Threat models'],
  [
    '/threat-models/payment-api/checkout-flow',
    'threat-models-view',
    'Threat models',
    'Threat models',
  ],
  [
    '/threat-models/payment-api/checkout-flow?at=v1',
    'threat-models-view',
    'Threat models',
    'Threat models',
  ],
  ['/threat-models/payment-api/checkout-flow/release', 'release-view', 'Threat models', 'Release'],
  ['/incidents', 'incidents-view', 'Incidents', 'Incidents'],
  ['/incidents/2026', 'incidents-view', 'Incidents', 'Incidents'],
  ['/incidents/2026/01JZ9T4M6Q8S0V2X4B6D8F0H2K', 'incidents-view', 'Incidents', 'Incidents'],
  [
    '/incidents/2026/01JZ9T4M6Q8S0V2X4B6D8F0H2K?stage=notifications',
    'incidents-view',
    'Incidents',
    'Incidents',
  ],
  ['/incidents/2026/01JZ8M3N5P7R9T1V3X5Z7B9D1F?at=v1', 'incidents-view', 'Incidents', 'Incidents'],
  // Part B of the lens (the new incident and the release) shows the placeholder until it is built.
  ['/incidents/2026/new', 'incidents-view', 'Incidents', 'Incidents'],
  // The risk register is the next part of the lens ISMS and shows the placeholder until it is built.
  ['/isms/risks/r-012', 'lens-view', 'ISMS', 'ISMS'],
  ['/isms', 'isms-view', 'ISMS', 'ISMS'],
  ['/isms/documents', 'isms-view', 'ISMS', 'ISMS'],
  ['/isms/documents?kind=policy', 'isms-view', 'ISMS', 'ISMS'],
  ['/isms/documents/new?kind=policy', 'isms-view', 'ISMS', 'ISMS'],
  [`/isms/documents/${POLICY}`, 'isms-view', 'ISMS', 'ISMS'],
  [`/isms/documents/${POLICY}?at=v1`, 'isms-view', 'ISMS', 'ISMS'],
  [`/isms/documents/${POLICY}/compare?from=v2&to=v3`, 'document-compare-view', 'ISMS', 'ISMS'],
  [`/isms/documents/${POLICY}/release`, 'release-view', 'ISMS', 'Release'],
  // The generic documents lens (rest-api.adoc, The Generic Documents Lens). `/categories` is no entry here: with one
  // category the lens opens it in place of this address (the test below).
  ['/categories/test-note', 'documents-view', 'Documents', 'Documents'],
  ['/categories/test-note/new?kind=note', 'documents-view', 'Documents', 'Documents'],
  [`/categories/test-note/${NOTE}`, 'documents-view', 'Documents', 'Documents'],
  [`/categories/test-note/${NOTE}?at=v1`, 'documents-view', 'Documents', 'Documents'],
  [`/categories/test-note/${NOTE}/release`, 'release-view', 'Documents', 'Release'],
  ['/catalogs/team/payments', 'catalogs-view', 'Catalogs', 'Catalogs'],
  // The lens Reports: the dashboard and the four reports; the generic `/reports/{report}` is no report (below).
  ['/reports', 'reports-view', 'Reports', 'Reports'],
  ['/reports/samm-trend', 'samm-trend-view', 'Reports', 'Reports'],
  ['/reports/samm-trend?scope=payments', 'samm-trend-view', 'Reports', 'Reports'],
  [
    '/reports/samm-compare?scope=payments&from=2025-q4&to=2026-q2',
    'samm-compare-view',
    'Reports',
    'Reports',
  ],
  ['/reports/threat-evaluation', 'threat-evaluation-view', 'Reports', 'Reports'],
  ['/reports/risk-register?as-of=2026-03-01', 'risk-register-view', 'Reports', 'Reports'],
  ['/settings', 'settings-view', 'Settings', 'Settings'],
];

test.beforeEach(async ({ request }) => {
  await useScenario(request, 'workshop');
});

for (const [address, view, lens, title] of ADDRESSES) {
  test(`${address} opens and reloads into the same view`, async ({ page }) => {
    await login(page, address);
    await expect(page.getByTestId(view)).toBeVisible();
    await expect(page.getByTestId('view-title')).toHaveText(lens);
    await page.reload();
    await expect(page).toHaveURL(address);
    await expect(page.getByTestId(view)).toBeVisible();
    await expect(page).toHaveTitle(`${title} – Audit Notary`);
  });
}

test('the documents lens opens its only category in place of /categories', async ({ page }) => {
  await page.goto(`/api/v1/auth/login?return=${encodeURIComponent('/categories')}`);
  await expect(page).toHaveURL('/categories/test-note');
  await expect(page.getByTestId('document-list')).toBeVisible();
});

test('the rail offers the nine lenses and marks the current one', async ({ page }) => {
  await login(page, '/');
  const rail = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(rail.getByRole('link')).toHaveText([
    'Audit Notary',
    'Due',
    'SAMM',
    'Threat models',
    'Incidents',
    'ISMS',
    'Documents',
    'Catalogs',
    'Reports',
    'Settings',
  ]);
  await page.getByTestId('nav-incidents').click();
  await expect(page).toHaveURL('/incidents');
  await expect(page.getByTestId('nav-incidents')).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page).toHaveURL('/');
});

test('the search opens a view', async ({ page }) => {
  await login(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByTestId('search-input').fill('thre');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/threat-models');
});

test('the due list leads to the document address', async ({ page }) => {
  await login(page, '/');
  const first = page.getByTestId('due-list').getByRole('link').first();
  const href = await first.getAttribute('href');
  await first.click();
  await expect(page).toHaveURL(href);
});

test('an unknown address answers with the not-found view', async ({ page }) => {
  await login(page, '/');
  await page.goto('/no/such/view/at/all');
  await expect(page.getByTestId('not-found-view')).toBeVisible();
  await page.getByRole('link', { name: 'Go to Due' }).click();
  await expect(page.getByTestId('due-view')).toBeVisible();
});

test('the generic address of the lens Reports is no report', async ({ page }) => {
  await login(page, '/reports');
  await page.goto('/reports/trends');
  await expect(page.getByTestId('not-found-view')).toBeVisible();
});

test('a name an address does not admit is ignored, a bad value of one it admits is not found', async ({
  page,
}) => {
  await login(page, '/');
  await page.goto(`/categories/test-note/${NOTE}?at=v1&utm_source=mail`);
  await expect(page.getByTestId('document-sheet')).toBeVisible();
  await page.goto(`/categories/test-note/${NOTE}?at=latest`);
  await expect(page.getByTestId('not-found-view')).toBeVisible();
  await page.goto(`/categories/test-note/${NOTE}?at=v1&at=v2`);
  await expect(page.getByTestId('not-found-view')).toBeVisible();
});

test('a login with the identity provider returns to the address with its query', async ({
  page,
}) => {
  const address = `/categories/test-note/${NOTE}?at=v1`;
  await page.goto(`/api/v1/auth/login?return=${encodeURIComponent(address)}`);
  await expect(page).toHaveURL(address);
  await expect(page.getByTestId('document-sheet')).toBeVisible();
});

test('a login with a query the address does not admit returns to the start page', async ({
  page,
}) => {
  await page.goto(
    `/api/v1/auth/login?return=${encodeURIComponent(`/categories/test-note/${NOTE}?at=v1&x=1`)}`,
  );
  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('due-view')).toBeVisible();
});

test('the login page of local test accounts returns to the address with its query', async ({
  page,
  request,
}) => {
  await useScenario(request, 'local');
  const address = `/categories/test-note/${NOTE}?at=4be0c3a`;
  await loginLocal(page, address);
  // The profile `local` has no category, so the address is kept and the lens says it is not found.
  await expect(page.getByTestId('not-found-view')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(address);
  await expect(page.getByTestId('not-found-view')).toBeVisible();
});
