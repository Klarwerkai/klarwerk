import type { Pool } from "pg";
import type { LifecycleRepo } from "./repo";
import type { LearningPath } from "./types";

export const LIFECYCLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS lifecycle_couplings (
  asset_ref text NOT NULL,
  ko_id text NOT NULL,
  PRIMARY KEY (asset_ref, ko_id)
);
CREATE TABLE IF NOT EXISTS lifecycle_pending (
  ko_id text PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS lifecycle_paths (
  id text PRIMARY KEY,
  role text NOT NULL,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS lifecycle_progress (
  path_id text NOT NULL,
  user_id text NOT NULL,
  completed jsonb NOT NULL,
  PRIMARY KEY (path_id, user_id)
);
`;

export class PgLifecycleRepo implements LifecycleRepo {
  constructor(private readonly pool: Pool) {}

  async addCoupling(assetRef: string, koId: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO lifecycle_couplings(asset_ref,ko_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [assetRef, koId],
    );
  }

  async couplingsFor(assetRef: string): Promise<string[]> {
    const res = await this.pool.query<{ ko_id: string }>(
      "SELECT ko_id FROM lifecycle_couplings WHERE asset_ref=$1",
      [assetRef],
    );
    return res.rows.map((row) => row.ko_id);
  }

  async markPending(koId: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO lifecycle_pending(ko_id) VALUES($1) ON CONFLICT DO NOTHING",
      [koId],
    );
  }

  async clearPending(koId: string): Promise<void> {
    await this.pool.query("DELETE FROM lifecycle_pending WHERE ko_id=$1", [koId]);
  }

  async pending(): Promise<string[]> {
    const res = await this.pool.query<{ ko_id: string }>("SELECT ko_id FROM lifecycle_pending");
    return res.rows.map((row) => row.ko_id);
  }

  async savePath(path: LearningPath): Promise<void> {
    await this.pool.query(
      "INSERT INTO lifecycle_paths(id,role,data) VALUES($1,$2,$3) ON CONFLICT (id) DO UPDATE SET role=excluded.role, data=excluded.data",
      [path.id, path.role, JSON.stringify(path)],
    );
  }

  async getPathByRole(role: string): Promise<LearningPath | undefined> {
    const res = await this.pool.query<{ data: LearningPath }>(
      "SELECT data FROM lifecycle_paths WHERE role=$1 LIMIT 1",
      [role],
    );
    return res.rows[0]?.data;
  }

  async setProgress(pathId: string, userId: string, completed: string[]): Promise<void> {
    await this.pool.query(
      "INSERT INTO lifecycle_progress(path_id,user_id,completed) VALUES($1,$2,$3) ON CONFLICT (path_id,user_id) DO UPDATE SET completed=excluded.completed",
      [pathId, userId, JSON.stringify(completed)],
    );
  }

  async getProgress(pathId: string, userId: string): Promise<string[]> {
    const res = await this.pool.query<{ completed: string[] }>(
      "SELECT completed FROM lifecycle_progress WHERE path_id=$1 AND user_id=$2",
      [pathId, userId],
    );
    return res.rows[0]?.completed ?? [];
  }
}
