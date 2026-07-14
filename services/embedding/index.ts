// Öffentliche API des Moduls embedding. Cross-Modul-Import nur hierüber (Arch-Regel module-boundaries).
export type { EmbeddingProvider, EmbeddingResult } from "./src/provider";
export {
  stubEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  STUB_DEFAULT_DIM,
} from "./src/provider";
export { InMemoryEmbeddingStore } from "./src/store";
export type { EmbeddingStore, NearestHit } from "./src/store";
