// Reine, DOM-freie Validierungs-/Filterlogik für die Admin-Seite
// (SCRUM-147 Nutzer anlegen, SCRUM-148 Passwort-Reset, SCRUM-149 Audit-Einsicht).

// Mindestlänge für Passwörter (konsistent zur Registrierung, FR-AUTH-02).
export const MIN_PASSWORD = 8;

export function isNewUserValid(form: { name: string; email: string; password: string }): boolean {
  return (
    form.name.trim().length > 0 &&
    /.+@.+\..+/.test(form.email.trim()) &&
    form.password.length >= MIN_PASSWORD
  );
}

// SCRUM-455 (Pedi 06.07.): Passwort-Reset verlangt jetzt eine Wiederholung — beide müssen
// die Mindestlänge erfüllen UND identisch sein (ein Vertipper würde sonst den Nutzer aussperren).
export function isPasswordResetValid(password: string, repeat: string): boolean {
  return password.length >= MIN_PASSWORD && password === repeat;
}

// SCRUM-455: getrennt geprüft, damit die UI einen ehrlichen Grund anzeigen kann — meldet die
// Abweichung erst, wenn im Wiederholfeld überhaupt etwas steht (kein Fehler beim Tippen).
export function passwordRepeatMismatch(password: string, repeat: string): boolean {
  return repeat.length > 0 && password !== repeat;
}

// SCRUM-149: nur nutzer-/auth-relevante Audit-Aktionen in der Admin-Sicht zeigen.
export function isUserAuditAction(action: string): boolean {
  return action.startsWith("user.") || action.startsWith("auth.");
}
