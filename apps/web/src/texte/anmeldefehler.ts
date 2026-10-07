// ================================================================================================
// R-0531 · DIE FEHLERSÄTZE DER ÖFFENTLICHEN MASKEN, IN JEDER SPRACHE VORRÄTIG.
// ================================================================================================
//
// „Die Wahl wirkt sofort auf alle Texte der Maske" — auch auf einen Fehler, der schon dasteht oder
// erst nach dem Umschalten eintrifft. Der Server formuliert seine Sätze nach `Accept-Language`
// (Q9); der Satz einer Antwort ist damit in EINER Sprache fertig. Damit die Maske ihn in der
// gewählten Sprache zeigen kann, liegen die Sätze, die Anmelden, Registrieren, Ersteinrichtung,
// Passwort vergessen und Zurücksetzen erreichen können, hier in allen drei Fassungen vor; die Maske
// erkennt einen eingetroffenen Satz an seinem Wortlaut und zeigt den Schlüssel
// (`auth/maskenfehler.ts`).
//
// WARUM EINE KOPIE UND KEIN IMPORT: `apps/web` darf aus `services/` nicht importieren (sonst bricht
// der Docker-Build). Der Wortlaut ist deshalb ZEICHENGLEICH mit `services/auth/src/meldungen.ts`,
// und `tests/app/anmeldefehler-paritaet.test.ts` hält beide Seiten zusammen: läuft eine
// Formulierung im Katalog weg, wird der Test rot.
//
// `anmeldefehler.unbekannt` ist der einzige eigene Satz: er steht, wenn der Server etwas sagt, das
// hier nicht vorrätig ist, und inzwischen eine andere Sprache gewählt wurde.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "anmeldefehler.",
  legacySchluessel: [],
  de: {
    "anmeldefehler.INVALID_CREDENTIALS": "E-Mail oder Passwort falsch.",
    "anmeldefehler.NOT_APPROVED": "Konto ist noch nicht freigegeben.",
    "anmeldefehler.ACCESS_EXPIRED": "Ihr Zugang ist abgelaufen. Bitte vom Admin verlängern lassen.",
    "anmeldefehler.WEAK_PASSWORD": "Passwort muss mindestens 8 Zeichen haben.",
    "anmeldefehler.EMAIL_TAKEN": "E-Mail ist bereits vergeben.",
    "anmeldefehler.RESET_TOKEN_INVALID": "Reset-Token ungültig oder abgelaufen.",
    "anmeldefehler.INTERNAL": "Unerwarteter Fehler.",
    "anmeldefehler.NOT_SIGNED_IN": "Nicht angemeldet.",
    "anmeldefehler.REGISTRATION_DISABLED": "Registrierung nur per Einladung.",
    "anmeldefehler.REGISTRATION_RATE_LIMITED":
      "Zu viele Registrierungen. Bitte später erneut versuchen.",
    "anmeldefehler.NAME_REQUIRED": "Name ist erforderlich.",
    "anmeldefehler.EMAIL_REQUIRED": "Gültige E-Mail ist erforderlich.",
    "anmeldefehler.LOGIN_RATE_LIMITED": "Zu viele Anmeldeversuche. Bitte später erneut versuchen.",
    "anmeldefehler.RESET_RATE_LIMITED": "Zu viele Versuche. Bitte später erneut versuchen.",
    "anmeldefehler.ALREADY_SETUP": "Instanz ist bereits eingerichtet.",
    "anmeldefehler.unbekannt":
      "Der Vorgang wurde abgelehnt. Die genaue Meldung liegt nur in der zuvor gewählten Sprache vor — bitte erneut absenden.",
  },
  en: {
    "anmeldefehler.INVALID_CREDENTIALS": "Email or password is incorrect.",
    "anmeldefehler.NOT_APPROVED": "Your account has not been approved yet.",
    "anmeldefehler.ACCESS_EXPIRED":
      "Your access has expired. Please ask an administrator to extend it.",
    "anmeldefehler.WEAK_PASSWORD": "Password must be at least 8 characters long.",
    "anmeldefehler.EMAIL_TAKEN": "This email address is already in use.",
    "anmeldefehler.RESET_TOKEN_INVALID": "The password reset link is invalid or has expired.",
    "anmeldefehler.INTERNAL": "An unexpected error occurred.",
    "anmeldefehler.NOT_SIGNED_IN": "You are not signed in.",
    "anmeldefehler.REGISTRATION_DISABLED": "Registration is by invitation only.",
    "anmeldefehler.REGISTRATION_RATE_LIMITED": "Too many registrations. Please try again later.",
    "anmeldefehler.NAME_REQUIRED": "A name is required.",
    "anmeldefehler.EMAIL_REQUIRED": "A valid email address is required.",
    "anmeldefehler.LOGIN_RATE_LIMITED": "Too many sign-in attempts. Please try again later.",
    "anmeldefehler.RESET_RATE_LIMITED": "Too many attempts. Please try again later.",
    "anmeldefehler.ALREADY_SETUP": "This instance has already been set up.",
    "anmeldefehler.unbekannt":
      "The request was declined. The exact message is only available in the previously selected language — please submit again.",
  },
  nl: {
    "anmeldefehler.INVALID_CREDENTIALS": "E-mailadres of wachtwoord is onjuist.",
    "anmeldefehler.NOT_APPROVED": "Je account is nog niet goedgekeurd.",
    "anmeldefehler.ACCESS_EXPIRED":
      "Je toegang is verlopen. Vraag een beheerder om deze te verlengen.",
    "anmeldefehler.WEAK_PASSWORD": "Het wachtwoord moet minstens 8 tekens lang zijn.",
    "anmeldefehler.EMAIL_TAKEN": "Dit e-mailadres is al in gebruik.",
    "anmeldefehler.RESET_TOKEN_INVALID":
      "De link om je wachtwoord opnieuw in te stellen is ongeldig of verlopen.",
    "anmeldefehler.INTERNAL": "Er is een onverwachte fout opgetreden.",
    "anmeldefehler.NOT_SIGNED_IN": "Je bent niet aangemeld.",
    "anmeldefehler.REGISTRATION_DISABLED": "Registreren kan alleen op uitnodiging.",
    "anmeldefehler.REGISTRATION_RATE_LIMITED": "Te veel registraties. Probeer het later opnieuw.",
    "anmeldefehler.NAME_REQUIRED": "Een naam is vereist.",
    "anmeldefehler.EMAIL_REQUIRED": "Een geldig e-mailadres is vereist.",
    "anmeldefehler.LOGIN_RATE_LIMITED": "Te veel aanmeldpogingen. Probeer het later opnieuw.",
    "anmeldefehler.RESET_RATE_LIMITED": "Te veel pogingen. Probeer het later opnieuw.",
    "anmeldefehler.ALREADY_SETUP": "Deze instantie is al ingesteld.",
    "anmeldefehler.unbekannt":
      "Het verzoek is afgewezen. De precieze melding is alleen beschikbaar in de eerder gekozen taal — verstuur het opnieuw.",
  },
} satisfies Textmodul;
