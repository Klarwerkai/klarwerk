// SCRUM-370 / AG-12 / AG-13 / AG-P2-4: DOM-freie Produktführung für die Erfassung. Rahmt Capture NICHT
// als technisches Formular, sondern als einfachen geführten Weg: Rohwissen erfassen → im Knowledge
// Studio strukturieren (empfohlener Hauptweg) → prüfen & einreichen. Das Studio ist der große, ruhige
// Arbeitsraum mit KI-Hilfe — es soll als naheliegender nächster Schritt sichtbar sein, nicht versteckt.
//
// KEIN Multi-Step-Wizard mit Backend-State, KEIN Score/Gamification, KEINE neue Architektur, kein RAG.
// Reine i18n-/Datenbeschreibung → testbar ohne DOM. Ehrlichkeit bleibt: erst nach Prüfung gesichert.

export type CaptureFlowStepId = "raw" | "studio" | "review";

export interface CaptureFlowStep {
  id: CaptureFlowStepId;
  labelKey: string;
  hintKey: string;
  // Der empfohlene Hauptweg-Schritt (Studio als großer Strukturier-Arbeitsraum). Genau EINER.
  recommended?: boolean;
}

// Der empfohlene Hauptweg-Schritt (Studio) als benannte Konstante — so bleibt der Rückgabetyp von
// recommendedFlowStep() definit (kein Index-Zugriff/undefined unter noUncheckedIndexedAccess).
const RAW_STEP: CaptureFlowStep = {
  id: "raw",
  labelKey: "capture.flow.step.raw.label",
  hintKey: "capture.flow.step.raw.hint",
};
const STUDIO_STEP: CaptureFlowStep = {
  id: "studio",
  labelKey: "capture.flow.step.studio.label",
  hintKey: "capture.flow.step.studio.hint",
  recommended: true,
};
const REVIEW_STEP: CaptureFlowStep = {
  id: "review",
  labelKey: "capture.flow.step.review.label",
  hintKey: "capture.flow.step.review.hint",
};

// Feste Reihenfolge = der geführte Weg. Das Studio ist bewusst als empfohlener Mittelschritt markiert
// (AG-12: Studio soll der naheliegende Hauptweg sein, nicht ein versteckter Zusatz).
export const CAPTURE_FLOW_STEPS: readonly CaptureFlowStep[] = [RAW_STEP, STUDIO_STEP, REVIEW_STEP];

export function captureFlowSteps(): readonly CaptureFlowStep[] {
  return CAPTURE_FLOW_STEPS;
}

export function captureFlowStepLabelKey(id: CaptureFlowStepId): string {
  return `capture.flow.step.${id}.label`;
}

// Der empfohlene Hauptweg-Schritt (genau einer) — für „Empfohlen"-Hervorhebung am Studio-Einstieg.
export function recommendedFlowStep(): CaptureFlowStep {
  return STUDIO_STEP;
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (kein Doppel-Literal).
// - railKicker: kurze Überschrift der Weg-Leiste („So gehst du vor").
// - studioRecommended: „Empfohlen"-Chip am Studio-Einstieg.
// - studioLead: ruhiger Hinweis, dass das Studio der empfohlene Strukturier-Schritt ist.
// - submitValue: Beitragswert/Motivation direkt an der Einreich-Entscheidung (AG-P2-4) — ehrlich:
//   gesichert wird das Wissen erst nach der Prüfung, nichts wird automatisch validiert.
export const CAPTURE_FLOW_TEXT = {
  railKicker: "capture.flow.railKicker",
  railKickerHint: "capture.flow.railKickerHint",
  studioRecommended: "capture.flow.studioRecommended",
  studioLead: "capture.flow.studioLead",
  submitValue: "capture.flow.submitValue",
} as const;
