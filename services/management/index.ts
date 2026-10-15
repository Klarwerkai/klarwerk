// Öffentliche API des Moduls management (SCRUM-120 / FE-MGMT).
export { ManagementService, MAX_SICHTEN, WISSENSSPRINT_TAKT_MS } from "./src/service";
export type {
  LagebildBereichRecht,
  LagebildBereichSicht,
  LagebildSpeicherErgebnis,
  ManagementDeps,
} from "./src/service";
// produkt:20261013:lagebild-reale-werte-eingabe: reale Eingangswerte der Wissensbewertung je Bereich.
export {
  LAGEBILD_FELDER,
  LAGEBILD_GESAMT,
  LAGEBILD_WERTE_SCHEMA,
  LagebildKonflikt,
  LagebildWerteFehler,
  normalizeLagebildEingabe,
} from "./src/lagebild-werte";
export type {
  LagebildFeld,
  LagebildHerkunft,
  LagebildWert,
  LagebildWerte,
  LagebildWerteRepo,
} from "./src/lagebild-werte";
export { computeSnapshot, bandForScore } from "./src/metrics";
// R-0751 / R-1639 / R-2183 (Nacharbeit 3): gepflegte Bereichsprofile und Ruhestandshorizonte.
export {
  ASSESSMENT_LEVELS,
  InMemoryManagementProfileRepo,
  MANAGEMENT_PROFILE_SCHEMA,
  ManagementProfileError,
  PgManagementProfileRepo,
  RETIREMENT_HORIZONS,
  normalizeCategoryProfile,
  normalizeRetirementHorizon,
  retirementDueAt,
} from "./src/profiles";
export type {
  AssessmentLevel,
  CategoryProfile,
  ManagementProfileRepo,
  RetirementEntry,
  RetirementHorizon,
} from "./src/profiles";
export { riskHorizon } from "./src/horizon";
export type { RiskHorizonArea, RiskHorizonBearer, RiskHorizonView } from "./src/horizon";
export type {
  ManagementSnapshot,
  Overview,
  CapitalScore,
  ScorePart,
  ValuationFacts,
  KnowledgeStatement,
  RiskBreakdown,
  Maturity,
  CategoryPriority,
  PriorityFactor,
  PriorityFactorKey,
  PriorityFlag,
  Recommendation,
  RecommendationSeverity,
  KnowledgeSprint,
  SprintReason,
  SprintReasonKey,
  SprintAnalysis,
  GapSignal,
  GapVerdict,
  GapJudge,
  GapJudgeOutcome,
  HouseFloor,
  HouseFlow,
  PilotWindow,
  MetricsInput,
  BusFactorLike,
  Band,
} from "./src/types";
