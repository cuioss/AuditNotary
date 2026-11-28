import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { categoryList } from '../../documents/categories';
import { status } from '../../stores/app';
import { breadcrumb } from '../../stores/breadcrumb';
import { resetKit, useProfile, type Kit } from '../documents/testkit';
import IsmsDocumentReleaseView from './IsmsDocumentReleaseView.svelte';

/**
 * The release of an ISMS document (UC-ISMS-1; AUN-WEB-6) against the `isms-document-*` states of the `workshop` profile
 * (AUN-TEST-1): the review with the diff since the last release, the release with its step-up, the seal, and the addresses
 * that are no release. The refusals every release shares are the generic flow's tests.
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-11-26T10:00:00Z'));
});

afterEach(() => {
  resetKit();
  categoryList.set(null);
});

const POLICY = '01JZB1C3E5G7J9M1P3R5T7W9Y2';
const SECURE_DEVELOPMENT = '01JZB3E5G7J9M1P3R5T7W9Y1B4';
const AUDIT_2026 = '01JZB6H8K0N2Q4S6V8X0Z2C4E7';

/**
 * @param profile `name` or `name#state`
 * @param id the document
 * @param lang the language
 * @returns the kit
 */
async function open(profile: string, id: string, lang: 'en' | 'de' = 'en'): Promise<Kit> {
  const kit = await useProfile(profile, lang);
  status.set(await apiClient.getStatus());
  render(IsmsDocumentReleaseView, { params: { ismsdocument: id } });
  await screen.findByTestId('release-view');
  return kit;
}

describe('the review', () => {
  it('shows what is released: the document, the changes since the last release and the checks', async () => {
    await open('workshop', SECURE_DEVELOPMENT);
    await screen.findByTestId('release-record');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Release Secure development policy',
    );
    expect(screen.getByTestId('release-act')).toHaveTextContent(/^Release$/);
    expect(screen.getByTestId('release-facts')).toHaveTextContent('Version 2');
    expect(screen.getByTestId('release-facts')).toHaveTextContent('Jordan Weber');
    expect(screen.getByText('Changes since v1.')).toBeInTheDocument();
    const statements = screen.getByTestId('record-statements');
    expect(statements).toHaveTextContent('Policy statements');
    expect(statements).toHaveTextContent('one change');
    expect(statements.querySelectorAll('del')).toHaveLength(1);
    expect(statements.querySelector('ins')).toHaveTextContent('A threat model exists');
    expect(screen.getByTestId('record-applies-to')).toHaveTextContent('Applies to');
    expect(screen.getByText('Every mandatory field is filled in')).toBeInTheDocument();
    expect(screen.getByText(/Submitted for review by Jordan Weber/)).toBeInTheDocument();
    expect(
      screen.getByText('You confirm your identity once more before the release.'),
    ).toBeInTheDocument();
  });

  it('reads a list of references as the form reads it, by the title and never by the reference', async () => {
    await open('workshop', SECURE_DEVELOPMENT);
    await screen.findByTestId('release-record');
    const applies = screen.getByTestId('record-applies-to');
    await vi.waitFor(() => expect(applies).toHaveTextContent('Mobile Apps'));
    expect(applies).not.toHaveTextContent('team:');
  });

  it('draws the lens in the breadcrumb and leads back to the document of the lens', async () => {
    await open('workshop', SECURE_DEVELOPMENT);
    await screen.findByTestId('release-record');
    expect(get(breadcrumb)).toEqual([
      { label: 'ISMS documents', href: '/isms/documents' },
      { label: 'Secure development policy', href: `/isms/documents/${SECURE_DEVELOPMENT}` },
      { label: 'Release', href: `/isms/documents/${SECURE_DEVELOPMENT}/release` },
    ]);
    expect(screen.getByTestId('release-back')).toHaveAttribute(
      'href',
      `/isms/documents/${SECURE_DEVELOPMENT}`,
    );
  });

  it('reads a document that was never released from nothing: every field is new', async () => {
    await open('workshop', AUDIT_2026);
    await screen.findByTestId('release-record');
    expect(screen.getByText(/The first release: everything in the document/)).toBeInTheDocument();
    expect(screen.getByTestId('release-record').querySelectorAll('del')).toHaveLength(0);
    // A draft is submitted first: the act says so and stays reachable.
    expect(screen.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Submit the document for review first.')).toBeInTheDocument();
  });

  it('says that a released document has nothing to release, and offers no promise of a seal', async () => {
    await open('workshop', POLICY);
    await screen.findByTestId('release-record');
    expect(screen.getByText('Nothing changed since v3.')).toBeInTheDocument();
    expect(screen.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('This document is released already.')).toBeInTheDocument();
    expect(
      screen.queryByText('The release is signed in your name and tagged.'),
    ).not.toBeInTheDocument();
  });

  it('says why a person without the right approve cannot release', async () => {
    await open('read-only', SECURE_DEVELOPMENT);
    await screen.findByTestId('release-record');
    expect(screen.getByTestId('release-act')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/approve/)).toBeInTheDocument();
  });

  it('is read in German with the words of the domain only', async () => {
    await open('workshop', SECURE_DEVELOPMENT, 'de');
    await screen.findByTestId('release-record');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Secure development policy freigeben',
    );
    expect(screen.getByTestId('release-act')).toHaveTextContent(/^Freigeben$/);
    expect(screen.getByText('Änderungen seit v1.')).toBeInTheDocument();
    expect(
      screen.getByText('Vor der Freigabe bestätigen Sie noch einmal Ihre Identität.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('record-statements')).toHaveTextContent('Regelungen der Richtlinie');
  });
});

