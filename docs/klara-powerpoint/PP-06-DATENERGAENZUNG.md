# PP-06 · Datenlücken ergänzen

Original `produkt:20261015:klara-powerpoint-daten-ergaenzen`, Revision 1.
Feste Integrationsbasis: `3b03ad5ec6b27c760361f43794fee9792fc5d8f0` (.1002),
regulär auf der ursprünglich zugewiesenen .1001 fortgeführt. Die Basis ist kein
Lieferbeleg für diese Änderung. Vollvertrag, History und sämtliche sieben
Originalkriterien bleiben im unveränderten `O/VERTRAEGE-STARTBESTAND.json`
des Auftragspakets vom 20.10.2026 erhalten.

## Nutzerweg und Grenzen

Am PowerPoint-Anhang eines Artikels: Folie → Textfeld → „Vergleichswert
ergänzen“. Nutzer benennen Zeitraum, Einheit/Währung und Bezugsgröße
(einschließlich Nenner, soweit nötig). Die Vorschau durchsucht die bereits
erfassten PP-02-Datenpunkte dieses Artikels und bewusst ausgewählter,
zugänglicher Quellartikel. API: höchstens zehn zusätzliche Artikel und
200 lesbare Datenpunkte; die Oberfläche wählt einen zusätzlichen Artikel.
Freier Quelltext wird hier nicht automatisch in Fachwerte umgedeutet.

Fehlende Pflichtangaben werden als konkrete Lücke gezeigt. Zeitraum,
Einheit, Währung und Bezugsgröße müssen übereinstimmen; nur Leerraum/NFC
werden normalisiert. Keine vermutete Gleichsetzung von Zeiträumen,
Definitionen, Nennern oder Skalen, keine Währungsumrechnung. Ungeeignete
lesbare Kandidaten nennen ihre Gründe; unlesbare Quellen fehlen ohne
Existenzauskunft. Ohne passenden Wert bleibt die Lücke offen.

Eine Prognose ist für eine beobachtete Vergleichszahl ungeeignet. Nur die
bewusste Wahl „Prognose mit Annahmen“ erlaubt eine vorhandene Prognose mit
ausdrücklichen Annahmen und Modellbezug. Auch prognostische Eingaben einer
Berechnung werden erkannt. Die Ergänzung erzeugt keine neuen Zahlen oder
Prognosen; der bestehende PP-02-Erfassen-/Rechenweg bleibt zuständig.

Vor der Übernahme stehen alter Text und konkreter neuer Text samt
Erfassungsart und PP-03-Prüfstatus sichtbar. „Herkunft und Prüfungen öffnen“
führt in denselben schließbaren Herkunftsinspektor. Quelle, Fundstelle,
Quellfassung, Rechenweg, Eingabefassungen, Rundung, Annahmen, Kontrollen und
Korrekturen kommen unverändert aus PP-02/03. Die sechs Prüfdimensionen bleiben
getrennt; Vergleichbarkeit ist keine fachliche Freigabe. Offene Prüfungen
werden nicht als bestanden markiert. Setup > Klara wird weiterverwendet.

„Übernehmen“ ersetzt das bewusst ausgewählte Textfeld über den vorhandenen
Office-Nachbearbeitungs-/Fassungsweg. Er erhält Layout, Master und unabhängige
Inhalte und öffnet die gespeicherte Datei erneut. Unterstützt sind dessen
eindeutige einzelne Textläufe; über mehrere Formatierungen verteilte oder
mehrdeutige Stellen, Diagramme, Bilder und Tabellenänderungen bleiben offen.
Die Dateiprüfung bestätigt keine Darstellung in Microsoft PowerPoint.

Nach bestätigtem Wiederöffnen bindet PP-02 **denselben** Datenpunkt an das
Zielelement. Kein paralleler Fachbestand und keine kopierte Validierung.
Die Rücknahme verwendet den bestehenden Office-Verlauf. Eine alte Bindung
bleibt als Herkunft erhalten und zeigt danach ihre tatsächliche Abweichung.

