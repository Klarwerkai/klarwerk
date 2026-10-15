# Klara PowerPoint · PP-01 · Bestand, Hosts und Datenverträge

Auftrag `produkt:20261015:klara-powerpoint-bestand`, Revision 1. Quelle: Produktpaket „Klara in
PowerPoint mit validierten Daten“ (Version 1.0, 12.10.2026), Abschnitt 8 PP-01, und Peters
Direktauftrag vom 15.10.2026. Arbeitsbasis `e3b86aec` (1.0.0-beta.1.982).

Das hier ist **Quelleninspektion** des Arbeitsbaums. Es ist keine Host-, Bedien- oder
Modellabnahme. Jede ID steht mit Datei und wörtlichem Anker in [`fundstellen.json`](./fundstellen.json).
`tests/klara-powerpoint/fundstellen.test.ts` prüft, dass die Anker im Code stehen.

## 1. Hostmatrix

Die drei Wege aus der Abnahme von PP-01 sind getrennt aufgeführt: native App, Web und importierte
Datei. Sie sind **nicht gleichwertig**.

| ID | Host | Stand | Lesen | Schreiben | Auswahl | Grenze |
| --- | --- | --- | --- | --- | --- | --- |
| H01 | **Native PowerPoint-App** (Mac/Windows) mit Klara | **fehlt** | — | — | — | Das Manifest kennt nur `<Host Name="Document" />` (Word). Das Bundle unter `/addin` bricht außerhalb von Word ab (L01) |
| H02 | **PowerPoint für das Web** (Microsoft 365) | **fehlt** | — | — | — | Kein Add-in für PowerPoint (L01). Microsoft 365 einzubetten braucht CSPP, das nicht vorliegt (L02) |
| H03 | **Importierte Präsentationsdatei** (.pptx) im Erfassen | geliefert | Folientext, Bilder mit Folie (W01), native Folientabellen als HTML-Tabelle und Klartext (W12), OCR automatisch (W03), Folienbilder optional (W05) | Entwurf/Wissensobjekt in Klarwerk, nie in die Datei zurück | Frage zu Inhalt und Bildern der Datei (W04) | Keine Notizen, Diagrammdaten, SmartArt, Layouts (L03); Tabellen nur als Zellentext ohne Datenstruktur und Bindung (L17) |
| H04 | **PPTX als Office-Anhang im Artikel**, Collabora über WOPI | geliefert | Bildbefunde der Fassung (W03), Frage (W04) | Editor speichert neue Fassung (W08); belegte Nachbearbeitung (W06); Rücknahme (W07) | Keine Auswahl aus dem Editor (W09, L12) | Collabora ist nicht Microsoft PowerPoint (L02); Nachbearbeitung ohne Oberfläche (L13) |
| H05 | **Foliensatz einer Besprechung** | geliefert | Folien mit stabiler Kennung (W10) | Änderungsobjekte mit Ziel, keine Schreibwirkung an der Datei | Folie über p:sldId, nicht über die Nummer | Erkennt geänderte Folien, nicht geänderte Daten (L09) |
| H06 | **Export** eines Klara-Ergebnisses als .pptx | geliefert | — | Neue Datei mit einer Folie (W11) | — | Keine Vorlage, kein Design, nicht live synchronisiert (L07) |
| H07 | **Nativer Mac-Host** (KLARWERK App) | **fehlt** | — | — | — | Startet Server und Browser (L16) |

**Folgerung.** Echte PowerPoint-Fähigkeiten hat Klarwerk heute nur **an der Datei**: H03, H04, H05,
H06. In PowerPoint selbst (H01, H02, H07) gibt es keinen Klara-Weg. Diese Hosts sind in
`aufnahme:20260922:excel-erster-weg` (Revision 4, KO-04-01, KO-04-04, KO-04-05, KO-04-07)
beauftragt. Der fehlende native Host blockiert die Datei- und Produktwege nicht.

