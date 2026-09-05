// ================================================================================================
// JOB 3075 · P12 — EINE THEMENACHSE IM GANZEN HAUS: DIE GRAPH-ANSICHT RECHNET WIE DIE THEMENKARTE.
// ================================================================================================
//
// DER AUSGANGSFEHLER, am Bestand gemessen und nicht vermutet: KLARWERK zeigt sein Wissensnetz auf
// ZWEI Flaechen, und bis zu diesem Auftrag sprachen sie ueber verschiedene Dinge.
//
//     ko-a = { tags: ["   "] }
//     ko-b = { tags: ["   "] }
//       -> `LibraryService.graph()`  gab EINE Kante `{ a: "ko-a", b: "ko-b", via: "   " }`
//       -> `themenVon(ko)`           gab fuer beide die LEERE Themenliste
//
// Auf `/graph` stand damit eine graue Linie zwischen zwei Wissensobjekten, deren Beschriftung LEER
// ist (`apps/web/src/pages/Stufe2.tsx`, `<title>{e.via}</title>`) — eine Verbindung ohne Auskunft,
// warum sie besteht. Auf `/wissensnetz` hatten dieselben zwei Objekte gar kein gemeinsames Thema.
//
// DIE URSACHE war eine ZWEITE Ableitung: `graph()` bildete seine Traegergruppen und seine
// kantenfaehigen Schlagworte unmittelbar aus `ko.tags`, ohne die Regel zu kennen, welche
// Schlagworte ueberhaupt Themen sind. Diese Regel steht seit JOB 3073 an genau EINER Stelle
// (`services/wissensnetz/src/themenkarte.ts`, `themenVon`).
//
// DIESE DATEI IST DER RED-FIRST-VERTRAG DES AUFTRAGS (§6). Sie misst am DIENST, weil dort die
// Kante entsteht; die Zeichenregel der Oberflaeche aendert sich nicht und wird deshalb hier auch
// nicht gemessen.
//
//   G1  die namenlose Kante verschwindet
//   G2  Gleichstand mit `themenVon`, in BEIDE Richtungen: das Leere faellt weg, das
//       Rand-Leerzeichen bleibt ein eigenes Thema
//   G3  ABLOESUNG: in `graph()` steht keine unmittelbare `ko.tags`-Ableitung mehr
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { type Graph, LibraryService } from "../../services/library-analytics";
import { themenVon } from "../../services/wissensnetz";

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
    createdAt: "2026-09-05T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  };
}

async function graphVon(bestand: readonly (readonly [string, string[]])[]): Promise<Graph> {
  const repo = new InMemoryKoRepo();
  for (const [id, tags] of bestand) {
    await repo.insert(objekt(id, tags));
  }
  return new LibraryService({ koService: new KoService({ repo }) }).graph({ sichtbar: () => true });
}

// ------------------------------------------------------------------------------------------------
// G1 · DIE NAMENLOSE KANTE
// ------------------------------------------------------------------------------------------------
describe("JOB 3075 · G1 — eine Kante ohne Namen ist eine Behauptung ohne Beleg", () => {
  it("zwei Objekte, deren einziges gemeinsames Schlagwort nur aus Leerzeichen besteht, sind NICHT verbunden", async () => {
    const graph = await graphVon([
      ["ko-a", ["   "]],
      ["ko-b", ["   "]],
    ]);

    // Kalibrierung: die Objekte selbst bleiben — der Auftrag entfernt eine Kante, keinen Knoten.
    expect(graph.nodes).toEqual([
      { id: "ko-a", title: "Titel ko-a" },
      { id: "ko-b", title: "Titel ko-b" },
    ]);

    // VORHER stand hier genau eine Kante `{ a: "ko-a", b: "ko-b", via: "   " }`.
    expect(graph.edges).toEqual([]);
    expect(graph.totalEdges).toBe(0);
    expect(graph.truncated).toBe(false);
    // Und nichts Nameloses geht auf einem anderen Feld hinaus: `excludedTags` entsteht aus
    // derselben Ableitung.
    expect(graph.excludedTags).toEqual([]);
  });

  it("KALIBRIERUNG: dieselben zwei Objekte mit einem BENANNTEN Schlagwort sind sehr wohl verbunden", async () => {
    const graph = await graphVon([
      ["ko-a", ["druck"]],
      ["ko-b", ["druck"]],
    ]);
    expect(graph.edges).toEqual([{ a: "ko-a", b: "ko-b", via: "druck" }]);
  });
});