## Schnittstellen und Rechte

- `POST /api/kos/:id/office/:anhangId/ergaenzung/vorschau`: PP-02-Umgebung
  mit `ko.read`, `darfSehen` und vollständig lesbarer Herkunftskette.
- `POST …/ergaenzung/uebernehmen`: bestehendes `ko.create`-/Office-Schreibtor,
  keine Übernahme bei laufender Editor-Sitzung oder bloßem Vorschlagsrecht.
  Der vorhandene Anhangstakt und KO-Fassungs-CAS gelten weiter.
- Die Übernahme berechnet Vorschau und Rechte erneut. Die Kennung bindet
  Zielartikel-/Dateifassung, Auswahl, Suchrahmen und Datenpunkt-Speicherstand.
  Veraltete oder unpassende Vorschau: 409 ohne Dateischreiben.
- Zusätzlich konservativer Schutz vor einem breiteren Leserkreis am Ziel:
  Quellen-Spaces, Schutzstufen, Quellleser und Autor-Ausnahmen der ganzen
  Herkunftskette müssen für den Zielartikel passen. Keine Rollenänderung.
- Dateiübernahme und Datenpunktbindung sind zwei bestehende Speicherschritte.
  Scheitert die zweite Wirkung, wird die bereits gespeicherte Datei samt
  Rücknahme ausdrücklich als Teilwirkung gemeldet. Andere Fehler nach einer
  Wirkung enthalten die tatsächlichen Wirkungen. Kein Erfolg bei Teilfehlern.

Dateiabruf, Office-Verlauf und Weitergabe bleiben die vorhandenen Wege;
es wird kein Exportdienst hinzugefügt. Eine exportierte Datei ist eine
Momentaufnahme, nicht live synchronisiert und keine Klarwerk-Zugangsfreigabe.

### O-1 · Quellenentzug nach der Übernahme

Das gemeinsame N-Downloadtor `praesentation-snapshot-recht.ts` wird als
zusätzliche UND-Bedingung am normalen Anhangs-/Privattor verwendet, frisch
bei Daten-URL, `/raw` und `/traeger`. Fester Ursprung: N
`8fcb7acac2d74b1d398086ab3f3845677baf04e2`; der feste öffentliche P-Port
`9fddf9120c9fbceaa581e622452884fa523de8e8` liefert die erhaltenen PP07-Zweige.
Der hier lokal dekodierte Minimaltyp ersetzt allein dessen Typimport des
PP05-Schreibers. Keine fremde Fachimplementierung und kein beweglicher
Arbeitsstand werden übernommen. Das PP06-Delta ist separat lieferbar.

Der bestehende W10-Schreiber fügt der geänderten PPTX einen internen
`ppt/klara/pp06-<token>.json`-Beleg hinzu. Er nennt tatsächlichen Datenpunkt,
Datenfassung, Inhaltsfingerabdruck und Zielelement. Rechte stammen weiter
aus PP02: heutige Heimat-/Quellrechte, echte historische Eingaben und ihre
Fassungen. Ein Manifest allein reicht nicht: Die gespeicherte Bindung muss
die interne PP06-Kennung, Zielartikel/Anhang, tatsächliche Objektkennung,
Datei-SHA und den wirklich wieder geöffneten Folienwert bestätigen. Frühere
unveränderte Belege nutzen die bestehende N-Dateikette. Fehlende Daten,
Bindung, Eingaben oder Rechte sperren den Abruf mit der normalen 404-Antwort.
Ein berechtigter Gegenleser und eine spätere Wiederfreigabe bleiben wirksam.

