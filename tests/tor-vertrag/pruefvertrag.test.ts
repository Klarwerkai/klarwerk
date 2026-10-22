// ================================================================================================
// aufnahme:20260922:gesamt-prueftor-einheitlich — EIN PRÜFVERTRAG FÜR TOR UND CI.
// ================================================================================================
//
// „Ein Tor, das lokal strenger ist als in der CI, erzeugt genau die Sorte bei mir war es gruen, die
// niemand mehr nachvollziehen kann.“ Der CI-Job `check` ruft seit JOB 1080 `./tools/check`
// (ci-check-contract.test.ts, job1080-ci-workflow-abgleich.test.ts). Was bis hierher fehlte:
//
//   · Die Stufen des Tors standen nur als `echo "▶ …"` im Skript. Ging eine verloren, meldete das
//     Tor weiter grün; fiel es, stand nirgends, in welcher Stufe (R-1330, R-1405).
//   · Das Ergebnis trug weder Startverzeichnis noch geprüften Quellstand (Kriterien 1 und 3).
//   · Die Liste der NICHT gefahrenen Fälle stand von Hand in tools/check — „alle vier“, während der
//     Mengen-Pin acht führte. Die Meldung war hinter ihrem eigenen Wächter zurückgeblieben.
//
// Dieser Test pinnt den Vertrag (tools/pruefvertrag.json) gegen tools/check und den Workflow und
// fährt das ECHTE Stufenbuch (tools/pruefstufen.sh) mit Gegenfällen: rot in einer Stufe, eine
// ausgelassene, eine vertauschte und eine unbekannte Stufe, ein unlesbarer Vertrag.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), "utf8");

interface Vertrag {
  tor: string;
  stufen: { name: string; zweck: string; art?: string }[];
  ausserhalb: { weg: string; befehl: string; grund: string }[];
  nicht_im_tor: string;
  einbau: {
    abweichung: string;
    regeln: {
      befehl: string;
      stufen?: string[];
      engines?: Record<string, string[]>;
      ausserhalb?: string;
      umfang: string;
    }[];
  };
}
const VERTRAG = JSON.parse(lies("tools/pruefvertrag.json")) as Vertrag;
const TOR = lies("tools/check");
const YML = lies(".github/workflows/ci.yml");

/** Die `stufe <name>`-Aufrufe in tools/check, ohne Kommentarzeilen, in Laufreihenfolge. */
function torStufen(): string[] {
  return TOR.split("\n")
    .filter((z) => !z.trim().startsWith("#"))
    .map((z) => /^stufe\s+([a-z0-9-]+)/.exec(z)?.[1])
    .filter((n): n is string => n !== undefined);
}

function jobBlock(name: string): string {
  const zeilen = YML.split("\n");
  const kopf = zeilen.findIndex((z) => new RegExp(`^  ${name}:\\s*$`).test(z));
  if (kopf === -1) {
    throw new Error(`Jobblock „${name}" nicht gefunden`);
  }
  const rest = zeilen.slice(kopf + 1);
  const naechster = rest.findIndex((z) => /^ {2}\S/.test(z));
  return (naechster === -1 ? rest : rest.slice(0, naechster)).join("\n");
}

function runBefehle(block: string): string[] {
  return Array.from(block.matchAll(/^\s*(?:- )?run:\s*(.+?)\s*$/gm))
    .map((m) => m[1])
    .filter((b): b is string => b !== undefined);
}

function jobNamen(): string[] {
  const zeilen = YML.split("\n");
  const start = zeilen.findIndex((z) => /^jobs:\s*$/.test(z));
  return zeilen
    .slice(start + 1)
    .filter((z) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(z))
    .map((z) => z.trim().replace(/:$/, ""));
}

