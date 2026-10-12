# Klara · Bilder automatisch lesen · Integrationsplan für OCR-02 bis OCR-04

Grundlage: [`BESTAND.md`](./BESTAND.md), [`fundstellen.json`](./fundstellen.json) und
[`ABGLEICH-OCR-AUFTRAG.md`](./ABGLEICH-OCR-AUFTRAG.md). Der Plan setzt **ausschließlich** erfasste
Bausteine voraus (IDs H·Q·W·C·L). `tests/klara-bildanalyse-ocr/fundstellen.test.ts` prüft, dass
jede hier genannte ID im Bestand steht. Es entsteht keine zweite Erkennungsengine, kein neuer Host,
kein neuer Bildschirm- oder Postfachzugriff und keine erweiterte Datenfreigabe.

## 0. Reihenfolge und Abhängigkeiten

1. **C01 zuerst regulär abschließen.** Erst C01 macht W01 in der Auslieferung lauffähig (L02).
   OCR-02 beginnt auf einem Hauptstand, der C01 enthält, oder kennt dessen Abbruch. Ohne C01 meldet
   die Automatik für W01 ehrlich „nicht verfügbar“ und behauptet nichts.
2. **Unabhängige Quellen nicht an fehlende Hosts binden.** OCR-02 und OCR-03 laufen über H01 für
   Q01–Q04 und Q06, unabhängig von H03 und H05. Inhalte aus H02 und H04 werden als Entwurf
   bereitgestellt und dort genauso behandelt (Schritt 1.1).
3. **Setup-Auftrag abstimmen.** Der Schalter (L14) gehört in den Bereich „Klara“ aus dem
   Setup-Auftrag (AA-02, `/profil`). Ist AA-02 noch nicht geliefert, kommt der Schalter in dieselbe
   Detailkarte, die AA-02 nutzt. Ein zweiter Setup-Ort entsteht nicht.

## 1. OCR-02 · Automatisch Bilder analysieren und Text erkennen

### 1.1 Auslösung an den vorhandenen Eingängen (L01)

Die Analyse hängt an die Stellen an, an denen ein Bild heute verfügbar wird:

| Eingang | Quelle | Auslösung |
| --- | --- | --- |
| Dateiimport im Erfassen nach W14 | Q01 | Bild direkt an W01 |
| nach W03 (PPTX) | Q02 | jedes übernommene `<figure>` an W01 |
| nach W05 (DOCX, auch aus H02 über W08) | Q03 | jedes übernommene `<figure>` an W01 |
| nach W06 (PDF) | Q04 | Seiten ohne Textlayer über W07 als Bild an W01 (schließt L06 für Scans) |
| Einfügen und Ablegen im Editor (W15) | Q06 | neues Bild an W01 |
| Öffnen eines Entwurfs aus H02 oder H04 | Q03, Q05 | noch nicht analysierte Bilder an W01 |

Die Regel „Nur auf explizite Nutzeraktion aufrufen.“ an W01 wird für genau diese Eingänge durch
„Schalter an (Voreinstellung) oder ausdrückliche Aktion“ ersetzt. Der bestehende Klick bleibt als
manueller Weg erhalten.

W01 läuft im Browser. Bilder in einem Entwurf aus H02 oder H04, der noch nie in H01 geöffnet wurde,
sind deshalb **nicht analysiert** und werden so ausgewiesen (Status aus 1.3). Eine Erkennung auf dem
Server wäre ein neuer Engine-Ort und braucht eine eigene Entscheidung.

### 1.2 Bildbefund je Vorkommen mit Fundstelle

Je Bild ein Befund mit:

- `imageId`: der vorhandene `data-image-id`,
- `inhaltskennung`: `sha256` über W16,
- Fundstelle:
  - Folie (Q02): beim Lesen in W03 bekannt (`slideNumber`). W03 gibt dazu eine Liste
    `{ imageId, folie }` und je Folie die verworfenen Bilder aus. Das schließt L04,
  - Seite (Q04),
  - Reihenfolge (Q03, Q06),
  - Seiten- und Bildadresse (Q05),
- Status `running` / `success` / `failed` / `unavailable` aus W01, dazu `teilweise` für Quellen
  mit Bildbilanz-Verlust (W03, W05),
- erkannter Text und unsichere Stellen. Leerer oder unsicherer Text wird als solcher geführt und
  nicht ergänzt.

