// ================================================================================================
// JOB 4228 RUNDE 2 — DAS TESTBILD IST EIN BILD. NACHGERECHNET, NICHT BEHAUPTET.
// ================================================================================================
//
// DER BEFUND (Prüfer BEN, Korrekturpflicht 2): Runde 1 hat als Folienbild eine PNG-Signatur mit
// 256 Zufallsbytes dahinter benutzt. Der Import prüft die Endung, nicht den Inhalt — der Fall war
// grün, und die Rückgabe sprach von „das Bild mit seinen eigenen Bytes". BENs Dekodierversuch:
//
//     Input buffer has corrupt header: pngload_buffer: invalid IHDR chunk size
//
// Belegt war damit, dass ein Byteblock durch den Import reist. Über ein BILD war nichts gesagt.
// Und „Bilder werden übernommen" ist eine Aussage über Bilder.
//
// DIESE DATEI RECHNET DAS PNG UNABHÄNGIG NACH — Struktur, Chunk-Grenzen, CRC-32 jedes Chunks —
// und PACKT DIE BILDDATEN WIEDER AUS (`inflateSync`), um die Pixel mit denen zu vergleichen, die
// hineingegeben wurden. Wer das Bild verstellt, kommt hier nicht durch.
//
// WAS DIESE DATEI NICHT LEISTET, und das gehört dazu: sie ist kein Renderer. Dass ein BROWSER das
// Bild wirklich anzeigt, misst `nutzerweg-drei-sprachen-chromium.test.ts` am gespeicherten und neu
// geladenen Entwurf über `naturalWidth`/`naturalHeight` — an derselben Datei, mit denselben Bytes.
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  BILD_BASE64,
  BILD_BREITE,
  BILD_BYTES,
  BILD_HOEHE,
  BILD_ROHZEILEN,
  BMP_BYTES,
  PNG_SIGNATUR,
  crc32,
} from "./messung";

interface Chunk {
  readonly typ: string;
  readonly daten: Uint8Array;
  readonly crcAusDatei: number;
  readonly crcGerechnet: number;
}

/**
 * Die Chunks einer PNG-Datei — streng gelesen. Jede Längenangabe muss in die Datei passen, und am
 * Ende darf kein Rest übrig bleiben; sonst wird geworfen statt „so ungefähr" zu melden.
 */
function pngChunks(bytes: Uint8Array): readonly Chunk[] {
  const sicht = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  let p = PNG_SIGNATUR.length;
  while (p < bytes.length) {
    if (p + 12 > bytes.length) {
      throw new Error(`PNG: abgeschnittener Chunk-Kopf bei Byte ${p}`);
    }
    const laenge = sicht.getUint32(p);
    const ende = p + 12 + laenge;
    if (ende > bytes.length) {
      throw new Error(
        `PNG: Chunk bei Byte ${p} gibt ${laenge} Datenbytes an, die Datei ist kürzer`,
      );
    }
    const typ = new TextDecoder().decode(bytes.subarray(p + 4, p + 8));
    const daten = bytes.subarray(p + 8, p + 8 + laenge);
    chunks.push({
      typ,
      daten,
      crcAusDatei: sicht.getUint32(p + 8 + laenge),
      crcGerechnet: crc32(bytes.subarray(p + 4, p + 8 + laenge)),
    });
    p = ende;
  }
  if (p !== bytes.length) {
    throw new Error(`PNG: ${bytes.length - p} Bytes hinter dem letzten Chunk`);
  }
  return chunks;
}

