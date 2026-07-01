# Beta RC Smoke Fix Response Lane v0

- **Status:** `rc_support_lane_only`
- **Team:** Team 1 / KLARWERK Produktkern / Knowledge OS
- **Jira-Bezug:** SCRUM-379 — Beta RC Smoke Fix Response Lane v0
- **Bezug auf Handoff:** SCRUM-378 (`docs/BETA_RC_TEAM5_HANDOFF_V0.md`)
- **Handoff-Commit:** `c0863c6`
- **Technischer RC-Kandidat:** `main@1e662e9`
- **Erstellt:** 2026-07-01

> **Hinweis (nicht verhandelbar):** Dieses Dokument ist **keine Produktänderung**, **kein Beta-Go** und **kein Deploymentauftrag**. Es beschreibt nur, **wie** Team 1 auf Team-5-Smoke-Funde reagiert, ohne den RC-Kandidaten jetzt fachlich zu verändern.

---

## 1. Zweck

Team 1 bleibt im **RC-Support-Modus**. Dieses Dokument stellt sicher, dass Team 1 nach Team-5-Smoke-Funden **schnell, geordnet und kontrolliert** reagieren kann:

- **RC-Stabilität schützen** — kein Drift vom RC-Kandidaten `1e662e9`.
- **Keine fachliche Änderung ohne Pedi-/Fix-Freigabe.**
- **Kein neues Feature** aus einem Smoke-Fund ableiten.
- Jeder echte Defekt wird zu **genau einem** freigegebenen, minimalen Fix-Slice — kein Ticket-Stapel.

---

## 2. RC-Kontext

- Handoff-Dokument: `docs/BETA_RC_TEAM5_HANDOFF_V0.md` (SCRUM-378).
- RC-Kandidat: `main@1e662e9`.
- Handoff-Commit (aktueller HEAD): `c0863c6`.
- **Team 5** prüft Smoke/Readiness gegen den RC-Kandidaten.
- **Team 1** reagiert **nur** auf konkrete Findings **oder** eine Pedi-Freigabe.
- Der aktuelle RC bleibt **stabil**, bis ein Fix **explizit freigegeben** ist.

---

## 3. Team-5-Fund-Kategorien

| Kategorie | Bedeutung | Beispiel |
|---|---|---|
| **P0** | Smoke blockiert / Kernflow bricht / Datenrisiko / Security-Risiko | App startet nicht, Capture→Review bricht, Datenleck, Auth-Bypass |
| **P1** | Beta-relevant, Smoke nur bedingt möglich, Kernflow stark beeinträchtigt | Review-Entscheidung schlägt sporadisch fehl, Ask liefert falschen Status |
| **P2** | Verbesserung / UX-Reibung, **nicht** blockierend | Unklare Beschriftung, kleiner Layout-Sprung, Wording |
| **Observation** | Hinweis ohne Fixbedarf | „wäre schön wenn…", Notiz zur späteren Prüfung |
| **Out of Scope** | Nicht Team-1-Kern | Deployment, Team 2/3/4/5/6/7, echte Kundendaten, RAG, Local-LLM, Mehrkundenfrage ohne Freigabe |

---

## 4. P0/P1/P2-Reaktionsregel

| Klasse | Reaktion von Team 1 |
|---|---|
| **P0** | **Sofort stoppen.** Pedi + Team 1 informieren. Kein weiterer Smoke auf dem betroffenen Pfad. Fix-Slice **nur** mit expliziter Freigabe. Nach Fix: neue Gates + CI, dann Re-Smoke. |
| **P1** | Priorisieren, prüfen: RC-Fix nötig **oder** Conditional-Go möglich? Fix **nur** als eigener, freigegebener Team-1-Fix-Slice (minimal). |
| **P2** | Dokumentieren. Grundsätzlich **defer / post-RC**. Nur bündeln, wenn Pedi es freigibt. |
| **Observation** | Im Handoff/Review sammeln. **Kein** Fix-Slice. |
| **Out of Scope** | An zuständiges Team / Pedi **zurückgeben**. Team 1 ändert **nichts**. |

---

## 5. Sofort-Fix vs. Defer

**Sofort-Fix nur, wenn ALLE zutreffen:**

- Finding ist **reproduzierbar**.
- **Team-1-Produktkern** betroffen (Capture / Studio / Review / Use / KO-Detail / Library / Ask / Lifecycle / Evidence-Grundpfad).
- Schweregrad **P0 oder P1**.
- Ein **klarer, minimaler** Fix ist möglich.
- **Pedi-/Fix-Freigabe** liegt vor.
- **Keine** neue Architektur, **kein** neues Feature.
- **Keine** Team-fremde Änderung.

