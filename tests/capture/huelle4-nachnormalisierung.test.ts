// @vitest-environment jsdom
// AUFTRAG-huelle4 — DIE ZUSAGE ENDET NICHT AN DER WANDERUNG. DIE NACHNORMALISIERUNG GEHÖRT DAZU.
//
// DER BEFUND (ben in `sammel101/huelle3`, der letzte Ship-12-Blocker). `huelle3` hat die Wanderung
// fail-safe gemacht: widersprechen sich Bild- und innere Fußnotenkennung, schließt `offenerAnker`
// den Platz, und die äußere Fußnote bleibt sichtbar stehen. Das ist richtig — und es war nicht das
// Ende des Weges. NACH dem Flachmachen läuft für JEDES Bild die allgemeine Nachnormalisierung, und
// die kannte die Zusage nicht: sie sah genau die ERSTE direkte Fußnote, ließ bei vorhandener
// Bildkennung immer die Bildkennung gewinnen und schrieb sie in die Fußnote. Aus
//
//   <figure>
//     <table><tr><td><figure><img data-image-id="I"><figcaption data-image-id="X"></figcaption>
//     </figure></td></tr></table>
//     <figcaption data-image-id="Y">Aussen</figcaption>
//   </figure>
//
// wurde `X` still zu `I`. Der Text blieb sichtbar, die ZUORDNUNGSWAHRHEIT nicht: die Spur von `X`
// war weg, und niemand hatte je belegt, dass diese Fußnote zu diesem Bild gehört. Genau der Schaden
// aus `sammel89`, nur eine Etage später.
//
// WARUM DIE huelle3-PROBEN DAS NICHT SEHEN, und das ist die eigentliche Testlücke: ihre Bühne für
// diese Kante setzt am Bild BEWUSST KEINE Kennung. Dann gibt es in der Nachnormalisierung keinen
// Widerspruch — `X` steigt einfach aufs Bild. Die Kombination Bild `I` + innerer Anker `X` + äußere
// Fußnote `Y` kommt in keiner Bühne vor. Eine Bühne, die nur den günstigen Fall baut, gilt als
// nicht gebaut.
//
// ZWEI UNABHÄNGIGE SCHRANKEN WERDEN HIER GEPINNT, und jede hat ihre eigene Probe:
//   · KONFLIKTSCHRANKE — zwei verschiedene, nicht leere Kennungen unter Bild und direkten Fußnoten
//     einer figure: es wird NICHTS geschrieben, weder am Bild noch an einer Fußnote.
//   · MENGENPRÜFUNG — es zählen ALLE direkten Fußnoten, nicht die erste. Die erste kann leer und
//     verträglich sein, während eine spätere widerspricht; wer nur sie ansieht, macht eine beliebige
//     Fußnote zur alleinigen Wahrheit.
//
// JE PROBE DIESELBEN VIER NACHWEISE WIE IN huelle3, weil es dieselbe Zusage ist:
//   1. KENNUNGEN UNVERÄNDERT — jede vorhandene `data-image-id` steht danach genau dort, wo sie
//      vorher stand; keine wurde ersetzt, keine ist verschwunden.
//   2. TEXT UND SICHTBARKEIT — jeder Text steht genau einmal, nichts verschwindet still.
//   3. STRUKTUR — die erhaltene Tabelle bleibt, die äußere Fußnote wandert nicht hinein.
//   4. FIXPUNKT — ein zweiter Lauf ändert nichts und meldet keine Wirkung.
//
// UND DIE GEGENRICHTUNG GEHÖRT DAZU: eine Schranke, die immer schließt, ist keine Schranke, sondern
// ein Ausfall. Die verträglichen Lagen — leere Fußnote am gekennzeichneten Bild, gekennzeichnete
// Fußnote am unmarkierten Bild, beide leer, gar keine Fußnote, mehrere Fußnoten OHNE Widerspruch —
// müssen weiterhin genau das tun, was sie vorher taten.
import { describe, expect, it } from "vitest";
import {
  type EditableElement,
  captionForImage,
  ensureImageAnchors,
} from "../../apps/web/src/lib/editorFigures";

