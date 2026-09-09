import { OIDC_UNREACHABLE_MESSAGE } from "./oidc";

export type Sprache = "de" | "en" | "nl";

// Der bestehende SSO-Fehler liegt außerhalb der Q9-Zielpfade. Seine DE-Konstante
// bleibt die einzige Literalquelle; auch dieser Fehler wird hier übersetzt.
export const MELDUNGEN = {
  INVALID_CREDENTIALS: {
    de: "E-Mail oder Passwort falsch.",
    en: "Email or password is incorrect.",
    nl: "E-mailadres of wachtwoord is onjuist.",
  },
  NOT_APPROVED: {
    de: "Konto ist noch nicht freigegeben.",
    en: "Your account has not been approved yet.",
    nl: "Je account is nog niet goedgekeurd.",
  },
  WEAK_PASSWORD: {
    de: "Passwort muss mindestens 8 Zeichen haben.",
    en: "Password must be at least 8 characters long.",
    nl: "Het wachtwoord moet minstens 8 tekens lang zijn.",
  },
  EMAIL_TAKEN: {
    de: "E-Mail ist bereits vergeben.",
    en: "This email address is already in use.",
    nl: "Dit e-mailadres is al in gebruik.",
  },
  OIDC_ACCOUNT_MISSING: {
    de: "Kein Konto für diese E-Mail. Bitte vom Admin anlegen lassen.",
    en: "There is no account for this email address. Please ask an administrator to create one.",
    nl: "Er is geen account voor dit e-mailadres. Vraag een beheerder om er een aan te maken.",
  },
  ACCOUNT_NOT_FOUND: {
    de: "Konto nicht gefunden.",
    en: "Account not found.",
    nl: "Account niet gevonden.",
  },
  SELF_DEMOTION_FORBIDDEN: {
    de: "Rollenänderung nicht erlaubt: Ein Admin kann sich die Admin-Rolle nicht selbst entziehen.",
    en: "Role change not allowed: administrators cannot remove their own admin role.",
    nl: "Rolwijziging niet toegestaan: beheerders kunnen hun eigen beheerdersrol niet verwijderen.",
  },
  LAST_ADMIN_DEMOTION: {
    de: "Der letzte aktive Admin kann nicht herabgestuft werden — sonst wäre niemand mehr verwaltungsberechtigt.",
    en: "The last active administrator cannot be demoted, as no one would be left to administer the system.",
    nl: "De laatste actieve beheerder kan niet worden gedegradeerd, omdat dan niemand het systeem meer kan beheren.",
  },
  CURRENT_PASSWORD_INCORRECT: {
    de: "Aktuelles Passwort ist falsch.",
    en: "Your current password is incorrect.",
    nl: "Je huidige wachtwoord is onjuist.",
  },
  RESET_TOKEN_INVALID: {
    de: "Reset-Token ungültig oder abgelaufen.",
    en: "The password reset link is invalid or has expired.",
    nl: "De link om je wachtwoord opnieuw in te stellen is ongeldig of verlopen.",
  },
  LAST_ADMIN_DELETION: {
    de: "Der letzte aktive Admin kann nicht gelöscht werden — sonst wäre niemand mehr verwaltungsberechtigt.",
    en: "The last active administrator cannot be deleted, as no one would be left to administer the system.",
    nl: "De laatste actieve beheerder kan niet worden verwijderd, omdat dan niemand het systeem meer kan beheren.",
  },
  USER_NOT_FOUND: {
    de: "Nutzer nicht gefunden.",
    en: "User not found.",
    nl: "Gebruiker niet gevonden.",
  },
  INTERNAL: {
    de: "Unerwarteter Fehler.",
    en: "An unexpected error occurred.",
    nl: "Er is een onverwachte fout opgetreden.",
  },
  NOT_SIGNED_IN: {
    de: "Nicht angemeldet.",
    en: "You are not signed in.",
    nl: "Je bent niet aangemeld.",
  },
  ADMIN_REQUIRED: {
    de: "Adminrecht erforderlich.",
    en: "Administrator access is required.",
    nl: "Beheerdersrechten zijn vereist.",
  },
  REGISTRATION_DISABLED: {
    de: "Registrierung nur per Einladung.",
    en: "Registration is by invitation only.",
    nl: "Registreren kan alleen op uitnodiging.",
  },
  REGISTRATION_RATE_LIMITED: {
    de: "Zu viele Registrierungen. Bitte später erneut versuchen.",
    en: "Too many registrations. Please try again later.",
    nl: "Te veel registraties. Probeer het later opnieuw.",
  },
  NAME_REQUIRED: {
    de: "Name ist erforderlich.",
    en: "A name is required.",
    nl: "Een naam is vereist.",
  },
  EMAIL_REQUIRED: {
    de: "Gültige E-Mail ist erforderlich.",
    en: "A valid email address is required.",
    nl: "Een geldig e-mailadres is vereist.",
  },
  LOGIN_RATE_LIMITED: {
    de: "Zu viele Anmeldeversuche. Bitte später erneut versuchen.",
    en: "Too many sign-in attempts. Please try again later.",
    nl: "Te veel aanmeldpogingen. Probeer het later opnieuw.",
  },
  RESET_RATE_LIMITED: {
    de: "Zu viele Versuche. Bitte später erneut versuchen.",
    en: "Too many attempts. Please try again later.",
    nl: "Te veel pogingen. Probeer het later opnieuw.",
  },
  OIDC_DISABLED: {
    de: "SSO ist nicht konfiguriert.",
    en: "SSO is not configured.",
    nl: "SSO is niet geconfigureerd.",
  },
  OIDC_STATE_INVALID: {
    de: "SSO-Status ungültig.",
    en: "The SSO state is invalid.",
    nl: "De SSO-status is ongeldig.",
  },
  OIDC_LOGIN_FAILED: {
    de: "SSO-Anmeldung fehlgeschlagen.",
    en: "SSO sign-in failed.",
    nl: "Aanmelden via SSO is mislukt.",
  },
  ALREADY_SETUP: {
    de: "Instanz ist bereits eingerichtet.",
    en: "This instance has already been set up.",
    nl: "Deze instantie is al ingesteld.",
  },
  UNKNOWN_ROLE: {
    de: "Unbekannte Rolle.",
    en: "Unknown role.",
    nl: "Onbekende rol.",
  },
  OIDC_UNREACHABLE: {
    de: OIDC_UNREACHABLE_MESSAGE,
    en: "The sign-in service is not responding.",
    nl: "De aanmelddienst reageert niet.",
  },
} as const satisfies Record<string, Record<Sprache, string>>;

export type Meldungsschluessel = keyof typeof MELDUNGEN;

/** Unbekannte Schlüssel geben weder Diagnosen noch interne Kennungen nach außen. */
export function meldung(schluessel: string, sprache?: string): string {
  const key = Object.hasOwn(MELDUNGEN, schluessel)
    ? (schluessel as Meldungsschluessel)
    : "INTERNAL";
  return MELDUNGEN[key][sprache === "en" || sprache === "nl" ? sprache : "de"];
}
