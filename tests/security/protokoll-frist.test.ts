import {
  closeSync,
  existsSync,
  mkdirSync,
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
  DIAGNOSE_UNTERORDNER,
  PROTOKOLL_FRIST_TAGE,
  PROTOKOLL_ROTATION_MS,
  pflegeProtokolle,
  starteProtokollPflege,
} from "../../services/app/src/protokoll-frist";
import {
  KLARWERK_AUSWAHL,
  berichteDockerProtokolle,
  leseAuswahl,
  pflegeDockerProtokolle,
} from "../../services/app/src/protokoll-frist-docker";

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

/** Die Auswahl, die Dockerfile, Compose und Coolify-Aufruf gemeinsam tragen. */
const KLARWERK = { label: "de.klarwerk.protokollpflege", wert: "app" };

/** Eine `config.v2.json`, wie dockerd sie für einen Container aus dem App-Abbild schreibt (Auszug). */
function appKonfiguration(): string {
  return JSON.stringify({
    Name: "/klarwerk-app-1",
    Config: { Image: "klarwerk-app", Labels: { "de.klarwerk.protokollpflege": "app" } },
  });
}

/**
 * Zwei FREMDE, syntaktisch gültige Container mit überfälligen Protokollen: einer mit eigenen Labels
 * (etwa ein Auditdienst), einer mit dem Klarwerk-Labelnamen, aber anderem Wert. `unberuehrt()` prüft,
 * dass der Lauf an keinem von beiden etwas geändert hat — keine Datei weg, keine neu, kein Inhalt fort.
 */
