// Öffentliche API des Moduls reasoner.
export { Reasoner } from "./src/service";
export { DeterministicProvider, type ReasonerProvider } from "./src/provider";
export type {
  KnowledgeRef,
  KnowledgeClass,
  AnswerResult,
  AnswerStep,
  StructureResult,
  ReasonerStatus,
} from "./src/types";
