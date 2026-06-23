import type { Pool } from "pg";
import type { ConflictRepo } from "./repo";
import type { Conflict } from "./types";

export const CONFLICTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS conflicts (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

interface ConflictRow {
  data: Conflict;
}

export class PgConflictRepo implements ConflictRepo {
  constructor(private readonly pool: Pool) {}

  async insert(conflict: Conflict): Promise<void> {
    await this.pool.query("INSERT INTO conflicts(id,data) VALUES($1,$2)", [
      conflict.id,
      JSON.stringify(conflict),
    ]);
  }

  async findById(id: string): Promise<Conflict | undefined> {
    const res = await this.pool.query<ConflictRow>("SELECT data FROM conflicts WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(conflict: Conflict): Promise<void> {
    await this.pool.query("UPDATE conflicts SET data=$2 WHERE id=$1", [
      conflict.id,
      JSON.stringify(conflict),
    ]);
  }

  async all(): Promise<Conflict[]> {
    const res = await this.pool.query<ConflictRow>("SELECT data FROM conflicts");
    return res.rows.map((row) => row.data);
  }
}
