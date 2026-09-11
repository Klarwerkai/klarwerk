import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const PFAD = "tests/live-check-verdrahtung/hook-schluessel.test.tsx";

// Bewusst enger Vertrag für diese eine Testbühne: echte Timer gehören hier überhaupt nicht
// hinein. Die Entprellung wird virtuell ausgelöst; der Abschluss wird mit waitFor beobachtet.
// AST statt Entfärbungsregex: Kommentare, Strings, Templates und Regex sind keine Aufrufe.
// Bereits Timerreferenzen sind verboten, damit auch Aliase/Destrukturierung nicht durchrutschen.
function timerReferenzen(code: string): string[] {
  const datei = ts.createSourceFile(
    "probe.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const treffer: string[] = [];
  const namen = new Set(["setTimeout", "setInterval", "waitForTimeout", "sleep"]);
  const gehe = (node: ts.Node): void => {
    if (
      (ts.isIdentifier(node) && namen.has(node.text)) ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        namen.has(node.argumentExpression.text))
    ) {
      treffer.push(node.getText(datei));
    }
    ts.forEachChild(node, gehe);
  };
  gehe(datei);
  return treffer;
}

it("W1 · keine echte Wartefrist als Brücke im Herkunftstest", () => {
  expect(timerReferenzen(readFileSync(resolve(PFAD), "utf8"))).toEqual([]);
});

it.each([
  "await new Promise(r => setTimeout(r, DEBOUNCE + 20));",
  "await new Promise(r => globalThis.setTimeout(r, 25));",
  'await new Promise(r => globalThis["setTimeout"](r, 25));',
  "const pause = setTimeout; await new Promise(r => pause(r, 25));",
  "const { setTimeout: pause } = globalThis; await new Promise(r => pause(r, 25));",
  'import { setTimeout as pause } from "node:timers/promises"; await pause(25);',
  "await page.waitForTimeout(25);",
])("W2 · Gegenprobe: ausführbare Frist wird erkannt: %s", (code) => {
  expect(timerReferenzen(code).length).toBeGreaterThan(0);
});

it.each([
  "// await new Promise(r => setTimeout(r, 25));",
  "/* setTimeout(r, 25); */",
  'const beispiel = "setTimeout(r, 25)";',
  "const beispiel = `setTimeout(r, 25)`;",
  "void /setTimeout(r, 25)/;",
])("W3 · Text kann den Wächter weder rot noch grün machen: %s", (text) => {
  expect(timerReferenzen(text)).toEqual([]);
  expect(timerReferenzen(`${text}\nawait new Promise(r => setTimeout(r, 25));`)).toEqual([
    "setTimeout",
  ]);
});

it("W4 · ausführbarer Template-Ausdruck bleibt Code", () => {
  expect(timerReferenzen("const text = `Text ${setTimeout(f, 25)}`;")).toEqual(["setTimeout"]);
});
