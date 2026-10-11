// SCRUM-407 (Pedi 03.07.): Zentrale, DOM-freie Karte aller ?-Hilfen im Erfassen-Weg —
// Gegenstück zu lib/reviewHelp.ts (Prüfbereich). Eine Quelle für Komponenten UND Tests;
// jede Hilfe hat einen stabilen Themen-Schlüssel und ein i18n-Paar (Titel + ausführlicher
// Text: „Was macht das? · Wann nutze ich es? · Was passiert danach (und was NICHT automatisch)?").
// Bewusst KEINE Doppelungen zu SCRUM-404: KI-Palette und Strukturvorlagen haben ihre Hilfen
// bereits in AiAssistBox/BodyTemplateChooser.

export const CAPTURE_HELP_IDS = [
  // Einstieg & Modus-Wahl
  "modes",
  "expertPath",
  "wizardSteps",
  "loadExample",
  // Erzähl-Modi
  "tellRaw",
  "dictate",
  "tellUpload",
  "structureNow",
  "interview",
  "filePoints",
  // Wissensseite
  "captureTitle",
  "saveDraftHelp",
  "discardHelp",
  "submitReview",
  "readiness",
  "savedNext",
  // Erweiterte Details
  "advancedDetails",
  "knowledgeType",
  "assetField",
  "tagsField",
  "docsImages",
  // SCRUM-408: Quellen-Panel beim Erfassen (Warteliste, add-source beim Einreichen)
  "sourcesPanel",
  // Expertenpfad
  "expertForm",
] as const;

export type CaptureHelpId = (typeof CAPTURE_HELP_IDS)[number];

export interface CaptureHelpTopic {
  id: CaptureHelpId;
  titleKey: string;
  bodyKey: string;
}

// Aufnahme entwurf-in-gemeinsamen-pool-geben (R-2099): die Erklärung zu „Entwurf speichern" sagt
// jetzt, dass ein Entwurf standardmäßig privat ist UND bewusst geteilt werden kann. Sie steht unter
// einem NEUEN Schlüssel, weil `chelp.saveDraftHelp.body` im eingefrorenen Textschnappschuss liegt
// (Begründung in `texte/entwurfspool.ts`). Der Titel bleibt beim Schema.
const BODY_KEY_ABWEICHEND: Partial<Record<CaptureHelpId, string>> = {
  saveDraftHelp: "entwurfspool.saveDraftHelp.body",
};

// Schlüssel-Schema wie im Prüfbereich, eigener Namensraum: chelp.<id>.title / chelp.<id>.body.
export function captureHelp(id: CaptureHelpId): CaptureHelpTopic {
  return {
    id,
    titleKey: `chelp.${id}.title`,
    bodyKey: BODY_KEY_ABWEICHEND[id] ?? `chelp.${id}.body`,
  };
}

export const CAPTURE_HELP_TOPICS: readonly CaptureHelpTopic[] = CAPTURE_HELP_IDS.map(captureHelp);
