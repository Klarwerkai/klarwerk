// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUFGABENANSICHT (R-0962) — die Fläche nennt ihren Gegenstand.
// ================================================================================================
//
// Nur einer von fünf Aufgabentypen ist personenbezogen (zurückgegebene Entwürfe); Prüfungen,
// Konflikte, Wissenslücken und Re-Validierungen liegen für alle Berechtigten gemeinsam an. Der
// Menüpunkt heisst deshalb „Offene Aufgaben" statt „Meine Aufgaben" (so benennt ihn die Quelle,
// D-003), und dieser Satz unter der Überschrift sagt, was hier landet — dieselben Quellen, die
// `pages/MyTasks.tsx` zusammenführt.
//
// AUTORENÜBERGABE-AUFTRAG (R-0961) — DER BENANNTE QUELLENWIDERSPRUCH. R-0962 / D-003 (13.08.)
// beschreibt die Fläche mit FÜNF Arten ohne Autorenübergabe; R-0961 (24.06.) nennt sie als Art.
// Pedi hat entschieden (entscheidung:8bace44d, 30.09.; Fragen 23/24, 11.10.), dass die wartende
// Autorenübergabe auf die Fläche kommt. Der Satz nennt sie deshalb als sechste Art, mit dem Zusatz,
// dass sie nur der Verwaltung angezeigt wird. Damit weicht er bewusst von D-003 ab, und die
// Abweichung ist Pedis Entscheidung, nicht eine stillschweigende Auflösung
// (`docs/aufnahme/20260922-gesamt-aufgabenansicht-autorenuebergabe.md`).
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
      "Hier landen zurückgegebene Entwürfe, fällige Prüfungen, Konflikte, Wissenslücken, Re-Validierungen und – für die Verwaltung – anstehende Autorenübergaben.",
    "aufgaben.zumBereich": "Zu den offenen Aufgaben",
  },
  en: {
    "aufgaben.leitsatz":
      "This is where returned drafts, due reviews, conflicts, knowledge gaps, re-validations and – for administrators – pending author handovers land.",
    "aufgaben.zumBereich": "Go to open tasks",
  },
  nl: {
    "aufgaben.leitsatz":
      "Hier komen teruggestuurde concepten, openstaande beoordelingen, conflicten, kennishiaten, hervalidaties en – voor het beheer – openstaande auteursoverdrachten terecht.",
    "aufgaben.zumBereich": "Naar open taken",
  },
} satisfies Textmodul;
