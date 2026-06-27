# Knowledge-OS Foundation/QM — Readiness Reconciliation (2026-06-27)

> **Status: Reference document.**
> This document is not the Jira backlog.
> This document does not close tickets.
> Jira remains the backlog source of truth.

Abgeleitet aus Repo-Stand, `docs/qm/claude-after-report.md` und dem Jira-/Ticket-Stand SCRUM-164…178. Erstellt von Claude Code (Ausführung), QM/Jira bleibt bei Codex, Freigabe bei Pedi.

---

## 1. Kurzüberblick

Der Foundation-/QM-Strang SCRUM-164…178 hat eine durchgängige, read-only Nachvollziehbarkeitsschicht über das Knowledge-OS gelegt. Konkret vorhanden:

- Ein persistentes **ModelRun-Protokoll** für Reasoner-Aufrufe (nur Metadaten) inkl. read-only Endpoint und Stufe-2-Sicht.
- Eine read-only **Reasoner-/Provider-Konfigurationssicht** (ohne Secrets).
- Persistente **Evidence-Records** für Quellen/Anhänge mit mehreren abgeleiteten Sichten: Konsistenz, KO-übergreifender Index, Gruppierung nach KO-Version, Versions-Freshness (global, im KO-Detail und als Stufe-2-Index).
- Ein **Provenance-/Lineage-Index** über KOs (aus vorhandenen Feldern abgeleitet).
- Gebündelte **Knowledge-OS-QM-Hinweise** inkl. KnowledgeHealth, mit **Fenstertransparenz** und einer knappen **Readiness-Summary**.

Alle Auswertungssichten (Index, Freshness, Konsistenz, Provenance, Hints, Readiness, Window) sind **DOM-freie, rein ableitende Helper** ohne eigene Persistenz. Persistiert sind nur ModelRun-Protokoll, Evidence-Records und (aus früheren Tickets) KO-Version-Snapshots.

Dies betrifft die **Foundation-/QM-Ebene**. Es ist **keine** Aussage über die Gesamt-Produkt-/Frontend-Reife (siehe §5).

---

## 2. Ticket-/Signal-Matrix SCRUM-164…178

| Ticket | Signal/Modul | Zweck | Datenquelle | UI-Ort | Persistenz | Fenster/Limit | Status | Bewusste Restlücke |
|---|---|---|---|---|---|---|---|---|
| SCRUM-164 | ModelRun-Protokoll v1 | Reasoner-Aufrufe nachvollziehbar (Metadaten) | `services/model-runs` (Pg/InMemory), `reasoner.runTask` | — (Schreibpfad) | persistent (`MODEL_RUNS_SCHEMA`) | — | live | kein Prompt-/Antworttext, kein Token-/Kostenaccounting |
| SCRUM-165 | ModelRun read-only Endpoint + Card | jüngste ModelRuns einsehbar | `GET /api/model-runs` (`ko.read`) | Stufe 2 · ReasonerRunsCard | liest persistente Records | `useModelRuns(50)` | live | keine Write-Route, kein Dashboard-Ausbau |
| SCRUM-166 | ReasonerConfig | Provider/Model read-only sichtbar | `GET /api/reasoner/config` (`ko.read`) | Stufe 2 · ReasonerConfigCard | nicht persistiert (Laufzeit-Metadaten) | — | live | keine Secrets, keine Provider-Auswahl-UI |
| SCRUM-167 | answer/select im Protokoll | Ask-/Auswahlpfade protokolliert | `reasoner.answer/select` | (über ModelRun-Card) | persistent (ModelRun) | — | live | select nie Modell → immer demo; kein Volltext |
| SCRUM-168 | Evidence-/Source-Konsistenz | Quellen/Anhänge ↔ Evidence deckungsgleich? | `lib/evidenceConsistency` | KO-Detail · Evidence-Card | abgeleitet | je KO | live | kein Auto-Fix, kein Backfill, Legacy-Inline = neutral |
| SCRUM-169 | Evidence-Index | KO-übergreifende Evidence-Sicht | `GET /api/evidence?limit` (`ko.read`) + `lib/evidenceIndex` | Stufe 2 · EvidenceIndexCard | liest persistente Records | `useEvidenceIndex(500)` | live | keine Object-Rohdaten, keine Pagination/Suche |
| SCRUM-170 | Evidence nach Version | Evidence ↔ KO-Version gruppiert | `lib/evidenceByVersion` | KO-Detail · Evidence-Card | abgeleitet | je KO | live | kein Diff der Evidence-Inhalte |
| SCRUM-171 | Provenance-/Lineage-Index | Herkunft KO-übergreifend | `lib/provenanceIndex` (KOs + Evidence) | Stufe 2 · ProvenanceIndexCard | abgeleitet | Evidence-Fenster (500) | live | kein gerichtetes `derivedFrom`, kein Graph-Umbau |
| SCRUM-172 | Knowledge-OS-QM-Hints | Signale gebündelt | `lib/knowledgeOsHints` | Stufe 2 · KnowledgeOsHintsCard | abgeleitet | erbt Fenster | live | kein Alerting, kein Ticket-Auto-Create |
| SCRUM-173 | KnowledgeHealth in Hints | Health-Score in QM-Hints | `lib/knowledgeHealth` (live-Signale) | Stufe 2 · KnowledgeOsHintsCard | abgeleitet | — | live | keine Trend-/Snapshot-Zeitreihe |
| SCRUM-174 | Evidence-Freshness (global) | aktuelle vs. ältere/keine Evidence | `lib/evidenceFreshness` | Stufe 2 (über Hints) | abgeleitet | Evidence-Fenster (500) | live | kein Backfill, kein Auto-Fix |
| SCRUM-175 | Freshness im KO-Detail | Status je KO sichtbar | `lib/evidenceFreshness` + `evidenceFreshnessView` | KO-Detail · Evidence-Card | abgeleitet | je KO | live | ersetzt Konsistenz/Versionssicht nicht |
| SCRUM-176 | Freshness-Index | betroffene KOs auflisten | `lib/evidenceFreshnessIndex` | Stufe 2 · EvidenceFreshnessCard | abgeleitet | Evidence-Fenster (500), Liste Top 20 | live | keine neue API, keine Fremd-URLs |
| SCRUM-177 | Fenstertransparenz | „geladenes Fenster" ausweisen | `lib/qmDataWindow` | Stufe 2 · WindowNote (mehrere Cards) | abgeleitet | 50 / 500 | live | keine Total-Count-API, keine Pagination |
| SCRUM-178 | Readiness-Summary | knapper Gesamtstatus | `lib/knowledgeOsReadiness` | Stufe 2 · KnowledgeOsHintsCard (Header) | abgeleitet | erbt Fenster | live | keine neue Engine, keine Persistenz |

