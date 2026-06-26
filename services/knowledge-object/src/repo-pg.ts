import type { Pool } from "pg";
import type { EvidenceRepo, KoFilter, KoRepo, KoVersionRepo } from "./repo";
import type { EvidenceRecord, KnowledgeObject, KoVersionSnapshot } from "./types";

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

// SCRUM-159: unveränderliche KO-Version-Snapshots. PK (ko_id, version) + ON CONFLICT DO NOTHING
// garantieren, dass eine einmal geschriebene Version nie überschrieben wird.
export const KO_VERSIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_versions (
  ko_id text NOT NULL,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  at text NOT NULL,
  author text NOT NULL,
  note text NOT NULL,
  PRIMARY KEY (ko_id, version)
);
`;

// SCRUM-160: Evidence-Records für Quellen/Anhänge, separat vom KO-JSON.
export const KO_EVIDENCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_evidence (
  id text PRIMARY KEY,
  ko_id text NOT NULL,
  ko_version int NOT NULL,
  kind text NOT NULL,
  data jsonb NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ko_evidence_ko_id ON ko_evidence(ko_id);
CREATE INDEX IF NOT EXISTS idx_ko_evidence_kind ON ko_evidence(kind);
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

interface SnapshotRow {
  snapshot: KnowledgeObject;
  version: number;
  at: string;
  author: string;
  note: string;
}

// SCRUM-159: Postgres-Adapter der KO-Version-Snapshots (append-only, nie überschreibend).
export class PgKoVersionRepo implements KoVersionRepo {
  constructor(private readonly pool: Pool) {}

  async append(snapshot: KoVersionSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO ko_versions(ko_id,version,snapshot,at,author,note)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (ko_id, version) DO NOTHING`,
      [
        snapshot.koId,
        snapshot.version,
        JSON.stringify(snapshot.snapshot),
        snapshot.at,
        snapshot.author,
        snapshot.note,
      ],
    );
  }

  async listByKo(koId: string): Promise<KoVersionSnapshot[]> {
    const res = await this.pool.query<SnapshotRow>(
      "SELECT snapshot,version,at,author,note FROM ko_versions WHERE ko_id=$1 ORDER BY version",
      [koId],
    );
    return res.rows.map((row) => ({
      koId,
      version: row.version,
      snapshot: row.snapshot,
      at: row.at,
      author: row.author,
      note: row.note,
    }));
  }
}

interface EvidenceRow {
  data: EvidenceRecord;
}

// SCRUM-160: Postgres-Adapter der Evidence-Records (append-only, nie überschreibend).
export class PgEvidenceRepo implements EvidenceRepo {
  constructor(private readonly pool: Pool) {}

  async append(record: EvidenceRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ko_evidence(id,ko_id,ko_version,kind,data,created_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [
        record.id,
        record.koId,
        record.koVersion,
        record.kind,
        JSON.stringify(record),
        record.createdAt,
      ],
    );
  }

  async listByKo(koId: string): Promise<EvidenceRecord[]> {
    const res = await this.pool.query<EvidenceRow>(
      "SELECT data FROM ko_evidence WHERE ko_id=$1 ORDER BY created_at,id",
      [koId],
    );
    return res.rows.map((row) => row.data);
  }

  // SCRUM-169: jüngste Evidence über alle KOs (read-only, defensiv limitiert).
  async recent(limit: number): Promise<EvidenceRecord[]> {
    const res = await this.pool.query<EvidenceRow>(
      "SELECT data FROM ko_evidence ORDER BY created_at DESC,id DESC LIMIT $1",
      [Math.max(0, limit)],
    );
    return res.rows.map((row) => row.data);
  }
}