## 2. Lese-, Schreib- und Auswahlwege

| ID | Weg | Art | Kern |
| --- | --- | --- | --- |
| W01 | PPTX-Leser `extractPptxRich` | Lesen | Folientext als HTML, native Tabellen (W12), eingebettete Bilder (p:pic) als figure, Bildbilanz, Folie je Bild |
| W02 | Eintragsfilter `PPTX_NEEDED_ENTRY_RE` | Lesegrenze | nur `presentation.xml`, Folien, Folien-Beziehungen, Medien (L03) |
| W03 | Bildautomatik `pptxBildEingang`, Office-Anhänge `OfficeBildBefunde` | Lesen | OCR ohne Klick, Fundstelle Folie und Position; PowerPoint nie „vollständig gelesen“ |
| W04 | `KlaraBildKontextFrage`, `belegstellen` | Auswahl/Frage | Frage und Zusammenfassung zu Text und Bildern der Quelle, Fundstellen ohne Modell |
| W05 | Folienansicht `/api/capture/slides` | Lesen | jede Folie als Bild; nur mit `KLARWERK_SLIDES_ENABLED` |
| W06 | Nachbearbeitung `…/office/:anhangId/nachbearbeitung` | Schreiben | Text einzelner `a:t`-Läufe, Sprechernotiz an vorhandener Notizseite, Handout; neue Zahl braucht Beleg (V06); Diagramm wird Klärung |
| W07 | `…/office/:anhangId/zurueckholen` | Rücknahme | frühere Fassung als neue Fassung |
| W08 | `uebernimmOfficeFassung` | Schreiben | Speichern im Editor, Fassungsprüfung gegen die Basis, Status `offen` |
| W09 | `auswahlVomEditor` | Auswahl | liefert immer `null`; die Fläche sagt das |
| W10 | Folienidentität in `meeting-dokumentbezug.ts` | Bindung | `p:sldId` mit Dateikennung und Fassung (SHA-256); Inhaltsvergleich rekursiv über Diagramme, SmartArt, Layout, Master |
| W11 | `buildAnswerPptx` | Schreiben (Export) | eine Folie, Titel und Text, Minimal-Master, KI-Kennzeichnung in den Eigenschaften |
| W12 | `tableFromGraphicFrame` in `slideToHtml` | Lesen | native Folientabelle (`p:graphicFrame` → `a:tbl`) Best-Effort als `<table>` mit Zeilen und Zellen und als Klartext („Zelle \| Zelle“), in Dokumentreihenfolge, gezählt in `tableCount` (L17) |

## 3. Vorhandene Validierungsregeln

Abschnitt 5 des Pakets verlangt, vorhandene Klarwerk-Regeln anzuschließen. Diese gibt es:

| ID | Regel | Gilt für | Bezug zu Abschnitt 5 |
| --- | --- | --- | --- |
| V01 | `KoStatus` offen/validiert, `displayStatus` (Prüfung, Revalidierung, Konflikt, abgelehnt) | Wissensobjekt | fachliche Freigabe, „Überprüfung nötig“ |
| V02 | `aiCheckUeberholt`: Prüfnachweis an Fassung, Quellen, Anhänge und Kontext gebunden | Wissensobjekt | „keine alte Validierung auf veränderte Fassung“ |
| V03 | Frische (frisch, altert, fällig, veraltet), Haltbarkeit, Freigabe in Dokumente | Wissensobjekt | Aktualität |
| V04 | Stellenanker an Absatz, Tabelle oder Bild einer Fassung | Rückfrage/Kommentar | Fundstelle |
| V05 | `officeSchreibweg`: validierter Artikel nur über Vorschlag | Office-Anhang | Rechte, Freigabe |
| V06 | Zahlenbeleg mit Rechenprüfung (Summe, Differenz, Anteil in Prozent) | ein Nachbearbeitungsschritt | Berechnung, Herkunft |
| V07 | Schutzstufe intern, vertraulich, streng vertraulich | Wissensobjekt | Weitergabe, Modellweg |
| V08 | `geltungFuerFrage`: Geltung einer Aussage | Wissensobjekt | Struktur/Bezugsrahmen |

