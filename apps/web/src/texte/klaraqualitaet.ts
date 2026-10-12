// ================================================================================================
// KLARA 14 (produkt:20261008:klara-qualitaet) — Widersprüche, Lücken und Verbesserungen erklären.
// ================================================================================================
//
// Klara erklärt die VORHANDENEN Befunde am geöffneten Wissensobjekt (Konflikt, Duplikat,
// Quellenalter, fehlende Angabe) mit Quelle, Grundlage und Unsicherheit und schlägt einen konkreten
// Schritt vor. Die Texte sagen ausdrücklich, dass das Erklären nichts ändert und nichts sperrt.
// Wiederverwendet (nicht hier definiert): `con.*`, `dup.*`, `frische.*`, `konfliktarbeit.*`.
//
// `klaraqualitaet.satz.eskalieren` ist der Satz für den Ausführungsweg von Klara 05 — nur wenn die
// dortige Erkennung ihn genau so versteht, bietet Klara ihn an (`qualitaet.ts`, `eskalationsSatz`).
// Die niederländische Fassung kennt die Erkennung (noch) nicht; dort bleibt der Arbeitsweg.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klaraqualitaet.",
  legacySchluessel: [],
  de: {
    "klaraqualitaet.titel": "Befunde zu diesem Beitrag",
    "klaraqualitaet.einleitung":
      "Klara erklärt vorhandene Widersprüche, Duplikate, Quellenalter und fehlende Angaben zu „{{titel}}“ – mit Quelle und einem Vorschlag. Dabei wird nichts geändert.",
    "klaraqualitaet.knopf": "Befunde erklären",
    "klaraqualitaet.knopfErneut": "Erneut lesen",
    "klaraqualitaet.laedt": "Klara liest die Befunde …",
    "klaraqualitaet.fehler": "Die Befunde konnten nicht gelesen werden: {{grund}}",
    "klaraqualitaet.keine":
      "Zu diesem Beitrag liegen dir keine offenen Befunde vor. Das ist keine Freigabe – es heißt nur, dass die vorhandenen Prüfungen nichts Offenes melden, das du sehen darfst.",
    "klaraqualitaet.nichtGelesen": "Nicht gelesen: {{wege}}. Darüber sagt Klara hier nichts.",
    "klaraqualitaet.weg.konflikte": "Konflikte",
    "klaraqualitaet.weg.duplikate": "Duplikate",
    "klaraqualitaet.weg.signale": "Hinweise am eigenen Beitrag",
    "klaraqualitaet.unveraendert":
      "Klara hat nichts geändert und nichts gesperrt. Erklärt wird aus den vorhandenen Prüfungen, ohne KI.",
    "klaraqualitaet.quellen": "Quelle",
    "klaraqualitaet.eigenes": "dieser Beitrag",
    "klaraqualitaet.gegenseite": "Gegenseite",
    "klaraqualitaet.nichtLesbar": "nicht lesbar",
    "klaraqualitaet.belegt.ja": "mit Quelle",
    "klaraqualitaet.belegt.nein": "keine Quelle hinterlegt",
    "klaraqualitaet.belegt.unbekannt": "Quellenlage unbekannt",
    "klaraqualitaet.grundlageLabel": "Grundlage",
    "klaraqualitaet.grundlage.belegt": "belegt durch die vorhandene Prüfung",
    "klaraqualitaet.grundlage.widerspruechlich":
      "widersprüchliche Quellen – beide Seiten sind belegt und widersprechen sich",
    "klaraqualitaet.grundlage.einseitig": "nur eine Seite ist mit einer Quelle belegt",
    "klaraqualitaet.grundlage.keine": "keine Grundlage – keine Quelle und kein belegtes Zitat",
    "klaraqualitaet.grundlage.unbekannt":
      "nicht beurteilbar – die Gegenseite ist für dich nicht lesbar",
    "klaraqualitaet.grundlage.zurueckgehalten": "Inhalt für dich zurückgehalten",
    "klaraqualitaet.unsicherheitLabel": "Unsicherheit",
    "klaraqualitaet.vorschlagLabel": "Vorschlag",
    "klaraqualitaet.vorbereiten": "Als Auftrag vorbereiten",
    "klaraqualitaet.vorbereitet": "Der Auftrag steht im Eingabefeld. Erst „Senden“ führt ihn aus.",
    "klaraqualitaet.oeffnen": "Im Arbeitsweg öffnen",
    "klaraqualitaet.unbekannteSeite": "einen nicht lesbaren Beitrag",
    "klaraqualitaet.begruendung": "Begründung der Prüfung: {{text}}",
    "klaraqualitaet.konflikt.titel": "Widerspruch zu „{{gegen}}“",
    "klaraqualitaet.konflikt.beschreibung": "Konfliktart {{art}}: {{text}}",
    "klaraqualitaet.konflikt.streitpunkt": "Streitpunkt: {{punkt}}",
    "klaraqualitaet.konflikt.zurueckgehalten":
      "Zu diesem Beitrag gibt es einen offenen Konflikt. Beschreibung und Zitate sind für dich zurückgehalten; Klara nennt sie deshalb nicht.",
    "klaraqualitaet.duplikat.titel": "Überschneidung mit „{{gegen}}“",
    "klaraqualitaet.duplikat.beziehung": "Art der Überschneidung: {{beziehung}}",
    "klaraqualitaet.duplikat.gemeinsam": "Gemeinsam: {{text}}",
    "klaraqualitaet.duplikat.nurHier": "Nur in diesem Beitrag: {{text}}",
    "klaraqualitaet.duplikat.nurDort": "Nur im anderen Beitrag: {{text}}",
    "klaraqualitaet.alter.titel": "Quellenalter: {{stufe}}",
    "klaraqualitaet.alter.titelEntfernt": "Quelle am Ursprung entfernt",
    "klaraqualitaet.alter.bezug": "Zuletzt fachlich bestätigt bzw. Bezug am {{datum}}.",
    "klaraqualitaet.alter.haltbarBis": "Fachlich bestätigt bis {{datum}}.",
    "klaraqualitaet.alter.haltbarUnbekannt": "Bis wann der Beitrag bestätigt ist, ist unbekannt.",
    "klaraqualitaet.alter.quelleVom": "Quelle „{{label}}“ vom {{datum}}.",
    "klaraqualitaet.alter.quelleOhneDatum": "Quelle „{{label}}“ ohne Quelldatum.",
    "klaraqualitaet.alter.quelleEntfernt":
      "Quelle „{{label}}“ wurde am Ursprung am {{datum}} entfernt.",
    "klaraqualitaet.fehlend.quelleTitel": "Fehlende Angabe: keine Quelle hinterlegt",
    "klaraqualitaet.fehlend.quelle":
      "An diesem Beitrag ist keine Quelle hinterlegt. Ein Widerspruch dazu ließe sich deshalb nicht an Belegen entscheiden.",
    "klaraqualitaet.fehlend.verantwortlichTitel":
      "Fehlende Angabe: keine verantwortliche Person benannt",
    "klaraqualitaet.fehlend.verantwortlich":
      "Es ist niemand als verantwortlich benannt; bis dahin gilt der Autor {{name}} als zuständig.",
    "klaraqualitaet.verdeckt.titel.konflikt":
      "Offener Konflikt mit einem für dich verdeckten Beitrag",
    "klaraqualitaet.verdeckt.titel.duplikat":
      "Offene Überschneidung mit einem für dich verdeckten Beitrag",
    "klaraqualitaet.verdeckt.text":
      "Die Prüfung meldet einen offenen Befund an diesem Beitrag. Die Gegenseite darfst du nicht sehen; Klara nennt deshalb weder Titel noch Inhalt.",
    "klaraqualitaet.unsicher.gemeldet":
      "Von einer Person gemeldet – noch nicht fachlich entschieden.",
    "klaraqualitaet.unsicher.modell":
      "Von der KI-Prüfung erkannt, Sicherheit {{prozent}} % – kein bewiesener Befund.",
    "klaraqualitaet.unsicher.modellOhneWert":
      "Von der KI-Prüfung erkannt, ohne Sicherheitsangabe – kein bewiesener Befund.",
    "klaraqualitaet.unsicher.regel": "Durch Textabgleich erkannt – kein bewiesener Befund.",
    "klaraqualitaet.unsicher.vorgabe":
      "Die Haltbarkeit ist die Vorgabe der Wissensart, nicht aus Bestätigungen gelernt.",
    "klaraqualitaet.unsicher.keinePflicht":
      "Klara stellt keine Pflicht auf: ob eine Quelle nötig ist, entscheidet die fachliche Prüfung.",
    "klaraqualitaet.vorschlag.eskalieren":
      "Den Konflikt an einen Menschen eskalieren – über deinen Ausführungsweg, mit deinen Rechten.",
    "klaraqualitaet.vorschlag.konfliktOeffnen": "Den Konflikt im Konfliktbereich ansehen.",
    "klaraqualitaet.vorschlag.duplikatEntscheidung":
      "Verlinken, getrennt lassen oder zusammenführen entscheidest du im Vergleich – Klara ändert keinen der beiden Beiträge.",
    "klaraqualitaet.vorschlag.bestaetigen":
      "„Stimmt weiterhin“ setzt nur eine Person, die es fachlich beurteilen kann – Klara bestätigt nichts.",
    "klaraqualitaet.vorschlag.quelleErsetzen":
      "Eine aktuelle Quelle nachtragen oder die entfernte ersetzen – im Beitrag selbst.",
    "klaraqualitaet.vorschlag.quelleNachtragen": "Im Beitrag eine Quelle nachtragen.",
    "klaraqualitaet.vorschlag.quelleErfragen":
      "Du darfst den Beitrag nicht bearbeiten. {{name}} um eine Quelle bitten.",
    "klaraqualitaet.vorschlag.verantwortlichBenennen":
      "Im Beitrag eine verantwortliche Person benennen.",
    "klaraqualitaet.vorschlag.verdeckt":
      "Wende dich an die verantwortliche Person dieses Beitrags; sie sieht beide Seiten.",
    "klaraqualitaet.satz.eskalieren": "Eskaliere die Aufgabe „{{titel}}“",
    "klaraqualitaet.bedienhilfe.erklaeren":
      "Auf einem Wissensbeitrag zeigt „Befunde erklären“ offene Widersprüche, Duplikate, Quellenalter und fehlende Angaben – jeweils mit Quelle, Grundlage und Unsicherheit.",
    "klaraqualitaet.bedienhilfe.vorschlag":
      "Jeder Befund hat einen konkreten Vorschlag. Das Erklären ändert und sperrt nichts; „Als Auftrag vorbereiten“ legt nur den Satz ins Eingabefeld – erst „Senden“ führt ihn aus.",
    "klaraqualitaet.bedienhilfe.grundlage":
      "„Keine Grundlage“ und „widersprüchliche Quellen“ stehen ausdrücklich da. Deine Einstellungen und Vorlieben ändern das Urteil nicht.",
    "klaraqualitaet.bedienhilfe.rechte":
      "Klara zeigt nur, was du sehen darfst; verdeckte Gegenseiten werden als solche benannt.",
  },
  en: {
    "klaraqualitaet.titel": "Findings on this entry",
    "klaraqualitaet.einleitung":
      "Klara explains existing contradictions, duplicates, source age and missing details on “{{titel}}” – with source and a suggestion. Nothing is changed.",
    "klaraqualitaet.knopf": "Explain findings",
    "klaraqualitaet.knopfErneut": "Read again",
    "klaraqualitaet.laedt": "Klara is reading the findings …",
    "klaraqualitaet.fehler": "The findings could not be read: {{grund}}",
    "klaraqualitaet.keine":
      "There are no open findings on this entry that you can see. This is not an approval – it only means the existing checks report nothing open that you may see.",
    "klaraqualitaet.nichtGelesen": "Not read: {{wege}}. Klara says nothing about these here.",
    "klaraqualitaet.weg.konflikte": "conflicts",
    "klaraqualitaet.weg.duplikate": "duplicates",
    "klaraqualitaet.weg.signale": "notices on your own entry",
    "klaraqualitaet.unveraendert":
      "Klara changed nothing and locked nothing. The explanation comes from the existing checks, without AI.",
    "klaraqualitaet.quellen": "Source",
    "klaraqualitaet.eigenes": "this entry",
    "klaraqualitaet.gegenseite": "other side",
    "klaraqualitaet.nichtLesbar": "not readable",
    "klaraqualitaet.belegt.ja": "with source",
    "klaraqualitaet.belegt.nein": "no source on file",
    "klaraqualitaet.belegt.unbekannt": "source situation unknown",
    "klaraqualitaet.grundlageLabel": "Basis",
    "klaraqualitaet.grundlage.belegt": "backed by the existing check",
    "klaraqualitaet.grundlage.widerspruechlich":
      "contradictory sources – both sides are backed and contradict each other",
    "klaraqualitaet.grundlage.einseitig": "only one side is backed by a source",
    "klaraqualitaet.grundlage.keine": "no basis – no source and no backed quote",
    "klaraqualitaet.grundlage.unbekannt":
      "cannot be judged – the other side is not readable for you",
    "klaraqualitaet.grundlage.zurueckgehalten": "content withheld for you",
    "klaraqualitaet.unsicherheitLabel": "Uncertainty",
    "klaraqualitaet.vorschlagLabel": "Suggestion",
    "klaraqualitaet.vorbereiten": "Prepare as task",
    "klaraqualitaet.vorbereitet": "The task is in the input field. Only “Send” carries it out.",
    "klaraqualitaet.oeffnen": "Open in the work area",
    "klaraqualitaet.unbekannteSeite": "an entry you cannot read",
    "klaraqualitaet.begruendung": "Reasoning of the check: {{text}}",
    "klaraqualitaet.konflikt.titel": "Contradiction with “{{gegen}}”",
    "klaraqualitaet.konflikt.beschreibung": "Conflict type {{art}}: {{text}}",
    "klaraqualitaet.konflikt.streitpunkt": "Point of dispute: {{punkt}}",
    "klaraqualitaet.konflikt.zurueckgehalten":
      "There is an open conflict on this entry. Its description and quotes are withheld for you, so Klara does not name them.",
    "klaraqualitaet.duplikat.titel": "Overlap with “{{gegen}}”",
    "klaraqualitaet.duplikat.beziehung": "Kind of overlap: {{beziehung}}",
    "klaraqualitaet.duplikat.gemeinsam": "Shared: {{text}}",
    "klaraqualitaet.duplikat.nurHier": "Only in this entry: {{text}}",
    "klaraqualitaet.duplikat.nurDort": "Only in the other entry: {{text}}",
    "klaraqualitaet.alter.titel": "Source age: {{stufe}}",
    "klaraqualitaet.alter.titelEntfernt": "Source removed at its origin",
    "klaraqualitaet.alter.bezug": "Last confirmed or referenced on {{datum}}.",
    "klaraqualitaet.alter.haltbarBis": "Confirmed until {{datum}}.",
    "klaraqualitaet.alter.haltbarUnbekannt": "It is unknown until when the entry is confirmed.",
    "klaraqualitaet.alter.quelleVom": "Source “{{label}}” dated {{datum}}.",
    "klaraqualitaet.alter.quelleOhneDatum": "Source “{{label}}” without a source date.",
    "klaraqualitaet.alter.quelleEntfernt":
      "Source “{{label}}” was removed at its origin on {{datum}}.",
    "klaraqualitaet.fehlend.quelleTitel": "Missing detail: no source on file",
    "klaraqualitaet.fehlend.quelle":
      "This entry has no source on file. A contradiction could therefore not be decided by evidence.",
    "klaraqualitaet.fehlend.verantwortlichTitel": "Missing detail: no responsible person named",
    "klaraqualitaet.fehlend.verantwortlich":
      "Nobody is named as responsible; until then the author {{name}} counts as responsible.",
    "klaraqualitaet.verdeckt.titel.konflikt": "Open conflict with an entry hidden from you",
    "klaraqualitaet.verdeckt.titel.duplikat": "Open overlap with an entry hidden from you",
    "klaraqualitaet.verdeckt.text":
      "The check reports an open finding on this entry. You may not see the other side, so Klara names neither title nor content.",
    "klaraqualitaet.unsicher.gemeldet": "Reported by a person – not yet decided on the merits.",
    "klaraqualitaet.unsicher.modell":
      "Detected by the AI check, confidence {{prozent}} % – not a proven finding.",
    "klaraqualitaet.unsicher.modellOhneWert":
      "Detected by the AI check, without a confidence value – not a proven finding.",
    "klaraqualitaet.unsicher.regel": "Detected by text comparison – not a proven finding.",
    "klaraqualitaet.unsicher.vorgabe":
      "The shelf life is the default of the knowledge type, not learned from confirmations.",
    "klaraqualitaet.unsicher.keinePflicht":
      "Klara sets no requirement: whether a source is needed is decided by the expert review.",
    "klaraqualitaet.vorschlag.eskalieren":
      "Escalate the conflict to a person – through your task path, with your permissions.",
    "klaraqualitaet.vorschlag.konfliktOeffnen": "View the conflict in the conflict area.",
    "klaraqualitaet.vorschlag.duplikatEntscheidung":
      "You decide in the comparison whether to link, keep separate or merge – Klara changes neither entry.",
    "klaraqualitaet.vorschlag.bestaetigen":
      "“Still valid” is set only by a person who can judge it – Klara confirms nothing.",
    "klaraqualitaet.vorschlag.quelleErsetzen":
      "Add a current source or replace the removed one – in the entry itself.",
    "klaraqualitaet.vorschlag.quelleNachtragen": "Add a source in the entry.",
    "klaraqualitaet.vorschlag.quelleErfragen":
      "You may not edit this entry. Ask {{name}} for a source.",
    "klaraqualitaet.vorschlag.verantwortlichBenennen": "Name a responsible person in the entry.",
    "klaraqualitaet.vorschlag.verdeckt":
      "Contact the person responsible for this entry; they can see both sides.",
    "klaraqualitaet.satz.eskalieren": "Escalate the task “{{titel}}”",
    "klaraqualitaet.bedienhilfe.erklaeren":
      "On a knowledge entry, “Explain findings” shows open contradictions, duplicates, source age and missing details – each with source, basis and uncertainty.",
    "klaraqualitaet.bedienhilfe.vorschlag":
      "Each finding comes with a concrete suggestion. Explaining changes and locks nothing; “Prepare as task” only puts the sentence into the input field – only “Send” carries it out.",
    "klaraqualitaet.bedienhilfe.grundlage":
      "“No basis” and “contradictory sources” are stated explicitly. Your settings and preferences do not change the assessment.",
    "klaraqualitaet.bedienhilfe.rechte":
      "Klara only shows what you may see; hidden other sides are named as such.",
  },
  nl: {
    "klaraqualitaet.titel": "Bevindingen bij deze bijdrage",
    "klaraqualitaet.einleitung":
      "Klara legt bestaande tegenstrijdigheden, duplicaten, bronouderdom en ontbrekende gegevens bij ‘{{titel}}’ uit – met bron en een voorstel. Er wordt niets gewijzigd.",
    "klaraqualitaet.knopf": "Bevindingen uitleggen",
    "klaraqualitaet.knopfErneut": "Opnieuw lezen",
    "klaraqualitaet.laedt": "Klara leest de bevindingen …",
    "klaraqualitaet.fehler": "De bevindingen konden niet worden gelezen: {{grund}}",
    "klaraqualitaet.keine":
      "Bij deze bijdrage zijn voor jou geen open bevindingen zichtbaar. Dat is geen vrijgave – het betekent alleen dat de bestaande controles niets openstaands melden dat jij mag zien.",
    "klaraqualitaet.nichtGelesen": "Niet gelezen: {{wege}}. Daarover zegt Klara hier niets.",
    "klaraqualitaet.weg.konflikte": "conflicten",
    "klaraqualitaet.weg.duplikate": "duplicaten",
    "klaraqualitaet.weg.signale": "meldingen bij je eigen bijdrage",
    "klaraqualitaet.unveraendert":
      "Klara heeft niets gewijzigd en niets geblokkeerd. De uitleg komt uit de bestaande controles, zonder AI.",
    "klaraqualitaet.quellen": "Bron",
    "klaraqualitaet.eigenes": "deze bijdrage",
    "klaraqualitaet.gegenseite": "andere kant",
    "klaraqualitaet.nichtLesbar": "niet leesbaar",
    "klaraqualitaet.belegt.ja": "met bron",
    "klaraqualitaet.belegt.nein": "geen bron vastgelegd",
    "klaraqualitaet.belegt.unbekannt": "bronsituatie onbekend",
    "klaraqualitaet.grundlageLabel": "Grondslag",
    "klaraqualitaet.grundlage.belegt": "onderbouwd door de bestaande controle",
    "klaraqualitaet.grundlage.widerspruechlich":
      "tegenstrijdige bronnen – beide kanten zijn onderbouwd en spreken elkaar tegen",
    "klaraqualitaet.grundlage.einseitig": "slechts één kant is met een bron onderbouwd",
    "klaraqualitaet.grundlage.keine": "geen grondslag – geen bron en geen onderbouwd citaat",
    "klaraqualitaet.grundlage.unbekannt":
      "niet te beoordelen – de andere kant is voor jou niet leesbaar",
    "klaraqualitaet.grundlage.zurueckgehalten": "inhoud voor jou achtergehouden",
    "klaraqualitaet.unsicherheitLabel": "Onzekerheid",
    "klaraqualitaet.vorschlagLabel": "Voorstel",
    "klaraqualitaet.vorbereiten": "Als opdracht voorbereiden",
    "klaraqualitaet.vorbereitet":
      "De opdracht staat in het invoerveld. Pas „Verzenden” voert hem uit.",
    "klaraqualitaet.oeffnen": "In het werkgebied openen",
    "klaraqualitaet.unbekannteSeite": "een bijdrage die je niet kunt lezen",
    "klaraqualitaet.begruendung": "Onderbouwing van de controle: {{text}}",
    "klaraqualitaet.konflikt.titel": "Tegenstrijdigheid met ‘{{gegen}}’",
    "klaraqualitaet.konflikt.beschreibung": "Conflictsoort {{art}}: {{text}}",
    "klaraqualitaet.konflikt.streitpunkt": "Twistpunt: {{punkt}}",
    "klaraqualitaet.konflikt.zurueckgehalten":
      "Bij deze bijdrage is een open conflict. Beschrijving en citaten worden voor jou achtergehouden; Klara noemt ze daarom niet.",
    "klaraqualitaet.duplikat.titel": "Overlap met ‘{{gegen}}’",
    "klaraqualitaet.duplikat.beziehung": "Soort overlap: {{beziehung}}",
    "klaraqualitaet.duplikat.gemeinsam": "Gemeenschappelijk: {{text}}",
    "klaraqualitaet.duplikat.nurHier": "Alleen in deze bijdrage: {{text}}",
    "klaraqualitaet.duplikat.nurDort": "Alleen in de andere bijdrage: {{text}}",
    "klaraqualitaet.alter.titel": "Bronouderdom: {{stufe}}",
    "klaraqualitaet.alter.titelEntfernt": "Bron bij de oorsprong verwijderd",
    "klaraqualitaet.alter.bezug": "Laatst inhoudelijk bevestigd of verwezen op {{datum}}.",
    "klaraqualitaet.alter.haltbarBis": "Inhoudelijk bevestigd tot {{datum}}.",
    "klaraqualitaet.alter.haltbarUnbekannt": "Tot wanneer de bijdrage bevestigd is, is onbekend.",
    "klaraqualitaet.alter.quelleVom": "Bron ‘{{label}}’ van {{datum}}.",
    "klaraqualitaet.alter.quelleOhneDatum": "Bron ‘{{label}}’ zonder brondatum.",
    "klaraqualitaet.alter.quelleEntfernt":
      "Bron ‘{{label}}’ is bij de oorsprong verwijderd op {{datum}}.",
    "klaraqualitaet.fehlend.quelleTitel": "Ontbrekend gegeven: geen bron vastgelegd",
    "klaraqualitaet.fehlend.quelle":
      "Bij deze bijdrage is geen bron vastgelegd. Een tegenstrijdigheid zou daarom niet op bewijs te beslissen zijn.",
    "klaraqualitaet.fehlend.verantwortlichTitel":
      "Ontbrekend gegeven: geen verantwoordelijke persoon benoemd",
    "klaraqualitaet.fehlend.verantwortlich":
      "Er is niemand als verantwoordelijke benoemd; tot dan geldt de auteur {{name}} als verantwoordelijk.",
    "klaraqualitaet.verdeckt.titel.konflikt": "Open conflict met een voor jou verborgen bijdrage",
    "klaraqualitaet.verdeckt.titel.duplikat": "Open overlap met een voor jou verborgen bijdrage",
    "klaraqualitaet.verdeckt.text":
      "De controle meldt een open bevinding bij deze bijdrage. De andere kant mag je niet zien; Klara noemt daarom titel noch inhoud.",
    "klaraqualitaet.unsicher.gemeldet": "Door een persoon gemeld – nog niet inhoudelijk beslist.",
    "klaraqualitaet.unsicher.modell":
      "Door de AI-controle herkend, zekerheid {{prozent}} % – geen bewezen bevinding.",
    "klaraqualitaet.unsicher.modellOhneWert":
      "Door de AI-controle herkend, zonder zekerheidswaarde – geen bewezen bevinding.",
    "klaraqualitaet.unsicher.regel": "Door tekstvergelijking herkend – geen bewezen bevinding.",
    "klaraqualitaet.unsicher.vorgabe":
      "De houdbaarheid is de standaard van de kennissoort, niet geleerd uit bevestigingen.",
    "klaraqualitaet.unsicher.keinePflicht":
      "Klara stelt geen verplichting: of een bron nodig is, beslist de inhoudelijke controle.",
    "klaraqualitaet.vorschlag.eskalieren":
      "Het conflict naar een persoon escaleren – via jouw opdrachtweg, met jouw rechten.",
    "klaraqualitaet.vorschlag.konfliktOeffnen": "Het conflict in het conflictgebied bekijken.",
    "klaraqualitaet.vorschlag.duplikatEntscheidung":
      "Koppelen, gescheiden houden of samenvoegen beslis je in de vergelijking – Klara wijzigt geen van beide bijdragen.",
    "klaraqualitaet.vorschlag.bestaetigen":
      "„Klopt nog steeds” zet alleen iemand die het inhoudelijk kan beoordelen – Klara bevestigt niets.",
    "klaraqualitaet.vorschlag.quelleErsetzen":
      "Een actuele bron toevoegen of de verwijderde vervangen – in de bijdrage zelf.",
    "klaraqualitaet.vorschlag.quelleNachtragen": "In de bijdrage een bron toevoegen.",
    "klaraqualitaet.vorschlag.quelleErfragen":
      "Je mag deze bijdrage niet bewerken. Vraag {{name}} om een bron.",
    "klaraqualitaet.vorschlag.verantwortlichBenennen":
      "In de bijdrage een verantwoordelijke persoon benoemen.",
    "klaraqualitaet.vorschlag.verdeckt":
      "Neem contact op met de verantwoordelijke van deze bijdrage; die ziet beide kanten.",
    "klaraqualitaet.satz.eskalieren": "Escaleer de taak ‘{{titel}}’",
    "klaraqualitaet.bedienhilfe.erklaeren":
      "Bij een kennisbijdrage toont „Bevindingen uitleggen” open tegenstrijdigheden, duplicaten, bronouderdom en ontbrekende gegevens – telkens met bron, grondslag en onzekerheid.",
    "klaraqualitaet.bedienhilfe.vorschlag":
      "Elke bevinding heeft een concreet voorstel. Uitleggen wijzigt en blokkeert niets; opdrachten die Klara hier nog niet herkent, open je in het werkgebied.",
    "klaraqualitaet.bedienhilfe.grundlage":
      "„Geen grondslag” en „tegenstrijdige bronnen” staan er uitdrukkelijk. Je instellingen en voorkeuren veranderen het oordeel niet.",
    "klaraqualitaet.bedienhilfe.rechte":
      "Klara toont alleen wat je mag zien; verborgen andere kanten worden als zodanig benoemd.",
  },
} satisfies Textmodul;
