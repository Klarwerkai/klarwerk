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

## ✅ VERIFIKATION 06.07.2026 (gegen dev_Klarwerk-Repo + Jira-Connector + Git-Log)

**Repo/Jira-Struktur — bestätigt & korrigiert:** Jira hat **7 Projekte**, eines je Team + Nerd:
SCRUM (klarwerk/Produkt), KBB (business-backend), KWEB (public-website), KREL (release-ops),
KGURU (knowledge-guru), KLLM (Local LLM), **KWN (klarwerk-nerd)**. Team 7 (PMO) hat keins.
→ KBB existiert doch (frühere Unsicherheit aufgelöst); Nerd hat eigenes Projekt KWN.
PROJECT_CONTEXT `03_REPOS_UND_ORTE.md` bestätigt die Repo-Karte. **Wichtige Einordnung:** Entscheidung 02.07.
„Alles direkt in der Boss-Session umsetzen … Teams bleiben als logische Tracks/Jira-Präfixe" — d.h. die „Teams"
sind seit Phase 2 primär **Jira-Präfixe/Tracks**, nicht mehr getrennte lebende Agenten.

**C-03/C-04 (Dashboard-Stale) — bestätigt:** KGURU-30 (Team 6, Stand 01.07.) trägt selbst den Satz „Team 2 pausiert".
Das ist die Quelle des Irrtums. Team 2 real **aktiv** (KLLM-62 „To Do", Mac-Studio-Insel, Qwen3-32B 16/24 vs Claude 22/24).

**C-05a (d25e7df) — weitgehend aufgelöst:** Alle 40 jüngsten Commits laufen unter `Peter Kohnert <peterkohnert@mac>`.
`d25e7df` (04.07. 11:49, [Cloud-Worker]) ist ein von Pedi committeter Paul-Liefervorrat — genau der im Entscheidungs-Log
04.07. dokumentierte arbeitsteilige Modus („Paul liefert, Pedi committet bei Runner-Grün"). Git-Autor ist NICHT der
Differenzierer (alle = Pedis Mac). Restfrage bleibt: Session-Zuordnung ist nicht aus Git ableitbar → Prozessthema, kein Fehler.

**C-05b (Freeze) — bestätigt & aktualisiert:** Git-Log: `421b86c` Freeze v1.0.0-beta.1 → `d661c4a` „Freeze aufgehoben,
Paul eigenständig bis Di. 07.07., Pedi committet bei Runner-Grün; kein Push/Tag bis Di., dann v1.0.0-beta.2". Steht so
im Entscheidungs-Log 09_ENTSCHEIDUNGEN.md. **Live aktuell `v1.0.0-beta.1.4`** (SCRUM-464, 06.07.).

**C-06/C-07 (Governance/Commit-Autorität) — aufgelöst:** Modell dokumentiert: Cloud-Worker (Paul) liefert Dateien →
Pedi fährt „KLARWERK Paul Runner" (Gates) → committet bei Grün → Push via Sync/Ship. „Boss committet" (Phase 2) und
„Pedi committet" (Phase 3) sind zeitlich verschiedene Phasen, kein Widerspruch. Codex-Modell galt in den read-only-
Team-Repos (3–6).

**C-08 (Secrets) — bestätigt:** SCRUM-464 belegt GitHub-SSH ok (kein Key-Problem). Key-Rotationsliste existiert
(Commit `843b18f`, 03.07., „Secrets-Rotationsliste, Backup-Vorschlag A+B+C"). SSH-Deploy-Key-Rotation + OpenAI-Key
bleiben als offene To-dos. `.env` gitignored (nur `.env.example`), SSH-Keys in separatem `llm-eval-zugang/` (nie im Repo).

**C-09 (Positionierung) — durch Pedi-Entscheidung aufgelöst:** Entscheidungs-Log 02.07.+03.07.: **„jede Organisation"
verbindlich** (Website UND Demo; Specs nachziehen). Der Specs-Widerspruch ist also eine offene *Doku-Nachzieh-Aufgabe*,
keine offene Richtungsfrage.

**C-10 (Versions-Drift) — bestätigt & erklärt:** Version lebt in `apps/web/src/version.ts`; Schema
`1.0.0-beta.<Freeze>.<Push-Zähler>`. Verlauf 0.9.46 → 0.9.47-beta → 1.0.0-beta.1 → …beta.1.4. Statische Doku (v0.9.22
in Tagesplänen) läuft strukturell hinterher — bekannt, kein Datenfehler.

**SCRUM-463 / SCRUM-464 — verifiziert** (beide To Do; 464 High, am 06.07. per Ship-Skript umgangen, Live aktuell).
**SCRUM-460** Code geliefert (Commit `f4fcc98`), Ticket aber noch „To Do" (Status-Lag; VIP-Wunsch größer als Slice 1).
**SCRUM-434** (PMO-Automatik) „In Review" — bestätigt Team-7-Automatik real.

**Teams-Aktivität (Jira-Update-Daten):** KBB-111, KREL-33, KGURU-30 zuletzt **01.07.** bewegt → Teams 3/5/6 seither
inaktiv. Aktiv bis 05.–06.07.: SCRUM (Paul), KLLM/KWN (Nerd/Insel). Deckt sich mit „Teams im Urlaub, Paul arbeitet weiter".

**Verifikationsgrenze (Stand 06.07., aktualisiert):** Nach Freigabe von `~/Documents/Klarwerk` sind die fünf
Schwester-Repos jetzt direkt prüfbar. Alle drei zusätzlichen Ordner sind inzwischen freigegeben (`Klarwerk/`, `KLARWERK_Reporting_PMO/`, `KLARWERK_AUDIT_EXPORTS/`).

**Lebende PMO-Zahl — verifiziert 06.07. (`pmo-items.json`, Datei-Stand heute 04:39):** 144 Items — 28 done,
34 partially_done, 53 recognized, 5 in_progress, 10 planned, 6 blocked, 5 paused, 2 deferred, 1 archiviert.
P0=13, P1=76, P2=43, P3=12. Beta-relevant (high)=49, davon **19 done (≈39 %)**.
**13 P0 fast alle Team 3 (Legal/Go-No-Go) + Team 5 (RC/Smoke); nur 1 P0 Produktkern** (Beta Core Flow, partially).
→ Berater-These belegt: Beta hängt an Gates/Betrieb, nicht am Funktionskern.

**„paused" präzisiert:** die 5 `paused`-Items sind ALLE Team 2 (u.a. „Non-beta-blocking-Status", „Pausierter Bereich
sichtbar halten") = bewusstes **Beta-Scope-Label** (D-012), NICHT „Team 2 inaktiv". Real entwickelt Team 2 aktiv
(`klarwerk-local-llm`-Commits). Die Dashboard-`app.js` verkürzte das fälschlich zu „Team 2 pausiert".

### Direkt am Repo verifiziert (nach Klarwerk-Freigabe)
- **Team 2 aktiv — bestätigt:** `klarwerk-local-llm/` ist voll bestückt (benchmarks, compose, dashboard, models,
  scripts) mit laufenden „Cloud-Worker PAUL"-Commits (UpCloud-L40S/H100-Eval, vLLM+Qwen3-32B, KLLM-56..60).
  „Pausiert" endgültig widerlegt.
- **C-02 auf Dateiebene bestätigt:** `klarwerk-business-backend/docs/DECISIONS.md` enthält D-001/002/003/004/008/009/012;
  **D-005/006/007/010/011 fehlen** — exakt wie Team 3 gemeldet. Nummerierungslücke real.
- **Weitere Fundstücke im Sammelordner:** `app`+`demo`+`legacy-klarwerk` (Cloudflare-Vorgänger), `open-engine`
  (vermutlich OB1/„Open Brain"-Referenz des Beraters), `tools-sync/` (die `klarwerk-sync.command` aus SCRUM-464),
  `KLARWERK-QM-LOGBUCH.md`, `CURRENT_STATE.md` — bei Bedarf vertiefen.

## Tiefenprüfung 06.07. — After-Report + Berater-Audit gelesen

**Berater-Audit `docs/qm/BERATER_AUDIT_2026-07-03.md` = maßgebliche Tiefenprüfung** (voller Zugriff 03.07., jede
Aussage mit Datei/Zeile/Ticket belegt). Bestätigt unabhängig: 3-Quellen-Drift (Jira/PMO/Doku), K1 Backup/Bus-Faktor,
K2 Gate-Erosion (45 Versionen ohne Sichtabnahme, 1 Block ohne Gate-Lauf), K3 ungetesteter Postgres-Pfad.
After-Report: 334 Einträge, lückenlose Versionsspur v0.9.21→0.9.47→Freeze v1.0.0-beta.1 (03.07.).

### C-13 — Datenhaltung: In-Memory vs. Postgres — ✅ AUFGELÖST (aus Code, 06.07.)
Kein Widerspruch — **umgebungsabhängig** (`build-app.ts`: `DATABASE_URL` gesetzt → `PgXxxRepo`, sonst `InMemory`):
- **Live-Server (Coolify, `app.klarwerk.ai`): Postgres.** `docker-compose.prod.yml` setzt `DATABASE_URL`; Dockerfile:
  „für Server-Betrieb IMMER `DATABASE_URL` setzen", Migration beim Start. = Pauls „Postgres, Daten sicher".
- **Lokale Desktop-App: In-Memory + Journal** (`dev-persist.ts`, append-only JSONL in `.localdb/`, nur bei
  `KLARWERK_DEV_PERSIST=1`). = Berater-Befund auf dem Mac.
- **Echter Restpunkt bleibt K3:** der Postgres-Pfad ist laut Berater/Team 5 nicht durchgängig getestet (nicht alle
  Module haben verifizierte Pg-Adapter). → geht an den künftigen **Systemadministrator** (Pedi-Entscheidung 06.07.).

**Drei Persistenz-Umgebungen (Nerd bestätigt 06.07.):**
| Umgebung | Persistenz | Backup |
|---|---|---|
| Live-Server (Coolify, `app.klarwerk.ai`) | **Postgres** (`DATABASE_URL` gesetzt) | Coolify-Backup (früher erwähnt, DR-Drill offen) |
| Desktop-App (Pedis Mac) | Journal `.localdb/state.jsonl` (`KLARWERK_DEV_PERSIST=1`) | — |
| **Mac-Studio-Insel (VIP)** | **Journal, NICHT Postgres** (Launcher setzt DEV_PERSIST, kein DATABASE_URL) | **KEINS — bei Plattendefekt weg (SPOF, KLLM-70)** |

- **Insel-Befund (Nerd):** Journal übersteht Neustarts, Werksreset möglich; Postgres im Code voll unterstützt, aber
  auf der Insel bewusst nicht aktiviert (VIP-/Demo-Phase). **Backup-Regime + DB-Weg (Homebrew-PG/Container) offen**,
  sinnvoll zusammen mit KLLM-70, wenn Systemadministrator den Dauerbetrieb übernimmt. Nerd bietet an, „Backup + DB-
  Entscheidung Insel" als eigenes Ticket anzulegen → **Pedi-Entscheidung**.

**✅ Paul bestätigt (06.07.) + im Code gegengeprüft — C-13 final geschlossen:**
- **Live = Postgres, belegt.** `server.ts start()`: `DATABASE_URL` gesetzt → Postgres (`migrate()` + echte DB);
  `assertPersistentStore()` (`storage-guard.ts`) **bricht in Produktion fail-loud ab**, wenn weder Postgres noch Journal
  → ohne `DATABASE_URL` würde die Prod-Instanz gar nicht starten. Dass sie läuft + Pedi eingeloggt war = Postgres.
  Vorbehalt: exakter Coolify-Env-Wert + laufende Version (beta.1.4) sind Laufzeit-Config, nicht aus dem Repo prüfbar
  (Health-Endpoint/Coolify-Screen nötig).
- **Prämissen-Korrektur zu Paul:** Compose-Dateien existieren doch (`docker-compose.prod.yml`+`docker-compose.yml`,
  Jun 22/23). ABER Coolify deployt über das **Dockerfile** (present, Jul 5) und injiziert `DATABASE_URL` per
  **Coolify-Laufzeit-Env** — die Compose-Datei ist NICHT die Deploy-Quelle. Pauls operative Aussage stimmt also,
  nur „keine Compose-Datei" ist repo-faktisch falsch (evtl. abweichende Cloud-Arbeitskopie).
- **K3 präzisiert (berechtigt):** `migrate()` legt Schemata ALLER Kernmodule an, `buildPgServices()` verdrahtet je einen
  `Pg…Repo` — kein Adapter hängt in der Luft. ABER nur **ein** Real-Postgres-Integrationstest
  (`services/app/src/build-app.integration.test.ts`, Testcontainers) deckt die Kette Register→Login→KO→Draft→Rating→
  Lifecycle→Audit. **Nicht real gegen PG getestet:** Object-Store, Conflicts/Overlap, Model-Runs, Notifications,
  Assist-Presets, External-Knowledge, Upload-Limits, Candidates, Validation-Settings. Zudem liegt der Test in der
  ausgeschlossenen `test:integration`-Lane (braucht Docker) — der schnelle Runner-Gate fasst echtes Postgres NICHT an.
  → K3 „der Richtung nach berechtigt": Adapter existieren + verdrahtet, ein Teil aber nur laufzeit-erprobt, nicht
  automatisiert real-PG-getestet.
- **Login-Vorfall = Live-Server** (Hetzner/Coolify, Postgres); Ursache **Rate-Limiter-Lockout, KEIN Datenverlust**.

### C-14 — Qwen3-32B: 16/24 vs. 22/24 (Kontext, kein Widerspruch)
- **Berater/KLLM-57:** 22/24 = Claude-Referenzniveau — **mit Denkmodus AUS**, Ø 1,7 s vs. 3,3 s.
- **KLLM-62/Boss (05.07.):** „16/24 auf L40S" = konservativer, dem VIP vorgelegter Wert.
- → Bester Wert 22/24 (thinking off), zitierter Vorsichtswert 16/24. Beim Bericht beide Kontexte nennen.

### Jira-Zahlen: Berater-Tabelle (03.07.) vs. mein Inventar (06.07.)
Berater zählte 03.07.: **676 Tickets, 595 done (88 %)** — SCRUM 438 (378 done, **50 In Review**, 10 To Do),
KLLM 61, KWEB 111, KGURU 32, KREL 34. **KBB und KWN fehlen in der Berater-Tabelle** (existieren aber; KBB-111/KWN-2
per Connector belegt) → vermutlich nach dem Audit angelegt/umbenannt oder vom Berater nicht mitgezählt. Mein
06.07.-Inventar (`jira-inventar.md`): SCRUM ~60 offen (die 50 „In Review" sind Teil davon), KLLM ~24 offen
(inkl. neuer „KLARWERK-Gehirn"-Serie KLLM-63…69), KWN 5, KWEB ~7, KREL 1, KBB/KGURU 0.

### Strategische Neuentdeckung — „KLARWERK-Gehirn" (KLLM-63…69)
Die Berater-Wissensschicht ist als eigene Ticketserie gestartet: modellunabhängige Wissens-/Gedächtnisschicht
(PoC → lokale Embedding-Schicht bge-m3+Vektor-Store → signierter USB-Sync → Interaktionsgedächtnis → MCP-Zugriffsschicht
→ KI-Arbeitsgruppe). Konzept: `docs/qm/BERATER_KONZEPT_WISSENSSCHICHT_KLARWERK-GEHIRN_2026-07-05.md`. Berater-Kernwarnung
bleibt: **das Embedding-Modell (bge-m3) ist die einzige NICHT frei tauschbare Modellkomponente** — Zielkonflikt mit
„modellunabhängig".

## Muster über Teams hinweg
- **Snapshot-Drift** in `TEAM6_UPDATE.md`: sowohl Team 1 als auch Team 3 berichten, dass Snapshot-/Commit-Zeilen
  dem echten HEAD hinterherlaufen oder „pending" bleiben. → `TEAM6_UPDATE.md`-Angaben immer gegen `git log` prüfen.
- **Rollentrennung identisch:** In beiden Repos gilt: Claude = Executor (Text/Code), **Codex** = Git/Jira/Verify,
  **Pedi** = alle materiellen Freigaben.
