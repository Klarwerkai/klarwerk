// ================================================================================================
// R-1327 / R-2211 — DER MELDER, GEMESSEN AM ECHTEN VITEST-LAUF.
// ================================================================================================
//
// Drei Teile:
//   · M — die Zählung und die Meldetexte an gebauten Aufgabenbäumen (schnell, ohne Unterprozess);
//   · V — `vitest.integration.config.ts` hängt Testläufer und Reporter wirklich ein;
//   · L — ein echter Vitest-Unterprozess über `probe/probe.vitest.config.ts` mit Probedateien in
//     der Hausform einer Postgres-Suite ohne Datenbank. Gemessen wird die AUSGABE, nicht der Code:
//     was der Lauf sagt, wenn er nichts gegen die Datenbank prüft.
//
// Der Unterprozess braucht keine Datenbank und keinen Container — die Probedateien überspringen
// sich so, wie es die echten Suiten ohne Docker tun.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import integration, { UEBERSPRUNGEN_RUNNER } from "../../vitest.integration.config";
import { type Aufgabe, PgLaufMelder, dateiMeldung, gesamtMeldung, laufbild } from "./melder";

const WURZEL = fileURLToPath(new URL("../..", import.meta.url));
const PROBE_KONFIG = "tests/pg-laufbeleg/probe/probe.vitest.config.ts";
const NUR_UEBERSPRUNGEN = "tests/pg-laufbeleg/probe/nur-uebersprungen.probe.ts";
const NUR_STATISCH = "tests/pg-laufbeleg/probe/nur-statisch.probe.ts";
const GELAUFEN = "tests/pg-laufbeleg/probe/gelaufen.probe.ts";

function fall(name: string, mode: string, state?: string): Aufgabe {
  return { name, mode, ...(state === undefined ? {} : { result: { state } }) };
}

const DATEI: Aufgabe = {
  name: "services/x/repo-pg.integration.test.ts",
  mode: "run",
  tasks: [
    {
      name: "gegen echtes Postgres",
      mode: "run",
      tasks: [
        fall("schreibt", "run", "pass"),
        fall("liest", "skip", "skip"),
        fall("zählt", "run", "fail"),
      ],
    },
    fall("statisch aus", "skip"),
    fall("später", "todo"),
  ],
};

describe("R-1327 · M · Zählung und Meldetext", () => {
  it("M1 · zählt gelaufene, fehlgeschlagene und übersprungene FÄLLE mit vollem Pfad", () => {
    const bild = laufbild([DATEI]);
    expect(bild.gelaufen).toBe(1);
    expect(bild.fehlgeschlagen).toBe(1);
    expect(bild.uebersprungen).toEqual([
      "services/x/repo-pg.integration.test.ts › gegen echtes Postgres › liest",
      "services/x/repo-pg.integration.test.ts › statisch aus",
      "services/x/repo-pg.integration.test.ts › später",
    ]);
  });

  it("M2 · ein zur Laufzeit übersprungener Fall zählt auch dann, wenn sein Modus noch `run` ist", () => {
    // So steht `ctx.skip()` im Bericht: Modus aus der Sammlung, Ausgang `skip`.
    expect(laufbild([fall("ctx.skip", "run", "skip")]).uebersprungen).toEqual(["ctx.skip"]);
  });

  it("M3 · die Dateimeldung nennt jeden übersprungenen Fall und schweigt ohne Überspringen", () => {
    const text = dateiMeldung(laufbild([DATEI])) ?? "";
    expect(text).toContain("3 Fall/Fälle ÜBERSPRUNGEN");
    expect(text).toContain("NICHTS geprüft");
    expect(text).toContain("ÜBERSPRUNGEN: services/x/repo-pg.integration.test.ts › statisch aus");
    expect(dateiMeldung(laufbild([fall("schreibt", "run", "pass")]))).toBeUndefined();
  });

  it("M4 · die Bilanz sagt ausdrücklich, wenn KEIN Fall lief (R-2211)", () => {
    const leer = gesamtMeldung(laufbild([fall("a", "skip"), fall("b", "run", "skip")]));
    expect(leer).toContain("0 gelaufen · 2 ÜBERSPRUNGEN · 0 fehlgeschlagen");
    expect(leer).toContain("KEIN EINZIGER FALL LIEF");
    expect(leer).toContain("KEINEN echten Datenbankbetrieb");
  });

  it("M5 · KALIBRIERUNG: ein voll gelaufener Lauf behauptet weder Überspringen noch Leere", () => {
    const voll = gesamtMeldung(laufbild([fall("a", "run", "pass")]));
    expect(voll).toContain("1 gelaufen · 0 ÜBERSPRUNGEN");
    expect(voll).toContain("Kein Fall übersprungen.");
    expect(voll).not.toContain("ÜBERSPRUNGEN:");
    expect(voll).not.toContain("KEIN EINZIGER FALL LIEF");
  });

  it("M6 · die Bilanz kürzt lange Listen und sagt, wie viele fehlen", () => {
    const viele = Array.from({ length: 45 }, (_, i) => fall(`f${i}`, "skip"));
    const text = gesamtMeldung(laufbild(viele));
    expect(text).toContain("ÜBERSPRUNGEN: f39");
    expect(text).not.toContain("ÜBERSPRUNGEN: f40");
    expect(text).toContain("… und 5 weitere");
  });
});

