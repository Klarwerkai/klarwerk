// @vitest-environment jsdom
// WP-D7b (Gelb-Fix 2) + WP-D8 (Pedis Live-ROT A): ECHTER DOM-Test (jsdom, nur für diese Datei aktiviert —
// die Test-Infra läuft sonst im node-Environment). enhanceFiguresForEditing verankert im Editor-Element die
// figcaption editierbar und das img nicht editierbar; anschließend überlebt eine editierte Fußnote den
// Sanitize-Roundtrip (emit) OHNE contenteditable-Attribute. WP-D8 ergänzt den ECHTEN Front-Door-Zyklus
// (Server-Sanitizer → Draft-Payload → Client-Sanitizer → Editor) und pinnt den Fokus-Guard + die Affordanz.
//
// Hinweise: (1) jsdom implementiert isContentEditable NICHT (liefert undefined) — daher prüfen wir das
// gesetzte contenteditable-Attribut, genau das, was der Editor an den echten Browser gibt und was der
// Sanitizer beim Speichern wieder entfernt. (2) Der Gate-tsc läuft ohne DOM-lib; das zur Laufzeit von der
// jsdom-Umgebung bereitgestellte document greifen wir über einen schmalen, DOM-lib-freien Typ ab.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import { frontDoorBodyFromDraft } from "../../apps/web/src/lib/captureFrontDoor";
import { enhanceFiguresForEditing } from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

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

// WP-D8 (Pedis Live-ROT A): der ECHTE Front-Door-Zyklus. Das Word-bodyHtml wird beim Ganzdokument-Import
// serverseitig sanitisiert im Draft gespeichert, die Front Door lädt es via frontDoorBodyFromDraft, der
// RichTextEditor setzt sanitizeHtml(value) als innerHTML in den contenteditable-Container und verankert.
describe("WP-D8: echter Front-Door-Zyklus (Server-Sanitize → Draft → Editor)", () => {
  it("figcaption ueberlebt die komplette Kette, ist verankert editierbar und Edits ueberleben den Roundtrip", () => {
    // 1) Import-Ergebnis (BILD-1a/1b) → Server-Sanitizer beim Draft-Speichern.
    const saved = serverSanitize(`<p>Kapitel 1</p>${FIGURE}`);
    // 2) Front Door lädt den Draft.
    const bodyHtml = frontDoorBodyFromDraft({ bodyHtml: saved } as DraftPayload);
    expect(bodyHtml).toContain("<figcaption");
    // 3) RichTextEditor: contenteditable-Container + sanitisiertes innerHTML + Verankerung.
    const editor = doc.createElement("div");
    editor.innerHTML = sanitizeHtml(bodyHtml);
    enhanceFiguresForEditing(editor);
    const caption = editor.querySelector("figcaption");
    if (!caption) {
      throw new Error("figcaption fehlt im Editor");
    }
    expect(caption.getAttribute("contenteditable")).toBe("true");
    // 4) Simuliertes Tippen in die Fußnote + onChange-Sanitize-Roundtrip (emit).
    caption.textContent = "Aufbau des Pruefstands";
    const emitted = sanitizeHtml(editor.innerHTML);
    expect(emitted).toContain("Aufbau des Pruefstands");
    expect(emitted).not.toContain("contenteditable");
    // 5) Reload-Zyklus (value → innerHTML erneut): Edit bleibt, Verankerung greift erneut.
    const editor2 = doc.createElement("div");
    editor2.innerHTML = sanitizeHtml(emitted);
    enhanceFiguresForEditing(editor2);
    expect(editor2.querySelector("figcaption")?.textContent).toBe("Aufbau des Pruefstands");
    expect(editor2.querySelector("figcaption")?.getAttribute("contenteditable")).toBe("true");
  });

  it("Fokus-Guard-Pin: der Editor prueft contains(activeElement), nicht Identitaet (Ursache von ROT A)", () => {
    // Die figcaption ist ein EIGENER Editing-Host: beim Klick hinein wird SIE document.activeElement.
    // Der alte Guard (activeElement !== el) hielt den Editor dann fuer unfokussiert und schrieb bei jedem
    // Tastendruck das innerHTML neu (Caret zerstoert). Gepinnt: contains-Guard drin, Identitaets-Guard raus.
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    expect(src).toContain("!el.contains(document.activeElement)");
    expect(src).not.toContain("document.activeElement !== el");
  });

  it("Affordanz-Pin: sichtbarer Editier-Stil fuer die Fussnote im Editor, keine Unsichtbar-Regeln", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/web/src/index.css"), "utf8");
    // Eigene Editor-Affordanz (greift nur, wenn die Verankerung contenteditable=true gesetzt hat).
    const start = css.indexOf('.prose-kw figcaption[contenteditable="true"]');
    expect(start).toBeGreaterThanOrEqual(0);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain("cursor-text");
    expect(rule).toContain("border-dashed");
    expect(rule).toContain("min-h-");
    // Keine Regel macht die Fußnote unsichtbar/unklickbar.
    const base = css.indexOf(".prose-kw figcaption {");
    const baseRule = css.slice(base, css.indexOf("}", base));
    for (const bad of ["hidden", "display: none", "pointer-events", "user-select", "h-0"]) {
      expect(baseRule).not.toContain(bad);
      expect(rule).not.toContain(bad);
    }
  });
});
