import { describe, expect, it } from "vitest";
import { confluenceStorageToHtml } from "./storage";

// SCRUM-470: der Reducer rettet Makro-Nutztext; sanitizeHtml (nachgelagert) sichert ab. Kernregel in
// allen Fällen: der lesbare Text darf nie verloren gehen, und es dürfen keine ac:/ri:-Tags übrig sein.
function noMacroTags(html: string): boolean {
  return !/<\/?(ac|ri):/.test(html);
}

describe("confluenceStorageToHtml (S2)", () => {
  it("Info-Panel → blockquote mit erhaltenem Text", () => {
    const out = confluenceStorageToHtml(
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Bitte zuerst entlüften.</p></ac:rich-text-body></ac:structured-macro>',
    );
    expect(out).toContain("<blockquote>");
    expect(out).toContain("Bitte zuerst entlüften.");
    expect(noMacroTags(out)).toBe(true);
  });

  it("Code-Makro (CDATA) → <pre> mit escaptem Text", () => {
    const out = confluenceStorageToHtml(
      '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">bash</ac:parameter><ac:plain-text-body><![CDATA[if a < b then echo x]]></ac:plain-text-body></ac:structured-macro>',
    );
    expect(out).toContain("<pre>");
    expect(out).toContain("if a &lt; b then echo x"); // escaped, kein rohes <
    expect(out).not.toContain("language"); // ac:parameter (Konfig) verworfen
    expect(noMacroTags(out)).toBe(true);
  });

  it("Link → Linktext bleibt erhalten", () => {
    const out = confluenceStorageToHtml(
      '<ac:link><ri:page ri:content-title="Wartungsplan"/><ac:link-body>Zum Wartungsplan</ac:link-body></ac:link>',
    );
    expect(out).toContain("Zum Wartungsplan");
    expect(noMacroTags(out)).toBe(true);
  });

  it("Link ohne Body → content-title als Text", () => {
    const out = confluenceStorageToHtml(
      '<ac:link><ri:page ri:content-title="Wartungsplan"/></ac:link>',
    );
    expect(out).toContain("Wartungsplan");
    expect(noMacroTags(out)).toBe(true);
  });

  it("Bild mit Anhang → [Bild: filename]", () => {
    const out = confluenceStorageToHtml(
      '<ac:image ac:height="200"><ri:attachment ri:filename="pumpe.png"/></ac:image>',
    );
    expect(out).toContain("[Bild: pumpe.png]");
    expect(noMacroTags(out)).toBe(true);
  });

  it("Aufgabenliste → <ul>/<li>", () => {
    const out = confluenceStorageToHtml(
      "<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>Ventil prüfen</ac:task-body></ac:task><ac:task><ac:task-body>Dichtung tauschen</ac:task-body></ac:task></ac:task-list>",
    );
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>Ventil prüfen</li>");
    expect(out).toContain("<li>Dichtung tauschen</li>");
    expect(noMacroTags(out)).toBe(true);
  });

  it("unbekanntes Makro → Inhalt entpackt, Text erhalten, kein Wrapper", () => {
    const out = confluenceStorageToHtml(
      '<ac:structured-macro ac:name="expand"><ac:rich-text-body><p>Versteckter Hinweis</p></ac:rich-text-body></ac:structured-macro>',
    );
    expect(out).toContain("Versteckter Hinweis");
    expect(out).not.toContain("blockquote"); // kein Panel
    expect(noMacroTags(out)).toBe(true);
  });

  it("Layout-Wrapper werden gestrippt, Inhalt bleibt", () => {
    const out = confluenceStorageToHtml(
      "<ac:layout><ac:layout-section><ac:layout-cell><p>Zelleninhalt</p></ac:layout-cell></ac:layout-section></ac:layout>",
    );
    expect(out).toContain("<p>Zelleninhalt</p>");
    expect(noMacroTags(out)).toBe(true);
  });

  it("normales XHTML bleibt unangetastet", () => {
    const out = confluenceStorageToHtml("<p>Einfacher Absatz</p><ul><li>A</li></ul>");
    expect(out).toBe("<p>Einfacher Absatz</p><ul><li>A</li></ul>");
  });
});
