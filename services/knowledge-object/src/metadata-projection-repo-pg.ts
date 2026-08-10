import type { Pool } from "pg";
import type { KoMetadataProjection } from "./metadata-projection";
import type {
  KoMetadataProjectionRepo,
  KoMetadataProjectionResult,
  KoMetadataProjectionUpsert,
} from "./metadata-projection-repo";

// ================================================================================================
// G27 WELLE 1 / S2 — DIE ADDITIVE MIGRATION DER METADATENPROJEKTION
// ================================================================================================
//
// EIGENE TABELLE, weil der Schlüssel ein anderer ist: die Content Projection gehört zu
// (ko_id, ko_version), diese Zeile zu `ko_id`. Zwei Schlüssel in einer Tabelle wären entweder eine
// Zeile zu viel je Version (veraltende Kopien) oder eine Zeile zu wenig je Objekt.
//
// ADDITIV im strengen Sinn: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS. Kein ALTER an
// bestehenden Tabellen, kein DROP, keine Änderung am KO-Datenmodell. Wiederholbar; nimmt nichts weg.
//
// DIE INDIZES, jeder einzeln begründet:
//  · PRIMARY KEY (ko_id) — genau EINE aktuelle Zeile je Objekt, von der Datenbank erzwungen, und
//    zugleich der Punkt-Nachschlag der Zusammensetzung.
//  · GIN-Trigramm auf category_text UND tag_text — anders als in Fassung 1 sind diese beiden Texte
//    NICHT mehr Teil von `search_text`; sie sind jetzt ein eigenständiger Sucheinstieg. Ohne die
//    beiden Indizes wäre eine Kategorie-/Schlagwortsuche ein sequenzieller Scan. pg_trgm existiert
//    bereits (KO_SCHEMA legt die Extension an und läuft davor).
//
// `metadata_revision` ist `bigint`: sie klettert bei jeder wirksamen Metadatenänderung und wird nie
// zurückgesetzt — ein 32-Bit-Zähler wäre eine Grenze ohne Not.
export const KO_METADATA_PROJECTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_metadata_projections (
  ko_id text PRIMARY KEY,
  category_text text NOT NULL,
  tag_text text NOT NULL,
  metadata_revision bigint NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ko_metadata_projections_category_trgm
  ON ko_metadata_projections USING gin (category_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ko_metadata_projections_tag_trgm
  ON ko_metadata_projections USING gin (tag_text gin_trgm_ops);
`;

interface MetadataRow {
  ko_id: string;
  category_text: string;
  tag_text: string;
  metadata_revision: string | number;
  updated_at: string;
}

const SPALTEN = "ko_id,category_text,tag_text,metadata_revision,updated_at";

// `bigint` kommt aus dem pg-Treiber als String (kein stiller Genauigkeitsverlust) — die Umrechnung
// steht deshalb an EINER Stelle und nicht verstreut in den Aufrufern.
function ausZeile(row: MetadataRow): KoMetadataProjection {
  return {
    koId: row.ko_id,
    categoryText: row.category_text,
    tagText: row.tag_text,
    metadataRevision: Number(row.metadata_revision),
    updatedAt: row.updated_at,
  };
}

export class PgKoMetadataProjectionRepo implements KoMetadataProjectionRepo {
  constructor(private readonly pool: Pool) {}

  /**
   * DER IDEMPOTENZ- UND MONOTONIEVERTRAG, in EINEM Statement.
   *
   * Der bedingte `DO UPDATE ... WHERE` ist der Kern: die Datenbank selbst entscheidet, ob sich
   * fachlich etwas geändert hat. Ist der Stand identisch, greift die Bedingung nicht, es wird keine
   * Zeile zurückgegeben — und `metadata_revision` bleibt stehen. Ein Anwendungscode, der erst liest,
   * vergleicht und dann schreibt, hätte an dieser Stelle ein Fenster, in dem zwei gleichzeitige
   * Wiederholungen desselben Updates die Revision zweimal hochzählen.
   *
   * Der vorgelagerte SELECT liefert ausschließlich das Audit-„vorher". Er ist bewusst NICHT die
   * Entscheidungsgrundlage des Schreibens (das entscheidet das Statement selbst); im Prozess ist der
   * Ablauf zusätzlich per KO-Lock serialisiert.
   */
  async upsert(input: KoMetadataProjectionUpsert): Promise<KoMetadataProjectionResult> {
    const previous = await this.find(input.koId);
    const res = await this.pool.query<MetadataRow>(
      `INSERT INTO ko_metadata_projections(${SPALTEN}) VALUES($1,$2,$3,1,$4)
       ON CONFLICT (ko_id) DO UPDATE SET
         category_text = EXCLUDED.category_text,
         tag_text = EXCLUDED.tag_text,
         metadata_revision = ko_metadata_projections.metadata_revision + 1,
         updated_at = EXCLUDED.updated_at
       WHERE ko_metadata_projections.category_text IS DISTINCT FROM EXCLUDED.category_text
          OR ko_metadata_projections.tag_text IS DISTINCT FROM EXCLUDED.tag_text
       RETURNING ${SPALTEN}`,
      [input.koId, input.categoryText, input.tagText, input.at],
    );
    const row = res.rows[0];
    if (!row) {
      // Keine Zeile zurück = die Bedingung griff nicht = fachlich identischer Stand. Der Speicher
      // hat also NICHTS getan, und genau das wird ehrlich gemeldet.
      const unveraendert = previous ?? (await this.find(input.koId));
      return {
        projection: unveraendert ?? {
          koId: input.koId,
          categoryText: input.categoryText,
          tagText: input.tagText,
          metadataRevision: 1,
          updatedAt: input.at,
        },
        previous,
        changed: false,
      };
    }
    return { projection: ausZeile(row), previous, changed: true };
  }

  async find(koId: string): Promise<KoMetadataProjection | undefined> {
    const res = await this.pool.query<MetadataRow>(
      `SELECT ${SPALTEN} FROM ko_metadata_projections WHERE ko_id=$1`,
      [koId],
    );
    const row = res.rows[0];
    return row ? ausZeile(row) : undefined;
  }

  async findMany(koIds: readonly string[]): Promise<KoMetadataProjection[]> {
    if (koIds.length === 0) {
      return [];
    }
    const res = await this.pool.query<MetadataRow>(
      `SELECT ${SPALTEN} FROM ko_metadata_projections WHERE ko_id = ANY($1::text[])`,
      [[...new Set(koIds)]],
    );
    return res.rows.map(ausZeile);
  }

  async remove(koId: string): Promise<void> {
    await this.pool.query("DELETE FROM ko_metadata_projections WHERE ko_id=$1", [koId]);
  }

  async count(): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM ko_metadata_projections",
    );
    return Number(res.rows[0]?.n ?? 0);
  }
}