Alle Regeln gelten **je Wissensobjekt bzw. je Auftrag**. Keine gilt je Zahl oder Aussage auf einer
Folie (L04, L05).

## 4. Datenquellen und Schnittstellen

| ID | Quelle | Schnittstelle | Grenze |
| --- | --- | --- | --- |
| D01 | Wissensobjekte mit Quellen, Anhängen, Fassungen | `/api/kos`, `/api/objects/:id/raw` mit `ko.read` und Sichtbarkeit | Aussagen, keine Datenpunkte mit Einheit/Zeitraum (L04) |
| D02 | Excel-Import (.xlsx) | Import-Prüfliste, `parseImportItems` | Formeln nicht ausgewertet, nur Feldformat (L14) |
| D03 | Bildbefunde einer Präsentation | in der Fläche je Konto | nicht am Wissensobjekt gespeichert (L06) |

Dazu die Datei-Schnittstellen H03 bis H06 aus Abschnitt 1.

## 5. Setup › Klara

| ID | Einstellung | Stand |
| --- | --- | --- |
| S01 | Bereich „Klara“ in `/profil` (`?bereich=klara`), Ablage `assistenz_profile` | geliefert |
| S02 | „Bilder automatisch analysieren und Text erkennen“, Voreinstellung an | geliefert |
| S03 | Tastenkürzel mit Konfliktregeln, nur im Klarwerk-Fenster | geliefert |

PowerPoint-Einstellungen aus Abschnitt 7 fehlen (L11). Sie gehören in S01 und nicht in einen
zweiten Setup-Ort.

## 6. Konkrete Lücken

| ID | Lücke |
| --- | --- |
| L01 | Kein Klara-Add-in für PowerPoint (native App H01, Web H02). Beauftragt in A01 |
| L02 | Microsoft PowerPoint für das Web nicht eingebettet (CSPP fehlt); Collabora-Darstellungstreue und Notizanzeige in Microsoft PowerPoint nicht belegt |
| L03 | PPTX-Leser liest keine Notizen, Diagrammdaten, SmartArt, Layouts, Master; Diagrammwerte sind nicht verfügbar (native Tabellen liest W12) |
| L04 | Kein Daten-/Aussagenobjekt mit Wert, Einheit, Zeitraum, Quellfassung, Erfassungsart, Rechenweg und Folienbindung (PP-02) |
| L05 | Status und Prüfnachweis nur je Wissensobjekt; Prüfdimensionen nicht getrennt (PP-03) |
| L06 | OCR-Text einer Präsentation nicht gespeichert und kein Prüfgegenstand; Korrektur bei A02 |
| L07 | Kein Folienaufbau aus Daten mit Vorlage/Design; Diagramme nicht änderbar (PP-05) |
| L08 | Keine geprüfte Datenergänzung, keine getrennte Szenario-/Prognosebehandlung (PP-06) |
| L09 | Keine Wirkungsübersicht von Quellenänderungen auf Folien; keine Fassungen nach Tiefe/Zielgruppe (PP-07) |
| L10 | Kein Probevortrag, keine Rückfragensimulation, kein Live/Audio in PowerPoint (PP-08) |
| L11 | Keine PowerPoint-Einstellungen in Setup › Klara; Kürzel wirken nicht in PowerPoint |
| L12 | Keine Auswahl aus dem eingebetteten Editor an Klara |
| L13 | Nachbearbeitung ohne Oberfläche, Laufgedächtnis je Prozess |
| L14 | Excel nur als Wissensimport, Formeln nicht ausgewertet; Excel-Arbeitsweg bei A01 |
| L15 | Keine echte Host-, Bedien-, Barrierefreiheits-, Audio- oder Exportprüfung für einen PowerPoint-Weg |
| L16 | Kein nativer Mac-Host |
| L17 | Native Folientabellen (W12) nur als Zellentext: keine Zahlen-/Einheiten-/Zeitraumerkennung, keine Kopfzeilen, keine Zell- oder Tabellenkennung, keine Bindung an Quelle und Folienelement (strukturierte Bindung: PP-02, L04) |

