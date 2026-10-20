# Klara PowerPoint · PP-03 · Validierung und Datenkontrolle

Auftrag `produkt:20261015:klara-powerpoint-validierung`, Revision 1. Quelle: Produktpaket „Klara in
PowerPoint mit validierten Daten“ (Version 1.0, 12.10.2026), Abschnitte 3 bis 9 (PP-03), Peters
Direktauftrag vom 15.10.2026 und die Produktleitlinien UI-01 bis UI-08. Abhängigkeit: PP-02
(`produkt:20261015:klara-powerpoint-datenherkunft`). Plan: `INTEGRATIONSPLAN.md`, Abschnitt 3.

> Ergebnis: Vorhandene Klarwerk-Prüfungen verwenden/gezielt ergänzen; erforderliche Prüfungen,
> Ergebnisse, offene Punkte und Aktualität sichtbar machen. Widersprüche kontextgerecht prüfen.
> Abnahme: Fehlender Zeitraum, falsche Summe, unsichere OCR und veraltete Quellfassung liefern
> konkrete Prüfzustände. Ein passend geprüfter Wert kann gültig angezeigt werden. Änderungen
> heben den alten Status für betroffene Aussagen nachvollziehbar auf.

Stand: **im Bau**. Prüfmodul, Fläche und Anschluss an die PP-02-Schnittstelle (Abschnitt 4) samt
Setup › Klara sind gebaut. Der Anschluss setzt die reguläre PP-02-Lieferung voraus; er wurde an der
Schnittstelle des historischen PP-02-Kandidaten `26b51592` vorbereitet und ist vor der Anwendung
gegen die gelieferte Fassung zu prüfen. Nicht geliefert.

## 1. Abgleich vor dem Bau

- **Original und Quellen:** `AUFTRAG-B1.json`, `QUELLEN.json` (Produktpaket, Direktauftrag,
  Produktleitlinien) und `QUELLEN-FRUEHE-VORBEREITUNG.json` gelesen. Kriterien, Nichtziele und die
  harte Abhängigkeit von PP-02 bleiben unverändert.
- **Basis:** `ef7766dc` (1.0.0-beta.1.989). PP-01 (`docs/klara-powerpoint/BESTAND.md`,
  `INTEGRATIONSPLAN.md`) ist enthalten.
- **PP-02 ist im Basisstand nicht enthalten.** Der Frühvorbereitungsbeleg nennt den historischen
  PP-02-Kandidaten `26b51592` ausdrücklich als *keine* Elternlieferung. Seine Dateien
  (`praesentation-daten.ts`, Ablage, Routen, `FolienDaten.tsx`) stehen nur als Quelltext im Beleg;
  die Registrierung in `build-app.ts`, die Ablage in den Diensten und die Wörterbuchtexte von PP-02
  sind dort nicht enthalten. PP-03 kopiert deshalb **keine** PP-02-Datei und baut keinen zweiten
  Datenpunkt, keine zweite Ablage und keine zweite Route.
- **Nicht frisch erhoben:** Prozess- und Sitzungsstände der Aufträge A01 bis A12 und der laufende
  PP-02-Stand. Dieser Arbeitsbaum hat dafür keinen Lesezugriff (Git war in dieser Sitzung gesperrt).

## 2. Was gebaut ist

`services/app/src/praesentation-pruefung.ts` — die Kontrollen je Datenpunkt und ihre Überlagerung
über den PP-02-Prüfstand. Gelesen werden genau die Felder des PP-02-Vertrags (`Datenpunkt`,
`Pruefstand`, `BindungsSicht`, `FoliensatzDaten`); ein PP-02-Objekt passt ohne Umbau.

| Prüfdimension (Abschnitt 5) | Kontrolle | Vorhandene Klarwerk-Regel |
| --- | --- | --- |
| Struktur | fehlender Bezugszeitraum, fehlende Einheit/Währung, Prozentwert ohne Bezugsgröße → Klärungsbedarf | Pflichtangaben aus Abschnitt 4; V08 (Geltung) als Bezugsrahmen |
| Berechnung | Summenzeile bzw. Summenspalte einer Folientabelle aus **derselben** Dateifassung nachgerechnet → „Falsche Summe“ mit Rechnung und Abweichung bzw. „Summe nachgerechnet“ | V06 `rechne` (jetzt exportiert, sonst unverändert) |
| Erkennung | unsichere OCR → Klärungsbedarf, bis ein Mensch den Wert am Bild bestätigt; sichere OCR bleibt offen | W03/A02; OCR allein validiert nie (L06) |
| Konsistenz | gleiche Bezugsgröße, gleicher Zeitraum, gleiche Einheit, anderer Wert → „Mögliche Abweichung“ mit beiden Fundstellen; anderer Zeitraum/Einheit → Hinweis, kein Widerspruch; unsichere OCR → offen, kein belegter Widerspruch; Folie zeigt anderen Wert als die gebundene Datenfassung → Klärungsbedarf | Muster A05 (beide Fundstellen, keine Entscheidung ohne Beleg); PP-02-Bindungslage |
| Aktualität | neue Artikel- oder Dateifassung → „Veraltete Quellfassung“; Quelle laut Frische fällig/veraltet → Klärungsbedarf; aktuelle und frische Quelle → maschinell bestanden | V02 (Bindung an die Fassung), V03 `discloseFrische` |
| Fachliche Freigabe | Status der Quelle als Auskunft; berechneter Wert mit nicht validierter Eingabe → Klärungsbedarf | V01 Artikelstatus; Abschnitt 5 |

