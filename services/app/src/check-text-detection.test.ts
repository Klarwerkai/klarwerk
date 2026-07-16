import { describe, expect, it, vi } from "vitest";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
  type OverlapVerdict,
} from "../../conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../embedding";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { checkText } from "./check-text-detection";
import type { SemanticPrefilter } from "./duplicate-detection";

// SCRUM-491 Slice 4 (+ ben-Review-Fix): side-effect-freier Dry-Run-Kern. Prüft transienten Freitext
// gegen den VALIDIERTEN Bestand — ohne etwas anzulegen, ohne Text an einen Embedder abzugeben, sofern
// kein judge gesetzt ist, und mit hartem Retrieval-Cap an der Datenquelle (kein Full-Scan).
const TEXT_IDENTISCH = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
const TEXT_MITTEL = "Nach dem Anfahren zehn Sekunden warten.";

function mkKo(id: string, status: "validiert" | "offen", statement: string): KnowledgeObject {
  return {
    id,
    title: "Pumpe entlüften",
    statement,
    status,
    conditions: [],
    measures: [],
    tags: [],
    category: "Wartung",
    asset: null,
  } as unknown as KnowledgeObject;
}

// Fake-KoService mit Spies: der Orchestrator darf list() (all-then-filter) NIE rufen, sondern die
// gedeckelte Source-Query findCandidates({terms, limit}) bzw. get(id) für den bounded fetch.
function koService(seed: KnowledgeObject[]) {
  const list = vi.fn(async () => seed);
  const findCandidates = vi.fn(async (q: { terms: readonly string[]; limit: number }) =>
    seed.slice(0, q.limit),
  );
  const get = vi.fn(async (id: string) => seed.find((k) => k.id === id));
  const ko = { list, findCandidates, get } as unknown as KoService;
  return { ko, list, findCandidates, get };
}

// Fake-Prefilter mit Spy-Embedder/-Store: beweist, ob (und wann) Text an den Embedder geht.
function spyPrefilter(hits: Array<{ id: string }>) {
  const embed = vi.fn(async () => ({ vectors: [[1, 0, 0]], embeddingVersion: "spy@3", dim: 3 }));
  const nearest = vi.fn(async () => hits);
  const prefilter: SemanticPrefilter = {
    embedder: {
      name: "spy",
      embeddingVersion: "spy@3",
      dim: 3,
      isAvailable: () => true,
      embed,
    } as unknown as EmbeddingProvider,
    store: { upsert: vi.fn(), nearest, delete: vi.fn() } as unknown as EmbeddingStore,
    topK: 20,
  };
  return { prefilter, embed, nearest };
}

// Fake-Duplikat-Urteil (G-2: Zitate stehen wörtlich in beiden Kerntexten → verifiziert).
const teilweiseVerdict: OverlapVerdict = {
  beziehung: "teilweise",
  aspects: [
    { beschreibung: "Titel deckt sich", zitatA: "Pumpe entlüften", zitatB: "Pumpe entlüften" },
  ],
  nurInA: "nur A",
  nurInB: "nur B",
  empfehlung: "zusammenfuehren_pruefen",
  confidence: 0.9,
  begruendung: "Teilweiser gemeinsamer Kern.",
};