describe("R-1327 · V · der Integrationslauf ist verdrahtet", () => {
  it("V1 · Testläufer und Reporter stehen in `vitest.integration.config.ts`", () => {
    expect(integration.test?.runner).toBe(UEBERSPRUNGEN_RUNNER);
    const reporter = integration.test?.reporters;
    expect(Array.isArray(reporter) ? reporter : [reporter]).toEqual(
      expect.arrayContaining(["default", expect.any(PgLaufMelder)]),
    );
  });
});

interface Lauf {
  readonly code: number | null;
  readonly ausgabe: string;
}

/** Ein echter Vitest-Lauf über den Prüfstand. `KLARWERK_TESTGRUPPE` wird entfernt (s. tor-inventar). */
function lauf(dateien: readonly string[], zusatz: readonly string[] = []): Lauf {
  const umgebung: NodeJS.ProcessEnv = { ...process.env, KLARWERK_SKIP_KEYCHAIN: "1" };
  delete umgebung.KLARWERK_TESTGRUPPE;
  const ergebnis = spawnSync(
    "npx",
    ["vitest", "run", "--config", PROBE_KONFIG, ...zusatz, ...dateien],
    { cwd: WURZEL, env: umgebung, encoding: "utf8" },
  );
  return { code: ergebnis.status, ausgabe: `${ergebnis.stdout ?? ""}\n${ergebnis.stderr ?? ""}` };
}

function beleg(l: Lauf): string {
  return `Exit ${l.code}\n${l.ausgabe.slice(-2500)}`;
}

describe("R-1327 · L · der echte Lauf meldet das Überspringen laut", () => {
  it("L1 · nur übersprungene Fälle: jede Datei nennt sie, die Bilanz sagt KEIN EINZIGER FALL LIEF", () => {
    const l = lauf([NUR_UEBERSPRUNGEN]);
    expect(l.ausgabe, beleg(l)).toContain(
      `ÜBERSPRUNGEN: ${NUR_UEBERSPRUNGEN} › Probe-Pg-Suite › schreibt eine Zeile in die echte Datenbank`,
    );
    expect(l.ausgabe, beleg(l)).toContain(
      `ÜBERSPRUNGEN: ${NUR_UEBERSPRUNGEN} › Probe-Pg-Gruppe ohne Container › liest die Zeile wieder`,
    );
    expect(l.ausgabe, beleg(l)).toContain("INTEGRATIONSLAUF: 0 gelaufen · 2 ÜBERSPRUNGEN");
    expect(l.ausgabe, beleg(l)).toContain("KEIN EINZIGER FALL LIEF");
    // Bewusst unverändert: das Überspringen färbt den Lauf nicht rot (Betriebsentscheidung, s.
    // melder.ts). Verlangt ist, dass er es SAGT.
    expect(l.code, beleg(l)).toBe(0);
  });

  it("L2 · KALIBRIERUNG: ein voll gelaufener Lauf meldet kein Überspringen", () => {
    const l = lauf([GELAUFEN]);
    expect(l.ausgabe, beleg(l)).toContain("INTEGRATIONSLAUF: 1 gelaufen · 0 ÜBERSPRUNGEN");
    expect(l.ausgabe, beleg(l)).toContain("Kein Fall übersprungen.");
    expect(l.ausgabe, beleg(l)).not.toContain("ÜBERSPRUNGEN:");
    expect(l.code, beleg(l)).toBe(0);
  });

  it("L3 · gemischt: die Bilanz zählt über alle Dateien", () => {
    const l = lauf([NUR_UEBERSPRUNGEN, GELAUFEN]);
    expect(l.ausgabe, beleg(l)).toContain("INTEGRATIONSLAUF: 1 gelaufen · 2 ÜBERSPRUNGEN");
    expect(l.ausgabe, beleg(l)).not.toContain("KEIN EINZIGER FALL LIEF");
  });

  it("L4 · mit eigenem `--reporter` entfällt die Bilanz, die Dateimeldung bleibt", () => {
    // Ein Aufrufer, der den Reporter selbst wählt, ersetzt die Reporterliste der Konfiguration.
    // Die Meldung je Datei hängt deshalb am Testläufer und nicht am Reporter.
    const l = lauf([NUR_UEBERSPRUNGEN], ["--reporter=dot"]);
    expect(l.ausgabe, beleg(l)).toContain(
      `ÜBERSPRUNGEN: ${NUR_UEBERSPRUNGEN} › Probe-Pg-Suite › schreibt eine Zeile in die echte Datenbank`,
    );
    expect(l.ausgabe, beleg(l)).not.toContain("INTEGRATIONSLAUF:");
  });

  it("L5 · eine ganz statisch übersprungene Datei meldet sich auch mit eigenem `--reporter`", () => {
    // Bens Befund (Nacharbeit 2): steht die ganze Datei auf `mode=skip`, fährt Vitest keinen ihrer
    // Hooks, und der eigene Reporter nimmt die Bilanz weg. Die Meldung muss trotzdem kommen.
    const l = lauf([NUR_STATISCH], ["--reporter=dot"]);
    expect(l.ausgabe, beleg(l)).toContain("2 Fall/Fälle ÜBERSPRUNGEN");
    expect(l.ausgabe, beleg(l)).toContain(
      `ÜBERSPRUNGEN: ${NUR_STATISCH} › Probe-Statisch-Suite › prüft die echte Datenbank`,
    );
    expect(l.ausgabe, beleg(l)).toContain(
      `ÜBERSPRUNGEN: ${NUR_STATISCH} › Probe-Statisch-Suite › prüft sie ein zweites Mal`,
    );
    expect(l.ausgabe, beleg(l)).not.toContain("INTEGRATIONSLAUF:");
    expect(l.code, beleg(l)).toBe(0);
  });
});
