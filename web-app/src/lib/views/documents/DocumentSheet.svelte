<script lang="ts">
  import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Chip from '../../components/Chip.svelte';
  import HistoryList from '../../components/HistoryList.svelte';
  import Link from '../../components/Link.svelte';
  import Notice from '../../components/Notice.svelte';
  import SaveState from '../../components/SaveState.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import SheetHead from '../../components/SheetHead.svelte';
  import StatusLabel from '../../components/StatusLabel.svelte';
  import type {
    Category,
    DocumentRead,
    DocumentTransition,
    JsonSchema,
    Revision,
  } from '../../api/types';
  import { actionsOn, fieldLabel, kindName, transitionName } from '../../documents/categories';
  import { DocumentController, type DocumentSnapshot } from '../../documents/controller.svelte';
  import { documentHistory, versionOfTag } from '../../documents/history';
  import { saveLabel } from '../../documents/saveLabel';
  import SchemaForm from '../../forms/SchemaForm.svelte';
  import { formatDate, formatDateTime, formatTime } from '../../format';
  import { currentLocale, messagesStore, t } from '../../i18n';
  import { formatAddress } from '../../routes';
  import StepUpDialog from '../../stepup/StepUpDialog.svelte';
  import { session } from '../../stores/app';
  import { now } from '../../stores/clock';
  import { stateTone } from '../samm/workflow';
  import ConflictPanel from './ConflictPanel.svelte';
  import RevisionPicker from './RevisionPicker.svelte';
  import TransitionBar from './TransitionBar.svelte';

  /**
   * A document of the generic lens as a sheet (UC-DOC-2, -3, -4, -6; AUN-WEB-4, AUN-WEB-5): the form generated from its
   * schema, read-only when the document is frozen, an earlier state, switched off or not the person's to edit; the
   * workflow's steps; the margin with the save state, the signed history, the release and the earlier states.
   *
   * What every document sheet shares (the draft, the save, the conflicts, the step-up, the refresh) is the document
   * controller's; the sheet keeps what is the document's: the form, the steps, the words. It reads nothing itself: the
   * view hands it the read and reads it again when the sheet asks (`onrefresh`).
   */
  interface Props {
    /** The document as read: the current state, or with `at` an earlier one. */
    document: DocumentRead;
    /** The category the document belongs to. */
    category: Category;
    /** The schema of the document's type. */
    schema: JsonSchema;
    /** The revisions of the document, newest first; `null` while loading or when they could not be listed. */
    revisions: Revision[] | null;
    /** Whether the server holds more revisions than the list. */
    revisionsTruncated?: boolean;
    /** Whether listing the revisions failed. */
    revisionsFailed?: boolean;
    /** Called when the view should read the document again: after a save, a step, a release meanwhile. */
    onrefresh: () => void;
    /** Opens an address inside the app. */
    onnavigate: (href: string) => void;
    /**
     * The address of the document as it was at a revision (`null` for the current state), for a lens that has addresses of
     * its own for its documents; the address of the generic lens by default.
     */
    addressFor?: (ref: string | null) => string;
    /** The address of the review and release of the document; the generic lens's by default. */
    releaseAddress?: string;
    /** Facts of the lens's document type, after the version and the save, such as the review date. */
    moreFacts?: { term: string; value: string }[];
    /** What the lens adds to the margin, between the release and the earlier states (a link to the comparison). */
    aside?: Snippet;
  }

  let {
    document: doc,
    category,
    schema,
    revisions,
    revisionsTruncated = false,
    revisionsFailed = false,
    onrefresh,
    onnavigate,
    addressFor,
    releaseAddress,
    moreFacts = [],
    aside,
  }: Props = $props();

  let announcement = $state('');
  let busy = $state<string | null>(null);
  let askSave = $state<DocumentTransition | null>(null);
  let missingShown = $state(true);
  /** What the step-up dialog asks to confirm: a save, or a step of the workflow. */
  let confirming = $state<{ act: string; lede: string }>({ act: '', lede: '' });
  let form: SchemaForm | undefined = $state();
  let statusEl: HTMLElement | undefined = $state();

  let rights = $derived(actionsOn($session, doc.repository));
  let switchedOff = $derived(category.enabled === false);
  let reading = $derived(doc.at ?? null);
  let partName = $derived(Object.keys(doc.parts)[0] ?? 'data');
  let part = $derived(doc.parts[partName]);
  let canEdit = $derived(rights.includes('edit') && !switchedOff && reading === null);
  let address = $derived(
    addressFor
      ? addressFor(null)
      : formatAddress({
          route: 'categories.document',
          params: { category: category.id, document: doc.id },
        }),
  );
  let releaseHref = $derived(
    releaseAddress ??
      formatAddress({
        route: 'categories.release',
        params: { category: category.id, document: doc.id },
      }),
  );

  // The first draw already knows the document: the controller is told before anything is drawn. The sheet belongs to one
  // document (the view remounts it for another), so the repository never changes.
  const controller = new DocumentController({
    repository: untrack(() => doc.repository),
    onsaved: () => onrefresh(),
    onrefresh: () => onrefresh(),
    onremote: ({ by }) => {
      announcement = $t('documents.saved-by-other', { name: by.name });
    },
  });
  /** Whether the person's own draft came back with the document, and when it was kept. */
  const restored = untrack(() => (canEdit && !doc.frozen ? doc.draft : null));

  $effect.pre(() => {
    const next: DocumentSnapshot = {
      document: doc.id,
      part: partName,
      blob: part?.blob ?? '',
      savedBy: part?.savedBy ?? null,
      value: part?.value,
      draft: canEdit && !doc.frozen ? doc.draft : null,
      frozen: doc.frozen || reading !== null,
      canEdit,
    };
    untrack(() => controller.sync(next));
  });

  // An earlier state never changes, so there is nothing to follow; the current one is read again when the stream names it.
  onMount(() => (reading ? undefined : controller.watch()));
  onDestroy(() => controller.destroy());

  // A new refusal for empty mandatory fields shows its list again.
  $effect(() => {
    if (controller.missing.length > 0) missingShown = true;
  });

  let frozen = $derived(controller.readonlyReason === 'frozen' && !switchedOff && reading === null);
  let readonly = $derived(controller.readonly);
  let missing = $derived(
    controller.missing.map((pointer) => ({
      pointer,
      label: fieldLabel($messagesStore, category.id, doc.kind, pointer),
    })),
  );
  let open = $derived(controller.open);
  /**
   * The conflicts with the own side as the page holds it now: a field changed again while it waits for the decision shows
   * the value that "keep my version" would save, never the value of the refused save.
   */
  let shownConflicts = $derived(
    Object.fromEntries(
      Object.entries(controller.conflicts).map(([pointer, conflict]) => [
        pointer,
        Object.hasOwn(controller.edits, pointer)
          ? { ...conflict, own: controller.edits[pointer] }
          : conflict,
      ]),
    ),
  );
  let saveWaits = $derived(
    controller.dirty ||
      open > 0 ||
      controller.saveState === 'saving' ||
      controller.saveState === 'failed',
  );
  /** The change of a released document that was frozen only by the page's own read: the failure says so by itself. */
  let failure = $derived(
    controller.missing.length > 0 || (frozen && controller.releasedMeanwhile !== null)
      ? null
      : controller.failure,
  );

  let readonlyLabel = $derived.by(() => {
    if (!readonly) return null;
    if (switchedOff) return $t('documents.read-only.switched-off');
    if (reading) return $t('documents.read-only.revision');
    return controller.readonlyReason === 'frozen'
      ? $t('documents.read-only.frozen')
      : $t('documents.read-only.right');
  });
  let label = $derived(
    readonlyLabel ??
      (controller.saveState === 'conflict'
        ? $t('documents.save.conflict', { count: open })
        : saveLabel(controller, $t, $currentLocale, null)),
  );

  /** @returns the words of a step of the workflow */
  function actOf(transition: DocumentTransition): string {
    return transition.release
      ? $t('release.act')
      : transitionName($messagesStore, category.id, transition.id);
  }

  /**
   * Saves for everyone. The confirmation names the save, so it belongs to this request alone: while a step runs, the button
   * is out of reach and `persist` is only entered from the step's own "save first".
   */
  async function save() {
    if (busy !== null) return;
    await persist();
  }

  async function persist() {
    confirming = {
      act: $t('documents.save'),
      lede: $t('stepup.lede.save', { title: doc.title }),
    };
    await controller.save();
  }

  async function run(transition: DocumentTransition) {
    busy = transition.id;
    confirming = {
      act: actOf(transition),
      lede: $t('documents.stepup.lede', { act: actOf(transition), title: doc.title }),
    };
    try {
      const result = await controller.transition(transition);
      if (result.kind === 'unsaved') {
        askSave = transition;
      } else if (result.kind === 'transitioned') {
        askSave = null;
        announcement = $t('documents.transition.done', {
          title: doc.title,
          state: $t(`workflow.${result.state}`),
        });
      }
    } finally {
      busy = null;
    }
  }

  /** The person takes a step: with changes only they have, it asks to save first. */
  async function act(transition: DocumentTransition) {
    if (busy !== null) return;
    if (controller.dirty) {
      askSave = transition;
      return;
    }
    askSave = null;
    await run(transition);
  }

  /** Saves for everyone, then takes the step that was waiting for it. */
  async function saveFirst() {
    const transition = askSave;
    if (!transition || busy !== null) return;
    // Held for the save: no other step can be chosen meanwhile, so the step that runs is the one that asked.
    busy = transition.id;
    try {
      await persist();
    } finally {
      busy = null;
    }
    if (controller.dirty || controller.saveState !== 'saved') return;
    askSave = null;
    await run(transition);
  }

  function goToField(pointer: string) {
    form?.focusField(pointer);
  }

  function backToEditing() {
    missingShown = false;
    const first = controller.missing[0];
    if (first) goToField(first);
  }

  let version = $derived(versionOfTag(doc.release?.tag ?? ''));
  let stateLabel = $derived(
    doc.state === 'released' && doc.release
      ? $t('workflow.released-as', { version })
      : $t(`workflow.${doc.state}`),
  );
  let stepUpLines = $derived(
    reading || switchedOff
      ? []
      : [
          ...new Set(
            doc.transitions
              .filter((transition) => transition.stepUp && rights.includes(transition.right))
              .map((transition) =>
                transition.release
                  ? $t('release.check.step-up')
                  : $t('documents.transition.step-up'),
              ),
          ),
        ],
  );
  let facts = $derived([
    { term: $t('documents.fact.version'), value: String(doc.version) },
    ...(part
      ? [
          {
            term: $t('documents.fact.saved'),
            value: $t('documents.fact.saved.value', {
              name: part.savedBy.name,
              when: formatDateTime(part.savedAt, $currentLocale),
            }),
          },
        ]
      : []),
    ...moreFacts,
  ]);
