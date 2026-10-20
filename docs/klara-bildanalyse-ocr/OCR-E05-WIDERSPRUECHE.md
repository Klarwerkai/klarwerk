# OCR-E05 · Sachliche Widersprüche zwischen Bildtext und Dokumenttext

> Aktueller Stand 20.10.2026: Die erhaltene Erweiterung ist auf `a5023125` mit der
> tatsächlich gelieferten E01/E02-Basis `01378570` integriert. Für den gemeinsamen
> direkten Kandidaten gelten [Integration und Nachweise](OCR-C-INTEGRATION-20261020.md).
> Die folgenden Nacharbeitsangaben dokumentieren den erhaltenen historischen Stand;
> frühere Aussagen zur fehlenden Elternlieferung sind überholt. Keine Veröffentlichung
> und keine Gesamt-Hostabnahme werden damit behauptet.

Auftrag `produkt:20261012:klara-ocr-widersprueche`, Revision 2, ausschließlich OCR-E05. Die
Originalkriterien sind gegenüber Revision 1 unverändert.
Abhängigkeit: `produkt:20261012:klara-ocr-fundstellen-korrekturen` (OCR-E01/E02).

**Stand: mit der Elternlieferung OCR-E01/E02 (`01378570`, 1.0.0-beta.1.991) zusammengeführt; keine
Lieferung.** E05 bewertet in `KlaraBildKontextFrage` den Stand MIT den gespeicherten Berichtigungen
(`quellenMitKorrekturen`). Solange der Korrekturstand lädt oder nicht geladen werden konnte, zeigt
E05 keine Abweichung, so wie Frage und Zusammenfassung dann gesperrt sind.

## Was gebaut ist

| Datei | Inhalt |
| --- | --- |
| `apps/web/src/lib/bildWidersprueche.ts` | DOM-freier Kern: Angaben (Betrag, Zahl mit Einheit, Datum, Name nach „Bezeichnung:“) aus Dokumenttext und erkanntem Bildtext, Vergleich je Sachverhalt, Zusatz zur Anweisung an Klara |
| `apps/web/src/components/BildWidersprueche.tsx` | Anzeige: beide Angaben nebeneinander, jeweils Wortlaut, Fundstelle und Auszug |
| `apps/web/src/components/KlaraBildKontextFrage.tsx` | Einbindung in die vorhandene Fläche „Klara zu diesem Inhalt fragen“ (Dateiimport, Editor, Office im Artikel) |
| `apps/web/src/texte/bildwidersprueche.ts` | Texte DE/EN/NL |

Wiederverwendet, nicht neu gebaut: Erkennung und Unsicherheitskennzeichnung (`bildAutomatik.ts`),
der gemeinsame Text-/Bildkontext mit Fundstellen und Quellbindung (`klaraBildKontext.ts`), der
vorhandene assist-Weg mit Provenienz und Vertraulichkeitsregel.

## Regeln

- **Derselbe Sachverhalt** heißt: gleiche Art der Angabe, gleiche Einheit/Währung, derselbe Bezug
  (Jahr, Quartal, Monat, Version, Stand, Plan/Prognose, netto/brutto) und Bezugswörter, von denen
  die eine Seite alle auch auf der anderen trägt. Trägt jede Seite ein eigenes unterscheidendes Wort
  („Gesamtsumme Projekt Nord“ gegenüber „Gesamtsumme Projekt West“), ist es ein anderer
  Sachverhalt. Abweichende Bezüge oder Einheiten ergeben **keinen** Hinweis.
- Gleiche Werte in anderer Schreibweise sind gleich („1.500 €“ = „1.500,00 EUR“ = „1,5 Tsd. €“).
- Vorzeichen bleiben im Wert und im Wortlaut erhalten („-1.500 €“ ≠ „1.500 €“; „-1.500 €“ =
  „−1.500,00 EUR“ = „€ -1.500“). Nicht erkannt werden Klammerschreibweise „(1.500 €)“ und
  nachgestelltes Minus „1.500- €“.
