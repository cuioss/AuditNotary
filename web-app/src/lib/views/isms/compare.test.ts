import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { breadcrumb } from '../../stores/breadcrumb';
import { resetKit, useProfile, type Kit } from '../documents/testkit';
import DocumentCompareView from './DocumentCompareView.svelte';

/**
 * The comparison of two releases of an ISMS document (UC-ISMS-1) against the `workshop` profile (AUN-TEST-1), whose diffs
 * exist for the information security policy (`v1`/`v2`, `v2`/`v3`, `v1`/`v3`) and the scope of the ISMS (`v1`/`v2`): the
 * changes by field, the pickers over the releases, the pairs of neighbouring releases, and what the page says when the
 * pair cannot be compared.
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
});

afterEach(resetKit);

const POLICY = '01JZB1C3E5G7J9M1P3R5T7W9Y2';
const SCOPE = '01JZB4F6H8K0N2Q4S6V8X0Z2C5';
const AUDIT_2025 = '01JZB5G7J9M1P3R5T7W9Y1B3D6';

/**
 * @param id the document
 * @param query the admitted query of the address: `from` and `to`
 * @param lang the language
 * @param answers answers that replace the profile's own
 * @returns the kit
 */
async function open(
  id: string,
  query: Record<string, string> = {},
  lang: 'en' | 'de' = 'en',
  answers: Record<string, unknown> = {},
): Promise<Kit> {
  const kit = await useProfile('workshop', lang, answers);
  render(DocumentCompareView, { params: { ismsdocument: id }, query });
  await screen.findByTestId('document-compare-view');
  return kit;
}

const diffs = (kit: Kit) => kit.requests.filter((request) => request.includes('/diff'));

describe('the changes between two releases', () => {
  it('shows the changes grouped by field in the words of the form, the earlier value struck out', async () => {
    const kit = await open(POLICY, { from: 'v2', to: 'v3' });
    const result = await screen.findByTestId('compare-result');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Compare releases of Information security policy',
    );
    expect(result).toHaveTextContent('3 changes');
    expect(screen.getByTestId('record-statements')).toHaveTextContent('Policy statements');
    expect(screen.getByTestId('record-statements').querySelectorAll('del')).toHaveLength(1);
    expect(screen.getByTestId('record-statements').querySelector('ins')).toHaveTextContent(
      'A change of the security rules is released only after the review',
    );
    expect(screen.getByTestId('record-review-due')).toHaveTextContent('Nov 18, 2026');
    expect(screen.getByTestId('record-review-due')).toHaveTextContent('May 20, 2027');
    expect(diffs(kit)).toEqual([`GET /api/v1/documents/isms-core/${POLICY}/diff?from=v2&to=v3`]);
  });

  it('reads a list of references by the title of what it names', async () => {
    await open(POLICY, { from: 'v2', to: 'v3' });
    const applies = await screen.findByTestId('record-applies-to');
    await vi.waitFor(() => expect(applies).toHaveTextContent('Organisation'));
    expect(applies).toHaveTextContent('Payments');
    expect(applies).not.toHaveTextContent('team:payments');
  });

  it('names both sides with their release, date and releaser, and leads to each version', async () => {
    await open(POLICY, { from: 'v1', to: 'v3' });
    await screen.findByTestId('compare-result');
    const from = screen.getByTestId('compare-side-from');
    expect(from).toHaveTextContent('v1, Mar 10, 2025, Noor Haddad');
    expect(within(from).getByRole('link')).toHaveAttribute(
      'href',
      `/isms/documents/${POLICY}?at=v1`,
    );
    const to = screen.getByTestId('compare-side-to');
    expect(to).toHaveTextContent('v3, May 20, 2026, Noor Haddad');
    expect(within(to).getByRole('link')).toHaveAttribute('href', `/isms/documents/${POLICY}?at=v3`);
  });

  it('compares the scope of the ISMS, the table of its exclusions row by row', async () => {
    await open(SCOPE, { from: 'v1', to: 'v2' });
    await screen.findByTestId('compare-result');
    expect(screen.getByTestId('compare-record')).toBeInTheDocument();
    expect(screen.getAllByText(/change/).length).toBeGreaterThan(0);
  });

  it('puts the comparison in the breadcrumb of the lens, after the document', async () => {
    await open(POLICY, { from: 'v2', to: 'v3' });
    await screen.findByTestId('compare-result');
    expect(get(breadcrumb)).toEqual([
      { label: 'ISMS documents', href: '/isms/documents' },
      { label: 'Information security policy', href: `/isms/documents/${POLICY}` },
      { label: 'Compare', href: `/isms/documents/${POLICY}/compare` },
    ]);
  });

  it('says that two versions hold the same content', async () => {
    await open(POLICY, { from: 'v1', to: 'v2' }, 'en', {
      [`GET /api/v1/documents/isms-core/${POLICY}/diff`]: {
        repository: 'isms-core',
        id: POLICY,
        from: `policies/${POLICY}/v1`,
        to: `policies/${POLICY}/v2`,
        sections: [],
      },
    });
    expect(await screen.findByTestId('compare-equal')).toHaveTextContent(
      'The two versions hold the same content.',
    );
    expect(screen.queryByTestId('compare-record')).toBeNull();
  });
});

