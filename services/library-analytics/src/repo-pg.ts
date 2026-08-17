import type { Pool } from "pg";
import {
  type CandidateRepo,
  type ClaimResolution,
  type ExternalSourceRepo,
  type ImportCandidateRemoval,
  type ImportRunFortschritt,
  type ImportRunRepo,
  externalSourceSystemKey,
  pruefeImportRun,
  pruefeImportRunItemRef,
  pruefeRevisionsidentitaet,
  waehleLetztenErfolg,
} from "./repo";
import {
  type ExternalSourceRecord,
  type ImportCandidate,
  type ImportRun,
  type ImportRunItemRef,
  LibraryError,
  type ReviewAction,
  istImportRunStatus,
} from "./types";

// SCRUM-157: Postgres-Adapter der Import-/Source-Review-Queue. Vollständiger Kandidat als
// JSONB (Status/Duplicate/Note/koId/createdAt bleiben erhalten). Additive Tabelle.
// SCRUM-510 (WP3): ATOMARE Idempotenz der externalId-Kandidaten über einen PARTIELLEN UNIQUE-Index. Die
// Schlüsselfelder werden als GENERATED-Spalten aus dem JSONB abgeleitet (bleiben bei jedem data-UPDATE
// automatisch konsistent, kein Drift). Der Index greift NUR für offene (status "neu") externalId-Kandidaten:
// so kann pro (externalId, sourceVersion) höchstens EIN offener Kandidat existieren — auch bei nebenläufigen
// Läufen/Retries. Nach dem Review (status ≠ "neu") verlässt der Kandidat den Index → ein späterer Re-Sync
// derselben Version ist wieder möglich (Semantik deckungsgleich mit dem pending-Check des Orchestrators).
//
// SCRUM-510 (WP2-Batch3): Härtung der Migration.
//  (b) CAST-SICHER: source_version wird nur bei einer reinen Ziffernfolge gecastet, sonst Fallback 1
//      (deckungsgleich mit sourceVersion ?? 1 in App/InMemory). Eine ungültige historische sourceVersion
//      (z. B. "v3", "1.5", null) bricht so weder die STORED-Backfill-ALTER noch spätere INSERT/UPDATE.
//  (a) SELBSTHEILEND: VOR der Index-Erstellung werden Alt-Dubletten deterministisch bereinigt — pro
//      (external_id, source_version) bleibt der JÜNGSTE offene Kandidat (nach createdAt, Tiebreak id)
//      zum Review, ältere werden entfernt. So SCHEITERT der Start nie mehr an vorhandenen Dubletten;
//      der „laut statt still"-Gedanke bleibt als PG-RAISE-NOTICE erhalten. Rein additiv + idempotent
//      (Re-Run: keine Dubletten mehr → 0 Löschungen, Index existiert bereits → No-op).
// SCRUM-510 (WP-B): Die CAST-SICHERE Expression aus (b) griff nur bei NEU angelegter Spalte — Bestands-
// instanzen aus der Zeit VOR (b) (Commit 0901549) behielten die alte, cast-unsichere Generated-Expression
// (COALESCE(...::int, 1)) unverändert, weil `ADD COLUMN IF NOT EXISTS` bei bereits vorhandener Spalte ein
// No-op ist. Dort crasht ein INSERT mit nicht-numerischer sourceVersion (z. B. "v3") weiterhin am
// Postgres-Cast. Der folgende Block erkennt das per pg_attrdef/pg_get_expr (information_schema liefert
// Generated-Expressions nicht) und heilt EINMALIG: DROP COLUMN CASCADE reißt die alte Spalte samt allen
// darauf gebauten Objekten (hier: der partielle Unique-Index) mit; die nachfolgenden ADD-COLUMN/
// CREATE-INDEX-Schritte unten legen beides mit der sicheren Expression neu an. Läuft in derselben
// impliziten Transaktion wie der Rest der Migration (Postgres' Simple-Query-Protokoll wrapped ein
// mehrstatement-Query atomar) und ist idempotent: nach der Heilung trägt die Spalte die sichere
// Expression, ein Re-Run erkennt weder "COALESCE" noch die unbegrenzte Regex (s. WP-B2 unten) mehr und
// ist ein No-op. Neuinstallationen sind unberührt (source_version existiert dort noch nicht →
// Erkennung liefert NULL → kein Trigger).
// SCRUM-510 (WP-B2, Reviewer-Befund GELB): die CAST-SICHERE Regex `^[0-9]+$` aus (b) prüft zwar "reine
// Ziffernfolge", aber OHNE Längenbegrenzung — eine sehr lange Ziffernfolge (z. B. 20 Neunen) passiert den
// Regex-Guard trotzdem und crasht danach am `::int`-Cast (Integer-Overflow, int4 max = 2^31-1 =
// 2.147.483.647, also max. 10 Stellen, aber die 10-stelligen Zahlen >2^31-1 würden selbst noch überlaufen
// → HART auf 9 Stellen begrenzt: 999.999.999 < 2^31-1 ist für JEDE 9-stellige Ziffernfolge sicher, auch
// mit führenden Nullen). Fix: `^[0-9]+$` → `^[0-9]{1,9}$` (unten). Eine überlange Ziffernfolge fällt damit
// bewusst auf denselben Fallback 1 wie eine nicht-numerische sourceVersion — deckungsgleich mit dem
// Cast-sicheren Grundgedanken aus (b), nur zusätzlich längenbegrenzt.
// WICHTIG: Die Heilungserkennung oben fing bisher NUR die alte COALESCE-Expression ab. Instanzen, die
// bereits über (b)/WP-B liefen (oder als Neuinstallation direkt mit (b) starteten), tragen die
// UNGESCHÜTZTE `^[0-9]+$`-Expression OHNE COALESCE — die o. g. Erkennung griff für sie NICHT (kein
// "COALESCE" im Expression-Text) und sie blieben unbemerkt beim Overflow-Risiko. Die Erkennung unten prüft
// daher zusätzlich auf die Teilzeichenkette "[0-9]+$" (die im String-Literal der Regex UNVERÄNDERT von
// pg_get_expr zurückgegeben wird, unabhängig von Formatierungsvarianten wie Klammerung/Casts/Groß-
// Kleinschreibung des restlichen Ausdrucks) — sie matcht NUR die alte, unbegrenzte Variante: die gehärtete
// Ersatz-Expression `^[0-9]{1,9}$` enthält diese Teilzeichenkette NICHT (nach der `9]` folgt `{1,9}$`,
// nicht `+$`), die Heilung bleibt also idempotent (kein erneutes Triggern nach der Härtung).
export const IMPORT_CANDIDATES_SCHEMA = `
CREATE TABLE IF NOT EXISTS import_candidates (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (data->'item'->>'externalId') STORED;
-- WP-SHIP8-FIX (bens F3): PROVIDER-SICHERER Import-Schlüssel. Additive Generated-Spalte provider
-- (getrimmt + kleingeschrieben, wie importProviderKey in repo.ts). EHRLICHER BACKFILL: Bestands-
-- zeilen OHNE provider im Item-JSONB werden auf 'confluence' gesetzt — Confluence ist der EINZIGE
-- Adapter, der vor dieser Spalte externalId-Kandidaten erzeugte; ein anderer Ursprung ist für
-- Altzeilen ausgeschlossen. Neue Zeilen tragen ihren echten Adapter-Provider (Jira → 'jira').
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS provider text
  GENERATED ALWAYS AS (
    lower(COALESCE(NULLIF(btrim(data->'item'->>'provider'), ''), 'confluence'))
  ) STORED;
DO $$
DECLARE
  legacy_expr text;
  dependent_indexes text;
BEGIN
  SELECT pg_get_expr(d.adbin, d.adrelid) INTO legacy_expr
  FROM pg_attribute a
  JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'import_candidates'::regclass
    AND a.attname = 'source_version'
    AND NOT a.attisdropped;

  IF legacy_expr LIKE '%COALESCE%' OR legacy_expr LIKE '%[0-9]+$%' THEN
    SELECT string_agg(DISTINCT i.indexrelid::regclass::text, ', ') INTO dependent_indexes
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attname = 'source_version'
    WHERE i.indrelid = 'import_candidates'::regclass
      AND a.attnum = ANY(i.indkey);

    RAISE NOTICE 'import_candidates: cast-unsichere/unbegrenzte source_version-Expression erkannt — Spalte wird neu aufgebaut, abhängige Indizes (%) folgen (SCRUM-510 WP-B/WP-B2)', COALESCE(dependent_indexes, '-');
    ALTER TABLE import_candidates DROP COLUMN source_version CASCADE;
  END IF;
END $$;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS source_version integer
  GENERATED ALWAYS AS (
    CASE WHEN (data->'item'->>'sourceVersion') ~ '^[0-9]{1,9}$'
         THEN (data->'item'->>'sourceVersion')::int
         ELSE 1 END
  ) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS review_status text
  GENERATED ALWAYS AS (data->>'status') STORED;
DO $$
DECLARE removed integer;
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (
      PARTITION BY provider, external_id, source_version
      ORDER BY (data->>'createdAt') DESC, id DESC
    ) AS rn
    FROM import_candidates
    WHERE external_id IS NOT NULL AND review_status IN ('neu', 'in_bearbeitung')
  )
  DELETE FROM import_candidates c
  USING ranked r
  WHERE c.id = r.id AND r.rn > 1;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    RAISE NOTICE 'import_candidates: % Alt-Dublette(n) vor Unique-Index entfernt (SCRUM-510 WP2)', removed;
  END IF;
END $$;
-- WP-SHIP8-FIX (bens F3): der alte, provider-BLINDE Index wird ERSETZT (gleiche externalId bei
-- Confluence UND Jira sind ZWEI getrennte, gleichzeitig offene Kandidaten).
-- WP-SHIP8-CLOSE-3 (bens ROT-2): OFFEN heißt jetzt 'neu' ODER 'in_bearbeitung' — ein geclaimter
-- Kandidat behält seinen Idempotenz-Schlüssel; ein paralleler Importlauf kann während einer
-- Review-Aktion keinen zweiten offenen Kandidaten derselben Quelle einreihen. Der Index mit dem
-- ALTEN Prädikat (nur 'neu') wird WIRKLICH ERSETZT (DROP + CREATE unter neuem Namen — ein
-- CREATE IF NOT EXISTS auf den Altnamen wäre ein stilles No-op mit altem Prädikat). Idempotent:
-- nach dem ersten Lauf existiert nur noch der claim-bewusste Index.
DROP INDEX IF EXISTS import_candidates_open_external_uq;
DROP INDEX IF EXISTS import_candidates_open_provider_external_uq;
CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_claim_external_uq
  ON import_candidates (provider, external_id, source_version)
  WHERE external_id IS NOT NULL AND review_status IN ('neu', 'in_bearbeitung');
`;

