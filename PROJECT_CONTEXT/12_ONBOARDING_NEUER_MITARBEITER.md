# Onboarding-Skript — neuer Mitarbeiter (vollwertig & unabhängig)

> Schritt-für-Schritt bis zur eigenständigen Mitarbeit. Kein Terminal-Wissen nötig —
> alles Technische erledigt die eigene Claude-Session. Dauer realistisch: ~ halber Tag.
> Rollen: **[P] = Pedi macht das · [M] = Mitarbeiter macht das · [C] = seine Claude-Session macht das.**
>
> **Variante Cloud-Session** (Mitarbeiter arbeitet als Claude-Cloud-Session statt am eigenen Mac):
> Phasen 1–2 entfallen; es gelten die Cloud-Regeln aus `02_ARBEITSREGELN.md` (Kennung,
> Commit-Weg über die Boss-Session, Datei-Brücke `docs/team2-austausch/`).

## Phase 0 — Zugänge (vorab, [P])

- [ ] **Jira:** Einladung zu `klarwerk.atlassian.net` (Projekte SCRUM/KWEB/KLLM/KGURU/KREL).
- [ ] **GitHub:** Zugriff auf alle Projekt-Repos (Collaborator/Team). Der Mitarbeiter erstellt
      sich damit später ein eigenes Personal Access Token (PAT) zum Klonen/Pushen.
- [ ] **Anthropic-Key** (nur falls er die KLARWERK-App mit echter KI betreiben soll):
      eigenen Key persönlich übergeben — NIE per Mail/Chat/Repo.
- [ ] Kurz mündlich: Was ist KLARWERK, was ist seine Rolle, welches erste Ticket ist angedacht.

## Phase 1 — Mac vorbereiten ([M], ~15 Min.)

> ### ⚠️ Zuerst: Wohin die Repos NICHT gehören
>
> **Ursache.** Auf dem Mac kann iCloud Drive die Ordner `~/Documents` und `~/Desktop`
> synchronisieren — die Betriebsart heißt „Schreibtisch & Dokumente“. iCloud kennt die
> Arbeitsweise von Git nicht: Es kopiert Dateien, die es für Konflikte hält, und legt sie mit
> dem Namenszusatz ` 2` daneben — auch mitten in der internen Verwaltung eines Repositories.
>
> **Risiko — auf Pedis Arbeitsplatz gemessen (JOB 914, 15.08.2026).** 611 byte-identische
> Duplikate unter `~/Documents/dev_Klarwerk`, 1003 unter `~/Documents/Klarwerk`. Darunter Kopien
> Git-eigener Verwaltungsdateien: `.git/worktrees/…/gitdir 2`, `ORIG_HEAD 2`, `commondir 2` und
> ein duplizierter Objektknoten unter `.git/objects/`. Löschen hilft nur bis zum nächsten Mal:
> solange die Synchronisation über dem Repository liegt, kommen sie wieder — und im ungünstigen
> Fall trifft es Dateien, aus denen Git seinen Zustand liest.
>
> **Sicherer Zielort.** Ein Arbeitsbaum gehört in einen Ordner, den **keine** Synchronisation
> anfasst — `~/Projekte/…` (hier verwendet) oder `~/Developer/…`. Nicht `~/Documents`, nicht
> `~/Desktop`, nicht iCloud Drive, nicht Dropbox, nicht OneDrive. Die Sicherung des Codes leistet
> das entfernte Repository, nicht der Dateisync.
>
> **Prüfweg — und was der Pfadname NICHT beweist.** Ob die Synchronisation bei dir aktiv ist,
> sagt der Ordnername nicht: Bei „Schreibtisch & Dokumente“ führt macOS `~/Documents` weiter
> unter seinem alten Pfad, und eine Prüfung auf den iCloud-Ordner oder auf `.icloud`-Platzhalter
> antwortet dann fälschlich mit Nein (in JOB 914 gemessen). **Der Pfadname allein beweist
> nichts.** Nachsehen kannst du es auf zwei Wegen:
>
> 1. **Systemeinstellungen → [dein Name] → iCloud → iCloud Drive → Optionen** — steht dort
>    „Ordner ‚Schreibtisch‘ & ‚Dokumente‘“ auf ein, ist sie aktiv.
> 2. **An der Wirkung:** Liegt in einem Ordner neben `X.ext` eine Datei `X 2.ext` und sind beide
>    **byteweise gleich**, ist das ein Synchronisationsduplikat. Ein bloß ähnlicher Name genügt
>    nicht — in JOB 914 waren 20 Treffer NICHT byte-identisch und zählten zu Recht nicht.
>
> **Migration eines bestehenden Ordners — du entscheidest, nichts geschieht von selbst.** Der
> sichere Weg ist **neu klonen statt verschieben**: erst alles pushen (`git status` muss leer
> sein), dann am neuen Ort frisch klonen, dort einmal `npm ci` und `./tools/check` fahren — und
> den alten Ordner erst danach entfernen. Ein Verschieben mit dem Finder nimmt die Duplikate mit
> und kann einen halb synchronisierten Zustand mitschleppen.
>
> *Herkunft: JOB 914 D1 (`RUECKGABE-PRO3-JOB-914-D1-ICLOUD-REPO-SETUP.md`), gebaut in JOB 1114 D1.
> Wächter: `tests/app/icloud-onboarding-warnung.test.ts`.*