describe("JOB 4228 R2 · das Folienbild ist ein gültiges PNG", () => {
  it("Signatur, Chunk-Reihenfolge und Dateiende stimmen", () => {
    expect([...BILD_BYTES.subarray(0, 8)]).toEqual([...PNG_SIGNATUR]);
    const typen = pngChunks(BILD_BYTES).map((c) => c.typ);
    expect(typen[0], "das erste Chunk MUSS IHDR sein").toBe("IHDR");
    expect(typen).toContain("IDAT");
    expect(typen[typen.length - 1], "das letzte Chunk MUSS IEND sein").toBe("IEND");
  });

  it("jede CRC-32 im Bild stimmt mit der unabhängig gerechneten überein", () => {
    const chunks = pngChunks(BILD_BYTES);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.crcGerechnet, `CRC des Chunks ${c.typ}`).toBe(c.crcAusDatei);
    }
  });

  it("der IHDR-Kopf nennt die Maße, die das Bild wirklich hat — genau der Befund aus Runde 1", () => {
    const ihdr = pngChunks(BILD_BYTES).find((c) => c.typ === "IHDR");
    expect(ihdr, "kein IHDR").toBeDefined();
    // „invalid IHDR chunk size" war BENs Meldung. Ein IHDR hat 13 Bytes — nicht mehr, nicht weniger.
    expect(ihdr?.daten.length, "IHDR muss genau 13 Bytes haben").toBe(13);
    const d = ihdr?.daten as Uint8Array;
    const sicht = new DataView(d.buffer, d.byteOffset, d.byteLength);
    expect(sicht.getUint32(0)).toBe(BILD_BREITE);
    expect(sicht.getUint32(4)).toBe(BILD_HOEHE);
    expect(d[8], "Bittiefe 8").toBe(8);
    expect(d[9], "Farbtyp 2 = Truecolor").toBe(2);
    expect(d[12], "kein Interlace").toBe(0);
  });

  it("die Bilddaten lassen sich AUSPACKEN und sind Pixel für Pixel die hineingegebenen", () => {
    const idat = pngChunks(BILD_BYTES)
      .filter((c) => c.typ === "IDAT")
      .map((c) => Buffer.from(c.daten));
    const roh = new Uint8Array(inflateSync(Buffer.concat(idat)));
    // Je Zeile ein Filterbyte + Breite × 3 Bytes RGB. Stimmte die Länge nicht, wäre es kein Bild
    // dieser Maße — und die Maße stehen im IHDR, den der Fall darüber liest.
    expect(roh.length).toBe(BILD_HOEHE * (1 + BILD_BREITE * 3));
    expect([...roh]).toEqual([...BILD_ROHZEILEN]);
    // Und es ist wirklich ein Schachbrett aus zwei Farben, kein einfarbiger Block: das erste Pixel
    // ist rot, das zweite weiss.
    expect([roh[1], roh[2], roh[3]]).toEqual([220, 30, 30]);
    expect([roh[4], roh[5], roh[6]]).toEqual([255, 255, 255]);
  });

  it("die Base64-Fassung, die im Entwurf landet, ist byte-gleich mit der Datei", () => {
    expect(Buffer.from(BILD_BASE64, "base64").equals(Buffer.from(BILD_BYTES))).toBe(true);
  });

  it("GEGENPROBE: eine PNG-Signatur mit Zufallsbytes fällt hier durch — Runde 1 wäre rot", () => {
    // Genau der Puffer, den Runde 1 benutzt hat: acht richtige Bytes, dahinter Rauschen.
    const wieRunde1 = new Uint8Array(8 + 256);
    wieRunde1.set(PNG_SIGNATUR, 0);
    let s = 0x9e3779b9;
    for (let i = 0; i < 256; i += 1) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s |= 0;
      wieRunde1[8 + i] = s & 0xff;
    }
    // Die Signatur allein trägt: sie ist richtig. Alles dahinter nicht.
    expect([...wieRunde1.subarray(0, 8)]).toEqual([...PNG_SIGNATUR]);
    expect(() => pngChunks(wieRunde1)).toThrow();
  });

  it("das BMP des Verlustfalls ist ein BMP — und ausdrücklich KEIN PNG", () => {
    // Sonst prüfte der Formatverlust-Fall nur, dass eine Endung anders heisst.
    expect([BMP_BYTES[0], BMP_BYTES[1]]).toEqual([0x42, 0x4d]); // "BM"
    expect([...BMP_BYTES.subarray(0, 8)]).not.toEqual([...PNG_SIGNATUR]);
  });
});
