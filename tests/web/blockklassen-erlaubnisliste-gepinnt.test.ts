// ================================================================================================
// R-1367 · DIE ERLAUBNISLISTE DER BLOCKKLASSEN IST GEPINNT — UND IHRE ZWEI KOPIEN LAUFEN GLEICH.
// ================================================================================================
//
// `ALLOWED_DIV_CLASSES` steht zweimal im Bestand: im Sanitizer der Oberflaeche
// (`apps/web/src/lib/richText.ts`) und im Sanitizer des Servers (`services/structure/src/sanitize.ts`).
// Die Liste ist eine Sicherheitsgrenze fuer fremden Inhalt (`d037-sanitizing-huellengrenze`).
//
// Was es schon gibt (JOB 2442, JOB 2461): `d037-blockklassen-reichweite` und
// `d037-blockklassen-bedarfsdeckung` melden, wenn eine GEBRAUCHTE Klasse aus der Liste faellt. Eine
// AUFNAHME bleibt dort bewusst gruen — und damit still. R-1367 verlangt mehr: „Eine Liste erlaubter
// Werte war nirgends festgeschrieben; jede stille Aenderung waere unbemerkt geblieben. Ein Waechter
// pinnt sie fest.“
//
// Dieser Fall pinnt deshalb den VOLLEN Inhalt beider Kopien, in ihrer Reihenfolge, und verlangt,
// dass beide gleich sind (R-1351). Wer eine Klasse aufnimmt oder streicht, aendert hier sichtbar
// eine Zeile im selben Diff.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const pfad = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const KOPIEN = {
  oberflaeche: pfad("../../apps/web/src/lib/richText.ts"),
  server: pfad("../../services/structure/src/sanitize.ts"),
} as const;

/** Der festgeschriebene Inhalt. Aenderungen hier sind Aenderungen einer Sicherheitsgrenze. */
const GEPINNT: readonly string[] = [
  "panel",
  "callout",
  "panel-info",
  "panel-note",
  "panel-warning",
  "panel-success",
  "attachment",
  "panel-external",
];

/** Die Werte des `new Set([...])` an `ALLOWED_DIV_CLASSES`, aus dem Syntaxbaum. */
function erlaubnisliste(datei: string, text: string): string[] | undefined {
  const quelle = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);
  let werte: string[] | undefined;
  const besuche = (knoten: ts.Node): void => {
    if (
      ts.isVariableDeclaration(knoten) &&
      ts.isIdentifier(knoten.name) &&
      knoten.name.text === "ALLOWED_DIV_CLASSES" &&
      knoten.initializer &&
      ts.isNewExpression(knoten.initializer)
    ) {
      const liste = knoten.initializer.arguments?.[0];
      if (liste && ts.isArrayLiteralExpression(liste)) {
        werte = liste.elements.filter(ts.isStringLiteral).map((e) => e.text);
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(quelle);
  return werte;
}

describe("R-1367 · ALLOWED_DIV_CLASSES ist festgeschrieben", () => {
  it("die Oberflaeche erlaubt genau die gepinnten Klassen, in dieser Reihenfolge", () => {
    const text = readFileSync(KOPIEN.oberflaeche, "utf8");
    expect(erlaubnisliste("richText.ts", text)).toEqual(GEPINNT);
  });

  it("der Server erlaubt genau die gepinnten Klassen, in dieser Reihenfolge", () => {
    const text = readFileSync(KOPIEN.server, "utf8");
    expect(erlaubnisliste("sanitize.ts", text)).toEqual(GEPINNT);
  });

  it("GEGENPROBE · eine stille Aufnahme wird rot", () => {
    const original = readFileSync(KOPIEN.server, "utf8");
    const text = original.replace('"panel-external",', '"panel-external",\n  "scroll-huelle",');
    const liste = erlaubnisliste("sanitize.ts", text);
    expect(liste).toContain("scroll-huelle");
    expect(liste).not.toEqual(GEPINNT);
  });

  it("GEGENPROBE · eine verschwundene Liste wird nicht als leer und gruen gelesen", () => {
    expect(erlaubnisliste("x.ts", "const ANDERS = new Set([]);")).toBeUndefined();
  });
});
