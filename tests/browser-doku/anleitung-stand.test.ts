import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";
import { ermittleBrowserbefund, sammleTestdateien } from "../tor-inventar/browser-gruppe";

const readme = readFileSync(repoPfad("docs/browser-extension/README.md"), "utf8");
const manifest = JSON.parse(
  readFileSync(repoPfad("extensions/klara-browser/manifest.json"), "utf8"),
) as { version: string; permissions: string[] };
const panel = readFileSync(repoPfad("extensions/klara-browser/panel.js"), "utf8");

// Der AST findet die ausführbare Deklaration; die Regex liest deren Array.
// Auch mehrzeilige Kommentare mit einer vollständigen MODES-Zeile sind keine Quelle.
function modes(source: string): string[] {
  const tree = ts.createSourceFile(
    "panel.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const arrays: string[][] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "MODES"
    ) {
      const match = /^MODES\s*=\s*(\[[^\]]+\])$/.exec(node.getText(tree));
      expect(match, "MODES muss ein ausführbares Arrayliteral bleiben").not.toBeNull();
      arrays.push(JSON.parse(match?.[1] ?? "null") as string[]);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  expect(arrays, "genau eine ausführbare MODES-Deklaration").toHaveLength(1);
  return arrays[0] ?? [];
}

function languageSections(): string[] {
  return [
    readme
      .split("## Installation und Bedienung · Deutsch")[1]
      ?.split("## Installation and use · English")[0] ?? "",
    readme.split("## Installation and use · English")[1]?.split("\n## ")[0] ?? "",
  ];
}

describe("Browser-Anleitung entspricht dem ausgelieferten Paket", () => {
  it("F1 · nennt die Manifestversion in beiden Sprachen und entfernt 0.1.1", () => {
    expect(readme).not.toContain("0.1.1");
    for (const section of languageSections()) expect(section).toContain(manifest.version);
  });

  it("F2 · dokumentiert alle verlangten Rechte als Teilmenge in DE und EN", () => {
    // optional_permissions ist absichtlich kein Bestandteil dieses Vertrags (JOB 3412).
    for (const section of languageSections()) {
      for (const permission of manifest.permissions) expect(section).toContain(`\`${permission}\``);
    }
  });

  it("F3 · erklärt jeden ausführbaren Umfang in beiden Sprachen", () => {
    const labels: Record<string, readonly [RegExp, RegExp]> = {
      selection: [/\bMarkierung\b/i, /\bSelection\b/i],
      article: [/\bArtikel\b/i, /\bArticle\b/i],
      page: [/zugängliche Seite/i, /accessible page/i],
      clipboard: [/\bZwischenablage\b/i, /\bClipboard\b/i],
    };
    for (const mode of modes(panel)) {
      const translated = labels[mode];
      expect(
        translated,
        `neuer Umfang braucht eine dokumentierte Entsprechung: ${mode}`,
      ).toBeDefined();
      languageSections().forEach((section, index) => {
        expect(section).toMatch(translated?.[index] ?? /neuer Umfang ohne Entsprechung/);
      });
    }
  });

  it("F4 · verlangt gezieltes Neuladen und erklärt die Versionsgrenze in DE und EN", () => {
    const [de = "", en = ""] = languageSections();
    expect(de).toMatch(/### [^\n]*(?:Vorführung|[Nn]eu laden|Reload)/);
    expect(de).toContain("chrome://extensions");
    expect(de).toMatch(/genau diese Erweiterung[^.\n]*neu laden/i);
    expect(de).toMatch(/gleiche Versionsnummer[^.\n]*(?:kein|nicht)/i);
    expect(en).toMatch(/### [^\n]*(?:[Dd]emo|[Rr]eload)/);
    expect(en).toContain("chrome://extensions");
    expect(en).toMatch(/reload[^.\n]*this (?:specific )?extension/i);
    expect(en).toMatch(/same version[^.\n]*(?:does not|doesn't|no proof|not proof)/i);
  });

  it("K1 · ignoriert passende Deklarationen in Zeilen- und Blockkommentaren", () => {
    const decoy = 'const MODES = ["comment-only"];';
    expect(modes(`// ${decoy}\n/*\n${decoy}\n*/\n${panel}`)).toEqual(modes(panel));
  });

  it("K2 · gehört ohne Browserstart in den regulären Bestand (rest)", () => {
    const path = "tests/browser-doku/anleitung-stand.test.ts";
    expect(sammleTestdateien()).toContain(path);
    expect(ermittleBrowserbefund([path]).browserTests).toEqual([]);
  });
});
