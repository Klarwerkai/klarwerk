# Repos, Ordner & Werkzeuge — die Karte

## Repos (alle via „KLARWERK Sync" → GitHub + Gitea)

| Ort (lokal) | Inhalt | Jira |
|---|---|---|
| `~/Documents/dev_Klarwerk` | **Die KLARWERK-App** (dieses Repo): `/services` Module, `/apps/web` Frontend, `/tests`, `/tools`, `/docs`, `desktop-app/` Starter, `PROJECT_CONTEXT/` | SCRUM |
| `~/Documents/Klarwerk/klarwerk-public-website` | Öffentliche Website (Astro), Video-Prompts unter `docs/` | KWEB |
| `~/Documents/Klarwerk/klarwerk-knowledge-guru` | Team 6: Anforderungs-/Wissensregister, CI-Referenz | KGURU |
| `~/Documents/Klarwerk/klarwerk-local-llm` | Team 2: LLM-Server-Konzept + Ein-Klick-Skripte | KLLM |
| (2 weitere Repos laufen im Sync mit — Details im Sync-Skript) | | |

## Bewusst OHNE Git

- `~/Documents/KLARWERK_Reporting_PMO` — PMO-Dashboard (`index.html` öffnen), `data/pmo-items.json`,
  Skripte (`apply-item-update.mjs`, `import-master-scope.mjs`), **Prüfstand**
  (`data/pruefstand-testfaelle.json`, `scripts/pruefstand-run.mjs` → Referenz `anthropic` oder lokale LLM-URL).
- `~/Documents/Klarwerk/llm-eval-zugang/` — SSH-Schlüsselpaar für den LLM-Server (NIE in ein Repo!).

## Schreibtisch (Pedis Bedienoberfläche)

- **KLARWERK App.app** — startet die App lokal (prüft/erfragt Anthropic-Key aus dem Schlüsselbund).
- **KLARWERK Sync.app** (+ „KLARWERK Sync starten.command") — pusht alle Repos, sichtbares Terminal.
- **KLARWERK LLM.app** (+ .command) — Team-2-Ein-Klick: UpCloud-Server erstellen/Status/Löschen + Tunnel.

## Wichtige Dateien in diesem Repo

- `CLAUDE.md` — Harness-Regelwerk (oberste Regeln für jeden Agenten).
- `docs/qm/BOSS_SESSION_STAND_2026-07-02.md` — Boss-Session-Übergabestand.
- `docs/qm/claude-after-report.md` — lückenlose After-Reports (Projektgedächtnis!).
- `docs/ci/CI_KURZREFERENZ.md` + `docs/ci/brand-book/` — CI (Orange #ED7D0E einziger Akzent,
  Stahl #16222C, KI-Violett #5B50C4, IBM Plex; Video-Regeln inkl. Untertitel-Pflicht).
- `apps/web/src/version.ts` — APP_VERSION (bei jeder UI-Änderung bumpen).
- `tests/security/routeGuardAudit.ts` — Guard-Matrix (jede neue Route eintragen).

## Externe Systeme

- **Jira** `klarwerk.atlassian.net` (Cloud-ID gleichnamig), Projekte SCRUM/KWEB/KLLM/KGURU/KREL.
- **GitHub + Gitea** — nur über Sync-App befüllt.
- **UpCloud** (Team 2, Konto Pedi): GPU-Limit 1 freigeschaltet; ~500 € Gratis-Credits (Verfall ~01.08.2026,
  werden vor Guthaben verbraucht) + 500 € Einzahlung. H100 oft „at capacity" → Eval auf 1× L40S 48 GB (1,11 €/h).
- **Anthropic API** — Reasoner der App + PMO-Prüfstand (Keys im Schlüsselbund, s. Arbeitsregeln).
