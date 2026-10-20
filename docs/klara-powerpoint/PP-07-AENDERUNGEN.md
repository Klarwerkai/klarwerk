# PP-07 · Änderungen bewusst übernehmen und Dateifassungen speichern

Original `produkt:20261015:klara-powerpoint-aenderungen-fassungen`, Revision 2 bleibt offen.

## Fortsetzung des festen Vorschaukerns 61dad8ec

Die nachfolgend erhaltenen Abschnitte dokumentieren die früheren Lieferstufen. Der neue Nachfolger
verwendet Ns feste PP05-Stände `ae10cc6b` und `ccfb8759` über normale Zusammenführung. Die
bestehende AppShell-Korrektur von `fc7ff5cc` wird ausschließlich als unveränderte einzelne Datei
übernommen; keine weitere Shell-/Office-Hostimplementierung.

In derselben Artikel-Anhangfläche folgt nach der schreibfreien Datenvorschau nun **Übernahme
vorbereiten**. Erst diese zweite Vorschau liest die tatsächlichen Folien, Diagramme, Arbeitsmappen,
Prüf-/Belegfolien und Notizstellen. **Diese Vorschau übernehmen** speichert bewusst. Veränderte
Formulare und verworfene oder verspätete Antworten verwenden keine frühere Vorschau weiter.

Der neue Dateischreiber nutzt W06s ZIP-/Folien-/Notizleser und Textlaufersetzung. Eindeutig gebundene
Werte und abgeleitete PP02-Daten werden an vorhandenen Text-/Tabellenstellen aktualisiert. PP05-
Diagramme erhalten neue native Caches, Beschriftungen, Null einschließende Skalen und dieselbe
Änderung in der eingebetteten Arbeitsmappe. Manuell veränderte Kategorien, Zahlen oder Skalen
werden als konkrete Konflikte erhalten. Einheiten, Zeiträume und Währungen bleiben durch den
bestehenden PP05-Planer auf Vergleichbarkeit geprüft. Quellen-/Prüftexte erzeugt allein Ns Schreiber;
zusätzliche Herkunftsseiten werden bei Bedarf als Detailfolien angefügt. Unabhängige Formen,
Folien, Vorlagen und übrige ZIP-Teile bleiben erhalten.

Manuelle abweichende Werte, ungebundene gleichlautende Text-/Tabellenstellen, weitere lesbare
Dateibindungen und tatsächliche Notizabsätze werden ausdrücklich benannt. PP05-v1 hat keine
Notizbindung: solche Notizen werden erhalten und konkret zur Klärung geführt. Jeder weiche
Dateikonflikt muss einzeln bewusst als offen bestätigt werden. Widersprüchliche Datenherkunft
sowie nicht sicher aktualisierbare Prüfstatus-/Belegtexte sperren die Übernahme; eine Bestätigung
überspringt diese Sperre nicht. Es gibt keine globale Suche über alle Decks oder frei formulierten
semantischen Aussagen.

Alle neuen Schreibwege verlangen `ko.create` und benutzen dieselbe bestehende Office-Rechte-,
Editor-, Artikelversions- und Anhangauswahlprüfung sowie denselben Serialisierungsrahmen. Die
Vorschau bindet Artikel-/Dateifassung, erwartete Datenstände, vollständige lesbare Herkunft,
Quellmetadaten und die tatsächlichen Wirkungen. Vor dem Speichern wird neu geplant und geprüft.
W10 übernimmt die Datei mit erwarteter Artikelversion. Daten folgen in Abhängigkeitsreihenfolge
mit den bestehenden einzelnen `DatenpunktAblage.ersetzen`-CAS-Schritten. Datei, mehrere Datenpunkte
und zwei Exportobjekte sind **keine gemeinsame Transaktion**. Tatsächliche Teilwirkungen liefern
`PP07_TEILWIRKUNG` bzw. `PP07_FASSUNGEN_TEILWIRKUNG` mit dem realen gespeicherten Teilstand.
Wiederholte Übernahmen desselben eingebetteten Belegs schreiben keine zweite Dateifassung.

