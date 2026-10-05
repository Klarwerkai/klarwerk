// Reine, DOM-freie Ableitung der Herkunft (SCRUM-142). Nutzt ausschließlich vorhandene echte
// Signale: Version, History, Autor/Originalautor, Quellen und Audit-Ereignisse.
//
// AUFTRAG-mega68: `relatedKos` (SCRUM-130) ist hier BEWUSST entfernt. Die Heuristik rechnete im
// Browser über die VOLLE KO-Liste (skalierte mit dem Bestand, nicht mit dem Objekt) und zählte
// ubiquitäre Schlagwörter wie `pilot-demo` als Verwandtschaft — im Demobestand war damit jedes
// Objekt mit jedem verwandt. Die Detailseite bezieht die Nachbarschaft jetzt aus der begrenzten,
// serverseitig rechte-gefilterten Auskunft GET /api/kos/:id/neighbors (KnowledgeNeighborhood).
import type { AuditEntry, KnowledgeObject } from "../api/types";

/** Nennt der Beleg das Objekt in seiner Nutzlast (`koId` oder in der Liste `koIds`)? */
function nenntObjekt(e: AuditEntry, koId: string): boolean {
  const p = e.payload as { koId?: unknown; koIds?: unknown } | undefined;
  return p?.koId === koId || (Array.isArray(p?.koIds) && p.koIds.includes(koId));
}

/**
 * Befundarten, deren Belege die Befund-Kennung als Ziel tragen (nicht das Objekt): Konflikte und
 * Überschneidungen. Ein solcher Beleg gehört zur Objektkette, sobald IRGENDEIN Beleg desselben
 * Befunds das Objekt nennt — die Folgeereignisse (Eskalation, „getrennt lassen" …) erben den Bezug.
 */
const BEFUND_PRAEFIXE = ["conflict.", "overlap."] as const;

function istBefundBeleg(e: AuditEntry): boolean {
  return BEFUND_PRAEFIXE.some((p) => e.action.startsWith(p));
}

// SCRUM-142: Audit-Ereignisse dieses KO, chronologisch.
//
// Aufnahme gesamt-auditprotokoll (R-0766): DIE DURCHGEHENDE KETTE AM OBJEKT. Bis Runde 1 nur
// `target === ko.id` — Konflikte (Ziel = Konflikt-Id), Überschneidungen (Ziel = Überschneidungs-Id)
// und Exporte (Ziel `library`) fehlten, obwohl sie das Objekt betreffen. Jetzt gehören dazu:
//   · jeder Beleg mit dem Objekt als Ziel,
//   · jeder Beleg, der das Objekt in der Nutzlast nennt (`koId`, `koIds` — z. B. `library.export`,
//     `conflict.created`, `overlap.auto-created`, `overlap.kept-separate`),
//   · jeder Beleg zu einem Konflikt oder einer Überschneidung, an der das Objekt beteiligt ist.
//     Die Befund-Kennungen kommen aus den Belegen selbst und — für Altbelege ohne `koIds` — aus
//     `verbundeneBefunde` (Lauf 2: alle Konflikte UND Überschneidungen des Objekts, auch
//     abgeschlossene, vom Server über `GET /api/audit/ko/:koId/findings`).
export function koAuditEvents(
  entries: readonly AuditEntry[],
  koId: string,
  verbundeneBefunde: readonly string[] = [],
): AuditEntry[] {
  const befunde = new Set(verbundeneBefunde);
  for (const e of entries) {
    if (istBefundBeleg(e) && nenntObjekt(e, koId)) {
      befunde.add(e.target);
    }
  }
  return entries
    .filter(
      (e) =>
        e.target === koId || nenntObjekt(e, koId) || (istBefundBeleg(e) && befunde.has(e.target)),
    )
    .sort((a, b) => a.seq - b.seq);
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
