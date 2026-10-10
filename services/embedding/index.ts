// Öffentliche API des Moduls embedding. Cross-Modul-Import nur hierüber (Arch-Regel module-boundaries).
export type { EmbeddingProvider, EmbeddingResult } from "./src/provider";
export {
  stubEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  STUB_DEFAULT_DIM,
} from "./src/provider";
export { InMemoryEmbeddingStore } from "./src/store";
export type { EmbeddingStore, NearestHit } from "./src/store";
// R-0470: der dauerhafte Vektorspeicher für den Postgres-Betrieb und seine Tabelle.
export { EMBEDDING_SCHEMA, PgEmbeddingStore } from "./src/store-pg";
