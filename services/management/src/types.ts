// SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Kennzahlen. Stateless, keine Persistenz.
// Alle Zahlen aus echten Bestandsdaten — keine Demo-/Beispielwerte, keine Bilanzbewertung.
import type { KnowledgeObject } from "../../knowledge-object";

// Plain-Data-Eingabe für die reinen Metrikfunktionen (DOM-frei, testbar).
export interface BusFactorLike {
  category: string;
  authorCount: number;
  koCount: number;
  singleSource: boolean;
}

export interface MetricsInput {
  kos: readonly KnowledgeObject[];
  openGaps: number;
  openConflicts: number;
  pendingRevalidation: readonly string[];
  busFactor: readonly BusFactorLike[];
  now: number;
}

export type Band = "gut" | "mittel" | "kritisch";

export interface Overview {
  totalKos: number;
  validated: number;
  open: number;
  openGaps: number;
  openConflicts: number;
  avgTrust: number;
  healthScore: number;
  healthBand: Band;
}

export interface ScorePart {
  key: string;
  value: number; // 0–100
  weight: number; // 0–1, Summe der Gewichte = 1
}

export interface CapitalScore {
  score: number; // 0–100
  band: Band;
  parts: ScorePart[];
}

// FE-MGMT-04: nur die FAKTEN; der €-Wert entsteht erst im FE über offengelegte Annahmen.
export interface ValuationFacts {
  validatedKos: number;
  totalKos: number;
  avgTrust: number;
}

export interface RiskBreakdown {
  singleSourceCategories: number;
  stale: number;
  openGaps: number;
  openConflicts: number;
}

// FE-MGMT-05: strukturell (Punkte/Zähler), nicht in €. Der €-Abschluss bleibt FE-Valuation.
export interface KnowledgeStatement {
  assets: number; // validierte Objekte = Aktiva-Basis
  riskItems: number; // Summe der Risikoposten
  riskBreakdown: RiskBreakdown;
  net: number; // 0–100 Netto-Index (Kapital nach Risiko)
}

export interface Maturity {
  stage: number; // 1–5
  stageKey: string;
  progressPct: number; // 0–100
}

export interface PriorityFactor {
  key: string;
  value: number; // 0–100 (höher = dringender)
}

export interface CategoryPriority {
  category: string;
  score: number; // 0–100 gewichtete Dringlichkeit
  factors: PriorityFactor[];
}

export type RecommendationSeverity = "hoch" | "mittel";

export interface Recommendation {
  key: string;
  severity: RecommendationSeverity;
  count: number;
}

export interface HouseFloor {
  category: string;
  koCount: number;
  validatedRatio: number; // %
  fragile: boolean;
}

export interface PilotWindow {
  days: number; // 30 | 60 | 90
  created: number;
  validated: number;
}

export interface ManagementSnapshot {
  generatedAt: string;
  overview: Overview;
  capital: CapitalScore;
  valuationFacts: ValuationFacts;
  statement: KnowledgeStatement;
  maturity: Maturity;
  priorities: CategoryPriority[];
  recommendations: Recommendation[];
  house: HouseFloor[];
  pilot: PilotWindow[];
}
