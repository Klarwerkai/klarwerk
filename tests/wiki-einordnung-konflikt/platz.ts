// ================================================================================================
// JOB 4334 · DER PRÜFPLATZ DES EINORDNUNGSKONFLIKTS — POSTGRESQL, ECHTER SOCKET, ECHTES CHROMIUM.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. JOB 4251 hat die bedingte Einordnung gebaut und in vier Dateien geprüft.
// Diese vier sagen ihre Grenze selbst: `flaeche-einordnung-konflikt.test.tsx:19-20` — „In-Memory-
// Ablagen (`buildServices()`), kein echter Browser (jsdom rechnet kein Layout), kein PostgreSQL" —
// und `route-einordnung-konflikt.test.ts:11-13` — „`app.inject` statt eines echten Sockets, kein
// PostgreSQL". Der Prüfer hat dieselbe Grenze gezogen (`archiv/4251/runde-4/ben.md:25`, :31, :35).
// Hier steht der Weg, auf dem sie fällt:
//
//     PostgreSQL-Zeile → `buildPgServices(pool)` → die echten Dienste → HTTP-Route über einen
//     ECHTEN SOCKET (`app.listen({ port: 0 })`) → die GEBAUTE Fläche aus `apps/web/dist`
//     (`registerWebStatic`) → ein ECHTES Chromium → die Bedienung durch den Menschen — und zurück
//     in die Spalte, über eine vom Bedienweg UNABHÄNGIGE Lesung.
//
// GEBAUT NACH DEM VORBILD `tests/d5-gesamtweg/platz.ts` (JOB 4281), mit dessen zwei getrennten
// Fehlerlagen und dessen Begründung gegen `testcontainers`. Eigene Datei und eigene Meldungen, weil
// jene Datei der Prüfplatz EINES ANDEREN Weges ist: ihre Meldungen tragen „JOB 4281", ihre
// Wegwerf-Datenbanken heissen `klarwerk_d5_4281_test_…`, und ihr letzter Abschnitt (Belegklick,
// Bildpunkte) hat mit der Einordnung nichts zu tun. Die Zielpfade dieses Auftrags schliessen sie
// ausserdem aus.
//
// ================================================================================================
// ZWEI FEHLERLAGEN, ZWEI MELDUNGEN, ZWEI FOLGEN — UND DIE GRENZE LIEGT AM VERBINDUNGSNACHWEIS.
// ================================================================================================
//
//   · KEINE DATENBANK ERREICHBAR  → `MELDUNG_KEINE_DATENBANK`, sichtbarer Skip mit Grund auf stderr.
//     Das ist eine Aussage über die MASCHINE.
//   · DATENBANK DA, AUFBAU ROT    → `MELDUNG_AUFBAU_ROT`, ein geworfener FEHLER. Nie ein Skip, nie
//     als fehlende Laufzeit etikettiert. Das ist eine Aussage über das PRODUKT.
//
// Das ist wörtlich die Reihenfolge aus `tests/ko/trash-tx-pg.integration.test.ts:134-165` in ihrer
// von JOB 4321 reparierten Fassung: `SELECT 1` entscheidet über den Skip, und „AB HIER WIRD NICHTS
// MEHR GEFANGEN" (dort :144). Ein frühes `return` statt `ctx.skip()` ist verboten — es ist in Vitest
// ein BESTANDENER Test (Befund JOB 4224 R4).
//
// ZUR LEHRE JOB 4321 R1 („Eigene Schemata isolieren keine datenbankweiten Erweiterungen"): dieser
// Platz teilt sich mit niemandem eine Datenbank. Jeder Fachfall bekommt eine EIGENE, frisch
// angelegte Wegwerf-Datenbank, und `CREATE EXTENSION IF NOT EXISTS pg_trgm` aus `KO_SCHEMA` wirkt je
// Datenbank. Der Wettlauf, den JOB 4321 gemessen hat, kann hier nicht entstehen — gemeinsam ist
// ausschliesslich der CLUSTER. Wo er es doch ist, nämlich beim `CREATE DATABASE` selbst (PostgreSQL
// sperrt dabei kurz die Vorlage), wird GENAU DIESE eine Meldung wiederholt und keine andere; jeder
// andere Fehler fliegt sofort.
//
// KEINE PRODUKTIVDATEN: ausschliesslich Wegwerf-Datenbanken mit `test` UND `4334` im Namen, hinter
// dem unangetasteten Wächter `guardedLocalPgTestUrl`, am Ende entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { expect } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Browser,
  DIST,
  type Kontext,
  type Seite,
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  tabBisText,
  tabBisZu,
  warte,
} from "../gast-nutzerweg/browserweg";

export const JOB = "[KLARWERK] JOB 4334";

export const MELDUNG_KEINE_DATENBANK = `${JOB} ÜBERSPRUNGEN — KEINE DATENBANK ERREICHBAR:`;
export const MELDUNG_AUFBAU_ROT = `${JOB} PRÜFPLATZ ROT — DIE DATENBANK IST ERREICHBAR, ABER DER AUFBAU (CREATE DATABASE / migrate) IST GESCHEITERT. Das ist ausdrücklich KEINE fehlende Laufzeit und wird niemals übersprungen:`;

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
 * `guardedLocalPgTestUrl` und steht hier, weil DIESE Datei die Namen selbst BILDET — der Wächter
 * sieht nur die angebotene URL, nicht das, was danach angelegt wird.
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
// DIE DATENBANK.
// ================================================================================================

export interface Wegwerfdatenbank {
  readonly name: string;
  readonly pool: Pool;
  schliessen(): Promise<void>;
}

export interface Pruefplatz {
  /** Die reale PostgreSQL-Version, aus `SELECT version()` — nicht aus einem Imagenamen geraten. */
  readonly pgFassung: string;
  /**
   * Legt eine leere Wegwerf-Datenbank an und fährt `migrate`.
   *
   * WIRFT bei jedem Fehler. Wer bis hierher kommt, hat eine erreichbare Datenbank (`SELECT 1` ist
   * durch), und alles, was danach schiefgeht, ist ein Befund und keine fehlende Voraussetzung.
   */
  wegwerfdatenbank(marke: string): Promise<Wegwerfdatenbank>;
  abraeumen(): Promise<void>;
}

/** Der eine Wettlauf, den ein GETEILTER Cluster übrig lässt: die Vorlage beim `CREATE DATABASE`. */
function istVorlageBelegt(fehler: unknown): boolean {
  const text = fehler instanceof Error ? fehler.message : String(fehler);
  return text.includes("is being accessed by other users") || text.includes("template1");
}

/**
 * Der Prüfplatz, oder der Grund, warum es ihn nicht gibt.
 *
 * Genau EIN Rückgabewert trägt beides, und zwar getrennt: `platz` steht für „bereit", `skipGrund`
 * für „keine Datenbank erreichbar". Beides zugleich gibt es nicht, ein dritter Zustand auch nicht.
 */
export async function pruefplatzOeffnen(): Promise<
  { platz: Pruefplatz; skipGrund?: undefined } | { platz?: undefined; skipGrund: string }
