// @vitest-environment jsdom
// ================================================================================================
// JOB 3055 (PRIORITAETEN.md V7) — DIE VERWAISTE BILDBESCHREIBUNG FINDET IHR BILD, UND ÜBERSCHREIBT
// DABEI NIE EINE FREMDE
// ================================================================================================
//
// Gemessen wird direkt am Modul (`editorFigures.ts`), ohne Editor: die Zuordnung ist eine Änderung
// am Dokumentkörper und muss auch an Markup tragen, das nie durch die Verankerung gelaufen ist.
//
// DIE KALIBRIERUNG DIESER DATEI — jeder Fall hängt an genau einer Ursache:
//   · A hängt daran, dass überhaupt verschoben wird (Kennung UND Stellung, nicht nur die Kennung).
//   · B, D und E2 hängen am Überschreibschutz: nimmt man den Zweig `beschrieben` aus
//     `zuordnungsgrund` heraus, werden genau sie rot (E selbst bleibt grün — siehe dort).
//   · C hängt daran, dass eine schon zugeordnete Fußnote nicht weiterwandert.
//   · D hängt zusätzlich an der Symmetrie in `imageForCaption` (JOB 3041 R4) — bei Mehrdeutigkeit
//     wird nichts angeboten und nichts still verschoben.
//   · E hängt daran, dass Kandidatenliste und Wirkfunktion DIESELBE Prüfung benutzen. Ersetzt man
//     `zuordenbareBilder` durch ein schlichtes `querySelectorAll("img")`, wird E rot.
//
// RUNDE 2 — die drei Fälle, die bens Messung an Runde 1 verlangt hat:
//   · M hängt an der PLATZIERUNG: die Fußnote wird hinter das Bild gesetzt, nicht an die Stelle des
//     geräumten Platzhalters. Stellt man das zurück, werden genau M und M1 (gemountet) rot.
//   · N hängt an der DIREKTHEIT: Bild und geräumter Platz müssen direkte Kinder derselben figure
//     sein. Nimmt man die zwei `:scope >`-Prüfungen heraus, werden N, N2, O2 und P1 rot.
//   · O hängt daran, dass „nicht zuordenbar" drei Ausgänge hat und nicht zwei — ein Bild ohne
//     belastbare Kennung ist `unklar`, nicht `beschrieben`.
//
// Bewusst DOM-lib-FREI typisiert wie `tests/fussnote-ohne-bild/kennzeichnung.test.ts`: der
// Wurzel-tsc läuft ohne DOM-lib; das jsdom-Element erfüllt den schmalen Modultyp `EditableElement`.
import { describe, expect, it } from "vitest";
import {
  type EditableElement,
  type EditableFigureRoot,
  captionForImage,
  ensureImageAnchors,
  imageForCaption,
  ordneFussnoteZu,
  zuordenbareBilder,
  zuordnungsgrund,
} from "../../apps/web/src/lib/editorFigures";

