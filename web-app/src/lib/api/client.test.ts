import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClient,
  CSRF_HEADER,
  STREAM_RETRY_LIMIT,
  parseSseChunk,
  type StreamState,
} from './client';
import { ApiError } from './errors';

/** A JSON answer. */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** An event-stream answer that sends the given frames and stays open until aborted. */
function stream(frames: string[], signal?: AbortSignal | null): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      signal?.addEventListener('abort', () =>
        controller.error(new DOMException('aborted', 'AbortError')),
      );
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const SESSION = {
  user: { pseudonym: 'p-1', name: 'Alex' },
  rights: [],
  csrfToken: 'token-1',
  firstLoginRequired: false,
};

let fetchMock: ReturnType<typeof vi.fn>;
let navigate: ReturnType<typeof vi.fn>;
let client: ApiClient;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  navigate = vi.fn();
  client = new ApiClient(navigate as unknown as (address: string) => void);
  window.history.replaceState(null, '', '/samm/payments?x=1');
});

afterEach(() => {
  client.closeEvents();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('requests', () => {
  it('reads the status, the texts, the due list, the prefill and the catalogs with GET', async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await client.getStatus();
    await client.getMessages('de');
    await client.getDue();
    await client.getDirectoryMe();
    await client.getCatalog('team');
    const paths = fetchMock.mock.calls.map((call) => call[0]);
    expect(paths).toEqual([
      '/api/v1/status',
      '/api/v1/messages?lang=de',
      '/api/v1/due',
      '/api/v1/directory/me',
      '/api/v1/catalogs/team',
    ]);
    for (const call of fetchMock.mock.calls) {
      expect(call[1].method).toBe('GET');
      expect(call[1].headers[CSRF_HEADER]).toBeUndefined();
    }
  });

  it('reads the session first and sends its token with a state-changing request', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(200, { outcome: 'SAVED', pseudonym: 'p-2' }));
    const saved = await client.putDirectoryMe({ name: 'Alex', team: 't', role: 'r' });
    expect(saved.pseudonym).toBe('p-2');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/session');
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/v1/directory/me');
    expect(init.method).toBe('PUT');
    expect(init.headers[CSRF_HEADER]).toBe('token-1');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'Alex', team: 't', role: 'r' });
  });

  it('follows the login address of a 401 with the current address as return', async () => {
    fetchMock.mockResolvedValue(
      json(401, { outcome: 'UNAUTHENTICATED', login: '/api/v1/auth/login' }),
    );
    await expect(client.getDue()).rejects.toMatchObject({ outcome: 'UNAUTHENTICATED' });
    expect(navigate).toHaveBeenCalledWith(
      `/api/v1/auth/login?return=${encodeURIComponent('/samm/payments?x=1')}`,
    );
  });

  it('does not leave for the login on a 401 INVALID_CREDENTIALS', async () => {
    fetchMock.mockResolvedValue(json(401, { outcome: 'INVALID_CREDENTIALS' }));
    await expect(client.getDue()).rejects.toMatchObject({
      outcome: 'INVALID_CREDENTIALS',
      status: 401,
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('never follows a login address of another origin', () => {
    expect(client.loginAddress('https://evil.example/login')).toMatch(
      /^\/api\/v1\/auth\/login\?return=/,
    );
    expect(client.loginAddress('/login?x=1')).toMatch(/^\/login\?x=1&return=/);
  });

  it('reports refusals by their outcome with the field errors', async () => {
    fetchMock.mockResolvedValueOnce(json(200, SESSION)).mockResolvedValueOnce(
      json(422, {
        outcome: 'VALIDATION',
        errors: [{ pointer: '/team', code: 'REFERENCE_NOT_FOUND' }],
      }),
    );
    const error = (await client
      .putDirectoryMe({ name: 'a', team: 'x', role: 'y' })
      .catch((caught: unknown) => caught)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.outcome).toBe('VALIDATION');
    expect(error.status).toBe(422);
    expect(error.errors).toEqual([{ pointer: '/team', code: 'REFERENCE_NOT_FOUND' }]);
  });

  it('reads the session again after a CSRF refusal', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(403, { outcome: 'CSRF_REJECTED' }))
      .mockResolvedValueOnce(json(200, { ...SESSION, csrfToken: 'token-2' }))
      .mockResolvedValueOnce(json(200, { outcome: 'SAVED', pseudonym: 'p' }));
    await expect(client.putDirectoryMe({ name: 'a', team: 'b', role: 'c' })).rejects.toMatchObject({
      outcome: 'CSRF_REJECTED',
    });
    await client.putDirectoryMe({ name: 'a', team: 'b', role: 'c' });
    expect(fetchMock.mock.calls[3][1].headers[CSRF_HEADER]).toBe('token-2');
  });

  it('names an answer without an outcome UNEXPECTED, and a missing network NETWORK', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 500 }));
    await expect(client.getDue()).rejects.toMatchObject({ outcome: 'UNEXPECTED', status: 500 });
    fetchMock.mockRejectedValueOnce(new TypeError('failed'));
    await expect(client.getDue()).rejects.toMatchObject({ outcome: 'NETWORK', status: 0 });
    fetchMock.mockRejectedValueOnce(new DOMException('slow', 'TimeoutError'));
    await expect(client.getDue()).rejects.toMatchObject({ outcome: 'TIMEOUT' });
  });

  it('answers null for an empty body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    await expect(client.getDue()).resolves.toBeNull();
  });

  it('refuses a path that could leave the origin', async () => {
    await expect(client.request('GET', '//evil.example/x')).rejects.toThrow('refused request path');
    await expect(client.request('GET', '/other')).rejects.toThrow('refused request path');
  });

  it('logs out and leaves for the address the server names', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(200, { redirect: 'https://idp.example/logout' }));
    await client.logout();
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(navigate).toHaveBeenCalledWith('https://idp.example/logout');
  });
});