**Überlagerung (`mitKontrollen`) — feste Regeln:**

1. „Überholt“ aus PP-02 bleibt überholt: eine Änderung von Wert, Quelle, Rechenweg oder
   Bezugsrahmen hebt den alten Status immer auf (Fingerabdruck bleibt bei PP-02).
2. Ein konkreter Mangel (Klärungsbefund) schlägt ein früheres „bestanden“. Fehlende Pflichtangabe,
   falsche Summe, Widerspruch oder veraltete Quelle lassen sich nur beheben, nicht wegbestätigen.
3. Ein maschinell bestandener Befund ersetzt nur dort eine offene Prüfung, wo die Maschine die Frage
   vollständig beantwortet (Summe nachgerechnet, Quelle aktuell und frisch). Struktur, Konsistenz und
   fachliche Freigabe bleiben sonst menschliche Prüfungen.
4. „Validiert“ heißt weiter: alle erforderlichen Dimensionen bestanden, die fachliche Freigabe
   (`ko.validate`, PP-02) eingeschlossen. OCR, eine verlässliche Quelle oder ein grüner Teiltest
   validieren nie allein.

5. (Nacharbeit 1) Ein offener Befund, dessen Anlass außerhalb des Datenpunkts liegt (eine neue
   bzw. korrigierte, unsicher erkannte Gegenangabe), öffnet eine bestandene Dimension wieder, wenn die
   Prüfung älter ist als der Anlass oder dessen Zeitpunkt unbekannt ist. Eine spätere passende
   Prüfung bleibt gültig; die frühere Prüfung bleibt sichtbar.

Jeder Zustand nennt seinen Grund und die konkrete Arbeit, die ihn ändert. `datenlage` fasst die
Kontrollen einer Präsentation zusammen: Zustände gezählt und je Datenpunkt jede erforderliche
Dimension, die nicht bestanden ist (Klärung, offen, überholt), mit Grund und nächster Arbeit;
dieselbe Arbeit an demselben Datenpunkt erscheint einmal. Der Detailbereich zeigt je Dimension, wer
bzw. welcher Prüfweg wann geprüft hat, getrennt vom Zeitpunkt der Kontrollberechnung.

`apps/web/src/components/bibliothek/DatenKontrolle.tsx` — `DatenKontrolle` (Prüfstand und
Kontrollen der gewählten Zahl für den Detailbereich, UI-03) und `DatenLage` (offene Punkte; ein Klick
öffnet die Herkunft). Texte: `apps/web/src/texte/datenkontrolle.ts` (de, en, nl). Keine neue
Navigation, kein eigener Abruf, kein Schreibweg.

`services/app/src/praesentation-pruefung-anschluss.ts` — der Anschluss an die PP-02-Routen
(Abschnitt 4): aus der PP-02-Umgebung einer Anfrage entsteht die `KontrollUmgebung`; jede Sicht
erhält die `kontrolle` IHRER Datenfassung — auch eine frühere, damit dieselbe Fassung nie zwei
Zustände trägt (Prüfen und Korrigieren gelten weiter nur der aktuellen). Der Zustand einer Eingabe
ist ihre eigene Datenkontrolle in der verwendeten Fassung, gebildet aus der PP-02-Sicht dieser
Fassung samt rechtegeprüfter Bindungen (strenger als der PP-02-Prüfstand allein: eine falsche Summe
oder eine abweichende Folie an der Eingabe verhindert „validiert“ oben; fail-closed bei nicht bis
zum Ende prüfbarer Kette).

