// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0890 — DIE BESCHRIFTUNGEN DER BIBLIOTHEKSARTIKEL AUF `/hilfe`.
// ================================================================================================
//
// Die Artikel selbst liegen in `lib/hilfeBibliothek.ts` (je Funktion fünf Teile, DE/EN/NL). Hier
// stehen nur der Aufklapper unter jeder Kapitelkarte und die fünf festen Überschriften des
// Bauplans aus Lieferung 1, Abschnitt A (`docs/qm/HILFE_LIEFERUNG-1_GLIEDERUNG-UND-FAQ_2026-07-04.md`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "hilfebibliothek.",
  legacySchluessel: [],
  de: {
    "hilfebibliothek.oeffnen": "Ausführlich erklärt",
    "hilfebibliothek.teil.was": "Was ist das?",
    "hilfebibliothek.teil.wie": "Wie funktioniert es?",
    "hilfebibliothek.teil.warum": "Warum ist es so gebaut?",
    "hilfebibliothek.teil.danach": "Was passiert danach?",
    "hilfebibliothek.teil.missverstaendnisse": "Typische Missverständnisse",
    "hilfebibliothek.funktionen.titel": "Funktionen ausführlich",
    "hilfebibliothek.funktionen.untertitel":
      "Einzelne Funktionen innerhalb der Bereiche — jeweils mit was, wie, warum, was danach und typischen Missverständnissen. Die Suche oben durchsucht sie mit.",
    "hilfebibliothek.gruppe.0": "Grundverständnis",
    "hilfebibliothek.gruppe.1": "Wissen erfassen",
    "hilfebibliothek.gruppe.2": "Prüfen und Freigeben",
    "hilfebibliothek.gruppe.3": "Vertrauen und Sichtbarkeit",
    "hilfebibliothek.gruppe.4": "Bibliothek",
    "hilfebibliothek.gruppe.5": "Fragen stellen",
    "hilfebibliothek.gruppe.6": "Pflege und Qualität",
    "hilfebibliothek.gruppe.7": "KI und Datenschutz",
    "hilfebibliothek.gruppe.8": "Verwaltung",
  },
  en: {
    "hilfebibliothek.oeffnen": "Explained in detail",
    "hilfebibliothek.teil.was": "What is it?",
    "hilfebibliothek.teil.wie": "How does it work?",
    "hilfebibliothek.teil.warum": "Why is it built this way?",
    "hilfebibliothek.teil.danach": "What happens next?",
    "hilfebibliothek.teil.missverstaendnisse": "Common misunderstandings",
    "hilfebibliothek.funktionen.titel": "Functions in detail",
    "hilfebibliothek.funktionen.untertitel":
      "Individual functions within the areas — each with what, how, why, what next and common misunderstandings. The search above includes them.",
    "hilfebibliothek.gruppe.0": "Basics",
    "hilfebibliothek.gruppe.1": "Capturing knowledge",
    "hilfebibliothek.gruppe.2": "Checking and approving",
    "hilfebibliothek.gruppe.3": "Confidence and visibility",
    "hilfebibliothek.gruppe.4": "Library",
    "hilfebibliothek.gruppe.5": "Asking questions",
    "hilfebibliothek.gruppe.6": "Upkeep and quality",
    "hilfebibliothek.gruppe.7": "AI and data protection",
    "hilfebibliothek.gruppe.8": "Administration",
  },
  nl: {
    "hilfebibliothek.oeffnen": "Uitgebreid uitgelegd",
    "hilfebibliothek.teil.was": "Wat is het?",
    "hilfebibliothek.teil.wie": "Hoe werkt het?",
    "hilfebibliothek.teil.warum": "Waarom is het zo gebouwd?",
    "hilfebibliothek.teil.danach": "Wat gebeurt er daarna?",
    "hilfebibliothek.teil.missverstaendnisse": "Veelvoorkomende misverstanden",
    "hilfebibliothek.funktionen.titel": "Functies uitgebreid",
    "hilfebibliothek.funktionen.untertitel":
      "Afzonderlijke functies binnen de onderdelen — telkens met wat, hoe, waarom, wat daarna en veelvoorkomende misverstanden. De zoekfunctie hierboven doorzoekt ze ook.",
    "hilfebibliothek.gruppe.0": "Basis",
    "hilfebibliothek.gruppe.1": "Kennis vastleggen",
    "hilfebibliothek.gruppe.2": "Controleren en vrijgeven",
    "hilfebibliothek.gruppe.3": "Vertrouwen en zichtbaarheid",
    "hilfebibliothek.gruppe.4": "Bibliotheek",
    "hilfebibliothek.gruppe.5": "Vragen stellen",
    "hilfebibliothek.gruppe.6": "Onderhoud en kwaliteit",
    "hilfebibliothek.gruppe.7": "AI en gegevensbescherming",
    "hilfebibliothek.gruppe.8": "Beheer",
  },
} satisfies Textmodul;
