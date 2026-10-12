# Kostennachweis der echten Modellbeobachtung vom 12.10.2026 (REF-02, K10)

Anlass: Ben nacharbeit-9. Der vorhandene Lauf wird anhand seiner Verbrauchsdaten ausgewertet, ohne
ihn zu wiederholen. Der unbekannte Verbrauch des abgebrochenen Versuchs wird ausdrücklich behandelt.
Die Kostenstellenvorlage bleibt `tarif-kostenstelle-vorlage.md`.

## Ausgewerteter Lauf (Beleg, unverändert)

- Prüfung `ref02-nacharbeit-7-modellbeobachtung-betreiberweg` am Kandidaten
  `12a2c0c96cc864871fb75e66f3d471bba88e8f31`, voller Smoke, Projekt `chromium`, Start
  2026-10-12T12:23:43Z. Datei: `HISTORIE/nacharbeit-9/PRUEFUNG/ref02-nacharbeit-7-modellbeobachtung-betreiberweg.json`,
  Anhang `beobachtung.json` (Laufprotokoll je Versuch).
- Prüfmodell: `claude-sonnet-4-6` (Anbieter `anthropic`). Antwortrolle: Fixtur `fixtur-antwort`.
- 6 Prüfläufe mit Modell, je **genau 1 Versuch**: Es gab keine Wiederholung, `versucheGesamt` = 6.
  Der erfundene Link hat keinen Aufruf.

| Fall | Status Lauf | Dauer ms | Eingabe-Token | Ausgabe-Token |
| --- | --- | ---: | ---: | ---: |
| korrekter_beleg | success | 2170 | 799 | 111 |
| teilweise_gedeckt | success | 2306 | 779 | 112 |
| gegenpassage | success | 2556 | 796 | 121 |
| sachfremde_quelle | success | 2585 | 792 | 112 |
| prompt_injection | success | 2137 | 821 | 110 |
| prueferausfall | error (Zeitlimit 1 ms) | 2 | **unbekannt** | **unbekannt** |
| erfundener_link | kein Aufruf | 0 | 0 | 0 |
| **Summe gemeldet** | | 11756 | **3987** | **566** |

Gemeldet heißt: Der Anbieter hat den Verbrauch in seiner Antwort (`usage`) zurückgegeben, und das
Laufprotokoll hat ihn je Versuch festgehalten.

## Tarifgrundlage — Stand und offene Voraussetzung

**Eine datierte, gegen die Anbieterquelle verifizierte Preisliste liegt NICHT vor.** In dieser
Arbeitsumgebung gibt es keinen Webzugriff. Das Repository enthält keine Anbieterpreisliste; die
Werte in `tests/ki-lauf-protokoll/*` sind Testfixturen mit `EUR` und `preisstand` 2026-10-01 und
damit keine Tarifquelle. Ein Preis wird deshalb nicht als Beleg ausgegeben.

Ben nacharbeit-10: Die frühere Rechnung mit Preisen aus dem Modellwissen des Bearbeiters ist
**entfernt**. Unverifizierte Preise sind kein Tarifnachweis, auch nicht als Einordnung. Die
Arbeitsumgebung hat keinen Webzugriff: Sowohl ein Abruf der Preisseite des Anbieters als auch ein
Hilfsskript zum Auslesen des Berichts wurden ohne Freigabe abgelehnt. Eine Vertragsquelle liegt im
Auftragsbestand nicht vor. **Offene Voraussetzung:** Peter (Entscheidung 13) oder ein Chat mit
Quellenzugang muss die datierte Anbieter- oder Vertragsquelle für `anthropic`/`claude-sonnet-4-6`
liefern. Dazu gehören Quelle, Abrufdatum, Währung, Eingabe- und Ausgabepreis sowie die
Zusatzpositionen der Liste.

Zusatzkosten, unabhängig vom Preis aus dem Code bestimmt: Die Prüfaufrufe senden kein
`cache_control`, keine Werkzeuge und keine Websuche, laufen nicht über Batch, und ihre Eingabe liegt
unter 1 000 Token. Cache-, Werkzeug-, Batch- und Langkontextpositionen gelten für diesen Lauf also
nicht. Ob sonstige Positionen wie Steuern oder Gebühren anfallen, belegt nur Quelle oder Abrechnung.

