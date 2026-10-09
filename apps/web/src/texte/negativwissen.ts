// ================================================================================================
// NEGATIVWISSEN — ZWEI NUTZERWEGE, EIN TEXTMODUL.
// ================================================================================================
//
// 1) AUFNAHME 20260922 · NEGATIVWISSEN-HINWEIS (R-1629) — die Texte des Hinweises beim Erfassen
//    (`negativwissen.titel`, `.einleitung`, `.grenze`). Der Hinweis erscheint, wenn der Entwurf
//    einem Eintrag der Wissensart „Negativwissen" ähnelt (services/app/src/knowledge-check.ts,
//    `negativwissenAuskunft`). Belegt ist nur die Textnähe — die Texte sagen deshalb „bitte vorher
//    lesen" und fällen kein Urteil über den Entwurf.
//
// 2) R-1664 / R-2179 / R-2180 · LERNEFFEKT GEFÜHRT DOKUMENTIEREN — die Texte des geführten
//    Erfassungsblocks (`components/erfassen/NegativwissenFuehrung.tsx`) und seiner Anzeige am
//    Wissensobjekt (`components/ko/NegativwissenAnzeige.tsx`). UX-Regel der Quelle (Addendum:281):
//    keine beschämende Sprache — „Lerneffekt dokumentieren", nicht „Fehler melden".
//    Bei der Zusammenführung mit (1) umbenannt, weil dieselben Namen dort schon eine andere
//    Bedeutung tragen: der Blocktitel heißt `negativwissen.fuehrungTitel`, die Grenzmeldungen
//    `negativwissen.obergrenze.*` (`negativwissen.grenze` ist der Hinweissatz aus 1).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "negativwissen.",
  legacySchluessel: [],
  de: {
    "negativwissen.titel": "Achtung: Das wurde schon einmal probiert",
    "negativwissen.einleitung":
      "Dein Text ähnelt einem Weg, der als Negativwissen festgehalten ist („haben wir probiert, ging nicht“). Lies nach, warum er nicht funktioniert hat, bevor du ihn erneut vorschlägst.",
    "negativwissen.grenze":
      "Der Hinweis beruht auf Textähnlichkeit. Ob du wirklich denselben Weg meinst, entscheidest du.",
    "negativwissen.einstieg": "Lerneffekt dokumentieren",
    "negativwissen.einstiegHinweis":
      "Was hat nicht funktioniert, und was sollten wir künftig vermeiden? Erfahrung sichern.",
    "negativwissen.fuehrungTitel": "Lerneffekt dokumentieren",
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
    "negativwissen.obergrenze.zeichen":
      "Zu lang: {{ist}} Zeichen, höchstens {{max}}. Bitte kürzen.",
    "negativwissen.obergrenze.warnsignal":
      "Ein Warnsignal hat {{ist}} Zeichen, höchstens {{max}} je Zeile. Bitte kürzen.",
    "negativwissen.obergrenze.anzahl":
      "{{ist}} Warnsignale, höchstens {{max}}. Bitte zusammenfassen.",
    "negativwissen.obergrenze.gesperrt":
      "Sichern und Einreichen sind gesperrt, bis die markierten Angaben in die Grenzen passen. Deine Eingaben bleiben erhalten — es wird nichts abgeschnitten.",
  },
  en: {
    "negativwissen.titel": "Heads-up: this has been tried before",
    "negativwissen.einleitung":
      "Your text resembles an approach recorded as negative knowledge (“we tried this, it did not work”). Read why it failed before you propose it again.",
    "negativwissen.grenze":
      "This hint is based on text similarity. Whether you really mean the same approach is your call.",
    "negativwissen.einstieg": "Document a lesson learned",
    "negativwissen.einstiegHinweis":
      "What did not work, and what should we avoid in future? Secure the experience.",
    "negativwissen.fuehrungTitel": "Document a lesson learned",
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
    "negativwissen.obergrenze.zeichen":
      "Too long: {{ist}} characters, at most {{max}}. Please shorten.",
    "negativwissen.obergrenze.warnsignal":
      "A warning sign has {{ist}} characters, at most {{max}} per line. Please shorten.",
    "negativwissen.obergrenze.anzahl":
      "{{ist}} warning signs, at most {{max}}. Please combine them.",
    "negativwissen.obergrenze.gesperrt":
      "Saving and submitting are blocked until the marked entries fit the limits. Your input is kept — nothing is cut off.",
  },
  nl: {
    "negativwissen.titel": "Let op: dit is al eens geprobeerd",
    "negativwissen.einleitung":
      "Je tekst lijkt op een aanpak die als negatieve kennis is vastgelegd (‘hebben we geprobeerd, werkte niet’). Lees waarom het niet werkte voordat je het opnieuw voorstelt.",
    "negativwissen.grenze":
      "Deze hint is gebaseerd op tekstgelijkenis. Of je echt dezelfde aanpak bedoelt, bepaal je zelf.",
    "negativwissen.einstieg": "Leereffect vastleggen",
    "negativwissen.einstiegHinweis":
      "Wat werkte niet, en wat moeten we in de toekomst vermijden? Ervaring vastleggen.",
    "negativwissen.fuehrungTitel": "Leereffect vastleggen",
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
    "negativwissen.obergrenze.zeichen":
      "Te lang: {{ist}} tekens, hoogstens {{max}}. Graag inkorten.",
    "negativwissen.obergrenze.warnsignal":
      "Een waarschuwingssignaal heeft {{ist}} tekens, hoogstens {{max}} per regel. Graag inkorten.",
    "negativwissen.obergrenze.anzahl":
      "{{ist}} waarschuwingssignalen, hoogstens {{max}}. Graag samenvoegen.",
    "negativwissen.obergrenze.gesperrt":
      "Opslaan en indienen zijn geblokkeerd tot de gemarkeerde gegevens binnen de grenzen passen. Je invoer blijft behouden — er wordt niets afgekapt.",
  },
} satisfies Textmodul;
