// Öffentliche API des Moduls conflicts.
export { ConflictService } from "./src/service";
export type { ConflictServiceDeps, DryRunConflict } from "./src/service";
// D-AISTATE PAKET 4 (bens V5, aistate-fix5): IsKoVersionCurrent = Versions-Autorität des
// versions-konditionalen Inserts (insertIfVersionsCurrent) — der App-Root bindet sie an den KO-Store.
export { InMemoryConflictRepo, type ConflictRepo, type IsKoVersionCurrent } from "./src/repo";
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
// SCRUM-527 (Live-Check): deterministische, DOM-freie Trigramm-Ähnlichkeit (0..1) — dieselbe Kennzahl,
// mit der die Kandidatenauswahl arbeitet. Für die lexikalische Ähnlichkeitssuche des Live-Checks
// (Freitext gegen Bestand) ohne Modell/Embedding-Egress.
export { trigramSimilarity } from "./src/detect";

// Berater-Konzept Duplikate 04.07. (Stufe D3): Überschneidungs-Erkennung (eigene Entität,
// schlanker Lebenszyklus). Teilt Ledger/Muster mit Konflikten, produktseitig getrennt.
export { OverlapService } from "./src/overlap-service";
export type { OverlapServiceDeps, DryRunOverlap } from "./src/overlap-service";
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
// JOB 3061 · H2 (bens Korrekturpflicht 1, Runde 5): der Menüweg „Status setzen" braucht an der
// Modulgrenze zweierlei — die WÄHLBAREN Abschlussgründe (die Route bietet nichts Systemisches an)
// und das Prädikat, mit dem der rohe Drahtwert geprüft wird, BEVOR er den Dienst erreicht.
export {
  HUMAN_OVERLAP_CLOSE_REASONS,
  isHumanOverlapCloseReason,
} from "./src/overlap-types";
export type {
  OverlapEntry,
  OverlapInput,
  OverlapStatus,
  OverlapOrigin,
  OverlapResolution,
  OverlapResolutionReason,
  HumanOverlapCloseReason,
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
// SCRUM-491: lexikalischer Deckungs-Score — für den gedeckelten lexikalischen Fallback der Pool-Auswahl
// im App-Orchestrator (kein neues Gehirn: derselbe Score, den die Erkennung selbst nutzt).
export { lexicalOverlapScore } from "./src/duplicate-detect";
// AUFTRAG-mega28 A2/A3 (Pedi 26.07.): der Ergebnis-Vertrag der Deckelung — wie viele Kandidaten
// standen zur Wahl, wie viele wurden geprüft, wurde gedeckelt/übersprungen/abgebrochen. Der App-Root
// stellt das Protokoll, die Läufe schreiben es fort, die Oberfläche liest es.
// AUFTRAG-mega32 A1/B: `isCompleteRun` ist die KANONISCHE positive Vollständigkeits-Invariante (die
// beiden Spiegel diesseits der Modulgrenzen leiten nichts eigenständig ab); `singleRunBalances`
// prüft die Buchhaltungs-Gleichung eines EINZELLAUFS, die bis mega31 nur ein Kommentar behauptete.
export {
  type DetectionCoverage,
  emptyCoverage,
  mergeCoverage,
  isCompleteRun,
  singleRunBalances,
} from "./src/coverage";
