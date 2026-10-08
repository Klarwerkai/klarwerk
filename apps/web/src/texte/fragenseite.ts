// ================================================================================================
// R-0286 · DIE FRAGENSEITE: FELD OBEN, ANTWORT DIREKT DARUNTER — UND DER SATZ, DER DAS BESCHREIBT.
// ================================================================================================
//
// Seit Nacharbeit 2 steht die Antwort sichtbar UNTER dem Fragefeld (vorher, nach Zielbild H5,
// darüber). Der Wiederaufnahme-Satz für „Entwurf und Antwort" sagte „darüber deine zuletzt
// angezeigte Antwort" (`ask.wiederaufnahme.beides`) und wäre damit falsch geworden. Er steht hier
// mit der neuen Lage; der Grundbestand in `woerterbuch/` bleibt Byte für Byte unverändert
// (`tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`).
//
// R-0348 · der Gesprächsfaden über dem Fragefeld (`fadenTitel`, `fadenNeu`): die nächste Frage
// knüpft an, „Neues Thema beginnen" fängt bewusst neu an. Kein Chatbot-Versprechen — gesagt wird
// nur, dass die Quellen im Zusammenhang gesucht werden.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "fragenseite.",
  legacySchluessel: [],
  de: {
    "fragenseite.wiederaufnahmeBeides":
      "Hier kannst du weitermachen: Dein noch nicht gesendeter Entwurf steht wieder im Fragefeld, darunter deine zuletzt angezeigte Antwort vom {{zeit}}. Sie wurde nicht neu erzeugt.",
    "fragenseite.fadenTitel":
      "Du kannst nachfragen: Deine nächste Frage knüpft an dieses Gespräch an, Klara sucht die Quellen im Zusammenhang.",
    "fragenseite.fadenNeu": "Neues Thema beginnen",
  },
  en: {
    "fragenseite.wiederaufnahmeBeides":
      "Pick up where you left off: your unsent draft is back in the question field, with the answer you last saw, from {{zeit}}, below it. It was not generated again.",
    "fragenseite.fadenTitel":
      "You can follow up: your next question builds on this conversation, and Klara looks for sources in context.",
    "fragenseite.fadenNeu": "Start a new topic",
  },
  nl: {
    "fragenseite.wiederaufnahmeBeides":
      "Hier kun je verdergaan: je nog niet verzonden concept staat weer in het vraagveld, daaronder het antwoord dat je het laatst zag, van {{zeit}}. Het is niet opnieuw gegenereerd.",
    "fragenseite.fadenTitel":
      "Je kunt doorvragen: je volgende vraag bouwt voort op dit gesprek en Klara zoekt de bronnen in samenhang.",
    "fragenseite.fadenNeu": "Nieuw onderwerp beginnen",
  },
} satisfies Textmodul;
