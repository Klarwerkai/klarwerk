// Reine, DOM-freie Validierungs-/Filterlogik für die Admin-Seite
// (SCRUM-147 Nutzer anlegen, SCRUM-148 Passwort-Reset, SCRUM-149 Audit-Einsicht).

// Mindestlänge für Passwörter (konsistent zur Registrierung, FR-AUTH-02).
export const MIN_PASSWORD = 8;

// SCRUM-463: welche Pflichtangaben fehlen noch? Gibt die konkreten Feld-Gründe zurück,
// damit die Oberfläche ehrlich sagen kann, warum „Anlegen" (noch) nichts tut — statt den
// Knopf stumm zu deaktivieren (gemeldetes Symptom: „nichts passiert").
export function newUserIssues(form: {
  name: string;
  email: string;
  password: string;
}): Array<"name" | "email" | "password"> {
  const issues: Array<"name" | "email" | "password"> = [];
  if (form.name.trim().length === 0) {
    issues.push("name");
  }
  if (!/.+@.+\..+/.test(form.email.trim())) {
    issues.push("email");
  }
  if (form.password.length < MIN_PASSWORD) {
    issues.push("password");
  }
  return issues;
}

export function isNewUserValid(form: { name: string; email: string; password: string }): boolean {
  return newUserIssues(form).length === 0;
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

/**
 * produkt:20261009:admin-audit-verstaendlich: dieselbe Menge als AUSDRÜCKLICHE Liste — der
 * Seitenweg (`GET /api/audit/seite?actions=…`) filtert am Server, und ein Präfix kennt er nicht.
 * Abschließend aus `services/auth/src/service.ts` gelesen; `tests/admin-audit-verstaendlich/
 * konto-aktionen-vollstaendig.test.ts` hält die Liste gegen den Schreibweg fest.
 */
export const KONTO_AUDIT_AKTIONEN: readonly string[] = [
  "auth.login",
  "auth.logout",
  "user.created",
  "user.approve",
  "user.role-change",
  "user.delete",
  "user.password-reset",
  "user.password-changed",
  "user.password-reset-email",
  "user.access-expired",
  "user.access-expiry-unreadable",
  "user.access-expiry-set",
  "user.oidc-provisioned",
  "user.oidc-linked",
  "user.oidc-linked-unverified",
  "user.role-claim-missing",
  "user.role-synced",
];
