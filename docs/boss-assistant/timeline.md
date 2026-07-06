# KLARWERK — Steuerungs-Timeline

_Aufgebaut aus Boss-Auskunft (2026-07-06). Zu verifizieren gegen After-Report + Git-Log + `pmo-items.json`._

## Phase 1 — manuell (bis 02.07.2026)
Pedi moderierte einzelne Team-Chats manuell; Übergaben per Boss-Stand-Dokument.
**Kernproblem:** Wissensverlust bei jedem Session-Ende.

## Phase 2 — Boss-zentral (02.–03.07.2026)
Boss als koordinierende UND ausführende Instanz („Alles hier direkt"). Hartes Regelwerk:
Gates vor Lieferung, Commit lokal / Push nur via Sync-App, After-Report-Pflicht, Schreibtisch-App-Prinzip.
**Ergebnisse:** v0.9.14–0.9.21 + gesamte Werkzeuglandschaft (Sync-, LLM-, Prüfstand-Apps).

## Phase 3 — arbeitsteilig (seit 03.07.2026 abends)
Budget-Grenze erzwang Rollentrennung:
**Paul baut · Boss prüft/committet/verwaltet · Pedi klickt & entscheidet.**

### Schlüsselereignisse Phase 3
- **03.07. nachts:** Freeze `v1.0.0-beta.1`.
- **03.07.:** PMO-Automatik live — Paul → Brücke-Drafts → Runner `apply-item-update.mjs` (SCRUM-434).
  Team 7 damit nicht mehr nur read-only.
- **04.07.:** Freeze-Aufhebung — Geschwindigkeit bewusst über Stand-Stabilität, mit Auflagen (Entscheidungs-Log 04.07.).
  → **größter Steuerungs-Kurswechsel bisher.**
- **04.07. 11:49:** Commit `d25e7df` von unbekannter lokaler Session unter Pedis Git-Identität (**ungeklärt**).

## Akteure (aktuelle Aufstellung)
- **Pedi** — Mensch, Stakeholder, alle materiellen Entscheidungen/Freigaben.
- **The Boss** — Agent, Gesamtsteuerung (seit Phase 3: prüft/committet/verwaltet).
- **Paul** — übernimmt Boss-Aufgaben, baut (seit Phase 3).
- **Berater** — Recherche & Beratung (von Paul hinzugezogen).
- **Nerd** — Mac Studio (von Paul hinzugezogen).
- **Assistent (ich)** — Boss-Assistent, Wissensbasis & Onboarding.
- **Codex** — Git/Commit/Push/Jira/Verify in den Team-Repos.
- **Teams 1–7** — Fach-Tracks (siehe `contradictions.md` C-01 für Repo/Jira-Zuordnung).

## Zeitliche Bearbeitungsreihenfolge (laut Pedi)
Team 1–7 → Boss + Paul → Paul ergänzt Berater + Nerd.
