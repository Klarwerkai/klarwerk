// @vitest-environment jsdom
// ================================================================================================
// JOB 3051 — DIE TRENNUNG WIRD ZU EINER AUSKUNFT (die Modulhälfte)
// ================================================================================================
//
// Die Trennung selbst ist seit JOB 3035 gebaut: trifft `ensureImageAnchors` ein zweites Bild mit
// einer schon beanspruchten `data-image-id`, bekommt es eine frische, und seine Fußnote zieht mit,
// WENN sie wirklich die alte Kennung trug. Bis JOB 3051 verließ diese Auskunft die Funktion nie —
// der Rückgabewert ist `verankert`, und der zählt eine Umbenennung ausdrücklich nicht mit.
//
// Diese Datei misst die Auskunft, nicht ihre Anwesenheit im Quelltext: WELCHE Kennung wurde
// abgelöst, welche steht jetzt da, ist die Fußnote mitgegangen. Und sie hält in beide Richtungen
// fest, was NICHT passieren darf: kein Bericht ohne Doppelung, und der Zahl-Rückgabewert bleibt
// `verankert` (elf Bestandstests hängen daran, u. a. `doppelte-kennung.test.ts` FALL E).
//
// Bewusst DOM-lib-FREI typisiert wie `tests/bildkennung-eindeutig/doppelte-kennung.test.ts`: der
// Wurzel-tsc läuft ohne DOM-lib; das jsdom-Element erfüllt `EditableFigureRoot` strukturell.
import { describe, expect, it } from "vitest";
import {
  type EditableElement,
  type EditableFigureRoot,
  type KennungsTrennung,
  enhanceFiguresForEditing,
  ensureImageAnchors,
} from "../../apps/web/src/lib/editorFigures";

