import { describe, expect, it } from "vitest";
import { editorContentQuality } from "../../apps/web/src/lib/editorContentQuality";

// SCRUM-324: DOM-freie Inhaltsqualitäts-Signale (Struktur/Nachvollziehbarkeit, KEINE Validierung).
describe("SCRUM-324: editorContentQuality", () => {
  it("leerer Body → isEmpty, sonst alles false", () => {
    const q = editorContentQuality({ bodyHtml: "" });
    expect(q.isEmpty).toBe(true);
    expect(q.isThin).toBe(false);
    expect(q.hasHeadings).toBe(false);
    expect(q.hasLists).toBe(false);
    expect(q.hasBlocks).toBe(false);
    expect(q.hasLinks).toBe(false);
    expect(q.hasAttachments).toBe(false);
  });

  it("erkennt Überschriften (H2/H3)", () => {
    expect(editorContentQuality({ bodyHtml: "<h2>Titel</h2><p>Inhalt …</p>" }).hasHeadings).toBe(
      true,
    );
    expect(editorContentQuality({ bodyHtml: "<h3>Unter</h3>" }).hasHeadings).toBe(true);
    expect(editorContentQuality({ bodyHtml: "<p>kein Heading</p>" }).hasHeadings).toBe(false);
  });

  it("erkennt Listen", () => {
    expect(editorContentQuality({ bodyHtml: "<ul><li>a</li><li>b</li></ul>" }).hasLists).toBe(true);
    expect(editorContentQuality({ bodyHtml: "<ol><li>1</li></ol>" }).hasLists).toBe(true);
    expect(editorContentQuality({ bodyHtml: "<p>keine Liste</p>" }).hasLists).toBe(false);
  });

  it("erkennt Block-/Panel-Klassen", () => {
    expect(
      editorContentQuality({ bodyHtml: '<div class="panel panel-warning"><p>!</p></div>' })
        .hasBlocks,
    ).toBe(true);
    expect(editorContentQuality({ bodyHtml: "<p>kein Block</p>" }).hasBlocks).toBe(false);
  });

  it("erkennt Links", () => {
    expect(
      editorContentQuality({ bodyHtml: '<p>siehe <a href="/x">Quelle</a></p>' }).hasLinks,
    ).toBe(true);
    expect(editorContentQuality({ bodyHtml: "<p>kein Link</p>" }).hasLinks).toBe(false);
  });

  it("vorsichtige Dünn-Einschätzung bei sehr kurzem Inhalt", () => {
    expect(editorContentQuality({ bodyHtml: "<p>kurz</p>" }).isThin).toBe(true);
    const lang = `<p>${"Dies ist ein ausreichend langer Absatz mit echtem Inhalt und Kontext.".repeat(2)}</p>`;
    expect(editorContentQuality({ bodyHtml: lang }).isThin).toBe(false);
  });

  it("Attachments vorhanden, aber im Text nicht erwähnt → attachmentsUnreferenced", () => {
    const q = editorContentQuality({
      bodyHtml: "<p>Reiner Text ohne jeden Verweis auf etwas Angehängtes.</p>",
      attachments: [{ mime: "image/png" }],
    });
    expect(q.hasAttachments).toBe(true);
    expect(q.mentionsAttachments).toBe(false);
    expect(q.attachmentsUnreferenced).toBe(true);
  });

  it("Attachments vorhanden und im Text sinngemäß erwähnt → kein Hinweis", () => {
    const q = editorContentQuality({
      bodyHtml: "<p>Siehe das angehängte Bild zur Montage.</p>",
      attachments: [{ mime: "image/png" }],
    });
    expect(q.hasAttachments).toBe(true);
    expect(q.mentionsAttachments).toBe(true);
    expect(q.attachmentsUnreferenced).toBe(false);
  });

  it("ohne Attachments nie attachmentsUnreferenced", () => {
    expect(
      editorContentQuality({ bodyHtml: "<p>Text ohne Anhang.</p>", attachments: [] })
        .attachmentsUnreferenced,
    ).toBe(false);
  });

  it("robust gegen kaputten/harmlosen HTML-String (kein Crash)", () => {
    expect(() => editorContentQuality({ bodyHtml: "<p>unbalanced <strong>bold" })).not.toThrow();
    expect(() => editorContentQuality({ bodyHtml: "<<>><h2" })).not.toThrow();
    expect(() => editorContentQuality({ bodyHtml: null })).not.toThrow();
    expect(() => editorContentQuality({})).not.toThrow();
  });
});