> {
  const url = guardedLocalPgTestUrl();
  if (!url) {
    return {
      skipGrund:
        "keine gesicherte KLARWERK_PG_TEST_URL — ohne sie ist der Einordnungskonflikt auf echtem PostgreSQL nicht messbar.",
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
  // Abräumen am Ende.
  const schliesser: (() => Promise<void>)[] = [];
  const platz: Pruefplatz = {
    pgFassung,
    async wegwerfdatenbank(marke: string): Promise<Wegwerfdatenbank> {
      const name = `klarwerk_einordnung_4334_test_${marke}_${`${Date.now()}`.slice(-7)}`;
      let angelegtJetzt = false;
      let letzterFehler: unknown;
      // NUR der eine benannte Wettlauf wird wiederholt (s. `istVorlageBelegt`); jeder andere Fehler
      // fliegt sofort. Ein pauschales „noch einmal versuchen" verschlucke genau die Schemafehler,
      // gegen die die Lehre JOB 4321 R1 antritt.
      for (let versuch = 1; versuch <= 10 && !angelegtJetzt; versuch += 1) {
        try {
          await adminPool.query(`CREATE DATABASE ${name}`);
          angelegtJetzt = true;
        } catch (fehler) {
          letzterFehler = fehler;
          if (!istVorlageBelegt(fehler)) {
            throw new Error(
              `${MELDUNG_AUFBAU_ROT} ${name} — ${fehler instanceof Error ? fehler.message : String(fehler)}`,
            );
          }
          await new Promise((r) => setTimeout(r, 300 * versuch));
        }
      }
      if (!angelegtJetzt) {
        throw new Error(
          `${MELDUNG_AUFBAU_ROT} ${name} — die Vorlage blieb in zehn Versuchen belegt: ${String(letzterFehler)}`,
        );
      }
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
        throw new Error(`${MELDUNG_AUFBAU_ROT} ${name} — ${grund}`);
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
// DIE GEBAUTE FLÄCHE, DER ECHTE SOCKET — UND DER BEOBACHTER AN DER ECHTEN ROUTE.
// ================================================================================================
//
// WARUM DIE FLÄCHE NOTFALLS SELBST GEBAUT WIRD: derselbe Grund wie in
// `gastweg-pg-im-browser.integration.test.ts:28-39`. Der Tor-Lauf hat `dist`, aber keine Datenbank;
// der Integrationslauf hat die Datenbank, aber kein `dist`. Liegt `dist` vor, wird nichts gebaut.

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

/**
 * Ein Schreibaufruf des Browsers an `PUT /api/kos/:id`, so wie er auf dem Draht ankam.
 *
 * Er wird BEOBACHTET, nicht ersetzt: Adresse, Rumpf, Rechtegate, Dienst und Ablage bleiben der echte
 * Weg. Gefragt ist die dritte Aussage neben „es ging etwas hinaus" und „auf der Fläche steht etwas",
 * nämlich MIT WELCHER BEDINGUNG es hinausging — genau der Messpunkt, an dem in P4 entschieden wird,
 * ob eine nachgeholte Zahl zur Überschreibvollmacht geworden ist.
 */
export interface Schreibaufruf {
  action: string;
  expectedVersion: number | null;
  /** `expectedMetadataRevision`, wenn es eine Zahl war — sonst `null`. */
  stempel: number | null;
  /** „Feld weggelassen" und „Feld mit unbrauchbarem Wert" sind zwei verschiedene Aussagen. */
  hatStempel: boolean;
}

/**
 * Was mit diesem Aufruf geschehen soll.
 *
 * `weiter` heisst: geh an die echte Route. Was in der Wartezeit der Regie passiert, passiert
 * ebenfalls über die ECHTE Route mit einem ECHTEN zweiten Konto — dieselbe Bauform und dieselbe
 * Begründung wie der wartende `stoerer` in `flaeche-einordnung-konflikt.test.tsx:66-71`.
 *
 * `antwort-verlieren` ist der ANTWORTVERLUST, den Pedi wörtlich verlangt
 * (`EINGANG-20260916-PRO-P1-NACH-WIKI-INTEGRATION.md:11`: „Antwortverlust/Retry"): der Aufruf läuft
 * VOLLSTÄNDIG durch die echte Route, und erst die fertige Antwort geht auf der Leitung verloren —
 * die Verbindung wird im `onSend` gekappt. Es wird KEINE Antwort erfunden und keine ersetzt; der
 * Browser erlebt genau das, was er bei einem abgerissenen Netz erlebt. Was der Server dabei
 * tatsächlich geschrieben hat, behauptet dieser Platz nicht — es wird in PostgreSQL nachgelesen.
 */
export type Weisung = "weiter" | "antwort-verlieren";
export type Regie = (aufruf: Schreibaufruf, nr: number) => Weisung | Promise<Weisung>;

export interface Instanz {
  /** Die laufende App. Sie nimmt den Bedienweg über den Socket UND die Verwaltungsgriffe über
   *  `inject` entgegen — dieselbe Instanz, derselbe Dienst, derselbe Bestand. */
  readonly app: FastifyInstance;
  readonly basis: string;
  readonly port: number;
  /** Jeder beobachtete Schreibaufruf, in der Reihenfolge des Drahts. */
  readonly aufrufe: readonly Schreibaufruf[];
  setzeRegie(regie: Regie | null): void;
  nur(action: string): Schreibaufruf[];
  zaehle(action: string): number;
  schliessen(): Promise<void>;
}

const IST_KO_PFAD = /^\/api\/kos\/[^/]+$/;

/**
 * Die Kopfzeile, an der ein VERWALTUNGSGRIFF erkennbar ist.
 *
 * Der Beobachter schaut auf den BEDIENWEG — auf das, was dieses Chromium hinausschickt. Die Griffe
 * des zweiten Menschen und des Administrators laufen über `inject` an derselben echten Route; ohne
 * dieses Merkmal zählte der Fall sie als eigene Aufrufe, und — schlimmer — die Regie, die genau
 * währenddessen läuft, riefe sich selbst. Die Route liest diese Zeile nicht; sie ändert am Vorgang
 * nichts.
 */
export const VERWALTUNGSGRIFF = "x-klarwerk-4334-verwaltungsgriff";

/**
 * Die echte App auf einem echten Port, mit der gebauten Fläche davor.
 *
 * `port` ist 0: der Prüfstand ist geteilt, und eine geratene Nummer wäre die eine Stelle, an der
 * zwei gleichzeitige Läufe einander abschiessen.
 */
export async function instanzStarten(pool: Pool): Promise<Instanz> {
  const app = buildApp(buildPgServices(pool));
  const aufrufe: Schreibaufruf[] = [];
  let regie: Regie | null = null;
  const zuKappen = new WeakSet<object>();

  // ── DER BEOBACHTER. Er sitzt im `preHandler`: der Rumpf ist geparst (also ist die `action`
  //    bekannt), der Routen-Handler hat aber noch nicht geschrieben. Wartet die Regie hier, steht
  //    der Mensch genau in dem Fenster, in dem er tippt — und ein zweites Konto kann es füllen.
  app.addHook("preHandler", async (request) => {
    if (request.method !== "PUT" || !IST_KO_PFAD.test(request.url.split("?")[0] ?? "")) {
      return;
    }
    if (request.headers[VERWALTUNGSGRIFF] !== undefined) {
      return;
    }
    const rumpf = (request.body ?? {}) as {
      action?: unknown;
      expectedVersion?: unknown;
      expectedMetadataRevision?: unknown;
    };
    const aufruf: Schreibaufruf = {
      action: String(rumpf.action ?? ""),
      expectedVersion: typeof rumpf.expectedVersion === "number" ? rumpf.expectedVersion : null,
      stempel:
        typeof rumpf.expectedMetadataRevision === "number" ? rumpf.expectedMetadataRevision : null,
      hatStempel: rumpf.expectedMetadataRevision !== undefined,
    };
    const nr = aufrufe.filter((a) => a.action === aufruf.action).length + 1;
    aufrufe.push(aufruf);
    if (regie === null) {
      return;
    }
    if ((await regie(aufruf, nr)) === "antwort-verlieren") {
      zuKappen.add(request.raw);
    }
  });

  // ── DIE GEKAPPTE LEITUNG. Erst hier, im `onSend`, ist der Schreibvorgang fertig — und genau jetzt
  //    geht seine Antwort verloren. Node verwirft Schreibvorgänge auf eine zerstörte Verbindung
  //    still (`_http_outgoing._writeRaw` prüft `conn.destroyed`), der Fehlerhörer steht trotzdem da:
  //    ein unbehandeltes `error` am Socket risse den ganzen Lauf mit.
  app.addHook("onSend", async (request, reply, payload) => {
    if (zuKappen.has(request.raw)) {
      const draht = request.raw.socket;
      draht.on("error", () => undefined);
      draht.destroy();
      process.stderr.write(
        `${JOB} LEITUNG GEKAPPT nach Status ${reply.statusCode} auf ${request.url} — die Antwort geht verloren.\n`,
      );
    }
    return payload;
  });

  await mitFlaeche().vorListen(app);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    throw new Error(`${JOB}: der Server hat keinen Port gemeldet — die Instanz steht nicht.`);
  }
  return {
    app,
    basis: `http://127.0.0.1:${adresse.port}`,
    port: adresse.port,
    aufrufe,
    setzeRegie(neu) {
      regie = neu;
    },
    nur(action) {
      return aufrufe.filter((a) => a.action === action);
    },
    zaehle(action) {
      return aufrufe.filter((a) => a.action === action).length;
    },
    schliessen: () => app.close(),
  };
}

// ================================================================================================
// KONTEN UND BESTAND — VERWALTUNGSGRIFFE, NIE EIN SCHRITT DES BEDIENWEGS.
// ================================================================================================

/** Das Kennwort dieses Laufs. Weicht es von der Maske ab, scheitert die Anmeldung LAUT. */
export const KENNWORT = "geheim12345";

export interface Konto {
  id: string;
  email: string;
  kopf: Record<string, string>;
}

async function anmeldenApi(app: FastifyInstance, email: string): Promise<Konto> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(login.statusCode, `${JOB}: Anmeldung ${email} gescheitert: ${login.body}`).toBe(200);
  const rumpf = login.json() as { token: string; user?: { id?: string } };
  return {
    id: rumpf.user?.id ?? "",
    email,
    kopf: { authorization: `Bearer ${rumpf.token}` },
  };
}

/** Der erste Mensch: er registriert sich selbst und ist damit Admin. */
export async function adminAnlegen(app: FastifyInstance, marke: string): Promise<Konto> {
  const email = `4334-${marke}-admin@klarwerk.test`;
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: `Bernd ${marke}`, email, password: KENNWORT },
  });
  expect(angelegt.statusCode, `${JOB}: Registrierung ${email}: ${angelegt.body}`).toBe(201);
  return anmeldenApi(app, email);
}

