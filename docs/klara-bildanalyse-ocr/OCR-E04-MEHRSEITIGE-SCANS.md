# OCR-E04 · Vollständig gescannte, mehrseitige Dokumente automatisch lesen

> Aktueller Stand 20.10.2026: Die erhaltene Erweiterung ist auf `a5023125` mit der
> tatsächlich gelieferten E01/E02-Basis `01378570` integriert. Für den gemeinsamen
> direkten Kandidaten gelten [Integration und Nachweise](OCR-C-INTEGRATION-20261020.md).
> Die folgenden Nacharbeitsangaben dokumentieren den erhaltenen historischen Stand;
> frühere Aussagen zur fehlenden Elternlieferung sind überholt. Keine Veröffentlichung
> und keine Gesamt-Hostabnahme werden damit behauptet.

Auftrag `produkt:20261012:klara-ocr-mehrseitige-scans`, Revision 1, ausschließlich OCR-E04. Quelle
`20261012-peter-sechs-ergaenzungen-v1`. Basis `ef7766dc` (1.0.0-beta.1.989, enthält die
Basisreparatur 58→53 in `lib/ocr.ts`).

**Stand: keine Lieferung.** Die Elternlieferung OCR-E01/E02
(`produkt:20261012:klara-ocr-fundstellen-korrekturen`, main 01378570, 1.0.0-beta.1.991) ist im
Arbeitsbaum zusammengeführt (Nacharbeit 7); die Konflikte in `BildBefundListe.tsx`,
`bildAutomatik.ts`, `Capture.tsx` und im Smoke-Mengenmanifest sind mit beiden fachlichen Änderungen
aufgelöst. Die Prüfung am zusammengeführten Kandidaten steht aus (siehe Abschnitt 4).

## 1. Was gebaut ist

Bis hier las der Dateiimport bei einer PDF nur die Textebene (BESTAND L06): eine gescannte Seite
ergab keinen Text, eine reine Scan-PDF wurde mit „ein gescanntes PDF ohne Textebene wird noch
nicht unterstützt“ abgelehnt.

