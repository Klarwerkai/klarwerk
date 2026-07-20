// @vitest-environment jsdom
// WP-D7b (Gelb-Fix 2): ECHTER DOM-Test (jsdom, nur für diese Datei aktiviert — die Test-Infra läuft sonst
// im node-Environment). enhanceFiguresForEditing verankert im Editor-Element die figcaption editierbar und
// das img nicht editierbar; anschließend überlebt eine editierte Fußnote den Sanitize-Roundtrip (emit) OHNE
// contenteditable-Attribute.
//
// Hinweise: (1) jsdom implementiert isContentEditable NICHT (liefert undefined) — daher prüfen wir das
// gesetzte contenteditable-Attribut, genau das, was der Editor an den echten Browser gibt und was der
// Sanitizer beim Speichern wieder entfernt. (2) Der Gate-tsc läuft ohne DOM-lib; das zur Laufzeit von der
// jsdom-Umgebung bereitgestellte document greifen wir über einen schmalen, DOM-lib-freien Typ ab.
import { describe, expect, it } from "vitest";
import { enhanceFiguresForEditing } from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";

interface CaptionLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
}
interface DivLike {
  innerHTML: string;
  querySelector(selectors: string): CaptionLike | null;
  querySelectorAll(
    selectors: string,
  ): Iterable<{ setAttribute(name: string, value: string): void }>;
}
interface DocumentLike {
  createElement(tag: string): DivLike;
}

const doc = (globalThis as unknown as { document: DocumentLike }).document;
const FIGURE =
  '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-abc123-1">Noch keine Bildbeschreibung</figcaption></figure>';

describe("WP-D7b: Bild-Fußnote im Editor editierbar (jsdom)", () => {
  it("verankert figcaption editierbar und img nicht editierbar", () => {
    const el = doc.createElement("div");
    el.innerHTML = FIGURE;
    enhanceFiguresForEditing(el);

    expect(el.querySelector("img")?.getAttribute("contenteditable")).toBe("false");
    expect(el.querySelector("figcaption")?.getAttribute("contenteditable")).toBe("true");
  });

  it("editierte Caption überlebt den Sanitize-Roundtrip OHNE contenteditable-Attribute", () => {
    const el = doc.createElement("div");
    el.innerHTML = FIGURE;
    enhanceFiguresForEditing(el);

    // Nutzer klickt in die Fußnote und ersetzt den Platzhalter durch echten Text.
    const caption = el.querySelector("figcaption");
    if (!caption) {
      throw new Error("figcaption fehlt");
    }
    caption.textContent = "Diagramm der Quartalszahlen";

    // emit() = sanitizeHtml(innerHTML): neuer Text bleibt, Anker bleibt, contenteditable fliegt raus.
    const emitted = sanitizeHtml(el.innerHTML);
    expect(emitted).toContain("Diagramm der Quartalszahlen");
    expect(emitted).not.toContain("Noch keine Bildbeschreibung");
    expect(emitted).not.toContain("contenteditable");
    expect(emitted).toContain('data-image-id="kw-img-abc123-1"');
    expect(emitted).toContain("<figure>");
    expect(emitted).toContain("<figcaption");
  });
});
