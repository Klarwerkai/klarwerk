// ================================================================================================
// LIEGT DIESER ARBEITSBAUM UNTER EINER DATEISYNCHRONISATION? — DIAGNOSE AN DER WIRKUNG.
// ================================================================================================
//
// Aufnahme 20260922 · Arbeitsordner-Synchronisation (R-1303, R-1982 = OFFEN N6, R-2190).
//
// R-1303 woertlich: *„Die Arbeitsstaende duerfen nicht in einem synchronisierten Cloud-Ordner
// liegen; sonst entstehen laufend Doppel-Dateien und Datenverlust - in einer Nacht waren es 30. Das
// Einrichten warnt davor, und ein Diagnosewaechter erkennt den Fall."* Die Warnung beim Einrichten
// steht seit JOB 1114 in `PROJECT_CONTEXT/12_ONBOARDING_NEUER_MITARBEITER.md` (Waechter:
// `tests/app/icloud-onboarding-warnung.test.ts`). Dieses Werkzeug ist der zweite Teil: es erkennt
// den Fall an einem BESTEHENDEN Arbeitsbaum.
//
// ================================================================================================
// WARUM AN DER WIRKUNG UND NICHT AM PFAD
// ================================================================================================
//
// JOB 914 hat den Pfadtest ausprobiert und ihn scheitern sehen: bei „Schreibtisch & Dokumente“
// fuehrt macOS `~/Documents` unter seinem alten Pfad, die Probe auf `com~apple~CloudDocs` sagt
// NEIN, obwohl 611 bzw. 1003 Duplikate vorlagen. Der Pfad ist hier deshalb nur ein HINWEIS und
// entscheidet nichts. Entschieden wird an zwei Wirkungen, die die Synchronisation hinterlaesst:
//
//   DUPLIKAT     `X 2.ext` neben `X.ext`, beide lokal vorhanden und BYTEWEISE gleich. Ein bloss
//                aehnlicher Name genuegt nicht — in JOB 914 waren 20 Treffer nicht byte-identisch
//                und zaehlten zu Recht nicht. Gesucht wird ausdruecklich auch in `.git`, denn dort
//                lagen `gitdir 2`, `ORIG_HEAD 2` und `commondir 2`.
//   AUSGELAGERT  Eine Datei, deren Inhalt nur noch in der Wolke liegt: Groesse ueber null bei null
//                belegten Bloecken (Kennzeichen aus F-1293; `ls -lO` zeigt dort `dataless`).
//                Grenze: eine absichtlich spaerliche Datei traegt dasselbe Kennzeichen. In einem
//                Quellbaum ist das selten; die Rueckholliste nennt jeden Pfad zum Nachsehen.
//
// ================================================================================================
// LESEN IST KEINE LESEPROBE (F-1293)
// ================================================================================================
//
// Wer eine ausgelagerte Datei oeffnet, loest ihren Download aus — und misst danach den Zustand,
// den er selbst hergestellt hat. Dieses Werkzeug liest deshalb nur Metadaten (`lstat`,
// Verzeichnislisten) und oeffnet eine Datei NUR fuer den Bytevergleich zweier Duplikat-Kandidaten,
// und auch das nur, wenn BEIDE lokal vorliegen. Ist einer ausgelagert, bleibt das Paar
// UNVERGLICHEN und wird so gemeldet. Zurueckgeholt wird nichts von selbst: das Werkzeug druckt die
// Rueckholliste, die Entscheidung trifft der Mensch (wie bei der Migration im Onboarding).
//
// ================================================================================================
// R-2190 — PLATTEN- UND DATEIZUGRIFFSAUSFAELLE NACHVOLLZIEHEN
// ================================================================================================
//
// Der Befund B21 (CODEX-ANALYSE-1) nennt reale Vorfaelle: ENOSPC, unlesbare Dateien unter
// `~/Documents`, Lesefehler „Resource deadlock avoided“ (EDEADLK) an ausgelagerten Dateien. Damit
// ein solcher Ausfall nachvollziehbar wird, haelt jeder Lauf fest:
//   · jeden Zugriffsfehler mit Pfad und Fehlercode, statt ihn zu verschlucken und still weniger
//     zu zaehlen;
//   · den freien Platz des Datentraegers (`statfs`), mit Warnung unterhalb der Schwelle;
//   · auf Wunsch (`--protokoll <datei>`) eine JSON-Zeile mit Zeitpunkt, damit spaetere Laeufe den
//     Verlauf zeigen. Das Protokoll wird nur angehaengt, nie ueberschrieben.
//
// AUFRUFER: `tools/check` ueber `tools/arbeitsordner-diagnose.sh`. Dort MELDET der Waechter und
// sperrt nicht (Begruendung dort). Direkt aufrufbar fuer jeden anderen Ordner: Argument = Wurzel.
//
// KEINE LAUFZEITABHAENGIGKEIT DES PRODUKTS: nicht gebuendelt, nicht beim Start ausgefuehrt.

