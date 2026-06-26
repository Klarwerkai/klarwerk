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

// SCRUM-122: Seitenweise extrahierte Text-Items zu einem Klartext zusammenführen.
// Items je Seite mit Leerzeichen, Seiten mit Leerzeile; leere Seiten entfallen.
export function joinPdfPages(pages: readonly (readonly string[])[]): string {
  return pages
    .map((items) =>
      items
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join(" ")
        .trim(),
    )
    .filter((p) => p.length > 0)
    .join("\n\n")
    .trim();
}
