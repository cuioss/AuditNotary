<script lang="ts">
  import type { Snippet } from 'svelte';
  import Disclosure from '../../components/Disclosure.svelte';
  import type { ReleaseChange, ReleaseGroup } from './ReleaseFlow.svelte';

  /**
   * The changes of a record as the approver and the reader of a comparison read them: one folding section per property of
   * the document, each change with the words of its field, the value before struck through and the value after marked as
   * added. The release page (`ReleaseFlow`) and the comparison of two releases draw it the same way; what a value is drawn
   * as is handed in.
   */
  interface Props {
    /** The sections of the record. */
    groups: ReleaseGroup[];
    /** Whether the sections stand folded. */
    folded?: boolean;
    /** Whether the fields have short labels and long values (a form's fields): the values get the room. */
    shortLabels?: boolean;
    /** @returns how many changes a section holds */
    count: (count: number) => string;
    /** One side of a change. */
    value: Snippet<[ReleaseChange, 'before' | 'after']>;
    /** The test id of the record. */
    testId?: string;
  }

  let {
    groups,
    folded = false,
    shortLabels = false,
    count,
    value,
    testId = 'release-record',
  }: Props = $props();
</script>

<div class="record" data-testid={testId}>
  {#each groups as group (group.key)}
    <Disclosure testId="record-{group.key}" open={!folded}>
      {#snippet summary()}
        <span class="record__summary">
          <span class="record__name">{group.title}</span>
          <span class="record__count">{count(group.changes.length)}</span>
        </span>
      {/snippet}
      <ul class="changes">
        {#each group.changes as change (change.key)}
          <li
            class="change"
            class:change--bare={change.label === ''}
            class:change--short={shortLabels}
          >
            {#if change.label !== ''}
              <span class="change__question">{change.label}</span>
            {/if}
            <span class="change__values">
              {#if change.before !== null && change.before !== undefined}
                <del class="change__before">{@render value(change, 'before')}</del>
              {/if}
              <ins class="change__after">{@render value(change, 'after')}</ins>
            </span>
          </li>
        {/each}
      </ul>
    </Disclosure>
  {/each}
</div>

<style>
  .record {
    display: flex;
    flex-direction: column;
    border-block-start: 1px solid var(--color-border);
  }

  .record > :global(*) {
    border-block-end: 1px solid var(--color-border);
    padding-block: var(--space-1);
  }

  .record__summary {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .record__name {
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
    color: var(--color-text-primary);
  }

  .record__count {
    flex: 0 0 auto;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .changes {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    list-style: none;
    padding-block-end: var(--space-3);
  }

  .change {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: var(--space-4);
    font-size: var(--text-sm);
  }

  .change--short {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  }

  .change--bare {
    grid-template-columns: minmax(0, 1fr);
  }

  .change__question {
    color: var(--color-text-secondary);
  }

  .change__values {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  .change__before {
    align-self: flex-start;
    color: var(--color-text-muted);
    background-color: var(--color-diff-removed);
    text-decoration-color: var(--color-danger);
    padding-inline: var(--space-1);
  }

  .change__after {
    align-self: flex-start;
    padding-inline: var(--space-1);
    background-color: var(--color-diff-added);
    color: var(--color-text-primary);
    text-decoration: none;
  }

  @media (max-width: 767px) {
    .change {
      grid-template-columns: 1fr;
      gap: var(--space-1);
    }

    /* The summary of a group of the record is a target: 44 px on a phone (AUN-WEB-2). */
    .record :global(.disclosure__summary) {
      min-block-size: 44px;
    }
  }
</style>
