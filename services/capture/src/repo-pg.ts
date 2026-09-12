import type { Pool } from "pg";
import type { DraftAnlageErgebnis, DraftRepo } from "./repo";
import type { Draft } from "./types";

export const CAPTURE_SCHEMA = `
CREATE TABLE IF NOT EXISTS drafts (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
-- JOB 2696 (Review-Befund R2-33): Index auf dem AUSDRUCK, nach dem die Entwurfsliste filtert.
-- ADDITIV und idempotent (IF NOT EXISTS) — die Tabelle bleibt unberuehrt, es kommt nur ein Index
-- dazu. Ohne ihn waere listByAuthor zwar sparsam an Bytes, aber weiterhin ein Tabellendurchlauf:
-- PostgreSQL muesste jede Zeile anfassen, um den Ausdruck erst zu berechnen.
-- (Keine schraegen Anfuehrungszeichen in diesem Block: er steht in einem Template-Literal und
--  wuerde es sonst beenden.)
CREATE INDEX IF NOT EXISTS drafts_original_author_idx
  ON drafts ((data->>'originalAuthor'));
`;

// ================================================================================================
// JOB 2697 — DER DAUERHAFTE SITZ DER EINDEUTIGKEIT EINES ANLAGE-VORGANGS.
// ================================================================================================
//
// DAS MUSTER IST ÜBERNOMMEN, NICHT ERFUNDEN: jsonb-Vollobjekt plus Generated-Spalten plus
// partieller Unique-Index — genau wie `KO_CREATE_OPERATION_SCHEMA`
// (`services/knowledge-object/src/repo-pg.ts:114-124`). Eine Anwendungsprüfung behauptet
// Eindeutigkeit; ein Index erzwingt sie, auch über zwei Serverinstanzen und über einen Neustart.
//
// `COALESCE(create_operation_actor, '')` IST KEIN ZIERRAT. In einem Unique-Index hält PostgreSQL
// zwei NULL-Werte für VERSCHIEDEN. Ohne `COALESCE` wären zwei Zeilen mit gleicher Kennung und
// fehlendem Eigentümer beide erlaubt — die Zusage wäre still gebrochen. Der Ausdruck im Index muss
// zeichengleich dem im `ON CONFLICT` sein, sonst greift die Konfliktklausel nicht.
//
// DER INDEX IST PARTIELL (`WHERE create_operation_id IS NOT NULL`): Entwürfe ohne Vorgang — also
// jeder heutige Bestand und jeder Aufruf über den unveränderten Pfad — fallen heraus und
// kollidieren nie.
//
// KEIN `DROP INDEX`, anders als beim Wissensobjekt. Dort musste ein alter, DB-weiter Index
// weichen; für `drafts` gibt es keinen. Die Stufe ist rein ADDITIV: nur `ADD COLUMN IF NOT EXISTS`
// und `CREATE UNIQUE INDEX IF NOT EXISTS`, kein DROP, kein DELETE, kein UPDATE an Bestandsdaten.
// Die Datenmigration ist LEER — kein vorhandener Entwurf trägt `createOperation`.
//
// EIGENE STUFE STATT ERWEITERUNG VON `CAPTURE_SCHEMA`, und eine benannte Falle dazu: Der
// Migrationswächter sammelt `*_SCHEMA`-Konstanten; diese hier trägt kein `CREATE TABLE`. Sie
// braucht deshalb einen eigenen Pin, sonst fällt sie geräuschlos aus der Migrationsprüfung —
// beim Wissensobjekt ist das T-M-3.
//
// UNBEWIESENE HYPOTHESE, ehrlich benannt: dass PostgreSQL diese DDL annimmt, ist in dieser
// Umgebung nicht geprüft — es läuft hier keine Datenbank (Befund samt Fehlertexten in der
// Rückgabe D7). Belegt ist, was der Adapter absetzt und wie er sich bei Konflikt verhält.
export const CAPTURE_CREATE_OPERATION_SCHEMA = `
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS create_operation_id text
  GENERATED ALWAYS AS (data->'createOperation'->>'id') STORED;
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS create_operation_actor text
  GENERATED ALWAYS AS (data->'createOperation'->>'actor') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS drafts_create_operation_owner_uq
  ON drafts (create_operation_id, COALESCE(create_operation_actor, ''))
  WHERE create_operation_id IS NOT NULL;
`;

