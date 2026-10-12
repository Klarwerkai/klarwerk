// ================================================================================================
// R-0562 (aufnahme:20260922:gesamt-zweifaktor) — EIGENE ZWEI-FAKTOR-ANMELDUNG: der Codeschritt der
// Anmeldemaske (auth/AuthScreens.tsx), Einrichten/Ausschalten im Profil (pages/Profile.tsx) und das
// Entfernen durch den Admin (pages/AdminKontenDetails.tsx).
// ================================================================================================
//
// Ein eigenes Textmodul statt neuer Einträge in `woerterbuch/{de,en,nl}.ts`: diese drei Dateien
// sind seit der Aufteilung Byte für Byte an `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`
// gebunden; neue Texte gehören hierher.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "zweifaktor.",
  legacySchluessel: [],
  de: {
    "zweifaktor.anmelden.titel": "Bestätigung",
    "zweifaktor.anmelden.unterzeile": "Gib den 6-stelligen Code aus deiner Authenticator-App ein.",
    "zweifaktor.anmelden.absenden": "Bestätigen",
    "zweifaktor.code": "Bestätigungscode",
    "zweifaktor.profil.titel": "Zwei-Faktor-Anmeldung",
    "zweifaktor.profil.ein": "Ein",
    "zweifaktor.profil.aus": "Aus",
    "zweifaktor.profil.einleitung":
      "Zusätzlich zum Passwort fragt die Anmeldung einen Code von deinem zweiten Gerät ab (Authenticator-App wie Microsoft oder Google Authenticator).",
    "zweifaktor.profil.starten": "Einrichtung beginnen",
    "zweifaktor.profil.schluessel":
      "Trage diesen Schlüssel in deiner Authenticator-App ein oder öffne den Einrichtungslink auf dem zweiten Gerät:",
    "zweifaktor.profil.link": "Einrichtungslink",
    "zweifaktor.profil.bestaetigen": "Code bestätigen und einschalten",
    "zweifaktor.profil.eingeschaltet":
      "Die Zwei-Faktor-Anmeldung ist eingeschaltet. Ab der nächsten Anmeldung wird der Code abgefragt.",
    "zweifaktor.profil.ausschalten": "Ausschalten",
    "zweifaktor.profil.ausgeschaltet": "Die Zwei-Faktor-Anmeldung ist ausgeschaltet.",
    "zweifaktor.admin.entfernen": "Zwei-Faktor entfernen",
    "zweifaktor.admin.entfernt":
      "Zwei-Faktor-Anmeldung entfernt. Die Person meldet sich wieder nur mit Passwort an.",
  },
  en: {
    "zweifaktor.anmelden.titel": "Confirmation",
    "zweifaktor.anmelden.unterzeile": "Enter the 6-digit code from your authenticator app.",
    "zweifaktor.anmelden.absenden": "Confirm",
    "zweifaktor.code": "Confirmation code",
    "zweifaktor.profil.titel": "Two-factor sign-in",
    "zweifaktor.profil.ein": "On",
    "zweifaktor.profil.aus": "Off",
    "zweifaktor.profil.einleitung":
      "In addition to your password, sign-in asks for a code from your second device (an authenticator app such as Microsoft or Google Authenticator).",
    "zweifaktor.profil.starten": "Start setup",
    "zweifaktor.profil.schluessel":
      "Enter this key in your authenticator app or open the setup link on your second device:",
    "zweifaktor.profil.link": "Setup link",
    "zweifaktor.profil.bestaetigen": "Confirm code and turn on",
    "zweifaktor.profil.eingeschaltet":
      "Two-factor sign-in is on. The code will be requested from your next sign-in.",
    "zweifaktor.profil.ausschalten": "Turn off",
    "zweifaktor.profil.ausgeschaltet": "Two-factor sign-in is off.",
    "zweifaktor.admin.entfernen": "Remove two-factor",
    "zweifaktor.admin.entfernt":
      "Two-factor sign-in removed. The person signs in with password only.",
  },
  nl: {
    "zweifaktor.anmelden.titel": "Bevestiging",
    "zweifaktor.anmelden.unterzeile": "Voer de 6-cijferige code uit je authenticator-app in.",
    "zweifaktor.anmelden.absenden": "Bevestigen",
    "zweifaktor.code": "Bevestigingscode",
    "zweifaktor.profil.titel": "Aanmelden in twee stappen",
    "zweifaktor.profil.ein": "Aan",
    "zweifaktor.profil.aus": "Uit",
    "zweifaktor.profil.einleitung":
      "Naast je wachtwoord vraagt het aanmelden om een code van je tweede apparaat (een authenticator-app zoals Microsoft of Google Authenticator).",
    "zweifaktor.profil.starten": "Instellen starten",
    "zweifaktor.profil.schluessel":
      "Voer deze sleutel in je authenticator-app in of open de instellink op je tweede apparaat:",
    "zweifaktor.profil.link": "Instellink",
    "zweifaktor.profil.bestaetigen": "Code bevestigen en inschakelen",
    "zweifaktor.profil.eingeschaltet":
      "Aanmelden in twee stappen is ingeschakeld. Vanaf de volgende aanmelding wordt de code gevraagd.",
    "zweifaktor.profil.ausschalten": "Uitschakelen",
    "zweifaktor.profil.ausgeschaltet": "Aanmelden in twee stappen is uitgeschakeld.",
    "zweifaktor.admin.entfernen": "Twee stappen verwijderen",
    "zweifaktor.admin.entfernt":
      "Aanmelden in twee stappen verwijderd. De persoon meldt zich weer alleen met wachtwoord aan.",
  },
} satisfies Textmodul;
