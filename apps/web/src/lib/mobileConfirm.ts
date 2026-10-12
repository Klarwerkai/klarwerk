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

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier standen `needsConfirmation` (= nicht `isPending`)
// und `confirmsDelete` (= `isPending`). Mobil bestätigt über `requestConfirm`/`isPending` — dieselbe
// Zweischritt-Regel (`pages/Mobile.tsx`, R-0991 Nr. 49/50); die beiden Zweitnamen rief niemand und
// sind entfernt.
