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
  "H3-LUECKEN: die Sichtbarkeitsnaht ist offen — die Kompositionswurzel hat " +
  "`policyNahtSchliessen` nicht gerufen. Solange sie offen ist, erzeugt dieses Modul KEINE Sicht.";

// ================================================================================================
// JOB 2009 · D2 — DIE NAHT IST GESCHLOSSEN, UND ZWAR ALS WEG D.
// ================================================================================================
//
// WARUM D UND NICHT B. Der Kommentar oben nennt drei Wege. In JOB 2009 D1 habe ich sie gegen
// `.dependency-cruiser.cjs` gemessen, und das Ergebnis ist eindeutig:
//
//   WEG B ALLEIN (policy-naht importiert `darfSehen` aus `../../app`)  →  depcruise EXIT 0
//   WEG B + EIN AUFRUFER in `services/app`                             →  depcruise EXIT 2
//        error no-circular: services/wissensnetz/index.ts → policy-naht.ts →
//                           services/app/index.ts → build-app.ts → library-routes.ts →
//                           services/wissensnetz/index.ts
//   WEG D + derselbe Aufrufer                                          →  depcruise EXIT 0
//
// DAS IST DIE FALLE, IN DIE WEG B FUEHRT: Fuer sich genommen ist er sauber — WEIL ES NOCH KEINEN
// AUFRUFER GIBT. Genau in dem Moment, in dem H3 endlich benutzt wird, bricht er den Build
// (`.dependency-cruiser.cjs:1-2`: „Verstoesse brechen den Build"). Ein Weg, der nur solange
// funktioniert, wie niemand ihn benutzt, ist keiner.
//
// WEG D, woertlich aus dem Kommentar oben: „Die Kompositionswurzel reicht die Policy herein; dann
// wird `policyFuer` zu einem Port, den die Wurzel fuellt — die Signatur bleibt, nur die Herkunft
// wechselt." Genau das steht hier. Dieses Modul importiert NICHTS aus `services/app`; die Richtung
// bleibt einbahnig.
//
// WAS SICH NICHT AENDERT — und das ist der Kern:
//   · Die Signatur von `policyFuer` ist unveraendert. `luecken-einstieg.ts:36` ruft sie wie bisher.
//   · Der WURF bleibt. Er gilt jetzt fuer „nicht gefuellt" statt fuer „immer". Ohne zentrale
//     Policy entsteht weiterhin KEINE Sicht, und zwar VOR dem ersten Lesen.
//   · Das Praedikat ist weiterhin KEIN Parameter des Einstiegs — es kommt aus dieser Naht und ist
//     von aussen nicht ersetzbar. `h3-consumer-typvertrag.test.ts` C3 bleibt gruen.
//   · `() => true` als Vorgabewert gibt es nicht. Wer nicht schliesst, bekommt den Fehler.
let zentralePolicy: (<K extends WissensnetzKo>(b: Betrachter) => Sichtbarkeitspolicy<K>) | null =
  null;

/**
 * Die Kompositionswurzel reicht die zentrale Sichtbarkeitspolicy herein.
 *
 * Genau einmal, beim Aufbau der App. Der Aufrufer ist `services/app/src/build-app.ts` — dort
 * liegt `darfSehen` modulintern, es braucht also keinen Cross-Modul-Import und erzeugt keinen
 * Zyklus.
 */
export function policyNahtSchliessen(
  policy: <K extends WissensnetzKo>(b: Betrachter) => Sichtbarkeitspolicy<K>,
): void {
  zentralePolicy = policy;
}

/**
 * Liefert die zentrale Policy fuer diesen Betrachter — oder wirft, solange die Naht offen ist.
 *
 * Der Wurf ist die Zusicherung: Ohne zentrale Policy entsteht keine Sicht, also auch keine
 * Metrik. Man kann `wissensnetzLuecken` nicht dazu bringen, ohne `darfSehen` zu antworten.
 */
export function policyFuer<K extends WissensnetzKo>(
  betrachter: Betrachter,
): Sichtbarkeitspolicy<K> {
  if (zentralePolicy === null) {
    throw new Error(NAHT_OFFEN);
  }
  return zentralePolicy<K>(betrachter);
}
