import { describe, expect, it } from "vitest";
import {
  applyBodyFileLink,
  editorFilesFromAttachments,
  fileLinkHtml,
  objectRawHref,
} from "../../apps/web/src/lib/bodyFileLink";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitizeHtml } from "../../services/structure/src/sanitize";

// SCRUM-355 / FR-STR-02 / G-P1-1: sichere Body-Datei-Referenz über den Object-Store (kein data-URL).
describe("SCRUM-355: bodyFileLink — sichere Datei-Referenz", () => {
  it("objectRawHref akzeptiert nur Object-Store-IDs und liefert sonst null", () => {
    expect(objectRawHref("obj-123")).toBe("/api/objects/obj-123/raw");
    expect(objectRawHref("  ABC_9  ")).toBe("/api/objects/ABC_9/raw");
    expect(objectRawHref("../etc/passwd")).toBeNull();
    expect(objectRawHref("a/b")).toBeNull();
    expect(objectRawHref("")).toBeNull();
    expect(objectRawHref(null)).toBeNull();
  });

  it("fileLinkHtml baut div.attachment > a(href=raw, title=name) > name; ohne objectId → ''", () => {
    expect(fileLinkHtml({ objectId: "obj-1", name: "Handbuch.pdf" })).toBe(
      '<div class="attachment"><a href="/api/objects/obj-1/raw" title="Handbuch.pdf">Handbuch.pdf</a></div>',
    );
    // Gefährlicher Name wird escapt; keine aktiven Tags/Attribute.
    expect(fileLinkHtml({ objectId: "obj-2", name: '<b>x</b>"&' })).toBe(
      '<div class="attachment"><a href="/api/objects/obj-2/raw" title="&lt;b&gt;x&lt;/b&gt;&quot;&amp;">&lt;b&gt;x&lt;/b&gt;&quot;&amp;</a></div>',
    );
    expect(fileLinkHtml({ objectId: "", name: "x" })).toBe("");
    expect(fileLinkHtml({ objectId: "../evil", name: "x" })).toBe("");
  });

  it("applyBodyFileLink: leerer Body setzt, vorhandener hängt an, ohne objectId = No-Op", () => {
    expect(applyBodyFileLink("", { objectId: "obj-1", name: "a.pdf" })).toContain(
      'class="attachment"',
    );
    expect(applyBodyFileLink("<p>alt</p>", { objectId: "obj-1", name: "a.pdf" })).toBe(
      '<p>alt</p><div class="attachment"><a href="/api/objects/obj-1/raw" title="a.pdf">a.pdf</a></div>',
    );
    expect(applyBodyFileLink("<p>alt</p>", { objectId: "", name: "a.pdf" })).toBe("<p>alt</p>");
  });

  it("editorFilesFromAttachments: nur Nicht-Bild MIT gültiger objectId", () => {
    const files = editorFilesFromAttachments([
      { name: "skizze.png", mime: "image/png", objectId: "img-1" }, // Bild → raus
      { name: "doc.pdf", mime: "application/pdf", objectId: "file-1" }, // ok
      { name: "lokal.txt", mime: "text/plain", objectId: null }, // ohne objectId → raus
      { name: "boese", mime: "application/pdf", objectId: "../x" }, // ungültige ID → raus
    ]);
    expect(files).toEqual([{ objectId: "file-1", name: "doc.pdf", mime: "application/pdf" }]);
  });
});

describe("SCRUM-355: Sanitizer FE+Server behalten attachment-Link, strippen Gefährliches", () => {
  const fileLink = fileLinkHtml({ objectId: "obj-9", name: "Plan.pdf" });

  it("sichere Datei-Referenz übersteht FE- und Server-Sanitizer unverändert (Klasse + Raw-Href)", () => {
    for (const sanitize of [sanitizeHtml, serverSanitizeHtml]) {
      const out = sanitize(fileLink);
      expect(out).toContain('class="attachment"');
      expect(out).toContain('href="/api/objects/obj-9/raw"');
      // Links werden mit Schutz geöffnet.
      expect(out).toContain('rel="noopener noreferrer nofollow"');
    }
  });

  it("javascript:-Link wird entwertet, fremde div-Klassen entfernt (FE + Server)", () => {
    const evil =
      '<div class="attachment evilclass"><a href="javascript:alert(1)" title="x">x</a></div>';
    for (const sanitize of [sanitizeHtml, serverSanitizeHtml]) {
      const out = sanitize(evil);
      expect(out.toLowerCase()).not.toContain("javascript:");
      expect(out).not.toContain("evilclass");
      // Die schmale attachment-Klasse bleibt erlaubt.
      expect(out).toContain('class="attachment"');
    }
  });
});

describe("SCRUM-355: KO-Detail-kompatibler Flow (Attachments → Datei-Link → Server-Sanitizer)", () => {
  it("nur die Nicht-Bild-Datei mit objectId wird verlinkbar und übersteht den Server-Sanitizer", () => {
    // So leitet KO-Detail die verlinkbaren Dateien aus den KO-Attachments ab.
    const attachments = [
      { name: "Foto.jpg", mime: "image/jpeg", objectId: "img-7" }, // Bild → eingebettet, nicht hier
      { name: "Norm.pdf", mime: "application/pdf", objectId: "file-7" }, // verlinkbar
    ];
    const files = editorFilesFromAttachments(attachments);
    expect(files).toHaveLength(1);
    const file = files[0];
    if (!file) {
      throw new Error("erwartete verlinkbare Datei fehlt");
    }

    // Datei in einen bestehenden Body einfügen (wie der Paperclip-Insert im Editor).
    const body = applyBodyFileLink("<h2>Norm-Hinweis</h2>", file);
    // Server-autoritativer Sanitizer (vor Persistenz) hält den sicheren Link.
    const stored = serverSanitizeHtml(body);
    expect(stored).toContain("<h2>Norm-Hinweis</h2>");
    expect(stored).toContain('href="/api/objects/file-7/raw"');
    expect(stored).toContain('class="attachment"');
    expect(stored).toContain("Norm.pdf");
    expect(stored.toLowerCase()).not.toContain("data:");
  });

  it("Capture-Session ohne objectId ergibt ehrlich keine verlinkbaren Dateien", () => {
    // Capture-Session-Dateien haben (noch) keine objectId → bewusst keine Fake-Links.
    const sessionFiles = editorFilesFromAttachments([
      { name: "entwurf.docx", mime: "application/vnd.openxmlformats", objectId: null },
    ]);
    expect(sessionFiles).toEqual([]);
  });
});
