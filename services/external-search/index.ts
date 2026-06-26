// Öffentliche API des Moduls external-search (SCRUM-118 / FR-EXT-02).
export {
  ExternalSearchService,
  createExternalSearchFromEnv,
} from "./src/service";
export type { ExternalSearchDeps } from "./src/service";
export { createWikipediaProvider, stripHtml, articleUrl } from "./src/wikipedia";
export { ExternalSearchError } from "./src/types";
export type { ExternalResult, SearchProvider, FetchLike } from "./src/types";
