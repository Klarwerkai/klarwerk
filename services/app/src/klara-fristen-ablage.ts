import type { Pool } from "pg";
import type { FristenStand } from "./klara-fristen";
import type { NotizSchreibbedingung } from "./klara-notiz-schreibbedingung";
import { SPACES_SPERRE } from "./spaces";

/** Ein eigener persönlicher Bestand; keine Kopie von Kalenderauftrag, Lauf oder Notiz. */
export interface KlaraFristenRepo {
  hole(kontoId: string): Promise<FristenStand | null>;
  /** CAS plus Quellenbedingung im selben Schreibvorgang. */
  speichere(
    stand: FristenStand,
    vorher: number,
    bedingung?: NotizSchreibbedingung,
  ): Promise<boolean>;
}

export class InMemoryKlaraFristenRepo implements KlaraFristenRepo {
  private readonly staende = new Map<string, FristenStand>();

  hole(kontoId: string): Promise<FristenStand | null> {
    const s = this.staende.get(kontoId);
    return Promise.resolve(s ? structuredClone(s) : null);
  }

  speichere(
    stand: FristenStand,
    vorher: number,
    bedingung?: NotizSchreibbedingung,
  ): Promise<boolean> {
    if (
      (this.staende.get(stand.kontoId)?.fassung ?? 0) !== vorher ||
      (bedingung?.gilt && !bedingung.gilt())
    ) {
      return Promise.resolve(false);
    }
    this.staende.set(stand.kontoId, structuredClone(stand));
    return Promise.resolve(true);
  }
}

export const KLARA_FRISTEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_fristen (
  konto_id text PRIMARY KEY,
  fassung integer NOT NULL,
  data jsonb NOT NULL
);
`;

export class PgKlaraFristenRepo implements KlaraFristenRepo {
  constructor(private readonly pool: Pool) {}

  async hole(kontoId: string): Promise<FristenStand | null> {
    const res = await this.pool.query<{ data: FristenStand }>(
      "SELECT data FROM klara_fristen WHERE konto_id=$1",
      [kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async speichere(
    stand: FristenStand,
    vorher: number,
    bedingung?: NotizSchreibbedingung,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Die bestehende exklusive Spaceänderungssperre schützt auch diese Quellenwirkung. Erst
      // nach Erwerb werden Quellen-/Kontenfakten geprüft; kein alter Space-Leserkreis wird benutzt.
      await client.query("SELECT pg_advisory_xact_lock_shared($1::bigint)", [SPACES_SPERRE]);
      const b = bedingung?.sql?.(5);
      const wo = b?.und.length ? b.und.join(" AND ") : "true";
      const res = await client.query(
        `INSERT INTO klara_fristen(konto_id,fassung,data)
         SELECT $1::text,$2::int,$3::jsonb WHERE ${wo}
           AND ($4::int=0 OR EXISTS(SELECT 1 FROM klara_fristen WHERE konto_id=$1::text AND fassung=$4::int))
         ON CONFLICT(konto_id) DO UPDATE SET fassung=EXCLUDED.fassung,data=EXCLUDED.data
         WHERE klara_fristen.fassung=$4::int`,
        [stand.kontoId, stand.fassung, JSON.stringify(stand), vorher, ...(b?.params ?? [])],
      );
      await client.query("COMMIT");
      return (res.rowCount ?? 0) === 1;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