/** Ein ECHTES zweites Konto mit einer festgelegten Rolle — „jemand anderes" ist sonst Behauptung. */
export async function kontoAnlegen(
  app: FastifyInstance,
  admin: Konto,
  rolle: string,
  marke: string,
): Promise<Konto> {
  const email = `4334-${marke}-${rolle}@klarwerk.test`;
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin.kopf,
    payload: { name: `Anna ${marke}`, email, password: KENNWORT, role: rolle },
  });
  expect(angelegt.statusCode, `${JOB}: Anlage ${email}: ${angelegt.body}`).toBe(201);
  return anmeldenApi(app, email);
}

export interface Bestand {
  titel: string;
  aussage: string;
  kategorie: string;
  schlagworte: string[];
}

export async function eintragAnlegen(
  app: FastifyInstance,
  konto: Konto,
  bestand: Bestand,
): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: konto.kopf,
    payload: {
      confidentiality: "intern",
      title: bestand.titel,
      statement: bestand.aussage,
      type: "best_practice",
      category: bestand.kategorie,
      tags: bestand.schlagworte,
    },
  });
  expect(angelegt.statusCode, `${JOB}: Anlage des Eintrags: ${angelegt.body}`).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

/**
 * Jemand anderes ordnet ein — über die ECHTE Route, mit einem ECHTEN zweiten Konto.
 *
 * Der Aufruf geht über `inject` und nicht über einen zweiten Browser: gemessen wird der Weg VON A,
 * und B ist die Tatsache, dass zwischendurch jemand Fremdes geschrieben hat. Ein zweiter Browser
 * ist in §8 dieses Auftrags ausdrücklich als NICHT gemessen benannt.
 */
export async function fremdSchreiben(
  app: FastifyInstance,
  konto: Konto,
  id: string,
  nutzlast: Record<string, unknown>,
  was: string,
): Promise<void> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { ...konto.kopf, [VERWALTUNGSGRIFF]: "1" },
    payload: nutzlast,
  });
  expect(antwort.statusCode, `${JOB}: ${was} gescheitert: ${antwort.body}`).toBe(200);
}

// ================================================================================================
// DIE UNABHÄNGIGE LESUNG — AUS POSTGRESQL, NICHT ÜBER DEN BEDIENWEG.
// ================================================================================================
//
// „Die Fläche zeigt es" und „es steht in der Datenbank" sind zwei Aussagen. Diese hier fasst die
// Route nicht an: sie liest die Spalten selbst (`kos`, `ko_metadata_projections`).
//
// UND SIE PRÜFT IHREN EIGENEN BESTAND, BEVOR IRGENDETWAS VERGLICHEN WIRD (Lehre JOB 4326 R1:
// „T2 muss vor jedem Vergleich genau eine gültige Bestandszeile verlangen"). Keine Zeile, zwei
// Zeilen oder ein fehlendes Pflichtfeld sind KEIN gültiger Bestand und werden hier rot — nicht
// stillschweigend zu einem `undefined`, das jeden Vergleich bestehen lässt.

export interface PgStand {
  titel: string;
  aussage: string;
  kategorie: string;
  schlagworte: string[];
  fassung: number;
  status: string;
  /** Der Stand der Einordnung aus der Projektion. */
  stempel: number;
  kategorieProjektion: string;
}

