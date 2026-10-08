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
  },
  en: {
    "hilfebibliothek.oeffnen": "Explained in detail",
    "hilfebibliothek.teil.was": "What is it?",
    "hilfebibliothek.teil.wie": "How does it work?",
    "hilfebibliothek.teil.warum": "Why is it built this way?",
    "hilfebibliothek.teil.danach": "What happens next?",
    "hilfebibliothek.teil.missverstaendnisse": "Common misunderstandings",
  },
  nl: {
    "hilfebibliothek.oeffnen": "Uitgebreid uitgelegd",
    "hilfebibliothek.teil.was": "Wat is het?",
    "hilfebibliothek.teil.wie": "Hoe werkt het?",
    "hilfebibliothek.teil.warum": "Waarom is het zo gebouwd?",
    "hilfebibliothek.teil.danach": "Wat gebeurt er daarna?",
    "hilfebibliothek.teil.missverstaendnisse": "Veelvoorkomende misverstanden",
  },
} satisfies Textmodul;