describe('the form kit requests (rest-api.adoc, Form Kit Requests)', () => {
  it('reads the schema of a category, any catalog, the persons and one person with GET', async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await client.getCategorySchema('test-note');
    await client.getCatalog('service');
    await client.listPersons();
    await client.listPersons('');
    await client.listPersons('Mira Haas');
    await client.getPerson('p-7d52e8');
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
      ['/api/v1/categories/test-note/schema', 'GET'],
      ['/api/v1/catalogs/service', 'GET'],
      ['/api/v1/directory/persons', 'GET'],
      ['/api/v1/directory/persons', 'GET'],
      ['/api/v1/directory/persons?q=Mira%20Haas', 'GET'],
      ['/api/v1/directory/persons/p-7d52e8', 'GET'],
    ]);
  });

  it('posts the source for the preview with the anti-CSRF header', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(200, { html: '<p>x</p>' }));
    expect(await client.renderAsciiDoc('x')).toEqual({ html: '<p>x</p>' });
    const call = fetchMock.mock.calls[1];
    expect(call[0]).toBe('/api/v1/render/asciidoc');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers[CSRF_HEADER]).toBe('token-1');
    expect(JSON.parse(call[1].body)).toEqual({ source: 'x' });
  });

  it('reports the refusals of the preview and of a missing object by their outcome', async () => {
    fetchMock.mockResolvedValueOnce(json(200, SESSION));
    fetchMock.mockResolvedValueOnce(json(413, { outcome: 'TOO_LARGE', limit: 65_536 }));
    fetchMock.mockResolvedValueOnce(json(503, { outcome: 'RENDER_UNAVAILABLE' }));
    fetchMock.mockResolvedValueOnce(json(404, { outcome: 'NOT_FOUND' }));
    await expect(client.renderAsciiDoc('x')).rejects.toMatchObject({
      outcome: 'TOO_LARGE',
      details: { limit: 65_536 },
    });
    await expect(client.renderAsciiDoc('x')).rejects.toMatchObject({
      outcome: 'RENDER_UNAVAILABLE',
    });
    await expect(client.getPerson('p-3b9d00')).rejects.toMatchObject({
      outcome: 'NOT_FOUND',
      status: 404,
    });
  });

  it('resolves references with one encoded ref each, and splits more than fifty into several requests', async () => {
    fetchMock.mockImplementation(async (path: string) => {
      const refs = new URL(path, 'http://localhost').searchParams.getAll('ref');
      return json(200, {
        references: refs.map((ref) => ({
          ref,
          found: true,
          title: ref,
          address: null,
          retired: false,
        })),
      });
    });
    const answers = await client.resolveReferences(['isms-register:risk/R-1#a b', 'service:x']);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/references/resolve?ref=isms-register%3Arisk%2FR-1%23a%20b&ref=service%3Ax',
    );
    expect(answers.map((answer) => answer.ref)).toEqual([
      'isms-register:risk/R-1#a b',
      'service:x',
    ]);
    fetchMock.mockClear();
    const many = Array.from({ length: 120 }, (_, index) => `service:s-${index}`);
    expect(await client.resolveReferences(many)).toHaveLength(120);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockClear();
    expect(await client.resolveReferences([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the catalog requests (rest-api.adoc, Directory and Catalog Requests)', () => {
  it('reads the schema and one entry with GET, the segments encoded', async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await client.getCatalogSchema('service');
    await client.getCatalogEntry('service', 'payment-api');
    await client.getCatalogEntry('team', 'a b');
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
      ['/api/v1/catalogs/service/schema', 'GET'],
      ['/api/v1/catalogs/service/payment-api', 'GET'],
      ['/api/v1/catalogs/team/a%20b', 'GET'],
    ]);
  });

  it('creates, changes and retires with the anti-CSRF header, and sends the entry as value', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(201, { outcome: 'CREATED', address: '/catalogs/team/x' }))
      .mockResolvedValueOnce(json(200, { outcome: 'SAVED' }))
      .mockResolvedValueOnce(json(200, { outcome: 'RETIRED' }));
    await client.createCatalogEntry('team', { id: 'x', name: 'X' });
    await client.changeCatalogEntry('team', 'x', { id: 'x', name: 'Y' });
    await client.retireCatalogEntry('team', 'x');
    const calls = fetchMock.mock.calls.slice(1);
    expect(calls.map((call) => [call[0], call[1].method])).toEqual([
      ['/api/v1/catalogs/team', 'POST'],
      ['/api/v1/catalogs/team/x', 'PUT'],
      ['/api/v1/catalogs/team/x/retirement', 'POST'],
    ]);
    expect(calls.every((call) => call[1].headers[CSRF_HEADER] === 'token-1')).toBe(true);
    expect(JSON.parse(calls[0][1].body)).toEqual({ value: { id: 'x', name: 'X' } });
    expect(JSON.parse(calls[1][1].body)).toEqual({ value: { id: 'x', name: 'Y' } });
    expect(calls[2][1].body).toBeUndefined();
  });

  it('reports the refusals by their outcome, the field errors with their pointers', async () => {
    fetchMock.mockResolvedValueOnce(json(200, SESSION));
    fetchMock.mockResolvedValueOnce(json(409, { outcome: 'ID_TAKEN' }));
    fetchMock.mockResolvedValueOnce(json(409, { outcome: 'RETIRED' }));
    fetchMock.mockResolvedValueOnce(
      json(422, { outcome: 'VALIDATION', errors: [{ pointer: '/name', code: 'REQUIRED' }] }),
    );
    await expect(client.createCatalogEntry('team', {})).rejects.toMatchObject({
      outcome: 'ID_TAKEN',
      status: 409,
    });
    await expect(client.changeCatalogEntry('team', 'x', {})).rejects.toMatchObject({
      outcome: 'RETIRED',
    });
    await expect(client.changeCatalogEntry('team', 'x', {})).rejects.toMatchObject({
      outcome: 'VALIDATION',
      errors: [{ pointer: '/name', code: 'REQUIRED' }],
    });
  });
});

