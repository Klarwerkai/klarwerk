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

// ---- WP-RETEST7 R2 (Pedis Befund: Fußnote verschwindet beim Leeren des Textes) ----
//
// Zwei Editier-Kanten der figcaption:
//  (a) Löscht der Nutzer den GESAMTEN Text, lassen Browser oft einen <br>-Rest zurück — die
//      figcaption ist dann nicht :empty, der data-kw-placeholder-Platzhalter erscheint NICHT und
//      das Element wirkt „verschwunden". normalizeEmptyCaption macht sie WIRKLICH leer (Element
//      bleibt, der Aufrufer hält das Caret darin).
//  (b) Backspace/Delete in einer LEEREN figcaption (bzw. Backspace am Fußnoten-ANFANG) würde das
//      Element löschen oder mit dem Nachbarn mergen — shouldBlockCaptionDeletion sagt dem Editor,
//      wann er preventDefault ziehen muss (die figcaption gehört strukturell zur figure).

export interface CaptionNodeLike {
  textContent: string | null;
  childNodes: { length: number };
}

// Nur-Whitespace-/Nur-<br>-Fußnote auf WIRKLICH leer normalisieren. true = normalisiert (der
// Aufrufer setzt das Caret zurück in die Fußnote).
export function normalizeEmptyCaption(caption: CaptionNodeLike): boolean {
  const empty = (caption.textContent ?? "").trim().length === 0;
  if (empty && caption.childNodes.length > 0) {
    caption.textContent = "";
    return true;
  }
  return false;
}

// Muss der Editor diese Lösch-Taste in der Fußnote blocken? Leere Fußnote: es gibt nichts zu
// löschen — jede Backspace/Delete würde nur das Element/die Struktur angreifen. Nicht-leere
// Fußnote: nur der kollabierte Backspace am ANFANG (er würde nach außen mergen).
export function shouldBlockCaptionDeletion(
  caption: Pick<CaptionNodeLike, "textContent">,
  key: string,
  atStart: boolean,
  collapsed: boolean,
): boolean {
  if (key !== "Backspace" && key !== "Delete") {
    return false;
  }
  if ((caption.textContent ?? "").trim().length === 0) {
    return true;
  }
  return key === "Backspace" && collapsed && atStart;
}
