// ================================================================================================
// JOB 4337 · DER WERKZEUGKASTEN DER EINEN DEMO-STRECKE — und was hier NEU ist statt abgeschrieben.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie hält, was die Integrationsdatei daneben braucht und was es im Haus
// noch nicht gibt. Alles, was es GIBT, wird IMPORTIERT und nicht nachgebaut:
//
//   · Chromium, Profil, Tastaturweg            → `tests/gast-nutzerweg/browserweg.ts`
//   · Die echte Sitzung am Draht (Kekse)       → `tests/gast-nutzerweg/strecke.ts` (`Sitzung`,
//     `PASSWORT`, `mussGelingen`)
//   · Die Bedienschritte des Dateiwegs         → `tests/ux19-speichern-oeffnen-reload/ux19-buehne.ts`
//     und `tests/d3-dateien-durchgaengig/d3-buehne.ts` (sichtbarer Dateiwähler, Einreichen, `satz`)
//   · Sichtbarkeit mit Kalibrierung, Wegwerf-Datenbank, gebaute Fläche
//                                              → `tests/import-wiederoeffnen-nutzerweg/strecke.ts`
//     (JOB 4324; seine Ableser tragen in ihren Meldungen die Kennung 4324 — sie sind GELIEHEN und
//     werden bewusst nicht kopiert, damit es im Haus EINE Sichtbarkeitszusicherung gibt.)
//   · Der echte .docx-Bauer                    → `tests/m5-docx-bildunterschriften/docx-bauen.ts`
//
// ------------------------------------------------------------------------------------------------
// WAS NEU IST — und warum es nicht anders ging.
// ------------------------------------------------------------------------------------------------
//
// 1. DER ECHTE SERVERPROZESS. Jede vorhandene Browserstrecke des Hauses (4223/4324/4326) baut die
//    App IM Testprozess (`starteStrecke` → `app.listen`). Für diesen Auftrag reicht das nicht: S7
//    verlangt einen ECHTEN Prozessneustart („nicht nur als Instanzwechsel im selben Prozess",
//    Auftrag §8.4). Gestartet wird deshalb `services/app/src/server.ts` als eigener OS-Prozess —
//    derselbe Einstiegspunkt, den auch `tests/demo-zugang-start/echter-serverstart.test.ts:40`
//    fährt, und derselbe, der im Betrieb läuft. Er bringt seine gebaute Fläche selbst mit
//    (`configureWebDelivery`, `server.ts:59-66`), es braucht also kein `mitFlaeche()`.
//
// 2. DIE PRÜFDATEI. `tests/fixtures/sample.docx` trägt genau EINEN Satz; jedes Wort daraus steht
//    damit auch in der Kurzfassung, die der Server aus dem ersten Block des Rumpfes ableitet
//    (`capture-routes.ts:65-72`, `kernaussageAusHtml`). Ein Suchtreffer darauf bewiese dann NICHT
//    mehr, dass der Dokumentinhalt die Strecke überlebt hat (das ist die Lehre aus JOB 3825). Die
//    Prüfdatei dieses Laufs wird deshalb mit dem echten Bauer aus JOB 3210 erzeugt: das
//    `DOKUMENTWORT` steht im DRITTEN Absatz — nicht im Dateinamen (aus dem der Titel entsteht,
//    `captureFromFile.ts:413`) und nicht im ersten Block. Ob das WIRKLICH so ist, wird nicht
//    geglaubt, sondern je Lauf am angelegten Objekt gemessen (`isolationsbefund`).
//
// 3. DER FELDWEISE SICHTBARKEITSABLESER. Der geliehene Ableser aus 4324 sucht den Satz auf der
//    GANZEN Seite. Für „die Trefferzeile zeigt den Freigabestatus" taugt das nicht: das Wort
//    „Validiert" steht auf der Bibliotheksfläche auch am Filterschalter `bib-segment-validiert`
//    (`BibliothekListe.tsx:306-316`). Eine Zusicherung darauf wäre grün, während die Zeile schwiege.
//    Gemessen wird deshalb FELDWEISE (REGELN.md 9: „feldweise, nicht die Kachel als Ganzes"), und
//    die Kalibrierung blendet genau dieses Feld aus.
//
// KEINE PRODUKTDATEI WIRD BERÜHRT.
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import type { Pool, QueryResultRow } from "pg";
import { expect } from "vitest";
import { quellenanzeige } from "../d3-dateien-durchgaengig/d3-buehne";
import { fn } from "../design/h3-blatt-buehne";
import { type Sitzung, mussGelingen } from "../gast-nutzerweg/strecke";
import {
  DOCX_MIME,
  SELEKTOR_DA,
  type SeiteMitDialogUndRoute,
  aufSichtbarkeitWarten,
  aufZustandWarten,
  sichtbarZugesichert,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import { type Absatz, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import type { DateiAnlage } from "../ux19-speichern-oeffnen-reload/ux19-buehne";

export const JOB = "[KLARWERK] JOB 4337";

// ------------------------------------------------------------------------------------------------
// 1 · Die Prüfdatei — echte .docx-Bytes, mit einem Wort, das NUR in ihr steht
// ------------------------------------------------------------------------------------------------

/** Der Dateiname, den ein Mensch im Dateidialog wählt. Aus ihm entsteht der Titel des Entwurfs. */
export const DATEI_NAME = "betriebsanweisung-ventil.docx";

/**
 * Der erste Absatz. Er ist der ERSTE BLOCK des Rumpfes und wandert damit in die Kurzfassung
 * (`kernaussageAusHtml`) — deshalb steht das `DOKUMENTWORT` ausdrücklich NICHT in ihm.
 */
export const ERSTER_SATZ =
  "Diese Betriebsanweisung gilt fuer die Wartung der Portalanlagen der Werkstatt.";

/**
 * DIE ABSÄTZE VOR DEM BELEG-ABSATZ — und warum es mehrere sind, GEMESSEN statt geraten.
 *
 * Erster Anlauf (Cloud-Lauf 05922632b38bd150b4b5dd39): die Prüfdatei trug drei kurze Absätze, und
 * die Kernaussage des angelegten Objekts lautete danach WÖRTLICH „Quelle: … Diese Betriebsanweisung
 * … Vor jeder Wartung … Bei Ueberdruck schliesst die Rueckschlagklappe4337 …" — das Dokumentwort
 * stand also auch im Kurzfeld, und ein Suchtreffer darauf hätte den Dokumentinhalt nicht mehr
 * belegt (`isolationsbefund` meldete `['statement']`).
 *
 * DER GRUND, am Quelltext nachgelesen: der Ganzdokument-Weg schickt den ganzen Text als Aussage mit,
 * und der Server kürzt sie kanonisch auf `KERNAUSSAGE_MAX` (500 Zeichen, an der Satzgrenze,
 * `services/structure/src/kernaussage.ts:38-70`, gerufen in `capture-routes.ts:65-72`). Ein kurzes
 * Dokument passt damit VOLLSTÄNDIG in die Kernaussage.
 *
 * DESHALB STEHEN HIER FÜNF ABSÄTZE: der Beleg-Absatz beginnt erst weit hinter dem 500. Zeichen des
 * Klartextes und wird von der Kürzung abgeschnitten. Das ist keine Verlegenheitslösung, sondern die
 * Lage jedes echten Dokuments: eine Betriebsanweisung ist länger als eine Kernaussage. Dass es
 * WIRKLICH so ist, wird nicht geglaubt — `isolationsbefund` misst es je Lauf am angelegten Objekt,
 * und S3 sichert zusätzlich zu, dass die Kernaussage nicht etwa leer ist (eine leere Kurzfassung
 * erfüllte die Isolation, ohne etwas zu belegen).
 */
export const VORLAUF_SAETZE: readonly string[] = [
  "Vor jeder Wartung wird die Anlage drucklos gemacht und gegen Wiedereinschalten gesichert.",
  "Die zustaendige Fachkraft traegt Datum, Uhrzeit und Anlagennummer in das Wartungsbuch ein.",
  "Alle Absperrorgane werden in der Reihenfolge geschlossen, die der Anlagenplan vorgibt.",
  "Nach Abschluss der Arbeiten wird die Anlage langsam und in Stufen wieder unter Druck gesetzt.",
  "Bleibt eine Undichtigkeit bestehen, wird die Anlage sofort erneut abgestellt und gemeldet.",
];

/**
 * DAS ISOLIERTE DOKUMENTWORT (JOB 3825). Es steht ausschliesslich im dritten Absatz der Prüfdatei:
 * nicht im Dateinamen, nicht im ersten Block, und der Test tippt es in KEIN Feld ein. Ein
 * Suchtreffer darauf kann deshalb nur aus dem übernommenen Dokumentinhalt stammen.
 *
 * Die Jobnummer im Wort ist Absicht: sie macht es auch gegenüber jedem anderen Bestand eindeutig.
 * Reines ASCII — der Suchvergleich des Produkts ist ein `lower.includes(term)`
 * (`effective-search-document.ts:120-122`), und eine Umlautfrage gehört nicht in diesen Nachweis.
 */
export const DOKUMENTWORT = "Rueckschlagklappe4337";

/** Der Absatz, in dem das Dokumentwort steht. */
export const DOKUMENTSATZ = `Bei Ueberdruck schliesst die ${DOKUMENTWORT} den Nebenstrang zum Sammelbehaelter.`;

/**
 * Ein Wort, das NIRGENDS steht — für die Gegenkontrolle der Suche (Auftrag §5.6). Ohne sie bewiese
 * ein Treffer nichts: eine Suche, die immer alles liefert, fände das Objekt auch.
 */
export const FREMDWORT = "Kolbenstangenfremdwort4337";

/** Die Absatzfolge der Prüfdatei — öffentlich, damit die Rückgabe sie belegen kann. */
export const ABSAETZE: readonly Absatz[] = [
  { art: "text", text: ERSTER_SATZ },
  ...VORLAUF_SAETZE.map((text): Absatz => ({ art: "text", text })),
  { art: "text", text: DOKUMENTSATZ },
];

/**
 * Die reale Prüfdatei als Playwright-Anlage: echte .docx-Bytes, im Speicher gebaut.
 *
 * EINMAL GEBAUT, DANN DIESELBE — und das ist keine Sparsamkeit, sondern die Voraussetzung des
 * Quellenwiederaufrufs. Ein Mensch wählt EINE Datei; der Vergleich „dieselbe Datei kommt zurück"
 * muss gegen GENAU die Bytes laufen, die hineingegangen sind. Ein zweiter Bauaufruf wäre eine
 * zweite Datei, und ein Unterschied an ihr sagte nichts über den Server (gemessen im Kalibrierlauf
 * fb9f99910807de111562a99b: gleiche Länge, anderer Abdruck — zwei Bauläufe desselben Inhalts sind
 * NICHT zeichengleich).
 */
let anlageZwischenspeicher: DateiAnlage | undefined;
export async function demoAnlage(): Promise<DateiAnlage> {
  if (anlageZwischenspeicher === undefined) {
    const { bytes } = await baueDocx(ABSAETZE);
    anlageZwischenspeicher = { name: DATEI_NAME, mimeType: DOCX_MIME, buffer: bytes };
  }
  return anlageZwischenspeicher;
}

/**
 * OB `DOKUMENTWORT` SEINEN NAMEN VERDIENT — gemessen am TATSÄCHLICH angelegten Objekt, nicht
 * behauptet (JOB 3825, `Isolation`). Zurück kommen die Kurzfelder, in denen das Wort EBENFALLS
 * steht. Leer ist der gute Fall; jeder Eintrag hier macht einen Suchtreffer als Dokumentbeleg
 * wertlos.
 */
export function isolationsbefund(
  ko: { title?: unknown; statement?: unknown; category?: unknown; tags?: unknown },
  wort = DOKUMENTWORT,
): string[] {
  const klein = wort.toLowerCase();
  const felder: [string, string][] = [
    ["title", typeof ko.title === "string" ? ko.title : ""],
    ["statement", typeof ko.statement === "string" ? ko.statement : ""],
    ["category", typeof ko.category === "string" ? ko.category : ""],
    ["tags", Array.isArray(ko.tags) ? ko.tags.join(" ") : ""],
  ];
  return felder.filter(([, wert]) => wert.toLowerCase().includes(klein)).map(([name]) => name);
}

// ------------------------------------------------------------------------------------------------
// 2 · Der echte Serverprozess
// ------------------------------------------------------------------------------------------------

/** Ein freier Port vom Betriebssystem — kein geratener (Bauart aus `tests/insel-echter-start`). */
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
          schiefgegangen(new Error(`${JOB}: kein freier Port ermittelbar.`));
        }
      });
    });
  });
}

