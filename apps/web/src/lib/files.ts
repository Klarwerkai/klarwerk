// Datei-Helfer für die Erfassung — alles client-seitig, ohne Server-/Objektspeicher.
// DOM-Modul (nutzt File/Image/document/FileReader). Der DOM-freie DOCX-Kern liegt
// in `./docx` und wird hier nur als Browser-Wrapper umhüllt.
import {
  type DocxRichResult,
  MAX_INLINE_BODY_HTML_BYTES,
  extractDocxRich,
  extractDocxText,
  isDocxDocumentLike,
} from "./docx";
import { detectFileKind } from "./extract";
import { type OcrResult, recognizeImage } from "./ocr";
import { type PdfDocumentText, type PdfEngine, extractPdfDocument } from "./pdf";
import {
  type FflateLike,
  type PptxRichResult,
  PptxTooLargeError,
  type PptxUnzip,
  budgetedPptxUnzip,
  extractPptxRich,
  isPptxDocumentLike,
} from "./pptx";

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

// WP-D1c (bens ROT-Fix): das GESAMT-Byte-Budget des bodyHtml (Struktur + Text + Bilder), in ECHTEN
// UTF-8-Bytes, leitet sich vom SERVER-Ceiling ab, NICHT mehr von einer harten 700-KB-Grenze. Der
// Server-Cap für POST/PUT /api/drafts ist 25 MiB (DRAFTS_BODY_LIMIT, capture-routes.ts). Bewusst
// KONSERVATIV auf 12 MiB gesetzt: lässt der JSON-Serialisierung (Escaping von `"`/`\`) und dem
// Envelope (Titel/Statement/Felder) reichlich Puffer, sodass das finale JSON garantiert weit unter dem
// Ceiling landet. Kern-Use-Case ist „viele Bilder BEHALTEN" → das Budget ist großzügig, nicht knapp.
// Die Konstante MAX_INLINE_BODY_HTML_BYTES lebt jetzt im DOM-freien ./docx (Node-Test-Import) und wird
// hier aus demselben Modul bezogen.
// WP-D1c: aggressive, aber diagramm-lesbare Kompression. 1600 px lange Kante hält technische Zeichnungen
// lesbar; JPEG ~0.75 drückt die Bytes stark. Für extrem schwere Bilder greifen fallende Qualitätsstufen.
const IMAGE_MAX_EDGE_PX = 1600;
const JPEG_QUALITY_STEPS: readonly number[] = [0.75, 0.6, 0.45, 0.3];
// WP-D1d: Pro-Bild-Byte-Ziel — mit dem 5-MiB-Ceiling kleiner gewählt (120 KB), damit viele Bilder ins
// 3,5-MiB-Gesamtbudget passen und BEHALTEN werden; groß genug für lesbare Diagramme.
const PER_IMAGE_TARGET_BYTES = 120_000;

// WP-D1/WP-D1c: eingebettetes data:image-Bild AGGRESSIV re-encodieren (Canvas → JPEG), dimensions- UND
// byte-getrieben — Bilder werden komprimiert und BEHALTEN, nicht weggeworfen. Große Kanten werden auf
// IMAGE_MAX_EDGE_PX gedeckelt; danach fällt die JPEG-Qualität, bis das Pro-Bild-Ziel erreicht ist. Ein
// bereits kleines UND leichtes Bild bleibt unverändert (kein unnötiger Qualitätsverlust). Jeder Fehler
// → Original zurück (das Gesamtbudget in applyInlineImageBudget ist der Backstop).
export function downscaleImageDataUrl(
  dataUrl: string,
  maxPx = IMAGE_MAX_EDGE_PX,
  targetBytes = PER_IMAGE_TARGET_BYTES,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      // Bereits klein (Kantenlänge) UND leicht (Bytes) → unverändert lassen.
      if (scale >= 1 && dataUrl.length <= targetBytes) {
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
        // Progressiv: fallende JPEG-Qualität, bis das Pro-Bild-Ziel erreicht ist. Die kleinste Variante
        // wird genommen, selbst wenn das Ziel nicht ganz erreicht wird (das Gesamt-Budget fängt den Rest).
        let best = canvas.toDataURL("image/jpeg", JPEG_QUALITY_STEPS[0]);
        for (const q of JPEG_QUALITY_STEPS.slice(1)) {
          if (best.length <= targetBytes) {
            break;
          }
          const smaller = canvas.toDataURL("image/jpeg", q);
          if (smaller.length < best.length) {
            best = smaller;
          }
        }
        // Nie größer als das Original zurückgeben.
        resolve(best.length < dataUrl.length ? best : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl; // data:-URL → CSP-konform (img-src erlaubt data:)
  });
}

