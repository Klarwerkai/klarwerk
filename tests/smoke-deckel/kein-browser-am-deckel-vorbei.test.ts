// JOB 3201 · Browserstart am Inhalt erkennen; F4 bleibt im fremden Zielpfad unverändert.
// Basisstand: der unmittelbare Elterncommit des Prüfstands (wird beim Einbau gesetzt)
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Fenster, ueberlappendePaare } from "../tor-inventar/zeitfenster";

const WURZEL = join(__dirname, "../..");
type Skripte = Readonly<Record<string, string>>;

// Konservative Inhaltsmerkmale, keine Skriptnamen: Playwright-Testlauf, Installation
// (bewusst mit erfasst, damit nur die begründete Ausnahme frei bleibt), Chromium direkt
// und der Node-Einstieg mit chromium.launch(). Neue Starter brauchen ein weiteres Merkmal.
// smoke-dist-frisch.ts startet keinen Browser und braucht daher kein Startmerkmal.
const BROWSER_MUSTER = [
  /\bplaywright\s+test\b/,
  /\bplaywright\s+install\b/,
  /\bchromium\b/,
  /\bscripts\/smoke-browser\.mjs\b/,
] as const;

const AUSNAHMEN: Readonly<Record<string, string>> = {
  "smoke:browser:setup": "lädt Chromium herunter, startet keinen",
};

function ausnahmeFehler(scripts: Skripte, ausnahmen: Skripte = AUSNAHMEN): string[] {
  const fehler: string[] = [];
  if (Object.keys(ausnahmen).join() !== "smoke:browser:setup") {
    fehler.push("AUSNAHMEN muss genau smoke:browser:setup enthalten");
  }
  for (const [name, grund] of Object.entries(ausnahmen)) {
    if (!grund.trim()) fehler.push(`${name}: Ausnahme ohne Begründung`);
    if (!Object.hasOwn(scripts, name)) fehler.push(`${name}: Ausnahme fehlt in package.json`);
  }
  if (
    Object.hasOwn(scripts, "smoke:browser:setup") &&
    scripts["smoke:browser:setup"] !== "playwright install chromium"
  ) {
    fehler.push("smoke:browser:setup: Ausnahme gilt nur für playwright install chromium");
  }
  return fehler;
}