export async function pgStand(pool: Pool, id: string, was: string): Promise<PgStand> {
  type KoZeile = { category: string; status: string; data: Record<string, unknown> };
  const zeilen = await pool.query<KoZeile>("SELECT category, status, data FROM kos WHERE id = $1", [
    id,
  ]);
  expect(
    zeilen.rowCount,
    `${JOB}: ${was} — die Tabelle kos führt ${zeilen.rowCount ?? 0} Zeilen zu ${id}, genau eine ist verlangt.`,
  ).toBe(1);
  const zeile = zeilen.rows[0] as KoZeile;
  const daten = zeile.data;
  expect(typeof daten.title, `${JOB}: ${was} — kos.data trägt keinen Titel`).toBe("string");
  expect(typeof daten.statement, `${JOB}: ${was} — kos.data trägt keine Aussage`).toBe("string");
  expect(Array.isArray(daten.tags), `${JOB}: ${was} — kos.data trägt keine Schlagwortliste`).toBe(
    true,
  );
  expect(typeof daten.version, `${JOB}: ${was} — kos.data trägt keine Fassungszahl`).toBe("number");

  const projektion = await pool.query<{
    category_text: string;
    metadata_revision: string;
  }>("SELECT category_text, metadata_revision FROM ko_metadata_projections WHERE ko_id = $1", [id]);
  expect(
    projektion.rowCount,
    `${JOB}: ${was} — die Einordnungsprojektion führt ${projektion.rowCount ?? 0} Zeilen zu ${id}, genau eine ist verlangt.`,
  ).toBe(1);
  const p = projektion.rows[0] as { category_text: string; metadata_revision: string };
  const stempel = Number(p.metadata_revision);
  expect(
    Number.isInteger(stempel) && stempel >= 1,
    `${JOB}: ${was} — der Stand der Einordnung ist „${p.metadata_revision}" und damit kein gültiger Bestand.`,
  ).toBe(true);

  return {
    titel: String(daten.title),
    aussage: String(daten.statement),
    kategorie: zeile.category,
    schlagworte: (daten.tags as unknown[]).map((t) => String(t)),
    fassung: Number(daten.version),
    status: zeile.status,
    stempel,
    kategorieProjektion: p.category_text,
  };
}

// ================================================================================================
// DIE HANDGRIFFE IM BROWSER — GENAU DIE, DIE EIN MENSCH MACHT.
// ================================================================================================
//
// DER WEG ZU JEDEM BEDIENELEMENT IST DERSELBE WIE IN `browserweg.ts`: Fokus auf den Dokumentanfang
// zurück, per Tab hin, den SICHTBAREN Fokus am berechneten Stil nachmessen, dann tippen oder Enter.
// Benutzt werden dafür `tabBisZu`/`tabBisText` aus ebenjener Datei.
//
// WARUM `tastaturAusloesen`/`tippeMitTastatur` NICHT UNMITTELBAR GERUFEN WERDEN: beide tragen einen
// fest verdrahteten Deckel von 150 Tab-Anschlägen. Diese Fläche ist die Bibliotheksschale MIT
// geöffnetem Bearbeiten-Formular, und darin steht der Fliesstexteditor mit bis zu 39 eigenen
// Bedienknöpfen (`RichTextEditor.tsx`) — Schlagwortfeld, Kategorie und „Speichern" liegen dahinter.
// `browserweg.ts` ist diesem Auftrag ausdrücklich NICHT zum Ändern freigegeben (Halter JOB 4322),
// also steht der Deckel hier. Der WEG bleibt Zeichen für Zeichen derselbe.

/** Der Deckel dieser Fläche. Er ist grosszügig, damit er misst, was da ist, statt was er erwartet. */
const TAB_DECKEL = 600;

/**
 * Sieht man, worauf der Fokus steht?
 *
 * Dieselbe Frage wie `browserweg.ts` sie an derselben Stelle stellt (Umriss oder Schatten am
 * berechneten Stil). Sie steht hier zum zweiten Mal, weil jene Datei sie nicht exportiert und
 * dieser Auftrag sie nicht exportieren machen darf; sie ist eine reine Stilabfrage ohne Zustand.
 */
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return false;
  const s = getComputedStyle(a);
  const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth || "0") > 0;
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "";
  return umriss || schatten;
}`;

const FOKUS_DIAGNOSE = `() => {
  const a = document.activeElement;
  if (!a) return "aktiv: (nichts)";
  const s = getComputedStyle(a);
  return [
    "aktiv: <" + a.tagName.toLowerCase() + ">",
    "text=" + (a.textContent || "").trim().slice(0, 40),
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "outline=" + s.outlineStyle + " " + s.outlineWidth,
    "boxShadow=" + String(s.boxShadow).slice(0, 60),
  ].join(" · ");
}`;

async function fokusMussSichtbarSein(seite: Seite, was: string): Promise<void> {
  const stand = await seite.evaluate<string>(fn(FOKUS_DIAGNOSE));
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `${JOB}: „${was}" zeigt keinen sichtbaren Fokus, obwohl es gerade per Tastatur angesteuert wurde — ${stand}`,
  ).toBe(true);
}

/** Ein Bedienelement per Tab erreichen, den Fokus nachmessen, mit Enter auslösen. */
export async function tastaturGriff(seite: Seite, beschriftung: string): Promise<number> {
  const schritte = await tastaturErreichbar(seite, beschriftung);
  await seite.keyboard.press("Enter");
  return schritte;
}

/**
 * Dasselbe OHNE Enter: „dieser Weg steht einem Tastaturmenschen offen".
 *
 * Er wird dort gebraucht, wo das Auslösen selbst der Schaden wäre — der Einreichknopf in P5 darf
 * ERREICHBAR sein, eingereicht wird in jenem Fall aber nichts.
 */
export async function tastaturErreichbar(seite: Seite, beschriftung: string): Promise<number> {
  const schritte = await tabBisText(seite, beschriftung, TAB_DECKEL, true);
  await fokusMussSichtbarSein(seite, beschriftung);
  return schritte;
}

const FELDWERT = `(sel) => { const e = document.querySelector(sel); return e ? e.value : "(kein Feld)"; }`;

/**
 * Der `value` eines Eingabefeldes — das Beweismittel dafür, dass die Eingabe wirklich hineinging.
 *
 * RUNDE 2: NICHT MEHR EXPORTIERT. Er wird hier nur noch beim TIPPEN gebraucht (hat der Tastendruck
 * das Feld erreicht?). Für die Frage „steht der Entwurf noch da?" ist er allein zu schwach — genau
 * daran ist Runde 1 gescheitert. Wer sie stellt, nimmt `feldErhalten`; stünde der bequemere Weg
 * daneben offen, nähme ihn der nächste Fall wieder (dasselbe Argument wie `browserweg.ts:263-268`).
 */
function feldwert(seite: Seite, selektor: string): Promise<string> {
  return seite.evaluate<string>(fn(FELDWERT), selektor);
}

/**
 * In ein Feld tippen: per Tab hin, Fokus nachgemessen, alles markieren, tippen — und das ERGEBNIS
 * nachgelesen.
 *
 * DAS MARKIEREN IST NICHT ZIERDE, SONDERN GEMESSEN. Die erste Fassung tippte gleich nach dem
 * Tab-Sprung los, in der Annahme, Chromium markiere den Inhalt eines Textfeldes beim
 * Tastaturfokus. Das tut es NICHT (Arbeitsprüfung 1be5b343383e453488d861faea311f09, Cloud-Lauf
 * 1406283d42c5f2e91cf3950e): der Cursor steht am ANFANG, und der neue Satz landete vor dem alten —
 * „…dann schließen.Bei Überdruck Ventil X manuell schließen.". Deshalb geht dem Tippen jetzt das
 * ganz gewöhnliche „alles markieren" voraus, mit der Taste, die auf dem jeweiligen Betriebssystem
 * dafür zuständig ist (`ControlOrMeta`).
 *
 * UND DAS ERGEBNIS WIRD NACHGELESEN, nicht geglaubt: der `value` kommt zurück und wird gegen den
 * Sollwert gestellt. Genau daran ist der Fehler oben aufgefallen — dieselbe Regel wie in
 * `tippeDatumMitTastatur` (`browserweg.ts:377-385`).
 */