interface ElementLike extends EditableElement {
  innerHTML: string;
  querySelectorAll(selectors: string): Iterable<ElementLike>;
}
interface DocumentLike {
  createElement(tag: string): ElementLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

function wurzelMit(html: string): ElementLike {
  const el = doc.createElement("div");
  el.innerHTML = html;
  return el;
}

const B = "/api/objects/bild-b/raw";

const I = "kw-img-bild-7";
const X = "kw-img-innen-1";
const Y = "kw-img-aussen-9";
const Z = "kw-img-zweite-3";

const AUSSEN = "Aussen";
const ZWEITE = "Zweite Beschreibung";

const ZELLE = (innen: string): string => `<table><tbody><tr><td>${innen}</td></tr></tbody></table>`;

// ── Die Nachweise als Messungen, nicht als Behauptungen ───────────────────────────────────────────

/**
 * NACHWEIS 1: WELCHE Kennung steht an WELCHEM Knoten? Erhoben wird über alle Bilder und Fußnoten,
 * sortiert, damit die Aussage nicht an der Dokumentreihenfolge hängt (die der Umbau ändern DARF).
 * Eine still überschriebene Kennung fällt hier auf, eine verschwundene auch.
 */
function kennungsbild(root: ElementLike): string[] {
  const aus: string[] = [];
  for (const el of root.querySelectorAll("img, figcaption")) {
    const id = el.getAttribute("data-image-id");
    if (id !== null && id !== "") {
      aus.push(`${el.tagName.toLowerCase()}=${id}`);
    }
  }
  return aus.sort();
}

/** NACHWEIS 2a: wie oft steht dieser Text im Dokument? Erwartet ist immer genau einmal. */
function textVorkommen(root: ElementLike, text: string): number {
  return Array.from(root.querySelectorAll("figcaption")).filter(
    (cap) => (cap.textContent ?? "").trim() === text,
  ).length;
}

/** NACHWEIS 2b: die Fußnoten, die von KEINEM Bild gefunden werden — der sichtbare Rest aus Stufe 3. */
function verwaisteFussnoten(root: ElementLike): { id: string | null; text: string }[] {
  const gefunden = new Set<EditableElement>();
  for (const img of root.querySelectorAll("img")) {
    const cap = captionForImage(img, root);
    if (cap !== null) {
      gefunden.add(cap);
    }
  }
  const aus: { id: string | null; text: string }[] = [];
  for (const cap of root.querySelectorAll("figcaption")) {
    if (!gefunden.has(cap)) {
      aus.push({ id: cap.getAttribute("data-image-id"), text: (cap.textContent ?? "").trim() });
    }
  }
  return aus;
}

/** NACHWEIS 3: steht dieser Text INNERHALB des inneren Ankers (also: ist er dorthin gewandert)? */
function stehtImAnker(root: ElementLike, text: string): boolean {
  for (const figure of root.querySelectorAll("table figure")) {
    for (const cap of figure.querySelectorAll(":scope > figcaption")) {
      if ((cap.textContent ?? "").trim() === text) {
        return true;
      }
    }
  }
  return false;
}

/** NACHWEIS 4: ein zweiter Lauf darf nichts mehr verändern und keine Wirkung mehr melden. */
function fixpunkt(html: string): void {
  const root = wurzelMit(html);
  ensureImageAnchors(root);
  const einmal = root.innerHTML;
  const nochmal = ensureImageAnchors(root);
  expect(
    root.innerHTML,
    "Der zweite Lauf hat den Inhalt erneut verändert — bei jedem Öffnen des Entwurfs verschiebt sich etwas",
  ).toBe(einmal);
  expect(nochmal, "Der zweite Lauf meldet Wirkung, obwohl es nichts zu tun gab").toBe(0);
}

/** Die direkten Fußnoten EINER figure in Dokumentreihenfolge — die Menge, um die es hier geht. */
function direkteFussnoten(root: ElementLike, figureSelektor: string): ElementLike[] {
  const figure = Array.from(root.querySelectorAll(figureSelektor))[0];
  if (figure === undefined) {
    throw new Error(`Die Bühne hat keine figure für "${figureSelektor}"`);
  }
  return Array.from(figure.querySelectorAll(":scope > figcaption"));
}

// ==================================================================================================
// PROBE 1 (KONFLIKTSCHRANKE) — Bild `I`, innerer Anker `X`, äußere Fußnote `Y`
// ==================================================================================================
//
// bens Minimalfall aus sammel101, wörtlich. Drei Kennungen, drei Wahrheiten, keine davon darf
// verschwinden. Beide Dokumentreihenfolgen, weil eine Schranke nicht davon abhängen darf, wer
// zuerst im Dokument steht.

const INNEN_X_AUSSEN_Y = [
  "<figure>",
  ZELLE(
    `<figure><img src="${B}" data-image-id="${I}"><figcaption data-image-id="${X}"></figcaption></figure>`,
  ),
  `<figcaption data-image-id="${Y}">${AUSSEN}</figcaption>`,
  "</figure>",
].join("");

const AUSSEN_Y_VOR_INNEN_X = [
  "<figure>",
  `<figcaption data-image-id="${Y}">${AUSSEN}</figcaption>`,
  ZELLE(
    `<figure><img src="${B}" data-image-id="${I}"><figcaption data-image-id="${X}"></figcaption></figure>`,
  ),
  "</figure>",
].join("");

describe("AUFTRAG-huelle4 Probe 1 (Konfliktschranke): I, X und Y überleben die Nachnormalisierung", () => {
  for (const [richtung, html] of [
    ["Struktur zuerst", INNEN_X_AUSSEN_Y],
    ["äußere Fußnote zuerst", AUSSEN_Y_VOR_INNEN_X],
  ] as const) {
    it(`${richtung} — NACHWEIS 1 (Kennungen unverändert): I bleibt am Bild, X in der inneren Fußnote, Y an ihrem Text`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        kennungsbild(root),
        `Eine vorhandene Kennung wurde still überschrieben. Bild "${I}", innerer Anker "${X}" und äußere Fußnote "${Y}" widersprechen einander; jede Antwort auf die Frage "welche gilt?" überschreibt eine Wahrheit, die jemand gesetzt hat. Danach behauptet die überschriebene Fußnote eine Zugehörigkeit, die niemand belegt hat.`,
      ).toEqual([`figcaption=${X}`, `figcaption=${Y}`, `img=${I}`].sort());
      const innere = direkteFussnoten(root, "table figure");
      expect(innere.length, "Der innere Anker hat nicht mehr genau eine direkte Fußnote").toBe(1);
      expect(
        innere[0]?.getAttribute("data-image-id"),
        `Die Kennung "${X}" der inneren Fußnote wurde durch die Bildkennung ersetzt`,
      ).toBe(X);
      expect(
        (innere[0]?.textContent ?? "").trim(),
        `Der äußere Text ist in die innere Fußnote gewandert, obwohl "${Y}" der dortigen Kennung widerspricht`,
      ).toBe("");
    });

    it(`${richtung} — NACHWEIS 2 (Text und Sichtbarkeit): Y steht genau einmal und sichtbar`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        textVorkommen(root, AUSSEN),
        "Der Text der äußeren Fußnote ist verschwunden oder steht doppelt im Dokument",
      ).toBe(1);
      expect(
        verwaisteFussnoten(root),
        "Die widersprüchlich gekennzeichnete Fußnote ist nicht als sichtbarer Rest stehen geblieben — entweder wurde sie gepaart oder sie ist verschwunden",
      ).toEqual([{ id: Y, text: AUSSEN }]);
    });

    it(`${richtung} — NACHWEIS 3 (Struktur): die äußere Fußnote wandert nicht, die Tabelle bleibt`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        stehtImAnker(root, AUSSEN),
        "Die äußere Fußnote ist in den inneren Anker gewandert, obwohl ihre Kennung der dort vorhandenen widerspricht",
      ).toBe(false);
      expect(
        Array.from(root.querySelectorAll("table > tbody > tr > td")).length,
        "Die erhaltene Struktur wurde aufgelöst",
      ).toBe(1);
    });

    it(`${richtung} — NACHWEIS 4 (Fixpunkt): ein zweiter Lauf ändert nichts mehr`, () => {
      fixpunkt(html);
    });
  }
});

