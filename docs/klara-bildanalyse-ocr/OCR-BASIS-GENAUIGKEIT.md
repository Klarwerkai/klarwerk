# OCR-Basis · Genauigkeitsfehler 58 → 53

Auftrag `produkt:20261015:ocr-basis-erkannter-genauigkeitsfehler`, Revision 1 (Punkt 7 vom
15.10.2026). Enger Reparaturauftrag an der vorhandenen Texterkennung W01; OCR-04
(`produkt:20261012:klara-bildanalyse-ocr-hostpruefung`) und E01–E06 bleiben eigene Originale.

## Befund

Bens Urteil zu OCR-04 (Kandidat `003c409a`, `tests-smoke/klara-bild-ocr04-abnahme-browser.spec.ts`
Z. 595): Das klar lesbare Textbild „Schlüssel 58 / Füllstand 93“ (fett 80 px Arial, schwarz auf
weiß, 1200 × 380) wurde in beiden Browserläufen als „Schlüssel 53 / Füllstand 93“ gelesen — ohne
Unsicherheitsmarke. In derselben Vorlagenform lasen „VENTIL 38“ (gedreht) und „LAGER 54“
(schwacher Kontrast) richtig, ebenso Screenshot und PowerPoint-Bilder.

## Ursache

Aus Weg und Vorlage abgeleitet. Lokal wurde die Engine in diesem Schritt nicht gestartet, die
Ursache ist also nicht an der Engine gemessen:

1. **Übergroße Schrift.** Ziffern und Großbuchstaben der Vorlage sind rund 57 px hoch, die
   Wortrahmen rund 57–72 px. Die LSTM-Erkennung von Tesseract (`deu+eng`, `4.0.0_best_int`, nur
   LSTM) ist auf deutlich kleinere Schrift trainiert (Großbuchstaben um 30 px). Bei dieser Größe
   hängen einzelne Zeichen am Zeilenzuschnitt und am Herunterrechnen innerhalb der Engine. Die
   fette 8 mit kleinen Innenräumen kippt dann zur 3, während andere Ziffern derselben Größe richtig
   bleiben.
2. **Kein Abgleich.** `recognizeImage` übernahm eine einzige Lesung samt der Sicherheit, die die
   Engine selbst vergab. Für die falsche „53“ war sie hoch, deshalb blieb sie unter
   `UNSICHER_UNTER` (60) unmarkiert.

## Korrektur — derselbe Weg, dieselbe Engine

`apps/web/src/lib/ocr.ts` (`recognizeImage`, DOM-frei), `apps/web/src/lib/files.ts` (`runImageOcr`,
Verkleinern per Canvas), `apps/web/src/lib/bildAutomatik.ts` (Kennzeichnung):

- Nach der ersten Lesung bestimmt `verkleinerungsFaktor` die Schriftgröße aus den Wortrahmen
  (unteres Viertel). Liegt sie über `OCR_GROSS_AB` (48 px), zeichnet `runImageOcr` das Bild auf
  `OCR_ZIEL_WORTHOEHE` (32 px) verkleinert neu. **Dieselbe** tesseract.js-Engine liest es mit
  denselben Einstellungen noch einmal. Diese Lesung wird der Befund; ihre Wortrahmen werden in den
  Originalmaßstab zurückgerechnet (Tabellenerkennung unverändert).
- Die erste Lesung bleibt **Gegenlesung**. Jedes Wort, das darin nicht an entsprechender Stelle
  steht (längste gemeinsame Wortfolge), ist `abweichend` und erscheint in der Automatik als
  `[?wort]`, auch in Tabellenzellen. Eine instabile Zahl steht damit nicht mehr ungekennzeichnet
  im Befund.
- Findet die Nachlesung weniger Wörter, bleibt die erste Lesung der Befund, mit derselben
  Kennzeichnung, damit keine Stelle verloren geht. Scheitert das Verkleinern oder die Nachlesung,
  gilt die erste Lesung unverändert.
- Normal große Schrift (z. B. Bildschirmfotos mit 36–48-px-Schrift) wird wie bisher genau einmal
  gelesen.

Nicht geändert: Vorlagen, Sollwerte, Fixtures, Schwellen (`UNSICHER_UNTER`, `UNLESERLICH_UNTER`),
Originalbilder (das verkleinerte Bild existiert nur für die Lesung), Engine, Sprachdaten, CSP.
Es gibt keine Ersetzung von Zeichen oder Zahlen und keine Nachkorrektur durch ein Modell.

## Prüfung

| Prüfung | Datei | Kriterium |
| --- | --- | --- |
| Mechanismus mit injizierter Engine: eine Lesung bei normaler Schrift; Nachlesung, Rückrechnung der Rahmen, Markierung abweichender Wörter, Rückfall ohne Verlust; Kennzeichnung in Text und Tabelle | `tests/klara-bildanalyse-ocr/ocr-basis-genauigkeit.test.ts` | OBG-K01, K03 |
| Bestehende Verträge des Adapters und der Automatik | `tests/capture/ocr-extract.test.ts`, `tests/klara-bildanalyse-ocr/bildautomatik.test.ts` | OBG-K01, K03 |
| Echte Erkennung im Browser: wortgleiche OCR-04-Vorlagen (Textbild, Screenshot, gedreht, schwacher Kontrast, PowerPoint mit vier Bildern auf drei Folien), Quellwechsel im selben Dateiimport; PNG der Textbildvorlage mit SHA-256 als Anhang | `tests-smoke/klara-bildautomatik-browser.spec.ts`, Fall „OCR-Basis 58→53“ | OBG-K02, K03 |
| Bestehende Browserfälle PowerPoint/Einzelbild/Wiederverwendung sowie Handschrift, Gekritzel und Tabelle gegen die geänderte Erkennung | `tests-smoke/klara-bildautomatik-browser.spec.ts` (OCR-02-Fälle) | OBG-K03 |

Die Browserprobe übernimmt Vorlagen und Maßstab der OCR-04-Probe wortgleich. Die OCR-04-Datei
selbst gehört zum OCR-04-Auftrag und steht nicht auf main. Für das Textbild gilt hier zusätzlich:
kein Wort ungekennzeichnet falsch. Die Erkennung läuft ausschließlich im Browser; ein Modell wird
nicht genutzt. Die Bildbeschreibung (W02) ist davon getrennt und wird im Protokoll als eigener
Zustand ausgewiesen.

## Grenzen

- Ob die echte Engine die Vorlage nach der Korrektur als „58“ liest, belegt allein der
  Browserlauf am Kandidaten. Bis dahin ist das nicht behauptet.
- Echte Handschrift, Kundendokumente, große PDFs und Hosts (Word, PowerPoint-Add-in, Mac) bleiben
  ungeprüft und gehören zu ihren eigenen Aufträgen. Die OCR-04-Gesamtabnahme und deren
  Zukunftssperre bleiben unberührt.