**Fassungen und Rücknahme** zeigt den realen Stand und die rückzunehmenden Werte. Eine Rücknahme
prüft die dokumentierte ursprüngliche Datei aus der vorhandenen W10-Historie und schützt später
geänderte oder geprüfte Datenstände. Sie speichert neue Datei-/Datenfassungen und erhält alle
Historien. Neue Klärungsprüfungen verhindern, dass eine alte fachliche Freigabe durch den wieder
gleichen Inhaltsfingerabdruck aktiv wird. Der Übernahmebeleg liegt im bestehenden PPTX-Transport;
keine neue Datenbank, Deckablage oder Berechnungs-/Validierungsengine.

Zwei tatsächliche private PPTX-Objekte entstehen aus genau derselben geprüften Daten-/Quellbasis.
**Kurz** zeigt Hauptfolien und blendet Einzel-/Belegfolien aus; **Ausführlich** zeigt alle zugeordneten
Folien. Unabhängige Originalfolien werden nicht umgeschaltet. Ausgeblendete Details verbleiben im
Dokument; dies ist eine Vortragstiefe, keine Vertraulichkeitsentfernung. Beide gespeicherten Dateien
werden erneut geöffnet. Downloadlinks erscheinen nur für bestätigte Dateien, auch bei einem
Fehler des zweiten Speicherns. Die Quellenbasis ist eine Momentaufnahme, keine Live-Verbindung.

Ns vorhandenes `snapshotLesbar` bleibt das zusätzliche UND am normalen Objekttor. Nur PP07-
Varianten-/Übernahmezweige sind ergänzt: tatsächliche gespeicherte Datenfassungen, Fingerabdrücke,
Bindungen und heutige transitive Herkunftsrechte müssen passen. Private Objekt-/Zielrechte gelten
zusätzlich. Dasselbe Tor schützt die öffentliche PP02-Datei-/Datenausgabe. Interne Planung verwendet
weiter den vorhandenen lesenden Kontext und muss neue Bindungen erst nach dem Dateischritt speichern.

Neue fokussierte Belege liegen in `pp07-uebernahme-ruecknahme.test.ts`, `pp07-fassungen-download.test.ts`,
`pp07-konflikte-teilwirkung.test.ts`, `pp07-snapshot-abweisung.test.ts` und der tatsächlich montierten
`pp07-uebernahme-flaeche.test.tsx`. `pp07-browser.test.ts` ist genau ein vorbereiteter neuer H04-Fall;
Ausführung nur nach frischer zentraler Ressourcenzuteilung durch den unveränderten Browserdeckel.
Tatsächliche Ausführungsstände, Fehlerkorrekturen, Quellbindungen und Grenzen stehen in der
separaten Nachfolgerübergabe. Frühere positive Belege werden nicht als neue Läufe ausgegeben.

H01 native PowerPoint-App, H02 PowerPoint-Web, H03 eigener Importpfad, H05 Vortrag/Besprechung,
Screenreader, PostgreSQL-Dauerhaftigkeit dieser Mehrfachschritte, unabhängiger Ben und zentrale
Integration/Version/Push/Deploy/Live-Abnahme sind nicht durch InMemory-/Komponententests belegt.
Das bisherige eng begrenzte H04/H06-Ergebnis ist keine vollständige Annahme der sieben
Originalkriterien. Die Führung übernimmt Integration und Veröffentlichungen.

## Erhaltene Liefergeschichte


Original `produkt:20261015:klara-powerpoint-aenderungen-fassungen`, Revision 2.
Implementierter Teilkern: schreibfreie Wirkungsvorschau im bestehenden H04-Anhangweg.
Der vollständige Originalauftrag bleibt offen. Keine Übernahme, Installation oder Veröffentlichung
dieses Teilkerns ist mit diesem Dokument behauptet.