describe('the pickers and the pairs', () => {
  it('offers the releases in both pickers, and the current state as the empty later side', async () => {
    await open(POLICY, { from: 'v2', to: 'v3' });
    await screen.findByTestId('compare-result');
    const from = screen.getByTestId('compare-from') as HTMLSelectElement;
    const options = [...from.options].map((option) => option.value);
    expect(options).toEqual(['', 'v3', 'v2', 'v1']);
    expect(from.value).toBe('v2');
    expect((screen.getByTestId('compare-to') as HTMLSelectElement).value).toBe('v3');
  });

  it('lists the pairs of neighbouring releases, newest first, when no earlier version is chosen', async () => {
    const kit = await open(POLICY);
    const pairs = await screen.findByTestId('compare-pairs');
    expect(
      within(pairs)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      `/isms/documents/${POLICY}/compare?from=v2&to=v3`,
      `/isms/documents/${POLICY}/compare?from=v1&to=v2`,
    ]);
    expect(pairs).toHaveTextContent('v2 and v3, released May 20, 2026');
    expect(pairs).toHaveTextContent('v1 and v2, released Nov 18, 2025');
    expect(screen.queryByTestId('compare-result')).toBeNull();
    expect(diffs(kit)).toEqual([]);
  });

  it('says what is missing before the act can be taken, and leads to the pair when it can', async () => {
    await open(POLICY);
    await screen.findByTestId('compare-pairs');
    const show = screen.getByTestId('compare-show');
    expect(show).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Choose the earlier version first.')).toBeInTheDocument();
    await fireEvent.change(screen.getByTestId('compare-from'), { target: { value: 'v1' } });
    expect(screen.getByTestId('compare-show')).toHaveAttribute(
      'href',
      `/isms/documents/${POLICY}/compare?from=v1`,
    );
    await fireEvent.change(screen.getByTestId('compare-to'), { target: { value: 'v3' } });
    expect(screen.getByTestId('compare-show')).toHaveAttribute(
      'href',
      `/isms/documents/${POLICY}/compare?from=v1&to=v3`,
    );
    await fireEvent.change(screen.getByTestId('compare-from'), { target: { value: 'v3' } });
    expect(screen.getByTestId('compare-show')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Choose two different versions.')).toBeInTheDocument();
  });

  it('says that a document with one release cannot be compared yet, and shows no picker', async () => {
    await open(AUDIT_2025);
    expect(await screen.findByTestId('compare-too-few')).toHaveTextContent('Not two releases yet');
    expect(screen.queryByTestId('compare-from')).toBeNull();
  });
});

describe('what cannot be compared', () => {
  it('does not ask the server to compare a version with itself', async () => {
    const kit = await open(POLICY, { from: 'v2', to: 'v2' });
    expect(await screen.findByTestId('compare-same')).toHaveTextContent(
      'Choose two different versions.',
    );
    expect(diffs(kit)).toEqual([]);
  });

  it('says that a version does not exist for this document', async () => {
    await open(POLICY, { from: 'v9' });
    expect(await screen.findByTestId('compare-refused')).toHaveTextContent(
      'One of the two versions does not exist for this document.',
    );
    expect(screen.queryByTestId('compare-result')).toBeNull();
  });

  it('tells the refusal of the server in its words when the pair is not one it compares', async () => {
    await open(POLICY, { from: 'v2' });
    expect(await screen.findByTestId('compare-refused')).toHaveTextContent(
      'Some entries are not valid. Correct the marked fields.',
    );
  });

  it('is the not-found view for a document that does not exist', async () => {
    await useProfile('workshop');
    render(DocumentCompareView, {
      params: { ismsdocument: '01JZZZZZZZZZZZZZZZZZZZZZZZ' },
      query: {},
    });
    expect(await screen.findByTestId('not-found-view')).toBeInTheDocument();
    expect(get(breadcrumb)).toEqual([]);
  });

  it('refuses a person who may not read the repository with the words of the server', async () => {
    await useProfile('release');
    render(DocumentCompareView, { params: { ismsdocument: POLICY }, query: {} });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('in German', () => {
  it('words the page, the pairs and the sides in German', async () => {
    await open(POLICY, { from: 'v2', to: 'v3' }, 'de');
    const result = await screen.findByTestId('compare-result');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Freigaben von Information security policy vergleichen',
    );
    expect(result).toHaveTextContent('Was sich geändert hat');
    expect(result).toHaveTextContent('3 Änderungen');
    expect(screen.getByTestId('compare-side-from')).toHaveTextContent(
      'v2, 18.11.2025, Noor Haddad',
    );
    expect(screen.getByTestId('record-statements')).toHaveTextContent('Regelungen der Richtlinie');
    expect(screen.getByTestId('compare-show')).toHaveTextContent('Änderungen anzeigen');
  });
});
