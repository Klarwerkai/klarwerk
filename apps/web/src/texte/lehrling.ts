// ================================================================================================
// R-0957 / R-1926 · DAS LEHRLINGSBILD IM INTERVIEWWEG — AN BELEGTES VERHALTEN GEBUNDEN.
// ================================================================================================
//
// „Nicht ‚dokumentiere dein Wissen', sondern ‚bilde einen Lehrling aus'." Der Interviewweg beim
// Erfassen IST der fragende Lehrling; bis hierher war er eine Funktion ohne Rahmen. Der Satz steht
// über dem Knopf „Interview starten" (`pages/Capture.tsx`) und sagt drei Dinge, die das Produkt
// heute einlöst:
//   1. die KI stellt Rückfragen                           (Interviewweg, `capture.ivStartLead`),
//   2. in den Bestand kommt nur, was die Person einreicht, (Entwurf → Einreichen),
//      und erst die Teamprüfung macht es zu gesichertem Wissen,
//   3. Korrekturen fließen NICHT in ein Modell zurück — es gibt keine Lernschleife
//      (`tests/app/learning-claim-guard.test.ts`, D-1: keine belegte Lernmechanik).
// Wachsen darf deshalb nur das gemeinsam gepflegte Wissen, nicht „das System".
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "lehrling.",
  legacySchluessel: [],
  de: {
    "lehrling.interview.rahmen":
      "So arbeitet das Interview: Die KI fragt nach wie ein Lehrling, du antwortest in deinen Worten. In den Bestand kommt nur, was du selbst einreichst, und erst die Prüfung im Team macht es zu gesichertem Wissen. Deine Korrekturen fließen nicht in ein Modell zurück — was wächst, ist das gemeinsam gepflegte Wissen.",
  },
  en: {
    "lehrling.interview.rahmen":
      "How the interview works: the AI asks follow-up questions like an apprentice, and you answer in your own words. Only what you submit yourself goes into the knowledge base, and only the team review makes it confirmed knowledge. Your corrections do not flow back into a model — what grows is the knowledge you maintain together.",
  },
  nl: {
    "lehrling.interview.rahmen":
      "Zo werkt het interview: de AI stelt vervolgvragen zoals een leerling, en jij antwoordt in je eigen woorden. In de kennisbank komt alleen wat je zelf indient, en pas de controle in het team maakt er geborgde kennis van. Je correcties vloeien niet terug in een model — wat groeit, is de kennis die jullie samen bijhouden.",
  },
} satisfies Textmodul;
