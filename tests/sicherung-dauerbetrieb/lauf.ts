// ================================================================================================
// JOB 4057 — DER PRÜFSTAND FÜR `scripts/backup/backup.sh` IM DAUERBETRIEB.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD: das ECHTE Skript, unverändert ausgeführt, gegen ein temporäres
// Zielverzeichnis. Keine Datenbank, kein Netz, kein Schreiben ausserhalb von `os.tmpdir()`.
//
// DER PATH IST ISOLIERT — und das ist der Kern dieses Prüfstands. Das Skript entscheidet an
// `command -v pg_dump` / `command -v pg_restore`, ob es überhaupt anfängt. Mit dem echten PATH
// davor wäre „das Werkzeug fehlt" auf einem Rechner mit installiertem `postgresql-client` nicht
// messbar; der Fall wäre je nach Maschine grün oder rot. Deshalb sieht der Lauf AUSSCHLIESSLICH
// das Verzeichnis `bin` des Prüflaufs: darin die Attrappen für `pg_dump`/`pg_restore` und Symlinks
// auf die echten Basiswerkzeuge (`date`, `mv`, `shasum`, …), die das Skript ohnehin braucht.
// Lässt man eine Attrappe weg, ist das Werkzeug WIRKLICH nicht da.
//
// MESSGRENZE, ausdrücklich: Die Attrappen belegen die ENTSCHEIDUNGEN des Skripts — was es
// veröffentlicht, was es löscht, was es protokolliert. Sie belegen NICHT, dass ein echter
// `pg_restore` einen echten Dump annimmt. Dieser Nachweis gehört zum Drill
// (`scripts/backup/restore-drill.sh`, `tests/backup-drill/`) und wird hier nicht behauptet.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const WURZEL = resolve(import.meta.dirname, "../..");
export const SKRIPT = join(WURZEL, "scripts/backup/backup.sh");

/**
 * Die Werkzeuge, die `backup.sh` selbst aufruft und die deshalb im isolierten PATH liegen müssen.
 * Fehlt hier eines, scheitert der Prüfstand an seiner eigenen Umgebung — sichtbar und laut, nicht
 * als stiller Fehlbefund am Skript.
 */
const BASISWERKZEUGE = [
  "bash",
  "date",
  "dirname",
  "pwd",
  "mkdir",
  "mv",
  "rm",
  "basename",
  "wc",
  "tr",
  "awk",
  "sort",
  "cat",
  "shasum",
  "sha256sum",
] as const;

/** Erste Fundstelle eines Werkzeugs im PATH des Testprozesses. */
function finde(name: string): string | undefined {
  for (const ordner of (process.env.PATH ?? "").split(":")) {
    if (ordner === "") continue;
    const pfad = join(ordner, name);
    try {
      if (statSync(pfad).isFile()) return pfad;
    } catch {
      /* Nicht da — nächster Ordner. */
    }
  }
  return undefined;
}

const BASH = finde("bash");

/**
 * Die Attrappen. Ein einziges Programm für alle Namen; es entscheidet an `argv[1]`, wer es ist,
 * und schreibt jeden Aufruf mit vollständiger Argumentliste in die Sondendatei `calls`.
 */
