# OCR C · Gemeinsamer direkter Kandidat vom 20.10.2026

Die fünf Originalaufträge gelten unverändert: OCR-E06 Bereichsfrage, OCR-E05 Widersprüche,
OCR-E04 mehrseitige Scans und OCR-E03 Tabellen jeweils Revision 2, OCR-04 Hostprüfung Revision 1.
Die vollständigen 45 Kriterien und ihre konkreten Belege stehen im Übergabepaket von Chat C unter
`outputs/KLARA-CHAT-AUFTRAEGE-ABCD-20261020/C/ARBEIT/KRITERIENZUORDNUNG.json` in der Projektablage.
Dies ist ein isolierter Integrationskandidat; Veröffentlichung und Liveprüfung gehören der Führung.

## Erhaltener Bestand

Basis ist `a5023125466cc36afd10e434c02b79524639c84a`, mit der tatsächlich gelieferten E01/E02-Basis
`01378570c4d3fa2f206039158eaa0235f15bdc54` (1.0.0-beta.1.991) als Vorfahr. Die bestehenden
Speicher-, Rechte-, Bildfassungs- und Modellwege bleiben maßgeblich. Die vier erhaltenen Deltas
wurden gezielt übernommen; ihre alten Releaseversionsdateien und fremden Manifeststände nicht.

| Erweiterung | Erhaltener Originalkandidat | Integration |
| --- | --- | --- |
| E03 | `9924b24e2c917c89b7b5e89e0cd93121af58f295` | Raster, unsichere Zellen, Bearbeitung, HTML/TSV-Kopie, Zellfundstelle und E02-Speicherung |
| E04 | `d217399fab420b9446bda8322eaa336c36af301c` | alle unterstützten PDF-Eingänge, Seitenstatus, native/OCR-Deduplizierung, Kontoabbruch |
| E05 | `caa52cfae82d995cd1d8b83c2d09f7be1b49ee15` | Sachverhalt, Zeitraum, Einheit, Vorzeichen und Unsicherheit; Neubewertung nach E02 |
| E06 | `362a442511e2a16fbe7afc6246d2242b0b0e635d` | Ganzbild/Region, Auswahlwechsel, Nachfrage; um die aktuelle E01/E02-Anbindung ergänzt |
| OCR-04 | `5e6969a82af4419aa17f16c40a061ef8f2dcdc0e` | getrennte Automatik-, Genauigkeits- und Modellproben, negative Abnahmegegenproben |

## Ergänzungen am kombinierten Stand

Die Bereichsfrage verwendet den bestätigten, quellen- und bildfassungsgebundenen E02-Text.
Solange Korrekturen laden oder ihr Lesen fehlschlägt, gehen keine Rohtexte an Klara. Eine Änderung
verwirft den bisherigen Gesprächskontext; verspätete Antworten aus einer anderen Quelle,
Bildfassung, Auswahl oder einem anderen Konto erscheinen nicht. Auch bei ausgeschalteter
Automatik ergänzt die ausdrückliche Frage nur das gewählte Bild und berücksichtigt gespeicherte
Korrekturen. Ähnlich berichtigte Wörter erhalten die bestehende E01-Zuordnung. Ergänzungen ohne
verlässlichen Ort lösen den ehrlichen Ganzbild-Rückfall aus. EXIF 6/8 wird mit der E01-Rahmenprüfung
in die sichtbare Vorschau übertragen; unklare Drehungen erhalten keine erfundene Bereichsposition.

Gerenderte PDF-Seiten stehen im Dateiimport als flüchtige Originalvorschau desselben OCR-Laufs
bereit. E01-Fundstellen, E02-Berichtigung, E03-Tabellen und E06-Auswahl nutzen diese Seite und ihre
Bildfassung. Der Seitenstand und die native/OCR-Deduplizierung bleiben erhalten. Die PDF selbst
wird nicht verändert. Die weiteren PDF-Eingänge haben ihre bestehenden Seiten-/Textwege; sie
behaupten keine native Bildauswahl eines Office-Hosts.

## Begrenzte Mac-Einzeldateibrücke

`POST /api/klara/programme/finder` ergänzt `ocrUrl` als relativen Pfad
`/erfassen?weg=datei&finder=<kodierte Objektkennung>`. Die bestehende native Auswahl übergibt genau
eine bewusst gewählte Datei; der Server prüft Sitzung, aktuelle Rechte, Datei-ID und Original-SHA.
Es gibt keinen neuen Bildschirm-, Verzeichnis- oder Nachbardateizugriff.