**Arbeit je Dimension (Nacharbeit nach unabhängiger Prüfung).** Jede nicht bestandene Dimension
nennt ihre konkrete Arbeit (`arbeit`), daraus `naechsteArbeit` und die Datenlage:
- überholt: die konkrete PP-02-Arbeit („Neu berechnen und den Rechenweg erneut prüfen.“, „Wert an
  der aktuellen Quellfassung neu lesen bzw. bestätigen.“, „Die betroffene Eingabe an ihrer aktuellen
  Herkunft aktualisieren, dann neu berechnen.“, sonst „… für Fassung n erneut prüfen.“) UND die
  Behebung konkreter Mängel dieser Dimension. Nie eine Arbeit, die den Zustand nicht ändert.
- Klärung/offen: die Arbeit der Befunde; „Summe nicht nachgerechnet“ nennt das Neulesen, nicht
  „Berechnung prüfen.“ (das lehnt der PP-02-Prüfweg ab, wo PP-02 keine Berechnung führt).
- „Eingaben nicht validiert“ verspricht keine Gültigkeit: „… erst danach kann dieser Wert
  validiert sein.“

## 3. Rechte

Die Umgebung (`KontrollUmgebung`) liefert nur, was der Handelnde lesen darf: `artikel` mit `ko.read`
und `darfSehen`, `vergleichbare` nur vollständig lesbare Datenpunkte (PP-02 `vollLesbar`). Ohne
Leserecht an der Quelle entsteht keine Quellauskunft (kein Titel, keine Fassung, keine Frische).
Gegenstellen eines Widerspruchs erscheinen nur, wenn sie lesbar sind. Der Vergleichskontext entsteht
nur aus Präsentationen, die der Handelnde lesen darf — eine Bindung an eine für ihn unsichtbare
Präsentation verändert seinen Zustand nicht (wie PP-02: ohne Leserecht keine Auskunft über eine
Bindung). Export und Aktualisierung
berührt PP-03 nicht (PP-05, PP-07).

## 4. Anschluss an PP-02 (setzt dessen reguläre Lieferung voraus)

Gebaut, ohne zweiten Weg und ohne Änderung am PP-02-Kern (`praesentation-daten.ts`):

1. `routes/praesentation-daten-routes.ts`: jede Antwort mit einer Datenpunkt-Sicht (Liste, Einzelabruf,
   Erfassen, Binden, Prüfen, Korrigieren) trägt die `kontrolle` ihrer Datenfassung
   (`praesentation-pruefung-anschluss.ts`). Die Umgebung ist die PP-02-`DatenUmgebung` derselben
   Anfrage: `artikel` und `folien` unverändert; `vergleichbare` aus `ablage.vonArtikel(heimat)` und
   `ablage.gebundenAn(…)` der lesbaren gebundenen bzw. der Quellpräsentation, gefiltert mit
   `vollLesbar`.
2. `GET …/folien-daten` gibt zusätzlich `datenlage(…)` der lesbaren Datenpunkte aus.
3. `FolienDaten.tsx`: an der Zahl gilt der Zustand aus `kontrolle`; im Detailbereich ersetzt
   `DatenKontrolle` die PP-02-Statusliste (keine zwei Zustände für dieselbe Fassung — auch nicht
   in der Herkunft einer früheren Fassung); Klärungsbedarf in der Theme-Farbe `trust-crit-text`;
   der Fokus springt nur bei anderem Datenpunkt bzw. anderer Fassung auf die Überschrift, nicht
   bei jedem Neuabruf (die Kontrolle trägt je Abruf eine neue Berechnungszeit);
   `DatenLage` steht über der Folienliste, ein Punkt öffnet die Herkunft.
4. Prüfen und Korrigieren bleiben die PP-02-Wege; ihre Antworten tragen die neue Kontrolle, sodass
   die Aufhebung des alten Status sofort an Zahl, Detailbereich und Datenlage sichtbar ist.
5. Setup › Klara (Paket Abschnitt 7): Gruppe „Datenkontrolle“ (`KlaraDatenkontrolleGruppe`) mit der
   Sichtbarkeitsregel offener Datenpunkte in der Datenlage — `alle` (Voreinstellung) oder
   Klärungen, überholte und wieder geöffnete Prüfungen einzeln, noch nie geprüfte offene Prüfungen
   als einblendbare Anzahl. Gespeichert im
   vorhandenen Assistenzprofil (`datenkontrolleOffenePunkte`, derselbe Weg wie OCR-03); im Zweifel
   gilt `alle`. Die Regel ändert keinen Zustand, keine Zählung und keine Prüfanforderung.

## 5. Hosts