describe('the directory requests (rest-api.adoc, The Own Entry; The Backstage Import; Prefilled Persons)', () => {
  it('sends the own entry, its confirmation, the import and the persons with the anti-CSRF header', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(200, { outcome: 'SAVED', pseudonym: 'p-1' }))
      .mockResolvedValueOnce(json(200, { outcome: 'SAVED', pseudonym: 'p-1' }))
      .mockResolvedValueOnce(json(200, { outcome: 'CONFIRMED', confirmedAt: '2026-11-26' }))
      .mockResolvedValueOnce(json(200, { outcome: 'PREVIEW' }))
      .mockResolvedValueOnce(json(200, { outcome: 'IMPORTED' }))
      .mockResolvedValueOnce(json(201, { outcome: 'CREATED', persons: [] }))
      .mockResolvedValueOnce(json(200, { outcome: 'ERASED' }));
    const documents = [{ name: 'catalog-info.yaml', content: 'kind: Group' }];
    const memberships = [{ team: 'team:payments', role: 'role:developer' }];
    await client.putDirectoryMe({
      name: 'Robin',
      team: 'payments',
      role: 'developer',
      binding: 'new',
    });
    await client.putDirectoryMe({ name: 'Robin', memberships });
    await client.confirmDirectoryMe();
    await client.previewBackstageImport(documents);
    await client.importBackstage(documents);
    await client.createPersons([{ name: 'Nadia', memberships }]);
    await client.erasePerson('p-2b7f10');
    const calls = fetchMock.mock.calls.slice(1);
    expect(calls.map((call) => [call[0], call[1].method])).toEqual([
      ['/api/v1/directory/me', 'PUT'],
      ['/api/v1/directory/me', 'PUT'],
      ['/api/v1/directory/me/confirmation', 'POST'],
      ['/api/v1/catalogs/import/backstage/preview', 'POST'],
      ['/api/v1/catalogs/import/backstage', 'POST'],
      ['/api/v1/directory/persons', 'POST'],
      ['/api/v1/directory/erasures', 'POST'],
    ]);
    expect(calls.every((call) => call[1].headers[CSRF_HEADER] === 'token-1')).toBe(true);
    expect(JSON.parse(calls[0][1].body)).toEqual({
      name: 'Robin',
      team: 'payments',
      role: 'developer',
      binding: 'new',
    });
    expect(JSON.parse(calls[1][1].body)).toEqual({ name: 'Robin', memberships });
    expect(calls[2][1].body).toBeUndefined();
    expect(JSON.parse(calls[3][1].body)).toEqual({ documents });
    expect(JSON.parse(calls[4][1].body)).toEqual({ documents });
    expect(JSON.parse(calls[5][1].body)).toEqual({ persons: [{ name: 'Nadia', memberships }] });
    expect(JSON.parse(calls[6][1].body)).toEqual({ pseudonym: 'p-2b7f10' });
  });

  it('keeps the members of the refusals that carry more than a word', async () => {
    fetchMock.mockResolvedValueOnce(json(200, SESSION));
    fetchMock.mockResolvedValueOnce(
      json(409, { outcome: 'BINDING_CANDIDATES', candidates: [{ pseudonym: 'p-3d7a15' }] }),
    );
    fetchMock.mockResolvedValueOnce(json(409, { outcome: 'NOT_BINDABLE' }));
    fetchMock.mockResolvedValueOnce(
      json(409, { outcome: 'MANAGED_BY_SOURCE', type: 'managed-by-source' }),
    );
    fetchMock.mockResolvedValueOnce(json(413, { outcome: 'TOO_LARGE', limit: 2_097_152 }));
    await expect(client.putDirectoryMe({ name: 'R', team: 't', role: 'r' })).rejects.toMatchObject({
      outcome: 'BINDING_CANDIDATES',
      status: 409,
      details: { candidates: [{ pseudonym: 'p-3d7a15' }] },
    });
    await expect(client.putDirectoryMe({ name: 'R', team: 't', role: 'r' })).rejects.toMatchObject({
      outcome: 'NOT_BINDABLE',
    });
    await expect(client.erasePerson('p-1')).rejects.toMatchObject({ outcome: 'MANAGED_BY_SOURCE' });
    await expect(client.importBackstage([])).rejects.toMatchObject({
      outcome: 'TOO_LARGE',
      details: { limit: 2_097_152 },
    });
  });
});

