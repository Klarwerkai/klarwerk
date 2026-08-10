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

import { IMAGE_ANCHOR_ATTR, isImageAnchorId } from "./sanitize";

const OPEN_TAG = "<figcaption";
const CLOSE_TAG = "</figcaption>";
// JOB 509 / R2: Anker-Attributname und Tokenprüfung kommen aus dem Sanitizer — Schreib- und
// Leseseite der Identität teilen eine Wahrheit (kein zweiter, driftender Vertrag).
const ANCHOR_ATTR = IMAGE_ANCHOR_ATTR;

// WP-BILD-1f (bens P4): BODY-SPARENDER Scanner. Ein bodyHtml kann megabyte-große base64-src-Blöcke
// (eingebettete Editor-Bilder) enthalten — eine Regex liefe zeichenweise mit Capture-Gruppen über
// den GESAMTEN Body. Stattdessen: reine indexOf-Segment-Sprünge von figcaption zu figcaption; die
// Bilddaten (Attributwerte) werden NIE materialisiert, NIE regex-gescannt und NIE in ein Ergebnis
// kopiert (base64 kann kein „<" enthalten — ein Sprungziel liegt nie in einem src-Wert). Nur der
// kleine Fußnoten-Ausschnitt selbst wird geslict und normalisiert (Tags raus, Whitespace
// kollabiert); leere Fußnoten und exakte Alt-Platzhaltertexte (WP-D10) fallen weg.
// WP-BILD-1h (bens sammel14/15-Auflage): GRÖSSENDECKEL des persistierten Suchfelds — an EINER
// kanonischen Stelle, die create + revise + Legacy-Backfill teilen. Je Caption hart 500 Zeichen
// (ehrlicher Schnitt, KEIN Ellipsis-Fake im Index), höchstens 50 Captions je KO (Rest fällt weg).
// Der Scanner selbst (imageCaptionTexts, ben-GRÜN) bleibt unangetastet — der Deckel liegt darüber.
export const MAX_CAPTION_TEXT_LENGTH = 500;
export const MAX_CAPTIONS_PER_KO = 50;

export function searchCaptionTexts(bodyHtml: string | null | undefined): string[] {
  return imageCaptionTexts(bodyHtml)
    .slice(0, MAX_CAPTIONS_PER_KO)
    .map((caption) => caption.slice(0, MAX_CAPTION_TEXT_LENGTH));
}

// JOB 509 / R2: Der Fußnotentext allein sagt nicht, ZU WELCHEM Bild er gehört — bei zwei gleichen
// Beschreibungen im selben Body bliebe nur die Position, und die ist keine Identität. Der Scanner
// gibt deshalb zusätzlich den Anker heraus, den der Sanitizer gesetzt hat. `imageId` ist ehrlich
// `null`, wenn die Fußnote keinen (oder keinen gültigen) Anker trägt — nichts wird geraten.
export interface ImageCaptionEntry {
  readonly imageId: string | null;
  readonly text: string;
}

// Anker aus dem (kleinen) figcaption-Open-Tag lesen — reine indexOf-/Zeichenarbeit auf dem
// Tag-Ausschnitt, nie über den Body (WP-BILD-1f, bens P4: base64-Bilddaten bleiben unberührt).
function anchorFromOpenTag(openTag: string): string | null {
  const at = openTag.indexOf(ANCHOR_ATTR);
  if (at < 0) {
    return null;
  }
  let i = at + ANCHOR_ATTR.length;
  while (openTag[i] === " ") {
    i += 1;
  }
  if (openTag[i] !== "=") {
    return null;
  }
  i += 1;
  while (openTag[i] === " ") {
    i += 1;
  }
  const quote = openTag[i];
  let value: string;
  if (quote === '"' || quote === "'") {
    const end = openTag.indexOf(quote, i + 1);
    if (end < 0) {
      return null;
    }
    value = openTag.slice(i + 1, end);
  } else {
    let end = i;
    while (end < openTag.length && openTag[end] !== " ") {
      end += 1;
    }
    value = openTag.slice(i, end);
  }
  return isImageAnchorId(value) ? value : null;
}

export function imageCaptionEntries(bodyHtml: string | null | undefined): ImageCaptionEntry[] {
  if (!bodyHtml) {
    return [];
  }
  const out: ImageCaptionEntry[] = [];
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
      // AUFTRAG-mega84 Block B: die Fußnote trägt seit heute Auszeichnung (fett/kursiv/Umbruch).
      // Vorher wurde JEDES Tag durch ein Leerzeichen ersetzt — bei tag-freien Fußnoten folgenlos,
      // bei ausgezeichneten aber nicht: aus „<em>Ventil V2</em>," wurde „Ventil V2 ,". Derselbe
      // Text hätte sich damit je nach Formatierung unterschieden, und eine Suche nach
      // „V2, sichtbar" hätte die formatierte Fußnote nicht mehr gefunden. Ein Umbruch IST eine
      // Wortgrenze und bleibt ein Leerzeichen; Auszeichnung ist keine und verschwindet spurlos.
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0 && !LEGACY_IMAGE_CAPTION_PLACEHOLDERS.includes(text)) {
      out.push({ imageId: anchorFromOpenTag(bodyHtml.slice(start, openEnd)), text });
    }
    cursor = close + CLOSE_TAG.length;
  }
  return out;
}

// Textprojektion derselben Einträge — EINE Scannerwahrheit, kein zweiter Durchlauf über den Body.
export function imageCaptionTexts(bodyHtml: string | null | undefined): string[] {
  return imageCaptionEntries(bodyHtml).map((entry) => entry.text);
}
