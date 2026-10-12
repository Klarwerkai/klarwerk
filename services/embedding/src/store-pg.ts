// ================================================================================================
// R-0470 (Aufnahme gesamt-suchindex-aktualitaet) — DER DAUERHAFTE VEKTORSPEICHER.
// ================================================================================================
//
// Ownerentscheidung J08: „Warteschlange + dauerhaft + entfernen". Der In-Memory-Speicher verlor
// seinen Inhalt bei jedem Neustart; dieser Adapter hält die Vektoren in DERSELBEN Datenbank wie der
// Bestand (eine Kundeninstanz = ein Datenraum) und überlebt Neustart und Deploy.
//
// BAUFORM, bewusst schlicht: ein Vektor je Wissensobjekt als `double precision[]`, ohne pgvector.
// Die Erweiterung ist auf dieser Instanz nicht zugesagt, und der Vorfilter ist hinter einem
// Schalter. Die Nachbarsuche liest die Vektoren DER angefragten Version und rechnet mit derselben
// Funktion wie der Speicheradapter (`naechsteNachbarn`) — gleiche Eingabe, gleiche Antwort. Der
// Aufwand wächst mit dem Bestand; ein Index über pgvector wäre der nächste Schritt, nicht dieser.
//
// `stand` ist der Fingerabdruck des eingebetteten Texts (Prüfsumme, KEIN Inhalt). An ihm erkennt die
// Nachführung nach einem Neustart, welche Vektoren nicht mehr zum Objekt passen.
import type { Pool } from "pg";
import { type EmbeddingStore, type NearestHit, naechsteNachbarn } from "./store";

/**
 * Eine Zeile je Wissensobjekt. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein
 * DROP, kein Fremdschlüssel, keine Extension, kein Seed. Die Endlöschung eines Objekts entfernt
 * seine Zeile (Kaskadenlöschung über `removeKoFromDuplicatePrefilter`).
 */
export const EMBEDDING_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_embeddings (
  ko_id text PRIMARY KEY,
  embedding_version text NOT NULL,
  dim integer NOT NULL,
  vektor double precision[] NOT NULL,
  stand text,
  geaendert_am timestamptz NOT NULL DEFAULT now()
);
`;

export class PgEmbeddingStore implements EmbeddingStore {
  constructor(private readonly pool: Pool) {}

  // B5 wie im Speicheradapter: ein Vektor fremder Version oder Dimension wird abgewiesen, statt den
  // Bestand still zu mischen. Massstab ist der übrige Bestand — ein leerer Speicher nimmt jede
  // erste Ablage an (der Speicheradapter merkt sich die Version auch über ein Löschen hinweg; hier
  // gibt es dafür keine Zeile, und eine erfundene wäre die schlechtere Wahrheit).
  async upsert(
    id: string,
    vector: readonly number[],
    embeddingVersion: string,
    stand?: string,
  ): Promise<void> {
    if (vector.length === 0) {
      throw new Error("upsert: Vektor darf nicht leer sein");
    }
    const aktiv = await this.pool.query<{ embedding_version: string; dim: number }>(
      "SELECT embedding_version, dim FROM ko_embeddings WHERE ko_id <> $1 LIMIT 1",
      [id],
    );
    const vorhanden = aktiv.rows[0];
    if (vorhanden && vorhanden.embedding_version !== embeddingVersion) {
      throw new Error(
        `upsert: embeddingVersion ${embeddingVersion} ≠ aktive ${vorhanden.embedding_version} — kein Mischen inkompatibler Vektoren (Versionswechsel = bewusster Re-Index).`,
      );
    }
    if (vorhanden && vorhanden.dim !== vector.length) {
      throw new Error(
        `upsert: Dimension ${vector.length} ≠ aktive ${vorhanden.dim} (Version ${embeddingVersion})`,
      );
    }
    await this.pool.query(
      `INSERT INTO ko_embeddings (ko_id, embedding_version, dim, vektor, stand, geaendert_am)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (ko_id) DO UPDATE SET embedding_version = EXCLUDED.embedding_version,
         dim = EXCLUDED.dim, vektor = EXCLUDED.vektor, stand = EXCLUDED.stand,
         geaendert_am = EXCLUDED.geaendert_am`,
      [id, embeddingVersion, vector.length, [...vector], stand ?? null],
    );
  }

  async nearest(
    query: readonly number[],
    embeddingVersion: string,
    topK: number,
    excludeId?: string,
  ): Promise<NearestHit[]> {
    if (topK <= 0) {
      return [];
    }
    const res = await this.pool.query<{ ko_id: string; vektor: number[] }>(
      "SELECT ko_id, vektor FROM ko_embeddings WHERE embedding_version = $1",
      [embeddingVersion],
    );
    return naechsteNachbarn(
      res.rows.map((z) => ({ id: z.ko_id, vector: z.vektor.map(Number), embeddingVersion })),
      query,
      embeddingVersion,
      topK,
      excludeId,
    );
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM ko_embeddings WHERE ko_id = $1", [id]);
  }

  async standVon(id: string): Promise<string | null | undefined> {
    const res = await this.pool.query<{ stand: string | null }>(
      "SELECT stand FROM ko_embeddings WHERE ko_id = $1",
      [id],
    );
    const zeile = res.rows[0];
    return zeile === undefined ? undefined : zeile.stand;
  }

  async staende(): Promise<Map<string, string | null>> {
    const res = await this.pool.query<{ ko_id: string; stand: string | null }>(
      "SELECT ko_id, stand FROM ko_embeddings",
    );
    return new Map(res.rows.map((z) => [z.ko_id, z.stand]));
  }
}
