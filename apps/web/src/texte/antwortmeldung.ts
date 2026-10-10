// ================================================================================================
// ANTWORTMELDUNG · R-1089 / R-1721 — „Antwort falsch" oder „Quelle passt nicht" melden.
// ================================================================================================
//
// Die Meldung geht an die verantwortliche Person des zitierten Wissensobjekts, nicht in ein
// Sammelbecken. Die Quittung sagt, WOHIN sie ging (benannte verantwortliche Person oder ersatzweise
// der Autor), aber nicht, wer das ist. Die Texte versprechen keine Korrektur und keine Frist — sie
// sagen nur, was wirklich geschehen ist: die Meldung liegt bei dieser Person.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "antwortmeldung.",
  legacySchluessel: [],
  de: {
    "antwortmeldung.oeffnen": "Antwort melden",
    "antwortmeldung.titel": "Was stimmt nicht?",
    "antwortmeldung.grund.antwort-falsch": "Die Antwort ist falsch",
    "antwortmeldung.grund.quelle-passt-nicht": "Die Quelle passt nicht zur Antwort",
    "antwortmeldung.quelle": "Betroffene Quelle",
    "antwortmeldung.hinweis":
      "Die Meldung geht an die verantwortliche Person dieser Quelle. Deine Frage wird nicht mitgeschickt.",
    "antwortmeldung.absenden": "Melden",
    "antwortmeldung.laeuft": "Wird gemeldet …",
    "antwortmeldung.abbrechen": "Abbrechen",
    "antwortmeldung.quittung.titel": "Gemeldet · {{meldungId}}",
    "antwortmeldung.quittung.owner":
      "Deine Meldung zu „{{titel}}“ liegt seit {{zeit}} bei der verantwortlichen Person dieses Wissens.",
    "antwortmeldung.quittung.author-fallback":
      "Deine Meldung zu „{{titel}}“ liegt seit {{zeit}} beim Autor dieses Wissens — eine eigene verantwortliche Person ist nicht benannt.",
    "antwortmeldung.quittung.bereits":
      "Diese Quelle hattest du aus dieser Antwort schon so gemeldet; es wurde nichts doppelt zugestellt.",
    "antwortmeldung.meldung.antwort-falsch": "Antwort als falsch gemeldet",
    "antwortmeldung.meldung.quelle-passt-nicht": "Quelle passt nicht zur Antwort",
    "antwortmeldung.meldungArt": "Meldung",
  },
  en: {
    "antwortmeldung.oeffnen": "Report answer",
    "antwortmeldung.titel": "What is wrong?",
    "antwortmeldung.grund.antwort-falsch": "The answer is wrong",
    "antwortmeldung.grund.quelle-passt-nicht": "The source does not fit the answer",
    "antwortmeldung.quelle": "Affected source",
    "antwortmeldung.hinweis":
      "The report goes to the person responsible for this source. Your question is not sent along.",
    "antwortmeldung.absenden": "Report",
    "antwortmeldung.laeuft": "Reporting …",
    "antwortmeldung.abbrechen": "Cancel",
    "antwortmeldung.quittung.titel": "Reported · {{meldungId}}",
    "antwortmeldung.quittung.owner":
      "Your report on “{{titel}}” has been with the person responsible for this knowledge since {{zeit}}.",
    "antwortmeldung.quittung.author-fallback":
      "Your report on “{{titel}}” has been with the author of this knowledge since {{zeit}} — no separate responsible person is named.",
    "antwortmeldung.quittung.bereits":
      "You had already reported this source from this answer in the same way; nothing was delivered twice.",
    "antwortmeldung.meldung.antwort-falsch": "Answer reported as wrong",
    "antwortmeldung.meldung.quelle-passt-nicht": "Source does not fit the answer",
    "antwortmeldung.meldungArt": "Report",
  },
  nl: {
    "antwortmeldung.oeffnen": "Antwoord melden",
    "antwortmeldung.titel": "Wat klopt er niet?",
    "antwortmeldung.grund.antwort-falsch": "Het antwoord is fout",
    "antwortmeldung.grund.quelle-passt-nicht": "De bron past niet bij het antwoord",
    "antwortmeldung.quelle": "Betreffende bron",
    "antwortmeldung.hinweis":
      "De melding gaat naar de verantwoordelijke voor deze bron. Je vraag wordt niet meegestuurd.",
    "antwortmeldung.absenden": "Melden",
    "antwortmeldung.laeuft": "Wordt gemeld …",
    "antwortmeldung.abbrechen": "Annuleren",
    "antwortmeldung.quittung.titel": "Gemeld · {{meldungId}}",
    "antwortmeldung.quittung.owner":
      "Je melding over ‘{{titel}}’ ligt sinds {{zeit}} bij de verantwoordelijke voor deze kennis.",
    "antwortmeldung.quittung.author-fallback":
      "Je melding over ‘{{titel}}’ ligt sinds {{zeit}} bij de auteur van deze kennis — er is geen aparte verantwoordelijke benoemd.",
    "antwortmeldung.quittung.bereits":
      "Je had deze bron uit dit antwoord al zo gemeld; er is niets dubbel bezorgd.",
    "antwortmeldung.meldung.antwort-falsch": "Antwoord als fout gemeld",
    "antwortmeldung.meldung.quelle-passt-nicht": "Bron past niet bij het antwoord",
    "antwortmeldung.meldungArt": "Melding",
  },
} satisfies Textmodul;
