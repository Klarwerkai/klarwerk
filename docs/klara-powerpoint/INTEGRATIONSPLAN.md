# Klara PowerPoint · Integrationsplan für PP-02 bis PP-09

Grundlage: [`BESTAND.md`](./BESTAND.md) und [`fundstellen.json`](./fundstellen.json). Der Plan setzt
**nur** erfasste Bausteine voraus (IDs H·W·V·D·S·A·L). `tests/klara-powerpoint/fundstellen.test.ts`
prüft das. PP-01 liefert diesen Plan und keine der folgenden Funktionen.

Es entsteht keine zweite Assistenz-, Quellen-, Modell-, OCR-, Anmelde- oder Officeverwaltung.
PowerPoint behält seinen eigenen Hostaufbau; Klara ergänzt ihn nur dort, wo ein Host existiert.

## 0. Reihenfolge und Abhängigkeiten

1. **Datei- und Produktwege zuerst.** PP-02 bis PP-07 bauen auf H03, H04, H05 und H06 auf. Sie
   brauchen keinen nativen Host und warten nicht auf A01.
2. **Hosts nur über A01.** Lesen, Schreiben und Auswahl in der PowerPoint-App (H01) und in PowerPoint
   für das Web (H02) entstehen ausschließlich in `aufnahme:20260922:excel-erster-weg` (KO-04-01,
   KO-04-04, KO-04-05, KO-04-07). Sobald A01 einen Host liefert, schließt das PowerPoint-Paket dort an
   die Daten aus PP-02 an. Es baut kein eigenes Manifest und keinen eigenen Adapter.
3. **OCR nur über A02 bis A08.** PP-04 nutzt W03 und W04 und die Ergebnisse von A02 bis A06. Es
   erzeugt keine zweite Erkennung und keine eigenen Korrekturen.
4. **Ein Setup-Ort.** Neue Einstellungen kommen in S01 (Bereich „Klara“, Ablage `assistenz_profile`),
   neben S02 und S03.

## 1. Fähigkeiten und Lücken je Host

Die Spalte „Ausbaustufe“ nennt, was nach dem Plan dort nutzbar werden kann. Sie ist keine Zusage
für einen Host ohne Beleg.

| Host | Echte Fähigkeit heute | Konkrete Lücke | Ausbaustufe nach Plan |
| --- | --- | --- | --- |
| H01 Native App | keine | L01, L11, L15, L16 | nach A01: Auswahl einer Folie bzw. eines Textbereichs an PP-02/PP-03; vorher **nicht angeboten** |
| H02 Web | keine | L01, L02, L15 | nach A01 wie H01, mit eigener Abnahme; vorher **nicht angeboten** |
| H03 Importierte Datei | Lesen W01, Folientabellen als Text W12, OCR W03, Frage W04, Folienbilder W05 | L03, L04, L05, L06, L15, L17 | PP-02 bis PP-04 (Herkunft, Prüfung, OCR an Folien) |
| H04 Anhang im Artikel | OCR W03, Frage W04, Speichern W08, Nachbearbeitung W06, Rücknahme W07, Rechte V05 | L02, L03, L07, L12, L13, L15 | PP-02 bis PP-07 (Bindung, Prüfung, Folienänderung mit Vorschau und Rücknahme) |
| H05 Besprechung | Folienidentität W10 | L09, L10 | PP-07, PP-08 (Änderungswirkung, Nachbereitung) |
| H06 Export | neue .pptx W11 | L07, L15 | PP-05 (bearbeitbare Ausgabe mit Belegfolie); nie als live synchron |
| H07 Mac | keine | L16 | kein PowerPoint-Weg; kein Bildschirmzugriff beauftragt |

## 2. PP-02 · Datenherkunft und Bindung an Folien

- **Neu:** ein gemeinsames Daten-/Aussagenobjekt (schließt L04) mit Wert, Einheit/Währung,
  Bezugszeitraum, Bezugsgröße, Quelle (D01) mit Fassung, Fundstelle (V04), Erfassungsart
  (direkt, OCR, manuell, berechnet, prognostiziert) und Rechenweg.
- **Bindung an die Folie** über die vorhandene Folienidentität W10 (`p:sldId` + Dateikennung +
  Fassung), nie über die Foliennummer. Das Element wird zusätzlich über seine Shape-Kennung gebunden.
