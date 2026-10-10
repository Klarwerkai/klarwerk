# Referenz-KI-Prüfdienst (produkt:20261009:referenzki-pruefdienst · REF-02)

Ein gemeinsamer, ausschließlich **lesender** Dienst. Er prüft, ob die Fundstellen einer
ausgelieferten Antwort deren Aussagen tragen. Er erzeugt keine Antworten. Er ändert keine Quellen,
Artikel, Aufgaben oder Rechte und gibt nichts frei. „Vier-Augen" heißt hier: eine zweite KI prüft.
Es heißt nicht: menschliche Freigabe oder Fehlerfreiheit.

## Bausteine

| Teil | Ort |
| --- | --- |
| Prüfdienst (technische Prüfung, Prüfauftrag, Auswertung, Cache, Grenzen, erneute Prüfung) | `services/ask/src/referenz-pruefung.ts` |
| Aussagebindung und Prüfpaket (Bestand REF-01) | `services/ask/src/aussage-fundstellen.ts` |
| Prüferwahl aus der Adminliste, ein Aufruf über Laufbuch und Chokepoint | `Reasoner.referenzPruefer` in `services/reasoner/src/service.ts` |
| Tatsächliches Antwortmodell je Anfrage | `antwortRolleVon` (Reasoner) → `AskService.antwortRolleVon` |
| Einbindung in beide Antwortwege (Fragekonsole, Klara) | `antwortLauf` in `services/app/src/routes/ask-routes.ts` |
| Erneute Prüfung | `POST /api/ask/referenzpruefung/:pruefId/erneut` |
| Adminliste | `PUT /api/reasoner/config` mit `referenzpruefung: ["openai" \| "anthropic" \| "local", …]` |

## Ablauf je beantworteter Frage

1. **Technisch, ohne KI:** Jede Fundstelle wird mit den aktuellen Rechten des Fragenden in ihrer
   gebundenen Fassung neu aufgelöst (`loeseFundstelleAuf`). Nicht zugänglich, beschädigt, gelöscht,
   entfernt oder ersetzt heißt: kein Beleg. Links werden nie abgerufen. Ein Titel ist keine
   Fundstelle.
2. **Prüfer:** Der Dienst wählt die erste administrativ erlaubte Option. Sie muss eingerichtet und
   freigegeben sein und ein **anderes** tatsächliches Modell haben als die konkrete Antwort. Gibt es
   keine solche Option, bleibt der Nachweis offen (`pruefer_nicht_unabhaengig` u. a.). Es gibt
   keinen Ersatzmodus.
3. **Freigabe:** An einen externen Prüfer geht nur, was die bestehende Freigabe für externe
   Verarbeitung trägt. Der Rest ist `nicht_pruefbar` mit dem Grund
   `keine_freigabe_externe_verarbeitung`.
4. **Ein Aufruf:** Es gelten feste Grenzen: Eingabedeckel (40 Posten, 24 000 Zeichen),
   Antwortbudget (1 500 Token), Zeitlimit (25 s, das Client-Limit des Anbieters gilt zusätzlich)
   und der Anfrageabbruch. Es gibt keinen automatischen zweiten Versuch.
5. **Strikte Auswertung:** Gültig ist nur die erwartete JSON-Form. Gewertet werden nur gesendete
   Posten und nur deren Fundstellen. Ungültiges ergibt `nicht_pruefbar`.

Der wörtliche Antwortweg (`retrievalOnly`, Add-in) sichert null Modellaufrufe zu. Dort findet
keine Referenzprüfung statt. Das Ergebnis steht sichtbar als `nicht_pruefbar` mit dem Grund
`modellaufruf_ausgeschlossen` da.

## Versionierter Prüfauftrag

Die Prüfrichtlinie `referenzpruefung-v1` liefert `referenzPruefauftrag(locale)`. Der Systemteil
ist fest. Quell- und Antwortinhalte reisen ausschließlich als **eine JSON-Zeichenkette** im
Datenteil (`PRUEFDATEN`). Darin enthaltene Anweisungen sind Material. Sie können Richtlinie,
Modellwahl, Freigaben oder Ausgabeformat nicht ändern. Anweisungsähnlicher Text wird zusätzlich
als Hinweis ausgewiesen.

## Strukturiertes Ergebnis (`referenzpruefung` an der Antwort)

- `status`: `geprueft` oder `nicht_pruefbar`, dazu der benannte `grund`.
- `aussagen[]`: **genau ein** Zustand je Aussage: `belegt`, `teilweise_belegt`, `widersprochen`
  oder `nicht_pruefbar`. Jede Aussage trägt Fundstellen (Objekt, Fassung, Bereich) und eine
  Begründung, je Teilaussage einzeln. Eine fehlende Quelle ist nie ein Widerspruch.
- `hinweise[]`: Aktualität und Konflikte stehen getrennt von der Unterstützung (`neuere_fassung`,
  `abruf_nicht_belegt`, `bekannter_konflikt`, `gegenpassage`, `fundstelle_verworfen`,
  `nicht_aufgeloeste_modellangabe`, `anweisungsaehnlicher_text`).
- `globaleAktualitaet: "nicht_behauptet"`.
- `bindung`: Antwort-, Beleg-, Paket- und Ergebnisfingerabdruck sowie die Richtlinie. Ein
  Cachebeleg gilt nur bei exakt gleichem Paket, gleichem aktuellem Quellenstand, gleicher
  Richtlinie und gleichem tatsächlichem Prüfmodell. Die Rechte werden bei jedem Zugriff neu geprüft.
- `rollen`: Für den Fragenden zeigt das Feld nur Stufen. Anbieter und Modell beider Rollen stehen
  im Prüfprotokoll (Audit `ask.referenzpruefung`), zusammen mit Fingerabdrücken, Zustandszahlen,
  Dauer und Tokenverbrauch. Das Laufprotokoll erhält die Laufart `referenz`; die Kosten rechnet es
  mit der Preisliste des Betreibers.
- `versuch`: Nummer und Höchstzahl (erster Lauf plus höchstens eine ausdrücklich angestoßene
  erneute Prüfung).

## Nachweise

- Technische Simulation (Doppelgänger, kein Netz): `tests/referenzki-pruefdienst/`.
- Echte Modellbeobachtung der sieben fiktiven Fälle (korrekter Beleg, teilweise gedeckt,
  Gegenpassage, sachfremde Quelle, erfundener Link, Prompt-Injection, Prüferausfall):
  `scripts/referenzki/beobachtung.ts`. Das Skript läuft nur von Hand mit einem eingerichteten
  Anbieter. Sein Bericht ist ein eigener Beleg und ersetzt keine allgemeine Fehlerfreiheit.

## Offene Grenzen

- Für die Liste der erlaubten Referenz-KIs gibt es noch kein Bedienelement in der Adminfläche. Sie
  wird über den bestehenden, protokollierten Adminweg `PUT /api/reasoner/config` gesetzt.
- Die Fragefläche zeigt das Feld `referenzpruefung` noch nicht an. Es steht in der Antwort der
  Schnittstelle.
- Geprüft werden die Hauptantwort beider Antwortwege. Nicht geprüft werden die Antworten der
  Zweitmeinung (eigener Auftrag) und des Stichtagsvergleichs.
- Ein Anfrageabbruch beendet das Warten des Dienstes. Der bereits gestartete Anbieteraufruf läuft
  bis zu seinem Client-Zeitlimit weiter und wird protokolliert.
