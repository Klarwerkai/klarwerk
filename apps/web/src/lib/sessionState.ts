// Reine, DOM-freie Session-Hilfslogik (SCRUM-152 / FE-FND-08).
// Bewusst ohne Import aus `api/auth`/`api/client`, damit dieses Modul (und sein
// Test) den API-Client nicht in den Node-/Root-Typecheck zieht.

// Konservatives Auto-Refresh-Intervall für Session-Status/-User (5 Minuten).
export const SESSION_REFRESH_MS = 5 * 60_000;

// Sichere Ableitung des Session-Users: schlägt die `/auth/me`-Abfrage fehl
// (z. B. abgelaufene Session / 401), gilt der Nutzer als abgemeldet — es werden
// KEINE alten (stale) User-Daten weitergereicht.
export function resolveSessionUser<T>(me: { data?: T | null; isError: boolean }): T | null {
  if (me.isError) {
    return null;
  }
  return me.data ?? null;
}
