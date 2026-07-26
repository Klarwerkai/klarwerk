import type { Pool } from "pg";
import type { ObjectRepo } from "./repo";
import type { ObjectRef, StoredObject } from "./types";

// SCRUM-155: Postgres-Adapter des Object-Stores. ref (Metadaten) als JSONB; das Original
// (Base64-/Data-URL-String, bis MAX_OBJECT_BYTES) liegt getrennt im text-Feld — NICHT im
// KO-JSON. Datenhoheit beim Modul; additive Tabelle, keine Migration anderer Module nötig.
export const OBJECTSTORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS objects (
  id text PRIMARY KEY,
  ref jsonb NOT NULL,
  data text NOT NULL
);
`;

interface ObjectRow {
  ref: ObjectRef;
  data: string;
}

export class PgObjectRepo implements ObjectRepo {
  constructor(private readonly pool: Pool) {}

  async insert(obj: StoredObject): Promise<void> {
    await this.pool.query("INSERT INTO objects(id,ref,data) VALUES($1,$2,$3)", [
      obj.ref.id,
      JSON.stringify(obj.ref),
      obj.data,
    ]);
  }

  async findById(id: string): Promise<StoredObject | undefined> {
    const res = await this.pool.query<ObjectRow>("SELECT ref,data FROM objects WHERE id=$1", [id]);
    const row = res.rows[0];
    return row ? { ref: row.ref, data: row.data } : undefined;
  }

  // AUFTRAG-mega20 Block C: NUR die ref-Spalte. `SELECT *` würde hier jede Originaldatei des
  // Bestands in den Prozessspeicher holen — die teure Fehlerklasse, die man erst in Produktion
  // sieht. Sortiert nach id, damit ein Lauf über den Bestand reproduzierbar ist.
  async list(): Promise<ObjectRef[]> {
    const res = await this.pool.query<{ ref: ObjectRef }>("SELECT ref FROM objects ORDER BY id");
    return res.rows.map((row) => row.ref);
  }

  // AUFTRAG-mega20 Block C: endgültiges Entfernen; rowCount sagt ehrlich, ob es etwas zu löschen gab.
  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM objects WHERE id=$1", [id]);
    return (res.rowCount ?? 0) > 0;
  }
}
