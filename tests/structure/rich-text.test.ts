import { describe, expect, it } from "vitest";
import {
  htmlToPlainText,
  insertImageHtml,
  isEmptyHtml,
  sanitizeHtml,
} from "../../apps/web/src/lib/richText";

describe("KW-STR FE: sanitizeHtml (Defense-in-Depth, gleiche Allowlist)", () => {
  it("behält Allowlist, entfernt script-Inhalt + on*-Handler + style", () => {
    expect(sanitizeHtml("<h2>T</h2><p>x</p>")).toBe("<h2>T</h2><p>x</p>");
    expect(sanitizeHtml('<p onclick="x" style="y">a</p><script>b</script>')).toBe("<p>a</p>");
  });

  it("img: object-raw/sichere data:image-Raster; SVG + fremde URL verworfen", () => {
    expect(sanitizeHtml('<img src="/api/objects/x-1/raw" alt="a">')).toContain(
      "/api/objects/x-1/raw",
    );
    expect(sanitizeHtml('<img src="data:image/webp;base64,AAAA">')).toContain("data:image/webp");
    expect(sanitizeHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=">')).toBe("");
    expect(sanitizeHtml('<img src="https://evil/x">')).toBe("");
  });

  it("schließt offene Tags + ist idempotent", () => {
    const once = sanitizeHtml("<p>a<strong>b");
    expect(once).toBe("<p>a<strong>b</strong></p>");
    expect(sanitizeHtml(once)).toBe(once);
  });
});

describe("KW-STR FE: Editor-Helfer", () => {
  it("htmlToPlainText liefert reinen Text", () => {
    expect(htmlToPlainText("<h2>Titel</h2><p>Inhalt&amp;mehr</p>")).toBe("Titel Inhalt&mehr");
  });

  it("isEmptyHtml erkennt leeren vs. Bild-/Text-Inhalt", () => {
    expect(isEmptyHtml("")).toBe(true);
    expect(isEmptyHtml("<p></p>")).toBe(true);
    expect(isEmptyHtml("<p>x</p>")).toBe(false);
    expect(isEmptyHtml('<p></p><img src="/api/objects/a/raw">')).toBe(false);
  });

  it("insertImageHtml baut sicheres img-Markup auf den Object-Store", () => {
    expect(insertImageHtml("abc-1", 'A"B')).toBe(
      '<img src="/api/objects/abc-1/raw" alt="A&quot;B">',
    );
  });
});
