// @vitest-environment jsdom
// ================================================================================================
// JOB 3282 · EDITOR-R26 — WOHIN DER BLOCK GEHT, GENAU AM EINFÜGEORT GEMESSEN.
// ================================================================================================
//
// Die gemountete Datei daneben (`link-und-bloecke-mounted.test.tsx`) fährt die Bedienung: markieren,
// klicken, speichern, neu laden. Diese hier misst die EINE Entscheidung darunter isoliert — hinter
// welchen Abschnitt ein Block gesetzt wird — und zwar in allen Kontexten, die auf der Fläche
// vorkommen. Beides zusammen, weil die gemountete Datei nicht jede Verschachtelung durchspielen
// kann, ohne unlesbar zu werden, und diese hier nicht belegt, dass ein Knopf sie ruft.
//
// Der Bezug zum belegten Befund (Codex, 08.09.): „in Kombination mit Liste bzw. vorhandenem
// Hinweisblock erschienen weitere Typen teils nur als … oder farbige Spans". Genau diese beiden
// Kontexte sind hier die ersten zwei Fälle.
import { beforeEach, describe, expect, it } from "vitest";
import {
  EDITOR_BLOCK_PLATZHALTER,
  abschnittImSchreibfeld,
  fuegeBlockEin,
} from "../../apps/web/src/lib/editorBlockInsert";
import { EDITOR_BLOCKS, editorBlockClass } from "../../apps/web/src/lib/editorBlocks";

let feld: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  feld = document.createElement("div");
  document.body.appendChild(feld);
});

/** Eine zusammengefallene Marke im ersten Textknoten unter `wurzel`. */
function markeIn(wurzel: Node, versatz = 0): Range {
  const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  const knoten = lauf.nextNode();
  if (!(knoten instanceof Text)) {
    throw new Error("kein Textknoten");
  }
  const bereich = document.createRange();
  bereich.setStart(knoten, versatz);
  bereich.collapse(true);
  return bereich;
}

describe("JOB 3282 · der Einfügeort eines Blocks", () => {
  it("C1 · aus einem Listeneintrag heraus landet der Block HINTER der Liste, nicht darin", () => {
    feld.innerHTML = "<ul><li>Eins</li><li>Zwei</li></ul>";
    const liste = feld.firstElementChild;

    const block = fuegeBlockEin(feld, "warning", markeIn(feld, 2));

    expect(block.parentElement).toBe(feld);
    expect(block.previousElementSibling).toBe(liste);
    expect(liste?.querySelector("div.panel")).toBeNull();
    expect(feld.querySelectorAll("ul > li").length).toBe(2);
  });

  it("C2 · aus einem vorhandenen Block heraus wird der neue sein NACHBAR, nicht sein Kind", () => {
    feld.innerHTML = '<div class="panel panel-note"><p>Hinweis</p></div>';
    const vorhanden = feld.firstElementChild;

    const block = fuegeBlockEin(feld, "info", markeIn(feld, 3));

    expect(block.parentElement).toBe(feld);
    expect(vorhanden?.querySelector("div.panel")).toBeNull();
    expect(feld.querySelectorAll("div.panel").length).toBe(2);
  });

  it("C3 · alle vier Typen tragen genau ihre erlaubte Klasse und den Platzhalter", () => {
    for (const typ of EDITOR_BLOCKS) {
      const block = fuegeBlockEin(feld, typ, null);
      expect(block.className).toBe(editorBlockClass(typ));
      expect(block.firstElementChild?.tagName).toBe("P");
      expect(block.textContent).toBe(EDITOR_BLOCK_PLATZHALTER);
    }
    expect(feld.querySelectorAll("div.panel").length).toBe(4);
    // Vier Geschwister, keine Verschachtelung — auch wenn sie nacheinander ans Ende gehen.
    for (const b of feld.querySelectorAll("div.panel")) {
      expect(b.parentElement).toBe(feld);
    }
  });

  it("C4 · ohne Bezug (leeres Feld, fremde Marke) hängt der Block ans Ende, statt zu verschwinden", () => {
    feld.innerHTML = "<p>Text</p>";
    const fremd = document.createElement("p");
    fremd.textContent = "woanders";
    document.body.appendChild(fremd);

    expect(abschnittImSchreibfeld(feld, markeIn(fremd, 1))).toBeNull();
    const block = fuegeBlockEin(feld, "success", markeIn(fremd, 1));
    expect(block.parentElement).toBe(feld);
    expect(feld.lastElementChild).toBe(block);
  });

  it("C5 · eine Auswahl über mehrere Abschnitte setzt den Block hinter den LETZTEN berührten", () => {
    feld.innerHTML = "<p>Eins</p><p>Zwei</p><p>Drei</p>";
    const bereich = document.createRange();
    // Vom ersten bis in den zweiten Absatz: gemeinsamer Vorfahr ist das Feld selbst.
    bereich.setStart(feld.children[0] as Node, 0);
    bereich.setEnd(feld.children[1] as Node, 1);

    expect(abschnittImSchreibfeld(feld, bereich)).toBe(feld.children[1]);
    const block = fuegeBlockEin(feld, "note", bereich);
    expect(block.previousElementSibling?.textContent).toBe("Zwei");
    expect(block.nextElementSibling?.textContent).toBe("Drei");
  });
});
