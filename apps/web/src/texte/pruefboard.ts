// ================================================================================================
// AUFNAHME 20260922 · PRÜFBOARD-BEDIENUNG — Zuständigkeit und Fehlerzustände an der Prüfkarte.
// ================================================================================================
//
// Zwei Auskünfte, die die Prüffläche bisher schuldig blieb:
//   · WER zuständig ist — „zugewiesen" ohne Namen beantwortete die Frage nicht, und ein
//     gescheitertes Zuweisen blieb ganz ohne Meldung.
//   · Der TEILERFOLG von Rückfrage/Ablehnung — die Begründung liegt am Server, die Bewertung nicht.
//     Bisher hiess das „Konnte nicht gespeichert werden", und der zweite Versuch legte die
//     Begründung ein zweites Mal an.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "pruefboard.",
  legacySchluessel: [],
  de: {
    "pruefboard.zugewiesenAn": "Zugewiesen an",
    "pruefboard.zuweisenErfolg": "Zugewiesen an {{name}}.",
    "pruefboard.zuweisenFehler": "Zuweisen hat nicht geklappt: {{grund}}",
    "pruefboard.bereitsZugewiesen": "{{name}} (bereits zugewiesen)",
    "pruefboard.begruendungGespeichert":
      "Die Begründung ist gespeichert, die Bewertung nicht. Erneut senden schickt nur die Bewertung.",
    "pruefboard.bewertungSenden": "Bewertung erneut senden",
  },
  en: {
    "pruefboard.zugewiesenAn": "Assigned to",
    "pruefboard.zuweisenErfolg": "Assigned to {{name}}.",
    "pruefboard.zuweisenFehler": "Assigning failed: {{grund}}",
    "pruefboard.bereitsZugewiesen": "{{name}} (already assigned)",
    "pruefboard.begruendungGespeichert":
      "The reason is saved, the rating is not. Sending again submits only the rating.",
    "pruefboard.bewertungSenden": "Send rating again",
  },
  nl: {
    "pruefboard.zugewiesenAn": "Toegewezen aan",
    "pruefboard.zuweisenErfolg": "Toegewezen aan {{name}}.",
    "pruefboard.zuweisenFehler": "Toewijzen is mislukt: {{grund}}",
    "pruefboard.bereitsZugewiesen": "{{name}} (al toegewezen)",
    "pruefboard.begruendungGespeichert":
      "De onderbouwing is opgeslagen, de beoordeling niet. Opnieuw versturen verstuurt alleen de beoordeling.",
    "pruefboard.bewertungSenden": "Beoordeling opnieuw versturen",
  },
} satisfies Textmodul;
