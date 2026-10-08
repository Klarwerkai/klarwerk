// ================================================================================================
// AUFNAHME gesamt-peer-validierung · package:pruefablauf — PRÜFAUFTRAG BIS ZUR VERÖFFENTLICHUNG.
// ================================================================================================
//
// Die Sätze des Vorschlagswegs, die bis hierher fehlten: eine BENANNTE Prüfperson, die RÜCKFRAGE
// als dritte Antwort neben Übernehmen und Ablehnen, und der STATUS, den der Einreicher an seinem
// eigenen Vorschlag sieht — auch nach der Entscheidung, samt Begründung.
//
// ANREDE „du", wie die übrigen Rückmeldungen des Produkts.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "pruefablauf.",
  legacySchluessel: [],
  de: {
    "pruefablauf.pruefer.label": "Prüfperson (optional)",
    "pruefablauf.pruefer.keine": "Keine bestimmte Person",
    "pruefablauf.pruefer.zugeordnet": "Zur Prüfung an: {{name}}",
    "pruefablauf.rueckfrage.knopf": "Rückfrage stellen",
    "pruefablauf.rueckfrage.platzhalter": "Was soll die einreichende Person klären?",
    "pruefablauf.rueckfrage.senden": "Rückfrage speichern",
    "pruefablauf.rueckfrage.gespeichert":
      "Rückfrage gespeichert. Der Vorschlag bleibt offen, der Eintrag unverändert.",
    "pruefablauf.rueckfrage.von": "Rückfrage von {{name}} · {{zeit}}",
    "pruefablauf.eigene.titel": "Deine Änderungsvorschläge",
    "pruefablauf.status.offen": "Offen – wartet auf Prüfung",
    "pruefablauf.status.offenRueckfrage": "Offen – es liegt eine Rückfrage vor",
    "pruefablauf.status.uebernommen": "Übernommen – jetzt Fassung {{n}}",
    "pruefablauf.status.uebernommenOhneFassung": "Übernommen",
    "pruefablauf.status.abgelehnt": "Abgelehnt",
    "pruefablauf.entschieden": "Entschieden von {{name}} · {{zeit}}",
    "pruefablauf.begruendung": "Begründung: {{text}}",
  },
  en: {
    "pruefablauf.pruefer.label": "Reviewer (optional)",
    "pruefablauf.pruefer.keine": "No specific person",
    "pruefablauf.pruefer.zugeordnet": "For review by: {{name}}",
    "pruefablauf.rueckfrage.knopf": "Ask a question",
    "pruefablauf.rueckfrage.platzhalter": "What should the submitter clarify?",
    "pruefablauf.rueckfrage.senden": "Save question",
    "pruefablauf.rueckfrage.gespeichert":
      "Question saved. The proposal stays open, the entry unchanged.",
    "pruefablauf.rueckfrage.von": "Question from {{name}} · {{zeit}}",
    "pruefablauf.eigene.titel": "Your change proposals",
    "pruefablauf.status.offen": "Open – waiting for review",
    "pruefablauf.status.offenRueckfrage": "Open – a question has been asked",
    "pruefablauf.status.uebernommen": "Accepted – now version {{n}}",
    "pruefablauf.status.uebernommenOhneFassung": "Accepted",
    "pruefablauf.status.abgelehnt": "Rejected",
    "pruefablauf.entschieden": "Decided by {{name}} · {{zeit}}",
    "pruefablauf.begruendung": "Reason: {{text}}",
  },
  nl: {
    "pruefablauf.pruefer.label": "Beoordelaar (optioneel)",
    "pruefablauf.pruefer.keine": "Geen bepaalde persoon",
    "pruefablauf.pruefer.zugeordnet": "Ter beoordeling aan: {{name}}",
    "pruefablauf.rueckfrage.knopf": "Vraag stellen",
    "pruefablauf.rueckfrage.platzhalter": "Wat moet de indiener verduidelijken?",
    "pruefablauf.rueckfrage.senden": "Vraag opslaan",
    "pruefablauf.rueckfrage.gespeichert":
      "Vraag opgeslagen. Het voorstel blijft open, het item ongewijzigd.",
    "pruefablauf.rueckfrage.von": "Vraag van {{name}} · {{zeit}}",
    "pruefablauf.eigene.titel": "Je wijzigingsvoorstellen",
    "pruefablauf.status.offen": "Open – wacht op beoordeling",
    "pruefablauf.status.offenRueckfrage": "Open – er is een vraag gesteld",
    "pruefablauf.status.uebernommen": "Overgenomen – nu versie {{n}}",
    "pruefablauf.status.uebernommenOhneFassung": "Overgenomen",
    "pruefablauf.status.abgelehnt": "Afgewezen",
    "pruefablauf.entschieden": "Besloten door {{name}} · {{zeit}}",
    "pruefablauf.begruendung": "Reden: {{text}}",
  },
} satisfies Textmodul;
