import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { InMemoryImportRunRepo } from "./repo";
import {
  EXTERNAL_SOURCE_SCHEMA,
  IMPORT_CANDIDATES_SCHEMA,
  IMPORT_RUN_SCHEMA,
  PgCandidateRepo,
  PgExternalSourceRepo,
  PgImportRunRepo,
} from "./repo-pg";
import type {
  ExternalSourceRecord,
  ImportCandidate,
  ImportItem,
  ImportRun,
  ImportRunItemRef,
} from "./types";

// SCRUM-510 (WP2-Batch3): echte Postgres-Belege für die gehärtete Import-Migration + den atomaren
// ON-CONFLICT-Insert. Braucht Docker (Testcontainers); läuft NUR unter `test:integration`, nie im
// schnellen Root-Gate (das excludet *.integration.test.ts) → ohne PG wird sauber NICHT gefälscht,
// sondern gar nicht ausgeführt.
// WP-SHIP8-CLOSE-7: wie die knowledge-object-/audit-Suite auch Docker-los ausführbar — eine per
// KLARWERK_PG_TEST_URL angebotene lokale Instanz läuft durch die harte GELB-Sicherung in
// services/db-tx (Testdatenbank-Name ODER KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1; sonst
// Klartext-Skip, KEIN Testcontainers-Fallback).

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
    // Lokale Instanz hat Vorrang (Docker-lose Evidence-Läufe) — HART abgesichert (bens GELB,
    // CLOSE-6): nur Testdatenbanken oder ausdrückliches KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1.
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Import-Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
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

    // Der partielle Unique-Index existiert jetzt (WP-SHIP8-FIX F3: provider-bewusst; WP-SHIP8-
    // CLOSE-3 ROT-2: claim-bewusstes Prädikat 'neu'/'in_bearbeitung'; BEIDE Altnamen sind weg).
    const idx = await pool.query(
      "SELECT 1 FROM pg_indexes WHERE indexname='import_candidates_open_claim_external_uq'",
    );
    expect(idx.rowCount).toBe(1);
    for (const legacy of [
      "import_candidates_open_external_uq",
      "import_candidates_open_provider_external_uq",
    ]) {
      const oldIdx = await pool.query("SELECT 1 FROM pg_indexes WHERE indexname=$1", [legacy]);
      expect(oldIdx.rowCount).toBe(0);
    }

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

  it("WP-SHIP8-CLOSE-3 (bens ROT-2): Claim A → insertIfAbsent B mit gleichem Schlüssel kollidiert am ECHTEN Index (false)", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(IMPORT_CANDIDATES_SCHEMA);
    const repo = new PgCandidateRepo(pool);
    const a = candidate("c-a", { externalId: "PK", sourceVersion: 4 }, "2026-01-01");
    expect(await repo.insertIfAbsent(a)).toBe(true);
    // Claim (Status-CAS + Lease) — der Kandidat bleibt im offenen Idempotenzraum des Index.
    const claimed = await repo.claim("c-a", "op-1", "2026-07-22T06:00:00.000Z");
    expect(claimed?.status).toBe("in_bearbeitung");
    expect(claimed?.opId).toBe("op-1");
    // Paralleler Importlauf: derselbe (provider, externalId, sourceVersion)-Schlüssel → KEIN
    // zweiter offener Kandidat (ON-CONFLICT-Inference trifft den claim-bewussten Arbiter-Index).
    const b = candidate("c-b", { externalId: "PK", sourceVersion: 4 }, "2026-01-02");
    expect(await repo.insertIfAbsent(b)).toBe(false);
    const open = await pool.query(
      "SELECT count(*)::int AS n FROM import_candidates WHERE external_id='PK' AND source_version=4",
    );
    expect(open.rows[0].n).toBe(1);
    // Abschluss über den opId-CAS → der Schlüssel wird frei, dieselbe Version ist wieder einreihbar.
    const done = await repo.resolveClaim("c-a", "op-1", { status: "angenommen", koId: "ko-1" });
    expect(done?.status).toBe("angenommen");
    expect(done?.opId).toBeUndefined();
    expect(await repo.insertIfAbsent(b)).toBe(true);
  });

  it("WP-SHIP8-CLOSE-3 (bens ROT-2): eine Bestandsinstanz mit dem ALTEN 'neu'-Index wird WIRKLICH ersetzt (DROP+CREATE, kein stilles No-op)", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Bestandsinstanz aus WP-SHIP8-CLOSE-2: Spalten + der alte provider-bewusste Index mit dem
    // NUR-'neu'-Prädikat (unter dem ALTEN Namen).
    await pool.query(COLUMNS_ONLY_DDL);
    await pool.query(`
      ALTER TABLE import_candidates
        ADD COLUMN IF NOT EXISTS provider text
        GENERATED ALWAYS AS (
          lower(COALESCE(NULLIF(btrim(data->'item'->>'provider'), ''), 'confluence'))
        ) STORED;
      CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_provider_external_uq
        ON import_candidates (provider, external_id, source_version)
        WHERE external_id IS NOT NULL AND review_status = 'neu';
    `);
    // Migrationslauf: der Altindex fällt, der claim-bewusste entsteht — ein CREATE IF NOT EXISTS
    // auf den Altnamen hätte hier still das ALTE Prädikat behalten (bens Punkt).
    await expect(pool.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    const oldIdx = await pool.query(
      "SELECT 1 FROM pg_indexes WHERE indexname='import_candidates_open_provider_external_uq'",
    );
    expect(oldIdx.rowCount).toBe(0);
    const newIdx = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname='import_candidates_open_claim_external_uq'",
    );
    expect(newIdx.rowCount).toBe(1);
    expect(String(newIdx.rows[0].indexdef)).toContain("in_bearbeitung");
    // Und der neue Vertrag greift sofort: Claim blockiert die Doppel-Einreihung.
    const repo = new PgCandidateRepo(pool);
    expect(
      await repo.insertIfAbsent(
        candidate("m-a", { externalId: "PM", sourceVersion: 1 }, "2026-01-01"),
      ),
    ).toBe(true);
    await repo.claim("m-a", "op-m", "2026-07-22T06:00:00.000Z");
    expect(
      await repo.insertIfAbsent(
        candidate("m-b", { externalId: "PM", sourceVersion: 1 }, "2026-01-02"),
      ),
    ).toBe(false);
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

  it("WP-SHIP8-CLOSE-7 (bens ROT-1/ROT-2): Claim speichert Akteur+Aktion, resolveClaim schreibt reviewed*+Markierung in EINEM CAS und räumt die Claim-Felder; clearAuditPending ist bedingt", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(IMPORT_CANDIDATES_SCHEMA);
    const repo = new PgCandidateRepo(pool);
    const a = candidate("s7-a", { externalId: "P7", sourceVersion: 1 }, "2026-01-01");
    expect(await repo.insertIfAbsent(a)).toBe(true);

    // ROT-2: der Claim-CAS persistiert Akteur + Aktion ADDITIV im selben Write.
    const claimed = await repo.claim("s7-a", "op-7", "2026-07-22T06:00:00.000Z", "xenia", "accept");
    expect(claimed?.status).toBe("in_bearbeitung");
    expect(claimed?.opId).toBe("op-7");
    expect(claimed?.claimedBy).toBe("xenia");
    expect(claimed?.claimedAction).toBe("accept");

    // ROT-1 + GELB: Endstatus, Wer/Wann/Aktion UND die vorbeugende Markierung reisen in EINEM
    // resolveClaim-CAS; die Claim-Felder (inkl. claimedBy/claimedAction) werden ausgeräumt.
    const pending = {
      eventId: "import.candidate-accept:s7-a:op-7",
      action: "accept" as const,
      actor: "xenia",
    };
    const done = await repo.resolveClaim("s7-a", "op-7", {
      status: "angenommen",
      koId: "ko-7",
      reviewedBy: "xenia",
      reviewedAt: "2026-07-22T06:00:01.000Z",
      reviewedAction: "accept",
      auditPending: pending,
    });
    expect(done?.status).toBe("angenommen");
    expect(done?.reviewedBy).toBe("xenia");
    expect(done?.reviewedAt).toBe("2026-07-22T06:00:01.000Z");
    expect(done?.reviewedAction).toBe("accept");
    expect(done?.auditPending).toEqual(pending);
    expect(done?.opId).toBeUndefined();
    expect(done?.claimedAt).toBeUndefined();
    expect(done?.claimedBy).toBeUndefined();
    expect(done?.claimedAction).toBeUndefined();

    // ROT-1: BEDINGTES Räumen — eine fremde Event-Id trifft nichts, die eigene räumt genau
    // einmal, ein zweiter Versuch ist ehrlich false (kein blindes Überschreiben).
    expect(await repo.clearAuditPending("s7-a", "fremde-event-id")).toBe(false);
    expect((await repo.findById("s7-a"))?.auditPending).toEqual(pending);
    expect(await repo.clearAuditPending("s7-a", pending.eventId)).toBe(true);
    expect((await repo.findById("s7-a"))?.auditPending).toBeUndefined();
    expect(await repo.clearAuditPending("s7-a", pending.eventId)).toBe(false);
    // Verschwundener Kandidat: ebenfalls false, kein Fehler (Cleanup darf gewinnen).
    expect(await repo.clearAuditPending("gibt-es-nicht", pending.eventId)).toBe(false);
  });

  it("WP-SHIP8-CLOSE-8 (bens ROT-1): das bedingte DELETE verschont Kandidaten mit auditPending — erst der geräumte Beleg gibt die Löschung frei", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(IMPORT_CANDIDATES_SCHEMA);
    const repo = new PgCandidateRepo(pool);
    const pending = candidate("s8-p", { externalId: "P8", sourceVersion: 1 }, "2026-01-01");
    const free = candidate("s8-f", { externalId: "P8", sourceVersion: 2 }, "2026-01-02");
    await repo.insert({
      ...pending,
      status: "angenommen",
      auditPending: { eventId: "import.candidate-accept:s8-p:op-8", action: "accept", actor: "x" },
    });
    await repo.insert({ ...free, status: "angenommen" });
    // Status passt bei BEIDEN exakt — trotzdem fällt nur der Kandidat OHNE Markierung
    // (die Sperre sitzt in der DELETE-Bedingung, echtes Postgres-JSONB-Prädikat).
    expect(
      await repo.removeByIds([
        { id: "s8-p", status: "angenommen" },
        { id: "s8-f", status: "angenommen" },
      ]),
    ).toEqual(["s8-f"]);
    expect((await repo.findById("s8-p"))?.auditPending).toBeTruthy();
    // Nach dem bedingten Räumen des Belegs greift dieselbe Löschung.
    expect(await repo.clearAuditPending("s8-p", "import.candidate-accept:s8-p:op-8")).toBe(true);
    expect(await repo.removeByIds([{ id: "s8-p", status: "angenommen" }])).toEqual(["s8-p"]);
    expect(await repo.findById("s8-p")).toBeUndefined();
  });

  // ==============================================================================================
  // W2-A (KW-W2-17 Zeilen 18-41) — DIE QUELLREVISION GEGEN ECHTES POSTGRESQL
  // ==============================================================================================
  //
  // Dieselben Zusagen wie im InMemory-Unittest (external-source-repo.test.ts), hier gegen den
  // echten Server. Die Paritaet ist die eigentliche Aussage: ein Vertrag, der nur in einer der
  // beiden Ablagen gilt, ist kein Vertrag (Akzeptanzkriterium 6).
  //
  // Der Unterschied, den nur dieser Lauf zeigen kann: ob die Revisionsidentitaet wirklich
  // DATENBANKSEITIG erzwungen wird. Eine Anwendungspruefung verliert jedes Rennen; ein
  // Unique-Index nicht.
  async function w2aReset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS external_source_records");
    await p.query(EXTERNAL_SOURCE_SCHEMA);
  }

  function w2aRevision(over: Partial<ExternalSourceRecord> = {}): ExternalSourceRecord {
    return {
      sourceRecordId: "sr-pg-1",
      sourceSystem: "Confluence",
      externalId: "98765",
      sourceVersion: 1,
      url: "https://wiki.example.test/pages/98765",
      title: "Wartung der Spezialpresse",
      rawOrRenderedContentReference: null,
      importedAt: "2026-08-02T14:00:00.000Z",
      contentHash: "hash-v1",
      sourceMetadata: { sourceScope: "TECH" },
      ...over,
    };
  }

  it("W2-A: additives Schema, wiederholbar — und der Unique-Vertrag der Revisionsidentitaet steht", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    // WIEDERHOLBAR: ein zweiter Lauf derselben DDL ist ein No-op, kein Fehler.
    await expect(pool.query(EXTERNAL_SOURCE_SCHEMA)).resolves.toBeDefined();

    // KEIN DROP, KEIN TRUNCATE in der Migration selbst (das DROP oben ist Testaufbau).
    expect(EXTERNAL_SOURCE_SCHEMA).not.toMatch(/DROP\s+TABLE/i);
    expect(EXTERNAL_SOURCE_SCHEMA).not.toMatch(/TRUNCATE/i);
    expect(EXTERNAL_SOURCE_SCHEMA).not.toMatch(/DROP\s+INDEX/i);

    const indizes = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'external_source_records'",
    );
    expect(indizes.rows.map((r) => r.indexname)).toContain("external_source_records_revision_uq");

    // Der Index ist WIRKLICH eindeutig — direkter Constraint-Beweis am rohen SQL, ohne Adapter.
    const roh = w2aRevision();
    await pool.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2)", [
      roh.sourceRecordId,
      JSON.stringify(roh),
    ]);
    await expect(
      pool.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2)", [
        "sr-pg-zweit",
        JSON.stringify({ ...roh, sourceRecordId: "sr-pg-zweit", contentHash: "anders" }),
      ]),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it("W2-A: dieselbe Revisionsidentitaet zweimal → genau EINE Zeile, die erste bleibt wertgleich", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    const erste = w2aRevision({ contentHash: "hash-original", title: "Fassung 1" });
    expect(await repo.insertIfAbsent(erste)).toBe(true);
    // Zweiter Lauf derselben Quellversion mit ABWEICHENDEM Inhalt und anderer interner Id.
    expect(
      await repo.insertIfAbsent(
        w2aRevision({
          sourceRecordId: "sr-pg-2",
          contentHash: "hash-anders",
          title: "Anderer Titel",
        }),
      ),
    ).toBe(false);

    const alle = await repo.listBySource("Confluence", "98765");
    expect(alle).toHaveLength(1);
    // WERTGLEICH Feld fuer Feld — nichts wurde still umgeschrieben.
    expect(alle[0]).toEqual(erste);
    expect(await repo.findById("sr-pg-2")).toBeUndefined();
  });

  it("W2-A: eine NEUE Quellversion erzeugt eine NEUE Zeile — die alte bleibt unangetastet", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    const v1 = w2aRevision({ sourceVersion: 1, contentHash: "hash-v1", title: "Fassung 1" });
    const v2 = w2aRevision({
      sourceRecordId: "sr-pg-2",
      sourceVersion: 2,
      contentHash: "hash-v2",
      title: "Fassung 2",
    });
    expect(await repo.insertIfAbsent(v1)).toBe(true);
    expect(await repo.insertIfAbsent(v2)).toBe(true);

    const alle = await repo.listBySource("Confluence", "98765");
    expect(alle.map((r) => r.sourceVersion)).toEqual([1, 2]);
    expect(alle[0]).toEqual(v1);
    expect(await repo.latestVersion("Confluence", "98765")).toBe(2);
    expect(await repo.findByRevision("Confluence", "98765", 1)).toEqual(v1);
  });

  it("W2-A: NEBENLAEUFIG — zwanzig gleichzeitige Inserts derselben Revision ergeben EINE Zeile", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    // Echte Nebenlaeufigkeit ueber den Pool. Eine Anwendungspruefung („erst lesen, dann schreiben")
    // wuerde hier verlieren; der Unique-Index nicht.
    const ergebnisse = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        repo.insertIfAbsent(w2aRevision({ sourceRecordId: `sr-parallel-${i}` })),
      ),
    );
    expect(ergebnisse.filter(Boolean)).toHaveLength(1);
    const zeilen = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM external_source_records",
    );
    expect(zeilen.rows[0]?.n).toBe("1");
  });

  it("W2-A: das Quellsystem ist normalisiert, ein anderes System ist eine EIGENE Quelle", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    expect(await repo.insertIfAbsent(w2aRevision({ sourceSystem: "Confluence" }))).toBe(true);
    // Gross-/Kleinschreibung und Rand-Leerzeichen sind DIESELBE Quelle.
    expect(
      await repo.insertIfAbsent(
        w2aRevision({ sourceRecordId: "sr-pg-2", sourceSystem: " CONFLUENCE " }),
      ),
    ).toBe(false);
    // Ein anderes Quellsystem mit zufaellig gleicher Kennung ist eine eigene Quelle.
    expect(
      await repo.insertIfAbsent(w2aRevision({ sourceRecordId: "sr-pg-3", sourceSystem: "Jira" })),
    ).toBe(true);

    expect(await repo.listBySource("confluence", "98765")).toHaveLength(1);
    expect(await repo.listBySource("Jira", "98765")).toHaveLength(1);
  });

  it("W2-A: fail-closed — unvollstaendige Identitaet erreicht die Datenbank gar nicht", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    // Dieselben Ablehnungen wie InMemory — als abgelehntes Promise, nicht als synchroner Wurf.
    await expect(repo.insertIfAbsent(w2aRevision({ sourceSystem: "  " }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(repo.insertIfAbsent(w2aRevision({ externalId: " " }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(repo.insertIfAbsent(w2aRevision({ sourceVersion: 1.5 }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const zeilen = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM external_source_records",
    );
    expect(zeilen.rows[0]?.n).toBe("0");
  });

  it("W2-A: eine unbekannte Quelle liefert ehrlich nichts", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);
    expect(await repo.findByRevision("Confluence", "gibt-es-nicht", 1)).toBeUndefined();
    expect(await repo.listBySource("Confluence", "gibt-es-nicht")).toEqual([]);
    expect(await repo.latestVersion("Confluence", "gibt-es-nicht")).toBeUndefined();
    expect(await repo.findById("sr-gibt-es-nicht")).toBeUndefined();
  });

  // ==============================================================================================
  // BEN-33 — DIE DREI NACHGEPRUEFTEN BEFUNDE GEGEN ECHTES POSTGRESQL
  // ==============================================================================================
  //
  // Diese Faelle sind die PARITAETSSEITE der drei InMemory-Faelle in external-source-repo.test.ts.
  // Sie sagen nicht „PostgreSQL kann das auch", sondern: BEIDE Ablagen geben auf dieselbe Frage
  // dieselbe Antwort — Erfolgs- WIE Fehlervertrag. Ein Vertrag, der nur in einer Ablage gilt, ist
  // keiner (Akzeptanzkriterium 6 aus Auftrag 31).

  it("BEN-33/A: eine Mutation des Eingabewerts erreicht die gespeicherte Zeile nicht", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    const eingabe = w2aRevision({ sourceMetadata: { sourceScope: "TECH", pfad: { tiefe: 1 } } });
    expect(await repo.insertIfAbsent(eingabe)).toBe(true);
    (eingabe as { title: string }).title = "nachtraeglich veraendert";
    (eingabe.sourceMetadata as { sourceScope: string }).sourceScope = "MUTIERT";
    (eingabe.sourceMetadata as { pfad: { tiefe: number } }).pfad.tiefe = 99;

    // Das ist der MASSSTAB fuer die InMemory-Ablage: jsonb hat beim Schreiben einen Schnappschuss
    // genommen, und jeder Lesevorgang liefert ein frisches Objekt.
    const gelesen = await repo.findByRevision("Confluence", "98765", 1);
    expect(gelesen?.title).toBe("Wartung der Spezialpresse");
    expect(gelesen?.sourceMetadata).toEqual({ sourceScope: "TECH", pfad: { tiefe: 1 } });

    const a = await repo.findById("sr-pg-1");
    const b = await repo.findById("sr-pg-1");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("BEN-33/B: dieselbe sourceRecordId fuer eine ANDERE Revision wird als CONFLICT abgewiesen", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    expect(await repo.insertIfAbsent(w2aRevision())).toBe(true);
    // Der Primaerschluessel schuetzt die interne Id. Der Aufrufer darf davon aber nicht einen
    // rohen Datenbankfehler sehen und InMemory einen fachlichen — beide melden CONFLICT.
    await expect(
      repo.insertIfAbsent(w2aRevision({ externalId: "andere-seite", sourceVersion: 2 })),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await repo.findByRevision("Confluence", "andere-seite", 2)).toBeUndefined();
    const zeilen = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM external_source_records",
    );
    expect(zeilen.rows[0]?.n).toBe("1");
    expect((await repo.findById("sr-pg-1"))?.externalId).toBe("98765");
  });

  it("BEN-33/B: dieselbe sourceRecordId bei GLEICHER Revision bleibt idempotent — kein Fehler", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);
    const repo = new PgExternalSourceRepo(pool);

    expect(await repo.insertIfAbsent(w2aRevision())).toBe(true);
    // Der Arbiter-Index greift VOR dem Primaerschluessel: ein Wiederholungslauf derselben
    // Quellversion bleibt ein stiller No-op. Genau diese Reihenfolge spiegelt InMemory.
    expect(await repo.insertIfAbsent(w2aRevision({ contentHash: "anders" }))).toBe(false);
    expect((await repo.findById("sr-pg-1"))?.contentHash).toBe("hash-v1");
  });

  it("BEN-33/C: ROHE Inserts mit unvollstaendiger Identitaet scheitern am Schema — keiner wird gespeichert", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);

    // BEWUSST am Adapter VORBEI. Der Adapter prueft seine eigenen Aufrufe; BEN hat zu Recht
    // gefragt, was die Datenbank selbst zusagt. Ein Unique-Index ueber NULL-faehige Spalten sagt
    // fast nichts zu: PostgreSQL haelt zwei NULLs fuer verschieden, also waeren beliebig viele
    // Zeilen ohne Identitaet erlaubt gewesen.
    const { sourceSystem, externalId, sourceVersion, ...ohneIdentitaet } = w2aRevision();
    const unvollstaendig: { name: string; id: string; data: Record<string, unknown> }[] = [
      {
        name: "ohne sourceSystem",
        id: "sr-roh-1",
        data: { ...ohneIdentitaet, externalId, sourceVersion },
      },
      {
        name: "ohne externalId",
        id: "sr-roh-2",
        data: { ...ohneIdentitaet, sourceSystem, sourceVersion },
      },
      {
        name: "ohne sourceVersion",
        id: "sr-roh-3",
        data: { ...ohneIdentitaet, sourceSystem, externalId },
      },
      { name: "voellig ohne Identitaet", id: "sr-roh-4", data: ohneIdentitaet },
      {
        name: "leeres Quellsystem",
        id: "sr-roh-5",
        data: { ...ohneIdentitaet, sourceSystem: "   ", externalId, sourceVersion },
      },
      {
        name: "gebrochene Version",
        id: "sr-roh-6",
        data: { ...ohneIdentitaet, sourceSystem, externalId, sourceVersion: 1.5 },
      },
      {
        name: "leere interne Id",
        id: "",
        data: { ...ohneIdentitaet, sourceRecordId: "", sourceSystem, externalId, sourceVersion },
      },
    ];

    for (const fall of unvollstaendig) {
      await expect(
        pool.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2)", [
          fall.id,
          JSON.stringify(fall.data),
        ]),
        fall.name,
      ).rejects.toThrow();
    }

    // BENs eigentliche Probe: ZWEI unvollstaendige Zeilen nebeneinander. Sie kommen jetzt nicht
    // einmal einzeln hinein.
    const zeilen = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM external_source_records",
    );
    expect(zeilen.rows[0]?.n).toBe("0");

    // Gegenprobe: die VOLLSTAENDIGE Identitaet passiert denselben rohen Weg anstandslos —
    // die Sperre ist eine Sperre, keine Verengung.
    const gut = w2aRevision();
    await expect(
      pool.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2)", [
        gut.sourceRecordId,
        JSON.stringify(gut),
      ]),
    ).resolves.toBeDefined();
  });

  it("BEN-33/C: die drei Schluesselspalten sind DB-seitig NOT NULL — die Luecke ist strukturell zu", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aReset(pool);

    const spalten = await pool.query<{ column_name: string; is_nullable: string }>(
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

    // Und die Identitaetsbedingung haengt wirklich als CHECK an der Tabelle (nicht nur im Adapter).
    const bedingungen = await pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'external_source_records'::regclass AND contype = 'c'`,
    );
    expect(bedingungen.rows.map((r) => r.conname)).toContain(
      "external_source_records_identitaet_ck",
    );
  });

  // ==============================================================================================
  // AUFTRAG-144 (KW-S4-26 §59-114, KW-S4-28 F1) — DIE LAUFDOMAENE GEGEN ECHTES POSTGRESQL
  // ==============================================================================================
  //
  // DIE PARITAET IST DIE AUSSAGE. Auftrag 144 §51 verlangt woertlich: derselbe Lauf ist in InMemory
  // UND PostgreSQL semantisch gleich les- und fortschreibbar. Ein Vertrag, der nur in einer Ablage
  // gilt, ist keiner — dieselbe Lehre, die schon bei der Quellrevision oben gezogen wurde.
  //
  // Was nur DIESER Lauf zeigen kann: ob Idempotenz und Ordnung an ECHTEN Constraints haengen und
  // nicht an einer Anwendungspruefung, die jedes Rennen verliert.
  async function w2aLaufReset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS import_run_item_refs");
    await p.query("DROP TABLE IF EXISTS import_runs");
    await p.query(IMPORT_RUN_SCHEMA);
  }

  const LAUF_T0 = "2026-08-03T09:00:00.000Z";

  function pgLauf(over: Partial<ImportRun> = {}): ImportRun {
    return {
      importId: "run-pg-1",
      sourceSystem: "Confluence",
      externalId: "98765",
      sourceScope: "TECH",
      requestedSourceVersion: 2,
      status: "QUEUED",
      sourceRecordId: null,
      startedAt: LAUF_T0,
      completedAt: null,
      failureCode: null,
      failureReason: null,
      counters: {
        itemsTotal: 0,
        itemsCreated: 0,
        itemsBound: 0,
        itemsSkipped: 0,
        itemsFailed: 0,
      },
      ...over,
    };
  }

  function pgRef(over: Partial<ImportRunItemRef> = {}): ImportRunItemRef {
    return {
      importId: "run-pg-1",
      ordinal: 0,
      sourceRecordId: "sr-pg-1",
      candidateItemId: "cand-pg-1",
      knowledgeObjectId: null,
      itemOutcome: "CREATED",
      itemFailureCode: null,
      ...over,
    };
  }

  it("P1 · additives, wiederholbares Laufschema — ohne DROP, TRUNCATE oder DO UPDATE", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aLaufReset(pool);
    // WIEDERHOLBAR: derselbe zweite Lauf der DDL ist ein No-op, kein Fehler. Das ist die
    // Idempotenz der Migration selbst, an der echten Instanz und nicht am Text behauptet.
    await expect(pool.query(IMPORT_RUN_SCHEMA)).resolves.toBeDefined();
    await expect(pool.query(IMPORT_RUN_SCHEMA)).resolves.toBeDefined();

    // Die verbotenen Formen kommen in der Migration selbst nicht vor (die DROPs oben sind
    // Testaufbau). `DO UPDATE` waere das stille Ueberschreiben, das Auftrag 144 §70 ausschliesst.
    expect(IMPORT_RUN_SCHEMA).not.toMatch(/DROP\s+TABLE/i);
    expect(IMPORT_RUN_SCHEMA).not.toMatch(/DROP\s+INDEX/i);
    expect(IMPORT_RUN_SCHEMA).not.toMatch(/TRUNCATE/i);
    expect(IMPORT_RUN_SCHEMA).not.toMatch(/DO\s+UPDATE/i);

    const tabellen = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('import_runs','import_run_item_refs')
        ORDER BY table_name`,
    );
    expect(tabellen.rows.map((r) => r.table_name)).toEqual(["import_run_item_refs", "import_runs"]);
  });

  it("P2 · Laufanlage ist am ECHTEN Schluessel idempotent und ueberschreibt die erste Zeile nie", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aLaufReset(pool);
    const repo = new PgImportRunRepo(pool);

    expect(await repo.insertIfAbsent(pgLauf())).toBe(true);
    // Zweiter Anlauf mit ABWEICHENDEM Inhalt: false, und der erste Stand bleibt. Ein `upsert`
    // meldete `true` oder schriebe COMPLETED — beides faellt genau hier auf.
    expect(await repo.insertIfAbsent(pgLauf({ status: "COMPLETED", sourceRecordId: "sr-9" }))).toBe(
      false,
    );
    const gelesen = await repo.findById("run-pg-1");
    expect(gelesen?.status).toBe("QUEUED");
    expect(gelesen?.sourceRecordId).toBeNull();

    // Der Schutz haengt an einem ECHTEN Primaerschluessel, nicht am Adapter: der rohe Insert faellt.
    await expect(
      pool.query("INSERT INTO import_runs(import_id, data) VALUES($1,$2::jsonb)", [
        "run-pg-1",
        JSON.stringify(pgLauf({ status: "FAILED" })),
      ]),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("P3 · derselbe Lauf ist in PostgreSQL gleich lesbar und fortschreibbar wie InMemory", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aLaufReset(pool);
    const pg = new PgImportRunRepo(pool);
    const mem = new InMemoryImportRunRepo();

    for (const repo of [pg, mem] as const) {
      expect(await repo.insertIfAbsent(pgLauf())).toBe(true);
      const nachher = await repo.advance("run-pg-1", {
        status: "PARTIAL",
        sourceRecordId: "sr-pg-1",
        completedAt: "2026-08-03T09:07:00.000Z",
        counters: {
          itemsTotal: 3,
          itemsCreated: 1,
          itemsBound: 1,
          itemsSkipped: 0,
          itemsFailed: 1,
        },
      });
      // Feld fuer Feld dieselbe Semantik — das ist die Paritaetsaussage.
      expect(nachher.status).toBe("PARTIAL");
      expect(nachher.sourceRecordId).toBe("sr-pg-1");
      expect(nachher.completedAt).toBe("2026-08-03T09:07:00.000Z");
      expect(nachher.startedAt).toBe(LAUF_T0);
      expect(nachher.counters).toEqual({
        itemsTotal: 3,
        itemsCreated: 1,
        itemsBound: 1,
        itemsSkipped: 0,
        itemsFailed: 1,
      });
      expect((await repo.findById("run-pg-1"))?.status).toBe("PARTIAL");

      // Unbekannter Lauf bleibt unbekannt — in BEIDEN Ablagen, ohne erfundenen Leer-Lauf.
      expect(await repo.findById("gibt-es-nicht")).toBeUndefined();
      expect(await repo.listItemRefs("gibt-es-nicht")).toEqual([]);
      await expect(repo.advance("gibt-es-nicht", { status: "FETCHING" })).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }
  });

  it("P4 · ItemRefs kommen aus der Datenbank nach ordinal geordnet — verkehrt eingefuegt", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aLaufReset(pool);
    const repo = new PgImportRunRepo(pool);
    await repo.insertIfAbsent(pgLauf());

    // ABSICHTLICH verkehrt herum. Ohne diese Reihenfolge waere die Zusicherung strukturell
    // erfuellt und wertlos — PostgreSQL gibt ohne ORDER BY keine Reihenfolge zu.
    await repo.appendItemRefs([
      pgRef({ ordinal: 2, candidateItemId: "cand-3", itemOutcome: "FAILED", itemFailureCode: "X" }),
      pgRef({ ordinal: 0, candidateItemId: "cand-1" }),
      pgRef({
        ordinal: 1,
        candidateItemId: "cand-2",
        knowledgeObjectId: "ko-2",
        itemOutcome: "BOUND",
      }),
    ]);
    const refs = await repo.listItemRefs("run-pg-1");
    expect(refs.map((r) => r.ordinal)).toEqual([0, 1, 2]);
    expect(refs.map((r) => r.candidateItemId)).toEqual(["cand-1", "cand-2", "cand-3"]);
    expect(refs[1]?.knowledgeObjectId).toBe("ko-2");
    expect(refs[2]?.itemFailureCode).toBe("X");

    // Dieselbe (importId, ordinal) ein zweites Mal: kein Duplikat, kein Ueberschreiben.
    expect(await repo.appendItemRefs([pgRef({ ordinal: 0, candidateItemId: "cand-ANDERS" })])).toBe(
      0,
    );
    expect((await repo.listItemRefs("run-pg-1"))[0]?.candidateItemId).toBe("cand-1");

    // Und die Eindeutigkeit haengt am ECHTEN Schluessel, nicht am Adapter.
    await expect(
      pool.query(
        "INSERT INTO import_run_item_refs(import_id, ordinal, data) VALUES($1,$2,$3::jsonb)",
        ["run-pg-1", 0, JSON.stringify(pgRef({ candidateItemId: "roh" }))],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("P5 · Neustartbeleg: ein neuer Adapter auf derselben Datenbank sieht denselben Lauf", async (ctx) => {
    const pool = requirePool(ctx);
    await w2aLaufReset(pool);
    const ersterAdapter = new PgImportRunRepo(pool);
    await ersterAdapter.insertIfAbsent(pgLauf());
    await ersterAdapter.advance("run-pg-1", { status: "ANALYZING", sourceRecordId: "sr-pg-1" });
    await ersterAdapter.appendItemRefs([pgRef({ ordinal: 0 }), pgRef({ ordinal: 1 })]);

    // Ein FRISCHER Adapter haelt keinerlei Zustand — was er sieht, steht wirklich in der Datenbank.
    const nachNeustart = new PgImportRunRepo(pool);
    const lauf = await nachNeustart.findById("run-pg-1");
    expect(lauf?.status).toBe("ANALYZING");
    expect(lauf?.sourceRecordId).toBe("sr-pg-1");
    expect(lauf?.startedAt).toBe(LAUF_T0);
    expect((await nachNeustart.listItemRefs("run-pg-1")).map((r) => r.ordinal)).toEqual([0, 1]);
  });
});
