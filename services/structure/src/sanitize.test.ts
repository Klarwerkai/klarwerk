import { describe, expect, it } from "vitest";
import { htmlToPlainText, sanitizeHtml } from "./sanitize";

describe("KW-STR / NFR-SEC-04: sanitizeHtml", () => {
  it("behält erlaubte Tags + Struktur", () => {
    const html =
      "<h2>Titel</h2><p>Text <strong>fett</strong> <em>kursiv</em></p><ul><li>A</li></ul>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("entfernt script/style/iframe inklusive Inhalt (kein Text-Leak)", () => {
    expect(sanitizeHtml("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
    expect(sanitizeHtml("<style>x{color:red}</style><p>ok</p>")).toBe("<p>ok</p>");
    expect(sanitizeHtml('<iframe src="evil">drin</iframe><p>ok</p>')).toBe("<p>ok</p>");
    // unbalanciertes script verwirft auch den Rest
    expect(sanitizeHtml("<p>ok</p><script>noch offen")).toBe("<p>ok</p>");
  });

  it("entfernt on*-Handler und style-Attribute", () => {
    expect(sanitizeHtml('<p onclick="evil()" style="color:red">x</p>')).toBe("<p>x</p>");
    expect(sanitizeHtml('<a href="/y" onmouseover="bad()">l</a>')).toContain('href="/y"');
    expect(sanitizeHtml('<a href="/y" onmouseover="bad()">l</a>')).not.toContain("onmouseover");
  });

  it("href: kein javascript:, sichere Schemes bleiben; Link bekommt rel/target", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a rel="noopener noreferrer nofollow" target="_blank">x</a>',
    );
    const safe = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(safe).toContain('href="https://example.com"');
    expect(safe).toContain('rel="noopener noreferrer nofollow"');
    expect(safe).toContain('target="_blank"');
  });

  it("img src: object-raw oder sichere data:image-Rastertypen, sonst verworfen", () => {
    expect(sanitizeHtml('<img src="/api/objects/abc-1/raw" alt="x">')).toBe(
      '<img src="/api/objects/abc-1/raw" alt="x">',
    );
    for (const mime of ["png", "jpeg", "jpg", "gif", "webp"]) {
      expect(sanitizeHtml(`<img src="data:image/${mime};base64,AAAA" alt="y">`)).toContain(
        `data:image/${mime}`,
      );
    }
    expect(sanitizeHtml('<img src="https://evil/x.png">')).toBe("");
    expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe("");
  });

  it("NFR-SEC-04: data:image/svg+xml wird abgelehnt (SVG kann Skripte tragen)", () => {
    expect(sanitizeHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="z">')).toBe("");
    expect(sanitizeHtml('<img src="data:image/svg+xml;utf8,<svg onload=alert(1)>" alt="z">')).toBe(
      "",
    );
  });

  it("div nur als panel/callout-Container", () => {
    expect(sanitizeHtml('<div class="panel">P</div>')).toBe('<div class="panel">P</div>');
    expect(sanitizeHtml('<div class="evil">P</div>')).toBe("<div>P</div>");
  });

  it("ist idempotent", () => {
    const dirty = '<p onclick="x">a<script>b</script></p><img src="https://evil/x">';
    const once = sanitizeHtml(dirty);
    expect(sanitizeHtml(once)).toBe(once);
  });

  it("toleriert malformed HTML ohne zu crashen + schließt offene Tags", () => {
    expect(sanitizeHtml("<p>unbalanced <strong>bold")).toBe(
      "<p>unbalanced <strong>bold</strong></p>",
    );
    expect(sanitizeHtml("<<>><p>x</p>")).toContain("<p>x</p>");
    expect(sanitizeHtml("")).toBe("");
  });

  it("escapt nackten Text mit < & >", () => {
    expect(sanitizeHtml("a < b & c")).toBe("a &lt; b &amp; c");
  });
});

describe("KW-STR: htmlToPlainText", () => {
  it("entfernt Tags + Entities, normalisiert Whitespace", () => {
    expect(htmlToPlainText("<h2>Titel</h2><p>Text&amp;mehr</p>")).toBe("Titel Text&mehr");
    expect(htmlToPlainText("<ul><li>A</li><li>B</li></ul>")).toBe("A B");
    expect(htmlToPlainText("")).toBe("");
  });
});
