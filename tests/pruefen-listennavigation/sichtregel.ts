// ================================================================================================
// JOB 3593 · DIE REGEL „IM FENSTER" — als benannte Grösse, nicht als Zahl im Fall.
// ================================================================================================
//
// WOZU DIESE DATEI NEBEN DEN JSDOM-FÄLLEN DANEBEN: `pfeiltasten.test.tsx` und `mausrad.test.tsx`
// messen VERHALTEN (welcher Eintrag ist gewählt, was steht rechts, wurde das Ereignis verbraucht).
// Sie können nicht messen, ob etwas SICHTBAR ist — jsdom rechnet kein Layout, dort hat jeder Kasten
// die Grösse null. Die Frage aus bens Prüflücke 6 zu JOB 3504 (`archiv/3504/runde-1/ben.md:24`) ist
// aber genau eine Geometriefrage: „Auswahl UND rechten Artikel im Viewport messen."
//
// Gemessen wird sie deshalb im echten Browser (`tests/design/job2935-validierung-fussband.test.ts`).
// Die REGEL, nach der aus vier Zahlen ein Urteil wird, steht hier — an einer Stelle, für beide
// Bedienwege (Pfeiltaste und Rad) und für beide Kästen (Eintrag und Karte). Stünde sie als Zahl im
// Fall, hätte jeder Fall seine eigene Elle, und ein späterer Nachbar könnte sie unbemerkt lockern.

/**
 * Ein Kasten in FENSTERKOORDINATEN, so wie `getBoundingClientRect()` ihn liefert: `oben`/`unten`
 * zählen vom oberen Fensterrand, nicht vom Dokumentanfang. `oben = -30` heisst also: dreissig Pixel
 * über dem Fensterrand, für einen Menschen nicht mehr zu sehen.
 */
export interface Sichtkasten {
  oben: number;
  unten: number;
}

/**
 * Rundungstoleranz in Pixeln. Chromium liefert gebrochene Gerätepixel (die D1-Messung derselben
 * Bühne steht z. B. bei `oben: 138.5`); ein halber Pixel über der Kante ist kein Sichtverlust.
 * Ein Pixel — mehr nicht: die gemessenen Verluste sind zweistellig oder grösser, eine grosszügigere
 * Toleranz würde nichts retten und nur die Aussage verwässern.
 */
export const SICHT_TOLERANZ_PX = 1;

/** Wie viele Pixel der Kasten ÜBER den oberen Fensterrand hinausgewandert ist (0 = keiner). */
export function ueberDemFenster(k: Sichtkasten): number {
  return Math.max(0, -k.oben);
}

/** Wie viele Pixel der Kasten UNTERHALB des Fensters beginnt (0 = er beginnt im Bild). */
export function unterDemFenster(k: Sichtkasten, fensterHoehe: number): number {
  return Math.max(0, k.oben - fensterHoehe);
}

/**
 * „Im Fenster" — die eine Regel, an der beide Aussagen dieses Jobs hängen.
 *
 * ZWEI BEDINGUNGEN, und die zweite ist der Kern der Sache:
 *   1. Der Kasten SCHNEIDET den Sichtbereich (`unten > 0` und `oben < fensterHoehe`). Ohne sie
 *      gälte ein Kasten, der komplett unter dem Fenster liegt, als „nicht oben abgeschnitten".
 *   2. Sein OBERRAND liegt nicht oberhalb des Fensters (`oben >= -SICHT_TOLERANZ_PX`). Genau das
 *      ist der Fall, um den es geht: eine Karte, deren Kopf mit Titel und Einstufung nach oben
 *      hinausgewandert ist, ist für einen lesenden Menschen weg — auch wenn ihr Fussband unten
 *      noch ins Bild ragt und sie damit den Sichtbereich technisch „schneidet".
 */
export function imFenster(k: Sichtkasten, fensterHoehe: number): boolean {
  const schneidet = k.unten > 0 && k.oben < fensterHoehe;
  return schneidet && ueberDemFenster(k) <= SICHT_TOLERANZ_PX;
}

/** Eine Messung nach EINEM Schritt: welcher Eintrag gewählt ist und wo die beiden Kästen stehen. */
export interface Schrittmessung {
  /** Wievielter Schritt (1 = nach dem ersten Pfeildruck bzw. dem ersten Radschub). */
  schritt: number;
  /** Stellung der Auswahl in der Liste, aus dem DOM gelesen — der Beleg, dass wirklich geschaltet wurde. */
  index: number;
  auswahl: Sichtkasten;
  karte: Sichtkasten;
  fensterHoehe: number;
  /** `window.scrollY` — die Rollposition des FENSTERS. */
  rollposition: number;
  /**
   * Die Rollposition des nächsten wirklich rollenden Vorfahren der Liste, und sein Name.
   *
   * Beides steht hier, weil `rollposition` allein in die Irre führt: gemessen am 11.09. wanderte
   * die Warteschlange nach vierzehn Radschritten aus dem Fenster, während `window.scrollY` auf 0
   * blieb — es rollt ein Bereich INNERHALB der Seite, nicht das Fenster. Wer nur die erste Zahl
   * liest, hält den Stillstand des Fensters für Stillstand auf dem Bildschirm.
   */
  rollerTop: number;
  rollerName: string;
  /** Der nächste rollende Bereich ÜBER dem innersten — die Hülle, in der die Karte mit liegt. */
  huelleTop: number;
  huelleName: string;
}

/** Der Befund zu einem Bedienweg: wo (und wie stark) ein Kasten zuerst aus dem Fenster fällt. */
export interface Sichtbefund {
  /** Der erste Schritt mit Sichtverlust, oder `null`, wenn es keinen gab. */
  schritt: number | null;
  /** Wie viele Pixel dabei über dem Fensterrand lagen (0, wenn es keinen Verlust gab). */
  fehlbetragPx: number;
  /** Die Rollposition des Fensters bei diesem Schritt — bzw. die letzte gemessene, wenn alles stand. */
  rollposition: number;
  /** Dasselbe für den innersten wirklich rollenden Bereich (siehe `Schrittmessung.rollerTop`). */
  rollerTop: number;
  rollerName: string;
  huelleTop: number;
  huelleName: string;
}

/**
 * Den ersten Sichtverlust EINES der beiden Kästen suchen. Ein Befund ohne Verlust ist ein
 * vollwertiges Ergebnis: `schritt: null` heisst gemessen, nicht ungemessen — die Zahlen dazu
 * stehen in `Schrittmessung`, und die Rückgabe nennt sie.
 */
export function ersterSichtverlust(
  messungen: readonly Schrittmessung[],
  welcher: "auswahl" | "karte",
): Sichtbefund {
  for (const m of messungen) {
    const k = welcher === "auswahl" ? m.auswahl : m.karte;
    if (!imFenster(k, m.fensterHoehe)) {
      return {
        schritt: m.schritt,
        fehlbetragPx:
          Math.round(Math.max(ueberDemFenster(k), unterDemFenster(k, m.fensterHoehe)) * 100) / 100,
        rollposition: m.rollposition,
        rollerTop: m.rollerTop,
        rollerName: m.rollerName,
        huelleTop: m.huelleTop,
        huelleName: m.huelleName,
      };
    }
  }
  const letzte = messungen.at(-1);
  return {
    schritt: null,
    fehlbetragPx: 0,
    rollposition: letzte?.rollposition ?? 0,
    rollerTop: letzte?.rollerTop ?? 0,
    rollerName: letzte?.rollerName ?? "keiner",
    huelleTop: letzte?.huelleTop ?? 0,
    huelleName: letzte?.huelleName ?? "keiner",
  };
}
