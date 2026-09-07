// JOB 3150: echte Unterprozesse, aber markierte Lastsonden statt Chromium/Servern.
// V0 misst die heutige Verdrahtung vor dem Bau; F6 kalibriert dieselben Fenster ohne Deckel.
import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
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
    SONDENPFAD: ort,
    KLARWERK_BROWSERDECKEL_LOCK: join(ort, "deckel.lock"),
    KLARWERK_BROWSERDECKEL_TIMEOUT: "10",
  };
  delete env.KLARWERK_TESTGRUPPE;
  delete env.KLARWERK_BROWSERDECKEL;
  return { ort, env };
}

function starte(ort: string, env: NodeJS.ProcessEnv, befehl: string, args: string[] = []) {
  const kind = spawn(befehl, args, { cwd: ort, env, stdio: ["ignore", "pipe", "pipe"] });
  let ausgabe = "";
  kind.stdout.on("data", (data) => {
    ausgabe += data;
  });
  kind.stderr.on("data", (data) => {
    ausgabe += data;
  });
  const fertig = new Promise<{ code: number | null; ausgabe: string }>((resolve) => {
    kind.on("error", (error) => resolve({ code: -1, ausgabe: String(error) }));
    kind.on("close", (code) => resolve({ code, ausgabe }));
  });
  return { kind, fertig };
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

  it("F2 · eine tote PID wird laut aufgeräumt", async () => {
    const { ort, env } = werk();
    const tot = starte(ort, env, "node", ["-e", "process.exit(0)"]);
    await tot.fertig;
    const pid = tot.kind.pid as number;
    expect(() => process.kill(pid, 0)).toThrow();
    mkdirSync(env.KLARWERK_BROWSERDECKEL_LOCK);
    writeFileSync(join(env.KLARWERK_BROWSERDECKEL_LOCK, `pid-${pid}`), `${pid} 1 browser\n`);
    const lauf = await starte(ort, env, "./tools/browserdeckel.sh", ["smoke", "true"]).fertig;
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain("verwaist");
    expect(existsSync(env.KLARWERK_BROWSERDECKEL_LOCK)).toBe(false);
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
