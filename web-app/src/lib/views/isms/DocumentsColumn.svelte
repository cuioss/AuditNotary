<script lang="ts">
  import Button from '../../components/Button.svelte';
  import ColumnHead from '../../components/ColumnHead.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Link from '../../components/Link.svelte';
  import ReasonBadge from '../../components/ReasonBadge.svelte';
  import RowLink from '../../components/RowLink.svelte';
  import StatusLabel from '../../components/StatusLabel.svelte';
  import type { DocumentSummary } from '../../api/types';
  import { kindName } from '../../documents/categories';
  import { versionOfTag } from '../../documents/history';
  import { formatDate } from '../../format';
  import { currentLocale, messagesStore, t } from '../../i18n';
  import { ISMS_CATEGORY, documentsAddress, newDocumentAddress } from '../../isms/model';
  import { stateTone } from '../samm/workflow';

  /**
   * The second column of the lens ISMS (UC-ISMS-1): the documents of one type, or of every type, newest change first. A row
   * says where the document stands: its state, the release it holds (a document is released more than once, so the version
   * of the last release says how many there were), and who changed it last. A document with a release request waiting is a
   * box, because someone needs to act; the act *New document* needs the edit right and says so when it is missing.
   */
  interface Props {
    /** The document type; `null` lists every type. */
    kind: string | null;
    /** The documents, newest change first, or `null` while they are read. */
    documents: DocumentSummary[] | null;
    /** Whether the server holds more documents than the list. */
    truncated?: boolean;
    /** The selected document. */
    selected: string | null;
    /** Whether the person may create a document (the right `edit` on the repository). */
    canCreate: boolean;
    /** Whether the list is the page's object, with no document beside it: it has room. */
    object?: boolean;
  }

  let { kind, documents, truncated = false, selected, canCreate, object = false }: Props = $props();

  let shown = $derived((documents ?? []).filter((entry) => kind === null || entry.kind === kind));
</script>

<div class="column" class:column--object={object} data-testid="documents-column">
  <ColumnHead
    kind="category"
    kindLabel={$t('isms.kind.type')}
    title={kind ? kindName($messagesStore, ISMS_CATEGORY, kind) : $t('isms.types.all')}
    href={documentsAddress(kind)}
  >
    {#snippet meta()}
      {#if documents !== null}{$t('documents.list.count', { count: shown.length })}{/if}
    {/snippet}
  </ColumnHead>

  <div class="column__acts" data-testid="document-new">
    {#if canCreate}
      <Link href={newDocumentAddress(kind)} look="primary" data-testid="new-document">
        {$t('documents.new')}
      </Link>
    {:else}
      <Button icon="act.next" disabledReason={$t('documents.list.new.no-right')}>
        {$t('documents.new')}
      </Button>
    {/if}
  </div>

  {#if documents === null}
    <p class="column__loading">{$t('common.loading')}</p>
  {:else if shown.length === 0}
    <EmptyState
      icon="state.na"
      title={$t('documents.list.empty.title')}
      body={canCreate ? $t('documents.list.empty.body') : $t('documents.list.empty.read-only')}
    />
  {:else}
    <ul class="column__list" data-testid="document-list">
      {#each shown as entry (entry.id)}
        <li>
          <RowLink
            href={entry.address}
            selected={entry.id === selected}
            testId="document-{entry.id}"
          >
            <span class="row__title">{entry.title}</span>
            <span class="row__line">
              <StatusLabel
                tone={stateTone(entry.state)}
                label={entry.state === 'released' && entry.release
                  ? $t('workflow.released-as', { version: versionOfTag(entry.release.tag) })
                  : $t(`workflow.${entry.state}`)}
              />
              {#if entry.requested}
                <ReasonBadge label={$t('documents.list.requested')} />
              {/if}
            </span>
            {#if kind === null}
              <span class="row__meta">{kindName($messagesStore, ISMS_CATEGORY, entry.kind)}</span>
            {/if}
            {#if entry.release}
              <span class="row__meta">
                {$t('isms.row.release', {
                  version: versionOfTag(entry.release.tag),
                  date: formatDate(entry.release.at, $currentLocale),
                })}
              </span>
            {/if}
            {#if entry.state !== 'released'}
              <span class="row__meta">
                {$t('isms.row.working', {
                  version: entry.version,
                  date: formatDate(entry.updatedAt, $currentLocale),
                  name: entry.updatedBy.name,
                })}
              </span>
            {/if}
          </RowLink>
        </li>
      {/each}
    </ul>
    {#if truncated}
      <p class="column__note">{$t('documents.list.truncated', { count: shown.length })}</p>
    {/if}
  {/if}
</div>

<style>
  .column--object {
    max-inline-size: 44rem;
  }

  .column__acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding-block: var(--space-3);
  }

  /* The act stands at the start of the column: the reason that it is not available reads from the start too. */
  .column__acts :global(.btn-with-reason) {
    align-items: flex-start;
  }

  .column__acts :global(.btn__reason) {
    text-align: start;
  }

  .column__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
  }

  .column__loading,
  .column__note {
    padding: var(--space-4);
    color: var(--color-text-muted);
  }

  .column__note {
    font-size: var(--text-sm);
  }

  .row__title {
    font-weight: var(--weight-medium);
  }

  .row__line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
  }

  .row__meta {
    display: block;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
