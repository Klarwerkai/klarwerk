# Klara · Bilder und Texterkennung · Bestand und Quellen-/Hostmatrix (OCR-01)

Auftrag `produkt:20261012:klara-bildanalyse-ocr-bestand` (Revision 1), Quelle
`20261012-auto-bilder-peter-v1`, Paket OCR-01. Basis `0b8ad62c` (1.0.0-beta.1.945), erhoben am
12.10.2026 aus dem Quellcode dieses Arbeitsbaums.

Jede ID steht mit Datei und wörtlichem Anker in [`fundstellen.json`](./fundstellen.json);
`tests/klara-bildanalyse-ocr/fundstellen.test.ts` prüft, dass jeder Anker im Code steht. Die Stände
sind getrennt:

- **geliefert**: im Hauptstand vorhanden,
- **kandidat**: nur auf einem Zweig (C01),
- **fehlt**: nicht vorhanden. Die Fundstelle belegt dann die Grenze.

Die zwei weiteren Dokumente:

- [`ABGLEICH-OCR-AUFTRAG.md`](./ABGLEICH-OCR-AUFTRAG.md): Abgleich mit dem bestehenden Auftrag
  `aufnahme:20260922:gesamt-ocr`,
- [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md): Anschluss von OCR-02 bis OCR-04 an diesen Bestand.

## 1. Kurzbefund

1. **Erkennung gibt es zweimal, beide nur auf Klick.** W01 ist die Texterkennung im Browser
   (tesseract.js, `deu+eng`). W02 ist die Bildbeschreibung über das konfigurierte Modell. Beide
   starten nur auf eine ausdrückliche Nutzeraktion. `files.ts` schreibt das als Regel fest: „Nur auf
   explizite Nutzeraktion aufrufen.“ Eine automatische Auslösung gibt es nirgends (L01).
2. **Eingebettete Bilder werden erfasst, aber nicht gelesen.** PPTX (W03), DOCX (W05), Word-Add-in
   (W08) und Browser-Erweiterung (W09) übernehmen Bilder als `<figure>` mit `data-image-id`. Die
   Bildunterschrift bleibt leer, und erkannt wird nichts (L03).
3. **Klara sieht von Bildern nur Bildunterschriften und Bildnamen.** Der Antwortkontext (W10)
   enthält Rumpftext, `captionTexts` und Bildnamen (alt-Texte). Ein Feld für erkannten Bildtext gibt
   es nicht, einen Analysestatus auch nicht (L08).
4. **PowerPoint ist nur als Datei angebunden.** Es gibt kein PowerPoint-Add-in (H03, L11). Der
   Dateiimport (Q02) und die Folienansicht (W04) sind unabhängig davon nutzbar.

## 2. Quellen-/Hostmatrix

Spalten: **Erfassungsweg** ist der Weg, über den das Bild heute verfügbar wird. **Auslöser** sagt,
ob etwas ohne Klick passiert. **Fundstelle** ist die Granularität, mit der ein Bild heute
wiederzufinden ist.

| ID | Quelle | Host | Erfassungsweg | Auslöser heute | Fundstelle heute | Lücken |
| --- | --- | --- | --- | --- | --- | --- |
| Q01 | **Einzeln bereitgestelltes Bild** (`image/*`): Dateiimport im Erfassen, Bildanhang, „Aus Dokument ergänzen“, Foto-Interview | H01 | W14 erkennt die Art `image`. W01 erkennt Text, W02 beschreibt das Bild | Import automatisch; **Erkennung nur auf Klick** | Dateiname bzw. Anhangskennung | L01, L02, L08, L09 |
| Q02 | **PowerPoint-Datei (.pptx)** als Dateiimport. Als Office-Anhang im Artikel auch über H06 | H01, H06 | W03: Folientext, Tabellen und Bilder aus `p:pic` im Folien-XML als `<figure>`, mit Bildbilanz je Verlustgrund **nur über das Folien-XML**. W04: optional jede Folie als Bild. W13: Folienkennung `p:sldId` mit rekursiv aufgelösten Teilen (Meeting). W18: Anhang lesen und Fassung übernehmen | Import automatisch; Folienansicht nur, wenn eingeschaltet; **keine Erkennung**; Anhänge im Artikel **nicht analysiert** | Folie nur mittelbar über die vorangehende Überschrift `<h2>` je Folie. Die Bildkennung `kw-img-<lauf>-<n>` zählt über das ganze Deck. W04 trägt die Foliennummer (`-s<N>`) | L01, L03, L04, L05, L08, L11, L15, L16, L17 |
| Q03 | **Word-Datei (.docx)**: Dateiimport, „Wissen erfassen“ im Word-Add-in (ganze Datei bzw. Bilder einzeln), Office-Anhang im Artikel | H01, H02, H06 | W05 (mammoth, auch serverseitig über `/api/drafts/from-docx`), W08 (`getFileAsync`, sonst `inlinePictures`, höchstens 60), W18 (Anhang) | Import automatisch; **keine Erkennung**; Anhänge im Artikel **nicht analysiert** | Reihenfolge im Dokument (`data-image-id`), keine Seite | L01, L03, L07, L08, L10, L17 |
| Q04 | **PDF** (Text-PDF und Scan) | H01 | W06 liest nur den Textlayer. W07 kann eine Seite als Bild zeichnen, ist aber nur im Zeichnungsanhang angeschlossen | Import automatisch; **Bilder und Scanseiten werden nicht gelesen** | Seite für Text; für Bilder keine | L01, L06, L08 |
| Q05 | **Bilder einer Webseite** (Markierung, Artikel, Seite) | H04 | W09: Kopie der angezeigten Darstellung über eine Zeichenfläche, höchstens 8, bis 1200 px | Übernahme auf Geste; **keine Erkennung** | Seiten- und Bildadresse; fremde Herkunft unter „Nicht übernommen“ | L01, L08, L13 |
| Q06 | **Bilder im Rumpf** eines Entwurfs oder Wissensobjekts (Einfügen, Ablegen, Import) | H01 | W15 fügt ein. W02 schlägt eine Bildunterschrift vor. W10 macht Bildunterschrift und Bildname suchbar und für Klara nutzbar | Bildunterschrift nur auf Klick | `data-image-id` an `img` und `figcaption` | L01, L08 |
| Q07 | **Foliensatz einer Besprechung** | H01 | W13: Folien-XML mit eingebundenen Teilen, für Vergleich und Bindung | auf Anfrage; **keine Erkennung** | Folienkennung `p:sldId`, Datei, Fassung | L03 |
| Q08 | **Excel, .ppt, .doc und weitere Formate** als Dateiimport | — | keiner. Der Dateiimport nimmt sie nicht an | — | — | fehlt |

