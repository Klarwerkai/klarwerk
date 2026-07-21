// WP-BILD-1e: Bild-Fußnoten (figcaption-Texte im KO-bodyHtml) werden von der Bibliotheks-Suche
// gefunden. Die Suche (FR-LIB-01) matchte bisher NUR title/statement — der bodyHtml (und damit
// jede Bildbeschreibung) war unsichtbar. Diese pure Extraktion liefert die durchsuchbaren
// Fußnoten-Texte; Alt-Platzhaltertexte gelten wie im Editor (WP-D10) als KEIN Inhalt und werden
// deshalb NICHT indexiert (konsistent zur Leer-Behandlung der Anzeige).

// SPIEGEL der Client-Liste in apps/web/src/lib/editorFigures.ts (dort Editor-/Anzeige-Seite; ein
// Server-Import über die Modulgrenze apps↔services ist nicht möglich). Ein Paritäts-Test hält
// beide Listen byte-gleich.
export const LEGACY_IMAGE_CAPTION_PLACEHOLDERS: readonly string[] = [
  "Noch keine Bildbeschreibung",
  "No image description yet",
  "Nog geen afbeeldingsbeschrijving",
];

const OPEN_TAG = "<figcaption";
const CLOSE_TAG = "</figcaption>";

// WP-BILD-1f (bens P4): BODY-SPARENDER Scanner. Ein bodyHtml kann megabyte-große base64-src-Blöcke
// (eingebettete Editor-Bilder) enthalten — die frühere Regex lief zeichenweise mit Capture-Gruppen
// über den GESAMTEN Body. Jetzt: reine indexOf-Segment-Sprünge von figcaption zu figcaption; die
// Bilddaten (Attributwerte) werden NIE materialisiert, NIE regex-gescannt und NIE in ein Ergebnis
// kopiert (base64 kann kein „<" enthalten — ein Sprungziel liegt nie in einem src-Wert). Nur der
// kleine Fußnoten-Ausschnitt selbst wird geslict und normalisiert.
// Extrahiert die Fußnoten-Texte aus einem (bereits server-sanitisierten) bodyHtml: Tags raus,
// Whitespace kollabiert; leere Fußnoten und exakte Alt-Platzhaltertexte fallen weg.
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

// Suchvertrag der Fußnoten: case-insensitiver Substring-Match (identisch zur title/statement-Suche).
export function captionsMatchQuery(bodyHtml: string | null | undefined, q: string): boolean {
  return imageCaptionTexts(bodyHtml).some((caption) => caption.toLowerCase().includes(q));
}
