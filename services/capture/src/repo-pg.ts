import type { Pool } from "pg";
import type { DraftAnlageErgebnis, DraftRepo } from "./repo";
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

// ================================================================================================
// JOB 2697 — DER DAUERHAFTE SITZ DER EINDEUTIGKEIT EINES ANLAGE-VORGANGS.
// ================================================================================================
//
// DAS MUSTER IST ÜBERNOMMEN, NICHT ERFUNDEN: jsonb-Vollobjekt plus Generated-Spalten plus
// partieller Unique-Index — genau wie `KO_CREATE_OPERATION_SCHEMA`
// (`services/knowledge-object/src/repo-pg.ts:114-124`). Eine Anwendungsprüfung behauptet
// Eindeutigkeit; ein Index erzwingt sie, auch über zwei Serverinstanzen und über einen Neustart.
//
// `COALESCE(create_operation_actor, '')` IST KEIN ZIERRAT. In einem Unique-Index hält PostgreSQL
// zwei NULL-Werte für VERSCHIEDEN. Ohne `COALESCE` wären zwei Zeilen mit gleicher Kennung und
// fehlendem Eigentümer beide erlaubt — die Zusage wäre still gebrochen. Der Ausdruck im Index muss
// zeichengleich dem im `ON CONFLICT` sein, sonst greift die Konfliktklausel nicht.
//
// DER INDEX IST PARTIELL (`WHERE create_operation_id IS NOT NULL`): Entwürfe ohne Vorgang — also
// jeder heutige Bestand und jeder Aufruf über den unveränderten Pfad — fallen heraus und
// kollidieren nie.
//
// KEIN `DROP INDEX`, anders als beim Wissensobjekt. Dort musste ein alter, DB-weiter Index
// weichen; für `drafts` gibt es keinen. Die Stufe ist rein ADDITIV: nur `ADD COLUMN IF NOT EXISTS`
// und `CREATE UNIQUE INDEX IF NOT EXISTS`, kein DROP, kein DELETE, kein UPDATE an Bestandsdaten.
// Die Datenmigration ist LEER — kein vorhandener Entwurf trägt `createOperation`.
//
// EIGENE STUFE STATT ERWEITERUNG VON `CAPTURE_SCHEMA`, und eine benannte Falle dazu: Der
// Migrationswächter sammelt `*_SCHEMA`-Konstanten; diese hier trägt kein `CREATE TABLE`. Sie
// braucht deshalb einen eigenen Pin, sonst fällt sie geräuschlos aus der Migrationsprüfung —
// beim Wissensobjekt ist das T-M-3.
//
// UNBEWIESENE HYPOTHESE, ehrlich benannt: dass PostgreSQL diese DDL annimmt, ist in dieser
// Umgebung nicht geprüft — es läuft hier keine Datenbank (Befund samt Fehlertexten in der
// Rückgabe D7). Belegt ist, was der Adapter absetzt und wie er sich bei Konflikt verhält.
export const CAPTURE_CREATE_OPERATION_SCHEMA = `
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS create_operation_id text
  GENERATED ALWAYS AS (data->'createOperation'->>'id') STORED;
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS create_operation_actor text
  GENERATED ALWAYS AS (data->'createOperation'->>'actor') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS drafts_create_operation_owner_uq
  ON drafts (create_operation_id, COALESCE(create_operation_actor, ''))
  WHERE create_operation_id IS NOT NULL;
`;

// KEINE eigene Konstante für den Constraint-Namen, anders als beim Wissensobjekt
// (`KO_CREATE_OPERATION_CONSTRAINT`, `knowledge-object/src/repo-pg.ts:130`): Dort wird sie
// gebraucht, weil `insert` die Unique-Verletzung am NAMEN erkennt und in einen Domänenfehler
// übersetzt. Hier fängt `ON CONFLICT DO NOTHING` die Kollision, bevor ein Fehler entsteht — der
// Name käme in keiner einzigen Zeile Code vor. Ein Export ohne Aufrufer ist genau das, was
// `tests/capture/aufrufer-waechter.test.ts` verhindert.

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

  /**
   * JOB 2697 — die Postgres-Hälfte: EIN Konfliktweg, danach die Nachlese über DASSELBE Paar.
   *
   * `ON CONFLICT ... DO NOTHING` gegen den partiellen Unique-Index: greift der Index, kommt keine
   * Zeile zurück — und erst dann wird nachgeschlagen. Kein „erst suchen, dann einfügen", in das
   * zwei gleichzeitige Klicks fallen könnten.
   *
   * DIE ABWEICHUNG VOM KO-MUSTER, ausdrücklich benannt — sie ist der wichtigste Einzelpunkt hier:
   * Der KO-Nachschlag trägt einen Zweig `OR create_operation_actor IS NULL`
   * (`knowledge-object/src/repo-pg.ts:269`). Er existiert dort nur wegen der mega20-Altzeilen.
   * FÜR `drafts` GIBT ES DIESEN ALTBESTAND NICHT — der Zweig wäre hier keine Rücksicht, sondern
   * eine Lücke: er fände eine Zeile mit fehlendem Eigentümer und gäbe sie einem beliebigen
   * Anfragenden zurück. Wer das KO-Muster blind kopiert, kopiert die Altlast mit.
   */
  async insertIfOperationAbsent(draft: Draft): Promise<DraftAnlageErgebnis> {
    if (!draft.createOperation) {
      await this.insert(draft);
      return { angelegt: true, draft };
    }
    const angelegt = await this.pool.query<DraftRow>(
      `INSERT INTO drafts(id,data) VALUES($1,$2::jsonb)
       ON CONFLICT (create_operation_id, COALESCE(create_operation_actor, ''))
       WHERE create_operation_id IS NOT NULL
       DO NOTHING RETURNING data`,
      [draft.id, JSON.stringify(draft)],
    );
    if ((angelegt.rowCount ?? 0) > 0) {
      return { angelegt: true, draft: angelegt.rows[0]?.data ?? draft };
    }
    const bestehend = await this.pool.query<DraftRow>(
      `SELECT data FROM drafts
        WHERE create_operation_id = $1
          AND COALESCE(create_operation_actor, '') = $2
        LIMIT 1`,
      [draft.createOperation.id, draft.createOperation.actor],
    );
    const treffer = bestehend.rows[0]?.data;
    if (!treffer) {
      // Der Vorgang ist zwischen Konflikt und Nachlese verschwunden (gelöscht). Ehrlich: dann gibt
      // es nichts zurückzugeben — der Aufrufer bekommt seinen eigenen Datensatz, ohne dass eine
      // fremde Zeile erfunden wird.
      return { angelegt: true, draft };
    }
    return { angelegt: false, bestehend: treffer };
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
