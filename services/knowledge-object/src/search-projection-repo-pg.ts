import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable } from "../../db-tx";
import type { KoMetadataProjectionRepo } from "./metadata-projection-repo";
import { PgKoMetadataProjectionRepo } from "./metadata-projection-repo-pg";
import {
  type KoSearchHit,
  type KoSearchProjection,
  type KoSearchQuery,
  SEARCH_PROJECTION_VERSION,
  type SearchProjectionStatus,
  expandSearchTerms,
  normalizeSearchTerms,
  parseClassificationSnapshot,
  serializeClassificationSnapshot,
} from "./search-projection";
import {
  type KoSearchProjectionRepo,
  type ProjectionAudit,
  type ProjectionControlSitzung,
  type ProjectionControlState,
  type ProjectionState,
  UNINITIALIZED_CONTROL_STATE,
  entfernungInvalidiert,
  freigegebeneProjektion,
  schreibStempel,
} from "./search-projection-repo";

// ================================================================================================
// G27 — DIE ADDITIVE MIGRATION DER SUCHPROJEKTION
// ================================================================================================
//
// SEPARATE TABELLE, kein neues Feld an `kos` und keine Erzeugung zur Laufzeit — so entschieden in
// der Architektur-Mikroentscheidung G27. Der Grund ist der Primärschlüssel: eine Projektion gehört
// zu (ko_id, ko_version). Als Spalte an `kos` gäbe es nur EINE, sie könnte keine Version tragen,
// und ein Rebuild müsste den Bestand überschreiben.
//
// ADDITIV im strengen Sinn: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS +
// CREATE INDEX IF NOT EXISTS. Kein DROP, kein TRUNCATE, keine Änderung am KO-Datenmodell. Die
// Migration ist wiederholbar und nimmt nichts weg.
//
// ------------------------------------------------------------------------------------------------
// DIE V1→V2-STUFE (Detailentscheidung J) — WARUM `CREATE TABLE IF NOT EXISTS` ALLEIN FALSCH WÄRE
// ------------------------------------------------------------------------------------------------
//
// `CREATE TABLE IF NOT EXISTS` ist idempotent, aber NICHT migrierend: gegen eine Umgebung, die die
// Tabelle in Fassung 1 bereits angelegt hat, ist es ein reines No-op — die Tabelle bleibt exakt so
// stehen, wie sie war. Fassung 2 fügt gegenüber Fassung 1 zwei Spalten hinzu (`body_text`,
// `classification_snapshot`); ohne eigene Stufe fehlten sie dort weiter, und der ERSTE V2-Insert
// (er schreibt beide Spalten) bräche mit „column ... does not exist" ab. Das ist keine Theorie: die
// Annahme „V1 existiert nirgends" ist genau das No-Go aus Abschnitt J.
//
// Deshalb steht zwischen CREATE TABLE und den Indizes eine ADDITIVE Nachrüststufe:
// `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` je neuer V2-Spalte. Sie ist wiederholbar (zweiter Lauf
// = No-op), nimmt nichts weg und läuft VOR jedem V2-Insert — die Reihenfolge innerhalb dieses einen
// DDL-Blocks ist die Zusage „V2-Inserts erst gegen ein additiv vollständiges Schema".
//
// DIE DEFAULTS BEHAUPTEN NICHTS. `body_text` bekommt den Leerwert und `classification_snapshot`
// ebenfalls — und der Leerwert ist ausdrücklich KEINE Aussage: `parseClassificationSnapshot("")`
// liefert fail-safe `none` / `reconstructed_from_current_ko` / `historical_confidence = unknown`,
// also „hier steht nichts, und nichts davon ist bestätigt". Ein Default wie `intern` oder
// `verified` wäre eine erfundene historische Sicherheit (No-Go, Abschnitt J).
//
// DIE BESTANDSZEILEN BLEIBEN V1. Die Stufe rührt `projection_version` NICHT an: eine nachgerüstete
// Zeile trägt weiter die 1 und ist damit für `missingActive` (`projection_version <> 2`) und für
// `inventoryByProjectionVersion` eindeutig als Fassung 1 sichtbar. Erst der ausdrücklich benannte
// Nachzug/Rebuild (`backfillSearchProjections` / `rebuildSearchProjections`) leitet sie
// deterministisch neu ab und setzt die 2. Die Schemamigration allein macht KEINE Zeile zu V2 —
// „Projection-Version still auf 2 setzen, bevor der V2-Rebuild vollständig ist" ist ausgeschlossen.
//
// ------------------------------------------------------------------------------------------------
// DIE LEGACY-SPALTEN category_text UND tag_text
// ------------------------------------------------------------------------------------------------
//
// Sie bleiben PHYSISCH stehen, ausschließlich aus Kompatibilitätsgründen (Auftrag „Migration und
// Kompatibilität"): eine Umgebung, die die Tabelle bereits angelegt hat, würde an einer plötzlich
// fehlenden NOT-NULL-Spalte scheitern, und eine destruktive Migration ist ausgeschlossen.
//
// Sie sind aber KEINE fachliche Quelle mehr und nicht Teil des neuen äußeren Vertrags: geschrieben
// wird ausdrücklich der Leerwert, gelesen werden sie nirgends, und in `KoSearchProjection` gibt es
// sie nicht. Wer Kategorie oder Schlagwörter sucht, trifft die Metadatenprojektion — sonst nichts.
//
// DIE INDIZES, jeder einzeln begründet:
//  · PRIMARY KEY (ko_id, ko_version) — erzwingt die Append-only-Zusage in der Datenbank (ON
//    CONFLICT DO NOTHING kann eine bestehende Zeile dann nicht überschreiben) UND bedient den
//    Punkt-Nachschlag der aktiven Version.
//  · GIN-Trigramm auf search_text — genau der Ausdruck, gegen den die Standardsuche ihr
//    `ILIKE '%begriff%'` fährt. Ohne ihn wäre die Volltextsuche ein sequenzieller Scan über den
//    gesamten Index. pg_trgm existiert bereits (KO_SCHEMA legt die Extension an und läuft davor).
//  · content_hash — der Rebuild-/Abgleichweg („welche Zeilen haben sich wirklich geändert?").
//  · projection_version — die Arbeitsliste des V1/V2-Mischbestands (`missingActive`,
//    `inventoryByProjectionVersion`). Ohne ihn wäre „welche Zeilen sind noch Fassung 1?" ein
//    vollständiger Scan der Projektionstabelle.
// KEIN Index auf title/statement/caption/body: diese Felder werden NUR auf der bereits durch
// search_text gefilterten Treffermenge ausgewertet (Fundstellen-Kennzeichnung), nie als
// eigenständiger Sucheinstieg. Vier weitere GIN-Indizes wären reine Schreiblast ohne Nutzen.
//
// KEINE Vektorsuche, KEINE Embeddings, KEIN neuer externer Dienst.
export const KO_SEARCH_PROJECTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_search_projections (
  ko_id text NOT NULL,
  ko_version int NOT NULL,
  projection_version int NOT NULL,
  search_text text NOT NULL,
  title_text text NOT NULL,
  statement_text text NOT NULL,
  category_text text NOT NULL DEFAULT '',
  tag_text text NOT NULL DEFAULT '',
  caption_text text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  language text NOT NULL,
  content_hash text NOT NULL,
  status text NOT NULL,
  classification_snapshot text NOT NULL DEFAULT '',
  -- G27 R1 / Entscheidung 09 §2: die Generation, zu der diese Zeile gehört. Sie steht HIER UND in
  -- der Nachrüststufe unten, damit eine frisch angelegte und eine nachgerüstete Tabelle
  -- strukturgleich sind — sonst hinge die Suche auf einer neuen Instanz an einer Spalte, die es
  -- dort nur zufällig auch gibt.
  generation bigint,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  PRIMARY KEY (ko_id, ko_version)
);
-- V1→V2, additiv und wiederholbar (Detailentscheidung J): die beiden gegenüber Fassung 1 NEUEN
-- Spalten werden an einer bestehenden V1-Tabelle nachgerüstet, an einer frisch angelegten sind die
-- Anweisungen No-ops. Gleiche Typen und gleiche Defaults wie oben — eine nachgerüstete und eine neu
-- angelegte Tabelle sind danach strukturgleich. Der Leerwert behauptet nichts (s. Kopf).
ALTER TABLE ko_search_projections
  ADD COLUMN IF NOT EXISTS body_text text NOT NULL DEFAULT '';
