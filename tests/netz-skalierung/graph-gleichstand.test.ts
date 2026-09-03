// ==================================================================================================
// JOB 3022 · GLEICHSTANDSNACHWEIS — derselbe Graph, nur anders gerechnet.
// ==================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD: Der Umbau ersetzt die Paarschleife durch einen
// Schlagwort-Index. Rechnet er dasselbe? Für einen kleinen Bestand OHNE ubiquitäres Schlagwort und
// UNTERHALB des Deckels muss die Kantenmenge (die Menge der verbundenen PAARE) exakt die der alten
// Paarschleife sein — sonst ist der Umbau keine Beschleunigung, sondern eine Verhaltensänderung.
//
// DER VERGLEICHSWERT STEHT AUSGESCHRIEBEN (Auftrag §6). Er zur Laufzeit mit einer zweiten,
// mitgeführten Implementierung zu erzeugen wäre ein Zirkelschluss: zwei Fassungen desselben
// Denkfehlers sind einig, nicht richtig. Die vier Paare unten sind aus dem Bestand von Hand
// abgeleitet und gelten unabhängig von jeder Implementierung.
//
// WAS SICH ABSICHTLICH ÄNDERT — und deshalb hier ebenfalls festgehalten ist: das `via` einer Kante.
// Alt war es das ERSTE geteilte Schlagwort in der Reihenfolge von `a.tags` (also von der
// Einfügereihenfolge abhängig: `ko-1` trägt `["ventil","druck"]`, alt kam „ventil" heraus). Neu ist
// es das lexikografisch KLEINSTE geteilte, nicht-ubiquitäre Schlagwort — „druck". Gleiche Paare,
// stabileres Etikett.
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

// Vier Objekte, vier Schlagwörter, keines davon ubiquitär: bei vier Objekten liegt jeder Träger
// unter UBIQUITY_MIN_COUNT (5) — die Anteilsregel feuert in Kleinstbeständen bewusst nicht.
const BESTAND: [string, string[]][] = [
  ["ko-1", ["ventil", "druck"]],
  ["ko-2", ["druck", "ventil"]],
  ["ko-3", ["pumpe"]],
  ["ko-4", ["pumpe", "ventil"]],
];

// Von Hand abgeleitet: jedes Paar mit mindestens einem geteilten Schlagwort, genau einmal.
//   ko-1/ko-2 teilen druck UND ventil   ko-1/ko-4 teilen ventil
//   ko-2/ko-4 teilen ventil             ko-3/ko-4 teilen pumpe
//   ko-1/ko-3 und ko-2/ko-3 teilen nichts.
const ERWARTETE_PAARE = ["ko-1|ko-2", "ko-1|ko-4", "ko-2|ko-4", "ko-3|ko-4"];

describe("JOB 3022 · Schlagwort-Index und Paarschleife liefern denselben Graphen", () => {
  let graph: Graph;

  beforeAll(async () => {
    const repo = new InMemoryKoRepo();
    for (const [id, tags] of BESTAND) {
      await repo.insert(objekt(id, tags));
    }
    const library = new LibraryService({ koService: new KoService({ repo }) });
    graph = await library.graph({ sichtbar: () => true });
  });

  it("dieselben Paare wie die alte Paarschleife — ausgeschrieben, nicht nachgerechnet", () => {
    const paare = graph.edges.map((e) => `${e.a}|${e.b}`);
    expect(paare).toEqual(ERWARTETE_PAARE);
    expect(graph.totalEdges).toBe(ERWARTETE_PAARE.length);
    expect(graph.truncated).toBe(false);
    expect(graph.excludedTags).toEqual([]);
  });

  it("alle vier Knoten bleiben, deterministisch nach Id sortiert", () => {
    expect(graph.nodes).toEqual([
      { id: "ko-1", title: "Titel ko-1" },
      { id: "ko-2", title: "Titel ko-2" },
      { id: "ko-3", title: "Titel ko-3" },
      { id: "ko-4", title: "Titel ko-4" },
    ]);
  });

  it("`via` ist ab jetzt das lexikografisch kleinste geteilte Schlagwort (alt: das erste in a.tags)", () => {
    // ko-1/ko-2 teilen „druck" und „ventil": alt „ventil" (erstes in ko-1.tags), neu „druck".
    expect(graph.edges.find((e) => e.a === "ko-1" && e.b === "ko-2")?.via).toBe("druck");
    expect(graph.edges.find((e) => e.a === "ko-1" && e.b === "ko-4")?.via).toBe("ventil");
    expect(graph.edges.find((e) => e.a === "ko-3" && e.b === "ko-4")?.via).toBe("pumpe");
  });

  it("zweimal gerechnet ist zweimal dasselbe — Reihenfolge inbegriffen", async () => {
    const repo = new InMemoryKoRepo();
    // Umgekehrte Einfügereihenfolge: das Ergebnis darf davon nicht abhängen.
    for (const [id, tags] of [...BESTAND].reverse()) {
      await repo.insert(objekt(id, tags));
    }
    const zweiter = await new LibraryService({ koService: new KoService({ repo }) }).graph({
      sichtbar: () => true,
    });
    expect(zweiter).toEqual(graph);
  });
});
