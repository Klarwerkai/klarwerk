# Klarwerk — Evaluation & Qualitätssicherung (QA-Runbook)

> Wie die **Antwortqualität** von Klarwerk systematisch und **wiederholbar** geprüft wird:
> über gated Tests (CI), die Reasoner-/Ask-Eigenschaften und ein seed-basiertes Eval-Paar.
> **Bewusstes Nicht-Ziel:** keine LLM-as-judge-Infrastruktur, kein RAG/Vector, kein großes
> Eval-Framework. Verwandt: `docs/demo/stage-1-demo-path.md`,
> `docs/operations/maintenance-update-process.md` (§8 Modell-/Provider-Eval), `monitoring-logging.md`.

---

## 1. Eval-Ziele

Sichergestellt werden die Kern-Qualitätseigenschaften des Knowledge-OS-Antwortverhaltens:
1. **Quellenbindung:** Antworten stammen aus validiertem Wissen, mit Quelle/Trust/Klasse.
2. **Ehrliche Wissenslücke:** ohne Grundlage **keine erfundene Antwort** — es entsteht eine Lücke.
3. **Fokussierte Quelle:** nur das tatsächlich genutzte KO als Quelle (keine losen Treffer, SCRUM-256).
4. **Betriebsstabilität:** Modellfehler/-ausfall → deterministischer Fallback (kein Crash).
5. **Datenschutz:** keine Prompt-/Antworttexte in Protokollen (ModelRun-Metadaten only).

---

## 2. Baseline-Fragen (seed-basiert, wiederholbar)

Gegen den Demo-Seed (`services/app/src/seed-demo.ts`):

| # | Frage | Erwartetes Verhalten |
| --- | --- | --- |
| B1 | „Wann muss Ventil X bei Überdruck geschlossen werden?" | **answered=true**, `knowledgeClass=gesichert`, **trust=100**, **1 Quelle** (validiertes KO) |
| B2 | „Wie kalibriere ich das Quantenflux ZZZ?" (bestandsfremd) | **answered=false**, **Wissenslücke (gap)** erzeugt |
| B3 | „Wie oft muss Filter F3 geprüft werden?" | answered=true, validiertes KO als Quelle |
| B4 | „Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?" | answered=false → **industrielle Wissenslücke** (Priorität hoch) |

> Diese Fragen sind so gewählt, dass sie unabhängig vom Reasoner-Modus (deterministisch/Modell) **seed-sicher** funktionieren (Token-Überschneidung mit validierten KOs bzw. bewusst keine).

---

## 3. Metriken

| Metrik | Quelle | Zielwert |
| --- | --- | --- |
| **Answered-Rate** (beantwortbare Fragen) | `result.answered` | B1/B3 → true |
| **Gap-Honesty** (unbeantwortbare → Lücke) | `gap != null` | B2/B4 → Lücke |
| **Quellenbindung** | `result.sources` | genau die genutzte Quelle |
| **Knowledge-Class** | `result.knowledgeClass` | validiert → `gesichert` |
| **Fallback-Rate / Fehlerquote** | `/api/model-runs` (`fallback`, `status=error`) | beobachten (Modellmodus) |
| **Latenz** | `model-runs` `startedAt`/`finishedAt` | ableitbar |

---

## 4. Wiederholbares Verfahren

**A) Automatisiert (Pflicht-Gate, läuft in CI + lokal):**
- `npm run check` → u. a. **`npm run test`** (Vitest). Die folgenden Suiten kodieren das Eval als ausführbare Akzeptanz:
  - `services/reasoner/src/service.test.ts` — FR-RSN-01..05, **keine Halluzination ohne Grundlage**, fokussierte Quelle (SCRUM-256), Fallback bei Modellausfall, ModelRun-Protokoll (kein Prompttext), configStatus (keine Secrets).
  - `services/ask/src/service.test.ts` — FR-ASK-01..05 (begründete Antwort mit Quelle; ohne Grundlage → Lücke; Helpful→Trust+Audit; Gap-Lebenszyklus/Priorität).
  - `services/app/src/ask-routes.test.ts` — **HTTP end-to-end** (SCRUM-242): validiertes KO → Antwort+Quelle, keine Gap; unbeantwortbar → Gap erzeugt+gelistet; Helpful +2; anonym → Guard.
  - `tests/ask/*` — DOM-freie Helfer (ask-view, ask-response, knowledge-class, ask-examples seed-sicher, gap-priority).