export interface Serverlauf {
  readonly marke: string;
  readonly pid: number;
  readonly port: number;
  readonly basis: string;
  readonly ausgabe: () => string;
  readonly lebt: () => boolean;
  /** SIGTERM an die Prozessgruppe, dann warten, bis der Prozess von SELBST geht. */
  readonly beendeRegulaer: (fristMs: number) => Promise<boolean>;
  /** Der Notausgang für `afterAll` — SIGKILL. */
  readonly abschiessen: () => Promise<void>;
}

/**
 * STARTET `services/app/src/server.ts` ALS EIGENEN OS-PROZESS.
 *
 * DIE UMGEBUNG WIRD GEBAUT UND NICHT GEERBT, aus demselben Grund wie in
 * `tests/insel-echter-start/echter-lauf.ts:197-219`: `tests/setup-env.ts` stellt für die Suite vier
 * Schalter (Selbstregistrierung, Demo-Seed, externe Suche, Protokollstufe). Würden sie mitvererbt,
 * liefe hier nicht der Server, den ein Betreiber startet, sondern eine Testinstanz. Weitergereicht
 * wird nur, was ein leerer Rechner ohnehin hat — plus drei benannte Ausnahmen:
 *
 *   · `KLARWERK_SKIP_KEYCHAIN=1` — ein Prüflauf fasst keinen persönlichen Schlüsselbund an
 *     (dieselbe Ausnahme und Begründung wie `tools/test:8`).
 *   · `EXTERNAL_SEARCH=off`      — kein Dritter wird ungefragt kontaktiert (Lehre aus mega25 Block A,
 *     `tests/setup-env.ts:31`). Dieser Weg ruft die externe Suche nicht; der Schalter sorgt dafür,
 *     dass er es auch nicht versehentlich kann.
 *   · `DATABASE_URL`/`PORT`      — die Wegwerf-Datenbank und der freie Port dieses Laufs.
 *
 * `NODE_ENV` bleibt UNGESETZT: der Startvertrag (`start-vertrag.ts`) verlangt seine Pflichtwerte
 * ausschliesslich in Produktion, und eine Produktionsinstanz ist hier nicht der Gegenstand.
 *
 * `detached` und die Beendigung über die Prozessgruppe sind kein Zierrat: der Neustart in S7 muss
 * den Port wirklich freigeben, und ein Kind ohne Elternteil bliebe daran hängen.
 */
