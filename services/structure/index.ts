// Öffentliche API des Moduls structure (KW-STR / SCRUM-45/46/48).
// WP-IC-PAKET-1 (Teil 1): decodeHtmlEntities — vollständige, einmalige Entity-Dekodierung (Import-Texte).
export { sanitizeHtml, htmlToPlainText, decodeHtmlEntities } from "./src/sanitize";
// JOB 2703 D1/D2: DIE EINE Kuerzungsregel fuer die Kernaussage (Confluence-Mapper, Word-Serverroute,
// Entwurfsanlage) — hier neben `htmlToPlainText`, weil sie es nutzt und `structure` nicht
// eingefroren ist (D1 hatte sie in `library-analytics` mit selbst gezeichneter Freeze-Freigabe).
export { kernaussageAusKlartext, kernaussageAusHtml, KERNAUSSAGE_MAX } from "./src/kernaussage";
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
