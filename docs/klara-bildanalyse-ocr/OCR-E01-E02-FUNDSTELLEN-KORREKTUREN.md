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

- **Bindung:** eine Berichtigung gilt für genau eine Quelle (`office:<anhang>`, `datei:<name>`,
  Bildanhang `anhang|<name>`, Editor `ko:<id>` bzw. `entwurf:<id>` aus der vorhandenen Provenienz)
  und genau eine Bildfassung (`sha256` der Bildbytes). Andere Quelle, anderes oder verändertes Bild:
  keine Übertragung. Ist an derselben Stelle früher ein anderes Bild berichtigt worden, steht das
  sichtbar da („gilt nicht für das veränderte Bild“).
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
| K5 | berichtigtes Wort in Klara-Antwort und Zusammenfassung | `korrektur-klara.test.ts` B1, Mount E4 (Inhalt der Anfrage an den assist-Weg für Frage UND Zusammenfassung), Browser (Fundstellen der Frage) |
| K6 | Korrektur, Neuladen, erneutes Einlesen | `korrekturen-am-server.test.ts` S1, `korrekturen-pg.integration.test.ts`, `korrektur-klara.test.ts` B2, Mount E4, Browser |
| K7 | Rücksetzen → Rohbefund, Original unverändert | `korrekturen-am-server.test.ts` S2, `korrektur-klara.test.ts` B3, Mount E4, Browser |
| K8 | keine Übertragung auf fremdes/verändertes Bild | `korrekturen-am-server.test.ts` S3, `korrektur-klara.test.ts` B4, Mount E5, Browser |
| K9 | Nutzer-/Rollenregeln | `korrekturen-am-server.test.ts` S4, Mount E6, Browser (zweites Konto, Betrachter 403) |

Kontrollierte Fixtures (K10) dieser Lieferung: mehrere Bilder und Folien mit bekannten Wörtern an
bekannten Stellen, gedrehte Fotos (EXIF), absichtlicher Erkennungsfehler („Mül1er“, „LAGFR“),
dieselbe Zahl auf zwei Folien, veränderte Bildfassung. Tabellen, mehrseitige Scans, gemischte
Dokumente, Zahlenabweichungen und Bereichsauswahl gehören zu OCR-E03 bis OCR-E06 und sind hier
**nicht** geprüft.

## Grenzen (offen, konkret)

| Punkt | Stand |
| --- | --- |
| PowerPoint-Host | Es gibt kein PowerPoint-Add-in (H03). Geprüft ist der Dateiweg (`.pptx` im Erfassen, Q02) im Browser; „Office im Artikel“ (H06) ist angebunden, aber nicht im Browser geprüft |
| Word-Host | „Klara in Word“ (H02) liest weiterhin nur Text; Bilder aus Word werden erst im Editor der Web-App gelesen und berichtigt. Im Word-Host selbst nicht geprüft |
| Echtes Modell | Im Smoke-Tor läuft kein Modell. Dass Frage und Zusammenfassung den berichtigten Text bekommen, ist am Inhalt der Anfrage gemessen (Mount E4); eine formulierte Modellantwort mit Berichtigung ist nicht gelaufen |
| Gedrehte Fotos | Gemessen mit gebauten JPEG-Köpfen (EXIF 6/8) und der gedrehten Ansicht im Browser; ein echtes Handyfoto mit Drehangabe durch die echte Engine ist nicht gelaufen. Bei 180° (EXIF 3) und gespiegelten Fotos gibt es bewusst nur den Rückfall |
| Editor ohne gespeicherte Quelle | Ein noch nie gespeicherter Entwurf hat keine Quelle; dort wird nicht berichtigt, und das steht da. Eine Berichtigung an `entwurf:<id>` folgt nicht automatisch zum daraus entstandenen Wissensobjekt (`ko:<id>`) |
| Gemeinsame Berichtigungen | Berichtigungen gehören dem Konto, das sie gesetzt hat; andere Personen am selben Dokument sehen sie nicht (bewusst: keine neuen fremden Datenrechte) |
| Wissensfragen über `/api/ask` | unverändert ohne Bildtext (siehe OCR-03) |
| Grenzen | höchstens 300 Berichtigungen je Konto, 10 000 Zeichen je Text |
