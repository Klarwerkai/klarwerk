// DOM-freier PDF-Extraktions-Adapter (SCRUM-122).
// Engine wird injiziert → in Node mit Stub testbar, kein pdfjs-Import hier.
// Die echte pdfjs-Engine (lazy, Worker) wird im Browser-Wrapper `files.ts` gebaut.
import { joinPdfPages } from "./extract";

export interface PdfTextItem {
  str?: string;
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

// SCRUM-122: gesamten Text eines PDF extrahieren (Seite für Seite, dann zusammenführen).
export async function extractPdfText(buffer: ArrayBuffer, engine: PdfEngine): Promise<string> {
  const doc = await engine.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[][] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => it.str ?? ""));
  }
  return joinPdfPages(pages);
}