export function starteServerprozess(o: {
  marke: string;
  port: number;
  datenbankUrl: string;
}): Serverlauf {
  const teile: string[] = [];
  const kind: ChildProcess = spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
    cwd: resolve(process.cwd()),
    env: {
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      LANG: process.env.LANG ?? "de_DE.UTF-8",
      TZ: process.env.TZ ?? "Europe/Berlin",
      KLARWERK_SKIP_KEYCHAIN: "1",
      EXTERNAL_SEARCH: "off",
      PORT: String(o.port),
      DATABASE_URL: o.datenbankUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  kind.stdout?.on("data", (stueck: Buffer) => teile.push(stueck.toString("utf8")));
  kind.stderr?.on("data", (stueck: Buffer) => teile.push(stueck.toString("utf8")));
  let beendet = false;
  kind.on("exit", () => {
    beendet = true;
  });
  if (kind.pid === undefined) {
    throw new Error(`${JOB}: der Serverprozess (${o.marke}) hat keine Prozessnummer bekommen.`);
  }
  const pid = kind.pid;
  const toeten = (signal: NodeJS.Signals): void => {
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        kind.kill(signal);
      } catch {
        /* schon beendet */
      }
    }
  };
  return {
    marke: o.marke,
    pid,
    port: o.port,
    basis: `http://127.0.0.1:${o.port}`,
    ausgabe: () => teile.join(""),
    lebt: () => !beendet,
    beendeRegulaer: (fristMs) =>
      new Promise<boolean>((fertig) => {
        if (beendet) {
          fertig(true);
          return;
        }
        let entschieden = false;
        const schluss = (vonSelbst: boolean): void => {
          if (!entschieden) {
            entschieden = true;
            fertig(vonSelbst);
          }
        };
        kind.on("exit", () => schluss(true));
        toeten("SIGTERM");
        setTimeout(() => schluss(false), fristMs).unref?.();
      }),
    abschiessen: () =>
      new Promise<void>((fertig) => {
        if (beendet) {
          fertig();
          return;
        }
        kind.on("exit", () => fertig());
        toeten("SIGKILL");
        setTimeout(fertig, 5_000).unref?.();
      }),
  };
}

export interface Gesundheit {
  readonly erreicht: boolean;
  readonly code: number;
  readonly rumpf: string;
  readonly wartezeitMs: number;
}

/**
 * WARTET MIT ENDLICHER FRIST AUF `/health` (`build-app.ts:2281`). Solange nichts geantwortet hat,
 * gilt der Prozess als UNBEKANNT, nie als gesund. Stirbt er unterwegs, bricht das Warten SOFORT ab
 * — sonst stünde am Ende eine Frist statt eines Grundes.
 */
export async function warteAufGesundheit(lauf: Serverlauf, fristMs: number): Promise<Gesundheit> {
  const beginn = Date.now();
  let letzterRumpf = "";
  let letzterCode = 0;
  while (Date.now() - beginn < fristMs) {
    if (!lauf.lebt()) {
      break;
    }
    try {
      const antwort = await fetch(`${lauf.basis}/health`, { signal: AbortSignal.timeout(2_000) });
      letzterCode = antwort.status;
      letzterRumpf = await antwort.text();
      if (antwort.status === 200) {
        return { erreicht: true, code: 200, rumpf: letzterRumpf, wartezeitMs: Date.now() - beginn };
      }
    } catch {
      /* noch nicht da — weiter warten */
    }
    await new Promise((weiter) => setTimeout(weiter, 250));
  }
  return {
    erreicht: false,
    code: letzterCode,
    rumpf: letzterRumpf,
    wartezeitMs: Date.now() - beginn,
  };
}

/** Der Prozess steht und antwortet — sonst wirft es MIT seiner Ausgabe, nicht mit einer Frist. */
export async function serverMussStehen(lauf: Serverlauf, fristMs: number): Promise<Gesundheit> {
  const gesundheit = await warteAufGesundheit(lauf, fristMs);
  if (!gesundheit.erreicht) {
    throw new Error(
      `${JOB}: der Serverprozess „${lauf.marke}" (pid ${lauf.pid}) hat in ${gesundheit.wartezeitMs} ms von ${fristMs} ms nicht mit HTTP 200 auf ${lauf.basis}/health geantwortet (zuletzt ${gesundheit.code}, lebt=${lauf.lebt()}).\nSeine Ausgabe:\n${lauf.ausgabe().slice(-4000)}`,
    );
  }
  return gesundheit;
}

// ------------------------------------------------------------------------------------------------
// 3 · Die Vorbereitung am Draht — über die ECHTEN Routen, mit echten Keksen
// ------------------------------------------------------------------------------------------------
//
// `ersteinrichtung`/`gastAnlegen` aus `tests/gast-nutzerweg/strecke.ts` verlangen eine `Strecke`
// (also eine App IM Testprozess) und sind deshalb hier nicht benutzbar — der Server ist ein eigener
// Prozess. Benutzt werden die beiden Bausteine, die es doch sind: die Keks-`Sitzung` und
// `mussGelingen`. Die Routen sind Zeichen für Zeichen dieselben.

export interface Konto {
  readonly id: string;
  readonly email: string;
  readonly rolle: string;
}

/**
 * Der erste Administrator einer LEEREN Instanz — über `POST /api/auth/setup`, genau wie
 * `ersteinrichtung` in `tests/gast-nutzerweg/strecke.ts:204`. Die dortige Fassung verlangt eine
 * `Strecke` (also eine App IM Testprozess) und ist an einem eigenen Serverprozess deshalb nicht
 * benutzbar; Route, Statuserwartung und Begründung sind unverändert dieselben. Das zweite Konto
 * legt `gastAnlegen` an — es nimmt eine blosse `Sitzung` und wird darum WIRKLICH geliehen.
 */
export async function ersteinrichtungAmProzess(
  sitzung: Sitzung,
  email: string,
  passwort: string,
): Promise<Konto> {
  const antwort = mussGelingen(
    "Ersteinrichtung (POST /api/auth/setup)",
    await sitzung.sende("POST", "/api/auth/setup", {
      name: "Betreiber",
      email,
      password: passwort,
    }),
    201,
  );
  const nutzer = (antwort.json as { user?: { id?: string; role?: string } }).user ?? {};
  return { id: String(nutzer.id ?? ""), email, rolle: String(nutzer.role ?? "") };
}

// ------------------------------------------------------------------------------------------------
// 4 · Die Datenbank — unabhängig vom Browser gefragt
// ------------------------------------------------------------------------------------------------
//
// JEDE Bestandslesung verlangt ZUERST eine gültige Zeile (Lehre 4326 R1, Korrekturpflicht 1: „T2
// muss vor jedem Vergleich genau eine gültige Bestandszeile verlangen"). Ohne diese Vorstufe wäre
// ein `undefined`-Feldvergleich gegen `undefined` grün, und der Nachweis hätte nichts gemessen.

/** GENAU EINE Zeile — keine, zwei oder mehr sind ein benannter Fehlschlag, kein leiser Rückfall. */
export async function genauEineZeile<T extends QueryResultRow>(
  pool: Pool,
  sql: string,
  werte: readonly unknown[],
  was: string,
): Promise<T> {
  const antwort = await pool.query<T>(sql, [...werte]);
  expect(
    antwort.rows.length,
    `${was}: die Bestandsabfrage lieferte ${antwort.rows.length} Zeilen statt genau einer — ohne gültige Zeile ist jeder folgende Vergleich keine Aussage über den Bestand.\nSQL: ${sql}\nWerte: ${JSON.stringify(werte)}`,
  ).toBe(1);
  return antwort.rows[0] as T;
}

/** Die Zeilenzahl einer Tabelle. Der Name kommt aus dieser Datei, nie von aussen. */
export async function zeilenzahl(pool: Pool, tabelle: Tabelle): Promise<number> {
  const antwort = await pool.query<{ anzahl: string }>(
    `SELECT count(*)::text AS anzahl FROM ${tabelle}`,
  );
  return Number.parseInt(antwort.rows[0]?.anzahl ?? "-1", 10);
}

/** Die Tabellen, die diese Strecke liest — eine geschlossene Aufzählung, kein freier Text. */
export type Tabelle = "users" | "drafts" | "kos" | "ratings" | "ko_evidence" | "audit";
export const TABELLEN: readonly Tabelle[] = [
  "users",
  "drafts",
  "kos",
  "ratings",
  "ko_evidence",
  "audit",
];

/** Die Zeile eines Kontos — Rolle und Freigabe, wie die Datenbank sie führt. */
export interface Kontozeile extends QueryResultRow {
  id: string;
  email: string;
  role: string;
  approved: boolean;
}

