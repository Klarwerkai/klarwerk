# Produktbudgets (Claude, ChatGPT, Perplexity)

*produkt:20261013:produktbudget-anwender-admin*

## Bedienort

Verwaltung › KI › **Produktbudgets** (`/admin?bereich=ki&detail=produktbudget`). Lesen und Ändern
nur mit `users.manage` (Admin), am Server geprüft (`GET`/`PUT /api/admin/produktbudget[/:bereich]`).

## Bereiche (Originalvorgaben vom 13.10.2026)

| Bereich | Anbieter | Vorgabe | Zeitraum | Anschluss |
| --- | --- | --- | --- | --- |
| `perplexity-poc` | `perplexity` | 20,00 EUR — ersetzt die frühere Empfehlung 30 USD/Monat für diesen PoC | einmalig, ohne Erneuerung | BPA-12 (`produkt:20261011:assistenz-recherche-perplexity`) |
| `nr32-claude` | `anthropic` | 20,00 EUR | **offen** — Aufteilung/Zeitraum gefragt, unbeantwortet | P03 (`produkt:20261011:peter-p03`) |
| `nr32-chatgpt` | `openai` | 20,00 EUR | **offen** — wie oben | P03 (`produkt:20261011:peter-p03`) |

Ein offener Zeitraum gibt nichts frei. Ihn festzulegen verlangt einen Beleg (Feld „Grund oder
Beleg“). Einen monatlichen Zeitraum gibt es nicht: das Produkt erneuert nichts automatisch.

## Regeln

* **Kein zweites Kostensystem.** Die Bereiche sind die persistente Fassung des vorhandenen
  Kostenbuchs der Fähigkeiten (`Kostenbuch`, G18, `services/app/src/assistenz-faehigkeiten.ts`).
* **Geld ganzzahlig.** Beträge in Cent; Eingabe „20“, „20,50“ oder „20.5“; 0 erlaubt (stoppt den
  Kostenweg), negativ/ungültig/über 10 000 wird abgewiesen.
* **Buchungen bleiben.** Eine Änderung von Betrag, Währung oder Zeitraum bucht, löscht und setzt
  nichts zurück. Nach einer Senkung stehen Verbrauch und „über dem Betrag“ sichtbar da. Mit
  Buchungen ist die Währung gebunden (keine Umetikettierung). Der Bestandsreset lässt die Tabelle
  `produktbudget` stehen.
* **Deckel.** Vor einem kostenpflichtigen Aufruf wird atomar reserviert (Vergleich-und-Tausch auf
  die Mandantenzeile): passender Anbieter, passende Tarifwährung, festgelegter Zeitraum, genug Rest.
  Je Auftragskennung höchstens eine Buchung — Wiederholung und Wiederanlauf buchen nicht doppelt.
  Nach Fehler oder Zeitlimit bleibt die Reservierung stehen (Abrechnung unbekannt).
* **Änderungsprovenienz.** Je Änderung Kennung, Zeitpunkt, Kontokennung, vorher/nachher, Grund —
  keine Schlüssel, keine Tokens. Dazu ein Prüfprotokolleintrag `produktbudget.geaendert`.
* **Unklarer Ausgang, Konflikt.** Jede Änderung trägt eine Änderungskennung; dieselbe Kennung wirkt
  höchstens einmal. Eine veraltete Fassung ergibt 409 samt aktuellem Stand; die Oberfläche behält
  die Eingabe.
* **Eine Budgetänderung ist keine Anbieteraufladung, keine Kontoumstellung und keine
  Tokenfreigabe.** Anbieterfreigabe, Zugang (sicherer Credentialweg) und Adapter bleiben eigene
  Voraussetzungen.

## Anschluss eines ursprünglichen Funktionsauftrags

Ein Fähigkeitsvertrag schließt an, indem er `kostenzuordnung` auf die Bereichskennung setzt und
einen **belegten** Tarif trägt (`grenzen.kostenJeAufrufCent` > 0 und `grenzen.kostenWaehrung`).
Ohne Tarifwährung, bei anderem Anbieter oder offenem Zeitraum gibt das Kostenbuch nichts frei.
Wer außerhalb der Fähigkeiten bucht (z. B. die P03-Proben über den Reasoner), nutzt dieselben
Aufrufe `reserviere`/`verbuche` des Dienstes `Produktbudget` mit derselben Bereichskennung.

Heute trägt kein Vertrag eine Zuordnung: Perplexity bleibt ohne Adapter, Zugang, belegten Tarif und
Anbieterfreigabe gesperrt. Tatsächliche Such-/Modellabschlüsse bleiben Pflicht der ursprünglichen
Aufträge.

## Haltbarkeit

Postgres-Betrieb: Tabelle `produktbudget` (eine Zeile je Mandant, `PRODUKTBUDGET_SCHEMA`, additiv),
im Dump und in der Pflichtliste des Restore-Drills.

Desktop-Journalbetrieb: eigene Journalart `produktbudget.ersetze` (`services/app/src/dev-persist.ts`).
Jede Änderung, Reservierung und Buchung wird ERST als Zeile angehängt und erst danach im Speicher
wirksam; scheitert das Anhängen, scheitert der Vorgang — bestätigt wird nichts ohne Zeile. Beim
Start spielt `buildDevPersistServices` die Zeilen in derselben Reihenfolge zurück.

Nur der reine Speicherbetrieb (ohne Datenbank und ohne Journal, z. B. Prüfserver) hält den Stand
bis zum Neustart.

Der Firmenreset im Journalbetrieb erhält die Produktbudget-Zeilen (`FIRMENRESET_ERHALTEN`):
Einstellungen, Provenienz, Verbrauch und Reservierungen bleiben, der verbliebene Deckel gilt nach
dem Wiederöffnen weiter (PBE-06).

Die Antwort einer Änderung trägt `bestaetigteFassung` — die Fassung, die genau diese Änderung im
atomaren Vorgang hergestellt hat. Der mitgelieferte Stand ist danach gelesen und kann schon fremde
Änderungen enthalten; eine Folgeeingabe beruht deshalb auf `bestaetigteFassung`, und eine
zwischenzeitliche Fremdänderung ergibt beim nächsten Speichern 409.

## Kostenidentität

Eine Buchung gehört zu genau einer Ausführung: Konto, Auftragskennung (je Konto eindeutig) und
Versuch. Dieselbe Ausführung reserviert höchstens einmal, und ihre Wiederholung wird nur mit gleichem
Betrag und gleicher Währung bestätigt. Ein anderes Konto mit derselben Auftragskennung und jeder
weitere Versuch (etwa nach einem Fehlschlag) sind eigene kostenwirksame Aufrufe und zählen eigens
gegen den Deckel.

Eine Einstellungsänderung wird nur dann als Wiederholung bestätigt, wenn Kennung, Konto, Bereich,
Grundfassung und Nutzlast übereinstimmen; eine bekannte Kennung mit anderer Eingabe ergibt 409
(`aenderung`).
