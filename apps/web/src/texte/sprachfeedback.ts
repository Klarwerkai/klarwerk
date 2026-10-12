// ================================================================================================
// AUFNAHME 20260922 · GESAMT-SPRACHFEEDBACK (R-1649) — „Das war nicht hilfreich, ich habe es so
// gemacht …" nach einer Antwort.
// ================================================================================================
//
// Die Bestätigungskarte auf der Fragenseite (`components/fragen/NichtHilfreichKarte.tsx`) und ihr
// Ergebnis. `audit.action.answer_not_helpful` ist der Name des neuen Audit-Belegs; er wird aus dem
// Aktionsnamen abgeleitet (`lib/auditAction.ts`) und steht deshalb in `legacySchluessel`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "sprachfeedback.",
  legacySchluessel: ["audit.action.answer_not_helpful"],
  de: {
    "sprachfeedback.erkannt": "Verstanden: Die Antwort aus „{{titel}}“ war nicht hilfreich.",
    "sprachfeedback.wegLabel": "So hast du es gemacht (wird ein neuer Entwurf):",
    "sprachfeedback.keinEntwurfRecht":
      "Deinen eigenen Weg als Entwurf aufnehmen darf deine Rolle nicht. Vermerkt wird nur die Rückmeldung.",
    "sprachfeedback.bestaetigen": "Als nicht hilfreich vermerken",
    "sprachfeedback.bestaetigenMitEntwurf": "Vermerken und als Entwurf aufnehmen",
    "sprachfeedback.alsFrage": "Doch als Frage stellen",
    "sprachfeedback.verwerfen": "Verwerfen",
    "sprachfeedback.entwurfTitel": "Abweichender Weg zu „{{titel}}“",
    "sprachfeedback.erledigt": "Vermerkt: nicht hilfreich.",
    "sprachfeedback.erledigtMitEntwurf":
      "Vermerkt: nicht hilfreich. Dein Weg liegt als Entwurf bereit.",
    "sprachfeedback.entwurfOeffnen": "Entwurf öffnen",
    "audit.action.answer_not_helpful": "Antwort als nicht hilfreich vermerkt",
  },
  en: {
    "sprachfeedback.erkannt": "Understood: the answer from “{{titel}}” was not helpful.",
    "sprachfeedback.wegLabel": "This is how you did it (becomes a new draft):",
    "sprachfeedback.keinEntwurfRecht":
      "Your role may not record your own approach as a draft. Only the feedback is recorded.",
    "sprachfeedback.bestaetigen": "Record as not helpful",
    "sprachfeedback.bestaetigenMitEntwurf": "Record and save as draft",
    "sprachfeedback.alsFrage": "Ask it as a question instead",
    "sprachfeedback.verwerfen": "Discard",
    "sprachfeedback.entwurfTitel": "Different approach to “{{titel}}”",
    "sprachfeedback.erledigt": "Recorded: not helpful.",
    "sprachfeedback.erledigtMitEntwurf":
      "Recorded: not helpful. Your approach is ready as a draft.",
    "sprachfeedback.entwurfOeffnen": "Open draft",
    "audit.action.answer_not_helpful": "Answer recorded as not helpful",
  },
  nl: {
    "sprachfeedback.erkannt": "Begrepen: het antwoord uit ‘{{titel}}’ was niet behulpzaam.",
    "sprachfeedback.wegLabel": "Zo heb je het gedaan (wordt een nieuw concept):",
    "sprachfeedback.keinEntwurfRecht":
      "Je rol mag je eigen aanpak niet als concept vastleggen. Alleen de feedback wordt vastgelegd.",
    "sprachfeedback.bestaetigen": "Vastleggen als niet behulpzaam",
    "sprachfeedback.bestaetigenMitEntwurf": "Vastleggen en als concept opslaan",
    "sprachfeedback.alsFrage": "Toch als vraag stellen",
    "sprachfeedback.verwerfen": "Verwerpen",
    "sprachfeedback.entwurfTitel": "Andere aanpak voor ‘{{titel}}’",
    "sprachfeedback.erledigt": "Vastgelegd: niet behulpzaam.",
    "sprachfeedback.erledigtMitEntwurf":
      "Vastgelegd: niet behulpzaam. Je aanpak staat klaar als concept.",
    "sprachfeedback.entwurfOeffnen": "Concept openen",
    "audit.action.answer_not_helpful": "Antwoord vastgelegd als niet behulpzaam",
  },
} satisfies Textmodul;