ALTER TABLE ko_search_projections
  ADD COLUMN IF NOT EXISTS classification_snapshot text NOT NULL DEFAULT '';
-- G27 R1 / Entscheidung 09 §2: DIE GENERATION AN DER ZEILE. Ebenfalls additiv und wiederholbar.
-- NULLABLE und ohne Default — und das ist die Aussage: eine Bestandszeile aus der Zeit vor dieser
-- Stufe trägt KEINE Generation, weil sie zu keinem generationierten Bauzyklus gehört. Ein Default
-- wie 0 würde behaupten, sie gehöre zur Generation 0; ein NOT NULL DEFAULT würde sie sogar in
-- jede spätere Prüfung als „irgendwie zugehörig" hineinrechnen. NULL heisst hier ehrlich „nicht
-- aus einem freigegebenen Zyklus" — und genau so liest es die Suche: nicht bedienend.
ALTER TABLE ko_search_projections
  ADD COLUMN IF NOT EXISTS generation bigint;
CREATE INDEX IF NOT EXISTS idx_ko_search_projections_search_trgm
  ON ko_search_projections USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ko_search_projections_hash
  ON ko_search_projections(content_hash);
CREATE INDEX IF NOT EXISTS idx_ko_search_projections_pversion
  ON ko_search_projections(projection_version);
-- Der Index, den die Suche seit 09 §3 wirklich fährt: Fassung UND Generation zusammen. Ohne ihn
-- wäre die zusätzliche Generationsbedingung ein Nachfilter auf der Fassungsmenge; mit ihm ist sie
-- Teil desselben Indexzugriffs — die Zusage „kein Vollscan pro Anfrage" bleibt eingehalten.
CREATE INDEX IF NOT EXISTS idx_ko_search_projections_pversion_gen
  ON ko_search_projections(projection_version, generation);
