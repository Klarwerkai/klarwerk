import type { AnsprechpartnerSpuren, AnsprechpartnerVorschlag } from "../api/types";

// R-1663 / R-2178 — die Anzeige-Logik der Ansprechpartner-Vorschläge, DOM-frei und testbar (wie
// lib/expertiseView.ts). Zwei Regeln, beide aus der Quelle („nicht als soziale Bewertung, sondern
// als evidenzbasierte Wissensspur"):
//   · Gezeigt wird je Person NUR, was wirklich auf sie zeigt — eine Spur mit Zahl 0 erscheint nicht.
//   · Die Reihenfolge ist alphabetisch nach dem ANGEZEIGTEN Namen, nie nach Spurenmenge. Der Server
//     ordnet nach Kennung; für den Menschen am Bildschirm ist erst der Name alphabetisch lesbar.

/** Die feste Reihenfolge der Spurenarten in der Begründung. */
export const SPUREN_REIHENFOLGE: readonly (keyof AnsprechpartnerSpuren)[] = [
  "originalautor",
  "erfasst",
  "validiert",
  "pruefung",
  "verantwortlich",
  "aehnlicheLuecken",
];

export interface Spurenzeile {
  art: keyof AnsprechpartnerSpuren;
  anzahl: number;
}

/** Die vorhandenen Spuren einer Person in fester Reihenfolge, ohne leere. */
export function spurenZeilen(spuren: AnsprechpartnerSpuren): Spurenzeile[] {
  const zeilen: Spurenzeile[] = [];
  for (const art of SPUREN_REIHENFOLGE) {
    if (spuren[art] > 0) {
      zeilen.push({ art, anzahl: spuren[art] });
    }
  }
  return zeilen;
}

/** Vorschläge alphabetisch nach angezeigtem Namen (Gleichstand: Kennung) — keine Rangfolge. */
export function alphabetischNachName(
  vorschlaege: readonly AnsprechpartnerVorschlag[],
  nameOf: (id: string) => string,
  locale?: string,
): AnsprechpartnerVorschlag[] {
  const vergleich = (a: AnsprechpartnerVorschlag, b: AnsprechpartnerVorschlag): number => {
    const nachName = nameOf(a.personId).localeCompare(nameOf(b.personId), locale);
    if (nachName !== 0) {
      return nachName;
    }
    return a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0;
  };
  return [...vorschlaege].sort(vergleich);
}
