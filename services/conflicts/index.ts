// Öffentliche API des Moduls conflicts.
export { ConflictService } from "./src/service";
export type { ConflictServiceDeps } from "./src/service";
export { InMemoryConflictRepo, type ConflictRepo } from "./src/repo";
export { PgConflictRepo, CONFLICTS_SCHEMA } from "./src/repo-pg";
export { ConflictError } from "./src/types";
export type {
  Conflict,
  ConflictType,
  ConflictStatus,
  ConflictInput,
  ConflictErrorCode,
  // Berater-Konzept 04.07. (Stufe 4): Herkunft + Erkennungs-Metadaten (Board-Badge).
  ConflictOrigin,
  ConflictDetector,
} from "./src/types";
// Berater-Konzept 04.07. (Stufe 2/3): Kerntext-Subjekt der automatischen Erkennung (der App-Root
// bildet Wissensobjekte auf diese modul-reine Form ab; conflicts kennt knowledge-object nicht).
export type { DetectSubject, ConflictVerdict } from "./src/detect";
// Weg 3 (Prefilter): Kerntext eines Subjekts (K0-2) — derselbe String, den der Duplikat-Judge
// vergleicht. Wird für die semantische Vorfilterung eingebettet, damit Prefilter und Urteil denselben
// Gegenstand sehen.
export { coreText } from "./src/detect";

// Berater-Konzept Duplikate 04.07. (Stufe D3): Überschneidungs-Erkennung (eigene Entität,
// schlanker Lebenszyklus). Teilt Ledger/Muster mit Konflikten, produktseitig getrennt.
export { OverlapService } from "./src/overlap-service";
export type { OverlapServiceDeps } from "./src/overlap-service";
export { InMemoryOverlapRepo, type OverlapRepo } from "./src/overlap-repo";
export { PgOverlapRepo, OVERLAP_SCHEMA } from "./src/overlap-repo-pg";
// Pedi 04.07.: einstellbare Anzeige-Schwelle der Duplikat-Erkennung (Admin-Einstellung, persistiert).
export {
  type OverlapSettings,
  type OverlapSettingsRepo,
  DEFAULT_OVERLAP_SETTINGS,
  OVERLAP_SETTINGS_BOUNDS,
  InMemoryOverlapSettingsRepo,
  PgOverlapSettingsRepo,
  OVERLAP_SETTINGS_SCHEMA,
  normalizeOverlapSettings,
} from "./src/overlap-settings";
export { OverlapError } from "./src/overlap-types";
export type {
  OverlapEntry,
  OverlapInput,
  OverlapStatus,
  OverlapOrigin,
  OverlapResolution,
  OverlapResolutionReason,
  OverlapDetector,
  OverlapErrorCode,
} from "./src/overlap-types";
// D3: Überschneidungs-Urteil (Reasoner „Duplikatprüfung") — modul-reine Form für den judge-Callback.
export type {
  OverlapVerdict,
  OverlapRelation,
  OverlapRecommendation,
  OverlapAspect,
} from "./src/duplicate-detect";
