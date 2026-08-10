// @vitest-environment jsdom
// AUFTRAG-mega90 Block B — DER UMBAU VERLIERT NICHTS: TEXTKNOTEN UND BEHÄLTER.
//
// DER BEFUND (ben in sammel89, vom Kopf am Quelltext des Diffs nachgemessen). `einheitenVon` lief
// über `":scope > *"` und sah deshalb NUR Elementknoten. Aus
// `<figure>Hinweis<img><img><figcaption>…</figcaption></figure>` verschwand `Hinweis` ersatzlos —
// nicht sichtbar falsch, sondern still weg. Und der Behälter-Zweig stieg in jeden Behälter mit Bild
// rekursiv hinein und VERWARF den Behälter selbst: aus einer `<table>`, in der ein Bild steckt,
// blieb der Inhalt ohne Tabelle, mitsamt allen Attributen.
//
// Der Kommentar über der Typdefinition versprach dabei mehr, als der Code hielt: „unverändert
// durchgereicht" galt ausschließlich für bildfreie ELEMENT-Geschwister.
//
// WAS HIER GEMESSEN WIRD, und beides zusammen ist der Punkt:
//   · DER INHALT IST NACH DEM UMBAU NOCH DA — an derselben Stelle der Reihenfolge.
//   · UND EIN ZWEITER LAUF ÄNDERT NICHTS MEHR. Der Fixpunkt aus mega89 galt für die
//     Figure-STRUKTUR; er wird hier auf den Nicht-Element-Inhalt ausgedehnt. Ein Umbau, der bei
//     jedem Öffnen des Entwurfs Leerraum anhäuft oder Text verschiebt, wäre genauso ein Datenschaden
//     wie einer, der ihn wegwirft.
import { describe, expect, it } from "vitest";
import { type EditableElement, ensureImageAnchors } from "../../apps/web/src/lib/editorFigures";

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

const A = "/api/objects/bild-a/raw";
const B = "/api/objects/bild-b/raw";
const C = "/api/objects/bild-c/raw";

/**
 * Die FOLGE des Inhalts auf oberster Ebene, in Dokumentreihenfolge — Text als Text, jede flache
 * figure als ihr Bild plus Fußnotentext, alles andere als sein Tagname. Bewusst so gelesen, dass
 * eine Verschiebung auffällt und nicht nur ein Verlust: „ist noch da" allein wäre zu wenig.
 */
function folge(root: ElementLike): string[] {
  const aus: string[] = [];
  for (const kind of Array.from(root.childNodes)) {
    if (kind.nodeType === 3) {
      const text = kind.textContent ?? "";
      if (text.trim() !== "") {
        aus.push(`text:${text.trim()}`);
      }
      continue;
    }
    if (kind.nodeType !== 1) {
      continue;
    }
    const el = kind as ElementLike;
    if (el.tagName.toLowerCase() === "figure") {
      const img = el.querySelector(":scope > img");
      const cap = el.querySelector(":scope > figcaption");
      aus.push(`bild:${img?.getAttribute("src") ?? "?"}|${(cap?.textContent ?? "").trim()}`);
      continue;
    }
    aus.push(`${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim()}`);
  }
  return aus;
}

/** Trägt dieses Bild einen vollständigen Anker (figure + Fußnote mit derselben Kennung)? */
function verankert(img: ElementLike): boolean {
  const figure = img.closest("figure");
  const cap = figure?.querySelector(":scope > figcaption") ?? null;
  const id = img.getAttribute("data-image-id");
  return cap !== null && id !== null && id !== "" && cap.getAttribute("data-image-id") === id;
}

// ── Die Bühnen ────────────────────────────────────────────────────────────────────────────────────

const TEXT_UM_BILDER = [
  "<figure>Vorher",
  `<img src="${A}">Dazwischen`,
  `<img src="${B}">Danach`,
  "<figcaption>Beschreibung A</figcaption></figure>",
].join("");

const TABELLE_ZWISCHEN_BILDERN = [
  `<figure><img src="${A}">`,
  '<table class="kw-tabelle"><tbody><tr><td>Messwert 42</td></tr></tbody></table>',
  `<img src="${B}">`,
  "<figcaption>Beschreibung A</figcaption></figure>",
].join("");

// AUFTRAG-huelle Block A — DIESER TEST HAT SICH SELBST GESCHONT, und gleich doppelt. Die Bühne
// darüber weicht der Kante aus, an der die Grenze wirklich liegt: ihre Tabelle trägt
// `class="kw-tabelle"` (ein Attribut verhindert die Auflösung schon), UND es steckt gar kein Bild
// darin (ohne Bild läuft der Behälter-Zweig nie). Sie hat deshalb nie gemessen, was sie zu messen
// schien — der Fehler aus sammel92 lag die ganze Zeit daneben und blieb grün.
//
// Der Fall bleibt stehen, weil er etwas Eigenes prüft (die ATTRIBUTE einer Tabelle überleben den
// Umbau). Daneben steht jetzt die Kante selbst: eine Tabelle OHNE JEDES ATTRIBUT auf jeder Ebene,
// mit einem Bild in der Zelle. Die zweite Bedingung ist genauso nötig wie die erste: erst das
// direkte Bild A NEBEN der Tabelle macht die figure nicht-flach, sodass der Umbau überhaupt läuft.
const TABELLE_OHNE_ATTRIBUT = [
  `<figure><img src="${A}">`,
  `<table><tbody><tr><td><img src="${B}"></td></tr></tbody></table>`,
  "<figcaption>Beschreibung A</figcaption></figure>",
].join("");

