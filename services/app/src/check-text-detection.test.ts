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
import { ModelCapacityError } from "../../reasoner";
import { checkText } from "./check-text-detection";
import type { SemanticPrefilter } from "./duplicate-detection";

// SCRUM-491 Slice 4 (+ ben-Review-Fix): side-effect-freier Dry-Run-Kern. Prüft transienten Freitext
// gegen den VALIDIERTEN Bestand — ohne etwas anzulegen, ohne Text an einen Embedder abzugeben, sofern
// kein judge gesetzt ist. Der Orchestrator lädt NIE den Gesamtbestand (kein ko.list()-all): semantisch
// nur die topK-Treffer per ID, lexikalisch die gedeckelte Source-Query. Das quell-seitige Deckeln
// selbst ist Sache des Repos (PgKoRepo: SQL LIMIT — repo-pg-candidates.test.ts; InMemory-Output-Limit —
// repo-candidates.test.ts), nicht dieses Orchestrators.
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
// WICHTIG (ben-Re-Review): findCandidates deckelt hier bewusst NICHT selbst (kein seed.slice(limit)).
// Das quell-seitige Deckeln ist Sache des echten Repos (PgKoRepo: SQL LIMIT — geprüft in
// repo-pg-candidates.test.ts; InMemory-Output-Limit — geprüft in repo-candidates.test.ts). Würde der
// Fake sich selbst begrenzen, wäre jede „Bounding"-Assertion tautologisch. Stattdessen messen die
// Tests, was der ORCHESTRATOR tatsächlich lädt/anfordert: kein list(), get() nur je topK-Treffer,
// und findCandidates mit dem harten limit.
function koService(seed: KnowledgeObject[]) {
  const list = vi.fn(async () => seed);
  const findCandidates = vi.fn(async (_q: { terms: readonly string[]; limit: number }) => seed);
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

  it("Bounding (semantischer Pfad): 50 im Store, aber der Orchestrator lädt NUR die topK Treffer per ko.get", async () => {
    // Ehrliche Messung (ben-Re-Review): 50 validierte KOs im Store, der Prefilter liefert topK (=20)
    // Nächste. Gemessen wird, was der ORCHESTRATOR tatsächlich lädt/bewertet — der Fake-get würde jede
    // der 50 IDs bedienen, aber der Orchestrator fragt nur die 20 nearest-Treffer an. Ein reintroduzierter
    // Full-Load (ko.list()-all oder get je Bestands-KO) würde diesen Test rot machen.
    const big = Array.from({ length: 50 }, (_, i) => mkKo(`v${i}`, "validiert", TEXT_IDENTISCH));
    const nearestIds = big.slice(0, 20).map((k) => ({ id: k.id }));
    const { prefilter, nearest } = spyPrefilter(nearestIds);
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => teilweiseVerdict);
    const { ko, list, get, findCandidates } = koService(big);
    await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        duplicateJudge: judge,
        semanticPrefilter: prefilter,
      },
    );
    // store.nearest wird mit hartem topK angefragt; danach genau ein ko.get je Treffer — höchstens topK.
    expect(nearest).toHaveBeenCalledWith(expect.anything(), "spy@3", 20, "transient");
    expect(get).toHaveBeenCalledTimes(20);
    // Kein Full-Load: weder ko.list()-all noch die lexikalische Fallback-Query (Semantic traf → kein Fallback).
    expect(list).not.toHaveBeenCalled();
    expect(findCandidates).not.toHaveBeenCalled();
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

