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
| **Git-Repo** | 🟡 | Hosting wählen: GitHub / GitLab / Gitea (self-hosted). Dann `git init` + erstes Commit + Push. |
| **Node 20 + Abhängigkeiten** | 🟡 | `npm install` lokal. Danach `tools/check` lauffähig. |
| **Docker Desktop** | 🟡 | Installieren, dann `docker compose up -d` (Postgres + n8n laufen). |
| **CI-Runner** | 🟡 | Bei GitHub: Actions automatisch aktiv. Bei Gitea/GitLab: Runner registrieren. |
| **Coding-Agent** | 🟡 | Claude Code auf der Arbeitsmaschine einrichten, liest `CLAUDE.md`. |

## Phase 2 — Agenten & Orchestrierung 🟡 (Connectors verfügbar)

| Service | Connector | Status | Aktion |
|---|---|---|---|
| **n8n** | ✔ verfügbar | 🟡 | Verbinden. Hostet Review-Panel-Workflow + Intake-Webhook. |
| **Anthropic API** (Claude Opus 4.8) | — | 🟡 | API-Key in `.env`. Für Spec-Agent + Panel. |
| **OpenAI API** (GPT-5.x) | — | 🟡 | API-Key in `.env`. Für Panel-Vielfalt. |
| **Perplexity API** | — | 🟡 | API-Key in `.env`. Externe Recherche im Panel. |
| **Kommunikations-Schnittstelle** | — | ✅ Empfehlung | **Cowork (hier)** als primäre Schnittstelle: Text, Sprache, Dateien, ganze Ordner. Upgrade später: n8n-Webhook → `specs/ideas`. |

## Phase 3 — Wissen & Tracking 🟡 (Connectors verfügbar)

| Service | Connector | Status | Aktion |
|---|---|---|---|
| **Notion** (Doku + Logbuch) | ✔ verfügbar | 🟡 | Verbinden. Doku-/Logbuch-Agent spiegelt `/docs` → Notion. |
| **Jira** (Board) | ✔ Atlassian Rovo | 🟡 | Verbinden. *Alternative:* Linear (leichter, KI-freundlicher). |

## Phase 4 — Determinismus/Qualität ⬜ (mit erstem Modul)
- ⬜ Testcontainers-Setup je Modul · WireMock für externe Systeme · Coverage-Gate scharf stellen.

## Phase 5 — Monitoring & Feedback-Loop ⬜
- ⬜ Logs, Fehlerraten, Testresultate, Token-/Kosten-Metriken zentral → zurück in den Harness.

## Phase 6 — Erweiterte Agenten & Voice ⬜
- ⬜ Jira-Verwalter-Agent, Architektur-/Test-/Implementierungs-/Operations-Agent.
- ⬜ Voice-Driven-Intake erst, wenn Specs/Tests/Gates stabil laufen.

---

## Offene Stakeholder-Entscheidungen
1. **Git-Hosting:** GitHub (einfachster CI-Start) vs. Gitea self-hosted (volle Kontrolle, wie im Video)?
2. **Board:** Jira (wie gewünscht) vs. Linear (leichter)?
3. **Erster fachlicher Anwendungsfall** von Klarwerk — den brauchen wir, um aus dem Skelett echte Specs/Tests zu erzeugen.

## Connector-Referenz
- n8n · Notion · Atlassian Rovo (Jira & Confluence) — alle im Registry verfügbar, noch **nicht verbunden**.
