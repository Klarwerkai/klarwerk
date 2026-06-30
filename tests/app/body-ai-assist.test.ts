import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  applyBodyAssist,
  applyBodyAssistBlock,
  applyBodyAssistSection,
  bodyAssistBlockActions,
  bodyAssistStructuredActions,
  bodyTextForAssist,
  suggestionToBodyBlockHtml,
  suggestionToBodyHtml,
  suggestionToBodySectionHtml,
} from "../../apps/web/src/lib/bodyAiAssist";

// SCRUM-315: DOM-freie Helfer für die KI-Nachbearbeitung des ausführlichen Inhalts (bodyHtml).
// Sicherheit (sanitizeHtml-Pfad) + saubere Leerbehandlung + bewusste Übernahme (replace/append).
describe("SCRUM-315: bodyAiAssist", () => {
  it("bodyTextForAssist leitet reinen Text aus dem Body ab; leer → ''", () => {
    expect(bodyTextForAssist("<h2>Titel</h2><p>Inhalt&amp;mehr</p>")).toBe("Titel Inhalt&mehr");
    expect(bodyTextForAssist("")).toBe("");
    expect(bodyTextForAssist(null)).toBe("");
    expect(bodyTextForAssist(undefined)).toBe("");
  });

  it("suggestionToBodyHtml: Absätze + Zeilenumbrüche, leer → ''", () => {
    expect(suggestionToBodyHtml("Erster Absatz.\n\nZweiter Absatz.")).toBe(
      "<p>Erster Absatz.</p><p>Zweiter Absatz.</p>",
    );
    expect(suggestionToBodyHtml("Zeile eins\nZeile zwei")).toBe("<p>Zeile eins<br>Zeile zwei</p>");
    expect(suggestionToBodyHtml("")).toBe("");
    expect(suggestionToBodyHtml("   \n  ")).toBe("");
    expect(suggestionToBodyHtml(null)).toBe("");
  });

  it("suggestionToBodyHtml escaped Plaintext vor dem sanitizeHtml-Pfad", () => {
    const out = suggestionToBodyHtml("a < b & c");
    expect(out).toBe("<p>a &lt; b &amp; c</p>");
    // script-/Handler-artiger Text im Plaintext darf nur Text, kein aktives Markup werden.
    const danger = suggestionToBodyHtml("<script>alert(1)</script>");
    expect(danger).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    const handler = suggestionToBodyHtml("text <img src=x onerror=alert(1)>");
    expect(handler).toBe("<p>text &lt;img src=x onerror=alert(1)&gt;</p>");
    expect(handler).not.toContain("<img");
  });

  it("applyBodyAssist replace ersetzt durch sicheren Vorschlag", () => {
    expect(applyBodyAssist("replace", "<p>alt</p>", "Neu eins.\n\nNeu zwei.")).toBe(
      "<p>Neu eins.</p><p>Neu zwei.</p>",
    );
  });

  it("applyBodyAssist append hängt an bestehenden Body an", () => {
    expect(applyBodyAssist("append", "<p>alt</p>", "Zusatz.")).toBe("<p>alt</p><p>Zusatz.</p>");
    // leerer Body → nur Vorschlag.
    expect(applyBodyAssist("append", "", "Erster.")).toBe("<p>Erster.</p>");
    expect(applyBodyAssist("append", "<p></p>", "Erster.")).toBe("<p>Erster.</p>");
  });

  it("applyBodyAssist: leerer Vorschlag ist No-Op (zerstört Body nicht)", () => {
    expect(applyBodyAssist("replace", "<p>alt</p>", "")).toBe("<p>alt</p>");
    expect(applyBodyAssist("append", "<p>alt</p>", "   ")).toBe("<p>alt</p>");
    expect(applyBodyAssist("replace", "<p>alt</p>", null)).toBe("<p>alt</p>");
  });

  it("bestehender (bereits sanitisierter) Body wird beim Anhängen nicht doppelt escaped", () => {
    // Body mit Entity bleibt unverändert; nur der neue Vorschlag wird sanitisiert.
    expect(applyBodyAssist("append", "<p>a &amp; b</p>", "c")).toBe("<p>a &amp; b</p><p>c</p>");
  });
});

