# SETUP — Klarwerk Service- & Aufbau-Checkliste

> Living-Doc. Quelle der Wahrheit für „was ist aufgesetzt, was braucht deine Aktion".
> Vorgehen: **lean zuerst** (Fundament + 3 Agenten), dann Schichten ergänzen.

## Status-Legende
✅ erledigt · 🟡 vorbereitet, braucht deine Aktion · ⬜ später

---

## Phase 0 — Fundament (Dateien, lokal) ✅
Bereits im Projektordner angelegt:

- ✅ Repo-Struktur (`harness/`, `specs/`, `services/`, `tools/`, `tests/`, `docs/`, `agents/`)
- ✅ Harness-Regeln (`CLAUDE.md`, `harness/00–90`)
- ✅ Spec-Template + Ideen-Eingang
- ✅ Tool-Skripte (`tools/build|lint|format|test|check`)
- ✅ Stack-Config (`package.json`, `tsconfig`, `biome.json`, `.dependency-cruiser.cjs`, `vitest.config.ts`)
- ✅ `docker-compose.yml` (Postgres + n8n), CI-Workflow, `.gitignore`, `.env.example`
- ✅ 3 Agenten-Definitionen (`agents/`)

## Phase 1 — Fundament aktivieren 🟡 (braucht dich / lokale Tools)

| Service | Status | Aktion |
|---|---|---|
| **Git-Repo (lokal)** | ✅ | `git init` + erster Commit erledigt (`8a2ac96`, Branch `main`). |
| **Gitea** | 🟡 | Installiert. Finalisieren nach `docs/operations/gitea-setup.md` (Org+Repo anlegen, push, Branch-Protection, Actions-Runner). |
| **Node 20 + Abhängigkeiten** | 🟡 | `npm install` lokal. Danach `tools/check` lauffähig. |
| **Docker Desktop** | 🟡 | Installieren, dann `docker compose up -d`. |
| **CI-Runner** | 🟡 | Gitea Actions: act_runner registrieren (siehe Gitea-Doku). |
| **Coding-Agent** | 🟡 | Claude Code auf der Arbeitsmaschine, liest `CLAUDE.md`. |

## Phase 2 — Agenten & Orchestrierung 🟡 (Connectors verfügbar)

| Service | Connector | Status | Aktion |
|---|---|---|---|
| **n8n** | ✔ verfügbar | ⬜ später | Registrierung hat aktuell Probleme — Pedi macht es später. |
| **Anthropic API** (Claude Opus 4.8) | — | ⬜ später | API-Key bei Bedarf in `.env`. |
| **OpenAI API** (GPT-5.x) | — | ⬜ später | API-Key bei Bedarf in `.env`. |
| **Perplexity API** | — | ⬜ später | API-Key bei Bedarf in `.env`. |
| **Kommunikations-Schnittstelle** | — | ✅ Empfehlung | **Cowork (hier)** als primäre Schnittstelle: Text, Sprache, Dateien, ganze Ordner. Upgrade später: n8n-Webhook → `specs/ideas`. |

## Phase 3 — Wissen & Tracking 🟡 (Connectors verfügbar)

| Service | Connector | Status | Aktion |
|---|---|---|---|
| **Notion** (Doku + Logbuch) | ✔ verfügbar | ✅ eingerichtet | Verbindung in Cowork bestätigen, dann spiegelt der Doku-Agent `/docs` → Notion. |
| **Jira** (Board) | ✔ Atlassian Rovo | ✅ eingerichtet | `klarwerk.atlassian.net`. Verbindung in Cowork bestätigen, dann Board-Aufbau. |

## Phase 4 — Determinismus/Qualität ⬜ (mit erstem Modul)
- ⬜ Testcontainers-Setup je Modul · WireMock für externe Systeme · Coverage-Gate scharf stellen.

## Phase 5 — Monitoring & Feedback-Loop ⬜
- ⬜ Logs, Fehlerraten, Testresultate, Token-/Kosten-Metriken zentral → zurück in den Harness.

## Phase 6 — Erweiterte Agenten & Voice ⬜
- ⬜ Jira-Verwalter-Agent, Architektur-/Test-/Implementierungs-/Operations-Agent.
- ⬜ Voice-Driven-Intake erst, wenn Specs/Tests/Gates stabil laufen.

---

## Offene Stakeholder-Entscheidungen
1. **Stack der Neuauflage:** Original-App läuft auf **Cloudflare Pages Worker + D1 + Vite/React**. Pflichtenheft sagt „technische Umsetzung ist frei". Entweder (a) Cloudflare-Stack beibehalten (näher am Bestand) oder (b) auf das Harness-Skelett Node/Fastify/Postgres migrieren. Bestimmt Harness-Stack-Regeln, Linter, Tests, docker-compose.
2. **Pflichtenheft → Specs:** Das vorhandene Pflichtenheft (FR-/NFR mit Abnahmekriterien) als Specs in `/specs` übernehmen — der direkte Weg zu Test-Driven.
3. **Volle Agenten-Org / zwei Teams:** Aktivierung gemäß `docs/operations/governance-and-teams.md`, sobald erstes Modul grün + Teams an Bord.

## Verbundene/erledigte Services
- ✅ **Gitea** installiert (Finalisierung dokumentiert) · ✅ **Jira** (klarwerk.atlassian.net) · ✅ **Notion** eingerichtet · ✅ lokales Git-Repo committet.
- ⬜ **n8n** später (Registrierungsproblem) · ⬜ LLM-API-Keys bei Bedarf.
