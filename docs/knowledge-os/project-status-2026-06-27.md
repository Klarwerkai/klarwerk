# KLARWERK — Projektstand nach SCRUM-245

Status: Reference document.  
This document is not the Jira backlog.  
This document does not close tickets.  
Jira remains the backlog and status source of truth.

Datum: 2026-06-27  
Arbeitsmodus: Operational Kanban  
Projektkey: `SCRUM` bleibt historisch bestehen.

Leitsatz:

> KLARWERK — Knowledge OS.  
> The AI may change. Your knowledge never does.

## 1. Aktueller Abschlussstand

Der zuletzt aktive Block ist abgeschlossen:

| Work Item | Status | Ergebnis | Nachweis |
|---|---|---|---|
| SCRUM-242 — Ask: HTTP-Workflow routennah absichern | Done | Ask-Datenpfad routennah abgesichert | Jira + Commit-Historie |
| SCRUM-243 — Capture/KO-Erstellung mit Attachment/Evidence absichern | Done | Capture→KO→Object/Attachment/Source→Evidence routennah abgesichert | Commit `f1dadd9` |
| SCRUM-244 — Demo-Datensatz reale Review-/Demo-Flows | Done | Demo-Seed zeigt echte Flows mit validierten KOs, Quelle+Attachment+Evidence, Gap, Konflikt, Revalidation, Lernpfad | Commit `b041057` |
| SCRUM-245 — Bibliothek: Suche produktnäher machen | Done | Bibliothek zeigt nachvollziehbare Relevanzsortierung + Match-Gründe | Commit `f61dcdc` |

Letzter Gate-Stand für SCRUM-245:

- `npm run check` grün: 113 Dateien / 601 Tests
- `apps/web tsc --noEmit` grün
- Biome sauber
- dependency-cruiser sauber
- Push auf `main`: `b041057..f61dcdc`

## 2. Kanban-Arbeitsweise

Die technische Jira-Board-Erstellung ist aktuell blockiert, weil im verfügbaren Jira/Rovo-Werkzeug kein Board-Creation-Tool vorhanden ist.

Operational gilt trotzdem:

```text
Backlog → Ready → In Progress → Codex Review → Blocked → Done
```

Regeln:

- Genau ein aktives Work Item.
- Keine Sprint-Sprache.
- Keine Ticket-Fabrik.
- Keine parallelen Kleintickets.
- Keine Serien von reinen HTTP-/Endpoint-/Read-only-Audit-Tickets ohne Produkt-/Release-Blocker.

Empfohlene spätere Board-Konfiguration:

- Board: `KLARWERK Knowledge OS Kanban`
- Filter: `project = SCRUM ORDER BY Rank ASC`
- Spalten: Backlog · Ready · In Progress · Codex Review · Blocked · Done
- WIP: In Progress max. 1, Codex Review max. 2

## 3. Was durch SCRUM-245 verbessert wurde

Die Bibliothek ist produktnäher:

- Treffer werden nicht mehr nur in Backend-Rückgabereihenfolge angezeigt.
- Treffer werden client-seitig deterministisch nach nachvollziehbarer Relevanz sortiert.
- Match-Gründe werden sichtbar:
  - Titel
  - Tag
  - Kategorie
  - Wissensart
  - Text
- Der Leerzustand ist query-bewusst und gibt konkrete Suchhinweise.
- Keine neue Sucharchitektur wurde eingeführt.
- Keine semantische Suche, kein RAG, keine Vector-DB wird behauptet.

Wichtig: Das Re-Ranking arbeitet nur auf der bereits vom Server gelieferten Trefferliste. Es erweitert die Ergebnismenge nicht künstlich.

## 4. Sichtbare Produktwirkung

Der Demo-Seed aus SCRUM-244 und die Bibliotheksverbesserung aus SCRUM-245 greifen jetzt zusammen:

- Demo-Wissen ist nach Stichworten wie `ventil`, `pumpe`, `filter` besser auffindbar.
- Nutzer sehen, warum ein Treffer angezeigt wird.
- Die Bibliothek wirkt weniger wie eine rohe Liste und mehr wie ein nutzbarer Knowledge-OS-Zugang.
- Bestehende Aktionen bleiben erhalten:
  - KO-Detail-Link
  - Export
  - Filter
  - Revalidierung
  - Ergebnislimitierung

## 5. Restlücken

Bewusst offen:

- Server-Suche matcht `q` weiterhin nur auf Titel/Statement.
- Tag-/Kategorie-/Typ-only-Treffer werden nicht zusätzlich vom Backend eingeblendet.
- Keine Volltext-Engine.
- Keine semantische Suche.
- Keine RAG-/Reasoner-Suche.
- Keine Ranking-Konfiguration im UI.
- Keine Browser-E2E-Prüfung.

Das ist für diesen Block akzeptiert: Ziel war produktnähere Suche ohne große Sucharchitektur.

## 6. Nächster sinnvoller einzelner Block

Kein neues Ticket wurde automatisch gestartet.

Aus Sicht des aktuellen Produktstands wäre der nächste einzelne Block:

**MyTasks / Start als echte Arbeitszentrale schärfen**

Warum:

- Nach Demo-Seed und besserer Bibliothek ist Wissen sichtbar und auffindbar.
- Der nächste Produktreife-Hebel ist die tägliche Handlungsebene: Was soll ein Nutzer jetzt tun?
- Start und MyTasks sollten echte Arbeitsprioritäten aus vorhandenen Daten klarer bündeln, ohne neue Engine und ohne Fake-Aufgaben.

Mögliche Akzeptanzkriterien für ein späteres Work Item:

- Start zeigt eine klare, datengetriebene Arbeitszusammenfassung.
- MyTasks priorisiert echte Aufgaben nachvollziehbar.
- Validierung, Gap, Konflikt, Revalidation und Lernpfad werden nicht vermischt, aber handlungsnah gruppiert.
- Keine neue Task-Engine.
- Keine erfundenen Aufgaben.
- DOM-freier Helper für Priorisierung/Grouping.
- Bestehende Aktionen und Links bleiben erhalten.

## 7. Prozessentscheidung

Jetzt gilt:

- Codex steuert.
- Claude setzt um.
- Jira dokumentiert.
- Pedi entscheidet Richtung.

Bis zur nächsten ausdrücklichen Entscheidung wird kein neues Work Item gestartet.
