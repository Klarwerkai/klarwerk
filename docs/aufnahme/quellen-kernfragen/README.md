# Aufnahme 20260922 · Quellen zu den Kernfragen: Zuordnung geliefert / vorhanden / offen

Auftrag `aufnahme:20260922:gesamt-quellen-kernfragen` („Kernfragen des Projekts mit Quellen und
benannten Lücken belegen“), Lauf 1 vom 13.10.2026. Basis `550807b9` (`1.0.0-beta.1.954`). Die
Fassung, in der dieser Lauf ausgeliefert wird, steht erst nach der Veröffentlichung fest. Bis dahin
ist „dieser Lauf“ der Kandidat auf dieser Basis.

Quelle des Anliegens: `QUELLEN.json` des Auftrags, einziger Punkt **R-1384** „Quellenmatrix zu den
fünf Kernfragen“ (Altkennung F-1384). Der Punkt verlangt: „Für die fünf Kernfragen des Hauses ist
erhoben, welche Quelle sie jeweils beantwortet und wo Belege fehlen. Die Lücken stehen benannt in
einem eigenen Verzeichnis.“

## Was dieser Lauf liefert

| Teil | Ort |
|---|---|
| Matrix Q1–Q5: je Frage Wortlaut, Herkunft der Frage, beantwortende Quelle, Stand, Lücken | `quellenmatrix.json` |
| Eigenes Verzeichnis der Lücken, eine Datei je Lücke | `luecken/` |
| Prüfung, dass Matrix und Verzeichnis zusammenpassen | `tests/quellen-kernfragen/matrix-und-luecken.test.ts` |

## Ergebnis der Erhebung

**Für keine der fünf Kernfragen ist heute eine beantwortende Quelle erhoben.** Der Grund ist nicht
die Antwort, sondern die Frage: Ihr Wortlaut steht weder im Produktbaum noch in `QUELLEN.json`. Die
Matrix hält die fünf Zeilen deshalb mit `frage: null` und `stand: "luecke"` fest. Eine Frage zu
raten, wäre eine neue Anforderung jenseits der Quellen.

| Kernfrage | Wortlaut | Beantwortende Quelle | Lücken |
|---|---|---|---|
| Q1 | nicht in den zugänglichen Quellen | nicht erhebbar | [L01](luecken/L01-wortlaut-der-fuenf-kernfragen.md), [L02](luecken/L02-lieferung-job-813-nicht-im-produkt.md) |
| Q2 | nicht in den zugänglichen Quellen | nicht erhebbar | L01, L02 |
| Q3 | nicht in den zugänglichen Quellen | nicht erhebbar | L01, L02 |
| Q4 | nicht in den zugänglichen Quellen | nicht erhebbar | L01, L02 |
| Q5 | nicht in den zugänglichen Quellen | nicht erhebbar | L01, L02 |

Diese Lücken betreffen die ganze Erhebung:

- [L03](luecken/L03-quell-ids-ohne-fundstelle.md): Genannte Quell-IDs (Beleglückenmanifest,
  Quellenwegkarte, JOB 797–856) haben keine Fundstelle.
- [L04](luecken/L04-widersprueche-in-der-quelle.md): Widersprüche innerhalb der Quelle (Stand,
  Datum, Kategorie, fehlende Begründung).
- [L05](luecken/L05-quellpakete-nicht-nachgelesen.md): Die Quellpakete der Aufnahme sind nicht
  nachgelesen, die Prüfsummen nicht nachgerechnet.

## Zuordnung geliefert / vorhanden / offen

| Anliegen | Stand | Fassung | Beleg |
|---|---|---|---|
| R-1384 Lückenverzeichnis | **geliefert in diesem Lauf** | dieser Lauf | `luecken/`, `tests/quellen-kernfragen/matrix-und-luecken.test.ts` |
| R-1384 Quelle je Kernfrage | **offen**: Wortlaut der Fragen fehlt (L01) | — | `quellenmatrix.json`, Zeilen Q1–Q5 |
| R-1384 frühere Lieferung JOB 813 | **nicht im Produkt**, die Altaussage „kein Commit im Produkt gefunden“ hält auch heute | historisch: JOB 813 D2, BEN7 GRÜN 16.08. (Altquelle) | L02, heutige Suche im Produktbaum ohne Treffer |

## Abgrenzung

- **Getrennt geführt laut Quelle** (R-1384, Notiz): „das Quellenmanifest zu den Betriebsbefunden
  N1-N8 und die Quellenwegkarte zum eingefrorenen Stand“. Beides gehört nicht zu diesem Auftrag und
  wurde hier weder erhoben noch geändert.
- **Gleiches Wort, anderer Gegenstand** (gefunden und ausgeschlossen):
  - `docs/operations/maintenance-update-process.md` §8 Schritt 3, „Kernfragen testen“: Fachfragen
    an Klara beim Modellwechsel, nicht die Kernfragen des Hauses.
  - `OFFEN.md` (zweimal „fünf Fragen“, dazu das „geschlossene Quellenmanifest“ des
    Umstellungsplans): eigene Vorgänge, nicht R-1384.
  - Die Kommentare „Kernfrage“ in `office-host.ts`, `ask-routes-ka4-einwilligung.test.ts` und
    `job2935-validierung-fussband.test.ts` meinen den jeweiligen Testgegenstand.
- **Keine Wiederherstellung** der alten Steuerung (BASIC2-Makroauftrag, `00_CONTROL`). Ihre
  Kennungen stehen hier nur als Herkunft.

## Was zum Schließen fehlt

Zum Schließen braucht es jemanden mit Zugang zur alten Ablage. Diese Person übernimmt den Wortlaut
von Q1–Q5 und, falls auffindbar, das JOB-813-Artefakt (L01, L02). Danach wird je Frage die
beantwortende Quelle im Produktbaum erhoben. Ohne diesen Schritt bleibt R-1384 nur im Teil
„Lücken benannt“ erfüllt.
