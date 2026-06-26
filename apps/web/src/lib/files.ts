// Datei-Helfer für die Erfassung — alles client-seitig, ohne Server-/Objektspeicher.
// DOM-Modul (nutzt File/Image/document/FileReader). Der DOM-freie DOCX-Kern liegt
// in `./docx` und wird hier nur als Browser-Wrapper umhüllt.
import { extractDocxText, isDocxDocumentLike } from "./docx";
import { detectFileKind } from "./extract";
import { type OcrResult, recognizeImage } from "./ocr";
import { type PdfEngine, extractPdfText } from "./pdf";

// FR-CAP-05: Bild auf ein kleines Thumbnail (JPEG) verkleinern → Daten-URL.
export function fileToThumbDataUrl(file: File, maxPx = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("no-canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img-error"));
    };
    img.src = url;
  });
}

// FR-CAP-06 (Teil): Text-Dokumente (txt/md/csv) client-seitig als Klartext lesen.
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read-error"));
    reader.readAsText(file);
  });
}

// SCRUM-121: Original-Datei als Daten-URL lesen (geht in den Object-Store, NICHT ins KO).
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read-error"));
    reader.readAsDataURL(file);
  });
}

const TEXT_EXTS = [".txt", ".md", ".markdown", ".csv", ".log", ".json"];

export function isTextDocument(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type.startsWith("text/") || TEXT_EXTS.some((e) => name.endsWith(e));
}

// FR-CAP-06: .docx-Erkennung als dünner Browser-Wrapper um die DOM-freie Logik.
export function isWordDocument(file: File): boolean {
  return isDocxDocumentLike({ name: file.name, type: file.type });
}

// Browser-Wrapper: liest die Datei und extrahiert den Text über den DOM-freien Kern.
export async function readDocxFile(file: File): Promise<string> {
  return extractDocxText(await file.arrayBuffer());
}

export function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

// SCRUM-122: PDF-Erkennung als dünner Wrapper um den DOM-freien Kern.
export function isPdfDocument(file: File): boolean {
  return detectFileKind({ name: file.name, type: file.type }) === "pdf";
}

// Schlanke lokale Verträge für die lazy geladenen Engines (keine Abhängigkeit von
// pdfjs/tesseract-Typen im Typecheck; echte Auflösung beim Vite-Build).
type PdfjsModule = PdfEngine & {
  GlobalWorkerOptions: { workerSrc: string };
};
type TesseractModule = {
  recognize(input: unknown, lang?: string): Promise<{ data: { text: string } }>;
};

let pdfEnginePromise: Promise<PdfEngine> | null = null;

// pdfjs-dist@4 legacy build lazy laden + Worker Vite-kompatibel (new URL(..., import.meta.url)).
async function pdfEngine(): Promise<PdfEngine> {
  if (!pdfEnginePromise) {
    pdfEnginePromise = (async () => {
      const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfjsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).href;
      return { getDocument: (src) => pdfjs.getDocument(src) };
    })();
  }
  return pdfEnginePromise;
}

// SCRUM-122: PDF client-seitig als Text-Kontext extrahieren (lazy, kein Main-Bundle).
export async function readPdfFile(file: File): Promise<string> {
  const engine = await pdfEngine();
  return extractPdfText(await file.arrayBuffer(), engine);
}

// SCRUM-123: OCR-Kandidat = Bild. OCR wird NIE automatisch beim Upload gestartet.
export function isOcrCandidate(file: File): boolean {
  return file.type.startsWith("image/");
}

// SCRUM-123: optionale Bild-OCR (lazy tesseract.js@5, Worker/WASM). Engine nicht ladbar
// → ehrlich „unavailable", kein Vortäuschen. Nur auf explizite Nutzeraktion aufrufen.
export async function runImageOcr(input: File | string, lang = "deu+eng"): Promise<OcrResult> {
  try {
    const mod = (await import("tesseract.js")) as unknown as TesseractModule & {
      default?: TesseractModule;
    };
    const tesseract = mod.default ?? mod;
    return recognizeImage(input, { recognize: (img) => tesseract.recognize(img, lang) });
  } catch {
    return { status: "unavailable", text: "" };
  }
}