export async function tippenInFeld(
  seite: Seite,
  selektor: string,
  text: string,
  was: string,
): Promise<number> {
  const schritte = await tabBisZu(seite, selektor, TAB_DECKEL, true);
  await fokusMussSichtbarSein(seite, was);
  await seite.keyboard.press("ControlOrMeta+a");
  await seite.keyboard.type(text);
  const gesetzt = await feldwert(seite, selektor);
  expect(
    gesetzt,
    `${JOB}: „${text}" ist im Feld „${was}" nicht angekommen (gelesen: „${gesetzt}")`,
  ).toBe(text);
  return schritte;
}

/**
 * Der eindeutige CSS-Pfad zu dem Feld, das diese BESCHRIFTUNG trägt.
 *
 * Die Felder des Bearbeiten-Formulars tragen weder Kennung noch Testanker (`ui.tsx`, `Field`), und
 * eine Beschriftung lässt sich in CSS nicht ausdrücken. Dies ist deshalb ausschliesslich ein
 * ORTUNGSMITTEL — es sagt, WELCHES Feld gemeint ist, und nicht, wie es bedient wird; bedient wird
 * weiter nur über `tippenInFeld`. Der Pfad wird vor der Rückgabe auf Eindeutigkeit geprüft: träfe
 * er zwei Knoten, landete die Eingabe im falschen Feld und der Fall bliebe womöglich grün.
 *
 * Ein LEERER `tag` liefert den Pfad der Beschriftung selbst — gebraucht dort, wo nicht der Wert
 * eines Feldes zählt, sondern was in seinem Umfeld SICHTBAR steht (die Schlagwortmarken).
 */
const FELD_PFAD = `([beschriftung, tag]) => {
  const treffer = [...document.querySelectorAll("label")].filter((l) => {
    const s = l.querySelector("span");
    return !!s && (s.textContent || "").trim() === beschriftung;
  });
  if (treffer.length !== 1) {
    return { pfad: "", grund: treffer.length + " Beschriftungen „" + beschriftung + "“ auf der Fläche" };
  }
  const feld = tag === "" ? treffer[0] : treffer[0].querySelector(tag);
  if (!feld) {
    return { pfad: "", grund: "die Beschriftung „" + beschriftung + "“ führt kein <" + tag + ">" };
  }
  const teile = [];
  let k = feld;
  while (k && k !== document.body && k.parentElement) {
    const eltern = k.parentElement;
    const index = [...eltern.children].indexOf(k) + 1;
    teile.unshift(k.tagName.toLowerCase() + ":nth-child(" + index + ")");
    k = eltern;
  }
  const pfad = "body > " + teile.join(" > ");
  const gefunden = document.querySelectorAll(pfad);
  if (gefunden.length !== 1 || gefunden[0] !== feld) {
    return { pfad: "", grund: "der berechnete Pfad trifft " + gefunden.length + " Knoten statt genau dieses Feld" };
  }
  return { pfad: pfad, grund: "" };
}`;

export async function feldPfad(seite: Seite, beschriftung: string, tag: string): Promise<string> {
  const befund = await seite.evaluate<{ pfad: string; grund: string }>(fn(FELD_PFAD), [
    beschriftung,
    tag,
  ]);
  expect(
    befund.grund,
    `${JOB}: das Feld „${beschriftung}" ist nicht eindeutig zu orten — ${befund.grund}`,
  ).toBe("");
  return befund.pfad;
}

// ================================================================================================
// RUNDE 2 · EIN ERHALTENER ENTWURF IST ERST ERHALTEN, WENN MAN IHN SIEHT UND LESEN KANN.
// ================================================================================================
//
// BEN HAT DIE LÜCKE IN RUNDE 1 SELBST GEMESSEN, und sie sass genau hier: nach dem Konflikt wurden
// Aussage und Kategorie mit `visibility:hidden` ausgeblendet (die Unsichtbarkeit separat bestätigt) —
// und SÄMTLICHE P2-Nachweise blieben grün (`Tests 1 passed | 4 skipped`, Messprotokoll
// `/private/tmp/ben-4334-r1-gegenproben/6ae30edb7bfb4ad7b101237bb8d1add4-check.err`). Der Grund stand
// im alten `eingabeImFormular`: es las Aussage und Kategorie ausschliesslich über `value`. Ein
// `value` sagt, was im Feld STEHT, und nichts darüber, ob ein Mensch es sieht.
//
// WARUM DER BEFUND AUS JOB 4295 (`strecke.ts`) DAS NICHT MITERLEDIGT — der sachliche Grund, nicht
// „weil er woanders liegt": jener Befund fragt jedes TEXTTRAGENDE ELEMENT unterhalb des Knotens, und
// texttragend heisst dort: es hängt ein nicht-leerer TEXTKNOTEN darunter. Ein `<input>` und ein
// `<textarea>` haben keinen. Ihr Wert wird vom Browser selbst gezeichnet, im geschlossenen Schatten
// des Steuerelements. Für ein Eingabefeld ist die Liste `verdeckt` daher STRUKTURELL leer — auch bei
// `color: transparent`. Deshalb steht hier eine eigene Frage für Felder, und deshalb stellt sie
// genau die Fragen, die es nur bei einem Feld gibt: Blickfeld, Schriftgrad, Füllfarbe der Schrift,
// Schrift gegen Hintergrund.
//
// WAS SIE NICHT TUT: sie ersetzt den Befund aus JOB 4295 nicht. Wo Text an Textknoten hängt
// (Konfliktsatz, Quittung, Schlagwortmarken, Einreichhinweis), bleibt jener der eine Weg; diese
// Datei ruft ihn dafür weiter auf. Zwei Fassungen DERSELBEN Frage wären der Fehler — dies ist eine
// ANDERE Frage an einem anderen Gegenstand.
//
// UND SIE WIRD NICHT GEGLAUBT, SONDERN KALIBRIERT: jede einzelne der Fragen unten hat in
// `einordnung-konflikt-pg-browser.integration.test.ts` eine BLENDE, die sie auslösen MUSS (Abschnitt
// „DIE BLENDEN"). Eine Frage ohne Blende wäre eine Behauptung über die eigene Schärfe.

/** Der Mensch scrollt zu seinem Entwurf, bevor er ihn liest — danach wird gemessen. */
const INS_BLICKFELD = `(sel) => {
  const k = document.querySelector(sel);
  if (k === null) { return false; }
  k.scrollIntoView({ block: "center", inline: "nearest" });
  return true;
}`;

/**
 * Eine Farbangabe in Zahlen — oder `null`, wenn sie sich nicht lesen lässt.
 *
 * `null` heisst ausdrücklich „unbekannt" und nicht „in Ordnung": jede Frage unten entscheidet selbst,
 * was sie mit einer unbekannten Farbe tut, statt sie stillschweigend als bestanden zu zählen.
 */
const FARBE = `(wert) => {
  const t = /^rgba?\\(([^)]+)\\)$/.exec(String(wert || "").replace(/\\s+/g, ""));
  if (t === null) { return null; }
  const teile = t[1].split(",").map((z) => Number.parseFloat(z));
  if (teile.length < 3 || teile.some((z) => Number.isNaN(z))) { return null; }
  return { r: teile[0], g: teile[1], b: teile[2], a: teile.length > 3 ? teile[3] : 1 };
}`;

