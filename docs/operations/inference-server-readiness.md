# Klarwerk — Inferenz-Server (vLLM / TGI / Ollama): Readiness-/Entscheidungsnotiz

> Ehrliche Bestandsaufnahme der **real vorhandenen** Reasoner-/Provider-Architektur und der
> Schritte für einen **späteren** selbst gehosteten Inferenz-Server.
> **Kein vLLM/TGI/Ollama-Container gestartet, keine GPU provisioniert, kein Modell geladen,
> keine OpenAI-kompatible API gebaut, keine Infrastruktur verändert.** Verwandt:
> `fine-tuning-decision.md`, `rag-readiness-decision.md`, `scaling-cost-control-readiness.md`,
> `api-auth-readiness.md`, `monitoring-logging.md`, `secrets-management.md`,
> `maintenance-update-process.md`.

---

## 1. Heutige Provider-Architektur (real)

Der Reasoner ist **anbieteragnostisch** über zwei Interfaces (`services/reasoner`):

- **`ReasonerProvider`** — `ModelProvider` (echtes Modell) **oder** `DeterministicProvider` (kein Modell).
- **`ModelClient`** — HTTP-Client zum Modell (`model-client.ts`).

**Auswahl/Fallback (`service.ts`):** `primary = ModelProvider` nur wenn verfügbar, sonst `fallback = DeterministicProvider`. Bei **Modellfehler** zur Laufzeit → automatischer **Fallback** auf deterministisch (`fallback=true` im ModelRun). `isAvailable()` ist nur dann true, wenn ein echter Primary ≠ Fallback existiert.

---

## 2. Welche Provider gibt es real?

- **Anthropic** (`anthropicClient`, `model-client.ts`): POST `${baseUrl}/v1/messages` mit Header **`x-api-key`** — also das **Anthropic-Messages-Protokoll**. Aktiv **nur**, wenn `ANTHROPIC_API_KEY` gesetzt ist (`createModelClientFromEnv`), Modell aus `REASONER_MODEL` (Default `claude-sonnet-4-6`).
- **Deterministischer Fallback** (`DeterministicProvider`): Keyword-/KO-basiert, **kein** Modell, **kein** Netz — Default-Betrieb **ohne** Key.

> **Mehr Provider gibt es nicht.** Kein OpenAI-, vLLM-, TGI-, Ollama- oder llama.cpp-Client im Code.

---

## 3. Gibt es eine OpenAI-kompatible Base-URL? — **Nein (mit Einschränkung)**

- `anthropicClient` akzeptiert zwar ein optionales **`baseUrl`** (Default `https://api.anthropic.com`), **aber**:
  1. Das Protokoll ist **Anthropic** (`/v1/messages`, `x-api-key`) — **nicht** OpenAI-kompatibel (`/v1/chat/completions`, `Authorization: Bearer`).
  2. **`baseUrl` ist NICHT env-verdrahtet:** `createModelClientFromEnv` übergibt nur `apiKey` + `model`, **kein** `baseUrl`. Der Default ist heute **hartkodiert** → ohne Codeänderung **nicht** auf einen selbst gehosteten Endpoint umlenkbar.
- → Ein vLLM/TGI/Ollama-Server (typisch **OpenAI-kompatibel**) ließe sich heute **nicht** per Env anbinden; es fehlt (a) ein OpenAI-Protokoll-Client und (b) eine `REASONER_PROVIDER`/`*_BASE_URL`-Konfiguration.

*(Hinweis/Enabler, nicht in diesem Item gefixt: Das vorhandene, aber ungenutzte `baseUrl`-Feld ist ein naheliegender erster Aufhänger für einen späteren konfigurierbaren Endpoint — bewusst **keine** Codeänderung hier.)*

---

## 4. Gibt es vLLM/TGI/Ollama im Code, Docker, Env oder Docs? — **Nein**

- **Code/Docker/Env:** keine Treffer für `vLLM|TGI|text-generation-inference|ollama|llama.cpp|openai|gpu|cuda`. `.env.example` kennt nur `ANTHROPIC_API_KEY` + `REASONER_MODEL` (kein `REASONER_PROVIDER`, keine Base-URL, keine GPU-Vars). `docker-compose*.yml`: nur App + Postgres (+ n8n in Dev), **kein** Inferenz-Container.
- **Docs:** die einzigen Nennungen stehen im internen Dossier (`docs/knowledge-os/current-state-dossier-2026-06-26.md`) und **bestätigen die Abwesenheit** („Lokale LLM-Runtime fehlt (kein Ollama)", „Nur Anthropic-Adapter (kein OpenAI/Ollama)").

> **Folge:** Es läuft **kein** produktiver Inferenz-Server und es ist **keiner** vorbereitet (kein Container/Env/Client). Das Jira-Kriterium „Inferenz-Server (vLLM/TGI) aufgesetzt" ist **nicht** erfüllt.

---

## 5. Health / Status / ModelRun-Signale (real)

