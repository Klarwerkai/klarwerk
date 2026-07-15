// SCRUM-486 (Entdichtung): DOM-freie Ableitung der Führungszeile fürs Konflikt- und Duplikate-Board.
// Sollbild: jede Karte sagt sofort — WELCHE zwei Beiträge, WAS Klarwerk als Widerspruch/Überschneidung
// sieht und WELCHE Handlung jetzt empfohlen ist. Details (KO-Panels, Zitate, Eskalationspfad) klappen
// dahinter auf (Progressive Disclosure). Eine Quelle für Komponente + Test (wie SCRUM-458).
import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";
import { conflictKoPair, conflictNextStep } from "./conflictView";
import { recommendationLabelKey } from "./duplicateBoard";

// Neutraler „entfernt"-Hinweis statt Roh-UUID in der Nutzersicht (SCRUM-486 C).
export const BOARD_REMOVED_LABEL_KEY = "board.koRemoved";

// Anzeigename eines Beteiligten: echter KO-Titel ODER der neutrale „entfernt"-Hinweis — NIE die UUID.
export type Participant = { removed: true } | { removed: false; title: string };

export function participant(ko: KnowledgeObject | null): Participant {
  return ko ? { removed: false, title: ko.title } : { removed: true };
}

export interface ConflictLead {
  a: Participant;
  b: Participant;
  // Empfohlene nächste Handlung als i18n-Schlüssel (con.next.<step>) — dieselbe Ableitung wie die Aktionen.
  recommendedStepKey: string;
}

export function conflictLead(conflict: Conflict, kos: readonly KnowledgeObject[]): ConflictLead {
  const pair = conflictKoPair(conflict, kos);
  return {
    a: participant(pair.a),
    b: participant(pair.b),
    recommendedStepKey: `con.next.${conflictNextStep(conflict)}`,
  };
}

export interface DuplicateLead {
  a: Participant;
  b: Participant;
  // Empfehlung als i18n-Schlüssel (dup.rec.<recommendation>) — dieselbe Ableitung wie die Empfehlungszeile.
  recommendationKey: string;
}

export function duplicateLead(entry: OverlapEntry, kos: readonly KnowledgeObject[]): DuplicateLead {
  const pair = conflictKoPair(entry, kos);
  return {
    a: participant(pair.a),
    b: participant(pair.b),
    recommendationKey: recommendationLabelKey(entry.recommendation),
  };
}
