# Offene Fragen & zu verifizieren

Punkte, die Agenten selbst als unsicher markiert haben oder die ich gegen Repo/Jira/GitHub prüfen muss.

## Aus Team 1 (2026-07-06)
- [ ] Live-CI-Status auf GitHub (`Klarwerkai/klarwerk`) tatsächlich grün? (Team 1 nur aus Codex-Review abgeleitet)
- [ ] Jira SCRUM-Ticket-Zustände (Status/Assignee) real prüfen — Team 1 hat nicht verifiziert.
- [ ] RC-Kandidat: ist `1e662e9` noch der gültige RC, oder hat Team 5 weitergezogen? HEAD war `35e11ec`.
- [ ] Team-5-Smoke-Ergebnis (Conditional Go/No-Go) — Ausgang offen.
- [ ] Nicht nachgewiesen: 10k/100k-Scale (AG-03), Live-Modell-Benchmark (AG-04), Restore-Test (AG-09),
      Pen-Test (AG-07), DSAR.
- [ ] `docs/TEAM6_UPDATE.md`: „pending"-Zeilen gegen `git log` gegenprüfen (bekannter Doku-Drift).
- [ ] Rolle „Team 2" — laut Team 1 zuständig für RAG/Local-LLM. **Korrektur Boss: Team 2 ist AKTIV**, nicht raus.
      Direkte Befragung nachholen; verifizieren gegen SCRUM-424, KLLM-62.

## Aus Boss (2026-07-06) — hohe Priorität
- [ ] **Verifikationsregel:** ALLE Zahlen/Status gegen `data/pmo-items.json` (Team 7) + Git-Log + After-Report
      (`docs/qm/claude-after-report.md`) prüfen — NICHT gegen Dashboard-`app.js`-Anzeigetexte (bekannt veraltet).
- [ ] Lebende Ist-Zahl bestätigen: `pmo-items.json` Stand 03.07. = 144 Items / 29 done / 33 partially /
      beta-relevant 20/49 done. Aktuellsten Stand ziehen (heute 06.07.).
- [ ] Commit `d25e7df` (04.07. 11:49) — wer hat unter Pedis Git-Identität committet? (C-05a)
- [ ] Freeze `v1.0.0-beta.1`: aktueller Zustand (aufgehoben 04.07.) + Auflagen aus Entscheidungs-Log 04.07.
- [ ] Mandate „Assistent" + „Nerd" ins Entscheidungs-Log aufnehmen lassen (C-05c).
- [ ] Ablage klären: Boss wünscht Erkenntnisse in `PROJECT_CONTEXT` statt Silo — mit Pedi abstimmen.
- [ ] After-Report-Kette + PMO-Automatik (SCRUM-434, `apply-item-update.mjs`) als lebende Quelle einlesen.

## Aus Paul (2026-07-06)
- [ ] 🔑 **SICHERHEIT:** SSH-Deploy-Key wurde früher im Chat sichtbar → **Rotation offen** (neuer Key in Coolify +
      GitHub, alten entfernen). Zusammen mit OpenAI-Key (Team 7) → Key-Rotations-Sammelpunkt für Pedi.
- [ ] SCRUM-464: „KLARWERK Sync" pusht nur Gitea, nicht GitHub — Dauer-Fix entscheiden (Sync erweitern vs. Ship
      pusht selbst). Blockierte zeitweise Ausliefern.
- [ ] SCRUM-463: Admin-Maske „Nutzer anlegen" defekt (Regression, Bezug SCRUM-147) — Workaround Selbst-Registrieren.
- [ ] SCRUM-461: DB-Aufräumen (bewusst vertagt nach Login-Vorfall).
- [ ] Commit-Autorität auf dem Mac klären (C-07 / d25e7df).
- [ ] `docs/team2-austausch/` lesen: `paul-auftrag-erfassung-vordertuer.md`, `paul-notiz-ki-herkunft-fuer-nerd.md`.
- [ ] VIP-Vortest: v1.0.0-beta.1.x als Freeze-Kandidat — aktueller Freeze-Status? (Bezug Boss C-05b)

## Aus Berater (2026-07-06)
- [ ] **K1 (hoch):** Backup der nur lokal existierenden PMO-/Schlüsseldaten — Bus-Faktor auf Pedi (PMO-RISK-0001).
      Existiert ein Off-Machine-Backup?
- [ ] **K3:** Postgres-/`test:integration`-Produktionspfad real getestet? (deckt Team-1/5-Unsicherheit).
- [ ] **H7:** RBAC-Selbstaussperrung gefixt? (Bezug Login-Vorfall / SCRUM-463).
- [ ] **K2 Gate-Erosion:** „Block ohne Gate-Lauf geliefert" — gegen CLAUDE.md-Rangordnung prüfen.
- [ ] Embedding-Modell = einzige nicht frei tauschbare Modellkomponente (modellunabhängige Wissensschicht) — im
      Auftrag nicht adressiert. Für Boss-Strategie relevant.
- [ ] 4 ⚑-Terminologie-Entscheidungen bei Pedi offen (Anzeigename Wissensobjekt; „Bus-Faktor" als Hauptbegriff).
- [ ] Berater-Konzepte in `docs/qm/BERATER_*` + `docs/team2-austausch/berater-*` als Primärquellen lesen.
- [ ] Positionierung Industrie vs. jede Organisation klären (C-09).
