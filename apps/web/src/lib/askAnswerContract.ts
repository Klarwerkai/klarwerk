// SCRUM-366 / AG-04 / AG-P2-2 / AG-P2-3 / PI-K2 / FR-ASK-02: DOM-freier „Antwortvertrag" für Ask.
// Macht aus den bereits vorhandenen Signalen (answered/gap, knowledgeClass, konfliktbewusste Quellen)
// eine ruhige, EHRLICHE Rahmung: Worauf basiert die Antwort? Gesichert vs. ungeprüft? Was ist der
// sichere nächste Schritt? Bei fehlender Basis: Wissenslücke, kein Chatbot-Fehler.
//
// KEINE neue Antwort-/Trust-/Statuslogik, KEIN Scoring, KEIN Backend, KEIN RAG. Reine Funktionen →
// testbar ohne DOM. Trust/Nutzbarkeit bleiben ein Belastbarkeits-Signal, KEIN Wahrheitsversprechen.
import type { KnowledgeClass } from "../api/types";
import type { ConflictAwareSourceRef } from "./askView";

export type AnswerContractKind = "verified" | "unverified" | "gap";

export interface AnswerContract {
  kind: AnswerContractKind;
  titleKey: string;
  bodyKey: string;
  nextStepKey: string; // ehrliche, verbale Empfehlung für den sicheren nächsten Schritt
  tone: "pos" | "warn";
  sourceBound: boolean; // true, sobald eine Antwort vorliegt (sie ist an Quellen gebunden)
}

const CONTRACTS: Record<AnswerContractKind, AnswerContract> = {
  verified: {
    kind: "verified",
    titleKey: "ask.contract.verified.title",
    bodyKey: "ask.contract.verified.body",
    nextStepKey: "ask.contract.verified.next",
    tone: "pos",
    sourceBound: true,
  },
  unverified: {
    kind: "unverified",
    titleKey: "ask.contract.unverified.title",
    bodyKey: "ask.contract.unverified.body",
    nextStepKey: "ask.contract.unverified.next",
    tone: "warn",
    sourceBound: true,
  },
  gap: {
    kind: "gap",
    titleKey: "ask.contract.gap.title",
    bodyKey: "ask.contract.gap.body",
    nextStepKey: "ask.contract.gap.next",
    tone: "warn",
    sourceBound: false,
  },
};

// „gesichert" zählt nur dann als verified, wenn KEINE Antwortquelle konfliktbegrenzt ist — ein offener
// (Wahrheits-)Konflikt darf eine Antwort nicht als uneingeschränkt gesichert erscheinen lassen (AG-14).
// Alles andere Beantwortete ist ehrlich „ungeprüft" (markiert, keine Chatbot-Vermutung). Keine Antwort
// → Wissenslücke (kein Fehler).
export function answerContract(input: {
  answered: boolean;
  knowledgeClass: KnowledgeClass;
  sourcesConflicted: boolean;
}): AnswerContract {
  if (!input.answered) {
    return CONTRACTS.gap;
  }
  if (input.knowledgeClass === "gesichert" && !input.sourcesConflicted) {
    return CONTRACTS.verified;
  }
  return CONTRACTS.unverified;
}

// Kompakte, ehrliche Quellen-Bilanz für die Antwortvertrag-Karte. Reine Zählung über die bereits
// konfliktbewusst aufgelösten Quellen (askView) — keine neue Quellen-Engine, kein Fake-Zustand.
export interface AnswerSourceSummary {
  total: number;
  known: number; // im Bestand auflösbar
  unknown: number; // unbekannte ID (ehrlich als unbekannt)
  validated: number; // bekanntes, validiertes KO
  open: number; // bekanntes, NICHT validiertes KO (offen/ungeprüft)
  ready: number; // effektiv nutzbar (konfliktbegrenzte Nutzbarkeit = "ready")
  conflictLimited: number; // mind. ein ungelöster Konflikt wirkt auf die Quelle
}

export function answerSourceSummary(
  sources: readonly ConflictAwareSourceRef[],
): AnswerSourceSummary {
  const summary: AnswerSourceSummary = {
    total: sources.length,
    known: 0,
    unknown: 0,
    validated: 0,
    open: 0,
    ready: 0,
    conflictLimited: 0,
  };
  for (const s of sources) {
    if (s.known) {
      summary.known += 1;
    } else {
      summary.unknown += 1;
    }
    if (s.validated === true) {
      summary.validated += 1;
    } else if (s.validated === false) {
      summary.open += 1;
    }
    if (s.usability === "ready") {
      summary.ready += 1;
    }
    if (s.conflictLimited) {
      summary.conflictLimited += 1;
    }
  }
  return summary;
}

// PI-K2 / AG-P2-3: ehrliche Trust-/Nutzbarkeits-Notiz (Belastbarkeitssignal, kein Wahrheitsversprechen).
export const ANSWER_CONTRACT_TRUST_NOTE_KEY = "ask.contract.trustNote";
