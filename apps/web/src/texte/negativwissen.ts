// ================================================================================================
// R-1664 / R-2179 / R-2180 · LERNEFFEKT GEFÜHRT DOKUMENTIEREN (Wissensart Negativwissen).
// ================================================================================================
//
// Die Texte des geführten Erfassungsblocks (`components/erfassen/NegativwissenFuehrung.tsx`) und
// seiner Anzeige am Wissensobjekt (`components/ko/NegativwissenAnzeige.tsx`). UX-Regel der Quelle
// (Addendum:281): keine beschämende Sprache — „Lerneffekt dokumentieren", nicht „Fehler melden".
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "negativwissen.",
  legacySchluessel: [],
  de: {
    "negativwissen.einstieg": "Lerneffekt dokumentieren",
    "negativwissen.einstiegHinweis":
      "Was hat nicht funktioniert, und was sollten wir künftig vermeiden? Erfahrung sichern.",
    "negativwissen.titel": "Lerneffekt dokumentieren",
    "negativwissen.hinweis":
      "Die Kernaussage beschreibt, was passiert ist. Die Fragen hier halten fest, woran man es künftig früher erkennt und wie man es vermeidet. Alles ist freiwillig — nenne keine Namen.",
    "negativwissen.q.incidentTrigger": "Was hat es ausgelöst?",
    "negativwissen.q.mistakePattern": "Was wurde vorher gemacht — welche Annahme war falsch?",
    "negativwissen.q.impact": "Welche Auswirkungen hatte es?",
    "negativwissen.q.recoveryAction": "Wie wurde es erkannt und behoben?",
    "negativwissen.q.avoidanceRule": "Was sollten wir künftig vermeiden?",
    "negativwissen.warnsignale": "Welche Warnsignale gab es?",
    "negativwissen.warnsignaleHinweis": "Ein Warnsignal je Zeile.",
    "negativwissen.bezug": "Wen oder was betraf es?",
    "negativwissen.bezug.personen": "Personen",
    "negativwissen.bezug.kunden": "Kunden",
    "negativwissen.bezug.produktion": "Produktion / Anlage",
    "negativwissen.bezug.qualitaet": "Qualität / Produkt",
    "negativwissen.bezugStufe":
      "Mit diesem Bezug ist der Eintrag mindestens vertraulich und geht nicht in externe Kontexte.",
    "negativwissen.stufeGesperrt": "nicht wählbar bei diesem Bezug",
    "negativwissen.anzeigeTitel": "Lerneffekt",
  },
  en: {
    "negativwissen.einstieg": "Document a lesson learned",
    "negativwissen.einstiegHinweis":
      "What did not work, and what should we avoid in future? Secure the experience.",
    "negativwissen.titel": "Document a lesson learned",
    "negativwissen.hinweis":
      "The key statement describes what happened. The questions here record how to recognise it earlier next time and how to avoid it. Everything is optional — do not name anyone.",
    "negativwissen.q.incidentTrigger": "What triggered it?",
    "negativwissen.q.mistakePattern": "What was done beforehand — which assumption was wrong?",
    "negativwissen.q.impact": "What impact did it have?",
    "negativwissen.q.recoveryAction": "How was it detected and resolved?",
    "negativwissen.q.avoidanceRule": "What should we avoid in future?",
    "negativwissen.warnsignale": "What warning signs were there?",
    "negativwissen.warnsignaleHinweis": "One warning sign per line.",
    "negativwissen.bezug": "Who or what was affected?",
    "negativwissen.bezug.personen": "People",
    "negativwissen.bezug.kunden": "Customers",
    "negativwissen.bezug.produktion": "Production / equipment",
    "negativwissen.bezug.qualitaet": "Quality / product",
    "negativwissen.bezugStufe":
      "With this reference the entry is at least confidential and never goes into external contexts.",
    "negativwissen.stufeGesperrt": "not available with this reference",
    "negativwissen.anzeigeTitel": "Lesson learned",
  },
  nl: {
    "negativwissen.einstieg": "Leereffect vastleggen",
    "negativwissen.einstiegHinweis":
      "Wat werkte niet, en wat moeten we in de toekomst vermijden? Ervaring vastleggen.",
    "negativwissen.titel": "Leereffect vastleggen",
    "negativwissen.hinweis":
      "De kernuitspraak beschrijft wat er gebeurde. De vragen hier leggen vast hoe je het de volgende keer eerder herkent en hoe je het vermijdt. Alles is vrijwillig — noem geen namen.",
    "negativwissen.q.incidentTrigger": "Wat was de aanleiding?",
    "negativwissen.q.mistakePattern": "Wat werd vooraf gedaan — welke aanname was onjuist?",
    "negativwissen.q.impact": "Welke gevolgen had het?",
    "negativwissen.q.recoveryAction": "Hoe werd het ontdekt en opgelost?",
    "negativwissen.q.avoidanceRule": "Wat moeten we in de toekomst vermijden?",
    "negativwissen.warnsignale": "Welke waarschuwingssignalen waren er?",
    "negativwissen.warnsignaleHinweis": "Eén waarschuwingssignaal per regel.",
    "negativwissen.bezug": "Wie of wat was betrokken?",
    "negativwissen.bezug.personen": "Personen",
    "negativwissen.bezug.kunden": "Klanten",
    "negativwissen.bezug.produktion": "Productie / installatie",
    "negativwissen.bezug.qualitaet": "Kwaliteit / product",
    "negativwissen.bezugStufe":
      "Met deze betrokkenheid is de invoer minstens vertrouwelijk en gaat hij nooit naar externe contexten.",
    "negativwissen.stufeGesperrt": "niet kiesbaar bij deze betrokkenheid",
    "negativwissen.anzeigeTitel": "Leereffect",
  },
} satisfies Textmodul;
