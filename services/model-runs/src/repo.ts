import type { ModelRunRecord } from "./types";

// SCRUM-164: Persistenz-Schnittstelle des ModelRun-Protokolls. append-only; `recent`
// liefert die jüngsten Läufe (read-only Service-/Test-Vertrag).
export interface ModelRunRepo {
  append(record: ModelRunRecord): Promise<void>;
  recent(limit?: number): Promise<ModelRunRecord[]>;
}

export class InMemoryModelRunRepo implements ModelRunRepo {
  private readonly items: ModelRunRecord[] = [];

  append(record: ModelRunRecord): Promise<void> {
    this.items.push(record);
    return Promise.resolve();
  }

  recent(limit = 100): Promise<ModelRunRecord[]> {
    const sorted = [...this.items].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return Promise.resolve(sorted.slice(0, Math.max(0, limit)));
  }
}
