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
| **CI-Runner** | ⬜ bewusst aufgeschoben | Gitea Actions ist aktiv, der `check`-Job wartet auf einen Runner. Runner + Docker werden in der **Build-Umgebung** eingerichtet, sobald das erste Modul mit Tests gebaut wird (Testcontainers braucht Docker ohnehin). CI-Lauf auf leerem Code hätte keinen Aussagewert. |
| **Coding-Agent** | 🟡 | Claude Code auf der Arbeitsmaschine, liest `CLAUDE.md`. |

## Phase 2 — Agenten & Orchestrierung 🟡 (Connectors verfügbar)

| Service | Connector | Status | Aktion |
|---|---|---|---|
| **n8n** | ✅ verbunden + aktiv | Connector aktiv (`klarwerkai.app.n8n.cloud`). Intake-Workflow **W-SPEC-01** **aktiviert** (Formular-URL live) + Data Table `klarwerk_ideas`. Review-Panel folgt mit API-Keys. Siehe `workflows/README.md`. |
| **Anthropic API** (Claude Opus 4.8) | — | ⬜ später | API-Key bei Bedarf in `.env`. |
| **OpenAI API** (GPT-5.x) | — | ⬜ später | API-Key bei Bedarf in `.env`. |
| **Perplexity API** | — | ⬜ später | API-Key bei Bedarf in `.env`. |
| **Kommunikations-Schnittstelle** | — | ✅ Empfehlung | **Cowork (hier)** als primäre Schnittstelle: Text, Sprache, Dateien, ganze Ordner. Upgrade später: n8n-Webhook → `specs/ideas`. |

## Phase 3 — Wissen & Tracking 🟡 (Connectors verfügbar)

| Service | Connector | Status | Aktion |
|---|---|---|---|
| **Notion** (Doku + Logbuch) | ✔ verfügbar | ✅ eingerichtet | Verbindung in Cowork bestätigen, dann spiegelt der Doku-Agent `/docs` → Notion. |
| **Jira** (Board) | ✅ Board vollständig | `klarwerk.atlassian.net`, Projekt `klarwerk` (Key SCRUM). 14 Epics (SCRUM-5…18) + **78 FR-Stories** (SCRUM-19…96), je unter Epic mit Akzeptanzkriterium + Priorität. Sprintfähig. |

## Phase 0+ — Erstes Modul gebaut ✅
- ✅ **Modul `auth`** implementiert (`services/auth/`): Fastify-Routen, PBKDF2-Hashing, Sessions, RBAC-Adminschutz.
- ✅ Deckt FR-AUTH-01…06 ab; 11 Vitest-Tests grün. **Alle Gates grün:** Build · Lint (Biome) · Architektur (dependency-cruiser) · Tests.
- Persistenz aktuell In-Memory-Repo (`UserRepo`/`SessionRepo`-Interfaces). **Offen:** Postgres-Adapter + Testcontainers-Integrationstests (mit Docker), HttpOnly-Cookie-Härtung/Secure-Flag, FR-AUTH-07 (SSO/OIDC, SOLL) und FR-AUTH-08 (E-Mail-Reset, KANN).

## Phase 4 — Determinismus/Qualität 🟡 (mit erstem Modul)
- 🟡 Testcontainers-Setup je Modul · WireMock für externe Systeme · Coverage-Gate scharf stellen (braucht Docker).

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
