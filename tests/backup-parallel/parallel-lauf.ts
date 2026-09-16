// ================================================================================================
// JOB 4227 — DER PRÜFSTAND FÜR ZWEI GLEICHZEITIGE SICHERUNGSLÄUFE.
// ================================================================================================
//
// WARUM ES DIESEN ZWEITEN PRÜFSTAND ÜBERHAUPT GIBT. `tests/sicherung-dauerbetrieb/lauf.ts` fährt
// Läufe NACHEINANDER (`folge`) — das ist der Dauerbetrieb, und dafür ist er gebaut. Der Auftrag
// hier verlangt ausdrücklich etwas anderes: „zwei ECHTE, gleichzeitig laufende Backup-Prozesse
// (nicht zwei sequenzielle Aufrufe mit gleichem Zeitstempel)". Zwei Aufrufe hintereinander sehen
// die Welt des jeweils anderen fertig; nur zwei WIRKLICH gleichzeitige Prozesse können sich
// gegenseitig ins Wort fallen. Genau dieses Ins-Wort-Fallen ist die Lücke, die BEN in JOB 4057 R7
// offen gelassen hat („tatsächlich parallele Läufe bleiben ungemessen").
//
// ------------------------------------------------------------------------------------------------
// DER TREFFPUNKT — warum ein Barrieren-Rendezvous und kein Schlafbefehl
// ------------------------------------------------------------------------------------------------
// Zwei Prozesse „ungefähr gleichzeitig" zu starten misst nichts Verlässliches: auf einer schnellen
// Maschine ist der erste fertig, bevor der zweite begonnen hat, und der Fall wäre je nach Last grün
// oder rot. Deshalb treffen sich beide Prozesse an ZWEI festen Punkten:
//
//   T1  am Anfang von `pg_dump` — ab hier ist belegt, dass beide Läufe die Namensvergabe hinter
//       sich haben und gleichzeitig laufen;
//   T2  am ERSTEN `mv` der Veröffentlichung (dem Sidecar) — das ist die Stelle unmittelbar hinter
//       der Belegtprüfung des alten Standes. Wer hier steht, hat den Endnamen bereits für frei
//       befunden.
//
// ------------------------------------------------------------------------------------------------
// UND WARUM DIE REIHENFOLGE HINTER T2 FESTGELEGT WIRD
// ------------------------------------------------------------------------------------------------
// Hinter T2 liegen vier Umbenennungen (Sidecar A, Sidecar B, Dump A, Dump B). Liesse man sie frei
// rennen, entschiede die Maschine, welche Reihenfolge herauskommt — und eine davon (A-Sidecar,
// A-Dump, B-Sidecar, B-Dump) sieht zufällig heil aus. Der Fall wäre flatterig und damit wertlos.
//
// Der Prüfstand legt deshalb GENAU EINE der Reihenfolgen fest, die der alte Code zulässt:
//
//     Sidecar A  →  Sidecar B  →  Dump B  →  Dump A
//
// Sie ist nicht erfunden, sondern eine der erlaubten Verschränkungen zweier Prozesse, die beide den
// Namen für frei halten. Am Ende steht dann der Dump von A unter der Prüfsumme von B. Was hier
// gemessen wird, ist also nicht „diese eine Verschränkung ist möglich" (das ist sie), sondern: das
// Skript darf sie gar nicht erst zulassen — nach der Korrektur tragen beide Läufe verschiedene,
// exklusiv reservierte Namen, und dieselbe Verschränkung richtet keinen Schaden mehr an.
//
// MESSGRENZE, ausdrücklich: Die Attrappen belegen die ENTSCHEIDUNGEN des Skripts. Dass ein echter
// `pg_restore` einen echten Dump annimmt, belegt der Drill — und für die beiden Dumps eines
// Parallellaufs `tests/backup-parallel/beide-dumps-lassen-sich-restaurieren.integration.test.ts`.
import { type ChildProcess, spawn } from "node:child_process";
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
// EINE Quelle für „beschädigt": der sequenzielle und der parallele Prüfstand erzeugen denselben
// Schaden, damit nicht zwei Auslegungen desselben Worts entstehen.
import { beschaedigteSidecarzeile } from "../sicherung-dauerbetrieb/lauf";

const WURZEL = resolve(import.meta.dirname, "../..");
const SKRIPT = join(WURZEL, "scripts/backup/backup.sh");

