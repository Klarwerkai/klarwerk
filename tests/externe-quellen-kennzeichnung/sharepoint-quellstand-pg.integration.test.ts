// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-1653 — DER SHAREPOINT-QUELLSTAND
// PASST IN DEN REVISIONSVERTRAG, AUCH IN POSTGRESQL.
// ================================================================================================
//
// BEFUND (Ben, Nacharbeit 3): der SharePoint-Mapper schreibt den Quellstand als Sekunden seit 1970
// (zehn Stellen), Importprüfung und Schema erlaubten höchstens neun. Jede aktuelle SharePoint-Datei
// wurde abgewiesen; in `import_candidates` fiel die Fassung sogar still auf den Fallback 1.
//
// KORREKTUR: `MAX_SOURCE_VERSION` = 15 Stellen (repo.ts), `import_candidates.source_version` ist
// `bigint` mit `^[0-9]{1,15}$`, der CHECK von `external_source_records` trägt dieselbe Regel.
//
// GEMESSEN HIER, gegen echtes PostgreSQL:
//   P1  Neuinstallation: zwei Fassungen derselben SharePoint-Datei belegen ZWEI Plätze, mit
//       exaktem Wert; dieselbe Fassung bleibt idempotent.
//   P2  Bestandsinstanz mit der Neun-Stellen-Spalte: die Heilung erhält jeden bisherigen Wert und
//       seine Reihenfolge, gibt der zehnstelligen Fassung ihren echten Wert und ist wiederholbar.
//   P3  Bestandsinstanz mit dem Neun-Stellen-CHECK: Bestandszeilen bleiben unverändert, die
//       zehnstellige Revision wird danach angenommen und numerisch richtig eingeordnet; die neue
//       Obergrenze gilt weiter (16 Stellen abgewiesen); ein zweiter Lauf ändert nichts.
//
// Läuft NUR unter `test:integration` (Docker/Testcontainers oder KLARWERK_PG_TEST_URL); ohne beides
// wird ehrlich übersprungen — dieselbe Bauform wie `services/library-analytics/src/repo-pg.integration.test.ts`.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { MAX_SOURCE_VERSION } from "../../services/library-analytics/src/repo";
import {
  EXTERNAL_SOURCE_SCHEMA,
  IMPORT_CANDIDATES_SCHEMA,
  PgCandidateRepo,
  PgExternalSourceRepo,
} from "../../services/library-analytics/src/repo-pg";
import type {
  ExternalSourceRecord,
  ImportCandidate,
  ImportItem,
} from "../../services/library-analytics/src/types";

/** 2026-09-10T08:30:00Z in Sekunden — so liefert `sharepointQuellstand` ihn. */
const STAND_ALT = 1_789_029_000;
/** Eine Minute später gespeichert: eine NEUERE Fassung derselben Datei. */
const STAND_NEU = 1_789_029_060;

/** Die Kandidatenspalte, wie Bestandsinstanzen sie vor R-1653 tragen (neun Stellen, `integer`). */
const KANDIDATEN_NEUN_STELLEN = `
CREATE TABLE IF NOT EXISTS import_candidates (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (NULLIF(data->'item'->>'externalId', '')) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS provider text
  GENERATED ALWAYS AS (
    lower(COALESCE(NULLIF(btrim(data->'item'->>'provider'), ''), 'confluence'))
  ) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS source_version integer
  GENERATED ALWAYS AS (
    CASE WHEN (data->'item'->>'sourceVersion') ~ '^[0-9]{1,9}$'
         THEN (data->'item'->>'sourceVersion')::int
         ELSE 1 END
  ) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS review_status text
  GENERATED ALWAYS AS (data->>'status') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_claim_external_uq
  ON import_candidates (provider, external_id, source_version)
  WHERE external_id IS NOT NULL AND review_status IN ('neu', 'in_bearbeitung');
`;

/** Der CHECK, wie Bestandsinstanzen ihn vor R-1653 tragen (neun Stellen). */
const CHECK_NEUN_STELLEN = `
ALTER TABLE external_source_records DROP CONSTRAINT external_source_records_identitaet_ck;
ALTER TABLE external_source_records
  ADD CONSTRAINT external_source_records_identitaet_ck CHECK (
    btrim(source_record_id) <> ''
    AND btrim(coalesce(data->>'sourceSystem', '')) <> ''
    AND btrim(coalesce(data->>'externalId', '')) <> ''
    AND coalesce(data->>'sourceVersion', '') ~ '^[0-9]{1,9}$'
  );
`;

