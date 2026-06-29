// SCRUM-330: DOM-freier Helfer für den Review-Nacharbeitskontext. Nach einer warn/down-Entscheidung
// führt die „Im Objekt nacharbeiten"-CTA mit einem risikoarmen Query-Parameter ins KO-Detail, das
// daraufhin einen ehrlichen Nacharbeits-Hinweis zeigt (Bearbeitung → neue Version/Review, KEINE
// automatische Freigabe/Rückgabe). Kein Backend, keine DOM-Abhängigkeit.

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
