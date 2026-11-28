import { globSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configDefaults } from "vitest/config";
import { REPO_WURZEL } from "../support/repoPfad";
import { STRECKE } from "./kundeninstallation/pflicht";

// Nur Dateinamen aus der tatsächlich geladenen Konfiguration prüfen.
// Die Installationssuite wird weder importiert noch gesammelt oder ausgeführt.
const STRECKENPFAD = `tests/neuinstallation/${STRECKE}`;
const URSPRUENGLICH = { argv: process.argv, exitCode: process.exitCode };

afterEach(() => {
  process.argv = URSPRUENGLICH.argv;
  process.exitCode = URSPRUENGLICH.exitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function ladeKonfiguration(filter: string[] = [], pflicht?: string) {
  process.argv = ["node", "vitest", "run", "--config", "vitest.integration.config.ts", ...filter];
  vi.stubEnv("KLARWERK_PG_PFLICHT", "1");
  vi.stubEnv("KLARWERK_KUNDENINSTALLATION", pflicht);
  vi.resetModules();
  return import("../../vitest.integration.config");
}

function ausgewaehlt(konfig: typeof import("../../vitest.integration.config").default): string[] {
  return globSync(konfig.test?.include ?? [], {
    cwd: REPO_WURZEL,
    exclude: konfig.test?.exclude ?? configDefaults.exclude,
  }).sort();
}

describe("A5b · Kundeninstallation und allgemeine Integrationsauswahl", () => {
  it("A1 · der allgemeine PG-Pflichtlauf sammelt die Installationsstrecke nicht", async () => {
    const { default: konfig } = await ladeKonfiguration();
    expect(ausgewaehlt(konfig)).not.toContain(STRECKENPFAD);
    expect(process.env.KLARWERK_KUNDENINSTALLATION).toBeUndefined();
    expect(process.env.KLARWERK_PG_PFLICHT).toBe("1");
  });

  it("A2 · ein expliziter Basename wählt die Strecke und macht sie zwingend", async () => {
    const { default: konfig } = await ladeKonfiguration([STRECKE], "nicht-pflicht");
    expect(ausgewaehlt(konfig)).toContain(STRECKENPFAD);
    expect(process.env.KLARWERK_KUNDENINSTALLATION).toBe("pflicht");
    expect(konfig.test?.exclude).toEqual(configDefaults.exclude);
  });

  it("A3 · ein vollständiger Dateipfad bleibt ausdrücklich verpflichtend", async () => {
    const { default: konfig } = await ladeKonfiguration([join(REPO_WURZEL, STRECKENPFAD)]);
    expect(ausgewaehlt(konfig)).toContain(STRECKENPFAD);
    expect(process.env.KLARWERK_KUNDENINSTALLATION).toBe("pflicht");
  });

  it("A4 · das Pflichtflag wählt die Strecke auch ohne Dateifilter", async () => {
    const { default: konfig } = await ladeKonfiguration([], "pflicht");
    expect(ausgewaehlt(konfig)).toContain(STRECKENPFAD);
    expect(konfig.test?.exclude).toEqual(configDefaults.exclude);
    expect(process.env.KLARWERK_PG_PFLICHT).toBe("1");
  });

  it("A5 · alle übrigen Integrationsdateien und Standardausschlüsse bleiben erhalten", async () => {
    const { default: konfig } = await ladeKonfiguration();
    const uebrig = globSync(
      ["services/**/*.integration.test.ts", "tests/**/*.integration.test.ts"],
      { cwd: REPO_WURZEL, exclude: configDefaults.exclude },
    )
      .filter((datei) => datei !== STRECKENPFAD)
      .sort();
    expect(uebrig.length).toBeGreaterThan(0);
    expect(ausgewaehlt(konfig)).toEqual(uebrig);
    expect(konfig.test?.include).toEqual([
      "services/**/*.integration.test.ts",
      "tests/**/*.integration.test.ts",
    ]);
    expect(konfig.test?.exclude).toEqual([...configDefaults.exclude, STRECKENPFAD]);
    expect(konfig.test?.fileParallelism).toBe(false);
    expect(konfig.test?.allowOnly).toBe(false);
    expect(konfig.test?.passWithNoTests).toBe(false);
    expect(konfig.test?.setupFiles).toEqual(["tests/setup-env.ts"]);
  });

  it("A6 · der verdrahtete PG-Pflichtmelder hält übersprungene Fälle weiter rot", async () => {
    const { default: konfig, UEBERSPRUNGEN_RUNNER } = await ladeKonfiguration();
    const { PgLaufMelder } = await import("../pg-laufbeleg/melder");
    expect(konfig.test?.runner).toBe(UEBERSPRUNGEN_RUNNER);
    const reporter = konfig.test?.reporters;
    expect(reporter).toEqual(expect.arrayContaining(["default", expect.any(PgLaufMelder)]));
    const melder = (Array.isArray(reporter) ? reporter : []).find(
      (r) => typeof r === "object" && r instanceof PgLaufMelder,
    );
    if (!(melder instanceof PgLaufMelder)) throw new Error("PG-Pflichtmelder fehlt.");
    const ausgabe = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.exitCode = 0;
    melder.onFinished([
      {
        name: "andere.integration.test.ts",
        mode: "run",
        tasks: [
          { name: "gelaufen", mode: "run", result: { state: "pass" } },
          { name: "nicht ausgeführt", mode: "skip" },
        ],
      },
    ]);
    expect(process.exitCode).toBe(1);
    expect(ausgabe).toHaveBeenCalledWith(expect.stringContaining("1 gelaufen · 1 ÜBERSPRUNGEN"));
    process.exitCode = 0;
    melder.onFinished([{ name: "gelaufen", mode: "run", result: { state: "pass" } }]);
    expect(process.exitCode).toBe(0);
  });
});
