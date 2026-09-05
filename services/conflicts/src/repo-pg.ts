import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type { ConflictRepo, IsKoVersionCurrent } from "./repo";
import type { Conflict } from "./types";

// JOB 3066 (bens Korrekturpflicht 4 zu R3): die zwei Ausdrucks-Indizes zum Prädikat des
// Aufräumwegs (`closeOpenForKo` sucht über `data->>'koA'`/`data->>'koB'`) — Begründung, Bauform
// und die ehrliche Grenze („dass der Planer sie wählt, ist nicht nachgemessen") wortgleich wie bei
// OVERLAP_SCHEMA in overlap-repo-pg.ts.
export const CONFLICTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS conflicts (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS conflicts_koa_idx ON conflicts ((data->>'koA'));
CREATE INDEX IF NOT EXISTS conflicts_kob_idx ON conflicts ((data->>'koB'));
`;

interface ConflictRow {
  data: Conflict;
}

export class PgConflictRepo implements ConflictRepo {
  constructor(private readonly pool: Pool) {}

  async insert(conflict: Conflict): Promise<void> {
    await this.pool.query("INSERT INTO conflicts(id,data) VALUES($1,$2)", [
      conflict.id,
      JSON.stringify(conflict),
    ]);
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): VERSIONS-KONDITIONALER Insert als EIN bedingtes
  // Statement — die aktuelle KO-Version beider Seiten steht als WHERE-Bedingung im Insert selbst
  // (Subselect auf die kos-Tabelle: bewusste, NUR-LESENDE Ausnahme von der Tabellen-Trennung;
  // der isCurrent-Callback wird hier nicht verwendet, die DB urteilt selbst). Das schließt den
  // Fall, dass die neue KO-Version bereits VOR Statement-Beginn committet ist (rowCount 0 ⇒ kein
  // Datensatz). EHRLICHE GRENZE (bens ROT 1, Pedi D-V5=b): unter READ COMMITTED liest das
  // Statement einen MVCC-Snapshot und ist NICHT gegen ein gleichzeitiges Revisions-Interleaving
  // serialisiert — kein FOR UPDATE/FOR KEY SHARE auf den KO-Zeilen, keine gemeinsame Lock-/
  // Transaktionsdomäne mit ko.revise (die volle Schreib-Serialisierung ist als Post-VIP-Scheibe
  // „Job-Queue" vorgemerkt). Ein in diesem Fenster doch committeter stale offener Datensatz wird
  // vom fail-closed Read-Pfad (version-guard: unresolved()/get()/Detail-Routen) nie ausgeliefert
  // und per Revisions-Sweep/Lese-GC geschlossen. Fehlt das KO oder trägt es keine Version →
  // fail-closed (kein Insert).
  async insertIfVersionsCurrent(
    conflict: Conflict,
    _isCurrent: IsKoVersionCurrent,
  ): Promise<boolean> {
    if (conflict.koAVersion === undefined || conflict.koBVersion === undefined) {
      return false;
    }
    const res = await this.pool.query(
      `INSERT INTO conflicts(id,data)
       SELECT $1, $2::jsonb
       WHERE (SELECT (data->>'version')::int FROM kos WHERE id=$3) = $4::int
         AND (SELECT (data->>'version')::int FROM kos WHERE id=$5) = $6::int`,
      [
        conflict.id,
        JSON.stringify(conflict),
        conflict.koA,
        conflict.koAVersion,
        conflict.koB,
        conflict.koBVersion,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // D-AISTATE PAKET 4 (bens fix5-Recheck §4, aistate-fix6): STATUS-CAS für den Lese-GC als EIN
  // bedingtes Statement — die WHERE-Bedingung `data->>'status'='offen'` ist der Compare, das
  // jsonb-Merge (`data || $2`) der Set. PostgreSQL sperrt die Zeile beim UPDATE; unter READ
  // COMMITTED sieht ein zweiter nebenläufiger GC-Lauf nach dem Warten den bereits geschlossenen
  // Stand und trifft 0 Zeilen (RETURNING id ⇒ rowCount 0). Damit:
  //  - kein Lost Update — hat ein MENSCH zwischenzeitlich entschieden (Status ≠ "offen"), matcht das
  //    Prädikat nicht und der alte GC-Stand überschreibt die menschliche Entscheidung NIE,
  //  - genau EIN Gewinner (rowCount 1) unter parallelen Läufen; nur er auditiert.
  // KEIN Vollobjekt-Read-Modify-Write: der Patch wird ins vorhandene jsonb gemerged (Felder anderer
  // Prozesse bleiben erhalten). rowCount > 0 ⇒ DIESER Aufruf hat geschlossen.
  async supersedeIfOpen(id: string, patch: Partial<Conflict>): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE conflicts
         SET data = data || $2::jsonb
       WHERE id=$1 AND data->>'status'='offen'
       RETURNING id`,
      [id, JSON.stringify(patch)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<Conflict | undefined> {
    const res = await this.pool.query<ConflictRow>("SELECT data FROM conflicts WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async all(): Promise<Conflict[]> {
    const res = await this.pool.query<ConflictRow>("SELECT data FROM conflicts");
    return res.rows.map((row) => row.data);
  }

  // JOB 3066: MIT tx laufen Lesen und Schreiben auf DEM Client, den withPgTx geöffnet hat —
  // dieselbe Transaktion wie repo.delete und audit.record der Endlöschung. Ohne tx unverändert am
  // Pool.
  private q(tx?: TxContext): Queryable {
    return tx ? pgQueryable(tx) : poolQueryable(this.pool);
  }

  async update(conflict: Conflict): Promise<void> {
    await this.pool.query("UPDATE conflicts SET data=$2 WHERE id=$1", [
      conflict.id,
      JSON.stringify(conflict),
    ]);
  }

  // Der mengenbasierte Schliess-Schritt, Bauform und Begründung wie PgOverlapRepo.closeOpenForKo
  // (dort ausgeschrieben): EIN Statement für Auswahl und Schreiben, jsonb-Merge statt
  // Vollobjekt-Write, `RETURNING data` als einzige Quelle für Kennungen und Anzahl.
  // Terminalzustand ist hier "geloest"; `coalesce(...,'offen')` deckt Altbestand ohne Statusfeld
  // fail-safe ab.
  async closeOpenForKo(
    koId: string,
    patch: Partial<Conflict>,
    tx?: TxContext,
  ): Promise<Conflict[]> {
    const res = await this.q(tx).query<ConflictRow>(
      `UPDATE conflicts
          SET data = data || $2::jsonb
        WHERE (data->>'koA' = $1 OR data->>'koB' = $1)
          AND coalesce(data->>'status', 'offen') <> 'geloest'
        RETURNING data`,
      [koId, JSON.stringify(patch)],
    );
    return res.rows.map((row) => row.data);
  }
}
