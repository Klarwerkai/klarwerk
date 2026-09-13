// ================================================================================================
// JOB 3797 · DER PROZESSBELEG — nicht der Quelltext, der laufende Prozess.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DEM WÄCHTER STEHT. `werkzeug-startvertrag.test.ts` misst, WO der Aufruf
// im Quelltext steht. Das ist die Sicherung gegen den nächsten Umbau — es ist aber KEINE Aussage
// darüber, was der Betreiber der Vorführ-Instanz auf seinem Bildschirm liest. Die Zusage dieses
// Auftrags lautet: EINE lesbare Zeile mit ALLEN fehlenden Namen, Exit ungleich 0, keine Stapelspur.
// Solche Zusagen werden am Prozess gemessen, nicht am Text (Hausmuster:
// `tests/demo-zugang-start/echter-serverstart.test.ts`, JOB 3655 F).
//
// GEMESSEN AM BASISSTAND 56d2995, VOR DIESEM AUFTRAG — so sah es aus:
//   Produktion, `KLARWERK_DB_URL` gesetzt, `APP_BASE_URL` fehlt → Exit 1, zwölf Zeilen stderr,
//   erste Zeile `/…/services/app/src/start-vertrag.ts:927`, darin `at ModuleJob.run`.
//   Produktion, GAR NICHTS gesetzt → Exit 2 mit der eigenen Meldung; `APP_BASE_URL` kam im ganzen
//   Ausgabetext nicht vor. Der Betreiber erfuhr einen Namen und startete neu, um den nächsten zu
//   erfahren — genau das, was der Startvertrag beenden soll.
//
// DIE UMGEBUNG WIRD VOLLSTÄNDIG NEU GEBAUT und NICHT geerbt: eine lokal gesetzte `DATABASE_URL`
// brächte diese Datei sonst still zum Schweigen. Die Verbindungszeichenkette zeigt AUSDRÜCKLICH
// auf Port 1 — sie ist unerreichbar. Es wird keine Datenbank gestartet und keine berührt; das
// Werkzeug läuft im Trockenlauf (kein `--ausfuehren`) und schreibt auch dann nichts.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

/** Port 1 nimmt niemand an. Dieselbe Bauform wie in `echter-serverstart.test.ts` (:77). */
const UNERREICHBAR = "postgresql://kennung:kennwort@127.0.0.1:1/klarwerk_demo";

interface Lauf {
  readonly code: number | null;
  readonly fehlerausgabe: string;
  readonly ausgabe: string;
  /** Die erste nicht-leere Zeile auf stderr — „was steht ZUERST da". */
  readonly ersteFehlerzeile: string;
}

function starteWerkzeug(env: Record<string, string>): Lauf {
  const ergebnis = spawnSync("node", ["--import", "tsx", "tools/bodytext-nachziehen.ts"], {
    cwd: WURZEL,
    encoding: "utf8",
    timeout: 90_000,
    env: {
      // Das Minimum, ohne das Node nicht startet — kein `...process.env`.
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      KLARWERK_SKIP_KEYCHAIN: "1",
      ...env,
    },
  });
  const fehlerausgabe = ergebnis.stderr ?? "";
  return {
    code: ergebnis.status,
    fehlerausgabe,
    ausgabe: ergebnis.stdout ?? "",
    ersteFehlerzeile: fehlerausgabe.split("\n").find((z) => z.trim() !== "") ?? "",
  };
}

