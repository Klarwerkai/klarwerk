// SCRUM-326: DOM-freier Review-Kontext für das Validation Board. Leitet aus einem KO ab, ob es NEU
// erfasst (Erstbewertung) oder REVIDIERT/überarbeitet wurde (Version > 1) — als Orientierung für
// Beta-Revisoren. KEINE fachliche Wahrheitsbewertung, KEINE automatische Validierung/Freigabe, kein
// Backend. Status/Trust werden nur durchgereicht (nicht überschrieben). Robust gegen seltsame
// Versionswerte (fehlend/0/negativ/NaN → defensiv „new").

export type ReviewContextKind = "new" | "revision";

export interface ReviewContextInput {
  version?: number | null;
  status?: string | null;
  trust?: number | null;
}

export interface ReviewContext {
  kind: ReviewContextKind;
  version: number;
  status: string;
  trust: number;
  labelKey: string;
  hintKey: string;
  tone: ReviewContextKind;
}

// Version defensiv normalisieren: nur endliche Zahlen ≥ 1 zählen, sonst 1 (Erstfassung).
function normalizeVersion(version: number | null | undefined): number {
  if (typeof version === "number" && Number.isFinite(version) && version >= 1) {
    return Math.floor(version);
  }
  return 1;
}

export function reviewContextLabelKey(kind: ReviewContextKind): string {
  return `val.reviewContext.${kind}`;
}

export function reviewContextHintKey(kind: ReviewContextKind): string {
  return `val.reviewContext.hint.${kind}`;
}

export function validationReviewContext(ko: ReviewContextInput | null | undefined): ReviewContext {
  const version = normalizeVersion(ko?.version);
  const kind: ReviewContextKind = version > 1 ? "revision" : "new";
  const trust = typeof ko?.trust === "number" && Number.isFinite(ko.trust) ? ko.trust : 0;
  return {
    kind,
    version,
    status: ko?.status ?? "",
    trust,
    labelKey: reviewContextLabelKey(kind),
    hintKey: reviewContextHintKey(kind),
    tone: kind,
  };
}

// SCRUM-327: Review-Fokusfilter (nur Ansicht) — gezielt Alle/Neu/Überarbeitet abarbeiten. Nutzt
// dieselbe neu-vs.-revision-Logik wie validationReviewContext (Version > 1). DOM-frei, kein Backend,
// keine fachliche Bewertung; ergänzt die bestehenden fachlichen + Herkunfts-Filter, ersetzt sie nicht.
export type ReviewFocusFilter = "all" | "new" | "revision";

export const REVIEW_FOCUS_FILTERS: readonly ReviewFocusFilter[] = ["all", "new", "revision"];

// Query-Param für den Review-Fokus (lazy init, fehlend/ungültig → "all").
export const REVIEW_FOCUS_PARAM = "review";

export function reviewFocusLabelKey(filter: ReviewFocusFilter): string {
  return `val.reviewFocus.${filter}`;
}

export function matchesReviewFocus(
  ko: ReviewContextInput | null | undefined,
  filter: ReviewFocusFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  return validationReviewContext(ko).kind === filter;
}

export function countByReviewFocus(
  kos: readonly (ReviewContextInput | null | undefined)[],
): Record<ReviewFocusFilter, number> {
  const counts: Record<ReviewFocusFilter, number> = { all: kos.length, new: 0, revision: 0 };
  for (const ko of kos) {
    counts[validationReviewContext(ko).kind] += 1;
  }
  return counts;
}

export function readReviewFocusFilter(params: URLSearchParams): ReviewFocusFilter {
  const value = params.get(REVIEW_FOCUS_PARAM);
  return REVIEW_FOCUS_FILTERS.includes(value as ReviewFocusFilter)
    ? (value as ReviewFocusFilter)
    : "all";
}
