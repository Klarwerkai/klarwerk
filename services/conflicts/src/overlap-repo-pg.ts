import type { Pool } from "pg";
import type { OverlapRepo } from "./overlap-repo";
import type { OverlapEntry } from "./overlap-types";

// Berater-Konzept Duplikate 04.07. (Stufe D3b): Postgres-Persistenz der Überschneidungs-Einträge.
// Muster PgConflictRepo — eigene JSONB-Tabelle, produktseitig getrennt von Konflikten.
// SCRUM-496: Tabellenname bewusst NICHT "overlaps" — OVERLAPS ist ein reserviertes
// Postgres-Keyword (SQL-Operator), unquotiert ist "CREATE TABLE overlaps" ungültige Syntax
// (42601) und migrate() brach beim Boot ab. "ko_overlaps" (Konvention wie ko_evidence) ist
// unkritisch. Die Tabelle existierte auf der Beta nie → reines CREATE, keine Datenmigration.
export const OVERLAP_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_overlaps (
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
    await this.pool.query("INSERT INTO ko_overlaps(id,data) VALUES($1,$2)", [
      entry.id,
      JSON.stringify(entry),
    ]);
  }

  async findById(id: string): Promise<OverlapEntry | undefined> {
    const res = await this.pool.query<OverlapRow>("SELECT data FROM ko_overlaps WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(entry: OverlapEntry): Promise<void> {
    await this.pool.query("UPDATE ko_overlaps SET data=$2 WHERE id=$1", [
      entry.id,
      JSON.stringify(entry),
    ]);
  }

  async all(): Promise<OverlapEntry[]> {
    const res = await this.pool.query<OverlapRow>("SELECT data FROM ko_overlaps");
    return res.rows.map((row) => row.data);
  }
}
