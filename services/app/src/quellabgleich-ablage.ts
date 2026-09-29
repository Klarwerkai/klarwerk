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

/** Die Listenfelder des Abgleichs — je Feld eine Liste von Quell-Kennungen und eine Gesamtzahl. */
export const SOURCE_SYNC_LISTEN = [
  "removed",
  "restored",
  "outsideScope",
  "unchecked",
  "attachmentsUpdated",
  "restrictionsUpdated",
  "syncFailed",
] as const;

export type SourceSyncListe = (typeof SOURCE_SYNC_LISTEN)[number];

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
  /** R-0162/R-0549 (Lauf 3 R2): unveränderte Seiten, deren Quellrestriktion nachgezogen wurde. */
  readonly restrictionsUpdated: readonly string[];
  /** R-0163 (Lauf 3 R2): Seiten, deren Nachzug (Anhänge/Restriktion) beim Schreiben scheiterte. */
  readonly syncFailed: readonly string[];
  /**
   * Lauf 3 R2 (Bens B6): die GESAMTZAHL je Liste. Die Listen sind gedeckelt, die Zahlen nicht — die
   * Anzeige zählt hiernach, nie nach der Listenlänge. `listsTruncated`: mindestens eine Liste ist
   * kürzer als ihre Zahl.
   */
  readonly counts: Readonly<Record<SourceSyncListe, number>>;
  readonly listsTruncated: boolean;
}

export const MAX_SOURCE_SYNC_IDS = 200;

/**
 * Feld für Feld neu gebaut — nur Kennungen als Zeichenketten, gedeckelt, und je Liste die Zahl VOR
 * dem Deckel. So kann kein Aufrufer (und kein Altbestand in der Tabelle) über dieses Feld Inhalt an
 * den Lauf hängen, und keine Kürzung bleibt stumm.
 */
export function sourceSyncSnapshot(sync: unknown): ImportRunSourceSync {
  const roh = (sync ?? {}) as Record<string, unknown>;
  const rohZahlen = (roh.counts ?? {}) as Record<string, unknown>;
  const gueltig = (werte: unknown) =>
    (Array.isArray(werte) ? werte : []).filter(
      (w): w is string => typeof w === "string" && w.length > 0 && w.length <= 512,
    );
  const listen = {} as Record<SourceSyncListe, string[]>;
  const counts = {} as Record<SourceSyncListe, number>;
  let listsTruncated = false;
  for (const feld of SOURCE_SYNC_LISTEN) {
    const alle = gueltig(roh[feld]);
    const gemeldet = rohZahlen[feld];
    // Eine gemeldete Zahl gilt nur, wenn sie eine ganze Zahl ist und die Liste nicht unterbietet.
    const zahl =
      typeof gemeldet === "number" && Number.isSafeInteger(gemeldet) && gemeldet >= alle.length
        ? gemeldet
        : alle.length;
    listen[feld] = alle.slice(0, MAX_SOURCE_SYNC_IDS);
    counts[feld] = zahl;
    listsTruncated = listsTruncated || listen[feld].length < zahl;
  }
  return {
    checked: roh.checked === true,
    reason: typeof roh.reason === "string" ? roh.reason.slice(0, 64) : null,
    ...listen,
    counts,
    listsTruncated,
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