describe('the release', () => {
  it('steps up with the identity provider first, then presses the seal of the new version', async () => {
    const kit = await open('workshop#isms-document-release-step-up', SECURE_DEVELOPMENT);
    await screen.findByTestId('release-record');
    const stepUp = vi.spyOn(apiClient, 'stepUp').mockImplementation(() => {});
    await fireEvent.click(screen.getByTestId('release-act'));
    await vi.waitFor(() => expect(stepUp).toHaveBeenCalledWith('/api/v1/auth/login?step-up=mfa'));
    expect(kit.scenario.state()).toBe('isms-document-release-stepped-up');
    expect(screen.queryByTestId('release-done')).toBeNull();
    await fireEvent.click(screen.getByTestId('release-act'));
    expect(await screen.findByTestId('release-done')).toHaveTextContent('Released as v2');
    expect(kit.scenario.state()).toBe('isms-document-released');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Secure development policy is released',
    );
    const seal = screen.getByTestId('release-seal');
    expect(seal).toHaveAttribute('data-sealed', 'v2');
    expect(within(seal).getByRole('img')).toHaveAccessibleName(
      'Seal of the release of Secure development policy: v2',
    );
    expect(screen.getByTestId('release-tag')).toHaveTextContent(
      `policies/${SECURE_DEVELOPMENT}/v2`,
    );
    expect(screen.getByTestId('release-open')).toHaveAttribute(
      'href',
      `/isms/documents/${SECURE_DEVELOPMENT}`,
    );
    expect(screen.getByTestId('release-open')).toHaveTextContent('Open the released document');
    expect(screen.queryByTestId('release-act')).toBeNull();
    // A finished release is a calm surface: the notary stands beside the seal.
    expect(document.querySelector('.stage__mascot')).not.toBeNull();
  });

  it('releases in the base state with the link of the mock, which sends one release', async () => {
    const kit = await open('workshop', SECURE_DEVELOPMENT);
    await screen.findByTestId('release-record');
    vi.spyOn(apiClient, 'stepUp').mockImplementation(() => {});
    await fireEvent.click(screen.getByTestId('release-act'));
    expect(await screen.findByTestId('release-done')).toBeInTheDocument();
    expect(kit.scenario.state()).toBe('isms-document-released');
    expect(
      kit.requests.filter(
        (request) => request === `POST /api/v1/releases/isms-core/${SECURE_DEVELOPMENT}`,
      ),
    ).toHaveLength(1);
  });

  it('says that the Git server cannot be reached, and releases nothing', async () => {
    await open('workshop#isms-git-unavailable', SECURE_DEVELOPMENT);
    await screen.findByTestId('release-record');
    await fireEvent.click(screen.getByTestId('release-act'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The Git server cannot be reached. Nothing was released; release again later.',
    );
    expect(screen.queryByTestId('release-done')).toBeNull();
  });
});

describe('the addresses that are no release', () => {
  it('is the not-found view for a document that does not exist', async () => {
    await useProfile('workshop');
    render(IsmsDocumentReleaseView, { params: { ismsdocument: '01JZZZZZZZZZZZZZZZZZZZZZZZ' } });
    expect(await screen.findByTestId('not-found-view')).toBeInTheDocument();
    expect(get(breadcrumb)).toEqual([]);
  });

  it('is the not-found view for a risk number, which is no document of isms-core', async () => {
    await useProfile('workshop');
    render(IsmsDocumentReleaseView, { params: { ismsdocument: 'R-018' } });
    expect(await screen.findByTestId('not-found-view')).toBeInTheDocument();
  });
});
