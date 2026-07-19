import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type { EvidenceRepo, KoCandidateQuery, KoFilter, KoRepo, KoVersionRepo } from "./repo";
import {
  type EvidenceRecord,
  type KnowledgeObject,
  KoError,
  type KoVersionSnapshot,
} from "./types";

// SCRUM-362 / AG-03-DBINDEX: die Such-Ausdrücke des Ask-Prefilters (PgKoRepo.findCandidates) als EINE
// Quelle der Wahrheit. Query-Builder UND Indexdefinition leiten beide hieraus ab → Query-Shape und
// Index-Pfad bleiben garantiert deckungsgleich (kein Drift). Jeweils ein GIN-Trigramm-Index (pg_trgm)
// macht das `ILIKE '%term%'` (auch mit führendem Wildcard) indexierbar.
const KO_CANDIDATE_SEARCH: ReadonlyArray<{ index: string; expr: string }> = [
  { index: "idx_kos_title_trgm", expr: "data->>'title'" },
  { index: "idx_kos_statement_trgm", expr: "data->>'statement'" },
  { index: "idx_kos_category_trgm", expr: "data->>'category'" },
  { index: "idx_kos_tags_trgm", expr: "(data->'tags')::text" },
];

// Die reinen Such-Ausdrücke (für den Query-Builder + Tests, die Query↔Index-Deckung prüfen).
export const KO_CANDIDATE_SEARCH_EXPRESSIONS: readonly string[] = KO_CANDIDATE_SEARCH.map(
  (s) => s.expr,
);

// GIN-Trigramm-Index-DDL je Such-Ausdruck (idempotent, nicht destruktiv).
const KO_CANDIDATE_SEARCH_INDEX_DDL = KO_CANDIDATE_SEARCH.map(
  ({ index, expr }) =>
    `CREATE INDEX IF NOT EXISTS ${index} ON kos USING gin ((${expr}) gin_trgm_ops);`,
).join("\n");

// Postgres-Adapter für knowledge-object. Vollobjekt als JSONB; Filterspalten indiziert.
// SCRUM-362: pg_trgm + GIN-Trigramm-Indizes machen den Ask-Prefilter (ILIKE auf title/statement/
// category/tags) indexierbar. Alle Statements sind idempotent (IF NOT EXISTS) und nicht destruktiv;
// die bestehenden idx_kos_type/idx_kos_status bleiben unverändert.
export const KO_SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS kos (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL,
  category text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kos_type ON kos(type);
CREATE INDEX IF NOT EXISTS idx_kos_status ON kos(status);
${KO_CANDIDATE_SEARCH_INDEX_DDL}
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

  // SCRUM-509 R3: optimistische Concurrency auf DB-Ebene (Compare-and-Set auf der gespeicherten
  // rowVersion in `data`). Der Write greift NUR, wenn die gespeicherte rowVersion der vom Aufrufer
  // gelesenen entspricht; sonst rowCount 0 → STALE_WRITE (kein Überschreiben eines fremden Writes).
  // Alt-Zeilen ohne Feld → COALESCE 0. Bei Erfolg wird rowVersion monoton erhöht. Kein Row-Lock nötig:
  // der bedingte UPDATE ist selbst atomar.
  async update(ko: KnowledgeObject): Promise<void> {
    const expected = ko.rowVersion ?? 0;
    const next = JSON.stringify({ ...ko, rowVersion: expected + 1 });
    const res = await this.pool.query(
      "UPDATE kos SET type=$2,status=$3,category=$4,data=$5 WHERE id=$1 AND COALESCE((data->>'rowVersion')::int,0)=$6",
      [ko.id, ko.type, ko.status, ko.category, next, expected],
    );
    if (res.rowCount === 0) {
      throw new KoError("STALE_WRITE", "Nebenläufige Änderung — bitte erneut lesen und anwenden.");
    }
  }

  // SCRUM-523 P.3 (WP-A2): ohne tx die normale Pool-Query (heutiges Verhalten); MIT tx (vom Aufrufer
  // aus derselben withPgTx-Klammer wie z. B. PgAuditRepo.append) läuft die Query auf demselben Client
  // — damit committen/rollbacken beide Schreiber ATOMAR zusammen (services/db-tx).
  async delete(id: string, tx?: TxContext): Promise<void> {
    const queryable: Queryable = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    await queryable.query("DELETE FROM kos WHERE id=$1", [id]);
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

  // SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: datenquellennahe Kandidaten-Vorauswahl für Ask.
  // Statt alle KOs zu laden, filtert die DB ODER-weise über die (bereits tokenisierten) Inhalts-Terme
  // auf den vorhandenen Feldern (title/statement/category/tags) — vollständig PARAMETRISIERT (kein
  // SQL-Injection-Risiko; die Terme sind reine Inhaltstoken ohne Wildcards). Reihenfolge: validierte
  // KOs zuerst, dann höherer Trust → relevante validierte Treffer bleiben unter dem LIMIT erhalten.
  // KEINE Volltext-Engine, KEINE Embeddings, KEINE Migration: nur ILIKE/JSONB auf vorhandenen Spalten.
  // Die feine Relevanz-/Status-/Trust-Endsortierung übernimmt der Reasoner (`selectCandidates`).
  async findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
    const terms = query.terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
    if (terms.length === 0) {
      return [];
    }
    const limit = Math.max(0, Math.floor(query.limit));
    const params: unknown[] = [];
    const ors: string[] = [];
    for (const term of terms) {
      params.push(`%${term}%`);
      const p = `$${params.length}`;
      // SCRUM-362: ODER-Treffer über GENAU die Ausdrücke, für die GIN-Trigramm-Indizes existieren
      // (KO_CANDIDATE_SEARCH_EXPRESSIONS) → jedes `<expr> ILIKE $p` ist über den passenden Index
      // bedienbar. Ein Term genügt; Teilstring-Match über Titel/Aussage/Kategorie/Tags(JSONB-Text).
      const clause = KO_CANDIDATE_SEARCH_EXPRESSIONS.map((expr) => `${expr} ILIKE ${p}`).join(
        " OR ",
      );
      ors.push(`(${clause})`);
    }
    params.push(limit);
    const limitP = `$${params.length}`;
    // ORDER BY: validierte zuerst, dann Trust absteigend (NULLS LAST schützt vor fehlendem Trust-
    // Feld); harte Begrenzung über LIMIT. Alle Werte sind Parameter, kein eingebetteter Term.
    const sql = `SELECT data FROM kos WHERE ${ors.join(" OR ")} ORDER BY (status='validiert') DESC, (data->>'trust')::int DESC NULLS LAST LIMIT ${limitP}`;
    const res = await this.pool.query<DataRow>(sql, params);
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

  // SCRUM-507 R3: kompensierender Rollback eines noch nicht committeten Snapshots (s. KoVersionRepo).
  async remove(koId: string, version: number): Promise<void> {
    await this.pool.query("DELETE FROM ko_versions WHERE ko_id=$1 AND version=$2", [koId, version]);
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
