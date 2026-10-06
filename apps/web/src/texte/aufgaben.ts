// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUFGABENANSICHT (R-0962) — die Fläche nennt ihren Gegenstand.
// ================================================================================================
//
// Nur einer von fünf Aufgabentypen ist personenbezogen (zurückgegebene Entwürfe); Prüfungen,
// Konflikte, Wissenslücken und Re-Validierungen liegen für alle Berechtigten gemeinsam an. Der
// Menüpunkt heisst deshalb „Offene Aufgaben" statt „Meine Aufgaben" (so benennt ihn die Quelle,
// D-003), und dieser Satz unter der Überschrift sagt, was hier landet — dieselben fünf Quellen,
// die `pages/MyTasks.tsx` zusammenführt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "aufgaben.",
  legacySchluessel: [],
  de: {
    "aufgaben.leitsatz":
      "Hier landen zurückgegebene Entwürfe, fällige Prüfungen, Konflikte, Wissenslücken und Re-Validierungen.",
  },
  en: {
    "aufgaben.leitsatz":
      "This is where returned drafts, due reviews, conflicts, knowledge gaps and re-validations land.",
  },
  nl: {
    "aufgaben.leitsatz":
      "Hier komen teruggestuurde concepten, openstaande beoordelingen, conflicten, kennishiaten en hervalidaties terecht.",
  },
} satisfies Textmodul;