---

## 3. Aktueller Readiness-Stand

**Grün (live & deterministisch getestet):** ModelRun-Protokoll (Schreiben + Lesen), ReasonerConfig-Sicht, Evidence-Persistenz und alle abgeleiteten Evidence-Sichten (Konsistenz, Index, nach Version, Freshness global/Detail/Index), Provenance-Index, QM-Hints inkl. KnowledgeHealth, Fenstertransparenz, Readiness-Summary. Jede Sicht ist durch DOM-freie Unit-Tests abgedeckt.

**Aufmerksamkeitsbedürftig (per Design, kein Defekt):** Die Readiness-Logik schlägt bewusst auf `attention`, wenn Warnungen vorliegen **oder** ein Datenfenster möglicherweise abgeschnitten ist. „möglicherweise abgeschnitten" ist heuristisch (`loaded ≥ limit`) — ohne Server-Gesamtzahl deckt es auch den Genau-am-Limit-Fall ab.

**Bewusst unvollständig:** KnowledgeHealth gilt nur als „bekannt", wenn alle fünf Live-Signale (KOs, Gaps, Conflicts, LifecyclePending, BusFactor) geladen sind; sonst ehrlich `unknown` ohne Falschmeldung. Nicht geladene Kernsignale erscheinen in `unknownSources` und lösen `incomplete` aus statt eines Fehlers.

**Nur innerhalb eines geladenen Fensters gültig:** Evidence-Index, Evidence-Freshness (global/Index) und der Provenance-Index leiten aus `useEvidenceIndex(500)` ab; die ModelRun-Sicht aus `useModelRuns(50)`. Aussagen über KOs/Records außerhalb dieses Fensters sind nicht abgedeckt — die WindowNote weist genau das aus.

---

## 4. Nicht-Ziele / bewusst offen

- Kein Prompt-/Antwort-/Fragetext im ModelRun-Protokoll (nur Metadaten).
- Kein Token-/Kosten-Accounting.
- Kein Evidence-Backfill, kein Auto-Fix, kein Edit/Delete/Restore von Evidence.
- Keine Server-Pagination, keine Total-Count-API.
- Kein globaler Evidence-Browser mit Suche/Filter.
- Keine Trend-/Snapshot-Zeitreihe für KnowledgeHealth.
- Kein automatisches Ticketing/Alerting aus QM-Hints.
- Kein gerichtetes Lineage-Modell (`derivedFrom`), kein Graph-Umbau.
- Keine Audit-Hash-/Evidence-Modell-Änderung, keine Migration über die bestehenden Schemas hinaus.

---

## 5. Empfehlung nächster Meilenstein

**Frontend-Funktionsinventar / Produktionsreife-Audit.** Der Foundation-/QM-Strang ist abgeschlossen, aber das sagt **nichts** über die Gesamt-Produkt- bzw. Frontend-Reife aus. Empfohlen wird ein route-by-route Audit jeder Frontend-Route mit ehrlicher Einstufung:

- funktioniert
- teilweise
- UI/Platzhalter
- blockiert durch Backend
- blockiert durch fehlende Daten
- bewusst Stufe 2 / später

Dieses Audit ist der **nächste Meilenstein** und **nicht Teil dieses Dokuments**.

---

## 6. Prüfhinweise

- Zuletzt relevante Gates: root `npm run check` (tsc services+tests, Biome, dependency-cruiser, Vitest) und — bei FE-Änderungen — `apps/web` `tsc --noEmit`. Stand SCRUM-178: 88 Testdateien / 498 Tests grün, apps/web-tsc EXIT 0.
- Dieses Dokument ist aus Repo-Code, `docs/qm/claude-after-report.md` und dem Jira-/Ticket-Stand abgeleitet. Bei Abweichungen zwischen Dokument und Jira gilt **Jira**.
- Verwandtes Dokument: `docs/knowledge-os/current-state-dossier-2026-06-26.md`.

---

_Foundation-/QM-Strang abgeschlossen. Produkt-/Frontend-Reife ist damit ausdrücklich nicht behauptet und braucht ein eigenes Audit (§5)._
