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
    // produkt:20261010:antwort-beanstandung-korrektur
    "antwortmeldung.aussage": "Betroffene Aussage",
    "antwortmeldung.aussageKeine": "Die Antwort insgesamt (keine bestimmte Aussage)",
    "antwortmeldung.fundstelle": "Betroffene Fundstelle",
    "antwortmeldung.fundstelleKeine": "Keine bestimmte Fundstelle",
    "antwortmeldung.quelleFehlt": "Für diese Aussage fehlt eine Quelle",
    "antwortmeldung.begruendung": "Kurze Begründung (höchstens {{max}} Zeichen)",
    "antwortmeldung.begruendungHinweis":
      "Nur fachlich: keine personenbezogenen oder vertraulichen Angaben.",
    "antwortmeldung.hinweisBeanstandung":
      "Die Aussage, ihre Fassung und deine Begründung gehen in einen eigenen Vorgang an die zuständige Person. Deine Frage und der übrige Antworttext werden nicht mitgeschickt.",
    "antwortmeldung.quittung.niemand":
      "Deine Meldung liegt seit {{zeit}} als offener Vorgang vor — ohne Quelle gibt es noch keine verantwortliche Person.",
    "antwortmeldung.beanstandung.angelegt": "Ein eigener Vorgang wurde angelegt.",
    "antwortmeldung.beanstandung.zusammengefuehrt":
      "Diese Aussage war schon beanstandet; deine Meldung ist dem Vorgang zugeführt.",
    "antwortmeldung.beanstandung.zugeordnet": "Eine zuständige Person ist zugeordnet.",
    "antwortmeldung.beanstandung.offen":
      "Noch ist niemand zuständig — der Vorgang bleibt offen sichtbar.",
    "antwortmeldung.beanstandung.fassung": "Bezug: Fassung {{fassung}} der Quelle.",
    "antwortmeldung.beanstandung.vorgang": "Vorgang verfolgen",
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
    "antwortmeldung.aussage": "Affected statement",
    "antwortmeldung.aussageKeine": "The answer as a whole (no specific statement)",
    "antwortmeldung.fundstelle": "Affected passage",
    "antwortmeldung.fundstelleKeine": "No specific passage",
    "antwortmeldung.quelleFehlt": "A source is missing for this statement",
    "antwortmeldung.begruendung": "Short reason (at most {{max}} characters)",
    "antwortmeldung.begruendungHinweis":
      "Subject matter only: no personal or confidential details.",
    "antwortmeldung.hinweisBeanstandung":
      "The statement, its version and your reason go into a separate process for the responsible person. Your question and the rest of the answer are not sent along.",
    "antwortmeldung.quittung.niemand":
      "Your report has been an open process since {{zeit}} — without a source there is no responsible person yet.",
    "antwortmeldung.beanstandung.angelegt": "A separate process was created.",
    "antwortmeldung.beanstandung.zusammengefuehrt":
      "This statement had already been disputed; your report was added to that process.",
    "antwortmeldung.beanstandung.zugeordnet": "A responsible person is assigned.",
    "antwortmeldung.beanstandung.offen":
      "Nobody is responsible yet — the process stays visibly open.",
    "antwortmeldung.beanstandung.fassung": "Reference: version {{fassung}} of the source.",
    "antwortmeldung.beanstandung.vorgang": "Follow the process",
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
    "antwortmeldung.aussage": "Betreffende uitspraak",
    "antwortmeldung.aussageKeine": "Het antwoord als geheel (geen bepaalde uitspraak)",
    "antwortmeldung.fundstelle": "Betreffende vindplaats",
    "antwortmeldung.fundstelleKeine": "Geen bepaalde vindplaats",
    "antwortmeldung.quelleFehlt": "Voor deze uitspraak ontbreekt een bron",
    "antwortmeldung.begruendung": "Korte motivering (hoogstens {{max}} tekens)",
    "antwortmeldung.begruendungHinweis":
      "Alleen inhoudelijk: geen persoonlijke of vertrouwelijke gegevens.",
    "antwortmeldung.hinweisBeanstandung":
      "De uitspraak, de versie en je motivering gaan in een eigen verloop naar de verantwoordelijke. Je vraag en de rest van het antwoord worden niet meegestuurd.",
    "antwortmeldung.quittung.niemand":
      "Je melding staat sinds {{zeit}} als open verloop — zonder bron is er nog geen verantwoordelijke.",
    "antwortmeldung.beanstandung.angelegt": "Er is een eigen verloop aangemaakt.",
    "antwortmeldung.beanstandung.zusammengefuehrt":
      "Deze uitspraak was al betwist; je melding is aan dat verloop toegevoegd.",
    "antwortmeldung.beanstandung.zugeordnet": "Er is een verantwoordelijke toegewezen.",
    "antwortmeldung.beanstandung.offen":
      "Nog niemand is verantwoordelijk — het verloop blijft zichtbaar open.",
    "antwortmeldung.beanstandung.fassung": "Verwijzing: versie {{fassung}} van de bron.",
    "antwortmeldung.beanstandung.vorgang": "Verloop volgen",
  },
} satisfies Textmodul;
