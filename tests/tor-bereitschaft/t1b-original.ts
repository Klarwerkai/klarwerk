import { readFileSync } from "node:fs";
import ts from "typescript";

/** Bindet echte Deklarationen/Callbacks, keine Abschrift der zu prüfenden Testlogik. */
export function t1bQuelle(datei: string, namen: string[], praefix?: string): string {
  const ast = ts.createSourceFile(datei, readFileSync(datei, "utf8"), ts.ScriptTarget.Latest, true);
  const gefunden = new Map<string, string>();
  const callbacks: string[] = [];
  const besuche = (knoten: ts.Node): void => {
    if (ts.isVariableDeclaration(knoten) && namen.includes(knoten.name.getText(ast))) {
      const name = knoten.name.getText(ast);
      if (gefunden.has(name)) throw new Error(`Doppelte Deklaration: ${name}`);
      gefunden.set(name, `const ${knoten.getText(ast)};`);
    }
    if (ts.isFunctionDeclaration(knoten) && namen.includes(knoten.name?.text ?? "")) {
      gefunden.set(knoten.name?.text ?? "", knoten.getText(ast));
    }
    if (ts.isCallExpression(knoten) && knoten.expression.getText(ast) === "it") {
      const [titel, callback] = knoten.arguments;
      if (
        titel &&
        callback &&
        ts.isStringLiteral(titel) &&
        titel.text.startsWith(praefix ?? "\0")
      ) {
        callbacks.push(callback.getText(ast));
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(ast);
  if (praefix && callbacks.length !== 1) throw new Error(`${datei}: Callback nicht eindeutig`);
  return `${[...gefunden.values()].join("\n")}\n${praefix ? `return (${callbacks[0]})();` : ""}`;
}

export function t1bAbbau(datei: string): string {
  const ast = ts.createSourceFile(datei, readFileSync(datei, "utf8"), ts.ScriptTarget.Latest, true);
  const hooks: string[] = [];
  const besuche = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten) && knoten.expression.getText(ast) === "afterAll") {
      hooks.push(`${knoten.getText(ast)};`);
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(ast);
  if (hooks.length !== 1) throw new Error(`${datei}: afterAll nicht eindeutig`);
  return hooks[0] as string;
}
