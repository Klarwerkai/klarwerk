import { describe, expect, it } from "vitest";
import {
  STUB_DEFAULT_DIM,
  createEmbeddingProviderFromEnv,
  stubEmbeddingProvider,
} from "./provider";

function l2(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot; // beide L2-normiert → Skalarprodukt = Cosine
}

describe("stubEmbeddingProvider (B2)", () => {
  it("meldet name, embeddingVersion=stub@<dim>, dim und isAvailable=true", () => {
    const p = stubEmbeddingProvider(32);
    expect(p.name).toBe("stub");
    expect(p.embeddingVersion).toBe("stub@32");
    expect(p.dim).toBe(32);
    expect(p.isAvailable()).toBe(true);
  });

  it("ist deterministisch: gleicher Text → identischer Vektor", async () => {
    const p = stubEmbeddingProvider(64);
    const a = (await p.embed(["Dachrinne reinigen im Herbst"])).vectors[0]!;
    const b = (await p.embed(["Dachrinne reinigen im Herbst"])).vectors[0]!;
    expect(b).toEqual(a);
  });

  it("liefert je Text einen Vektor der Länge dim, L2-normiert (≈1)", async () => {
    const p = stubEmbeddingProvider(128);
    const res = await p.embed(["erster text", "zweiter ganz anderer inhalt"]);
    expect(res.vectors).toHaveLength(2);
    expect(res.dim).toBe(128);
    for (const v of res.vectors) {
      expect(v).toHaveLength(128);
      expect(l2(v)).toBeCloseTo(1, 6);
    }
  });

  it("ähnlicher Wortschatz → höhere Cosine-Nähe als völlig verschiedener", async () => {
    const p = stubEmbeddingProvider(256);
    const { vectors } = await p.embed([
      "dach reparatur ziegel dichtung",
      "dach reparatur ziegel abdichtung dachziegel",
      "steuererklärung frist finanzamt formular",
    ]);
    const [base, ähnlich, fremd] = vectors as [number[], number[], number[]];
    expect(cosine(base, ähnlich)).toBeGreaterThan(cosine(base, fremd));
  });

  it("leerer/tokenloser Text → definierter Nullvektor der Länge dim", async () => {
    const p = stubEmbeddingProvider(16);
    const { vectors } = await p.embed(["", "   ---  "]);
    for (const v of vectors) {
      expect(v).toHaveLength(16);
      expect(l2(v)).toBe(0);
    }
  });

  it("wirft bei ungültiger Dimension", () => {
    expect(() => stubEmbeddingProvider(0)).toThrow();
    expect(() => stubEmbeddingProvider(2.5)).toThrow();
  });
});

describe("createEmbeddingProviderFromEnv (B2)", () => {
  it("Default (keine Env) → Stub mit STUB_DEFAULT_DIM", () => {
    const p = createEmbeddingProviderFromEnv({});
    expect(p?.name).toBe("stub");
    expect(p?.dim).toBe(STUB_DEFAULT_DIM);
  });

  it("stub-Modus respektiert KLARWERK_EMBEDDING_DIM", () => {
    const p = createEmbeddingProviderFromEnv({
      KLARWERK_EMBEDDING_PROVIDER: "stub",
      KLARWERK_EMBEDDING_DIM: "42",
    });
    expect(p?.dim).toBe(42);
  });

  it("cloud/local noch nicht verdrahtet → ehrlich undefined (kein Fake)", () => {
    expect(
      createEmbeddingProviderFromEnv({ KLARWERK_EMBEDDING_PROVIDER: "cloud" }),
    ).toBeUndefined();
    expect(
      createEmbeddingProviderFromEnv({ KLARWERK_EMBEDDING_PROVIDER: "local" }),
    ).toBeUndefined();
  });
});
