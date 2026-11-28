<script lang="ts" module>
  /** One change of the record a release makes: the words of its field and the two values. */
  export interface ReleaseChange {
    /** The key of the change in a list. */
    key: string;
    /** The JSON Pointer of the field. */
    pointer: string;
    /** The words of the field; empty when the title of the group says it. */
    label: string;
    before: unknown;
    after: unknown;
  }

  /** The changes of one section of the record: a practice, a property of the document. */
  export interface ReleaseGroup {
    /** A key that is unique in the record. */
    key: string;
    /** The title of the section. */
    title: string;
    /** The changes. */
    changes: ReleaseChange[];
  }

  /** One line of "Before you release". */
  export interface ReleaseCheck {
    /** A key that is unique in the list. */
    key: string;
    /** The words. */
    text: string;
    /** The mark: done, open, the seal or the lock. */
    icon: 'state.done' | 'state.open' | 'state.seal' | 'state.lock';
    /** Whether it is something still to do: the mark is then the colour of attention. */
    open?: boolean;
  }

  /** A link that comes with a refusal: a place where what the refusal asks for is done. */
  export interface ReleaseRefusalLink {
    /** A key that is unique in the list. */
    key: string;
    /** The words. */
    label: string;
    /** The address. */
    href: string;
  }

  /**
   * The refusal of a release that only one document type knows: its words and where to go. The flow tells it as it tells
   * its own refusals.
   */
  export interface ReleaseRefusal {
    /** The tone: a refusal that asks the person to do something is attention. */
    tone: 'attention' | 'danger';
    /** The catalogue key of the title. */
    key: string;
    /** The sentence under the title. */
    body?: string;
    /** The places to go to, as links under the sentence. */
    links?: ReleaseRefusalLink[];
    /** Whether the document and its record are read again: the refusal says that what the person reviewed has changed. */
    reload?: boolean;
  }

  /** What the release made: the tag and the time. */
  export interface ReleaseDone {
    tag: string;
    at: string;
  }

  /** The words of a release that differ with the document: everything else the flow says in its own words. */
  export interface ReleaseTexts {
    /** The title of the page before the release: "Release <title>". */
    title: string;
    /** The sentence under it. */
    intro: string;
    /** The title of the page after the release. */
    doneTitle: string;
    /** The sentence under it. */
    doneIntro: string;
    /** The sentence above the record: the first release, or the changes since the last. */
    recordLede: string;
    /** The way back to the document. */
    back: string;
    /** The way on to the released document. */
    open: string;
    /** The sentence above the password field of the confirmation. */
    passwordLede: string;
    /** The catalogue key of the refusal of a release that someone else made meanwhile. */
    releasedMeanwhile: string;
    /** @returns how many changes a section holds */
    count: (count: number) => string;
  }
</script>

