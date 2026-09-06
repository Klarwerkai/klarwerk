import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * Führt den tatsächlichen it-Callback aus, ohne die Suite ein zweites Mal zu registrieren.
 * Keine abgeschriebene Prüfung: AST-Auswahl bindet Ablauf UND Erwartungen an die Zieldatei.
 * Nur Aufbau/Abbau übernimmt der Nachweis. Fehlende/mehrdeutige Fundstellen brechen laut ab.
 */
export function originalProbe(fall: "B3b" | "B4" | "I28"): (scope: object) => Promise<void> {
  const bibliothek = fall !== "I28";
  const datei = bibliothek
    ? "tests/ablage-kontext/neuladen-in-chromium.test.ts"
    : "tests/design/h6-funktionsinventar.test.ts";
  const ast = ts.createSourceFile(datei, readFileSync(datei, "utf8"), ts.ScriptTarget.Latest, true);
  const namen = bibliothek
    ? [
        "SUCH_PARAM",
        "EINTRAG_PARAM",
        "BEGRIFF",
        "ZEILEN",
        "LESETITEL",
        "SUCHFELD",
        "TIPPE",
        "KLICKE",
      ]
    : ["PRUEFE"];
  const deklarationen: string[] = [];
  const callbacks: string[] = [];
  let helfer = 0;
  const besuche = (knoten: ts.Node, profil = false): void => {
    const imProfil =
      profil ||
      (ts.isForOfStatement(knoten) && knoten.expression.getText(ast) === "inventarProfil()");
    if (ts.isVariableDeclaration(knoten) && namen.includes(knoten.name.getText(ast))) {
      deklarationen.push(`const ${knoten.getText(ast)};`);
    }
    if (!bibliothek && ts.isFunctionDeclaration(knoten) && knoten.name?.text === "inventarProfil") {
      deklarationen.push(knoten.getText(ast));
    }
    if (
      bibliothek &&
      ts.isFunctionDeclaration(knoten) &&
      ["warteBibliothek", "warteZeile"].includes(knoten.name?.text ?? "")
    ) {
      deklarationen.push(knoten.getText(ast));
      helfer++;
    }
    if (ts.isCallExpression(knoten) && knoten.expression.getText(ast) === "it") {
      const [titel, callback] = knoten.arguments;
      if (
        titel &&
        callback &&
        (bibliothek
          ? ts.isStringLiteral(titel) && titel.text.startsWith(`${fall} ·`)
          : imProfil && ts.isTemplateExpression(titel))
      ) {
        callbacks.push(callback.getText(ast));
      }
    }
    ts.forEachChild(knoten, (kind) => besuche(kind, imProfil));
  };
  besuche(ast);
  if (callbacks.length !== 1 || deklarationen.length !== namen.length + (bibliothek ? helfer : 1)) {
    throw new Error(
      `${datei}: ${fall} nicht eindeutig gebunden (${callbacks.length} Callbacks, ${deklarationen.length} Deklarationen)`,
    );
  }
  const quelle = `return async (scope) => {
    const { expect, s, fn, ORIGIN, TITEL_FREI, TITEL_OFFEN, stand, t } = scope;
    ${deklarationen.join("\n")}
    ${bibliothek ? "" : "const posten = inventarProfil().find((p) => p.zeile5a === 28);"}
    await (${callbacks[0]})();
  };`;
  return new Function(ts.transpile(quelle, { target: ts.ScriptTarget.ES2022 }))() as (
    scope: object,
  ) => Promise<void>;
}
