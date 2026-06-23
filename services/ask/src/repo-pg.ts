import type { Pool } from "pg";
import type { GapRepo } from "./repo";
import type { Gap } from "./types";

export const ASK_SCHEMA = `
CREATE TABLE IF NOT EXISTS gaps (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

interface GapRow {
  data: Gap;
}

export class PgGapRepo implements GapRepo {
  constructor(private readonly pool: Pool) {}

  async insert(gap: Gap): Promise<void> {
    await this.pool.query("INSERT INTO gaps(id,data) VALUES($1,$2)", [gap.id, JSON.stringify(gap)]);
  }

  async findById(id: string): Promise<Gap | undefined> {
    const res = await this.pool.query<GapRow>("SELECT data FROM gaps WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(gap: Gap): Promise<void> {
    await this.pool.query("UPDATE gaps SET data=$2 WHERE id=$1", [gap.id, JSON.stringify(gap)]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM gaps WHERE id=$1", [id]);
  }

  async all(): Promise<Gap[]> {
    const res = await this.pool.query<GapRow>("SELECT data FROM gaps");
    return res.rows.map((row) => row.data);
  }
}
