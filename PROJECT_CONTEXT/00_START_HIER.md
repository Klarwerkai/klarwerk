# START HIER — Onboarding für neue Mitarbeiter & neue Sessions

> Zweck dieses Ordners: **Kein Wissensverlust.** Jeder neue Mitarbeiter (Mensch mit
> Claude-Mac-App) und jede neue Claude-Konversation kann hiermit gleichwertig einsteigen.
> Stand-Datum steht in `04_AKTUELLER_STAND.md` — bei jeder größeren Änderung fortschreiben.

## Einstiegsprompt für eine neue Claude-Session

Kopiere das in eine neue Konversation (Ordner `dev_Klarwerk`, `Documents`, `Desktop` freigeben):

```
Lies den Ordner dev_Klarwerk/PROJECT_CONTEXT vollständig (Dateien 00–07 in Reihenfolge),
danach dev_Klarwerk/docs/qm/BOSS_SESSION_STAND_2026-07-02.md. Übernimm die dort
beschriebene Arbeitsweise. Bestätige kurz: Rolle, aktuelle Version, nächste offene Schritte.
```

## Lese-Reihenfolge

1. **00_START_HIER.md** (diese Datei) — wie einsteigen.
2. **01_PROJEKT_UEBERBLICK.md** — was KLARWERK ist, wer beteiligt ist, welche Teile existieren.
3. **02_ARBEITSREGELN.md** — wie hier gearbeitet wird (Gates, Ehrlichkeit, Sicherheit, Mehrpersonen-Regeln).
4. **03_REPOS_UND_ORTE.md** — Karte aller Repos, Ordner, Schlüssel, Werkzeuge.
5. **04_AKTUELLER_STAND.md** — wo wir JETZT stehen (Version, offene Tickets, Tagesplan).
6. **05_TEAM2_LLM_SERVER.md** — Sonderthema eigener LLM-Server (läuft parallel zur Beta).
7. **06_SCHREIBTISCH_APPS.md** — wie ALLES benutzerfreundlich über Schreibtisch-Apps läuft
   (Prinzip, technisches Muster, jede App erklärt) — Pflicht vor jeder Starter-Änderung.
8. **07_JIRA_GITHUB_EINSTIEG.md** — was du dir in Jira und GitHub zuerst ansiehst (geführte
   1-Stunden-Route zum Projektverständnis).

Danach als lebende Quellen: `docs/qm/BOSS_SESSION_STAND_2026-07-02.md` (Boss-Stand),
`docs/qm/claude-after-report.md` (lückenlose After-Reports jeder erledigten Aufgabe),
Jira-Projekt SCRUM (+ KWEB/KLLM/KGURU/KREL) und das PMO-Dashboard.

## Die drei wichtigsten Sätze

1. **Ehrlichkeit vor Optik** — lieber ein ehrliches „geht nicht / weiß nicht" als eine schöne Attrappe.
2. **Nur grüne Gates sind lieferbar** — `tools/check` + `npm run smoke:ui`, erst dann übergeben.
3. **Pedi entscheidet** — Stakeholder, nicht-technisch (keine Terminaleingaben!); Käufe,
   Freigaben und Sichtabnahmen macht nur er.