import {
  type Stats,
  appendFileSync,
  closeSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  statfsSync,
} from "node:fs";
import { join, relative } from "node:path";

const WURZEL = join(import.meta.dirname, "..");

/** Verzeichnisse, die nicht durchlaufen werden. `.git` gehoert ausdruecklich NICHT dazu. */
export const UEBERSPRUNGEN = new Set(["node_modules"]);

/** Unterhalb dieser freien Kapazitaet warnt der Bericht (ENOSPC-Vorfall vom 25.08.). */
export const PLATZ_WARNSCHWELLE_BYTES = 5 * 1024 ** 3;

/** Pfadteile, die auf einen synchronisierten Ort HINWEISEN — ausdruecklich kein Beleg. */
const SYNC_PFADTEILE = [
  "/Library/Mobile Documents/",
  "/Library/CloudStorage/",
  "/Dropbox/",
  "/OneDrive",
];

export interface Duplikat {
  pfad: string;
  original: string;
}

export interface Unverglichen {
  pfad: string;
  original: string;
  grund: string;
}

export interface Zugriffsfehler {
  pfad: string;
  code: string;
  meldung: string;
}

export interface Plattenplatz {
  freiBytes: number;
  gesamtBytes: number;
  knapp: boolean;
}

export interface Diagnose {
  wurzel: string;
  zeitpunkt: string;
  dateien: number;
  duplikate: Duplikat[];
  unverglichen: Unverglichen[];
  ausgelagert: string[];
  zugriffsfehler: Zugriffsfehler[];
  platz: Plattenplatz | Zugriffsfehler;
  pfadHinweis: string | null;
}

export type Urteil = "SYNCHRONISATION_ERKANNT" | "UNVOLLSTAENDIG" | "KEIN_HINWEIS";

/** Rueckgabewerte des Starters, je Urteil. */
export const EXITCODE: Record<Urteil, number> = {
  KEIN_HINWEIS: 0,
  SYNCHRONISATION_ERKANNT: 1,
  UNVOLLSTAENDIG: 2,
};

type Metadaten = Pick<Stats, "size" | "blocks"> & { isFile(): boolean };

/**
 * Der Name ohne Synchronisationszusatz, oder `null`, wenn er keinen traegt.
 *
 * iCloud haengt ` 2`, ` 3` … VOR die letzte Endung: `X.ext` → `X 2.ext`,
 * `ORIG_HEAD` → `ORIG_HEAD 2`. Ob es wirklich ein Duplikat ist, entscheidet erst der Bytevergleich.
 */
export function originalName(name: string): string | null {
  const treffer = /^(.+?) ([2-9]|[1-9]\d+)(\.[^. ]+)?$/.exec(name);
  if (!treffer) return null;
  return `${treffer[1]}${treffer[3] ?? ""}`;
}

/** Kennzeichen einer ausgelagerten Datei: Groesse ueber null, aber kein einziger belegter Block. */
export function istAusgelagert(st: Metadaten): boolean {
  return st.isFile() && st.size > 0 && st.blocks === 0;
}

function alsZugriffsfehler(pfad: string, e: unknown): Zugriffsfehler {
  const fehler = e as NodeJS.ErrnoException;
  return { pfad, code: fehler.code ?? "UNBEKANNT", meldung: fehler.message ?? String(e) };
}