// SCRUM-498 B2 (Fix): der Semantic-Prefilter ruft embed() direkt. Läuft der Embed-Cap über
// (ModelCapacityError), darf checkText NICHT still auf den lexikalischen Fallback degradieren (das
// verschwiege unter Last ein echtes Duplikat), sondern muss den Backpressure durchreichen → 503.
// Echte Embed-Fehler (Netz/Store) degradieren weiterhin lexikalisch.
function throwingEmbedPrefilter(err: Error): SemanticPrefilter {
  return {
    embedder: {
      name: "throwing",
      embeddingVersion: "throw@3",
      dim: 3,
      isAvailable: () => true,
      embed: async () => {
        throw err;
      },
    } as unknown as EmbeddingProvider,
    store: { upsert: vi.fn(), nearest: vi.fn(), delete: vi.fn() } as unknown as EmbeddingStore,
    topK: 20,
  };
}

describe("SCRUM-498 B2 (Fix): Embed-Backpressure via Prefilter", () => {
  it("Embed wirft ModelCapacityError → checkText WIRFT (kein stiller lexikalischer Fallback), Judge unberührt", async () => {
    const { ko } = koService([mkKo("v2", "validiert", TEXT_MITTEL)]);
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => teilweiseVerdict);
    const prefilter = throwingEmbedPrefilter(new ModelCapacityError("Embedder ausgelastet."));
    await expect(
      checkText(
        { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
        {
          ko,
          overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
          duplicateJudge: judge,
          semanticPrefilter: prefilter,
        },
      ),
    ).rejects.toBeInstanceOf(ModelCapacityError);
    expect(judge).not.toHaveBeenCalled(); // Backpressure surfaced VOR dem Judge
  });

  it("echter Embed-Fehler → weiterhin lexikalischer Fallback (kein Wurf), Judge läuft auf dem Pool", async () => {
    const { ko, findCandidates } = koService([mkKo("v2", "validiert", TEXT_MITTEL)]);
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => teilweiseVerdict);
    const prefilter = throwingEmbedPrefilter(new Error("Embedder-Netzfehler"));
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        duplicateJudge: judge,
        semanticPrefilter: prefilter,
      },
    );
    expect(findCandidates).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.method).toBe("model"); // Judge lief auf dem lexikalischen Pool
  });
});

// SCRUM-502 (Sicherheit): check-text darf vertrauliche KOs NIE offenlegen. isValidatedCandidate schließt
// sie aus → Stufe 1 (deterministisch): kein Kandidat/Titel/Existenz in der Antwort; Stufe 2 (deep):
// deren coreText erreicht den Modell-Judge nie (nicht im Pool). Nicht-vertrauliche laufen weiter.
describe("SCRUM-502: check-text schließt vertrauliche KOs aus (beide Stufen)", () => {
  function conf(id: string, statement: string): KnowledgeObject {
    return {
      ...mkKo(id, "validiert", statement),
      confidentiality: "vertraulich",
    } as KnowledgeObject;
  }

  it("Stufe 1: vertrauliches KO wird NIE als Duplikat/Titel offengelegt", async () => {
    const { ko, findCandidates } = koService([conf("v1", TEXT_IDENTISCH)]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    expect(findCandidates).toHaveBeenCalled();
    expect(result.duplicates).toHaveLength(0); // kein Existenz-/Titel-Leak
  });

  it("Stufe 2 (deep): coreText des vertraulichen KO geht NIE an den Judge", async () => {
    const { prefilter } = spyPrefilter([{ id: "v2" }]); // Store meldet den vertraulichen Treffer …
    const { ko } = koService([conf("v2", TEXT_MITTEL)]);
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => teilweiseVerdict);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        duplicateJudge: judge,
        semanticPrefilter: prefilter,
      },
    );
    // … aber nach ko.get + isValidatedCandidate ist er raus → Judge nie mit seinem coreText aufgerufen.
    expect(judge).not.toHaveBeenCalled();
    expect(result.duplicates).toHaveLength(0);
  });

  it("nicht-vertrauliches KO bleibt unverändert Kandidat (kein Überfiltern)", async () => {
    const { ko } = koService([mkKo("v3", "validiert", TEXT_IDENTISCH)]);
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.koId).toBe("v3");
  });
});
