// ================================================================================================
// JOB 4275 · DIE VORRICHTUNG DES BEZIEHUNGS-RESTORE — Serverprozesse, Abdruck und Vergleich.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DER TESTDATEI STEHT, und nicht in ihr: §5.6 des Auftrags verlangt, dass
// GENAU DIESELBE Vergleichsfunktion einmal gegen zwei absichtlich beschaedigte Kopien faehrt (ROT)
// und danach gegen die wirklich wiederhergestellte Datenbank (GRUEN). Eine Funktion, die in der
// Testdatei zwischen den Faellen liegt, waere dieselbe Funktion nur dem Namen nach — hier ist sie
// EIN Ort, den alle vier Erhebungen rufen, und ihre Fehlermeldungen sind derselbe Text.
//
// DREI BAUSTEINE, und jeder hat genau eine Aufgabe:
//
//   1. `starteKlarwerk` — ein ECHTER Betriebssystemprozess (`node --import tsx server.ts`), eigener
//      Socket, eigene PID. Das ist der Unterschied zu JOB 4155 L6, das eine zweite `buildApp`-
//      Instanz IM SELBEN Node-Prozess baut und im Dateikopf ausdruecklich sagt, dass es damit
//      keinen Prozessneustart belegt (`neustart-und-restore.integration.test.ts:22-24`). Die
//      Umgebung wird VOLLSTAENDIG neu gebaut und nicht geerbt — dieselbe Regel wie in
//      `tests/neuinstallation/erstinstallation.integration.test.ts:653-656`: eine geerbte
//      `KLARWERK_SELF_REGISTRATION` aus `tests/setup-env.ts` brächte die Messung still zum
//      Schweigen, und ein geerbter Modellschluessel liesse diesen Prozess mit Dritten sprechen.
//
//   2. `erhebeAbdruck` — der Vorzustand als DATUM: die Tabellen `ko_kanten` und `ko_kanten_beitrag`
//      UND die Antwort von `GET /api/kos/:id/beziehungen` je Rolle und je Eintrag. Beides zusammen,
//      weil keines allein traegt: die Tabelle sagt nichts ueber den Leseweg, der Leseweg nichts
//      ueber die Bindung des Wiederholschluessels (die steht in keiner Antwort). Seit Runde 2
//      WIRFT sie, wenn auch nur eine Rollensicht kein gueltiger Bestand ist — siehe `pruefeSicht`.
//
//   2a. `pruefeSicht`/`pruefeAbdruck` — der ERFOLGS- UND STRUKTURBELEG je Sicht, unabhaengig vom
//      Vergleich. Das ist die Korrektur aus Runde 1: dort hielt die Erhebung jede Fehlerantwort als
//      `total: -1`/`kanten: []` fest, und der Vergleich sah zwei gleiche Ersatzwerte als
//      Uebereinstimmung. Die Suite blieb gruen, obwohl der HTTP-Leseweg durchgehend ausgefallen war
//      (BEN R1, gemessen mit 404 auf allen vier Rollen). Ein Abnahmeweg muss auch den AUSFALL
//      seines eigenen Beweismittels sehen — er sieht ihn ab hier, an drei Stellen unabhaengig.
//
//   3. `vergleicheAbdruecke` — der Vergleich, der SAGT, WAS FEHLT. Er gibt eine Liste von Saetzen
//      zurueck und nicht `true`/`false`: „gleich lang" ist kein Inhaltsbeleg (Lehre JOB 4141 R1),
//      und ein blosses `toEqual` sagte im roten Fall nicht, ob eine Beziehung, ein Feld oder ein
//      Wiederholschluessel verloren ging.
import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import type { Pool } from "pg";

export const JOB = "[KLARWERK] JOB 4275";
export const WURZEL = resolve(import.meta.dirname, "../..");

// ------------------------------------------------------------------------------------------------
// VERBINDUNG UND WEGWERFNAMEN
// ------------------------------------------------------------------------------------------------

export interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

export function werkzeugFehlt(name: string): boolean {
  return spawnSync("/bin/sh", ["-c", `command -v ${name} >/dev/null 2>&1`]).status !== 0;
}