// ------------------------------------------------------------------------------------------------
// G2 · GLEICHSTAND MIT `themenVon` — IN BEIDE RICHTUNGEN
// ------------------------------------------------------------------------------------------------
// Der Bestand traegt die vier Faelle nebeneinander: ein gewoehnliches Schlagwort, ein doppelt
// eingetragenes, ein leeres bzw. nur aus Leerzeichen bestehendes, und `" Dichtungen "` mit
// Rand-Leerzeichen NEBEN `"Dichtungen"`.
//
// GEMESSEN WIRD MIT SONDEN: zu jedem ROHEN Schlagwort des Hauptobjekts steht ein Objekt im
// Bestand, das GENAU DIESES eine Schlagwort traegt und sonst nichts. Eine Kante zwischen dem
// Hauptobjekt und einer Sonde entsteht also genau dann, wenn `graph()` an diesem Schlagwort
// ueberhaupt eine Kante bilden kann — und ihr `via` nennt es beim Namen, denn die beiden teilen
// nur dieses eine.
const ROH_HAUPT = ["Ventile", "Ventile", "", "   ", " Dichtungen ", "Dichtungen"];
/** Die ROHEN Schlagworte in erster Nennung — jedes bekommt seine Sonde. */
const SONDEN: readonly string[] = ["Ventile", "", "   ", " Dichtungen ", "Dichtungen"];
const sondeId = (i: number) => `sonde-${i}`;

// AUSGESCHRIEBEN, nicht nachgerechnet: welche Sonde das Hauptobjekt erreicht und unter welchem
// Namen. `""` und `"   "` haben keinen Namen und fehlen deshalb; `" Dichtungen "` und
// `"Dichtungen"` sind ZWEI Themen und stehen beide da (JOB 3073 Runde 2, ausdruecklich in Kauf
// genommen). Ein nachtraeglich eingebauter Trimm faende hier drei Kanten unter zwei Namen.
const ERWARTETE_KANTEN_AM_HAUPT = [
  "sonde-0|Ventile",
  "sonde-3| Dichtungen ",
  "sonde-4|Dichtungen",
].sort();

