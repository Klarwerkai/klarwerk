// @vitest-environment jsdom
// AUFTRAG-huelle3 — DIE FAIL-SAFE-ZUSAGE HAT ZWEI KANTEN, UND BEIDE HEISSEN „NICHT RATEN".
//
// `huelle2` hat die geordnete Struktur-Paarung gebaut und die Zusage formuliert: ein Platz ist nur
// OFFEN, wenn an ihm nichts steht, das überschrieben werden müsste. ben hat sie in `sammel99` an
// zwei Stellen als NICHT EINGEHALTEN nachgewiesen, der Kopf hat beide am Quelltext bestätigt.
//
// H2-01 — EINE VORHANDENE INNERE KENNUNG KANN STILL VERWORFEN WERDEN. Die Offenheit wurde
// ABSCHLIESSEND entschieden, bevor die gepaarte äußere Fußnote überhaupt bekannt war: verglichen
// wurde nur die Kennung des BILDES mit der des inneren Ankers. Hat das Bild keine, galt der Platz
// als offen — auch dann, wenn die leere innere Fußnote bereits die Kennung `X` trug. Die eindeutig
// übrig gebliebene äußere Fußnote mit Kennung `Y` wurde danach über Stufe 2b gepaart, gewann in der
// Prioritätsregel (leeres `bildId`, `capId` vor `ankerId`) und ERSETZTE die leere innere Fußnote
// samt ihrer Kennung `X`. Text ging dabei nicht verloren — ZUORDNUNGSWAHRHEIT schon: die Behauptung
// „diese Beschreibung gehört zu diesem Bild" hat niemand belegt, und die Spur von `X` war weg.
//
// H2-02 — NUR DIE ERSTE DIREKTE FUSSNOTE EINES ANKERS WURDE GESEHEN. An drei Stellen stand
// `querySelector(":scope > figcaption")`, und alle drei sehen genau den ersten Treffer. Bei fremdem
// oder beschädigtem Markup mit MEHREREN direkten Fußnoten kann die erste leer und verträglich sein,
// während eine spätere gefüllt ist oder eine widersprüchliche Kennung trägt. Der Platz galt trotzdem
// als offen; danach standen zwei Beschreibungen am selben Anker.
//
// WARUM DIESE PROBEN UND NICHT DIE VORHANDENEN: die Bühnen aus `huelle2` bauen ausnahmslos GENAU
// EINE innere `figcaption`, und in der einzigen Bühne mit innerer Kennung tragen Bild und Anker
// dieselbe. Beide Kanten sind für sie unsichtbar. Eine Bühne, die nur den günstigen Fall baut, gilt
// als nicht gebaut.
//
// JE PROBE VIER NACHWEISE, und sie werden einzeln benannt:
//   1. TEXT ERHALTEN — jeder vorhandene Beschreibungstext steht danach genau einmal im Dokument.
//   2. KENNUNG EINDEUTIG UND NICHT ÜBERSCHRIEBEN — keine `data-image-id` doppelt, und keine
//      vorhandene wurde durch eine andere ersetzt.
//   3. SICHTBARKEIT — nichts verschwindet still; was nicht zugeordnet werden kann, steht sichtbar da.
//   4. FIXPUNKT — ein zweiter Lauf ändert nichts und meldet keine Wirkung.
//
// UND DIE REGEL DIESER KETTE GILT WEITER: wo eine Reihenfolge oder eine Anzahl das Ergebnis
// beeinflussen kann, werden BEIDE Richtungen beziehungsweise MEHR ALS EINS geprüft. Deshalb steht
// zu jeder Kante auch die Gegenrichtung: die verträgliche Lage, in der die Verschiebung
// STATTFINDEN MUSS. Eine Schranke, die immer schließt, ist keine Schranke, sondern ein Ausfall.
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

const X = "kw-img-innen-1";
const Y = "kw-img-aussen-9";
const Z = "kw-img-zweite-3";

const AUSSEN = "Aussen";
const ZWEITE = "Zweite Beschreibung";

// ── Die vier Nachweise als Messungen, nicht als Behauptungen ──────────────────────────────────────

/** NACHWEIS 1: wie oft steht dieser Text im Dokument? Erwartet ist immer genau einmal. */
function textVorkommen(root: ElementLike, text: string): number {
  return Array.from(root.querySelectorAll("figcaption")).filter(
    (cap) => (cap.textContent ?? "").trim() === text,
  ).length;
}

