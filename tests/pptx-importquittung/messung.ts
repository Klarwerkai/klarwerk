// ================================================================================================
// JOB 4228 — ERST MESSEN, DANN TEXTEN. WAS DER PPTX-IMPORT WIRKLICH ÜBERNIMMT.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist die Messung, auf die sich der Quittungstext berufen darf —
// und sie ist der Grund, warum dieser Auftrag nicht darin besteht, ein Wort aus einem Satz zu
// streichen. Gemessen wird an der ECHTEN Importkette, derselben, die `readPptxRich`
// (`apps/web/src/lib/files.ts:216-228`) fährt:
//
//     Datei-Bytes → budgetedPptxUnzip(fflate) → extractPptxRich(…, budgetBytes, Platzhalter)
//
// Der einzige Unterschied zur Produktion ist die `File`-Hülle, die `readPptxRich` nur aufmacht
// (`file.size`-Kante, `file.arrayBuffer()`); die Auswertung selbst ist Byte für Byte dieselbe.
// Der Weg MIT `File` — also die Fläche — steht im Chromium-Fall dieses Ordners.
//
// ------------------------------------------------------------------------------------------------
// ZWEI DECKS, WEIL EINE FRAGE ZWEI FÄLLE HAT
// ------------------------------------------------------------------------------------------------
//
//  1. `deckMitInhalt()` — ein Deck, das JEDES Merkmal wirklich enthält, über das die Quittung eine
//     Aussage macht: Folientitel, Aufzählung, Tabelle, ein Folienbild mit echten Bytes, eine
//     Sprechernotiz, einen Folienübergang, eine Animation und Layoutangaben. Nur an einem Deck,
//     das die Sache ENTHÄLT, lässt sich messen, ob sie ankommt oder verloren geht.
//  2. `tests/fixtures/d3-referenz.pptx` — die vorhandene Referenzdatei aus JOB 4203, unverändert.
//     Sie trägt KEIN Bild. Sie ist der Fall „erfolgreich leer": eine Quittung, die für DIESE Datei
//     unbedingt „Bilder übernommen" behauptete, behauptete etwas, das hier nicht stattgefunden hat.
//
// ABWEICHUNG, EHRLICH BENANNT: der Auftrag (§6) spricht von einer „vorhandenen PPTX-Fixture MIT
// mindestens einem Folienbild". Eine solche gibt es auf der Platte nicht — `tests/fixtures/`
// enthält genau eine PPTX, und die ist bildlos (`tests/fixtures/d3-referenz-erzeugen.mjs:170-215`
// legt keine `ppt/media/**` an). Deck 1 wird deshalb hier im Quelltext gebaut, mit demselben
// echten `fflate.zipSync` und denselben OOXML-Bausteinen wie der abgenommene WP-D9-Nachweis
// (`tests/structure/pptx-rich-import.test.ts:766-830`) — kein neuer Importweg, keine neue
// Extraktion, nur eine Eingabe.
//
// ------------------------------------------------------------------------------------------------
// VIER ZUSTÄNDE JE MERKMAL — „nicht in der Quelle" IST NICHT „geht verloren"
// ------------------------------------------------------------------------------------------------
//
// Aus einer Datei ohne Bilder auf einen Bilderverlust zu schliessen wäre genau derselbe Fehler in
// die andere Richtung. Deshalb trägt jede Messung, WORAN sie hängt: enthielt die Quelle die Sache
// überhaupt? Ohne Quelle gibt es keine Messung, und ohne Messung gibt es keine Zusage.
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { Unzip, UnzipInflate, UnzipPassThrough, zipSync } from "../../apps/web/node_modules/fflate";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { MAX_INLINE_BODY_HTML_BYTES } from "../../apps/web/src/lib/docx";
import {
  type PptxRichResult,
  budgetedPptxUnzip,
  extractPptxRich,
} from "../../apps/web/src/lib/pptx";

// ------------------------------------------------------------------------------------------------
// Die Merkmale, über die eine PPTX-Quittung überhaupt etwas sagen kann
// ------------------------------------------------------------------------------------------------

export type Merkmal =
  | "text"
  | "listen"
  | "tabellen"
  | "bilder"
  | "layout"
  | "animationen"
  | "uebergaenge"
  | "notizen"
  | "formen";

export const MERKMALE: readonly Merkmal[] = [
  "text",
  "listen",
  "tabellen",
  "bilder",
  "layout",
  "animationen",
  "uebergaenge",
  "notizen",
  "formen",
];

