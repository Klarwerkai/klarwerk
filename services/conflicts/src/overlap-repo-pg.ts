import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable } from "../../db-tx";
import type { OverlapRepo } from "./overlap-repo";
import type { OverlapEntry } from "./overlap-types";
import type { IsKoVersionCurrent } from "./repo";

// Berater-Konzept Duplikate 04.07. (Stufe D3b): Postgres-Persistenz der Überschneidungs-Einträge.
// Muster PgConflictRepo — eigene JSONB-Tabelle, produktseitig getrennt von Konflikten.
// SCRUM-496: Tabellenname bewusst NICHT "overlaps" — OVERLAPS ist ein reserviertes
// Postgres-Keyword (SQL-Operator), unquotiert ist "CREATE TABLE overlaps" ungültige Syntax
// (42601) und migrate() brach beim Boot ab. "ko_overlaps" (Konvention wie ko_evidence) ist
// unkritisch. Die Tabelle existierte auf der Beta nie → reines CREATE, keine Datenmigration.
//
// JOB 3066 (bens Korrekturpflicht 4 zu R3) — DIE ZWEI AUSDRUCKS-INDIZES ZUM PRÄDIKAT DES
// AUFRÄUMWEGS. `closeOpenForKo` (unten) sucht über `data->>'koA'` und `data->>'koB'`; die Tabelle
// trug bisher nur den Primärschlüssel auf `id`, ein solches Prädikat wäre also ein Seq Scan über
// den GESAMTEN Bestand — im gehaltenen Transaktionskörper der Endlöschung genau das, was der
// PurgeTxCleanup-Vertrag vermeiden will. Zwei getrennte Indizes statt eines zusammengesetzten,
// weil das Prädikat ein OR über zwei Felder ist (BitmapOr über beide, nicht ein Präfix).
// Additiv und wiederholbar (`IF NOT EXISTS`) wie alle Stufen hier; NICHT `CONCURRENTLY`, weil
// migrate() die Stufen in einer Sitzung fährt und CONCURRENTLY dort nicht laufen darf.
// EHRLICHE GRENZE: dass der Planer sie tatsächlich wählt, ist NICHT nachgemessen — dafür braucht
// es eine laufende Instanz (`EXPLAIN ANALYZE` auf grossem Bestand), und in der Bahn-Sandkiste
// gibt es keine. Was gebaut ist, ist die Voraussetzung dafür, nicht ihr Beleg.
export const OVERLAP_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_overlaps (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ko_overlaps_koa_idx ON ko_overlaps ((data->>'koA'));
CREATE INDEX IF NOT EXISTS ko_overlaps_kob_idx ON ko_overlaps ((data->>'koB'));
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

  async all(): Promise<OverlapEntry[]> {
    const res = await this.pool.query<OverlapRow>("SELECT data FROM ko_overlaps");
    return res.rows.map((row) => row.data);
  }

  // JOB 3066: MIT tx laufen Lesen und Schreiben auf DEM EINEN Client, den withPgTx per BEGIN
  // geöffnet hat — derselben Transaktion wie repo.delete und audit.record der Endlöschung. Ohne tx
  // unverändert am Pool (eigene Verbindung je Aufruf). Diese Weiche ist der ganze Unterschied
  // zwischen „committen gemeinsam" und „das eine bleibt, das andere rollt zurück".
  private q(tx?: TxContext): Queryable {
    return tx ? pgQueryable(tx) : poolQueryable(this.pool);
  }

  async update(entry: OverlapEntry): Promise<void> {
    await this.pool.query("UPDATE ko_overlaps SET data=$2 WHERE id=$1", [
      entry.id,
      JSON.stringify(entry),
    ]);
  }

  // DER MENGENBASIERTE SCHLIESS-SCHRITT: EIN Statement für Auswahl UND Schreiben, dessen Aufwand
  // an den Überschneidungen GENAU DIESES Beitrags hängt — nicht am Gesamtbestand der Tabelle (das
  // war R1 mit `all()`) und nicht an der Trefferzahl in Einzelanweisungen (das war R3 mit
  // `openForKo` + n × `update`). Genau das verlangt der PurgeTxCleanup-Vertrag
  // (knowledge-object/src/service.ts:248-255): im gehaltenen Transaktionskörper stehen
  // mengenbasierte Anweisungen, keine Schleifen über Einzelobjekte.
  //
  // `data || $2::jsonb` mischt den Patch in das vorhandene jsonb (kein Vollobjekt-
  // Read-Modify-Write: Felder, die ein anderer Vorgang gesetzt hat, bleiben erhalten).
  // `coalesce(...,'offen')` ist fail-safe für Altbestand ohne Statusfeld: fehlt der Status, gilt
  // der Eintrag als offen und wird geschlossen — ein NULL-Vergleich hätte ihn stumm übersprungen.
  // `RETURNING data` liefert den NEUEN Stand: der Dienst bekommt Kennungen und Anzahl aus
  // derselben Anweisung, die geschrieben hat, und muss dafür nicht ein zweites Mal lesen.
  //
  // ZUM AUFWAND IN DER DATENBANK: das Prädikat läuft über zwei jsonb-Ausdrücke, für die
  // OVERLAP_SCHEMA je einen Ausdrucks-Index führt (s. oben). Ob der Planer sie wählt, ist hier
  // NICHT nachgemessen — das braucht eine laufende Instanz (`EXPLAIN ANALYZE`), und in der
  // Bahn-Sandkiste läuft keine. Was hier steht, ist die Voraussetzung, nicht der Messwert.
  async closeOpenForKo(
    koId: string,
    patch: Partial<OverlapEntry>,
    tx?: TxContext,
  ): Promise<OverlapEntry[]> {
    const res = await this.q(tx).query<OverlapRow>(
      `UPDATE ko_overlaps
          SET data = data || $2::jsonb
        WHERE (data->>'koA' = $1 OR data->>'koB' = $1)
          AND coalesce(data->>'status', 'offen') <> 'geschlossen'
        RETURNING data`,
      [koId, JSON.stringify(patch)],
    );
    return res.rows.map((row) => row.data);
  }
}
