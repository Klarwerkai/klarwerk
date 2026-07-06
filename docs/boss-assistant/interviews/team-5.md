# Interview — Team 5

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Team 5 (unverifiziert, wo markiert)._

## 1. Rolle & Domäne
- **Team 5 = Release Ops / Beta QA / Deployment Readiness.** Macht KLARWERK beta-releasefähig über Checklisten,
  Gates, Runbooks, Smoke-/Readiness-Prüfung, RC-Bewertung. Baut **nicht** das Produkt; strikt getrennt von Team 1–4/6/7.
- Rollenmodell: **Pedi** entscheidet (Go/No-Go, Server, Deployment, DNS); **Codex** = Controller/Gatekeeper (Git/Jira);
  **Claude (Team 5)** = Hauptautor QA-/Readiness-Doku, kein Git/Push/Jira/Deploy/Serverzugriff.

## 2. Aufgaben & Verantwortung
- Release-Gates, QA-Checklisten, Browser-Smoke-/E2E-Pläne, Deployment-Runbooks, Backup/Restore/Rollback-Readiness,
  Environment-/CI-CD-Readiness, Incident-/Bug-Triage, RC-Intake-Kontrolle, Evidence/Traceability, Hand-off-Docs.
- **Repo: `klarwerk-release-ops`**, Remote `git@github.com:Klarwerkai/klarwerk-release-ops.git`.

## 3. Aktueller Stand
- **Fertig:** Blueprint-Set (73 Dateien in `docs/`, 33 Commits, `main` sauber auf `origin/main`, HEAD `7e85733`) —
  Charter bis Closure/Retro/Governance/Execution-Packs.
- **Zuletzt:** echte RC-Bewertung — KREL-32 (RC-Handoff-Intake + review-basierter Smoke), KREL-33 (begrenzter
  lokaler Runtime-Smoke).
- **Ergebnis: `ready_for_pedi_review: yes`, aber `conditional_ready_for_beta: no`.** Kein neuer Kern-P0.
  Blockiert: volle RC-genaue Laufzeit-Smoke.

## 4. Entscheidungen & Änderungen
_(rekonstruiert aus Commits + `docs/DECISIONS.md`: OQ-001…111 offen, bestätigt nur D-001…D-004)_
- D-001…D-004 (KREL-1): Trennung von Team 1–4; Zuständigkeit Release Ops/Beta QA; keine Deployments/DNS ohne Pedi;
  kein Produktbau.
- **Smoke-Modus-Wechsel (KREL-32→33):** zuerst `review_based` (Doku/read-only), dann `local_runtime` mit Fallback
  (praktischer Beta-Nutzen unter Zeitdruck).
- **Verworfen — lokaler Vite-Devserver (KREL-33):** blockiert, weil Vite ins Team-1-Repo schreiben wollte
  (`apps/web/vite.config.ts.timestamp-…mjs`); bewusst nicht eskaliert (keine Team-1-Dateiänderung).
- **Verworfen — automatisierter `npm run smoke:browser` / Playwright (KREL-33):** Playwright nicht installiert;
  keine Installation im Team-1-Repo. Stattdessen In-App-Browser-Smoke gegen `localhost:3001`.
- **Verworfen — Live-Modell im Smoke:** ausgeschlossen; Ask deterministisch („Reasoner offline").
- **KWEB-Anfragen abgelehnt:** KWEB-51/52/54 (Team 4) an Team 5 gerichtet → als Scope-fremd zurückgewiesen.

## 5. Offene Punkte & Abhängigkeiten
- **Team 1:** RC-genauer, reproduzierbarer Frontend-Startweg ohne Team-1-Dateiänderung (OQ-109/110); Kernpfad-
  Definition, CI-Re-Run.
- **Pedi:** Smoke-Modus lokal vs. review, Demo-Seed/Test-User, Browserumfang, Live-Modell-Modus, Abnahmekriterien
  (OQ-105…108, 111); Final Go/No-Go.
- **Team 3:** Beta-/Staging-Umgebung, Datenabgrenzung, Backup/Restore.
- **Team 6:** Austausch über `docs/TEAM6_UPDATE.md`; erwartete Team6-Quellen fehlen (GAP-T6-01, als Gap dokumentiert).

## 6. Risiken, Fallstricke & bekannte Widersprüche
- **P1-Gates offen:** RC-genaue FE-Runtime nicht nachweisbar; automatisierter Browser-Smoke blockiert; Pen-Test
  (AG-07), Restore/DR (AG-09), Load/Scale (AG-03), Live-Modell-Eval (AG-04), Legal/Privacy/DPA (AG-08),
  UX-Abnahme (AG-12)/Story (AG-13).
- **P2:** Review/Rework braucht getrennte Test-Rollen (Autor ≠ Reviewer) — mit gleichem Admin nicht belastbar.
- **⚠️ Doku-Diskrepanz:** CI-Grün des RC ist nur Team-1-Handoff-Aussage (Codex-Review), von Team 5 **nicht
  re-verifiziert** (kein Serverzugriff). → deckt sich mit Team-1-Unsicherheit (bestätigt offene Frage).
- **Tooling-Fallstrick:** wiederkehrend `.git/index.lock: Operation not permitted` bei read-only Bash (nur
  Git-Schreibzugriff betroffen).
- **Datum leicht unsicher:** Umgebungsdatum teils 2026-06-30, Handoff/Dateien 2026-07-01.

## 7. Übergabewissen + Referenzen
- Einstieg: `docs/BETA_DOCUMENTATION_INDEX_MODEL_V0.md`, `docs/DECISIONS.md` (OQ-001…111, D-001…004),
  `docs/TEAM5_CHARTER.md`, `docs/CLAUDE_TEAM5_INSTRUCTIONS.md`.
- RC-Kern-Docs: `BETA_RC_INTAKE_SMOKE_TEST_EXECUTION_PACK_V0.md`, `BETA_RC_READINESS_CONTROL_PACK_V0.md`,
  `BETA_RC_HANDOFF_INTAKE_RESULT_V0.md`, `BETA_RC_SMOKE_TEST_EXECUTION_RESULT_V0.md`,
  `BETA_RC_LOCAL_RUNTIME_SMOKE_EXECUTION_RESULT_V0.md`, `BETA_RC_READINESS_DECISION_RECOMMENDATION_V0.md`,
  `BETA_RC_READY_FOR_PEDI_REVIEW_SUMMARY_V0.md`, `BETA_RC_RUNTIME_SMOKE_FINDINGS_LOG_V0.md`.
- Jira (KREL): KREL-1…33; zuletzt KREL-32 (commit `36eef63`), KREL-33 (commit `7e85733`). Team-1-Bezug:
  SCRUM-376/377/378.
- GitHub: `Klarwerkai/klarwerk-release-ops`, HEAD `7e85733`. Team-1-RC read-only: `1e662e9` (RC-Kandidat),
  `c0863c6` (Handoff-Pack).
- Nächster Schritt: nach Pedi-Klärung OQ-105…111 den Slice „Beta RC Smoke Test Execution (Laufzeit, RC-genau)"
  mit Team-1-RC-Startweg.
- **Audit-Snapshot (2026-07-01):** `/Users/peterkohnert/Documents/KLARWERK_AUDIT_EXPORTS/2026-07-01/TEAM-05_RELEASE_OPS_QA/`
  → Hinweis: es gibt offenbar einen zentralen Audit-Export-Ordner für alle Teams (prüfen!).
