import { adminHref } from "./adminSections";

// PETER-20261011-P08 · AC05 — die Weiche der SSO-Rückrufseite.
//
// Der Anbieter leitet nach JEDER Anmeldung auf dieselbe feste Rückrufadresse (`/sso/callback`). Ein
// Rückruf, den der Firmenreset begonnen hat, trägt einen `state` mit diesem Präfix (vom Server
// vergeben, `services/app/src/firmenreset-sso.ts`). Er geht NICHT an die Anmeldung — die gäbe eine
// neue Sitzung aus —, sondern an die Bestätigungsroute des Resets. Ob er gilt, entscheidet allein der
// Server: der Präfix wählt nur das Ziel, er beweist nichts.
export const FIRMENRESET_SSO_PRAEFIX = "firmenreset.";

export function istFirmenresetRueckruf(state: string | null): boolean {
  return state?.startsWith(FIRMENRESET_SSO_PRAEFIX) === true;
}

/** Zurück in die Karte Werkseinstellungen; `sso=fehler` lässt sie den Abbruch/Fehlschlag nennen. */
export function firmenresetRueckweg(fehler: boolean): string {
  return `${adminHref("system", "werk")}${fehler ? "&sso=fehler" : ""}`;
}
