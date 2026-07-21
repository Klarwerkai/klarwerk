// WP-BILD-1e/1g: Bild-Fußnoten in der Bibliotheks-Suche. Seit WP-BILD-1g liegt der body-sparende
// Scanner im structure-Modul (services/structure/src/captions.ts) — die KO-Persistenz schreibt
// damit das abgeleitete captionTexts-Suchfeld, die Suche liest NUR noch dieses Feld (bodyHtml wird
// für die Suche nicht mehr geladen; Legacy-KOs ohne Feld werden beim ersten Treffer-Kandidaten
// einmalig backgefüllt — s. LibraryService.search). Dieses Modul re-exportiert den Scanner für
// bestehende Aufrufer über die öffentliche library-analytics-API.
import { imageCaptionTexts } from "../../structure";

export { imageCaptionTexts, LEGACY_IMAGE_CAPTION_PLACEHOLDERS } from "../../structure";

// Suchvertrag der Fußnoten: case-insensitiver Substring-Match (identisch zur title/statement-Suche).
export function captionsMatchQuery(bodyHtml: string | null | undefined, q: string): boolean {
  return imageCaptionTexts(bodyHtml).some((caption) => caption.toLowerCase().includes(q));
}