/**
 * Der gemessene Zustand eines Merkmals AN EINER BESTIMMTEN DATEI.
 *
 * · `uebernommen`    — die Quelle trug es, und es steht im Ergebnis.
 * · `verloren`       — die Quelle trug es, und es steht NICHT im Ergebnis.
 * · `nichtInQuelle`  — die Quelle trug es nicht. Über diese Datei ist damit nichts zu sagen.
 * · `ungemessen`     — es wurde gar nicht gemessen. Dann wird auch nichts versprochen.
 */
export type Zustand = "uebernommen" | "verloren" | "nichtInQuelle" | "ungemessen";

export type Messung = Readonly<Record<Merkmal, Zustand>>;

/**
 * Die Bildbilanz DIESER Datei, in Zahlen — das, woran die Quittung nachgerechnet wird.
 *
 * Beide Zahlen kommen aus dem Import selbst, nicht aus einer Zählung im Quittungstext:
 * `quelle` ist `imageCount` (alle erkannten Bildverweise, vor jedem Abzug), `imEntwurf` ist
 * `embeddedImages` (die wirklich eingebetteten). Der Prüfer liest die Zahlen aus dem
 * Quittungssatz und legt sie hier daneben — stimmen sie nicht überein, ist die Quittung falsch.
 */
export interface Bildbilanz {
  readonly quelle: number;
  readonly imEntwurf: number;
  readonly fehlend: number;
}

export interface Messbefund {
  /** Wie die Datei heisst, über die geredet wird — jede Zahl unten gehört zu genau dieser. */
  readonly datei: string;
  /** Das rohe Ergebnis der echten Importkette. */
  readonly ergebnis: PptxRichResult;
  /** Der Zustand je Merkmal, abgeleitet aus `ergebnis` und aus dem Inhalt der Quelle. */
  readonly messung: Messung;
  /** Die gezählte Bildbilanz — Grundlage für den Bilanzsatz der Quittung. */
  readonly bilanz: Bildbilanz;
}

function bilanzAus(ergebnis: PptxRichResult): Bildbilanz {
  return {
    quelle: ergebnis.imageCount,
    imEntwurf: ergebnis.embeddedImages,
    fehlend: ergebnis.imageCount - ergebnis.embeddedImages,
  };
}

// ------------------------------------------------------------------------------------------------
// Die Marken des gebauten Decks — jede steht in der Datei und wird im Ergebnis gesucht
// ------------------------------------------------------------------------------------------------

export const MARKE = {
  folientitel: "Folientitel 4228",
  listenpunkt: "Aufzaehlungspunkt 4228",
  tabellenzelle: "Tabellenzelle 4228",
  /** Steht in `ppt/notesSlides/notesSlide1.xml` — darf im Ergebnis NIE auftauchen. */
  notiz: "SPRECHERNOTIZ4228",
  /** Steht in `<p:transition>` der ersten Folie — also in einer Datei, die WIRKLICH gelesen wird. */
  uebergang: "UEBERGANG4228",
  /** Steht in `<p:timing>` der ersten Folie — ebenfalls im gelesenen Folien-XML. */
  animation: "ANIMATION4228",
  /** Steht in den Formeigenschaften (`a:off`, `a:srgbClr`) UND in `ppt/slideLayouts/**`. */
  layout: "LAYOUT4228",
} as const;

// ------------------------------------------------------------------------------------------------
// DAS FOLIENBILD — EIN ECHTES, DEKODIERBARES PNG (Runde 2, Prüfer BEN, Korrekturpflicht 2)
// ------------------------------------------------------------------------------------------------
//
// RUNDE 1 HAT HIER EINE PNG-SIGNATUR MIT ZUFALLSBYTES DAHINTER BENUTZT. Das reichte für den
// Import — der prüft die Endung, nicht den Inhalt — und der Fall war grün. BEN hat den Puffer
// dekodieren lassen und bekam „Input buffer has corrupt header: pngload_buffer: invalid IHDR
// chunk size". Belegt war damit Byteübernahme, nicht Bildübernahme; und „das Bild kommt an" ist
// eine Aussage über ein BILD.
//
// Jetzt wird ein vollständiges PNG gebaut: Signatur, IHDR, IDAT und IEND, jeder Chunk mit
// richtiger Länge und richtiger CRC-32, die Pixel echt mit zlib komprimiert (`node:zlib`, keine
// neue Abhängigkeit). Der Fall `bild-ist-echt.test.ts` rechnet die CRCs unabhängig nach und packt
// die IDAT wieder aus; der Chromium-Fall lässt das Bild vom BROWSER dekodieren und misst
// `naturalWidth`/`naturalHeight` am gespeicherten und neu geladenen Entwurf.
export const BILD_BREITE = 4;
export const BILD_HOEHE = 4;

