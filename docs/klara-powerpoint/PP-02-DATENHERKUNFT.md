# Klara PowerPoint · PP-02 · Datenherkunft und Bindung an Folien

Auftrag `produkt:20261015:klara-powerpoint-datenherkunft`, Revision 1. Quelle: Produktpaket „Klara in
PowerPoint mit validierten Daten“ (Version 1.0, 12.10.2026), Abschnitte 4, 5 und 8 (PP-02), Peters
Direktauftrag vom 15.10.2026 und die Produktleitlinien UI-01 bis UI-08. Abhängigkeit: PP-01
(`INTEGRATIONSPLAN.md`, Abschnitt 2).

> Ergebnis: Gemeinsam nutzbare Daten-/Aussagenobjekte mit Quellenfassung, Fundstelle, Rechenweg
> und Bindung an Folien/Elemente; Aufruf der Herkunft direkt an einer Zahl/Aussage.
> Abnahme: Eine manuelle Zahl, eine OCR-Zahl und ein berechneter Wert sind unterscheidbar.
> Die richtige Quelle und alle tatsächlich verwendeten Eingaben sind erreichbar.

Stand: **im Bau** (Kandidat dieses Auftrags). Nicht geprüft, nicht geliefert.

## 1. Abgleich vor dem Bau

- **Original und Quellen:** `AUFTRAG-B1.json` und `QUELLEN.json` (Produktpaket, Direktauftrag,
  Produktleitlinien) gelesen; Kriterien und Nichtziele unverändert übernommen.
- **Git:** Zweig `codex/auftrag-20b6e239c59642344567`, sauber auf `500cb5c6` (PP-01 im Hauptstand,
  1.0.0-beta.1.987).
- **Fremdarbeit:** Die Dateien der offenen OCR-Aufträge A02 bis A06 (`bildAutomatik.ts`,
  `OfficeBildBefunde.tsx`, `klaraBildKontext.ts`), der PPTX-Leser `pptx.ts`, `KlaraSetup.tsx` und
  `meeting-dokumentbezug.ts` sind **nicht geändert**; PP-02 nutzt nur ihre vorhandenen Exporte. In
  `office-nachbearbeitung.ts` (A11, geliefert) ist allein `rechne` bzw. `BERECHNUNGSARTEN` exportiert,
  damit der Rechenweg V06 nicht ein zweites Mal entsteht.
- **Nicht frisch erhoben:** Prozess- und Sitzungsstände der Aufträge A01 bis A12 (zentraler
  Auftragsstand). Dieser Arbeitsbaum hat dafür keinen Lesezugriff; der letzte Abgleich steht in
  `BESTAND.md` 7.2 (15.10.2026 10:12 UTC).

## 2. Das Daten-/Aussagenobjekt (Abschnitt 4)

`services/app/src/praesentation-daten.ts` · Typ `Datenpunkt`. Je Feld die Anforderung:

| Anforderung | Feld | Bemerkung |
| --- | --- | --- |
| Wert bzw. Aussage | `art` (zahl/aussage), `wert` (wie geschrieben), `zahl` | eine Zahl je Wert; Jahr/Zeitraum gehören in `zeitraum` |
| Einheit/Währung, Zeitraum, Bezugsgröße | `einheit`, `waehrung`, `zeitraum`, `bezugsgroesse` | fehlende Angaben nennt der Prüfstand (Struktur) |
| Originalquelle, Quellfassung | `quelle`: Artikel + Artikelfassung; bei Dateien Anhang, Objekt und Dateifassung (SHA-256, wie W10) | vom Server gelesen, nie aus dem Rumpf |
| Fundstelle | `fundstelle`: Folie (`p:sldId`, Position, Titel), Element (`p:cNvPr/@id`, Name), Tabellenzelle mit Zeilen- und Spaltenkopf, Bild mit Inhaltskennung und erkanntem Text, wörtliche Stelle im Quellartikel, Eingabe, Rechenweg | Folie nie über die Nummer gebunden |
| Erfassungsweg und Kennzeichnung | `erfassung`: direkt, ocr, manuell, berechnet, prognose | je Art eigene Pflichtangaben |
| Berechnung | `rechenweg`: Art (V06: Summe, Differenz, Anteil in Prozent), Eingaben mit **ihrer verwendeten Fassung und ihrem Wert**, Formel, Rundung, Rohergebnis, Ergebnis | der Server rechnet nach; ein unpassender Wert wird abgewiesen |
| Prognose/Szenario | `annahmen` (Pflicht), `modellbezug` | erscheint immer als „Prognose — kein beobachteter Wert“ |
| Prüfungen, Zeitpunkt, Zuständigkeit | `pruefungen` je Dimension mit Ergebnis, Grund, Person, Zeit, Datenfassung, Fingerabdruck | maschinelle Prüfungen tragen `klarwerk:<weg>` |
| Folien/Elemente | `bindungen`: Artikel, Anhang, Objekt, Dateifassung, `p:sldId`, Element, Zelle | ein Datenpunkt lässt sich an mehrere Elemente, auch anderer Präsentationen, binden |
| Korrekturen | `korrekturen`: neue Datenfassung, geänderte Felder, vorheriger Stand, Grund, Person, Zeit | |

