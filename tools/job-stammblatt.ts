// ================================================================================================
// tools/job-stammblatt.ts — EIN BLATT JE AUFTRAG, UND EINE WACHE GEGEN DOPPELT VERGEBENE KENNUNGEN.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-job-stammblatt` (R-1492, R-1393). Abgleich und Grenzen stehen in
// `docs/entscheidungen/job-stammblatt.md`.
//
// R-1492 verlangt „zu jeder Jobnummer ein Blatt: Gegenstand, Welle oder Scheibe,
// Durchgangsgeschichte mit Urteilen, Integrations-Commit". Die Jobnummer des alten Relais gibt es
// heute nicht mehr. Ihr Gegenstück ist der Auftragsordner `auftrag-<kennung>/` der
// Produktionskoordination. Dieses Werkzeug liest ihn nur. Es steuert nichts, vergibt nichts und
// schreibt nichts; die verworfene alte Steuerung (`kw_naechster_durchgang.py`, Postfach,
// Rückgabedateien) wird nicht nachgebaut.
//
// GELESEN WIRD NUR, WAS IN BELEGTEN DATEIEN STEHT:
//   · `AUFTRAG.json`        kennung, title, base, branch, commit_title
//   · `AUFTRAG-B1.json`     id, revision, title, status, milestones, priority
//   · `auftragsstand.json`  auftrag.id, fortschritt (schritt, kandidat, naechster_schritt, lieferung)
//   · `HISTORIE/nacharbeit-<n>/`  archivierte Durchgänge mit `PRUEFUNG/` und `BEN/`
//   · `BEN/ANTWORT.json`    Bens strukturierte Antwort (Urteil `erfuellt`, `nacharbeit`, `offen`)
//   · Gitverlauf            Commits `<commit_title> (Hauptstand integriert)` und
//                           `<commit_title> (<Fassung>)`
//
// DAS BENURTEIL: `benurteilAus` nimmt das Urteil nur an, wenn genau ein Feld der obersten Ebene
// einen der drei Urteilswerte trägt. Kein Treffer oder mehrere verschiedene ergeben „kein Urteil
// lesbar“ mit Grund, nie ein geratenes Urteil. Im Schema `benurteil_v2` (Nacharbeit 1 belegt) ist
// das genau das Pflichtfeld `urteil`; ältere, nicht schemagerechte Antworten bleiben unlesbar.
//
// R-1393 („ein Protokoll soll verhindern, dass dieselbe Auftragsnummer zweimal vergeben wird"):
// Vergeben werden Kennungen in der Koordination, außerhalb des Produktbaums. Hier steht die Wache,
// die eine Doppelvergabe im Bestand meldet: dieselbe Auftrags-ID, Kennung, Branch oder
// derselbe Commit-Titel in mehr als einem Ordner. Mit einem Fund endet der Direktaufruf mit Exit 1.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Die Arbeitswurzel aus dem DATEIORT, nicht aus dem Prozessverzeichnis (cwd-Vertrag). */
export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const BENURTEILE = ["erfuellt", "nacharbeit", "offen"] as const;
export type Benurteil = (typeof BENURTEILE)[number];

export interface UrteilsLesung {
  urteil: Benurteil | null;
  /** Warum kein Urteil gelesen wurde; leer, wenn eines gelesen wurde. */
  grund: string;
}

export interface Durchgang {
  /** `HISTORIE/nacharbeit-<n>` oder `aktuell` — der Ordnername, ohne Deutung. */
  ort: string;
  pruefbericht: boolean;
  ben: UrteilsLesung;
}

export interface Integration {
  /** `<commit_title> (Hauptstand integriert)`, neuester zuerst. */
  integriert: string[];
  /** `<commit_title> (<Fassung>)`, neuester zuerst. */
  fassungen: Array<{ commit: string; fassung: string }>;
}

export interface Stammblatt {
  ordner: string;
  kennung: string | null;
  auftragId: string | null;
  revision: number | null;
  status: string | null;
  gegenstand: string | null;
  /** Gegenstück zu „Welle oder Scheibe": Meilensteine und Priorität aus `AUFTRAG-B1.json`. */
  meilensteine: string[];
  prioritaet: number | null;
  basis: string | null;
  branch: string | null;
  commitTitel: string | null;
  schritt: string | null;
  naechsterSchritt: string | null;
  kandidat: string | null;
  lieferung: unknown;
  durchgaenge: Durchgang[];
  integration: Integration | null;
  /** Widersprüche innerhalb des Ordners, im Wortlaut. */
  maengel: string[];
}

export interface Doppelvergabe {
  art: "auftrag-id" | "kennung" | "branch" | "commit-titel";
  wert: string;
  ordner: string[];
}