Zwei weitere vorhandene Bausteine, an die OCR-02 und OCR-03 anschließen:

- **W16**: Inhaltskennung je Bildvorkommen (`bildInhalteAusRumpf`, `sha256` der Bildbytes zu
  `data-image-id`). Damit lässt sich ein unverändertes Bild wiedererkennen.
- **W17**: Ablage der persönlichen Assistenz-Einstellungen je Konto (`assistenz_profile`). Dort
  kann der Schalter aus L14 liegen.

### 2.1 Hosts

| ID | Host | Stand | Wie Bilder heute verfügbar werden | Grenze |
| --- | --- | --- | --- | --- |
| H01 | Web-App (Erfassen, Editor, Klara-Figur) | geliefert | Dateiimport (Q01–Q04), Editor (Q06), Meeting (Q07) | Die Klara-Figur nimmt beim Ablegen nur Text an (W11, L09) |
| H02 | Word-Add-in „Klara in Word“ | geliefert | Ganze .docx bzw. `inlinePictures` → Entwurf (W08 → W05) | Die Klara-Frage liest nur Text (W12, L10). Requirement-Set WordApi 1.1; `getFileAsync` ist ein Laufzeitversuch mit Rückfall |
| H03 | PowerPoint-Add-in | **fehlt** | — | Das Manifest kennt nur `<Host Name="Document" />`. PowerPoint erreicht Klarwerk nur als Datei (Q02) |
| H04 | Chrome-Erweiterung „Klara im Browser“ | geliefert | Markierung, Artikel oder Seite mit bis zu 8 Bildern (W09) → Entwurf | Spricht nur mit `app.klarwerk.ai`; kein KI-Aufruf in der Erweiterung (L13) |
| H05 | Mac (KLARWERK App) | **fehlt** als Host | — | Nur Starter für Server und Browser. Kein Finder-, Zwischenablage- oder Bildschirmzugriff. Ein neuer Bildschirmzugriff ist nicht beauftragt (L12) |
| H06 | Office im Artikel (WOPI-Dateihost) | geliefert | Die Datei liegt als Anhang mit Fassung im Objektspeicher; Word, Excel und PowerPoint werden im Office-Editor geöffnet, neue Fassungen über W18 übernommen | Bestehender Eingang für Q02 und Q03. Eine Analyse eingebetteter Bilder aus dem Anhang fehlt (L03, L17) und ist Teil von OCR-02 |

## 3. Konkrete Lücken

