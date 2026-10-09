// Öffentliche API des Moduls confluence (SCRUM-470/510). Cross-Modul-Import nur hierüber (Arch-Regel).
export { confluenceStorageToHtml } from "./src/storage";
// SCRUM-510 R2a (Encapsulation + Credential-Gating): nach außen NUR die gecappte Adapter-Factory. Der
// Roh-Client (ConfluenceRestClient), seine token-tragende Config (ConfluenceRestConfig), der env-Resolver
// (confluenceClientFromEnv) und adapterFromConfig bleiben BEWUSST modul-intern — ein externer Aufrufer
// bekommt weder den apiToken noch einen ungepinnten Client. Der Mapper bleibt paketintern.
export {
  ConfluenceSourceAdapter,
  type CollectResult,
  createConfluenceAdapterFromEnv,
} from "./src/adapter";
// R-0549/R-0163: nur die FORM der Quellangaben am Item (Leserestriktion, Anhänge) — ein Typ, keine
// Mapper-Funktion. Der Import-Lauf der App liest daraus die Anhänge unveränderter Seiten.
export type { ConfluenceImportItem } from "./src/mapper";
// ADMIN-02: die Deutung eines gescheiterten Verbindungstests — nur ein Wort, nie Text oder Status
// der Gegenstelle. Die Fehlerklassen selbst bleiben drinnen.
export {
  type ConfluenceVerbindungsfehler,
  confluenceVerbindungsfehler,
} from "./src/rest-client";
// AUFTRAG-mega67 BLOCK C: der ZUSTAND der Zugangsdaten — je Variable benannt und ja/nein, NIE ein
// Wert und nie eine Maske mit Länge. Diese Auskunft darf nach außen, weil sie strukturell kein
// Geheimnis tragen kann (s. credential-state.ts); der Token-tragende Resolver bleibt modul-intern.
export {
  CONFLUENCE_CREDENTIAL_VARS,
  type ConfluenceCredentialState,
  confluenceCredentialState,
} from "./src/credential-state";
