// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUFGABENANSICHT (R-0962) — die Fläche nennt ihren Gegenstand.
// ================================================================================================
//
// Nur einer von fünf Aufgabentypen ist personenbezogen (zurückgegebene Entwürfe); Prüfungen,
// Konflikte, Wissenslücken und Re-Validierungen liegen für alle Berechtigten gemeinsam an. Der
// Menüpunkt heisst deshalb „Offene Aufgaben" statt „Meine Aufgaben" (so benennt ihn die Quelle,
// D-003), und dieser Satz unter der Überschrift sagt, was hier landet — dieselben fünf Quellen,
// die `pages/MyTasks.tsx` zusammenführt.
//
// AUFNAHME 20260922 · GESAMT-NAVIGATION (R-1023 / R-1813): `zumBereich` ist der Verweis auf dieselbe
// Fläche aus einer leeren Prüfliste (`lib/emptyStateActions.ts`). Er hieß bis hierher noch „Zu meinen
// Aufgaben" / „Go to my tasks" / „Naar mijn taken" — der Menüpunkt war umbenannt, sein Verweis nicht.
// Der alte Schlüssel `empty.cta.tasks` bleibt im Grundwörterbuch unverändert stehen: dessen Werte
// sind gegen den Basisstand gepinnt (`tests/i18n-textmodule/bestand-unveraendert.test.ts`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "aufgaben.",
  legacySchluessel: [],
  de: {
    "aufgaben.leitsatz":
      "Hier landen zurückgegebene Entwürfe, fällige Prüfungen, Konflikte, Wissenslücken und Re-Validierungen.",
    "aufgaben.zumBereich": "Zu den offenen Aufgaben",
  },
  en: {
    "aufgaben.leitsatz":
      "This is where returned drafts, due reviews, conflicts, knowledge gaps and re-validations land.",
    "aufgaben.zumBereich": "Go to open tasks",
  },
  nl: {
    "aufgaben.leitsatz":
      "Hier komen teruggestuurde concepten, openstaande beoordelingen, conflicten, kennishiaten en hervalidaties terecht.",
    "aufgaben.zumBereich": "Naar open taken",
  },
} satisfies Textmodul;