describe("SCRUM-491: checkText — Dry-Run (validated-only, keine Persistenz, source-bounded)", () => {
  it("validated-only via findCandidates; deterministisch; KEINE Persistenz; kein ko.list()-all", async () => {
    const overlapRepo = new InMemoryOverlapRepo();
    const { ko, list, findCandidates } = koService([
      mkKo("v1", "validiert", TEXT_IDENTISCH),
      mkKo("u1", "offen", TEXT_IDENTISCH), // unvalidiert → darf NIE in den Pool
    ]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: overlapRepo }) },
    );
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.koId).toBe("v1");
    expect(result.duplicates[0]?.method).toBe("deterministic");
    expect(result.duplicates.map((d) => d.koId)).not.toContain("u1");
    // Source-bounded: findCandidates mit hartem topK, ko.list()-all NICHT gerufen.
    expect(list).not.toHaveBeenCalled();
    expect(findCandidates).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    // NULL Persistenz.
    expect(await overlapRepo.all()).toHaveLength(0);
  });

  it("Fix 1: judge-los + injizierter Semantic-Prefilter → KEIN embed (kein Textabfluss), lexikalischer Fallback", async () => {
    const { prefilter, embed, nearest } = spyPrefilter([{ id: "v1" }]);
    const { ko, list, findCandidates } = koService([mkKo("v1", "validiert", TEXT_IDENTISCH)]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        semanticPrefilter: prefilter,
      },
    );
    // Der Kern der Härtung: ohne judge geht KEIN Text an den Embedder.
    expect(embed).not.toHaveBeenCalled();
    expect(nearest).not.toHaveBeenCalled();
    // Stattdessen die gedeckelte lexikalische Source-Query.
    expect(findCandidates).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    expect(list).not.toHaveBeenCalled();
    expect(result.duplicates).toHaveLength(1);
  });

  it("Fix 2: judge + Prefilter → bounded fetch by ID (nearest topK → ko.get je Treffer), kein ko.list()", async () => {
    const { prefilter, embed, nearest } = spyPrefilter([{ id: "v2" }]);
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => teilweiseVerdict);
    const { ko, list, get, findCandidates } = koService([
      mkKo("v2", "validiert", TEXT_MITTEL),
      mkKo("noise", "validiert", "voellig anderer inhalt"),
    ]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        duplicateJudge: judge,
        semanticPrefilter: prefilter,
      },
    );
    expect(embed).toHaveBeenCalledTimes(1);
    expect(nearest).toHaveBeenCalledWith(expect.anything(), "spy@3", 20, "transient");
    expect(get).toHaveBeenCalledWith("v2"); // nur der Treffer, nicht "noise"
    expect(get).not.toHaveBeenCalledWith("noise");
    expect(list).not.toHaveBeenCalled();
    expect(findCandidates).not.toHaveBeenCalled(); // Semantic-Pfad lieferte Treffer → kein Fallback
    expect(result.duplicates[0]?.koId).toBe("v2");
    expect(result.duplicates[0]?.method).toBe("model");
  });

  it("Bounding: großer Bestand → nur topK an der Quelle (findCandidates limit=20), kein ko.list()", async () => {
    const big = Array.from({ length: 50 }, (_, i) => mkKo(`v${i}`, "validiert", TEXT_IDENTISCH));
    const { ko, list, findCandidates } = koService(big);
    await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    expect(list).not.toHaveBeenCalled();
    expect(findCandidates).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    // Die Quelle lieferte höchstens topK Zeilen (findCandidates honoriert das Limit).
    const returned = (await findCandidates.mock.results[0]?.value) as KnowledgeObject[];
    expect(returned.length).toBeLessThanOrEqual(20);
  });

  it("mit Fake-judge (ohne Prefilter) → Modell-Urteil via findCandidates, KEINE Persistenz", async () => {
    const overlapRepo = new InMemoryOverlapRepo();
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => teilweiseVerdict);
    const { ko } = koService([mkKo("v2", "validiert", TEXT_MITTEL)]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: overlapRepo }), duplicateJudge: judge },
    );
    expect(judge).toHaveBeenCalled();
    expect(result.duplicates[0]?.method).toBe("model");
    expect(result.duplicates[0]?.confidence).toBe(0.9);
    expect(await overlapRepo.all()).toHaveLength(0);
  });

  it("nur unvalidierte KOs → leeres Ergebnis, kein Fehler", async () => {
    const { ko } = koService([mkKo("u1", "offen", TEXT_IDENTISCH)]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    expect(result.duplicates).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("Konflikt-Zweig ohne conflictJudge bleibt leer, keine Persistenz", async () => {
    const conflictRepo = new InMemoryConflictRepo();
    const { ko } = koService([mkKo("v1", "validiert", TEXT_IDENTISCH)]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        conflicts: new ConflictService({ repo: conflictRepo }),
      },
    );
    expect(result.conflicts).toHaveLength(0);
    expect(await conflictRepo.all()).toHaveLength(0);
  });
});