describe("Prüfvertrag · tools/check, CI und Vertrag sind dieselbe Definition", () => {
  it("V1 · tools/check fährt genau die Stufen des Vertrags, in seiner Reihenfolge", () => {
    expect(VERTRAG.tor).toBe("tools/check");
    expect(torStufen()).toEqual(VERTRAG.stufen.map((s) => s.name));
    // Kalibrierung: ohne Stufen wäre die Gleichheit oben geschenkt.
    expect(torStufen().length).toBeGreaterThanOrEqual(10);
    // Das Stufenbuch wird eingebunden, BEVOR die erste Stufe beginnt, und das Startverzeichnis wird
    // vor dem Verankern festgehalten.
    const einbinden = TOR.indexOf("source tools/pruefstufen.sh");
    expect(einbinden).toBeGreaterThan(-1);
    expect(einbinden).toBeLessThan(TOR.search(/^stufe /m));
    expect(TOR.indexOf('PRUEF_START="$PWD"')).toBeLessThan(TOR.indexOf('cd "$(dirname "$0")/.."'));
  });

  it("V2 · CI-Job `check` ruft dieses Tor; jeder andere CI-Job steht unter `ausserhalb`", () => {
    expect(runBefehle(jobBlock("check"))).toContain("./tools/check");
    const ciAusserhalb = VERTRAG.ausserhalb.filter((w) => w.weg.startsWith("CI-Job "));
    // Jeder weitere Job ist im Vertrag benannt — mit einem tatsächlich ausgeführten Befehl.
    for (const job of jobNamen().filter((j) => j !== "check")) {
      const befehle = runBefehle(jobBlock(job));
      const eintrag = ciAusserhalb.find((w) => w.weg === `CI-Job ${job}`);
      expect(eintrag, `CI-Job „${job}" fehlt im Prüfvertrag`).toBeDefined();
      expect(befehle).toContain(eintrag?.befehl);
    }
    // Gegenrichtung: kein Vertragseintrag für einen Job, den es nicht gibt.
    for (const eintrag of ciAusserhalb) {
      expect(jobNamen()).toContain(eintrag.weg.replace(/^CI-Job /, ""));
    }
  });

  it("V3 · die nicht gefahrenen Fälle stehen in EINER Datei für Pin und Bericht", () => {
    expect(VERTRAG.nicht_im_tor).toBe("tests/smoke/tor-ausnahmen.json");
    const faelle = JSON.parse(lies(VERTRAG.nicht_im_tor)) as { file: string; title: string }[];
    expect(faelle.length).toBeGreaterThan(0);
    for (const fall of faelle) {
      expect(fall.title, `${fall.file}: Ausnahme ohne @modell-Marke`).toMatch(/@modell$/);
    }
    expect(lies("tests/smoke/tor-ausnahme.test.ts")).toContain('"./tor-ausnahmen.json"');
    // Die handgeschriebene Zählung ist weg — sie war der Befund.
    const ausgaben = TOR.split("\n").filter((z) => /^\s*echo\s/.test(z));
    expect(ausgaben.filter((z) => /@modell/.test(z) && /vier|VIER/.test(z))).toEqual([]);
  });

  it("V4 · der Bericht nennt jeden Weg ausserhalb und jeden ausgenommenen Fall", () => {
    const lauf = spawnSync("node", [join(WURZEL, "tools", "tor-bericht.mjs"), "--ausserhalb"], {
      encoding: "utf8",
    });
    expect(lauf.status, lauf.stderr).toBe(0);
    for (const weg of VERTRAG.ausserhalb) {
      expect(lauf.stdout).toContain(weg.befehl);
    }
    const faelle = JSON.parse(lies(VERTRAG.nicht_im_tor)) as { file: string; title: string }[];
    expect(lauf.stdout).toContain(`${faelle.length} benannte @modell-Fälle`);
    for (const fall of faelle) {
      expect(lauf.stdout).toContain(`${fall.file} › ${fall.title}`);
    }
  });

  it("V5 · der Plan trägt die Stufenart; die meldende Stufe ist benannt", () => {
    const lauf = spawnSync("node", [join(WURZEL, "tools", "tor-bericht.mjs"), "--stufen"], {
      encoding: "utf8",
    });
    expect(lauf.status, lauf.stderr).toBe(0);
    const zeilen = lauf.stdout.trim().split("\n");
    expect(zeilen).toHaveLength(VERTRAG.stufen.length);
    expect(zeilen).toContain("arbeitsordner-diagnose meldend");
    expect(zeilen).toContain("zentrale-drift sperrend");
    const meldend = zeilen.filter((z) => z.endsWith(" meldend"));
    expect(meldend).toEqual(["arbeitsordner-diagnose meldend"]);
  });

  it("V6 · tools/check übergibt den Messstatus von zentrale-drift und Testfilter", () => {
    const ausfuehrbar = TOR.split("\n").filter((z) => !z.trim().startsWith("#"));
    const zentrale = ausfuehrbar.find((z) => z.startsWith('case "$zentrale_rc"'));
    expect(zentrale).toMatch(/2\) stufe_status nicht-gemessen /);
    expect(zentrale).toMatch(/\*\) stufe_status nicht-gemessen /);
    expect(ausfuehrbar).toContain(
      'if [ "$#" -gt 0 ]; then stufe_status auswahl "Argumente an tools/test: $*"; fi',
    );
  });
});

// ------------------------------------------------------------------------------------------------
// Gegenfälle am echten Stufenbuch. Der Sandkasten bekommt einen eigenen Vertrag (a, b, c) über
// KLARWERK_PRUEFVERTRAG und ein Mini-Tor, das tools/pruefstufen.sh genauso einbindet wie tools/check.
// ------------------------------------------------------------------------------------------------

let sandkasten: string;
let wurzel: string;
let start: string;

beforeEach(() => {
  sandkasten = realpathSync(mkdtempSync(join(tmpdir(), "pruefvertrag-")));
  wurzel = join(sandkasten, "wurzel");
  start = join(sandkasten, "anderswo");
  mkdirSync(wurzel);
  mkdirSync(start);
  writeFileSync(
    join(sandkasten, "vertrag.json"),
    JSON.stringify({
      tor: "mini",
      stufen: [
        { name: "a", zweck: "eins" },
        { name: "b", zweck: "zwei" },
        { name: "c", zweck: "drei" },
      ],
      ausserhalb: [{ weg: "CI-Job probe", befehl: "probe-befehl", grund: "nur ein Beispiel" }],
    }),
  );
});

afterEach(() => {
  rmSync(sandkasten, { recursive: true, force: true });
});

/** Fährt ein Mini-Tor mit den gegebenen Zeilen nach dem Einbinden. */
function miniTor(
  zeilen: string[],
  vertrag = join(sandkasten, "vertrag.json"),
  args: string[] = [],
) {
  const skript = join(sandkasten, "mini-tor.sh");
  const inhalt = [
    "set -euo pipefail",
    'PRUEF_START="$PWD"',
    `cd "${wurzel}"`,
    `source "${join(WURZEL, "tools", "pruefstufen.sh")}"`,
    ...zeilen,
  ].join("\n");
  writeFileSync(skript, inhalt);
  const umgebung: NodeJS.ProcessEnv = {
    ...process.env,
    KLARWERK_PRUEFVERTRAG: vertrag,
    GIT_CEILING_DIRECTORIES: dirname(sandkasten),
  };
  delete umgebung.GIT_DIR;
  delete umgebung.GIT_WORK_TREE;
  const lauf = spawnSync("bash", [skript, ...args], {
    cwd: start,
    env: umgebung,
    encoding: "utf8",
  });
  return { code: lauf.status, aus: `${lauf.stdout}${lauf.stderr}` };
}