export function kontozeile(pool: Pool, email: string): Promise<Kontozeile> {
  return genauEineZeile<Kontozeile>(
    pool,
    "SELECT id, email, role, approved FROM users WHERE email = $1",
    [email],
    `Konto „${email}" in users`,
  );
}

/** Die Zeile eines Wissensobjekts — Status aus der Spalte UND das volle Objekt. */
export interface Kozeile extends QueryResultRow {
  id: string;
  status: string;
  category: string;
  data: Record<string, unknown>;
}

export function kozeile(pool: Pool, koId: string): Promise<Kozeile> {
  return genauEineZeile<Kozeile>(
    pool,
    "SELECT id, status, category, data FROM kos WHERE id = $1",
    [koId],
    `Wissensobjekt ${koId} in kos`,
  );
}

/** Die Bewertungszeile GENAU EINES Prüfers zu GENAU EINEM Objekt. */
export interface Bewertungszeile extends QueryResultRow {
  ko_id: string;
  user_id: string;
  data: { verdict?: unknown; userId?: unknown; koVersion?: unknown; createdAt?: unknown };
}

export function bewertungszeile(pool: Pool, koId: string): Promise<Bewertungszeile> {
  return genauEineZeile<Bewertungszeile>(
    pool,
    "SELECT ko_id, user_id, data FROM ratings WHERE ko_id = $1",
    [koId],
    `Bewertung zu ${koId} in ratings`,
  );
}

/** Der Auditbeleg GENAU EINER Handlung an GENAU EINEM Ziel. */
export interface Auditzeile extends QueryResultRow {
  seq: number;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
}

export function auditzeile(pool: Pool, aktion: string, ziel: string): Promise<Auditzeile> {
  return genauEineZeile<Auditzeile>(
    pool,
    "SELECT seq, actor, action, target, payload FROM audit WHERE action = $1 AND target = $2",
    [aktion, ziel],
    `Auditbeleg „${aktion}" zu ${ziel}`,
  );
}

/** Die Belegstellen (Quellen) eines Objekts, nach Kennung sortiert. */
export async function belegzeilen(
  pool: Pool,
  koId: string,
): Promise<{ id: string; kind: string; data: Record<string, unknown> }[]> {
  const antwort = await pool.query<{ id: string; kind: string; data: Record<string, unknown> }>(
    "SELECT id, kind, data FROM ko_evidence WHERE ko_id = $1 ORDER BY id",
    [koId],
  );
  return antwort.rows;
}

/**
 * ALLE Auditbelege zu EINEM Objekt — MIT ihrer Ladung.
 *
 * RUNDE 2, BENs KORREKTURPFLICHT 1: Bis hierher las das Bestandsabbild aus `audit` nur
 * `seq, actor, action`. BENs Gegenprobe `UPDATE audit SET payload = '{}'::jsonb WHERE target = $1`
 * liess das Abbild deshalb ZEICHENGLEICH — sämtliche Fassungsbezüge konnten verschwinden, und der
 * Neustartnachweis merkte es nicht („Audit-payload gelöscht, Abbild dennoch identisch", zweimal
 * reproduziert, zuletzt Lauf 7f0ebdb69e69787a1e69c955). Die Ladung ist ab jetzt Pflichtfeld: sie
 * trägt `koVersion`, also die Fassung, über die entschieden wurde (JOB 3789), und ohne sie ist
 * „der Bestand ist unverändert" eine halbe Aussage.
 */
export async function auditzeilenZuObjekt(pool: Pool, koId: string): Promise<Auditzeile[]> {
  const antwort = await pool.query<Auditzeile>(
    "SELECT seq, actor, action, target, payload FROM audit WHERE target = $1 ORDER BY seq",
    [koId],
  );
  return antwort.rows;
}

/**
 * DIE FASSUNGSBEZÜGE DER BELEGE — fachlich geprüft, nicht nur zeichenweise verglichen.
 *
 * Der Abbildvergleich sagt „etwas hat sich geändert"; diese Prüfung sagt WAS und AN WELCHEM Beleg.
 * Beide stehen nebeneinander, weil sie zwei verschiedene Fragen beantworten (Lehre 4330 R1: den
 * Fassungsbezug unabhängig vom geschriebenen Ergebnis erwarten).
 *
 * GEPRÜFT WERDEN DIE BEIDEN ENTSCHEIDUNGSBELEGE dieses Weges: die Bewertung der zweiten Person
 * (`ko.rated`) und die Freigabe des Admins (`ko.admin-validated`). Jeder MUSS eine Ladung mit genau
 * der gelesenen Fassung tragen. Fehlt die Ladung, ist sie leer oder trägt sie eine andere Zahl,
 * nennt die Meldung den Beleg beim Namen und bei seiner Nummer.
 */
export async function pruefeAuditFassungen(
  pool: Pool,
  o: { koId: string; fassung: number; akteure: Readonly<Record<string, string>>; marke: string },
): Promise<void> {
  const zeilen = await auditzeilenZuObjekt(pool, o.koId);
  for (const [aktion, akteur] of Object.entries(o.akteure)) {
    const beleg = zeilen.find((zeile) => zeile.action === aktion);
    if (beleg === undefined) {
      throw new Error(
        `${o.marke}: der Auditbeleg „${aktion}" zu ${o.koId} fehlt — vorhanden: ${JSON.stringify(zeilen.map((z) => ({ seq: z.seq, action: z.action })))}`,
      );
    }
    expect(
      beleg.actor,
      `${o.marke}: Auditbeleg „${aktion}" (Beleg ${beleg.seq}) nennt den Akteur ${beleg.actor} statt ${akteur}`,
    ).toBe(akteur);
    expect(
      beleg.payload?.koVersion,
      `${o.marke}: Audit-Fassungsbezug verändert: Beleg ${beleg.seq} („${aktion}") trägt koVersion=${JSON.stringify(beleg.payload?.koVersion)} statt ${o.fassung} — die Entscheidung hängt damit nicht mehr an der gelesenen Fassung (Ladung: ${JSON.stringify(beleg.payload)})`,
    ).toBe(o.fassung);
  }
}

/**
 * DER ZUGESAGTE UMFANG DES BESTANDES am Ende des Weges — gemessen, nicht geraten.
 *
 * `drafts` steht auf 0, weil der Promote den fortgesetzten Entwurf serverseitig entfernt
 * (SCRUM-354, `Capture.tsx:2100`); `ko_evidence` auf 0 aus dem Grund, den S3b ausschreibt (Vertrag
 * H2). `audit` fehlt hier bewusst: die Kette wächst mit jeder Anmeldung, und eine feste Zahl machte
 * den Fall an genau der Handlung rot, die er belegen soll (s. `bestandsabbild`).
 */
export const ERWARTETER_UMFANG: Readonly<Partial<Record<Tabelle, number>>> = {
  users: 2,
  drafts: 0,
  kos: 1,
  ratings: 1,
  ko_evidence: 0,
};

/**
 * Die Zeilenzahlprüfung des Normalwegs — EINE Funktion, von S7 und von der Gegenprobe K5 gerufen.
 *
 * RUNDE 2, BENs KORREKTURPFLICHT 3: K5 verstellte bis hierher nur eine Sollzahl in der Gegenprobe
 * selbst und fasste den Bestand nie an. Damit kalibrierte sie ihre eigene Erwartung statt der
 * Zusicherung, die der Normalweg fährt. Jetzt gibt es genau eine Zusicherung, und die Gegenprobe
 * legt eine echte Zeile in die Datenbank.
 */
export async function pruefeBestandsumfang(pool: Pool, marke: string): Promise<void> {
  for (const [tabelle, soll] of Object.entries(ERWARTETER_UMFANG)) {
    const ist = await zeilenzahl(pool, tabelle as Tabelle);
    expect(
      ist,
      `${marke}: die Tabelle \`${tabelle}\` trägt ${ist} Zeile(n) statt der zugesagten ${soll} — der Bestand dieses Weges ist nicht mehr der gemessene`,
    ).toBe(soll);
  }
}

