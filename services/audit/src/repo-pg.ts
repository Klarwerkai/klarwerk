import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
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

// WP-SHIP8-CLOSE-6 (bens ROT-1): ADDITIVE Migrationsstufe NACH AUDIT_SCHEMA — stabile Event-Id
// für exactly-once-Belege (recordOnce). Der partielle UNIQUE-Index gilt NUR für Einträge MIT
// event_id (normale record()-Einträge bleiben unbegrenzt); ein zweiter Nachzug desselben Events
// kollidiert hart am Index und wird per ON CONFLICT DO NOTHING zum ehrlichen No-op.
export const AUDIT_EVENT_ID_SCHEMA = `
ALTER TABLE audit
  ADD COLUMN IF NOT EXISTS event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS audit_event_id_uq
  ON audit (event_id)
  WHERE event_id IS NOT NULL;
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
  // WP-SHIP8-CLOSE-6 (bens ROT-1): Idempotenzschlüssel (nur bei recordOnce-Einträgen gesetzt).
  event_id?: string | null;
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
    ...(row.event_id ? { eventId: row.event_id } : {}),
  };
}

export class PgAuditRepo implements AuditRepo {
  constructor(private readonly pool: Pool) {}

  // SCRUM-523 P.3 (WP-A2): ohne tx die normale Pool-Query (heutiges Verhalten); MIT tx (vom Aufrufer
  // aus derselben withPgTx-Klammer wie z. B. PgKoRepo.delete) läuft die Query auf demselben Client —
  // damit committen/rollbacken beide Schreiber ATOMAR zusammen (services/db-tx).
  private queryable(tx?: TxContext): Queryable {
    return tx ? pgQueryable(tx) : poolQueryable(this.pool);
  }

  async append(entry: AuditEntry, tx?: TxContext): Promise<void> {
    await this.queryable(tx).query(
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

  // WP-SHIP8-CLOSE-6 (bens ROT-1): exactly-once über den partiellen Unique-Index — der zweite
  // Schreiber desselben Events trifft ON CONFLICT (DO NOTHING) und bekommt ehrlich false zurück.
  async appendOnce(entry: AuditEntry, tx?: TxContext): Promise<boolean> {
    const res = await this.queryable(tx).query(
      `INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,event_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING
       RETURNING seq`,
      [
        entry.seq,
        entry.at,
        entry.actor,
        entry.action,
        entry.target,
        JSON.stringify(entry.payload),
        entry.prevHash,
        entry.hash,
        entry.eventId ?? null,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async all(): Promise<AuditEntry[]> {
    const res = await this.pool.query<AuditRow>("SELECT * FROM audit ORDER BY seq");
    return res.rows.map(toEntry);
  }

  async last(tx?: TxContext): Promise<AuditEntry | undefined> {
    const res = await this.queryable(tx).query<AuditRow>(
      "SELECT * FROM audit ORDER BY seq DESC LIMIT 1",
    );
    return res.rows[0] ? toEntry(res.rows[0]) : undefined;
  }
}