- **Folientabellen:** W12 liefert native Tabellen schon als Zeilen und Zellen. PP-02 setzt dort an
  und ergänzt Zellkennung, Kopfzeilen, Wert/Einheit/Zeitraum und die Bindung (schließt L17). Ein
  zweiter Tabellenleser entsteht nicht. Diagrammdaten (L03) bleiben ein eigener offener Schritt.
- **Rechenweg:** die Berechnungsarten aus V06 werden aus dem Auftragsrumpf in das Datenobjekt
  übernommen, nicht neu erfunden.
- **Rechte:** Lesen nur mit `ko.read` und Sichtbarkeit der Quelle; Schutzstufe V07 der strengsten
  Quelle gilt für das Datenobjekt.
- **Hosts:** H03 und H04. Zugang zur Herkunft direkt an einer Zahl im Detailbereich (UI-03).
- **Umsetzung (PP-02-Auftrag):** am Anhang H04 gebaut, siehe [`PP-02-DATENHERKUNFT.md`](./PP-02-DATENHERKUNFT.md).
  Eine importierte Datei (H03) nutzt den Weg, sobald sie als Anhang am Artikel hängt.

## 3. PP-03 · Validierung und Datenkontrolle

- Vorhandene Regeln anschließen: V01 (fachliche Freigabe), V02 (Basisbindung), V03 (Aktualität),
  V08 (Geltung). **Neu** ist nur die Ebene je Datenobjekt (schließt L05).
- Die Prüfdimensionen aus Abschnitt 5 werden getrennt geführt. Erkennung kommt aus W03 und A02,
  Konsistenz für Bild gegen Text aus A05, Berechnung aus V06.
- Eine Änderung von Wert, Quelle, Rechenweg oder Bezugsrahmen hebt den Status nach dem Muster von
  V02 auf. OCR allein ergibt nie „validiert“ (L06).
- Prüfstand am betroffenen Inhalt sichtbar, Details im Inspektor (UI-03).

## 4. PP-04 · Bilder, OCR und Scans im PowerPoint-Kontext

- W03 und W04 wiederverwenden. Fundstellen, Korrekturen, Tabellen, Scans, Widersprüche und Bereiche
  kommen aus A02 bis A06; PP-04 bindet nur ihre Ergebnisse an PP-02.
- Bis L03 geschlossen ist, bleibt eine PowerPoint-Quelle „nicht vollständig gelesen“, so wie W03
  es heute schon meldet.
- S02 gilt unverändert.

## 5. PP-05 · Bearbeitbare Präsentationen aus Daten

- Schreiben über die vorhandenen Wege W06 und W08 an H04, Rücknahme über W07. Neue Inhalte werden
  als Vorschau bzw. Variante vor der Übernahme gezeigt.
- W06 kann heute Diagramme nicht ändern (L07). Diagramme und Tabellen brauchen dafür einen
  erweiterten Schreibweg in W06, nicht einen zweiten Kern.
- Bestehende Vorlage und Master erhalten: W06 lässt sie heute schon byte-gleich.
- Export H06 erhält eine lesbare Beleg-/Quellenfolie zur Quellfassung (Abschnitt 4 des Pakets). Der
  Export ist nicht live synchronisiert und gibt Empfängern keine Klarwerkrechte.

## 6. PP-06 · Datenlücken ergänzen

- Fehlende Angaben am Datenobjekt aus PP-02 benennen. Die Suche geht zuerst über D01 mit den
  Rechten des Nutzers.
- Eine Ergänzung erhält Herkunft und Prüfstand aus PP-03. Szenario und Prognose werden als eigene
  Erfassungsart geführt und nie als beobachteter Wert ausgegeben (L08).

## 7. PP-07 · Änderungen, Versionen und Präsentationstiefen

- Wirkungsübersicht: von einer neuen Quellfassung über die Bindungen aus PP-02 zu Folien, Elementen
  und Notizen (L09). W10 liefert die Folie, W06 die Übernahme, W07 die Rücknahme.
- Konflikte mit manuellen Änderungen meldet der vorhandene Fassungsweg (W08, `KO_STALE`).
- Kurz- und Langfassungen verweisen auf dieselben Datenobjekte und damit auf dieselbe Quellfassung.

## 8. PP-08 · Vortrag und Nachbereitung

- Nachbereitung über H05 und W10 an Folie und Aussage. Sprechernotizen über W06.
- Live- und Audiounterstützung nur in einem nachgewiesenen Host. Heute gibt es keinen (L10, L01).
  Keine automatische Gesprächsaufzeichnung als Voraussetzung.