Ausgangsbasis war `3ba2c457d4b03b1581d789fe816417678f35e68e` (.1001). Nach der konkreten
Führungsbindung vom 20.10.2026 wurde der eigene Branch regulär auf
`3b03ad5ec6b27c760361f43794fee9792fc5d8f0` (.1002) vorgezogen. PP-02/03 sind dort enthalten.
Die Führung bestätigte nach tatsächlichem Arbeitsbeginn, dass noch kein fester PP-05-Nachfolger
von N vorliegt. Es gibt deshalb weder eine zweite Deckablage noch einen angenommenen PP-05-Port.

## Nutzbarer Teilweg

Im vorhandenen PowerPoint-Anhang unter „Daten auf den Folien“:

1. „Änderungen vorschauen“ öffnen und eine erfasste Zahl/Aussage wählen.
2. Neuen Wert und Grund angeben; direkt übernommene Werte optional an der aktuellen Quellfassung
   nachlesen. Berechnete Werte werden mit den aktuellen Eingaben nachgerechnet.
3. „Wirkung ansehen“ zeigt ursprüngliche und vorgeschlagene Datenfassungen, nachgerechnete
   Nachfolger, ihre PP-03-Kontrollen und betroffene lesbare Bindungen.
4. Eine manuelle Abweichung oder ein fehlendes Element bleibt ein konkreter Konflikt. Steht der
   neue Wert bereits im Ziel, wird keine Ersetzung vorgeschlagen. Unabhängige manuelle Inhalte
   werden nicht bearbeitet.
5. Verwerfen oder Escape schließt die Vorschau und gibt den Fokus zurück. Formularänderungen
   verwerfen das frühere Ergebnis; eine spät eintreffende Antwort öffnet es nicht erneut.

Vorschau und Kontrollen sind ausdrücklich hypothetisch. Datenpunkte, Dateien, Artikel, Prüfvermerke,
Bindungen und Historien werden dabei nicht gespeichert. Es gibt keinen wirkungslosen Übernehmen-
Knopf. Die bestehende Korrekturfläche bleibt der vorhandene einzelne Korrekturweg.

## Anschluss und Datenvertrag

`services/app/src/praesentation-aenderungen.ts` benutzt `korrigiere`, `fingerabdruck`, `sicht`,
`vollLesbar` und `elementBefund` aus PP-02 sowie `kontrollAnschluss` aus PP-03. Es entstehen weder
neue Berechnungs-/Validierungsregeln noch neue Tabellen. Die Vorschau projiziert die Änderungen
in Abhängigkeitsreihenfolge. Auch ein gleichbleibendes Ergebnis erhält eine neue vorgeschlagene
Fassung, wenn eine verwendete Eingabe- oder Quellfassung wechselt. Unveränderte Punkte behalten
ihre Datenfassung und gültigen Prüfbelege. Historische Prüfungen bleiben erhalten; PP-02/03
entscheiden über ihre Gültigkeit für die neue Datenfassung.

`POST /api/kos/:id/office/:anhangId/aenderungsvorschau` ergänzt ausschließlich die vorhandenen
PP-02-Routen. Erforderlich sind `ko.read`, Sichtbarkeit des Artikels/Anhangs sowie vollständiges
Leserecht an jeder verwendeten Herkunft einschließlich Historie. Unsichtbare Datenpunkte und
Zielpräsentationen erscheinen nicht in Ergebnissen, Kennungen, Basis oder Konflikten. Eine
ausdrücklich verlangte unlesbare Kennung liefert 404. Das ist ein lesender Vorschauweg, keine
Schreibberechtigung durch `ko.read`.

