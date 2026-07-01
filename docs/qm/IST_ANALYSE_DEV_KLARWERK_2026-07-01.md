# Ist-Analyse dev_Klarwerk (Team 1) — 2026-07-01

**Anlass:** Projektaudit-Paket 2026-07-01 · Auftrag Pedi: Projekt wieder auf Vordermann bringen, Startpunkt Ist-Analyse Team 1.
**Prüfumgebung:** Sandbox (Linux, Node 22, ohne Docker) auf Kopie des Arbeitsbaums. Hinweis: Node-Engine im Repo ist ">=20"; lokal auf dem Mac sollte die Referenzprüfung mit der dort installierten Node-Version wiederholt werden.

---

## 1. Repo-Zustand

| Punkt | Befund |
|---|---|
| Branch / Remote | `main`, up to date mit `github/main` |
| HEAD | `35e11ec` — SCRUM-379 (Smoke Fix Response Lane, doc-only) — **1 Commit neuer als Audit-Dossier** |
| RC-Kandidat | `1e662e9` (SCRUM-377), Handoff `c0863c6` (SCRUM-378) — konsistent mit Handoff-Doku |
| Untracked | nur `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` (bekannt, bewusst ausgeklammert) |
| Hygiene-Fund | ~90 Dateien `vitest.config.ts.timestamp-*.mjs` im Root (Vite-Temp-Müll; sollte gelöscht + in `.gitignore` aufgenommen werden). Sie sind lokal, nicht committed. |

## 2. Qualitäts-Gates (Rangordnung aus CLAUDE.md)

| Gate | Ergebnis | Detail |
|---|---|---|
| 1. Build (`tsc --noEmit`, inkl. apps/web) | **grün** | 0 Fehler (nach Installation der FE-Deps via `npm ci` in `apps/web`) |
| 2. Architektur (`depcruise`) | **grün** | 181 Module, 562 Dependencies, keine Violations |
| 3. Lint (Biome) | **grün** | 535 Dateien, keine Findings |
| 4. Tests (Vitest unit) | **grün** | 197 Testdateien, 1199 Tests bestanden |
| 4b. `test:integration` (Testcontainers/Postgres) | **nicht ausführbar** | Sandbox ohne Docker; muss lokal auf dem Mac laufen |

Fazit: Der `tools/check`-Pfad ist grün. Kein Code-Sanierungsbedarf auf Gate-Ebene.

## 3. Analyse der P1-Blocker (KREL-33)

### 3.1 RC-genaue Frontend-Runtime/Build-Evidence fehlt — bestätigt

- `apps/web/dist/` ist gitignored **und veraltet** (Stand 27.06.), der RC-Kandidat `1e662e9` ist neuer → genau die von Team 5 monierte Lücke.
- **Aber:** Der Build ist reproduzierbar. `npm --prefix apps/web run build` läuft sauber durch (tsc + vite, ~3 s). Die Lücke ist reine **Dokumentations-/Nachweis-Arbeit**, kein Defekt.
- Runtime-Startpfad funktioniert: `npm start` (tsx, Fastify) → `GET /health` = `{"status":"ok"}` (200), SPA-Fallback `/` = 200.

**Empfohlener Slice (Rang 1, klein):** „Beta RC Runtime Start Path & Build Evidence v0" — am RC-Commit `1e662e9`: frischen FE-Build erzeugen, Build-Log + SHA-256-Hashes der dist-Artefakte + exakte Startbefehle (Backend-Port, `vite preview`/static serve) in einem Evidence-Doc unter `docs/` festhalten. Danach Team-5-Re-Smoke.

### 3.2 Playwright-Smoke blockiert — Ursache klar

- `scripts/smoke-browser.mjs` (SCRUM-218) existiert und ist durchdacht, setzt aber manuelles `npm i -D playwright && npx playwright install chromium` voraus; Playwright ist **nicht** in den devDependencies.
- **Entscheidung nötig (Pedi):** (a) Playwright als devDependency aufnehmen + Install-Schritt in Handoff/CI dokumentieren, oder (b) minimalen curl-basierten Route-Smoke als Ersatz definieren.

## 4. Nebenbefunde (P2 / Observation, kein Fix-Slice ohne Freigabe)

- Vite-Bundle-Warnung: Chunks > 500 kB (index ~789 kB, pdf.worker ~2,3 MB) → post-RC Code-Splitting prüfen.
- `npm audit` in `apps/web` meldet Findings (nicht bewertet; post-RC prüfen).
- Timestamp-Müll im Root (siehe 1.) — 5-Minuten-Aufräumer, gitignore-Eintrag `vitest.config.ts.timestamp-*` empfohlen.

## 5. Priorisierter Plan (Vorschlag an Pedi)

| Rang | Schritt | Aufwand | Blockiert |
|---|---|---|---|
| 1 | Runtime Start Path & Build Evidence v0 (Doc + frischer Build + Hashes am RC) | klein | Team-5-Re-Smoke |
| 2 | Playwright-Entscheidung (devDep vs. Alternativ-Smoke) | Entscheidung + klein | automatisierter Browser-Smoke |
| 3 | Team-5-Re-Smoke anstoßen (KREL) | extern | Beta-Evidence |
| 4 | Repo-Hygiene (Timestamp-Dateien, .gitignore) | trivial | — |
| 5 | Integrationstests lokal auf Mac verifizieren (`tools/test` mit Docker) | klein | vollständige Gate-Evidence |

Kein neuer Feature-Slice, bis 1–3 durch sind (entspricht Audit-Aktionsplan und SCRUM-379-Lane).
