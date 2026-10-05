// Die synthetische Datei der Strecke: ein ECHTES, dekodierbares PNG mit festem Inhalt.
//
// Warum ein Bild: der Anhangsweg der Objektseite nimmt nur Bilder an (`accept="image/*"`) und zeichnet
// fuer die Vorschau auf eine Leinwand — eine Datei, die sich nicht dekodieren laesst, kaeme dort gar
// nicht an. Der Inhalt ist deterministisch (aus einem Saatwert), damit sein SHA-256 VOR dem Hochladen
// feststeht und unabhaengig von allem, was die Anwendung damit tut.
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

const CRC_TABELLE = ((): Uint32Array => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(daten: Buffer): number {
  let c = 0xffffffff;
  for (const byte of daten) {
    c = (CRC_TABELLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function block(typ: string, inhalt: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(inhalt.length);
  const kopfUndInhalt = Buffer.concat([Buffer.from(typ, "latin1"), inhalt]);
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(kopfUndInhalt));
  return Buffer.concat([laenge, kopfUndInhalt, pruefsumme]);
}

/** Ein 48×48-RGB-PNG, dessen Pixel aus `saat` abgeleitet sind — gleiche Saat, gleiche Bytes. */
export function synthetischesPng(saat: string): Buffer {
  const breite = 48;
  const hoehe = 48;
  const zeilen: Buffer[] = [];
  for (let y = 0; y < hoehe; y++) {
    const zeile = Buffer.alloc(1 + breite * 3);
    const muster = createHash("sha256").update(`${saat}:${y}`).digest();
    for (let x = 0; x < breite * 3; x++) {
      zeile[1 + x] = muster[x % muster.length] as number;
    }
    zeilen.push(zeile);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block("IHDR", ihdr),
    block("tEXt", Buffer.from(`Comment\0KLARWERK Kundeninstallation ${saat}`, "latin1")),
    block("IDAT", deflateSync(Buffer.concat(zeilen))),
    block("IEND", Buffer.alloc(0)),
  ]);
}

export function sha256(daten: Buffer): string {
  return createHash("sha256").update(daten).digest("hex");
}
