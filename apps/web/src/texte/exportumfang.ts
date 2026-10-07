// ================================================================================================
// EXPORTUMFANG · DER EXPORT DER BIBLIOTHEK NENNT, WAS ER HERUNTERLÄDT.
// ================================================================================================
//
// Posten „Exportumfang" aus REVIEW26-DESIGN (Auftrag `aufnahme:20260922:gesamt-design-abgleich`):
// im gefilterten Bibliotheksmenü blieb unklar, was der Export enthält. Gemessen ist: die Route
// `GET /api/library/export` (`services/app/src/routes/library-routes.ts`) nimmt nur `format` und
// liefert über `exportJson` (`services/library-analytics/src/service.ts`) ALLE validierten Einträge,
// vertrauliche nur mit `ko.validate`. Suche, Filter und Bereich der Fläche wirken darauf nicht.
// Der Prüfer liess zwei Wege offen — Umfang mitgeben ODER ihn vor dem Download ehrlich benennen.
// Hier steht der zweite: der Satz sagt genau das, was der Server tut, und verspricht nichts weiter.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "exportumfang.",
  legacySchluessel: [],
  de: {
    "exportumfang.mitVertraulichen":
      "Enthält alle validierten Einträge, auch vertrauliche – Suche und Filter gelten für den Export nicht.",
    "exportumfang.ohneVertrauliche":
      "Enthält alle validierten Einträge ohne vertrauliche – Suche und Filter gelten für den Export nicht.",
  },
  en: {
    "exportumfang.mitVertraulichen":
      "Contains all validated entries, including confidential ones – search and filters do not apply to the export.",
    "exportumfang.ohneVertrauliche":
      "Contains all validated entries except confidential ones – search and filters do not apply to the export.",
  },
  nl: {
    "exportumfang.mitVertraulichen":
      "Bevat alle gevalideerde items, ook vertrouwelijke – zoekopdracht en filters gelden niet voor de export.",
    "exportumfang.ohneVertrauliche":
      "Bevat alle gevalideerde items zonder vertrouwelijke – zoekopdracht en filters gelden niet voor de export.",
  },
} satisfies Textmodul;