const CRC_TABELLE: Uint32Array = (() => {
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

/** CRC-32 nach PNG-Vorschrift (dieselbe Tabelle wie im ZIP-Format). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = (CRC_TABELLE[(c ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Die ROHEN Bildzeilen, wie sie nach dem Auspacken der IDAT wieder herauskommen müssen:
 * je Zeile ein Filterbyte 0, dann `BILD_BREITE` Pixel zu je drei Bytes (RGB, Farbtyp 2).
 * Ein Schachbrett aus Rot und Weiß — sichtbar, und an zwei Farben als Bild erkennbar.
 */
export const BILD_ROHZEILEN: Uint8Array = (() => {
  const out = new Uint8Array(BILD_HOEHE * (1 + BILD_BREITE * 3));
  let p = 0;
  for (let y = 0; y < BILD_HOEHE; y += 1) {
    out[p] = 0; // Filter „None"
    p += 1;
    for (let x = 0; x < BILD_BREITE; x += 1) {
      const rot = (x + y) % 2 === 0;
      out[p] = rot ? 220 : 255;
      out[p + 1] = rot ? 30 : 255;
      out[p + 2] = rot ? 30 : 255;
      p += 3;
    }
  }
  return out;
})();

function pngChunk(typ: string, daten: Uint8Array): Uint8Array {
  const typBytes = new TextEncoder().encode(typ);
  const out = new Uint8Array(12 + daten.length);
  const sicht = new DataView(out.buffer);
  sicht.setUint32(0, daten.length);
  out.set(typBytes, 4);
  out.set(daten, 8);
  const fuerCrc = new Uint8Array(4 + daten.length);
  fuerCrc.set(typBytes, 0);
  fuerCrc.set(daten, 4);
  sicht.setUint32(8 + daten.length, crc32(fuerCrc));
  return out;
}

/** Die PNG-Signatur — die ersten acht Bytes jeder PNG-Datei. */
export const PNG_SIGNATUR: readonly number[] = [137, 80, 78, 71, 13, 10, 26, 10];

/** Ein vollständiges, dekodierbares PNG: Signatur + IHDR + IDAT (echt zlib) + IEND. */
export const BILD_BYTES: Uint8Array = (() => {
  const ihdr = new Uint8Array(13);
  const sicht = new DataView(ihdr.buffer);
  sicht.setUint32(0, BILD_BREITE);
  sicht.setUint32(4, BILD_HOEHE);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // Farbtyp 2 = Truecolor (RGB)
  ihdr[10] = 0; // Kompression (deflate)
  ihdr[11] = 0; // Filtermethode
  ihdr[12] = 0; // kein Interlace
  const idat = new Uint8Array(deflateSync(Buffer.from(BILD_ROHZEILEN)));
  const teile = [
    Uint8Array.from(PNG_SIGNATUR),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const gesamt = new Uint8Array(teile.reduce((n, t) => n + t.length, 0));
  let p = 0;
  for (const t of teile) {
    gesamt.set(t, p);
    p += t.length;
  }
  return gesamt;
})();

/** Genau die Zeichenkette, die im `src` der figure stehen MUSS, wenn das Bild wirklich ankam. */
export const BILD_BASE64: string = Buffer.from(BILD_BYTES).toString("base64");

/**
 * Ein BMP — ein Format, das der Import KENNT und bewusst NICHT einbettet
 * (`apps/web/src/lib/pptx.ts:91-97`: nur png/jpg/jpeg/gif/webp sind erlaubt). Es ist der
 * Prüfstein des Falls „vorhanden, aber verworfen": `imageCount=1`, `embeddedImages=0`,
 * `droppedImageFormat=1`. Die Bytes tragen den echten BMP-Kopf „BM".
 */
export const BMP_BYTES: Uint8Array = (() => {
  const out = new Uint8Array(64);
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  new DataView(out.buffer).setUint32(2, out.length, true);
  for (let i = 14; i < out.length; i += 1) {
    out[i] = (i * 37) & 0xff;
  }
  return out;
})();

// ------------------------------------------------------------------------------------------------
// Deck 1 — gebaut, mit echtem fflate, mit allem drin
// ------------------------------------------------------------------------------------------------

const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const URI_PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";

function enc(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** XML-Bausteine zu einem Teil zusammensetzen — zeilenweise lesbar, ohne Zeichenkettenaddition. */
function xml(...teile: readonly string[]): string {
  return teile.join("");
}

const XML_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Folie 1: Titel, Aufzählung, ein Bild — und daneben alles, was NICHT ankommen soll. Übergang,
 * Animation und Layoutangaben stehen im Folien-XML SELBST, also in einer Datei, die der Import
 * wirklich aufmacht. Nur so ist ihr Fehlen im Ergebnis ein Befund und nicht bloss eine Folge
 * davon, dass niemand hingesehen hat.
 */
function folieEins(): string {
  const titel = xml(
    '<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>',
    `<p:spPr><a:xfrm><a:off x="${MARKE.layout}" y="0"/></a:xfrm>`,
    `<a:solidFill><a:srgbClr val="${MARKE.layout}"/></a:solidFill></p:spPr>`,
    `<p:txBody><a:p><a:r><a:t>${MARKE.folientitel}</a:t></a:r></a:p></p:txBody></p:sp>`,
  );
  const rumpf = xml(
    '<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody>',
    `<a:p><a:pPr><a:buChar char="&#8226;"/></a:pPr><a:r><a:t>${MARKE.listenpunkt}</a:t></a:r></a:p>`,
    "</p:txBody></p:sp>",
  );
  const bild = '<p:pic><p:blipFill><a:blip r:embed="rId9"/></p:blipFill></p:pic>';
  const uebergang = `<p:transition spd="${MARKE.uebergang}"><p:fade/></p:transition>`;
  const timing = `<p:timing><p:tnLst><p:par name="${MARKE.animation}"/></p:tnLst></p:timing>`;
  return xml(
    XML_KOPF,
    `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}">`,
    `<p:cSld><p:spTree>${titel}${rumpf}${bild}</p:spTree></p:cSld>`,
    `${uebergang}${timing}</p:sld>`,
  );
}

/** Folie 2: eine Tabelle (p:graphicFrame → a:tbl), zwei Spalten, eine Zeile. */
function folieZwei(): string {
  const zelle = (text: string) =>
    `<a:tc><a:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></a:txBody></a:tc>`;
  const tabelle = xml(
    "<p:graphicFrame><a:graphic><a:graphicData><a:tbl>",
    `<a:tr>${zelle(MARKE.tabellenzelle)}${zelle("bestanden")}</a:tr>`,
    "</a:tbl></a:graphicData></a:graphic></p:graphicFrame>",
  );
  return xml(
    XML_KOPF,
    `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}">`,
    `<p:cSld><p:spTree>${tabelle}</p:spTree></p:cSld></p:sld>`,
  );
}

/**
 * Welches Bild auf der ersten Folie liegt. Der Verweis im Folien-Rels ist in ALLEN Fällen
 * derselbe — die Quelle hat also immer genau ein Bild (`imageCount = 1`). Was sich unterscheidet,
 * ist allein, ob der Import es einbetten DARF und KANN.
 *
 * · `png` — erlaubtes Format, passt ins Budget  → eingebettet.
 * · `bmp` — bekanntes, nicht erlaubtes Format   → `droppedImageFormat = 1`, nichts im Entwurf.
 */
export type Bildart = "png" | "bmp";

const BILDDATEI: Readonly<Record<Bildart, string>> = {
  png: "bild4228.png",
  bmp: "bild4228.bmp",
};

/** Die Einträge des gebauten Decks — offen einsehbar, damit ein Fall belegen kann, was drinstand. */
export function deckEintraege(bildart: Bildart = "png"): Record<string, Uint8Array> {
  const bildname = BILDDATEI[bildart];
  const sldIds = '<p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/>';
  const praesRels = xml(
    `<Relationship Id="rId1" Type="${URI_R}/slide" Target="slides/slide1.xml"/>`,
    `<Relationship Id="rId2" Type="${URI_R}/slide" Target="slides/slide2.xml"/>`,
  );
  return {
    "[Content_Types].xml": enc(
      xml(
        XML_KOPF,
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Default Extension="png" ContentType="image/png"/>',
        "</Types>",
      ),
    ),
    "_rels/.rels": enc(
      xml(
        XML_KOPF,
        `<Relationships xmlns="${URI_PKG_R}">`,
        `<Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/>`,
        "</Relationships>",
      ),
    ),
    "ppt/presentation.xml": enc(
      xml(
        XML_KOPF,
        `<p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}">`,
        `<p:sldIdLst>${sldIds}</p:sldIdLst></p:presentation>`,
      ),
    ),
    "ppt/_rels/presentation.xml.rels": enc(
      xml(XML_KOPF, `<Relationships xmlns="${URI_PKG_R}">${praesRels}</Relationships>`),
    ),
    "ppt/slides/slide1.xml": enc(folieEins()),
    "ppt/slides/slide2.xml": enc(folieZwei()),
    "ppt/slides/_rels/slide1.xml.rels": enc(
      xml(
        XML_KOPF,
        `<Relationships xmlns="${URI_PKG_R}">`,
        `<Relationship Id="rId9" Type="${URI_R}/image" Target="../media/${bildname}"/>`,
        `<Relationship Id="rId8" Type="${URI_R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/>`,
        "</Relationships>",
      ),
    ),
    [`ppt/media/${bildname}`]: bildart === "png" ? BILD_BYTES : BMP_BYTES,
    "ppt/notesSlides/notesSlide1.xml": enc(
      xml(
        XML_KOPF,
        `<p:notes xmlns:p="${URI_P}" xmlns:a="${URI_A}"><p:cSld><p:spTree><p:sp><p:txBody>`,
        `<a:p><a:r><a:t>${MARKE.notiz}</a:t></a:r></a:p>`,
        "</p:txBody></p:sp></p:spTree></p:cSld></p:notes>",
      ),
    ),
    "ppt/slideLayouts/slideLayout1.xml": enc(
      xml(XML_KOPF, `<p:sldLayout xmlns:p="${URI_P}" xmlns:a="${URI_A}" type="${MARKE.layout}"/>`),
    ),
  };
}

/** Das gebaute Deck als echte ZIP-Bytes (fflate, wie jede reale .pptx). */
export function deckMitInhalt(bildart: Bildart = "png"): Uint8Array {
  return zipSync(deckEintraege(bildart));
}

/** Der Dateiname, unter dem ein Mensch dieses Deck wählt — er ist selbst ein Beleg (Herkunft). */
export const DECK_DATEINAME = "job4228-folien-mit-bild.pptx";
export const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Die vorhandene, unveränderte Referenz-PPTX aus JOB 4203 — bildlos. */
export const REFERENZ_PPTX = "tests/fixtures/d3-referenz.pptx";

export function referenzDeck(): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), REFERENZ_PPTX)));
}

