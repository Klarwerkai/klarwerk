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
    // Nacharbeit 2 — Confluence am selben Modell, und die Importliste.
    "integrationen.test.umfang.spaceLesen":
      "eine Seite des konfigurierten Confluence-Bereichs, nur Kennungen, ohne Inhalt",
    "integrationen.confluence.wirkung":
      "Der Test liest eine Seite des konfigurierten Bereichs — nur Kennungen, kein Seiteninhalt — und hält Zeitpunkt, Umfang und Ergebnis fest. Er erkundet nicht, importiert nichts und verändert keine Beiträge.",
    "integrationen.confluence.schritt.erreichbar":
      "Confluence hat geantwortet. Starte über die Kachel „Confluence“ unten die Erkundung und danach den Import — das sind eigene Schritte.",
    "integrationen.confluence.schritt.ausgeschaltet":
      "Der Confluence-Import ist in dieser Installation nicht freigegeben. Freigeben kann ihn, wer Zugang zum Server hat (Schalter KLARWERK_CONFLUENCE_IMPORT).",
    "integrationen.confluence.schritt.betreiberAus":
      "Der Confluence-Import ist freigegeben, aber ausgeschaltet. Schalte ihn mit dem Knopf „Import einschalten“ oben ein und prüfe danach die Verbindung.",
    "integrationen.confluence.schritt.nichtEingerichtet":
      "Es fehlen Angaben, die Adresse ist keine https-Adresse oder die Anmeldeart ist unbekannt. Lass die als „nicht hinterlegt“ markierten Umgebungsvariablen auf dem Server setzen und prüfe danach erneut.",
    "integrationen.confluence.schritt.konfiguriert":
      "Die Angaben stehen, geprüft ist die Verbindung noch nicht. Starte unten den Verbindungstest, bevor du dich auf Erkundung und Import verlässt.",
    "integrationen.confluence.schritt.anmeldungAbgewiesen":
      "Confluence hat die hinterlegte Anmeldung abgewiesen. Lass Benutzer und Zugangsmerkmal auf dem Server erneuern (KLARWERK_CONFLUENCE_USER, KLARWERK_CONFLUENCE_TOKEN) und prüfe danach erneut.",
    "integrationen.confluence.schritt.keineBerechtigung":
      "Die Anmeldung gilt, aber das Konto darf diesen Bereich nicht lesen. Lass die Leseberechtigung in Confluence erteilen und prüfe danach erneut.",
    "integrationen.confluence.schritt.nichtGefunden":
      "Unter der hinterlegten Adresse gibt es diesen Bereich nicht. Lass Adresse und Bereichsschlüssel auf dem Server prüfen (KLARWERK_CONFLUENCE_BASE_URL, KLARWERK_CONFLUENCE_SPACE).",
    "integrationen.confluence.schritt.zeitueberschreitung":
      "Confluence hat nicht innerhalb von 10 Sekunden geantwortet. Versuche es später erneut; bleibt es so, lass den Netzweg zur Gegenstelle prüfen.",
    "integrationen.confluence.schritt.nichtErreichbar":
      "Confluence war nicht erreichbar oder hat nicht brauchbar geantwortet. Versuche es später erneut; bleibt es so, lass Adresse und Netzweg prüfen (KLARWERK_CONFLUENCE_BASE_URL).",
    "integrationen.liste.titel": "Importliste",
    "integrationen.liste.was":
      "Die jüngsten Importläufe aller Quellen mit Status, Zeitraum und dem nächsten Schritt. Zuständig sind die Verwaltenden dieser Installation.",
    "integrationen.liste.neuLaden": "Liste neu laden",
    "integrationen.liste.laedt": "Die Importläufe werden geladen …",
    "integrationen.liste.fehler":
      "Die Importliste konnte nicht geladen werden. Lade sie neu; bleibt es so, ist der Server gerade nicht erreichbar.",
    "integrationen.liste.keinRecht": "Die Importliste sehen nur Verwaltende dieser Installation.",
    "integrationen.liste.nichtVerfuegbar":
      "Diese Installation kann ihre Importläufe nicht auflisten. Einzelne Läufe bleiben über ihre Kennung erreichbar.",
    "integrationen.liste.leer": "Noch kein Importlauf festgehalten.",
    "integrationen.liste.ausloeserFehlt":
      "Wer einen Lauf gestartet hat, hält der Lauf nicht fest — deshalb steht hier die zuständige Rolle, keine Person.",
    "integrationen.liste.zustaendig":
      "Zuständig: Verwaltende dieser Installation · Auslösende Person nicht festgehalten",
    "integrationen.liste.bilanz":
      "{{gesamt}} beauftragt · {{neu}} neu in der Prüfung · {{vorhanden}} schon vorhanden · {{offen}} nicht übernommen",
    "integrationen.liste.zeitraum.vonBis": "{{start}} bis {{ende}}",
    "integrationen.liste.zeitraum.laeuftSeit": "läuft seit {{start}}",
    "integrationen.liste.zeitraum.ohneEnde": "gestartet {{start}} · kein Ende festgehalten",
    "integrationen.liste.zeitraum.unbekannt": "Zeitraum nicht festgehalten",
    "integrationen.liste.detailsAuf": "Laufdetails zeigen",
    "integrationen.liste.detailsZu": "Laufdetails ausblenden",
    "integrationen.liste.detail.kennung": "Laufkennung",
    "integrationen.liste.detail.umfang": "Umfang",
    "integrationen.liste.detail.fehlercode": "Fehlercode",
    "integrationen.liste.detail.grund": "Grund",
    "integrationen.liste.detail.abgleich": "Quellabgleich",
    "integrationen.liste.detail.abgleichZahlen":
      "{{entfernt}} entfernt · {{zurueck}} zurückgeholt · {{ungeprueft}} ungeprüft",
    "integrationen.liste.nichtFestgehalten": "nicht festgehalten",
    "integrationen.liste.keiner": "keiner",
    "integrationen.liste.hilfe.laeuft":
      "Der Lauf arbeitet noch. Die Liste fragt alle 10 Sekunden nach; ein Abbruch erscheint hier mit seinem Grund.",
    "integrationen.liste.hilfe.fertig":
      "Abgeschlossen. Die übernommenen Vorgänge stehen in der Prüfung weiter unten und warten auf Annahme.",
    "integrationen.liste.hilfe.teilweise":
      "Teilweise übernommen. Öffne die Laufdetails; die übrigen Einträge nach Behebung erneut starten — Übernommenes wird nicht doppelt angelegt.",
    "integrationen.liste.hilfe.fehlgeschlagen":
      "Der Lauf ist ohne festgehaltenen Grund abgebrochen. Prüfe oben die Verbindung der Quelle und starte den Import erneut.",
    "integrationen.liste.hilfe.unbekannterCode":
      "Fehlercode {{code}} ist hier nicht näher erklärt. Öffne die Laufdetails und gib den Code an den Betrieb weiter.",
    "integrationen.liste.hilfe.zustandUnbekannt":
      "Der Zustand dieses Laufs ist dieser Fassung unbekannt. Öffne die Laufdetails und gib die Laufkennung an den Betrieb weiter.",
    "integrationen.liste.hilfe.nichtEingerichtet":
      "Die Quelle war nicht eingerichtet. Ergänze die fehlenden Angaben auf dem Server, prüfe oben die Verbindung und starte den Import erneut.",
    "integrationen.liste.hilfe.ausgeschaltet":
      "Der Import war ausgeschaltet. Schalte ihn oben ein und starte den Import erneut.",
    "integrationen.liste.hilfe.keineBerechtigung":
      "Das hinterlegte Konto durfte die Quelle nicht lesen. Lass die Leseberechtigung erteilen und starte den Import erneut.",
    "integrationen.liste.hilfe.nichtGefunden":
      "Die Quelle war dort nicht (mehr) vorhanden. Prüfe die hinterlegte Bibliothek bzw. den Bereich und wähle neu aus.",
    "integrationen.liste.hilfe.nichtErreichbar":
      "Die Quelle war nicht erreichbar oder die Anmeldung galt nicht mehr. Starte oben den Verbindungstest — er unterscheidet abgewiesene Anmeldung und Zeitüberschreitung.",
    "integrationen.liste.hilfe.zeitueberschreitung":
      "Die Quelle hat nicht rechtzeitig geantwortet. Starte den Import später erneut oder grenze die Auswahl ein.",
    "integrationen.liste.hilfe.zuGross":
      "Mindestens ein Inhalt war zu groß und wurde nicht übernommen. Teile die Datei auf oder öffne sie über ihre Adresse.",
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
    "integrationen.test.umfang.spaceLesen":
      "one page of the configured Confluence space, identifiers only, no content",
    "integrationen.confluence.wirkung":
      "The test reads one page of the configured space — identifiers only, no page content — and records time, scope and result. It does not explore, imports nothing and changes no entries.",
    "integrationen.confluence.schritt.erreichbar":
      "Confluence answered. Start the exploration via the “Confluence” tile below and then the import — those are separate steps.",
    "integrationen.confluence.schritt.ausgeschaltet":
      "The Confluence import is not released in this installation. Whoever has access to the server can release it (switch KLARWERK_CONFLUENCE_IMPORT).",
    "integrationen.confluence.schritt.betreiberAus":
      "The Confluence import is released but switched off. Switch it on with the “Switch import on” button above, then check the connection.",
    "integrationen.confluence.schritt.nichtEingerichtet":
      "Settings are missing, the address is not an https address or the sign-in type is unknown. Have the environment variables marked “not set” added on the server, then check again.",
    "integrationen.confluence.schritt.konfiguriert":
      "The settings are in place, but the connection has not been checked yet. Run the connection test below before relying on exploration and import.",
    "integrationen.confluence.schritt.anmeldungAbgewiesen":
      "Confluence rejected the stored sign-in. Have the user and credential renewed on the server (KLARWERK_CONFLUENCE_USER, KLARWERK_CONFLUENCE_TOKEN), then check again.",
    "integrationen.confluence.schritt.keineBerechtigung":
      "The sign-in is valid, but the account may not read this space. Have read permission granted in Confluence, then check again.",
    "integrationen.confluence.schritt.nichtGefunden":
      "This space does not exist at the stored address. Have the address and space key checked on the server (KLARWERK_CONFLUENCE_BASE_URL, KLARWERK_CONFLUENCE_SPACE).",
    "integrationen.confluence.schritt.zeitueberschreitung":
      "Confluence did not answer within 10 seconds. Try again later; if it persists, have the network path to the remote side checked.",
    "integrationen.confluence.schritt.nichtErreichbar":
      "Confluence was not reachable or did not answer usefully. Try again later; if it persists, have the address and network path checked (KLARWERK_CONFLUENCE_BASE_URL).",
    "integrationen.liste.titel": "Import list",
    "integrationen.liste.was":
      "The latest import runs of all sources with status, period and the next step. Administrators of this installation are responsible.",
    "integrationen.liste.neuLaden": "Reload list",
    "integrationen.liste.laedt": "Loading import runs …",
    "integrationen.liste.fehler":
      "The import list could not be loaded. Reload it; if it persists, the server is currently not reachable.",
    "integrationen.liste.keinRecht":
      "Only administrators of this installation can see the import list.",
    "integrationen.liste.nichtVerfuegbar":
      "This installation cannot list its import runs. Individual runs remain reachable by their ID.",
    "integrationen.liste.leer": "No import run recorded yet.",
    "integrationen.liste.ausloeserFehlt":
      "A run does not record who started it — so this shows the responsible role, not a person.",
    "integrationen.liste.zustaendig":
      "Responsible: administrators of this installation · Person who started it not recorded",
    "integrationen.liste.bilanz":
      "{{gesamt}} requested · {{neu}} new in review · {{vorhanden}} already present · {{offen}} not transferred",
    "integrationen.liste.zeitraum.vonBis": "{{start}} to {{ende}}",
    "integrationen.liste.zeitraum.laeuftSeit": "running since {{start}}",
    "integrationen.liste.zeitraum.ohneEnde": "started {{start}} · no end recorded",
    "integrationen.liste.zeitraum.unbekannt": "Period not recorded",
    "integrationen.liste.detailsAuf": "Show run details",
    "integrationen.liste.detailsZu": "Hide run details",
    "integrationen.liste.detail.kennung": "Run ID",
    "integrationen.liste.detail.umfang": "Scope",
    "integrationen.liste.detail.fehlercode": "Error code",
    "integrationen.liste.detail.grund": "Reason",
    "integrationen.liste.detail.abgleich": "Source reconciliation",
    "integrationen.liste.detail.abgleichZahlen":
      "{{entfernt}} removed · {{zurueck}} restored · {{ungeprueft}} unchecked",
    "integrationen.liste.nichtFestgehalten": "not recorded",
    "integrationen.liste.keiner": "none",
    "integrationen.liste.hilfe.laeuft":
      "The run is still working. The list checks again every 10 seconds; an abort appears here with its reason.",
    "integrationen.liste.hilfe.fertig":
      "Completed. The transferred items are in the review further down and wait for acceptance.",
    "integrationen.liste.hilfe.teilweise":
      "Partly transferred. Open the run details; start the remaining entries again once fixed — nothing is created twice.",
    "integrationen.liste.hilfe.fehlgeschlagen":
      "The run aborted without a recorded reason. Check the source's connection above and start the import again.",
    "integrationen.liste.hilfe.unbekannterCode":
      "Error code {{code}} is not explained here. Open the run details and pass the code on to operations.",
    "integrationen.liste.hilfe.zustandUnbekannt":
      "This version does not know the state of this run. Open the run details and pass the run ID on to operations.",
    "integrationen.liste.hilfe.nichtEingerichtet":
      "The source was not set up. Add the missing settings on the server, check the connection above and start the import again.",
    "integrationen.liste.hilfe.ausgeschaltet":
      "The import was switched off. Switch it on above and start the import again.",
    "integrationen.liste.hilfe.keineBerechtigung":
      "The stored account was not allowed to read the source. Have read permission granted and start the import again.",
    "integrationen.liste.hilfe.nichtGefunden":
      "The source was not (or no longer) there. Check the stored library or space and select again.",
    "integrationen.liste.hilfe.nichtErreichbar":
      "The source was not reachable or the sign-in was no longer valid. Run the connection test above — it tells a rejected sign-in from a timeout.",
    "integrationen.liste.hilfe.zeitueberschreitung":
      "The source did not answer in time. Start the import again later or narrow the selection.",
    "integrationen.liste.hilfe.zuGross":
      "At least one content item was too large and was not transferred. Split the file or open it via its address.",
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
    "integrationen.test.umfang.spaceLesen":
      "één pagina van de ingestelde Confluence-ruimte, alleen kenmerken, zonder inhoud",
    "integrationen.confluence.wirkung":
      "De test leest één pagina van de ingestelde ruimte — alleen kenmerken, geen pagina-inhoud — en legt tijdstip, omvang en resultaat vast. Hij verkent niet, importeert niets en wijzigt geen bijdragen.",
    "integrationen.confluence.schritt.erreichbar":
      "Confluence heeft geantwoord. Start via de tegel „Confluence” hieronder de verkenning en daarna de import — dat zijn aparte stappen.",
    "integrationen.confluence.schritt.ausgeschaltet":
      "De Confluence-import is in deze installatie niet vrijgegeven. Wie toegang tot de server heeft, kan hem vrijgeven (schakelaar KLARWERK_CONFLUENCE_IMPORT).",
    "integrationen.confluence.schritt.betreiberAus":
      "De Confluence-import is vrijgegeven, maar uitgeschakeld. Schakel hem in met de knop „Import inschakelen” hierboven en controleer daarna de verbinding.",
    "integrationen.confluence.schritt.nichtEingerichtet":
      "Er ontbreken gegevens, het adres is geen https-adres of de aanmeldwijze is onbekend. Laat de als „niet ingesteld” gemarkeerde omgevingsvariabelen op de server zetten en controleer daarna opnieuw.",
    "integrationen.confluence.schritt.konfiguriert":
      "De gegevens staan klaar, maar de verbinding is nog niet gecontroleerd. Start hieronder de verbindingstest voordat je op verkenning en import vertrouwt.",
    "integrationen.confluence.schritt.anmeldungAbgewiesen":
      "Confluence heeft de opgeslagen aanmelding geweigerd. Laat gebruiker en toegangskenmerk op de server vernieuwen (KLARWERK_CONFLUENCE_USER, KLARWERK_CONFLUENCE_TOKEN) en controleer daarna opnieuw.",
    "integrationen.confluence.schritt.keineBerechtigung":
      "De aanmelding is geldig, maar het account mag deze ruimte niet lezen. Laat leesrecht in Confluence toekennen en controleer daarna opnieuw.",
    "integrationen.confluence.schritt.nichtGefunden":
      "Op het opgeslagen adres bestaat deze ruimte niet. Laat adres en ruimtesleutel op de server controleren (KLARWERK_CONFLUENCE_BASE_URL, KLARWERK_CONFLUENCE_SPACE).",
    "integrationen.confluence.schritt.zeitueberschreitung":
      "Confluence heeft niet binnen 10 seconden geantwoord. Probeer het later opnieuw; blijft het zo, laat dan de netwerkroute naar de tegenpartij controleren.",
    "integrationen.confluence.schritt.nichtErreichbar":
      "Confluence was niet bereikbaar of gaf geen bruikbaar antwoord. Probeer het later opnieuw; blijft het zo, laat dan adres en netwerkroute controleren (KLARWERK_CONFLUENCE_BASE_URL).",
    "integrationen.liste.titel": "Importlijst",
    "integrationen.liste.was":
      "De meest recente importruns van alle bronnen met status, periode en de volgende stap. Verantwoordelijk zijn de beheerders van deze installatie.",
    "integrationen.liste.neuLaden": "Lijst opnieuw laden",
    "integrationen.liste.laedt": "De importruns worden geladen …",
    "integrationen.liste.fehler":
      "De importlijst kon niet worden geladen. Laad haar opnieuw; blijft het zo, dan is de server nu niet bereikbaar.",
    "integrationen.liste.keinRecht": "Alleen beheerders van deze installatie zien de importlijst.",
    "integrationen.liste.nichtVerfuegbar":
      "Deze installatie kan haar importruns niet opsommen. Afzonderlijke runs blijven via hun kenmerk bereikbaar.",
    "integrationen.liste.leer": "Nog geen importrun vastgelegd.",
    "integrationen.liste.ausloeserFehlt":
      "Een run legt niet vast wie hem heeft gestart — daarom staat hier de verantwoordelijke rol, geen persoon.",
    "integrationen.liste.zustaendig":
      "Verantwoordelijk: beheerders van deze installatie · Starter niet vastgelegd",
    "integrationen.liste.bilanz":
      "{{gesamt}} opgedragen · {{neu}} nieuw in de controle · {{vorhanden}} al aanwezig · {{offen}} niet overgenomen",
    "integrationen.liste.zeitraum.vonBis": "{{start}} tot {{ende}}",
    "integrationen.liste.zeitraum.laeuftSeit": "loopt sinds {{start}}",
    "integrationen.liste.zeitraum.ohneEnde": "gestart {{start}} · geen einde vastgelegd",
    "integrationen.liste.zeitraum.unbekannt": "Periode niet vastgelegd",
    "integrationen.liste.detailsAuf": "Rundetails tonen",
    "integrationen.liste.detailsZu": "Rundetails verbergen",
    "integrationen.liste.detail.kennung": "Runkenmerk",
    "integrationen.liste.detail.umfang": "Omvang",
    "integrationen.liste.detail.fehlercode": "Foutcode",
    "integrationen.liste.detail.grund": "Reden",
    "integrationen.liste.detail.abgleich": "Bronvergelijking",
    "integrationen.liste.detail.abgleichZahlen":
      "{{entfernt}} verwijderd · {{zurueck}} teruggehaald · {{ungeprueft}} niet gecontroleerd",
    "integrationen.liste.nichtFestgehalten": "niet vastgelegd",
    "integrationen.liste.keiner": "geen",
    "integrationen.liste.hilfe.laeuft":
      "De run werkt nog. De lijst vraagt elke 10 seconden opnieuw; een afbreking verschijnt hier met haar reden.",
    "integrationen.liste.hilfe.fertig":
      "Afgerond. De overgenomen items staan in de controle verderop en wachten op aanname.",
    "integrationen.liste.hilfe.teilweise":
      "Gedeeltelijk overgenomen. Open de rundetails; start de overige items opnieuw zodra het is opgelost — er wordt niets dubbel aangemaakt.",
    "integrationen.liste.hilfe.fehlgeschlagen":
      "De run is zonder vastgelegde reden afgebroken. Controleer hierboven de verbinding van de bron en start de import opnieuw.",
    "integrationen.liste.hilfe.unbekannterCode":
      "Foutcode {{code}} wordt hier niet nader uitgelegd. Open de rundetails en geef de code door aan het beheer.",
    "integrationen.liste.hilfe.zustandUnbekannt":
      "Deze versie kent de toestand van deze run niet. Open de rundetails en geef het runkenmerk door aan het beheer.",
    "integrationen.liste.hilfe.nichtEingerichtet":
      "De bron was niet ingericht. Vul de ontbrekende gegevens op de server aan, controleer hierboven de verbinding en start de import opnieuw.",
    "integrationen.liste.hilfe.ausgeschaltet":
      "De import was uitgeschakeld. Schakel hem hierboven in en start de import opnieuw.",
    "integrationen.liste.hilfe.keineBerechtigung":
      "Het opgeslagen account mocht de bron niet lezen. Laat leesrecht toekennen en start de import opnieuw.",
    "integrationen.liste.hilfe.nichtGefunden":
      "De bron was daar niet (meer). Controleer de opgeslagen bibliotheek of ruimte en kies opnieuw.",
    "integrationen.liste.hilfe.nichtErreichbar":
      "De bron was niet bereikbaar of de aanmelding gold niet meer. Start hierboven de verbindingstest — die onderscheidt een geweigerde aanmelding van een tijdslimiet.",
    "integrationen.liste.hilfe.zeitueberschreitung":
      "De bron heeft niet op tijd geantwoord. Start de import later opnieuw of beperk de selectie.",
    "integrationen.liste.hilfe.zuGross":
      "Ten minste één inhoud was te groot en is niet overgenomen. Splits het bestand of open het via zijn adres.",
  },
} satisfies Textmodul;
