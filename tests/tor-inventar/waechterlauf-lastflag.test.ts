// ================================================================================================
// JOB 3131 · T2 — EINE OBERGRENZE ALLEIN DARF DEN AUFRUF NICHT ABBRECHEN.
// ================================================================================================
//
// DER FALL, DER DIESE DATEI ERZWUNGEN HAT (06.09.2026, Runde 2 dieses Auftrags). Der Taktgeber fährt
// vor jedem Tor einen Wächterlauf (`takt/schritte.py`):
//
//     npx vitest run --pool=forks --poolOptions.forks.maxForks=4 <sechs Wächterdateien>
//
// Eine Obergrenze, keine Untergrenze. Vitest 2.1.9 setzt die fehlende Untergrenze dann auf die
// Kernzahl minus eins (hier 11), Tinypool prüft 11 ≤ 4 und wirft
// `RangeError: options.minThreads and options.maxThreads must not conflict` — VOR jeder Sammlung.
// Die Ausgabe lautet „Test Files no tests · Errors 1 error" nach 27 ms, die Runde wurde ROT, und die
// Liste der roten Fälle war leer, weil nie ein Fall lief. Der Auftrag verlangt in 5.2 ausdrücklich:
// „ein unpassendes Flag darf keinen Aufruf brechen".
//
// DIE ABHILFE steht in `vitest.config.ts` (`GEMEINSAM.minWorkers: 1`) und gilt damit für BEIDE
// Aufrufe von `tools/test`. Sie ist eine Zeile, sie ist unscheinbar, und ohne diesen Test fiele
// niemandem auf, wenn sie beim nächsten Aufräumen verschwindet — die Folge sähe nicht wie ein
// Konfigurationsfehler aus, sondern wie ein kaputtes Tor.
//
// WAS HIER GEMESSEN WIRD, ist deshalb kein Konfigurationswert, sondern das Verhalten: jeder Fall
// startet einen echten Vitest-Unterprozess mit genau der Schreibweise, die im Betrieb vorkommt, und
// sieht nach, ob er anläuft. Damit das Bruchteile einer Sekunde kostet, laufen die Proben mit einem
// `-t`-Filter, der auf keinen Fall passt: Vitest baut seinen Pool trotzdem auf (dort sitzt der
// Fehler), führt aber nichts aus. Gemessen 06.09.: 0,35 s je Probe.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WURZEL, alsPosix, browserMuster } from "./browser-gruppe";

/** Ein Fallname, den es im Bestand nicht gibt — die Proben sollen sammeln, nicht ausführen. */
const KEIN_FALL = "KEIN-FALL-MIT-DIESEM-NAMEN-JOB3131";

/** Diese Datei selbst ist das Ziel der Proben gegen die Basiskonfiguration: garantiert vorhanden. */
const SELBST = alsPosix(fileURLToPath(import.meta.url));

interface Probe {
  readonly code: number | null;
  readonly ausgabe: string;
}

/**
 * Ein Vitest-Unterprozess mit den übergebenen Lastflags.
 *
 * `KLARWERK_TESTGRUPPE` wird AUSDRÜCKLICH entfernt — dieselbe Falle wie im Nachbartest: im Tor
 * läuft diese Datei als Kind des Aufrufs `rest` und trüge die Variable sonst geerbt weiter, womit
 * die Probe eine andere Konfiguration prüfte als die, die sie zu prüfen vorgibt.
 */
function probe(lastflags: readonly string[], ziel: string, konfiguration?: string): Probe {
  const umgebung: NodeJS.ProcessEnv = { ...process.env, KLARWERK_SKIP_KEYCHAIN: "1" };
  delete umgebung.KLARWERK_TESTGRUPPE;
  const ergebnis = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      ...(konfiguration === undefined ? [] : ["--config", konfiguration]),
      ...lastflags,
      "-t",
      KEIN_FALL,
      "--passWithNoTests",
      ziel,
    ],
    { cwd: WURZEL, env: umgebung, encoding: "utf8" },
  );
  return { code: ergebnis.status, ausgabe: `${ergebnis.stdout ?? ""}\n${ergebnis.stderr ?? ""}` };
}

/** Die eine Zeile, an der der Abbruch von Runde 2 zu erkennen ist. */
const TINYPOOL_ABBRUCH = "minThreads and options.maxThreads must not conflict";

function belege(p: Probe): string {
  return `Exit ${p.code}\n${p.ausgabe.slice(-1200)}`;
}

describe("JOB 3131 T2 · eine Obergrenze ohne Untergrenze bricht keinen Aufruf ab", () => {
  it("W1 · der Wächterlauf des Taktgebers läuft an (forks, nur maxForks)", () => {
    // Wörtlich die Schreibweise aus `takt/schritte.py`, nur mit einer Datei statt sechs.
    const p = probe(["--pool=forks", "--poolOptions.forks.maxForks=4"], SELBST);
    expect(p.ausgabe, belege(p)).not.toContain(TINYPOOL_ABBRUCH);
    expect(p.code, belege(p)).toBe(0);
  });

  it("W2 · derselbe Aufruf gegen die Browser-Konfiguration läuft an", () => {
    // Der Aufruf `browser` erbt seine gemeinsamen Einstellungen aus `vitest.config.ts`. Fiele die
    // Untergrenze dort weg oder würde sie beim Übernehmen verloren, stürbe der erste der beiden
    // Tor-Aufrufe an derselben Stelle — und die Chromium-Tests liefen gar nicht mehr.
    const gruppe = browserMuster();
    expect(gruppe.length, "die Browser-Gruppe ist leer, die Probe prüfte nichts").toBeGreaterThan(
      0,
    );
    const p = probe(
      ["--pool=forks", "--poolOptions.forks.maxForks=4"],
      gruppe[0] as string,
      "vitest.browser.config.ts",
    );
    expect(p.ausgabe, belege(p)).not.toContain(TINYPOOL_ABBRUCH);
    expect(p.code, belege(p)).toBe(0);
  });

  it("W3 · auch die Thread-Schreibweise der Bahnen läuft an (threads, nur maxThreads)", () => {
    // `takt/tor.sh:36` und die Bahn-Regeln schicken bis heute `--poolOptions.threads.maxThreads=…`.
    // Unter dem Standardpool `forks` begrenzt das nichts (das ist der Befund, aus dem T2 entstand) —
    // aber wer den Thread-Pool ausdrücklich wählt, liefe ohne Untergrenze in denselben Abbruch.
    const p = probe(["--pool=threads", "--poolOptions.threads.maxThreads=4"], SELBST);
    expect(p.ausgabe, belege(p)).not.toContain(TINYPOOL_ABBRUCH);
    expect(p.code, belege(p)).toBe(0);
  });

  it("W4 · Anti-Vakuum: mit widersprüchlichen Grenzen bricht Vitest weiterhin ab", () => {
    // Ohne diesen Fall wären W1–W3 auch dann grün, wenn Vitest den Konflikt gar nicht mehr prüft
    // oder die Probe am Ziel vorbeiläuft. Hier wird die Untergrenze des Aufrufers ausdrücklich über
    // die Obergrenze gesetzt — das MUSS abbrechen, und zwar mit genau dieser Meldung.
    const p = probe(
      ["--pool=forks", "--poolOptions.forks.minForks=8", "--poolOptions.forks.maxForks=2"],
      SELBST,
    );
    expect(p.ausgabe, belege(p)).toContain(TINYPOOL_ABBRUCH);
    expect(p.code, belege(p)).not.toBe(0);
  });
});
