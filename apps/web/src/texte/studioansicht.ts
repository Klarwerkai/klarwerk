// ================================================================================================
// STUDIOANSICHT · DAS STUDIO IST EINE ZWEITE ANSICHT DESSELBEN BLATTS (R-1057, Auftrag
// gesamt-wissen-editor).
// ================================================================================================
//
// „Einfach" im Knowledge Studio nimmt den Studio-Stand mit ins Blatt, statt nach dem Verwerfen zu
// fragen (`components/KnowledgeInputStudio.tsx`, `zurEinfachenAnsicht`). Die vorhandenen
// `studio.*`-Texte bleiben wörtlich stehen; neu sind nur der Hinweis am Schalter und die beiden
// Knöpfe für den einen Fall, in dem draußen eine andere Fassung entstanden ist. Den Konfliktsatz
// selbst liefert weiter `studio.fremdfassung.hinweis` — derselbe Satz wie über „Übernehmen".
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "studioansicht.",
  legacySchluessel: [],
  de: {
    "studioansicht.wechselNimmtMit":
      "Zur einfachen Ansicht wechseln. Dein Stand aus dem Studio kommt mit ins Blatt; nichts wird verworfen oder gespeichert.",
    "studioansicht.meinenStandMitnehmen": "Meinen Stand mitnehmen",
    "studioansicht.imStudioBleiben": "Im Studio bleiben",
  },
  en: {
    "studioansicht.wechselNimmtMit":
      "Switch to the simple view. Your studio version comes along to the sheet; nothing is discarded or saved.",
    "studioansicht.meinenStandMitnehmen": "Take my version along",
    "studioansicht.imStudioBleiben": "Stay in the studio",
  },
  nl: {
    "studioansicht.wechselNimmtMit":
      "Naar de eenvoudige weergave. Je versie uit de studio gaat mee naar het blad; niets wordt verworpen of opgeslagen.",
    "studioansicht.meinenStandMitnehmen": "Mijn versie meenemen",
    "studioansicht.imStudioBleiben": "In de studio blijven",
  },
} satisfies Textmodul;
