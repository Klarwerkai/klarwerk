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

Stand: **im Bau als unabhängiger Vorlauf** (Kandidat dieses Auftrags, `preparation_only`). Nicht
geprüft, nicht geliefert, nicht an PP-02 angeschlossen.

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

## 3. Rechte

Die Umgebung (`KontrollUmgebung`) liefert nur, was der Handelnde lesen darf: `artikel` mit `ko.read`
und `darfSehen`, `vergleichbare` nur vollständig lesbare Datenpunkte (PP-02 `vollLesbar`). Ohne
Leserecht an der Quelle entsteht keine Quellauskunft (kein Titel, keine Fassung, keine Frische).
Gegenstellen eines Widerspruchs erscheinen nur, wenn sie lesbar sind. Export und Aktualisierung
berührt PP-03 nicht (PP-05, PP-07).

## 4. Anschluss an PP-02 (nach dessen regulärer Lieferung)

Erst dann wird PP-03 nutzbar. Konkret, ohne zweiten Weg:

1. `praesentation-daten.ts` · `sicht()`: nach `pruefstand(dp, u)` die Kontrolle bilden —
   `datenkontrolle(dp, stand, kontrollUmgebung, bindungen)` — und als Feld `kontrolle` in
   `DatenpunktSicht` ausgeben. Die Umgebung entsteht aus der PP-02-`DatenUmgebung`: `artikel` und
   `folien` unverändert, `vergleichbare` aus `ablage.vonArtikel(heimat)` und
   `ablage.gebundenAn(…)` gefiltert mit `vollLesbar`, `eingabeZustand` über `inFassung` + Prüfstand.
2. Die Liste der Route `GET …/folien-daten` gibt zusätzlich `datenlage(…)` aus.
3. `FolienDaten.tsx` · `Herkunft`: `DatenKontrolle` unter dem PP-02-Prüfstand einbinden; an der Zahl
   den Zustand aus `kontrolle` zeigen; `DatenLage` über der Folienliste.
4. Die Prüfen- und Korrigieren-Wege bleiben die von PP-02. Danach erneut kandidatgebunden prüfen.

## 5. Hosts

| Host | PP-03 |
| --- | --- |
| H01 Native PowerPoint-App | nicht angeboten; erst über A01 |
| H02 PowerPoint für das Web | nicht angeboten; erst über A01 |
| H03 Importierte Datei | nicht angeschlossen (wie PP-02) |
| H04 PPTX als Anhang im Artikel | Kontrollen und Anzeige gebaut; nutzbar erst mit der PP-02-Lieferung (Abschnitt 4) |
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

Offen und ausdrücklich nicht behauptet:

- **Kein nutzbarer Nutzerweg.** Ohne geliefertes PP-02 gibt es keinen Datenpunkt im Produkt; der
  PP-02-Prüfstand kommt in den Tests in der Vertragsform herein. Das ist Vorlauf, kein
  Funktionsabschluss. Vor Veröffentlichung und B1-Abschluss muss die tatsächliche PP-02-Lieferung
  regulär integriert, Abschnitt 4 umgesetzt und erneut passend geprüft sein.
- Die Summenkontrolle erkennt Summenzeilen bzw. -spalten an „Summe/Gesamt/Insgesamt/Total“ im Kopf
  einer Folientabelle. Summen im Fließtext, in Diagrammen (L03) oder mit anderer Beschriftung werden
  nicht automatisch nachgerechnet.
- Der Konsistenzabgleich vergleicht nur erfasste, lesbare Datenpunkte desselben Kontexts über die
  Bezugsgröße; frei formulierte Aussagen werden nicht inhaltlich abgeglichen. Bild-gegen-Text-Funde
  aus A05 sind nicht übernommen (A05 nicht geliefert).
- Keine Einstellung in Setup › Klara (Darstellung offener Datenpunkte, L11) — gehört zum
  Setup-Anschluss; eine Anzeigeeinstellung darf keine Prüfung umgehen.
- Begründungen des Servers sind deutsch, auch in der englischen und niederländischen Oberfläche.
- UI-04 bis UI-08: keine echte Host-, Screenreader- oder Fensterprüfung; belegt ist nur der montierte
  Baustein. PowerPoint selbst (native App, Web) ist nicht geprüft.

## 7. Stand je PP-ID

| PP-ID | Original / Revision | Stand | Implementierung / Integration | Belege | Rest |
| --- | --- | --- | --- | --- | --- |
| PP-02 | `produkt:20261015:klara-powerpoint-datenherkunft` · 1 | nicht im Basisstand dieses Auftrags | historischer Kandidat `26b51592` (keine Lieferung) | — | Lieferung, Integration |
| PP-03 | `produkt:20261015:klara-powerpoint-validierung` · 1 | im Bau (unabhängiger Vorlauf) | `praesentation-pruefung.ts`, `DatenKontrolle.tsx`, `texte/datenkontrolle.ts`; V06-Export | die beiden Testdateien oben (Ausführung durch die Kandidatenprüfung) | Anschluss nach Abschnitt 4, Hostprüfung, Setup, Lieferung |
