// Öffentliche API des Moduls confluence (SCRUM-470/510). Cross-Modul-Import nur hierüber (Arch-Regel).
export { confluenceStorageToHtml } from "./src/storage";
// SCRUM-510 R2a (Encapsulation + Credential-Gating): nach außen NUR die gecappte Adapter-Factory. Der
// Roh-Client (ConfluenceRestClient), seine token-tragende Config (ConfluenceRestConfig), der env-Resolver
// (confluenceClientFromEnv) und adapterFromConfig bleiben BEWUSST modul-intern — ein externer Aufrufer
// bekommt weder den apiToken noch einen ungepinnten Client. Der Mapper bleibt paketintern.
export { ConfluenceSourceAdapter, createConfluenceAdapterFromEnv } from "./src/adapter";
