# Widersprüche & Auffälligkeiten

Widersprüchliche oder auffällige Aussagen zwischen Agenten/Quellen. Zu klären / gegen Repo+Jira prüfen.

## C-01 — Mehrere getrennte Repos & Jira-Projekte (Multi-Repo-Struktur)
Zentrale Struktur-Erkenntnis (kein echter Widerspruch): KLARWERK ist auf **mehrere Repos + Jira-Projekte** verteilt.
Jedes Team pflegt ein eigenes `docs/TEAM6_UPDATE.md`. Beim Zwischenbericht sauber trennen.

| Team | Repo | Remote | Jira | Domäne |
|------|------|--------|------|--------|
| Team 1 | `dev_Klarwerk` | `Klarwerkai/klarwerk` | `SCRUM` | Produktkern / Knowledge OS |
| Team 3 | `klarwerk-business-backend` | `Klarwerkai/klarwerk-business-backend` | `KBB` | Business/Pilot-Blueprint (nur Doku) |
| Team 4 | `klarwerk-public-website` | `Klarwerkai/klarwerk-public-website` | `KWEB` | Öffentliche Marketing-Website |
| Team 5 | `klarwerk-release-ops` | `Klarwerkai/klarwerk-release-ops` | `KREL` | Release Ops / Beta QA / Deployment Readiness |
| Team 6 | `klarwerk-knowledge-guru` | (Klarwerkai) | `KGURU` | Gap-Kontrolle / Pflichtenheft (read-only Zweitprüfung) |
| Team 7 | `KLARWERK_Reporting_PMO` (lokal, **kein Git/Jira**) | — | — | Reporting-PMO / Dashboard (nur lokal, read-only Aggregation) |
| Team 2 / Nerd | `dev_Klarwerk` (Produkt) + Mac-Studio-Insel | `Klarwerkai/klarwerk` + Gitea | `KLLM` (+ `KWN`) | Local LLM / On-Prem-Insel (MLX Qwen3-32B, Ollama, air-gapped) |

**Team 2 (Local LLM) und Nerd (Mac Studio) gehören zusammen:** Team 2 = LLM-Eval/Anbindung (App-Seite, SCRUM-424 +
KLLM), Nerd = Betrieb der air-gapped Insel auf dem Mac Studio (KLLM-61/62/70–73, KWN-2/3). Beide nutzen das
Produkt-Repo `dev_Klarwerk`. Jira-Projekt `KLLM` (+ `KWN`-Referenzen). Damit sind **6 Jira-Projekte** bekannt:
SCRUM, KBB, KWEB, KREL, KGURU, KLLM (Berater bestätigte 5 davon per API; KLLM/KWN kommen über Nerd/Berater dazu).

Team 7 aggregiert read-only aus 8 Quellen (die `TEAM6_UPDATE.md` von Team 1/3/4/5 + 4 Team-6-Docs + Master-Scope-JSON)
und exportiert eine Review-Queue an Team 6. Team 6 bleibt „Quelle der Wahrheit".

**Korrektur einer früheren Annahme:** Team 6 hat sehr wohl ein **eigenes Repo** (`klarwerk-knowledge-guru`) mit
eigenen lebenden Registern. Die `docs/TEAM6_UPDATE.md`-Dateien in den anderen Repos sind nur Eingangskanal —
Team 6 wertet sie ausdrücklich **nur als Eigenangabe, nicht als Beleg**; verbindlich sind Team-6-eigene Register
und geprüfte fixe Commits (`git show`).

## C-02 — Fehlende Decision-Log-Einträge (Team 3)
- D-010 (Legal/DPA) und D-011 (Commercial/Billing) werden in Beta-Docs durchgängig referenziert, fehlen aber
  als Einträge in `docs/DECISIONS.md`. Auch D-005/006/007 fehlen (Nummerierungslücke).
- Status: **von Team 3 selbst als Widerspruch gemeldet.** Zu verifizieren + ggf. Nachtrag (nur Pedi/Codex).

## C-03 — „Team 2 pausiert" ist FALSCH (veraltete Dashboard-Quelle)
- Team 3 (D-012) und Team 6 melden Team 2 als „pausiert / nicht beta-blockierend".
- **Boss-Korrektur (2026-07-06):** Team 2 (Local LLM) war einer der **aktivsten** Tracks — UpCloud-L40S-Eval,
  „KLARWERK LLM"-App, zweites KI-Backend (SCRUM-424), Mac-Studio-Insel KWN-2 (KLLM-62).
- **Ursache:** hartkodierte Beispiel-Konfig in `app.js` des PMO-Dashboards (~30.06.), nie nachgeführt.
- **Lektion:** Dashboard-Anzeigetexte sind keine Quelle der Wahrheit.

## C-04 — Readiness-Zahlen „45 % / 13 P0 / Trend ▼" veraltet
- Aus derselben `app.js`-Beispielquelle. **Lebende Ist-Zahl:** `data/pmo-items.json`, Stand 03.07.:
  **144 Items, 29 done, 33 partially; beta-relevant 20/49 done.**
- Boss + Berater haben diesen Fehler **zweimal** geflaggt. Verifikation immer gegen `pmo-items.json` + Git-Log +
  After-Report, nie gegen Dashboard-Texte.

