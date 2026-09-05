// ================================================================================================
// JOB 3064 H5 — „ZULETZT": drei Titel, drei Datumsangaben, sonst nichts.
// ================================================================================================
// Das Zielbild (`Main.dc.html` Z.68–84) schreibt die Datumsform vor: „heute", „gestern", „Di.".
// Kein voller Zeitstempel, kein „vor 3 Stunden" — die Karte ist eine Erinnerung, keine Uhr.
//
// DOM-frei, damit die Grenzfälle ohne Browser prüfbar sind. Ein unlesbares Datum ist ausdrücklich
// ein eigener Zustand: dann steht KEINE Angabe da. Ein erfundenes „heute" wäre eine Tatsachen-
// aussage über etwas, das gerade nicht feststeht.
export type ZuletztTag = "heute" | "gestern" | "wochentag" | "unbekannt";

/** Kalendertag (lokal) als Zahl — die Differenz zweier solcher Zahlen ist die Tagesdifferenz. */
function tagesnummer(d: Date): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/**
 * `at` ist ein ISO-Zeitstempel aus dem Bestand (`LiveWall.saved[].at`). Verglichen wird der
 * KALENDERTAG, nicht der Abstand in Stunden: „gestern 23:50" ist gestern, auch wenn es zwanzig
 * Minuten her ist.
 *
 * Älter als sechs Tage bekommt bewusst keinen Wochentag mehr — „Di." wäre dann nicht mehr
 * eindeutig, sondern eine Verwechslung mit dem Dienstag dieser Woche.
 */
export function zuletztTag(at: string, jetzt: Date): ZuletztTag {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) {
    return "unbekannt";
  }
  const diff = tagesnummer(jetzt) - tagesnummer(d);
  if (diff < 0 || diff > 6) {
    return "unbekannt";
  }
  if (diff === 0) {
    return "heute";
  }
  if (diff === 1) {
    return "gestern";
  }
  return "wochentag";
}

/** Kurzer Wochentag in der Oberflächensprache („Di." / „Tue" / „di"). */
export function wochentagKurz(at: string, sprache: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleDateString(sprache, { weekday: "short" });
}

/** Wie viele Einträge die Karte zeigt (Zielbild: drei). */
export const ZULETZT_ZEILEN = 3;
