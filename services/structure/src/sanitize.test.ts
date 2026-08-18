import { describe, expect, it } from "vitest";
// JOB 509 / R2: die zweite Einheit der Ankerkette (Fußnoten-Scanner) wird hier mitgeprüft — die
// Paarung entsteht im Sanitizer und muss vom Scanner wieder auslesbar sein. Beide Einheiten liegen
// im selben Modul; der Schreibscope dieses Durchgangs umfasst nur diese Testdatei.
import { imageCaptionEntries, imageCaptionTexts } from "./captions";
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

  it("img data-kw-scale: nur feste Groessenwerte bleiben; style/Handler bleiben gesperrt", () => {
    expect(
      sanitizeHtml(
        '<img src="/api/objects/abc-1/raw" alt="x" data-kw-scale="75" style="width:1px" onload="x">',
      ),
    ).toBe('<img src="/api/objects/abc-1/raw" alt="x" data-kw-scale="75">');
    expect(sanitizeHtml('<img src="/api/objects/abc-1/raw" data-kw-scale="101">')).toBe(
      '<img src="/api/objects/abc-1/raw">',
    );
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

  it("SCRUM-467: escapt & nur einmal — kein &amp;amp; bei doppeltem Durchlauf (Tom & Jerry)", () => {
    const once = sanitizeHtml("Tom & Jerry");
    expect(once).toBe("Tom &amp; Jerry");
    // Zweiter Durchlauf (Server- + Client-Pass) darf nicht erneut escapen.
    const twice = sanitizeHtml(once);
    expect(twice).toBe(once);
    expect(twice).not.toContain("&amp;amp;");
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

describe("FMT-1: sanitizeHtml normalisiert Office-/Richtext-Paste autoritativ", () => {
  it("entfernt Office-Muell und erhaelt Formatierung + einfache Tabellen sicher", () => {
    const office = `
      <!--[if gte mso 9]><xml><w:WordDocument>noise</w:WordDocument></xml><![endif]-->
      <html xmlns:o="urn:schemas-microsoft-com:office:office"><body>
        <h1 class="MsoTitle" style="mso-margin-top-alt:auto">Titel<o:p>&nbsp;</o:p></h1>
        <p class="MsoNormal" style="mso-style-name:Standard">
          <b>fett</b>
          <i>kursiv</i>
          <span style="font-weight:700; mso-bidi-font-weight:normal">Span fett</span>
          <span style="font-style: italic">Span kursiv</span>
          <span style="text-decoration-line: underline">Span u</span>
        </p>
        <h4>Unter</h4>
        <table class="MsoTableGrid" style="border-collapse:collapse">
          <tr onclick="evil()"><td colspan="2" rowspan="3" style="width:10px">A</td><td colspan="x">B</td></tr>
        </table>
      </body></html>`;

    const clean = sanitizeHtml(office);
    expect(clean).toContain("<h2>Titel</h2>");
    expect(clean).toContain("<strong>fett</strong>");
    expect(clean).toContain("<em>kursiv</em>");
    expect(clean).toContain("<strong>Span fett</strong>");
    expect(clean).toContain("<em>Span kursiv</em>");
    expect(clean).toContain("<u>Span u</u>");
    expect(clean).toContain("<h3>Unter</h3>");
    expect(clean).toContain('<td colspan="2" rowspan="3">A</td>');
    expect(clean).toContain("<td>B</td>");
    expect(clean).not.toMatch(/mso-|style=|class=|<o:p|onclick/);
  });

  it("entfernt XSS und erlaubt keine neuen externen Bild-Hotlinks", () => {
    const clean = sanitizeHtml(
      '<p onclick="x()">ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="https://evil/x.png" alt="x">',
    );
    expect(clean).toBe('<p>ok</p><a rel="noopener noreferrer nofollow" target="_blank">x</a>');
  });
});

// JOB 509 / R2 (Figure-/Caption-Anker): Nach dem Sanitizing, erneutem Parsen und einem ZWEITEN
// Sanitizing muss die Paarung Figure ↔ Bild ↔ Fußnote eindeutig bleiben. Position allein darf nie
// Identität sein: zwei figures mit identischer Bildquelle UND identischem Fußnotentext sind sonst
// ununterscheidbar, sobald ein Zwischenschritt (Editor, Import, Byte-Budget) die Reihenfolge ändert.
// Der Anker ist ein tokenvalidiertes data-image-id — keine allgemeine Attributfreigabe.
const OBJ_SRC = "/api/objects/abc-1/raw";

function figureFragments(html: string): string[] {
  return [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
}

function openTagOf(fragment: string, tag: string): string | null {
  return new RegExp(`<${tag}\\b[^>]*>`).exec(fragment)?.[0] ?? null;
}

function anchorOf(fragment: string, tag: string): string | null {
  const open = openTagOf(fragment, tag);
  return open ? (/data-image-id="([^"]*)"/.exec(open)?.[1] ?? null) : null;
}

describe("JOB 509 / R2: sanitizeHtml verankert Figure/Bild/Fußnote eindeutig", () => {
  it("Gegenprobe 1: gleiche Bildquelle UND gleicher Fußnotentext → je figure ein EIGENER Anker", () => {
    const one = `<figure><img src="${OBJ_SRC}"><figcaption>Ventil</figcaption></figure>`;
    const clean = sanitizeHtml(`${one}${one}`);
    const figs = figureFragments(clean);
    expect(figs.length).toBe(2);
    const first = anchorOf(figs[0] ?? "", "img");
    const second = anchorOf(figs[1] ?? "", "img");
    // Beide figures sind verankert …
    expect(first).toMatch(/^[\w-]{1,64}$/);
    expect(second).toMatch(/^[\w-]{1,64}$/);
    // … mit UNTERSCHIEDLICHEN Ankern (sonst ist die Paarung nur Position).
    expect(first).not.toBe(second);
    // JOB 509 / D5: ALLE DREI Träger derselben figure teilen exakt denselben Anker.
    expect(anchorOf(figs[0] ?? "", "figcaption")).toBe(first);
    expect(anchorOf(figs[1] ?? "", "figcaption")).toBe(second);
    expect(anchorOf(figs[0] ?? "", "figure")).toBe(first);
    expect(anchorOf(figs[1] ?? "", "figure")).toBe(second);
  });

  // ── SHIP-12-BLOCKER, gemessen am 18.08.2026 ─────────────────────────────────────────────────
  //
  // DER FALL KOMMT AUS WORD, nicht aus einer Randbetrachtung: Word liefert regelmaessig EINE
  // figure mit ZWEI Bildern und EINER Fussnote. Bis heute bekam diese Gruppe EINEN Anker, der auf
  // ALLE Kinder geschrieben wurde — beide Bilder trugen danach `kw-fig-1`.
  //
  // Der Schaden entsteht erst eine Etage spaeter und war deshalb schwer zu finden: Der Editor macht
  // die Huelle flach (`editorFigures.ts`), respektiert dabei aber vorhandene Kennungen — zu Recht,
  // denn Ueberschreiben hat frueher Zuordnungen zerstoert. Er traegt die Doppelung also weiter, und
  // im Browser stehen zwei Bilder mit derselben Identitaet. Wer beide beschreibt, beschreibt am Ende
  // dasselbe, oder verliert eine Beschreibung beim Wiederoeffnen.
  //
  // Drei Browserfaelle haben das seit dem 15.08. gemeldet (huelle-tabelle, huelle2-reihenfolge,
  // mega89-mehrbild) und galten als "Bildkennungs-Defekt im Editor". Nachgemessen liegt die Ursache
  // hier, serverseitig: `data-image-id="kw-fig-1"` an beiden Bildern, vergeben vor jedem Editorlauf.
  //
  // ZWEI BILDER SIND ZWEI GEGENSTAENDE, auch in einer Huelle. Die Fussnote bleibt beim ersten: Bei
  // einer Fussnote und zwei Bildern ist nicht entscheidbar, welches sie beschreibt — sie an beide zu
  // haengen behauptete genau das fuer jedes von ihnen (dieselbe Regel wie in editorFigures.ts).
  it("Ship 12: ZWEI Bilder in EINER figure bekommen ZWEI verschiedene Anker", () => {
    const clean = sanitizeHtml(
      `<figure><img src="${OBJ_SRC}" alt="Schiene"><img src="${OBJ_SRC}" alt="Lager"><figcaption>Nur eine</figcaption></figure>`,
    );
    const bilder = [...clean.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(bilder.length).toBe(2);
    const ids = bilder.map((tag) => /data-image-id="([^"]*)"/.exec(tag)?.[1] ?? null);
    for (const id of ids) {
      expect(id).toMatch(/^[\w-]{1,64}$/);
    }
    expect(new Set(ids).size, "beide Bilder tragen dieselbe Identitaet").toBe(2);
    // Die Fussnote gehoert zum ERSTEN Bild — eine Zuordnung, nicht zwei Behauptungen.
    expect(anchorOf(clean, "figcaption")).toBe(ids[0]);
  });

  it("Ship 12: der Lauf ist idempotent — ein zweiter Durchgang verschiebt kein Byte", () => {
    const einmal = sanitizeHtml(
      `<figure><img src="${OBJ_SRC}" alt="A"><img src="${OBJ_SRC}" alt="B"><figcaption>X</figcaption></figure>`,
    );
    expect(sanitizeHtml(einmal)).toBe(einmal);
  });

  it("Gegenprobe 2: fehlende Fußnote → figure und Bild teilen trotzdem denselben Anker", () => {
    const clean = sanitizeHtml(`<figure><img src="${OBJ_SRC}"></figure>`);
    const id = anchorOf(clean, "img");
    expect(id).toMatch(/^[\w-]{1,64}$/);
    expect(anchorOf(clean, "figure")).toBe(id);
    expect(clean).not.toContain("<figcaption");
  });

  it("Gegenprobe 3: ungültiges Attribut → verworfen, aber ein gültiger Anker entsteht", () => {
    const clean = sanitizeHtml(
      `<figure data-image-id="böse id" onclick="x()" class="evil"><img src="${OBJ_SRC}" data-image-id="auch böse"><figcaption data-image-id="und böse">Text</figcaption></figure>`,
    );
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("class=");
    expect(clean).not.toContain("böse");
    const anchor = anchorOf(clean, "img");
    expect(anchor).toMatch(/^[\w-]{1,64}$/);
    expect(anchorOf(clean, "figcaption")).toBe(anchor);
    expect(anchorOf(clean, "figure")).toBe(anchor);
  });

  it("Gegenprobe 4: Skriptinhalt in der Fußnote fliegt raus, die Paarung bleibt", () => {
    const clean = sanitizeHtml(
      `<figure><img src="${OBJ_SRC}"><figcaption data-image-id="kw-img-1">Text<script>alert(1)</script></figcaption></figure>`,
    );
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert(1)");
    expect(clean).toContain("Text");
    // Der vorhandene Fußnoten-Anker führt und wird auf Bild UND Container übertragen.
    expect(anchorOf(clean, "img")).toBe("kw-img-1");
    expect(anchorOf(clean, "figcaption")).toBe("kw-img-1");
    expect(anchorOf(clean, "figure")).toBe("kw-img-1");
  });

  it("Gegenprobe 5: zweites Sanitizing ist byte-gleich und erhält die Paarung", () => {
    const dirty = `<figure><img src="${OBJ_SRC}"><figcaption>A</figcaption></figure><figure><img src="${OBJ_SRC}"><figcaption>A</figcaption></figure>`;
    const once = sanitizeHtml(dirty);
    const twice = sanitizeHtml(once);
    expect(twice).toBe(once);
    const figs = figureFragments(twice);
    const anchors = figs.map((f) => anchorOf(f, "img"));
    expect(new Set(anchors).size).toBe(2);
    expect(anchors.every((a) => a !== null)).toBe(true);
  });

  it("Gegenprobe 6: doppelt vergebener Anker wird vereindeutigt (Identität statt Kollision)", () => {
    const dup = `<figure><img src="${OBJ_SRC}" data-image-id="kw-img-1"><figcaption data-image-id="kw-img-1">A</figcaption></figure>`;
    const clean = sanitizeHtml(`${dup}${dup}`);
    const figs = figureFragments(clean);
    expect(figs.length).toBe(2);
    const first = anchorOf(figs[0] ?? "", "img");
    const second = anchorOf(figs[1] ?? "", "img");
    // Der erste Träger behält seinen Anker, der zweite bekommt einen frischen.
    expect(first).toBe("kw-img-1");
    expect(second).not.toBe("kw-img-1");
    expect(second).toMatch(/^[\w-]{1,64}$/);
    expect(anchorOf(figs[1] ?? "", "figcaption")).toBe(second);
    // Auch die Container sind eindeutig — kein Doppelanker über zwei figures hinweg.
    expect(anchorOf(figs[0] ?? "", "figure")).toBe(first);
    expect(anchorOf(figs[1] ?? "", "figure")).toBe(second);
  });

  it("eine im Eingang vorhandene figure-Ankerung überlebt und führt die Gruppe", () => {
    const clean = sanitizeHtml(
      `<figure data-image-id="kw-img-fuehrend"><img src="${OBJ_SRC}"><figcaption data-image-id="kw-img-alt">A</figcaption></figure>`,
    );
    expect(anchorOf(clean, "figure")).toBe("kw-img-fuehrend");
    expect(anchorOf(clean, "img")).toBe("kw-img-fuehrend");
    expect(anchorOf(clean, "figcaption")).toBe("kw-img-fuehrend");
  });

  it("Sicherheitsgrenze: figure bekommt KEINE allgemeine Attributfreigabe", () => {
    const clean = sanitizeHtml(
      `<figure style="color:red" onclick="x()" id="f1" class="panel"><img src="${OBJ_SRC}"></figure>`,
    );
    const open = openTagOf(clean, "figure") ?? "";
    expect(open).not.toContain("style");
    expect(open).not.toContain("onclick");
    expect(open).not.toContain("class=");
    // Eigenständiges id-Attribut (nicht das Teilstück in data-image-id) bleibt gesperrt.
    expect(open).not.toMatch(/\sid=/);
    // Genau ein erlaubtes Attribut am Container: der Anker.
    expect(open).toMatch(/^<figure data-image-id="[\w-]{1,64}">$/);
  });

  // JOB 509 / D5 (BEN-D3-Mangel 1, BEN-D4-Pflicht 5): Der Vertrag ist der DREIFACHANKER. Der frühere
  // D3-Pin („figure bleibt attributfrei") war die eigenmächtige Zielverengung und wird hier durch die
  // Auftragswahrheit ersetzt: auch ein im Eingang unverankerter Container wird verankert.
  it("Dreifachanker: figure, Bild und Fußnote tragen denselben gültigen Token", () => {
    const clean = sanitizeHtml(`<figure><img src="${OBJ_SRC}"><figcaption>A</figcaption></figure>`);
    const id = anchorOf(clean, "figure");
    expect(id).toMatch(/^[\w-]{1,64}$/);
    expect(anchorOf(clean, "img")).toBe(id);
    expect(anchorOf(clean, "figcaption")).toBe(id);
    // Genau drei Tokenvorkommen — je Träger eines.
    expect(clean.split(`data-image-id="${id}"`).length - 1).toBe(3);
    // Der unverankerte Container existiert nach dem Sanitizing nicht mehr.
    expect(clean).not.toContain("<figure>");
  });

  it("Dreifachanker bleibt über ein zweites Server-Sanitizing byte-stabil", () => {
    const once = sanitizeHtml(`<figure><img src="${OBJ_SRC}"><figcaption>A</figcaption></figure>`);
    const twice = sanitizeHtml(once);
    expect(twice).toBe(once);
    const id = anchorOf(twice, "figure");
    expect(anchorOf(twice, "img")).toBe(id);
    expect(anchorOf(twice, "figcaption")).toBe(id);
  });

  it("lose Anker außerhalb einer figure werden nicht erfunden", () => {
    expect(sanitizeHtml(`<img src="${OBJ_SRC}">`)).toBe(`<img src="${OBJ_SRC}">`);
    expect(sanitizeHtml("<figcaption>frei</figcaption>")).toBe("<figcaption>frei</figcaption>");
  });
});

// JOB 509 / R2, zweite Einheit: Der Fußnoten-Scanner muss die im Sanitizer gesetzte Identität
// wieder herausgeben — sonst endet die Ankerkette an der Persistenzgrenze und die Suche/Galerie
// müsste erneut über die Position raten. Der bestehende Textvertrag (imageCaptionTexts) bleibt
// unverändert; die Paarung kommt als zusätzliche, ehrliche Ausgabe dazu (kein geratener Anker).
describe("JOB 509 / R2: imageCaptionEntries gibt die Paarung Anker ↔ Fußnotentext zurück", () => {
  const twoEqual = `<figure><img src="${OBJ_SRC}"><figcaption>Ventil</figcaption></figure><figure><img src="${OBJ_SRC}"><figcaption>Ventil</figcaption></figure>`;

  it("gleiche Fußnotentexte, verschiedene Anker → eindeutige Zuordnung nach dem Sanitizing", () => {
    const body = sanitizeHtml(twoEqual);
    const entries = imageCaptionEntries(body);
    expect(entries.map((e) => e.text)).toEqual(["Ventil", "Ventil"]);
    const ids = entries.map((e) => e.imageId);
    expect(ids.every((id) => id !== null)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    // Die Anker des Scanners sind exakt die Anker der zugehörigen Bilder.
    const imgAnchors = figureFragments(body).map((f) => anchorOf(f, "img"));
    expect(ids).toEqual(imgAnchors);
  });

  it("Fußnote ohne Anker → imageId null (ehrlich, nicht geraten)", () => {
    expect(imageCaptionEntries("<figcaption>frei</figcaption>")).toEqual([
      { imageId: null, text: "frei" },
    ]);
  });

  it("ungültiges Anker-Token im Rohbody → imageId null, Text bleibt", () => {
    expect(imageCaptionEntries('<figcaption data-image-id="böse id">Text</figcaption>')).toEqual([
      { imageId: null, text: "Text" },
    ]);
  });

  it("Textvertrag unverändert: leere Fußnoten und Alt-Platzhalter fallen weiterhin weg", () => {
    const body = `<figure><figcaption data-image-id="kw-img-1"></figcaption></figure><figure><figcaption data-image-id="kw-img-2">Noch keine Bildbeschreibung</figcaption></figure><figure><figcaption data-image-id="kw-img-3">Echt</figcaption></figure>`;
    expect(imageCaptionEntries(body)).toEqual([{ imageId: "kw-img-3", text: "Echt" }]);
    expect(imageCaptionTexts(body)).toEqual(["Echt"]);
  });

  it("imageCaptionTexts bleibt die Textprojektion derselben Einträge (eine Wahrheit)", () => {
    const body = sanitizeHtml(twoEqual);
    expect(imageCaptionTexts(body)).toEqual(imageCaptionEntries(body).map((e) => e.text));
  });
});

describe("KW-STR: htmlToPlainText", () => {
  it("entfernt Tags + Entities, normalisiert Whitespace", () => {
    expect(htmlToPlainText("<h2>Titel</h2><p>Text&amp;mehr</p>")).toBe("Titel Text&mehr");
    expect(htmlToPlainText("<ul><li>A</li><li>B</li></ul>")).toBe("A B");
    expect(htmlToPlainText("")).toBe("");
  });
});