describe('the document lifecycle requests (rest-api.adoc, Document Lifecycle Requests)', () => {
  it('reads the categories, the list of a repository and the search with GET', async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await client.listCategories();
    await client.listDocuments('test-notes');
    await client.search('key rotation & more');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/categories',
      '/api/v1/documents/test-notes',
      '/api/v1/search?q=key%20rotation%20%26%20more',
    ]);
    for (const call of fetchMock.mock.calls) {
      expect(call[1].method).toBe('GET');
    }
  });

  it('reads a document, and a revision of it with the encoded `at`', async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await client.getDocument('test-notes', '01JZ8W1E3G5J7M9P1R3T5X7Z9B');
    await client.getDocument('test-notes', '01JZ8W1E3G5J7M9P1R3T5X7Z9B', 'v1');
    await client.getDocument('test-notes', '01JZ8W1E3G5J7M9P1R3T5X7Z9B', '');
    await client.getDocument('test-notes', 'a/b', '4be0c3a');
    await client.listRevisions('test-notes', '01JZ8W1E3G5J7M9P1R3T5X7Z9B');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/documents/test-notes/01JZ8W1E3G5J7M9P1R3T5X7Z9B',
      '/api/v1/documents/test-notes/01JZ8W1E3G5J7M9P1R3T5X7Z9B?at=v1',
      '/api/v1/documents/test-notes/01JZ8W1E3G5J7M9P1R3T5X7Z9B',
      '/api/v1/documents/test-notes/a%2Fb?at=4be0c3a',
      '/api/v1/documents/test-notes/01JZ8W1E3G5J7M9P1R3T5X7Z9B/revisions',
    ]);
  });

  it('creates a document with POST and the anti-CSRF header, and answers the 201 body', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(201, { outcome: 'CREATED', id: 'N10' }));
    const created = await client.createDocument('test-notes', {
      kind: 'note',
      parts: { data: { fields: { '/title': 'Phishing drill notes' } } },
    });
    expect(created.id).toBe('N10');
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/v1/documents/test-notes');
    expect(init.method).toBe('POST');
    expect(init.headers[CSRF_HEADER]).toBe('token-1');
    expect(JSON.parse(init.body)).toEqual({
      kind: 'note',
      parts: { data: { fields: { '/title': 'Phishing drill notes' } } },
    });
  });

  it('keeps the part of every field error of a refusal, and the details of the other outcomes', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(
        json(422, {
          outcome: 'VALIDATION',
          errors: [{ part: 'data', pointer: '/related', code: 'REFERENCE_NOT_FOUND' }],
        }),
      )
      .mockResolvedValueOnce(json(409, { outcome: 'DOCUMENT_RELEASED', tag: 'notes/x/v1' }))
      .mockResolvedValueOnce(json(422, { outcome: 'MANDATORY_FIELDS_MISSING', missing: ['/a'] }))
      .mockResolvedValueOnce(json(502, { outcome: 'REJECTED' }));
    const body = { parts: {} } as Parameters<ApiClient['saveDocument']>[2];
    await expect(client.saveDocument('test-notes', 'x', body)).rejects.toMatchObject({
      outcome: 'VALIDATION',
      errors: [{ part: 'data', pointer: '/related' }],
    });
    await expect(client.saveDocument('test-notes', 'x', body)).rejects.toMatchObject({
      outcome: 'DOCUMENT_RELEASED',
      details: { tag: 'notes/x/v1' },
    });
    await expect(client.transition('test-notes', 'x', 'test-note.submit')).rejects.toMatchObject({
      outcome: 'MANDATORY_FIELDS_MISSING',
      details: { missing: ['/a'] },
    });
    await expect(client.release('test-notes', 'x')).rejects.toMatchObject({
      outcome: 'REJECTED',
      status: 502,
    });
  });
});

