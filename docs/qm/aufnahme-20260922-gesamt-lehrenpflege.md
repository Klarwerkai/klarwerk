# Aufnahme 20260922 · Gesamt-Lehrenpflege: Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-lehrenpflege`, Revision 1.

- **Stand dieses Dokuments:** Arbeitsbaum auf der Basis `b786c385` (1.0.0-beta.1.974), 13.10.2026.
- **Lieferbeleg:** Die Fassung, mit der diese Änderung ausgeliefert wird, entsteht erst mit der
  Veröffentlichung und steht deshalb hier noch nicht (K2).

## Die Anliegen

| Anliegen | Geliefert | Beleg heute | Stand |
|---|---|---|---|
| **R-1232** Erkenntnisbuch: Was · Beleg · Konsequenz · Wer | historisch: `00_CONTROL/ERKENNTNISSE.md` der damaligen Steuerung (21.08.2026, „351 Zeilen“) | keiner im Produkt. Die Datei liegt außerhalb des Repositorys und ist nicht Teil der Quellen. Das Lehrenbuch des Repositorys ist heute `harness/90-correction-log.md` (Datum · Symptom · Regel · Status). | historisch erledigt (Altbeleg); in diesem Auftrag nicht neu gebaut |
| **R-1244** Lehren-Wache | historisch: `kw_lehren.py` der damaligen Steuerung, „sieben Regeln“ (25.08.2026) | keiner im Produkt. `kw_lehren.py` liegt nicht im Repository, und keine Datei verweist darauf. | historisch erledigt (Altbeleg). Das Werkzeug der verworfenen Steuerung ist **nicht** nachgebaut. Die Zuordnung je Lehre leistet heute das Register L (siehe unten). |
| **R-1333** Drei ungesicherte Regeln bekommen einen Wächter (K1) | **dieser Auftrag:** `tests/lehrenpflege/lehren-waechter.test.ts` (W1, W2, W3 und Register L) | der neue Wächter; ein Prüflauf liegt noch nicht vor (siehe „Prüfbelege“) | geliefert im Arbeitsbaum. Welche drei Regeln die Quelle meint, ist nicht belegt (siehe „Quellenlücke“). |

## Welche drei Regeln: Quellenlücke und heutige Zuordnung

Die Quelle zu R-1333 nennt keine Regel im Wortlaut. Sie nennt nur die Kennungen `B4`, `B5`, `B6`
und `JOB 2536`, dazu als Herkunft den Auftrag
`03_AUFTRAEGE/archiv_geparkt_20260826/MAKROAUFTRAG-BASIC-JOB-2536-D1-B4-B5-B6-DIE-REGELN-STEHEN-UND-NIEMAND-BEWACHT-SIE.md`
der damaligen Steuerung. Dieser Auftrag liegt weder in `QUELLEN.json` noch im Repository.
**Welche drei Regeln damals gemeint waren, lässt sich aus den Quellen nicht bestimmen.**

Der Auftrag verlangt, die noch gültige Anforderung auf den heutigen Arbeitsweg zu beziehen. Dafür
ist jeder Eintrag des heutigen Lehrenbuchs `harness/90-correction-log.md` gegen den Bestand
abgeglichen. Drei Regeln standen dort, ohne dass ein Test sie hielt. Sie bekommen den Wächter:

| | Regel im Lehrenbuch | Vorher bewacht | Jetzt |
|---|---|---|---|
| **W1** | 2026-06-22: „Build-Schritt muss `npm ci` (deterministisch, vollständig) statt partiellem `npm install` nutzen.“ | nur die CI (`tests/app/ci-check-contract.test.ts`); das Produktionsabbild `Dockerfile` nicht | Dockerfile und CI-Workflow: Jeder npm-Installationsbefehl außerhalb von Kommentaren ist `npm ci`, auch über Fortsetzungszeilen. Beide Abbildstufen (Oberfläche und Laufzeit) installieren so. |
| **W2** | 2026-06-22: „`tsPreCompilationDeps: true` in `.dependency-cruiser.cjs`“ | nein. `depcruise` läuft in `tools/check`, aber ohne die Option fiele kein Lauf rot aus; die Modulgrenze sähe `import type` nur still nicht mehr. | Die geladene Konfiguration trägt die Option. `module-boundaries` steht auf `error`, und `tools/check` fährt genau diese Konfiguration. |
| **W3** | 2026-09-27: „Flächen an der Modalgrenze hängen ihre An-/Abmeldung nur an `enter` (stabile Identität), nie am Kontextobjekt — wie `Seitenblatt.tsx`, `MobileNavDrawer.tsx`, `FacetFilter.tsx`.“ | nur `<Modal>` (`tests/mega87-tastaturweg/modal-meldet-sich-einmal-an-mounted.test.tsx`) | Gemessen am Syntaxbaum über alle Quelldateien unter `apps/web/src`. Kein Grenzobjekt aus `useModalBoundary()`, `useModalBoundaryOptional()` oder `useContext(ModalBoundaryCtx)` steht in der Abhängigkeitsliste von `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useCallback` oder `useMemo`. Das gilt auch, wenn es weitergereicht wird (`??`, `\|\|`, `?:`). Ein unerklärter Grenzzugriff ist rot. |

