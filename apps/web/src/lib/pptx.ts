// DOM-freier PowerPoint-Kern (WP-D5 / WP-D5b). Bewusst OHNE File/Image/document/FileReader — im Node-/
// Root-Typecheck und in Tests mit kleinen XML-Fixtures prüfbar. Der Browser-Wrapper (fflate lazy,
// selektiv + budgetiert) liegt in `files.ts`. Spiegelt strikt die DOCX/PDF-Architektur (docx.ts/pdf.ts):
// reine Extraktion, injizierte Engine (hier: unzip), strukturerhaltendes bodyHtml + Klartext + Bilanz.
//
// Best-Effort & EHRLICH: .pptx ist ein ZIP mit ppt/slides/slideN.xml (Reihenfolge über
// ppt/presentation.xml + rels). Pro Folie: Titel-Platzhalter → h2, restliche Textrahmen → Absätze,
// a:buChar → <ul>, a:buAutoNum → <ol>, Tabellen (p:graphicFrame → a:tbl) Best-Effort → <table>. Folien
// werden durch die h2 sichtbar getrennt. WP-D9 (Pedis Live-Befund): BILDER werden jetzt wie beim
// DOCX-Import als <figure> mit Bild-Fußnote übernommen (p:pic → a:blip r:embed → Folien-Rels →
// ppt/media/*, an ihrer Position im Folien-Fluss); nicht darstellbare Formate (EMF/WMF/TIFF) und
// Budget-Überläufe werden EHRLICH als Teilverlust gezählt. Layout/Animationen/Übergänge/Notizen gehen
// weiterhin verloren (im Verlusthinweis benannt).
//
// WP-D5b (bens ROT-Fix 1): NAMESPACE-AWARE. XML-Präfixe (a:/p:/r:) sind nicht fest — sie werden aus den
// xmlns-Deklarationen des Dokuments dynamisch aufgelöst (drawingml/presentationml/relationships-URI →
// tatsächliches Präfix). Fällt der Namespace nicht deklariert an, greift ein präfix-tolerantes Muster.
// Relationship-Parsing ist unabhängig von Attribut-Reihenfolge und Anführungszeichen-Art.

import {
  IMAGE_ID_PREFIX,
  MAX_INLINE_BODY_HTML_BYTES,
  newImageRunToken,
  utf8ByteLength,
} from "./docx";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// Bekannte OOXML-Namespace-URIs. Elemente/Attribute werden über diese URIs (→ aktuelles Präfix)
// erkannt, NICHT über hartkodierte Präfix-Strings.
const NS_DRAWINGML = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_PRESENTATIONML = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_OFFICE_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
// WP-D5d: die Package-Relationships-URI der .rels-Dateien — der <Relationship>-Elementscanner wird über
// dieselbe zentrale Namespace-Auflösung geführt (statt eines eigenen ASCII-Musters).
const NS_PACKAGE_RELS = "http://schemas.openxmlformats.org/package/2006/relationships";

// DOM-freie Erkennung über Dateiname/MIME (ohne File-Objekt), Muster isDocxDocumentLike.
export function isPptxDocumentLike(input: { name: string; type?: string }): boolean {
  return input.type === PPTX_MIME || input.name.toLowerCase().endsWith(".pptx");
}

// Injizierter Entpack-Vertrag (Muster DocxEngine/PdfEngine): der Test nutzt einen Fake, der
// Browser-Wrapper lädt fflate selektiv + budgetiert lazy. Rückgabe: Pfad → Rohbytes.
export type PptxUnzip = (data: Uint8Array) => Record<string, Uint8Array>;

// WP-D5: Folien-Cap als Sicherheitsnetz gegen Riesen-Decks (analog MAX_PDF_PAGES). Über dem Cap wird
// der Rest NICHT still verschluckt, sondern ehrlich als `truncated` gemeldet.
export const MAX_PPTX_SLIDES = 300;

// WP-D5b/WP-D5c (bens GELB/ROT-Fix Budget): Archiv-/Dekompressionsbudget gegen Zip-Bomben. Die harten
// Grenzen werden im Entpack-Filter VOR jeder Dekompression aus den ZIP-Metadaten durchgesetzt (s.
// createPptxUnzipBudget); assertArchiveWithinBudget ist nur noch ein Ist-Byte-Backstop auf der bereits
// gefilterten Menge. Gewählte Zahlen (browsergerecht, konservativ):
//  - 64 MiB dekomprimiertes Gesamtbudget (Vorab, aus ZIP-Metadaten) — reale Decks liegen weit darunter;
//  - 4000 gesehene Central-Directory-Einträge (Iterations-Cap);
//  - 2000 akzeptierte slideN.xml-Einträge (harter Abbruch → bounded Dekompression; ein normaler Deck
//    liegt unter MAX_PPTX_SLIDES, ein 2000+-Folien-Archiv wird ehrlich abgelehnt statt still gekürzt);
//  - Expansionsratio 100 je NICHTLEEREM akzeptiertem Eintrag.
export const PPTX_MAX_ENTRIES = 5000; // Backstop-Cap für assertArchiveWithinBudget (gefilterte Menge)
export const PPTX_MAX_TOTAL_DECOMPRESSED_BYTES = 64 * 1024 * 1024; // 64 MiB
export const PPTX_MAX_ARCHIVE_ENTRIES = 4000;
export const PPTX_MAX_SLIDE_ENTRIES = 2000;
export const PPTX_MAX_ENTRY_EXPANSION_RATIO = 100;
// WP-D5d (GELB-Härtung 3): Deckel für die Namespace-Präfix-Alternation — Anzahl gesammelter Präfixe je
// Dokument und Länge je Präfix. Ein entartetes/böswilliges XML mit tausenden xmlns-Deklarationen soll die
// Regex-Alternation nicht sprengen; Überschreitung → kontrollierter Importfehler.
export const PPTX_MAX_NS_PREFIXES = 32;
export const PPTX_MAX_NS_PREFIX_LEN = 64;
// Benötigte ZIP-Einträge (nur diese werden dekomprimiert) und die Folien-Untermenge.
// WP-D9: zusätzlich die Folien-Rels (Bild-Auflösung rId → Target) und ppt/media/* (die Bild-Bytes) —
// über DENSELBEN gebudgeteten Streaming-Unzip; die Ist-Byte-Zählung (pro Eintrag + kumuliert, 64 MiB)
// gilt UNVERÄNDERT auch für Medien: kein zweiter Unzip-Pfad, kein Budget-Bypass, weiterhin fail-closed.
export const PPTX_NEEDED_ENTRY_RE =
  /^ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|media\/[^/]+)$/;
