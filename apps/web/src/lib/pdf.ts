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
  // JOB 2700 D1: pdfjs gibt Worker und Speicher erst mit `destroy()` frei. Optional, damit Stubs
  // und aeltere Fixtures ohne es weiterlaufen.
  destroy?(): Promise<void> | void;
}
// JOB 2700 D1: die Ladeaufgabe von pdfjs (`PDFDocumentLoadingTask`) — `destroy()` bricht ein
// laufendes Parsen ab. Optional aus demselben Grund wie oben.
export interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
  destroy?(): Promise<void> | void;
}
export interface PdfEngine {
  getDocument(src: { data: Uint8Array }): PdfLoadingTask;
}

// WP-D3: Seiten-Cap als Sicherheitsnetz gegen Riesen-PDFs (Browser-Freeze, 1-MiB-extract-Body). Über
// dem Cap wird der Rest NICHT still verschluckt, sondern ehrlich als `truncated` gemeldet.
export const MAX_PDF_PAGES = 200;

// ================================================================================================
// JOB 2700 D1 (Befund R2-28) — EIN DOKUMENT, DAS ZU LANGE BRAUCHT, BRICHT AB STATT ZU HAENGEN.
// ================================================================================================
//
// `MAX_PDF_PAGES` begrenzte nur, wie viele Seiten TEXT geholt werden; geparst wurde vorher das ganze
// Dokument, ohne Frist. Ein gescanntes Handbuch von 50 MB hielt den Tab fest. Jetzt laeuft die ganze
// Extraktion (Parsen UND Seiten lesen) gegen EINE Frist; laeuft sie ab, wird die Ladeaufgabe und das
// Dokument bei pdfjs freigegeben (`destroy`) — sonst bliebe der Parser im Speicher, auch wenn niemand
// mehr auf ihn wartet — und der Aufrufer bekommt einen benannten Fehler, keinen ewigen „wird gelesen".
export const PDF_PARSE_TIMEOUT_MS = 60_000;

export class PdfTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`pdf-timeout:${timeoutMs}`);
    this.name = "PdfTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

async function freigeben(task: PdfLoadingTask, doc: PdfDocumentProxy | undefined): Promise<void> {
  try {
    await doc?.destroy?.();
  } catch {
    // Aufraeumen darf den eigentlichen Fehler nicht verdecken.
  }
  try {
    await task.destroy?.();
  } catch {
    // dito
  }
}

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
  opts: { maxPages?: number; timeoutMs?: number } = {},
): Promise<PdfDocumentText> {
  const maxPages = opts.maxPages ?? MAX_PDF_PAGES;
  const timeoutMs = opts.timeoutMs ?? PDF_PARSE_TIMEOUT_MS;
  const task = engine.getDocument({ data: new Uint8Array(buffer) });
  let doc: PdfDocumentProxy | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frist = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PdfTimeoutError(timeoutMs)), timeoutMs);
  });
  const arbeit = (async (): Promise<PdfDocumentText> => {
    doc = await task.promise;
    const total = doc.numPages;
    const readCount = Math.min(total, maxPages);
    const pages: string[][] = [];
    for (let i = 1; i <= readCount; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(reconstructPageLines(content.items.map(toPositioned)));
    }
    return { text: joinPdfPages(pages), truncated: total > readCount, pageCount: readCount };
  })();
  // Laeuft die Frist ab, darf die weiterlaufende Arbeit spaeter nicht als unbehandelte Ablehnung
  // auftauchen — sie ist dann bereits beantwortet.
  arbeit.catch(() => undefined);
  try {
    const ergebnis = await Promise.race([arbeit, frist]);
    // JOB 2700 D1: auch nach Erfolg freigeben — der Text ist da, der Parser wird nicht mehr gebraucht.
    await freigeben(task, doc);
    return ergebnis;
  } catch (err) {
    await freigeben(task, doc);
    throw err;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

// Rückwärtskompatibler String-Vertrag (bestehende Aufrufer/Tests): nur der Text, ohne truncated-Signal.
export async function extractPdfText(buffer: ArrayBuffer, engine: PdfEngine): Promise<string> {
  return (await extractPdfDocument(buffer, engine)).text;
}
