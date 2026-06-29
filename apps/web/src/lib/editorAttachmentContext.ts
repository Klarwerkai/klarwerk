// SCRUM-323: DOM-freie Klassifikation der Anhänge für die Editor-Attachment-Kontextkarte. Unterscheidet
// Bilder (per Bild-Button in den ausführlichen Inhalt einfügbar) von Dateien (bleiben Anhang/Evidence,
// NICHT inline einbettbar). Funktioniert für Capture (lokale Anhänge) und KO-Detail (bestehende
// KO-Anhänge) über ein minimales Input-Interface. Keine DOM-Abhängigkeit, keine Upload-/Backend-Logik.

export interface AttachmentLike {
  // Optionaler MIME-Typ; fehlend/leer/ungültig wird defensiv als Datei (nicht Bild) gewertet.
  mime?: string | null | undefined;
}

export interface AttachmentContext {
  imageCount: number;
  fileCount: number;
  total: number;
  hasAny: boolean;
}

// i18n-Keys (Labels/Hinweise; Zahlen rendert die Komponente direkt).
export const ATTACH_TITLE_KEY = "editor.attach.title";
export const ATTACH_IMAGES_KEY = "editor.attach.images";
export const ATTACH_FILES_KEY = "editor.attach.files";
export const ATTACH_IMAGE_HINT_KEY = "editor.attach.imageHint";
export const ATTACH_FILE_HINT_KEY = "editor.attach.fileHint";

export function isImageAttachment(item: AttachmentLike): boolean {
  return typeof item.mime === "string" && item.mime.toLowerCase().startsWith("image/");
}

export function attachmentContext(items: readonly AttachmentLike[]): AttachmentContext {
  let imageCount = 0;
  for (const item of items) {
    if (isImageAttachment(item)) {
      imageCount += 1;
    }
  }
  const total = items.length;
  return { imageCount, fileCount: total - imageCount, total, hasAny: total > 0 };
}
