// AUFTRAG deploy-health-commit · R-1028: Word-Panel und Web-Konsole zeigen die Programmversion aus
// EINER Quelle (`APP_VERSION`, apps/web/src/version.ts).
//
// Geprüft wird das ECHTE Build-Plugin `klara-stand` aus apps/web/vite.config.ts — keine
// nachgebaute Kopie. Der Import läuft über einen Laufzeitpfad, damit die Datei nicht in den
// Root-Typcheck gerät (Begründung am Kopf von apps/web/vite.config.ts, JOB 4367).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { klaraStandText } from "../../apps/web/src/lib/klaraStand";
import { APP_VERSION } from "../../apps/web/src/version";

const WURZEL = join(import.meta.dirname, "..", "..");
const TASKPANE = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");

interface StandPlugin {
  name: string;
  configResolved: (c: { root: string; build: { outDir: string } }) => void;
  closeBundle: () => void;
}

async function standPlugin(): Promise<StandPlugin> {
  const pfad = join(WURZEL, "apps", "web", "vite.config.ts");
  const modul = (await import(pfad)) as { default: { plugins: unknown[] } };
  const plugin = modul.default.plugins
    .flat()
    .find(
      (p): p is StandPlugin =>
        typeof p === "object" && p !== null && (p as { name?: unknown }).name === "klara-stand",
    );
  if (!plugin) throw new Error("Plugin klara-stand fehlt in apps/web/vite.config.ts");
  return plugin;
}

let tmp = "";
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = "";
});

describe("R-1028 · eine Programmversion für Word-Panel und Web-Konsole", () => {
  it("der Stand-Text beginnt mit der Programmversion, danach Bauzeit und Git-Kürzel", () => {
    const um = new Date("2026-09-29T04:32:15Z");
    expect(klaraStandText("1.0.0-beta.1.627", um, "41fad46")).toBe(
      "1.0.0-beta.1.627 · 2026-09-29 04:32Z · 41fad46",
    );
    // Ohne Git-Kontext (Docker-Build) bleibt ehrlich nur die Zeit hinter der Version.
    expect(klaraStandText("1.0.0-beta.1.627", um, "")).toBe("1.0.0-beta.1.627 · 2026-09-29 04:32Z");
  });

  it("das echte Build-Plugin stempelt APP_VERSION ins gebaute Word-Panel", async () => {
    tmp = mkdtempSync(join(tmpdir(), "klara-stand-"));
    mkdirSync(join(tmp, "dist", "word-addin"), { recursive: true });
    const ziel = join(tmp, "dist", "word-addin", "taskpane.html");
    writeFileSync(ziel, readFileSync(TASKPANE, "utf8"));

    const plugin = await standPlugin();
    plugin.configResolved({ root: tmp, build: { outDir: "dist" } });
    plugin.closeBundle();

    const gebaut = readFileSync(ziel, "utf8");
    expect(gebaut).not.toContain("__KLARA_STAND__");
    const stand = gebaut.match(/var KLARA_STAND = "([^"]*)"/)?.[1] ?? "";
    expect(stand.startsWith(`${APP_VERSION} · `)).toBe(true);
  });

  it("die Add-in-Fassungszeile behauptet keinen zweiten Programmstand", () => {
    const src = readFileSync(TASKPANE, "utf8");
    const zeilen = [...src.matchAll(/fassung(?:Aktuell|Wechsel|Unbekannt): "([^"]*)"/g)].map(
      (m) => m[1] ?? "",
    );
    // je drei Schlüssel in Deutsch, Englisch, Niederländisch
    expect(zeilen).toHaveLength(9);
    for (const z of zeilen) {
      expect(z).toMatch(/^Add-in[- ](Fassung|version|versie) \{geladen\}/);
    }
  });
});
