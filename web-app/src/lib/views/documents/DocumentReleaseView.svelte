<script lang="ts" module>
  import type { Category } from '../../api/types';

  /**
   * A lens that has a category and addresses of its own for the release of its documents (the ISMS): the review and the
   * release are the generic ones, drawn on its addresses.
   */
  export interface DocumentLens {
    /** The category, known to the lens; the generic lens reads it from the categories. */
    category: Category;
    /** The id of the document. */
    document: string;
    /** The address of the document. */
    documentAddress: string;
    /** The address of its release page. */
    releaseAddress: string;
    /** The breadcrumb up to, not including, the document. */
    crumbs: { label: string; href: string }[];
    /** Whether the fields of the type have short labels and long values. */
    shortLabels?: boolean;
  }
</script>

<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import ReleaseSeal from '../../components/ReleaseSeal.svelte';
  import { apiClient } from '../../api/client';
  import { errorMessageKey, isApiError } from '../../api/errors';
  import type { CategorySchema, DocumentDiff, DocumentRead } from '../../api/types';
  import {
    actionsOn,
    categoryName,
    fieldLabel,
    findDocument,
    loadCategories,
  } from '../../documents/categories';
  import { groupDiff } from '../../documents/diff';
  import { versionOfTag } from '../../documents/history';
  import { createFormServices, provideFormServices } from '../../forms/services';
  import { missingRequired } from '../../forms/validate';
  import { formatDate, formatDateTime } from '../../format';
  import { currentLocale, messagesStore, t } from '../../i18n';
  import { formatAddress } from '../../routes';
  import { session } from '../../stores/app';
  import { breadcrumb } from '../../stores/breadcrumb';
  import NotFoundView from '../NotFoundView.svelte';
  import DiffValue from './DiffValue.svelte';
  import ReleaseFlow, {
    type ReleaseChange,
    type ReleaseCheck,
    type ReleaseDone,
    type ReleaseGroup,
    type ReleaseTexts,
  } from './ReleaseFlow.svelte';

  /**
   * The review and release of a document of the generic lens (UC-DOC-7, UC-DOC-8; AUN-WEB-6): the address
   * `/categories/{category}/{document}/release`, for every category without a lens of its own. It reads the document, its
   * schema and the structured diff against the last release, hands them to the generic `ReleaseFlow`, and draws what
   * belongs to a document of this lens: the facts of the document and the request of the agent that asked for the release
   * as the stage, the seal of the release once it is made, the values of the diff as the form reads them.
   *
   * An address of a category this lens does not show, or of a document that does not exist, is the not-found view; a
   * switched-off category stays readable and offers no release.
   */
  interface Props {
    /** The values of the address: `category` and `document`. */
    params: Record<string, string>;
    /** What a lens with addresses of its own hands in; without it the address names the category and the document. */
    lens?: DocumentLens;
  }

  let { params, lens }: Props = $props();

  /** The id of the document: the lens's or the address's. */
  let documentId = $derived(lens?.document ?? params.document);

  // One reading of references for the whole record: the names of people and the titles of documents are asked once.
  provideFormServices(createFormServices());

  let category = $state<Category | null>(null);
  let doc = $state<DocumentRead | null>(null);
  let schemas = $state<CategorySchema | null>(null);
  let diff = $state<DocumentDiff | null>(null);
  let failure = $state<string | null>(null);
  let missing = $state(false);

  /** The number of the latest read; the answer of an older one is dropped. */
  let latest = 0;

  /** Reads the document and its record: the second is what the approver reviews, so it is read after the first. */
  async function readRecord(current: Category) {
    const read = ++latest;
    try {
      const loaded = await findDocument(apiClient, current, documentId);
      const [loadedSchemas, loadedDiff] = await Promise.all([
        schemas?.category === current.id ? schemas : apiClient.getCategorySchema(current.id),
        // A released document has nothing to release: its record is the release it was made from, unchanged.
        loaded.state === 'released'
          ? Promise.resolve<DocumentDiff>({
              repository: loaded.repository,
              id: loaded.id,
              from: loaded.release?.tag ?? null,
              to: 'working',
              sections: [],
            })
          : apiClient.getDiff(loaded.repository, loaded.id),
      ]);
      if (read !== latest) return;
      // A document type whose schema the server does not serve is not an address of this lens.
      if (!loadedSchemas.kinds.some((entry) => entry.id === loaded.kind)) {
        missing = true;
        return;
      }
      doc = loaded;
      schemas = loadedSchemas;
      diff = loadedDiff;
      failure = null;
    } catch (error) {
      if (read !== latest) return;
      if (isApiError(error) && (error.outcome === 'NOT_FOUND' || error.outcome === 'VALIDATION')) {
        missing = true;
      } else {
        failure = errorMessageKey(error);
      }
    }
  }

  async function load() {
    failure = null;
    if (lens) {
      category = lens.category;
      await readRecord(lens.category);
      return;
    }
    try {
      const list = await loadCategories();
      const found = list.categories.find((entry) => entry.id === params.category);
      // A category that is not generic is no address of this lens.
      if (!found || !found.generic) {
        missing = true;
        return;
      }
      category = found;
      await readRecord(found);
    } catch (error) {
      failure = errorMessageKey(error);
    }
  }

  async function reload() {
    if (category) await readRecord(category);
  }

  $effect(() => {
    void params.category;
    void documentId;
    untrack(() => void load());
  });

  onDestroy(() => {
    latest += 1;
    breadcrumb.set([]);
  });

  let documentAddress = $derived(
    lens?.documentAddress ??
      formatAddress({
        route: 'categories.document',
        params: { category: params.category, document: params.document },
      }),
  );
  let releaseAddress = $derived(
    lens?.releaseAddress ??
      formatAddress({
        route: 'categories.release',
        params: { category: params.category, document: params.document },
      }),
  );

  $effect(() => {
    breadcrumb.set(
      !missing && category && doc
        ? [
            ...(lens?.crumbs ?? [
              {
                label: categoryName($messagesStore, category.id),
                href: `/categories/${category.id}`,
              },
            ]),
            { label: doc.title, href: documentAddress },
            { label: $t('lens.release'), href: releaseAddress },
          ]
        : [],
    );
  });

  let rights = $derived(doc ? actionsOn($session, doc.repository) : []);
  let schema = $derived(schemas?.kinds.find((entry) => entry.id === doc?.kind)?.schema ?? null);
  let part = $derived(doc ? doc.parts[Object.keys(doc.parts)[0] ?? 'data'] : undefined);
  let submitted = $derived(doc?.history.find((line) => line.kind === 'submit') ?? null);
  let from = $derived(diff?.from ? versionOfTag(diff.from) : null);

  let unavailable = $derived.by(() => {
    if (!doc) return null;
    if (category?.enabled === false) return $t('documents.read-only.switched-off');
    if (doc.state === 'released') return $t('documents.release.state.released');
    if (!rights.includes('approve')) return $t('release.no-right');
    // The workflow decides, not a state: the release is the transition it marks `release` (rest-api.adoc, `DocumentRead`).
    if (!doc.transitions.some((transition) => transition.release)) {
      return doc.state === 'draft'
        ? $t('documents.release.state.draft')
        : $t('documents.release.state.not-offered');
    }
    return null;
  });

  let texts: ReleaseTexts = $derived({
    title: $t('release.title', { title: doc?.title ?? $t('common.loading') }),
    intro: $t('documents.release.intro'),
    doneTitle: $t('release.done.title', { title: doc?.title ?? '' }),
    doneIntro: $t('documents.release.done.intro'),
    recordLede:
      diff === null
        ? ''
        : from === null
          ? $t('documents.release.record.first')
          : diff.sections.length === 0
            ? $t('documents.release.record.none', { version: from })
            : $t('documents.release.record.since', { version: from }),
    back: $t('documents.release.back'),
    open: $t('documents.release.open'),
    passwordLede: $t('release.password.lede', { title: doc?.title ?? '' }),
    releasedMeanwhile: 'documents.release.released-meanwhile',
    count: (count) => $t('documents.release.record.count', { count }),
  });

  let groups: ReleaseGroup[] = $derived(
    doc && diff
      ? groupDiff(diff, $messagesStore, doc.category, doc.kind, $t).map((group) => ({
          key: group.key,
          title: group.title,
          changes: group.rows.map((row) => ({ ...row })),
        }))
      : [],
  );

  let emptyFields = $derived(schema && part ? missingRequired(schema, part.value) : []);
  let checks: ReleaseCheck[] = $derived([
    emptyFields.length === 0
      ? { key: 'fields', text: $t('documents.release.check.fields'), icon: 'state.done' }
      : {
          key: 'fields',
          text: $t('documents.release.check.fields-open', { count: emptyFields.length }),
          icon: 'state.open',
          open: true,
        },
    ...(submitted
      ? [
          {
            key: 'submitted',
            text: $t('release.check.submitted', {
              name: submitted.by.name,
              time: formatDateTime(submitted.at, $currentLocale),
            }),
            icon: 'state.done' as const,
          },
        ]
      : []),
    // What the release will do is told only while it can be taken; a released document, a draft or a person without the
    // right is told why by the act, and the margin does not promise a release that will not happen.
    ...(unavailable === null
      ? [{ key: 'tag', text: $t('documents.release.check.tag'), icon: 'state.seal' as const }]
      : []),
  ]);

  /** @returns the words of a field the server found empty */
  function labelOf(pointer: string): string {
    return doc ? fieldLabel($messagesStore, doc.category, doc.kind, pointer) : pointer;
  }
