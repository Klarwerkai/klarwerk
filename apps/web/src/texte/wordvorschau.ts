// ================================================================================================
// Aufnahme `gesamt-hilfen` · N-0042 — „KLARA IN WORD" IST AUF DEM WEBWEG EINE VORSCHAU.
// ================================================================================================
//
// Die Fläche hinter dem Menüpunkt (`components/KlaraPathTeaser.tsx`) trägt „Demnächst" und sagt
// „Verfügbar ist das noch nicht." N-0042 verlangt für genau diesen Fall: „den Menüeintrag
// entsprechend als Vorschau kennzeichnen" und einen konkreten nächsten Schritt mit benannter
// Anlaufstelle oder Voraussetzung.
//
// · `wordvorschau.menu` — die Beschriftung beider Menüpunkte (Start „Mehr zu dieser Seite" und
//   Erfassen „…"). NEUER Schlüssel statt geändertem Wert: `start.menu.klara` und
//   `erfassen.mehr.klara` stehen im eingefrorenen Textschnappschuss (`tests/i18n-textmodule`).
// · `wordvorschau.anlaufstelle` — der nächste Schritt für Fragen zum Zugang. Die Anlaufstelle ist
//   der Supportweg DIESER Installation, den der Betreiber festlegt und den die Hilfeseite oben
//   zeigt (R-1064, `pages/Help.tsx`, Karte `hilfe-support`). Der Satz behauptet KEINE Verfügbarkeit
//   und keinen Freischaltweg — beides ist hier nicht entschieden.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wordvorschau.",
  legacySchluessel: [],
  de: {
    "wordvorschau.menu": "Klara in Word (Vorschau)",
    "wordvorschau.anlaufstelle":
      "Fragen zum Zugang zu Klara in Word beantwortet der Support dieser Installation. Wie du ihn erreichst, steht oben auf der Hilfeseite.",
  },
  en: {
    "wordvorschau.menu": "Klara in Word (preview)",
    "wordvorschau.anlaufstelle":
      "Questions about access to Klara in Word are answered by the support for this installation. How to reach it is shown at the top of the help page.",
  },
  nl: {
    "wordvorschau.menu": "Klara in Word (voorvertoning)",
    "wordvorschau.anlaufstelle":
      "Vragen over toegang tot Klara in Word beantwoordt de support van deze installatie. Hoe je die bereikt, staat bovenaan de helppagina.",
  },
} satisfies Textmodul;
