// ================================================================================================
// BILDSCHIRMABLÄUFE — SCHWÄRZEN IM BILD, NICHT DARÜBER.
// ================================================================================================
//
// Ein schwarzer Kasten ÜBER einem Bild (CSS, SVG-Overlay, zweite Ebene) lässt das Original
// auslesbar: wer die Datei speichert, hat die verdeckte Angabe. Deshalb werden hier die PIXEL des
// Bereichs überschrieben und das Bild NEU kodiert. Das Ergebnis enthält nur noch, was sichtbar ist —
// auch keine eingebetteten Metadaten oder Vorschaubilder des Originals (EXIF-Thumbnails), denn eine
// Canvas-Kodierung schreibt keine mit. Der Aufrufer ersetzt das alte Bild vollständig
// (`schrittBildSetzen`); eine Kopie des Originals bleibt weder im Ablauf noch im Rumpf.
//
// `schwaerzePixel` ist rein (testbar in Node); `schwaerzeBild` in `./ablaufBild.ts` braucht den
// Browser (Canvas) und wendet genau diese Funktion auf die Pixel des Bildes an.

/** Ein Bereich in BILDPIXELN (nicht in Anzeige-Pixeln). */
export interface Rechteck {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/** Begrenzt ein Rechteck auf das Bild und rundet nach aussen — ein Rand bleibt nie halb lesbar. */
export function begrenzeRechteck(r: Rechteck, breite: number, hoehe: number): Rechteck | null {
  const x0 = Math.max(0, Math.floor(Math.min(r.x, r.x + r.breite)));
  const y0 = Math.max(0, Math.floor(Math.min(r.y, r.y + r.hoehe)));
  const x1 = Math.min(breite, Math.ceil(Math.max(r.x, r.x + r.breite)));
  const y1 = Math.min(hoehe, Math.ceil(Math.max(r.y, r.y + r.hoehe)));
  if (x1 <= x0 || y1 <= y0) {
    return null;
  }
  return { x: x0, y: y0, breite: x1 - x0, hoehe: y1 - y0 };
}

/** Setzt jeden Pixel des Bereichs auf deckendes Schwarz (RGBA 0,0,0,255). */
export function schwaerzePixel(
  daten: Uint8ClampedArray,
  breite: number,
  hoehe: number,
  bereich: Rechteck,
): number {
  const r = begrenzeRechteck(bereich, breite, hoehe);
  if (!r) {
    return 0;
  }
  for (let y = r.y; y < r.y + r.hoehe; y++) {
    for (let x = r.x; x < r.x + r.breite; x++) {
      const i = (y * breite + x) * 4;
      daten[i] = 0;
      daten[i + 1] = 0;
      daten[i + 2] = 0;
      daten[i + 3] = 255;
    }
  }
  return r.breite * r.hoehe;
}
