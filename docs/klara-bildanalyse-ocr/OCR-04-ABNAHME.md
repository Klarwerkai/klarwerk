# OCR-04 · Echte Dokument-/Bildwege prüfen und Lieferung belegen

> Aktueller Stand 20.10.2026: Die erhaltene Erweiterung ist auf `a5023125` mit der
> tatsächlich gelieferten E01/E02-Basis `01378570` integriert. Für den gemeinsamen
> direkten Kandidaten gelten [Integration und Nachweise](OCR-C-INTEGRATION-20261020.md).
> Die folgenden Nacharbeitsangaben dokumentieren den erhaltenen historischen Stand;
> frühere Aussagen zur fehlenden Elternlieferung sind überholt. Keine Veröffentlichung
> und keine Gesamt-Hostabnahme werden damit behauptet.

Auftrag `produkt:20261012:klara-bildanalyse-ocr-hostpruefung`, Revision 1, Paket OCR-04. Prüft die
Lieferungen von OCR-02 ([`OCR-02-AUTOMATIK.md`](./OCR-02-AUTOMATIK.md)) und OCR-03
([`OCR-03-KONTEXT-SETUP.md`](./OCR-03-KONTEXT-SETUP.md)) auf den tatsächlich vorhandenen Wegen. Keine
zweite Erkennung, kein neuer Host, kein neuer Datenweg, keine Produktänderung.

## Zuordnung

| Was | Kennung | Stand |
| --- | --- | --- |
| Original | `PO-KLARA-BILDANALYSE-OCR-20261012/ARBEITSAUFTRAEGE.txt`, Abschnitt OCR-04; Quelle `f2d2ad30…`, Fassung `20261012-auto-bilder-peter-v1` | Kriterien K1–K5 unverändert |
| Produktionsauftrag | `produkt:20261012:klara-bildanalyse-ocr-hostpruefung`, Revision 1 | dieser Bau |
| Abhängigkeiten | OCR-02 `produkt:20261012:klara-bildanalyse-ocr-automatik`, OCR-03 `produkt:20261012:klara-bildanalyse-ocr-kontext-setup` (je Revision 1) | im Hauptstand der Basis `1424244e` enthalten; ihre Prüfstände werden hier wiederverwendet, nicht ersetzt |
| Verknüpft | `aufnahme:20260922:gesamt-ocr`, Revision 2, Kandidat `842d2f63` | unberührt; die manuelle Capture-OCR daraus ist kein Beleg für die Automatik |

## Was OCR-04 hinzufügt

| Datei | Inhalt |
| --- | --- |
| `tests/klara-bildanalyse-ocr/abnahme.ts` | Abnahmeprüfer für Bildbefunde: Auslassung, falsche Fundstelle, fehlender, fremder und veralteter Text; erfundene Wörter bei schwierigen Vorlagen; Trefferprotokoll |
| `tests/klara-bildanalyse-ocr/ocr04-abnahme.test.ts` | Gegenproben, dass der Prüfer jeden dieser Mängel meldet; Produktpfad PowerPoint → Klara-Kontext ohne Auslassung, ohne falsche Fundstelle, ohne veralteten Befund; Automatik ohne Genauigkeit fällt durch |
| `tests-smoke/klara-bild-ocr04-abnahme-browser.spec.ts` | fünf Browserfälle mit echter Erkennung (Projekt `chromium-zustand`), siehe unten |
| `playwright.smoke.config.ts`, `tests/smoke/smoke-mengen-manifest.json` (Version 59), `tests/smoke/tor-ausnahme.test.ts` | Einordnung der neuen Fälle; in der Ausnahmeliste zusätzlich die bereits vorhandenen, dort fehlenden `@modell`-Fälle von OCR-03 und REF-02; im Manifest das fehlende Leerzeichen im Titel „Klara 12“ (Nacharbeit 1) |
| `tsconfig.json`, `tsconfig.tests-tsx.json` | `ocr04-abnahme.test.ts` wird wie `kontext-klara.test.ts` im DOM-/jsx-Typecheck geprüft (Nacharbeit 1, TS6142) |

## Getrennte Nachweise (K2)

| Nachweis | Fall | Was er belegt — und was nicht |
| --- | --- | --- |
| Automatik | Browser „Automatik“ | Bild und PowerPoint (vier Bilder auf drei Folien) im Dateiimport: der Befund erscheint ohne Klick als „läuft“ und endet für jedes Bild. Bewertet keinen Text |
| Genauigkeit | Browser „Genauigkeit“ | bekannter Text wörtlich, mit Zahlen, Datum, Umlauten und ß; PowerPoint ohne Auslassung, ohne falsche Fundstelle, ohne fremden Text; schwierige Vorlagen ohne ungekennzeichnet falschen Text |
| Nutzung durch Klara | Browser `@modell` „direktes Bild“ und „PowerPoint im Artikel“ | tatsächliche Modellantwort enthält Text, der nur im Bild steht (Nummer, Datum; Nummer und Folie); Zusammenfassung mit Folien- und Bildtext; der Anhang ist nach dem Lesen bytegleich |
| Gegenprobe | Unit C1 | ein Lauf, der ohne Klick startet und endet, aber falsch liest, besteht nicht |