Ablage: `praesentation-daten-ablage.ts` (Speicher bzw. Postgres, Tabelle `praesentation_datenpunkte`,
additiv). Geschrieben wird bedingt gegen den gelesenen Stand.

## 3. Prüfstand (Abschnitt 5)

Die Dimensionen Erkennung, Struktur, Berechnung, Konsistenz, Aktualität und fachliche Freigabe stehen
getrennt, je mit Stand (bestanden, Klärungsbedarf, offen, überholt, trifft nicht zu) und Grund.

- Jede Prüfung gilt für **eine** Datenfassung und deren Fingerabdruck (Wert, Bezugsrahmen, Quelle mit
  Fassung, Fundstelle, Rechenweg mit Eingabefassungen, Annahmen). Ändert sich etwas davon, bleibt die
  alte Prüfung sichtbar, gilt aber als **überholt**.
- Eine neue Quell- oder Dateifassung macht die Aktualität überholt; eine neue Fassung einer Eingabe
  macht die Berechnung überholt. Daraus wird **„Überprüfung nötig“**.
- Nacharbeit 4: Die Aktualität eines berechneten Werts folgt der **tatsächlich verwendeten Herkunft,
  rekursiv** — Quelle → A → B → C. Ändert sich die Quelle hinter einer unveränderten Zwischenstufe
  oder erhält eine tiefere Eingabe eine neue Fassung, zeigen alle abgeleiteten Werte
  „Überprüfung nötig“ mit dem Weg zur Ursache („Über die Eingabe „112“: Über die Eingabe „12 €“: …“).
  Aktualität ist deshalb auch für berechnete Werte eine erforderliche Dimension.
- Nacharbeit 5: Herkunftsketten sind auf **8 Stufen** (Rechenweg auf Rechenweg) begrenzt — dieselbe
  Tiefe, bis zu der Rechte und Aktualität verfolgt werden. Erfassen, Korrektur und Neuberechnung prüfen
  den entstehenden Gesamtgraphen samt Historie **vor** dem Speichern; eine tiefere Kette wird
  verständlich abgelehnt, es wird nichts gespeichert, der Bestand bleibt unverändert.
- Erkennung: Direkt übernommene Werte prüft der Server maschinell (der Wert steht an der Fundstelle);
  OCR-Werte sind **nie** maschinell bestätigt. Eine solche Teilprüfung validiert nicht.
- **Validiert** heißt: alle für diese Datenfassung erforderlichen Dimensionen bestanden, einschließlich
  der fachlichen Freigabe. Die fachliche Freigabe verlangt dasselbe Recht wie die Freigabe eines
  Artikels (`ko.validate`).
- Der Prüfstand nennt, welche konkrete Arbeit ihn ändert.

PP-03 schließt hier die vorhandenen Klarwerk-Regeln (V01 bis V03, V08) und Widerspruchsprüfungen an.

## 4. Rechte

- Lesen: `ko.read` und Sichtbarkeit (`darfSehen`) am Heimatartikel; ohne beides 404, keine
  Existenzauskunft.
- Nacharbeit 2: Ein Datenpunkt ist nur lesbar, wenn der Nutzer die **ganze Herkunft** lesen darf —
  Heimatartikel, jede Quelle und rekursiv jede Eingabe, auch die in der Korrekturhistorie
  (`vollLesbar`). Sonst gibt es ihn für diesen Nutzer nicht: kein Abruf (404), kein Eintrag in Listen,
  keine Verwendung als Eingabe, keine Prüfung, Korrektur oder Bindung. So gelangen vertrauliche Werte
  weder über den Wert noch über Formel, Fundstelle samt Zitat, Prüfgrund oder Korrekturhistorie zu
  Unberechtigten; das gilt sofort auch nach einem Rechteentzug an der Quelle.
- Zielpräsentationen einer Bindung erscheinen nur mit eigenem Leserecht.
- Schutzstufe: die strengste aus Heimat, Quelle und allen Eingaben (V07); durch die Regel oben
  durchgesetzt, nicht nur angezeigt.

## 4a. Frühere Datenfassungen (Nacharbeit 2)

Eine Berechnung verweist auf die Fassung jeder Eingabe, mit der gerechnet wurde. Die Herkunft einer
Eingabe öffnet genau diese Fassung (`GET /api/datenpunkte/:id?fassung=n`), aus der Korrekturhistorie
zurückgerechnet: damaliger Wert, damalige Quelle samt Dateifassung und Fundstelle, damals verwendete
Eingaben (rekursiv). Die Fläche kennzeichnet die frühere Fassung, nennt die aktuelle und öffnet sie
auf Wunsch; Prüfen und Korrigieren gelten nur der aktuellen Fassung.
- Schreiben (erfassen, binden, prüfen, korrigieren): `ko.create`; fachliche Freigabe: `ko.validate`.