- Ist eine Ziffer im Bild unsicher (`[?…]`) oder unleserlich gelesen, heißt der Hinweis
  „Unsichere Erkennung – kein belegter Widerspruch“. Das gilt für die ganze Zahlengruppe: Ein
  unmittelbar angrenzendes unsicheres Stück macht auch den sicher gelesenen Teilbetrag unsicher,
  wenn es unleserlich ist, eine Ziffer trägt, höchstens drei Zeichen lang ist oder nur aus Zeichen
  besteht, die die Erkennung mit Ziffern verwechselt (O, o, Q, D, l, I, i, |, S, s, B, b, Z, z, G,
  g), und dabei die Form einer Zahl hat: mit Gruppentrenner („l.OOO“) oder ohne Kleinbuchstaben
  außer „l“ („OOO“). Beispiele: „[unleserlich] 800 €“, „[?O] 800 €“, „[?l.OOO] 800 €“. Ein unsicher
  gelesenes Bezugswort tut das nicht, auch wenn es nur aus verwechselbaren Buchstaben besteht:
  „[?Gesamtsumme] 1.700 €“, „[?Solo] 800 €“. Für Großschreibung („[?SOLO]“, „[?BOSS]“) gibt die
  Schreibform keinen Ausschlag. Entscheidend ist dann der Vergleich: Benennt der Dokumenttext
  denselben Sachverhalt mit genau diesem Wort („BOSS 1.500 €“), ist es ein eigenständiges
  Bezugswort, und die sicher gelesenen Ziffern gelten. Ein verlesenes Zahlenpräfix steht nie als
  Wort im Text und bleibt unsicher.
- Fundstelle Text: Absatz und Satz samt Auszug. Fundstelle Bild: Quelle · Folie/Bild und Zeile des
  erkannten Texts samt Auszug.
- Nichts wird überschrieben oder gespeichert. Hinweis und Anweisung an Klara nennen beide Angaben;
  Klara soll nicht ohne Beleg entscheiden, welche stimmt.
- Bewertet wird bei jedem Stand neu. Ein berichtigter Bildtext (OCR-E02) steht im Befund an der
  Stelle des Rohtexts und wird damit automatisch berücksichtigt.

## Prüfung

- `tests/klara-bildanalyse-ocr/widersprueche.test.ts`: echte Editor-Kette mit mehreren Bildern,
  tabellarischem Bildtext, absichtlichem OCR-Fehler, tatsächlicher und scheinbarer Abweichung; die
  echte Klara-Fläche wird gemountet.
- `tests-smoke/klara-bild-widersprueche-browser.spec.ts`: PowerPoint über den Dateiimport im
  Browser, mit echter Texterkennung.
- `tests-smoke/klara-bild-widersprueche-hosts-browser.spec.ts` (chromium-zustand): H06 „Office im
  Artikel“ (PowerPoint-Anhang) und der Klarwerk-Teil von H02 (Word-Add-in-Route
  `POST /api/drafts/from-docx` und Deep-Link). Geprüft werden die Abweichung mit beiden
  Fundstellen, die über den dauerhaften Weg gespeicherte Berichtigung, die den Hinweis aufhebt, und
  das Neuladen.

## Gemeinsame Abnahme · Belegzuordnung

Die vorhandenen Belege im integrierten Kandidaten. „E05“ heißt: eigener Beleg dieses Auftrags.

| Gemeinsames Kriterium | Beleg | Stand |
| --- | --- | --- |
| mehrere Bilder | E05: `widersprueche.test.ts` W1 (drei Bilder), W7 (zwei Bilder); Hostprobe H06 | belegt |
| gedrehte Texte | E01: `fundstelle-korrektur-mounted.test.tsx` E2, `klara-ocr-fundstelle-korrektur-browser.spec.ts` (K3); OCR-Basis: `klara-bildautomatik-browser.spec.ts` (gedrehter Text). E05 vergleicht erkannten Text; die Drehung wirkt nur auf Erkennung und Markierung | belegt (Elternbeleg) |
| absichtlicher OCR-Fehler | E05: W3, `fundstelle-korrektur-mounted.test.tsx` E9; E02: ebd. E4 | belegt |
| Tabellen | E05: W8 (aus Wortrahmen erkannte Tabelle, Abweichung in ihrer Zeile); OCR-02: `bildautomatik.test.ts` „Tabellen aus den Wortrahmen“, `klara-bildautomatik-browser.spec.ts` (bildhafte Tabelle). Bearbeitbare Tabellen sind OCR-E03 | E05-Teil belegt; E03 offen |
| mehrseitiger Scan | Kein Beleg im Kandidaten: das Lesen gescannter mehrseitiger PDFs (OCR-E04) ist nicht geliefert. E05-Teil: Fundstelle je Folie (Smoke: Folie 1 mit Hinweis, Folie 2 ohne) | **offen (E04)** |
| gemischtes Dokument | E05: W1 (Text + Bilder im Editor), Hostprobe H02 (Word-Datei mit Text und Bild), H06 (Folientext + Bild) | belegt |
| tatsächliche und scheinbare Zahlenabweichung | E05: W1, W2, W5, W6 | belegt |
| gezielt ausgewählter Bildbereich | Kein Beleg: die Bereichsfrage (OCR-E06) ist nicht geliefert | **offen (E06)** |
| Quellenzuordnung | E05: W1, W7; OCR-03: `kontext-klara.test.ts` C4; E01: `fundstellen-original.test.ts` | belegt |
| Korrekturpersistenz | E05: E9, Hostproben H02/H06; E02: `korrekturen-am-server.test.ts`, `korrekturen-pg.integration.test.ts` | belegt |
| Quellwechsel | E05: W7; E02: `korrektur-klara.test.ts` B4, `fundstelle-korrektur-mounted.test.tsx` E5 | belegt |
| Tabellenstruktur | E05: W8 (Zeilen und Spalten erhalten); OCR-02: `bildautomatik.test.ts` | E05-Teil belegt; E03 offen |
| Seitenvollständigkeit | E05: W7 (nicht gelesenes Bild: kein Hinweis, Quelle nicht vollständig); OCR-02: `bildautomatik.test.ts` K5 „Teilverarbeitung“. Mehrseitige Scans: OCR-E04 | E05-Teil belegt; E04 offen |
| Bereichsbezug | Kein Beleg: OCR-E06 nicht geliefert | **offen (E06)** |

