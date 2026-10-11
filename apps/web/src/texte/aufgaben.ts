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
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "aufgaben.",
  legacySchluessel: [],
  de: {
    "aufgaben.leitsatz":
      "Hier landen zurückgegebene Entwürfe, fällige Prüfungen, Konflikte, Wissenslücken, Re-Validierungen und – für die Verwaltung – anstehende Autorenübergaben.",
  },
  en: {
    "aufgaben.leitsatz":
      "This is where returned drafts, due reviews, conflicts, knowledge gaps, re-validations and – for administrators – pending author handovers land.",
  },
  nl: {
    "aufgaben.leitsatz":
      "Hier komen teruggestuurde concepten, openstaande beoordelingen, conflicten, kennishiaten, hervalidaties en – voor het beheer – openstaande auteursoverdrachten terecht.",
  },
} satisfies Textmodul;