/** Die Marke eines Knotens für die Meldung — sie soll auf die STELLE zeigen, nicht auf „ein Element". */
const MARKE = `(k) => {
  const kennung = k.getAttribute("data-testid");
  return "<" + k.tagName.toLowerCase() + (kennung ? "[" + kennung + "]" : "") + ">";
}`;

/**
 * SIEHT UND LIEST EIN MENSCH DEN WERT DIESES FELDES?
 *
 * Elf Fragen, jede einzeln benannt, keine davon aus einer anderen gefolgert:
 *   1 `checkVisibility({checkOpacity, checkVisibilityCSS})` — deckt die Vorfahren mit ab,
 *   2 der eigene berechnete Stil: `display`, `visibility`, `opacity`, `content-visibility`, `hidden`,
 *   3 JEDER Vorfahr einzeln, mit demselben Satz Fragen und namentlich genannt — damit die Meldung
 *     sagt, WO die Wirkung sitzt, statt nur „irgendwo darüber",
 *   4 die wirkliche Fläche (`getBoundingClientRect`),
 *   5 das Blickfeld (ein Feld bei `top: -9999px` hat Fläche und ist trotzdem fort),
 *   6 durchsichtige Schriftfarbe (`color`, Alpha 0),
 *   7 durchsichtige Schriftfüllung (`-webkit-text-fill-color` — sie überschreibt `color`),
 *   8 Schriftgrad grösser 0,
 *   9 Schrift gegen die erste DECKENDE Hintergrundfläche darüber.
 * (Die Zählung nennt neun Gruppen; `content-visibility` und `hidden` stehen in Gruppe 2 und 3.)
 *
 * ZU FRAGE 9 UND DER EHRLICHKEIT ÜBER UNBEKANNTES: findet der Aufstieg keine deckende
 * Hintergrundfläche, wird die Frage NICHT gestellt und das im Diagnosetext gesagt. Eine erfundene
 * weisse Fläche wäre eine Annahme über den Prüfplatz, und aus ihr käme entweder ein falsches Rot
 * oder ein falsches Grün. Dass die Frage auf dieser Fläche wirklich gestellt wird, belegt die Blende
 * „Schrift wie Hintergrund".
 */
const FELD_SICHTBAR = `(sel) => {
  const k = document.querySelector(sel);
  if (k === null) {
    return { da: false, wert: "", sichtbar: false, grund: "kein Knoten zu " + sel, diagnose: "" };
  }
  const marke = (${MARKE});
  const farbe = (${FARBE});
  const s = getComputedStyle(k);
  const r = k.getBoundingClientRect();
  const gruende = [];

  if (typeof k.checkVisibility === "function" && !k.checkVisibility({
    checkOpacity: true, checkVisibilityCSS: true,
    opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true
  })) {
    gruende.push("checkVisibility() verneint (prueft auch die Vorfahren)");
  }
  if (s.display === "none") { gruende.push("Feld: display:none"); }
  if (s.visibility !== "visible") { gruende.push("Feld: visibility:" + s.visibility); }
  if (Number.parseFloat(s.opacity || "1") === 0) { gruende.push("Feld: opacity:0"); }
  if (s.getPropertyValue("content-visibility") === "hidden") {
    gruende.push("Feld: content-visibility:hidden");
  }
  if (k.hasAttribute("hidden")) { gruende.push("Feld: hidden-Attribut"); }

  let v = k.parentElement;
  let stufen = 0;
  while (v !== null && stufen < 300) {
    const vs = getComputedStyle(v);
    if (vs.display === "none") { gruende.push("Vorfahr " + marke(v) + ": display:none"); }
    if (vs.visibility === "hidden" || vs.visibility === "collapse") {
      gruende.push("Vorfahr " + marke(v) + ": visibility:" + vs.visibility);
    }
    if (Number.parseFloat(vs.opacity || "1") === 0) {
      gruende.push("Vorfahr " + marke(v) + ": opacity:0");
    }
    if (vs.getPropertyValue("content-visibility") === "hidden") {
      gruende.push("Vorfahr " + marke(v) + ": content-visibility:hidden");
    }
    if (v.hasAttribute("hidden")) { gruende.push("Vorfahr " + marke(v) + ": hidden-Attribut"); }
    v = v.parentElement;
    stufen += 1;
  }

  if (r.width <= 0 || r.height <= 0) {
    gruende.push("Flaeche " + Math.round(r.width) + "x" + Math.round(r.height) + " px");
  }
  const breite = window.innerWidth;
  const hoehe = window.innerHeight;
  if (r.bottom <= 0 || r.right <= 0 || r.top >= hoehe || r.left >= breite) {
    gruende.push("ausserhalb des Blickfelds (" + Math.round(r.left) + "," + Math.round(r.top)
      + " px bei Blickfeld " + breite + "x" + hoehe + ")");
  }

  const schrift = farbe(s.color);
  if (String(s.color).replace(/\\s+/g, "") === "transparent" || (schrift !== null && schrift.a === 0)) {
    gruende.push("Feld: color:" + String(s.color).replace(/\\s+/g, ""));
  }
  const fuellungRoh = s.getPropertyValue("-webkit-text-fill-color");
  const fuellung = farbe(fuellungRoh);
  if (String(fuellungRoh).replace(/\\s+/g, "") === "transparent" || (fuellung !== null && fuellung.a === 0)) {
    gruende.push("Feld: -webkit-text-fill-color:" + String(fuellungRoh).replace(/\\s+/g, ""));
  }
  const grad = Number.parseFloat(s.fontSize || "0");
  if (!(grad > 0)) { gruende.push("Feld: font-size:" + s.fontSize); }

  const wirksam = fuellung !== null && fuellung.a === 1 ? fuellung : schrift;
  let hintergrund = null;
  let hMarke = "";
  let h = k;
  while (h !== null) {
    const hf = farbe(getComputedStyle(h).backgroundColor);
    if (hf !== null && hf.a === 1) { hintergrund = hf; hMarke = marke(h); break; }
    h = h.parentElement;
  }
  if (hintergrund !== null && wirksam !== null && wirksam.a === 1
      && wirksam.r === hintergrund.r && wirksam.g === hintergrund.g && wirksam.b === hintergrund.b) {
    gruende.push("Schrift und Hintergrund sind dieselbe Farbe (rgb(" + wirksam.r + ","
      + wirksam.g + "," + wirksam.b + ") auf " + hMarke + ")");
  }

  return {
    da: true,
    wert: typeof k.value === "string" ? k.value : "(dieser Knoten fuehrt keinen Wert)",
    sichtbar: gruende.length === 0,
    grund: gruende.join(" · "),
    diagnose: "display:" + s.display + " · visibility:" + s.visibility + " · opacity:" + s.opacity
      + " · content-visibility:" + s.getPropertyValue("content-visibility")
      + " · color:" + s.color + " · -webkit-text-fill-color:" + fuellungRoh
      + " · font-size:" + s.fontSize
      + " · Hintergrund: " + (hintergrund === null
        ? "(keine deckende Flaeche gefunden — Frage 9 NICHT gestellt)"
        : "rgb(" + hintergrund.r + "," + hintergrund.g + "," + hintergrund.b + ") an " + hMarke)
      + " · Flaeche " + Math.round(r.width) + "x" + Math.round(r.height) + " px bei ("
      + Math.round(r.left) + "," + Math.round(r.top) + ") im Blickfeld " + breite + "x" + hoehe,
  };
}`;