`;

// ================================================================================================
// G27 R1 — DIE INSTANZWEITE CONTROL-TABELLE (Entscheidung 04 §1, §6)
// ================================================================================================
//
// EINZEILEN-MUSTER, wie es das Repository für instanzweite Zustände bereits führt
// (services/conflicts/src/overlap-settings.ts): `key text PRIMARY KEY` plus eine feste
// Schlüsselkonstante. „Instanzweit" ist damit strukturell erzwungen — der Primärschlüssel lässt
// eine zweite autoritative Zeile gar nicht erst zu — und nicht bloß zugesichert.
//
// ADDITIV UND WIEDERHOLBAR wie die Projektionstabelle: CREATE TABLE IF NOT EXISTS plus ein
// INSERT ... ON CONFLICT DO NOTHING. Kein DROP, kein TRUNCATE, kein destruktiver Umbau. Der zweite
// Lauf ist ein No-op; eine bereits vorhandene Steuerzeile wird NIE überschrieben — sonst würde eine
// Migration einen laufenden Betrieb still zurücksetzen.
//
// DER SEED IST `UNINITIALIZED` (05 §1) UND LEITET NICHTS AB. Er sieht die Projektionszeilen nicht
// an: weder „Tabelle leer ⇒ V2_ACTIVE" noch „V1-Zeilen vorhanden ⇒ V1_ACTIVE". Beides wäre die
// ausdrücklich verbotene automatische Ableitung aus dem Bestand. Eine Instanz, die migriert oder
// frisch installiert wird, ist zunächst NICHT suchbereit — und das ist die gewollte, fail-closed
// Antwort: kurzzeitig keine Suche ist besser als inkonsistente Suche (03 §3).
export const KO_PROJECTION_CONTROL_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_projection_control (
  key text PRIMARY KEY,
  active_projection_version int,
  target_projection_version int,
  projection_state text NOT NULL,
  last_successful_rebuild text,
  last_reconcile text,
  last_failure text,
  build_started_at text,
  build_finished_at text
);
-- G27 R1 / Entscheidung 09 §2 und §3: Generation und Marker an der Steuerzeile. Additiv und
-- wiederholbar wie alles darüber. build_generation ist NOT NULL mit Default 0 — „auf dieser
-- Instanz gab es noch nie einen V2-Bauzyklus" ist eine Tatsache, keine Unbekannte, und genau an
-- ihr hängt die einmalige Legacy-Bestätigung (09 §4). active_generation und der Marker sind
-- nullable: solange nichts freigegeben ist, gibt es dazu nichts zu sagen.
ALTER TABLE ko_projection_control
  ADD COLUMN IF NOT EXISTS build_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE ko_projection_control
  ADD COLUMN IF NOT EXISTS active_generation bigint;
ALTER TABLE ko_projection_control
  ADD COLUMN IF NOT EXISTS integrity_marker text;
ALTER TABLE ko_projection_control
  ADD COLUMN IF NOT EXISTS activated_at text;
INSERT INTO ko_projection_control(key, projection_state)
  VALUES ('singleton', 'UNINITIALIZED')
  ON CONFLICT (key) DO NOTHING;
`;

// Der eine Schlüssel der einen autoritativen Zeile.
const CONTROL_KEY = "singleton";

const CONTROL_SPALTEN =
  "active_projection_version,target_projection_version,projection_state,last_successful_rebuild,last_reconcile,last_failure,build_started_at,build_finished_at,build_generation,active_generation,integrity_marker,activated_at";

interface ControlRow {
  active_projection_version: number | null;
  target_projection_version: number | null;
  projection_state: string;
  last_successful_rebuild: string | null;
  last_reconcile: string | null;
  last_failure: string | null;
  build_started_at: string | null;
  build_finished_at: string | null;
  // `bigint` kommt aus node-pg als String — sonst könnte der Treiber jenseits von 2^53 still
  // runden. Die Umwandlung passiert hier an EINER Stelle, damit sie nirgends vergessen wird.
  build_generation: string | number | null;
  active_generation: string | number | null;
  integrity_marker: string | null;
  activated_at: string | null;
}

function alsZahl(wert: string | number | null | undefined): number | null {
  return wert === null || wert === undefined ? null : Number(wert);
}

function ausControlZeile(row: ControlRow): ProjectionControlState {
  return {
    activeProjectionVersion: row.active_projection_version,
    targetProjectionVersion: row.target_projection_version,
    projectionState: row.projection_state as ProjectionState,
    lastSuccessfulRebuild: row.last_successful_rebuild,
    lastReconcile: row.last_reconcile,
    lastFailure: row.last_failure,
    buildStartedAt: row.build_started_at,
    buildFinishedAt: row.build_finished_at,
    buildGeneration: alsZahl(row.build_generation) ?? 0,
    activeGeneration: alsZahl(row.active_generation),
    integrityMarker: row.integrity_marker,
    activatedAt: row.activated_at,
  };
}

// Die Belegung der Steuerzeile als EINE Werteliste — von `compareAndSetControlState` und von der
// Sitzung unter der exklusiven Sperre gemeinsam benutzt. Zwei Kopien wären zwei Gelegenheiten,
// beim nächsten Feld eine davon zu vergessen.
const CONTROL_SETZEN = `active_projection_version=$1,
         target_projection_version=$2,
         projection_state=$3,
         last_successful_rebuild=$4,
         last_reconcile=$5,
         last_failure=$6,
         build_started_at=$7,
         build_finished_at=$8,
         build_generation=$9,
         active_generation=$10,
         integrity_marker=$11,
         activated_at=$12`;

function controlWerte(naechster: ProjectionControlState): unknown[] {
  return [
    naechster.activeProjectionVersion,
    naechster.targetProjectionVersion,
    naechster.projectionState,
    naechster.lastSuccessfulRebuild,
    naechster.lastReconcile,
    naechster.lastFailure,
    naechster.buildStartedAt,
    naechster.buildFinishedAt,
    naechster.buildGeneration,
    naechster.activeGeneration,
    naechster.integrityMarker,
    naechster.activatedAt,
  ];
}

interface ProjectionRow {
  ko_id: string;
  ko_version: number;
  projection_version: number;
  search_text: string;
  title_text: string;
  statement_text: string;
  caption_text: string;
  body_text: string;
  language: string;
  content_hash: string;
  status: string;
  classification_snapshot: string;
  created_at: string;
  updated_at: string;
}