const ATTRAPPE = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const sonde = process.env.SONDE;
const modus = process.env.MODUS || 'ok';
fs.appendFileSync(path.join(sonde, 'calls'), JSON.stringify([name, ...args]) + '\n');
// Ein VORHANDENES Werkzeug, das FEHLSCHLAEGT — der Fall, den BEN R1 gefunden hat. Nicht dasselbe
// wie ein fehlendes Werkzeug: command -v findet es, der Aufruf endet trotzdem mit Fehler.
const fehlerhaft = (process.env.FEHLER_WERKZEUGE || '').split(',').filter(Boolean);
if (fehlerhaft.includes(name)) {
  console.error(name + ': attrappe scheitert absichtlich (Pruefstand JOB 4057)');
  process.exit(Number(process.env.FEHLER_EXIT || '7'));
}
// FESTER SEKUNDENSTEMPEL. Der Endname klarwerk-<STAMP>.dump ist auf die Sekunde genau; zwei
// Laeufe in derselben Sekunde treffen denselben Namen. Das darf im Pruefstand nicht vom Zufall
// abhaengen. (Kein Backtick in dieser Datei unterhalb dieser Zeile: der Text steht in einem
// String.raw-Template, ein Backtick wuerde es beenden.)
if (name === 'date' && process.env.FESTER_STEMPEL) {
  process.stdout.write(process.env.FESTER_STEMPEL + '\n');
  process.exit(0);
}
// Ein mv, das GENAU EINEN Schritt der Veroeffentlichung verweigert: das zweite (den Dump).
// Alle anderen Aufrufe reicht die Attrappe an das echte Werkzeug durch, sonst waere der Lauf nicht
// mehr der echte Ablauf, sondern eine Nachbildung.
if (name === 'mv') {
  const muster = process.env.MV_FEHLER_MUSTER || '';
  if (muster !== '' && String(args[0]).endsWith(muster)) {
    console.error('mv: attrappe verweigert ' + args[0] + ' (Pruefstand JOB 4057)');
    process.exit(Number(process.env.MV_FEHLER_EXIT || '8'));
  }
  if (!process.env.MV_ECHT) process.exit(95);
  const r = require('node:child_process').spawnSync(process.env.MV_ECHT, args, { stdio: 'inherit' });
  process.exit(r.status === null ? 96 : r.status);
}
if (name === 'pg_dump') {
  if (modus === 'dump-fehler') { console.error('pg_dump: error: connection to server failed'); process.exit(2); }
  const stelle = args.indexOf('--file');
  if (stelle < 0) process.exit(91);
  // Exit 0 und trotzdem eine LEERE Datei: pg_dump meldet Erfolg, es steht nichts drin. Genau der
  // Fall, an dem sich zeigt, ob die Ersatzpruefung wirklich liest oder nur durchwinkt.
  if (modus === 'leerer-dump') { fs.writeFileSync(args[stelle + 1], ''); process.exit(0); }
  // JEDER LAUF SCHREIBT ANDERE BYTES (BEN R5, Korrekturpflicht 2). Vorher war der Inhalt konstant;
  // deshalb war ein UEBERSCHRIEBENER Dump von einem unberuehrten nicht zu unterscheiden, und der
  // Bestandsschutztest sah den Schaden nicht, den er suchen sollte.
  fs.writeFileSync(args[stelle + 1], 'PGDMP attrappe lauf ' + (process.env.DUMP_MARKE || '?') + '\n');
  process.exit(0);
}
if (name === 'pg_restore') {
  if (!args.includes('--list')) process.exit(92);
  if (modus === 'unlesbar') { console.error('pg_restore: error: did not find magic string in file header'); process.exit(1); }
  const ziel = args[args.length - 1];
  if (!fs.existsSync(ziel)) process.exit(93);
  process.stdout.write(';\n; Archive created by pg_dump attrappe\n;\n');
  process.exit(0);
}
process.exit(94);
`;

export interface Optionen {
  /**
   * `ok` = Attrappen arbeiten; `unlesbar` = `pg_restore --list` scheitert; `dump-fehler` =
   * `pg_dump` scheitert; `leerer-dump` = `pg_dump` meldet Erfolg, schreibt aber 0 Bytes.
   */
  readonly modus?: "ok" | "unlesbar" | "dump-fehler" | "leerer-dump";
  /** Wert für `BACKUP_KEEP`. Fehlt der Schlüssel, ist die Variable NICHT gesetzt. */
  readonly keep?: string;
  /** DB-URL. `null` = weder `KLARWERK_DATABASE_URL` noch `DATABASE_URL` setzen. */
  readonly dbUrl?: string | null;
  /** Vollständige Altpaare (Dump + Sidecar), je Zeitstempel im Format des Skripts. */
  readonly altstempel?: readonly string[];
  /** Dumps OHNE Sidecar — stammen nicht aus diesem Skript und sind unantastbar. */
  readonly ohneSidecar?: readonly string[];
  /** Arbeitsstände fremder, gleichzeitig laufender Läufe. */
  readonly fremdePartial?: readonly string[];
  /** Attrappen, die NICHT angelegt werden — das Werkzeug fehlt dann wirklich. */
  readonly ohneWerkzeug?: readonly Werkzeug[];
  /**
   * Werkzeuge, die VORHANDEN sind, aber mit `fehlerExit` scheitern. Das ist der Fall aus BEN R1:
   * `command -v shasum` findet es, `shasum -a 256 …` endet mit Exit 7.
   */
  readonly werkzeugFehler?: readonly Werkzeug[];
  /** Exitcode der fehlschlagenden Werkzeuge, Standard 7. */
  readonly fehlerExit?: number;
  /**
   * `date` gibt IMMER diesen Stempel aus. Damit treffen zwei aufeinanderfolgende Läufe DENSELBEN
   * Endnamen `klarwerk-<STAMP>.dump` — im Dauerbetrieb der Fall „zwei Läufe in derselben Sekunde",
   * und der Fall, an dem BEN R3 den zerstörerischen Aufräumzweig gemessen hat.
   */
  readonly festerStempel?: string;
  /**
   * `mv` verweigert genau die Aufrufe, deren ERSTES Argument auf diese Endung passt; alle anderen
   * reicht es an das echte `mv` durch. `".dump.partial"` trifft damit ausschliesslich das ZWEITE
   * `mv` der Veröffentlichung (den Dump), nicht den Sidecar und nicht die Ergebnisspur.
   */
  readonly mvFehltBei?: string;
  /** Exitcode des verweigerten `mv`, Standard 8. */
  readonly mvFehlerExit?: number;
}

/**
 * Werkzeuge, deren Vorhandensein und Verhalten der Prüfstand steuern kann.
 *
 * `date` und `sort` sind seit BEN R2 dabei: `date` ruft das Skript AUCH IN SEINEM EIGENEN
 * Ergebnisschreiber auf (ein Fehler dort zerreisst das Sicherheitsnetz von innen), `sort` steht
 * NACH der Veröffentlichung (ein Fehler dort widerlegt jede pauschale Aussage „nichts
 * veröffentlicht"). BEN musste beide Namen noch mit `as Werkzeug` hereinzwingen — die Attrappen-
 * fabrik konnte sie längst, nur diese Union war zu eng.
 */
export type Werkzeug =
  | "pg_dump"
  | "pg_restore"
  | "shasum"
  | "sha256sum"
  | "mv"
  | "rm"
  | "wc"
  | "date"
  | "sort"
  | "cat";

export interface Lauf {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly ausgabe: string;
  /** Alle Namen im Zielverzeichnis, sortiert. */
  readonly dateien: readonly string[];
  /** Inhalt jeder Datei im Zielverzeichnis. */
  readonly inhalt: Readonly<Record<string, string>>;
  /** Die veröffentlichten Dumps (`klarwerk-*.dump`), sortiert. */
  readonly dumps: readonly string[];
  /** Jeder Attrappenaufruf mit vollständiger Argumentliste, in Aufrufreihenfolge. */
  readonly aufrufe: readonly (readonly string[])[];
  /** Rohtext von `letzter-lauf.json`, oder `undefined` wenn die Datei fehlt. */
  readonly ergebnisRoh: string | undefined;
  /** `letzter-lauf.json` geparst — wirft, wenn sie fehlt oder kein JSON ist. */
  readonly ergebnis: () => Record<string, unknown>;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Inhalt eines Altdumps — an den Zeitstempel gebunden, damit jede Datei ihren eigenen Hash hat. */
export function altInhalt(stempel: string): string {
  return `PGDMP altbestand ${stempel}\n`;
}

export function sidecarZeile(inhalt: string, endname: string): string {
  return `${sha256(inhalt)}  ${endname}\n`;
}

/**
 * EIN Lauf in einem VORHANDENEN Sondenverzeichnis. Baut `bin` für genau diesen Lauf neu auf — die
 * Werkzeuglage darf sich von Lauf zu Lauf ändern (erst Erfolg, dann fehlschlagendes `shasum`).
 */
function einLauf(sonde: string, optionen: Optionen, marke: string): Lauf {
  if (BASH === undefined) throw new Error("Prüfstand ohne bash im PATH");
  {
    const bin = join(sonde, "bin");
    const ziel = join(sonde, "ziel");
    rmSync(bin, { recursive: true, force: true });
    rmSync(join(sonde, "calls"), { force: true });
    mkdirSync(bin);
    if (!existsSync(ziel)) mkdirSync(ziel);
    writeFileSync(join(bin, "package.json"), JSON.stringify({ type: "commonjs" }));
    const attrappen: readonly string[] = [
      "pg_dump",
      "pg_restore",
      ...(optionen.werkzeugFehler ?? []),
      ...(optionen.festerStempel !== undefined ? ["date"] : []),
      ...(optionen.mvFehltBei !== undefined ? ["mv"] : []),
    ];
    const fehlen: readonly string[] = optionen.ohneWerkzeug ?? [];
    for (const name of attrappen) {
      if (fehlen.includes(name)) continue;
      writeFileSync(join(bin, name), `#!${process.execPath}\n${ATTRAPPE}`, { mode: 0o755 });
    }
    for (const name of BASISWERKZEUGE) {
      // Was als Attrappe gebraucht wird oder ausdrücklich fehlen soll, wird NICHT verlinkt.
      if (attrappen.includes(name) || fehlen.includes(name)) continue;
      const echt = finde(name);
      // `sha256sum` fehlt auf macOS, `shasum` kann auf schmalen Linux-Abbildern fehlen. Das Skript
      // braucht genau EINES von beiden; fehlt auch das, scheitern die Fälle sichtbar an Exit 3.
      if (echt !== undefined) symlinkSync(echt, join(bin, name));
    }

    for (const stempel of optionen.altstempel ?? []) {
      const endname = `klarwerk-${stempel}.dump`;
      const inhalt = altInhalt(stempel);
      writeFileSync(join(ziel, endname), inhalt);
      writeFileSync(join(ziel, `${endname}.sha256`), sidecarZeile(inhalt, endname));
    }
    for (const stempel of optionen.ohneSidecar ?? []) {
      writeFileSync(join(ziel, `klarwerk-${stempel}.dump`), altInhalt(stempel));
    }
    for (const stempel of optionen.fremdePartial ?? []) {
      writeFileSync(join(ziel, `klarwerk-${stempel}.dump.partial`), altInhalt(stempel));
    }

    const umgebung: Record<string, string> = {
      PATH: bin,
      SONDE: sonde,
      MODUS: optionen.modus ?? "ok",
      HOME: sonde,
      LC_ALL: "C",
      // Der Inhaltsstempel dieses Laufs — er macht die Dumpbytes je Lauf unterscheidbar.
      DUMP_MARKE: marke,
    };
    const url =
      optionen.dbUrl === undefined ? "postgres://pruef@127.0.0.1:5432/db" : optionen.dbUrl;
    if (url !== null) umgebung.KLARWERK_DATABASE_URL = url;
    if (optionen.keep !== undefined) umgebung.BACKUP_KEEP = optionen.keep;
    if (optionen.werkzeugFehler !== undefined && optionen.werkzeugFehler.length > 0) {
      umgebung.FEHLER_WERKZEUGE = optionen.werkzeugFehler.join(",");
      umgebung.FEHLER_EXIT = String(optionen.fehlerExit ?? 7);
    }
    if (optionen.festerStempel !== undefined) umgebung.FESTER_STEMPEL = optionen.festerStempel;
    if (optionen.mvFehltBei !== undefined) {
      const echtesMv = finde("mv");
      if (echtesMv === undefined) throw new Error("Prüfstand ohne mv im PATH");
      umgebung.MV_FEHLER_MUSTER = optionen.mvFehltBei;
      umgebung.MV_FEHLER_EXIT = String(optionen.mvFehlerExit ?? 8);
      umgebung.MV_ECHT = echtesMv;
    }

    const ergebnis = spawnSync(BASH, [SKRIPT, ziel], {
      cwd: tmpdir(),
      env: umgebung,
      encoding: "utf8",
      timeout: 30_000,
    });

    const dateien = readdirSync(ziel).sort();
    const inhalt: Record<string, string> = {};
    for (const name of dateien) inhalt[name] = readFileSync(join(ziel, name), "utf8");
    const ergebnisPfad = join(ziel, "letzter-lauf.json");
    const ergebnisRoh = existsSync(ergebnisPfad) ? readFileSync(ergebnisPfad, "utf8") : undefined;
    const sondenpfad = join(sonde, "calls");
    const aufrufe = (existsSync(sondenpfad) ? readFileSync(sondenpfad, "utf8") : "")
      .split("\n")
      .filter((zeile) => zeile !== "")
      .map((zeile) => JSON.parse(zeile) as string[]);
    const stdout = ergebnis.stdout ?? "";
    const stderr = ergebnis.stderr ?? "";
    return {
      code: ergebnis.status,
      stdout,
      stderr,
      ausgabe: stdout + stderr,
      dateien,
      inhalt,
      dumps: dateien.filter((n) => /^klarwerk-.*\.dump$/.test(n)),
      aufrufe,
      ergebnisRoh,
      ergebnis: () => {
        if (ergebnisRoh === undefined) throw new Error("letzter-lauf.json fehlt");
        return JSON.parse(ergebnisRoh) as Record<string, unknown>;
      },
    };
  }
}

