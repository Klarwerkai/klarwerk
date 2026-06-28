# Klarwerk — Lokale Funktions- & Performance-Baseline

> Ehrliche, **real gemessene** Baseline des aktuellen lokalen Setups, soweit **ohne lokale
> Modellruntime** und **ohne produktiven Lasttest** möglich.
> **Keine Open WebUI/Ollama/vLLM/TGI, kein Modell-Download, keine Docker-/GPU-/Infra-Arbeit,
> kein Live-Lasttest.** Verwandt: `evaluation-quality-assurance.md`, `inference-server-readiness.md`,
> `local-chat-ui-readiness.md`, `scaling-cost-control-readiness.md`, `monitoring-logging.md`.

---

## 1. Testumgebung

- **Betrieb:** In-Memory-Runtime (`PORT=3058 tsx services/app/src/server.ts`), **kein** Postgres/Docker, **kein** externes Netz.
- **Reasoner-Modus:** **deterministisch** (kein `ANTHROPIC_API_KEY`) → `provider=deterministic`. **Keine** lokale Modellruntime (`inference-server-readiness.md`).
- **Daten:** Demo-Seed (`POST /api/admin/demo-seed`).
- **Datum:** 2026-06-27. *(Absolute Zahlen sind hardware-/lastabhängig; reproduzierbar via §7.)*

---

## 2. Durchgeführte Checks/Messungen

1. **Gates:** `npm run check` (tsc + biome + depcruise + vitest).
2. **Gezielter Eval-Lauf:** `vitest run services/reasoner services/ask services/app/src/ask-routes.test.ts tests/ask`.
3. **Live-Ask-Latenz** je Fragetyp (5 Läufe, In-Memory): beantwortbar, Gap, Langkontext.
4. **Kleine Parallelität:** 5 gleichzeitige Ask-Requests (kein Stresstest).
5. **ModelRun-Metadaten:** `GET /api/model-runs`.

---

## 3. Ergebnisse — Gates & Eval

- **`npm run check`:** **grün — 128 Dateien / 700 Tests**, Vitest-Dauer ~19 s, Gesamtlauf ~24 s (wall).
- **Eval-Suiten grün:** reasoner (`service` 28, `provider-model` 11), ask (`service` 9), `ask-routes` (4), `tests/ask` (knowledge-class, ask-view/response/question, ask-examples, gap-priority).

---

## 4. Ergebnisse — Ask-Latenz (deterministisch, In-Memory)

| Fragetyp | Ø Latenz | min–max | Verhalten |
| --- | --- | --- | --- |
| **B1** „Ventil X / Überdruck" | **~1,5 ms** | 0,95–3,25 ms | `answered=true`, `gesichert`, trust **100**, **1 Quelle** |
| **B3** „Filter F3 prüfen" | **~0,9 ms** | 0,54–1,26 ms | `answered=true`, `gesichert`, trust **100**, **1 Quelle** |
| **B2** „Quantenflux ZZZ" (bestandsfremd) | **~0,5 ms** | 0,45–0,65 ms | `answered=false`, **Gap**, trust 0 |
| **B4** „Dosierwert L4 / Schichtwechsel" | **~0,6 ms** | 0,49–0,76 ms | `answered=false`, **Gap** (industrielle Lücke) |

→ **Sub-Millisekunde bis wenige ms** pro Anfrage im deterministischen Modus; beantwortbare Fragen liefern Quelle+Trust, bestandsfremde/industrielle Lücken liefern **ehrliche Gaps**.

---

## 5. Parallelität & Langkontext

