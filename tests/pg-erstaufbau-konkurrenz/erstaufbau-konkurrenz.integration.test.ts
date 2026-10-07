import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices, createPool, migrate } from "../../services/app";
import { MIGRATIONSSPERRE, schemas } from "../../services/app/src/db";
import { AuditService, PgAuditRepo } from "../../services/audit";
import { type TxContext, guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";
import {
  TRGM_SPERRSCHLUESSEL,
  stelleTrigrammErweiterungSicher,
} from "../office-pg-abnahme/rueckweg-erwartung";

// ================================================================================================
// AUFNAHME 20260922 · PG-START-AUDIT-KONKURRENZ — DER ERSTAUFBAU, GLEICHZEITIG, AUF FRISCHER DB.
// ================================================================================================
//
// DIE HISTORISCHEN AUSLÖSER UND WO SIE HEUTE STEHEN (nachgeschlagen, nicht erinnert):
//
//  A · JOB 4321, BENs Runde-3-Prüflücke: „der breitere Konkurrenzfall bleibt ausserhalb dieser
//      Abnahme: `build-app.integration.test.ts:101` initialisiert weiterhin ungesichert."
//      JOB 4321 hat den Wettlauf um `CREATE EXTENSION pg_trgm` für zwei Dateien geschlossen
//      (`stelleTrigrammErweiterungSicher`, `tests/office-pg-abnahme/rueckweg-erwartung.ts`);
//      spätere Lieferungen haben denselben Weg übernommen (`tests/security/suchdeckel-trim-
//      paritaet…`, `tests/wiki-diskussion-nutzerweg/…`, und nach dieser Aufnahme
//      `tests/wiki-bearbeitungsreservierung/zwei-prozesse-pg-im-browser…` vor ihrem `migrate`).
//      Die Persistenzsuite der App lief bis zu
//      dieser Aufnahme als EINZIGE Integrationsdatei mit eigener ungesicherter Anlage. Sie benutzt
//      jetzt denselben Schutzpfad — E1 lässt die ECHTE Datei in der erzwungenen
//      Überlappung laufen und misst an ihrer Sitzung, dass sie den Pfad durchläuft; E1-K belegt, dass
//      ein entfernter oder umgangener Aufruf den Nachweis scheitern lässt.
//  B · JOB 4271 (W1-Hinweis in BENs Urteilen: „separate Reproduktion der Startzeit- und
//      Audit-Konkurrenzfehler"), README `tests/wiki-grossbestand-nutzerweg/README.md` Befunde 2/3:
//      2 · Startzeit: `onReady` → `stelleSuchprojektionBereit` gegen Fastifys Vorgabe-
//          `pluginTimeout` (10 s) bei 10.000 Einträgen. Heute `services/app/src/build-app.ts`
//          `Fastify({ trustProxy, logger })` — weiterhin ohne `pluginTimeout`. Der 10.000er-Fall
//          wird HIER NICHT wiederholt (er gehört der Grossbestand-Suite); gemessen wird der
//          gleichzeitige START zweier Instanzen auf frischer Datenbank (E2).
//      3 · Audit: `AuditService.record`/`recordOnce` lesen `last.seq` und schreiben `seq + 1`
//          ohne Serialisierung (`services/audit/src/service.ts`). E3 hat es deterministisch
//          reproduziert; behoben in der Aufnahme gesamt-auditprotokoll (Lauf 3) über die
//          Kettensperre in `PgAuditRepo.appendNext`. E3 misst seither das Warten an der Sperre und
//          den vorhandenen Schutzpfad `recordOnce` (Ereigniskennung) an genau seiner Stelle.
//
// WARUM EINE EIGENE, WEGWERFBARE DATENBANK JE FALL. Der Wettlauf entsteht NUR beim Erstaufbau;
// auf der geteilten Instanz des Integrationslaufs trägt `pg_extension` die Erweiterung längst.
// Jeder Fall legt deshalb seine Datenbank frisch an und räumt sie wieder weg — dieselbe Bauform
// wie JOB 4321 Q7 (`tests/office-pg-abnahme/rueckweg-pg.integration.test.ts`).
//
// WARUM CHOREOGRAFIE STATT `Promise.all` UND HOFFEN. Ein freies Nebeneinander trifft den Wettlauf
// manchmal und manchmal nicht; ein Grün daraus sagt nichts. Jede Überlappung unten wird HERGESTELLT:
// A hält seine Anlage in einer offenen Transaktion, B läuft los, der Fall wartet, bis B in
// `pg_stat_activity` nachweislich an einer Sperre hängt, erst dann schreibt A fest.

const PREFIX = "[KLARWERK][pg-start-audit-konkurrenz]";
const DB_E1 = "klarwerk_test_konkurrenz_e1";
const DB_E2 = "klarwerk_test_konkurrenz_e2";
const DB_E2K = "klarwerk_test_konkurrenz_e2k";
const DB_E3 = "klarwerk_test_konkurrenz_e3";
const DB_E1K_ENTFERNT = "klarwerk_test_konkurrenz_e1k_entfernt";
const DB_E1K_UMGANGEN = "klarwerk_test_konkurrenz_e1k_umgangen";
const HAUSFORM_SCHEMATA = ["konkurrenz_a", "konkurrenz_b", "konkurrenz_c"] as const;

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, "../..");
const BUILD_APP_SUITE = join(REPO, "services/app/src/build-app.integration.test.ts");