Die Web-Fläche liest zuerst die bestehende Eigentümer-/Finder-Herkunftsroute. Nur mit bestätigtem
Finder-Aufnahmebeleg und seiner Bindung lädt sie das Objekt. Größe, MIME und SHA-Fassung werden
vor dem normalen Dateiimport geprüft. Account-, Adress- oder Dateiauswahlwechsel verwerfen einen
überholten Eingang. Es gelangen keine Bildbytes, Pfade oder Zugangsdaten in den Link. Die vorhandene
Vertraulichkeits-, Modellzweck- und Budgetprüfung des Dateiwegs bleibt erhalten.

B besitzt die native Shell. Ihre kleine Ergänzung muss `FinderErgebnis.ocrUrl` optional dekodieren
und einen erlaubten relativen Pfad gegen den konfigurierten Klarwerk-Ursprung öffnen. Erst der
wirklich kombinierte B+C-Kandidat kann als nativer Mac-Nutzerweg geprüft werden.

## Prüfgrenzen

Der Chromium-Datei-/Bild-/PDF-Weg ist vom nativen Host getrennt. Die H02-Probe fährt die echte
Word-Add-in-Übernahmeroute und ihren Web-Editor, H06 den Office-Anhang und dessen Bildbefund.
Diese Fälle ersetzen keine Bedienung in Word oder im eingebetteten Collabora-Editor. Ein natives
PowerPoint-Add-in ist im Bestand nicht vorhanden. Die PowerPoint-Datei wird tatsächlich gelesen;
PP-02/03 und PP-04 bis PP-09 werden mit diesem Kandidaten nicht übernommen.

Die festen Originaltexte der E06- und OCR-04-Genauigkeitsproben bleiben unverändert. Der frühere
E06-Befund `SUMME 13800` statt `SUMME 1800` wird nicht mit einem dynamischen Vergleich verdeckt.
Der spätere alte `STARTFEHLER.json` zu `362a4425` nennt einen Prüfmittel-Startabbruch ohne gestartete
Tests; daraus folgt kein gelöster Produktfehler und keine Freigabe alter Produktionsphasen.

Für alle Prüfungen gelten die tatsächlichen Berichte im C-Paket. Unveränderte fremde Wächterfehler
bleiben rot benannt; ein positiver Funktionstest wird nicht zu einer Gesamt- oder Liveabnahme.

## Aktuelle gerichtete Ergebnisse

- Der vollständige Build mit vier Typprüfungen und Web-Bündel ist bestanden.
- Die gerichtete kombinierte Auswahl enthält 351 bestandene Tests; vier rote Bestandswächterfälle
  sind konkret getrennt: sechs unveränderte `adm.factory`-/`seitenhilfe.admin.werk`-Texte und zwei
  bestehende Präsentationsfälle je Engine, die bereits im Basismanifest fehlen. Die eigenen
  neuen OCR-Fälle sind erfasst; der Textmodulvertrag besteht.
- Die drei echten Modellfälle sind bestanden: Bereichserklärung und Nachfrage zu `SUMME 1800`,
  direkte Bildfrage sowie PowerPoint-Anhang im Artikel mit Antwort und Zusammenfassung. Das
  ursprüngliche Bild ist unverändert. Der Lauf nennt den tatsächlichen Cloud-/Assist-Status.
- Der erste kombinierte Chromium-Lauf hat zwölf bestandene Fälle. Zwei Testbefunde werden mit
  gezielter Nachprüfung belegt: erneuter Datei-Einstieg nach Neuladen und auf die eigene Quelle
  begrenzte E05-Speichererwartung. Die feste Genauigkeitsprobe wird nicht verändert.
- Der Finder-Webanschluss besteht mit echter Aufnahme-/Objektschnittstelle und tatsächlicher
  Browser-Erkennung. Dies ist ausdrücklich kein nativer Mac-Bedienbeleg.

Das Paket enthält alle Originalberichte, auch rote Zwischenstände, sowie die abschließenden
gezielten Nachprüfungen. Ein unabhängiges Urteil für den Endkandidaten wird getrennt geführt;
frühere positive Urteile werden nicht als neue Endabnahme ausgegeben.
