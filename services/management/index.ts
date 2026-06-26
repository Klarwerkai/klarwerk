// Öffentliche API des Moduls management (SCRUM-120 / FE-MGMT).
export { ManagementService } from "./src/service";
export type { ManagementDeps } from "./src/service";
export { computeSnapshot, bandForScore } from "./src/metrics";
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
  Recommendation,
  RecommendationSeverity,
  HouseFloor,
  PilotWindow,
  MetricsInput,
  BusFactorLike,
  Band,
} from "./src/types";