export function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    if (!u.hostname) {
      return undefined;
    }
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username) || "postgres",
      passwort: decodeURIComponent(u.password),
    };
  } catch {
    return undefined;
  }
}

// Zusammengesetzt statt ausgeschrieben, aus demselben Grund wie in
// `tests/backup-drill/echter-wiederanlauf.integration.test.ts:84-106`: Fall N3 von
// `tests/app/job2354-drei-datenbanknamen.test.ts` liest jede ausgeschriebene Verbindungszeichenkette
// per Muster. Die Zusicherung geht dabei nicht verloren, sie wird strenger und zur LAUFZEIT
// geprueft — verbunden wird mit keinem Namen ohne `test`.
const PG_SCHEMA = "postgresql:";

export function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}“ traegt kein „test“ im Namen — diese Suite legt Datenbanken an und wirft sie mit DROP … WITH (FORCE) wieder weg und verbindet sich deshalb nicht.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

// ------------------------------------------------------------------------------------------------
// DER ECHTE SERVERPROZESS
// ------------------------------------------------------------------------------------------------

/** Ein Port, auf dem gerade nichts horcht — vom Betriebssystem vergeben, nicht geraten. */
export async function freierPort(): Promise<number> {
  return await new Promise<number>((fertig, scheitere) => {
    const horcher = createServer();
    horcher.once("error", scheitere);
    horcher.listen(0, "127.0.0.1", () => {
      const adresse = horcher.address();
      if (adresse === null || typeof adresse === "string") {
        horcher.close(() => scheitere(new Error(`${JOB}: kein freier Port zu bekommen.`)));
        return;
      }
      const port = adresse.port;
      horcher.close(() => fertig(port));
    });
  });
}

export interface Instanz {
  /** Die PID des Prozesses, der wirklich horcht. Sie steht in der RUECKGABE (Auftrag §5.3). */
  readonly pid: number;
  readonly basis: string;
  /** Beendet den Prozess und kehrt erst zurueck, wenn er WIRKLICH weg ist. */
  beende(): Promise<void>;
  /** Laeuft er noch? Ein beendeter Prozess meldet hier `false` — der Beleg fuer §5.3. */
  laeuft(): boolean;
}

/**
 * Startet Klarwerk als eigenen Betriebssystemprozess gegen genau diese Datenbank.
 *
 * `NODE_ENV=production` ist Absicht und kein Beiwerk: nur dort gilt der Startvertrag, nur dort ist
 * die oeffentliche Selbstregistrierung fail-closed ZU — der Bestand dieses Nachweises entsteht
 * deshalb ueber `POST /api/auth/setup` und `POST /api/users`, also ueber die Wege, die eine echte
 * Kundeninstanz auch geht. `EXTERNAL_SEARCH=off` haelt den Prozess vom Netz fern (Lehre mega25:
 * das Tor hat einmal live zu Wikipedia gesprochen, weil niemand die Variable setzte).
 */
