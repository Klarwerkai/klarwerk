// Datei-Helfer für die Erfassung — alles client-seitig, ohne Server-/Objektspeicher.
// DOM-Modul (nutzt File/Image/document/FileReader). Der DOM-freie DOCX-Kern liegt
// in `./docx` und wird hier nur als Browser-Wrapper umhüllt.
import { extractDocxText, isDocxDocumentLike } from "./docx";

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
