/**
 * The one client of the web app against same-origin `/api/v1` (AUN-WEB-1, AUN-WEB-8, AUN-WEB-9).
 *
 * The browser holds no token (AUN-AUTH-1): the session is a cookie the browser sends by itself. The client
 * adds the anti-CSRF header to every state-changing request, follows the login address of a `401` with
 * the current canonical address as `return`, and keeps one shared event stream.
 */
import { loginStartAddress } from '../access/access';
import { ApiError, isApiError, isOutcome, type FieldError } from './errors';
import type {
  CatalogCreated,
  CatalogEntryRead,
  CatalogList,
  CatalogRetired,
  CatalogSaved,
  CatalogSchema,
  CategoryList,
  CategorySchema,
  CreateRequest,
  Created,
  DocumentList,
  DocumentRead,
  DirectoryConfirmed,
  DirectoryEntry,
  DirectoryPrefill,
  DirectorySaved,
  DocumentDiff,
  Erased,
  DraftSaved,
  DueList,
  ImportDocument,
  ImportResult,
  LoginProvider,
  LogoutAnswer,
  OwnEntryChange,
  PersonDetail,
  PersonDraft,
  PersonList,
  PersonsCreated,
  ReferenceAnswer,
  ReferenceList,
  Released,
  ReportsSummary,
  RenderedAsciiDoc,
  RevisionList,
  RiskRegister,
  SammAssessment,
  SammAssessmentCreated,
  SammAssessmentDraft,
  SammComparison,
  SammModel,
  SammModelList,
  SammScope,
  SammScopeCreated,
  SammScopeDraft,
  SammScopeList,
  SammTrend,
  SammTrendReport,
  SaveRequest,
  Saved,
  SearchResults,
  Session,
  Status,
  RecipeDraftRequest,
  IncidentRead,
  IncidentReport,
  IncidentYearList,
  IncidentYears,
  StageActed,
  StageRequest,
  ThreatEvaluation,
  ThreatModelCreate,
  ThreatModelCreated,
  ThreatModelRead,
  ThreatModelService,
  ThreatRecipe,
  ThreatRecipeDraftRead,
  ThreatRecipeList,
  Transitioned,
  JsonObject,
} from './types';

/**
 * @param segment one path segment from an address or a document
 * @returns it encoded for a request path
 */
const seg = (segment: string): string => encodeURIComponent(segment);

/** The connection states of the event stream, which the live indicator shows. */
export type StreamState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** A listener of the event stream. */
export type EventListener = (event: string, data: unknown) => void;

/** The most descriptor documents of one import (rest-api.adoc, The Backstage Import). */
export const MAX_IMPORT_DOCUMENTS = 100;

/** The most bytes of descriptors of one import, together: 2 MiB. */
export const MAX_IMPORT_BYTES = 2_097_152;

/** The most persons of one prefill request, and the most memberships of a person. */
export const MAX_PERSONS_PER_REQUEST = 100;
export const MAX_MEMBERSHIPS = 5;

/** The time a request may take before it fails with `TIMEOUT`. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** The pause between two attempts of a dropped event stream. */
export const STREAM_RETRY_DELAY_MS = 2_000;

/** The attempts after which the event stream reports `offline`. */
export const STREAM_RETRY_LIMIT = 10;

/** The anti-CSRF header of AUN-WEB-8. */
export const CSRF_HEADER = 'X-CSRF-Token';

/** The most references one `GET /api/v1/references/resolve` takes. */
export const MAX_REFERENCES_PER_REQUEST = 50;

/** The default login address, used when a `401` names none. */
const DEFAULT_LOGIN = '/api/v1/auth/login';

/**
 * Checks that a request path is a path of this origin.
 *
 * @param path the path
 * @throws Error for a path that could leave the origin
 */
function assertRequestPath(path: string): void {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
  if (!path.startsWith('/api/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) {
    throw new Error(`refused request path: ${path}`);
  }
}

/**
 * @param location the current location
 * @returns the address the login returns to: the current path and query
 */
function currentAddress(location: Pick<Location, 'pathname' | 'search'>): string {
  return `${location.pathname}${location.search}`;
}

/**
 * Parses one frame of the event stream.
 *
 * @param chunk the text between two blank lines
 * @returns the event and its data, or `null` for a comment or an empty frame
 */
export function parseSseChunk(chunk: string): { event: string; data: string } | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of chunk.split(/\r\n|\r|\n/)) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null;
}

/**
 * The client. One instance, {@link apiClient}, serves the app; tests create their own.
 */
export class ApiClient {
  private csrfToken: string | null = null;
  private readonly listeners = new Set<EventListener>();
  private readonly stateListeners = new Set<(state: StreamState) => void>();
  private readonly endListeners = new Set<() => void>();
  private streamState: StreamState = 'offline';
  private stopStream: (() => void) | null = null;
  private retryStream: (() => void) | null = null;

  /**
   * @param navigate how the client leaves the app for the login; replaced in tests
   */
  constructor(
    private readonly navigate: (address: string) => void = (address) =>
      window.location.assign(address),
  ) {}

  /** @returns the application status (no login needed) */
  getStatus(): Promise<Status> {
    return this.request<Status>('GET', '/api/v1/status');
  }

  /**
   * @param locale the language
   * @returns the message catalogue (no login needed)
   */
  getMessages(locale: string): Promise<Record<string, string>> {
    return this.request<Record<string, string>>(
      'GET',
      `/api/v1/messages?lang=${encodeURIComponent(locale)}`,
    );
  }

  /** @returns the session; remembers its anti-CSRF token */
  async getSession(): Promise<Session> {
    const session = await this.request<Session>('GET', '/api/v1/session');
    this.csrfToken = session.csrfToken;
    return session;
  }

  /** @returns the entries of the Due lens */
  getDue(): Promise<DueList> {
    return this.request<DueList>('GET', '/api/v1/due');
  }

