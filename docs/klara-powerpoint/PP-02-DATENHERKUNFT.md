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
| H01 Native PowerPoint-App | angeschlossen im Fenster aus A01 (§6a); **Hostlauf offen** |
| H02 PowerPoint für das Web | angeschlossen im Fenster aus A01 (§6a); **Hostlauf offen** |
| H03 Importierte Datei | nur, wenn die Datei als Anhang am Artikel hängt; der Erfassen-Weg selbst ist nicht angeschlossen |
| H04 PPTX als Anhang im Artikel | gebaut (Server, Ablage, Fläche) |
| H05 Besprechung, H06 Export | nicht angeschlossen (PP-05, PP-07, PP-08) |

## 6a. Hostanschluss über A01 (PowerPoint für Mac und im Web)

Kein eigenes Manifest, kein eigener Adapter: PP-02 hängt an das Office-Fenster von
`aufnahme:20260922:excel-erster-weg` (`apps/web/public/office-addin/`, Manifest
`docs/office-addin/klara-powerpoint-manifest.xml`, Anmeldung über den vorhandenen Übergabecode).

- **Fenster** `folien-herkunft.js`, Abschnitt „Herkunft der Zahlen“ (nur PowerPoint): Artikel nennen
  (Link oder Kennung), PowerPoint-Anhang wählen, „Mit dieser Präsentation abgleichen“. Danach zeigt
  das Fenster an der markierten Form jede gebundene Zahl mit Erfassungsart und Prüfstand; ein Klick
  öffnet die Herkunft (Quelle mit Fassung, Fundstelle, Rechenweg mit allen verwendeten Eingaben —
  jede öffnet ihre eigene Herkunft —, Annahmen, Prüfstand je Dimension, Befund in dieser Datei).
- **Server** `POST /api/kos/:id/office/:anhangId/folien-abgleich` (Tor `ko.read` vor dem Lesen des
  Körpers, höchstens 30 MiB Präsentation): Office liefert die geöffnete Datei
  (`getFileAsync`, Compressed); der Server liest sie mit `leseFolienDaten` — derselbe Leser wie für
  den Anhang — und prüft jede Bindung mit `elementBefund` (Folie über `p:sldId`, Element über
  `p:cNvPr/@id`, Zelle, Wert bzw. Bildbytes). Gespeichert wird nichts; die Herkunft sind dieselben
  Sichten wie an `folien-daten`. Der Anhang bleibt die Quelle, nicht die Hostdatei.
- **Grenzen des Abgleichs** (unabhängige Prüfung 0001–0006, Befund B1, 18.10.2026;
  `services/app/src/folien-abgleich-grenzen.ts`): vor dem Körper Takt je Nutzer (20 je Minute, wie
  `/api/capture/slides`); nach dem vollständigen Empfang ein Platz — höchstens einer je Nutzer und
  zwei insgesamt, gehalten nur während des Lesens (Nachprüfung N3); vor jedem Parser die selbst
  gezählten Einträge des Zentralverzeichnisses (höchstens 20 000, ein widersprüchlicher Endsatz ist
  unlesbar, N4) und die gestreamte Entpackgrenze des DOCX-Eingangs (`zaehleEchteExpansion`: 160 MiB
  Summe, 100-faches Verhältnis); erst dann der gespeicherte Anhang. Der Leser (`leseFolienDaten`)
  tastet jeden Folienteil einmal linear ab (vorher Regex mit quadratischer Laufzeit bei offenen Tags),
  liest höchstens 2000 Folien und eine mehrfach genannte Folie nur einmal. Die Antwort nennt je
  geöffneter Folie nur Kennung, Stelle und Elemente (Kennung, Name) — keine Texte der Datei.
  Die Lage am Element (`elementBefund`, „passt“/„abweichung“) verlangt bei einem Zahlwert die ganze
  Zahl: keine Ziffer, kein Dezimalzeichen mit Ziffer und kein Vorzeichen daneben (1.200 T€ passt nicht
  in 11.200 T€, 300 T€ nicht in −300 T€; Befund B3, Nachprüfung N1). Erfassen, Binden und Korrigieren
  prüfen unverändert mit `stehtIn` (Nachprüfung N2).