// KEINE eigene Konstante für den Constraint-Namen, anders als beim Wissensobjekt
// (`KO_CREATE_OPERATION_CONSTRAINT`, `knowledge-object/src/repo-pg.ts:130`): Dort wird sie
// gebraucht, weil `insert` die Unique-Verletzung am NAMEN erkennt und in einen Domänenfehler
// übersetzt. Hier fängt `ON CONFLICT DO NOTHING` die Kollision, bevor ein Fehler entsteht — der
// Name käme in keiner einzigen Zeile Code vor. Ein Export ohne Aufrufer ist genau das, was
// `tests/capture/aufrufer-waechter.test.ts` verhindert.

interface DraftRow {
  data: Draft;
}

// ================================================================================================
// JOB 3668 — DER PAPIERKORB DER ENTWÜRFE, UND WARUM ER OHNE SCHEMASTUFE AUSKOMMT.
// ================================================================================================
//
// DAS PRÄDIKAT IST WÖRTLICH DAS DES WISSENSOBJEKTS: `NOT (data ? 'deletedAt')` steht dort an
// `missingActive`, `setAiCheck` und `setTrust` (`knowledge-object/src/repo-pg.ts:493`, `:623`,
// `:683`). Es fragt nach dem VORHANDENSEIN des Schlüssels im Dokument — deshalb braucht dieser
// Papierkorb KEINE Spalte, KEINE Migrationsstufe und damit auch keinen Rückweg, den jemand fahren
// müsste. Er ist additiv von Natur aus: ein Dokument bekommt zwei Schlüssel mehr.
//
// UND DESHALB AUCH KEINE GENERIERTE SPALTE, anders als beim Wissensobjekt (`repo-pg.ts:223`
// `deleted_at`). Dort MUSS das Papierkorbprädikat vor dem `LIMIT` und vor dem Cursor wirken, sonst
// liefert eine Seite weniger Zeilen als versprochen (die Begründung steht ausgeschrieben bei
// `:185`). Die Entwurfsabfragen haben weder Deckel noch Cursor — sie liefern die Entwürfe EINES
// Autors, und für den Autorfilter liegt der Index seit JOB 2696 bereits richtig. Eine Spalte, die
// nichts trägt, wäre eine Migration ohne Aufgabe.
const IM_PAPIERKORB = "data ? 'deletedAt'";
const AKTIV = `NOT (${IM_PAPIERKORB})`;

/**
 * JOB 2684 D3: die Schreibanweisung mit Standbedingung — exportiert, damit ein Test sie pinnt.
 *
 * JOB 3668: um die Papierkorb-Bedingung erweitert. Sie steht im SELBEN `WHERE` und ändert deshalb
 * nichts am Compare-and-Swap: `rowCount` entscheidet weiterhin, und ein getrashter Entwurf ist
 * jetzt schlicht kein gültiger Stand. Ohne sie könnte ein Schreiber, der den Stand von VOR der
 * Löschung hält, den Entwurf still zurück ins Leben holen.
 */
export const DRAFT_UPDATE_WENN_STAND_SQL = `UPDATE drafts SET data=$2 WHERE id=$1 AND ${AKTIV} AND data->>'updatedAt' = $3`;

export class PgDraftRepo implements DraftRepo {
  constructor(private readonly pool: Pool) {}

  async insert(draft: Draft): Promise<void> {
    await this.pool.query("INSERT INTO drafts(id,data) VALUES($1,$2)", [
      draft.id,
      JSON.stringify(draft),
    ]);
  }