/** Der Dateizugriff des Bytevergleichs — austauschbar, damit der Test Ausfaelle nachstellen kann. */
export interface Dateizugriff {
  oeffne(pfad: string): number;
  lies(fd: number, puffer: Buffer): number;
  schliesse(fd: number): void;
}

export const NODE_DATEIZUGRIFF: Dateizugriff = {
  oeffne: (pfad) => openSync(pfad, "r"),
  lies: (fd, puffer) => readSync(fd, puffer, 0, puffer.length, null),
  schliesse: (fd) => closeSync(fd),
};

/** Ein Ausfall beim Vergleich — mit dem Pfad der Datei, an der er WIRKLICH auftrat. */
export interface Vergleichsausfall {
  pfad: string;
  fehler: unknown;
}

/**
 * Bytevergleich in Bloecken — beide Dateien muessen lokal vorliegen (vom Aufrufer geprueft).
 *
 * Ben, Nacharbeit 2: vorher wurden beide Dateien VOR dem try/finally geoeffnet. Scheiterte das
 * Oeffnen des Originals, blieb der Deskriptor der Kopie offen, und der Aufrufer schrieb den Fehler
 * dem Kopienpfad zu. Jetzt wird jeder erfolgreich geoeffnete Deskriptor im finally geschlossen, und
 * ein Ausfall nennt die Datei, an der Oeffnen oder Lesen gescheitert ist (R-2190).
 */
export function byteGleich(
  a: string,
  b: string,
  zugriff: Dateizugriff = NODE_DATEIZUGRIFF,
): boolean | Vergleichsausfall {
  let fa: number | undefined;
  let fb: number | undefined;
  let betroffen = a;
  try {
    fa = zugriff.oeffne(a);
    betroffen = b;
    fb = zugriff.oeffne(b);
    const pa = Buffer.alloc(64 * 1024);
    const pb = Buffer.alloc(64 * 1024);
    for (;;) {
      betroffen = a;
      const na = zugriff.lies(fa, pa);
      betroffen = b;
      const nb = zugriff.lies(fb, pb);
      if (na !== nb) return false;
      if (na === 0) return true;
      if (!pa.subarray(0, na).equals(pb.subarray(0, nb))) return false;
    }
  } catch (e) {
    return { pfad: betroffen, fehler: e };
  } finally {
    if (fa !== undefined) zugriff.schliesse(fa);
    if (fb !== undefined) zugriff.schliesse(fb);
  }
}

function messePlatz(wurzel: string): Plattenplatz | Zugriffsfehler {
  try {
    const fs = statfsSync(wurzel);
    const freiBytes = fs.bavail * fs.bsize;
    const gesamtBytes = fs.blocks * fs.bsize;
    return { freiBytes, gesamtBytes, knapp: freiBytes < PLATZ_WARNSCHWELLE_BYTES };
  } catch (e) {
    return alsZugriffsfehler(wurzel, e);
  }
}

function pfadHinweis(wurzel: string): string | null {
  let echt = wurzel;
  try {
    echt = realpathSync(wurzel);
  } catch {
    // Ein Zugriffsfehler auf die Wurzel steht ohnehin in der Diagnose; der Hinweis ist Beiwerk.
  }
  const teil = SYNC_PFADTEILE.find((t) => `${echt}/`.includes(t));
  return teil ? `${echt} enthaelt „${teil}“` : null;
}

