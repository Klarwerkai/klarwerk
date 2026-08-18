// ================================================================================================
// JOB 1042 · D3 — DIE ELTERNKETTE BRAUCHT EINE IDENTITÄT, NICHT NUR EINEN NAMEN
// ================================================================================================
//
// DER BEFUND AUS DEM VOLLURTEIL (`BEN-PRUEFUNG-JOB-1042-D2.md:48-50`): „Der tatsächliche
// Informationsverlust liegt im Mapper: Vorfahren-IDs verschwinden, Titel bleiben. Aus Titeln allein
// lassen sich gleichnamige Ordner, Umbenennungen und stabile Elternbezüge nicht sicher behandeln."
//
// AN DER BASE 9208d494 NACHGEMESSEN — und die Nachmessung verschiebt den Schwerpunkt:
//   · `rest-client.ts:43` fordert `ancestors` MIT `id` an. Die ID kommt an. Kein Bau nötig.
//   · `mapper.ts:46-54` (`confluenceSourcePath`) projiziert ausschliesslich `ancestor.title`.
//     **Hier** geht die Identität verloren, und nur hier.
//   · Die TITEL-Kette ist danach vollständig gebaut und dicht getestet: `toPreviewEntry`
//     (`select.ts:281`), `folderTree`, Dreizustand, Demo-Bestand — `tests/app/import-folder-tree.test.ts`
//     hält 14 Fälle. Sie wird hier NICHT angefasst.
//   · Die Anzeige-Schlüssel-Kollision („A/B" neben „A"→„B") ist bereits geschlossen und gepinnt
//     (`tests/app/import-folder-key-collision.test.tsx`, mega28 B). Auch sie wird nicht neu gebaut.
//
// WAS DAMIT WIRKLICH OFFEN IST — und was diese Datei misst: Ein Titel ist kein Anker. Confluence
// erzwingt Titel-Eindeutigkeit je Space, gleichnamige Geschwister sind also gar nicht der Fall.
// Der Fall ist die **UMBENENNUNG**: dieselbe Seite, derselbe Elternteil, neuer Name — und der
// Import kann nicht erkennen, dass es derselbe Ordner ist.
//
// ================================================================================================
// WAS DIESE DATEI AUSDRÜCKLICH NICHT ENTSCHEIDET.
// ================================================================================================
// Korrekturpflicht 1 des Urteils ist eine OWNERFRAGE: „Owner entscheidet Geschwisterordnungsquelle
// beziehungsweise bewussten Verzicht und die **fail-closed Regel für fehlende IDs**."
//
// Deshalb trennt diese Datei strikt zwischen BEFUND und REAKTION. Gebaut wird ein Baumleser, der
// einen Mangel BENENNT. Was der Import daraufhin tut — abbrechen, überspringen, auf Titel
// zurückfallen —, bleibt unentschieden, und ein eigener Fall (`R1`) pinnt, dass der Import sein
// heutiges Verhalten UNVERÄNDERT behält. Ohne diesen Fall hätte ich Pedi die Entscheidung
// abgenommen, indem ich einfach eine gewählt hätte.
//
// Ebenso bleibt `ordinal` (Geschwisterposition) leer: `ancestors` trägt keine Position, und sie
// darf weder aus der Antwortreihenfolge noch aus einer Titelsortierung erfunden werden
// (Urteil, Hinweise Z. 267-268). `O1` pinnt die ABWESENHEIT als Absicht.
import { describe, expect, it } from "vitest";
import {
  type ConfluenceAhnenBefund,
  confluenceAhnenBefund,
  confluenceAncestorIds,
  confluenceSourcePath,
  mapConfluencePageToImportItem,
} from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

function seite(
  id: string,
  title: string,
  ancestors?: { id?: string; title?: string }[],
): ConfluencePage {
  return {
    id,
    title,
    ...(ancestors ? { ancestors } : {}),
    body: { storage: { value: `<p>Inhalt ${title}</p>` } },
  };
}

