import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type { AssignmentRepo, RatingRepo } from "./repo";
import type { Assignment, Rating } from "./types";

export const VALIDATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS ratings (
  ko_id text NOT NULL,
  user_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (ko_id, user_id)
);
CREATE TABLE IF NOT EXISTS assignments (
  ko_id text NOT NULL,
  user_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (ko_id, user_id)
);
`;

interface RatingRow {
  data: Rating;
}
interface AssignmentRow {
  data: Assignment;
}

// Aufnahme gesamt-auditprotokoll (Lauf 3, Runde 2): mit `tx` laufen die Schreibwege auf dem
// Transaktionsclient der Validierung (`KoService.setValidationStateMitBeleg`) — Bewertung,
// Zuweisungsstatus, Validierungszustand und Entscheidungsbeleg committen gemeinsam oder gar nicht.
function ziel(pool: Pool, tx?: TxContext): Queryable {
  return tx ? pgQueryable(tx) : poolQueryable(pool);
}

export class PgRatingRepo implements RatingRepo {
  constructor(private readonly pool: Pool) {}

  async upsert(rating: Rating, tx?: TxContext): Promise<void> {
    await ziel(this.pool, tx).query(
      "INSERT INTO ratings(ko_id,user_id,data) VALUES($1,$2,$3) ON CONFLICT (ko_id,user_id) DO UPDATE SET data=excluded.data",
      [rating.koId, rating.userId, JSON.stringify(rating)],
    );
  }

  async remove(koId: string, userId: string): Promise<void> {
    await this.pool.query("DELETE FROM ratings WHERE ko_id=$1 AND user_id=$2", [koId, userId]);
  }

  async listByKo(koId: string): Promise<Rating[]> {
    const res = await this.pool.query<RatingRow>("SELECT data FROM ratings WHERE ko_id=$1", [koId]);
    return res.rows.map((row) => row.data);
  }

  /**
   * JOB 3043: EINE Anweisung fuer die ganze Menge — ausdruecklich keine Schleife ueber `listByKo`.
   * Eine Schleife saehe hier wie eine Mengenabfrage aus und waere im Betrieb wieder das N+1, das
   * dieser Weg abloest; die Zusage des Aufrufers („zwei Abfragen insgesamt") haengt an dieser Zeile.
   *
   * Die leere Kennungsliste geht GAR NICHT ans SQL: `= ANY('{}')` trifft nie eine Zeile, und eine
   * Abfrage, deren Ergebnis feststeht, ist reine Last.
   */
  async listByKos(koIds: readonly string[]): Promise<Rating[]> {
    if (koIds.length === 0) {
      return [];
    }
    const res = await this.pool.query<RatingRow>("SELECT data FROM ratings WHERE ko_id = ANY($1)", [
      [...koIds],
    ]);
    return res.rows.map((row) => row.data);
  }
}

export class PgAssignmentRepo implements AssignmentRepo {
  constructor(private readonly pool: Pool) {}

  async create(assignment: Assignment, tx?: TxContext): Promise<void> {
    await ziel(this.pool, tx).query(
      "INSERT INTO assignments(ko_id,user_id,data) VALUES($1,$2,$3) ON CONFLICT (ko_id,user_id) DO UPDATE SET data=excluded.data",
      [assignment.koId, assignment.userId, JSON.stringify(assignment)],
    );
  }

  async find(koId: string, userId: string, tx?: TxContext): Promise<Assignment | undefined> {
    const res = await ziel(this.pool, tx).query<AssignmentRow>(
      "SELECT data FROM assignments WHERE ko_id=$1 AND user_id=$2",
      [koId, userId],
    );
    return res.rows[0]?.data;
  }

  async update(assignment: Assignment, tx?: TxContext): Promise<void> {
    await ziel(this.pool, tx).query(
      "UPDATE assignments SET data=$3 WHERE ko_id=$1 AND user_id=$2",
      [assignment.koId, assignment.userId, JSON.stringify(assignment)],
    );
  }

  async remove(koId: string, userId: string): Promise<void> {
    await this.pool.query("DELETE FROM assignments WHERE ko_id=$1 AND user_id=$2", [koId, userId]);
  }

  async all(): Promise<Assignment[]> {
    const res = await this.pool.query<AssignmentRow>("SELECT data FROM assignments");
    return res.rows.map((row) => row.data);
  }

  // ADMIN-09: EINE Anweisung — der Primärschlüssel entscheidet, wer anlegt; ein Zweiter überschreibt
  // nichts (anders als `create`, das bei Konflikt ersetzt).
  async createIfAbsent(assignment: Assignment): Promise<boolean> {
    const res = await this.pool.query(
      "INSERT INTO assignments(ko_id,user_id,data) VALUES($1,$2,$3) ON CONFLICT (ko_id,user_id) DO NOTHING",
      [assignment.koId, assignment.userId, JSON.stringify(assignment)],
    );
    return (res.rowCount ?? 0) === 1;
  }

  // ADMIN-09: Compare-and-Set über den ganzen Datensatz (jsonb-Gleichheit, unabhängig von der
  // Feldreihenfolge) — nur wer den Stand `alt` noch vorfindet, ersetzt ihn.
  async replaceIf(alt: Assignment, neu: Assignment): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE assignments SET data=$4 WHERE ko_id=$1 AND user_id=$2 AND data=$3::jsonb",
      [alt.koId, alt.userId, JSON.stringify(alt), JSON.stringify(neu)],
    );
    return (res.rowCount ?? 0) === 1;
  }

  // PRÜFSTATUS-ANZEIGE (R-1524): gezielt über die Schlüsselspalte `ko_id` (Teil des Primärschlüssels
  // `(ko_id,user_id)`, s. `create`) statt des Vollscans von `all()`. Leere Eingabe fragt nicht.
  async listByKos(koIds: readonly string[]): Promise<Assignment[]> {
    if (koIds.length === 0) {
      return [];
    }
    const res = await this.pool.query<AssignmentRow>(
      "SELECT data FROM assignments WHERE ko_id = ANY($1)",
      [[...koIds]],
    );
    return res.rows.map((row) => row.data);
  }
}
