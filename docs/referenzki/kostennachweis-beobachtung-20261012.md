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

Zur Einordnung steht unten ein **Referenzwert aus dem Modellwissen des Bearbeiters** (Wissensstand
bis Juni 2026, nicht datiert abgerufen): die öffentliche Listenpreisangabe von Anthropic für
Claude Sonnet 4.x. Für Anfragen bis 200 000 Eingabetoken sind das **3 USD je Million
Eingabetoken** und **15 USD je Million Ausgabetoken**. Zusatzpositionen der Liste:
Cache-Schreiben/-Lesen, Batch-Rabatt, Websuche/Werkzeuge und ein Langkontext-Zuschlag über
200 000 Token. Alle Zusatzpositionen fallen **für diesen Lauf nach dem Code nicht an**: kein
`cache_control`, keine Werkzeuge, kein Batch, Eingabe unter 1 000 Token. Peter (Entscheidung 13)
oder ein Chat mit Quellenzugang muss diesen Referenzwert gegen die Preisseite oder den Vertrag
prüfen und mit Datum bestätigen oder ersetzen, siehe `tarif-kostenstelle-vorlage.md`.

## Kostenrechnung des Laufs

Formel je Versuch: `Eingabe × Eingabepreis / 10^6 + Ausgabe × Ausgabepreis / 10^6`. Das ist
dieselbe Rechnung wie `kostenEinesLaufs` in `services/model-runs/src/preisliste.ts`.

Mit dem **unverifizierten Referenzwert** 3 / 15 USD je Million Token:

| Fall | Kosten USD |
| --- | ---: |
| korrekter_beleg | 0.004062 |
| teilweise_gedeckt | 0.004017 |
| gegenpassage | 0.004203 |
| sachfremde_quelle | 0.004056 |
| prompt_injection | 0.004113 |
| **gemeldeter Verbrauch gesamt** | **0.020451** (Eingabe 0.011961 + Ausgabe 0.008490) |

Allgemein, für jede bestätigte Preisliste: Kosten = 3987 × Eingabepreis / 10^6 + 566 ×
Ausgabepreis / 10^6, zuzüglich des Anteils des abgebrochenen Versuchs (s. u.).

## Abgebrochener Versuch (Prüferausfall)

- Das Zeitlimit von 1 ms hat den Aufruf über das Abbruchsignal bis in den Transport abgebrochen.
  Das Laufprotokoll trägt `status: error` und einen Versuch mit Modell, aber `verbrauch: null`.
- **Unbekannter Verbrauch ist kein Nachweis für null Kosten.** Deshalb rechnet `kostenEinesLaufs`
  dafür bewusst keine Kosten. Ob die Anfrage den Anbieter erreicht hat, lässt sich aus dem Lauf
  nicht sagen.
- Behandlung als **Spanne statt Schätzung**:
  - Untergrenze 0 Token: Die Anfrage hat den Anbieter nicht erreicht oder wurde nicht berechnet.
  - Obergrenze: Das Prüfpaket ist dasselbe wie beim korrekten Beleg, also wohl 799 Eingabetoken.
    Dazu kommt höchstens das Antwortbudget von `REFERENZ_ANTWORT_MAX_TOKEN` = 1500 Ausgabetoken
    (`services/ask/src/referenz-pruefung.ts`).
  - Mit dem Referenzwert ergibt das 0 bis **0.024897 USD** (799 × 3 / 10^6 + 1500 × 15 / 10^6).
- **Gesamtkosten des Laufs** mit dem Referenzwert: **0.020451 bis 0.045348 USD**. Den genauen Wert
  für den abgebrochenen Versuch kann nur die Anbieterabrechnung für den 2026-10-12, 12:23:55Z,
  belegen.

## Zuordnung

- Kostenstelle: Im Produkt gibt es keine. Die Zuordnung trifft Peter als Betreiberverantwortlicher
  im PoC (Entscheidung 13) mit `tarif-kostenstelle-vorlage.md`.
- Nach Bestätigung der Preisliste wird sie über die bestehende sichere Einspeisung als
  `KLARWERK_KI_PREISLISTE` gesetzt. Künftige Läufe berechnen die Kosten dann selbst
  (`kostengrundlage.kostenGesamt`). Versuche ohne gemeldeten Verbrauch zählt der Bericht seit dieser
  Runde gesondert (`versucheOhneVerbrauch`). Gibt es solche Versuche, kennzeichnet er
  `kostenGesamt` mit `nurGemeldeterVerbrauch: true`: Es ist dann ausdrücklich nur die Summe des
  gemeldeten Verbrauchs, keine vollständige Summe.
