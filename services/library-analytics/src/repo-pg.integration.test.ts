import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IMPORT_CANDIDATES_SCHEMA, PgCandidateRepo } from "./repo-pg";
import type { ImportCandidate, ImportItem } from "./types";

// SCRUM-510 (WP2-Batch3): echte Postgres-Belege für die gehärtete Import-Migration + den atomaren
// ON-CONFLICT-Insert. Braucht Docker (Testcontainers); läuft NUR unter `test:integration`, nie im
// schnellen Root-Gate (das excludet *.integration.test.ts) → ohne PG wird sauber NICHT gefälscht,
// sondern gar nicht ausgeführt.

// Die Spalten-DDL OHNE den Unique-Index — Setup, um VOR dem Index Alt-Dubletten einzuschleusen (die im
// Betrieb aus der Zeit vor dem Index stammen). Muss zu den GENERATED-Definitionen in der echten Migration
// passen (cast-sicher).
//
// SCRUM-510 (WP-B2, Reviewer-Befund GELB): DIES ist zugleich die Expression, mit der die Live-Instanz
// aktuell tatsächlich läuft — cast-sicher (b), aber OHNE Längenbegrenzung. Eine sehr lange Ziffernfolge
// passiert den Regex-Guard trotzdem und crasht danach am `::int`-Cast (Integer-Overflow). Dient unten als
// Ausgangspunkt sowohl für den Overflow-Nachweis als auch für den Heilungs-Upgrade-Pfad.
const COLUMNS_ONLY_DDL = `
CREATE TABLE IF NOT EXISTS import_candidates (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (data->'item'->>'externalId') STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS source_version integer
  GENERATED ALWAYS AS (
    CASE WHEN (data->'item'->>'sourceVersion') ~ '^[0-9]+$'
         THEN (data->'item'->>'sourceVersion')::int
         ELSE 1 END
  ) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS review_status text
  GENERATED ALWAYS AS (data->>'status') STORED;
`;

// SCRUM-510 (WP-B): Die DDL, wie sie in Commit 0901549 ausgeliefert wurde — VOR der cast-sicheren
// Expression aus (b). source_version castet dort bedingungslos (nur COALESCE gegen NULL, nicht gegen
// nicht-numerische Strings). Simuliert eine Bestandsinstanz, die noch nie über WP-B migriert wurde.
const LEGACY_COLUMNS_ONLY_DDL = `
CREATE TABLE IF NOT EXISTS import_candidates (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (data->'item'->>'externalId') STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS source_version integer
  GENERATED ALWAYS AS (COALESCE((data->'item'->>'sourceVersion')::int, 1)) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS review_status text
  GENERATED ALWAYS AS (data->>'status') STORED;
`;

function candidate(id: string, over: Partial<ImportItem>, createdAt: string): ImportCandidate {
  const item: ImportItem = {
    title: `T-${id}`,
    statement: "s",
    type: "best_practice",
    category: "K",
    externalId: "P1",
    sourceScope: "K",
    sourceVersion: 1,
    provider: "Confluence",
    ...over,
  };
  return { id, item, status: "neu", duplicate: false, note: null, koId: null, createdAt };
}

async function rawInsert(pool: Pool, cand: ImportCandidate): Promise<void> {
  await pool.query("INSERT INTO import_candidates(id,data) VALUES($1,$2)", [
    cand.id,
    JSON.stringify(cand),
  ]);
}

