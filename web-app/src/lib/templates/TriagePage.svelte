<script lang="ts" module>
  import type { Kind } from '../components/KindMark.svelte';

  /** One level of the chain a page shows: SAMM › scope › assessment › practice. */
  export interface Level {
    /** The level's identity, the key of its column. */
    key: string;
    /** The level's kind, for its mark in the strip and its column head. */
    kind: Kind;
    /** The word of the kind. */
    kindLabel: string;
    /** The level's title. */
    title: string;
    /** The level's own address: opening it closes the levels to its right. */
    href: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tick } from 'svelte';
  import GapStrip from '../components/GapStrip.svelte';
  import Icon from '../components/Icon.svelte';
  import Link from '../components/Link.svelte';
  import { MEASURE_FALLBACK, pageInset, windowFor } from './columnWindow';

  /**
   * The column template of the lenses with a chain of levels (doc/concepts/web-app.adoc, Structure of the App): one
   * column per level, the selected object on the right, as many as the template's own width admits
   * (`columnWindow.ts`, taken over from pm-web-app).
   *
   * The visual language is the register's (doc/concepts/visual-design.adoc, Columns as a File Drawer): the list
   * columns lie on the desk, the object column holds the sheet, raised above them. Levels the window hides to the left
   * stand in a strip — with their names, or their marks where room is short; selecting one peeks at it without
   * changing the address, and a return strip on the right goes back. With one column there is no strip: an "Up" link
   * opens the parent level.
   *
   * When the object changes, focus moves to its heading and the move is announced, so a keyboard or screen reader user
   * lands where the content is.
   */
  interface Props {
    /** The chain, left to right; the last level is the object. */
    levels: Level[];
    /** Renders one level's column; `object` is true for the object column. */
    column: Snippet<[Level, { object: boolean; width: number }]>;
    /** The object column's minimum width (`columnWindow.ts`, `objectMin`). */
    objectMin?: number;
    /** The accessible name of the strip of hidden levels. */
    stripLabel: string;
    /** The label of the return strip. */
    returnLabel: string;
    /** The label of the "Up" link with one column; `{title}` is the parent. */
    upLabel: (parent: Level) => string;
    /** The announcement of a new object; `{title}` is its title. */
    announce: (object: Level) => string;
    /** A test id. */
    testId?: string;
  }

  let { levels, column, objectMin, stripLabel, returnLabel, upLabel, announce, testId }: Props =
    $props();

  let width = $state(0);
  let peek: number | null = $state(null);
  let announcement = $state('');
  let root: HTMLDivElement | undefined = $state();

  let measured = $derived(width > 0 ? width : MEASURE_FALLBACK);
  let win = $derived(windowFor({ container: measured, depth: levels.length, peek, objectMin }));
  let visible = $derived(levels.slice(win.start, win.start + win.columns));
  let hiddenLeft = $derived(levels.slice(0, win.hiddenLeft));
  let hiddenRight = $derived(levels.slice(win.start + win.columns));
  let objectKey = $derived(levels.at(-1)?.key ?? '');
  let parent = $derived(win.columns === 1 && levels.length > 1 ? levels[levels.length - 2] : null);

  // A new object ends a peek and takes the focus.
  let lastObject = '';
  // Whether an object was ever shown: an empty chain in between does not make the next object the first again.
  let shownBefore = false;
  $effect(() => {
    const key = objectKey;
    if (key === lastObject) return;
    lastObject = key;
    if (key === '') return;
    const first = !shownBefore;
    shownBefore = true;
    peek = null;
    const object = levels.at(-1);
    if (first || !object) return;
    announcement = announce(object);
    void tick().then(() => {
      const heading = root?.querySelector<HTMLElement>('[data-object-column] h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: false });
      }
    });
  });

  /**
   * Peeks at a hidden level, or returns from a peek. The strip button that was pressed goes away, so focus moves on:
   * to the heading of the first column now shown, or back to the object's heading.
   */
  async function peekAt(index: number | null) {
    peek = index;
    await tick();
    const target =
      index === null
        ? root?.querySelector<HTMLElement>('[data-object-column] h1')
        : root?.querySelector<HTMLElement>('.triage__column h1, .triage__column h2');
    if (target) {
      target.tabIndex = -1;
      target.focus();
    }
  }