type Objekt = Record<string, unknown>;

function istObjekt(wert: unknown): wert is Objekt {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

function jsonAus(pfad: string): Objekt | null {
  if (!existsSync(pfad)) return null;
  try {
    const wert: unknown = JSON.parse(readFileSync(pfad, "utf8"));
    return istObjekt(wert) ? wert : null;
  } catch {
    return null;
  }
}

function text(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim() !== "" ? wert : null;
}

function zahl(wert: unknown): number | null {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

function istBenurteil(wert: unknown): wert is Benurteil {
  return typeof wert === "string" && (BENURTEILE as readonly string[]).includes(wert);
}

/**
 * Das Urteil aus Bens strukturierter Antwort — nur, wenn es eindeutig ist.
 *
 * Gelesen wird die oberste Ebene. Trägt genau ein Feld einen Urteilswert, ist das das Urteil.
 * Zwei Felder mit demselben Wert sind ebenfalls eindeutig, zwei verschiedene Werte nicht.
 */
export function benurteilAus(antwort: unknown): UrteilsLesung {
  if (!istObjekt(antwort)) return { urteil: null, grund: "keine lesbare Antwort" };
  const werte = new Set(Object.values(antwort).filter(istBenurteil));
  if (werte.size === 0) return { urteil: null, grund: "kein Urteilswert in der Antwort" };
  if (werte.size > 1) {
    return { urteil: null, grund: `mehrdeutig: ${[...werte].sort().join(", ")}` };
  }
  return { urteil: [...werte][0] ?? null, grund: "" };
}

function durchgangIn(ordner: string, ort: string): Durchgang {
  const antwortPfad = join(ordner, "BEN", "ANTWORT.json");
  return {
    ort,
    pruefbericht: existsSync(join(ordner, "PRUEFUNG", "PRUEFUNG.json")),
    ben: existsSync(antwortPfad)
      ? benurteilAus(jsonAus(antwortPfad))
      : { urteil: null, grund: "keine BEN/ANTWORT.json" },
  };
}

/** Archivierte Durchgänge numerisch geordnet, danach der laufende Stand des Ordners. */
export function durchgaengeIn(auftragsordner: string): Durchgang[] {
  const historie = join(auftragsordner, "HISTORIE");
  const archiv: Array<{ n: number; name: string }> = [];
  if (existsSync(historie)) {
    for (const name of readdirSync(historie)) {
      const t = /^nacharbeit-(\d+)$/.exec(name);
      if (t?.[1] && statSync(join(historie, name)).isDirectory()) {
        archiv.push({ n: Number(t[1]), name });
      }
    }
  }
  archiv.sort((a, b) => a.n - b.n);
  return [
    ...archiv.map((a) => durchgangIn(join(historie, a.name), `HISTORIE/${a.name}`)),
    durchgangIn(auftragsordner, "aktuell"),
  ];
}

/** Die Fassung hinter dem Titel: `(1.0.0-beta.1.981)`. */
const FASSUNG = /^\((\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\)$/;

/**
 * Integrations- und Fassungscommits eines Auftrags aus `git log --format=%H%x09%s`.
 *
 * Verglichen wird der vollständige Betreff mit dem Commit-Titel aus `AUFTRAG.json`; ein Titel, der
 * nur mit diesem beginnt, zählt nicht. `null` heißt: kein Commit-Titel bekannt.
 */
export function integrationAus(gitLog: string, commitTitel: string | null): Integration | null {
  if (commitTitel === null) return null;
  const integriert: string[] = [];
  const fassungen: Array<{ commit: string; fassung: string }> = [];
  for (const zeile of gitLog.split("\n")) {
    const tab = zeile.indexOf("\t");
    if (tab < 0) continue;
    const commit = zeile.slice(0, tab).trim();
    const betreff = zeile.slice(tab + 1).trim();
    if (!betreff.startsWith(`${commitTitel} (`)) continue;
    const zusatz = betreff.slice(commitTitel.length + 1);
    if (zusatz === "(Hauptstand integriert)") {
      integriert.push(commit);
      continue;
    }
    const fassung = FASSUNG.exec(zusatz)?.[1];
    if (fassung) fassungen.push({ commit, fassung });
  }
  return { integriert, fassungen };
}

/** Das Blatt eines Auftragsordners. `gitLog` leer lassen, wenn der Verlauf nicht vorliegt. */
export function stammblattVon(auftragsordner: string, gitLog: string | null = null): Stammblatt {
  const auftrag: Objekt = jsonAus(join(auftragsordner, "AUFTRAG.json")) ?? {};
  const b1: Objekt = jsonAus(join(auftragsordner, "AUFTRAG-B1.json")) ?? {};
  const stand: Objekt = jsonAus(join(auftragsordner, "auftragsstand.json")) ?? {};
  const fortschritt: Objekt = istObjekt(stand.fortschritt) ? stand.fortschritt : {};
  const standAuftrag: Objekt = istObjekt(stand.auftrag) ? stand.auftrag : {};

  const kennung = text(auftrag.kennung);
  const auftragId = text(b1.id);
  const commitTitel = text(auftrag.commit_title);
  const maengel: string[] = [];
  if (Object.keys(auftrag).length === 0) maengel.push("AUFTRAG.json fehlt oder ist unlesbar");
  if (Object.keys(b1).length === 0) maengel.push("AUFTRAG-B1.json fehlt oder ist unlesbar");
  if (kennung !== null && kennung !== basename(auftragsordner)) {
    maengel.push(`Ordnername ${basename(auftragsordner)} weicht von Kennung ${kennung} ab`);
  }
  const standId = text(standAuftrag.id);
  if (standId !== null && auftragId !== null && standId !== auftragId) {
    maengel.push(`auftragsstand.json nennt ${standId}, AUFTRAG-B1.json ${auftragId}`);
  }
  const standBranch = text(standAuftrag.branch);
  const branch = text(auftrag.branch);
  if (standBranch !== null && branch !== null && standBranch !== branch) {
    maengel.push(`auftragsstand.json nennt Branch ${standBranch}, AUFTRAG.json ${branch}`);
  }

  return {
    ordner: auftragsordner,
    kennung,
    auftragId,
    revision: zahl(b1.revision),
    status: text(b1.status),
    gegenstand: text(b1.title) ?? text(auftrag.title),
    meilensteine: Array.isArray(b1.milestones) ? b1.milestones.map((m) => String(m)) : [],
    prioritaet: zahl(b1.priority),
    basis: text(auftrag.base),
    branch,
    commitTitel,
    schritt: text(fortschritt.schritt),
    naechsterSchritt: text(fortschritt.naechster_schritt),
    kandidat: text(fortschritt.kandidat),
    lieferung: fortschritt.lieferung ?? null,
    durchgaenge: durchgaengeIn(auftragsordner),
    integration: gitLog === null ? null : integrationAus(gitLog, commitTitel),
    maengel,
  };
}

/** Alle Auftragsordner unter einer Wurzel: Unterordner mit `AUFTRAG.json` oder `AUFTRAG-B1.json`. */
export function auftragsordnerUnter(wurzel: string): string[] {
  if (!existsSync(wurzel)) return [];
  return readdirSync(wurzel)
    .map((name) => join(wurzel, name))
    .filter(
      (pfad) =>
        statSync(pfad).isDirectory() &&
        (existsSync(join(pfad, "AUFTRAG.json")) || existsSync(join(pfad, "AUFTRAG-B1.json"))),
    )
    .sort();
}

/**
 * Die Wache zu R-1393: jede Auftrags-ID, Kennung, jeder Branch und Commit-Titel, der in mehr als
 * einem Ordner steht. Ein gleicher Commit-Titel macht die Zuordnung der Integrationscommits
 * mehrdeutig und wird deshalb ebenso gemeldet.
 */
export function doppelvergaben(blaetter: readonly Stammblatt[]): Doppelvergabe[] {
  const arten: Array<[Doppelvergabe["art"], (b: Stammblatt) => string | null]> = [
    ["auftrag-id", (b) => b.auftragId],
    ["kennung", (b) => b.kennung],
    ["branch", (b) => b.branch],
    ["commit-titel", (b) => b.commitTitel],
  ];
  const funde: Doppelvergabe[] = [];
  for (const [art, wertVon] of arten) {
    const je = new Map<string, string[]>();
    for (const b of blaetter) {
      const wert = wertVon(b);
      if (wert === null) continue;
      je.set(wert, [...(je.get(wert) ?? []), b.ordner]);
    }
    for (const [wert, ordner] of je) {
      if (ordner.length > 1) funde.push({ art, wert, ordner });
    }
  }
  return funde;
}

const kurz = (sha: string | null): string => (sha === null ? "—" : sha.slice(0, 8));

const liste = (werte: readonly string[], leer: string): string =>
  werte.length > 0 ? werte.join(", ") : leer;

function durchgangText(d: Durchgang): string {
  const bericht = d.pruefbericht ? "ja  " : "nein";
  const urteil = d.ben.urteil ?? `— (${d.ben.grund})`;
  return `    ${d.ort.padEnd(24)} Prüfbericht ${bericht}  Benurteil ${urteil}`;
}

/** Das Blatt als lesbarer Text. */
export function alsText(b: Stammblatt): string {
  const revision = b.revision === null ? "" : ` (Revision ${b.revision})`;
  const status = b.status === null ? "" : ` · ${b.status}`;
  const zeilen = [
    `STAMMBLATT ${b.kennung ?? basename(b.ordner)}`,
    `  Auftrag:        ${b.auftragId ?? "—"}${revision}${status}`,
    `  Gegenstand:     ${b.gegenstand ?? "—"}`,
    `  Welle/Scheibe:  Meilensteine ${liste(b.meilensteine, "keine")} · Priorität ${b.prioritaet ?? "—"}`,
    `  Basis/Branch:   ${kurz(b.basis)} · ${b.branch ?? "—"}`,
    `  Stand:          Schritt ${b.schritt ?? "—"} · nächster ${b.naechsterSchritt ?? "—"}`,
    `  Kandidat:       ${kurz(b.kandidat)}`,
    "  Durchgänge:",
    ...b.durchgaenge.map(durchgangText),
  ];
  if (b.integration === null) {
    zeilen.push("  Integration:    nicht ermittelt (kein Gitverlauf oder kein Commit-Titel)");
  } else {
    const { integriert, fassungen } = b.integration;
    const fassung = fassungen.map((f) => `${f.fassung} (${kurz(f.commit)})`);
    zeilen.push(
      `  Integration:    ${liste(integriert.map(kurz), "kein Integrationscommit")}`,
      `  Fassung:        ${liste(fassung, "keine")}`,
    );
  }
  zeilen.push(`  Lieferung:      ${b.lieferung === null ? "—" : JSON.stringify(b.lieferung)}`);
  for (const m of b.maengel) zeilen.push(`  MANGEL:         ${m}`);
  return zeilen.join("\n");
}

function gitLogVon(wurzel: string, ref: string): string | null {
  try {
    return execFileSync("git", ["-C", wurzel, "log", "--format=%H%x09%s", ref], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

/**
 * Der Direktaufruf ohne Prozessende: gibt aus und liefert den Exitcode zurück.
 *
 * NACHARBEIT 1 (Ben, Echtbestand 14.10.2026): Vorher stand hier `process.exit(…)` direkt nach der
 * Ausgabe. In eine Pipe schreibt Node asynchron; `process.exit` beendet den Prozess, bevor der
 * Puffer geleert ist. Über die Pipe kamen von 2.153.824 Bytes (389 Blätter) nur 65.536 an, als
 * ungültiges JSON und mit Exit 0. Deshalb setzt der Aufrufer nur `process.exitCode`; Node beendet
 * sich erst, wenn die Ausgabe vollständig geschrieben ist.
 */
export function direktaufruf(argumente: readonly string[]): number {
  const refStelle = argumente.indexOf("--ref");
  const ref = refStelle >= 0 ? (argumente[refStelle + 1] ?? "main") : "main";
  const wurzel = argumente.find((a, i) => !a.startsWith("--") && argumente[i - 1] !== "--ref");
  if (wurzel === undefined) {
    console.log("Aufruf: node tools/job-stammblatt.ts <auftraege-wurzel> [--json] [--ref main]");
    return 2;
  }
  const ordner = existsSync(join(wurzel, "AUFTRAG.json")) ? [wurzel] : auftragsordnerUnter(wurzel);
  if (ordner.length === 0) {
    console.log(`KEINE AUSKUNFT: unter ${wurzel} liegt kein Auftragsordner.`);
    return 2;
  }
  const gitLog = gitLogVon(WURZEL, ref);
  const blaetter = ordner.map((o) => stammblattVon(o, gitLog));
  const funde = doppelvergaben(blaetter);
  if (argumente.includes("--json")) {
    console.log(JSON.stringify({ blaetter, doppelvergaben: funde }, null, 2));
  } else {
    console.log(blaetter.map(alsText).join("\n\n"));
    console.log(`\nDOPPELVERGABEN: ${funde.length === 0 ? "keine" : funde.length}`);
    for (const f of funde) console.log(`  ${f.art} ${f.wert}: ${f.ordner.join(", ")}`);
    if (gitLog === null) console.log(`\nGitverlauf ${ref} unter ${WURZEL} nicht lesbar.`);
  }
  return funde.length > 0 ? 1 : 0;
}

// Direktaufruf: `node tools/job-stammblatt.ts <auftraege-wurzel> [--json] [--ref main]`.
// Beim Import passiert hier nichts. Kein `process.exit` — siehe `direktaufruf`.
if (process.argv[1]?.endsWith("job-stammblatt.ts")) {
  process.exitCode = direktaufruf(process.argv.slice(2));
}
