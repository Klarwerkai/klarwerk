// SCRUM-369 / AG-12 / AG-13 / AG-P2-4: DOM-freie Produktführung für den Ask→Rescue-Fluss. Rahmt eine
// unbeantwortete Ask-Frage NICHT als toten Chatbot-Zustand, sondern als geführten „Wissenslücke
// retten"-Einstieg: die Lücke ist eine Chance, fehlendes Erfahrungswissen zu sichern. Eine feste,
// geführte Schrittfolge (Frage beantworten → eigene Erfahrung ergänzen → KI strukturieren lassen →
// prüfen lassen) ist die EINE Quelle für Ask-Gap-Karte UND Capture-Gap-Kontext.
//
// KEIN neues Gap-/Task-/Workflow-Backend, KEINE automatische Lücken-Schließung, KEINE Fake-Validierung,
// KEIN Punkte-/Gamification-System, kein RAG/Suche. Reine i18n-/Datenbeschreibung → testbar ohne DOM.

export type GapRescueStepId = "answer" | "experience" | "structure" | "review";

export interface GapRescueStep {
  id: GapRescueStepId;
  labelKey: string;
  hintKey: string;
}

// Feste Reihenfolge = geführter Ablauf. Deckt sich mit dem Knowledge-OS-Kreis (Erfassen → Validieren):
// erst die eigene Erfahrung, dann KI-Strukturierung, dann ehrliche Prüfung — nichts wird auto-freigegeben.
export const GAP_RESCUE_STEPS: readonly GapRescueStep[] = [
  { id: "answer", labelKey: "ask.gap.step.answer.label", hintKey: "ask.gap.step.answer.hint" },
  {
    id: "experience",
    labelKey: "ask.gap.step.experience.label",
    hintKey: "ask.gap.step.experience.hint",
  },
  {
    id: "structure",
    labelKey: "ask.gap.step.structure.label",
    hintKey: "ask.gap.step.structure.hint",
  },
  { id: "review", labelKey: "ask.gap.step.review.label", hintKey: "ask.gap.step.review.hint" },
];

export function gapRescueSteps(): readonly GapRescueStep[] {
  return GAP_RESCUE_STEPS;
}

export function gapRescueStepLabelKey(id: GapRescueStepId): string {
  return `ask.gap.step.${id}.label`;
}

// Flache Copy-Schlüssel des Rescue-Rahmens — EINE Quelle für Komponenten + Tests (kein Doppel-Literal).
// - storyTitle/impact: „Wissenslücke retten" + Beitragswert (AG-P2-4, ehrlich: zählt erst nach Prüfung).
// - noInvent: es wurde keine Antwort erfunden (kein Chatbot-Rateverhalten).
// - cta: Aufruf in den vorhandenen Capture-/Rescue-Pfad (nutzt captureGapHref weiter).
// - stepsTitle: Überschrift der geführten Schrittfolge.
// - savedNote: ehrlicher Anschluss nach dem Speichern (nach Validierung beantwortet die Basis die Frage
//   künftig besser; KEINE automatische Lücken-Schließung — die Prüfung entscheidet).
export const GAP_RESCUE_TEXT = {
  storyTitle: "ask.gap.rescueTitle",
  impact: "ask.gap.rescueImpact",
  noInvent: "ask.gap.noInvent",
  cta: "ask.gap.rescueCta",
  stepsTitle: "ask.gap.stepsTitle",
  savedNote: "capture.gapSavedNote",
} as const;