| Baustein | Datei | Wirkung |
| --- | --- | --- |
| Seitenarten | `apps/web/src/lib/pdf.ts` | `extractPdfDocument` liefert zusätzlich `totalPages` und je Seite `pageImages` (zeichnet die Seite ein Bild? über `getOperatorList`, nur wenn die Engine Bildbefehle kennt). |
| Engine | `apps/web/src/lib/files.ts` | `pdfEngine()` nennt die Bildbefehle von pdfjs. `pdfSeitenZeichner(file)` zeichnet Seiten mit derselben Engine als PNG im Speicher (etwa 240 dpi bei A4). Die Datei und ihr Original-Anhang bleiben unverändert. |
| Kern | `apps/web/src/lib/pdfScanSeiten.ts` (DOM-frei) | Plan je Seite: `textebene`, `bildseite` (Textebene unter 20 Zeichen), `gemischt` (Text und Bild, auch eine kurze Überschrift über einem Scan). Eine vorhandene Textebene bleibt immer erhalten (Nacharbeit 1: vorher fiel eine kurze Textebene über einem Scan still weg). Ist der Bildanteil einer Seite nicht bestimmbar (`pageImages` `null`, z. B. Fehler in `getOperatorList` oder keine bekannten Bildbefehle), wird sie wie eine gemischte Seite gelesen; nur `false` gilt als bildfrei (Nacharbeit 2). Der Doppelvergleich behält Vorzeichen, Vergleichsoperatoren und Zahltrenner: „1500“/„-1500“, „<1500“/„>1500“, „4,5“/„45“ sind verschieden (Nacharbeit 2). Ein abgesetztes Vorzeichen bzw. ein abgesetzter Operator gehört zu seiner Zahl: „- 1500“ = „-1500“, „< 1500“ = „<1500“, aber „- 1500“ ≠ „1500“ (Nacharbeit 3). Verglichen werden ganze Wortfolgen; geht an einem Rand der Fundstelle die Zahl mit einer weiteren Zifferngruppe weiter (Leerraum als Tausendertrenner, „1 500 €“ gegen erkanntes „500 €“), ist die Gruppierung unklar und es wird nicht dedupliziert — lieber eine sichtbare Doppelung als ein gelöschter Wert (Nacharbeit 4). Bild- und gemischte Seiten werden über die vorhandene Bildanalyse gelesen (`createBildAnalyse`, W01, keine zweite Engine, kein Modell). Eine erkannte Zeile, die wörtlich schon in der Textebene derselben Seite steht, kommt nicht doppelt in den Text (`doppelt` am Befund). Status je Seite und für die PDF; fehlende Seiten über `MAX_PDF_PAGES` sind ein Hinweis und zählen als offen. |
| Anzeige | `apps/web/src/components/PdfSeitenListe.tsx`, `texte/pdfscan.ts` | Lesestand Seite für Seite: „Seite N · Textebene“ bzw. „Seite N · gescannte Seite · Text erkannt / Lesen fehlgeschlagen / …“, Gesamtstatus mit gelesenen von allen Seiten. DE/EN/NL. |
| Klaras Kontext | `apps/web/src/lib/klaraBildKontext.ts`, `components/BildBefundListe.tsx` | Jede Seite steht mit Seitenzahl im Kontext (`[datei.pdf · Seite 3, erkannt]`). Fehlende und fehlgeschlagene Seiten stehen als offen darin; die Anweisung an Klara nennt die Unvollständigkeit. Die deterministischen Fundstellen einer Frage tragen die Seite. |
| Nutzerweg | `apps/web/src/pages/Capture.tsx` | Erfassen › Datei: eine PDF mit Bild- oder gemischten Seiten wird ohne Klick gelesen, solange Setup › Klara „Bilder automatisch analysieren“ an ist (dieselbe Lage, derselbe Laufzähler, derselbe Kontowechsel-Schutz wie OCR-02/03). Danach ist der Dateitext die ganze PDF in Seitenreihenfolge, sofern niemand ihn inzwischen geändert hat. Eine reine Text-PDF bleibt beim bisherigen Weg. |

Der gemeinsame Seitenlauf der weiteren Eingänge (`lib/pdfSeitenLauf.ts`) gehört dem Konto, unter
dem er begann: wechselt es, startet keine weitere Seite, kein Zwischenstand wird mehr gemeldet und
das Ergebnis wird verworfen (`LAUF_VERWORFEN`, Nacharbeit 10) — wie im Dateiimport. Bei „Text aus
Datei einfügen“ gilt das für die GANZE Auswahl (Nacharbeit 11): Konto und Formularstand werden vor
dem ersten Lesen festgehalten; wechselt das Konto oder wird das Formular verworfen, endet die
Restschlange, und vor jeder Übernahme wird erneut geprüft. Eine weitere Auswahl bricht einen
laufenden Vorgang nicht ab; jeder Vorgang räumt nur seine eigenen Seitenstände.

Unverändert: die standardmäßig aktive, abschaltbare Automatik (Setup › Klara); ausgeschaltet wird
keine Seite neu erkannt, die Textebene bleibt nutzbar und „aus“ steht sichtbar da.

## 2. Prüfungen

