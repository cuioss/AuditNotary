<script lang="ts">
  import {
    ISMS_DOCUMENTS,
    documentAddress,
    documentsAddress,
    releaseAddress,
  } from '../../isms/model';
  import { t } from '../../i18n';
  import DocumentReleaseView, { type DocumentLens } from '../documents/DocumentReleaseView.svelte';

  /**
   * The review and release of an ISMS document (UC-ISMS-1; AUN-WEB-6): the address
   * `/isms/documents/{ismsdocument}/release`. The page is the generic one (`DocumentReleaseView` over `ReleaseFlow`: the diff
   * against the last release, the step-up, the seal), drawn on the addresses of the lens ISMS. A document is released more
   * than once, so the diff is the change since the last release, `v<n>`.
   */
  interface Props {
    /** The values of the address: `ismsdocument`. */
    params: Record<string, string>;
  }

  let { params }: Props = $props();

  let lens: DocumentLens = $derived({
    category: ISMS_DOCUMENTS,
    document: params.ismsdocument,
    documentAddress: documentAddress(params.ismsdocument),
    releaseAddress: releaseAddress(params.ismsdocument),
    crumbs: [{ label: $t('isms.documents.title'), href: documentsAddress() }],
    shortLabels: true,
  });
</script>

<DocumentReleaseView params={{}} {lens} />
