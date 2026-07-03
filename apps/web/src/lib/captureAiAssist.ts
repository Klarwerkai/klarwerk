// SCRUM-312: DOM-freie Modellierung der KI-Nachbearbeitung im Capture/Edit-Bereich. Beschreibt die
// geführten Aktionen (klarer/strukturieren/erweitern/rechtschreibung) + freie Anweisung als reine
// Daten/i18n-Schlüssel und kapselt die Übernahme-Logik (Ersetzen/Anhängen). KEINE neue Provider-
// Architektur, kein RAG, keine Suche — die Aktionen nutzen den vorhandenen reasoner.assist-Endpunkt
// (optionale instruction). Ehrlich: die KI macht einen VORSCHLAG; der Mensch übernimmt bewusst.

// SCRUM-404 (Pedi 03.07.): + „Formatieren" — nur Gliederung/Absatzbau, Inhalt unverändert.
export type AssistAction = "clarify" | "structure" | "expand" | "spelling" | "format";

// Reihenfolge = Anzeigereihenfolge der Buttons.
export const ASSIST_ACTIONS: readonly AssistAction[] = [
  "clarify",
  "structure",
  "expand",
  "spelling",
  "format",
];

// Sichtbares Button-Label je Aktion (i18n-Key).
export function assistActionLabelKey(action: AssistAction): string {
  return `capture.ai.action.${action}`;
}

// Lokalisierte Bearbeitungs-Anweisung je Aktion (i18n-Key) — wird als `instruction` an reasoner.assist
// übergeben. Im deterministischen Fallback ohne Wirkung (generische Glättung), im Modellmodus aktiv.
export function assistActionInstructionKey(action: AssistAction): string {
  return `capture.ai.instr.${action}`;
}

// SCRUM-404: Ein-Satz-Erklärung je Aktion (i18n-Key) — für das ?-HelpTip am Button,
// damit klar ist, was die jeweilige KI-Aktion tut, BEVOR man sie auslöst.
export function assistActionHelpKey(action: AssistAction): string {
  return `capture.ai.help.${action}`;
}

export type AssistApplyMode = "replace" | "append";

export const ASSIST_APPLY_MODES: readonly AssistApplyMode[] = ["replace", "append"];

// Bewusste Übernahme des KI-Vorschlags: „replace" ersetzt den Text, „append" hängt ihn an (mit
// Leerzeile). Reine Funktion — kein Auto-Submit, keine Mutation. „discard" wird in der UI behandelt
// (Vorschau verwerfen), erzeugt hier keinen Text.
export function applyAssist(mode: AssistApplyMode, original: string, suggestion: string): string {
  const next = suggestion.trim();
  if (mode === "replace") {
    return next;
  }
  const base = original.trim();
  return base ? `${base}\n\n${next}` : next;
}