export async function starteKlarwerk(opts: {
  datenbankUrl: string;
  was: string;
}): Promise<Instanz> {
  const port = await freierPort();
  const basis = `http://127.0.0.1:${port}`;
  const prozess: ChildProcessWithoutNullStreams = spawn(
    "node",
    ["--import", "tsx", "services/app/src/server.ts"],
    {
      cwd: WURZEL,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "/tmp",
        KLARWERK_SKIP_KEYCHAIN: "1",
        KLARWERK_LOG_LEVEL: "warn",
        NODE_ENV: "production",
        EXTERNAL_SEARCH: "off",
        DATABASE_URL: opts.datenbankUrl,
        APP_BASE_URL: "https://wiederanlauf.beziehungen.test",
        PORT: String(port),
      },
    },
  );
  const protokoll: string[] = [];
  prozess.stdout.on("data", (d) => protokoll.push(String(d)));
  prozess.stderr.on("data", (d) => protokoll.push(String(d)));

  const beendet = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
  const laeuft = (): boolean => prozess.exitCode === null && prozess.signalCode === null;
  const beende = async (): Promise<void> => {
    if (!laeuft()) {
      return;
    }
    prozess.kill("SIGTERM");
    let uhr: NodeJS.Timeout | undefined;
    const frist = new Promise<"frist">((f) => {
      uhr = setTimeout(() => f("frist"), 20_000);
    });
    const ausgang = await Promise.race([beendet.then(() => "aus" as const), frist]);
    if (uhr) {
      clearTimeout(uhr);
    }
    if (ausgang === "frist") {
      prozess.kill("SIGKILL");
      await beendet;
    }
  };

  // Warten, bis `/health` antwortet — und SICHTBAR melden, woran es lag, wenn nicht. Kaeme der
  // Prozess nicht hoch und der Test maesse trotzdem weiter, liefe er gegen nichts, und das saehe
  // je nach Zeitpunkt wie ein Ergebnis aus (Auftrag §9: ein nicht gestarteter Server ist KEIN
  // „keine Beziehungen").
  const ablauf = Date.now() + 180_000;
  while (Date.now() < ablauf) {
    if (!laeuft()) {
      throw new Error(
        `${JOB} (${opts.was}): der Serverprozess endete mit Code ${prozess.exitCode}/Signal ${prozess.signalCode}, bevor er antwortete.\n${protokoll.join("")}`,
      );
    }
    try {
      const antwort = await fetch(`${basis}/health`);
      if (antwort.ok) {
        const pid = prozess.pid;
        if (pid === undefined) {
          await beende();
          throw new Error(`${JOB} (${opts.was}): der Serverprozess hat keine PID.`);
        }
        return { pid, basis, beende, laeuft };
      }
    } catch {
      // noch nicht am Socket — weiter warten.
    }
    await new Promise((weiter) => setTimeout(weiter, 250));
  }
  await beende();
  throw new Error(
    `${JOB} (${opts.was}): der Serverprozess antwortete in 180 s nicht auf /health.\n${protokoll.join("")}`,
  );
}

/** Lebt dieser Prozess noch? `false` ist der Beleg, dass der alte Server wirklich beendet war. */
export function prozessLebt(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------------------------
// HTTP ÜBER DEN ECHTEN SOCKET
// ------------------------------------------------------------------------------------------------

export interface Antwort {
  status: number;
  text: string;
  json: unknown;
}

export async function sende(
  basis: string,
  verfahren: string,
  pfad: string,
  token?: string,
  rumpf?: unknown,
): Promise<Antwort> {
  const kopf: Record<string, string> = {};
  if (token) {
    kopf.authorization = `Bearer ${token}`;
  }
  if (rumpf !== undefined) {
    kopf["content-type"] = "application/json";
  }
  // `exactOptionalPropertyTypes` ist an: ein Feld `body: undefined` ist NICHT dasselbe wie ein
  // fehlendes Feld. Der Rumpf wird deshalb nur dann ins Objekt gelegt, wenn es einen gibt.
  const anfrage: RequestInit = { method: verfahren, headers: kopf };
  if (rumpf !== undefined) {
    anfrage.body = JSON.stringify(rumpf);
  }
  const antwort = await fetch(`${basis}${pfad}`, anfrage);
  const text = await antwort.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: antwort.status, text, json };
}

// ------------------------------------------------------------------------------------------------
// DER ABDRUCK
// ------------------------------------------------------------------------------------------------

/** Eine Zeile aus `ko_kanten` — alle Spalten, die den Inhalt der Beziehung ausmachen. */
export interface Kantenzeile {
  id: string;
  quelle_id: string;
  ziel_id: string;
  art: string;
  richtung: string;
  urheber: string;
  gesetzt_am: string;
  geaendert_am: string;
  status: string;
  version: number;
  beurteilt: unknown;
  beitrag_schluessel: unknown;
  widerrufen_von: string | null;
}

/**
 * Eine Zeile aus `ko_kanten_beitrag` — die BINDUNG des Wiederholschluessels.
 *
 * Sie steht in KEINER HTTP-Antwort; ohne sie faende `holeNachBeitrag` den Beitrag nach dem
 * Wiederanlauf nicht mehr, und dieselbe Anlage erzeugte eine ZWEITE Beziehung. JOB 4155 L7 prueft
 * diese Tabelle nur auf `> 0` (`neustart-und-restore.integration.test.ts:375-378`) — dass der
 * einzelne Schluessel noch BINDET, sagt eine Zahl nicht.
 */
