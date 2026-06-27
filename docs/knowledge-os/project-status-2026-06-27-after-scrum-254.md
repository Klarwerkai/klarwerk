# KLARWERK — Projektstand nach SCRUM-254

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

## 1. Kurzfazit

Der aktuelle Produktreife-Strang ist nach SCRUM-254 sauber abgeschlossen.

Seit dem letzten Projektstand nach SCRUM-245 wurde nicht weiter an großer Architektur gearbeitet, sondern gezielt an den wichtigsten Stufe-1-Kernflüssen:

- Live-Basics-Triage
- Start/MyTasks als Arbeitszentrale
- Capture-Speicherbereitschaft
- Validierungsboard
- Ask-Antwortverständlichkeit
- KO-Detail als zentrale Wissensseite
- Konfliktklärung
- Wissenslücken
- Lebenszyklus/Revalidierung

Alle Blöcke wurden einzeln umgesetzt, geprüft, committed, gepusht und in Jira abgeschlossen. Es gibt aktuell kein automatisch gestartetes nächstes Work Item.

## 2. Abgeschlossene Work Items seit SCRUM-245

| Work Item | Status | Produktwirkung | Commit |
|---|---|---|---|
| SCRUM-246 — Live Basics Triage | Done | Kein P0/P1-Codeblocker gefunden; P2-Ops-Notizen dokumentiert | `37d1b6b` |
| SCRUM-247 — Start/MyTasks Arbeitszentrale | Done | Start zeigt getrennte echte Arbeitssignale; MyTasks-Gruppierung testbar | `74ac2e1` |
| SCRUM-248 — Capture Speicherbereitschaft | Done | Erfassen zeigt Pflicht-/Optional-Checks; Submit braucht Titel + Inhalt | `2733a46` |
| SCRUM-249 — Validierung Review-Signale | Done | Review-Karten zeigen Status, Trust, Version, Transfer-/Entscheidungshinweis | `fc3a8ba` |
| SCRUM-250 — Ask verständlicher | Done | Antworten zeigen ehrlich gesichert/ungeprüft, Quellen als KO-Titel, Gap-Schritt | `d378524` |
| SCRUM-251 — KO-Detail Handlungsübersicht | Done | KO-Detail zeigt oben Nutzbarkeit, Status, Trust, Zähler und nächste Handlung | `6a0b444` |
| SCRUM-252 — Konflikte nächste Handlung | Done | Konfliktkarten zeigen aus Art+Status abgeleiteten nächsten Schritt | `dd5aa88` |
| SCRUM-253 — Wissenslücken nächste Handlung | Done | Gap-Liste zeigt pro offener Lücke Priorisierung/Zuweisung/Erfassen als nächsten Schritt | `3ed2c31` |
| SCRUM-254 — Lifecycle/Revalidierung | Done | Pending-Revalidierungen zeigen Titel, Anlagenbezug und nächste Handlung statt roher ID | `eb06ec4` |

Letzter Gate-Stand für SCRUM-254:

- `npm run check` grün: 118 Dateien / 639 Tests
- apps/web `tsc --noEmit` grün
- Biome sauber
- dependency-cruiser sauber
- Push auf `main`: `3ed2c31..eb06ec4`

## 3. Was sich produktseitig verbessert hat

### 3.1 Die Kernflüsse sind handlungsnäher

Vor diesem Strang waren viele Flächen technisch vorhanden, aber teils noch roh:

- Listen zeigten Daten, aber nicht immer den nächsten Schritt.
- IDs waren sichtbar, wo Titel/Kontext hilfreicher sind.
- Status und Trust waren verteilt, aber nicht immer direkt entscheidungsnah.
- Nutzer mussten an mehreren Stellen selbst erschließen, was zu tun ist.

Jetzt zeigen die wichtigsten Flows eine kompakte, ehrliche Orientierung:

- **Start/MyTasks:** getrennte echte Arbeitssignale statt gemischter Todo-Liste.
- **Capture:** klare Speicherbereitschaft vor KO-Erstellung.
- **Validation:** Review-Karten mit Trust/Status/Version/Entscheidungshinweis.
- **Ask:** Antwortstatus und Quellen sind verständlich.
- **KO-Detail:** zentrale Handlungsübersicht oben.
- **Conflicts:** Konflikte nennen den nächsten Klärungsschritt.
- **Risk/Gaps:** Wissenslücken nennen den nächsten Bearbeitungsschritt.
- **Lifecycle:** Revalidierungen zeigen verständliche KO-/Asset-Kontexte.

### 3.2 Die Knowledge-OS-Schleife ist sichtbarer

Die App bildet jetzt deutlicher den Kreis ab:

```text
Erfassen → Validieren → Finden/Fragen → Klären → Lücke schließen → Revalidieren
```

Das ist noch keine vollständige Produktreife im Sinne einer alten App-Parität, aber der zentrale Knowledge-OS-Nutzen ist weniger versteckt.

### 3.3 Die Änderungen bleiben bewusst klein

Alle neuen Ableitungen wurden aus vorhandenen Daten gebaut:

