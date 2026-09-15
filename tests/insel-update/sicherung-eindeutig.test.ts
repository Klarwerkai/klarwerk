// ================================================================================================
// JOB 4012 · RUNDE 4 — EINE SICHERUNG DARF KEINE ANDERE SICHERUNG LÖSCHEN, AUCH NICHT IM POSTGRES-
// BETRIEB (Bens Gegenprobe aus Runde 3).
// ================================================================================================
//
// DER BEFUND: Runde 3 gab jedem Update-Lauf ein eigenes Sicherungsverzeichnis (`mktemp -d`) — und
// schickte `backup.sh` trotzdem weiter in das GEMEINSAME `backups/`. Eindeutig lag damit nur das
// Protokoll. `backup.sh` bildet seinen Dateinamen aus seinem eigenen `date`
// (`$DEST/klarwerk-<stempel>.dump`, Sekundenauflösung); zwei Läufe in derselben Sekunde schrieben
// denselben Namen, und der zweite Dump ersetzte den ersten samt Prüfsumme. Ben hat das gemessen:
// `expected 'ZWEITE SICHERUNG' to be 'ERSTE SICHERUNG'`. Der Journalzweig war schon zu, der
// Postgres-Zweig nicht — und gerade dort ist die Sicherung das Einzige, was die Daten hält.
//
// WARUM DIESER TEST NICHT IM INTEGRATIONSLAUF STEHT: `update-postgres.integration.test.ts` braucht
// eine echte Datenbank und überspringt sich ohne sie — im Tor also immer. Ein Loch, das nur ein Lauf
// findet, der nie läuft, ist ungeprüft. Hier sind ausschliesslich zwei FREMDBINARIES Attrappe:
// `date` (damit „dieselbe Sekunde" erzwungen und nicht erhofft ist) und `pg_dump` (damit keine
// Datenbank nötig ist). `update-einspielen.sh` UND `scripts/backup/backup.sh` laufen unverändert —
// samt Arbeitsname, echter sha256-Prüfsumme und der Veröffentlichung Sidecar-dann-Dump.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  type Lauf,
  PG_DUMP_ATTRAPPE,
  UPDATE_SH,
  aktivesRelease,
  fahreSkript,
  festerZeitstempel,
  fremdbinaerAttrappe,
  gesundheit,
  legeInselAn,
  legePaketAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";
const NEUER = "klarwerk-insel-noch-neuer";

/** Eine Sekunde, die beide Läufe teilen — der Kollisionsfall, festgenagelt statt abgewartet. */
const SEKUNDE = "20260915T010203Z";

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/** Die Vorversion läuft, die Daten liegen in Postgres (also: keine Journaldatei). */
async function inselMitPostgres(): Promise<Insel> {
  const neue = await legeInselAn();
  schreibeRelease(neue.releases, { name: ALT, appVersion: "1.0.0" });
  setzeCurrent(neue, ALT);
  return neue;
}

/**
 * Ein Update im Postgres-Betrieb, mit festgenagelter Sekunde und einem unterscheidbaren Dumpinhalt.
 * Die Datenbank-URL zeigt bewusst ins Leere: die `pg_dump`-Attrappe verbindet sich nirgends, und
 * `backup.sh` gibt die URL nur als Argument weiter. Ein echter Verbindungsversuch fände hier nichts.
 */
function fahreUpdateMitDump(insel: Insel, quelle: string, inhalt: string): Lauf {
  const pfad = fremdbinaerAttrappe(insel, {
    date: festerZeitstempel(SEKUNDE),
    pg_dump: PG_DUMP_ATTRAPPE,
  });
  return fahreSkript(insel, UPDATE_SH, [quelle], {
    PATH: `${pfad}:${process.env.PATH ?? ""}`,
    DATABASE_URL: "postgresql://probe:probe@127.0.0.1:1/klarwerk_probe",
    KLARWERK_PROBE_DUMPINHALT: inhalt,
  });
}

/** Der Sicherungspfad aus der Ergebniszeile — genau der Pfad, den ein Mensch dort abliest. */
function sicherungAus(lauf: Lauf): string {
  return /^Update auf .+ aktiv, Sicherung (.+)$/.exec(lauf.ergebnis)?.[1] ?? "";
}

