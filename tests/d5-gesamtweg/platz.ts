// ================================================================================================
// JOB 4281 · DER PRÜFPLATZ DES D5-GESAMTWEGS — EHRLICH BESCHRIEBEN, DREI ANTWORTEN, GETRENNT.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. JOB 4224 hat die D5-Kette gebaut und ihren PostgreSQL-Lauf ZUGESAGT,
// aber nie ausgeführt: `archiv/4224/runde-5/ben-antwort.md` meldet für
// `tests/klara-quellen-nutzerweg/kette-postgres.integration.test.ts` wörtlich „Tests 3 skipped (3)"
// und auf stderr „PG-KETTE ÜBERSPRUNGEN: keine Container-Laufzeit verfügbar — Could not find a
// working container runtime strategy". Prüfpunkt 4 desselben Urteils: „VOLLSTÄNDIGKEIT: OFFEN."
//
// DER GRUND WAR DER AUFBAUWEG, NICHT DER PRÜFPLATZ. Jene Datei holt ihre Datenbank über
// `new GenericContainer("postgres:16-alpine")` aus `testcontainers`
// (`kette-postgres.integration.test.ts:97-101`). Das braucht eine Container-Laufzeit, und die ist
// auf dem Prüfplatz nicht zugesagt. Der Prüfplatz bietet stattdessen eine LAUFENDE PostgreSQL an
// (`KLARWERK_PG_TEST_URL`) — und genau diesen Weg fährt `tests/gast-nutzerweg/
// gastweg-pg-im-browser.integration.test.ts:50` nachweislich durch: „P1 durchläuft die
// zusammenhängende PostgreSQL-Browserkette … eigener erfolgreicher Lauf"
// (`archiv/4223/runde-3/ben-antwort.md:22`).
//
// `testcontainers` KOMMT IN DIESER DATEI DESHALB NICHT VOR. Das ist keine Geschmacksfrage, sondern
// der Unterschied zwischen einem ausgeführten und einem übersprungenen Lauf.
//
// ================================================================================================
// DIE ZWEITE KORREKTURPFLICHT AUS 4224 R5: ZWEI FEHLERLAGEN, ZWEI MELDUNGEN, ZWEI FOLGEN.
// ================================================================================================
//
// `kette-postgres.integration.test.ts:106-111` fängt JEDEN Fehler des Aufbaus in EINEM `catch` und
// schreibt ihn als „keine Container-Laufzeit verfügbar" fort — auch eine erreichbare Datenbank, bei
// der `migrate` (`:104`) scheitert. Eine kaputte Migration sähe damit aus wie ein fehlender
// Prüfplatz und würde übersprungen statt rot.
//
// HIER SIND ES ZWEI LAGEN, und sie tragen wörtlich verschiedene Meldungen:
//
//   · KEINE DATENBANK ERREICHBAR  → `MELDUNG_KEINE_DATENBANK`, sichtbarer Skip mit Grund auf stderr.
//   · DATENBANK DA, `migrate` ROT → `MELDUNG_MIGRATION_ROT`, ein geworfener FEHLER. Nie ein Skip,
//                                    nie als fehlende Laufzeit etikettiert.
//
// ================================================================================================
// DIE DRITTE ANTWORT: FLÄCHE UND BROWSER — ECHTER SOCKET, KEIN ABGEFANGENER AUFRUF.
// ================================================================================================
//
// Die ältere Chromium-Vorrichtung `tests/design/h4-harness.ts:66` fängt mit
// `seite.route(`${ORIGIN}/**`)` JEDE Anfrage ab, bevor sie das Netz erreicht. Für dieses Nutzerziel
// taugt sie nicht: gemessen werden soll ja gerade, dass Chromium mit der echten App über einen
// echten Socket spricht. Diese Datei hängt deshalb die gebaute Fläche über `registerWebStatic` (via
// `mitFlaeche()` aus `tests/gast-nutzerweg/browserweg.ts`, derselbe Aufruf wie
// `services/app/src/server.ts:66`) vor ein `app.listen({ port: 0 })` — und ruft KEIN `seite.route`.
//
// WARUM DIE FLÄCHE NOTFALLS SELBST GEBAUT WIRD: derselbe Grund wie in
// `gastweg-pg-im-browser.integration.test.ts:28-39`. Der Tor-Lauf hat `dist`, aber keine Datenbank
// (`vitest.config.ts:31-32`); der Integrationslauf hat die Datenbank, aber kein `dist`. Liegt `dist`
// schon vor, wird nichts gebaut.
//
// KEINE PRODUKTIVDATEN: ausschliesslich Wegwerf-Datenbanken mit `test` im Namen, hinter dem
// unangetasteten Wächter `guardedLocalPgTestUrl`, am Ende entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Browser,
  DIST,
  type Kontext,
  LIES_TEXT,
  type Seite,
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";