### Befund der Genauigkeitsprobe (Nacharbeit 2, Kandidat `e65681c1`)

In beiden Läufen (Smoke-Tor und voller Smoke mit Modell, `chromium-zustand`) las die vorhandene
Texterkennung (W01, tesseract.js `deu+eng`) im reinen Textbild **„Schlüssel 53“ statt „Schlüssel
58“** — ohne Unsicherheitsmarke. Die Vorlage ist eindeutig lesbar (fett, 80 px, schwarz auf weiß; als
Anhang `ocr04-vorlage-textbild.png` im Bericht). Alle übrigen Vorlagen stimmten wörtlich: Screenshot
(„4711“, „15.11.2026“, Umlaute), gedrehter Text, schwacher Kontrast und alle vier PowerPoint-Bilder
an ihrer Folie.

Das ist ein **Genauigkeitsfehler der vorhandenen Erkennung**, kein Fehler der Probe: eine falsch
gelesene Zahl wird als sicher ausgegeben. Die Probe bleibt unverändert rot. Die Behebung (Engine-
Einstellung, Vorverarbeitung oder Schwelle der Unsicherheitsmarke) gehört zur Erkennung aus OCR-02 bzw.
gesamt-ocr; OCR-04 baut nach seinen Nichtzielen keine zweite Erkennung und entscheidet diese
Produktfrage nicht selbst.

Bens Urteil zu Kandidat `003c409a` (Nacharbeit 3) bestätigt das: die Erkennung ist im zuständigen
OCR-02-/gesamt-ocr-Auftrag zu korrigieren und zu integrieren; danach ist die **unveränderte**
Genauigkeitsprobe nachzuweisen.

**Nacharbeit 4 (Kandidat `b9904153`):** Die Korrektur ist im eigenen Auftrag
`produkt:20261015:ocr-basis-erkannter-genauigkeitsfehler` geliefert (`ef7766dc`, 1.0.0-beta.1.989,
siehe [`OCR-BASIS-GENAUIGKEIT.md`](./OCR-BASIS-GENAUIGKEIT.md)). Der Lauf an `b9904153` war noch rot,
weil dieser Zweig die Korrektur nicht enthielt. Übernommen sind jetzt wortgleich ihre Änderungen an
`lib/ocr.ts`, `lib/files.ts` und `lib/bildAutomatik.ts` (die drei Dateien waren im Zweig mit dem
Ausgangsstand der Korrektur identisch) sowie ihr Unit-Test und diese Beschreibung. OCR-04-Probe,
Vorlagen und Sollwerte sind unverändert. Ob die echte Erkennung jetzt „58“ liest, belegt erst der
nächste Browserlauf.

## Vorlagen mit bekanntem Inhalt

Alle fiktiv und im Browser gezeichnet; sie hängen als Bild am Prüfbericht.

