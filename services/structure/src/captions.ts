// WP-BILD-1e/1f/1g: Extraktion der Bild-Fußnoten (figcaption-Texte) aus einem KO-bodyHtml.
// Lebt seit WP-BILD-1g im structure-Modul (unterhalb von knowledge-object UND library-analytics):
// die Persistenz-Grenze (KoService schreibt captionTexts als abgeleitetes Suchfeld) und die Suche
// nutzen DENSELBEN Scanner — ohne Modulgrenzen-Verletzung/Zyklus.
//
// SPIEGEL der Client-Liste in apps/web/src/lib/editorFigures.ts (ein Server-Import über die
// Modulgrenze apps↔services ist nicht möglich). Ein Paritäts-Test hält beide Listen byte-gleich.
export const LEGACY_IMAGE_CAPTION_PLACEHOLDERS: readonly string[] = [
  "Noch keine Bildbeschreibung",
  "No image description yet",
  "Nog geen afbeeldingsbeschrijving",
];

const OPEN_TAG = "<figcaption";
const CLOSE_TAG = "</figcaption>";

// WP-BILD-1f (bens P4): BODY-SPARENDER Scanner. Ein bodyHtml kann megabyte-große base64-src-Blöcke
// (eingebettete Editor-Bilder) enthalten — eine Regex liefe zeichenweise mit Capture-Gruppen über
// den GESAMTEN Body. Stattdessen: reine indexOf-Segment-Sprünge von figcaption zu figcaption; die
// Bilddaten (Attributwerte) werden NIE materialisiert, NIE regex-gescannt und NIE in ein Ergebnis
// kopiert (base64 kann kein „<" enthalten — ein Sprungziel liegt nie in einem src-Wert). Nur der
// kleine Fußnoten-Ausschnitt selbst wird geslict und normalisiert (Tags raus, Whitespace
// kollabiert); leere Fußnoten und exakte Alt-Platzhaltertexte (WP-D10) fallen weg.
export function imageCaptionTexts(bodyHtml: string | null | undefined): string[] {
  if (!bodyHtml) {
    return [];
  }
  const out: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = bodyHtml.indexOf(OPEN_TAG, cursor);
    if (start < 0) {
      break;
    }
    const openEnd = bodyHtml.indexOf(">", start + OPEN_TAG.length);
    if (openEnd < 0) {
      break;
    }
    const close = bodyHtml.indexOf(CLOSE_TAG, openEnd + 1);
    if (close < 0) {
      break;
    }
    const text = bodyHtml
      .slice(openEnd + 1, close)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0 && !LEGACY_IMAGE_CAPTION_PLACEHOLDERS.includes(text)) {
      out.push(text);
    }
    cursor = close + CLOSE_TAG.length;
  }
  return out;
}