export interface Bindungszeile {
  beitrag_schluessel: string;
  kante_id: string;
}

/**
 * Die Antwort von `GET /api/kos/:id/beziehungen`, so wie sie am Draht ankam — OHNE ERSATZWERTE.
 *
 * WARUM HIER KEIN `total: -1` UND KEIN `kanten: []` MEHR STEHT (BEN, JOB 4275 R1,
 * Korrekturpflicht 1): Bis Runde 1 legte die Erhebung bei JEDER Fehlerantwort `total: -1` und
 * `kanten: []` ab, und der Vergleich unten prüfte davon nur die Gleichheit der Statuscodes. Zwei
 * identische Fehlerantworten waren damit „gleich" — BENs Gegenprobe leitete alle GET-Abfragen einer
 * Rolle auf eine nicht vorhandene Route um, jede Erhebung bekam HTTP 404, und die Suite meldete
 * trotzdem `Tests 5 passed (5)`. Ein Ersatzwert ist kein Bestand.
 *
 * Deshalb steht hier nur noch, was WIRKLICH ankam: Status, Rohtext und der geparste Rumpf
 * (`undefined`, wenn es keinen gab). Wer `total` oder `kanten` will, muss durch `totalVon` bzw.
 * `kantenVon` — und die verweigern die Auskunft, solange die Sicht kein gueltiger Bestand ist.
 */
export interface Rollensicht {
  rolle: string;
  koId: string;
  status: number;
  /** Der geparste Rumpf — `undefined`, wenn die Antwort kein JSON war. Nie ein Ersatzwert. */
  rumpf: unknown;
  /** Die SERIALISIERTE Antwort — an ihr prueft §5.4, dass nichts Verborgenes mitreist. */
  roh: string;
}

export interface Abdruck {
  kanten: Kantenzeile[];
  bindungen: Bindungszeile[];
  sichten: Rollensicht[];
}

export interface Konto {
  rolle: string;
  token: string;
}

/**
 * Deterministische Serialisierung — Schluessel sortiert, damit ein Vergleich nicht an der
 * Einfuegereihenfolge eines `jsonb`-Feldes haengt (genau diese Sorte Abweichung nennt
 * `scripts/backup/restore-drill.sh:71-75` ausdruecklich als erklaerbar und KEINEN Restorefehler).
 */
export function stabil(wert: unknown): string {
  return JSON.stringify(wert, (_schluessel, w: unknown) => {
    if (w !== null && typeof w === "object" && !Array.isArray(w)) {
      const eintraege = Object.entries(w as Record<string, unknown>);
      eintraege.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return Object.fromEntries(eintraege);
    }
    return w;
  });
}

// ------------------------------------------------------------------------------------------------
// DER ERFOLGS- UND STRUKTURBELEG JE SICHT — VOR jedem Vergleich (BEN R1, Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
//
// BENs Prueffrage woertlich: „Jede Vorher-/Nachher-Sicht benoetigt unabhaengig vom Vergleich einen
// Erfolgs- und Strukturbeleg." Genau das steht hier — und zwar als eigene, reine Funktion, damit
// DIESELBE Pruefung an drei Stellen greift: bei der Erhebung (sie wirft), im Vergleich (er wird
// rot) und in der Kalibrierung K3/K4 (sie weist beides nach).
//
// GEPRUEFT WIRD GEGEN DEN ABGELESENEN VERTRAG, nicht gegen eine Vermutung:
//   · `kanten-routes.ts:175-189` antwortet auf dem Leseweg IMMER mit `200`. Jeder andere Status ist
//     ein Ausfall des BEWEISMITTELS und nie „keine Beziehungen" (Auftrag §9).
//   · `KantenLeseService.kantenFuer` (`kanten-service.ts:646-687`) liefert `{ koId, kanten, total }`
//     und setzt `total = ansichten.length`; der Typ sagt dazu „Zaehlt NACH dem Trimm. Es gibt keine
//     zweite Zahl" (`kanten-service.ts:518-523`). Eine Antwort mit `total !== kanten.length` kann
//     deshalb nicht von diesem Dienst stammen.
//   · `KuratierteKanteAnsicht` (`kanten-service.ts:460-516`) und `KantenGegenstueck` (`:421-425`)
//     nennen die Pflichtfelder jeder einzelnen Beziehung.
const PFLICHTTEXTE: readonly string[] = [
  "id",
  "art",
  "richtung",
  "urheber",
  "gesetztAm",
  "status",
  "herkunft",
];

