import type {
  EvidenceRecord,
  KnowledgeObject,
  KnowledgeType,
  KoStatus,
  KoVersionSnapshot,
} from "./types";

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
  delete(id: string): Promise<void>;
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

  delete(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }

  list(filter: KoFilter): Promise<KnowledgeObject[]> {
    return Promise.resolve([...this.items.values()].filter((ko) => matches(ko, filter)));
  }
}

// SCRUM-159: Persistenz der KO-Version-Snapshots. Append-only; ein bereits gespeicherter
// (koId, version) wird NIE überschrieben (frühere Versionen bleiben unveränderlich).
export interface KoVersionRepo {
  append(snapshot: KoVersionSnapshot): Promise<void>;
  listByKo(koId: string): Promise<KoVersionSnapshot[]>;
}

export class InMemoryKoVersionRepo implements KoVersionRepo {
  // koId → version → Snapshot. Map bewahrt Reihenfolge; vorhandene Version wird nicht ersetzt.
  private readonly items = new Map<string, Map<number, KoVersionSnapshot>>();

  append(snapshot: KoVersionSnapshot): Promise<void> {
    const byVersion = this.items.get(snapshot.koId) ?? new Map<number, KoVersionSnapshot>();
    if (!byVersion.has(snapshot.version)) {
      byVersion.set(snapshot.version, snapshot);
    }
    this.items.set(snapshot.koId, byVersion);
    return Promise.resolve();
  }

  listByKo(koId: string): Promise<KoVersionSnapshot[]> {
    const byVersion = this.items.get(koId);
    const list = byVersion ? [...byVersion.values()] : [];
    return Promise.resolve(list.sort((a, b) => a.version - b.version));
  }
}

// SCRUM-160: Evidence-Records separat vom KO-JSON. Append-only; vorhandene Evidence-ID wird
// nicht überschrieben. Damit bleiben Quellen-/Anhang-Nachweise stabil referenzierbar.
export interface EvidenceRepo {
  append(record: EvidenceRecord): Promise<void>;
  listByKo(koId: string): Promise<EvidenceRecord[]>;
  // SCRUM-169: KO-übergreifende, read-only Sicht (jüngste zuerst) für den QM-Evidence-Index.
  recent(limit: number): Promise<EvidenceRecord[]>;
}

export class InMemoryEvidenceRepo implements EvidenceRepo {
  private readonly items = new Map<string, EvidenceRecord>();

  append(record: EvidenceRecord): Promise<void> {
    if (!this.items.has(record.id)) {
      this.items.set(record.id, record);
    }
    return Promise.resolve();
  }

  listByKo(koId: string): Promise<EvidenceRecord[]> {
    const records = [...this.items.values()]
      .filter((record) => record.koId === koId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return Promise.resolve(records);
  }

  recent(limit: number): Promise<EvidenceRecord[]> {
    const records = [...this.items.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, Math.max(0, limit));
    return Promise.resolve(records);
  }
}
