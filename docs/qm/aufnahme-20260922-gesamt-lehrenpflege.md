# Aufnahme 20260922 · Gesamt-Lehrenpflege: Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-lehrenpflege`, Revision 1.

- **Stand dieses Dokuments:** Nacharbeit 1, aufgesetzt auf den Kandidaten `d5f00bd7`
  (Basis `b786c385`, 1.0.0-beta.1.974), 13.10.2026.
- **Lieferbeleg:** Die Fassung, mit der diese Änderung ausgeliefert wird, entsteht erst mit der
  Veröffentlichung. Sie steht deshalb hier noch nicht (K2).

## Die Anliegen

| Anliegen | Geliefert | Beleg heute | Stand |
|---|---|---|---|
| **R-1232** Erkenntnisbuch: Was · Beleg · Konsequenz · Wer | historisch: `00_CONTROL/ERKENNTNISSE.md` der damaligen Steuerung (21.08.2026, „351 Zeilen“) | keiner im Produkt. Das Lehrenbuch des Repositorys ist heute `harness/90-correction-log.md` (Datum · Symptom · Regel · Status). | historisch erledigt (Altbeleg); in diesem Auftrag nicht neu gebaut |
| **R-1244** Lehren-Wache | historisch: `kw_lehren.py` der damaligen Steuerung, „sieben Regeln“ (25.08.2026) | keiner im Produkt. `kw_lehren.py` liegt nicht im Repository, und keine Datei verweist darauf. | historisch erledigt (Altbeleg). Das Werkzeug der verworfenen Steuerung ist **nicht** nachgebaut. |
| **R-1333** Drei ungesicherte Regeln bekommen einen Wächter (K1) | die drei Originalfälle **B4, B5, B6** aus JOB 2536, siehe nächster Abschnitt | B4 und B6: vorhandene inhaltliche Prüfstellen. B5: in Nacharbeit 1 ergänzt (`services/app/src/routes/check-text-routes.test.ts`). | B4 und B6 im Bestand gedeckt, nicht neu gebaut. B5 im Arbeitsbaum ergänzt; ein Prüflauf dazu steht aus. |

## R-1333: die drei Originalfälle B4, B5, B6

**Berichtigung zu Kandidat `d5f00bd7`:** Die frühere Fassung dieses Dokuments behauptete, die Quelle
lasse offen, welche drei Regeln gemeint sind. Sie verbuchte stattdessen drei Regeln aus dem
Lehrenbuch (W1–W3) als Erfüllung von R-1333. **Beides war falsch.** Die Originalquellen sind lesbar
(eingebettet in `QUELLEN-R1333-B4-B5-B6-TECHNISCHE-HILFE.json`, SHA256 `037795d8…`). Sie bestimmen
die drei Regeln eindeutig: Makroauftrag JOB 2536 D1, §5. W1–W3 sind andere Regeln. Sie bleiben als
zusätzliche Wächter erhalten (siehe unten), erfüllen R-1333 aber nicht.

| Fall | Regel (Makroauftrag JOB 2536 D1, §5) | Ursprüngliche Fundstelle |
|---|---|---|
| **B4** | Eine Wissenslücke darf nicht mit falschem Fragetext angelegt werden. | `addon-principal.test.ts:410` |
| **B5** | Die Zusage „NULL Persistenz“: Statt des Seed-KO darf kein anderes Objekt in der Liste stehen. | `check-text-routes.test.ts:134` |
| **B6** | Beim Anlegen zweier Entwürfe dürfen Titel und Aussage nicht vertauscht werden. | `draft-empty-guard.test.ts:33` |

### Historische Ergebnisse (Fassungen der damaligen Läufe)

- **D1** (Bahn BASIC, Clone `51dbc9a0`, 26.08.2026): Je Fall wurde eine Produktmutation gesetzt.
  Rot wurden: bei B4 4 Dateien, bei B5 3 Dateien, bei B6 8 Dateien. Ergebnis: kein Produktdefekt,
  alle drei gelten als im Baum gedeckt.
- **D2** (Bahn PRO4, Clone `1097a3c7`, 27.08.2026, BEN GRÜN): read-only Korrekturdurchgang.
  - **B4 und B6** bleiben gegen die natürlichen Produktmutationen gedeckt.
  - **B5** ist gegen das Hinzufügen eines Objekts gedeckt. Gegen den **gleichzahligen
    Objektaustausch** ist B5 **ungedeckt**: `toHaveLength(1)` blieb unter der Mutation grün. Die
    19 roten Fälle scheiterten nur technisch an fehlenden Methoden der Fakes und sind ausdrücklich
    kein Deckungsbeleg.
  - D2 baute **keinen** Wächter, sondern spezifizierte ihn nur. Das „GEBAUT … BEN GRÜN (27.08.)“
    der Registerquelle bestätigt also diese Bestandskorrektur, keinen eingebauten B5-Wächter.