**Defer, wenn eines zutrifft:**

- Schweregrad **P2** oder **Observation**.
- Reine Politur / „nice to have".
- Team-5-/Team-6-/Pedi-Entscheidung noch offen.
- Deployment / Serverzugriff / DB-Migration nötig.
- Echte Daten nötig.
- **Feature-Wunsch statt Defekt.**
- RC-Stabilität wäre gefährdet.

---

## 6. Stop-Lines

Team 1 **stoppt und fragt Pedi**, sobald:

- echte Kundendaten nötig wären;
- Secrets auftauchen;
- ein Deployment nötig wäre;
- Serverzugriff nötig wäre;
- eine DB-Migration nötig wäre;
- Local-LLM / RAG / Team-2 nötig wäre;
- Team-3/4/5/6/7-Dateien geändert werden müssten;
- das Finding **nicht reproduzierbar** ist;
- die P0/P1-Klassifizierung **unklar** ist;
- der Fix **größer als ein minimaler RC-Fix** wäre.

---

## 7. Erwartetes Übergabeformat von Team 5 (Finding-Vorlage)

| Feld | Inhalt |
|---|---|
| Finding ID | z. B. `SMK-001` |
| Smoke-Pfad | Nr./Name aus Handoff Abschnitt 4 |
| Schweregrad-Vorschlag | P0 / P1 / P2 / Observation / Out of Scope |
| Repro-Schritte | 1., 2., 3. … (deterministisch) |
| Erwartetes Verhalten | … |
| Tatsächliches Verhalten | … |
| Screenshot/Log-Hinweis | falls vorhanden (keine echten Daten/Secrets) |
| Datenart verwendet | nur Demo/synthetisch? |
| Browser/Umgebung | Browser, Version, OS, lokal/Review |
| Blockiert Smoke? | ja / nein |
| Team-5-Empfehlung | Fix jetzt / defer / zurück an Team X |
| Pedi-Entscheidung nötig? | ja / nein |

> Ein Finding ohne reproduzierbare Repro-Schritte gilt als **nicht fix-fähig** und wird an Team 5 zur Präzisierung zurückgegeben (siehe Stop-Lines).

---

## 8. Mapping Team-5-Finding → Team-1-Fix-Slice

- Jedes echte **P0/P1-Finding** wird in **genau einen** Team-1-Fix-Slice überführt.
- **Kein Ticket-Stapel**, **kein** Sammeln unverbundener Produktwünsche.
- Ein Fix-Slice enthält verbindlich: **Repro**, **Ursache**, **minimalen Fix**, **Regressionstest**, **Gates** (`npm run check` + FE-tsc), **CI**.
- **P2-Findings** werden gesammelt und **deferiert** (post-RC-Bündel nur mit Pedi-Freigabe).
- **Out-of-Scope-Findings** gehen an das zuständige Team / Pedi **zurück** — Team 1 ändert nichts.

---

## 9. Wie Team 1 nach einem Smoke-Fund weiterarbeitet

1. **Team 5** liefert das Finding im erwarteten Format (Abschnitt 7).
2. **Codex** prüft Scope und Team-Zuständigkeit.
3. **Pedi** entscheidet bei P0/P1 oder unklarer Klassifizierung.
4. **Codex** erstellt/aktiviert **genau ein** Fix-SCRUM-Ticket.
5. **Codex** gibt den vollständigen Claude-Prompt im Chat aus.
6. **Claude** setzt den **minimalen** Fix um (Repro → Ursache → minimaler Fix → Regressionstest → Gates).
7. **Codex** prüft Diff/Gates/Security, committed, pusht, prüft CI, aktualisiert Jira.
8. **Team 5** wiederholt den betroffenen Smoke-Pfad (Re-Smoke).

> Rollen bleiben getrennt: **Claude** liefert den fachlichen Fix-Inhalt; **Git/Commit/Push/CI/Jira** macht ausschließlich Codex; **Freigaben/Go** macht Pedi.

---

## 10. Keine Änderung am RC ohne Freigabe

- Der **RC-Kandidat `1e662e9` bleibt stabil**.
- **Keine Produktänderung** ohne **konkretes Finding + Pedi-/Fix-Freigabe**.
- **Keine „bei Gelegenheit"-Verbesserungen** im RC-Support-Modus.
- **Keine neuen Features** aus Smoke-Funden.
- Jede Abweichung von diesen Regeln ist eine **Stop-Line** und geht an Pedi.

---

## 11. Abschluss-Satz

Dieses Dokument definiert die Reaktionsspur von Team 1 auf Team-5-Smoke-Funde. Es verändert den RC nicht, gibt keinen Beta-Go und erlaubt keine Produktänderung ohne explizite Fix-Freigabe.
