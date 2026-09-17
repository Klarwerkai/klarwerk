// ==================================================================================================
// JOB 4309 · EIN ÜBERSPRUNGENER PFLICHTFALL IST KEIN BESTANDENER — UND DAS IST EINE FUNKTION.
// ==================================================================================================
//
// PEDI WÖRTLICH (`eingang/erledigt/EINGANG-20260917-PRO-OFFICE-PG-0708.md:5`): „Erforderliche Fälle
// dürfen nicht durch Skip grün erscheinen."
//
// DIE FEHLERKLASSE, gegen die diese Datei steht, ist im Haus belegt: `ctx.skip()` beendet einen
// Fall OHNE Fehlschlag, und wer nur auf den Exitcode sieht, liest einen übersprungenen Lauf als
// einen bestandenen. `services/audit/src/repo-pg.integration.test.ts:25-52` hat daraus die Hausform
// gemacht — ein ausdrücklich geführter Laufzustand und ein Zeugentest, der IMMER läuft.
//
// WARUM DIE REGEL HIER ALS FUNKTION STEHT UND NICHT ALS `if` IM PRÜFSTAND: eine Regel, die nur im
// Prüfstand steht, lässt sich nur mit dem Prüfstand messen — und der braucht eine Datenbank und
// einen Browser. Genau dann fiele die Prüfung der Regel mit der Sache aus, gegen die sie steht.
// Hier ist sie DOM-frei, datenbankfrei und im Tor messbar (`a9-skip-zaehlt-nicht.test.ts`), und der
// Integrationslauf ist ihr Aufrufer.
//
// DREI ZUSTÄNDE UND NICHT ZWEI. `undefined` heisst „`beforeAll` lief nicht durch" und ist ein
// eigener Befund: er sieht von aussen aus wie ein Skip, hat aber eine andere Ursache, und ein
// Prüfstand, der beides zusammenzieht, verschweigt einen Aufbaufehler.

/** GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — `undefined` heisst: `beforeAll` lief nicht. */
export type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

/**
 * Zählt dieser Lauf als BESTANDEN?
 *
 * Nur `gelaufen: true`. Weder ein Skip noch ein nicht durchgelaufener Aufbau tut es — und es gibt
 * hier ausdrücklich keinen dritten Zweig, der „nicht messbar" zu „in Ordnung" machte.
 */
export function zaehltAlsBestanden(zustand: Laufzustand | undefined): boolean {
  return zustand?.gelaufen === true;
}

/**
 * Der Satz, der auf stderr geht — er nennt IMMER, was Sache ist.
 *
 * Ein stiller Skip sähe aus wie ein bestandener Lauf; deshalb trägt jeder der drei Zustände seinen
 * eigenen, ausgeschriebenen Satz, und der übersprungene sagt ausdrücklich, dass er nichts belegt.
 */
export function befundsatz(marke: string, zustand: Laufzustand | undefined): string {
  if (!zustand) {
    return `[KLARWERK] ${marke}: KEIN LAUFZUSTAND — beforeAll lief nicht durch. Das ist ein Befund, kein Grün.\n`;
  }
  if (zustand.gelaufen) {
    return `[KLARWERK] ${marke}: GELAUFEN gegen ${zustand.quelle}.\n`;
  }
  return `[KLARWERK] ${marke}: UEBERSPRUNGEN — ${zustand.grund}. Dieser Pflichtfall ist damit NICHT belegt.\n`;
}
