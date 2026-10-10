// Öffentliche API des Moduls lifecycle.
export { LifecycleService } from "./src/service";
// R-1635: der Prüfprotokoll-Vorgang einer Markierung — die Glocke liest ihn für die
// Benachrichtigung an Autor bzw. Nachfolger (services/app/src/frische-meldungen.ts).
export { REVALIDIERUNG_ANGEFORDERT } from "./src/service";
// produkt:20261010:aenderungsfolgen-sichtbar: die Bestätigung eines nicht mehr offenen Stands.
export { FolgepruefungStandError } from "./src/service";
// JOB 3054: die schreibfreie Merkergrenze der zwei Anzeigestatus-Leserouten. Sie steht NEBEN dem
// Dienst und nicht an seiner Stelle: wer nur lesen darf, nimmt sie und kann den selbstheilenden
// Arbeitsbereichsweg `pendingRevalidation()` von dort aus nicht erreichen.
export type {
  LifecycleServiceDeps,
  Markierung,
  RevalidierungMerkerLeser,
  RevalidierungsGrund,
} from "./src/service";
export { InMemoryLifecycleRepo, type LifecycleRepo } from "./src/repo";
export { PgLifecycleRepo, LIFECYCLE_SCHEMA } from "./src/repo-pg";
export {
  anlassSignatur,
  type LearningPath,
  type LearningStep,
  type MerkerErgebnis,
  type OffenerFall,
  type RevalidierungsAnlass,
} from "./src/types";
