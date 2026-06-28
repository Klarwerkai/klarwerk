// SCRUM-258: Reine, DOM-freie Beschreibung der drei Review-Entscheidungen für die Validierungskarte.
// Macht die Entscheidung textlich führbar (Freigeben/Rückfrage/Ablehnen), OHNE die bestehende Logik
// zu ändern: die Verdicts bleiben "up"/"warn"/"down" und damit die vorhandenen Mutationen. Gelb/Rot
// (warn/down) verlangen weiterhin Pflicht-Feedback (requiresFeedback).
import { askQuestionHref } from "./askQuestion";
import type { FeedbackVerdict } from "./validationFeedback";

export type ReviewVerdict = "up" | FeedbackVerdict; // "up" | "warn" | "down"
export type ReviewTone = "pos" | "warn" | "crit";

export interface ReviewDecision {
  verdict: ReviewVerdict;
  labelKey: string; // i18n-Key für das sichtbare Label
  tone: ReviewTone; // Tönung der Schaltfläche
  requiresFeedback: boolean; // warn/down → Begründung Pflicht
}

export const REVIEW_DECISIONS: readonly ReviewDecision[] = [
  { verdict: "up", labelKey: "val.actionApprove", tone: "pos", requiresFeedback: false },
  { verdict: "warn", labelKey: "val.actionQuery", tone: "warn", requiresFeedback: true },
  { verdict: "down", labelKey: "val.actionReject", tone: "crit", requiresFeedback: true },
];

// SCRUM-277: nach einer Bewertungsentscheidung den nächsten Schritt im Kernzyklus zeigen.
// Immer: das betroffene KO ansehen (/wissen/:id). NUR bei Freigabe-Stimme (up) zusätzlich der
// Use-Schritt „Wissen fragen/nutzen" (/fragen?q=<KO-Titel> via askQuestionHref) — kein Auto-Submit,
// keine automatische Freigabe (Ask zeigt selbst den echten Status/Lücke). Reine, testbare Logik.
export interface ReviewNextStep {
  labelKey: string;
  to: string; // vorhandene Route
}

export function reviewNextSteps(decision: {
  id: string;
  title: string;
  verdict: ReviewVerdict;
}): ReviewNextStep[] {
  const steps: ReviewNextStep[] = [{ labelKey: "val.nextViewKo", to: `/wissen/${decision.id}` }];
  if (decision.verdict === "up") {
    steps.push({ labelKey: "val.nextUse", to: askQuestionHref(decision.title) });
  }
  return steps;
}

// SCRUM-292: ehrliche „was passiert jetzt mit dem Wissen"-Aussage je Verdict — OHNE zu behaupten,
// dass eine einzelne Freigabe-Stimme automatisch vollständig validiert (das garantiert das
// Datenmodell nicht). `usable` markiert NUR, dass bei „up" grundsätzlich der Weg in die
// quellengebundene Nutzung offensteht, WENN Status/Trust es tragen — Ask/KO-Detail zeigen den
// echten Status selbst. Reine, DOM-freie Logik; keine Backend-/Mutationsänderung, keine Freigabe.
export type ReviewOutcomeTone = "pos" | "warn" | "crit";

export interface ReviewOutcome {
  verdict: ReviewVerdict;
  statusKey: string; // i18n-Key: ehrliche Folge-Aussage
  tone: ReviewOutcomeTone;
  usable: boolean; // up → grundsätzlich nutzbarer Weg (status/trust-abhängig); sonst Review-Arbeit
}

const OUTCOMES: Record<ReviewVerdict, ReviewOutcome> = {
  up: { verdict: "up", statusKey: "val.outcome.up", tone: "pos", usable: true },
  warn: { verdict: "warn", statusKey: "val.outcome.warn", tone: "warn", usable: false },
  down: { verdict: "down", statusKey: "val.outcome.down", tone: "crit", usable: false },
};

export function reviewOutcome(verdict: ReviewVerdict): ReviewOutcome {
  return OUTCOMES[verdict];
}