- [ ] **Claude-Mac-App** installieren und anmelden (Cowork-Modus verfügbar).
- [ ] Ordner anlegen (im Finder): `~/Projekte/Klarwerk` — mehr nicht; den Rest macht Claude.
- [ ] **GitHub-PAT erstellen:** github.com → Settings → Developer settings → Personal access
      tokens → „Fine-grained", Zugriff auf die KLARWERK-Repos, Rechte „Contents: Read and write".
      Token bereithalten (wird gleich EINMAL eingegeben, danach nur im Schlüsselbund).

## Phase 2 — Erste Claude-Session: Arbeitsumgebung bauen ([M] startet, [C] arbeitet)

Neue Konversation in der Claude-App, Ordner **`Projekte`** freigeben, dann diesen
Prompt einfügen (Platzhalter GITHUB-BENUTZER ersetzen):

```
Du richtest meinen Mac als Arbeitsumgebung für das KLARWERK-Projekt ein. Ich bin
nicht-technisch — erkläre kurz, was du tust, und erledige alles selbst.

1) Klone diese GitHub-Repos (frage mich EINMAL nach meinem GitHub-Benutzernamen und
   Personal Access Token; hinterlege die Zugangsdaten sicher im macOS-Schlüsselbund/
   git credential helper, niemals in Dateien):
   - dev_Klarwerk            → ~/Projekte/dev_Klarwerk
   - klarwerk-public-website → ~/Projekte/Klarwerk/klarwerk-public-website
   - klarwerk-knowledge-guru → ~/Projekte/Klarwerk/klarwerk-knowledge-guru
   - klarwerk-local-llm      → ~/Projekte/Klarwerk/klarwerk-local-llm
2) Setze meine Git-Identität (frage mich nach Name + E-Mail).
3) Lies ~/Projekte/dev_Klarwerk/PROJECT_CONTEXT vollständig (Dateien 00–12) und
   übernimm die dortigen Arbeitsregeln — insbesondere: nur lokal committen, kein Push
   außer über die Sync-App; Gates vor jeder Lieferung; After-Report-Pflicht.
4) Richte die Schreibtisch-Apps nach dem Muster aus 06_SCHREIBTISCH_APPS.md für MEINE
   Pfade ein: „KLARWERK App", „KLARWERK Sync" (Master nach
   ~/Projekte/Klarwerk/tools-sync/ kopieren und anpassen) und prüfe sie per Testlauf.
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