| Vorlage | Bekannter Inhalt | Erwartung | Prüfstand |
| --- | --- | --- | --- |
| Screenshot (Fensterleiste, Seitenleiste, Knopf) | „Auftrag 4711“, „Fällig 15.11.2026“, „Prüfung offen“ | jeder Begriff wörtlich | OCR-04 Genauigkeit; Modellfall direktes Bild |
| reines Textbild | „Schlüssel 58“, „Füllstand 93“ | jeder Begriff wörtlich | OCR-04 Genauigkeit, Quellwechsel |
| gedrehter Text (6°) | „VENTIL 38“, „DRUCK 72“ | gelesen oder „kein Text“; nichts Falsches ohne Kennzeichnung | OCR-04 Genauigkeit |
| schwacher Kontrast (#a6a6a6 auf #c4c4c4) | „LAGER 54“, „PUMPE 16“ | wie gedrehter Text | OCR-04 Genauigkeit |
| lesbare Handschrift (nachgebildete Druckhandschrift), Gekritzel | „TEIL 47“, „HALT 71“; kein Text | Wort und Zahl erkannt; Gekritzel ohne erfundenen Text | OCR-02 `klara-bildautomatik-browser.spec.ts`, unverändert |
| bildhafte Tabelle ohne Linien | 3 × 3 Zellen | Tabelle 3 × 3 | OCR-02 `klara-bildautomatik-browser.spec.ts`, unverändert |
| PowerPoint, drei Folien, vier eingebettete Bilder | „Prüfstand 47“ (Folie 1), „Ölwechsel 83“, „Größe 29“ (Folie 2), „Übergabe 61“ (Folie 3); Folientext enthält keinen Bildtext | jedes Bild an seiner Folie mit seinem Text | OCR-04 Genauigkeit, Änderung, Modellfall Artikel |

## Verhaltenstests (wiederverwendet und ergänzt)

| Verhalten | Prüfstand |
| --- | --- |
| Autoauslösung | OCR-04 Automatik; OCR-02 `bildautomatik.test.ts` K1, `automatik-dateiimport-mounted.test.tsx`, `rumpf-bilder-mounted.test.tsx` |
| vollständige Fundstellen | OCR-04 Genauigkeit und Unit B1; OCR-02 `bildautomatik.test.ts` K3 |
| Quellwechsel | OCR-04 Änderung und Quellwechsel; OCR-03 `kontext-klara.test.ts` C4 |
| Änderung, veralteter Befund | OCR-04 Änderung und Unit A4/B3; OCR-02 `bildautomatik.test.ts` K4, `office-anhang.test.tsx` (neue Fassung) |
| Wiederverwendung | OCR-04 Änderung und Unit B3; OCR-02 `bildautomatik.test.ts` K4 |
| Setup-Schalter, Neuladen | OCR-03 `klara-bildautomatik-setup-browser.spec.ts`, `setup-schalter-mounted.test.tsx`, `setup-automatik-am-server.test.ts` |
| Fehlerfälle, Teilverarbeitung | OCR-02 `bildautomatik.test.ts` K5, `office-anhang.test.tsx` (Ladefrist); OCR-04 Unit B2 |

## Hosts und Formate — konkret offen (K4)

Belegt wird nur, was die Fälle oben tatsächlich fahren. Teiltests sind keine Gesamtlieferung.

| Host / Format | Stand nach OCR-04 |
| --- | --- |
| Web-App (H01): Dateiimport mit Bild und `.pptx`, Editor mit eingefügtem Bild | geprüft (Browser, echte Erkennung); Modellantwort nur im Editor eines eingestuften Entwurfs, weil eine nicht gespeicherte Datei im Erfassen fail-safe als vertraulich gilt |
| Office im Artikel (H06) mit `.pptx` | geprüft einschließlich Modellantwort (Fall `@modell`) |
| `.docx` mit eingebetteten Bildern | nur Unit und gemountet (OCR-02 `bildautomatik.test.ts` K3, `office-anhang.test.tsx`); **kein Browserlauf mit echter Erkennung in OCR-04** |
| PowerPoint selbst (Desktop/Online) bzw. PowerPoint-Add-in (H03) | **fehlt als Host**; PowerPoint erreicht Klarwerk nur als Datei. Ein „im PowerPoint-Host gelesen“ ist nicht belegbar |
| Klara in Word (H02) | Klara-Frage liest nur Text (L10); Bilder werden erst im Editor der Web-App gelesen — **nicht in OCR-04 geprüft** |
| Browser-Erweiterung (H04) | Analyse erst im Editor der Web-App — **nicht in OCR-04 geprüft** |
| Mac (H05) | **fehlt als Host** |
| PDF-Bilder und Scanseiten (Q04, L06); Excel, `.ppt`, `.doc` (Q08) | **nicht gelesen** |
| Folienansicht (W04, L15), Layout/Master/Diagramme/SmartArt/Notizen (L16) | **nicht erfasst**; PowerPoint heißt deshalb nie „vollständig“ |
| Handschrift eines Menschen, Schreibschrift | **nicht gemessen** (nur nachgebildete Druckhandschrift) |
| echte Kundendokumente, Bedienung durch Menschen | **nicht Teil dieses Laufs** (Pilot) |
| Qualität der Modellantwort | stichprobenhaft über zwei Fragen und eine Zusammenfassung mit bekanntem Inhalt; keine allgemeine Bewertung |

## Prüfstände

| Datei | Art | Kriterien |
| --- | --- | --- |
| `tests/klara-bildanalyse-ocr/ocr04-abnahme.test.ts` | Unit, echte PPTX-Importkette, Erkennung gestellt | K2, K3 |
| `tests-smoke/klara-bild-ocr04-abnahme-browser.spec.ts` (ohne `@modell`) | Browser, echte Erkennung, hermetisches Tor | K2, K3, K4 |
| `tests-smoke/klara-bild-ocr04-abnahme-browser.spec.ts` (`@modell`) | Browser, echte Erkennung, echtes Modell, voller Smoke | K1, K2 |
| `tests-smoke/klara-bildautomatik-browser.spec.ts` (OCR-02, unverändert) | Handschrift, unleserliche Stelle, Tabelle | K2 |
