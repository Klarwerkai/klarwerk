// ================================================================================================
// JOB 2698 · D1 — findBy/existsBy und der Index (action, target) gegen ECHTES PostgreSQL
// ================================================================================================
//
// Läuft nur mit erreichbarer Instanz (KLARWERK_PG_TEST_URL, GELB-gesichert) oder Testcontainer;
// sonst sauberer Skip mit sichtbarem Grund (Muster A-1303 aus services/audit/src/repo-pg.integration).
// In der Bahn-Sandbox (29.08.) ist beides nicht erreichbar (`connect EPERM 127.0.0.1:5432`, kein
// Docker) — dieser Test ist der Beleg, der dort NICHT gelaufen ist und in der Rückgabe als Rest steht.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
  AUDIT_SCHEMA,
  PgAuditRepo,
} from "../../services/audit/src/repo-pg";
import { AuditService } from "../../services/audit/src/service";
import type { AuditFilter } from "../../services/audit/src/types";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

describe("JOB 2698 · findBy gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;
  let grund = "beforeAll lief nicht";

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        grund = "";
        return;
      } catch {
        grund = "KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich";
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL von der GELB-Sicherung abgelehnt";
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
      grund = "";
    } catch (fehler) {
      grund = `kein Container-Runtime erreichbar (${fehler instanceof Error ? fehler.name : "unbekannt"})`;
    }
    if (!available) {
      process.stderr.write(
        `[KLARWERK][JOB 2698] Pg-Integrationstest ÜBERSPRUNGEN — Grund: ${grund}\n`,
      );
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable");
    }
    return pool;
  }

  async function frisch(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS audit");
    await p.query(AUDIT_SCHEMA);
    await p.query(AUDIT_EVENT_ID_SCHEMA);
    await p.query(AUDIT_HASH_VERSION_SCHEMA);
  }

  it("Schema: der Index (action, target) entsteht und ist wiederholbar", async (ctx) => {
    const p = requirePool(ctx);
    await frisch(p);
    await p.query(AUDIT_SCHEMA); // zweiter Lauf — IF NOT EXISTS
    const idx = await p.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'audit' AND indexname = 'audit_action_target_idx'",
    );
    expect(idx.rows).toHaveLength(1);
  });

  it("Gleichheit: findBy liefert für jeden Filter dieselbe Menge wie all() plus Node-Filter", async (ctx) => {
    const p = requirePool(ctx);
    await frisch(p);
    const repo = new PgAuditRepo(p);
    const dienst = new AuditService({ repo });
    const aktionen = ["answer.helpful", "ask.query", "ko.created", "Answer.Helpful"];
    const ziele = ["ko-1", "ko-2", "KO-1", ""];
    for (let i = 0; i < 3000; i++) {
      await dienst.record({
        actor: `u${i % 5}`,
        action: aktionen[(i * 7) % aktionen.length] as string,
        target: ziele[(i * 3) % ziele.length] as string,
        payload: { i },
      });
    }
    const alle = await repo.all();
    const alt = (f: AuditFilter) =>
      alle.filter(
        (e) =>
          (!f.actor || e.actor === f.actor) &&
          (!f.action || e.action === f.action) &&
          (!f.target || e.target === f.target),
      );
    const filter: AuditFilter[] = [
      {},
      { action: "answer.helpful" },
      { action: "Answer.Helpful" },
      { action: "ko.created", target: "ko-1" },
      { action: "ko.created", target: "KO-1" },
      { actor: "u2", target: "" },
      { actor: "", action: "", target: "" },
    ];
    for (const f of filter) {
      expect(await repo.findBy(f), JSON.stringify(f)).toEqual(alt(f));
      expect(await repo.existsBy(f)).toBe(alt(f).length > 0);
    }
  });

  it("Plan: die KO-Frage (action + target) läuft über audit_action_target_idx", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("ANALYZE audit");
    // Auf einer kleinen Tabelle darf der Planer den Vollscan vorziehen — die Frage hier ist nicht,
    // ob er es tut, sondern ob der Index die Abfrage TRAGEN KANN. Deshalb Sequenzscan in dieser
    // Sitzung abschalten und den Plan mit echten Parametern lesen (Client, nicht Pool: SET ist
    // sitzungsgebunden).
    const client = await p.connect();
    try {
      await client.query("SET enable_seqscan = off");
      const plan = await client.query<{ "QUERY PLAN": unknown }>(
        "EXPLAIN (FORMAT JSON) SELECT * FROM audit WHERE ($1::text IS NULL OR actor = $1) AND ($2::text IS NULL OR action = $2) AND ($3::text IS NULL OR target = $3) ORDER BY seq",
        [null, "ko.created", "ko-1"],
      );
      expect(JSON.stringify(plan.rows[0]?.["QUERY PLAN"])).toContain("audit_action_target_idx");
    } finally {
      client.release();
    }
  });
});