Der Rumpf enthält `artikelFassung`, `dateiFassung` und 1–20 `aenderungen`, jeweils mit
`datenpunktId`, erwarteter `fassung` und vorhandener PP-02-`korrektur` einschließlich Grund.
Veraltete Ziel-/Datenfassungen ergeben 409. Der Rumpf ist auf 64 KiB begrenzt, der sichtbare
Suchraum auf 200 Datenpunkte einschließlich ihrer Eingaben; die PP-02-Herkunftsgrenzen bleiben
erhalten. Der Suchraum umfasst Datenpunkte dieses Heimatartikels und an den aktuellen Anhang
gebundene Datenpunkte, ergänzt um ihre lesbaren Eingaben. Er ist **kein globaler Nachfolgerindex**.

Die Antwort enthält `gespeichert:false`, Basisstände, alte/neue PP-02/03-Sichten, Bindungswirkungen,
Konflikte und Grenzen. `abdruck` bindet Datenstände, Anweisungen, projizierte Inhalte und gelesene
Zieldateifassungen. Er ist eine Vergleichskennung und kein Übernahmetoken. Quellen, Fundstellen,
Rechenweg mit verwendeten Eingabefassungen, Rundung, Annahmen, Prüfungen und Korrekturgeschichte
bleiben in den vorhandenen Sichten. Serverbegründungen sind wie bei PP-02/03 deutsch; die neuen
Bedienungstexte stehen in de/en/nl im eigenen Textmodul.

## Offener PP-05-Anschluss

Die exportierte `planeAenderungen` liefert ausschließlich einen schreibfreien Plan aus alten und
projizierten **vorhandenen** Datenpunkten. Die spätere feste PP-05-Integration muss:

- dieselben Datenpunkt-/Quellfassungen an Haupt-, Detail- und Zielgruppenfolien verwenden;
- Texte, Tabellen, Diagramme, abgeleitete Aussagen und Notizen vollständig abbilden oder je
  tatsächlichem Vorkommen einen Konflikt nennen;
- vor einer Wirkung Rechte, Artikel-/Dateifassungen und alle Datenpunktstände erneut prüfen;
- die bestehenden Office-Vorschau-/Speicher-/Rücknahmewege verwenden und eine teilweise
  Übernahme ausschließen oder als konkreten Reparaturzustand kenntlich machen;
- Dateien und Datenpunkte zusammen konsistent übernehmen. Die heutige einzelne
  `DatenpunktAblage.ersetzen` ist kein atomarer Mehrfachschreibvertrag; eine Schleife über sie wäre
  kein Abschluss dieser Anforderung;
- bei manuellen Änderungen Layout und unabhängige Inhalte erhalten, alte Freigaben aufheben
  sowie Exportbelege und Rechte für die tatsächliche Quellfassung prüfen.

Diese Punkte sind offene Integration, keine zugesagte vorhandene Fähigkeit. Es gibt noch keine
kurze/lange Deckfassung aus diesem PP-07-Teilkern. Diagramm-/Notizbindung und semantische
Abhängigkeiten frei formulierter Aussagen fehlen im heutigen PP-02-Dateivertrag. Die Produktfläche
nennt diese Grenzen ausdrücklich.

## Prüfumfang und Hostgrenzen

Neue gezielte Prüfungen: `pp07-aenderungsvorschau.test.ts` (echte Routen, Wissensobjekt-/Objekt-
und Datenpunktdienste im Speicher, echte fiktive PPTX-Bytes) sowie
`pp07-aenderungsvorschau-flaeche.test.tsx` (montierter Produktbaustein über dieselben Routen).
Die zwei bestehenden PP-03-Anschlussdateien sichern den unmittelbar betroffenen Herkunfts-,
Korrektur-, Prüfstatus- und Fokusweg. Die tatsächlichen Ausführungen, ein früherer Fixture-Rotfall
und die jeweiligen Kandidatenbindungen stehen im externen Übergabepaket.

