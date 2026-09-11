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

// ================================================================================================
// REVIEW26 (JOB 3469) — JEDE FÜHRENDE ZAHL SAGT, WAS SIE MISST.
// ================================================================================================
//
// DER BEFUND: dasselbe Paar zeigte auf dem Brett „95 % gleich" und auf der Vergleichsseite
// „26 % gleich". Beide Zahlen waren richtig — sie messen nur Verschiedenes (Modell-Sicherheit
// gegen deterministische Textdeckung), und keine Beschriftung sagte, welche welche ist.
//
// Es wird deshalb NICHTS gerechnet und nichts angeglichen. Was fehlte, war der NAME der Zahl, und
// den vergibt ab hier genau EINE Stelle: diese Datei. Die Ansichten wählen nicht mehr selbst,
// welche Zahl führt, und sie erfinden auch keine Beschriftung dazu.
export type LeadMetric =
  // Sicherheit des Modells über seinen eigenen Fund (detector.confidence).
  | "modelConfidence"
  // Deterministische Textdeckung der beiden Texte (detector.lexicalScore).
  | "textOverlap"
  // Durchschnitt der Abschnitts-Textähnlichkeit — die Ersatzzahl der Vergleichsseite, wenn es
  // gar keinen Detektorwert gibt. Bewusst ein eigener Name: ein Durchschnitt über acht Felder
  // ist keine Textdeckung.
  | "sectionAverage";

// „NN % <Metrik>" als i18n-Schlüssel je Metrik — EIN Schlüssel statt Zahl und Wort getrennt, damit
// jede Sprache Zahl, Prozentzeichen und Benennung selbst anordnen kann.
export const LEAD_METRIC_TEXT: Record<LeadMetric, string> = {
  modelConfidence: "dup.lead.modelConfidence",
  textOverlap: "dup.lead.textOverlap",
  sectionAverage: "dup.lead.sectionAverage",
};

export interface OverlapDetectorInfo {
  // Erkennungsart als i18n-Schlüssel (immer gesetzt, sobald detector vorhanden).
  methodLabelKey: string;
  // Deterministische Textdeckung in Prozent (0..100). Immer aus dem detector ableitbar.
  overlapPercent: number;
  // Modell-Sicherheit in Prozent — nur bei echtem Modell-Fund (method="model" MIT gesetzter confidence).
  confidencePercent?: number;
  // SCRUM-486 E: „KI-Fund" NUR bei tatsächlich vorhandener Konfidenz. Ein Modell-Fund ohne confidence
  // wird konsistent wie ein Textabgleich geführt (Label + Führung), nicht als „KI-Prüfung" etikettiert.
  isModelFinding: boolean;
  // REVIEW26 (JOB 3469): die EINE Zahl, die das Brett in der Kopfzeile führt — und WAS sie misst.
  // Die Auswahl stand bis hierher in `Duplicates.tsx` und ist damit dort ersatzlos entfallen.
  leadMetric: LeadMetric;
  leadPercent: number;
  // i18n-Schlüssel der Beschriftung dieser Zahl („NN % Textdeckung" / „NN % KI-Sicherheit").
  leadTextKey: string;
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
  const isModelFinding = d.method === "model" && typeof d.confidence === "number";
  const confidencePercent = isModelFinding
    ? Math.round(Math.min(1, Math.max(0, d.confidence as number)) * 100)
    : undefined;
  const overlapPercent = Math.round(clamped * 100);
  // REVIEW26 (JOB 3469): dieselbe Wahl wie bisher, nur an EINEM Ort — KI-Sicherheit beim echten
  // Modellfund, sonst die deterministische Textdeckung. `confidencePercent` ist genau dann gesetzt,
  // wenn `isModelFinding` gilt; es gibt deshalb keinen Ersatzwert und keine zweite Auslegung.
  const leadMetric: LeadMetric =
    confidencePercent !== undefined ? "modelConfidence" : "textOverlap";
  return {
    // KI-Label nur, wenn es wirklich ein KI-Fund MIT Sicherheitswert ist — sonst Textabgleich.
    methodLabelKey: isModelFinding
      ? DUPLICATE_BOARD_TEXT.methodModel
      : DUPLICATE_BOARD_TEXT.methodDeterministic,
    overlapPercent,
    isModelFinding,
    leadMetric,
    leadPercent: confidencePercent !== undefined ? confidencePercent : overlapPercent,
    leadTextKey: LEAD_METRIC_TEXT[leadMetric],
    ...(confidencePercent !== undefined ? { confidencePercent } : {}),
    ...(d.rationale ? { rationale: d.rationale } : {}),
    ...(d.modelLabel ? { modelLabel: d.modelLabel } : {}),
  };
}

// Die menschlichen Abschlüsse (Fehlalarm / getrennt lassen / verlinken) sind nur bei noch
// offenen Einträgen sinnvoll.
export function canClose(entry: OverlapEntry): boolean {
  return entry.status !== "geschlossen";
}