export interface Feldbefund {
  /** Steht das Feld überhaupt im Baum? */
  da: boolean;
  /** Der `value` — was im Feld STEHT. */
  wert: string;
  /** Sieht und liest ein Mensch diesen Wert? */
  sichtbar: boolean;
  /** Welche Frage nein gesagt hat, mit der Stelle, an der die Wirkung sitzt. */
  grund: string;
  /** Die gemessenen Werte, auch wenn alles trägt — damit ein Rot nicht erst nachgemessen werden muss. */
  diagnose: string;
}

/** Der Befund zu einem Eingabefeld, gemessen, NACHDEM der Mensch dorthin gescrollt hat. */
export async function feldbefund(seite: Seite, selektor: string): Promise<Feldbefund> {
  await seite.evaluate<boolean>(fn(INS_BLICKFELD), selektor);
  return seite.evaluate<Feldbefund>(fn(FELD_SICHTBAR), selektor);
}

/**
 * „Der Entwurf steht noch da" — der VOLLE Nachweis: der Wert ist derselbe UND man sieht ihn.
 *
 * DIE ZWEI MELDUNGEN SIND GETRENNT, weil es zwei verschiedene Fehler sind: der Entwurf ist fort —
 * oder er ist da und niemand sieht ihn. Die zweite ist BENs Fund aus Runde 1; sie nennt das Feld
 * beim Namen, den Grund und die gemessenen Werte.
 */
export async function feldErhalten(
  seite: Seite,
  selektor: string,
  soll: string,
  feldname: string,
): Promise<void> {
  const befund = await feldbefund(seite, selektor);
  expect(
    befund.da,
    `${JOB}: Feld ${feldname}: es steht überhaupt nicht im Baum (${selektor})`,
  ).toBe(true);
  expect(befund.wert, `${JOB}: Feld ${feldname}: der Entwurf ist aus dem Feld verschwunden`).toBe(
    soll,
  );
  expect(
    befund.sichtbar,
    `${JOB}: Feld ${feldname}: Wert erhalten, aber nicht sichtbar/lesbar (${befund.grund}) — gemessen: ${befund.diagnose}`,
  ).toBe(true);
}

// ------------------------------------------------------------------------------------------------
// DIE BLENDE — EINE MUTATION AN DER FLÄCHE, NIE AM PRODUKT.
// ------------------------------------------------------------------------------------------------
//
// Sie setzt einen Stil am Feld oder an seinem Elternknoten, LÄSST DEN `value` UNBERÜHRT und wird
// hinterher genau zurückgenommen — die Rücknahme wird am `style`-Attribut nachgemessen und nicht
// geglaubt. Kein Produktcode wird dafür angefasst: die Mutation lebt im geladenen Dokument und
// verschwindet mit ihm.
//
// `HINTERGRUND` im Stiltext wird im Browser durch die erste DECKENDE Hintergrundfarbe über dem Feld
// ersetzt. Nur so lässt sich die Frage „Schrift gleich Hintergrund" auslösen, ohne eine Farbe zu
// raten, die auf dieser Fläche gar nicht vorkommt.
//
// ================================================================================================
// JEDE BLENDE SCHALTET ZUERST DEN ÜBERGANG AB — GEMESSEN, NICHT VORSORGLICH (Runde 2).
// ================================================================================================
//
// GEMESSEN (Arbeitsprüfung aea605d6b5904d4a9b49226189009df4, Cloud-Lauf 9c15def8f3ef0133eb6c6bc3):
// die Blende `color:transparent` biss am `<textarea>` der Aussage, am `<input>` der Kategorie aber
// NICHT — dort stand hinterher weiterhin `color:rgb(26, 34, 51)`. Der Grund ist kein stumpfer
// Nachweis, sondern die Klasse `transition-colors` an `TextInput` (`ui.tsx:178`): Tailwind lässt
// `color` über 150 ms LAUFEN, und `getComputedStyle` liefert unmittelbar danach den noch alten Wert
// des Übergangs. Die Frage „ist die Schrift durchsichtig?" wäre also an einer Fläche gescheitert, auf
// der sie 150 ms später zugetroffen hätte.
//
// Jede Blende schaltet deshalb `transition:none` mit ein. Das ändert an der SICHTBARKEIT nichts — es
// nimmt nur die Zeit aus der Messung. Zusätzlich liest `BLENDE_SETZEN` die berechneten Werte der
// gesetzten Eigenschaften ZURÜCK (`wirkung`): eine Blende, die nicht ankommt, sagt es dann selbst,
// statt wie ein stumpfer Nachweis auszusehen.

export type Blendenziel = "feld" | "vorfahr";

/** Ohne sie misst die Blende den Übergang statt den Zustand — s. Abschnitt darüber. */
const OHNE_UEBERGANG = "transition:none";

const BLENDE_SETZEN = `([sel, ziel, stil]) => {
  const leer = { ok: false, vorher: null, grund: "", an: "", stil: "", wirkung: "" };
  const feld = document.querySelector(sel);
  if (feld === null) { return { ...leer, grund: "kein Knoten zu " + sel }; }
  const k = ziel === "vorfahr" ? feld.parentElement : feld;
  if (k === null) { return { ...leer, grund: "das Feld hat keinen Elternknoten" }; }
  let text = stil;
  if (stil.indexOf("HINTERGRUND") >= 0) {
    let h = feld;
    let gefunden = "";
    while (h !== null) {
      const hf = getComputedStyle(h).backgroundColor;
      if (/^rgb\\(/.test(String(hf).replace(/\\s+/g, ""))) { gefunden = hf; break; }
      h = h.parentElement;
    }
    if (gefunden === "") {
      return { ...leer, grund: "ueber diesem Feld liegt keine deckende Hintergrundfarbe" };
    }
    text = stil.split("HINTERGRUND").join(gefunden);
  }
  const vorher = k.getAttribute("style");
  k.setAttribute("style", (vorher === null || vorher === "" ? "" : vorher + ";") + text);
  // DER RÜCKBLICK auf genau die Eigenschaften, die diese Blende gesetzt hat.
  const s = getComputedStyle(k);
  const wirkung = text
    .split(";")
    .map((teil) => teil.split(":")[0].trim())
    .filter((name) => name !== "")
    .map((name) => name + "=" + s.getPropertyValue(name))
    .join(" · ");
  return { ok: true, vorher: vorher, grund: "", an: (${MARKE})(k), stil: text, wirkung: wirkung };
}`;

const BLENDE_NEHMEN = `([sel, ziel, vorher]) => {
  const feld = document.querySelector(sel);
  if (feld === null) { return "kein Knoten zu " + sel; }
  const k = ziel === "vorfahr" ? feld.parentElement : feld;
  if (k === null) { return "das Feld hat keinen Elternknoten"; }
  if (vorher === null) { k.removeAttribute("style"); } else { k.setAttribute("style", vorher); }
  const jetzt = k.getAttribute("style");
  if (jetzt === vorher) { return ""; }
  return "die Ruecknahme stellte \\"" + String(jetzt) + "\\" her statt \\"" + String(vorher) + "\\"";
}`;

/**
 * Eine Blende setzen, etwas messen, die Blende zurücknehmen.
 *
 * Die Rücknahme läuft im `finally` und wird NACHGEMESSEN: bliebe ein Stil stehen, wäre jede weitere
 * Messung dieses Falls wertlos, und zwar unbemerkt.
 */
