# SCRUM-407 · Inventur: Bedienelemente im Erfassen-Weg (Vorarbeit, kein Code)

> [Cloud-Worker], 03.07.2026 · Basis: Quellcode-Stand v0.9.22-beta (Commit b543574).
> Schwesterdokument zu `SCRUM-406-INVENTUR-PRUEFBEREICH.md`. Je Element: Ort, HelpTip-Bestand,
> und was der Hilfetext erklären muss (Was? · Wann? · Was passiert danach — und was NICHT
> automatisch?). Ticket-Vorgabe beachtet: **keine Doppelungen zu SCRUM-404** — dessen ?-Hilfen
> sind hier als Bestand markiert und bleiben unangetastet.

## Bestand: vorhandene ?-HelpTips im Erfassen-Weg (dank SCRUM-390/404 schon ordentlich)

- `Capture.tsx`: Datei-Modus-Suchfrage (~1405) · Kategorie (~1555) · Prüf-Anzahl (~1568) ·
  Struktur-Daten-Aufklappung (~2109) · Helfer-Aufklappung (~2155).
- `AiAssistBox.tsx` (~108): **alle KI-Presets** inkl. „Formatieren" (SCRUM-404a).
- `BodyTemplateChooser.tsx` (~62, ~99): **alle 6 Strukturvorlagen** + „Vorlage einsetzen/anfügen" (SCRUM-404c/d).

Damit ist die **Wissensseite/Studio weitgehend abgedeckt** — die Lücken liegen am Einstieg,
in den Erzähl-Modi und im Expertenformular.

## A · Einstieg & Modus-Wahl (`Capture.tsx` ~1090–1230, `lib/captureEntry.ts`)

