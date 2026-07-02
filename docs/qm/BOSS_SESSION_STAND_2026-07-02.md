# Boss-Session-Stand — 02.07.2026 (Übergabe-Dokument, Quelle der Wahrheit für die Fortsetzung)

> Zweck: Der komplette Faden der Koordinations-Session vom 02.07. Jede neue Session
> (Boss ODER Ausführung) liest ZUERST dieses Dokument + docs/qm/claude-after-report.md
> (chronologische Detail-Evidenz). Ziel-Nordstern: **Beta raus.**

## 1. Versionsstände (alle lokal committet, NICHT gepusht — Push nur Pedi via „KLARWERK Sync")

| Komponente | Version | Letzter Commit | Zustand |
|---|---|---|---|
| KLARWERK App (dev_Klarwerk) | **v0.9.16-beta** | 12b1cfd | Gates grün: 1275 Tests / 209 Dateien · UI-Smoke 4/4 · dist eingespielt |
| Reporting-PMO (Team 7, ohne Git) | v1.3.0 | — | Item-Quoten hart, Auto-Refresh >6h, Frische-Ampel, 1-Klick-Intake, KI via Anthropic |
| Ops-Cockpit (Team 3) | v0.2.0 | 25dbe92 | Überblick/Server-Reife SR-1..3, D-010/D-011-Tracker, Statusbericht |
| Website (Team 4) | 1.0.0 | a909818 (+542c5a7 App-Fix) | Professionen-Sektion neu; Deploy durch Pedi ausstehend |
| Business-Backend Repo | — | b286657/3db9d43 | Ops v0.2.0 + Starter-Fixes |

**dev_Klarwerk ist ~350 Commits ahead** — WICHTIGSTE offene Pedi-Aktion: KLARWERK Sync.

## 2. Heute geliefert (Kurzliste; Details im After-Report, gleicher Tag)

Weiße-Seite-Ursache (Server hielt alte Asset-Liste) + Stand-Erkennung in ALLEN Desktop-Startern ·
Versions-/Start-Bestätigung als selbstschließender Dialog in allen 5 Apps · SCRUM-384 Runden 2–5
(Wizard, ARGUS-Wissensseite, ✨KI-Toggle-Palette, Verwerfen, Upload beim Erzählen, Diktat-Knopf) ·
Aufräum-Pass Start/Erfassen · SCRUM-381 Playwright-Smoke (npm run smoke:ui, 4 Tests) · SCRUM-388
Anlagen-Kopplung · SCRUM-389 KI-Verwaltung v1 (+Feinabstimmung eingeklappt) · Demodaten:
robuster demoSeed-Merker + Komplett-Purge im Admin · KO-Löschen für Autor/Controller/Admin ·
App-Funktions-Audit (docs/qm/APP_FUNKTIONS_AUDIT_2026-07-02.md) · PMO: Anthropic-Support,
Key-Test-Knopf, 1-Klick-Übernahme in den Bestand, Fortschritt gehärtet · Ops-Cockpit v0.2.0 ·
Website-Professionen (KWEB-105) · PMO-FEA-0007 (In-Place-Übersetzung) empfangen → Team-6-Queue.

**Nachtrag (Boss-Session-Fortsetzung, 02.07. abends):** PMO-FEA-0006 kam als **SCRUM-390 / v0.9.13** an
(anderer Chat). Danach direkt in dieser Session geliefert: **SCRUM-396** Validierungs-Board-Redesign
(v0.9.14, c0876dc) · **SCRUM-397** Audit-P3 Glocke mit Gelesen-Status (v0.9.15, 65928b5) ·
**SCRUM-398** Audit-P4 Live-Wall-Start-Karte (v0.9.16, 12b1cfd) — alle In Review (Sichtabnahme Pedi).
Jira-Nachträge aus §5 erledigt: Kommentar SCRUM-389 + Tickets SCRUM-391…395 angelegt.
PMO-Stand: **125** (neu: PMO-REQ-0005 „KI-Provider-Management", Empfang bestätigt; deckt sich mit
SCRUM-393/KI-Voll-Ausbau). Audit-Punkte 1–4 damit KOMPLETT.

## 3. Beta-Fahrplan (vereinbart) — Stand der Schritte

1. **Pedi: KLARWERK Sync** (offen!) → 2. **Pedi: Sichtabnahme v0.9.12** → sagt „passt, RC
   einfrieren" → Boss-Session setzt **1.0.0-beta.1** + Tag, danach nur Fixes.
