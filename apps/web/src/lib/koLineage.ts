// Reine, DOM-freie Ableitung von Wissensnetz & Herkunft (SCRUM-130 / SCRUM-142).
// Nutzt ausschließlich vorhandene echte Signale: Tags, Kategorie, Quellen, Version,
// History, Autor/Originalautor und Audit-Ereignisse. KEINE erfundene Hierarchie,
// KEINE gerichteten Herkunftskanten, kein Backend-Modell.
import type { AuditEntry, KnowledgeObject, KoSource } from "../api/types";

export type RelationReason = "tag" | "category" | "source";

export interface RelatedKo {
  id: string;
  title: string;
  reasons: RelationReason[];
  via: string[]; // konkrete geteilte Werte (Tags, Kategorie, Quellen-Label)
}

function sourceKeys(sources: readonly KoSource[] | undefined): Map<string, string> {
  // key = url|label (lowercase) → Anzeige-Label
  const map = new Map<string, string>();
  for (const s of sources ?? []) {
    const key = (s.url ?? s.label).trim().toLowerCase();
    if (key) {
      map.set(key, s.label);
    }
  }
  return map;
}

// SCRUM-130: verwandte KOs über geteilte Tags / gleiche Kategorie / geteilte Quelle.
export function relatedKos(
  current: KnowledgeObject,
  all: readonly KnowledgeObject[],
  limit = 8,
): RelatedKo[] {
  const currentTags = new Set(current.tags);
  const currentSources = sourceKeys(current.sources);

  const related: RelatedKo[] = [];
  for (const ko of all) {
    if (ko.id === current.id) {
      continue;
    }
    const reasons: RelationReason[] = [];
    const via: string[] = [];

    const sharedTags = ko.tags.filter((tag) => currentTags.has(tag));
    if (sharedTags.length > 0) {
      reasons.push("tag");
      via.push(...sharedTags);
    }
    if (current.category && ko.category === current.category) {
      reasons.push("category");
      via.push(ko.category);
    }
    const otherSources = sourceKeys(ko.sources);
    const sharedSources: string[] = [];
    for (const [key, label] of otherSources) {
      if (currentSources.has(key)) {
        sharedSources.push(label);
      }
    }
    if (sharedSources.length > 0) {
      reasons.push("source");
      via.push(...sharedSources);
    }

    if (reasons.length > 0) {
      related.push({ id: ko.id, title: ko.title, reasons, via: [...new Set(via)] });
    }
  }

  related.sort(
    (a, b) =>
      b.reasons.length - a.reasons.length ||
      b.via.length - a.via.length ||
      a.title.localeCompare(b.title),
  );
  return related.slice(0, limit);
}

// SCRUM-142: Audit-Ereignisse dieses KO (target === ko.id), chronologisch.
export function koAuditEvents(entries: readonly AuditEntry[], koId: string): AuditEntry[] {
  return entries.filter((e) => e.target === koId).sort((a, b) => a.seq - b.seq);
}

export interface LineageSummary {
  originalAuthor: string;
  author: string;
  authorTransferred: boolean;
  versions: number;
  historyCount: number;
  sourceCount: number;
  relatedCount: number;
}

// SCRUM-142: kompakte Herkunftskennzahlen aus echten Feldern.
export function lineageSummary(ko: KnowledgeObject, relatedCount: number): LineageSummary {
  return {
    originalAuthor: ko.originalAuthor,
    author: ko.author,
    authorTransferred: ko.author !== ko.originalAuthor,
    versions: ko.version,
    historyCount: ko.history.length,
    sourceCount: ko.sources?.length ?? 0,
    relatedCount,
  };
}