  /**
   * JOB 2697 — die Postgres-Hälfte: EIN Konfliktweg, danach die Nachlese über DASSELBE Paar.
   *
   * `ON CONFLICT ... DO NOTHING` gegen den partiellen Unique-Index: greift der Index, kommt keine
   * Zeile zurück — und erst dann wird nachgeschlagen. Kein „erst suchen, dann einfügen", in das
   * zwei gleichzeitige Klicks fallen könnten.
   *
   * DIE ABWEICHUNG VOM KO-MUSTER, ausdrücklich benannt — sie ist der wichtigste Einzelpunkt hier:
   * Der KO-Nachschlag trägt einen Zweig `OR create_operation_actor IS NULL`
   * (`knowledge-object/src/repo-pg.ts:269`). Er existiert dort nur wegen der mega20-Altzeilen.
   * FÜR `drafts` GIBT ES DIESEN ALTBESTAND NICHT — der Zweig wäre hier keine Rücksicht, sondern
   * eine Lücke: er fände eine Zeile mit fehlendem Eigentümer und gäbe sie einem beliebigen
   * Anfragenden zurück. Wer das KO-Muster blind kopiert, kopiert die Altlast mit.
   */
  async insertIfOperationAbsent(draft: Draft): Promise<DraftAnlageErgebnis> {
    if (!draft.createOperation) {
      await this.insert(draft);
      return { angelegt: true, draft };
    }
    const angelegt = await this.pool.query<DraftRow>(
      `INSERT INTO drafts(id,data) VALUES($1,$2::jsonb)
       ON CONFLICT (create_operation_id, COALESCE(create_operation_actor, ''))
       WHERE create_operation_id IS NOT NULL
       DO NOTHING RETURNING data`,
      [draft.id, JSON.stringify(draft)],
    );
    if ((angelegt.rowCount ?? 0) > 0) {
      return { angelegt: true, draft: angelegt.rows[0]?.data ?? draft };
    }
    const bestehend = await this.pool.query<DraftRow>(
      `SELECT data FROM drafts
        WHERE create_operation_id = $1
          AND COALESCE(create_operation_actor, '') = $2
        LIMIT 1`,
      [draft.createOperation.id, draft.createOperation.actor],
    );
    const treffer = bestehend.rows[0]?.data;
    if (!treffer) {
      // Der Vorgang ist zwischen Konflikt und Nachlese verschwunden (gelöscht). Ehrlich: dann gibt
      // es nichts zurückzugeben — der Aufrufer bekommt seinen eigenen Datensatz, ohne dass eine
      // fremde Zeile erfunden wird.
      return { angelegt: true, draft };
    }
    return { angelegt: false, bestehend: treffer };
  }

  // JOB 3668: DER PAPIERKORB IST HIER AUSGEBLENDET — die tragende Zeile. Jeder Einzelzugriff auf
  // einen Entwurf läuft durch diese Methode (Dienst, Routen, Fortsetzen, Einreichen); dass sie
  // einen getrashten Entwurf nicht herausgibt, macht ihn für alle gewöhnlichen Wege nicht
  // vorhanden, ohne dass eine einzige dieser Stellen davon wissen muss.
  async findById(id: string): Promise<Draft | undefined> {
    const res = await this.pool.query<DraftRow>(
      `SELECT data FROM drafts WHERE id=$1 AND ${AKTIV}`,
      [id],
    );
    return res.rows[0]?.data;
  }

  // JOB 3668: dieselbe Bedingung wie in `updateWennStand` — kein Schreibweg holt einen getrashten
  // Entwurf zurück ins Leben, auch nicht der ohne Standprüfung.
  async update(draft: Draft): Promise<void> {
    await this.pool.query(`UPDATE drafts SET data=$2 WHERE id=$1 AND ${AKTIV}`, [
      draft.id,
      JSON.stringify(draft),
    ]);
  }

  // JOB 2684 D3 (R2-17): DER COMPARE-AND-SWAP IN DER ABFRAGE. Die Bedingung steht im `WHERE`
  // derselben Anweisung, die schreibt — Postgres prüft und schreibt in EINEM Schritt, es gibt kein
  // Fenster zwischen Lesen und Schreiben, und es gibt keinen Prozess, der das umgehen könnte:
  // zwei Serverprozesse mit demselben gelesenen Stand → genau einer trifft `rowCount 1`, der andere
  // `0`. Der Vergleich läuft auf `data->>'updatedAt'` (Text, streng steigend seit D1) — keine
  // eigene Spalte, keine Migration; die Tabelle bleibt wie sie ist.
  async updateWennStand(draft: Draft, erwarteterStand: string): Promise<boolean> {
    const res = await this.pool.query(DRAFT_UPDATE_WENN_STAND_SQL, [
      draft.id,
      JSON.stringify(draft),
      erwarteterStand,
    ]);
    return res.rowCount === 1;
  }

