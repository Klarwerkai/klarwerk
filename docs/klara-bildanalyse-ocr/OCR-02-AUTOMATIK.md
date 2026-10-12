# OCR-02 · Bilder automatisch analysieren und Text erkennen

Auftrag `produkt:20261012:klara-bildanalyse-ocr-automatik`, Revision 1, Paket OCR-02. Aufbauend auf
OCR-01 ([`BESTAND.md`](./BESTAND.md), [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md)) und auf der
Erkennung aus gesamt-ocr (C01, `64e1768c`, im Hauptstand). Es gibt **keine zweite Engine**: gelesen
wird mit der vorhandenen Texterkennung W01 (`runImageOcr`, tesseract.js unter der eigenen CSP).

## Was geliefert ist

| Baustein | Datei | Inhalt |
| --- | --- | --- |
| Automatik (DOM-frei) | `apps/web/src/lib/bildAutomatik.ts` | Vorkommen je Bild mit Fundstelle, Inhaltskennung `sha256` (wie W16), Wiederverwendung, Frist je Bild, Höchstzahl je Quelle, Kennzeichnung unsicherer Stellen, ehrlicher Gesamtstatus |
| Eine Analyse je App | `apps/web/src/lib/bildAutomatikLauf.ts` | W01 hinter der Automatik; unveränderte Bilder werden über alle Dateieingänge wiedererkannt |
| Folie je Bild (L04) | `apps/web/src/lib/pptx.ts` | `imageSlides` (Folie je eingebettetem Bild) und `imagesNotEmbeddedBySlide` (nicht übernommene Bilder je Folie) |
| Wortsicherheit | `apps/web/src/lib/ocr.ts` | `woerter` mit Sicherheit aus tesseract.js 5 |
| Auslösung (L01) | `apps/web/src/pages/Capture.tsx`, `onExtractFile` | Einzelbild, `.pptx` und `.docx` im Dateiimport des Erfassens werden beim Einlesen gelesen, ohne Klick |
| Anzeige | `apps/web/src/components/BildBefundListe.tsx`, `apps/web/src/texte/bildautomatik.ts` | Befund je Bild mit „Folie N, Bild M" bzw. „Bild N", Status, erkanntem Text, unsicheren Stellen, Wiederverwendung; Gesamtstatus und Verluste (DE/EN/NL) |

### Verhalten

- **Auslösung.** Sobald eine Datei im Dateiimport eingelesen ist, startet das Lesen. Ein Einzelbild
  wird danach der Dateitext (wie früher nach dem Klick). Bei `.pptx`/`.docx` bleibt der Klartext
  unverändert; der Befund steht je Bild daneben. Der Knopf „Text im Bild erkennen (OCR)" bleibt als
  manueller Weg und nutzt dieselbe Analyse (kein Doppellauf, erneuter Versuch nach Fehlschlag).
- **Voreinstellung.** `BILD_AUTOMATIK_VOREINSTELLUNG = true`. Der Schalter unter Setup › Klara ist
  OCR-03 (L14) und noch nicht gebaut; bis dahin ist die Automatik immer an.
- **Fundstelle.** Quelle, Position in Dokumentreihenfolge, Anker `data-image-id`; bei PowerPoint
  Folie und Bild auf der Folie, Folienansicht-Bilder (W04) als „Folienansicht, Folie N".
- **Wiederverwendung.** Gleiche Bildbytes → vorhandener Befund ohne neue Erkennung, angezeigt als
  „unverändert — vorhandenes Ergebnis". Geänderte Bytes → neue Kennung, neue Erkennung; ein Befund
  gehört immer nur zu den Bytes, aus denen er stammt. Fehlschläge werden nicht gemerkt.
- **Grenzen sichtbar.** Zustände je Bild: läuft, gelesen, kein Text, fehlgeschlagen, nicht
  verfügbar, kein Zugriff, Zeitüberschreitung (90 s), nicht gelesen (Grenze 40 Bilder je Datei bzw.
  Automatik aus). Gesamtstatus „vollständig" nur, wenn jedes Bild gelesen ist, nichts verloren ging
  und keine Erfassungsgrenze greift; sonst „teilweise", „fehlgeschlagen", „nicht verfügbar".
  Nicht übernommene PowerPoint-Bilder stehen je Folie da, Word-Verluste als Zahl.
- **PowerPoint nie „vollständig".** Layout, Master, Diagramme, SmartArt und Notizen liest der
  PPTX-Leser nicht (L16). Jede PowerPoint-Quelle trägt deshalb diesen Hinweis und heißt höchstens
  „teilweise".
- **Unsichere Stellen.** Wörter unter 60 % Sicherheit erscheinen als `[?wort]`, unter 30 % als
  `[unleserlich]`. Es wird nichts ergänzt.
- **Original unverändert.** Gelesen wird aus der data-URL des Imports; Datei, Rumpf und Original-
  Anhang werden nicht verändert. Das Bild verlässt den Browser für die Erkennung nicht.

## Bewusst nicht in OCR-02 (offen, konkret)

| Punkt | Stand |
| --- | --- |
| Bildanhang im Formular („Bilder hochladen") | bleibt der manuelle Klickweg aus gesamt-ocr K3 („nur auf ausdrücklichen Klick"), siehe [`ABGLEICH-OCR-AUFTRAG.md`](./ABGLEICH-OCR-AUFTRAG.md) Abschnitt 3. Die dortigen Prüfstände (`tests/capture/gesamt-ocr-interview-kontext-mounted.test.tsx` I1/I2) sind unverändert |
| Bildinhalt (Diagramme, bildhafte Tabellen) über ein Modell (W02) | nicht automatisch: ein automatischer Modellaufruf je Bild ist ein neuer Datenweg und braucht die Vertraulichkeitsentscheidung. Erkannt wird der Text; Tabellenstruktur nur so weit, wie die Zeilen der Erkennung sie tragen |
| Handschrift | die Engine (tesseract, `deu+eng`) ist für Druckschrift trainiert; lesbare Handschrift wird bestenfalls teilweise erkannt und dann als unsicher gekennzeichnet. Nicht gemessen |
| PDF (Q04, L06) | eingebettete Bilder und Scanseiten werden nicht gelesen |
| Entwürfe aus Word-Add-in (H02) und Browser-Erweiterung (H04), Bilder im Editor (Q06), Office-Anhänge im Artikel (H06, L17) | nicht ausgelöst; dort bleiben Bilder ungelesen |
| PowerPoint-Add-in (H03), Mac-Host (H05) | gibt es nicht |
| Nutzung in Klaras Antworten, Status in Antworten, Setup-Schalter | OCR-03 |
| Kundenabnahme mit echten Dokumenten | OCR-04 bzw. Pilot; die Browserprobe nutzt fiktive Bilder |

## Prüfstände

| Datei | Art | Kriterien |
| --- | --- | --- |
| `tests/klara-bildanalyse-ocr/bildautomatik.test.ts` | Unit, echte PPTX-Importkette, Engine gestellt | K1–K5 |
| `tests/klara-bildanalyse-ocr/automatik-dateiimport-mounted.test.tsx` | gemountete Erfassungsfläche, Engine gestellt | K1, K5 |
| `tests-smoke/klara-bildautomatik-browser.spec.ts` | Browser, echte Engine, fiktive Bilder | K1–K5 |