const PPTX_SLIDE_ENTRY_RE = /^ppt\/slides\/slide\d+\.xml$/;

// WP-D9: Budget für EINGEBETTETE Bilder — bewusst GETRENNT vom harten Archiv-Budget (64 MiB, fail-closed
// gegen Zip-Bomben). Abwägung: Bilder werden als base64-data-URLs in bodyHtml eingebettet (~4/3 Aufblähung)
// und müssen durch Editor/Sanitizer/Persistenz — 5 MiB je Bild / 20 MiB gesamt halten das handhabbar.
// SEMANTIK: Überschreitung des BILD-Budgets ist ein EHRLICHER TEILVERLUST (Bild wird nicht eingebettet,
// gezählt in droppedImageBudget) — der Dokumenttext bleibt IMMER erhalten, kein Abbruch des Imports.
// NUR das Archiv-Budget (echte dekomprimierte Bytes inkl. Medien) bleibt fail-closed (PptxTooLargeError).
export const PPTX_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MiB je Bild (dekodiert)
export const PPTX_MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MiB Summe eingebetteter Bilder

// WP-D9: nur ECHTE, vom Sanitizer erlaubte Rasterformate (isSafeImgSrc-Allowlist: png/jpeg/gif/webp) —
// bmp bewusst NICHT (würde vom Sanitizer wieder gestrippt), EMF/WMF/TIFF sind ohne Renderer nicht
// konvertierbar → ehrlicher Format-Teilverlust (droppedImageFormat) statt kaputter Einbettung.
const PPTX_IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

// WP-D5b: ehrlicher, kontrollierter Importfehler (statt UI-Freeze / stiller Teilimport). Der Aufrufer
// (Capture) fängt ihn und zeigt eine spezifische DE/EN/NL-Meldung.
export type PptxImportErrorReason =
  | "file-too-large"
  | "archive-too-large"
  | "too-many-entries"
  | "expansion-ratio"
  // WP-D5d (GELB-Härtung 3): zu viele/zu lange Namespace-Präfixe (entartetes XML).
  | "too-many-namespaces";

export class PptxTooLargeError extends Error {
  readonly reason: PptxImportErrorReason;
  constructor(reason: PptxImportErrorReason) {
    super(`PPTX_TOO_LARGE:${reason}`);
    this.name = "PptxTooLargeError";
    this.reason = reason;
  }
}

export interface PptxRichResult {
  html: string; // strukturerhaltendes HTML (h2 je Folie, Absätze, Listen, Tabellen, WP-D9: figures)
  text: string; // Klartext — für die KI-Punkte-Extraktion
  slideCount: number; // tatsächlich gelesene Folien (bis zum Cap)
  truncated: boolean; // true, wenn das Deck mehr Folien hat als gelesen wurden
  imageCount: number; // ALLE erkannten eingebetteten Bilder (a:blip) — Basis der ehrlichen Bilanz
  tableCount: number; // Best-Effort übernommene Tabellen (a:tbl → <table>)
  htmlOverflow: boolean; // true, wenn das Folien-HTML (inkl. figures) das Inline-Byte-Budget übersteigt
  // WP-D9: ehrliche Bild-Bilanz — eingebettet vs. Teilverluste nach Ursache (Format/Bild-Budget).
  embeddedImages: number; // als <figure> mit Fußnote übernommene Bilder
  droppedImageFormat: number; // nicht unterstütztes Format (EMF/WMF/TIFF/BMP …)
  droppedImageBudget: number; // Einzelbild- oder Gesamt-Bild-Budget überschritten
}

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

// XML-Entities (inkl. numerischer) in Klartext auflösen.
function unescapeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);
}

// Sichere HTML-Ausgabe (das bodyHtml sanitisiert autoritativ der Server; hier defensiv escapen).
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// WP-D5d (bens ROT-Fix 1): Escapes müssen u-flag-tauglich sein — RegExp mit u-Flag wirft bei einem
// Backslash vor einem NICHT-Sonderzeichen. reEscape maskiert deshalb NUR echte Regex-Sonderzeichen
// (Unicode-Buchstaben eines Präfixes bleiben unverändert und sind in u-Mode gültige Literale).
function reEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// WP-D5d/WP-D5e (bens ROT-Fix): praktisch ausreichende XML-NCName-Näherung (bewusst vereinfacht — dokumentiert):
// Namensstart [\p{L}_], Namenszeichen [\p{L}\p{M}\p{N}_.·-]. \p{M} (Combining Marks) ist wichtig: ein DEKOM-
// PONIERTES Präfix (z. B. „ä" als a + U+0308 Combining Diaeresis, NFD) ist sonst kein gültiger Name und ginge
// verloren. Deckt Unicode-Buchstaben-Präfixe inkl. kombinierender Zeichen ab, NICHT die vollständige
// NCName-Grammatik (Extender-Feinheiten) — für PPTX-Präfixe unnötig. ALLE damit gebauten Regexe tragen das
// u-Flag (Property-Escapes).
const NCNAME_CHAR = "[\\p{L}\\p{M}\\p{N}_.\\u00B7-]";
const NCNAME = `[\\p{L}_]${NCNAME_CHAR}*`;

// Tag-Namensgrenze (Unicode): der Local Name endet hier — KEIN weiteres Namenszeichen und KEIN ':' danach
// (sonst wäre es ein Präfix). Ersetzt das alte \b und verhindert die Kollision praefixlos <p> vs. <p:sp>.
const TAG_BOUNDARY = "(?![\\p{L}\\p{M}\\p{N}_.\\u00B7:-])";

