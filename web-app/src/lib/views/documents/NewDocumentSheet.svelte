<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Link from '../../components/Link.svelte';
  import Notice from '../../components/Notice.svelte';
  import SaveState, { type SaveStateKind } from '../../components/SaveState.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import SheetHead from '../../components/SheetHead.svelte';
  import { apiClient } from '../../api/client';
  import { errorMessageKey, isApiError, type FieldError } from '../../api/errors';
  import type { Category, JsonObject, JsonSchema } from '../../api/types';
  import { kindName } from '../../documents/categories';
  import { diffFields, validationOf } from '../../documents/fields';
  import { guardLeaving } from '../../documents/leave';
  import SchemaForm from '../../forms/SchemaForm.svelte';
  import { messagesStore, t } from '../../i18n';
  import { onDestroy } from 'svelte';
  import { formatAddress } from '../../routes';

  /**
   * A new document (UC-DOC-3): the form of a document type with its value held in the page. Nothing is stored before the
   * first save, which creates the document and moves the page to its address; until then leaving the page asks, because
   * what was typed lives nowhere else (rest-api.adoc, Decided Provisionally, point 11). Without a `kind` the category's
   * document types are offered as a choice.
   */
  interface Props {
    /** The category. */
    category: Category;
    /** The document type to create; `null` asks which one. */
    kind: string | null;
    /** The schema of that type, `null` for the choice. */
    schema: JsonSchema | null;
    /** The repository of that type. */
    repository: string;
    /** Whether the user holds the right `edit` on it. */
    canCreate: boolean;
    /** Opens an address inside the app; `replace` takes the new document's place in the history. */
    onnavigate: (href: string, options?: { replace?: boolean }) => void;
    /** The address of the form of a document type, for a lens that has addresses of its own; the generic lens's by default. */
    newAddress?: (kind: string) => string;
    /** The address the way back leads to when the person may not create: the category's list by default. */
    backAddress?: string;
  }

  let {
    category,
    kind,
    schema,
    repository,
    canCreate,
    onnavigate,
    newAddress,
    backAddress,
  }: Props = $props();

  /** The single part of a document type with one file. */
  const PART = 'data';

  let value = $state<JsonObject>({});
  let errors = $state<FieldError[] | null>(null);
  let failure = $state<string | null>(null);
  let saving = $state(false);
  /** Whether the form is gone: a creation that returns later navigates nowhere. */
  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
  });
  let created = $state(false);
  let asking = $state(false);
  let proceed: (() => void) | null = null;

  let dirty = $derived(Object.keys(value).length > 0);
  let saveState = $derived<SaveStateKind>(
    saving ? 'saving' : errors || failure ? 'failed' : dirty ? 'changed' : 'clean',
  );
  let label = $derived(
    saving
      ? $t('save.saving')
      : errors
        ? $t('documents.new.invalid')
        : failure
          ? $t('documents.new.failed')
          : dirty
            ? $t('documents.new.changed')
            : $t('documents.new.clean'),
  );

  guardLeaving(
    () => dirty && !created,
    (go) => {
      proceed = go;
      asking = true;
    },
  );

  async function save() {
    if (saving || !dirty || kind === null) return;
    saving = true;
    failure = null;
    errors = null;
    try {
      const answer = await apiClient.createDocument(repository, {
        kind,
        parts: { [PART]: { fields: diffFields({}, value) } },
      });
      created = true;
      // The person may have left while the request ran: the page they went to is not replaced then.
      if (!destroyed) onnavigate(answer.address, { replace: true });
    } catch (error) {
      if (isApiError(error) && error.outcome === 'VALIDATION') {
        errors = validationOf(error, PART);
      }
      failure = errorMessageKey(error);
    } finally {
      saving = false;
    }
  }

  function leave() {
    asking = false;
    proceed?.();
    proceed = null;
  }
</script>

{#if !canCreate}
  <Sheet testId="new-document-sheet">
    <EmptyState icon="state.lock" title={$t('documents.list.new.no-right')}>
      {#snippet actions()}
        <Link href={backAddress ?? `/categories/${category.id}`}>
          {$t('documents.revision.back')}
        </Link>
      {/snippet}
    </EmptyState>
  </Sheet>
{:else if kind !== null && schema === null}
  <Sheet testId="new-document-loading"><p class="muted">{$t('common.loading')}</p></Sheet>
{:else if kind === null || schema === null}
  <Sheet testId="new-document-choice">
    <SheetHead
      kind="document"
      kindLabel={$t('kind.document')}
      title={$t('documents.new.choose.title')}
      lede={$t('documents.new.choose.body')}
      size="title"
    />
    <ul class="choice">
      {#each category.kinds as option (option.id)}
        <li>
          <Link
            href={newAddress
              ? newAddress(option.id)
              : formatAddress({
                  route: 'categories.new',
                  params: { category: category.id },
                  query: { kind: option.id },
                })}
            look="secondary"
            data-testid="choose-{option.id}"
          >
            {kindName($messagesStore, category.id, option.id)}
          </Link>
        </li>
      {/each}
    </ul>
  </Sheet>
{:else}
  <Sheet testId="new-document-sheet" marginLabel={$t('sheet.margin')}>
    <SheetHead
      kind="document"
      kindLabel={kindName($messagesStore, category.id, kind)}
      title={$t('documents.new.title', { kind: kindName($messagesStore, category.id, kind) })}
      size="title"
    />
    {#if failure}
      <div class="notice">
        <Notice tone="danger" title={$t(failure)} live />
      </div>
    {/if}
    <SchemaForm
      {schema}
      category={category.id}
      {kind}
      bind:value
      {errors}
      readonly={saving}
      testId="new-document-form"
    />

    {#snippet status()}
      <div class="status">
        <SaveState state={saveState} {label} testId="save-state" />
        <Button
          variant="primary"
          icon="act.save"
          busy={saving}
          onclick={() => void save()}
          disabledReason={dirty ? null : $t('documents.new.nothing')}
          data-testid="save-everyone"
        >
          {$t('documents.save')}
        </Button>
      </div>
    {/snippet}

    {#snippet margin()}
      <p class="margin__note">{$t('documents.new.lede')}</p>
    {/snippet}
  </Sheet>
{/if}

<Dialog
  bind:open={asking}
  title={$t('documents.new.leave.title')}
  closeLabel={$t('common.close')}
  onclose={() => (proceed = null)}
>
  <p>{$t('documents.new.leave.body')}</p>
  <div class="leave">
    <Button onclick={() => (asking = false)} data-testid="leave-stay">
      {$t('documents.new.leave.stay')}
    </Button>
    <Button variant="danger" onclick={leave} data-testid="leave-confirm">
      {$t('documents.new.leave.confirm')}
    </Button>
  </div>
</Dialog>

<style>
  .muted {
    color: var(--color-text-muted);
  }

  .notice {
    margin-block-end: var(--space-6);
  }

  .choice {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    list-style: none;
  }

  .margin__note {
    font-size: var(--text-xs);
    line-height: var(--line-height-xs);
    color: var(--color-text-muted);
  }

  .leave {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-block-start: var(--space-5);
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
</style>