// DIE GEGENRICHTUNG DER KONFLIKTSCHRANKE, ohne Struktur und ohne Wanderung — die nackte
// Nachnormalisierung an einer flachen figure. Widerspricht nichts, MUSS sie schreiben.
describe("AUFTRAG-huelle4 Probe 1, Gegenrichtung: ohne Widerspruch normalisiert es weiter", () => {
  it("leere Fußnote am gekennzeichneten Bild bekommt dessen Kennung", () => {
    const root = wurzelMit(
      `<figure><img src="${B}" data-image-id="${I}"><figcaption></figcaption></figure>`,
    );
    ensureImageAnchors(root);
    expect(
      kennungsbild(root),
      "Die leere, unmarkierte Fußnote hat die Kennung ihres Bildes NICHT bekommen — die Schranke blockiert pauschal statt gezielt",
    ).toEqual([`figcaption=${I}`, `img=${I}`].sort());
  });

  it("gekennzeichnete Fußnote am unmarkierten Bild hebt ihre Kennung aufs Bild", () => {
    const root = wurzelMit(
      `<figure><img src="${B}"><figcaption data-image-id="${X}">${AUSSEN}</figcaption></figure>`,
    );
    ensureImageAnchors(root);
    expect(
      kennungsbild(root),
      "Das Bild hat eine NEUE Kennung bekommen, obwohl seine Fußnote eine trug",
    ).toEqual([`figcaption=${X}`, `img=${X}`].sort());
    expect(textVorkommen(root, AUSSEN), "Der Text ist verlorengegangen").toBe(1);
  });

  it("beide Seiten leer: es entsteht EINE neue, beidseitige Kennung", () => {
    const root = wurzelMit(`<figure><img src="${B}"><figcaption></figcaption></figure>`);
    ensureImageAnchors(root);
    const bild = Array.from(root.querySelectorAll("img"))[0]?.getAttribute("data-image-id") ?? "";
    const cap =
      Array.from(root.querySelectorAll("figcaption"))[0]?.getAttribute("data-image-id") ?? "";
    expect(bild, "Das Bild hat gar keine Kennung bekommen").not.toBe("");
    expect(cap, "Bild und Fußnote tragen nicht dieselbe neue Kennung").toBe(bild);
  });

  it("figure ohne Fußnote: die Fußnote entsteht mit der Bildkennung", () => {
    const root = wurzelMit(`<figure><img src="${B}" data-image-id="${I}"></figure>`);
    ensureImageAnchors(root);
    expect(
      kennungsbild(root),
      "Die fehlende Fußnote ist nicht entstanden oder trägt eine andere Kennung als ihr Bild",
    ).toEqual([`figcaption=${I}`, `img=${I}`].sort());
  });

  it("beidseitig dieselbe Kennung: es wird nichts geschrieben und nichts gemeldet", () => {
    const html = `<figure><img src="${B}" data-image-id="${I}"><figcaption data-image-id="${I}">${AUSSEN}</figcaption></figure>`;
    const root = wurzelMit(html);
    expect(ensureImageAnchors(root), "Ein bereits verankertes Bild wurde erneut angefasst").toBe(0);
    fixpunkt(html);
  });
});

