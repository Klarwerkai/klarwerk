# KLARWERK — GitHub- & Jira-Architektur (wer macht wo was)

> Stand **06.07.2026**. Verifiziert über das Sync-Skript (`~/Documents/Klarwerk/tools-sync/`),
> die tatsächlich konfigurierten Git-Remotes und den Jira-Connector (`klarwerk.atlassian.net`,
> cloudId `a43f55b1-80de-4661-aa9d-e9bd5c697140`). Ergänzt `architektur-rollen-daten.md`.

## Repos ↔ Jira ↔ wer

| GitHub-Repo (Org `Klarwerkai`) | Jira | Track / wer arbeitet | Remotes | Deploy | Status |
|---|---|---|---|---|---|
| `klarwerk` | **SCRUM** | Produkt — Paul baut, Pedi committet/deployt | `github` **+ Gitea** | Coolify → Hetzner (`app.klarwerk.ai`) | LIVE, aktiv |
| `klarwerk-local-llm` | **KLLM** | Local LLM — Team 2 (beendet) → Paul/Nerd | GitHub | Eval-GPU on demand | aktiv |
| `klarwerk-public-website` | **KWEB** | Website (Astro) — Team 4, Videos via Pedi | GitHub | Hetzner-Preview | ruht |
| `klarwerk-business-backend` | **KBB** | Business-Blueprint (nur Doku) — Team 3 | GitHub | — | ruht (0 offen) |
| `klarwerk-release-ops` | **KREL** | Release-QA (nur Doku) — Team 5 | GitHub | — | ruht |
| `klarwerk-knowledge-guru` | **KGURU** | Gap-Kontrolle (read-only) — Team 6 | GitHub | — | ruht (0 offen) |
| *(kein eigenes Repo)* | **KWN** | Nerd/Insel — arbeitet in `dev_Klarwerk` + Mac Studio | — | Mac-Studio-Insel (air-gapped) | aktiv |
| `KLARWERK_Reporting_PMO` | *(kein Jira)* | PMO — Team 7, lokal | **kein Git** | lokal (Dashboard) | aktiv (Automatik) |

## Git-Remotes (verifiziert)
- **`dev_Klarwerk` = einziges Repo mit zwei Remotes:**
  - `github` → `git@github.com:Klarwerkai/klarwerk.git`  *(DAS baut Coolify)*
  - `origin` → `http://localhost:3000/klarwerk/klarwerk.git`  *(lokale Gitea)*
- **Alle anderen Repos:** nur `origin` → `git@github.com:Klarwerkai/<repo>.git` (kein Gitea-Spiegel).
- Folge / bekannter Bug **SCRUM-464 (High):** „KLARWERK Sync" pushte nur nach Gitea → Coolify baute alte Commits;
  am 06.07. per Ship-Skript umgangen (pusht jetzt selbst nach GitHub). Dauer-Fix (Sync um GitHub-Push ergänzen) offen.

## Liefer-Kette (Produkt · nur `dev_Klarwerk`)
```
Paul (Cloud-Session)  →  liefert Dateien an Pedis Mac
        ▼
Pedi startet „KLARWERK Paul Runner"  →  Gate: build · lint(Biome) · arch(dependency-cruiser) · vitest · smoke
        ▼ (nur bei GRÜN)
Pedi committet  (alle Commits unter peterkohnert@mac)
        ▼
„KLARWERK Sync"  →  Push nach GitHub  (+ Gitea nur bei dev_Klarwerk)
        ▼
Coolify  →  Dockerfile-Build aus GitHub
        ▼
Live: Hetzner  ·  app.klarwerk.ai  ·  Postgres
```
- **CI:** `.github/workflows/ci.yml` (GitHub).
- **Werkzeuge** liegen in `~/Documents/Klarwerk/tools-sync/`: „KLARWERK Sync", „KLARWERK Paul Runner",
  „KLARWERK Pruefstand" (+ `.command`-Skripte).
- **Ruhende Doku-Repos** (KBB/KWEB/KREL/KGURU): historisch über **Codex** committet/gepusht, ohne diesen Deploy-Pfad.
- **Entscheidungen** trifft in allen Fällen **Pedi**.

## Jira-Struktur
- Ein Cloud-Tenant `klarwerk.atlassian.net`; **7 Next-Gen-Software-Projekte, 1:1 zu den Repos** —
  Ausnahmen: **KWN** (Jira ohne eigenes Repo), **PMO/Team 7** (Repo/Ordner ohne Jira).
- Konvention: jedes Ticket trägt sein Projekt-Präfix. **Cross-Referenzen:** KGURU prüft fixe SCRUM-Commits
  (`git show <commit>`); KWN-Tickets sind aus KLLM-62 abgeleitet; Teams melden Querstände über `docs/TEAM6_UPDATE.md`.
- **Bestand:** ~676 Tickets gesamt. Aktiver Backlog v. a. **SCRUM (~60 offen)** und **KLLM (~24 offen,** inkl. Serie
  „KLARWERK-Gehirn" KLLM-63…69**)**; **KWN** 5 offen, **KWEB** ~7, **KREL** 1, **KBB/KGURU** 0 offen. Details:
  `jira-inventar.md`.

## Rollen-Kurzregel
**Claude-Sessions bauen · Codex bespielte historisch die Doku-Repos · Pedi entscheidet, committet, pusht, deployt.**
Governance liegt bei Boss/Pedi, nicht bei Paul.
