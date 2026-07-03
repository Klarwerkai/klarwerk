# Jira & GitHub — was du dir als Erstes ansiehst

> Ziel: In ~1 Stunde das Projekt verstehen. Reihenfolge einhalten — sie baut aufeinander auf.
> Zugänge (Jira-Einladung, GitHub-Zugriff) bekommst du persönlich von Pedi.

## Jira — `https://klarwerk.atlassian.net`

Jira ist die **Auftrags-Wahrheit**: Woran wird gearbeitet, was ist fertig, was wartet auf Abnahme.
Statusfluss: To Do → In Progress → **In Review** (fertig gebaut, wartet auf Pedis Sichtabnahme) → Done.

**Reihenfolge zum Einlesen:**
1. **Projekt SCRUM** (die App) — Board öffnen: erst die Spalte *In Review* (= jüngste fertige
   Arbeit, zeigt den aktuellen Qualitätsmaßstab), dann *To Do* (was ansteht). Die Ticket-
   Beschreibungen sind bewusst ausführlich (Kontext, Scope, Regeln) — 5–6 Tickets quer lesen
   (z. B. SCRUM-396…408) und du kennst Stil und Anspruch.
2. **Projekt KLLM** (eigener LLM-Server) — KLLM-55…61 der Reihe nach: das ist ein kompletter
   Phasenplan mit Kosten und Stop-Lines.
3. **KWEB** (Website) und **KGURU** (Register) — überfliegen reicht anfangs. **KREL** = Releases.
4. Kommentare beachten: Jede erledigte Arbeit hat einen Ergebnis-Kommentar mit Commit-Hash und
   Testnachweis — Commit-Hashes sind im Zweifel maßgeblicher als Ticketnummern.

## GitHub (Spiegel: Gitea)

GitHub ist die **Code- und Doku-Wahrheit**. Die Repos entsprechen den lokalen Ordnern aus
`03_REPOS_UND_ORTE.md`; befüllt werden sie ausschließlich über die KLARWERK-Sync-App.

**Reihenfolge zum Einlesen (im Repo `dev_Klarwerk`):**
1. `CLAUDE.md` — das Regelwerk (5 Minuten, Pflicht).
2. `PROJECT_CONTEXT/` — dieser Ordner, Dateien 00–05 (falls du das hier lokal liest: erledigt).
3. `docs/qm/claude-after-report.md` — **das Projektgedächtnis**: jede erledigte Aufgabe mit
   Was/Warum/Beweis/Offen. Die letzten ~10 Einträge lesen = du weißt, was zuletzt geschah.
4. `docs/qm/BOSS_SESSION_STAND_2026-07-02.md` — der ausführliche Boss-Übergabestand.
5. Git-Historie: `git log --oneline -30` (oder GitHub-Commits-Ansicht) — Commit-Messages sind
   hier bewusst erzählend, mit Ticketnummern und Gate-Nachweisen.
6. Danach Struktur überfliegen: `/services` (Backend-Module), `/apps/web/src/pages` (die
   Bildschirme), `/tests` (Wahrheit über gewolltes Verhalten), `docs/ci/CI_KURZREFERENZ.md` (Gestaltung).

**Andere Repos:** `klarwerk-public-website` (README + `docs/`-Video-Prompts),
`klarwerk-knowledge-guru` (Register = WAS das Produkt alles können soll, mit Status),
`klarwerk-local-llm` (`docs/KLLM_…KONZEPT…md` = Team-2-Gesamtplan).

## Danach: erster Arbeitsschritt

Nicht mit Code anfangen. Erst: die KLARWERK-App über die Schreibtisch-App starten (oder von
Pedi zeigen lassen), den Kernkreislauf einmal selbst durchklicken (Erfassen → Studio → Einreichen →
Validieren → Fragen). Wer den Kreislauf einmal bedient hat, versteht 80 % aller Tickets.
Dann in Jira ein kleines To-Do-Ticket auf sich ziehen (Regeln: `02_ARBEITSREGELN.md`).
