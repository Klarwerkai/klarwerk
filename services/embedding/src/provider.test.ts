import { describe, expect, it } from "vitest";
import type { EmbeddingProvider, EmbeddingResult } from "./provider";

// B1: Der Vertrag des Interface. Analog zum handgerollten fakeClient in
// services/reasoner/src/provider-model.test.ts:25 belegen wir die Form mit einer Minimal-Implementierung.
function fakeProvider(dim: number): EmbeddingProvider {
  return {
    name: "fake",
    embeddingVersion: `fake@${dim}`,
    dim,
    isAvailable: () => true,
    embed: async (texts) => ({
      vectors: texts.map(() => new Array<number>(dim).fill(0)),
      embeddingVersion: `fake@${dim}`,
      dim,
    }),
  };
}

describe("EmbeddingProvider (Vertrag)", () => {
  it("trägt name, embeddingVersion und dim als lesbare Felder", () => {
    const p = fakeProvider(8);
    expect(p.name).toBe("fake");
    expect(p.embeddingVersion).toBe("fake@8");
    expect(p.dim).toBe(8);
    expect(p.isAvailable()).toBe(true);
  });

  it("embed liefert je Text einen Vektor der Länge dim samt Version", async () => {
    const p = fakeProvider(8);
    const res: EmbeddingResult = await p.embed(["a", "b", "c"]);
    expect(res.vectors).toHaveLength(3);
    expect(res.dim).toBe(8);
    expect(res.embeddingVersion).toBe("fake@8");
    for (const v of res.vectors) {
      expect(v).toHaveLength(8);
    }
  });
});