// Die Spaltenliste als EINE Quelle für alle Statements — zwei Kopien wären zwei Gelegenheiten,
// sie auseinanderlaufen zu lassen. `category_text`/`tag_text` stehen bewusst mit drin: sie sind
// NOT NULL und müssen beim Schreiben ausdrücklich mit dem Leerwert belegt werden (s. Kopf).
const SCHREIB_SPALTEN =
  "ko_id,ko_version,projection_version,search_text,title_text,statement_text,category_text,tag_text,caption_text,body_text,language,content_hash,status,classification_snapshot,generation,created_at,updated_at";

// Was GELESEN wird — ohne die Legacy-Spalten: sie sind keine Quelle mehr.
const LESE_SPALTEN =
  "ko_id,ko_version,projection_version,search_text,title_text,statement_text,caption_text,body_text,language,content_hash,status,classification_snapshot,created_at,updated_at";

// Der Leerwert der Legacy-Spalten. Als benannte Konstante, damit an der Schreibstelle sichtbar
// bleibt, dass hier NICHTS vergessen wurde, sondern ausdrücklich nichts hingehört.
const LEGACY_LEER = "";

// Die Generation ist ein SPEICHERWERT und kommt deshalb als eigenes Argument, nicht aus der
// Projektion (09 §2): sie entsteht beim Schreiben aus dem Control-State. Stünde sie an
// `KoSearchProjection`, könnte jeder Erzeuger einer Projektion eine Generation behaupten.
function werte(p: KoSearchProjection, generation: number | null): unknown[] {
  return [
    p.koId,
    p.koVersion,
    p.projectionVersion,
    p.searchText,
    p.titleText,
    p.statementText,
    LEGACY_LEER,
    LEGACY_LEER,
    p.captionText,
    p.bodyText,
    p.language,
    p.contentHash,
    p.status,
    serializeClassificationSnapshot(p.classificationSnapshot),
    generation,
    p.createdAt,
    p.updatedAt,
  ];
}