interface CandidateRow {
  data: ImportCandidate;
}

export class PgCandidateRepo implements CandidateRepo {
  constructor(private readonly pool: Pool) {}

  async insert(candidate: ImportCandidate): Promise<void> {
    await this.pool.query("INSERT INTO import_candidates(id,data) VALUES($1,$2)", [
      candidate.id,
      JSON.stringify(candidate),
    ]);
  }

  // SCRUM-510 (WP3): idempotenter Insert über den partiellen UNIQUE-Index. ON CONFLICT DO NOTHING trifft
  // NUR den Index (offener externalId-Kandidat gleichen Providers mit gleicher Version, bens F3) → dann
  // wird nichts eingefügt und RETURNING liefert keine Zeile (false). Ohne externalId greift der Index
  // nicht → immer eingefügt (true).
  // WP-SHIP8-CLOSE-3 (bens ROT-2): das Inference-Prädikat muss dem NEUEN Index-Prädikat entsprechen
  // (offen = 'neu' ODER 'in_bearbeitung') — sonst fände Postgres den Arbiter-Index nicht mehr.
  async insertIfAbsent(candidate: ImportCandidate): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO import_candidates(id,data) VALUES($1,$2)
       ON CONFLICT (provider, external_id, source_version)
         WHERE external_id IS NOT NULL AND review_status IN ('neu', 'in_bearbeitung')
       DO NOTHING
       RETURNING id`,
      [candidate.id, JSON.stringify(candidate)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<ImportCandidate | undefined> {
    const res = await this.pool.query<CandidateRow>(
      "SELECT data FROM import_candidates WHERE id=$1",
      [id],
    );
    return res.rows[0]?.data;
  }

  // WP-SHIP8-CLOSE-2 (bens F1): ATOMARER Status-CAS als EIN bedingtes UPDATE — kein Fenster
  // zwischen Lesen und Schreiben. RETURNING data ist der Stand NACH dem Claim; 0 Zeilen →
  // undefined (Status geändert oder Kandidat weg), der Aufrufer bricht ehrlich ab.
  // WP-SHIP8-CLOSE-3 (bens ROT-1): der Claim persistiert das Lease-Protokoll (opId/claimedAt) im
  // SELBEN Write mit — Grundlage der Crash-Recovery.
  // WP-SHIP8-CLOSE-7 (bens ROT-2): zusätzlich claimedBy/claimedAction im SELBEN CAS (additiv;
  // Altaufrufer ohne die Felder schreiben wie bisher nur das Lease-Protokoll).
  async claim(
    id: string,
    opId: string,
    claimedAt: string,
    claimedBy?: string,
    claimedAction?: ReviewAction,
  ): Promise<ImportCandidate | undefined> {
    const patch: Record<string, unknown> = { status: "in_bearbeitung", opId, claimedAt };
    if (claimedBy !== undefined) {
      patch.claimedBy = claimedBy;
    }
    if (claimedAction !== undefined) {
      patch.claimedAction = claimedAction;
    }
    const res = await this.pool.query<CandidateRow>(
      "UPDATE import_candidates SET data = data || $2::jsonb WHERE id=$1 AND data->>'status'='neu' RETURNING data",
      [id, JSON.stringify(patch)],
    );
    return res.rows[0]?.data;
  }

  // WP-SHIP8-CLOSE-3 (bens ROT-1): CAS auf (status='in_bearbeitung', opId) — EIN bedingtes UPDATE
  // wendet den Abschluss-Patch an und räumt das Lease-Protokoll immer aus. 0 Zeilen → undefined
  // (der Claim gehört nicht mehr dieser Operation, z. B. Recovery hat übernommen).
  async resolveClaim(
    id: string,
    opId: string,
    next: ClaimResolution,
  ): Promise<ImportCandidate | undefined> {
    const patch: Record<string, unknown> = { status: next.status };
    if (next.koId !== undefined) {
      patch.koId = next.koId;
    }
    if (next.note !== undefined) {
      patch.note = next.note;
    }
    if (next.item !== undefined) {
      patch.item = next.item;
    }
    // WP-SHIP8-CLOSE-6 (bens ROT-3a): Wer/Wann der Entscheidung reist im selben jsonb-Patch.
    if (next.reviewedBy !== undefined) {
      patch.reviewedBy = next.reviewedBy;
    }
    if (next.reviewedAt !== undefined) {
      patch.reviewedAt = next.reviewedAt;
    }
    // WP-SHIP8-CLOSE-7 (bens GELB + ROT-1): Aktion + vorbeugende Beleg-Markierung im selben Patch.
    if (next.reviewedAction !== undefined) {
      patch.reviewedAction = next.reviewedAction;
    }
    if (next.auditPending !== undefined) {
      patch.auditPending = next.auditPending;
    }
    const res = await this.pool.query<CandidateRow>(
      "UPDATE import_candidates SET data = (data - 'opId' - 'claimedAt' - 'claimedBy' - 'claimedAction') || $3::jsonb WHERE id=$1 AND data->>'status'='in_bearbeitung' AND data->>'opId'=$2 RETURNING data",
      [id, opId, JSON.stringify(patch)],
    );
    return res.rows[0]?.data;
  }

  // WP-SHIP8-CLOSE-7 (bens ROT-1): BEDINGTES Entfernen der auditPending-Markierung als EIN
  // Statement — nur wenn sie noch exakt diese eventId trägt (nie eine fremde/neuere Markierung
  // überschreiben). 0 Zeilen → false (weg/fremd/Kandidat entfernt) — kein Fehler.
  async clearAuditPending(id: string, eventId: string): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE import_candidates SET data = data - 'auditPending' WHERE id=$1 AND data->'auditPending'->>'eventId'=$2 RETURNING id",
      [id, eventId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async update(candidate: ImportCandidate): Promise<void> {
    const res = await this.pool.query("UPDATE import_candidates SET data=$2 WHERE id=$1", [
      candidate.id,
      JSON.stringify(candidate),
    ]);
    // WP-SHIP8-CLOSE-2 (bens F1): 0 Zeilen = der Kandidat ist zwischenzeitlich verschwunden —
    // EHRLICHER Konflikt statt stillem Ok (der Aufrufer darf keinen Erfolg annehmen).
    if ((res.rowCount ?? 0) === 0) {
      throw new LibraryError(
        "CONFLICT",
        "Importkandidat existiert nicht mehr — nicht gespeichert.",
      );
    }
  }

  async all(): Promise<ImportCandidate[]> {
    const res = await this.pool.query<CandidateRow>(
      "SELECT data FROM import_candidates ORDER BY data->>'createdAt'",
    );
    return res.rows.map((row) => row.data);
  }

  // WP-D-CLEAN: harte Entfernung ALLER Queue-Einträge (Pedis Testdaten-Aufräumen) — rowCount ist
  // die ehrliche Zählung der tatsächlich entfernten Kandidaten.
  // WP-NIGHT-FIX (bens F2-TOCTOU): NICHT mehr der Cleanup-Weg (s. removeByIds) — nur Werkzeug/Test.
  async removeAll(): Promise<number> {
    const res = await this.pool.query("DELETE FROM import_candidates");
    return res.rowCount ?? 0;
  }

  // WP-NIGHT-FIX (bens F2-TOCTOU): löscht EXAKT die bestätigten Ids in EINEM atomaren DELETE —
  // ein nach dem Digest-Vergleich eingereihter neuer Kandidat wird nie mitgerissen.
  // WP-SHIP8-CLOSE (bens F2): die Status-Bedingung steckt IN der Löschung (kein Re-Read davor,
  // kein Fenster): gelöscht wird je Id NUR bei exakt dem bestätigten Status; RETURNING id liefert
  // die Wahrheit für die Bilanz. Ein Accept zwischen Bestätigung und Delete verliert nie.
  // WP-SHIP8-CLOSE-8 (bens ROT-1): zusätzlich FAIL-CLOSED gegen schwebende Aktionsbelege — ein
  // Kandidat mit auditPending (einziger Träger des ausstehenden Belegs) wird NIE gelöscht; die
  // Bedingung steckt im DELETE selbst (JSONB-Prüfung, keine Migration nötig), nicht in einem
  // Vorab-Read.
  async removeByIds(entries: readonly ImportCandidateRemoval[]): Promise<string[]> {
    if (entries.length === 0) {
      return [];
    }
    const res = await this.pool.query<{ id: string }>(
      "DELETE FROM import_candidates c USING unnest($1::text[], $2::text[]) AS erwartet(id, status) WHERE c.id = erwartet.id AND c.data->>'status' = erwartet.status AND c.data->'auditPending' IS NULL RETURNING c.id",
      [entries.map((e) => e.id), entries.map((e) => e.status)],
    );
    return res.rows.map((row) => row.id);
  }
}

// ================================================================================================
// W2-A (KW-W2-17 Zeilen 35-39) — DIE REVISIONSIDENTITAET, DATENBANKSEITIG ERZWUNGEN
// ================================================================================================
//
// ADDITIV UND WIEDERHOLBAR wie jedes Schema in diesem Repository: `CREATE TABLE IF NOT EXISTS`,
// `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`. KEIN `DROP`, KEIN `TRUNCATE`,
// kein Umschreiben von Altbestand — es gibt hier ohnehin keinen, aber die Form bleibt dieselbe.
//
// DER SCHLUESSEL IST TEXT, NICHT INTEGER — UND DAS IST DIE LEHRE VON OBEN.
// Die `source_version`-Spalte der Kandidatentabelle musste ZWEIMAL geheilt werden: erst wegen
// eines unsicheren Casts (WP-B), dann wegen einer Ziffernfolge ohne Laengengrenze, die den Guard
// passierte und am `::int` ueberlief (WP-B2). Beide Male war die Ursache dieselbe: ein CAST im
// generierten Ausdruck. Hier gibt es ihn nicht. Der Index laeuft ueber den ROHEN Textwert der
// Version; er ist damit
//   · TOTAL — kein `CASE` kann NULL liefern, und NULLs waeren im Unique-Index verschieden,
//     also genau die Luecke, die eine Revisionsidentitaet nicht haben darf,
//   · ueberlaufsicher, weil nichts gecastet wird,
//   · und braucht nie eine Heilungsmigration.
// Die numerische Ordnung entsteht dort, wo sie hingehoert: beim Lesen, aus dem typisierten
// `sourceVersion` des Datensatzes. Der Preis ist ehrlich benannt — `listBySource`/`latestVersion`
// sortieren im Anwendungscode statt in der Datenbank. Bei einer Handvoll Revisionen je Quelle ist
// das kein Preis; sollte eine Quelle je tausende Revisionen tragen, ist eine zusaetzliche,
// SORTIER-Spalte (kein Schluessel!) der naechste Schritt.
//
// `source_system` wird kleingeschrieben und getrimmt — deckungsgleich mit
// `externalSourceSystemKey` in repo.ts. Zwei Normalisierungen fuer denselben Schluessel waeren
// zwei Gelegenheiten, sie auseinanderlaufen zu lassen.
export const EXTERNAL_SOURCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS external_source_records (
  source_record_id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE external_source_records
  ADD COLUMN IF NOT EXISTS source_system text
  GENERATED ALWAYS AS (lower(btrim(data->>'sourceSystem'))) STORED;
ALTER TABLE external_source_records
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (data->>'externalId') STORED;
ALTER TABLE external_source_records
  ADD COLUMN IF NOT EXISTS source_version_key text
  GENERATED ALWAYS AS (data->>'sourceVersion') STORED;
-- BEN-33 BEFUND C: EIN UNIQUE-INDEX UEBER NULL-FAEHIGE SPALTEN SAGT FAST NICHTS ZU.
-- PostgreSQL haelt zwei NULLs fuer verschieden. Solange die drei Schluesselspalten NULL sein
-- durften, konnten beliebig viele Zeilen OHNE Identitaet nebeneinander stehen — der Index hat sie
-- alle durchgelassen. Der Adapter prueft zwar seine eigenen Aufrufe (pruefeRevisionsidentitaet),
-- aber ein roher Insert ging daran vorbei, und genau danach hat BEN gefragt.
--
-- Die Bedingung ist deshalb ZWEISTUFIG und spiegelt Satz fuer Satz die Anwendungspruefung:
--   · der CHECK weist einen unvollstaendigen Datensatz schon beim Insert ab (SQLSTATE 23514),
--   · die drei NOT-NULL-Spalten schliessen die NULL-Luecke des Unique-Index STRUKTURELL.
-- Die Versionsregel ^[0-9]{1,9}$ ist wortgleich die Grenze aus MAX_SOURCE_VERSION (repo.ts):
-- ganzzahlig, nicht negativ, hoechstens neun Stellen — dieselbe Lehre wie bei source_version oben,
-- nur hier ohne jeden Cast.
--
-- ADDITIV UND WIEDERHOLBAR: der CHECK haengt an einer Existenzpruefung (ADD CONSTRAINT kennt kein
-- IF NOT EXISTS), SET NOT NULL ist von sich aus ein No-op, wenn die Spalte es schon ist. Nichts
-- wird entfernt, geleert oder umgeschrieben — dieselbe Form wie jedes Schema in diesem Repository.
--
-- EHRLICH BENANNT: traefe eine Bestandsinstanz wider Erwarten eine Zeile ohne vollstaendige
-- Identitaet, SCHLUEGE DIESE MIGRATION FEHL statt sie stillschweigend zu loeschen oder zu heilen.
-- Das ist die Haltung des ganzen Repositorys — lieber laut stehenbleiben als leise etwas erfinden.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'external_source_records_identitaet_ck'
       AND conrelid = 'external_source_records'::regclass
  ) THEN
    ALTER TABLE external_source_records
      ADD CONSTRAINT external_source_records_identitaet_ck CHECK (
        btrim(source_record_id) <> ''
        AND btrim(coalesce(data->>'sourceSystem', '')) <> ''
        AND btrim(coalesce(data->>'externalId', '')) <> ''
        AND coalesce(data->>'sourceVersion', '') ~ '^[0-9]{1,9}$'
      );
  END IF;
END $$;
ALTER TABLE external_source_records ALTER COLUMN source_system SET NOT NULL;
ALTER TABLE external_source_records ALTER COLUMN external_id SET NOT NULL;
ALTER TABLE external_source_records ALTER COLUMN source_version_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS external_source_records_revision_uq
  ON external_source_records (source_system, external_id, source_version_key);
CREATE INDEX IF NOT EXISTS idx_external_source_records_quelle
  ON external_source_records (source_system, external_id);
`;

interface ExternalSourceRow {
  data: ExternalSourceRecord;
}

/**
 * Die Verletzung GENAU des Primaerschluessels von `external_source_records` — nicht „irgendein
 * 23505". Der Constraint-Name steht mit im Fehler; ihn mitzupruefen verhindert, dass eine spaeter
 * hinzugefuegte zweite Eindeutigkeit stillschweigend als „interne Id doppelt" gemeldet wird.
 */
function istPrimaerschluesselVerletzung(err: unknown): boolean {
  const kandidat = err as { code?: unknown; constraint?: unknown } | null;
  return kandidat?.code === "23505" && kandidat?.constraint === "external_source_records_pkey";
}

export class PgExternalSourceRepo implements ExternalSourceRepo {
  constructor(private readonly pool: Pool) {}

