// ================================================================================================
// AUFNAHME 20260922 · PRÜFUNG-GEDÄCHTNIS (R-1103 / R-1105) — DAS ERGEBNIS-GEDÄCHTNIS DER ERKENNUNG.
// ================================================================================================
//
// Berater-Konzept 04.07. (2.3 `PairVerdict`, 4.3 Falsch-Positive, Test 9.4): je geprüftem Paar merkt
// sich die Erkennung, unter WELCHEM Textstand beider Seiten sie geurteilt hat und mit welchem Ausgang.
//   none      — die KI hat geurteilt: kein (ausreichend sicherer) Widerspruch.
//   created   — es wurde ein Befund angelegt (die Paar-Dedupe am offenen Befund trägt ihn weiter).
//   dismissed — ein Mensch hat den Befund als Fehlalarm geschlossen (R-1105).
//   decided   — ein Mensch hat den Befund inhaltlich entschieden.
// Bei none/dismissed/decided und UNVERÄNDERTEM Stand geht das Paar nicht erneut an die KI und es
// entsteht kein neuer offener Fall (R-1103). Ändert sich der Kerntext einer Seite, ändert sich der
// Stand — das Paar ist wieder prüfbar.
//
// DER STAND ist ein Fingerabdruck dessen, was der Urteilende tatsächlich sieht: die Kerntexte beider
// Seiten (K0-2, `coreText`), die Prompt-Fassung und die Vertraulichkeit des Paares (sie bestimmt den
// Modellweg). Gespeichert wird NUR der Hash und die beiden Kennungen — kein Text.
//
// GRENZEN (ehrlich): `created` unterdrückt allein nichts — endet ein Befund systemisch (superseded,
// participant_deleted), wird das Paar neu beurteilt. Ein MANUELL angelegter Konflikt hat keinen
// gemerkten Stand; sein Fehlalarm-Schluss unterdrückt einen späteren Automatikfund nur über die
// Versionsbindung (s. ConflictService.menschlichAbgeschlossen), die manuelle Konflikte nicht tragen.
import { createHash } from "node:crypto";
import type { Pool } from "pg";

export type PairMemoryOutcome = "none" | "created" | "dismissed" | "decided";

export interface PairMemoryEntry {
  // Sortierte Beteiligte, typunabhängig (das Urteil bestimmt erst den Typ): `ko:x|ko:y`.
  pairKey: string;
  stand: string;
  outcome: PairMemoryOutcome;
  conflictId?: string;
  at: string;
}

export interface ConflictMemoryRepo {
  // EIN Abruf für alle Paare eines Laufs (kein Rundgang je Kandidat).
  find(pairKeys: readonly string[]): Promise<PairMemoryEntry[]>;
  // Letzter Stand gewinnt (Upsert je pairKey) — das Replay im Dev-Journal ist damit deterministisch.
  put(entry: PairMemoryEntry): Promise<void>;
}

export function memoryKey(refA: string, refB: string): string {
  const [x, y] = [refA, refB].sort();
  return `ko:${x}|ko:${y}`;
}

// Reihenfolgeunabhängig: dasselbe Paar ergibt denselben Stand, gleich wer Subjekt ist.
export function pruefstand(
  a: { refId: string; core: string },
  b: { refId: string; core: string },
  promptVersion: string,
  confidential: boolean,
): string {
  const seiten = [a, b]
    .map((s) => [s.refId, s.core] as const)
    .sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
  return createHash("sha256")
    .update(JSON.stringify(["konflikt-pruefstand", promptVersion, confidential, seiten]))
    .digest("hex");
}

export class InMemoryConflictMemoryRepo implements ConflictMemoryRepo {
  private readonly entries = new Map<string, PairMemoryEntry>();

  find(pairKeys: readonly string[]): Promise<PairMemoryEntry[]> {
    const found: PairMemoryEntry[] = [];
    for (const key of new Set(pairKeys)) {
      const entry = this.entries.get(key);
      if (entry) {
        found.push(entry);
      }
    }
    return Promise.resolve(found);
  }

  put(entry: PairMemoryEntry): Promise<void> {
    this.entries.set(entry.pairKey, entry);
    return Promise.resolve();
  }
}

interface MemoryRow {
  data: PairMemoryEntry;
}

// Tabelle `conflict_pair_memory` — angelegt in CONFLICTS_SCHEMA (repo-pg.ts), dieselbe Stufe.
export class PgConflictMemoryRepo implements ConflictMemoryRepo {
  constructor(private readonly pool: Pool) {}

  async find(pairKeys: readonly string[]): Promise<PairMemoryEntry[]> {
    if (pairKeys.length === 0) {
      return [];
    }
    const res = await this.pool.query<MemoryRow>(
      "SELECT data FROM conflict_pair_memory WHERE pair_key = ANY($1::text[])",
      [[...new Set(pairKeys)]],
    );
    return res.rows.map((row) => row.data);
  }

  async put(entry: PairMemoryEntry): Promise<void> {
    await this.pool.query(
      "INSERT INTO conflict_pair_memory(pair_key,data) VALUES($1,$2) " +
        "ON CONFLICT (pair_key) DO UPDATE SET data=$2",
      [entry.pairKey, JSON.stringify(entry)],
    );
  }
}
