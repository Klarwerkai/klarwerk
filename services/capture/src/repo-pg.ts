import type { Pool } from "pg";
import type { DraftRepo } from "./repo";
import type { Draft } from "./types";

export const CAPTURE_SCHEMA = `
CREATE TABLE IF NOT EXISTS drafts (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

interface DraftRow {
  data: Draft;
}

export class PgDraftRepo implements DraftRepo {
  constructor(private readonly pool: Pool) {}

  async insert(draft: Draft): Promise<void> {
    await this.pool.query("INSERT INTO drafts(id,data) VALUES($1,$2)", [
      draft.id,
      JSON.stringify(draft),
    ]);
  }

  async findById(id: string): Promise<Draft | undefined> {
    const res = await this.pool.query<DraftRow>("SELECT data FROM drafts WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(draft: Draft): Promise<void> {
    await this.pool.query("UPDATE drafts SET data=$2 WHERE id=$1", [
      draft.id,
      JSON.stringify(draft),
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM drafts WHERE id=$1", [id]);
  }

  async list(): Promise<Draft[]> {
    const res = await this.pool.query<DraftRow>(
      "SELECT data FROM drafts ORDER BY data->>'createdAt'",
    );
    return res.rows.map((row) => row.data);
  }
}
