<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Link from '../../components/Link.svelte';
  import Notice from '../../components/Notice.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import { apiClient } from '../../api/client';
  import { errorMessageKey, isApiError } from '../../api/errors';
  import type {
    CategorySchema,
    DocumentRead,
    DocumentSavedEvent,
    DocumentSummary,
    Revision,
  } from '../../api/types';
  import { LIFECYCLE_EVENTS } from '../../api/types';
  import { actionsOn, kindName } from '../../documents/categories';
  import {
    DOCUMENTS_REPOSITORY,
    ISMS_ADDRESS,
    ISMS_CATEGORY,
    ISMS_DOCUMENTS,
    REGISTER_REPOSITORY,
    compareAddress,
    documentAddress,
    documentsAddress,
    isDocumentKind,
    neighbourPairs,
    newDocumentAddress,
    releaseAddress,
    releasesOf,
    reviewOf,
  } from '../../isms/model';
  import { versionOfTag } from '../../documents/history';
  import { formatDate } from '../../format';
  import { currentLocale, messagesStore, t } from '../../i18n';
  import { session } from '../../stores/app';
  import { breadcrumb } from '../../stores/breadcrumb';
  import { now } from '../../stores/clock';
  import TriagePage, { type Level } from '../../templates/TriagePage.svelte';
  import DocumentSheet from '../documents/DocumentSheet.svelte';
  import NewDocumentSheet from '../documents/NewDocumentSheet.svelte';
  import NotFoundView from '../NotFoundView.svelte';
  import DocumentsColumn from './DocumentsColumn.svelte';
  import TypesColumn from './TypesColumn.svelte';

  /**
   * The documents of the lens ISMS (UC-ISMS-1): the chain types › documents › document as columns (`TriagePage`). The first
   * column lists the four document types of `isms-core` and the way into the risk register; the second the documents of a
   * type (`?kind=`) or of every type; the object is the document as a sheet over the form of its type, a new one, or an
   * earlier state (`?at=`). The review and release is a page of its own (`IsmsDocumentReleaseView`), the comparison of two
   * releases too (`DocumentCompareView`). The pages of the risk register are the next part of the lens.
   *
   * The sheet, the form, the workflow's steps and the release are those of the generic documents lens, drawn on the
   * addresses of this one. Data is read per address and again when the event stream names a document of `isms-core`, so a
   * list and an open sheet follow what others do within the 5 seconds of AUN-WEB-5.
   */
  interface Props {
    /** The route id: `isms`, `isms.documents`, `isms.documents.new` or `isms.document`. */
    route: string;
    /** The values of the address: `ismsdocument`. */
    params: Record<string, string>;
    /** The admitted query of the address: `kind` of the list and of a new document, `at` of an earlier state. */
    query?: Record<string, string>;
    /** Opens an address inside the app; `replace` takes the place of the current one in the history. */
    onnavigate: (href: string, options?: { replace?: boolean }) => void;
  }

  let { route, params, query = {}, onnavigate }: Props = $props();

  // The parts of the address as values, so that everything that decides a read depends on these and never on the objects.
  let documentId = $derived(route === 'isms.document' ? params.ismsdocument : undefined);
  let at = $derived(query.at);

  let documents = $state<{ list: DocumentSummary[]; truncated: boolean } | null>(null);
  let forbidden = $state(false);
  let schemas = $state<CategorySchema | null>(null);
  let doc = $state<DocumentRead | null>(null);
  let revisions = $state<{ list: Revision[]; truncated: boolean } | null>(null);
  let revisionsFailed = $state(false);
  /** The address names a document or an earlier state that does not exist; it goes with the address. */
  let missing = $state(false);
  let documentForbidden = $state(false);

  /** The loads of the view; each keeps its own failure, so one that succeeds never hides another that failed. */
  type Load = 'documents' | 'schema' | 'document';
  let failures = $state<Partial<Record<Load, string>>>({});
  let failure = $derived(Object.values(failures).find(Boolean) ?? null);

  function fail(load: Load, error: unknown) {
    failures = { ...failures, [load]: errorMessageKey(error) };
  }

  function succeed(load: Load) {
    if (!failures[load]) return;
    const rest = { ...failures };
    delete rest[load];
    failures = rest;
  }

  let rights = $derived(actionsOn($session, DOCUMENTS_REPOSITORY));
  let canCreate = $derived(rights.includes('edit'));
  let canReadRegister = $derived(actionsOn($session, REGISTER_REPOSITORY).includes('read'));

  /** The document type the lists and the form are about: the address's, or the open document's. */
  let kind = $derived.by(() => {
    if (route !== 'isms.document') return query.kind ?? null;
    // The list knows the type of the document before the read of the document itself has answered.
    const listed = documents?.list.find((entry) => entry.id === documentId)?.kind;
    return doc && doc.id === documentId ? doc.kind : (listed ?? null);
  });
  let formKind = $derived(query.kind ?? null);
  let newSchema = $derived(
    formKind ? (schemas?.kinds.find((entry) => entry.id === formKind)?.schema ?? null) : null,
  );
  /** `new` of a document type the lens does not have, or one whose schema the server does not serve. */
  let badNew = $derived(
    route === 'isms.documents.new' &&
      ((formKind !== null && !isDocumentKind(formKind)) ||
        (formKind !== null && schemas !== null && newSchema === null)),
  );
  let schema = $derived(
    doc ? (schemas?.kinds.find((entry) => entry.id === doc!.kind)?.schema ?? null) : null,
  );
  let notFound = $derived(missing || badNew);

  let latestList = 0;

  /** Reads the documents again, without dropping the list shown: after a creation, a save, a step, here or elsewhere. */
  async function readList() {
    const read = ++latestList;
    try {
      const answer = await apiClient.listDocuments(DOCUMENTS_REPOSITORY);
      if (read !== latestList) return;
      documents = { list: answer.documents, truncated: answer.truncated };
      forbidden = false;
      succeed('documents');
    } catch (error) {
      if (read !== latestList) return;
      if (isApiError(error) && error.outcome === 'FORBIDDEN') {
        documents = null;
        forbidden = true;
        succeed('documents');
      } else {
        fail('documents', error);
      }
    }
  }

  let latestRead = 0;

  async function readDocument() {
    const id = documentId;
    if (!id) return;
    const read = ++latestRead;
    try {
      const loaded = await apiClient.getDocument(DOCUMENTS_REPOSITORY, id, at);
      if (read !== latestRead) return;
      doc = loaded;
      documentForbidden = false;
      succeed('document');
      void readRevisions(loaded);
    } catch (error) {
      if (read !== latestRead) return;
      if (isApiError(error) && (error.outcome === 'NOT_FOUND' || error.outcome === 'VALIDATION')) {
        missing = true;
      } else if (isApiError(error) && error.outcome === 'FORBIDDEN') {
        documentForbidden = true;
      } else {
        fail('document', error);
      }
    }
  }

  let latestRevisions = 0;

  async function readRevisions(loaded: DocumentRead) {
    const read = ++latestRevisions;
    try {
      const answer = await apiClient.listRevisions(loaded.repository, loaded.id);
      if (read !== latestRevisions) return;
      revisions = { list: answer.revisions, truncated: answer.truncated };
      revisionsFailed = false;
    } catch {
      if (read === latestRevisions) revisionsFailed = true;
    }
  }

  onMount(() => {
    void readList();
    // A document of `isms-core` that is created, saved or moved along its workflow changes the list; the open document
    // follows by its own sheet, which reads it again when the stream names it.
    const stop = apiClient.subscribeEvents((event, data) => {
      const named = data as DocumentSavedEvent | null;
      if (!(LIFECYCLE_EVENTS as readonly string[]).includes(event)) return;
      if (!named || named.repository !== DOCUMENTS_REPOSITORY) return;
      void readList();
    });
    return () => {
      stop();
      breadcrumb.set([]);
    };
  });

  /** The number of the reads of the schema the person asked for again after one failed. */
  let schemaAttempt = $state(0);

  // The schema of the category, for the form of a document or of a new one.
  $effect(() => {
    void schemaAttempt;
    if (route !== 'isms.document' && route !== 'isms.documents.new') {
      untrack(() => succeed('schema'));
      return;
    }
    if (untrack(() => schemas) !== null) return;
    let live = true;
    apiClient
      .getCategorySchema(ISMS_CATEGORY)
      .then((answer) => {
        if (!live) return;
        schemas = answer;
        succeed('schema');
      })
      .catch((error) => {
        if (live) fail('schema', error);
      });
    return () => {
      live = false;
    };
  });

  // The document of the address (and its earlier state); another one drops the last at once, so its data never shows under
  // the new address.
  $effect(() => {
    const id = documentId;
    void at;
    untrack(() => {
      latestRead += 1;
      latestRevisions += 1;
      doc = null;
      revisions = null;
      revisionsFailed = false;
      missing = false;
      if (id) {
        documentForbidden = false;
        void readDocument();
      } else {
        succeed('document');
      }
    });
  });

  const loading = $derived($t('common.loading'));

  /** The document type of the second column: the form's when a document is created, else the address's or the open document's. */
  let listKind = $derived(route === 'isms.documents.new' ? formKind : kind);

  let levels: Level[] = $derived.by(() => {
    const chain: Level[] = [
      {
        key: 'isms',
        kind: 'isms',
        kindLabel: $t('lens.isms'),
        title: $t('isms.start.title'),
        href: ISMS_ADDRESS,
      },
    ];
    if (route !== 'isms') {
      chain.push({
        // The key does not hold the type: a deep link learns it only when a read answers, and the column must not remount.
        key: 'documents',
        kind: 'category',
        kindLabel: $t('isms.kind.type'),
        title: listKind ? kindName($messagesStore, ISMS_CATEGORY, listKind) : $t('isms.types.all'),
        href: documentsAddress(listKind),
      });
    }
    if (route === 'isms.documents.new') {
      chain.push({
        key: 'new',
        kind: 'document',
        kindLabel: $t('kind.document'),
        title: $t('documents.new'),
        href: newDocumentAddress(formKind),
      });
    } else if (documentId) {
      chain.push({
        key: `document:${documentId}`,
        kind: 'document',
        kindLabel: $t('kind.document'),
        title: doc?.title ?? loading,
        href: documentAddress(documentId),
      });
    }
    return chain;
  });

  $effect(() => {
    // An address that leads nowhere has no chain: the crumb must not stay at "Loading…".
    breadcrumb.set(
      notFound ? [] : levels.slice(1).map((level) => ({ label: level.title, href: level.href })),
    );
  });

  let objectMin = $derived(
    route === 'isms.document' || route === 'isms.documents.new' ? 780 : undefined,
  );
  /** The key of a sheet: another document or another earlier state is another sheet, never an edited one. */
  let sheetKey = $derived(`${documentId}@${at ?? ''}`);

  // The review date of the document as the sheet reads it: a fact under the title, in words, without a colour of its own.
  let reviewFact = $derived.by(() => {
    if (!doc) return [];
    const value = doc.parts[Object.keys(doc.parts)[0] ?? 'data']?.value as
      Record<string, unknown> | undefined;
    const review = reviewOf(value?.['review-due'], $now);
    if (!review) return [];
    const date = formatDate(review.date, $currentLocale);
    // An earlier state is read as it was: its date says nothing about today.
    const text =
      doc.at !== undefined
        ? date
        : review.standing === 'overdue'
          ? $t('isms.review.overdue', { date, count: -review.days })
          : review.standing === 'due-soon'
            ? $t('isms.review.soon', { date, count: review.days })
            : date;
    return [{ term: $t('isms.fact.review'), value: text }];
  });

  let releases = $derived(releasesOf(revisions?.list ?? null));
  /** The latest pair of neighbouring releases: the comparison the sheet offers. */
  let latestPair = $derived(neighbourPairs(releases)[0] ?? null);
