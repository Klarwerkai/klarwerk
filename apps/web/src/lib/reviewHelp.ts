// SCRUM-406 (Pedi 03.07.: „selbst ich verliere mich hier"): Zentrale, DOM-freie Karte aller
// ?-Hilfen im Prüfbereich (Validierungs-Board, Prüfentscheidung im KO-Detail, Quellen-Panel,
// Konflikt-Aktionen). Eine Quelle für Komponenten UND Tests: jede Hilfe hat einen stabilen
// Themen-Schlüssel und ein i18n-Paar (Titel + ausführlicher Text nach dem Schema
// „Was macht das? · Wann nutze ich es? · Was passiert danach (und was NICHT automatisch)?").
// Texte: docs/qm/SCRUM-406-HILFETEXTE-ENTWURF.md (Pedi-Vorgaben: Du-Anrede, ehrlich, DE+EN).

export const REVIEW_HELP_IDS = [
  // Validierungs-Board
  "originFilter",
  "reviewFocus",
  "filters",
  "mineOnly",
  "signals",
  "approve",
  "query",
  "reject",
  "feedbackForm",
  "assign",
  // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" (Board).
  "markTrue",
  // KO-Detail: Entscheidung & Lebenszeichen
  "stillValid",
  "reportConflict",
  "conflictForm",
  // KO-Detail: Quellen-Panel (Stufe 2)
  "sourcesLevel2",
  "sourceFields",
  "sourceAdd",
  "sourceSearch",
  "contribution",
  // KO-Detail: Nebenkarten
  "helpful",
  "validity",
  "transfer",
  "deleteKo",
  // Konflikte-Seite
  "conflictEscalate",
  "conflictSecondOpinion",
  "conflictResolve",
] as const;

export type ReviewHelpId = (typeof REVIEW_HELP_IDS)[number];

export interface ReviewHelpTopic {
  id: ReviewHelpId;
  titleKey: string;
  bodyKey: string;
}

// Schlüssel-Schema bewusst flach und stabil: vhelp.<id>.title / vhelp.<id>.body.
export function reviewHelp(id: ReviewHelpId): ReviewHelpTopic {
  return { id, titleKey: `vhelp.${id}.title`, bodyKey: `vhelp.${id}.body` };
}

export const REVIEW_HELP_TOPICS: readonly ReviewHelpTopic[] = REVIEW_HELP_IDS.map(reviewHelp);
