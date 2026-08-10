// @vitest-environment jsdom
// AUFTRAG-mega89 Block B — DIE PAARUNG BILD↔FUSSNOTE, AN VERSCHACHTELTEM MARKUP GEMESSEN.
//
// WARUM DIESE DATEI NEBEN DEM GEMOUNTETEN BELEG STEHT, und das ist die eigentliche Überlegung:
// Block A sorgt dafür, dass im Editor gar keine Verschachtelung mehr ENTSTEHT. Ein gemounteter Test
// könnte die Paarung deshalb nie an einer verschachtelten Struktur prüfen — die Verankerung löst sie
// beim Laden auf, bevor irgendjemand paart. Eine Gegenmutation, die wieder über Nachfahren sucht,
// bliebe dort GRÜN, und der Wächter wäre eine Behauptung.
//
// Hier werden die beiden Paarungsfunktionen deshalb DIREKT an genau der Struktur gefahren, gegen die
// sie gebaut sind. Das ist die zweite Sicherung, und sie ist keine Doppelung: sie trägt auch für
// Markup, das nie durch die Verankerung gelaufen ist — eine abgelöste Fußnote im offenen Formular,
// ein Ausschnitt aus fremder Hand, ein Body aus einer anderen Quelle.
//
// GEMESSEN WERDEN BEIDE ZWEIGE EINZELN, weil eine Gegenmutation sonst vom jeweils anderen gedeckt
// würde: einmal MIT Kennungen (der Kennungs-Zweig trägt) und einmal OHNE (dann muss `:scope >`
// tragen — genau die Stelle, an der vor mega89 der Nachfahren-Zugriff stand).
import { describe, expect, it } from "vitest";
import {
  type EditableElement,
  captionForImage,
  imageForCaption,
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

function bilder(root: ElementLike): ElementLike[] {
  return Array.from(root.querySelectorAll("img"));
}
function fussnoten(root: ElementLike): ElementLike[] {
  return Array.from(root.querySelectorAll("figcaption"));
}
function text(el: EditableElement | null): string {
  return (el?.textContent ?? "").trim();
}

// Die Struktur, die die Fassung vor mega89 erzeugt hat: die figure des zweiten Bildes liegt
// INNERHALB der ersten, und die innere Fußnote steht in Dokumentreihenfolge VOR der äußeren.
const VERSCHACHTELT_MIT_KENNUNG = [
  '<figure><img src="/api/objects/bild-a/raw" data-image-id="kw-img-alt-1">',
  '<figure><img src="/api/objects/bild-b/raw" data-image-id="kw-img-alt-2">',
  '<figcaption data-image-id="kw-img-alt-2">Lagerschale, Innenring</figcaption></figure>',
  '<figcaption data-image-id="kw-img-alt-1">Riefen in Laufrichtung</figcaption></figure>',
].join("");

// Dieselbe Lage, aber ohne jede Kennung: so kommt ein Ausschnitt aus fremder Hand herein, bevor die
// Verankerung gelaufen ist. Hier trägt ausschließlich `:scope >`.
const VERSCHACHTELT_OHNE_KENNUNG = [
  '<figure><img src="/api/objects/bild-a/raw">',
  '<figure><img src="/api/objects/bild-b/raw">',
  "<figcaption>Lagerschale, Innenring</figcaption></figure>",
  "<figcaption>Riefen in Laufrichtung</figcaption></figure>",
].join("");

// Dieselbe Verschachtelung, aber die INNERE figure steht VORN. Das ist die Lage, die die beiden
// Bauformen wirklich unterscheidet: ein Nachfahren-Zugriff von der äußeren figure aus trifft in
// Dokumentreihenfolge zuerst das INNERE Bild und die INNERE Fußnote — also beide Male den falschen
// Partner. Stünde die innere figure hinten, käme ein Nachfahren-Zugriff für das erste Bild zufällig
// richtig heraus, und eine Gegenmutation bliebe unbemerkt. Genau deshalb steht dieser Fall hier.
const INNERE_ZUERST_OHNE_KENNUNG = [
  "<figure>",
  '<figure><img src="/api/objects/bild-b/raw">',
  "<figcaption>Lagerschale, Innenring</figcaption></figure>",
  '<img src="/api/objects/bild-a/raw">',
  "<figcaption>Riefen in Laufrichtung</figcaption></figure>",
].join("");

describe("AUFTRAG-mega89 Block B: über die Kennung — die robustere Form", () => {
  it("Bild 1 findet SEINE Fußnote, nicht die innere des zweiten", () => {
    const root = wurzelMit(VERSCHACHTELT_MIT_KENNUNG);
    const [erstes, zweites] = bilder(root);
    expect(erstes).toBeDefined();
    expect(
      text(erstes === undefined ? null : captionForImage(erstes, root)),
      "Bild 1 hat die Beschreibung von Bild 2 bekommen — genau der Datenschaden aus sammel88",
    ).toBe("Riefen in Laufrichtung");
    expect(text(zweites === undefined ? null : captionForImage(zweites, root))).toBe(
      "Lagerschale, Innenring",
    );
  });

  it("jede Fußnote findet IHR Bild", () => {
    const root = wurzelMit(VERSCHACHTELT_MIT_KENNUNG);
    const [innere, aeussere] = fussnoten(root);
    expect(innere).toBeDefined();
    expect(
      (aeussere === undefined ? null : imageForCaption(aeussere, root))?.getAttribute("src"),
      "Die äußere Fußnote zeigt auf das innere Bild",
    ).toBe("/api/objects/bild-a/raw");
    expect((innere === undefined ? null : imageForCaption(innere, root))?.getAttribute("src")).toBe(
      "/api/objects/bild-b/raw",
    );
  });
});

describe("AUFTRAG-mega89 Block B: ohne Kennung — dann trägt das DIREKTE Kind", () => {
  it("Bild 1 findet die Fußnote seiner EIGENEN figure-Ebene", () => {
    const root = wurzelMit(VERSCHACHTELT_OHNE_KENNUNG);
    const [erstes, zweites] = bilder(root);
    expect(
      text(erstes === undefined ? null : captionForImage(erstes, root)),
      "Ohne Kennung wurde wieder über einen beliebigen Nachfahren gesucht",
    ).toBe("Riefen in Laufrichtung");
    expect(text(zweites === undefined ? null : captionForImage(zweites, root))).toBe(
      "Lagerschale, Innenring",
    );
  });

  it("jede Fußnote findet das Bild ihrer EIGENEN figure-Ebene", () => {
    const root = wurzelMit(VERSCHACHTELT_OHNE_KENNUNG);
    const [innere, aeussere] = fussnoten(root);
    expect(
      (aeussere === undefined ? null : imageForCaption(aeussere, root))?.getAttribute("src"),
    ).toBe("/api/objects/bild-a/raw");
    expect((innere === undefined ? null : imageForCaption(innere, root))?.getAttribute("src")).toBe(
      "/api/objects/bild-b/raw",
    );
  });

  it("innere figure ZUERST: beide Richtungen treffen trotzdem den eigenen Partner", () => {
    const root = wurzelMit(INNERE_ZUERST_OHNE_KENNUNG);
    // Reihenfolge im Baum: erst das INNERE Bild/die innere Fußnote, dann die äußeren.
    const [inneresBild, aeusseresBild] = bilder(root);
    const [innereFussnote, aeussereFussnote] = fussnoten(root);
    expect(
      text(aeusseresBild === undefined ? null : captionForImage(aeusseresBild, root)),
      "Das äußere Bild hat die INNERE Fußnote bekommen — Suche über einen beliebigen Nachfahren",
    ).toBe("Riefen in Laufrichtung");
    expect(text(inneresBild === undefined ? null : captionForImage(inneresBild, root))).toBe(
      "Lagerschale, Innenring",
    );
    expect(
      (aeussereFussnote === undefined
        ? null
        : imageForCaption(aeussereFussnote, root)
      )?.getAttribute("src"),
      "Die äußere Fußnote zeigt auf das INNERE Bild — Suche über einen beliebigen Nachfahren",
    ).toBe("/api/objects/bild-a/raw");
    expect(
      (innereFussnote === undefined ? null : imageForCaption(innereFussnote, root))?.getAttribute(
        "src",
      ),
    ).toBe("/api/objects/bild-b/raw");
  });

  it("ohne Wurzel bleibt nur das direkte Kind — und es reicht", () => {
    // So wird die Paarung im Formular aufgerufen, wenn der Editor-Knoten (noch) nicht da ist.
    const root = wurzelMit(VERSCHACHTELT_OHNE_KENNUNG);
    const [erstes] = bilder(root);
    expect(text(erstes === undefined ? null : captionForImage(erstes, null))).toBe(
      "Riefen in Laufrichtung",
    );
  });
});

describe("AUFTRAG-mega89 Block B: die flache Normalform bleibt unberührt", () => {
  const FLACH = [
    '<figure><img src="/api/objects/bild-a/raw" data-image-id="kw-img-alt-1">',
    '<figcaption data-image-id="kw-img-alt-1">Riefen in Laufrichtung</figcaption></figure>',
    '<figure><img src="/api/objects/bild-b/raw" data-image-id="kw-img-alt-2">',
    '<figcaption data-image-id="kw-img-alt-2">Lagerschale, Innenring</figcaption></figure>',
  ].join("");

  it("jedes Bild seine Fußnote, jede Fußnote ihr Bild", () => {
    const root = wurzelMit(FLACH);
    for (const img of bilder(root)) {
      const cap = captionForImage(img, root);
      expect(cap?.getAttribute("data-image-id")).toBe(img.getAttribute("data-image-id"));
      expect(cap === null ? null : imageForCaption(cap, root)).toBe(img);
    }
  });

  it("ein Bild ohne Fußnote liefert null statt einer fremden", () => {
    const root = wurzelMit('<figure><img src="/api/objects/bild-a/raw"></figure>');
    const [erstes] = bilder(root);
    expect(erstes === undefined ? "kein Bild" : captionForImage(erstes, root)).toBeNull();
  });
});