## 7. Abgleich laufender Aufträge (keine Doppelstarts)

Stand der verknüpften Originale laut Auftragsquelle (`QUELLEN.json`, `linked_originals`, erfasst
15.10.2026 09:04 UTC). Bei A07 bis A12 ist nur belegt, dass ihr Code im Hauptstand `e3b86aec` liegt
(Fundstelle je Eintrag in `fundstellen.json`); ihr Lieferstand ist damit nicht erhoben (7.2).

| ID | Auftrag | Revision | Stand | Bezug | Folge für das PowerPoint-Paket |
| --- | --- | --- | --- | --- | --- |
| A01 | `aufnahme:20260922:excel-erster-weg` | 4 | offen | H01, H02 | PowerPoint-Hosts (Manifest, Adapter, Auswahl, Rückgabe, Abnahme Mac/Web) baut **nur** A01. Das PowerPoint-Paket baut keinen eigenen Host |
| A02 | `produkt:20261012:klara-ocr-fundstellen-korrekturen` | 1 | offen | PP-04 | Fundstellen und Korrekturen nur dort |
| A03 | `produkt:20261012:klara-ocr-tabellen` | 1 | offen | PP-04, PP-05 | Bildtabellen nur dort |
| A04 | `produkt:20261012:klara-ocr-mehrseitige-scans` | 1 | offen | PP-04 | mehrseitige Scans nur dort |
| A05 | `produkt:20261012:klara-ocr-widersprueche` | 1 | offen | PP-03, PP-04 | Bild-/Textwiderspruch nur dort; PP-03 nutzt das Ergebnis |
| A06 | `produkt:20261012:klara-ocr-bereichsfrage` | 1 | offen | PP-04 | „Was steht hier?“ nur dort |
| A07 | `produkt:20261012:klara-bildanalyse-ocr-automatik` | — | Code im Hauptstand | PP-04 | W03 wiederverwenden |
| A08 | `produkt:20261012:klara-bildanalyse-ocr-kontext-setup` | — | Code im Hauptstand | PP-04, Setup | W04, S02 wiederverwenden |
| A09 | `produkt:20261012:klara-setup-shortcuts-umsetzung` | 2 | Code im Hauptstand | Setup | S01, S03 erweitern, nicht ersetzen |
| A10 | `produkt:20261007:office-artikel-editor` | — | Code im Hauptstand | H04 | W07, W08, W09 wiederverwenden |
| A11 | `produkt:20261011:assistenz-dokumentnachbearbeitung` | — | Code im Hauptstand | PP-05, PP-07, PP-08 | W06, V06 wiederverwenden |
| A12 | `produkt:20261011:assistenz-meeting-dokumentbezug` | — | Code im Hauptstand | PP-07, PP-08 | W10 wiederverwenden |

PP-01 hat keinen dieser Aufträge gestartet, geändert oder übernommen. Ihre Kriterien, Arbeitsbäume
und Sitzungen bleiben unverändert.

### 7.1 Überschneidungen und Zuständigkeiten

Grundlage: die erlaubten Pfade der verknüpften Originale (`QUELLEN.json`, Feld `paths`) und die
Dateien der Wege aus Abschnitt 2. Eine Datei, die ein offener Auftrag als seinen Umfang führt, ändert
das PowerPoint-Paket nicht nebenher. PP-02 bis PP-08 nutzen dort nur das Ergebnis.

