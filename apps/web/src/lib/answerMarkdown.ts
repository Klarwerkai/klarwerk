// WP-UX-WOW-1 U1 (Kopfs Live-Befund, P1): Modell-Antworten kommen als Markdown („## Antwort",
// „**fett**", Listen) — die Konsole zeigte die Zeichen roh. Dieser kleine, DOM-freie Parser zerlegt
// die Antwort in ein STRIKTES Subset von Segmenten (Überschrift h3/h4, Absatz, Liste; inline fett/
// kursiv). ALLES andere bleibt reiner Text: gerendert wird ausschließlich über React-Elemente
// (AnswerMarkdown.tsx) — kein dangerouslySetInnerHTML, kein neuer HTML-Sink; Script/HTML im
// Antworttext bleibt automatisch escaped, weil es nie als HTML interpretiert wird.
// Kopieren/Export bleiben unberührt — sie nutzen weiter den ROHEN Antworttext.

export interface AnswerInlinePart {
  kind: "text" | "bold" | "italic";
  text: string;
}

export type AnswerSegment =
  | { kind: "heading"; level: 3 | 4; parts: AnswerInlinePart[] }
  | { kind: "paragraph"; parts: AnswerInlinePart[] }
  | { kind: "list"; ordered: boolean; items: AnswerInlinePart[][] };

// Inline-Subset: **fett** und *kursiv* (nicht verschachtelt — konservativ; ein unpaariger Marker
// bleibt wörtlicher Text). Mehr Markdown (Links, Code, Bilder) wird BEWUSST nicht interpretiert.
const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;

export function parseAnswerInline(text: string): AnswerInlinePart[] {
  const parts: AnswerInlinePart[] = [];
  let last = 0;
  let m: RegExpExecArray | null = INLINE_RE.exec(text);
  while (m !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", text: text.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      parts.push({ kind: "bold", text: m[1] });
    } else if (m[2] !== undefined) {
      parts.push({ kind: "italic", text: m[2] });
    }
    last = INLINE_RE.lastIndex;
    m = INLINE_RE.exec(text);
  }
  if (last < text.length) {
    parts.push({ kind: "text", text: text.slice(last) });
  }
  return parts;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_ITEM_RE = /^[-*]\s+(.*)$/;
const OL_ITEM_RE = /^\d+[.)]\s+(.*)$/;

// Zeilenbasierter Block-Parser: Überschriften (#/## → h3, tiefer → h4 — die Antwort ist in eine
// Karte eingebettet, h1/h2 wären typografisch falsch), Listen (-/*/1.), Leerzeile = Absatzgrenze.
export function parseAnswerMarkdown(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: AnswerInlinePart[][] } | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      segments.push({ kind: "paragraph", parts: parseAnswerInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list !== null && list.items.length > 0) {
      segments.push({ kind: "list", ordered: list.ordered, items: list.items });
    }
    list = null;
  };

  for (const rawLine of answer.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      flushParagraph();
      flushList();
      const level: 3 | 4 = heading[1].length <= 2 ? 3 : 4;
      const text = heading[2].trim();
      if (text.length > 0) {
        segments.push({ kind: "heading", level, parts: parseAnswerInline(text) });
      }
      continue;
    }
    const ul = UL_ITEM_RE.exec(line);
    const ol = ul ? null : OL_ITEM_RE.exec(line);
    const item = ul?.[1] ?? ol?.[1];
    if (item !== undefined) {
      flushParagraph();
      const ordered = ol !== null;
      if (list === null || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(parseAnswerInline(item));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return segments;
}

// U1 (Word-Taskpane): dort wird KLARTEXT angezeigt/eingefügt — dieselbe Subset-Logik als STRIP:
// Markdown-Zeichen entfernen, Inhalt (inkl. Listenpunkte als eigene Zeilen) erhalten. Kein Rendern.
export function stripAnswerMarkdown(answer: string): string {
  const lines: string[] = [];
  for (const segment of parseAnswerMarkdown(answer)) {
    const flat = (parts: AnswerInlinePart[]): string => parts.map((p) => p.text).join("");
    if (segment.kind === "list") {
      segment.items.forEach((item, i) => {
        lines.push(segment.ordered ? `${i + 1}. ${flat(item)}` : `- ${flat(item)}`);
      });
    } else {
      lines.push(flat(segment.parts));
    }
  }
  return lines.join("\n");
}
