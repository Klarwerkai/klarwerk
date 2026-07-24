import type { Pool } from "pg";
import type { OverlapRepo } from "./overlap-repo";
import type { OverlapEntry } from "./overlap-types";
import type { IsKoVersionCurrent } from "./repo";

// Berater-Konzept Duplikate 04.07. (Stufe D3b): Postgres-Persistenz der Überschneidungs-Einträge.
// Muster PgConflictRepo — eigene JSONB-Tabelle, produktseitig getrennt von Konflikten.
// SCRUM-496: Tabellenname bewusst NICHT "overlaps" — OVERLAPS ist ein reserviertes
// Postgres-Keyword (SQL-Operator), unquotiert ist "CREATE TABLE overlaps" ungültige Syntax
// (42601) und migrate() brach beim Boot ab. "ko_overlaps" (Konvention wie ko_evidence) ist
// unkritisch. Die Tabelle existierte auf der Beta nie → reines CREATE, keine Datenmigration.
export const OVERLAP_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_overlaps (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

interface OverlapRow {
  data: OverlapEntry;
}

export class PgOverlapRepo implements OverlapRepo {
  constructor(private readonly pool: Pool) {}

  async insert(entry: OverlapEntry): Promise<void> {
    await this.pool.query("INSERT INTO ko_overlaps(id,data) VALUES($1,$2)", [
      entry.id,
      JSON.stringify(entry),
    ]);
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): VERSIONS-KONDITIONALER Insert — Vertrag, Begründung
  // und EHRLICHE GRENZE wie PgConflictRepo.insertIfVersionsCurrent (EIN bedingtes Statement gegen
  // einen bereits committeten neuen Stand; NICHT gegen ein gleichzeitiges Revisions-Interleaving
  // serialisiert — die Sichtbarkeits-Garantie trägt der fail-closed Read-Pfad; rowCount 0 ⇒ kein
  // Datensatz).
  async insertIfVersionsCurrent(
    entry: OverlapEntry,
    _isCurrent: IsKoVersionCurrent,
  ): Promise<boolean> {
    if (entry.koAVersion === undefined || entry.koBVersion === undefined) {
      return false;
    }
    const res = await this.pool.query(
      `INSERT INTO ko_overlaps(id,data)
       SELECT $1, $2::jsonb
       WHERE (SELECT (data->>'version')::int FROM kos WHERE id=$3) = $4::int
         AND (SELECT (data->>'version')::int FROM kos WHERE id=$5) = $6::int`,
      [entry.id, JSON.stringify(entry), entry.koA, entry.koAVersion, entry.koB, entry.koBVersion],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // D-AISTATE PAKET 4 (bens fix5-Recheck §4, aistate-fix6): STATUS-CAS für den Lese-GC — EIN
  // bedingtes Statement, Begründung wie PgConflictRepo.supersedeIfOpen (Prädikat
  // `data->>'status'='offen'` = Compare, jsonb-Merge = Set; Zeilensperre serialisiert parallele
  // Läufe, rowCount 0 für den Verlierer; kein Lost Update gegen eine menschliche Entscheidung).
  async supersedeIfOpen(id: string, patch: Partial<OverlapEntry>): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE ko_overlaps
         SET data = data || $2::jsonb
       WHERE id=$1 AND data->>'status'='offen'
       RETURNING id`,
      [id, JSON.stringify(patch)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<OverlapEntry | undefined> {
    const res = await this.pool.query<OverlapRow>("SELECT data FROM ko_overlaps WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(entry: OverlapEntry): Promise<void> {
    await this.pool.query("UPDATE ko_overlaps SET data=$2 WHERE id=$1", [
      entry.id,
      JSON.stringify(entry),
    ]);
  }

  async all(): Promise<OverlapEntry[]> {
    const res = await this.pool.query<OverlapRow>("SELECT data FROM ko_overlaps");
    return res.rows.map((row) => row.data);
  }
}
