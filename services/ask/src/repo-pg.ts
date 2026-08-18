import type { Pool } from "pg";
import { type AnswerSnapshotRepo, type GapRepo, pruefeSnapshotKette } from "./repo";
import { type AnswerEvidenceSnapshot, type AnswerRecord, AskError, type Gap } from "./types";

// ================================================================================================
// JOB 1111 / D-032 — DER DAUERHAFTE SITZ DER EINDEUTIGKEIT.
// ================================================================================================
//
// DAS MUSTER IST ÜBERNOMMEN, NICHT ERFUNDEN: jsonb-Vollobjekt plus Generated-Spalte plus
// Unique-Index — genau wie `ANSWER_SNAPSHOT_SCHEMA` weiter unten und wie im Bestand mehrfach
// erprobt. Eine Anwendungsprüfung behauptet Eindeutigkeit; ein Index erzwingt sie.
//
// DER INDEX IST BEWUSST PARTIELL (`WHERE ... = 'offen'`). Eine geschlossene Lücke ist abgearbeitet;
// dieselbe Frage darf danach wieder aufkommen. Ein Index über ALLE Zeilen würde das verhindern und
// aus einer erledigten Aufgabe eine Sperre machen.
//
// UND ER IST BEWUSST NULL-DURCHLÄSSIG — hier weicht diese Stufe absichtlich von BEN-33 Befund C
// ab („Schlüsselspalten sind NOT NULL"). Altbestände tragen keinen `compareKey`; ihre
// Generated-Spalte ist NULL, und PostgreSQL hält zwei NULLs für verschieden. Genau das ist hier
// gewollt: **bestehende Dubletten bleiben unangetastet** (D-032, Nicht-Ziel). Ein `SET NOT NULL`
// würde die Migration am Altbestand scheitern lassen, ein Backfill wäre die stille Migration, die
// diese Scheibe ausdrücklich NICHT vornimmt.
//
// ADDITIV: nur `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` und
// `CREATE UNIQUE INDEX IF NOT EXISTS`. Kein DROP, kein DELETE, kein UPDATE — die Stufe bleibt in
// `migrationsbeleg.ts` als `ADDITIV` klassifiziert (im Zielest über die echte Funktion gemessen).
//
// UNBEWIESENE HYPOTHESE, ehrlich benannt: dass PostgreSQL diese DDL annimmt, ist in dieser
// Umgebung nicht geprüft — es läuft hier keine Datenbank. Belegt ist, was der Adapter absetzt und
// wie er sich bei Konflikt verhält (Fake-Pool), und dass die Stufe additiv bleibt.
export const ASK_SCHEMA = `
CREATE TABLE IF NOT EXISTS gaps (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE gaps
  ADD COLUMN IF NOT EXISTS compare_key text
  GENERATED ALWAYS AS (data->>'compareKey') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS gaps_offener_vergleichsschluessel_uq
  ON gaps (compare_key) WHERE (data->>'status') = 'offen';
`;

interface GapRow {
  data: Gap;
}

export class PgGapRepo implements GapRepo {
  constructor(private readonly pool: Pool) {}

  async insert(gap: Gap): Promise<void> {
    await this.pool.query("INSERT INTO gaps(id,data) VALUES($1,$2)", [gap.id, JSON.stringify(gap)]);
  }

