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
  type EditableElement,
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
// AUFTRAG-mega88 Block B: der schmale Typ folgt dem gewachsenen Vertrag von
// `enhanceFiguresForEditing` — seit der Bildstruktur-Invariante braucht die Funktion mehr als
// `textContent`/`setAttribute`. Statt die Liste hier zu WIEDERHOLEN (und beim nächsten Zuwachs
// erneut zu vergessen), wird der Element-Typ des Moduls benutzt; das jsdom-Element erfüllt ihn.
interface DivLike {
  innerHTML: string;
  querySelector(selectors: string): CaptionLike | null;
  querySelectorAll(selectors: string): Iterable<EditableElement>;
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

describe("WP-D7b: Bild-Fußnote im Editor verankert (jsdom)", () => {
  // AUFTRAG-mega84 Block A: die Fußnote war bis mega82 ein EIGENER Editing-Host
  // (contenteditable="true") — man klickte hinein und tippte. Genau das war Pedis Befund vom
  // 31.07.: es öffnete sich kein Formular, es gab keine Formatierung. Sie ist jetzt das Gegenteil:
  // nicht editierbar, aber als Bedienelement angekündigt und der Einstieg in das Formular.
  it("verankert die figcaption als BEDIENELEMENT (nicht editierbar) und img nicht editierbar", () => {
    const el = doc.createElement("div");
    el.innerHTML = FIGURE;
    enhanceFiguresForEditing(el, undefined, "Bildbeschreibung bearbeiten");

    expect(el.querySelector("img")?.getAttribute("contenteditable")).toBe("false");
    const caption = el.querySelector("figcaption");
    expect(caption?.getAttribute("contenteditable")).toBe("false");
    expect(caption?.getAttribute("role")).toBe("button");
    expect(caption?.getAttribute("tabindex")).toBe("0");
    expect(caption?.getAttribute("aria-label")).toBe("Bildbeschreibung bearbeiten");
    expect(caption?.getAttribute("data-kw-caption-open")).toBe("");
  });

  it("die Beschreibung überlebt den Sanitize-Roundtrip OHNE jedes Editor-Attribut", () => {
    const el = doc.createElement("div");
    el.innerHTML = FIGURE;
    enhanceFiguresForEditing(el, "✎ Bildbeschreibung hinzufügen …", "Bildbeschreibung bearbeiten");

    // Das Formular schreibt die Beschreibung in die Fußnote (applyCaptionHtml → innerHTML).
    const caption = el.querySelector("figcaption");
    if (!caption) {
      throw new Error("figcaption fehlt");
    }
    caption.textContent = "Diagramm der Quartalszahlen";

    // emit() = sanitizeHtml(innerHTML): Text und Anker bleiben, JEDES Editor-Attribut fliegt raus.
    // Das ist der Grund, warum die Bedienbarkeit nichts kostet: figcaption erlaubt nur data-image-id.
    const emitted = sanitizeHtml(el.innerHTML);
    expect(emitted).toContain("Diagramm der Quartalszahlen");
    expect(emitted).not.toContain("Noch keine Bildbeschreibung");
    for (const attr of [
      "contenteditable",
      "role=",
      "tabindex",
      "aria-label",
      "data-kw-caption-open",
      "data-kw-placeholder",
    ]) {
      expect(emitted, attr).not.toContain(attr);
    }
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
    enhanceFiguresForEditing(editor, undefined, "Bildbeschreibung bearbeiten");
    const caption = editor.querySelector("figcaption");
    if (!caption) {
      throw new Error("figcaption fehlt im Editor");
    }
    // AUFTRAG-mega84 Block A: verankert als BEDIENELEMENT, nicht mehr als Editing-Host.
    expect(caption.getAttribute("role")).toBe("button");
    expect(caption.getAttribute("contenteditable")).toBe("false");
    // 4) Das Formular schreibt die Beschreibung + onChange-Sanitize-Roundtrip (emit).
    caption.textContent = "Aufbau des Pruefstands";
    const emitted = sanitizeHtml(editor.innerHTML);
    expect(emitted).toContain("Aufbau des Pruefstands");
    expect(emitted).not.toContain("contenteditable");
    // 5) Reload-Zyklus (value → innerHTML erneut): Edit bleibt, Verankerung greift erneut.
    const editor2 = doc.createElement("div");
    editor2.innerHTML = sanitizeHtml(emitted);
    enhanceFiguresForEditing(editor2, undefined, "Bildbeschreibung bearbeiten");
    expect(editor2.querySelector("figcaption")?.textContent).toBe("Aufbau des Pruefstands");
    expect(editor2.querySelector("figcaption")?.getAttribute("role")).toBe("button");
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

  it("Affordanz-Pin: sichtbarer Bedien-Stil fuer die Fussnote im Editor, keine Unsichtbar-Regeln", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/web/src/index.css"), "utf8");
    // AUFTRAG-mega84 Block A: die Affordanz haengt am Editor-Marker, nicht mehr an contenteditable
    // — und sie verspricht ab jetzt einen KLICK (Zeiger), kein Tippen (Textcursor).
    const start = css.indexOf(".prose-kw figcaption[data-kw-caption-open] {");
    expect(start).toBeGreaterThanOrEqual(0);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain("cursor-pointer");
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

  it("CSS-Pin: :empty::before rendert data-kw-placeholder; die Leseansicht versteckt leere Fußnoten, der Editor NICHT", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/web/src/index.css"), "utf8");
    const emptyRuleStart = css.indexOf(".prose-kw figcaption[data-kw-caption-open]:empty::before");
    expect(emptyRuleStart).toBeGreaterThan(0);
    const emptyRule = css.slice(emptyRuleStart, css.indexOf("}", emptyRuleStart));
    expect(emptyRule).toContain("content: attr(data-kw-placeholder)");
    // AUFTRAG-mega84 Block A: die :focus::before-Regel ist ENTFALLEN. Sie blendete die Einladung
    // beim Fokus aus, weil man dann in ein Feld tippte — es gibt kein Feld mehr, in das man tippt,
    // und die Aufforderung „öffne das Formular" gilt auch mit Fokus weiter.
    expect(css).not.toContain(":focus::before");

    // DIE FALLE, die mega84 fast gestellt hätte: der Leseansicht-Guard hieß
    // `:not([contenteditable="true"])`. Die Fußnote im Editor trägt seit mega84
    // `contenteditable="false"` — sie hätte den Selektor ERFÜLLT und wäre samt Platzhalter und
    // Einstieg unsichtbar gewesen. Der Guard fragt deshalb nach dem Editor-Marker selbst.
    expect(css).toContain(".prose-kw figcaption:empty:not([data-kw-caption-open])");
    expect(css).not.toContain('figcaption:empty:not([contenteditable="true"])');
  });

  it("Editor-Verdrahtung: die Verankerung läuft über EINE Stelle, die Platzhalter UND Beschriftung durchreicht", () => {
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    // AUFTRAG-mega84 Block A: vorher standen drei Aufrufe nebeneinander, jeder mit seiner eigenen
    // Argumentliste — und jeder eine Gelegenheit, das zweite Argument zu vergessen (die Klasse, an
    // der mega50 entstanden ist). Es gibt jetzt EINE Stelle, an der die Argumente stehen.
    // Nicht `[^)]*`: die Argumente enthalten selbst Klammern (t(...)) — der alte Ausdruck hätte
    // mitten im ersten Argument aufgehört und die Beschriftung nie gesehen.
    const calls = src.match(/enhanceFiguresForEditing\([\s\S]*?\);/g) ?? [];
    expect(calls.length).toBe(1);
    for (const call of calls) {
      expect(call).toContain('t("editor.captionPlaceholder")');
      expect(call).toContain("CAPTION_AI_TEXT.captionOpenLabel");
    }
    // … und alle Verankerungswege gehen durch sie: externer Wertwechsel, execCommand-Einfügung
    // und das zuverlässige Range-Einfügen. Weniger als drei hieße, dass ein Weg wieder eine
    // unverankerte — und damit unbedienbare — Fußnote hinterlässt.
    expect((src.match(/verankereFiguren\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
