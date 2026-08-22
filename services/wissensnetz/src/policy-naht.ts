// ================================================================================================
// DIE EINE NAHT · JOB 1577 D7 — hier kommt die zentrale Sichtbarkeitspolicy herein.
// ================================================================================================
//
// KORREKTUR ZU D6 (BENs Korrekturpflicht 2, zweite Haelfte). D6 hatte hier `zentralePolicy<K>()`
// OHNE Betrachter. BEN hat den Bruch gesehen:
//
//     „Der Einstieg ruft `zentralePolicy<K>()` auf, die angegebene Ersatzzeile exportiert dagegen
//      `darfSehen` unter einem anderen Namen; ‚ohne dass eine andere Datei dieses Moduls sich
//      aendert' ist damit nicht belegt."
//
// Er hat recht, und der Fehler wog schwerer als ein Namensdreher: `darfSehen(user, ko)` braucht
// einen BETRACHTER. Eine Naht ohne `user` haette sich mit Weg B ueberhaupt nicht schliessen
// lassen — die dokumentierte Schliessung war nicht bloss unsauber benannt, sie war unmoeglich.
//
// Deshalb traegt die Naht jetzt den Betrachter, und die drei Wege sind auf Name, Signatur und
// Kontext geprueft:
//
//   WEG B  `services/app/index.ts` exportiert `darfSehen`; dann ist der Rumpf unten GENAU:
//              import { darfSehen } from "../../app";
//              export function policyFuer<K extends WissensnetzKo>(
//                betrachter: Betrachter,
//              ): Sichtbarkeitspolicy<K> {
//                return (ko) => darfSehen(betrachter, ko as never);
//              }
//          Name `policyFuer`, Signatur `(Betrachter) => (ko) => boolean`, Kontext `betrachter`
//          — identisch zum Aufruf in `luecken-einstieg.ts`. Keine andere Datei dieses Moduls
//          aendert sich; nachgemessen in D7 §3.3.
//   WEG C  Der Einstieg wandert nach `services/app`; dann entfaellt diese Datei ersatzlos, und
//          `luecken-einstieg.ts` importiert `darfSehen` direkt (dort modulintern erlaubt).
//   WEG D  Die Kompositionswurzel reicht die Policy herein; dann wird `policyFuer` zu einem Port,
//          den die Wurzel fuellt — die Signatur bleibt, nur die Herkunft wechselt.
//
// WARUM DER RUMPF WIRFT. `() => true` waere ein stiller Sicherheitsbruch. `() => false` waere
// eine leere Sicht, die sich fuer vollstaendig erklaert — denselben Fehlertyp benennt
// `lesemodell.ts` bei seinem Deckel ausdruecklich. Eine offene Naht ist ein Zustand, kein
// Ergebnis, und sagt das laut.

import type { WissensnetzKo } from "./lesemodell-ports";

/**
 * Der Betrachter, fuer den die Sicht erhoben wird.
 *
 * Absichtlich das Mindestmass statt eines Imports aus `services/auth`: Dieses Modul braucht nur
 * diese zwei Felder, und `darfSehen(user, ko)` verlangt genau sie (`sichtbarkeit.ts:67`).
 */
export interface Betrachter {
  readonly id: string;
  readonly role: string;
}

/** Die Form, die jeder der drei Wege liefern muss. */
export type Sichtbarkeitspolicy<K extends WissensnetzKo> = (ko: K) => boolean;

export const NAHT_OFFEN =
  "H3-LUECKEN: die Sichtbarkeitsnaht ist offen — `services/app/index.ts` gibt `darfSehen` " +
  "nicht heraus (Ownerentscheidung B/C/D aus JOB 1577 D5 §4.1 steht aus). " +
  "Solange sie offen ist, erzeugt dieses Modul KEINE Sicht.";

/**
 * Liefert die zentrale Policy fuer diesen Betrachter — heute: gar nicht.
 *
 * Der Wurf ist die Zusicherung: Ohne zentrale Policy entsteht keine Sicht, also auch keine
 * Metrik. Man kann `wissensnetzLuecken` nicht dazu bringen, ohne `darfSehen` zu antworten.
 */
export function policyFuer<K extends WissensnetzKo>(
  _betrachter: Betrachter,
): Sichtbarkeitspolicy<K> {
  throw new Error(NAHT_OFFEN);
}