describe('the event stream', () => {
  it('parses frames, comments and multi-line data', () => {
    expect(parseSseChunk('event: status\ndata: {"a":1}')).toEqual({
      event: 'status',
      data: '{"a":1}',
    });
    expect(parseSseChunk('data: a\ndata: b')).toEqual({ event: 'message', data: 'a\nb' });
    expect(parseSseChunk(': keepalive')).toBeNull();
  });

  it('shares one stream, dispatches parsed events and reports its state', async () => {
    fetchMock.mockImplementation(async (_path: string, init: RequestInit) =>
      stream(
        ['id: 1\nevent: document-saved\ndata: {"id":"x"}\n\n', 'event: note\ndata: text\n\n'],
        init.signal,
      ),
    );
    const states: StreamState[] = [];
    client.subscribeStreamState((state) => states.push(state));
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = client.subscribeEvents(first);
    client.subscribeEvents(second);
    await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('document-saved', { id: 'x' });
    expect(first).toHaveBeenCalledWith('note', 'text');
    expect(states).toEqual(['offline', 'connecting', 'connected']);
    stopFirst();
  });

  it('leaves for the login when the stream is refused with 401', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    client.subscribeEvents(() => {});
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('reconnects a dropped stream and reports offline after the retry limit', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response('', { status: 503 }));
    const states: StreamState[] = [];
    client.subscribeStreamState((state) => states.push(state));
    const stop = client.subscribeEvents(() => {});
    for (let attempt = 0; attempt < STREAM_RETRY_LIMIT; attempt++) {
      await vi.advanceTimersByTimeAsync(2_000);
    }
    expect(states.at(-1)).toBe('offline');
    expect(states).toContain('reconnecting');
    const calls = fetchMock.mock.calls.length;
    client.retryEvents();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock.mock.calls).toHaveLength(calls + 1);
    stop();
  });
});

