// ================================================================================================
// JOB 4012 — DIE PROBEINSEL: ein echter Release-Ordner, ein echter Server, ein echter Symlink.
// ================================================================================================
//
// WAS HIER ATTRAPPE IST UND WAS NICHT — die Grenze ist der ganze Wert dieser Datei:
//
//   ECHT   `update-einspielen.sh`, `rueckfall.sh`, `schema-vertrag.mjs`, `scripts/backup/backup.sh`,
//          das Umbiegen von `current`, das Beenden und Starten über die PID-Datei, die HTTP-Abfrage
//          von `/health`, das Kopieren der Sicherung samt Prüfsumme. Kein PATH-Stub liegt auf dem
//          Update-Weg selbst — die Skripte laufen Zeile für Zeile so, wie sie ausgeliefert werden.
//   PROBE  Nur die ANWENDUNG im Release: ein zwanzigzeiliger HTTP-Dienst, der `/health` mit einer
//          bestimmten Version beantwortet — oder eben nicht. Der echte Server bräuchte hier die
//          gesamte Laufzeit samt `node_modules` und würde nichts messen, was der Update-Weg tut.
//   FREMD  Einzelne FREMDBINARIES über einen PATH-Vorsatz (`fremdbinaerAttrappe`): `launchctl` (gibt
//          es auf dem Linux-Prüfstand nicht, und die echten Dienste eines Macs darf ein Testlauf nie
//          anfassen), `date` (nur so lässt sich „zwei Läufe in DERSELBEN Sekunde" erzwingen statt
//          erhoffen) und `pg_dump` (sonst bräuchte jede Sicherungsprobe eine echte Datenbank und
//          liefe im Tor nie mit). Keines davon gehört zu Klarwerk; der geprüfte Weg bleibt echt.
//
// DER VERTRAGSTEXT WIRD HIER AUSGESCHRIEBEN und nicht aus `schema-vertrag.mjs` geholt. Eine Probe,
// die ihre Erwartung aus dem Prüfling bezieht, bestätigt jede Änderung — auch die falsche. Weicht
// das Format eines Tages ab, wird dieser Helfer rot, und das ist der Sinn.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const WURZEL = resolve(import.meta.dirname, "../..");
export const UPDATE_SH = join(WURZEL, "scripts/insel/update-einspielen.sh");
export const RUECKFALL_SH = join(WURZEL, "scripts/insel/rueckfall.sh");
export const VERTRAG_MJS = join(WURZEL, "scripts/insel/schema-vertrag.mjs");

export type Risiko = "ADDITIV" | "TRANSFORMIEREND" | "IRREVERSIBEL";
export interface Stufe {
  readonly stufe: string;
  readonly risiko: Risiko;
}

/** Zwei additive Stufen — der Ausgangsbestand jeder Probe. */
export const GRUNDSTUFEN: readonly Stufe[] = [
  { stufe: "AUTH_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_SCHEMA", risiko: "ADDITIV" },
];

export function vertragstext(feld: {
  release: string;
  appVersion: string;
  stufen: readonly Stufe[];
  commit?: string;
  bestaetigt?: string;
}): string {
  const zeile = feld.stufen.map((s) => `${s.stufe}:${s.risiko}`).join(" ");
  const zeilen = [
    "vertrag=1",
    `release=${feld.release}`,
    `app_version=${feld.appVersion}`,
    `commit=${feld.commit ?? "0000000"}`,
    `stufen=${zeile}`,
    `stufenhash=${createHash("sha256").update(zeile, "utf8").digest("hex")}`,
  ];
  if (feld.bestaetigt !== undefined) {
    zeilen.push(`bestaetigt=${feld.bestaetigt}`);
  }
  return `${zeilen.join("\n")}\n`;
}

/** Ein Feld aus einem Vertrags- oder Standtext. */
export function feldAus(text: string, name: string): string {
  return new RegExp(`^${name}=(.*)$`, "m").exec(text)?.[1]?.trim() ?? "";
}

