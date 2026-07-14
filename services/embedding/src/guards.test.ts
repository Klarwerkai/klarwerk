import { describe, expect, it } from "vitest";
import { stubEmbeddingProvider } from "./provider";
import { InMemoryEmbeddingStore } from "./store";

const V = "stub@4";

// B5: Homogenitäts-Guards. Ein Store hält genau eine embeddingVersion/Dimension; jede Abweichung
// wirft, statt inkompatible Vektoren still zu vermischen (GEHIRN §9.1). Der Versions-Filter in
// nearest (B3) ist die zweite Sicherung; upsert ist die erste.
describe("InMemoryEmbeddingStore — Guards (B5)", () => {
  it("erste Ablage legt aktive Version + Dimension fest, gleichartige folgen problemlos", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("a", [1, 0, 0, 0], V);
    await expect(store.upsert("b", [0, 1, 0, 0], V)).resolves.toBeUndefined();
  });

  it("upsert mit fremder embeddingVersion wirft (kein Mischen)", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("a", [1, 0, 0, 0], V);
    await expect(store.upsert("x", [1, 0, 0, 0], "stub@8")).rejects.toThrow(/embeddingVersion/);
  });

  it("upsert mit abweichender Dimension wirft", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("a", [1, 0, 0, 0], V);
    await expect(store.upsert("x", [1, 0, 0], V)).rejects.toThrow(/Dimension/);
  });

  it("upsert eines leeren Vektors als erste Ablage wirft", async () => {
    const store = new InMemoryEmbeddingStore();
    await expect(store.upsert("a", [], V)).rejects.toThrow();
  });

  it("überschreiben desselben id-Eintrags mit passender Version/dim bleibt erlaubt", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("a", [1, 0, 0, 0], V);
    await expect(store.upsert("a", [0, 0, 0, 1], V)).resolves.toBeUndefined();
  });
});

describe("EmbeddingProvider — dim-Guard in embed (B5)", () => {
  it("Stub liefert konsistent Vektoren der Länge dim (Guard greift nie fälschlich)", async () => {
    const p = stubEmbeddingProvider(64);
    const res = await p.embed(["a", "bb", "ccc"]);
    expect(res.dim).toBe(64);
    for (const v of res.vectors) {
      expect(v).toHaveLength(64);
    }
  });
});
