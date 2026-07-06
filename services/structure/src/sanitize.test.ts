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

  it("SCRUM-314: erlaubt sichere Block-Varianten, verwirft fremde Klassen + on*/style", () => {
    for (const v of ["info", "note", "warning", "success"]) {
      const html = `<div class="panel panel-${v}">P</div>`;
      expect(sanitizeHtml(html)).toBe(html);
    }
    // panel bleibt, fremde Variante + Handler + style raus.
    expect(sanitizeHtml('<div class="panel panel-evil" onclick="x" style="y">P</div>')).toBe(
      '<div class="panel">P</div>',
    );
  });

  it("SCRUM-438: Herkunfts-Marker panel-external überlebt die Sanitisierung", () => {
    const html = '<div class="panel panel-external"><p>x</p></div>';
    expect(sanitizeHtml(html)).toBe(html);
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

// SCRUM-458 (Formatierungs-Erhaltung): Beim Einfügen aus Word/Browser kommende semantische
// Formatier-Tags werden auf das erlaubte Äquivalent abgebildet statt verworfen — Fett/Kursiv/
// Überschriften bleiben erhalten. Sicherheit unangetastet: kein style, kein Skript, keine Tabellen.
describe("SCRUM-458: sanitizeHtml erhält Formatierung durch Tag-Abbildung", () => {
  it("bildet Fett/Kursiv auf strong/em ab (offen UND schließend)", () => {
    expect(sanitizeHtml("<b>fett</b>")).toBe("<strong>fett</strong>");
    expect(sanitizeHtml("<i>kursiv</i>")).toBe("<em>kursiv</em>");
    expect(sanitizeHtml("<p>a <b>fett</b> und <i>kursiv</i></p>")).toBe(
      "<p>a <strong>fett</strong> und <em>kursiv</em></p>",
    );
  });

  it("normalisiert Überschriften h1/h4–h6 auf die erlaubten h2/h3", () => {
    expect(sanitizeHtml("<h1>Titel</h1>")).toBe("<h2>Titel</h2>");
    expect(sanitizeHtml("<h4>Unter</h4>")).toBe("<h3>Unter</h3>");
    expect(sanitizeHtml("<h5>x</h5><h6>y</h6>")).toBe("<h3>x</h3><h3>y</h3>");
  });

  it("verschachtelte abgebildete Tags schließen korrekt (Stack bleibt konsistent)", () => {
    expect(sanitizeHtml("<b>fett <i>beides</i></b>")).toBe("<strong>fett <em>beides</em></strong>");
  });

  it("Sicherheit unangetastet: style/Skript raus; Tabellen als Struktur erhalten (Stufe 2)", () => {
    // style wird weiter entfernt (auch am abgebildeten Tag).
    expect(sanitizeHtml('<b style="color:red" onclick="x()">t</b>')).toBe("<strong>t</strong>");
    // Formatierung Stufe 2: Tabellen bleiben jetzt als Struktur ERHALTEN (eigener Tabellen-Test oben).
    expect(sanitizeHtml("<table><tr><td>Zelle</td></tr></table>")).toBe(
      "<table><tr><td>Zelle</td></tr></table>",
    );
    // script bleibt komplett verworfen.
    expect(sanitizeHtml("<b>ok</b><script>alert(1)</script>")).toBe("<strong>ok</strong>");
  });
});

// Formatierung Stufe 2 (autoritativ am Server): Tabellen aus Import/Paste bleiben als Struktur
// erhalten; colspan/rowspan nur numerisch; kein style/Handler/Script überlebt.
describe("Formatierung Stufe 2: sanitizeHtml erhält Tabellen", () => {
  it("erhält table/thead/tbody/tr/th/td + numerisches colspan; verwirft nicht-numerisches; script raus", () => {
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
});

// Formatierung Stufe 2 (Paste-Normalisierer, autoritativ): style-basiertes Fett/Kursiv/Unterstrichen
// aus Word/Browser wird auf semantische Tags abgebildet; reine Farb-Spans bleiben ohne Formatierung.
describe("Formatierung Stufe 2: sanitizeHtml normalisiert style-basierte Formatierung", () => {
  it("font-weight/-style/-decoration → strong/em/u; reine Farbe → Span verworfen", () => {
    expect(sanitizeHtml('<span style="font-weight:700">fett</span>')).toBe("<strong>fett</strong>");
    expect(sanitizeHtml('<span style="font-weight: bold">fett</span>')).toBe(
      "<strong>fett</strong>",
    );
    expect(sanitizeHtml('<span style="font-style: italic">kursiv</span>')).toBe("<em>kursiv</em>");
    expect(sanitizeHtml('<span style="text-decoration: underline">u</span>')).toBe("<u>u</u>");
    expect(sanitizeHtml('<span style="color:red">rot</span>')).toBe("rot");
    expect(sanitizeHtml('<p><span style="font-weight:700">Titel</span></p>')).toBe(
      "<p><strong>Titel</strong></p>",
    );
  });
});

describe("KW-STR: htmlToPlainText", () => {
  it("entfernt Tags + Entities, normalisiert Whitespace", () => {
    expect(htmlToPlainText("<h2>Titel</h2><p>Text&amp;mehr</p>")).toBe("Titel Text&mehr");
    expect(htmlToPlainText("<ul><li>A</li><li>B</li></ul>")).toBe("A B");
    expect(htmlToPlainText("")).toBe("");
  });
});