/** Die Diagnose eines Ordners. Liest Metadaten; Dateiinhalte nur fuer lokale Duplikat-Paare. */
export function diagnostiziere(
  wurzel: string,
  zugriff: Dateizugriff = NODE_DATEIZUGRIFF,
): Diagnose {
  const diagnose: Diagnose = {
    wurzel,
    zeitpunkt: new Date().toISOString(),
    dateien: 0,
    duplikate: [],
    unverglichen: [],
    ausgelagert: [],
    zugriffsfehler: [],
    platz: messePlatz(wurzel),
    pfadHinweis: pfadHinweis(wurzel),
  };
  const rel = (p: string) => relative(wurzel, p) || ".";
  const dateien = new Map<string, Stats>();
  const kandidaten: Duplikat[] = [];

  const offen = [wurzel];
  while (offen.length > 0) {
    const ordner = offen.pop() as string;
    let namen: string[];
    try {
      namen = readdirSync(ordner);
    } catch (e) {
      diagnose.zugriffsfehler.push(alsZugriffsfehler(rel(ordner), e));
      continue;
    }
    for (const name of namen) {
      const pfad = join(ordner, name);
      let st: Stats;
      try {
        st = lstatSync(pfad);
      } catch (e) {
        diagnose.zugriffsfehler.push(alsZugriffsfehler(rel(pfad), e));
        continue;
      }
      if (st.isDirectory()) {
        if (!UEBERSPRUNGEN.has(name)) offen.push(pfad);
        continue;
      }
      if (!st.isFile()) continue;
      diagnose.dateien += 1;
      dateien.set(pfad, st);
      if (istAusgelagert(st)) diagnose.ausgelagert.push(rel(pfad));
      const original = originalName(name);
      if (original !== null) kandidaten.push({ pfad, original: join(ordner, original) });
    }
  }

  for (const { pfad, original } of kandidaten) {
    const a = dateien.get(pfad);
    const b = dateien.get(original);
    // Kein Original daneben oder verschiedene Groesse: kein Duplikat, nur ein aehnlicher Name.
    if (!a || !b || a.size !== b.size) continue;
    if (istAusgelagert(a) || istAusgelagert(b)) {
      const grund = "ausgelagert — Lesen wuerde den Download ausloesen";
      diagnose.unverglichen.push({ pfad: rel(pfad), original: rel(original), grund });
      continue;
    }
    const gleich = byteGleich(pfad, original, zugriff);
    if (gleich === true) {
      diagnose.duplikate.push({ pfad: rel(pfad), original: rel(original) });
    } else if (gleich !== false) {
      diagnose.zugriffsfehler.push(alsZugriffsfehler(rel(gleich.pfad), gleich.fehler));
    }
  }

  diagnose.duplikate.sort((x, y) => x.pfad.localeCompare(y.pfad));
  diagnose.ausgelagert.sort();
  return diagnose;
}

/**
 * Das Urteil. Die Wirkung entscheidet, der Pfad nie.
 *
 * KEIN_HINWEIS heisst ausdruecklich NICHT „keine Synchronisation“: ein frisch geklonter Baum unter
 * einer aktiven Synchronisation hat noch keine Duplikate. Das sagt die Ausgabe dazu.
 */
export function urteil(d: Diagnose): Urteil {
  if (d.duplikate.length > 0 || d.ausgelagert.length > 0) return "SYNCHRONISATION_ERKANNT";
  if (d.zugriffsfehler.length > 0 || d.unverglichen.length > 0) return "UNVOLLSTAENDIG";
  return "KEIN_HINWEIS";
}

function gib(n: number): string {
  return `${(n / 1024 ** 3).toFixed(1)} GiB`;
}

const LISTE_HOECHSTENS = 20;

function liste(zeilen: string[]): string[] {
  const kopf = zeilen.slice(0, LISTE_HOECHSTENS).map((z) => `     ${z}`);
  const rest = zeilen.length - LISTE_HOECHSTENS;
  if (rest > 0) kopf.push(`     … und ${rest} weitere (vollstaendig mit --json)`);
  return kopf;
}