/**
 * Ein vollständiger Lauf des echten Skripts. Räumt sein Temporärverzeichnis auf und gibt vorher
 * alles zurück, was die Fälle brauchen.
 */
export function lauf(optionen: Optionen = {}): Lauf {
  const sonde = mkdtempSync(join(tmpdir(), "klarwerk-sicherung-"));
  try {
    return einLauf(sonde, optionen, "1");
  } finally {
    rmSync(sonde, { recursive: true, force: true });
  }
}

/**
 * MEHRERE Läufe hintereinander im SELBEN Zielverzeichnis — das, was im Dauerbetrieb wirklich
 * passiert: Nacht für Nacht dieselbe Cron-Zeile, dasselbe `/data/backups`.
 *
 * WARUM DAS EIGEN GEBAUT IST (BEN R1, Prüfpunkt 2): Ein frischer Erfolgslauf in einem LEEREN
 * Verzeichnis kann nicht belegen, dass eine ALTE Spur überschrieben wird. Genau daran hing der
 * schwerste Befund — ein Fehlschlag ließ die Erfolgsmeldung des Vortags stehen.
 *
 * JEDER LAUF SCHREIBT ANDERE DUMPBYTES (BEN R5): `DUMP_MARKE` ist die laufende Nummer. Solange der
 * Inhalt konstant war, sah ein ÜBERSCHRIEBENER Dump aus wie ein unberührter — ein Bestandsschutz-
 * test, der Inhalte vergleicht, war damit blind für genau den Schaden, den er messen sollte.
 */
export function folge(...optionen: readonly Optionen[]): readonly Lauf[] {
  const sonde = mkdtempSync(join(tmpdir(), "klarwerk-sicherung-folge-"));
  try {
    return optionen.map((eines, stelle) => einLauf(sonde, eines, String(stelle + 1)));
  } finally {
    rmSync(sonde, { recursive: true, force: true });
  }
}