export interface ReleaseWunsch {
  readonly name: string;
  readonly appVersion: string;
  readonly stufen?: readonly Stufe[];
  /** Was `/health` als Version meldet. Standard: `appVersion`. */
  readonly meldeVersion?: string;
  /** `gruen` = HTTP 200, `rot` = HTTP 500, `tot` = der Prozess endet sofort. */
  readonly gesundheit?: "gruen" | "rot" | "tot";
  /**
   * Eine ALTINSTALLATION: ein Release, das vor JOB 4012 eingespielt wurde und deshalb keinen
   * `SCHEMA-VERTRAG` trägt. Genau dieser Fall steht auf jeder Insel, die heute läuft.
   */
  readonly ohneVertrag?: boolean;
  /**
   * Ohne `package.json` — ein kaputtes oder von Hand zusammengelegtes Release. Jedes echte Release
   * trägt sie (`build-current-release.mjs` kopiert sie), und `/health` meldet ihre `version`.
   */
  readonly ohnePaketdatei?: boolean;
}

/** Legt ein Release an: Vertrag, BUILD_INFO, Startbefehl und die Probe-Anwendung. */
export function schreibeRelease(releases: string, wunsch: ReleaseWunsch): string {
  const ziel = join(releases, wunsch.name);
  mkdirSync(ziel, { recursive: true });
  if (wunsch.ohneVertrag !== true) {
    writeFileSync(
      join(ziel, "SCHEMA-VERTRAG"),
      vertragstext({
        release: wunsch.name,
        appVersion: wunsch.appVersion,
        stufen: wunsch.stufen ?? GRUNDSTUFEN,
      }),
    );
  }
  // Die zweite, unabhängige Versionsquelle — dieselbe, aus der `/health` die Version liest
  // (`services/app/src/build-app.ts:buildVersion`). Ohne sie bliebe dem Rückfall auf eine
  // Altinstallation nur der Verzeichnisname, und der ist keine Version.
  if (wunsch.ohnePaketdatei !== true) {
    writeFileSync(
      join(ziel, "package.json"),
      `${JSON.stringify({ name: "klarwerk", version: wunsch.appVersion }, null, 2)}\n`,
    );
  }
  writeFileSync(join(ziel, "BUILD_INFO"), `version=${wunsch.name}\nport=0\n`);

  const gesundheit = wunsch.gesundheit ?? "gruen";
  writeFileSync(
    join(ziel, "server.mjs"),
    `import { createServer } from "node:http";
const port = Number(process.env.PORT ?? "3002");
const version = ${JSON.stringify(wunsch.meldeVersion ?? wunsch.appVersion)};
const gruen = ${gesundheit === "gruen" ? "true" : "false"};
createServer((anfrage, antwort) => {
  if (anfrage.url === "/health") {
    if (!gruen) {
      antwort.writeHead(500, { "content-type": "application/json" });
      antwort.end(JSON.stringify({ status: "rot" }));
      return;
    }
    antwort.writeHead(200, { "content-type": "application/json" });
    antwort.end(JSON.stringify({ status: "ok", version, commit: "probe" }));
    return;
  }
  antwort.writeHead(404);
  antwort.end();
}).listen(port, "127.0.0.1");
`,
  );
  writeFileSync(
    join(ziel, "start.command"),
    gesundheit === "tot"
      ? `#!/usr/bin/env bash\necho "Probe: Start abgebrochen" >&2\nexit 1\n`
      : `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec node "$ROOT/server.mjs"
`,
    { mode: 0o755 },
  );
  return ziel;
}

/**
 * Ein Paket, wie es auf der Insel ankommt: AUSSERHALB von `releases/`.
 *
 * Seit Runde 3 ist das nicht mehr Geschmackssache. `update-einspielen.sh` lehnt jede Quelle ab,
 * deren Releasename schon unter `releases/` liegt — auch die Quelle, die dieses Verzeichnis SELBST
 * ist (Bens Gegenprobe BEN-R2-1: sonst verliert die Wiederholung den Rückfallpunkt). Eine vorhandene
 * Fassung fährt man mit `rueckfall.sh <name>` an, nicht durch erneutes Einspielen.
 */