// Die im Repo verwendete Shell-Form: Zuweisungen, Wörter, Anführungszeichen und Ketten.
// Trennzeichen in Anführungszeichen bleiben im Wort; auch ||, Pipe und & trennen Schutzräume.
// Kein allgemeiner Shell-Interpreter: dynamisch erzeugte Befehle/Quelltexte werden nicht analysiert.
function teilbefehle(script: string): string[][] {
  const woerter = script.match(/(?:[^\s"';&|]+|"(?:\\.|[^"\\])*"|'[^']*')+|&&|\|\||[;&|\n]/g) ?? [];
  const teile: string[][] = [[]];
  for (const wort of woerter) {
    if (/^(?:&&|\|\||[;&|\n])$/.test(wort)) teile.push([]);
    else teile[teile.length - 1]?.push(wort);
  }
  return teile.filter((teil) => teil.length > 0);
}

function pruefeSkripte(scripts: Skripte | undefined): string[] {
  if (!scripts || Object.keys(scripts).length === 0)
    return ["package.json: scripts fehlt oder ist leer"];
  const verstoesse = new Set<string>();
  function pruefe(name: string, kette: readonly string[]) {
    const script = scripts?.[name];
    if (script === undefined || kette.includes(name)) {
      verstoesse.add(
        `${[...kette, name].join(" → ")}: Skript fehlt oder zyklischer npm-run-Verweis`,
      );
      return;
    }
    if (
      Object.hasOwn(AUSNAHMEN, name) &&
      AUSNAHMEN[name]?.trim() &&
      (name !== "smoke:browser:setup" || script === "playwright install chromium")
    )
      return;
    for (const teil of teilbefehle(script)) {
      const befehl = teil.join(" ");
      const woerter = teil.map((wort) => wort.replace(/(["'])(.*?)\1/g, "$2"));
      // Nur ein tatsächlich ausgeführter Deckel zählt, niemals dessen Name als echo-Argument.
      if (woerter[0] === "env") woerter.shift();
      while (/^[A-Za-z_][A-Za-z_0-9]*=/.test(woerter[0] ?? "")) woerter.shift();
      const geschuetzt =
        woerter[0] === "./tools/browserdeckel.sh" &&
        /^(browser|smoke)$/.test(woerter[1] ?? "") &&
        woerter.length > 2;
      if (geschuetzt) woerter.splice(0, 2);
      if (BROWSER_MUSTER.some((muster) => muster.test(woerter.join(" "))) && !geschuetzt) {
        verstoesse.add(`${[...kette, name].join(" → ")} → ${befehl}`);
      }
      if (woerter[0] === "npm" && woerter[1] === "run") {
        const referenz = woerter.slice(2).find((wort) => !wort.startsWith("-"));
        if (referenz) pruefe(referenz, [...kette, name]);
        else verstoesse.add(`${name} → ${befehl}: npm run ohne Skriptname`);
      }
    }
  }
  for (const name of Object.keys(scripts)) pruefe(name, []);
  return [...verstoesse];
}

function echteSkripte(): Skripte | undefined {
  return (JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as { scripts?: Skripte })
    .scripts;
}

describe("JOB 3201 · Kein Browser am Deckel vorbei", () => {
  it("W1 · jedes browserstartende npm-Skript trägt den Deckel", () => {
    const verstoesse = pruefeSkripte(echteSkripte());
    expect(verstoesse, verstoesse.join("\n")).toEqual([]);
  });

  it("W2 · erfundene Namen und ungeschützte Kettenglieder fallen auf", () => {
    expect(
      pruefeSkripte({
        "smoke:neu": "node scripts/smoke-browser.mjs",
        "smoke:kette": "npm run --silent smoke:ui:frisch && playwright test",
        "smoke:ui:frisch": "./tools/browserdeckel.sh smoke tsx scripts/smoke-dist-frisch.ts",
      }),
    ).toEqual(["smoke:neu → node scripts/smoke-browser.mjs", "smoke:kette → playwright test"]);
  });

  it("W3 · genau eine bestehende und begründete Installationsausnahme", () => {
    expect(ausnahmeFehler(echteSkripte() ?? {})).toEqual([]);
  });

  it("W4 · npm-run-Verweise werden rekursiv samt fehlerhaftem Glied gemeldet", () => {
    expect(
      pruefeSkripte({
        a: "npm run --silent b",
        b: "npm run c",
        c: "./tools/browserdeckel.sh smoke playwright test; chromium --headless",
      }),
    ).toEqual([
      "a → b → c → chromium --headless",
      "b → c → chromium --headless",
      "c → chromium --headless",
    ]);
  });

  it.each(["&&", ";", "||", "|", "&"])(
    "W5 · ein Deckel im Nachbarglied schützt bei %s in keiner Richtung",
    (trenner) => {
      const sicher = "./tools/browserdeckel.sh smoke playwright test";
      expect(
        pruefeSkripte({
          vorher: `${sicher} ${trenner} playwright test`,
          nachher: `playwright test ${trenner} ${sicher}`,
        }),
      ).toEqual(["vorher → playwright test", "nachher → playwright test"]);
    },
  );

  it("W6 · ohne Browser, mit Deckel und begründete Ausnahme bleiben grün", () => {
    expect(
      pruefeSkripte({
        bauen: "tsc --noEmit && npm run format",
        format: "biome check .",
        frisch: "./tools/browserdeckel.sh smoke tsx scripts/smoke-dist-frisch.ts",
        ui: 'KEY="a;b&&c" ./tools/browserdeckel.sh browser playwright test',
        direkt: "env MODE=1 ./tools/browserdeckel.sh smoke chromium --headless",
        node: "./tools/browserdeckel.sh smoke node scripts/smoke-browser.mjs",
        "smoke:browser:setup": "playwright install chromium",
      }),
    ).toEqual([]);
  });

  it("W7 · Installation unter anderem Namen und vorgetäuschter Deckel fallen auf", () => {
    const scripts = {
      download: "playwright install firefox",
      falsch: "./tools/browserdeckel.sh falsch playwright test",
      argument: "echo ./tools/browserdeckel.sh smoke playwright test",
      spaeter: "playwright test ./tools/browserdeckel.sh smoke",
      "smoke:browser:setup": "playwright install chromium; playwright test",
    };
    expect(pruefeSkripte(scripts)).toEqual([
      "download → playwright install firefox",
      "falsch → ./tools/browserdeckel.sh falsch playwright test",
      "argument → echo ./tools/browserdeckel.sh smoke playwright test",
      "spaeter → playwright test ./tools/browserdeckel.sh smoke",
      "smoke:browser:setup → playwright install chromium",
      "smoke:browser:setup → playwright test",
    ]);
    expect(ausnahmeFehler(scripts)).toEqual([
      "smoke:browser:setup: Ausnahme gilt nur für playwright install chromium",
    ]);
  });

  it("W8 · leere, verwaiste oder zusätzliche Ausnahmen werden rot gemeldet", () => {
    expect(ausnahmeFehler({}, { "smoke:browser:setup": "  " })).toEqual([
      "smoke:browser:setup: Ausnahme ohne Begründung",
      "smoke:browser:setup: Ausnahme fehlt in package.json",
    ]);
    expect(
      ausnahmeFehler(
        { "smoke:browser:setup": "playwright install chromium", neu: "true" },
        {
          ...AUSNAHMEN,
          neu: "nicht entschieden",
        },
      ),
    ).toEqual(["AUSNAHMEN muss genau smoke:browser:setup enthalten"]);
  });

  it.each([undefined, {}])(
    "W9 · fehlende oder leere scripts sind kein grüner Bestand: %j",
    (scripts) => {
      expect(pruefeSkripte(scripts)).toEqual(["package.json: scripts fehlt oder ist leer"]);
    },
  );

  it("W10 · fehlende und zyklische Verweise werden laut statt endlos verfolgt", () => {
    expect(pruefeSkripte({ a: "npm run b", c: "npm run c" })).toEqual([
      "a → b: Skript fehlt oder zyklischer npm-run-Verweis",
      "c → c: Skript fehlt oder zyklischer npm-run-Verweis",
    ]);
  });

  it("W11 · zwei gleichzeitige smoke-node-Aufrufe serialisieren echte Sonden", async () => {
    const basis = join(WURZEL, ".local/run");
    mkdirSync(basis, { recursive: true });
    const ort = mkdtempSync(join(basis, "smoke-deckel-"));
    // Wie werk() im bestehenden Deckeltest: unverändertes Werkzeug, eigener Arbeitsort.
    // So bleibt auch sein lokaler Journalschnappschuss vom echten Tor-Protokoll getrennt.
    mkdirSync(join(ort, "tools"));
    copyFileSync(join(WURZEL, "tools/browserdeckel.sh"), join(ort, "tools/browserdeckel.sh"));
    const sonde = join(ort, "sonde.cjs");
    writeFileSync(
      sonde,
      `
const fs = require('node:fs');
const von = Date.now();
setTimeout(() => fs.writeFileSync(process.env.SONDENPFAD,
  JSON.stringify({ datei: process.env.SONDENPFAD, von, bis: Date.now() })), 800);
`,
    );
    function starte(n: number) {
      const kind = spawn("./tools/browserdeckel.sh", ["smoke", "node", sonde], {
        cwd: ort,
        env: {
          ...process.env,
          KLARWERK_BROWSERDECKEL: "1",
          KLARWERK_BROWSERDECKEL_LOCK: join(ort, "deckel.lock"),
          KLARWERK_BROWSERDECKEL_TIMEOUT: "10",
          SONDENPFAD: join(ort, `${n}.json`),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      return new Promise<{ code: number | null; ausgabe: string }>((resolve) => {
        let ausgabe = "";
        kind.stdout.on("data", (data) => {
          ausgabe += data;
        });
        kind.stderr.on("data", (data) => {
          ausgabe += data;
        });
        const notbremse = setTimeout(() => kind.kill("SIGTERM"), 15_000);
        kind.on("error", (error) => {
          ausgabe += String(error);
        });
        kind.on("close", (code) => {
          clearTimeout(notbremse);
          resolve({ code, ausgabe });
        });
      });
    }
    try {
      const ergebnisse = await Promise.all([starte(1), starte(2)]);
      for (const e of ergebnisse) expect(e.code, e.ausgabe).toBe(0);
      const fenster = [1, 2].map(
        (n) => JSON.parse(readFileSync(join(ort, `${n}.json`), "utf8")) as Fenster,
      );
      for (const f of fenster) {
        expect(Number.isFinite(f.von)).toBe(true);
        expect(f.bis).toBeGreaterThan(f.von);
      }
      expect(ueberlappendePaare(fenster)).toEqual([]);
      console.log(
        `W11 Exit-Codes: ${ergebnisse.map((e) => e.code).join(", ")} · Fenster: ${JSON.stringify(fenster)} · Überlappungen: 0`,
      );
    } finally {
      rmSync(ort, { recursive: true, force: true });
    }
  }, 30_000);
});
