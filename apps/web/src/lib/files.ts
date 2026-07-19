// Datei-Helfer für die Erfassung — alles client-seitig, ohne Server-/Objektspeicher.
// DOM-Modul (nutzt File/Image/document/FileReader). Der DOM-freie DOCX-Kern liegt
// in `./docx` und wird hier nur als Browser-Wrapper umhüllt.
import { type DocxRichResult, extractDocxRich, extractDocxText, isDocxDocumentLike } from "./docx";
import { detectFileKind } from "./extract";
import { type OcrResult, recognizeImage } from "./ocr";
import { type PdfDocumentText, type PdfEngine, extractPdfDocument } from "./pdf";

// FR-CAP-05: Bild auf ein kleines Thumbnail (JPEG) verkleinern → Daten-URL.
// WICHTIG (Pedi/VIP 06.07.): NICHT über eine blob:-URL laden. Die Server-CSP erlaubt bei img-src nur
// 'self' und data: — eine blob:-URL (URL.createObjectURL) wird beim Bild-Laden vom Browser blockiert,
// das Bild lädt nie, die Promise wirft und der Aufrufer verschluckt es still → „Bild vom Rechner"
// erschien nie. Deshalb via FileReader als data:-URL laden (CSP-konform), dann verkleinern.
export function fileToThumbDataUrl(file: File, maxPx = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-error"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("no-canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("img-error"));
      // data:-URL (kein blob:) → von der CSP erlaubt.
      img.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
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

// WP-D1: eingebettetes data:image-Bild auf max. Kantenlänge herunterskalieren (Canvas → JPEG),
// damit ein bildreiches DOCX das Draft-/KO-Speichern (globaler 1-MiB-HTTP-Body) nicht sprengt.
// Bild bereits klein genug → unverändert zurück (kein unnötiger Qualitätsverlust). Jeder Fehler
// (exotisches Format, Canvas-Grenze) → Original zurück; der Server-Sanitizer bleibt der Backstop.
export function downscaleImageDataUrl(
  dataUrl: string,
  maxPx = 1280,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl; // data:-URL → CSP-konform (img-src erlaubt data:)
  });
}

// WP-D1: strukturerhaltendes DOCX-Lesen (HTML + Klartext); eingebettete Bilder werden
// clientseitig herunterskaliert, bevor sie ins bodyHtml wandern.
export async function readDocxRich(file: File): Promise<DocxRichResult> {
  return extractDocxRich(await file.arrayBuffer(), {
    mapImage: (src) => downscaleImageDataUrl(src),
  });
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

// SCRUM-122 / WP-D3: PDF client-seitig zeilen-/absatztreu als Text-Kontext extrahieren (lazy, kein
// Main-Bundle). Liefert zusätzlich `truncated`, wenn der Seiten-Cap (MAX_PDF_PAGES) griff — der
// Aufrufer meldet das ehrlich statt still zu kürzen.
export async function readPdfFile(file: File): Promise<PdfDocumentText> {
  const engine = await pdfEngine();
  return extractPdfDocument(await file.arrayBuffer(), engine);
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
