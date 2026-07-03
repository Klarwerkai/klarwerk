# Onboarding-Skript — neuer Mitarbeiter (vollwertig & unabhängig)

> Schritt-für-Schritt bis zur eigenständigen Mitarbeit. Kein Terminal-Wissen nötig —
> alles Technische erledigt die eigene Claude-Session. Dauer realistisch: ~ halber Tag.
> Rollen: **[P] = Pedi macht das · [M] = Mitarbeiter macht das · [C] = seine Claude-Session macht das.**

## Phase 0 — Zugänge (vorab, [P])

- [ ] **Jira:** Einladung zu `klarwerk.atlassian.net` (Projekte SCRUM/KWEB/KLLM/KGURU/KREL).
- [ ] **GitHub:** Zugriff auf alle Projekt-Repos (Collaborator/Team). Der Mitarbeiter erstellt
      sich damit später ein eigenes Personal Access Token (PAT) zum Klonen/Pushen.
- [ ] **Anthropic-Key** (nur falls er die KLARWERK-App mit echter KI betreiben soll):
      eigenen Key persönlich übergeben — NIE per Mail/Chat/Repo.
- [ ] Kurz mündlich: Was ist KLARWERK, was ist seine Rolle, welches erste Ticket ist angedacht.

## Phase 1 — Mac vorbereiten ([M], ~15 Min.)

- [ ] **Claude-Mac-App** installieren und anmelden (Cowork-Modus verfügbar).
- [ ] Ordner anlegen (im Finder): `~/Documents/Klarwerk` — mehr nicht; den Rest macht Claude.
- [ ] **GitHub-PAT erstellen:** github.com → Settings → Developer settings → Personal access
      tokens → „Fine-grained", Zugriff auf die KLARWERK-Repos, Rechte „Contents: Read and write".
      Token bereithalten (wird gleich EINMAL eingegeben, danach nur im Schlüsselbund).

## Phase 2 — Erste Claude-Session: Arbeitsumgebung bauen ([M] startet, [C] arbeitet)

Neue Konversation in der Claude-App, Ordner **`Documents`, `Desktop`** freigeben, dann diesen
Prompt einfügen (Platzhalter GITHUB-BENUTZER ersetzen):

```
Du richtest meinen Mac als Arbeitsumgebung für das KLARWERK-Projekt ein. Ich bin
nicht-technisch — erkläre kurz, was du tust, und erledige alles selbst.

1) Klone diese GitHub-Repos (frage mich EINMAL nach meinem GitHub-Benutzernamen und
   Personal Access Token; hinterlege die Zugangsdaten sicher im macOS-Schlüsselbund/
   git credential helper, niemals in Dateien):
   - dev_Klarwerk            → ~/Documents/dev_Klarwerk
   - klarwerk-public-website → ~/Documents/Klarwerk/klarwerk-public-website
   - klarwerk-knowledge-guru → ~/Documents/Klarwerk/klarwerk-knowledge-guru
   - klarwerk-local-llm      → ~/Documents/Klarwerk/klarwerk-local-llm
2) Setze meine Git-Identität (frage mich nach Name + E-Mail).
3) Lies ~/Documents/dev_Klarwerk/PROJECT_CONTEXT vollständig (Dateien 00–12) und
   übernimm die dortigen Arbeitsregeln — insbesondere: nur lokal committen, kein Push
   außer über die Sync-App; Gates vor jeder Lieferung; After-Report-Pflicht.
4) Richte die Schreibtisch-Apps nach dem Muster aus 06_SCHREIBTISCH_APPS.md für MEINE
   Pfade ein: „KLARWERK App", „KLARWERK Sync" (Master nach
   ~/Documents/Klarwerk/tools-sync/ kopieren und anpassen) und prüfe sie per Testlauf.
5) Installiere/prüfe die Werkzeuge für die Gates (Node 20+, npm-Abhängigkeiten in
   dev_Klarwerk) und fahre einmal tools/check + npm run smoke:ui — melde mir ehrlich
   das Ergebnis.
6) Zum Schluss: Fasse mir zusammen, was eingerichtet ist, was fehlt, und welche
   Datei ich als Nächstes lesen soll.
```

Hinweise für [C]: macOS-TCC beachten (Terminal-/Ordner-Freigaben können Dialoge auslösen — [M]
bestätigt sie). Anthropic-Key: beim ersten Start der „KLARWERK App" erscheint der Key-Dialog;
[M] trägt den von Pedi erhaltenen Key ein (landet nur im Schlüsselbund).

## Phase 3 — Projekt verstehen ([M], ~1,5 Std.)

- [ ] Route aus `07_JIRA_GITHUB_EINSTIEG.md` abarbeiten (Jira: In Review → To Do; Repo:
      CLAUDE.md → After-Report → Git-Log).
- [ ] **KLARWERK-App per Schreibtisch-App starten und den Kernkreislauf einmal selbst
      durchklicken:** Erfassen → Studio → Prüfen & einreichen → Validierung → Bibliothek → Fragen.
      (Wer den Kreislauf bedient hat, versteht 80 % aller Tickets.)
- [ ] `09_ENTSCHEIDUNGEN.md` + `11_CI_DESIGN.md` lesen (nichts erneut diskutieren, CI sitzt).

## Phase 4 — Erste echte Aufgabe ([M] + [C])

- [ ] **Vor Arbeitsbeginn: „KLARWERK Sync" klicken** (aktuellen Stand holen/pushen). Immer.
- [ ] In Jira ein kleines To-Do-Ticket **auf sich ziehen** (Assignee setzen + Kommentar „übernehme ich").
      Gute Einstiegskandidaten: SCRUM-406/407 (?-Hilfen — viel Lesen, wenig Risiko) — mit Pedi abstimmen.
- [ ] Claude-Session mit dem Einstiegsprompt aus `00_START_HIER.md` starten und das Ticket
      umsetzen lassen — nach den Regeln: Gates grün → lokal committen → After-Report →
      Jira „In Review" + Ergebnis-Kommentar → **Sync klicken** → Pedi zur Sichtabnahme.

## Abschluss-Checkliste „vollwertig arbeitsfähig"

- [ ] Jira: kann Tickets sehen, sich zuweisen, kommentieren, Status ändern.
- [ ] Repos lokal, `tools/check` + `smoke:ui` einmal selbst grün gefahren.
- [ ] Schreibtisch-Apps funktionieren (App startet KLARWERK, Sync pusht sichtbar mit ✓).
- [ ] Kernkreislauf der App einmal selbst durchgeklickt.
- [ ] Erstes Ticket: umgesetzt ODER ehrlich mit Fragen an Pedi zurückgemeldet.
- [ ] Verstanden & bestätigt: kein Push außer Sync · keine Secrets außerhalb des Schlüsselbunds ·
      Käufe/Außenkommunikation nur Pedi · Ehrlichkeit vor Optik.

## Zusammenarbeit im Alltag (Erinnerung aus 02_ARBEITSREGELN.md)

Sync vor Arbeitsbeginn und nach Feierabend · nur an zugewiesenen Tickets arbeiten · nie parallel
an denselben Dateien · Übergaben schriftlich (After-Report/Jira, nie nur Chat) · bei Unklarheit:
kurze Frage in Jira statt stiller Annahme. Die Boss-Session (Pedis Konversation) koordiniert.