Für die Folienansicht (W04, L15) gilt: Ist sie eingeschaltet, ist jedes Folienbild (`-s<N>`) ein
eigenes Vorkommen mit Foliennummer. Das deckt Diagramme, Gruppen und Hintergründe ab, die W03 nicht
liest (L05). Ist sie aus, bleibt L05 offen und wird je Folie als „nicht gelesen“ ausgewiesen.

### 1.3 Wiederverwendung und Neuauswertung

Gleiche `inhaltskennung` heißt gleicher Befund, ohne neue Analyse. Ein geändertes Bild bekommt eine
neue Kennung, also eine neue Analyse, und der alte Befund gilt nicht mehr als aktuell. Die Bindung
an Vorkommen und Kennung liefert W16 bereits. Originaldatei und Bild bleiben unverändert: Der Befund
liegt neben dem Rumpf, nicht im Bild.

### 1.4 Bildinhalt (Diagramme, bildhafte Tabellen)

Der Bildinhalt kommt über W02 (`/api/reasoner/describe`), mit der vorhandenen
Vertraulichkeitsregel und dem vorhandenen Kontext. Der Text aus W01 hat Vorrang. W02 ergänzt nur, wo
ein Modell verfügbar und zulässig ist. Sonst steht im Befund ehrlich „Bildinhalt nicht analysiert“.

## 2. OCR-03 · Erkenntnisse in Klara nutzen und Automatik im Setup steuern

- **Kontext (L08).** Der Bildbefund geht als eigenes Suchfeld neben `captionTexts` in den
  vorhandenen Antwortkontext W10 ein, auf demselben Schreibpfad (anlegen, überarbeiten,
  nachtragen). Klara nennt dazu Bild und Folie bzw. Seite aus 1.2. Kein zweiter Kontextweg.
- **Status.** Laufende, teilweise und fehlgeschlagene Befunde stehen sichtbar am Objekt. Klara
  antwortet bei offenen Befunden nicht so, als hätte sie alles gelesen.
- **Setup (L14).** Schalter „Bilder automatisch analysieren und Text erkennen“, Voreinstellung an,
  gespeichert je Konto in der vorhandenen Ablage W17. Aus heißt: keine neue automatische Auslösung
  aus 1.1. Vorhandene Befunde bleiben lesbar und als solche gekennzeichnet; laufende Analysen
  laufen zu Ende oder werden sichtbar abgebrochen. Rollen und Quellberechtigungen bleiben, wie sie
  sind: Befunde gehören zu ihrem Objekt und erben dessen Sichtbarkeit.
- **Klara-Figur und Word (L09, L10).** Bilder an die Figur ablegen (W11) und Bilder in der Frage aus
  Word (W12) sind neue Eingänge. Sie gehören nicht zu OCR-03 und bleiben offen, bis sie gesondert
  beauftragt sind.

## 3. OCR-04 · Echte Wege prüfen

- Vorhandene Prüfstände wiederverwenden: die Bildbilanz der PPTX-Quittung (`tests/pptx-importquittung/`),
  den durchgängigen PPTX-Weg (`tests/d3-dateien-durchgaengig/`) und die technische Probe aus C01
  (`tests-smoke/ocr-technische-probe-browser.spec.ts`).
- Neue Fixtures nur dort, wo die Quelle sie verlangt: Screenshot, Textbild, gedrehter Text,
  schwacher Kontrast, Handschrift, bildhafte Tabelle, PPTX mit mehreren Bildern.
- Echter Host: H01 mit Q01 und Q02 ist sofort prüfbar. H02 braucht einen echten Word-Host. H03 und H05
  sind nicht prüfbar, weil es sie nicht gibt, und bleiben offen.

## 4. Hostzugänge, wahrheitsgemäß

| Host | in OCR-02/03 | Begründung |
| --- | --- | --- |
| H01 | ja | alle Eingänge aus 1.1 |
| H02 | über den Entwurf | Bilder kommen über W08 und W05. Die Klara-Frage in Word bleibt Text (L10) |
| H03 | nein, **fehlt** | Es gibt kein PowerPoint-Add-in (L11). PowerPoint gilt nur als Datei (Q02) |
| H04 | über den Entwurf | bis zu 8 Bilder (L13). In der Erweiterung selbst keine Analyse |
| H05 | nein, **fehlt** | kein nativer Mac-Host (L12), kein Bildschirmzugriff beauftragt |
| H06 | später | Anhänge im Artikel bringen keine Rumpfbilder mit. Eine Analyse der Anhangsbilder bräuchte W03 bzw. W05 am Anhang und ist nicht Teil von OCR-02 |
