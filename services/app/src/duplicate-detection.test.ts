import { coreText } from "../../conflicts";
import { InMemoryEmbeddingStore, stubEmbeddingProvider } from "../../embedding";
import type { KnowledgeObject } from "../../knowledge-object";
import { describe, expect, it, vi } from "vitest";
import {
  type DuplicateDetectionDeps,
  type SemanticPrefilter,
  detectDuplicatesForKo,
  indexKoForDuplicatePrefilter,
} from "./duplicate-detection";

// Minimaler KO nur mit den Feldern, die toDetectSubject/coreText lesen.
function makeKo(id: string, title: string, statement: string): KnowledgeObject {
  return {
    id,
    title,
    statement,
    conditions: [],
    measures: [],
    tags: [],
    demoSeed: false,
  } as unknown as KnowledgeObject;
}

function coreOf(ko: KnowledgeObject): string {
  return coreText({
    refId: ko.id,
    title: ko.title,
    statement: ko.statement,
    conditions: [],
    measures: [],
    tags: [],
  });
}

// Fake-Deps: erfasst den Pool, den detectForSubject bekommt. detectForSubject ruft den judge nie auf
// (gefaked), daher reichen schmale Stubs für ko/overlaps/reasoner/settings.
function makeDeps(
  subject: KnowledgeObject,
  candidates: KnowledgeObject[],
  semanticPrefilter?: SemanticPrefilter,
): { deps: DuplicateDetectionDeps; poolIds: () => string[]; detect: ReturnType<typeof vi.fn> } {
  let captured: string[] = [];
  const detect = vi.fn(
    async (_subject: unknown, pool: ReadonlyArray<{ refId: string }>): Promise<unknown[]> => {
      captured = pool.map((p) => p.refId);
      return [];
    },
  );
  const deps = {
    ko: {
      get: async (id: string) => (id === subject.id ? subject : undefined),
      list: async () => [subject, ...candidates],
    },
    overlaps: { detectForSubject: detect },
    reasoner: { judgeDuplicate: async () => null },
    settings: { get: async () => null },
    ...(semanticPrefilter ? { semanticPrefilter } : {}),
  } as unknown as DuplicateDetectionDeps;
  return { deps, poolIds: () => [...captured].sort(), detect };
}

const subject = makeKo("s", "dach reparatur", "ziegel dichtung abdichtung wetter");
const near1 = makeKo("c1", "dach reparatur", "ziegel dichtung undicht");
const near2 = makeKo("c2", "dach reparatur", "ziegel abdichtung wetter");
const far1 = makeKo("c3", "steuererklärung", "finanzamt frist formular");
const far2 = makeKo("c4", "urlaub reise", "koffer flug hotel");
const far3 = makeKo("c5", "auto werkstatt", "motor reifen öl");
const candidates = [near1, near2, far1, far2, far3];

describe("detectDuplicatesForKo — Pool-Auswahl (B4)", () => {
  it("Flag AUS (kein Prefilter): voller Pool „jeder gegen jeden“", async () => {
    const { deps, poolIds, detect } = makeDeps(subject, candidates);
    await detectDuplicatesForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(poolIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("Flag AN + befüllter Store: nur die semantischen Top-K", async () => {
    const embedder = stubEmbeddingProvider(256);
    const store = new InMemoryEmbeddingStore();
    for (const ko of candidates) {
      const { vectors, embeddingVersion } = await embedder.embed([coreOf(ko)]);
      await store.upsert(ko.id, vectors[0]!, embeddingVersion);
    }
    const { deps, poolIds } = makeDeps(subject, candidates, { embedder, store, topK: 2 });
    await detectDuplicatesForKo("s", deps);
    // Die zwei nächsten (gemeinsamer Wortschatz) sind c1/c2, nicht die fremden Themen.
    expect(poolIds()).toEqual(["c1", "c2"]);
  });

  it("Flag AN + leerer Store: Voll-Pool-Fallback (Prefilter noch nicht real wirksam)", async () => {
    const { deps, poolIds } = makeDeps(subject, candidates, {
      embedder: stubEmbeddingProvider(256),
      store: new InMemoryEmbeddingStore(),
      topK: 2,
    });
    await detectDuplicatesForKo("s", deps);
    expect(poolIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("Flag AN + Embedding-Fehler: Voll-Pool-Fallback (best-effort bleibt vollständig)", async () => {
    const brokenEmbedder = {
      name: "boom",
      embeddingVersion: "boom@1",
      dim: 1,
      isAvailable: () => true,
      embed: async () => {
        throw new Error("kaputt");
      },
    };
    const { deps, poolIds, detect } = makeDeps(subject, candidates, {
      embedder: brokenEmbedder,
      store: new InMemoryEmbeddingStore(),
      topK: 2,
    });
    await detectDuplicatesForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(poolIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });
});

describe("indexKoForDuplicatePrefilter — Store-Befüllung (B6)", () => {
  it("nach Ablage findet ein späteres KO das frühere ÜBER DEN STORE (nicht Voll-Pool)", async () => {
    const embedder = stubEmbeddingProvider(256);
    const store = new InMemoryEmbeddingStore();
    const prefilter: SemanticPrefilter = { embedder, store, topK: 5 };
    // B6: near1 wird eingebettet + abgelegt (so wie es der Einreiche-Handler nach dem 201 täte).
    await indexKoForDuplicatePrefilter(near1, prefilter);
    // decoy ist im Bestand (ko.list), aber NICHT im Store — z. B. angelegt, als das Flag noch aus war.
    const decoy = makeKo("decoy", "steuererklärung", "finanzamt frist formular");
    const { deps, poolIds } = makeDeps(subject, [near1, decoy], prefilter);
    await detectDuplicatesForKo("s", deps);
    // Nur near1 (über den Store gefunden). decoy fehlt → es war NICHT der Voll-Pool-Fallback.
    expect(poolIds()).toEqual(["c1"]);
  });

  it("Flag aus (kein Prefilter) → No-op, kein upsert", async () => {
    const store = new InMemoryEmbeddingStore();
    await expect(indexKoForDuplicatePrefilter(near1, undefined)).resolves.toBeUndefined();
    // Store nie berührt.
    expect(await store.nearest([1, 0, 0, 0], "stub@256", 5)).toEqual([]);
  });

  it("demoSeed-KO wird nicht abgelegt", async () => {
    const store = new InMemoryEmbeddingStore();
    const demo = { ...makeKo("demo", "titel", "text") } as unknown as KnowledgeObject;
    (demo as { demoSeed: boolean }).demoSeed = true;
    await indexKoForDuplicatePrefilter(demo, { embedder: stubEmbeddingProvider(256), store, topK: 5 });
    expect(await store.nearest([1, 0, 0, 0], "stub@256", 5)).toEqual([]);
  });

  it("Embed-Fehler wird geloggt + geschluckt (kein Throw), Store bleibt leer", async () => {
    const store = new InMemoryEmbeddingStore();
    const brokenEmbedder = {
      name: "boom",
      embeddingVersion: "boom@1",
      dim: 1,
      isAvailable: () => true,
      embed: async () => {
        throw new Error("kaputt");
      },
    };
    const logs: string[] = [];
    await expect(
      indexKoForDuplicatePrefilter(near1, { embedder: brokenEmbedder, store, topK: 5 }, (msg) =>
        logs.push(msg),
      ),
    ).resolves.toBeUndefined();
    expect(logs).toHaveLength(1);
    expect(await store.nearest([1], "boom@1", 5)).toEqual([]);
  });
});
