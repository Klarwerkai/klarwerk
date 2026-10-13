// ================================================================================================
// OCR-E01 · DIE BILDMASSE AUS DEN BYTES (Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen).
// ================================================================================================
//
// Eine Markierung im Original braucht den Rahmen, in dem die Texterkennung ihre Wortrahmen geliefert
// hat (Pixel). Diese Datei liest ihn aus den Kopfdaten der Bildbytes — PNG, JPEG, GIF und WebP —,
// dazu die Drehangabe (EXIF-Orientierung), mit der ein Browser ein Foto gedreht anzeigt.
//
// DOM-FREI und nur lesend. Was nicht sicher lesbar ist, heißt `null` bzw. Orientierung `0`
// („unbekannt") — dann wird keine Position behauptet (`lib/bildFundstelle.ts`).

/** Ein erkanntes Wort mit seinem Rahmen in Pixeln der gelesenen Bildbytes. */
export interface WortPosition {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BildRahmen {
  /** Breite und Höhe der gespeicherten Pixel — ohne Anwendung einer Drehangabe. */
  breite: number;
  hoehe: number;
  /**
   * EXIF-Orientierung 1–8. `1` heißt: keine Drehangabe. `0` heißt: eine Drehangabe ist möglich,
   * aber nicht sicher lesbar — dann wird nicht markiert.
   */
  orientierung: number;
}

function u16be(b: Uint8Array, i: number): number {
  return ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
}

function u32be(b: Uint8Array, i: number): number {
  return u16be(b, i) * 0x10000 + u16be(b, i + 2);
}

function u16le(b: Uint8Array, i: number): number {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
}

function u24le(b: Uint8Array, i: number): number {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
}

function ascii(b: Uint8Array, i: number, n: number): string {
  let s = "";
  for (let k = 0; k < n; k += 1) {
    s += String.fromCharCode(b[i + k] ?? 0);
  }
  return s;
}

function gueltig(breite: number, hoehe: number, orientierung: number): BildRahmen | null {
  return breite > 0 && hoehe > 0 ? { breite, hoehe, orientierung } : null;
}

function png(b: Uint8Array): BildRahmen | null {
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") {
    return null;
  }
  const breite = u32be(b, 16);
  const hoehe = u32be(b, 20);
  // Ein `eXIf`-Abschnitt kann eine Drehangabe tragen; er steht vor den Bilddaten (`IDAT`).
  let i = 8;
  let orientierung = 1;
  while (i + 8 <= b.length) {
    const laenge = u32be(b, i);
    const typ = ascii(b, i + 4, 4);
    if (typ === "IDAT" || typ === "IEND") {
      break;
    }
    if (typ === "eXIf") {
      orientierung = tiffOrientierung(b, i + 8, laenge) ?? 0;
      break;
    }
    i += 12 + laenge;
  }
  return gueltig(breite, hoehe, orientierung);
}

function gif(b: Uint8Array): BildRahmen | null {
  const kopf = ascii(b, 0, 6);
  if (b.length < 10 || (kopf !== "GIF87a" && kopf !== "GIF89a")) {
    return null;
  }
  return gueltig(u16le(b, 6), u16le(b, 8), 1);
}

function webp(b: Uint8Array): BildRahmen | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") {
    return null;
  }
  const abschnitt = ascii(b, 12, 4);
  if (abschnitt === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) {
      return null;
    }
    return gueltig(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff, 1);
  }
  if (abschnitt === "VP8L") {
    if (b[20] !== 0x2f) {
      return null;
    }
    const b0 = b[21] ?? 0;
    const b1 = b[22] ?? 0;
    const b2 = b[23] ?? 0;
    const b3 = b[24] ?? 0;
    const breite = 1 + (((b1 & 0x3f) << 8) | b0);
    const hoehe = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return gueltig(breite, hoehe, 1);
  }
  if (abschnitt === "VP8X") {
    // Bit 3 der Merkmale: ein EXIF-Abschnitt ist vorhanden — die Drehangabe gilt dann als unbekannt.
    const exif = ((b[20] ?? 0) & 0x08) !== 0;
    return gueltig(1 + u24le(b, 24), 1 + u24le(b, 27), exif ? 0 : 1);
  }
  return null;
}

/** Die Orientierung (Tag 0x0112) aus einem TIFF-Block ab `start`; `null`, wenn nicht lesbar. */
function tiffOrientierung(b: Uint8Array, start: number, laenge: number): number | null {
  const ende = Math.min(b.length, start + laenge);
  if (start + 8 > ende) {
    return null;
  }
  const ordnung = ascii(b, start, 2);
  const le = ordnung === "II";
  if (!le && ordnung !== "MM") {
    return null;
  }
  const u16 = (i: number): number => (le ? u16le(b, i) : u16be(b, i));
  const u32 = (i: number): number =>
    le ? (u16le(b, i) | (u16le(b, i + 2) << 16)) >>> 0 : u32be(b, i);
  const ifd = start + u32(start + 4);
  if (ifd + 2 > ende) {
    return null;
  }
  const anzahl = u16(ifd);
  for (let k = 0; k < anzahl; k += 1) {
    const eintrag = ifd + 2 + k * 12;
    if (eintrag + 12 > ende) {
      return null;
    }
    if (u16(eintrag) === 0x0112) {
      const wert = u16(eintrag + 8);
      return wert >= 1 && wert <= 8 ? wert : null;
    }
  }
  return 1;
}

function jpeg(b: Uint8Array): BildRahmen | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) {
    return null;
  }
  let i = 2;
  let orientierung = 1;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      return null;
    }
    const marke = b[i + 1] ?? 0;
    if (marke === 0xff) {
      i += 1;
      continue;
    }
    if (marke === 0x01 || (marke >= 0xd0 && marke <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marke === 0xda || marke === 0xd9) {
      return null;
    }
    const laenge = u16be(b, i + 2);
    if (marke === 0xe1 && ascii(b, i + 4, 6) === "Exif\u0000\u0000") {
      orientierung = tiffOrientierung(b, i + 10, laenge - 8) ?? 0;
    }
    const sof =
      (marke >= 0xc0 && marke <= 0xc3) ||
      (marke >= 0xc5 && marke <= 0xc7) ||
      (marke >= 0xc9 && marke <= 0xcb) ||
      (marke >= 0xcd && marke <= 0xcf);
    if (sof) {
      return gueltig(u16be(b, i + 7), u16be(b, i + 5), orientierung);
    }
    i += 2 + laenge;
  }
  return null;
}

/** Breite, Höhe und Drehangabe der Bildbytes — `null` für ein nicht lesbares Format. */
export function bildRahmenAus(bytes: Uint8Array | null): BildRahmen | null {
  if (!bytes || bytes.length < 10) {
    return null;
  }
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") {
    return png(bytes);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return jpeg(bytes);
  }
  if (ascii(bytes, 0, 3) === "GIF") {
    return gif(bytes);
  }
  if (ascii(bytes, 0, 4) === "RIFF") {
    return webp(bytes);
  }
  return null;
}
