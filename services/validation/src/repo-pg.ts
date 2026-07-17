import type { Pool } from "pg";
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

export class PgRatingRepo implements RatingRepo {
  constructor(private readonly pool: Pool) {}

  async upsert(rating: Rating): Promise<void> {
    await this.pool.query(
      "INSERT INTO ratings(ko_id,user_id,data) VALUES($1,$2,$3) ON CONFLICT (ko_id,user_id) DO UPDATE SET data=excluded.data",
      [rating.koId, rating.userId, JSON.stringify(rating)],
    );
  }

  async listByKo(koId: string): Promise<Rating[]> {
    const res = await this.pool.query<RatingRow>("SELECT data FROM ratings WHERE ko_id=$1", [koId]);
    return res.rows.map((row) => row.data);
  }

  // SCRUM-507: alle Bewertungen eines KOs verwerfen (inhaltliche Revision → neue Version neu prüfen).
  async deleteByKo(koId: string): Promise<void> {
    await this.pool.query("DELETE FROM ratings WHERE ko_id=$1", [koId]);
  }
}

export class PgAssignmentRepo implements AssignmentRepo {
  constructor(private readonly pool: Pool) {}

  async create(assignment: Assignment): Promise<void> {
    await this.pool.query(
      "INSERT INTO assignments(ko_id,user_id,data) VALUES($1,$2,$3) ON CONFLICT (ko_id,user_id) DO UPDATE SET data=excluded.data",
      [assignment.koId, assignment.userId, JSON.stringify(assignment)],
    );
  }

  async find(koId: string, userId: string): Promise<Assignment | undefined> {
    const res = await this.pool.query<AssignmentRow>(
      "SELECT data FROM assignments WHERE ko_id=$1 AND user_id=$2",
      [koId, userId],
    );
    return res.rows[0]?.data;
  }

  async update(assignment: Assignment): Promise<void> {
    await this.pool.query("UPDATE assignments SET data=$3 WHERE ko_id=$1 AND user_id=$2", [
      assignment.koId,
      assignment.userId,
      JSON.stringify(assignment),
    ]);
  }

  async all(): Promise<Assignment[]> {
    const res = await this.pool.query<AssignmentRow>("SELECT data FROM assignments");
    return res.rows.map((row) => row.data);
  }
}
