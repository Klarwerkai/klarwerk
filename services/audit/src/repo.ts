import type { AuditEntry } from "./types";

// FR-AUD-02: nur Anhängen — bewusst KEINE update/delete-Methoden.
export interface AuditRepo {
  append(entry: AuditEntry): Promise<void>;
  all(): Promise<AuditEntry[]>;
  last(): Promise<AuditEntry | undefined>;
}

export class InMemoryAuditRepo implements AuditRepo {
  private readonly entries: AuditEntry[] = [];

  append(entry: AuditEntry): Promise<void> {
    this.entries.push(Object.freeze(entry));
    return Promise.resolve();
  }

  all(): Promise<AuditEntry[]> {
    return Promise.resolve([...this.entries]);
  }

  last(): Promise<AuditEntry | undefined> {
    return Promise.resolve(this.entries[this.entries.length - 1]);
  }
}
