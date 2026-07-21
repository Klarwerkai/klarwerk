// Öffentliche API des Moduls structure (KW-STR / SCRUM-45/46/48).
// WP-IC-PAKET-1 (Teil 1): decodeHtmlEntities — vollständige, einmalige Entity-Dekodierung (Import-Texte).
export { sanitizeHtml, htmlToPlainText, decodeHtmlEntities } from "./src/sanitize";
// WP-BILD-1g: body-sparender Fußnoten-Scanner — von der KO-Persistenz (captionTexts-Suchfeld)
// UND der Bibliotheks-Suche genutzt (eine Implementierung, keine Zweitlogik).
export { imageCaptionTexts, LEGACY_IMAGE_CAPTION_PLACEHOLDERS } from "./src/captions";