// ==================================================================================================
// PROBE 2 (MENGENPRÜFUNG) — mehrere direkte Fußnoten, die erste sagt nicht die Wahrheit über die Menge
// ==================================================================================================
//
// Die figure ist FLACH (ein Bild, keine innere figure) — das Flachmachen fasst sie also gar nicht
// an, und was hier gemessen wird, ist ausschließlich die Nachnormalisierung. Beide Reihenfolgen,
// weil „die erste" genau die Frage ist: steht die widersprechende Kennung hinten, sieht ein Blick
// auf den ersten Treffer sie nicht; steht sie vorne, sieht er die andere nicht.

const ERSTE_LEER_ZWEITE_Z = [
  `<figure><img src="${B}" data-image-id="${I}">`,
  "<figcaption></figcaption>",
  `<figcaption data-image-id="${Z}">${ZWEITE}</figcaption></figure>`,
].join("");

const ERSTE_Z_ZWEITE_LEER = [
  `<figure><img src="${B}" data-image-id="${I}">`,
  `<figcaption data-image-id="${Z}">${ZWEITE}</figcaption>`,
  "<figcaption></figcaption></figure>",
].join("");

describe("AUFTRAG-huelle4 Probe 2 (Mengenprüfung): keine beliebige erste Fußnote wird zur Wahrheit", () => {
  for (const [name, html] of [
    ["widersprechende Kennung HINTEN", ERSTE_LEER_ZWEITE_Z],
    ["widersprechende Kennung VORNE", ERSTE_Z_ZWEITE_LEER],
  ] as const) {
    it(`${name} — NACHWEIS 1 (Kennungen unverändert): I und Z bleiben, die leere bleibt leer`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        kennungsbild(root),
        `An dieser figure hängen ZWEI direkte Fußnoten, und eine davon trägt die Kennung "${Z}". Es gibt keine Antwort auf die Frage, welche zum Bild "${I}" gehört — wer die erste nimmt, macht eine beliebige Fußnote zur alleinigen Wahrheit und überschreibt dabei eine vorhandene Kennung.`,
      ).toEqual([`figcaption=${Z}`, `img=${I}`].sort());
      const direkte = direkteFussnoten(root, "figure");
      expect(direkte.length, "Eine der beiden direkten Fußnoten ist verschwunden").toBe(2);
      const leere = direkte.filter((cap) => (cap.textContent ?? "").trim() === "");
      expect(leere.length, "Die leere Fußnote ist verschwunden oder hat Text bekommen").toBe(1);
      expect(
        leere[0]?.getAttribute("data-image-id"),
        `Der leeren Fußnote wurde die Bildkennung "${I}" zugeschrieben, obwohl daneben eine zweite Fußnote mit "${Z}" steht. Die Behauptung "diese leere Fußnote ist die Beschreibung dieses Bildes" hat niemand belegt.`,
      ).toBeNull();
    });

    it(`${name} — NACHWEIS 2 (Text und Sichtbarkeit): der vorhandene Text steht genau einmal`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(textVorkommen(root, ZWEITE), "Der Text ist verloren oder steht doppelt").toBe(1);
      expect(
        Array.from(root.querySelectorAll("figcaption")).length,
        "Es ist eine Fußnote verschwunden oder eine dazugekommen",
      ).toBe(2);
    });

    it(`${name} — NACHWEIS 4 (Fixpunkt): ein zweiter Lauf ändert nichts mehr`, () => {
      fixpunkt(html);
    });
  }
});

