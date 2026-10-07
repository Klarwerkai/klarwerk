// ================================================================================================
// MELDUNGSART · die Bezeichnungen der Meldungsarten, die nach dem Einfrieren der Wörterbücher dazukamen.
// ================================================================================================
//
// R-0894: Eskalationen und Rückgaben standen bis hierher nicht als eigene Art in der Glocke — die
// Eskalation lief als gewöhnlicher Konflikt, die Rückgabe als „Review für dich". `zeile` steht vor
// dem Titel in der Glocke, `art` rechts als Bereichsname in der „Für dich"-Karte.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "meldungsart.",
  legacySchluessel: [],
  de: {
    "meldungsart.eskalation.zeile": "Eskaliert",
    "meldungsart.eskalation.art": "Eskalation",
    "meldungsart.rueckgabe.zeile": "Zur Nacharbeit zurück",
    "meldungsart.rueckgabe.art": "Rückgabe",
  },
  en: {
    "meldungsart.eskalation.zeile": "Escalated",
    "meldungsart.eskalation.art": "Escalation",
    "meldungsart.rueckgabe.zeile": "Returned for rework",
    "meldungsart.rueckgabe.art": "Return",
  },
  nl: {
    "meldungsart.eskalation.zeile": "Geëscaleerd",
    "meldungsart.eskalation.art": "Escalatie",
    "meldungsart.rueckgabe.zeile": "Terug voor herwerking",
    "meldungsart.rueckgabe.art": "Teruggave",
  },
} satisfies Textmodul;
