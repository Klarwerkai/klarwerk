// Reines, DOM-freies Mobile-Ask-View-Model (SCRUM-113 / FE-MOB-03).
// Verdichtet die vorhandene AnswerResult ohne Logikdopplung; Evidenz kommt aus knowledgeClass.
import type { AnswerResult } from "../api/types";
import { type EvidenceMeta, knowledgeClassMeta } from "./knowledgeClass";

export interface MobileAnswerSummary {
  answered: boolean;
  text: string | null;
  trust: number;
  evidence: EvidenceMeta; // labelKey + tone (für Badge)
  sources: string[];
  stepCount: number;
}

export function summarizeAnswer(answer: AnswerResult): MobileAnswerSummary {
  return {
    answered: answer.answered,
    text: answer.answer,
    trust: answer.trust,
    evidence: knowledgeClassMeta(answer.knowledgeClass),
    sources: answer.sources,
    stepCount: answer.steps.length,
  };
}
