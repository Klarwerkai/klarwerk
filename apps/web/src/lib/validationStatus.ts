// Reine, DOM-freie Status-/Rückgabe-Logik (SCRUM-124/125/126).
// Kern-Status bleibt offen|validiert; die feineren Anzeigestufen werden hier
// konsistent abgeleitet. „returned/Nacharbeit" stammt aus Audit ko.returned-to-author,
// nicht aus einem neuen Kernstatus.
import type { AuditEntry, KnowledgeObject } from "../api/types";
import type { DisplayStatus } from "../components/trust/types";

export interface DisplayFlags {
  conflict?: boolean;
  revalidation?: boolean;
  rejected?: boolean;
}

// SCRUM-125: eine konsistente Ableitung (spiegelt services/.../display-status.ts).
export function deriveDisplayStatus(
  ko: Pick<KnowledgeObject, "status" | "assignments">,
  flags: DisplayFlags = {},
): DisplayStatus {
  if (flags.conflict) {
    return "konflikt";
  }
  if (flags.rejected) {
    return "abgelehnt";
  }
  if (ko.status === "validiert") {
    return flags.revalidation ? "revalidierung" : "validiert";
  }
  if ((ko.assignments?.length ?? 0) > 0) {
    return "pruefung";
  }
  return "offen";
}

const RETURN_ACTION = "ko.returned-to-author";
const REWORK_RESET_ACTIONS = new Set(["ko.revised", "ko.rated"]);

// SCRUM-124: Ist dieses KO aktuell zur Nacharbeit an den Autor zurückgegeben?
// „Aktuell" = letztes relevantes Ereignis ist eine Rückgabe (nach einer späteren
// Überarbeitung/Neubewertung gilt es als abgearbeitet).
export function isReturnedForRework(entries: readonly AuditEntry[], koId: string): boolean {
  const relevant = entries
    .filter(
      (e) =>
        e.target === koId && (e.action === RETURN_ACTION || REWORK_RESET_ACTIONS.has(e.action)),
    )
    .sort((a, b) => a.seq - b.seq);
  const last = relevant.at(-1);
  return last?.action === RETURN_ACTION;
}

export interface ReturnedKo {
  koId: string;
  at: string;
  verdict: string;
}

// SCRUM-124: KOs, die dem gegebenen Autor zur Nacharbeit zugewiesen sind (für „Meine Aufgaben").
export function returnedToAuthor(
  entries: readonly AuditEntry[],
  kos: readonly KnowledgeObject[],
  authorId: string,
): ReturnedKo[] {
  const mine = new Set(kos.filter((k) => k.author === authorId).map((k) => k.id));
  const out: ReturnedKo[] = [];
  for (const k of kos) {
    if (!mine.has(k.id) || !isReturnedForRework(entries, k.id)) {
      continue;
    }
    const lastReturn = entries
      .filter((e) => e.target === k.id && e.action === RETURN_ACTION)
      .sort((a, b) => a.seq - b.seq)
      .at(-1);
    out.push({
      koId: k.id,
      at: lastReturn?.at ?? k.createdAt,
      verdict: String(lastReturn?.payload?.verdict ?? ""),
    });
  }
  return out;
}
