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

## Phase 0+ — Erste Module gebaut ✅
- ✅ **Modul `auth`** (`services/auth/`): Fastify-Routen, PBKDF2-Hashing, Sessions, Onboarding. Deckt FR-AUTH-01…06 (Jira: Done). 11 Tests.
- ✅ **Modul `rbac`** (`services/rbac/`): Rechtematrix Viewer/Experte/Controller/Admin, `can()`-Policy, Admin-Selbstschutz, Fastify-`requirePermission`-Guard. Deckt FR-RBAC-01/03/04 (Jira: Done), FR-RBAC-02 in Arbeit (Löschen + Audit fehlen). 6 Tests.
- ✅ **Modul `knowledge-object`** (`services/knowledge-object/`): KO-Entität mit allen Pflichtfeldern, fünf Wissensarten, Kategorie/Tags-Pflege, Versionierung mit Historie + Bewertungs-Reset, Filter-Liste. Deckt FR-KO-01…04 (Jira: Done). 6 Tests.
- ✅ **Modul `capture`** (`services/capture/`): gemeinsamer Entwurfs-Pool, Originalautor-Erhalt beim Fortsetzen, Metadaten-Validierung, deterministisches KI-Interview, Brücke `toKoInput` → knowledge-object. Deckt FR-CAP-02/06/07/08 (Jira: Done). 6 Tests. *Frontend/Gerät offen:* FR-CAP-01/03/04/05/09 (Diktat, Foto, OCR, Offline).
- ✅ **Modul `validation`** (`services/validation/`): Peer-Bewertung ✅/⚠️/❌, Trust-/Status-Berechnung, Validierungs-Limit, Board (nur offene KOs) mit Filtern, Zuweisungen + Erledigung-durch-Bewertung, Personen-Übersicht. Deckt FR-VAL-01…06 (Jira: Done). 7 Tests. *Offen:* FR-VAL-07 (E-Mail/Push), Trust-Formel gegen Technischen Anhang §3 verifizieren.
- ✅ **Modul `reasoner`** (`services/reasoner/`): austauschbare KI-Schicht (Provider-Interface), deterministischer Fallback ohne Modell, Anti-Halluzination mit Wissensklassen, server-echte Statusanzeige, Schlüssel nur providerseitig. Deckt FR-RSN-01…05 (Jira: Done), FR-RSN-06 in Arbeit (Frontend-Bundle-Nachweis steht aus). 7 Tests. Modellunabhängig — kein API-Key nötig.
- ✅ **Modul `audit`** (`services/audit/`): append-only Audit-Log mit **Hash-Kette** (Manipulation erkennbar), eingefrorene Einträge, Filter, Ketten-Verifikation. Deckt FR-AUD-02 voll (Jira: Done); FR-AUD-01 in Arbeit (Mechanismus steht, Verdrahtung in jede Aktion + FR-RBAC-02-Audit folgt). 5 Tests.
- ✅ **Modul `conflicts`** (`services/conflicts/`): klassifizierte Konflikte (Truth/Experience/Context/Temporal/Role), Eskalation nur für Wahrheitskonflikte, Ablauf Eskalation→Zweitmeinung→Controller-Entscheidung→gelöst, Liste ungelöster Konflikte + Badge-Zähler. Deckt FR-CON-01…04 (Jira: Done). 5 Tests.
- ✅ **Composition-Root `app`** (`services/app/`): verdrahtet alle Fachmodule zu **einer** Fastify-App (modularer Monolith). `buildApp()` + `server.ts`; Endpunkte `/health`, `/api/reasoner/status`, Auth-Routen, geschützte `/api/kos`. End-to-end-Test über vier Module. 2 Tests.
- **Alle Gates grün** (55 Tests gesamt): Build · Lint (Biome) · Architektur (dependency-cruiser, 51 Module, 128 Abhängigkeiten inkl. Typ-Importe, Modulgrenzen nur über index) · Tests.
- **Architektur: modularer Monolith** — ein Deploybares, harte Modulgrenzen (Import nur über `index.ts`, von dependency-cruiser erzwungen). Keine Microservices; spätere Herauslösung einzelner Module bleibt möglich.
- **Backend-Vertikale durchgängig:** Entwurf (`capture`) → `toKoInput` → KO anlegen (`knowledge-object`) → bewerten/validieren (`validation`) → Status „validiert". Reasoner als Querschnitt bereit.
- Persistenz aktuell In-Memory hinter Interfaces. **Offen:** Postgres-Adapter + Testcontainers (Docker), Cookie-Härtung, FR-AUTH-07/08, Audit-Modul (FR-RBAC-02), Frontend (Editor/Erfassung), Module `conflicts`/`ask`/`reasoner` u. a.

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