</script>

<div
  class="triage"
  bind:this={root}
  bind:clientWidth={width}
  style:--triage-inset={`${pageInset(measured)}px`}
  data-testid={testId}
  data-columns={win.columns}
  data-strip={win.strip}
>
  {#if parent}
    <span class="triage__up">
      <Link href={parent.href} quiet data-testid="triage-up">
        <Icon name="act.back" size={16} />
        {upLabel(parent)}
      </Link>
    </span>
  {/if}
  <div class="triage__window">
    {#if hiddenLeft.length > 0 && win.strip !== 'none'}
      <div class="triage__strip" style:--strip-width={`${win.stripWidth}px`}>
        <GapStrip
          side="left"
          levels={hiddenLeft}
          names={win.strip === 'names'}
          label={stripLabel}
          onselect={(index) => peekAt(index)}
        />
      </div>
    {/if}

    {#each visible as level, index (level.key)}
      {@const object = win.start + index === levels.length - 1}
      {@const columnWidth = win.columnWidths[index] ?? 0}
      <section
        class="triage__column"
        class:triage__column--object={object}
        class:triage__column--list={!object}
        style:--column-width={win.columns > 1 ? `${columnWidth}px` : undefined}
        aria-label={object ? undefined : `${level.kindLabel}: ${level.title}`}
        data-object-column={object ? '' : undefined}
        data-level={level.key}
      >
        {@render column(level, { object, width: columnWidth })}
      </section>
    {/each}

    {#if win.returnStrip}
      <div class="triage__return">
        <GapStrip
          side="right"
          levels={hiddenRight}
          label={returnLabel}
          onselect={() => peekAt(null)}
        />
      </div>
    {/if}
  </div>
  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</div>

<style>
  .triage {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-inline-size: 0;
    padding: var(--space-5) var(--triage-inset) var(--space-10);
  }

  .triage__window {
    display: flex;
    align-items: flex-start;
    min-inline-size: 0;
  }

  .triage__column {
    flex: 0 0 var(--column-width, 100%);
    min-inline-size: 0;
    max-inline-size: var(--column-width, 100%);
  }

  /* A list column lies on the desk; it stays in view while the sheet beside it scrolls. */
  .triage__column--list {
    position: sticky;
    inset-block-start: calc(56px + var(--space-5));
    max-block-size: calc(100dvh - 56px - var(--space-10));
    overflow-y: auto;
    padding-inline-end: var(--space-3);
    scrollbar-gutter: stable;
  }

  .triage__column--list + .triage__column--list {
    padding-inline-start: var(--space-3);
    border-inline-start: 1px solid var(--color-border);
  }

  /* The object column holds the sheet, raised above the list beside it. */
  .triage__column--object {
    position: relative;
    z-index: var(--layer-sticky);
  }

  .triage__column--list + .triage__column--object {
    padding-inline-start: var(--space-2);
  }

  .triage__strip {
    position: sticky;
    inset-block-start: calc(56px + var(--space-5));
    flex: 0 0 var(--strip-width);
    /* A long name of a hidden level is clipped in the strip; it never widens the strip past the window's measure. */
    min-inline-size: 0;
    padding-inline-end: var(--space-3);
  }

  .triage__return {
    position: sticky;
    inset-block-start: calc(56px + var(--space-5));
    flex: 0 0 44px;
    padding-inline-start: var(--space-2);
  }

  .triage__up {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    min-block-size: 44px;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .triage__up :global(.link) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-block-size: 44px;
  }
</style>
