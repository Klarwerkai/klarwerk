# Klarwerk — Wartungs- & Update-Prozess (Betreiber-Runbook)

> Praktisches Ops-Runbook für **stabilen, aktuellen Langzeitbetrieb**: Wartungsrhythmus,
> Update-Klassen, Test-/Staging-Gates, Backup/Rollback, Modell-/Provider-Evaluation.
> Verwandte Doku: `docs/operations/deploy-hetzner.md`, `secrets-management.md`,
> `pre-launch-protection.md`, `governance-and-teams.md`, `docs/compliance/gdpr-compliance-runbook.md`,
> `SETUP.md`, `README.md`. **Keine** Infrastrukturänderung / keine neue Runtime in diesem Dokument.

---

## 0. Verwaltungs-Landkarte (kurz)

| Aufgabe | Ort |
| --- | --- |
| Code, CI-Gates, Secret-**Referenzen** | Git-Repo |
| Deploys, Laufzeit-Secrets, Logs, TLS | Coolify (Hetzner-Server) |
| Domain, DNS, Schutz | Cloudflare |
| App-/Transaktions-E-Mail | Brevo/Mailjet |
| DB-Daten & Backups | Postgres + Hetzner-Snapshots + `pg_dump` |

---

## 1. Wartungsrhythmus

| Kadenz | Aktivität |
| --- | --- |
| **Wöchentlich** | Health/Logs sichten (`/health`), Fehlerquote, Backup-Lauf erfolgreich? |
| **Monatlich** | Dependency-/Security-Updates (Patch), `npm run check` lokal, kleine App-Updates ausrollen |
| **Quartalsweise** | Minor-Updates (Dependencies/Runtime), Modell-/Provider-Review, **Compliance-/Secrets-Review** (siehe `gdpr-compliance-runbook.md` §6, `secrets-management.md` §10), Rollback-Probe |
| **Halbjährlich/Jährlich** | Major-Updates (Node/Postgres-Major), Rotation langlebiger Secrets, DSFA-Schwelle neu prüfen |
| **Ad hoc (sofort)** | Sicherheits-Patches (CVE), Provider-Ausfall, Vorfall → Notfallpfad §11 |

---

## 2. Update-Klassen

| Klasse | Was | Verfahren | Risiko |
| --- | --- | --- | --- |
| **App-Code** | Klarwerk-Features/Fixes | Git-Push → CI grün → Coolify-Deploy | niedrig (CI deckt ab) |
| **Dependencies** | npm-Pakete | gestaffelt (patch→minor→major), `npm run check` + Tests | mittel bei Major |
| **OS/Runtime** | Node 20.x, Server-OS, Coolify | erst Staging, dann Prod-Fenster | mittel/hoch bei Major |
| **Datenbank** | Postgres-Version/Migrationen | **erst Backup**, Migration prüfen, Restore-Probe | hoch |
| **Reasoner/Model-Provider** | `ANTHROPIC_API_KEY`, `REASONER_MODEL` | reine **Env-Änderung** + Verifikation (§8) — **keine Architektur** | niedrig |
| **Secrets/Zertifikate** | Keys, SMTP, OIDC-Secret, TLS | per `secrets-management.md` (Rotation §7) | mittel |

---

## 3. Vorab-Checkliste (vor jedem Prod-Update)

- [ ] Änderung klassifiziert (§2) und Risiko bewertet.
- [ ] **Backup frisch** (Snapshot + `pg_dump`) und Restore-Pfad bekannt.
- [ ] Lokal/Staging: `npm run check` **grün** (build/lint/arch/test); bei FE zusätzlich `cd apps/web && tsc --noEmit` + Vite-Build.
- [ ] Changelog/Commit-Hinweis vorhanden; Rollback-Punkt notiert (Commit/Image).
- [ ] Wartungsfenster + Verantwortliche festgelegt (§7).
- [ ] Secrets/Env unverändert oder bewusst angepasst (kein Secret ins Repo).

---

## 4. Test-/Staging-Verfahren

1. Änderung auf einem **Staging-Deploy** (separate Coolify-App/Branch) ausrollen.
2. **Smoke-Test:** `GET /health` → `{"status":"ok"}`; Login; Kernpfad Capture → Validate → Use → Maintain (siehe `docs/demo/stage-1-demo-path.md`).
3. Bei DB-/Provider-Änderungen: gezielt prüfen (Migration, Reasoner-Status-Badge).
4. Erst nach grünem Staging → Prod.

---

## 5. Pflicht-Gates (nicht verhandelbar)

- **CI (`.github/workflows/ci.yml`)**: `npm run build` (tsc) · `npm run lint` (Biome) · `npm run arch` (dependency-cruiser) · `npm run test` (Vitest). **Nichts nach `main` ohne grüne Pipeline.**
- Lokal äquivalent: **`npm run check`**.
- Coolify-Deploy nur nach grünem Build; **Post-Deploy-Smoke** `/health` Pflicht.

---

## 6. Backup- & Rollback-Schritte

**Backup (vor Update):**
- Hetzner-**Snapshot** des Servers/Volumes.
- **`pg_dump`** (Coolify-Scheduled-Task, verschlüsselt ablegen) — zusätzlich manuell vor riskanten Updates.

