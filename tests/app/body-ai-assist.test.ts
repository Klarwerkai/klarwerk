import { describe, expect, it } from "vitest";
import {
  applyBodyAssist,
  bodyTextForAssist,
  suggestionToBodyHtml,
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
