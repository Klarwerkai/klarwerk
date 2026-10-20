import type { Textmodul } from "./intern/pruefung";
export default {
  praefix: "seitentutorial.",
  legacySchluessel: [],
  de: {
    "seitentutorial.titel": "Tutorial: {{seite}}",
    "seitentutorial.lernziel":
      "Den tatsächlichen Weg auf {{seite}} verstehen und selbst bewusst anwenden.",
    "seitentutorial.orientierung": "Orientieren",
    "seitentutorial.aktion": "Kernaktion",
    "seitentutorial.ergebnis": "Ergebnis prüfen",
    "seitentutorial.sonderfall": "Wenn es anders läuft",
    "seitentutorial.rahmen":
      "Die Erklärung arbeitet mit den sichtbaren Bedienelementen der echten Seite und deinen heutigen Rechten. Weiter, Zurück und Pause steuern nur die Begleitung.",
    "seitentutorial.grenze":
      "Dies ist Bedienhilfe, kein gespeicherter Entwurf und keine Freigabe. Die Begleitung führt keine Arbeit aus. Eingaben und jede Bestätigung erfolgen bewusst auf der echten Seite.",
    "seitentutorial.demo": "Begleitung an der echten Seite",
    "seitentutorial.zeigen": "Bedienelement zeigen",
    "seitentutorial.fehlend":
      "Dieses Ziel ist derzeit nicht bedienbar oder nicht sichtbar. Prüfe Ladezustand, Auswahl und heutige Rechte. Die Erklärung bleibt verfügbar; es wurde nichts ausgeführt.",
    "seitentutorial.uebergang": "Auf der echten Seite fortfahren",
    "seitentutorial.fortsetzen": "Tutorial fortsetzen",
    "seitentutorial.unterbrochen":
      "Unterbrochene Begleitung auf {{pfad}}: {{titel}}. Zurückkehren öffnet denselben Schritt pausiert.",
    "seitentutorial.zurueck": "Zur unterbrochenen Seite",
    "seitentutorial.start.aktion":
      "Wähle auf der Startseite Fragen, Bibliothek oder Erfassen passend zu deinem Vorhaben.",
    "seitentutorial.start.ergebnis": "Das Öffnen eines Bereichs verändert noch kein Wissen.",
    "seitentutorial.start.sonderfall":
      "Fehlt ein Weg, prüfe deine aktuelle Rolle. Klara erklärt auch die sichtbare Seite.",
    "seitentutorial.bibliothek.aktion":
      "Suche im Suchfeld, wähle den Suchraum einschließlich Meine Ablage und öffne einen Treffer. Filter schränken die Liste ein.",
    "seitentutorial.bibliothek.ergebnis":
      "Lies den Treffergrund, Artikelstand und Quellenbezug. Eine KI-Antwort ist gesondert gekennzeichnet.",
    "seitentutorial.bibliothek.sonderfall":
      "Bei leerer Liste Suchraum und Filter prüfen oder Filter aufheben. Gesperrte Inhalte werden dadurch nicht zugänglich.",
    "seitentutorial.artikel.aktion":
      "Lies den Artikel und seine Fassung. Öffne Mehr für Quellen, Originalbezug und Prüfstand; gemeinsame Bearbeitung ist ein eigener erlaubnispflichtiger Weg.",
    "seitentutorial.artikel.ergebnis":
      "Vergleiche Quellenstand und Geltung mit deiner Frage. Eine Lesefassung oder Übersetzung ersetzt keine neue Freigabe.",
    "seitentutorial.artikel.sonderfall":
      "Bei fehlender Quelle oder abweichender Fassung dem sichtbaren Hinweis folgen; kein Original ohne Leserecht versprechen.",
    "seitentutorial.wissensnetz.aktion":
      "Wähle ein Thema in der Themenkarte oder Seitenleiste und öffne die zugehörigen Artikel.",
    "seitentutorial.wissensnetz.ergebnis":
      "Die Karte zeigt Zusammenhänge im sichtbaren Bestand; sie erteilt keine zusätzlichen Leserechte.",
    "seitentutorial.wissensnetz.sonderfall":
      "Bei leerem Thema dessen Artikelliste prüfen. Die Legende erklärt ausgeblendete oder nicht dargestellte Kanten.",
    "seitentutorial.extern.aktion":
      "Wähle einen sichtbaren externen Wissenseintrag und prüfe Herkunft und Originalbezug.",
    "seitentutorial.extern.ergebnis":
      "Externe Herkunft und interne Prüfung sind unterschiedliche Angaben.",
    "seitentutorial.extern.sonderfall":
      "Ein nicht erreichbares Original ist kein Beleg für seine Gültigkeit. Beachte den sichtbaren Zugangs- oder Fehlerhinweis.",
    "seitentutorial.dokumentfragen.aktion":
      "Wähle eine Datei, stelle deine Frage im Fragefeld und prüfe die gefundene Textstelle.",
    "seitentutorial.dokumentfragen.ergebnis":
      "Dieser Dokumentweg liest lokal im Browser. Textstelle und Lücke bleiben erkennbar.",
    "seitentutorial.dokumentfragen.sonderfall":
      "Bei Lesefehler oder fehlender Textstelle Datei und Frage prüfen; nicht gefunden bedeutet keine belegte Antwort.",
    "seitentutorial.begriffe.aktion":
      "Suche einen Firmenbegriff und lies Vorzugsbegriff, Geltung und Verlauf. Pflege ist nur mit Prüfberechtigung möglich.",
    "seitentutorial.begriffe.ergebnis":
      "Der Begriffseintrag erklärt die geltende Bezeichnung; eine neue Fassung entsteht erst durch bewusstes Speichern.",
    "seitentutorial.begriffe.sonderfall":
      "Keine Treffer: Suche erweitern. Fehlende Pflegeknöpfe sind keine Aufforderung, Rechte zu wechseln.",
    "seitentutorial.livewall.aktion":
      "Lies die sichtbaren aktuellen Ereignisse in der Beameransicht.",
    "seitentutorial.livewall.ergebnis":
      "Die Wand bleibt auf deine Sichtrechte begrenzt und ist keine öffentliche Freigabe aller Inhalte.",
    "seitentutorial.livewall.sonderfall":
      "Bei leerer Ansicht aktuellen Bestand und Ladehinweis beachten.",
    "seitentutorial.erfassen.aktion":
      "Wähle den passenden Erfassungsweg, gib Inhalt ein und prüfe Titel, Vertraulichkeit und Quellen vor Speichern oder Einreichen.",
    "seitentutorial.erfassen.ergebnis":
      "Entwurf, gespeicherter Beitrag und Freigabe sind verschiedene Zustände. Nur die tatsächliche Rückmeldung bestätigt den Speichervorgang.",
    "seitentutorial.erfassen.sonderfall":
      "Bei Fehler oder Zeitüberschreitung Eingaben behalten und Bibliothek beziehungsweise Entwürfe prüfen, bevor du erneut speicherst.",
    "seitentutorial.entwuerfe.aktion":
      "Öffne einen eigenen Entwurf zum Fortsetzen; suche bei Bedarf in Meine Ablage oder prüfe den Papierkorb.",
    "seitentutorial.entwuerfe.ergebnis":
      "Ein Entwurf ist keine freigegebene Wissensfassung. Die Übersicht verwendet denselben Entwurfsbestand wie der Editor.",
    "seitentutorial.entwuerfe.sonderfall":
      "Bei Ladefehler erneut laden. Eine leere Liste kann durch Suchraum oder Filter entstehen.",
    "seitentutorial.ablauf.aktion":
      "Lade die Ablaufdatei, prüfe Schritte und Bilder, schwärze private Inhalte und entscheide bewusst zwischen Speichern und Einreichen.",
    "seitentutorial.ablauf.ergebnis":
      "Ungespeichert, gespeichert und eingereicht werden getrennt angezeigt; das Tutorial führt keine Einreichung aus.",
    "seitentutorial.ablauf.sonderfall":
      "Bei Dateifehler den sichtbaren Grund prüfen. Vor dem Verlassen ungespeicherte Änderungen beachten.",
    "seitentutorial.aufgaben.aktion":
      "Öffne die Aufgabe und ihren Originalbezug. Persönliche Aufgaben und Erinnerungen haben eigene Bereiche; Erledigen ist eine bewusste Handlung.",
    "seitentutorial.aufgaben.ergebnis":
      "Lies Status, Zuständigkeit und Ergebnis. Eine gespeicherte Notiz erledigt nicht automatisch die zugehörige Aufgabe.",
    "seitentutorial.aufgaben.sonderfall":
      "Bei pausiertem oder veraltetem Stand die Erklärung und Wie weiter öffnen.",
    "seitentutorial.pruefen.aktion":
      "Wähle einen Beitrag in der Warteschlange, prüfe Inhalt und Belege und entscheide mit deiner Prüfrolle über Freigabe oder Rückfrage.",
    "seitentutorial.pruefen.ergebnis":
      "Nur eine tatsächlich bestätigte Entscheidung ändert den Prüfstand. Ein Tutorialabschluss gibt nichts frei.",
    "seitentutorial.pruefen.sonderfall":
      "Bei inzwischen entschiedenem oder fehlendem Objekt den aktuellen Stand öffnen; Stapelaktionen vor Bestätigung prüfen.",
    "seitentutorial.konflikte.aktion":
      "Vergleiche die widersprechenden Beiträge und Quellen; ordne Geltung und Vorrang ein, bevor du eine begründete Auflösung sendest.",
    "seitentutorial.konflikte.ergebnis":
      "Vorschlag, Zweitmeinung und abgeschlossene Auflösung sind unterscheidbar. Die Entscheidung bleibt bei der Prüfrolle.",
    "seitentutorial.konflikte.sonderfall":
      "Fehlt die Beweislage, klären oder eskalieren statt unbelegt auflösen.",
    "seitentutorial.duplikate.aktion":
      "Vergleiche die vermuteten Dubletten und ihre Quellen. Prüfe den Eigenanteil, bevor du Zusammenführen öffnest.",
    "seitentutorial.duplikate.ergebnis":
      "Ein Vergleich verändert noch keinen Artikel; erst eine bestätigte Entscheidung schließt den Vorgang ab.",
    "seitentutorial.duplikate.sonderfall":
      "Bei unterschiedlichen Aussagen den Konfliktweg beachten; ähnliche Titel allein belegen keine Dublette.",
    "seitentutorial.zusammenfuehren.aktion":
      "Wähle Führung, Inhalte und Quellen, prüfe die Vorschau und bestätige die Freigabe erst nach Prüfung aller Folgen.",
    "seitentutorial.zusammenfuehren.ergebnis":
      "Die Vorschau ist noch keine gespeicherte Zusammenführung. Die bestätigte Ergebnisansicht belegt die Wirkung.",
    "seitentutorial.zusammenfuehren.sonderfall":
      "Bei veraltetem Stand neu lesen und Entscheidungen prüfen; Zurück verändert noch keine Freigabe.",
    "seitentutorial.spaces.aktion":
      "Öffne einen sichtbaren Space und seine Artikel. Bearbeiten verlangt Schreibrecht oder Zuständigkeit; zum Anlegen ist Prüfberechtigung nötig.",
    "seitentutorial.spaces.ergebnis":
      "Prüfe Mitglieder, Regeln und Sichtbarkeit. Erst Speichern bestätigt eine Änderung; Space-Rechte ersetzen keine Artikelrechte.",
    "seitentutorial.spaces.sonderfall":
      "Bei nicht gefundenem Space oder fehlendem Schreibknopf heutige Rechte beachten; Löschen erklärt eigene Folgen vor Bestätigung.",
    "seitentutorial.chat.aktion":
      "Wähle ein Gespräch und prüfe Empfänger sowie Sichtbarkeit, bevor du eine Nachricht sendest. Wissensübernahme ist ein eigener Entwurfsweg.",
    "seitentutorial.chat.ergebnis":
      "Klara-Nachrichtenentwurf, gesendete Nachricht und Wissensentwurf bleiben getrennte Ergebnisse.",
    "seitentutorial.chat.sonderfall":
      "Bei Sendefehler den sichtbaren Status prüfen. Gesperrte Anhänge und Verweise bleiben gesperrt.",
    "seitentutorial.gemeinsam.aktion":
      "Bearbeite den gemeinsamen Entwurf mit Schreibrecht und speichere deine Fassung. Prüfe fremde Änderungen vor dem Angleichen.",
    "seitentutorial.gemeinsam.ergebnis":
      "Gemeinsamer Entwurf, Übernahmevorschlag und freigegebener Artikel sind getrennt.",
    "seitentutorial.gemeinsam.sonderfall":
      "Bei Konflikt eigene und fremde Fassung vergleichen. Ohne Schreibrecht bleibt die Lesefassung; Klara ändert keine Rechte.",
    "seitentutorial.gesamtanweisungen.aktion":
      "Wähle die Teile der Gesamtanweisung und prüfe Lesestand sowie Vergleich. Anlegen verlangt Erfassungsrecht, Prüfen die Prüfrolle.",
    "seitentutorial.gesamtanweisungen.ergebnis":
      "Die Gesamtanweisung behält den Bezug zu ihren Teilen und Fassungen. Ein Lesestand ist keine neue Freigabe.",
    "seitentutorial.gesamtanweisungen.sonderfall":
      "Fehlende Teile oder Rechte anhand der Meldung klären; nicht zugängliche Inhalte werden nicht ergänzt.",
    "seitentutorial.besprechungen.aktion":
      "Öffne eine zugängliche Besprechung; verbinde Folien und Mitschrift mit Erfassungsrecht und prüfe die Zuordnung vor Rückmeldungen.",
    "seitentutorial.besprechungen.ergebnis":
      "Rückmeldung, Quellenbezug und daraus übernommenes Wissen sind eigenständige Ergebnisse.",
    "seitentutorial.besprechungen.sonderfall":
      "Bei offener Zuordnung oder gesperrter Folie dem sichtbaren Hinweis folgen; Teilnahme gibt nicht automatisch Dateirechte.",
    "seitentutorial.kalender.aktion":
      "Öffne einen eigenen Kalendereintrag und prüfe Zeit, Zeitzone, Herkunft und verknüpften Auftrag vor Bearbeiten.",
    "seitentutorial.kalender.ergebnis":
      "Ein Kalendereintrag, eine Erinnerung und eine ausgeführte Arbeit sind unterschiedliche Ergebnisse.",
    "seitentutorial.kalender.sonderfall":
      "Geschützte oder unaufgelöste Bezüge beachten. Bei Serien die angezeigten Folgen vor Bestätigung prüfen.",
    "seitentutorial.verwaltung.aktion":
      "Benutzer und Rollen: Suche ein Konto und prüfe Rolle sowie Zugang. KI: Öffne Anbieter und Modelle, Zugänge, Funktionen oder Grenzen; prüfe die Zuordnung und den Ein-/Auszustand vor Speichern. Sicherheit und Nachweise, Berichte, System und Vorführdaten haben eigene Bereiche.",
    "seitentutorial.verwaltung.ergebnis":
      "Kontorolle, persönliche Ansicht und Unternehmensvorgabe haben unterschiedliche Wirkung. Das Tutorial speichert keine Änderung.",
    "seitentutorial.verwaltung.sonderfall":
      "Ohne Verwaltungsrecht wird diese Begleitung nicht angeboten. Bei Fehlermeldung die tatsächliche Entscheidung abwarten.",
    "seitentutorial.profil.aktion":
      "Prüfe deine persönlichen Einstellungen, Sprache und Sicherheit. Änderungen betreffen das angezeigte eigene Konto.",
    "seitentutorial.profil.ergebnis":
      "Erst die sichtbare Speicherbestätigung belegt eine Änderung. Eine Rollenansicht vergibt keine neuen Kontorechte.",
    "seitentutorial.profil.sonderfall":
      "Bei Sicherheitsänderungen den vorgesehenen eigenen Bestätigungsweg verwenden; Klara liest keine geheimen Felder vor.",
    "seitentutorial.import.aktion":
      "Wähle die vorgesehene Importquelle und prüfe Zuordnung, Rechte und Vorschau vor dem tatsächlichen Importstart.",
    "seitentutorial.import.ergebnis":
      "Ein Importlauf erhält eine eigene Ergebnisansicht. Vorschau und tatsächlich übernommene Inhalte sind getrennt.",
    "seitentutorial.import.sonderfall":
      "Bei Fehler den Laufstatus prüfen, bevor du neu startest. Verwaltungsrecht und Stufe 2 bleiben erforderlich.",
    "seitentutorial.importlauf.aktion":
      "Lies Kennung, Ausgang und Zähler des konkreten Importlaufs; der Rückweg führt zum Importbereich.",
    "seitentutorial.importlauf.ergebnis":
      "Beendet bedeutet nicht automatisch vollständig übernommen. Prüfe Ausgang und Lücken dieses Laufs.",
    "seitentutorial.importlauf.sonderfall":
      "Nicht gefunden ist kein erfolgreicher Lauf. Bei Fehler über den Rückweg den aktuellen Importstand lesen.",
    "seitentutorial.analytics.aktion":
      "Lies Kennzahlen, Kategorien und Wochenverlauf mit dem angezeigten Berechnungsstand.",
    "seitentutorial.analytics.ergebnis":
      "Unbekannt, unbelegt und berechnet sind unterschiedliche Aussagen; eine Kennzahl ist keine Freigabe einzelner Artikel.",
    "seitentutorial.analytics.sonderfall":
      "Fehlende Prüfzeitpunkte und Demo-Hinweise bei der Auswertung berücksichtigen.",
    "seitentutorial.lebenszyklus.aktion":
      "Wähle einen Pflegevorgang, prüfe Anlass, Zuständigkeit und Termin und bearbeite ihn mit deiner Prüfrolle.",
    "seitentutorial.lebenszyklus.ergebnis":
      "Vorlage, angelegte Folgeprüfung und quittierter Abschluss sind verschiedene Zustände.",
    "seitentutorial.lebenszyklus.sonderfall":
      "Bei Ladefehler erneut lesen; eine Vorlage erledigt keine offene Prüfung.",
    "seitentutorial.risiko.aktion":
      "Öffne eine sichtbare Lücke oder Risikomeldung und prüfe Belegbedarf, Zuständigkeit und vorgesehenen Abschlussweg.",
    "seitentutorial.risiko.ergebnis":
      "Priorisierung, Beitrag und tatsächlich geschlossene Lücke sind verschiedene Ergebnisse; Beteiligungsrechte gelten am Vorgang.",
    "seitentutorial.risiko.sonderfall":
      "Bei fehlendem Vorgang keine Beteiligung unterstellen; die angezeigte Sperre bleibt bestehen.",
    "seitentutorial.ausgang.aktion":
      "Prüfe den ausgehenden Text und seine Belege vor der vorgesehenen Freigabe.",
    "seitentutorial.ausgang.ergebnis":
      "Geprüfte Vorschau und tatsächlich freigegebenes Ergebnis bleiben getrennt.",
    "seitentutorial.ausgang.sonderfall":
      "Ohne Prüfberechtigung gibt es hier keine bedienbare Freigabe. Bei fehlenden Belegen zuerst klären.",
    "seitentutorial.vorlagen.aktion":
      "Lies die Vorlage samt Geltung. Bearbeiten oder Standardwahl benötigt das jeweils angezeigte Verwaltungs- oder Spacerecht.",
    "seitentutorial.vorlagen.ergebnis":
      "Eine geänderte Vorlage verändert bestehende Artikel nicht rückwirkend; die Wirkungsanzeige erklärt Nutzung und Bestand.",
    "seitentutorial.vorlagen.sonderfall":
      "Vor Ausmustern oder verbindlichen Vorgaben Folgen und Begründung prüfen; das Tutorial setzt keinen Standard.",
    "seitentutorial.unternehmen.aktion":
      "Prüfe Unternehmensprofil oder Richtlinie, ihre Geltung und den Änderungsgrund; lies die Wirkung vor Speichern oder Veröffentlichen.",
    "seitentutorial.unternehmen.ergebnis":
      "Profiländerung und veröffentlichte Richtlinienfassung haben unterschiedliche Reichweite und einen eigenen Verlauf.",
    "seitentutorial.unternehmen.sonderfall":
      "Eine Entwurfsansicht veröffentlicht nichts. Fehler und Wirkungshinweise vor erneutem Speichern prüfen.",
    "seitentutorial.richtlinien.aktion":
      "Lies die gültige Richtlinienfassung und ihre Reichweite. Kenntnisnahme oder Zustimmung gibst du bewusst selbst ab.",
    "seitentutorial.richtlinien.ergebnis":
      "Gelesen, Kenntnis genommen und zugestimmt sind unterschiedliche Zustände.",
    "seitentutorial.richtlinien.sonderfall":
      "Bei fehlender Richtlinie oder Fehler dem sichtbaren Hinweis folgen; das Tutorial bestätigt nichts für dich.",
    "seitentutorial.kommunikation.aktion":
      "Prüfe Ereignis, Kanal und Häufigkeit deiner Meldungen. Unternehmensvorgaben sind nur mit Verwaltungsrecht änderbar.",
    "seitentutorial.kommunikation.ergebnis":
      "Eigene Wahl und Unternehmensvorgabe sind getrennt; die Wirkungsanzeige zeigt, welche Einstellung tatsächlich gilt.",
    "seitentutorial.kommunikation.sonderfall":
      "Nicht abwählbare Meldungen beachten. Bei fehlgeschlagenem Speichern gilt nicht automatisch der Entwurf.",
    "seitentutorial.anbindung.aktion":
      "Prüfe die eigene Anbindung, Zeitzone und Feldrichtungen. Abgleichen und jede wartende Entscheidung bleiben bewusste Handlungen.",
    "seitentutorial.anbindung.ergebnis":
      "Lokales Entfernen einer Anbindung löscht keine externen Termine. Vorschlag, bestätigte Entscheidung und ausgeführter Abgleich bleiben getrennt.",
    "seitentutorial.anbindung.sonderfall":
      "Bei Konflikt die angezeigte Feldentscheidung prüfen; fehlende Anbieterrechte nicht umgehen.",
    "seitentutorial.qualitaet.aktion":
      "Aktualisiere den Stand, filtere Qualitätsaufgaben und öffne den Originalvorgang zur Bearbeitung.",
    "seitentutorial.qualitaet.ergebnis":
      "Bilanz, Übernahme und Ergebnis sind getrennt; jede Zeile bleibt auf die heutigen Sichtrechte begrenzt.",
    "seitentutorial.qualitaet.sonderfall":
      "Veralteter Stand oder fehlende Quelle zuerst klären. Eine leere Liste belegt nicht die Abwesenheit aller Aufgaben.",
    "seitentutorial.hilfe.aktion":
      "Suche eine Hilfe oder öffne einen thematischen Einstieg. Die erklärten Weiterwege beachten deine aktuelle Rolle.",
    "seitentutorial.hilfe.ergebnis":
      "Erklärung und Vorführung sind keine tatsächliche Arbeit. Zum Anwenden öffnest du bewusst die echte Seite.",
    "seitentutorial.hilfe.sonderfall":
      "Bei keinem Treffer die Suche vereinfachen oder als Frage formulieren.",
    "seitentutorial.mobile.aktion":
      "Wähle Text, Interview oder Foto; prüfe deinen Entwurf und die Warteschlange vor dem Senden.",
    "seitentutorial.mobile.ergebnis":
      "Lokale Warteschlange, Serverentwurf und eingereichter Beitrag sind unterschiedliche Zustände.",
    "seitentutorial.mobile.sonderfall":
      "Offline- und Kontohinweise beachten; fremde oder ungebundene Vorgänge nicht als eigene fortsetzen.",
    "seitentutorial.output.aktion":
      "Wähle Ausgabeart und lesbare Quellen, prüfe den erzeugten Text und nutze erst dann die angebotene Ausgabe.",
    "seitentutorial.output.ergebnis":
      "Erzeugter Entwurf und tatsächlich heruntergeladene oder gedruckte Ausgabe sind getrennt. Quellenrechte bleiben wirksam.",
    "seitentutorial.output.sonderfall":
      "Bei fehlenden Quellen oder Fehlern zuerst die angezeigte Lücke klären; kein Export wird vom Tutorial ausgelöst.",
    "seitentutorial.graph.aktion":
      "Prüfe Beziehungen, Richtung und Beziehungsart im Wissensgraphen. Kuratieren ist eine eigene berechtigte Handlung.",
    "seitentutorial.graph.ergebnis":
      "Angezeigte Verbindung und bestätigte kuratierte Beziehung sind unterscheidbar.",
    "seitentutorial.graph.sonderfall":
      "Ein fehlender Knoten kann am Sichtrecht liegen. Die Begleitung erweitert keinen Zugriff.",
    "seitentutorial.kapital.aktion":
      "Lies Lagebild, Reifegrad und reale Bewertungsfälle. Prüfe Bereich und Beleggrundlage vor einer Werteeingabe.",
    "seitentutorial.kapital.ergebnis":
      "Gemessene Werte, fehlende Belege und Schätzungen sind getrennt zu lesen; ein Tutorial erzeugt keinen Unternehmenswert.",
    "seitentutorial.kapital.sonderfall":
      "Unbelegte oder unbekannte Werte nicht als gemessen übernehmen. Rollen- und Stufe-2-Grenzen gelten weiter.",
  },
  en: {
    "seitentutorial.titel": "Tutorial: {{seite}}",
    "seitentutorial.lernziel":
      "Understand the actual workflow on {{seite}} and apply it deliberately yourself.",
    "seitentutorial.orientierung": "Orient yourself",
    "seitentutorial.aktion": "Core action",
    "seitentutorial.ergebnis": "Check the result",
    "seitentutorial.sonderfall": "When things differ",
    "seitentutorial.rahmen":
      "This explanation uses the real page's visible controls and your current permissions. Next, Back and Pause control only the tutorial.",
    "seitentutorial.grenze":
      "This is guidance, not a saved draft or approval. It performs no work. Enter data and confirm actions deliberately on the real page.",
    "seitentutorial.demo": "Guidance on the real page",
    "seitentutorial.zeigen": "Show the control",
    "seitentutorial.fehlend":
      "This target is not currently usable or visible. Check loading, selection and current permissions. Guidance remains available; nothing was executed.",
    "seitentutorial.uebergang": "Continue on the real page",
    "seitentutorial.fortsetzen": "Resume tutorial",
    "seitentutorial.unterbrochen":
      "Interrupted guidance on {{pfad}}: {{titel}}. Returning opens the same step paused.",
    "seitentutorial.zurueck": "Return to the interrupted page",
    "seitentutorial.start.aktion": "Choose Ask, Library or Capture on the home page for your task.",
    "seitentutorial.start.ergebnis": "Opening a section does not change knowledge.",
    "seitentutorial.start.sonderfall":
      "If a route is missing, check your current role. Klara can explain the visible page.",
    "seitentutorial.bibliothek.aktion":
      "Search, choose the search scope including your own collection, and open a result. Filters narrow the list.",
    "seitentutorial.bibliothek.ergebnis":
      "Read the match reason, article version and sources. An AI answer has a separate label.",
    "seitentutorial.bibliothek.sonderfall":
      "For an empty list, check the scope and filters or clear them. This does not grant access to restricted content.",
    "seitentutorial.artikel.aktion":
      "Read the article and its version. Open More for sources, originals and review status; collaborative editing requires its own permission.",
    "seitentutorial.artikel.ergebnis":
      "Compare source status and applicability with your question. A reading version or translation is not a new approval.",
    "seitentutorial.artikel.sonderfall":
      "Follow the displayed notice for a missing source or a different version; original access still requires permission.",
    "seitentutorial.wissensnetz.aktion":
      "Select a topic on the map or sidebar and open its articles.",
    "seitentutorial.wissensnetz.ergebnis":
      "The map shows relationships within visible knowledge; it grants no additional read permissions.",
    "seitentutorial.wissensnetz.sonderfall":
      "For an empty topic, check its article list. The legend explains hidden or omitted edges.",
    "seitentutorial.extern.aktion":
      "Select a visible external knowledge entry and inspect its origin and original source.",
    "seitentutorial.extern.ergebnis": "External origin and internal review are separate facts.",
    "seitentutorial.extern.sonderfall":
      "An unavailable original does not prove validity. Follow the access or error notice.",
    "seitentutorial.dokumentfragen.aktion":
      "Choose a file, enter your question and inspect the matching passage.",
    "seitentutorial.dokumentfragen.ergebnis":
      "This document path reads locally in the browser. Passages and missing evidence remain distinguishable.",
    "seitentutorial.dokumentfragen.sonderfall":
      "For a read error or missing passage, check the file and question; no match is not a supported answer.",
    "seitentutorial.begriffe.aktion":
      "Look up a company term and read its preferred term, scope and history. Editing requires review permission.",
    "seitentutorial.begriffe.ergebnis":
      "The entry explains the applicable term; a new version requires deliberate saving.",
    "seitentutorial.begriffe.sonderfall":
      "No results: broaden the search. Missing editing controls do not imply that you should switch permissions.",
    "seitentutorial.livewall.aktion": "Read the current visible events in the projector view.",
    "seitentutorial.livewall.ergebnis":
      "The wall remains limited to your permissions and does not publish all content.",
    "seitentutorial.livewall.sonderfall":
      "For an empty view, check the current data and loading notice.",
    "seitentutorial.erfassen.aktion":
      "Choose a capture method, enter content and review title, confidentiality and sources before saving or submitting.",
    "seitentutorial.erfassen.ergebnis":
      "Draft, saved contribution and approval are different states. Only the actual response confirms a save.",
    "seitentutorial.erfassen.sonderfall":
      "After an error or timeout, keep your input and check the Library or drafts before saving again.",
    "seitentutorial.entwuerfe.aktion":
      "Open your draft to continue; search your own collection or check the trash when needed.",
    "seitentutorial.entwuerfe.ergebnis":
      "A draft is not approved knowledge. This overview uses the same drafts as the editor.",
    "seitentutorial.entwuerfe.sonderfall":
      "Retry after a loading error. Search scope or filters can cause an empty list.",
    "seitentutorial.ablauf.aktion":
      "Load the workflow file, inspect steps and images, redact private content and deliberately choose Save or Submit.",
    "seitentutorial.ablauf.ergebnis":
      "Unsaved, saved and submitted states are shown separately; the tutorial does not submit anything.",
    "seitentutorial.ablauf.sonderfall":
      "For a file error, read the displayed reason. Check for unsaved changes before leaving.",
    "seitentutorial.aufgaben.aktion":
      "Open the task and its original context. Personal tasks and reminders have separate sections; completing is deliberate.",
    "seitentutorial.aufgaben.ergebnis":
      "Read status, owner and result. Saving a note does not automatically complete its task.",
    "seitentutorial.aufgaben.sonderfall":
      "For a paused or stale state, open the explanation and next-step help.",
    "seitentutorial.pruefen.aktion":
      "Select a contribution in the queue, review content and evidence and use your reviewer role to approve or ask a question.",
    "seitentutorial.pruefen.ergebnis":
      "Only a confirmed decision changes review status. Completing a tutorial approves nothing.",
    "seitentutorial.pruefen.sonderfall":
      "For an already decided or missing item, open its current state; review batch actions before confirmation.",
    "seitentutorial.konflikte.aktion":
      "Compare conflicting contributions and sources; assess applicability and precedence before submitting a reasoned resolution.",
    "seitentutorial.konflikte.ergebnis":
      "Proposal, second opinion and completed resolution are distinct. The reviewer makes the decision.",
    "seitentutorial.konflikte.sonderfall":
      "When evidence is missing, clarify or escalate before resolving.",
    "seitentutorial.duplikate.aktion":
      "Compare suspected duplicates and their sources. Check unique content before opening Merge.",
    "seitentutorial.duplikate.ergebnis":
      "Comparison does not change an article; a confirmed decision completes the process.",
    "seitentutorial.duplikate.sonderfall":
      "For different claims, consider the conflict route; similar titles alone do not prove duplication.",
    "seitentutorial.zusammenfuehren.aktion":
      "Choose the leading article, content and sources, review the preview and approve only after checking the consequences.",
    "seitentutorial.zusammenfuehren.ergebnis":
      "The preview is not a saved merge. The confirmed result shows the effect.",
    "seitentutorial.zusammenfuehren.sonderfall":
      "For a stale version, reload and review decisions; Back does not change approval.",
    "seitentutorial.spaces.aktion":
      "Open a visible Space and its articles. Editing requires write access or ownership; creating requires review permission.",
    "seitentutorial.spaces.ergebnis":
      "Check members, rules and visibility. Only saving confirms a change; Space access does not replace article access.",
    "seitentutorial.spaces.sonderfall":
      "For a missing Space or editing control, respect current permissions; deletion explains its consequences before confirmation.",
    "seitentutorial.chat.aktion":
      "Choose a conversation and check recipients and visibility before sending. Knowledge transfer creates a separate draft.",
    "seitentutorial.chat.ergebnis":
      "Klara's message draft, sent message and knowledge draft are separate results.",
    "seitentutorial.chat.sonderfall":
      "For a sending error, check the displayed status. Restricted attachments and references remain restricted.",
    "seitentutorial.gemeinsam.aktion":
      "Edit the shared draft with write permission and save your version. Review other changes before reconciling.",
    "seitentutorial.gemeinsam.ergebnis":
      "Shared draft, transfer proposal and approved article are separate states.",
    "seitentutorial.gemeinsam.sonderfall":
      "For a conflict, compare both versions. Without write access, use the reading version; Klara does not change permissions.",
    "seitentutorial.gesamtanweisungen.aktion":
      "Choose the instruction parts and check reading status and comparison. Creating requires capture permission; review requires the reviewer role.",
    "seitentutorial.gesamtanweisungen.ergebnis":
      "The instruction retains links to its parts and versions. A reading state is not a new approval.",
    "seitentutorial.gesamtanweisungen.sonderfall":
      "Clarify missing parts or permissions using the notice; inaccessible content is not filled in.",
    "seitentutorial.besprechungen.aktion":
      "Open an accessible meeting; connect slides and transcript with capture permission and check references before feedback.",
    "seitentutorial.besprechungen.ergebnis":
      "Feedback, source references and transferred knowledge are separate results.",
    "seitentutorial.besprechungen.sonderfall":
      "Follow notices for unresolved references or restricted slides; participation does not automatically grant file access.",
    "seitentutorial.kalender.aktion":
      "Open your calendar entry and check time, time zone, origin and linked task before editing.",
    "seitentutorial.kalender.ergebnis":
      "A calendar entry, a reminder and completed work are different results.",
    "seitentutorial.kalender.sonderfall":
      "Respect protected or unresolved references. For recurring entries, review the displayed consequences before confirming.",
    "seitentutorial.verwaltung.aktion":
      "Users and roles: find an account and check role and access. AI: open providers and models, access, functions or limits; review assignments and enabled status before saving. Security and evidence, reports, system and demo data have their own sections.",
    "seitentutorial.verwaltung.ergebnis":
      "Account role, personal view and company default have different effects. The tutorial saves no changes.",
    "seitentutorial.verwaltung.sonderfall":
      "This tutorial is unavailable without administration permission. For errors, wait for the actual result.",
    "seitentutorial.profil.aktion":
      "Review your personal settings, language and security. Changes apply to the displayed personal account.",
    "seitentutorial.profil.ergebnis":
      "Only the displayed save confirmation proves a change. A role preview grants no new account permissions.",
    "seitentutorial.profil.sonderfall":
      "Use the designated personal confirmation flow for security changes; Klara does not read secret fields aloud.",
    "seitentutorial.import.aktion":
      "Select the intended import source and review mapping, permissions and preview before starting the import.",
    "seitentutorial.import.ergebnis":
      "An import run has its own results view. Preview and imported content are separate.",
    "seitentutorial.import.sonderfall":
      "After an error, check run status before restarting. Administration permission and stage 2 are required.",
    "seitentutorial.importlauf.aktion":
      "Read the identifier, outcome and counters of this import run; Back returns to imports.",
    "seitentutorial.importlauf.ergebnis":
      "Finished does not automatically mean fully imported. Check the outcome and gaps for this run.",
    "seitentutorial.importlauf.sonderfall":
      "Not found is not a successful run. On error, return to inspect current import status.",
    "seitentutorial.analytics.aktion":
      "Read metrics, categories and weekly trends with their calculation status.",
    "seitentutorial.analytics.ergebnis":
      "Unknown, unproven and calculated are different claims; a metric does not approve individual articles.",
    "seitentutorial.analytics.sonderfall":
      "Account for missing review timestamps and demo labels when interpreting results.",
    "seitentutorial.lebenszyklus.aktion":
      "Choose a maintenance case, review reason, owner and due date and handle it with your reviewer role.",
    "seitentutorial.lebenszyklus.ergebnis":
      "Template, created follow-up review and acknowledged completion are different states.",
    "seitentutorial.lebenszyklus.sonderfall":
      "Reload after a loading error; a template does not complete an open review.",
    "seitentutorial.risiko.aktion":
      "Open a visible gap or risk and review evidence requirements, owner and completion route.",
    "seitentutorial.risiko.ergebnis":
      "Priority, contribution and a closed gap are different results; access is checked for the case.",
    "seitentutorial.risiko.sonderfall":
      "Do not assume participation in a missing case; displayed restrictions remain in force.",
    "seitentutorial.ausgang.aktion": "Review outgoing text and its evidence before approval.",
    "seitentutorial.ausgang.ergebnis": "Reviewed preview and approved result remain separate.",
    "seitentutorial.ausgang.sonderfall":
      "Approval requires review permission. Clarify missing evidence first.",
    "seitentutorial.vorlagen.aktion":
      "Read the template and its scope. Editing or setting defaults requires the displayed administration or Space permission.",
    "seitentutorial.vorlagen.ergebnis":
      "Changing a template does not retroactively alter articles; the impact display explains usage and existing content.",
    "seitentutorial.vorlagen.sonderfall":
      "Before retiring a template or enforcing defaults, review consequences and reason; the tutorial sets no defaults.",
    "seitentutorial.unternehmen.aktion":
      "Review the company profile or policy, scope and reason; inspect the impact before saving or publishing.",
    "seitentutorial.unternehmen.ergebnis":
      "Profile changes and published policy versions have different scopes and their own histories.",
    "seitentutorial.unternehmen.sonderfall":
      "A draft view publishes nothing. Check errors and impact notices before saving again.",
    "seitentutorial.richtlinien.aktion":
      "Read the applicable policy version and scope. Acknowledge or consent deliberately yourself.",
    "seitentutorial.richtlinien.ergebnis": "Read, acknowledged and consented are different states.",
    "seitentutorial.richtlinien.sonderfall":
      "Follow the displayed notice for a missing policy or error; the tutorial acknowledges nothing for you.",
    "seitentutorial.kommunikation.aktion":
      "Review event, channel and frequency of your notifications. Company defaults require administration permission to change.",
    "seitentutorial.kommunikation.ergebnis":
      "Personal choices and company defaults are separate; the impact view shows which setting applies.",
    "seitentutorial.kommunikation.sonderfall":
      "Respect mandatory notifications. A failed save does not apply the draft automatically.",
    "seitentutorial.anbindung.aktion":
      "Review your connection, time zone and field directions. Synchronizing and pending decisions are deliberate actions.",
    "seitentutorial.anbindung.ergebnis":
      "Removing a local connection does not delete external events. Proposal, confirmed decision and completed sync remain distinct.",
    "seitentutorial.anbindung.sonderfall":
      "For a conflict, review the displayed field decision; do not bypass provider permissions.",
    "seitentutorial.qualitaet.aktion":
      "Refresh status, filter quality tasks and open the original case to act.",
    "seitentutorial.qualitaet.ergebnis":
      "Totals, takeover and result are separate; each row remains limited to current permissions.",
    "seitentutorial.qualitaet.sonderfall":
      "Clarify stale status or missing sources first. An empty list does not prove that no tasks exist.",
    "seitentutorial.hilfe.aktion":
      "Search help or open a topic introduction. Suggested routes respect your current role.",
    "seitentutorial.hilfe.ergebnis":
      "Explanation and demonstration are not actual work. Open the real page deliberately to apply them.",
    "seitentutorial.hilfe.sonderfall":
      "With no results, simplify the search or phrase it as a question.",
    "seitentutorial.mobile.aktion":
      "Choose text, interview or photo; inspect your draft and queue before sending.",
    "seitentutorial.mobile.ergebnis":
      "Local queue, server draft and submitted contribution are different states.",
    "seitentutorial.mobile.sonderfall":
      "Respect offline and account notices; do not resume other users' or unbound work as your own.",
    "seitentutorial.output.aktion":
      "Choose output type and readable sources, review the generated text, then use the offered export.",
    "seitentutorial.output.ergebnis":
      "Generated draft and downloaded or printed output are distinct. Source permissions still apply.",
    "seitentutorial.output.sonderfall":
      "Clarify missing sources or errors first; the tutorial triggers no export.",
    "seitentutorial.graph.aktion":
      "Review relationships, direction and type in the knowledge graph. Curation is a separate authorized action.",
    "seitentutorial.graph.ergebnis":
      "Displayed links and confirmed curated relationships are distinguishable.",
    "seitentutorial.graph.sonderfall":
      "A missing node may be restricted by permissions. The tutorial grants no access.",
    "seitentutorial.kapital.aktion":
      "Read the overview, maturity and real valuation cases. Check scope and evidence before entering values.",
    "seitentutorial.kapital.ergebnis":
      "Read measured values, missing evidence and estimates separately; a tutorial creates no business valuation.",
    "seitentutorial.kapital.sonderfall":
      "Do not treat unproven or unknown values as measurements. Role and stage-2 restrictions still apply.",
  },
  nl: {
    "seitentutorial.titel": "Tutorial: {{seite}}",
    "seitentutorial.lernziel":
      "Begrijp de echte werkwijze op {{seite}} en pas deze bewust zelf toe.",
    "seitentutorial.orientierung": "Oriënteren",
    "seitentutorial.aktion": "Kernactie",
    "seitentutorial.ergebnis": "Resultaat controleren",
    "seitentutorial.sonderfall": "Als het anders loopt",
    "seitentutorial.rahmen":
      "Deze uitleg gebruikt zichtbare bediening van de echte pagina en je huidige rechten. Verder, Terug en Pauze sturen alleen de tutorial.",
    "seitentutorial.grenze":
      "Dit is hulp, geen opgeslagen concept of goedkeuring. De hulp voert geen werk uit. Voer gegevens en bevestigingen bewust op de echte pagina in.",
    "seitentutorial.demo": "Hulp op de echte pagina",
    "seitentutorial.zeigen": "Bediening tonen",
    "seitentutorial.fehlend":
      "Dit doel is nu niet bedienbaar of zichtbaar. Controleer laden, selectie en huidige rechten. De uitleg blijft beschikbaar; er is niets uitgevoerd.",
    "seitentutorial.uebergang": "Verder op de echte pagina",
    "seitentutorial.fortsetzen": "Tutorial hervatten",
    "seitentutorial.unterbrochen":
      "Onderbroken hulp op {{pfad}}: {{titel}}. Terugkeren opent dezelfde stap gepauzeerd.",
    "seitentutorial.zurueck": "Terug naar de onderbroken pagina",
    "seitentutorial.start.aktion":
      "Kies op de startpagina Vragen, Bibliotheek of Vastleggen voor je taak.",
    "seitentutorial.start.ergebnis": "Een onderdeel openen verandert nog geen kennis.",
    "seitentutorial.start.sonderfall":
      "Ontbreekt een route, controleer dan je huidige rol. Klara kan de zichtbare pagina uitleggen.",
    "seitentutorial.bibliothek.aktion":
      "Zoek, kies het zoekbereik inclusief je eigen verzameling en open een resultaat. Filters beperken de lijst.",
    "seitentutorial.bibliothek.ergebnis":
      "Lees de reden van de match, artikelversie en bronnen. Een AI-antwoord heeft een apart label.",
    "seitentutorial.bibliothek.sonderfall":
      "Controleer bij een lege lijst bereik en filters of wis ze. Dit geeft geen toegang tot afgeschermde inhoud.",
    "seitentutorial.artikel.aktion":
      "Lees het artikel en de versie. Open Meer voor bronnen, originelen en beoordelingsstatus; samen bewerken vereist eigen rechten.",
    "seitentutorial.artikel.ergebnis":
      "Vergelijk bronstatus en geldigheid met je vraag. Een leesversie of vertaling is geen nieuwe goedkeuring.",
    "seitentutorial.artikel.sonderfall":
      "Volg de melding bij een ontbrekende bron of andere versie; toegang tot het origineel vereist leesrecht.",
    "seitentutorial.wissensnetz.aktion":
      "Kies een onderwerp op de kaart of zijbalk en open de artikelen.",
    "seitentutorial.wissensnetz.ergebnis":
      "De kaart toont verbanden in zichtbare kennis en geeft geen extra leesrechten.",
    "seitentutorial.wissensnetz.sonderfall":
      "Controleer bij een leeg onderwerp de artikellijst. De legenda verklaart verborgen of weggelaten verbindingen.",
    "seitentutorial.extern.aktion":
      "Kies een zichtbaar extern kennisitem en controleer herkomst en origineel.",
    "seitentutorial.extern.ergebnis":
      "Externe herkomst en interne beoordeling zijn verschillende gegevens.",
    "seitentutorial.extern.sonderfall":
      "Een onbereikbaar origineel bewijst geen geldigheid. Volg de toegangs- of foutmelding.",
    "seitentutorial.dokumentfragen.aktion":
      "Kies een bestand, stel je vraag en controleer de gevonden tekstpassage.",
    "seitentutorial.dokumentfragen.ergebnis":
      "Deze documentroute leest lokaal in de browser. Passages en ontbrekend bewijs blijven herkenbaar.",
    "seitentutorial.dokumentfragen.sonderfall":
      "Controleer bestand en vraag bij een leesfout of ontbrekende passage; geen match is geen onderbouwd antwoord.",
    "seitentutorial.begriffe.aktion":
      "Zoek een bedrijfsterm en lees voorkeursterm, bereik en geschiedenis. Onderhoud vereist beoordelingsrecht.",
    "seitentutorial.begriffe.ergebnis":
      "Het item verklaart de geldende term; een nieuwe versie vereist bewust opslaan.",
    "seitentutorial.begriffe.sonderfall":
      "Geen resultaten: verruim de zoekopdracht. Ontbrekende beheerknoppen betekenen niet dat je rechten moet wijzigen.",
    "seitentutorial.livewall.aktion":
      "Lees de huidige zichtbare gebeurtenissen in de presentatieweergave.",
    "seitentutorial.livewall.ergebnis":
      "De wand blijft beperkt tot jouw rechten en publiceert niet alle inhoud.",
    "seitentutorial.livewall.sonderfall":
      "Controleer bij een lege weergave gegevens en laadmelding.",
    "seitentutorial.erfassen.aktion":
      "Kies een vastlegmethode, voer inhoud in en controleer titel, vertrouwelijkheid en bronnen vóór opslaan of indienen.",
    "seitentutorial.erfassen.ergebnis":
      "Concept, opgeslagen bijdrage en goedkeuring zijn verschillende statussen. Alleen de echte terugmelding bevestigt opslaan.",
    "seitentutorial.erfassen.sonderfall":
      "Bewaar bij een fout of time-out je invoer en controleer Bibliotheek of concepten voordat je opnieuw opslaat.",
    "seitentutorial.entwuerfe.aktion":
      "Open je concept om verder te werken; zoek zo nodig in je eigen verzameling of controleer de prullenbak.",
    "seitentutorial.entwuerfe.ergebnis":
      "Een concept is geen goedgekeurde kennis. Dit overzicht gebruikt dezelfde concepten als de editor.",
    "seitentutorial.entwuerfe.sonderfall":
      "Laad opnieuw na een laadfout. Zoekbereik of filters kunnen een lege lijst veroorzaken.",
    "seitentutorial.ablauf.aktion":
      "Laad het procesbestand, controleer stappen en afbeeldingen, scherm privé-inhoud af en kies bewust Opslaan of Indienen.",
    "seitentutorial.ablauf.ergebnis":
      "Niet opgeslagen, opgeslagen en ingediend worden apart getoond; de tutorial dient niets in.",
    "seitentutorial.ablauf.sonderfall":
      "Lees bij een bestandsfout de getoonde reden. Controleer niet-opgeslagen wijzigingen vóór vertrek.",
    "seitentutorial.aufgaben.aktion":
      "Open de taak en de oorspronkelijke context. Persoonlijke taken en herinneringen hebben eigen onderdelen; afronden is bewust.",
    "seitentutorial.aufgaben.ergebnis":
      "Lees status, verantwoordelijke en resultaat. Een notitie opslaan voltooit niet automatisch de taak.",
    "seitentutorial.aufgaben.sonderfall":
      "Open bij een gepauzeerde of verouderde status de uitleg en vervolghulp.",
    "seitentutorial.pruefen.aktion":
      "Kies een bijdrage in de wachtrij, beoordeel inhoud en bewijs en keur met je beoordelaarsrol goed of stel een vraag.",
    "seitentutorial.pruefen.ergebnis":
      "Alleen een bevestigde beslissing verandert de beoordelingsstatus. Een tutorial afronden keurt niets goed.",
    "seitentutorial.pruefen.sonderfall":
      "Open bij een reeds beslist of ontbrekend item de huidige status; controleer bulkacties vóór bevestiging.",
    "seitentutorial.konflikte.aktion":
      "Vergelijk tegenstrijdige bijdragen en bronnen; beoordeel geldigheid en voorrang vóór een gemotiveerde oplossing.",
    "seitentutorial.konflikte.ergebnis":
      "Voorstel, tweede mening en afgeronde oplossing zijn verschillend. De beoordelaar beslist.",
    "seitentutorial.konflikte.sonderfall":
      "Ontbreekt bewijs, vraag dan om verduidelijking of escaleer vóór een oplossing.",
    "seitentutorial.duplikate.aktion":
      "Vergelijk vermoedelijke duplicaten en bronnen. Controleer unieke inhoud vóór Samenvoegen.",
    "seitentutorial.duplikate.ergebnis":
      "Vergelijken verandert nog geen artikel; een bevestigde beslissing voltooit het proces.",
    "seitentutorial.duplikate.sonderfall":
      "Overweeg bij verschillende uitspraken de conflictroute; gelijke titels bewijzen geen duplicaat.",
    "seitentutorial.zusammenfuehren.aktion":
      "Kies hoofdartikel, inhoud en bronnen, controleer het voorbeeld en keur pas goed na controle van de gevolgen.",
    "seitentutorial.zusammenfuehren.ergebnis":
      "Het voorbeeld is nog geen opgeslagen samenvoeging. Het bevestigde resultaat toont het effect.",
    "seitentutorial.zusammenfuehren.sonderfall":
      "Laad bij een verouderde versie opnieuw en controleer keuzes; Terug verandert geen goedkeuring.",
    "seitentutorial.spaces.aktion":
      "Open een zichtbare Space en artikelen. Bewerken vereist schrijfrecht of verantwoordelijkheid; aanmaken vereist beoordelingsrecht.",
    "seitentutorial.spaces.ergebnis":
      "Controleer leden, regels en zichtbaarheid. Alleen opslaan bevestigt wijzigingen; Space-rechten vervangen geen artikelrechten.",
    "seitentutorial.spaces.sonderfall":
      "Respecteer bij een ontbrekende Space of bewerkknop de huidige rechten; verwijderen toont gevolgen vóór bevestiging.",
    "seitentutorial.chat.aktion":
      "Kies een gesprek en controleer ontvangers en zichtbaarheid vóór verzenden. Kennisoverdracht maakt een apart concept.",
    "seitentutorial.chat.ergebnis":
      "Klara's berichtconcept, verzonden bericht en kennisconcept zijn aparte resultaten.",
    "seitentutorial.chat.sonderfall":
      "Controleer bij een verzendfout de getoonde status. Afgeschermde bijlagen en verwijzingen blijven afgeschermd.",
    "seitentutorial.gemeinsam.aktion":
      "Bewerk het gezamenlijke concept met schrijfrecht en sla je versie op. Controleer andere wijzigingen vóór afstemming.",
    "seitentutorial.gemeinsam.ergebnis":
      "Gezamenlijk concept, overnamevoorstel en goedgekeurd artikel zijn aparte statussen.",
    "seitentutorial.gemeinsam.sonderfall":
      "Vergelijk bij een conflict beide versies. Zonder schrijfrecht blijft de leesversie; Klara wijzigt geen rechten.",
    "seitentutorial.gesamtanweisungen.aktion":
      "Kies instructiedelen en controleer leesstatus en vergelijking. Aanmaken vereist vastlegrecht; beoordelen de beoordelaarsrol.",
    "seitentutorial.gesamtanweisungen.ergebnis":
      "De instructie behoudt verwijzingen naar delen en versies. Een leesstatus is geen nieuwe goedkeuring.",
    "seitentutorial.gesamtanweisungen.sonderfall":
      "Verduidelijk ontbrekende delen of rechten via de melding; ontoegankelijke inhoud wordt niet aangevuld.",
    "seitentutorial.besprechungen.aktion":
      "Open een toegankelijke bespreking; verbind dia's en transcript met vastlegrecht en controleer verwijzingen vóór feedback.",
    "seitentutorial.besprechungen.ergebnis":
      "Feedback, bronverwijzingen en overgenomen kennis zijn aparte resultaten.",
    "seitentutorial.besprechungen.sonderfall":
      "Volg meldingen voor open verwijzingen of afgeschermde dia's; deelname geeft niet automatisch bestandsrechten.",
    "seitentutorial.kalender.aktion":
      "Open je kalenderitem en controleer tijd, tijdzone, herkomst en gekoppelde opdracht vóór bewerken.",
    "seitentutorial.kalender.ergebnis":
      "Een kalenderitem, herinnering en uitgevoerde taak zijn verschillende resultaten.",
    "seitentutorial.kalender.sonderfall":
      "Respecteer beschermde of onopgeloste verwijzingen. Controleer bij herhaling de gevolgen vóór bevestiging.",
    "seitentutorial.verwaltung.aktion":
      "Gebruikers en rollen: zoek een account en controleer rol en toegang. AI: open aanbieders en modellen, toegang, functies of grenzen; controleer toewijzing en aan/uitstatus vóór opslaan. Beveiliging en bewijs, rapporten, systeem en demogegevens hebben eigen onderdelen.",
    "seitentutorial.verwaltung.ergebnis":
      "Accountrol, persoonlijke weergave en bedrijfsstandaard hebben verschillende effecten. De tutorial slaat niets op.",
    "seitentutorial.verwaltung.sonderfall":
      "Deze tutorial is zonder beheerrecht niet beschikbaar. Wacht bij fouten op het echte resultaat.",
    "seitentutorial.profil.aktion":
      "Controleer persoonlijke instellingen, taal en beveiliging. Wijzigingen gelden voor het getoonde eigen account.",
    "seitentutorial.profil.ergebnis":
      "Alleen de opslagbevestiging bewijst een wijziging. Een rolweergave geeft geen nieuwe accountrechten.",
    "seitentutorial.profil.sonderfall":
      "Gebruik voor beveiligingswijzigingen de eigen bevestigingsroute; Klara leest geen geheime velden voor.",
    "seitentutorial.import.aktion":
      "Kies de importbron en controleer toewijzing, rechten en voorbeeld vóór het starten.",
    "seitentutorial.import.ergebnis":
      "Een importuitvoering heeft een eigen resultaatweergave. Voorbeeld en geïmporteerde inhoud zijn verschillend.",
    "seitentutorial.import.sonderfall":
      "Controleer na een fout de uitvoeringsstatus vóór opnieuw starten. Beheerrecht en fase 2 blijven vereist.",
    "seitentutorial.importlauf.aktion":
      "Lees kenmerk, uitkomst en aantallen van deze importuitvoering; Terug opent het importonderdeel.",
    "seitentutorial.importlauf.ergebnis":
      "Beëindigd betekent niet automatisch volledig geïmporteerd. Controleer uitkomst en ontbrekende delen.",
    "seitentutorial.importlauf.sonderfall":
      "Niet gevonden is geen geslaagde uitvoering. Ga bij fouten terug om de importstatus te controleren.",
    "seitentutorial.analytics.aktion":
      "Lees kengetallen, categorieën en weekverloop met hun berekeningsstatus.",
    "seitentutorial.analytics.ergebnis":
      "Onbekend, onbewezen en berekend zijn verschillende uitspraken; een kengetal keurt geen artikelen goed.",
    "seitentutorial.analytics.sonderfall":
      "Houd bij interpretatie rekening met ontbrekende beoordelingstijden en demolabels.",
    "seitentutorial.lebenszyklus.aktion":
      "Kies een onderhoudszaak, controleer aanleiding, verantwoordelijke en termijn en werk met je beoordelaarsrol.",
    "seitentutorial.lebenszyklus.ergebnis":
      "Sjabloon, aangemaakte vervolgbeoordeling en bevestigde afronding zijn verschillende statussen.",
    "seitentutorial.lebenszyklus.sonderfall":
      "Laad opnieuw na een laadfout; een sjabloon voltooit geen open beoordeling.",
    "seitentutorial.risiko.aktion":
      "Open een zichtbaar kennishiaat of risico en controleer bewijsbehoefte, verantwoordelijke en afrondingsroute.",
    "seitentutorial.risiko.ergebnis":
      "Prioriteit, bijdrage en gesloten kennishiaat zijn verschillende resultaten; toegang geldt per zaak.",
    "seitentutorial.risiko.sonderfall":
      "Veronderstel geen deelname aan een ontbrekende zaak; getoonde beperkingen blijven gelden.",
    "seitentutorial.ausgang.aktion": "Controleer uitgaande tekst en bewijs vóór goedkeuring.",
    "seitentutorial.ausgang.ergebnis":
      "Beoordeeld voorbeeld en goedgekeurd resultaat blijven verschillend.",
    "seitentutorial.ausgang.sonderfall":
      "Goedkeuring vereist beoordelingsrecht. Verduidelijk eerst ontbrekend bewijs.",
    "seitentutorial.vorlagen.aktion":
      "Lees sjabloon en bereik. Bewerken of als standaard instellen vereist het getoonde beheer- of Spacerecht.",
    "seitentutorial.vorlagen.ergebnis":
      "Een sjabloonwijziging verandert bestaande artikelen niet achteraf; de effectweergave verklaart gebruik en bestaande inhoud.",
    "seitentutorial.vorlagen.sonderfall":
      "Controleer vóór buiten gebruik stellen of verplichtingen de gevolgen en reden; de tutorial stelt geen standaard in.",
    "seitentutorial.unternehmen.aktion":
      "Controleer bedrijfsprofiel of richtlijn, bereik en wijzigingsreden; lees gevolgen vóór opslaan of publiceren.",
    "seitentutorial.unternehmen.ergebnis":
      "Profielwijzigingen en gepubliceerde richtlijnversies hebben verschillend bereik en eigen geschiedenis.",
    "seitentutorial.unternehmen.sonderfall":
      "Een conceptweergave publiceert niets. Controleer fouten en effectmeldingen vóór opnieuw opslaan.",
    "seitentutorial.richtlinien.aktion":
      "Lees de geldende richtlijnversie en het bereik. Bevestig kennisname of toestemming bewust zelf.",
    "seitentutorial.richtlinien.ergebnis":
      "Gelezen, kennisgenomen en ingestemd zijn verschillende statussen.",
    "seitentutorial.richtlinien.sonderfall":
      "Volg de melding bij een ontbrekende richtlijn of fout; de tutorial bevestigt niets voor jou.",
    "seitentutorial.kommunikation.aktion":
      "Controleer gebeurtenis, kanaal en frequentie van je meldingen. Bedrijfsstandaarden wijzigen vereist beheerrecht.",
    "seitentutorial.kommunikation.ergebnis":
      "Eigen keuze en bedrijfsstandaard zijn verschillend; de effectweergave toont welke instelling geldt.",
    "seitentutorial.kommunikation.sonderfall":
      "Respecteer verplichte meldingen. Een mislukte opslag past het concept niet automatisch toe.",
    "seitentutorial.anbindung.aktion":
      "Controleer je koppeling, tijdzone en veldrichtingen. Synchroniseren en open beslissingen blijven bewuste acties.",
    "seitentutorial.anbindung.ergebnis":
      "Een lokale koppeling verwijderen wist geen externe afspraken. Voorstel, bevestigde beslissing en uitgevoerde synchronisatie blijven apart.",
    "seitentutorial.anbindung.sonderfall":
      "Controleer bij een conflict de getoonde veldkeuze; omzeil geen providerrechten.",
    "seitentutorial.qualitaet.aktion":
      "Vernieuw de status, filter kwaliteitstaken en open de oorspronkelijke zaak om te handelen.",
    "seitentutorial.qualitaet.ergebnis":
      "Totaal, overname en resultaat zijn apart; elke rij blijft beperkt tot huidige rechten.",
    "seitentutorial.qualitaet.sonderfall":
      "Verduidelijk eerst verouderde status of ontbrekende bronnen. Een lege lijst bewijst niet dat er geen taken zijn.",
    "seitentutorial.hilfe.aktion":
      "Zoek hulp of open een onderwerpintroductie. Vervolgroutes respecteren je huidige rol.",
    "seitentutorial.hilfe.ergebnis":
      "Uitleg en demonstratie zijn geen echt werk. Open bewust de echte pagina om toe te passen.",
    "seitentutorial.hilfe.sonderfall":
      "Vereenvoudig bij geen resultaten de zoekopdracht of stel een vraag.",
    "seitentutorial.mobile.aktion":
      "Kies tekst, interview of foto; controleer concept en wachtrij vóór verzenden.",
    "seitentutorial.mobile.ergebnis":
      "Lokale wachtrij, serverconcept en ingediende bijdrage zijn verschillende statussen.",
    "seitentutorial.mobile.sonderfall":
      "Respecteer offline- en accountmeldingen; hervat werk van anderen of zonder accountbinding niet als eigen werk.",
    "seitentutorial.output.aktion":
      "Kies uitvoertype en leesbare bronnen, controleer de tekst en gebruik dan de aangeboden uitvoer.",
    "seitentutorial.output.ergebnis":
      "Gegenereerd concept en gedownloade of afgedrukte uitvoer zijn apart. Bronrechten blijven gelden.",
    "seitentutorial.output.sonderfall":
      "Verduidelijk eerst ontbrekende bronnen of fouten; de tutorial start geen export.",
    "seitentutorial.graph.aktion":
      "Controleer relaties, richting en type in de kennisgraaf. Curatie is een aparte bevoegde handeling.",
    "seitentutorial.graph.ergebnis":
      "Getoonde verbindingen en bevestigde gecureerde relaties zijn verschillend.",
    "seitentutorial.graph.sonderfall":
      "Een ontbrekend knooppunt kan door rechten komen. De tutorial geeft geen extra toegang.",
    "seitentutorial.kapital.aktion":
      "Lees overzicht, volwassenheid en echte waarderingsgevallen. Controleer bereik en bewijs vóór waarde-invoer.",
    "seitentutorial.kapital.ergebnis":
      "Lees gemeten waarden, ontbrekend bewijs en schattingen apart; een tutorial creëert geen bedrijfswaarde.",
    "seitentutorial.kapital.sonderfall":
      "Behandel onbewezen of onbekende waarden niet als metingen. Rol- en fase-2-grenzen blijven gelden.",
  },
} satisfies Textmodul;
