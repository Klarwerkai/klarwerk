import type { ObjectRef, StoredObject } from "./types";

// Persistenz-Schnittstelle des Object-Stores (einziger Unterschied In-Memory ↔ später Pg/Disk).
export interface ObjectRepo {
  insert(obj: StoredObject): Promise<void>;
  findById(id: string): Promise<StoredObject | undefined>;
  // AUFTRAG-mega20 Block C: NUR die Metadaten des gesamten Bestands. Die Trennung ist der Punkt —
  // eine Liste, die die Bytes mitliefert, ist bei echten Originalen (mehrere MB je Datei) nicht
  // benutzbar, und ein Aufrufer, der sie trotzdem benutzt, merkt es erst in Produktion.
  list(): Promise<ObjectRef[]>;
  // AUFTRAG-mega20 Block C: endgültiges Entfernen. `false` = war nicht da (kein Fehler — der
  // gewünschte Endzustand ist bereits erreicht). Bis mega19 war der Store append-only; ein
  // versehentlich hochgeladenes Original war nicht mehr entfernbar.
  delete(id: string): Promise<boolean>;
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

  list(): Promise<ObjectRef[]> {
    return Promise.resolve([...this.items.values()].map((obj) => obj.ref));
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.items.delete(id));
  }
}