describe('the SAMM and document requests', () => {
  it('reads models, scopes, comparisons, assessments and diffs with encoded paths', async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await client.getSammModel('v2.2.0');
    await client.getSammScopes();
    await client.getSammScope('pay ments');
    await client.compareSamm('payments', 'a/1', 'b');
    await client.getSammAssessment('payments-2026-q4');
    await client.getDiff('samm-assessments', 'payments-2026-q4');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/samm/models/v2.2.0',
      '/api/v1/samm/scopes',
      '/api/v1/samm/scopes/pay%20ments',
      '/api/v1/samm/payments/compare?from=a%2F1&to=b',
      '/api/v1/documents/samm-assessments/payments-2026-q4',
      '/api/v1/documents/samm-assessments/payments-2026-q4/diff?from=released',
    ]);
  });

  it('reads the diff of two states of a document with both revisions, or the current state as the later side', async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await client.getDiffBetween('isms-core', '01JZB1C3E5G7J9M1P3R5T7W9Y2', 'v1', 'v3');
    await client.getDiffBetween('isms-core', '01JZB1C3E5G7J9M1P3R5T7W9Y2', 'a0879b6');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/documents/isms-core/01JZB1C3E5G7J9M1P3R5T7W9Y2/diff?from=v1&to=v3',
      '/api/v1/documents/isms-core/01JZB1C3E5G7J9M1P3R5T7W9Y2/diff?from=a0879b6',
    ]);
  });

  it('reads the pinned models and the trend, and creates a scope and an assessment (SAMM Requests)', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path === '/api/v1/session' ? json(200, SESSION) : json(200, { ok: true }),
    );
    await client.getSammModels();
    await client.getSammTrend('pay ments');
    await client.getSammTrend('payments', 'v2.1.0');
    await client.createSammScope({ title: 'Mobile Apps', subject: 'team:mobile' });
    await client.createSammAssessment('shop', {
      title: 'Web shop 2026 Q4',
      date: '2026-11-26',
      assessors: ['p-2b7f10'],
    });
    expect(fetchMock.mock.calls.map((call) => [call[1].method, call[0]])).toEqual([
      ['GET', '/api/v1/samm/models'],
      ['GET', '/api/v1/samm/pay%20ments/trend'],
      ['GET', '/api/v1/samm/payments/trend?modelVersion=v2.1.0'],
      ['GET', '/api/v1/session'],
      ['POST', '/api/v1/samm/scopes'],
      ['POST', '/api/v1/samm/shop/assessments'],
    ]);
    expect(fetchMock.mock.calls[4][1].headers[CSRF_HEADER]).toBe('token-1');
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({
      title: 'Mobile Apps',
      subject: 'team:mobile',
    });
    expect(JSON.parse(fetchMock.mock.calls[5][1].body).assessors).toEqual(['p-2b7f10']);
  });

  it('keeps the refusals of the SAMM creates and the comparison with their details', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(
        json(409, { outcome: 'ASSESSMENT_OPEN', assessment: '2026-q4', state: 'draft' }),
      )
      .mockResolvedValueOnce(
        json(422, {
          outcome: 'MODEL_VERSIONS_DIFFER',
          from: { assessment: '2026-q2', modelVersion: 'v2.1.0' },
          to: { assessment: '2026-q4', modelVersion: 'v2.2.0' },
        }),
      );
    await expect(
      client.createSammAssessment('payments', { title: 'x', date: '2026-11-26' }),
    ).rejects.toMatchObject({
      outcome: 'ASSESSMENT_OPEN',
      status: 409,
      details: { assessment: '2026-q4' },
    });
    await expect(client.compareSamm('payments', '2026-q2', '2026-q4')).rejects.toMatchObject({
      outcome: 'MODEL_VERSIONS_DIFFER',
      status: 422,
      details: { to: { modelVersion: 'v2.2.0' } },
    });
  });

  it('keeps a draft with PUT and saves for everyone with POST', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockImplementation(async () => json(200, { outcome: 'SAVED' }));
    const body = { parts: {} } as unknown as Parameters<ApiClient['saveDraft']>[2];
    await client.saveDraft('samm-assessments', 'p', body);
    await client.saveDocument('samm-assessments', 'p', body);
    const [draftPath, draftInit] = fetchMock.mock.calls[1];
    expect(draftPath).toBe('/api/v1/drafts/samm-assessments/p');
    expect(draftInit.method).toBe('PUT');
    expect(draftInit.headers[CSRF_HEADER]).toBe('token-1');
    const [savePath, saveInit] = fetchMock.mock.calls[2];
    expect(savePath).toBe('/api/v1/documents/samm-assessments/p/save');
    expect(saveInit.method).toBe('POST');
    expect(JSON.parse(saveInit.body)).toEqual({ parts: {} });
  });

  it('moves along the workflow and releases with or without a password', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockImplementation(async () => json(200, { outcome: 'OK' }));
    await client.transition('samm-assessments', 'p', 'samm.submit');
    await client.release('samm-assessments', 'p');
    await client.release('samm-assessments', 'p', 'secret');
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/v1/documents/samm-assessments/p/transitions/samm.submit',
    );
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/releases/samm-assessments/p');
    expect(fetchMock.mock.calls[2][1].body).toBeUndefined();
    expect(fetchMock.mock.calls[2][1].headers['Content-Type']).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ password: 'secret' });
  });

  it('leaves for the step-up address and returns to the current address', () => {
    client.stepUp('/api/v1/auth/step-up');
    expect(navigate).toHaveBeenCalledWith(
      `/api/v1/auth/step-up?return=${encodeURIComponent('/samm/payments?x=1')}`,
    );
  });

  it('keeps the refusal body for a step-up', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(json(403, { outcome: 'STEP_UP_REQUIRED', stepUp: '/x' }));
    await expect(client.release('samm-assessments', 'p')).rejects.toMatchObject({
      outcome: 'STEP_UP_REQUIRED',
      status: 403,
    });
  });
});

