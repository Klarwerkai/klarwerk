// Berater-Konzept Duplikate 04.07. (Stufe D4): DOM-freie Ableitung der Anzeige eines
// Überschneidungs-Eintrags fürs Duplikate-Board — hält Duplicates.tsx schlank und ist testbar.
// Zeigt Erkennungsart (KI-Prüfung / Textabgleich), Textdeckung (%), bei KI-Funden zusätzlich
// Sicherheit (%) und Begründung. Beziehung und Empfehlung werden auf i18n-Schlüssel abgebildet.
import type { OverlapEntry, OverlapRecommendation, OverlapRelation } from "../api/types";

export const DUPLICATE_BOARD_TEXT = {
  methodModel: "dup.method.model",
  methodDeterministic: "dup.method.deterministic",
  overlap: "dup.overlap",
  confidence: "dup.confidence",
  why: "dup.why",
  quoteA: "dup.quoteA",
  quoteB: "dup.quoteB",
  dismiss: "dup.action.dismiss",
  keepSeparate: "dup.action.keepSeparate",
  linkRelated: "dup.action.linkRelated",
} as const;

const RELATION_KEY: Record<OverlapRelation, string> = {
  identisch: "dup.relation.identisch",
  a_enthaelt_b: "dup.relation.a_enthaelt_b",
  b_enthaelt_a: "dup.relation.b_enthaelt_a",
  teilweise: "dup.relation.teilweise",
  verwandt: "dup.relation.verwandt",
};

const RECOMMENDATION_KEY: Record<OverlapRecommendation, string> = {
  zusammenfuehren: "dup.rec.zusammenfuehren",
  zusammenfuehren_pruefen: "dup.rec.zusammenfuehren_pruefen",
  getrennt_lassen: "dup.rec.getrennt_lassen",
  verwandt_verlinken: "dup.rec.verwandt_verlinken",
};

export function relationLabelKey(relation: OverlapRelation): string {
  return RELATION_KEY[relation];
}

export function recommendationLabelKey(recommendation: OverlapRecommendation): string {
  return RECOMMENDATION_KEY[recommendation];
}

export interface OverlapDetectorInfo {
  // Erkennungsart als i18n-Schlüssel (immer gesetzt, sobald detector vorhanden).
  methodLabelKey: string;
  // Deterministische Textdeckung in Prozent (0..100). Immer aus dem detector ableitbar.
  overlapPercent: number;
  // Modell-Sicherheit in Prozent — nur bei method="model" mit gesetzter confidence.
  confidencePercent?: number;
  rationale?: string;
  modelLabel?: string;
}

// Herkunfts-/Erkennungs-Info fürs Board. Ohne detector (Alt-/Handdaten) → null: kein Fake-Prozent.
export function overlapDetectorInfo(entry: OverlapEntry): OverlapDetectorInfo | null {
  const d = entry.detector;
  if (!d) {
    return null;
  }
  const clamped = Math.min(1, Math.max(0, d.lexicalScore));
  return {
    methodLabelKey:
      d.method === "model"
        ? DUPLICATE_BOARD_TEXT.methodModel
        : DUPLICATE_BOARD_TEXT.methodDeterministic,
    overlapPercent: Math.round(clamped * 100),
    ...(d.method === "model" && typeof d.confidence === "number"
      ? { confidencePercent: Math.round(Math.min(1, Math.max(0, d.confidence)) * 100) }
      : {}),
    ...(d.rationale ? { rationale: d.rationale } : {}),
    ...(d.modelLabel ? { modelLabel: d.modelLabel } : {}),
  };
}

// Die menschlichen Abschlüsse (Fehlalarm / getrennt lassen / verlinken) sind nur bei noch
// offenen Einträgen sinnvoll.
export function canClose(entry: OverlapEntry): boolean {
  return entry.status !== "geschlossen";
}
