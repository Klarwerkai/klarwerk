export type Sprache = "de" | "en" | "nl";

// JOB 3562: Dieser Katalog ist ein BLATT — er importiert aus keinem anderen Modul unter
// services/auth/src. Er übersetzt die Fehler dieser Module; bezöge er einen seiner Texte von dort,
// änderte eine Umformulierung im Dienstmodul still einen Text, den Menschen in drei Sprachen sehen,
// und nur die deutsche Fassung liefe mit. Gehalten von tests/q9-oidc-literalquelle/.
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
  // JOB 3756: der Nachbar von NOT_APPROVED und ausdrücklich nicht dasselbe. „Noch nicht
  // freigegeben" und „abgelaufen" sind zwei verschiedene Lagen mit zwei verschiedenen Wegen zurück
  // (Freigabe erteilen · Befristung nehmen oder verlängern); ein gemeinsamer Satz schickte die
  // Hälfte der Betroffenen in die falsche Richtung.
  //
  // JOB 4265 · ZWEITER SATZTEIL: DIE HANDLUNG. Bis hierher nannte der Text nur die LAGE. Ein Gast
  // las damit, WAS ist, und nicht, WAS ER TUN KANN — und weil es keinen Selbstbedienungsweg gibt,
  // blieb ihm nur Raten. Der zweite Teil sagt beides, was er braucht: an wen er sich wendet (den
  // Admin) und worum er bittet (die Verlängerung der Befristung). Die Lage bleibt dabei VORNE; wer
  // nur noch „Bitte vom Admin verlängern lassen." läse, wüsste nicht, warum er draussen steht.
  //
  // DER TEXT NENNT WEITERHIN WEDER DATUM NOCH KONTO NOCH EINEN NAMENTLICHEN ZUSTÄNDIGEN, und das
  // ist keine Auslassung, sondern der Grund, aus dem er überhaupt EIN Satz sein kann: er steht vor
  // jedem abgelaufenen Zugang gleich da und weiss von alldem nichts. „Admin" ist eine Rolle und
  // kein Name — die kennt der Katalog. Ein Datum, das er nicht kennt, wäre eine Erfindung; ein
  // Link auf eine Selbstbedienung, die es nicht gibt, eine Sackgasse mit Wegweiser.
  // Gehalten von D5/D6 in `tests/gast-nutzerweg/gesperrter-gast-liest-seinen-satz.test.ts`.
  //
  // DIE BAUFORM IST DIE VON `OIDC_ACCOUNT_MISSING` weiter unten („… Bitte vom Admin anlegen
  // lassen."): erst die Lage, dann der eine Handgriff, der sie auflöst. Zwei Sätze derselben Form
  // für zwei Lagen, die derselbe Mensch auflöst.
  ACCESS_EXPIRED: {
    de: "Ihr Zugang ist abgelaufen. Bitte vom Admin verlängern lassen.",
    en: "Your access has expired. Please ask an administrator to extend it.",
    nl: "Je toegang is verlopen. Vraag een beheerder om deze te verlengen.",
  },
  // JOB 4011: der Nachbar von ACCESS_EXPIRED und ausdrücklich nicht dasselbe. Dort ist eine
  // Befristung ABGELAUFEN und der Satz steht vor dem Gast; hier hat ein ADMIN einen Zeitpunkt
  // eingegeben, den das Produkt nicht lesen kann, und es ist noch gar nichts geschehen.
  //
  // ER LÖST „Unerwarteter Fehler." AB. Bis hierher warf `setAccessExpiry` für ein unlesbares Datum
  // `INTERNAL` (`service.ts:427` am Stand b0315de), und `service.ts:402-406` nannte den eigenen
  // Satz selbst als offenen Auftrag: „Es gibt keinen eigenen Meldungstext für diesen Fall; der
  // Admin liest ‚Unerwarteter Fehler.'". Ein Tippfehler ist aber kein Serverfehler — und ein Satz,
  // der nicht sagt, was falsch war, lässt den Admin denselben Fehler noch einmal machen.
  //
  // DER SATZ NENNT DIE FORM UND NICHT DIE REGEL. Datum, Uhrzeit und Zeitzone sind genau die drei
  // Stücke, deren Fehlen `ISO_ZEITSTEMPEL` (`service.ts:47`) abweist — „2026-09-11" (ohne Uhrzeit)
  // und „2026-09-11T12:00:00" (ohne Zone) sind die beiden Eingaben, die ein Mensch wirklich tippt.
  // Das Beispiel steht dabei, weil eine Formbeschreibung ohne Beispiel niemanden weiterbringt.
  //
  // NICHT für einen fremden TYP (Array, Zahl, Objekt): den kann keine Oberfläche erzeugen, er
  // behält `INTERNAL` (routes.ts, die Formwachen beider Wege).
  ACCESS_EXPIRY_UNREADABLE: {
    de: "Ablaufdatum nicht lesbar. Bitte einen vollständigen Zeitpunkt mit Datum, Uhrzeit und Zeitzone angeben, zum Beispiel 2026-12-31T23:59:00Z.",
    en: "The expiry date is not readable. Please enter a complete point in time with date, time and time zone, for example 2026-12-31T23:59:00Z.",
    nl: "De vervaldatum is niet leesbaar. Voer een volledig tijdstip in met datum, tijd en tijdzone, bijvoorbeeld 2026-12-31T23:59:00Z.",
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
  // JOB 3792: der Nachbar von ADMIN_REQUIRED und ausdrücklich nicht dasselbe. „Adminrecht
  // erforderlich" nennt EINE Rolle; hier fehlt ein bestimmtes Recht, und welches, ist die einzige
  // Auskunft darüber, was dem Konto fehlt — sie bleibt deshalb im Satz. Der Rechtename wird in
  // KEINER Sprache übersetzt: `ko.create` ist eine Kennung des Systems, kein Wort.
  //
  // DER EINZIGE EINTRAG MIT EINER EINSETZSTELLE. `%s` nimmt den Rechtenamen auf, den
  // `services/app/src/http.ts` mitgibt; ohne Wert bleibt `%s` sichtbar stehen (siehe `meldung()`).
  // Der deutsche Wortlaut ist zeichengleich mit dem Literal, das bis JOB 3792 in `http.ts` stand —
  // fünf Bestandstests pinnen ihn wörtlich, und `tests/q9-rechtefehler/` misst ihn am Draht.
  PERMISSION_MISSING: {
    de: "Recht fehlt: %s",
    en: "Missing permission: %s",
    nl: "Ontbrekend recht: %s",
  },
  // JOB 3956: der Nachbar von PERMISSION_MISSING und ausdrücklich nicht dasselbe. Dort FEHLT ein
  // bestimmtes Recht, und der Satz nennt es; hier sagt der RBAC-Wächter (`services/rbac/src/guard.ts`)
  // nur, dass die Rolle nicht reicht — er kennt den Rechtenamen zwar, gibt ihn aber seit jeher nicht
  // heraus. Der deutsche Wortlaut ist zeichengleich mit dem Literal, das bis JOB 3956 in `guard.ts`
  // stand; gemessen in `tests/q9-entwurfsfehler/` (G3) und in `tests/q9-fremde-flaechen/`.
  PERMISSION_DENIED: {
    de: "Keine Berechtigung.",
    en: "You do not have permission.",
    nl: "Je hebt geen toestemming.",
  },
  // JOB 3956 · DIE ZWEI SÄTZE DES ENTWURFS-LADEWEGS (`services/app/src/routes/capture-routes.ts`).
  // Sie sind ZWEI und nicht einer: „gibt es nicht" und „gehört jemand anderem" sind zwei Lagen mit
  // zwei verschiedenen Wegen zurück, und ein gemeinsamer Satz schickte die Hälfte der Betroffenen in
  // die falsche Richtung (gehalten von F4 in `tests/q9-entwurfsfehler/`).
  //
  // DIE ASCII-SCHREIBWEISE „verfuegbar" IST ABSICHT UND EIN BEFUND, kein Versehen: mehrere
  // Bestandstests pinnen den deutschen Satz wörtlich (u. a.
  // `tests/entwurf-fortsetzen-fehlersatz/serversatz-bis-blatt.test.tsx:174`). Sie zu berichtigen wäre
  // eine Wortlautänderung und ein zweiter Zweck; die deutsche Fassung bleibt deshalb zeichengleich
  // mit dem früheren Literal. EN und NL erben den fehlenden Umlaut NICHT — sie sind richtig
  // geschrieben.
  DRAFT_NOT_FOUND: {
    de: "Entwurf nicht gefunden.",
    en: "Draft not found.",
    nl: "Concept niet gevonden.",
  },
  DRAFT_NOT_VISIBLE: {
    de: "Entwurf nicht verfuegbar.",
    en: "This draft is not available to you.",
    nl: "Dit concept is niet voor jou beschikbaar.",
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
    de: "Anmeldedienst antwortet nicht.",
    en: "The sign-in service is not responding.",
    nl: "De aanmelddienst reageert niet.",
  },
} as const satisfies Record<string, Record<Sprache, string>>;

