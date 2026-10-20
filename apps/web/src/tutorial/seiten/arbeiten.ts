import type { SeitenEintrag } from "./typen";
export const ARBEITEN: readonly SeitenEintrag[] = [
  {
    id: "erfassen",
    pfade: ["/erfassen", "/erfassen/neu", "/capture/frontdoor"],
    titelKey: "nav.capture",
    ziel: 'main input:not([type="hidden"]), main [contenteditable="true"]',
    aktion: [
      "Wähle den passenden Erfassungsweg, gib Inhalt ein und prüfe Titel, Vertraulichkeit und Quellen vor Speichern oder Einreichen.",
      "Choose a capture method, enter content and review title, confidentiality and sources before saving or submitting.",
      "Kies een vastlegmethode, voer inhoud in en controleer titel, vertrouwelijkheid en bronnen vóór opslaan of indienen.",
    ],
    ergebnis: [
      "Entwurf, gespeicherter Beitrag und Freigabe sind verschiedene Zustände. Nur die tatsächliche Rückmeldung bestätigt den Speichervorgang.",
      "Draft, saved contribution and approval are different states. Only the actual response confirms a save.",
      "Concept, opgeslagen bijdrage en goedkeuring zijn verschillende statussen. Alleen de echte terugmelding bevestigt opslaan.",
    ],
    sonderfall: [
      "Bei Fehler oder Zeitüberschreitung Eingaben behalten und Bibliothek beziehungsweise Entwürfe prüfen, bevor du erneut speicherst.",
      "After an error or timeout, keep your input and check the Library or drafts before saving again.",
      "Bewaar bij een fout of time-out je invoer en controleer Bibliotheek of concepten voordat je opnieuw opslaat.",
    ],
  },
  {
    id: "entwuerfe",
    pfade: ["/entwuerfe"],
    titelKey: "mob.drafts",
    ziel: '[data-testid="page-entwuerfe"]',
    aktion: [
      "Öffne einen eigenen Entwurf zum Fortsetzen; suche bei Bedarf in Meine Ablage oder prüfe den Papierkorb.",
      "Open your draft to continue; search your own collection or check the trash when needed.",
      "Open je concept om verder te werken; zoek zo nodig in je eigen verzameling of controleer de prullenbak.",
    ],
    ergebnis: [
      "Ein Entwurf ist keine freigegebene Wissensfassung. Die Übersicht verwendet denselben Entwurfsbestand wie der Editor.",
      "A draft is not approved knowledge. This overview uses the same drafts as the editor.",
      "Een concept is geen goedgekeurde kennis. Dit overzicht gebruikt dezelfde concepten als de editor.",
    ],
    sonderfall: [
      "Bei Ladefehler erneut laden. Eine leere Liste kann durch Suchraum oder Filter entstehen.",
      "Retry after a loading error. Search scope or filters can cause an empty list.",
      "Laad opnieuw na een laadfout. Zoekbereik of filters kunnen een lege lijst veroorzaken.",
    ],
  },
  {
    id: "ablauf",
    pfade: ["/erfassen/ablauf"],
    titelKey: "nav.capture",
    ziel: '[data-testid="ablauf-datei"]',
    aktion: [
      "Lade die Ablaufdatei, prüfe Schritte und Bilder, schwärze private Inhalte und entscheide bewusst zwischen Speichern und Einreichen.",
      "Load the workflow file, inspect steps and images, redact private content and deliberately choose Save or Submit.",
      "Laad het procesbestand, controleer stappen en afbeeldingen, scherm privé-inhoud af en kies bewust Opslaan of Indienen.",
    ],
    ergebnis: [
      "Ungespeichert, gespeichert und eingereicht werden getrennt angezeigt; das Tutorial führt keine Einreichung aus.",
      "Unsaved, saved and submitted states are shown separately; the tutorial does not submit anything.",
      "Niet opgeslagen, opgeslagen en ingediend worden apart getoond; de tutorial dient niets in.",
    ],
    sonderfall: [
      "Bei Dateifehler den sichtbaren Grund prüfen. Vor dem Verlassen ungespeicherte Änderungen beachten.",
      "For a file error, read the displayed reason. Check for unsaved changes before leaving.",
      "Lees bij een bestandsfout de getoonde reden. Controleer niet-opgeslagen wijzigingen vóór vertrek.",
    ],
  },
  {
    id: "aufgaben",
    pfade: ["/aufgaben"],
    titelKey: "nav.tasks",
    ziel: '[data-testid="aufgaben-persoenlich"]',
    aktion: [
      "Öffne die Aufgabe und ihren Originalbezug. Persönliche Aufgaben und Erinnerungen haben eigene Bereiche; Erledigen ist eine bewusste Handlung.",
      "Open the task and its original context. Personal tasks and reminders have separate sections; completing is deliberate.",
      "Open de taak en de oorspronkelijke context. Persoonlijke taken en herinneringen hebben eigen onderdelen; afronden is bewust.",
    ],
    ergebnis: [
      "Lies Status, Zuständigkeit und Ergebnis. Eine gespeicherte Notiz erledigt nicht automatisch die zugehörige Aufgabe.",
      "Read status, owner and result. Saving a note does not automatically complete its task.",
      "Lees status, verantwoordelijke en resultaat. Een notitie opslaan voltooit niet automatisch de taak.",
    ],
    sonderfall: [
      "Bei pausiertem oder veraltetem Stand die Erklärung und Wie weiter öffnen.",
      "For a paused or stale state, open the explanation and next-step help.",
      "Open bij een gepauzeerde of verouderde status de uitleg en vervolghulp.",
    ],
    hilfeKeys: [
      "klaraaufgabe.bedienhilfe.bearbeiten",
      "klaraerinnerung.bedienhilfe.anlegen",
      "klaranotiz.bedienhilfe.anlegen",
    ],
  },
  {
    id: "pruefen",
    pfade: ["/validierung"],
    titelKey: "kopfband.pruefen",
    ziel: '[data-testid="pruefen-warteschlange"]',
    aktion: [
      "Wähle einen Beitrag in der Warteschlange, prüfe Inhalt und Belege und entscheide mit deiner Prüfrolle über Freigabe oder Rückfrage.",
      "Select a contribution in the queue, review content and evidence and use your reviewer role to approve or ask a question.",
      "Kies een bijdrage in de wachtrij, beoordeel inhoud en bewijs en keur met je beoordelaarsrol goed of stel een vraag.",
    ],
    ergebnis: [
      "Nur eine tatsächlich bestätigte Entscheidung ändert den Prüfstand. Ein Tutorialabschluss gibt nichts frei.",
      "Only a confirmed decision changes review status. Completing a tutorial approves nothing.",
      "Alleen een bevestigde beslissing verandert de beoordelingsstatus. Een tutorial afronden keurt niets goed.",
    ],
    sonderfall: [
      "Bei inzwischen entschiedenem oder fehlendem Objekt den aktuellen Stand öffnen; Stapelaktionen vor Bestätigung prüfen.",
      "For an already decided or missing item, open its current state; review batch actions before confirmation.",
      "Open bij een reeds beslist of ontbrekend item de huidige status; controleer bulkacties vóór bevestiging.",
    ],
  },
  {
    id: "konflikte",
    pfade: ["/konflikte", "/konflikte/:id/vergleich"],
    titelKey: "nav.conflicts",
    ziel: '[data-testid="pruefen-flaeche"]',
    aktion: [
      "Vergleiche die widersprechenden Beiträge und Quellen; ordne Geltung und Vorrang ein, bevor du eine begründete Auflösung sendest.",
      "Compare conflicting contributions and sources; assess applicability and precedence before submitting a reasoned resolution.",
      "Vergelijk tegenstrijdige bijdragen en bronnen; beoordeel geldigheid en voorrang vóór een gemotiveerde oplossing.",
    ],
    ergebnis: [
      "Vorschlag, Zweitmeinung und abgeschlossene Auflösung sind unterscheidbar. Die Entscheidung bleibt bei der Prüfrolle.",
      "Proposal, second opinion and completed resolution are distinct. The reviewer makes the decision.",
      "Voorstel, tweede mening en afgeronde oplossing zijn verschillend. De beoordelaar beslist.",
    ],
    sonderfall: [
      "Fehlt die Beweislage, klären oder eskalieren statt unbelegt auflösen.",
      "When evidence is missing, clarify or escalate before resolving.",
      "Ontbreekt bewijs, vraag dan om verduidelijking of escaleer vóór een oplossing.",
    ],
  },
  {
    id: "duplikate",
    pfade: ["/duplikate", "/duplikate/:id/vergleich"],
    titelKey: "nav.duplicates",
    ziel: '[data-testid="pruefen-flaeche"]',
    aktion: [
      "Vergleiche die vermuteten Dubletten und ihre Quellen. Prüfe den Eigenanteil, bevor du Zusammenführen öffnest.",
      "Compare suspected duplicates and their sources. Check unique content before opening Merge.",
      "Vergelijk vermoedelijke duplicaten en bronnen. Controleer unieke inhoud vóór Samenvoegen.",
    ],
    ergebnis: [
      "Ein Vergleich verändert noch keinen Artikel; erst eine bestätigte Entscheidung schließt den Vorgang ab.",
      "Comparison does not change an article; a confirmed decision completes the process.",
      "Vergelijken verandert nog geen artikel; een bevestigde beslissing voltooit het proces.",
    ],
    sonderfall: [
      "Bei unterschiedlichen Aussagen den Konfliktweg beachten; ähnliche Titel allein belegen keine Dublette.",
      "For different claims, consider the conflict route; similar titles alone do not prove duplication.",
      "Overweeg bij verschillende uitspraken de conflictroute; gelijke titels bewijzen geen duplicaat.",
    ],
  },
  {
    id: "zusammenfuehren",
    pfade: ["/duplikate/:id/zusammenfuehren"],
    titelKey: "nav.duplicates",
    ziel: '[data-testid="zusammenfuehren-schritte"]',
    aktion: [
      "Wähle Führung, Inhalte und Quellen, prüfe die Vorschau und bestätige die Freigabe erst nach Prüfung aller Folgen.",
      "Choose the leading article, content and sources, review the preview and approve only after checking the consequences.",
      "Kies hoofdartikel, inhoud en bronnen, controleer het voorbeeld en keur pas goed na controle van de gevolgen.",
    ],
    ergebnis: [
      "Die Vorschau ist noch keine gespeicherte Zusammenführung. Die bestätigte Ergebnisansicht belegt die Wirkung.",
      "The preview is not a saved merge. The confirmed result shows the effect.",
      "Het voorbeeld is nog geen opgeslagen samenvoeging. Het bevestigde resultaat toont het effect.",
    ],
    sonderfall: [
      "Bei veraltetem Stand neu lesen und Entscheidungen prüfen; Zurück verändert noch keine Freigabe.",
      "For a stale version, reload and review decisions; Back does not change approval.",
      "Laad bij een verouderde versie opnieuw en controleer keuzes; Terug verandert geen goedkeuring.",
    ],
  },
  {
    id: "spaces",
    pfade: ["/spaces", "/spaces/:id"],
    titelKey: "spaces.seite.titel",
    ziel: '[data-testid="space-detail"], [data-testid="space-eintrag"], main h1',
    aktion: [
      "Öffne einen sichtbaren Space und seine Artikel. Bearbeiten verlangt Schreibrecht oder Zuständigkeit; zum Anlegen ist Prüfberechtigung nötig.",
      "Open a visible Space and its articles. Editing requires write access or ownership; creating requires review permission.",
      "Open een zichtbare Space en artikelen. Bewerken vereist schrijfrecht of verantwoordelijkheid; aanmaken vereist beoordelingsrecht.",
    ],
    ergebnis: [
      "Prüfe Mitglieder, Regeln und Sichtbarkeit. Erst Speichern bestätigt eine Änderung; Space-Rechte ersetzen keine Artikelrechte.",
      "Check members, rules and visibility. Only saving confirms a change; Space access does not replace article access.",
      "Controleer leden, regels en zichtbaarheid. Alleen opslaan bevestigt wijzigingen; Space-rechten vervangen geen artikelrechten.",
    ],
    sonderfall: [
      "Bei nicht gefundenem Space oder fehlendem Schreibknopf heutige Rechte beachten; Löschen erklärt eigene Folgen vor Bestätigung.",
      "For a missing Space or editing control, respect current permissions; deletion explains its consequences before confirmation.",
      "Respecteer bij een ontbrekende Space of bewerkknop de huidige rechten; verwijderen toont gevolgen vóór bevestiging.",
    ],
  },
  {
    id: "chat",
    pfade: ["/chat", "/chat/:id"],
    titelKey: "chat.seite.titel",
    ziel: '[data-testid="chat-eingabe"], [data-testid="chat-neu-oeffnen"]',
    aktion: [
      "Wähle ein Gespräch und prüfe Empfänger sowie Sichtbarkeit, bevor du eine Nachricht sendest. Wissensübernahme ist ein eigener Entwurfsweg.",
      "Choose a conversation and check recipients and visibility before sending. Knowledge transfer creates a separate draft.",
      "Kies een gesprek en controleer ontvangers en zichtbaarheid vóór verzenden. Kennisoverdracht maakt een apart concept.",
    ],
    ergebnis: [
      "Klara-Nachrichtenentwurf, gesendete Nachricht und Wissensentwurf bleiben getrennte Ergebnisse.",
      "Klara's message draft, sent message and knowledge draft are separate results.",
      "Klara's berichtconcept, verzonden bericht en kennisconcept zijn aparte resultaten.",
    ],
    sonderfall: [
      "Bei Sendefehler den sichtbaren Status prüfen. Gesperrte Anhänge und Verweise bleiben gesperrt.",
      "For a sending error, check the displayed status. Restricted attachments and references remain restricted.",
      "Controleer bij een verzendfout de getoonde status. Afgeschermde bijlagen en verwijzingen blijven afgeschermd.",
    ],
  },
  {
    id: "gemeinsam",
    pfade: ["/wissen/:id/gemeinsam"],
    titelKey: "nav.capture",
    ziel: '[data-testid="gemeinsam-editor"]',
    aktion: [
      "Bearbeite den gemeinsamen Entwurf mit Schreibrecht und speichere deine Fassung. Prüfe fremde Änderungen vor dem Angleichen.",
      "Edit the shared draft with write permission and save your version. Review other changes before reconciling.",
      "Bewerk het gezamenlijke concept met schrijfrecht en sla je versie op. Controleer andere wijzigingen vóór afstemming.",
    ],
    ergebnis: [
      "Gemeinsamer Entwurf, Übernahmevorschlag und freigegebener Artikel sind getrennt.",
      "Shared draft, transfer proposal and approved article are separate states.",
      "Gezamenlijk concept, overnamevoorstel en goedgekeurd artikel zijn aparte statussen.",
    ],
    sonderfall: [
      "Bei Konflikt eigene und fremde Fassung vergleichen. Ohne Schreibrecht bleibt die Lesefassung; Klara ändert keine Rechte.",
      "For a conflict, compare both versions. Without write access, use the reading version; Klara does not change permissions.",
      "Vergelijk bij een conflict beide versies. Zonder schrijfrecht blijft de leesversie; Klara wijzigt geen rechten.",
    ],
  },
  {
    id: "gesamtanweisungen",
    pfade: ["/gesamtanweisungen", "/gesamtanweisungen/:id"],
    titelKey: "ga.bereich.titel",
    ziel: "main h1",
    aktion: [
      "Wähle die Teile der Gesamtanweisung und prüfe Lesestand sowie Vergleich. Anlegen verlangt Erfassungsrecht, Prüfen die Prüfrolle.",
      "Choose the instruction parts and check reading status and comparison. Creating requires capture permission; review requires the reviewer role.",
      "Kies instructiedelen en controleer leesstatus en vergelijking. Aanmaken vereist vastlegrecht; beoordelen de beoordelaarsrol.",
    ],
    ergebnis: [
      "Die Gesamtanweisung behält den Bezug zu ihren Teilen und Fassungen. Ein Lesestand ist keine neue Freigabe.",
      "The instruction retains links to its parts and versions. A reading state is not a new approval.",
      "De instructie behoudt verwijzingen naar delen en versies. Een leesstatus is geen nieuwe goedkeuring.",
    ],
    sonderfall: [
      "Fehlende Teile oder Rechte anhand der Meldung klären; nicht zugängliche Inhalte werden nicht ergänzt.",
      "Clarify missing parts or permissions using the notice; inaccessible content is not filled in.",
      "Verduidelijk ontbrekende delen of rechten via de melding; ontoegankelijke inhoud wordt niet aangevuld.",
    ],
  },
  {
    id: "besprechungen",
    pfade: ["/besprechungen", "/besprechungen/:id"],
    titelKey: "besprechungen.titel",
    ziel: '[data-testid="besprechungen-anlegen"], [data-testid="besprechung-dateien"]',
    aktion: [
      "Öffne eine zugängliche Besprechung; verbinde Folien und Mitschrift mit Erfassungsrecht und prüfe die Zuordnung vor Rückmeldungen.",
      "Open an accessible meeting; connect slides and transcript with capture permission and check references before feedback.",
      "Open een toegankelijke bespreking; verbind dia's en transcript met vastlegrecht en controleer verwijzingen vóór feedback.",
    ],
    ergebnis: [
      "Rückmeldung, Quellenbezug und daraus übernommenes Wissen sind eigenständige Ergebnisse.",
      "Feedback, source references and transferred knowledge are separate results.",
      "Feedback, bronverwijzingen en overgenomen kennis zijn aparte resultaten.",
    ],
    sonderfall: [
      "Bei offener Zuordnung oder gesperrter Folie dem sichtbaren Hinweis folgen; Teilnahme gibt nicht automatisch Dateirechte.",
      "Follow notices for unresolved references or restricted slides; participation does not automatically grant file access.",
      "Volg meldingen voor open verwijzingen of afgeschermde dia's; deelname geeft niet automatisch bestandsrechten.",
    ],
  },
  {
    id: "kalender",
    pfade: ["/kalender"],
    titelKey: "kalender.titel",
    ziel: '[data-testid="kalender-eintrag"], main h1',
    aktion: [
      "Öffne einen eigenen Kalendereintrag und prüfe Zeit, Zeitzone, Herkunft und verknüpften Auftrag vor Bearbeiten.",
      "Open your calendar entry and check time, time zone, origin and linked task before editing.",
      "Open je kalenderitem en controleer tijd, tijdzone, herkomst en gekoppelde opdracht vóór bewerken.",
    ],
    ergebnis: [
      "Ein Kalendereintrag, eine Erinnerung und eine ausgeführte Arbeit sind unterschiedliche Ergebnisse.",
      "A calendar entry, a reminder and completed work are different results.",
      "Een kalenderitem, herinnering en uitgevoerde taak zijn verschillende resultaten.",
    ],
    sonderfall: [
      "Geschützte oder unaufgelöste Bezüge beachten. Bei Serien die angezeigten Folgen vor Bestätigung prüfen.",
      "Respect protected or unresolved references. For recurring entries, review the displayed consequences before confirming.",
      "Respecteer beschermde of onopgeloste verwijzingen. Controleer bij herhaling de gevolgen vóór bevestiging.",
    ],
    hilfeKeys: ["klaraerinnerung.bedienhilfe.anlegen"],
  },
];
