# Aufnahme 20260922 · Gesamt-Aufruferwächter: Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-aufruferwaechter`, Revision 1. Abgeglichen am 07.10.2026 gegen
den Stand **1.0.0-beta.1.730** (Basis `863a0974`).

Die Fassungsangaben nennen die erste `ship:`-Fassung, die den Commit enthält. Die Zählung
`1.0.0-beta.1.N` beginnt mit `.30` am 02.09.2026. „ab .30“ heißt deshalb: schon vorher gebaut,
erstmals in dieser Zählung ausgeliefert. Der Lieferbeleg für die Änderung dieses Auftrags (K4)
entsteht erst mit ihrer Veröffentlichung und steht hier deshalb noch nicht.

## Die Anliegen

| Anliegen | Geliefert (Commit · Fassung) | Beleg heute | Stand |
|---|---|---|---|
| **R-1192** Aufrufer-Wächter: gebauter Code ohne Aufrufer fällt auf | JOB 2605 D3 `fd44fb52` · JOB 2609 D1 `af733b53` · JOB 2611 D1 `081f60f5` (alle 27.08.2026, ab .30) · dynamischer Import JOB 3030 D11 `7b37c385` | `tests/capture/aufrufer-waechter.test.ts` A1–A6 | historisch erledigt, Wächter läuft im regulären Unit-Lauf |
| **R-1306** Ein Werkzeug findet Bausteine, die niemand aufruft (K1) | wie R-1192: derselbe Wächter | A1 (kein neuer Export ohne Nicht-Test-Aufrufer), A4/A5 (Fang und Gegenprobe), A2 (Kalibrierung: Kommentar und Barrel-Re-Export zählen nicht) | erfüllt im Bestand, in diesem Auftrag nicht neu gebaut |
| **R-1349** Jeder Fall wird angeschlossen oder begründet entfernt (K2) | dieser Auftrag: 22 Registereinträge abgebaut (siehe unten) | A1 und A3 des Wächters sowie die nachgezogenen Tests | **teilweise**: 197 Einträge bleiben, davon 175 eingefroren ohne Einzelbegründung |
| **UX-16b-R** Klammerzugriff auf die Word-Vorschau-Fläche muss rot werden (K3) | JOB 3264 D1 `966874cb` · ship `72b2fd17` **1.0.0-beta.1.221** (09.09.2026) | `tests/klara-webhilfe-schmal/word-weg-naechster-schritt.test.tsx` F12 (Fixtures `kalibrierung/punkt.tsx`, `kalibrierung/klammer.tsx`), F12b–F12f | erfüllt im Bestand |

## R-1349 in diesem Auftrag

Abgebaut sind die Bausteine, die der Wächter als **ersetzt** führte. Ihr Abbau lag bisher außerhalb
der Zielpfade der jeweiligen Umbauten:

- **JOB 3015 D5:** `apps/web/src/lib/startCtas.ts` (`startCta`, `startQueueCta`). Die Startseite
  führt ihre Wege über Karten mit Literalzielen. Der mega51-Sammler erhebt die Tabellen nicht mehr.
- **JOB 3061 H2:** `components/FindingCard.tsx` (`FindingCard`, `FindingGroupHeader`) und
  `components/conflicts/ConflictKoSide.tsx`, jeweils samt Komponententest. Befund und Beleg stehen
  im „Mehr“ der Kartenpaare.
- **JOB 3063:** `lib/koCta.ts` samt Test sowie `lib/libraryMaturity.ts::libraryUseCta`. Beide sind
  durch `components/bibliothek/fragen.ts::fragenHref` ersetzt.
- **JOB 3062:** `IntakeEmptyState`, `IntakeCompletion`, `StructureSuggestionChips` (jeweils samt
  Test), `captureWizard.ts::wizardChips`, die elf Exporte der alten Modus-Leiste,
  Erstnutzer-Führung und Vordertür-Optionsliste in `lib/captureEntry.ts` sowie die drei Helfer, die
  nur sie lasen.

**Nacharbeit 1 (Prüflauf am Kandidaten `caa7baba`):** A1 meldete zwei Exporte aus dem Basisstand
(`services/management`, 1.0.0-beta.1.669). Diese Änderung hatte sie nicht angefasst.

- `horizon.ts::riskHorizon` war ein Fehlalarm des Wächters. `service.ts` ruft die Funktion in der
  gleichnamigen Methode `async riskHorizon()`, und der Wächter zählte Methodennamen als Verdeckung.
  `bindungenVon` behandelt jetzt nur noch Funktionsdeklarationen und benannte Funktionsausdrücke als
  Bindung. Die Gegenprobe A7 prüft beide Richtungen.
