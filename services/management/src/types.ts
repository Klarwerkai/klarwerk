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
  // R-1657 (Nacharbeit 2): die gespeicherten Reasoner-Urteile dieser Sicht je Bereich.
  gapVerdicts?: ReadonlyMap<string, GapVerdictEntry> | null;
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

// R-1657 (ROADMAP 9.3): die Gründe, aus denen ein Bereich einen Wissens-Sprint braucht — offene
// Konflikte, fällige Re-Validierung, geringes Vertrauen, dünner validierter Bestand.
export type SprintReasonKey = "conflicts" | "revalidation" | "lowTrust" | "thinKnowledge";

export interface SprintReason {
  key: SprintReasonKey;
  count: number;
}

export interface KnowledgeSprint {
  category: string;
  reasons: SprintReason[]; // mindestens einer, in der Reihenfolge von SprintReasonKey
  workItems: number; // verschiedene Objekte mit Konflikt, Re-Validierung oder geringem Vertrauen
  days: number; // 1–5
  // Nacharbeit 2: wer den Vorschlag trägt — das Urteil des Reasoners über genau diese Kennzahlen
  // oder die benannte Regel (kein passendes Reasoner-Urteil).
  source: "reasoner" | "rule";
}

// Nacharbeit 2 (Ben: „über Reasoner"): die Kennzahlen EINES Bereichs, die an den Reasoner gehen —
// Name und Zähler, keine Inhalte. Feldgleich mit `LueckenBereich` in services/reasoner/src/types.ts;
// das Modul kennt den Reasoner nicht, die App verdrahtet beide (build-app.ts).
export interface GapSignal {
  bereich: string;
  objekte: number;
  validiert: number;
  mittleresVertrauen: number;
  imKonflikt: number | null;
  revalidierung: number;
  geringesVertrauen: number;
}

/** Das Reasoner-Urteil zu einem Bereich (feldgleich mit `LueckenBereichsUrteil`). */
export interface GapVerdict {
  bereich: string;
  sprint: boolean;
  tage: number;
  schwerpunkte: readonly SprintReasonKey[];
}

export interface GapJudgeOutcome {
  urteile: readonly GapVerdict[] | null;
  failure?: string | null;
  provider?: string | null;
}

/** Der Weg zum Reasoner. `confidential` = mindestens ein Bereich trägt ein vertrauliches Objekt. */
export type GapJudge = (
  bereiche: readonly GapSignal[],
  confidential: boolean,
) => Promise<GapJudgeOutcome>;

/** Ein gespeichertes Urteil: gilt nur, solange die Kennzahlen dieselben sind. */
export interface GapVerdictEntry {
  signatur: string;
  urteil: GapVerdict | null; // null = der Reasoner hat für diesen Bereich keinen Sprint genannt
}

/** Stand der regelmäßigen Reasoner-Analyse für DIESE Betrachtersicht. */
export interface SprintAnalysis {
  regular: boolean; // läuft die regelmäßige Analyse in diesem Prozess?
  intervalMs: number | null;
  analyzedAt: string | null; // letzter Lauf für diese Sicht; null = noch keiner
  provider: string | null; // wer geurteilt hat
  failure: string | null; // warum kein Reasoner-Urteil (no-model, confidential, model-error …)
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
  sprints: KnowledgeSprint[];
  sprintAnalysis: SprintAnalysis;
  house: HouseFloor[];
  pilot: PilotWindow[];
}
