# OCR-02 · Bilder automatisch analysieren und Text erkennen

Auftrag `produkt:20261012:klara-bildanalyse-ocr-automatik`, Revision 1, Paket OCR-02. Aufbauend auf
OCR-01 ([`BESTAND.md`](./BESTAND.md), [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md)) und auf der
Erkennung aus gesamt-ocr (C01, `64e1768c`, im Hauptstand). Es gibt **keine zweite Engine** und
**keinen neuen Datenweg**: Text über die vorhandene Texterkennung W01 (`runImageOcr`, tesseract.js
unter der eigenen CSP), Bildinhalt über den vorhandenen Beschreibungsweg W02
(`/api/reasoner/describe`) mit der Herkunft und Vertraulichkeitsregel der jeweiligen Fläche.

## Eingänge, an denen ohne Klick gelesen wird

| Eingang | Quelle/Host | Wo | Text | Bildinhalt (W02) |
| --- | --- | --- | --- | --- |
| Dateiimport im Erfassen: Bild, `.pptx`, `.docx` | Q01–Q03, H01 | `pages/Capture.tsx` `onExtractFile` | ja | über die Herkunft des Entwurfs |
| Bildanhang im Erfassen („Bilder hochladen“, Anhang, Text-aus-Datei mit Bild) | Q01, H01 | `pages/Capture.tsx` `addImage` | ja; **Übernahme** in Aussage/Rohtext bleibt der Klick „OCR → Text“ | über die Herkunft des Entwurfs |
| Bilder im Text jedes Editors (Erfassen, Blatt, Studio, Artikel, gemeinsamer Entwurf) — eingefügt, abgelegt, aus „Klara in Word“ (H02) oder der Browser-Erweiterung (H04) als Entwurf übernommen, gespeicherte Objektspeicher-Bilder | Q03, Q05, Q06 | `components/BildBefundeImRumpf.tsx` in `RichTextEditor` | ja, sofort bei jeder Bildänderung (neu, ersetzt, entfernt); der alte Befund wird dabei sofort durch den laufenden Stand ersetzt. Reine Texteingabe startet nichts neu und schiebt nichts auf | über die Herkunft der Fläche (`useImageDescribe`) |
| Office im Artikel: angehängte bzw. als neue Fassung übernommene `.pptx`/`.docx` | Q02, Q03, H06 (L17) | `components/bibliothek/OfficeBildBefunde.tsx` in `OfficeImArtikel` | ja, je Fassung | über die Herkunft des Artikels, sonst „nicht angebunden“ |

Der manuelle Weg bleibt: Der Knopf „OCR → Text“ am Bildanhang übernimmt beim ersten Klick den
automatischen Befund (kein zweiter Lauf), jeder weitere Klick erkennt ausdrücklich neu. Damit gilt aus
gesamt-ocr weiter: **ohne Klick gelangt kein Bildtext in Aussage, Rohtext oder Interview**
(`tests/capture/gesamt-ocr-interview-kontext-mounted.test.tsx` I1/I2). Dass das Bild selbst erst nach
einem Klick erkannt wird („nie von selbst“, K3), gilt nicht mehr: Bens Befund (Nacharbeit 3) und der
neuere Originalauftrag („sofort automatisch mitlesen“) schließen diese Ausnahme für bereitgestellte
Bilder aus.

## Was der Befund je Bild enthält

- **Fundstelle**: Quelle, Position in Dokumentreihenfolge, Anker `data-image-id`; bei PowerPoint Folie
  und Bild auf der Folie; Folienansicht-Bilder (W04); bei Bildanhängen der Dateiname.
- **Text** mit Kennzeichnung: unter 60 % Sicherheit `[?wort]`, unter 30 % `[unleserlich]`. Nichts
  wird ergänzt.
- **Tabelle**, nur wenn zuverlässig bestimmbar: mindestens zwei Zeilen mit mindestens zwei Zellen,
  deren Spalten an linker, rechter oder mittlerer Kante übereinanderstehen (aus den Wortrahmen der
  Engine). Sonst keine Tabelle.
- **Bildinhalt** (Diagramm, Foto, bildhafte Tabelle) über W02 — oder der Grund, warum er fehlt:
  „nicht zulässig“ (Einstufung schließt das Modell aus), „nicht verfügbar“ (kein Modell),
  „fehlgeschlagen“, „nicht angebunden“.
- **Wiederverwendung**: gleiche Bildbytes (`sha256`) → vorhandener Befund ohne neue Erkennung und ohne
  neue Beschreibung; geänderte Bytes (auch eine neue Office-Fassung) → neue Analyse. Fehlschläge und
  „nicht zulässig“ werden nicht gemerkt (nach Umstufung wird neu gefragt).
