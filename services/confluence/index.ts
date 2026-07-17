// Öffentliche API des Moduls confluence (SCRUM-470/510). Cross-Modul-Import nur hierüber (Arch-Regel).
export { confluenceStorageToHtml } from "./src/storage";
// SCRUM-510 (Import-Variante B, Adapter #1): read-only REST-Client + Mapper + quell-agnostischer Adapter.
export {
  ConfluenceRestClient,
  type ConfluenceRestConfig,
  type ConfluencePage,
  confluenceRestConfigFromEnv,
} from "./src/rest-client";
export {
  type ConfluenceMapOptions,
  confluenceGovernanceConfidentiality,
  isPageRestricted,
  mapConfluencePageToImportItem,
} from "./src/mapper";
export {
  ConfluenceSourceAdapter,
  adapterFromConfig,
  createConfluenceAdapterFromEnv,
} from "./src/adapter";
