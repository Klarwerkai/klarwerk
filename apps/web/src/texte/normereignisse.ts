import type { Textmodul } from "./intern/pruefung";
export default {
  praefix: "normereignisse.",
  legacySchluessel: [],
  de: {
    "normereignisse.automatischerAuftragUnklar":
      "Der bestellte Originalprüfauftrag ist noch nicht eindeutig bestätigt. Nur den Originalstand nachlesen; keinen Ersatzauftrag anlegen.",
    "normereignisse.konfliktKlaeren": "Konflikt fachlich klären",
    "normereignisse.konfliktHilfe":
      "Wähle je widersprüchlicher Ereignisart einen heute eindeutig belegten Termin mit Geltungsbereich und begründe deine Entscheidung. Alle anderen Originalbelege bleiben erhalten. Neue widersprüchliche Fakten öffnen die Klärung erneut. Fehlende Angaben brauchen einen neuen Beleg. Dies ist noch keine fachliche Annahme einer Anleitung.",
    "normereignisse.ereignisWaehlen": "Eindeutigen Ereignisbeleg auswählen",
    "normereignisse.konfliktGrund": "Begründung der Konfliktklärung",
    "normereignisse.konfliktBestaetigt":
      "Diese belegten Termine und Geltungsbereiche nach Prüfung der widersprechenden Originale ausdrücklich bestätigen.",
    "normereignisse.konfliktGeklaert":
      "Konflikt fachlich geklärt durch {{person}} am {{zeit}} · Auswahl für den aktuellen Sachstand",
    "normereignisse.konfliktHistorisch":
      "Frühere Konfliktklärung durch {{person}} am {{zeit}} · für den aktuellen Sachstand nicht bestätigt",
    "normereignisse.annahmeUngeprueft":
      "Ein fachlicher Annahmebeleg lässt sich mit den heutigen Anleitungsrechten nicht prüfen.",
    "normereignisse.pruefauftrag": "Prüfauftrag am Original",
    "normereignisse.pruefauftragHilfe":
      "Verknüpfe einen bewusst beauftragten eigenen Notizauftrag aus dem aktuellen Klara-Gespräch. Seine Originalnotiz muss den Ereignisbeleg enthalten. Ausführung und Wiederaufnahme bleiben im vorhandenen Auftrag.",
    "normereignisse.pruefauftragAuswahl": "Vorhandener eigener Notizauftrag",
    "normereignisse.auftragWaehlen": "Auftrag auswählen",
    "normereignisse.auftragFehlt":
      "Der gebundene Originalauftrag fehlt. Es wird kein Ersatzauftrag angelegt.",
    "normereignisse.keinAuftrag":
      "Kein passender eigener Notizauftrag im aktuellen Gespräch. Lege ihn dort mit der tatsächlichen Originalnotiz bewusst fest.",
    "normereignisse.auftragsquelleGeaendert":
      "Die Originalnotiz wurde geändert oder ist nicht mehr verfügbar. Neue Wirkungen bleiben gesperrt; vorhandene Ergebnisse bleiben erhalten.",
    "normereignisse.auftragUnklar":
      "Der Schreibausgang ist ungeklärt. Nur das Original unter derselben Kennung nachlesen.",
    "normereignisse.aufgabeEntfernt":
      "Die ursprüngliche Aufgabe wurde entfernt. Keine Neuerstellung dieses Ereignisses.",
    "normereignisse.aufgabeOeffnen": "Originalaufgabe öffnen",
    "normereignisse.pruefschritt": "Originalprüfschritt ausführen oder nachlesen",
    "normereignisse.auftragVerknuepfen": "Diesen Originalauftrag verknüpfen",
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
    "normereignisse.leer": "Keine aktuell lesbaren Normereignisbelege verfügbar.",
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
    "normereignisse.automatischerAuftragUnklar":
      "The commissioned original review order is not yet unambiguously confirmed. Read only its original state; do not create a replacement order.",
    "normereignisse.konfliktKlaeren": "Resolve the evidence conflict",
    "normereignisse.konfliktHilfe":
      "Choose one currently unambiguous date and scope for each conflicting event type and explain your decision. All other original evidence is preserved. New conflicting facts reopen the review. Missing details require new evidence. This does not accept an instruction as a professional successor.",
    "normereignisse.ereignisWaehlen": "Choose unambiguous event evidence",
    "normereignisse.konfliktGrund": "Reason for resolving the conflict",
    "normereignisse.konfliktBestaetigt":
      "Explicitly confirm these evidenced dates and scopes after reviewing the conflicting originals.",
    "normereignisse.konfliktGeklaert":
      "Conflict resolved by {{person}} on {{zeit}} · selection for the current facts",
    "normereignisse.konfliktHistorisch":
      "Earlier conflict decision by {{person}} on {{zeit}} · not confirmed for the current facts",
    "normereignisse.annahmeUngeprueft":
      "An acceptance record cannot be checked under current instruction access rights.",
    "normereignisse.pruefauftrag": "Review at the original task",
    "normereignisse.pruefauftragHilfe":
      "Link an explicitly commissioned personal note task from the current Klara conversation. Its original note must contain the event evidence. Execution and resumption remain in the existing order.",
    "normereignisse.pruefauftragAuswahl": "Existing personal note order",
    "normereignisse.auftragWaehlen": "Select order",
    "normereignisse.auftragFehlt":
      "The linked original order is missing. No replacement order will be created.",
    "normereignisse.keinAuftrag":
      "No matching personal note order in the current conversation. Explicitly commission it there using the actual original note.",
    "normereignisse.auftragsquelleGeaendert":
      "The original note changed or is unavailable. New effects remain blocked; existing results are preserved.",
    "normereignisse.auftragUnklar":
      "The write outcome is unclear. Read only the original under the same identifier.",
    "normereignisse.aufgabeEntfernt":
      "The original task was removed. This event will not recreate it.",
    "normereignisse.aufgabeOeffnen": "Open original task",
    "normereignisse.pruefschritt": "Execute or read original review step",
    "normereignisse.auftragVerknuepfen": "Link this original order",
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
    "normereignisse.leer": "No currently readable standards event evidence available.",
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
    "normereignisse.automatischerAuftragUnklar":
      "De oorspronkelijke bestelde controleopdracht is nog niet eenduidig bevestigd. Lees alleen de oorspronkelijke stand; maak geen vervangende opdracht.",
    "normereignisse.konfliktKlaeren": "Tegenstrijdig bewijs inhoudelijk beoordelen",
    "normereignisse.konfliktHilfe":
      "Kies per tegenstrijdig gebeurtenistype één nu eenduidig bewezen datum met toepassingsgebied en motiveer je keuze. Alle andere oorspronkelijke bewijzen blijven bewaard. Nieuwe tegenstrijdige feiten openen de beoordeling opnieuw. Ontbrekende gegevens vragen om nieuw bewijs. Dit is nog geen inhoudelijke acceptatie van een instructie.",
    "normereignisse.ereignisWaehlen": "Eenduidig gebeurtenisbewijs kiezen",
    "normereignisse.konfliktGrund": "Motivering van de conflictbeoordeling",
    "normereignisse.konfliktBestaetigt":
      "Deze bewezen datums en toepassingsgebieden na beoordeling van de tegenstrijdige originelen uitdrukkelijk bevestigen.",
    "normereignisse.konfliktGeklaert":
      "Conflict beoordeeld door {{person}} op {{zeit}} · keuze voor de huidige feiten",
    "normereignisse.konfliktHistorisch":
      "Eerdere conflictbeoordeling door {{person}} op {{zeit}} · niet bevestigd voor de huidige feiten",
    "normereignisse.annahmeUngeprueft":
      "Een inhoudelijke acceptatie kan met de huidige toegangsrechten niet worden gecontroleerd.",
    "normereignisse.pruefauftrag": "Controle bij de oorspronkelijke taak",
    "normereignisse.pruefauftragHilfe":
      "Koppel een bewust opgedragen eigen notitieopdracht uit het huidige Klara-gesprek. De oorspronkelijke notitie moet het gebeurtenisbewijs bevatten. Uitvoering en hervatting blijven in de bestaande opdracht.",
    "normereignisse.pruefauftragAuswahl": "Bestaande eigen notitieopdracht",
    "normereignisse.auftragWaehlen": "Opdracht kiezen",
    "normereignisse.auftragFehlt":
      "De gekoppelde oorspronkelijke opdracht ontbreekt. Er wordt geen vervangende opdracht gemaakt.",
    "normereignisse.keinAuftrag":
      "Geen passende eigen notitieopdracht in het huidige gesprek. Geef daar bewust opdracht met de echte oorspronkelijke notitie.",
    "normereignisse.auftragsquelleGeaendert":
      "De oorspronkelijke notitie is gewijzigd of niet beschikbaar. Nieuwe effecten blijven geblokkeerd; bestaande resultaten blijven behouden.",
    "normereignisse.auftragUnklar":
      "De schrijfuitkomst is onduidelijk. Lees alleen het origineel onder dezelfde identificatie.",
    "normereignisse.aufgabeEntfernt":
      "De oorspronkelijke taak is verwijderd. Deze gebeurtenis maakt haar niet opnieuw aan.",
    "normereignisse.aufgabeOeffnen": "Oorspronkelijke taak openen",
    "normereignisse.pruefschritt": "Oorspronkelijke controlestap uitvoeren of lezen",
    "normereignisse.auftragVerknuepfen": "Deze oorspronkelijke opdracht koppelen",
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
    "normereignisse.leer": "Geen momenteel leesbare normgebeurtenisbewijzen beschikbaar.",
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
