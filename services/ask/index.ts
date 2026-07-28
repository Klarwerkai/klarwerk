// Öffentliche API des Moduls ask.
export { AskService } from "./src/service";
export type { AskServiceDeps, AskResult } from "./src/service";
export { InMemoryGapRepo, type GapRepo } from "./src/repo";
export { PgGapRepo, ASK_SCHEMA } from "./src/repo-pg";
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