// ------------------------------------------------------------------------------------------------
// Die Messung selbst
// ------------------------------------------------------------------------------------------------

/**
 * Die echte Importkette, einmal. Kein Ersatz, kein Stub: derselbe gebudgetete Entpacker und
 * dieselbe Auswertung, die `readPptxRich` fährt — inklusive des lokalisierten Bild-Platzhalters,
 * den `Capture.tsx` durchreicht (`readPptxRich(f, t(CAPTURE_FILE_TEXT.imageCaptionPlaceholder))`).
 */
export async function importieren(
  bytes: Uint8Array,
  // RUNDE 2: nur für den BUDGET-Fall. Die echte Grenze ist `PPTX_MAX_IMAGE_BYTES` (5 MiB,
  // `pptx.ts`); ein Fixture dieser Größe würde die Testgruppe unnötig aufblähen. Gesetzt wird
  // deshalb dieselbe OPTION, die die Funktion ohnehin kennt (`maxImageBytes`) — der geprüfte
  // ZWEIG ist derselbe, nur die Zahl ist kleiner. Das steht ausdrücklich hier und in der Rückgabe.
  maxImageBytes?: number,
): Promise<PptxRichResult> {
  const kopie = new Uint8Array(bytes);
  return extractPptxRich(kopie.buffer as ArrayBuffer, {
    unzip: budgetedPptxUnzip({ Unzip, UnzipInflate, UnzipPassThrough }),
    budgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    imageCaptionPlaceholder: String(i18n.t(CAPTURE_FILE_TEXT.imageCaptionPlaceholder)),
    imageRunToken: "job4228",
    ...(maxImageBytes !== undefined ? { maxImageBytes } : {}),
  });
}

