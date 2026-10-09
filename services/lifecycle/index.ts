// Öffentliche API des Moduls lifecycle.
export { LifecycleService } from "./src/service";
// R-1635: der Prüfprotokoll-Vorgang einer Markierung — die Glocke liest ihn für die
// Benachrichtigung an Autor bzw. Nachfolger (services/app/src/frische-meldungen.ts).
export { REVALIDIERUNG_ANGEFORDERT } from "./src/service";
// JOB 3054: die schreibfreie Merkergrenze der zwei Anzeigestatus-Leserouten. Sie steht NEBEN dem
// Dienst und nicht an seiner Stelle: wer nur lesen darf, nimmt sie und kann den selbstheilenden
// Arbeitsbereichsweg `pendingRevalidation()` von dort aus nicht erreichen.
export type { LifecycleServiceDeps, RevalidierungMerkerLeser } from "./src/service";
export { InMemoryLifecycleRepo, type LifecycleRepo } from "./src/repo";
export { PgLifecycleRepo, LIFECYCLE_SCHEMA } from "./src/repo-pg";
export type { LearningPath, LearningStep } from "./src/types";