| Datei | Art | Inhalt |
| --- | --- | --- |
| `tests/klara-ocr-mehrseitig/scan-pdf.ts` | Fixture | Kontrollierte PDF 1.4 mit bekanntem Inhalt: Textzeilen (Textebene) und/oder Bild (JPEG oder Graustufenraster) je Seite. Fiktive Inhalte. |
| `tests/klara-ocr-mehrseitig/pdf-scan-seiten.test.ts` | Vitest (Node, echte pdfjs-Engine) | S1 Seitenarten aus der echten Engine; S2 mehrseitiger Scan vollständig in Reihenfolge; S3 erste/letzte Seite mit richtiger Seitenzahl; S4 gemischt ohne Auslassung und ohne Doppel; S5 Fehler und Zeitüberschreitung je Seite; S6 aus, unbekannt, fehlende Seiten; S7 Wiederverwendung und Abbruch. Ersetzt: nur Seitenzeichnen und Erkennung. |
| `tests/klara-ocr-mehrseitig/scan-dateiimport-mounted.test.tsx` | Vitest (jsdom, echte Erfassungsfläche) | M1–M3 am Dateiimport: ohne Klick gelesen, Klara-Fundstellen „Seite 1“/„Seite 4“, gemischte Datei, Fehler auf einer Seite. Ersetzt: PDF-Lesen, Seitenzeichnen, Erkennung. |
| `tests-smoke/klara-ocr-mehrseitige-scans-browser.spec.ts` | Playwright (Browser) | Echter Dateiimport, echte pdfjs-Engine, echte Texterkennung: drei Seiten (Scan, Text, gemischt), Doppelüberschrift einmal, Fundstellen Seite 1 und Seite 3 mit echt erkanntem Text. |

Der Fall ist im Smoke-Mengenmanifest (Version 64) je Projekt chromium, firefox und webkit
nachgetragen.

## 3. Hosts und Formate

| Host / Format | Stand |
| --- | --- |
| Web-App, Erfassen › Datei (H01), PDF | angebunden, Browserprobe vorbereitet |
| Web-App, „Text aus Datei einfügen“ (Erfassen, `onDocs`) | angebunden (Nacharbeit 8, `lib/pdfSeitenLauf.ts`): gelesene Seiten in Seitenreihenfolge eingefügt, Teilstand in der Meldung, Stand je Seite während und nach dem Lesen sichtbar (Nacharbeit 10); gemounteter Test, keine Browserprobe |
| Web-App, „Aus Dokument ergänzen“ (`BodyExtractPanel`, Erfassen und Editor) | angebunden (Nacharbeit 8): Seitenlauf vor der Leerprüfung, Lesestand je Seite sichtbar, Original unverändert; gemounteter Test, keine Browserprobe |
| Web-App, „Fragen an ein Dokument“ (`/fragen/dokument`, R-0347) | angebunden (Nacharbeit 8): Fundstellen „Seite N, Absatz M“ aus Textebene und Erkennung, Lesestand je Seite sichtbar; gemounteter Test, keine Browserprobe |
| Office im Artikel (H06), Word-Add-in (H02), Browser-Erweiterung (H04) | kein PDF-Weg in diesen Hosts; nicht geprüft |
| PowerPoint-Add-in (H03), Mac (H05) | nicht vorhanden (BESTAND) |
| Gescannte Seiten als TIFF/JBIG2/CCITT in der PDF | Zeichnen übernimmt pdfjs; nicht mit eigener Fixture geprüft |
| Mehrseitige TIFF, Scans als DOCX/PPTX | nicht Teil dieses Erfassungswegs |

Ein formulierter Modellantworttext zu Seitenfragen ist nicht vorausgesetzt und nicht belegt; die
Fundstellen werden deterministisch bestimmt.

## 4. Offen vor Lieferung

1. Elternlieferung OCR-E01/E02 ist zusammengeführt (Nacharbeit 7); E04- und E01/E02-Prüfungen am
   zusammengeführten Kandidaten stehen aus. `leseDateiSeiten` führt jetzt dieselbe
   `korrekturQuelle` wie `leseDateiBilder`; `PdfSeitenListe` bietet für erkannte PDF-Seiten weder
   Fundstelle am Original (E01) noch Berichtigung (E02) — ob gescannte PDF-Seiten berichtigbar sein
   sollen, ist nicht Teil von OCR-E04 und nicht entschieden.
2. Ausführung der Prüfungen durch den Cloud-Lauf und unabhängige Prüfung durch Ben.
3. Echte menschliche Bedienung mit einem realen gescannten Dokument (z. B. Pedis Handbuch über
   50 MB) ist nicht belegt; die Größenkante des PDF-Wegs gilt unverändert.
