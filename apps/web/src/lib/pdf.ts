// DOM-freier PDF-Extraktions-Adapter (SCRUM-122 / WP-D3).
// Engine wird injiziert → in Node mit Stub testbar, kein pdfjs-Import hier.
// Die echte pdfjs-Engine (lazy, Worker) wird im Browser-Wrapper `files.ts` gebaut.
import { type PdfPositionedItem, joinPdfPages, reconstructPageLines } from "./extract";

export interface PdfTextItem {
  str?: string;
  // WP-D3: pdfjs liefert je Fragment die Transformationsmatrix ([4]=x, [5]=y; Ursprung unten links)
  // und die Glyphenhöhe. Beide sind für die Zeilen-/Absatzrekonstruktion nötig; optional, damit
  // Stubs/ältere Fixtures ohne Position weiterhin als eine Zeile gelesen werden.
  transform?: number[];
  height?: number;
  width?: number;
}
export interface PdfTextContent {
  items: PdfTextItem[];
}
export interface PdfPageProxy {
  getTextContent(): Promise<PdfTextContent>;
}
export interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
}
export interface PdfEngine {
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDocumentProxy> };
}

// WP-D3: Seiten-Cap als Sicherheitsnetz gegen Riesen-PDFs (Browser-Freeze, 1-MiB-extract-Body). Über
// dem Cap wird der Rest NICHT still verschluckt, sondern ehrlich als `truncated` gemeldet.
export const MAX_PDF_PAGES = 200;

export interface PdfDocumentText {
  text: string; // zeilen-/absatztreuer Klartext (bis zum Seiten-Cap)
  truncated: boolean; // true, wenn das PDF mehr Seiten hat als gelesen wurden
  pageCount: number; // tatsächlich gelesene Seiten
}

// pdfjs-Fragment → positioniertes Item für die Rekonstruktion. Ohne transform (z. B. Stub) fällt das
// Fragment auf x=y=0 → alle Fragmente derselben Seite bilden eine Zeile (bisheriges Verhalten).
function toPositioned(item: PdfTextItem): PdfPositionedItem {
  const t = item.transform;
  return {
    ...(item.str !== undefined ? { str: item.str } : {}),
    x: Array.isArray(t) ? (t[4] ?? 0) : 0,
    y: Array.isArray(t) ? (t[5] ?? 0) : 0,
    height: item.height ?? 0,
  };
}

// WP-D3: gesamten PDF-Text zeilen-/absatztreu extrahieren (Seite für Seite rekonstruiert, dann
// zusammengeführt). Meldet `truncated`, wenn der Seiten-Cap greift.
export async function extractPdfDocument(
  buffer: ArrayBuffer,
  engine: PdfEngine,
  opts: { maxPages?: number } = {},
): Promise<PdfDocumentText> {
  const maxPages = opts.maxPages ?? MAX_PDF_PAGES;
  const doc = await engine.getDocument({ data: new Uint8Array(buffer) }).promise;
  const total = doc.numPages;
  const readCount = Math.min(total, maxPages);
  const pages: string[][] = [];
  for (let i = 1; i <= readCount; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(reconstructPageLines(content.items.map(toPositioned)));
  }
  return { text: joinPdfPages(pages), truncated: total > readCount, pageCount: readCount };
}

// Rückwärtskompatibler String-Vertrag (bestehende Aufrufer/Tests): nur der Text, ohne truncated-Signal.
export async function extractPdfText(buffer: ArrayBuffer, engine: PdfEngine): Promise<string> {
  return (await extractPdfDocument(buffer, engine)).text;
}
