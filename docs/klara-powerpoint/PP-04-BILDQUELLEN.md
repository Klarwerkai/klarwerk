# PP-04 · Vorhandene Bildbefunde im Datenpunktweg

Original `produkt:20261015:klara-powerpoint-ocr-kontext`, Revision 2. Die sieben Originalkriterien und beide History-Einträge bleiben unverändert. Produktpaket vom 12.10.2026 (Abschnitte 3–7 und PP-04), Produktleitlinien vom 14.10.2026 (UI-01–08). Isolierter Teilkern auf verbindlicher Basis `3b03ad5ec6b27c760361f43794fee9792fc5d8f0` / .1002; gestartet auf .1001, anschließend regulär per Fast-forward gebunden. Keine eigene Veröffentlichung oder Originalabnahme.

## Verhalten

Am vorhandenen PowerPoint-Anhang im Artikel wird der automatische Office-Bildbefund beim Erfassen einer Zahl oder Aussage wiederverwendet. Die Zuordnung verlangt aktuelle Anhang-/Objektkennung, Folienposition, Bildposition und Bild-SHA. Eine gerenderte Folienansicht ersetzt kein eingebettetes Element. Der kurzlebige React-Kontext enthält die vorhandenen Ergebnisreferenzen und erzeugt keinen eigenen OCR-Lauf oder dauerhaften Fachbestand. Er gehört zum geöffneten Artikel und Konto; Konto-/Artikelwechsel verwerfen ihn. Das Formular wird bei neuer Dateifassung verworfen.

Solange die Automatik läuft, startet das Formular keinen parallelen Leseauftrag. Fehlt ein lesbarer Befund, bleibt der vorhandene ausdrückliche Leseweg verfügbar. Er verwendet ebenso den bestätigten E02-Korrekturstand. Ein ausdrücklicher neuer Befund hat Vorrang vor einem fehlgeschlagenen automatischen Befund.

Die bestehenden C-Flächen für Fundstelle am Original, Textberichtigung, Rücknahme, Bildtabellen und gezielte Bereichsfrage bleiben erhalten. Ihre Klara-Frage verwendet weiterhin den bereits gebauten korrigierten Bildkontext. PP-04 führt keinen zweiten Bild-/Tabelleneditor oder Frageweg ein. Setup > Klara steuert weiterhin die bestehende Automatik.

## Daten und Rechte

Der vorhandene POST `/api/kos/:id/datenpunkte` nimmt optional `ocr.wiederverwendung` mit `rohText` und erwartetem `korrekturAm` (ISO-Stand oder null) an. Der eigene Adapter `praesentation-bildquellen.ts` liest ausschließlich den bestehenden E02-Dienst des angemeldeten Kontos, gebunden an `office:<anhangId>` und die Bild-SHA. Ein inzwischen geänderter oder zurückgesetzter Stand und ein abweichender Text werden vor dem Speichern abgewiesen. Übernahme-Metadaten aus dem Anfragekörper werden nicht übernommen. Alte PP-02-Aufträge ohne das optionale Feld behalten ihren Vertrag.

PP-02 prüft weiterhin das tatsächliche Bild am Folienelement und bindet Artikel-/Dateifassung und Fundstelle. Die Fundstelle enthält den verwendeten Bildtext sowie optional `uebernahme`: ursprünglicher Rohtext und serverbestätigter Korrektursnapshot (Quelle, Text, Zeitpunkt). Der Detailbereich zeigt beides. Es entsteht keine neue Tabelle; bestehende Datenpunktablage, Versionierung, Rechte und Herkunftsprüfung gelten. `ko.create` und Artikelsichtbarkeit gelten vor dem E02-Abruf. Es gibt keine fremde Kontokennung im Drahtvertrag.

Der Snapshot ist der ausdrücklich übernommene Stand. Spätere persönliche E02-Berichtigungen ändern einen gespeicherten Datenpunkt nicht heimlich; sie müssen erneut übernommen werden. Eine solche automatische Aktualisierung gehört nicht zu dieser Lieferung. Die vorhandene Datenpunktkorrektur erzeugt weiterhin eine neue Datenfassung und überholt die alten Prüfungen. Die Fundstelle ist Teil des bestehenden Prüffingerabdrucks. OCR, Berichtigung und maschinelle Teiltests erzeugen keine fachliche Validierung. Die sechs Prüfdimensionen und Freigaberechte von PP-02/03 bleiben maßgeblich.

## Nachweise und offene Abnahme

Gerichtete neue Server- und montierte Flächenproben stehen in `pp04-bildquellen.test.ts` und `pp04-bildquellen-flaeche.test.tsx`; betroffene PP-02-Herkunfts-/Office-Bildimportfälle bleiben erhalten. Der neue echte Web-Dateifall steht in `tests-smoke/pp04-bildquellen-browser.spec.ts` (im isolierten Zustand-Projekt); tatsächliche Ausführung und Kandidatenbindung ausschließlich im Übergabepaket. Seine Registrierung und Sammlung sind kein Bestehensnachweis. Der alte PP-02-Browserfall wartet nun auf den automatisch verfügbaren Text, statt einen zweiten Leseauftrag zu verlangen.

Das vollständige Paket mit echten Protokollen, Negativbefunden, Dateienmanifest und genauer Commit-/Tree-Bindung liegt in der Projektablage unter `outputs/KLARA-CHAT-AUFTRAEGE-JKLMNOPQ-20261020/M/ARBEIT/UEBERGABE-FUEHRUNGSCHAT.json`.

Offen bleiben: eigenständiger Import ohne Artikelanhang; neue native PowerPoint-/PowerPoint-Web-Hostläufe und deren tatsächliche Auswahlübergabe; aktuelle kombinierte Modellantwort; PG-Neustart-/Gerätenachweis des zusätzlichen Snapshots; Exportbeleg; echte Screenreader-/Host-/Audio-/Tablet-Abnahme. C bleibt Owner der OCR-Originale, 59/67 bleiben Owner von PP-02/03. Der gebaute Dateiweg ersetzt diese getrennten Nachweise nicht. Unabhängiger Ben, Integration, reguläre Veröffentlichung, Liveprüfung, Providerabschluss und zentraler B1-/Originalabschluss gehören zur bestehenden Führung.
