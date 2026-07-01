// SCRUM-375 / AG-12 / KG-UX-001/003/010: DOM-freie Beschreibung der „erweiterten Details" der Erfassung
// (Kategorie, Anlage, Prüf-Anzahl, Schlagwörter, Dokumente, Bilder). Diese technischen/optionalen Felder
// werden in Capture per Progressive Disclosure eingeklappt, damit der geführte Weg „Wissen erzählen →
// im Studio strukturieren" führt und Capture weniger wie ein Formular wirkt — OHNE ein Feld zu entfernen.
//
// Der Helfer liefert nur, WIE VIELE dieser Felder schon Inhalt haben (für ein ehrliches „X ausgefüllt"-
// Badge und die Auto-Aufklapp-Entscheidung). Reine Datenlogik, kein DOM, kein Backend.

export interface AdvancedFieldsState {
  category?: string | null;
  asset?: string | null;
  neededValidations?: string | null;
  tags?: readonly string[];
  documentCount?: number;
  imageCount?: number;
}

export interface AdvancedFieldsSummary {
  // Wie viele der erweiterten Felder tragen bereits Inhalt? (für „X ausgefüllt" + Auto-Aufklappen)
  filledCount: number;
  hasAny: boolean;
}

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function advancedFieldsSummary(state: AdvancedFieldsState): AdvancedFieldsSummary {
  let filledCount = 0;
  if (nonEmpty(state.category)) {
    filledCount += 1;
  }
  if (nonEmpty(state.asset)) {
    filledCount += 1;
  }
  if (nonEmpty(state.neededValidations)) {
    filledCount += 1;
  }
  if ((state.tags ?? []).some((tag) => tag.trim().length > 0)) {
    filledCount += 1;
  }
  if ((state.documentCount ?? 0) > 0) {
    filledCount += 1;
  }
  if ((state.imageCount ?? 0) > 0) {
    filledCount += 1;
  }
  return { filledCount, hasAny: filledCount > 0 };
}

// i18n-Keys der einklappbaren „Erweiterte Details"-Sektion. Ehrlich: alles optional, nichts wird entfernt.
export const ADVANCED_FIELDS_KEYS = {
  title: "capture.advanced.title",
  hint: "capture.advanced.hint",
  filled: "capture.advanced.filled",
} as const;
