<script lang="ts">
  import { hasNoRights } from '../access/access';
  import { lensOf, parseAddress, routesUnder, routeTitleKey } from '../routes';
  import { DOCUMENT_ROUTES } from '../isms/model';
  import { session } from '../stores/app';
  import LoginProblemView from './access/LoginProblemView.svelte';
  import LoginView from './access/LoginView.svelte';
  import NoRightsView from './access/NoRightsView.svelte';
  import SignedOutView from './access/SignedOutView.svelte';
  import DueView from './DueView.svelte';
  import LensPlaceholderView from './LensPlaceholderView.svelte';
  import NotFoundView from './NotFoundView.svelte';
  import SettingsView from './SettingsView.svelte';
  import WelcomeView from './WelcomeView.svelte';
  import DocumentReleaseView from './documents/DocumentReleaseView.svelte';
  import CatalogsView from './catalogs/CatalogsView.svelte';
  import ImportView from './directory/ImportView.svelte';
  import PersonsView from './directory/PersonsView.svelte';
  import ProfileView from './directory/ProfileView.svelte';
  import DocumentsView from './documents/DocumentsView.svelte';
  import SammReleaseView from './samm/SammReleaseView.svelte';
  import SammView from './samm/SammView.svelte';
  import IncidentReleaseView from './incidents/IncidentReleaseView.svelte';
  import IncidentsView from './incidents/IncidentsView.svelte';
  import DocumentCompareView from './isms/DocumentCompareView.svelte';
  import IsmsDocumentReleaseView from './isms/IsmsDocumentReleaseView.svelte';
  import IsmsView from './isms/IsmsView.svelte';
  import ReportsView from './reports/ReportsView.svelte';
  import RiskRegisterView from './reports/RiskRegisterView.svelte';
  import SammCompareView from './reports/SammCompareView.svelte';
  import SammTrendView from './reports/SammTrendView.svelte';
  import ThreatEvaluationView from './reports/ThreatEvaluationView.svelte';
  import ThreatModelReleaseView from './threats/ThreatModelReleaseView.svelte';
  import ThreatModelsView from './threats/ThreatModelsView.svelte';

  /**
   * Chooses the view of an address (AUN-WEB-3). The route files are stubs that render this component.
   */
  interface Props {
    /** The path of the current location. */
    pathname: string;
    /** The query of the current location, with its `?`; the pages outside the shell read `return` and `reason`. */
    search?: string;
    /** Opens an address inside the app; `replace` takes the place of the current one in the history. */
    onnavigate: (href: string, options?: { replace?: boolean }) => void;
  }

  let { pathname, search = '', onnavigate }: Props = $props();

  /**
   * The routes of the catalogs lens this view draws as a chain of columns: the addresses under `/catalogs`, read from the
   * canonical addresses. The pages of the directory (`/directory/...`) belong to the lens too and have views of their own.
   */
  const CATALOG_ROUTES = routesUnder('catalogs');

  let address = $derived(parseAddress(pathname, search));
  let route = $derived(address?.route ?? null);
  // A session without a right sees the empty state in place of every view on a repository; the first-login form and
  // the settings need none.
  let withoutRights = $derived(hasNoRights($session));
</script>

{#if route === null}
  <NotFoundView />
{:else if route === 'login'}
  <LoginView {search} />
{:else if route === 'signed-out'}
  <SignedOutView />
{:else if route === 'login-problem'}
  <LoginProblemView {search} />
{:else if withoutRights && route !== 'welcome' && lensOf(route) !== 'settings'}
  <NoRightsView titleKey={routeTitleKey(route)} />
{:else if route === 'due'}
  <DueView />
{:else if route === 'welcome'}
  <WelcomeView {onnavigate} />
{:else if route === 'settings.profile'}
  <ProfileView />
{:else if lensOf(route) === 'settings'}
  <SettingsView />
{:else if route === 'samm.release' && address}
  {#key `${address.params.scope}/${address.params.assessment}`}
    <SammReleaseView params={address.params} />
  {/key}
{:else if lensOf(route) === 'samm' && address}
  <SammView {route} params={address.params} {onnavigate} />
{:else if route === 'categories.release' && address}
  {#key `${address.params.category}/${address.params.document}`}
    <DocumentReleaseView params={address.params} />
  {/key}
{:else if lensOf(route) === 'categories' && address}
  <DocumentsView {route} params={address.params} query={address.query} {onnavigate} />
{:else if route === 'threat-models.release' && address}
  {#key `${address.params.service}/${address.params.model}`}
    <ThreatModelReleaseView params={address.params} />
  {/key}
{:else if lensOf(route) === 'threat-models' && address}
  <ThreatModelsView {route} params={address.params} query={address.query} {onnavigate} />
{:else if route === 'incidents.release' && address}
  {#key `${address.params.year}/${address.params.incident}`}
    <IncidentReleaseView params={address.params} />
  {/key}
{:else if lensOf(route) === 'incidents' && address}
  <IncidentsView {route} params={address.params} query={address.query} {onnavigate} />
{:else if route === 'isms.document.release' && address}
  {#key address.params.ismsdocument}
    <IsmsDocumentReleaseView params={address.params} />
  {/key}
{:else if route === 'isms.document.compare' && address}
  {#key address.params.ismsdocument}
    <DocumentCompareView params={address.params} query={address.query} />
  {/key}
{:else if DOCUMENT_ROUTES.includes(route) && address}
  <IsmsView {route} params={address.params} query={address.query} {onnavigate} />
{:else if route === 'reports'}
  <ReportsView />
{:else if route === 'reports.samm-trend'}
  {#key address?.query?.scope ?? ''}
    <SammTrendView query={address?.query} {onnavigate} />
  {/key}
{:else if route === 'reports.samm-compare'}
  {#key `${address?.query?.scope ?? ''}/${address?.query?.from ?? ''}/${address?.query?.to ?? ''}`}
    <SammCompareView query={address?.query} {onnavigate} />
  {/key}
{:else if route === 'reports.threat-evaluation'}
  <ThreatEvaluationView />
{:else if route === 'reports.risk-register'}
  <RiskRegisterView query={address?.query} {onnavigate} />
{:else if route === 'reports.report'}
  <NotFoundView />
{:else if route === 'catalogs.import'}
  <ImportView />
{:else if route === 'catalogs.persons'}
  <PersonsView />
{:else if CATALOG_ROUTES.includes(route) && address}
  <CatalogsView {route} params={address.params} {onnavigate} />
{:else}
  {#key route}
    <LensPlaceholderView titleKey={routeTitleKey(route)} {route} />
  {/key}
{/if}