export async function mitBlende<T>(
  seite: Seite,
  selektor: string,
  ziel: Blendenziel,
  stil: string,
  messen: (an: string, wirkung: string) => Promise<T>,
): Promise<T> {
  const gesetzt = await seite.evaluate<{
    ok: boolean;
    vorher: string | null;
    grund: string;
    an: string;
    stil: string;
    wirkung: string;
  }>(fn(BLENDE_SETZEN), [selektor, ziel, `${OHNE_UEBERGANG};${stil}`]);
  expect(
    gesetzt.ok,
    `${JOB}: die Blende „${stil}" liess sich nicht setzen — ${gesetzt.grund}`,
  ).toBe(true);
  try {
    return await messen(gesetzt.an, gesetzt.wirkung);
  } finally {
    const fehler = await seite.evaluate<string>(fn(BLENDE_NEHMEN), [
      selektor,
      ziel,
      gesetzt.vorher,
    ]);
    expect(fehler, `${JOB}: die Blende „${stil}" blieb stehen — ${fehler}`).toBe("");
  }
}

/** Anmeldung an der ECHTEN Maske, ausschliesslich mit der Tastatur. */
export async function anmelden(seite: Seite, basis: string, email: string): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await tippenInFeld(seite, "#auth-email", email, `E-Mail (${email})`);
  await tippenInFeld(seite, "#auth-password", KENNWORT, `Passwort (${email})`);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} trägt`,
    undefined,
    45_000,
  );
}

/** Steht das Bearbeiten-Formular offen? Gefragt an seiner Aussagenbeschriftung. */
const FORMULAR_OFFEN = `(beschriftung) => [...document.querySelectorAll("label")].some((l) => {
  const s = l.querySelector("span");
  return !!s && (s.textContent || "").trim() === beschriftung;
})`;

export function formularOffen(seite: Seite, aussageBeschriftung: string): Promise<boolean> {
  return seite.evaluate<boolean>(fn(FORMULAR_OFFEN), aussageBeschriftung);
}

/**
 * Wie viele Felder dieser Beschriftung stehen im Formular?
 *
 * Gebraucht für die Aussage „dieses Feld wird hier BEWUSST NICHT angeboten" (P5, Einreichweg). Sie
 * lässt sich mit `feldPfad` nicht führen: das ist ein Ortungsmittel und wird rot, wenn es nichts
 * findet — „nicht da" wäre dort ein Fehler und keine Messung.
 */
const BESCHRIFTUNGEN = `(beschriftung) => [...document.querySelectorAll("label")].filter((l) => {
  const s = l.querySelector("span");
  return !!s && (s.textContent || "").trim() === beschriftung;
}).length`;

export function beschriftungenZaehlen(seite: Seite, beschriftung: string): Promise<number> {
  return seite.evaluate<number>(fn(BESCHRIFTUNGEN), beschriftung);
}

/**
 * Den Eintrag als echte Navigation öffnen — mit dem Deep-Link, der das Formular aufgehen lässt
 * (`BibliothekLesen.tsx:2056`, `?edit=1`). Gewartet wird auf das FORMULAR, nicht auf „irgendwas".
 */
export async function eintragOeffnen(
  seite: Seite,
  basis: string,
  id: string,
  aussageBeschriftung: string,
): Promise<void> {
  await seite.goto(`${basis}/bibliothek?eintrag=${id}&edit=1`, { waitUntil: "load" });
  await warte(
    seite,
    FORMULAR_OFFEN,
    "das Bearbeiten-Formular des Eintrags steht offen",
    aussageBeschriftung,
    60_000,
  );
}

/** Ein Schlagwort ergänzen: in das Entwurfsfeld tippen, Enter — genau wie ein Mensch. */
export async function schlagwortErgaenzen(
  seite: Seite,
  selektor: string,
  wert: string,
): Promise<void> {
  await tippenInFeld(seite, selektor, wert, `Schlagwortfeld („${wert}")`);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `([sel, w]) => { const e = document.querySelector(sel); return !!e && e.value === "" && document.body.innerText.includes(w); }`,
    `das Schlagwort „${wert}" steht als Marke im Formular`,
    [selektor, wert],
    15_000,
  );
}

/** Der gelesene Text der ganzen Seite — für Aussagen der Form „dieser Satz steht NICHT da". */
export function seitentext(seite: Seite): Promise<string> {
  return seite.evaluate<string>(fn("() => document.body.innerText"));
}

/** Die Lage des einen Auskunftskastens über den letzten Speicherversuch — `null`, wenn keiner steht. */
const SPEICHERLAGE = `() => {
  const e = document.querySelector('[data-testid="bib-speichern-lage"]');
  return e ? e.getAttribute("data-lage") : null;
}`;

export function speicherLage(seite: Seite): Promise<string | null> {
  return seite.evaluate<string | null>(fn(SPEICHERLAGE));
}

/** Warten, bis GENAU diese Lage dasteht — nicht, bis „irgendetwas" passiert ist. */
export function warteAufLage(seite: Seite, soll: string, frist = 60_000): Promise<void> {
  return warte(
    seite,
    `(soll) => {
      const e = document.querySelector('[data-testid="bib-speichern-lage"]');
      return !!e && e.getAttribute("data-lage") === soll;
    }`,
    `der Auskunftskasten steht auf „${soll}"`,
    soll,
    frist,
  );
}

// ------------------------------------------------------------------------------------------------
// DER AUSGANG EINES SPEICHERVERSUCHS — ERST ABWARTEN, DANN BEURTEILEN.
// ------------------------------------------------------------------------------------------------
//
// Auf GENAU eine erwartete Lage zu warten sagt beim Scheitern nur, dass sie nicht kam — nicht, was
// stattdessen da war. Diese Frage wartet deshalb auf IRGENDEINEN Ausgang (Auskunftskasten,
// Fehlerkasten, Einreichpflicht, Quittung) und benennt ihn; der Fachfall entscheidet danach, ob es
// der richtige war. Ein Versuch, der gar nichts hinterlässt, bleibt damit vom falschen Ausgang
// unterscheidbar — „es kam nichts" und „es kam das Falsche" sind zwei verschiedene Befunde.
const AUSGANG = `() => {
  const lage = document.querySelector('[data-testid="bib-speichern-lage"]');
  if (lage) { return "lage:" + lage.getAttribute("data-lage"); }
  const fehler = document.querySelector('[data-testid="bib-speichern-fehler"]');
  if (fehler) { return "fehlerkasten: " + (fehler.textContent || "").trim().slice(0, 200); }
  const pflicht = document.querySelector('[data-testid="bib-einreichen-pflicht"]');
  if (pflicht) { return "einreichpflicht"; }
  const quittung = document.querySelector("output");
  if (quittung) { return "quittung: " + (quittung.textContent || "").trim().slice(0, 120); }
  return "";
}`;

/** Was gerade als Ausgang dasteht — leer, solange der Versuch noch läuft. */
export function ausgang(seite: Seite): Promise<string> {
  return seite.evaluate<string>(fn(AUSGANG));
}

export function warteAufAusgang(seite: Seite, was: string, frist = 60_000): Promise<void> {
  return warte(
    seite,
    `() => (${AUSGANG})() !== ""`,
    `${was}: der Speicherversuch hinterlässt überhaupt einen Ausgang`,
    undefined,
    frist,
  );
}

export { starteChromium, profil, warte, fn };
export type { Browser, Kontext, Seite };
