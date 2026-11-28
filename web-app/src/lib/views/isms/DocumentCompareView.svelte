<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Link from '../../components/Link.svelte';
  import Notice from '../../components/Notice.svelte';
  import Select, { type SelectOption } from '../../components/Select.svelte';
  import { apiClient } from '../../api/client';
  import { errorMessageKey, isApiError } from '../../api/errors';
  import type {
    CategorySchema,
    DocumentDiff,
    DocumentRead,
    JsonSchema,
    Revision,
  } from '../../api/types';
  import { groupDiff } from '../../documents/diff';
  import { versionOfTag } from '../../documents/history';
  import { createFormServices, provideFormServices } from '../../forms/services';
  import { formatDate } from '../../format';
  import { currentLocale, messagesStore, t } from '../../i18n';
  import {
    DOCUMENTS_REPOSITORY,
    ISMS_CATEGORY,
    compareAddress,
    documentAddress,
    documentsAddress,
    neighbourPairs,
    releasesOf,
  } from '../../isms/model';
  import { breadcrumb } from '../../stores/breadcrumb';
  import DashboardPage from '../../templates/DashboardPage.svelte';
  import DiffValue from '../documents/DiffValue.svelte';
  import DiffRecord from '../documents/DiffRecord.svelte';
  import type { ReleaseChange } from '../documents/ReleaseFlow.svelte';
  import NotFoundView from '../NotFoundView.svelte';

  /**
   * The comparison of two versions of an ISMS document (UC-ISMS-1, `/isms/documents/{ismsdocument}/compare?from=&to=`): the
   * changes between two releases, field by field, in the words of the form (the same record the release page shows). A
   * document is released more than once and "every earlier version stays comparable", so the page offers two pickers over
   * its releases (the later side may be the current state) and, without `from`, the pairs of neighbouring releases. The page
   * only reads; the address says what is compared, so a comparison can be linked and survives a login.
   */
  interface Props {
    /** The values of the address: `ismsdocument`. */
    params: Record<string, string>;
    /** The admitted query of the address: `from` and `to`, a release (`v2`) or a commit id; none of them lists the pairs. */
    query?: Record<string, string>;
  }

  let { params, query = {} }: Props = $props();

  // One reading of references for the whole record: the names of people and the titles of documents are asked once.
  provideFormServices(createFormServices());

  let documentId = $derived(params.ismsdocument);
  let doc = $state<DocumentRead | null>(null);
  let revisions = $state<Revision[] | null>(null);
  let schema = $state<JsonSchema | null>(null);
  let missing = $state(false);
  let failure = $state<string | null>(null);

  let diff = $state<DocumentDiff | null>(null);
  /** One of the two versions is none of the document's (or the server could not compare them). */
  let refused = $state<string | null>(null);

  let fromPick = $state('');
  let toPick = $state('');

  // The document, its revisions and its schema; another document drops the last at once.
  $effect(() => {
    const id = documentId;
    untrack(() => {
      doc = null;
      revisions = null;
      schema = null;
      missing = false;
      failure = null;
    });
    let live = true;
    Promise.all([
      apiClient.getDocument(DOCUMENTS_REPOSITORY, id),
      apiClient.listRevisions(DOCUMENTS_REPOSITORY, id),
      apiClient.getCategorySchema(ISMS_CATEGORY),
    ]).then(
      ([loaded, listed, schemas]: [DocumentRead, { revisions: Revision[] }, CategorySchema]) => {
        if (!live) return;
        const found = schemas.kinds.find((entry) => entry.id === loaded.kind)?.schema ?? null;
        // A document type the server serves no schema of is no address of this lens.
        if (!found) {
          missing = true;
          return;
        }
        doc = loaded;
        revisions = listed.revisions;
        schema = found;
      },
      (error: unknown) => {
        if (!live) return;
        if (
          isApiError(error) &&
          (error.outcome === 'NOT_FOUND' || error.outcome === 'VALIDATION')
        ) {
          missing = true;
        } else {
          failure = errorMessageKey(error);
        }
      },
    );
    return () => {
      live = false;
    };
  });

  // The pickers follow the address: a pair chosen by a link shows in them.
  $effect(() => {
    fromPick = query.from ?? '';
    toPick = query.to ?? '';
  });

  let same = $derived(!!query.from && query.from === (query.to ?? ''));

  // The comparison of the address. The same version twice is refused on the page, whichever way the address was reached:
  // no request.
  $effect(() => {
    const id = documentId;
    const from = query.from;
    const to = query.to;
    untrack(() => {
      diff = null;
      refused = null;
    });
    if (!from || from === to) return;
    let live = true;
    apiClient.getDiffBetween(DOCUMENTS_REPOSITORY, id, from, to).then(
      (answer) => {
        if (live) diff = answer;
      },
      (error: unknown) => {
        if (!live) return;
        refused =
          isApiError(error) && error.outcome === 'NOT_FOUND'
            ? 'isms.compare.missing'
            : errorMessageKey(error);
      },
    );
    return () => {
      live = false;
    };
  });

  onDestroy(() => breadcrumb.set([]));

  let compareHref = $derived(compareAddress(documentId));
  $effect(() => {
    breadcrumb.set(
      !missing && doc
        ? [
            { label: $t('isms.documents.title'), href: documentsAddress() },
            { label: doc.title, href: documentAddress(doc.id) },
            { label: $t('isms.compare.crumb'), href: compareHref },
          ]
        : [],
    );
  });

  let releases = $derived(releasesOf(revisions));
  let pairs = $derived(neighbourPairs(releases));

  /** @returns the line that tells a release apart: its version, when, by whom */
  function describe(revision: Revision): string {
    return $t('isms.compare.option', {
      version: versionOfTag(revision.tag ?? revision.ref),
      date: formatDate(revision.at, $currentLocale),
      name: revision.by.name,
    });
  }

  /** @returns the options of a picker: the releases, and a revision of the address that is none of them stays a choice */
  function optionsFor(pick: string): SelectOption[] {
    const listed = releases.map((revision) => ({ value: revision.ref, label: describe(revision) }));
    return pick !== '' && !listed.some((option) => option.value === pick)
      ? [{ value: pick, label: pick }, ...listed]
      : listed;
  }

  let fromOptions = $derived(optionsFor(fromPick));
  let toOptions = $derived(optionsFor(toPick));

  /** @returns the words of one side of the comparison: the release it is, or the current state for none */
  function sideOf(ref: string | undefined): string {
    if (!ref) return $t('isms.compare.current');
    const found = releases.find((revision) => revision.ref === ref);
    return found ? describe(found) : ref;
  }

  let reason = $derived(
    fromPick === ''
      ? $t('isms.compare.pick.from')
      : fromPick === toPick
        ? $t('isms.compare.pick.same')
        : null,
  );

  let groups = $derived(
    doc && diff
      ? groupDiff(diff, $messagesStore, ISMS_CATEGORY, doc.kind, $t).map((group) => ({
          key: group.key,
          title: group.title,
          changes: group.rows.map((row) => ({ ...row })),
        }))
      : [],
  );
  let total = $derived(groups.reduce((sum, group) => sum + group.changes.length, 0));