// Ein Behälter, der Bild UND Text zusammen trägt — und dazu ein eigenes Attribut. Er trägt etwas
// Eigenes und wird deshalb NICHT aufgelöst.
const BEHAELTER_MIT_BILD_UND_TEXT = [
  `<figure><img src="${A}">`,
  `<p class="hinweis">Achtung <img src="${B}"> beachten</p>`,
  "<figcaption>Beschreibung A</figcaption></figure>",
].join("");

// Die durchlässige Hülle: ein `<p>` ohne jedes Attribut, das nichts als das Bild umschließt. Genau
// der Fall, für den der Behälter-Zweig gebaut wurde (Word-Markup).
const DURCHLAESSIGE_HUELLE = [
  `<figure><p><img src="${A}"></p><p><img src="${B}"></p>`,
  "<figcaption>Beschreibung A</figcaption></figure>",
].join("");

const DREI_EBENEN_MIT_TEXT = [
  `<figure>Ebene 1<img src="${A}">`,
  `<figure>Ebene 2<img src="${B}">`,
  `<figure>Ebene 3<img src="${C}"><figcaption>Innen</figcaption></figure>`,
  "<figcaption>Mitte</figcaption></figure>",
  "<figcaption>Aussen</figcaption></figure>",
].join("");

const ALLE_BUEHNEN: Readonly<Record<string, string>> = {
  TEXT_UM_BILDER,
  TABELLE_ZWISCHEN_BILDERN,
  TABELLE_OHNE_ATTRIBUT,
  BEHAELTER_MIT_BILD_UND_TEXT,
  DURCHLAESSIGE_HUELLE,
  DREI_EBENEN_MIT_TEXT,
};

// ── Die Zusicherungen ─────────────────────────────────────────────────────────────────────────────

describe("AUFTRAG-mega90 Block B: nackter Text überlebt den Umbau", () => {
  it("Text VOR, ZWISCHEN und NACH den Bildern steht danach noch da — an seiner Stelle", () => {
    const root = wurzelMit(TEXT_UM_BILDER);
    ensureImageAnchors(root);
    expect(
      folge(root),
      "Direkter Text einer eingehenden figure ist beim Flachmachen verschwunden oder verschoben worden",
    ).toEqual([
      "text:Vorher",
      `bild:${A}|Beschreibung A`,
      "text:Dazwischen",
      `bild:${B}|`,
      "text:Danach",
    ]);
  });

  it("Text mit Sonderzeichen bleibt TEXT und wird nicht zu Markup", () => {
    const root = wurzelMit(
      `<figure>A &lt; B &amp; C<img src="${A}"><img src="${B}"><figcaption>x</figcaption></figure>`,
    );
    ensureImageAnchors(root);
    expect(
      folge(root)[0],
      "Der Text wurde beim Wiedereinsetzen nicht escaped — ein '<' im Text zerreißt das erzeugte Markup",
    ).toBe("text:A < B & C");
    expect(Array.from(root.querySelectorAll("img")).length, "Ein Bild ist verloren gegangen").toBe(
      2,
    );
  });

  it("reine Einrückung wird verworfen, ein geschütztes Leerzeichen NICHT", () => {
    const eingerueckt = wurzelMit(
      `<figure>\n  <img src="${A}">\n  <img src="${B}">\n  <figcaption>x</figcaption>\n</figure>`,
    );
    ensureImageAnchors(eingerueckt);
    expect(folge(eingerueckt), "Die Einrückung aus dem Markup wurde als Inhalt behandelt").toEqual([
      `bild:${A}|x`,
      `bild:${B}|`,
    ]);

    const geschuetzt = wurzelMit(
      `<figure><img src="${A}"> <img src="${B}"><figcaption>x</figcaption></figure>`,
    );
    ensureImageAnchors(geschuetzt);
    expect(
      geschuetzt.innerHTML.includes(" ") || geschuetzt.innerHTML.includes("&nbsp;"),
      "Ein gesetztes geschütztes Leerzeichen wurde als Einrückung weggeworfen",
    ).toBe(true);
  });
});