describe("Prüfvertrag · Gegenfälle am echten Stufenbuch (tools/pruefstufen.sh)", () => {
  it("G1 · rot in Stufe b: Stufe, Bestandenes, nicht Erreichtes; der Code bleibt", () => {
    const { code, aus } = miniTor(["stufe a; true", "stufe b; exit 7", "stufe c; true"]);
    expect(code, aus).toBe(7);
    expect(aus).toContain("ROT in Stufe „b“ (Code 7)");
    expect(aus).toMatch(/gemessen\s+: a\n/);
    expect(aus).toMatch(/nicht erreicht\s+: c\n/);
    expect(aus).not.toContain("✓ check grün");
    // Auch der rote Lauf sagt, was das Tor gar nicht fährt.
    expect(aus).toContain("CI-Job probe: probe-befehl — nur ein Beispiel");
  });

  it("G1b · ein fehlschlagender Befehl unter `set -e` wird derselben Stufe zugeordnet", () => {
    const { code, aus } = miniTor(["stufe a; true", "stufe b; false", "stufe c; true"]);
    expect(code, aus).toBe(1);
    expect(aus).toContain("ROT in Stufe „b“ (Code 1)");
  });

  it("G2 · alle Stufen in Reihenfolge: grün, mit Startverzeichnis, Wurzel, Quellstand", () => {
    const { code, aus } = miniTor(["stufe a; true", "stufe b 'mit Erläuterung'; true", "stufe c"]);
    expect(code, aus).toBe(0);
    expect(aus).toContain("▶ b (mit Erläuterung)");
    expect(aus).toContain("grün — alle 3 Stufen des Vertrags in seiner Reihenfolge gelaufen");
    expect(aus).toContain(`Startverzeichnis : ${start}`);
    expect(aus).toContain(`Wurzel           : ${wurzel}`);
    expect(aus).toContain("Quellstand       : unbekannt (kein git-Stand lesbar)");
    expect(aus.trimEnd().endsWith("✓ check grün")).toBe(true);
  });

  it("G3 · eine ausgelassene Stufe macht einen fehlerfreien Lauf ROT", () => {
    const { code, aus } = miniTor(["stufe a; true", "stufe c; true"]);
    expect(code, aus).toBe(1);
    expect(aus).toContain("fuhr aber nicht genau den Vertrag");
    expect(aus).toMatch(/gelaufen\s+: a c\n/);
    expect(aus).not.toContain("✓ check grün");
  });

  it("G4 · eine vertauschte Reihenfolge macht einen fehlerfreien Lauf ROT", () => {
    const { code, aus } = miniTor(["stufe b; true", "stufe a; true", "stufe c; true"]);
    expect(code, aus).toBe(1);
    expect(aus).toContain("fuhr aber nicht genau den Vertrag");
  });

  it("G5 · eine Stufe, die nicht im Vertrag steht, bricht ab und wird benannt", () => {
    const { code, aus } = miniTor(["stufe a; true", "stufe neu; true", "stufe b; true"]);
    expect(code, aus).toBe(3);
    expect(aus).toContain("Stufe „neu“ steht nicht in tools/pruefvertrag.json");
    expect(aus).toMatch(/gemessen\s+: a\n/);
    expect(aus).toMatch(/nicht erreicht\s+: b c\n/);
  });

  it("G6 · ein unlesbarer Vertrag hält das Tor vor der ersten Stufe an", () => {
    const { code, aus } = miniTor(["stufe a; echo LIEF"], join(sandkasten, "fehlt.json"));
    expect(code, aus).toBe(2);
    expect(aus).toContain("Prüfvertrag nicht lesbar");
    expect(aus).not.toContain("LIEF");
  });

  it("G7 · der Quellstand nennt Commit und Abweichungen des Baums", () => {
    const identitaet = ["-c", "user.name=probe", "-c", "user.email=probe@example.invalid"];
    const umgebung = { ...process.env, GIT_CEILING_DIRECTORIES: "" };
    function git(...args: string[]) {
      return spawnSync("git", [...identitaet, ...args], {
        cwd: wurzel,
        encoding: "utf8",
        env: umgebung,
      });
    }
    expect(git("init", "-q").status).toBe(0);
    writeFileSync(join(wurzel, "datei.txt"), "eins\n");
    expect(git("add", "datei.txt").status).toBe(0);
    expect(git("-c", "commit.gpgsign=false", "commit", "-qm", "probe").status).toBe(0);
    const commit = git("rev-parse", "HEAD").stdout.trim();
    expect(commit).toMatch(/^[0-9a-f]{40}$/);

    const sauber = miniTor(["stufe a", "stufe b", "stufe c"]);
    expect(sauber.aus).toContain(`Quellstand       : ${commit} (Baum gleich dem Commit)`);

    writeFileSync(join(wurzel, "datei.txt"), "zwei\n");
    writeFileSync(join(wurzel, "neu.txt"), "neu\n");
    const geaendert = miniTor(["stufe a", "stufe b", "stufe c"]);
    expect(geaendert.aus).toContain(
      `Quellstand       : ${commit} + 2 geänderte oder neue, nicht ignorierte Dateien`,
    );
  });
});

// ------------------------------------------------------------------------------------------------
// R-1405 · GELAUFEN IST NICHT GEMESSEN (Bens Befund zu nacharbeit-2). Die Fälle G9/G10 fahren die
// ECHTEN Zeilen aus tools/check gegen Attrappen von zentrale-drift bzw. tools/test.
// ------------------------------------------------------------------------------------------------

