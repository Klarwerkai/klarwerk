import type { Pool } from "pg";
import type { ModelRunRepo } from "./repo";
import type { ModelRunRecord } from "./types";

// SCRUM-164: Postgres-Adapter des ModelRun-Protokolls. Vollrecord als JSONB; nur Metadaten,
// keine Prompt-/Antworttexte. Additive Tabelle, keine Migration anderer Module nötig.
export const MODEL_RUNS_SCHEMA = `
CREATE TABLE IF NOT EXISTS model_runs (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

interface ModelRunRow {
  data: ModelRunRecord;
}

export class PgModelRunRepo implements ModelRunRepo {
  constructor(private readonly pool: Pool) {}

  async append(record: ModelRunRecord): Promise<void> {
    await this.pool.query(
      "INSERT INTO model_runs(id,data) VALUES($1,$2) ON CONFLICT (id) DO NOTHING",
      [record.id, JSON.stringify(record)],
    );
  }

  async recent(limit = 100): Promise<ModelRunRecord[]> {
    const res = await this.pool.query<ModelRunRow>(
      "SELECT data FROM model_runs ORDER BY data->>'startedAt' DESC LIMIT $1",
      [Math.max(0, limit)],
    );
    return res.rows.map((row) => row.data);
  }
}
