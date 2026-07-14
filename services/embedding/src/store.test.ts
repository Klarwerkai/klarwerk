import { describe, expect, it } from "vitest";
import { InMemoryEmbeddingStore } from "./store";

const V = "stub@4";

// Kleine, handgesetzte Vektoren (nicht normiert) — der Store normiert für Cosine selbst.
async function seed(store: InMemoryEmbeddingStore): Promise<void> {
  await store.upsert("gleich", [1, 0, 0, 0], V);
  await store.upsert("nah", [0.9, 0.1, 0, 0], V);
  await store.upsert("fern", [0, 0, 1, 0], V);
  await store.upsert("gegen", [-1, 0, 0, 0], V);
}

describe("InMemoryEmbeddingStore (B3)", () => {
  it("nearest liefert Nachbarn nach Cosine absteigend sortiert", async () => {
    const store = new InMemoryEmbeddingStore();
    await seed(store);
    const hits = await store.nearest([1, 0, 0, 0], V, 4);
    expect(hits.map((h) => h.id)).toEqual(["gleich", "nah", "fern", "gegen"]);
    expect(hits[0]!.score).toBeCloseTo(1, 6);
    expect(hits[3]!.score).toBeCloseTo(-1, 6);
  });

  it("topK schneidet auf die K besten ab", async () => {
    const store = new InMemoryEmbeddingStore();
    await seed(store);
    const hits = await store.nearest([1, 0, 0, 0], V, 2);
    expect(hits.map((h) => h.id)).toEqual(["gleich", "nah"]);
  });

  it("excludeId wird nie zurückgegeben", async () => {
    const store = new InMemoryEmbeddingStore();
    await seed(store);
    const hits = await store.nearest([1, 0, 0, 0], V, 4, "gleich");
    expect(hits.map((h) => h.id)).not.toContain("gleich");
    expect(hits[0]!.id).toBe("nah");
  });

  it("nearest gegen eine im Store nicht vorhandene Version → leer (harter Versions-Filter)", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("aktiv", [1, 0, 0, 0], V);
    // Anfrage mit fremder Version: der Store hält nur V-Vektoren → nie gemischt.
    expect(await store.nearest([1, 0, 0, 0], "stub@8", 10)).toEqual([]);
    expect((await store.nearest([1, 0, 0, 0], V, 10)).map((h) => h.id)).toEqual(["aktiv"]);
  });

  it("Nullvektor als Anfrage oder Ziel → score 0 (keine Division durch 0)", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("null", [0, 0, 0, 0], V);
    await store.upsert("eins", [1, 0, 0, 0], V);
    const hitsFromZeroQuery = await store.nearest([0, 0, 0, 0], V, 10);
    for (const h of hitsFromZeroQuery) {
      expect(h.score).toBe(0);
    }
    const hits = await store.nearest([1, 0, 0, 0], V, 10);
    expect(hits.find((h) => h.id === "null")!.score).toBe(0);
  });

  it("upsert überschreibt denselben id-Eintrag", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("x", [1, 0, 0, 0], V);
    await store.upsert("x", [0, 1, 0, 0], V);
    const hits = await store.nearest([0, 1, 0, 0], V, 1);
    expect(hits[0]!.id).toBe("x");
    expect(hits[0]!.score).toBeCloseTo(1, 6);
  });

  it("topK <= 0 liefert leere Liste", async () => {
    const store = new InMemoryEmbeddingStore();
    await seed(store);
    expect(await store.nearest([1, 0, 0, 0], V, 0)).toEqual([]);
  });

  it("Gleichstand im Score → deterministische Ordnung (id aufsteigend)", async () => {
    const store = new InMemoryEmbeddingStore();
    await store.upsert("b", [1, 0, 0, 0], V);
    await store.upsert("a", [1, 0, 0, 0], V);
    const hits = await store.nearest([1, 0, 0, 0], V, 2);
    expect(hits.map((h) => h.id)).toEqual(["a", "b"]);
  });
});