/** Die Sekunde, die beide Läufe teilen — festgenagelt, nicht abgewartet. */
export const STEMPEL = "20260916T044455Z";
/** Der Endname dieser Sekunde ohne Nummer — der Name, um den beide Läufe konkurrieren. */
export const GRUNDNAME = `klarwerk-${STEMPEL}.dump`;

/**
 * Dieselben Werkzeuge wie im Dauerbetriebs-Prüfstand, plus `rmdir`: `backup.sh` gibt damit seine
 * eigene Namensreservierung wieder frei. Fehlt eines, scheitert der Prüfstand sichtbar an seiner
 * eigenen Umgebung statt still am Skript.
 */
const BASISWERKZEUGE = [
  "bash",
  "date",
  "dirname",
  "pwd",
  "mkdir",
  "rmdir",
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
 * Die Attrappen. Ein Programm für alle Namen, es entscheidet an `argv[1]`, wer es ist.
 *
 * Kein Backtick unterhalb dieser Zeile: der Text steht in einem `String.raw`-Template.
 */
const ATTRAPPE = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const treff = process.env.TREFFPUNKT;
const rolle = process.env.ROLLE;
const andere = rolle === 'a' ? 'b' : 'a';
const zahl = Number(process.env.TEILNEHMER || '2');
const frist = Number(process.env.TREFFPUNKT_FRIST || '30000');

function schlaf(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function melde(marke) {
  fs.writeFileSync(path.join(treff, marke), rolle);
}
/** Warten, bis die Bedingung gilt — oder bis der andere Lauf beendet ist, oder die Frist um ist. */
function warte(was, bedingung) {
  const bis = Date.now() + frist;
  while (!bedingung()) {
    if (fs.existsSync(path.join(treff, 'ende-' + andere))) return 'anderer-beendet';
    if (Date.now() > bis) {
      fs.writeFileSync(path.join(treff, 'frist-abgelaufen-' + rolle + '-' + was), was);
      return 'frist';
    }
    schlaf(10);
  }
  return 'erreicht';
}
/** Alle Teilnehmer treffen sich hier: jeder meldet sich an, dann wartet jeder auf die anderen. */
function barriere(was) {
  if (process.env.OHNE_BARRIEREN) return 'aus';
  melde(was + '-' + rolle);
  return warte(was, () =>
    fs.readdirSync(treff).filter((n) => n.startsWith(was + '-')).length >= zahl,
  );
}

if (name === 'mkdir') {
  // ======================================================================================
  // DIE STAFFEL (JOB 4227 R2, BENs Korrekturpflicht 1) — die Pause VOR der Reservierung.
  // ======================================================================================
  //
  // Das ist die Verschränkung, die eine Barriere NICHT herstellen kann, denn sie ist gerade
  // keine Gleichzeitigkeit, sondern eine Reihenfolge: Lauf A steht unmittelbar vor seinem
  // reservierenden mkdir und wartet dort, bis Lauf B KOMPLETT fertig ist — veröffentlicht,
  // Reservierung freigegeben, Prozess beendet. Erst dann läuft A weiter.
  //
  // Am Stand von Runde 1 hatte A die Bestandsfrage da schon gestellt und für frei befunden;
  // es überschrieb danach Bs fertiges Paar. Ab Runde 2 stellt A die Frage ERST unter seiner
  // eigenen Sperre — hinter dieser Pause — und weicht auf die nächste Nummer aus.
  //
  // Nur das reservierende mkdir wartet. Das mkdir -p des Zielverzeichnisses ganz am Anfang
  // des Skripts läuft durch, sonst käme kein Lauf je bis hierher.
  const letztes = String(args[args.length - 1]);
  if (process.env.STAFFEL_WARTET && letztes.endsWith('.reserviert')) {
    melde('vor-reservierung-' + rolle);
    warte('staffel', () => fs.existsSync(path.join(treff, 'ende-' + andere)));
  }
  const r = require('node:child_process').spawnSync(process.env.MKDIR_ECHT, args, { stdio: 'inherit' });
  process.exit(r.status === null ? 96 : r.status);
}

if (name === 'date') {
  // T4, nur wenn der Fall es verlangt: der ZWEITE date-Aufruf eines Laufs steht in
  // ergebnis_hinterlegen, also NACH der Aufbewahrung. Wer beide Läufe dort festhält, hält sie
  // über die ganze Aufbewahrung des jeweils anderen hinweg am Leben — samt ihrer Reservierungen.
  // Ohne das entschiede die Maschine, ob sich die Aufräumläufe überhaupt überlappen.
  if (process.env.TREFF_AUFBEWAHRUNG) {
    const zaehler = path.join(treff, 'date-zaehler-' + rolle);
    const bisher = fs.existsSync(zaehler) ? fs.readFileSync(zaehler, 'utf8').length : 0;
    fs.writeFileSync(zaehler, 'x'.repeat(bisher + 1));
    if (bisher + 1 >= 2) barriere('nach-aufbewahrung');
  }
  process.stdout.write(process.env.FESTER_STEMPEL + '\n');
  process.exit(0);
}

if (name === 'pg_dump') {
  // T1: beide Läufe sind hier gleichzeitig — die Namensvergabe liegt für beide hinter ihnen.
  barriere('start');
  if (process.env.WARTE_AUF_SIGNAL) {
    // Der Abbruchfall, den kein Exitcode nachstellt: der Lauf hält seine Reservierung (sie entsteht
    // VOR pg_dump) und bekommt von aussen ein echtes Signal — Strg-C, ein Containerstop, ein
    // Cron-Timeout. Diese Marke sagt dem Testtreiber, dass er jetzt schiessen darf.
    melde('bereit-' + rolle);
    // Danach warten, bis geschossen wurde — die Marke setzt der Testtreiber unmittelbar nach dem
    // kill. Erst dann darf diese Attrappe enden: bash führt eine Signalfalle NICHT aus, solange
    // es auf ein Vordergrundkind wartet, und das Kind sind wir. (Zweiter Ausgang: der
    // Elternprozess ist schon weg — dann hat sich process.ppid geändert.)
    const eltern = process.ppid;
    const bis2 = Date.now() + frist;
    while (
      !fs.existsSync(path.join(treff, 'geschossen-' + rolle)) &&
      process.ppid === eltern &&
      Date.now() < bis2
    ) {
      schlaf(10);
    }
    process.exit(0);
  }
  if (process.env.MODUS === 'dump-fehler') {
    console.error('pg_dump: error: connection to server failed');
    process.exit(2);
  }
  const stelle = args.indexOf('--file');
  if (stelle < 0) process.exit(91);
  // JEDER LAUF SCHREIBT ANDERE BYTES — sonst wäre ein überschriebener Dump von einem unberührten
  // nicht zu unterscheiden, und alles Weitere dieser Datei wäre wertlos.
  fs.writeFileSync(args[stelle + 1], process.env.DUMP_INHALT);
  process.exit(0);
}

if (name === 'pg_restore') {
  if (!args.includes('--list')) process.exit(92);
  const ziel = args[args.length - 1];
  if (!fs.existsSync(ziel)) process.exit(93);
  process.stdout.write(';\n; Archive created by pg_dump attrappe\n;\n');
  process.exit(0);
}

if (name === 'sort') {
  // T3: sort läuft AUSSCHLIESSLICH in der Aufbewahrung, also nach der Veröffentlichung. Wer hier
  // steht, hat veröffentlicht und beginnt aufzuräumen. Ohne diesen Treffpunkt entschiede die
  // Maschine, ob der zweite Lauf noch läuft, während der erste aufräumt — und der Fall wäre je
  // nach Last ein anderer.
  if (process.env.TREFF_AUFBEWAHRUNG) barriere('vor-aufbewahrung');
  const r = require('node:child_process').spawnSync(process.env.SORT_ECHT, args, { stdio: 'inherit' });
  process.exit(r.status === null ? 96 : r.status);
}

if (name === 'mv') {
  const erst = String(args[0]);
  const istSidecar = erst.endsWith('.dump.partial.sha256');
  const istDump = erst.endsWith('.dump.partial');
  // DIE FESTGELEGTE REIHENFOLGE GEHOERT ZU DEN BARRIEREN und faellt mit ihnen weg. In der Staffel
  // (P4) und bei einem einzelnen Lauf (P5) gibt es keinen zweiten Prozess, auf den zu warten waere;
  // wer dort trotzdem auf 'dump-fertig-b' wartete, sass die volle Frist ab und machte den Fall
  // dreissig Sekunden lang langsam, ohne irgendetwas zu messen.
  if (!process.env.OHNE_BARRIEREN) {
    if (istSidecar) {
      // T2: beide stehen unmittelbar hinter der Belegtprüfung des alten Standes.
      barriere('vor-veroeffentlichung');
      // Festgelegte Reihenfolge: Sidecar A zuerst, Sidecar B danach.
      if (rolle !== 'a') {
        warte('sidecar-a', () => fs.existsSync(path.join(treff, 'sidecar-fertig-a')));
      }
    }
    if (istDump && !istSidecar) {
      // Festgelegte Reihenfolge: Dump B zuerst, Dump A danach.
      if (rolle === 'a') warte('dump-b', () => fs.existsSync(path.join(treff, 'dump-fertig-b')));
    }
  }
  const muster = process.env.MV_FEHLER_MUSTER || '';
  if (muster !== '' && erst.endsWith(muster)) {
    console.error('mv: attrappe verweigert ' + erst + ' (Pruefstand JOB 4227)');
    process.exit(Number(process.env.MV_FEHLER_EXIT || '8'));
  }
  const r = require('node:child_process').spawnSync(process.env.MV_ECHT, args, { stdio: 'inherit' });
  if (istSidecar) melde('sidecar-fertig-' + rolle);
  if (istDump && !istSidecar) {
    melde('dump-fertig-' + rolle);
    // T2b, nur für die Aufbewahrungsfälle: KEIN Lauf verlässt die Veröffentlichung, bevor alle
    // veröffentlicht haben. Ohne das entschiede die Maschine, ob der zweite Lauf das Paar des
    // ersten überhaupt schon sieht, wenn er seine Bestandsliste bildet — und die Aufbewahrung
    // prüfte dann mal zwei und mal drei Sicherungen.
    if (process.env.TREFF_AUFBEWAHRUNG) barriere('nach-veroeffentlichung');
  }
  process.exit(r.status === null ? 96 : r.status);
}

process.exit(94);
`;

export interface Teilnehmer {
  /** `"a"` oder `"b"` — legt die Reihenfolge hinter dem Treffpunkt fest (siehe Kopf). */
  readonly rolle: "a" | "b";
  /** Der Dumpinhalt dieses Laufs. Muss sich von dem des anderen unterscheiden. */
  readonly inhalt: string;
  /** `pg_dump` scheitert — Abbruch NACH der Reservierung, VOR der Veröffentlichung. */
  readonly dumpFehler?: boolean;
  /**
   * Ein ECHTES Signal von aussen an den laufenden `backup.sh`-Prozess, sobald er seine Reservierung
   * hält und in `pg_dump` steht. Der Lauf bricht damit zwischen Reservierung und Veröffentlichung ab.
   */
  readonly abbruchSignal?: "SIGTERM" | "SIGINT" | "SIGHUP";
  /** `null` = weder `KLARWERK_DATABASE_URL` noch `DATABASE_URL` — Abbruch VOR der Reservierung. */
  readonly dbUrl?: string | null;
  /** `mv` verweigert die Aufrufe, deren erstes Argument so endet. */
  readonly mvFehltBei?: string;
  readonly mvFehlerExit?: number;
  /** Wert für `BACKUP_KEEP`; fehlt der Schlüssel, ist die Variable NICHT gesetzt. */
  readonly keep?: string;
  /**
   * Treffpunkt T3: dieser Lauf wartet zu Beginn der Aufbewahrung auf die anderen. Nur sinnvoll,
   * wenn ALLE Teilnehmer ein `keep` haben — sonst kommt einer dort nie an.
   */
  readonly treffpunktAufbewahrung?: boolean;
  /**
   * ALLE Barrieren aus. Nötig für die Staffel: dort ist die eine Verschränkung erwünscht, und eine
   * Barriere, auf die der wartende Lauf nie kommt, wäre ein Klemmer statt einer Messung.
   */
  readonly ohneBarrieren?: boolean;
  /**
   * DIE STAFFEL: dieser Lauf hält unmittelbar VOR seinem reservierenden `mkdir` an und läuft erst
   * weiter, wenn der andere Lauf vollständig beendet ist. Das ist BENs gemessene Verschränkung.
   */
  readonly staffelWartet?: boolean;
}

export interface EinzelLauf {
  readonly rolle: "a" | "b";
  readonly inhalt: string;
  readonly code: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly ausgabe: string;
  /** Der Pfad aus der Zeile `[backup] Dump nach: …` — der Name, den dieser Lauf ANKÜNDIGT. */
  readonly angekuendigt: string | undefined;
  /** Der Endname aus `[backup] Dump nach: …`, ohne Verzeichnis. */
  readonly angekuendigterName: string | undefined;
  /** Die sha256 aus der Zeile `[backup] fertig — … sha256=…` — was dieser Lauf MELDET. */
  readonly gemeldeteSumme: string | undefined;
}

export interface ParallelErgebnis {
  readonly laeufe: readonly EinzelLauf[];
  /** Alle Namen im Zielverzeichnis, sortiert — Verzeichnisse eingeschlossen. */
  readonly dateien: readonly string[];
  /** Inhalt jeder REGULÄREN Datei im Zielverzeichnis. */
  readonly inhalt: Readonly<Record<string, string>>;
  /** Die veröffentlichten Dumps (`klarwerk-*.dump`), sortiert. */
  readonly dumps: readonly string[];
  /** Liegen gebliebene Namensreservierungen (`*.dump.reserviert`). */
  readonly reservierungen: readonly string[];
  /** Marken abgelaufener Wartefristen — jede davon heisst: der Treffpunkt hat NICHT getragen. */
  readonly fristabläufe: readonly string[];
  /**
   * Rohtext von `letzter-lauf.json`, oder `undefined` wenn sie fehlt. ES GIBT NUR EINE: beide Läufe
   * schreiben dieselbe Datei, der zuletzt fertige gewinnt. Sie sagt also, was der LETZTE Lauf getan
   * hat — genau das, was sie auch im Betrieb sagt.
   */
  readonly ergebnisRoh: string | undefined;
  /** Ein Lauf nach seiner Rolle. */
  readonly nach: (rolle: "a" | "b") => EinzelLauf;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function sidecarZeile(inhalt: string, endname: string): string {
  return `${sha256(inhalt)}  ${endname}\n`;
}

/**
 * Ein Altpaar (Dump + Sidecar) im Zielverzeichnis, für die Aufbewahrungsfälle.
 *
 * `schaden` macht es zu einem BESCHÄDIGTEN Paar (JOB 4227 R3, Befund BEN R2): Dump und Sidecar
 * liegen da, gehören aber nicht zusammen. Bis Runde 2 zählte das Skript so eines als vollständige
 * Sicherung — und löschte dafür eine gültige ältere.
 */
export interface Altpaar {
  readonly stempel: string;
  readonly schaden?: "hash" | "form" | "fremder-name";
}

export function altInhalt(stempel: string): string {
  return `PGDMP altbestand ${stempel}\n`;
}

/**
 * DER ARBEITSSTAND EINES FREMDEN LAUFS — als ECHTE Datei mit Inhalt, nicht als Behauptung.
 *
 * BEN R1 (Korrekturpflicht 2) hat genau hier die Lücke gefunden: der alte Fall legte gar keine
 * fremde `.partial` an, und eine leere Resteliste belegt deren Schutz nicht. Sie muss dastehen,
 * bevor der Lauf beginnt, und hinterher BYTEGLEICH dieselbe sein.
 */
export interface FremderArbeitsstand {
  /** Zeitstempel im Format des Skripts. `STEMPEL` trifft genau den Arbeitsnamen dieser Sekunde. */
  readonly stempel: string;
  /** Mit Nummer, z. B. `"_02"` — sonst der Grundname. */
  readonly nummer?: string;
}

export function fremderArbeitsstandName(fremd: FremderArbeitsstand): string {
  return `klarwerk-${fremd.stempel}${fremd.nummer ?? ""}.dump.partial`;
}

export function fremdInhalt(fremd: FremderArbeitsstand): string {
  return `PGDMP fremder arbeitsstand ${fremd.stempel}${fremd.nummer ?? ""}\n`;
}

function baueBin(sonde: string, teil: Teilnehmer): string {
  const bin = join(sonde, `bin-${teil.rolle}`);
  mkdirSync(bin);
  writeFileSync(join(bin, "package.json"), JSON.stringify({ type: "commonjs" }));
  for (const name of ["pg_dump", "pg_restore", "date", "mv", "sort", "mkdir"]) {
    writeFileSync(join(bin, name), `#!${process.execPath}\n${ATTRAPPE}`, { mode: 0o755 });
  }
  for (const name of BASISWERKZEUGE) {
    if (name === "date" || name === "mv" || name === "sort" || name === "mkdir") continue;
    const echt = finde(name);
    if (echt !== undefined) symlinkSync(echt, join(bin, name));
  }
  return bin;
}