  /**
   * IDEMPOTENT ueber den echten Unique-Index. `ON CONFLICT DO NOTHING` ist hier mehr als eine
   * Bequemlichkeit: es ist die Zusage, dass die VORHANDENE Zeile unangetastet bleibt. Ein
   * `DO UPDATE` waere genau das stille Ueberschreiben, das KW-W2-17 Zeile 38-39 verbietet.
   *
   * Das Konflikt-Ziel ist BEWUSST als Spaltenliste geschrieben und nicht als Constraint-Name:
   * so waehlt Postgres den passenden Index selbst, und ein spaeterer Namenswechsel bricht den
   * Insert nicht still.
   */
  async insertIfAbsent(record: ExternalSourceRecord): Promise<boolean> {
    pruefeRevisionsidentitaet(record);
    try {
      const res = await this.pool.query(
        `INSERT INTO external_source_records(source_record_id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (source_system, external_id, source_version_key) DO NOTHING
       RETURNING source_record_id`,
        [record.sourceRecordId, JSON.stringify(record)],
      );
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      // BEN-33 Befund B: der Primaerschluessel schuetzt die interne Id — er tat es schon immer,
      // aber der Aufrufer sah dabei einen ROHEN Datenbankfehler, waehrend die InMemory-Ablage die
      // Doppelvergabe gar nicht bemerkte. Beide Ablagen melden jetzt denselben fachlichen Satz.
      // BEWUSST ENG: nur die Verletzung GENAU dieses Primaerschluessels wird uebersetzt; jeder
      // andere Datenbankfehler reist unveraendert weiter, damit hier nichts verschluckt wird.
      if (istPrimaerschluesselVerletzung(err)) {
        throw new LibraryError(
          "CONFLICT",
          `Die interne Quellrevisions-Id ${record.sourceRecordId} ist bereits an eine andere Revision vergeben.`,
        );
      }
      throw err;
    }
  }

