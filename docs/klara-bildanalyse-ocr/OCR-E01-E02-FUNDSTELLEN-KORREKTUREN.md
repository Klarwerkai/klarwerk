# OCR-E01/E02 · Fundstellen am Original und dauerhafte Textkorrekturen

Auftrag `produkt:20261012:klara-ocr-fundstellen-korrekturen`, Revision 1, ausschließlich OCR-E01 und
OCR-E02 (gemeinsam integriert). OCR-E03 bis OCR-E06 sind beauftragt, aber **nicht** Teil dieser
Lieferung. Baut auf OCR-01 bis OCR-03 auf ([`BESTAND.md`](./BESTAND.md),
[`OCR-02-AUTOMATIK.md`](./OCR-02-AUTOMATIK.md), [`OCR-03-KONTEXT-SETUP.md`](./OCR-03-KONTEXT-SETUP.md)).
Keine neue Engine, kein neuer Host, keine zweite Profil- oder Rechteverwaltung; die standardmäßig
aktive, abschaltbare Automatik ist unverändert.

## Was geliefert ist

| Teil | Wo | Weg |
| --- | --- | --- |
| Wortrahmen und Bildmaße im Befund | `lib/bildAutomatik.ts` (`woerter`, `rahmen`), `lib/bildRahmen.ts` | aus der vorhandenen Erkennung (W01, tesseract.js liefert die Rahmen schon für die Tabellen) und aus den Kopfdaten der Bildbytes (PNG, JPEG samt EXIF-Drehangabe, GIF, WebP) |
| Zuordnung Text ↔ Wort, Markierung, Drehung, Größe | `lib/bildFundstelle.ts` | DOM-frei; Ausrichtung über die Wortfolge (auch für berichtigten Text), Bereich in Prozent des Messrahmens |
| Wählbare Textstellen (OCR-E01) | `components/BildTextStellen.tsx` in `BildBefundListe` | jedes Wort ist eine Schaltfläche; ein Tab-Stopp, Pfeiltasten/Pos1/Ende, Eingabe |
| Fundstelle am Original | `components/BildFundstelleAnsicht.tsx` (vorhandener `Modal`) | genau das gelesene Bild der Quelle/Folie (`originalAusEingang`), gestrichelter Rahmen mit Nummer und Satz, „Ansicht drehen“, „Vergrößern“ |
| Berichtigen, rückgängig, zurücksetzen (OCR-E02) | `components/BildTextBerichtigung.tsx` in `BildBefundListe` | Rohbefund aufklappbar daneben; Berichtigung gekennzeichnet |
| Ablage der Berichtigungen | `services/app/src/assistenz-bildkorrekturen.ts`, Feld `bildKorrekturen` im vorhandenen Assistenzprofil | `GET`/`PUT /api/me/assistenz/bildkorrekturen`; eigener Schreiber wie die Tastenkürzel, Profilfassung unberührt |
| Klara nutzt die Berichtigung | `KlaraBildKontextFrage` (`korrekturQuelle`), `lib/klaraBildKontext.ts` | derselbe assist-Weg wie OCR-03; berichtigter Bildtext als „Bildtext (berichtigt)“; frühere Antworten gelten nach einer Änderung nicht mehr |
| Flächen | Editor (`BildBefundeImRumpf`), Dateiimport und Bildanhänge im Erfassen (`pages/Capture.tsx`), Office im Artikel (`OfficeBildBefunde`) | im Dateiimport eines Einzelbildes folgt der Dateitext der Berichtigung; „OCR → Text“ an Bildanhängen übernimmt die wirksame Fassung |

### Regeln

- **Bindung:** eine Berichtigung gilt für genau eine Quelle (`office:<anhang>`, Bildanhang
  `anhang|<name>`, Editor `ko:<id>` bzw. `entwurf:<id>` aus der vorhandenen Provenienz, Dateiimport
  `datei:sha256:<Inhalt der ganzen Datei>|<name>`) und genau eine Bildfassung (`sha256` der
  Bildbytes). Andere Quelle, anderes oder verändertes Bild: keine Übertragung. Ist an derselben
  Stelle früher ein anderes Bild berichtigt worden, steht das sichtbar da („gilt nicht für das
  veränderte Bild“).
- **Dateiimport (Nacharbeit 2):** die Quelle ist die Datei selbst, Inhalt UND Name. Zwei
  verschiedene Dokumente gleichen Namens — auch mit denselben eingebetteten Bildern — teilen keine
  Berichtigung; dieselbe Datei unverändert wieder eingelesen (auch nach Neuladen) trägt sie. Eine
  umbenannte Kopie übernimmt nichts. Sind die Bytes nicht lesbar, wird nicht berichtigt.