describe("JOB 4012 · zwei Läufe in derselben Sekunde — beide Sicherungen bleiben (Postgres)", () => {
  it("S1 · der zweite Dump überschreibt den ersten nicht, und beide tragen ihre Prüfsumme", async () => {
    insel = await inselMitPostgres();

    const erstes = fahreUpdateMitDump(
      insel,
      legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }),
      "ERSTE SICHERUNG",
    );
    expect(erstes.code, erstes.ausgabe).toBe(0);
    const ersteSicherung = sicherungAus(erstes);
    expect(ersteSicherung, `Ergebniszeile war: ${erstes.ergebnis}`).toMatch(/klarwerk-.*\.dump$/);

    const zweites = fahreUpdateMitDump(
      insel,
      legePaketAn(insel, { name: NEUER, appVersion: "1.2.0" }),
      "ZWEITE SICHERUNG",
    );
    expect(zweites.code, zweites.ausgabe).toBe(0);
    const zweiteSicherung = sicherungAus(zweites);

    // DIE KALIBRIERUNG, ohne die der Test nichts aussagt: Beide Läufe haben WIRKLICH denselben
    // Zeitstempel gezogen. Der Dateiname ist deshalb identisch — nur das Verzeichnis trennt sie.
    // Ohne diese Zeile könnte der Test grün sein, weil die Sekunde zufällig umgesprungen ist.
    expect(basename(zweiteSicherung), "die Sekunde wurde nicht wirklich geteilt").toBe(
      basename(ersteSicherung),
    );

    // DER BEFUND SELBST, und er steht VOR der Pfadprüfung: Fällt er, soll die rote Zeile den
    // Datenverlust nennen („erwartet ERSTE SICHERUNG, gelesen ZWEITE SICHERUNG") und nicht bloss
    // zwei gleiche Verzeichnisnamen. Genau so hat Ben den Fehler in Runde 3 gemeldet.
    expect(existsSync(ersteSicherung), "die erste Sicherung wurde überschrieben").toBe(true);
    expect(existsSync(zweiteSicherung)).toBe(true);
    expect(
      readFileSync(ersteSicherung, "utf8"),
      "der zweite Lauf hat die Sicherung des ersten ersetzt",
    ).toBe("ERSTE SICHERUNG");
    expect(readFileSync(zweiteSicherung, "utf8")).toBe("ZWEITE SICHERUNG");
    expect(dirname(zweiteSicherung)).not.toBe(dirname(ersteSicherung));

    // Ein Dump ohne gültige Prüfsumme wäre eine Sicherung, die man nicht einspielen darf.
    for (const dump of [ersteSicherung, zweiteSicherung]) {
      const sidecar = `${dump}.sha256`;
      expect(existsSync(sidecar), `Prüfsumme fehlt neben ${dump}`).toBe(true);
      const [hash, name] = readFileSync(sidecar, "utf8").trim().split(/\s+/);
      expect(hash).toBe(createHash("sha256").update(readFileSync(dump)).digest("hex"));
      expect(name).toBe(basename(dump));
    }

    expect(aktivesRelease(insel)).toBe(NEUER);
    expect((await gesundheit(insel))?.version).toBe("1.2.0");
  });

  it("S2 · die Sicherung liegt im Laufordner, nicht lose in backups/", async () => {
    insel = await inselMitPostgres();

    const lauf = fahreUpdateMitDump(
      insel,
      legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }),
      "EINZELNE SICHERUNG",
    );
    expect(lauf.code, lauf.ausgabe).toBe(0);

    // Der Laufordner heisst `<zeitstempel>-<lauf>`; genau dieser Namensteil macht zwei Läufe in
    // derselben Sekunde unterscheidbar. Läge der Dump direkt unter `backups/`, wäre der Name des
    // Elternverzeichnisses „backups" — und der zweite Lauf hätte freie Bahn.
    expect(sicherungAus(lauf)).toMatch(
      new RegExp(`/backups/${SEKUNDE}-[A-Za-z0-9]{6}/klarwerk-${SEKUNDE}\\.dump$`),
    );
    // Das Protokoll von backup.sh gehört in denselben Ordner wie sein Ergebnis.
    expect(existsSync(join(dirname(sicherungAus(lauf)), "backup.log"))).toBe(true);
  });
});

// Der Journalzweig derselben Frage steht bei seinen Geschwistern:
// `wiederholung-und-startfehler.test.ts` W3 — seit Runde 4 ebenfalls mit festgenagelter Sekunde.
