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
import {
  LEGACY_IMAGE_CAPTION_PLACEHOLDERS,
  blankLegacyCaptionPlaceholders,
  enhanceFiguresForEditing,
} from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

interface CaptionLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
}
interface DivLike {
  innerHTML: string;
  querySelector(selectors: string): CaptionLike | null;
  querySelectorAll(selectors: string): Iterable<{
    textContent: string | null;
    setAttribute(name: string, value: string): void;
  }>;
}
interface DocumentLike {
  createElement(tag: string): DivLike;
}

const doc = (globalThis as unknown as { document: DocumentLike }).document;
// WP-D10: der Import liefert die Fußnote LEER — das ist der Normalfall im Editor.
const FIGURE =
  '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-abc123-1"></figcaption></figure>';
// Altlast vor D10: der Platzhalter stand als ECHTER Text im Body — Migration leert ihn beim Verankern.
const LEGACY_FIGURE =
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

    // Nutzer klickt in die leere Fußnote und tippt echten Text.
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

// WP-D10 (Pedis Live-Befund nach Ship 4): ein Platzhalter ist KEIN Inhalt. Die Einladung ist ein
// VISUELLES Artefakt (data-kw-placeholder + CSS :empty::before) und kann unter keinen Umständen
// gespeichert werden; Alt-Platzhaltertexte werden beim Verankern geleert bzw. in der Anzeige wie leer
// behandelt.
describe("WP-D10: echter (visueller) Platzhalter statt Platzhalter-TEXT", () => {
  const PLACEHOLDER_TEXT = "✎ Bildbeschreibung hinzufügen …";

  it("enhance setzt data-kw-placeholder NUR editorseitig; beide Sanitizer strippen es beim Speichern", () => {
    const el = doc.createElement("div");
    el.innerHTML = FIGURE;
    enhanceFiguresForEditing(el, PLACEHOLDER_TEXT);
    expect(el.querySelector("figcaption")?.getAttribute("data-kw-placeholder")).toBe(
      PLACEHOLDER_TEXT,
    );
    // Speichern (emit = sanitizeHtml(innerHTML)) — der visuelle Platzhalter kann NIE persistieren:
    // die figcaption-Allowlist kennt nur data-image-id.
    for (const sanitize of [sanitizeHtml, serverSanitize]) {
      const saved = sanitize(el.innerHTML);
      expect(saved).not.toContain("data-kw-placeholder");
      expect(saved).not.toContain(PLACEHOLDER_TEXT);
      expect(saved).not.toContain("Bildbeschreibung hinzuf");
      expect(saved).toContain('<figcaption data-image-id="kw-img-abc123-1">');
    }
  });

  it("Altlast-Migration: exakt die drei alten Platzhaltertexte werden beim Verankern geleert", () => {
    for (const legacy of LEGACY_IMAGE_CAPTION_PLACEHOLDERS) {
      const el = doc.createElement("div");
      el.innerHTML = LEGACY_FIGURE.replace("Noch keine Bildbeschreibung", legacy);
      enhanceFiguresForEditing(el, PLACEHOLDER_TEXT);
      const caption = el.querySelector("figcaption");
      expect(caption?.textContent, legacy).toBe("");
      // Der Speicher-Roundtrip enthält den Alt-Text danach nicht mehr.
      expect(sanitizeHtml(el.innerHTML)).not.toContain(legacy);
    }
  });

  it("ECHTE Nutzer-Beschreibungen werden NICHT geleert (nur exakte Alt-Platzhalter)", () => {
    const el = doc.createElement("div");
    el.innerHTML = LEGACY_FIGURE.replace(
      "Noch keine Bildbeschreibung",
      "Noch keine Bildbeschreibung der Anlage 7",
    );
    enhanceFiguresForEditing(el, PLACEHOLDER_TEXT);
    expect(el.querySelector("figcaption")?.textContent).toBe(
      "Noch keine Bildbeschreibung der Anlage 7",
    );
  });

  it("Leseansicht-Transformation: blankLegacyCaptionPlaceholders leert NUR Alt-Platzhalter", () => {
    const legacy = serverSanitize(LEGACY_FIGURE);
    const blanked = blankLegacyCaptionPlaceholders(legacy);
    expect(blanked).not.toContain("Noch keine Bildbeschreibung");
    expect(blanked).toContain('<figcaption data-image-id="kw-img-abc123-1"></figcaption>');
    // Echte Beschreibung bleibt unangetastet.
    const real = serverSanitize(
      LEGACY_FIGURE.replace("Noch keine Bildbeschreibung", "Diagramm der Quartalszahlen"),
    );
    expect(blankLegacyCaptionPlaceholders(real)).toBe(real);
    // Und die Leseansicht (SanitizedHtml) nutzt genau diese Transformation.
    const cmp = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/SanitizedHtml.tsx"),
      "utf8",
    );
    expect(cmp).toContain("blankLegacyCaptionPlaceholders(sanitizeHtml(html))");
  });

  it("CSS-Pin: :empty::before rendert data-kw-placeholder, :focus blendet aus, Leseansicht versteckt leere Fußnoten", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/web/src/index.css"), "utf8");
    const emptyRuleStart = css.indexOf(
      '.prose-kw figcaption[contenteditable="true"]:empty::before',
    );
    expect(emptyRuleStart).toBeGreaterThan(0);
    const emptyRule = css.slice(emptyRuleStart, css.indexOf("}", emptyRuleStart));
    expect(emptyRule).toContain("content: attr(data-kw-placeholder)");
    const focusRuleStart = css.indexOf(
      '.prose-kw figcaption[contenteditable="true"]:focus::before',
    );
    expect(focusRuleStart).toBeGreaterThan(0);
    expect(css.slice(focusRuleStart, css.indexOf("}", focusRuleStart))).toContain("content: none");
    // Leseansicht: leere Fußnote (NICHT contenteditable) wird ausgeblendet — der Editor-Selektor
    // bleibt davon unberührt (:not-Guard).
    expect(css).toContain('.prose-kw figcaption:empty:not([contenteditable="true"])');
  });

  it("Editor-Verdrahtung: alle drei enhance-Aufrufe reichen den lokalisierten Platzhalter durch", () => {
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    const calls = src.match(/enhanceFiguresForEditing\([^)]*\)/g) ?? [];
    expect(calls.length).toBe(3);
    for (const call of calls) {
      expect(call).toContain('t("editor.captionPlaceholder")');
    }
  });
});
