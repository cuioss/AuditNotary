<script lang="ts">
  import ColumnHead from '../../components/ColumnHead.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Notice from '../../components/Notice.svelte';
  import RowLink from '../../components/RowLink.svelte';
  import StatusLabel from '../../components/StatusLabel.svelte';
  import type { DocumentSummary } from '../../api/types';
  import { kindName } from '../../documents/categories';
  import { t, messagesStore } from '../../i18n';
  import {
    DOCUMENT_KINDS,
    ISMS_ADDRESS,
    ISMS_CATEGORY,
    REGISTER_ADDRESS,
    documentsAddress,
  } from '../../isms/model';

  /**
   * The first column of the lens ISMS (UC-ISMS-1): the document types with how many documents each holds and how many are
   * in review, and the way into the risk register. A row opens the documents of that type; the first row opens every
   * document. A person who may not read the documents is told so and still finds the register.
   */
  interface Props {
    /** The documents of `isms-core`, or `null` while they are read. */
    documents: DocumentSummary[] | null;
    /** Whether the person may not read the documents. */
    forbidden?: boolean;
    /** Whether the person may read the register, which this column links to. */
    register?: boolean;
    /** The selected document type; `null` for none. */
    selected: string | null;
    /** Whether the list of every document is the open one. */
    all?: boolean;
  }

  let { documents, forbidden = false, register = true, selected, all = false }: Props = $props();

  /** @returns the documents of a type, or of every type */
  function of(kind: string | null): DocumentSummary[] {
    return (documents ?? []).filter((entry) => kind === null || entry.kind === kind);
  }

  /** @returns how many documents of a type wait in review */
  function inReview(kind: string | null): number {
    return of(kind).filter((entry) => entry.state === 'in-review').length;
  }
</script>

<ColumnHead
  kind="isms"
  kindLabel={$t('lens.isms')}
  title={$t('isms.start.title')}
  href={ISMS_ADDRESS}
/>
<div class="column" data-testid="types-column">
  {#if forbidden}
    <div class="column__notice" data-testid="isms-forbidden">
      <Notice tone="info" title={$t('isms.forbidden.title')} body={$t('isms.forbidden.body')} />
    </div>
  {:else if documents === null}
    <p class="column__loading">{$t('common.loading')}</p>
  {:else}
    <ul class="column__list" data-testid="type-list">
      <li>
        <RowLink href={documentsAddress()} selected={all} testId="type-all">
          <span class="row__title">{$t('isms.types.all')}</span>
          <span class="row__meta">{$t('isms.types.count', { count: documents.length })}</span>
        </RowLink>
      </li>
      {#each DOCUMENT_KINDS as kind (kind)}
        <li>
          <RowLink
            href={documentsAddress(kind)}
            selected={kind === selected && !all}
            testId="type-{kind}"
          >
            <span class="row__title">{kindName($messagesStore, ISMS_CATEGORY, kind)}</span>
            <span class="row__line">
              <span class="row__meta">{$t('isms.types.count', { count: of(kind).length })}</span>
              {#if inReview(kind) > 0}
                <StatusLabel
                  tone="running"
                  label={$t('isms.types.in-review', { count: inReview(kind) })}
                />
              {/if}
            </span>
          </RowLink>
        </li>
      {/each}
    </ul>
    {#if documents.length === 0}
      <div data-testid="types-empty">
        <EmptyState
          icon="state.na"
          title={$t('isms.types.empty.title')}
          body={$t('isms.types.empty.body')}
        />
      </div>
    {/if}
  {/if}
  {#if register}
    <ul class="column__list column__list--register">
      <li>
        <RowLink href={REGISTER_ADDRESS} testId="register-link">
          <span class="row__title">{$t('isms.register.title')}</span>
          <span class="row__meta">{$t('isms.register.lede')}</span>
        </RowLink>
      </li>
    </ul>
  {/if}
</div>

<style>
  .column__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
  }

  .column__list--register {
    margin-block-start: var(--space-4);
    padding-block-start: var(--space-3);
    border-block-start: 1px solid var(--color-border);
  }

  .column__loading {
    padding: var(--space-4);
    color: var(--color-text-muted);
  }

  .column__notice {
    padding: 0 var(--space-4) var(--space-3);
  }

  .row__title {
    font-family: var(--font-serif);
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }

  .row__line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
  }

  .row__meta {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
