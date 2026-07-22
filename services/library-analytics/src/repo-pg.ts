import type { Pool } from "pg";
import type { CandidateRepo, ClaimResolution, ImportCandidateRemoval } from "./repo";
import { type ImportCandidate, LibraryError, type ReviewAction } from "./types";

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
