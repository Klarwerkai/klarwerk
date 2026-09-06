import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
// Derselbe Abbau wie im Original: zugleich die transitive Chromium-Kante für tools/test.
import { beende } from "../design/h6-chromium";
import { t1bAbbau } from "./t1b-original";

const STARTOPTIONEN = {
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
};

const DATEIEN = [
  "tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx",
  "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
];

/** Echte Vitest-Hooks und echter Chromium-Abbau, nur dessen Bestätigung wird aufgehalten. */
async function mitProbedateien<T>(
  fehlend: boolean,
  pruefe: (ordner: string, dateien: string[]) => Promise<T>,
): Promise<T> {
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-t1b-abbau-"));
  const dateien: string[] = [];
  try {
    // Eigener Testroot: der Produkt-Collector darf diese absichtlich roten Dateien nie sehen.
    // Abhängigkeiten bleiben dieselben; Konfiguration und Cache gehören nur dieser Probe.
    symlinkSync(resolve("node_modules"), join(ordner, "node_modules"), "dir");
    writeFileSync(
      join(ordner, "vitest.config.mjs"),
      `export default ${JSON.stringify({
        root: ordner,
        cacheDir: join(ordner, ".vite"),
        test: { include: ["*.test.ts"], testTimeout: 60_000 },
      })};`,
    );
    for (const [i, datei] of DATEIEN.entries()) {
      const pfad = join(ordner, `abbau-${i}.test.ts`);
      dateien.push(pfad);
      writeFileSync(
        pfad,
        `
import { beforeAll, afterAll as registriere, it, expect } from "vitest";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
let echt;
let fertig = false;
const browser = { close: async () => {
  await echt.close();
  console.log("letzter Zustand: Browser geschlossen, Abschlussbestätigung fehlt");
  ${fehlend ? "await new Promise(() => {});" : "await new Promise(r => setTimeout(r, 10500));"}
  fertig = true;
} };
const stand = { browser };
const beende = ${beende.toString()};
const afterAll = (callback, timeout) => registriere(async () => {
  const start = Date.now();
  try { await callback(); expect(fertig).toBe(true); }
  finally { console.log("Abbau: " + (Date.now()-start) + "ms; bestätigt=" + fertig); }
}, ${fehlend ? "Math.min(timeout ?? 10000, 100)" : "timeout"});
beforeAll(async () => {
  echt = await chromium.launch(${JSON.stringify(STARTOPTIONEN)});
  await echt.newPage();
}, 60000);
it(${JSON.stringify(datei)}, async () => {
  expect(echt.isConnected()).toBe(true);
  // Bei der kurzen Negativfrist ist der reale Abbau vorher fertig: nur die fehlende Bestätigung
  // darf die Frist reißen, niemals ein unter Last langsames Chromium-close.
  ${fehlend ? "await echt.close();" : ""}
});
${t1bAbbau(datei)}
`,
      );
    }
    return await pruefe(ordner, dateien);
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}

async function lauf(fehlend: boolean): Promise<{ code: number; ausgabe: string }> {
  return await mitProbedateien(fehlend, async (ordner, dateien) => {
    let code = 0;
    let ausgabe = "";
    try {
      const r = await promisify(execFile)(
        process.execPath,
        [
          "node_modules/vitest/vitest.mjs",
          "run",
          "--config",
          join(ordner, "vitest.config.mjs"),
          "--pool=forks",
          "--poolOptions.forks.maxForks=1",
          "--poolOptions.forks.minForks=1",
          ...dateien,
        ],
        { timeout: 60_000, maxBuffer: 1_000_000 },
      );
      ausgabe = r.stdout + r.stderr;
    } catch (e) {
      const r = e as { code: number; stdout: string; stderr: string };
      code = r.code;
      ausgabe = r.stdout + r.stderr;
    }
    console.log(ausgabe);
    return { code, ausgabe };
  });
}

it("beide Original-afterAll warten auf den gezielt verspäteten Chromium-Abschluss", async () => {
  const r = await lauf(false);
  expect(r.ausgabe).toMatch(/Test Files\s+2 passed/);
  expect(r.code).toBe(0);
}, 90_000);

it("beide Original-afterAll: dauerhaft fehlender Abschluss bleibt als Dateifehler rot", async () => {
  const r = await lauf(true);
  expect(r.code).toBe(1);
  expect(r.ausgabe).toMatch(/Test Files\s+2 failed/);
  expect(r.ausgabe).toContain("Hook timed out in 100ms");
  expect(r.ausgabe).toContain("Browser geschlossen, Abschlussbestätigung fehlt");
});

it("R2 · vorhandene Abbauproben sind für den Produkt-Collector unsichtbar", async () => {
  await mitProbedateien(true, async (_ordner, dateien) => {
    expect(dateien).toHaveLength(2);
    for (const datei of dateien) expect(existsSync(datei)).toBe(true);
    const { stdout } = await promisify(execFile)(process.execPath, [
      "node_modules/vitest/vitest.mjs",
      "list",
      "--filesOnly",
      "abbau-",
    ]);
    for (const datei of dateien) expect(stdout).not.toContain(basename(datei));
  });
});

it("R2 · Abbauproben werden auch bei einem Fehler vor dem Unterprozess entfernt", async () => {
  let erzeugt = "";
  const fehler = new Error("absichtlicher Abbruch vor dem Unterprozess");
  await expect(
    mitProbedateien(true, async (ordner, dateien) => {
      erzeugt = ordner;
      expect(dateien.every(existsSync)).toBe(true);
      throw fehler;
    }),
  ).rejects.toBe(fehler);
  expect(erzeugt).not.toBe("");
  expect(existsSync(erzeugt)).toBe(false);
});