// SCRUM-316: Vorschlag bewusst als Body-Block (Info/Hinweis/Warnung/Erfolg) anhängen.
describe("SCRUM-316: bodyAiAssist Block-Übernahme", () => {
  it("suggestionToBodyBlockHtml nutzt nur sichere statische Klassen + escapten Text", () => {
    expect(suggestionToBodyBlockHtml("info", "Hinweistext")).toBe(
      '<div class="panel panel-info"><p>Hinweistext</p></div>',
    );
    expect(suggestionToBodyBlockHtml("warning", "Zeile eins\nZeile zwei")).toBe(
      '<div class="panel panel-warning"><p>Zeile eins<br>Zeile zwei</p></div>',
    );
    expect(suggestionToBodyBlockHtml("success", "Eins.\n\nZwei.")).toBe(
      '<div class="panel panel-success"><p>Eins.</p><p>Zwei.</p></div>',
    );
  });

  it("Block-Helfer escaped gefährlichen Plaintext (kein aktives HTML, keine fremden Klassen)", () => {
    const out = suggestionToBodyBlockHtml("note", "<script>alert(1)</script>");
    expect(out).toBe(
      '<div class="panel panel-note"><p>&lt;script&gt;alert(1)&lt;/script&gt;</p></div>',
    );
    expect(out).not.toContain("<script");
    // <img …> aus Modelltext darf kein aktives Tag werden (nur escapter Text).
    expect(suggestionToBodyBlockHtml("note", "<img src=x onerror=alert(1)>")).toBe(
      '<div class="panel panel-note"><p>&lt;img src=x onerror=alert(1)&gt;</p></div>',
    );
  });

  it("leerer Vorschlag → '' (kein leerer Block)", () => {
    expect(suggestionToBodyBlockHtml("info", "")).toBe("");
    expect(suggestionToBodyBlockHtml("info", "   \n ")).toBe("");
    expect(suggestionToBodyBlockHtml("info", null)).toBe("");
  });

  it("applyBodyAssistBlock hängt Block an; leerer Body → nur Block; leerer Vorschlag = No-Op", () => {
    expect(applyBodyAssistBlock("<p>alt</p>", "Achtung.", "warning")).toBe(
      '<p>alt</p><div class="panel panel-warning"><p>Achtung.</p></div>',
    );
    expect(applyBodyAssistBlock("", "Erster.", "info")).toBe(
      '<div class="panel panel-info"><p>Erster.</p></div>',
    );
    expect(applyBodyAssistBlock("<p></p>", "Erster.", "info")).toBe(
      '<div class="panel panel-info"><p>Erster.</p></div>',
    );
    expect(applyBodyAssistBlock("<p>alt</p>", "", "info")).toBe("<p>alt</p>");
    expect(applyBodyAssistBlock("<p>alt</p>", "   ", "success")).toBe("<p>alt</p>");
  });

  it("bestehender Body wird beim Block-Anhängen nicht doppelt escaped", () => {
    expect(applyBodyAssistBlock("<p>a &amp; b</p>", "c", "info")).toBe(
      '<p>a &amp; b</p><div class="panel panel-info"><p>c</p></div>',
    );
  });
});

// SCRUM-337: gebündelte Block-Übernahme-Aktionen (vom Knowledge Input Studio + Capture/KO-Detail genutzt).
describe("SCRUM-337: bodyAssistBlockActions", () => {
  it("liefert genau die vier Body-Blocktypen mit stabilen labelKeys", () => {
    const actions = bodyAssistBlockActions("");
    expect(actions.map((a) => a.labelKey)).toEqual([
      "capture.ai.applyAs.info",
      "capture.ai.applyAs.note",
      "capture.ai.applyAs.warning",
      "capture.ai.applyAs.success",
    ]);
  });

  it("apply hängt den Vorschlag als sicheren Block an den aktuellen Body an", () => {
    const actions = bodyAssistBlockActions("<p>vorhandener Text</p>");
    const warn = actions.find((a) => a.labelKey === "capture.ai.applyAs.warning");
    expect(warn?.apply("", "Achtung")).toBe(
      '<p>vorhandener Text</p><div class="panel panel-warning"><p>Achtung</p></div>',
    );
  });

  it("Studio-i18n (open/title/subtitle/apply/cancel/close) DE+EN vorhanden", () => {
    const keys = [
      "studio.open",
      "studio.title",
      "studio.subtitle",
      "studio.apply",
      "studio.cancel",
      "studio.close",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});

// SCRUM-343: KI-Vorschlag als strukturierter Abschnitt (Überschrift + Absätze) + gebündelte Modi.
describe("SCRUM-343: bodyAiAssist section mode", () => {
  it("suggestionToBodySectionHtml: erste Zeile → H3, Rest → escapte Absätze", () => {
    expect(suggestionToBodySectionHtml("Titel\nErster Absatz.\n\nZweiter Absatz.")).toBe(
      "<h3>Titel</h3><p>Erster Absatz.</p><p>Zweiter Absatz.</p>",
    );
    // nur eine Zeile → reine Überschrift.
    expect(suggestionToBodySectionHtml("Nur ein Titel")).toBe("<h3>Nur ein Titel</h3>");
  });

  it("suggestionToBodySectionHtml: escaped gefährliche Eingaben, leer → ''", () => {
    expect(suggestionToBodySectionHtml("<script>x</script>\nb & c")).toBe(
      "<h3>&lt;script&gt;x&lt;/script&gt;</h3><p>b &amp; c</p>",
    );
    expect(suggestionToBodySectionHtml("")).toBe("");
    expect(suggestionToBodySectionHtml("   \n ")).toBe("");
    expect(suggestionToBodySectionHtml(null)).toBe("");
  });

  it("applyBodyAssistSection: leerer Body setzt, vorhandener hängt an, leerer Vorschlag = No-Op", () => {
    expect(applyBodyAssistSection("", "Titel\nText.")).toBe("<h3>Titel</h3><p>Text.</p>");
    expect(applyBodyAssistSection("<p></p>", "Titel")).toBe("<h3>Titel</h3>");
    expect(applyBodyAssistSection("<p>alt</p>", "Titel\nText.")).toBe(
      "<p>alt</p><h3>Titel</h3><p>Text.</p>",
    );
    expect(applyBodyAssistSection("<p>alt</p>", "")).toBe("<p>alt</p>");
  });

  it("bodyAssistStructuredActions: Abschnitt zuerst, dann die vier Blöcke", () => {
    const actions = bodyAssistStructuredActions("<p>x</p>");
    expect(actions.map((a) => a.labelKey)).toEqual([
      "capture.ai.applyAs.section",
      "capture.ai.applyAs.info",
      "capture.ai.applyAs.note",
      "capture.ai.applyAs.warning",
      "capture.ai.applyAs.success",
    ]);
    const section = actions[0];
    expect(section?.apply("", "Titel\nText.")).toBe("<p>x</p><h3>Titel</h3><p>Text.</p>");
  });

  it("i18n (applyAsLabel + applyAs.section) DE+EN vorhanden", () => {
    for (const key of ["capture.ai.applyAsLabel", "capture.ai.applyAs.section"]) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});
