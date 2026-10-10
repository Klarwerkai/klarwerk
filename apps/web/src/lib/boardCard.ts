// SCRUM-486 (Entdichtung): DOM-freie Ableitung der Führungszeile fürs Konflikt- und Duplikate-Board.
// Sollbild: jede Karte sagt sofort — WELCHE zwei Beiträge, WAS Klarwerk als Widerspruch/Überschneidung
// sieht und WELCHE Handlung jetzt empfohlen ist. Details (KO-Panels, Zitate, Eskalationspfad) klappen
// dahinter auf (Progressive Disclosure). Eine Quelle für Komponente + Test (wie SCRUM-458).
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier standen zusätzlich `BOARD_REMOVED_LABEL_KEY`,
// `conflictLead` und `duplicateLead`. Keines davon hatte einen Produktleser: das Duplikat- und das
// Konflikt-Board bauen Paar, Empfehlung und den „entfernt"-Hinweis selbst auf (`pages/Duplicates.tsx`,
// `pages/Conflicts.tsx` über `conflictKoPair`, `recommendationLabelKey`, `naechsterSchrittSchluessel`;
// R-0991 Nr. 8 und 9), die Befundgruppen über `lib/findingGroups.ts`. Sie sind entfernt. Geblieben
// ist `participant` — die Kollisionsansicht (`conflictCollision.ts`) liest ihn.
import type { KnowledgeObject } from "../api/types";

// Anzeigename eines Beteiligten: echter KO-Titel ODER der neutrale „entfernt"-Hinweis — NIE die UUID.
export type Participant = { removed: true } | { removed: false; title: string };

export function participant(ko: KnowledgeObject | null): Participant {
  return ko ? { removed: false, title: ko.title } : { removed: true };
}
