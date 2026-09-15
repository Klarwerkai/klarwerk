// ================================================================================================
// JOB 4012 · RUNDE 3 — DIE ZWEI LÖCHER IM NETZ, DIE BEN IN RUNDE 2 GEFUNDEN HAT.
// ================================================================================================
//
// Beide sind derselbe Fehler in zwei Gestalten: Der Rückweg war da, aber er hing an etwas, das im
// entscheidenden Augenblick nicht mehr existierte.
//
//   BEN-R2-1  WIEDERHOLUNG. Nach `1.0.0 → 1.1.0` spielte Ben das bereits installierte Release noch
//             einmal ein. Der Weg lief mit Exit 0 durch — und vermerkte dabei `VORVERSION=1.1.0`,
//             also die Fassung, die ohnehin lief. `rueckfall.sh` ohne Argument meldete danach
//             „Vorversion 1.1.0 aktiv" und blieb auf 1.1.0. Der Rückfallpunkt 1.0.0 war unerreichbar,
//             und die Ergebniszeile behauptete trotzdem einen Rückfall. Ein Update auf sich selbst
//             ist kein Update; es kostet nur den einzigen Punkt, auf den man zurückkann.
//   BEN-R2-2  STARTFEHLER. Ben liess ausschliesslich das FREMDBINARY `launchctl` scheitern. Der
//             Update-Weg endete mit Exit 42 mitten im Startaufruf: `current` zeigte bereits auf das
//             neue Release, es lief kein Server, es gab keinen Rückfall und keine einzige
//             Ergebniszeile. Genau der Zustand, gegen den dieser Job gebaut ist.
//
// WAS HIER ATTRAPPE IST: `launchctl`, und sonst nichts. Es ist ein Fremdbinary, das auf dem
// Prüfstand nicht existiert (Linux) beziehungsweise dessen echte Dienste ein Testlauf NIE anfassen
// darf. Der Update-Weg selbst — Sicherung, Vertrag, Symlink, Rückfall, Health über echtes HTTP —
// läuft unverändert und ungestubbt. Damit ist der launchd-Zweig, der in Runde 2 nur als
// „Erkennungsgrenze" geprüft war, zum ersten Mal in seinem Fehlerfall gefahren.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  UPDATE_SH,
  WURZEL,
  aktivesRelease,
  fahreRueckfall,
  fahreSkript,
  fahreUpdate,
  festerZeitstempel,
  fremdbinaerAttrappe,
  gesundheit,
  legeInselAn,
  legeJournalAn,
  legePaketAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";
const NEUER = "klarwerk-insel-noch-neuer";
/** Die Sekunde, die W3 beiden Läufen aufzwingt — der Kollisionsfall, nicht dem Zufall überlassen. */
const SEKUNDE = "20260915T010203Z";

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    // Was die launchctl-Attrappe gestartet hat, steht nicht in der PID-Datei des Betriebsweges
    // (der launchd-Zweig löscht sie bewusst) — hier wird es trotzdem eingesammelt.
    beendeAttrappenserver(insel);
    raeumeAb(insel);
    insel = undefined;
  }
});

function attrappenPid(insel: Insel): string {
  return join(insel.logs, "launchd-server.pid");
}

function beendeAttrappenserver(insel: Insel): void {
  const datei = attrappenPid(insel);
  if (!existsSync(datei)) {
    return;
  }
  const pid = Number(readFileSync(datei, "utf8").trim());
  if (Number.isFinite(pid) && pid > 0) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* schon beendet */
    }
  }
}

/** Der Ausgangszustand: eine laufende Vorversion 1.0.0 und ein Journal mit Daten. */
async function inselMitVorversion(): Promise<Insel> {
  const neue = await legeInselAn();
  schreibeRelease(neue.releases, { name: ALT, appVersion: "1.0.0" });
  setzeCurrent(neue, ALT);
  legeJournalAn(neue);
  return neue;
}

function vorversionsvermerk(insel: Insel): string {
  const datei = join(insel.wurzel, "VORVERSION");
  return existsSync(datei) ? readFileSync(datei, "utf8").trim() : "";
}

/**
 * Eine Attrappe für das Fremdbinary `launchctl`, und zwar eine, die sich wie eines verhält:
 *
 *   `print <dienst>`        → 0, der Agent gilt als geladen. Damit nimmt der Betriebsweg den
 *                             launchd-Zweig, den es auf dem Prüfstand sonst gar nicht gibt.
 *   `kickstart -k <dienst>` → die ersten `fehlschlaege` Versuche enden mit 42 (so wie bei Ben),
 *                             jeder weitere startet wirklich, was `current` gerade ist. Genau so
 *                             verhält sich launchd: es startet den Zeiger, der JETZT steht.
 */