export function legePaketAn(insel: Insel, wunsch: ReleaseWunsch): string {
  const ordner = join(insel.wurzel, "eingang");
  mkdirSync(ordner, { recursive: true });
  return schreibeRelease(ordner, wunsch);
}

/**
 * Ein PATH-Vorsatz mit Attrappen für FREMDBINARIES — und nur für die.
 *
 * Jeder Aufruf bekommt ein eigenes Verzeichnis, damit zwei Attrappen in einem Test sich nicht
 * gegenseitig überschreiben. Der Rückgabewert ist als `PATH`-Vorsatz gedacht:
 * `{ PATH: `${fremdbinaerAttrappe(...)}:${process.env.PATH}` }`.
 */
export function fremdbinaerAttrappe(insel: Insel, binaries: Record<string, string>): string {
  const ordner = mkdtempSync(join(insel.wurzel, "pfad-"));
  for (const [name, rumpf] of Object.entries(binaries)) {
    writeFileSync(join(ordner, name), rumpf, { mode: 0o755 });
  }
  return ordner;
}

/** Der echte Pfad eines Fremdbinaries — damit eine Attrappe an ihn durchreichen kann. */
function echterPfad(name: string): string {
  const gefunden = spawnSync("bash", ["-c", `command -v ${name}`], { encoding: "utf8" });
  const pfad = `${gefunden.stdout ?? ""}`.trim();
  if (pfad === "") {
    throw new Error(`${name} nicht auf dem PATH — die Attrappe kann nicht durchreichen`);
  }
  return pfad;
}

/**
 * Eine `date`-Attrappe, die GENAU das Format festnagelt, mit dem die Insel-Skripte ihre Namen
 * bilden (`date -u +%Y%m%dT%H%M%SZ` in `update-einspielen.sh`, `rueckfall.sh` UND `backup.sh`).
 * Jeder andere Aufruf geht unverändert an das echte `date`.
 *
 * WOZU: Die Frage „überschreibt der zweite Lauf die Sicherung des ersten?" entscheidet sich an der
 * Sekunde. Wer sie dem Zufall überlässt, misst an einem schnellen Rechner meistens nichts — genau
 * der Vorwurf an W3 aus Runde 3. Festgenagelt ist der Kollisionsfall garantiert gefahren.
 */
export function festerZeitstempel(stempel: string): string {
  return `#!/usr/bin/env bash
for arg in "$@"; do
  if [ "$arg" = "+%Y%m%dT%H%M%SZ" ]; then
    printf '%s\\n' ${JSON.stringify(stempel)}
    exit 0
  fi
done
exec ${JSON.stringify(echterPfad("date"))} "$@"
`;
}

/**
 * Eine `pg_dump`-Attrappe, die schreibt, was `KLARWERK_PROBE_DUMPINHALT` sagt.
 *
 * Sie ahmt genau die zwei Aufrufformen nach, die auf diesem Weg vorkommen: `--version` (die
 * Verfügbarkeitsfrage) und das Schreiben nach `--file <pfad>`, wie `backup.sh` es tut. `backup.sh`
 * selbst — Arbeitsname, Prüfsumme, die Veröffentlichung in der Reihenfolge Sidecar-dann-Dump — läuft
 * dabei UNVERÄNDERT; gemessen wird also dessen echtes Verhalten, nur ohne Datenbank.
 */
export const PG_DUMP_ATTRAPPE = `#!/usr/bin/env bash
if [ "\${1:-}" = "--version" ]; then
  echo "pg_dump (PostgreSQL) 16.0 (Attrappe)"
  exit 0
fi
ZIEL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --file) ZIEL="\${2:-}"; shift 2 ;;
    --file=*) ZIEL="\${1#--file=}"; shift ;;
    *) shift ;;
  esac
done
if [ -z "$ZIEL" ]; then
  echo "pg_dump-Attrappe: kein --file uebergeben" >&2
  exit 1
fi
printf '%s' "\${KLARWERK_PROBE_DUMPINHALT:-PROBE-DUMP}" > "$ZIEL"
`;

export interface Insel {
  readonly wurzel: string;
  readonly releases: string;
  readonly daten: string;
  readonly backups: string;
  readonly logs: string;
  readonly port: number;
}