## 5. Oberfläche: Herkunft an der Zahl (UI-01 bis UI-08)

`apps/web/src/components/bibliothek/FolienDaten.tsx`, eingebunden in den vorhandenen Office-Weg am
Artikel (`OfficeImArtikel`, „Im Artikel öffnen“) für `.pptx`-Anhänge. Keine neue Navigation.

- Folien mit ihren Elementen; jede gebundene Zahl steht **an ihrem Element** mit Erfassungsart und
  Prüfstand (UI-01). Der Name der Schaltfläche nennt beides auch für Screenreader.
- Ein Klick öffnet die Herkunft im Detailbereich **neben** der Folie: Quelle mit Fassung, Fundstelle,
  Rechenweg mit Eingaben, Annahmen, Prüfstand je Dimension, Bindungen, Korrekturen (UI-03). Eine
  Eingabe öffnet ihre eigene Herkunft; „Zurück“ und „Schließen“, Escape schließt.
- Mit Schreibrecht: am Element erfassen (Tabellenzelle wählbar; bei Bildern „Bildtext lesen“ mit der
  vorhandenen Texterkennung), Prüfung festhalten, korrigieren, neu berechnen, an der aktuellen
  Quellfassung neu lesen (UI-02: auswählen → prüfen → Quelle verstehen → korrigieren → verwenden).

## 6. Hosts

| Host | PP-02 |
| --- | --- |
| H01 Native PowerPoint-App | nicht angeboten; erst über A01 |
| H02 PowerPoint für das Web | nicht angeboten; erst über A01 |
| H03 Importierte Datei | nur, wenn die Datei als Anhang am Artikel hängt; der Erfassen-Weg selbst ist nicht angeschlossen |
| H04 PPTX als Anhang im Artikel | gebaut (Server, Ablage, Fläche) |
| H05 Besprechung, H06 Export | nicht angeschlossen (PP-05, PP-07, PP-08) |

## 7. Belege und Grenzen

Belege dieses Kandidaten (Ausführung durch die Kandidatenprüfung):

- `tests/klara-powerpoint/pp02-datenherkunft.test.ts` — echte Routen, echter Wissensobjektdienst,
  echte PPTX: Datenobjekt, Unterscheidbarkeit manuell/OCR/berechnet, ganze Eingabekette bis zur
  Tabellenzelle, Prüfstand, Statusaufhebung, neue Quellfassung, Rechte.
- `tests/klara-powerpoint/pp02-herkunft-an-der-zahl.test.tsx` — montierte Fläche: Zahl am Element,
  Herkunft im Detailbereich, Eingabekette, verborgene Quelle, Englisch.

- `tests-smoke/praesentation-daten-browser.spec.ts` (Nacharbeit 2) — die echte Anwendung im Browser
  ohne ersetzte Routen: direkt übernommene, manuelle, OCR- (echte Erkennung, fiktives Bild) und
  berechnete Zahl am PPTX-Anhang, Herkunft bis zur Quellzelle, Korrektur, Neuladen und Wiederöffnen;
  Tastatur (Enter/Tab/Escape, Fokus), Namen im Barrierebaum, breites und schmales Fenster ohne
  Überlauf, Hell- und Dunkel-Präferenz mit Bildschirmbelegen.

Offen und ausdrücklich nicht behauptet:

- Kein echter Screenreader (VoiceOver/NVDA): belegt ist der Barrierebaum des Browsers, nicht das
  Vorlesen. Die Anwendung hat kein eigenes Dunkelschema; geprüft ist die Lesbarkeit unter
  Dunkel-Präferenz, nicht ein Dunkeldesign. PowerPoint selbst (native App, Web) ist nicht geprüft
  (A01, L15).
- Diagrammdaten, SmartArt und Sprechernotizen sind nicht lesbar und daher nicht bindbar (L03).
- „Bildtext lesen“ liest genau das gewählte Bild mit der vorhandenen Texterkennung erneut; die
  automatischen Befunde der Fläche `OfficeBildBefunde` (A02 bis A06) werden nicht übernommen.
  OCR-Korrekturen an der Quelle bleiben bei A02.
- Begründungen des Servers (Prüfstand, Abweisungen) sind deutsch, auch in der englischen und
  niederländischen Oberfläche.
- Keine Einstellungen in Setup › Klara (L11), kein Export mit Belegfolie (PP-05), keine
  Wirkungsübersicht oder Übernahme von Quellenänderungen in die Folie (PP-07): Abweichungen werden
  angezeigt, die Folie wird nicht geändert.
- Kein eigener Löschweg für Datenpunkte (Bestandsreset entfernt sie).
