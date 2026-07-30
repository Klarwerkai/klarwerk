// AUFTRAG-mega59 BLOCK H4 — DIE MESSUNG, DIE S1 UNMITTELBAR GEFANGEN HÄTTE.
//
// S1 war der Befund, dass die Rauchprobe „Fragen antwortet ehrlich" NIE einen `/api/ask`-Aufruf
// ausgelöst hat und allein durch einen statischen Einleitungstext grün wurde. Bis heute zählt im
// Browser-Smoke KEIN einziger Fall Anfragen — jede Aussage über „der Weg wurde gegangen" oder „der
// Weg ist gesperrt" ist damit ein Schluss aus dem sichtbaren Text, nicht aus dem Verkehr.
//
// Diese Hilfe schließt das, und zwar wiederverwendbar statt einmalig: `page.on("request")` zählt die
// Aufrufe auf ein Endpunktmuster mit. Zwei Richtungen, beide gebraucht:
//
//   · „ES WURDE NICHTS GESCHICKT" — die Sperre hält wirklich. Genau hier lag der hohle Fall H4: nach
//     `press("Enter")` folgten nur zwei Abwesenheitsprüfungen auf Zustände, die VORHER schon galten.
//     Sendet Enter durch eine Regression trotz gesperrtem Knopf doch, fällt das nicht auf. Eine
//     Abwesenheit im DOM ohne Frist ist keine Aussage über einen Vorgang.
//   · „ES WURDE WIRKLICH GESCHICKT" — der Weg wurde gegangen. Das ist die S1-Richtung.
//
// KEINE PRODUKTÄNDERUNG, kein Eingriff in den Verkehr: nur mitgehört, nie abgefangen oder ersetzt.
import type { Page, Request } from "@playwright/test";

export interface Anfragezaehler {
  /** Wie viele passende Anfragen bisher gesehen wurden. */
  anzahl(): number;
  /** Die gesehenen Adressen — für eine sprechende Fehlermeldung, nicht für die Zusicherung. */
  adressen(): string[];
  /** Wartet eine feste Frist ab, damit „nichts geschickt" eine ECHTE Aussage ist und kein Zufall. */
  ruhefrist(ms: number): Promise<void>;
  /** Hört auf mitzuhören (am Fallende, damit der Zähler nicht in den nächsten Fall leckt). */
  stoppen(): void;
}

// Die Ruhefrist eines „es wurde nichts geschickt". Kurz genug, um keinen Lauf zu verlängern, lang
// genug, dass ein abgesendetes Formular es nicht mehr unterläuft (die Anfrage startet sofort beim
// Absenden, nicht erst mit der Antwort).
export const RUHEFRIST_MS = 1_500;

export function zaehleAnfragen(page: Page, muster: RegExp): Anfragezaehler {
  const gesehen: string[] = [];
  const horcher = (request: Request): void => {
    if (muster.test(request.url())) {
      gesehen.push(`${request.method()} ${request.url()}`);
    }
  };
  page.on("request", horcher);
  return {
    anzahl: () => gesehen.length,
    adressen: () => [...gesehen],
    ruhefrist: (ms: number) => page.waitForTimeout(ms),
    stoppen: () => page.off("request", horcher),
  };
}
