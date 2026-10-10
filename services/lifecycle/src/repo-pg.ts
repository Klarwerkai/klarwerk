import type { Pool } from "pg";
import { type TxContext, pgQueryable, poolQueryable, withPgTx } from "../../db-tx";
import type { LifecycleRepo } from "./repo";
import {
  type LearningPath,
  type MerkerErgebnis,
  type OffenerFall,
  type RevalidierungsAnlass,
  istDauerhaft,
} from "./types";

// produkt:20261010:aenderungsfolgen-sichtbar: drei Spalten am Merker — Stand, Beginn und Anlässe.
// ADDITIV, nachgezählt: nur `ADD COLUMN IF NOT EXISTS` mit Vorgabe, kein `DROP`, kein `DELETE`, kein
// `UPDATE … SET`. Ein Altmerker liest sich danach als Fall mit Stand 1, ohne Beginn und ohne Anlass —
// genau das, was über ihn bekannt ist. Ein zweiter Lauf ist folgenlos.
// Nacharbeit 4 (Ben): dazu `lifecycle_verlauf` — je Eintrag die Hochwassermarke des Stands und die
// dauerhaft verarbeiteten Änderungssignaturen; ein `CREATE TABLE IF NOT EXISTS`, ebenfalls ADDITIV.
export const LIFECYCLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS lifecycle_couplings (
  asset_ref text NOT NULL,
  ko_id text NOT NULL,
  PRIMARY KEY (asset_ref, ko_id)
);
CREATE TABLE IF NOT EXISTS lifecycle_pending (
  ko_id text PRIMARY KEY
);
ALTER TABLE lifecycle_pending ADD COLUMN IF NOT EXISTS stand integer NOT NULL DEFAULT 1;
ALTER TABLE lifecycle_pending ADD COLUMN IF NOT EXISTS seit text;
ALTER TABLE lifecycle_pending ADD COLUMN IF NOT EXISTS anlaesse jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS lifecycle_verlauf (
  ko_id text PRIMARY KEY,
  letzter_stand integer NOT NULL DEFAULT 0,
  signaturen jsonb NOT NULL DEFAULT '[]'::jsonb
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

interface FallZeile {
  ko_id: string;
  stand: number;
  seit: string | null;
  anlaesse: RevalidierungsAnlass[] | null;
}

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

  async couplingsForKo(koId: string): Promise<string[]> {
    const res = await this.pool.query<{ asset_ref: string }>(
      "SELECT asset_ref FROM lifecycle_couplings WHERE ko_id=$1",
      [koId],
    );
    return res.rows.map((r) => r.asset_ref);
  }

  /**
   * produkt:20261010:aenderungsfolgen-sichtbar — EINE Transaktion je Signal, gesperrt über die
   * Verlaufszeile des Eintrags (`lifecycle_verlauf … FOR UPDATE`). Damit gilt (Ben, Nacharbeit 4):
   *  - der Stand ist je Eintrag ÜBER ABSCHLÜSSE HINWEG eindeutig (Hochwassermarke `letzter_stand`):
   *    nach Abschluss von B beginnt C nicht wieder bei 1, eine verspätete Bestätigung von B trifft C
   *    also nie;
   *  - eine Änderung mit Änderungsbeleg ist dauerhaft verarbeitet (`signaturen`): ihre Wiederholung
   *    nach dem Abschluss eröffnet keinen Fall, keinen Beleg und keine Meldung;
   *  - zwei gleichzeitige Meldungen derselben Änderung ergeben genau einen Anlass, zwei verschiedene
   *    zwei Anlässe und zwei aufeinanderfolgende Stände.
   */
  async markPending(koId: string, anlass?: RevalidierungsAnlass): Promise<MerkerErgebnis> {
    return withPgTx(this.pool, async (tx) => {
      const q = pgQueryable(tx);
      await q.query("INSERT INTO lifecycle_verlauf(ko_id) VALUES($1) ON CONFLICT DO NOTHING", [
        koId,
      ]);
      const v = await q.query<{ letzter_stand: number; signaturen: string[] | null }>(
        "SELECT letzter_stand, signaturen FROM lifecycle_verlauf WHERE ko_id=$1 FOR UPDATE",
        [koId],
      );
      const letzter = Number(v.rows[0]?.letzter_stand ?? 0);
      const signaturen = Array.isArray(v.rows[0]?.signaturen) ? (v.rows[0]?.signaturen ?? []) : [];
      const p = await q.query<FallZeile>(
        "SELECT ko_id, stand, seit, anlaesse FROM lifecycle_pending WHERE ko_id=$1 FOR UPDATE",
        [koId],
      );
      const offen = p.rows[0];
      const offenStand = offen ? Number(offen.stand) : undefined;
      if (anlass && istDauerhaft(anlass) && signaturen.includes(anlass.signatur)) {
        return { stand: offenStand ?? letzter, neu: false };
      }
      if (
        offen &&
        offenStand !== undefined &&
        (!anlass || (offen.anlaesse ?? []).some((a) => a.signatur === anlass.signatur))
      ) {
        return { stand: offenStand, neu: false };
      }
      const stand = Math.max(letzter, offenStand ?? 0) + 1;
      await q.query(
        "UPDATE lifecycle_verlauf SET letzter_stand=$2, signaturen = signaturen || $3::jsonb WHERE ko_id=$1",
        [koId, stand, JSON.stringify(anlass && istDauerhaft(anlass) ? [anlass.signatur] : [])],
      );
      const neueAnlaesse = JSON.stringify(anlass ? [anlass] : []);
      if (offen) {
        await q.query(
          "UPDATE lifecycle_pending SET stand=$2, anlaesse = anlaesse || $3::jsonb WHERE ko_id=$1",
          [koId, stand, neueAnlaesse],
        );
      } else {
        await q.query(
          "INSERT INTO lifecycle_pending(ko_id, stand, seit, anlaesse) VALUES($1, $2, $3, $4::jsonb)",
          [koId, stand, anlass?.am ?? null, neueAnlaesse],
        );
      }
      return { stand, neu: true };
    });
  }

  async clearPending(koId: string, tx?: TxContext, stand?: number): Promise<boolean> {
    const q = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    const res =
      stand === undefined
        ? await q.query("DELETE FROM lifecycle_pending WHERE ko_id=$1", [koId])
        : await q.query("DELETE FROM lifecycle_pending WHERE ko_id=$1 AND stand=$2", [koId, stand]);
    return (res.rowCount ?? 0) > 0;
  }

  /** Schreibfrei: ein `SELECT`; eine leere Kennungsliste geht nicht ans SQL. */
  async offeneFaelle(koIds?: readonly string[], tx?: TxContext): Promise<OffenerFall[]> {
    if (koIds !== undefined && koIds.length === 0) {
      return [];
    }
    const q = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    const res =
      koIds === undefined
        ? await q.query<FallZeile>("SELECT ko_id, stand, seit, anlaesse FROM lifecycle_pending")
        : await q.query<FallZeile>(
            "SELECT ko_id, stand, seit, anlaesse FROM lifecycle_pending WHERE ko_id = ANY($1)",
            [[...new Set(koIds)]],
          );
    return res.rows.map((row) => ({
      koId: row.ko_id,
      stand: Number(row.stand),
      seit: row.seit ?? null,
      anlaesse: Array.isArray(row.anlaesse) ? row.anlaesse : [],
    }));
  }

  async restorePending(fall: OffenerFall): Promise<void> {
    await this.pool.query(
      `INSERT INTO lifecycle_pending(ko_id, stand, seit, anlaesse) VALUES($1, $2, $3, $4::jsonb)
       ON CONFLICT DO NOTHING`,
      [fall.koId, fall.stand, fall.seit, JSON.stringify(fall.anlaesse)],
    );
  }

  async pending(): Promise<string[]> {
    const res = await this.pool.query<{ ko_id: string }>("SELECT ko_id FROM lifecycle_pending");
    return res.rows.map((row) => row.ko_id);
  }

  /**
   * JOB 3054: EINE Anweisung fuer die ganze Menge — ausdruecklich keine Schleife und ausdruecklich
   * kein Filtern eines vollen `pending()` im Anwendungsspeicher. Beides saehe von aussen wie eine
   * Mengenabfrage aus und waere im Betrieb genau die Last, die dieser Weg vermeidet; die Zusage der
   * beiden Leserouten („eine zusaetzliche Abfrage") haengt an dieser Zeile.
   *
   * SCHREIBFREI: hier steht ein `SELECT` und sonst nichts. Der aufraeumende Weg (`clearPending`)
   * bleibt, wo er ist — im Arbeitsbereich (SCRUM-420), nicht auf einem Lesepfad.
   *
   * Die leere Kennungsliste geht GAR NICHT ans SQL; doppelte Kennungen gehen einmal hinein.
   */
  async pendingFor(koIds: readonly string[]): Promise<string[]> {
    if (koIds.length === 0) {
      return [];
    }
    const res = await this.pool.query<{ ko_id: string }>(
      "SELECT ko_id FROM lifecycle_pending WHERE ko_id = ANY($1)",
      [[...new Set(koIds)]],
    );
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
