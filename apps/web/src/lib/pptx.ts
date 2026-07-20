// DOM-freier PowerPoint-Kern (WP-D5). Bewusst OHNE File/Image/document/FileReader — im Node-/Root-
// Typecheck und in Tests mit kleinen XML-Fixtures prüfbar. Der Browser-Wrapper (echtes fflate lazy,
// readFileAsDataUrl) liegt in `files.ts`. Spiegelt strikt die DOCX/PDF-Architektur (docx.ts / pdf.ts):
// reine Extraktion, injizierte Engine (hier: unzip), strukturerhaltendes bodyHtml + Klartext + Bilanz.
//
// Best-Effort & EHRLICH: .pptx ist ein ZIP mit ppt/slides/slideN.xml (Reihenfolge über
// ppt/presentation.xml + rels). Pro Folie: Titel-Platzhalter → h2, restliche Textrahmen → Absätze,
// Aufzählungen (a:buChar/a:buAutoNum) → Listen. Folien werden durch die h2 sichtbar getrennt. BILDER
// werden in diesem Slice NICHT inline übernommen (nur gezählt) — das Original bleibt als Anhang heilig
// (WP-D2), und der Verlusthinweis sagt das klar. Layout/Animationen/Übergänge/Notizen gehen verloren.

import { MAX_INLINE_BODY_HTML_BYTES, utf8ByteLength } from "./docx";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// DOM-freie Erkennung über Dateiname/MIME (ohne File-Objekt), Muster isDocxDocumentLike.
export function isPptxDocumentLike(input: { name: string; type?: string }): boolean {
  return input.type === PPTX_MIME || input.name.toLowerCase().endsWith(".pptx");
}

// Injizierter Entpack-Vertrag (Muster DocxEngine/PdfEngine): der Test nutzt einen Fake, der
// Browser-Wrapper lädt fflate.unzipSync lazy. Rückgabe: Pfad → Rohbytes.
export type PptxUnzip = (data: Uint8Array) => Record<string, Uint8Array>;

// WP-D5: Folien-Cap als Sicherheitsnetz gegen Riesen-Decks (analog MAX_PDF_PAGES). Über dem Cap wird
// der Rest NICHT still verschluckt, sondern ehrlich als `truncated` gemeldet.
export const MAX_PPTX_SLIDES = 300;

export interface PptxRichResult {
  html: string; // strukturerhaltendes HTML (h2 je Folie, Absätze, Listen)
  text: string; // Klartext — für die KI-Punkte-Extraktion
  slideCount: number; // tatsächlich gelesene Folien (bis zum Cap)
  truncated: boolean; // true, wenn das Deck mehr Folien hat als gelesen wurden
  imageCount: number; // gezählte eingebettete Bilder (NICHT inline übernommen — nur ehrlich beziffert)
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

interface SlidePara {
  text: string;
  bullet: boolean;
}

// Text eines <a:p>-Absatzes: alle <a:t>-Runs zusammenfügen, <a:br/> als Leerzeichen, XML entschärfen.
function paragraphText(paragraphXml: string): string {
  const runs: string[] = [];
  const re = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(paragraphXml)) !== null) {
    runs.push(unescapeXml(m[1] ?? ""));
  }
  return runs.join("").replace(/\s+/g, " ").trim();
}

// Ein Absatz ist eine Aufzählung, wenn seine Absatz-Eigenschaften einen Bullet setzen
// (a:buChar/a:buAutoNum) und ihn NICHT explizit abschalten (a:buNone).
function paragraphIsBullet(paragraphXml: string): boolean {
  const pPr = /<a:pPr\b[\s\S]*?(?:\/>|<\/a:pPr>)/.exec(paragraphXml)?.[0] ?? "";
  if (/<a:buNone\b/.test(pPr)) {
    return false;
  }
  return /<a:bu(?:Char|AutoNum)\b/.test(pPr);
}

function shapeParagraphs(shapeXml: string): SlidePara[] {
  const paras: SlidePara[] = [];
  const re = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>|<a:p\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(shapeXml)) !== null) {
    const inner = m[1] ?? "";
    const text = paragraphText(inner);
    if (text.length === 0) {
      continue;
    }
    paras.push({ text, bullet: paragraphIsBullet(inner) });
  }
  return paras;
}

function shapeIsTitle(shapeXml: string): boolean {
  return /<p:ph\b[^>]*\btype="(?:title|ctrTitle)"/.test(shapeXml);
}

// Aufeinanderfolgende Bullet-Absätze zu einer <ul> bündeln, sonstige als <p>.
function bodyHtmlFromParas(paras: readonly SlidePara[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < paras.length) {
    const para = paras[i];
    if (!para) {
      i += 1;
      continue;
    }
    if (para.bullet) {
      const items: string[] = [];
      while (i < paras.length && paras[i]?.bullet) {
        items.push(`<li>${escapeHtml(paras[i]?.text ?? "")}</li>`);
        i += 1;
      }
      parts.push(`<ul>${items.join("")}</ul>`);
    } else {
      parts.push(`<p>${escapeHtml(para.text)}</p>`);
      i += 1;
    }
  }
  return parts.join("");
}

