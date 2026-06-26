import type { StoredObject } from "./types";

// Persistenz-Schnittstelle des Object-Stores (einziger Unterschied In-Memory ↔ später Pg/Disk).
export interface ObjectRepo {
  insert(obj: StoredObject): Promise<void>;
  findById(id: string): Promise<StoredObject | undefined>;
}

export class InMemoryObjectRepo implements ObjectRepo {
  private readonly items = new Map<string, StoredObject>();

  insert(obj: StoredObject): Promise<void> {
    this.items.set(obj.ref.id, obj);
    return Promise.resolve();
  }

  findById(id: string): Promise<StoredObject | undefined> {
    return Promise.resolve(this.items.get(id));
  }
}