| Host | PP-03 |
| --- | --- |
| H01 Native PowerPoint-App | nicht angeboten; erst über A01 |
| H02 PowerPoint für das Web | nicht angeboten; erst über A01 |
| H03 Importierte Datei | nicht angeschlossen (wie PP-02) |
| H04 PPTX als Anhang im Artikel | Kontrollen, Anschluss und Anzeige gebaut (Abschnitt 4); nutzbar mit der regulären PP-02-Lieferung |
| H05 Besprechung, H06 Export | nicht angeschlossen (PP-05, PP-07, PP-08) |

## 6. Belege und Grenzen

Belege dieses Kandidaten (Ausführung durch die Kandidatenprüfung, nicht in dieser Sitzung):

- `tests/klara-powerpoint/pp03-datenkontrolle.test.ts` — kontrollierter Testbestand: fehlender
  Zeitraum, falsche Summe (Rechnung, Abweichung), unvollständige Summe, unsichere/sichere OCR mit und
  ohne Bestätigung, neue Artikel-/Dateifassung, veraltete Quelle (echte V03-Frische), validierter Wert
  und derselbe Wert ohne fachliche Freigabe, Statusaufhebung nach Korrektur und neuer Quelldatei,
  echte Abweichung mit beiden Fundstellen, anderer Zeitraum/Einheit, unsichere Gegenangabe,
  abweichende Folie, Rechte an der Quelle, unvalidierte Eingabe eines berechneten Werts, Datenlage.
- `tests/klara-powerpoint/pp03-datenkontrolle-flaeche.test.tsx` — montierte Fläche: Zustand mit
  Fassung, Grund, Arbeit, Stand und Herkunft je Dimension, Gegenüberstellung beider Fundstellen,
  validierter Wert, Datenlage mit Klick, Englisch.
- `tests/klara-powerpoint/pp03-anschluss.test.ts` — die echten PP-02-Routen mit echter `.pptx`
  (`pp03-pruefdeck.ts`): fehlender Zeitraum, falsche Summe, unsichere OCR, veraltete Quellfassung,
  validierter Wert mit Prüfvermerk, Korrektur mit Statusaufhebung, Widerspruch, anderer Zeitraum,
  Eingaben ohne Freigabe, Rechte (Gegenangabe aus nicht lesbarer Quelle bleibt verborgen).
- `tests/klara-powerpoint/pp03-anschluss-flaeche.test.tsx` — echte Fläche `FolienDaten` und echte
  Setup-Gruppe gegen den echten Server (`buildApp`): Zustand an der Zahl, Datenlage mit Einstieg,
  Korrektur in der Fläche, Setup-Wahl gespeichert und wirksam, Fokus bleibt im Korrekturfeld
  bei einem Neuabruf derselben Fassung.
- `tests/klara-powerpoint/pp03-setup-einstellung.test.tsx` — Profilfeld: Speichern, Abweisen
  ungültiger Werte, Voreinstellung im Zweifel.
- `tests/klara-powerpoint/pp03-anschluss-nacharbeit.test.ts` — die Szenarien der unabhängigen
  Prüfung, umgedreht: konkrete Arbeit überholter Dimensionen (Neu berechnen, Eingabe aktualisieren,
  Freigabe erneut prüfen), Eingabe mit abweichender Folie, unsichtbare Bindung, dieselbe Fassung mit
  einem Zustand, keine vom Prüfweg abgelehnte Arbeit, wieder geöffnete Prüfung.
- `tests/klara-powerpoint/pp03-anschluss-nacharbeit-flaeche.test.tsx` — wieder geöffnete Prüfung
  unter „nur Klärungen einzeln“, Theme-Farbe des Klärungsbedarfs.

Offen und ausdrücklich nicht behauptet:

- **Nutzerweg nur mit PP-02.** Ohne geliefertes PP-02 gibt es keinen Datenpunkt im Produkt. Der
  Anschluss ist an der Schnittstelle des historischen PP-02-Kandidaten gebaut und geprüft; vor
  Veröffentlichung und B1-Abschluss muss die tatsächliche PP-02-Lieferung regulär integriert, der
  Anschluss gegen sie geprüft und kandidatgebunden erneut geprüft sein.
- Die Summenkontrolle erkennt Summenzeilen bzw. -spalten an „Summe/Gesamt/Insgesamt/Total“ im Kopf
  einer Folientabelle. Summen im Fließtext, in Diagrammen (L03) oder mit anderer Beschriftung werden
  nicht automatisch nachgerechnet.
- Der Konsistenzabgleich vergleicht nur erfasste, lesbare Datenpunkte desselben Kontexts über die
  Bezugsgröße; frei formulierte Aussagen werden nicht inhaltlich abgeglichen. Bild-gegen-Text-Funde
  aus A05 sind nicht übernommen (A05 nicht geliefert).
