// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DEMO-ERKLAERMODUS — DER EINSTIEG IN DEN VORFÜHRWEG.
// ================================================================================================
//
// Die Karte „KLARWERK vorführen“ auf der Hilfeseite (`pages/Help.tsx`) öffnet den geführten
// Vorführweg `public/demonstration/vorfuehrweg.html` in einem eigenen Fenster — gedacht für den
// zweiten Bildschirm. Die Seite selbst gibt es auf Deutsch und Englisch; der niederländische Text
// hier sagt das, statt eine niederländische Fassung zu versprechen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "vorfuehrweg.",
  legacySchluessel: [],
  de: {
    "vorfuehrweg.hilfe.titel": "KLARWERK vorführen",
    "vorfuehrweg.hilfe.text":
      "Ein geführter Vorführweg in neun Stationen für den zweiten Bildschirm: je Station Ziel, Handlung und erwartetes Ergebnis, dazu ein Link an genau die Stelle in KLARWERK und eine Bildschirmansicht. Auf Deutsch und Englisch.",
    "vorfuehrweg.hilfe.link": "Vorführweg öffnen",
  },
  en: {
    "vorfuehrweg.hilfe.titel": "Present KLARWERK",
    "vorfuehrweg.hilfe.text":
      "A guided presentation route in nine stations for the second screen: for each station the goal, the action and the expected result, plus a link to exactly that place in KLARWERK and a screen view. In German and English.",
    "vorfuehrweg.hilfe.link": "Open presentation route",
  },
  nl: {
    "vorfuehrweg.hilfe.titel": "KLARWERK demonstreren",
    "vorfuehrweg.hilfe.text":
      "Een begeleide demonstratieroute in negen stations voor het tweede scherm: per station het doel, de handeling en het verwachte resultaat, met een link naar precies die plek in KLARWERK en een schermweergave. Beschikbaar in het Duits en het Engels.",
    "vorfuehrweg.hilfe.link": "Demonstratieroute openen",
  },
} satisfies Textmodul;