- **Klara erst mit bestätigtem Stand (Nacharbeit 2):** hat eine Fläche eine Korrekturquelle, sind
  Frage und Zusammenfassung gesperrt, solange die gespeicherten Berichtigungen laden oder ihr Laden
  fehlgeschlagen ist; das steht sichtbar da, mit „Erneut laden“. So geht nie unbemerkt der
  Rohbefund an Klara.
- **Berichtigung wirkt auch in der Bildbeschreibung (Nacharbeit 3):** die automatische
  Bildbeschreibung (W02) desselben Bildes kann den Lesefehler wörtlich enthalten. Die berichtigten
  Wörter werden dort ebenso ersetzt (die ursprüngliche Beschreibung bleibt im Rohbefund), und die
  Anweisung an Klara sagt: für berichtigte Bilder gilt allein der berichtigte Bildtext. Gefunden im
  Modelllauf, in dem Klara „LAGFR“ aus der Beschreibung zitierte.
- **Zuordnung berichtigter Wörter:** ein berichtigtes Wort übernimmt die Position des erkannten nur,
  wenn beide ähnlich sind (Lesefehler wie „Mül1er“/„Müller“, „1.5OO“/„1.500“) oder das erkannte
  `[unleserlich]` war; ein ganz anderes Wort hat keine Position (ehrlicher Rückfall).
- **Erneutes Lesen** derselben Bytes (automatisch, wiederverwendet oder ausdrücklich neu) ändert die
  Berichtigung nicht — sie liegt getrennt vom Rohbefund am Konto.
- **Rückgängig** holt die vorige Berichtigung (bis zu 5 Schritte), danach den Rohbefund;
  **Zurücksetzen** entfernt die Berichtigung. Bild und Datei werden nie geschrieben; gespeichert
  wird nur Bindung und Text (kein Bild, keine data-URL). Ins Prüfprotokoll geht nur das Ereignis.
- **Rechte:** gelesen wird nur das eigene Konto; schreiben verlangt `ko.create` (wie Entwürfe
  bearbeiten) — ein Betrachter (`viewer`) bekommt 403 und sieht keine Bearbeitung. Kontowechsel:
  nichts vom anderen Konto wird angewendet. Fremde Kontokennung im Rumpf/in der Adresse: 403.
- **Keine erfundene Position:** ohne Wortrahmen, mit unlesbaren Maßen, mit unklarer Drehangabe
  (EXIF 3, gespiegelt, oder beide Rahmen möglich), mit Rahmen außerhalb des Bildes oder für ein
  ergänztes Wort zeigt die Ansicht das ganze Bild ohne Markierung und nennt den Grund.
- **Gedrehte Fotos (EXIF 6/8):** die Drehung wird nur angewendet, wenn eindeutig feststeht, in
  welchem Rahmen gemessen wurde (gespeichert oder angezeigt); sonst Rückfall.

## Kriterien und Prüfstände

| K | Kriterium (gekürzt) | Prüfstand |
| --- | --- | --- |
| K1 | Zahl, Name, Datum → Original und Bereich | `tests/klara-bildanalyse-ocr/fundstellen-original.test.ts` F1, `fundstelle-korrektur-mounted.test.tsx` E1, Browser `tests-smoke/klara-ocr-fundstelle-korrektur-browser.spec.ts` |
| K2 | mehrere Bilder/Folien ohne Verwechslung | `fundstellen-original.test.ts` F2 (echte PPTX-Kette), Mount E1, Browser (dieselbe Zahl auf zwei Folien) |
| K3 | gedrehte und skalierte Bilder | `fundstellen-original.test.ts` F3 (EXIF 6/8, Ansichtsmaße), Mount E2, Browser (Bildschirmlage nach Drehen und Vergrößern) |
| K4 | ehrlicher, bedienbarer Rückfall | `fundstellen-original.test.ts` F4, Mount E3, Browser (ergänztes Wort) |
| K5 | berichtigtes Wort in Klara-Antwort und Zusammenfassung | `korrektur-klara.test.ts` B1, Mount E4 (Inhalt der Anfrage an den assist-Weg für Frage UND Zusammenfassung), Mount E7 (keine Anfrage vor bestätigtem Korrekturstand), Browser (Fundstellen der Frage), Browser `@modell` (tatsächliche Antwort und Zusammenfassung mit „LAGER“, ohne „LAGFR“) |
| K6 | Korrektur, Neuladen, erneutes Einlesen | `korrekturen-am-server.test.ts` S1, `korrekturen-pg.integration.test.ts`, `korrektur-klara.test.ts` B2, Mount E4 und E7, `datei-quelle-mounted.test.tsx` Q1, Browser |
| K7 | Rücksetzen → Rohbefund, Original unverändert | `korrekturen-am-server.test.ts` S2, `korrektur-klara.test.ts` B3, Mount E4, Browser |
| K8 | keine Übertragung auf fremdes/verändertes Bild | `korrekturen-am-server.test.ts` S3, `korrektur-klara.test.ts` B4, Mount E5, `datei-quelle-mounted.test.tsx` Q1 (gleichnamige verschiedene Dokumente), Browser |
| K9 | Nutzer-/Rollenregeln | `korrekturen-am-server.test.ts` S4, Mount E6 und E7 (Kontowechsel während des Ladens), Browser (zweites Konto, Betrachter 403) |

