// AUFTRAG-mega6 Block D: bens Auflage lautet „abgeleitet aus EINER gemeinsamen Quelle, damit Server
// und Oberfläche nicht auseinanderlaufen können".
//
// AUFTRAG-mega8 Block A: der Import über die Modulgrenze (apps/web → services/) ist entfallen — er
// brach den Produktions-Build, weil der webbuild-Stage im Dockerfile nur apps/web kopiert. Die
// Oberfläche hält die Werte jetzt selbst. Bens Anliegen bleibt bindend, dieser Test tritt an die
// Stelle des Imports: er vergleicht beide Objekte Schlüssel für Schlüssel und Wert für Wert und
// wird rot, sobald eine Seite geändert wird, ohne dass die andere nachgezogen wird.
// Ein Test DARF beide Seiten importieren — der zweite Block prüft, dass Vite alle echten Laufzeitimporte
// im Webbuild auflösen kann. Der Profilzeitlöser wird eigens in diese Stufe kopiert.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { DRAFT_LIMITS as UI_LIMITS } from "../../apps/web/src/lib/draftLimits";
import { DRAFT_LIMITS as SERVER_LIMITS } from "../../services/capture/src/draft-limits";

describe("Block D: Oberfläche und Persistenzgrenze halten dieselben Grenzen", () => {
  it("beide Objekte tragen exakt dieselben Schlüssel", () => {
    expect(Object.keys(UI_LIMITS).sort()).toEqual(Object.keys(SERVER_LIMITS).sort());
  });

  it("jeder Schlüssel trägt beidseitig denselben Wert", () => {
    // Schlüssel für Schlüssel statt eines pauschalen toEqual: schlägt eine Zahl auseinander,
    // benennt die Fehlermeldung genau den betroffenen Schlüssel.
    for (const key of Object.keys(SERVER_LIMITS) as (keyof typeof SERVER_LIMITS)[]) {
      expect(`${key}=${UI_LIMITS[key]}`).toBe(`${key}=${SERVER_LIMITS[key]}`);
    }
  });

  it("die Werte entsprechen den von ben aufgezählten Caps", () => {
    expect(SERVER_LIMITS).toEqual({
      reviewers: 20,
      reviewerId: 128,
      sources: 25,
      sourceLabel: 300,
      sourceUrl: 2048,
      sourceExcerpt: 500,
      sourceProvider: 100,
      // AUFTRAG-mega20 Block D: persistierte Original-Referenz je Belegstelle.
      sourceRef: 128,
      extQuery: 300,
      interviewAnswers: 50,
      interviewText: 4000,
      interviewQuestion: 2000,
    });
  });
});

// Vite entfernt reine Typimporte. Für ausgeführten Code zählt der Inhalt der Webbuild-Stufe.
const repo = resolve(__dirname, "../..");

function fehlendeLaufzeitimporte(
  datei: string,
  quelle: string,
  kopiert: ReadonlySet<string>,
): string[] {
  if (!quelle.includes("services/")) return [];
  const js = ts.transpileModule(quelle, {
    fileName: datei,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
    },
  }).outputText;
  const fehlend: string[] = [];
  for (const { fileName } of ts.preProcessFile(js, true, true).importedFiles) {
    const ziel = relative(
      repo,
      resolve(fileName.startsWith(".") ? dirname(datei) : repo, fileName),
    );
    if (!ziel.startsWith("services/")) continue;
    const modul = ts.resolveModuleName(
      fileName,
      datei,
      { moduleResolution: ts.ModuleResolutionKind.Bundler },
      ts.sys,
    ).resolvedModule;
    if (!modul || !kopiert.has(relative(repo, modul.resolvedFileName))) fehlend.push(fileName);
  }
  return fehlend;
}

describe("AUFTRAG-mega8 Block A: alle Laufzeitimporte der Oberfläche liegen im Webbuild", () => {
  it("prüft auch Weitergaben und dynamische Importe, reine Typverträge entfallen beim Bauen", () => {
    const datei = join(repo, "apps/web/src/lib/probe.ts");
    const zeit = "../../../../services/app/src/klara-erinnerung-zeit";
    const quelle = `import type { Vertrag } from "../../../../services/typ";
      export { loeseLokal } from "${zeit}";
      export const laden = () => import("${zeit}");`;
    expect(fehlendeLaufzeitimporte(datei, quelle, new Set())).toEqual([zeit, zeit]);
    expect(
      fehlendeLaufzeitimporte(
        datei,
        quelle,
        new Set(["services/app/src/klara-erinnerung-zeit.ts"]),
      ),
    ).toEqual([]);
  });

  it("jeder Laufzeitimport aus services/ wird im Docker-Webbuild am selben Pfad bereitgestellt", () => {
    const docker = readFileSync(join(repo, "Dockerfile"), "utf8");
    const stufe = /^FROM [^\n]+ AS webbuild\n([\s\S]*?)^FROM /im.exec(docker)?.[1];
    if (!stufe) throw new Error("Die Webbuild-Stufe fehlt im Dockerfile.");
    const kopiert = new Set<string>();
    for (const treffer of stufe.matchAll(/^COPY (services\/\S+) (\S+)$/gm)) {
      const [, quelle, ziel] = treffer;
      if (quelle && (ziel === quelle || ziel === `${dirname(quelle)}/`)) kopiert.add(quelle);
    }
    const root = join(repo, "apps/web/src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(0);
    const fehlend = files.flatMap((file) =>
      fehlendeLaufzeitimporte(file, readFileSync(file, "utf8"), kopiert).map(
        (specifier) => `${relative(repo, file)}: ${specifier}`,
      ),
    );
    expect(fehlend).toEqual([]);
  });
});
