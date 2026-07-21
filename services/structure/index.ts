// Öffentliche API des Moduls structure (KW-STR / SCRUM-45/46/48).
// WP-IC-PAKET-1 (Teil 1): decodeHtmlEntities — vollständige, einmalige Entity-Dekodierung (Import-Texte).
export { sanitizeHtml, htmlToPlainText, decodeHtmlEntities } from "./src/sanitize";
// WP-BILD-1g: body-sparender Fußnoten-Scanner — von der KO-Persistenz (captionTexts-Suchfeld)
// UND der Bibliotheks-Suche genutzt (eine Implementierung, keine Zweitlogik).
// WP-BILD-1h: searchCaptionTexts = Scanner + kanonischer Größendeckel (500 Zeichen/Caption,
// 50 Captions/KO) — der EINE Persistenzpfad für create, revise und Legacy-Backfill.
export {
  imageCaptionTexts,
  searchCaptionTexts,
  LEGACY_IMAGE_CAPTION_PLACEHOLDERS,
  MAX_CAPTION_TEXT_LENGTH,
  MAX_CAPTIONS_PER_KO,
} from "./src/captions";