3. **KREL-34 Team-5-Re-Smoke** (Prompt schreibt die Boss-Session NACH dem Freeze; muss
   npm run smoke:ui einschließen). 4. **Deploy klarwerk.ai** via Coolify (hinter Basic-Auth;
   einmal Migrations-/Backup-Drill Postgres). 5. **Tester-Beta**: Konten, Zugänge, Feedback-Kanal;
   davor Glocke (P3) + Live-Wall (P4). **Pilot-Beta** hängt extern an **D-010**: Kanzlei-Briefing
   liegt VERSANDFERTIG in klarwerk-business-backend/docs/D010_LEGAL_BRIEFING_FUER_KANZLEI_V1.md —
   Pedi muss es nur senden. EK-19-Vorlage entsteht im Team-6-Slice.

## 4. Fertige Ausführungs-Prompts (liegen in der Chat-Historie; Kern hier rekonstruierbar)

- **PMO-FEA-0006 „Wissen aus Datei extrahieren"** (zuletzt geliefert): neuer Reasoner-Task
  "extract" (nur Dokumentinhalt, nie erfinden; ehrlicher Kein-Modell-Fallback), 4. Erzähl-Modus
  „Aus Datei" mit KI-Punkteliste (Checkboxen) ODER Experten-Suchauftrag, je Punkt ein
  Wizard-Entwurf; Guard-Matrix, Tests, v0.9.13-beta. VORAUSSETZUNG: gültiger Anthropic-Key!
- **Audit-P3 „Glocke mit Gelesen-Status"**: /api/notifications/seen, unseenCount, bewusstes
  Als-gesehen beim Panel-Öffnen; Guard-Matrix; Version nach FEA-0006 weiterzählen.
- **Team-6 Review-Slice** (klarwerk-knowledge-guru): Arbeitsbrief
  docs/KGURU_REVIEW_SLICE_ARBEITSBRIEF_2026-07-02.md + Aktualisierung: 17 Einträge inkl.
  PMO-FEA-0007; erledigt einstufen: PMO-FEA-0005/PMO-UX-0001(384)/PMO-REQ-0001(KBB-112).
- Danach: **Audit-P4 Live-Wall**, KREL-34 (nach Freeze).

## 5. Jira-Nachträge (MCP war zeitweise nicht erreichbar — als Erstes nachholen)

1. Kommentar SCRUM-389: Nachbesserung f6613d1 (Feinabstimmung eingeklappt, v0.9.9).
2. Neue Tickets: Demodaten-Purge (3906e74, v0.9.11) · KO-Löschen Autor/Admin (729121d,
   v0.9.12) · T1 „Verhörer-Interview + Prompt-Verwaltung im Admin (KI-unterstützt) + Interview
   Text&Sprache" · T2 „Admin-Unterteilung: Konten · KI · Daten" · T3 „Prüfer-Zuweisung beim
   Einreichen + Standard-Prüferanzahl (Admin-Default)". Alle mit Verweis auf After-Report 02.07.

## 6. Offene Pedi-Aktionen (gesammelt)

KLARWERK Sync (dringend) · **Anthropic-Key erneuern** (Schlüsselbund „KLARWERK-App-Anthropic"
ist ungültig → Interview/Extraktion/Reasoner laufen nur deterministisch; im PMO funktioniert der
NEUE Key bereits via „KLARWERK-PMO-Anthropic") · Sichtabnahme v0.9.12 → „RC einfrieren" ·
D-010-Mail an Kanzlei · Ops-Cockpit ansehen → SR-1 abhaken · EK-19 ankreuzen (nach Team-6-Slice) ·
Guru-Repo: untrackter Ordner website-uiux/ — committen oder klären.

## 7. Arbeitsregeln (unverändert gültig)

Boss-Session koordiniert, neue Chats führen aus (exakte Copy-Paste-Prompts, IMMER mit „Wenn
fertig sofort lokal committen, dann STOPP — kein Push"). Pedi: keine Terminaleingaben; Keys nur
Schlüsselbund; jede UI-Änderung bumpt APP_VERSION (Header-Chip + Start-Dialog = Beweis).
PMO-Intake = Pedis Ideen-Kanal; Boss-Session prüft pmo-items.json AUTOMATISCH bei jedem Schritt
(Stand: 124 Einträge) und bestätigt Empfang. Gates: tools/check komplett + smoke:ui vor Lieferung;
Bauen/Testen in /tmp-Kopie (FUSE langsam; /tmp kann RECYCELT werden — neu aufbauen). After-Report
nach jeder Aufgabe anhängen. Ehrlichkeit vor Optik: keine stillen Fallbacks, keine Fake-Werte.

## 8. Faden-Ritual für neue Sessions

Neue Boss-Session: „Lies dev_Klarwerk/docs/qm/BOSS_SESSION_STAND_2026-07-02.md (bzw. den
neuesten BOSS_SESSION_STAND) + die letzten After-Report-Einträge und übernimm die Koordination."
Dieses Dokument bei JEDEM größeren Meilenstein fortschreiben oder durch ein neues ersetzen.