/**
 * DAS ABBILD DES BESTANDES — die Vergleichsgrösse für „vor und nach dem Neustart unverändert".
 *
 * Verglichen wird die SERIALISIERUNG derselben gelesenen Struktur: zwei Lesungen eines unveränderten
 * Bestandes ergeben zeichengleich dasselbe, jede Änderung an irgendeinem Feld ändert sie — seit
 * Runde 2 ausdrücklich AUCH an der Ladung der Auditbelege (s. `auditzeilenZuObjekt`).
 *
 * WARUM DIE GESAMTZAHL DER AUDITZEILEN NICHT DARIN STEHT, und das ist gemessen statt vermutet
 * (Cloud-Lauf 88b24a2b9de1c5f8ec9d9cb7, S7: „audit":9 gegen „audit":10): der Weg nach dem Neustart
 * enthält eine ECHTE ANMELDUNG in einer neuen Sitzung, und die schreibt ihren eigenen Beleg. Eine
 * Gesamtzahl hier machte den Fall an genau der Handlung rot, die er belegen soll. Was zählt, ist der
 * Bestand DIESES Objekts: seine Auditzeilen stehen vollständig im Abbild (`auditZumObjekt`), und
 * dass keine davon verschwindet, prüft der Fall zusätzlich an der Gesamtzahl (append-only).
 */
export async function bestandsabbild(pool: Pool, koId: string): Promise<string> {
  const zahlen: Record<string, number> = {};
  for (const tabelle of TABELLEN) {
    if (tabelle === "audit") {
      continue;
    }
    zahlen[tabelle] = await zeilenzahl(pool, tabelle);
  }
  const ko = await kozeile(pool, koId);
  const bewertung = await bewertungszeile(pool, koId);
  const belege = await belegzeilen(pool, koId);
  const auditZumObjekt = await auditzeilenZuObjekt(pool, koId);
  const konten = await pool.query<{ email: string; role: string }>(
    "SELECT email, role FROM users ORDER BY email",
  );
  return JSON.stringify({
    zahlen,
    ko,
    bewertung,
    belege,
    auditZumObjekt,
    konten: konten.rows,
  });
}

// ------------------------------------------------------------------------------------------------
// 4b · Der Quellenwiederaufruf — die ORIGINALBYTES, mit den Keksen eines echten Kontos
// ------------------------------------------------------------------------------------------------
//
// `Sitzung.sende` liest jede Antwort als TEXT (`strecke.ts:99`). Für eine .docx ist das kein
// gültiger Weg: die Bytes kämen als UTF-8 gedeutete Zeichenkette zurück und wären danach nicht mehr
// dieselben. Dieser eine Weg hier holt sie deshalb als `ArrayBuffer` — sonst wäre „dieselbe Datei"
// eine Behauptung über eine Umkodierung (die Lehre aus JOB 3801 R2: „ein HTTP 200 sagt nur, dass
// irgendetwas kam").

export interface Rohantwort {
  readonly status: number;
  readonly typ: string;
  readonly laenge: number;
  readonly abdruck: string;
}

/** Der SHA-256-Abdruck eines Puffers — die Vergleichsgrösse für „Byte für Byte dieselbe Datei". */
export function abdruck(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Meldet sich am echten Prozess an und lädt GENAU diesen Pfad als Bytes. Zurück kommen Status,
 * Inhaltstyp, Länge und Abdruck — nie die Bytes selbst; in einer Fehlermeldung hätte ein
 * Dokumentrumpf nichts zu suchen.
 */
export async function holeRohbytes(
  basis: string,
  email: string,
  passwort: string,
  pfad: string,
): Promise<Rohantwort> {
  const anmeldung = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: passwort }),
  });
  if (anmeldung.status !== 200) {
    throw new Error(
      `${JOB}: die Anmeldung für den Quellenwiederaufruf scheiterte (${anmeldung.status}).`,
    );
  }
  const kopf = anmeldung.headers as unknown as { getSetCookie?: () => string[] };
  const kekse = (typeof kopf.getSetCookie === "function" ? kopf.getSetCookie() : [])
    .map((zeile) => zeile.split(";")[0] ?? "")
    .filter((teil) => teil.includes("="))
    .join("; ");
  const antwort = await fetch(`${basis}${pfad}`, {
    headers: kekse === "" ? {} : { cookie: kekse },
  });
  const bytes = new Uint8Array(await antwort.arrayBuffer());
  return {
    status: antwort.status,
    typ: antwort.headers.get("content-type") ?? "",
    laenge: bytes.byteLength,
    abdruck: abdruck(bytes),
  };
}

/** Die Adresse der Originaldatei, wie sie im Rumpf des Objekts verlinkt ist — `null`, wenn keine. */
export function rohpfadAusRumpf(bodyHtml: string): string | null {
  return /\/api\/objects\/[0-9a-fA-F-]+\/raw/.exec(bodyHtml)?.[0] ?? null;
}

/** Die Version der echten PostgreSQL — für die Protokollzeile. */
export async function pgKurzversion(pool: Pool): Promise<string> {
  const antwort = await pool.query<{ version: string }>("SELECT version()");
  return (antwort.rows[0]?.version ?? "(unbekannt)").split(" on ")[0] ?? "(unbekannt)";
}

// ------------------------------------------------------------------------------------------------
// 5 · Sichtbarkeit FELDWEISE — mit eingebauter Kalibrierung
// ------------------------------------------------------------------------------------------------
//
// Begründung, warum dieser Ableser neben dem geliehenen steht: s. Kopf dieser Datei, Punkt 3.
// Gesucht wird das Element, das den Text in einem EIGENEN Textknoten trägt UND dem Selektor
// entspricht; geprüft wird die ganze Kette nach oben (`display`, `visibility`, `opacity`), seine
// Fläche und seine Schriftfarbe. `textContent` kommt nicht vor — es liest auch, was in einem
// `display:none`-Teilbaum steht.

const FELD_HILFEN = `
  const durchsichtig = (farbe) =>
    farbe === 'transparent' || /rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*0(\\.0+)?\\s*\\)/.test(farbe);
  const sichtbar = (el) => {
    let e = el;
    while (e && e.nodeType === 1) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') { return false; }
      if (Number.parseFloat(s.opacity || '1') === 0) { return false; }
      e = e.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const eigenerText = (el) => {
    let text = '';
    for (let k = 0; k < el.childNodes.length; k += 1) {
      const kind = el.childNodes[k];
      if (kind.nodeType === 3) { text += kind.nodeValue || ''; }
    }
    return text.replace(/\\s+/g, ' ');
  };
  const felder = (sel, suche) => {
    const treffer = [];
    const alle = document.querySelectorAll(sel);
    for (let i = 0; i < alle.length; i += 1) {
      const el = alle[i];
      if (eigenerText(el).indexOf(suche) === -1) { continue; }
      if (!sichtbar(el)) { continue; }
      if (durchsichtig(getComputedStyle(el).color)) { continue; }
      treffer.push(el);
    }
    return treffer;
  };
`;

/** Wie viele SICHTBARE Felder dieses Selektors tragen diesen Text in einem eigenen Textknoten? */
export const FELD_ZAEHLEN = `([sel, suche]) => {${FELD_HILFEN}
  return felder(sel, suche).length;
}`;

/** Was an diesem Selektor überhaupt steht — für eine Meldung, die auf den Schuldigen zeigt. */
export const FELD_BEFUND = `([sel, suche]) => {${FELD_HILFEN}
  const alle = document.querySelectorAll(sel);
  const zeilen = [];
  for (let i = 0; i < alle.length; i += 1) {
    zeilen.push({
      text: eigenerText(alle[i]).trim().slice(0, 160),
      sichtbar: sichtbar(alle[i]),
    });
  }
  return JSON.stringify({ selektor: sel, gesucht: suche, gefunden: zeilen });
}`;

