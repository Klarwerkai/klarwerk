// @vitest-environment jsdom
// ================================================================================================
// JOB 3035 — ZWEI BILDER KÖNNEN NICHT DIESELBE KENNUNG TRAGEN
// ================================================================================================
//
// Wer einen Text mit zwei gleich gekennzeichneten Bildern öffnet (eingefügter Ausschnitt, kopierte
// Passage, Import aus fremder Hand), soll die Bildbeschreibung bekommen, die zu SEINEM Bild gehört.
// Gemessen wird deshalb an der ZUORDNUNG (`captionForImage`/`imageForCaption` an einem echten
// jsdom-Baum) und an der Eindeutigkeit nach `ensureImageAnchors` — nicht an Namen im Quelltext.
//
// ZWEI GETRENNTE URSACHEN, ZWEI GETRENNTE FALLGRUPPEN — das ist die Kalibrierung dieser Datei:
//   · A/B/E/F hängen an der Entdublettierung IN `ensureImageAnchors` (die Schleife „EINE KENNUNG
//     GEHÖRT GENAU EINEM BILD"). Nimmt man sie zurück, werden genau A, B und C1 rot.
//   · C2/D hängen an `knotenMitKennung`: bei MEHR ALS EINEM Träger derselben Kennung darf nicht der
//     erste Treffer geraten werden. Setzt man dort `return el` beim ersten Treffer, werden genau
//     C2 und D rot.
//   · E bleibt bei beiden Rücknahmen grün und belegt damit, dass die anderen Fälle wirklich an der
//     Doppelung hängen und nicht am Lauf an sich.
//
// Bewusst DOM-lib-FREI typisiert wie `tests/capture/editor-figure-caption.test.ts`: der Wurzel-tsc
// läuft ohne DOM-lib (`tsconfig.json`, `lib: ["ES2022"]`); das jsdom-Element erfüllt den schmalen
// Modultyp `EditableElement` strukturell.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type EditableElement,
  type EditableFigureRoot,
  captionForImage,
  ensureImageAnchors,
  imageForCaption,
} from "../../apps/web/src/lib/editorFigures";

// Das Lauf-Token ist im Produkt eine Zufallszahl (`newImageRunToken`, docx.ts). Für die Messung wird
// es festgenagelt — sonst wäre Fall F (Kollisionsfreiheit gegen eine BEREITS VORHANDENE Kennung
// derselben Bauform) nicht konstruierbar, sondern nur zufällig grün. Alles andere an `docx.ts`
// bleibt echt, insbesondere `IMAGE_ID_PREFIX`.
const TOKEN = "fixtok";
vi.mock("../../apps/web/src/lib/docx", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/lib/docx")>();
  return { ...echt, newImageRunToken: () => TOKEN };
});

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

/** Die Treffer als Feld — an ihnen wird gezählt und indiziert. */
function alle(root: EditableFigureRoot, selektor: string): EditableElement[] {
  return Array.from(root.querySelectorAll(selektor));
}

/** Der Treffer an dieser Stelle, oder ein sprechender Abbruch statt eines stillen `undefined`. */
function nte(root: EditableFigureRoot, selektor: string, index: number): EditableElement {
  const treffer = alle(root, selektor)[index];
  if (treffer === undefined) {
    throw new Error(`kein ${selektor} an Stelle ${index}`);
  }
  return treffer;
}

function kennung(el: EditableElement): string {
  return el.getAttribute("data-image-id") ?? "";
}

/**
 * Eine flache, vollständig verankerte Einheit: figure, img und figcaption tragen DIESELBE Kennung —
 * genau so, wie der Server-Anker (`anchorFigures`) und die Verankerung sie schreiben.
 */
function einheit(id: string, src: string, text: string): string {
  const figur = `<figure data-image-id="${id}">`;
  const bild = `<img src="${src}" data-image-id="${id}">`;
  const fussnote = `<figcaption data-image-id="${id}">${text}</figcaption>`;
  return [figur, bild, fussnote, "</figure>"].join("");
}

