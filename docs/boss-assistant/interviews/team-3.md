# Interview — Team 3

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Team 3 (unverifiziert, wo markiert)._

## 1. Rolle & Domäne
- **Team 3 = Business Backend / Pilot Operations / Commercial Readiness** (belegt in `README.md`,
  `docs/DECISIONS.md` D-001/D-002).
- Bereitet Customer-/Tenant-/Rollen-/License-/Operations-/Support-Readiness für den ersten bezahlten
  Pilot / die erste Einzelkunden-Beta vor — **als Dokumentation/Blueprint, nicht Implementierung**.
- Arbeitsteilung: **Pedi** entscheidet materiell; **Codex** orchestriert Tickets (KBB-*), committet/pusht,
  verifiziert, setzt Jira; **Claude (Team 3)** = reiner **Markdown-Executor**, kein Git/Jira/Deploy/Serverzugriff.

## 2. Aufgaben & Verantwortung
- **Repo: `/Users/peterkohnert/Documents/Klarwerk/klarwerk-business-backend`** (⚠️ anderes Repo als Team 1!),
  Remote `git@github.com:Klarwerkai/klarwerk-business-backend.git`, Branch `main`. Nur `README.md` + `docs/`
  (~160 Markdown-Dateien), keine Code-Implementierung.
- Zentral: `docs/DECISIONS.md` (append-only), `docs/TEAM3_V0_DOCUMENTATION_INDEX.md` (Index),
  `docs/TEAM6_UPDATE.md` (Cross-Team-Update an Team 6).
- Dokumentgruppen: `PILOT_*`/`FIRST_PAID*` (Pilot-Readiness), `BETA_*` (~87 Dateien), `*GONOGO*` (~10).
- Markerbasiert: `EMPTY`, `NO-REAL-DATA`, `MARKER_ONLY`, `SYNTHETIC_ONLY`, `CUST-BETA-0001`, `TEN-BETA-0001`,
  `PEDI-DECISION-PENDING`, `EXTERNAL-INPUT-MARKER`, `TEAM1-READINESS-MARKER`, `customer-role@example.invalid`.
  Keine echten Kunden-/Kontaktdaten, keine Secrets, keine Modellartefakte.

## 3. Aktueller Stand
- **Fertig (Blueprint):** gesamte manuelle Einzelkunden-Beta-Kette bis Go/No-Go-Vorbereitung:
  KBB-103 (Invitation/Scheduling/Attempt-Log), KBB-104 (Human Send Authorization/Handoff/Log),
  KBB-105 (First-Contact Execution + Evidence), KBB-106 (Decision Intake + Handoff + Codex-Action-Gate),
  KBB-107 (Operator Review + Decision Session + Routing), KBB-108 (Go/No-Go Evidence Binder + Checklist),
  KBB-109 (Decision Session Runbook + Capture + Routing), KBB-110 (synthetischer Dry Run), KBB-111 (Dry-Run-Result).
- **Zuletzt beobachtet:** `TEAM6_UPDATE.md`-Snapshot: Active KBB-111 / last completed KBB-110 /
  last commit `58acb09`; gemounteter HEAD `0ce55bf`. Momentaufnahme (Codex committet laufend).
  Unsicher: ob `58acb09` gepusht war.
- **Blockiert/nicht freigegeben:** finaler Go/No-Go, echter Beta-/Pilotstart, echter Kundenkontakt, SLA,
  DPA/Datenschutz, API/DB/UI — alles offen, nicht durch Team 3 entscheidbar.

## 4. Entscheidungen & Änderungen
Formal im append-only Log (`docs/DECISIONS.md`):
- D-001 Team-3-Trennung von Team 1/2 · D-002 Team-3-Scope · D-003 Hybridmodell (`klarwerk.ai` Marketing,
  `app.klarwerk.ai` Produkt, `ops.klarwerk.ai` Ops-Control-Plane) · D-004 separater Hetzner-Server für
  `ops.klarwerk.ai` · D-008 Beta nur conditional · D-009 explorativer Kundenkontakt erlaubt (in Grenzen) ·
  D-012 Team 2 / Local LLM nicht beta-blockierend.
