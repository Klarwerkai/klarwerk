// SCRUM-323: DOM-freie Klassifikation der Anhänge für die Editor-Attachment-Kontextkarte. Unterscheidet
// Bilder (per Bild-Button in den ausführlichen Inhalt einfügbar) von Dateien (bleiben Anhang/Evidence,
// NICHT inline einbettbar). Funktioniert für Capture (lokale Anhänge) und KO-Detail (bestehende
// KO-Anhänge) über ein minimales Input-Interface. Keine DOM-Abhängigkeit, keine Upload-/Backend-Logik.

export interface AttachmentLike {
  // Optionaler MIME-Typ; fehlend/leer/ungültig wird defensiv als Datei (nicht Bild) gewertet.
  mime?: string | null | undefined;
  // SCRUM-371: optionale Object-Store-ID. Vorhanden = im Body verlinkbar (Nicht-Bild) bzw. dauerhaft
  // gespeichert; fehlend = noch nicht hochgeladene Capture-Session-Datei (bleibt Evidence, KEIN Fake-Link).
  objectId?: string | null | undefined;
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

// ---------------------------------------------------------------------------
// SCRUM-371 / AG-02-SESSION / AG-12/13: reichere, object-store-bewusste Media-/Evidence-Führung.
// Bildet die drei realen Fälle ehrlich ab, OHNE die bestehende attachmentContext-Ausgabe zu ändern:
//  - inlineImages:   Bilder — im ausführlichen Inhalt einbettbar (Object-Store-Raw ODER sichere
//                    data:image-Vorschau). Illustrieren Wissen.
//  - linkableFiles:  Nicht-Bild MIT Object-Store-objectId — als sicherer Body-Link referenzierbar
//                    (SCRUM-355). Belege/Kontext.
//  - evidenceFiles:  Nicht-Bild OHNE objectId (noch nicht hochgeladene Capture-Session-Datei) —
//                    bleibt Anhang/Evidence, wird NACH dem Speichern verlinkbar. KEIN Fake-Link.
// Evidence verbessert die Nachvollziehbarkeit, ersetzt aber NIE Status/Trust/Validierung.
// ---------------------------------------------------------------------------

export interface MediaGuide {
  inlineImages: number;
  linkableFiles: number;
  evidenceFiles: number;
  total: number;
  hasAny: boolean;
  hasImages: boolean;
  hasLinkableFiles: boolean;
  hasEvidenceFiles: boolean;
}

function hasObjectId(item: AttachmentLike): boolean {
  return typeof item.objectId === "string" && item.objectId.trim().length > 0;
}

export function editorMediaGuide(items: readonly AttachmentLike[]): MediaGuide {
  let inlineImages = 0;
  let linkableFiles = 0;
  let evidenceFiles = 0;
  for (const item of items) {
    if (isImageAttachment(item)) {
      inlineImages += 1;
    } else if (hasObjectId(item)) {
      linkableFiles += 1;
    } else {
      evidenceFiles += 1;
    }
  }
  const total = items.length;
  return {
    inlineImages,
    linkableFiles,
    evidenceFiles,
    total,
    hasAny: total > 0,
    hasImages: inlineImages > 0,
    hasLinkableFiles: linkableFiles > 0,
    hasEvidenceFiles: evidenceFiles > 0,
  };
}

// i18n-Keys der Evidence-Story/Media-Führung (Labels/Hinweise; Zahlen rendert die Komponente).
export const MEDIA_TITLE_KEY = "editor.media.title";
export const MEDIA_IMAGES_KEY = "editor.media.images";
export const MEDIA_IMAGE_HINT_KEY = "editor.media.imageHint";
export const MEDIA_LINKABLE_KEY = "editor.media.linkable";
export const MEDIA_LINKABLE_HINT_KEY = "editor.media.linkableHint";
export const MEDIA_EVIDENCE_KEY = "editor.media.evidence";
export const MEDIA_EVIDENCE_HINT_KEY = "editor.media.evidenceHint";
// Ehrliche Kernaussage: Evidence verbessert Nachvollziehbarkeit, ist aber KEINE Freigabe.
export const MEDIA_NOTE_KEY = "editor.media.note";