export const JOB = "[KLARWERK] JOB 4281";

/**
 * Die beiden Meldungen der beiden Fehlerlagen. Sie stehen als Konstanten hier und nicht als
 * Zeichenketten an drei Stellen: der Fachlauf zitiert sie in seiner eigenen Kalibrierung, und zwei
 * Abschriften, die nur heute übereinstimmen, wären genau die zweite Wahrheit, gegen die dieser
 * Auftrag antritt.
 */
export const MELDUNG_KEINE_DATENBANK = `${JOB} ÜBERSPRUNGEN — KEINE DATENBANK ERREICHBAR:`;
export const MELDUNG_MIGRATION_ROT = `${JOB} PRÜFPLATZ ROT — DIE DATENBANK IST ERREICHBAR, ABER DAS SCHEMA LIESS SICH NICHT ANLEGEN (migrate). Das ist ausdrücklich KEINE fehlende Laufzeit und wird niemals übersprungen:`;

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

function zerlege(url: string): Verbindung | undefined {
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

/**
 * Die Adresse einer Wegwerf-Datenbank. Der Namenstest ist die zweite Linie hinter
 * `guardedLocalPgTestUrl` und bleibt hier stehen, weil DIESE Datei die Namen selbst BILDET — der
 * Wächter sieht nur die angebotene URL, nicht das, was danach angelegt wird.
 */
function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — dieser Lauf fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

// ================================================================================================
// ANTWORT 1 UND 2 — DIE DATENBANK, UND DIE ZWEI GETRENNTEN FEHLERLAGEN.
// ================================================================================================

/** Eine frische, leere Datenbank samt Schema. Wird am Ende des Laufs entfernt. */
export interface Wegwerfdatenbank {
  readonly name: string;
  readonly pool: Pool;
  schliessen(): Promise<void>;
}

export interface Pruefplatz {
  /** Die reale PostgreSQL-Version, aus `SELECT version()` — nicht aus dem Image-Namen geraten. */
  readonly pgFassung: string;
  /**
   * Legt eine leere Wegwerf-Datenbank an und fährt `migrate`.
   *
   * WIRFT bei jedem Fehler. Ein Skip ist hier ausdrücklich nicht mehr möglich: wer bis hierher
   * kommt, hat eine erreichbare Datenbank (`SELECT 1` ist durch), und alles, was danach schiefgeht,
   * ist ein Befund und keine fehlende Voraussetzung.
   */
  wegwerfdatenbank(marke: string): Promise<Wegwerfdatenbank>;
  abraeumen(): Promise<void>;
}

/**
 * Der Prüfplatz, oder der Grund, warum es ihn nicht gibt.
 *
 * Genau EIN Rückgabewert trägt beides, und zwar getrennt: `platz` steht für „bereit",
 * `skipGrund` für „keine Datenbank erreichbar". Beides zugleich gibt es nicht, und ein
 * unbeantworteter dritter Zustand ebenfalls nicht.
 */
export async function pruefplatzOeffnen(): Promise<
  { platz: Pruefplatz; skipGrund?: undefined } | { platz?: undefined; skipGrund: string }
> {
  const url = guardedLocalPgTestUrl();
  if (!url) {
    return {
      skipGrund:
        "keine gesicherte KLARWERK_PG_TEST_URL — ohne sie ist der D5-Gesamtweg auf echtem PostgreSQL nicht messbar.",
    };
  }
  const verbindung = zerlege(url);
  if (!verbindung) {
    return { skipGrund: "KLARWERK_PG_TEST_URL nennt keinen Rechnernamen." };
  }
  const adminPool = new Pool({ connectionString: url });
  let pgFassung: string;
  try {
    const probe = await adminPool.query<{ version: string }>("SELECT version()");
    pgFassung = probe.rows[0]?.version ?? "(Version nicht lesbar)";
  } catch (fehler) {
    await adminPool.end().catch(() => undefined);
    return {
      skipGrund: `die angebotene Datenbank antwortet nicht — ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    };
  }

  const angelegt: string[] = [];
  // Die Schliesser sind EINMALIG wirksam: `Pool.end()` ein zweites Mal zu rufen ist ein Fehler, und
  // jede Wegwerf-Datenbank wird an zwei Stellen geschlossen — vom Fall, der sie benutzt hat, und vom
  // Abräumen am Ende. Ein doppelter Aufruf darf das Abräumen nicht abbrechen.
  const schliesser: (() => Promise<void>)[] = [];
  const platz: Pruefplatz = {
    pgFassung,
    async wegwerfdatenbank(marke: string): Promise<Wegwerfdatenbank> {
      // `test` im Namen ist Pflicht (s. `pgUrl`), `4281` die Kennung dieses Auftrags.
      const name = `klarwerk_d5_4281_test_${marke}_${`${Date.now()}`.slice(-7)}`;
      await adminPool.query(`CREATE DATABASE ${name}`);
      angelegt.push(name);
      const pool = createPool(pgUrl(verbindung, name));
      let zu = false;
      const schliessen = async (): Promise<void> => {
        if (zu) {
          return;
        }
        zu = true;
        await pool.end().catch(() => undefined);
      };
      schliesser.push(schliessen);
      try {
        await migrate(pool);
      } catch (fehler) {
        const grund = fehler instanceof Error ? fehler.message : String(fehler);
        await schliessen();
        // NICHT übersprungen, NICHT als fehlende Laufzeit etikettiert — geworfen.
        throw new Error(`${MELDUNG_MIGRATION_ROT} ${name} — ${grund}`);
      }
      return { name, pool, schliessen };
    },
    async abraeumen(): Promise<void> {
      for (const schliessen of schliesser) {
        await schliessen();
      }
      for (const name of angelegt) {
        await adminPool
          .query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
          .catch(() => undefined);
      }
      await adminPool.end().catch(() => undefined);
    },
  };
  return { platz };
}

// ================================================================================================
// ANTWORT 3 — DIE GEBAUTE FLÄCHE, DER ECHTE SOCKET UND DER ECHTE BROWSER.
// ================================================================================================

/** Die gebaute Fläche herstellen, wenn sie fehlt — einmal, mit dem echten Bündler. */
export function flaecheBereitstellen(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 600_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

export interface Instanz {
  /** Die laufende App. Sie nimmt den Bedienweg über den Socket UND die Verwaltungsgriffe über
   *  `inject` entgegen — beides ist dieselbe Instanz, derselbe Dienst, derselbe Bestand. */
  readonly app: FastifyInstance;
  readonly basis: string;
  readonly port: number;
  schliessen(): Promise<void>;
}

/**
 * Die echte App auf einem echten Port, mit der gebauten Fläche davor.
 *
 * `port` ist normalerweise 0 (der Prüfstand ist geteilt; eine geratene Nummer wäre die eine Stelle,
 * an der zwei gleichzeitige Läufe einander abschiessen). G2 gibt AUSDRÜCKLICH die Nummer der eben
 * beendeten Instanz herein: nur so ist „dieselbe Adresse" nach dem App-Neustart wirklich dieselbe
 * Adresse, und nur dann misst das Neuladen im Browser den GESPEICHERTEN Stand statt eine neue Welt.
 * Der kurze Wiederholungslauf fängt das Zeitfenster ab, in dem das Betriebssystem den eben
 * freigegebenen Port noch hält.
 */
export async function instanzStarten(pool: Pool, port = 0): Promise<Instanz> {
  const app = buildApp(buildPgServices(pool));
  await mitFlaeche().vorListen(app);
  let letzterFehler: unknown;
  for (let versuch = 1; versuch <= 20; versuch += 1) {
    try {
      await app.listen({ port, host: "127.0.0.1" });
      letzterFehler = undefined;
      break;
    } catch (fehler) {
      letzterFehler = fehler;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (letzterFehler !== undefined) {
    await app.close().catch(() => undefined);
    throw new Error(
      `${JOB}: die App kam auf Port ${port} nicht zum Horchen — ${String(letzterFehler)}`,
    );
  }
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    throw new Error(`${JOB}: der Server hat keinen Port gemeldet — die Instanz steht nicht.`);
  }
  return {
    app,
    basis: `http://127.0.0.1:${adresse.port}`,
    port: adresse.port,
    schliessen: () => app.close(),
  };
}

export { starteChromium, profil, warte, fn, LIES_TEXT, DIST };
export type { Browser, Kontext, Seite };

// ================================================================================================
// DER LETZTE BEDIENGRIFF — DER LINK WIRD GEDRÜCKT, NICHT AUSGELESEN.
// ================================================================================================
//
// WARUM DIESER ABSCHNITT IN RUNDE 2 ENTSTANDEN IST. Runde 1 hat den Weg zum Original so gemessen:
// `href` aus dem DOM lesen, dann `fetch(href)` aus der Seite heraus. BEN hat mit einer eigenen
// Mutation belegt, dass das zu wenig ist — er hat allen drei Original-Links in
// `apps/web/src/components/AnswerSourceDetails.tsx` ein `onClick={(event) => event.preventDefault()}`
// gegeben, und der vollständige Fachlauf blieb GRÜN (sein Auftrag 1f640fac…, Mutationssnapshot
// b5335a2b…). Ein Nachweis, der einen vollständig zerstörten Link-Klick nicht sieht, ist keiner:
// der ausgelesene `href` sagt nur, was DASTEHT, nicht, was PASSIERT, wenn ein Mensch darauf drückt.
// Sein Satz für den Prompt: „Ein DOM-ausgelesenes `href` mit anschliessendem `fetch` zählt
// ausschliesslich als Direktabruf."
//
// WAS BEIM DRÜCKEN WIRKLICH PASSIERT, gelesen statt angenommen: der Link trägt `target="_blank"`
// (`AnswerSourceDetails.tsx:137`), und die Route liefert für alles ausserhalb der Bild-Allowlist
// `application/octet-stream` mit `Content-Disposition: attachment`
// (`services/app/src/routes/object-routes.ts:344-352`). Ein Klick öffnet also KEINE lesbare Seite,
// sondern löst einen DOWNLOAD aus. Genau der wird hier abgefangen und auf Dateiname UND vollen
// Inhalt geprüft — das ist die Zielansicht dieses Links, und eine andere gibt es nicht.
//
// DIE ZWEITE LAGE IST EBENSO BENANNT: nach einem Entzug antwortet dieselbe Adresse mit 404 und
// JSON, also OHNE `attachment`. Dann entsteht kein Download, sondern eine neue Seite. Deshalb gibt
// dieser Helfer beides zurück und behauptet nie, es sei nichts passiert — er sagt, WAS passiert
// ist, und der Fachfall entscheidet, was davon richtig ist.

/** Was Playwright von einem Download hergibt — die schmale Hülle, wie bei `Seite` und `Kontext`. */
export interface Download {
  suggestedFilename(): string;
  path(): Promise<string | null>;
}

/** Die Fähigkeiten des Kontexts, die `browserweg.ts` nicht anbietet und dieser Weg braucht. */
interface KontextMitFenstern {
  waitForEvent(ereignis: "download", opts?: { timeout?: number }): Promise<Download>;
  pages(): Seite[];
  on(ereignis: "response", hoerer: (antwort: RohAntwort) => void): void;
  off(ereignis: "response", hoerer: (antwort: RohAntwort) => void): void;
  on(ereignis: "requestfailed", hoerer: (anfrage: RohAnfrage) => void): void;
  off(ereignis: "requestfailed", hoerer: (anfrage: RohAnfrage) => void): void;
}

/** Was Playwright von einer Antwort bzw. einer gescheiterten Anfrage hergibt — schmale Hüllen. */
interface RohAntwort {
  url(): string;
  status(): number;
  body(): Promise<Buffer>;
}
interface RohAnfrage {
  url(): string;
  failure(): { errorText: string } | null;
}

// ================================================================================================
// JOB 4304 · RUNDE 3 — DER KLICK WIRD AM ECHTEN HTTP-ABRUF GEMESSEN, NICHT AM BILDSCHIRM DANACH.
// ================================================================================================
//
// BENs Korrekturpflicht 2 aus Runde 2, gemessen und nicht behauptet: er hat die Bildroute beim
// Navigationsklick nach dem Entzug auf **HTTP 500** gestellt — und G7 blieb GRÜN. Der Fall prüfte
// damals nur, ob im neu geöffneten Fenster ein darstellbares Bild steht. Bei einem Serverfehler
// steht dort keines, also sah ein AUSFALL aus wie eine wirksame Sperre.
//
// Das verletzt §9 des Auftrags wörtlich: „Bleibt eine Antwort aus oder scheitert der Abruf mit
// einem Maschinenfehler, ist das KEIN Sperrnachweis." Und es verletzt die zweite Hälfte ebenso:
// „keine negative Aussage ohne einen tatsächlich durchgeführten, fehlerfreien Abrufversuch."
//
// Ein leeres Fenster kann drei völlig verschiedene Dinge bedeuten — die Sperre griff (404), der
// Server fiel um (500), oder es wurde überhaupt nicht navigiert. Vom Bildschirm aus sind sie nicht
// zu unterscheiden. Vom ABRUF aus schon. Deshalb schreibt dieser Helfer ab jetzt jede HTTP-Antwort
// und jede gescheiterte Anfrage mit, die dieser Klick ausgelöst hat, samt Status und Rumpf — und
// der Fachfall entscheidet am VERTRAG, ob das eine Absage war.
export interface Abrufbefund {
  url: string;
  /** Der HTTP-Status — `-1`, wenn die Anfrage gar nicht zustande kam. */
  status: number;
  /** Der Rumpf, soweit lesbar. Bei `-1` und bei nicht lesbaren Rümpfen leer. */
  koerper: Buffer;
  koerperLesbar: boolean;
  /** Der Grund, wenn die Anfrage scheiterte oder ihr Rumpf nicht zu holen war — sonst `null`. */
  fehler: string | null;
}

export type Klickfolge =
  /**
   * JOB 4304: `bytes` tritt NEBEN `inhalt`, es ersetzt es nicht. `inhalt` ist die Textdeutung und
   * trägt den bestehenden Textnachweis; `bytes` ist das, was wirklich ankam. Für ein Bild gibt es
   * keine Textdeutung, und die Preisgabeprobe nach einem Rechteentzug vergleicht Bytefolgen — eine
   * als UTF-8 gelesene Binärdatei hätte dort stillschweigend Ersatzzeichen statt Inhalt.
   */
  | { art: "download"; dateiname: string; inhalt: string; bytes: Buffer; abrufe: Abrufbefund[] }
  /**
   * `neueFenster` sind AUSSCHLIESSLICH die Seiten, die dieser Klick geöffnet hat; `alleFenster`
   * zusätzlich die schon offenen. Beide getrennt, weil beide verschiedene Fragen beantworten: was
   * hat der Klick aufgemacht (neu) — und steht der Originalinhalt irgendwo im Browser (alle).
   *
   * JOB 4304: `neueSeiten` sind dieselben neuen Fenster als HANDHABEN statt als Wortlaut. Ein Bild
   * hat keinen Wortlaut — wer seinen Inhalt prüfen will, muss in das Fenster hineinsehen können
   * (`bildinhaltLesen`). Die Reihenfolge ist die von `neueFenster`.
   */
  | {
      art: "kein-download";
      neueFenster: string[];
      alleFenster: string[];
      neueSeiten: Seite[];
      abrufe: Abrufbefund[];
    };

/**
 * Den angezeigten Beleg-Link WIRKLICH betätigen und sagen, was daraufhin geschah.
 *
 * `frist` ist bewusst knapp: im Erfolgsfall kommt der Download in Millisekunden (der Server steht
 * im selben Prozess). Eine lange Frist kostete in jedem NEGATIVfall genau diese Zeit.
 *
 * WARUM NUR DIE NEUEN FENSTER GEMELDET WERDEN — gemessen, nicht überlegt. Die erste Fassung gab die
 * Texte ALLER offenen Seiten zurück, und G3 wurde daran rot (Arbeitsprüfung 6376766470f3…):
 * „nach dem Klick steht der Titel der gesperrten Quelle in einem offenen Fenster: expected
 * 'http://127.0.0.1:33873/fragen :: KLAR…' not to contain 'Zylinderkopfdichtung XQ42 wechseln (J…'".
 * Die beanstandete Seite war die AUSGANGSSEITE, auf der die Antwort seit vor dem Entzug steht — eine
 * schon ausgelieferte Kopie, die keine Oberfläche zurückholen kann (dieselbe ehrliche Grenze, die
 * `flaeche-fuehrt-zum-original.test.tsx:330-341` ausschreibt). Gefragt ist hier NICHT, was noch auf
 * dem Bildschirm steht, sondern was das DRÜCKEN neu aufgemacht hat.
 */
export async function belegLinkBetaetigen(
  kontext: Kontext,
  seite: Seite,
  selektor = '[data-testid="answer-source-original"]',
  frist = 15_000,
): Promise<Klickfolge> {
  const fenster = kontext as unknown as KontextMitFenstern;
  const vorher = new Set(fenster.pages());

  // ── DIE ABRUFE DIESES KLICKS MITSCHREIBEN (Runde 3, BENs Korrekturpflicht 2). Die Hörer sitzen
  //    am KONTEXT, nicht an der Seite: was der Klick in einem NEUEN Fenster auslöst, liefe an einem
  //    Seitenhörer vorbei — und genau dort liegt der gesperrte Abruf.
  const gesammelt: Promise<Abrufbefund>[] = [];
  const aufAntwort = (antwort: RohAntwort): void => {
    gesammelt.push(
      antwort.body().then(
        (koerper) => ({
          url: antwort.url(),
          status: antwort.status(),
          koerper,
          koerperLesbar: true,
          fehler: null,
        }),
        (grund: unknown) => ({
          url: antwort.url(),
          status: antwort.status(),
          koerper: Buffer.alloc(0),
          koerperLesbar: false,
          fehler: `Rumpf nicht lesbar: ${String(grund)}`,
        }),
      ),
    );
  };
  const aufFehlschlag = (anfrage: RohAnfrage): void => {
    gesammelt.push(
      Promise.resolve({
        url: anfrage.url(),
        status: -1,
        koerper: Buffer.alloc(0),
        koerperLesbar: false,
        fehler: anfrage.failure()?.errorText ?? "die Anfrage kam nicht zustande",
      }),
    );
  };
  fenster.on("response", aufAntwort);
  fenster.on("requestfailed", aufFehlschlag);

  // Das Warten wird VOR dem Klick aufgesetzt — sonst ginge ein schneller Download verloren.
  const warten = fenster
    .waitForEvent("download", { timeout: frist })
    .then((d) => d)
    .catch(() => null);
  let download: Download | null;
  try {
    await seite.click(selektor);
    download = await warten;
  } finally {
    fenster.off("response", aufAntwort);
    fenster.off("requestfailed", aufFehlschlag);
  }
  const abrufe = await Promise.all(gesammelt);
  if (download === null) {
    const neueFenster: string[] = [];
    const alleFenster: string[] = [];
    const neueSeiten: Seite[] = [];
    for (const offen of fenster.pages()) {
      const zeile = `${offen.url()} :: ${await offen
        .evaluate<string>(fn(LIES_TEXT))
        .catch(() => "<nicht lesbar>")}`;
      alleFenster.push(zeile);
      if (!vorher.has(offen)) {
        neueFenster.push(zeile);
        neueSeiten.push(offen);
      }
    }
    return { art: "kein-download", neueFenster, alleFenster, neueSeiten, abrufe };
  }
  const pfad = await download.path();
  if (pfad === null) {
    throw new Error(
      `${JOB}: der Klick hat einen Download ausgelöst, aber Playwright hält keine Datei dazu — der Inhalt ist damit nicht prüfbar.`,
    );
  }
  const bytes = await readFile(pfad);
  return {
    art: "download",
    dateiname: download.suggestedFilename(),
    inhalt: bytes.toString("utf8"),
    bytes,
    abrufe,
  };
}

// ================================================================================================
// JOB 4304 · WAS IM FENSTER WIRKLICH STEHT, WENN DAS ORIGINAL EIN BILD IST.
// ================================================================================================
//
// DIE LAGE, am Produkt gelesen und nicht angenommen: für `image/png` liefert die Rohbyteroute den
// echten Typ mit `Content-Disposition: inline` (`object-routes.ts:342-352`). Ein Klick auf einen
// Link mit `target="_blank"` öffnet damit KEINEN Download, sondern ein Fenster, in dem Chromium ein
// Bilddokument aufbaut — ein `<img>`, dessen Quelle die Adresse des Fensters selbst ist.
//
// WARUM ÜBER DIE LEINWAND UND NICHT ÜBER EINEN ZWEITEN ABRUF. Ein `fetch(location.href)` in jenem
// Fenster holte die Bytes NOCH EINMAL vom Server; gemessen wäre dann die Route, nicht die
// Zielansicht. Gefragt ist, was dieser Mensch nach seinem Klick WIRKLICH VOR SICH SIEHT. Also wird
// das dargestellte `<img>` in unskalierter Grösse auf eine Leinwand gezeichnet und deren Bildpunkte
// zurückgelesen. Die Leinwand ist dabei nicht „verunreinigt": das Bilddokument und sein Bild haben
// denselben Ursprung wie die App.
//
// DER BEFUND TRÄGT SEINEN EIGENEN FEHLGRUND. Ein leeres Fenster, ein Bilddokument ohne `<img>` und
// ein Bild, das nicht lädt, sind drei verschiedene Lagen — und keine davon darf als „Inhalt stimmt
// nicht" erscheinen oder gar stillschweigend als Erfolg durchgehen (§9 des Auftrags: eine
// ausgebliebene Antwort ist kein Nachweis). Der Fachfall liest `fehler` zuerst.

export interface Bildbefund {
  /** Die Adresse des Fensters, aus dem gelesen wurde. */
  quelle: string;
  breite: number;
  hoehe: number;
  /** R, G, B, A je Bildpunkt, zeilenweise — leer, wenn `fehler` gesetzt ist. */
  punkte: number[];
  /** Warum nichts gelesen werden konnte — `null`, wenn gelesen wurde. */
  fehler: string | null;
}

const BILD_AUF_LEINWAND = `() => new Promise((fertig) => {
  const bild = document.querySelector("img");
  if (!bild) {
    fertig({ quelle: location.href, breite: 0, hoehe: 0, punkte: [], fehler: "das Fenster zeigt kein Bild (kein <img> im Dokument): " + (document.body ? (document.body.innerText || "").slice(0, 300) : "<kein body>") });
    return;
  }
  const lesen = () => {
    if (!bild.naturalWidth || !bild.naturalHeight) {
      fertig({ quelle: location.href, breite: 0, hoehe: 0, punkte: [], fehler: "das <img> hat keine Eigengrösse — es ist nicht dekodiert worden" });
      return;
    }
    const leinwand = document.createElement("canvas");
    leinwand.width = bild.naturalWidth;
    leinwand.height = bild.naturalHeight;
    const stift = leinwand.getContext("2d");
    if (!stift) {
      fertig({ quelle: location.href, breite: 0, hoehe: 0, punkte: [], fehler: "dieser Browser gibt keinen 2D-Zeichenstift her" });
      return;
    }
    stift.drawImage(bild, 0, 0);
    try {
      const daten = stift.getImageData(0, 0, leinwand.width, leinwand.height).data;
      fertig({ quelle: location.href, breite: leinwand.width, hoehe: leinwand.height, punkte: Array.from(daten), fehler: null });
    } catch (e) {
      fertig({ quelle: location.href, breite: leinwand.width, hoehe: leinwand.height, punkte: [], fehler: "die Bildpunkte sind nicht lesbar: " + String(e) });
    }
  };
  if (bild.complete) { lesen(); return; }
  bild.onload = lesen;
  bild.onerror = () => fertig({ quelle: location.href, breite: 0, hoehe: 0, punkte: [], fehler: "das Bild des Fensters hat nicht geladen" });
})`;

/** Den tatsächlich DARGESTELLTEN Bildinhalt eines Fensters lesen. */
export function bildinhaltLesen(seite: Seite): Promise<Bildbefund> {
  return seite.evaluate<Bildbefund>(fn(BILD_AUF_LEINWAND));
}

/**
 * Ein Fenster schliessen — der Handgriff, mit dem ein Mensch einen Tab wieder zumacht.
 *
 * DIE HÜLLE `Seite` AUS `browserweg.ts` KENNT IHN NICHT, und sie zu erweitern ist diesem Auftrag
 * nicht erlaubt (`tests/gast-nutzerweg/**` steht nicht in den Zielpfaden). Die Umdeutung steht
 * deshalb GENAU HIER, einmal und benannt, statt an jeder Aufrufstelle.
 *
 * WOZU ER GEBRAUCHT WIRD: nach der Kalibrierung eines Bildfalls steht das Fenster mit dem Bild
 * offen. Bliebe es das, prüfte die Sperrmessung danach auch eine Ansicht, die VOR dem Entzug
 * ausgeliefert wurde — und über die sagt dieser Auftrag ausdrücklich nichts zu (Lieferung 3).
 */
export function fensterSchliessen(seite: Seite): Promise<void> {
  return (seite as unknown as { close(): Promise<void> }).close();
}

// ================================================================================================
// DIE HANDGRIFFE IM BROWSER — genau die, die ein Mensch macht.
// ================================================================================================

/**
 * Das Kennwort, mit dem `kette.ts` seine Konten anlegt (`neuesKonto`, dort `kennwort`).
 *
 * ES STEHT HIER ZWEITE MAL, UND DAS IST BENANNT: `kette.ts` exportiert es nicht, und dieser Auftrag
 * darf `tests/klara-quellen-nutzerweg/**` nicht anfassen. Die Abschrift ist ungefährlich, weil sie
 * LAUT scheitert: weicht sie ab, kommt die Anmeldung an der echten Maske nicht durch, und G1 wird
 * rot — nicht still grün.
 */
export const KENNWORT_DER_KETTE = "geheim12345";

const ABRUF = `(pfad) => fetch(pfad, { credentials: "include" })
  .then((r) => r.text().then((t) => ({ status: r.status, text: t })))
  .catch((e) => ({ status: -1, text: String(e) }))`;

/** Alle Wege zum Original, die auf der Seite gerade ANGEBOTEN werden. */
const BELEG_ADRESSEN = `() => [...document.querySelectorAll('[data-testid="answer-source-original"]')]
  .map((a) => a.getAttribute("href") || "")`;

/**
 * Der Weg zum Original AN SEINER QUELLE — nicht irgendwo im Blatt.
 *
 * Dieselbe Schärfe wie `flaeche-fuehrt-zum-original.test.tsx:204-231`: dort ist gemessen
 * (Cloud-Lauf ce64e454…), dass ein Fall mit gekappter Belegverknüpfung GRÜN blieb, solange er nur
 * „irgendein `answer-source-original` trägt diese Adresse" verlangte — das Original rutscht dann in
 * die Liste der unverankerten Dateien und trägt dieselbe Adresse. Gesucht ist die ZEILE der Quelle
 * innerhalb des Originalblocks.
 */
const BELEG_AN_DER_QUELLE = `(bez) => {
  for (const block of document.querySelectorAll('[data-testid="answer-source-originals"]')) {
    for (const li of block.querySelectorAll("li")) {
      if (!(li.textContent || "").includes(bez)) continue;
      const a = li.querySelector('[data-testid="answer-source-original"]');
      if (a) return { href: a.getAttribute("href") || "", text: (a.textContent || "").trim() };
    }
  }
  return null;
}`;

export interface Abruf {
  status: number;
  text: string;
}

/** Ein Abruf AUS DER SEITE HERAUS — über den echten Socket, mit den Keksen genau dieses Profils. */
export function abrufAusDerSeite(seite: Seite, pfad: string): Promise<Abruf> {
  return seite.evaluate<Abruf>(fn(ABRUF), pfad);
}

export function belegAdressen(seite: Seite): Promise<string[]> {
  return seite.evaluate<string[]>(fn(BELEG_ADRESSEN));
}

/** Die Zahl der Elemente mit diesem Testanker — ein ZÄHLER, keine Enthält-Frage. */
const ANZAHL = "(sel) => document.querySelectorAll(sel).length";

export function anzahlAuf(seite: Seite, selektor: string): Promise<number> {
  return seite.evaluate<number>(fn(ANZAHL), selektor);
}

/** Der sichtbare Wortlaut der Antwortkarte — `null`, wenn keine da ist. */
const ANTWORTTEXT = `() => {
  const k = document.querySelector('[data-testid="ask-answer"]');
  return k ? (k.textContent || "").trim() : null;
}`;

export function antworttext(seite: Seite): Promise<string | null> {
  return seite.evaluate<string | null>(fn(ANTWORTTEXT));
}

export function belegAnDerQuelle(
  seite: Seite,
  bezeichnung: string,
): Promise<{ href: string; text: string } | null> {
  return seite.evaluate<{ href: string; text: string } | null>(
    fn(BELEG_AN_DER_QUELLE),
    bezeichnung,
  );
}

export function seitentext(seite: Seite): Promise<string> {
  return seite.evaluate<string>(fn(LIES_TEXT));
}

/** Anmeldung an der ECHTEN Maske, über den echten Socket. */
export async function anmelden(seite: Seite, basis: string, email: string): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await seite.fill("#auth-email", email);
  await seite.fill("#auth-password", KENNWORT_DER_KETTE);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} trägt`,
    undefined,
    45_000,
  );
}

/** Die Fragenfläche öffnen — als echte Navigation, nicht als Client-Sprung. */
export async function fragenflaecheOeffnen(seite: Seite, basis: string): Promise<void> {
  await seite.goto(`${basis}/fragen`, { waitUntil: "load" });
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="page-fragen"] form input')`,
    "die Fragenfläche steht",
    undefined,
    45_000,
  );
}

