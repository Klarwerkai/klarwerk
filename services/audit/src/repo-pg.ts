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

// JOB 498 D8: ADDITIVE Migrationsstufe DIREKT nach AUDIT_EVENT_ID_SCHEMA — die Hashversion je
// Eintrag. `AUDIT_EVENT_ID_SCHEMA` ist der bereits vorhandene Präzedenzfall derselben Bauform.
//
// `NOT NULL DEFAULT 1` IST DIE GANZE MIGRATION DES ALTBESTANDS: jede vorhandene Zeile bekommt
// genau die Version, mit der sie tatsächlich gehasht wurde. Es wird nichts umgerechnet, nichts
// nachgetragen und nichts angefasst — der Altbestand ist V1, und die Spalte sagt das nun auch.
//
// KEIN DROP, KEIN TRUNCATE, KEIN UPDATE, KEIN DELETE. Die Stufe ist wiederholbar
// (`IF NOT EXISTS`) und in `migrationsbeleg.ts` als `ADDITIV` geführt.
export const AUDIT_HASH_VERSION_SCHEMA = `
ALTER TABLE audit ADD COLUMN IF NOT EXISTS hash_version integer NOT NULL DEFAULT 1;
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
  // JOB 498 D8: die Hashversion der Zeile. Optional getypt, weil eine Bestandsinstanz VOR der
  // Migration die Spalte nicht hat — `toEntry` fällt dann auf 1 zurück, was für sie richtig ist.
  hash_version?: number | null;
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
    // JOB 498 D8 — HIER, UND NICHT IM SCHEMA, LAG DIE EIGENTLICHE LÜCKE.
    //
    // `all()`, `last()` und `findBySeq()` fragen mit `SELECT *` ab; die neue Spalte KÄME also
    // ohnehin aus der Datenbank zurück. Sie fiele erst hier weg, weil diese Funktion sie nicht
    // abbildet. Genau das meinte BEN2-D4 mit „ginge beim Roundtrip verloren" — es ist eine
    // Funktion, kein Schema. Ohne diese Zeile läse jeder V2-Eintrag als versionslos zurück und
    // würde gegen V1 nachgerechnet: die ganze Kette fiele auseinander, obwohl die Spalte steht.
    hashVersion: row.hash_version ?? 1,
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
    // JOB 498 D8: `hash_version` wird AUSDRÜCKLICH geschrieben, nicht dem Spaltendefault
    // überlassen. Der Default ist 1 — ein V2-Eintrag käme sonst als V1 zurück und wäre damit
    // unprüfbar, obwohl beim Schreiben alles stimmte.
    await this.queryable(tx).query(
      "INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,hash_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        entry.seq,
        entry.at,
        entry.actor,
        entry.action,
        entry.target,
        JSON.stringify(entry.payload),
        entry.prevHash,
        entry.hash,
        entry.hashVersion ?? 1,
      ],
    );
  }

  // WP-SHIP8-CLOSE-6 (bens ROT-1): exactly-once über den partiellen Unique-Index — der zweite
  // Schreiber desselben Events trifft ON CONFLICT (DO NOTHING) und bekommt ehrlich false zurück.
  async appendOnce(entry: AuditEntry, tx?: TxContext): Promise<boolean> {
    const res = await this.queryable(tx).query(
      `INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,event_id,hash_version)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
        // BEIDE INSERT-Pfade führen die Version. BEN2 hat an D7 gerügt, dass nur einer genannt war:
        // „Ohne beide INSERT-Spalten schreibt ein neuer V2-Eintrag den Datenbank-Default 1."
        entry.hashVersion ?? 1,
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

  /**
   * W3-B (KW-W3-19): Punktzugriff ueber den PRIMAERSCHLUESSEL — `seq integer PRIMARY KEY` steht seit
   * jeher im Schema (oben). Es braucht deshalb weder einen neuen Index noch eine Migration; genau
   * das macht diesen Leseweg so klein.
   *
   * KEIN `ORDER BY`, KEIN `LIMIT`, KEIN Vollscan: ein Schluesselzugriff findet den adressierten
   * Eintrag oder gar keinen. Ein fehlender `seq` liefert `undefined` und wirft nicht — das
   * Fehlen ist eine Antwort, kein Fehler (KW-W3-19: `MISSING`).
   */
  async findBySeq(seq: number, tx?: TxContext): Promise<AuditEntry | undefined> {
    const res = await this.queryable(tx).query<AuditRow>("SELECT * FROM audit WHERE seq = $1", [
      seq,
    ]);
    return res.rows[0] ? toEntry(res.rows[0]) : undefined;
  }
}
