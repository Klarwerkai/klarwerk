// SCRUM-328: DOM-freie Helfer für die Fokusansichten des Validation Boards. Synchronisiert die
// Board-Fokusfilter (Herkunft `origin` + Review-Fokus `review`) mit der URL-Query, erkennt aktive
// Filter und unterscheidet ehrlich, ob das Board leer ist, weil keine Review-Arbeit existiert oder
// weil die Filter zu eng stehen. Keine Backend-/Datenmodelländerung, keine DOM-Abhängigkeit.

import { DEMO_FILTER_PARAM, type DemoKnowledgeFilter } from "./demoKnowledge";
import { REVIEW_FOCUS_PARAM, type ReviewFocusFilter } from "./validationReviewContext";

export interface BoardFocusState {
  origin: DemoKnowledgeFilter;
  review: ReviewFocusFilter;
}

// Aktiv = mindestens ein Fokusfilter weicht vom Standard „all" ab.
export function boardFocusActive(state: BoardFocusState): boolean {
  return state.origin !== "all" || state.review !== "all";
}

// Merge der Fokusfilter in die bestehende Query: Standard „all" wird ENTFERNT (saubere URL), andere
// Werte gesetzt. Alle übrigen Query-Parameter (z. B. demo=stage1) bleiben erhalten.
export function applyBoardFocusParams(
  params: URLSearchParams,
  state: BoardFocusState,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (state.origin === "all") {
    next.delete(DEMO_FILTER_PARAM);
  } else {
    next.set(DEMO_FILTER_PARAM, state.origin);
  }
  if (state.review === "all") {
    next.delete(REVIEW_FOCUS_PARAM);
  } else {
    next.set(REVIEW_FOCUS_PARAM, state.review);
  }
  return next;
}

// Reset = beide Fokusfilter auf Standard; übrige Query bleibt erhalten.
export function resetBoardFocusParams(params: URLSearchParams): URLSearchParams {
  return applyBoardFocusParams(params, { origin: "all", review: "all" });
}

// "not-empty": es gibt sichtbare Treffer. "none": gar keine Review-Arbeit (Datenmenge leer).
// "filtered": Daten vorhanden, aber die aktuellen Filter ergeben keine Treffer.
export type BoardEmptyKind = "not-empty" | "none" | "filtered";

export function boardEmptyKind(args: {
  totalItems: number;
  visibleCount: number;
}): BoardEmptyKind {
  if (args.visibleCount > 0) {
    return "not-empty";
  }
  return args.totalItems === 0 ? "none" : "filtered";
}