function launchctlAttrappe(insel: Insel, fehlschlaege: number): string {
  const ordner = join(insel.wurzel, "pfad-attrappe");
  mkdirSync(ordner, { recursive: true });
  writeFileSync(
    join(ordner, "launchctl"),
    `#!/usr/bin/env bash
ZAEHLER=${JSON.stringify(join(insel.wurzel, "kickstart-zaehler"))}
case "\${1:-}" in
  print) exit 0 ;;
  kickstart)
    n=0
    if [ -f "$ZAEHLER" ]; then n="$(tr -d '[:space:]' < "$ZAEHLER")"; fi
    n=$((n + 1))
    printf '%s' "$n" > "$ZAEHLER"
    if [ "$n" -le ${fehlschlaege} ]; then
      echo "launchctl-Attrappe: kickstart-Versuch $n endet mit 42" >&2
      exit 42
    fi
    nohup ${JSON.stringify(join(insel.wurzel, "current", "start.command"))} \\
      >> ${JSON.stringify(join(insel.logs, "launchd.log"))} 2>&1 &
    printf '%s' "$!" > ${JSON.stringify(attrappenPid(insel))}
    exit 0 ;;
esac
exit 1
`,
    { mode: 0o755 },
  );
  return ordner;
}

/** Derselbe Update-Weg, nur mit der launchctl-Attrappe vor dem übrigen Pfad. */
function fahreUpdateUnterLaunchd(
  insel: Insel,
  quelle: string,
  fehlschlaege: number,
): ReturnType<typeof fahreSkript> {
  return fahreSkript(insel, UPDATE_SH, [quelle], {
    PATH: `${launchctlAttrappe(insel, fehlschlaege)}:${process.env.PATH ?? ""}`,
  });
}

/** Ruft `insel_server_stoppen` einmal und liest die hinterlassene Antwort. */
function stoppAntwort(insel: Insel, pfad: string): string {
  const lauf = spawnSync(
    "bash",
    [
      "-c",
      `. ${JSON.stringify(join(WURZEL, "scripts/insel/insel-betrieb.sh"))} >/dev/null
insel_server_stoppen ${JSON.stringify(join(insel.logs, "gibt-es-nicht.pid"))} >/dev/null
printf '%s' "$INSEL_STOPP_ANTWORT"`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: pfad, KLARWERK_LAUNCHD_LABEL: "de.klarwerk.insel.probe" },
    },
  );
  return `${lauf.stdout ?? ""}`.trim();
}

describe("JOB 4012 · die Wiederholung kostet den Rückfallpunkt nicht (BEN-R2-1)", () => {
  it("W1 · dasselbe Paket ein zweites Mal: abgelehnt, und 1.0.0 bleibt erreichbar", async () => {
    insel = await inselMitVorversion();
    const paket = legePaketAn(insel, { name: NEU, appVersion: "1.1.0" });

    const erstes = fahreUpdate(insel, paket);
    expect(erstes.code, erstes.ausgabe).toBe(0);
    expect(vorversionsvermerk(insel)).toBe(ALT);

    // Derselbe Griff, den Ben gefahren hat: das Paket kommt noch einmal an.
    const zweites = fahreUpdate(insel, paket);

    expect(zweites.code, zweites.ausgabe).toBe(6);
    expect(zweites.ergebnis).toBe(
      "Update abgebrochen, Vorversion 1.1.0 läuft weiter, Grund: kollision",
    );
    // Das Entscheidende — der Vermerk zeigt weiter auf die Fassung davor, nicht auf sich selbst.
    expect(vorversionsvermerk(insel), "die Wiederholung hat den Rückfallpunkt überschrieben").toBe(
      ALT,
    );
    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");

    // Und der Rückfall kommt wirklich bei 1.0.0 an, nicht bei der laufenden Fassung.
    const zurueck = fahreRueckfall(insel);
    expect(zurueck.code, zurueck.ausgabe).toBe(0);
    expect(zurueck.ergebnis).toBe("Vorversion 1.0.0 aktiv");
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });

  it("W2 · Quelle gleich Ziel — das installierte Verzeichnis selbst — wird abgelehnt", async () => {
    insel = await inselMitVorversion();
    const erstes = fahreUpdate(insel, legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }));
    expect(erstes.code, erstes.ausgabe).toBe(0);

    // Genau Bens Aufruf: als Quelle das Release, das schon unter `releases/` liegt und läuft.
    const zweites = fahreUpdate(insel, join(insel.releases, NEU));

    expect(zweites.code, zweites.ausgabe).toBe(6);
    expect(zweites.ergebnis).toContain("Grund: kollision");
    expect(zweites.ausgabe, "der Grund muss beim Namen genannt werden").toContain(
      "Update auf sich selbst",
    );
    expect(vorversionsvermerk(insel)).toBe(ALT);

    const zurueck = fahreRueckfall(insel);
    expect(zurueck.code, zurueck.ausgabe).toBe(0);
    expect(zurueck.ergebnis).toBe("Vorversion 1.0.0 aktiv");
    expect(aktivesRelease(insel)).toBe(ALT);
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });

  it("W3 · zwei Läufe in DERSELBEN Sekunde: die zweite Sicherung überschreibt die erste nicht", async () => {
    insel = await inselMitVorversion();
    const journal = join(insel.daten, "state.jsonl");

    // DIE SEKUNDE WIRD FESTGENAGELT (Korrektur Runde 4, Bens Einwand zu W3). Vorher hoffte dieser
    // Test darauf, dass beide Läufe zufällig in dieselbe Sekunde fallen — auf einem schnellen
    // Rechner tun sie das oft, aber eben nicht verlässlich, und dann mass er nichts. `date` ist ein
    // Fremdbinary; der Update-Weg selbst bleibt unangetastet.
    const mitFesterSekunde = (quelle: string) =>
      fahreSkript(insel as Insel, UPDATE_SH, [quelle], {
        PATH: `${fremdbinaerAttrappe(insel as Insel, { date: festerZeitstempel(SEKUNDE) })}:${process.env.PATH ?? ""}`,
      });

    const erstes = mitFesterSekunde(legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }));
    expect(erstes.code, erstes.ausgabe).toBe(0);
    const ersteSicherung = /Sicherung (.+)$/.exec(erstes.ergebnis)?.[1] ?? "";
    const ersterInhalt = readFileSync(ersteSicherung, "utf8");

    // Der Betrieb schreibt weiter, und gleich darauf kommt das nächste Paket.
    writeFileSync(journal, `${ersterInhalt}{"nr":99,"wert":"dazwischen"}\n`);
    const zweites = mitFesterSekunde(legePaketAn(insel, { name: NEUER, appVersion: "1.2.0" }));
    expect(zweites.code, zweites.ausgabe).toBe(0);
    const zweiteSicherung = /Sicherung (.+)$/.exec(zweites.ergebnis)?.[1] ?? "";

    // Die Kalibrierung: beide Läufe haben wirklich dieselbe Sekunde gezogen.
    expect(ersteSicherung).toContain(`/${SEKUNDE}-`);
    expect(zweiteSicherung, "die Sekunde wurde nicht geteilt").toContain(`/${SEKUNDE}-`);
    expect(zweiteSicherung).not.toBe(ersteSicherung);

    expect(
      readFileSync(ersteSicherung, "utf8"),
      "die Sicherung des ersten Laufes wurde überschrieben",
    ).toBe(ersterInhalt);
    expect(readFileSync(zweiteSicherung, "utf8")).toContain("dazwischen");
    // Der Zeitstempel allein hat Sekundenauflösung; je Lauf kommt eine eigene Kennung dazu.
    expect(zweiteSicherung).toMatch(/\/\d{8}T\d{6}Z-[A-Za-z0-9]{6}\/state\.jsonl$/);
  });
});

