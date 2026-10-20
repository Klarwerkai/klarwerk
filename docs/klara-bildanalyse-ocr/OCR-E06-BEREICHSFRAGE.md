# OCR-E06 · „Klara, was steht hier?“ — ausgewähltes Bild oder Bereich gezielt erklären

Auftrag `produkt:20261012:klara-ocr-bereichsfrage`, Revision 1. Quelle:
`PO-KLARA-OCR-ERGAENZUNGEN-20261012/ARBEITSAUFTRAEGE.txt: OCR-E06`. Elternauftrag
`produkt:20261012:klara-ocr-fundstellen-korrekturen` (OCR-E01/E02).

Status: **frühe, unabhängige Vorbereitung — keine Lieferung.** Die E01/E02-Elternlieferung ist in
diesem Stand nicht integriert (Basis `ef7766dc`); vor Veröffentlichung und Abschluss muss sie
regulär integriert und dieser Umfang erneut passend geprüft werden.

## Was gebaut ist

| Teil | Datei | Aufgabe |
| --- | --- | --- |
| Lesung eines Bildes mit Wortrahmen | `apps/web/src/lib/bildAutomatik.ts` (`lesungFuerBild`, `BildLesung`) | Dieselbe Analyse der Fläche wie die Automatik. Vorhandene Lesung derselben Bildbytes wird wiederverwendet; fehlt sie, wird **nur dieses eine Bild** gelesen. Der Befund der Automatik bleibt unverändert. |
| Bereichslogik (DOM-frei) | `apps/web/src/lib/klaraBereich.ts` | Bereich aus Zeigerpunkten, Wörter im Bereich (Rahmenmitte im Bereich), Zeilentext mit Kennzeichnung, Zustände `gelesen`/`leer`/`unleserlich`/`ohne-positionen`/`nicht-gelesen`, Auswahlschlüssel, Kontext und Anweisung an Klara |
| Oberfläche | `apps/web/src/components/KlaraBereichsfrage.tsx` | Bild wählen, Bereich mit Maus/Finger aufziehen oder ganzes Bild, „Was steht hier?“, Nachfragen zur selben Auswahl |
| Texte DE/EN/NL | `apps/web/src/texte/klarabereich.ts` | eigenes Textmodul |
| Flächen | `BildBefundeImRumpf.tsx` (Editor), `pages/Capture.tsx` (Dateiimport), `bibliothek/OfficeBildBefunde.tsx` (Office-Anhang im Artikel) | jeweils unter „Klara zu diesem Inhalt fragen“, mit derselben Analyse und demselben Lauf-Schlüssel |

## Zusagen

- Klara bekommt **nur die Auswahl**: deren erkannten Text, bei ganzem Bild zusätzlich den
  beschriebenen Bildinhalt (W02), und die bisherigen Fragen zu genau dieser Auswahl. Kein
  Dokumenttext, keine anderen Bilder; bei einem Bereich auch nicht die Bildbeschreibung des
  ganzen Bildes.
- Zum Bereich gehört ein Wort nur, wenn die Mitte seines Rahmens im Bereich liegt; angeschnittene
  Nachbarwörter stehen nicht im Bereichstext.
- Leere und unleserliche Bereiche werden benannt; dann wird Klara nicht gefragt. Liefert die
  Engine keine Wortrahmen, gibt es keinen Bereichstext — der Text des ganzen Bildes wird nicht als
  Bereichstext ausgegeben.
- Der erkannte Text der Auswahl steht immer da, auch ohne Modell. Ohne Modell gibt es keine
  Erklärung, und das steht da.
- Auswahlschlüssel = Konto + Fläche/Lauf + Bild + Bereich. Ein Wechsel blendet Ergebnis und
  Gespräch aus; verspätete Antworten einer überholten Auswahl werden verworfen.
- Die Automatik (Setup › Klara, Standard an) wirkt unverändert; die Bereichsfrage ersetzt sie
  nicht. Bei ausgeschalteter Automatik liest eine ausdrückliche Frage genau das gewählte Bild.
- Erklärung über den vorhandenen assist-Weg der Fläche (`ImageDescribeContext`, gleiche Provenienz
  und Vertraulichkeitsregel). Kein neuer Datenweg, keine neue Engine, keine Schreibstelle.

## Hostgrenzen (konkret offen)

| Host / Format | Stand |
| --- | --- |
| Web-App Klarwerk, Dateiimport (Bild, `.pptx`, `.docx`) | Auswahl in der Bildvorschau; Browserprobe `tests-smoke/klara-bereichsfrage-browser.spec.ts` (Chromium, Einzelbild) |
| Web-App, Editor (`BildBefundeImRumpf`) | Auswahl in der Bildvorschau; gemountet geprüft; Modellfall `@modell` im selben Spec (nur voller Smoke) |
| Web-App, Office-Anhang im Artikel | eingebunden, nicht eigens geprüft |
| Microsoft Word (Add-in), PowerPoint (Add-in/Desktop), Collabora | **keine** native Bild- oder Bereichsauswahl an Klara angebunden; nicht geprüft. Bilder von dort erreichen Klara nur über Import, Editor oder Anhang |
| Tastatur | Bild wählen, ganzes Bild, Fragen per Tastatur; das Aufziehen eines Bereichs braucht Zeiger (Maus/Finger/Stift) |
| PDF-Scans | nicht Teil dieses Umfangs (OCR-E04) |
| Firefox, WebKit | nicht gewählt |

## Prüfungen

- `tests/klara-bildanalyse-ocr/bereichsfrage.test.ts` — Bereichslogik an der echten Analyse
  (kontrollierte Fixtur `bereich-fixtur.ts`: mehrere Blöcke, gedrehter Text, unsichere und
  unleserliche Stelle, Bild ohne Rahmen, leeres und nicht lesbares Bild).
- `tests/klara-bildanalyse-ocr/bereichsfrage-mounted.test.tsx` — gemountete Editor-Fläche mit
  Zeigerereignissen: Bild, Bereich, Nachfrage, Wechsel, verspätete Antwort, Automatik an/aus,
  leer/unleserlich.
- `tests-smoke/klara-bereichsfrage-browser.spec.ts` — echter Browser, echte Texterkennung, echte
  Mausauswahl.

Nicht von diesem Auftrag geliefert: Fundstellen-Markierung (E01), Nutzerkorrekturen (E02),
Tabellen (E03), mehrseitige Scans (E04), Widersprüche (E05).