/** Blendet jedes sichtbare Trägerfeld aus und merkt den alten Stilwert. */
export const FELD_AUSBLENDEN = `([sel, suche, art]) => {${FELD_HILFEN}
  const ziele = felder(sel, suche);
  if (ziele.length === 0) { return 0; }
  const wert = art === 'display' ? 'none' : 'hidden';
  window.__kw4337 = [];
  for (let i = 0; i < ziele.length; i += 1) {
    const el = ziele[i];
    window.__kw4337.push({
      el: el,
      art: art,
      alt: el.style.getPropertyValue(art),
      prio: el.style.getPropertyPriority(art),
    });
    el.style.setProperty(art, wert, 'important');
  }
  return ziele.length;
}`;

/** Stellt die zuletzt ausgeblendeten Felder wieder her. */
export const FELD_EINBLENDEN = `() => {
  const p = window.__kw4337;
  if (!p) { return false; }
  for (let i = 0; i < p.length; i += 1) {
    const e = p[i];
    if (e.alt) { e.el.style.setProperty(e.art, e.alt, e.prio); } else { e.el.style.removeProperty(e.art); }
  }
  delete window.__kw4337;
  return true;
}`;

export type Ausblendart = "display" | "visibility";

/** Nur ausblenden — für die Gegenproben, die den Zustand STEHEN lassen sollen. */
export function feldAusblenden(
  seite: SeiteMitDialogUndRoute,
  selektor: string,
  text: string,
  art: Ausblendart = "display",
): Promise<number> {
  return seite.evaluate<number>(fn(FELD_AUSBLENDEN), [selektor, text, art]);
}

/** Die Rücknahme. */
export function feldEinblenden(seite: SeiteMitDialogUndRoute): Promise<boolean> {
  return seite.evaluate<boolean>(fn(FELD_EINBLENDEN));
}

// ------------------------------------------------------------------------------------------------
// 5b · Ausblenden, das ein Neuzeichnen ÜBERLEBT — die Voraussetzung für Gegenprobe K4
// ------------------------------------------------------------------------------------------------
//
// RUNDE 2, BENs GRUNDSATZ: „Jede Kalibrierung ruft die unveränderte Stationsprüfung auf." Für K4
// heisst das: nicht nur die eine Zusicherung, sondern `sucheUndPruefeTreffer` als Ganzes. Diese
// Prüfung sucht neu und öffnet den Treffer neu — React zeichnet die Lesefläche dabei NEU, und ein
// am Element gesetzter Stilwert (`FELD_AUSBLENDEN`) ist danach fort. Die Mutation wäre unterwegs
// verschwunden, und die Gegenprobe hätte am Ende einen unverstellten Zustand gemessen.
//
// Eine REGEL im Dokument überlebt das Neuzeichnen: sie hängt am Dokument, nicht am Knoten. Sie ist
// dabei kein schwächeres Mittel — sie blendet GENAU das benannte Feld aus, und die Fläche bleibt im
// Übrigen unangetastet. Ein `goto` nimmt sie mit; das tut K4 deshalb nicht.

/** Die Kennung des eingesetzten Regelblocks — eine, damit die Rücknahme nichts suchen muss. */
export const AUSBLENDREGEL_MARKE = "kw4337-ausblendregel";

export const REGEL_SETZEN = `([marke, css]) => {
  let block = document.getElementById(marke);
  if (!block) {
    block = document.createElement('style');
    block.id = marke;
    document.head.appendChild(block);
  }
  block.textContent = css;
  return true;
}`;

export const REGEL_ENTFERNEN = `(marke) => {
  const block = document.getElementById(marke);
  if (!block) { return false; }
  block.remove();
  return true;
}`;

/**
 * Blendet alles aus, was diesem Selektor entspricht — über eine Dokumentregel, die das Neuzeichnen
 * übersteht. Zurück kommt die Zahl der Knoten, die die Regel im Augenblick des Setzens trifft; ist
 * sie 0, verstellt die Gegenprobe nichts und sagt das (der Aufrufer sichert es zu).
 */
export async function ausblendregelSetzen(
  seite: SeiteMitDialogUndRoute,
  selektor: string,
  art: Ausblendart = "display",
): Promise<number> {
  const css = `${selektor} { ${art}: ${art === "display" ? "none" : "hidden"} !important; }`;
  await seite.evaluate<boolean>(fn(REGEL_SETZEN), [AUSBLENDREGEL_MARKE, css]);
  return seite.evaluate<number>(fn("(sel) => document.querySelectorAll(sel).length"), selektor);
}

/** Die Rücknahme der Dokumentregel. */
export function ausblendregelEntfernen(seite: SeiteMitDialogUndRoute): Promise<boolean> {
  return seite.evaluate<boolean>(fn(REGEL_ENTFERNEN), AUSBLENDREGEL_MARKE);
}

/**
 * DIE FELDWEISE SICHTBARKEITSZUSICHERUNG — mit ihrer Kalibrierung eingebaut, bei JEDEM Aufruf
 * (REGELN.md 9; dieselbe Bauform und derselbe Grund wie `sichtbarZugesichert` in JOB 4324:311-359).
 * Die Wiederherstellung läuft VOR dem Urteil und auch dann, wenn der Ableser wirft.
 */
export async function feldSichtbarZugesichert(
  seite: SeiteMitDialogUndRoute,
  selektor: string,
  text: string,
  feldname: string,
  art: Ausblendart = "display",
): Promise<void> {
  const befund = await seite.evaluate<string>(fn(FELD_BEFUND), [selektor, text]);
  expect(
    await seite.evaluate<number>(fn(FELD_ZAEHLEN), [selektor, text]),
    `„${feldname}" ist für einen Menschen NICHT SICHTBAR: kein sichtbares Feld «${selektor}» trägt «${text}» in einem eigenen Textknoten (${seite.url()}) · Befund: ${befund}`,
  ).toBeGreaterThan(0);

  const ausgeblendet = await feldAusblenden(seite, selektor, text, art);
  expect(
    ausgeblendet,
    `Kalibrierung „${feldname}": kein Trägerfeld zum Ausblenden gefunden · Befund: ${befund}`,
  ).toBeGreaterThan(0);

  let waehrend = 1;
  let lesefehler: unknown;
  let hatGeworfen = false;
  try {
    waehrend = await seite.evaluate<number>(fn(FELD_ZAEHLEN), [selektor, text]);
  } catch (fehler) {
    hatGeworfen = true;
    lesefehler = fehler;
  }
  const zurueck = await feldEinblenden(seite);
  if (hatGeworfen) {
    throw new Error(
      `Kalibrierung „${feldname}": der Ableser hat geworfen (Rücknahme ${zurueck ? "gelungen" : "GESCHEITERT — die Fläche bleibt verstellt"}).`,
      { cause: lesefehler },
    );
  }
  expect(
    zurueck,
    `Kalibrierung „${feldname}": das ausgeblendete Feld liess sich nicht wiederherstellen — die Fläche bleibt verstellt`,
  ).toBe(true);
  expect(
    waehrend,
    `Kalibrierung „${feldname}" GESCHEITERT: «${text}» galt weiter als sichtbar, obwohl ${ausgeblendet} Feld(er) mit ${art} ausgeblendet waren — diese Zusicherung misst nicht die Sichtbarkeit`,
  ).toBe(0);
  expect(
    await seite.evaluate<number>(fn(FELD_ZAEHLEN), [selektor, text]),
    `Kalibrierung „${feldname}": «${text}» kam nach der Rücknahme nicht zurück`,
  ).toBeGreaterThan(0);
}

// ------------------------------------------------------------------------------------------------
// 6 · Die Bibliothekssuche — EIN Weg, zweimal gefahren (S6 und nach dem Neustart S7)
// ------------------------------------------------------------------------------------------------