// WP-D1/WP-D1c: strukturerhaltendes DOCX-Lesen (HTML + Klartext); eingebettete Bilder werden
// clientseitig aggressiv komprimiert und über ein hartes GESAMT-Byte-Budget (echte UTF-8-Bytes)
// geführt — komprimiert BEHALTEN, solange sie passen; nur als Notbremse weggelassen. So sprengt ein
// bildreiches DOCX das Draft-Speichern nie (totalImages/droppedImages melden ehrlich).
export async function readDocxRich(file: File): Promise<DocxRichResult> {
  return extractDocxRich(await file.arrayBuffer(), {
    mapImage: (src) => downscaleImageDataUrl(src),
    imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
  });
}

// WP-D5: .pptx-Erkennung als dünner Browser-Wrapper um die DOM-freie Logik.
export function isPptxDocument(file: File): boolean {
  return isPptxDocumentLike({ name: file.name, type: file.type });
}

let pptxUnzipPromise: Promise<PptxUnzip> | null = null;

// WP-D5b/WP-D5c (bens Budget-Fixes): komprimierte Datei-Obergrenze VOR dem Entpacken (50 MiB —
// konservativ: ein reales bildreiches Deck liegt weit darunter; verhindert, dass eine gigantische Datei
// überhaupt in den Parser läuft). Die eigentliche selektive + VOR-Dekompression durchgesetzte
// Budgetlogik (Entry-/Ratio-/Byte-/Slide-Caps, fail-closed) lebt namespace-frei in ./pptx
// (budgetedPptxUnzip + createPptxUnzipBudget) und ist dort mit echten fflate-zipSync-Fixtures getestet.
const PPTX_MAX_COMPRESSED_BYTES = 50 * 1024 * 1024; // 50 MiB Datei-Cap

// fflate lazy laden (synchrones unzipSync, klein/tree-shakeable) — NICHT ins Haupt-Bundle. Muster
// mammoth/pdfjs-Engine. Das budgetierte, selektive Entpacken bringt ./pptx (fflate injiziert).
async function pptxUnzip(): Promise<PptxUnzip> {
  if (!pptxUnzipPromise) {
    pptxUnzipPromise = (async () => {
      const mod = (await import("fflate")) as unknown as FflateLike & { default?: FflateLike };
      const fflate = mod.default ?? mod;
      return budgetedPptxUnzip(fflate);
    })();
  }
  return pptxUnzipPromise;
}

// WP-D5: strukturerhaltendes PPTX-Lesen (HTML + Klartext), Folie für Folie. Bilder werden in diesem
// Slice NICHT inline übernommen (nur gezählt) — das Original reist als Anhang mit (WP-D2). Der Aufrufer
// meldet Verluste (Layout/Animationen/Bilder/Notizen) ehrlich. Folien-Cap via MAX_PPTX_SLIDES (truncated).
export async function readPptxRich(file: File): Promise<PptxRichResult> {
  // WP-D5b: komprimierte Datei-Obergrenze VOR dem Einlesen — ehrlicher Abbruch statt Riesen-Parse.
  if (file.size > PPTX_MAX_COMPRESSED_BYTES) {
    throw new PptxTooLargeError("file-too-large");
  }
  const unzip = await pptxUnzip();
  return extractPptxRich(await file.arrayBuffer(), {
    unzip,
    budgetBytes: MAX_INLINE_BODY_HTML_BYTES,
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
