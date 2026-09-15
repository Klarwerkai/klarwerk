// Öffentliche API des Moduls `sharepoint` (JOB 4086). Cross-Modul-Import NUR hierüber (Arch-Regel,
// dependency-cruiser `module-boundaries`).
//
// DIESELBE KAPSELUNG WIE BEI CONFLUENCE (SCRUM-510 R2a): nach aussen führt genau EIN Weg zu einem
// Adapter — die gecappte Factory aus der Umgebung. Der Roh-Client (`SharePointGraphClient`), seine
// token-tragende Config (`SharePointGraphConfig`), der env-Resolver (`sharepointClientFromEnv`) und
// `adapterFromConfig` bleiben BEWUSST modul-intern: ein externer Aufrufer bekommt weder das
// Zugangsmerkmal noch einen ungepinnten Client. `services/sharepoint/src/encapsulation.test.ts`
// hält das fest.
export {
  SharePointSourceAdapter,
  type SharePointDatei,
  type SharePointDateiliste,
  createSharePointAdapterFromEnv,
} from "./src/adapter";
// Die vier Fehlerlagen als reine Auskunft. Der Fehlertyp selbst bleibt drinnen; nach aussen reist
// nur, WELCHE Lage vorliegt — genug für die Route, zu wenig für ein Leck.
export { type SharePointFehlerlage, sharepointFehlerlage } from "./src/graph-client";
// Der ZUSTAND der Zugangsdaten — je Variable benannt und ja/nein, NIE ein Wert und nie eine Maske
// mit Länge. Diese Auskunft darf nach aussen, weil sie strukturell kein Geheimnis tragen kann
// (s. credential-state.ts); der token-tragende Resolver bleibt modul-intern.
export {
  SHAREPOINT_CREDENTIAL_VARS,
  type SharePointCredentialState,
  sharepointCredentialState,
} from "./src/credential-state";
