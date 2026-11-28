import { render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { breadcrumb } from '../../stores/breadcrumb';
import { resetKit, useProfile, type Kit } from '../documents/testkit';
import IsmsView from './IsmsView.svelte';

/**
 * The lens ISMS, its documents (UC-ISMS-1), against the profiles of the mock (AUN-TEST-1): the types as the first column,
 * the documents of a type or of every type, the way into the risk register, and the persons who may read less. The day is
 * the mock's, 2026-11-26.
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
});

afterEach(resetKit);

const POLICY = '01JZB1C3E5G7J9M1P3R5T7W9Y2';
const ACCESS = '01JZB2D4F6H8K0N2Q4S6V8X0Z3';
const SECURE_DEVELOPMENT = '01JZB3E5G7J9M1P3R5T7W9Y1B4';
const AUDIT_2026 = '01JZB6H8K0N2Q4S6V8X0Z2C4E7';
const MANAGEMENT_REVIEW_H1 = '01JZB7J9M1P3R5T7W9Y1B3D5F8';

/**
 * @param profile `name` or `name#state`
 * @param route the route id
 * @param query the admitted query
 * @param params the values of the address
 * @param lang the language
 * @returns the kit and the navigation spy
 */
async function open(
  profile: string,
  route: string,
  query: Record<string, string> = {},
  params: Record<string, string> = {},
  lang: 'en' | 'de' = 'en',
): Promise<Kit & { onnavigate: ReturnType<typeof vi.fn> }> {
  const kit = await useProfile(profile, lang);
  const onnavigate = vi.fn();
  render(IsmsView, { route, params, query, onnavigate });
  return { ...kit, onnavigate };
}

describe('the types, the first column', () => {
  it('lists the four types with how many documents each holds and how many wait in review', async () => {
    await open('workshop', 'isms');
    const list = await screen.findByTestId('type-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByTestId('type-all')).toHaveTextContent('All documents');
    expect(screen.getByTestId('type-all')).toHaveTextContent('8 documents');
    expect(screen.getByTestId('type-all')).toHaveAttribute('href', '/isms/documents');
    const policy = screen.getByTestId('type-policy');
    expect(policy).toHaveAttribute('href', '/isms/documents?kind=policy');
    expect(policy).toHaveTextContent('Policy');
    expect(policy).toHaveTextContent('3 documents');
    expect(policy).toHaveTextContent('1 in review');
    expect(screen.getByTestId('type-isms-scope')).toHaveTextContent('Scope of the ISMS');
    expect(screen.getByTestId('type-isms-scope')).toHaveTextContent('One document');
    expect(screen.getByTestId('type-isms-scope')).not.toHaveTextContent('in review');
    expect(screen.getByTestId('type-audit-report')).toHaveTextContent('2 documents');
    expect(screen.getByTestId('type-management-review')).toHaveTextContent('Management review');
  });

  it('is the only column of the start address, and no risk type is among the document types', async () => {
    await open('workshop', 'isms');
    await screen.findByTestId('type-list');
    expect(screen.queryByTestId('documents-column')).toBeNull();
    expect(screen.queryByTestId('type-risk')).toBeNull();
    expect(get(breadcrumb)).toEqual([]);
  });

  it('leads to the risk register, which the next part of the lens builds', async () => {
    await open('workshop', 'isms');
    expect(await screen.findByTestId('register-link')).toHaveAttribute('href', '/isms/risks');
    expect(screen.getByTestId('register-link')).toHaveTextContent('Risk register');
  });

  it('tells a person who may not read the documents so, and still leads to the register', async () => {
    await open('release', 'isms');
    expect(await screen.findByTestId('isms-forbidden')).toHaveTextContent(
      'You may not read the ISMS documents',
    );
    expect(screen.queryByTestId('type-list')).toBeNull();
    expect(screen.getByTestId('register-link')).toBeInTheDocument();
  });

  it('tells an installation without a document what to do', async () => {
    await open('empty', 'isms');
    expect(await screen.findByTestId('types-empty')).toHaveTextContent('No ISMS documents yet');
    expect(screen.getByTestId('type-all')).toHaveTextContent('0 documents');
  });

  it('is written in German', async () => {
    await open('workshop', 'isms', {}, {}, 'de');
    expect(await screen.findByTestId('type-all')).toHaveTextContent('Alle Dokumente');
    expect(screen.getByTestId('type-policy')).toHaveTextContent('Richtlinie');
    expect(screen.getByTestId('type-policy')).toHaveTextContent('3 Dokumente');
    expect(screen.getByTestId('type-policy')).toHaveTextContent('1 in Prüfung');
    expect(screen.getByTestId('type-isms-scope')).toHaveTextContent('Geltungsbereich des ISMS');
    expect(screen.getByTestId('type-isms-scope')).toHaveTextContent('Ein Dokument');
    expect(screen.getByTestId('register-link')).toHaveTextContent('Risikoregister');
  });
});

describe('the documents of a type, the second column', () => {
  it('lists the documents of the type, newest change first, with the state and the last release', async () => {
    await open('workshop', 'isms.documents', { kind: 'policy' });
    const list = await screen.findByTestId('document-list');
    expect(
      within(list)
        .getAllByRole('link')
        .map((row) => row.getAttribute('data-testid')),
    ).toEqual([`document-${SECURE_DEVELOPMENT}`, `document-${POLICY}`, `document-${ACCESS}`]);
    const released = screen.getByTestId(`document-${POLICY}`);
    expect(released).toHaveAttribute('href', `/isms/documents/${POLICY}`);
    expect(released).toHaveTextContent('Information security policy');
    expect(released).toHaveTextContent('Released as v3');
    expect(released).toHaveTextContent('Last release v3, May 20, 2026');
    expect(released).not.toHaveTextContent('in work');
    expect(screen.getByTestId('documents-column')).toHaveTextContent('3 documents');
  });

  it('says of a document in review which release it holds and what is in work', async () => {
    await open('workshop', 'isms.documents', { kind: 'policy' });
    const row = await screen.findByTestId(`document-${SECURE_DEVELOPMENT}`);
    expect(row).toHaveTextContent('In review');
    expect(row).toHaveTextContent('Last release v1, Feb 12, 2026');
    expect(row).toHaveTextContent('Version 2 in work, changed Nov 25, 2026 by Jordan Weber');
  });

  it('says of a draft that was never released that nothing was released', async () => {
    await open('workshop', 'isms.documents', { kind: 'audit-report' });
    const row = await screen.findByTestId(`document-${AUDIT_2026}`);
    expect(row).toHaveTextContent('Draft');
    expect(row).not.toHaveTextContent('Last release');
    expect(row).toHaveTextContent('Version 1 in work, changed Nov 20, 2026 by Alex Example');
  });

  it('lists every type without a query, and names the type of each row', async () => {
    await open('workshop', 'isms.documents');
    const list = await screen.findByTestId('document-list');
    expect(within(list).getAllByRole('link')).toHaveLength(8);
    expect(screen.getByTestId(`document-${MANAGEMENT_REVIEW_H1}`)).toHaveTextContent(
      'Management review',
    );
    expect(screen.getByTestId('type-all')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('documents-column')).toHaveTextContent('All documents');
  });

  it('marks the open type in the first column and builds the breadcrumb', async () => {
    await open('workshop', 'isms.documents', { kind: 'audit-report' });
    await screen.findByTestId('document-list');
    expect(screen.getByTestId('type-audit-report')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('type-policy')).not.toHaveAttribute('aria-current');
    expect(get(breadcrumb).map((crumb) => crumb.label)).toEqual(['Audit report']);
    expect(get(breadcrumb)[0].href).toBe('/isms/documents?kind=audit-report');
  });

  it('lists nothing for a type the category does not have', async () => {
    await open('workshop', 'isms.documents', { kind: 'procedure' });
    expect(await screen.findByText('No documents yet')).toBeInTheDocument();
    expect(screen.queryByTestId('document-list')).toBeNull();
  });

  it('offers a new document of the type to a person who may edit', async () => {
    await open('workshop', 'isms.documents', { kind: 'policy' });
    const act = await screen.findByTestId('new-document');
    expect(act).toHaveAttribute('href', '/isms/documents/new?kind=policy');
    expect(act).toHaveTextContent('New document');
  });

  it('offers a new document without a type as the choice', async () => {
    await open('workshop', 'isms.documents');
    expect(await screen.findByTestId('new-document')).toHaveAttribute(
      'href',
      '/isms/documents/new',
    );
  });

  it('says why a person without the right edit cannot create one, and still reads', async () => {
    await open('read-only', 'isms.documents', { kind: 'policy' });
    await screen.findByTestId('document-list');
    expect(screen.queryByTestId('new-document')).toBeNull();
    expect(screen.getByText('Creating a document needs the edit right.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New document/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('refuses the list to a person who may not read the repository, in the place of the list', async () => {
    await open('release', 'isms.documents', { kind: 'policy' });
    expect(await screen.findAllByTestId('isms-forbidden')).toHaveLength(2);
    expect(screen.queryByTestId('document-list')).toBeNull();
  });

  it('reads the list again when the stream names a document of isms-core, and only then', async () => {
    const kit = await open('workshop', 'isms.documents', { kind: 'policy' });
    await screen.findByTestId('document-list');
    const reads = () => kit.requests.filter((r) => r === 'GET /api/v1/documents/isms-core').length;
    expect(reads()).toBe(1);
    kit.emit('document-saved', { repository: 'isms-register', id: 'R-004' });
    kit.emit('document-created', { repository: 'test-notes', id: 'x' });
    kit.emit('document-moved', { repository: 'isms-core', id: POLICY });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads()).toBe(1);
    kit.emit('document-created', { repository: 'isms-core', id: POLICY });
    await vi.waitFor(() => expect(reads()).toBe(2));
  });

  it('is written in German', async () => {
    await open('workshop', 'isms.documents', { kind: 'policy' }, {}, 'de');
    const row = await screen.findByTestId(`document-${SECURE_DEVELOPMENT}`);
    expect(row).toHaveTextContent('In Prüfung');
    expect(row).toHaveTextContent('Letzte Freigabe v1, 12.02.2026');
    expect(row).toHaveTextContent('Version 2 in Arbeit, geändert am 25.11.2026 von Jordan Weber');
    expect(screen.getByTestId(`document-${POLICY}`)).toHaveTextContent('Freigegeben als v3');
    expect(screen.getByTestId('new-document')).toHaveTextContent('Neues Dokument');
  });
});

describe('the document in the chain', () => {
  it('opens the document of the list as the last column and selects it', async () => {
    await open('workshop', 'isms.document', {}, { ismsdocument: POLICY });
    expect(await screen.findByTestId('document-sheet')).toBeInTheDocument();
    // The chain is types, the type of the document, the document: the type is known from the list before the read answers.
    await vi.waitFor(() =>
      expect(get(breadcrumb)[0]).toEqual({ label: 'Policy', href: '/isms/documents?kind=policy' }),
    );
    expect(get(breadcrumb).map((crumb) => crumb.label)).toEqual([
      'Policy',
      'Information security policy',
    ]);
  });

  it('is the not-found view for a document that does not exist', async () => {
    await open('workshop', 'isms.document', {}, { ismsdocument: '01JZZZZZZZZZZZZZZZZZZZZZZZ' });
    expect(await screen.findByTestId('not-found-view')).toBeInTheDocument();
    expect(get(breadcrumb)).toEqual([]);
  });

  it('refuses the document to a person who may not read the repository', async () => {
    await open('release', 'isms.document', {}, { ismsdocument: POLICY });
    expect((await screen.findAllByTestId('isms-forbidden')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('document-sheet')).toBeNull();
  });
});
