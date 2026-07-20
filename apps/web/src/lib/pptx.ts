// DOM-freier PowerPoint-Kern (WP-D5 / WP-D5b). Bewusst OHNE File/Image/document/FileReader — im Node-/
// Root-Typecheck und in Tests mit kleinen XML-Fixtures prüfbar. Der Browser-Wrapper (fflate lazy,
// selektiv + budgetiert) liegt in `files.ts`. Spiegelt strikt die DOCX/PDF-Architektur (docx.ts/pdf.ts):
// reine Extraktion, injizierte Engine (hier: unzip), strukturerhaltendes bodyHtml + Klartext + Bilanz.
//
// Best-Effort & EHRLICH: .pptx ist ein ZIP mit ppt/slides/slideN.xml (Reihenfolge über
// ppt/presentation.xml + rels). Pro Folie: Titel-Platzhalter → h2, restliche Textrahmen → Absätze,
// a:buChar → <ul>, a:buAutoNum → <ol>, Tabellen (p:graphicFrame → a:tbl) Best-Effort → <table>. Folien
// werden durch die h2 sichtbar getrennt. BILDER werden in diesem Slice NICHT inline übernommen (nur
// gezählt) — das Original bleibt als Anhang heilig (WP-D2). Layout/Animationen/Übergänge/Notizen gehen
// verloren (im Verlusthinweis benannt).
//
// WP-D5b (bens ROT-Fix 1): NAMESPACE-AWARE. XML-Präfixe (a:/p:/r:) sind nicht fest — sie werden aus den
// xmlns-Deklarationen des Dokuments dynamisch aufgelöst (drawingml/presentationml/relationships-URI →
// tatsächliches Präfix). Fällt der Namespace nicht deklariert an, greift ein präfix-tolerantes Muster.
// Relationship-Parsing ist unabhängig von Attribut-Reihenfolge und Anführungszeichen-Art.

import { MAX_INLINE_BODY_HTML_BYTES, utf8ByteLength } from "./docx";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// Bekannte OOXML-Namespace-URIs. Elemente/Attribute werden über diese URIs (→ aktuelles Präfix)
// erkannt, NICHT über hartkodierte Präfix-Strings.
const NS_DRAWINGML = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_PRESENTATIONML = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_OFFICE_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

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

// WP-D5b (bens GELB-Fix 3): Archiv-/Dekompressionsbudget als Backstop gegen Zip-Bomben. Diese Caps
// gelten für die dem Kern übergebene (im Browser bereits selektiv gefilterte) Eintragsmenge; der
// eigentliche Datei-Größen-/Ratio-Schutz sitzt zusätzlich im Browser-Wrapper (files.ts). Bewusst
// großzügig, damit reale Decks durchlaufen, aber ein entarteter Fall kontrolliert abbricht.
export const PPTX_MAX_ENTRIES = 5000;
export const PPTX_MAX_TOTAL_DECOMPRESSED_BYTES = 300 * 1024 * 1024; // 300 MiB

// WP-D5b: ehrlicher, kontrollierter Importfehler (statt UI-Freeze / stiller Teilimport). Der Aufrufer
// (Capture) fängt ihn und zeigt eine spezifische DE/EN/NL-Meldung.
export type PptxImportErrorReason =
  | "file-too-large"
  | "archive-too-large"
  | "too-many-entries"
  | "expansion-ratio";

export class PptxTooLargeError extends Error {
  readonly reason: PptxImportErrorReason;
  constructor(reason: PptxImportErrorReason) {
    super(`PPTX_TOO_LARGE:${reason}`);
    this.name = "PptxTooLargeError";
    this.reason = reason;
  }
}

export interface PptxRichResult {
  html: string; // strukturerhaltendes HTML (h2 je Folie, Absätze, Listen, Tabellen)
  text: string; // Klartext — für die KI-Punkte-Extraktion
  slideCount: number; // tatsächlich gelesene Folien (bis zum Cap)
  truncated: boolean; // true, wenn das Deck mehr Folien hat als gelesen wurden
  imageCount: number; // gezählte eingebettete Bilder (NICHT inline übernommen — nur ehrlich beziffert)
  tableCount: number; // Best-Effort übernommene Tabellen (a:tbl → <table>)
  htmlOverflow: boolean; // true, wenn das reine Folien-HTML das Inline-Byte-Budget übersteigt
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

function reEscape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// WP-D5b: xmlns-Deklarationen des Dokuments einsammeln (URI → gebundenes Präfix; "" = Default-Namespace).
function collectNamespacePrefixes(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /\bxmlns(?::([\w.-]+))?\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(xml)) !== null) {
    const prefix = m[1] ?? "";
    const uri = m[2] ?? m[3] ?? "";
    if (uri.length > 0 && !map.has(uri)) {
      map.set(uri, prefix);
    }
  }
  return map;
}