| Weg | Stand dieses Teilkerns |
| --- | --- |
| H04 Anhang am Artikel | API-/Objekt- und montierte Bausteinprüfung; kein Browserlauf |
| H03 importierte Datei | nur nach Ablage als Anhang an H04 erreichbar; kein eigener Importlauf |
| H01 native PowerPoint-App | PP-07 nicht angeschlossen und nicht geprüft |
| H02 PowerPoint-Web | PP-07 nicht angeschlossen und nicht geprüft |
| H05 Besprechung/Vortrag | kein Anschluss; PP-08 bleibt eigener Auftrag |
| H06 Export | kein PP-07-Exportlauf, keine Live-Synchronisierung |

Die alten PP-02/03-Host-/Browserbelege bleiben unverändert mit ihrer ursprünglichen Bindung
erhalten. Sie sind keine neue PP-07-Hostabnahme. UI-06/08, echte Tastatur-/Fenster-/Screenreader-
Bedienung, echte persistente Gesamtübernahme, unabhängiger Ben, Integration/Version/Push/Deploy,
Provider-/Livebeleg und zentraler Originalabschluss sind weiterhin offen und Sache der Führung.

## Späterer fester PP-05-Anschluss am 20.10.2026

Nach dem getrennt erhaltenen, regulär gebauten Vorschaukern `33b9545840ed2b772a38f5fffe8f537eb0d6e8b4`
hat die Führung den tatsächlichen PP-05-Port von N an
`fbc1ef39dff20253dacc4c03b86cf4b58bbed9c2` gebunden. Er wurde regulär ohne Konflikte in den
eigenen Branch vereinigt (`1814364a4f1a1ab7eeff61717109c2ff70166b25`). Die früheren Aussagen
zum noch fehlenden festen Port beschreiben den Stand vor dieser konkreten Zustellung. Eine
unabhängige Gesamtannahme von PP-05 ist auch damit nicht behauptet.

`praesentation-fassungen.ts` verwendet die tatsächlichen Typen `GebundenerDeckVertrag` und
`DeckVertrag` aus Ns `office-datenfolien.ts`. `verknuepfeDeckFassungen` nimmt ausschließlich einen
echten serverseitigen PP-05-Übernahmerücklauf mit dessen gelesenen Dateidaten entgegen; ein
ungeprüftes Importmanifest oder ein HTTP-Rumpf ist kein solcher Rücklauf. Der Adapter erzeugt
kurze/ausführliche **Folienauswahlen**, die auf genau eine gemeinsame Daten-/Quellfassungsbasis
verweisen. Er prüft Dateibindung, tatsächliche Folien, widersprüchliche Datenfassungen, lesbare
historische Herkunft sowie die tatsächlich gespeicherten PP-02-Bindungen. Fehlende Teilbindungen
und manuell abweichende Elemente werden als Konflikte geführt. Eine PP-07-Änderungsprojektion
erreicht über Ns Vertrag auch Diagramm- und Belegfolien.

Dieser Port ist noch kein eigener Produktendpunkt, keine gespeicherte kurze/lange Datei und kein
Deckaktualisierungsschreiber. Die gemeinsame Übernahme und der Anschluss an die Produktfläche
bleiben offen. Diagrammbytes und eingebettete Arbeitsmappen werden durch ihn nicht neu geprüft
oder verändert. Der erste PP-05-Vertrag hat keine Notizbindungen. `belegOffen` und
`bindungenOffen` des Elternrücklaufs bleiben eigene offene Lieferbedingungen.

`pp07-pp05-deckanschluss.test.ts` prüft genau diese Zusammensetzung: echte PP-05-Vorschau und
Übernahme über die Routen, gespeicherte PPTX-Bytes, gemeinsame Fassungsbasis, Folienauswahlen,
Diagramm-/Belegwirkungen sowie negative Datei-/Fassungs-/Rechtefälle. Die manuelle Abweichung
ist ein gezielter Objektgegenfall am bereits gelesenen Foliensatz, keine Host- oder Dateiänderungs-
abnahme. Die übrigen ursprünglichen Abnahmegrenzen bleiben erhalten.
