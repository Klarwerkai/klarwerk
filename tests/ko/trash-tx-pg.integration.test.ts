import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app";
import { AuditService, PgAuditRepo } from "../../services/audit";
import { withPgTx } from "../../services/db-tx";
import { type KnowledgeObject, KoService, PgKoRepo } from "../../services/knowledge-object";

// SCRUM-523 P.3 (WP-A2): beweist die repo.delete+audit.record-Atomaritäts-Invariante GEGEN ECHTES
// Postgres (Testcontainers). Die Unit-Tests in tests/ko/trash-e2e.test.ts bilden withPgTx nur über eine
// In-Memory-Fake-Transaktion nach (Commit/Rollback per Puffer-Array) — das beweist die INTENTION der
// Verdrahtung, aber nicht, dass eine ECHTE Pg-Transaktionsgrenze (BEGIN…COMMIT/ROLLBACK, Sichtbarkeit für
// andere Verbindungen erst nach COMMIT, echter Constraint-Fehler statt simuliertem throw) tatsächlich
// hält. Dieser Test hier schließt genau diese Lücke. Braucht Docker.
// Lauf: `npm run test:integration`. Aus dem schnellen Gate ausgeschlossen (s. vitest.integration.config.ts,
// Include-Pattern "*.integration.test.ts").
describe("SCRUM-523 P.3 (WP-A2): repo.delete + audit.record — echte Pg-Transaktion", () => {
  let container: StartedTestContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    pool = createPool(url);
    await migrate(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  async function seedKo(koRepo: PgKoRepo, audit: AuditService): Promise<KnowledgeObject> {
    const service = new KoService({ repo: koRepo, audit });
    return service.create({
      title: "Tx-Integrationstest",
      statement: "beweist echte Postgres-Transaktionsgrenzen",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
  }

  it("Erfolgsfall: delete + audit.record committen gemeinsam sichtbar", async () => {
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    await withPgTx(pool, async (tx) => {
      await koRepo.delete(ko.id, tx);
      await audit.record(
        { actor: "admin", action: "ko.purged", target: ko.id, payload: { reason: "hard" } },
        tx,
      );
    });

    expect(await koRepo.findById(ko.id)).toBeUndefined();
    const entries = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(entries).toHaveLength(1);
  });

  it("(a) scheitert die Transaktion NACH repo.delete + audit.record, VOR dem COMMIT: ECHTES ROLLBACK — KO bleibt, kein Audit-Eintrag", async () => {
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    await expect(
      withPgTx(pool, async (tx) => {
        // Beide Schreibungen laufen INNERHALB der noch offenen Transaktion (derselbe Pg-Client) —
        // der anschließende throw verhindert den COMMIT. Beweist: ein bereits AUSGEFÜHRTES Delete UND
        // ein bereits ausgeführter Audit-Insert werden gemeinsam zurückgerollt, sobald IRGENDETWAS in
        // derselben Transaktion danach scheitert (unabhängig vom Auslöser).
        await koRepo.delete(ko.id, tx);
        await audit.record({ actor: "admin", action: "ko.purged", target: ko.id, payload: {} }, tx);
        throw new Error("simulierter Absturz vor COMMIT");
      }),
    ).rejects.toThrow("simulierter Absturz vor COMMIT");

    expect(await koRepo.findById(ko.id)).toBeDefined();
    const entries = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(entries).toHaveLength(0);
  });

  it("(b) scheitert audit.append INNERHALB der Transaktion an einem ECHTEN Pg-Constraint-Fehler: repo.delete bleibt unsichtbar (ROLLBACK) — genau die Richtung, die WP-A nicht bewies", async () => {
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    // seedKo hat bereits einen ko.created-Eintrag (seq=1) committet. Ein manueller INSERT mit
    // DEMSELBEN seq verletzt den Primärschlüssel — ein echter Datenbankfehler, kein simuliertes throw.
    const last = await auditRepo.last();
    const duplicateSeq = last?.seq ?? 1;

    await expect(
      withPgTx(pool, async (tx) => {
        await koRepo.delete(ko.id, tx);
        await auditRepo.append(
          {
            seq: duplicateSeq,
            at: new Date(0).toISOString(),
            actor: "admin",
            action: "ko.purged",
            target: ko.id,
            payload: {},
            prevHash: "x",
            hash: "y",
          },
          tx,
        );
      }),
    ).rejects.toThrow();

    // repo.delete lief im Code VOR dem gescheiterten audit.append, in DERSELBEN, noch offenen
    // Transaktion — Postgres rollt trotzdem BEIDE Schreibungen zurück. Das KO ist unverändert da.
    expect(await koRepo.findById(ko.id)).toBeDefined();
    const purged = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(purged).toHaveLength(0);
  });
});