  async findByRevision(
    sourceSystem: string,
    externalId: string,
    sourceVersion: number,
  ): Promise<ExternalSourceRecord | undefined> {
    const res = await this.pool.query<ExternalSourceRow>(
      `SELECT data FROM external_source_records
        WHERE source_system = $1 AND external_id = $2 AND source_version_key = $3`,
      [externalSourceSystemKey(sourceSystem), externalId, String(sourceVersion)],
    );
    return res.rows[0]?.data;
  }

  async findById(sourceRecordId: string): Promise<ExternalSourceRecord | undefined> {
    const res = await this.pool.query<ExternalSourceRow>(
      "SELECT data FROM external_source_records WHERE source_record_id = $1",
      [sourceRecordId],
    );
    return res.rows[0]?.data;
  }

  async listBySource(sourceSystem: string, externalId: string): Promise<ExternalSourceRecord[]> {
    const res = await this.pool.query<ExternalSourceRow>(
      `SELECT data FROM external_source_records
        WHERE source_system = $1 AND external_id = $2`,
      [externalSourceSystemKey(sourceSystem), externalId],
    );
    // Numerisch sortiert am typisierten Feld — s. die Begruendung am Schema.
    return res.rows.map((row) => row.data).sort((a, b) => a.sourceVersion - b.sourceVersion);
  }

