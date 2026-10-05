// ================================================================================================
// D5 · DIE TEXTE DER ADMINISTRATIVEN KI-ABSCHALTUNG AUF DER FRAGEFLÄCHE.
// ================================================================================================
//
// Hat der Administrator die KI abgeschaltet (gespeicherte Adminwahl „deterministisch" für die
// Aufgabe `answer`), meldet der Server das ausdrücklich: im öffentlichen Status als
// `kiAbgeschaltet` und am Frageweg als 503 `KI_ABGESCHALTET`. Diese Sätze sind die Auskunft dazu —
// GETRENNT von „KI nicht verfügbar" (`ai.unavailable.hint`), das eine Störung oder ein fehlendes
// Modell meint. Die beiden Lagen dürfen sich nicht gleich lesen: eine Störung geht vorüber, eine
// Abschaltung ist eine Entscheidung.
//
// Kein Satz nennt etwas aus dem Bestand. Jeder sagt, was weiter geht: Bibliothek und Originale nach
// den bestehenden Leserechten — die Abschaltung nimmt niemandem ein Leserecht.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "d5kiaus.",
  legacySchluessel: [],
  de: {
    "d5kiaus.hinweis":
      "Der Administrator hat die KI abgeschaltet. Fragen an Klara werden derzeit nicht beantwortet. Die Bibliothek und die Originale bleiben nach Ihren Leserechten nutzbar.",
    "d5kiaus.titel": "Die KI ist abgeschaltet.",
    "d5kiaus.text":
      "Der Administrator hat die KI abgeschaltet. Ihre Frage wurde nicht beantwortet, und dafür wurden keine Inhalte gelesen. Die Bibliothek und die Originale bleiben nach Ihren Leserechten nutzbar.",
  },
  en: {
    "d5kiaus.hinweis":
      "The administrator has switched AI off. Questions to Klara are currently not answered. The library and the originals remain available according to your read permissions.",
    "d5kiaus.titel": "AI is switched off.",
    "d5kiaus.text":
      "The administrator has switched AI off. Your question was not answered, and no content was read for it. The library and the originals remain available according to your read permissions.",
  },
  nl: {
    "d5kiaus.hinweis":
      "De beheerder heeft AI uitgeschakeld. Vragen aan Klara worden momenteel niet beantwoord. De bibliotheek en de originelen blijven beschikbaar volgens uw leesrechten.",
    "d5kiaus.titel": "AI is uitgeschakeld.",
    "d5kiaus.text":
      "De beheerder heeft AI uitgeschakeld. Uw vraag is niet beantwoord, en daarvoor is geen inhoud gelezen. De bibliotheek en de originelen blijven beschikbaar volgens uw leesrechten.",
  },
} satisfies Textmodul;
