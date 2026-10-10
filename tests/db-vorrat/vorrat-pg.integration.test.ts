// ================================================================================================
// R-0776 / R-0798 — ABBRUCH MITTEN IN DER KLAMMER, GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// `services/db-tx/src/vorrat.test.ts` prüft die Rückgaberegel gegen ein Doppel. Was nur echtes
// Postgres zeigen kann, steht hier:
//
//   P1 — Die Sitzung einer laufenden `withPgTx`-Klammer wird serverseitig beendet
//        (`pg_terminate_backend`). Der Prozess überlebt das `error`-Ereignis, die Klammer scheitert
//        laut, es bleibt kein halber Zustand, und der Vorrat (Größe 1) bedient danach sofort wieder.
//   P2 — Über die Hülle `gatedPool` gibt ein Aufrufer seine Verbindung mit offener Transaktion
//        zurück. Die Verbindung wird verworfen: keine Sitzung bleibt `idle in transaction`, die
//        Änderung ist nicht sichtbar, und der nächste Ausleiher arbeitet ohne fremde Klammer.
//   P3 — Notbremse: Eine Klammer hält die einzige Verbindung und wartet selbst auf eine zweite.
//        Statt den Betrieb anzuhalten, scheitert das Warten nach der Wartezeit, die Klammer rollt
//        zurück, und der Vorrat bedient wieder.
//   P4 — Der Vorrat aus `createPool` setzt die Leerlauffrist tatsächlich in der Sitzung.
//
// Läuft NUR unter `test:integration` (Docker/Testcontainers oder eine per KLARWERK_PG_TEST_URL
// angebotene lokale Testinstanz) — dieselbe Bauform wie
// `tests/import-genau-einmal/annahme-sperre-pg.integration.test.ts`. Ohne beides wird EHRLICH
// übersprungen; ein Überspringen ist kein Prüfbeleg.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool } from "../../services/app/src/db";
import {
  LEERLAUF_IN_TRANSAKTION_MS,
  gatedPool,
  guardedLocalPgTestUrl,
  pgQueryable,
  vorratsKonfiguration,
  withPgTx,
} from "../../services/db-tx";

const TABELLE = "vorrat_probe";

