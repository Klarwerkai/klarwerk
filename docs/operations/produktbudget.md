# Produktbudgets (Claude, ChatGPT, Perplexity)

*produkt:20261013:produktbudget-anwender-admin*

## Bedienort

Verwaltung › KI › **Produktbudgets** (`/admin?bereich=ki&detail=produktbudget`). Gesamtbetrag und
Zuweisungen je Konto nur mit `users.manage` (Admin), am Server geprüft
(`GET`/`PUT /api/admin/produktbudget[/:bereich[/konten/:konto]]`).

Profil › Meine Assistenz › Fähigkeiten › **Mein Budget für kostenpflichtige Aufrufe**: jedes Konto
mit `ko.read` sieht seine Zuweisung, seine Belegung und seinen Rest und setzt sein eigenes
Unterlimit (`GET /api/me/produktbudget`, `PUT /api/me/produktbudget/:bereich`).

## Bereiche (Originalvorgaben vom 13.10.2026, PBE-12)

Peter hat am 13.10.2026 bestätigt: je 20 EUR für Claude, ChatGPT und Perplexity als **einmaliges
PoC-Gesamtbudget**. Die frühere Budget32-Frage ist damit beantwortet.

| Bereich | Anbieter | Vorgabe | Zeitraum | Anschluss |
| --- | --- | --- | --- | --- |
| `perplexity-poc` | `perplexity` | 20,00 EUR — ersetzt die frühere Empfehlung 30 USD/Monat für diesen PoC | einmalig, ohne Erneuerung | BPA-12 (`produkt:20261011:assistenz-recherche-perplexity`) |
| `nr32-claude` | `anthropic` | 20,00 EUR | einmalig, ohne Erneuerung | P03 (`produkt:20261011:peter-p03`) |
| `nr32-chatgpt` | `openai` | 20,00 EUR | einmalig, ohne Erneuerung | P03 (`produkt:20261011:peter-p03`) |

**Übernahme gespeicherter Stände.** Ein gespeicherter Stand, der Claude/ChatGPT noch mit Zeitraum
`offen` führt, wird beim ersten Lesen genau einmal auf `einmalig` übernommen und sofort gespeichert
(Postgres, Journal). Betrag, Währung, Buchungen und Reservierungen bleiben; die Übernahme steht als
eigener Änderungsvermerk „Vorgabe Peter 13.10.2026“ da (`uebernahmen` im Stand verhindert eine
Wiederholung — eine spätere bewusste Änderung der Verwaltung bleibt). Kein Monatswechsel, kein
Neustart und kein anderer Prozess erneuert die Periode; es gibt keinen monatlichen Zeitraum.

Ein offener Zeitraum (nur noch, wenn die Verwaltung ihn bewusst setzt) gibt nichts frei. Ihn
festzulegen verlangt einen Beleg (Feld „Grund oder Beleg“).

## Zuweisung und Anwender-Unterlimit (PBE-12)

* Die Verwaltung setzt je Bereich und Konto eine **Zuweisung** (höchstens der Gesamtbetrag). Ohne
  Zuweisung gilt für das Konto der Gesamtbetrag.
* Jedes Konto setzt sein **Unterlimit** selbst, höchstens bis zur erlaubten Zuweisung.
* Die Kostenprüfung (`reserviere`) hält im selben atomaren Schritt Unterlimit, Zuweisung UND
  Gesamtdeckel ein; gezählt wird, was das Konto in diesem Bereich verbucht und reserviert hat.
* Senkt die Verwaltung eine Zuweisung unter ein bestehendes Unterlimit, gilt das kleinere.

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
