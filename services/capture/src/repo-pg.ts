import type { Pool } from "pg";
import type { DraftRepo } from "./repo";
import type { Draft } from "./types";

export const CAPTURE_SCHEMA = `
CREATE TABLE IF NOT EXISTS drafts (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
-- JOB 2696 (Review-Befund R2-33): Index auf dem AUSDRUCK, nach dem die Entwurfsliste filtert.
-- ADDITIV und idempotent (IF NOT EXISTS) — die Tabelle bleibt unberuehrt, es kommt nur ein Index
-- dazu. Ohne ihn waere listByAuthor zwar sparsam an Bytes, aber weiterhin ein Tabellendurchlauf:
-- PostgreSQL muesste jede Zeile anfassen, um den Ausdruck erst zu berechnen.
-- (Keine schraegen Anfuehrungszeichen in diesem Block: er steht in einem Template-Literal und
--  wuerde es sonst beenden.)
CREATE INDEX IF NOT EXISTS drafts_original_author_idx
  ON drafts ((data->>'originalAuthor'));
`;

interface DraftRow {
  data: Draft;
}

/** JOB 2684 D3: die Schreibanweisung mit Standbedingung — exportiert, damit ein Test sie pinnt. */
export const DRAFT_UPDATE_WENN_STAND_SQL =
  "UPDATE drafts SET data=$2 WHERE id=$1 AND data->>'updatedAt' = $3";

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

  // JOB 2684 D3 (R2-17): DER COMPARE-AND-SWAP IN DER ABFRAGE. Die Bedingung steht im `WHERE`
  // derselben Anweisung, die schreibt — Postgres prüft und schreibt in EINEM Schritt, es gibt kein
  // Fenster zwischen Lesen und Schreiben, und es gibt keinen Prozess, der das umgehen könnte:
  // zwei Serverprozesse mit demselben gelesenen Stand → genau einer trifft `rowCount 1`, der andere
  // `0`. Der Vergleich läuft auf `data->>'updatedAt'` (Text, streng steigend seit D1) — keine
  // eigene Spalte, keine Migration; die Tabelle bleibt wie sie ist.
  async updateWennStand(draft: Draft, erwarteterStand: string): Promise<boolean> {
    const res = await this.pool.query(DRAFT_UPDATE_WENN_STAND_SQL, [
      draft.id,
      JSON.stringify(draft),
      erwarteterStand,
    ]);
    return res.rowCount === 1;
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

  // JOB 2696 (R2-33): dieselbe Abfrage, um EINE Bedingung erweitert — und genau die entscheidet,
  // ob 5 MiB fremder Entwuerfe ueber die Leitung gehen oder nicht. Die Sortierung bleibt wortgleich,
  // damit die Liste in derselben Reihenfolge steht wie bisher; der Ausdruck
  // `data->>'originalAuthor'` ist derselbe, auf dem `drafts_original_author_idx` liegt.
  async listByAuthor(authorId: string): Promise<Draft[]> {
    const res = await this.pool.query<DraftRow>(
      "SELECT data FROM drafts WHERE data->>'originalAuthor' = $1 ORDER BY data->>'createdAt'",
      [authorId],
    );
    return res.rows.map((row) => row.data);
  }
}