interface WurzelLike extends EditableFigureRoot {
  innerHTML: string;
  outerHTML: string;
}
interface DocumentLike {
  createElement(tag: string): WurzelLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

function wurzelMit(html: string): WurzelLike {
  const el = doc.createElement("div");
  el.innerHTML = html;
  return el;
}

function alle(root: EditableFigureRoot, selektor: string): EditableElement[] {
  return Array.from(root.querySelectorAll(selektor));
}

function kennungen(root: EditableFigureRoot, selektor: string): string[] {
  return alle(root, selektor).map((el) => el.getAttribute("data-image-id") ?? "");
}

/** Eine flache, vollständig verankerte Einheit — figure, img und figcaption tragen dieselbe Kennung. */
function einheit(id: string, src: string, text: string): string {
  return [
    `<figure data-image-id="${id}">`,
    `<img src="${src}" data-image-id="${id}">`,
    `<figcaption data-image-id="${id}">${text}</figcaption>`,
    "</figure>",
  ].join("");
}

/** Zwei Einheiten mit DERSELBEN Kennung — der Altbestand, um den es geht. */
const DOPPELT = [einheit("X", "/erstes", "Erste"), einheit("X", "/zweites", "Zweite")].join("");

/** Zwei Einheiten mit EIGENEN Kennungen — die Gegenkalibrierung. */
const EINDEUTIG = [einheit("A", "/erstes", "Erste"), einheit("B", "/zweites", "Zweite")].join("");

function sammle(html: string): {
  bericht: KennungsTrennung[];
  verankert: number;
  wurzel: WurzelLike;
} {
  const wurzel = wurzelMit(html);
  const bericht: KennungsTrennung[] = [];
  const verankert = ensureImageAnchors(wurzel, (trennung) => bericht.push(trennung));
  return { bericht, verankert, wurzel };
}

describe("JOB 3051: die getrennte Bildkennung wird gemeldet", () => {
  it("B1 · genau EINE Trennung, mit alter und frischer Kennung — und die Fußnote ist mitgegangen", () => {
    const { bericht, wurzel } = sammle(DOPPELT);

    expect(bericht, `gemeldet wurde: ${JSON.stringify(bericht)}`).toHaveLength(1);
    const eine = bericht[0];
    if (eine === undefined) {
      throw new Error("kein Bericht — die Trennung bleibt stumm");
    }
    expect(eine.alte, "die abgelöste Kennung ist nicht die doppelt getragene").toBe("X");
    expect(eine.frische, "die frische Kennung ist leer").not.toBe("");
    expect(eine.frische, "die frische Kennung ist dieselbe wie die alte").not.toBe("X");
    expect(eine.fussnoteFolgte, "die Fußnote trug die alte Kennung und muss mitgegangen sein").toBe(
      true,
    );

    // Und die Meldung stimmt mit dem Baum überein — sie ist keine Behauptung neben ihm.
    expect(kennungen(wurzel, "img"), "der Baum trägt die gemeldeten Kennungen nicht").toEqual([
      "X",
      eine.frische,
    ]);
    expect(
      kennungen(wurzel, "figcaption"),
      "die Fußnote wurde gemeldet, aber nicht umgeschrieben",
    ).toEqual(["X", eine.frische]);
  });

  it("B2 · der Zahl-Rückgabewert bleibt `verankert` und zählt die Trennung NICHT mit", () => {
    // Elf Bestandstests messen an dieser Zahl (`doppelte-kennung.test.ts:210` und Nachbarn). Eine
    // Trennung ist eine Umbenennung, keine Verankerung — die Zahl darf sie nicht mitzählen.
    const { verankert, bericht } = sammle(DOPPELT);
    expect(bericht, "Vorbedingung: es wurde getrennt").toHaveLength(1);
    expect(verankert, "der Rückgabewert zählt die Trennung mit").toBe(0);
  });

  it("B3 · ohne Doppelung wird NICHTS gemeldet — kein leerer Bericht als Entwarnung", () => {
    const { bericht, verankert } = sammle(EINDEUTIG);
    expect(bericht).toEqual([]);
    expect(verankert, "ein eindeutiger Baum meldet Arbeit").toBe(0);
  });

  it("B4 · trägt die Fußnote eine ANDERE Kennung, sagt der Bericht das — sie ist nicht mitgegangen", () => {
    // Die Regel aus JOB 3035 bleibt unangetastet: zwei verschiedene, nicht leere Kennungen werden
    // nirgends gegeneinander verrechnet. Der Bericht behauptet deshalb auch keine Mitnahme.
    const wurzel = wurzelMit(
      [
        einheit("X", "/erstes", "Erste"),
        '<figure data-image-id="X"><img src="/zweites" data-image-id="X">',
        '<figcaption data-image-id="Z">Fremde</figcaption></figure>',
      ].join(""),
    );
    const bericht: KennungsTrennung[] = [];
    ensureImageAnchors(wurzel, (trennung) => bericht.push(trennung));

    expect(bericht).toHaveLength(1);
    expect(bericht[0]?.fussnoteFolgte, "eine fremd gekennzeichnete Fußnote wurde mitgezogen").toBe(
      false,
    );
    expect(
      kennungen(wurzel, "figcaption")[1],
      "die fremde Kennung Z wurde überschrieben — genau das darf nicht geschehen",
    ).toBe("Z");
  });

  it("B5 · `enhanceFiguresForEditing` reicht die Auskunft weiter, statt sie wegzuwerfen", () => {
    // Die eine Stelle, über die der Editor verankert. Bis JOB 3051 gab sie `void` zurück — dort
    // endete die Auskunft endgültig.
    const wurzel = wurzelMit(DOPPELT);
    const trennungen = enhanceFiguresForEditing(wurzel, "Platzhalter", "Beschriftung");

    expect(trennungen).toHaveLength(1);
    expect(trennungen[0]?.alte).toBe("X");
    expect(trennungen[0]?.frische).not.toBe("X");

    // Und leer, wo nichts getrennt wurde — kein Rest aus einem früheren Lauf.
    expect(enhanceFiguresForEditing(wurzelMit(EINDEUTIG), "Platzhalter", "Beschriftung")).toEqual(
      [],
    );
  });

  it("B6 · drei Bilder mit derselben Kennung ergeben ZWEI Trennungen, jede mit eigener frischer Kennung", () => {
    // Die Zahl an der Fläche darf nicht geraten sein: sie ist die Länge dieser Liste.
    const { bericht } = sammle(
      [
        einheit("X", "/erstes", "Erste"),
        einheit("X", "/zweites", "Zweite"),
        einheit("X", "/drittes", "Dritte"),
      ].join(""),
    );

    expect(bericht).toHaveLength(2);
    expect(bericht.map((t) => t.alte)).toEqual(["X", "X"]);
    const frische = bericht.map((t) => t.frische);
    expect(new Set(frische).size, `die frischen Kennungen kollidieren: ${frische.join(", ")}`).toBe(
      2,
    );
    expect(frische).not.toContain("X");
  });
});
