// ================================================================================================
// JOB 3400 · M5c-b-R2 — ECHTE RASTERBILDER, IM TEST ERZEUGT
// ================================================================================================
//
// WARUM ERZEUGT UND NICHT ALS BASE64-KONSTANTE: Dieser Auftrag misst eine VERKLEINERUNG. Dafür
// braucht es ein Bild, das gross genug ist, um verkleinert zu werden — mehrere Megabyte. Eine
// solche Konstante im Quelltext wäre unlesbar und bei jeder Anpassung der Grenzen wertlos. Die
// vorhandenen Testbilder des gemeinsamen Bauers (`PNG_ROT`, `PNG_BLAU`) sind 1×1 Pixel; an ihnen
// ist keine Verkleinerung messbar.
//
// ECHTE DATEIEN, KEINE ATTRAPPEN: Was hier herauskommt, ist ein strukturell vollständiges PNG
// (Signatur, IHDR, IDAT mit echtem zlib-Strom, IEND, jede Prüfsumme gerechnet). Es geht durch den
// gemeinsamen `.docx`-Bauer, durch das ECHTE mammoth und durch die echte Importroute.
//
// KEINE ECHTDATEN: alle Bildinhalte sind gerechnet, nicht fotografiert.
import { deflateSync } from "node:zlib";

/** CRC-32 (PNG-Polynom 0xEDB88320) — jede PNG-Blockprüfsumme wird gerechnet, nicht geraten. */
const CRC_TABELLE: readonly number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(daten: Buffer): number {
  let c = 0xffffffff;
  for (const b of daten) {
    c = (CRC_TABELLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Ein PNG-Block: Länge, Typ, Daten, CRC über Typ+Daten. */
function block(typ: string, daten: Buffer): Buffer {
  const kopf = Buffer.alloc(8);
  kopf.writeUInt32BE(daten.length, 0);
  kopf.write(typ, 4, "ascii");
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(Buffer.concat([kopf.subarray(4), daten])), 0);
  return Buffer.concat([kopf, daten, pruef]);
}

const PNG_SIGNATUR = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** IHDR für ein 8-Bit-RGB-Bild ohne Verschränkung — die einzige Form, die dieser Bauer schreibt. */
function ihdr(breite: number, hoehe: number): Buffer {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(breite, 0);
  d.writeUInt32BE(hoehe, 4);
  d[8] = 8; // Bittiefe
  d[9] = 2; // Farbtyp 2 = RGB
  d[10] = 0; // Kompression: deflate (die einzige, die PNG kennt)
  d[11] = 0; // Filtermethode 0
  d[12] = 0; // keine Verschränkung
  return block("IHDR", d);
}

/**
 * Deterministischer Pseudozufall. KEIN `Math.random`: zweimal derselbe Aufruf muss dieselben Bytes
 * liefern, sonst schwankt die gemessene Bildgrösse zwischen zwei Läufen und die Grössenzusicherung
 * wäre eine Wette statt einer Messung.
 */
function rauschen(laenge: number, saat: number): Buffer {
  const raus = Buffer.alloc(laenge);
  let z = saat >>> 0;
  for (let i = 0; i < laenge; i += 1) {
    z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
    raus[i] = (z >>> 24) & 0xff;
  }
  return raus;
}

/**
 * Ein echtes, GROSSES PNG: `breite`×`hoehe` Pixel Rauschen.
 *
 * Rauschen ist Absicht und nicht Bequemlichkeit: ein Verlauf liesse sich verlustfrei auf wenige
 * Kilobyte packen — dann gäbe es nichts zu verkleinern und der Fall wäre keiner. Rauschen ist der
 * ungünstigste Fall für jede Kompression; was hier schrumpft, schrumpft überall.
 */
export function grossesPng(breite: number, hoehe: number, saat = 20260909): Buffer {
  // Eine PNG-Zeile ist ein Filterbyte (0 = kein Filter) plus `breite`×3 Farbbytes.
  const zeile = breite * 3;
  const roh = Buffer.alloc(hoehe * (zeile + 1));
  const farben = rauschen(hoehe * zeile, saat);
  for (let y = 0; y < hoehe; y += 1) {
    roh[y * (zeile + 1)] = 0;
    farben.copy(roh, y * (zeile + 1) + 1, y * zeile, (y + 1) * zeile);
  }
  return Buffer.concat([
    PNG_SIGNATUR,
    ihdr(breite, hoehe),
    block("IDAT", deflateSync(roh, { level: 6 })),
    block("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Eine PIXELBOMBE: der Kopf nennt riesige Kantenlängen, die Bilddaten reichen für ein einziges
 * Pixel. Die Datei bleibt winzig — genau das macht sie gefährlich: eine Byte-Grenze sieht sie nie,
 * ein Dekodierer würde `breite`×`hoehe`×3 Bytes anfordern.
 *
 * Sie prüft deshalb GENAU die Pixelgrenze und nichts sonst. Ein Dekodierer, der den Kopf liest und
 * gegen seine Pixelgrenze hält, lehnt sie ab, BEVOR er Speicher anfordert.
 */
export function pixelbombePng(breite: number, hoehe: number): Buffer {
  return Buffer.concat([
    PNG_SIGNATUR,
    ihdr(breite, hoehe),
    block("IDAT", deflateSync(Buffer.from([0, 0, 0, 0]))),
    block("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Ein DEFEKTES Bild: gültige PNG-Signatur und gültiger IHDR, danach ein IDAT-Block, dessen Inhalt
 * kein zlib-Strom ist. Ein Dekodierer kommt bis zum Kopf und scheitert dann wirklich am Inhalt —
 * das ist der Defekt, den ein aus einer anderen Anwendung eingefügtes Bild in Word erzeugt, und
 * nicht der triviale Fall „gar kein Bild".
 *
 * GROSS, also über beiden Schwellen (Kantenlänge UND Bytes): Dieses Bild geht den Weg der echten
 * Verkleinerung und scheitert dort. Sein kleiner Bruder unten geht den anderen Weg — beide müssen
 * als defekt erkannt werden, und dass es zwei Wege sind, ist genau der Grund für zwei Fixtures.
 */
export function defektesPng(): Buffer {
  return Buffer.concat([
    PNG_SIGNATUR,
    ihdr(2000, 1500),
    block("IDAT", rauschen(96 * 1024, 99)),
    block("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Dasselbe Leiden in klein: unter beiden Schwellen — 64×64 Pixel, rund 190 Bytes.
 *
 * Es ist der Fall, an dem Runde 2 gescheitert ist (BEN, Korrekturpflicht 1): Die Ableitung sah nur
 * den KOPF, fand „64×64, klein genug" und liess die Quelle stehen mit dem Grund
 * „schon-klein-genug". Der IDAT-Block darunter ist aber kein zlib-Strom — kein Anzeigeprogramm
 * bekommt daraus ein Bild. Erhaltene Bytes beweisen keine Darstellbarkeit; deshalb muss auch dieses
 * Bild wirklich dekodiert und als „nicht-dekodierbar" gemeldet werden (Fall F2).
 */
export function kleinesDefektesPng(): Buffer {
  return Buffer.concat([
    PNG_SIGNATUR,
    ihdr(64, 64),
    block("IDAT", Buffer.from("dies ist kein zlib-strom", "utf8")),
    block("IEND", Buffer.alloc(0)),
  ]);
}
