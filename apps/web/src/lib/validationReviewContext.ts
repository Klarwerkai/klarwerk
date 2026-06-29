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
