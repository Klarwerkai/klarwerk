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
  all(): Promise<AuditEntry[]>;
  last(tx?: TxContext): Promise<AuditEntry | undefined>;
}

export class InMemoryAuditRepo implements AuditRepo {
  private readonly entries: AuditEntry[] = [];

  append(entry: AuditEntry, _tx?: TxContext): Promise<void> {
    this.entries.push(Object.freeze(entry));
    return Promise.resolve();
  }

  all(): Promise<AuditEntry[]> {
    return Promise.resolve([...this.entries]);
  }

  last(_tx?: TxContext): Promise<AuditEntry | undefined> {
    return Promise.resolve(this.entries[this.entries.length - 1]);
  }
}
