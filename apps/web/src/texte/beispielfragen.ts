// ================================================================================================
// R-1001 · BEISPIELE AUF DER FRAGENFLÄCHE — NICHT NUR INDUSTRIE.
// ================================================================================================
//
// Klara richtet sich an jede Organisation — Industrie, Pflege, Kanzleien, Vereine, Versicherungen,
// Berater, gemeinnützige Träger. Bis hierher handelten der Platzhalter und alle drei Beispielfragen
// auf /fragen von Ventil, Filter und Dosierung an einer Fertigungslinie.
//
// Was bleibt und warum: EIN Industriebeispiel (`ask.example.valve`, „Ventil X / Überdruck") trifft
// den deutschen Demo-Bestand und bleibt deshalb stehen (`lib/askExamples.ts`, SCRUM-269). Dazu
// kommen eine Frage aus der Pflege und eine aus einem Verein; der Platzhalter stammt aus dem Alltag
// einer Kanzlei oder Verwaltung. Die beiden neuen Fragen sind bewusst konkret (Station B2,
// 500 Euro) — die Pflegefrage ist die Lücken-Frage, die neben Antworten aus dem echten Bestand
// erscheint.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "beispielfragen.",
  legacySchluessel: [],
  de: {
    "beispielfragen.platzhalter": "z. B. Wer muss zustimmen, bevor wir eine Frist verlängern?",
    "beispielfragen.pflege":
      "Was gehört bei der Übergabe an die Nachtschicht auf Station B2 ins Protokoll?",
    "beispielfragen.verein": "Wer im Verein darf Ausgaben über 500 Euro allein freigeben?",
  },
  en: {
    "beispielfragen.platzhalter": "e.g. Who has to agree before we extend a deadline?",
    "beispielfragen.pflege":
      "What goes into the log at the handover to the night shift on ward B2?",
    "beispielfragen.verein": "Who in the association may approve expenses over 500 euros alone?",
  },
  nl: {
    "beispielfragen.platzhalter": "bijv. Wie moet akkoord geven voordat we een termijn verlengen?",
    "beispielfragen.pflege":
      "Wat hoort bij de overdracht aan de nachtdienst op afdeling B2 in het verslag?",
    "beispielfragen.verein": "Wie in de vereniging mag uitgaven boven 500 euro alleen goedkeuren?",
  },
} satisfies Textmodul;
