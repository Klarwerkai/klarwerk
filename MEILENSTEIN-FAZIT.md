# KLARWERK — Meilenstein-Fazit

*Stand: 23.06.2026 · Backend-Kern abgeschlossen*

## 1. Worum es ging
Neuauflage von KLARWERK (Enterprise Knowledge Capital Platform) nach dem **Harness-Ansatz**: nicht „KI schreibt Code", sondern Spec (WAS) + Harness (WIE) + Tests (KORREKT) als drei getrennte Wahrheiten. Quelle der Anforderungen ist das vorhandene **Pflichtenheft v1.0** (FR-/NFR mit Abnahmekriterien).

## 2. Aufgesetzte Werkzeuge & Umgebung
| Baustein | Status |
|---|---|
| **Gitea** (self-hosted, localhost:3000) | ✅ installiert, Repo `klarwerk/klarwerk` (privat), Branch-Protection auf `main`, Code gepusht |
| **Harness** (`CLAUDE.md`, `/harness`, `/specs`, `/tools`) | ✅ vollständig; Specs = Pflichtenheft + 14 Modul-Stories |
| **Jira** (`klarwerk.atlassian.net`) | ✅ Board: 14 Epics + ~78 FR-Stories, laufend auf Done/In-Progress gepflegt |
| **n8n** (`klarwerkai.app.n8n.cloud`) | ✅ verbunden; Intake-Workflow **W-SPEC-01** aktiv + Data Table |
| **Notion** | ✅ Connector verbunden (Doku/Logbuch-Spiegel vorgesehen) |
| **CI (Gitea Actions)** | 🟡 Workflow vorhanden, Runner aufgeschoben (Docker) |

## 3. Architektur
**Modularer Monolith — keine Microservices.** Ein Deploybares (`services/app`, Fastify), Module unter `/services/<modul>` mit **harten Grenzen**: Import nur über die öffentliche `index.ts`, von **dependency-cruiser** erzwungen (inkl. Typ-Importe). Spätere Herauslösung einzelner Module bleibt möglich.

**Stack:** Node 20 + TypeScript (strict) · Fastify · Biome (Lint/Format) · Vitest. Persistenz vorerst In-Memory hinter Repo-Interfaces (Postgres-Adapter + Testcontainers folgen mit Docker). Begründung Stack: Pflichtenheft verlangt On-Premises + EU-Residenz — der proprietäre Cloudflare-Stack der Alt-App kann das nicht.

## 4. Gebaute Module (13) — alle Gates grün
| Modul | Deckt FR | Tests |
|---|---|---|
| `auth` | AUTH-01…06, RBAC-04, Audit | 13 |
| `rbac` | RBAC-01…04 | 6 |
| `knowledge-object` | KO-01…04 | 7 |
| `capture` | CAP-02/06/07/08 | 6 |
| `validation` | VAL-01…06 | 8 |
| `reasoner` | RSN-01…05 | 7 |
| `conflicts` | CON-01…04 | 6 |
| `ask` | ASK-01…05 | 4 |
| `library-analytics` | LIB-01/03/04, ANA-01 | 7 |
| `lifecycle` | LIF-01/02/03 | 3 |
| `i18n` | I18N-02 | 3 |
| `audit` | AUD-01/02 (Hash-Kette) | 5 |
| `app` (Composition-Root) | Verdrahtung + E2E | 2 |

**Gesamt: 77 Tests grün · Build · Lint · Architektur (68 Module, 184 Abhängigkeiten, 0 Verletzungen).**

## 5. Durchgängige Vertikale (end-to-end getestet)
Entwurf erfassen (`capture`) → `toKoInput` → KO anlegen (`knowledge-object`) → bewerten/validieren (`validation`) → Status „validiert" → fragen/Wissenslücken (`ask` über `reasoner`) — quer durch die Module, jede Aktion **auditiert** (append-only Hash-Kette).

## 6. Board-Status (qualitativ)
- **Vollständig Done:** KW-AUTH (MUSS), KW-RBAC, KW-KO, KW-CON, KW-VAL (MUSS-Teil). Audit (AUD-01/02), Reasoner-Kern.
- **Teilweise / In Progress:** FR-LIB-02 (PDF-Export fehlt), FR-ANA-02, FR-ASK-06, FR-RSN-06, FR-I18N-01 (KI-Sprache), FR-LIF-04 (Anzeige).
- **Bewusst nicht im Backend:** `structure` (Editor), `mobile` (PWA), `extensions` (Konzept-Screens) — gehören in die React-App.

## 7. Bewusst aufgeschoben (Infra)
Postgres-Adapter + Testcontainers (Docker), echter LLM-Provider (API-Keys), PDF-Export, E-Mail/Push-Benachrichtigungen, Cookie-Secure-Flag, volle Agenten-Organisation (Stufe 2 mit zwei externen Teams, siehe `docs/operations/governance-and-teams.md`).

## 8. Empfohlene nächste Schritte
1. **React-App anbinden** — Bestands-UI (KLARWERK app/) gegen das neue Backend (Frontend-FRs: Editor, PWA, Screens).
2. **Infrastruktur scharf schalten** — Docker → Postgres + Testcontainers, CI-Runner, echter Reasoner-Provider.
3. **Stufe 2 aktivieren** — sobald zwei externe Teams an Bord sind: volle Agenten-Org + Notion-Logbuch.

> Kernaussage: Der Backend-Kern von KLARWERK ist als getesteter, regelkonformer modularer Monolith abgeschlossen. Der Hebel war nicht „KI schreibt Code", sondern explizite, ausführbare Regeln — Anforderungen, Architektur und Qualität maschinenlesbar.