// WP-D5c/WP-D5d (bens ROT-Fix 1): xmlns-Deklarationen des GESAMTEN Dokuments einsammeln — URI → Set ALLER
// gebundenen Präfixe (auch verschachtelte/lokale Rebindings; "" = Default-Namespace), Präfixe als
// Unicode-NCNames. BEWUSSTE NÄHERUNG (nicht nur „harmlos zu viel"): der dokumentweite Ansatz kann bei
// LOKALEM Rebinding DESSELBEN Präfixes auf eine FREMDE URI übermatchen — dann würde ein Element unter dem
// fremden Rebinding fälschlich als das erwartete erkannt. Das ist in realen PPTX praktisch irrelevant
// (Präfixe werden konsistent gebunden); echte per-Scope-Auflösung wäre ein größerer Umbau (kein Vollausbau).
// GELB-Härtung: Anzahl/Länge der Präfixe gedeckelt → kontrollierter Importfehler statt Alternations-Explosion.
function collectNamespacePrefixSets(xml: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const re = new RegExp(`\\bxmlns(?::(${NCNAME}))?\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "gu");
  let total = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(xml)) !== null) {
    const prefix = m[1] ?? "";
    const uri = m[2] ?? m[3] ?? "";
    if (uri.length === 0) {
      continue;
    }
    if (prefix.length > PPTX_MAX_NS_PREFIX_LEN) {
      throw new PptxTooLargeError("too-many-namespaces");
    }
    const set = map.get(uri);
    if (set) {
      if (!set.has(prefix)) {
        total += 1;
        set.add(prefix);
      }
    } else {
      total += 1;
      map.set(uri, new Set([prefix]));
    }
    if (total > PPTX_MAX_NS_PREFIXES) {
      throw new PptxTooLargeError("too-many-namespaces");
    }
  }
  return map;
}

// Regex-Fragment, das den TAG-NAMEN (Präfix + Local Name) einer URI matcht — Alternation über ALLE
// gebundenen Präfixe; ist der Default-Namespace gebunden, zusätzlich die praefixlose (kollisionssichere)
// Form. Ist die URI gar nicht deklariert: praefix-tolerant (irgendein NCName-Präfix ODER kein Präfix).
function tagName(prefixSet: Set<string> | undefined, localName: string): string {
  const ln = reEscape(localName);
  const named: string[] = [];
  let hasDefault = false;
  if (prefixSet) {
    for (const p of prefixSet) {
      if (p === "") {
        hasDefault = true;
      } else {
        named.push(reEscape(p));
      }
    }
  }
  const alts: string[] = [];
  if (named.length > 0) {
    alts.push(`(?:${named.join("|")}):${ln}${TAG_BOUNDARY}`);
  }
  if (hasDefault) {
    alts.push(`${ln}${TAG_BOUNDARY}`);
  }
  if (alts.length === 0) {
    alts.push(`(?:${NCNAME}:)?${ln}${TAG_BOUNDARY}`);
  }
  return `(?:${alts.join("|")})`;
}

// Regex-Fragment für ein NAMESPACED ATTRIBUT (z. B. r:id): Attribute erben NIE das Default-Namespace,
// tragen also immer ein Präfix. Alternation über ALLE gebundenen Relationship-Präfixe; Fallback verlangt
// IRGENDEIN NCName-Präfix — nie das bare „id" (das im sldId sonst mit der numerischen Folien-Id kollidierte).
function attrName(prefixSet: Set<string> | undefined, localName: string): string {
  const ln = reEscape(localName);
  const named: string[] = [];
  if (prefixSet) {
    for (const p of prefixSet) {
      if (p !== "") {
        named.push(reEscape(p));
      }
    }
  }
  if (named.length > 0) {
    return `(?:${named.join("|")}):${ln}`;
  }
  return `${NCNAME}:${ln}`;
}

interface DrawingNs {
  a: Set<string> | undefined; // ALLE gebundenen Präfixe für drawingml (undefined = nicht deklariert)
  p: Set<string> | undefined; // ALLE gebundenen Präfixe für presentationml
  // WP-D9: officeDocument-Relationships-Präfixe (r:embed am a:blip) — zentrale Auflösung wie a/p.
  r: Set<string> | undefined;
}

function drawingNs(xml: string): DrawingNs {
  const map = collectNamespacePrefixSets(xml);
  return { a: map.get(NS_DRAWINGML), p: map.get(NS_PRESENTATIONML), r: map.get(NS_OFFICE_RELS) };
}

type ListKind = "none" | "ul" | "ol";

interface SlidePara {
  text: string;
  list: ListKind;
}

type BodyItem =
  | { kind: "para"; text: string; list: ListKind }
  | { kind: "table"; html: string; text: string }
  // WP-D9: eingebettetes Bild als fertige figure (an seiner Position im Folien-Fluss).
  | { kind: "image"; html: string };

// WP-D9: DOM-freies base64 (kein btoa im Node-Typecheck/Test, kein Buffer im Browser). Einfache
// 3-Byte-Gruppierung mit Padding — ausreichend schnell für die gedeckelten Bildgrößen (≤ 5 MiB).
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out.push(BASE64_ALPHABET[b0 >> 2] ?? "");
    out.push(BASE64_ALPHABET[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)] ?? "");
    out.push(b1 === undefined ? "=" : (BASE64_ALPHABET[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)] ?? ""));
    out.push(b2 === undefined ? "=" : (BASE64_ALPHABET[b2 & 63] ?? ""));
  }
  return out.join("");
}

// WP-D9: rId des Bildes im p:pic-Block — a:blip mit r:embed, namespace-aware über die zentrale
// Auflösung (attrName über ALLE gebundenen r-Präfixe; \s vor dem Attribut wie beim sldId-Scanner).
function blipEmbedRid(picXml: string, ns: DrawingNs): string | null {
  const blip = tagName(ns.a, "blip");
  const embedAttr = attrName(ns.r, "embed");
  const re = new RegExp(`<${blip}[^>]*\\s${embedAttr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "u");
  const m = re.exec(picXml);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

// WP-D9: figure exakt im Vertrag von wrapImagesInFigures (BILD-1a/1b): beidseitige data-image-id
// (img UND figcaption, Token-Muster [\w-] — Sanitizer-Vertrag unangetastet), ehrlicher Platzhalter.
function imageFigureHtml(src: string, id: string, caption: string): string {
  return `<figure><img data-image-id="${id}" src="${src}"><figcaption data-image-id="${id}">${escapeHtml(caption)}</figcaption></figure>`;
}

// WP-D5b (GELB-Fix 4): Text eines <a:p>-Absatzes. <a:t>-Runs werden zusammengefügt, <a:br/> wird als
// Leerzeichen behandelt (sonst verschmelzen „Hallo"<br>„Welt" zu „HalloWelt"). Reihenfolge-treu über
// EINE Token-Iteration (Runs UND Umbrüche).
function paragraphText(paragraphXml: string, ns: DrawingNs): string {
  const t = tagName(ns.a, "t");
  const br = tagName(ns.a, "br");
  const re = new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>|<${br}[^>]*\\/?>`, "gu");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(paragraphXml)) !== null) {
    if (m[1] !== undefined) {
      out.push(unescapeXml(m[1]));
    } else {
      out.push(" "); // <a:br/> → Leerzeichen
    }
  }
  return out.join("").replace(/\s+/g, " ").trim();
}

// Aufzählungs-Art des Absatzes aus den Absatz-Eigenschaften: buAutoNum → nummeriert (ol), buChar →
// unnummeriert (ul), buNone/keine → keine Liste.
// BEWUSSTE GRENZE (WP-D5b): Bullet-Vererbung aus Folien-Master/Layout (ppt/slideLayouts, ppt/slideMasters)
// wird NICHT aufgelöst — nur die auf dem Absatz SELBST gesetzten Bullet-Eigenschaften zählen. Erbt ein
// Absatz seinen Bullet nur vom Layout, erscheint er hier als normaler Absatz (kein Vollausbau in diesem
// Slice; Best-Effort, kein stiller Datenverlust — der Text bleibt erhalten).
function paragraphListKind(paragraphXml: string, ns: DrawingNs): ListKind {
  const pPr = tagName(ns.a, "pPr");
  const block =
    new RegExp(`<${pPr}[\\s\\S]*?(?:\\/>|<\\/${pPr}>)`, "u").exec(paragraphXml)?.[0] ?? "";
  if (new RegExp(`<${tagName(ns.a, "buNone")}`, "u").test(block)) {
    return "none";
  }
  if (new RegExp(`<${tagName(ns.a, "buAutoNum")}`, "u").test(block)) {
    return "ol";
  }
  if (new RegExp(`<${tagName(ns.a, "buChar")}`, "u").test(block)) {
    return "ul";
  }
  return "none";
}

function shapeParagraphs(shapeXml: string, ns: DrawingNs): SlidePara[] {
  const paras: SlidePara[] = [];
  const p = tagName(ns.a, "p");
  const re = new RegExp(`<${p}[^>]*>([\\s\\S]*?)<\\/${p}>|<${p}[^>]*\\/>`, "gu");
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(shapeXml)) !== null) {
    const inner = m[1] ?? "";
    const text = paragraphText(inner, ns);
    if (text.length === 0) {
      continue;
    }
    paras.push({ text, list: paragraphListKind(inner, ns) });
  }
  return paras;
}

function shapeIsTitle(shapeXml: string, ns: DrawingNs): boolean {
  return new RegExp(
    `<${tagName(ns.p, "ph")}[^>]*\\btype\\s*=\\s*(?:"(?:title|ctrTitle)"|'(?:title|ctrTitle)')`,
    "u",
  ).test(shapeXml);
}

// WP-D5b (GELB-Fix 4): Tabelle (a:tbl) Best-Effort → einfache <table> (Zeilen a:tr, Zellen a:tc). Der
// Server-Sanitizer erlaubt table/tr/td. Charts/Diagramme in anderen graphicFrames bleiben eine bewusste
// Grenze (kein Chart-Rendering) und werden über den Verlusthinweis kommuniziert.
function tableFromGraphicFrame(
  frameXml: string,
  ns: DrawingNs,
): { html: string; text: string } | null {
  const tblName = tagName(ns.a, "tbl");
  const tbl = new RegExp(`<${tblName}[\\s\\S]*?<\\/${tblName}>`, "u").exec(frameXml)?.[0];
  if (!tbl) {
    return null;
  }
  const trName = tagName(ns.a, "tr");
  const tcName = tagName(ns.a, "tc");
  const rows = tbl.match(new RegExp(`<${trName}[\\s\\S]*?<\\/${trName}>`, "gu")) ?? [];
  const rowHtml: string[] = [];
  const rowText: string[] = [];
  for (const row of rows) {
    const cells = row.match(new RegExp(`<${tcName}[\\s\\S]*?<\\/${tcName}>`, "gu")) ?? [];
    const cellTexts = cells.map((cell) =>
      shapeParagraphs(cell, ns)
        .map((p) => p.text)
        .join(" ")
        .trim(),
    );
    if (cellTexts.length === 0) {
      continue;
    }
    rowHtml.push(`<tr>${cellTexts.map((ct) => `<td>${escapeHtml(ct)}</td>`).join("")}</tr>`);
    rowText.push(cellTexts.join(" | "));
  }
  if (rowHtml.length === 0) {
    return null;
  }
  return { html: `<table>${rowHtml.join("")}</table>`, text: rowText.join("\n") };
}

// Aufeinanderfolgende Listen-Absätze gleicher Art zu einer <ul>/<ol> bündeln, sonst <p>; Tabellen inline.
function renderBodyItems(items: readonly BodyItem[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (!item) {
      i += 1;
      continue;
    }
    if (item.kind === "table" || item.kind === "image") {
      parts.push(item.html);
      i += 1;
      continue;
    }
    if (item.list !== "none") {
      const listKind = item.list;
      const lis: string[] = [];
      while (i < items.length) {
        const next = items[i];
        if (!next || next.kind !== "para" || next.list !== listKind) {
          break;
        }
        lis.push(`<li>${escapeHtml(next.text)}</li>`);
        i += 1;
      }
      parts.push(`<${listKind}>${lis.join("")}</${listKind}>`);
    } else {
      parts.push(`<p>${escapeHtml(item.text)}</p>`);
      i += 1;
    }
  }
  return parts.join("");
}

// Eine Folie zu strukturerhaltendem HTML + Klartext. Titel-Platzhalter → h2 (sonst „<slideLabel> N"),
// restliche Textrahmen → Absätze/Listen, Tabellen (graphicFrame → a:tbl) → <table> — alles in
// Dokumentreihenfolge. Bilder werden nur gezählt (imageCount). Folien werden durch die führende h2 getrennt.
// BEWUSSTE GRENZE: verschachtelte Gruppen (p:grpSp) werden nicht rekursiv aufgelöst (Best-Effort).
export function slideToHtml(
  slideXml: string,
  opts: {
    slideNumber: number;
    slideLabel: string;
    // WP-D9: Bild-Auflösung rId → {src (data-URL), id (kw-img-<runToken>-N)} oder null (Format/Budget/
    // fehlendes Ziel → ehrlicher Teilverlust, zählt der Aufrufer). Ohne resolveImage/imageCaption bleibt
    // das Alt-Verhalten (Bilder nur gezählt) — Rückwärtskompatibilität für alle bestehenden Aufrufer.
    resolveImage?: ((rId: string) => { src: string; id: string } | null) | undefined;
    imageCaption?: string | undefined;
  },
): { html: string; text: string; imageCount: number; tableCount: number } {
  const ns = drawingNs(slideXml);
  let title = "";
  const items: BodyItem[] = [];
  let tableCount = 0;
  // Top-level Formen/Rahmen in Dokumentreihenfolge (sp = Text, graphicFrame = Tabelle, WP-D9: pic =
  // Bild). Die drei verschachteln sich NICHT ineinander → das erste passende Schluss-Tag beendet den
  // Block (kein Rückverweis nötig, der mit namespace-Alternation ohnehin nicht ginge). Gruppe 1 =
  // getroffener Tag-Name (z. B. p:sp / graphicFrame / p:pic), um die Block-Arten zu unterscheiden.
  const spName = tagName(ns.p, "sp");
  const gfName = tagName(ns.p, "graphicFrame");
  const picName = tagName(ns.p, "pic");
  const blockRe = new RegExp(
    `<(${spName}|${gfName}|${picName})[^>]*>[\\s\\S]*?<\\/(?:${spName}|${gfName}|${picName})>`,
    "gu",
  );
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = blockRe.exec(slideXml)) !== null) {
    const block = m[0];
    const elementName = m[1] ?? "";
    if (/graphicFrame/.test(elementName)) {
      const table = tableFromGraphicFrame(block, ns);
      if (table) {
        items.push({ kind: "table", html: table.html, text: table.text });
        tableCount += 1;
      }
      continue;
    }
    // WP-D9: Bild-Block an seiner Position im Folien-Fluss (nicht alle am Ende).
    if (/(?:^|:)pic$/u.test(elementName)) {
      if (opts.resolveImage && opts.imageCaption !== undefined) {
        const rid = blipEmbedRid(block, ns);
        const resolved = rid ? opts.resolveImage(rid) : null;
        if (resolved) {
          items.push({
            kind: "image",
            html: imageFigureHtml(resolved.src, resolved.id, opts.imageCaption),
          });
        }
      }
      continue;
    }
    const paras = shapeParagraphs(block, ns);
    if (paras.length === 0) {
      continue;
    }
    if (shapeIsTitle(block, ns) && title.length === 0) {
      title = paras
        .map((p) => p.text)
        .join(" ")
        .trim();
    } else {
      for (const para of paras) {
        items.push({ kind: "para", text: para.text, list: para.list });
      }
    }
  }
  const heading = title.length > 0 ? title : `${opts.slideLabel} ${opts.slideNumber}`;
  const html = `<h2>${escapeHtml(heading)}</h2>${renderBodyItems(items)}`;
  const imageCount = (slideXml.match(new RegExp(`<${tagName(ns.a, "blip")}`, "gu")) ?? []).length;

  // Klartext trägt NUR echten Inhalt (echter Titel + Textrahmen/Tabellen), NICHT die „Folie N"-Struktur-
  // Überschrift — sonst zählte eine reine Grafik-Folie fälschlich als „Text vorhanden".
  const textLines: string[] = title.length > 0 ? [title] : [];
  for (const item of items) {
    if (item.kind === "image") {
      // WP-D9: Bilder tragen KEINEN Klartext bei (der Platzhalter ist keine echte Aussage).
      continue;
    }
    if (item.kind === "table") {
      if (item.text.length > 0) {
        textLines.push(item.text);
      }
    } else {
      textLines.push(item.list !== "none" ? `- ${item.text}` : item.text);
    }
  }
  return { html, text: textLines.join("\n"), imageCount, tableCount };
}

function decodeXml(bytes: Uint8Array | undefined): string {
  if (!bytes) {
    return "";
  }
  return new TextDecoder("utf-8").decode(bytes);
}

// Wert eines Attributs aus einem Element-Tag, unabhängig von Quote-Art (einfach/doppelt) und Position.
function attributeValue(elementTag: string, name: string): string | null {
  const m = new RegExp(`\\b${reEscape(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(elementTag);
  if (!m) {
    return null;
  }
  return m[1] ?? m[2] ?? null;
}

function slideNumber(path: string): number {
  return Number.parseInt(/slide(\d+)\.xml$/.exec(path)?.[1] ?? "0", 10);
}

// WP-D5c/WP-D5d/WP-D9: EIN zentraler Relationship-Scanner für ALLE .rels-Dateien (presentation.xml.rels
// UND Folien-Rels): <Relationship Id=… Target=…> — Reihenfolge/Quote-egal; der Elementscanner läuft über
// die zentrale Namespace-Auflösung (Package-Relationships-URI → alle Präfixe, Unicode-NCName-tauglich);
// fehlt die Deklaration, greift der präfix-tolerante Fallback von tagName. KEINE ad-hoc-Regexe daneben.
function relationshipTargets(relsXml: string): Map<string, string> {
  const relMap = new Map<string, string>();
  if (relsXml.length === 0) {
    return relMap;
  }
  const relNs = collectNamespacePrefixSets(relsXml);
  const relName = tagName(relNs.get(NS_PACKAGE_RELS), "Relationship");
  const relRe = new RegExp(`<${relName}[^>]*>`, "gu");
  let rb: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((rb = relRe.exec(relsXml)) !== null) {
    const id = attributeValue(rb[0], "Id");
    const target = attributeValue(rb[0], "Target");
    if (id && target) {
      relMap.set(id, target);
    }
  }
  return relMap;
}

// WP-D9: Media-Target aus Folien-Rels (relativ zu ppt/slides/, typisch "../media/image1.png") auf den
// ZIP-Pfad normalisieren.
function normalizeMediaPath(target: string): string {
  const clean = target.replace(/^\.\//, "").replace(/^\/+/, "");
  if (clean.startsWith("../")) {
    return `ppt/${clean.slice(3)}`;
  }
  return clean.startsWith("ppt/") ? clean : `ppt/slides/${clean}`;
}

// Pfad der Folien-Rels-Datei zu einer Folie (ppt/slides/slideN.xml → ppt/slides/_rels/slideN.xml.rels).
function slideRelsPath(slidePath: string): string {
  return slidePath.replace(/^ppt\/slides\//, "ppt/slides/_rels/").concat(".rels");
}

function normalizeSlidePath(target: string): string {
  const clean = target.replace(/^\.\//, "").replace(/^\/+/, "");
  return clean.startsWith("ppt/") ? clean : `ppt/${clean}`;
}

// WP-D5b (bens ROT-Fix 1): Slide-Reihenfolge namespace-aware und OHNE stillen Folienverlust.
// Bevorzugt ppt/presentation.xml (p:sldId/r:id) + rels (rId → Ziel); Relationship-Parsing unabhängig von
// Attribut-Reihenfolge und Quote-Art, optionales Element-Präfix. NICHT aufgelöste Folien (partielle rels)
// werden NICHT verschluckt, sondern deterministisch (numerisch) angehängt — es verschwindet nie eine Folie.
// Fehlt presentation.xml/rels ganz, greift die vollständige numerische Reihenfolge.
export function resolveSlideOrder(files: Record<string, Uint8Array>): string[] {
  const slidePaths = Object.keys(files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
  const numericAll = (): string[] =>
    [...slidePaths].sort((a, b) => slideNumber(a) - slideNumber(b));

  const presentation = decodeXml(files["ppt/presentation.xml"]);
  const rels = decodeXml(files["ppt/_rels/presentation.xml.rels"]);
  if (presentation.length === 0 || rels.length === 0) {
    return numericAll();
  }

  const relMap = relationshipTargets(rels);

  // WP-D5c: namespace-aware über ALLE gebundenen Präfixe — mehrere presentationml-/relationship-Präfixe
  // (auch pro sldId unterschiedlich) lösen so alle auf; die Reihenfolge der sldIdLst bleibt erhalten.
  const map = collectNamespacePrefixSets(presentation);
  const sldIdName = tagName(map.get(NS_PRESENTATIONML), "sldId");
  const ridAttr = attrName(map.get(NS_OFFICE_RELS), "id");
  const ordered: string[] = [];
  const seen = new Set<string>();
  // \s (nicht \b) vor dem Attribut — \b ist ASCII-Wortgrenze und würde vor einem Unicode-Präfix versagen;
  // ein Whitespace vor dem Attributnamen trennt zuverlässig (und verhindert Teiltreffer wie „xr:id").
  const idRe = new RegExp(`<${sldIdName}[^>]*\\s${ridAttr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "gu");
  let im: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((im = idRe.exec(presentation)) !== null) {
    const rid = im[1] ?? im[2] ?? "";
    const target = relMap.get(rid);
    if (!target) {
      continue;
    }
    const path = normalizeSlidePath(target);
    if (files[path] && !seen.has(path)) {
      ordered.push(path);
      seen.add(path);
    }
  }

  // ROT-FIX: partielle Auflösung darf keine Folie schlucken — Rest deterministisch numerisch anhängen.
  const missing = slidePaths
    .filter((p) => !seen.has(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  const all = [...ordered, ...missing];
  return all.length > 0 ? all : numericAll();
}

// WP-D5b (GELB-Fix 3): Backstop-Budget für die dem Kern übergebene Eintragsmenge — kontrollierter,
// ehrlicher Abbruch statt UI-Freeze/OOM, falls die (im Browser bereits selektiv gefilterte) Menge doch
// zu groß ist. Rein & testbar (der Test injiziert ein überdimensioniertes unzip-Ergebnis).
export function assertArchiveWithinBudget(
  files: Record<string, Uint8Array>,
  limits: { maxEntries?: number | undefined; maxTotalBytes?: number | undefined } = {},
): void {
  const maxEntries = limits.maxEntries ?? PPTX_MAX_ENTRIES;
  const maxTotalBytes = limits.maxTotalBytes ?? PPTX_MAX_TOTAL_DECOMPRESSED_BYTES;
  const names = Object.keys(files);
  if (names.length > maxEntries) {
    throw new PptxTooLargeError("too-many-entries");
  }
  let total = 0;
  for (const name of names) {
    total += files[name]?.byteLength ?? 0;
    if (total > maxTotalBytes) {
      throw new PptxTooLargeError("archive-too-large");
    }
  }
}

// WP-D5c/WP-D5d (bens ROT-Fix 2): ZIP-Eintrags-Metadaten. size/originalSize sind DEKLARIERTE Angaben des
// Archivs — bei Streaming-Entpacken können sie fehlen (undefined). Sie dienen nur als billiger Vorfilter;
// die harte Garantie ist die Ist-Byte-Zählung (addOutputBytes).
export interface PptxZipEntryMeta {
  name: string;
  compressedSize?: number | undefined;
  originalSize?: number | undefined;
}

export interface PptxUnzipBudgetLimits {
  maxArchiveEntries?: number;
  maxSlideEntries?: number;
  maxTotalDecompressedBytes?: number;
  maxEntryExpansionRatio?: number;
}

// undefined = unbekannt (Streaming, keine Metadaten) → NICHT fail-closed; bad = vorhanden aber korrupt
// (NaN/negativ) → fail-closed; sonst die Zahl.
function sizeState(v: number | undefined): "unknown" | "bad" | number {
  if (v === undefined) {
    return "unknown";
  }
  if (!Number.isFinite(v) || v < 0) {
    return "bad";
  }
  return v;
}

// WP-D5c/WP-D5d (bens ROT-Fix 2): zustandsbehaftetes Budget. `accept` läuft je Eintrag VOR der
// Dekompression (Name-Caps + billige DEKLARIERTE-Größen-Sanity); `addOutputBytes` zählt die ECHTEN
// dekomprimierten Bytes während des Streamings und bricht ab, sobald das Budget (pro Eintrag ODER
// kumuliert) fällt — damit ist eine MANIPULIERTE originalSize egal, die reale Arbeit ist gedeckelt.
// Durchgesetzt:
//  - JEDER gesehene Eintrag zählt gegen den Archiv-Iterations-Cap;
//  - nur benötigte Einträge (PPTX_NEEDED_ENTRY_RE) werden akzeptiert;
//  - FAIL-CLOSED bei WIDERSPRÜCHLICHEN deklarierten Größen: NaN/negativ, oder Null-Denominator
//    (originalSize>0 aber compressedSize<=0) → inkonsistente Metadaten; FEHLENDE Größen (Streaming) sind
//    KEIN Fehler, weil die Ist-Byte-Zählung greift;
//  - Expansionsratio-Prüfung für jeden nichtleeren Eintrag mit bekannten Größen;
//  - deklariertes Vorab-Budget als Vorfilter; die harte Grenze ist addOutputBytes;
//  - harter Cap auf akzeptierte slideN.xml-Einträge.
export function createPptxUnzipBudget(limits: PptxUnzipBudgetLimits = {}): {
  accept(entry: PptxZipEntryMeta): boolean;
  beginEntry(): void;
  addOutputBytes(n: number): void;
  stats(): { seen: number; acceptedSlides: number; totalOriginal: number; totalReal: number };
} {
  const maxArchiveEntries = limits.maxArchiveEntries ?? PPTX_MAX_ARCHIVE_ENTRIES;
  const maxSlideEntries = limits.maxSlideEntries ?? PPTX_MAX_SLIDE_ENTRIES;
  const maxTotalBytes = limits.maxTotalDecompressedBytes ?? PPTX_MAX_TOTAL_DECOMPRESSED_BYTES;
  const maxRatio = limits.maxEntryExpansionRatio ?? PPTX_MAX_ENTRY_EXPANSION_RATIO;
  let seen = 0;
  let acceptedSlides = 0;
  let totalOriginal = 0;
  let totalReal = 0;
  let realEntry = 0;
  return {
    accept(entry: PptxZipEntryMeta): boolean {
      seen += 1;
      if (seen > maxArchiveEntries) {
        throw new PptxTooLargeError("too-many-entries");
      }
      if (!PPTX_NEEDED_ENTRY_RE.test(entry.name)) {
        return false;
      }
      const cs = sizeState(entry.compressedSize);
      const os = sizeState(entry.originalSize);
      // Korrupte deklarierte Größe (vorhanden aber NaN/negativ) → fail-closed.
      if (cs === "bad" || os === "bad") {
        throw new PptxTooLargeError("archive-too-large");
      }
      // Null-Denominator / inkonsistente Metadaten: originalSize>0 aber compressedSize<=0.
      if (typeof os === "number" && os > 0 && typeof cs === "number" && cs <= 0) {
        throw new PptxTooLargeError("archive-too-large");
      }
      // Ratio nur bei bekannten Größen und compressed>0 (billiger Vorfilter).
      if (typeof cs === "number" && typeof os === "number" && cs > 0 && os / cs > maxRatio) {
        throw new PptxTooLargeError("expansion-ratio");
      }
      if (typeof os === "number") {
        totalOriginal += os;
        if (totalOriginal > maxTotalBytes) {
          throw new PptxTooLargeError("archive-too-large");
        }
      }
      if (PPTX_SLIDE_ENTRY_RE.test(entry.name)) {
        acceptedSlides += 1;
        if (acceptedSlides > maxSlideEntries) {
          throw new PptxTooLargeError("too-many-entries");
        }
      }
      return true;
    },
    beginEntry(): void {
      realEntry = 0;
    },
    addOutputBytes(n: number): void {
      realEntry += n;
      totalReal += n;
      // Ist-Byte-Garantie: pro Eintrag UND kumuliert — unabhängig von der deklarierten Größe.
      if (realEntry > maxTotalBytes || totalReal > maxTotalBytes) {
        throw new PptxTooLargeError("archive-too-large");
      }
    },
    stats() {
      return { seen, acceptedSlides, totalOriginal, totalReal };
    },
  };
}

// WP-D5d (bens ROT-Fix 2): schmaler fflate-STREAMING-Vertrag (nur das Genutzte). Der Handler bekommt je
// Datei einen Stream; `start()` beginnt die Dekompression, `ondata` liefert die ECHTEN Chunks, `terminate`
// bricht ab. Die deklarierte originalSize ist damit irrelevant — gezählt werden die tatsächlichen Bytes.
export interface FflateUnzipFileStream {
  name: string;
  size?: number;
  originalSize?: number;
  compression: number;
  ondata: (err: Error | null, data: Uint8Array, final: boolean) => void;
  start(): void;
  terminate: () => void;
}
export interface FflateStreamingUnzip {
  onfile: (file: FflateUnzipFileStream) => void;
  register(decoder: unknown): void;
  push(chunk: Uint8Array, final?: boolean): void;
}
export interface FflateStreaming {
  Unzip: new () => FflateStreamingUnzip;
  UnzipInflate: unknown;
  UnzipPassThrough?: unknown; // für STORE-Einträge (Methode 0); PPTX-XML ist i. d. R. deflate.
}

// 16 KiB komprimiert je push — fflate dekomprimiert inkrementell, sodass die reale Ausgabe je Schritt
// gedeckelt ist. WP-D5e (bens GELB-Auflage, ehrliche Abbruchsemantik): terminate()/das failure-Flag
// unterbrechen NICHT die synchrone Dekompression des GERADE laufenden push(); der Abbruch wirkt erst ab dem
// NÄCHSTEN push. Die Restarbeit eines laufenden Pushs ist durch diese Chunk-Größe (16 KiB komprimiert)
// begrenzt; zusätzlich verwirft der ondata-Callback nach erkanntem failure den bisherigen Puffer und
// konkateniert nicht weiter.
const PPTX_STREAM_CHUNK_BYTES = 1 << 14;

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0] ?? new Uint8Array(0);
  }
  let len = 0;
  for (const c of chunks) {
    len += c.length;
  }
  const out = new Uint8Array(len);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// WP-D5d (bens ROT-Fix 2): budgetierter, selektiver STREAMING-Entpacker über ECHTES fflate (injiziert →
// testbar mit fflate.zipSync-Fixtures). Der Name-Filter läuft VOR der Dekompression (unbenötigte Einträge
// werden gar nicht erst gestartet); für akzeptierte Einträge zählt der ondata-Callback die ECHTEN Bytes
// und bricht bei Budgetüberschreitung sofort ab (Stream terminieren). Eine untertriebene/lügende
// originalSize ändert daran nichts — die Ist-Arbeit ist gedeckelt.
export function budgetedPptxUnzip(
  fflate: FflateStreaming,
  limits?: PptxUnzipBudgetLimits,
): PptxUnzip {
  return (data) => {
    const files: Record<string, Uint8Array> = {};
    const budget = createPptxUnzipBudget(limits);
    let failure: unknown = null;
    const uz = new fflate.Unzip();
    uz.register(fflate.UnzipInflate);
    if (fflate.UnzipPassThrough) {
      uz.register(fflate.UnzipPassThrough);
    }
    uz.onfile = (file) => {
      if (failure) {
        return;
      }
      let accepted = false;
      try {
        accepted = budget.accept({
          name: file.name,
          compressedSize: file.size,
          originalSize: file.originalSize,
        });
      } catch (e) {
        failure = e;
        return;
      }
      if (!accepted) {
        return; // nicht benötigt → start() NICHT aufrufen → keine Dekompression
      }
      const chunks: Uint8Array[] = [];
      budget.beginEntry();
      file.ondata = (err, chunk, final) => {
        // WP-D5e (GELB): failure kann während EINES laufenden Pushs mehrfach ondata auslösen. Nach erkanntem
        // failure den bisherigen Puffer verwerfen und NICHT weiter konkatenieren → Restarbeit minimiert.
        if (failure) {
          chunks.length = 0;
          return;
        }
        if (err) {
          failure = err;
          chunks.length = 0;
          return;
        }
        try {
          budget.addOutputBytes(chunk.length);
        } catch (e) {
          failure = e;
          chunks.length = 0;
          try {
            file.terminate();
          } catch {
            // terminate ist best-effort; der Abbruch erfolgt ohnehin über das failure-Flag.
          }
          return;
        }
        chunks.push(chunk);
        if (final) {
          files[file.name] = concatChunks(chunks);
        }
      };
      try {
        file.start();
      } catch (e) {
        failure = e;
      }
    };
    try {
      for (let off = 0; off < data.length && !failure; off += PPTX_STREAM_CHUNK_BYTES) {
        const end = Math.min(off + PPTX_STREAM_CHUNK_BYTES, data.length);
        uz.push(data.subarray(off, end), end >= data.length);
      }
    } catch (e) {
      // Ein fflate-interner Fehler (z. B. Größen-/CRC-Mismatch eines manipulierten Archivs) wird ebenso
      // als kontrollierter Importfehler behandelt — nie als unkontrollierter Absturz durchgereicht.
      failure = failure ?? e;
    }
    if (failure) {
      throw failure instanceof PptxTooLargeError
        ? failure
        : new PptxTooLargeError("archive-too-large");
    }
    return files;
  };
}

// WP-D5/WP-D9: strukturerhaltende PPTX-Extraktion (HTML + Klartext) in EINEM Durchgang. Mit
// imageCaptionPlaceholder werden Bilder als <figure> mit Fußnote eingebettet (DOCX-Vertrag, BILD-1a/1b);
// ohne bleibt das Alt-Verhalten (nur gezählt). Teilverluste (Format/Bild-Budget) werden ehrlich beziffert.
export async function extractPptxRich(
  buffer: ArrayBuffer,
  opts: {
    unzip: PptxUnzip;
    maxSlides?: number;
    slideLabel?: string;
    budgetBytes?: number;
    maxEntries?: number;
    maxTotalBytes?: number;
    // WP-D9: gesetzt → Bilder als figure/figcaption mit diesem (lokalisierten) Platzhalter einbetten.
    imageCaptionPlaceholder?: string;
    // WP-D9: festes Import-Token nur für deterministische Tests; sonst frisch je Lauf (BILD-1b).
    imageRunToken?: string;
    maxImageBytes?: number;
    maxTotalImageBytes?: number;
  },
): Promise<PptxRichResult> {
  const maxSlides = opts.maxSlides ?? MAX_PPTX_SLIDES;
  const budgetBytes = opts.budgetBytes ?? MAX_INLINE_BODY_HTML_BYTES;
  const slideLabel = opts.slideLabel ?? "Folie";
  const files = opts.unzip(new Uint8Array(buffer));
  // GELB-Fix 3: Backstop-Budget prüfen, BEVOR wir die Folien-XMLs verarbeiten.
  assertArchiveWithinBudget(files, {
    maxEntries: opts.maxEntries,
    maxTotalBytes: opts.maxTotalBytes,
  });
  const order = resolveSlideOrder(files);
  const readCount = Math.min(order.length, maxSlides);

  // WP-D9: Bild-Einbettung — ein runToken je Import-Lauf (bodyweit kollisionsfeste IDs, BILD-1b), die
  // Nummerierung läuft fortlaufend über ALLE Folien in Dokumentreihenfolge.
  const wantImages = opts.imageCaptionPlaceholder !== undefined;
  const runToken = opts.imageRunToken ?? newImageRunToken();
  const maxImageBytes = opts.maxImageBytes ?? PPTX_MAX_IMAGE_BYTES;
  const maxTotalImageBytes = opts.maxTotalImageBytes ?? PPTX_MAX_TOTAL_IMAGE_BYTES;
  let embeddedImages = 0;
  let droppedImageFormat = 0;
  let droppedImageBudget = 0;
  let totalImageBytes = 0;

  const htmlParts: string[] = [];
  const textParts: string[] = [];
  let imageCount = 0;
  let tableCount = 0;
  for (let i = 0; i < readCount; i += 1) {
    const path = order[i];
    if (!path) {
      continue;
    }
    const xml = decodeXml(files[path]);
    // WP-D9: Bild-Auflösung je Folie über die Folien-Rels (rId → ../media/*). Fehlendes Ziel/fehlende
    // Bytes → null ohne Zähler (pathologisches Archiv; bleibt in der imageCount-Gesamtbilanz sichtbar).
    const relMap = wantImages ? relationshipTargets(decodeXml(files[slideRelsPath(path)])) : null;
    const resolveImage = wantImages
      ? (rId: string): { src: string; id: string } | null => {
          const target = relMap?.get(rId);
          if (!target) {
            return null;
          }
          const bytes = files[normalizeMediaPath(target)];
          if (!bytes) {
            return null;
          }
          const ext = /\.([a-z0-9]+)$/i.exec(target)?.[1]?.toLowerCase() ?? "";
          const mime = PPTX_IMAGE_MIME[ext];
          if (!mime) {
            droppedImageFormat += 1;
            return null;
          }
          // TEILVERLUST-Semantik (s. Konstanten): Bild-Budget gerissen → Bild weglassen, Import läuft.
          if (
            bytes.byteLength > maxImageBytes ||
            totalImageBytes + bytes.byteLength > maxTotalImageBytes
          ) {
            droppedImageBudget += 1;
            return null;
          }
          totalImageBytes += bytes.byteLength;
          embeddedImages += 1;
          return {
            src: `data:${mime};base64,${bytesToBase64(bytes)}`,
            id: `${IMAGE_ID_PREFIX}${runToken}-${embeddedImages}`,
          };
        }
      : undefined;
    const slide = slideToHtml(xml, {
      slideNumber: i + 1,
      slideLabel,
      resolveImage,
      imageCaption: opts.imageCaptionPlaceholder,
    });
    imageCount += slide.imageCount;
    tableCount += slide.tableCount;
    htmlParts.push(slide.html);
    if (slide.text.trim().length > 0) {
      textParts.push(slide.text);
    }
  }
  const html = htmlParts.join("");
  return {
    html,
    text: textParts.join("\n\n").trim(),
    slideCount: readCount,
    truncated: order.length > readCount,
    imageCount,
    tableCount,
    // Folien-HTML (inkl. eingebetteter figures): übersteigt es das Budget, meldet es der Aufrufer ehrlich
    // (wie DOCX htmlOverflow) und bricht VOR dem Upload ab; der finale JSON-Guard bleibt zusätzlich.
    htmlOverflow: utf8ByteLength(html) > budgetBytes,
    embeddedImages,
    droppedImageFormat,
    droppedImageBudget,
  };
}