| # | Element | HelpTip | Hilfetext muss erklären |
|---|---|---|---|
| A1 | Erstnutzer-Einführung (aufklappbar, pro Browser gemerkt) | ✗ | Der 3-Schritte-Weg Erzählen → Wissensseite → Einreichen; jederzeit wieder aufklappbar |
| A2 | **Modus-Chips: Freitext · Diktat · Interview · Aus Datei** (~1166) | ✗ | Je Modus: für wen/wann geeignet; alle führen zum selben Entwurf — nichts geht verloren beim Wechsel |
| A3 | Expertenpfad-Toggle „Formular direkt" + Hinweis + Rückweg | ✗ | Gleiche Felder wie der geführte Weg, kein Extra-Feature; Rückweg jederzeit |
| A4 | „Entwurf fortsetzen" (resume) | ✗ | Woher der Entwurf kommt (lokal gesichert); was Fortsetzen lädt |
| A5 | Entwurf verwerfen (Papierkorb ~1096, mit Inline-Bestätigung) | ✗ | Verwirft nur den lokalen Entwurf, keine gespeicherten KOs |
| A6 | „Beispiel laden" | ✗ | Füllt ein Demo-Beispiel zum Ausprobieren; überschreibt aktuelle Eingaben |
| A7 | Wissenslücken-Kontext (gapContext/gapDraft…, Einstieg aus „Fragen") | ✗ | Warum Frage/Erfahrung vorausgefüllt sind (Lücken-Rettung) |

## B · Erzähl-Modi (~1223–1460)

| # | Element | HelpTip | Hilfetext muss erklären |
|---|---|---|---|
| B1 | Freitext-Feld (rawPlaceholder) | ✗ | Roh erzählen reicht — Struktur macht der nächste Schritt (KI schlägt vor, Mensch übernimmt) |
| B2 | **Diktat Start/Stopp** (+ „nicht unterstützt"-Hinweis) | ✗ | Browser-Spracherkennung, lokal ausgelöst; ehrlicher Hinweis ohne Support |
| B3 | Upload beim Erzählen (wizard.upload) + OCR (ocr*) + Video-Transkription (video*) | ✗ | Was mit Datei/Bild/Video passiert (Textübernahme, OCR-Grenzen, Transkriptions-Key nötig) |
| B4 | **Interview**: Frage + „Denkt nach…", 🔊 Vorlesen/Stopp (SCRUM-403), Antwortfeld + Mic, „Senden", „Interview abschließen" | ✗ | KI fragt gezielt nach; Antworten werden erst am Ende zum Entwurf; Vorlesen nur auf Klick; violettes Reasoner-Badge erklären |
| B5 | **Aus Datei**: Upload → Suchfrage (✓ HelpTip) → „Punkte extrahieren" → **Punkteliste mit Checkboxen** → Übernahme ODER **Experten-Suchauftrag** | teils ✓ | Checkboxen: nur AUSGEWÄHLTE Punkte werden Entwurf (G-2: jeder Punkt mit wörtlicher Belegstelle, nichts erfunden); Suchauftrag = ehrliche Alternative ohne KI-Extrakt |

## C · Wissensseite / Studio (refine, ~2040–2290) — SCRUM-404-Bestand respektieren

| # | Element | HelpTip | Hilfetext muss erklären |
|---|---|---|---|
| C1 | Schritt-Leiste (Erzählen → Wissensseite → Einreichen) + „Zurück" | ✗ | Zurück verliert nichts; Chips zeigen Stand |
| C2 | Titel-Feld | ✗ | Guter Titel = auffindbar in Bibliothek/Antworten |
| C3 | Dokument-Editor: Formatier-Knöpfe, **Vorschau-Knopf mit Badge** (SCRUM-404b) | ✗ (Vorschau seit 404 selbsterklärender) | Kurz: Vorschau = Leseansicht, Knöpfe verschwinden bewusst |
| C4 | ✨ KI-Palette (Presets + freie Anweisung) | ✓ (404a) | Bestand — nicht anfassen |
| C5 | Strukturvorlagen + einsetzen/anfügen | ✓ (404c/d) | Bestand — nicht anfassen |
| C6 | Struktur-Daten (Kernaussage/Bedingungen/Maßnahmen, aufklappbar) | ✓ (Aufklapper) | Felder EINZELN ohne Hilfe: was gehört in Bedingungen vs. Maßnahmen |
| C7 | Helfer (Vorlagen/Hinweise/Anhang-Kontext/Qualität, aufklappbar) | ✓ (Aufklapper) | ggf. Feinschliff |
| C8 | **Verwerfen** (discardQ/Keep/Yes) | ✗ | Verwirft den ganzen Entwurf; Unterschied zu „Zurück" |
| C9 | „Entwurf speichern" | ✗ | Lokal gesichert, noch NICHT eingereicht, niemand sieht es |
| C10 | „Prüfen & einreichen →" | ✗ | Danach Peer-Prüfung (Quorum), nichts wird automatisch validiert |

## D · Erweiterte Details (~1500–1720, `captureAdvancedFields.ts`)

| # | Element | HelpTip | Hilfetext muss erklären |
|---|---|---|---|
| D1 | Aufklapper „Erweiterte Details" + „X ausgefüllt"-Badge | ✗ | Alles optional; warum es sich trotzdem lohnt (Auffindbarkeit, Prüf-Steuerung) |
| D2 | Kategorie | ✓ | Bestand |
| D3 | Anlage/Asset (fAsset) | ✗ | Kopplung an Anlage/Objekt; Bezug zur Anlagen-Kopplung im KO-Detail |
| D4 | Prüf-Anzahl (fRevalidation) | ✓ | Bestand |
| D5 | Schlagwörter | ✗ | Für Suche/Filter; Konventionen |
| D6 | Dokumente hochladen (docAdded/docParseError) | ✗ | Was aus Dokumenten übernommen wird; Fehlerfälle ehrlich |
| D7 | Bilder (images/imagesHint/imagesUpload) | ✗ | Nur Bilder als Anhang; Vorschau/Entfernen |

## E · Expertenmodus Formular (~1291 ff.)

| # | Element | HelpTip | Hilfetext muss erklären |
|---|---|---|---|
| E1 | formularHint | ✗ | Ehrlich: gleicher Datenstand wie geführter Weg |
| E2 | Felder: Titel, Wissensart (fType), Inhalt (fBody), Kernaussage, Bedingungen, Maßnahmen (ListEditor + Entfernen) | ✗ | Je Feld Was/Wann; Wissensarten erklären (inkl. Negativwissen!) |

## F · Einreichen & Abschluss

| # | Element | HelpTip | Hilfetext muss erklären |
|---|---|---|---|
| F1 | Bereitschafts-Check (readyTitle/Missing/Optional/Hint/Done) | ✗ | Was Pflicht vs. optional ist; ehrlich, was noch fehlt |
| F2 | „Gespeichert"-Karte (savedTitle/Body/FilesNote/Again) | ✗ | Wo das KO jetzt steht (Validierung), was als Nächstes passiert |

## Zählung & Empfehlung

**~40 Elemente, davon ~16 mit Hilfe versorgt (≈40 %, dank SCRUM-404 deutlich besser als der
Prüfbereich mit 6 %).** Priorität für den Umsetzungs-Slice: 1. **A2/A3** Modus-Wahl + Expertenpfad
(erste Verwirr-Stelle für jeden Neuling), 2. **B4/B5** Interview + Aus-Datei (KI-Momente: violett
kennzeichnen, G-2 erklären), 3. **C8–C10 + F1/F2** Verwerfen/Speichern/Einreichen (Angst-Punkte:
„geht etwas verloren? wer sieht das?"), 4. **D3–D7 + E2**, 5. Rest.

Schema wie SCRUM-406: HelpTip-Muster, DE+EN, „Was/Wann/Was passiert danach (und was NICHT
automatisch)". Abstimmungspunkt mit SCRUM-408: Wenn das Quellen-Panel ins Erfassen kommt,
übernimmt es die C-Quellen-Hilfetexte aus der 406-Inventur (C1–C7 dort) unverändert —
einmal texten, zweimal verwenden.
