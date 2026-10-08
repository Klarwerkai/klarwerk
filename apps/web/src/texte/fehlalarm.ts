// ================================================================================================
// R-1105 · FEHLALARM BEGRÜNDET SCHLIESSEN — die Texte des Begründungsfelds auf der Konfliktseite.
// ================================================================================================
//
// „Kein Widerspruch" schließt einen Befund erst mit der Begründung des Menschen. Solange sich die
// Inhalte beider Beiträge nicht ändern, kommt derselbe Vorschlag nicht wieder (Prüfgedächtnis,
// services/conflicts/src/pair-memory.ts).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "fehlalarm.",
  legacySchluessel: [],
  de: {
    "fehlalarm.platzhalter": "Warum ist das kein Widerspruch? (Begründung)",
    "fehlalarm.wirkung":
      "Der Befund wird als Fehlalarm geschlossen. Derselbe Vorschlag kommt nicht wieder, solange sich die Inhalte beider Beiträge nicht ändern.",
  },
  en: {
    "fehlalarm.platzhalter": "Why is this not a contradiction? (reason)",
    "fehlalarm.wirkung":
      "The finding is closed as a false alarm. The same suggestion will not come back as long as the content of both items stays unchanged.",
  },
  nl: {
    "fehlalarm.platzhalter": "Waarom is dit geen tegenstrijdigheid? (onderbouwing)",
    "fehlalarm.wirkung":
      "De bevinding wordt als vals alarm gesloten. Hetzelfde voorstel komt niet terug zolang de inhoud van beide bijdragen niet verandert.",
  },
} satisfies Textmodul;