describe('the incident requests (rest-api.adoc, Incident Report Requests)', () => {
  it('reads the years, a year, an incident with or without a revision and the report, the segments encoded', async () => {
    fetchMock.mockImplementation(async () => json(200, {}));
    await client.getIncidentYears();
    await client.getIncidentYear('2026');
    await client.getIncident('2026', 'ID 1');
    await client.getIncident('2026', 'ID1', 'v1');
    await client.getIncidentReport('2026', 'ID1');
    await client.getIncidentReport('2026', 'ID1', 'v1');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/incidents',
      '/api/v1/incidents/2026',
      '/api/v1/incidents/2026/ID%201',
      '/api/v1/incidents/2026/ID1?at=v1',
      '/api/v1/incidents/2026/ID1/report',
      '/api/v1/incidents/2026/ID1/report?at=v1',
    ]);
  });

  it('completes and reopens a stage with POST, the blob as the body and the password as a member of it', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockImplementation(async () => json(200, { outcome: 'COMPLETED' }));
    await client.completeStage(
      'isms-incidents-2026',
      'ID1',
      'review',
      { blob: 'abc1234' },
      'secret',
    );
    await client.completeStage('isms-incidents-2026', 'ID1', 'triage');
    await client.reopenStage('isms-incidents-2026', 'ID1', 'triage', { blob: 'abc1234' });
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/v1/documents/isms-incidents-2026/ID1/stages/review/complete');
    expect(init.method).toBe('POST');
    expect(init.headers[CSRF_HEADER]).toBe('token-1');
    expect(JSON.parse(init.body)).toEqual({ blob: 'abc1234', password: 'secret' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({});
    expect(fetchMock.mock.calls[3][0]).toBe(
      '/api/v1/documents/isms-incidents-2026/ID1/stages/triage/reopen',
    );
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ blob: 'abc1234' });
  });

  it('keeps the lists of the refusal of a completion', async () => {
    fetchMock.mockResolvedValueOnce(json(200, SESSION)).mockResolvedValueOnce(
      json(422, {
        outcome: 'STAGE_NOT_COMPLETABLE',
        stage: 'response',
        missing: ['/response/actions'],
        open: ['triage'],
      }),
    );
    const error = await client
      .completeStage('isms-incidents-2026', 'ID1', 'response')
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.outcome).toBe('STAGE_NOT_COMPLETABLE');
    expect(error.details.missing).toEqual(['/response/actions']);
    expect(error.details.open).toEqual(['triage']);
  });
});

describe('the recipe wizard requests (rest-api.adoc, The Recipes, The Recipe Draft, A New Model)', () => {
  it('reads the recipes and the draft, keeps the draft and creates the model, with encoded paths', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path === '/api/v1/session' ? json(200, SESSION) : json(200, { ok: true }),
    );
    await client.getThreatRecipes('de');
    await client.getThreatRecipe('quick-start', 'en');
    await client.getThreatRecipeDraft('report scheduler', 'stride');
    await client.saveThreatRecipeDraft('report-scheduler', 'stride', {
      step: 1,
      parts: { model: { fields: { '/project': { name: 'A' } } } },
    });
    await client.createThreatModel('report-scheduler', {
      recipe: 'stride',
      parts: { data: { fields: {} }, model: { fields: {} } },
    });
    await client.createThreatModel(
      'report-scheduler',
      { parts: { data: { fields: {} }, model: { fields: {} } } },
      'secret',
    );
    const requests = fetchMock.mock.calls.filter((call) => call[0] !== '/api/v1/session');
    expect(requests.map((call) => [call[1].method, call[0]])).toEqual([
      ['GET', '/api/v1/categories/threat-models/recipes?lang=de'],
      ['GET', '/api/v1/categories/threat-models/recipes/quick-start?lang=en'],
      ['GET', '/api/v1/threat-models/report%20scheduler/drafts/stride'],
      ['PUT', '/api/v1/threat-models/report-scheduler/drafts/stride'],
      ['POST', '/api/v1/threat-models/report-scheduler'],
      ['POST', '/api/v1/threat-models/report-scheduler'],
    ]);
    expect(JSON.parse(requests[3][1].body).step).toBe(1);
    expect(JSON.parse(requests[4][1].body).password).toBeUndefined();
    expect(JSON.parse(requests[5][1].body).password).toBe('secret');
  });
});

describe('the local login and the start of the login', () => {
  it('posts the form to the form login without an anti-CSRF header and accepts 200', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    expect(await client.localLogin('alex', 'local-password')).toBe(true);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/j_security_check');
    expect(init.method).toBe('POST');
    expect(init.headers[CSRF_HEADER]).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(String(init.body)).toBe('j_username=alex&j_password=local-password');
    expect(init.credentials).toBe('same-origin');
  });

  it('answers false for a wrong password, with no navigation and no refusal', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    expect(await client.localLogin('alex', 'wrong')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a missing network, a timeout and any other status as client failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(client.localLogin('a', 'b')).rejects.toMatchObject({ outcome: 'NETWORK' });
    fetchMock.mockRejectedValueOnce(new DOMException('slow', 'TimeoutError'));
    await expect(client.localLogin('a', 'b')).rejects.toMatchObject({ outcome: 'TIMEOUT' });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(client.localLogin('a', 'b')).rejects.toMatchObject({
      outcome: 'UNEXPECTED',
      status: 500,
    });
  });

  it('reads the session again after a login, so no token of the old session is sent', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(json(200, { ...SESSION, csrfToken: 'token-2' }))
      .mockResolvedValue(json(200, { outcome: 'SAVED', pseudonym: 'p' }));
    await client.getSession();
    await client.localLogin('alex', 'local-password');
    await client.putDirectoryMe({ name: 'a', team: 't', role: 'r' });
    expect(fetchMock.mock.calls[3][1].headers[CSRF_HEADER]).toBe('token-2');
  });

  it('starts the login at the provider or on the own page, and never leaves the origin', () => {
    client.startLogin('oidc', '/samm');
    expect(navigate).toHaveBeenLastCalledWith('/api/v1/auth/login?return=%2Fsamm');
    client.startLogin('local', '/');
    expect(navigate).toHaveBeenLastCalledWith('/login?return=%2F');
    expect(() => client.go('//evil.example/')).toThrow('refused address');
    expect(() => client.go('https://evil.example/')).toThrow('refused address');
    expect(() => client.go('/a\\b')).toThrow('refused address');
    expect(() => client.go('/\t/evil.example')).toThrow('refused address');
  });

  it('leaves for the own login page when the server names it', async () => {
    fetchMock.mockResolvedValue(json(401, { outcome: 'UNAUTHENTICATED', login: '/login' }));
    await expect(client.getDue()).rejects.toMatchObject({ outcome: 'UNAUTHENTICATED' });
    expect(navigate).toHaveBeenCalledWith(
      `/login?return=${encodeURIComponent('/samm/payments?x=1')}`,
    );
  });
});

