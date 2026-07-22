import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { KO_IMPORT_ANCHOR_SCHEMA, KO_SCHEMA, PgKoRepo } from "./repo-pg";
import { KoService } from "./service";
import type { KnowledgeObject } from "./types";

// WP-SHIP8-CLOSE-5 (bens GELB): echte Postgres-Belege für den Kandidaten-Anker des Import-Accepts
// (kos_import_candidate_uq) — Bestands-Upgrade, idempotenter Re-Run, harte Unique-Kollision
// (23505) mit Adoption über die echte Anker-Suche, Trash behält den Anker. Muster wie die
// library-analytics-Suite: braucht Docker (Testcontainers), läuft NUR unter `test:integration`,
// nie im schnellen Root-Gate; ohne Container-Runtime wird sauber übersprungen, nie gefälscht.
// ZUSÄTZLICH (bens Evidence-Auflage „gegen lokal aufgesetztes Postgres laufen lassen"): ist
// KLARWERK_PG_TEST_URL gesetzt, läuft DERSELBE Testinhalt gegen diese bestehende Instanz statt
// Testcontainers — so ist die Suite auch ohne Docker real ausführbar.
// WP-SHIP8-CLOSE-6 (bens GELB): diese Suite DROPPT Tabellen — sie darf NIE eine echte DB
// treffen. Die lokale URL läuft deshalb durch die harte Sicherung in pg-test-guard.ts
// (Testdatenbank-Name ODER KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1; sonst Klartext-Skip); die
// Sicherungslogik selbst ist im schnellen Gate getestet (pg-test-guard.test.ts).

function ko(id: string, over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `T-${id}`,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "K",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
}

describe("WP-SHIP8-CLOSE-5 (bens GELB): kos_import_candidate_uq gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    // Lokale Instanz hat Vorrang (Docker-lose Evidence-Läufe); sonst Testcontainers; sonst Skip.
    // Die lokale URL läuft durch die GELB-Sicherung — eine Nicht-Testdatenbank wird NIE berührt.
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
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
    await p.query("DROP TABLE IF EXISTS kos CASCADE");
  }

  it("BESTANDS-UPGRADE: Anker-Migration auf Tabelle mit Altzeilen (import_candidate_id NULL) + idempotenter Re-Run", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Bestandsinstanz: NUR KO_SCHEMA (vor CLOSE-4), Altzeile ohne Anker liegt bereits drin.
    await pool.query(KO_SCHEMA);
    const repo = new PgKoRepo(pool);
    await repo.insert(ko("alt-1"));
    // Additive Anker-Migration läuft auf dem Bestand — und ist im Re-Run idempotent.
    await expect(pool.query(KO_IMPORT_ANCHOR_SCHEMA)).resolves.toBeDefined();
    await expect(pool.query(KO_IMPORT_ANCHOR_SCHEMA)).resolves.toBeDefined();
    const alt = await pool.query("SELECT import_candidate_id FROM kos WHERE id='alt-1'");
    expect(alt.rows[0].import_candidate_id).toBeNull();
    const idx = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname='kos_import_candidate_uq'",
    );
    expect(idx.rowCount).toBe(1);
    expect(String(idx.rows[0].indexdef)).toContain("IS NOT NULL");
  });

  it("UNIQUE: zweiter Insert desselben importCandidateId → 23505; die Anker-Suche adoptiert das bestehende KO", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(KO_SCHEMA);
    await pool.query(KO_IMPORT_ANCHOR_SCHEMA);
    const repo = new PgKoRepo(pool);
    await repo.insert(ko("ko-a", { importCandidateId: "cand-1" }));
    // Der späte Write eines abgelösten Laufs: harte DB-Kollision statt Doppel-KO.
    await expect(repo.insert(ko("ko-b", { importCandidateId: "cand-1" }))).rejects.toMatchObject({
      code: "23505",
    });
    // Adoption über die ECHTE Anker-Suche des Accept-Pfads (KoService, inkl. Papierkorb-Sicht).
    const service = new KoService({ repo });
    const adopted = await service.findByImportCandidateId("cand-1");
    expect(adopted?.id).toBe("ko-a");
    // Ohne Anker bleibt der Index partiell: beliebig viele KOs.
    await repo.insert(ko("frei-1"));
    await repo.insert(ko("frei-2"));
    const count = await pool.query("SELECT count(*)::int AS n FROM kos");
    expect(count.rows[0].n).toBe(3);
  });

  it("TRASH: ein getrashtes KO behält seinen Anker (Index ohne deletedAt-Ausschluss) und bleibt adoptierbar", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(KO_SCHEMA);
    await pool.query(KO_IMPORT_ANCHOR_SCHEMA);
    const repo = new PgKoRepo(pool);
    await repo.insert(ko("ko-t", { importCandidateId: "cand-t" }));
    await pool.query(
      `UPDATE kos SET data = data || '{"deletedAt":"2026-07-22T12:00:00.000Z"}'::jsonb WHERE id='ko-t'`,
    );
    // Der Anker bleibt belegt — ein Retry kann NIE ein zweites KO desselben Kandidaten anlegen.
    await expect(repo.insert(ko("ko-t2", { importCandidateId: "cand-t" }))).rejects.toMatchObject({
      code: "23505",
    });
    // Die Recovery-/Adoptions-Suche sieht das getrashte KO (Trash-Vertrag: vollenden mit Verweis).
    const service = new KoService({ repo });
    const stamped = await service.findByImportCandidateId("cand-t");
    expect(stamped?.id).toBe("ko-t");
    expect(stamped?.deletedAt).toBeTruthy();
    // Lebende Sicht kennt es weiterhin NICHT (Trash-Entscheidung bleibt beim Cleanup/Papierkorb).
    expect(await service.get("ko-t")).toBeUndefined();
  });
});