- **5 parallele Asks (wall):** **~2,5 ms** gesamt → kleine Nebenläufigkeit problemlos (In-Memory, kein I/O).
- **Langer/irrelevanter Kontext (~4 142 Zeichen, „lorem ipsum …" + Offtopic-Frage):** **~0,8 ms**, **`answered=true` (kein Gap)**.

> **P1-Qualitätsbeobachtung (ehrlich):** Die lange Offtopic-Frage erzeugte **keine** Gap, sondern `answered=true`. Vermutlich **lexikalische Über-Überschneidung** gängiger Wörter mit KO-Text (bekannte Grenze des Keyword-Retrievals, vgl. `rag-readiness-decision.md` §4). **Empfehlung:** als **P1** beobachten — Eval-Set um „langer Offtopic-Kontext → erwartete Gap" erweitern; semantisches Retrieval (RAG) würde das adressieren. **Kein** P0 (Trust/Klasse bleiben an das gematchte KO gebunden; keine freie Halluzination).

---

## 6. ModelRun-Metadaten

- **28 Records**, Keys: `id, task, provider, demo, fallback, locale, startedAt, finishedAt, status`.
- **Latenz ableitbar** (`finishedAt−startedAt`): ~0–1 ms (deterministisch).
- **provider=deterministic**, **fallback=false** (kein Modellausfall), **status=success** durchgängig.
- **Keine `tokens`, keine `cost`/`usage`** — bestätigt (vgl. `scaling-cost-control-readiness.md` §3).

---

## 7. Nicht messbar / Blocker (ausdrücklich)

- **Tokens/Sekunde & Modell-Generierungslatenz: NICHT messbar** — es gibt **keine lokale Modellruntime** (kein Ollama/vLLM/TGI) und der deterministische Provider **generiert keine Tokens**. → **blocked/not measurable**, **nicht** geschätzt.
- **Modellmodus-Qualität/-Latenz** (mit echtem Key): in der Sandbox **nicht** geprüft (kein Netz/Key).
- **Produktiver Lasttest / hohe Parallelität / DB-Last:** **nicht** durchgeführt (per Vorgabe; Strategie in `scaling-cost-control-readiness.md` §7).

---

## 8. Wiederholungsanleitung

```bash
# Gates + Eval
npm run check
node_modules/.bin/vitest run services/reasoner services/ask \
  services/app/src/ask-routes.test.ts tests/ask

# Live-Ask-Latenz (In-Memory)
PORT=3058 node_modules/.bin/tsx services/app/src/server.ts &   # warten ~4s
#  register → login (Bearer) → POST /api/admin/demo-seed (content-type: application/json)
#  je Frage: POST /api/ask {question} und time_total messen (5 Läufe, Mittel)
#  Fragen: B1 Ventil/Überdruck, B3 Filter F3, B2 Quantenflux (Gap), B4 Dosierwert L4 (Gap)
#  Parallel: 5× POST /api/ask gleichzeitig (Promise.all)
#  GET /api/model-runs → provider/fallback/status/Latenz prüfen (keine tokens/cost)
pkill -f 'tsx services/app/src/server.ts'
```

---

## 9. Empfehlung

**PARTIAL.** Für das **vorhandene lokale Setup (deterministisch)** ist eine **belastbare Funktions-/Latenz-Baseline real gemessen**: Gates grün (700 Tests), Ask-Latenz Sub-ms–wenige ms, korrekte Quellenbindung/Trust bei beantwortbaren Fragen, **ehrliche Gaps** bei bestandsfremden/industriellen Fragen, kleine Parallelität problemlos, ModelRun-Signale konsistent. **Aber:** die **Modell-Performance (Tokens/sec, Generierungslatenz)** ist mangels lokaler Runtime **nicht messbar (blocked)**, und es gibt eine **P1-Qualitätsbeobachtung** (langer Offtopic-Kontext → fälschlich `answered=true` statt Gap). Das Akzeptanzkriterium „Funktions- **& Performance**-Tests" ist damit **funktional erfüllt**, **performance-/modellseitig aber blockiert** → **Partial**; offene Teile abhängig von lokaler Modellruntime (`inference-server-readiness.md`) und einem späteren Eval-/Lasttest.

---

*Read-only Baseline. Kein Produktcode geändert; keine Runtime/Modell/Infra erzeugt; alle Zahlen real lokal gemessen (In-Memory, deterministisch), nichts geschätzt.*
