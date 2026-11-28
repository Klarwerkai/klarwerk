import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import { sprachpaketeNachladen } from "../../apps/web/src/texte/intern/sprachpakete";

const root = join(import.meta.dirname, "../..");
const web = join(root, "apps/web");

// GHSA-6jcc-5g8w-32mx: die Deep-Merges erhalten ausschließlich
// flache Quellkonstanten. Fremde Übersetzungspflege benutzt addResource einzeln.
it("bindet alle Deep-Merge-Aufrufe an flache String-Konstanten und erhält die Built-ins", async () => {
  const require = createRequire(join(web, "package.json"));
  const i18next = require("i18next");
  const lock = JSON.parse(readFileSync(join(web, "package-lock.json"), "utf8"));
  expect(require("i18next/package.json").version).toBe("23.16.8");
  expect(lock.packages["node_modules/i18next"].version).toBe("23.16.8");
  const instanz = i18next.createInstance();
  await instanz.init({ lng: "de", resources: {} });
  const builtinVorher = Object.getOwnPropertyDescriptors(Object.prototype.hasOwnProperty);
  const funde: string[] = [];
  const src = join(web, "src");
  const plugin = sprachpaketeNachladen();
  plugin.configResolved({ root: web });
  function flacheTexte(objekt: ts.ObjectLiteralExpression): Record<string, string> {
    const texte: Record<string, string> = Object.create(null);
    for (const p of objekt.properties) {
      if (
        !ts.isPropertyAssignment(p) ||
        !ts.isStringLiteral(p.name) ||
        !ts.isStringLiteral(p.initializer)
      )
        throw new Error("Kein flaches Stringliteral");
      expect(["constructor", "prototype", "__proto__"]).not.toContain(p.name.text);
      texte[p.name.text] = p.initializer.text;
    }
    return texte;
  }
  function fachpaket(datei: string, quelltext: string): Record<string, string> {
    const lader = plugin.transform(quelltext, datei)?.code;
    expect(lader).toContain('laden: () => import("../i18n.fachtexte.de.js")');
    expect(lader).toContain("fachtexteLader(FACHTEXTE_DE.laden, i18n)");
    const id = plugin.resolveId("../i18n.fachtexte.de.js", datei);
    expect(id).toBe(join(src, "i18n.fachtexte.de.js"));
    const code = id && plugin.load(id);
    if (!code) throw new Error("Fachtextpaket fehlt");
    const [stmt, ...rest] = ts.createSourceFile(
      "fachtexte.js",
      code,
      ts.ScriptTarget.Latest,
      true,
    ).statements;
    if (
      rest.length ||
      !stmt ||
      !ts.isExportAssignment(stmt) ||
      !ts.isCallExpression(stmt.expression) ||
      stmt.expression.expression.getText() !== "Object.assign"
    )
      throw new Error("Unerwarteter Paketaufbau");
    const texte: Record<string, string> = Object.create(null);
    for (const teil of stmt.expression.arguments) {
      if (!ts.isObjectLiteralExpression(teil))
        throw new Error("Dynamischer Textblock im Fachtextpaket");
      Object.assign(texte, flacheTexte(teil));
    }
    expect(Object.keys(texte)).toContain("wkz.titel");
    return texte;
  }
  for (const name of readdirSync(src, { recursive: true })) {
    if (typeof name !== "string" || !/\.tsx?$/.test(name)) continue;
    const datei = join(src, name);
    const source = ts.createSourceFile(
      datei,
      readFileSync(datei, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const konstanten = new Map<string, ts.Expression>();
    const sammeln = (n: ts.Node): void => {
      if (ts.isVariableDeclarationList(n) && n.flags & ts.NodeFlags.Const) {
        for (const d of n.declarations) {
          if (ts.isIdentifier(d.name) && d.initializer) konstanten.set(d.name.text, d.initializer);
        }
      }
      ts.forEachChild(n, sammeln);
    };
    sammeln(source);
    const pruefen = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === "addResourceBundle"
      ) {
        const [sprache, namespace, daten, deep, overwrite] = n.arguments;
        expect(n.arguments.length).toBe(5);
        expect(sprache && ts.isStringLiteral(sprache)).toBe(true);
        expect(namespace?.getText(source)).toBe('"translation"');
        expect(deep?.kind).toBe(ts.SyntaxKind.TrueKeyword);
        expect([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword]).toContain(overwrite?.kind);
        let texte: Record<string, string>;
        if (relative(src, datei) === "lib/fachtexte.ts") {
          expect(daten?.getText(source)).toBe("paket.default");
          expect(sprache?.getText(source)).toBe('"de"');
          expect(overwrite?.kind).toBe(ts.SyntaxKind.FalseKeyword);
          texte = fachpaket(datei, source.text);
        } else {
          let objekt = daten && ts.isIdentifier(daten) ? konstanten.get(daten.text) : undefined;
          if (objekt && ts.isAsExpression(objekt)) objekt = objekt.expression;
          if (!objekt || !ts.isObjectLiteralExpression(objekt))
            throw new Error("Kein festes Textbündel");
          texte = flacheTexte(objekt);
        }
        instanz.addResourceBundle(
          sprache?.getText(source).slice(1, -1),
          "translation",
          texte,
          true,
          overwrite?.kind === ts.SyntaxKind.TrueKeyword,
        );
        funde.push(relative(src, datei));
      }
      ts.forEachChild(n, pruefen);
    };
    pruefen(source);
  }
  expect(funde.sort()).toEqual([
    "components/ImportSelect.tsx",
    "components/ImportSelect.tsx",
    "components/ImportSelect.tsx",
    "lib/fachtexte.ts",
    "pages/AdminKiDetails.tsx",
    "pages/AdminKiDetails.tsx",
    "pages/AdminKiDetails.tsx",
  ]);
  expect(instanz.t("imp.rahmen.titel")).toBe("Für welche Firma führst du vor?");
  expect(Object.getOwnPropertyDescriptors(Object.prototype.hasOwnProperty)).toEqual(builtinVorher);
  expect(Object.prototype.hasOwnProperty.call({}, "probe")).toBe(false);
});