| ID | Lücke | betrifft |
| --- | --- | --- |
| L01 | Keine automatische Auslösung. W01 und W02 laufen nur auf Klick | alle Quellen |
| L02 | In der Arbeitsbasis `0b8ad62c` lädt `runImageOcr` tesseract.js ohne Engine-Optionen, also Arbeiter als `blob:` und Sprachdaten vom CDN. Laut technischer Probe von C01 verbietet die CSP beides, sodass die Erkennung in der Auslieferung scheitert. Behoben in C01 (`64e1768c`), von Ben abgenommen und inzwischen Stand von `github/main` | W01 |
| L03 | Eingebettete Bilder werden nie erkannt; ihre `figcaption` bleibt leer | Q02, Q03, Q07, H06 |
| L04 | PPTX-Bilder tragen keine Foliennummer. Verworfene Bilder (Format, Budget, defekt, außerhalb `p:pic`) sind nur gezählt, ohne Folie | Q02 |
| L05 | PPTX, **gezählt, aber nicht gelesen**: `a:blip` im Folien-XML außerhalb von `p:pic` (typisch der Folienhintergrund `p:bg`) als `droppedImageOutsidePath`, EMF/WMF/TIFF/BMP in `p:pic` als `droppedImageFormat`. Ob Bilder in verschachtelten Gruppen (`p:grpSp`, nicht rekursiv aufgelöst) eingebettet oder nur gezählt werden, ist nicht belegt | Q02 |
| L16 | PPTX, **überhaupt nicht erfasst und nicht gezählt**: `PPTX_NEEDED_ENTRY_RE` liest nur `presentation.xml`, Folien, Folien-Rels und `media/*`. Bilder aus Layout- und Masterdateien, Diagramme (`ppt/charts`), SmartArt (`ppt/diagrams`) und Notizen kommen weder in den Entwurf noch in die Bildbilanz. Eine ausgeglichene Bilanz heißt deshalb nicht, dass alle sichtbaren Bilder erfasst sind | Q02 |
| L17 | Office-Anhänge im Artikel (H06): eingebettete Bilder einer angehängten oder über W18 neu übernommenen `.pptx`/`.docx` werden nicht analysiert | Q02, Q03, H06 |
| L06 | PDF: keine Extraktion eingebetteter Bilder, gescannte Seiten ergeben keinen Text. W07 zeichnet Seiten nur für den Zeichnungsanhang | Q04 |
| L07 | DOCX: Fundstelle nur als Reihenfolge, keine Seite. Bilder in Kopf-/Fußzeilen und Textfeldern sind nicht belegt | Q03 |
| L08 | Klaras Kontext (W10) hat kein Feld für erkannten Bildtext, keine Bildbefunde und keinen Status „läuft / teilweise / fehlgeschlagen“ | alle |
| L09 | Die Klara-Figur nimmt beim Ablegen nur `text/plain` an | H01 |
| L10 | Klara in Word fragt nur mit Text der Markierung | H02 |
| L11 | Kein PowerPoint-Add-in | H03 |
| L12 | Kein nativer Mac-Host | H05 |
| L13 | Browser: höchstens 8 Bilder, fremde Herkunft nicht übernehmbar, Kopie der Darstellung | H04 |
| L14 | Setup › Klara mit „Bilder automatisch analysieren und Text erkennen“ fehlt. Der Bereich „Klara“ ist im Setup-Auftrag (AA-02) geplant, aber nicht geliefert | OCR-03 |
| L15 | Die Folienansicht (W04) ist standardmäßig aus (`KLARWERK_SLIDES_ENABLED`), braucht `soffice` und `pdftoppm` und endet nach 30 Folien | Q02 |

## 4. Abhängigkeiten und Hostgrenzen, ohne Sperre unabhängiger Quellen

- **Fehlende Hosts sperren nichts.** H03 (PowerPoint-Add-in) und H05 (Mac) fehlen. Bilder und Dateien
  über H01 (Q01–Q04, Q06), H02 und H04 sind davon unabhängig nutzbar und werden in OCR-02/OCR-03
  nicht an diese Hosts gebunden.
- **Dateiimport ist kein Add-in.** Eine `.pptx` im Dateiimport (Q02) ist ein vollständiger,
  unabhängiger Weg. „PowerPoint unterstützt“ heißt in diesem Bestand nur das, nicht „Klara in
  PowerPoint“.
- **Technische Voraussetzung der Erkennung:** L02 ist in C01 (`64e1768c`, Urteil „erfuellt“)
  behoben, aber noch nicht in dieser Arbeitsbasis. Automatische Texterkennung im Browser beginnt auf
  einem Hauptstand mit `64e1768c` (siehe Integrationsplan, Schritt 0).
- **Modellweg (W02):** Die Bildbeschreibung hängt an einem konfigurierten Vision-Modell und an der
  Vertraulichkeitsregel. Vertrauliche Inhalte gehen nicht an eine Cloud. Das bleibt wirksam.
- **Folienansicht (W04):** braucht Betreiberschalter und Systemwerkzeuge. Ohne sie antwortet die
  Route ehrlich mit 503, und der Folientext aus W03 bleibt verfügbar.

## 5. Grenzen dieser Erhebung

- Erhoben durch Quelleninspektion. Kein Lauf in einem echten Office-, PowerPoint- oder Mac-Host,
  keine echte Erkennung.
- Die sieben Originalkriterien von `aufnahme:20260922:gesamt-ocr` (Revision 2) sind im Wortlaut
  aus Bens Prüflesung übernommen (`HISTORIE/nacharbeit-1/BEN/STREAM.jsonl`), weil die Auftragsdateien
  von C01 außerhalb des Lesebereichs liegen (siehe `ABGLEICH-OCR-AUFTRAG.md`).
- L07 (Kopf-/Fußzeilen, Textfelder in DOCX) und die Gruppenbilder in L05 sind unbelegte Stellen,
  keine gemessenen Verluste.