- **Richtungswechsel:** Fokus von „First Paid Pilot" (`FIRST_PAID*`/`PILOT_*`) → **Einzelkunden-Beta** als
  sicherer manueller Pfad; Mehrkunden-/Mandantenfähigkeit bewusst **P1 / out of scope**.
- **Konsolidierung 2026-07-02:** mehrere KBB-110-Dry-Run-Dateien mit Header „STATUS: ÜBERHOLT — gültig ist
  `docs/BETA_GONOGO_DECISION_SESSION_RUNBOOK_V0.md`" (betroffen `..._DRY_RUN_RUNBOOK_V0`, `..._OBSERVATION_LOG_V0`,
  `..._GAP_FIX_QUEUE_V0`). Dry-Run-Dokumente zugunsten des kanonischen Session-Runbooks konsolidiert.

## 5. Offene Punkte & Abhängigkeiten
- **D-010** (Legal/Retention/DPA) — offen, externer Input (Legal).
- **D-011** (Commercial/Billing) — offen, externer Input (Commercial).
- **Team-1-Readiness** (Tenant-/Lizenz-Metadaten) — offen, Abstimmung vor echtem Start nötig.
- **Team 2** — nur Schnittstelle: Local LLM optional/nicht blockierend (D-012).
- **Team 6** — `TEAM6_UPDATE.md` = Read-only-Update; „Team6 review needed = yes"; Team-6-Pfade nicht direkt lesbar.
- **Pedi** — finaler Go/No-Go, SLA-Rahmen, benannter menschlicher Sender für ersten echten Kontakt.

## 6. Risiken, Fallstricke & bekannte Widersprüche
- **⚠️ Doku-Widerspruch:** D-010/D-011 werden durchgängig in Beta-Docs referenziert („offen/external input"),
  fehlen aber als Einträge in `docs/DECISIONS.md` (grep = 0 Treffer). Auch **D-005/D-006/D-007 fehlen** →
  Nummerierungslücke. Empfehlung: als offene Einträge nachtragen (nur Pedi/Codex).
- **Überholt-Risiko:** überholte Dry-Run-Dokumente existieren parallel zum gültigen Runbook (Header gesetzt,
  aber Leser könnte alte Datei ziehen).
- **Snapshot-Drift:** `TEAM6_UPDATE.md` (commit `58acb09`) lief HEAD (`0ce55bf`) voraus.
- **Prozessrisiko:** Evidence/Intake/Review/Routing/Capture dürfen nie echte Entscheidung/Ausführung werden;
  Capture-Felder leer; Dry Run ≠ echte Go/No-Go.
- **Behoben:** früher sichtbare Tool-/MCP-Syntax in Antworten.
- **P0-Dauergrenzen:** keine echten Kundendaten, keine Secrets, keine API/DB/UI/Deploy, kein Start ohne Pedi.

## 7. Übergabewissen + Referenzen
- Repo/Remote/Branch: `klarwerk-business-backend` @ `github.com/Klarwerkai`, `main`.
- Einstieg in Reihenfolge: `README.md` → `docs/DECISIONS.md` → `docs/TEAM3_V0_DOCUMENTATION_INDEX.md` →
  `docs/TEAM6_UPDATE.md`.
- Gültiger Go/No-Go-Kanon: `docs/BETA_GONOGO_DECISION_SESSION_RUNBOOK_V0.md` (Dry-Run-Trilogie überholt).
- Jira (KBB): KBB-103…111 (siehe oben); ältere Serien KBB-1..~69 (Grundgerüst, Pilot/First-Paid, Beta-Fit).
- Arbeitsweise: ticket-getrieben; Precheck → Doku → `TEAM6_UPDATE.md`/Index → read-only+Sicherheitscheck →
  Bericht; Codex ersetzt `COMMIT_PENDING` durch echten Hash.
- Sicherheitsstand: sauber (keine `.env/.pem/.key/*secret*/*token*`, keine Modellartefakte, nur `.invalid`-Domains).
- To-dos für Pedi/Codex: D-010/D-011 (+ D-005–007) formal ins Log; überholte Dry-Run-Dateien archivieren;
  Snapshot mit echtem HEAD synchronisieren.
