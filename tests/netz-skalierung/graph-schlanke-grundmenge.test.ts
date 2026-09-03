// ==================================================================================================
// JOB 3022 R3 · DER GRAPH ZIEHT KEINEN BODY MEHR DURCH DEN SPEICHER — am Aufruf gemessen.
// ==================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST (Prüfer BEN, Runde 2, Prüflücke b): Lieferung 5 des Auftrags
// verlangt, dass `graph()` die schlanke Such-Projektion nimmt (`listForSearch()`, ohne `bodyHtml`)
// statt des vollen Bestands (`list()`). Belegt war das bis hierher nur durch Hinsehen im Quelltext.
// Ein Rückfall auf `list()` wäre in JEDEM anderen Test unsichtbar geblieben: das Ergebnis ist
// identisch, nur die geladene Datenmenge nicht — und genau die ist der Auftragsgegenstand.
//
// GEMESSEN WIRD AM ECHTEN DIENST, nicht an einer Attrappe: die beiden Methoden des echten
// `KoService` werden umhüllt und gezählt, der darunterliegende Aufruf läuft unverändert weiter.
// Damit prüft der Fall den Aufrufweg UND das Ergebnis in einem Lauf.
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

function objekt(id: string, tags: string[]): KnowledgeObject {
  return {
    id,
    title: `Titel ${id}`,
    statement: `Kurzfassung ${id}.`,
    // Der Körper ist der Punkt: er darf für den Graphen gar nicht erst geladen werden.
    bodyHtml: `<p>Ein langer Fließtext für ${id}.</p>`,
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

describe("JOB 3022 R3 · graph() nimmt die schlanke Grundmenge", () => {
  it("ruft listForSearch() genau einmal und list() NIE", async () => {
    const repo = new InMemoryKoRepo();
    for (const [id, tags] of [
      ["ko-1", ["ventil"]],
      ["ko-2", ["ventil"]],
      ["ko-3", ["pumpe"]],
    ] as [string, string[]][]) {
      await repo.insert(objekt(id, tags));
    }
    const koService = new KoService({ repo });

    let listAufrufe = 0;
    let suchAufrufe = 0;
    const echtesList = koService.list.bind(koService);
    const echtesListForSearch = koService.listForSearch.bind(koService);
    koService.list = ((filter, trim) => {
      listAufrufe += 1;
      return echtesList(filter, trim);
    }) as typeof koService.list;
    koService.listForSearch = ((filter, trim) => {
      suchAufrufe += 1;
      return echtesListForSearch(filter, trim);
    }) as typeof koService.listForSearch;

    const graph = await new LibraryService({ koService }).graph({ sichtbar: () => true });

    expect(
      listAufrufe,
      "graph() darf den vollen Bestand (mit bodyHtml) nicht mehr laden — Lieferung 5.",
    ).toBe(0);
    expect(suchAufrufe).toBe(1);
    // Und die Auskunft stimmt trotzdem: die schlanke Projektion trägt id, title und tags.
    expect(graph.nodes).toEqual([
      { id: "ko-1", title: "Titel ko-1" },
      { id: "ko-2", title: "Titel ko-2" },
      { id: "ko-3", title: "Titel ko-3" },
    ]);
    expect(graph.edges).toEqual([{ a: "ko-1", b: "ko-2", via: "ventil" }]);
  });
});
