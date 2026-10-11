// ================================================================================================
// R-1624 · „… und baut daraus ein Wissensobjekt mit Bild-Anker" — der Rumpf, den das Foto-Interview
// in den Entwurf schreibt.
// ================================================================================================
//
//   A1  Der Bild-Anker ist ein `<figure>` mit dem Foto und dem Befund als Fußnote — dieselbe
//       Bauform wie jedes andere Bild (BILD-1a), also überlebt er den Sanitizer unverändert.
//   A2  Ein unsicheres Bild ergibt KEIN Markup; Nutzertext wird nie als HTML wirksam.
//   A3  Die Wissensseite trägt Fehlerbild, vermutete Ursache und Lösung aus den Antworten.
//   A4  Nichts wird überschrieben: Anker und Seite werden an vorhandenen Inhalt angehängt.
import { describe, expect, it } from "vitest";
import {
  type FotoAnker,
  MAX_FOTO_BEFUND,
  applyFotoAnker,
  applyFotoArtikel,
  fotoAnkerHtml,
  fotoArtikelHtml,
  fotoStartbereit,
  normalizeFotoBefund,
} from "../../apps/web/src/lib/fotoInterview";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";

// Ein 1×1-PNG — erfunden, keine Echtdaten.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const FOTO: FotoAnker = { dataUrl: PNG, befund: "Kehlnaht am Stahlträger, Riss am Nahtübergang." };

describe("R-1624 A1 · der Bild-Anker", () => {
  it("figure + img (das Foto) + figcaption (der Befund)", () => {
    const html = fotoAnkerHtml(FOTO);
    expect(html.startsWith("<figure>")).toBe(true);
    expect(html).toContain(`src="${PNG}"`);
    expect(html).toContain('alt="Kehlnaht am Stahlträger, Riss am Nahtübergang."');
    expect(html).toContain(
      "<figcaption>Kehlnaht am Stahlträger, Riss am Nahtübergang.</figcaption>",
    );
  });

  it("überlebt den Sanitizer des Editors unverändert (kein zweiter Bildvertrag)", () => {
    const html = fotoAnkerHtml(FOTO);
    expect(sanitizeHtml(html)).toBe(html);
  });
});

describe("R-1624 A2 · nur sichere Bilder, nie Nutzertext als HTML", () => {
  it("fremde Bildquelle → kein Markup, kein Start", () => {
    const fremd: FotoAnker = { dataUrl: "https://example.invalid/bild.png", befund: "Lager" };
    expect(fotoAnkerHtml(fremd)).toBe("");
    expect(applyFotoAnker("<p>Bestand</p>", fremd)).toBe("<p>Bestand</p>");
    expect(fotoStartbereit(fremd)).toBe(false);
  });

  it("Befund mit Tags wird als Text gezeigt, nicht ausgeführt", () => {
    const html = fotoAnkerHtml({ dataUrl: PNG, befund: '<img src=x onerror="alert(1)">Lager' });
    // Genau EIN echtes <img> (das Foto); der Befund steht nur als Text darin.
    expect(html.match(/<img\b/g)).toHaveLength(1);
    expect(html).toContain('<figcaption>&lt;img src=x onerror="alert(1)"&gt;Lager</figcaption>');
    // Auch im alt-Attribut bleibt er Text: das Anführungszeichen ist maskiert, das Attribut endet nicht.
    expect(html).toContain('alt="&lt;img src=x onerror=&quot;alert(1)&quot;');
  });

  it("ohne Befund kein Start; Befund wird gesäubert und gekappt", () => {
    expect(fotoStartbereit({ dataUrl: PNG, befund: "   " })).toBe(false);
    expect(fotoStartbereit(null)).toBe(false);
    expect(fotoStartbereit(FOTO)).toBe(true);
    expect(normalizeFotoBefund(`  a \n b  ${"x".repeat(400)}`)).toHaveLength(MAX_FOTO_BEFUND);
    expect(normalizeFotoBefund("  Riss \n im   Lager ")).toBe("Riss im Lager");
  });
});

describe("R-1624 A3 · die Wissensseite aus dem Foto-Interview", () => {
  const ENTWURF = {
    statement: "Riss am Nahtübergang der Kehlnaht.",
    conditions: ["Wasserstoffversprödung durch feuchte Elektroden."],
    measures: ["Elektroden trocknen, Naht ausschleifen und neu schweißen."],
    tags: ["Schweißen", "Kehlnaht"],
  };

  it("DE: Fehlerbild · Vermutete Ursache · Lösung · Kontext", () => {
    const html = fotoArtikelHtml(ENTWURF, "de");
    expect(html).toContain("<h2>Fehlerbild</h2><p>Riss am Nahtübergang der Kehlnaht.</p>");
    expect(html).toContain(
      "<h3>Vermutete Ursache</h3><ul><li>Wasserstoffversprödung durch feuchte Elektroden.</li></ul>",
    );
    expect(html).toContain(
      "<h3>Lösung</h3><ul><li>Elektroden trocknen, Naht ausschleifen und neu schweißen.</li></ul>",
    );
    expect(html).toContain("<h3>Kontext</h3><p>Schweißen, Kehlnaht</p>");
  });

  it("EN-Überschriften; leere Felder fallen weg; leerer Entwurf ergibt nichts", () => {
    const html = fotoArtikelHtml({ statement: "Crack.", conditions: [], measures: [] }, "en");
    expect(html).toBe("<h2>Fault</h2><p>Crack.</p>");
    expect(fotoArtikelHtml({}, "de")).toBe("");
  });
});

describe("R-1624 A4 · nichts wird überschrieben", () => {
  it("leerer Rumpf → Anker; danach die Seite DARUNTER", () => {
    const mitAnker = applyFotoAnker("", FOTO);
    expect(mitAnker).toBe(fotoAnkerHtml(FOTO));
    const fertig = applyFotoArtikel(mitAnker, { statement: "Riss." }, "de");
    expect(fertig.startsWith(fotoAnkerHtml(FOTO))).toBe(true);
    expect(fertig.endsWith("<h2>Fehlerbild</h2><p>Riss.</p>")).toBe(true);
  });

  it("vorhandener Text bleibt vorne stehen", () => {
    const bestand = "<p>Notiz aus der Frühschicht.</p>";
    expect(applyFotoAnker(bestand, FOTO)).toBe(bestand + fotoAnkerHtml(FOTO));
  });
});
