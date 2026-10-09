// ================================================================================================
// INTEGRATIONEN — Zustand, Verbindungstest und Hilfe der Anbindungen (ADMIN-02).
// ================================================================================================
//
// Auftrag `produkt:20261009:admin-integrationszustaende`. Ein Statusmodell für alle Flächen, die über
// eine Anbindung sprechen (`lib/integrationStatus.ts`): Galeriekachel, Zugangskarte, Verbindungstest
// und Übernahmebilanz. Kein Satz nennt einen Wert, ein Token oder ein Passwort — nur Namen von
// Umgebungsvariablen, die ohnehin auf der Zugangskarte stehen. „Hinterlegt" heisst nie „erreichbar";
// „erreichbar" fällt nur nach einem bestandenen Verbindungstest. DE/EN/NL, weil der Textmodulvertrag
// jede Sprache der Oberfläche verlangt (docs/i18n-textmodule.md).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "integrationen.",
  legacySchluessel: [],
  de: {
    "integrationen.status.ausgeschaltet": "ausgeschaltet",
    "integrationen.status.nichtEingerichtet": "nicht eingerichtet",
    "integrationen.status.konfiguriert": "eingerichtet, ungeprüft",
    "integrationen.status.geprueft": "Verbindung geprüft",
    "integrationen.status.fehlgeschlagen": "Verbindungstest fehlgeschlagen",
    "integrationen.naechsterSchritt": "Nächster Schritt:",
    "integrationen.schritt.konfiguriert":
      "Die Angaben stehen, geprüft ist die Verbindung noch nicht. Starte unten den Verbindungstest, bevor du dich auf den Import verlässt.",
    "integrationen.zugang.bereitMitTest":
      "Der SharePoint-Import ist für diese Installation eingeschaltet, und alle nötigen Angaben stehen auf dem Server. Hinterlegt heißt noch nicht erreichbar — ob SharePoint die Anmeldung annimmt, zeigt der Verbindungstest unten.",
    "integrationen.faehigkeit.titel": "Was diese Anbindung kann",
    "integrationen.faehigkeit.import":
      "Import: ausgewählte Dateien kommen in die Prüfung; bei reinen Textdateien (.txt) mit ihrem Inhalt.",
    "integrationen.faehigkeit.metadaten":
      "Metadatenübernahme: bei allen anderen Dateitypen nur Name, Originaladresse und Stand — kein Volltext.",
    "integrationen.faehigkeit.vorschau":
      "Dokumentvorschau: vor dem Import zeigt die Dateiliste je Datei, ob Inhalt oder nur Merkmale kämen. Die Datei selbst öffnet sich in SharePoint, nicht in Klarwerk.",
    "integrationen.faehigkeit.office":
      "Office-Bearbeitung: wird hier nicht angeboten — Klarwerk öffnet und ändert keine Office-Dateien in SharePoint.",
    "integrationen.freischaltung.titel": "Freischaltung in dieser Installation",
    "integrationen.freischaltung.an": "eingeschaltet",
    "integrationen.freischaltung.aus": "nicht eingeschaltet",
    "integrationen.test.titel": "Letzter Verbindungstest",
    "integrationen.test.keiner":
      "Noch kein Verbindungstest festgehalten. Hinterlegte Angaben allein sagen nicht, ob die Verbindung steht.",
    "integrationen.test.zeile": "{{zeit}} · geprüft: {{umfang}} · Ergebnis: {{ergebnis}}",
    "integrationen.test.umfang.konfiguration": "nur Schalter und Angaben, ohne Abruf",
    "integrationen.test.umfang.bibliothekLesen":
      "eine Seite der Dateiliste im Wurzelordner der Bibliothek, nur Merkmale",
    "integrationen.test.ergebnis.erreichbar": "erreichbar",
    "integrationen.test.ergebnis.ausgeschaltet": "in dieser Installation ausgeschaltet",
    "integrationen.test.ergebnis.nichtEingerichtet": "Angaben fehlen",
    "integrationen.test.ergebnis.anmeldungAbgewiesen": "Anmeldung abgewiesen",
    "integrationen.test.ergebnis.keineBerechtigung": "keine Leseberechtigung",
    "integrationen.test.ergebnis.nichtGefunden": "Bibliothek nicht gefunden",
    "integrationen.test.ergebnis.zeitueberschreitung": "Zeitüberschreitung",
    "integrationen.test.ergebnis.nichtErreichbar": "nicht erreichbar",
    "integrationen.test.schritt.erreichbar":
      "SharePoint hat geantwortet. Wähle in der Dateiliste unten die Dateien und starte den Import — das ist ein eigener Schritt.",
    "integrationen.test.schritt.ausgeschaltet":
      "Der SharePoint-Import ist in dieser Installation nicht eingeschaltet. Einschalten kann ihn, wer Zugang zum Server hat (Schalter KLARWERK_SHAREPOINT_IMPORT).",
    "integrationen.test.schritt.nichtEingerichtet":
      "Es fehlen Angaben oder die Adresse ist keine https-Adresse. Lass die als „nicht hinterlegt“ markierten Umgebungsvariablen auf dem Server setzen und prüfe danach erneut.",
    "integrationen.test.schritt.anmeldungAbgewiesen":
      "SharePoint hat die hinterlegte Anmeldung abgewiesen. Lass das Zugangsmerkmal auf dem Server erneuern (KLARWERK_SHAREPOINT_TOKEN) und prüfe danach erneut.",
    "integrationen.test.schritt.keineBerechtigung":
      "Die Anmeldung gilt, aber das Konto darf diese Bibliothek nicht lesen. Lass die Leseberechtigung in SharePoint erteilen und prüfe danach erneut.",
    "integrationen.test.schritt.nichtGefunden":
      "Die hinterlegte Bibliothek gibt es dort nicht. Lass die Bibliothekskennung auf dem Server prüfen (KLARWERK_SHAREPOINT_DRIVE).",
    "integrationen.test.schritt.zeitueberschreitung":
      "SharePoint hat nicht innerhalb von 10 Sekunden geantwortet. Versuche es später erneut; bleibt es so, lass den Netzweg zur Gegenstelle prüfen.",
    "integrationen.test.schritt.nichtErreichbar":
      "SharePoint war nicht erreichbar oder hat nicht brauchbar geantwortet. Versuche es später erneut; bleibt es so, lass Adresse und Netzweg prüfen (KLARWERK_SHAREPOINT_BASE_URL).",
    "integrationen.test.knopf": "Verbindung jetzt prüfen",
    "integrationen.test.laeuft": "Wird geprüft …",
    "integrationen.test.wirkung":
      "Der Test liest eine Seite der Dateiliste — nur Namen und Merkmale — und hält Zeitpunkt, Umfang und Ergebnis fest. Er importiert nichts und verändert keine Beiträge.",
    "integrationen.test.fehler":
      "Der Verbindungstest konnte nicht gestartet werden. Bitte erneut versuchen.",
    "integrationen.historie.titel": "Letzter erfolgreicher Import (historischer Nachweis)",
    "integrationen.zustaendig.titel": "Zuständigkeit",
    "integrationen.zustaendig.test":
      "Verbindungstest und Import starten Administratorinnen und Administratoren dieser Installation.",
    "integrationen.galerie.verfuegbar": "verfügbar",
    "integrationen.galerie.hinweisVerfuegbar":
      "Die Anbindung ist gebaut. Ob sie in dieser Installation eingerichtet und erreichbar ist, zeigt ihr Bereich auf dieser Seite.",
    "integrationen.galerie.hinweisStatus":
      "Zustand dieser Installation — Angaben, Verbindungstest und nächster Schritt stehen im Bereich der Anbindung auf dieser Seite.",
    "integrationen.galerie.zaehlung":
      "Nutzbar oder einrichtbar: {{n}} ({{namen}}). {{geplant}} weitere sind bald oder geplant und zählen nicht als verfügbare Anbindung.",
    "integrationen.bilanz.gesamt":
      "Vollständig verarbeitet: {{gesamt}} von {{gesamt}} Dateien, ohne doppelte Anlage. Nächster Schritt: die Vorgänge in der Prüfung unten annehmen.",
    "integrationen.bilanz.teil":
      "Teilweise übernommen: {{ok}} von {{gesamt}} Dateien. Die Gründe stehen darunter; wähle die übrigen nach Behebung erneut aus — bereits Übernommenes wird nicht doppelt angelegt.",
  },
  en: {
    "integrationen.status.ausgeschaltet": "switched off",
    "integrationen.status.nichtEingerichtet": "not set up",
    "integrationen.status.konfiguriert": "set up, not checked",
    "integrationen.status.geprueft": "connection checked",
    "integrationen.status.fehlgeschlagen": "connection test failed",
    "integrationen.naechsterSchritt": "Next step:",
    "integrationen.schritt.konfiguriert":
      "The settings are in place, but the connection has not been checked yet. Run the connection test below before relying on the import.",
    "integrationen.zugang.bereitMitTest":
      "The SharePoint import is switched on for this installation, and all required settings are on the server. Stored does not mean reachable — whether SharePoint accepts the sign-in is shown by the connection test below.",
    "integrationen.faehigkeit.titel": "What this connection can do",
    "integrationen.faehigkeit.import":
      "Import: selected files go into review; plain text files (.txt) come with their content.",
    "integrationen.faehigkeit.metadaten":
      "Metadata transfer: for every other file type only name, original address and version — no full text.",
    "integrationen.faehigkeit.vorschau":
      "Document preview: before the import, the file list shows per file whether content or only metadata would come along. The file itself opens in SharePoint, not in Klarwerk.",
    "integrationen.faehigkeit.office":
      "Office editing: not offered here — Klarwerk does not open or change Office files in SharePoint.",
    "integrationen.freischaltung.titel": "Enabled in this installation",
    "integrationen.freischaltung.an": "switched on",
    "integrationen.freischaltung.aus": "not switched on",
    "integrationen.test.titel": "Last connection test",
    "integrationen.test.keiner":
      "No connection test recorded yet. Stored settings alone do not tell whether the connection works.",
    "integrationen.test.zeile": "{{zeit}} · checked: {{umfang}} · result: {{ergebnis}}",
    "integrationen.test.umfang.konfiguration": "switch and settings only, no request",
    "integrationen.test.umfang.bibliothekLesen":
      "one page of the file list in the library's root folder, metadata only",
    "integrationen.test.ergebnis.erreichbar": "reachable",
    "integrationen.test.ergebnis.ausgeschaltet": "switched off in this installation",
    "integrationen.test.ergebnis.nichtEingerichtet": "settings missing",
    "integrationen.test.ergebnis.anmeldungAbgewiesen": "sign-in rejected",
    "integrationen.test.ergebnis.keineBerechtigung": "no read permission",
    "integrationen.test.ergebnis.nichtGefunden": "library not found",
    "integrationen.test.ergebnis.zeitueberschreitung": "timed out",
    "integrationen.test.ergebnis.nichtErreichbar": "not reachable",
    "integrationen.test.schritt.erreichbar":
      "SharePoint answered. Choose files in the list below and start the import — that is a separate step.",
    "integrationen.test.schritt.ausgeschaltet":
      "The SharePoint import is not switched on in this installation. Whoever has access to the server can switch it on (switch KLARWERK_SHAREPOINT_IMPORT).",
    "integrationen.test.schritt.nichtEingerichtet":
      "Settings are missing or the address is not an https address. Have the environment variables marked “not set” added on the server, then check again.",
    "integrationen.test.schritt.anmeldungAbgewiesen":
      "SharePoint rejected the stored sign-in. Have the credential renewed on the server (KLARWERK_SHAREPOINT_TOKEN), then check again.",
    "integrationen.test.schritt.keineBerechtigung":
      "The sign-in is valid, but the account may not read this library. Have read permission granted in SharePoint, then check again.",
    "integrationen.test.schritt.nichtGefunden":
      "The stored library does not exist there. Have the library ID checked on the server (KLARWERK_SHAREPOINT_DRIVE).",
    "integrationen.test.schritt.zeitueberschreitung":
      "SharePoint did not answer within 10 seconds. Try again later; if it persists, have the network path to the remote side checked.",
    "integrationen.test.schritt.nichtErreichbar":
      "SharePoint was not reachable or did not answer usefully. Try again later; if it persists, have the address and network path checked (KLARWERK_SHAREPOINT_BASE_URL).",
    "integrationen.test.knopf": "Check connection now",
    "integrationen.test.laeuft": "Checking …",
    "integrationen.test.wirkung":
      "The test reads one page of the file list — names and metadata only — and records time, scope and result. It imports nothing and changes no entries.",
    "integrationen.test.fehler": "The connection test could not be started. Please try again.",
    "integrationen.historie.titel": "Last successful import (historical record)",
    "integrationen.zustaendig.titel": "Responsibility",
    "integrationen.zustaendig.test":
      "Connection tests and imports are started by administrators of this installation.",
    "integrationen.galerie.verfuegbar": "available",
    "integrationen.galerie.hinweisVerfuegbar":
      "The connection is built. Whether it is set up and reachable in this installation is shown in its section on this page.",
    "integrationen.galerie.hinweisStatus":
      "State of this installation — settings, connection test and next step are in the connection's section on this page.",
    "integrationen.galerie.zaehlung":
      "Usable or ready to set up: {{n}} ({{namen}}). {{geplant}} more are coming soon or planned and do not count as available connections.",
    "integrationen.bilanz.gesamt":
      "Fully processed: {{gesamt}} of {{gesamt}} files, nothing created twice. Next step: accept the items in the review below.",
    "integrationen.bilanz.teil":
      "Partly transferred: {{ok}} of {{gesamt}} files. The reasons are listed below; select the rest again once fixed — anything already transferred is not created twice.",
  },
  nl: {
    "integrationen.status.ausgeschaltet": "uitgeschakeld",
    "integrationen.status.nichtEingerichtet": "niet ingericht",
    "integrationen.status.konfiguriert": "ingericht, niet gecontroleerd",
    "integrationen.status.geprueft": "verbinding gecontroleerd",
    "integrationen.status.fehlgeschlagen": "verbindingstest mislukt",
    "integrationen.naechsterSchritt": "Volgende stap:",
    "integrationen.schritt.konfiguriert":
      "De gegevens staan klaar, maar de verbinding is nog niet gecontroleerd. Start hieronder de verbindingstest voordat je op de import vertrouwt.",
    "integrationen.zugang.bereitMitTest":
      "De SharePoint-import is voor deze installatie ingeschakeld en alle benodigde gegevens staan op de server. Opgeslagen betekent nog niet bereikbaar — of SharePoint de aanmelding accepteert, toont de verbindingstest hieronder.",
    "integrationen.faehigkeit.titel": "Wat deze koppeling kan",
    "integrationen.faehigkeit.import":
      "Import: gekozen bestanden gaan naar de controle; platte tekstbestanden (.txt) met hun inhoud.",
    "integrationen.faehigkeit.metadaten":
      "Metadata-overname: bij alle andere bestandstypen alleen naam, oorspronkelijk adres en versie — geen volledige tekst.",
    "integrationen.faehigkeit.vorschau":
      "Documentvoorbeeld: vóór de import toont de bestandslijst per bestand of inhoud of alleen kenmerken mee zouden komen. Het bestand zelf opent in SharePoint, niet in Klarwerk.",
    "integrationen.faehigkeit.office":
      "Office-bewerking: wordt hier niet aangeboden — Klarwerk opent en wijzigt geen Office-bestanden in SharePoint.",
    "integrationen.freischaltung.titel": "Vrijgegeven in deze installatie",
    "integrationen.freischaltung.an": "ingeschakeld",
    "integrationen.freischaltung.aus": "niet ingeschakeld",
    "integrationen.test.titel": "Laatste verbindingstest",
    "integrationen.test.keiner":
      "Nog geen verbindingstest vastgelegd. Opgeslagen gegevens alleen zeggen niet of de verbinding werkt.",
    "integrationen.test.zeile": "{{zeit}} · gecontroleerd: {{umfang}} · resultaat: {{ergebnis}}",
    "integrationen.test.umfang.konfiguration": "alleen schakelaar en gegevens, zonder opvraging",
    "integrationen.test.umfang.bibliothekLesen":
      "één pagina van de bestandslijst in de hoofdmap van de bibliotheek, alleen kenmerken",
    "integrationen.test.ergebnis.erreichbar": "bereikbaar",
    "integrationen.test.ergebnis.ausgeschaltet": "uitgeschakeld in deze installatie",
    "integrationen.test.ergebnis.nichtEingerichtet": "gegevens ontbreken",
    "integrationen.test.ergebnis.anmeldungAbgewiesen": "aanmelding geweigerd",
    "integrationen.test.ergebnis.keineBerechtigung": "geen leesrecht",
    "integrationen.test.ergebnis.nichtGefunden": "bibliotheek niet gevonden",
    "integrationen.test.ergebnis.zeitueberschreitung": "tijdslimiet overschreden",
    "integrationen.test.ergebnis.nichtErreichbar": "niet bereikbaar",
    "integrationen.test.schritt.erreichbar":
      "SharePoint heeft geantwoord. Kies hieronder in de bestandslijst de bestanden en start de import — dat is een aparte stap.",
    "integrationen.test.schritt.ausgeschaltet":
      "De SharePoint-import is in deze installatie niet ingeschakeld. Wie toegang tot de server heeft, kan hem inschakelen (schakelaar KLARWERK_SHAREPOINT_IMPORT).",
    "integrationen.test.schritt.nichtEingerichtet":
      "Er ontbreken gegevens of het adres is geen https-adres. Laat de als „niet ingesteld” gemarkeerde omgevingsvariabelen op de server zetten en controleer daarna opnieuw.",
    "integrationen.test.schritt.anmeldungAbgewiesen":
      "SharePoint heeft de opgeslagen aanmelding geweigerd. Laat het toegangskenmerk op de server vernieuwen (KLARWERK_SHAREPOINT_TOKEN) en controleer daarna opnieuw.",
    "integrationen.test.schritt.keineBerechtigung":
      "De aanmelding is geldig, maar het account mag deze bibliotheek niet lezen. Laat leesrecht in SharePoint toekennen en controleer daarna opnieuw.",
    "integrationen.test.schritt.nichtGefunden":
      "De opgeslagen bibliotheek bestaat daar niet. Laat de bibliotheekkenmerk op de server controleren (KLARWERK_SHAREPOINT_DRIVE).",
    "integrationen.test.schritt.zeitueberschreitung":
      "SharePoint heeft niet binnen 10 seconden geantwoord. Probeer het later opnieuw; blijft het zo, laat dan de netwerkroute naar de tegenpartij controleren.",
    "integrationen.test.schritt.nichtErreichbar":
      "SharePoint was niet bereikbaar of gaf geen bruikbaar antwoord. Probeer het later opnieuw; blijft het zo, laat dan adres en netwerkroute controleren (KLARWERK_SHAREPOINT_BASE_URL).",
    "integrationen.test.knopf": "Verbinding nu controleren",
    "integrationen.test.laeuft": "Wordt gecontroleerd …",
    "integrationen.test.wirkung":
      "De test leest één pagina van de bestandslijst — alleen namen en kenmerken — en legt tijdstip, omvang en resultaat vast. Hij importeert niets en wijzigt geen bijdragen.",
    "integrationen.test.fehler": "De verbindingstest kon niet worden gestart. Probeer het opnieuw.",
    "integrationen.historie.titel": "Laatste geslaagde import (historisch bewijs)",
    "integrationen.zustaendig.titel": "Verantwoordelijkheid",
    "integrationen.zustaendig.test":
      "Verbindingstest en import worden gestart door beheerders van deze installatie.",
    "integrationen.galerie.verfuegbar": "beschikbaar",
    "integrationen.galerie.hinweisVerfuegbar":
      "De koppeling is gebouwd. Of ze in deze installatie ingericht en bereikbaar is, toont haar sectie op deze pagina.",
    "integrationen.galerie.hinweisStatus":
      "Toestand van deze installatie — gegevens, verbindingstest en volgende stap staan in de sectie van de koppeling op deze pagina.",
    "integrationen.galerie.zaehlung":
      "Bruikbaar of in te richten: {{n}} ({{namen}}). {{geplant}} andere komen binnenkort of zijn gepland en tellen niet als beschikbare koppeling.",
    "integrationen.bilanz.gesamt":
      "Volledig verwerkt: {{gesamt}} van {{gesamt}} bestanden, niets dubbel aangemaakt. Volgende stap: de items in de controle hieronder aannemen.",
    "integrationen.bilanz.teil":
      "Gedeeltelijk overgenomen: {{ok}} van {{gesamt}} bestanden. De redenen staan hieronder; kies de rest opnieuw zodra het is opgelost — wat al is overgenomen, wordt niet dubbel aangemaakt.",
  },
} satisfies Textmodul;
