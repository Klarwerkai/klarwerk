# L01 · Der Wortlaut der fünf Kernfragen fehlt

**Betrifft:** Q1–Q5 (alle Zeilen der Matrix).

**Befund (13.10.2026, Basis `550807b9`, `1.0.0-beta.1.954`):** Weder der Produktbaum noch
`QUELLEN.json` des Auftrags nennen die fünf Kernfragen des Hauses im Wortlaut. R-1384 spricht von
„den fünf Kernfragen“, zählt sie aber nicht auf. Die einzige benannte Herkunft ist die Altquelle
`03_AUFTRAEGE/basic_pausiert/MAKROAUFTRAG-BASIC2-JOB-797-D1-W2-Q1-Q5-QUELLENMATRIX.md` vom
14.08.2026 (Feld `altbestand.herkunft` in R-1384). Sie liegt im alten Projektverzeichnis außerhalb
der für diesen Auftrag erlaubten Bereiche und wurde in diesem Lauf nicht gelesen.

**Gesucht und nicht gefunden** (Produktbaum, ohne `node_modules`): „Kernfrage“ im Sinn des Hauses,
„Quellenmatrix“, „fünf Fragen“, „Leitfrage“, „des Hauses“, „W2-Q1“. Die Treffer zu „Kernfrage“ meinen
etwas anderes (siehe Abgrenzung in der `README.md`).

**Folge:** Für keine Frage lässt sich erheben, welche Quelle sie beantwortet. Die Matrix trägt
deshalb `frage: null` und `antwort_quelle: null`. Eine Frage zu raten, wäre eine neue Anforderung
jenseits der Quellen.

**Schließt sich durch:** Den Wortlaut von Q1–Q5 aus der Altquelle oder aus der JOB-813-Lieferung
(L02) in die Matrix übernehmen. Danach je Frage die beantwortende Quelle im Produktbaum erheben.