  async latestVersion(sourceSystem: string, externalId: string): Promise<number | undefined> {
    const alle = await this.listBySource(sourceSystem, externalId);
    return alle.length > 0 ? alle[alle.length - 1]?.sourceVersion : undefined;
  }
}

// ================================================================================================
// AUFTRAG-144 (KW-S4-26 §92-114, KW-S4-28 F1) — DIE LAUFDOMAENE, DATENBANKSEITIG ERZWUNGEN
// ================================================================================================
//
// ADDITIV UND WIEDERHOLBAR wie jedes Schema in diesem Repository: `CREATE TABLE IF NOT EXISTS`,
// `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, Constraints hinter einer
// Existenzpruefung. KEIN `DROP`, KEIN `TRUNCATE`, KEIN `DO UPDATE` — Letzteres waere genau das
// stille Ueberschreiben eines laufenden Imports, das Auftrag 144 §70 ausschliesst.
//
// ZWEI TABELLEN UND EIN FREMDSCHLUESSEL. Die Elementreferenz ist ein KINDvertrag (§108) und kein
// zweiter Gegenstand: ohne Lauf gibt es sie nicht. Der Fremdschluessel sagt das der Datenbank, statt
// es dem Adapter zu ueberlassen — eine verwaiste Referenz waere eine Ergebnisaussage ohne Lauf.
//
// DER STATUS HAENGT AN EINEM CHECK, NICHT NUR AM ADAPTER. Ein roher Insert mit erfundenem Status
// ginge sonst an der Anwendungspruefung vorbei; danach stuende ein Zustand in der Datenbank, den
// niemand deuten kann. Die Liste im CHECK ist wortgleich `IMPORT_RUN_STATUSES`.
//
// KEINE GENERIERTE ORDNUNGSSPALTE. `ordinal` ist eine ECHTE Spalte und Teil des Primaerschluessels
// — die Ordnung ist ein Vertrag, kein aus JSONB abgeleiteter Nebeneffekt. Das ist die Lehre aus der
// Kandidatentabelle oben, nur von der anderen Seite: was Schluessel ist, wird nicht generiert.
export const IMPORT_RUN_SCHEMA = `
CREATE TABLE IF NOT EXISTS import_runs (
  import_id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_runs
  ADD COLUMN IF NOT EXISTS status text
  GENERATED ALWAYS AS (data->>'status') STORED;
ALTER TABLE import_runs
  ADD COLUMN IF NOT EXISTS source_system text
  GENERATED ALWAYS AS (lower(btrim(data->>'sourceSystem'))) STORED;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'import_runs_status_ck'
       AND conrelid = 'import_runs'::regclass
  ) THEN
    ALTER TABLE import_runs
      ADD CONSTRAINT import_runs_status_ck CHECK (
        btrim(import_id) <> ''
        AND btrim(coalesce(data->>'sourceSystem', '')) <> ''
        AND btrim(coalesce(data->>'startedAt', '')) <> ''
        AND data->>'status' IN (
          'QUEUED','FETCHING','PERSISTING_SOURCE','EXTRACTING','CREATING_KNOWLEDGE',
          'ANALYZING','COMPLETED','PARTIAL','FAILED'
        )
      );
  END IF;
END $$;
ALTER TABLE import_runs ALTER COLUMN status SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_runs_quelle ON import_runs (source_system);

CREATE TABLE IF NOT EXISTS import_run_item_refs (
  import_id text NOT NULL,
  ordinal integer NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (import_id, ordinal)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'import_run_item_refs_lauf_fk'
       AND conrelid = 'import_run_item_refs'::regclass
  ) THEN
    ALTER TABLE import_run_item_refs
      ADD CONSTRAINT import_run_item_refs_lauf_fk
      FOREIGN KEY (import_id) REFERENCES import_runs(import_id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'import_run_item_refs_element_ck'
       AND conrelid = 'import_run_item_refs'::regclass
  ) THEN
    ALTER TABLE import_run_item_refs
      ADD CONSTRAINT import_run_item_refs_element_ck CHECK (
        ordinal >= 0
        AND btrim(coalesce(data->>'candidateItemId', '')) <> ''
        AND data->>'itemOutcome' IN ('CREATED','BOUND','SKIPPED','FAILED')
      );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_import_run_item_refs_lauf
  ON import_run_item_refs (import_id, ordinal);
`;

interface ImportRunRow {
  data: ImportRun;
}

/**
 * JOB-924: die Projektion der Auswahl — drei Textspalten, sonst nichts. `unknown`, weil `->>` auf
 * einem fehlenden oder nicht-skalaren Feld auch `null` liefert; die Pruefung sitzt in
 * `waehleLetztenErfolg`, nicht hier.
 */
interface ImportErfolgRow {
  source_system: unknown;
  status: unknown;
  completed_at: unknown;
}

interface ImportRunItemRefRow {
  data: ImportRunItemRef;
}

export class PgImportRunRepo implements ImportRunRepo {
  constructor(private readonly pool: Pool) {}