describe("JOB 3075 · G2 — die kantenfaehigen Schlagworte sind GENAU `themenVon(ko)`", () => {
  it("das Leere faellt weg, das Rand-Leerzeichen bleibt — beide Richtungen in einem Bestand", async () => {
    const bestand: (readonly [string, string[]])[] = [["ko-haupt", [...ROH_HAUPT]]];
    SONDEN.forEach((tag, i) => bestand.push([sondeId(i), [tag]]));
    const graph = await graphVon(bestand);

    // Kalibrierung des Bestands: die Ubiquitaetsregel greift hier nicht (hoechstens zwei Traeger
    // je Schlagwort, UBIQUITY_MIN_COUNT ist 5) — der Negativbefund unten kommt also nicht daher.
    expect(graph.excludedTags).toEqual([]);
    expect(graph.nodes).toHaveLength(1 + SONDEN.length);

    const amHaupt = graph.edges
      .filter((e) => e.a === "ko-haupt" || e.b === "ko-haupt")
      .map((e) => `${e.a === "ko-haupt" ? e.b : e.a}|${e.via}`)
      .sort();
    expect(amHaupt).toEqual(ERWARTETE_KANTEN_AM_HAUPT);

    // Dasselbe noch einmal gegen die EINE Achse selbst: die Menge der Namen, unter denen das
    // Hauptobjekt ueberhaupt verbunden ist, ist die Menge seiner Themen — kein Wert mehr, keiner
    // weniger. Doppelt eingetragene Schlagworte erzeugen dabei keine doppelte Kante.
    const namen = [...new Set(amHaupt.map((z) => z.slice(z.indexOf("|") + 1)))].sort();
    const themen = [...themenVon({ id: "ko-haupt", tags: ROH_HAUPT })].sort();
    expect(namen).toEqual(themen);
    expect(themen, "das Rand-Leerzeichen ist ein EIGENES Thema").toContain(" Dichtungen ");
    expect(themen).toContain("Dichtungen");
    expect(themen, "ohne sichtbares Zeichen kein Thema").not.toContain("   ");
    expect(themen).not.toContain("");

    // Die Sonden untereinander teilen nichts: alle Kanten des Bestands haengen am Hauptobjekt.
    expect(graph.totalEdges).toBe(ERWARTETE_KANTEN_AM_HAUPT.length);
  });

  it("objektweise, fuer JEDES Objekt des Bestands: verbunden nur ueber die eigenen Themen", async () => {
    const bestand: (readonly [string, string[]])[] = [["ko-haupt", [...ROH_HAUPT]]];
    SONDEN.forEach((tag, i) => bestand.push([sondeId(i), [tag]]));
    const graph = await graphVon(bestand);

    // Jedes Thema jedes Objekts hat in diesem Bestand einen Partner (das ist die Bauart der
    // Sonden). Die Gleichheit gilt deshalb objektweise und in beide Richtungen: kein Name, der
    // kein Thema ist, und kein Thema, das keine Kante bekommt.
    for (const [id, tags] of bestand) {
      const namen = [
        ...new Set(graph.edges.filter((e) => e.a === id || e.b === id).map((e) => e.via)),
      ].sort();
      const themen = [...themenVon({ id, tags })].sort();
      expect(namen, `${id}: verbunden ueber ${JSON.stringify(namen)}`).toEqual(themen);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// G3 · ABLOESUNGSWAECHTER — der alte Weg muss WEG sein, nicht danebenliegen
// ------------------------------------------------------------------------------------------------
// Nach dem Vorbild von `tests/capture/aufrufer-waechter.test.ts` und `eine-achse.test.ts` (A8):
// gelesen wird der Quelltext. Ein zweiter Zerleger irgendwo im Baum ist genau der Zustand, den
// dieser Auftrag abloest — und er waere durch kein Ergebnis dieses Bestands zu sehen, solange
// niemand zufaellig ein namenloses Schlagwort fuehrt.
const SERVICE = "services/library-analytics/src/service.ts";

/** Der Rumpf von `graph()` — Klammern gezaehlt, Zeilenkommentare vorher entfernt. */
function graphRumpf(quelltext: string): string {
  const kopf = quelltext.indexOf("async graph(");
  expect(kopf, `${SERVICE}: die Methode graph() steht dort`).toBeGreaterThan(-1);
  const auf = quelltext.indexOf("{", quelltext.indexOf(")", kopf));
  let tiefe = 0;
  for (let i = auf; i < quelltext.length; i += 1) {
    const zeichen = quelltext[i];
    if (zeichen === "/" && quelltext[i + 1] === "/") {
      // Ein Kommentar darf ueber den alten Weg reden (Lieferung 4) — gezaehlt wird er nicht.
      const ende = quelltext.indexOf("\n", i);
      i = ende === -1 ? quelltext.length : ende;
      continue;
    }
    if (zeichen === "{") {
      tiefe += 1;
    } else if (zeichen === "}") {
      tiefe -= 1;
      if (tiefe === 0) {
        return quelltext.slice(auf, i + 1);
      }
    }
  }
  throw new Error(`${SERVICE}: der Rumpf von graph() ist nicht geschlossen`);
}

describe("JOB 3075 · G3 — in `graph()` gibt es keine zweite Themenableitung mehr", () => {
  const quelltext = readFileSync(resolve(process.cwd(), SERVICE), "utf8");

  it("der Rumpf leitet Themen ueber die importierte Funktion ab und nicht mehr aus `ko.tags`", () => {
    const rumpf = graphRumpf(quelltext);

    // Kalibrierung: der Rumpf ist wirklich der von `graph()` und nicht ein leerer Schnipsel.
    expect(rumpf).toContain("carriers");
    expect(rumpf).toContain("excludedTags");

    // VORHER standen hier ZWEI unmittelbare Ableitungen: `new Set(ko.tags)` fuer die
    // Traegergruppen und `[...new Set(ko.tags)]` fuer die kantenfaehigen Schlagworte.
    const rohe = rumpf.split("\n").filter((z) => /\.tags\b/.test(z));
    expect(rohe, `unmittelbare Schlagwortlesung: ${JSON.stringify(rohe)}`).toEqual([]);

    expect(rumpf, "die EINE Achse wird gerufen").toContain("themenVon(");
  });

  it("und sie ist IMPORTIERT, nicht kopiert — es bleibt bei einer Definition", () => {
    // Auf die gefundene Importzeile eingegrenzt: die ganze Datei in die Fehlermeldung zu kippen
    // sagt dem Leser nichts.
    const importzeile =
      quelltext.match(/import\s*\{[^}]*\}\s*from\s*"\.\.\/\.\.\/wissensnetz";/)?.[0] ??
      "kein Import aus ../../wissensnetz";
    expect(importzeile, "der Import steht da und holt genau diese Funktion").toContain("themenVon");
    expect(
      quelltext.split("\n").filter((z) => /function\s+themenVon\b/.test(z)),
      "keine zweite Definition in dieser Datei",
    ).toEqual([]);
  });
});