/** NACHWEIS 2: jede vergebene Kennung steht an höchstens EINEM Bild und höchstens EINER Fußnote. */
function kennungenSindEindeutig(root: ElementLike): string[] {
  const klagen: string[] = [];
  for (const selektor of ["img", "figcaption"]) {
    const gesehen = new Map<string, number>();
    for (const el of root.querySelectorAll(`${selektor}[data-image-id]`)) {
      const id = el.getAttribute("data-image-id") ?? "";
      gesehen.set(id, (gesehen.get(id) ?? 0) + 1);
    }
    for (const [id, anzahl] of gesehen) {
      if (anzahl > 1) {
        klagen.push(`${anzahl}× <${selektor} data-image-id="${id}">`);
      }
    }
  }
  return klagen;
}

/**
 * NACHWEIS 3a: die Fußnoten, die von KEINEM Bild gefunden werden — der sichtbar erhaltene Rest aus
 * Stufe 3. Gemessen über `captionForImage`, also über DIE Funktion, die auch das Formular benutzt.
 */
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

/**
 * NACHWEIS 3b — DIE KERNMESSUNG FÜR H2-02: wie viele GEFÜLLTE direkte Fußnoten hängen an ein und
 * demselben Anker? Mehr als eine bedeutet: an einem Bild stehen zwei Beschreibungen, und keine von
 * beiden sagt, welche gilt. Gemessen wird je `figure` über ALLE direkten `figcaption`-Kinder — genau
 * die Menge, die der Produktivcode bis huelle3 nicht gesehen hat.
 */
function ankerMitMehrerenBeschreibungen(root: ElementLike): string[] {
  const klagen: string[] = [];
  for (const figure of root.querySelectorAll("figure")) {
    const gefuellt = Array.from(figure.querySelectorAll(":scope > figcaption")).filter(
      (cap) => (cap.textContent ?? "").trim() !== "",
    );
    if (gefuellt.length > 1) {
      klagen.push(gefuellt.map((cap) => (cap.textContent ?? "").trim()).join(" + "));
    }
  }
  return klagen;
}

/** NACHWEIS 3c: steht dieser Text INNERHALB des inneren Ankers (also: ist er dorthin gewandert)? */
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

const ZELLE = (innen: string): string => `<table><tbody><tr><td>${innen}</td></tr></tbody></table>`;

// ==================================================================================================
// PROBE 1 (H2-01) — innerer Anker mit leerer Fußnote X + Bild OHNE Kennung + außen gefüllte Fußnote Y
// ==================================================================================================
//
// bens Minimalfall, wörtlich übernommen. `X` und `Y` widersprechen sich; jede Zuordnung müsste eine
// der beiden Wahrheiten überschreiben. Fail-safe ist deshalb: KEINE Verschiebung, die äußere Fußnote
// bleibt sichtbar in Stufe 3.

const INNEN_X_AUSSEN_Y = [
  "<figure>",
  ZELLE(`<figure><img src="${B}"><figcaption data-image-id="${X}"></figcaption></figure>`),
  `<figcaption data-image-id="${Y}">${AUSSEN}</figcaption>`,
  "</figure>",
].join("");

// DIE GEGENRICHTUNG DER REIHENFOLGE: dieselbe Lage, die äußere Fußnote steht VOR der Struktur. Die
// Schranke darf nicht davon abhängen, wer zuerst im Dokument steht.
const AUSSEN_Y_VOR_INNEN_X = [
  "<figure>",
  `<figcaption data-image-id="${Y}">${AUSSEN}</figcaption>`,
  ZELLE(`<figure><img src="${B}"><figcaption data-image-id="${X}"></figcaption></figure>`),
  "</figure>",
].join("");