- **Zuordnung ohne Deutung der Office-Kennungen** (ihr Format ist nicht dokumentiert): eine Folie
  über ihre Stelle in der gelesenen Datei — nennt PowerPoint sie in der Form „<Zahl>#…“ und ist die Zahl
  die `p:sldId` an dieser Stelle, ist die Folie bestätigt; ist sie die `p:sldId` einer ANDEREN Folie
  der Datei (vertauscht), wird gar nichts zugeordnet; eine unbekannte Zahl oder ein anderes Format
  gilt als „nach Position (Kennung nicht vergleichbar)“ (Befunde P1/B9, Nachprüfung N5; das Format
  von `Slide.id` ist im Hostlauf zu belegen) —, eine Form über
  Kennung **und** Name, sonst über einen Namen, der auf der Folie in PowerPoint **und** in der Datei
  eindeutig ist (Befund B2). Welche Regel wie oft griff, steht nach dem Abgleich im Fenster — das ist
  zugleich der Messwert für den Hostlauf. Der Fokus folgt der Herkunft und kehrt beim Schließen an die
  Zahl zurück; während eines Abgleichs ist die Anhangwahl gesperrt; die Frist wächst mit der Datei.
- **Grenzen:** nur lesend (keine Rückgabe ins Dokument, keine Einstellungen in der Datei); verlangt
  PowerPointApi 1.5 (Auswahl) und `getFileAsync`; eine Folie, die nach dem Abgleich entsteht, ist erst
  nach erneutem Abgleich zugeordnet; die Verbindung merkt sich das Fenster je Dokument im
  Browserspeicher des Fensters, nicht in der Präsentation.
- **Belege am Kandidaten:** `tests/klara-powerpoint/pp02-hostanschluss.test.ts` (Serverweg H1–H3) und
  `tests/office-addin/powerpoint-herkunft.test.ts` (Fenster P1–P5 auf der A01-Bühne, mit echten
  Serverantworten zu genau den gesendeten Bytes).
- **Hostlauf H01 PowerPoint für Mac 16.111 (17.10.2026, Integrationsstand A01 ⊕ PP-02, lokaler
  Prüfhost, fiktives Deck; von Claude bedient):** Fenster lädt, Anmeldung über den Übergabeweg,
  `getFileAsync` liefert die geöffnete Datei; Office meldet die Form-Kennungen wie `p:cNvPr/@id`
  (7 von 7 über Kennung und Name). Die herausgegebene Datei ist nie bytegleich mit dem Anhang —
  PowerPoint speichert sie dabei neu und ergänzt beim Speichern mit offenem Fenster eigene
  `webextension`-Teile; `p:sldId` und `p:cNvPr/@id` bleiben erhalten. Herkunft an der Zahl,
  Eingabe bis zur Tabellenzelle, manuell/OCR/berechnet unterscheidbar, Änderung als Abweichung,
  Speichern/Wiederöffnen belegt. PowerPoint im Web (H02) ist ein eigener, noch offener Lauf.

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

## Direkte Integration 20.10.2026

Die erhaltene PP-02-Vorarbeit 26b5159 ist mit der A01-Vorleistung 9106756 und dem lokalen
Browser-Integrationsstand von Auftrag 62 vereinigt. Alle Korrekturpatches 0001–0008 sind
übernommen, einschließlich der Härtung des Folienabgleichs und der Herkunfts-/Fokusbedienung.
204 gezielte Prüfungen decken den PP-02-Serverweg, die Webfläche, das Office-Fenster am
Office-JS-Prüfstand und die betroffenen ZIP-/DOCX-/Slides-Wege ab. Wurzel-/Web-Typprüfung und
Formatprüfung sind bestanden. Der bestehende PostgreSQL-Integrationstest war ausgeschlossen
und wird nicht als ausgeführt gezählt.

Das ist ein lokaler Integrationsstand. Eine neue native PowerPoint- oder Web-Hostabnahme,
ein Modelllauf, eine Anmeldung und eine Veröffentlichung sind damit nicht behauptet. Die
historischen Hostbelege behalten ihre jeweilige Kandidatenbindung.
