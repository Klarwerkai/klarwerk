import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PROTOKOLL_FRIST_TAGE,
  PROTOKOLL_ROTATION_MS,
  pflegeProtokolle,
  starteProtokollPflege,
} from "../../services/app/src/protokoll-frist";

// ================================================================================================
// R-0664 · PETERS ENTSCHEIDUNG 2 (12.10.2026): 14 TAGE, DANN AUTOMATISCH GELÖSCHT —
// AM TATSÄCHLICHEN SPEICHERORT, EINSCHLIESSLICH DIAGNOSEKOPIEN.
// ================================================================================================
//
// Gemessen wird an einem echten Ordner mit echten Dateien in der Form des Insel-Protokollordners
// (`$SHARED_ROOT/logs/server-<port>.log`), nicht an einer Attrappe. Die Zeit ist eingespritzt, damit
// „14 Tage später" ohne Warten geprüft werden kann.

const TAG = 24 * 60 * 60 * 1000;
// Bewusst die echte Uhr als Bezug: das ANLAGEdatum der Testdateien setzt das Dateisystem selbst, und
// die Pflege berücksichtigt es. Ein fester Zeitpunkt läge je nach Ausführungstag davor oder dahinter.
const JETZT = Date.now();

const ordner: string[] = [];
afterEach(() => {
  for (const o of ordner.splice(0)) {
    rmSync(o, { recursive: true, force: true });
  }
});

function protokollordner(): string {
  const o = mkdtempSync(join(tmpdir(), "klarwerk-protokollfrist-"));
  ordner.push(o);
  return o;
}

function zeile(zeit: number, text: string): string {
  return `${JSON.stringify({ level: 30, time: zeit, msg: text })}\n`;
}

/** Legt eine Datei an und setzt ihr Änderungsdatum. */
function datei(pfad: string, inhalt: string, geaendert: number): void {
  writeFileSync(pfad, inhalt, "utf8");
  utimesSync(pfad, geaendert / 1000, geaendert / 1000);
}

