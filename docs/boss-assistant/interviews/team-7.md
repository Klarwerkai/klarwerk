# Interview — Team 7

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Team 7 (unverifiziert, wo markiert)._

## 1. Rolle & Domäne
- **Team 7 = lokales Reporting-PMO für KLARWERK** — reine Lage-Transparenz für Pedi/PMO. Betreibt lokales
  Dashboard + lokale Projektwissensbasis. **Claude-only, ausschließlich lokal** in
  `/Users/peterkohnert/Documents/KLARWERK_Reporting_PMO`.
- **Kein Git, kein Jira, kein Deployment, kein Serverzugriff** (außer lokalem Testserver). Keine Produktentscheidungen,
  keine fremden Team-Dateien ändern.

## 2. Aufgaben & Verantwortung
- **Dashboard** (`index.html`, `app.js`, `styles.css`): Gesamtstatus, Readiness-Ampel, Fortschritt über Zeit,
  Team-Readiness, Meilensteine.
- **Status-Collection** (`scripts/collect-status.mjs`): liest **8 fremde Quellen read-only** → schreibt
  `data/current-status.json` + `data/progress-history.json` + Report unter `reports/`.
- **PMO-Wissensbasis** (`data/pmo-items.json` kanonisch; SQLite optional): Funktionen, Anforderungen, To-dos, UX,
  Gaps, Entscheidungen, Risiken, Meilensteine.
- **Master-Scope-Import** (`scripts/import-master-scope.mjs`): spiegelt Team-6-Checkliste read-only nach
  `data/master-scope-checklist.local.json`.
- Scope Explorer; **Intake** (Freitext → KI-Strukturierung → Entwurf → Übernahme mit Backup + Audit-Log);
  lokaler KI-Testserver (`start-local-ai-server.mjs`, Port 8000, `OPENAI_API_KEY` nur als Env-Var);
  **Team-6-Review-Queue** (`build-team6-review-queue.mjs` → `exports/team6/`).

## 3. Aktueller Stand
- **Fertig:** Dashboard inkl. UI/UX-Relaunch v1 (Design-Tokens, Hell/Dunkel, Leitscreen, Intake-Stepper),
  Status-Collection + Trend, Master-Scope-Ansicht, Wissensbasis (**107 Einträge, 106 aktiv, 1 archiviert**),
  Scope Explorer, Intake mit Duplikatprüfung/Edit/Soft-Archive, Backups + Audit-Log, Review-Queue-Export
  (**75 Items: P0=13, P1=41, P2=21**), KI-Intake mit Bestand-Abgleich.
- **In Arbeit:** tiefe Listen-Entdichtung Master Scope / Scope Explorer / Review (UI-Brief §5.2–5.5) — bisher nur
  farblich/Token, noch nicht strukturell.
