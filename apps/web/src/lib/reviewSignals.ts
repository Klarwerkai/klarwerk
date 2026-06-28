// SCRUM-249: DOM-freie Ableitung der Review-Signale fürs Validierungsboard. Macht pro KO kompakt
// sichtbar, was für die Entscheidung zählt — AUSSCHLIESSLICH aus vorhandenen Feldern (Status,
// Trust, Version, Autor/Originalautor, Zuweisung). KEIN neues Validierungsmodell, KEINE neue
// Bewertungslogik, KEINE neuen Backend-Felder. Reine Funktionen → testbar ohne DOM.
import type { KnowledgeObject } from "../api/types";
import type { DisplayStatus } from "../components/trust/types";
import { deriveStatus } from "./displayStatus";

export type TrustBand = "low" | "mid" | "high";
export type ReviewWorkState = "new" | "assigned" | "inReview" | "validated";
export type ReviewWorkTone = "warn" | "neutral" | "pos";

// Vertrauensband (nur Anzeige-/Tönungslogik; identische Schwellen, kein erfundener Score).
export function trustBand(trust: number): TrustBand {
  if (trust >= 70) {
    return "high";
  }
  if (trust >= 40) {
    return "mid";
  }
  return "low";
}

export interface ReviewSignals {
  status: DisplayStatus; // abgeleiteter Anzeigestatus (offen/pruefung/…)
  trust: number; // aktueller Trust 0–100
  trustBand: TrustBand;
  version: number;
  needed: number; // nötige Validierungen (neededValidations)
  assigned: boolean; // bereits jemandem zur Prüfung zugewiesen
  authorTransferred: boolean; // Autor ≠ Originalautor → extra Prüfblick
}

export interface ReviewWorkView {
  state: ReviewWorkState;
  labelKey: string;
  hintKey: string;
  tone: ReviewWorkTone;
}

export function reviewSignals(ko: KnowledgeObject): ReviewSignals {
  return {
    status: deriveStatus(ko),
    trust: ko.trust,
    trustBand: trustBand(ko.trust),
    version: ko.version,
    needed: ko.neededValidations,
    assigned: (ko.assignments?.length ?? 0) > 0,
    authorTransferred: ko.author !== ko.originalAuthor,
  };
}

// SCRUM-287: Arbeitszustand fürs Review aus vorhandenen KO-Feldern ableiten. Kein neues
// Statusmodell, keine Task-Engine: frisch erfasste KOs starten offen mit trust=0 → „neu/offen,
// noch keine Bewertung"; zugewiesene oder bereits teilbewertete KOs werden ehrlich unterschieden.
export function reviewWorkView(ko: KnowledgeObject): ReviewWorkView {
  if (ko.status === "validiert") {
    return {
      state: "validated",
      labelKey: "val.reviewState.validated",
      hintKey: "val.reviewHint.validated",
      tone: "pos",
    };
  }
  if ((ko.assignments?.length ?? 0) > 0) {
    return {
      state: "assigned",
      labelKey: "val.reviewState.assigned",
      hintKey: "val.reviewHint.assigned",
      tone: "warn",
    };
  }
  if ((ko.trust ?? 0) <= 0) {
    return {
      state: "new",
      labelKey: "val.reviewState.new",
      hintKey: "val.reviewHint.new",
      tone: "warn",
    };
  }
  return {
    state: "inReview",
    labelKey: "val.reviewState.inReview",
    hintKey: "val.reviewHint.inReview",
    tone: "neutral",
  };
}

// Review-Priorität: was zuerst angeschaut werden sollte. Autor-Transfer vorgezogen (extra
// Prüfbedarf), dann niedrigster Trust (am wenigsten abgesichert), dann Titel/ID — deterministisch.
export function compareReviewPriority(a: KnowledgeObject, b: KnowledgeObject): number {
  const transferA = a.author !== a.originalAuthor ? 0 : 1;
  const transferB = b.author !== b.originalAuthor ? 0 : 1;
  return (
    transferA - transferB ||
    (a.trust ?? 0) - (b.trust ?? 0) ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
}

export function sortByReviewPriority(kos: readonly KnowledgeObject[]): KnowledgeObject[] {
  return [...kos].sort(compareReviewPriority);
}
