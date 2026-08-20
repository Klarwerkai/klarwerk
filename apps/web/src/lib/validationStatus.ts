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

// ================================================================================================
// JOB 557 D8 — ZWEI NAMEN FÜR EINE RÜCKGABE, UND ZWEI VERSCHIEDENE AUSSAGEN DARÜBER
// ================================================================================================
//
// Seit D8 heisst die Rückgabe an eine BENANNTE Eigentümerin `ko.returned-to-owner`; nur der
// tatsächliche Autor-Fallback heisst weiter `ko.returned-to-author`
// (`services/validation/src/service.ts`, `returnToResponsible`). Für diese Datei folgen daraus
// zwei Dinge, die auseinandergehalten werden müssen — sie zu vermengen wäre dieselbe Verwechslung
// noch einmal, nur an anderer Stelle:
//
//   · `isReturnedForRework` beantwortet „ist dieses OBJEKT in Nacharbeit". Das gilt für BEIDE
//     Namen: der Zustand hängt am Wissensobjekt, nicht an der Person.
//   · `returnedToAuthor` beantwortet „was liegt bei MIR" (Meine Aufgaben). Bei einer
//     Owner-Rückgabe liegt es gerade NICHT bei der Autorin — dort zählt der neue Name nicht mit.
//
// HISTORISCHE EREIGNISSE BLEIBEN LESBAR: `ko.returned-to-author` verschwindet an keiner Stelle.
// Altbestand ergibt denselben Zustand wie am Tag seiner Entstehung.
const AUTHOR_RETURN_ACTION = "ko.returned-to-author";
const OWNER_RETURN_ACTION = "ko.returned-to-owner";
const RETURN_ACTIONS = new Set([AUTHOR_RETURN_ACTION, OWNER_RETURN_ACTION]);
const REWORK_RESET_ACTIONS = new Set(["ko.revised", "ko.rated"]);

// SCRUM-124: Ist dieses KO aktuell zur Nacharbeit zurückgegeben?
// „Aktuell" = letztes relevantes Ereignis ist eine Rückgabe (nach einer späteren
// Überarbeitung/Neubewertung gilt es als abgearbeitet).
export function isReturnedForRework(entries: readonly AuditEntry[], koId: string): boolean {
  const relevant = entries
    .filter(
      (e) =>
        e.target === koId && (RETURN_ACTIONS.has(e.action) || REWORK_RESET_ACTIONS.has(e.action)),
    )
    .sort((a, b) => a.seq - b.seq);
  const last = relevant.at(-1);
  return last !== undefined && RETURN_ACTIONS.has(last.action);
}

export interface ReturnedKo {
  koId: string;
  at: string;
  verdict: string;
}

// SCRUM-124: KOs, die dem gegebenen Autor zur Nacharbeit zugewiesen sind (für „Meine Aufgaben").
//
// JOB 557 D8: Gezählt werden ausschliesslich Rückgaben, die WIRKLICH bei dieser Person liegen —
// also der Autor-Fallback. Eine Owner-Rückgabe erscheint hier NICHT: Sie ist die Aufgabe der
// benannten Eigentümerin, und ein Eintrag in der Liste der Autorin wäre genau die Falschauskunft,
// gegen die dieser Durchgang gebaut ist. Der Nacharbeitsstatus AM OBJEKT bleibt davon unberührt
// (`isReturnedForRework` oben).
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
    // Nur der Autor-Weg. Der Name ist seit D8 die Auskunft darüber, wer zuständig ist.
    const lastReturn = entries
      .filter((e) => e.target === k.id && e.action === AUTHOR_RETURN_ACTION)
      .sort((a, b) => a.seq - b.seq)
      .at(-1);
    // Ohne eigenen Autor-Eintrag ist das KO zwar in Nacharbeit, aber nicht ihre: dann steht hier
    // nichts. Ein Eintrag mit geratener Zeit und leerem Urteil wäre schlimmer als keiner.
    if (!lastReturn) {
      continue;
    }
    out.push({
      koId: k.id,
      at: lastReturn.at,
      verdict: String(lastReturn.payload?.verdict ?? ""),
    });
  }
  return out;
}
