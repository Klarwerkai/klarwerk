import type { Conflict } from "./types";

export interface ConflictRepo {
  insert(conflict: Conflict): Promise<void>;
  findById(id: string): Promise<Conflict | undefined>;
  update(conflict: Conflict): Promise<void>;
  all(): Promise<Conflict[]>;
}

export class InMemoryConflictRepo implements ConflictRepo {
  private readonly conflicts = new Map<string, Conflict>();

  insert(conflict: Conflict): Promise<void> {
    this.conflicts.set(conflict.id, conflict);
    return Promise.resolve();
  }

  findById(id: string): Promise<Conflict | undefined> {
    return Promise.resolve(this.conflicts.get(id));
  }

  update(conflict: Conflict): Promise<void> {
    this.conflicts.set(conflict.id, conflict);
    return Promise.resolve();
  }

  all(): Promise<Conflict[]> {
    return Promise.resolve([...this.conflicts.values()]);
  }
}