describe("AUFTRAG-mega90 Block B: Behälter werden nicht still verworfen", () => {
  it("eine Tabelle zwischen zwei Bildern bleibt mitsamt Attribut und Inhalt stehen", () => {
    const root = wurzelMit(TABELLE_ZWISCHEN_BILDERN);
    ensureImageAnchors(root);
    expect(folge(root), "Die Tabelle ist verschwunden oder verschoben worden").toEqual([
      `bild:${A}|Beschreibung A`,
      "table:Messwert 42",
      `bild:${B}|`,
    ]);
    const tabelle = Array.from(root.querySelectorAll("table"))[0];
    expect(tabelle?.getAttribute("class"), "Die Attribute der Tabelle sind verloren").toBe(
      "kw-tabelle",
    );
  });

  it("AUFTRAG-huelle: eine Tabelle OHNE jedes Attribut, mit einem Bild in der Zelle, bleibt ebenso stehen", () => {
    const root = wurzelMit(TABELLE_OHNE_ATTRIBUT);
    ensureImageAnchors(root);
    const tabellen = Array.from(root.querySelectorAll("table"));
    expect(
      tabellen.length,
      "Die attributlose Tabelle wurde als bedeutungslose Hülle aufgelöst — Zeilen, Zellen und Tabelle sind weg",
    ).toBe(1);
    expect(
      Array.from(root.querySelectorAll("table > tbody > tr > td")).length,
      "Eine Ebene der Tabelle ist beim rekursiven Abräumen verloren gegangen",
    ).toBe(1);
    expect(
      Array.from(tabellen[0]?.querySelectorAll(`img[src="${B}"]`) ?? []).length,
      "Das Bild wurde aus der Zelle herausgerissen, statt an Ort und Stelle verankert zu werden",
    ).toBe(1);
    for (const img of root.querySelectorAll("img")) {
      expect(
        verankert(img),
        `Das Bild ${img.getAttribute("src")} hat keinen vollständigen Anker — der Nutzer klickt auf die Bildbeschreibung, und es passiert nichts`,
      ).toBe(true);
    }
  });

  it("ein Behälter mit Bild UND Text bleibt vollständig — und sein Bild wird an Ort und Stelle verankert", () => {
    const root = wurzelMit(BEHAELTER_MIT_BILD_UND_TEXT);
    ensureImageAnchors(root);
    const behaelter = Array.from(root.querySelectorAll("p.hinweis"))[0];
    expect(behaelter, "Der Behälter wurde still verworfen — mit ihm seine Klasse").toBeDefined();
    expect(
      (behaelter?.textContent ?? "").replace(/\s+/g, " ").trim(),
      "Der Text des Behälters ist verloren gegangen",
    ).toBe("Achtung beachten");
    expect(
      Array.from(behaelter?.querySelectorAll("img") ?? []).length,
      "Das Bild wurde aus dem Behälter herausgerissen",
    ).toBe(1);
    for (const img of root.querySelectorAll("img")) {
      expect(
        verankert(img),
        `Das Bild ${img.getAttribute("src")} hat keinen vollständigen Anker — der Nutzer klickt auf die Bildbeschreibung, und es passiert nichts`,
      ).toBe(true);
    }
  });

  it("eine durchlässige Hülle (kein Attribut, nichts als das Bild) wird weiterhin aufgelöst", () => {
    const root = wurzelMit(DURCHLAESSIGE_HUELLE);
    ensureImageAnchors(root);
    expect(
      folge(root),
      "Das nackte <p><img></p> aus Word-Markup wird nicht mehr aufgelöst — die vorhandene Fußnote fände ihr Bild nicht",
    ).toEqual([`bild:${A}|Beschreibung A`, `bild:${B}|`]);
  });
});

describe("AUFTRAG-mega90 Block B: drei Verschachtelungsebenen mit Text auf jeder Ebene", () => {
  it("kein Text einer Ebene geht verloren, und keine figure bleibt in einer figure", () => {
    const root = wurzelMit(DREI_EBENEN_MIT_TEXT);
    ensureImageAnchors(root);
    expect(
      Array.from(root.querySelectorAll("figure figure")).length,
      "Eine figure liegt noch in einer figure",
    ).toBe(0);
    expect(folge(root), "Der Text einer Verschachtelungsebene ist verschwunden").toEqual([
      "text:Ebene 1",
      `bild:${A}|Aussen`,
      "text:Ebene 2",
      `bild:${B}|Mitte`,
      "text:Ebene 3",
      `bild:${C}|Innen`,
    ]);
  });
});

describe("AUFTRAG-mega90 Block B: FIXPUNKT — auch für den Nicht-Element-Inhalt", () => {
  for (const [name, html] of Object.entries(ALLE_BUEHNEN)) {
    it(`${name}: ein zweiter Lauf ändert nichts mehr`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      const einmal = root.innerHTML;
      const nochmal = ensureImageAnchors(root);
      expect(
        root.innerHTML,
        "Der zweite Lauf hat den Inhalt erneut verändert — bei jedem Öffnen des Entwurfs verschiebt sich etwas",
      ).toBe(einmal);
      expect(nochmal, "Der zweite Lauf meldet Wirkung, obwohl es nichts zu tun gab").toBe(0);
    });
  }
});