/**
 * ZWEI ECHTE `backup.sh`-PROZESSE, gleichzeitig, im SELBEN Zielverzeichnis, mit derselben
 * namensbildenden Sekunde und unterschiedlichem Dumpinhalt.
 */
export async function parallelLauf(
  teilnehmer: readonly Teilnehmer[],
  altbestand: readonly Altpaar[] = [],
  fremdeArbeitsstaende: readonly FremderArbeitsstand[] = [],
): Promise<ParallelErgebnis> {
  if (BASH === undefined) throw new Error("Prüfstand ohne bash im PATH");
  const echtesMv = finde("mv");
  if (echtesMv === undefined) throw new Error("Prüfstand ohne mv im PATH");
  const echtesSort = finde("sort");
  if (echtesSort === undefined) throw new Error("Prüfstand ohne sort im PATH");
  const echtesMkdir = finde("mkdir");
  if (echtesMkdir === undefined) throw new Error("Prüfstand ohne mkdir im PATH");
  const sonde = mkdtempSync(join(tmpdir(), "klarwerk-backup-parallel-"));
  try {
    const ziel = join(sonde, "ziel");
    const treff = join(sonde, "treff");
    mkdirSync(ziel);
    mkdirSync(treff);
    for (const paar of altbestand) {
      const endname = `klarwerk-${paar.stempel}.dump`;
      const inhalt = altInhalt(paar.stempel);
      writeFileSync(join(ziel, endname), inhalt);
      writeFileSync(
        join(ziel, `${endname}.sha256`),
        paar.schaden === undefined
          ? sidecarZeile(inhalt, endname)
          : beschaedigteSidecarzeile({ stempel: paar.stempel, art: paar.schaden }, endname),
      );
    }
    for (const fremd of fremdeArbeitsstaende) {
      // MIT INHALT und MIT Sidecar-Rest: genau das, was ein abgestürzter oder noch laufender
      // fremder Lauf hinterlässt. Beides muss der Lauf unberührt lassen.
      const name = fremderArbeitsstandName(fremd);
      writeFileSync(join(ziel, name), fremdInhalt(fremd));
      writeFileSync(join(ziel, `${name}.sha256`), sidecarZeile(fremdInhalt(fremd), name));
    }

    const gestartet = teilnehmer.map((teil) => {
      const bin = baueBin(sonde, teil);
      const umgebung: Record<string, string> = {
        PATH: bin,
        HOME: sonde,
        LC_ALL: "C",
        TREFFPUNKT: treff,
        ROLLE: teil.rolle,
        TEILNEHMER: String(teilnehmer.length),
        FESTER_STEMPEL: STEMPEL,
        DUMP_INHALT: teil.inhalt,
        MV_ECHT: echtesMv,
        SORT_ECHT: echtesSort,
        MKDIR_ECHT: echtesMkdir,
      };
      if (teil.treffpunktAufbewahrung === true) umgebung.TREFF_AUFBEWAHRUNG = "ja";
      if (teil.ohneBarrieren === true) umgebung.OHNE_BARRIEREN = "ja";
      if (teil.staffelWartet === true) umgebung.STAFFEL_WARTET = "ja";
      if (teil.dumpFehler === true) umgebung.MODUS = "dump-fehler";
      if (teil.abbruchSignal !== undefined) umgebung.WARTE_AUF_SIGNAL = "ja";
      const url = teil.dbUrl === undefined ? "postgres://pruef@127.0.0.1:5432/db" : teil.dbUrl;
      if (url !== null) umgebung.KLARWERK_DATABASE_URL = url;
      if (teil.keep !== undefined) umgebung.BACKUP_KEEP = teil.keep;
      if (teil.mvFehltBei !== undefined) {
        umgebung.MV_FEHLER_MUSTER = teil.mvFehltBei;
        umgebung.MV_FEHLER_EXIT = String(teil.mvFehlerExit ?? 8);
      }
      const kind = spawn(BASH, [SKRIPT, ziel], { cwd: tmpdir(), env: umgebung });
      return { teil, kind };
    });

    // Wer ein Signal bekommen soll, bekommt es, sobald er seine Reservierung hält und in `pg_dump`
    // steht — die Marke `bereit-<rolle>` sagt das. Geschossen wird von aussen, wie ein Strg-C.
    for (const { teil, kind } of gestartet) {
      if (teil.abbruchSignal === undefined) continue;
      await warteAufMarke(join(treff, `bereit-${teil.rolle}`));
      kind.kill(teil.abbruchSignal);
      writeFileSync(join(treff, `geschossen-${teil.rolle}`), teil.abbruchSignal);
    }

    const laeufe = await Promise.all(gestartet.map(({ teil, kind }) => ende(teil, kind, treff)));

    const dateien = readdirSync(ziel).sort();
    const inhalt: Record<string, string> = {};
    for (const name of dateien) {
      if (statSync(join(ziel, name)).isFile())
        inhalt[name] = readFileSync(join(ziel, name), "utf8");
    }
    return {
      laeufe,
      dateien,
      inhalt,
      dumps: dateien.filter((n) => /^klarwerk-.*\.dump$/.test(n)),
      reservierungen: dateien.filter((n) => n.endsWith(".reserviert")),
      ergebnisRoh: inhalt["letzter-lauf.json"],
      fristabläufe: readdirSync(treff).filter((n) => n.startsWith("frist-abgelaufen-")),
      nach: (rolle) => {
        const treffer = laeufe.find((l) => l.rolle === rolle);
        if (treffer === undefined) throw new Error(`kein Lauf mit Rolle ${rolle}`);
        return treffer;
      },
    };
  } finally {
    rmSync(sonde, { recursive: true, force: true });
  }
}

