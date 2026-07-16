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

// SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: datenquellennahe Kandidatenabfrage für Ask. Statt den
// gesamten Pool (`list()`) in den Speicher zu laden, liefert das Repository eine VORGEFILTERTE,
// auf `limit` begrenzte Kandidatenmenge: KOs, deren durchsuchbarer Text (Titel/Aussage/Tags/Kategorie)
// mindestens einen der (bereits tokenisierten) Inhalts-Terme enthält. `terms` sind Inhaltstoken der
// Frage (Stoppwörter entfernt) — die Auswahl bleibt damit konsistent zum Ranking aus SCRUM-360.
// Die feine Relevanz-/Status-/Trust-Sortierung übernimmt weiterhin der Reasoner (`selectCandidates`);
// dieser Prefilter ist bewusst grob (ODER-Treffer + Cap), bevorzugt aber bei Gleichstand validierte/
// vertrauenswürdigere KOs, damit relevante validierte Treffer unter dem Limit erhalten bleiben.
export interface KoCandidateQuery {
  terms: readonly string[];
  limit: number;
}

export interface KoRepo {
  insert(ko: KnowledgeObject): Promise<void>;
  findById(id: string): Promise<KnowledgeObject | undefined>;
  update(ko: KnowledgeObject): Promise<void>;
  delete(id: string): Promise<void>;
  list(filter: KoFilter): Promise<KnowledgeObject[]>;
  // SCRUM-361: begrenzte, vorgefilterte Kandidatenmenge für Ask (kein All-Pool-Load mehr).
  findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]>;
}

// Durchsuchbarer Text eines KO für die grobe Kandidaten-Vorauswahl (kein Quelleninhalt wird verändert).
export function koCandidateText(ko: KnowledgeObject): string {
  return `${ko.title} ${ko.statement} ${ko.tags.join(" ")} ${ko.category}`.toLowerCase();
}

// Anzahl der (distinct) Inhalts-Terme, die als Teilstring im KO-Text vorkommen. Teilstring ist bewusst
// breiter als die Token-Gleichheit des Reasoners → der Prefilter schließt nie einen KO aus, den
// `selectCandidates` behalten würde (sichere Obermenge), gatet aber irrelevante KOs (Score 0) aus.
export function koCandidateScore(ko: KnowledgeObject, terms: readonly string[]): number {
  const text = koCandidateText(ko);
  let score = 0;
  for (const term of terms) {
    if (term.length > 0 && text.includes(term)) {
      score += 1;
    }
  }
  return score;
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

  // SCRUM-361: vorgefilterte, begrenzte Kandidatenmenge. ODER-Treffer über die Inhalts-Terme,
  // sortiert nach (Term-Trefferzahl ↓, validiert zuerst, Trust ↓) und auf `limit` gedeckelt — so
  // bleiben relevante validierte Treffer auch bei vielen Kandidaten unter dem Limit erhalten.
  //
  // SCRUM-491 (ben-Re-Review, Scope-Ehrlichkeit): Dies ist der TEST-/DEV-Adapter und ist NICHT
  // quell-seitig gedeckelt — er scort den (kleinen) In-Memory-Bestand VOLLSTÄNDIG und schneidet erst
  // danach auf `limit`. Der einzige aktuell implementierte quell-gedeckelte Adapter ist PgKoRepo
  // (hartes SQL LIMIT, quell-seitig, s. repo-pg.ts). Geplante weitere Adapter (pgvector,
  // sqlite-vec/Insel) sind NOCH NICHT implementiert und müssten den Top-K-Quell-Vertrag selbst
  // erfüllen, wenn gebaut. Nicht für einen echten Live-Bestand verwenden — bei großem Bestand würde
  // hier der Full-Scan teuer.
  findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
    const terms = query.terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
    if (terms.length === 0) {
      return Promise.resolve([]);
    }
    const limit = Math.max(0, Math.floor(query.limit));
    const ranked = [...this.items.values()]
      .map((ko) => ({ ko, score: koCandidateScore(ko, terms) }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.ko.status === "validiert") - Number(a.ko.status === "validiert") ||
          b.ko.trust - a.ko.trust,
      )
      .slice(0, limit)
      .map((x) => x.ko);
    return Promise.resolve(ranked);
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