function fremderContainer(
  wurzel: string,
  dockerZeile: (zeit: number, text: string) => string,
): { unberuehrt: () => void } {
  const faelle = [
    { id: "fedcba9876543210fedcba98", labels: { "com.example.audit": "sicherheit" } },
    { id: "abcdefabcdefabcdefabcdef", labels: { "de.klarwerk.protokollpflege": "nein" } },
  ];
  const vorher = new Map<string, string[]>();
  for (const { id, labels } of faelle) {
    const ordner = join(wurzel, id);
    mkdirSync(ordner);
    datei(join(ordner, `${id}-json.log`), dockerZeile(JETZT - 20 * TAG, "fremd-alt"), JETZT);
    datei(join(ordner, `${id}-json.log.1`), dockerZeile(JETZT - 30 * TAG, "fremd-alt"), JETZT);
    datei(join(ordner, "config.v2.json"), JSON.stringify({ Config: { Labels: labels } }), JETZT);
    vorher.set(id, readdirSync(ordner).sort());
  }
  return {
    unberuehrt: () => {
      for (const { id } of faelle) {
        const ordner = join(wurzel, id);
        expect(readdirSync(ordner).sort(), id).toEqual(vorher.get(id));
        expect(readFileSync(join(ordner, `${id}-json.log`), "utf8"), id).toContain("fremd-alt");
        expect(readFileSync(join(ordner, `${id}-json.log.1`), "utf8"), id).toContain("fremd-alt");
      }
    },
  };
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

  // Ben, Nacharbeit 10: beim ersten Lauf ohne Beginn-Markierung blieb ein über 14 Tage alter Bestand
  // in der aktiven Datei mindestens einen weiteren Tag stehen. Der Beginn kommt jetzt aus dem Inhalt.
  it("erster Lauf, ÜBERFÄLLIGER Bestand: sofort rotiert und im selben Lauf gelöscht — der Schreiber hängt weiter an", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    const fd = openSync(aktiv, "a");
    try {
      writeSync(fd, zeile(JETZT - 20 * TAG, "uralt"));
      writeSync(fd, zeile(JETZT - 1000, "frisch"));
      const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
      expect(ergebnis.rotiertNach).toMatch(/^server-3002\.\d{8}T\d{6}Z\.log$/);
      expect(ergebnis.geloescht).toEqual([ergebnis.rotiertNach]);
      writeSync(fd, zeile(JETZT, "danach"));
    } finally {
      closeSync(fd);
    }
    // Kein Rest des Bestands, nirgends im Ordner.
    for (const name of readdirSync(o)) {
      expect(readFileSync(join(o, name), "utf8"), name).not.toContain("uralt");
    }
    // Die aktive Datei steht noch an ihrem Pfad, und der Schreiber schreibt sauber weiter.
    const inhalt = readFileSync(aktiv, "utf8");
    expect(inhalt.startsWith("{")).toBe(true);
    expect(inhalt).toContain("danach");
    expect(readFileSync(`${aktiv}.beginn`, "utf8").trim()).toBe(String(JETZT));
  });

  it("erster Lauf, Bestand 3 Tage alt: sofort rotiert, Archiv bleibt bis zur Frist seiner ältesten Zeile", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, zeile(JETZT - 3 * TAG, "Bestand"), JETZT);
    const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
    expect(ergebnis.rotiertNach).not.toBeNull();
    expect(ergebnis.geloescht).toEqual([]);
    // … und fällt, sobald seine älteste Zeile 14 Tage alt ist.
    const spaeter = pflegeProtokolle({ datei: aktiv, jetzt: JETZT + 11 * TAG });
    expect(spaeter.geloescht).toEqual([ergebnis.rotiertNach]);
  });

  it("erster Lauf, Bestand von heute: nur die Markierung, keine Rotation", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, zeile(JETZT - 60_000, "heute"), JETZT);
    const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
    expect(ergebnis.rotiertNach).toBeNull();
    expect(Number(readFileSync(`${aktiv}.beginn`, "utf8").trim())).toBeLessThanOrEqual(JETZT);
    expect(readFileSync(aktiv, "utf8")).toContain("heute");
    // Einen Tag später wird rotiert.
    const danach = pflegeProtokolle({ datei: aktiv, jetzt: JETZT + PROTOKOLL_ROTATION_MS });
    expect(danach.rotiertNach).not.toBeNull();
  });

  it("Diagnose-Unterordner: jede Datei darin fällt nach der Frist, gleich welcher Endung", () => {
    const o = protokollordner();
    const aktiv = join(o, "server-3002.log");
    datei(aktiv, "", JETZT);
    mkdirSync(join(o, DIAGNOSE_UNTERORDNER));
    datei(join(o, DIAGNOSE_UNTERORDNER, "ticket-4711.txt"), zeile(JETZT - 15 * TAG, "x"), JETZT);
    datei(join(o, DIAGNOSE_UNTERORDNER, "auszug.json"), "{}", JETZT - 16 * TAG);
    datei(join(o, DIAGNOSE_UNTERORDNER, "neu.txt"), zeile(JETZT - TAG, "y"), JETZT);
    const ergebnis = pflegeProtokolle({ datei: aktiv, jetzt: JETZT });
    expect(ergebnis.geloescht.sort()).toEqual(["diagnose/auszug.json", "diagnose/ticket-4711.txt"]);
    expect(readdirSync(join(o, DIAGNOSE_UNTERORDNER))).toEqual(["neu.txt"]);
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

  // Ben, Nacharbeit 10: Docker/Coolify waren nicht abgedeckt. Die Containerprotokolle liegen auf dem
  // Host unter /var/lib/docker/containers/<id>/ — gemessen wird an genau dieser Ordnerform.
  it("Docker-Hostlauf: aktive Datei, Dockers Rotationen und Diagnoseordner nach der Frist", () => {
    const wurzel = protokollordner();
    const id = "a1b2c3d4e5f60718293a4b5c";
    const ordner = join(wurzel, id);
    mkdirSync(ordner);
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const aktiv = join(ordner, `${id}-json.log`);
    // So schreibt dockerd: anhängend. Bestand 20 Tage alt, kein Beginn — der erste Lauf.
    const fd = openSync(aktiv, "a");
    writeSync(fd, dockerZeile(JETZT - 20 * TAG, "uralt"));
    datei(join(ordner, `${id}-json.log.1`), dockerZeile(JETZT - 15 * TAG, "rotiert-alt"), JETZT);
    datei(join(ordner, `${id}-json.log.2`), dockerZeile(JETZT - 3 * TAG, "rotiert-jung"), JETZT);
    // Die Docker-Konfiguration des Containers — mit dem Label, das das Dockerfile setzt.
    datei(join(ordner, "config.v2.json"), appKonfiguration(), JETZT - 40 * TAG);
    // Kein Container (keine Hex-Kennung) — wird nicht angefasst.
    mkdirSync(join(wurzel, "kein-container"));
    datei(join(wurzel, "kein-container", "kein-container-json.log"), "x\n", JETZT - 40 * TAG);
    // Ben, Nacharbeit 12: ein SYNTAKTISCH GÜLTIGER fremder Container mit überfälligem Protokoll.
    const fremd = fremderContainer(wurzel, dockerZeile);
    const diagnose = join(wurzel, "diagnose-protokolle");
    mkdirSync(diagnose);
    datei(join(diagnose, "docker-logs-app.txt"), dockerZeile(JETZT - 15 * TAG, "kopie"), JETZT);

    const lauf = pflegeDockerProtokolle({
      ordner: wurzel,
      auswahl: KLARWERK,
      diagnoseordner: diagnose,
      jetzt: JETZT,
    });
    writeSync(fd, dockerZeile(JETZT, "danach"));
    closeSync(fd);

    const ergebnis = lauf.container[id];
    expect(Object.keys(lauf.container)).toEqual([id]);
    fremd.unberuehrt();
    expect(ergebnis?.rotiertNach).toMatch(new RegExp(`^${id}-json\\.\\d{8}T\\d{6}Z\\.log$`));
    expect(ergebnis?.geloescht.sort()).toEqual([`${id}-json.log.1`, ergebnis?.rotiertNach].sort());
    expect(existsSync(join(ordner, `${id}-json.log.2`))).toBe(true);
    expect(existsSync(join(ordner, "config.v2.json"))).toBe(true);
    expect(existsSync(join(wurzel, "kein-container", "kein-container-json.log"))).toBe(true);
    expect(lauf.diagnose).toEqual(["docker-logs-app.txt"]);
    // Dockers aktive Datei bleibt an ihrem Pfad und nimmt weitere Zeilen an — ohne den Bestand.
    const inhalt = readFileSync(aktiv, "utf8");
    expect(inhalt.startsWith("{")).toBe(true);
    expect(inhalt).toContain("danach");
    expect(inhalt).not.toContain("uralt");
  });

  it("Docker-Hostlauf OHNE Auswahl: kein Container wird bearbeitet — auch kein Klarwerk-Container", () => {
    const wurzel = protokollordner();
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const fremd = fremderContainer(wurzel, dockerZeile);
    const id = "0123456789abcdef01234567";
    mkdirSync(join(wurzel, id));
    datei(join(wurzel, id, `${id}-json.log`), dockerZeile(JETZT - 20 * TAG, "app-alt"), JETZT);
    datei(join(wurzel, id, `${id}-json.log.1`), dockerZeile(JETZT - 20 * TAG, "app-alt"), JETZT);
    datei(join(wurzel, id, "config.v2.json"), appKonfiguration(), JETZT);
    const vorher = readdirSync(join(wurzel, id)).sort();

    const lauf = pflegeDockerProtokolle({ ordner: wurzel, auswahl: null, jetzt: JETZT });

    expect(lauf.container).toEqual({});
    expect(readdirSync(join(wurzel, id)).sort()).toEqual(vorher);
    expect(readFileSync(join(wurzel, id, `${id}-json.log`), "utf8")).toContain("app-alt");
    fremd.unberuehrt();
    // Die Kommandozeile liest die Auswahl streng: ohne `=` oder mit leerer Hälfte gibt es keine.
    expect(leseAuswahl(undefined)).toBeNull();
    expect(leseAuswahl("de.klarwerk.protokollpflege")).toBeNull();
    expect(leseAuswahl("de.klarwerk.protokollpflege=")).toBeNull();
    expect(leseAuswahl("=app")).toBeNull();
    expect(leseAuswahl(KLARWERK_AUSWAHL)).toEqual(KLARWERK);
  });

  // Ben, Nacharbeit 13: der Betriebsnachweis am echten Host. Der Bericht ändert nichts und zeigt vor
  // und nach dem Lauf Zuordnung und Alter — hier an derselben Ordnerform wie auf dem Host gemessen.
  it("Bericht: ändert nichts, zeigt die Zuordnung und belegt die Wirkung vorher/nachher", () => {
    const wurzel = protokollordner();
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const fremd = fremderContainer(wurzel, dockerZeile);
    const id = "0123456789abcdef01234567";
    mkdirSync(join(wurzel, id));
    datei(join(wurzel, id, `${id}-json.log`), dockerZeile(JETZT - 20 * TAG, "app-alt"), JETZT);
    datei(join(wurzel, id, `${id}-json.log.1`), dockerZeile(JETZT - 25 * TAG, "app-alt"), JETZT);
    datei(join(wurzel, id, "config.v2.json"), appKonfiguration(), JETZT);
    const diagnose = join(wurzel, "diagnose");
    mkdirSync(diagnose);
    datei(join(diagnose, "auszug.txt"), dockerZeile(JETZT - 15 * TAG, "kopie"), JETZT);
    const stand = () =>
      readdirSync(wurzel)
        .flatMap((o) =>
          o === "diagnose" ? [] : readdirSync(join(wurzel, o)).map((n) => `${o}/${n}`),
        )
        .sort();
    const vorherDateien = stand();

    const vorher = berichteDockerProtokolle({
      ordner: wurzel,
      auswahl: KLARWERK,
      diagnoseordner: diagnose,
      jetzt: JETZT,
    });
    // Der Bericht hat nichts verändert.
    expect(stand()).toEqual(vorherDateien);
    expect(readdirSync(diagnose)).toEqual(["auszug.txt"]);
    const app = vorher.container.find((c) => c.id === id);
    expect(app).toMatchObject({
      name: "/klarwerk-app-1",
      abbild: "klarwerk-app",
      ausgewaehlt: true,
    });
    expect(app?.aeltesteZeileTage).toBeGreaterThanOrEqual(25);
    const fremde = vorher.container.filter((c) => c.id !== id);
    expect(fremde.length).toBe(2);
    expect(fremde.every((c) => !c.ausgewaehlt)).toBe(true);
    expect(vorher.diagnose.aeltesteZeileTage).toBeGreaterThanOrEqual(15);
    // Keine Protokollinhalte im Bericht — nur Kennungen, Namen und Zahlen.
    expect(JSON.stringify(vorher)).not.toContain("app-alt");
    expect(JSON.stringify(vorher)).not.toContain("fremd-alt");

    pflegeDockerProtokolle({
      ordner: wurzel,
      auswahl: KLARWERK,
      diagnoseordner: diagnose,
      jetzt: JETZT,
    });

    const nachher = berichteDockerProtokolle({
      ordner: wurzel,
      auswahl: KLARWERK,
      diagnoseordner: diagnose,
      jetzt: JETZT,
    });
    // Die aktive Datei ist gekürzt (leer): kein Protokollinhalt, also keine älteste Zeile.
    expect(nachher.container.find((c) => c.id === id)).toMatchObject({
      aeltesteZeileTage: null,
      ohneZeitangabe: 0,
    });
    expect(nachher.diagnose).toEqual({
      aeltesteZeileTage: null,
      ohneZeitangabe: 0,
      ohneZeitangabeDateidatumTage: null,
    });
    // Die fremden Container: im Bericht unverändert, auf der Platte unberührt.
    expect(nachher.container.filter((c) => c.id !== id)).toEqual(fremde);
    fremd.unberuehrt();
  });

  // Ben, Nacharbeit 14: der Bericht setzte Dateialter mit Inhaltsalter gleich. Eine alte aktive Datei,
  // längst gekürzt und mit neuen Zeilen, galt als überfällig — der Nachher-Nachweis wäre fälschlich
  // gescheitert. Das ältere Dateidatum (`min(Änderung, Anlage)`) wird hier über das Änderungsdatum
  // nachgestellt; das Anlagedatum lässt sich im Test nicht zurücksetzen und wirkt im Bericht gleich.
  it("Bericht: alte, gekürzte Datei mit neuen Zeilen ist NICHT überfällig; unbekannte Inhaltszeit steht gesondert", () => {
    const wurzel = protokollordner();
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const id = "0123456789abcdef01234567";
    mkdirSync(join(wurzel, id));
    datei(join(wurzel, id, "config.v2.json"), appKonfiguration(), JETZT);
    // Aktive Datei: 30 Tage altes Dateidatum, aber nach dem Kürzen nur eine Zeile von vor einer Stunde.
    datei(
      join(wurzel, id, `${id}-json.log`),
      dockerZeile(JETZT - 3_600_000, "neu"),
      JETZT - 30 * TAG,
    );
    // Ein altes, leeres Archiv: kein Inhalt, zählt nicht.
    datei(join(wurzel, id, `${id}-json.log.1`), "", JETZT - 40 * TAG);

    const neu = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(neu.container[0]).toMatchObject({
      aeltesteZeileTage: 0,
      ohneZeitangabe: 0,
      ohneZeitangabeDateidatumTage: null,
    });

    // Eine Datei ohne erkennbare Zeitangabe: nicht als Inhaltsalter, sondern ausdrücklich unbekannt.
    datei(join(wurzel, id, `${id}-json.log.2`), "kein json, keine zeit\n", JETZT - 20 * TAG);
    const unbekannt = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(unbekannt.container[0]).toMatchObject({
      aeltesteZeileTage: 0,
      ohneZeitangabe: 1,
      ohneZeitangabeDateidatumTage: 20,
    });

    // Gegenprobe: Liegt im Inhalt wirklich eine alte Zeile, meldet der Bericht sie.
    datei(join(wurzel, id, `${id}-json.log.3`), dockerZeile(JETZT - 16 * TAG, "alt"), JETZT);
    const alt = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(alt.container[0]?.aeltesteZeileTage).toBe(16);
  });

  it("die Auswahl ist überall dieselbe: Dockerfile-Label, Compose-Aufruf, Coolify-Aufruf im Runbook", () => {
    expect(readFileSync("Dockerfile", "utf8")).toMatch(
      /^LABEL de\.klarwerk\.protokollpflege=app$/m,
    );
    expect(readFileSync("docs/operations/monitoring-logging.md", "utf8")).toContain(
      `protokoll-frist-docker.ts /docker-container --auswahl ${KLARWERK_AUSWAHL} --diagnose /diagnose`,
    );
  });

  it("Ein-Befehl-Weg: der Dienst `protokollpflege` ruft den Hostlauf stündlich am Containerordner", () => {
    const compose = readFileSync("docker-compose.prod.yml", "utf8");
    const start = compose.indexOf("\n  protokollpflege:\n");
    expect(start, "kein Dienst protokollpflege in docker-compose.prod.yml").toBeGreaterThan(-1);
    const ende = compose.indexOf("\nvolumes:", start);
    const block = compose
      .slice(start, ende)
      .split("\n")
      .filter((z) => !z.trimStart().startsWith("#"))
      .join("\n");
    expect(block).toContain("- /var/lib/docker/containers:/docker-container");
    expect(block).toContain("- ./diagnose-protokolle:/diagnose");
    expect(block).toContain(
      `npx tsx services/app/src/protokoll-frist-docker.ts /docker-container --auswahl ${KLARWERK_AUSWAHL} --diagnose /diagnose; sleep 3600`,
    );
    expect(block).toContain("user: root");
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