/** Ein freier Port vom Betriebssystem — kein geratener. */
export function freierPort(): Promise<number> {
  return new Promise((fertig, schiefgegangen) => {
    const horcher = createServer();
    horcher.on("error", schiefgegangen);
    horcher.listen(0, "127.0.0.1", () => {
      const adresse = horcher.address();
      const port = typeof adresse === "object" && adresse !== null ? adresse.port : 0;
      horcher.close(() => {
        if (port > 0) {
          fertig(port);
        } else {
          schiefgegangen(new Error("kein freier Port ermittelbar"));
        }
      });
    });
  });
}

export async function legeInselAn(): Promise<Insel> {
  const wurzel = mkdtempSync(join(tmpdir(), "klarwerk-insel-"));
  const insel: Insel = {
    wurzel,
    releases: join(wurzel, "releases"),
    daten: join(wurzel, "data"),
    backups: join(wurzel, "backups"),
    logs: join(wurzel, "logs"),
    port: await freierPort(),
  };
  mkdirSync(insel.releases, { recursive: true });
  mkdirSync(insel.daten, { recursive: true });
  mkdirSync(insel.logs, { recursive: true });
  return insel;
}

/**
 * Journalbetrieb: eine echte Datei mit echtem Inhalt, damit die Sicherung etwas zu sichern hat.
 *
 * `zeilen = 0` legt sie LEER an — genau das, was ein frisch gestartetes Release tut
 * (`start.command`: `: > "$STATE_FILE"`). Eine leere Journaldatei ist ein belegter leerer
 * Datenstand und kein unbekannter; die Unterscheidung trägt den Übergang der Altinstallationen.
 */
export function legeJournalAn(insel: Insel, zeilen = 3): string {
  const datei = join(insel.daten, "state.jsonl");
  writeFileSync(
    datei,
    zeilen === 0
      ? ""
      : `${Array.from({ length: zeilen }, (_, i) => JSON.stringify({ nr: i, wert: `zeile-${i}` })).join("\n")}\n`,
  );
  return datei;
}

/** Setzt `current` von Hand auf ein Release — der Ausgangszustand „es läuft schon etwas". */
export function setzeCurrent(insel: Insel, name: string): void {
  spawnSync("ln", ["-sfn", join(insel.releases, name), join(insel.wurzel, "current")]);
}

export function umgebung(insel: Insel, zusatz: Record<string, string> = {}): NodeJS.ProcessEnv {
  const basis = { ...process.env } as Record<string, string | undefined>;
  // Eine geerbte Datenbank-URL würde die Probe in den Postgres-Zweig schicken.
  basis.DATABASE_URL = undefined;
  basis.KLARWERK_DATABASE_URL = undefined;
  return {
    ...basis,
    KLARWERK_SHARED_ROOT: insel.wurzel,
    PORT: String(insel.port),
    // EIN Testlauf AUF der Insel darf deren echten Serverdienst nicht anfassen. Der Betriebsweg
    // fragt launchd nach diesem Label; ein Label mit der eigenen Prozessnummer ist garantiert nicht
    // geladen, und der Weg führt den Server damit selbst (nohup + PID-Datei) — so wie hier gemessen.
    KLARWERK_LAUNCHD_LABEL: `de.klarwerk.insel.probe.${process.pid}.${insel.port}`,
    // Vier Versuche statt sechzig: der Probe-Server ist in Millisekunden da, und die roten Fälle
    // warten diese Zeit voll ab. Gemessen im Cloud-Lauf a867ee77: sechs Sekunden je rotem Fall
    // machten allein die Rückfallgruppe 46 s lang.
    KLARWERK_HEALTH_SEKUNDEN: "4",
    ...zusatz,
  };
}

export interface Lauf {
  readonly code: number | null;
  readonly ausgabe: string;
  /** Die letzte nicht leere Zeile auf stdout — die Ergebniszeile des Weges. */
  readonly ergebnis: string;
}