  /** @returns the prefill of the first-login form */
  getDirectoryMe(): Promise<DirectoryPrefill> {
    return this.request<DirectoryPrefill>('GET', '/api/v1/directory/me');
  }

  /**
   * @param catalog the catalog (`team`, `role`, `service`, …); the list holds the retired entries too, marked `retired`
   * @returns its entries
   */
  getCatalog(catalog: string): Promise<CatalogList> {
    return this.request<CatalogList>('GET', `/api/v1/catalogs/${seg(catalog)}`);
  }

  /**
   * The schema of the entries of a catalog, for the generated form (AUN-WEB-4). PROVISIONAL.
   *
   * @param catalog the catalog
   * @returns the catalog and its JSON Schema
   * @throws ApiError `NOT_FOUND` for an unknown catalog
   */
  getCatalogSchema(catalog: string): Promise<CatalogSchema> {
    return this.request<CatalogSchema>('GET', `/api/v1/catalogs/${seg(catalog)}/schema`);
  }

  /**
   * One entry of a catalog: its value, for a service the effective protection needs, and the signed history.
   * PROVISIONAL.
   *
   * @param catalog the catalog
   * @param id the entry id
   * @returns the entry, retired or not
   * @throws ApiError `NOT_FOUND` for an entry that does not exist
   */
  getCatalogEntry(catalog: string, id: string): Promise<CatalogEntryRead> {
    return this.request<CatalogEntryRead>('GET', `/api/v1/catalogs/${seg(catalog)}/${seg(id)}`);
  }

  /**
   * Creates an entry. Needs the right `administer-catalogs`. PROVISIONAL.
   *
   * @param catalog the catalog
   * @param value the entry, `id` included
   * @returns the address of the new entry
   * @throws ApiError `VALIDATION` with pointers into `value`, `ID_TAKEN` for an id that exists (retired or not),
   * `FORBIDDEN` without the right, `GIT_UNAVAILABLE`, `REJECTED`
   */
  createCatalogEntry(catalog: string, value: JsonObject): Promise<CatalogCreated> {
    return this.request<CatalogCreated>('POST', `/api/v1/catalogs/${seg(catalog)}`, { value });
  }

  /**
   * Changes an entry; the last save wins. Needs the right `administer-catalogs`. PROVISIONAL.
   *
   * @param catalog the catalog
   * @param id the entry id
   * @param value the whole entry
   * @returns when it was saved
   * @throws ApiError `VALIDATION`, `RETIRED` for a retired entry, `FORBIDDEN`, `NOT_FOUND`, `GIT_UNAVAILABLE`,
   * `REJECTED`
   */
  changeCatalogEntry(catalog: string, id: string, value: JsonObject): Promise<CatalogSaved> {
    return this.request<CatalogSaved>('PUT', `/api/v1/catalogs/${seg(catalog)}/${seg(id)}`, {
      value,
    });
  }

  /**
   * Retires an entry: it stays readable and what refers to it stays valid, and the pickers stop offering it. Needs the
   * right `administer-catalogs`. PROVISIONAL.
   *
   * @param catalog the catalog
   * @param id the entry id
   * @returns when it was retired
   * @throws ApiError `FORBIDDEN`, `NOT_FOUND`, `GIT_UNAVAILABLE`, `REJECTED`
   */
  retireCatalogEntry(catalog: string, id: string): Promise<CatalogRetired> {
    return this.request<CatalogRetired>(
      'POST',
      `/api/v1/catalogs/${seg(catalog)}/${seg(id)}/retirement`,
    );
  }

  /**
   * The categories the user may see, with their document types and the repository of each: the smallest request that
   * tells the rail whether the generic documents lens exists, and the web app which repository holds the documents
   * of an address. PROVISIONAL.
   *
   * @returns the categories; none on an installation without a generic category
   */
  listCategories(): Promise<CategoryList> {
    return this.request<CategoryList>('GET', '/api/v1/categories');
  }

  /**
   * The documents of one repository, newest change first, at most 500. PROVISIONAL.
   *
   * @param repository the repository alias of a document type
   * @returns the documents, and whether more exist than the list holds
   */
  listDocuments(repository: string): Promise<DocumentList> {
    return this.request<DocumentList>('GET', `/api/v1/documents/${seg(repository)}`);
  }

