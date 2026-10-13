import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
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
import {
  FUELLKENNUNG,
  fuellblock,
  leseMaxSize,
  starteRotationsimpuls,
} from "../../services/app/src/protokoll-rotationsimpuls";
import { STARTVERTRAG } from "../../services/app/src/start-vertrag";

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

/**
 * Liest eine Docker-Protokolldatei so, wie Dockers JSON-Leser sie liest: eine Folge von JSON-Werten,
 * Leerraum (auch ganze Leerzeichenzeilen) dazwischen wird übersprungen. Eine unlesbare Zeile wirft —
 * genau das, was `docker logs` an dieser Stelle scheitern liesse.
 */
function dockerLesen(pfad: string): { log: string; stream: string; time: string }[] {
  return readFileSync(pfad, "utf8")
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z.length > 0)
    .map((z) => JSON.parse(z) as { log: string; stream: string; time: string });
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
  // Ben, Nacharbeit 15: eine echte Docker-Probe zeigte, dass `docker logs` nach dem Kürzen der aktiven
  // Datei neue Zeilen nicht mehr liest. Die aktive Datei gehört Docker und bleibt BYTEGENAU unberührt.
  it("Docker-Hostlauf: aktive Datei bytegenau unberührt; alte Rotationen, Altreste und Diagnosekopien fallen", () => {
    const wurzel = protokollordner();
    const id = "a1b2c3d4e5f60718293a4b5c";
    const ordner = join(wurzel, id);
    mkdirSync(ordner);
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const aktiv = join(ordner, `${id}-json.log`);
    // So schreibt dockerd: anhängend — auch ein 20 Tage alter Bestand bleibt, er gehört Docker.
    const fd = openSync(aktiv, "a");
    writeSync(fd, dockerZeile(JETZT - 20 * TAG, "uralt"));
    const aktivVorher = readFileSync(aktiv);
    datei(join(ordner, `${id}-json.log.1`), dockerZeile(JETZT - 3 * TAG, "rotiert-jung"), JETZT);
    datei(join(ordner, `${id}-json.log.2`), dockerZeile(JETZT - 15 * TAG, "rotiert-alt"), JETZT);
    // Reste der ersten Fassung (copytruncate): ein altes Archiv und die Beginn-Markierung.
    datei(
      join(ordner, `${id}-json.20261001T000000Z.log`),
      dockerZeile(JETZT - 16 * TAG, "x"),
      JETZT,
    );
    datei(join(ordner, `${id}-json.log.beginn`), `${JETZT}\n`, JETZT);
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
    // Die aktive Datei ist BYTEGENAU dieselbe — nicht gekürzt, nicht ersetzt.
    expect(readFileSync(aktiv).equals(aktivVorher)).toBe(true);
    writeSync(fd, dockerZeile(JETZT, "danach"));
    closeSync(fd);

    const ergebnis = lauf.container[id];
    expect(Object.keys(lauf.container)).toEqual([id]);
    fremd.unberuehrt();
    expect(ergebnis?.rotiertNach).toBeNull();
    expect(ergebnis?.geloescht.sort()).toEqual(
      [`${id}-json.20261001T000000Z.log`, `${id}-json.log.2`, `${id}-json.log.beginn`].sort(),
    );
    expect(existsSync(join(ordner, `${id}-json.log.1`))).toBe(true);
    expect(existsSync(join(ordner, "config.v2.json"))).toBe(true);
    expect(existsSync(join(wurzel, "kein-container", "kein-container-json.log"))).toBe(true);
    expect(lauf.diagnose).toEqual(["docker-logs-app.txt"]);
    // Der anhängende Schreiber steht genau dort, wo er stand: alter Bestand und neue Zeile, lückenlos.
    expect(readFileSync(aktiv, "utf8")).toBe(
      `${aktivVorher.toString("utf8")}${dockerZeile(JETZT, "danach")}`,
    );
  });

  it("Docker-Hostlauf fasst die aktive Datei auch dann nicht an, wenn sie die einzige und uralt ist", () => {
    const wurzel = protokollordner();
    const id = "a1b2c3d4e5f60718293a4b5c";
    mkdirSync(join(wurzel, id));
    datei(join(wurzel, id, "config.v2.json"), appKonfiguration(), JETZT);
    const aktiv = join(wurzel, id, `${id}-json.log`);
    datei(
      aktiv,
      `{"log":"x\\n","stream":"stdout","time":"${new Date(JETZT - 60 * TAG).toISOString()}"}\n`,
      JETZT - 60 * TAG,
    );
    const vorher = readFileSync(aktiv);
    const lauf = pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(lauf.container[id]?.geloescht).toEqual([]);
    expect(readFileSync(aktiv).equals(vorher)).toBe(true);
    // Der Bericht macht die Lücke sichtbar: Docker hat in der Frist nicht rotiert.
    const bericht = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(bericht.container[0]?.aktiveDatei.aeltesteZeileTage).toBe(60);
    expect(bericht.container[0]?.rotationen.aeltesteZeileTage).toBeNull();
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
    expect(app?.rotationen.aeltesteZeileTage).toBeGreaterThanOrEqual(25);
    expect(app?.aktiveDatei.aeltesteZeileTage).toBe(20);
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
    // Die alte Rotation ist gefallen; die aktive Datei steht unverändert — sie verwaltet Docker.
    const appNachher = nachher.container.find((c) => c.id === id);
    expect(appNachher?.rotationen).toEqual({
      aeltesteZeileTage: null,
      ohneZeitangabe: 0,
      ohneZeitangabeDateidatumTage: null,
    });
    expect(appNachher?.aktiveDatei.aeltesteZeileTage).toBe(20);
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
    expect(neu.container[0]?.aktiveDatei).toEqual({
      aeltesteZeileTage: 0,
      ohneZeitangabe: 0,
      ohneZeitangabeDateidatumTage: null,
    });
    expect(neu.container[0]?.rotationen).toEqual({
      aeltesteZeileTage: null,
      ohneZeitangabe: 0,
      ohneZeitangabeDateidatumTage: null,
    });

    // Eine Datei ohne erkennbare Zeitangabe: nicht als Inhaltsalter, sondern ausdrücklich unbekannt.
    datei(join(wurzel, id, `${id}-json.log.2`), "kein json, keine zeit\n", JETZT - 20 * TAG);
    const unbekannt = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(unbekannt.container[0]?.rotationen).toEqual({
      aeltesteZeileTage: null,
      ohneZeitangabe: 1,
      ohneZeitangabeDateidatumTage: 20,
    });

    // Gegenprobe: Liegt im Inhalt wirklich eine alte Zeile, meldet der Bericht sie.
    datei(join(wurzel, id, `${id}-json.log.3`), dockerZeile(JETZT - 16 * TAG, "alt"), JETZT);
    const alt = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(alt.container[0]?.rotationen.aeltesteZeileTage).toBe(16);
  });

  // Ben, Nacharbeit 16: die aktive Datei muss auch bei wenig oder ausbleibender Ausgabe nach 14 Tagen
  // fallen — ohne dass sie von aussen angefasst wird. Docker rotiert selbst, sobald `max-size`
  // überschritten würde; der tägliche Füllblock der App sorgt dafür, dass das täglich geschieht.
  it("Rotationsimpuls: Füllblock überschreitet max-size, ist inhaltsfrei und zeilenweise unter 16 KiB", () => {
    expect(leseMaxSize("1m")).toBe(1024 * 1024);
    expect(leseMaxSize("100k")).toBe(100 * 1024);
    expect(leseMaxSize("2048")).toBe(2048);
    expect(leseMaxSize("1g")).toBe(1024 ** 3);
    expect(leseMaxSize("")).toBeNull();
    expect(leseMaxSize(undefined)).toBeNull();
    expect(leseMaxSize("viel")).toBeNull();
    expect(leseMaxSize("0")).toBeNull();
    const zeilen = fuellblock(1024 * 1024);
    const bytes = zeilen.reduce((s, z) => s + Buffer.byteLength(z), 0);
    expect(bytes).toBeGreaterThan(1024 * 1024);
    for (const zeile of zeilen) {
      expect(Buffer.byteLength(zeile)).toBeLessThan(16 * 1024);
      const objekt = JSON.parse(zeile) as Record<string, unknown>;
      expect(Object.keys(objekt).sort()).toEqual(["fueller", FUELLKENNUNG].sort());
      expect(String(objekt.fueller)).toMatch(/^-+$/);
    }
  });

  /** Ein Prozessstart wie in server.ts — mit eingespritzter Uhr, Markierung und Takt. */
  async function prozessstart(opts: {
    markierung: string;
    uhr: () => number;
    geschrieben: string[];
  }): Promise<{ takt: () => Promise<void> }> {
    let rueckruf: (() => void) | null = null;
    starteRotationsimpuls({
      maxSize: 64 * 1024,
      schreibe: (z) => opts.geschrieben.push(z),
      markierung: opts.markierung,
      jetzt: opts.uhr,
      setIntervalFn: (callback) => {
        rueckruf = callback;
        return 0 as unknown as ReturnType<typeof setInterval>;
      },
      clearIntervalFn: () => {},
    });
    await new Promise((fertig) => setTimeout(fertig, 0));
    return {
      takt: async () => {
        (rueckruf as unknown as () => void)();
        await new Promise((fertig) => setTimeout(fertig, 0));
      },
    };
  }

  it("Rotationsimpuls: ohne max-size nichts; beim ersten Start sofort, dann erst nach einem Tag", async () => {
    expect(starteRotationsimpuls({ maxSize: null })).toBeNull();
    const markierung = join(protokollordner(), "impuls.zeit");
    const geschrieben: string[] = [];
    let uhr = JETZT;
    const lauf = await prozessstart({ markierung, uhr: () => uhr, geschrieben });
    // Keine Markierung: der Start impulsiert sofort und hält die Zeit fest.
    expect(geschrieben).toEqual(fuellblock(64 * 1024));
    expect(readFileSync(markierung, "utf8").trim()).toBe(String(JETZT));
    // Stündliche Prüfung vor Ablauf eines Tages: nichts.
    uhr = JETZT + 23 * 3_600_000;
    await lauf.takt();
    expect(geschrieben.length).toBe(fuellblock(64 * 1024).length);
    // Nach einem Tag: der nächste Takt impulsiert.
    uhr = JETZT + 24 * 3_600_000;
    await lauf.takt();
    expect(geschrieben.length).toBe(2 * fuellblock(64 * 1024).length);
  });

  // Ben, Nacharbeit 18: bei Neustarts vor Ablauf von 24 Stunden blieb der Impuls dauerhaft aus.
  it("Rotationsimpuls über NEUSTARTS: die Frist zählt weiter, Kurzläufe verschieben den Impuls nicht", async () => {
    const markierung = join(protokollordner(), "impuls.zeit");
    const geschrieben: string[] = [];
    const block = fuellblock(64 * 1024).length;
    // Start 0: impulsiert (keine Markierung).
    await prozessstart({ markierung, uhr: () => JETZT, geschrieben });
    expect(geschrieben.length).toBe(block);
    // Kurzläufe alle 6 Stunden — kein Lauf erlebt je einen 24-Stunden-Takt.
    for (const stunde of [6, 12, 18]) {
      await prozessstart({ markierung, uhr: () => JETZT + stunde * 3_600_000, geschrieben });
    }
    expect(geschrieben.length).toBe(block);
    // Der Start nach 24 Stunden impulsiert sofort — über die Markierung, nicht über die Laufzeit.
    await prozessstart({ markierung, uhr: () => JETZT + 24 * 3_600_000, geschrieben });
    expect(geschrieben.length).toBe(2 * block);
    // Lässt sich die Markierung nicht schreiben, impulsiert jeder Start (früher, nie später).
    const nichtSchreibbar = join(protokollordner(), "fehlt", "impuls.zeit");
    const zweite: string[] = [];
    await prozessstart({ markierung: nichtSchreibbar, uhr: () => JETZT, geschrieben: zweite });
    await prozessstart({
      markierung: nichtSchreibbar,
      uhr: () => JETZT + 60_000,
      geschrieben: zweite,
    });
    expect(zweite.length).toBe(2 * block);
  });

  /**
   * Ein Modell von Dockers `json-file`-Schreiber, nach dessen dokumentiertem Verhalten: jede Zeile
   * wird als `{"log","stream","time"}` angehängt; WÜRDE die aktive Datei dabei `max-size` übersteigen,
   * rotiert der Dienst vorher (`.log` → `.log.1` → `.log.2` …, höchstens `max-file`). Gelesen wird
   * wie `docker logs`: Rotationen von alt nach neu, dann die aktive Datei, jede Zeile als JSON.
   */
  function dockerModell(ordner: string, id: string, maxSize: number, maxFile: number) {
    const aktiv = join(ordner, `${id}-json.log`);
    writeFileSync(aktiv, "");
    let groesse = 0;
    const rotieren = () => {
      for (let n = maxFile - 1; n >= 1; n--) {
        const von = n === 1 ? aktiv : join(ordner, `${id}-json.log.${n - 1}`);
        const nach = join(ordner, `${id}-json.log.${n}`);
        if (existsSync(von)) {
          renameSync(von, nach);
        }
      }
      writeFileSync(aktiv, "");
      groesse = 0;
    };
    return {
      schreibe(text: string, zeit: number) {
        const zeile = `${JSON.stringify({ log: text, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
        const laenge = Buffer.byteLength(zeile);
        if (groesse + laenge > maxSize) {
          rotieren();
        }
        appendFileSync(aktiv, zeile);
        groesse += laenge;
      },
      lies(): { log: string; time: string }[] {
        const dateien = readdirSync(ordner)
          .filter((n) => /-json\.log\.\d+$/.test(n))
          .sort((a, b) => Number(b.split(".").pop()) - Number(a.split(".").pop()))
          .concat(`${id}-json.log`);
        return dateien.flatMap((n) =>
          readFileSync(join(ordner, n), "utf8")
            .split("\n")
            .filter((z) => z.length > 0)
            .map((z) => JSON.parse(z) as { log: string; time: string }),
        );
      },
    };
  }

  it("VOLLSTÄNDIGER WEG über 20 Tage, ohne Nutzerausgabe: keine Zeile älter als 14 Tage, docker logs lesbar", () => {
    const MAX = 64 * 1024;
    // In der Vergangenheit, damit das echte Anlagedatum der Testdateien (jetzt) nach jeder simulierten
    // Zeit liegt und das Inhaltsalter nicht überdeckt.
    const start = Date.now() - 21 * TAG;
    const lauf = (impuls: boolean) => {
      const wurzel = protokollordner();
      const id = "a1b2c3d4e5f60718293a4b5c";
      mkdirSync(join(wurzel, id));
      datei(join(wurzel, id, "config.v2.json"), appKonfiguration(), start);
      const docker = dockerModell(join(wurzel, id), id, MAX, 50);
      // Tag 0: eine einzige echte Zeile — danach schweigt die App.
      docker.schreibe("Bestand vom ersten Tag\n", start);
      const hoechstalter: number[] = [];
      for (let tag = 1; tag <= 20; tag++) {
        const jetzt = start + tag * TAG;
        if (impuls) {
          for (const zeile of fuellblock(MAX)) {
            docker.schreibe(zeile, jetzt);
          }
        }
        pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt });
        const zeilen = docker.lies();
        hoechstalter.push(Math.max(...zeilen.map((z) => (jetzt - Date.parse(z.time)) / TAG)));
      }
      return { hoechstalter, zeilen: docker.lies() };
    };

    const mit = lauf(true);
    // Zu keinem Zeitpunkt eine Zeile, die 14 Tage oder älter ist — auch ohne jede Nutzerausgabe.
    expect(Math.max(...mit.hoechstalter)).toBeLessThan(14);
    expect(mit.zeilen.some((z) => z.log.includes("Bestand vom ersten Tag"))).toBe(false);
    // Lesbar wie mit `docker logs`: jede Zeile ist gültiges JSON, die neueste Füllung ist da.
    expect(mit.zeilen.length).toBeGreaterThan(0);
    expect(mit.zeilen.at(-1)?.log).toContain(FUELLKENNUNG);

    // Gegenprobe: ohne Impuls bleibt der Bestand in der aktiven Datei stehen — genau Bens Befund.
    const ohne = lauf(false);
    expect(Math.max(...ohne.hoechstalter)).toBeGreaterThanOrEqual(14);
    expect(ohne.zeilen.some((z) => z.log.includes("Bestand vom ersten Tag"))).toBe(true);
  });

  // Nacharbeit 17: env-beispiel.test.ts C5 fand für KLARWERK_LOG_DATEI „—Die" statt „— Die". Die
  // globalen Wächter C1/C5/D1 sind zusätzlich durch fremde Einträge aus main rot (VAPID_*, zehn nicht
  // angemeldete Umgebungswerte); diese Probe hält DIESELBEN Regeln für die Namen dieses Auftrags.
  it("Startvertrag und Beispieldatei: die Namen dieses Auftrags nach den Regeln von C1/C5/D1", () => {
    const beispiel = readFileSync("env.demo.beispiel", "utf8");
    for (const name of ["KLARWERK_LOG_DATEI", "KLARWERK_DOCKER_LOG_MAX_SIZE"]) {
      const wert = STARTVERTRAG.find((w) => w.name === name);
      expect(wert, `${name} fehlt im Startvertrag`).toBeDefined();
      expect(beispiel, `${name} ohne Zuweisungszeile`).toMatch(new RegExp(`^# ${name}=$`, "m"));
      expect(beispiel, `${name} ohne Erklärung`).toContain(`# ${name} — ${wert?.wofuer}`);
      expect(beispiel, `${name} ohne Folgesatz`).toContain(`#   Ohne ihn: ${wert?.ohneIhn}`);
    }
    // D1 erhebt Namen u. a. über `const X_ENV = "NAME"` — so lesen beide Module ihre Variable.
    expect(readFileSync("services/app/src/protokoll-frist.ts", "utf8")).toContain(
      'LOG_DATEI_ENV = "KLARWERK_LOG_DATEI"',
    );
    expect(readFileSync("services/app/src/protokoll-rotationsimpuls.ts", "utf8")).toContain(
      'DOCKER_LOG_MAX_SIZE_ENV = "KLARWERK_DOCKER_LOG_MAX_SIZE"',
    );
  });

  it("VOLLSTÄNDIGER WEG mit NEUSTARTS alle 6 Stunden über 20 Tage: keine Zeile 14 Tage oder älter", async () => {
    const MAX = 64 * 1024;
    const start = Date.now() - 21 * TAG;
    const wurzel = protokollordner();
    const id = "a1b2c3d4e5f60718293a4b5c";
    mkdirSync(join(wurzel, id));
    datei(join(wurzel, id, "config.v2.json"), appKonfiguration(), start);
    const docker = dockerModell(join(wurzel, id), id, MAX, 50);
    docker.schreibe("Bestand vom ersten Tag\n", start);
    // Die Markierung liegt im Container — sie übersteht die Neustarts desselben Containers.
    const markierung = join(protokollordner(), "impuls.zeit");
    let hoechstalter = 0;
    for (let stunde = 6; stunde <= 20 * 24; stunde += 6) {
      const jetzt = start + stunde * 3_600_000;
      // Ein Prozessstart wie in server.ts; der Lauf endet vor dem ersten Stundentakt.
      starteRotationsimpuls({
        maxSize: MAX,
        schreibe: (z) => docker.schreibe(z, jetzt),
        markierung,
        jetzt: () => jetzt,
        setIntervalFn: () => 0 as unknown as ReturnType<typeof setInterval>,
        clearIntervalFn: () => {},
      });
      await new Promise((fertig) => setTimeout(fertig, 0));
      pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt });
      const zeilen = docker.lies();
      hoechstalter = Math.max(
        hoechstalter,
        ...zeilen.map((z) => (jetzt - Date.parse(z.time)) / TAG),
      );
    }
    expect(hoechstalter).toBeLessThan(14);
    expect(docker.lies().some((z) => z.log.includes("Bestand vom ersten Tag"))).toBe(false);
  });

  // Ben, Nacharbeit 18: ein gestoppter App-Container schreibt keinen Impuls; seine aktive Datei blieb
  // ohne Grenze stehen. Jetzt fallen dort die Zeilen ab 14 Tagen — nur, wenn Docker ihn als gestoppt führt.
  it("gestoppter App-Container: überfällige Zeilen der aktiven Datei fallen, jüngere bleiben lesbar", () => {
    const wurzel = protokollordner();
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const zustand = (State: Record<string, unknown>) =>
      JSON.stringify({ ...JSON.parse(appKonfiguration()), State });
    const inhalt =
      dockerZeile(JETZT - 20 * TAG, "alt-20") +
      dockerZeile(JETZT - 15 * TAG, "alt-15") +
      dockerZeile(JETZT - 3 * TAG, "jung-3") +
      dockerZeile(JETZT - 3_600_000, "jung-1h");
    const anlegen = (id: string, konfiguration: string) => {
      mkdirSync(join(wurzel, id));
      datei(join(wurzel, id, "config.v2.json"), konfiguration, JETZT);
      datei(join(wurzel, id, `${id}-json.log`), inhalt, JETZT);
      return join(wurzel, id, `${id}-json.log`);
    };
    const gestoppt = anlegen("aaaaaaaaaaaaaaaaaaaaaaaa", zustand({ Running: false }));
    const laufend = anlegen("bbbbbbbbbbbbbbbbbbbbbbbb", zustand({ Running: true }));
    const pausiert = anlegen("cccccccccccccccccccccccc", zustand({ Running: false, Paused: true }));
    // Ein FREMDER gestoppter Container (Audit-Label) — nicht ausgewählt.
    const fremd = anlegen(
      "dddddddddddddddddddddddd",
      JSON.stringify({
        Config: { Labels: { "com.example.audit": "sicherheit" } },
        State: { Running: false },
      }),
    );

    const vorher = (pfad: string) => ({ ino: statSync(pfad).ino, size: statSync(pfad).size });
    const gestopptVorher = vorher(gestoppt);
    const pausiertVorher = vorher(pausiert);

    const lauf = pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });

    // Nacharbeit 20: gestoppt UND pausiert — überfällige Zeilen an Ort und Stelle geschwärzt.
    expect(lauf.container.aaaaaaaaaaaaaaaaaaaaaaaa?.aktiveZeilenGeschwaerzt).toBe(2);
    expect(lauf.container.cccccccccccccccccccccccc?.aktiveZeilenGeschwaerzt).toBe(2);
    for (const [pfad, stand] of [
      [gestoppt, gestopptVorher],
      [pausiert, pausiertVorher],
    ] as const) {
      // Dieselbe Datei, dieselbe Grösse — Dockers Positionen und Grössenzählung bleiben gültig.
      expect(vorher(pfad)).toEqual(stand);
      // Lesbar wie mit `docker logs`: jede Zeile gültiges JSON; Inhalt nur noch in den jüngeren.
      const eintraege = dockerLesen(pfad);
      expect(eintraege.map((e) => e.log.trim()).filter((t) => t.length > 0)).toEqual([
        "jung-3",
        "jung-1h",
      ]);
      expect(readFileSync(pfad, "utf8")).not.toContain("alt-20");
      expect(readFileSync(pfad, "utf8")).not.toContain("alt-15");
    }
    // Laufend: unberührt — dort wirken Impuls und Docker-Rotation.
    expect(lauf.container.bbbbbbbbbbbbbbbbbbbbbbbb?.aktiveZeilenGeschwaerzt).toBe(0);
    expect(readFileSync(laufend, "utf8")).toBe(inhalt);
    // Fremd: weder ausgewählt noch angefasst.
    expect(Object.keys(lauf.container)).not.toContain("dddddddddddddddddddddddd");
    expect(readFileSync(fremd, "utf8")).toBe(inhalt);
    // Der Bericht: geschwärzte Zeilen zählen nicht als Inhalt — die älteste Zeile MIT Inhalt ist 3 Tage alt.
    const bericht = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(bericht.container.find((c) => c.id === "aaaaaaaaaaaaaaaaaaaaaaaa")).toMatchObject({
      gestoppt: true,
      aktiveDatei: { aeltesteZeileTage: 3 },
    });
    expect(bericht.container.find((c) => c.id === "cccccccccccccccccccccccc")).toMatchObject({
      pausiert: true,
      aktiveDatei: { aeltesteZeileTage: 3 },
    });
    // Ein zweiter Lauf ändert nichts mehr.
    const zweiter = pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(zweiter.container.aaaaaaaaaaaaaaaaaaaaaaaa?.aktiveZeilenGeschwaerzt).toBe(0);
  });

  // Ben, Nacharbeiten 19/20: Docker kann die Datei JEDERZEIT offen haben und schreiben — vor dem
  // Lesen der Pflege, zwischen Lesen und Schwärzen, danach. Gemessen an allen drei Zeitpunkten: Docker
  // hält einen eigenen, anhängenden Deskriptor (wie dockerd) und führt seine eigene Grössenzählung.
  it("Schwärzen ohne Austausch: Docker schreibt vor, während und nach der Pflege — kein Verlust, Zählung stimmt", () => {
    const wurzel = protokollordner();
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const ordner = join(wurzel, id);
    mkdirSync(ordner);
    writeFileSync(
      join(ordner, "config.v2.json"),
      JSON.stringify({ ...JSON.parse(appKonfiguration()), State: { Running: false } }),
    );
    const aktiv = join(ordner, `${id}-json.log`);
    writeFileSync(aktiv, dockerZeile(JETZT - 20 * TAG, "alt") + dockerZeile(JETZT - TAG, "jung"));
    const ino = statSync(aktiv).ino;
    // Docker startet den Container genau jetzt: er öffnet die Datei und misst ihre Grösse.
    const docker = openSync(aktiv, "a");
    let dockerZaehlung = statSync(aktiv).size;
    const dockerSchreibt = (text: string) => {
      const zeile = dockerZeile(JETZT, text);
      writeSync(docker, zeile);
      dockerZaehlung += Buffer.byteLength(zeile);
    };
    // (1) VOR dem Lesen der Pflege — der Schreibfall, den der Hardlink-Weg nicht abdeckte.
    dockerSchreibt("startbericht");
    pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    // (3) NACH der Pflege.
    dockerSchreibt("danach");
    closeSync(docker);

    // Dieselbe Datei; Dockers eigene Grössenzählung stimmt genau mit der Datei überein.
    expect(statSync(aktiv).ino).toBe(ino);
    expect(statSync(aktiv).size).toBe(dockerZaehlung);
    // Lesbar wie mit `docker logs`, in Dockers Reihenfolge, nichts Neues verloren, Altes geschwärzt.
    expect(dockerLesen(aktiv).map((e) => e.log.trim())).toEqual([
      "",
      "jung",
      "startbericht",
      "danach",
    ]);
    expect(readFileSync(aktiv, "utf8")).not.toContain('"alt');
  });

  it("Schwärzen WÄHREND Docker schreibt: eine unvollständige letzte Zeile bleibt unberührt", () => {
    const wurzel = protokollordner();
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const ordner = join(wurzel, id);
    mkdirSync(ordner);
    writeFileSync(
      join(ordner, "config.v2.json"),
      JSON.stringify({ ...JSON.parse(appKonfiguration()), State: { Running: true, Paused: true } }),
    );
    const aktiv = join(ordner, `${id}-json.log`);
    const halb = dockerZeile(JETZT - 20 * TAG, "halb");
    // Docker hat eine Zeile nur zur Hälfte geschrieben (pausiert mitten im Schreiben).
    writeFileSync(aktiv, dockerZeile(JETZT - 20 * TAG, "alt") + halb.slice(0, 30));
    const docker = openSync(aktiv, "a");
    pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    // Docker schreibt den Rest der Zeile weiter — sie ist danach vollständig und unverändert.
    writeSync(docker, halb.slice(30));
    closeSync(docker);
    expect(readFileSync(aktiv, "utf8").endsWith(halb)).toBe(true);
    expect(dockerLesen(aktiv).map((e) => e.log.trim())).toEqual(["", "halb"]);
  });

  it("Schwärzen: kurze Zeilen und unlesbare Zeilen bleiben gleich lang und für Docker lesbar", () => {
    const wurzel = protokollordner();
    const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const ordner = join(wurzel, id);
    mkdirSync(ordner);
    writeFileSync(
      join(ordner, "config.v2.json"),
      JSON.stringify({ ...JSON.parse(appKonfiguration()), State: { Running: false } }),
    );
    const aktiv = join(ordner, `${id}-json.log`);
    const alt = new Date(JETZT - 20 * TAG).toISOString();
    // Eine Zeile mit Zusatzfeldern (attrs), eine kaputte, eine junge.
    const inhalt = [
      JSON.stringify({ log: "Anna Meier\n", stream: "stderr", attrs: { tag: "x" }, time: alt }),
      `{"log":"kaputt ${"Anna Meier"}`,
      JSON.stringify({ log: "jung\n", stream: "stdout", time: new Date(JETZT).toISOString() }),
      "",
    ].join("\n");
    writeFileSync(aktiv, inhalt);
    const lauf = pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt: JETZT });
    expect(lauf.container[id]?.aktiveZeilenGeschwaerzt).toBe(2);
    const neu = readFileSync(aktiv, "utf8");
    expect(Buffer.byteLength(neu)).toBe(Buffer.byteLength(inhalt));
    expect(neu.split("\n").map((z) => z.length)).toEqual(inhalt.split("\n").map((z) => z.length));
    expect(neu).not.toContain("Anna Meier");
    expect(neu).not.toContain("attrs");
    expect(dockerLesen(aktiv)).toEqual([
      { log: "\n", stream: "stderr", time: alt },
      { log: "jung\n", stream: "stdout", time: new Date(JETZT).toISOString() },
    ]);
  });

  // Ben, Nacharbeit 20: auch während einer LANGEN Pause muss die Frist wirken — ohne Fortsetzen.
  it("lange Pause: über 30 Tage täglich gepflegt, nie eine Inhaltszeile 14 Tage oder älter, Schreiber gültig", () => {
    const wurzel = protokollordner();
    const start = JETZT - 31 * TAG;
    const dockerZeile = (zeit: number, text: string) =>
      `${JSON.stringify({ log: `${text}\n`, stream: "stdout", time: new Date(zeit).toISOString() })}\n`;
    const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const ordner = join(wurzel, id);
    mkdirSync(ordner);
    writeFileSync(
      join(ordner, "config.v2.json"),
      JSON.stringify({ ...JSON.parse(appKonfiguration()), State: { Running: true, Paused: true } }),
    );
    const aktiv = join(ordner, `${id}-json.log`);
    // Bis zur Pause schrieb die App jeden Tag eine Zeile; dann friert sie ein, Docker hält die Datei offen.
    writeFileSync(aktiv, "");
    const docker = openSync(aktiv, "a");
    for (let tag = 0; tag <= 5; tag++) {
      writeSync(docker, dockerZeile(start + tag * TAG, `vor-der-pause-${tag}`));
    }
    const groesse = statSync(aktiv).size;
    let hoechstalter = 0;
    for (let tag = 6; tag <= 31; tag++) {
      const jetzt = start + tag * TAG;
      pflegeDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt });
      const bericht = berichteDockerProtokolle({ ordner: wurzel, auswahl: KLARWERK, jetzt });
      hoechstalter = Math.max(
        hoechstalter,
        bericht.container[0]?.aktiveDatei.aeltesteZeileTage ?? 0,
      );
    }
    // Nach der Pause schreibt Docker weiter — am richtigen Ende, Grösse unverändert bis dahin.
    expect(statSync(aktiv).size).toBe(groesse);
    writeSync(docker, dockerZeile(JETZT, "nach-der-pause"));
    closeSync(docker);
    expect(hoechstalter).toBeLessThan(14);
    expect(readFileSync(aktiv, "utf8")).not.toContain("vor-der-pause");
    expect(dockerLesen(aktiv).at(-1)?.log).toBe("nach-der-pause\n");
  });

  it("Dockerfile und Compose nennen dieselbe max-size wie der Rotationsimpuls", () => {
    expect(readFileSync("Dockerfile", "utf8")).toMatch(/^ENV KLARWERK_DOCKER_LOG_MAX_SIZE=1m$/m);
    const compose = readFileSync("docker-compose.prod.yml", "utf8");
    const app = compose.slice(
      compose.indexOf("\n  app:\n"),
      compose.indexOf("\n  protokollpflege:\n"),
    );
    expect(app).toContain('max-size: "1m"');
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
