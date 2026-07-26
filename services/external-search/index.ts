// Öffentliche API des Moduls external-search (SCRUM-118 / FR-EXT-02).
export {
  ExternalSearchService,
  createExternalSearchFromEnv,
} from "./src/service";
export type { ExternalSearchDeps } from "./src/service";
export { createWikipediaProvider, stripHtml, articleUrl } from "./src/wikipedia";
export { ExternalSearchError } from "./src/types";
export type { ExternalResult, SearchProvider, FetchLike } from "./src/types";
// SCRUM-414: Admin-Regler „externe Wissensabfrage" (4 Stufen, persistiert).
export {
  type ExternalKnowledgeStage,
  type ExternalKnowledgePolicyRepo,
  EXTERNAL_KNOWLEDGE_STAGES,
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  normalizeExternalKnowledgeStage,
  externalSearchAllowed,
  externalAttachAllowed,
  publicAiEnrichmentAllowed,
  InMemoryExternalKnowledgePolicyRepo,
  PgExternalKnowledgePolicyRepo,
  EXTERNAL_KNOWLEDGE_SCHEMA,
} from "./src/policy";
// AUFTRAG-mega15 Block B (bens SB-4): die serverseitige Herkunftsableitung. Sie ersetzt das vom
// Client gelieferte `provider`-Feld als Entscheidungsgrundlage der Stufen-Sperre.
export {
  type ExternalProviderOrigin,
  EXTERNAL_PROVIDER_ORIGINS,
  attributeExternalSource,
} from "./src/provenance";
// AUFTRAG-mega16 Block A (bens SB-4, dritter Durchgang): die Stufe als fail-closed Grenze. Nicht
// mehr „erkannter Provider → pruefen", sondern „oeffentlich → verboten, ausser die Stufe erlaubt es".
export {
  type SourceReach,
  type AttachDenial,
  type AttachRequestFacts,
  type AttachDecision,
  parseInternalSourceOrigins,
  classifySourceReach,
  decideExternalAttach,
} from "./src/attach-policy";