## Offen (konkret)

- **Korrekturweg, aktuell:** Alle drei Flächen geben ihre Korrekturquelle an Befund- und
  Klara-Fläche weiter, und E05 bewertet dort den Stand MIT den gespeicherten Berichtigungen:
  - Editor/Entwurf: `entwurf:<id>` bzw. `ko:<id>`.
  - Office im Artikel: `office:<anhang>`.
  - Dateiweg im Erfassen: `datei:sha256:<Inhalt>|<Name>`, über `dokumentKorrekturQuelle` in
    `pages/Capture.tsx`.
  Belege: E05-Neubewertung nach Speichern und Neuladen im Editor in
  `tests/klara-bildanalyse-ocr/fundstelle-korrektur-mounted.test.tsx` (E9), in H02/H06 in
  `tests-smoke/klara-bild-widersprueche-hosts-browser.spec.ts`. Dass die Berichtigung im Dateiweg
  beim Wiedereinlesen erhalten bleibt, belegt der E02-Test
  `tests/klara-bildanalyse-ocr/datei-quelle-mounted.test.tsx` (Q1). Eine eigene E05-Probe nach
  Berichtigung im Dateiweg gibt es nicht; dort wirkt dieselbe Komponente.
- **Noch nicht verknüpft:** Die Fundstelle einer Abweichung führt noch nicht in die E01-Ansicht mit
  markiertem Bereich.
- *Historisch, 17.10.2026 (Nacharbeit 6, Kandidat `3d7dba5c`), überholt:* Dort stand, der Dateiweg
  im Erfassen habe keine gespeicherte Quelle und deshalb keine dauerhafte Berichtigung. Das war
  falsch; richtig ist der Korrekturweg oben.
- *Historisch, Stand vor der Integration bis 17.10.2026 (Kandidat `d02d358f`), überholt:* Gezeigt wird die Bildfundstelle als Quelle · Folie/Bild · Zeile,
  noch nicht als markierter Bereich am Original (E01). Die Neubewertung nach Berichtigung ist an der
  Befundform von E02 geprüft (berichtigter Text an der Stelle des Rohtexts). Die dauerhafte
  E02-Berichtigung im Konto ist erst nach Integration der tatsächlichen E02-Lieferung angebunden
  und dann erneut zu prüfen.
- **Hosts:** geprüft sind der Dateiweg im Browser, H06 „Office im Artikel“ und der Klarwerk-Teil von
  H02. Nicht prüfbar im Prüfaufbau: die Bedienung IN Word (kein Word mit eingespieltem Add-in), der
  Office-Editor (Collabora/WOPI nicht eingerichtet) und PowerPoint als Host (es gibt kein
  PowerPoint-Add-in, dokumentierte Grenze H03; ein neues natives Add-in ist nicht beauftragt). Sie
  bleiben vor einer Gesamtabnahme offen.
- **Erkennungsgrenzen:** Namen nur in der Form „Bezeichnung: Name“. Der Bezug wird je Satz bzw.
  Bildzeile bestimmt; steht ein Zeitraum nur in einer Bildüberschrift, entsteht eher kein Hinweis
  als ein unbegründeter. Bildbeschreibungen (W02) werden nicht verglichen, nur erkannter Bildtext.
- Bearbeitbare Tabellen (E03), mehrseitige Scans (E04) und die Bereichsfrage (E06) sind nicht
  geliefert. Ihre Implementierung gehört nicht in diesen Auftrag; die gemeinsamen Kriterien dafür
  bleiben bis zu deren Lieferung offen (siehe Belegzuordnung).
