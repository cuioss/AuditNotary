import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { resetKit, useProfile, type Kit } from '../documents/testkit';
import IsmsView from './IsmsView.svelte';

/**
 * The sheet of an ISMS document (UC-ISMS-1) against the `isms-*` states of the `workshop` profile and against `read-only`
 * (AUN-TEST-1): the form of its type, the review date as a fact, the releases to compare, an earlier state, and the refusals
 * the sheet shares with every document (a conflict, a field refused, the Git server). The day is the mock's, 2026-11-26.
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
});

afterEach(resetKit);

const POLICY = '01JZB1C3E5G7J9M1P3R5T7W9Y2';
const ACCESS = '01JZB2D4F6H8K0N2Q4S6V8X0Z3';
const SECURE_DEVELOPMENT = '01JZB3E5G7J9M1P3R5T7W9Y1B4';
const SCOPE = '01JZB4F6H8K0N2Q4S6V8X0Z2C5';
const AUDIT_2025 = '01JZB5G7J9M1P3R5T7W9Y1B3D6';
const AUDIT_2026 = '01JZB6H8K0N2Q4S6V8X0Z2C4E7';
const MANAGEMENT_REVIEW_H1 = '01JZB7J9M1P3R5T7W9Y1B3D5F8';

/**
 * @param profile `name` or `name#state`
 * @param id the document
 * @param at an earlier state
 * @param lang the language
 * @returns the kit
 */
async function open(
  profile: string,
  id: string,
  at?: string,
  lang: 'en' | 'de' = 'en',
): Promise<Kit & { onnavigate: ReturnType<typeof vi.fn> }> {
  const kit = await useProfile(profile, lang);
  const onnavigate = vi.fn();
  render(IsmsView, {
    route: 'isms.document',
    params: { ismsdocument: id },
    query: at ? { at } : {},
    onnavigate,
  });
  await screen.findByTestId('document-sheet');
  return { ...kit, onnavigate };
}

const statements = () => screen.getByLabelText(/^Policy statements/);

const writes = (kit: Kit, method: string, path: string) =>
  kit.requests.filter((request) => request === `${method} ${path}`).length;

describe('reading a document', () => {
  it('shows the record of a policy: its type, state, version, last save and review date', async () => {
    await open('workshop', POLICY);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Information security policy',
    );
    expect(screen.getByTestId('document-state')).toHaveTextContent('Released as v3');
    const sheet = screen.getByTestId('document-sheet');
    expect(sheet).toHaveTextContent('Policy');
    expect(sheet).toHaveTextContent(/Version\s*3\s*Last saved/);
    expect(sheet).toHaveTextContent('Alex Example, May 20, 2026');
    expect(sheet).toHaveTextContent(/Review due\s*May 20, 2027/);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Information security policy');
    expect((statements() as HTMLTextAreaElement).value).toContain(
      'The management of the organisation',
    );
  });

  it('draws the form of every type from its schema, with the labels of the lens', async () => {
    const audit = await open('workshop', AUDIT_2025);
    expect(screen.getByLabelText(/^Year/)).toHaveValue(2025);
    expect(screen.getByText('Audit period')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Conclusion/)).toBeInTheDocument();
    expect(screen.getAllByText('Findings').length).toBeGreaterThan(0);
    expect(audit.requests).toContain('GET /api/v1/categories/isms/schema');
  });

  it('draws a management review with its decisions as a table', async () => {
    await open('workshop', MANAGEMENT_REVIEW_H1);
    expect(screen.getByLabelText(/^Held on/)).toBeInTheDocument();
    expect(screen.getAllByText('Decisions').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Inputs/)).toBeInTheDocument();
  });

  it('draws the scope with its exclusions', async () => {
    await open('workshop', SCOPE);
    expect(screen.getByLabelText(/^Boundaries of the ISMS/)).toBeInTheDocument();
    expect(screen.getAllByText('Exclusions').length).toBeGreaterThan(0);
  });

  it('reads for a person without the right edit: typeset, with no act, and says why', async () => {
    await open('read-only', POLICY);
    expect(screen.queryByTestId('save-everyone')).toBeNull();
    expect(screen.getByTestId('save-state')).toHaveTextContent(
      'You can read this document. Editing needs the edit right.',
    );
    expect(screen.queryByLabelText(/^Title/)).toBeNull();
  });

  it('says why a person who may not read the repository sees no sheet', async () => {
    await useProfile('release');
    render(IsmsView, {
      route: 'isms.document',
      params: { ismsdocument: POLICY },
      query: {},
      onnavigate: vi.fn(),
    });
    expect((await screen.findAllByTestId('isms-forbidden')).length).toBeGreaterThan(0);
  });
});

