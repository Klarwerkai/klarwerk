import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { AUDIT_EVENT_ID_SCHEMA, AUDIT_SCHEMA, PgAuditRepo } from "./repo-pg";
import { AuditService } from "./service";

// WP-SHIP8-CLOSE-6 (bens ROT-1): echte Postgres-Belege für den exactly-once-Vertrag des
// Audit-Belegs — additive event_id-Migration auf Bestand (idempotenter Re-Run, Altzeilen bleiben
// NULL), partieller Unique-Index, appendOnce/recordOnce sequenziell UND parallel. Muster wie die
// knowledge-object-Suite: Docker (Testcontainers) oder eine lokale, per GELB-Sicherung
// freigegebene Testinstanz (KLARWERK_PG_TEST_URL); läuft NUR unter `test:integration`, ohne
// verfügbare Instanz sauberer Skip statt gefälschtem Grün.

describe("WP-SHIP8-CLOSE-6 (bens ROT-1): audit_event_id_uq gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    // Lokale Instanz hat Vorrang (Docker-lose Evidence-Läufe) — HART abgesichert (bens GELB):
    // nur Testdatenbanken oder ausdrückliches KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1.
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Audit-Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      // URL war gesetzt, die Sicherung hat sie abgelehnt (Grund steht auf stderr) → KEIN
      // Testcontainers-Fallback: der Aufrufer wollte ausdrücklich eine lokale Instanz.
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`,
      });
      available = true;
    } catch {
      available = false; // kein Docker/PG → skip statt Fehlschlag
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  async function reset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS audit CASCADE");
  }

  it("BESTANDS-UPGRADE: event_id-Migration auf Tabelle mit Altzeilen (event_id NULL) + idempotenter Re-Run", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Bestandsinstanz: NUR AUDIT_SCHEMA (vor CLOSE-6), Altzeilen ohne event_id liegen bereits drin.
    await pool.query(AUDIT_SCHEMA);
    const service = new AuditService({ repo: new PgAuditRepo(pool) });
    await service.record({ actor: "a", action: "ko.created", target: "alt-1" });
    await service.record({ actor: "a", action: "ko.updated", target: "alt-1" });
    // Additive Migration läuft auf dem Bestand — und ist im Re-Run idempotent.
    await expect(pool.query(AUDIT_EVENT_ID_SCHEMA)).resolves.toBeDefined();
    await expect(pool.query(AUDIT_EVENT_ID_SCHEMA)).resolves.toBeDefined();
    const alt = await pool.query("SELECT event_id FROM audit ORDER BY seq");
    expect(alt.rows.map((r) => r.event_id)).toEqual([null, null]);
    const idx = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname='audit_event_id_uq'",
    );
    expect(idx.rowCount).toBe(1);
    expect(String(idx.rows[0].indexdef)).toContain("IS NOT NULL");
    // Die Kette überlebt die Migration unverändert.
    expect(await service.verify()).toBe(true);
  });

  it("EXACTLY-ONCE sequenziell: recordOnce mit derselben Event-Id schreibt genau EINE Zeile, der zweite Aufruf meldet false", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(AUDIT_SCHEMA);
    await pool.query(AUDIT_EVENT_ID_SCHEMA);
    const service = new AuditService({ repo: new PgAuditRepo(pool) });
    expect(
      await service.recordOnce("ko.created:ko-1", {
        actor: "a",
        action: "ko.created",
        target: "ko-1",
      }),
    ).toBe(true);
    expect(
      await service.recordOnce("ko.created:ko-1", {
        actor: "b",
        action: "ko.created",
        target: "ko-1",
      }),
    ).toBe(false);
    const rows = await pool.query("SELECT actor, event_id FROM audit");
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]).toEqual({ actor: "a", event_id: "ko.created:ko-1" });
    // record() ohne Event-Id bleibt unbegrenzt (partieller Index) und die Kette intakt.
    await service.record({ actor: "c", action: "ko.updated", target: "ko-1" });
    await service.record({ actor: "c", action: "ko.updated", target: "ko-1" });
    expect(await service.verify()).toBe(true);
  });

  it("bens Pflichttest (Pg): zwei PARALLELE Nachzüge derselben Event-Id → exakt EINE Zeile, Kette intakt", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(AUDIT_SCHEMA);
    await pool.query(AUDIT_EVENT_ID_SCHEMA);
    const service = new AuditService({ repo: new PgAuditRepo(pool) });
    // Beide lesen denselben (leeren) Ketten-Stand — der Unique-Index + ON CONFLICT DO NOTHING
    // entscheidet in der DB, nicht der Read (exakt bens Query-then-Write-Race).
    const results = await Promise.all([
      service.recordOnce("ko.created:ko-p", { actor: "a", action: "ko.created", target: "ko-p" }),
      service.recordOnce("ko.created:ko-p", { actor: "b", action: "ko.created", target: "ko-p" }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const rows = await pool.query("SELECT count(*)::int AS n FROM audit");
    expect(rows.rows[0].n).toBe(1);
    expect(await service.verify()).toBe(true);
  });
});