function kandidat(id: string, over: Partial<ImportItem>): ImportCandidate {
  const item: ImportItem = {
    title: `Wartungsanweisung ${id}`,
    statement: "Wartung der Abfüllanlage.",
    type: "best_practice",
    category: "b!testbibliothek",
    externalId: "01WARTUNG7XYZ",
    sourceScope: "b!testbibliothek",
    sourceVersion: STAND_ALT,
    provider: "SharePoint",
    ...over,
  };
  return {
    id,
    item,
    status: "neu",
    duplicate: false,
    note: null,
    koId: null,
    createdAt: "2026-09-10T09:00:00.000Z",
  };
}

function revision(over: Partial<ExternalSourceRecord>): ExternalSourceRecord {
  return {
    sourceRecordId: "sr-1",
    sourceSystem: "SharePoint",
    externalId: "01WARTUNG7XYZ",
    sourceVersion: STAND_ALT,
    url: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx",
    title: "Wartungsanweisung.docx",
    rawOrRenderedContentReference: null,
    importedAt: "2026-09-10T09:00:00.000Z",
    contentHash: "hash",
    sourceMetadata: {},
    ...over,
  };
}

describe("R-1653 · SharePoint-Quellstand im Revisionsvertrag gegen echtes PostgreSQL", () => {
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
          "[KLARWERK] R-1653-PG-Suite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
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
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
    } catch {
      available = false;
    }
  });

  afterAll(async () => {
    // Auf einer geteilten Testinstanz (KLARWERK_PG_TEST_URL) bleibt nichts von hier zurück: eine
    // Folgesuite, die eine LEERE Datenbank voraussetzt (`db.migrate.schemas-61`), darf diese
    // Tabellen nicht vorfinden.
    if (available && pool) {
      await pool.query("DROP TABLE IF EXISTS import_candidates");
      await pool.query("DROP TABLE IF EXISTS external_source_records");
    }
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

  async function versionen(p: Pool): Promise<Array<{ id: string; v: number }>> {
    const res = await p.query<{ id: string; source_version: string | number }>(
      "SELECT id, source_version FROM import_candidates ORDER BY source_version, id",
    );
    return res.rows.map((r) => ({ id: r.id, v: Number(r.source_version) }));
  }

  async function spaltenausdruck(p: Pool): Promise<string> {
    const res = await p.query<{ ausdruck: string }>(
      `SELECT pg_get_expr(d.adbin, d.adrelid) AS ausdruck
         FROM pg_attribute a
         JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = 'import_candidates'::regclass AND a.attname = 'source_version'
          AND NOT a.attisdropped`,
    );
    return res.rows[0]?.ausdruck ?? "";
  }

  async function checkRegel(p: Pool): Promise<string> {
    const res = await p.query<{ regel: string }>(
      `SELECT pg_get_constraintdef(oid) AS regel FROM pg_constraint
        WHERE conname = 'external_source_records_identitaet_ck'`,
    );
    return res.rows[0]?.regel ?? "";
  }

  it("P1 · Neuinstallation: zwei SharePoint-Fassungen, zwei Plätze, exakte Werte", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DROP TABLE IF EXISTS import_candidates");
    await p.query(IMPORT_CANDIDATES_SCHEMA);
    const repo = new PgCandidateRepo(p);

    expect(await repo.insertIfAbsent(kandidat("alt", { sourceVersion: STAND_ALT }))).toBe(true);
    expect(
      await repo.insertIfAbsent(kandidat("neu", { sourceVersion: STAND_NEU })),
      "die neuere Fassung derselben Datei ist ein eigener Stand, kein Duplikat",
    ).toBe(true);
    expect(
      await repo.insertIfAbsent(kandidat("alt-nochmal", { sourceVersion: STAND_ALT })),
      "dieselbe Fassung bleibt idempotent",
    ).toBe(false);

    expect(await versionen(p)).toEqual([
      { id: "alt", v: STAND_ALT },
      { id: "neu", v: STAND_NEU },
    ]);
  });

  it("P2 · Bestand mit Neun-Stellen-Spalte: Werte und Reihenfolge bleiben, die Heilung ist wiederholbar", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DROP TABLE IF EXISTS import_candidates");
    await p.query(KANDIDATEN_NEUN_STELLEN);
    const zeilen = [
      kandidat("confluence-7", { externalId: "P7", provider: "Confluence", sourceVersion: 7 }),
      kandidat("grenze-alt", {
        externalId: "P9",
        provider: "Confluence",
        sourceVersion: 999_999_999,
      }),
      kandidat("sharepoint", { sourceVersion: STAND_ALT }),
    ];
    for (const z of zeilen) {
      await p.query("INSERT INTO import_candidates(id,data) VALUES($1,$2)", [
        z.id,
        JSON.stringify(z),
      ]);
    }
    // Vorbedingung: die alte Spalte verliert die zehnstellige Fassung wirklich an den Fallback.
    expect(await versionen(p)).toEqual([
      { id: "sharepoint", v: 1 },
      { id: "confluence-7", v: 7 },
      { id: "grenze-alt", v: 999_999_999 },
    ]);

    await expect(p.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    const ausdruck = await spaltenausdruck(p);
    expect(ausdruck).toContain("{1,15}");
    expect(ausdruck).not.toContain("{1,9}");

    // Jeder bisherige Wert bleibt, die SharePoint-Fassung bekommt ihren echten Wert.
    const nachher = await versionen(p);
    expect(nachher).toEqual([
      { id: "confluence-7", v: 7 },
      { id: "grenze-alt", v: 999_999_999 },
      { id: "sharepoint", v: STAND_ALT },
    ]);
    const daten = await p.query<{ id: string; data: ImportCandidate }>(
      "SELECT id, data FROM import_candidates ORDER BY id",
    );
    const erwartet = [...zeilen].sort((a, b) => a.id.localeCompare(b.id));
    expect(daten.rows.map((r) => r.data)).toEqual(erwartet);

    // Der neu aufgebaute Index wirkt mit dem echten Wert.
    const repo = new PgCandidateRepo(p);
    const neuere = kandidat("sharepoint-neu", { sourceVersion: STAND_NEU });
    const gleiche = kandidat("sharepoint-dup", { sourceVersion: STAND_ALT });
    expect(await repo.insertIfAbsent(neuere)).toBe(true);
    expect(await repo.insertIfAbsent(gleiche)).toBe(false);

    // Wiederholt: kein zweiter Neuaufbau, keine Änderung.
    const vorWiederholung = await versionen(p);
    await expect(p.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    expect(await spaltenausdruck(p)).toBe(ausdruck);
    expect(await versionen(p)).toEqual(vorWiederholung);
  });

  it("P3 · Bestand mit Neun-Stellen-CHECK: Revisionen bleiben, die zehnstellige wird angenommen", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DROP TABLE IF EXISTS external_source_records");
    await p.query(EXTERNAL_SOURCE_SCHEMA);
    await p.query(CHECK_NEUN_STELLEN);
    expect(await checkRegel(p)).toContain("{1,9}");

    const repo = new PgExternalSourceRepo(p);
    const v3 = revision({ sourceRecordId: "sr-3", sourceVersion: 3 });
    const v9 = revision({ sourceRecordId: "sr-9", sourceVersion: 999_999_999 });
    expect(await repo.insertIfAbsent(v3)).toBe(true);
    expect(await repo.insertIfAbsent(v9)).toBe(true);
    // Vorbedingung: der alte CHECK weist die zehnstellige Fassung datenbankseitig ab.
    const sp = revision({ sourceRecordId: "sr-sp", sourceVersion: STAND_ALT });
    await expect(
      p.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2)", [
        sp.sourceRecordId,
        JSON.stringify(sp),
      ]),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(p.query(EXTERNAL_SOURCE_SCHEMA)).resolves.toBeDefined();
    const regel = await checkRegel(p);
    expect(regel).toContain("{1,15}");
    expect(regel).not.toContain("{1,9}");

    expect(await repo.insertIfAbsent(sp)).toBe(true);
    const alle = await repo.listBySource("SharePoint", "01WARTUNG7XYZ");
    expect(alle.map((r) => r.sourceVersion)).toEqual([3, 999_999_999, STAND_ALT]);
    expect(alle[0]).toEqual(v3);
    expect(alle[1]).toEqual(v9);
    expect(await repo.latestVersion("SharePoint", "01WARTUNG7XYZ")).toBe(STAND_ALT);

    // Die neue Grenze gilt weiter — sechzehn Stellen bleiben ausgeschlossen, auch roh.
    const zuLang = revision({ sourceRecordId: "sr-16", sourceVersion: MAX_SOURCE_VERSION + 1 });
    await expect(repo.insertIfAbsent(zuLang)).rejects.toThrow(/sourceVersion/);
    await expect(
      p.query("INSERT INTO external_source_records(source_record_id,data) VALUES($1,$2)", [
        zuLang.sourceRecordId,
        JSON.stringify(zuLang),
      ]),
    ).rejects.toMatchObject({ code: "23514" });

    // Wiederholt: der CHECK bleibt, wie er ist, der Bestand auch.
    await expect(p.query(EXTERNAL_SOURCE_SCHEMA)).resolves.toBeDefined();
    expect(await checkRegel(p)).toBe(regel);
    expect((await repo.listBySource("SharePoint", "01WARTUNG7XYZ")).length).toBe(3);
  });
});
