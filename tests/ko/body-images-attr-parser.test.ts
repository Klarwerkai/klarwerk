// Teil C2 (bens P2-Nacharbeit aus sammel2/sammel5): Härtung des Attribut-Rohparsers in
// extractBodyImages — VERHALTEN unverändert (gleiche Galerie-Einträge), nur robuster gegen
// ungewöhnliche Attribut-Reihenfolge, Whitespace/Zeilenumbrüche, Quote-Arten und unquoted-Werte;
// Decoys (data-src/srcset) dürfen weiterhin NIE als Quelle gelesen werden.
import { describe, expect, it } from "vitest";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";

const SRC = "data:image/png;base64,QQ==";

describe("Teil C2: extractBodyImages — gehärteter Attribut-Parser", () => {
  it("Attribut-Reihenfolge ist egal (src vor/nach data-image-id)", () => {
    const a = `<figure><img src="${SRC}" data-image-id="kw-a"><figcaption data-image-id="kw-a">Eins</figcaption></figure>`;
    const b = `<figure><img data-image-id="kw-b" src="${SRC}"><figcaption data-image-id="kw-b">Zwei</figcaption></figure>`;
    const images = extractBodyImages(a + b);
    expect(images.map((i) => i.id)).toEqual(["kw-a", "kw-b"]);
    expect(images.every((i) => i.src === SRC)).toBe(true);
  });

  it("Whitespace inkl. Zeilenumbrüchen und Tabs um Attribute und = wird toleriert", () => {
    const html = `<figure><img\n\t data-image-id = "kw-a"\n  src =\n "${SRC}" ><figcaption data-image-id="kw-a">Eins</figcaption></figure>`;
    const images = extractBodyImages(html);
    expect(images.length).toBe(1);
    expect(images[0]?.id).toBe("kw-a");
    expect(images[0]?.src).toBe(SRC);
  });

  it("einfache Anführungszeichen und unquoted-Werte werden gelesen", () => {
    const single = `<figure><img data-image-id='kw-a' src='${SRC}'><figcaption data-image-id='kw-a'>Eins</figcaption></figure>`;
    expect(extractBodyImages(single)[0]?.src).toBe(SRC);
    const unquoted = `<figure><img data-image-id=kw-b src=/api/objects/abc/raw><figcaption data-image-id="kw-b">Zwei</figcaption></figure>`;
    const images = extractBodyImages(unquoted);
    expect(images[0]?.id).toBe("kw-b");
    expect(images[0]?.src).toBe("/api/objects/abc/raw");
  });

  it("Decoys: data-src und srcset werden NIE als Quelle gelesen", () => {
    // data-src statt src → kein gültiges Bild (keine echte Quelle).
    const dataSrcOnly = `<figure><img data-image-id="kw-a" data-src="${SRC}"><figcaption data-image-id="kw-a">Eins</figcaption></figure>`;
    expect(extractBodyImages(dataSrcOnly)).toEqual([]);
    // srcset zusätzlich zu src → die ECHTE src gewinnt, srcset wird ignoriert.
    const withSrcset = `<figure><img data-image-id="kw-b" srcset="javascript:x 1x" src="${SRC}"><figcaption data-image-id="kw-b">Zwei</figcaption></figure>`;
    const images = extractBodyImages(withSrcset);
    expect(images.length).toBe(1);
    expect(images[0]?.src).toBe(SRC);
  });

  it("unsichere Quellen bleiben draußen (Verhalten unverändert)", () => {
    const evil = `<figure><img data-image-id="kw-a" src="javascript:alert(1)"><figcaption data-image-id="kw-a">Eins</figcaption></figure>`;
    expect(extractBodyImages(evil)).toEqual([]);
  });
});
