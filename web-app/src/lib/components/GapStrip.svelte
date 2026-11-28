<script lang="ts" module>
  /** A level the column window hides. */
  export interface HiddenLevel {
    key: string;
    kind: import('./KindMark.svelte').Kind;
    kindLabel: string;
    title: string;
  }
</script>

<script lang="ts">
  import KindMark from './KindMark.svelte';

  /**
   * The levels a column window hides (`TriagePage`): on the left, each with its mark and, where room allows, its
   * name — selecting one peeks at it; on the right after a peek, the marks of the levels it hid — selecting them
   * returns to the object. A peek changes no address and no selection.
   */
  interface Props {
    /** Which edge: the hidden levels on the left, or the return on the right. */
    side: 'left' | 'right';
    /** The hidden levels, left to right. */
    levels: HiddenLevel[];
    /** Whether the names show beside the marks (left strip only). */
    names?: boolean;
    /** The accessible name of the strip. */
    label: string;
    /** Called with the index of the level selected (left), or with `null` (right). */
    onselect: (index: number | null) => void;
  }

  let { side, levels, names = false, label, onselect }: Props = $props();
</script>

<nav class="strip strip--{side}" aria-label={label} data-testid="triage-strip-{side}">
  {#if side === 'left'}
    <ol class="strip__list">
      {#each levels as level, index (level.key)}
        <li>
          <button
            class="strip__item"
            type="button"
            title={names ? undefined : `${level.kindLabel}: ${level.title}`}
            onclick={() => onselect(index)}
            data-testid="strip-{level.key}"
          >
            <KindMark kind={level.kind} label={level.kindLabel} iconOnly />
            {#if names}
              <span class="strip__name">{level.title}</span>
            {:else}
              <span class="sr-only">{level.title}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ol>
  {:else}
    <button
      class="strip__return"
      type="button"
      onclick={() => onselect(null)}
      data-testid="strip-return"
    >
      {#each levels as level (level.key)}
        <KindMark kind={level.kind} label={level.kindLabel} iconOnly />
      {/each}
      <span class="sr-only">{label}</span>
    </button>
  {/if}
</nav>

<style>
  .strip__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    list-style: none;
  }

  .strip__item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    inline-size: 100%;
    min-block-size: 36px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    border-inline-start: 2px solid var(--color-border-strong);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    text-align: start;
  }

  .strip__item:hover {
    background-color: var(--color-bg-sunken);
    color: var(--color-text-primary);
  }

  /* A name takes two lines before it is clipped: "Documents and register" stays readable in the 136 px of the strip. */
  .strip__name {
    min-inline-size: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow-wrap: anywhere;
    line-height: 1.3;
  }

  .strip__return {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    inline-size: 100%;
    padding: var(--space-2) 0;
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-sunken);
  }
</style>
