import type { Ablauf } from "./redaktion";

export const ablaeufe: Record<string, Ablauf> = {
  a1: {
    input: {
      de: "Freie Notiz",
      en: "Rough notes",
      nl: "Losse aantekeningen",
    },
    output: {
      de: "Strukturierter Wissensentwurf",
      en: "Structured knowledge draft",
      nl: "Gestructureerd kennisconcept",
    },
  },
  a2: {
    input: {
      de: "Erfahrung oder Foto",
      en: "Experience or photo",
      nl: "Ervaring of foto",
    },
    output: {
      de: "Entwurf mit Antworten und Kontext",
      en: "Draft with answers and context",
      nl: "Concept met antwoorden en context",
    },
  },
  a4: {
    input: {
      de: "Fehlversuch in einer Arbeitssituation",
      en: "Earlier failed attempt",
      nl: "Eerdere mislukte poging",
    },
    output: {
      de: "Warnung mit Geltungsbedingungen",
      en: "Warning with applicable conditions",
      nl: "Waarschuwing met geldigheidsvoorwaarden",
    },
  },
  a6: {
    input: {
      de: "Neuer Eintrag und Herkunft",
      en: "New entry and its origin",
      nl: "Nieuw item en herkomst",
    },
    output: {
      de: "Zugeordnete Merkmale und Schutzstufe",
      en: "Assigned attributes and classification",
      nl: "Toegekende kenmerken en classificatie",
    },
  },
  a7: {
    input: {
      de: "Datei oder Ordnerbestand",
      en: "Document or folder",
      nl: "Document of map",
    },
    output: {
      de: "Importkandidat mit Herkunft",
      en: "Candidate with source information",
      nl: "Concept met brongegevens",
    },
  },
  a12: {
    input: {
      de: "Importierte Kandidaten",
      en: "Imported candidates",
      nl: "Geïmporteerde kandidaten",
    },
    output: {
      de: "Geprüfte Übernahmeliste",
      en: "Reviewed intake list",
      nl: "Beoordeelde overnamelijst",
    },
  },
  a14: {
    input: {
      de: "Originaldokument und Fassung",
      en: "Original document and edition",
      nl: "Oorspronkelijk document en versie",
    },
    output: {
      de: "Wiederauffindbare Quelle",
      en: "Retrievable source",
      nl: "Terugvindbare bron",
    },
  },
  a16: {
    input: {
      de: "Ausgewählte Nachricht oder Vorgang",
      en: "Selected message or issue",
      nl: "Geselecteerd bericht of werkitem",
    },
    output: {
      de: "Entwurf mit Rückverweis",
      en: "Draft linked to the original",
      nl: "Concept met terugverwijzing",
    },
  },
  a19: {
    input: {
      de: "Ausgewählte Ablage und Zugriff",
      en: "Selected store and access",
      nl: "Gekozen opslag en toegang",
    },
    output: {
      de: "Verbundener Quellenbereich",
      en: "Connected source collection",
      nl: "Gekoppelde broncollectie",
    },
  },
  a20: {
    input: {
      de: "Confluence-Seite mit Herkunft",
      en: "Confluence page and origin",
      nl: "Confluence-pagina met herkomst",
    },
    output: {
      de: "Zugeordneter Bibliotheksbestand",
      en: "Linked library collection",
      nl: "Gekoppelde bibliotheekinhoud",
    },
  },
  a28: {
    input: {
      de: "Änderung in der Quellablage",
      en: "Change in the source folder",
      nl: "Wijziging in de bronmap",
    },
    output: {
      de: "Abgeglichener Dateistand",
      en: "Reconciled file state",
      nl: "Bijgewerkte bestandsstand",
    },
  },
  a31: {
    input: {
      de: "Eigener Arbeitsstand",
      en: "Personal work in progress",
      nl: "Eigen werk in uitvoering",
    },
    output: {
      de: "Wieder zu öffnender Entwurf",
      en: "Draft ready to reopen",
      nl: "Concept dat verder kan worden bewerkt",
    },
  },
  a34: {
    input: {
      de: "Privater Entwurf",
      en: "Private draft",
      nl: "Privéconcept",
    },
    output: {
      de: "Freigegebene nächste Bearbeitung",
      en: "Authorised next editing step",
      nl: "Toegestane vervolgbewerking",
    },
  },
  a36: {
    input: {
      de: "Artikel oder Vorlage",
      en: "Article or template",
      nl: "Artikel of sjabloon",
    },
    output: {
      de: "Gestalteter Artikelentwurf",
      en: "Formatted article draft",
      nl: "Opgemaakt artikelconcept",
    },
  },
  a39: {
    input: {
      de: "Bild oder Dateianhang",
      en: "Image or attached file",
      nl: "Afbeelding of bijlage",
    },
    output: {
      de: "Anhang am vorgesehenen Artikel",
      en: "Attachment associated with its article",
      nl: "Bijlage bij het bedoelde artikel",
    },
  },
  a44: {
    input: {
      de: "Geöffneter Artikel",
      en: "Open article",
      nl: "Geopend artikel",
    },
    output: {
      de: "Arbeit an derselben Fassung",
      en: "Work on the same edition",
      nl: "Werk aan dezelfde versie",
    },
  },
  a47: {
    input: {
      de: "Beiträge mehrerer Personen",
      en: "Contributions from several people",
      nl: "Bijdragen van meerdere personen",
    },
    output: {
      de: "Abgestimmter Textstand",
      en: "Coordinated text version",
      nl: "Afgestemde tekstversie",
    },
  },
  a50: {
    input: {
      de: "Geprüfter Artikel",
      en: "Reviewed article",
      nl: "Beoordeeld artikel",
    },
    output: {
      de: "Veröffentlichung mit gewählter Meldung",
      en: "Publication with chosen notice",
      nl: "Publicatie met de gekozen melding",
    },
  },
  a51: {
    input: {
      de: "Suchbegriff oder Themenbereich",
      en: "Search term or topic",
      nl: "Zoekterm of onderwerp",
    },
    output: {
      de: "Passende Bibliotheksansicht",
      en: "Relevant library view",
      nl: "Passende bibliotheekweergave",
    },
  },
  a58: {
    input: {
      de: "Suchanfrage und heutige Rechte",
      en: "Query and current access",
      nl: "Zoekopdracht en actuele rechten",
    },
    output: {
      de: "Erlaubte Trefferanzeige",
      en: "Authorised results view",
      nl: "Toegestane resultaatweergave",
    },
  },
  a60: {
    input: {
      de: "Eintrag im Arbeitskontext",
      en: "Entry in the current context",
      nl: "Item in de huidige context",
    },
    output: {
      de: "Nachvollziehbarer Wissensbezug",
      en: "Traceable knowledge link",
      nl: "Herleidbare kennisverwijzing",
    },
  },
  a62: {
    input: {
      de: "Such- oder Navigationswunsch",
      en: "Search or navigation request",
      nl: "Zoek- of navigatievraag",
    },
    output: {
      de: "Erreichbares Ziel",
      en: "Accessible destination",
      nl: "Bereikbare bestemming",
    },
  },
  a66: {
    input: {
      de: "Neue Beiträge im Team",
      en: "New team contributions",
      nl: "Nieuwe teambijdragen",
    },
    output: {
      de: "Berechtigter Aktivitätsüberblick",
      en: "Activity visible to the reader",
      nl: "Toegestaan activiteitenoverzicht",
    },
  },
  a68: {
    input: {
      de: "Dokumente mit Aussagen",
      en: "Documents containing claims",
      nl: "Documenten met beweringen",
    },
    output: {
      de: "Prüfbare Aussagen mit Fundstellen",
      en: "Verifiable claims and passages",
      nl: "Toetsbare beweringen met vindplaatsen",
    },
  },
  a70: {
    input: {
      de: "Zwei ähnliche Inhalte",
      en: "Two similar entries",
      nl: "Twee verwante items",
    },
    output: {
      de: "Begründeter Dublettenbefund",
      en: "Documented duplicate assessment",
      nl: "Gemotiveerd duplicatenoordeel",
    },
  },
  a72: {
    input: {
      de: "Zwei abweichende Aussagen",
      en: "Two differing claims",
      nl: "Twee afwijkende beweringen",
    },
    output: {
      de: "Begründeter fachlicher Befund",
      en: "Reasoned subject assessment",
      nl: "Gemotiveerde inhoudelijke beoordeling",
    },
  },
  a77: {
    input: {
      de: "Offene oder erledigte Prüffälle",
      en: "Open or settled review cases",
      nl: "Open of afgehandelde controles",
    },
    output: {
      de: "Nachvollziehbare Prüfliste",
      en: "Traceable review queue",
      nl: "Herleidbare beoordelingslijst",
    },
  },
  a79: {
    input: {
      de: "Zur Prüfung vorliegende Fassung",
      en: "Edition awaiting review",
      nl: "Te beoordelen versie",
    },
    output: {
      de: "Prüfstand dieser Fassung",
      en: "Review state for this edition",
      nl: "Beoordelingsstand van deze versie",
    },
  },
  a85: {
    input: {
      de: "Aussage und erlaubte Grundlage",
      en: "Claim and permitted evidence",
      nl: "Bewering en toegestane onderbouwing",
    },
    output: {
      de: "Nachprüfbares Prüfergebnis",
      en: "Verifiable review result",
      nl: "Controleerbaar toetsingsresultaat",
    },
  },
  a92: {
    input: {
      de: "Unbeantwortete Fachfrage",
      en: "Unanswered subject question",
      nl: "Onbeantwoorde vakinhoudelijke vraag",
    },
    output: {
      de: "Zugeordnete Wissenslücke",
      en: "Assigned knowledge gap",
      nl: "Toegewezen kennishiaat",
    },
  },
  a95: {
    input: {
      de: "Problem und bestätigte Quellen",
      en: "Problem and approved sources",
      nl: "Probleem en goedgekeurde bronnen",
    },
    output: {
      de: "Belegte Arbeitshilfe",
      en: "Evidence-based work aid",
      nl: "Onderbouwde werkinstructie",
    },
  },
  a98: {
    input: {
      de: "Geänderte oder fällige Quelle",
      en: "Changed or review-due source",
      nl: "Gewijzigde of te beoordelen bron",
    },
    output: {
      de: "Gezielte Wissenspflege",
      en: "Targeted knowledge update",
      nl: "Gericht kennisonderhoud",
    },
  },
  a102: {
    input: {
      de: "Wissen und anstehende Übergabe",
      en: "Knowledge and upcoming handover",
      nl: "Kennis en aanstaande overdracht",
    },
    output: {
      de: "Geklärte Zuständigkeit",
      en: "Clarified ownership",
      nl: "Verduidelijkte verantwoordelijkheid",
    },
  },
  a107: {
    input: {
      de: "Zusammengehörige offene Fälle",
      en: "Related open cases",
      nl: "Samenhangende open gevallen",
    },
    output: {
      de: "Arbeitsvorschlag für das Team",
      en: "Proposed team assignment",
      nl: "Werkvoorstel voor het team",
    },
  },
  a109: {
    input: {
      de: "Rückmeldung zu einer Antwort",
      en: "Feedback on an answer",
      nl: "Feedback op een antwoord",
    },
    output: {
      de: "Nachverfolgbare Rückmeldung",
      en: "Traceable feedback",
      nl: "Herleidbare feedback",
    },
  },
  a111: {
    input: {
      de: "Frage mit Zeit- oder Sachbezug",
      en: "Question with time or conditions",
      nl: "Vraag met tijd of voorwaarden",
    },
    output: {
      de: "Einordnung für den gewählten Stand",
      en: "Assessment for the chosen state",
      nl: "Beoordeling voor de gekozen stand",
    },
  },
  a114: {
    input: {
      de: "Inhalte, Projekt und Beteiligte",
      en: "Content, project and participants",
      nl: "Inhoud, project en deelnemers",
    },
    output: {
      de: "Geordneter gemeinsamer Arbeitsraum",
      en: "Organised shared workspace",
      nl: "Ingerichte gedeelde werkruimte",
    },
  },
  a117: {
    input: {
      de: "Aussagen und ihre Beziehungen",
      en: "Claims and their relationships",
      nl: "Beweringen en hun relaties",
    },
    output: {
      de: "Begründete Wissensverbindung",
      en: "Explained knowledge link",
      nl: "Onderbouwd kennisverband",
    },
  },
  a119: {
    input: {
      de: "Anliegen im gemeinsamen Arbeitsraum",
      en: "Matter in the shared workspace",
      nl: "Vraagstuk in de gedeelde werkruimte",
    },
    output: {
      de: "Erreichbarer Arbeits- oder Gesprächsfaden",
      en: "Accessible task or discussion",
      nl: "Bereikbare taak of gespreksdraad",
    },
  },
  a123: {
    input: {
      de: "Standort, Anlage oder Zeichnung",
      en: "Site, equipment or drawing",
      nl: "Locatie, installatie of tekening",
    },
    output: {
      de: "Anweisung am richtigen Ort",
      en: "Guidance at the correct location",
      nl: "Instructie op de juiste plek",
    },
  },
  a128: {
    input: {
      de: "Lernziel und Fachquelle",
      en: "Learning goal and subject source",
      nl: "Leerdoel en vakbron",
    },
    output: {
      de: "Prüfbarer Lernschritt",
      en: "Verifiable learning step",
      nl: "Toetsbare leerstap",
    },
  },
  a134: {
    input: {
      de: "Messwerte und Herkunft",
      en: "Measurements and origin",
      nl: "Meetwaarden en herkomst",
    },
    output: {
      de: "Einordenbare Auswertung",
      en: "Interpretable analysis",
      nl: "Uitlegbare analyse",
    },
  },
  a142: {
    input: {
      de: "Konto, Rolle oder Zugangsbedarf",
      en: "Account, role or access need",
      nl: "Account, rol of toegangsbehoefte",
    },
    output: {
      de: "Geklärter Kontozugang",
      en: "Defined account access",
      nl: "Vastgestelde accounttoegang",
    },
  },
  a154: {
    input: {
      de: "Betriebliche Anforderung",
      en: "Operational requirement",
      nl: "Beheerbehoefte",
    },
    output: {
      de: "Sichtbarer Verwaltungsstand",
      en: "Visible administrative state",
      nl: "Zichtbare beheerstand",
    },
  },
  a160: {
    input: {
      de: "Inhalt, Herkunft und Leserechte",
      en: "Content, origin and read permissions",
      nl: "Inhoud, herkomst en leesrechten",
    },
    output: {
      de: "Berechtigter Zugriff",
      en: "Authorised access",
      nl: "Toegestane toegang",
    },
  },
  a166: {
    input: {
      de: "Verarbeitungswunsch und Richtlinie",
      en: "Processing request and policy",
      nl: "Verwerkingsverzoek en beleid",
    },
    output: {
      de: "Entscheidung zur Verarbeitung",
      en: "Processing decision",
      nl: "Verwerkingsbesluit",
    },
  },
  a172: {
    input: {
      de: "Personenbezogene Daten und Fristen",
      en: "Personal data and retention periods",
      nl: "Persoonsgegevens en bewaartermijnen",
    },
    output: {
      de: "Nachvollziehbarer Datenschutzvorgang",
      en: "Traceable privacy record",
      nl: "Herleidbare privacyhandeling",
    },
  },
  a175: {
    input: {
      de: "Vorgang und Zuständigkeit",
      en: "Event and responsibility",
      nl: "Gebeurtenis en verantwoordelijkheid",
    },
    output: {
      de: "Prüfbarer Nachweis",
      en: "Verifiable evidence",
      nl: "Controleerbaar bewijs",
    },
  },
  a180: {
    input: {
      de: "Erhaltener Datenstand",
      en: "Retained data state",
      nl: "Bewaarde gegevensstand",
    },
    output: {
      de: "Kontrollierter Bestandsstand",
      en: "Controlled collection state",
      nl: "Gecontroleerde collectiestand",
    },
  },
  a184: {
    input: {
      de: "Berechtigter Inhalt und Ausgabeformat",
      en: "Permitted content and output format",
      nl: "Toegestane inhoud en uitvoerformaat",
    },
    output: {
      de: "Weiterverwendbare Ausgabe",
      en: "Reusable output",
      nl: "Herbruikbare uitvoer",
    },
  },
  a191: {
    input: {
      de: "Sicherungsstand und Zuständigkeit",
      en: "Backup state and ownership",
      nl: "Back-upstand en verantwoordelijkheid",
    },
    output: {
      de: "Prüfbarer Sicherungsstand",
      en: "Verifiable backup record",
      nl: "Controleerbare back-upstand",
    },
  },
  a194: {
    input: {
      de: "Kundeninstanz und vorhandene Daten",
      en: "Customer instance and existing data",
      nl: "Klantomgeving en bestaande gegevens",
    },
    output: {
      de: "Nachvollziehbarer Betriebsstand",
      en: "Traceable installation state",
      nl: "Herleidbare bedrijfsstand",
    },
  },
  a199: {
    input: {
      de: "Wissensbestand und Modellwahl",
      en: "Knowledge base and model choice",
      nl: "Kennisbestand en modelkeuze",
    },
    output: {
      de: "Festgelegter Verarbeitungsweg",
      en: "Defined processing path",
      nl: "Vastgestelde verwerkingsroute",
    },
  },
  a204: {
    input: {
      de: "Systemkonfiguration und Betriebsregeln",
      en: "System settings and operating rules",
      nl: "Systeeminstellingen en beheerregels",
    },
    output: {
      de: "Überprüfter Betriebsweg",
      en: "Verified operating path",
      nl: "Gecontroleerde beheerroute",
    },
  },
  a212: {
    input: {
      de: "Laufende KI-Anfrage",
      en: "Active AI request",
      nl: "Lopend AI-verzoek",
    },
    output: {
      de: "Sichtbarer Fortschritt",
      en: "Visible progress",
      nl: "Zichtbare voortgang",
    },
  },
  a213: {
    input: {
      de: "Ereignis oder externe Anwendung",
      en: "Event or external application",
      nl: "Gebeurtenis of externe toepassing",
    },
    output: {
      de: "Erlaubter Datenaustausch",
      en: "Authorised exchange",
      nl: "Toegestane gegevensuitwisseling",
    },
  },
  a219: {
    input: {
      de: "Betriebsereignis oder Messung",
      en: "Operational event or measurement",
      nl: "Beheergebeurtenis of meting",
    },
    output: {
      de: "Nachvollziehbarer Betriebsbefund",
      en: "Traceable operational finding",
      nl: "Herleidbare beheerbevinding",
    },
  },
  a224: {
    input: {
      de: "Aktuelle Ansicht und Benutzerziel",
      en: "Current view and user goal",
      nl: "Huidige weergave en gebruikersdoel",
    },
    output: {
      de: "Erreichbarer nächster Schritt",
      en: "Accessible next step",
      nl: "Bereikbare vervolgstap",
    },
  },
  a228: {
    input: {
      de: "Gewählte Sprache und Original",
      en: "Selected language and original",
      nl: "Gekozen taal en origineel",
    },
    output: {
      de: "Sprachlich passende Ansicht",
      en: "View in the selected language",
      nl: "Weergave in de gekozen taal",
    },
  },
  a230: {
    input: {
      de: "Mobiler Arbeitsplatz oder Lesestation",
      en: "Mobile workspace or reading station",
      nl: "Mobiele werkplek of leesstation",
    },
    output: {
      de: "Zugänglicher Arbeitsweg",
      en: "Accessible workflow",
      nl: "Toegankelijke werkwijze",
    },
  },
  a235: {
    input: {
      de: "Vorgeschlagene Produktvariante",
      en: "Proposed product variant",
      nl: "Voorgestelde productvariant",
    },
    output: {
      de: "Abgegrenztes Konzept",
      en: "Scoped concept",
      nl: "Afgebakend concept",
    },
  },
  a238: {
    input: {
      de: "Vorführziel und Beispielbestand",
      en: "Demo goal and example material",
      nl: "Demodoel en voorbeeldmateriaal",
    },
    output: {
      de: "Nachvollziehbare Vorführung oder Abnahme",
      en: "Traceable demonstration or review",
      nl: "Herleidbare demonstratie of beoordeling",
    },
  },
  a249: {
    input: {
      de: "Frage und gewählter Kontext",
      en: "Question and selected context",
      nl: "Vraag en gekozen context",
    },
    output: {
      de: "Persönlicher Gesprächsfaden",
      en: "Personal conversation thread",
      nl: "Persoonlijke gespreksdraad",
    },
  },
  a254: {
    input: {
      de: "Gewählte Figur oder Fensterzustand",
      en: "Selected character or window state",
      nl: "Gekozen figuur of vensterstatus",
    },
    output: {
      de: "Erkennbarer Assistenzzustand",
      en: "Recognisable assistant state",
      nl: "Herkenbare assistentstatus",
    },
  },
  a261: {
    input: {
      de: "Persönliche Bedienpräferenz",
      en: "Personal interaction preference",
      nl: "Persoonlijke bedieningsvoorkeur",
    },
    output: {
      de: "Passende Assistenzbedienung",
      en: "Tailored assistant controls",
      nl: "Aangepaste assistentbediening",
    },
  },
  a265: {
    input: {
      de: "Gesprochene oder geschriebene Eingabe",
      en: "Speech or text input",
      nl: "Gesproken of geschreven invoer",
    },
    output: {
      de: "Nutzbare Sprach- oder Textausgabe",
      en: "Usable speech or text output",
      nl: "Bruikbare spraak- of tekstuitvoer",
    },
  },
  a269: {
    input: {
      de: "Frage und zugängliche Quelle",
      en: "Question and accessible source",
      nl: "Vraag en toegankelijke bron",
    },
    output: {
      de: "Nachvollziehbare Antwort",
      en: "Traceable answer",
      nl: "Herleidbaar antwoord",
    },
  },
  a275: {
    input: {
      de: "Gewählte Textstelle",
      en: "Selected passage",
      nl: "Geselecteerde passage",
    },
    output: {
      de: "Prüfbarer Textvorschlag",
      en: "Reviewable text suggestion",
      nl: "Te beoordelen tekstvoorstel",
    },
  },
  a279: {
    input: {
      de: "Eigene Aufgabe, Notiz oder Präferenz",
      en: "Personal task, note or preference",
      nl: "Persoonlijke taak, notitie of voorkeur",
    },
    output: {
      de: "Persönlicher Arbeitsstand",
      en: "Personal work state",
      nl: "Persoonlijke werkstand",
    },
  },
  a285: {
    input: {
      de: "Erteilter Auftrag und aktuelle Rechte",
      en: "Assigned task and current rights",
      nl: "Opdracht en actuele rechten",
    },
    output: {
      de: "Belegter Ausführungsstand",
      en: "Recorded execution state",
      nl: "Vastgelegde uitvoeringsstand",
    },
  },
  a290: {
    input: {
      de: "Vorgemachter Ablauf oder Anweisung",
      en: "Demonstration or instruction",
      nl: "Voorgedane werkwijze of instructie",
    },
    output: {
      de: "Nachvollziehbarer Assistenzauftrag",
      en: "Traceable assistant task",
      nl: "Herleidbare assistentopdracht",
    },
  },
  a300: {
    input: {
      de: "Ereignis, Termin oder Quellstelle",
      en: "Event, date or source passage",
      nl: "Gebeurtenis, datum of bronpassage",
    },
    output: {
      de: "Begründeter Kalendereintrag",
      en: "Calendar entry with context",
      nl: "Agendapunt met onderbouwing",
    },
  },
  a309: {
    input: {
      de: "Zeitregel und Auftrag",
      en: "Schedule and assignment",
      nl: "Tijdregel en opdracht",
    },
    output: {
      de: "Zuordenbare Ausführung",
      en: "Traceable execution",
      nl: "Herleidbare uitvoering",
    },
  },
  a316: {
    input: {
      de: "Anwendung und angemeldetes Konto",
      en: "Application and signed-in account",
      nl: "Toepassing en aangemeld account",
    },
    output: {
      de: "Verbundener Arbeitskontext",
      en: "Connected workspace",
      nl: "Verbonden werkcontext",
    },
  },
  a321: {
    input: {
      de: "Aktuelles Word-Dokument",
      en: "Current Word document",
      nl: "Huidig Word-document",
    },
    output: {
      de: "Ergebnis an der richtigen Stelle",
      en: "Result at the intended location",
      nl: "Resultaat op de bedoelde plek",
    },
  },
  a326: {
    input: {
      de: "Berechtigte Fachanwendung",
      en: "Authorised application",
      nl: "Toegestane vaktoepassing",
    },
    output: {
      de: "Klara im gewählten Arbeitskontext",
      en: "Klara in the selected workspace",
      nl: "Klara in de gekozen werkcontext",
    },
  },
  a330: {
    input: {
      de: "Folienelement und Datenquelle",
      en: "Slide element and data source",
      nl: "Dia-element en gegevensbron",
    },
    output: {
      de: "Nachprüfbare Folienaussage",
      en: "Traceable slide claim",
      nl: "Herleidbare uitspraak op de dia",
    },
  },
  a334: {
    input: {
      de: "Belegte Daten und Vortragsziel",
      en: "Sourced data and presentation goal",
      nl: "Onderbouwde gegevens en presentatiedoel",
    },
    output: {
      de: "Weiterbearbeitbare Präsentationsgrundlage",
      en: "Reusable presentation material",
      nl: "Bewerkbaar presentatiemateriaal",
    },
  },
  a340: {
    input: {
      de: "Ausgewählte Webstelle",
      en: "Selected web passage",
      nl: "Geselecteerde webpassage",
    },
    output: {
      de: "Zuordenbarer Inhalt oder Aktion",
      en: "Attributed content or action",
      nl: "Herleidbare inhoud of actie",
    },
  },
  a345: {
    input: {
      de: "Freigegebene Gesprächsinhalte",
      en: "Authorised meeting material",
      nl: "Toegestane gespreksinhoud",
    },
    output: {
      de: "Zugeordnetes Gesprächsergebnis",
      en: "Attributed meeting outcome",
      nl: "Herleidbaar gespreksresultaat",
    },
  },
  a352: {
    input: {
      de: "Freigegebener Bedarf und Angebote",
      en: "Approved requirements and offers",
      nl: "Goedgekeurde behoefte en offertes",
    },
    output: {
      de: "Entscheidungsgrundlage für den Einkauf",
      en: "Basis for a purchasing decision",
      nl: "Onderbouwing voor een inkoopbesluit",
    },
  },
  a355: {
    input: {
      de: "Bild, Scan oder markierter Ausschnitt",
      en: "Image, scan or selected area",
      nl: "Afbeelding, scan of selectie",
    },
    output: {
      de: "Prüfbarer Bildbefund mit Herkunft",
      en: "Traceable image finding",
      nl: "Controleerbare beeldbevinding met herkomst",
    },
  },
  a367: {
    input: {
      de: "Arbeitsziel und aktueller Lernschritt",
      en: "Work goal and current learning step",
      nl: "Werkdoel en huidige leerstap",
    },
    output: {
      de: "Fortsetzbare Anleitung",
      en: "Walkthrough ready to resume",
      nl: "Hervatbare instructie",
    },
  },
  a425: {
    input: {
      de: "Tabellen, Felder und Quellrechte",
      en: "Tables, fields and source permissions",
      nl: "Tabellen, velden en bronrechten",
    },
    output: {
      de: "Zugeordnete importierte Datensätze",
      en: "Imported records linked to origin",
      nl: "Geïmporteerde records met herkomst",
    },
  },
  a426: {
    input: {
      de: "Datensätze, Beziehungen und Dokumente",
      en: "Records, relationships and documents",
      nl: "Records, relaties en documenten",
    },
    output: {
      de: "Wissensaussage mit Datenbankbeleg",
      en: "Knowledge claim linked to database evidence",
      nl: "Kennisuitspraak met databaseonderbouwing",
    },
  },
  d3: {
    input: {
      de: "Foto einer Arbeitssituation",
      en: "Photo of a work situation",
      nl: "Foto van een werksituatie",
    },
    output: {
      de: "Interviewantwort mit Bildbezug",
      en: "Interview answer linked to the image",
      nl: "Interviewantwoord met beeldverwijzing",
    },
  },
  d10: {
    input: {
      de: "Laufender Dateiimport",
      en: "File import in progress",
      nl: "Lopende bestandsimport",
    },
    output: {
      de: "Fortschritt und verbleibende Dateien",
      en: "Progress and remaining files",
      nl: "Voortgang en resterende bestanden",
    },
  },
  d11: {
    input: {
      de: "Unterbrochener Import",
      en: "Interrupted import",
      nl: "Onderbroken import",
    },
    output: {
      de: "Fortsetzung am dokumentierten Zwischenstand",
      en: "Import resumes from the recorded checkpoint",
      nl: "Import hervat vanaf het vastgelegde tussenpunt",
    },
  },
  d12: {
    input: {
      de: "Bereits importierte Datei",
      en: "Previously imported file",
      nl: "Eerder geïmporteerd bestand",
    },
    output: {
      de: "Erkannter vorhandener Datensatz",
      en: "Existing record identified",
      nl: "Bestaand record herkend",
    },
  },
  d22: {
    input: {
      de: "Anhang einer Confluence-Seite",
      en: "Attachment to a Confluence page",
      nl: "Bijlage van een Confluence-pagina",
    },
    output: {
      de: "Anhang mit Ursprungsseite",
      en: "Attachment linked to its source page",
      nl: "Bijlage gekoppeld aan de bronpagina",
    },
  },
  d23: {
    input: {
      de: "Berechtigungen eines Confluence-Bereichs",
      en: "Confluence space permissions",
      nl: "Rechten van een Confluence-ruimte",
    },
    output: {
      de: "Übernommene Sichtgrenzen",
      en: "Imported visibility limits",
      nl: "Overgenomen zichtbaarheidsgrenzen",
    },
  },
  d42: {
    input: {
      de: "Bild und vorhandene Beschreibung",
      en: "Image and its description",
      nl: "Afbeelding en beschrijving",
    },
    output: {
      de: "Geprüfte Bildbeschreibung",
      en: "Reviewed image description",
      nl: "Gecontroleerde beeldbeschrijving",
    },
  },
  d49: {
    input: {
      de: "Zwei Bearbeitende im selben Text",
      en: "Two people editing the same text",
      nl: "Twee mensen in dezelfde tekst",
    },
    output: {
      de: "Gemeinsamer Bearbeitungsstand",
      en: "Shared editing state",
      nl: "Gezamenlijke bewerkingsstand",
    },
  },
  d55: {
    input: {
      de: "Frage in eigenen Worten",
      en: "Question in the reader’s words",
      nl: "Vraag in eigen bewoordingen",
    },
    output: {
      de: "Inhaltlich verwandte Treffer",
      en: "Results related by meaning",
      nl: "Inhoudelijk verwante treffers",
    },
  },
  d75: {
    input: {
      de: "Widerspruch und Originalbelege",
      en: "Conflict and original evidence",
      nl: "Tegenstrijdigheid en originele onderbouwing",
    },
    output: {
      de: "Dokumentierter fachlicher Entscheid",
      en: "Recorded expert decision",
      nl: "Vastgelegde vakinhoudelijke beslissing",
    },
  },
  d81: {
    input: {
      de: "Beitrag und Freigaberegel des Kontos",
      en: "Contribution and account approval rule",
      nl: "Bijdrage en goedkeuringsregel van het account",
    },
    output: {
      de: "Fachlich bestätigte Fassung",
      en: "Version approved by a reviewer",
      nl: "Vakinhoudelijk goedgekeurde versie",
    },
  },
  d85: {
    input: {
      de: "Zu prüfende Aussage",
      en: "Claim to check",
      nl: "Te toetsen uitspraak",
    },
    output: {
      de: "Ergebnis mit Firmenquelle",
      en: "Result with company source",
      nl: "Resultaat met bedrijfsbron",
    },
  },
  d94: {
    input: {
      de: "Offene fachliche Frage",
      en: "Unanswered specialist question",
      nl: "Openstaande vakvraag",
    },
    output: {
      de: "Zuständige Fachperson",
      en: "Relevant subject expert",
      nl: "Aangewezen deskundige",
    },
  },
  d106: {
    input: {
      de: "Erfahrung einer abgebenden Fachkraft",
      en: "Experience of the outgoing specialist",
      nl: "Ervaring van de overdragende deskundige",
    },
    output: {
      de: "Übergabe für die nächste Schicht",
      en: "Handover for the next shift",
      nl: "Overdracht voor de volgende ploeg",
    },
  },
  d126: {
    input: {
      de: "Zeichnung und Wissenseintrag",
      en: "Drawing and knowledge item",
      nl: "Tekening en kennisitem",
    },
    output: {
      de: "Wissensbezug zur Zeichnung",
      en: "Knowledge reference on the drawing",
      nl: "Kennisverwijzing bij de tekening",
    },
  },
  d140: {
    input: {
      de: "Freigegebene Kennzahlen",
      en: "Approved metrics",
      nl: "Goedgekeurde kengetallen",
    },
    output: {
      de: "Vorgesehener Datenfluss zum BI-System",
      en: "Proposed data flow to a BI tool",
      nl: "Beoogde gegevensstroom naar een BI-systeem",
    },
  },
  d167: {
    input: {
      de: "KI-Einstellung der Organisation",
      en: "Organisation’s AI setting",
      nl: "AI-instelling van de organisatie",
    },
    output: {
      de: "Zulässiger Verarbeitungsweg",
      en: "Permitted processing route",
      nl: "Toegestane verwerkingsroute",
    },
  },
  d173: {
    input: {
      de: "Anfrage einer betroffenen Person",
      en: "Request from a data subject",
      nl: "Verzoek van een betrokkene",
    },
    output: {
      de: "Nachverfolgbarer Auskunfts- oder Löschvorgang",
      en: "Traceable access or deletion request",
      nl: "Traceerbaar inzage- of verwijderverzoek",
    },
  },
  d186: {
    input: {
      de: "HTML-Ansicht des Eintrags",
      en: "HTML view of the item",
      nl: "HTML-weergave van het item",
    },
    output: {
      de: "PDF über den Browserdruck",
      en: "PDF from the browser print dialogue",
      nl: "PDF via het afdrukvenster",
    },
  },
  d193: {
    input: {
      de: "Sicherung am ersten Standort",
      en: "Backup at the first location",
      nl: "Back-up op de eerste locatie",
    },
    output: {
      de: "Unabhängige zweite Kopie",
      en: "Independent second copy",
      nl: "Onafhankelijke tweede kopie",
    },
  },
  d228: {
    input: {
      de: "Gewählte Oberflächensprache",
      en: "Selected interface language",
      nl: "Gekozen interfacetaal",
    },
    output: {
      de: "Übersetzte Oberfläche",
      en: "Translated interface",
      nl: "Vertaalde interface",
    },
  },
  d234: {
    input: {
      de: "Mobilgerät und Nutzungsszenario",
      en: "Mobile device and use case",
      nl: "Mobiel apparaat en gebruikssituatie",
    },
    output: {
      de: "Konzept einer nativen Mobil-App",
      en: "Native mobile app concept",
      nl: "Concept voor een native mobiele app",
    },
  },
  d235: {
    input: {
      de: "Vorgesehene lokale Modellanfrage",
      en: "Proposed local model request",
      nl: "Beoogd lokaal modelverzoek",
    },
    output: {
      de: "Im Browser berechnete Ausgabe als Konzept",
      en: "Concept for output computed in the browser",
      nl: "Concept voor een in de browser berekend resultaat",
    },
  },
  d237: {
    input: {
      de: "Stilbeispiele",
      en: "Writing samples",
      nl: "Stijlvoorbeelden",
    },
    output: {
      de: "Vorschlag für eine spätere Stilevaluation",
      en: "Proposal for a future style evaluation",
      nl: "Voorstel voor latere stijlevaluatie",
    },
  },
  d255: {
    input: {
      de: "Aktueller Zustand der Assistenz",
      en: "Current assistant state",
      nl: "Huidige toestand van de assistent",
    },
    output: {
      de: "Passende Darstellung der Figur",
      en: "Corresponding avatar state",
      nl: "Bijpassende weergave van de avatar",
    },
  },
  d269: {
    input: {
      de: "Frage und zulässige Firmenquellen",
      en: "Question and permitted company sources",
      nl: "Vraag en toegankelijke bedrijfsbronnen",
    },
    output: {
      de: "Antwort mit Beleg",
      en: "Answer with supporting evidence",
      nl: "Antwoord met bron",
    },
  },
  d282: {
    input: {
      de: "Persönlich gespeicherte Merkposten",
      en: "Saved personal memories",
      nl: "Opgeslagen persoonlijke gegevens",
    },
    output: {
      de: "Geprüfter oder bereinigter Bestand",
      en: "Reviewed or cleared memory",
      nl: "Gecontroleerd of opgeschoond geheugen",
    },
  },
  d291: {
    input: {
      de: "Gespeicherte eigene Arbeitswege",
      en: "Saved personal workflows",
      nl: "Opgeslagen eigen werkwijzen",
    },
    output: {
      de: "Übersicht bearbeitbarer Routinen",
      en: "List of editable routines",
      nl: "Overzicht van bewerkbare routines",
    },
  },
  d300: {
    input: {
      de: "Eigene Termine und Fristen",
      en: "Personal appointments and deadlines",
      nl: "Eigen afspraken en termijnen",
    },
    output: {
      de: "Persönliche Kalenderansicht",
      en: "Personal calendar view",
      nl: "Persoonlijke agendaweergave",
    },
  },
  d301: {
    input: {
      de: "Freigegebener Kalenderzugang",
      en: "Authorised calendar connection",
      nl: "Geautoriseerde agendaverbinding",
    },
    output: {
      de: "Verknüpfte Termine",
      en: "Linked appointments",
      nl: "Gekoppelde afspraken",
    },
  },
  d303: {
    input: {
      de: "Dokument oder Gespräch mit Zeitangabe",
      en: "Document or conversation containing a date",
      nl: "Document of gesprek met tijdsaanduiding",
    },
    output: {
      de: "Fristvorschlag mit Herkunft",
      en: "Suggested deadline with origin",
      nl: "Voorgestelde termijn met herkomst",
    },
  },
  d311: {
    input: {
      de: "Lokale Zeit und Zeitzone",
      en: "Local time and time zone",
      nl: "Lokale tijd en tijdzone",
    },
    output: {
      de: "Korrekt eingeplanter Auslöser",
      en: "Trigger scheduled in the correct time zone",
      nl: "Correct ingeplande trigger",
    },
  },
  d314: {
    input: {
      de: "Serientermin und gewähltes Vorkommen",
      en: "Recurring event and selected occurrence",
      nl: "Afsprakenreeks en geselecteerde afspraak",
    },
    output: {
      de: "Gezielte Änderung der Serie oder Instanz",
      en: "Change applied to the series or occurrence",
      nl: "Wijziging van de reeks of de afzonderlijke afspraak",
    },
  },
  d318: {
    input: {
      de: "Installierte Begleitapp am Mac",
      en: "Installed companion app on the Mac",
      nl: "Geïnstalleerde companion-app op de Mac",
    },
    output: {
      de: "Klara im eigenen Fenster",
      en: "Klara in a separate window",
      nl: "Klara in een eigen venster",
    },
  },
  d321: {
    input: {
      de: "Word-Passage und Frage",
      en: "Word passage and question",
      nl: "Word-passage en vraag",
    },
    output: {
      de: "Belegte Antwort im Dokumentkontext",
      en: "Sourced answer in document context",
      nl: "Onderbouwd antwoord in documentcontext",
    },
  },
  d324: {
    input: {
      de: "Ausgewählte Excel-Zellen",
      en: "Selected Excel cells",
      nl: "Geselecteerde Excel-cellen",
    },
    output: {
      de: "Antwort mit Tabellenbezug",
      en: "Answer linked to the spreadsheet",
      nl: "Antwoord met verwijzing naar het werkblad",
    },
  },
  d325: {
    input: {
      de: "Nachricht oder Entwurf in Outlook",
      en: "Message or draft in Outlook",
      nl: "Bericht of concept in Outlook",
    },
    output: {
      de: "Kontextbezogener Entwurf",
      en: "Draft based on message context",
      nl: "Concept op basis van berichtcontext",
    },
  },
  d327: {
    input: {
      de: "Frage in Microsoft Teams",
      en: "Question in Microsoft Teams",
      nl: "Vraag in Microsoft Teams",
    },
    output: {
      de: "Antwort im Gespräch",
      en: "Answer in the conversation",
      nl: "Antwoord in het gesprek",
    },
  },
  d337: {
    input: {
      de: "Foliensatz und Zielgruppe",
      en: "Slide deck and audience",
      nl: "Dia’s en doelgroep",
    },
    output: {
      de: "Vortragsnotizen",
      en: "Speaker notes",
      nl: "Sprekersnotities",
    },
  },
  d346: {
    input: {
      de: "Besprechung mit Aufzeichnungserlaubnis",
      en: "Meeting with permission to record",
      nl: "Vergadering met toestemming voor opname",
    },
    output: {
      de: "Aufzeichnung zur Nachbereitung",
      en: "Recording for follow-up",
      nl: "Opname voor verdere uitwerking",
    },
  },
  d358: {
    input: {
      de: "OCR-Ergebnis mit Positionsdaten",
      en: "OCR result with location data",
      nl: "OCR-resultaat met positiegegevens",
    },
    output: {
      de: "Markierte Stelle im Originalbild",
      en: "Highlighted area in the original image",
      nl: "Gemarkeerde plek in het originele beeld",
    },
  },
  d361: {
    input: {
      de: "Unsichere Zeichenerkennung",
      en: "Uncertain character recognition",
      nl: "Onzekere tekenherkenning",
    },
    output: {
      de: "Sichtbarer Prüfhinweis",
      en: "Visible review indicator",
      nl: "Zichtbare controleaanduiding",
    },
  },
  d372: {
    input: {
      de: "Vorhandene Kontoeinrichtung",
      en: "Existing account setup",
      nl: "Bestaande accountinstellingen",
    },
    output: {
      de: "Aktualisierte Einrichtungswahl",
      en: "Updated setup choices",
      nl: "Bijgewerkte instellingskeuzes",
    },
  },
  V01: {
    input: {
      de: "Cursor oder Auswahl in Word",
      en: "Cursor or selection in Word",
      nl: "Cursor of selectie in Word",
    },
    output: {
      de: "Frage mit zugeordneter Passage",
      en: "Question linked to the passage",
      nl: "Vraag met de bijbehorende passage",
    },
  },
  V02: {
    input: {
      de: "Aussage aus dem Dokument",
      en: "Statement in the document",
      nl: "Uitspraak uit het document",
    },
    output: {
      de: "Belegter Vergleich",
      en: "Comparison with evidence",
      nl: "Vergelijking met onderbouwing",
    },
  },
  V03: {
    input: {
      de: "Quellenverweis in der Antwort",
      en: "Source reference in an answer",
      nl: "Bronverwijzing bij het antwoord",
    },
    output: {
      de: "Gespeicherte freigegebene Fassung",
      en: "Saved approved version",
      nl: "Opgeslagen goedgekeurde versie",
    },
  },
  V04: {
    input: {
      de: "Geprüfte Dokumentpassage",
      en: "Checked document passage",
      nl: "Gecontroleerde documentpassage",
    },
    output: {
      de: "Groß dargestellter Vergleich",
      en: "Comparison in presentation view",
      nl: "Vergelijking in presentatieweergave",
    },
  },
  V05: {
    input: {
      de: "Zitat und gespeicherte Fassung",
      en: "Quotation and saved version",
      nl: "Citaat en opgeslagen versie",
    },
    output: {
      de: "Eindeutig lokalisierte Fundstelle",
      en: "Unambiguously located passage",
      nl: "Eenduidig teruggevonden bronzin",
    },
  },
  V06: {
    input: {
      de: "Verbindungswahl im Word-Dokument",
      en: "Connection setting in the Word document",
      nl: "Koppelingskeuze in het Word-document",
    },
    output: {
      de: "Passage am Fragefeld der App",
      en: "Passage beside the app’s question box",
      nl: "Passage bij het vraagveld van de app",
    },
  },
  V07: {
    input: {
      de: "Offene Frage und Antwort",
      en: "Current question and answer",
      nl: "Huidige vraag en antwoord",
    },
    output: {
      de: "Freies Fragefeld",
      en: "Empty question box",
      nl: "Leeg vraagveld",
    },
  },
  V08: {
    input: {
      de: "Erweitertes App-Fenster",
      en: "Expanded app window",
      nl: "Uitgevouwen appvenster",
    },
    output: {
      de: "App auf dem Mac beendet",
      en: "Application closed on the Mac",
      nl: "App op de Mac afgesloten",
    },
  },
  P01: {
    input: {
      de: "Erfahrungsbericht zu einem Fall",
      en: "First-hand account of a case",
      nl: "Ervaringsverhaal over een casus",
    },
    output: {
      de: "Erklärtes Vorgehen zur fachlichen Prüfung",
      en: "Explained approach for expert review",
      nl: "Toegelichte aanpak voor vakinhoudelijke toetsing",
    },
  },
};
