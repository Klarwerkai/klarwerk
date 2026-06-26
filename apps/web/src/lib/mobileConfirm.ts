// SCRUM-87 / FR-MOB-03: reine, DOM-freie Logik für die Inline-Bestätigung einer
// destruktiven Mobile-Aktion (kein window.confirm/nativer Dialog). Pro Liste nur EIN
// Eintrag kann „pending" sein; ein anderer Eintrag ersetzt den vorherigen sauber.
export interface ConfirmState {
  pendingId: string | null;
}

export const NO_CONFIRM: ConfirmState = { pendingId: null };

// Erster Klick: diesen Eintrag zur Bestätigung markieren (ersetzt einen vorherigen).
export function requestConfirm(id: string): ConfirmState {
  return { pendingId: id };
}

// Abbrechen: Markierung zurücksetzen.
export function clearConfirm(): ConfirmState {
  return { pendingId: null };
}

// Wird gerade für diesen Eintrag eine Bestätigung angezeigt?
export function isPending(state: ConfirmState, id: string): boolean {
  return state.pendingId === id;
}

// Braucht ein Klick auf diesen Eintrag noch eine Bestätigung (= noch nicht pending)?
export function needsConfirmation(state: ConfirmState, id: string): boolean {
  return state.pendingId !== id;
}

// Ist der nächste Klick auf diesen Eintrag der finale Löschschritt?
export function confirmsDelete(state: ConfirmState, id: string): boolean {
  return state.pendingId === id;
}