- `profiles.ts::RETIREMENT_HORIZONS` war wirklich ungelesen. Jetzt ist die Konstante angeschlossen:
  `normalizeRetirementHorizon` prüft gegen diese Liste statt gegen ein zweites Literal `24 || 36`.
  Das Verhalten ist unverändert (`services/management/src/horizon.test.ts`).

Die Wörterbuchschlüssel dieser Bausteine bleiben stehen. Der Textbestand ist Wert für Wert
festgeschrieben (`tests/i18n-textmodule/bestand-unveraendert.test.ts`).

**Bewusst nicht in diesem Schnitt:**

- `KoReadView`: An ihr hängt die ganze Datei `components/ko/KoRead.tsx`, deren übrige Exporte
  keinen anderen Produktleser haben.
- `KnowledgeRescueIntro`: An ihr hängt `lib/knowledgeRescue.ts`.

Beide Ketten sind Belege im Bedarfsabgleich R-0991 (siehe unten). Ihr Abbau ist ein eigener Schnitt.

**Offener Rest:** Im Wächter stehen 197 Einträge:

- **175 eingefroren:** `ALTBESTAND` (services) und `ALTBESTAND_WEB`. Der Wächter selbst nennt sie
  „NICHT freigesprochen“.
- **22 mit Einzelbegründung:** Testhilfen, Prüfriegel, Word-Spiegel und die zwei Ketten oben.

Die eingefrorenen Einträge werden von über 150 Testdateien gelesen, darunter Sicherheitsverträge
(`requirePermission`, `csrfAssessment`, `PgWriteFence`). Ein Abbau ohne Einzelentscheid je Fähigkeit
würde Prüfstände streichen. Die Zahl „587 Kandidaten, davon 194 mit belegtem Verbraucher“ stammt aus
einer früheren, weiteren Zählung (JOB 2386). Sie ist mit dem engen Schnitt des Wächters nicht
vergleichbar und hier nicht nachgemessen.

## Abgrenzung zu gesonderten Aufträgen

- **R-0991 (K3, Bedarfsabgleich der 82 Kandidaten aus JOB 2612)** in `tests/k3-bedarfsabgleich/`.
  Er stuft 73 Web-Kandidaten als „überholt“ ein. T3 verlangt zugleich, dass alle 82 als Export
  bestehen bleiben, und T6, dass sie weiter im Altbestand stehen. Wer einen dieser Kandidaten
  entfernt, muss R-0991 mitändern. Dieser Auftrag hat keinen davon angefasst.
- **Folgeaufträge aus den Rückgaben zu JOB 3015, 3061, 3062 und 3063.** Sie sind im Wächter als
  „Folgeauftrag benannt“ vermerkt. Ein eigener Auftrag dazu liegt in den Quellen dieses Auftrags
  nicht vor. Der Abbau oben erledigt ihren Kern, ausgenommen `KoReadView` und
  `KnowledgeRescueIntro`.

## Quellenwidersprüche und fehlende Belege

- **UX-16b-R** nennt `word-weg-naechster-schritt.test.tsx:302` und einen bestehenden Wächter, der
  nur `PropertyAccessExpression` erkennt. Der Befund beim Schnitt von JOB 3264 berichtigt das
  bereits: Die Datei hatte damals 77 Zeilen und keinen Wächter. JOB 3264 hat ihn neu gebaut, mit
  Klammererkennung von Anfang an.
- **R-1306** führt den Wächter als „angedacht / IN_ARBEIT“. **R-1192** belegt Einbau und Wirkung
  (JOB 2609, 27.08.2026). Der jüngere Beleg gilt.
- **R-1349** sagt „Einbau nicht belegt“ (JOB 2386 zuletzt ROT). Aus den Quellen geht nicht hervor,
  welche drei Funktionen JOB 2386 meinte. Der Altbestand des Wächters ist der heute messbare Ersatz.
- **R-0991 Nr. 33 und Nr. 57** belegen ihren Alternativweg mit `KnowledgeRescueIntro.tsx` bzw.
  `KoReadView.tsx`. Beide Dateien haben selbst keinen Produktaufrufer. Damit verfehlen die Belege
  die eigene Regel von R-0991 („der Beleg nennt den ANDEREN Weg mit seinem eigenen
  Produktverbraucher“).
- **Der allgemeine Wächter** (`aufrufer-waechter.test.ts`, `namensraumZugriffe`) wertet `ns["X"]`
  nicht als Zugriff. Das macht ihn strenger, nicht blind: Der Export wird dann als „ohne Aufrufer“
  gemeldet. K3 betrifft nur den Flächenwächter der Word-Vorschau.