/** Steht die Marke irgendwo im Ergebnis — im HTML oder im Klartext? */
function imErgebnis(ergebnis: PptxRichResult, marke: string): boolean {
  return ergebnis.html.includes(marke) || ergebnis.text.includes(marke);
}

/**
 * Ein Merkmal, dessen Gegenstand in der Quelle steht: kommt es an (`uebernommen`) oder nicht
 * (`verloren`)? Steht es gar nicht in der Quelle, ist über diese Datei nichts zu sagen.
 */
function zustand(inQuelle: boolean, imErgebnisDa: boolean): Zustand {
  if (!inQuelle) {
    return "nichtInQuelle";
  }
  return imErgebnisDa ? "uebernommen" : "verloren";
}

/**
 * Der Messbefund des GEBAUTEN Decks. Jede Zeile hängt an einer Marke, die nachweislich in der
 * Datei steht (`deckEintraege()` ist offen einsehbar) — und an dem, was das Ergebnis davon zeigt.
 */
export async function messeDeckMitInhalt(
  bildart: Bildart = "png",
  maxImageBytes?: number,
): Promise<Messbefund> {
  const ergebnis = await importieren(deckMitInhalt(bildart), maxImageBytes);
  const bildImHtml =
    ergebnis.html.includes(`src="data:image/png;base64,${BILD_BASE64}"`) &&
    ergebnis.embeddedImages > 0;
  return {
    datei: `job4228-deck (${bildart}${maxImageBytes === undefined ? "" : `, maxImageBytes=${maxImageBytes}`})`,
    ergebnis,
    bilanz: bilanzAus(ergebnis),
    messung: {
      text: zustand(true, imErgebnis(ergebnis, MARKE.folientitel)),
      listen: zustand(
        true,
        ergebnis.html.includes(`<li>${MARKE.listenpunkt}</li>`) ||
          imErgebnis(ergebnis, MARKE.listenpunkt),
      ),
      tabellen: zustand(true, ergebnis.tableCount > 0 && imErgebnis(ergebnis, MARKE.tabellenzelle)),
      // Das Bild ist nur dann übernommen, wenn SEINE BYTES im Entwurf stehen — nicht, wenn
      // irgendeine figure entstanden ist.
      bilder: zustand(ergebnis.imageCount > 0, bildImHtml),
      layout: zustand(true, imErgebnis(ergebnis, MARKE.layout)),
      animationen: zustand(true, imErgebnis(ergebnis, MARKE.animation)),
      uebergaenge: zustand(true, imErgebnis(ergebnis, MARKE.uebergang)),
      notizen: zustand(true, imErgebnis(ergebnis, MARKE.notiz)),
      // ABSICHTLICH UNGEMESSEN (Auftrag §5.4): Vektor-Grafiken und Formen deckt weder dieses Deck
      // noch die Referenzdatei ab. Was nicht gemessen ist, wird nicht versprochen — der Prüfer
      // unten macht jede Zusage darüber rot, in beide Richtungen.
      formen: "ungemessen",
    },
  };
}