describe("JOB 3797 P · das Werkzeug bricht mit einem Satz ab", () => {
  it("P1 · Produktion, BEIDE Pflichtwerte fehlen → eine Zeile mit BEIDEN Namen, keine Stapelspur", () => {
    const lauf = starteWerkzeug({ NODE_ENV: "production" });
    expect(lauf.code, `Ausgabe:\n${lauf.fehlerausgabe}`).not.toBe(0);
    expect(
      lauf.ersteFehlerzeile,
      "die erste Zeile ist nicht der Vertragssatz — der Betreiber liest etwas anderes zuerst",
    ).toContain("StartvertragError");
    expect(lauf.ersteFehlerzeile).toContain("APP_BASE_URL");
    expect(lauf.ersteFehlerzeile).toContain("DATABASE_URL");
    expect(lauf.ersteFehlerzeile).toContain("Pflichtwert(e)");
    // Keine Stapelspur aus dem Modullader — der Mangel, gegen den dieser Auftrag steht.
    expect(lauf.fehlerausgabe, `Ausgabe:\n${lauf.fehlerausgabe}`).not.toContain("at ModuleJob.run");
    // EINE Zeile heisst EINE Zeile: der Fänger schreibt genau eine, nicht zwölf.
    expect(
      lauf.fehlerausgabe.split("\n").filter((z) => z.trim() !== "").length,
      `mehr als eine Zeile auf stderr:\n${lauf.fehlerausgabe}`,
    ).toBe(1);
    // Vor diesem Auftrag brach hier die EIGENE Meldung ab und nannte `APP_BASE_URL` nie.
    expect(lauf.fehlerausgabe).not.toContain("Kein Verbindungs-String");
  }, 120_000);

  it("P2 · Produktion, nur APP_BASE_URL fehlt → genau dieser eine Name", () => {
    const lauf = starteWerkzeug({ NODE_ENV: "production", DATABASE_URL: UNERREICHBAR });
    expect(lauf.code).not.toBe(0);
    expect(lauf.ersteFehlerzeile).toContain("APP_BASE_URL");
    expect(lauf.ersteFehlerzeile).toContain("1 Pflichtwert(e)");
    expect(lauf.fehlerausgabe).not.toContain("at ModuleJob.run");
    // Kein Kennwort in der Ausgabe, obwohl eines in der Verbindungszeichenkette steht.
    expect(lauf.fehlerausgabe).not.toContain("kennwort");
  }, 120_000);

  it("P3 · ausserhalb der Produktion verlangt der Vertrag nichts — die eigene Meldung gilt weiter", () => {
    // Der Vertrag prüft nur in Produktion (`start-vertrag.ts:906`). Entwicklung und Testläufe
    // dürfen sich nicht ändern; das ist gemessen und nicht behauptet.
    const lauf = starteWerkzeug({ NODE_ENV: "test" });
    expect(lauf.fehlerausgabe).not.toContain("StartvertragError");
    expect(lauf.fehlerausgabe).not.toContain("Pflichtwert(e)");
    expect(lauf.ersteFehlerzeile).toContain("Kein Verbindungs-String");
    expect(lauf.code).toBe(2);
  }, 120_000);

  it("P4 · KALIBRIERUNG: mit vollständiger Umgebung lässt der Vertrag durch", () => {
    // Ohne diese Gegenrichtung wären P1/P2 auch dann grün, wenn das Werkzeug IMMER abbräche.
    // Hier scheitert es an etwas anderem — die Datenbank antwortet nicht — und genau das ist der
    // Beleg, dass der Vertrag es hat passieren lassen.
    const lauf = starteWerkzeug({
      NODE_ENV: "production",
      DATABASE_URL: UNERREICHBAR,
      KLARWERK_DB_URL: UNERREICHBAR,
      APP_BASE_URL: "https://demo.klarwerk.ai",
    });
    expect(lauf.fehlerausgabe).not.toContain("StartvertragError");
    expect(lauf.fehlerausgabe).not.toContain("Pflichtwert(e)");
    expect(lauf.code, `Ausgabe:\n${lauf.fehlerausgabe}`).not.toBe(0);
    expect(
      lauf.fehlerausgabe,
      `der Abbruch kommt nicht vom Treiber:\n${lauf.fehlerausgabe}`,
    ).toContain("ECONNREFUSED");
  }, 120_000);
});
