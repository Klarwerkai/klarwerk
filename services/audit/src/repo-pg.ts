import type { Pool } from "pg";
import type { AuditRepo } from "./repo";
import type { AuditEntry } from "./types";

// Postgres-Adapter für audit. Nur Anhängen (FR-AUD-02): kein UPDATE/DELETE.
export const AUDIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS audit (
  seq integer PRIMARY KEY,
  at text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  payload jsonb NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL
);
`;

interface AuditRow {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    seq: row.seq,
    at: row.at,
    actor: row.actor,
    action: row.action,
    target: row.target,
    payload: row.payload,
    prevHash: row.prev_hash,
    hash: row.hash,
  };
}

export class PgAuditRepo implements AuditRepo {
  constructor(private readonly pool: Pool) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.pool.query(
      "INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        entry.seq,
        entry.at,
        entry.actor,
        entry.action,
        entry.target,
        JSON.stringify(entry.payload),
        entry.prevHash,
        entry.hash,
      ],
    );
  }

  async all(): Promise<AuditEntry[]> {
    const res = await this.pool.query<AuditRow>("SELECT * FROM audit ORDER BY seq");
    return res.rows.map(toEntry);
  }

  async last(): Promise<AuditEntry | undefined> {
    const res = await this.pool.query<AuditRow>("SELECT * FROM audit ORDER BY seq DESC LIMIT 1");
    return res.rows[0] ? toEntry(res.rows[0]) : undefined;
  }
}