// DIE DRITTE LAGE DERSELBEN MENGE, und sie misst die andere Hälfte des Schadens: das Bild trägt
// KEINE Kennung, die erste Fußnote auch nicht, und die zweite trägt `Z`. Wer nur die erste ansieht,
// sieht in dieser figure gar keine Kennung — und erfindet eine NEUE, obwohl daneben eine steht. Das
// Bild zeigt danach auf die LEERE Fußnote, während die gefüllte verwaist daneben hängt.
const OHNE_BILDKENNUNG_ZWEITE_Z = [
  `<figure><img src="${B}">`,
  "<figcaption></figcaption>",
  `<figcaption data-image-id="${Z}">${ZWEITE}</figcaption></figure>`,
].join("");

describe("AUFTRAG-huelle4 Probe 2b (Mengenprüfung): keine neue Kennung neben einer vorhandenen", () => {
  it("NACHWEIS 1 (Kennungen): es entsteht keine neue Kennung, Z bleibt die einzige", () => {
    const root = wurzelMit(OHNE_BILDKENNUNG_ZWEITE_Z);
    ensureImageAnchors(root);
    expect(
      kennungsbild(root),
      `In dieser figure steht bereits die Kennung "${Z}". Trotzdem ist eine NEUE vergeben und der leeren ersten Fußnote zugeschrieben worden — weil nur der erste Treffer angesehen wurde und die zweite Fußnote unsichtbar blieb. Danach zeigt das Bild auf eine leere Beschreibung, und die vorhandene hängt verwaist daneben.`,
    ).toEqual([`figcaption=${Z}`, `img=${Z}`].sort());
  });

  it("NACHWEIS 2 (Sichtbarkeit): der vorhandene Text bleibt und wird dem Bild zugeordnet", () => {
    const root = wurzelMit(OHNE_BILDKENNUNG_ZWEITE_Z);
    ensureImageAnchors(root);
    expect(textVorkommen(root, ZWEITE), "Der Text ist verloren oder steht doppelt").toBe(1);
    const bild = Array.from(root.querySelectorAll("img"))[0];
    expect(bild, "Die Bühne hat kein Bild").toBeDefined();
    const cap = bild === undefined ? null : captionForImage(bild, root);
    expect(
      (cap?.textContent ?? "").trim(),
      "Das Bild zeigt auf eine leere Beschreibung, obwohl in derselben figure eine gefüllte mit Kennung steht",
    ).toBe(ZWEITE);
  });

  it("NACHWEIS 4 (Fixpunkt): ein zweiter Lauf ändert nichts mehr", () => {
    fixpunkt(OHNE_BILDKENNUNG_ZWEITE_Z);
  });
});

