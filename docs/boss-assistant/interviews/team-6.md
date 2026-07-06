# Interview — Team 6

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Team 6 (unverifiziert, wo markiert)._

## 1. Rolle & Domäne
- **Team 6 = KLARWERK Wissens-Guru / Pflichtenheft & Product Gap Control.** Unabhängige, **read-only Zweitprüf-
  instanz**. Domäne: Produkt-Gap-Kontrolle & Pflichtenheft-Abgleich.
- Gleicht Produkt-Commits von Team 1 (`SCRUM-xxx`) gegen den Team-6-Gap-Bestand ab, klassifiziert Lücken (P0/P1/P2),
  hält belegbaren Ist-Stand fest. **Implementiert nichts, entscheidet nichts für Pedi.**
- **Repo: `klarwerk-knowledge-guru/`** (schreibt nur hier; Git/Jira via Codex, Vier-Augen-Prinzip).

## 2. Aufgaben & Verantwortung
- Pro Slice (`KGURU-17`…`KGURU-30`): read-only-Verifikation gegen **fixe Commits** via `git show <commit>:<path>`
  (nie Working Tree als Fakt, nie checkout), ein Haupt-Review-Doc je Slice + Pflege lebender Register.
- Kern-Dateien in `klarwerk-knowledge-guru/docs/`:
  - Lebende Steuerung: `TEAM6_ACTIVE_GAPS_AND_RECOMMENDATIONS.md`, `TEAM6_CURRENT_TOP_REQUIREMENTS.md`,
    `REQUIREMENT_REGISTER_V0.md`, `FEATURE_GAP_MATRIX_V0.md`, `BETA_READINESS_CONTROL_V0.md`,
    `TEAM6_STATUSBOARD_V0.md`, `DECISIONS.md` (bis `D-043`).
  - Master-Scope: `MASTER_SCOPE_CHECKLIST_V0.md` + `data/master-scope-checklist.json` (**90 Items, Teams 1–7**).
  - Navigation: `TEAM6_KNOWLEDGE_POOL_INDEX.md`, `TEAM6_KNOWLEDGE_MAP_AND_ALIAS_GUIDE_V0.md`, `TEAM6_TEAM_HANDOFF_BRIEF.md`.
- Marker-Disziplin: `[FAKT]/[ANNAHME]/[GAP]/[EMPFEHLUNG]/[OFFENE FRAGE]/[KANDIDAT]/[ZU VERIFIZIEREN]/[ABGRENZUNG]`.
- Statusgrammatik: **„geschlossen mit Prüfvorbehalt (EK-09)"** (Code+Test-Beleg) vs. **„reduziert"** (nur Copy/
  Guidance, technische Garantie fehlt). Nie Gap-Schließung ohne Commit+Code/Test-Evidenz.

## 3. Aktueller Stand
- Laufend (kein Endzustand); Register läuft mit Team 1 mit. Zuletzt: **`KGURU-30`** (SCRUM-375 Full Reconciliation
  gegen fixen Commit `42c24b8`). Ergebnis: „Capture optionale Felder per Progressive Disclosure" geschlossen m.
  Prüfvorbehalt; **AG-12 gesamt bleibt P1 offen**; `T1-UX-003` = `partially_done`.
- Gap-Stand (verbindlich in Dateien): geschlossen m. Prüfvorbehalt u.a. AG-01, AG-02, AG-04 (repo-lokales Eval),
  AG-05 (Trust-Formel), AG-06, AG-10/11/06-RESET, AG-14, AG-15. **Weiter P1 offen:** AG-03-DBINDEX-LOADTEST,
  AG-04-LIVE-MODEL-EVAL, AG-07 (Pen-Test), AG-09 (Restore-Test), AG-12/AG-13 (UX/Story-Hoheit).
  Blockiert/pausiert: Team-2-Themen (Team 2 pausiert).

## 4. Entscheidungen & verworfene Ansätze
- **Fixe-Commit-Doktrin (SNAP-01, `1a4e18d…`):** frühe Prüfungen drohten dirty Working Tree als Fakt zu werten →
  verworfen zugunsten strikt `git show <commit>`. Befunde tragen Snapshot-Vorbehalt **EK-09**.
- **„geschlossen" vs. „reduziert":** Versuchung, UX-Copy als Gap-Schließung zu werten → verworfen (seit `KGURU-24`):
  kein geschlossener Gap wird wegen UX-Copy überschrieben, wenn techn. Evidenz fehlt. Bsp. `AG-04`: durch SCRUM-366
  nur **reduziert**, nicht geschlossen (Eval-Nachweis SCRUM-368 lag außerhalb).
- **Uncommitted ≠ fertig:** `KGURU-29` SCRUM-375 nur Working-Tree-Kandidat → `[KANDIDAT]`, erst `KGURU-30` gegen
  `42c24b8` in belegten Stand überführt. Analog SCRUM-368 (`KGURU-26`).
