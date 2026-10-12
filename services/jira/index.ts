// Öffentliche API des Moduls `jira` (R-0170). Cross-Modul-Import NUR hierüber (Arch-Regel,
// dependency-cruiser `module-boundaries`).
//
// DIESELBE KAPSELUNG WIE BEI CONFLUENCE UND SHAREPOINT: nach aussen führt genau EIN Weg zu einem
// Adapter — die Factory aus der Umgebung. Der Roh-Client (`JiraRestClient`), seine token-tragende
// Config (`JiraRestConfig`), der env-Resolver (`jiraClientFromEnv`) und der Fehlertyp bleiben
// BEWUSST modul-intern. `services/jira/src/encapsulation.test.ts` hält das fest.
export {
  JiraSourceAdapter,
  type JiraVorgang,
  type JiraVorgangsliste,
  type JiraItemSeite,
  createJiraAdapterFromEnv,
} from "./src/adapter";
// Die Fehlerlagen als reine Auskunft. Nach aussen reist nur, WELCHE Lage vorliegt.
export { type JiraFehlerlage, jiraFehlerlage, JIRA_PAGE_LIMIT } from "./src/rest-client";
// Der ZUSTAND der Zugangsdaten — je Variable benannt und ja/nein, NIE ein Wert.
export {
  JIRA_AUTH_VAR,
  JIRA_CREDENTIAL_VARS,
  type JiraCredentialState,
  jiraCredentialState,
} from "./src/credential-state";
