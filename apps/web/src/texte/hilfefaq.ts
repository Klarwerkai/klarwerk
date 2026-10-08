// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0935 / R-0924 — DIE SAMMLUNG HÄUFIGER FRAGEN AUF DER HILFESEITE.
// ================================================================================================
//
// Die Fragen und Antworten selbst stehen in `lib/hilfeFaq.ts` — in Anwendersprache und DE/EN/NL
// (P-HILFE-ANWENDERSPRACHE). Hier liegen nur die Rahmentexte der Fläche.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "hilfefaq.",
  legacySchluessel: [],
  de: {
    "hilfefaq.titel": "Häufige Fragen",
    "hilfefaq.untertitel":
      "Ausformulierte Antworten auf die Fragen, die beim Arbeiten mit KLARWERK am häufigsten aufkommen — nach Bereichen geordnet. Die Suche oben durchsucht sie mit.",
  },
  en: {
    "hilfefaq.titel": "Frequently asked questions",
    "hilfefaq.untertitel":
      "Written-out answers to the questions that come up most often when working with KLARWERK — ordered by area. The search above includes them.",
  },
  nl: {
    "hilfefaq.titel": "Veelgestelde vragen",
    "hilfefaq.untertitel":
      "Uitgeschreven antwoorden op de vragen die bij het werken met KLARWERK het vaakst opkomen — geordend per onderdeel. De zoekfunctie hierboven doorzoekt ze ook.",
  },
} satisfies Textmodul;