// Regex-Fragment für ELEMENTE eines Namespace: exakt gebundenes Präfix ("a:" bzw. "" bei Default-NS);
// ist der Namespace gar nicht deklariert, ein präfix-tolerantes Muster (irgendein oder kein Präfix).
function elementPrefix(nsMap: Map<string, string>, uri: string): string {
  const prefix = nsMap.get(uri);
  if (prefix === undefined) {
    return "(?:[\\w.-]+:)?";
  }
  return prefix.length > 0 ? `${reEscape(prefix)}:` : "";
}

// Regex-Fragment für ein NAMESPACED ATTRIBUT (z. B. r:id): Attribute erben NIE das Default-Namespace,
// tragen also immer ein Präfix. Gebundenes Präfix bevorzugt; Fallback verlangt IRGENDEIN Präfix — nie
// das bare „id" (das im sldId sonst mit der numerischen Folien-Id kollidieren würde).
function attributePrefix(nsMap: Map<string, string>, uri: string): string {
  const prefix = nsMap.get(uri);
  if (prefix !== undefined && prefix.length > 0) {
    return `${reEscape(prefix)}:`;
  }
  return "[\\w.-]+:";
}

interface DrawingNs {
  a: string; // Element-Präfix-Fragment für drawingml
  p: string; // Element-Präfix-Fragment für presentationml
}

function drawingNs(xml: string): DrawingNs {
  const map = collectNamespacePrefixes(xml);
  return { a: elementPrefix(map, NS_DRAWINGML), p: elementPrefix(map, NS_PRESENTATIONML) };
}

type ListKind = "none" | "ul" | "ol";

interface SlidePara {
  text: string;
  list: ListKind;
}

type BodyItem =
  | { kind: "para"; text: string; list: ListKind }
  | { kind: "table"; html: string; text: string };

// WP-D5b (GELB-Fix 4): Text eines <a:p>-Absatzes. <a:t>-Runs werden zusammengefügt, <a:br/> wird als
// Leerzeichen behandelt (sonst verschmelzen „Hallo"<br>„Welt" zu „HalloWelt"). Reihenfolge-treu über
// EINE Token-Iteration (Runs UND Umbrüche).
function paragraphText(paragraphXml: string, ns: DrawingNs): string {
  const re = new RegExp(`<${ns.a}t\\b[^>]*>([\\s\\S]*?)<\\/${ns.a}t>|<${ns.a}br\\b[^>]*\\/?>`, "g");
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
  const pPr =
    new RegExp(`<${ns.a}pPr\\b[\\s\\S]*?(?:\\/>|<\\/${ns.a}pPr>)`).exec(paragraphXml)?.[0] ?? "";
  if (new RegExp(`<${ns.a}buNone\\b`).test(pPr)) {
    return "none";
  }
  if (new RegExp(`<${ns.a}buAutoNum\\b`).test(pPr)) {
    return "ol";
  }
  if (new RegExp(`<${ns.a}buChar\\b`).test(pPr)) {
    return "ul";
  }
  return "none";
}

function shapeParagraphs(shapeXml: string, ns: DrawingNs): SlidePara[] {
  const paras: SlidePara[] = [];
  const re = new RegExp(`<${ns.a}p\\b[^>]*>([\\s\\S]*?)<\\/${ns.a}p>|<${ns.a}p\\b[^>]*\\/>`, "g");
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
    `<${ns.p}ph\\b[^>]*\\btype\\s*=\\s*(?:"(?:title|ctrTitle)"|'(?:title|ctrTitle)')`,
  ).test(shapeXml);
}