### Heutiger Stand je Fall (Arbeitsbaum Nacharbeit 1)

| Fall | Heutige Prüfstelle | Stand |
|---|---|---|
| **B4** | `services/app/src/ask-routes.test.ts:95` (`body.gap.question` gleich der gestellten Frage) und `:99` (die Lücke ist über `/api/gaps` mit genau dieser Frage auffindbar). Das Produkt übernimmt `normalizeGapQuestion(question)` in `services/ask/src/service.ts:3762`. | gedeckt im Bestand, in diesem Auftrag nicht verändert. Der Originalfall `addon-principal.test.ts` prüft weiterhin nur Existenz und Anzahl; die Deckung liegt, wie in D1 belegt, in `ask-routes.test.ts`. |
| **B5** | `services/app/src/routes/check-text-routes.test.ts`, Fall „Session, Text in range → … NULL Persistenz“, ergänzt um zwei Gegenproben (siehe unten) | **in Nacharbeit 1 ergänzt** nach der D2-Spezifikation. Der Wirkungsbeleg steht aus, solange der Lauf aussteht. |
| **B6** | `services/capture/src/service.test.ts:251` (Titel nach `POST`/`GET /api/drafts`) und `:596` (Aussage nach dem Fortschreiben). Das Produkt normalisiert das Payload in `createDraftVorgang`, `services/capture/src/service.ts:865`. | gedeckt im Bestand, in diesem Auftrag nicht verändert. `draft-empty-guard.test.ts:31–36` zählt weiterhin nur zwei Entwürfe. |

Für B4 und B6 sind die historischen Mutationen am heutigen Kandidaten **nicht wiederholt**. Die
Deckung ist deshalb durch die inhaltlichen Prüfstellen belegt, nicht durch einen neuen
Mutationslauf. Einen zusätzlichen Prüflauf bestellt das nicht.

### B5: was der ergänzte Test jetzt verlangt

Im vorhandenen Service-Test (echter `KoService` aus `buildServices()`, keine Fakes):

1. Nach der Seed-Vorbereitung wird der gespeicherte Bestand (`ko.list()`) als unabhängige Kopie
   gesichert; er besteht genau aus dem Seed-KO. Erst danach werden die Schreibwege beobachtet:
   `create`, `createWithDocuments`, `revise`, `reviseUndFreigeben`, `appendDocumentExtract`,
   `addProposal`, `decideProposal`, `updateCategory`, `updateTags`, `setValidationState`,
   `setValidationStateMitBeleg`, `markMergedInto`, `delete`, `restore`, `purgeTrashed`.
2. Direkt nach `POST /api/check-text` werden zwei Dinge verlangt:
   - Der Bestand ist nach Identität und Inhalt derselbe. Jede Abweichung wird als Satz gemeldet:
     „Das gespeicherte KO … fehlt“, „Ein anderes Objekt … steht jetzt im Bestand“ oder „… ist
     verändert: Feld, Feld“. Zusätzlich steht `toEqual` über den ganzen Bestand.
   - Kein Schreibweg wurde aufgerufen, gemeldet als „ko.delete wurde 1× aufgerufen“.
3. Die bisherigen Zusicherungen (Board leer, keine Lücke, Liste mit Länge 1) bleiben unverändert
   bestehen.

**Gegenproben** im selben Block:

- **„B5-Gegenprobe: ein gleichzahliger Austausch …“** setzt genau die D2-Mutation am Dienst: das
  Seed-KO hart löschen und „AUSGETAUSCHT-2536“ anlegen.
  - Die alte Zusicherung `toHaveLength(1)` bleibt dabei nachweislich grün.
  - Der Bestandsvergleich meldet das fehlende Seed-KO und das fremde Objekt beim Namen.
  - Die Schreibbeobachtung meldet `ko.delete` und `ko.create`.
- **„B5-Gegenprobe: eine Inhaltsänderung …“** belegt, dass der Vergleich ein geändertes Feld
  (`title`) beim Namen nennt.

**Grenze:** Die D2-Mutation steht in der Gegenprobe am Dienst, nicht in der Route. Belegt wird damit,
dass die Zusicherungen des Falls diesen Austausch erkennen. Ein Red-first-Lauf mit der Mutation in
`check-text-routes.ts` samt hashgleicher Rücknahme ist in diesem Arbeitsgang nicht gelaufen; er
hätte eine Änderung des Produktcodes und einen Testlauf verlangt.

## Zusätzlich: Wächter für das Lehrenbuch (W1–W3, Register L)

Diese Wächter stammen aus der ersten Fassung und bleiben erhalten:
`tests/lehrenpflege/lehren-waechter.test.ts`, Kandidat `d5f00bd7`, 14 von 14 grün, Build und Format
grün (Archiv `HISTORIE/nacharbeit-1/PRUEFUNG`). Sie sind **keine Erfüllung von R-1333**. Sie halten
Regeln aus `harness/90-correction-log.md`, die vorher kein Test hielt:

| | Regel im Lehrenbuch | Wächter |
|---|---|---|
| **W1** | 2026-06-22: `npm ci` statt `npm install` im Bauschritt | Dockerfile und CI-Workflow installieren nur mit `npm ci`. |
| **W2** | 2026-06-22: `tsPreCompilationDeps: true` in `.dependency-cruiser.cjs` | Die Option ist gesetzt, `module-boundaries` steht auf `error`, und `tools/check` fährt diese Konfiguration. |
| **W3** | 2026-09-27: An der Modalgrenze hängt die An-/Abmeldung nur an `enter` | Gemessen am Syntaxbaum über `apps/web/src`: Kein Grenzobjekt steht in einer Abhängigkeitsliste. |

Register L ordnet jeden Eintrag des Lehrenbuchs einem Prüfstand oder einem benannten Grund zu.
Offen und nur benannt bleiben:

- WP-E Teil (2) „`return reply`“ ist nur an den Kanten von B44 bewacht.
- WP-E Teil (3) „Ursache loggen statt `catch {}`“ hat keinen allgemeinen Wächter.
- Für die Regel zum Breitenwechsel im Browsertest gibt es nur den Anlassfall.
- Die DoD-Ablaufregel ist keine Eigenschaft des Quelltexts.

Grenzen: W1 liest Text, keinen Build. W2 prüft die Konfiguration, nicht die Wirkung von `depcruise`.
W3 prüft Abhängigkeitslisten, nicht das Laufzeitverhalten; Namen gelten je Datei.

## Abgrenzung zu gesonderten Aufträgen

- **B7** (`visibleDraftsFor`, JOB 2531): eigener, historisch gedeckter Fall. Er ist nicht Teil von
  R-1333 und hier nicht berührt.
- **Aufrufer-Wächter** (`aufnahme:20260922:gesamt-aufruferwaechter`): eigener Auftrag, nicht berührt.
- **Modal-Sammler** (`tests/app/mega47-modale-flaechen-sammler.test.tsx`, `tools/modalgrenze.ts`):
  W3 nutzt nur die Dateierhebung. An Sammler und Ausnahmen ändert sich nichts.
- **Sendehook-Sammler** (R-1397) und B44: unverändert. Das Register verweist nur auf sie.
- **R-1235 Fäule-Werkzeug:** eigener Auftrag, nicht berührt.

## Quellenwidersprüche und fehlende Belege

- **R-1333:** Die Registerquelle sagt „angedacht“ bzw. `IN_ARBEIT` und „Ein Wächter prüft sie
  **jetzt** automatisch mit“. Dem steht derselbe Eintrag gegenüber: „GEBAUT, wartet auf Einbau:
  JOB 2536 D2 BEN GRÜN (27.08.) … Einbau/Wirkung nicht belegt“. Laut D2-Rückgabe war D2 read-only,
  Produktdiff 0. „GEBAUT“ trifft also nicht zu: Gebaut war eine Bilanz samt Spezifikation, kein
  Wächter.
- **D1 gegen D2:** D1 nannte B5 „gedeckt — sogar in der eigenen Datei“. D2 grenzt das ein: gedeckt
  nur gegen das Hinzufügen, nicht gegen den gleichzahligen Austausch. D2 hat die D1-Bilanz
  ausdrücklich abgelöst.
- **D1-Nulldiff:** D1 meldete zwei verbliebene unverfolgte Testdateien
  (`tests/ask/job2536-…`, `tests/capture/job2536-…`). Im heutigen Repository liegen sie nicht. Sie
  sind kein Bestandteil der heutigen Deckung.
- **Fehlender Beleg B5:** Ein ausgeführter Rot/Grün-Lauf für den ergänzten Test liegt noch nicht
  vor.
- **Fehlender Beleg B4/B6:** Die historischen Mutationen sind am heutigen Kandidaten nicht
  wiederholt (siehe oben). Die Deckung ruht auf den genannten Prüfstellen.
- **R-1232:** „jetzt 351 Zeilen“ ist eine historische Zählung außerhalb des Repositorys und nicht
  nachmessbar.
- **R-1244:** Ob B4–B6 unter den „sieben Regeln“ von `kw_lehren.py` waren, geht aus den Quellen
  nicht hervor.

## Prüfbelege

- **Kandidat `d5f00bd7`:** `tests/lehrenpflege/lehren-waechter.test.ts` 14 von 14 grün, Build und
  Format grün (Archiv `HISTORIE/nacharbeit-1/PRUEFUNG`). Das belegt W1–W3 und Register L, nicht
  B4–B6.
- **Nacharbeit 1:** In diesem Arbeitsgang ist kein Test gelaufen. Die ergänzte Datei
  `services/app/src/routes/check-text-routes.test.ts` steht im Prüfplan.