</script>

{#if notFound}
  <NotFoundView />
{:else}
  {#if failure}
    <div class="isms__failure">
      <Notice tone="danger" title={$t(failure)} live>
        {#snippet actions()}
          {#if failures.schema}
            <Button onclick={() => (schemaAttempt += 1)} data-testid="schema-retry">
              {$t('common.retry')}
            </Button>
          {/if}
        {/snippet}
      </Notice>
    </div>
  {/if}
  {#snippet blocked()}
    <div class="isms__forbidden" data-testid="isms-forbidden">
      <Notice tone="info" title={$t('isms.forbidden.title')} body={$t('isms.forbidden.body')} />
    </div>
  {/snippet}
  <TriagePage
    {levels}
    {objectMin}
    stripLabel={$t('triage.strip')}
    returnLabel={$t('triage.return')}
    upLabel={(parent) => $t('triage.up', { title: parent.title })}
    announce={(object) => $t('triage.announce', { kind: object.kindLabel, title: object.title })}
    testId="isms-view"
  >
    {#snippet column(level, { object })}
      {#if level.key === 'isms'}
        <TypesColumn
          documents={documents?.list ?? null}
          {forbidden}
          register={canReadRegister}
          selected={kind}
          all={route === 'isms.documents' && !query.kind}
        />
      {:else if level.key === 'documents'}
        {#if forbidden}
          {@render blocked()}
        {:else}
          <DocumentsColumn
            kind={listKind}
            documents={documents?.list ?? null}
            truncated={documents?.truncated ?? false}
            selected={documentId ?? null}
            {canCreate}
            {object}
          />
        {/if}
      {:else if level.key === 'new'}
        <!-- Another document type is another form, never the typed one. -->
        {#key formKind ?? ''}
          <NewDocumentSheet
            category={ISMS_DOCUMENTS}
            kind={formKind}
            schema={newSchema}
            repository={DOCUMENTS_REPOSITORY}
            {canCreate}
            {onnavigate}
            newAddress={newDocumentAddress}
            backAddress={documentsAddress()}
          />
        {/key}
      {:else if documentForbidden}
        {@render blocked()}
      {:else if doc && schema}
        {#key sheetKey}
          <DocumentSheet
            document={doc}
            category={ISMS_DOCUMENTS}
            {schema}
            revisions={revisions?.list ?? null}
            revisionsTruncated={revisions?.truncated ?? false}
            {revisionsFailed}
            onrefresh={() => void readDocument()}
            {onnavigate}
            addressFor={(ref) => documentAddress(doc!.id, ref)}
            releaseAddress={releaseAddress(doc.id)}
            moreFacts={reviewFact}
            aside={compareBlock}
          />
        {/key}
      {:else}
        <Sheet><p class="muted">{$t('common.loading')}</p></Sheet>
      {/if}
    {/snippet}
  </TriagePage>
{/if}

{#snippet compareBlock()}
  {#if doc && revisions !== null}
    <section class="margin__block" data-testid="compare-block">
      <h2 class="margin__title">{$t('isms.compare.title')}</h2>
      {#if latestPair}
        <Link
          href={compareAddress(doc.id, latestPair.from.ref, latestPair.to.ref)}
          look="secondary"
          data-testid="compare-link"
        >
          {$t('isms.compare.link', {
            from: versionOfTag(latestPair.from.tag ?? latestPair.from.ref),
            to: versionOfTag(latestPair.to.tag ?? latestPair.to.ref),
          })}
        </Link>
      {:else}
        <p class="margin__text" data-testid="compare-none">{$t('isms.compare.none')}</p>
      {/if}
    </section>
  {/if}
{/snippet}

<style>
  .isms__failure,
  .isms__forbidden {
    padding: var(--space-4) var(--space-6) 0;
  }

  .muted {
    padding: var(--space-4);
    color: var(--color-text-muted);
  }

  .margin__block {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  .margin__title {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-secondary);
  }

  .margin__text {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    color: var(--color-text-secondary);
  }

  @media (max-width: 599px) {
    .margin__block :global(a.link) {
      min-block-size: 44px;
    }
  }
</style>
