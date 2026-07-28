// ================================================================================================
// AUFTRAG-mega40 H2 — TOKEN-DISZIPLIN-SAMMLER: HEX-FARBEN NUR IN DER TOKEN-DATEI.
// ================================================================================================
//
// Das Zweitdesign lebt davon, dass BEIDE Themes aus EINER Token-Datei schöpfen. Ein hartkodierter
// Hex-Wert in einer Style-Quelle wäre eine Farbe, die beim Umschalten NICHT mitwechselt — genau
// die zweite Wahrheit, die dieser Auftrag verbietet.
//
// SAMMLER, kein Fall-Katalog: geprüft werden ALLE CSS-Dateien unter apps/web/src (rekursiv
// eingesammelt — eine künftige styles/dunkel.css fiele automatisch hinein) plus tailwind.config.ts
// (die Abbildungsschicht). Einzige erlaubte Heimat für Hex-Farben ist die Token-Datei selbst
// (styles/themes.css). Bewusst NICHT im Schnitt: TSX-Dateien (deren Alt-Hexe — Logo-SVG,
// ConfidenceBar-Skala — sind Bestand anderer Scheiben und hier nicht angefasst worden).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_SRC = join(__dirname, "../../apps/web/src");
const TOKEN_DATEI = join(WEB_SRC, "styles/themes.css");
const TAILWIND = join(__dirname, "../../apps/web/tailwind.config.ts");

function cssDateienUnter(dir: string): string[] {
  const ergebnis: string[] = [];
  for (const eintrag of readdirSync(dir)) {
    const pfad = join(dir, eintrag);
    if (statSync(pfad).isDirectory()) {
      ergebnis.push(...cssDateienUnter(pfad));
    } else if (pfad.endsWith(".css")) {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Hex-Farbwerte (#rgb, #rgba, #rrggbb, #rrggbbaa) — NACH Entfernen der Kommentare.
function hexFarbenIn(quelle: string): string[] {
  return [...ohneKommentare(quelle).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
}

describe("mega40 H2 · Hex-Farben wohnen ausschließlich in der Token-Datei", () => {
  it("SAMMLER: keine CSS-Datei außer themes.css und keine Tailwind-Abbildung trägt Hex-Farben", () => {
    const quellen = [...cssDateienUnter(WEB_SRC), TAILWIND].filter((p) => p !== TOKEN_DATEI);
    const verstoesse: string[] = [];
    for (const pfad of quellen) {
      for (const hex of hexFarbenIn(readFileSync(pfad, "utf8"))) {
        verstoesse.push(`${relative(join(__dirname, "../.."), pfad)}: ${hex}`);
      }
    }
    expect(
      verstoesse,
      "Hex-Farbe außerhalb der Token-Datei — gehört als Token in styles/themes.css",
    ).toEqual([]);
  });

  it("der Schnitt ist nicht leer und enthält die bekannten Style-Quellen dieser Scheibe", () => {
    const quellen = cssDateienUnter(WEB_SRC).map((p) => relative(WEB_SRC, p));
    expect(quellen).toContain("index.css");
    expect(quellen).toContain("styles/modern.css");
    expect(quellen).toContain("styles/themes.css");
  });

  it("Kalibrierung: ein absichtlich eingefügter Hex-Wert schlägt an — auch hinter Kommentaren", () => {
    const probe =
      "a { color: #e8630a; } /* #ffffff im Kommentar zählt nicht */ b { border: 1px solid #ABC; }";
    expect(hexFarbenIn(probe)).toEqual(["#e8630a", "#ABC"]);
    expect(hexFarbenIn("a { color: rgb(var(--kw-brand)); }")).toEqual([]);
  });
});