describe('a step-up that carries the password', () => {
  it('sends it as a member of the transition and of the save', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, SESSION))
      .mockImplementation(async () => json(200, { outcome: 'OK' }));
    await client.transition('samm-assessments', 'p', 'samm.submit', 'secret');
    await client.saveDocument('samm-assessments', 'p', { parts: {} }, 'secret');
    await client.saveDocument('samm-assessments', 'p', { parts: {} });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ password: 'secret' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ parts: {}, password: 'secret' });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ parts: {} });
  });
});

describe('the end of the event stream', () => {
  it('tells the listeners when a connected stream ends, and reopens it', async () => {
    vi.useFakeTimers();
    let open = 0;
    fetchMock.mockImplementation(async () => {
      open += 1;
      return open === 1 ? new Response('event: x\ndata: 1\n\n', { status: 200 }) : stream([], null);
    });
    const ended = vi.fn();
    client.subscribeStreamEnd(ended);
    const stop = client.subscribeEvents(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(ended).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(open).toBe(2);
    stop();
  });

  it('tells the listeners when a connected stream breaks, but not when it never connected', async () => {
    vi.useFakeTimers();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('broken'));
      },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(body, { status: 200 }))
      .mockResolvedValue(new Response('', { status: 503 }));
    const ended = vi.fn();
    const unsubscribe = client.subscribeStreamEnd(ended);
    const stop = client.subscribeEvents(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(ended).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(ended).toHaveBeenCalledTimes(1);
    unsubscribe();
    stop();
  });

  it('does not tell the listeners about a stream the client closed itself', async () => {
    fetchMock.mockImplementation(async (_path: string, init: RequestInit) =>
      stream([], init.signal),
    );
    const ended = vi.fn();
    client.subscribeStreamEnd(ended);
    const stop = client.subscribeEvents(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ended).not.toHaveBeenCalled();
  });

  it('leaves for the login the server names when the stream is refused with 401', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path === '/api/v1/events'
        ? new Response('', { status: 401 })
        : json(401, { outcome: 'UNAUTHENTICATED', login: '/login' }),
    );
    client.subscribeEvents(() => {});
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        `/login?return=${encodeURIComponent('/samm/payments?x=1')}`,
      ),
    );
  });

  it('leaves for the default login when the session read after a refused stream is no 401', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path === '/api/v1/events' ? new Response('', { status: 401 }) : json(200, SESSION),
    );
    client.subscribeEvents(() => {});
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        `/api/v1/auth/login?return=${encodeURIComponent('/samm/payments?x=1')}`,
      ),
    );
  });

  it('keeps a stream retryable when the session read after a refused stream fails without a 401', async () => {
    let streamCalls = 0;
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/v1/events') {
        streamCalls += 1;
        return streamCalls === 1 ? new Response('', { status: 401 }) : stream([], init?.signal);
      }
      throw new TypeError('offline');
    });
    const states: StreamState[] = [];
    client.subscribeStreamState((state) => states.push(state));
    client.subscribeEvents(() => {});
    await vi.waitFor(() => expect(streamCalls).toBe(1));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/session')).toBe(true),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    client.retryEvents();
    await vi.waitFor(() => expect(streamCalls).toBe(2));
    await vi.waitFor(() => expect(states.at(-1)).toBe('connected'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the stream closed when the session read after a refused stream is a 401', async () => {
    let streamCalls = 0;
    fetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/v1/events') {
        streamCalls += 1;
        return new Response('', { status: 401 });
      }
      return json(401, { outcome: 'UNAUTHENTICATED', login: '/login' });
    });
    client.subscribeEvents(() => {});
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    client.retryEvents();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(streamCalls).toBe(1);
  });
});