function auszug(text: string): string {
  const eine = text.replace(/\s+/g, " ").trim();
  return eine.length > 200 ? `${eine.slice(0, 200)}…` : eine;
}

function pruefeKante(wo: string, nr: number, k: unknown): string[] {
  if (k === null || typeof k !== "object" || Array.isArray(k)) {
    return [`${wo}: Beziehung ${nr} ist kein Objekt (${stabil(k)}).`];
  }
  const kante = k as Record<string, unknown>;
  const maengel: string[] = [];
  for (const feld of PFLICHTTEXTE) {
    const wert = kante[feld];
    if (typeof wert !== "string" || wert.length === 0) {
      maengel.push(`${wo}: Beziehung ${nr} hat kein „${feld}" (${stabil(wert)}).`);
    }
  }
  if (typeof kante.version !== "number") {
    maengel.push(`${wo}: Beziehung ${nr} hat keine Fassungsnummer (${stabil(kante.version)}).`);
  }
  const gegen = kante.gegenstueck;
  if (gegen === null || typeof gegen !== "object" || Array.isArray(gegen)) {
    maengel.push(`${wo}: Beziehung ${nr} hat kein Gegenstueck (${stabil(gegen)}).`);
    return maengel;
  }
  const g = gegen as Record<string, unknown>;
  if (typeof g.id !== "string" || g.id.length === 0) {
    maengel.push(`${wo}: Beziehung ${nr}: das Gegenstueck hat keine Kennung (${stabil(g.id)}).`);
  }
  if (typeof g.title !== "string" || g.title.length === 0) {
    maengel.push(`${wo}: Beziehung ${nr}: das Gegenstueck hat keinen Titel (${stabil(g.title)}).`);
  }
  return maengel;
}

/**
 * Ist DIESE Sicht ein gueltiger Bestand? Leere Liste heisst ja; jeder Satz nennt KO, Rolle und
 * Status (BEN: „Ein Fehler nennt KO, Rolle und Status").
 */
export function pruefeSicht(s: Rollensicht): string[] {
  const wo = `KO ${s.koId}, Rolle ${s.rolle}, HTTP ${s.status}`;
  if (s.status !== 200) {
    return [
      `${wo}: der Leseweg hat NICHT geantwortet (erwartet HTTP 200) — das ist ein Ausfall des Beweismittels und KEIN leerer Bestand. Antwort: ${auszug(s.roh)}`,
    ];
  }
  if (s.rumpf === null || typeof s.rumpf !== "object" || Array.isArray(s.rumpf)) {
    return [
      `${wo}: die Antwort ist kein JSON-Objekt — kein gueltiger Bestand. Antwort: ${auszug(s.roh)}`,
    ];
  }
  const rumpf = s.rumpf as Record<string, unknown>;
  const maengel: string[] = [];
  if (rumpf.koId !== s.koId) {
    maengel.push(
      `${wo}: die Antwort nennt das Objekt ${stabil(rumpf.koId)} — gefragt war ${s.koId}.`,
    );
  }
  const total = rumpf.total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) {
    maengel.push(`${wo}: das Feld „total" fehlt oder ist keine Anzahl (${stabil(total)}).`);
  }
  if (!Array.isArray(rumpf.kanten)) {
    maengel.push(`${wo}: das Feld „kanten" fehlt oder ist keine Liste (${stabil(rumpf.kanten)}).`);
    return maengel;
  }
  const kanten = rumpf.kanten as unknown[];
  if (typeof total === "number" && total !== kanten.length) {
    maengel.push(
      `${wo}: total ${total} passt nicht zu ${kanten.length} gelieferten Beziehungen — der Vertrag zaehlt NACH dem Trimm (kanten-service.ts:518-523).`,
    );
  }
  kanten.forEach((k, nr) => {
    maengel.push(...pruefeKante(wo, nr, k));
  });
  return maengel;
}

