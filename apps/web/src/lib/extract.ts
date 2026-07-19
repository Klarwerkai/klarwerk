// DOM-freier Kern der Datei-Extraktion (SCRUM-122/123).
// Erkennung + Status-/Join-Logik OHNE File/Image/document — in Node testbar.
// Browser-Wrapper (echte Engines, lazy) liegt in `files.ts`.

export type FileKind = "text" | "docx" | "pdf" | "image" | "unsupported";

const TEXT_EXTS = [".txt", ".md", ".markdown", ".csv", ".log", ".json"];
const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Reihenfolge: image → pdf → docx → text → unsupported.
// Spiegelt die bestehende Erkennung (isTextDocument/isWordDocument), additiv um pdf erweitert.
export function detectFileKind(input: { name: string; type?: string }): FileKind {
  const name = input.name.toLowerCase();
  const type = input.type ?? "";
  if (type.startsWith("image/")) {
    return "image";
  }
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (type === WORD_MIME || name.endsWith(".docx")) {
    return "docx";
  }
  if (type.startsWith("text/") || TEXT_EXTS.some((e) => name.endsWith(e))) {
    return "text";
  }
  return "unsupported";
}

// Status der laufenden/abgeschlossenen Extraktion — für ehrliche UI-Anzeige.
export type ExtractionStatus = "idle" | "running" | "success" | "failed" | "unsupported";

// WP-D3 (PDF-Absatzrekonstruktion): ein positioniertes Text-Fragment einer PDF-Seite. x/y stammen aus
// pdfjs item.transform ([4]=x, [5]=y; Ursprung UNTEN links), height aus item.height. Rein & DOM-frei →
// in Node mit Fixtures testbar, kein pdfjs-Import hier.
export interface PdfPositionedItem {
  str?: string;
  x: number;
  y: number;
  height: number;
}

// Zwei Zeilen gelten als GLEICHE Zeile, wenn ihr Baseline-Abstand ≤ LINE_TOLERANCE_FACTOR × Zeilenhöhe
// ist; ein vertikaler Sprung > PARAGRAPH_GAP_FACTOR × Zeilenhöhe ist ein Absatzumbruch (Leerzeile).
const LINE_TOLERANCE_FACTOR = 0.5;
const PARAGRAPH_GAP_FACTOR = 1.5;

function medianHeight(items: readonly PdfPositionedItem[]): number {
  const heights = items
    .map((it) => it.height)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  if (heights.length === 0) {
    return 0;
  }
  return heights[Math.floor(heights.length / 2)] ?? 0;
}

// WP-D3: aus den positionierten Fragmenten EINER Seite zeilen-/absatztreuen Text rekonstruieren.
// Fragmente mit ähnlicher Y-Koordinate → eine Zeile (nach X sortiert), Zeilen nach Y absteigend
// (PDF-Ursprung unten links), größere Y-Sprünge → Leerzeile (Absatz). Ersetzt den alten Leerzeichen-
// Join, der Zeilen/Absätze/Spalten zerstörte. Rückgabe: Zeilen inkl. "" für Absatzgrenzen.
// Post-VIP: Mehrspalten-Erkennung (X-Lücke → erst linke, dann rechte Spalte). Bewusst NICHT geraten —
// ein 2-Spalten-PDF wird hier zeilenweise gemischt gelesen (nicht schlechter als der bisherige Salat);
// im Zweifel einspaltig ist besser als eine falsch geratene Spaltenreihenfolge.
export function reconstructPageLines(items: readonly PdfPositionedItem[]): string[] {
  const withText = items.filter((it) => (it.str ?? "").trim().length > 0);
  if (withText.length === 0) {
    return [];
  }
  const lineHeight = medianHeight(withText);
  const tolerance = lineHeight > 0 ? lineHeight * LINE_TOLERANCE_FACTOR : 0;
  // Nach Y absteigend (oben zuerst), bei ähnlicher Y nach X aufsteigend.
  const sorted = [...withText].sort((a, b) => b.y - a.y || a.x - b.x);
  const grouped: { y: number; items: PdfPositionedItem[] }[] = [];
  for (const item of sorted) {
    const current = grouped[grouped.length - 1];
    if (current && Math.abs(current.y - item.y) <= tolerance) {
      current.items.push(item);
    } else {
      grouped.push({ y: item.y, items: [item] });
    }
  }
  const lines: string[] = [];
  let prevY: number | null = null;
  for (const group of grouped) {
    const text = [...group.items]
      .sort((a, b) => a.x - b.x)
      .map((it) => it.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length === 0) {
      continue;
    }
    if (prevY !== null && lineHeight > 0 && prevY - group.y > lineHeight * PARAGRAPH_GAP_FACTOR) {
      lines.push(""); // Absatzumbruch (Leerzeile)
    }
    lines.push(text);
    prevY = group.y;
  }
  return lines;
}

// WP-D3: Seiten (jeweils rekonstruierte ZEILEN) zu einem Klartext zusammenführen. Zeilen einer Seite mit
// Zeilenumbruch, Seiten mit Trenn-Leerzeile; Rand-Leerzeilen und dreifache Umbrüche werden geglättet,
// leere Seiten entfallen. (Vorher wurden Items einer Seite mit Leerzeichen zu EINER Zeile geklebt.)
export function joinPdfPages(pages: readonly (readonly string[])[]): string {
  return pages
    .map((lines) =>
      lines
        .map((line) => line.replace(/\s+$/, ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^\n+|\n+$/g, "")
        .trim(),
    )
    .filter((page) => page.length > 0)
    .join("\n\n")
    .trim();
}