interface WurzelLike extends EditableFigureRoot {
  innerHTML: string;
  querySelector(selectors: string): EditableElement | null;
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

function fussnoten(root: EditableFigureRoot): EditableElement[] {
  return Array.from(root.querySelectorAll("figcaption"));
}

function bilder(root: EditableFigureRoot): EditableElement[] {
  return Array.from(root.querySelectorAll("img"));
}

/**
 * DER KONKRETE KNOTEN, über seinen sichtbaren Text — nie über die Paarungslogik, deren Irrtum
 * dieser Test finden soll (bens Korrekturpflicht an JOB 3041 R1).
 */
function fussnoteMitText(root: EditableFigureRoot, text: string): EditableElement {
  const treffer = fussnoten(root).filter((f) => (f.textContent ?? "").trim() === text);
  const eine = treffer[0];
  if (treffer.length !== 1 || eine === undefined) {
    throw new Error(`${treffer.length} Fußnoten mit dem Text „${text}" statt genau einer`);
  }
  return eine;
}

/** Das konkrete Bild über seine Quelle — dieselbe Unabhängigkeit von der Paarungslogik. */
function bildMitQuelle(root: EditableFigureRoot, src: string): EditableElement {
  const treffer = bilder(root).filter((b) => b.getAttribute("src") === src);
  const eines = treffer[0];
  if (treffer.length !== 1 || eines === undefined) {
    throw new Error(`${treffer.length} Bilder mit der Quelle „${src}" statt genau eines`);
  }
  return eines;
}

const VERWAISTE = '<figcaption data-image-id="kw-cap-los">Verwaister Text</figcaption>';

/** Das freie Bild: eigene Kennung, eigene leere Fußnote — der Normalfall eines Kandidaten. */
const FREIES_BILD =
  '<figure data-image-id="kw-img-1"><img src="/api/objects/eins/raw" data-image-id="kw-img-1">' +
  '<figcaption data-image-id="kw-img-1"></figcaption></figure>';

/** Dasselbe Bild, aber seine Fußnote trägt schon eine Beschreibung. */
const BESCHRIEBENES_BILD =
  '<figure data-image-id="kw-img-1"><img src="/api/objects/eins/raw" data-image-id="kw-img-1">' +
  '<figcaption data-image-id="kw-img-1">Vorhandene Beschreibung</figcaption></figure>';

describe("JOB 3055 · A — der Normalfall: die Beschreibung steht danach bei ihrem Bild", () => {
  it("A · genau ein Kandidat, die Zuordnung greift, und der Text bleibt unverändert", () => {
    const el = wurzelMit(VERWAISTE + FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");

    // Vorbedingung, die den Fall erst zum Fall macht: sie gehört keinem Bild und steht außerhalb.
    expect(imageForCaption(verwaist, el)).toBeNull();
    expect(verwaist.closest("figure")).toBeNull();

    expect(zuordenbareBilder(verwaist, el)).toEqual([bild]);
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(true);

    // Der Knoten wird beim Verschieben neu gebildet (outerHTML, siehe Modulkommentar) — geprüft
    // wird deshalb der Knoten, der jetzt im Baum steht, ausgewählt über seinen Text.
    const jetzt = fussnoteMitText(el, "Verwaister Text");
    expect(imageForCaption(jetzt, el), "die Fußnote findet ihr Bild nicht").toBe(bild);
    expect(captionForImage(bild, el), "das Bild findet seine Fußnote nicht").toBe(jetzt);
    expect(jetzt.getAttribute("data-image-id")).toBe("kw-img-1");

    // Sie ist DIREKTES Kind der figure — nicht nur umgekennzeichnet. Genau das ist die Halbheit,
    // die der Auftrag ausschließt: die Kennung stimmte, der Text stünde weiter irgendwo im Text.
    const figure = bild.closest("figure");
    expect(figure).not.toBeNull();
    expect(jetzt.closest("figure")).toBe(figure);
    expect(Array.from(figure?.querySelectorAll(":scope > figcaption") ?? []).length).toBe(1);
    // Und im ganzen Baum steht der Text genau einmal.
    expect(fussnoten(el).length).toBe(1);
    expect((jetzt.textContent ?? "").trim()).toBe("Verwaister Text");
  });
});

describe("JOB 3055 · B — die Verweigerung, die diesen Auftrag trägt", () => {
  it("B · ein Bild mit vorhandener Beschreibung ist kein Kandidat, und nichts wird überschrieben", () => {
    const el = wurzelMit(VERWAISTE + BESCHRIEBENES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;

    expect(imageForCaption(verwaist, el), "Vorbedingung: sie gehört keinem Bild").toBeNull();
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
    expect(el.innerHTML, "der Baum ist nach der Verweigerung nicht zeichengleich").toBe(vorher);
    // Die fremde Beschreibung steht unverändert bei ihrem Bild.
    expect(captionForImage(bild, el)).toBe(fussnoteMitText(el, "Vorhandene Beschreibung"));
  });
});

describe("JOB 3055 · C — eine schon zugeordnete Fußnote wandert nicht weiter", () => {
  it("C · sie wird an ein zweites Bild gereicht und bleibt, wo sie ist", () => {
    const el = wurzelMit(
      '<figure data-image-id="kw-img-1"><img src="/api/objects/eins/raw" data-image-id="kw-img-1">' +
        '<figcaption data-image-id="kw-img-1">Gehört Bild eins</figcaption></figure>' +
        '<figure data-image-id="kw-img-2"><img src="/api/objects/zwei/raw" data-image-id="kw-img-2">' +
        '<figcaption data-image-id="kw-img-2"></figcaption></figure>',
    );
    const zugeordnet = fussnoteMitText(el, "Gehört Bild eins");
    const eins = bildMitQuelle(el, "/api/objects/eins/raw");
    const zwei = bildMitQuelle(el, "/api/objects/zwei/raw");
    const vorher = el.innerHTML;

    // Vorbedingung: sie GEHÖRT wirklich schon einem Bild — sonst prüfte C nichts.
    expect(imageForCaption(zugeordnet, el)).toBe(eins);
    expect(zuordenbareBilder(zugeordnet, el)).toEqual([]);
    expect(ordneFussnoteZu(zugeordnet, zwei, el)).toBe(false);
    expect(el.innerHTML).toBe(vorher);
  });
});

describe("JOB 3055 · D — Mehrdeutigkeit (JOB 3035 FALL C2): es wird nicht geraten", () => {
  // Wörtlich der Körper, an dem JOB 3041 R1 rot gemessen wurde: die verwaiste Fußnote trägt
  // DIESELBE Kennung wie Bild und Fußnote der vollständigen Einheit.
  const C2 =
    '<figcaption data-image-id="kw-x">Verwaist</figcaption>' +
    '<figure data-image-id="kw-x"><img src="/api/objects/echtes/raw" data-image-id="kw-x">' +
    '<figcaption data-image-id="kw-x">Echte</figcaption></figure>';

  it("D · die verwaiste Fußnote bleibt ohne Bild, das Bild ist kein Kandidat, nichts wandert", () => {
    const el = wurzelMit(C2);
    const verwaist = fussnoteMitText(el, "Verwaist");
    const bild = bildMitQuelle(el, "/api/objects/echtes/raw");
    const vorher = el.innerHTML;

    expect(imageForCaption(verwaist, el), "die Kennzeichnung gälte hier nicht mehr").toBeNull();
    expect(captionForImage(bild, el)).toBe(fussnoteMitText(el, "Echte"));
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
    expect(el.innerHTML, "im Mehrdeutigkeitsfall wurde still verschoben").toBe(vorher);
  });
});

describe("JOB 3055 · E — zwei Wahrheiten ausgeschlossen: Angebot und Wirkung sind dieselbe Menge", () => {
  // Vier Bilder in gemischtem Zustand. Ausgewählt werden sie über ihre QUELLE, nie über die
  // Kandidatenliste — sonst prüfte der Vergleich sich selbst.
  const GEMISCHT =
    '<figcaption data-image-id="kw-cap-los">Verwaister Text</figcaption>' +
    // 1) leere eigene Fußnote → zuordenbar
    '<figure data-image-id="kw-a"><img src="/api/objects/leer/raw" data-image-id="kw-a">' +
    '<figcaption data-image-id="kw-a"></figcaption></figure>' +
    // 2) gefüllte eigene Fußnote → nicht zuordenbar
    '<figure data-image-id="kw-b"><img src="/api/objects/gefuellt/raw" data-image-id="kw-b">' +
    '<figcaption data-image-id="kw-b">Schon beschrieben</figcaption></figure>' +
    // 3) ohne Kennung → nicht zuordenbar (die Paarung hätte später nichts, woran sie hinge)
    '<figure><img src="/api/objects/ohne/raw"><figcaption></figcaption></figure>' +
    // 4) in einer verschachtelten figure, mit leerer eigener Fußnote → zuordenbar
    '<figure data-image-id="kw-d"><figure data-image-id="kw-e">' +
    '<img src="/api/objects/tief/raw" data-image-id="kw-e">' +
    '<figcaption data-image-id="kw-e"></figcaption></figure></figure>';

  const QUELLEN = [
    "/api/objects/leer/raw",
    "/api/objects/gefuellt/raw",
    "/api/objects/ohne/raw",
    "/api/objects/tief/raw",
  ] as const;

  it("E · für JEDES Bild sagt die Kandidatenliste dasselbe wie die Wirkfunktion", () => {
    const angeboten: boolean[] = [];
    const gewirkt: boolean[] = [];
    for (const quelle of QUELLEN) {
      // Je Bild ein FRISCHER Baum: `ordneFussnoteZu` verändert ihn im Erfolgsfall.
      const listenBaum = wurzelMit(GEMISCHT);
      angeboten.push(
        zuordenbareBilder(fussnoteMitText(listenBaum, "Verwaister Text"), listenBaum).includes(
          bildMitQuelle(listenBaum, quelle),
        ),
      );

      const wirkBaum = wurzelMit(GEMISCHT);
      gewirkt.push(
        ordneFussnoteZu(
          fussnoteMitText(wirkBaum, "Verwaister Text"),
          bildMitQuelle(wirkBaum, quelle),
          wirkBaum,
        ),
      );
    }
    expect(angeboten).toEqual(gewirkt);
    // Selbstschutz: wären beide Mengen leer oder voll, sagte die Gleichheit nichts aus.
    expect(angeboten.filter((x) => x).length, "kein einziges Bild ist zuordenbar").toBeGreaterThan(
      0,
    );
    expect(angeboten.filter((x) => !x).length, "jedes Bild ist zuordenbar").toBeGreaterThan(0);
  });

  it("E2 · und namentlich: genau das leere und das tiefe Bild werden angeboten", () => {
    // Ohne diese Zeile bliebe E auch dann grün, wenn beide Seiten dieselbe FALSCHE Antwort gäben.
    const el = wurzelMit(GEMISCHT);
    const quellen = zuordenbareBilder(fussnoteMitText(el, "Verwaister Text"), el).map((b) =>
      b.getAttribute("src"),
    );
    expect(quellen).toEqual(["/api/objects/leer/raw", "/api/objects/tief/raw"]);
  });
});

// ================================================================================================
// RUNDE 2 — DIE DREI BEFUNDE, DIE BEN AN RUNDE 1 GEMESSEN HAT
// ================================================================================================

describe("JOB 3055 · M — die Beschreibung steht HINTER dem Bild, nicht davor", () => {
  // BENS BEFUND 1, wörtlich nachgestellt: der leere Platzhalter des Bildes steht VOR dem Bild.
  // Runde 1 ersetzte ihn AN SEINER STELLE — die Beschreibung stand danach über dem Bild, bis ins
  // gespeicherte HTML. Gemessen wird die KINDERREIHENFOLGE, nicht die Kindschaft allein.
  const PLATZHALTER_VOR_BILD =
    '<figure data-image-id="kw-img-1"><figcaption data-image-id="kw-img-1"></figcaption>' +
    '<img src="/api/objects/eins/raw" data-image-id="kw-img-1"></figure>';

  it("M · eingehend `figcaption → img`, danach exakt `IMG, FIGCAPTION`", () => {
    const el = wurzelMit(VERWAISTE + PLATZHALTER_VOR_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    const figure = bild.closest("figure");
    if (figure === null) {
      throw new Error("Vorbedingung: das Bild steht in einer figure");
    }
    // Vorbedingung, die den Fall erst zum Fall macht: eingehend steht die Fußnote VOR dem Bild.
    expect(
      Array.from(figure.querySelectorAll(":scope > *")).map((k) => k.tagName),
      "Vorbedingung: eingehend steht die leere Fußnote vor dem Bild",
    ).toEqual(["FIGCAPTION", "IMG"]);

    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(true);

    expect(
      Array.from(figure.querySelectorAll(":scope > *")).map((k) => k.tagName),
      "die Beschreibung steht über dem Bild — genau bens Befund an Runde 1",
    ).toEqual(["IMG", "FIGCAPTION"]);
    const jetzt = fussnoteMitText(el, "Verwaister Text");
    expect(jetzt.closest("figure")).toBe(figure);
    expect(jetzt.getAttribute("data-image-id")).toBe("kw-img-1");
    expect(imageForCaption(jetzt, el)).toBe(bild);
    // Der leere Platzhalter ist weg, nicht danebengeblieben.
    expect(fussnoten(el).length).toBe(1);
  });

  it("M2 · und im Normalfall `img → figcaption` bleibt die Reihenfolge, was sie war", () => {
    const el = wurzelMit(VERWAISTE + FREIES_BILD);
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    const figure = bild.closest("figure");
    expect(ordneFussnoteZu(fussnoteMitText(el, "Verwaister Text"), bild, el)).toBe(true);
    expect(Array.from(figure?.querySelectorAll(":scope > *") ?? []).map((k) => k.tagName)).toEqual([
      "IMG",
      "FIGCAPTION",
    ]);
  });
});

describe("JOB 3055 · N — ein Platzhalter, der nicht DIREKT bei seinem Bild steht", () => {
  // BENS BEFUND 2, wörtlich sein Körper: Runde 1 verglich nur `closest("figure")` und hielt die
  // Fußnote im `<div>` für „steht beim Bild". Sie wurde dort ersetzt — die Beschreibung landete im
  // div statt als direktes Kind der figure. Die Rückgabe behauptete eine Verweigerung, die es nicht
  // gab. Jetzt wird wirklich verweigert, und der Baum bleibt zeichengleich.
  const VERSCHACHTELTER_PLATZ =
    '<figure data-image-id="kw-img-1"><img src="/api/objects/eins/raw" data-image-id="kw-img-1">' +
    '<div><figcaption data-image-id="kw-img-1"></figcaption></div></figure>';

  it("N · das Bild ist kein Kandidat, die Zuordnung verweigert, der Baum ist zeichengleich", () => {
    const el = wurzelMit(VERWAISTE + VERSCHACHTELTER_PLATZ);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;

    // Vorbedingung: der Platzhalter liegt WIRKLICH nicht direkt in der figure.
    const figure = bild.closest("figure");
    expect(Array.from(figure?.querySelectorAll(":scope > figcaption") ?? []).length).toBe(0);
    expect(fussnoten(el).length, "Vorbedingung: es gibt ihn überhaupt").toBe(2);

    expect(zuordnungsgrund(verwaist, bild, el)).toBe("unklar");
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
    expect(el.innerHTML, "der Baum ist nach der Verweigerung nicht zeichengleich").toBe(vorher);
  });

  it("N2 · und dasselbe für ein Bild, das nicht direktes Kind seiner figure ist", () => {
    const el = wurzelMit(
      [
        VERWAISTE,
        '<figure data-image-id="kw-img-1"><div>',
        '<img src="/api/objects/eins/raw" data-image-id="kw-img-1"></div>',
        '<figcaption data-image-id="kw-img-1"></figcaption></figure>',
      ].join(""),
    );
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;
    // Ohne ein direktes Bild gibt es kein „hinter dem Bild und direktes Kind" zugleich.
    expect(zuordnungsgrund(verwaist, bild, el)).toBe("unklar");
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
    expect(el.innerHTML).toBe(vorher);
  });
});

describe("JOB 3055 · O — nicht zuordenbar heißt nicht „schon beschrieben“", () => {
  // BENS BEFUND 3: Ein Bild ohne belastbare Kennung fiel aus der Kandidatenliste und wurde an der
  // Fläche als „hat schon eine Bildbeschreibung" ausgegeben. Das ist eine Tatsachenaussage über
  // einen Zustand, der gar nicht erhoben war. Der Grund muss `unklar` sein, nicht `beschrieben`.
  it("O1 · Bild OHNE Kennung: Grund `unklar`, nicht `beschrieben`", () => {
    const el = wurzelMit(
      `${VERWAISTE}<figure><img src="/api/objects/ohne/raw"><figcaption></figcaption></figure>`,
    );
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/ohne/raw");
    expect(zuordnungsgrund(verwaist, bild, el)).toBe("unklar");
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
  });

  it("O2 · zwei widersprüchliche leere Fußnoten an EINEM Bild: `unklar`", () => {
    // Die Lage, die `offenerAnker` (huelle3) ausdrücklich schließt: es ist nicht entscheidbar,
    // welche Fußnote zum Bild gehört. Eine dritte danebenzustellen machte es schlimmer.
    const el = wurzelMit(
      [
        VERWAISTE,
        '<figure data-image-id="kw-img-1">',
        '<img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
        "<figcaption></figcaption>",
        '<figcaption data-image-id="kw-fremd"></figcaption></figure>',
      ].join(""),
    );
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;
    expect(zuordnungsgrund(verwaist, bild, el)).toBe("unklar");
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
    expect(el.innerHTML).toBe(vorher);
  });

  it("O3 · der Gegenfall: NUR ein wirklich beschriebenes Bild meldet `beschrieben`", () => {
    // Ohne diese Zeile wäre O auch dann grün, wenn gar nichts mehr `beschrieben` ergäbe — und der
    // Satz „alle Bilder haben schon eine Beschreibung" käme nie wieder vor.
    const el = wurzelMit(VERWAISTE + BESCHRIEBENES_BILD);
    expect(
      zuordnungsgrund(
        fussnoteMitText(el, "Verwaister Text"),
        bildMitQuelle(el, "/api/objects/eins/raw"),
        el,
      ),
    ).toBe("beschrieben");
  });

  it("O4 · und der Normalfall meldet `zuordenbar` — die drei Gründe sind wirklich drei", () => {
    const el = wurzelMit(VERWAISTE + FREIES_BILD);
    expect(
      zuordnungsgrund(
        fussnoteMitText(el, "Verwaister Text"),
        bildMitQuelle(el, "/api/objects/eins/raw"),
        el,
      ),
    ).toBe("zuordenbar");
  });
});

// ================================================================================================
// RUNDE 3 · R — DER EXPORTVERTRAG GILT UNBEDINGT, NICHT NUR AM VERANKERTEN BAUM
// ================================================================================================
//
// BENS KORREKTURPFLICHT 3, zwei Randfälle: Die Nachbedingung bei `true` („genau ein direktes Bild,
// genau eine direkte Fußnote, Fußnote unmittelbar hinter dem Bild") stand ohne Vorbedingung an der
// Funktion, wurde aber von zwei Lagen gebrochen, die nur AUSSERHALB des fertig verankerten
// Editorbaums vorkommen. Beide ergeben ab jetzt `false` und einen bytegleichen Baum.

describe("JOB 3055 · R — abgelöster Knoten und Mehrbild-figure", () => {
  it("R1 · eine Fußnote, die nicht mehr in der Wurzel hängt, wird NICHT wieder eingesetzt", () => {
    // Das ist der Normalfall nach einem externen Inhaltswechsel im Editor: ein offenes Formular
    // hält einen Zeiger auf einen Knoten, den es im Baum nicht mehr gibt. Setzte man ihn ein, bekäme
    // der Autor Text zurück, den er nicht mehr hat.
    const el = wurzelMit(VERWAISTE + FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    verwaist.outerHTML = ""; // abgelöst — der Knoten lebt, hängt aber nirgends mehr
    const vorher = el.innerHTML;
    expect(vorher, "Vorbedingung: der Text steht wirklich nicht mehr im Baum").not.toContain(
      "Verwaister Text",
    );

    expect(zuordnungsgrund(verwaist, bild, el)).toBe("unklar");
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
    expect(el.innerHTML, "der abgelöste Text wurde wieder eingesetzt").toBe(vorher);
  });

  it("R2 · eine figure mit MEHREREN direkten Bildern ist kein Ziel", () => {
    // Die Fußnote stünde sonst ZWISCHEN zwei Bildern statt hinter ihrem — die Nachbedingung wäre
    // gebrochen, und welchem der beiden sie gehört, wäre danach unentscheidbar.
    const el = wurzelMit(
      [
        VERWAISTE,
        '<figure data-image-id="kw-img-1">',
        '<img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
        '<img src="/api/objects/zwei/raw" data-image-id="kw-img-2">',
        '<figcaption data-image-id="kw-img-1"></figcaption></figure>',
      ].join(""),
    );
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const vorher = el.innerHTML;
    for (const quelle of ["/api/objects/eins/raw", "/api/objects/zwei/raw"]) {
      const bild = bildMitQuelle(el, quelle);
      expect(zuordnungsgrund(verwaist, bild, el), quelle).toBe("unklar");
      expect(ordneFussnoteZu(verwaist, bild, el), quelle).toBe(false);
    }
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(el.innerHTML).toBe(vorher);
  });

  it("R3 · der Gegenfall: an EINEM direkten Bild derselben Bauart greift die Zuordnung weiter", () => {
    // Ohne diese Zeile wäre R2 auch dann grün, wenn gar nichts mehr zuordenbar wäre.
    const el = wurzelMit(VERWAISTE + FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    expect(ordneFussnoteZu(verwaist, bildMitQuelle(el, "/api/objects/eins/raw"), el)).toBe(true);
  });
});

// ================================================================================================
// RUNDE 4 · S — DAS ZIELBILD STEHT IN DER QUELLFUSSNOTE
// ================================================================================================
//
// BENS BEFUND AN RUNDE 3, und der schwerste bisher: `ordneFussnoteZu` nimmt die Fußnote MITSAMT
// ihrem Teilbaum von ihrer Stelle. Liegt das Zielbild darin, verschwindet es mit ihr; das Einsetzen
// greift danach ins Leere, und der Editor emittiert einen LEEREN Dokumentkörper. Ein angebotener
// Klick, der Bild UND Beschreibung löscht, ist schlimmer als jede verweigerte Zuordnung.
describe("JOB 3055 · S — ein Bild IM Teilbaum der Fußnote wird nicht zum Ziel", () => {
  // Wörtlich bens Körper: die verwaiste Fußnote ENTHÄLT die vollständige Bildeinheit.
  const BILD_IN_DER_FUSSNOTE = [
    '<figcaption data-image-id="kw-cap-los">Verwaister Text',
    '<figure data-image-id="kw-img-1">',
    '<img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
    '<figcaption data-image-id="kw-img-1"></figcaption></figure></figcaption>',
  ].join("");

  it("S1 · Grund `unklar`, kein Kandidat, `false` — und der Baum bleibt zeichengleich", () => {
    const el = wurzelMit(BILD_IN_DER_FUSSNOTE);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const bild = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;

    // Vorbedingung, die den Fall erst zum Fall macht: das Bild steht WIRKLICH in der Fußnote.
    expect(
      Array.from(verwaist.querySelectorAll("img")).includes(bild),
      "Vorbedingung: das Zielbild liegt im Teilbaum der Fußnote",
    ).toBe(true);
    // Und die Fußnote gilt weiterhin als verwaist — sonst wäre der Fall gar nicht erreichbar.
    expect(imageForCaption(verwaist, el)).toBeNull();

    expect(zuordnungsgrund(verwaist, bild, el)).toBe("unklar");
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, bild, el)).toBe(false);
    expect(el.innerHTML, "der Baum ist nach der Verweigerung nicht zeichengleich").toBe(vorher);
    // Und das ist die eigentliche Zusage: nichts ist verschwunden.
    expect(bilder(el).length, "das Bild wurde gelöscht").toBe(1);
    expect(el.innerHTML, "der Text wurde gelöscht").toContain("Verwaister Text");
    expect(el.innerHTML).not.toBe("");
  });

  /** Dasselbe noch einmal, aber ein zweites, freies Bild steht als GESCHWISTER daneben. */
  const ZWEITES_FREIES_BILD =
    '<figure data-image-id="kw-img-2"><img src="/api/objects/zwei/raw" data-image-id="kw-img-2">' +
    '<figcaption data-image-id="kw-img-2"></figcaption></figure>';

  it("S2 · auch das Geschwisterbild wird verweigert, solange die Fußnote ein Bild enthält", () => {
    // DIE SCHRANKE HÄNGT AN DER FUSSNOTE, nicht am Ziel — und das ist gemessen, nicht vorsichtig:
    // Beim Geschwisterbild geht zwar nichts verloren, die Fußnote wandert aber MIT ihrer figure in
    // die Ziel-figure. Am gemounteten Editor stand danach `<figure><img><figcaption>Text<figure>
    // <img>…</figure></figcaption></figure>` — eine figure IN einer figcaption, bis in den
    // gespeicherten Rumpf. Das Flachmachen löst sie nicht auf; genau das verbietet mega89 Block A.
    const el = wurzelMit(BILD_IN_DER_FUSSNOTE + ZWEITES_FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const vorher = el.innerHTML;

    for (const quelle of ["/api/objects/eins/raw", "/api/objects/zwei/raw"]) {
      const bild = bildMitQuelle(el, quelle);
      expect(zuordnungsgrund(verwaist, bild, el), quelle).toBe("unklar");
      expect(ordneFussnoteZu(verwaist, bild, el), quelle).toBe(false);
    }
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(el.innerHTML).toBe(vorher);
    expect(bilder(el).length).toBe(2);
  });

  it("S3 · der Gegenfall: OHNE Bild in der Fußnote ist dasselbe Geschwisterbild zuordenbar", () => {
    // Ohne diese Zeile wäre S1/S2 auch dann grün, wenn die neue Schranke jedes Bild ablehnte. Der
    // Körper unterscheidet sich in genau einem Punkt: die Fußnote enthält keine Bildeinheit mehr.
    const el = wurzelMit(VERWAISTE + ZWEITES_FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const geschwister = bildMitQuelle(el, "/api/objects/zwei/raw");
    expect(zuordnungsgrund(verwaist, geschwister, el)).toBe("zuordenbar");
    expect(zuordenbareBilder(verwaist, el)).toEqual([geschwister]);
    expect(ordneFussnoteZu(verwaist, geschwister, el)).toBe(true);
    expect(bilder(el).length).toBe(1);
    expect(el.innerHTML).toContain("Verwaister Text");
  });
});

describe("JOB 3055 · T — der geräumte PLATZHALTER wird nicht ungeprüft gelöscht", () => {
  // RUNDE 5, bens Korrekturpflicht 1 — der symmetrische Fall zu S, und der gefährlichere:
  // S schützt die WANDERNDE Fußnote, T den PLATZ, der für sie geräumt wird. `ordneFussnoteZu`
  // entfernt die vorhandene Fußnote des Zielbildes mit `platzhalter.outerHTML = ""` (weil eine
  // figure genau eine Fußnote trägt). Bis Runde 4 hing die Erlaubnis dazu allein am getrimmten
  // TEXT — eine Fußnote mit leerem Text, aber eingebetteter Bildeinheit galt als „leer" und wurde
  // mitsamt ihrem Bild gelöscht. Der Autor sah einen angebotenen Knopf und verlor durch den Klick
  // ein Bild, bis in den gespeicherten Rumpf.
  //
  // GEPRÜFT WIRD DESHALB NICHT „enthält kein img", sondern „ist strukturell leer": was in diesem
  // Platzhalter steht, ist ungeprüfter fremder Inhalt, und gelöscht wird nur, was nachweislich
  // nichts trägt. Text allein bleibt der Grund `beschrieben` (das ist die Aussage, die die Fläche
  // als Tatsache treffen darf); alles andere ist `unklar`.
  const ZIEL_MIT_BILD_IM_PLATZHALTER = [
    '<figure data-image-id="kw-img-1">',
    '<img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
    '<figcaption data-image-id="kw-img-1">',
    '<figure data-image-id="kw-img-9"><img src="/api/objects/innen/raw" data-image-id="kw-img-9">',
    '<figcaption data-image-id="kw-img-9"></figcaption></figure>',
    "</figcaption></figure>",
  ].join("");

  /** Ein zweites, in jeder Hinsicht freies Bild — das gültige Ziel neben dem zerstörerischen. */
  const ZWEITES_FREIES_BILD =
    '<figure data-image-id="kw-img-2"><img src="/api/objects/zwei/raw" data-image-id="kw-img-2">' +
    '<figcaption data-image-id="kw-img-2"></figcaption></figure>';

  it("T1 · Grund `unklar`, kein Kandidat, `false` — kein Bild geht verloren", () => {
    const el = wurzelMit(VERWAISTE + ZIEL_MIT_BILD_IM_PLATZHALTER);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const ziel = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;

    // Vorbedingungen, die den Fall erst zum Fall machen — beide unabhängig von der Prüfung selbst:
    // der Platzhalter des Zielbildes ist der äußere, und er trägt keinen Text (sonst griffe schon
    // `beschrieben` und der Fall wäre gar nicht erreichbar).
    const platzhalter = captionForImage(ziel, el);
    expect(platzhalter, "Vorbedingung: das Zielbild hat einen Platzhalter").not.toBeNull();
    expect((platzhalter?.textContent ?? "").trim()).toBe("");
    expect(
      Array.from(platzhalter?.querySelectorAll("img") ?? []).length,
      "Vorbedingung: im Platzhalter steht eine Bildeinheit",
    ).toBe(1);
    expect(imageForCaption(verwaist, el)).toBeNull();

    expect(zuordnungsgrund(verwaist, ziel, el)).toBe("unklar");
    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, ziel, el)).toBe(false);
    expect(el.innerHTML, "der Baum ist nach der Verweigerung nicht zeichengleich").toBe(vorher);
    expect(bilder(el).length, "ein Bild wurde gelöscht").toBe(2);
    expect(el.innerHTML).toContain("Verwaister Text");
  });

  it("T2 · das gültige Geschwisterziel bleibt wählbar, und die Zuordnung erhält alle Bilder", () => {
    // Die Schranke hängt am PLATZHALTER DIESES Bildes, nicht an der Wurzel: ein zerstörerisches
    // Ziel darf nicht dazu führen, dass gar nichts mehr geht. Sonst wäre T1 auch mit einer
    // Funktion grün, die pauschal alles ablehnt.
    const el = wurzelMit(VERWAISTE + ZIEL_MIT_BILD_IM_PLATZHALTER + ZWEITES_FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const ziel = bildMitQuelle(el, "/api/objects/eins/raw");
    const geschwister = bildMitQuelle(el, "/api/objects/zwei/raw");

    expect(zuordnungsgrund(verwaist, ziel, el)).toBe("unklar");
    expect(zuordenbareBilder(verwaist, el)).toEqual([geschwister]);
    expect(ordneFussnoteZu(verwaist, geschwister, el)).toBe(true);

    // Alle drei Bilder stehen noch, und die Beschreibung sitzt beim Geschwisterbild.
    expect(bilder(el).length).toBe(3);
    expect(imageForCaption(fussnoteMitText(el, "Verwaister Text"), el)).toBe(geschwister);
    // Und das innere Bild des fremden Platzhalters ist unangetastet.
    expect(bildMitQuelle(el, "/api/objects/innen/raw")).not.toBeNull();
  });

  it("T3 · der Gegenfall: ein WIRKLICH leerer Platzhalter wird geräumt", () => {
    // Ohne diesen Fall wäre T1/T2 auch mit einer Schranke grün, die jeden Platzhalter ablehnte.
    // Der Körper unterscheidet sich in genau einem Punkt: der Platzhalter ist leer.
    const el = wurzelMit(VERWAISTE + FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const ziel = bildMitQuelle(el, "/api/objects/eins/raw");
    expect(zuordnungsgrund(verwaist, ziel, el)).toBe("zuordenbar");
    expect(ordneFussnoteZu(verwaist, ziel, el)).toBe(true);
    expect(fussnoten(el).length, "der geräumte Platzhalter steht noch da").toBe(1);
  });

  it("T4 · dieselbe Schranke trägt jeden ungeprüften Inhalt, nicht nur Bilder", () => {
    // Gelöscht wird nur, was nachweislich nichts trägt. Ein Platzhalter mit textlosem, aber
    // vorhandenem Markup (hier eine Verknüpfung mit Ziel) ist kein Nachweis — `unklar`.
    const ZIEL_MIT_MARKUP_IM_PLATZHALTER = [
      '<figure data-image-id="kw-img-1">',
      '<img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
      '<figcaption data-image-id="kw-img-1"><a href="/quelle"></a></figcaption></figure>',
    ].join("");
    const el = wurzelMit(VERWAISTE + ZIEL_MIT_MARKUP_IM_PLATZHALTER);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const ziel = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;
    expect(zuordnungsgrund(verwaist, ziel, el)).toBe("unklar");
    expect(ordneFussnoteZu(verwaist, ziel, el)).toBe(false);
    expect(el.innerHTML).toBe(vorher);
  });
});

describe("JOB 3055 · U — ein geschütztes Leerzeichen (U+00A0) ist Inhalt, kein Leerraum", () => {
  // RUNDE 6, bens Korrekturpflicht 1 — und der Befund ist im selben Quelltext schon aufgeschrieben:
  // `editorFigures.ts:231-233` sagt ausdrücklich, warum hier NICHT `trim()`/`\s` steht, sondern der
  // ausgeschriebene Zeichenvorrat `NUR_EINRUECKUNG` (`:234`): „Ein &nbsp;, das jemand gesetzt hat,
  // IST Inhalt — es steht sichtbar zwischen zwei Bildern und darf nicht stillschweigend
  // verschwinden." `istLeererPlatzhalter` benutzte `trim()`, und damit erteilte U+00A0 die
  // Löschfreigabe: der Platzhalter wurde angeboten und beim Klick samt seinem Zeichen entfernt,
  // bis in das gespeicherte HTML.
  //
  // DIE GRENZE FÜR DIE LÖSCHFREIGABE IST AB JETZT AUSSCHLIESSLICH `NUR_EINRUECKUNG` — dieselbe
  // Grenze, die dieses Modul für seine andere Verwerfungsentscheidung (`:294`) schon benutzt. Eine
  // zweite Leerraumdefinition daneben wäre genau die Zweitkopie, gegen die dieses Modul gebaut ist.
  const NBSP = " ";
  const ZIEL_MIT_NBSP_IM_PLATZHALTER = [
    '<figure data-image-id="kw-img-1">',
    '<img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
    `<figcaption data-image-id="kw-img-1">${NBSP}</figcaption></figure>`,
  ].join("");

  /** Ein zweites, in jeder Hinsicht freies Bild — das gültige Ziel neben dem zerstörerischen. */
  const ZWEITES_FREIES_BILD =
    '<figure data-image-id="kw-img-2"><img src="/api/objects/zwei/raw" data-image-id="kw-img-2">' +
    '<figcaption data-image-id="kw-img-2"></figcaption></figure>';

  it("U1 · kein Kandidat, `false`, bytegleicher Baum — und das Zeichen steht noch da", () => {
    const el = wurzelMit(VERWAISTE + ZIEL_MIT_NBSP_IM_PLATZHALTER);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const ziel = bildMitQuelle(el, "/api/objects/eins/raw");
    const vorher = el.innerHTML;

    // Vorbedingung, die den Fall erst zum Fall macht: `trim()` hält dieses Zeichen für Leerraum.
    const platzhalter = captionForImage(ziel, el);
    expect(platzhalter?.textContent).toBe(NBSP);
    expect(
      (platzhalter?.textContent ?? "").trim(),
      "Vorbedingung: genau daran ist die Runde-5-Fassung gescheitert",
    ).toBe("");
    expect(platzhalter?.querySelector("*"), "Vorbedingung: kein Elementinhalt").toBeNull();

    expect(zuordenbareBilder(verwaist, el)).toEqual([]);
    expect(ordneFussnoteZu(verwaist, ziel, el)).toBe(false);
    expect(el.innerHTML, "der Baum ist nach der Verweigerung nicht zeichengleich").toBe(vorher);
    // Gemessen am TEXTINHALT, nicht am `innerHTML`: die Serialisierung schreibt U+00A0 als die
    // Entität `&nbsp;`, das Zeichen selbst käme in der Zeichenkette gar nicht vor.
    expect(
      captionForImage(ziel, el)?.textContent,
      "das geschützte Leerzeichen wurde gelöscht",
    ).toBe(NBSP);
  });

  it("U1b · der Grund ist `unklar` und NICHT `beschrieben`", () => {
    // BEWUSSTE ENTSCHEIDUNG, und sie hängt am Satz, den die Fläche sonst sagen würde:
    // `editor.assignAllDescribed` lautet „Alle Bilder in diesem Text haben schon eine
    // Bildbeschreibung." Über einen Platzhalter, in dem nur ein U+00A0 steht, wäre das eine falsche
    // Tatsachenaussage — es steht dort nichts zu lesen. `unklar` sagt nur, was erhoben ist.
    // Damit trennen sich die zwei Fragen sauber: `trim()` beantwortet „steht da eine LESBARE
    // Beschreibung" und erteilt KEINE Löschfreigabe mehr; `NUR_EINRUECKUNG` beantwortet allein
    // „darf dieser Platz geräumt werden".
    const el = wurzelMit(VERWAISTE + ZIEL_MIT_NBSP_IM_PLATZHALTER);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const ziel = bildMitQuelle(el, "/api/objects/eins/raw");
    expect(zuordnungsgrund(verwaist, ziel, el)).toBe("unklar");
  });

  it("U2 · das gültige Geschwisterziel bleibt wählbar, und U+00A0 überlebt die Zuordnung", () => {
    const el = wurzelMit(VERWAISTE + ZIEL_MIT_NBSP_IM_PLATZHALTER + ZWEITES_FREIES_BILD);
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const geschwister = bildMitQuelle(el, "/api/objects/zwei/raw");

    expect(zuordenbareBilder(verwaist, el)).toEqual([geschwister]);
    expect(ordneFussnoteZu(verwaist, geschwister, el)).toBe(true);

    expect(imageForCaption(fussnoteMitText(el, "Verwaister Text"), el)).toBe(geschwister);
    expect(bilder(el).length).toBe(2);
    // Der fremde Platzhalter ist unangetastet — samt seinem Zeichen (am Textinhalt gemessen, s. U1).
    expect(
      captionForImage(bildMitQuelle(el, "/api/objects/eins/raw"), el)?.textContent,
      "das fremde geschützte Leerzeichen ist verschwunden",
    ).toBe(NBSP);
  });

  it("U3 · der Gegenfall: ECHTE Einrückung gibt den Platz weiterhin frei", () => {
    // Ohne diesen Fall wäre U1 auch mit einer Schranke grün, die jeden Platzhalter mit irgendeinem
    // Textknoten ablehnt. Zwischen Serialisieren und Parsen entsteht genau solcher Leerraum; er ist
    // Formatierung, kein Inhalt — das ist die Unterscheidung, die `NUR_EINRUECKUNG` trifft.
    const el = wurzelMit(
      [
        VERWAISTE,
        '<figure data-image-id="kw-img-1">',
        '<img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
        '<figcaption data-image-id="kw-img-1">\n    \t</figcaption></figure>',
      ].join(""),
    );
    const verwaist = fussnoteMitText(el, "Verwaister Text");
    const ziel = bildMitQuelle(el, "/api/objects/eins/raw");
    expect(zuordnungsgrund(verwaist, ziel, el)).toBe("zuordenbar");
    expect(ordneFussnoteZu(verwaist, ziel, el)).toBe(true);
    expect(fussnoten(el).length, "der geräumte Platzhalter steht noch da").toBe(1);
  });

  it("U6 · dieselbe Grenze gilt im AUTOMATISCHEN Weg desselben Moduls", () => {
    // ZWEI LEERRAUMDEFINITIONEN IN EINEM MODUL WÄREN DIE ZWEITE WAHRHEIT, gegen die es gebaut ist.
    // `offenerAnker` entscheidet mit derselben Frage („ist die Fußnote dieses Ankers leer?"), ob
    // `verschiebeInAnker` sie ÜBERSCHREIBEN darf (`editorFigures.ts:685`,
    // `platz.ankerFussnote.outerHTML = fussnote.outerHTML`) — und fragte ebenfalls mit `trim()`.
    // Ein U+00A0 im Anker wurde dort also nicht angeboten, sondern ohne jedes Zutun des Autors
    // überschrieben. Derselbe Schaden, derselbe Ursprung, dieselbe Grenze.
    //
    // Dieser Weg ist SCHLIMMER als der angebotene Klick: er läuft ohne jedes Zutun des Autors, bei
    // jedem Verankerungslauf des Editors (`RichTextEditor.tsx:656` → `enhanceFiguresForEditing` →
    // `ensureImageAnchors`). Der Körper ist gemessen, nicht angenommen: eine verschachtelte Einheit
    // als innerer Anker, deren Fußnote nur ein U+00A0 trägt, und daneben die wandernde Beschreibung.
    //
    // Erwartung: der Anker gilt als BESETZT, die wandernde Fußnote wird nicht hineingeschrieben,
    // und das Zeichen steht danach noch da.
    const el = wurzelMit(
      [
        "<figure>",
        `<figure><img src="/api/objects/eins/raw"><figcaption>${NBSP}</figcaption></figure>`,
        "<figcaption>Wandernde Beschreibung</figcaption></figure>",
      ].join(""),
    );
    ensureImageAnchors(el);
    // Gemessen am Textinhalt, nicht am `innerHTML`: die Serialisierung schreibt U+00A0 je nach Lage
    // als Entität ODER als das Zeichen selbst — der Textknoten ist die verlässliche Auskunft.
    const treffer = fussnoten(el).filter((f) => f.textContent === NBSP);
    expect(treffer.length, "das geschützte Leerzeichen wurde überschrieben").toBe(1);
    expect(
      fussnoten(el).some((f) => (f.textContent ?? "") === "Wandernde Beschreibung"),
      "die wandernde Beschreibung ist verschwunden",
    ).toBe(true);
  });
});

describe("JOB 3055 · V — der automatische Weg löscht keinen Elementinhalt", () => {
  // RUNDE 7, bens Korrekturpflicht 1 — der letzte offene Rest derselben Sache, und mein Fehler in
  // Runde 6: Ich habe `offenerAnker` (`editorFigures.ts:646`) auf `NUR_EINRUECKUNG` umgestellt und
  // die Rückgabe „fail-closed durchgehend" genannt, ohne die ZWEITE Hälfte derselben Schranke
  // mitzunehmen. `istLeererPlatzhalter` (`:1381`) verlangt beides — Einrückung UND keinen
  // Elementnachfahren. `offenerAnker` verlangte nur das erste und erklärte deshalb eine textleere
  // Fußnote MIT eingebetteter Bildeinheit weiterhin für frei; `verschiebeInAnker` (`:697`,
  // `platz.ankerFussnote.outerHTML = fussnote.outerHTML`) überschrieb danach ihren ganzen Inhalt.
  //
  // DASS DIE ALTE REGEL NEBEN DER STRENGEREN WEITERLEBTE, war genau die Zweitkopie, gegen die dieses
  // Modul steht — und ihr Preis ist hier höher als beim angebotenen Klick: der Verlust geschieht
  // ohne jedes Zutun des Autors, bei jedem Verankerungslauf des Editors.
  //
  // Beide Wege fragen ab jetzt DIESELBE Funktion. Der Beleg dafür ist nicht ihr Name an zwei
  // Stellen, sondern V1/V2: ohne die Elementschranke im automatischen Weg werden sie rot.
  const ANKER_MIT_BILD_IN_DER_FUSSNOTE = [
    "<figure>",
    '<figure><img src="/api/objects/aussen/raw"><figcaption>',
    '<figure><img src="/api/objects/innen/raw"><figcaption></figcaption></figure>',
    "</figcaption></figure>",
    "<figcaption>Wandernde Beschreibung</figcaption></figure>",
  ].join("");

  it("V1 · beide Bilder und die wandernde Beschreibung überleben `ensureImageAnchors`", () => {
    const el = wurzelMit(ANKER_MIT_BILD_IN_DER_FUSSNOTE);

    // Vorbedingungen, die den Fall erst zum Fall machen: die Ankerfußnote ist TEXTLEER (sonst
    // schlösse schon die Textschranke) und trägt eine vollständige Bildeinheit.
    const ankerFussnote = fussnoten(el).find(
      (f) => Array.from(f.querySelectorAll("img")).length === 1,
    );
    expect(ankerFussnote, "Vorbedingung: eine Fußnote mit Bildeinheit").toBeDefined();
    expect((ankerFussnote?.textContent ?? "").trim()).toBe("");
    expect(bilder(el).length, "Vorbedingung: zwei Bilder").toBe(2);

    ensureImageAnchors(el);

    expect(bilder(el).length, "ein Bild wurde beim Verankern gelöscht").toBe(2);
    for (const quelle of ["/api/objects/aussen/raw", "/api/objects/innen/raw"]) {
      expect(
        bilder(el).some((b) => b.getAttribute("src") === quelle),
        `${quelle} ist verschwunden`,
      ).toBe(true);
    }
    expect(
      fussnoten(el).some((f) => (f.textContent ?? "").trim() === "Wandernde Beschreibung"),
      "die wandernde Beschreibung ist verschwunden",
    ).toBe(true);
  });

  it("V2 · beide Wege antworten über DENSELBEN Inhalt gleich — das ist die eigentliche Zusage", () => {
    // Die Zusage ist nicht „beide Stellen sehen ähnlich aus", sondern „beide Stellen antworten
    // gleich". Gemessen an DEMSELBEN Fußnoteninhalt, einmal in jeder Rolle. Genau hier gingen sie
    // bis Runde 6 auseinander: der Klickweg verweigerte ihn, der automatische überschrieb ihn.
    const inhalt = '<figure><img src="/api/objects/innen/raw"><figcaption></figcaption></figure>';

    // Rolle 1 — ZIELPLATZHALTER am Klickweg: wird nicht geräumt, das Bild ist kein Kandidat.
    const klick = wurzelMit(
      [
        VERWAISTE,
        '<figure data-image-id="kw-img-1">',
        '<img src="/api/objects/aussen/raw" data-image-id="kw-img-1">',
        `<figcaption data-image-id="kw-img-1">${inhalt}</figcaption></figure>`,
      ].join(""),
    );
    const verwaist = fussnoteMitText(klick, "Verwaister Text");
    expect(zuordnungsgrund(verwaist, bildMitQuelle(klick, "/api/objects/aussen/raw"), klick)).toBe(
      "unklar",
    );

    // Rolle 2 — ANKERFUSSNOTE am automatischen Weg: wird nicht überschrieben, das Bild bleibt in
    // einer Fußnote stehen statt durch die wandernde Beschreibung ersetzt zu werden.
    const automatisch = wurzelMit(ANKER_MIT_BILD_IN_DER_FUSSNOTE);
    ensureImageAnchors(automatisch);
    const innen = bildMitQuelle(automatisch, "/api/objects/innen/raw");
    expect(
      innen.closest("figcaption"),
      "die Bildeinheit steht nicht mehr in der Fußnote — sie wurde überschrieben",
    ).not.toBeNull();
  });

  it("V3 · der Gegenfall: eine WIRKLICH leere Ankerfußnote wird weiterhin freigegeben", () => {
    // Ohne diesen Fall wären V1/V2 auch mit einem `offenerAnker` grün, der gar nichts mehr
    // freigibt — dann stünde die wandernde Beschreibung nie bei ihrem Bild. Der Körper
    // unterscheidet sich in genau einem Punkt: in der Ankerfußnote steht nichts.
    const el = wurzelMit(
      [
        "<figure>",
        '<figure><img src="/api/objects/aussen/raw"><figcaption>\n  </figcaption></figure>',
        "<figcaption>Wandernde Beschreibung</figcaption></figure>",
      ].join(""),
    );
    ensureImageAnchors(el);
    const bild = bildMitQuelle(el, "/api/objects/aussen/raw");
    expect(
      captionForImage(bild, el)?.textContent?.trim(),
      "der leere Anker hat die wandernde Beschreibung nicht aufgenommen",
    ).toBe("Wandernde Beschreibung");
  });
});
