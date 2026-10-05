// Aufnahme m365-anmeldung (R-0355): das EINE Weiterziel nach dem SSO-Rückruf ausser der App. Nur
// die Dialogseite des Word-Add-ins — sie übergibt die Anmeldung von selbst an Klara. Jeder andere
// Wert wird ignoriert (kein offener Rücksprung, auch wenn der Server einmal etwas anderes schickte).
export function ssoWeiterziel(weiter: unknown): string {
  return weiter === "/word-addin/anmeldung.html" ? weiter : "/";
}
