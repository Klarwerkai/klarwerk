import { describe, expect, it, vi } from "vitest";
import { coreText } from "../../conflicts";
import { InMemoryEmbeddingStore, stubEmbeddingProvider } from "../../embedding";
import type { KnowledgeObject } from "../../knowledge-object";
import { detectConflictsForKo } from "./conflict-detection";
import {
  type DuplicateDetectionDeps,
  type SemanticPrefilter,
  detectDuplicatesForKo,
  indexKoForDuplicatePrefilter,
  removeKoFromDuplicatePrefilter,
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
): {
  deps: DuplicateDetectionDeps;
  poolIds: () => string[];
  confidentialPoolIds: () => string[];
  detect: ReturnType<typeof vi.fn>;
} {
  let captured: string[] = [];
  let capturedConfidential: string[] = [];
  const detect = vi.fn(
    async (
      _subject: unknown,
      pool: ReadonlyArray<{ refId: string; confidential?: boolean }>,
    ): Promise<unknown[]> => {
      captured = pool.map((p) => p.refId);
      capturedConfidential = pool.filter((p) => p.confidential).map((p) => p.refId);
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
  return {
    deps,
    poolIds: () => [...captured].sort(),
    confidentialPoolIds: () => [...capturedConfidential].sort(),
    detect,
  };
}

const subject = makeKo("s", "dach reparatur", "ziegel dichtung abdichtung wetter");
const near1 = makeKo("c1", "dach reparatur", "ziegel dichtung undicht");
const near2 = makeKo("c2", "dach reparatur", "ziegel abdichtung wetter");
const far1 = makeKo("c3", "steuererklärung", "finanzamt frist formular");
const far2 = makeKo("c4", "urlaub reise", "koffer flug hotel");
const far3 = makeKo("c5", "auto werkstatt", "motor reifen öl");
const candidates = [near1, near2, far1, far2, far3];

// D-AISTATE PAKET 2.2 (bens V3): der semantische Prefilter darf den Pool NIE VERENGEN — die
// deterministische Deckungsprüfung läuft IMMER über den Voll-Pool (der Prefilter dient nur noch der
// Indizierung, nicht der Pool-Wahl). Früher (patches91) verengte ein befüllter Store auf die Top-K.
describe("detectDuplicatesForKo — Voll-Pool immer (bens V2.2)", () => {
  it("kein Prefilter: voller Pool „jeder gegen jeden“", async () => {
    const { deps, poolIds, detect } = makeDeps(subject, candidates);
    await detectDuplicatesForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(poolIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("Prefilter befüllt: die deterministische Ebene sieht WEITERHIN den Voll-Pool (keine Top-K-Verengung)", async () => {
    const embedder = stubEmbeddingProvider(256);
    const store = new InMemoryEmbeddingStore();
    for (const ko of candidates) {
      const { vectors, embeddingVersion } = await embedder.embed([coreOf(ko)]);
      await store.upsert(ko.id, vectors[0]!, embeddingVersion);
    }
    const { deps, poolIds, detect } = makeDeps(subject, candidates, { embedder, store, topK: 2 });
    await detectDuplicatesForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    // Trotz Store mit topK:2 bekommt die Erkennung alle fünf — kein still verworfener Kandidat.
    expect(poolIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });
});

describe("indexKoForDuplicatePrefilter — Store-Befüllung (B6)", () => {
  it("legt das eingebettete KO im Store ab (auffindbar über nearest)", async () => {
    const embedder = stubEmbeddingProvider(256);
    const store = new InMemoryEmbeddingStore();
    const prefilter: SemanticPrefilter = { embedder, store, topK: 5 };
    // B6: near1 wird eingebettet + abgelegt (so wie es der Einreiche-Handler nach dem 201 täte).
    await indexKoForDuplicatePrefilter(near1, prefilter);
    const { vectors, embeddingVersion } = await embedder.embed([coreOf(near1)]);
    expect((await store.nearest(vectors[0]!, embeddingVersion, 5)).some((h) => h.id === "c1")).toBe(
      true,
    );
  });

  it("D-AISTATE V2.2: der Prefilter VERENGT die Erkennung NICHT mehr — Voll-Pool trotz befülltem Store", async () => {
    const embedder = stubEmbeddingProvider(256);
    const store = new InMemoryEmbeddingStore();
    const prefilter: SemanticPrefilter = { embedder, store, topK: 5 };
    await indexKoForDuplicatePrefilter(near1, prefilter);
    // decoy ist im Bestand (ko.list), aber NICHT im Store — früher hätte der Prefilter ihn verworfen.
    const decoy = makeKo("decoy", "steuererklärung", "finanzamt frist formular");
    const { deps, poolIds } = makeDeps(subject, [near1, decoy], prefilter);
    await detectDuplicatesForKo("s", deps);
    // Jetzt sieht die deterministische Ebene BEIDE — kein still verworfener Kandidat.
    expect(poolIds()).toEqual(["c1", "decoy"]);
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
    await indexKoForDuplicatePrefilter(demo, {
      embedder: stubEmbeddingProvider(256),
      store,
      topK: 5,
    });
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

// GDPR Art. 17 (Kaskadenlöschung): removeKoFromDuplicatePrefilter am harten Delete-Pfad.
describe("removeKoFromDuplicatePrefilter (GDPR-Kaskadenlöschung)", () => {
  it("löscht den abgelegten Vektor aus dem Store", async () => {
    const store = new InMemoryEmbeddingStore();
    const embedder = stubEmbeddingProvider(256);
    const prefilter: SemanticPrefilter = { embedder, store, topK: 5 };
    await indexKoForDuplicatePrefilter(makeKo("k1", "Pumpe", "entlüften nach Anfahren"), prefilter);
    const { vectors, embeddingVersion } = await embedder.embed(["irgendwas"]);
    // Vor dem Löschen ist k1 auffindbar, danach nicht mehr.
    expect((await store.nearest(vectors[0]!, embeddingVersion, 5)).some((h) => h.id === "k1")).toBe(
      true,
    );
    await removeKoFromDuplicatePrefilter("k1", prefilter);
    expect((await store.nearest(vectors[0]!, embeddingVersion, 5)).some((h) => h.id === "k1")).toBe(
      false,
    );
  });

  it("Flag aus (kein Prefilter) → No-op, kein Fehler", async () => {
    await expect(removeKoFromDuplicatePrefilter("k1", undefined)).resolves.toBeUndefined();
  });

  it("unbekannte id (kein Eintrag) → No-op", async () => {
    const prefilter: SemanticPrefilter = {
      embedder: stubEmbeddingProvider(256),
      store: new InMemoryEmbeddingStore(),
      topK: 5,
    };
    await expect(
      removeKoFromDuplicatePrefilter("gibt-es-nicht", prefilter),
    ).resolves.toBeUndefined();
  });

  it("Store-Fehler wird geloggt + geschluckt — die Löschung scheitert NIE daran", async () => {
    const failingStore: SemanticPrefilter["store"] = {
      upsert: async () => {},
      nearest: async () => [],
      delete: async () => {
        throw new Error("store kaputt");
      },
    };
    const prefilter: SemanticPrefilter = {
      embedder: stubEmbeddingProvider(256),
      store: failingStore,
      topK: 5,
    };
    const logs: string[] = [];
    await expect(
      removeKoFromDuplicatePrefilter("k1", prefilter, (msg) => logs.push(msg)),
    ).resolves.toBeUndefined();
    expect(logs).toHaveLength(1);
  });
});

// ben-Review #6: Erkennungsfehler bleiben best-effort (kein Throw), werden aber sichtbar, wenn ein
// Log-Haken gereicht wird (z. B. am Import-Accept-Pfad). Ohne Haken = altes stilles Verhalten.
describe("detect*ForKo — Fehler-Logging (ben #6)", () => {
  it("detectDuplicatesForKo: Fehler in detectForSubject → Log gefeuert, kein Throw", async () => {
    const deps = {
      ko: { get: async () => subject, list: async () => [subject, near1] },
      overlaps: {
        detectForSubject: async () => {
          throw new Error("boom");
        },
      },
      reasoner: { judgeDuplicate: async () => null },
      settings: { get: async () => null },
    } as unknown as DuplicateDetectionDeps;
    const logs: string[] = [];
    await expect(detectDuplicatesForKo("s", deps, (m) => logs.push(m))).resolves.toBeUndefined();
    expect(logs).toHaveLength(1);
  });

  it("detectDuplicatesForKo: OHNE Log-Haken bleibt der Fehler still (kein Throw)", async () => {
    const deps = {
      ko: { get: async () => subject, list: async () => [subject, near1] },
      overlaps: {
        detectForSubject: async () => {
          throw new Error("boom");
        },
      },
      reasoner: { judgeDuplicate: async () => null },
      settings: { get: async () => null },
    } as unknown as DuplicateDetectionDeps;
    await expect(detectDuplicatesForKo("s", deps)).resolves.toBeUndefined();
  });

  it("detectConflictsForKo: Fehler in detectForSubject → Log gefeuert, kein Throw", async () => {
    const deps = {
      ko: { get: async () => subject, list: async () => [subject, near1] },
      conflicts: {
        detectForSubject: async () => {
          throw new Error("boom");
        },
      },
      reasoner: { judgeConflict: async () => null },
    } as unknown as Parameters<typeof detectConflictsForKo>[1];
    const logs: string[] = [];
    await expect(detectConflictsForKo("s", deps, (m) => logs.push(m))).resolves.toBeUndefined();
    expect(logs).toHaveLength(1);
  });
});

// D-AISTATE PAKET 1 (bens V1, ersetzt SCRUM-502-Frühabbruch): Vertraulichkeit wird NICHT mehr durch
// Überspringen der GESAMTEN Erkennung durchgesetzt, sondern durch die Judge-KETTE (der Reasoner nimmt
// bei einem vertraulichen Paar die Cloud raus). Die (lokale, egress-freie) deterministische Ebene läuft
// deshalb IMMER — auch für vertrauliche Subjekte und gemischte Paare; vertrauliche Kandidaten bleiben im
// Pool, tragen aber die Vertraulichkeits-MARKE. Die Indizierung (Cloud-Embedder) bleibt gesperrt.
describe("D-AISTATE V1: Vertraulichkeit — deterministische Ebene läuft, Cloud bleibt gate-geschützt", () => {
  const conf = (id: string, title: string, statement: string): KnowledgeObject =>
    ({ ...makeKo(id, title, statement), confidentiality: "vertraulich" }) as KnowledgeObject;

  it("Duplikat-Pool: vertraulicher Kandidat BLEIBT im Pool, aber MARKIERT (Cloud-Ausschluss trägt der Reasoner)", async () => {
    const secret = conf("c1", "dach reparatur", "ziegel dichtung undicht");
    const { deps, poolIds, confidentialPoolIds, detect } = makeDeps(subject, [secret, near2, far1]);
    await detectDuplicatesForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    // Alle drei im Pool (gemischte Paare werden deterministisch verglichen) …
    expect(poolIds()).toEqual(["c1", "c2", "c3"]);
    // … der vertrauliche trägt die Marke, die die Cloud draußen hält.
    expect(confidentialPoolIds()).toEqual(["c1"]);
  });

  it("Duplikat: vertrauliches SUBJEKT → Erkennung LÄUFT (deterministische Ebene), Subjekt markiert", async () => {
    const secretSubject = conf("s", "dach reparatur", "ziegel dichtung abdichtung wetter");
    const { deps, detect } = makeDeps(secretSubject, [near1, near2]);
    await detectDuplicatesForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    // Das Subjekt selbst trägt die Vertraulichkeits-Marke (erstes Argument von detectForSubject).
    const subjectArg = detect.mock.calls[0]?.[0] as { confidential?: boolean };
    expect(subjectArg.confidential).toBe(true);
  });

  it("Konflikt-Pool: vertraulicher Kandidat BLEIBT im Pool (markiert); vertrauliches Subjekt → Erkennung läuft", async () => {
    const secret = conf("c1", "dach reparatur", "ziegel dichtung undicht");
    let pool: { refId: string; confidential?: boolean }[] = [];
    const detect = vi.fn(
      async (_s: unknown, p: ReadonlyArray<{ refId: string; confidential?: boolean }>) => {
        pool = [...p];
      },
    );
    const deps = {
      ko: { get: async () => subject, list: async () => [subject, secret, near2] },
      conflicts: { detectForSubject: detect },
      reasoner: { judgeConflict: async () => null },
    } as unknown as Parameters<typeof detectConflictsForKo>[1];
    await detectConflictsForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(pool.map((x) => x.refId).sort()).toEqual(["c1", "c2"]);
    expect(pool.filter((x) => x.confidential).map((x) => x.refId)).toEqual(["c1"]);

    // Vertrauliches Subjekt → Erkennung LÄUFT (nicht mehr übersprungen).
    const secretSubject = conf("s", "dach reparatur", "ziegel dichtung abdichtung wetter");
    const detect2 = vi.fn(async () => undefined);
    const deps2 = {
      ko: { get: async () => secretSubject, list: async () => [secretSubject, near2] },
      conflicts: { detectForSubject: detect2 },
      reasoner: { judgeConflict: async () => null },
    } as unknown as Parameters<typeof detectConflictsForKo>[1];
    await detectConflictsForKo("s", deps2);
    expect(detect2).toHaveBeenCalledTimes(1);
  });

  it("Indizierung: vertrauliches KO wird NIE eingebettet (Store bleibt leer)", async () => {
    const store = new InMemoryEmbeddingStore();
    await indexKoForDuplicatePrefilter(conf("x", "titel", "geheimer text"), {
      embedder: stubEmbeddingProvider(256),
      store,
      topK: 5,
    });
    expect(await store.nearest([1, 0, 0, 0], "stub@256", 5)).toEqual([]);
  });
});
