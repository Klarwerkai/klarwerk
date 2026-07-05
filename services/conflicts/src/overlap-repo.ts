import type { OverlapEntry } from "./overlap-types";

// Persistenz der Überschneidungs-Einträge (Muster ConflictRepo). Pg-Adapter + Dev-Persist folgen in
// der Verdrahtungs-Stufe; die In-Memory-Variante trägt Logik und Tests.
export interface OverlapRepo {
  insert(entry: OverlapEntry): Promise<void>;
  findById(id: string): Promise<OverlapEntry | undefined>;
  update(entry: OverlapEntry): Promise<void>;
  all(): Promise<OverlapEntry[]>;
}

export class InMemoryOverlapRepo implements OverlapRepo {
  private readonly entries = new Map<string, OverlapEntry>();

  insert(entry: OverlapEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  findById(id: string): Promise<OverlapEntry | undefined> {
    return Promise.resolve(this.entries.get(id));
  }

  update(entry: OverlapEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  all(): Promise<OverlapEntry[]> {
    return Promise.resolve([...this.entries.values()]);
  }
}
