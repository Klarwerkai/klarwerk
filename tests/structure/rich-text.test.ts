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

  // Formatierung Stufe 2: Tabellen aus Import/Paste bleiben erhalten (Struktur), colspan/rowspan
  // nur numerisch; kein style/Handler/Script überlebt in Zellen.
  it("Tabellen: table/tr/th/td bleiben; colspan nur numerisch; script in Zelle raus", () => {
    const table =
      '<table><thead><tr><th colspan="2">Kopf</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
    const clean = sanitizeHtml(table);
    expect(clean).toContain("<table>");
    expect(clean).toContain('<th colspan="2">Kopf</th>');
    expect(clean).toContain("<td>A</td>");
    expect(sanitizeHtml('<table><tr><td colspan="x">Z</td></tr></table>')).toBe(
      "<table><tr><td>Z</td></tr></table>",
    );
    expect(sanitizeHtml("<table><tr><td>ok<script>evil()</script></td></tr></table>")).toBe(
      "<table><tr><td>ok</td></tr></table>",
    );
  });

  // Formatierung Stufe 2 (Paste-Normalisierer): style-basiertes Fett/Kursiv/Unterstrichen aus Word/
  // Browser wird auf semantische Tags abgebildet; reine Farb-Spans bleiben ohne Formatierung.
  it("Paste-Normalisierer: font-weight/-style/-decoration → strong/em/u; sonst Span verworfen", () => {
    expect(sanitizeHtml('<span style="font-weight:700">fett</span>')).toBe("<strong>fett</strong>");
    expect(sanitizeHtml('<span style="font-weight: bold">fett</span>')).toBe(
      "<strong>fett</strong>",
    );
    expect(sanitizeHtml('<span style="font-style: italic">kursiv</span>')).toBe("<em>kursiv</em>");
    expect(sanitizeHtml('<span style="text-decoration: underline">u</span>')).toBe("<u>u</u>");
    // reine Farbe = keine Formatierung → Span verworfen, Text bleibt.
    expect(sanitizeHtml('<span style="color:red">rot</span>')).toBe("rot");
    // Word-typisch: Fett-Span im Absatz.
    expect(sanitizeHtml('<p><span style="font-weight:700">Titel</span></p>')).toBe(
      "<p><strong>Titel</strong></p>",
    );
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

// SCRUM-458 (Formatierungs-Erhaltung, Client-Spiegel des Server-Sanitizers): Fett/Kursiv/
// Überschriften aus Word/Browser-Paste bleiben durch Tag-Abbildung erhalten (kein style/Tabellen).
describe("SCRUM-458 FE: sanitizeHtml erhält Formatierung durch Tag-Abbildung", () => {
  it("b→strong, i→em, h1/h4→h2/h3 (offen und schließend)", () => {
    expect(sanitizeHtml("<b>fett</b> <i>kursiv</i>")).toBe("<strong>fett</strong> <em>kursiv</em>");
    expect(sanitizeHtml("<h1>Titel</h1><h4>Unter</h4>")).toBe("<h2>Titel</h2><h3>Unter</h3>");
    expect(sanitizeHtml("<b>a <i>b</i></b>")).toBe("<strong>a <em>b</em></strong>");
  });

  it("Sicherheit bleibt: style/Skript raus; Tabellen als Struktur erhalten (Stufe 2)", () => {
    expect(sanitizeHtml('<b style="color:red">t</b>')).toBe("<strong>t</strong>");
    // Formatierung Stufe 2: Tabellen bleiben jetzt als Struktur ERHALTEN (Details im Tabellen-Test oben).
    expect(sanitizeHtml("<table><tr><td>Z</td></tr></table>")).toBe(
      "<table><tr><td>Z</td></tr></table>",
    );
  });
});
