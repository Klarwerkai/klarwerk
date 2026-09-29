// ================================================================================================
// R-0162 / R-0163 (Confluence-Gesamtimport) — DAS DAUERHAFTE ERGEBNIS DES QUELLABGLEICHS EINES LAUFS.
// ================================================================================================
//
// Ein asynchroner Importlauf gleicht nach dem Lesen Löschungen, Wiederauftauchen und Anhänge mit der
// Quelle ab (`services/app/src/confluence-import.ts`, `quellAbgleich`). Das Ergebnis muss den Lauf
// überdauern: der Nutzer sieht es erst, wenn er den Lauf später abfragt
// (`GET /api/admin/import/runs/:id`), und ein Neustart dazwischen darf es nicht verschlucken.
//
// WARUM EINE EIGENE ABLAGE UND KEIN FELD AM `ImportRun`: Die Laufablage (`services/library-analytics`
// `src/types.ts`, `src/repo.ts`, `src/repo-pg.ts`) ist eingefroren (FREEZE-144,
// `tests/library-analytics-freeze144.test.ts`); eine Freigabe für eine Änderung liegt für diesen
// Auftrag nicht vor. Die Ablage hier ist ADDITIV: eigene Tabelle, kein Fremdschlüssel auf
// `import_runs`, gelesen nur neben einem gefundenen Lauf. Ein Lauf ohne Eintrag hat keinen Abgleich
// (anderer Importweg, Altlauf) — das ist `null` auf der Leitung, nicht „nichts gelöscht".
//
// SIE KOPIERT NICHTS: nur Quell-Kennungen (Confluence-Seiten-Ids), gedeckelt — dieselbe Zusicherung
// wie der Kindvertrag des Laufs. Kein Titel, kein Inhalt, keine Berechtigung.
import type { Pool } from "pg";

/** Das dauerhafte Ergebnis eines Quellabgleichs. Listen gedeckelt (`MAX_SOURCE_SYNC_IDS`). */
export interface ImportRunSourceSync {
  /** Wurde abgeglichen? `false` heisst: über Löschungen sagt dieser Lauf nichts. */
  readonly checked: boolean;
  /** Warum nicht (`incomplete-read`) — sonst `null`. */
  readonly reason: string | null;
  /** In der Quelle gelöscht (404 bestätigt). */
  readonly removed: readonly string[];
  /** Wieder in der Quelle vorhanden — ein früherer Löschvermerk wurde aufgehoben. */
  readonly restored: readonly string[];
  /** Nicht mehr im Bereich, aber vorhanden. */
  readonly outsideScope: readonly string[];
  /** Zustand unbekannt (Nachfrage gescheitert, unbrauchbare Antwort, Höchstzahl). */
  readonly unchecked: readonly string[];
  /** R-0163: unveränderte Seiten, deren Anhangsquellen angeglichen wurden. */
  readonly attachmentsUpdated: readonly string[];
}

export const MAX_SOURCE_SYNC_IDS = 200;

/**
 * Feld für Feld neu gebaut — nur Kennungen als Zeichenketten, gedeckelt. So kann kein Aufrufer (und
 * kein Altbestand in der Tabelle) über dieses Feld Inhalt an den Lauf hängen.
 */
export function sourceSyncSnapshot(sync: unknown): ImportRunSourceSync {
  const roh = (sync ?? {}) as Record<string, unknown>;
  const ids = (werte: unknown) =>
    (Array.isArray(werte) ? werte : [])
      .filter((w): w is string => typeof w === "string" && w.length > 0 && w.length <= 512)
      .slice(0, MAX_SOURCE_SYNC_IDS);
  return {
    checked: roh.checked === true,
    reason: typeof roh.reason === "string" ? roh.reason.slice(0, 64) : null,
    removed: ids(roh.removed),
    restored: ids(roh.restored),
    outsideScope: ids(roh.outsideScope),
    unchecked: ids(roh.unchecked),
    attachmentsUpdated: ids(roh.attachmentsUpdated),
  };
}

export interface QuellabgleichRepo {
  /** Hält das Ergebnis des Laufs fest; ein zweiter Aufruf für denselben Lauf ersetzt es. */
  speichere(importId: string, sync: ImportRunSourceSync): Promise<void>;
  /** `undefined`: dieser Lauf trägt keinen Abgleich. */
  lies(importId: string): Promise<ImportRunSourceSync | undefined>;
}

export class InMemoryQuellabgleichRepo implements QuellabgleichRepo {
  private readonly ablage = new Map<string, ImportRunSourceSync>();

  async speichere(importId: string, sync: ImportRunSourceSync): Promise<void> {
    this.ablage.set(importId, sourceSyncSnapshot(sync));
  }

  async lies(importId: string): Promise<ImportRunSourceSync | undefined> {
    const sync = this.ablage.get(importId);
    return sync ? sourceSyncSnapshot(sync) : undefined;
  }
}

/**
 * Die Tabelle der Abgleichsergebnisse. Rein additiv und wiederholbar (`CREATE TABLE IF NOT EXISTS`),
 * ohne Fremdschlüssel auf `import_runs`: eine Zeile ohne Lauf ist ein verwaistes Ergebnis, das
 * niemand liest (gelesen wird nur neben einem gefundenen Lauf) — kein Grund, eine Migration
 * scheitern zu lassen.
 */
export const IMPORT_RUN_SOURCE_SYNC_SCHEMA = `
CREATE TABLE IF NOT EXISTS import_run_source_sync (
  import_id text PRIMARY KEY,
  data jsonb NOT NULL,
  gespeichert_am timestamptz NOT NULL DEFAULT now()
);
`;

export class PgQuellabgleichRepo implements QuellabgleichRepo {
  constructor(private readonly pool: Pool) {}

  async speichere(importId: string, sync: ImportRunSourceSync): Promise<void> {
    await this.pool.query(
      `INSERT INTO import_run_source_sync (import_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (import_id) DO UPDATE SET data = EXCLUDED.data, gespeichert_am = now()`,
      [importId, JSON.stringify(sourceSyncSnapshot(sync))],
    );
  }

  async lies(importId: string): Promise<ImportRunSourceSync | undefined> {
    const res = await this.pool.query<{ data: unknown }>(
      "SELECT data FROM import_run_source_sync WHERE import_id = $1",
      [importId],
    );
    const zeile = res.rows[0];
    return zeile ? sourceSyncSnapshot(zeile.data) : undefined;
  }
}