function ausZeile(row: ProjectionRow): KoSearchProjection {
  return {
    koId: row.ko_id,
    koVersion: row.ko_version,
    projectionVersion: row.projection_version,
    searchText: row.search_text,
    titleText: row.title_text,
    statementText: row.statement_text,
    captionText: row.caption_text,
    bodyText: row.body_text,
    language: row.language,
    contentHash: row.content_hash,
    status: row.status as SearchProjectionStatus,
    classificationSnapshot: parseClassificationSnapshot(
      row.classification_snapshot,
      row.ko_version,
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Der Ausdruck der AKTIVEN Version: die Projektionszeile, deren ko_version der aktuellen Version
// des Wissensobjekts entspricht. Alt-Zeilen ohne `version` im JSON gelten als Version 1 (dasselbe
// Zugeständnis, das der Rest des Moduls für Altbestand macht).
const AKTIVE_VERSION =
  "k.id = p.ko_id AND COALESCE((k.data->>'version')::int, 1) = p.ko_version AND NOT (k.data ? 'deletedAt')";

// ================================================================================================
// JOB 2689 D1 (Befund R2-37) — EIN PROZENTZEICHEN HOLT DEN GANZEN BESTAND.
// ================================================================================================
//
// Bis hierher wanderte der Suchbegriff unmaskiert in `ILIKE '%begriff%'`. `%` und `_` sind dort
// aber keine Zeichen, sondern Platzhalter: `q="%"` traf JEDE Zeile, Join und Sortierung liefen
// über den ganzen Bestand — und für die Bibliothek ist die ganze Eingabe EIN Begriff ohne LIMIT.
// Das ist kein Angriff, sondern ein Tippfehler.
//
// Maskieren heißt nicht wegwerfen: „80 % Auslastung" muss ein Objekt mit genau diesem Text FINDEN.
// Deshalb wird jedes der drei Sonderzeichen mit dem Rückstrich versehen und die ILIKE-Klausel
// trägt ausdrücklich `ESCAPE '\'` — nicht die Voreinstellung, sondern die Zusage im SQL selbst.
// Der In-Memory-Adapter vergleicht mit `includes` und war nie betroffen; nach diesem Umbau sagen
// beide Speicher bei `%` dasselbe.
const LIKE_SONDERZEICHEN = /[\\%_]/g;

/** Macht aus einem Suchbegriff ein LIKE-Muster, das ihn WÖRTLICH meint. */
export function maskiereLikeMuster(term: string): string {
  return term.replace(LIKE_SONDERZEICHEN, (zeichen) => `\\${zeichen}`);
}

/** Die ILIKE-Klausel mit der Maskierungszusage — an jeder Stelle dieselbe. */
function ilike(ausdruck: string, parameter: string): string {
  return `${ausdruck} ILIKE ${parameter} ESCAPE '\\'`;
}

export class PgKoSearchProjectionRepo implements KoSearchProjectionRepo {
  readonly metadata: KoMetadataProjectionRepo;

  // DERSELBE Pool für beide Hälften des Suchdokuments: dedizierte Kundeninstanz = EIN Datenraum.
  // Kein zweiter Dienst, kein geteilter Cache, keine kundenübergreifende Ablage.
  constructor(
    private readonly pool: Pool,
    metadata: KoMetadataProjectionRepo = new PgKoMetadataProjectionRepo(pool),
  ) {
    this.metadata = metadata;
  }

  // ----------------------------------------------------------------------------------------------
  // G27 R1 / Entscheidung 09 §2 — DER GEMEINSAME SCHREIBRAHMEN
  // ----------------------------------------------------------------------------------------------
  //
  // JEDE Projektionsmutation läuft in EINER Transaktion, die ZUERST die Steuerzeile sperrt. Das ist
  // die andere Hälfte von 09 §2: die Freigabe hält `FOR UPDATE`, jede Mutation hält `FOR SHARE`.
  // Damit gilt beides zugleich —
  //   · mehrere Mutationen behindern sich nicht (Share ist mit Share verträglich),
  //   · aber KEINE Mutation kann committen, solange das Gate prüft und aktiviert (Share wartet auf
  //     Update), und keine Freigabe kann committen, solange eine Mutation läuft.
  // Ohne diese Sperre bliebe genau das Fenster offen, das BEN als ROT-4 reproduziert hat.
  //
  // JOB 2704 D1 (R2-35): MIT `tx` gehört die Transaktion dem AUFRUFER (mutateKoTx über withPgTx).
  // Dann läuft dieselbe Mutation — Steuerzeile FOR SHARE, Schreiben, Marker — auf dessen Client,
  // ohne eigenes BEGIN/COMMIT: die Sperre hält bis zum Commit der äußeren Klammer, und die
  // Projektionszeile committet oder verschwindet zusammen mit kos-UPDATE und Snapshot. Ohne `tx`
  // unverändert die eigene Transaktion.
  private async mutiere<T>(
    fn: (client: Queryable, control: ProjectionControlState) => Promise<T>,
    tx?: TxContext,
  ): Promise<T> {
    if (tx) {
      const client = pgQueryable(tx);
      return this.mutiereAuf(client, fn);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const ergebnis = await this.mutiereAuf(client, fn);
      await client.query("COMMIT");
      return ergebnis;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  private async mutiereAuf<T>(
    client: Queryable,
    fn: (client: Queryable, control: ProjectionControlState) => Promise<T>,
  ): Promise<T> {
    const res = await client.query<ControlRow>(
      `SELECT ${CONTROL_SPALTEN} FROM ko_projection_control WHERE key=$1 FOR SHARE`,
      [CONTROL_KEY],
    );
    const row = res.rows[0];
    return fn(client, row ? ausControlZeile(row) : UNINITIALIZED_CONTROL_STATE);
  }

  // Den Marker fällen — IN DERSELBEN Transaktion wie die Mutation, die ihn ungültig gemacht hat.
  // Getrennt geschrieben gäbe es einen Moment, in dem die beschädigte Zeile schon steht und die
  // Suche sie noch für geprüft hält.
  private async faelleMarker(client: Queryable): Promise<void> {
    await client.query("UPDATE ko_projection_control SET integrity_marker=NULL WHERE key=$1", [
      CONTROL_KEY,
    ]);
  }

  // Append-only auf DB-Ebene: der Primärschlüssel entscheidet, nicht der Anwendungscode.
  // rowCount 0 heißt ehrlich „war schon da" — der Aufrufer weiß damit, ob ER geschrieben hat.
  async insert(projection: KoSearchProjection, tx?: TxContext): Promise<boolean> {
    return this.mutiere(async (client, control) => {
      const stempel = schreibStempel(control, projection.projectionVersion);
      const spalten = werte(projection, stempel.generation);
      const platzhalter = spalten.map((_, i) => `$${i + 1}`).join(",");
      const res = await client.query(
        `INSERT INTO ko_search_projections(${SCHREIB_SPALTEN}) VALUES(${platzhalter})
         ON CONFLICT (ko_id, ko_version) DO NOTHING`,
        spalten,
      );
      const geschrieben = (res.rowCount ?? 0) > 0;
      if (geschrieben && stempel.invalidieren) {
        await this.faelleMarker(client);
      }
      return geschrieben;
    }, tx);
  }

  // NUR der ausdrückliche Rebuild bzw. die Nachführung auf Projektionsfassung 2. `created_at` der
  // bestehenden Zeile bleibt erhalten — die Zeile wurde nicht neu geboren, sondern neu abgeleitet;
  // nur `updated_at` klettert.
  async replace(projection: KoSearchProjection): Promise<void> {
    await this.mutiere(async (client, control) => {
      const stempel = schreibStempel(control, projection.projectionVersion);
      const spalten = werte(projection, stempel.generation);
      const platzhalter = spalten.map((_, i) => `$${i + 1}`).join(",");
      await client.query(
        `INSERT INTO ko_search_projections(${SCHREIB_SPALTEN}) VALUES(${platzhalter})
         ON CONFLICT (ko_id, ko_version) DO UPDATE SET
           projection_version = EXCLUDED.projection_version,
           search_text = EXCLUDED.search_text,
           title_text = EXCLUDED.title_text,
           statement_text = EXCLUDED.statement_text,
           category_text = EXCLUDED.category_text,
           tag_text = EXCLUDED.tag_text,
           caption_text = EXCLUDED.caption_text,
           body_text = EXCLUDED.body_text,
           language = EXCLUDED.language,
           content_hash = EXCLUDED.content_hash,
           status = EXCLUDED.status,
           classification_snapshot = EXCLUDED.classification_snapshot,
           generation = EXCLUDED.generation,
           updated_at = EXCLUDED.updated_at`,
        spalten,
      );
      if (stempel.invalidieren) {
        await this.faelleMarker(client);
      }
    });
  }

  async generationOf(koId: string, koVersion: number): Promise<number | null | undefined> {
    const res = await this.pool.query<{ generation: string | number | null }>(
      "SELECT generation FROM ko_search_projections WHERE ko_id=$1 AND ko_version=$2",
      [koId, koVersion],
    );
    const row = res.rows[0];
    return row ? alsZahl(row.generation) : undefined;
  }

  /**
   * Die Gate-Frage aus 09 §2.4, als EIN Statement: gibt es eine aktive KO-Version, deren Zeile
   * fehlt oder die Zielfassung/Generation NICHT trägt? Kein Zeileninhalt verlässt die Datenbank,
   * und der LEFT JOIN deckt beide Fälle — fehlend und fremd — in derselben Bedingung ab.
   */
  async activeRowsInGeneration(generation: number): Promise<boolean> {
    const res = await this.pool.query<{ id: string }>(
      `SELECT k.id FROM kos k
         LEFT JOIN ko_search_projections p
           ON p.ko_id = k.id AND p.ko_version = COALESCE((k.data->>'version')::int, 1)
        WHERE NOT (k.data ? 'deletedAt')
          AND (p.ko_id IS NULL OR p.projection_version <> $1 OR p.generation IS DISTINCT FROM $2)
        LIMIT 1`,
      [SEARCH_PROJECTION_VERSION, generation],
    );
    return res.rows.length === 0;
  }

  async find(koId: string, koVersion: number): Promise<KoSearchProjection | undefined> {
    const res = await this.pool.query<ProjectionRow>(
      `SELECT ${LESE_SPALTEN} FROM ko_search_projections WHERE ko_id=$1 AND ko_version=$2`,
      [koId, koVersion],
    );
    const row = res.rows[0];
    return row ? ausZeile(row) : undefined;
  }

  async listByKo(koId: string): Promise<KoSearchProjection[]> {
    const res = await this.pool.query<ProjectionRow>(
      `SELECT ${LESE_SPALTEN} FROM ko_search_projections WHERE ko_id=$1 ORDER BY ko_version`,
      [koId],
    );
    return res.rows.map(ausZeile);
  }

  /**
   * DIE STANDARDSUCHE ÜBER DAS EFFECTIVE SEARCH DOCUMENT.
   *
   * Der LEFT JOIN auf `ko_metadata_projections` ist die zweite Hälfte der Zusammensetzung. LEFT,
   * weil ein Objekt ohne (noch nicht nachgezogene) Metadatenzeile über seinen Inhalt weiterhin
   * auffindbar bleiben muss — es fällt dann nur bei einer reinen Kategorie-/Schlagwortsuche aus,
   * und genau das zieht der idempotente Backfill nach.
   *
   * KEIN JOIN AUF OPERATIVE KATEGORIE-/TAG-FELDER: `k.data->>'category'` steht hier bewusst
   * NIRGENDS. Er wäre der billige Weg, den äußeren Vertrag zu retten — und zugleich das Ende der
   * Projektionsgrenze, weil dieselbe Suche dann zwei Wahrheiten hätte.
   */
  async findActive(query: KoSearchQuery): Promise<KoSearchHit[]> {
    // DER CONTROL-STATE ZUERST — dieselbe Funktion wie im In-Memory-Adapter, damit beide Speicher
    // buchstäblich dieselbe Entscheidung treffen. Sie steht VOR der fachlichen
    // Leermengenentscheidung (04 §4): ein nicht suchbereiter Zustand darf sich nicht hinter „keine
    // Begriffe" verstecken.
    const { fassung: aktiveFassung, generation } = freigegebeneProjektion(
      await this.controlState(),
    );
    // JOB 1531 D2 (S2): derselbe Aufruf wie im In-Memory-Adapter (search-projection-repo.ts:698).
    // Beide Speicher muessen dieselbe Kandidatenmenge sehen — sonst faende „klep" das „Ventil" je
    // nach Betriebsart einmal und einmal nicht.
    const terms = expandSearchTerms(normalizeSearchTerms(query.terms));
    // Ohne `limit` entfällt die LIMIT-Klausel (s. KoSearchQuery) — die Bibliothek verliert
    // dadurch keinen Treffer still.
    const limit = query.limit === undefined ? undefined : Math.max(0, Math.floor(query.limit));
    if (terms.length === 0 || limit === 0) {
      return [];
    }
    // Vollständig parametrisiert — die Begriffe sind Inhaltstoken, kein SQL. Die freigegebene
    // Fassung ebenfalls: sie ist ein gelesener Zustandswert, kein interpoliertes Literal.
    const params: unknown[] = [aktiveFassung];
    let fassungsBedingung = `p.projection_version = $${params.length}`;
    // 09 §3: die Abfrage liest AUSSCHLIESSLICH `projection_version = 2 AND generation =
    // active_generation` (plus den wirksamen Lifecycle aus dem JOIN auf `kos`). Beides zusammen
    // bedient der Index `idx_ko_search_projections_pversion_gen`. Für den ungenerationierten
    // Legacy-V1-Betrieb entfällt die zweite Bedingung — dort gibt es keine Generation, die etwas
    // aussagen könnte.
    if (generation !== null) {
      params.push(generation);
      fassungsBedingung += ` AND p.generation = $${params.length}`;
    }
    const orsSearch: string[] = [];
    // Die Kurzfelder der Content Projection …
    const feldOrs: Record<string, string[]> = {
      title_text: [],
      statement_text: [],
      caption_text: [],
    };
    // … und die beiden Felder, die seit S2 aus der Metadatenprojektion kommen. COALESCE, weil der
    // LEFT JOIN für Objekte ohne Metadatenzeile NULL liefert.
    const metaOrs: Record<string, string[]> = {
      category_text: [],
      tag_text: [],
    };
    for (const term of terms) {
      // JOB 2689 D1: der Begriff ist Inhalt, kein Muster — `%`, `_` und `\` werden maskiert.
      params.push(`%${maskiereLikeMuster(term)}%`);
      const p = `$${params.length}`;
      orsSearch.push(ilike("p.search_text", p));
      for (const feld of Object.keys(feldOrs)) {
        feldOrs[feld]?.push(ilike(`p.${feld}`, p));
      }
      for (const feld of Object.keys(metaOrs)) {
        metaOrs[feld]?.push(ilike(`COALESCE(md.${feld}, '')`, p));
        orsSearch.push(ilike(`COALESCE(md.${feld}, '')`, p));
      }
    }
    let limitKlausel = "";
    if (limit !== undefined) {
      params.push(limit);
      limitKlausel = ` LIMIT $${params.length}`;
    }
    const flag = (feld: string) => `(${feldOrs[feld]?.join(" OR ")}) AS m_${feld}`;
    const metaFlag = (feld: string) => `(${metaOrs[feld]?.join(" OR ")}) AS m_${feld}`;
    const sql = `
      SELECT p.ko_id, p.ko_version, p.projection_version, p.content_hash, p.status, p.language,
             ${flag("title_text")}, ${flag("statement_text")}, ${metaFlag("category_text")},
             ${metaFlag("tag_text")}, ${flag("caption_text")}
        FROM ko_search_projections p
        JOIN kos k ON ${AKTIVE_VERSION}
        LEFT JOIN ko_metadata_projections md ON md.ko_id = p.ko_id
       WHERE ${fassungsBedingung} AND (${orsSearch.join(" OR ")})
       ORDER BY (k.status='validiert') DESC, (k.data->>'trust')::int DESC NULLS LAST, p.ko_id${limitKlausel}`;
    const res = await this.pool.query<
      Pick<
        ProjectionRow,
        "ko_id" | "ko_version" | "projection_version" | "content_hash" | "status" | "language"
      > & {
        m_title_text: boolean;
        m_statement_text: boolean;
        m_category_text: boolean;
        m_tag_text: boolean;
        m_caption_text: boolean;
      }
    >(sql, params);
    return res.rows.map((row) => {
      const title = row.m_title_text === true;
      const statement = row.m_statement_text === true;
      const category = row.m_category_text === true;
      const tag = row.m_tag_text === true;
      const caption = row.m_caption_text === true;
      return {
        koId: row.ko_id,
        koVersion: row.ko_version,
        projectionVersion: row.projection_version,
        contentHash: row.content_hash,
        status: row.status as SearchProjectionStatus,
        language: row.language,
        matched: {
          title,
          statement,
          category,
          tag,
          caption,
          body: !(title || statement || category || tag || caption),
        },
      };
    });
  }

  // Die EINE Arbeitsliste des Nachzugs (s. Interface): fehlende Inhaltszeile, veraltete
  // Projektionsfassung ODER fehlende Metadatenzeile. Zwei LEFT JOINs + IS NULL/Vergleich —
  // indexgestützt über die beiden Primärschlüssel, kein Scan der Projektionstabellen.
  async missingActive(limit: number): Promise<string[]> {
    const cap = Math.max(0, Math.floor(limit));
    if (cap === 0) {
      return [];
    }
    const res = await this.pool.query<{ id: string }>(
      `SELECT k.id FROM kos k
         LEFT JOIN ko_search_projections p
           ON p.ko_id = k.id AND p.ko_version = COALESCE((k.data->>'version')::int, 1)
         LEFT JOIN ko_metadata_projections md ON md.ko_id = k.id
        WHERE NOT (k.data ? 'deletedAt')
          AND (p.ko_id IS NULL OR p.projection_version <> $2 OR md.ko_id IS NULL)
        LIMIT $1`,
      [cap, SEARCH_PROJECTION_VERSION],
    );
    return res.rows.map((row) => row.id);
  }

  // ----------------------------------------------------------------------------------------------
  // G27 R1 — DER CONTROL-STATE (dieselbe Semantik wie In-Memory, in SQL)
  // ----------------------------------------------------------------------------------------------

  // FAIL-CLOSED: fehlt die Steuerzeile (Schema noch nicht migriert), ist die Antwort
  // `UNINITIALIZED` — nicht suchbereit. Nie eine erfundene Freigabe.
  async controlState(): Promise<ProjectionControlState> {
    const res = await this.pool.query<ControlRow>(
      `SELECT ${CONTROL_SPALTEN} FROM ko_projection_control WHERE key=$1`,
      [CONTROL_KEY],
    );
    const row = res.rows[0];
    return row ? ausControlZeile(row) : { ...UNINITIALIZED_CONTROL_STATE };
  }

  /**
   * EIN Statement, EINE Bedingung: `WHERE key=… AND projection_state=…`. Die Datenbank entscheidet,
   * ob der Wechsel gilt — nicht der Anwendungscode nach einem vorherigen Lesevorgang. Damit ist die
   * Freigabe `V2_READY → V2_ACTIVE` atomar: es gibt keinen Moment, in dem zwei Fassungen liefern
   * könnten, und ein zweiter, nebenläufiger Freigabeversuch bekommt ehrlich `false`.
   */
  async compareAndSetControlState(
    erwartet: ProjectionState,
    naechster: ProjectionControlState,
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE ko_projection_control SET ${CONTROL_SETZEN}
       WHERE key=$13 AND projection_state=$14`,
      [...controlWerte(naechster), CONTROL_KEY, erwartet],
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * DIE EXKLUSIVE INSTANZSPERRE (09 §2.1) — `SELECT … FOR UPDATE` auf der einen Steuerzeile.
   *
   * Sie ist der Rahmen, in dem Gate-Prüfung UND Aktivierung stattfinden. Die Prüfungen selbst
   * lesen über den Pool (andere Verbindungen, rein lesend); das ist zulässig und ausreichend,
   * WEIL jede Mutation ihrerseits `FOR SHARE` auf dieselbe Zeile nimmt und deshalb nicht committen
   * kann, solange diese Sperre steht. Was die Prüfung sieht, kann sich bis zum Commit nicht mehr
   * ändern — das ist die Bindung, die 09 §2.3/§2.4 verlangt.
   */
  async withExclusiveControlLock<T>(
    fn: (sitzung: ProjectionControlSitzung) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query<ControlRow>(
        `SELECT ${CONTROL_SPALTEN} FROM ko_projection_control WHERE key=$1 FOR UPDATE`,
        [CONTROL_KEY],
      );
      const row = res.rows[0];
      const ergebnis = await fn({
        control: row ? ausControlZeile(row) : { ...UNINITIALIZED_CONTROL_STATE },
        schreibe: async (naechster) => {
          await client.query(`UPDATE ko_projection_control SET ${CONTROL_SETZEN} WHERE key=$13`, [
            ...controlWerte(naechster),
            CONTROL_KEY,
          ]);
        },
      });
      await client.query("COMMIT");
      return ergebnis;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  // Zwei schmale Aggregate über die AKTIVEN Zeilen — kein Inhalt verlässt die Datenbank. Die
  // Zahlen tragen das Gate; die Suche sieht sie nie.
  async activeProjectionAudit(): Promise<ProjectionAudit> {
    const bestand = await this.pool.query<{
      kos: string;
      mit_inhalt: string;
      mit_metadaten: string;
      pflichtfelder_fehlen: string;
    }>(
      `SELECT COUNT(*)::text AS kos,
              COUNT(p.ko_id)::text AS mit_inhalt,
              COUNT(md.ko_id)::text AS mit_metadaten,
              COUNT(*) FILTER (
                WHERE p.ko_id IS NOT NULL
                  AND (p.content_hash = '' OR p.language = '' OR p.status = '')
              )::text AS pflichtfelder_fehlen
         FROM kos k
         LEFT JOIN ko_search_projections p
           ON p.ko_id = k.id AND p.ko_version = COALESCE((k.data->>'version')::int, 1)
         LEFT JOIN ko_metadata_projections md ON md.ko_id = k.id
        WHERE NOT (k.data ? 'deletedAt')`,
    );
    const fassungen = await this.pool.query<{ projection_version: number; n: string }>(
      `SELECT p.projection_version, COUNT(*)::text AS n
         FROM kos k
         JOIN ko_search_projections p
           ON p.ko_id = k.id AND p.ko_version = COALESCE((k.data->>'version')::int, 1)
        WHERE NOT (k.data ? 'deletedAt')
        GROUP BY p.projection_version
        ORDER BY p.projection_version`,
    );
    const zeile = bestand.rows[0];
    return {
      kos: Number(zeile?.kos ?? 0),
      mitInhalt: Number(zeile?.mit_inhalt ?? 0),
      mitMetadaten: Number(zeile?.mit_metadaten ?? 0),
      aktiveFassungen: fassungen.rows.map((row) => ({
        projectionVersion: row.projection_version,
        count: Number(row.n),
      })),
      pflichtfelderFehlen: Number(zeile?.pflichtfelder_fehlen ?? 0),
    };
  }

  async inventoryByProjectionVersion(): Promise<{ projectionVersion: number; count: number }[]> {
    const res = await this.pool.query<{ projection_version: number; n: string }>(
      `SELECT projection_version, COUNT(*)::text AS n FROM ko_search_projections
        GROUP BY projection_version ORDER BY projection_version`,
    );
    return res.rows.map((row) => ({
      projectionVersion: row.projection_version,
      count: Number(row.n),
    }));
  }

  async remove(
    koId: string,
    koVersion: number,
    opts: { ruecknahme?: boolean } = {},
  ): Promise<void> {
    await this.mutiere(async (client, control) => {
      // Zeile UND Lebendbeleg in EINEM indexgestützten Punktzugriff — beide Primärschlüssel, kein
      // Bestandslauf. Der LEFT JOIN beantwortet „lebt das Objekt noch in genau dieser Version?",
      // ohne die es keine bedienende Zeile geben kann.
      const vorher = opts.ruecknahme
        ? { rows: [] as { projection_version: number; generation: string | number | null }[] }
        : await client.query<{
            projection_version: number;
            generation: string | number | null;
            lebt: boolean;
          }>(
            `SELECT p.projection_version, p.generation,
                    (k.id IS NOT NULL AND COALESCE((k.data->>'version')::int, 1) = p.ko_version)
                      AS lebt
               FROM ko_search_projections p
               LEFT JOIN kos k ON k.id = p.ko_id AND NOT (k.data ? 'deletedAt')
              WHERE p.ko_id=$1 AND p.ko_version=$2`,
            [koId, koVersion],
          );
      const zeile = vorher.rows[0] as
        | { projection_version: number; generation: string | number | null; lebt: boolean }
        | undefined;
      await client.query("DELETE FROM ko_search_projections WHERE ko_id=$1 AND ko_version=$2", [
        koId,
        koVersion,
      ]);
      const faellt =
        !opts.ruecknahme &&
        entfernungInvalidiert(
          control,
          zeile
            ? {
                projectionVersion: zeile.projection_version,
                generation: alsZahl(zeile.generation),
              }
            : undefined,
          zeile?.lebt === true,
        );
      if (faellt) {
        await this.faelleMarker(client);
      }
    });
  }

  async removeByKo(koId: string): Promise<void> {
    await this.pool.query("DELETE FROM ko_search_projections WHERE ko_id=$1", [koId]);
    await this.metadata.remove(koId);
  }

  async count(): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM ko_search_projections",
    );
    return Number(res.rows[0]?.n ?? 0);
  }
}
