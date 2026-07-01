// SCRUM-372 / AG-P2-1 / FR-STR-03: DOM-freie Klassifikation/Entscheidung für Drag&Drop + Einfügen (Paste)
// im RichTextEditor. Trennt SICHER einbettbare Bilder (nur Raster: png/jpe?g/gif/webp) von allem anderen.
//
// Sicherheit: SVG-„Bilder" werden bewusst NICHT als einbettbar gewertet (data:image/svg = XSS-Vektor;
// der Sanitizer erlaubt sie ohnehin nicht). Nicht-Bild-Dateien werden NIE inline verlinkt — ohne
// Object-Store-objectId gibt es keinen sicheren Body-Link (kein Fake-/Behelfs-Link, kein Legacy-data:-URL
// für Dateien). Sie bleiben Anhang/Evidence; die Validierung entscheidet. Reine String-/Daten-Logik,
// kein DOM, kein FileReader, kein Upload — testbar ohne Browser.

// Nur diese Rastertypen deckt der Bild-Sanitizer sicher ab (kein SVG). Muss mit `isSafeImgSrc`
// (richText.ts) und `editorImagesFromLocalImages` (editorImages.ts) konsistent bleiben.
const INSERTABLE_IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp)$/i;

export function isInsertableImageMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && INSERTABLE_IMAGE_MIME_RE.test(mime.trim());
}

export interface DropMediaItem {
  mime?: string | null | undefined;
}

export interface DropPartition<T extends DropMediaItem> {
  // Sicher inline einbettbare Bilder (Raster). Werden über den vorhandenen sicheren Bildpfad eingefügt.
  images: T[];
  // Alles andere (Nicht-Bilder UND unsichere „Bilder" wie SVG) — bleibt Anhang/Evidence, kein Body-Link.
  files: T[];
  imageCount: number;
  fileCount: number;
  hasImages: boolean;
  hasFiles: boolean;
  hasAny: boolean;
}

export function partitionDropMedia<T extends DropMediaItem>(items: readonly T[]): DropPartition<T> {
  const images: T[] = [];
  const files: T[] = [];
  for (const item of items) {
    if (isInsertableImageMime(item.mime)) {
      images.push(item);
    } else {
      files.push(item);
    }
  }
  return {
    images,
    files,
    imageCount: images.length,
    fileCount: files.length,
    hasImages: images.length > 0,
    hasFiles: files.length > 0,
    hasAny: items.length > 0,
  };
}

// i18n-Keys für ruhige Drop/Paste-Führung (Progressive Disclosure; keine aufdringliche Tour).
// - hint:       Dauerhinweis unter der Toolbar (Bild ablegen/einfügen; Dateien bleiben Beleg).
// - imageActive: Overlay beim Drüberziehen eines Elements (Bild loslassen).
// - fileNotice: ehrliche transiente Meldung, wenn Nicht-Bilder gedroppt/eingefügt werden (kein Fake-Link).
export const EDITOR_DROP_KEYS = {
  hint: "editor.drop.hint",
  imageActive: "editor.drop.imageActive",
  fileNotice: "editor.drop.fileNotice",
} as const;