  /**
   * JOB 1111 / D-032 — anlegen oder hochzählen, in EINEM Konfliktweg.
   *
   * `ON CONFLICT ... DO NOTHING` gegen den partiellen Unique-Index: greift der Index, kommt keine
   * Zeile zurück, und erst dann wird gezählt. Das Hochzählen läuft als EINE Anweisung über
   * `jsonb_set` — kein Lesen-Rechnen-Schreiben, das zwei gleichzeitige Läufe auf denselben Wert
   * setzen könnte. Altbestände ohne Zähler gelten dabei als einmal gefragt (`COALESCE`).
   *
   * Ohne `compareKey` wird gar nicht verglichen: dann ist es eine gewöhnliche Neuanlage.
   */
  async insertOrIncrement(gap: Gap): Promise<{ gap: Gap; created: boolean }> {
    if (!gap.compareKey) {
      await this.insert(gap);
      return { gap, created: true };
    }
    const angelegt = await this.pool.query<GapRow>(
      `INSERT INTO gaps(id,data) VALUES($1,$2::jsonb)
       ON CONFLICT (compare_key) WHERE (data->>'status') = 'offen'
       DO NOTHING RETURNING data`,
      [gap.id, JSON.stringify(gap)],
    );
    if ((angelegt.rowCount ?? 0) > 0) {
      return { gap: angelegt.rows[0]?.data ?? gap, created: true };
    }
    const erhoeht = await this.pool.query<GapRow>(
      `UPDATE gaps
          SET data = jsonb_set(
                data,
                '{askCount}',
                to_jsonb(COALESCE((data->>'askCount')::int, 1) + 1)
              )
        WHERE (data->>'compareKey') = $1 AND (data->>'status') = 'offen'
        RETURNING data`,
      [gap.compareKey],
    );
    const treffer = erhoeht.rows[0]?.data;
    if (!treffer) {
      // Die offene Lücke ist zwischen Konflikt und Zählung verschwunden (geschlossen oder
      // gelöscht). Ehrlich: dann gibt es nichts hochzuzählen — der Aufrufer bekommt seinen
      // eigenen Datensatz zurück, ohne dass eine fremde Zeile erfunden wird.
      return { gap, created: false };
    }
    return { gap: treffer, created: false };
  }

