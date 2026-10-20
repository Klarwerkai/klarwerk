import type { SeitenEintrag } from "./typen";
export const LESEN: readonly SeitenEintrag[] = [
  {
    id: "start",
    pfade: ["/start"],
    titelKey: "nav.start",
    ziel: '[data-testid="page-start"]',
    aktion: [
      "Wähle auf der Startseite Fragen, Bibliothek oder Erfassen passend zu deinem Vorhaben.",
      "Choose Ask, Library or Capture on the home page for your task.",
      "Kies op de startpagina Vragen, Bibliotheek of Vastleggen voor je taak.",
    ],
    ergebnis: [
      "Das Öffnen eines Bereichs verändert noch kein Wissen.",
      "Opening a section does not change knowledge.",
      "Een onderdeel openen verandert nog geen kennis.",
    ],
    sonderfall: [
      "Fehlt ein Weg, prüfe deine aktuelle Rolle. Klara erklärt auch die sichtbare Seite.",
      "If a route is missing, check your current role. Klara can explain the visible page.",
      "Ontbreekt een route, controleer dan je huidige rol. Klara kan de zichtbare pagina uitleggen.",
    ],
  },
  {
    id: "bibliothek",
    pfade: ["/bibliothek"],
    titelKey: "nav.library",
    ziel: '[data-testid="bib-suchfeld"]',
    aktion: [
      "Suche im Suchfeld, wähle den Suchraum einschließlich Meine Ablage und öffne einen Treffer. Filter schränken die Liste ein.",
      "Search, choose the search scope including your own collection, and open a result. Filters narrow the list.",
      "Zoek, kies het zoekbereik inclusief je eigen verzameling en open een resultaat. Filters beperken de lijst.",
    ],
    ergebnis: [
      "Lies den Treffergrund, Artikelstand und Quellenbezug. Eine KI-Antwort ist gesondert gekennzeichnet.",
      "Read the match reason, article version and sources. An AI answer has a separate label.",
      "Lees de reden van de match, artikelversie en bronnen. Een AI-antwoord heeft een apart label.",
    ],
    sonderfall: [
      "Bei leerer Liste Suchraum und Filter prüfen oder Filter aufheben. Gesperrte Inhalte werden dadurch nicht zugänglich.",
      "For an empty list, check the scope and filters or clear them. This does not grant access to restricted content.",
      "Controleer bij een lege lijst bereik en filters of wis ze. Dit geeft geen toegang tot afgeschermde inhoud.",
    ],
  },
  {
    id: "artikel",
    pfade: ["/wissen/:id"],
    titelKey: "nav.library",
    ziel: '[data-testid="bib-lesen"]',
    aktion: [
      "Lies den Artikel und seine Fassung. Öffne Mehr für Quellen, Originalbezug und Prüfstand; gemeinsame Bearbeitung ist ein eigener erlaubnispflichtiger Weg.",
      "Read the article and its version. Open More for sources, originals and review status; collaborative editing requires its own permission.",
      "Lees het artikel en de versie. Open Meer voor bronnen, originelen en beoordelingsstatus; samen bewerken vereist eigen rechten.",
    ],
    ergebnis: [
      "Vergleiche Quellenstand und Geltung mit deiner Frage. Eine Lesefassung oder Übersetzung ersetzt keine neue Freigabe.",
      "Compare source status and applicability with your question. A reading version or translation is not a new approval.",
      "Vergelijk bronstatus en geldigheid met je vraag. Een leesversie of vertaling is geen nieuwe goedkeuring.",
    ],
    sonderfall: [
      "Bei fehlender Quelle oder abweichender Fassung dem sichtbaren Hinweis folgen; kein Original ohne Leserecht versprechen.",
      "Follow the displayed notice for a missing source or a different version; original access still requires permission.",
      "Volg de melding bij een ontbrekende bron of andere versie; toegang tot het origineel vereist leesrecht.",
    ],
  },
  {
    id: "wissensnetz",
    pfade: ["/wissensnetz"],
    titelKey: "nav.wissensnetz",
    ziel: '[data-testid="themenkarte"]',
    aktion: [
      "Wähle ein Thema in der Themenkarte oder Seitenleiste und öffne die zugehörigen Artikel.",
      "Select a topic on the map or sidebar and open its articles.",
      "Kies een onderwerp op de kaart of zijbalk en open de artikelen.",
    ],
    ergebnis: [
      "Die Karte zeigt Zusammenhänge im sichtbaren Bestand; sie erteilt keine zusätzlichen Leserechte.",
      "The map shows relationships within visible knowledge; it grants no additional read permissions.",
      "De kaart toont verbanden in zichtbare kennis en geeft geen extra leesrechten.",
    ],
    sonderfall: [
      "Bei leerem Thema dessen Artikelliste prüfen. Die Legende erklärt ausgeblendete oder nicht dargestellte Kanten.",
      "For an empty topic, check its article list. The legend explains hidden or omitted edges.",
      "Controleer bij een leeg onderwerp de artikellijst. De legenda verklaart verborgen of weggelaten verbindingen.",
    ],
  },
  {
    id: "extern",
    pfade: ["/extern"],
    titelKey: "nav.external",
    ziel: "main h1",
    aktion: [
      "Wähle einen sichtbaren externen Wissenseintrag und prüfe Herkunft und Originalbezug.",
      "Select a visible external knowledge entry and inspect its origin and original source.",
      "Kies een zichtbaar extern kennisitem en controleer herkomst en origineel.",
    ],
    ergebnis: [
      "Externe Herkunft und interne Prüfung sind unterschiedliche Angaben.",
      "External origin and internal review are separate facts.",
      "Externe herkomst en interne beoordeling zijn verschillende gegevens.",
    ],
    sonderfall: [
      "Ein nicht erreichbares Original ist kein Beleg für seine Gültigkeit. Beachte den sichtbaren Zugangs- oder Fehlerhinweis.",
      "An unavailable original does not prove validity. Follow the access or error notice.",
      "Een onbereikbaar origineel bewijst geen geldigheid. Volg de toegangs- of foutmelding.",
    ],
  },
  {
    id: "dokumentfragen",
    pfade: ["/fragen/dokument"],
    titelKey: "nav.ask",
    ziel: '[data-testid="dokumentfragen-datei"]',
    aktion: [
      "Wähle eine Datei, stelle deine Frage im Fragefeld und prüfe die gefundene Textstelle.",
      "Choose a file, enter your question and inspect the matching passage.",
      "Kies een bestand, stel je vraag en controleer de gevonden tekstpassage.",
    ],
    ergebnis: [
      "Dieser Dokumentweg liest lokal im Browser. Textstelle und Lücke bleiben erkennbar.",
      "This document path reads locally in the browser. Passages and missing evidence remain distinguishable.",
      "Deze documentroute leest lokaal in de browser. Passages en ontbrekend bewijs blijven herkenbaar.",
    ],
    sonderfall: [
      "Bei Lesefehler oder fehlender Textstelle Datei und Frage prüfen; nicht gefunden bedeutet keine belegte Antwort.",
      "For a read error or missing passage, check the file and question; no match is not a supported answer.",
      "Controleer bestand en vraag bij een leesfout of ontbrekende passage; geen match is geen onderbouwd antwoord.",
    ],
  },
  {
    id: "begriffe",
    pfade: ["/begriffe"],
    titelKey: "begriffe.seite.titel",
    ziel: '[data-testid="begriffe-suche"]',
    aktion: [
      "Suche einen Firmenbegriff und lies Vorzugsbegriff, Geltung und Verlauf. Pflege ist nur mit Prüfberechtigung möglich.",
      "Look up a company term and read its preferred term, scope and history. Editing requires review permission.",
      "Zoek een bedrijfsterm en lees voorkeursterm, bereik en geschiedenis. Onderhoud vereist beoordelingsrecht.",
    ],
    ergebnis: [
      "Der Begriffseintrag erklärt die geltende Bezeichnung; eine neue Fassung entsteht erst durch bewusstes Speichern.",
      "The entry explains the applicable term; a new version requires deliberate saving.",
      "Het item verklaart de geldende term; een nieuwe versie vereist bewust opslaan.",
    ],
    sonderfall: [
      "Keine Treffer: Suche erweitern. Fehlende Pflegeknöpfe sind keine Aufforderung, Rechte zu wechseln.",
      "No results: broaden the search. Missing editing controls do not imply that you should switch permissions.",
      "Geen resultaten: verruim de zoekopdracht. Ontbrekende beheerknoppen betekenen niet dat je rechten moet wijzigen.",
    ],
  },
  {
    id: "livewall",
    pfade: ["/livewall"],
    titelKey: "nav.start",
    ziel: "main h1",
    aktion: [
      "Lies die sichtbaren aktuellen Ereignisse in der Beameransicht.",
      "Read the current visible events in the projector view.",
      "Lees de huidige zichtbare gebeurtenissen in de presentatieweergave.",
    ],
    ergebnis: [
      "Die Wand bleibt auf deine Sichtrechte begrenzt und ist keine öffentliche Freigabe aller Inhalte.",
      "The wall remains limited to your permissions and does not publish all content.",
      "De wand blijft beperkt tot jouw rechten en publiceert niet alle inhoud.",
    ],
    sonderfall: [
      "Bei leerer Ansicht aktuellen Bestand und Ladehinweis beachten.",
      "For an empty view, check the current data and loading notice.",
      "Controleer bij een lege weergave gegevens en laadmelding.",
    ],
  },
];