// Eine Folie zu strukturerhaltendem HTML + Klartext. Titel-Platzhalter → h2 (sonst „<slideLabel> N"),
// restliche Textrahmen → Absätze/Listen. Folien werden durch die führende h2 sichtbar getrennt.
export function slideToHtml(
  slideXml: string,
  opts: { slideNumber: number; slideLabel: string },
): { html: string; text: string } {
  const shapes = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) ?? [];
  let title = "";
  const bodyParas: SlidePara[] = [];
  for (const shape of shapes) {
    const paras = shapeParagraphs(shape);
    if (paras.length === 0) {
      continue;
    }
    if (shapeIsTitle(shape) && title.length === 0) {
      title = paras
        .map((p) => p.text)
        .join(" ")
        .trim();
    } else {
      bodyParas.push(...paras);
    }
  }
  const heading = title.length > 0 ? title : `${opts.slideLabel} ${opts.slideNumber}`;
  const html = `<h2>${escapeHtml(heading)}</h2>${bodyHtmlFromParas(bodyParas)}`;
  // Klartext trägt NUR echten Inhalt (echter Titel + Textrahmen), NICHT die „Folie N"-Struktur-
  // Überschrift — sonst zählte eine reine Grafik-Folie fälschlich als „Text vorhanden".
  const textLines = [
    ...(title.length > 0 ? [title] : []),
    ...bodyParas.map((p) => (p.bullet ? `- ${p.text}` : p.text)),
  ];
  return { html, text: textLines.join("\n") };
}

function decodeXml(bytes: Uint8Array | undefined): string {
  if (!bytes) {
    return "";
  }
  return new TextDecoder("utf-8").decode(bytes);
}

// Slide-Reihenfolge: bevorzugt ppt/presentation.xml (sldId r:id) + rels (rId → slides/slideN.xml).
// Fällt auf numerische Sortierung der ppt/slides/slideN.xml zurück, wenn presentation.xml/rels fehlen
// oder keine Folien auflösen — deterministisch und in aller Regel deckungsgleich mit der Deck-Reihenfolge.
export function resolveSlideOrder(files: Record<string, Uint8Array>): string[] {
  const slidePaths = Object.keys(files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
  const numericFallback = (): string[] =>
    [...slidePaths].sort((a, b) => slideNumber(a) - slideNumber(b));

  const presentation = decodeXml(files["ppt/presentation.xml"]);
  const rels = decodeXml(files["ppt/_rels/presentation.xml.rels"]);
  if (presentation.length === 0 || rels.length === 0) {
    return numericFallback();
  }
  const relMap = new Map<string, string>();
  const relRe = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*>/g;
  let rm: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((rm = relRe.exec(rels)) !== null) {
    relMap.set(rm[1] ?? "", rm[2] ?? "");
  }
  const ordered: string[] = [];
  const idRe = /<p:sldId\b[^>]*\br:id="([^"]+)"/g;
  let im: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((im = idRe.exec(presentation)) !== null) {
    const target = relMap.get(im[1] ?? "");
    if (!target) {
      continue;
    }
    // Target ist relativ zu ppt/ (z. B. "slides/slide1.xml") — auf ZIP-Pfad normalisieren.
    const path = `ppt/${target.replace(/^\.\//, "").replace(/^\/+/, "")}`;
    if (files[path]) {
      ordered.push(path);
    }
  }
  return ordered.length > 0 ? ordered : numericFallback();
}

function slideNumber(path: string): number {
  return Number.parseInt(/slide(\d+)\.xml$/.exec(path)?.[1] ?? "0", 10);
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
  },
): Promise<PptxRichResult> {
  const maxSlides = opts.maxSlides ?? MAX_PPTX_SLIDES;
  const budgetBytes = opts.budgetBytes ?? MAX_INLINE_BODY_HTML_BYTES;
  const slideLabel = opts.slideLabel ?? "Folie";
  const files = opts.unzip(new Uint8Array(buffer));
  const order = resolveSlideOrder(files);
  const readCount = Math.min(order.length, maxSlides);

  const htmlParts: string[] = [];
  const textParts: string[] = [];
  let imageCount = 0;
  for (let i = 0; i < readCount; i += 1) {
    const path = order[i];
    if (!path) {
      continue;
    }
    const xml = decodeXml(files[path]);
    imageCount += (xml.match(/<a:blip\b/g) ?? []).length;
    const slide = slideToHtml(xml, { slideNumber: i + 1, slideLabel });
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
    // Reines Text/Struktur-HTML: übersteigt es das Budget, meldet es der Aufrufer ehrlich (wie DOCX
    // htmlOverflow) und bricht VOR dem Upload ab; der finale JSON-Guard bleibt zusätzlich.
    htmlOverflow: utf8ByteLength(html) > budgetBytes,
  };
}
