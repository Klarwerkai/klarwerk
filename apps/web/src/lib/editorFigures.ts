// WP-D7/D7b (Befund 2 / Gelb-Fix 2): DOM-Hilfslogik für die Bild-Fußnoten im WYSIWYG-Editor. Browser
// behandeln ein <figure> mit <img> oft als atomaren Block, sodass der Klick nicht in den Fußnotentext
// gelangt. Deshalb wird im Editor gezielt verankert: das <img> ist NICHT editierbar (kein versehentliches
// Zerschneiden), die <figcaption> AUSDRÜCKLICH editierbar (klick- und tippbar). Diese contenteditable-
// Attribute sind reine Editier-UX; der Sanitizer entfernt sie beim Rausschreiben wieder (nicht in der
// Allowlist) → sie persistieren nie im gespeicherten bodyHtml.
//
// WP-D10 (Pedis Live-Befund nach Ship 4): ein Platzhalter ist KEIN Inhalt. Der Import schreibt die
// figcaption jetzt LEER; die Einladung „hier Beschreibung eintragen" ist ein RENDER-Artefakt: dieses
// Modul setzt editorseitig data-kw-placeholder (lokalisierter Text), das CSS zeigt ihn über
// figcaption:empty::before an (index.css). Das Attribut steht nicht in der Sanitizer-Allowlist
// (figcaption erlaubt NUR data-image-id) → es kann unter keinen Umständen gespeichert werden.
// Zusätzlich MIGRATION der Altlast: eine figcaption, deren Text EXAKT einem der drei früheren
// Platzhaltertexte entspricht, wird beim Verankern geleert (clientseitig, keine Server-Datenmigration).
//
// Bewusst DOM-lib-FREI typisiert (schmaler Struktur-Typ statt globalem HTMLElement): so lässt sich die
// Funktion im Gate-tsc (läuft ohne DOM-lib) mitprüfen und im jsdom-Test direkt aufrufen; der Editor reicht
// zur Laufzeit ein echtes HTMLElement, das diese Form strukturell erfüllt.

// WP-D10: die drei EXAKTEN Alt-Platzhaltertexte (DE/EN/NL des i18n-Keys capture.file.
// imageCaptionPlaceholder vor D10) — nur diese werden als „kein Inhalt" behandelt/geleert.
export const LEGACY_IMAGE_CAPTION_PLACEHOLDERS: readonly string[] = [
  "Noch keine Bildbeschreibung",
  "No image description yet",
  "Nog geen afbeeldingsbeschrijving",
];

interface EditableElement {
  textContent: string | null;
  setAttribute(name: string, value: string): void;
}

export interface EditableFigureRoot {
  querySelectorAll(selectors: string): Iterable<EditableElement>;
}

export function enhanceFiguresForEditing(
  root: EditableFigureRoot,
  captionPlaceholder?: string,
): void {
  for (const img of root.querySelectorAll("figure img")) {
    img.setAttribute("contenteditable", "false");
  }
  for (const caption of root.querySelectorAll("figure figcaption")) {
    caption.setAttribute("contenteditable", "true");
    // WP-D10 Altlast-Migration: exakt einer der drei alten Platzhaltertexte → leeren. Der Nutzer sieht
    // stattdessen den visuellen Platzhalter; gespeichert wird die Leere beim nächsten emit().
    const text = (caption.textContent ?? "").trim();
    if (LEGACY_IMAGE_CAPTION_PLACEHOLDERS.includes(text)) {
      caption.textContent = "";
    }
    // WP-D10: lokalisierten Einlade-Text als data-Attribut anheften — NUR editorseitig; das CSS
    // (index.css) rendert ihn bei :empty als ::before. Der Sanitizer strippt das Attribut beim Speichern.
    if (captionPlaceholder !== undefined) {
      caption.setAttribute("data-kw-placeholder", captionPlaceholder);
    }
  }
}

// WP-D10 (Leseansicht/Galerie): Alt-Platzhaltertexte in gespeichertem bodyHtml wie LEER behandeln —
// reine ANZEIGE-Transformation (keine Server-Datenmigration, keine Sanitizer-Änderung). Ersetzt den
// figcaption-Inhalt nur, wenn er exakt (modulo Whitespace) einem der drei Alt-Texte entspricht; die
// leere figcaption blendet das CSS (:empty) dann aus.
const LEGACY_CAPTION_RE = new RegExp(
  `(<figcaption\\b[^>]*>)\\s*(?:${LEGACY_IMAGE_CAPTION_PLACEHOLDERS.join("|")})\\s*(</figcaption>)`,
  "g",
);

export function blankLegacyCaptionPlaceholders(html: string): string {
  return html.replace(LEGACY_CAPTION_RE, "$1$2");
}
