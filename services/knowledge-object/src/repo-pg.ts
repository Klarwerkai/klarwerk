import type { Pool } from "pg";
import type { KoFilter, KoRepo } from "./repo";
import type { KnowledgeObject } from "./types";

// Postgres-Adapter für knowledge-object. Vollobjekt als JSONB; Filterspalten indiziert.
export const KO_SCHEMA = `
CREATE TABLE IF NOT EXISTS kos (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL,
  category text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kos_type ON kos(type);
CREATE INDEX IF NOT EXISTS idx_kos_status ON kos(status);
`;

interface DataRow {
  data: KnowledgeObject;
}

export class PgKoRepo implements KoRepo {
  constructor(private readonly pool: Pool) {}

  async insert(ko: KnowledgeObject): Promise<void> {
    await this.pool.query("INSERT INTO kos(id,type,status,category,data) VALUES($1,$2,$3,$4,$5)", [
      ko.id,
      ko.type,
      ko.status,
      ko.category,
      JSON.stringify(ko),
    ]);
  }

  async findById(id: string): Promise<KnowledgeObject | undefined> {
    const res = await this.pool.query<DataRow>("SELECT data FROM kos WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(ko: KnowledgeObject): Promise<void> {
    await this.pool.query("UPDATE kos SET type=$2,status=$3,category=$4,data=$5 WHERE id=$1", [
      ko.id,
      ko.type,
      ko.status,
      ko.category,
      JSON.stringify(ko),
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM kos WHERE id=$1", [id]);
  }

  async list(filter: KoFilter): Promise<KnowledgeObject[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.type) {
      params.push(filter.type);
      clauses.push(`type=$${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      clauses.push(`status=$${params.length}`);
    }
    if (filter.category) {
      params.push(filter.category);
      clauses.push(`category=$${params.length}`);
    }
    if (filter.tag) {
      // Containment auf dem JSONB-Tag-Array (eindeutig, kein Platzhalter-Konflikt mit `?`).
      params.push(JSON.stringify([filter.tag]));
      clauses.push(`data->'tags' @> $${params.length}::jsonb`);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
    const res = await this.pool.query<DataRow>(`SELECT data FROM kos${where}`, params);
    return res.rows.map((row) => row.data);
  }
}
