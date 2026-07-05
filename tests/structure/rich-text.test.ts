import { describe, expect, it } from "vitest";
import {
  htmlToPlainText,
  insertImageHtml,
  insertImageSrcHtml,
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

  it("SCRUM-314: erlaubt Block-Klassen panel-info/note/warning/success, verwirft fremde + on*/style", () => {
    for (const v of ["info", "note", "warning", "success"]) {
      const html = `<div class="panel panel-${v}"><p>x</p></div>`;
      expect(sanitizeHtml(html)).toBe(html);
    }
    // panel bleibt erhalten, fremde Klasse + Handler + style raus.
    expect(sanitizeHtml('<div class="panel panel-evil" onclick="x" style="y"><p>a</p></div>')).toBe(
      '<div class="panel"><p>a</p></div>',
    );
    // reine Fremdklasse → kein class-Attribut.
    expect(sanitizeHtml('<div class="evil"><p>a</p></div>')).toBe("<div><p>a</p></div>");
  });

  it("SCRUM-438: Herkunfts-Marker panel-external überlebt die Sanitisierung", () => {
    const html = '<div class="panel panel-external"><p>x</p></div>';
    expect(sanitizeHtml(html)).toBe(html);
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

  it("insertImageSrcHtml baut img-Markup für sichere lokale Raster-Data-URLs", () => {
    const html = insertImageSrcHtml("data:image/png;base64,AAAA", 'A"B');
    expect(html).toBe('<img src="data:image/png;base64,AAAA" alt="A&quot;B">');
    expect(sanitizeHtml(html)).toContain("data:image/png;base64,AAAA");
  });
});