## 9. PP-09 · Abnahme und Integration

- Je Ausbaustufe getrennt: Stufe I (PP-01 bis PP-04 und Setup) an H03 und H04; Stufe II an H04 und
  H06; Stufe III an H05.
- Native App und Web (H01, H02) werden erst nach A01 und dann **getrennt** abgenommen. Bis dahin
  bleiben sie offen (L15). Collabora (H04) belegt nicht die Darstellung in Microsoft PowerPoint (L02).
- Bedienabnahme nach UI-04 bis UI-08 in echtem Host mit aktiver Fassung; kein Screenshot, HTML-Test
  oder Build gilt als Bedienabnahme.

## 10. Setup › Klara

In S01 als eigene Gruppe neben S02 und S03 (schließt L11 für den Datei-/Produktweg):

- bevorzugte Vorlage/Design, Zielgruppe, Vortragsdauer;
- Darstellung von Prüfstand und offenen Datenpunkten (eine Anzeigeeinstellung umgeht keine Prüfung);
- Vorschau bei Quellaktualisierung, sobald PP-07 sie anbietet.

Kürzel für PowerPoint-Aktionen erst, wenn A01 einen Host liefert; S03 wirkt nur im Klarwerk-Fenster.

## 11. UI-Leitlinien (UI-01 bis UI-08)

- UI-01, UI-03: Datei, Folie und Zahl als aktiver Bezug sichtbar; Herkunft und Prüfstand im
  Detailbereich, nicht dauerhaft über der Folie.
- UI-02: der Weg „Daten auswählen → prüfen → Quelle verstehen → korrigieren oder ergänzen →
  verwenden“ läuft in H04 am Artikel, ohne Wechsel zwischen globalen Startseiten.
- UI-04, UI-05: Klara ergänzt die Fläche und ist aus- und einblendbar. Die Tastatur folgt S03.
- UI-07: keine neue globale Navigation. Die PowerPoint-Funktionen hängen am Artikel (H04) und am
  Erfassen (H03).
- UI-06, UI-08: echte Prüfung bleibt offen (L15).

## 12. Stand je PP-ID

| PP-ID | Original / Revision | Stand | Implementierung / Integration | Belege | Rest |
| --- | --- | --- | --- | --- | --- |
| PP-01 | `produkt:20261015:klara-powerpoint-bestand` · 1 | im Hauptstand integriert (1.0.0-beta.1.987, `500cb5c6`); zentraler Abschluss in diesem Arbeitsbaum nicht belegt | `docs/klara-powerpoint/` | Quelleninspektion, `tests/klara-powerpoint/fundstellen.test.ts` | zentraler Abschluss laut Auftragsstand |
| PP-02 | `produkt:20261015:klara-powerpoint-datenherkunft` · 1 | im Bau (Kandidat dieses Auftrags) | `services/app/src/praesentation-daten.ts`, Routen `praesentation-daten-routes.ts`, Fläche `FolienDaten.tsx` am Anhang H04; Details in `PP-02-DATENHERKUNFT.md`; schließt L04 und L17 für H04 | `tests/klara-powerpoint/pp02-datenherkunft.test.ts`, `pp02-herkunft-an-der-zahl.test.tsx` (Lauf durch die Kandidatenprüfung) | unabhängige Prüfung, Lieferung; H01 und H02 erst über A01; Diagramme (L03); echte Bedienabnahme (L15) |
| PP-03 | Paket PP-03 | vorbereitet | — | — | L05 |
| PP-04 | Paket PP-04, mit A02 bis A06 | vorbereitet | W03, W04 vorhanden | OCR-02/OCR-03 im Hauptstand | L03, L06; A02 bis A06 offen |
| PP-05 | Paket PP-05 | vorbereitet | W06, W08, W11 vorhanden | — | L07 |
| PP-06 | Paket PP-06 | vorbereitet | — | — | L08 |
| PP-07 | Paket PP-07 | vorbereitet | W10 vorhanden | — | L09 |
| PP-08 | Paket PP-08 | vorbereitet | W06 (Notizen), W10 | — | L10 |
| PP-09 | Paket PP-09 | vorbereitet | — | — | L15; H01, H02 über A01 |

„Vorbereitet“ heißt hier: im Produktpaket beschrieben. Eine Aufnahme als eigener Produktionsauftrag
ist in PP-01 nicht belegt.
