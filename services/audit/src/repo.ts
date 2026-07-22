import type { TxContext } from "../../db-tx";
import type { AuditEntry } from "./types";

// SCRUM-523 P.3 (WP-A2): append/last nehmen einen OPTIONALEN, opaken TxContext (services/db-tx) an —
// additiv, abwärtskompatibel (bestehende Aufrufer ohne tx unverändert). Zweck: der Purge-Chokepoint in
// knowledge-object (repo.delete + audit.record) kann beide Schritte in DERSELBEN echten DB-Transaktion
// laufen lassen, ohne dass dieses Interface einen Pg-Typ führt — InMemoryAuditRepo ignoriert den
// Parameter einfach (dort ist Atomarität trivial).
// FR-AUD-02: nur Anhängen — bewusst KEINE update/delete-Methoden.
export interface AuditRepo {
  append(entry: AuditEntry, tx?: TxContext): Promise<void>;
  // WP-SHIP8-CLOSE-6 (bens ROT-1): PERSISTENZGESTÜTZTES exactly-once-Anhängen über die stabile
  // entry.eventId — Pg: partieller Unique-Index + ON CONFLICT DO NOTHING; InMemory: synchroner
  // Set-Guard (kein await zwischen Prüfen und Anhängen). Rückgabe true = DIESER Aufruf hat
  // geschrieben; false = der Beleg existierte bereits (idempotenter No-op, kein Fehler).
  appendOnce(entry: AuditEntry, tx?: TxContext): Promise<boolean>;
  all(): Promise<AuditEntry[]>;
  last(tx?: TxContext): Promise<AuditEntry | undefined>;
}

export class InMemoryAuditRepo implements AuditRepo {
  private readonly entries: AuditEntry[] = [];
  // WP-SHIP8-CLOSE-6 (bens ROT-1): Spiegel des partiellen Pg-Unique-Index audit_event_id_uq.
  private readonly eventIds = new Set<string>();

  append(entry: AuditEntry, _tx?: TxContext): Promise<void> {
    if (entry.eventId) {
      this.eventIds.add(entry.eventId);
    }
    this.entries.push(Object.freeze(entry));
    return Promise.resolve();
  }

  // Synchron geprüft UND vermerkt — zwei parallele Nachzüge, die beide einen leeren Read sahen,
  // schreiben trotzdem exakt EINEN Eintrag (der zweite Aufruf ist ein ehrlicher No-op).
  appendOnce(entry: AuditEntry, _tx?: TxContext): Promise<boolean> {
    if (entry.eventId && this.eventIds.has(entry.eventId)) {
      return Promise.resolve(false);
    }
    if (entry.eventId) {
      this.eventIds.add(entry.eventId);
    }
    this.entries.push(Object.freeze(entry));
    return Promise.resolve(true);
  }

  all(): Promise<AuditEntry[]> {
    return Promise.resolve([...this.entries]);
  }

  last(_tx?: TxContext): Promise<AuditEntry | undefined> {
    return Promise.resolve(this.entries[this.entries.length - 1]);
  }
}