describe('the review date', () => {
  it('says that a review is due soon, in days, in words and without a colour of its own', async () => {
    await open('workshop', ACCESS);
    expect(screen.getByTestId('document-sheet')).toHaveTextContent(
      /Review due\s*Dec 8, 2026, in 12 days/,
    );
  });

  it('says that a review is overdue, and for how long', async () => {
    await open('workshop', SCOPE);
    expect(screen.getByTestId('document-sheet')).toHaveTextContent(
      /Review due\s*Nov 20, 2026, 6 days overdue/,
    );
  });

  it('shows no review fact for a document without a date', async () => {
    await open('workshop', AUDIT_2026);
    // The form has a field of that name; the fact is in the head of the sheet.
    expect(document.querySelector('.sheet-head__facts')).not.toHaveTextContent('Review due');
  });

  it('reads the date of an earlier state as it was, without a standing against today', async () => {
    await open('workshop', POLICY, 'v1');
    const sheet = screen.getByTestId('document-sheet');
    expect(sheet).toHaveTextContent(/Review due\s*Mar 10, 2026/);
    expect(sheet).not.toHaveTextContent('overdue');
  });

  it('is worded in German', async () => {
    await open('workshop', SCOPE, undefined, 'de');
    expect(screen.getByTestId('document-sheet')).toHaveTextContent(
      /Nächste Überprüfung\s*20\.11\.2026, seit 6 Tagen überfällig/,
    );
  });
});

describe('the releases to compare', () => {
  it('offers the latest pair of releases to compare', async () => {
    await open('workshop', POLICY);
    const link = await screen.findByTestId('compare-link');
    expect(link).toHaveAttribute('href', `/isms/documents/${POLICY}/compare?from=v2&to=v3`);
    expect(link).toHaveTextContent('Compare v2 and v3');
  });

  it('says that a document with one release cannot be compared yet', async () => {
    await open('workshop', AUDIT_2025);
    expect(await screen.findByTestId('compare-none')).toHaveTextContent(
      'A comparison needs two releases',
    );
    expect(screen.queryByTestId('compare-link')).toBeNull();
  });

  it('says the same for a document that was never released', async () => {
    await open('workshop', AUDIT_2026);
    expect(await screen.findByTestId('compare-none')).toBeInTheDocument();
  });

  it('keeps the offer while an earlier state is read', async () => {
    await open('workshop', POLICY, 'v1');
    expect(await screen.findByTestId('compare-link')).toBeInTheDocument();
  });

  it('is worded in German', async () => {
    await open('workshop', POLICY, undefined, 'de');
    expect(await screen.findByTestId('compare-link')).toHaveTextContent('v2 und v3 vergleichen');
  });
});

describe('the earlier states', () => {
  it('opens a release by its address on the lens, not on the generic one', async () => {
    const kit = await open('workshop', POLICY);
    const picker = await screen.findByTestId('revision-select');
    await vi.waitFor(() => expect(within(picker).getAllByRole('option').length).toBeGreaterThan(2));
    await fireEvent.change(picker, { target: { value: 'v2' } });
    expect(kit.onnavigate).toHaveBeenCalledWith(`/isms/documents/${POLICY}?at=v2`);
  });

  it('reads a release typeset and read-only, and leads back to the current state of the lens', async () => {
    await open('workshop', POLICY, 'v2');
    expect(screen.getByTestId('revision-notice')).toHaveTextContent(
      'You are reading an earlier state',
    );
    expect(screen.getByTestId('revision-notice')).toHaveTextContent('Released as v2');
    expect(screen.getByTestId('save-state')).toHaveTextContent(
      'An earlier state can be read only.',
    );
    expect(screen.queryByTestId('save-everyone')).toBeNull();
    expect(screen.queryByTestId('transition-bar')).toBeNull();
    expect(within(screen.getByTestId('revision-notice')).getByRole('link')).toHaveAttribute(
      'href',
      `/isms/documents/${POLICY}`,
    );
    expect(await screen.findByTestId('revision-back')).toHaveAttribute(
      'href',
      `/isms/documents/${POLICY}`,
    );
  });
});