describe("JOB 4012 · ein gescheiterter Startaufruf führt in den Rückfall (BEN-R2-2)", () => {
  it("W4 · launchctl scheitert einmal: die Vorversion läuft danach wirklich wieder", async () => {
    insel = await inselMitVorversion();
    const paket = legePaketAn(insel, { name: NEU, appVersion: "1.1.0" });

    const lauf = fahreUpdateUnterLaunchd(insel, paket, 1);

    expect(lauf.code, lauf.ausgabe).toBe(11);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft wieder, Grund: start");
    expect(aktivesRelease(insel)).toBe(ALT);
    // Nicht der Satz zählt, sondern die Antwort: 1.0.0 ist wirklich oben.
    const stand = await gesundheit(insel);
    expect(stand?.code).toBe(200);
    expect(stand?.version).toBe("1.0.0");
  });

  it("W5 · scheitert auch der Rückfallstart, wird kein Wiederanlauf behauptet", async () => {
    insel = await inselMitVorversion();
    const paket = legePaketAn(insel, { name: NEU, appVersion: "1.1.0" });

    const lauf = fahreUpdateUnterLaunchd(insel, paket, 99);

    expect(lauf.code, lauf.ausgabe).toBe(9);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Rückfall auf 1.0.0 gescheitert, Grund: start");
    expect(lauf.ausgabe).toContain("Rückfall gescheitert, Grund: start");
    // Der Zeiger steht trotzdem wieder auf der Vorversion — das ist der Zustand, aus dem ein
    // Mensch weiterkommt. Behauptet wird nur, was gemessen ist: es läuft nichts.
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(await gesundheit(insel)).toBeUndefined();
  });

  it("W6 · der Stopp gibt in jedem Fall eine Antwort, statt schweigend 0 zu liefern", async () => {
    insel = await inselMitVorversion();
    const pfad = launchctlAttrappe(insel, 99);

    const unterLaunchd = stoppAntwort(insel, `${pfad}:${process.env.PATH ?? ""}`);
    expect(unterLaunchd).toBe("launchd-fuehrt");

    // Ohne launchd und ohne vermerkten Server: derselbe Rückgabewert 0, aber eine andere Antwort.
    const selbstgefuehrt = stoppAntwort(insel, process.env.PATH ?? "");
    expect(selbstgefuehrt).toBe("kein-server");
  });
});
