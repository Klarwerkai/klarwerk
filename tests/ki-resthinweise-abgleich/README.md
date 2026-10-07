# KI-RESTHINWEISE-ABGLEICH

Auftrag `aufnahme:20260922:ki-resthinweise`: Die Hinweise aus 3248/3366 zu Streaming- und
Antwortgrenzen gegen den heutigen Code und die heutigen Tests abgleichen. Grundlage sind die drei
Kriterien des Auftrags. Der Wortlaut der Hinweise (`AUFTRAG-KI-RESTHINWEISE-ABGLEICH.txt`) liegt
außerhalb des Produktbaums und wurde hier nicht gelesen. Im Produktbaum ist 3366 als
KI-FRAGMENT-SICHTBAR belegt, die zugrunde liegende Chokepoint-Meldung als JOB 3239. Ein Code- oder
Testvermerk „JOB 3248" existiert im Produktbaum nicht.
**Arbeitsart: Belegabgleich.** Es gibt keine Produktänderung, keinen neuen 400-Defekt und keine
erneute Grundreparatur.

Stand des Abgleichs: Basis `863a0974`. Die Hinweise wurden gegen den Quelltext geprüft. Die neue
Datei `restfaelle.test.ts` wurde hier **nicht ausgeführt**; sie läuft im Prüflauf.

## Gemeinsamer Ort aller Fälle

`requireChatContent` in `services/reasoner/src/model-client.ts` ist der einzige Ort, an dem eine
`/chat/completions`-Antwort zum Ergebnis wird. Text- und Bildweg (`completeVision`) laufen beide
über `postChatCompletions` dorthin. Der Code liest `finish_reason` nur von `choices[0]`. Als
Abbruch gilt allein der exakte Wert `"length"`.

Echtes SSE-Streaming (`stream: true`) gibt es im Reasoner nicht. Die Mehr-Chunk-Lage entsteht
dadurch, dass `ModelProvider.extract` ein Dokument in Abschnitte aufteilt (`chunkForExtract`) und
für jeden Abschnitt einen eigenen Modellaufruf macht.

## Zuordnung je Fall

| # | Fall | Heutiges Verhalten (Quelle) | Vorhandener Beleg | Neu ergänzt |
|---|------|-----------------------------|-------------------|-------------|
| 1a | Mehr-Chunk: mehrere Abschnitte reißen am Limit ab | Pro abgeschnittenem Abschnitt schreibt der Code eine eigene Serverzeile (`meldeAbgeschnitteneModellantwort`). Das Feld `ExtractResult.abgeschnitten` enthält den **zuletzt** gemeldeten Befund (`provider-model.ts`, Schleife in `extract`; Vertrag in `types.ts` an `ExtractResult.abgeschnitten`). | G1 (`tests/ki-abgeschnittene-antwort/fragment-ist-kein-ergebnis.test.ts`) prüft nur zwei Aufrufe direkt am Client. G3 und T1d (`tests/ki-fragment-sichtbar/vertrag-abbruchfeld.test.ts`) prüfen nur `extract` mit **einem** Abschnitt. V2 (`tests/ki-lauf-verbrauch/mehrfachaufruf.test.ts`) prüft drei Abschnitte, aber nur den Verbrauch. | **R1a** |
| 1b | Mehr-Chunk: ein vollständiger Abschnitt folgt einem abgeschnittenen | Der Befund bleibt erhalten, denn `abbruch` wird nur bei einem gemeldeten Befund überschrieben. | keiner | **R1b** |
| 1c | Mehr-Chunk mit nur fremden `finish_reason`-Werten | Es entsteht weder eine Serverzeile noch das Feld. | G2 prüft nur einen Aufruf am Client. T2 prüft nur den Antwortweg. | **R1c** |
| 2 | Leerer Inhalt (`""`, nur Leerraum, `null`) mit fremdem `finish_reason` (`content_filter`, `tool_calls`, `LENGTH`) | Ergibt `ModelEmptyResponseError` mit `reason: "empty"`, nicht `truncated`. `finishReason` enthält den Anbieterwert unverändert, auch in der Meldung (`finish_reason=<Wert>`). Es gibt keine Abschnittszeile. | Fall (a) in `tests/reasoner/local-empty-response.test.ts` prüft `stop` mit Denktext → `reasoning-only`. `assist-budget-und-anweisung.test.ts` prüft `stop` mit `""`. D prüft eine fehlende `choices`-Liste. Mit **fremdem** Wert ohne Inhalt gibt es keinen Fall. | **R2** (3 Werte × 3 Inhaltsformen) |
| 3a | Bildweg: wiederholte `length`-Antworten | Pro Bildaufruf entsteht eine eigene Serverzeile. Das Fragment kommt unverändert beim Aufrufer an. | E prüft nur **einen** Bildaufruf. G1 prüft die Wiederholung nur auf dem Textweg. | **R3a** |
| 3b | Bildweg: fremder `finish_reason` mit Inhalt | Der Inhalt bleibt unverändert, und es entsteht keine Zeile. | G2 prüft das nur auf dem Textweg. | **R3b** |
| 3c | Bildweg: fremder `finish_reason` ohne Inhalt | Ergibt `empty` mit dem unveränderten Anbieterwert. Das Budget (`maxTokens`) entspricht dem Bildbudget. | P6 in `tests/openai-anbieterfalle/openai-budget-parameter.test.ts` prüft nur `length` ohne Inhalt. | **R3c** |

## Offene Grenze (benannt, nicht repariert)

- **Bildweg ohne Feld `abgeschnitten`.** `ModelProvider.describeImage` ruft `completeVision`
  außerhalb von `mitAbbruchBefund` auf. `DescribeImageResult` hat kein Feld `abgeschnitten`.
  Eine am Limit abgeschnittene Bildbeschreibung ist deshalb nur über die Serverzeile erkennbar
  (Fall E, R3a) und erreicht die Oberfläche nicht als Hinweis. Laut `abbruchFeld` in
  `provider-model.ts` bildet JOB 3366 das Feld nur für Antwort, Hilfe-Antwort und Extraktion.
  Ob der Bildweg dazugehören soll, ist eine **Auftragsentscheidung**. Dieser Abgleich leitet
  daraus keine Reparatur ab (Kriterium 3).
- **Nur `choices[0]` wird gelesen.** Weitere Einträge in `choices` mit eigenem `finish_reason`
  werden nicht ausgewertet. Der Client fordert kein `n > 1` an, daher ist das heute keine
  Prüflücke. Es bleibt aber eine Grenze der Aussage.
- **Groß- und Kleinschreibung.** `LENGTH` bzw. `Length` gelten absichtlich nicht als Abbruch
  (G2, R1c, R2, R3b). Der Befund wird nie geraten.

## Was ausdrücklich nicht abgeleitet wurde

Es wurde kein neuer 400-Defekt abgeleitet. Das Budgetfeld je Konfigurationsart (JOB 3222) ist
durch `tests/openai-anbieterfalle/openai-budget-parameter.test.ts` belegt. Es wurde auch keine
Wiederholung der Leerantwort-Reparatur (SCRUM-544) oder der Fragmentkennzeichnung (JOB 3366)
abgeleitet. Die neuen Fälle prüfen das bestehende Verhalten. Sie ändern weder Produktcode noch
bestehende Tests.
