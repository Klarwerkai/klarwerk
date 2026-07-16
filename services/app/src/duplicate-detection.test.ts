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

// SCRUM-502 (Sicherheit): vertrauliche KOs gehen NIE in einen externen Kontext. Der Modell-Judge (Duplikat
// + Konflikt) und der Embedder sind externe Kontexte → vertrauliche KOs raus aus dem Pool und aus der
// Indizierung; ein vertrauliches SUBJEKT (dessen eigener coreText an den Judge ginge) überspringt die
// Erkennung ganz. Nicht-vertrauliche KOs laufen unverändert weiter (kein Regress).
describe("SCRUM-502: Vertraulichkeit — kein Egress an Modell-Judge/Embedder", () => {
  const conf = (id: string, title: string, statement: string): KnowledgeObject =>
    ({ ...makeKo(id, title, statement), confidentiality: "vertraulich" }) as KnowledgeObject;

  it("Duplikat-Pool: vertraulicher Kandidat ist NIE im Judge-Pool; interne bleiben", async () => {
    const secret = conf("c1", "dach reparatur", "ziegel dichtung undicht");
    const { deps, poolIds, detect } = makeDeps(subject, [secret, near2, far1]);
    await detectDuplicatesForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(poolIds()).toEqual(["c2", "c3"]); // secret (c1) fehlt, Rest unverändert
  });

  it("Duplikat: vertrauliches SUBJEKT → Erkennung entfällt (Judge nie aufgerufen)", async () => {
    const secretSubject = conf("s", "dach reparatur", "ziegel dichtung abdichtung wetter");
    const { deps, detect } = makeDeps(secretSubject, [near1, near2]);
    await detectDuplicatesForKo("s", deps);
    expect(detect).not.toHaveBeenCalled();
  });

  it("Konflikt-Pool: vertraulicher Kandidat ist NIE im Judge-Pool; vertrauliches Subjekt entfällt", async () => {
    const secret = conf("c1", "dach reparatur", "ziegel dichtung undicht");
    let pool: string[] = [];
    const detect = vi.fn(async (_s: unknown, p: ReadonlyArray<{ refId: string }>) => {
      pool = p.map((x) => x.refId);
    });
    const deps = {
      ko: { get: async () => subject, list: async () => [subject, secret, near2] },
      conflicts: { detectForSubject: detect },
      reasoner: { judgeConflict: async () => null },
    } as unknown as Parameters<typeof detectConflictsForKo>[1];
    await detectConflictsForKo("s", deps);
    expect(detect).toHaveBeenCalledTimes(1);
    expect([...pool].sort()).toEqual(["c2"]); // secret raus

    // Vertrauliches Subjekt → Erkennung entfällt ganz.
    const secretSubject = conf("s", "dach reparatur", "ziegel dichtung abdichtung wetter");
    const detect2 = vi.fn(async () => undefined);
    const deps2 = {
      ko: { get: async () => secretSubject, list: async () => [secretSubject, near2] },
      conflicts: { detectForSubject: detect2 },
      reasoner: { judgeConflict: async () => null },
    } as unknown as Parameters<typeof detectConflictsForKo>[1];
    await detectConflictsForKo("s", deps2);
    expect(detect2).not.toHaveBeenCalled();
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