/** Dieselbe Verbindungszeichenkette mit anderem Datenbanknamen — Muster wie JOB 4321 Q7. */
function mitDatenbank(url: string, name: string): string {
  const treffer = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(url);
  if (!treffer) {
    throw new Error(`${PREFIX} die Verbindungszeichenkette trägt keinen lesbaren Datenbanknamen.`);
  }
  return `${treffer[1]}${name}${treffer[3]}`;
}

/** Was ein Fehler über sich sagt — Code, Einschränkung, Meldung. Nie der ganze Stapel. */
interface Ausgang {
  ok: boolean;
  code?: string;
  constraint?: string;
  meldung?: string;
  ms: number;
}

async function miss(arbeit: () => Promise<unknown>): Promise<Ausgang> {
  const start = Date.now();
  try {
    await arbeit();
    return { ok: true, ms: Date.now() - start };
  } catch (fehler) {
    const f = fehler as { code?: unknown; constraint?: unknown; message?: unknown };
    return {
      ok: false,
      ...(typeof f.code === "string" ? { code: f.code } : {}),
      ...(typeof f.constraint === "string" ? { constraint: f.constraint } : {}),
      meldung: String(f.message ?? fehler),
      ms: Date.now() - start,
    };
  }
}

function protokolliere(fall: string, daten: unknown): void {
  process.stderr.write(`${PREFIX} ${fall} ${JSON.stringify(daten)}\n`);
}

/**
 * Der Schemaaufbau in der Bauform VOR R-0800: dieselben Stufen in derselben Reihenfolge, aber ohne
 * Migrationssperre. Nur für die Kalibrierung E2-K — sie belegt, dass die Überlappung ohne Sperre
 * wirklich scheitert und E2 deshalb etwas misst.
 */
async function ungesperrterAufbau(ziel: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  for (const ddl of schemas) {
    await ziel.query(ddl);
  }
}

