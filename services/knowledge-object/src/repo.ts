import type { KnowledgeObject, KnowledgeType, KoStatus } from "./types";

export interface KoFilter {
  type?: KnowledgeType;
  status?: KoStatus;
  category?: string;
  tag?: string;
}

export interface KoRepo {
  insert(ko: KnowledgeObject): Promise<void>;
  findById(id: string): Promise<KnowledgeObject | undefined>;
  update(ko: KnowledgeObject): Promise<void>;
  list(filter: KoFilter): Promise<KnowledgeObject[]>;
}

function matches(ko: KnowledgeObject, filter: KoFilter): boolean {
  if (filter.type && ko.type !== filter.type) {
    return false;
  }
  if (filter.status && ko.status !== filter.status) {
    return false;
  }
  if (filter.category && ko.category !== filter.category) {
    return false;
  }
  if (filter.tag && !ko.tags.includes(filter.tag)) {
    return false;
  }
  return true;
}

export class InMemoryKoRepo implements KoRepo {
  private readonly items = new Map<string, KnowledgeObject>();

  insert(ko: KnowledgeObject): Promise<void> {
    this.items.set(ko.id, ko);
    return Promise.resolve();
  }

  findById(id: string): Promise<KnowledgeObject | undefined> {
    return Promise.resolve(this.items.get(id));
  }

  update(ko: KnowledgeObject): Promise<void> {
    this.items.set(ko.id, ko);
    return Promise.resolve();
  }

  list(filter: KoFilter): Promise<KnowledgeObject[]> {
    return Promise.resolve([...this.items.values()].filter((ko) => matches(ko, filter)));
  }
}
