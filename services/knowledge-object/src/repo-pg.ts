import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type { EvidenceRepo, KoCandidateQuery, KoFilter, KoRepo, KoVersionRepo } from "./repo";
import {
  type AiCheck,
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
  // WP-RETEST7 R5: der Fragen-Prefilter matcht auch die persistierten Bild-Fußnoten
  // (captionTexts-Suchfeld, WP-BILD-1g) — gleicher ILIKE-/GIN-Trigramm-Weg, kein bodyHtml.
  { index: "idx_kos_captions_trgm", expr: "(data->'captionTexts')::text" },
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

// WP-SHIP8-CLOSE-4 (bens ROT-1B): DB-erzwungener Idempotenzanker des Import-Accepts — als EIGENE,
// ADDITIVE Migrationsstufe NACH KO_SCHEMA (KO_SCHEMA selbst bleibt per Test gepinnt frei von
// ALTER-Statements; ADD COLUMN IF NOT EXISTS ist additiv und idempotent, nichts wird entfernt).
// Generated-Spalte + partieller UNIQUE-Index: höchstens EIN KO je Import-Kandidat — BEWUSST OHNE
// deletedAt-Ausschluss (auch ein getrashtes KO hält seinen Anker; der Recovery-Vertrag adoptiert
// es statt ein zweites anzulegen). Ein später Insert eines abgelösten Laufs kollidiert hier hart
// und wird vom Accept-Pfad zur idempotenten Adoption statt zum Doppel-KO.
export const KO_IMPORT_ANCHOR_SCHEMA = `
ALTER TABLE kos
  ADD COLUMN IF NOT EXISTS import_candidate_id text
  GENERATED ALWAYS AS (data->>'importCandidateId') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS kos_import_candidate_uq
  ON kos (import_candidate_id)
  WHERE import_candidate_id IS NOT NULL;
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
  //
  // SCRUM-523 P.3 (WP-A3, externer Review): rowCount MUSS geprüft werden. Ein wiederholter/
  // konkurrierender Purge (KO bereits gelöscht) darf NIE als Erfolg durchgehen — sonst committet
  // purgeKo (service.ts) einen ko.purged-Beleg, obwohl 0 Zeilen gelöscht wurden ("Audit ohne echtes
  // Delete"). Bei 0 gelöschten Zeilen wirft delete() NOT_FOUND; innerhalb der withTx-Klammer von
  // purgeKo führt das zum ROLLBACK, bevor audit.record läuft — kein Geister-Beleg.
  async delete(id: string, tx?: TxContext): Promise<void> {
    const queryable: Queryable = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    const res = await queryable.query("DELETE FROM kos WHERE id=$1", [id]);
    if (res.rowCount === 0) {
      throw new KoError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
  }

  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): ATOMARER Trust-Inkrement direkt in der DB — LEAST deckelt
  // bei maxTrust, rowVersion klettert mit (schützt vor stillem Clobbern durch einen nebenläufigen
  // Voll-Write). KEIN Read-modify-write → zwei gleichzeitige Danke verschiedener Nutzer zählen BEIDE.
  // MIT tx (vom Aufrufer aus derselben withPgTx-Klammer wie PgAuditRepo.appendOnce) läuft der Inkrement
  // auf demselben Client → Audit-CAS und Trust committen/rollbacken ATOMAR zusammen (services/db-tx).
  // 0 betroffene Zeilen (KO fehlt/getrasht) → undefined; der Aufrufer rollt den gekoppelten Audit zurück.
  async bumpTrust(
    id: string,
    step: number,
    maxTrust: number,
    tx?: TxContext,
  ): Promise<number | undefined> {
    const queryable: Queryable = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    const res = await queryable.query<{ trust: number }>(
      `UPDATE kos
         SET data = jsonb_set(
           jsonb_set(data, '{trust}', to_jsonb(LEAST($3::int, COALESCE((data->>'trust')::int, 0) + $2::int))),
           '{rowVersion}', to_jsonb(COALESCE((data->>'rowVersion')::int, 0) + 1))
       WHERE id = $1 AND NOT (data ? 'deletedAt')
       RETURNING (data->>'trust')::int AS trust`,
      [id, step, maxTrust],
    );
    return res.rows[0]?.trust;
  }

  // Gemeinsamer Filterbau für list()/listForSearch() — identische WHERE-Logik, andere Projektion.
  private buildListFilter(filter: KoFilter): { where: string; params: unknown[] } {
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
    return { where: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "", params };
  }

  async list(filter: KoFilter): Promise<KnowledgeObject[]> {
    const { where, params } = this.buildListFilter(filter);
    const res = await this.pool.query<DataRow>(`SELECT data FROM kos${where}`, params);
    return res.rows.map((row) => row.data);
  }

  // WP-BILD-1g (bens sammel14-ROT): Suchpfad-Projektion AN DER DATENQUELLE — Postgres entfernt
  // bodyHtml (mit potenziell megabyte-großen base64-Bildern) bereits im SELECT; der Riesen-String
  // verlässt die Datenbank für die Suche gar nicht erst. Gleiche Filterlogik wie list().
  async listForSearch(filter: KoFilter): Promise<KnowledgeObject[]> {
    const { where, params } = this.buildListFilter(filter);
    const res = await this.pool.query<DataRow>(
      `SELECT data - 'bodyHtml' AS data FROM kos${where}`,
      params,
    );
    return res.rows.map((row) => row.data);
  }

  // WP-BILD-1g/1h: Backfill des ABGELEITETEN captionTexts-Suchfelds (Legacy-KOs). WP-BILD-1h
  // (bens sammel15-ROT 1): ATOMAR NUR-WENN-FELD-FEHLT — ein einziges bedingtes UPDATE, kein
  // Read-Modify-Write. Damit kann ein spät ankommender Backfill mit ALTEM Scan die frischen
  // captionTexts eines nebenläufigen revise (Voll-Write setzt das Feld immer) NIE clobbern:
  // der Voll-Write gewinnt per Konstruktion. Weiterhin ohne rowVersion-CAS/Version/Audit
  // (reiner Cache-Write eines abgeleiteten Felds).
  // WP-D11b (bens patches53-GELB): rowCount sagt ehrlich, ob DIESER Aufruf geschrieben hat —
  // 0 heißt: das Feld war schon da (nebenläufiger Voll-Write) und der Aufrufer lädt nach.
  async setAiCheck(id: string, aiCheck: AiCheck): Promise<boolean> {
    // WP-SUBMIT-ASYNC: schmaler Feld-Patch (nur aiCheck) auf einem existierenden, nicht
    // getrashten KO — kein Voll-Write, kein Versions-/Audit-Pfad (reiner Job-Status).
    const res = await this.pool.query(
      "UPDATE kos SET data = jsonb_set(data, '{aiCheck}', $2::jsonb) WHERE id=$1 AND NOT (data ? 'deletedAt')",
      [id, JSON.stringify(aiCheck)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async resolveAiCheck(
    id: string,
    patch: Omit<AiCheck, "requestedAt">,
    expectedKoVersion?: number,
  ): Promise<boolean> {
    // WP-SUBMIT-ASYNC: BEDINGT (CAS-schonend wie setCaptionTexts) — EIN UPDATE, nur wenn der
    // Status noch pending ist; der Merge (||) erhält requestedAt und patcht ausschließlich das
    // aiCheck-Feld. Ein nebenläufiger revise (Voll-Write) verliert dadurch nie Daten.
    // WP-SHIP8-FINAL (bens Bedingung 2): mit expectedKoVersion zusätzlich versionsgebunden —
    // der pending-Vermerk muss die Version tragen UND das KO muss noch auf ihr stehen ($3 NULL
    // = Bestandsverhalten fuer Altbestand/unbedingte Aufrufe).
    const res = await this.pool.query(
      `UPDATE kos SET data = jsonb_set(data, '{aiCheck}', (data->'aiCheck') || $2::jsonb)
       WHERE id=$1 AND data->'aiCheck'->>'status' = 'pending'
         AND ($3::int IS NULL OR (
           (data->'aiCheck'->>'koVersion')::int = $3::int AND (data->>'version')::int = $3::int
         ))`,
      [id, JSON.stringify(patch), expectedKoVersion ?? null],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async setCaptionTexts(id: string, captionTexts: string[]): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE kos SET data = jsonb_set(data, '{captionTexts}', $2::jsonb) WHERE id=$1 AND NOT (data ? 'captionTexts')",
      [id, JSON.stringify(captionTexts)],
    );
    return (res.rowCount ?? 0) > 0;
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
    // WP-SAMMEL21-FIX (bens Fix 3): DATENSPARENDE PROJEKTION wie listForSearch — bis zu 200
    // Kandidaten je Frage würden sonst ihr volles bodyHtml (potenziell megabyte-große base64-
    // Bilder) aus der DB ziehen. `data - 'bodyHtml'` entfernt es bereits im SELECT; Titel/
    // Statement/captionTexts (genau die Matching-/Antwortfelder des Ask-Pfads) bleiben drin.
    const sql = `SELECT data - 'bodyHtml' AS data FROM kos WHERE ${ors.join(" OR ")} ORDER BY (status='validiert') DESC, (data->>'trust')::int DESC NULLS LAST LIMIT ${limitP}`;
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