describe("Aufnahme pg-start-audit-konkurrenz · paralleler Erstaufbau auf frischer PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let basisUrl = "";
  let grund = "";

  beforeAll(async () => {
    // Auswahlreihenfolge des Hauses (JOB 4299): lokale URL über die Sicherung, sonst Container,
    // sonst sichtbarer Skip. Übersprungen wird NUR, wenn keine Datenbank erreichbar ist.
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      basisUrl = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt.";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        basisUrl = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (basisUrl) {
      const kandidat = createPool(basisUrl);
      try {
        await kandidat.query("SELECT 1");
        verwaltung = kandidat;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
        await kandidat.end().catch(() => undefined);
      }
    }
    if (!verwaltung) {
      process.stderr.write(`${PREFIX} ÜBERSPRUNGEN — Grund: ${grund}\n`);
    }
  }, 180_000);

  afterAll(async () => {
    for (const db of [DB_E1, DB_E1K_ENTFERNT, DB_E1K_UMGANGEN, DB_E2, DB_E2K, DB_E3]) {
      await verwaltung?.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    }
    await verwaltung?.end();
    await container?.stop();
  });

  /** Legt die Wegwerfdatenbank frisch an und belegt, dass sie wirklich leer ist. */
  async function frischeDatenbank(name: string): Promise<string> {
    const v = verwaltung as Pool;
    await v.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await v.query(`CREATE DATABASE ${name}`);
    const url = mitDatenbank(basisUrl, name);
    const probe = new Pool({ connectionString: url, max: 1 });
    try {
      const trgm = await probe.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'");
      const tabellen = await probe.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public'",
      );
      // DER BODEN: ohne ihn wäre jede Aussage über den ERSTAUFBAU haltlos.
      expect(trgm.rowCount, `${name} trägt pg_trgm schon — kein Erstaufbau`).toBe(0);
      expect(tabellen.rowCount, `${name} trägt schon Tabellen — kein Erstaufbau`).toBe(0);
    } finally {
      await probe.end();
    }
    return url;
  }

  /** Wartet, bis in `db` mindestens `anzahl` Sitzungen an einer Sperre der Art `art` hängen. */
  async function warteAufWartende(db: string, anzahl: number, art?: string): Promise<number> {
    const v = verwaltung as Pool;
    const frist = Date.now() + 20_000;
    let n = 0;
    while (Date.now() < frist) {
      const res = await v.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = $1 AND wait_event_type = 'Lock' AND ($2::text IS NULL OR wait_event = $2)`,
        [db, art ?? null],
      );
      n = res.rows[0]?.n ?? 0;
      if (n >= anzahl) {
        return n;
      }
      await new Promise((weiter) => setTimeout(weiter, 50));
    }
    throw new Error(
      `${PREFIX} in ${db} warteten nach 20 s nur ${n} statt ${anzahl} Sitzungen an einer Sperre${art ? ` (${art})` : ""} — die Überlappung kam nicht zustande, der Ausgang sagte nichts.`,
    );
  }

  async function tabellenJeSchema(url: string, schemata: string[]): Promise<Map<string, string>> {
    const probe = new Pool({ connectionString: url, max: 1 });
    try {
      const res = await probe.query<{ schema: string; tabellen: string }>(
        `SELECT table_schema AS schema, string_agg(table_name, ',' ORDER BY table_name) AS tabellen
           FROM information_schema.tables WHERE table_schema = ANY($1) GROUP BY table_schema`,
        [schemata],
      );
      return new Map(res.rows.map((z) => [z.schema, z.tabellen]));
    } finally {
      await probe.end();
    }
  }

  // ----------------------------------------------------------------------------------------------
  // E1 · AUSLÖSER A — der gemeinsame Erstaufbau, mit der ECHTEN App-Suite als Teilnehmer.
  // ----------------------------------------------------------------------------------------------
  //
  // RUNDE 2 (BENs Befund): Runde 1 band die App-Suite nur über zwei Muster am Quelltext ein; alle
  // gemessenen Aufbauten stammten aus einer Nachbildung, und ein auskommentierter Schutzaufruf liess
  // die Muster bestehen. Jetzt LÄUFT die Datei `services/app/src/build-app.integration.test.ts`
  // selbst — als eigener vitest-Prozess gegen die frische Datenbank, erkennbar an ihrem
  // `application_name`. Gemessen wird an IHRER Sitzung, woran sie wartet, und an IHREM Bericht, ob
  // ihr Fall bestanden hat.
  //
  // DIE ÜBERLAPPUNG. Ein Halter spielt die Datei, die die Erweiterung GERADE anlegt: er hält die
  // Sperre des Schutzpfads UND eine offene Transaktion mit `CREATE EXTENSION`. Wer den Schutzpfad
  // benutzt, wartet an der Beratungssperre (`advisory`) und kommt nach der Freigabe durch. Wer ihn
  // entfernt oder umgeht, wartet an der offenen Anlage selbst und fällt nach dem Festschreiben an
  // `pg_extension_name_index` aus — genau BENs Messung aus JOB 4321.
  //
  // DIE KALIBRIERUNG. Dieselbe Messung läuft zweimal gegen eine TEXTLICH VERÄNDERTE Abschrift der
  // echten Datei: einmal ist der Schutzaufruf entfernt, einmal wird er durch eine vorgezogene
  // blanke Anlage umgangen. Beide Male MUSS der Nachweis scheitern — sonst misst er nichts. Die
  // Abschriften liegen nur für die Dauer des Falls neben dem Original (die relativen Importe müssen
  // auflösen) und werden im `finally` entfernt; ein Integrationslauf sammelt seine Dateien beim
  // Start und sieht sie deshalb nicht.

  const APP_NAME = "klarwerk_e1_appsuite";
  const SCHUTZAUFRUF = "await stelleTrigrammErweiterungSicher(verwaltung);";
  const BLANKE_ANLAGE = 'await verwaltung.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");';

  interface SuitenLauf {
    /** `wait_event` der Suite-Sitzung, als sie an einer Sperre hing — `null`: nie gewartet. */
    wartetAn: string | null;
    exit: number | null;
    bestanden: number;
    gescheitert: number;
    uebersprungen: number;
    ausgabe: string;
  }

  /** Der Nachweis „die App-Suite hat den Schutzpfad in der Überlappung benutzt und bestanden". */
  function nachweisGilt(l: SuitenLauf): boolean {
    return (
      l.wartetAn === "advisory" &&
      l.exit === 0 &&
      l.bestanden === 1 &&
      l.gescheitert === 0 &&
      l.uebersprungen === 0
    );
  }

  function mitAppName(url: string): string {
    return `${url}${url.includes("?") ? "&" : "?"}application_name=${APP_NAME}`;
  }

  /** Startet eine Suite-Datei als eigenen vitest-Prozess gegen `url`. */
  function starteSuite(
    datei: string,
    url: string,
  ): { ende: Promise<Omit<SuitenLauf, "wartetAn">>; beendet: () => boolean } {
    const bericht = join(mkdtempSync(join(tmpdir(), "klarwerk-e1-")), "bericht.json");
    const env: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(process.env)) {
      // Der Kindlauf ist ein eigener vitest-Lauf, kein Arbeiter dieses Laufs.
      if (!k.startsWith("VITEST")) {
        env[k] = v;
      }
    }
    env.KLARWERK_PG_TEST_URL = mitAppName(url);
    const kind = spawn(
      process.execPath,
      [
        join(REPO, "node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        "vitest.integration.config.ts",
        "--reporter=default",
        "--reporter=json",
        `--outputFile.json=${bericht}`,
        datei,
      ],
      { cwd: REPO, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let ausgabe = "";
    kind.stdout?.on("data", (d: Buffer) => {
      ausgabe += d.toString();
    });
    kind.stderr?.on("data", (d: Buffer) => {
      ausgabe += d.toString();
    });
    let fertig = false;
    const ende = new Promise<Omit<SuitenLauf, "wartetAn">>((weiter) => {
      kind.on("close", (exit) => {
        fertig = true;
        let zahlen = { bestanden: 0, gescheitert: 0, uebersprungen: 0 };
        try {
          const j = JSON.parse(readFileSync(bericht, "utf8")) as {
            numPassedTests: number;
            numFailedTests: number;
            numPendingTests: number;
            numTodoTests?: number;
            testResults?: {
              message?: string;
              assertionResults?: { failureMessages?: string[] }[];
            }[];
          };
          for (const t of j.testResults ?? []) {
            ausgabe += `\n${t.message ?? ""}`;
            for (const a of t.assertionResults ?? []) {
              ausgabe += `\n${(a.failureMessages ?? []).join("\n")}`;
            }
          }
          zahlen = {
            bestanden: j.numPassedTests,
            gescheitert: j.numFailedTests,
            uebersprungen: j.numPendingTests + (j.numTodoTests ?? 0),
          };
        } catch {
          // Kein Bericht: die Zahlen bleiben 0, der Exit-Code trägt den Befund.
        }
        rmSync(dirname(bericht), { recursive: true, force: true });
        weiter({ exit, ...zahlen, ausgabe: ausgabe.slice(-3000) });
      });
    });
    return { ende, beendet: () => fertig };
  }

  /**
   * Die Überlappung für EINE Suite-Datei auf EINER frischen Datenbank. `mitHausform` legt drei
   * weitere Aufbauten in der Bauform der übrigen Integrationsdateien daneben.
   */
  async function ueberlappenderErstaufbau(
    datei: string,
    db: string,
    mitHausform: boolean,
  ): Promise<{ lauf: SuitenLauf; hausformFehler: unknown[]; advisoryWartende: number }> {
    const url = await frischeDatenbank(db);
    const pools: Pool[] = [];
    const neuerPool = (optionen?: string): Pool => {
      const p = new Pool({
        connectionString: url,
        max: 2,
        ...(optionen ? { options: optionen } : {}),
      });
      pools.push(p);
      return p;
    };
    const halter = await neuerPool().connect();
    let festgeschrieben = false;
    try {
      await halter.query("SELECT pg_advisory_lock($1)", [TRGM_SPERRSCHLUESSEL]);
      await halter.query("BEGIN");
      await halter.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");

      const hausform = async (schema: string): Promise<void> => {
        const v = neuerPool();
        await stelleTrigrammErweiterungSicher(v);
        await v.query(`CREATE SCHEMA ${schema}`);
        await migrate(neuerPool(`-c search_path=${schema},public`));
      };
      const hausformLaeufe = (mitHausform ? HAUSFORM_SCHEMATA : []).map((s) =>
        hausform(s).then(
          () => undefined,
          (f: unknown) => f ?? new Error("Fehler ohne Inhalt"),
        ),
      );
      const suite = starteSuite(datei, url);

      // Woran hängt die Sitzung der Suite? Die Frist ist grosszügig: der Kindlauf muss erst
      // starten und die App-Module laden.
      const v = verwaltung as Pool;
      let wartetAn: string | null = null;
      const frist = Date.now() + 120_000;
      while (Date.now() < frist && !suite.beendet()) {
        const res = await v.query<{ wait_event: string }>(
          `SELECT wait_event FROM pg_stat_activity
            WHERE datname = $1 AND application_name = $2 AND wait_event_type = 'Lock'`,
          [db, APP_NAME],
        );
        if (res.rows[0]) {
          wartetAn = res.rows[0].wait_event;
          break;
        }
        await new Promise((weiter) => setTimeout(weiter, 50));
      }
      const advisoryWartende = mitHausform
        ? await warteAufWartende(db, HAUSFORM_SCHEMATA.length + 1, "advisory").catch(() => 0)
        : 0;

      await halter.query("COMMIT");
      await halter.query("SELECT pg_advisory_unlock($1)", [TRGM_SPERRSCHLUESSEL]);
      festgeschrieben = true;
      const [ende, hausformFehler] = await Promise.all([suite.ende, Promise.all(hausformLaeufe)]);
      return { lauf: { wartetAn, ...ende }, hausformFehler, advisoryWartende };
    } finally {
      if (!festgeschrieben) {
        await halter.query("ROLLBACK").catch(() => undefined);
      }
      halter.release();
      for (const p of pools) {
        await p.end().catch(() => undefined);
      }
    }
  }

  /** Die echte Suite mit einer einzigen, geprüften Textänderung — neben dem Original abgelegt. */
  function abschrift(name: string, ersetzen: string): string {
    const quelle = readFileSync(BUILD_APP_SUITE, "utf8");
    // Genau EIN Schutzaufruf, sonst ist unklar, was die Kalibrierung entfernt.
    expect(quelle.split(SCHUTZAUFRUF).length - 1, "Schutzaufrufe in der App-Suite").toBe(1);
    const ziel = join(dirname(BUILD_APP_SUITE), `build-app.e1-${name}.integration.test.ts`);
    writeFileSync(ziel, quelle.replace(SCHUTZAUFRUF, ersetzen));
    return ziel;
  }

  it("E1 · die echte App-Suite im gemeinsamen Erstaufbau auf frischer DB: sie wartet am Schutzpfad und besteht, neben drei Hausform-Aufbauten; ein Schemastand", async (ctx) => {
    if (!verwaltung) {
      ctx.skip();
      return;
    }
    const { lauf, hausformFehler, advisoryWartende } = await ueberlappenderErstaufbau(
      BUILD_APP_SUITE,
      DB_E1,
      true,
    );
    const { ausgabe, ...kurz } = lauf;
    protokolliere("E1", {
      appSuite: kurz,
      advisoryWartende,
      hausformFehler: hausformFehler.map((f) => (f ? String(f) : null)),
    });
    expect(nachweisGilt(lauf), `${JSON.stringify(kurz)}\n${ausgabe}`).toBe(true);
    // Die drei Hausform-Aufbauten und die Suite hingen GLEICHZEITIG am Schutzpfad.
    expect(advisoryWartende).toBeGreaterThanOrEqual(HAUSFORM_SCHEMATA.length + 1);
    expect(hausformFehler).toEqual(HAUSFORM_SCHEMATA.map(() => undefined));

    // Ein Schemastand: jedes Hausform-Schema trägt denselben Tabellensatz, die Erweiterung gibt es
    // genau einmal. (Das Schema der App-Suite räumt deren `afterAll` wieder weg; ihr Stand ist
    // durch ihren bestandenen Fall belegt.)
    const url = mitDatenbank(basisUrl, DB_E1);
    const stand = await tabellenJeSchema(url, [...HAUSFORM_SCHEMATA]);
    const saetze = new Set(HAUSFORM_SCHEMATA.map((s) => stand.get(s)));
    expect(saetze.size, JSON.stringify(Object.fromEntries(stand))).toBe(1);
    expect([...saetze][0]?.split(",")).toEqual(expect.arrayContaining(["audit", "kos", "users"]));
    const probe = new Pool({ connectionString: url, max: 1 });
    try {
      const trgm = await probe.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'");
      expect(trgm.rowCount).toBe(1);
    } finally {
      await probe.end();
    }
  }, 300_000);

  it("E1-K · KALIBRIERUNG: entfernter oder umgangener Schutzaufruf in der App-Suite lässt den Nachweis scheitern", async (ctx) => {
    if (!verwaltung) {
      ctx.skip();
      return;
    }
    const varianten = [
      { name: "ohne-schutz", ersetzen: BLANKE_ANLAGE, db: DB_E1K_ENTFERNT },
      {
        name: "schutz-umgangen",
        ersetzen: `${BLANKE_ANLAGE}\n        ${SCHUTZAUFRUF}`,
        db: DB_E1K_UMGANGEN,
      },
    ];
    const befunde: Record<string, unknown> = {};
    for (const v of varianten) {
      const datei = abschrift(v.name, v.ersetzen);
      try {
        const { lauf } = await ueberlappenderErstaufbau(datei, v.db, false);
        const { ausgabe, ...kurz } = lauf;
        befunde[v.name] = kurz;
        expect(nachweisGilt(lauf), `${v.name}: ${JSON.stringify(kurz)}`).toBe(false);
        // Und zwar aus dem richtigen Grund: die Suite hing an der offenen Anlage, nicht an der
        // Beratungssperre, und ihr Aufbau fiel danach aus.
        expect(lauf.wartetAn, `${v.name}: ${JSON.stringify(kurz)}`).not.toBe("advisory");
        expect(lauf.wartetAn, `${v.name}: die Überlappung kam nicht zustande`).not.toBeNull();
        expect(lauf.exit, `${v.name}: ${ausgabe}`).not.toBe(0);
        expect(lauf.bestanden).toBe(0);
        expect(ausgabe).toMatch(/pg_extension_name_index|already exists/);
      } finally {
        rmSync(datei, { force: true });
      }
    }
    protokolliere("E1-K", befunde);
  }, 600_000);

  // ----------------------------------------------------------------------------------------------
  // E2 · AUSLÖSER B2 — zwei Instanzen starten gleichzeitig gegen eine frische Datenbank.
  // ----------------------------------------------------------------------------------------------
  it("E2 · zwei Instanzen, Produktstart wie server.ts (migrate → buildApp → ready): gemessener Ausgang je Instanz und der Stand danach", async (ctx) => {
    if (!verwaltung) {
      ctx.skip();
      return;
    }
    const url = await frischeDatenbank(DB_E2);
    const poolA = new Pool({ connectionString: url, max: 4 });
    const poolB = new Pool({ connectionString: url, max: 4 });
    const bericht: Record<string, unknown> = {};
    try {
      // (a) Der Schemaaufbau überlappt: A steht MITTEN in `migrate()` — er hält die
      //     Migrationssperre und hat alle Stufen in einer offenen Transaktion ausgeführt. B startet
      //     `migrate()` so, wie `server.ts` es tut.
      //
      // BIS R-0800 STAND HIER DER REPRODUZIERTE REST: `migrate()` lief ohne Sperre, und B fiel mit
      // `23505` im Katalog aus (gemessen `pg_type_typname_nsp_index`, Testserver-Lauf
      // pa-1790428493-d9a9274b). Die Behebung ist gelandet (`services/app/src/db.ts`,
      // `MIGRATIONSSPERRE`); die Zusicherung lautet deshalb jetzt „B wartet an der Sperre und kommt
      // durch". Dass die Überlappung ohne Sperre WIRKLICH scheitert, hält E2-K unten fest.
      const a = await poolA.connect();
      let ausgangB: Ausgang;
      try {
        await a.query("SELECT pg_advisory_lock($1)", [MIGRATIONSSPERRE]);
        await a.query("BEGIN");
        for (const ddl of schemas) {
          await a.query(ddl);
        }
        const laufB = miss(() => migrate(poolB));
        // `advisory` und nicht irgendeine Sperre: B hängt an GENAU dem Schlüssel, den A hält —
        // A hält keinen anderen. Damit ist belegt, dass der Produktweg von B die Sperre nimmt.
        bericht.wartendBeiMigrate = await warteAufWartende(DB_E2, 1, "advisory");
        await a.query("COMMIT");
        await a.query("SELECT pg_advisory_unlock($1)", [MIGRATIONSSPERRE]);
        ausgangB = await laufB;
      } finally {
        a.release();
      }
      bericht.migrateB = ausgangB;
      expect(bericht.wartendBeiMigrate as number).toBeGreaterThanOrEqual(1);
      expect(ausgangB.ok, JSON.stringify(ausgangB)).toBe(true);

      // (b) WIEDERHOLBAR: ein weiterer Lauf von B findet das fertige Schema und ist folgenlos.
      bericht.migrateBNeustart = await miss(() => migrate(poolB));
      expect((bericht.migrateBNeustart as Ausgang).ok).toBe(true);

      // (c) Beide Instanzen gleichzeitig bis `ready`: `stelleSuchprojektionBereit` läuft zweimal
      //     parallel. Der vorhandene Schutzpfad ist der Zustandswechsel mit erwartetem Vorzustand
      //     (`SEARCH_PROJECTION_NOT_READY`, „erwartet UNINITIALIZED, vorgefunden V2_BUILDING");
      //     wer ihn verliert, wird fail-closed NICHT bereit. Wer verliert, hängt am Takt — fest
      //     steht: mindestens eine wird bereit, jede andere scheitert GENAU an diesem Schutz, der
      //     Endstand ist EIN aktiver Stand, und ein Neustart des Verlierers wird bereit.
      const appA = buildApp(buildPgServices(poolA));
      const appB = buildApp(buildPgServices(poolB));
      let ready: Ausgang[] = [];
      try {
        ready = await Promise.all([
          miss(async () => {
            await appA.ready();
          }),
          miss(async () => {
            await appB.ready();
          }),
        ]);
      } finally {
        await appA.close().catch(() => undefined);
        await appB.close().catch(() => undefined);
      }
      bericht.ready = ready;
      const steuerung = await poolA.query<{
        projection_state: string;
        active_generation: string;
        build_generation: string;
      }>("SELECT projection_state, active_generation, build_generation FROM ko_projection_control");
      bericht.projektion = steuerung.rows;
      const neustart = buildApp(buildPgServices(poolB));
      try {
        bericht.readyNeustart = await miss(async () => {
          await neustart.ready();
        });
      } finally {
        await neustart.close().catch(() => undefined);
      }
      const stand = await tabellenJeSchema(url, ["public"]);
      bericht.tabellen = stand.get("public")?.split(",").length ?? 0;
      protokolliere("E2", bericht);

      expect(
        ready.some((r) => r.ok),
        JSON.stringify(ready),
      ).toBe(true);
      for (const r of ready.filter((x) => !x.ok)) {
        expect(r.code, JSON.stringify(r)).toBe("SEARCH_PROJECTION_NOT_READY");
      }
      expect(steuerung.rows).toHaveLength(1);
      expect(steuerung.rows[0]?.projection_state).toBe("V2_ACTIVE");
      expect(steuerung.rows[0]?.active_generation).toBe(steuerung.rows[0]?.build_generation);
      expect((bericht.readyNeustart as Ausgang).ok, JSON.stringify(bericht.readyNeustart)).toBe(
        true,
      );
    } finally {
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // E2-K · KALIBRIERUNG ZU E2 — dieselbe Überlappung OHNE Migrationssperre scheitert.
  // ----------------------------------------------------------------------------------------------
  //
  // Ohne diesen Fall bliebe offen, ob E2 grün ist, weil die Sperre wirkt, oder weil die Überlappung
  // gar nicht schadet. Hier laufen dieselben Stufen in der Bauform vor R-0800 (`ungesperrterAufbau`)
  // — und die Zweitinstanz fällt genau so aus, wie es der Testserver-Lauf pa-1790428493-d9a9274b
  // gemessen hat.
  it("E2-K · KALIBRIERUNG: derselbe überlappende Erstaufbau ohne Sperre lässt die Zweitinstanz an 23505 scheitern", async (ctx) => {
    if (!verwaltung) {
      ctx.skip();
      return;
    }
    const url = await frischeDatenbank(DB_E2K);
    const poolA = new Pool({ connectionString: url, max: 1 });
    const poolB = new Pool({ connectionString: url, max: 1 });
    try {
      const a = await poolA.connect();
      let ausgangB: Ausgang;
      let wartend = 0;
      try {
        await a.query("BEGIN");
        await ungesperrterAufbau(a);
        const laufB = miss(() => ungesperrterAufbau(poolB));
        // Ohne Sperre wartet B NICHT an `advisory`, sondern an der offenen Anlage von A.
        wartend = await warteAufWartende(DB_E2K, 1);
        await a.query("COMMIT");
        ausgangB = await laufB;
      } finally {
        a.release();
      }
      protokolliere("E2-K", { wartend, migrateB: ausgangB });
      expect(wartend).toBeGreaterThanOrEqual(1);
      expect(ausgangB.ok, JSON.stringify(ausgangB)).toBe(false);
      expect(ausgangB.code).toBe("23505");
      expect(ausgangB.constraint).toMatch(/^pg_(type_typname|class_relname|extension_name)/);
    } finally {
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // E3 · AUSLÖSER B3 — das Prüfprotokoll unter zwei gleichzeitigen Schreibern.
  // ----------------------------------------------------------------------------------------------
  it("E3 · Audit: überlappende record/recordOnce aus zwei Instanzen — Ausgang je Pfad, Kette danach", async (ctx) => {
    if (!verwaltung) {
      ctx.skip();
      return;
    }
    const url = await frischeDatenbank(DB_E3);
    const poolA = new Pool({ connectionString: url, max: 4 });
    const poolB = new Pool({ connectionString: url, max: 4 });
    const bericht: Record<string, unknown> = {};
    try {
      await migrate(poolA);
      const auditA = new AuditService({ repo: new PgAuditRepo(poolA) });
      const auditB = new AuditService({ repo: new PgAuditRepo(poolB) });

      /** A schreibt in offener Transaktion, B schreibt daneben; A schreibt erst fest, wenn B wartet. */
      async function ueberlappend(
        schreibA: (tx: TxContext) => Promise<unknown>,
        schreibB: () => Promise<unknown>,
      ): Promise<{ wartend: number; b: Ausgang; bWert?: unknown }> {
        let bWert: unknown;
        let b: Promise<Ausgang> | undefined;
        let wartend = 0;
        await withPgTx(poolA, async (tx) => {
          await schreibA(tx);
          b = miss(async () => {
            bWert = await schreibB();
          });
          wartend = await warteAufWartende(DB_E3, 1);
        });
        const ausgang = await (b as Promise<Ausgang>);
        return { wartend, b: ausgang, ...(bWert !== undefined ? { bWert } : {}) };
      }

      const eintrag = (action: string, target: string) => ({ actor: "e3", action, target });

      // (1) record gegen record — der Weg aller gewöhnlichen Handlungen.
      bericht.recordRecord = await ueberlappend(
        (tx) => auditA.record(eintrag("e3.a", "r1"), tx),
        () => auditB.record(eintrag("e3.b", "r1")),
      );
      // (2) recordOnce mit DERSELBEN Ereigniskennung — der vorhandene Schutzpfad.
      bericht.recordOnceGleich = await ueberlappend(
        (tx) => auditA.recordOnce("e3:gleich", eintrag("ko.created", "k1"), tx),
        () => auditB.recordOnce("e3:gleich", eintrag("ko.created", "k1")),
      );
      // (3) recordOnce mit VERSCHIEDENEN Kennungen — die Lage aus JOB 4271 (zwei Anlagen).
      bericht.recordOnceVerschieden = await ueberlappend(
        (tx) => auditA.recordOnce("e3:k2", eintrag("ko.created", "k2"), tx),
        () => auditB.recordOnce("e3:k3", eintrag("ko.created", "k3")),
      );

      const zeilen = await poolA.query<{ seq: number; event_id: string | null }>(
        "SELECT seq, event_id FROM audit ORDER BY seq",
      );
      bericht.zeilen = zeilen.rows;
      bericht.ketteIntakt = await auditA.verify();

      type Ueberlappung = { wartend: number; b: Ausgang; bWert?: unknown };
      const rr = bericht.recordRecord as Ueberlappung;
      const og = bericht.recordOnceGleich as Ueberlappung;
      const ov = bericht.recordOnceVerschieden as Ueberlappung;
      for (const u of [rr, og, ov]) {
        expect(u.wartend).toBeGreaterThanOrEqual(1);
      }
      // DER SCHUTZPFAD HÄLT, WOFÜR ER GEBAUT IST: dieselbe Ereigniskennung → B schreibt nicht,
      // meldet ehrlich `false`, wirft nicht.
      expect(og.b).toMatchObject({ ok: true });
      expect(og.bWert).toBe(false);
      // BEHOBEN (Aufnahme gesamt-auditprotokoll, Lauf 3): bis dahin fiel B hier an `audit_pkey`
      // (23505) — `record` und `recordOnce` teilten die unserialisierte Folge `last()` → `seq + 1`.
      // Jetzt liegen Vorgänger-Lesen und INSERT unter der transaktionsgebundenen Kettensperre
      // (`PgAuditRepo.appendNext`, `pg_advisory_xact_lock`); B wartet dort, bis A festschreibt, und
      // hängt danach an den festgeschriebenen Vorgänger an. `wartend` oben zeigt das Warten.
      for (const u of [rr, ov]) {
        expect(u.b, JSON.stringify(u.b)).toMatchObject({ ok: true });
      }
      // Eindeutig erfasst: lückenlose Folge, jede Kennung einmal, Kette intakt.
      expect(zeilen.rows).toEqual([
        { seq: 1, event_id: null },
        { seq: 2, event_id: null },
        { seq: 3, event_id: "e3:gleich" },
        { seq: 4, event_id: "e3:k2" },
        { seq: 5, event_id: "e3:k3" },
      ]);
      expect(bericht.ketteIntakt).toBe(true);

      const appA = buildApp(buildPgServices(poolA));
      const appB = buildApp(buildPgServices(poolB));
      try {
        await appA.ready();
        await appB.ready();
        const reg = await appA.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { name: "Admin", email: "e3@x.de", password: "secret123" },
        });
        expect(reg.statusCode).toBe(201);
        const login = await appA.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "e3@x.de", password: "secret123" },
        });
        const headers = { authorization: `Bearer ${login.json().token}` };
        const koAnlage = (i: number) => ({
          confidentiality: "intern",
          title: `Parallel ${i}`,
          statement: `Gleichzeitige Anlage ${i}.`,
          type: "best_practice",
          category: "Anlage 1",
        });
        const koCreatedJe = async (): Promise<Map<string, number>> => {
          const kos = await poolA.query<{ id: string }>("SELECT id FROM kos");
          const belege = await poolA.query<{ target: string; n: number }>(
            "SELECT target, count(*)::int AS n FROM audit WHERE action = 'ko.created' GROUP BY target",
          );
          return new Map(
            kos.rows.map((k) => [k.id, belege.rows.find((b) => b.target === k.id)?.n ?? 0]),
          );
        };

        // (4) DIE ANLAGE ÜBER DIE APP gegen einen offenen Fremdschreiber — deterministisch, was
        //     JOB 4271 nur im freien Lauf sah. A hält einen Protokolleintrag offen, B legt über
        //     `POST /api/kos` an; B wartet an der Kettensperre, A schreibt fest.
        const vorher = await koCreatedJe();
        let anlage: { statusCode: number; body: string } | undefined;
        let anlageWartend = 0;
        await withPgTx(poolA, async (tx) => {
          await auditA.record(eintrag("e3.fremd", "offen"), tx);
          const lauf = appB.inject({
            method: "POST",
            url: "/api/kos",
            headers,
            payload: koAnlage(99),
          });
          anlageWartend = await warteAufWartende(DB_E3, 1);
          // Die Anlage läuft weiter, sobald A festschreibt — sie wird NACH der Klammer abgewartet.
          void lauf.then((r) => {
            anlage = { statusCode: r.statusCode, body: r.body.slice(0, 300) };
          });
        });
        const frist = Date.now() + 20_000;
        while (!anlage && Date.now() < frist) {
          await new Promise((weiter) => setTimeout(weiter, 20));
        }
        const nachher = await koCreatedJe();
        const neu = [...nachher.keys()].filter((id) => !vorher.has(id));
        bericht.anlageGegenFremdschreiber = {
          wartend: anlageWartend,
          antwort: anlage,
          neueKos: neu.length,
          koCreatedDerNeuen: neu.map((id) => nachher.get(id)),
        };
        expect(anlageWartend).toBeGreaterThanOrEqual(1);
        // BEHOBEN (Aufnahme gesamt-auditprotokoll, Lauf 3) — hier stand bis dahin der
        // WIDERSPRÜCHLICHE STAND: 500 für den Nutzer, das Wissensobjekt trotzdem in `kos`, ohne
        // `ko.created`. Jetzt wartet die Anlage an der Kettensperre, und Objekt, Fassung, Projektion
        // und `ko.created` werden in EINER Transaktion festgeschrieben (`KoService.schreibeErstanlage`):
        // „201 und genau ein Beleg", wie dieser Block es für die Behebung angekündigt hatte.
        expect(anlage?.statusCode, JSON.stringify(anlage)).toBe(201);
        expect(neu).toHaveLength(1);
        expect(neu.map((id) => nachher.get(id))).toEqual([1]);
        expect(await auditA.verify()).toBe(true);

        // (5) Frei, ohne Choreografie: sechs Anlagen über zwei App-Instanzen (der Fall aus 4271).
        //     Wie oft es trifft, hängt am Takt und wird nur protokolliert; zugesichert wird, was
        //     IMMER gelten muss: jede mit 201 bestätigte Anlage trägt genau einen Beleg, die Kette
        //     ist intakt.
        const antworten = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            (i % 2 === 0 ? appA : appB).inject({
              method: "POST",
              url: "/api/kos",
              headers,
              payload: koAnlage(i),
            }),
          ),
        );
        const stand = await koCreatedJe();
        const bestaetigt = antworten
          .filter((r) => r.statusCode === 201)
          .map((r) => r.json().id as string);
        bericht.frei = {
          status: antworten.map((r) => r.statusCode),
          koOhneBeleg: [...stand.values()].filter((n) => n === 0).length,
        };
        for (const id of bestaetigt) {
          expect(stand.get(id), `bestätigte Anlage ${id}`).toBe(1);
        }
        // Lauf 3: kein Objekt ohne Beleg, auch nicht aus einer abgewiesenen Anlage — und keine
        // Abweisung mehr am Primärschlüssel.
        expect(bericht.frei).toMatchObject({ koOhneBeleg: 0 });
        expect(antworten.map((r) => r.statusCode)).toEqual(Array(6).fill(201));
        expect(await auditA.verify()).toBe(true);
      } finally {
        await appA.close().catch(() => undefined);
        await appB.close().catch(() => undefined);
        protokolliere("E3", bericht);
      }
    } finally {
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  });
});