describe("R-0664 · Löschfrist der Serverprotokolle am Speicherort", () => {
  it("die Frist ist die entschiedene: 14 Tage", () => {
    expect(PROTOKOLL_FRIST_TAGE).toBe(14);
  });

  it("Archive fallen, sobald ihre älteste Zeile 14 Tage alt ist — jüngere bleiben", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, zeile(JETZT - 60_000, "läuft"), JETZT);
    writeFileSync(`${aktiv}.beginn`, `${JETZT - 60_000}\n`);
    datei(join(o, "server-3002.alt.log"), zeile(JETZT - 15 * TAG, "alt"), JETZT - 14.5 * TAG);
    datei(join(o, "server-3002.grenze.log"), zeile(JETZT - 14 * TAG, "grenze"), JETZT - 13 * TAG);
    datei(join(o, "server-3002.jung.log"), zeile(JETZT - 13 * TAG, "jung"), JETZT - 12 * TAG);

    const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });

    expect(ergebnis.geloescht.sort()).toEqual(["server-3002.alt.log", "server-3002.grenze.log"]);
    expect(existsSync(join(o, "server-3002.jung.log"))).toBe(true);
    // Die aktive Datei wird nie gelöscht — sie wird rotiert.
    expect(existsSync(aktiv)).toBe(true);
  });

  it("Diagnosekopie: heute kopiert, Inhalt 20 Tage alt — sie fällt nach dem INHALT, nicht dem Datum", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, "", JETZT);
    datei(join(o, "diagnose-fuer-ticket.log"), zeile(JETZT - 20 * TAG, "alt"), JETZT);
    const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
    expect(ergebnis.geloescht).toEqual(["diagnose-fuer-ticket.log"]);
  });

  it("Diagnosekopie ohne Zeitangabe im Inhalt: es gilt das Dateidatum", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, "", JETZT);
    datei(join(o, "auszug-alt.log"), "[start] Datenhaltung: Journal\n", JETZT - 15 * TAG);
    datei(join(o, "auszug-neu.log"), "[start] Datenhaltung: Journal\n", JETZT - 2 * TAG);
    const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
    expect(ergebnis.geloescht).toEqual(["auszug-alt.log"]);
    expect(existsSync(join(o, "auszug-neu.log"))).toBe(true);
  });

  it("nur `.log`-Dateien im Protokollordner — PID-Datei und Beginn-Markierung bleiben", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, "", JETZT);
    writeFileSync(`${aktiv}.beginn`, `${JETZT}\n`);
    datei(join(o, "server-3002.pid"), "4711\n", JETZT - 40 * TAG);
    pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
    expect(readdirSync(o).sort()).toEqual([
      "server-3002.log",
      "server-3002.log.beginn",
      "server-3002.pid",
    ]);
  });

  it("erster Lauf ohne Markierung: Markierung gesetzt, nicht sofort rotiert", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, zeile(JETZT - 3 * TAG, "Bestand"), JETZT);
    const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
    expect(ergebnis.rotiertNach).toBeNull();
    expect(readFileSync(`${aktiv}.beginn`, "utf8").trim()).toBe(String(JETZT));
    // Einen Tag später wird der Bestand rotiert …
    const danach = pflegeProtokolle({ datei: aktiv, jetzt: JETZT + PROTOKOLL_ROTATION_MS });
    expect(danach.rotiertNach).not.toBeNull();
    // … und fällt, sobald seine älteste Zeile 14 Tage alt ist.
    const spaeter = pflegeProtokolle({ datei: aktiv, jetzt: JETZT + 11 * TAG });
    expect(spaeter.geloescht).toEqual([danach.rotiertNach]);
  });

  it("WIRKUNG ohne Neustart: der laufende Schreiber (O_APPEND) schreibt nach dem Kürzen sauber weiter", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    // So öffnen `>>` in insel-betrieb.sh und der launchd-Agent die Datei: zum Anhängen.
    const fd = openSync(aktiv, "a");
    try {
      writeSync(fd, zeile(JETZT - 2 * TAG, "vor der Rotation"));
      writeFileSync(`${aktiv}.beginn`, `${JETZT - 2 * TAG}\n`);
      const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
      expect(ergebnis.rotiertNach).toMatch(/^server-3002\.\d{8}T\d{6}Z\.log$/);
      writeSync(fd, zeile(JETZT, "nach der Rotation"));
    } finally {
      closeSync(fd);
    }
    const jetztInhalt = readFileSync(aktiv, "utf8");
    expect(jetztInhalt).toContain("nach der Rotation");
    expect(jetztInhalt).not.toContain("vor der Rotation");
    // Kein Loch aus Nullbytes am Anfang — der Schreiber stand nicht am alten Versatz.
    expect(jetztInhalt.startsWith("{")).toBe(true);
    const archiv = readdirSync(o).find((n) => /^server-3002\.\d{8}T\d{6}Z\.log$/.test(n)) ?? "";
    expect(readFileSync(join(o, archiv), "utf8")).toContain("vor der Rotation");
    // Und das Archiv fällt mit der Frist.
    const spaeter = pflegeProtokolle({ datei: aktiv, jetzt: JETZT + 13 * TAG });
    expect(spaeter.geloescht).toEqual([archiv]);
  });

  it("der Taktgeber: läuft beim Start sofort und dann bei jedem Takt; ohne Datei geschieht nichts", async () => {
    expect(starteProtokollPflege({ datei: undefined })).toBeNull();
    expect(starteProtokollPflege({ datei: "  " })).toBeNull();

    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, "", JETZT);
    writeFileSync(`${aktiv}.beginn`, `${JETZT}\n`);
    let uhr = JETZT;
    let takt: (() => void) | null = null;
    const gepflegt: string[][] = [];
    const handle = starteProtokollPflege({
      datei: aktiv,
      jetzt: () => uhr,
      setIntervalFn: (callback) => {
        takt = callback;
        return 0 as unknown as ReturnType<typeof setInterval>;
      },
      clearIntervalFn: () => {},
      onGepflegt: (e) => gepflegt.push(e.geloescht),
    });
    expect(handle).not.toBeNull();
    expect(takt).not.toBeNull();

    // Eine Diagnosekopie taucht auf; zwei Wochen vergehen; der nächste Takt räumt sie weg.
    datei(join(o, "diagnose.log"), zeile(JETZT, "Auszug"), JETZT);
    uhr = JETZT + 14 * TAG;
    (takt as unknown as () => void)();
    await new Promise((fertig) => setTimeout(fertig, 0));
    expect(existsSync(join(o, "diagnose.log"))).toBe(false);
    expect(gepflegt.flat()).toContain("diagnose.log");
  });

  it("start.command nennt der App die Datei, in die beide Insel-Startwege schreiben", () => {
    const text = readFileSync("scripts/insel/release-texte.mjs", "utf8");
    expect(text).toContain(
      'export KLARWERK_LOG_DATEI="\\${KLARWERK_LOG_DATEI:-$SHARED_ROOT/logs/server-$PORT.log}"',
    );
    // Dieselbe Datei, in die insel-betrieb.sh (`>>`) die Ausgabe hängt.
    expect(readFileSync("scripts/insel/update-einspielen.sh", "utf8")).toContain(
      'LOG_DATEI="$LOGS/server-${PORT}.log"',
    );
  });
});
