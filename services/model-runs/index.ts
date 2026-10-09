// Öffentliche API des Moduls model-runs (SCRUM-164/165).
export { InMemoryModelRunRepo, type ModelRunRepo } from "./src/repo";
export { PgModelRunRepo, MODEL_RUNS_SCHEMA } from "./src/repo-pg";
export {
  ModelRunService,
  type ModelRunServiceDeps,
  type ModelRunPreisgrundlage,
  normalizeModelRunLimit,
  DEFAULT_MODEL_RUN_LIMIT,
  MAX_MODEL_RUN_LIMIT,
} from "./src/service";
export type {
  ModelRunRecord,
  ModelRunTask,
  ModelRunStatus,
  // mega26 Block A: Laufkontext (wer/woran) — additiv, alle Felder optional.
  ModelRunContext,
  ModelRunSubject,
  ModelRunSubjectKind,
  // Aufnahme gesamt-ki-laufprotokoll: Kosten und Erzeugnis eines Laufs.
  ModelRunKosten,
  ModelRunErzeugnis,
  ModelRunErzeugnisArt,
  // Ben R2 B3/B5: Versuche und Trace eines Laufs.
  ModelRunVersuch,
  ModelRunTrace,
  // mega61 Block F: die maschinenlesbare Kennzeichnung erzeugter Ausgaben (KI-VO Art. 50 Abs. 2).
  AiGeneratedMark,
  AiOutputMode,
} from "./src/types";
export { sanitizeModelRunContext, MAX_MODEL_RUN_CONTEXT_ID_LENGTH } from "./src/types";
export { aiGeneratedMark, KI_ERZEUGENDE_AUFGABEN } from "./src/types";
// Aufnahme gesamt-ki-laufprotokoll (V9, R-2071): Preisliste, Schreibweg mit Kosten/Log, Auswertung.
export {
  lesePreisliste,
  kostenEinesLaufs,
  mitKosten,
  type Preisliste,
  type ModellPreis,
} from "./src/preisliste";
// Aufnahme gesamt-telemetrie (R-0623): die Positivliste der Betriebsdaten eines Laufs.
export {
  nurGelisteteLauffelder,
  MODEL_RUN_FELDER,
  MODEL_RUN_VERSUCH_FELDER,
} from "./src/positivliste";
export {
  ProtokollModelRunRepo,
  kiLaufLogzeile,
  type KiLaufLogzeile,
} from "./src/protokoll-repo";
export {
  werteLaeufeAus,
  MAX_AUSWERTUNG_LAEUFE,
  type ModelRunAuswertung,
  type ModelRunKostensumme,
  type ModelRunAufgabenWerte,
} from "./src/auswertung";
// Ben R2 B5: Tracing (W3C Trace Context) für KI-Läufe.
export {
  mitKiTrace,
  traceKontextAus,
  traceFuerLauf,
  neueSpanId,
  type KiTraceKontext,
} from "./src/trace";