describe("AUFTRAG-huelle3 Probe 1 (H2-01): innere Kennung X gegen äußere Kennung Y", () => {
  for (const [richtung, html] of [
    ["Struktur zuerst", INNEN_X_AUSSEN_Y],
    ["äußere Fußnote zuerst", AUSSEN_Y_VOR_INNEN_X],
  ] as const) {
    it(`${richtung} — NACHWEIS 1 (Text erhalten): der äußere Text steht genau einmal`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        textVorkommen(root, AUSSEN),
        "Der Text der äußeren Fußnote ist verschwunden oder steht doppelt im Dokument",
      ).toBe(1);
    });

    it(`${richtung} — NACHWEIS 2 (Kennung nicht überschrieben): X überlebt, Y bleibt bei seinem Text`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      const bild = Array.from(root.querySelectorAll("img"))[0];
      expect(
        bild?.getAttribute("data-image-id"),
        `Das Bild trägt nicht die Kennung seines vorhandenen inneren Ankers. Die leere innere Fußnote hatte bereits "${X}"; sie wurde samt Kennung durch die äußere Fußnote ersetzt, und danach behauptet "${Y}", die Beschreibung dieses Bildes zu sein. Das hat niemand belegt.`,
      ).toBe(X);
      const mitX = Array.from(root.querySelectorAll(`figcaption[data-image-id="${X}"]`));
      expect(
        mitX.length,
        `Die innere Fußnote mit der Kennung "${X}" ist verschwunden — ihre Kennung wurde still verworfen`,
      ).toBe(1);
      expect(
        (mitX[0]?.textContent ?? "").trim(),
        `Der äußere Text ist in die innere Fußnote "${X}" gewandert, obwohl er die Kennung "${Y}" trägt`,
      ).toBe("");
      const mitY = Array.from(root.querySelectorAll(`figcaption[data-image-id="${Y}"]`));
      expect(
        (mitY[0]?.textContent ?? "").trim(),
        `Die Fußnote mit der Kennung "${Y}" hat ihren Text verloren`,
      ).toBe(AUSSEN);
      expect(
        kennungenSindEindeutig(root),
        "Eine data-image-id steht an zwei Bildern oder an zwei Fußnoten",
      ).toEqual([]);
    });

    it(`${richtung} — NACHWEIS 3 (Sichtbarkeit): Y bleibt sichtbar stehen und wandert nicht in den Anker`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        stehtImAnker(root, AUSSEN),
        "Die äußere Fußnote ist in den inneren Anker gewandert, obwohl ihre Kennung der dort vorhandenen widerspricht",
      ).toBe(false);
      expect(
        verwaisteFussnoten(root),
        "Die widersprüchlich gekennzeichnete Fußnote ist nicht als sichtbarer Rest stehen geblieben — entweder wurde sie gepaart oder sie ist verschwunden",
      ).toEqual([{ id: Y, text: AUSSEN }]);
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

// DIE GEGENRICHTUNG DER VERTRÄGLICHKEIT — sie gehört zur Probe, nicht daneben. Trägt die äußere
// Fußnote KEINE Kennung, widerspricht sie nichts: die Verschiebung MUSS stattfinden, und die
// vorhandene innere Kennung `X` trägt beide Seiten. Ohne diesen Fall wäre eine Schranke, die
// grundsätzlich alles blockiert, ununterscheidbar von der richtigen Antwort.
const INNEN_X_AUSSEN_OHNE_KENNUNG = [
  "<figure>",
  ZELLE(`<figure><img src="${B}"><figcaption data-image-id="${X}"></figcaption></figure>`),
  `<figcaption>${AUSSEN}</figcaption>`,
  "</figure>",
].join("");

describe("AUFTRAG-huelle3 Probe 1, Gegenrichtung: kein Widerspruch → die Verschiebung findet statt", () => {
  it("die unmarkierte äußere Fußnote wandert in den inneren Anker und übernimmt dessen Kennung X", () => {
    const root = wurzelMit(INNEN_X_AUSSEN_OHNE_KENNUNG);
    ensureImageAnchors(root);
    expect(
      stehtImAnker(root, AUSSEN),
      "Die Verschiebung hat nicht stattgefunden, obwohl keine zwei Kennungen sich widersprechen — die Schranke blockiert pauschal statt gezielt",
    ).toBe(true);
    const bild = Array.from(root.querySelectorAll("img"))[0];
    expect(
      bild?.getAttribute("data-image-id"),
      "Das Bild hat eine NEUE Kennung bekommen, obwohl der innere Anker eine trug",
    ).toBe(X);
    expect(textVorkommen(root, AUSSEN), "Der Text steht nicht genau einmal").toBe(1);
    expect(verwaisteFussnoten(root), "Es ist eine verwaiste Fußnote zurückgeblieben").toEqual([]);
    expect(kennungenSindEindeutig(root), "Eine data-image-id wurde dupliziert").toEqual([]);
  });

  it("FIXPUNKT", () => {
    fixpunkt(INNEN_X_AUSSEN_OHNE_KENNUNG);
  });
});