</script>

<Sheet testId="document-sheet" marginLabel={$t('sheet.margin')}>
  <SheetHead
    kind="document"
    kindLabel={kindName($messagesStore, category.id, doc.kind)}
    title={doc.title}
    size="title"
    {facts}
  >
    {#snippet state()}
      <StatusLabel tone={stateTone(doc.state)} label={stateLabel} testId="document-state" />
    {/snippet}
  </SheetHead>

  <StepUpDialog
    handler={controller.stepUp}
    lede={confirming.lede}
    actLabel={confirming.act}
    icon="act.save"
    testId="document"
  />

  {#if switchedOff}
    <div class="notice">
      <Notice
        tone="info"
        title={$t('documents.switched-off.title')}
        body={$t('documents.switched-off.body')}
      />
    </div>
  {/if}
  {#if reading}
    <div class="notice" data-testid="revision-notice">
      <Notice
        tone="info"
        title={$t('documents.revision.reading.title')}
        body={$t('documents.revision.reading.body', {
          what:
            reading.kind === 'release'
              ? $t('documents.revision.kind.release', {
                  version: versionOfTag(reading.tag ?? reading.ref),
                })
              : $t(`documents.revision.kind.${reading.kind}`),
          name: reading.by.name,
          when: formatDateTime(reading.at, $currentLocale),
        })}
      >
        {#snippet actions()}
          <Link href={address}>{$t('documents.revision.back')}</Link>
        {/snippet}
      </Notice>
    </div>
  {:else if frozen}
    <div class="notice" data-testid="frozen-notice">
      <Notice tone="info" title={$t('documents.frozen.title')} body={$t('documents.frozen.body')} />
    </div>
  {:else if doc.state === 'released' && canEdit}
    <div class="notice">
      <Notice
        tone="info"
        title={$t('documents.released.title', { version })}
        body={$t('documents.released.body', { next: doc.version + 1 })}
      />
    </div>
  {/if}
  {#if controller.reopened}
    <div class="notice" data-testid="reopened-notice">
      <Notice
        tone="success"
        title={$t('documents.reopened.title', { version: controller.reopened.version })}
        body={$t('documents.reopened.body')}
        live
      />
    </div>
  {/if}
  {#if restored && controller.dirty}
    <div class="notice" data-testid="restored-notice">
      <Notice
        tone="info"
        title={$t('documents.draft.restored', {
          time: formatTime(restored.at, $currentLocale),
        })}
      />
    </div>
  {/if}
  {#if controller.draftStale}
    <div class="notice" data-testid="stale-notice">
      <Notice tone="attention" title={$t('documents.draft.stale')} live />
    </div>
  {/if}
  {#if controller.remote}
    <div class="notice" data-testid="remote-notice">
      <Notice
        tone="info"
        title={$t('documents.saved-by-other', { name: controller.remote.name })}
      />
    </div>
  {/if}
  {#if failure}
    <div class="notice" data-testid="failure-notice">
      <Notice tone="danger" title={$t(failure)} live />
    </div>
  {/if}

  <ConflictPanel
    conflicts={shownConflicts}
    category={category.id}
    kind={doc.kind}
    locked={controller.locked}
    onresolve={(pointer, keep) => controller.resolve(pointer, keep)}
    ondecided={() => statusEl?.querySelector<HTMLElement>('button, [aria-disabled]')?.focus()}
  />

  {#if !reading && !switchedOff}
    <TransitionBar
      category={category.id}
      transitions={doc.transitions}
      {rights}
      {releaseHref}
      {busy}
      primary={!saveWaits}
      {askSave}
      missing={missingShown ? missing : []}
      onact={(transition) => void act(transition)}
      onsavefirst={() => void saveFirst()}
      ongo={goToField}
      onback={backToEditing}
    />
  {/if}

  <SchemaForm
    bind:this={form}
    {schema}
    category={category.id}
    kind={doc.kind}
    value={controller.value}
    readonly={controller.locked}
    errors={controller.errors}
    showMissing={controller.missing.length > 0}
    onchange={(next) => controller.setValue(next)}
    testId="document-form"
  />
  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>

  {#snippet status()}
    <div class="status" bind:this={statusEl}>
      <SaveState
        state={readonly ? 'read-only' : controller.saveState}
        {label}
        testId="save-state"
      />
      {#if !readonly}
        <Button
          variant={saveWaits || doc.transitions.length === 0 ? 'primary' : 'secondary'}
          icon="act.save"
          busy={controller.saveState === 'saving'}
          onclick={() => void save()}
          disabledReason={open > 0
            ? $t('documents.save.resolve-first', { count: open })
            : busy !== null && controller.saveState !== 'saving'
              ? $t('documents.save.step-running')
              : controller.dirty
                ? null
                : $t('documents.save.nothing')}
          data-testid="save-everyone"
        >
          {$t('documents.save')}
        </Button>
      {/if}
    </div>
  {/snippet}

  {#snippet margin()}
    <div class="margin">
      {#if !readonly}
        <p class="margin__note">{$t('documents.save.note')}</p>
      {/if}
      {#each stepUpLines as line (line)}
        <p class="margin__note" data-testid="step-up-note">{line}</p>
      {/each}
      {#if doc.release}
        <section class="margin__block" data-testid="release-block">
          <h2 class="margin__title">{$t('documents.margin.release')}</h2>
          <p class="margin__text">
            {$t('sheet.released-by', {
              name: doc.release.by.name,
              date: formatDate(doc.release.at, $currentLocale),
            })}
          </p>
          <Chip value={doc.release.tag} label={$t('sheet.tag')} />
        </section>
      {/if}
      {#if doc.releaseRequest}
        <section class="margin__block" data-testid="release-request">
          <h2 class="margin__title">{$t('documents.margin.request')}</h2>
          <p class="margin__text">
            {$t('documents.request.by', {
              name: doc.releaseRequest.by.name,
              date: formatDate(doc.releaseRequest.at, $currentLocale),
            })}
          </p>
          <p class="margin__comment">{doc.releaseRequest.comment}</p>
        </section>
      {/if}
      <section class="margin__block">
        <h2 class="margin__title">{$t('documents.revision.title')}</h2>
        <RevisionPicker
          category={category.id}
          document={doc.id}
          {revisions}
          truncated={revisionsTruncated}
          failed={revisionsFailed}
          {reading}
          {onnavigate}
          {addressFor}
        />
      </section>
      {#if aside}{@render aside()}{/if}
      <section class="margin__block">
        <h2 class="margin__title">{$t('sheet.history')}</h2>
        <HistoryList
          entries={documentHistory(doc.history, $t, $currentLocale, $now)}
          label={$t('sheet.history')}
          testId="document-history"
        />
      </section>
    </div>
  {/snippet}
</Sheet>

<style>
  .notice {
    margin-block-end: var(--space-6);
  }

  .status {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    align-items: center;
    gap: var(--space-3);
  }

  .status :global(.btn-with-reason) {
    max-inline-size: none;
    align-items: stretch;
  }

  .status :global(.btn) {
    inline-size: 100%;
  }

  .status :global(.btn__reason) {
    text-align: start;
  }

  .margin {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
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

  .margin__note,
  .margin__text {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    color: var(--color-text-muted);
  }

  .margin__text {
    color: var(--color-text-secondary);
  }

  .margin__comment {
    font-family: var(--font-serif);
    font-size: var(--text-sm);
    padding-inline-start: var(--space-3);
    border-inline-start: 3px solid var(--color-border-strong);
    overflow-wrap: anywhere;
  }
</style>