<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Chip from '../../components/Chip.svelte';
  import Icon from '../../components/Icon.svelte';
  import Link from '../../components/Link.svelte';
  import Notice from '../../components/Notice.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import MascotFigure from '../../brand/MascotFigure.svelte';
  import { apiClient } from '../../api/client';
  import { errorMessageKey, isApiError, type ApiError } from '../../api/errors';
  import { stepUpMethodOf } from '../../access/access';
  import { formatDateTime } from '../../format';
  import { currentLocale, t } from '../../i18n';
  import { StepUpHandler } from '../../stepup/stepUp';
  import StepUpDialog from '../../stepup/StepUpDialog.svelte';
  import { session, status } from '../../stores/app';
  import WizardPage from '../../templates/WizardPage.svelte';
  import { versionOf } from '../samm/workflow';
  import DiffRecord from './DiffRecord.svelte';

  /**
   * The review and release of a document, the same for every category (UC-DOC-7, AUN-WEB-6): what the approver releases,
   * the record as the structured diff against the last released state, grouped by section, then the act, which names the
   * domain act only: "Release". That the person confirms their identity once more is said in the margin, whatever the
   * method (AUN-WEB-6); the confirmation is the step-up handler's. Released, the seal is pressed into the sheet once and
   * the notary stands beside it: a finished release is a calm surface (doc/concepts/brand.adoc).
   *
   * The flow knows no category. What belongs to a document type is handed in: the words (`texts`), the seal and the
   * facts of the stage (`stage`), the change since an earlier release (`since`), the way a value is drawn (`value`) and
   * what is still open before the release (`checks`). A release the server refuses is told here, once, for every
   * category: changed since the review (the review is read again), released meanwhile (the document is read again and
   * nothing is written), mandatory fields missing, the Git server refusing or not to be reached, a wrong password, and
   * too many logins.
   */
  interface Props {
    /** The repository of the document. */
    repository: string;
    /** The id of the document. */
    id: string;
    /** The words that differ with the document. */
    texts: ReleaseTexts;
    /** Whether the document and its record are read. */
    ready: boolean;
    /** The catalogue key of the failure to read them, `null` for none. */
    failure?: string | null;
    /** The sections of the record. */
    groups?: ReleaseGroup[];
    /** Whether the sections start folded: a record of many answers. */
    folded?: boolean;
    /** Why the release cannot be taken now, `null` when it can. */
    unavailable?: string | null;
    /** What stands in "Before you release", before the line about the confirmation. */
    checks?: ReleaseCheck[];
    /** The address of the document: back to editing writes nothing. */
    backHref: string;
    /** The address of the released document. */
    openHref: string;
    /** The words of a field, for the list of the mandatory fields the server found empty. */
    fieldLabel?: (pointer: string) => string;
    /** Reads the document and its record again, after a refusal that changed what the person reviews. */
    onreload: () => Promise<void>;
    /**
     * The words of a refusal that only this document type knows (an incident whose stages are not all completed); `null`
     * leaves it to the flow. It is asked before the flow's own refusals.
     */
    explain?: (error: ApiError) => ReleaseRefusal | null;
    /** Called after the release was made. */
    onreleased?: (done: ReleaseDone) => void;
    /** The stage: the seal of the document, and what is released. It gets the release once it is made. */
    stage: Snippet<[ReleaseDone | null]>;
    /** The change since an earlier release, between the stage and the record, under `sinceTitle`. */
    since?: Snippet;
    /** The title of the change since an earlier release. */
    sinceTitle?: string;
    /** One side of a change. */
    value: Snippet<[ReleaseChange, 'before' | 'after']>;
    /** Whether the notary stands beside the seal once released; a document of an incident, which the deadlines weigh on, has none. */
    mascot?: boolean;
    /** Whether the fields have short labels and long values (a form's fields, not a questionnaire's questions): the values get the room. */
    shortLabels?: boolean;
  }

  let {
    repository,
    id,
    texts,
    ready,
    failure = null,
    groups = [],
    folded = false,
    unavailable = null,
    checks = [],
    backHref,
    openHref,
    fieldLabel = (pointer) => pointer,
    onreload,
    explain,
    onreleased,
    stage,
    since,
    sinceTitle = '',
    value,
    mascot = true,
    shortLabels = false,
  }: Props = $props();

  let notice = $state<{
    tone: 'attention' | 'danger';
    key: string;
    body?: string;
    links?: ReleaseRefusalLink[];
  } | null>(null);
  let released = $state<ReleaseDone | null>(null);
  /**
   * Whether a release is under way, from the press of the act until its outcome is told and the record is read again.
   * The act is busy for all of it: a second press must neither send a second release nor release what the person has
   * not seen yet after a refusal changed the record.
   */
  let releasing = $state(false);

  // The step-up handler decides whether the release asks and how (UC-ACC-3); the flow keeps the release's own outcomes.
  const stepUp = new StepUpHandler();
  const stepUpState = stepUp.state;

  let confirms = $derived(stepUpMethodOf($status) !== 'off' && !unavailable);

  onDestroy(() => stepUp.cancel());

  async function release() {
    if (releasing || released) return;
    releasing = true;
    notice = null;
    try {
      // The release always needs the confirmation (AUN-SAMM-4): a local user is asked before it is sent.
      const result = await stepUp.run((password) => apiClient.release(repository, id, password), {
        asks: true,
      });
      if (result.status === 'done') {
        released = { tag: result.value.tag, at: result.value.at };
        onreleased?.(released);
      } else if (result.status === 'refused') {
        await refuse(result.error);
      }
    } finally {
      releasing = false;
    }
  }

  /** Tells a refusal of the release: what the person must do, and what the flow reads again. */
  async function refuse(error: unknown) {
    if (!isApiError(error)) {
      notice = { tone: 'danger', key: errorMessageKey(error) };
      return;
    }
    const own = explain?.(error) ?? null;
    if (own) {
      notice = { tone: own.tone, key: own.key, body: own.body, links: own.links };
      if (own.reload) await onreload();
      return;
    }
    switch (error.outcome) {
      case 'CHANGED_SINCE_REVIEW':
        notice = { tone: 'attention', key: 'error.changed-since-review' };
        await onreload();
        break;
      case 'DOCUMENT_RELEASED':
        notice = { tone: 'attention', key: texts.releasedMeanwhile };
        await onreload();
        break;
      case 'MANDATORY_FIELDS_MISSING': {
        const missing = Array.isArray(error.details.missing)
          ? error.details.missing.filter(
              (pointer): pointer is string => typeof pointer === 'string',
            )
          : [];
        notice = {
          tone: 'attention',
          key: 'error.mandatory-fields-missing',
          body:
            missing.length > 0
              ? $t('release.missing', { fields: missing.map(fieldLabel).join(', ') })
              : undefined,
        };
        break;
      }
      case 'GIT_UNAVAILABLE':
        // Nothing of the person's is kept here to save again: the release is simply not made.
        notice = { tone: 'danger', key: 'release.git-unavailable' };
        break;
      default:
        notice = { tone: 'danger', key: errorMessageKey(error) };
    }
  }