/** Ein Sandkastenvertrag mit den gegebenen Stufen. */
function vertragMit(stufen: { name: string; art?: string }[]): string {
  const datei = join(sandkasten, `vertrag-${stufen.map((s) => s.name).join("-")}.json`);
  writeFileSync(datei, JSON.stringify({ tor: "mini", stufen, ausserhalb: [] }));
  return datei;
}

/** Ausführbare Zeilen aus tools/check von `von` bis einschliesslich `bis`. */
function torZeilen(von: RegExp, bis: RegExp): string[] {
  const zeilen = TOR.split("\n");
  const a = zeilen.findIndex((z) => von.test(z));
  const b = zeilen.findIndex((z, i) => i >= a && bis.test(z));
  if (a === -1 || b === -1) {
    throw new Error(`tools/check: Abschnitt ${von} … ${bis} nicht gefunden`);
  }
  return zeilen.slice(a, b + 1).filter((z) => !z.trim().startsWith("#"));
}

/** Eine Attrappe unter wurzel/tools, die mit dem gegebenen Code endet. */
function attrappe(name: string, code: number): void {
  mkdirSync(join(wurzel, "tools"), { recursive: true });
  writeFileSync(join(wurzel, "tools", name), `#!/usr/bin/env bash\nexit ${code}\n`, {
    mode: 0o755,
  });
}

describe("Prüfvertrag · Messstatus je Stufe (R-1405)", () => {
  it("G8 · nicht gemessen, meldend und gemessen stehen getrennt, nie als „bestanden“", () => {
    const vertrag = vertragMit([{ name: "a" }, { name: "b", art: "meldend" }, { name: "c" }]);
    const { code, aus } = miniTor(
      ["stufe a; stufe_status nicht-gemessen 'nichts da'", "stufe b", "stufe c"],
      vertrag,
    );
    expect(code, aus).toBe(0);
    expect(aus).toContain("NICHT alle vollständig gemessen");
    expect(aus).toMatch(/gemessen\s+: c\n/);
    expect(aus).toMatch(/nicht gemessen\s+: a \(nichts da\)\n/);
    expect(aus).toMatch(/nur meldend\s+: b\n/);
    expect(aus).not.toContain("bestanden");
  });

  it("G9 · zentrale-drift: Code 2 ist „nicht gemessen“, 1 sperrt, 0 ist gemessen", () => {
    const zeilen = torZeilen(/^stufe zentrale-drift/, /^case "\$zentrale_rc"/);
    const vertrag = vertragMit([{ name: "zentrale-drift" }]);

    attrappe("zentrale-drift.sh", 2);
    const zwei = miniTor(zeilen, vertrag);
    expect(zwei.code, zwei.aus).toBe(0);
    expect(zwei.aus).toMatch(/nicht gemessen\s+: zentrale-drift \(Lesefläche nicht da, Code 2\)\n/);
    expect(zwei.aus).toMatch(/gemessen\s+: keine\n/);

    attrappe("zentrale-drift.sh", 1);
    const eins = miniTor(zeilen, vertrag);
    expect(eins.code, eins.aus).toBe(1);
    expect(eins.aus).toContain("ROT in Stufe „zentrale-drift“ (Code 1)");

    attrappe("zentrale-drift.sh", 0);
    const null_ = miniTor(zeilen, vertrag);
    expect(null_.code, null_.aus).toBe(0);
    expect(null_.aus).toMatch(/gemessen\s+: zentrale-drift\n/);
    expect(null_.aus).not.toContain("nicht gemessen");

    attrappe("zentrale-drift.sh", 7);
    const sieben = miniTor(zeilen, vertrag);
    expect(sieben.aus).toMatch(/nicht gemessen\s+: zentrale-drift \(unerwarteter Code 7\)\n/);
  });

  it("G10 · tools/test mit Argumenten ist „nur Auswahl“, ohne Argumente gemessen", () => {
    const zeilen = torZeilen(/^stufe test$/, /^\.\/tools\/test "\$@"$/);
    const vertrag = vertragMit([{ name: "test" }]);
    attrappe("test", 0);

    const gefiltert = miniTor(zeilen, vertrag, ["tests/x.test.ts"]);
    expect(gefiltert.code, gefiltert.aus).toBe(0);
    expect(gefiltert.aus).toMatch(
      /nur Auswahl\s+: test \(Argumente an tools\/test: tests\/x\.test\.ts\)\n/,
    );

    const voll = miniTor(zeilen, vertrag);
    expect(voll.aus).toMatch(/gemessen\s+: test\n/);
    expect(voll.aus).not.toContain("nur Auswahl");
  });

  it("G11 · ein unbekannter Messstatus oder einer ohne laufende Stufe bricht ab", () => {
    const erfunden = miniTor(["stufe a; stufe_status erfunden", "stufe b", "stufe c"]);
    expect(erfunden.code, erfunden.aus).toBe(3);
    expect(erfunden.aus).toContain("unbekannter Messstatus „erfunden“");
    const ohne = miniTor(["stufe_status auswahl", "stufe a", "stufe b", "stufe c"]);
    expect(ohne.code, ohne.aus).toBe(3);
  });
});

// ------------------------------------------------------------------------------------------------
// K1 · DER EINBAU-/AUSLIEFERUNGSWEG GEGEN DENSELBEN VERTRAG. E1 benutzt die Form der tatsächlichen
// Prüfliste aus HISTORIE/nacharbeit-2/PRUEFUNG/checks.json (Befehle wörtlich, Pfade gekürzt).
// ------------------------------------------------------------------------------------------------