  /**
   * Searches the titles and ids of the documents of every repository the user may read, from the index (so it works
   * while the Git server is unreachable). PROVISIONAL.
   *
   * @param query at least two characters after trimming, at most 200
   * @returns at most 20 hits
   * @throws ApiError `VALIDATION` with `MIN_LENGTH` or `MAX_LENGTH` at `/q`
   */
  search(query: string): Promise<SearchResults> {
    return this.request<SearchResults>('GET', `/api/v1/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Reads one document of the generic lens, with the user's own draft, the transitions the workflow offers and the
   * release request. PROVISIONAL.
   *
   * @param repository the repository
   * @param id the document id, a ULID
   * @param at a revision (`v<n>` or a commit id) to read the document as it was then, read-only; the current document
   * without it
   * @returns the document
   * @throws ApiError `NOT_FOUND` for a document or a revision that does not exist, `VALIDATION` (`/at`, `FORMAT`) for
   * a value of another shape
   */
  getDocument(repository: string, id: string, at?: string): Promise<DocumentRead> {
    const query = at === undefined || at === '' ? '' : `?at=${encodeURIComponent(at)}`;
    return this.request<DocumentRead>(
      'GET',
      `/api/v1/documents/${seg(repository)}/${seg(id)}${query}`,
    );
  }

  /**
   * The revisions of a document, newest first: the releases and the commits; `ref` is what {@link getDocument} takes
   * as `at`. PROVISIONAL.
   *
   * @param repository the repository
   * @param id the document id
   * @returns the revisions
   */
  listRevisions(repository: string, id: string): Promise<RevisionList> {
    return this.request<RevisionList>(
      'GET',
      `/api/v1/documents/${seg(repository)}/${seg(id)}/revisions`,
    );
  }

  /**
   * The first save of a new document: the server assigns the id and answers `201`. A refusal of the fields is
   * `VALIDATION` with a `part` on every error and nothing is written. PROVISIONAL.
   *
   * @param repository the repository of the document type
   * @param body the document type and the fields of each part, keyed by JSON Pointer
   * @param password the renewed password of a local user, if step-up asks for it
   * @returns the id, the address and the blob ids
   */
  createDocument(repository: string, body: CreateRequest, password?: string): Promise<Created> {
    return this.request<Created>(
      'POST',
      `/api/v1/documents/${seg(repository)}`,
      password === undefined ? body : { ...body, password },
    );
  }

  /**
   * The schema of every document type of a category, for the generated form (AUN-WEB-4). PROVISIONAL.
   *
   * @param category the category id
   * @returns the kinds with their repository alias and their schema file
   * @throws ApiError `NOT_FOUND` for an unknown or switched-off category
   */
  getCategorySchema(category: string): Promise<CategorySchema> {
    return this.request<CategorySchema>('GET', `/api/v1/categories/${seg(category)}/schema`);
  }

  /**
   * Renders AsciiDoc on the server for the preview; nothing is stored. PROVISIONAL.
   *
   * @param source the AsciiDoc source, at most 65,536 bytes in UTF-8
   * @returns the sanitised HTML, which the caller must still parse with the allow-list and never inserts as markup
   * @throws ApiError `TOO_LARGE` (`details.limit`), `RENDER_UNAVAILABLE`, or `VALIDATION`
   */
  renderAsciiDoc(source: string): Promise<RenderedAsciiDoc> {
    return this.request<RenderedAsciiDoc>('POST', '/api/v1/render/asciidoc', { source });
  }

  /**
   * The person entries a document may reference: the bound and the prefilled ones, at most 100, ordered by name.
   * PROVISIONAL.
   *
   * @param query the typed text; the server keeps the entries whose name contains it
   * @returns the persons, and whether more entries matched
   */
  listPersons(query?: string): Promise<PersonList> {
    const q = query === undefined || query === '' ? '' : `?q=${encodeURIComponent(query)}`;
    return this.request<PersonList>('GET', `/api/v1/directory/persons${q}`);
  }

  /**
   * @param pseudonym the pseudonym a document holds
   * @returns the person: bound, not yet bound, or a former member with no name
   * @throws ApiError `NOT_FOUND` for a pseudonym that resolves to no entry and to no erasure
   */
  getPerson(pseudonym: string): Promise<PersonDetail> {
    return this.request<PersonDetail>('GET', `/api/v1/directory/persons/${seg(pseudonym)}`);
  }

  /**
   * Resolves document and catalog references to a title and a canonical address. PROVISIONAL.
   *
   * @param refs the references; more than {@link MAX_REFERENCES_PER_REQUEST} go in several requests
   * @returns one answer per reference, in the order asked
   */
  async resolveReferences(refs: string[]): Promise<ReferenceAnswer[]> {
    const answers: ReferenceAnswer[] = [];
    for (let from = 0; from < refs.length; from += MAX_REFERENCES_PER_REQUEST) {
      const query = refs
        .slice(from, from + MAX_REFERENCES_PER_REQUEST)
        .map((ref) => `ref=${encodeURIComponent(ref)}`)
        .join('&');
      const list = await this.request<ReferenceList>('GET', `/api/v1/references/resolve?${query}`);
      answers.push(...list.references);
    }
    return answers;
  }

  /**
   * Saves the own directory entry: the first login (one team and one role, `binding` after `BINDING_CANDIDATES`) or, for
   * a user who has an entry, a change of its name and memberships, which counts as a confirmation. No step-up.
   *
   * @param entry the first-login entry, or the change of the own entry
   * @returns the saved entry's pseudonym (and, for a change, the day it is confirmed)
   * @throws ApiError `VALIDATION`, `BINDING_CANDIDATES` (`details.candidates`), `NOT_BINDABLE`, `GIT_UNAVAILABLE`,
   * `REJECTED`
   */
  putDirectoryMe(entry: DirectoryEntry | OwnEntryChange): Promise<DirectorySaved> {
    return this.request<DirectorySaved>('PUT', '/api/v1/directory/me', entry);
  }

  /**
   * Confirms the own entry as it is ("Is this still right?"); the entry is unchanged and its confirmation day is
   * today. PROVISIONAL.
   *
   * @returns the day of the confirmation
   * @throws ApiError `FORBIDDEN`, `GIT_UNAVAILABLE`, `REJECTED`
   */
  confirmDirectoryMe(): Promise<DirectoryConfirmed> {
    return this.request<DirectoryConfirmed>('POST', '/api/v1/directory/me/confirmation');
  }

  /**
   * Checks what the import of Backstage descriptors would do; nothing is written. PROVISIONAL.
   *
   * @param documents the descriptors as text, at most {@link MAX_IMPORT_DOCUMENTS}, together at most
   * {@link MAX_IMPORT_BYTES}
   * @returns what would be created, updated, left alone and left out (`PREVIEW`)
   * @throws ApiError `FORBIDDEN`, `VALIDATION` (`/documents/<n>/content`, `FORMAT`), `TOO_LARGE` (`details.limit`),
   * `GIT_UNAVAILABLE`
   */
  previewBackstageImport(documents: ImportDocument[]): Promise<ImportResult> {
    return this.request<ImportResult>('POST', '/api/v1/catalogs/import/backstage/preview', {
      documents,
    });
  }

  /**
   * Imports Backstage descriptors in one commit: it updates and creates, never duplicates or deletes.
   *
   * @param documents the descriptors, as for the preview
   * @returns what was created, updated, left alone and left out (`IMPORTED`)
   * @throws ApiError as the preview, and `REJECTED`
   */
  importBackstage(documents: ImportDocument[]): Promise<ImportResult> {
    return this.request<ImportResult>('POST', '/api/v1/catalogs/import/backstage', { documents });
  }

  /**
   * Saves person entries that no login has bound yet, all in one commit. PROVISIONAL.
   *
   * @param persons one to {@link MAX_PERSONS_PER_REQUEST} persons, each with a name and one to five memberships
   * @returns the saved entries in the order sent
   * @throws ApiError `FORBIDDEN`, `VALIDATION` (`/persons/<n>/…`), `MANAGED_BY_SOURCE`, `GIT_UNAVAILABLE`, `REJECTED`
   */
  createPersons(persons: PersonDraft[]): Promise<PersonsCreated> {
    return this.request<PersonsCreated>('POST', '/api/v1/directory/persons', { persons });
  }

  /**
   * Erases a person's entry at once; it cannot be undone. No step-up. PROVISIONAL.
   *
   * @param pseudonym the person's pseudonym
   * @returns the day of the erasure
   * @throws ApiError `FORBIDDEN`, `NOT_FOUND`, `MANAGED_BY_SOURCE`, `GIT_UNAVAILABLE`, `REJECTED`
   */
  erasePerson(pseudonym: string): Promise<Erased> {
    return this.request<Erased>('POST', '/api/v1/directory/erasures', { pseudonym });
  }

  /**
   * @param version a pinned SAMM model version
   * @returns the model: business functions, practices, streams, questions and their answer sets
   */
  getSammModel(version: string): Promise<SammModel> {
    return this.request<SammModel>('GET', `/api/v1/samm/models/${seg(version)}`);
  }

  /**
   * The pinned model versions, newest first, the one a new scope or assessment takes marked `default` (PROVISIONAL).
   *
   * @returns the versions; none for an installation that pins none
   * @throws ApiError `FORBIDDEN` without the right to read
   */
  getSammModels(): Promise<SammModelList> {
    return this.request<SammModelList>('GET', '/api/v1/samm/models');
  }

  /**
   * Creates a scope with its targets: the server assigns the address segment and writes the first commit (PROVISIONAL).
   * Needs `edit` on `samm-assessments`.
   *
   * @param scope the title, the subject reference, the model version and the targets
   * @returns the id, the address and the blob ids of the new scope
   * @throws ApiError `VALIDATION` with pointers into the body (`/subject` with `REFERENCE_NOT_FOUND` for a subject that
   * does not resolve), `FORBIDDEN`, `REJECTED`, `GIT_UNAVAILABLE`
   */
  createSammScope(scope: SammScopeDraft): Promise<SammScopeCreated> {
    return this.request<SammScopeCreated>('POST', '/api/v1/samm/scopes', scope);
  }

  /**
   * Starts an assessment of a scope: empty, a draft, the user its first assessor (PROVISIONAL). Needs `edit` on
   * `samm-assessments`.
   *
   * @param scope the scope's address segment
   * @param assessment the title, the date, the model version and the further assessors
   * @returns the id, the address and the state of the new assessment
   * @throws ApiError `NOT_FOUND`, `ASSESSMENT_OPEN` (`details.assessment` names the open one), `VALIDATION`
   * (`/assessors/<n>` with `PSEUDONYM_UNKNOWN`), `FORBIDDEN`, `REJECTED`, `GIT_UNAVAILABLE`
   */
  createSammAssessment(
    scope: string,
    assessment: SammAssessmentDraft,
  ): Promise<SammAssessmentCreated> {
    return this.request<SammAssessmentCreated>(
      'POST',
      `/api/v1/samm/${seg(scope)}/assessments`,
      assessment,
    );
  }

  /**
   * The overall, function and practice scores of the released assessments of a scope over time, one model version,
   * oldest first (PROVISIONAL).
   *
   * @param scope the scope's address segment
   * @param modelVersion the version of the points; the one of the latest released assessment without it
   * @returns the points, and how many released assessments of other versions are left out
   * @throws ApiError `NOT_FOUND`
   */
  getSammTrend(scope: string, modelVersion?: string): Promise<SammTrend> {
    const query =
      modelVersion === undefined ? '' : `?modelVersion=${encodeURIComponent(modelVersion)}`;
    return this.request<SammTrend>('GET', `/api/v1/samm/${seg(scope)}/trend${query}`);
  }

  /** @returns the SAMM scopes with their latest released and their open assessment */
  getSammScopes(): Promise<SammScopeList> {
    return this.request<SammScopeList>('GET', '/api/v1/samm/scopes');
  }

  /**
   * @param scope the scope's address segment
   * @returns the scope: subject, targets and assessments
   */
  getSammScope(scope: string): Promise<SammScope> {
    return this.request<SammScope>('GET', `/api/v1/samm/scopes/${seg(scope)}`);
  }

  /**
   * @param scope the scope's address segment
   * @param from the earlier assessment
   * @param to the later assessment
   * @returns the score differences per business function, practice and stream (AUN-SAMM-5)
   * @throws ApiError `MODEL_VERSIONS_DIFFER` (`details.from` and `details.to`, each `{assessment, modelVersion}`) for two
   * assessments taken with different model versions, `NOT_FOUND`
   */
  compareSamm(scope: string, from: string, to: string): Promise<SammComparison> {
    return this.request<SammComparison>(
      'GET',
      `/api/v1/samm/${seg(scope)}/compare?from=${seg(from)}&to=${seg(to)}`,
    );
  }

  /**
   * The figures of the dashboard of the lens Reports (PROVISIONAL): one section per repository the user may read.
   *
   * @returns the summary; a section is absent where the user may not read its repository, and the request never fails
   * for that
   */
  getReportsSummary(): Promise<ReportsSummary> {
    return this.request<ReportsSummary>('GET', '/api/v1/reports/summary');
  }

  /**
   * The released assessments of every scope over time, in the order of the scope list (PROVISIONAL).
   *
   * @returns the points of every scope, one model version each
   * @throws ApiError `FORBIDDEN` without the right to read `samm-assessments`
   */
  getSammTrendReport(): Promise<SammTrendReport> {
    return this.request<SammTrendReport>('GET', '/api/v1/reports/samm-trend');
  }

  /**
   * The threat models of the services, evaluated: open and untreated threats, the review and its due date, and the
   * services without a model (PROVISIONAL).
   *
   * @returns one row per threat model, and the services without one
   * @throws ApiError `FORBIDDEN` without the right to read `threat-models`
   */
  getThreatEvaluation(): Promise<ThreatEvaluation> {
    return this.request<ThreatEvaluation>('GET', '/api/v1/reports/threat-evaluation');
  }

  /**
   * A service of the lens Threat models: its threat models, the review intervals and the person's recipe drafts
   * (PROVISIONAL).
   *
   * @param service the service's address segment
   * @returns the service page
   * @throws ApiError `NOT_FOUND` for a service that is in no catalog, `FORBIDDEN` without the right to read `threat-models`
   */
  getThreatModelService(service: string): Promise<ThreatModelService> {
    return this.request<ThreatModelService>('GET', `/api/v1/threat-models/${seg(service)}`);
  }

  /**
   * One threat model by its address (PROVISIONAL): the generic read of the document with its review, its threat counts
   * and its generated diagram.
   *
   * @param service the service's address segment
   * @param model the model's address segment
   * @param at a release (`v3`) or a commit, for the model as it was then; the current state without it
   * @returns the model
   * @throws ApiError `NOT_FOUND` for a service, model or revision that does not exist, `VALIDATION` for an `at` of no form
   */
  getThreatModel(service: string, model: string, at?: string): Promise<ThreatModelRead> {
    const query = at === undefined ? '' : `?at=${encodeURIComponent(at)}`;
    return this.request<ThreatModelRead>(
      'GET',
      `/api/v1/threat-models/${seg(service)}/${seg(model)}${query}`,
    );
  }

  /**
   * The recipes that ship with the application, in the language of the interface (PROVISIONAL).
   *
   * @param lang `en` or `de`
   * @returns the recipes with the number of their steps; none for an installation that ships none
   * @throws ApiError `FORBIDDEN` without the right to read `threat-models`
   */
  getThreatRecipes(lang: string): Promise<ThreatRecipeList> {
    return this.request<ThreatRecipeList>(
      'GET',
      `/api/v1/categories/threat-models/recipes?lang=${encodeURIComponent(lang)}`,
    );
  }

  /**
   * One recipe with its steps, their texts in the language asked for (PROVISIONAL).
   *
   * @param recipe the recipe's id
   * @param lang `en` or `de`
   * @returns the recipe
   * @throws ApiError `NOT_FOUND` for a recipe that does not exist, `FORBIDDEN`
   */
  getThreatRecipe(recipe: string, lang: string): Promise<ThreatRecipe> {
    return this.request<ThreatRecipe>(
      'GET',
      `/api/v1/categories/threat-models/recipes/${seg(recipe)}?lang=${encodeURIComponent(lang)}`,
    );
  }

  /**
   * The person's unfinished recipe for a service (PROVISIONAL): the draft of a model that does not exist yet.
   *
   * @param service the service's address segment
   * @param recipe the recipe's id
   * @returns the draft, or `draft: null` for none
   * @throws ApiError `NOT_FOUND` for an unknown service or recipe, `FORBIDDEN`
   */
  getThreatRecipeDraft(service: string, recipe: string): Promise<ThreatRecipeDraftRead> {
    return this.request<ThreatRecipeDraftRead>(
      'GET',
      `/api/v1/threat-models/${seg(service)}/drafts/${seg(recipe)}`,
    );
  }

  /**
   * Keeps what the person filled in so far, for this person only: the draft is replaced as a whole (PROVISIONAL).
   *
   * @param service the service's address segment
   * @param recipe the recipe's id
   * @param body the step the person goes on to and every field filled in so far
   * @returns when the draft was kept
   * @throws ApiError `VALIDATION` with `part`, `pointer` and `code` per field (nothing was written), `NOT_FOUND`,
   * `FORBIDDEN` without `edit`
   */
  saveThreatRecipeDraft(
    service: string,
    recipe: string,
    body: RecipeDraftRequest,
  ): Promise<DraftSaved> {
    return this.request<DraftSaved>(
      'PUT',
      `/api/v1/threat-models/${seg(service)}/drafts/${seg(recipe)}`,
      body,
    );
  }

  /**
   * Creates a threat model of a service: the first save, which ends the recipe draft (PROVISIONAL). Needs `edit` on
   * `threat-models`.
   *
   * @param service the service's address segment
   * @param body the recipe and the fields of the parts `data` and `model`
   * @param password the password of a local user, when the step-up handler collected one
   * @returns the address segment, the document and the address of the new model
   * @throws ApiError `VALIDATION` (`/project/name` with `REQUIRED`), `NOT_FOUND`, `SERVICE_RETIRED`, `FORBIDDEN`,
   * `REJECTED`, `GIT_UNAVAILABLE`
   */
  createThreatModel(
    service: string,
    body: ThreatModelCreate,
    password?: string,
  ): Promise<ThreatModelCreated> {
    return this.request<ThreatModelCreated>(
      'POST',
      `/api/v1/threat-models/${seg(service)}`,
      password === undefined ? body : { ...body, password },
    );
  }

  /**
   * The years of the incident reports the person may read, newest first (PROVISIONAL): the first column of the lens
   * Incidents. A person without a right on any incident repository gets no year, not a refusal.
   *
   * @returns the years with their counts
   */
  getIncidentYears(): Promise<IncidentYears> {
    return this.request<IncidentYears>('GET', '/api/v1/incidents');
  }

  /**
   * The incidents of a year with their stage statuses and deadline counts (PROVISIONAL).
   *
   * @param year the year, four digits
   * @returns the incidents, newest awareness first
   * @throws ApiError `NOT_FOUND` for a year that has no repository, or that the person may not read
   */
  getIncidentYear(year: string): Promise<IncidentYearList> {
    return this.request<IncidentYearList>('GET', `/api/v1/incidents/${seg(year)}`);
  }

  /**
   * One incident by its address (PROVISIONAL): the generic document read with its stages, deadlines and protection
   * needs.
   *
   * @param year the year, four digits
   * @param incident the incident's document id
   * @param at a release (`v1`) or a commit, to read the incident as it was then
   * @returns the incident
   * @throws ApiError `NOT_FOUND` for an incident or a revision that does not exist, `VALIDATION` for an `at` of no form
   */
  getIncident(year: string, incident: string, at?: string): Promise<IncidentRead> {
    const query = at === undefined ? '' : `?at=${encodeURIComponent(at)}`;
    return this.request<IncidentRead>(
      'GET',
      `/api/v1/incidents/${seg(year)}/${seg(incident)}${query}`,
    );
  }

  /**
   * The report of an incident as AsciiDoc (PROVISIONAL): generated from the saved working state, or the one a release
   * committed.
   *
   * @param year the year, four digits
   * @param incident the incident's document id
   * @param at a revision, to read the report of that state
   * @returns the report source
   */
  getIncidentReport(year: string, incident: string, at?: string): Promise<IncidentReport> {
    const query = at === undefined ? '' : `?at=${encodeURIComponent(at)}`;
    return this.request<IncidentReport>(
      'GET',
      `/api/v1/incidents/${seg(year)}/${seg(incident)}/report${query}`,
    );
  }

  /**
   * Completes a stage (PROVISIONAL): signs off its part. The review asks for step-up, with local users the password
   * travels as the member `password`.
   *
   * @param repository the repository of the year
   * @param id the incident's document id
   * @param stage the stage
   * @param body the blob id the form loaded, if any
   * @param password the renewed password of a local user, if step-up asks for it
   * @returns the stage and the statuses of the stages afterwards
   * @throws ApiError `STAGE_NOT_COMPLETABLE` (`missing`, `open`), `STAGE_NOT_APPLICABLE`, `STAGE_STATE`,
   *   `CHANGED_SINCE_REVIEW`, `DOCUMENT_RELEASED`, `STEP_UP_REQUIRED`, `NOT_FOUND`
   */
  completeStage(
    repository: string,
    id: string,
    stage: string,
    body: StageRequest = {},
    password?: string,
  ): Promise<StageActed> {
    return this.request<StageActed>(
      'POST',
      `/api/v1/documents/${seg(repository)}/${seg(id)}/stages/${seg(stage)}/complete`,
      password === undefined ? body : { ...body, password },
    );
  }

  /**
   * Reopens a completed stage (PROVISIONAL): the stages after it stay completed and read as signed off before.
   *
   * @param repository the repository of the year
   * @param id the incident's document id
   * @param stage the stage
   * @param body the blob id the form loaded, if any
   * @returns the stage and the statuses of the stages afterwards
   */
  reopenStage(
    repository: string,
    id: string,
    stage: string,
    body: StageRequest = {},
  ): Promise<StageActed> {
    return this.request<StageActed>(
      'POST',
      `/api/v1/documents/${seg(repository)}/${seg(id)}/stages/${seg(stage)}/reopen`,
      body,
    );
  }

  /**
   * The risk register as of a tag or a date, released entries only (AUN-ISMS-3).
   *
   * @param asOf a calendar date (`2026-03-01`) or the name of a tag; the register as of now without it
   * @returns what was read, the tags to pick from and the released entries as they were then
   * @throws ApiError `FORBIDDEN`, `VALIDATION` (`/as-of` with `PATTERN`, `FUTURE` or `UNKNOWN_TAG`), `GIT_UNAVAILABLE`
   */
  getRiskRegister(asOf?: string): Promise<RiskRegister> {
    const query = asOf === undefined ? '' : `?as-of=${encodeURIComponent(asOf)}`;
    return this.request<RiskRegister>('GET', `/api/v1/isms/risks${query}`);
  }

  /**
   * @param id the assessment's document id
   * @returns the assessment with its answers, parts and signed history
   */
  getSammAssessment(id: string): Promise<SammAssessment> {
    return this.request<SammAssessment>('GET', `/api/v1/documents/samm-assessments/${seg(id)}`);
  }

  /**
   * @param repository the repository
   * @param id the document id
   * @returns the structured diff against the last released state (AUN-WEB-6)
   */
  getDiff(repository: string, id: string): Promise<DocumentDiff> {
    return this.request<DocumentDiff>(
      'GET',
      `/api/v1/documents/${seg(repository)}/${seg(id)}/diff?from=released`,
    );
  }

  /**
   * The structured diff between two states of a document, the comparison of two releases (UC-ISMS-1). PROVISIONAL: the
   * specified request is `from=released`, see {@link getDiff}.
   *
   * @param repository the repository
   * @param id the document id
   * @param from the earlier revision: `v<n>` for a release, a commit id for any other state
   * @param to the later revision; the current state without it
   * @returns the diff, `from` and `to` the tags it compared
   * @throws ApiError `NOT_FOUND` for a revision that does not exist, `VALIDATION` (`/from`, `/to`) with `FORMAT` or
   * `REQUIRED`
   */
  getDiffBetween(repository: string, id: string, from: string, to?: string): Promise<DocumentDiff> {
    const query = `from=${encodeURIComponent(from)}${to ? `&to=${encodeURIComponent(to)}` : ''}`;
    return this.request<DocumentDiff>(
      'GET',
      `/api/v1/documents/${seg(repository)}/${seg(id)}/diff?${query}`,
    );
  }

  /**
   * Keeps the user's work as a draft, for this user only (AUN-WEB-5).
   *
   * @param repository the repository
   * @param id the document id
   * @param body the changed parts
   * @returns when the draft was kept
   */
  saveDraft(repository: string, id: string, body: SaveRequest): Promise<DraftSaved> {
    return this.request<DraftSaved>('PUT', `/api/v1/drafts/${seg(repository)}/${seg(id)}`, body);
  }

  /**
   * Saves for everyone: one signed commit with the blob ids the form loaded (AUN-WEB-5).
   *
   * @param repository the repository
   * @param id the document id
   * @param body the changed parts with their loaded blob ids
   * @param password the renewed password of a local user, if step-up asks for it
   * @returns the new blob ids
   */
  saveDocument(
    repository: string,
    id: string,
    body: SaveRequest,
    password?: string,
  ): Promise<Saved> {
    return this.request<Saved>(
      'POST',
      `/api/v1/documents/${seg(repository)}/${seg(id)}/save`,
      password === undefined ? body : { ...body, password },
    );
  }

  /**
   * Moves a document along its workflow, such as `samm.submit` into review. PROVISIONAL path: the specification
   * names the operation and its outcomes, not yet its request.
   *
   * @param repository the repository
   * @param id the document id
   * @param transition the transition of the category's workflow
   * @param password the renewed password of a local user, if step-up asks for it
   * @returns the new state
   */
  transition(
    repository: string,
    id: string,
    transition: string,
    password?: string,
  ): Promise<Transitioned> {
    return this.request<Transitioned>(
      'POST',
      `/api/v1/documents/${seg(repository)}/${seg(id)}/transitions/${seg(transition)}`,
      password === undefined ? undefined : { password },
    );
  }

  /**
   * Releases a document (AUN-WEB-6). With local users the step-up is the password, sent with the request.
   *
   * @param repository the repository
   * @param id the document id
   * @param password the renewed password of a local user, if step-up asks for it
   * @returns the release tag
   */
  release(repository: string, id: string, password?: string): Promise<Released> {
    return this.request<Released>(
      'POST',
      `/api/v1/releases/${seg(repository)}/${seg(id)}`,
      password === undefined ? undefined : { password },
    );
  }

  /**
   * Leaves the app for a step-up address the server named, returning to the current address.
   *
   * @param address the step-up address of a `STEP_UP_REQUIRED` refusal
   */
  stepUp(address: string): void {
    this.navigate(this.loginAddress(address));
  }

  /**
   * Leaves for an address of this origin: the page itself, not a request.
   *
   * @param address the address; one that could leave the origin is refused
   */
  go(address: string): void {
    if (
      !address.startsWith('/') ||
      address.startsWith('//') ||
      address.includes('\\') ||
      // eslint-disable-next-line no-control-regex -- a browser strips tab and line breaks from an address
      /[\u0000-\u001f\u007f-\u009f]/.test(address)
    ) {
      throw new Error(`refused address: ${address}`);
    }
    this.navigate(address);
  }

  /**
   * Starts the login (UC-ACC-1, UC-ACC-7): with the identity provider the server's login start, with local users the
   * web app's own page. The return address is the caller's to check (`checkReturn`).
   *
   * @param provider how the installation logs in
   * @param returnAddress the checked address to come back to
   */
  startLogin(provider: LoginProvider, returnAddress: string): void {
    this.go(loginStartAddress(provider, returnAddress));
  }

  /**
   * Posts the username and the password of a local test account to Quarkus' form login (AUN-AUTH-6). The answer
   * carries no body: `200` is the login, `401` a wrong password or an unknown user (the same answer). The browser
   * adds the `Origin` the server checks; no anti-CSRF header is needed. The password is never kept or logged.
   *
   * To be replaced by Token Sheriff's session layer with the login provider `oidc` (ADR-0004); with `local` it stays.
   *
   * @param username the username
   * @param password the password
   * @returns whether the login was accepted
   * @throws ApiError `NETWORK`, `TIMEOUT` or `UNEXPECTED` when no usable answer came
   */
  async localLogin(username: string, password: string): Promise<boolean> {
    let response: Response;
    try {
      response = await fetch('/j_security_check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ j_username: username, j_password: password }),
        credentials: 'same-origin',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      throw new ApiError(timedOut ? 'TIMEOUT' : 'NETWORK', 0);
    }
    if (response.status === 200) {
      this.csrfToken = null;
      return true;
    }
    if (response.status === 401) return false;
    throw new ApiError('UNEXPECTED', response.status);
  }

  /**
   * Ends the session at the server and leaves the app for the address the server names.
   */
  async logout(): Promise<void> {
    const answer = await this.request<LogoutAnswer>('POST', '/api/v1/auth/logout');
    this.csrfToken = null;
    this.closeEvents();
    this.navigate(answer.redirect);
  }

  /**
   * Sends one request.
   *
   * A state-changing request carries the anti-CSRF header; without a token the session is read first.
   * A `401` leaves the app for the login and returns to the current address.
   *
   * @param method the HTTP method
   * @param path the path below `/api/`
   * @param body the JSON body, if any
   * @returns the parsed answer
   * @throws ApiError for every refusal and failure
   */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    assertRequestPath(path);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (method !== 'GET') {
      headers[CSRF_HEADER] = await this.ensureCsrfToken();
    }
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      throw new ApiError(timedOut ? 'TIMEOUT' : 'NETWORK', 0);
    }
    const parsed = await readJson(response);
    if (response.ok) {
      return parsed as T;
    }
    throw this.refusal(response.status, parsed);
  }

  private async ensureCsrfToken(): Promise<string> {
    if (this.csrfToken === null) {
      await this.getSession();
    }
    return this.csrfToken ?? '';
  }

  private refusal(status: number, body: unknown): ApiError {
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const outcome = isOutcome(record.outcome) ? record.outcome : 'UNEXPECTED';
    // A wrong step-up password is a 401 too, but no lost session (rest-api.adoc, decided provisionally).
    if ((status === 401 && outcome !== 'INVALID_CREDENTIALS') || outcome === 'UNAUTHENTICATED') {
      this.csrfToken = null;
      const login = typeof record.login === 'string' ? record.login : DEFAULT_LOGIN;
      this.navigate(this.loginAddress(login));
      return new ApiError('UNAUTHENTICATED', status);
    }
    if (outcome === 'CSRF_REJECTED') {
      // The session's token may have changed (a new login in another tab): read it again next time.
      this.csrfToken = null;
    }
    const errors = Array.isArray(record.errors) ? (record.errors as FieldError[]) : [];
    return new ApiError(outcome, status, errors, record);
  }

  /**
   * @param login the login address the server named
   * @returns the login address with the current address as `return`
   */
  loginAddress(login: string): string {
    const target = login.startsWith('/') && !login.startsWith('//') ? login : DEFAULT_LOGIN;
    const separator = target.includes('?') ? '&' : '?';
    const here = typeof window === 'undefined' ? '/' : currentAddress(window.location);
    return `${target}${separator}return=${encodeURIComponent(here)}`;
  }

  /**
   * Subscribes to the shared event stream; the first subscriber opens it.
   *
   * @param listener called for every event with its parsed data
   * @returns the unsubscribe function; the last one closes the stream
   */
  subscribeEvents(listener: EventListener): () => void {
    this.listeners.add(listener);
    this.stopStream ??= this.openStream();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.closeEvents();
      }
    };
  }

  /**
   * @param listener called with every change of the stream state, and once with the current one
   * @returns the unsubscribe function
   */
  subscribeStreamState(listener: (state: StreamState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.streamState);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * @param listener called whenever a stream that had connected ends without the client closing it: the server closed
   * it with the session, or the connection broke. The client opens it again by itself; the listener decides whether
   * the session changed (UC-ACC-6).
   * @returns the unsubscribe function
   */
  subscribeStreamEnd(listener: () => void): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  /** Reconnects an `offline` stream at once (the shell's recovery, `keepStreamAlive`). */
  retryEvents(): void {
    this.retryStream?.();
  }

  /** Closes the event stream. */
  closeEvents(): void {
    this.stopStream?.();
    this.stopStream = null;
    this.retryStream = null;
    this.setStreamState('offline');
  }

  private setStreamState(state: StreamState): void {
    this.streamState = state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private notifyStreamEnd(): void {
    for (const listener of this.endListeners) {
      listener();
    }
  }

  private dispatch(event: string, data: string): void {
    let parsed: unknown = data;
    try {
      parsed = JSON.parse(data);
    } catch {
      // Not JSON: the listener gets the text.
    }
    for (const listener of this.listeners) {
      listener(event, parsed);
    }
  }

  /**
   * Reads the frames of an event stream until it ends or the stream is closed, and dispatches each event.
   *
   * @param reader the reader of the response body
   * @param isActive whether the stream is still wanted
   */
  private async readFrames(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    isActive: () => boolean,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    while (isActive()) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/(?:\r\n|\r|\n){2}/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const parsed = parseSseChunk(frame);
        if (parsed) this.dispatch(parsed.event, parsed.data);
      }
    }
  }

  private openStream(): () => void {
    let active = true;
    let closed = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const schedule = (): void => {
      failures += 1;
      if (failures >= STREAM_RETRY_LIMIT) {
        this.setStreamState('offline');
        return;
      }
      this.setStreamState('reconnecting');
      timer = setTimeout(() => {
        timer = null;
        void connect();
      }, STREAM_RETRY_DELAY_MS);
    };

    const connect = async (): Promise<void> => {
      if (!active) return;
      let connected = false;
      controller = new AbortController();
      this.setStreamState(failures === 0 ? 'connecting' : 'reconnecting');
      try {
        const response = await fetch('/api/v1/events', {
          headers: { Accept: 'text/event-stream' },
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (response.status === 401) {
          active = false;
          this.setStreamState('offline');
          // The session read names the login this installation uses (`/login` with local users); a read that
          // is no 401 after all leaves for the default login. A read that fails for another reason (network, timeout)
          // says nothing about the session: the stream stays `offline` but retryable, so `retryEvents` and the shell's
          // recovery open it again; a 401 has led to the login already and keeps the stream closed.
          this.getSession().then(
            () => this.navigate(this.loginAddress(DEFAULT_LOGIN)),
            (probeError: unknown) => {
              if (
                !closed &&
                !(isApiError(probeError) && probeError.outcome === 'UNAUTHENTICATED')
              ) {
                active = true;
              }
            },
          );
          return;
        }
        if (!response.ok || !response.body) {
          throw new Error(`event stream refused: ${response.status}`);
        }
        this.setStreamState('connected');
        connected = true;
        failures = 0;
        await this.readFrames(response.body.getReader(), () => active);
        if (active) {
          this.notifyStreamEnd();
          schedule();
        }
      } catch {
        if (active) {
          if (connected) this.notifyStreamEnd();
          schedule();
        }
      }
    };

    this.retryStream = () => {
      if (!active || this.streamState !== 'offline') return;
      failures = 0;
      void connect();
    };

    void connect();

    return () => {
      active = false;
      closed = true;
      if (timer !== null) clearTimeout(timer);
      controller?.abort();
    };
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The client of the app. */
export const apiClient = new ApiClient();