</script>

{#snippet value(change: ReleaseChange, side: 'before' | 'after')}
  {#if doc && schema}
    <DiffValue
      {schema}
      category={ISMS_CATEGORY}
      kind={doc.kind}
      pointer={change.pointer}
      value={side === 'before' ? change.before : change.after}
    />
  {/if}
{/snippet}

{#if missing}
  <NotFoundView />
{:else}
  <DashboardPage
    title={$t('isms.compare.title.page', { title: doc?.title ?? $t('common.loading') })}
    intro={$t('isms.compare.lede')}
    testId="document-compare-view"
  >
    {#if failure}
      <Notice tone="danger" title={$t(failure)} live />
    {:else if !doc || !revisions}
      <p class="muted">{$t('common.loading')}</p>
    {:else if releases.length < 2}
      <div data-testid="compare-too-few">
        <EmptyState
          icon="state.na"
          title={$t('isms.compare.too-few.title')}
          body={$t('isms.compare.too-few.body')}
        />
      </div>
    {:else}
      <div class="pickers">
        <div class="picker">
          <Select
            label={$t('isms.compare.from')}
            options={fromOptions}
            bind:value={fromPick}
            placeholder={$t('isms.compare.pick.placeholder')}
            testId="compare-from"
          />
        </div>
        <div class="picker">
          <Select
            label={$t('isms.compare.to')}
            options={toOptions}
            bind:value={toPick}
            placeholder={$t('isms.compare.current')}
            testId="compare-to"
          />
        </div>
        <div class="pickers__act">
          {#if reason}
            <Button variant="primary" disabledReason={reason} data-testid="compare-show">
              {$t('isms.compare.show')}
            </Button>
          {:else}
            <Link
              href={compareAddress(doc.id, fromPick, toPick || null)}
              look="primary"
              data-testid="compare-show"
            >
              {$t('isms.compare.show')}
            </Link>
          {/if}
        </div>
      </div>

      {#if !query.from}
        {#if pairs.length > 0}
          <section class="section" aria-labelledby="compare-pairs-title">
            <h2 class="section__title" id="compare-pairs-title">{$t('isms.compare.pairs')}</h2>
            <ul class="pairs" data-testid="compare-pairs">
              {#each pairs as pair (pair.to.ref)}
                <li>
                  <Link href={compareAddress(doc.id, pair.from.ref, pair.to.ref)}>
                    {$t('isms.compare.pair', {
                      from: versionOfTag(pair.from.tag ?? pair.from.ref),
                      to: versionOfTag(pair.to.tag ?? pair.to.ref),
                      date: formatDate(pair.to.at, $currentLocale),
                    })}
                  </Link>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {:else if same}
        <div data-testid="compare-same">
          <Notice tone="attention" title={$t('isms.compare.pick.same')} live />
        </div>
      {:else if refused}
        <div data-testid="compare-refused">
          <Notice
            tone={refused === 'isms.compare.missing' ? 'attention' : 'danger'}
            title={$t(refused)}
            live
          />
        </div>
      {:else if diff}
        <section
          class="section"
          aria-labelledby="compare-result-title"
          data-testid="compare-result"
        >
          <h2 class="section__title" id="compare-result-title">{$t('isms.compare.result')}</h2>
          <dl class="sides">
            <div>
              <dt>{$t('isms.compare.from')}</dt>
              <dd data-testid="compare-side-from">
                {sideOf(query.from)}
                <Link href={documentAddress(doc.id, query.from)}>
                  {$t('isms.compare.read', { version: query.from })}
                </Link>
              </dd>
            </div>
            <div>
              <dt>{$t('isms.compare.to')}</dt>
              <dd data-testid="compare-side-to">
                {sideOf(query.to)}
                {#if query.to}
                  <Link href={documentAddress(doc.id, query.to)}>
                    {$t('isms.compare.read', { version: query.to })}
                  </Link>
                {:else}
                  <Link href={documentAddress(doc.id)}>
                    {$t('isms.compare.read-current')}
                  </Link>
                {/if}
              </dd>
            </div>
          </dl>
          {#if total === 0}
            <div data-testid="compare-equal">
              <Notice tone="info" title={$t('isms.compare.equal')} />
            </div>
          {:else}
            <p class="note">{$t('documents.release.record.count', { count: total })}</p>
            <DiffRecord
              {groups}
              shortLabels
              count={(count) => $t('documents.release.record.count', { count })}
              {value}
              testId="compare-record"
            />
          {/if}
        </section>
      {:else}
        <p class="muted">{$t('common.loading')}</p>
      {/if}
    {/if}
  </DashboardPage>
{/if}

<style>
  .muted {
    color: var(--color-text-muted);
  }

  .note {
    max-inline-size: var(--measure);
    color: var(--color-text-secondary);
  }

  .pickers {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .picker {
    flex: 1 1 18rem;
    min-inline-size: 0;
  }

  /* The act stands under the pickers, on the side of the labels, and its reason reads from the same side. */
  .pickers__act {
    flex: 0 0 100%;
  }

  .pickers__act :global(.btn-with-reason) {
    align-items: flex-start;
  }

  .pickers__act :global(.btn__reason) {
    text-align: start;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section__title {
    font-family: var(--font-serif);
    font-size: var(--text-xl);
    line-height: var(--line-height-xl);
    font-weight: var(--weight-semibold);
  }

  .sides {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4) var(--space-8);
  }

  .sides dt {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-secondary);
  }

  .sides dd {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-size: var(--text-sm);
    line-height: var(--line-height-sm);
  }

  .pairs {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .pairs :global(.link),
  .sides :global(.link) {
    display: inline-block;
    padding-block: var(--space-2);
  }

  /* A link of a list and the summary of a disclosure have the 44 px of a target on a phone. */
  @media (max-width: 767px) {
    .pairs :global(.link),
    .sides :global(.link) {
      padding-block: var(--space-3);
    }
  }
</style>