// ------------------------------------------------------------------------------------------------
describe("JOB1042 D3 · H — die stabile Ahnenkette", () => {
  it("H1: die Vorfahren-IDs kommen in Quell-Reihenfolge heraus, Wurzel zuerst, ohne die Seite selbst", () => {
    const page = seite("500", "Pumpe warten", [
      { id: "100", title: "Handbuch" },
      { id: "200", title: "Instandhaltung" },
    ]);
    // Der Titelpfad bleibt UNVERÄNDERT — die IDs treten NEBEN ihn, nicht an seine Stelle.
    expect(confluenceSourcePath(page)).toEqual(["Handbuch", "Instandhaltung"]);
    expect(confluenceAncestorIds(page)).toEqual(["100", "200"]);
  });

  it("H2 · DER EIGENTLICHE FALL: nach einer Umbenennung ändert sich der Titelpfad, die Kette nicht", () => {
    // Dieselbe Confluence-Seite, derselbe Elternteil — nur umbenannt. Genau der Fall, den das
    // Urteil unter „Umbenennung" führt und den ein Titelpfad strukturell nicht überstehen kann.
    const vorher = seite("500", "Pumpe warten", [{ id: "100", title: "Handbuch" }]);
    const nachher = seite("500", "Pumpe warten", [{ id: "100", title: "Handbuch (alt)" }]);

    // Der Titelpfad sagt: zwei verschiedene Ordner. Das ist der Schaden.
    expect(confluenceSourcePath(vorher)).not.toEqual(confluenceSourcePath(nachher));
    // Die ID-Kette sagt die Wahrheit: derselbe Elternteil.
    expect(confluenceAncestorIds(vorher)).toEqual(confluenceAncestorIds(nachher));
    expect(confluenceAncestorIds(nachher)).toEqual(["100"]);
  });

  it("H3 · KEIN FELD OHNE ERZEUGER: ohne Ahnen gibt es keine Kette — kein leeres Array", () => {
    // Dieselbe Regel wie bei `confluenceSourcePath` (mapper.ts:42-45): eine Wurzelseite bekommt
    // nichts angedichtet.
    expect(confluenceAncestorIds(seite("500", "Wurzelseite"))).toBeUndefined();
    expect(confluenceAncestorIds(seite("500", "Wurzelseite", []))).toBeUndefined();
  });

  it("H4 · TIEFE: sie ist die Länge der Kette und wird nicht getrennt erfunden", () => {
    // Das Urteil verlangt Tiefe als Zielangabe (Korrekturpflicht 2). Sie braucht kein eigenes Feld:
    // sie IST die Kettenlänge. Ein zweites Feld wäre eine zweite Wahrheit, die auseinanderlaufen kann.
    expect(confluenceAncestorIds(seite("9", "A", [{ id: "1", title: "R" }]))?.length).toBe(1);
    expect(
      confluenceAncestorIds(
        seite("9", "A", [
          { id: "1", title: "R" },
          { id: "2", title: "M" },
          { id: "3", title: "U" },
        ]),
      )?.length,
    ).toBe(3);
    expect(confluenceAncestorIds(seite("9", "A"))).toBeUndefined(); // Tiefe 0 = keine Kette
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1042 D3 · N — die Negativmatrix: der Baumleser BENENNT, er entscheidet nicht", () => {
  const faelle: { name: string; page: ConfluencePage; erwartet: ConfluenceAhnenBefund }[] = [
    {
      name: "sauberer Fall",
      page: seite("500", "S", [
        { id: "100", title: "A" },
        { id: "200", title: "B" },
      ]),
      erwartet: "ok",
    },
    {
      name: "Wurzelseite ohne Ahnen ist KEIN Mangel",
      page: seite("500", "S"),
      erwartet: "ok",
    },
    {
      name: "ein Ahne ohne ID",
      page: seite("500", "S", [{ id: "100", title: "A" }, { title: "B" }]),
      erwartet: "fehlende-id",
    },
    {
      name: "ein Ahne mit leerer ID",
      page: seite("500", "S", [{ id: "   ", title: "A" }]),
      erwartet: "fehlende-id",
    },
    {
      name: "die Seite ist ihr eigener Vorfahr",
      page: seite("500", "S", [
        { id: "100", title: "A" },
        { id: "500", title: "S" },
      ]),
      erwartet: "zyklus",
    },
    {
      name: "ein Vorfahr kommt in derselben Kette zweimal vor",
      page: seite("500", "S", [
        { id: "100", title: "A" },
        { id: "200", title: "B" },
        { id: "100", title: "A" },
      ]),
      erwartet: "zyklus",
    },
  ];

  for (const fall of faelle) {
    it(`N · ${fall.name} ⇒ ${fall.erwartet}`, () => {
      expect(confluenceAhnenBefund(fall.page)).toBe(fall.erwartet);
    });
  }

  it("N7 · FAIL-CLOSED AUF DER KETTE (nicht auf dem Import): eine lückenhafte Kette ist KEINE Kette", () => {
    // Eine TEILWEISE ID-Kette wäre schlimmer als gar keine: `ancestors` hat drei Glieder, die IDs
    // nur zwei — jede Zuordnung zwischen Titel und ID wäre ab dem Loch verschoben. Deshalb liefert
    // die Funktion in diesem Fall `undefined` statt einer verkürzten Kette.
    //
    // DAS IST KEINE VORWEGNAHME DER OWNERFRAGE: entschieden wird hier nur, dass eine unvollständige
    // Kette nicht als vollständige ausgegeben wird. Ob der IMPORT deshalb abbricht, überspringt oder
    // auf Titel zurückfällt, bleibt offen (s. R1).
    const lueckig = seite("500", "S", [
      { id: "100", title: "A" },
      { title: "B" },
      { id: "300", title: "C" },
    ]);
    expect(confluenceSourcePath(lueckig)).toEqual(["A", "B", "C"]); // Titel: unverändert vollständig
    expect(confluenceAncestorIds(lueckig)).toBeUndefined(); // Identität: ehrlich nicht verfügbar
    expect(confluenceAhnenBefund(lueckig)).toBe("fehlende-id");
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1042 D3 · B — die Baumtabellen B1–B3 aus dem Urteil, vollständig", () => {
  // Das Urteil verlangt „vollständige Node-/Edge-/Ordinal-/Tiefentabellen" (Prüflücke 3) und
  // bestätigt die Seitenzahlen: B1 = 3, B2 = 5, B3 = 7 aus `1 + 2 + 3 + 1`.
  //
  // ORDINAL BLEIBT LEER — und zwar sichtbar, s. O1. Die Tabellen führen Knoten, Kanten und Tiefe.

  /** Aus einer Seitenmenge die Kantenliste (Kind → direkter Elternteil) über IDs. */
  function kanten(pages: ConfluencePage[]): { kind: string; elternteil: string }[] {
    const out: { kind: string; elternteil: string }[] = [];
    for (const page of pages) {
      const kette = confluenceAncestorIds(page);
      const elternteil = kette?.[kette.length - 1];
      if (elternteil !== undefined) {
        out.push({ kind: page.id, elternteil });
      }
    }
    return out;
  }

  /** Tiefe je Seite = Länge der Ahnenkette. */
  function tiefen(pages: ConfluencePage[]): Record<string, number> {
    return Object.fromEntries(pages.map((p) => [p.id, confluenceAncestorIds(p)?.length ?? 0]));
  }

  const R = { id: "1", title: "Raum" };

  // B1 — flach: eine Wurzel, zwei Kinder.
  const B1: ConfluencePage[] = [
    seite("1", "Raum"),
    seite("2", "Kind A", [R]),
    seite("3", "Kind B", [R]),
  ];

  // B2 — zwei Ebenen: Wurzel, zwei Kinder, zwei Enkel unter demselben Kind.
  const B2: ConfluencePage[] = [
    seite("1", "Raum"),
    seite("2", "Kind A", [R]),
    seite("3", "Kind B", [R]),
    seite("4", "Enkel A1", [R, { id: "2", title: "Kind A" }]),
    seite("5", "Enkel A2", [R, { id: "2", title: "Kind A" }]),
  ];

  // B3 — 1 + 2 + 3 + 1 = 7 Seiten, vier Ebenen.
  const B3: ConfluencePage[] = [
    seite("1", "Raum"),
    seite("2", "Kind A", [R]),
    seite("3", "Kind B", [R]),
    seite("4", "Enkel A1", [R, { id: "2", title: "Kind A" }]),
    seite("5", "Enkel A2", [R, { id: "2", title: "Kind A" }]),
    seite("6", "Enkel B1", [R, { id: "3", title: "Kind B" }]),
    seite("7", "Urenkel", [R, { id: "2", title: "Kind A" }, { id: "4", title: "Enkel A1" }]),
  ];

  it("B1 · 3 Knoten, 2 Kanten, Tiefen 0/1/1", () => {
    expect(B1).toHaveLength(3);
    expect(kanten(B1)).toEqual([
      { kind: "2", elternteil: "1" },
      { kind: "3", elternteil: "1" },
    ]);
    expect(tiefen(B1)).toEqual({ "1": 0, "2": 1, "3": 1 });
  });

  it("B2 · 5 Knoten, 4 Kanten, Tiefen 0/1/1/2/2", () => {
    expect(B2).toHaveLength(5);
    expect(kanten(B2)).toEqual([
      { kind: "2", elternteil: "1" },
      { kind: "3", elternteil: "1" },
      { kind: "4", elternteil: "2" },
      { kind: "5", elternteil: "2" },
    ]);
    expect(tiefen(B2)).toEqual({ "1": 0, "2": 1, "3": 1, "4": 2, "5": 2 });
  });

  it("B3 · 7 Knoten (1+2+3+1), 6 Kanten, Tiefen bis 3", () => {
    expect(B3).toHaveLength(7);
    expect(kanten(B3)).toEqual([
      { kind: "2", elternteil: "1" },
      { kind: "3", elternteil: "1" },
      { kind: "4", elternteil: "2" },
      { kind: "5", elternteil: "2" },
      { kind: "6", elternteil: "3" },
      { kind: "7", elternteil: "4" },
    ]);
    expect(tiefen(B3)).toEqual({ "1": 0, "2": 1, "3": 1, "4": 2, "5": 2, "6": 2, "7": 3 });
    // Jede Seite ausser der Wurzel hat genau eine Kante — ein Baum, kein Graph.
    expect(kanten(B3)).toHaveLength(B3.length - 1);
    expect(B3.every((p) => confluenceAhnenBefund(p) === "ok")).toBe(true);
  });

  it("B3 · GEGENPROBE zur Titelkette: sie liefert für denselben Baum dieselben Tiefen", () => {
    // Ohne diesen Fall wäre nicht belegt, dass die ID-Kette den bestehenden Titelweg abbildet und
    // nicht danebenläuft. Beide Ketten müssen gleich LANG sein — sie beschreiben denselben Baum.
    for (const page of B3) {
      expect(confluenceAncestorIds(page)?.length ?? 0).toBe(
        confluenceSourcePath(page)?.length ?? 0,
      );
    }
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1042 D3 · O/R — was ausdrücklich OFFEN bleibt", () => {
  it("O1 · ORDINAL: `ancestors` trägt keine Geschwisterposition — sie wird NICHT erfunden", () => {
    // Das Urteil (Hinweise Z. 267-268): „Wenn der vorhandene Endpoint keine Position liefert, darf
    // `ordinal` weder aus Antwortreihenfolge noch aus Titelsortierung erfunden werden."
    // Dieser Fall pinnt die ABWESENHEIT als Absicht: der Antworttyp trägt je Ahne genau zwei Felder.
    const page = seite("500", "S", [{ id: "100", title: "A" }]);
    const ahne = page.ancestors?.[0] as Record<string, unknown>;
    expect(Object.keys(ahne).sort()).toEqual(["id", "title"]);
    // Und nichts im Mapper-Ergebnis behauptet eine Reihenfolge unter Geschwistern.
    const item = mapConfluencePageToImportItem(page, OPTS) as unknown as Record<string, unknown>;
    for (const feld of ["ordinal", "position", "sortKey", "siblingIndex"]) {
      expect(Object.hasOwn(item, feld), `Feld ${feld} darf nicht existieren`).toBe(false);
    }
  });

  it("R1 · DIE OWNERFRAGE BLEIBT OFFEN: ein Mangel ändert das Import-Ergebnis heute NICHT", () => {
    // Korrekturpflicht 1: „Owner entscheidet … die fail-closed Regel für fehlende IDs." Solange die
    // Entscheidung aussteht, darf der Befund KEINE Wirkung haben — sonst hätte ich sie getroffen.
    //
    // Gemessen wird deshalb: eine Seite mit lückenhafter Ahnenkette wird weiterhin vollständig und
    // unverändert gemappt. Wird das eines Tages fail-closed, wird dieser Fall rot — und genau dann
    // ist es eine Entscheidung und kein Nebeneffekt.
    const lueckig = seite("500", "Pumpe warten", [{ id: "100", title: "A" }, { title: "B" }]);
    expect(confluenceAhnenBefund(lueckig)).toBe("fehlende-id");

    const item = mapConfluencePageToImportItem(lueckig, OPTS);
    expect(item.title).toBe("Pumpe warten");
    expect(item.externalId).toBe("500");
    expect(item.sourcePath).toEqual(["A", "B"]); // Titelweg unangetastet
    expect(item.statement.length).toBeGreaterThan(0);
  });
});
