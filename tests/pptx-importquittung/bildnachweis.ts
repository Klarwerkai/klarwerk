// ================================================================================================
// BILDNACHWEIS — ZWILLINGE, AUSGEBLENDETE BILDER UND DIE GEGENPROBE AM DOM.
// ================================================================================================
//
// Restprüfungen aus BENs Urteil zu JOB 4269 (`archiv/4269/runde-1/ben.md:22`, Prüfpunkt 6):
//
//   „Die Bildzählung dedupliziert Quellen über den gesamten Seitenrumpf
//    (`nutzerweg-drei-sprachen-chromium.test.ts:147`). Ergänzend zwei identische Folienbilder sowie
//    ausgeblendete Bilder prüfen. […] gegen eingefrorene Werte wäre zusätzlich eine DOM-Gegenprobe
//    sinnvoll."
//
// Diese Datei ist KEIN Test, sondern das Messmittel der Fälle
// `zwillinge-und-ausgeblendete-bilder.test.ts`, `bildnachweis-gespeichert-chromium.test.ts` und
// `altbeleg-und-bildbilanz-pg.integration.test.ts`. Sie enthält drei Dinge:
//
//  1. DAS ZWILLINGSDECK. Drei Folien, sechs Bildverweise: dasselbe PNG zweimal aus derselben
//     Mediendatei, einmal aus einer zweiten Mediendatei mit identischen Bytes, ein Bild in einer
//     AUSGEBLENDETEN Form (`<p:cNvPr hidden="1">`), ein Bild auf einer AUSGEBLENDETEN Folie
//     (`<p:sld show="0">`) und ein BMP, das der Import verwirft. Eine Zählung über VERSCHIEDENE
//     Quellen sieht hier drei Bilder, wo fünf im Entwurf stehen — und sähe auch dann noch drei, wenn
//     einer der Zwillinge verschwände.
//  2. DIE UNABHÄNGIGEN ORIGINALDATEN. Was in der Quelle steht, wird mit `fflate.unzipSync` und
//     einer eigenen, kleinen Auswertung direkt aus den ZIP-Bytes gelesen — NICHT aus
//     `extractPptxRich`. Die Sollzahlen der Quittung und die Sollbilder am Entwurf kommen aus der
//     Deckbeschreibung und diesen Bytes, nicht aus dem Import, der geprüft wird.
//  3. DIE DOM-GEGENPROBE. Eine Ablesung am Browser gilt erst, wenn sie nachweislich merkt, dass
//     ein Bild entfernt, ausgeblendet, zerstört oder vertauscht wurde. Ein Ableser, der einen
//     eingefrorenen Wert zurückgibt, besteht die Gegenprobe NICHT — sie wirft.
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { unzipSync, zipSync } from "../../apps/web/node_modules/fflate";
import { BILD_BREITE, BILD_BYTES, BILD_HOEHE, BILD_ROHZEILEN, BMP_BYTES, crc32 } from "./messung";
import { BILANZ_PRAEFIX, type Sprache, bilanzAussage } from "./quittungspruefer";

// ------------------------------------------------------------------------------------------------
// Die Bilder — echte PNGs, jedes mit eigenem, sichtbar unterscheidbarem Muster
// ------------------------------------------------------------------------------------------------

/** Ein RGB-Wert, wie er nach dem Dekodieren im Pixelpuffer steht. */
type Farbe = readonly [number, number, number];

/**
 * Die ROHEN Pixel eines 4×4-Schachbretts aus `farbe` und Weiß — OHNE Filterbytes, drei Bytes je
 * Pixel, zeilenweise. Genau so liest der Browser sie über `getImageData` zurück.
 */
function schachbrett(farbe: Farbe): Uint8Array {
  const out = new Uint8Array(BILD_BREITE * BILD_HOEHE * 3);
  let p = 0;
  for (let y = 0; y < BILD_HOEHE; y += 1) {
    for (let x = 0; x < BILD_BREITE; x += 1) {
      const bunt = (x + y) % 2 === 0;
      out[p] = bunt ? farbe[0] : 255;
      out[p + 1] = bunt ? farbe[1] : 255;
      out[p + 2] = bunt ? farbe[2] : 255;
      p += 3;
    }
  }
  return out;
}