</script>

<WizardPage
  wide
  title={!ready ? $t('lens.release') : released ? texts.doneTitle : texts.title}
  intro={!ready ? '' : released ? texts.doneIntro : texts.intro}
  testId="release-view"
>
  <StepUpDialog
    handler={stepUp}
    lede={texts.passwordLede}
    actLabel={$t('release.act')}
    testId="release"
  />
  {#if failure}
    <Notice
      tone="danger"
      title={$t(failure === 'error.git-unavailable' ? 'release.read-unavailable' : failure)}
      live
    />
  {:else if !ready}
    <p class="muted">{$t('common.loading')}</p>
  {:else}
    {#if notice}
      {@const links = notice.links ?? []}
      {#if links.length > 0}
        <div data-testid="release-refusal">
          <Notice tone={notice.tone} title={$t(notice.key)} body={notice.body} live stacked>
            {#snippet actions()}
              <ul class="refusal__links" data-testid="release-refusal-links">
                {#each links as link (link.key)}
                  <li>
                    <Link
                      href={link.href}
                      look="secondary"
                      data-testid="release-refusal-{link.key}"
                    >
                      {link.label}
                    </Link>
                  </li>
                {/each}
              </ul>
            {/snippet}
          </Notice>
        </div>
      {:else}
        <Notice tone={notice.tone} title={$t(notice.key)} body={notice.body} live />
      {/if}
    {/if}
    {#if released}
      <div class="done" data-testid="release-done">
        <Notice
          tone="success"
          title={$t('release.done.notice', { version: versionOf(released.tag) })}
          body={$t('release.done.body', { time: formatDateTime(released.at, $currentLocale) })}
          live
        />
      </div>
    {/if}
    <Sheet marginLabel={$t('release.margin')}>
      <section class="section" aria-labelledby="release-what">
        <h2 class="section__title" id="release-what">
          {released ? $t('release.sealed') : $t('release.what')}
        </h2>
        <div class="stage" class:stage--done={!!released}>
          {@render stage(released)}
          {#if released && mascot}
            <div class="stage__mascot"><MascotFigure pose="done" /></div>
          {/if}
        </div>
      </section>

      {#if since}
        <section class="section" aria-labelledby="release-since">
          <h2 class="section__title" id="release-since">{sinceTitle}</h2>
          {@render since()}
        </section>
      {/if}

      <section class="section" aria-labelledby="release-record">
        <h2 class="section__title" id="release-record">{$t('release.record')}</h2>
        <p class="section__lede">{texts.recordLede}</p>
        <DiffRecord
          {groups}
          folded={folded || !!released}
          {shortLabels}
          count={texts.count}
          {value}
        />
      </section>

      {#snippet status()}
        <div class="margin__block margin__block--acts">
          {#if released}
            <Link href={openHref} look="primary" data-testid="release-open">{texts.open}</Link>
          {:else}
            <Button
              variant="primary"
              icon="act.stamp"
              busy={$stepUpState.working || releasing}
              onclick={release}
              disabledReason={unavailable}
              data-testid="release-act"
            >
              {$t('release.act')}
            </Button>
            <Link href={backHref} look="secondary" data-testid="release-back">{texts.back}</Link>
          {/if}
        </div>
      {/snippet}

      {#snippet margin()}
        <div class="margin">
          {#if released}
            <section class="margin__block">
              <h2 class="margin__title">{$t('sheet.release')}</h2>
              <p class="check">
                <Icon name="state.seal" size={16} />
                <span>
                  {$t('sheet.released-by', {
                    name: $session?.user.name ?? '',
                    date: formatDateTime(released.at, $currentLocale),
                  })}
                </span>
              </p>
            </section>
            <section class="margin__block">
              <h2 class="margin__title">{$t('sheet.tag')}</h2>
              <Chip value={released.tag} label={$t('sheet.tag')} testId="release-tag" />
            </section>
          {:else}
            <section class="margin__block">
              <h2 class="margin__title">{$t('release.check')}</h2>
              <ul class="checks">
                {#each checks as check (check.key)}
                  <li class="check" class:check--open={check.open}>
                    <Icon name={check.icon} size={16} />
                    <span>{check.text}</span>
                  </li>
                {/each}
                {#if confirms}
                  <li class="check">
                    <Icon name="state.lock" size={16} />
                    <span>{$t('release.check.step-up')}</span>
                  </li>
                {/if}
              </ul>
            </section>
          {/if}
        </div>
      {/snippet}
    </Sheet>
  {/if}
</WizardPage>

<style>
  .muted {
    color: var(--color-text-muted);
  }

  .done {
    margin-block-end: var(--space-2);
  }

  .refusal__links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    list-style: none;
  }

  .section + .section {
    margin-block-start: var(--space-12);
  }

  .section__title {
    margin-block-end: var(--space-4);
    font-family: var(--font-serif);
    font-size: var(--text-xl);
    line-height: var(--line-height-xl);
  }

  .section__lede {
    max-inline-size: var(--measure);
    margin-block-end: var(--space-4);
    color: var(--color-text-secondary);
  }

  .stage {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
  }

  .stage__mascot {
    flex: 0 0 auto;
    animation: rise var(--duration-seal) var(--ease-standard) both;
    animation-delay: calc(var(--duration-seal) * 0.6);
  }

  .stage__mascot :global(.mascot) {
    max-inline-size: 9rem;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
      transform: none;
    }
  }

  .margin {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .margin__block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .margin__block--acts :global(.btn),
  .margin__block--acts :global(.link--button),
  .margin__block--acts :global(.btn-with-reason) {
    inline-size: 100%;
    max-inline-size: none;
    align-items: stretch;
    white-space: normal;
    text-align: center;
  }

  .margin__block--acts :global(.btn__reason) {
    text-align: start;
  }

  .margin__title {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-secondary);
  }

  .checks {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    list-style: none;
  }

  .check {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-size: var(--text-sm);
    line-height: var(--line-height-sm);
    color: var(--color-text-primary);
  }

  .check :global(.ui-icon) {
    margin-block-start: 1px;
    color: var(--color-success);
  }

  .check--open :global(.ui-icon) {
    color: var(--color-attention);
  }

  @media (max-width: 767px) {
    .stage {
      flex-direction: column;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage__mascot {
      animation: none;
    }
  }
</style>
