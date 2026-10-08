// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0935 / R-0924 — DIE SAMMLUNG HÄUFIGER FRAGEN AUF DER HILFESEITE.
// ================================================================================================
//
// Die 77 ausformulierten Antworten (`lib/faqContent.ts`, Berater-Lieferung 3a) waren bis hierher
// nur über Klara erreichbar. R-0935 verlangt sie als Sammlung auf der Hilfeseite. Die Antworten
// selbst stehen weiter WÖRTLICH in `faqContent.ts`; hier liegen nur die Rahmentexte der Fläche.
//
// `hilfefaq.nurDeutsch` ist der ehrliche Satz für EN/NL: die Antworten liegen nur deutsch vor
// (die EN-Fassung ist Lieferung 3b, `faqContent.ts:1-3`). Die Fläche täuscht keine Parität vor —
// dieselbe Regel wie `allFaqEntries` in `lib/klaraRegistry.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "hilfefaq.",
  legacySchluessel: [],
  de: {
    "hilfefaq.titel": "Häufige Fragen",
    "hilfefaq.untertitel":
      "Ausformulierte Antworten auf die Fragen, die beim Arbeiten mit KLARWERK am häufigsten aufkommen — nach Bereichen geordnet. Die Suche oben durchsucht sie mit.",
    "hilfefaq.nurDeutsch":
      "Die häufigen Fragen liegen bisher nur auf Deutsch vor. Wenn du sie lesen möchtest, stelle die Sprache in deinem Profil auf Deutsch.",
  },
  en: {
    "hilfefaq.titel": "Frequently asked questions",
    "hilfefaq.untertitel":
      "Written-out answers to the questions that come up most often when working with KLARWERK — ordered by area. The search above includes them.",
    "hilfefaq.nurDeutsch":
      "The frequently asked questions are currently only available in German. To read them, set the language in your profile to German.",
  },
  nl: {
    "hilfefaq.titel": "Veelgestelde vragen",
    "hilfefaq.untertitel":
      "Uitgeschreven antwoorden op de vragen die bij het werken met KLARWERK het vaakst opkomen — geordend per onderdeel. De zoekfunctie hierboven doorzoekt ze ook.",
    "hilfefaq.nurDeutsch":
      "De veelgestelde vragen zijn voorlopig alleen in het Duits beschikbaar. Wil je ze lezen, zet dan de taal in je profiel op Duits.",
  },
} satisfies Textmodul;
