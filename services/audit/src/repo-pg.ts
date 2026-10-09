import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable, withPgTx } from "../../db-tx";
import type { AuditRepo } from "./repo";
import type { AuditEntry, AuditFilter, AuditSeitenFilter } from "./types";

// Postgres-Adapter für audit. Nur Anhängen (FR-AUD-02): kein UPDATE/DELETE.
//
// JOB 2698 D1 (Review-Befund R2-32): der Index `(action, target)` steht IN dieser Stufe, additiv und
// wiederholbar (`IF NOT EXISTS`) — dieselbe Bauform wie die Trägersuche-Indizes in JOB 2685. Er trägt
// die gefilterten Lesewege (`findBy`/`existsBy`): Glocke, Wirkung, Live-Wall lesen `action`, die
// KO-Stelle `action + target`. Ein Filter nur nach `actor` (Admin-Protokoll) bleibt ein Scan — er ist
// selten und gehört nicht zu den Befunden.
export const AUDIT_ACTION_TARGET_INDEX_DDL = `CREATE INDEX IF NOT EXISTS audit_action_target_idx
  ON audit (action, target);`;

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
${AUDIT_ACTION_TARGET_INDEX_DDL}
`;

// JOB 2698 D1: die gefilterte Abfrage — dieselbe Regel wie `auditFilterTrifft` (repo.ts), in SQL:
// ein NULL-Parameter heißt „kein Filter", ein gesetzter heißt exakte Gleichheit (`=` auf `text`, also
// Groß-/Kleinschreibung zählt wie `===` in Node); `ORDER BY seq` wie `all()`. Ein leerer String im
// Filter wird VOR der Abfrage zu NULL — in Node war `""` schon immer „kein Filter" (`!filter.x`).
export const AUDIT_FIND_BY_SQL = `SELECT * FROM audit
  WHERE ($1::text IS NULL OR actor = $1)
    AND ($2::text IS NULL OR action = $2)
    AND ($3::text IS NULL OR target = $3)
  ORDER BY seq`;
export const AUDIT_EXISTS_BY_SQL = `SELECT EXISTS(
  SELECT 1 FROM audit
  WHERE ($1::text IS NULL OR actor = $1)
    AND ($2::text IS NULL OR action = $2)
    AND ($3::text IS NULL OR target = $3)
) AS vorhanden`;

// produkt:20261009:admin-audit-verstaendlich: der Seitenweg — dieselbe Regel wie `auditSeiteTrifft`
// (repo.ts). `$4` ist die Aktionsliste (NULL = kein Filter), `$5`/`$6` der Zeitraum über `at` (ISO in
// UTC, also als Text vergleichbar), `$7` der Zeiger `before`, `$8` die Seitengröße. Absteigend über
// den Primärschlüssel `seq` — eine Seite liest nur ihre Zeilen, nicht die ganze Kette.
export const AUDIT_FIND_PAGE_SQL = `SELECT * FROM audit
  WHERE ($1::text IS NULL OR actor = $1)
    AND ($2::text IS NULL OR action = $2)
    AND ($3::text IS NULL OR target = $3)
    AND ($4::text[] IS NULL OR action = ANY($4))
    AND ($5::text IS NULL OR at >= $5)
    AND ($6::text IS NULL OR at < $6)
    AND ($7::integer IS NULL OR seq < $7)
  ORDER BY seq DESC
  LIMIT $8`;

// produkt:20261009:admin-audit-verstaendlich: die gespeicherten Namen zu den Kennungen einer Seite.
export const AUDIT_NAMENSBELEGE_SQL = `SELECT * FROM audit
  WHERE (actor = ANY($1::text[]) AND payload ? 'actorName')
     OR (target = ANY($1::text[]) AND payload ? 'targetName')
  ORDER BY seq`;

/** `""`/undefined → NULL (kein Filter); sonst der Wert — die Übersetzung von `!filter.x` nach SQL. */
export function auditFilterParams(
  filter: AuditFilter,
): [string | null, string | null, string | null] {
  return [filter.actor || null, filter.action || null, filter.target || null];
}

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

// Aufnahme gesamt-auditprotokoll (Lauf 3) — DIE KETTENSPERRE. Vorgänger lesen und Anhängen laufen
// unter dieser transaktionsgebundenen Beratungssperre (`appendNext`). Sie gilt datenbankweit, also
// auch zwischen zwei Instanzen gegen dieselbe Datenbank, und endet mit COMMIT/ROLLBACK von selbst —
// ein abgestürzter Prozess hält sie nicht fest. Derselbe Zahlenraum wie `SPERRSCHLUESSEL_BESTANDSRESET`
// (596000001) und der Trigramm-Sperre der Tests; der Wert kollidiert mit keinem von beiden.
export const AUDIT_KETTENSPERRE = 613000001;
export const SQL_AUDIT_KETTENSPERRE = `SELECT pg_advisory_xact_lock(${AUDIT_KETTENSPERRE})`;
// Nur im Weg OHNE Aufrufer-Transaktion (eigene, kurze Transaktion): ein Schreiber wartet höchstens so
// lange auf die Sperre und bricht dann mit einem Fehler ab, statt unbegrenzt zu hängen. Das trennt
// auch den einen Fall, den die Datenbank nicht als Verklemmung erkennen kann: ein Aufrufer hält die
// Sperre in seiner Transaktion und wartet im Programm auf einen zweiten Schreiber ohne `tx`.
export const SQL_AUDIT_WARTEFRIST = "SET LOCAL lock_timeout = '15s'";
const SQL_AUDIT_LETZTER = "SELECT * FROM audit ORDER BY seq DESC LIMIT 1";
const SQL_AUDIT_INSERT =
  "INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,hash_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)";
const SQL_AUDIT_INSERT_ONCE = `INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,event_id,hash_version)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING
       RETURNING seq`;

function insertParams(entry: AuditEntry): unknown[] {
  return [
    entry.seq,
    entry.at,
    entry.actor,
    entry.action,
    entry.target,
    JSON.stringify(entry.payload),
    entry.prevHash,
    entry.hash,
    // JOB 498 D8: `hash_version` wird AUSDRÜCKLICH geschrieben, nicht dem Spaltendefault
    // überlassen. Der Default ist 1 — ein V2-Eintrag käme sonst als V1 zurück und wäre damit
    // unprüfbar, obwohl beim Schreiben alles stimmte.
    entry.hashVersion ?? 1,
  ];
}

function insertOnceParams(entry: AuditEntry): unknown[] {
  // BEIDE INSERT-Pfade führen die Version. BEN2 hat an D7 gerügt, dass nur einer genannt war:
  // „Ohne beide INSERT-Spalten schreibt ein neuer V2-Eintrag den Datenbank-Default 1."
  const basis = insertParams(entry);
  return [...basis.slice(0, 8), entry.eventId ?? null, entry.hashVersion ?? 1];
}

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
    await this.queryable(tx).query(SQL_AUDIT_INSERT, insertParams(entry));
  }

  // WP-SHIP8-CLOSE-6 (bens ROT-1): exactly-once über den partiellen Unique-Index — der zweite
  // Schreiber desselben Events trifft ON CONFLICT (DO NOTHING) und bekommt ehrlich false zurück.
  async appendOnce(entry: AuditEntry, tx?: TxContext): Promise<boolean> {
    const res = await this.queryable(tx).query(SQL_AUDIT_INSERT_ONCE, insertOnceParams(entry));
    return (res.rowCount ?? 0) > 0;
  }

  // Aufnahme gesamt-auditprotokoll (Lauf 3): Sperre → Vorgänger → Insert, auf EINEM Client.
  // MIT `tx` in der Transaktion des Aufrufers — die Sperre hält dann bis zu DESSEN Commit, sodass
  // der nächste Schreiber erst den festgeschriebenen Vorgänger sieht (READ COMMITTED: die Abfrage
  // nach der Sperre sieht jeden vorher committeten Eintrag). Ein zweiter Eintrag derselben
  // Transaktion erwirbt dieselbe Sperre erneut, ohne zu warten. OHNE `tx` in einer eigenen, kurzen
  // Transaktion mit Wartefrist.
  async appendNext(
    build: (last: AuditEntry | undefined) => AuditEntry,
    tx?: TxContext,
  ): Promise<{ entry: AuditEntry; written: boolean }> {
    const schritt = async (q: Queryable): Promise<{ entry: AuditEntry; written: boolean }> => {
      await q.query(SQL_AUDIT_KETTENSPERRE);
      const res = await q.query<AuditRow>(SQL_AUDIT_LETZTER);
      const entry = build(res.rows[0] ? toEntry(res.rows[0]) : undefined);
      if (entry.eventId) {
        const ins = await q.query(SQL_AUDIT_INSERT_ONCE, insertOnceParams(entry));
        return { entry, written: (ins.rowCount ?? 0) > 0 };
      }
      await q.query(SQL_AUDIT_INSERT, insertParams(entry));
      return { entry, written: true };
    };
    if (tx) {
      return schritt(pgQueryable(tx));
    }
    return withPgTx(this.pool, async (eigene) => {
      const q = pgQueryable(eigene);
      await q.query(SQL_AUDIT_WARTEFRIST);
      return schritt(q);
    });
  }

  async all(): Promise<AuditEntry[]> {
    const res = await this.pool.query<AuditRow>("SELECT * FROM audit ORDER BY seq");
    return res.rows.map(toEntry);
  }

  // JOB 2698 D1 (R2-32): der gefilterte Leseweg — WHERE statt Vollscan plus Node-Filter. Liefert
  // dieselbe Menge in derselben Reihenfolge wie `all()` + `auditFilterTrifft` (Gleichheit gemessen in
  // tests/audit/job2698-*). Ohne `tx`, wie `all()`: ein Leseweg der Flächen, kein Schreibpfad.
  async findBy(filter: AuditFilter): Promise<AuditEntry[]> {
    const res = await this.pool.query<AuditRow>(AUDIT_FIND_BY_SQL, auditFilterParams(filter));
    return res.rows.map(toEntry);
  }

  // JOB 2698 D1: „gibt es einen?" — EXISTS über den Index; es wird keine Zeile geladen.
  async existsBy(filter: AuditFilter): Promise<boolean> {
    const res = await this.pool.query<{ vorhanden: boolean }>(
      AUDIT_EXISTS_BY_SQL,
      auditFilterParams(filter),
    );
    return res.rows[0]?.vorhanden === true;
  }

  // produkt:20261009:admin-audit-verstaendlich: der Seitenweg der Verwalteransicht.
  async findPage(
    filter: AuditSeitenFilter,
    before: number | undefined,
    limit: number,
  ): Promise<AuditEntry[]> {
    const res = await this.pool.query<AuditRow>(AUDIT_FIND_PAGE_SQL, [
      ...auditFilterParams(filter),
      filter.actions && filter.actions.length > 0 ? [...filter.actions] : null,
      filter.from || null,
      filter.to || null,
      before ?? null,
      limit,
    ]);
    return res.rows.map(toEntry);
  }

  async findNamensbelege(ids: readonly string[]): Promise<AuditEntry[]> {
    if (ids.length === 0) {
      return [];
    }
    const res = await this.pool.query<AuditRow>(AUDIT_NAMENSBELEGE_SQL, [[...ids]]);
    return res.rows.map(toEntry);
  }

  async last(tx?: TxContext): Promise<AuditEntry | undefined> {
    const res = await this.queryable(tx).query<AuditRow>(SQL_AUDIT_LETZTER);
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