describe("SCRUM-510 (WP2): Import-Migration + ON CONFLICT gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  // Ohne Container-Runtime (kein Docker/PG) wird NICHT gefälscht, sondern jeder Test sauber übersprungen.
  let available = false;

  beforeAll(async () => {
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

  // Kleiner Helfer: ohne PG den Test überspringen (ehrlich), sonst gegen den echten Pool laufen.
  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  async function reset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS import_candidates");
  }

  it("SELBSTHEILEND: vorhandene Alt-Dubletten werden bereinigt, dann entsteht der Index (idempotent)", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Spalten OHNE Index anlegen und ZWEI offene Dubletten (P1@1) einschleusen — das würde die
    // Index-Erstellung ohne Selbstheilung zum Scheitern bringen.
    await pool.query(COLUMNS_ONLY_DDL);
    await rawInsert(pool, candidate("old", {}, "2026-01-01T00:00:00.000Z"));
    await rawInsert(pool, candidate("new", {}, "2026-02-01T00:00:00.000Z")); // jünger → bleibt

    // Die echte Migration heilt (löscht die ältere) und legt den Index an — OHNE Start-Crash.
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();

    const rows = await pool.query("SELECT id FROM import_candidates ORDER BY id");
    expect(rows.rows.map((r) => r.id)).toEqual(["new"]); // nur der jüngste offene Kandidat bleibt

    // Der partielle Unique-Index existiert jetzt (WP-SHIP8-FIX F3: provider-bewusst; der alte,
    // provider-blinde Index wurde ersetzt).
    const idx = await pool.query(
      "SELECT 1 FROM pg_indexes WHERE indexname='import_candidates_open_provider_external_uq'",
    );
    expect(idx.rowCount).toBe(1);
    const oldIdx = await pool.query(
      "SELECT 1 FROM pg_indexes WHERE indexname='import_candidates_open_external_uq'",
    );
    expect(oldIdx.rowCount).toBe(0);

    // Re-Run ist idempotent (keine Dubletten mehr → 0 Löschungen, Index existiert bereits).
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    const after = await pool.query("SELECT count(*)::int AS n FROM import_candidates");
    expect(after.rows[0].n).toBe(1);
  });

  it("CAST-SICHER: ungültige historische sourceVersion bricht die Migration NICHT (Fallback 1)", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(COLUMNS_ONLY_DDL);
    // Nicht-integer sourceVersion (v3) darf die Migration nicht kippen.
    await rawInsert(
      pool,
      candidate(
        "bad",
        { externalId: "PX", sourceVersion: "v3" as unknown as number },
        "2026-01-01",
      ),
    );
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    const row = await pool.query("SELECT source_version FROM import_candidates WHERE id='bad'");
    expect(row.rows[0].source_version).toBe(1); // Fallback, kein Crash
  });

  it("ATOMAR: zwei nebenläufige insertIfAbsent auf denselben Schlüssel → genau EIN Insert", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(IMPORT_CANDIDATES_SCHEMA);
    const repo = new PgCandidateRepo(pool);
    const a = candidate("k-a", { externalId: "PC", sourceVersion: 7 }, "2026-01-01");
    const b = candidate("k-b", { externalId: "PC", sourceVersion: 7 }, "2026-01-02");

    const [ra, rb] = await Promise.all([repo.insertIfAbsent(a), repo.insertIfAbsent(b)]);
    // Genau einer gewinnt (true), der andere kollidiert (false) — kein Fehler, keine Dublette.
    expect([ra, rb].filter(Boolean)).toHaveLength(1);
    const rows = await pool.query(
      "SELECT count(*)::int AS n FROM import_candidates WHERE external_id='PC' AND source_version=7",
    );
    expect(rows.rows[0].n).toBe(1);

    // WP-SHIP8-FIX (bens F3): dieselbe externalId+Version eines ANDEREN Providers ist KEINE
    // Kollision — der Unique-Index ist provider-scoped (Backfill: fehlender Provider = confluence).
    const jira = candidate(
      "k-j",
      { externalId: "PC", sourceVersion: 7, provider: "Jira" },
      "2026-01-03",
    );
    expect(await repo.insertIfAbsent(jira)).toBe(true);
    const both = await pool.query(
      "SELECT provider, count(*)::int AS n FROM import_candidates WHERE external_id='PC' GROUP BY provider ORDER BY provider",
    );
    expect(both.rows).toEqual([
      { provider: "confluence", n: 1 },
      { provider: "jira", n: 1 },
    ]);
  });

  it("nach Review (status ≠ neu) ist dieselbe Version wieder einreihbar (partieller Index)", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(IMPORT_CANDIDATES_SCHEMA);
    const repo = new PgCandidateRepo(pool);
    const first = candidate("r-1", { externalId: "PR", sourceVersion: 2 }, "2026-01-01");
    expect(await repo.insertIfAbsent(first)).toBe(true);
    // Angenommen → verlässt den partiellen Index.
    await repo.update({ ...first, status: "angenommen" });
    const second = candidate("r-2", { externalId: "PR", sourceVersion: 2 }, "2026-01-02");
    expect(await repo.insertIfAbsent(second)).toBe(true);
  });

  it("SCRUM-510 (WP-B): Bestandsinstanz mit alter cast-unsicherer source_version-Expression wird beim Migrationslauf geheilt", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Alte DDL (Commit 0901549, vor WP-B) anlegen — simuliert eine Bestandsinstanz, die die Migration
    // noch nie mit der sicheren CASE-Regex-Expression durchlaufen hat.
    await pool.query(LEGACY_COLUMNS_ONLY_DDL);

    // Die aktuelle Migration erkennt die alte COALESCE-Expression, baut die Spalte + den davon
    // abhängigen Unique-Index neu auf — der Lauf selbst darf nicht scheitern.
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();

    // Ein Insert mit nicht-numerischer sourceVersion darf jetzt nicht mehr am Postgres-Cast scheitern.
    const repo = new PgCandidateRepo(pool);
    const bad = candidate(
      "v3-cand",
      { externalId: "PV3", sourceVersion: "v3" as unknown as number },
      "2026-01-01",
    );
    await expect(repo.insert(bad)).resolves.toBeUndefined();
    const row = await pool.query("SELECT source_version FROM import_candidates WHERE id='v3-cand'");
    expect(row.rows[0].source_version).toBe(1); // Fallback statt Cast-Fehler

    // Der wiederaufgebaute Unique-Index wirkt weiterhin: derselbe externalId+source_version(=1
    // per Fallback) kollidiert über insertIfAbsent statt eine Dublette zu erzeugen.
    const dup = candidate(
      "v3-cand-2",
      { externalId: "PV3", sourceVersion: "v3" as unknown as number },
      "2026-01-02",
    );
    expect(await repo.insertIfAbsent(dup)).toBe(false);

    // Idempotenz: ein zweiter Migrationslauf gegen die bereits geheilte Spalte ist ein No-op, kein Fehler.
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    const count = await pool.query("SELECT count(*)::int AS n FROM import_candidates");
    expect(count.rows[0].n).toBe(1); // "dup" wurde nicht eingefügt (kollidiert), Heilung fügte nichts hinzu
  });

  // SCRUM-510 (WP-B2, Reviewer-Befund GELB): eine 20-stellige sourceVersion passiert `^[0-9]+$` (reine
  // Ziffernfolge), scheitert dann aber am `::int`-Cast (int4-Overflow) — genau die vom Reviewer gemeldete
  // Lücke der (b)-Expression. Die gehärtete `^[0-9]{1,9}$` lässt so lange Ziffernfolgen den Regex-Guard
  // NICHT mehr passieren → Fallback 1 statt Crash (deckungsgleich mit dem Cast-sicheren Grundgedanken).
  it("(a) SCRUM-510 (WP-B2): 20-stellige sourceVersion crasht nicht mehr (Overflow-Guard) — source_version=1", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Aktuelle (gehärtete) Migration direkt auf einer Neuinstallation.
    await pool.query(IMPORT_CANDIDATES_SCHEMA);
    const repo = new PgCandidateRepo(pool);
    const overflow = candidate(
      "overflow",
      { externalId: "POF", sourceVersion: "99999999999999999999" as unknown as number },
      "2026-01-01",
    );
    await expect(repo.insert(overflow)).resolves.toBeUndefined();
    const row = await pool.query(
      "SELECT source_version FROM import_candidates WHERE id='overflow'",
    );
    expect(row.rows[0].source_version).toBe(1); // zu lang → Regex-Guard greift NICHT → Fallback, kein Crash
  });

  // SCRUM-510 (WP-B2): die Live-Instanz läuft HEUTE mit genau der (b)-Expression aus COLUMNS_ONLY_DDL —
  // cast-sicher, aber ohne Längenbegrenzung. Beweist: die erweiterte Heilungserkennung greift auch OHNE
  // COALESCE im Expression-Text (reine Regex-Text-Erkennung, s. Kommentar an der Migration), baut die
  // Spalte + den Index neu mit der gehärteten Expression auf — DANACH crasht ein Overflow-Insert nicht mehr.
  it("(b) SCRUM-510 (WP-B2): Upgrade-Pfad von der ungeschützten Live-Regex (^[0-9]+$, ohne COALESCE) wird geheilt", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Heutige Live-DDL (b, unbegrenzte Regex, KEIN COALESCE im Text) — muss von der reinen COALESCE-
    // Erkennung aus WP-B UNENTDECKT bleiben, aber von der WP-B2-Erweiterung erkannt werden.
    await pool.query(COLUMNS_ONLY_DDL);
    const before = await pool.query<{ legacy_expr: string }>(`
      SELECT pg_get_expr(d.adbin, d.adrelid) AS legacy_expr
      FROM pg_attribute a
      JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'import_candidates'::regclass AND a.attname = 'source_version'
    `);
    expect(before.rows[0]?.legacy_expr).not.toContain("COALESCE"); // genau der Fall, den WP-B NICHT erkannte

    // Migrationslauf: die Heilung erkennt die unbegrenzte Regex am Expression-TEXT (nicht an COALESCE)
    // und baut Spalte + Index neu auf — der Lauf selbst darf nicht scheitern.
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();

    const after = await pool.query<{ legacy_expr: string }>(`
      SELECT pg_get_expr(d.adbin, d.adrelid) AS legacy_expr
      FROM pg_attribute a
      JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'import_candidates'::regclass AND a.attname = 'source_version'
    `);
    expect(after.rows[0]?.legacy_expr).toContain("1,9"); // gehärtete Expression jetzt aktiv

    // Ein 20-stelliger Overflow-Insert crasht jetzt nicht mehr am ::int-Cast.
    const repo = new PgCandidateRepo(pool);
    const overflow = candidate(
      "overflow-upgraded",
      { externalId: "POU", sourceVersion: "99999999999999999999" as unknown as number },
      "2026-01-01",
    );
    await expect(repo.insert(overflow)).resolves.toBeUndefined();
    const row = await pool.query(
      "SELECT source_version FROM import_candidates WHERE id='overflow-upgraded'",
    );
    expect(row.rows[0].source_version).toBe(1);

    // (c) Idempotenz: ein zweiter Lauf gegen die bereits gehärtete Spalte erkennt weder COALESCE noch die
    // unbegrenzte Regex mehr (die gehärtete Expression enthält "[0-9]+$" NICHT als Teilzeichenkette) —
    // No-op, kein erneuter Spalten-/Index-Neuaufbau, keine Datenveränderung.
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    const stillAfter = await pool.query<{ legacy_expr: string }>(`
      SELECT pg_get_expr(d.adbin, d.adrelid) AS legacy_expr
      FROM pg_attribute a
      JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'import_candidates'::regclass AND a.attname = 'source_version'
    `);
    expect(stillAfter.rows[0]?.legacy_expr).toBe(after.rows[0]?.legacy_expr); // unverändert, kein Re-Trigger
    const count = await pool.query("SELECT count(*)::int AS n FROM import_candidates");
    expect(count.rows[0].n).toBe(1); // unverändert — kein Datenverlust durch den No-op-Re-Run
  });
});
