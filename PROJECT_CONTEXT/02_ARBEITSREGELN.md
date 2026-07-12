# Arbeitsregeln (verbindlich)

> Ergänzt `CLAUDE.md` (Harness-Regelwerk im Repo-Root) — bei Widerspruch gilt CLAUDE.md.

## Qualitäts-Gates — nur grün ist lieferbar

1. `tools/check` = Build (tsc) · Lint (Biome) · Architektur (dependency-cruiser, nur `services`) · Tests (Vitest).
2. `npm run smoke:ui` = 4 Playwright-Kernfluss-Tests gegen das gebaute `apps/web/dist`.
3. Jede sichtbare UI-Änderung: **APP_VERSION bumpen** (`apps/web/src/version.ts`) + `vite build`
   in `apps/web` + neues dist einchecken. Pedi verifiziert die Version oben rechts in der App.
4. Akzeptanzkriterien als Tests; keine TODOs im gemergten Code; keine ungetesteten Endpunkte
   (Guard-Matrix `tests/security/routeGuardAudit.ts` pflegen!); Dev-Persist: neue mutierende
   Repo-Methoden in `MUTATING_METHODS` eintragen.

## Git & Sync

- **Lokal committen, dann STOPP — KEIN push.** Gepusht wird ausschließlich über die
  **„KLARWERK Sync"-App durch Pedi** (synct alle 6 Repos auf GitHub + Gitea).
- Aussagekräftige Commit-Messages mit Ticket-Nummer; Commit-Hashes sind die Wahrheit
  (Jira-Nummern wurden schon mal verdreht — im Zweifel gilt der Commit).

## Dokumentation — nach JEDER erledigten Aufgabe

1. **After-Report** anhängen: `docs/qm/claude-after-report.md` (Was/Warum/Beweis/Offen).
2. **Jira nachführen**: Ticket-Status (fertig = In Review, bis Pedi abnimmt) + Ergebnis-Kommentar.
3. Bei größeren Wendepunkten: `docs/qm/BOSS_SESSION_STAND_*.md` und `PROJECT_CONTEXT/04_AKTUELLER_STAND.md` fortschreiben.
4. PMO-Items über `scripts/apply-item-update.mjs` (Feld heißt `fields_to_update`!); Guru-Register (Team 6) bei Scope-Änderungen.

## Dauerregeln aus Vorfällen (teuer gelernt)

- **Schreibtisch-Kopien:** Pedi startet ALLE Apps über `~/Desktop/KLARWERK *.app`. Jede Änderung
  an einem Starter MUSS sofort in die Schreibtisch-Kopie gespiegelt werden (diff prüfen, +x erhalten).
  Master-Kopien: App-Starter im Repo `desktop-app/`, Sync in `Documents/Klarwerk/tools-sync/`,
  LLM in `Documents/Klarwerk/klarwerk-local-llm/scripts/`.
- **macOS TCC:** Script-Apps bekommen oft keinen Documents-Zugriff → Muster: `.command`-Datei
  (Terminal hat Zugriff) + dünne `.app`-Hülle, die sie per `open -a Terminal` öffnet.
- **Preise IMMER im Anbieter-Konfigurator verifizieren** (Pressemitteilung ≠ Konfigurator).
- **Keine langen Hintergrundprozesse in der Claude-Sandbox** — jeder Bash-Aufruf ist unabhängig, max. 45 s.

## Sicherheit (Stop-Lines, nicht verhandelbar)

- Keys NUR im macOS-Schlüsselbund: `Klarwerk`/`ANTHROPIC_API_KEY` (Legacy-Fallback
  `KLARWERK-App-Anthropic`/team1), `KLARWERK-PMO-Anthropic`/team1,
  `KLARWERK-UpCloud-API`/team2. Keine Secrets in Code, Repos, Tickets, Chats.
- LLM-API niemals öffentlich (nur SSH-Tunnel localhost); private SSH-Keys nie in Git
  (liegen unter `Documents/Klarwerk/llm-eval-zugang/`).
- Keine Kundendaten in Evals/Tests. Käufe/Mieten/Zahlungen/Mails nach außen: **nur Pedi**.

## Mehrere Mitarbeiter (ab 03.07.)

1. **Ticket zuerst:** Gearbeitet wird nur an Jira-Tickets; vor Arbeitsbeginn Ticket auf sich
   ziehen (Assignee/Kommentar) — verhindert Doppelarbeit.
2. **Sync vor Arbeitsbeginn:** Erst „KLARWERK Sync" laufen lassen (holt/pusht Stände), dann arbeiten.
   Nie parallel im selben Repo an denselben Dateien; im Zweifel kurz in Jira abstimmen.
3. **Gleiche Regeln für alle Sessions:** Gates, After-Report, kein Push, Ehrlichkeit.
4. **Eine Boss-Session koordiniert** (vergibt/schneidet Tickets); die zweite Person arbeitet
   ticketbezogen. Wer Boss ist, steht in `04_AKTUELLER_STAND.md`.
5. **Übergaben schriftlich:** alles Wichtige in After-Report/Jira — nie nur im Chat.

### Cloud-Sessions (z. B. [Cloud-Worker], entschieden 03.07.)

- Kennung **[Cloud-Worker]** an allen Jira-Kommentaren/Dateien; es arbeitet immer nur EINE
  Session an der App (Ticket-Zuweisung = Sperre).
- **Commit-Weg (a):** Cloud-Session schreibt gate-grüne Arbeit als Dateien nach `dev_Klarwerk`
  zurück + Jira-Kommentar; die Boss-Session prüft und committet lokal mit Kennung; Push wie
  immer nur über KLARWERK Sync. Kein GitHub-Zugang, keine Secrets in der Cloud.
- Mac-gebundene Schritte (Schreibtisch-Spiegeln, +x, Schlüsselbund, localhost, Prüfstand-Läufe)
  übernimmt die Boss-Session bzw. Pedi per Schreibtisch-App — die Cloud-Session plant, fixt,
  diagnostiziert und wertet aus.
- Datei-Brücke, solange nur `dev_Klarwerk` freigegeben ist: `docs/team2-austausch/` (s. LIESMICH dort).
- **Die Brücke kann keine Ausführungsrechte setzen** → Cloud-Sessions überschreiben NIE direkt
  Starter/App-Binaries; immer `.NEU` + Jira-Kommentar, Übernahme/+x/Spiegel/App-Hülle macht die
  Boss-Session. Pedi bedient ausschließlich .app-Doppelklicks (Details: 06_SCHREIBTISCH_APPS.md).