  async findById(id: string): Promise<Gap | undefined> {
    const res = await this.pool.query<GapRow>("SELECT data FROM gaps WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  async update(gap: Gap): Promise<void> {
    await this.pool.query("UPDATE gaps SET data=$2 WHERE id=$1", [gap.id, JSON.stringify(gap)]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM gaps WHERE id=$1", [id]);
  }

  async all(): Promise<Gap[]> {
    const res = await this.pool.query<GapRow>("SELECT data FROM gaps");
    return res.rows.map((row) => row.data);
  }
}

// ================================================================================================
// W3-A (KW-W3-18) — DIE ANTWORTBELEGE, DATENBANKSEITIG APPEND-ONLY
// ================================================================================================
//
// ADDITIV UND WIEDERHOLBAR wie jedes Schema in diesem Repository: `CREATE TABLE IF NOT EXISTS`,
// `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`. Nichts wird entfernt, geleert
// oder umgeschrieben.
//
// DAS MUSTER IST UEBERNOMMEN, NICHT ERFUNDEN: jsonb-Vollobjekt plus Generated-Spalten plus
// Unique-Index. Es steht im Bestand mehrfach erprobt (knowledge-object/src/repo-pg.ts:62-69 und
// :107-118, library-analytics/src/repo-pg.ts:145-147 und :360-361). Die Revisionsidentitaet
// (answer_id + snapshot_revision) wird damit DATENBANKSEITIG erzwungen und nicht bloss von der
// Anwendung behauptet — eine Anwendungspruefung verliert jedes Rennen, ein Unique-Index nicht.
//
// DIE SCHLUESSELSPALTEN SIND NOT NULL. Die Lehre aus BEN-33 Befund C: ein Unique-Index ueber
// NULL-faehige Spalten sagt fast nichts zu, weil PostgreSQL zwei NULLs fuer verschieden haelt.
//
// EHRLICH BENANNT — DIESE KONSTANTE IST NOCH NICHT MIGRIERT. `services/app/src/db.ts` ist von
// Auftrag 56 ausdruecklich ausgeschlossen; die App-Einbindung ist eine eigene Welle. Bis dahin
// meldet `db.migrate.test.ts` diesen Namen als nicht migriert, und das ist die WAHRE Auskunft.
export const ANSWER_SNAPSHOT_SCHEMA = `
CREATE TABLE IF NOT EXISTS answer_records (
  answer_id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS answer_snapshots (
  snapshot_key text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE answer_snapshots
  ADD COLUMN IF NOT EXISTS answer_id text
  GENERATED ALWAYS AS (data->>'answerId') STORED;
ALTER TABLE answer_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_revision_key text
  GENERATED ALWAYS AS (data->>'snapshotRevision') STORED;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'answer_snapshots_identitaet_ck'
       AND conrelid = 'answer_snapshots'::regclass
  ) THEN
    ALTER TABLE answer_snapshots
      ADD CONSTRAINT answer_snapshots_identitaet_ck CHECK (
        btrim(coalesce(data->>'answerId', '')) <> ''
        AND coalesce(data->>'snapshotRevision', '') ~ '^[0-9]{1,9}$'
      );
  END IF;
END $$;
ALTER TABLE answer_snapshots ALTER COLUMN answer_id SET NOT NULL;
ALTER TABLE answer_snapshots ALTER COLUMN snapshot_revision_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS answer_snapshots_revision_uq
  ON answer_snapshots (answer_id, snapshot_revision_key);
CREATE INDEX IF NOT EXISTS idx_answer_snapshots_antwort
  ON answer_snapshots (answer_id);
`;

interface AnswerRecordRow {
  data: AnswerRecord;
}

interface AnswerSnapshotRow {
  data: AnswerEvidenceSnapshot;
}

export class PgAnswerSnapshotRepo implements AnswerSnapshotRepo {
  constructor(private readonly pool: Pool) {}

  /**
   * `ON CONFLICT DO NOTHING` ist hier mehr als Bequemlichkeit: es ist die Zusage, dass die
   * VORHANDENE Zeile unangetastet bleibt. Ein `DO UPDATE` waere genau das stille Ueberschreiben,
   * das KW-W3-18 verbietet.
   */
  async createRecord(record: AnswerRecord): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO answer_records(answer_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (answer_id) DO NOTHING RETURNING answer_id`,
      [record.answerId, JSON.stringify(record)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async findRecord(answerId: string): Promise<AnswerRecord | undefined> {
    const res = await this.pool.query<AnswerRecordRow>(
      "SELECT data FROM answer_records WHERE answer_id = $1",
      [answerId],
    );
    return res.rows[0]?.data;
  }

  async appendSnapshot(snapshot: AnswerEvidenceSnapshot): Promise<boolean> {
    if (!(await this.findRecord(snapshot.answerId))) {
      throw new AskError("NOT_FOUND", "Zu diesem Snapshot gibt es keine Antwort.");
    }
    const schluessel = `${snapshot.answerId}@${snapshot.snapshotRevision}`;
    const vorhanden = await this.pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM answer_snapshots WHERE snapshot_key = $1",
      [schluessel],
    );
    // Idempotenz VOR der Kettenpruefung — dieselbe Reihenfolge wie InMemory (Paritaet des
    // Erfolgs- UND des Fehlervertrags).
    if (vorhanden.rows[0]?.n !== "0") {
      return false;
    }
    pruefeSnapshotKette(snapshot, await this.listSnapshots(snapshot.answerId));
    const res = await this.pool.query(
      `INSERT INTO answer_snapshots(snapshot_key, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (answer_id, snapshot_revision_key) DO NOTHING RETURNING snapshot_key`,
      [schluessel, JSON.stringify(snapshot)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async findSnapshot(
    answerId: string,
    revision: number,
  ): Promise<AnswerEvidenceSnapshot | undefined> {
    const res = await this.pool.query<AnswerSnapshotRow>(
      "SELECT data FROM answer_snapshots WHERE answer_id = $1 AND snapshot_revision_key = $2",
      [answerId, String(revision)],
    );
    return res.rows[0]?.data;
  }

  async listSnapshots(answerId: string): Promise<AnswerEvidenceSnapshot[]> {
    const res = await this.pool.query<AnswerSnapshotRow>(
      "SELECT data FROM answer_snapshots WHERE answer_id = $1",
      [answerId],
    );
    // Numerisch am typisierten Feld sortiert — der Schluessel ist Text, die Ordnung ist eine Zahl.
    return res.rows.map((row) => row.data).sort((a, b) => a.snapshotRevision - b.snapshotRevision);
  }

  async latestSnapshot(answerId: string): Promise<AnswerEvidenceSnapshot | undefined> {
    const alle = await this.listSnapshots(answerId);
    return alle.length > 0 ? alle[alle.length - 1] : undefined;
  }
}