  /**
   * JOB 3668 — HIER STAND DER BEFUND: `DELETE FROM drafts WHERE id=$1`.
   *
   * Pedi am 11.09.2026: *„Ich habe eben alle Entwürfe gelöscht. Nicht einer befindet sich im
   * Papierkorb."* Er hatte recht, und diese Zeile war der Grund — die Zeile war danach fort, es
   * gab keinen Ort, an dem ein Papierkorb hätte entstehen können.
   *
   * `data || $2::jsonb` FÜGT HINZU, es ersetzt nicht: der ganze übrige Entwurf bleibt Zeichen für
   * Zeichen stehen, weshalb `restore` ihn vollständig zurückgeben kann und nicht als Hülle. Die
   * Bedingung `NOT (data ? 'deletedAt')` macht den Aufruf idempotent: ein zweites Löschen
   * verschiebt den ursprünglichen Zeitpunkt nicht (sonst liesse sich eine Papierkorbfrist durch
   * Wiederholen verlängern) und löscht erst recht nicht hart.
   *
   * DER ZEITPUNKT KOMMT AUS NODE, nicht aus `now()`. Damit steht in beiden Ablagen dieselbe Uhr,
   * und ein Test, der die Speicherablage misst, sagt etwas über den Betrieb aus.
   */
  async delete(id: string, geloeschtVon?: string, zeitpunkt?: string): Promise<void> {
    const vermerk = {
      deletedAt: zeitpunkt ?? new Date().toISOString(),
      ...(geloeschtVon === undefined ? {} : { deletedBy: geloeschtVon }),
    };
    await this.pool.query(`UPDATE drafts SET data = data || $2::jsonb WHERE id=$1 AND ${AKTIV}`, [
      id,
      JSON.stringify(vermerk),
    ]);
  }

