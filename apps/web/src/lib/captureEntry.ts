// SCRUM-384 / AG-12 / KG-UX-001/002/003/010: DOM-freier Einstiegs-Helfer für die Erfassung.
// Der Erstkontakt darf nicht formularartig überfordern: der geführte Erzähl-Einstieg (Freitext,
// Diktat, geführtes Interview → Studio) ist der Standardweg; das klassische Formular bleibt als
// Expertenpfad einen bewussten Klick entfernt erhalten (progressive disclosure, NICHTS entfernt).
// Die Erstnutzer-Führung wird pro Browser gemerkt — über ein schmales Storage-Interface statt
// direktem localStorage-Zugriff, damit die Logik ohne DOM testbar bleibt.

export const CAPTURE_MODES = ["freitext", "formular", "diktat", "interview"] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

// Der Expertenpfad ist GENAU das klassische Formular; alles andere gehört zum Erzähl-Einstieg.
export const EXPERT_MODE: CaptureMode = "formular";

// Erzähl-Modi in fester Reihenfolge (Standardweg zuerst). Bewusst OHNE das Formular.
export const NARRATE_MODES: readonly CaptureMode[] = ["freitext", "diktat", "interview"];

export function isExpertMode(mode: CaptureMode): boolean {
  return mode === EXPERT_MODE;
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (kein Doppel-Literal).
// - narrateKicker: ruhige Überschrift über den Erzähl-Modi („Erzähl dein Wissen").
// - expertToggle: bewusster Einstieg in den Expertenpfad (Formular direkt ausfüllen).
// - expertHint: ehrliche Einordnung des Expertenpfads (gleiche Felder, kein Extra-Feature).
// - expertActive: Hinweis IM Expertenmodus + Rückweg auf den geführten Standardweg.
// - backToGuided: Rückweg-Button zurück zum Erzähl-Einstieg.
export const CAPTURE_ENTRY_TEXT = {
  narrateKicker: "capture.entry.narrateKicker",
  expertToggle: "capture.entry.expertToggle",
  expertHint: "capture.entry.expertHint",
  expertActive: "capture.entry.expertActive",
  backToGuided: "capture.entry.backToGuided",
} as const;

// ---- Erstnutzer-Führung (pro Browser) -------------------------------------------------------

// Schmales Interface statt direktem localStorage → DOM-frei testbar; defensiv gegen
// Storage-Fehler (Private Mode, volle Quota): Lesen/Schreiben darf NIE die Seite kippen.
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CAPTURE_INTRO_SEEN_KEY = "kw.capture.introSeen.v1";

// true = Erstbesuch in diesem Browser → geführte Einführung ausgeklappt zeigen.
export function isCaptureFirstRun(store: KeyValueStore | null | undefined): boolean {
  if (!store) {
    return true;
  }
  try {
    return store.getItem(CAPTURE_INTRO_SEEN_KEY) === null;
  } catch {
    return true;
  }
}

// Nach dem ersten Rendern merken — beim nächsten Besuch startet die Einführung eingeklappt
// (bleibt aber jederzeit wieder aufklappbar; es wird keine Funktion entfernt).
export function markCaptureIntroSeen(store: KeyValueStore | null | undefined): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(CAPTURE_INTRO_SEEN_KEY, "1");
  } catch {
    // bewusst still: Persistenz ist ein Komfort, kein Funktionsbestandteil.
  }
}
