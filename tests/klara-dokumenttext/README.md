# Externer Klara-Antwortweg mit Einwilligung und Quellenbindung — Bestandsabgleich

Auftrag `aufnahme:20260922:gesamt-klara-extern` (Revision 7, Lauf 2), Basis `2408cda4`
(Kandidat aus Lauf 1, Runde 3, auf 1.0.0-beta.1.640). Die Auftragsquelle mit den
Originalwortlauten lag diesem Lauf nicht vor. Abgeglichen wurde gegen die Kriterien im Auftrag und
gegen Code, Tests und Commit-Verlauf. Als „Beleg“ ist die Testdatei genannt, die das Verhalten
heute pinnt, dazu der Commit (bei vorhandenem Ship-Commit mit Fassung), der es geliefert hat.

## Abgrenzung (Pedis Entscheidung `4d6b9e56`, Option C, 01.10.2026)

Abgenommen wird hier nur der **Codeumfang**: Riegel, Einwilligung, Nutzlastklasse sowie Vorschlag
statt Selbstschreiben. Die **echten Cloud-/Word-Gesamtfälle** aus R-1594 und R-1614 gehören in den
Folgeauftrag `folge:entscheidung-4d6b9e56:klara-extern-gesamtwege` und werden dort menschlich
abgenommen. Gemeint sind: echter Word-Host mit Herkunft, bewusstem Einfügen, Speichern und
Wiederöffnen sowie echte Anbieterantworten mit Reasoning-Verbrauch, Anbieterbindung, Zustimmung und
Frist. Bens Befund B3 aus Lauf 1 („Prüflücke“) beschreibt genau diese Fälle. Die dort genannten
Prüfstände ersetzen den Modellanbieter oder den Word-Host. Für den Codeumfang reicht das, für die
Gesamtfälle nicht:

- `tests/klara-freigabe/v2-einwilligung-ende-zu-ende.test.ts`
- `tests/klara-quellen-nutzerweg/kette.ts`
- `tests-smoke/word-taskpane-kopieren.spec.ts`
- `tests/office-pg-abnahme/echte-worddatei-am-rueckweg.test.ts`
- `tests/ki-abgeschnittene-antwort/fragment-ist-kein-ergebnis.test.ts`

Dieser Auftrag behauptet für die Gesamtfälle keinen Beleg.

## Zuordnung der Kriterien

| Kriterium | Stand | Beleg |
|---|---|---|
| R-0295 externe KI auf Wunsch, quellengebunden; „Klara fragen“ tut nichts | Der Antwortweg ist seit JOB 3079 D3 freigeschaltet (`KLARA_EXTERNAL_EXECUTION_MIGRATED = true`, `2cfa68d1`, 1.0.0-beta.1.111). Modellaufruf und Einwilligung sind gebaut. Die Weitergabe des markierten Dokumenttexts steht hinter dem eigenen Riegel (R-0639). | `tests/design/f0295-klara-externer-antwortweg.test.ts`, `tests/klara-freigabe/v2-einwilligung-ende-zu-ende.test.ts`, `tests/app/mega79-klara-antwort-ohne-modell.test.ts` |
| R-0639 Dokumenttext als eigene Nutzlastklasse mit eigener Deckungsprüfung; vertraulich bleibt draußen; Riegel AUS und **er** hält | Neu in diesem Auftrag (`c31ff1a7`, `d1f8b42b`, `2408cda4`): `KLARA_PAYLOAD_CLASS_DOCUMENT_TEXT`, `KLARA_DOCUMENT_TEXT_EGRESS_ENABLED = false` (`services/reasoner/src/klara-policy.ts`), `pruefeDokumenttextDeckung`/`pruefeDokumenttextFreigabe` (`klara-session-service.ts`), Route mit `questionSource`/`selectionConfidentiality` (`ask-routes.ts`). | `riegel-haelt-den-dokumenttext.test.ts`: R0 (Wert, eine Lesestelle), R1 (Klasse neben der Frage), R2/R3 (Reihenfolge Vertraulichkeit → Zustimmung → Riegel, Grund `riegel_aus`), R4/R5/R7 (am Modellclient: Produktstand ohne Passage, **Gegenprobe** mit einzig geöffnetem Riegel mit Passage, im laufenden Antwortweg mit Modell). Damit ist belegt, dass der Riegel den Abfluss verhindert und kein Betriebsmodus ohne Modell. |
| R-1526 `job3026-riegel-am-erzeuger.test.ts` fehlt im Klara-Regressionsinventar | Neue Achse `einwilligung`, Datei gepinnt (`c31ff1a7`). | `tests/app/klara-regressionsinventar.test.ts` K3/K4/K5 |
| R-1779 KA6 Schreiben auf Zuruf: Vorschlag, Einfügen erst auf Klick, nie selbsttätig; Stufe 2 externer Riegel | Stufe 1: JOB 1491 D1 (`2eaa857d`, 1.0.0-beta.1.30). Stufe 2: Einwilligungsriegel am Erzeuger (JOB 3026). Der Zuruf über einer Markierung bleibt seit `d1f8b42b` hinter dem Dokumenttext-Riegel. | `tests/output/ka6-zuruf.test.ts`, `tests/ka6/job3026-riegel-am-erzeuger.test.ts`, R5c/R5d hier |
| R-2199 Externe KI nach Einwilligung, Ausführungsroute, Migrationsschalter | Durch JOB 3079 D3 geliefert (siehe R-0295). Nach der Einwilligung führt die Route `/api/ask` aus dem Fenster aus (`ka4Freigabe` in `ask-routes.ts`). | `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts`, `services/app/src/routes/ka4-endzustand.test.ts` |

## Offen und bewusst nicht Teil dieses Auftrags

- Den Riegel `KLARA_DOCUMENT_TEXT_EGRESS_ENABLED` zu öffnen, ist wegen des Datenabflusses eine
  eigene ausdrückliche Entscheidung und kein Teil dieses Bauauftrags.
- Die Gesamtfälle aus R-1594 und R-1614 liegen im Folgeauftrag (siehe oben).
- Das Fenster meldet die Vertraulichkeit der Markierung (`selectionConfidentiality`) heute nicht.
  Die Route behandelt deshalb „fehlt“ als nicht vertraulich. Das ist nur unschädlich, solange der
  Riegel zu ist. Vor dem Öffnen muss das Fenster die Stufe liefern.