function einbau(liste: unknown) {
  const datei = join(sandkasten, "pruefliste.json");
  writeFileSync(datei, JSON.stringify(liste));
  const lauf = spawnSync("node", [join(WURZEL, "tools", "tor-bericht.mjs"), "--einbau", datei], {
    encoding: "utf8",
  });
  return { code: lauf.status, aus: `${lauf.stdout}${lauf.stderr}` };
}

const N = VERTRAG.stufen.length;

/** Ein Playwright-JSON-Laufbericht `<name>.json` neben der Prüfliste, wie der Adapter ihn ablegt. */
function laufbericht(name: string, faelle: { projekt: string; status?: string }[]): void {
  const tests = faelle.map((f) => ({
    projectName: f.projekt,
    results: f.status ? [{ status: f.status }] : [],
  }));
  const bericht = {
    config: {},
    suites: [{ title: "x.spec.ts", specs: [], suites: [{ title: "fall", specs: [{ tests }] }] }],
    stats: {},
  };
  writeFileSync(join(sandkasten, `${name}.json`), JSON.stringify(bericht));
}

/** Die tatsächliche Smoke-Zeile aus HISTORIE/nacharbeit-49/PRUEFUNG/checks.json, Projekt wählbar. */
function dreiSmoke(projekte: string[], exit: number | undefined = 0) {
  return {
    name: "smoke",
    command: [
      "npm",
      "run",
      "--silent",
      "smoke:ui:gate:drei",
      "--",
      ...projekte,
      "tests\\-smoke/klara\\-eigeninitiative\\-browser\\.spec\\.ts$",
      "--reporter=line,json",
    ],
    ...(exit === undefined ? {} : { exit }),
  };
}

