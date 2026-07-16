import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type EmbeddingProvider, stubEmbeddingProvider } from "../../embedding";
import { ModelCapacityError } from "../../reasoner";
import {
  cappedEmbeddingProvider,
  embedCapConfigFromEnv,
  resetEmbedSemaphoreForTests,
} from "./embed-concurrency";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

describe("SCRUM-498 B2 (Fix): embedCapConfigFromEnv (env-tunable)", () => {
  it("Defaults 6/20/10000; env überschreibt; ungültig → Default", () => {
    expect(embedCapConfigFromEnv({})).toEqual({ max: 6, queueMax: 20, acquireTimeoutMs: 10_000 });
    expect(
      embedCapConfigFromEnv({
        KLARWERK_EMBED_MAX_INFLIGHT: "3",
        KLARWERK_EMBED_QUEUE_MAX: "5",
        KLARWERK_EMBED_ACQUIRE_TIMEOUT_MS: "200",
      }),
    ).toEqual({ max: 3, queueMax: 5, acquireTimeoutMs: 200 });
    expect(embedCapConfigFromEnv({ KLARWERK_EMBED_MAX_INFLIGHT: "0" }).max).toBe(6);
    expect(embedCapConfigFromEnv({ KLARWERK_EMBED_MAX_INFLIGHT: "abc" }).max).toBe(6);
  });
});

describe("SCRUM-498 B2 (Fix): cappedEmbeddingProvider", () => {
  beforeEach(() => {
    process.env.KLARWERK_EMBED_MAX_INFLIGHT = "2";
    resetEmbedSemaphoreForTests();
  });
  afterEach(() => {
    delete process.env.KLARWERK_EMBED_MAX_INFLIGHT;
    resetEmbedSemaphoreForTests();
  });

  // Fake mit steuerbarer Latenz (Gate), um die Gleichzeitigkeit zu beobachten.
  function gatedEmbedder(
    state: { now: number; max: number },
    gate: Promise<void>,
  ): EmbeddingProvider {
    return {
      name: "gated",
      embeddingVersion: "gated@3",
      dim: 3,
      isAvailable: () => true,
      embed: async (texts) => {
        state.now += 1;
        state.max = Math.max(state.max, state.now);
        await gate;
        state.now -= 1;
        return { vectors: texts.map(() => [1, 0, 0]), embeddingVersion: "gated@3", dim: 3 };
      },
    };
  }

  it("kappt die Gleichzeitigkeit von embed() auf N (hier 2)", async () => {
    const state = { now: 0, max: 0 };
    const gate = deferred<void>();
    const capped = cappedEmbeddingProvider(gatedEmbedder(state, gate.promise));
    const calls = Array.from({ length: 5 }, () => capped.embed(["x"]));
    await tick();
    expect(state.max).toBe(2); // nie mehr als N gleichzeitig im inneren Embedder
    gate.resolve();
    await Promise.all(calls);
    expect(state.now).toBe(0);
  });

  it("Warteschlange voll (Cap 2/Queue 1) → ModelCapacityError statt unbounded Warten", async () => {
    process.env.KLARWERK_EMBED_MAX_INFLIGHT = "2";
    process.env.KLARWERK_EMBED_QUEUE_MAX = "1";
    resetEmbedSemaphoreForTests();
    try {
      const state = { now: 0, max: 0 };
      const gate = deferred<void>();
      const capped = cappedEmbeddingProvider(gatedEmbedder(state, gate.promise));
      const a = capped.embed(["1"]); // aktiv
      const b = capped.embed(["2"]); // aktiv
      const c = capped.embed(["3"]); // wartet (Queue 1/1)
      await expect(capped.embed(["4"])).rejects.toBeInstanceOf(ModelCapacityError); // Queue voll
      gate.resolve();
      await Promise.all([a, b, c]);
    } finally {
      delete process.env.KLARWERK_EMBED_QUEUE_MAX;
      resetEmbedSemaphoreForTests();
    }
  });

  it("gibt den Slot im Fehlerfall frei (kein Leak): danach laufen wieder N gleichzeitig", async () => {
    const boom: EmbeddingProvider = {
      name: "boom",
      embeddingVersion: "boom@3",
      dim: 3,
      isAvailable: () => true,
      embed: async () => {
        throw new Error("Embedder kaputt");
      },
    };
    await expect(cappedEmbeddingProvider(boom).embed(["x"])).rejects.toThrow("Embedder kaputt");
    const state = { now: 0, max: 0 };
    const gate = deferred<void>();
    const capped = cappedEmbeddingProvider(gatedEmbedder(state, gate.promise));
    const calls = [capped.embed(["a"]), capped.embed(["b"])];
    await tick();
    expect(state.max).toBe(2); // beide Slots frei → kein Leak
    gate.resolve();
    await Promise.all(calls);
  });

  it("reicht name/embeddingVersion/dim/isAvailable + Vektoren unverändert durch (Stub bit-gleich)", async () => {
    const stub = stubEmbeddingProvider(256);
    const capped = cappedEmbeddingProvider(stub);
    expect(capped.name).toBe(stub.name);
    expect(capped.embeddingVersion).toBe(stub.embeddingVersion);
    expect(capped.dim).toBe(stub.dim);
    expect(capped.isAvailable()).toBe(true);
    const direct = await stub.embed(["Pumpe entlüften", "Ventil prüfen"]);
    const viaCapped = await capped.embed(["Pumpe entlüften", "Ventil prüfen"]);
    expect(viaCapped).toEqual(direct); // identische Vektoren + Version + dim
  });
});
