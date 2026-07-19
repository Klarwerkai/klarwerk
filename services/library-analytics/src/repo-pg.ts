import type { Pool } from "pg";
import type { CandidateRepo } from "./repo";
import type { ImportCandidate } from "./types";

// SCRUM-157: Postgres-Adapter der Import-/Source-Review-Queue. Vollständiger Kandidat als
// JSONB (Status/Duplicate/Note/koId/createdAt bleiben erhalten). Additive Tabelle.
// SCRUM-510 (WP3): ATOMARE Idempotenz der externalId-Kandidaten über einen PARTIELLEN UNIQUE-Index. Die
// Schlüsselfelder werden als GENERATED-Spalten aus dem JSONB abgeleitet (bleiben bei jedem data-UPDATE
// automatisch konsistent, kein Drift). Der Index greift NUR für offene (status "neu") externalId-Kandidaten:
// so kann pro (externalId, sourceVersion) höchstens EIN offener Kandidat existieren — auch bei nebenläufigen
// Läufen/Retries. Nach dem Review (status ≠ "neu") verlässt der Kandidat den Index → ein späterer Re-Sync
// derselben Version ist wieder möglich (Semantik deckungsgleich mit dem pending-Check des Orchestrators).
//
// SCRUM-510 (WP2-Batch3): Härtung der Migration.
//  (b) CAST-SICHER: source_version wird nur bei einer reinen Ziffernfolge gecastet, sonst Fallback 1
//      (deckungsgleich mit sourceVersion ?? 1 in App/InMemory). Eine ungültige historische sourceVersion
//      (z. B. "v3", "1.5", null) bricht so weder die STORED-Backfill-ALTER noch spätere INSERT/UPDATE.
//  (a) SELBSTHEILEND: VOR der Index-Erstellung werden Alt-Dubletten deterministisch bereinigt — pro
//      (external_id, source_version) bleibt der JÜNGSTE offene Kandidat (nach createdAt, Tiebreak id)
//      zum Review, ältere werden entfernt. So SCHEITERT der Start nie mehr an vorhandenen Dubletten;
//      der „laut statt still"-Gedanke bleibt als PG-RAISE-NOTICE erhalten. Rein additiv + idempotent
//      (Re-Run: keine Dubletten mehr → 0 Löschungen, Index existiert bereits → No-op).
// SCRUM-510 (WP-B): Die CAST-SICHERE Expression aus (b) griff nur bei NEU angelegter Spalte — Bestands-
// instanzen aus der Zeit VOR (b) (Commit 0901549) behielten die alte, cast-unsichere Generated-Expression
// (COALESCE(...::int, 1)) unverändert, weil `ADD COLUMN IF NOT EXISTS` bei bereits vorhandener Spalte ein
// No-op ist. Dort crasht ein INSERT mit nicht-numerischer sourceVersion (z. B. "v3") weiterhin am
// Postgres-Cast. Der folgende Block erkennt das per pg_attrdef/pg_get_expr (information_schema liefert
// Generated-Expressions nicht) und heilt EINMALIG: DROP COLUMN CASCADE reißt die alte Spalte samt allen
// darauf gebauten Objekten (hier: der partielle Unique-Index) mit; die nachfolgenden ADD-COLUMN/
// CREATE-INDEX-Schritte unten legen beides mit der sicheren Expression neu an. Läuft in derselben
// impliziten Transaktion wie der Rest der Migration (Postgres' Simple-Query-Protokoll wrapped ein
// mehrstatement-Query atomar) und ist idempotent: nach der Heilung trägt die Spalte die sichere
// Expression, ein Re-Run erkennt "COALESCE" nicht mehr und ist ein No-op. Neuinstallationen sind
// unberührt (source_version existiert dort noch nicht → Erkennung liefert NULL → kein Trigger).
export const IMPORT_CANDIDATES_SCHEMA = `
CREATE TABLE IF NOT EXISTS import_candidates (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (data->'item'->>'externalId') STORED;
DO $$
DECLARE
  legacy_expr text;
  dependent_indexes text;
BEGIN
  SELECT pg_get_expr(d.adbin, d.adrelid) INTO legacy_expr
  FROM pg_attribute a
  JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'import_candidates'::regclass
    AND a.attname = 'source_version'
    AND NOT a.attisdropped;

  IF legacy_expr LIKE '%COALESCE%' THEN
    SELECT string_agg(DISTINCT i.indexrelid::regclass::text, ', ') INTO dependent_indexes
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attname = 'source_version'
    WHERE i.indrelid = 'import_candidates'::regclass
      AND a.attnum = ANY(i.indkey);

    RAISE NOTICE 'import_candidates: alte cast-unsichere source_version-Expression erkannt — Spalte wird neu aufgebaut, abhängige Indizes (%) folgen (SCRUM-510 WP-B)', COALESCE(dependent_indexes, '-');
    ALTER TABLE import_candidates DROP COLUMN source_version CASCADE;
  END IF;
END $$;
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
DO $$
DECLARE removed integer;
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (
      PARTITION BY external_id, source_version
      ORDER BY (data->>'createdAt') DESC, id DESC
    ) AS rn
    FROM import_candidates
    WHERE external_id IS NOT NULL AND review_status = 'neu'
  )
  DELETE FROM import_candidates c
  USING ranked r
  WHERE c.id = r.id AND r.rn > 1;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    RAISE NOTICE 'import_candidates: % Alt-Dublette(n) vor Unique-Index entfernt (SCRUM-510 WP2)', removed;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_external_uq
  ON import_candidates (external_id, source_version)
  WHERE external_id IS NOT NULL AND review_status = 'neu';
`;

interface CandidateRow {
  data: ImportCandidate;
}

export class PgCandidateRepo implements CandidateRepo {
  constructor(private readonly pool: Pool) {}

  async insert(candidate: ImportCandidate): Promise<void> {
    await this.pool.query("INSERT INTO import_candidates(id,data) VALUES($1,$2)", [
      candidate.id,
      JSON.stringify(candidate),
    ]);
  }

  // SCRUM-510 (WP3): idempotenter Insert über den partiellen UNIQUE-Index. ON CONFLICT DO NOTHING trifft
  // NUR den Index (offener externalId-Kandidat mit gleicher Version) → dann wird nichts eingefügt und
  // RETURNING liefert keine Zeile (false). Ohne externalId greift der Index nicht → immer eingefügt (true).
  async insertIfAbsent(candidate: ImportCandidate): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO import_candidates(id,data) VALUES($1,$2)
       ON CONFLICT (external_id, source_version)
         WHERE external_id IS NOT NULL AND review_status = 'neu'
       DO NOTHING
       RETURNING id`,
      [candidate.id, JSON.stringify(candidate)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<ImportCandidate | undefined> {
    const res = await this.pool.query<CandidateRow>(
      "SELECT data FROM import_candidates WHERE id=$1",
      [id],
    );
    return res.rows[0]?.data;
  }

  async update(candidate: ImportCandidate): Promise<void> {
    await this.pool.query("UPDATE import_candidates SET data=$2 WHERE id=$1", [
      candidate.id,
      JSON.stringify(candidate),
    ]);
  }

  async all(): Promise<ImportCandidate[]> {
    const res = await this.pool.query<CandidateRow>(
      "SELECT data FROM import_candidates ORDER BY data->>'createdAt'",
    );
    return res.rows.map((row) => row.data);
  }
}
