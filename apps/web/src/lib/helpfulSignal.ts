// Reine, DOM-freie Button-Entscheidung für das „Hat geholfen"-Signal
// (FE-LCY-03 / SCRUM-111 / SCRUM-131-Teil). Wiederverwendet den Ask-Helpful-Pfad.
export interface HelpfulMutationState {
  pending: boolean;
  success: boolean;
}

// Während Mutation und nach Erfolg deaktivieren; optional zusätzlicher Grund (z. B. keine Quelle).
export function helpfulDisabled(state: HelpfulMutationState, extraBlocked = false): boolean {
  return state.pending || state.success || extraBlocked;
}

// Nach Erfolg Dank-Text, sonst Aktions-Label.
export function helpfulLabel(state: { success: boolean }, idle: string, done: string): string {
  return state.success ? done : idle;
}
