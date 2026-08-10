// ================================================================================================
// W3-C / AUFTRAG 134 — ROTFALL 6 GEGEN ECHTES POSTGRESQL
// ================================================================================================
//
// Die hermetische Schwester dieses Falls (`…-traeger-134.test.ts`) stellt den JSONB-Weg über
// `JSON.parse(JSON.stringify(ko))` nach. Das ist eine gute Näherung, aber eben eine Näherung. Hier
// läuft derselbe Vertrag gegen eine echte Instanz: **`KO_SCHEMA` unverändert, keine neue Spalte,
// kein `ALTER`** — und ein Altdatensatz, der vor dem Feld geschrieben wurde, bleibt lesbar.
//
// Muster, Sicherung und Skip-Verhalten sind aus `services/knowledge-object/src/repo-pg.integration
// .test.ts` übernommen: lokale Instanz hat Vorrang (durch die harte Testdatenbank-Sicherung),
// sonst Testcontainers, sonst sauberer Skip — nie ein gefälschtes Grün. Läuft ausschließlich unter
// `npm run test:integration`, nie im schnellen Tor.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { KO_SCHEMA, PgKoRepo } from "../../services/knowledge-object/src/repo-pg";
import { KoService } from "../../services/knowledge-object/src/service";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "../../services/validation/src/repo";
import { ValidationService } from "../../services/validation/src/service";
import { InMemoryValidationSettingsRepo } from "../../services/validation/src/settings";

describe("W3-C/134 · Rotfall 6 gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] 134-Pg-Suite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, keine Verbindung.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
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

  function dienstAuf(koService: KoService) {
    return new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      settings: new InMemoryValidationSettingsRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
  }

  it("die Referenz überlebt den echten JSONB-Rundlauf — mit unverändertem KO_SCHEMA", async (ctx) => {
    const pool = requirePool(ctx);
    await pool.query("DROP TABLE IF EXISTS kos CASCADE");
    await pool.query(KO_SCHEMA);

    const koService = new KoService({ repo: new PgKoRepo(pool) });
    const dienst = dienstAuf(koService);
    const ko = await koService.create({
      title: "Wartung der Spezialpresse",
      statement: "Alle 500 Stunden schmieren.",
      type: "best_practice",
      category: "Technik",
      author: "anna",
      neededValidations: 2,
    });

    const entscheidung = await dienst.adminValidate(ko.id, "admin");
    expect(entscheidung.validationDecisionRef).not.toBeNull();

    // Der Rückweg aus der echten Datenbank — nicht aus einem Prozessspeicher.
    const gelesen = await koService.get(ko.id);
    expect(gelesen?.validationDecisionRef).toEqual(entscheidung.validationDecisionRef);

    // Und im Rohdokument liegt genau das Feld, nichts daneben.
    const roh = await pool.query(
      "SELECT data->'validationDecisionRef' AS ref FROM kos WHERE id=$1",
      [ko.id],
    );
    expect(roh.rows[0].ref).toEqual(entscheidung.validationDecisionRef);

    // KEINE DDL: die Tabelle hat exakt die fünf bekannten Spalten (plus den bestehenden
    // Import-Anker nur dort, wo dessen eigene Migration lief — hier lief sie nicht).
    const spalten = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='kos' ORDER BY column_name",
    );
    expect(spalten.rows.map((r) => String(r.column_name))).toEqual([
      "category",
      "data",
      "id",
      "status",
      "type",
    ]);
  });

  it("ein ALTZEILEN-KO ohne das Feld bleibt lesbar", async (ctx) => {
    const pool = requirePool(ctx);
    await pool.query("DROP TABLE IF EXISTS kos CASCADE");
    await pool.query(KO_SCHEMA);

    const koService = new KoService({ repo: new PgKoRepo(pool) });
    const ko = await koService.create({
      title: "Altbestand",
      statement: "vor dem Feld geschrieben",
      type: "best_practice",
      category: "Technik",
      author: "anna",
    });
    // Der Bestand, wie er vor dieser Runde aussah: der Schlüssel fehlt schlicht.
    await pool.query("UPDATE kos SET data = data - 'validationDecisionRef' WHERE id=$1", [ko.id]);

    const gelesen = await koService.get(ko.id);
    expect(gelesen).toBeDefined();
    expect(gelesen?.validationDecisionRef).toBeUndefined();
    expect(gelesen?.title).toBe("Altbestand");
  });
});
