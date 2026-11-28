import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  callback: null as null | ((navigation: unknown) => void),
  goto: vi.fn(),
}));

vi.mock('$app/navigation', () => ({
  beforeNavigate: (callback: (navigation: unknown) => void) => {
    navigation.callback = callback;
  },
  afterNavigate: () => {},
  goto: navigation.goto,
}));

import { get } from 'svelte/store';
import { breadcrumb } from '../../stores/breadcrumb';
import { resetKit, useProfile, type Kit } from '../documents/testkit';
import IsmsView from './IsmsView.svelte';

/**
 * A new ISMS document (UC-ISMS-1) against the `workshop` and `read-only` profiles (AUN-TEST-1): the form of the type with its
 * value held in the page, the first save, its refusals, the choice among the four types, and the question before the page is
 * left.
 */
const CREATED = '/isms/documents/01JZB9M1P3R5T7W9Y1B3D5F7H0';

beforeEach(() => {
  navigation.callback = null;
  navigation.goto.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
});

afterEach(resetKit);

/** Opens the new-document address of the lens. */
async function open(
  profile = 'workshop',
  query: Record<string, string> = { kind: 'policy' },
  lang: 'en' | 'de' = 'en',
): Promise<Kit & { onnavigate: ReturnType<typeof vi.fn> }> {
  const kit = await useProfile(profile, lang);
  const onnavigate = vi.fn();
  render(IsmsView, { route: 'isms.documents.new', params: {}, query, onnavigate });
  return { ...kit, onnavigate };
}

const title = () => screen.getByLabelText(/^Title/);

describe('the form of a new document', () => {
  it('shows the empty form of the type, and nothing to save yet', async () => {
    await open();
    expect(await screen.findByTestId('new-document-sheet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('New Policy');
    expect(screen.getByText('Nothing is stored before the first save.')).toBeInTheDocument();
    expect(screen.getByTestId('save-everyone')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText(/^Policy statements/)).toBeInTheDocument();
  });

  it('puts the form in the chain of its type, so that the way back is the list of that type', async () => {
    await open();
    await screen.findByTestId('new-document-sheet');
    expect(get(breadcrumb)).toEqual([
      { label: 'Policy', href: '/isms/documents?kind=policy' },
      { label: 'New document', href: '/isms/documents/new?kind=policy' },
    ]);
  });

  it('holds what is typed in the page and writes nothing before the first save', async () => {
    const kit = await open();
    await screen.findByTestId('new-document-sheet');
    await fireEvent.input(title(), { target: { value: 'Incident communication policy' } });
    expect(
      kit.requests.filter((request) => request.startsWith('PUT') || request.startsWith('POST')),
    ).toEqual([]);
  });

  it('creates the document with the first save, in isms-core, and moves to its address in place of this one', async () => {
    const kit = await open();
    await screen.findByTestId('new-document-sheet');
    await fireEvent.input(title(), { target: { value: 'Incident communication policy' } });
    await fireEvent.click(screen.getByTestId('save-everyone'));
    await vi.waitFor(() => expect(kit.onnavigate).toHaveBeenCalledWith(CREATED, { replace: true }));
    expect(kit.bodies).toContainEqual({
      request: 'POST /api/v1/documents/isms-core',
      body: {
        kind: 'policy',
        parts: { data: { fields: { '/title': 'Incident communication policy' } } },
      },
    });
  });

  it('creates a document of another type with that type', async () => {
    const kit = await open('workshop', { kind: 'audit-report' });
    await screen.findByTestId('new-document-sheet');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('New Audit report');
    await fireEvent.input(title(), { target: { value: 'Internal audit 2027' } });
    await fireEvent.click(screen.getByTestId('save-everyone'));
    await vi.waitFor(() => expect(kit.onnavigate).toHaveBeenCalled());
    expect(kit.bodies[0].body).toMatchObject({ kind: 'audit-report' });
  });

  it('asks before the page is left with what was typed, and not after the first save', async () => {
    const kit = await open();
    await screen.findByTestId('new-document-sheet');
    await fireEvent.input(title(), { target: { value: 'Incident communication policy' } });
    const leaving = { cancel: vi.fn(), willUnload: false, to: { url: new URL('http://x/y') } };
    navigation.callback!(leaving);
    expect(leaving.cancel).toHaveBeenCalled();
    expect(await screen.findByText('Leave this page?')).toBeInTheDocument();
    await fireEvent.click(screen.getByTestId('leave-stay'));
    await fireEvent.click(screen.getByTestId('save-everyone'));
    await vi.waitFor(() => expect(kit.onnavigate).toHaveBeenCalled());
    const after = { cancel: vi.fn(), willUnload: false, to: { url: new URL('http://x/y') } };
    navigation.callback!(after);
    expect(after.cancel).not.toHaveBeenCalled();
  });

  it('says that the Git server cannot be reached and keeps the text on the page', async () => {
    const kit = await open('workshop#isms-git-unavailable');
    await screen.findByTestId('new-document-sheet');
    await fireEvent.input(title(), { target: { value: 'Incident communication policy' } });
    await fireEvent.click(screen.getByTestId('save-everyone'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The Git server cannot be reached. Your work is kept; save again later.',
    );
    expect(title()).toHaveValue('Incident communication policy');
    expect(kit.onnavigate).not.toHaveBeenCalled();
  });

  it('is written in German', async () => {
    await open('workshop', { kind: 'isms-scope' }, 'de');
    await screen.findByTestId('new-document-sheet');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Neu: Geltungsbereich des ISMS',
    );
    expect(screen.getByLabelText(/^Grenzen des ISMS/)).toBeInTheDocument();
    expect(screen.getByTestId('save-everyone')).toHaveTextContent('Für alle speichern');
  });
});

describe('the choice of a type', () => {
  it('offers the four types of the category, each as a way to its form', async () => {
    await open('workshop', {});
    const choice = await screen.findByTestId('new-document-choice');
    const links = within(choice).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/isms/documents/new?kind=policy',
      '/isms/documents/new?kind=isms-scope',
      '/isms/documents/new?kind=audit-report',
      '/isms/documents/new?kind=management-review',
    ]);
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Policy',
      'Scope of the ISMS',
      'Audit report',
      'Management review',
    ]);
  });
});

describe('what the person may not do, and what does not exist', () => {
  it('tells a person without the right edit, and leads back to the documents', async () => {
    await open('read-only');
    const sheet = await screen.findByTestId('new-document-sheet');
    expect(sheet).toHaveTextContent('Creating a document needs the edit right.');
    expect(within(sheet).getByRole('link')).toHaveAttribute('href', '/isms/documents');
  });

  it('is the not-found view for a type the lens does not have, and for the risk', async () => {
    await open('workshop', { kind: 'procedure' });
    expect(await screen.findByTestId('not-found-view')).toBeInTheDocument();
  });

  it('does not offer a risk as a document: its register is the next part of the lens', async () => {
    await open('workshop', { kind: 'risk' });
    expect(await screen.findByTestId('not-found-view')).toBeInTheDocument();
  });
});
