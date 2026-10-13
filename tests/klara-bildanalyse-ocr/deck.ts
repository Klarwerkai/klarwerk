// OCR-02 · Gemeinsame Prüfeingaben: ein echtes PPTX-Deck (fflate) mit Bildern, deren Bytes eine Marke
// tragen, und eine Erkennung, die genau diese Marke liest. So ist nachprüfbar, dass JEDES Bild SEINEN
// Text bekommt — die Genauigkeit der echten Engine misst die Browserprobe
// (`tests-smoke/klara-bildautomatik-browser.spec.ts`). Diese Datei ist kein Test.
import { vi } from "vitest";
import { Unzip, UnzipInflate, UnzipPassThrough, zipSync } from "../../apps/web/node_modules/fflate";
import { MAX_INLINE_BODY_HTML_BYTES } from "../../apps/web/src/lib/docx";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import { budgetedPptxUnzip, extractPptxRich } from "../../apps/web/src/lib/pptx";

const PNG_SIGNATUR = [137, 80, 78, 71, 13, 10, 26, 10];

/** Bildbytes mit einer Marke am Ende — verschiedene Marke, verschiedener Inhalt. */
export function bildMit(marke: string): Uint8Array {
  const marken = new TextEncoder().encode(`#${marke}#`);
  return Uint8Array.from([...PNG_SIGNATUR, 0, 0, 0, 13, ...marken]);
}

export const TEXT_JE_MARKE: Record<string, string> = {
  A: "PRUEFKARTE 47",
  B: "VENTIL 83 SCHLIESSEN",
  B2: "VENTIL 84 OEFFNEN",
  C: "LAGER 29",
  E: "AUSHANG 61",
};

export function markeAus(src: string): string | null {
  const b64 = src.slice(src.indexOf(",") + 1);
  const roh = Buffer.from(b64, "base64").toString("latin1");
  return /#([A-Z0-9]+)#$/.exec(roh)?.[1] ?? null;
}

export function markenEngine() {
  return vi.fn(async (src: string): Promise<OcrResult> => {
    const marke = markeAus(src);
    const text = marke ? TEXT_JE_MARKE[marke] : undefined;
    return text ? { status: "success", text } : { status: "success", text: "" };
  });
}

export const dataUrl = (bytes: Uint8Array, mime = "image/png"): string =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const URI_PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";
const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function folie(titel: string, absatz: string, rids: readonly string[]): string {
  const sp = (ph: string, text: string) =>
    `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const bilder = rids
    .map((rid) => `<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`)
    .join("");
  return `${KOPF}<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${sp('<p:ph type="title"/>', titel)}${sp("", absatz)}${bilder}</p:spTree></p:cSld></p:sld>`;
}

function rels(ziele: Record<string, string>): string {
  const r = Object.entries(ziele)
    .map(
      ([rid, datei]) =>
        `<Relationship Id="${rid}" Type="${URI_R}/image" Target="../media/${datei}"/>`,
    )
    .join("");
  return `${KOPF}<Relationships xmlns="${URI_PKG_R}">${r}</Relationships>`;
}

/** Der editierbare Folientext des Decks — die Bildtexte stehen NICHT darin. */
export const FOLIENTEXT = ["Wartungsplan", "Siehe Bild", "Anlage", "Zwei Bilder"];

/** Folie 1: Text + Bild A; Folie 2: Text + Bild B + Bild C + ein BMP (wird nicht übernommen). */
export function deck(bildB: Uint8Array = bildMit("B")): Uint8Array {
  return zipSync({
    "[Content_Types].xml": enc(
      `${KOPF}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>`,
    ),
    "_rels/.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    ),
    "ppt/presentation.xml": enc(
      `${KOPF}<p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
    ),
    "ppt/_rels/presentation.xml.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="${URI_R}/slide" Target="slides/slide2.xml"/></Relationships>`,
    ),
    "ppt/slides/slide1.xml": enc(folie("Wartungsplan", "Siehe Bild", ["rId9"])),
    "ppt/slides/slide2.xml": enc(folie("Anlage", "Zwei Bilder", ["rId9", "rId10", "rId11"])),
    "ppt/slides/_rels/slide1.xml.rels": enc(rels({ rId9: "a.png" })),
    "ppt/slides/_rels/slide2.xml.rels": enc(
      rels({ rId9: "b.png", rId10: "c.png", rId11: "d.bmp" }),
    ),
    "ppt/media/a.png": bildMit("A"),
    "ppt/media/b.png": bildB,
    "ppt/media/c.png": bildMit("C"),
    "ppt/media/d.bmp": Uint8Array.from([0x42, 0x4d, 1, 2, 3, 4]),
  });
}

/** Dieselbe Kette wie `readPptxRich`, ohne die `File`-Hülle. */
export async function lesePptx(bytes: Uint8Array) {
  const kopie = new Uint8Array(bytes);
  return extractPptxRich(kopie.buffer as ArrayBuffer, {
    unzip: budgetedPptxUnzip({ Unzip, UnzipInflate, UnzipPassThrough }),
    budgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    imageCaptionPlaceholder: "",
    imageRunToken: "ocr02",
  });
}