function lauf(datei: string, argumente: readonly string[], env: NodeJS.ProcessEnv): Lauf {
  const ergebnis = spawnSync("bash", [datei, ...argumente], {
    cwd: WURZEL,
    env,
    encoding: "utf8",
    timeout: 90_000,
  });
  const zeilen = (ergebnis.stdout ?? "").split("\n").filter((z) => z.trim() !== "");
  return {
    code: ergebnis.status,
    ausgabe: `${ergebnis.stdout ?? ""}${ergebnis.stderr ?? ""}`,
    ergebnis: zeilen.at(-1) ?? "",
  };
}

export function fahreUpdate(insel: Insel, quelle: string, zusatz: readonly string[] = []): Lauf {
  return lauf(UPDATE_SH, [quelle, ...zusatz], umgebung(insel));
}

/** Irgendein Betriebsskript dieser Insel — etwa das `install.command` EINES PAKETS. */
export function fahreSkript(
  insel: Insel,
  datei: string,
  argumente: readonly string[] = [],
  zusatz: Record<string, string> = {},
): Lauf {
  return lauf(datei, argumente, umgebung(insel, zusatz));
}

/**
 * Legt die echten Betriebswege in ein Paket — so, wie `build-current-release.mjs` sie in jedes
 * Release legt. Kopiert wird die ECHTE Datei aus dem Arbeitsbaum: eine Probe gegen eine Nachbildung
 * des Update-Weges würde den Update-Weg nicht prüfen.
 */
export function legeBetriebswegeAb(paket: string): void {
  const ziel = join(paket, "scripts", "insel");
  mkdirSync(ziel, { recursive: true });
  for (const name of [
    "update-einspielen.sh",
    "rueckfall.sh",
    "insel-betrieb.sh",
    "schema-vertrag.mjs",
  ]) {
    copyFileSync(join(WURZEL, "scripts", "insel", name), join(ziel, name));
  }
}

export function fahreRueckfall(insel: Insel, argumente: readonly string[] = []): Lauf {
  return lauf(RUECKFALL_SH, argumente, umgebung(insel));
}

export function fahreVertrag(argumente: readonly string[]): Lauf {
  const ergebnis = spawnSync("node", [VERTRAG_MJS, ...argumente], {
    cwd: WURZEL,
    encoding: "utf8",
    timeout: 30_000,
  });
  return {
    code: ergebnis.status,
    ausgabe: `${ergebnis.stdout ?? ""}${ergebnis.stderr ?? ""}`,
    ergebnis: (ergebnis.stdout ?? "").trim(),
  };
}

/** Was `/health` gerade sagt — die einzige ehrliche Frage danach, welche Fassung läuft. */
export async function gesundheit(
  insel: Insel,
): Promise<{ code: number; version: string } | undefined> {
  try {
    const antwort = await fetch(`http://127.0.0.1:${insel.port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const rumpf = (await antwort.json()) as { version?: unknown };
    return {
      code: antwort.status,
      version: typeof rumpf.version === "string" ? rumpf.version : "",
    };
  } catch {
    return undefined;
  }
}

export function aktivesRelease(insel: Insel): string {
  const zeiger = join(insel.wurzel, "current");
  if (!existsSync(zeiger)) {
    return "";
  }
  return (
    spawnSync("readlink", [zeiger], { encoding: "utf8" }).stdout.trim().split("/").at(-1) ?? ""
  );
}

export function standtext(insel: Insel): string {
  const datei = join(insel.daten, "SCHEMA-STAND");
  return existsSync(datei) ? readFileSync(datei, "utf8") : "";
}

/** Beendet den Server der Probe und räumt das Verzeichnis ab. */
export function raeumeAb(insel: Insel): void {
  const pidDatei = join(insel.logs, `server-${insel.port}.pid`);
  if (existsSync(pidDatei)) {
    const pid = Number(readFileSync(pidDatei, "utf8").trim());
    if (Number.isFinite(pid) && pid > 0) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* schon beendet */
      }
    }
  }
  rmSync(insel.wurzel, { recursive: true, force: true });
}

/** Legt eine Datei an und sorgt für ihr Verzeichnis — für Proben, die Pfade verstellen. */
export function schreibeDatei(pfad: string, inhalt: string): void {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
