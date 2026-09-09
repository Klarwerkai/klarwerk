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
import {
  type CheckTextResult,
  type CheckTextSourceHit,
  type Quellenfundlage,
  checkText,
} from "./check-text-detection";
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
//
// JOB 3216: der Fake trägt jetzt AUCH den gemeinsamen Suchvertrag (`findSearchHits`,
// `listForSearch`, `effectiveSearchDocumentOf`) — sonst wäre der Quellenfund in diesen Fällen
// stumm und die Zusicherungen darüber wertlos. Der Suchtext eines Seed-Objekts ist Titel, Aussage
// und ein optionales Feld `suchtext`, das den GESPEICHERTEN VOLLTEXT stellt (im echten Produkt
// kommt er aus der Suchprojektion, die den sichtbaren Text des `bodyHtml` mitführt).
function suchtextVon(k: KnowledgeObject): string {
  const volltext = (k as unknown as { suchtext?: string }).suchtext ?? "";
  return [k.title, k.statement, volltext].filter((teil) => teil.length > 0).join("\n");
}

function koService(seed: KnowledgeObject[]) {
  const list = vi.fn(async () => seed);
  const findCandidates = vi.fn(async (_q: { terms: readonly string[]; limit: number }) => seed);
  const get = vi.fn(async (id: string) => seed.find((k) => k.id === id));
  // Zusammenhängende Enthaltenheit — dieselbe Auslegung wie `matchEffectiveSearchDocument`
  // (knowledge-object/src/effective-search-document.ts: `lower.includes(term)`).
  const findSearchHits = vi.fn(async (q: { terms: readonly string[]; limit?: number }) =>
    seed
      .filter((k) =>
        q.terms.some((term) => suchtextVon(k).toLowerCase().includes(term.toLowerCase())),
      )
      .slice(0, q.limit ?? seed.length)
      .map((k) => ({ koId: k.id, koVersion: 1 })),
  );
  const listForSearch = vi.fn(async () => seed);
  const effectiveSearchDocumentOf = vi.fn(async (id: string) => {
    const k = seed.find((x) => x.id === id);
    return k === undefined ? undefined : { koId: id, searchText: suchtextVon(k) };
  });
  const ko = {
    list,
    findCandidates,
    get,
    findSearchHits,
    listForSearch,
    effectiveSearchDocumentOf,
  } as unknown as KoService;
  return {
    ko,
    list,
    findCandidates,
    get,
    findSearchHits,
    listForSearch,
    effectiveSearchDocumentOf,
  };
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

// ================================================================================================
// JOB 3216 · M3c — DER QUELLENFUND AM KERN: was nur ein Fake belegen kann.
// ================================================================================================
//
// Die Fälle am ECHTEN HTTP-Weg mit ECHTEN Objekten stehen in tests/m3-dokumentweg. HIER stehen die
// fünf Lagen, für die ein Fake das einzige ehrliche Mittel ist:
//
//   Q1  eine Datenquelle, die LOCKERER trifft, als der Vertrag es zulässt (Tokenmenge statt
//       zusammenhängender Zeichenkette). Kein heutiger Adapter tut das — aber der Vertrag darf
//       nicht davon abhängen, dass keiner es je tut. Genau das misst dieser Fall.
//   Q2  dass der Quellenfund KEIN Urteil bewegt: dieselbe Eingabe, einmal mit und einmal ohne
//       Quellenfund, muss dieselben `duplicates` liefern.
//   Q3  dass die Sichtbarkeitsentscheidung der Route wirklich greift.
//   Q4  dass eine WERFENDE Suche als solche gemeldet wird und die Dublettenprüfung nicht mitreißt.
//   Q5  dass die drei harten Poolausschlüsse hier dieselben sind wie beim Dublettenpool.
const ABSATZ =
  "Die zulaessige Kombination aus Werkzeugsatz und Kuehlmittelmenge wird vor dem Chargenwechsel " +
  "freigegeben und im Anlagenbuch vermerkt.";

/**
 * RUNDE 2: `CheckTextResult` führt die drei Quellenfund-Felder OPTIONAL — der Vertrag §5.4 sagt
 * „fehlt = leer", und ein fremder Erzeuger darf sie weglassen. `checkText` SELBST setzt sie immer.
 * Genau das prüft dieser Helfer, bevor er verengt: fehlte eines, wäre nicht der Vertrag zu weit,
 * sondern der Kern kaputt — und die Fälle unten würden es sonst mit `?? []` stillschweigend
 * überdecken.
 */
function quellenfundVon(result: CheckTextResult) {
  expect(result.sourceHits, "checkText liefert sourceHits immer").toBeDefined();
  expect(result.quellenfund, "checkText liefert quellenfund immer").toBeDefined();
  expect(result.sourceHitsTruncated, "checkText liefert sourceHitsTruncated immer").toBeDefined();
  return {
    hits: result.sourceHits as CheckTextSourceHit[],
    lage: result.quellenfund as Quellenfundlage,
    gedeckelt: result.sourceHitsTruncated as boolean,
  };
}

/** Ein Seed-Objekt mit gespeichertem Volltext, dessen Kerntext den Absatz NICHT trägt. */
function mitVolltext(id: string, volltext: string, extra: Record<string, unknown> = {}) {
  return {
    ...mkKo(id, "validiert", "Profile werden regelmaessig ueberprueft."),
    version: 3,
    suchtext: volltext,
    ...extra,
  } as unknown as KnowledgeObject;
}

describe("JOB 3216: Quellenfund — Vertrag, Trennung, Rechte, Ausfall", () => {
  it("Q1 · eine Datenquelle, die nur Tokens trifft, erzeugt KEINEN Quellenfund", async () => {
    // Der Störtext trägt JEDES Wort des Absatzes — aber nicht den Absatz. Eine Datenquelle, die
    // auf Tokenmenge träfe, lieferte ihn als Kandidaten; die Nachprüfung am Suchtext verwirft ihn.
    const stoertext = ABSATZ.split(" ").reverse().join(" ");
    const seed = [mitVolltext("s1", stoertext)];
    const suchtextEines = (k: KnowledgeObject) => (k as unknown as { suchtext: string }).suchtext;
    const lockererTreffer = vi.fn(async (q: { terms: readonly string[] }) => {
      const woerter = (q.terms[0] ?? "").toLowerCase().split(" ");
      return seed
        .filter((k) => woerter.every((w) => suchtextEines(k).toLowerCase().includes(w)))
        .map((k) => ({ koId: k.id, koVersion: 1 }));
    });
    const ko = {
      list: vi.fn(async () => seed),
      findCandidates: vi.fn(async () => seed),
      get: vi.fn(async (id: string) => seed.find((k) => k.id === id)),
      findSearchHits: lockererTreffer,
      listForSearch: vi.fn(async () => seed),
      effectiveSearchDocumentOf: vi.fn(async (id: string) => {
        const k = seed.find((x) => x.id === id);
        return k === undefined ? undefined : { koId: id, searchText: suchtextEines(k) };
      }),
    } as unknown as KoService;
    const result = await checkText(
      { text: ABSATZ },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    // Die Datenquelle HAT geliefert — das ist die Voraussetzung des Falls, sonst misst er nichts.
    expect(lockererTreffer).toHaveBeenCalled();
    expect(await lockererTreffer({ terms: [ABSATZ] })).toHaveLength(1);
    // Und der Kern hat verworfen.
    const quellen = quellenfundVon(result);
    expect(quellen.hits).toEqual([]);
    expect(quellen.lage.gelaufen).toBe(true);
    expect(quellen.lage.geprueft).toBe(1);
  });

  it("Q1b · derselbe Absatz zusammenhängend im Volltext → Quellenfund mit voller Deckung", async () => {
    const { ko } = koService([mitVolltext("s2", `Vorspann. ${ABSATZ} Nachspann.`)]);
    const result = await checkText(
      { text: ABSATZ },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    const { hits } = quellenfundVon(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.refId).toBe("s2");
    expect(hits[0]?.coverage).toBe("full");
    expect(hits[0]?.gedeckteZeichen).toBe(ABSATZ.length);
    expect(hits[0]?.passageZeichen).toBe(ABSATZ.length);
    expect(hits[0]?.koVersion).toBe(3);
    expect(hits[0]?.fundstelle).toContain(ABSATZ);
  });

  it("Q2 · der Quellenfund bewegt KEIN Dublettenurteil (mit und ohne: gleiche duplicates)", async () => {
    // Der Unterschied zwischen beiden Läufen liegt AUSSCHLIESSLICH im gespeicherten Volltext des
    // ZWEITEN Objekts — sein Kerntext (Titel, Aussage) ist in beiden Läufen derselbe. Der
    // Kandidatenpool der Dublettenprüfung kann sich dadurch nicht bewegen; der Quellenfund schon.
    const kern = mkKo("v1", "validiert", TEXT_IDENTISCH);
    const mit = koService([kern, mitVolltext("s9", `Vorspann. ${TEXT_IDENTISCH} Nachspann.`)]);
    const ohne = koService([kern, mitVolltext("s9", "Voellig anderer gespeicherter Inhalt.")]);
    const eingabe = { text: TEXT_IDENTISCH, title: "Pumpe entlüften" };
    const a = await checkText(eingabe, {
      ko: mit.ko,
      overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
    });
    const b = await checkText(eingabe, {
      ko: ohne.ko,
      overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
    });
    expect(quellenfundVon(a).hits.map((h) => h.refId)).toEqual(["v1", "s9"]);
    expect(quellenfundVon(b).hits.map((h) => h.refId)).toEqual(["v1"]);
    // Das Urteil ist in beiden Läufen dasselbe — Feld für Feld.
    expect(a.duplicates).toEqual(b.duplicates);
    expect(a.conflicts).toEqual(b.conflicts);
    expect(a.duplicates).toHaveLength(1);
    expect(a.duplicates[0]?.koId).toBe("v1");
  });

  it("Q3 · die Sichtbarkeitsentscheidung der Route schließt ein Objekt aus", async () => {
    const { ko } = koService([mitVolltext("s3", ABSATZ)]);
    const gemeinsam = { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) };
    const offen = await checkText({ text: ABSATZ }, gemeinsam);
    expect(quellenfundVon(offen).hits.map((h) => h.refId)).toEqual(["s3"]);
    const gefiltert = quellenfundVon(
      await checkText({ text: ABSATZ }, { ...gemeinsam, quellenSichtbar: (k) => k.id !== "s3" }),
    );
    expect(gefiltert.hits).toEqual([]);
    expect(gefiltert.lage.geprueft).toBe(0);
  });

  it("Q4 · wirft die Suche, sagt die Antwort das — und die Dublettenprüfung läuft weiter", async () => {
    const seed = [mkKo("v1", "validiert", TEXT_IDENTISCH)];
    const ko = {
      list: vi.fn(async () => seed),
      findCandidates: vi.fn(async () => seed),
      get: vi.fn(async (id: string) => seed.find((k) => k.id === id)),
      findSearchHits: vi.fn(async () => {
        throw new Error("Suchprojektion nicht freigegeben");
      }),
      listForSearch: vi.fn(async () => seed),
      effectiveSearchDocumentOf: vi.fn(async () => undefined),
    } as unknown as KoService;
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    const quellen = quellenfundVon(result);
    expect(quellen.lage).toEqual({
      gelaufen: false,
      grund: "suche_nicht_verfuegbar",
      geprueft: 0,
    });
    expect(quellen.hits).toEqual([]);
    // Die Kerntextprüfung ist davon unberührt — sie hat ihr Duplikat.
    expect(result.duplicates).toHaveLength(1);
  });

  it("Q4b · RUNDE 2 · wirft irgendein SPÄTERER Schritt, kippt er die Antwort ebenfalls nicht", async () => {
    // Runde 1 fing nur `findSearchHits` ab. Dieser Fall setzt den Fehler dahinter — an
    // `listForSearch` — und belegt, dass das Netz um den GANZEN Lauf liegt und nicht um einen Aufruf.
    const seed = [mkKo("v1", "validiert", TEXT_IDENTISCH)];
    const ko = {
      list: vi.fn(async () => seed),
      findCandidates: vi.fn(async () => seed),
      get: vi.fn(async (id: string) => seed.find((k) => k.id === id)),
      findSearchHits: vi.fn(async () => [{ koId: "v1", koVersion: 1 }]),
      listForSearch: vi.fn(async () => {
        throw new Error("Datenquelle nicht erreichbar");
      }),
      effectiveSearchDocumentOf: vi.fn(async () => undefined),
    } as unknown as KoService;
    const result = await checkText(
      { text: TEXT_IDENTISCH, title: "Pumpe entlüften" },
      { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
    );
    expect(quellenfundVon(result).lage).toEqual({
      gelaufen: false,
      grund: "suche_nicht_verfuegbar",
      geprueft: 0,
    });
    expect(result.duplicates).toHaveLength(1);
  });

  it("Q5 · Poolregeln gelten auch hier: offen (ohne Schalter), Demobestand, vertraulich", async () => {
    const seed = [
      mitVolltext("offen1", ABSATZ, { status: "offen" }),
      mitVolltext("demo1", ABSATZ, { demoSeed: true }),
      mitVolltext("vertr1", ABSATZ, { confidentiality: "vertraulich" }),
      mitVolltext("ok1", ABSATZ),
    ];
    const { ko } = koService(seed);
    const gemeinsam = { ko, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) };
    const ohneSchalter = await checkText({ text: ABSATZ }, gemeinsam);
    expect(quellenfundVon(ohneSchalter).hits.map((h) => h.refId)).toEqual(["ok1"]);
    // Mit `includeUnvalidated` (Menschenweg) kommt das OFFENE dazu — und nur das.
    const mitSchalter = await checkText(
      { text: ABSATZ },
      { ...gemeinsam, includeUnvalidated: true },
    );
    expect(
      quellenfundVon(mitSchalter)
        .hits.map((h) => h.refId)
        .sort(),
    ).toEqual(["offen1", "ok1"]);
  });
});

// Ist-Stand, kein Sollwert. OFFEN: BEN 3216 R2 (archiv/3216/runde-2/ben.md:30):
// „diese Suchgrenze bleibt ausdrücklich offen". Ein zulässiger Quellenfund hinter Rang 200
// wird heute still weggelassen; sourceHitsTruncated meldet das nicht und DARF es nicht melden,
// weil das Feld laut check-text-detection.ts:184-186 nie über verborgene Objekte Auskunft geben
// soll. Wer dieses Verhalten ändert, ändert eine bewusste Grenze — dieser Test macht die Änderung
// sichtbar, er segnet sie nicht ab. Q1b bleibt der unveränderte Gegenfall mit wenigen Treffern.
it("Q6 · OFFEN: Pg-Deckel vor Rechtefilter lässt den zulässigen Quellenfund auf Rang 201 still aus", async () => {
  // Alle ersten 201 sind validiert: Offene kämen nach Pg-Ausgabeordnung erst DAHINTER.
  // Deshalb sind die 199 unzulässigen Zeilen abwechselnd vertraulich und Demo-Seed.
  const verboten = Array.from({ length: 199 }, (_, i) =>
    mitVolltext(`verborgen-${String(i).padStart(3, "0")}`, ABSATZ, {
      trust: 100,
      ...(i % 2 === 0 ? { confidentiality: "vertraulich" } : { demoSeed: true }),
    }),
  );
  const amDeckel = mitVolltext("sichtbar-200", ABSATZ, { trust: 1 });
  const dahinter = mitVolltext("sichtbar-201", ABSATZ, { trust: null });
  // Absichtlich verkehrte Eingangsordnung: der Fake muss wirklich sortieren.
  const seed = [
    mitVolltext("offen", ABSATZ, { status: "offen", trust: 200 }),
    dahinter,
    amDeckel,
    ...verboten.reverse(),
  ];
  const { ko, findSearchHits, effectiveSearchDocumentOf } = koService(seed);
  findSearchHits.mockImplementation(async (q) =>
    seed
      .filter((k) =>
        q.terms.some((term) => suchtextVon(k).toLowerCase().includes(term.toLowerCase())),
      )
      // search-projection-repo-pg.ts:662: validiert DESC, trust DESC NULLS LAST, ko_id.
      .sort(
        (a, b) =>
          Number(b.status === "validiert") - Number(a.status === "validiert") ||
          (b.trust ?? Number.NEGATIVE_INFINITY) - (a.trust ?? Number.NEGATIVE_INFINITY) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, q.limit ?? seed.length)
      .map((k) => ({ koId: k.id, koVersion: k.version })),
  );
  const result = await checkText(
    { text: ABSATZ },
    {
      ko,
      overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
    },
  );
  const { hits, lage, gedeckelt } = quellenfundVon(result);
  expect(hits.map((h) => h.refId)).toEqual([amDeckel.id]);
  expect(hits.map((h) => h.refId)).not.toContain(dahinter.id);
  expect(hits[0]?.fundstelle).toContain(ABSATZ);
  expect(gedeckelt).toBe(false);
  expect(lage).toEqual({ gelaufen: true, grund: null, geprueft: 1 });
  expect(findSearchHits).toHaveBeenCalledTimes(1);
  expect(findSearchHits).toHaveBeenCalledWith({ terms: [ABSATZ], limit: 200 });
  const geliefert: Awaited<ReturnType<KoService["findSearchHits"]>> | undefined =
    await findSearchHits.mock.results[0]?.value;
  expect(geliefert).toHaveLength(200);
  expect(geliefert?.slice(0, 199).every((h) => h.koId.startsWith("verborgen-"))).toBe(true);
  expect(geliefert?.[199]?.koId).toBe(amDeckel.id);
  expect(effectiveSearchDocumentOf).toHaveBeenCalledTimes(1);
  expect(effectiveSearchDocumentOf).toHaveBeenCalledWith(amDeckel.id);
});
