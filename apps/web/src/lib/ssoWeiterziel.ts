// Aufnahme m365-anmeldung (R-0355): das EINE Weiterziel nach dem SSO-Rückruf ausser der App. Nur
// die Dialogseite des Word-Add-ins — sie übergibt die Anmeldung von selbst an Klara. Jeder andere
// Wert wird ignoriert (kein offener Rücksprung, auch wenn der Server einmal etwas anderes schickte).
//
// R-0582: die zweite feste Adresse — zurück in die Kontodaten-Berichtigung des Profils, nachdem die
// erneute SSO-Anmeldung die Identität für eine neue E-Mail bestätigt hat. Ebenfalls wörtlich.
const FESTE_ZIELE = ["/word-addin/anmeldung.html", "/profil?kontodaten=sso"];

export function ssoWeiterziel(weiter: unknown): string {
  return typeof weiter === "string" && FESTE_ZIELE.includes(weiter) ? weiter : "/";
}
