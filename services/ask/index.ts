// Öffentliche API des Moduls ask.
export { AskService } from "./src/service";
export type { AskServiceDeps, AskResult } from "./src/service";
export { InMemoryGapRepo, type GapRepo } from "./src/repo";
export { PgGapRepo, ASK_SCHEMA } from "./src/repo-pg";
// W3-A (KW-W3-18): der Repo-Kern der Antwortbelege. Die Fassade wird MITGESCHRIEBEN und nicht
// nachgereicht — die W2-A-Lehre (Preflight 39 F1): eine exportierte Konstante, die die
// Modulfassade nicht weiterreicht, ist fuer `services/app` unerreichbar, und der Fehler faellt
// erst der naechsten Welle auf.
export {
  InMemoryAnswerSnapshotRepo,
  pruefeSnapshotKette,
  type AnswerSnapshotRepo,
} from "./src/repo";
export { PgAnswerSnapshotRepo, ANSWER_SNAPSHOT_SCHEMA } from "./src/repo-pg";
export {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  answerSnapshotHashMaterial,
  answerSnapshotIntegrity,
  answerSnapshotStatus,
  hashAnswerSnapshot,
} from "./src/types";
export type {
  AnswerEvidenceRef,
  AnswerEvidenceSnapshot,
  AnswerIntegrityContext,
  // KW-W3-22 (Auftrag 129): die geschlossene Ursache MUSS ueber die Fassade erreichbar sein — der
  // spaetere W3-C-Lesepfad in `services/app` bildet sie, und ein Typ, den die Fassade nicht
  // weiterreicht, ist dort schlicht nicht vorhanden (Lehre W2-A Preflight 39 F1).
  AnswerPrimaryResolutionFailure,
  AnswerIntegrityState,
  AnswerNullReason,
  AnswerRecord,
  AnswerSnapshotStatus,
  AnswerValidationDecisionRef,
} from "./src/types";
export {
  ANSWER_RECEIPT_TTL_MS,
  MIN_RECEIPT_SECRET_BYTES,
  ReceiptSecretError,
  parseConfiguredReceiptSecret,
  signAnswerReceipt,
  verifyAnswerReceipt,
} from "./src/receipt";
export { AskError, GAP_PRIORITIES, isGapPriority } from "./src/types";
export type { Gap, GapPriority, AskErrorCode } from "./src/types";
// AUFTRAG-mega34 B1: der kanonische, quellengebundene Evidenzzustand — die EINE Auslegung der
// Antwort-Einstufung für alle Verbraucher, die sie nicht selbst bilden können (Word/Klara).
export { answerCheckState, answerEvidence } from "./src/answer-evidence";
export type {
  AnswerCheckCaveat,
  AnswerCheckState,
  AnswerEvidence,
  AnswerEvidenceInput,
  AnswerGrade,
} from "./src/answer-evidence";
export { redactGapForViewer, summarizeGaps } from "./src/gap-visibility";
export type { GapView, GapViewerContext, GapSummary } from "./src/gap-visibility";
