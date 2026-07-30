// Reine, DOM-freie Ableitung der Herkunft (SCRUM-142). Nutzt ausschließlich vorhandene echte
// Signale: Version, History, Autor/Originalautor, Quellen und Audit-Ereignisse.
//
// AUFTRAG-mega68: `relatedKos` (SCRUM-130) ist hier BEWUSST entfernt. Die Heuristik rechnete im
// Browser über die VOLLE KO-Liste (skalierte mit dem Bestand, nicht mit dem Objekt) und zählte
// ubiquitäre Schlagwörter wie `pilot-demo` als Verwandtschaft — im Demobestand war damit jedes
// Objekt mit jedem verwandt. Die Detailseite bezieht die Nachbarschaft jetzt aus der begrenzten,
// serverseitig rechte-gefilterten Auskunft GET /api/kos/:id/neighbors (KnowledgeNeighborhood).
import type { AuditEntry, KnowledgeObject } from "../api/types";

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
