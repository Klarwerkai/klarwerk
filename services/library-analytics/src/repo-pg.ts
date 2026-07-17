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
// Rein ADDITIV (ADD COLUMN/INDEX IF NOT EXISTS). Betriebs-Hinweis: existieren aus der Zeit VOR diesem Fix
// bereits zwei offene Kandidaten derselben (externalId, sourceVersion), schlägt die Index-Erstellung beim
// Start EHRLICH fehl (statt still) — die Dublette ist dann vor dem Deploy einmalig zu bereinigen.
export const IMPORT_CANDIDATES_SCHEMA = `
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