const DUMP_NACH = "[backup] Dump nach: ";

/** Wartet, bis die Marke da ist. Ein Ausbleiben ist ein Fehler des Prüfstands und sagt das laut. */
async function warteAufMarke(pfad: string, frist = 30_000): Promise<void> {
  const bis = Date.now() + frist;
  while (!existsSync(pfad)) {
    if (Date.now() > bis) throw new Error(`Marke ${pfad} blieb aus — der Treffpunkt trug nicht`);
    await new Promise((weiter) => setTimeout(weiter, 10));
  }
}

function ende(teil: Teilnehmer, kind: ChildProcess, treff: string): Promise<EinzelLauf> {
  return new Promise((fertig, scheitern) => {
    let stdout = "";
    let stderr = "";
    kind.stdout?.on("data", (stueck: Buffer) => {
      stdout += stueck.toString("utf8");
    });
    kind.stderr?.on("data", (stueck: Buffer) => {
      stderr += stueck.toString("utf8");
    });
    kind.on("error", scheitern);
    kind.on("close", (code, signal) => {
      // Der andere Lauf darf nicht auf einen Prozess warten, den es nicht mehr gibt. Diese Marke
      // löst jedes Warten sofort auf — ohne sie stünde ein Abbruchfall bis zur Frist.
      writeFileSync(join(treff, `ende-${teil.rolle}`), String(code));
      const zeile = stdout.split("\n").find((z) => z.startsWith(DUMP_NACH));
      const pfad = zeile === undefined ? undefined : zeile.slice(DUMP_NACH.length).trim();
      const summe = /sha256=([0-9a-f]{64})/.exec(stdout);
      fertig({
        rolle: teil.rolle,
        inhalt: teil.inhalt,
        code,
        signal,
        stdout,
        stderr,
        ausgabe: stdout + stderr,
        angekuendigt: pfad,
        angekuendigterName: pfad === undefined ? undefined : (pfad.split("/").pop() ?? undefined),
        gemeldeteSumme: summe?.[1],
      });
    });
  });
}

/**
 * Prüft ein veröffentlichtes Paar gegen seinen Sidecar: 64 Hex, zwei Leerzeichen, DER EIGENE
 * Endname — und der Hash wird nachgerechnet, nicht nur verglichen.
 */
export function paarIstStimmig(ergebnis: ParallelErgebnis, endname: string): boolean {
  const dump = ergebnis.inhalt[endname];
  const sidecar = ergebnis.inhalt[`${endname}.sha256`];
  if (dump === undefined || sidecar === undefined) return false;
  return sidecar === sidecarZeile(dump, endname);
}

/** Existiert die Datei `${endname}` und trägt sie genau den Inhalt dieses Laufs? */
export function dumpGehoertZuLauf(ergebnis: ParallelErgebnis, lauf: EinzelLauf): boolean {
  if (lauf.angekuendigterName === undefined) return false;
  return ergebnis.inhalt[lauf.angekuendigterName] === lauf.inhalt;
}