const ABSENDEKNOPF_LAGE = `() => {
  const k = document.querySelector('[data-testid="page-fragen"] form button[type=submit]');
  if (!k) return "fehlt";
  return k.disabled ? "gesperrt" : "frei";
}`;

/**
 * Eine Frage stellen. Gibt zurück, ob die Fläche das überhaupt zugelassen hat.
 *
 * DER RÜCKGABEWERT IST KEIN KOMFORT, SONDERN DER GEGENSTAND VON G4: ist kein Modell mehr nutzbar,
 * SPERRT die Fläche den Absendeknopf (`Ask.tsx:1241`, `!answerAi.available`). Ein Fall, der das
 * stillschweigend überginge, behauptete hinterher „nichts ging an das Modell" für einen Weg, den er
 * nie gegangen ist.
 */
export async function frageStellen(seite: Seite, frage: string): Promise<"gestellt" | "gesperrt"> {
  await seite.fill('[data-testid="page-fragen"] form input', frage);
  const lage = await seite.evaluate<string>(fn(ABSENDEKNOPF_LAGE));
  if (lage !== "frei") {
    return "gesperrt";
  }
  await seite.click('[data-testid="page-fragen"] form button[type=submit]');
  return "gestellt";
}

/** Auf ein Ergebnis warten — Antwort ODER ehrliche Wissenslücke ODER Fehler. Nie auf „irgendwas". */
export async function ergebnisAbwarten(seite: Seite): Promise<void> {
  await warte(
    seite,
    `() => !document.querySelector('[data-testid="ask-pending"]') && (
      !!document.querySelector('[data-testid="ask-answer"]') ||
      !!document.querySelector('[data-testid="ask-gap"]') ||
      !!document.querySelector('[data-testid="ask-error"]')
    )`,
    "die Fragenfläche hat ein Ergebnis",
    undefined,
    60_000,
  );
}

/** „…" → „Mehr" — genau die Bedienung, mit der ein Mensch die volle Quellenliste öffnet. */
export async function mehrOeffnen(seite: Seite): Promise<void> {
  await warte(seite, `() => !!document.querySelector('[data-testid="ask-menu"]')`, 'das „…"-Menü');
  await seite.click('[data-testid="ask-menu"]');
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="ask-menu-punkt-mehr"]')`,
    'der Menüpunkt „Mehr"',
  );
  await seite.click('[data-testid="ask-menu-punkt-mehr"]');
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="ask-mehr"]')`,
    'das Blatt „Mehr" ist aufgegangen',
  );
}
