// SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Kennzahlen. Stateless, keine Persistenz.
// Alle Zahlen aus echten Bestandsdaten — keine Demo-/Beispielwerte, keine Bilanzbewertung.
import type { KnowledgeObject } from "../../knowledge-object";
import type { CategoryProfile } from "./profiles";

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
  // R-0751 / FR-EXT-04 (Nacharbeit 1): die Kennungen der SICHTBAREN Objekte, die an einem offenen
  // Konflikt beteiligt sind (Paar-Regel wie /api/conflicts). Fehlt die Angabe, hat der Faktor
  // „Konfliktdichte" keine Eingangsdaten — er wird dann nicht geschätzt.
  openConflictKoIds?: readonly string[] | null;
  // R-0751 (Nacharbeit 3): gepflegte Bereichsprofile (profiles.ts) — die Eingänge der Faktoren
  // Kritikalität, Prozessnähe, Wiederholhäufigkeit, Schadenspotenzial. Ohne Profil oder ohne Stufe
  // bleibt der jeweilige Faktor „keine Eingangsdaten".
  categoryProfiles?: readonly CategoryProfile[] | null;
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

// R-0751 / FR-EXT-04 (Nacharbeit 1): die NEUN FAKTOREN DER QUELLE, in ihrer Reihenfolge — Bus-Faktor,
// Kritikalität, Prozessnähe, Alter, Quellenqualität, Konfliktdichte, Wiederholhäufigkeit,
// Schadenspotenzial, Schutzwert (IP-Wert). Keiner wird durch einen andersartigen ersetzt. Die
// Reihenfolge hält `PRIORITY_FACTOR_KEYS` in metrics.ts.
export type PriorityFactorKey =
  | "busFactor"
  | "criticality"
  | "processProximity"
  | "age"
  | "sourceQuality"
  | "conflictDensity"
  | "repetition"
  | "damagePotential"
  | "protection";

export interface PriorityFactor {
  key: PriorityFactorKey;
  // 0–100 (höher = dringender). `null` = für diesen Faktor gibt es im Bestand KEINE Eingangsdaten:
  // er zählt nicht in den Score und wird nicht geschätzt.
  value: number | null;
}

// Die Filter der Quelle: alles · Bus-Faktor eins · Veraltetes · hoher Schutzwert.
export type PriorityFlag = "busFactorOne" | "stale" | "highProtection";

export interface CategoryPriority {
  category: string;
  score: number; // 0–100, Mittel der Faktoren MIT Eingangsdaten
  knownFactors: number; // wie viele der neun Faktoren Eingangsdaten haben
  factors: PriorityFactor[]; // immer alle neun, in der Reihenfolge der Quelle
  flags: PriorityFlag[];
}

export type RecommendationSeverity = "hoch" | "mittel";

export interface Recommendation {
  key: string;
  severity: RecommendationSeverity;
  count: number;
}

// R-0768 / FR-EXT-05 (FE-MGMT-08): ein Stockwerk je FACHGEBIET (`KnowledgeObject.domain`), nicht je
// Kategorie. `domain: null` sammelt die Objekte ohne angegebenes Fachgebiet — es wird nicht aus der
// Kategorie abgeleitet (dieselbe Regel wie am Feld selbst).
export interface HouseFloor {
  domain: string | null;
  koCount: number;
  validated: number;
  validatedRatio: number; // % = Füllgrad (Anteil gesicherten, d. h. validierten Wissens)
  authorCount: number;
  singleSource: boolean; // nur ein Urheber (dieselbe Regel wie der Bus-Faktor)
  fragile: boolean; // Füllgrad < 50 % oder nur ein Urheber
  imported: number;
}

// R-0768 / FR-EXT-05: die Kennzahlen des Durchlaufs Import → Haus → Ausgabe.
export interface HouseFlow {
  imported: number; // über einen Importweg entstanden (importedVia / origin „import")
  importedValidated: number; // davon validiert
  inHouse: number; // Bestand im Haus
  secured: number; // davon validiert = gesichert
  floors: number;
  fragileFloors: number;
  // Validierte Objekte sind die zulässige Output-Quelle (services/output). Gezählt wird die
  // AUSGABEFÄHIGKEIT; erzeugte Ausgaben legt der Output-Dienst nicht ab.
  outputReady: number;
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
  houseFlow: HouseFlow;
  pilot: PilotWindow[];
}
