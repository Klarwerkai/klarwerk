# KLARWERK — Architektur, Rollen & Datenstruktur

> Kompakter Überblick (Onboarding-Einseiter). Stand **06.07.2026**, Live **v1.0.0-beta.1.4**.
> Verifiziert gegen `dev_Klarwerk`-Repo, Git-Log, Jira-Connector und die Agenten-Auskünfte.
> Detailtiefe: `docs/boss-assistant/` (Interviews, `code-map.md`, `jira-inventar.md`, `contradictions.md`).

## Schichtenmodell (Kurzfassung)

```
MENSCHEN & AGENTEN   Pedi · Boss · Paul · Berater · Nerd · Assistent
        │  bauen & pflegen
        ▼
TRACKS / REPOS       7 Jira-Projekte (SCRUM·KLLM·KWEB·KBB·KREL·KGURU·KWN) + PMO (ohne Git)
        │
        ▼
APP-ARCHITEKTUR      apps/web (React SPA) ──/api──► services/ (21 Fastify-Module)
                     single-origin · Modulgrenzen via dependency-cruiser · Harness-Gates
        │
        ▼
DATEN & PERSISTENZ   Live=Postgres (Coolify/Hetzner) · Desktop=Journal · Insel=Journal (kein Backup)
```

## 1. Architektur

**Modularer Monolith.** Node 20 + TypeScript (strict), Fastify (Backend), Vite/React (Frontend).

- **Backend `services/` — 21 Module**, jedes kapselt seine Datenhaltung. Cross-Modul-Zugriff nur über die
  öffentliche `index.ts` des Zielmoduls; **dependency-cruiser** erzwingt das (Build bricht sonst).
- **Frontend `apps/web`** — React-SPA, 20 Seiten, 29 Komponenten, 158 DOM-freie lib-Helfer; zentrale Komponente
  `KnowledgeInputStudio.tsx`. Wird **single-origin** mit `/api` ausgeliefert (eine Domain, ein Zertifikat, kein CORS).
- **Harness-Prinzip:** `specs/` (WAS) → `harness/` (WIE) → `tests/` (OB korrekt; 195 Testdateien).
- **Gate `npm run check`:** Build (tsc) → Lint (Biome) → Arch (dependency-cruiser) → Tests (Vitest); dazu Playwright-Smoke.
- **Deploy:** GitHub → Coolify → Hetzner (`app.klarwerk.ai`); Push über „KLARWERK Sync" nach GitHub + lokalem Gitea.

### Module (services/)
`app` (Server/Routen/Web-Delivery) · `reasoner` · `conflicts` (inkl. Duplikate/Overlap) · `auth` · `knowledge-object`
· `validation` · `ask` · `capture` · `audit` · `external-search` · `model-runs` · `object-store` · `lifecycle`
· `management` · `library-analytics` · `media` · `notifications` · `output` · `rbac` · `structure` · `i18n`.

## 2. Rollenverteilung

| Rolle | Wer | Zuständigkeit | Status |
|---|---|---|---|
| Stakeholder | **Pedi** (Mensch) | entscheidet alles, fährt Gates/Runner, committet, pusht, deployt | aktiv |
| Steuerung | **Boss** (Agent) | Koordination + Produktrichtung | zurück Di. 07.07. |
| Umsetzung | **Paul** (Cloud-Worker) | baut Features, liefert an Pedis Mac — **keine Governance** | aktiv |
| Beratung | **Berater** (read-only) | Audit, Fachkonzepte, Hilfe/Bibliothek | aktiv |
| Betrieb | **Nerd** | air-gapped Mac-Studio-Insel (lokaler LLM) | aktiv |
| Wissen | **Assistent** | Wissensbasis, Verifikation, Onboarding | aktiv |

**Grundmuster:** Claude-Sessions bauen → Pedi entscheidet/committet/deployt. Alle Commits laufen unter Pedis
Git-Identität (`peterkohnert@mac`). Die früheren „Teams 1–7" sind heute vor allem **logische Tracks / Jira-Präfixe**;
die dedizierten Team-Agenten sind — außer Paul/Berater/Nerd — nicht mehr aktiv (Teams 3/5/6 ruhen seit 01.07.,
Team 2 beendet).

## 3. Datenstruktur

**Kernobjekt — Knowledge Object (KO):** Erfahrungswissen mit
- **Status:** `entwurf → offen → validiert` (bzw. `abgelehnt` / `konflikt`),
- **Trust-Wert 0–99** (Deckel `TRUST_MAX = 99`),
- einer der **fünf Wissensarten**,
- Versionen + Evidence, Audit-Kette.

**Je Modul eigene Entitäten & Repos**, jeweils in zwei Adapter-Varianten — `Pg…Repo` (Postgres) und
`InMemory…Repo` — zur Laufzeit über `DATABASE_URL` gewählt. Wichtige Entitäten: KO + KO-Versionen + Evidence,
Drafts (capture), Konflikte + Overlap/Duplikate, Audit-Kette, Users/Sessions/PasswordReset (auth), Gaps (ask),
Import-Candidates, Model-Runs, Notifications-Seen, Assist-Presets, Validation-Settings, External-Knowledge-Policy,
Upload-Limits, Objects (object-store).

### Drei Persistenz-Umgebungen
| Umgebung | Persistenz | Backup |
|---|---|---|
| **Live-Server** (Coolify/Hetzner) | **Postgres** — `migrate()` legt alle Schemata an; Fail-Loud-Guard verhindert Start ohne Persistenz | Coolify-Backup (DR-Drill offen) |
| **Desktop-App** (Pedis Mac) | **Journal** `.localdb/state.jsonl` (`KLARWERK_DEV_PERSIST=1`), append-only | — |
| **Mac-Studio-Insel** (VIP) | **Journal, NICHT Postgres** | **KEINS** — SPOF (KLLM-70) |

### Rollen im Produkt (RBAC)
`admin · experte · viewer` (Prüfen/Validieren durch Controller/Admin); `canChangeRole` serverseitig erzwungen,
letzter aktiver Admin nicht degradierbar (SCRUM-443).

### Offener Verifikationspunkt (K3)
Der Postgres-Pfad ist strukturell vollständig verdrahtet (`buildPgServices()` + `migrate()`), aber nur über **einen**
Real-Postgres-Integrationstest erprobt (Kette Register→Login→KO→Draft→Rating→Lifecycle→Audit). Nicht automatisiert
gegen echtes Postgres getestet: Object-Store, Conflicts/Overlap, Model-Runs, Notifications, Assist-Presets,
External-Knowledge, Upload-Limits, Candidates, Validation-Settings. Der Test liegt in der `test:integration`-Lane
(braucht Docker) — der schnelle Gate fasst echtes Postgres nicht an. → Aufgabe des künftigen Systemadministrators.

### Produkt-DNA (durchgängig)
Ehrlichkeit vor Optik: deterministischer Fallback statt Fake-KI, quellengebundene Antworten, **Wissenslücke statt
Erfindung**, KI speichert nie automatisch, Belegstellenpflicht bei Dokument-Extraktion.
