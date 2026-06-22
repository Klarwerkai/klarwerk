import type { Draft } from "./types";

export interface DraftRepo {
  insert(draft: Draft): Promise<void>;
  findById(id: string): Promise<Draft | undefined>;
  update(draft: Draft): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<Draft[]>; // FR-CAP-06: gemeinsamer Pool — alle Entwürfe.
}

export class InMemoryDraftRepo implements DraftRepo {
  private readonly drafts = new Map<string, Draft>();

  insert(draft: Draft): Promise<void> {
    this.drafts.set(draft.id, draft);
    return Promise.resolve();
  }

  findById(id: string): Promise<Draft | undefined> {
    return Promise.resolve(this.drafts.get(id));
  }

  update(draft: Draft): Promise<void> {
    this.drafts.set(draft.id, draft);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.drafts.delete(id);
    return Promise.resolve();
  }

  list(): Promise<Draft[]> {
    return Promise.resolve([...this.drafts.values()]);
  }
}