/**
 * Der Messbefund der VORHANDENEN Referenzdatei aus JOB 4203 — der Fall „erfolgreich leer".
 * Sie trägt drei Folien mit Titeln und Aufzählungen und genau eine Sprechernotiz; kein Bild,
 * keine Tabelle, keinen Übergang, keine Animation.
 */
export async function messeReferenzdeck(): Promise<Messbefund> {
  const ergebnis = await importieren(referenzDeck());
  return {
    datei: REFERENZ_PPTX,
    ergebnis,
    bilanz: bilanzAus(ergebnis),
    messung: {
      text: zustand(true, ergebnis.text.includes("D3 Referenz Folie Eins")),
      listen: zustand(true, ergebnis.html.includes("<li>Ventil pruefen</li>")),
      tabellen: zustand(ergebnis.tableCount > 0, ergebnis.html.includes("<table>")),
      // KEIN BILD IN DER QUELLE — und daraus folgt kein Verlust, sondern eine Nichtaussage.
      bilder: zustand(ergebnis.imageCount > 0, ergebnis.embeddedImages > 0),
      layout: "nichtInQuelle",
      animationen: "nichtInQuelle",
      uebergaenge: "nichtInQuelle",
      notizen: zustand(true, imErgebnis(ergebnis, "SPRECHERNOTIZ4203")),
      formen: "ungemessen",
    },
  };
}