Auch W10-Änderungsübersichten und private Folgeobjekte enthalten Quellwerte.
Ihr serverintern gespeicherter Lifecycle-Anker bindet eigene tatsächliche
Bytes per SHA an die erzeugte PPTX. Derselbe Guard prüft diesen Dateianker;
das normale Eigentümertor bleibt zusätzlich nötig. Das Feld wird beim
öffentlichen Upload nie übernommen. Ein Konfliktentwurf ohne abgeschlossene
PP06-Dateibindung bleibt gesperrt. Eine bereits gespeicherte Datei mit
gescheiterter Bindung bleibt als echte Teilwirkung im Bericht und wird
ebenfalls nicht ausgeliefert. Es gibt keinen globalen Kopienbestand und
keinen Zugriff auf bereits lokal heruntergeladene Dateien.

Der neue gezielte API-/Dateigegenfall ist
`pp06-snapshot-download.test.ts`: echte Anwendung und Anmeldung, fiktive
In-Memory-Ablagen, echter Ergänzungs-/Speicher-/Wiederöffnungsweg. Abgedeckt
sind nachträglicher Quellenentzug an allen drei Abrufen bei weiter lesbarem
Ziel, Gegenleser/Wiederfreigabe, historische Eingaben, fehlende Bindungen,
kopierte Manifeste, private Folgeobjekte und normale Uploads. Dieser enge
Nachtrag wiederholt keine alten 19/46-Fälle und keinen Browserlauf.

## Bestand und Integrationshinweise

`praesentation-daten-umgebung.ts` ist ausschließlich die unverändert
extrahierte PP-02-Anfrageumgebung; Herkunft, PP-03 und PP-06 verwenden sie
gemeinsam. Eigene Fachlogik: `praesentation-ergaenzung.ts`. Eigene Oberfläche,
API und Sprachtexte: `DatenErgaenzung.tsx`, `praesentationErgaenzung.ts`,
`texte/ergaenzung.ts`. Keine neue OCR-, Assistenz-, Quellen-, Anmelde-,
Office- oder Validierungsverwaltung, keine neue Datenbanktabelle.

Die Führung komponiert die kleinen gemeinsamen Router-/build-app-/FolienDaten-
Hunks mit M/N/P/Q. Insbesondere M-Änderungen am aktuellen kontogebundenen
OCR-Korrekturstand erhalten; keine vollständige Altbasisdatei darüberkopieren.
59/67 behalten PP-02/03, N PP-05; keine fremde Lieferung wird übernommen oder
als abgeschlossen erklärt.

## Prüfstand und offene Originalabnahme

`pp06-ergaenzung.test.ts` prüft echte Routen, fiktive KO-Fassungen,
Objektspeicher, gespeicherte PPTX und bestehenden Office-Weg. Anmeldung ist
in dieser Testgruppe ersetzt; sie belegt keinen echten Host oder PostgreSQL.
`pp06-ergaenzung-browser.test.ts` enthält genau einen neuen H04-Browserweg
gegen die gebaute Anwendung und echte lokale Dienste; Ausführung und Fassung
werden separat im eigenen ARBEIT-Bericht gebunden. Keine Testdatei allein
gilt als Ausführungsbeleg. Eigenprüfung ist nicht unabhängig.

Gezielte Anschlussfälle: PP-02-Datenherkunft, PP-03-Anschluss und Office-Routen.
Die Office-Altfehler O4/O10 reproduzieren sich gegen die unveränderte
.1002-Office-Route. Keine Lockerung der Erwartungen oder Änderung dieser
Altprüfungen. Die neuen Prüfberichte erhalten die negativen Vorläufe.

Native PowerPoint-App, PowerPoint-Web und importierte Präsentation außerhalb
des Artikel-Anhangs sind getrennt offen. Ebenso reale Screenreader-, native
Tastatur-/Fenster-, Audio- und Exportabnahme. Schmale/große Browseransichten
ersetzen diese Nachweise nicht. Unabhängiger ursprünglicher Ben,
Kandidatenintegration mit passender Elternfähigkeit, regulärer Providerabschluss,
Installation/Liveprüfung und zentraler B1-Abschluss liegen bei der Führung.
Der Originalauftrag ist mit diesem Teilstand nicht abgeschlossen.
