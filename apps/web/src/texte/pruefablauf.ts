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
    "pruefablauf.annahme.zeile": "Angenommen: Fassung {{fassung}} · {{person}} · {{zeit}}",
    "pruefablauf.annahme.regel.peerPruefung":
      "Kontoregel: Peer-Prüfung – erforderliche Freigaben: {{n}}",
    "pruefablauf.annahme.regel.peerPruefungOhneZahl": "Kontoregel: Peer-Prüfung",
    "pruefablauf.annahme.regel.direktannahme":
      "Kontoregel: direkte Annahme durch ein Konto mit Freigaberecht",
    "pruefablauf.annahme.regel.pflichtpruefung":
      "Kontoregel: Pflichtprüfung – eingereicht ohne Direktfreigaberecht, von einer anderen Person angenommen",
    "pruefablauf.annahme.regel.freiwilligeZweitpruefung":
      "Kontoregel: freiwillige Zweitprüfung – trotz Freigaberecht zur Prüfung gegeben, von einer anderen Person angenommen",
    "pruefablauf.annahme.regel.eigentuemerfreigabe":
      "Kontoregel: Freigabe durch den benannten Eigentümer mit Freigaberecht",
    "pruefablauf.annahme.regel.unbekannt":
      "Kontoregel: im Beleg nicht festgehalten (älterer Beleg)",
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
    "pruefablauf.annahme.zeile": "Accepted: version {{fassung}} · {{person}} · {{zeit}}",
    "pruefablauf.annahme.regel.peerPruefung":
      "Account rule: peer review – approvals required: {{n}}",
    "pruefablauf.annahme.regel.peerPruefungOhneZahl": "Account rule: peer review",
    "pruefablauf.annahme.regel.direktannahme":
      "Account rule: direct acceptance by an account with approval rights",
    "pruefablauf.annahme.regel.pflichtpruefung":
      "Account rule: mandatory review – submitted without direct approval rights, accepted by another person",
    "pruefablauf.annahme.regel.freiwilligeZweitpruefung":
      "Account rule: voluntary second review – handed to review despite approval rights, accepted by another person",
    "pruefablauf.annahme.regel.eigentuemerfreigabe":
      "Account rule: approval by the named owner with approval rights",
    "pruefablauf.annahme.regel.unbekannt":
      "Account rule: not recorded in the record (older record)",
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
    "pruefablauf.annahme.zeile": "Aangenomen: versie {{fassung}} · {{person}} · {{zeit}}",
    "pruefablauf.annahme.regel.peerPruefung":
      "Accountregel: collegiale toetsing – vereiste goedkeuringen: {{n}}",
    "pruefablauf.annahme.regel.peerPruefungOhneZahl": "Accountregel: collegiale toetsing",
    "pruefablauf.annahme.regel.direktannahme":
      "Accountregel: directe aanname door een account met goedkeuringsrecht",
    "pruefablauf.annahme.regel.pflichtpruefung":
      "Accountregel: verplichte beoordeling – ingediend zonder direct goedkeuringsrecht, door een andere persoon aangenomen",
    "pruefablauf.annahme.regel.freiwilligeZweitpruefung":
      "Accountregel: vrijwillige tweede beoordeling – ondanks goedkeuringsrecht ter beoordeling gegeven, door een andere persoon aangenomen",
    "pruefablauf.annahme.regel.eigentuemerfreigabe":
      "Accountregel: goedkeuring door de aangewezen eigenaar met goedkeuringsrecht",
    "pruefablauf.annahme.regel.unbekannt":
      "Accountregel: niet vastgelegd in het bewijsstuk (ouder bewijsstuk)",
  },
} satisfies Textmodul;
