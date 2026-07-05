import type { Pool } from "pg";
import type { OverlapRepo } from "./overlap-repo";
import type { OverlapEntry } from "./overlap-types";

// Berater-Konzept Duplikate 04.07. (Stufe D3b): Postgres-Persistenz der Überschneidungs-Einträge.
// Muster PgConflictRepo — eigene JSONB-Tabelle, produktseitig getrennt von Konflikten.
export const OVERLAP_SCHEMA = `
CREATE TABLE IF NOT EXISTS overlaps (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

interface OverlapRow {
  data: OverlapEntry;
}

export class PgOverlapRepo implements OverlapRepo {
  constructor(private readonly pool: Pool) {}

  async insert(entry: OverlapEntry): Promise<void> {
    await this.pool.query("INSERT INTO overlaps(id,data) VALUES($1,$2)", [
      entry.id,
      JSON.stringify(entry),
    ]);
  }

  async findById(id: string): Promise<OverlapEntry | undefined> {
    const res = await this.pool.query<OverlapRow>("SELECT data FROM overlaps WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(entry: OverlapEntry): Promise<void> {
    await this.pool.query("UPDATE overlaps SET data=$2 WHERE id=$1", [
      entry.id,
      JSON.stringify(entry),
    ]);
  }

  async all(): Promise<OverlapEntry[]> {
    const res = await this.pool.query<OverlapRow>("SELECT data FROM overlaps");
    return res.rows.map((row) => row.data);
  }
}