/** Die Pixel des Testbilds aus `messung.ts`, aus dessen Rohzeilen gelesen (Filterbytes entfernt). */
const ROT_PIXEL: Uint8Array = (() => {
  const zeile = 1 + BILD_BREITE * 3;
  const out = new Uint8Array(BILD_BREITE * BILD_HOEHE * 3);
  for (let y = 0; y < BILD_HOEHE; y += 1) {
    out.set(BILD_ROHZEILEN.subarray(y * zeile + 1, (y + 1) * zeile), y * BILD_BREITE * 3);
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

/** Ein vollständiges PNG (Farbtyp 2, 8 Bit) aus rohen RGB-Pixeln. */
function pngAus(pixel: Uint8Array): Uint8Array {
  const zeilen = new Uint8Array(BILD_HOEHE * (1 + BILD_BREITE * 3));
  for (let y = 0; y < BILD_HOEHE; y += 1) {
    const ziel = y * (1 + BILD_BREITE * 3);
    zeilen[ziel] = 0; // Filter „None"
    zeilen.set(pixel.subarray(y * BILD_BREITE * 3, (y + 1) * BILD_BREITE * 3), ziel + 1);
  }
  const ihdr = new Uint8Array(13);
  const sicht = new DataView(ihdr.buffer);
  sicht.setUint32(0, BILD_BREITE);
  sicht.setUint32(4, BILD_HOEHE);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const teile = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array(deflateSync(Buffer.from(zeilen)))),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const gesamt = new Uint8Array(teile.reduce((n, t) => n + t.length, 0));
  let p = 0;
  for (const t of teile) {
    gesamt.set(t, p);
    p += t.length;
  }
  return gesamt;
}

const BLAU_PIXEL = schachbrett([30, 60, 220]);
const GRUEN_PIXEL = schachbrett([30, 160, 60]);

// ------------------------------------------------------------------------------------------------
// Das Zwillingsdeck — als DATEN beschrieben, damit jede Sollzahl aus der Beschreibung kommt
// ------------------------------------------------------------------------------------------------

/**
 * Was ein Bild in der Quelle BEDEUTET, bevor irgendein Import es anfasst.
 *
 * · `ausgeblendet` — `nein`, `form` (die Form trägt `hidden="1"`) oder `folie` (die Folie trägt
 *   `show="0"`). Ein ausgeblendetes Bild ist ein Bild der Datei: PowerPoint zeigt es im Editor und
 *   speichert es mit. Der Import kennt kein „ausgeblendet" (`pptx.ts` liest weder `hidden` noch
 *   `show`); er übernimmt es wie jedes andere. Genau das ist hier die Sollbedeutung: es zählt in
 *   der Quelle, es zählt als übernommen — und dann MUSS es am Entwurf und am Eintrag auch sichtbar
 *   dastehen. Ein „übernommenes" Bild, das niemand sieht, wäre die nächste Halbwahrheit.
 * · `erwartet` — folgt allein aus dem FORMAT (PNG erlaubt, BMP nicht; `pptx.ts:91-97`), nicht aus
 *   einer Zählung des Imports.
 */
export interface Deckbild {
  readonly folie: number;
  readonly rId: string;
  readonly datei: string;
  readonly ausgeblendet: "nein" | "form" | "folie";
  readonly erwartet: "uebernommen" | "verworfen";
  readonly bytes: Uint8Array;
  /** Die Pixel, die ein Mensch sehen muss — `null` für das verworfene BMP. */
  readonly pixel: Uint8Array | null;
}

/** Die Marken des Zwillingsdecks, eine je Folie — jede steht genau einmal im Rumpf. */
export const ZWILLING_MARKE = {
  titel: "Zwillingsdeck 4269",
  punkt: "Zwillingspunkt 4269",
  zweitfolie: "Zweitfolie 4269",
  verborgeneFolie: "Verborgene Folie 4269",
} as const;

export const ZWILLING_DATEINAME = "bildnachweis-zwillinge-ausgeblendet.pptx";

/**
 * Die sechs Bildverweise des Decks in DOKUMENTREIHENFOLGE. Drei tragen dieselben Bytes (ROT), einer
 * davon aus einer zweiten Mediendatei; zwei sind ausgeblendet (BLAU in der Form, GRÜN auf der
 * Folie); einer ist ein BMP.
 */
export const ZWILLINGSDECK: readonly Deckbild[] = [
  {
    folie: 1,
    rId: "rId9",
    datei: "zwilling-a.png",
    ausgeblendet: "nein",
    erwartet: "uebernommen",
    bytes: BILD_BYTES,
    pixel: ROT_PIXEL,
  },
  {
    folie: 2,
    rId: "rId9",
    datei: "zwilling-b.png",
    ausgeblendet: "nein",
    erwartet: "uebernommen",
    // IDENTISCHE BYTES in einer ZWEITEN Mediendatei.
    bytes: BILD_BYTES,
    pixel: ROT_PIXEL,
  },
  {
    folie: 2,
    rId: "rId10",
    // DIESELBE Mediendatei wie auf Folie 1 — ein zweiter Verweis, kein zweites Archivbild.
    datei: "zwilling-a.png",
    ausgeblendet: "nein",
    erwartet: "uebernommen",
    bytes: BILD_BYTES,
    pixel: ROT_PIXEL,
  },
  {
    folie: 2,
    rId: "rId11",
    datei: "versteckt-form.png",
    ausgeblendet: "form",
    erwartet: "uebernommen",
    bytes: pngAus(BLAU_PIXEL),
    pixel: BLAU_PIXEL,
  },
  {
    folie: 2,
    rId: "rId12",
    datei: "verworfen.bmp",
    ausgeblendet: "nein",
    erwartet: "verworfen",
    bytes: BMP_BYTES,
    pixel: null,
  },
  {
    folie: 3,
    rId: "rId9",
    datei: "versteckt-folie.png",
    ausgeblendet: "folie",
    erwartet: "uebernommen",
    bytes: pngAus(GRUEN_PIXEL),
    pixel: GRUEN_PIXEL,
  },
];

const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const URI_PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";
const XML_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function enc(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bildform(bild: Deckbild, formId: number): string {
  const verborgen = bild.ausgeblendet === "form" ? ' hidden="1"' : "";
  return [
    `<p:pic><p:nvPicPr><p:cNvPr id="${formId}" name="${bild.datei}"${verborgen}/>`,
    "<p:cNvPicPr/><p:nvPr/></p:nvPicPr>",
    `<p:blipFill><a:blip r:embed="${bild.rId}"/></p:blipFill></p:pic>`,
  ].join("");
}

function textform(marke: string, titel: boolean): string {
  const ph = titel ? '<p:ph type="title"/>' : '<p:ph type="body" idx="1"/>';
  const absatz = titel
    ? `<a:p><a:r><a:t>${marke}</a:t></a:r></a:p>`
    : `<a:p><a:pPr><a:buChar char="&#8226;"/></a:pPr><a:r><a:t>${marke}</a:t></a:r></a:p>`;
  return `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody>${absatz}</p:txBody></p:sp>`;
}

function folie(nummer: number): string {
  const bilder = ZWILLINGSDECK.filter((b) => b.folie === nummer);
  const text =
    nummer === 1
      ? `${textform(ZWILLING_MARKE.titel, true)}${textform(ZWILLING_MARKE.punkt, false)}`
      : textform(nummer === 2 ? ZWILLING_MARKE.zweitfolie : ZWILLING_MARKE.verborgeneFolie, false);
  const formen = bilder.map((b, i) => bildform(b, 10 + i)).join("");
  const zeigen = bilder.some((b) => b.ausgeblendet === "folie") ? ' show="0"' : "";
  return [
    XML_KOPF,
    `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"${zeigen}>`,
    `<p:cSld><p:spTree>${text}${formen}</p:spTree></p:cSld></p:sld>`,
  ].join("");
}

function folienRels(nummer: number): string {
  const rels = ZWILLINGSDECK.filter((b) => b.folie === nummer)
    .map((b) => `<Relationship Id="${b.rId}" Type="${URI_R}/image" Target="../media/${b.datei}"/>`)
    .join("");
  return `${XML_KOPF}<Relationships xmlns="${URI_PKG_R}">${rels}</Relationships>`;
}

const FOLIEN = [1, 2, 3] as const;

/** Die Einträge des Zwillingsdecks — offen einsehbar, wie `deckEintraege` in `messung.ts`. */
export function zwillingsdeckEintraege(): Record<string, Uint8Array> {
  const sldIds = FOLIEN.map((n) => `<p:sldId id="${255 + n}" r:id="rId${n}"/>`).join("");
  const praesRels = FOLIEN.map(
    (n) => `<Relationship Id="rId${n}" Type="${URI_R}/slide" Target="slides/slide${n}.xml"/>`,
  ).join("");
  const eintraege: Record<string, Uint8Array> = {
    "[Content_Types].xml": enc(
      [
        XML_KOPF,
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Default Extension="png" ContentType="image/png"/>',
        '<Default Extension="bmp" ContentType="image/bmp"/>',
        "</Types>",
      ].join(""),
    ),
    "_rels/.rels": enc(
      `${XML_KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    ),
    "ppt/presentation.xml": enc(
      `${XML_KOPF}<p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:sldIdLst>${sldIds}</p:sldIdLst></p:presentation>`,
    ),
    "ppt/_rels/presentation.xml.rels": enc(
      `${XML_KOPF}<Relationships xmlns="${URI_PKG_R}">${praesRels}</Relationships>`,
    ),
  };
  for (const n of FOLIEN) {
    eintraege[`ppt/slides/slide${n}.xml`] = enc(folie(n));
    eintraege[`ppt/slides/_rels/slide${n}.xml.rels`] = enc(folienRels(n));
  }
  for (const bild of ZWILLINGSDECK) {
    eintraege[`ppt/media/${bild.datei}`] = bild.bytes;
  }
  return eintraege;
}

/** Das Zwillingsdeck als echte ZIP-Bytes. */
export function zwillingsdeck(): Uint8Array {
  return zipSync(zwillingsdeckEintraege());
}

// ------------------------------------------------------------------------------------------------
// Die unabhängige Quellanalyse — direkt aus den ZIP-Bytes, ohne `pptx.ts`
// ------------------------------------------------------------------------------------------------

export interface Quellbild {
  readonly folie: number;
  readonly datei: string;
  readonly ausgeblendet: "nein" | "form" | "folie";
  readonly bytes: Uint8Array;
}

function text(eintraege: Record<string, Uint8Array>, pfad: string): string {
  const bytes = eintraege[pfad];
  if (!bytes) {
    throw new Error(`Quellanalyse: ${pfad} fehlt im Archiv`);
  }
  return new TextDecoder().decode(bytes);
}

function ziele(relsXml: string): Map<string, string> {
  const karte = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/gu)) {
    const id = /\bId="([^"]+)"/u.exec(m[0])?.[1];
    const ziel = /\bTarget="([^"]+)"/u.exec(m[0])?.[1];
    if (id && ziel) {
      karte.set(id, ziel);
    }
  }
  return karte;
}

/**
 * Jedes Bild der Quelle in Folienreihenfolge — gelesen aus `presentation.xml` (Reihenfolge), den
 * Folien-XMLs (`<p:pic>` mit `r:embed`, `hidden`, `show`) und den Mediendateien. Bewusst eine
 * EIGENE, kleine Auswertung: wer den Import prüft, darf seine Sollwerte nicht aus dem Import holen.
 */
export function quellanalyse(zip: Uint8Array): Quellbild[] {
  const eintraege = unzipSync(zip);
  const praesRels = ziele(text(eintraege, "ppt/_rels/presentation.xml.rels"));
  const reihenfolge = [
    ...text(eintraege, "ppt/presentation.xml").matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/gu),
  ].map((m) => `ppt/${praesRels.get(m[1] ?? "") ?? ""}`);
  const bilder: Quellbild[] = [];
  reihenfolge.forEach((pfad, i) => {
    const xml = text(eintraege, pfad);
    const name = pfad.slice(pfad.lastIndexOf("/") + 1);
    const rels = ziele(text(eintraege, `ppt/slides/_rels/${name}.rels`));
    const folieVerborgen = /<p:sld\b[^>]*\bshow="0"/u.test(xml);
    for (const pic of xml.matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/gu)) {
      const rid = /r:embed="([^"]+)"/u.exec(pic[0])?.[1] ?? "";
      const ziel = rels.get(rid) ?? "";
      const datei = ziel.slice(ziel.lastIndexOf("/") + 1);
      const bytes = eintraege[`ppt/media/${datei}`];
      if (!bytes) {
        throw new Error(`Quellanalyse: ${pfad} verweist mit ${rid} auf fehlende Mediendatei`);
      }
      const formVerborgen = /<p:cNvPr\b[^>]*\bhidden="1"/u.test(pic[0]);
      bilder.push({
        folie: i + 1,
        datei,
        ausgeblendet: folieVerborgen ? "folie" : formVerborgen ? "form" : "nein",
        bytes,
      });
    }
  });
  return bilder;
}

/** Die Sollbilanz, allein aus der Deckbeschreibung. */
export function sollbilanz(deck: readonly Deckbild[]): { imEntwurf: number; fehlend: number } {
  const uebernommen = deck.filter((b) => b.erwartet === "uebernommen").length;
  return { imEntwurf: uebernommen, fehlend: deck.length - uebernommen };
}

/** Die Pixel, die in dieser Reihenfolge am Entwurf und am Eintrag zu sehen sein MÜSSEN. */
export function sollpixel(deck: readonly Deckbild[]): Uint8Array[] {
  return deck.flatMap((b) => (b.erwartet === "uebernommen" && b.pixel ? [b.pixel] : []));
}

// ------------------------------------------------------------------------------------------------
// Der gespeicherte Rumpf — Bild für Bild, ohne Deduplizierung
// ------------------------------------------------------------------------------------------------

export interface Rumpfbild {
  readonly mime: string;
  readonly bytes: Uint8Array;
}

/**
 * JEDES eingebettete Bild des Rumpfs in Dokumentreihenfolge — zwei `<img>` mit derselben Quelle
 * sind zwei Bilder. Genau das unterscheidet diese Zählung von `BILDER_AM_EINTRAG` in
 * `nutzerweg-drei-sprachen-chromium.test.ts:147`, die VERSCHIEDENE Quellen zählt.
 */
export function bilderImRumpf(html: string): Rumpfbild[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="data:(image\/[a-z+.-]+);base64,([^"]*)"/gu)].map(
    (m) => ({ mime: m[1] ?? "", bytes: new Uint8Array(Buffer.from(m[2] ?? "", "base64")) }),
  );
}

/** Die Zählweise von `BILDER_AM_EINTRAG`, im Rumpf nachgestellt: VERSCHIEDENE Quellen. */
export function verschiedeneQuellen(html: string): number {
  return new Set([...html.matchAll(/<img\b[^>]*\bsrc="(data:image\/[^"]*)"/gu)].map((m) => m[1]))
    .size;
}

/** Der Text des Quelle-Blockquotes, entitätenfrei — dort steht die Quittung. */
export function belegText(html: string): string {
  const block = /<blockquote>([\s\S]*?)<\/blockquote>/u.exec(html)?.[1] ?? "";
  return block
    .replace(/<[^>]+>/gu, " ")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

function gleich(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Der Bildnachweis eines gespeicherten Rumpfs gegen das Deck: Quittungszahlen, Bildzahl und die
 * BYTES jedes Bildes in Reihenfolge. Leere Liste = stimmt; jede Zeile ist ein benannter Befund.
 */
export function rumpfBefunde(html: string, sprache: Sprache, deck: readonly Deckbild[]): string[] {
  const befunde: string[] = [];
  const soll = sollbilanz(deck);
  const beleg = belegText(html);
  if (!beleg.includes(BILANZ_PRAEFIX[sprache])) {
    befunde.push(`kein Bilanzsatz im Beleg: «${beleg}»`);
  } else {
    const aussage = bilanzAussage(beleg, sprache);
    if (aussage?.imEntwurf !== soll.imEntwurf || (aussage?.fehlend ?? 0) !== soll.fehlend) {
      befunde.push(
        `Quittung ${JSON.stringify(aussage)} statt ${JSON.stringify(soll)} («${beleg}»)`,
      );
    }
  }
  const erwartet = deck.filter((b) => b.erwartet === "uebernommen");
  const da = bilderImRumpf(html);
  if (da.length !== erwartet.length) {
    befunde.push(`${da.length} Bilder im Rumpf statt ${erwartet.length}`);
  }
  erwartet.forEach((b, i) => {
    const bild = da[i];
    if (bild && !gleich(bild.bytes, b.bytes)) {
      befunde.push(`Bild ${i + 1} (${b.datei}) trägt andere Bytes als die Originaldatei`);
    }
  });
  return befunde;
}

// ------------------------------------------------------------------------------------------------
// Die Ablesung im Browser — am SICHTBAREN Inhaltscontainer, Bild für Bild
// ------------------------------------------------------------------------------------------------

/** Der Inhalt des Entwurfs auf `/erfassen`. */
export const ENTWURF_INHALT = '[data-testid="blatt-text"]';
/**
 * Der Inhalt des Wissenseintrags auf `/wissen/:id`: der sanitisierte Rumpf, OHNE die Bildergalerie
 * daneben (`BibliothekLesen.tsx`, `bib-text` → `SanitizedHtml.prose-kw` + `BodyImageGallery`). Die
 * Galerie zeigt dieselben Bilder als Vorschau ein zweites Mal — der Grund für das „expected 2 to
 * be 1" aus JOB 4269 und damit für die Quellen-Deduplizierung, die hier ersetzt wird.
 */
export const EINTRAG_INHALT = '[data-testid="bib-text"] > .prose-kw';

export interface Bildablesung {
  readonly quelle: string;
  readonly sichtbar: boolean;
  readonly fertig: boolean;
  readonly breite: number;
  readonly hoehe: number;
  /** Dekodierte RGB-Pixel über `canvas.getImageData` — leer, wenn nichts dekodiert wurde. */
  readonly pixel: readonly number[];
}

/**
 * Jedes `<img>` im Container, OHNE Deduplizierung: Sichtbarkeit (Box, `display`, `visibility`,
 * `checkVisibility`), Dekodierung (`naturalWidth`/`naturalHeight`) und die tatsächlich gezeichneten
 * Pixel. Data-URLs verunreinigen die Leinwand nicht; `getImageData` ist also erlaubt.
 * `null` = den Container gibt es nicht — das ist etwas anderes als „keine Bilder".
 */
export const BILDER_IM_INHALT = `(sel) => {
  const wurzel = document.querySelector(sel);
  if (!wurzel) { return null; }
  return Array.prototype.map.call(wurzel.querySelectorAll('img'), (b) => {
    const box = b.getBoundingClientRect();
    const stil = getComputedStyle(b);
    const sichtbar = box.width > 0 && box.height > 0 && stil.display !== 'none'
      && stil.visibility !== 'hidden'
      && (typeof b.checkVisibility !== 'function'
        || b.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
    const pixel = [];
    if (b.complete && b.naturalWidth > 0) {
      const leinwand = document.createElement('canvas');
      leinwand.width = b.naturalWidth;
      leinwand.height = b.naturalHeight;
      const g = leinwand.getContext('2d');
      g.drawImage(b, 0, 0);
      const d = g.getImageData(0, 0, leinwand.width, leinwand.height).data;
      for (let i = 0; i < d.length; i += 4) { pixel.push(d[i], d[i + 1], d[i + 2]); }
    }
    return {
      quelle: (b.getAttribute('src') || '').slice(0, 40),
      sichtbar,
      fertig: b.complete,
      breite: b.naturalWidth,
      hoehe: b.naturalHeight,
      pixel,
    };
  });
}`;

/** Wahr, sobald der Container steht und JEDES Bild darin entschieden ist (geladen oder gescheitert). */
export const BILDER_ENTSCHIEDEN = `(sel) => {
  const wurzel = document.querySelector(sel);
  if (!wurzel) { return false; }
  const bilder = wurzel.querySelectorAll('img');
  return bilder.length > 0 && Array.prototype.every.call(bilder, (b) => b.complete);
}`;

/**
 * Farbtoleranz je Kanal. Das Muster besteht aus Weiß und drei weit auseinanderliegenden Farben;
 * zwei Stufen Spielraum fangen eine Farbraumrundung ab, ohne Rot mit Blau verwechseln zu können.
 */
const TOLERANZ = 2;

function pixelGleich(ist: readonly number[], soll: Uint8Array): boolean {
  return (
    ist.length === soll.length && ist.every((x, i) => Math.abs(x - (soll[i] ?? -99)) <= TOLERANZ)
  );
}

/**
 * Der Bildnachweis AM DOM: jedes sichtbare Bild zählt einzeln, jedes muss dekodiert sein, und die
 * gezeichneten Pixel müssen in Reihenfolge die der Originaldateien sein. Dazu die Zahl der
 * Quittung. Leere Liste = stimmt.
 */
export function domBefunde(
  ablesung: readonly Bildablesung[] | null,
  soll: readonly Uint8Array[],
  quittung: { imEntwurf: number; fehlend: number | null } | null,
  sollFehlend: number,
): string[] {
  if (ablesung === null) {
    return ["der Inhaltscontainer steht nicht auf der Seite"];
  }
  const befunde: string[] = [];
  const sichtbar = ablesung.filter((b) => b.sichtbar);
  const dekodiert = sichtbar.filter((b) => b.fertig && b.breite > 0 && b.hoehe > 0);
  if (sichtbar.length !== ablesung.length) {
    befunde.push(`${ablesung.length - sichtbar.length} Bild(er) im Inhalt sind nicht sichtbar`);
  }
  if (dekodiert.length !== soll.length) {
    befunde.push(`${dekodiert.length} sichtbare, dekodierte Bilder statt ${soll.length}`);
  }
  dekodiert.forEach((b, i) => {
    const s = soll[i];
    if (s && !pixelGleich(b.pixel, s)) {
      befunde.push(`Bild ${i + 1} zeigt nicht die Pixel der Originaldatei (${b.quelle}…)`);
    }
  });
  if (quittung === null) {
    befunde.push("keine Bilanz in der Quittung");
  } else {
    if (quittung.imEntwurf !== dekodiert.length) {
      befunde.push(
        `Quittung nennt ${quittung.imEntwurf} übernommen, sichtbar dekodiert sind ${dekodiert.length}`,
      );
    }
    if ((quittung.fehlend ?? 0) !== sollFehlend) {
      befunde.push(`Quittung nennt ${quittung.fehlend ?? 0} nicht übernommen statt ${sollFehlend}`);
    }
  }
  return befunde;
}

// ------------------------------------------------------------------------------------------------
// Die DOM-Gegenprobe — der Nachweis über das Messmittel
// ------------------------------------------------------------------------------------------------

/**
 * Die vier Verstellungen. Jede lässt die Zahl der Quittung stehen und nimmt dem Menschen etwas
 * weg, das die Quittung ihm zusagt:
 *  · `entfernen`  — ein `<img>` verschwindet aus dem Baum,
 *  · `ausblenden` — es bleibt im Baum, aber `display: none`,
 *  · `zerstoeren` — seine Quelle ergibt kein Bild mehr (Dekodierung scheitert),
 *  · `vertauschen`— es zeigt die Pixel eines ANDEREN Bildes (Zahl und Dekodierung stimmen weiter).
 */
export type Verstellart = "entfernen" | "ausblenden" | "zerstoeren" | "vertauschen";
export const VERSTELLARTEN: readonly Verstellart[] = [
  "entfernen",
  "ausblenden",
  "zerstoeren",
  "vertauschen",
];

/**
 * Verstellt Bild `index` im Container und merkt sich, wie es zurückgeht. `vertauschen` nimmt die
 * Quelle von Bild `von`. Die Rückgabe ist ein Promise, wo die Dekodierung abgewartet werden muss —
 * `page.evaluate` wartet darauf, ohne dass ein fester Zeitwert nötig wäre.
 */
export const BILD_VERSTELLEN = `(arg) => {
  const wurzel = document.querySelector(arg.sel);
  const bilder = wurzel ? wurzel.querySelectorAll('img') : [];
  const b = bilder[arg.index];
  if (!b || window.__bildGegenprobe) { return false; }
  if (arg.art === 'entfernen') {
    window.__bildGegenprobe = { art: arg.art, bild: b, eltern: b.parentNode, danach: b.nextSibling };
    b.parentNode.removeChild(b);
    return true;
  }
  if (arg.art === 'ausblenden') {
    window.__bildGegenprobe = { art: arg.art, bild: b, wert: b.style.display };
    b.style.display = 'none';
    return true;
  }
  const alt = b.getAttribute('src');
  const neu = arg.art === 'zerstoeren'
    ? 'data:image/png;base64,AAAAAAAA'
    : (bilder[arg.von] ? bilder[arg.von].getAttribute('src') : null);
  if (neu === null) { return false; }
  window.__bildGegenprobe = { art: arg.art, bild: b, wert: alt };
  b.setAttribute('src', neu);
  return b.decode().then(() => arg.art === 'vertauschen', () => arg.art === 'zerstoeren');
}`;

/** Stellt die zuletzt verstellte Lage wieder her; bei neuer Quelle erst nach deren Dekodierung. */
export const BILD_ZURUECK = `() => {
  const p = window.__bildGegenprobe;
  if (!p) { return false; }
  delete window.__bildGegenprobe;
  if (p.art === 'entfernen') { p.eltern.insertBefore(p.bild, p.danach); return true; }
  if (p.art === 'ausblenden') { p.bild.style.display = p.wert; return true; }
  p.bild.setAttribute('src', p.wert);
  return p.bild.decode().then(() => true, () => false);
}`;

export interface Gegenprobe {
  /** Liest die Bilder des Containers — im Browser `BILDER_IM_INHALT`. */
  lesen: () => Promise<readonly Bildablesung[] | null>;
  /** Prüft eine Ablesung; leere Liste = der Fall wäre grün. */
  pruefen: (ablesung: readonly Bildablesung[] | null) => string[];
  verstellen: (art: Verstellart) => Promise<boolean>;
  zurueck: () => Promise<boolean>;
}

/**
 * Fährt jede Verstellung und verlangt dreierlei: VORHER ist der Nachweis grün, WÄHREND der
 * Verstellung ist er rot (mindestens ein Befund), NACHHER wieder grün. Ein Ableser, der während der
 * Verstellung dasselbe liefert wie vorher — ein eingefrorener Wert, ein Blick auf die falsche
 * Fläche —, lässt die Gegenprobe werfen.
 *
 * Die Wiederherstellung läuft bei JEDEM Ausgang des mittleren Schritts, auch wenn der Ableser wirft
 * (dieselbe Lehre wie `ablesungKalibrieren`, Runde 5).
 *
 * Rückgabe: je Verstellung die Befunde, die der Nachweis in der verstellten Lage meldete — damit
 * der Fall zeigen kann, WORAN er rot geworden wäre.
 */
export async function domGegenprobe(
  probe: Gegenprobe,
  arten: readonly Verstellart[] = VERSTELLARTEN,
): Promise<Record<Verstellart, string[]>> {
  const protokoll = {} as Record<Verstellart, string[]>;
  const vorher = probe.pruefen(await probe.lesen());
  if (vorher.length > 0) {
    throw new Error(`Gegenprobe: schon VOR dem Verstellen rot — ${vorher.join(" · ")}`);
  }
  for (const art of arten) {
    if (!(await probe.verstellen(art))) {
      await probe.zurueck();
      throw new Error(`Gegenprobe «${art}»: die Verstellung liess sich nicht herstellen`);
    }
    let waehrend: string[] = [];
    let fehler: unknown;
    let geworfen = false;
    try {
      waehrend = probe.pruefen(await probe.lesen());
    } catch (e) {
      geworfen = true;
      fehler = e;
    }
    const zurueck = await probe.zurueck();
    if (geworfen) {
      throw fehler;
    }
    if (!zurueck) {
      throw new Error(`Gegenprobe «${art}»: die Seite liess sich NICHT wiederherstellen`);
    }
    if (waehrend.length === 0) {
      throw new Error(
        `Gegenprobe «${art}»: der Nachweis blieb grün, obwohl ein Bild ${art === "entfernen" ? "fehlte" : "verstellt war"} — die Ablesung ist eingefroren oder liest die falsche Fläche`,
      );
    }
    const nachher = probe.pruefen(await probe.lesen());
    if (nachher.length > 0) {
      throw new Error(
        `Gegenprobe «${art}»: nach der Wiederherstellung rot — ${nachher.join(" · ")}`,
      );
    }
    protokoll[art] = waehrend;
  }
  return protokoll;
}