// ==================================================================================================
// PROBE 2 (H2-02) — erste innere Fußnote leer, zweite gefüllt beziehungsweise mit abweichender Kennung
// ==================================================================================================
//
// Ein Anker mit MEHREREN direkten Fußnoten ist kein offener Platz. Die erste kann leer und
// verträglich sein — das sagt nichts über die zweite. Wer nur den ersten Treffer ansieht, schiebt
// eine zweite Beschreibung an ein Bild, das schon eine hat.

const ZWEITE_GEFUELLT = [
  "<figure>",
  ZELLE(
    `<figure><img src="${B}"><figcaption></figcaption><figcaption>${ZWEITE}</figcaption></figure>`,
  ),
  `<figcaption>${AUSSEN}</figcaption>`,
  "</figure>",
].join("");

const ZWEITE_MIT_ABWEICHENDER_KENNUNG = [
  "<figure>",
  ZELLE(
    [
      `<figure><img src="${B}" data-image-id="${X}">`,
      `<figcaption data-image-id="${X}"></figcaption>`,
      `<figcaption data-image-id="${Z}">${ZWEITE}</figcaption></figure>`,
    ].join(""),
  ),
  `<figcaption>${AUSSEN}</figcaption>`,
  "</figure>",
].join("");

// MEHR ALS EINS, UND IN BEIDEN REIHENFOLGEN: dieselbe Anzahl, umgekehrt sortiert. Steht die gefüllte
// Fußnote ZUERST, schloss der Platz schon vor huelle3 — die Kante lag genau in der anderen
// Reihenfolge. Ohne beide Richtungen misst die Probe nicht die Anzahl, sondern den Zufall.
const ERSTE_GEFUELLT_ZWEITE_LEER = [
  "<figure>",
  ZELLE(
    `<figure><img src="${B}"><figcaption>${ZWEITE}</figcaption><figcaption></figcaption></figure>`,
  ),
  `<figcaption>${AUSSEN}</figcaption>`,
  "</figure>",
].join("");

describe("AUFTRAG-huelle3 Probe 2 (H2-02): mehrere direkte Fußnoten an einem Anker", () => {
  for (const [name, html] of [
    ["erste leer, zweite GEFÜLLT", ZWEITE_GEFUELLT],
    ["erste leer mit X, zweite mit ABWEICHENDER Kennung", ZWEITE_MIT_ABWEICHENDER_KENNUNG],
    ["erste gefüllt, zweite leer (Gegenrichtung der Reihenfolge)", ERSTE_GEFUELLT_ZWEITE_LEER],
  ] as const) {
    it(`${name} — NACHWEIS 1 (Text erhalten): beide Texte stehen je genau einmal`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(textVorkommen(root, ZWEITE), "Der innere Text ist verloren oder steht doppelt").toBe(
        1,
      );
      expect(textVorkommen(root, AUSSEN), "Der äußere Text ist verloren oder steht doppelt").toBe(
        1,
      );
    });

    it(`${name} — NACHWEIS 2 (Kennung eindeutig): keine data-image-id doppelt`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        kennungenSindEindeutig(root),
        "Eine data-image-id steht an zwei Bildern oder an zwei Fußnoten",
      ).toEqual([]);
    });

    it(`${name} — NACHWEIS 3 (Sichtbarkeit): der Anker trägt nicht zwei Beschreibungen`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      expect(
        ankerMitMehrerenBeschreibungen(root),
        "An EINEM Anker stehen jetzt ZWEI gefüllte Beschreibungen. Die äußere Fußnote wurde hineingeschoben, weil nur die ERSTE direkte figcaption angesehen wurde — die zweite war für die Offenheitsprüfung unsichtbar. Der Nutzer sieht zwei Texte an einem Bild, und keiner sagt, welcher gilt.",
      ).toEqual([]);
      expect(
        stehtImAnker(root, AUSSEN),
        "Die äußere Fußnote ist in einen Anker gewandert, der bereits mehr als eine direkte Fußnote hat",
      ).toBe(false);
      expect(
        Array.from(root.querySelectorAll("table > tbody > tr > td")).length,
        "Die erhaltene Struktur wurde aufgelöst",
      ).toBe(1);
    });

    it(`${name} — NACHWEIS 4 (Fixpunkt): ein zweiter Lauf ändert nichts mehr`, () => {
      fixpunkt(html);
    });
  }
});