export type Meldungsschluessel = keyof typeof MELDUNGEN;

/**
 * Unbekannte Schlüssel geben weder Diagnosen noch interne Kennungen nach außen.
 *
 * JOB 3792 · DIE EINSETZSTELLE. `werte` füllt die `%s` des Satzes, von links nach rechts. Der
 * Parameter ist OPTIONAL und die Signatur damit abwärtskompatibel: jeder heutige Aufruf liefert
 * denselben Satz wie zuvor, und kein Bestandstext trägt ein `%s` (gemessen in
 * `tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts` Q5e).
 *
 * VIER REGELN, jede einzeln gemessen (Q5a–Q5d):
 *   · Ohne Werte bleibt `%s` STEHEN. Keine stille Leerung — ein Satz, dem der Wert fehlt, soll
 *     auffallen und nicht so aussehen, als sei er vollständig.
 *   · Überzählige Werte werden ignoriert; zu wenige lassen die restlichen `%s` stehen.
 *   · Ersetzt wird von links nach rechts.
 *   · Ein eingesetzter Wert wird NICHT erneut nach `%s` durchsucht. Das leistet `replace` mit
 *     globalem Muster von selbst: es läuft über die VORLAGE, nicht über das Ergebnis. Und weil der
 *     Ersatz aus einer FUNKTION kommt, ist `$&` im Wert ein Zeichen und kein Sonderzeichen.
 */
export function meldung(
  schluessel: string,
  sprache?: string,
  werte: readonly string[] = [],
): string {
  const key = Object.hasOwn(MELDUNGEN, schluessel)
    ? (schluessel as Meldungsschluessel)
    : "INTERNAL";
  const text = MELDUNGEN[key][sprache === "en" || sprache === "nl" ? sprache : "de"];
  let naechster = 0;
  return text.replace(/%s/g, (stelle) => werte[naechster++] ?? stelle);
}