- `GET /api/reasoner/status`, `/api/ai-status` → `{active, provider, mode}`.
- `GET /api/model-runs` → `ModelRunRecord` (`provider, demo, fallback, status, startedAt, finishedAt, model?, locale, task`) → Latenz/Fallback/Fehler ableitbar (`scaling-cost-control-readiness.md`).

**Lokaler In-Memory-Smoke (real, kein externer Modellcall, kein Netz):** `reasoner/status`=`{active:false,provider:"deterministic",mode:"deterministic"}`; `ai-status` identisch; `POST /api/ask` → 200 (deterministisch); `/api/model-runs` → Records mit `provider=deterministic, demo=true, fallback=false`.

---

## 6. Auth / Rate-Limit / Cost-Control für Inferenz

- **Auth:** Zugriff auf `/api/ask` ist RBAC-/Session-geschützt (`api-auth-readiness.md`); **kein** separater Inferenz-Endpoint nach außen.
- **Rate-Limit/Quota:** **keine** (`scaling-cost-control-readiness.md` §4) — für einen Inferenz-Server kostenkritisch.
- **Kosten/Tokens:** **nicht** erfasst (ModelRun ohne tokens/cost).

---

## 7. Anforderungen für einen späteren selbst gehosteten Inferenz-Server

1. **Hardware:** GPU-Instanz (VRAM passend zum Modell) — Provider/Standort (DSGVO: DE/EU).
2. **Runtime/Container:** vLLM **oder** TGI **oder** Ollama (OpenAI-kompatibler Endpoint).
3. **Modell:** Auswahl/Download + Lizenz/Compliance; Versionierung.
4. **Client/Adapter im Produkt:** OpenAI-Protokoll-`ModelClient` **oder** Anthropic-kompatibler Proxy; **`REASONER_PROVIDER` + `*_BASE_URL`/Key env-verdrahten** (heute nicht vorhanden, §3).
5. **Auth/TLS:** interner Netzzugriff oder TLS + Token zwischen App und Inferenz-Server.
6. **Rate-Limit/Quota + Concurrency** (GPU-Sättigung vermeiden).
7. **Monitoring:** Latenz/Fehler/Auslastung/Token-Durchsatz (`monitoring-logging.md`), GPU-Metriken.
8. **Kosten:** GPU-Betriebskosten vs. externe API; Budget/Alerts (`scaling-cost-control-readiness.md`).
9. **DSGVO:** self-hosted hält Daten im Haus (Vorteil) — dennoch VVT/Datenfluss dokumentieren.
10. **Rollback:** Provider per Env zurück auf Anthropic **oder** deterministischen Fallback — **nie ohne Rückweg** (Fallback ist bereits vorhanden).

---

## 8. Spätere Auswahl: vLLM vs. TGI vs. Ollama (Konzept)

| Option | Stärke | Einsatz für Klarwerk |
| --- | --- | --- |
| **vLLM** | hoher Durchsatz/Batching, OpenAI-kompatibel | produktive Last, mehrere Nutzer |
| **TGI** (HF) | robust, OpenAI-kompatibel, HF-Ökosystem | produktiv, HF-Modelle |
| **Ollama** | einfachstes Setup, lokal/Dev | Prototyp/Single-Box, kleine Last |

**Tendenz:** **Ollama** für ersten internen PoC (geringste Hürde); **vLLM/TGI** erst bei produktiver Last/Durchsatz. Entscheidung an Bedarf/Datenschutz/Kosten koppeln — und **erst** nach der übergeordneten Modell-/RAG-Strategie (`fine-tuning-decision.md`, `rag-readiness-decision.md`).

---

## 9. Nicht-Ziele

- Kein vLLM/TGI/Ollama-Container, keine GPU, kein Modell-Download, keine OpenAI-kompatible API, keine Infrastrukturänderung.
- Kein Produktcode geändert (auch der `baseUrl`-Enabler in §3 bewusst **nicht** gefixt).
- Reine **Readiness-/Entscheidungsdokumentation**.

---

## 10. Empfehlung

**PARTIAL / Blocked-on-product-/ops-decision.** Klarwerk hat eine **swap-fähige, anbieteragnostische** Reasoner-Architektur (`ReasonerProvider`/`ModelClient`) mit **Anthropic-Adapter + deterministischem Fallback** und realen Health-/ModelRun-Signalen — aber es **läuft kein** Inferenz-Server und es ist **keiner vorbereitet** (kein vLLM/TGI/Ollama, kein OpenAI-Client, `baseUrl` nicht env-verdrahtet, keine GPU/Container/Env). Das Kriterium „Inferenz-Server aufgesetzt" ist **nicht** erfüllt → **Partial**; die Einrichtung ist eine spätere, bewusst zu treffende Produkt-/Ops-Entscheidung (Adapter + GPU/Container + Auth/Rate-Limit/Monitoring + DSGVO + Rollback).

---

*Read-only Readiness-/Entscheidungsnotiz. Kein Produktcode geändert; kein Inferenz-Server/GPU/Modell erzeugt; Evidence aus vorhandenen Tests + lokalem In-Memory-Smoke (§5).*
