// WP-BILD-1e/1g: Bild-Fußnoten in der Bibliotheks-Suche. Seit WP-BILD-1g liegt der body-sparende
// Scanner im structure-Modul (services/structure/src/captions.ts) — die KO-Persistenz schreibt
// damit das abgeleitete captionTexts-Suchfeld, die Suche liest NUR noch dieses Feld (bodyHtml wird
// für die Suche nicht mehr geladen; Legacy-KOs ohne Feld werden beim ersten Treffer-Kandidaten
// einmalig backgefüllt — s. LibraryService.search). Dieses Modul re-exportiert den Scanner für
// bestehende Aufrufer über die öffentliche library-analytics-API.
export { imageCaptionTexts, LEGACY_IMAGE_CAPTION_PLACEHOLDERS } from "../../structure";

// R-1349: Hier stand `captionsMatchQuery` (Fußnoten-Treffer über den Body). Die Suche matcht seit
// G27 auf der Suchprojektion (persistiertes Fußnotenfeld); die Hilfe rief kein Produktweg mehr und
// ist entfernt.
