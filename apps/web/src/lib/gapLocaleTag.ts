import type { Gap } from "../api/types";

/**
 * GAP-SPRACHHERKUNFT: Sprach-Etikett für einen Wissenslücken-Titel.
 *
 * BEFUND (Design-Lead, 14.08.2026): In der deutschen Aufgabenliste stand
 * „Countersunk screws sind in Lebensmittel- und Spritzzonen verboten" — ein englischer
 * Fachbegriff mitten im deutschen Satz. Ursache ist keine kaputte Übersetzung, sondern die
 * Herkunft: Das Word-Add-in schickt markierten Dokumenttext, und bleibt die Frage unbeantwortet,
 * wird daraus eine Lücke. Der Titel behält die Sprache des Dokuments.
 *
 * Der Titel wird NICHT übersetzt (er ist der Beleg der Originalfrage und der Anker zur markierten
 * Stelle) und NICHT unterdrückt (der Offene-Frage-Weg des Panels baut auf der Lücke auf). Die
 * Oberfläche erklärt ihn stattdessen.
 *
 * Rückgabe: der Sprachname in der Sprache der Oberfläche, oder `null`, wenn kein Etikett gehört —
 * bei gleicher Sprache (sonst trüge jeder Eintrag einer deutschen Liste das Wort „Deutsch") und
 * bei Altbeständen ohne Sprachangabe (nichts behaupten, was nicht belegt ist).
 */
export function gapLocaleTag(
  gapLocale: Gap["locale"] | undefined,
  displayLocale: string,
): string | null {
  if (!gapLocale) return null;
  // i18next liefert je nach Browsereinstellung „de-CH" oder „en-GB"; für die Frage „fremde
  // Sprache?" zählt nur der Sprachteil, nicht die Region.
  const anzeige = (displayLocale || "de").split("-")[0]?.toLowerCase() ?? "de";
  if (anzeige === gapLocale) return null;
  try {
    const namen = new Intl.DisplayNames([displayLocale], { type: "language" });
    return namen.of(gapLocale) ?? gapLocale.toUpperCase();
  } catch {
    // Fail-soft: eine unbekannte Anzeigesprache darf die Aufgabenliste nicht leeren. Dann steht
    // dort der rohe Code — unschön, aber ehrlich und sichtbar.
    return gapLocale.toUpperCase();
  }
}
