// ================================================================================================
// OCR-E01/E02 · Prüfeingaben für die Browserprobe (produkt:20261012:klara-ocr-fundstellen-korrekturen).
// ================================================================================================
//
// Kein Test. Zeichnet fiktive Bilder im Browser (Zeichenfläche → PNG) und MISST dabei, wo jedes Wort
// steht (Pixel des Bildes) — das sind die echten Fundstellen, an denen die Markierung der Ansicht
// geprüft wird. Dazu eine minimale PowerPoint (ZIP ohne Kompression), dieselbe Bauweise wie in
// `klara-bild-kontext-browser.spec.ts`.
import type { Page } from "@playwright/test";

export interface GezeichnetesWort {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface GezeichnetesBild {
  png: Buffer;
  breite: number;
  hoehe: number;
  woerter: GezeichnetesWort[];
}

/** Zeichnet Zeilen (fett, 80 px) und gibt das PNG samt gemessenem Rahmen je Wort zurück. */
export async function zeichneBild(
  page: Page,
  breite: number,
  hoehe: number,
  zeilen: readonly { text: string; x: number; y: number }[],
): Promise<GezeichnetesBild> {
  const ergebnis = await page.evaluate(
    ({ breite, hoehe, zeilen }) => {
      const canvas = document.createElement("canvas");
      canvas.width = breite;
      canvas.height = hoehe;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("kein Canvas");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, breite, hoehe);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 80px Arial, Helvetica, sans-serif";
      const woerter: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];
      for (const z of zeilen) {
        ctx.fillText(z.text, z.x, z.y);
        let start = 0;
        for (const w of z.text.split(" ")) {
          const davor = z.text.slice(0, z.text.indexOf(w, start));
          start = davor.length + w.length;
          const x = z.x + ctx.measureText(davor).width;
          const m = ctx.measureText(w);
          woerter.push({
            text: w,
            x0: x - m.actualBoundingBoxLeft,
            y0: z.y - m.actualBoundingBoxAscent,
            x1: x + m.actualBoundingBoxRight,
            y1: z.y + m.actualBoundingBoxDescent,
          });
        }
      }
      return { b64: canvas.toDataURL("image/png").split(",")[1] ?? "", woerter };
    },
    { breite, hoehe, zeilen },
  );
  return { png: Buffer.from(ergebnis.b64, "base64"), breite, hoehe, woerter: ergebnis.woerter };
}

// ------------------------------------------------------------------------------------------------
// Eine minimale PPTX: je Folie ein Titel und ein Bild.
// ------------------------------------------------------------------------------------------------

const CRC = (() => {
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

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c = (CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zipOhneKompression(eintraege: Record<string, Uint8Array>): Buffer {
  const lokal: Buffer[] = [];
  const zentral: Buffer[] = [];
  let versatz = 0;
  for (const [name, daten] of Object.entries(eintraege)) {
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(daten);
    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0);
    kopf.writeUInt16LE(20, 4);
    kopf.writeUInt16LE(0x0800, 6);
    kopf.writeUInt16LE(0, 8);
    kopf.writeUInt32LE(crc, 14);
    kopf.writeUInt32LE(daten.length, 18);
    kopf.writeUInt32LE(daten.length, 22);
    kopf.writeUInt16LE(nameBytes.length, 26);
    lokal.push(kopf, nameBytes, Buffer.from(daten));
    const z = Buffer.alloc(46);
    z.writeUInt32LE(0x02014b50, 0);
    z.writeUInt16LE(20, 4);
    z.writeUInt16LE(20, 6);
    z.writeUInt16LE(0x0800, 8);
    z.writeUInt16LE(0, 10);
    z.writeUInt32LE(crc, 16);
    z.writeUInt32LE(daten.length, 20);
    z.writeUInt32LE(daten.length, 24);
    z.writeUInt16LE(nameBytes.length, 28);
    z.writeUInt32LE(versatz, 42);
    zentral.push(z, nameBytes);
    versatz += kopf.length + nameBytes.length + daten.length;
  }
  const zentralBytes = Buffer.concat(zentral);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(Object.keys(eintraege).length, 8);
  ende.writeUInt16LE(Object.keys(eintraege).length, 10);
  ende.writeUInt32LE(zentralBytes.length, 12);
  ende.writeUInt32LE(versatz, 16);
  return Buffer.concat([...lokal, zentralBytes, ende]);
}

const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const URI_PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";
const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const enc = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "utf8"));

function folie(titel: string): string {
  const titelForm = `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${titel}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const bild = '<p:pic><p:blipFill><a:blip r:embed="rId9"/></p:blipFill></p:pic>';
  return `${KOPF}<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${titelForm}${bild}</p:spTree></p:cSld></p:sld>`;
}

const bildRels = (datei: string): string =>
  `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId9" Type="${URI_R}/image" Target="../media/${datei}"/></Relationships>`;

/** Ein Deck mit je einer Folie (Titel + Bild) je Eintrag, in dieser Reihenfolge. */
export function deckMit(folien: readonly { titel: string; png: Buffer }[]): Buffer {
  const eintraege: Record<string, Uint8Array> = {
    "[Content_Types].xml": enc(
      `${KOPF}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>`,
    ),
    "_rels/.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    ),
  };
  const ids = folien.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("");
  eintraege["ppt/presentation.xml"] = enc(
    `${KOPF}<p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`,
  );
  const rels = folien
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${URI_R}/slide" Target="slides/slide${i + 1}.xml"/>`,
    )
    .join("");
  eintraege["ppt/_rels/presentation.xml.rels"] = enc(
    `${KOPF}<Relationships xmlns="${URI_PKG_R}">${rels}</Relationships>`,
  );
  for (const [i, f] of folien.entries()) {
    const n = i + 1;
    eintraege[`ppt/slides/slide${n}.xml`] = enc(folie(f.titel));
    eintraege[`ppt/slides/_rels/slide${n}.xml.rels`] = enc(bildRels(`bild${n}.png`));
    eintraege[`ppt/media/bild${n}.png`] = new Uint8Array(f.png);
  }
  return zipOhneKompression(eintraege);
}

export const PPTX_TYP = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