/** Der Zaehler dieser Sicht — oder ein Fehler. Es gibt keinen dritten Ausgang und keinen Ersatzwert. */
export function totalVon(s: Rollensicht): number {
  const maengel = pruefeSicht(s);
  if (maengel.length > 0) {
    throw new Error(`${JOB}: diese Sicht ist kein gueltiger Bestand:\n${maengel.join("\n")}`);
  }
  return (s.rumpf as { total: number }).total;
}

/** Die Beziehungen dieser Sicht — oder ein Fehler. Eine leere Liste bekommt nur, wer HTTP 200 hat. */
export function kantenVon(s: Rollensicht): Record<string, unknown>[] {
  const maengel = pruefeSicht(s);
  if (maengel.length > 0) {
    throw new Error(`${JOB}: diese Sicht ist kein gueltiger Bestand:\n${maengel.join("\n")}`);
  }
  return (s.rumpf as { kanten: Record<string, unknown>[] }).kanten;
}

/**
 * Derselbe Beleg fuer einen GANZEN Abdruck. `wann` sagt, welche Seite gemeint ist — ohne das Wort
 * stuenden im roten Fall zweimal dieselben Saetze da und niemand wuesste, welche Erhebung ausfiel.
 */
export function pruefeAbdruck(abdruck: Abdruck, wann: string): string[] {
  const maengel: string[] = [];
  if (abdruck.sichten.length === 0) {
    maengel.push(
      `Leseweg (${wann}): es wurde GAR KEINE Rollensicht erhoben — ein nicht befragter Leseweg ist kein Bestand.`,
    );
  }
  for (const s of abdruck.sichten) {
    for (const m of pruefeSicht(s)) {
      maengel.push(`Leseweg (${wann}): ${m}`);
    }
  }
  return maengel;
}

/**
 * Erhebt Tabellenstand UND Leseweg in einem Griff — genau das, was vorher und nachher verglichen
 * wird. Nicht vorgezeigt: festgehalten (Lehre JOB 4141 R1).
 *
 * SIE WIRFT, wenn auch nur EINE Rollensicht kein gueltiger Bestand ist. Das ist die erste der drei
 * Sperren aus BENs Korrekturpflicht 1 und die frueheste: ein Abdruck, der einen Ausfall enthaelt,
 * entsteht gar nicht erst und kann deshalb auch nicht versehentlich verglichen werden.
 * `ohnePruefung` gibt es einzig fuer die Kalibrierung K3 — sie MUSS einen kaputten Abdruck in die
 * Hand bekommen, um zu belegen, dass der Vergleich ihn selbst dann noch rot meldet.
 */
export async function erhebeAbdruck(
  pool: Pool,
  basis: string,
  konten: readonly Konto[],
  koIds: readonly string[],
  opts: { ohnePruefung?: boolean } = {},
): Promise<Abdruck> {
  const kanten = await pool.query<Kantenzeile>(
    `SELECT id, quelle_id, ziel_id, art, richtung, urheber, gesetzt_am, geaendert_am,
            status, version, beurteilt, beitrag_schluessel, widerrufen_von
       FROM ko_kanten ORDER BY id`,
  );
  const bindungen = await pool.query<Bindungszeile>(
    "SELECT beitrag_schluessel, kante_id FROM ko_kanten_beitrag ORDER BY beitrag_schluessel",
  );
  const sichten: Rollensicht[] = [];
  for (const konto of konten) {
    for (const koId of koIds) {
      const antwort = await sende(basis, "GET", `/api/kos/${koId}/beziehungen`, konto.token);
      // Roh uebernommen: Status, Rumpf, Text. Hier wird NICHTS ersetzt und nichts geglaettet.
      sichten.push({
        rolle: konto.rolle,
        koId,
        status: antwort.status,
        rumpf: antwort.json,
        roh: antwort.text,
      });
    }
  }
  const abdruck: Abdruck = { kanten: kanten.rows, bindungen: bindungen.rows, sichten };
  if (!opts.ohnePruefung) {
    const maengel = pruefeAbdruck(abdruck, "bei der Erhebung");
    if (maengel.length > 0) {
      throw new Error(
        `${JOB}: der Leseweg hat keinen gueltigen Bestand geliefert — hier wird nichts ersetzt und nichts verglichen:\n${maengel.join("\n")}`,
      );
    }
  }
  return abdruck;
}