// Zwei Einheiten, die BEIDE dieselbe Kennung tragen. Der Fußnotentext unterscheidet sie.
const DOPPELT = [
  einheit("X", "/api/objects/erstes/raw", "Erste"),
  einheit("X", "/api/objects/zweites/raw", "Zweite"),
].join("");

describe("JOB 3035: eine Bildkennung gehört genau einem Bild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FALL A: die Doppelkennung überlebt das Verankern nicht — beide Bilder tragen eigene Kennungen", () => {
    const wurzel = wurzelMit(DOPPELT);
    ensureImageAnchors(wurzel);

    const bilder = alle(wurzel, "img");
    expect(bilder).toHaveLength(2);
    const erste = kennung(nte(wurzel, "img", 0));
    const zweite = kennung(nte(wurzel, "img", 1));
    expect(erste, "Das erste Bild hat gar keine Kennung").not.toBe("");
    expect(zweite, "Das zweite Bild hat gar keine Kennung").not.toBe("");
    expect(zweite, "Beide Bilder tragen weiterhin dieselbe Kennung").not.toBe(erste);
    // Verbindlich: der ERSTE Träger in Dokumentreihenfolge behält seine Kennung. Sonst wäre die
    // Reparatur selbst eine Quelle wechselnder Identitäten.
    expect(erste, "Das erste Bild wurde umbenannt, obwohl es die Kennung zuerst hatte").toBe("X");
  });

  it("FALL B: ein Paar wird gemeinsam umbenannt, nie halb — Bild, Fußnote und figure einer Einheit", () => {
    const wurzel = wurzelMit(DOPPELT);
    ensureImageAnchors(wurzel);

    for (const [index, text] of [
      [0, "Erste"],
      [1, "Zweite"],
    ] as const) {
      const figur = nte(wurzel, "figure", index);
      const bild = nte(figur, ":scope > img", 0);
      const fussnote = nte(figur, ":scope > figcaption", 0);
      expect(fussnote.textContent, `Einheit ${index} hat den falschen Text`).toBe(text);
      expect(kennung(bild), `Einheit ${index}: Bild ohne Kennung`).not.toBe("");
      expect(kennung(fussnote), `Einheit ${index}: Fußnote nicht mit ihrem Bild umbenannt`).toBe(
        kennung(bild),
      );
      expect(kennung(figur), `Einheit ${index}: figure nicht mit ihrem Bild umbenannt`).toBe(
        kennung(bild),
      );
    }
  });

  it("FALL C1, DER NUTZERFALL: nach dem Verankern liefert die Zuordnung die Fußnote von Bild 2", () => {
    const wurzel = wurzelMit(DOPPELT);
    ensureImageAnchors(wurzel);

    const bild2 = nte(wurzel, "img", 1);
    const fussnote2 = nte(wurzel, "figcaption", 1);
    expect(fussnote2.textContent).toBe("Zweite");

    expect(
      captionForImage(bild2, wurzel)?.textContent,
      "Das Formular zeigt die Beschreibung des ERSTEN Bildes",
    ).toBe("Zweite");
    expect(
      imageForCaption(fussnote2, wurzel)?.getAttribute("src"),
      "Die Fußnote von Bild 2 führt zum ERSTEN Bild",
    ).toBe("/api/objects/zweites/raw");
  });

  it("FALL C2: eine verwaiste Fußnote VOR dem Bild darf die Kennungssuche nicht kapern", () => {
    // Diese Doppelung überlebt das Verankern begründet: die verwaiste Fußnote gehört zu keinem Bild
    // (Stufe 3 — „nicht raten"), also wird an keiner Seite geschrieben. Sie steht aber VOR der
    // echten Einheit, und damit liefert eine Suche nach dem ERSTEN Kennungstreffer sie statt der
    // richtigen Fußnote — der Nutzer läse fremden Text unter seinem Bild.
    const wurzel = wurzelMit(
      [
        '<figcaption data-image-id="X">Verwaist</figcaption>',
        einheit("X", "/api/objects/echtes/raw", "Echte"),
      ].join(""),
    );
    ensureImageAnchors(wurzel);

    const bild = nte(wurzel, "figure img", 0);
    expect(
      captionForImage(bild, wurzel)?.textContent,
      "Die Zuordnung liefert die verwaiste Fußnote statt der eigenen",
    ).toBe("Echte");
  });

  it("FALL D: ohne vorherige Verankerung wird bei Mehrdeutigkeit nicht geraten", () => {
    // Der Fall „abgelöste Fußnote im offenen Formular, Ausschnitt aus fremder Hand": Markup, das nie
    // durch `ensureImageAnchors` gelaufen ist. Die Zuordnung darf hier lieber nichts sagen als das
    // Falsche — niemals aber die Hälfte der ersten Einheit.
    const wurzel = wurzelMit(DOPPELT);

    const bild2 = nte(wurzel, "img", 1);
    const fussnote2 = nte(wurzel, "figcaption", 1);

    const gefundeneFussnote = captionForImage(bild2, wurzel);
    expect(
      gefundeneFussnote === null ? null : gefundeneFussnote.textContent,
      "Bild 2 bekommt die Fußnote von Bild 1",
    ).not.toBe("Erste");
    expect(gefundeneFussnote === null ? null : gefundeneFussnote.textContent).toBe("Zweite");

    const gefundenesBild = imageForCaption(fussnote2, wurzel);
    expect(
      gefundenesBild === null ? null : gefundenesBild.getAttribute("src"),
      "Die Fußnote von Bild 2 führt zu Bild 1",
    ).not.toBe("/api/objects/erstes/raw");
    expect(gefundenesBild === null ? null : gefundenesBild.getAttribute("src")).toBe(
      "/api/objects/zweites/raw",
    );
  });

  it("FALL E: ein Baum ohne Doppelkennung geht byteweise unverändert durch", () => {
    // Die Sperre dagegen, dass die Eindeutigkeitsregel vorhandene Kennungen ohne Not neu vergibt.
    // Dieser Fall ist heute grün und muss grün bleiben — er kalibriert in die Gegenrichtung.
    const wurzel = wurzelMit(
      [
        einheit(`kw-img-${TOKEN}-1`, "/a", "Alpha"),
        einheit(`kw-img-${TOKEN}-2`, "/b", "Beta"),
      ].join(""),
    );
    const vorher = wurzel.outerHTML;

    expect(ensureImageAnchors(wurzel), "Ein vollständig verankerter Baum meldet Arbeit").toBe(0);
    expect(wurzel.outerHTML, "Der unauffällige Baum wurde angefasst").toBe(vorher);
  });

  it("FALL F: die frische Kennung trifft keine im Baum bereits vorhandene", () => {
    // Die vorhandene Kennung hat exakt die Bauform, die `neueKennung()` als ERSTE erzeugen würde
    // (`IMAGE_ID_PREFIX + Token + "-1"`). Ohne Kollisionsprüfung bekäme das dritte Bild genau sie.
    const wurzel = wurzelMit(
      [
        einheit(`kw-img-${TOKEN}-1`, "/alt", "Alt"),
        einheit("X", "/b", "Bild B"),
        einheit("X", "/c", "Bild C"),
      ].join(""),
    );
    ensureImageAnchors(wurzel);

    const kennungen = alle(wurzel, "img").map(kennung);
    expect(kennungen).toHaveLength(3);
    expect(kennungen[0], "Die Altkennung wurde ohne Not neu vergeben").toBe(`kw-img-${TOKEN}-1`);
    expect(new Set(kennungen).size, `Kennungen kollidieren: ${kennungen.join(", ")}`).toBe(3);
    // Und die Zuordnung trägt danach für jedes der drei Bilder.
    for (const [index, text] of [
      [0, "Alt"],
      [1, "Bild B"],
      [2, "Bild C"],
    ] as const) {
      expect(captionForImage(nte(wurzel, "img", index), wurzel)?.textContent, text).toBe(text);
    }
  });
});