describe("Prüfvertrag · Einbau-/Auslieferungsweg (tools/tor-bericht.mjs --einbau)", () => {
  it("E1 · echte Einbau-Prüfliste: Bau voll, Lint/Tests Auswahl, Rest nicht ausgeführt", () => {
    const { code, aus } = einbau([
      { name: "build", command: ["bash", "./tools/build"], exit: 0 },
      {
        name: "ausnahmeliste-nachgetragen",
        command: [
          "node_modules/.bin/vitest",
          "run",
          "tests/smoke/tor-ausnahme.test.ts",
          "tests/tor-vertrag/pruefvertrag.test.ts",
          "--maxWorkers=1",
          "--reporter=json",
          "--outputFile=/tmp/ergebnis.json",
        ],
        exit: 0,
      },
      {
        name: "format",
        command: ["node_modules/.bin/biome", "check", "package.json", "tools/tor-bericht.mjs"],
        exit: 0,
      },
    ]);
    expect(code, aus).toBe(1);
    expect(aus).toMatch(/▶ build\s+voll — Prüfung „build“, Exit 0/);
    expect(aus).toMatch(/▶ lint\s+nur Auswahl \(2 Ziele: package\.json, tools\/tor-bericht\.mjs\)/);
    expect(aus).toContain(
      "nur Auswahl (2 Ziele: tests/smoke/tor-ausnahme.test.ts, tests/tor-vertrag/pruefvertrag.test.ts)",
    );
    expect(aus).toMatch(/✗ architecture\s+NICHT ausgeführt/);
    expect(aus).toMatch(/✗ geheimnis-scan\s+NICHT ausgeführt/);
    expect(aus).toContain(
      `3 von ${N} Vertragsstufen nachweislich gefahren, ${N - 3} nicht, 0 unbekannt`,
    );
    expect(aus).toContain(`Begründete Abweichung: ${VERTRAG.einbau.abweichung}`);
  });

  // Bens Befund zu nacharbeit-3: E2 bestätigte hier „alle Stufen gefahren“ für einen bloss GEPLANTEN
  // tools/check-Eintrag. Plan ist kein Lauf — der Umfang ist unbekannt.
  it("E2 · ein nur geplanter Vollcheck ist kein Laufnachweis: jede Stufe unbekannt", () => {
    const { code, aus } = einbau({ checks: [["gesamttor", ["bash", "tools/check"]]] });
    expect(code, aus).toBe(1);
    expect(aus).toContain(
      `0 von ${N} Vertragsstufen nachweislich gefahren, 0 nicht, ${N} unbekannt`,
    );
    expect(aus).toMatch(
      /\? architecture\s+Ausführung unbekannt \(kein Stufenbericht\) — Prüfung „gesamttor“, geplant, kein Laufnachweis/,
    );
    expect(aus).not.toMatch(/^\s+▶ /m);
  });

  it("E2-npm · npm run check ohne Stufenbericht bleibt unbekannt statt voll bestanden", () => {
    const { code, aus } = einbau([
      { name: "npm-check", command: ["npm", "run", "check"], exit: 0 },
    ]);
    expect(code, aus).toBe(1);
    expect(aus).toContain(
      `0 von ${N} Vertragsstufen nachweislich gefahren, 0 nicht, ${N} unbekannt`,
    );
    expect(aus).not.toMatch(/^\s+▶ /m);
  });

  it("E2b · Abbruch bei architecture: davor gelaufen, dort rot, danach nicht erreicht", () => {
    // Bericht wörtlich aus HISTORIE/nacharbeit-1/PRUEFUNG/gesamttor.log (Zeilen 6253–6259), dem
    // tatsächlichen Gesamtcheck am Kandidaten 7e37f277 — noch in der Form vor dem Messstatus.
    writeFileSync(
      join(sandkasten, "gesamttor.log"),
      [
        "✖ Architekturregeln verletzt",
        "",
        "── Prüftor-Bericht (Vertrag: tools/pruefvertrag.json) ──",
        "  Startverzeichnis : /home/kn/pruef",
        "  Wurzel           : /home/kn/pruef",
        "  Quellstand       : 7e37f277018f943bf3c74e40fe86cd1c1eab5862 (Baum gleich dem Commit)",
        "  Ergebnis         : ROT in Stufe „architecture“ (Code 1)",
        "  bestanden        : cwd-vertrag build lint",
        "  nicht erreicht   : modalgrenze zentrale-drift arbeitsordner-diagnose geheimnis-scan test ui-smoke-chromium ui-smoke-firefox ui-smoke-webkit ui-smoke-geseedet",
        "",
      ].join("\n"),
    );
    const { code, aus } = einbau([
      { name: "gesamttor", command: ["bash", "tools/check"], exit: 1 },
    ]);
    expect(code, aus).toBe(1);
    expect(aus).toMatch(
      /▶ build\s+gelaufen, Messstatus in diesem Bericht nicht erhoben — Prüfung „gesamttor“, Exit 1/,
    );
    expect(aus).toMatch(/▶ architecture\s+ROT \(Code 1\) — Prüfung „gesamttor“, Exit 1/);
    expect(aus).toMatch(/✗ modalgrenze\s+NICHT erreicht — Prüfung „gesamttor“, Exit 1/);
    expect(aus).toMatch(/✗ ui-smoke-geseedet\s+NICHT erreicht/);
    expect(aus).not.toMatch(/▶ test\s/);
    expect(aus).toContain(
      `4 von ${N} Vertragsstufen nachweislich gefahren, ${N - 4} nicht, 0 unbekannt`,
    );
  });

  it("E2c · ein grüner Gesamtcheck übernimmt den Messstatus aus seinem Stufenbericht", () => {
    const besonders = ["zentrale-drift", "test", "arbeitsordner-diagnose"];
    const gemessen = VERTRAG.stufen.map((s) => s.name).filter((s) => !besonders.includes(s));
    writeFileSync(
      join(sandkasten, "eigenes-protokoll.log"),
      [
        "── Prüftor-Bericht (Vertrag: tools/pruefvertrag.json) ──",
        `  Ergebnis         : grün — alle ${N} Stufen des Vertrags in seiner Reihenfolge gelaufen, NICHT alle vollständig gemessen`,
        `  gemessen         : ${gemessen.join(" ")}`,
        "  nicht gemessen   : zentrale-drift (Lesefläche nicht da, Code 2)",
        "  nur Auswahl      : test (Argumente an tools/test: tests/x.test.ts)",
        "  nur meldend      : arbeitsordner-diagnose",
        "✓ check grün",
      ].join("\n"),
    );
    const { code, aus } = einbau([
      {
        name: "gesamttor",
        command: ["./tools/check", "tests/x.test.ts"],
        exit: 0,
        log: "eigenes-protokoll.log",
      },
    ]);
    expect(code, aus).toBe(0);
    expect(aus).toMatch(
      /▶ zentrale-drift\s+gelaufen, nicht gemessen \(Lesefläche nicht da, Code 2\)/,
    );
    expect(aus).toMatch(/▶ test\s+nur Auswahl \(Argumente an tools\/test: tests\/x\.test\.ts\)/);
    expect(aus).toMatch(/▶ arbeitsordner-diagnose\s+meldend — /);
    expect(aus).toMatch(/▶ build\s+gemessen — Prüfung „gesamttor“, Exit 0/);
    expect(aus).toContain(
      `${N} von ${N} Vertragsstufen nachweislich gefahren, 0 nicht, 0 unbekannt`,
    );
  });

  it("E2d · ein gelaufener Gesamtcheck ohne Stufenbericht im Protokoll bleibt unbekannt", () => {
    const alle = `0 von ${N} Vertragsstufen nachweislich gefahren, 0 nicht, ${N} unbekannt`;
    const ohne = einbau([{ name: "gesamttor", command: ["bash", "tools/check"], exit: 0 }]);
    expect(ohne.aus).toContain(alle);
    expect(ohne.aus).toContain(
      "Ausführung unbekannt (kein Stufenbericht) — Prüfung „gesamttor“, Exit 0",
    );

    writeFileSync(join(sandkasten, "gesamttor.log"), "irgendeine Ausgabe ohne Bericht\n");
    const leer = einbau([{ name: "gesamttor", command: ["bash", "tools/check"], exit: 1 }]);
    expect(leer.aus).toContain(alle);
  });

  it("E2e · ein nur geplanter Einzelbefehl ist unbekannt, nicht gefahren", () => {
    const { aus } = einbau({ checks: [["build", ["bash", "./tools/build"]]] });
    expect(aus).toMatch(/\? build\s+voll — Prüfung „build“, geplant, kein Laufnachweis/);
    expect(aus).toContain(
      `0 von ${N} Vertragsstufen nachweislich gefahren, ${N - 1} nicht, 1 unbekannt`,
    );
  });

  it("E3 · ein Befehl ohne Regel ist eine eigene Pipeline und macht den Bericht rot", () => {
    const { code, aus } = einbau({ checks: [["eigenes", ["bash", "scripts/irgendwas.sh"]]] });
    expect(code, aus).toBe(1);
    expect(aus).toContain("nicht im Vertrag beschrieben");
    expect(aus).toContain("„eigenes“: bash scripts/irgendwas.sh");
  });

  it("E4 · Postgres-Integration steht ausserhalb, der Gate-Smoke trifft seine Stufe", () => {
    laufbericht("smoke", [{ projekt: "chromium", status: "passed" }]);
    const { code, aus } = einbau([
      {
        name: "pg",
        command: [
          "node_modules/.bin/vitest",
          "run",
          "--config",
          "vitest.integration.config.ts",
          "tests/a.integration.test.ts",
        ],
        exit: 0,
      },
      {
        name: "smoke",
        command: ["npm", "run", "smoke:ui:gate", "--", "tests-smoke/x.spec.ts"],
        exit: 0,
      },
    ]);
    expect(code, aus).toBe(1);
    expect(aus).toContain(
      "ausserhalb des Tors: CI-Job integration: nur Auswahl (1 Ziel: tests/a.integration.test.ts)",
    );
    expect(aus).toMatch(/▶ ui-smoke-chromium\s+nur Auswahl \(1 Ziel: tests-smoke\/x\.spec\.ts\)/);
    expect(aus).toContain("chromium: 1 gelaufen, 1 bestanden — Prüfung „smoke“, Exit 0");
    expect(aus).toMatch(/✗ test\s+NICHT ausgeführt/);
  });

  it("E5 · jede Einbauregel zeigt auf eine Vertragsstufe oder einen Weg ausserhalb", () => {
    const namen = VERTRAG.stufen.map((s) => s.name);
    const wege = VERTRAG.ausserhalb.map((w) => w.weg);
    for (const regel of VERTRAG.einbau.regeln) {
      if (regel.ausserhalb) {
        expect(wege, regel.befehl).toContain(regel.ausserhalb);
      } else {
        for (const s of regel.stufen ?? []) {
          expect(s === "*" || namen.includes(s), `${regel.befehl} → ${s}`).toBe(true);
        }
        expect((regel.stufen ?? []).length, regel.befehl).toBeGreaterThan(0);
      }
    }
  });

  it("E6 · eine unlesbare Prüfliste ist Code 2, kein leerer Bericht", () => {
    const lauf = spawnSync(
      "node",
      [join(WURZEL, "tools", "tor-bericht.mjs"), "--einbau", join(sandkasten, "fehlt.json")],
      { encoding: "utf8" },
    );
    expect(lauf.status).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------
// Bens Befund zu nacharbeit-49: `smoke:ui:gate:drei --project=chromium-zustand` wurde für alle drei
// Engines gezählt. Die Engine folgt jetzt aus Projektauswahl UND Laufbericht.
// ------------------------------------------------------------------------------------------------
describe("Prüfvertrag · Einbauweg: Engines aus Projektauswahl und Laufbericht", () => {
  it("E7 · Lauf aus nacharbeit-49: nur chromium-zustand, Firefox/WebKit nicht", () => {
    laufbericht("smoke", [
      { projekt: "setup-zustand", status: "passed" },
      { projekt: "chromium-zustand", status: "passed" },
    ]);
    const { code, aus } = einbau([
      { name: "build", command: ["bash", "./tools/build"], exit: 0 },
      {
        name: "unit",
        command: ["node_modules/.bin/vitest", "run", "tests/a.test.ts"],
        exit: 0,
      },
      dreiSmoke(["--project=chromium-zustand"]),
      { name: "format", command: ["node_modules/.bin/biome", "check", "package.json"], exit: 0 },
    ]);
    expect(code, aus).toBe(1);
    expect(aus).toMatch(
      /▶ ui-smoke-chromium\s+nur Auswahl .*chromium-zustand: 1 gelaufen, 1 bestanden/,
    );
    expect(aus).toMatch(/✗ ui-smoke-firefox\s+nicht ausgewählt \(--project chromium-zustand\)/);
    expect(aus).toMatch(/✗ ui-smoke-webkit\s+nicht ausgewählt \(--project chromium-zustand\)/);
    // Das Setup-Projekt ist keine Engine.
    expect(aus).not.toMatch(/setup-zustand: /);
    expect(aus).toContain(
      `4 von ${N} Vertragsstufen nachweislich gefahren, ${N - 4} nicht, 0 unbekannt`,
    );
  });

  it("E7b · eine einzelne andere Engine zählt nur für sich", () => {
    laufbericht("smoke", [
      { projekt: "setup", status: "passed" },
      { projekt: "firefox", status: "passed" },
    ]);
    const { aus } = einbau([dreiSmoke(["--project=firefox"])]);
    expect(aus).toMatch(/▶ ui-smoke-firefox\s+.*firefox: 1 gelaufen, 1 bestanden/);
    expect(aus).toMatch(/✗ ui-smoke-chromium\s+nicht ausgewählt \(--project firefox\)/);
    expect(aus).toMatch(/✗ ui-smoke-webkit\s+nicht ausgewählt/);
    expect(aus).toContain(`1 von ${N} Vertragsstufen nachweislich gefahren`);
  });

  it.each(["berichte/browserlauf.json", "absolut"])(
    "E7-pfad · der ausdrücklich angegebene Bericht %s wird ausgewertet",
    (pfad) => {
      laufbericht("vorlage", [{ projekt: "firefox", status: "passed" }]);
      const bericht = pfad === "absolut" ? join(sandkasten, "browserlauf.json") : pfad;
      const ziel = pfad === "absolut" ? bericht : join(sandkasten, bericht);
      mkdirSync(dirname(ziel), { recursive: true });
      writeFileSync(ziel, readFileSync(join(sandkasten, "vorlage.json")));
      // Der Namensstandard widerspricht absichtlich: maßgeblich ist der angegebene Laufbericht.
      laufbericht("smoke", [{ projekt: "chromium", status: "passed" }]);
      const { code, aus } = einbau([{ ...dreiSmoke([]), bericht }]);
      expect(code, aus).toBe(1);
      expect(aus).toMatch(/▶ ui-smoke-firefox\s+.*firefox: 1 gelaufen, 1 bestanden/);
      expect(aus).toMatch(/✗ ui-smoke-chromium\s+.*kein gelaufener Fall/);
    },
  );

  it("E7-pfad-fehlt · ein fehlender ausdrücklicher Bericht wird nicht durch den Namensstandard ersetzt", () => {
    laufbericht("smoke", [{ projekt: "firefox", status: "passed" }]);
    const { aus } = einbau([{ ...dreiSmoke([]), bericht: "fehlt.json" }]);
    expect(aus).toContain("kein lesbarer Laufbericht (fehlt.json)");
    expect(aus).toContain(`0 von ${N} Vertragsstufen nachweislich gefahren`);
  });

  it("E7c · ohne Laufbericht ist keine Engine gefahren — unbekannt", () => {
    const { aus } = einbau([dreiSmoke([])]);
    for (const s of ["chromium", "firefox", "webkit"]) {
      const zeile = `\\? ui-smoke-${s}\\s+nur Auswahl .*kein lesbarer Laufbericht \\(smoke\\.json\\)`;
      expect(aus).toMatch(new RegExp(zeile));
    }
    expect(aus).toContain(
      `0 von ${N} Vertragsstufen nachweislich gefahren, ${N - 3} nicht, 3 unbekannt`,
    );
    writeFileSync(join(sandkasten, "smoke.json"), "kein json");
    const kaputt = einbau([dreiSmoke([])]);
    expect(kaputt.aus).toContain(`0 von ${N} Vertragsstufen nachweislich gefahren`);
  });

  it("E7d · leerer Bericht, übersprungene oder nicht gestartete Fälle zählen nicht", () => {
    laufbericht("smoke", [
      { projekt: "chromium", status: "passed" },
      { projekt: "firefox", status: "skipped" },
      { projekt: "webkit" },
    ]);
    const { aus } = einbau([dreiSmoke([])]);
    expect(aus).toMatch(/▶ ui-smoke-chromium\s+.*chromium: 1 gelaufen, 1 bestanden/);
    expect(aus).toMatch(/✗ ui-smoke-firefox\s+.*kein gelaufener Fall für firefox/);
    expect(aus).toMatch(/✗ ui-smoke-webkit\s+.*kein gelaufener Fall für webkit/);
    expect(aus).toContain(`1 von ${N} Vertragsstufen nachweislich gefahren`);

    laufbericht("smoke", []);
    const leer = einbau([dreiSmoke([])]);
    expect(leer.aus).toContain(`0 von ${N} Vertragsstufen nachweislich gefahren, ${N} nicht`);
  });

  it("E7e · Mehrprojektauswahl: beide Schreibweisen, auch ein roter Lauf ist gefahren", () => {
    laufbericht("smoke", [
      { projekt: "chromium", status: "passed" },
      { projekt: "webkit", status: "failed" },
    ]);
    const { aus } = einbau([dreiSmoke(["--project", "chromium", "--project=webkit"])]);
    expect(aus).toMatch(/▶ ui-smoke-chromium\s+.*chromium: 1 gelaufen, 1 bestanden/);
    expect(aus).toMatch(/▶ ui-smoke-webkit\s+.*webkit: 1 gelaufen, 0 bestanden/);
    expect(aus).toMatch(/✗ ui-smoke-firefox\s+nicht ausgewählt \(--project chromium, webkit\)/);
    expect(aus).toContain(`2 von ${N} Vertragsstufen nachweislich gefahren`);
  });

  it("E7f · geplant: ausgewählte Engine unbekannt, die übrigen nicht ausgewählt", () => {
    const { aus } = einbau({ checks: [["smoke", dreiSmoke(["--project=chromium"]).command]] });
    expect(aus).toMatch(/\? ui-smoke-chromium\s+nur Auswahl .*geplant, kein Laufnachweis/);
    expect(aus).toMatch(/✗ ui-smoke-firefox\s+nicht ausgewählt/);
    expect(aus).toContain(
      `0 von ${N} Vertragsstufen nachweislich gefahren, ${N - 1} nicht, 1 unbekannt`,
    );
  });

  it("E7g · eine Regel auf eine Browserstufe ohne Projektzuordnung bricht ab (Code 2)", () => {
    const datei = join(sandkasten, "vertrag-ohne-engines.json");
    writeFileSync(
      datei,
      JSON.stringify({
        stufen: [{ name: "ui-smoke-chromium" }],
        einbau: {
          regeln: [{ befehl: "npm run smoke:ui:gate", stufen: ["ui-smoke-chromium"], umfang: "x" }],
        },
      }),
    );
    const lauf = spawnSync("node", [join(WURZEL, "tools", "tor-bericht.mjs"), "--stufen"], {
      encoding: "utf8",
      env: { ...process.env, KLARWERK_PRUEFVERTRAG: datei },
    });
    expect(lauf.status).toBe(2);
    expect(lauf.stderr).toContain("Browserstufe ui-smoke-chromium ohne Projekte");
  });

  it("E7h · jede Browserstufe einer Einbauregel des echten Vertrags hat Projekte", () => {
    for (const regel of VERTRAG.einbau.regeln) {
      for (const s of (regel.stufen ?? []).filter((x) => x.startsWith("ui-smoke-"))) {
        expect(regel.engines?.[s]?.length ?? 0, `${regel.befehl} → ${s}`).toBeGreaterThan(0);
      }
    }
  });
});