- **Doc-Hygiene statt Umbenennen (`KGURU-21`):** „Dateien umbenennen" verworfen (bräche Querverweise) →
  `KNOWLEDGE_MAP_AND_ALIAS_GUIDE` als Mapping.
- **Generator-Fixes (`KGURU-23`):** Python-Generator neu (Quote-Kollision); Skripte in `outputs/` statt `/tmp`.
- Entscheidungshistorie vollständig in `DECISIONS.md` (`D-001`…`D-043`), inkl. Pedi-Entscheidungskandidaten `EK-xx`.

## 5. Offene Punkte & Abhängigkeiten
- **Team 1:** liefert zu prüfende `SCRUM-xxx`-Commits; HEAD bewegt sich (bei KGURU-30-Abschluss HEAD schon `6fa98e7`/
  SCRUM-376, geprüft strikt `42c24b8`). Offen: durchgängiger UX-Weg (Studio als echter Default), Snapshot (EK-09).
- **Team 5 (Usability/RC):** EK-20 — Usability-Smoke des vereinfachten Capture nötig, damit AG-12 fallen kann.
  Team-5-Meldung `GAP-T6-01` (Findbarkeit) via Alias-Guide adressiert.
- **Team 4 (Story-Hoheit):** EK-21 / AG-13.
- **Team 7 (Intake):** Review-Queue-Intake (`KGURU-25`); out-of-band UX-Kritik → `TEAM7_INTAKE_UX_REDESIGN_SPEC_V0.md`.
- **Codex:** einziger, der Team-6-Repo committet/pusht. **Pedi:** alle `EK-xx` (EK-09 Snapshot, EK-20 Usability-Gate,
  EK-22 Trust-Formel, EK-23 validiert-only, EK-26 Assignment-Akzeptanz).

## 6. Risiken, Fallstricke & bekannte Widersprüche
- **Snapshot-Drift:** „geschlossen" gilt nur für geprüften Commit; spätere Team-1-Commits können regredieren (EK-09).
- **„reduziert"↔„geschlossen"-Verwechslung:** wird leicht als „fertig" fehlgelesen (bes. AG-04, AG-12, AG-P2-2).
- **AG-02-SESSION-ATOMIC:** Recovery/Ehrlichkeit umgesetzt, aber Server-Cleanup/Backend-Atomicity offen
  (`AG-02-SESSION-ORPHAN` P2) — nicht als „vollständig geschlossen" lesen.
- **Findbarkeit/Alias:** erwartete Namen (`KLARWERK_PFLICHTENHEFT_V0.md`, `PRODUCT_REQUIREMENTS_REGISTER_V0.md`)
  existieren nicht unter dem Namen → Alias-Guide prüfen, bevor „Datei fehlt".
- **Doku vs. Jira:** Working-Tree-Selbstangaben (z.B. `docs/TEAM6_UPDATE.md` im dev-Repo) gelten nur als Eigenangabe,
  nicht als Beleg. → deckt sich mit meinem teamübergreifenden Snapshot-Drift-Befund.
- **Tests nur gelesen, nie ausgeführt** → keine Laufzeit-/CI-Evidenz (bewusste Grenze).

## 7. Übergabewissen + Referenzen
- Einstieg: `TEAM6_TEAM_HANDOFF_BRIEF.md` → `TEAM6_KNOWLEDGE_POOL_INDEX.md` → `TEAM6_ACTIVE_GAPS_AND_RECOMMENDATIONS.md`
  + `TEAM6_CURRENT_TOP_REQUIREMENTS.md` → `DECISIONS.md` (D-/EK-) → `MASTER_SCOPE_CHECKLIST_V0.md` (+JSON). Alias-Guide
  gegen Namensverwirrung.
- Arbeitsweise: TaskCreate → read-only `git show <fixer commit>` → Haupt-Review-Doc → Register-Updates → JSON-Patch
  (MD aus JSON regenerieren) → Verifikation (JSON valide, Item-Count, Marker, 0 Secrets, fremde Repos unberührt) →
  Abschlussbericht. Nie Gap ohne Commit+Test schließen; Uncommittetes als `[KANDIDAT]`.
- Jira (KGURU): `KGURU-17`…`KGURU-30`; geprüfte Team-1-Tickets `SCRUM-359..376`; letzte GitHub-Referenz `42c24b8`
  (SCRUM-375: `apps/web/src/pages/Capture.tsx`, `apps/web/src/lib/captureAdvancedFields.ts`, `apps/web/src/i18n.ts`,
  `tests/app/capture-advanced-fields.test.ts`).
- **Unsicher/zeitabhängig:** exakte Commit-SHAs + Gap-Kurzstatus laufen zwischen Slices nach → verbindlich ist immer
  die verlinkte Datei, nicht die Zusammenfassung. Ob EK-20 hartes Beta-Gate ist: offen (Pedi/Team 5).