/** Der lesbare Bericht. Jede Zahl steht in JEDEM Ausgang da — auch die Nullen. */
export function bericht(d: Diagnose): string[] {
  const z: string[] = [];
  const zahlen = [
    `${d.dateien} Dateien gelesen (nur Metadaten)`,
    `${d.duplikate.length} byte-identische Sync-Duplikate`,
    `${d.ausgelagert.length} ausgelagert`,
    `${d.unverglichen.length} unverglichen`,
    `${d.zugriffsfehler.length} Zugriffsfehler`,
  ];
  z.push(`Arbeitsordner: ${d.wurzel}`);
  z.push(`  ${zahlen.join(" · ")}`);
  if ("freiBytes" in d.platz) {
    const knapp = d.platz.knapp
      ? ` — KNAPP (unter ${gib(PLATZ_WARNSCHWELLE_BYTES)}; ENOSPC droht)`
      : "";
    const frei = `${gib(d.platz.freiBytes)} frei von ${gib(d.platz.gesamtBytes)}`;
    z.push(`  Datentraeger: ${frei}${knapp}`);
  } else {
    z.push(`  Datentraeger: nicht messbar (${d.platz.code}: ${d.platz.meldung})`);
  }
  if (d.pfadHinweis) z.push(`  Pfadhinweis (KEIN Beleg): ${d.pfadHinweis}`);
  if (d.duplikate.length > 0) {
    z.push("  Sync-Duplikate (byteweise gleich mit dem Original daneben):");
    z.push(...liste(d.duplikate.map((x) => `${x.pfad}  =  ${x.original}`)));
  }
  if (d.ausgelagert.length > 0) {
    const anteil = `${d.ausgelagert.length} von ${d.dateien} Dateien`;
    z.push(`  Ausgelagert — ${anteil} liegen nur in der Wolke (Groesse > 0, 0 Bloecke).`);
    z.push("  Rueckholliste:");
    z.push(...liste(d.ausgelagert));
    z.push("     Zurueckgeholt wird nichts von selbst. Auf deine Entscheidung: im Finder");
    z.push("     „Jetzt laden“ oder je Pfad `brctl download <pfad>`, danach die Diagnose erneut.");
  }
  if (d.unverglichen.length > 0) {
    z.push("  Unverglichene Paare (nicht geoeffnet, damit kein Download ausgeloest wird):");
    z.push(...liste(d.unverglichen.map((x) => `${x.pfad}  ?  ${x.original}  (${x.grund})`)));
  }
  if (d.zugriffsfehler.length > 0) {
    z.push("  Zugriffsfehler (Pfad · Code) — festgehalten statt verschluckt:");
    z.push(...liste(d.zugriffsfehler.map((x) => `${x.pfad} · ${x.code}`)));
  }
  const u = urteil(d);
  if (u === "SYNCHRONISATION_ERKANNT") {
    z.push("✎ Synchronisation an der Wirkung ERKANNT. Der Arbeitsbaum gehoert an einen Ort");
    z.push("  ohne Sync (z. B. ~/Projekte/…): erst alles pushen, dort neu klonen, den alten");
    z.push("  Ordner danach entfernen — PROJECT_CONTEXT/12_ONBOARDING_NEUER_MITARBEITER.md,");
    z.push("  Abschnitt „Migration eines bestehenden Ordners“.");
  } else if (u === "UNVOLLSTAENDIG") {
    z.push("✎ Keine Sync-Wirkung gefunden, aber NICHT vollstaendig gemessen (s. oben).");
  } else {
    z.push("✓ Keine Sync-Wirkung gefunden. Das belegt nicht, dass keine Synchronisation");
    z.push("  aktiv ist — ein frischer Klon hat noch keine Duplikate. Gewissheit gibt nur die");
    z.push("  Systemeinstellung (iCloud Drive → Optionen).");
  }
  return z;
}

/** Die Aufrufargumente: Wurzel, `--json`, `--protokoll <datei>`. */
export function argumente(args: string[]): { wurzel: string; json: boolean; protokoll?: string } {
  let wurzel = WURZEL;
  let json = false;
  let protokoll: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] as string;
    if (a === "--json") {
      json = true;
    } else if (a === "--protokoll") {
      protokoll = args[i + 1];
      i += 1;
    } else {
      wurzel = a;
    }
  }
  return protokoll === undefined ? { wurzel, json } : { wurzel, json, protokoll };
}

// Direktaufruf ueber tools/arbeitsordner-diagnose.sh — beim Import aus dem Test passiert hier nichts.
// Rueckgabewerte: s. `EXITCODE` (0 kein Hinweis · 1 erkannt · 2 unvollstaendig gemessen).
if (process.argv[1]?.endsWith("arbeitsordner-diagnose.ts")) {
  const { wurzel, json, protokoll } = argumente(process.argv.slice(2));
  const d = diagnostiziere(wurzel);
  const u = urteil(d);
  if (protokoll !== undefined) {
    appendFileSync(protokoll, `${JSON.stringify({ ...d, urteil: u })}\n`);
  }
  if (json) {
    console.log(JSON.stringify({ ...d, urteil: u }, null, 2));
  } else {
    for (const zeile of bericht(d)) console.log(zeile);
  }
  process.exit(EXITCODE[u]);
}