- **Blockiert (extern):** KI-Livepfad hängt an gültigem OpenAI-Konto (zuletzt HTTP 429 = Guthaben/Rate-Limit);
  SQLite im Dateisystem nicht nutzbar (FUSE „disk I/O error") → JSON bleibt kanonisch.
- **📊 Zahlenstand (Snapshot 2026-07-01): Beta-Readiness ~45 % (Schätzung), 13 offene P0, Trend verschlechtert ▼.**

## 4. Entscheidungen & Änderungen (inkl. Verworfenem)
- **SQLite → JSON-Fallback:** SQLite scheiterte am Sandbox-Dateisystem → JSON (`pmo-items.json`) kanonisch, SQLite optional.
- **Trend-Diagramm-Zeitachse:** gleichmäßig → echte Datumsabstände gewünscht → schließlich Gesamtübersicht ohne Zeitproportion.
- **Gesamtprojekt-Übersicht** aus Hauptseite in eigenen Tab „Master Scope" ausgelagert (Übersichtlichkeit).
- **Intake-Redesign:** formular-first → Freitext-first; Copy/Paste-Zwischenschritt verworfen zugunsten 1-Klick
  „In die Einordnung übernehmen" (Copy/Paste nur Fallback ohne KI-Server).
- **KI-Auswertung:** erste zu dünne Strukturierung verworfen → serverseitiger Abgleich (Retrieval + Team→Bereich-
  Taxonomie) + strengerer Prompt. Vorschau auf reine KI-Analyse reduziert.
- **UI-Theme:** Blau-Akzent → KLARWERK-Orange + Hell/Dunkel.
- **Unsicher:** keine exakten Zeitstempel je Entscheidung; „wann" nur aus Slice-Reihenfolge.

## 5. Offene Punkte & Abhängigkeiten
- **Eingang (read-only, 8 Quellen):** Team-1 `dev_Klarwerk/docs/TEAM6_UPDATE.md`; Team-3/4/5 je `.../TEAM6_UPDATE.md`;
  Team-6 vier Docs; Master Scope aus `Klarwerk/klarwerk-knowledge-guru/data/master-scope-checklist.json`.
  Aktualität hängt an Frische dieser Quellen.
- **Ausgang:** Review-Queue-Empfehlung an Team 6 (Export). **Team 6 = Quelle der Wahrheit**, Reconciliation liegt dort.
- **Pedi:** Entscheidungen (Aufräumen, KI scharf schalten, UI-Folge-Slice) — wartet auf Signal.
- **Extern:** OpenAI-Konto (Guthaben) für KI-Livepfad.

## 6. Risiken, Fallstricke & bekannte Widersprüche
- **Prozentwerte sind Schätzungen, keine Messwerte** — überall als „Schätzung" markiert (Fehlinterpretationsgefahr).
- Quelldaten können veralten (asynchrone Team-Lieferung).
- **Mixups:** ein OpenAI-Key früher im Chat eingefügt → Rotation empfohlen (nie in Datei geschrieben); doppelter
  Ordner `docs/dashboard_brief_klarwerk 2`; funktionsloses `data/klarwerk-pmo.db-journal` (SQLite-Rest).
- Scheinbare Secret-Treffer (`sk-` in „Ask->Rescue"/„No secrets boundary") = Datentext, keine Keys.
- Widersprüche in fremder Doku/Jira **nicht beurteilbar** (außerhalb Bereich).

## 7. Übergabewissen + Referenzen
- Einstieg: `README.md`, `docs/TEAM7_CHARTER.md`, `docs/CLAUDE_TEAM7_INSTRUCTIONS.md`; Modelle `docs/*_V0.md`.
- Kernbefehle: `node scripts/collect-status.mjs` (Snapshot), `node scripts/import-master-scope.mjs`,
  `node scripts/build-team6-review-queue.mjs`. KI-Server: `export OPENAI_API_KEY=… && node scripts/start-local-ai-server.mjs`
  → `http://localhost:8000`.
- Datenorte: `data/pmo-items.json` (kanonisch), `data/current-status.json`, `data/progress-history.json`,
  `data/team6-review-queue.json`, `data/backups/`, `data/pmo-audit-log.json`, `exports/team6/`.
- Guardrails: nur lokal schreiben (`insideTeam7`/`assertInside`), keine fremden Repos, kein Key in Dateien/UI/Logs,
  keine echten Kundendaten. Nach jedem Slice: Test → Sicherheitscheck → Bericht → STOPP.
- **Audit (2026-07-01):** `/Users/peterkohnert/Documents/KLARWERK_AUDIT_EXPORTS/2026-07-01/TEAM-07_REPORTING_PMO_LOCAL/`
  (Response, Evidence-Index, Open-Questions).
- **Kein Jira/GitHub.** Kennungen wie `SCRUM-369`, `KGURU-14/27` erscheinen nur als read-only zitierte Herkunftsbelege
  in `data/pmo-items.json`, nicht als Team-7-Tickets.