Diese Zuordnung ist eine **Lesart** des Originalsatzes am heutigen Bestand, keine Gleichsetzung mit
`B4`/`B5`/`B6`. Meinte die Quelle andere Regeln, ist das am Original zu klären. Der Originalsatz
bleibt unverändert die Anforderung.

## Register L: jede Lehre ist bewacht oder begründet unbewacht

Damit eine Lehre nicht wieder nur ein Satz in einer Datei bleibt, ordnet der Wächter **jeden**
Eintrag des Lehrenbuchs einem Prüfstand zu. Gibt es keinen, nennt er den Grund. Ein neuer Eintrag
ohne Zuordnung ist rot, ebenso ein Registereintrag ohne passenden Eintrag oder ein genannter
Prüfstand, der nicht mehr im Bestand liegt.

| Eintrag | Wächter | Offen |
|---|---|---|
| 2026-06-22 Initialer Aufbau | — | keine Regel |
| 2026-06-22 `npm ci` im Bauschritt | `tests/app/ci-check-contract.test.ts`, **W1** | — |
| 2026-06-22 DoD „Done“ erst bei allen Kriterien | — | Ablaufregel, keine Eigenschaft des Quelltexts. Heute trägt sie Bens unabhängige Prüfung (CLAUDE.md, `harness/80-definition-of-done.md`). |
| 2026-06-22 `tsPreCompilationDeps` | **W2** | — |
| 2026-07-19 WP-E onSend | `services/app/src/sync-onsend-hooks.test.ts`, `tests/app/mega71-onsend-synchron.test.ts`, `services/app/src/b44-send-return-waechter.test.ts` | Teil (2) „Handler enden mit `return reply`“ hält B44 nur an den Kanten seines Schutzes, nicht für jeden Handler. Teil (3) „Ursache loggen statt `catch {}`“ hat **keinen allgemeinen Wächter**. |
| 2026-09-26 Breitenwechsel im Browsertest | `tests/bibliothek-quellennachweis/dateiname-bricht-um-chromium.test.ts` (Anlassfall `TELEFONLAGE_STEHT`) | Ob eine Wartebedingung nur in der Zielanordnung gilt, ist am Quelltext allgemein nicht entscheidbar. |
| 2026-09-27 Modalgrenze nur an `enter` | `modal-meldet-sich-einmal-an-mounted.test.tsx`, **W3** | — |
| 2026-09-27 Bereitschaft der Leseansicht (PG-Selbsttest) | `tests/fassungsrueckholung-echter-browser/kalibrierung.test.ts` (K5) | — |

Die offenen Teile oben sind benannt, nicht bewacht. Zusätzliche Wächter dafür bestellt dieser
Auftrag nicht: Er nennt drei Regeln, und das Repository verlangt keine neue Regel nur deshalb, weil
etwas offen ist (CLAUDE.md).

## Grenzen des Wächters

- **W1** liest Text, keinen Build. Ein Installationsweg außerhalb von `Dockerfile` und
  `.github/workflows/ci.yml` gehört nicht zum Bauschritt im Sinne der Lehre und wird nicht gelesen,
  etwa die Insel-Auslieferung (`scripts/insel/build-current-release.mjs`, eigener Prüfstand
  `tests/insel-hausbetrieb-anforderungen/anforderungen-am-bestand.test.ts`) oder die Desktop-App.
- **W2** prüft die Konfiguration, nicht die Wirkung von `depcruise`. Ob die Architekturregeln
  greifen, zeigt der Tor-Lauf `tools/check`.