/** Der Stand der Trefferliste: ist sie überhaupt da, und WAS führt sie? */
export const LISTENSTAND = `() => {
  const liste = document.querySelector('[data-testid="bib-liste"]');
  if (!liste) { return { da: false, zeilen: [], leer: false, fuss: '', formlos: [] }; }
  const bloecke = liste.querySelectorAll('[data-testid="bib-zeilenblock"]');
  const zeilen = [];
  const formlos = [];
  for (let i = 0; i < bloecke.length; i += 1) {
    const id = bloecke[i].getAttribute('data-bib-id');
    if (typeof id === 'string' && id.length > 0) { zeilen.push(id); } else { formlos.push(i); }
  }
  const fuss = liste.querySelector('[data-testid="bib-fuss"]');
  return {
    da: true,
    zeilen: zeilen,
    formlos: formlos,
    leer: !!liste.querySelector('[data-testid="bib-leer"]'),
    fuss: fuss ? (fuss.innerText || '').replace(/\\s+/g, ' ').trim() : '',
  };
}`;

export interface Listenstand {
  readonly da: boolean;
  readonly zeilen: string[];
  readonly formlos: number[];
  readonly leer: boolean;
  readonly fuss: string;
}

export function listenstand(seite: SeiteMitDialogUndRoute): Promise<Listenstand> {
  return seite.evaluate<Listenstand>(fn(LISTENSTAND));
}

/** Das Budget, in dem die Trefferliste auf eine Eingabe reagieren muss (gemessen: unter 1 s). */
const SUCHBUDGET_MS = 30_000;

/** Tippt in das Suchfeld — geleert und neu gesetzt, damit React das Ereignis wirklich sieht. */
async function suchfeldSetzen(seite: SeiteMitDialogUndRoute, wort: string): Promise<void> {
  await aufZustandWarten(seite, SELEKTOR_DA, "das Suchfeld der Bibliothek steht", "#bib-suche");
  await seite.fill("#bib-suche", "");
  await seite.fill("#bib-suche", wort);
}

/** Wartet auf einen Zustand der Trefferliste; bei Ablauf sagt die Meldung, was WIRKLICH dastand. */
async function aufListenstandWarten(
  seite: SeiteMitDialogUndRoute,
  trifft: (stand: Listenstand) => boolean,
  ziel: string,
): Promise<Listenstand> {
  const start = Date.now();
  let letzter: Listenstand = { da: false, zeilen: [], formlos: [], leer: false, fuss: "" };
  for (;;) {
    letzter = await listenstand(seite);
    if (letzter.da && trifft(letzter)) {
      return letzter;
    }
    if (Date.now() - start >= SUCHBUDGET_MS) {
      throw new Error(
        `${JOB}: ${ziel} — nicht eingetreten in ${Date.now() - start} ms von ${SUCHBUDGET_MS} ms auf ${seite.url()} · zuletzt gelesen: ${JSON.stringify(letzter)}`,
      );
    }
    await new Promise((auf) => setTimeout(auf, 100));
  }
}

/**
 * ================================================================================================
 * SUCHEN — UND WARUM ZUERST NICHTS GEFUNDEN WERDEN MUSS.
 * ================================================================================================
 *
 * DER BEFUND, den die eigene Gegenprobe K1 aufgedeckt hat (Kalibrierlauf 621963417dad5deb1212ff70:
 * „K1 … BLIEB GRÜN"): Die erste Fassung tippte das Suchwort und wartete, bis die Liste die Zeile
 * FÜHRT. Auf `/bibliothek` führt sie die Zeile aber schon VOR jeder Suche — ohne Suchwort zeigt die
 * Fläche den ganzen Bestand (`library-analytics/src/service.ts:1809-1813`: „Leere Suchzeile = zeig
 * den Bestand"). Die Bedingung war damit schon im ersten Takt erfüllt, und der Nachweis hing nicht
 * an der Suche, sondern an der Anwesenheit des einzigen Objekts. Genau deshalb blieb K1 grün,
 * obwohl das Dokumentwort aus der Suchprojektion entfernt war.
 *
 * SEITHER IST JEDE POSITIVE SUCHE EIN ÜBERGANG: zuerst ein Wort, das NIRGENDS steht — die Liste
 * muss daran wirklich leer werden —, und erst aus dieser Leere heraus das gesuchte Wort. Das
 * Erscheinen der Zeile kann dann nur noch aus der Antwort auf DIESE Eingabe stammen.
 */
export async function sucheEingeben(
  seite: SeiteMitDialogUndRoute,
  wort: string,
  erwartet: { trifft?: string; leer?: boolean },
): Promise<Listenstand> {
  if (erwartet.trifft !== undefined) {
    await suchfeldSetzen(seite, FREMDWORT);
    await aufListenstandWarten(
      seite,
      (stand) => stand.zeilen.length === 0 && stand.leer,
      `der Vorzustand der Suche: mit «${FREMDWORT}» (steht nirgends) führt die Trefferliste KEINE Zeile — ohne diesen Übergang bewiese ein späterer Treffer nichts über die Suche`,
    );
  }
  await suchfeldSetzen(seite, wort);
  if (erwartet.leer === true) {
    return aufListenstandWarten(
      seite,
      (stand) => stand.zeilen.length === 0 && stand.leer,
      `die Trefferliste steht und führt zu «${wort}» KEINE Zeile`,
    );
  }
  const gesucht = erwartet.trifft ?? "";
  return aufListenstandWarten(
    seite,
    (stand) => stand.zeilen.includes(gesucht),
    `die Trefferliste steht und führt zu «${wort}» die Zeile ${gesucht}`,
  );
}

/**
 * DIE EINE PRÜFUNG DES TREFFERS — S6 und S7 fahren sie Zeichen für Zeichen gleich, und die
 * Gegenproben K1, K2 und K4 verstellen ihren Gegenstand und lassen GENAU DIESE Funktion laufen.
 *
 * Stünde sie zweimal ausgeschrieben da (einmal für S6, einmal für S7), wären es zwei Aussagen, die
 * nur heute übereinstimmen — dasselbe Argument, mit dem `tests/gast-nutzerweg/browserweg.ts:8-17`
 * seinen einen Weg begründet.
 *
 * DIE REIHENFOLGE IST DER NACHWEIS: erst muss die Liste überhaupt DA und formgültig sein (Lehre
 * 4329 R1: „zuerst HTTP 200 und eine gültige Liste, dann die Kennung"), dann zählt der Treffer, und
 * erst danach werden Sichtbarkeiten behauptet.
 */
export async function sucheUndPruefeTreffer(
  seite: SeiteMitDialogUndRoute,
  o: {
    koId: string;
    statuswort: string;
    quellenzeile: string;
    dokumentsatz: string;
    dateiname: string;
    marke: string;
  },
): Promise<Listenstand> {
  const stand = await sucheEingeben(seite, DOKUMENTWORT, { trifft: o.koId });
  expect(
    stand.da,
    `${o.marke}: die Trefferliste der Bibliothek steht gar nicht — ohne sie ist „gefunden" keine Aussage`,
  ).toBe(true);
  expect(
    stand.formlos,
    `${o.marke}: die Trefferliste führt Zeilen ohne Kennung (Plätze ${JSON.stringify(stand.formlos)}) — eine formlose Liste trägt keinen Nachweis`,
  ).toEqual([]);
  expect(
    stand.zeilen,
    `${o.marke}: die Suche nach «${DOKUMENTWORT}» führt nicht GENAU das eine Objekt ${o.koId} · gelesen: ${JSON.stringify(stand)}`,
  ).toEqual([o.koId]);

  // (1) Der Freigabestatus IN DER TREFFERZEILE — feldweise, nicht irgendwo auf der Seite.
  await feldSichtbarZugesichert(
    seite,
    `${ZEILENBLOCK(o.koId)} [data-bib-text="zeile-meta"]`,
    o.statuswort,
    `${o.marke}: Freigabestatus in der Trefferzeile`,
  );

  // (2) Der Treffer wird geöffnet — derselbe Klick, den ein Mensch tut.
  await seite.click(`[data-testid="bib-zeile"][data-bib-id="${o.koId}"]`, {
    timeout: 30_000,
  });
  await aufZustandWarten(
    seite,
    SELEKTOR_DA,
    `${o.marke}: die Lesefläche des Treffers steht`,
    '[data-testid="bib-lesen"]',
  );
  await aufSichtbarkeitWarten(seite, o.quellenzeile, `${o.marke}: Quellenanzeige am Treffer`);

  // (3) Quelle und Inhalt SICHTBAR (jeder Aufruf kalibriert sich selbst, s. JOB 4324).
  await sichtbarZugesichert(seite, o.quellenzeile, `${o.marke}: Quellenanzeige am Treffer`);
  await sichtbarZugesichert(seite, o.dokumentsatz, `${o.marke}: Dokumentinhalt am Treffer`);
  await feldSichtbarZugesichert(
    seite,
    '[data-testid="bib-pille"]',
    o.statuswort,
    `${o.marke}: Freigabestatus auf der Lesefläche`,
  );
  expect(
    await quellenanzeige(seite),
    `${o.marke}: die Quellenanzeige des Treffers nennt den Dateinamen nicht`,
  ).toContain(o.dateiname);
  return stand;
}