| Datei bzw. Bereich | Weg | zuständig | Überschneidung mit dem PowerPoint-Paket | Regel |
| --- | --- | --- | --- | --- |
| `docs/word-addin/klara-manifest.xml`, `apps/web/public/word-addin/`, `apps/web/public/office-addin/`, `docs/office-addin/` | H01, H02 | A01 (Pfade laut Quelle) | PowerPoint-Manifest, Hostadapter, Auswahl und Rückgabe in PowerPoint | nur A01 baut; PP-02/PP-03 schließen danach an |
| `apps/web/src/lib/bildAutomatik.ts`, `apps/web/src/components/bibliothek/OfficeBildBefunde.tsx` | W03 | A02 bis A06 (Pfade `apps/web/src/`, `services/`) | Fundstellen, Korrekturen, Tabellen, Scans, Widersprüche an PPTX-Bildern | PP-04 ändert hier nichts, solange A02 bis A06 offen sind |
| `apps/web/src/lib/klaraBildKontext.ts`, `apps/web/src/components/KlaraBildKontextFrage.tsx` | W04 | A06 (Bereichsfrage), Code aus A08 | Frage zu Auswahl und Bereich | PP-04 nutzt W04 unverändert |
| `apps/web/src/lib/pptx.ts` | W01, W02, W12 | kein offener Auftrag führt die Datei namentlich; A02 bis A06 dürfen sie über `apps/web/src/` ändern | Folientabellen (W12), Notizen/Diagramme (L03) | vor jedem PP-Bau frisch auf fremde Änderungen prüfen |
| `apps/web/src/components/klara-setup/KlaraSetup.tsx`, `services/app/src/assistenz-profil.ts` | S01 bis S03 | Code aus A08, A09 | neue PowerPoint-Einstellungen (L11) | als eigene Gruppe in S01, nichts umbauen |
| `services/app/src/office-nachbearbeitung.ts`, `services/app/src/routes/office-routes.ts` | W06, W07 | Code aus A10, A11 | Folienänderung mit Beleg, Rücknahme (PP-05, PP-07) | erweitern statt zweiter Schreibkern |
| `services/app/src/meeting-dokumentbezug.ts` | W10 | Code aus A12 | Folienbindung (PP-02, PP-07, PP-08) | Identität `p:sldId` + Fassung übernehmen |
| `docs/klara-bildanalyse-ocr/` | — | A02 bis A06 (Pfad laut Quelle) | — | das PowerPoint-Paket schreibt dort nicht |

### 7.2 Erhebungsstand zu Sitzungen und Arbeitsbäumen

**Erhoben:** der eigene Auftrag. `auftragsstand.json` dieses Auftrags (Revision 11) nennt einen
Betrieb mit Status `running` für genau `produkt:20261015:klara-powerpoint-bestand` auf Zweig
`codex/auftrag-f263c73ba0d8a175c378`, Kandidat `08de39f3`. Diese Nacharbeit läuft in derselben
Sitzung und demselben Arbeitsbaum weiter; ein zweiter Lauf ist nicht entstanden.

**Nicht erhoben:** die laufenden Sitzungen, Kandidaten und Arbeitsbäume von A01 bis A12. Ihre Belege
(`auftraege/<kennung>/auftragsstand.json`, die Zweige `codex/auftrag-…`) liegen außerhalb des
eigenen Auftragsordners. In dieser Sitzung sind Lesezugriffe dorthin und Git-Befehle gesperrt. Das ist
eine **offene Beleglücke**, keine fehlende Implementierung. Die Kandidatenlisten im Repository
(`docs/klara-setup-shortcuts/BESTAND.md` Abschnitt 6, `docs/klara-bildanalyse-ocr/ABGLEICH-OCR-AUFTRAG.md`)
stammen vom 12.10.2026 und belegen keinen heutigen Stand.

Bis der Abgleich nachgeholt ist, gilt die Regel aus 7.1: Das PowerPoint-Paket startet keinen dieser
Aufträge und ändert keine Datei, die dort einem offenen Auftrag zugeordnet ist.