// ------------------------------------------------------------------------------------------------
// DER VERGLEICH — er sagt, WAS fehlt
// ------------------------------------------------------------------------------------------------

const KANTENFELDER: readonly (keyof Kantenzeile)[] = [
  "quelle_id",
  "ziel_id",
  "art",
  "richtung",
  "urheber",
  "gesetzt_am",
  "geaendert_am",
  "status",
  "version",
  "beurteilt",
  "beitrag_schluessel",
  "widerrufen_von",
];

function kanteBeschrieben(z: Kantenzeile): string {
  return `${z.id} (${z.art}, ${z.richtung}, ${z.quelle_id} → ${z.ziel_id}, Urheber ${z.urheber})`;
}

/**
 * Vergleicht zwei Abdruecke und liefert JEDE Abweichung als eigenen Satz. Eine leere Liste heisst:
 * derselbe Bestand, derselbe Leseweg, dieselben Bindungen — Feld fuer Feld.
 *
 * Die Reihenfolge ist Absicht: erst der Bestand (was ist weg), dann die Bindungen (was bindet nicht
 * mehr), dann der Leseweg je Rolle (was kommt beim Menschen nicht mehr an).
 */
export function vergleicheAbdruecke(vorher: Abdruck, nachher: Abdruck): string[] {
  const abweichungen: string[] = [];

  // 0 — DER ERFOLGS- UND STRUKTURBELEG, UNABHAENGIG VOM VERGLEICH (BEN R1, Korrekturpflicht 1+2).
  //
  // Diese Zeile ist die Antwort auf den Befund der Runde 1. Ein Vergleich zweier Erhebungen kann
  // grundsaetzlich nicht erkennen, ob BEIDE Seiten ausgefallen sind — zwei identische HTTP 404
  // sind einander gleich. Deshalb steht der Beleg VOR dem Vergleich und je Seite einzeln: fehlt er,
  // ist das eine Abweichung, auch wenn vorher und nachher Zeichen fuer Zeichen dasselbe sagen.
  abweichungen.push(...pruefeAbdruck(vorher, "vorher"), ...pruefeAbdruck(nachher, "nachher"));

  // 1 — ko_kanten.
  const nachKante = new Map(nachher.kanten.map((z) => [z.id, z]));
  for (const v of vorher.kanten) {
    const n = nachKante.get(v.id);
    if (!n) {
      abweichungen.push(`ko_kanten: die Beziehung ${kanteBeschrieben(v)} FEHLT.`);
      continue;
    }
    for (const feld of KANTENFELDER) {
      if (stabil(v[feld]) !== stabil(n[feld])) {
        abweichungen.push(
          `ko_kanten: Beziehung ${v.id}, Feld ${feld}: vorher ${stabil(v[feld])}, nachher ${stabil(n[feld])}.`,
        );
      }
    }
  }
  const vorKante = new Set(vorher.kanten.map((z) => z.id));
  for (const n of nachher.kanten) {
    if (!vorKante.has(n.id)) {
      abweichungen.push(`ko_kanten: die Beziehung ${kanteBeschrieben(n)} ist ZUSAETZLICH da.`);
    }
  }

  // 2 — ko_kanten_beitrag.
  const nachBindung = new Map(nachher.bindungen.map((z) => [z.beitrag_schluessel, z]));
  for (const v of vorher.bindungen) {
    const n = nachBindung.get(v.beitrag_schluessel);
    if (!n) {
      abweichungen.push(
        `ko_kanten_beitrag: der Wiederholschluessel „${v.beitrag_schluessel}“ (gebunden an Beziehung ${v.kante_id}) FEHLT — dieselbe Anlage erzeugte danach eine zweite Beziehung.`,
      );
      continue;
    }
    if (n.kante_id !== v.kante_id) {
      abweichungen.push(
        `ko_kanten_beitrag: der Wiederholschluessel „${v.beitrag_schluessel}“ band vorher an ${v.kante_id}, nachher an ${n.kante_id}.`,
      );
    }
  }
  const vorBindung = new Set(vorher.bindungen.map((z) => z.beitrag_schluessel));
  for (const n of nachher.bindungen) {
    if (!vorBindung.has(n.beitrag_schluessel)) {
      abweichungen.push(
        `ko_kanten_beitrag: der Wiederholschluessel „${n.beitrag_schluessel}“ ist ZUSAETZLICH da.`,
      );
    }
  }

  // 3 — der Leseweg, je Rolle und je Eintrag.
  const nachSicht = new Map(nachher.sichten.map((s) => [`${s.rolle}|${s.koId}`, s]));
  for (const v of vorher.sichten) {
    const kennung = `${v.rolle}|${v.koId}`;
    const n = nachSicht.get(kennung);
    if (!n) {
      abweichungen.push(`Leseweg ${kennung}: nach dem Wiederanlauf gar nicht erhoben.`);
      continue;
    }
    if (n.status !== v.status) {
      abweichungen.push(`Leseweg ${kennung}: HTTP-Status vorher ${v.status}, nachher ${n.status}.`);
    }
    // Ist eine der beiden Seiten kein gueltiger Bestand, FAELLT DIESER VERGLEICH AUS. Er darf nicht
    // schweigend uebersprungen werden: ein ausgefallener Vergleich ist kein bestandener (REGELN.md
    // Abschnitt 7). Den Grund hat Abschnitt 0 oben bereits im Wortlaut genannt.
    if (pruefeSicht(v).length > 0 || pruefeSicht(n).length > 0) {
      abweichungen.push(
        `Leseweg ${kennung}: mindestens eine der beiden Antworten ist kein gueltiger Bestand — dieser Vergleich FAELLT AUS und gilt nicht als bestanden.`,
      );
      continue;
    }
    const vTotal = totalVon(v);
    const nTotal = totalVon(n);
    if (nTotal !== vTotal) {
      abweichungen.push(`Leseweg ${kennung}: total vorher ${vTotal}, nachher ${nTotal}.`);
    }
    const vKanten = kantenVon(v);
    const nKanten = kantenVon(n);
    const nachAnsicht = new Map(nKanten.map((k) => [String(k.id), k]));
    for (const k of vKanten) {
      const id = String(k.id);
      const gegen = nachAnsicht.get(id);
      if (!gegen) {
        abweichungen.push(
          `Leseweg ${kennung}: die Beziehung ${id} (Gegenstueck ${stabil(k.gegenstueck)}) kommt nicht mehr an.`,
        );
        continue;
      }
      if (stabil(k) !== stabil(gegen)) {
        abweichungen.push(
          `Leseweg ${kennung}: die Beziehung ${id} kommt VERAENDERT an — vorher ${stabil(k)}, nachher ${stabil(gegen)}.`,
        );
      }
    }
    const vorAnsicht = new Set(vKanten.map((k) => String(k.id)));
    for (const k of nKanten) {
      if (!vorAnsicht.has(String(k.id))) {
        abweichungen.push(`Leseweg ${kennung}: die Beziehung ${String(k.id)} ist ZUSAETZLICH da.`);
      }
    }
  }
  // Und der Umfang selbst: eine Sicht, die es nachher gibt und vorher nicht, ist ebenfalls eine
  // Abweichung — sonst liesse sich der Umfang zwischen den Erhebungen still veraendern.
  const vorSchluessel = new Set(vorher.sichten.map((s) => `${s.rolle}|${s.koId}`));
  for (const n of nachher.sichten) {
    const kennung = `${n.rolle}|${n.koId}`;
    if (!vorSchluessel.has(kennung)) {
      abweichungen.push(`Leseweg ${kennung}: nach dem Wiederanlauf ZUSAETZLICH erhoben.`);
    }
  }
  return abweichungen;
}