</script>

{#snippet stage(released: ReleaseDone | null)}
  {#if doc && released}
    <ReleaseSeal
      version={versionOfTag(released.tag)}
      caption={$t('release.sealed')}
      label={$t('documents.release.seal', {
        title: doc.title,
        version: versionOfTag(released.tag),
      })}
      pressing
      testId="release-seal"
    />
  {:else if doc}
    <div class="facts-stage">
      <dl class="facts" data-testid="release-facts">
        <div>
          <dt>{$t('documents.release.fact.document')}</dt>
          <dd class="facts__title">{doc.title}</dd>
        </div>
        <div>
          <dt>{$t('documents.fact.version')}</dt>
          <dd>{doc.version}</dd>
        </div>
        {#if part}
          <div>
            <dt>{$t('documents.fact.saved')}</dt>
            <dd>
              {$t('documents.fact.saved.value', {
                name: part.savedBy.name,
                when: formatDateTime(part.savedAt, $currentLocale),
              })}
            </dd>
          </div>
        {/if}
      </dl>
      {#if doc.releaseRequest}
        <section class="request" data-testid="release-request">
          <h3 class="request__title">{$t('documents.margin.request')}</h3>
          <p class="request__by">
            {$t('documents.request.by', {
              name: doc.releaseRequest.by.name,
              date: formatDate(doc.releaseRequest.at, $currentLocale),
            })}
          </p>
          <p class="request__comment">{doc.releaseRequest.comment}</p>
        </section>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet value(change: ReleaseChange, side: 'before' | 'after')}
  {#if doc && schema}
    <DiffValue
      {schema}
      category={doc.category}
      kind={doc.kind}
      pointer={change.pointer}
      value={side === 'before' ? change.before : change.after}
    />
  {/if}
{/snippet}

{#if missing}
  <NotFoundView />
{:else}
  <ReleaseFlow
    repository={doc?.repository ?? ''}
    id={doc?.id ?? ''}
    {texts}
    ready={!!doc && !!schema && !!diff}
    {failure}
    {groups}
    {unavailable}
    {checks}
    shortLabels={lens?.shortLabels ?? false}
    backHref={documentAddress}
    openHref={documentAddress}
    fieldLabel={labelOf}
    onreload={reload}
    {stage}
    {value}
  />
{/if}

<style>
  .facts-stage {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    inline-size: 100%;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4) var(--space-8);
  }

  .facts dt {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-secondary);
  }

  .facts dd {
    font-size: var(--text-sm);
    line-height: var(--line-height-sm);
  }

  .facts__title {
    font-family: var(--font-serif);
    font-size: var(--text-lg);
    line-height: var(--line-height-lg);
    font-weight: var(--weight-semibold);
  }

  .request {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-inline-size: var(--measure);
  }

  .request__title {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-secondary);
  }

  .request__by {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    color: var(--color-text-secondary);
  }

  .request__comment {
    padding-inline-start: var(--space-3);
    border-inline-start: 3px solid var(--color-border-strong);
    font-family: var(--font-serif);
    font-size: var(--text-md);
    overflow-wrap: anywhere;
  }
</style>