  // JOB 3668: DIE EINZIGE HARTE LÖSCHUNG DES ADAPTERS — wörtlich die Anweisung, die bis zu diesem
  // Auftrag in `delete` stand. Sie ist nicht verschwunden, sie hat ihren richtigen Namen bekommen.
  //
  // RUNDE 2 — DIE PAPIERKORB-BEDINGUNG STEHT JETZT IM SELBEN `WHERE`, und das ist kein Feinschliff.
  // Der echte PostgreSQL-Lauf vom 12.09. hat genau hier gehalten (`P3`): `purge` auf einen
  // LEBENDEN Entwurf gab `true` — die Ablage entfernte, was der Dienst zu schützen behauptete, und
  // die Bedingung im Dienst kam einen Schritt zu spät. Dasselbe Fenster verlor im Nebenlauf einen
  // gerade wiederhergestellten Entwurf. Jetzt entscheidet PostgreSQL Bedingung und Löschung in
  // EINER Anweisung; wer verliert, bekommt `rowCount 0` und daraus im Dienst ein ehrliches 404.
  //
  // DER SICHERE FALL IST DER NORMALFALL: ohne Wort entfernt diese Methode nur aus dem Papierkorb.
  // `auchLebende` setzt allein der Verbrauchsweg (`entwurfVerbraucht`) — ein Entwurf, aus dem
  // gerade ein Wissensobjekt geworden ist, hat den Papierkorb nie gesehen und muss trotzdem
  // gehen. Es bleibt EINE Mechanik: dieselbe Methode, dieselbe Anweisung, ein Prädikat mehr oder
  // weniger. `rowCount` sagt ehrlich, ob etwas entfernt wurde.
  async purge(id: string, auchLebende = false): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM drafts WHERE id=$1${auchLebende ? "" : ` AND ${IM_PAPIERKORB}`}`,
      [id],
    );
    return res.rowCount === 1;
  }

  // JOB 3668: `data - 'deletedAt' - 'deletedBy'` streift GENAU die zwei Papierkorb-Schlüssel ab und
  // lässt den Rest unberührt — der Speicher-Spiegel tut mit seinem Rest-Destrukturieren dasselbe.
  // `RETURNING data` liefert den wiederhergestellten Stand aus DERSELBEN Anweisung; ein zweiter
  // Lesezugriff hätte ein Fenster, in dem jemand anderes schreibt.
  async restore(id: string): Promise<Draft | undefined> {
    const res = await this.pool.query<DraftRow>(
      `UPDATE drafts SET data = data - 'deletedAt' - 'deletedBy'
        WHERE id=$1 AND ${IM_PAPIERKORB}
        RETURNING data`,
      [id],
    );
    return res.rows[0]?.data;
  }

  async findTrashed(
    id: string,
  ): Promise<(Draft & { deletedAt: string; deletedBy?: string }) | undefined> {
    const res = await this.pool.query<DraftRow>(
      `SELECT data FROM drafts WHERE id=$1 AND ${IM_PAPIERKORB}`,
      [id],
    );
    return res.rows[0]?.data as (Draft & { deletedAt: string; deletedBy?: string }) | undefined;
  }

  // JOB 3668: die Papierkorb-Sicht. Die Eingrenzung auf den Autor geschieht IN DER ABFRAGE (JOB
  // 2696s Lehre: sonst verlassen bis zu 5 MiB fremder Rümpfe die Datenbank, bevor irgendjemand
  // filtert) und benutzt denselben Ausdruck `data->>'originalAuthor'`, auf dem
  // `drafts_original_author_idx` seit JOB 2696 liegt. Sortiert nach Löschzeitpunkt absteigend —
  // dieselbe Reihenfolge wie `KoService.trashed`.
  async listTrashed(
    fuerAutor?: string,
  ): Promise<(Draft & { deletedAt: string; deletedBy?: string })[]> {
    const res =
      fuerAutor === undefined
        ? await this.pool.query<DraftRow>(
            `SELECT data FROM drafts WHERE ${IM_PAPIERKORB} ORDER BY data->>'deletedAt' DESC`,
          )
        : await this.pool.query<DraftRow>(
            `SELECT data FROM drafts
              WHERE ${IM_PAPIERKORB} AND data->>'originalAuthor' = $1
              ORDER BY data->>'deletedAt' DESC`,
            [fuerAutor],
          );
    return res.rows.map((row) => row.data as Draft & { deletedAt: string; deletedBy?: string });
  }

  // JOB 3668: BEWUSST OHNE Papierkorbfilter — die Begründung steht am Vertrag (`DraftRepo.list`):
  // über diese Liste zählt die Referenzprüfung, ob ein gesichertes Original noch gebraucht wird,
  // und der Anker eines getrashten Entwurfs muss mitzählen, sonst kommt er ohne sein Original
  // zurück. Wer einem Menschen eine Liste zeigt, trimmt selbst (`GET /api/drafts`).
  async list(): Promise<Draft[]> {
    const res = await this.pool.query<DraftRow>(
      "SELECT data FROM drafts ORDER BY data->>'createdAt'",
    );
    return res.rows.map((row) => row.data);
  }

  // JOB 2696 (R2-33): dieselbe Abfrage, um EINE Bedingung erweitert — und genau die entscheidet,
  // ob 5 MiB fremder Entwuerfe ueber die Leitung gehen oder nicht. Die Sortierung bleibt wortgleich,
  // damit die Liste in derselben Reihenfolge steht wie bisher; der Ausdruck
  // `data->>'originalAuthor'` ist derselbe, auf dem `drafts_original_author_idx` liegt.
  async listByAuthor(authorId: string): Promise<Draft[]> {
    const res = await this.pool.query<DraftRow>(
      "SELECT data FROM drafts WHERE data->>'originalAuthor' = $1 ORDER BY data->>'createdAt'",
      [authorId],
    );
    return res.rows.map((row) => row.data);
  }
}
