// Reines, DOM-freies Mapping für das Evidenz-Level einer Ask-Antwort (SCRUM-137).
// `Record<KnowledgeClass, …>` erzwingt Vollständigkeit: ein neuer Enum-Wert ohne
// Eintrag bricht den Typecheck.
import type { KnowledgeClass } from "../api/types";

export type EvidenceTone = "pos" | "warn" | "crit" | "neutral";

export interface EvidenceMeta {
  labelKey: string;
  tone: EvidenceTone;
}

export const KNOWLEDGE_CLASS_META: Record<KnowledgeClass, EvidenceMeta> = {
  gesichert: { labelKey: "ask.knowledgeClass.gesichert", tone: "pos" },
  ungeprueft: { labelKey: "ask.knowledgeClass.ungeprueft", tone: "neutral" },
  meinung: { labelKey: "ask.knowledgeClass.meinung", tone: "warn" },
  extern: { labelKey: "ask.knowledgeClass.extern", tone: "neutral" },
  annahme: { labelKey: "ask.knowledgeClass.annahme", tone: "warn" },
  unbekannt: { labelKey: "ask.knowledgeClass.unbekannt", tone: "crit" },
};

export function knowledgeClassMeta(knowledgeClass: KnowledgeClass): EvidenceMeta {
  return KNOWLEDGE_CLASS_META[knowledgeClass];
}
