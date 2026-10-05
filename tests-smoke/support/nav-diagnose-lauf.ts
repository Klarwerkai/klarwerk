/**
 * Auftrag navigation-race-beleg: die Schlusszeile von navigation-diagnose.jsonl bindet den
 * Mitschnitt an GENAU EINEN Playwright-Lauf. Trace und Screenshot liegen als Anhänge desselben
 * Testergebnisses; über testId/Projekt/Wiederholung lassen sie sich ohne Zeitabgleich zuordnen.
 * Ohne Playwright-Import, damit die Kalibrierung in jsdom läuft. Keine Query, kein Hash, keine Texte.
 */
export interface LaufInfo {
  testId: string;
  title: string;
  retry: number;
  repeatEachIndex: number;
  // Playwright setzt status erst nach dem Testkörper; vorher ist er ausdrücklich undefined.
  status?: string | undefined;
  expectedStatus: string;
  project: { name: string };
}

export function laufEnde(info: LaufInfo, url: string): Record<string, unknown> {
  let pfad: string;
  try {
    pfad = new URL(url).pathname;
  } catch {
    pfad = "(ungültige URL)";
  }
  return {
    status: info.status ?? null,
    erwartet: info.expectedStatus,
    pfad,
    lauf: {
      testId: info.testId,
      titel: info.title,
      projekt: info.project.name,
      wiederholung: info.retry,
      durchgang: info.repeatEachIndex,
    },
  };
}
