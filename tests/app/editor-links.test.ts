import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { editorLinkHtml, normalizeEditorLinkUrl } from "../../apps/web/src/lib/editorLinks";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";

describe("SCRUM-322: editor links", () => {
  it("normalizes bare domains to https links", () => {
    expect(normalizeEditorLinkUrl("klarwerk.example")).toBe("https://klarwerk.example");
    expect(editorLinkHtml({ url: "klarwerk.example", label: "Klarwerk" })).toBe(
      '<a href="https://klarwerk.example">Klarwerk</a>',
    );
  });

  it("allows https, mailto, internal routes and anchors", () => {
    expect(normalizeEditorLinkUrl("https://example.test/a")).toBe("https://example.test/a");
    expect(normalizeEditorLinkUrl("mailto:test@example.test")).toBe("mailto:test@example.test");
    expect(normalizeEditorLinkUrl("/wissen/ko-1")).toBe("/wissen/ko-1");
    expect(normalizeEditorLinkUrl("#quelle")).toBe("#quelle");
  });

  it("rejects unsafe protocols and whitespace URLs", () => {
    expect(normalizeEditorLinkUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeEditorLinkUrl("data:text/html,hi")).toBeNull();
    expect(normalizeEditorLinkUrl("https://example.test/a b")).toBeNull();
    expect(editorLinkHtml({ url: "javascript:alert(1)", label: "x" })).toBeNull();
  });

  it("escapes label and remains compatible with the sanitizer", () => {
    const html = editorLinkHtml({ url: "https://example.test", label: "<b>Quelle</b>" });
    expect(html).toBe('<a href="https://example.test">&lt;b&gt;Quelle&lt;/b&gt;</a>');
    expect(sanitizeHtml(html ?? "")).toContain('rel="noopener noreferrer nofollow"');
  });

  it("has German and English inline panel copy", () => {
    for (const lng of ["de", "en"]) {
      for (const key of [
        "editor.linkUrl",
        "editor.linkLabel",
        "editor.linkInsert",
        "editor.linkCancel",
        "editor.linkInvalid",
      ]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "")).not.toBe("");
      }
    }
  });
});
