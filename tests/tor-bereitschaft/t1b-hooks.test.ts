import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
// Transitive Chromium-Kante für den vorhandenen Produkt-Collector.
import "../design/h6-chromium";
import { t1bAbbau } from "./t1b-original";

const STARTOPTIONEN = {
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
};

const DATEIEN = [
  "tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx",
  "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
];

/**
 * Echte Vitest-Hooks und echtes close(); der Negativfall verliert die Abschlussbestätigung.
 *
 * JOB 3448 (Lieferpunkt 6): `langsam` ist der dritte Zustand — ein close(), das ECHTE Sekunden
 * braucht und trotzdem gültig ist. Kein Fall belegte diese Lage seit JOB 3173 den 10 500-ms-
 * Stellvertreter entfernt hat. Die Verzögerung ist eine echte `setTimeout`-Wartezeit IM
 * UNTERPROZESS, keine virtuelle Uhr: nur so ist die protokollierte Dauer eine gemessene Dauer.
 */
async function mitProbedateien<T>(
  fehlend: boolean,
  pruefe: (ordner: string, dateien: string[]) => Promise<T>,
  langsam = false,
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
import { beforeAll, afterAll as registriere, it, expect, vi } from "vitest";
import { schliesseChromium, ABBAU_GRENZE_MS } from ${JSON.stringify(resolve("tests/tor-bereitschaft/chromium-abbau.ts"))};
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
let echt;
let fertig = false;
const browser = { close: async () => {
  ${
    fehlend
      ? 'console.log("letzter Zustand: Browser geschlossen, Abschlussbestätigung fehlt"); await new Promise(() => {});'
      : langsam
        ? // ECHTE Wartezeit im Unterprozess — keine virtuelle Uhr im Positivfall. Erst danach der
          // echte Abbau. Wer diese Zeile entfernt, nimmt R3 seine Aussage (Gegenprobe G3).
          "await new Promise((r) => setTimeout(r, 2100)); await echt.close();"
        : "await echt.close();"
  }
  fertig = true;
} };
const stand = { browser };
const afterAll = (callback, timeout) => registriere(async () => {
  expect(timeout, "unveränderter Hook-Rahmen").toBe(60000);
  ${fehlend ? 'vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });' : ""}
  const start = performance.now();
  try {
    const ergebnis = callback().then(() => null, e => e);
    ${fehlend ? "await vi.advanceTimersByTimeAsync(ABBAU_GRENZE_MS + 1);" : ""}
    const fehler = await ergebnis;
    if (fehler) throw fehler;
    expect(fertig).toBe(true);
  } finally {
    console.log("Abbau: " + (performance.now()-start) + "ms; bestätigt=" + fertig);
    vi.useRealTimers();
  }
}, timeout);
beforeAll(async () => {
  echt = await chromium.launch(${JSON.stringify(STARTOPTIONEN)});
  await echt.newPage();
}, 60000);
it(${JSON.stringify(datei)}, async () => {
  expect(echt.isConnected()).toBe(true);
  // Vor der virtuellen Negativuhr ist der reale Abbau fertig. Nur die fehlende Bestätigung
  // wird gestört; die echte close()-Dauer im Positivlauf bleibt unverfälscht.
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

async function lauf(fehlend: boolean, langsam = false): Promise<{ code: number; ausgabe: string }> {
  return await mitProbedateien(
    fehlend,
    async (ordner, dateien) => {
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
          // Der langsame Lauf wartet je Probedatei echte ~2 s zusätzlich; die anderen behalten
          // ihren bisherigen Rahmen unverändert.
          { timeout: langsam ? 150_000 : 60_000, maxBuffer: 1_000_000 },
        );
        ausgabe = r.stdout + r.stderr;
      } catch (e) {
        const r = e as { code: number; stdout: string; stderr: string };
        code = r.code;
        ausgabe = r.stdout + r.stderr;
      }
      console.log(ausgabe);
      return { code, ausgabe };
    },
    langsam,
  );
}

it("beide Original-afterAll messen den echten Chromium-Abschluss", async () => {
  const r = await lauf(false);
  expect(r.ausgabe).toMatch(/Test Files\s+2 passed/);
  expect(r.code).toBe(0);
  expect(r.ausgabe.match(/Chromium-Abbau · .* · [0-9.]+ms · Grenze/g)).toHaveLength(DATEIEN.length);
}, 90_000);

it("beide Original-afterAll: dauerhaft fehlender Abschluss bleibt als Dateifehler rot", async () => {
  const r = await lauf(true);
  expect(r.code).toBe(1);
  expect(r.ausgabe).toMatch(/Test Files\s+2 failed/);
  expect(r.ausgabe).toContain("Abbaugrenze überschritten");
  expect(r.ausgabe).toContain("close() unbestätigt");
  for (const datei of DATEIEN) expect(r.ausgabe).toContain(datei);
  expect(r.ausgabe).toContain("Browser geschlossen, Abschlussbestätigung fehlt");
});

// JOB 3448 · R3 (Lieferpunkt 6) — DIE LAGE, DIE SEIT JOB 3173 UNBELEGT WAR:
// ein close(), das ECHTE Sekunden braucht und trotzdem gültig ist. Der Positivlauf oben misst das
// schnelle close(), der Negativlauf ein NIE auflösendes an einer virtuellen Uhr. Zwischen beiden lag
// die Lücke: nichts belegte, dass ein langsames close() vollständig abgewartet, mit seiner echten
// Dauer protokolliert und GRÜN gewertet wird. Genau diese Zusage trug der bei JOB 3173 entfernte
// 10 500-ms-Stellvertreter — jetzt hängt sie an einer gemessenen Dauer statt an einer gesetzten Zahl.
// Keine virtuelle Uhr im Positivfall: die Wartezeit ist ein echtes `setTimeout` im Unterprozess.
// FARBFEST, und zwar aus gemessenem Anlass: erzwingt die Umgebung Farbe (in der Cloud-Arbeitsprüfung
// der Fall, gemessen 10.09. im Beleg 44f1c64c…), schiebt Vitest ANSI-Folgen zwischen „Test Files" und
// „2 passed", und ein Muster über den rohen Text trifft nicht mehr. Die Ausgabe wird deshalb vor
// jedem Vergleich entfärbt. Der Steuerzeichen-Code steht als `fromCharCode`, nicht als Literal.
const OHNE_FARBE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const klartext = (s: string): string => s.replace(OHNE_FARBE, "");

it("JOB 3448 R3 · ein langsames, aber gültiges close() wird vollständig abgewartet und grün gewertet", async () => {
  const r = await lauf(false, true);
  const ausgabe = klartext(r.ausgabe);
  expect(ausgabe).toMatch(/Test Files\s+2 passed/);
  expect(r.code).toBe(0);
  const zeilen = [...ausgabe.matchAll(/Abbau: ([0-9.]+)ms; bestätigt=(\w+)/g)];
  expect(zeilen, "je Probedatei genau eine Protokollzeile aus dem Original-afterAll").toHaveLength(
    DATEIEN.length,
  );
  for (const [ganz, dauer, bestaetigt] of zeilen) {
    expect(bestaetigt, `${ganz}: der Abschluss wurde nicht bestätigt`).toBe("true");
    expect(
      Number(dauer),
      `${ganz}: die protokollierte Dauer belegt kein echtes Warten von ~2 s`,
    ).toBeGreaterThanOrEqual(2000);
  }
  // Und die eine Messstelle hat für beide Dateien eine Zeile mit der geltenden Grenze geschrieben.
  expect(ausgabe.match(/Chromium-Abbau · .* · [0-9.]+ms · Grenze/g)).toHaveLength(DATEIEN.length);
}, 180_000);

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