- **W3** prüft Abhängigkeitslisten, nicht das Laufzeitverhalten. Den Fokusverlauf misst weiterhin
  der mega87-Prüfstand an `<Modal>`. Namen gelten je Datei, nicht je Gültigkeitsbereich: Eine
  gleichnamige fremde Variable in derselben Datei würde mitgezählt. Das macht den Wächter strenger,
  nicht blind. Am heutigen Bestand (Quelltextabgleich, kein Lauf) steht in keiner Abhängigkeitsliste
  ein Grenzobjekt. `Modal`, Palette und Studio melden sich über `GrenzDialog` an (`[anmelden,
  anfangsfokus]`), `Seitenblatt` mit `[anmelden]`. `MobileNavDrawer`, `FacetFilter` und der
  Navigationswächter destrukturieren `enter`.
- **Kalibrierung:** W1 und W3 führen Positiv- und Negativfälle. Für W3 gehören dazu die Bauform vor
  mega87 (Objekt in der Liste), die Weiterreichung über `??` und `?:`, `useContext(ModalBoundaryCtx)`
  und ein weitergereichter, unerklärter Zugriff. Erlaubt sind dort `enter`, die Destrukturierung,
  eine gleichnamige fremde Variable und das Lesen von `locked`.

## Abgrenzung zu gesonderten Aufträgen

- **Aufrufer-Wächter** (`aufnahme:20260922:gesamt-aufruferwaechter`, R-1192/R-1306/R-1349): eigener
  Auftrag. Er ist hier nicht berührt.
- **Modale Flächen** (Modal-Sammler, `tests/app/mega47-modale-flaechen-sammler.test.tsx`,
  `tests/app/modalgrenze-abweichende-bauformen.test.ts`, `tools/modalgrenze.ts`): Diese Prüfstände
  erheben, **ob** eine Fläche an der Grenze hängt. W3 prüft nur, **woran** ihr Effekt hängt. Von
  `tools/modalgrenze.ts` nutzt W3 lediglich die Dateierhebung (`quelldateien`); an Sammler und
  Ausnahmen ändert sich nichts.
- **Sendehook-Sammler** (R-1397) und B44: unverändert. Das Register verweist nur auf sie.
- **R-1235 Fäule-Werkzeug:** eigener Auftrag, nicht berührt.

## Quellenwidersprüche und fehlende Belege

- **R-1333** steht auf „angedacht“ bzw. `IN_ARBEIT`, und der Satz sagt „Ein Wächter prüft sie
  **jetzt** automatisch mit“. Der Beleg derselben Quelle lautet dagegen „GEBAUT, wartet auf Einbau:
  JOB 2536 D2 BEN GRÜN (27.08.) … Einbau/Wirkung nicht belegt“. Der Präsens beschreibt also einen
  Zielzustand, keinen belegten Einbau. Ein Einbau jenes Wächters ist im Repository nicht zu finden.
- **Fehlende Quelle:** Der Wortlaut von `B4`, `B5` und `B6` (JOB 2536) fehlt, siehe
  „Quellenlücke“.
- **R-1244** nennt „fünf Regeln laut Vier-Tage-Bericht“ und „erweitert um die Regeln 6 und 7“; der
  Satz sagt „sieben Regeln“. Das passt zusammen. Ob die drei Regeln aus R-1333 unter diesen sieben
  waren, geht aus den Quellen nicht hervor.
- **R-1232**: „jetzt 351 Zeilen“ ist eine historische Zählung einer Datei außerhalb des
  Repositorys. Sie ist nicht nachgemessen und nicht nachmessbar.
- **Lehrenbuch heute:** `harness/90-correction-log.md` führt Symptom, Regel und Status. Eine Spalte
  „Wer“ wie in R-1232 hat es nicht. Das ist ein Unterschied zum historischen Format und wird hier nur
  benannt: R-1232 ist historisch erledigt und kein Kriterium dieses Auftrags.

## Prüfbelege

- In diesem Arbeitsgang ist **kein Test gelaufen**. Der Wächter
  `tests/lehrenpflege/lehren-waechter.test.ts` ist neu, sein erster Lauf steht aus.
- Die Aussagen „heute kein Verstoß“ (W1–W3) beruhen auf Quelleninspektion, nicht auf einem Lauf.