**Rollback (wenn Update fehlschlägt):**
1. **App-Code:** in Coolify auf das **vorherige Deployment/Image** zurücksetzen (Redeploy previous) **oder** Git-Revert + Push → CI → Deploy.
2. **Datenbank:** bei fehlerhafter Migration **Restore** aus letztem `pg_dump`/Snapshot.
3. **Provider/Model:** Env auf vorherigen Wert (`REASONER_MODEL`/Key entfernen → deterministischer Fallback bleibt verfügbar).
4. **Secrets:** bei Rotation-Problem alten Wert (sofern noch gültig) reaktivieren bzw. neu rotieren (`secrets-management.md` §7).
5. Nach Rollback: `/health` + Kernpfad-Smoke; Vorfall dokumentieren.

---

## 7. Wartungsfenster & Rollen

- **Fenster:** außerhalb der Hauptarbeitszeit; Dauer/Termin vorab kommunizieren. Major-DB/Runtime-Updates immer im geplanten Fenster.
- **Rollen** (Betreiber benennt namentlich):
  - **Release-/Deploy-Verantwortlicher:** führt Update + Smoke + Rollback aus.
  - **DB-/Infra-Verantwortlicher:** Backup/Restore, Server/Coolify.
  - **DSB/Security:** Compliance-/Secrets-Review (quartalsweise), Vorfallbewertung.
  - Governance/Eskalation: `docs/operations/governance-and-teams.md`.

---

## 8. Modell-/Provider-Evaluation (ohne neue Architektur)

Klarwerk ist **anbieteragnostisch**: ohne `ANTHROPIC_API_KEY` läuft der **deterministische Fallback**, mit Schlüssel der **Modellmodus** (`build-app.ts` → `ModelProvider`/`createModelClientFromEnv`). Ein Provider-/Modellwechsel ist eine **Env-Änderung**, kein Umbau:

1. Neues Modell/Provider in **Staging** via `REASONER_MODEL`/Key setzen.
2. **Reasoner-Status-Badge** (`/fragen`) prüft Modus/Provider/Modell transparent (`Reasoner.status()`).
3. Kernfragen testen: validiertes KO → quellengebundene Antwort; ohne Basis → ehrliche Wissenslücke (Antwortlogik/Quellenbindung bleibt unverändert).
4. **DSFA-/Datenfluss-Check** bei externem Anbieter (`gdpr-compliance-runbook.md` §2): verlässt der Modellmodus Daten an Dritte?
5. Erst nach grünem Staging + Compliance-Ok → Prod-Env umstellen. Rollback = Env zurück (Fallback immer verfügbar).

> Regel: **keine** Modellinstallation/RAG-/Vector-/Conductor-Arbeit — nur Konfiguration der vorhandenen Provider-Schicht.

---

## 9. Security-/Compliance-Review (an Updates gekoppelt)

- Nach jedem größeren Update: Secret-/Zugriffs-Check (`secrets-management.md`), RBAC unverändert, Audit-Integrität (`verify`/Analytics-Audit, `gdpr-compliance-runbook.md`).
- Default-/Demo-Credentials weiterhin geändert? Pre-Launch-Gate/TLS aktiv?
- Security-Patches der Update-Klasse „ad hoc" nicht aufschieben.

---

## 10. Post-Update-Monitoring

- **Sofort:** `/health` grün, Login, Kernpfad-Smoke, Coolify-Logs ohne Fehler-Spikes.
- **24–72 h:** Fehlerquote/Latenz beobachten; Backup-Lauf nach Update erfolgreich; Nutzer-Rückmeldungen.
- Auffälligkeiten → Rollback (§6) erwägen.

---

## 11. Notfallpfad

1. **Stabilisieren:** auf letztes funktionierendes Deployment/Backup zurück (§6).
2. **Eingrenzen:** Logs/Audit prüfen; betroffene Komponente/Update identifizieren.
3. **Secrets:** bei Verdacht auf Kompromittierung → Notfallrotation (`secrets-management.md` §7), Sessions invalidieren.
4. **Kommunizieren:** Stakeholder/Pedi informieren; bei DSGVO-Relevanz Meldepflichten prüfen.
5. **Nacharbeit:** Ursache dokumentieren, Gate/Checkliste ergänzen (Harness-Correction-Gedanke), erst dann erneut ausrollen.

---

## 12. Offene Betreiberpflichten / Nicht-Ziele

- **Staging-Umgebung** real bereitstellen (separate Coolify-App/DB) — Ops-Aufgabe.
- **Backup-Restore-Probe** regelmäßig tatsächlich durchführen (nicht nur dokumentiert).
- **Monitoring/Alerting** (Uptime, Fehlerraten) einrichten — Hosting-/Ops-Aufgabe.
- **Termine + namentliche Rollen** für Wartungsfenster festlegen.
- Keine neue Runtime/Infrastruktur, keine Modellinstallation in diesem Runbook.

---

*Read-only Ops-Runbook. Kein Produktcode geändert; keine Infrastruktur-/Runtime-/Modell-Installation. Verweist nur auf vorhandene Gates, Deploy- und Compliance-Doku.*