describe('the steps of the workflow', () => {
  it('offers the release of a document in review as a link to the release page of the lens', async () => {
    await open('workshop', SECURE_DEVELOPMENT);
    expect(screen.getByTestId('document-state')).toHaveTextContent('In review');
    const release = screen.getByTestId('transition-isms.release');
    expect(release).toHaveAttribute('href', `/isms/documents/${SECURE_DEVELOPMENT}/release`);
    expect(release).toHaveTextContent(/^Release$/);
    expect(screen.getByTestId('step-up-note')).toHaveTextContent(
      'You confirm your identity once more before the release.',
    );
  });

  it('offers the submit of a draft and names it with the text of the category', async () => {
    await open('workshop', AUDIT_2026);
    expect(screen.getByTestId('transition-isms.submit')).toHaveTextContent('Submit for review');
  });

  it('lists the empty mandatory field of a refused submit, as a way to the field', async () => {
    await open('workshop', AUDIT_2026);
    await fireEvent.click(screen.getByTestId('transition-isms.submit'));
    const list = await screen.findByTestId('missing-fields');
    expect(list).toHaveTextContent('Go to Conclusion');
    await fireEvent.click(within(list).getByRole('button', { name: 'Go to Conclusion' }));
    expect(screen.getByLabelText(/^Conclusion/)).toHaveFocus();
  });

  it('says why the release is not offered to a person without the right approve', async () => {
    await open('read-only', SECURE_DEVELOPMENT);
    const release = screen.getByTestId('transition-isms.release');
    expect(release).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/approve/)).toBeInTheDocument();
  });
});

describe('the refusals', () => {
  it('shows a conflict of the statements with both versions, and lets the person decide', async () => {
    await open('workshop#isms-document-saved-by-other', POLICY);
    await fireEvent.input(statements(), { target: { value: 'My own statements.' } });
    await fireEvent.click(screen.getByTestId('save-everyone'));
    const conflict = await screen.findByTestId('conflict-/statements');
    expect(conflict).toHaveTextContent('Policy statements');
    expect(conflict).toHaveTextContent('My own statements.');
    expect(conflict).toHaveTextContent('Version of Jordan Weber');
    expect(screen.getByTestId('save-state')).toHaveAttribute('data-state', 'conflict');
    await fireEvent.click(screen.getByTestId('take-other-/statements'));
    expect(screen.queryByTestId('conflict-panel')).toBeNull();
  });

  it('marks the fields the server refused and keeps the text on the page', async () => {
    await open('workshop#isms-document-invalid', POLICY);
    await fireEvent.input(statements(), { target: { value: 'My own statements.' } });
    await fireEvent.click(screen.getByTestId('save-everyone'));
    expect(await screen.findByTestId('failure-notice')).toHaveTextContent(
      'Some entries are not valid. Correct the marked fields.',
    );
    expect(
      screen.getAllByText('This reference leads nowhere. Check it or choose another.').length,
    ).toBeGreaterThanOrEqual(1);
    expect(statements()).toHaveValue('My own statements.');
  });

  it('says that the Git server cannot be reached, and keeps the work', async () => {
    const kit = await open('workshop#isms-git-unavailable', POLICY);
    await fireEvent.input(statements(), { target: { value: 'My own statements.' } });
    await fireEvent.click(screen.getByTestId('save-everyone'));
    expect(await screen.findByTestId('failure-notice')).toHaveTextContent(
      'The Git server cannot be reached. Your work is kept; save again later.',
    );
    expect(statements()).toHaveValue('My own statements.');
    expect(writes(kit, 'POST', `/api/v1/documents/isms-core/${POLICY}/save`)).toBe(1);
  });

  it('leaves for the identity provider when the save asks for step-up, after keeping the draft', async () => {
    await open('workshop', POLICY);
    await fireEvent.input(statements(), { target: { value: 'My own statements.' } });
    vi.spyOn(apiClient, 'saveDocument').mockRejectedValue(
      new ApiError('STEP_UP_REQUIRED', 403, [], { stepUp: '/api/v1/auth/login?step-up=mfa' }),
    );
    const leave = vi.spyOn(apiClient, 'stepUp').mockImplementation(() => {});
    await fireEvent.click(screen.getByTestId('save-everyone'));
    await vi.waitFor(() => expect(leave).toHaveBeenCalledWith('/api/v1/auth/login?step-up=mfa'));
  });

  it('starts the next version when a released document is saved, and says so', async () => {
    await open('workshop', POLICY);
    await fireEvent.input(statements(), { target: { value: 'My own statements.' } });
    await fireEvent.click(screen.getByTestId('save-everyone'));
    expect(await screen.findByTestId('reopened-notice')).toHaveTextContent('Version 4 has begun');
    expect(screen.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  });
});
