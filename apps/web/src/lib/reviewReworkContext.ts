// SCRUM-330/331: DOM-freier Helfer für den Review-Nacharbeitskontext. Nach einer warn/down-Entscheidung
// führt die „Im Objekt nacharbeiten"-CTA mit einem risikoarmen Query-Parameter ins KO-Detail, das
// daraufhin einen ehrlichen Nacharbeits-Hinweis zeigt (Bearbeitung → neue Version/Review, KEINE
// automatische Freigabe/Rückgabe). Nach dem Speichern führt der Rückweg gezielt ins Validation Board
// mit Fokus auf überarbeitete KOs. Kein Backend, keine DOM-Abhängigkeit.

import { REVIEW_FOCUS_PARAM } from "./validationReviewContext";

export const REWORK_PARAM = "rework";
export const REWORK_REVIEW_VALUE = "review";

// Link ins KO-Detail mit Nacharbeitskontext (statischer, sicherer Query — keine Fremdparameter nötig).
export function reworkHref(id: string): string {
  return `/wissen/${id}?${REWORK_PARAM}=${REWORK_REVIEW_VALUE}`;
}

// Erkennt den Review-Nacharbeitskontext im KO-Detail (nur bei exaktem rework=review).
export function isReviewReworkContext(params: URLSearchParams): boolean {
  return params.get(REWORK_PARAM) === REWORK_REVIEW_VALUE;
}

// SCRUM-331: Rückweg nach einer Revision aus dem Nacharbeitskontext → Validation Board mit Fokus auf
// überarbeitete KOs (review=revision, Konvention aus validationReviewContext/validationBoardFocus).
// Bewusst KEIN origin=…: die Herkunft (Demo/Eigenes) hängt am KO, nicht an der Nacharbeit — ein fixes
// origin würde sonst u. U. ein Demo-KO fälschlich ausblenden.
export function reworkValidationHref(): string {
  return `/validierung?${REVIEW_FOCUS_PARAM}=revision`;
}
