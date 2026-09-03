// ==================================================================================================
// JOB 3022 R3 · DER DECKEL WIRKT WIRKLICH — und die Gruppengrenze ist ausgeschrieben.
// ==================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST (Prüfer BEN, Runde 2, Prüflücke a): Der eingecheckte
// Testsatz prüfte `edgeLimit`/`truncated` nur an einem Bestand UNTERHALB des Deckels — dort ist
// `truncated: false` und `edges.length < edgeLimit` auch dann richtig, wenn der Deckel gar nicht
// schnitte. Ein Deckel, der nie schneidet, ist nicht gemessen. Fall 1 unten erzeugt deshalb mehr
// fachliche Kanten als der Deckel zulässt und prüft alle drei Zahlen exakt.
//
// FALL 2 IST DIE EHRLICHE GRENZE DES LEISTUNGSVERSPRECHENS (BEN, Prüflücke c): Der Lasttest in
// `graph-zwoelftausend.test.ts` misst eine realistische Verteilung (wenige Schlagwörter je Objekt,
// Gruppen von einigen Dutzend Trägern). Er sagt NICHTS über einen Bestand, in dem EIN Schlagwort
// knapp unter der Ubiquitätsschwelle fast die Hälfte aller Objekte trägt. Fall 2 schreibt aus, was
// dort passiert: die Kantenzahl wächst mit dem QUADRAT der Gruppengröße. Das ist kein Budget und
// keine Zusage — es ist die gemessene Zahl, damit niemand aus dem 12.000er-Lasttest eine Zusage
// liest, die er nicht trägt.
import { beforeAll, describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { type Graph, LibraryService } from "../../services/library-analytics";

function objekt(id: string, tags: string[]): KnowledgeObject {
  return {
    id,
    title: `Titel ${id}`,
    statement: `Kurzfassung ${id}.`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags,
    confidence: 3,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-09-03T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  };
}

async function graphVon(bestand: [string, string[]][]): Promise<Graph> {
  const repo = new InMemoryKoRepo();
  for (const [id, tags] of bestand) {
    await repo.insert(objekt(id, tags));
  }
  return new LibraryService({ koService: new KoService({ repo }) }).graph({ sichtbar: () => true });
}

// ------------------------------------------------------------------------------------------------
// FALL 1 · MEHR KANTEN ALS DER DECKEL ZULÄSST
// ------------------------------------------------------------------------------------------------
// 400 Objekte, davon tragen die ERSTEN 120 das Schlagwort `thema-a`. 120 von 400 sind 30 % — unter
// der Ubiquitätsschwelle (50 %), das Schlagwort erzeugt also echte Kanten. Die übrigen 280 tragen
// je ein eigenes Schlagwort und verbinden niemanden.
//
// C(120,2) = 120 · 119 / 2 = 7.140 Kanten. Der Deckel liegt bei 5.000.
const BESTAND_GROSS = 400;
const TRAEGER = 120;
const ERWARTETE_KANTEN = (TRAEGER * (TRAEGER - 1)) / 2; // 7140
const DECKEL = 5_000;

// Die Ids sind dreistellig aufgefüllt, damit die lexikografische Reihenfolge der numerischen folgt.
const id = (i: number) => `ko-${String(i).padStart(3, "0")}`;

// WELCHE 5.000 überleben, ist ausgeschrieben und nicht nachgerechnet: sortiert wird nach (a, b).
// Für `a = ko-000` gibt es 119 Kanten, für `ko-001` 118 … Nach `a = ko-053` sind es
// 54·119 − 54·53/2 = 6.426 − 1.431 = 4.995 Kanten. Die letzten fünf des Deckels gehören also zu
// `a = ko-054` und enden bei `b = ko-059`.
const LETZTE_KANTE_IM_DECKEL = { a: "ko-054", b: "ko-059", via: "thema-a" };

describe("JOB 3022 R3 · Fall 1 — der Deckel schneidet, und die Antwort sagt es", () => {
  let graph: Graph;

  beforeAll(async () => {
    const bestand: [string, string[]][] = [];
    for (let i = 0; i < BESTAND_GROSS; i += 1) {
      bestand.push([id(i), i < TRAEGER ? ["thema-a"] : [`einzel-${i}`]]);
    }
    graph = await graphVon(bestand);
  });

  it("totalEdges zählt UNGEDECKELT, edges trägt genau edgeLimit, truncated ist wahr", () => {
    expect(graph.totalEdges).toBe(ERWARTETE_KANTEN); // 7140
    expect(graph.edgeLimit).toBe(DECKEL);
    expect(graph.edges).toHaveLength(DECKEL);
    expect(graph.truncated).toBe(true);
    // Alle 400 Knoten bleiben — der Deckel liegt auf den Kanten, nicht auf dem Bestand.
    expect(graph.nodes).toHaveLength(BESTAND_GROSS);
    // Kein Schlagwort ist ubiquitär: 120/400 = 30 %.
    expect(graph.excludedTags).toEqual([]);
  });

  it("gedeckelt wird NACH der Sortierung — die erste und die letzte Kante stehen fest", () => {
    expect(graph.edges[0]).toEqual({ a: "ko-000", b: "ko-001", via: "thema-a" });
    expect(graph.edges[DECKEL - 1]).toEqual(LETZTE_KANTE_IM_DECKEL);
    // Und keine Kante jenseits davon ist durchgerutscht.
    expect(graph.edges.every((e) => e.a <= LETZTE_KANTE_IM_DECKEL.a)).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// FALL 2 · DIE GRUPPENGRENZE — was der 12.000er-Lasttest ausdrücklich NICHT verspricht
// ------------------------------------------------------------------------------------------------
// 2.000 Objekte, davon tragen 999 dasselbe Schlagwort. 999 von 2.000 sind 49,95 % — knapp UNTER der
// Ubiquitätsschwelle, die Regel greift also gerade nicht mehr.
const GRUPPE = 999;
const BESTAND_GRUPPE = 2_000;
const KANTEN_DER_GRUPPE = (GRUPPE * (GRUPPE - 1)) / 2; // 498501

describe("JOB 3022 R3 · Fall 2 — knapp unter der Ubiquitätsschwelle bleibt es quadratisch", () => {
  it("999 Träger EINES Schlagworts ergeben 498.501 Kanten — ausgeschrieben, nicht nachgerechnet", async () => {
    const bestand: [string, string[]][] = [];
    for (let i = 0; i < BESTAND_GRUPPE; i += 1) {
      bestand.push([`ko-${String(i).padStart(4, "0")}`, i < GRUPPE ? ["breit"] : [`einzel-${i}`]]);
    }
    const graph = await graphVon(bestand);

    // Die Regel greift NICHT: 999/2000 ist nicht mehr als die Hälfte.
    expect(graph.excludedTags).toEqual([]);
    // Genau das ist die Restgrenze: die Arbeit hängt an der GRUPPE, nicht am Bestand. Ein Bestand
    // dieser Form ist vom Leistungsversprechen des 12.000er-Lasttests ausdrücklich ausgenommen
    // (Begründung am Kopf von `graph()`, service.ts).
    expect(graph.totalEdges).toBe(KANTEN_DER_GRUPPE);
    expect(graph.edges).toHaveLength(DECKEL);
    expect(graph.truncated).toBe(true);
  });

  it("EIN Träger mehr kippt dasselbe Schlagwort über die Schwelle — dann gibt es KEINE Kante", async () => {
    // 1.001 von 2.000 sind mehr als die Hälfte: dasselbe Schlagwort erzeugt jetzt gar nichts mehr.
    // Der Sprung von 498.501 Kanten auf 0 ist gewollt und ist die Regel, nicht ein Ausfall.
    const bestand: [string, string[]][] = [];
    for (let i = 0; i < BESTAND_GRUPPE; i += 1) {
      bestand.push([`ko-${String(i).padStart(4, "0")}`, i < 1001 ? ["breit"] : [`einzel-${i}`]]);
    }
    const graph = await graphVon(bestand);

    expect(graph.excludedTags).toEqual(["breit"]);
    expect(graph.totalEdges).toBe(0);
    expect(graph.edges).toEqual([]);
    expect(graph.truncated).toBe(false);
  });
});