// WP-D5b (GELB-Fix 4): Tabelle (a:tbl) Best-Effort → einfache <table> (Zeilen a:tr, Zellen a:tc). Der
// Server-Sanitizer erlaubt table/tr/td. Charts/Diagramme in anderen graphicFrames bleiben eine bewusste
// Grenze (kein Chart-Rendering) und werden über den Verlusthinweis kommuniziert.
function tableFromGraphicFrame(
  frameXml: string,
  ns: DrawingNs,
): { html: string; text: string } | null {
  const tbl = new RegExp(`<${ns.a}tbl\\b[\\s\\S]*?<\\/${ns.a}tbl>`).exec(frameXml)?.[0];
  if (!tbl) {
    return null;
  }
  const rows = tbl.match(new RegExp(`<${ns.a}tr\\b[\\s\\S]*?<\\/${ns.a}tr>`, "g")) ?? [];
  const rowHtml: string[] = [];
  const rowText: string[] = [];
  for (const row of rows) {
    const cells = row.match(new RegExp(`<${ns.a}tc\\b[\\s\\S]*?<\\/${ns.a}tc>`, "g")) ?? [];
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
    if (item.kind === "table") {
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
  opts: { slideNumber: number; slideLabel: string },
): { html: string; text: string; imageCount: number; tableCount: number } {
  const ns = drawingNs(slideXml);
  let title = "";
  const items: BodyItem[] = [];
  let tableCount = 0;
  // Top-level Formen/Rahmen in Dokumentreihenfolge (sp = Text, graphicFrame = Tabelle). Rückverweis \1
  // schließt dasselbe Element.
  const blockRe = new RegExp(`<${ns.p}(sp|graphicFrame)\\b[\\s\\S]*?<\\/${ns.p}\\1>`, "g");
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = blockRe.exec(slideXml)) !== null) {
    const block = m[0];
    const elementName = m[1];
    if (elementName === "graphicFrame") {
      const table = tableFromGraphicFrame(block, ns);
      if (table) {
        items.push({ kind: "table", html: table.html, text: table.text });
        tableCount += 1;
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
  const imageCount = (slideXml.match(new RegExp(`<${ns.a}blip\\b`, "g")) ?? []).length;

  // Klartext trägt NUR echten Inhalt (echter Titel + Textrahmen/Tabellen), NICHT die „Folie N"-Struktur-
  // Überschrift — sonst zählte eine reine Grafik-Folie fälschlich als „Text vorhanden".
  const textLines: string[] = title.length > 0 ? [title] : [];
  for (const item of items) {
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

  // rels: <Relationship Id=... Target=...> — Reihenfolge/Quote-egal, optionales Präfix, kein
  // unpräfixiertes-Element-Zwang.
  const relMap = new Map<string, string>();
  const relRe = /<(?:[\w.-]+:)?Relationship\b[^>]*>/g;
  let rb: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((rb = relRe.exec(rels)) !== null) {
    const id = attributeValue(rb[0], "Id");
    const target = attributeValue(rb[0], "Target");
    if (id && target) {
      relMap.set(id, target);
    }
  }

  const map = collectNamespacePrefixes(presentation);
  const pPrefix = elementPrefix(map, NS_PRESENTATIONML);
  const rPrefix = attributePrefix(map, NS_OFFICE_RELS);
  const ordered: string[] = [];
  const seen = new Set<string>();
  const idRe = new RegExp(
    `<${pPrefix}sldId\\b[^>]*\\b${rPrefix}id\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "g",
  );
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

// WP-D5: strukturerhaltende PPTX-Extraktion (HTML + Klartext) in EINEM Durchgang. Bilder werden NICHT
// inline übernommen (nur gezählt); der Aufrufer meldet den Verlust ehrlich und hängt das Original an.
export async function extractPptxRich(
  buffer: ArrayBuffer,
  opts: {
    unzip: PptxUnzip;
    maxSlides?: number;
    slideLabel?: string;
    budgetBytes?: number;
    maxEntries?: number;
    maxTotalBytes?: number;
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
    const slide = slideToHtml(xml, { slideNumber: i + 1, slideLabel });
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
    // Reines Text/Struktur-HTML: übersteigt es das Budget, meldet es der Aufrufer ehrlich (wie DOCX
    // htmlOverflow) und bricht VOR dem Upload ab; der finale JSON-Guard bleibt zusätzlich.
    htmlOverflow: utf8ByteLength(html) > budgetBytes,
  };
}