- Setup › Klara: nur die Sichtbarkeit offener Datenpunkte in der Datenlage. Eine Einstellung, die
  den Zustand an der Zahl ausblendet, gibt es bewusst nicht (sie würde Prüfanforderungen verdecken).
  Darstellung von Quellen als Beleg auf der Folie gehört zum Folienbau (PP-05).
- Begründungen des Servers sind deutsch, auch in der englischen und niederländischen Oberfläche.
- UI-04 bis UI-08: keine echte Host-, Screenreader- oder Fensterprüfung; belegt ist nur der montierte
  Baustein. PowerPoint selbst (native App, Web) ist nicht geprüft.

## 7. Stand je PP-ID

| PP-ID | Original / Revision | Stand | Implementierung / Integration | Belege | Rest |
| --- | --- | --- | --- | --- | --- |
| PP-02 | `produkt:20261015:klara-powerpoint-datenherkunft` · 1 | nicht im Basisstand dieses Auftrags | historischer Kandidat `26b51592` (keine Lieferung) | — | Lieferung, Integration |
| PP-03 | `produkt:20261015:klara-powerpoint-validierung` · 1 | im Bau | `praesentation-pruefung.ts`, `praesentation-pruefung-anschluss.ts`, `DatenKontrolle.tsx`, `FolienDaten.tsx` (Anschluss), `KlaraSetup.tsx` (Gruppe Datenkontrolle), `texte/datenkontrolle.ts`; V06-Export | die Testdateien oben (Ausführung durch die Kandidatenprüfung) | reguläre PP-02-Lieferung, kandidatgebundene Prüfung gegen sie, Hostprüfung H01/H02/H03, UI-04 bis UI-08, Lieferung |


## 8. Direkte lokale Integration vom 20.10.2026

Auf Peters direkten Auftrag nach 62 und 59 ist PP-03 auf dem lokal integrierten
PP-02-Stand `43454dd26335cf1d5df70c084f3a07932b4e77e0` angeschlossen. Der bestehende
PP-03-Kandidat `cd6f77c9e8a42b072acdbe54aa95b3fab7976677`, der vollständige
Anschlusspatch in Fassung 3 und Zusatzpatch 0004 sind übernommen. Die neuere
Produktversion 1.0.0-beta.1.992 und die vorhandenen A01/OCR-Bildkorrekturfelder
bleiben erhalten. Das neue Profilfeld für offene Datenpunkte ergänzt sie.

Prüfmodul, PP-02-Routen, Datenlage, Detailansicht und die vorhandene Gruppe
Setup › Klara arbeiten in diesem lokalen Stand zusammen. Zusätzlich ist R18
behoben: Beim Schließen der Herkunft per Knopf oder Escape kehrt der Fokus zum
auslösenden Eintrag der Datenlage zurück. Verschwindet dieser nach einer
Korrektur, erhält die Zahl desselben Datenpunkts den Fokus. Einstiege an der
Zahl und der Pfad durch berechnete Eingaben bleiben erhalten.

Tatsächlich ausgeführt: 228 bestandene Fälle in den 18 gezielten Testdateien
von `PRUEFPLAN-ANSCHLUSS.json`, einschließlich drei neuer R18-Fälle mit montierter
Produktfläche und echtem lokalen Server. Wurzel- und Web-Typprüfung, Format der
19 geänderten Code-/Testdateien und Diff-Prüfung bestanden. Die Testdaten sind
fiktiv; es wurden keine Konten angemeldet. Testprotokolle enthalten Hinweise
von React Router und zu `act` aus den übernommenen Flächentests; kein Test ist
fehlgeschlagen.

Die Aussagen in Abschnitten 5–7 zu fehlender Lieferung und früheren Belegen
beschreiben den historischen Kandidaten. Der Anschluss ist nun lokal geprüft;
eine reguläre Veröffentlichung von PP-02/PP-03, echte Prüfungen der nativen
PowerPoint-App, PowerPoint-Web und importierter Präsentationen sowie reale
Bedien-/Screenreader-Abnahmen sind damit weiterhin nicht belegt. Kein Push,
Deployment, PostgreSQL-Lauf, Gesamtcheck oder alter Orchestrierungslauf wurde
für diese Integration ausgeführt. Der vollständige Originalabschluss bleibt
offen.

Arbeitskopie und kandidatgebundene Nachweise:
`/Users/peterkohnert/klarwerk_arbeit/codex-direkt-auftrag67-20261020` und
`/Users/peterkohnert/Documents/ChatGPT/Klarwerk/outputs/DIREKT-AUFTRAG-67-20261020/`.