## C-05 — Steuerungsebene: ungeklärte Git-Identität & fehlende Mandate
- **(a)** Commit `d25e7df` (04.07. 11:49) von unbekannter lokaler Session unter Pedis Git-Identität — ungeklärt,
  wer auf dem Mac committen darf.
- **(b)** Freeze `v1.0.0-beta.1` (03.07.) wurde 04.07. aufgehoben, bevor Boss-Rückfrage beantwortet war
  (formal sauber, aber Doku lief hinterher).
- **(c)** Mandate für „Assistent" (mich) und „Nerd" nicht als Pedi-Entscheidung im Entscheidungs-Log →
  Wiederholungsrisiko des `d25e7df`-Musters. **Empfehlung: ins Entscheidungs-Log aufnehmen.**

## C-06 — Wer ist Paul? Governance- vs. reine Umsetzungsrolle
- **Pedis Ausgangsbeschreibung** + mein erster Prompt: „Paul übernimmt zurzeit die Aufgaben von The Boss".
- **Boss-Auskunft:** „Paul baut, Boss prüft/committet/verwaltet, Pedi entscheidet".
- **Paul selbst (2026-07-06):** ausdrücklich **keine Governance** — reine Cloud-Implementierungs-Session; **Pedi**
  fährt das Gate (Runner→Commit→Push→Deploy).
- → Kein harter Widerspruch, aber die „Paul = Boss-Vertreter"-Lesart ist **zu weit**. Paul = Umsetzer, Steuerung bleibt
  bei Boss/Pedi. **Für Zwischenbericht sauber trennen.**

## C-07 — Wer darf committen/pushen? (verknüpft mit C-05a)
Drei Aussagen zur Commit-/Push-Autorität:
- **Teams 1–7:** „Codex committet/pusht" (in den jeweiligen Team-Repos).
- **Boss:** „Boss prüft/committet/verwaltet" (Phase 3).
- **Paul:** „Pedi fährt das Gate (Commit→Push→Deploy)"; Push nur über „KLARWERK Sync".
- **Realitäts-Bug (SCRUM-464):** „KLARWERK Sync" pusht nur nach **Gitea, nicht GitHub** → Coolify baute alte Commits;
  Ship-Skript pusht jetzt interim selbst nach GitHub (Regelabweichung). Erklärt auch Team 1s Dual-Remote (`github`+`origin`/Gitea).
- **Offen:** der ungeklärte Commit `d25e7df` (C-05a) passt in genau diese Lücke — Commit-Autorität auf dem Mac ist
  nicht eindeutig geregelt. **Klärungsbedarf hoch.**

## C-08 — Zweiter Secret-Exposure-Vorfall
- Team 7: OpenAI-Key früher im Chat eingefügt → Rotation empfohlen.
- Paul: privater **SSH-Deploy-Key** bei Coolify-Setup im Chat sichtbar → Rotation offen.
- → Muster: wiederkehrende Key-Exposures im Chat. **Sicherheits-Sammelpunkt für Boss/Pedi.**

## C-09 — Positionierung: „Industrie" vs. „jede Organisation"
- Berater: Specs positionieren KLARWERK als **Industrie** (industrielles Erfahrungswissen); Website/Kurs sprechen von
  **„jede Organisation"**. Deckt sich mit Team-4-Charter („Enterprise Knowledge OS für industrielles Erfahrungswissen").
- → Strategische Positionierungsfrage für Boss/Pedi.

## C-10 — Versions-/Dashboard-Drift (unabhängig durch Berater bestätigt)
- Doku **v0.9.22** vs. Code **v0.9.45**; PMO-Dashboard „Beta ~35 %"; „Team 2 pausiert" trotz Eval-Erfolg.
- Bestätigt C-03/C-04 aus zweiter, unabhängiger Quelle. **Muster: statische Doku/Dashboard-Texte laufen dem Code
  strukturell hinterher.** (Paul nannte separat live `v1.0.0-beta.1.x` — d.h. es gibt mehrere Versionsschemata:
  interne 0.9.x-Zählung vs. öffentliche 1.0.0-beta.)

## C-11 — Empfehlung ↔ gebaut: Prüfrecht fremder Beiträge
- Berater empfahl Vier-Augen-Prüfung (Experte prüft fremde Beiträge, B2-9); **real gebaut:** Prüfen bleibt
  Controller/Admin (Pauls P-3-Antwort). Berater hat Doku an Realität angepasst.
- → Beispiel dafür, dass Empfehlungen nicht 1:1 umgesetzt wurden; bei Feature-Fragen immer Code/Paul-Antwort > Konzept.

## C-12 — Trust=100 vs. TRUST_MAX 99
- Alt-Tests nutzten Trust=100; nachträglich TRUST_MAX **99** eingeführt (SCRUM-359, Team-1-Deckel). Alt-Tests/Doku
  können noch 100 annehmen. Bei Verifikation beachten.

## Muster über Teams hinweg
- **Snapshot-Drift** in `TEAM6_UPDATE.md`: sowohl Team 1 als auch Team 3 berichten, dass Snapshot-/Commit-Zeilen
  dem echten HEAD hinterherlaufen oder „pending" bleiben. → `TEAM6_UPDATE.md`-Angaben immer gegen `git log` prüfen.
- **Rollentrennung identisch:** In beiden Repos gilt: Claude = Executor (Text/Code), **Codex** = Git/Jira/Verify,
  **Pedi** = alle materiellen Freigaben.
