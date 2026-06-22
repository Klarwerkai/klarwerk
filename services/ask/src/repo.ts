import type { Gap } from "./types";

export interface GapRepo {
  insert(gap: Gap): Promise<void>;
  findById(id: string): Promise<Gap | undefined>;
  update(gap: Gap): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<Gap[]>;
}

export class InMemoryGapRepo implements GapRepo {
  private readonly gaps = new Map<string, Gap>();

  insert(gap: Gap): Promise<void> {
    this.gaps.set(gap.id, gap);
    return Promise.resolve();
  }

  findById(id: string): Promise<Gap | undefined> {
    return Promise.resolve(this.gaps.get(id));
  }

  update(gap: Gap): Promise<void> {
    this.gaps.set(gap.id, gap);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.gaps.delete(id);
    return Promise.resolve();
  }

  all(): Promise<Gap[]> {
    return Promise.resolve([...this.gaps.values()]);
  }
}
