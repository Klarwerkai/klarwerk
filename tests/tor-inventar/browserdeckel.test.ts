// JOB 3150: echte Unterprozesse, aber markierte Lastsonden statt Chromium/Servern.
// V0 misst die heutige Verdrahtung vor dem Bau; F6 kalibriert dieselben Fenster ohne Deckel.
// Basisstand: der unmittelbare Elterncommit des Prüfstands (wird beim Einbau gesetzt)
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { WURZEL } from "./browser-gruppe";

import { type Fenster, ueberlappendePaare } from "./zeitfenster";

const basis = join(WURZEL, ".local/run");
mkdirSync(basis, { recursive: true });
const werkbank = mkdtempSync(join(basis, "browserdeckel-test-"));
afterAll(() => rmSync(werkbank, { recursive: true, force: true }), 60_000);

function werk() {
  const ort = mkdtempSync(join(werkbank, "werk-"));
  mkdirSync(join(ort, "tools"));
  mkdirSync(join(ort, "node_modules/.bin"), { recursive: true });
  for (const name of ["test", "browserdeckel.sh"]) {
    if (existsSync(join(WURZEL, "tools", name))) {
      copyFileSync(join(WURZEL, "tools", name), join(ort, "tools", name));
    }
  }
  copyFileSync(join(WURZEL, "package.json"), join(ort, "package.json"));
  const sonde = join(ort, "sonde.cjs");
  writeFileSync(
    sonde,
    `
const fs = require('node:fs');
const art = process.env.KLARWERK_TESTGRUPPE || 'smoke';
const von = Date.now();
fs.writeFileSync(process.env.SONDENPFAD + '/' + art + '.start', String(von));
setTimeout(() => {
  fs.writeFileSync(process.env.SONDENPFAD + '/' + art + '.json',
    JSON.stringify({datei: art, von, bis: Date.now()}));
}, art === 'rest' ? Number(process.env.REST_MS || 0) : 800);
`,
  );
  for (const name of ["npx", "playwright"]) {
    writeFileSync(join(ort, "node_modules/.bin", name), '#!/bin/sh\nexec node "$SONDE"\n', {
      mode: 0o755,
    });
  }
  writeFileSync(join(ort, "node_modules/.bin/tsx"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const env: NodeJS.ProcessEnv & { SONDE: string; KLARWERK_BROWSERDECKEL_LOCK: string } = {
    ...process.env,
    PATH: `${join(ort, "node_modules/.bin")}:${process.env.PATH ?? ""}`,
    SONDE: sonde,
    ECHTER_NODE: process.execPath,
    SONDENPFAD: ort,
    KLARWERK_BROWSERDECKEL_LOCK: join(ort, "deckel.lock"),
    KLARWERK_BROWSERDECKEL_TIMEOUT: "10",
  };
  delete env.KLARWERK_TESTGRUPPE;
  delete env.KLARWERK_BROWSERDECKEL;
  delete env.KLARWERK_BROWSERDECKEL_GNADE;
  return { ort, env };
}

function starte(ort: string, env: NodeJS.ProcessEnv, befehl: string, args: string[] = []) {
  const kind = spawn(befehl, args, { cwd: ort, env, stdio: ["ignore", "pipe", "pipe"] });
  let ausgabe = "";
  let stderr = "";
  kind.stdout.on("data", (data) => {
    ausgabe += data;
  });
  kind.stderr.on("data", (data) => {
    ausgabe += data;
    stderr += data;
  });
  const fertig = new Promise<{ code: number | null; ausgabe: string; stderr: string }>(
    (resolve) => {
      kind.on("error", (error) => resolve({ code: -1, ausgabe: String(error), stderr }));
      kind.on("close", (code) => resolve({ code, ausgabe, stderr }));
    },
  );
  return { kind, fertig, stderr: () => stderr };
}

async function warteBis(bedingung: () => boolean) {
  const frist = Date.now() + 5000;
  while (!bedingung() && Date.now() < frist) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(bedingung(), "Synchronisationspunkt binnen 5s erreicht").toBe(true);
}

async function paar(verdrahtet: boolean, aus = false) {
  const { ort, env } = werk();
  const umgebung = { ...env, KLARWERK_BROWSERDECKEL: aus ? "0" : "1" };
  const browser = starte(
    ort,
    umgebung,
    verdrahtet ? "./tools/test" : "./tools/browserdeckel.sh",
    verdrahtet
      ? ["SONDENFILTER"]
      : ["browser", "env", "KLARWERK_TESTGRUPPE=browser", "node", env.SONDE],
  );
  const smoke = starte(
    ort,
    umgebung,
    verdrahtet ? "npm" : "./tools/browserdeckel.sh",
    verdrahtet ? ["run", "--silent", "smoke:ui:gate"] : ["smoke", "node", env.SONDE],
  );
  const ergebnisse = await Promise.all([browser.fertig, smoke.fertig]);
  for (const e of ergebnisse) expect(e.code, e.ausgabe).toBe(0);
  const fenster = ["browser", "smoke"].map(
    (art) => JSON.parse(readFileSync(join(ort, `${art}.json`), "utf8")) as Fenster,
  );
  return { ort, env, fenster, ausgabe: ergebnisse.map((e) => e.ausgabe).join("\n") };
}

interface Ereignis {
  ereignis: "nehmen" | "freigeben" | "verwaist";
  id: string;
  art: "browser" | "smoke";
  pid: number;
  zeit: number;
  gewartetMs: number;
  deckel: boolean;
}

function fensterAusProtokoll(datei: string, mitMesslaeufen = false): Fenster[] {
  const ereignisse = readFileSync(datei, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Ereignis);
  const fenster: Fenster[] = [];
  const offen = new Map<string, { datei: string; von: number; bis: number }>();
  const gesehen = new Set<string>();
  for (const e of ereignisse) {
    if (!mitMesslaeufen && e.deckel === false) continue;
    expect(["browser", "smoke"]).toContain(e.art);
    expect(Number.isFinite(e.zeit) && e.zeit > 0).toBe(true);
    expect(Number.isInteger(e.pid) && e.pid > 0).toBe(true);
    if (e.ereignis === "nehmen") {
      expect(gesehen.has(e.id), "doppelte Halterkennung").toBe(false);
      gesehen.add(e.id);
      const f = { datei: `${e.art}/${e.id}`, von: e.zeit, bis: Number.POSITIVE_INFINITY };
      fenster.push(f);
      offen.set(e.id, f);
      expect(e.gewartetMs).toBeGreaterThanOrEqual(0);
    } else {
      expect(["freigeben", "verwaist"]).toContain(e.ereignis);
      const f = offen.get(e.id);
      expect(f, "Freigabe ohne Nehmen").toBeDefined();
      if (f) {
        expect(e.zeit).toBeGreaterThanOrEqual(f.von);
        f.bis = e.zeit;
        offen.delete(e.id);
      }
    }
  }
  expect(fenster.length, "nicht gemessen: Protokoll enthält keinen Haltezeitraum").toBeGreaterThan(
    0,
  );
  return fenster;
}

describe("JOB 3150 · Browserdeckel", () => {
  it.runIf(process.env.KLARWERK_VORHER_MESSUNG === "1")(
    "V0 · Vorher-Beleg am unveränderten Aufrufweg",
    async () => {
      const lauf = await paar(true);
      const paare = ueberlappendePaare(lauf.fenster);
      console.log(`VORHER ${paare.join("\n")}`);
      expect(paare).toHaveLength(1);
    },
  );

  it("F1 · zwei direkte Unterprozesse laufen seriell", async () => {
    const lauf = await paar(false);
    expect(ueberlappendePaare(lauf.fenster)).toEqual([]);
    expect(
      ueberlappendePaare(fensterAusProtokoll(join(lauf.ort, ".local/run/browserdeckel.jsonl"))),
    ).toEqual([]);
  });

  it("F1 · tools/test und npm-Smoke laufen unter demselben Deckel", async () => {
    const lauf = await paar(true);
    expect(ueberlappendePaare(lauf.fenster)).toEqual([]);
    const protokoll = fensterAusProtokoll(join(lauf.ort, ".local/run/browserdeckel.jsonl"));
    // Ein langsamer npm-Start kann auch ohne Browserdeckel zufällig serielle Fenster ergeben.
    // Deshalb muss der echte Browser-Aufruf zusätzlich als geschützter Halter gemessen sein.
    expect(
      protokoll.filter((f) => f.datei.startsWith("browser/")),
      "Browser-Aufruf fehlt im Deckelprotokoll",
    ).toHaveLength(1);
    expect(protokoll.filter((f) => f.datei.startsWith("smoke/"))).toHaveLength(2);
    expect(ueberlappendePaare(protokoll)).toEqual([]);
    console.log(`NACHHER ${JSON.stringify(lauf.fenster)}`);
    console.log(readFileSync(join(lauf.ort, ".local/run/browserdeckel.jsonl"), "utf8"));
  });

  it.each([
    ["F2a", true],
    ["F2b", false],
  ] as const)("%s · tote PID mit Kennung=%s wird laut aufgeräumt", async (_fall, mitKennung) => {
    const { ort, env } = werk();
    const tot = starte(ort, env, "node", ["-e", "process.exit(0)"]);
    await tot.fertig;
    const pid = tot.kind.pid as number;
    expect(() => process.kill(pid, 0)).toThrow();
    const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
    const id = "f2-halter";
    mkdirSync(lock);
    writeFileSync(join(lock, `pid-${pid}`), `${pid} 1 browser${mitKennung ? ` ${id}` : ""}\n`);
    if (mitKennung) {
      writeFileSync(
        `${lock}.jsonl`,
        `${JSON.stringify({ ereignis: "nehmen", id, pid, art: "browser", zeit: 1, deckel: true, gewartetMs: 0 })}\n`,
      );
    }
    const lauf = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
    const verwaist = readFileSync(`${lock}.jsonl`, "utf8")
      .trim()
      .split("\n")
      .map((zeile) => JSON.parse(zeile) as Ereignis)
      .filter((e) => e.ereignis === "verwaist");
    if (mitKennung) {
      expect(lauf.ausgabe).toContain(
        `ⓘ Browserdeckel verwaist: PID ${pid} seit 1 (Unix-ms) — aufgeräumt`,
      );
      expect(verwaist).toHaveLength(1);
      expect(verwaist[0]?.id).toBe(id);
      expect(lauf.stderr).not.toContain("ohne Kennung");
    } else {
      expect(lauf.stderr).toContain(
        `⚠ Browserdeckel: PID ${pid} ohne Kennung — kein verwaist-Eintrag`,
      );
      expect(verwaist).toHaveLength(0);
    }
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(existsSync(lock)).toBe(false);
    expect(ueberlappendePaare(fensterAusProtokoll(`${lock}.jsonl`))).toEqual([]);
  });

  it("F3 · lebende PID: Zeitgrenze bricht laut ab, der Befehl startet nie", async () => {
    const { ort, env } = werk();
    mkdirSync(env.KLARWERK_BROWSERDECKEL_LOCK);
    writeFileSync(
      join(env.KLARWERK_BROWSERDECKEL_LOCK, `pid-${process.pid}`),
      `${process.pid} 1 browser\n`,
    );
    const lauf = starte(
      ort,
      { ...env, KLARWERK_BROWSERDECKEL_TIMEOUT: "1" },
      "./tools/browserdeckel.sh",
      ["smoke", "node", env.SONDE],
    );
    const notbremse = setTimeout(() => lauf.kind.kill("SIGTERM"), 4000);
    const ergebnis = await lauf.fertig;
    clearTimeout(notbremse);
    expect(ergebnis.ausgabe).toContain("Zeitgrenze");
    expect(ergebnis.ausgabe).toContain(`PID ${process.pid}`);
    expect(ergebnis.ausgabe).toContain("seit");
    expect(ergebnis.code).not.toBe(0);
    expect(existsSync(join(ort, "smoke.start"))).toBe(false);
  });

  it("F12 · ein Schloss ohne PID-Datei löst sich nach der Gnadenfrist auf", async () => {
    const { ort, env } = werk();
    mkdirSync(env.KLARWERK_BROWSERDECKEL_LOCK);
    const start = Date.now();
    const lauf = await starte(
      ort,
      { ...env, KLARWERK_BROWSERDECKEL_GNADE: "1", KLARWERK_BROWSERDECKEL_TIMEOUT: "4" },
      "./tools/browserdeckel.sh",
      ["smoke", "node", env.SONDE],
    ).fertig;
    const gestartet = existsSync(join(ort, "smoke.start"));
    const wartezeit = gestartet
      ? Number(readFileSync(join(ort, "smoke.start"), "utf8")) - start
      : null;
    console.log(
      `F12 exit=${lauf.code} smoke.start=${gestartet} gewartetMs=${wartezeit}\n${lauf.ausgabe}`,
    );
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain("ⓘ Browserdeckel");
    expect(lauf.ausgabe).toContain("PID-Datei nie geschrieben");
    expect(lauf.ausgabe).toContain("1s");
    expect(existsSync(env.KLARWERK_BROWSERDECKEL_LOCK)).toBe(false);
    expect(gestartet).toBe(true);
    // Ohne Halterkennung gibt es kein erfundenes verwaist-Ereignis.
    expect(fensterAusProtokoll(`${env.KLARWERK_BROWSERDECKEL_LOCK}.jsonl`)).toHaveLength(1);
  });

  it("F13 · ein langsamer lebender Halter überlebt auch den Wettlauf vor rmdir", async () => {
    for (const phase of ["halbe-frist", "vor-rmdir"] as const) {
      const { ort, env } = werk();
      const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
      mkdirSync(lock);
      const piddatei = join(lock, `pid-${process.pid}`);
      const pidinhalt = `${process.pid} 1 browser langsamer-halter\n`;
      const beobachtet = join(ort, "beobachtet");
      const versuche = join(ort, "entfernversuche");
      const hook = join(ort, "beobachter.bash");
      // DEBUG hält nur den Testprozess an der echten Shell-Befehlsgrenze an. Kein Mock des
      // Dateisystems: auch die Mutation rm -rf führt ihren echten Betriebssystemaufruf aus.
      // Die erste Phase misst zusätzlich: eine erkannte PID beendet jeden Entfernversuch.
      writeFileSync(
        hook,
        `
trap 'case "$BASH_COMMAND" in
  "halter="*) [ -f "$BEOBACHTET" ] || : > "$BEOBACHTET" ;;
  "rmdir "*|"rm -rf "*)
    printf "Versuch\\n" >> "$VERSUCHE"
    if [ "$PHASE" = vor-rmdir ] && [ ! -f "$PIDZIEL" ]; then
      printf "%s\\n" "$PIDINHALT" > "$PIDZIEL"
    fi ;;
esac' DEBUG
`,
      );
      const lauf = starte(
        ort,
        {
          ...env,
          BASH_ENV: hook,
          BEOBACHTET: beobachtet,
          VERSUCHE: versuche,
          PHASE: phase,
          PIDZIEL: piddatei,
          PIDINHALT: pidinhalt.trim(),
          KLARWERK_BROWSERDECKEL_GNADE: "2",
          KLARWERK_BROWSERDECKEL_TIMEOUT: "5",
        },
        "./tools/browserdeckel.sh",
        ["smoke", "node", env.SONDE],
      );
      let ergebnis: Awaited<typeof lauf.fertig>;
      try {
        await warteBis(() => existsSync(beobachtet));
        if (phase === "halbe-frist") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          writeFileSync(piddatei, pidinhalt);
        }
        ergebnis = await lauf.fertig;
      } finally {
        lauf.kind.kill("SIGTERM");
        await lauf.fertig;
      }
      console.log(`F13 ${phase} exit=${ergebnis.code}\n${ergebnis.ausgabe}`);
      expect(ergebnis.code, phase).toBe(1);
      expect(ergebnis.ausgabe, phase).toContain("Zeitgrenze");
      expect(ergebnis.ausgabe, phase).toContain(`PID ${process.pid}`);
      expect(ergebnis.ausgabe, phase).not.toContain("PID-Datei nie geschrieben");
      expect(existsSync(join(ort, "smoke.start")), phase).toBe(false);
      expect(readFileSync(piddatei, "utf8").trim(), phase).toBe(pidinhalt.trim());
      if (phase === "halbe-frist") {
        expect(existsSync(versuche), "erkannte PID setzt Frist zurück: kein Entfernversuch").toBe(
          false,
        );
      } else {
        expect(readFileSync(versuche, "utf8"), "Wettlauf tatsächlich ausgeführt").toBe("Versuch\n");
      }
    }
  });

  it("F14 · Messlauf warnt sofort neben geschütztem Halter, danach bleiben Regelläufe grün", async () => {
    const { ort, env } = werk();
    const journal = `${env.KLARWERK_BROWSERDECKEL_LOCK}.jsonl`;
    const freigabe = join(ort, "halter-freigeben");
    const halter = starte(ort, env, "./tools/browserdeckel.sh", [
      "browser",
      "node",
      "-e",
      `
const fs = require('node:fs');
const intervall = setInterval(() => { if (fs.existsSync(${JSON.stringify(freigabe)})) clearInterval(intervall); }, 20);
`,
    ]);
    let messlauf: ReturnType<typeof starte> | undefined;
    const weiter = join(ort, "messung-weiter");
    try {
      await warteBis(
        () => existsSync(journal) && readFileSync(journal, "utf8").includes('"ereignis":"nehmen"'),
      );
      const bereit = join(ort, "messung-bereit");
      // Halte den ersten Node-Start vor der Schlossnahme an: die Warnung muss schon jetzt
      // auf stderr stehen, auch wenn die anschließende Vorbereitung beliebig langsam ist.
      writeFileSync(
        join(ort, "node_modules/.bin/node"),
        `#!/bin/sh
if [ -n "\${BEREIT:-}" ]; then
  : > "$BEREIT"
  while [ ! -f "$WEITER" ]; do sleep 0.02; done
fi
exec "$ECHTER_NODE" "$@"
`,
        { mode: 0o755 },
      );
      messlauf = starte(
        ort,
        {
          ...env,
          KLARWERK_BROWSERDECKEL: "0",
          BEREIT: bereit,
          WEITER: weiter,
          ECHTER_NODE: process.execPath,
        },
        "./tools/browserdeckel.sh",
        ["smoke", process.execPath, env.SONDE],
      );
      await warteBis(() => existsSync(bereit));
      expect(messlauf.stderr(), "Warnung vor langsamer Vorbereitung/Schlossnahme").toContain(
        "⚠ Browserdeckel aus — nur für Messungen",
      );
      writeFileSync(weiter, "weiter");
      const messung = await messlauf.fertig;
      expect(messung.code, messung.ausgabe).toBe(0);
      expect(messung.stderr).toContain("⚠ Browserdeckel aus — nur für Messungen");
      const nehmen = readFileSync(journal, "utf8")
        .trim()
        .split("\n")
        .map((zeile) => JSON.parse(zeile) as Ereignis)
        .find((e) => e.ereignis === "nehmen" && e.art === "smoke");
      expect(nehmen).toMatchObject({ deckel: false, gewartetMs: 0 });
    } finally {
      writeFileSync(weiter, "weiter");
      writeFileSync(freigabe, "frei");
      if (messlauf) await messlauf.fertig;
      await halter.fertig;
      rmSync(join(ort, "node_modules/.bin/node"), { force: true });
    }
    const geschuetzt = await halter.fertig;
    expect(geschuetzt.code, geschuetzt.ausgabe).toBe(0);
    expect(ueberlappendePaare(fensterAusProtokoll(journal, true))).toHaveLength(1);
    const historisch = readFileSync(journal, "utf8");
    for (let n = 1; n <= 2; n++) {
      const regel = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
      console.log(`F14 REGELLAUF ${n} exit=${regel.code}`);
      expect(regel.code, regel.ausgabe).toBe(0);
    }
    expect(readFileSync(journal, "utf8").startsWith(historisch)).toBe(true);
    expect(fensterAusProtokoll(journal)).toHaveLength(3);
    expect(ueberlappendePaare(fensterAusProtokoll(journal))).toEqual([]);
    expect(ueberlappendePaare(fensterAusProtokoll(journal, true))).toHaveLength(1);
  });

  it.each([
    ["F15", "EPERM", "Operation not permitted"],
    ["F16", "ESRCH", "No such process"],
    ["F17", "unbekannt", "unerwarteter Prüfungsfehler"],
  ] as const)("%s · Lebendprüfung %s: nur ESRCH räumt", async (fall, grund, meldung) => {
    const { ort, env } = werk();
    const bereit = join(ort, "halter-bereit");
    const halter = starte(ort, env, process.execPath, [
      "-e",
      `require('node:fs').writeFileSync(${JSON.stringify(bereit)}, 'bereit'); setInterval(() => {}, 1000)`,
    ]);
    try {
      await warteBis(() => existsSync(bereit));
      const pid = halter.kind.pid as number;
      if (grund === "ESRCH") {
        halter.kind.kill("SIGTERM");
        await halter.fertig;
        expect(() => process.kill(pid, 0)).toThrow();
      } else {
        expect(() => process.kill(pid, 0)).not.toThrow();
      }
      const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
      const journal = `${lock}.jsonl`;
      const id = `halter-${pid}`;
      const historie = `${JSON.stringify({ ereignis: "nehmen", id, pid, art: "browser", zeit: 1, gewartetMs: 0, deckel: true })}\n`;
      mkdirSync(lock);
      const piddatei = join(lock, `pid-${id}`);
      const pidinhalt = `${pid} 1 browser ${id}\n`;
      writeFileSync(piddatei, pidinhalt);
      writeFileSync(journal, historie);
      const hook = join(ort, "signalrecht.bash");
      const aufrufe = join(ort, "kill-aufrufe");
      // Eine Bash-Funktion überschreibt das Builtin wirklich (PATH allein tut das nicht).
      // Nur die fremde Halterprüfung wird gestört; Abbau-/Gruppensignale bleiben echte kill.
      // ESRCH stammt sogar aus dem echten Builtin für den nachweislich beendeten Prozess.
      writeFileSync(
        hook,
        `
kill() {
  if [ "$1" = -0 ] && [ "$2" = "$PRUEF_PID" ]; then
    printf '%s %s\\n' "$1" "$2" >> "$PRUEF_AUFRUFE"
    if [ "$PRUEF_GRUND" = ESRCH ]; then builtin kill "$@"; return $?; fi
    builtin kill -0 "$PRUEF_PID" || return 99
    printf 'kill: (%s) - %s\\n' "$PRUEF_PID" "$PRUEF_MELDUNG" >&2
    return 1
  fi
  builtin kill "$@"
}
`,
      );
      const lauf = await starte(
        ort,
        {
          ...env,
          BASH_ENV: hook,
          PRUEF_PID: String(pid),
          PRUEF_AUFRUFE: aufrufe,
          PRUEF_GRUND: grund,
          PRUEF_MELDUNG: meldung,
          KLARWERK_BROWSERDECKEL_TIMEOUT: "2",
        },
        "./tools/browserdeckel.sh",
        ["smoke", "node", env.SONDE],
      ).fertig;
      console.log(`${fall} ${grund} exit=${lauf.code}\n${lauf.ausgabe}`);
      expect(readFileSync(aufrufe, "utf8")).toContain(`-0 ${pid}\n`);
      const text = readFileSync(journal, "utf8");
      expect(text.startsWith(historie)).toBe(true);
      if (grund === "ESRCH") {
        expect(lauf.code, lauf.ausgabe).toBe(0);
        expect(existsSync(lock)).toBe(false);
        expect(existsSync(join(ort, "smoke.start"))).toBe(true);
        expect(text.match(/"ereignis":"verwaist"/g)).toHaveLength(1);
        expect(ueberlappendePaare(fensterAusProtokoll(journal))).toEqual([]);
      } else {
        expect(lauf.code, lauf.ausgabe).toBe(1);
        expect(lauf.stderr).toContain(`PID ${pid} lebt oder unzugänglich (${grund}) — warte`);
        expect(lauf.stderr).toContain(meldung);
        expect(lauf.stderr).toContain("Zeitgrenze 2s");
        expect(readFileSync(piddatei, "utf8")).toBe(pidinhalt);
        expect(text).toBe(historie);
        expect(lauf.ausgabe).not.toContain("verwaist");
        expect(existsSync(join(ort, "smoke.start"))).toBe(false);
        expect(() => process.kill(pid, 0)).not.toThrow();
      }
    } finally {
      halter.kind.kill("SIGTERM");
      await halter.fertig;
    }
  });

  it.each(["freigeben", "verwaist", "unbekannt", "Messlauf"])(
    "F18 · tote PID mit %s im Journal erzeugt kein weiteres verwaist",
    async (zustand) => {
      const { ort, env } = werk();
      const tot = starte(ort, env, process.execPath, ["-e", "process.exit(0)"]);
      await tot.fertig;
      const pid = tot.kind.pid as number;
      expect(() => process.kill(pid, 0)).toThrow();
      const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
      const journal = `${lock}.jsonl`;
      const id = "alter-halter";
      const nehmen = {
        ereignis: "nehmen",
        id,
        pid,
        art: "browser",
        zeit: 1,
        deckel: zustand !== "Messlauf",
        gewartetMs: 0,
      };
      const historie =
        zustand === "unbekannt"
          ? ""
          : `${JSON.stringify(nehmen)}\n${zustand === "Messlauf" ? "" : `${JSON.stringify({ ...nehmen, ereignis: zustand, zeit: 2 })}\n`}`;
      if (historie) writeFileSync(journal, historie);
      mkdirSync(lock);
      writeFileSync(join(lock, `pid-${id}`), `${pid} 1 browser ${id}\n`);
      const lauf = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
      console.log(`F18 ${zustand} exit=${lauf.code}\n${lauf.ausgabe}`);
      expect(lauf.code, lauf.ausgabe).toBe(0);
      expect(lauf.stderr).toContain(`Kennung ${id} nicht offen — kein verwaist-Eintrag`);
      expect(existsSync(lock)).toBe(false);
      const text = readFileSync(journal, "utf8");
      expect(text.startsWith(historie)).toBe(true);
      expect(text.slice(historie.length)).not.toContain('"ereignis":"verwaist"');
      expect(ueberlappendePaare(fensterAusProtokoll(journal))).toEqual([]);
    },
  );

  it.each([
    ["unbrauchbar", "abc 1 browser\n"],
    ["unlesbar", ""],
  ])(
    "F19 · vorhandene PID-Datei %s bleibt mit ehrlicher Zeitgrenze erhalten",
    async (grund, inhalt) => {
      const { ort, env } = werk();
      const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
      mkdirSync(lock);
      const datei = join(lock, "pid-defekt");
      writeFileSync(datei, inhalt);
      const lauf = await starte(
        ort,
        { ...env, KLARWERK_BROWSERDECKEL_GNADE: "0", KLARWERK_BROWSERDECKEL_TIMEOUT: "1" },
        "./tools/browserdeckel.sh",
        ["smoke", "node", env.SONDE],
      ).fertig;
      expect(lauf.code, lauf.ausgabe).toBe(1);
      expect(existsSync(lock)).toBe(true);
      expect(readFileSync(datei, "utf8")).toBe(inhalt);
      expect(existsSync(join(ort, "smoke.start"))).toBe(false);
      expect(lauf.stderr).toContain(`PID-Datei ${grund}: ${datei}`);
      expect(lauf.ausgabe).not.toMatch(/PID-Datei fehlt|PID-Datei nie geschrieben/);
    },
  );

  it.each(["0", "15"])(
    "F20 · fehlende PID-Datei bleibt unterscheidbar bei Gnade %s",
    async (gnade) => {
      const { ort, env } = werk();
      const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
      mkdirSync(lock);
      const lauf = await starte(
        ort,
        { ...env, KLARWERK_BROWSERDECKEL_GNADE: gnade, KLARWERK_BROWSERDECKEL_TIMEOUT: "2" },
        "./tools/browserdeckel.sh",
        ["smoke", "true"],
      ).fertig;
      expect(lauf.code, lauf.ausgabe).toBe(gnade === "0" ? 0 : 1);
      expect(lauf.ausgabe).toContain(
        gnade === "0" ? "PID-Datei nie geschrieben" : "PID-Datei fehlt",
      );
      expect(lauf.ausgabe).not.toMatch(/PID-Datei unlesbar|PID-Datei unbrauchbar/);
    },
  );

  it("F21 · Gnadenfrist 0 warnt auf stderr und räumt bei der ersten Beobachtung", async () => {
    const { ort, env } = werk();
    const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
    mkdirSync(lock);
    const hook = join(ort, "beobachtung.bash");
    const beobachtet = join(ort, "beobachtungen");
    writeFileSync(
      hook,
      `trap 'case "$BASH_COMMAND" in "gueltige_pid=0"*) printf "beobachtet\\n" >> "$BEOBACHTET" ;; esac' DEBUG\n`,
    );
    const lauf = await starte(
      ort,
      { ...env, BASH_ENV: hook, BEOBACHTET: beobachtet, KLARWERK_BROWSERDECKEL_GNADE: "00" },
      "./tools/browserdeckel.sh",
      ["smoke", "true"],
    ).fertig;
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(existsSync(lock)).toBe(false);
    expect(lauf.ausgabe).toContain("Frist 0s abgelaufen, leeres Schloss aufgeräumt");
    // Eine Schleifenbeobachtung; eine reine Zeitmessung könnte zusätzliche Runden übersehen.
    expect(readFileSync(beobachtet, "utf8")).toBe("beobachtet\n");
    expect(lauf.stderr).toContain(
      "⚠ Browserdeckel: Gnadenfrist 0s — ein Schloss ohne PID-Datei wird ohne Wartefenster entfernt; nur für Messungen",
    );
  });

  it.each([0, 7])("F22 · Fremddatei erhält den Befehls-Exitcode %s mit Warnung", async (code) => {
    const { ort, env } = werk();
    const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
    const lauf = await starte(ort, env, "./tools/browserdeckel.sh", [
      "smoke",
      "node",
      "-e",
      `require('node:fs').writeFileSync(process.env.KLARWERK_BROWSERDECKEL_LOCK + '/fremd', 'fremd'); process.exit(${code})`,
    ]).fertig;
    expect(lauf.code, lauf.ausgabe).toBe(code);
    expect(lauf.stderr).toContain(`⚠ Browserdeckel: Schloss nicht leer: ${lock}`);
    expect(readFileSync(join(lock, "fremd"), "utf8")).toBe("fremd");
    expect(fensterAusProtokoll(`${lock}.jsonl`)).toHaveLength(1);
  });

  it.each(["Betriebssystem", "Permission denied", "unbekannter Fehler"])(
    "F23 · anderer rmdir-Fehler bleibt Exit 1: %s",
    async (diagnose) => {
      const { ort, env } = werk();
      const parent = join(ort, "schloss-eltern");
      mkdirSync(parent);
      const lock = join(parent, "deckel.lock");
      const hook = join(ort, "rmdir.bash");
      writeFileSync(
        hook,
        `rmdir() { printf 'rmdir: %s: %s\\n' "$1" "$DIAGNOSE" >&2; return 1; }\n`,
      );
      try {
        const lauf = await starte(
          ort,
          {
            ...env,
            KLARWERK_BROWSERDECKEL_LOCK: lock,
            ...(diagnose === "Betriebssystem" ? {} : { BASH_ENV: hook, DIAGNOSE: diagnose }),
          },
          "./tools/browserdeckel.sh",
          [
            "smoke",
            "node",
            "-e",
            diagnose === "Betriebssystem"
              ? `require('node:fs').chmodSync(require('node:path').dirname(process.env.KLARWERK_BROWSERDECKEL_LOCK), 0o555)`
              : "process.exit(0)",
          ],
        ).fertig;
        console.log(`F23 ${diagnose} exit=${lauf.code}\n${lauf.stderr}`);
        expect(lauf.code, lauf.ausgabe).toBe(1);
        expect(lauf.stderr).toContain(
          diagnose === "Betriebssystem" ? "Permission denied" : diagnose,
        );
        expect(existsSync(lock)).toBe(true);
      } finally {
        chmodSync(parent, 0o755);
      }
    },
  );

  async function toterWettlauf(fall: string, weitereRunde: boolean, toteSperren = false) {
    const { ort, env } = werk();
    const tot = starte(ort, env, process.execPath, ["-e", "process.exit(0)"]);
    await tot.fertig;
    const pid = tot.kind.pid as number;
    expect(() => process.kill(pid, 0)).toThrow();
    const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
    const id = "gemeinsamer-toter";
    mkdirSync(lock);
    const datei = join(lock, `pid-${id}`);
    writeFileSync(datei, `${pid} 1 browser ${id}\n`);
    const journal = `${lock}.jsonl`;
    const historie = `${JSON.stringify({ ereignis: "nehmen", id, pid, art: "browser", zeit: 1, deckel: true, gewartetMs: 0 })}\n`;
    writeFileSync(journal, historie);
    if (toteSperren) {
      const praefix = `${journal}.verwaist-${createHash("sha256").update(id).digest("hex")}`;
      for (const [n, inhalt] of [String(pid), ""].entries()) {
        const pfad = `${praefix}.${n}`;
        writeFileSync(pfad, inhalt);
        utimesSync(pfad, new Date(0), new Date(0));
      }
    }
    const hook = join(ort, "wettlauf.bash");
    const lesesperre = join(ort, "lesesperre.cjs");
    // Nur Zeitsteuerung: keine geänderten Exitcodes, kein rm -f. Die vorgestarteten
    // Node-Schreiber treffen sich zusätzlich vor dem echten Produktcode. Auch ein
    // Ausbau von sperren() durchläuft genau dieselbe Barriere.
    writeFileSync(
      hook,
      `
vor_entfernen() {
  : > "$SONDENPFAD/rm-$LAUF"
  while [ ! -f "$SONDENPFAD/rm-frei" ]; do :; done
}
entfernergebnis() {
  printf '%s %s\\n' "$LAUF" "$1" >> "$SONDENPFAD/entfernungen"
  if [ "$1" != 0 ]; then : > "$SONDENPFAD/verloren-$LAUF"; fi
  return "$1"
}
rm() {
  if [ "$1" = "$PIDZIEL" ]; then
    vor_entfernen
    local rc=0
    command rm "$@" || rc=$?
    entfernergebnis "$rc"
    return $?
  fi
  command rm "$@"
}
mkdir() {
  local rc=0
  command mkdir "$@" || rc=$?
  if [ "$1" = "$KLARWERK_BROWSERDECKEL_LOCK" ] && [ -f "$SONDENPFAD/verloren-$LAUF" ]; then
    printf '%s %s\\n' "$LAUF" "$rc" >> "$SONDENPFAD/runden"
    : > "$SONDENPFAD/runde-$LAUF"
  fi
  return "$rc"
}
sleep() {
  if [ "$1" = 0.1 ] && [ -f "$SONDENPFAD/rm-$LAUF" ]; then
    if [ "$WEITERE_RUNDE" = 1 ] && [ -f "$SONDENPFAD/verloren-$LAUF" ] && [ ! -f "$SONDENPFAD/runde-$LAUF" ]; then
      return 0
    fi
    : > "$SONDENPFAD/weiter-$LAUF"
    while [ ! -f "$SONDENPFAD/lesen-frei" ]; do :; done
  fi
  command sleep "$@"
}
node() {
  if [ "\${3:-}" = "$PIDZIEL" ]; then
    vor_entfernen
    local rc=0
    command node --require "$LESESPERRE" "$@" || rc=$?
    entfernergebnis "$rc"
    return $?
  fi
  if [ "\${4:-}" = verwaist ]; then
    vor_entfernen
    printf '%s\\n' "$LAUF" >> "$SONDENPFAD/schreiber"
    local rc=0
    command node --require "$LESESPERRE" "$@" || rc=$?
    # Der Vorstand entfernt in einem eigenen Node-Aufruf; dessen Ergebnis ist schon
    # erfasst. Der neue gemeinsame Aufruf führt die PID-Datei als elftes Argument mit.
    if [ "\${11:-}" = "$PIDZIEL" ]; then entfernergebnis "$rc"; return $?; fi
    return "$rc"
  else
    command node "$@"
  fi
}
`,
    );
    writeFileSync(
      lesesperre,
      `
const fs = require('node:fs');
const lesen = fs.readFileSync;
const unlink = fs.unlinkSync;
fs.unlinkSync = function(datei, ...args) {
  let ergebnis = 'OK';
  try { return unlink.call(this, datei, ...args); }
  catch (error) { ergebnis = error.code; throw error; }
  finally {
    if (datei === process.env.PIDZIEL) fs.appendFileSync(process.env.SONDENPFAD + '/unlink-ergebnisse', process.env.LAUF + ' ' + ergebnis + '\\n');
  }
};
fs.writeFileSync(process.env.SONDENPFAD + '/unlink-' + process.env.LAUF, 'bereit');
const frist = Date.now() + 10000;
while (!fs.existsSync(process.env.SONDENPFAD + '/unlink-frei')) {
  if (Date.now() > frist) throw new Error('Entferner nicht freigegeben');
}
const start = BigInt(lesen(process.env.SONDENPFAD + '/unlink-frei', 'utf8'));
while (process.hrtime.bigint() < start) {}
let erstes = true;
fs.readFileSync = function(datei, ...args) {
  const text = lesen.call(this, datei, ...args);
  if (erstes && datei === process.env.KLARWERK_BROWSERDECKEL_LOCK + '.jsonl') {
    erstes = false;
    fs.writeFileSync(process.env.SONDENPFAD + '/weiter-' + process.env.LAUF, 'gelesen');
    const bis = Date.now() + 10000;
    while (!fs.existsSync(process.env.SONDENPFAD + '/lesen-frei')) {
      if (Date.now() > bis) throw new Error('Journal-Lesesperre nicht freigegeben');
    }
  }
  return text;
};
`,
    );
    const laeufe = ["a", "b"].map((lauf) =>
      starte(
        ort,
        {
          ...env,
          BASH_ENV: hook,
          PIDZIEL: datei,
          LESESPERRE: lesesperre,
          LAUF: lauf,
          WEITERE_RUNDE: weitereRunde ? "1" : "0",
        },
        "./tools/browserdeckel.sh",
        ["smoke", "true"],
      ),
    );
    try {
      await warteBis(() => ["a", "b"].every((lauf) => existsSync(join(ort, `rm-${lauf}`))));
      writeFileSync(join(ort, "rm-frei"), "frei");
      await warteBis(() => ["a", "b"].every((lauf) => existsSync(join(ort, `unlink-${lauf}`))));
      writeFileSync(join(ort, "unlink-start"), String(process.hrtime.bigint() + 20_000_000n));
      renameSync(join(ort, "unlink-start"), join(ort, "unlink-frei"));
      await warteBis(() => ["a", "b"].every((lauf) => existsSync(join(ort, `weiter-${lauf}`))));
      // Noch vor Freigabe des Journals: F24b muss einen fehlgeschlagenen nächsten
      // mkdir des Verlierers belegen. Spätere erfolgreiche Schlossnahmen zählen nicht.
      const runden = existsSync(join(ort, "runden"))
        ? readFileSync(join(ort, "runden"), "utf8")
        : "";
      writeFileSync(join(ort, "lesen-frei"), "frei");
      const ergebnisse = await Promise.all(laeufe.map((lauf) => lauf.fertig));
      const text = readFileSync(journal, "utf8");
      const verwaist = text
        .trim()
        .split("\n")
        .map((z) => JSON.parse(z) as Ereignis)
        .filter((e) => e.ereignis === "verwaist" && e.id === id);
      const entfernungen = readFileSync(join(ort, "entfernungen"), "utf8").trim().split("\n");
      const schreiber = readFileSync(join(ort, "schreiber"), "utf8").trim().split("\n");
      const unlinkErgebnisse = readFileSync(join(ort, "unlink-ergebnisse"), "utf8")
        .trim()
        .split("\n");
      console.log(
        `${fall} aufraeumversuche=${JSON.stringify(entfernungen)} unlink=${JSON.stringify(unlinkErgebnisse)} schreiber=${JSON.stringify(schreiber)} verwaist=${verwaist.length} weitereRunde=${JSON.stringify(runden)}`,
      );
      expect(verwaist, "genau ein verwaist für den gemeinsamen Toten").toHaveLength(1);
      for (const e of ergebnisse) {
        expect(e.code, e.ausgabe).toBe(0);
        expect(
          e.stderr.replace(
            `⚠ Browserdeckel: Kennung ${id} nicht offen — kein verwaist-Eintrag\n`,
            "",
          ),
        ).toBe("");
      }
      expect(entfernungen.length).toBeGreaterThanOrEqual(2);
      expect(entfernungen.filter((e) => e.endsWith(" 0"))).toHaveLength(1);
      expect(unlinkErgebnisse).toHaveLength(1);
      expect(unlinkErgebnisse[0]).toMatch(/^[ab] OK$/);
      const verlierer = entfernungen.find((e) => !e.endsWith(" 0"))?.split(" ")[0];
      if (weitereRunde) {
        expect(verlierer).toBeDefined();
        expect(runden).toBe(`${verlierer} 1\n`);
      } else expect(runden).toBe("");
      expect(text.startsWith(historie)).toBe(true);
      expect(existsSync(datei)).toBe(false);
      expect(existsSync(lock)).toBe(false);
      expect(readdirSync(ort).filter((name) => name.includes(".verwaist-"))).toEqual([]);
      expect(ueberlappendePaare(fensterAusProtokoll(journal))).toEqual([]);
    } finally {
      writeFileSync(join(ort, "rm-frei"), "frei");
      writeFileSync(join(ort, "lesen-frei"), "frei");
      writeFileSync(join(ort, "unlink-frei"), "0");
      for (const lauf of laeufe) lauf.kind.kill("SIGTERM");
      await Promise.all(laeufe.map((lauf) => lauf.fertig));
    }
  }

  it.each([
    ["F24", false],
    ["F24b", true],
  ] as const)(
    "%s · zwei Wartende schließen denselben Toten genau einmal (weitere Runde: %s)",
    (fall, weitereRunde) => toterWettlauf(fall, weitereRunde),
  );

  it("F24c · 40 echte Wettläufe verletzen die Journalzusicherung keinmal", async () => {
    const fehler: string[] = [];
    for (let n = 1; n <= 40; n++) {
      try {
        await toterWettlauf(`F24c Runde ${n}`, false);
      } catch (error) {
        fehler.push(`Runde ${n}: ${String(error)}`);
      }
    }
    console.log(`F24c: ${fehler.length} von 40 Runden verletzten die Zusicherung`);
    expect(fehler.join("\n")).toBe("");
  }, 120_000);

  it.each(Array.from({ length: 30 }, (_, n) => n + 1))(
    "F24h · Wiederholungsbeleg %i von 30 ohne Wiederholung fehlgeschlagener Fälle",
    (runde) => toterWettlauf(`F24h ${runde}/30`, false),
  );

  it("F24g · wx entscheidet in 200 Runden mit zwei vorgestarteten Prozessen exklusiv", async () => {
    const { ort, env } = werk();
    const code = `const fs = require('node:fs');
const [ort, lauf] = process.argv.slice(1);
for (let n = 0; n < 400; n++) {
  fs.writeFileSync(ort + '/bereit-' + lauf, 'bereit');
  const frist = Date.now() + 10000;
  while (!fs.existsSync(ort + '/start-' + n)) {
    if (Date.now() > frist) throw new Error('Startbarriere abgelaufen');
  }
  const start = BigInt(fs.readFileSync(ort + '/start-' + n, 'utf8'));
  while (process.hrtime.bigint() < start) {}
  let ergebnis = 'OK';
  try {
    if (n < 200) fs.unlinkSync(ort + '/ziel');
    else fs.closeSync(fs.openSync(ort + '/ziel', 'wx'));
  } catch (error) { ergebnis = error.code; }
  const fertig = ort + '/fertig-' + n + '-' + lauf;
  fs.writeFileSync(fertig + '.tmp', ergebnis);
  fs.renameSync(fertig + '.tmp', fertig);
}`;
    const kinder = ["a", "b"].map((lauf) =>
      starte(ort, env, process.execPath, ["-e", code, ort, lauf]),
    );
    const doppelt: [number, number] = [0, 0];
    try {
      await warteBis(() => ["a", "b"].every((lauf) => existsSync(join(ort, `bereit-${lauf}`))));
      for (let n = 0; n < 400; n++) {
        if (n < 200) writeFileSync(join(ort, "ziel"), "ziel");
        else rmSync(join(ort, "ziel"), { force: true });
        writeFileSync(join(ort, "start.tmp"), String(process.hrtime.bigint() + 10_000_000n));
        renameSync(join(ort, "start.tmp"), join(ort, `start-${n}`));
        await warteBis(() =>
          ["a", "b"].every((lauf) => existsSync(join(ort, `fertig-${n}-${lauf}`))),
        );
        const ergebnisse = ["a", "b"].map((lauf) =>
          readFileSync(join(ort, `fertig-${n}-${lauf}`), "utf8"),
        );
        if (ergebnisse.every((e) => e === "OK")) doppelt[n < 200 ? 0 : 1]++;
        if (n >= 200) expect(ergebnisse.sort(), `wx Runde ${n - 199}`).toEqual(["EEXIST", "OK"]);
      }
      for (const kind of kinder) expect((await kind.fertig).code).toBe(0);
      console.log(
        `F24g zwei vorgestartete Prozesse an enger Barriere: unlink beide erfolgreich = ${doppelt[0]} von 200; wx beide erfolgreich = ${doppelt[1]} von 200`,
      );
    } finally {
      for (const kind of kinder) kind.kind.kill("SIGTERM");
      await Promise.all(kinder.map((kind) => kind.fertig));
    }
  });

  it("F24d · zwei Wartende übernehmen tote und leere abgelaufene Sperren ohne ABA", async () => {
    await toterWettlauf("F24d", true, true);
  });

  it("F24e · Journalfehler gibt die Sperre frei und lässt die PID für den Wiederanlauf stehen", async () => {
    const { ort, env } = werk();
    const tot = starte(ort, env, process.execPath, ["-e", "process.exit(0)"]);
    await tot.fertig;
    const pid = tot.kind.pid as number;
    const id = "journalfehler";
    const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
    mkdirSync(lock);
    const datei = join(lock, `pid-${id}`);
    writeFileSync(datei, `${pid} 1 browser ${id}\n`);
    const journal = `${lock}.jsonl`;
    const historie = `${JSON.stringify({ ereignis: "nehmen", id, pid, art: "browser", zeit: 1, deckel: true, gewartetMs: 0 })}\n`;
    writeFileSync(journal, historie);
    const hook = join(ort, "fehler.cjs");
    writeFileSync(
      hook,
      `const fs = require('node:fs');
const append = fs.appendFileSync;
fs.appendFileSync = function(pfad, text, ...args) {
  if (String(text).includes('"ereignis":"verwaist"')) throw new Error('ABSICHTLICHER JOURNALFEHLER');
  return append.call(this, pfad, text, ...args);
};`,
    );
    const fehler = await starte(
      ort,
      { ...env, NODE_OPTIONS: `--require=${hook}` },
      "./tools/browserdeckel.sh",
      ["smoke", "true"],
    ).fertig;
    expect(fehler.code).toBe(1);
    expect(fehler.stderr).toContain("ABSICHTLICHER JOURNALFEHLER");
    expect(readFileSync(journal, "utf8")).toBe(historie);
    expect(existsSync(datei)).toBe(true);
    expect(readdirSync(ort).filter((name) => name.includes(".verwaist-"))).toEqual([]);
    const neu = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
    expect(neu.code, neu.ausgabe).toBe(0);
    expect(readFileSync(journal, "utf8").match(/"ereignis":"verwaist"/g)).toHaveLength(1);
    expect(ueberlappendePaare(fensterAusProtokoll(journal))).toEqual([]);
  });

  it.each(["lebend", "initialisierung"] as const)(
    "F24f · abgelaufene Sperre: %s",
    async (phase) => {
      const { ort, env } = werk();
      const tot = starte(ort, env, process.execPath, ["-e", "process.exit(0)"]);
      await tot.fertig;
      const pid = tot.kind.pid as number;
      const id = "angehaltener-schreiber";
      const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
      mkdirSync(lock);
      const datei = join(lock, `pid-${id}`);
      writeFileSync(datei, `${pid} 1 browser ${id}\n`);
      const journal = `${lock}.jsonl`;
      const historie = `${JSON.stringify({ ereignis: "nehmen", id, pid, art: "browser", zeit: 1, deckel: true, gewartetMs: 0 })}\n`;
      writeFileSync(journal, historie);
      const sperre = `${journal}.verwaist-${createHash("sha256").update(id).digest("hex")}.0`;
      if (phase === "lebend") {
        writeFileSync(sperre, String(process.pid));
        utimesSync(sperre, new Date(0), new Date(0));
        const lauf = await starte(
          ort,
          { ...env, KLARWERK_BROWSERDECKEL_TIMEOUT: "1" },
          "./tools/browserdeckel.sh",
          ["smoke", "true"],
        ).fertig;
        expect(lauf.code).toBe(1);
        expect(lauf.stderr).toContain("Zeitgrenze 1s");
        expect(readFileSync(journal, "utf8")).toBe(historie);
        expect(readFileSync(sperre, "utf8")).toBe(String(process.pid));
        expect(existsSync(datei)).toBe(true);
        return;
      }
      const hook = join(ort, "anhalten.cjs");
      const bereit = join(ort, "bereit");
      const frei = join(ort, "frei");
      writeFileSync(
        hook,
        `const fs = require('node:fs');
const open = fs.openSync;
fs.openSync = function(pfad, ...args) {
  const fd = open.call(this, pfad, ...args);
  if (pfad === ${JSON.stringify(sperre)}) {
    fs.writeFileSync(${JSON.stringify(bereit)}, 'bereit');
    const frist = Date.now() + 10000;
    while (!fs.existsSync(${JSON.stringify(frei)})) {
      if (Date.now() > frist) throw new Error('Initialisierung nicht freigegeben');
    }
  }
  return fd;
};`,
      );
      const alt = starte(
        ort,
        { ...env, NODE_OPTIONS: `--require=${hook}` },
        "./tools/browserdeckel.sh",
        ["smoke", "true"],
      );
      try {
        await warteBis(() => existsSync(bereit));
        utimesSync(sperre, new Date(0), new Date(0));
        const neu = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
        expect(neu.code, neu.ausgabe).toBe(0);
        writeFileSync(frei, "frei");
        const ergebnis = await alt.fertig;
        expect(ergebnis.code).toBe(1);
        expect(ergebnis.stderr).toContain("Journal-Sperre vor Initialisierung abgelaufen");
        expect(readFileSync(journal, "utf8").match(/"ereignis":"verwaist"/g)).toHaveLength(1);
        expect(ueberlappendePaare(fensterAusProtokoll(journal))).toEqual([]);
      } finally {
        writeFileSync(frei, "frei");
        await alt.fertig;
      }
    },
  );

  it.each([
    ["unbrauchbar", "abc\n"],
    ["unlesbar", ""],
  ])("F25 · Fristmeldung erhält den beobachteten Grund %s im Wettlauf", async (grund, inhalt) => {
    const { ort, env } = werk();
    const lock = env.KLARWERK_BROWSERDECKEL_LOCK;
    mkdirSync(lock);
    const datei = join(lock, "pid-defekt");
    writeFileSync(datei, inhalt);
    const hook = join(ort, "frist.bash");
    // Ein Dritter entfernt die defekte Datei zwischen Beobachtung und echtem rmdir.
    writeFileSync(hook, `rmdir() { command rm -f "$PIDZIEL"; command rmdir "$@"; }\n`);
    const lauf = await starte(
      ort,
      { ...env, BASH_ENV: hook, PIDZIEL: datei, KLARWERK_BROWSERDECKEL_GNADE: "0" },
      "./tools/browserdeckel.sh",
      ["smoke", "true"],
    ).fertig;
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain(
      `ⓘ Browserdeckel: PID-Datei ${grund}: ${datei} — Frist 0s abgelaufen, leeres Schloss aufgeräumt`,
    );
    expect(lauf.ausgabe).not.toMatch(/PID-Datei fehlt|PID-Datei nie geschrieben/);
  });

  it.each(["falsch", "1.5", "-1"])(
    "G1 · ungültige Gnadenfrist %s bricht vor dem Befehl ab",
    async (gnade) => {
      const { ort, env } = werk();
      const lauf = await starte(
        ort,
        { ...env, KLARWERK_BROWSERDECKEL_GNADE: gnade },
        "./tools/browserdeckel.sh",
        ["smoke", "node", env.SONDE],
      ).fertig;
      expect(lauf.code).toBe(2);
      expect(lauf.ausgabe).toContain("Gnadenfrist muss ganze Sekunden enthalten");
      expect(existsSync(join(ort, "smoke.start"))).toBe(false);
    },
  );

  it("G2 · eine Warteschleife und ein gemeinsamer rmdir im Wartepfad", () => {
    const code = readFileSync(join(WURZEL, "tools/browserdeckel.sh"), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    const warten = code.slice(code.indexOf('if [ "$an" = 1 ]; then'));
    expect(warten.match(/\bwhile\b/g)).toHaveLength(1);
    expect(warten.match(/\bmkdir\b/g)).toHaveLength(1);
    expect(warten.match(/\brmdir\b/g)).toHaveLength(1);
  });

  it("F4 · jeder smoke:ui-Name und der Browser-Aufruf tragen den Deckel", () => {
    const scripts = (
      JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    const smoke = Object.entries(scripts).filter(([name]) => name.startsWith("smoke:ui"));
    expect(smoke.length).toBeGreaterThan(0);
    for (const [name, script] of smoke) {
      expect(script, name).toMatch(/\.\/tools\/browserdeckel\.sh smoke (playwright|tsx) /);
    }
    const quelle = readFileSync(join(WURZEL, "tools/test"), "utf8").replace(/\\\n/g, " ");
    expect(quelle).toContain(
      "KLARWERK_TESTGRUPPE=browser ./tools/browserdeckel.sh browser npx vitest run",
    );
  });

  it("F5 · Rest bleibt draußen, kein äußerer Ring wird im Deckel genommen", async () => {
    expect(existsSync(join(WURZEL, "tools/browserdeckel.sh"))).toBe(true);
    const { ort, env } = werk();
    const lauf = starte(ort, { ...env, REST_MS: "1500" }, "./tools/test", ["SONDENFILTER"]);
    const frist = Date.now() + 8000;
    while (!existsSync(join(ort, "rest.start")) && Date.now() < frist) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const smoke = starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "node", env.SONDE]);
    const ergebnisse = await Promise.all([lauf.fertig, smoke.fertig]);
    for (const e of ergebnisse) expect(e.code, e.ausgabe).toBe(0);
    const fenster = ["rest", "smoke"].map(
      (art) => JSON.parse(readFileSync(join(ort, `${art}.json`), "utf8")) as Fenster,
    );
    expect(ueberlappendePaare(fenster)).toHaveLength(1);
    const code = readFileSync(join(WURZEL, "tools/browserdeckel.sh"), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(code).not.toMatch(/klarwerk-(test|smoke)\.lock|tools\/test|npm run/);
  });

  it("F6 · ausgeschalteter Deckel warnt und lässt dieselben Fenster überlappen", async () => {
    const lauf = await paar(false, true);
    expect(lauf.ausgabe).toContain("⚠ Browserdeckel aus — nur für Messungen");
    expect(ueberlappendePaare(lauf.fenster)).toHaveLength(1);
    expect(
      ueberlappendePaare(
        fensterAusProtokoll(join(lauf.ort, ".local/run/browserdeckel.jsonl"), true),
      ),
    ).toHaveLength(1);
    console.log(`KALIBRIERUNG ${ueberlappendePaare(lauf.fenster).join("\n")}`);
  });

  it("F7 · zwei Arbeitsbäume teilen Schloss UND gemessene Historie", async () => {
    const a = werk();
    const b = werk();
    const browser = starte(a.ort, a.env, "./tools/browserdeckel.sh", [
      "browser",
      "env",
      "KLARWERK_TESTGRUPPE=browser",
      "node",
      a.env.SONDE,
    ]);
    const smoke = starte(
      b.ort,
      { ...b.env, KLARWERK_BROWSERDECKEL_LOCK: a.env.KLARWERK_BROWSERDECKEL_LOCK },
      "./tools/browserdeckel.sh",
      ["smoke", "node", b.env.SONDE],
    );
    for (const e of await Promise.all([browser.fertig, smoke.fertig]))
      expect(e.code, e.ausgabe).toBe(0);
    const paare = [a, b].map((w) =>
      fensterAusProtokoll(join(w.ort, ".local/run/browserdeckel.jsonl")),
    );
    expect(Math.max(...paare.map((f) => f.length))).toBe(2);
    for (const fenster of paare) expect(ueberlappendePaare(fenster)).toEqual([]);
  });

  it("F8 · Überlappung mit Deckel: lauter Alarm mit Rückweg zum grünen Betrieb", async () => {
    const lauf = await paar(false, true);
    const journal = `${lauf.env.KLARWERK_BROWSERDECKEL_LOCK}.jsonl`;
    // Fehler einspeisen: echte überlappende Zeitfenster behaupten nun beide einen Deckel.
    const fehler = readFileSync(journal, "utf8").replaceAll('"deckel":false', '"deckel":true');
    writeFileSync(journal, fehler);
    expect(ueberlappendePaare(fensterAusProtokoll(journal))).toHaveLength(1);
    // Derselbe Journalleser läuft auch beim abschließenden Smoke, nach dem Vitest schon fertig ist.
    const ergebnis = await starte(lauf.ort, lauf.env, "./tools/browserdeckel.sh", [
      "smoke",
      "touch",
      "darf-nicht-starten",
    ]).fertig;
    expect(ergebnis.code).not.toBe(0);
    expect(ergebnis.ausgabe).toContain("überlappende Haltezeiträume");
    expect(ergebnis.ausgabe).toContain(`Journal: ${journal}`);
    expect(ergebnis.ausgabe).toContain("Falls ein Messlauf diese Einträge geschrieben hat");
    expect(ergebnis.ausgabe).toContain("deckel:false");
    expect(ergebnis.ausgabe).toContain("alle Tor- und Messläufe beenden");
    expect(ergebnis.ausgabe).toContain("Journal zur Beweissicherung umbenennen");
    expect(ergebnis.ausgabe).toContain("erneut starten");
    expect(existsSync(join(lauf.ort, "darf-nicht-starten"))).toBe(false);
    expect(existsSync(join(lauf.ort, "deckel.lock"))).toBe(false);
    console.log(`F8 ALARM exit=${ergebnis.code}\n${ergebnis.ausgabe}`);
    // Den gemeldeten Rückweg tatsächlich fahren; das alte Beweismaterial bleibt erhalten.
    const beweis = readFileSync(journal, "utf8");
    renameSync(journal, `${journal}.alarm`);
    for (let n = 1; n <= 2; n++) {
      const regel = await starte(lauf.ort, lauf.env, "./tools/browserdeckel.sh", ["smoke", "true"])
        .fertig;
      expect(regel.code, regel.ausgabe).toBe(0);
      console.log(`F8 WIEDERANLAUF ${n} exit=${regel.code}`);
    }
    expect(readFileSync(`${journal}.alarm`, "utf8")).toBe(beweis);
    expect(
      ueberlappendePaare(fensterAusProtokoll(join(lauf.ort, ".local/run/browserdeckel.jsonl"))),
    ).toEqual([]);
  });

  it("F10 · nach ausgeschaltetem Deckel bleiben zwei Regelläufe grün", async () => {
    const lauf = await paar(false, true);
    expect(ueberlappendePaare(lauf.fenster)).toHaveLength(1);
    expect(lauf.ausgabe).toContain("⚠ Browserdeckel aus — nur für Messungen");
    const journal = `${lauf.env.KLARWERK_BROWSERDECKEL_LOCK}.jsonl`;
    const messung = readFileSync(journal, "utf8");
    const ergebnisse = [];
    for (let n = 1; n <= 2; n++) {
      const regel = await starte(lauf.ort, lauf.env, "./tools/browserdeckel.sh", ["smoke", "true"])
        .fertig;
      console.log(`F10 REGELLAUF ${n} exit=${regel.code}\n${regel.ausgabe}`);
      ergebnisse.push(regel);
    }
    for (const e of ergebnisse) expect(e.code, e.ausgabe).toBe(0);
    expect(readFileSync(journal, "utf8").startsWith(messung)).toBe(true);
    const lokal = join(lauf.ort, ".local/run/browserdeckel.jsonl");
    expect(fensterAusProtokoll(lokal)).toHaveLength(2);
    expect(ueberlappendePaare(fensterAusProtokoll(lokal))).toEqual([]);
    expect(fensterAusProtokoll(lokal, true)).toHaveLength(4);
    expect(ueberlappendePaare(fensterAusProtokoll(lokal, true))).toHaveLength(1);
  });

  it("F11 · 50 000 Journalzeilen bleiben prüfbar, auch ein früher Alarm", async () => {
    const { ort, env } = werk();
    const journal = `${env.KLARWERK_BROWSERDECKEL_LOCK}.jsonl`;
    const zeilen: string[] = [];
    for (let n = 0; n < 25_000; n++) {
      for (const [offset, ereignis] of ["nehmen", "freigeben"].entries()) {
        zeilen.push(
          JSON.stringify({
            ereignis,
            id: `alt-${n}`,
            art: "browser",
            pid: 1,
            zeit: 1 + 2 * n + offset,
            gewartetMs: 0,
            deckel: true,
          }),
        );
      }
    }
    writeFileSync(journal, `${zeilen.join("\n")}\n`);
    const start = Date.now();
    const gruen = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
    const dauer = Date.now() - start;
    expect(gruen.code, gruen.ausgabe).toBe(0);
    expect(dauer).toBeLessThan(10_000);
    expect(
      readFileSync(join(ort, ".local/run/browserdeckel.jsonl"), "utf8").trim().split("\n"),
    ).toHaveLength(50_002);
    console.log(`F11 50000 Zeilen exit=${gruen.code} dauerMs=${dauer}`);
    // Kein Abschneiden alter Belege als scheinbare Leistungsverbesserung: direkt am Anfang
    // liegt jetzt eine Überlappung zweier geschützter Läufe, weit vor den letzten 50 000 Zeilen.
    zeilen[2] = JSON.stringify({ ...JSON.parse(zeilen[2] as string), zeit: 1 });
    [zeilen[1], zeilen[2]] = [zeilen[2] as string, zeilen[1] as string];
    writeFileSync(journal, `${zeilen.join("\n")}\n`);
    const rot = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
    expect(rot.code).not.toBe(0);
    expect(rot.ausgabe).toContain("überlappende Haltezeiträume: alt-0 ∥ alt-1");
  }, 30_000);

  it.each(["SIGTERM", "SIGINT"] as const)(
    "F9 · %s beendet die Lastgruppe vor der Freigabe und erhält den Abbruchcode",
    async (signal) => {
      const { ort, env } = werk();
      const pidpfad = join(ort, "kind.pid");
      const enkelpfad = join(ort, "enkel.pid");
      const enkelcode = `require('node:fs').writeFileSync(${JSON.stringify(enkelpfad)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)`;
      const lauf = starte(ort, env, "./tools/browserdeckel.sh", [
        "browser",
        "node",
        "-e",
        `require('node:fs').writeFileSync(${JSON.stringify(pidpfad)}, String(process.pid)); require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(enkelcode)}]); setInterval(() => {}, 1000)`,
      ]);
      const frist = Date.now() + 5000;
      while (!existsSync(enkelpfad) && Date.now() < frist)
        await new Promise((resolve) => setTimeout(resolve, 20));
      lauf.kind.kill(signal);
      const ergebnis = await lauf.fertig;
      expect(ergebnis.code, ergebnis.ausgabe).toBe(signal === "SIGTERM" ? 143 : 130);
      const pid = Number(readFileSync(pidpfad, "utf8"));
      expect(() => process.kill(pid, 0)).toThrow();
      const enkel = Number(readFileSync(enkelpfad, "utf8"));
      expect(() => process.kill(enkel, 0)).toThrow();
      expect(existsSync(env.KLARWERK_BROWSERDECKEL_LOCK)).toBe(false);
      const fenster = fensterAusProtokoll(join(ort, ".local/run/browserdeckel.jsonl"));
      expect(Number.isFinite(fenster[0]?.bis)).toBe(true);
    },
  );
});

const messpfad = join(WURZEL, ".local/run/browserdeckel.jsonl");
const gemessen = existsSync(messpfad);
if (!gemessen)
  console.warn(
    "Browserdeckel: nicht gemessen — kein Tor-Protokoll vorhanden; M wird übersprungen.",
  );
it.skipIf(!gemessen)(
  `M · Tor-Protokoll: ${gemessen ? "keine überlappenden Haltezeiträume" : "nicht gemessen — kein Browserdeckel-Protokoll vorhanden"}`,
  () => {
    const fenster = fensterAusProtokoll(messpfad);
    expect(ueberlappendePaare(fenster).join("\n")).toBe("");
  },
);
