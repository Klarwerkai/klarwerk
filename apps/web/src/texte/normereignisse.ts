import type { Textmodul } from "./intern/pruefung";
export default {
  praefix: "normereignisse.",
  legacySchluessel: [],
  de: {
    "normereignisse.titel": "Normbekanntmachungen und fachliche Ablösung",
    "normereignisse.hilfe":
      "Begrenzte Bekanntmachungen aus ausgewählten Wissensobjekten mit getrennten Ereignissen, Terminen und Geltungsbereichen erfassen.",
    "normereignisse.grenze":
      "Eine Bekanntmachung ändert keine geltende Anleitung. Vollständige Normtexte werden über diesen Weg weder beschafft noch verarbeitet.",
    "normereignisse.suche": "Bekanntmachungsquelle suchen (mindestens zwei Zeichen)",
    "normereignisse.auswahl": "{{anzahl}} von höchstens 20 Quellen ausgewählt",
    "normereignisse.erlaubt":
      "Ich darf diese begrenzten Bekanntmachungen in diesem Umfang verarbeiten.",
    "normereignisse.vorschau": "Bekanntmachungen ohne Wirkung prüfen",
    "normereignisse.vorschauHilfe":
      "Die Vorschau liest nur. Erfassen übernimmt Ereignisbelege; eine fachliche Annahme erfolgt gesondert.",
    "normereignisse.erfassen": "Ereignisbelege erfassen",
    "normereignisse.laeuft": "Wird geprüft …",
    "normereignisse.aktualisieren": "Aktuellen Stand lesen",
    "normereignisse.fehler":
      "Der aktuelle Stand konnte nicht bestätigt werden. Eingaben und Quellen bitte prüfen und erneut versuchen.",
    "normereignisse.leer": "Noch keine Normereignisbelege erfasst.",
    "normereignisse.keinSuchtreffer": "Keine lesbare Quelle gefunden.",
    "normereignisse.norm": "Norm {{kennung}} · Ausgabe {{ausgabe}}",
    "normereignisse.datumOffen": "Datum offen",
    "normereignisse.geltung": "Geltungsbereich",
    "normereignisse.geltungOffen": "Geltungsbereich offen",
    "normereignisse.quelleOeffnen": "Originalbekanntmachung öffnen",
    "normereignisse.belege": "Belege und offene Angaben",
    "normereignisse.historisch": "Historischer Beleg · Quellfassung geändert",
    "normereignisse.begrenzt": "Begrenzte Bekanntmachung",
    "normereignisse.klaerung":
      "Angaben sind nicht eindeutig belegt. Bitte den Wortlaut prüfen; offene Angaben bleiben offen.",
    "normereignisse.keinBeleg": "Eigener Ereignisbeleg fehlt",
    "normereignisse.angekuendigt": "Ankündigung",
    "normereignisse.veroeffentlicht": "Veröffentlichung",
    "normereignisse.inkrafttreten": "Inkrafttreten",
    "normereignisse.uebergangsfrist": "Übergangsfrist",
    "normereignisse.widerspruch":
      "Termine oder Geltungsbereiche widersprechen sich. Vor einer fachlichen Annahme klären; ein jüngerer Beleg ersetzt den anderen nicht.",
    "normereignisse.annahme": "Fachliche Ablösung dokumentieren",
    "normereignisse.annahmeHilfe":
      "Wähle eine belegte bisherige Fassung und den heute freigegebenen Nachfolger aus der gespeicherten Normzuordnung.",
    "normereignisse.bisher": "Bisherige Anleitungsfassung",
    "normereignisse.nachfolger": "Freigegebene Nachfolgefassung",
    "normereignisse.fassung": "{{titel}} · Fassung {{fassung}}",
    "normereignisse.waehlen": "Fassung auswählen",
    "normereignisse.keineFachfassungen":
      "Keine passenden fachlich belegten Anleitungsfassungen verfügbar. Freigabe und gespeicherte Normzuordnung am Original prüfen.",
    "normereignisse.begruendung": "Begründung der fachlichen Annahme",
    "normereignisse.bestaetigt":
      "Diese konkrete freigegebene Fassung für den genannten Bereich als fachlichen Nachfolger annehmen.",
    "normereignisse.angenommen":
      "Fachlich angenommen durch {{person}} am {{zeit}} · Geltung: {{geltung}}",
    "normereignisse.quellenUngeprueft":
      "Mindestens eine Quelle wurde nicht ausgewertet. Das ist kein vollständiger Nullbefund.",
    "normereignisse.pruefungOffen":
      "Fachliche Prüfung offen. Bekanntmachung und Kalenderdatum sind keine fachliche Annahme.",
    "normereignisse.betroffen": "Gespeicherte Normzuordnung zur Anleitung · Fassung {{fassung}}",
    "normereignisse.umfang":
      "Angezeigt werden nur heute lesbare, ausdrücklich zugeordnete Einträge. Ähnlichkeit wurde nicht als Abhängigkeit übernommen.",
  },
  en: {
    "normereignisse.titel": "Standards notices and professional replacement",
    "normereignisse.hilfe":
      "Record limited notices from selected knowledge objects with separate events, dates and scopes.",
    "normereignisse.grenze":
      "A notice does not change an approved instruction. This route neither obtains nor processes full standards texts.",
    "normereignisse.suche": "Find a notice source (at least two characters)",
    "normereignisse.auswahl": "{{anzahl}} of at most 20 sources selected",
    "normereignisse.erlaubt": "I am permitted to process these limited notices within this scope.",
    "normereignisse.vorschau": "Check notices without effects",
    "normereignisse.vorschauHilfe":
      "The preview only reads. Recording saves event evidence; professional acceptance is separate.",
    "normereignisse.erfassen": "Record event evidence",
    "normereignisse.laeuft": "Checking …",
    "normereignisse.aktualisieren": "Read current state",
    "normereignisse.fehler":
      "The current state could not be confirmed. Please check your entries and sources and try again.",
    "normereignisse.leer": "No standards event evidence recorded yet.",
    "normereignisse.keinSuchtreffer": "No readable source found.",
    "normereignisse.norm": "Standard {{kennung}} · edition {{ausgabe}}",
    "normereignisse.datumOffen": "Date unknown",
    "normereignisse.geltung": "Scope",
    "normereignisse.geltungOffen": "Scope unknown",
    "normereignisse.quelleOeffnen": "Open original notice",
    "normereignisse.belege": "Evidence and open details",
    "normereignisse.historisch": "Historical evidence · source version changed",
    "normereignisse.begrenzt": "Limited notice",
    "normereignisse.klaerung":
      "The details are not unambiguously evidenced. Please check the wording; missing details remain unknown.",
    "normereignisse.keinBeleg": "Separate event evidence missing",
    "normereignisse.angekuendigt": "Announcement",
    "normereignisse.veroeffentlicht": "Publication",
    "normereignisse.inkrafttreten": "Entry into force",
    "normereignisse.uebergangsfrist": "Transition deadline",
    "normereignisse.widerspruch":
      "Dates or scopes conflict. Resolve this before professional acceptance; newer evidence does not replace the other.",
    "normereignisse.annahme": "Record professional replacement",
    "normereignisse.annahmeHilfe":
      "Choose an evidenced previous version and the currently approved successor from the stored standards assignment.",
    "normereignisse.bisher": "Previous instruction version",
    "normereignisse.nachfolger": "Approved successor version",
    "normereignisse.fassung": "{{titel}} · version {{fassung}}",
    "normereignisse.waehlen": "Choose a version",
    "normereignisse.keineFachfassungen":
      "No matching professionally evidenced instruction versions are available. Check approval and the stored standards assignment on the original.",
    "normereignisse.begruendung": "Reason for professional acceptance",
    "normereignisse.bestaetigt":
      "Accept this specific approved version as the professional successor for the stated scope.",
    "normereignisse.angenommen":
      "Professionally accepted by {{person}} on {{zeit}} · scope: {{geltung}}",
    "normereignisse.quellenUngeprueft":
      "At least one source was not evaluated. This is not a complete finding of no events.",
    "normereignisse.pruefungOffen":
      "Professional review pending. A notice or calendar date is not professional acceptance.",
    "normereignisse.betroffen":
      "Stored standards assignment to the instruction · version {{fassung}}",
    "normereignisse.umfang":
      "Only currently readable, explicitly assigned entries are shown. Similarity was not treated as a dependency.",
  },
  nl: {
    "normereignisse.titel": "Normbekendmakingen en vakinhoudelijke vervanging",
    "normereignisse.hilfe":
      "Beperkte bekendmakingen uit geselecteerde kennisobjecten vastleggen met afzonderlijke gebeurtenissen, datums en toepassingsgebieden.",
    "normereignisse.grenze":
      "Een bekendmaking wijzigt geen goedgekeurde instructie. Deze route verkrijgt of verwerkt geen volledige normteksten.",
    "normereignisse.suche": "Bekendmakingsbron zoeken (minstens twee tekens)",
    "normereignisse.auswahl": "{{anzahl}} van maximaal 20 bronnen geselecteerd",
    "normereignisse.erlaubt": "Ik mag deze beperkte bekendmakingen binnen deze omvang verwerken.",
    "normereignisse.vorschau": "Bekendmakingen zonder gevolgen controleren",
    "normereignisse.vorschauHilfe":
      "Het voorbeeld leest alleen. Vastleggen bewaart gebeurtenisbewijzen; vakinhoudelijke aanvaarding gebeurt afzonderlijk.",
    "normereignisse.erfassen": "Gebeurtenisbewijzen vastleggen",
    "normereignisse.laeuft": "Wordt gecontroleerd …",
    "normereignisse.aktualisieren": "Actuele stand lezen",
    "normereignisse.fehler":
      "De actuele stand kon niet worden bevestigd. Controleer je invoer en bronnen en probeer opnieuw.",
    "normereignisse.leer": "Nog geen normgebeurtenisbewijzen vastgelegd.",
    "normereignisse.keinSuchtreffer": "Geen leesbare bron gevonden.",
    "normereignisse.norm": "Norm {{kennung}} · uitgave {{ausgabe}}",
    "normereignisse.datumOffen": "Datum onbekend",
    "normereignisse.geltung": "Toepassingsgebied",
    "normereignisse.geltungOffen": "Toepassingsgebied onbekend",
    "normereignisse.quelleOeffnen": "Oorspronkelijke bekendmaking openen",
    "normereignisse.belege": "Bewijzen en open gegevens",
    "normereignisse.historisch": "Historisch bewijs · bronversie gewijzigd",
    "normereignisse.begrenzt": "Beperkte bekendmaking",
    "normereignisse.klaerung":
      "De gegevens zijn niet eenduidig onderbouwd. Controleer de bewoording; ontbrekende gegevens blijven onbekend.",
    "normereignisse.keinBeleg": "Afzonderlijk gebeurtenisbewijs ontbreekt",
    "normereignisse.angekuendigt": "Aankondiging",
    "normereignisse.veroeffentlicht": "Publicatie",
    "normereignisse.inkrafttreten": "Inwerkingtreding",
    "normereignisse.uebergangsfrist": "Overgangstermijn",
    "normereignisse.widerspruch":
      "Datums of toepassingsgebieden spreken elkaar tegen. Eerst verduidelijken voor vakinhoudelijke aanvaarding; nieuwer bewijs vervangt het andere niet.",
    "normereignisse.annahme": "Vakinhoudelijke vervanging vastleggen",
    "normereignisse.annahmeHilfe":
      "Kies een onderbouwde eerdere versie en de nu goedgekeurde opvolger uit de opgeslagen normtoewijzing.",
    "normereignisse.bisher": "Eerdere instructieversie",
    "normereignisse.nachfolger": "Goedgekeurde opvolgversie",
    "normereignisse.fassung": "{{titel}} · versie {{fassung}}",
    "normereignisse.waehlen": "Versie kiezen",
    "normereignisse.keineFachfassungen":
      "Geen passende vakinhoudelijk onderbouwde instructieversies beschikbaar. Controleer goedkeuring en de opgeslagen normtoewijzing op het origineel.",
    "normereignisse.begruendung": "Reden voor vakinhoudelijke aanvaarding",
    "normereignisse.bestaetigt":
      "Deze concrete goedgekeurde versie voor het genoemde gebied als vakinhoudelijke opvolger aanvaarden.",
    "normereignisse.angenommen":
      "Vakinhoudelijk aanvaard door {{person}} op {{zeit}} · gebied: {{geltung}}",
    "normereignisse.quellenUngeprueft":
      "Minstens één bron is niet geëvalueerd. Dit is geen volledige vaststelling dat er geen gebeurtenissen zijn.",
    "normereignisse.pruefungOffen":
      "Vakinhoudelijke controle staat open. Een bekendmaking of kalenderdatum is geen vakinhoudelijke aanvaarding.",
    "normereignisse.betroffen": "Opgeslagen normtoewijzing aan de instructie · versie {{fassung}}",
    "normereignisse.umfang":
      "Alleen nu leesbare, uitdrukkelijk toegewezen items worden getoond. Gelijkenis is niet als afhankelijkheid overgenomen.",
  },
} satisfies Textmodul;
