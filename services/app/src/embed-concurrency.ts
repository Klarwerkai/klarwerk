// SCRUM-498 B2 (Fix): der Semantic-Prefilter ruft embed() DIREKT — ohne diesen Wrapper umginge er den
// generativen Modell-Cap vollständig (Embedding-Bypass). Analog cappedModelClient (reasoner) kappt
// cappedEmbeddingProvider JEDEN embed()-Aufruf über EINEN prozess-globalen Semaphore. Bewusst SEPARAT
// vom Modell-Cap: Embedding trifft ein anderes Backend/eine andere Rate als die generativen LLM-Calls,
// getrennte Obergrenzen sind ehrlicher und unabhängig tunebar. Backpressure ist DERSELBE
// ModelCapacityError (damit der Prefilter-Guard und der globale 503-Handler ihn unverändert erkennen).
// Bei Normallast (< N gleichzeitig) ein NO-OP ohne Delay; mit dem heutigen deterministischen Stub-
// Embedder (schnell, immer verfügbar) ohnehin ein No-Op → Stufe 1/2-Verhalten bit-gleich.
//
// Die generische Semaphore-Klasse + der Fehlertyp stammen aus dem Reasoner (app als Composition-Root
// darf beide Module verdrahten); das Embedding-Modul selbst bleibt rein (kennt weder reasoner noch app).

import type { EmbeddingProvider } from "../../embedding";
import { type ModelCapConfig, ModelSemaphore } from "../../reasoner";

const DEFAULT_MAX = 6;
const DEFAULT_QUEUE_MAX = 20;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000;

function posInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// env-tunable: KLARWERK_EMBED_MAX_INFLIGHT / _QUEUE_MAX / _ACQUIRE_TIMEOUT_MS. Ungültig/fehlend → Default.
export function embedCapConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelCapConfig {
  return {
    max: posInt(env.KLARWERK_EMBED_MAX_INFLIGHT, DEFAULT_MAX),
    queueMax: posInt(env.KLARWERK_EMBED_QUEUE_MAX, DEFAULT_QUEUE_MAX),
    acquireTimeoutMs: posInt(env.KLARWERK_EMBED_ACQUIRE_TIMEOUT_MS, DEFAULT_ACQUIRE_TIMEOUT_MS),
  };
}

let singleton: ModelSemaphore | undefined;

function semaphore(): ModelSemaphore {
  if (!singleton) {
    singleton = new ModelSemaphore(embedCapConfigFromEnv());
  }
  return singleton;
}

// Nur für Tests: erzwingt Neu-Einlesen der Env beim nächsten Zugriff.
export function resetEmbedSemaphoreForTests(): void {
  singleton = undefined;
}

// Führt fn genau dann aus, wenn ein Slot frei ist; gibt ihn IMMER frei (auch im Fehlerfall → finally).
async function withEmbedSlot<T>(fn: () => Promise<T>): Promise<T> {
  const release = await semaphore().acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

// Umschließt einen EmbeddingProvider, sodass JEDER embed()-Aufruf durch den Embed-Semaphore geht.
// name/embeddingVersion/dim/isAvailable werden unverändert durchgereicht (bit-gleiche Ausgabe); nur der
// embed()-Aufruf ist gedeckelt. Läuft die Warteschlange über oder der Acquire in den Timeout, wirft der
// Semaphore ModelCapacityError (Backpressure) — der Prefilter reicht ihn durch (nicht schlucken).
export function cappedEmbeddingProvider(inner: EmbeddingProvider): EmbeddingProvider {
  return {
    name: inner.name,
    embeddingVersion: inner.embeddingVersion,
    dim: inner.dim,
    isAvailable: () => inner.isAvailable(),
    embed: (texts) => withEmbedSlot(() => inner.embed(texts)),
  };
}
