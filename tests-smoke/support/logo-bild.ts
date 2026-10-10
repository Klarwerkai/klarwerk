// ADMIN-15 · Fiktive Logodateien für die Prüfungen des Unternehmensprofils.
//
// Erzeugt werden ECHTE, vollständige PNG-Dateien (Signatur, IHDR, IDAT, IEND mit gültigen
// Prüfsummen) — ein Browser zeichnet sie, und der Server liest ihre Masse aus dem Kopf. Kein Bild
// stammt aus einem echten Unternehmen; „Nordtal" ist erfunden. Genutzt von der Smoke-Sonde und den
// Vitest-Prüfungen unter `tests/admin-unternehmensprofil/`.
import { deflateSync } from "node:zlib";
import sharp from "sharp";

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) {
    c = (CRC_TABELLE[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(typ: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const kopf = Buffer.from(typ, "ascii");
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(Buffer.concat([kopf, daten])));
  return Buffer.concat([laenge, kopf, daten, pruefsumme]);
}

/**
 * Ein PNG `breite × hoehe` (RGB): links ein Feld in `farbe`, rechts ein heller Balken — damit das
 * Bild nicht einfarbig ist und eine Vorschau sichtbar etwas zeigt.
 */
export function pngLogo(
  breite: number,
  hoehe: number,
  farbe: readonly [number, number, number] = [0x1e, 0x56, 0x31],
): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  const zeile = Buffer.alloc(1 + breite * 3);
  for (let x = 0; x < breite; x += 1) {
    const hell = x > breite * 0.6;
    zeile[1 + x * 3] = hell ? 0xe8 : farbe[0];
    zeile[2 + x * 3] = hell ? 0xf0 : farbe[1];
    zeile[3 + x * 3] = hell ? 0xe8 : farbe[2];
  }
  const roh = Buffer.concat(Array.from({ length: hoehe }, () => zeile));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Ein vollständiges, darstellbares JPEG `breite × hoehe` — erzeugt mit derselben Bibliothek wie der Server. */
export async function jpegLogo(breite: number, hoehe: number): Promise<Buffer> {
  return sharp({
    create: { width: breite, height: hoehe, channels: 3, background: { r: 31, g: 58, b: 95 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** Ein vollständiges JPEG, dem das letzte Drittel fehlt — Kopf und Masse heil, Bilddaten nicht. */
export async function jpegAbgeschnitten(breite: number, hoehe: number): Promise<Buffer> {
  const voll = await jpegLogo(breite, hoehe);
  return voll.subarray(0, Math.floor(voll.length * 0.6));
}

/** Nur Signatur und IHDR eines PNG (die ersten 33 Bytes) — Kopf heil, kein Bild darin. */
export function pngNurKopf(breite: number, hoehe: number): Buffer {
  return pngLogo(breite, hoehe).subarray(0, 33);
}

/** Ein PNG, dem die zweite Hälfte fehlt — abgeschnitten mitten in den Bilddaten. */
export function pngAbgeschnitten(breite: number, hoehe: number): Buffer {
  const voll = pngLogo(breite, hoehe);
  return voll.subarray(0, Math.floor(voll.length / 2));
}

/**
 * Nur ein JPEG-KOPF (SOI, SOF0 mit Massen, EOI) ohne Bilddaten. Seit Nacharbeit 5 ein NEGATIVFALL:
 * der Kopf nennt Masse, darstellbar ist er nicht.
 */
export function jpegKopf(breite: number, hoehe: number): Buffer {
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11,
    0x01,
  ]);
  sof.writeUInt16BE(hoehe, 5);
  sof.writeUInt16BE(breite, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

/** Eine SVG-Datei mit Skript — genau die Art Datei, die abgewiesen werden muss. */
export const SVG_MIT_SKRIPT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><script>alert(1)</script><text y="20">Nordtal</text></svg>',
  "utf8",
);

/** Als Nutzlast für `PUT /api/admin/unternehmensprofil`. */
export function alsLogo(daten: Buffer, typ: string): { typ: string; daten: string } {
  return { typ, daten: daten.toString("base64") };
}