  /**
   * IDEMPOTENT ueber den echten Primaerschluessel. `ON CONFLICT DO NOTHING` ist hier die Zusage,
   * dass die VORHANDENE Zeile unangetastet bleibt — ein `DO UPDATE` wuerde einen laufenden oder
   * abgeschlossenen Import still ueberschreiben.
   */
  async insertIfAbsent(run: ImportRun): Promise<boolean> {
    pruefeImportRun(run);
    const res = await this.pool.query(
      `INSERT INTO import_runs(import_id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (import_id) DO NOTHING
       RETURNING import_id`,
      [run.importId, JSON.stringify(run)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async findById(importId: string): Promise<ImportRun | undefined> {
    const res = await this.pool.query<ImportRunRow>(
      "SELECT data FROM import_runs WHERE import_id = $1",
      [importId],
    );
    return res.rows[0]?.data;
  }

  /**
   * JOB-924: DER LETZTE ERFOLG — dieselbe Entscheidung wie im Speicher, gefaellt von derselben
   * Funktion.
   *
   * WAS SQL HIER TUT UND WAS NICHT: Es verengt auf das Quellsystem und projiziert genau die drei
   * Felder, die die Auswahl braucht — zwei kurze Texte je Zeile statt des ganzen Laufdokuments.
   * Es entscheidet NICHTS.
   *
   * KEIN `ORDER BY … LIMIT 1`, und das ist Absicht: Die Spalte ist JSONB-Text, die Ordnung waere
   * lexikografisch, und `2026-08-10T11:00:00+02:00` staende damit ueber `2026-08-10T09:00:00.000Z`,
   * obwohl beide denselben Augenblick meinen. Ein `LIMIT 1` auf dieser Ordnung schnitte den wahren
   * juengsten Erfolg weg — sichtbar erst, wenn irgendwann ein Lauf mit Zonenversatz geschrieben
   * wird. KEIN `::timestamptz` aus demselben Grund in der anderen Richtung: ein Altwert wie
   * `gestern` liesse den Cast WERFEN, waehrend der Speicher ihn still verwirft — dieselbe Abfrage
   * ginge je nach Ablage verschieden aus.
   */
  async findLastSuccessAt(sourceSystem: string): Promise<string | null> {
    const res = await this.pool.query<ImportErfolgRow>(
      `SELECT data->>'sourceSystem' AS source_system,
              data->>'status'       AS status,
              data->>'completedAt'  AS completed_at
         FROM import_runs
        WHERE data->>'sourceSystem' = $1`,
      [sourceSystem],
    );
    return waehleLetztenErfolg(
      sourceSystem,
      res.rows.map((zeile) => ({
        sourceSystem: zeile.source_system,
        status: zeile.status,
        completedAt: zeile.completed_at,
      })),
    );
  }

  /**
   * EIN Statement, keine Lese-Aendere-Schreibe-Folge.
   *
   * `data || $2::jsonb` mischt die Flickenfelder auf oberster Ebene ein und laesst alles andere —
   * insbesondere `startedAt` und die Identitaetsfelder — unberuehrt. Ein `SELECT` mit
   * anschliessendem `UPDATE` haette zwischen beiden Schritten ein Fenster, in dem ein zweiter
   * Schreiber gewinnt und still ueberschrieben wird.
   *
   * `rowCount = 0` heisst: es gibt diesen Lauf nicht. Das ist ein `CONFLICT` und kein Anlass, ihn
   * anzulegen.
   */
  async advance(importId: string, fortschritt: ImportRunFortschritt): Promise<ImportRun> {
    if (!istImportRunStatus(fortschritt.status)) {
      throw new LibraryError(
        "BAD_REQUEST",
        `Unbekannter Laufstatus ${JSON.stringify(fortschritt.status)} — die kanonische Menge hat genau neun Werte.`,
      );
    }
    const flicken: Record<string, unknown> = { status: fortschritt.status };
    if (fortschritt.sourceRecordId !== undefined) {
      flicken.sourceRecordId = fortschritt.sourceRecordId;
    }
    if (fortschritt.completedAt !== undefined) {
      flicken.completedAt = fortschritt.completedAt;
    }
    if (fortschritt.failureCode !== undefined) {
      flicken.failureCode = fortschritt.failureCode;
    }
    if (fortschritt.failureReason !== undefined) {
      flicken.failureReason = fortschritt.failureReason;
    }
    if (fortschritt.counters !== undefined) {
      flicken.counters = fortschritt.counters;
    }
    const res = await this.pool.query<ImportRunRow>(
      `UPDATE import_runs SET data = data || $2::jsonb
        WHERE import_id = $1
        RETURNING data`,
      [importId, JSON.stringify(flicken)],
    );
    const zeile = res.rows[0];
    if (zeile === undefined) {
      throw new LibraryError(
        "CONFLICT",
        `Der Importlauf ${importId} existiert nicht — eine Fortschreibung legt keinen Lauf an.`,
      );
    }
    return zeile.data;
  }

  async appendItemRefs(refs: readonly ImportRunItemRef[]): Promise<number> {
    let neu = 0;
    for (const ref of refs) {
      pruefeImportRunItemRef(ref);
      const res = await this.pool.query(
        `INSERT INTO import_run_item_refs(import_id, ordinal, data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (import_id, ordinal) DO NOTHING
         RETURNING ordinal`,
        [ref.importId, ref.ordinal, JSON.stringify(ref)],
      );
      neu += (res.rowCount ?? 0) > 0 ? 1 : 0;
    }
    return neu;
  }

  /** `ORDER BY ordinal` — ohne diese Zeile gibt PostgreSQL keine Reihenfolge zu. */
  async listItemRefs(importId: string): Promise<ImportRunItemRef[]> {
    const res = await this.pool.query<ImportRunItemRefRow>(
      `SELECT data FROM import_run_item_refs
        WHERE import_id = $1
        ORDER BY ordinal ASC`,
      [importId],
    );
    return res.rows.map((zeile) => zeile.data);
  }
}