### K10/K11 — E01/E02-Wirkung in den Formaten der gemeinsamen Abnahme

Geprüft ist allein die Wirkung von Fundstelle und Berichtigung; neue Funktionen von OCR-E03 bis
OCR-E06 werden nicht vorausgesetzt.

| Format | Beleg | Konkrete Grenze |
| --- | --- | --- |
| Mehrere Bilder/Folien | `fundstellen-original.test.ts` F2, `bildautomatik.test.ts` (Zuordnung/Reihenfolge), Browser | — |
| Gedrehte Texte/Skalierung | `fundstellen-original.test.ts` F3, Mount E2, Browser | gebaute EXIF-Köpfe; kein echtes Handyfoto durch die echte Engine |
| Absichtlicher Lesefehler | `korrektur-klara.test.ts` B1/B2, Mount E4, Browser (auch `@modell`) | — |
| Tabelle | `fundstellen-formate.test.ts` W1, `bildautomatik.test.ts` (Tabellen aus Wortrahmen) | die Berichtigung wirkt im Text; die erkannte Tabelle wird nicht neu aufgebaut und bleibt als Rohbefund (bearbeitbare Tabellen: OCR-E03) |
| Mehrseitig | `fundstellen-formate.test.ts` W2 (Seiten als Bilder einer PowerPoint: erste/letzte Seite, Teilfehler, Berichtigung) | gescannte PDF-Seiten liest der Bestand nicht (Q04/L06, OCR-E04); bei Word gibt es keine Seitenangabe (L07) |
| Gemischtes Dokument | `fundstellen-formate.test.ts` W3, `kontext-klara.test.ts` C2 | — |
| Tatsächliche/scheinbare Zahlenabweichung | `fundstellen-formate.test.ts` W4 (getrennte Fundstellen, lokale Berichtigung) | keine Widerspruchsbewertung (OCR-E05) |
| Ausgewählter Bildbereich | `fundstellen-formate.test.ts` W5 (zwei Blöcke, gewählte Stelle nur in ihrem Block, stabil nach Berichtigung), F1/Mount E1 | Auswahl auf Wortebene; keine freie Bereichsauswahl und keine Bereichsfrage (OCR-E06) |

## Grenzen (offen, konkret)

| Punkt | Stand |
| --- | --- |
| PowerPoint-Host | Es gibt kein PowerPoint-Add-in (H03). Geprüft ist der Dateiweg (`.pptx` im Erfassen, Q02) im Browser; „Office im Artikel“ (H06) ist angebunden, aber nicht im Browser geprüft |
| Word-Host | „Klara in Word“ (H02) liest weiterhin nur Text; Bilder aus Word werden erst im Editor der Web-App gelesen und berichtigt. Im Word-Host selbst nicht geprüft |
| Echtes Modell | Im Smoke-Tor läuft kein Modell. Der Nachweis der tatsächlichen Antwort und Zusammenfassung mit Berichtigung ist der `@modell`-Fall in `tests-smoke/klara-ocr-fundstelle-korrektur-browser.spec.ts`; er braucht den vollen Smoke mit freigegebenem Modellzugang und ist erst belegt, wenn er dort gelaufen ist |
| Gedrehte Fotos | Gemessen mit gebauten JPEG-Köpfen (EXIF 6/8) und der gedrehten Ansicht im Browser; ein echtes Handyfoto mit Drehangabe durch die echte Engine ist nicht gelaufen. Bei 180° (EXIF 3) und gespiegelten Fotos gibt es bewusst nur den Rückfall |
| Editor ohne gespeicherte Quelle | Ein noch nie gespeicherter Entwurf hat keine Quelle; dort wird nicht berichtigt, und das steht da. Eine Berichtigung an `entwurf:<id>` folgt nicht automatisch zum daraus entstandenen Wissensobjekt (`ko:<id>`) |
| Gemeinsame Berichtigungen | Berichtigungen gehören dem Konto, das sie gesetzt hat; andere Personen am selben Dokument sehen sie nicht (bewusst: keine neuen fremden Datenrechte) |
| Wissensfragen über `/api/ask` | unverändert ohne Bildtext (siehe OCR-03) |
| Grenzen | höchstens 300 Berichtigungen je Konto, 10 000 Zeichen je Text |
