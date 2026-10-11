// ==================================================================================================
// BILDSCHIRMABLÄUFE · K4 — SCHWÄRZEN ÜBERSCHREIBT PIXEL, ES LEGT NICHTS DARÜBER.
// ==================================================================================================
//
// `schwaerzePixel` ist die Regel, die `schwaerzeBild` (`apps/web/src/lib/ablaufBild.ts`) im Browser
// auf die Canvas-Pixel anwendet, bevor das Bild NEU kodiert wird. Hier wird belegt: im Bereich steht
// danach deckendes Schwarz, ausserhalb bleibt alles, Rand und Rundung lassen keine halb lesbare Kante,
// und ein Rahmen ausserhalb des Bildes ändert nichts. Die Neukodierung im echten Browser belegt
// `tests-smoke/bildschirmablauf-browser.spec.ts`.
import { describe, expect, it } from "vitest";
import { begrenzeRechteck, schwaerzePixel } from "../../apps/web/src/lib/ablaufSchwaerzen";

function bild(breite: number, hoehe: number): Uint8ClampedArray {
  // Ein „Text" aus hellen Pixeln mit eindeutigem Wert je Stelle.
  const d = new Uint8ClampedArray(breite * hoehe * 4);
  for (let i = 0; i < breite * hoehe; i++) {
    d[i * 4] = 200;
    d[i * 4 + 1] = (i * 7) % 256;
    d[i * 4 + 2] = 90;
    d[i * 4 + 3] = 255;
  }
  return d;
}

function pixel(d: Uint8ClampedArray, breite: number, x: number, y: number): number[] {
  const i = (y * breite + x) * 4;
  return [d[i] ?? -1, d[i + 1] ?? -1, d[i + 2] ?? -1, d[i + 3] ?? -1];
}

describe("K4 · Schwärzen im Bild", () => {
  it("setzt jeden Pixel des Bereichs auf deckendes Schwarz und lässt den Rest unverändert", () => {
    const b = 10;
    const h = 8;
    const vorher = bild(b, h);
    const d = vorher.slice();
    const anzahl = schwaerzePixel(d, b, h, { x: 2, y: 3, breite: 4, hoehe: 2 });
    expect(anzahl).toBe(8);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < b; x++) {
        const drin = x >= 2 && x < 6 && y >= 3 && y < 5;
        if (drin) {
          expect(pixel(d, b, x, y)).toEqual([0, 0, 0, 255]);
        } else {
          expect(pixel(d, b, x, y)).toEqual(pixel(vorher, b, x, y));
        }
      }
    }
  });

  it("rundet nach aussen und begrenzt auf das Bild — keine halb lesbare Kante", () => {
    expect(begrenzeRechteck({ x: 1.6, y: 0.2, breite: 2.1, hoehe: 1.1 }, 10, 10)).toEqual({
      x: 1,
      y: 0,
      breite: 3,
      hoehe: 2,
    });
    // Rückwärts gezogen (negative Breite) und über den Rand hinaus.
    expect(begrenzeRechteck({ x: 9, y: 9, breite: -4, hoehe: 5 }, 10, 10)).toEqual({
      x: 5,
      y: 9,
      breite: 4,
      hoehe: 1,
    });
    expect(begrenzeRechteck({ x: 20, y: 20, breite: 5, hoehe: 5 }, 10, 10)).toBeNull();
  });

  it("ein Rahmen ausserhalb des Bildes ändert keinen Pixel", () => {
    const vorher = bild(4, 4);
    const d = vorher.slice();
    expect(schwaerzePixel(d, 4, 4, { x: 10, y: 10, breite: 3, hoehe: 3 })).toBe(0);
    expect([...d]).toEqual([...vorher]);
  });
});
