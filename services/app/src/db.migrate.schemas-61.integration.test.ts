import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { migrate } from "./db";

// ================================================================================================
// AUFTRAG 61 — DIE APP-MIGRATIONSNAHT, GEGEN EINEN ECHTEN SERVER
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT UND WAS SIE VON DEN VORHANDENEN PROBEN UNTERSCHEIDET.
//
// Die Modultests von W2-A und W3-A fuehren ihre DDL SELBST aus. Sie beweisen damit, dass die DDL
// GUELTIG ist — nicht, dass die Anwendung sie beim Start ausfuehrt. Genau diese Luecke ist der
// Grund, warum es den statischen Migrationswaechter ueberhaupt gibt, und sie schliesst sich nicht
// dadurch, dass der Waechter gruen wird: er liest Quelltext, er startet keine Datenbank.
//
// DIESE PROBE FUEHRT DESHALB KEINE EINZIGE DDL SELBST AUS. Sie ruft `migrate(pool)` und sieht
// danach im Katalog nach. Was hier gruen ist, ist ueber den REALEN Weg entstanden.
//
// SIE LIEGT BEWUSST IN EINER EIGENEN DATEI: `db.migrate.integration.test.ts` steht unter Freeze 47
// und wird gerade unabhaengig geprueft (BEN 53). Auftrag 61 Zeile 28-29 verlangt genau diese
// Trennung.

describe("Auftrag 61: migrate() legt External-Source- und Answer-Snapshot-Schema wirklich an", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  // Ohne Container-Runtime wird NICHT gefaelscht, sondern sauber uebersprungen — dasselbe Muster
  // wie in den vorhandenen Integrationssuiten.
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
      available = false;
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

  it("beide Tabellen entstehen AUSSCHLIESSLICH durch migrate() — vorher gibt es sie nicht", async (ctx) => {
    const p = requirePool(ctx);

    // Ausgangslage: die Tabellen existieren nicht. Ohne diese Zeile koennte der Fall auch auf einer
    // Datenbank gruen sein, in der sie jemand anders angelegt hat.
    const vorher = await p.query<{ external: string | null; answers: string | null }>(
      "SELECT to_regclass('external_source_records')::text AS external, to_regclass('answer_snapshots')::text AS answers",
    );
    expect(
      vorher.rows[0]?.external,
      "external_source_records darf VOR migrate() nicht da sein",
    ).toBeNull();
    expect(vorher.rows[0]?.answers, "answer_snapshots darf VOR migrate() nicht da sein").toBeNull();

    // DER EINZIGE SCHREIBVORGANG DIESER PROBE. Keine kopierte DDL, kein Schema-String.
    await migrate(p);

    const nachher = await p.query<{ t: string }>(
      `SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relname IN ('external_source_records','answer_records','answer_snapshots')
        ORDER BY c.relname`,
    );
    expect(nachher.rows.map((r) => r.t)).toEqual([
      "answer_records",
      "answer_snapshots",
      "external_source_records",
    ]);
  });

  it("migrate() ist wiederholbar — ein zweiter Lauf ist ein No-op, kein Fehler", async (ctx) => {
    const p = requirePool(ctx);
    await expect(migrate(p)).resolves.toBeUndefined();
    await expect(migrate(p)).resolves.toBeUndefined();
  });

  it("die W2-A-Grenzen stehen nach migrate(): Unique, CHECK und drei NOT-NULL-Spalten", async (ctx) => {
    const p = requirePool(ctx);
    await migrate(p);

    const idx = await p.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'external_source_records'",
    );
    expect(idx.rows.map((r) => r.indexname)).toContain("external_source_records_revision_uq");

    const ck = await p.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'external_source_records'::regclass AND contype = 'c'",
    );
    expect(ck.rows.map((r) => r.conname)).toContain("external_source_records_identitaet_ck");

    const spalten = await p.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_name = 'external_source_records'
          AND column_name IN ('source_system','external_id','source_version_key')
        ORDER BY column_name`,
    );
    expect(spalten.rows.map((r) => r.column_name)).toEqual([
      "external_id",
      "source_system",
      "source_version_key",
    ]);
    expect(spalten.rows.every((r) => r.is_nullable === "NO")).toBe(true);
  });

  it("die W3-A-Grenzen stehen nach migrate(): Unique, CHECK und zwei NOT-NULL-Spalten", async (ctx) => {
    const p = requirePool(ctx);
    await migrate(p);

    const idx = await p.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'answer_snapshots'",
    );
    expect(idx.rows.map((r) => r.indexname)).toContain("answer_snapshots_revision_uq");

    const ck = await p.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'answer_snapshots'::regclass AND contype = 'c'",
    );
    expect(ck.rows.map((r) => r.conname)).toContain("answer_snapshots_identitaet_ck");

    const spalten = await p.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_name = 'answer_snapshots'
          AND column_name IN ('answer_id','snapshot_revision_key')
        ORDER BY column_name`,
    );
    expect(spalten.rows.map((r) => r.column_name)).toEqual(["answer_id", "snapshot_revision_key"]);
    expect(spalten.rows.every((r) => r.is_nullable === "NO")).toBe(true);
  });

  it("die Grenzen WIRKEN — rohe Inserts ohne vollstaendige Identitaet scheitern, vollstaendige nicht", async (ctx) => {
    const p = requirePool(ctx);
    await migrate(p);

    // GEGENPROBE ZUERST: eine Struktur, die nur DA ist, sagt nichts darueber, ob sie greift.
    await expect(
      p.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2::jsonb)", [
        "sr-61-unvollstaendig",
        JSON.stringify({ sourceSystem: "Confluence" }),
      ]),
    ).rejects.toThrow();
    await expect(
      p.query("INSERT INTO answer_snapshots(snapshot_key,data) VALUES($1,$2::jsonb)", [
        "ans-61@x",
        JSON.stringify({ answerId: "", snapshotRevision: "nicht-numerisch" }),
      ]),
    ).rejects.toThrow();

    // POSITIVKONTROLLE: die vollstaendige Identitaet passiert denselben rohen Weg anstandslos.
    await expect(
      p.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2::jsonb)", [
        "sr-61-gut",
        JSON.stringify({
          sourceRecordId: "sr-61-gut",
          sourceSystem: "Confluence",
          externalId: "61",
          sourceVersion: 1,
        }),
      ]),
    ).resolves.toBeDefined();
    await expect(
      p.query("INSERT INTO answer_snapshots(snapshot_key,data) VALUES($1,$2::jsonb)", [
        "ans-61@1",
        JSON.stringify({ answerId: "ans-61", snapshotRevision: 1 }),
      ]),
    ).resolves.toBeDefined();

    // Und die Revisionsidentitaet ist wirklich eindeutig.
    await expect(
      p.query("INSERT INTO answer_snapshots(snapshot_key,data) VALUES($1,$2::jsonb)", [
        "ans-61@1-zweit",
        JSON.stringify({ answerId: "ans-61", snapshotRevision: 1 }),
      ]),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
