// ==================================================================================================
// JOB 3022 · LIEFERUNG 1 — DER GRAPH BEI ZWÖLFTAUSEND OBJEKTEN, AN DER UHR GEMESSEN.
// ==================================================================================================
//
// WAS DIESER TEST BEWEIST: `graph()` rechnet nicht mehr über PAARE. Bis JOB 3022 lief die Methode
// zwei ineinandergelegte Schleifen über den ganzen Bestand (service.ts, `for i` × `for j`) und
// verglich für jedes Paar die Schlagwortlisten — bei 12.000 Objekten sind das ~72 Mio. Paare in
// EINER Antwort. Gemessen mit DIESER Datei, gleicher Bestand, gleicher Rechner:
//     vor dem Umbau (Paarschleife, `list()` mit bodyHtml)   10.817 ms   → Zeitgrenze gerissen
//     nach dem Umbau (Schlagwort-Index, `listForSearch()`)     219 ms
//
// WARUM DER BESTAND DIREKT IN DAS REPO GESCHRIEBEN WIRD und nicht über `KoService.create`: gemessen
// wird die AUSKUNFT, nicht der Schreibpfad. 12.000 Anlagen über den vollen Schreibpfad (Historie,
// Projektion, Audit) kosteten ein Vielfaches der Messgröße und machten das Ergebnis unlesbar.
//
// DIE SCHLAGWORTVERTEILUNG IST DIE DES DEMOBESTANDS, nicht die günstigste: jedes Objekt trägt den
// allgegenwärtigen Import-Marker `pilot-demo` (auf ALLEN 12.000 — genau der Befund, gegen den die
// Ubiquitätsregel steht) sowie zwei echte Schlagwörter aus zwei Vorräten. Die Gruppen sind damit
// klein (15 bzw. 30 Träger), und Kanten entstehen nur INNERHALB einer Gruppe — das ist der
// Unterschied zwischen „quadratisch im Bestand" und „quadratisch in der Gruppe".
//
// DIE ZEITGRENZE (GRAPH_BUDGET_MS) ist bewusst großzügig: sie soll den KLASSENUNTERSCHIED zeigen
// (Sekunden statt Minuten) und nicht die Tagesform des geteilten Rechners messen. Ein Wächter, der
// bei jeder fremden Last rot wird, wird abgeschaltet.
//
// WORAUF SICH DIESE ZUSAGE BEZIEHT — UND WORAUF AUSDRÜCKLICH NICHT (JOB 3022 R3, Prüfer BEN):
// gemessen wird die HIER beschriebene realistische Verteilung: wenige Schlagwörter je Objekt,
// Gruppen von 15 bzw. 30 Trägern. Kanten entstehen nur innerhalb einer Gruppe, und die Kantenzahl
// wächst mit dem QUADRAT der Gruppengröße — ein Bestand, in dem EIN Schlagwort knapp unter der
// Ubiquitätsschwelle fast die Hälfte aller Objekte trägt, ist von dieser Zusage NICHT gedeckt. Was
// dort geschieht, ist ausgeschrieben in `graph-deckel-und-gruppengrenze.test.ts` (Fall 2): 999
// Träger eines Schlagworts ergeben 498.501 Kanten. Diese Datei verspricht nichts über ihn.
import { beforeAll, describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

const BESTAND = 12_000;
const GRAPH_BUDGET_MS = 5_000;

// Zwei Vorräte echter Schlagwörter: 800 Themen (15 Träger je Thema) und 400 Anlagen (30 Träger je
// Anlage). Beide liegen weit unter der Ubiquitätsschwelle, erzeugen also echte Kanten.
const THEMEN = 800;
const ANLAGEN = 400;

function testObjekt(i: number): KnowledgeObject {
  const id = `ko-${String(i).padStart(5, "0")}`;
  return {
    id,
    title: `Wissensobjekt ${i}`,
    statement: `Kurzfassung ${i}.`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: `Anlage ${i % ANLAGEN}`,
    tags: ["pilot-demo", `thema-${i % THEMEN}`, `anlage-${i % ANLAGEN}`],
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

describe("JOB 3022 · der Wissensnetz-Graph trägt zwölftausend Objekte", () => {
  let library: LibraryService;

  beforeAll(async () => {
    const repo = new InMemoryKoRepo();
    for (let i = 0; i < BESTAND; i += 1) {
      await repo.insert(testObjekt(i));
    }
    library = new LibraryService({ koService: new KoService({ repo }) });
  });

  it(`antwortet bei ${BESTAND} Objekten unter ${GRAPH_BUDGET_MS} ms`, async () => {
    const start = performance.now();
    const graph = await library.graph({ sichtbar: () => true });
    const dauer = performance.now() - start;

    // Der Bestand ist wirklich angekommen — sonst misst die Uhr eine leere Antwort.
    expect(graph.nodes).toHaveLength(BESTAND);
    expect(
      dauer,
      `graph() brauchte ${Math.round(dauer)} ms für ${BESTAND} Objekte — die Paarrechnung ist zurück oder der Schlagwort-Index greift nicht.`,
    ).toBeLessThan(GRAPH_BUDGET_MS);
  });

  it("der allgegenwärtige Marker erzeugt keine Kante und steht in excludedTags", async () => {
    const graph = await library.graph({ sichtbar: () => true });

    expect(graph.excludedTags).toContain("pilot-demo");
    expect(graph.edges.some((e) => e.via === "pilot-demo")).toBe(false);
    // Echte Schlagwörter tragen weiterhin Kanten — der Filter deckelt nicht den ganzen Graphen.
    expect(graph.totalEdges).toBeGreaterThan(0);
    expect(graph.edges.length).toBeLessThanOrEqual(graph.edgeLimit);
    expect(graph.truncated).toBe(graph.totalEdges > graph.edges.length);
  });
});
