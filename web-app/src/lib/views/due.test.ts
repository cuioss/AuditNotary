import { render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api/client';
import { parseHref } from '../routes';
import type { DueItem } from '../api/types';
import { N2, N4, N5, resetKit, useProfile } from './documents/testkit';
import DueView from './DueView.svelte';

/**
 * The Due lens with the items of the document lifecycle (UC-DOC-8, UC-DOC-9) against the `workshop` profile: a release
 * request shows who asked and the comment, for the person who asked and for the approver, each entry opens the address it
 * names, and the list follows the events of a request and of a document that moved along its workflow.
 */
afterEach(() => {
  vi.useRealTimers();
  resetKit();
});

/** @returns the entry of a document in the list */
function entryOf(title: string, lang: 'en' | 'de' = 'en'): HTMLElement {
  const name = lang === 'en' ? `Open ${title}` : `${title} öffnen`;
  return screen.getByRole('link', { name }).closest('li') as HTMLElement;
}

describe('the items of the generic documents lens', () => {
  it('shows the review of an approver and the request that came with it', async () => {
    await useProfile('workshop');
    render(DueView);
    await screen.findByTestId('due-list');
    const review = entryOf('Supplier security questionnaire');
    expect(review).toHaveAttribute('data-kind', 'review');
    expect(review).toHaveAttribute('data-lens', 'categories');
    expect(within(review).getByRole('link')).toHaveAttribute(
      'href',
      `/categories/test-note/${N4}/release`,
    );
    expect(review).toHaveTextContent('Review in Documents');
    // No request: the entry says nothing about one.
    expect(within(review).queryByTestId('due-request')).toBeNull();
    const requested = entryOf('Access review cadence');
    expect(within(requested).getByRole('link')).toHaveAttribute(
      'href',
      `/categories/test-note/${N5}/release`,
    );
    expect(within(requested).getByTestId('due-request')).toHaveTextContent(
      'Jordan Weber asked for the release.',
    );
    expect(within(requested).getByTestId('due-request')).toHaveTextContent(
      'Reviewed with the team; ready to release.',
    );
  });

  it('shows the own request of the person as theirs, and opens the document it names', async () => {
    await useProfile('workshop');
    render(DueView);
    await screen.findByTestId('due-list');
    const own = entryOf('Retention schedule for audit evidence');
    expect(own).toHaveAttribute('data-kind', 'release');
    // The document is still in its first state: the person submits it there.
    expect(within(own).getByRole('link')).toHaveAttribute('href', `/categories/test-note/${N2}`);
    expect(within(own).getByTestId('due-request')).toHaveTextContent('You asked for the release.');
    expect(within(own).getByTestId('due-request')).toHaveTextContent(
      'Written from the interview notes; please submit it and release it.',
    );
  });

  it('is read in German', async () => {
    await useProfile('workshop', 'de');
    render(DueView);
    await screen.findByTestId('due-list');
    expect(entryOf('Access review cadence', 'de')).toHaveTextContent(
      'Jordan Weber hat um die Freigabe gebeten.',
    );
    expect(entryOf('Retention schedule for audit evidence', 'de')).toHaveTextContent(
      'Sie haben um die Freigabe gebeten.',
    );
  });

  it('shows a request with an empty comment, and no request on an item that has none', async () => {
    const items: DueItem[] = [
      {
        kind: 'release',
        lens: 'categories',
        title: 'Threat model review',
        address: `/categories/test-note/${N4}/release`,
        due: '2026-12-01',
        requestId: 'rr-1',
        requestedBy: { pseudonym: 'p-9', name: 'Pat Agent' },
        requestedAt: '2026-11-26T08:00:00Z',
        comment: '',
      },
      {
        kind: 'review',
        lens: 'samm',
        title: 'Payments 2026 Q4',
        address: '/samm/payments/2026-q4/release',
        due: '2026-12-02',
      },
    ];
    await useProfile('workshop');
    vi.spyOn(apiClient, 'getDue').mockResolvedValue({ items });
    render(DueView);
    await screen.findByTestId('due-list');
    expect(within(entryOf('Threat model review')).getByTestId('due-request')).toHaveTextContent(
      'Pat Agent asked for the release.',
    );
    expect(within(entryOf('Payments 2026 Q4')).queryByTestId('due-request')).toBeNull();
  });
});

describe('the deadlines of an incident', () => {
  const CARD = '01JZ9T4M6Q8S0V2X4B6D8F0H2K';

  it('words the deadline in the language of the person and opens the notifications of the incident', async () => {
    // The mock's day, so that a deadline that is open there stays open on the day the suite runs.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
    await useProfile('workshop');
    render(DueView);
    await screen.findByTestId('due-list');
    const missed = entryOf(
      'Card data exposed in the checkout log: Notice to the supervisory authority',
    );
    expect(missed).toHaveAttribute('data-kind', 'deadline');
    expect(missed).toHaveAttribute('data-lens', 'incidents');
    expect(within(missed).getByRole('link')).toHaveAttribute(
      'href',
      `/incidents/2026/${CARD}?stage=notifications`,
    );
    // A deadline that is missed is overdue, and needs the person.
    expect(within(missed).getByTestId('due-overdue')).toBeInTheDocument();
    // A deadline that is still open names its day quietly.
    const open = entryOf(
      'Phishing mail with a forged payment link: Notice to the supervisory authority',
    );
    expect(within(open).queryByTestId('due-overdue')).toBeNull();
  });

  it('is read in German', async () => {
    await useProfile('workshop', 'de');
    render(DueView);
    await screen.findByTestId('due-list');
    expect(
      entryOf('Card data exposed in the checkout log: Meldung an die Aufsichtsbehörde', 'de'),
    ).toHaveAttribute('data-lens', 'incidents');
  });

  it('keeps the title of the server for a deadline whose title does not end in its rule', async () => {
    await useProfile('workshop');
    const item = {
      kind: 'deadline',
      lens: 'incidents',
      title: 'Something else',
      address: `/incidents/2026/${CARD}?stage=notifications`,
      due: '2026-12-01',
      deadline: { rule: 'gdpr-art33', status: 'OPEN' },
    } satisfies DueItem;
    vi.spyOn(apiClient, 'getDue').mockResolvedValue({ items: [item] });
    render(DueView);
    await screen.findByTestId('due-list');
    expect(screen.getByRole('link', { name: 'Open Something else' })).toBeInTheDocument();
  });
});

describe('the events', () => {
  it('reads the list again when a release was requested or a document moved along its workflow', async () => {
    const kit = await useProfile('workshop');
    render(DueView);
    await screen.findByTestId('due-list');
    const reads = () => kit.requests.filter((request) => request === 'GET /api/v1/due').length;
    expect(reads()).toBe(1);
    kit.emit('release-requested', { repository: 'test-notes', id: N4, requestId: 'rr-9' });
    await vi.waitFor(() => expect(reads()).toBe(2));
    kit.emit('document-transitioned', { repository: 'test-notes', id: N4 });
    await vi.waitFor(() => expect(reads()).toBe(3));
    kit.emit('document-saved', { repository: 'test-notes', id: N4, fields: [] });
    expect(reads()).toBe(3);
  });

  it('drops the request once the release is made', async () => {
    const kit = await useProfile('workshop#note-release-request-done');
    render(DueView);
    await screen.findByTestId('due-list');
    expect(screen.queryByRole('link', { name: 'Open Access review cadence' })).toBeNull();
    expect(kit.scenario.state()).toBe('note-release-request-done');
  });

  it('keeps the list when a read after an event fails, and stops listening when it is left', async () => {
    const kit = await useProfile('workshop');
    const view = render(DueView);
    await screen.findByTestId('due-list');
    vi.spyOn(apiClient, 'getDue').mockRejectedValueOnce(new Error('network'));
    kit.emit('release-requested', { repository: 'test-notes', id: N4, requestId: 'rr-9' });
    await vi.waitFor(() => expect(apiClient.getDue).toHaveBeenCalled());
    expect(screen.getByTestId('due-list')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    view.unmount();
  });
});

describe('the reviews of the ISMS', () => {
  const SCOPE = '01JZB4F6H8K0N2Q4S6V8X0Z2C5';
  const ACCESS = '01JZB2D4F6H8K0N2Q4S6V8X0Z3';

  it('opens the documents of the lens ISMS, which are views of the app', async () => {
    // The mock's day, so that the review dates read the same on every day the suite runs.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
    await useProfile('workshop');
    render(DueView);
    await screen.findByTestId('due-list');
    for (const [title, id] of [
      ['Scope of the ISMS', SCOPE],
      ['Access control policy', ACCESS],
    ]) {
      const entry = entryOf(title);
      expect(entry).toHaveAttribute('data-kind', 'review');
      expect(entry).toHaveAttribute('data-lens', 'isms');
      expect(within(entry).getByRole('link')).toHaveAttribute('href', `/isms/documents/${id}`);
      expect(parseHref(`/isms/documents/${id}`)?.route).toBe('isms.document');
    }
    expect(entryOf('Scope of the ISMS')).toHaveTextContent('Review in ISMS');
  });

  it('opens the risks of the register at an address the app knows', async () => {
    await useProfile('workshop');
    render(DueView);
    await screen.findByTestId('due-list');
    const risk = entryOf('Risk R-007: Signing keys held by a single administrator');
    expect(within(risk).getByRole('link')).toHaveAttribute('href', '/isms/risks/r-007');
    expect(parseHref('/isms/risks/r-007')?.route).toBe('isms.risk');
  });

  it('is read in German', async () => {
    await useProfile('workshop', 'de');
    render(DueView);
    await screen.findByTestId('due-list');
    expect(entryOf('Scope of the ISMS', 'de')).toHaveTextContent('Prüfung in ISMS');
  });
});