- **Status**: läuft, gelesen, kein Text, fehlgeschlagen, nicht verfügbar, kein Zugriff,
  Zeitüberschreitung (90 s je Erkennung bzw. Beschreibung), nicht gelesen (Grenze 40 Bilder je
  Quelle).
- **Ladefrist** (30 s): Lesezugriffe auf gespeicherte Bilder und Office-Anhänge sind einschließlich
  Antwortkörper begrenzt und werden danach abgebrochen. Ein hängendes Bild heißt „Zeitüberschreitung“,
  die übrigen Bilder laufen weiter; ein hängender Anhang heißt „fehlgeschlagen“ mit dem Hinweis auf
  die Ladefrist. Office-Anhänge stehen schon vor dem Laden sichtbar als „wird geladen“ da.

**„Vollständig“** heißt eine Quelle nur, wenn für jedes Bild Text UND Bildinhalt vorliegen, kein Bild
verloren ging und keine Erfassungsgrenze greift. Sonst „teilweise“, „fehlgeschlagen“ oder „nicht
verfügbar“. Eine PowerPoint-Quelle heißt nie „vollständig“ (Layout, Master, Diagramme, SmartArt,
Notizen werden nicht erfasst, L16).

**Original unverändert**: gelesen wird aus der data-URL bzw. dem Objektspeicher (lesend); weder Datei,
Rumpf noch Anhang/Fassung werden geschrieben.

## Grenzen (offen, konkret)

| Punkt | Stand |
| --- | --- |
| Handschrift | Nachweis über eine kontrollierte, im Browser gezeichnete Druckhandschrift-Vorlage (freihändige Striche, Großbuchstaben, Ziffern) mit bekanntem Inhalt, dazu eine unleserliche Gekritzel-Vorlage (`tests-smoke/klara-bildautomatik-browser.spec.ts`, zweiter Fall). Eine echte Schriftprobe eines Menschen liegt nicht vor; Schreibschrift ist nicht gemessen |
| Tabellenstruktur | aus Wortrahmen ausgerichteter Spalten; verbundene Zellen, mehrzeilige Zellen und Tabellen mit Linien als einziger Struktur werden nicht rekonstruiert (dann keine Tabelle, nur Text) |
| Bildinhalt | hängt an einem konfigurierten, zulässigen Vision-Modell; ohne dieses ist jede Quelle „teilweise“ |
| PDF (Q04, L06) | eingebettete Bilder und Scanseiten werden nicht gelesen |
| Excel (Q08) | kein Leser, im Artikel nichts behauptet |
| PowerPoint-Add-in (H03), Mac-Host (H05) | gibt es nicht |
| Browser-Erweiterung/Word-Add-in selbst | dort keine Analyse; gelesen wird, sobald der Entwurf in einem Editor der Web-App geöffnet ist |
| Nutzung in Klaras Antworten, Setup-Schalter | OCR-03, siehe [`OCR-03-KONTEXT-SETUP.md`](./OCR-03-KONTEXT-SETUP.md) |
| Kundenabnahme mit echten Dokumenten | OCR-04 bzw. Pilot |

## Prüfstände

| Datei | Art | Kriterien |
| --- | --- | --- |
| `tests/klara-bildanalyse-ocr/bildautomatik.test.ts` | Unit, echte PPTX-Importkette, Engine und W02 gestellt | K1–K5 |
| `tests/klara-bildanalyse-ocr/automatik-dateiimport-mounted.test.tsx` | gemountete Erfassungsfläche, Dateiimport | K1, K5 |
| `tests/klara-bildanalyse-ocr/rumpf-bilder-mounted.test.tsx` | gemountete Editor-Automatik, Objektspeicher, W02-Zustände, Bildtausch während fortgesetzter Eingabe | K1, K3, K4, K5 |
| `tests/klara-bildanalyse-ocr/office-anhang.test.tsx` | Office-Anhang über Objektspeicher und `readPptxRich`, neue Fassung, Ladefrist und Anfangsstatus | K2, K3, K4, K5 |
| `tests/capture/gesamt-ocr-interview-kontext-mounted.test.tsx` | Bildanhang: automatisch gelesen, Übernahme nur auf Klick | K1 |
| `tests-smoke/klara-bildautomatik-browser.spec.ts` | Browser, echte Engine, fiktive Vorlagen (PPTX, Einzelbild, Handschrift, Gekritzel, Tabelle) | K1–K5 |