- Gezielter Lauf: `node_modules/.bin/vitest run services/reasoner services/ask services/app/src/ask-routes.test.ts tests/ask`.

**B) Manuelles Review (vor Demo / nach Modell-/Datenänderung):**
1. App starten (`npm run start`, In-Memory) + Demo-Seed (`POST /api/admin/demo-seed`).
2. Baseline-Fragen B1–B4 über `POST /api/ask` stellen; erwartetes Verhalten (§2) prüfen.
3. `GET /api/model-runs` auf Fallback/Fehler sichten; `GET /api/reasoner/status` auf Modus.
4. Abweichungen dokumentieren (kurzes Protokoll im PR/After-Report).

---

## 5. Regression-Gates (bei Modell-/Datenänderungen)

- **Jeder Push/PR:** CI (`.github/workflows/ci.yml`) muss grün sein — kein Merge nach `main` ohne grünen `check`. Damit sind Quellenbindung/Gap/Klasse als Tests **regressionsgeschützt**.
- **Datenänderung (Seed):** `services/app/src/seed.test.ts` sichert u. a. die industrielle Wissenslücke und ≥2 validierte KOs (verhindert „Testdaten"-Rückfall).
- **Modell-/Provider-Update:** zusätzlich manuelles Review (§4B) + `maintenance-update-process.md` §8 (Env-Umstellung in Staging, Status-Badge, Baseline-Fragen, DSFA-Check), Rollback = Fallback.

---

## 6. Halluzinations-/Quellenbindungsregeln (geprüft)

- **Keine Rateantwort ohne belastbares Wissen** (`FR-RSN-03`/`FR-ASK-03`, getestet) → stattdessen Lücke.
- **Antwort = Statement des genutzten KO** im deterministischen Modus; im Modellmodus auf die nummerierten Quellen beschränkt („Answer ONLY based on the numbered sources").
- **Fokussierte Quelle** (SCRUM-256): nur die tatsächlich genutzte Quelle erscheint.
- **Klassifikation ehrlich:** nur validiertes KO → `gesichert`; sonst `ungeprueft`/Lücke.

---

## 7. ModelRun-Nachweise (Run-Level-QA)

Jeder Reasoner-Lauf erzeugt einen `ModelRunRecord` (Provider, Status success/error, Fallback, Demo, Timing, generischer Fehler) — **ohne** Prompt-/Antworttext (`monitoring-logging.md`). Auswertbar über `GET /api/model-runs` für Fehler-/Fallback-Trends.

---

## 8. Evidence (diese Prüfung, real ausgeführt)

- **Gezielter Eval-Testlauf:** `vitest run` über reasoner + ask + ask-routes + `tests/ask` → **9 Dateien / 68 Tests grün**.
- **Live-Eval-Paar** (In-Memory + Demo-Seed):
  - B1 „Ventil X / Überdruck" → `answered=true, class=gesichert, trust=100, sources#=1`.
  - B2 „Quantenflux ZZZ" → `answered=false, gap=JA`.
- **Gesamtgate:** `npm run check` grün — 128 Dateien / 700 Tests.

---

## 9. Offene P2-Ausbaustufen / Nicht-Ziele

- **LLM-as-judge / qualitatives Scoring** großer Antwort-Korpora — **bewusstes Nicht-Ziel** (kein Bau).
- **Größeres Eval-Set/Korpus** mit Erwartungs-Snapshots — optionales P2.
- **Automatisiertes Modellmodus-Eval** (mit echtem Key + Token-/Kosten-/Latenz-Schwellen) — P2/Ops (Sandbox ohne Key/Netz).
- Keine RAG-/Vector-/ModelAdapter-Arbeit, keine neue Modellarchitektur, kein großes Framework.

---

*Read-only QA-Runbook. Kein Produktcode geändert; keine neue Eval-Infrastruktur gebaut. Evidence ausschließlich aus vorhandenen Tests + lokalem Smoke (§8).*