- DOM-freie Helper
- keine neuen Großmodelle
- keine Backend-Redesigns
- keine neue RAG-/Vector-/Reasoner-Architektur
- keine automatische Mutation
- keine Ticketserie

Das war die richtige Leitplanke: Produktwirkung erhöhen, ohne die Architektur in dieser Phase aufzureißen.

## 4. Prozessstand

Operational gilt weiterhin:

```text
Backlog → Ready → In Progress → Codex Review → Blocked → Done
```

Praktisch heißt das:

- Genau ein aktives Work Item.
- Codex wählt oder erstellt genau ein Ticket.
- Codex liefert den Claude-Prompt.
- Claude setzt um.
- Codex prüft, committet, pusht und aktualisiert Jira.
- Danach Stopp, bis Pedi wieder startet.

Nicht aktiv:

- keine Board-Migration
- keine Spalten-/Workflow-Experimente
- keine Ticket-Kopien
- keine Massenanlage
- keine Sprint-Sprache

Jira bleibt Backlog- und Statusquelle. After-Reports und diese Dokumente sind Nachweise und Orientierung, kein zweites Backlog.

## 5. Aktueller Produktstand nach Bereichen

| Bereich | Stand | Einschätzung |
|---|---|---|
| Setup/Login/Session | Grundfluss vorhanden und mehrfach geprüft | stabil genug für Demo/Review |
| Start | Rollen-/Arbeitsübersicht deutlich handlungsnäher | produktnäher |
| Capture | Speicherbereitschaft sichtbar; Titel+Inhalt gegated | deutlich besser |
| Library | Relevanzsortierung + Match-Gründe | produktnäher, aber keine Volltextsuche |
| KO-Detail | zentrale Übersicht + viele Detailkarten | klarer Zielpunkt |
| Validation | Review-Signale + Priorisierung | handlungsnäher |
| Ask | Antwortstatus, Quellen, Gap-Schritt sichtbar | ehrlicher |
| Risk/Gaps | Cockpit + nächste Handlung je Lücke | handlungsnäher |
| Conflicts | nächste Klärungshandlung sichtbar | handlungsnäher |
| Lifecycle | Revalidierungen mit Titel/Asset/Schritt | deutlich verständlicher |
| Mobile/PWA | Smoke/Regeln abgesichert, kein Vollausbau | ausreichend für jetzt |
| Stufe 2/QM | viele Foundation-Sichten vorhanden | nicht aktueller Fokus |

## 6. Bewusst offene Restlücken

Offen, aber aktuell nicht als Blocker behandelt:

- Kein echter Browser-Live-Smoke in dieser Umgebung.
- Keine Alt-App-Pixel- oder Funktionsparität.
- Keine Volltext-/Semantik-/Vector-Suche.
- Keine automatische Gap→KO-Erzeugung.
- Keine automatische Konfliktlösung.
- Keine echte Revalidierungs-Workflow-Engine.
- Keine Backoffice-/Admin-Politur.
- Kein großes Source/Evidence/Version-Metamorphose-Modell.
- Kein ModelAdapter/Conductor/ModelRun-Ausbau in diesem Produktreife-Strang.

Diese Lücken sind relevant, aber sie sollen nicht wieder in eine Ticketfabrik zerfallen.

## 7. Empfehlung für den nächsten einzelnen Block

Nicht automatisch gestartet.

Aus aktueller Sicht wäre der nächste sinnvolle einzelne Produktblock:

**Demo-/Review-Run mit realer Oberfläche: ein geführter End-to-End-Durchlauf dokumentieren und nur echte Blocker fixen.**

Warum:

- Viele Kernflüsse wurden einzeln produktnäher gemacht.
- Jetzt sollte nicht wieder eine neue Detailfläche optimiert werden.
- Der nächste Erkenntnisgewinn kommt aus einem echten Durchlauf:
  - Demo-Seed starten
  - als Nutzer durch Start → Capture → Library → KO-Detail → Ask → Gap/Risk → Validation → Lifecycle gehen
  - nur P0/P1 oder sehr klare P2-Produktbremsen aufnehmen

Akzeptanz für einen späteren Block:

- Ein kurzer, reproduzierbarer Demo-/Review-Run liegt vor.
- Maximal ein echter Blocker wird im selben Block gefixt.
- Keine Ticketserie.
- Keine neue Architektur.
- Gates bleiben grün.

Alternative, falls Pedi bewusst weiter Feature-Flächen schärfen will:

**Output Factory / Ergebnisverwendung produktnäher machen**, aber nur als einzelnes Work Item und nur auf vorhandener Output-Architektur.

## 8. Statusformel

Wir sind nicht „fertig“ im Sinne einer kompletten alten App-Parität.

Wir sind aber an einem guten Zwischenpunkt:

- Die technische Foundation ist stabiler.
- Die Kernflüsse sind sichtbarer und handlungsnäher.
- Jira ist sauber nachgeführt.
- `main` ist grün.
- Der Prozess funktioniert wieder im gewünschten Rhythmus.

Nächster Schritt sollte ein echter Produktdurchlauf sein, nicht die nächste Reihe kleiner Detailtickets.