describe("R-0776 / R-0798 · Abbruch und Vorrat gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let url: string | undefined;
  let available = false;
  const pools: Pool[] = [];

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      url = localUrl;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      return;
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          // Name nicht frei gewählt: s. `tests/app/job2354-drei-datenbanknamen.test.ts` (E7).
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        return;
      }
    }
    try {
      const probe = new Pool({ connectionString: url });
      await probe.query(`DROP TABLE IF EXISTS ${TABELLE}`);
      await probe.query(`CREATE TABLE ${TABELLE} (wert text NOT NULL)`);
      await probe.end();
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] Vorrat-Pg-Suite UEBERSPRUNGEN: keine Verbindung zur Testinstanz.\n",
      );
    }
  });

  afterAll(async () => {
    for (const p of pools) {
      await p.end().catch(() => undefined);
    }
    await container?.stop();
  });

  function vorrat(ctx: { skip: () => void }, zusatz: { connectionTimeoutMillis?: number } = {}) {
    if (!available || !url) {
      ctx.skip();
      throw new Error("unreachable");
    }
    const p = new Pool({ ...vorratsKonfiguration(url), max: 1, ...zusatz });
    pools.push(p);
    return p;
  }

  function verwaltung(ctx: { skip: () => void }): Pool {
    if (!available || !url) {
      ctx.skip();
      throw new Error("unreachable");
    }
    const p = new Pool({ connectionString: url });
    pools.push(p);
    return p;
  }

  async function anzahl(p: Pool, wert: string): Promise<number> {
    const r = await p.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${TABELLE} WHERE wert = $1`,
      [wert],
    );
    return Number(r.rows[0]?.n ?? "0");
  }

  // Zustand GENAU der einen Sitzung — nicht eine Zählung über die Datenbank, die eine parallel
  // laufende Suite auf derselben lokalen Testinstanz verfälschen könnte.
  async function sitzungsZustand(p: Pool, pid: number | undefined): Promise<string | undefined> {
    const r = await p.query<{ state: string | null }>(
      "SELECT state FROM pg_stat_activity WHERE pid = $1",
      [pid],
    );
    return r.rows[0]?.state ?? undefined;
  }

  it("P1 · Sitzung stirbt mitten in withPgTx: kein Absturz, kein halber Zustand, Vorrat bedient weiter", async (ctx) => {
    const p = vorrat(ctx);
    const admin = verwaltung(ctx);

    await expect(
      withPgTx(p, async (tx) => {
        const q = pgQueryable(tx);
        await q.query(`INSERT INTO ${TABELLE} (wert) VALUES ('p1')`);
        const pid = await q.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        await admin.query("SELECT pg_terminate_backend($1)", [pid.rows[0]?.pid]);
        // Dem Client Zeit geben, das Sitzungsende als Ereignis zu empfangen.
        await new Promise((r) => setTimeout(r, 200));
        await q.query(`INSERT INTO ${TABELLE} (wert) VALUES ('p1-zwei')`);
      }),
    ).rejects.toBeInstanceOf(Error);

    expect(await anzahl(admin, "p1")).toBe(0);
    expect(await anzahl(admin, "p1-zwei")).toBe(0);
    // Vorratsgröße 1: bekäme der nächste Ausleiher die tote Verbindung, scheiterte er hier.
    const danach = await p.query<{ eins: number }>("SELECT 1 AS eins");
    expect(danach.rows[0]?.eins).toBe(1);
  });

  it("P2 · Rückgabe mit offener Transaktion über gatedPool: verworfen, nichts bleibt hängen", async (ctx) => {
    const roh = vorrat(ctx);
    const admin = verwaltung(ctx);
    const gated = gatedPool(roh);

    const client = await gated.connect();
    await client.query("BEGIN");
    const sitzung = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    const pid = sitzung.rows[0]?.pid;
    await client.query(`INSERT INTO ${TABELLE} (wert) VALUES ('p2')`);
    expect(await sitzungsZustand(admin, pid)).toBe("idle in transaction");
    client.release();

    // Das Verwerfen schließt die Sitzung asynchron; kurz warten, bis der Server sie abgeräumt hat.
    for (let i = 0; i < 50 && (await sitzungsZustand(admin, pid)) !== undefined; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(await sitzungsZustand(admin, pid)).toBeUndefined();
    expect(await anzahl(admin, "p2")).toBe(0);

    // Der nächste Ausleiher (Vorratsgröße 1) arbeitet in keiner fremden Klammer.
    await gated.query(`INSERT INTO ${TABELLE} (wert) VALUES ('p2-danach')`);
    expect(await anzahl(admin, "p2-danach")).toBe(1);
  });

  it("P3 · Notbremse: wer in der Klammer auf eine zweite Verbindung wartet, scheitert begrenzt statt den Vorrat zu blockieren", async (ctx) => {
    const p = vorrat(ctx, { connectionTimeoutMillis: 300 });
    const admin = verwaltung(ctx);

    const beginn = Date.now();
    await expect(
      withPgTx(p, async (tx) => {
        await pgQueryable(tx).query(`INSERT INTO ${TABELLE} (wert) VALUES ('p3')`);
        // Der Fehler aus overlap-service.ts: ein Lesegang am Pool INNERHALB der Klammer.
        await p.query("SELECT 1");
      }),
    ).rejects.toThrow(/timeout/i);
    expect(Date.now() - beginn).toBeLessThan(10_000);

    expect(await anzahl(admin, "p3")).toBe(0);
    const danach = await p.query<{ eins: number }>("SELECT 1 AS eins");
    expect(danach.rows[0]?.eins).toBe(1);
  });

  it("P4 · der Vorrat aus createPool setzt die Leerlauffrist in jeder Sitzung", async (ctx) => {
    if (!available || !url) {
      ctx.skip();
      return;
    }
    const p = createPool(url);
    pools.push(p);
    const r = await p.query<{ wert: string }>(
      "SELECT setting AS wert FROM pg_settings WHERE name = 'idle_in_transaction_session_timeout'",
    );
    expect(Number(r.rows[0]?.wert)).toBe(LEERLAUF_IN_TRANSAKTION_MS);
  });
});