// DIE GEGENRICHTUNG DER MENGENPRÜFUNG: mehrere direkte Fußnoten OHNE Widerspruch. Auch hier wird
// nichts überschrieben — und die vorhandene, belegte Paarung bleibt auffindbar. „Mehr als eine"
// allein ist kein Grund, eine bestehende Zuordnung zu verlieren.
describe("AUFTRAG-huelle4 Probe 2, Gegenrichtung: mehrere Fußnoten ohne Widerspruch", () => {
  const OHNE_WIDERSPRUCH = [
    `<figure><img src="${B}" data-image-id="${I}">`,
    `<figcaption data-image-id="${I}">${AUSSEN}</figcaption>`,
    "<figcaption></figcaption></figure>",
  ].join("");

  it("die belegte Paarung bleibt erhalten und wird weiterhin gefunden", () => {
    const root = wurzelMit(OHNE_WIDERSPRUCH);
    ensureImageAnchors(root);
    expect(
      kennungsbild(root),
      "Die vorhandene, beidseitig belegte Paarung wurde verändert",
    ).toEqual([`figcaption=${I}`, `img=${I}`].sort());
    const bild = Array.from(root.querySelectorAll("img"))[0];
    expect(bild, "Die Bühne hat kein Bild").toBeDefined();
    const cap = bild === undefined ? null : captionForImage(bild, root);
    expect(
      (cap?.textContent ?? "").trim(),
      "Das Bild findet seine belegte Beschreibung nicht mehr",
    ).toBe(AUSSEN);
  });

  it("FIXPUNKT", () => {
    fixpunkt(OHNE_WIDERSPRUCH);
  });
});
