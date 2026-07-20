// WP-D7/D7b (Befund 2 / Gelb-Fix 2): DOM-Hilfslogik für die Bild-Fußnoten im WYSIWYG-Editor. Browser
// behandeln ein <figure> mit <img> oft als atomaren Block, sodass der Klick nicht in den Fußnotentext
// gelangt. Deshalb wird im Editor gezielt verankert: das <img> ist NICHT editierbar (kein versehentliches
// Zerschneiden), die <figcaption> AUSDRÜCKLICH editierbar (klick- und tippbar). Diese contenteditable-
// Attribute sind reine Editier-UX; der Sanitizer entfernt sie beim Rausschreiben wieder (nicht in der
// Allowlist) → sie persistieren nie im gespeicherten bodyHtml.
//
// Bewusst DOM-lib-FREI typisiert (schmaler Struktur-Typ statt globalem HTMLElement): so lässt sich die
// Funktion im Gate-tsc (läuft ohne DOM-lib) mitprüfen und im jsdom-Test direkt aufrufen; der Editor reicht
// zur Laufzeit ein echtes HTMLElement, das diese Form strukturell erfüllt.
interface EditableElement {
  setAttribute(name: string, value: string): void;
}

export interface EditableFigureRoot {
  querySelectorAll(selectors: string): Iterable<EditableElement>;
}

export function enhanceFiguresForEditing(root: EditableFigureRoot): void {
  for (const img of root.querySelectorAll("figure img")) {
    img.setAttribute("contenteditable", "false");
  }
  for (const caption of root.querySelectorAll("figure figcaption")) {
    caption.setAttribute("contenteditable", "true");
  }
}