## Kostenrechnung des Laufs — sofort ausführbar, sobald die Quelle vorliegt

Formel je Versuch: `Eingabe × Eingabepreis / 10^6 + Ausgabe × Ausgabepreis / 10^6`. Das ist
dieselbe Rechnung wie `kostenEinesLaufs` in `services/model-runs/src/preisliste.ts`.

Gemeldeter Verbrauch des Laufs: **3987 Eingabe- und 566 Ausgabetoken**. Die Kosten des gemeldeten
Verbrauchs sind also `3987 × Eingabepreis / 10^6 + 566 × Ausgabepreis / 10^6`, in der Währung der
Quelle.

Die Auswertung ohne neuen Modelllauf:

```
npx tsx scripts/referenzki/kosten-auswerten.ts --bericht <Anhang beobachtung.json> --tarif <tarif.json>
```

Das Skript nutzt `tests/referenzki-pruefdienst/kostenauswertung.ts`. Die Tarifdatei braucht
`quelle`, `abgerufenAm` und die Preisliste in Produktform; ohne datierte Herkunft rechnet es nicht.
Es gibt die Kosten je Versuch und die Summe des gemeldeten Verbrauchs aus und führt Versuche ohne
gemeldeten Verbrauch getrennt unter `unbekannt` (`vollstaendig: false`). Die Rechnung ist mit
fiktiven Preisen und dem echten Verbrauch dieses Laufs geprüft (`kostenauswertung.test.ts`).

## Abgebrochener Versuch (Prüferausfall)

- Das Zeitlimit von 1 ms hat den Aufruf über das Abbruchsignal bis in den Transport abgebrochen.
  Das Laufprotokoll trägt `status: error` und einen Versuch mit Modell, aber `verbrauch: null`.
- **Unbekannter Verbrauch ist kein Nachweis für null Kosten.** Deshalb rechnet `kostenEinesLaufs`
  dafür bewusst keine Kosten. Ob die Anfrage den Anbieter erreicht hat, lässt sich aus dem Lauf
  nicht sagen.
- Behandlung (Ben nacharbeit-10): Die Kosten dieses Versuchs sind **unbekannt**. Sie gehen weder
  als 0 noch als angenommene Obergrenze in eine Summe ein. Die Kosten des Laufs sind deshalb
  ausdrücklich nur die Kosten des **gemeldeten** Verbrauchs, zuzüglich eines getrennt ausgewiesenen
  unbekannten Anteils.
- Zur Einordnung, nicht als gesicherter Wert: Das Antwortbudget des Prüfdiensts begrenzt jede
  Prüfantwort auf `REFERENZ_ANTWORT_MAX_TOKEN` = 1500 Ausgabetoken
  (`services/ask/src/referenz-pruefung.ts`). Was der Anbieter für einen nach 2 ms abgebrochenen
  Aufruf tatsächlich berechnet, belegt nur seine Abrechnung für 2026-10-12, 12:23:55Z.

## Zuordnung

- Kostenstelle: Im Produkt gibt es keine. Die Zuordnung trifft Peter als Betreiberverantwortlicher
  im PoC (Entscheidung 13) mit `tarif-kostenstelle-vorlage.md`.
- Nach Bestätigung der Preisliste wird sie über die bestehende sichere Einspeisung als
  `KLARWERK_KI_PREISLISTE` gesetzt. Künftige Läufe berechnen die Kosten dann selbst
  (`kostengrundlage.kostenGesamt`). Versuche ohne gemeldeten Verbrauch zählt der Bericht seit dieser
  Runde gesondert (`versucheOhneVerbrauch`). Gibt es solche Versuche, kennzeichnet er
  `kostenGesamt` mit `nurGemeldeterVerbrauch: true`: Es ist dann ausdrücklich nur die Summe des
  gemeldeten Verbrauchs, keine vollständige Summe.