/** Der Zeilenblock GENAU dieses Objekts in der Trefferliste. */
export function ZEILENBLOCK(koId: string): string {
  return `[data-testid="bib-zeilenblock"][data-bib-id="${koId}"]`;
}

// ------------------------------------------------------------------------------------------------
// 6b · Die beiden Bestandsprüfungen, die die Gegenproben K2 und K3 verstellen
// ------------------------------------------------------------------------------------------------

/** Die Fremdprüfung: EINE Bewertung, vom benannten Akteur, an der gelesenen Fassung. */
export async function pruefeBewertung(
  pool: Pool,
  o: { koId: string; akteur: string; fassung: number; marke: string },
): Promise<void> {
  const zeile = await bewertungszeile(pool, o.koId);
  expect(
    zeile.user_id,
    `${o.marke}: die Bewertung in \`ratings\` trägt den Akteur ${zeile.user_id} statt der zweiten Person (${o.akteur}) — eine Fremdprüfung, die der Admin selbst gewesen wäre, ist keine`,
  ).toBe(o.akteur);
  expect(
    zeile.data.userId,
    `${o.marke}: die Bewertungszeile nennt in ihrer Ladung einen anderen Akteur als in ihrem Schlüssel`,
  ).toBe(o.akteur);
  expect(zeile.data.verdict, `${o.marke}: die Bewertung ist keine Zustimmung`).toBe("up");
  expect(
    zeile.data.koVersion,
    `${o.marke}: die Bewertung hängt nicht an der Fassung ${o.fassung}, die die Prüferin gelesen hat`,
  ).toBe(o.fassung);
  const beleg = await auditzeile(pool, "ko.rated", o.koId);
  expect(
    beleg.actor,
    `${o.marke}: der Auditbeleg der Bewertung nennt ${beleg.actor} statt ${o.akteur}`,
  ).toBe(o.akteur);
  expect(
    beleg.payload.koVersion,
    `${o.marke}: der Auditbeleg der Bewertung hängt nicht an der gelesenen Fassung`,
  ).toBe(o.fassung);
}

/** Die Admin-Freigabe: Stufe, Vertrauen, Akteur und Fassungsbezug. */
export async function pruefeFreigabe(
  pool: Pool,
  o: { koId: string; akteur: string; fassung: number; trustMax: number; marke: string },
): Promise<void> {
  const zeile = await kozeile(pool, o.koId);
  expect(
    zeile.status,
    `${o.marke}: die Statusspalte in \`kos\` steht auf „${zeile.status}" statt auf „validiert"`,
  ).toBe("validiert");
  expect(
    zeile.data.status,
    `${o.marke}: das Objekt selbst führt den Status „${String(zeile.data.status)}" statt „validiert"`,
  ).toBe("validiert");
  expect(
    zeile.data.trust,
    `${o.marke}: das freigegebene Objekt trägt nicht das höchste Vertrauen`,
  ).toBe(o.trustMax);
  const beleg = await auditzeile(pool, "ko.admin-validated", o.koId);
  expect(
    beleg.actor,
    `${o.marke}: der Auditbeleg der Freigabe nennt ${beleg.actor} statt des Admins (${o.akteur})`,
  ).toBe(o.akteur);
  expect(
    beleg.payload.koVersion,
    `${o.marke}: die Freigabe bindet sich nicht an die Fassung ${o.fassung}, die der Admin gelesen hat (JOB 3789)`,
  ).toBe(o.fassung);
}

/** Antwortet auf dieser Adresse überhaupt noch etwas? Nach dem Beenden muss die Antwort „nein" sein. */
export async function antwortetHealth(basis: string): Promise<boolean> {
  try {
    await fetch(`${basis}/health`, { signal: AbortSignal.timeout(2_000) });
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------------------------
// 7 · Der Schalter der Gegenproben — und warum er ZWEI Formen hat
// ------------------------------------------------------------------------------------------------
//
// Wörtlich dieselbe Lage wie in JOB 4324 (dort `:100-137`): die Arbeitsprüfungen laufen über
// `register/cloud/remote-test.sh`, und der Wrapper nimmt ausschliesslich `npx vitest run …` an — ein
// vorangestelltes `KLARWERK_KALIBRIERUNG=1` wird abgewiesen. Der Umgebungsschalter allein wäre in
// der Cloud also gar nicht stellbar, und damit wäre die Gegenprobe nicht gefahren, nicht bestanden.
// Die Marke wird für den Gegenprobenlauf angelegt und danach entfernt; sie liegt in keinem Commit.

export const KALIBRIERUNG_SCHALTER = "KLARWERK_KALIBRIERUNG";
export const KALIBRIERUNG_MARKE = resolve(
  process.cwd(),
  "tests/demo-nutzerweg-pg-browser/KALIBRIERUNG",
);

export function kalibrierungScharf(umgebung: NodeJS.ProcessEnv = process.env): boolean {
  return umgebung[KALIBRIERUNG_SCHALTER] === "1" || existsSync(KALIBRIERUNG_MARKE);
}

export function kalibrierungHerkunft(umgebung: NodeJS.ProcessEnv = process.env): string {
  if (umgebung[KALIBRIERUNG_SCHALTER] === "1") {
    return `SCHARF (${KALIBRIERUNG_SCHALTER}=1)`;
  }
  if (existsSync(KALIBRIERUNG_MARKE)) {
    return `SCHARF (Marke ${KALIBRIERUNG_MARKE})`;
  }
  return `übersprungen (weder ${KALIBRIERUNG_SCHALTER}=1 noch die Marke — die Gegenproben sind ein eigener, absichtlich roter Lauf)`;
}

/**
 * Eine Gegenprobe: verstellen, die UNVERÄNDERTE Zusicherung laufen lassen, zurücknehmen, merken.
 * Die Rücknahme läuft auch dann, wenn die Zusicherung wirft — sonst bliebe der Bestand verstellt.
 */
export async function gegenprobe(
  sammlung: string[],
  name: string,
  verstelle: () => Promise<void>,
  zuruecknehmen: () => Promise<void>,
  pruefe: () => Promise<void>,
): Promise<void> {
  await verstelle();
  let rot: string | null = null;
  try {
    await pruefe();
  } catch (e) {
    rot = String(e).split("\n").slice(0, 3).join(" · ");
  }
  await zuruecknehmen();
  sammlung.push(
    rot === null
      ? `${name}: BLIEB GRÜN — die Zusicherung misst ihren Gegenstand nicht.`
      : `${name} → ROT: ${rot}`,
  );
}

/** Eine Voraussetzung aus einem früheren Fall — fehlt sie, scheitert der Fall LAUT. */
export function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(
      `${JOB}: ${was} fehlt — der Fall, der es erarbeitet, ist nicht bis dahin gekommen. Dieser Fall ist damit NICHT gemessen (und nicht etwa bestanden).`,
    );
  }
  return wert;
}
