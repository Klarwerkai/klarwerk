# Beta RC Team-5 Handoff v0

- **Status:** `technical_rc_candidate_only`
- **Team:** Team 1 / KLARWERK Produktkern / Knowledge OS
- **Jira-Bezug:** SCRUM-378 — Beta RC Team-5 Handoff Pack v0
- **RC-Commit:** `1e662e9`
- **Branch:** `main`
- **Erstellt:** 2026-07-01

> **Hinweis (nicht verhandelbar):** Dies ist **kein finaler Beta-Go**, **keine Kundenfreigabe** und **kein Deploymentauftrag**. Es ist ein technischer RC-Kandidat, den Team 1 an Team 5 übergibt, damit Team 5 Smoke- und Readiness-Prüfungen durchführen kann.

---

## 1. Zweck

Dieses Dokument gibt Team 5 einen klaren Smoke-/Readiness-Startpunkt für den aktuellen sauberen Team-1-Produktstand. Es soll:

- Team 5 einen **eindeutigen, reproduzierbaren Startpunkt** für Smoke/Readiness geben;
- den **Produktumfang des RC-Kandidaten kondensieren**;
- **bekannte Gates und Stop-Lines** sichtbar machen;
- **keine neue Produktentscheidung treffen** und kein Beta-Go präjudizieren.

Team 1 liefert damit den fachlichen/technischen Kontext. Die Bewertung „bereit/nicht bereit" trifft Team 5 (Smoke/Readiness) gemeinsam mit Pedi — nicht dieses Dokument.

---

## 2. RC-Kandidat

| Feld | Wert |
|---|---|
| Branch | `main` |
| RC-Commit | `1e662e9` — `feat(app): app-wide knowledge rescue story for empty states (SCRUM-377, AG-12/AG-13/KG-UX)` |
| GitHub CI (laut Codex-Review) | grün |
| Lokale Gate-Evidence (laut Codex-Review) | `npm run check` grün · FE-tsc (`apps/web` `tsc --noEmit`) grün |
| Arbeitsbaum | sauber bis auf eine bekannte untracked Datei (siehe unten) |

**Bekannte untracked Datei — NICHT anfassen und NICHT Teil des RC-Handoffs:**
`docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md`

Diese Datei ist untracked, gehört nicht zum RC-Kandidaten und wird von diesem Handoff bewusst ausgeklammert. Team 5 sollte sie im Rahmen des RC-Smoke ignorieren.

**Verifikation des Ausgangsstands (read-only, Team 1):**
- `git status -sb` → `## main...github/main` + nur die o. g. untracked Infra-Datei
- `git log --oneline -1` → `1e662e9 feat(app): app-wide knowledge rescue story for empty states (SCRUM-377, …)`

---

## 3. Produktumfang im RC-Kandidaten

Ehrliche Einordnung: Der Team-1-Kernflow **Capture → Studio → Review → Use** ist **beta-nah**, aber **nicht final freigegeben**. Nichts davon ist auto-validiert; Wissen gilt erst nach Team-Prüfung als gesichert.

| Bereich | Stand (beta-nah, nicht final) |
|---|---|
| Capture / Knowledge Input | Erfassung von Erfahrungswissen (Freitext + strukturierte Felder als Progressive Disclosure); geführter Rescue-/Studio-Weg. |
| Knowledge Studio / großer Editor | Fullscreen-Arbeitsraum mit geführter Schritt-Rail, Inhaltsqualität-/Beitragswert-Panel, Vorschau, bewusster Übernahme (kein Auto-Save). |
| AI-assisted Editing / Nachbearbeitung | KI-Hilfe (klarer/strukturieren/erweitern) mit Vorschau und bewusster Übernahme; strukturierte Block-/Abschnitts-Übernahme. |
| Guided / Rescue Story | App-weite ruhige Knowledge-Rescue-Story + Kreis-Einordnung (Erfassen → Validieren → Nutzen → Aktuell halten) in Empty-States. |
| Validation / Review / Rework | Review-Board mit geführter Prüfung, Entscheidungswirkung, Pflicht-Feedback bei Gelb/Rot, Rework-Kontext + Revisions-Rückführung. |
| KO Detail | Status-/Trust-/Nutzbarkeits-Übersicht, Read-Mode, Inline-Bearbeitung, Rework-Banner mit Feedback + Schritten. |
| Library | Suche/Re-Rank, Reife-/Herkunftsfilter, Treffer-Einordnung, ehrliche Leerzustände. |
| Ask mit Quellen / Trust / Gap | Quellengebundene Antworten mit ehrlichem Status (gesichert/ungeprüft/Lücke), Quellen-Readiness, Gap-Erzeugung statt erfundener Antwort. |
| Gap / Risk | Wissenslücken sichtbar, Rescue-Anschluss (Gap → Capture), Phasen-Einordnung. |
| Lifecycle / Revalidation | Fällige Revalidierungen sichtbar, „Aktuell halten"-Phase, Next-Step-Anschluss. |
| Attachment / Evidence (Grundpfad) | Bild-/Datei-Anhänge über Object-Store, sichere Body-Referenzen (interner Raw-Pfad), pro-Datei-Fehlerbehandlung/Recovery. Evidence ≠ Validierung. |

---

## 4. Empfohlene Smoke-Pfade für Team 5

Checkliste (Team 5 füllt Status). **Nur Demo-/synthetische Daten verwenden — keine echten Kundendaten.**

| # | Smoke-Pfad | Erwartung (grob) | Status (Team 5) |
|---|---|---|---|
| 1 | App startet | Frontend lädt ohne Fehler | ☐ |
| 2 | Login / Session | Anmeldung, Session bleibt bestehen, Logout sauber | ☐ |
| 3 | Start / MyTasks | Übersicht + persönliche Aufgaben/Empty-States erscheinen | ☐ |
| 4 | Capture → Knowledge Studio | Studio öffnet aus Capture, geführte Rail sichtbar | ☐ |
| 5 | Freitext / Nachbearbeitung | Freitext erfassen, KI-Nachbearbeitung mit Vorschau/Übernahme | ☐ |
| 6 | Strukturiertes Wissen speichern | KO wird offen erzeugt (trust 0, v1), nicht auto-validiert | ☐ |
| 7 | Validation / Review | KO erscheint im Review-Board, Entscheidung möglich | ☐ |
| 8 | Rework / Feedback | Gelb/Rot mit Pflicht-Feedback → Rework-Kontext beim Autor | ☐ |
| 9 | KO Detail | Status/Trust/Nutzbarkeit + Read/Edit sichtbar | ☐ |
| 10 | Library finden | KO über Suche/Filter auffindbar | ☐ |
| 11 | Ask mit Quellen | Antwort quellengebunden + ehrlicher Status/Trust | ☐ |
| 12 | Gap erzeugen | Unbeantwortbare Frage → Gap statt erfundener Antwort | ☐ |
| 13 | Lifecycle / Revalidation | Fällige Revalidierung sichtbar | ☐ |
| 14 | Datengrenze eingehalten | Nur Demo-/synthetische Daten benutzt | ☐ |

Empfohlene Reihenfolge = Knowledge-OS-Kreis: **Capture → Studio → Review/Rework → Use (Library/Ask) → Lifecycle**.

---

## 5. Testdaten / Datenabgrenzung

Für den RC-Smoke gilt **verbindlich**:

- **Nur Demo-/synthetische Daten** (z. B. über den Admin-„Demodaten laden"-Pfad).
- **Keine echten Kundendaten.**
- **Keine echten Kundendokumente.**
- **Keine personenbezogenen Daten.**
- **Keine Secrets** (Tokens, Schlüssel, Passwörter).
- **Keine produktiven Logs.**
- **Keine produktiven Zugangsdaten.**

Wird für einen Pfad etwas davon nötig, gilt eine **Stop-Line** (Abschnitt 9).

---

## 6. Bekannte Nicht-Ziele (dieser RC-Kandidat beweist NICHT)

- Kein Mehrkunden-/Mandanten-/Tenant-Beweis.
- Kein 100k-Scale-Beweis.
- Kein Penetration-Test.
- Kein Restore-/Disaster-Recovery-Test.
- Kein echter Live-Modellbenchmark (sofern nicht ausdrücklich freigegeben).
- Kein finaler Beta-Go.
- Kein Deployment.
- Kein Serverzugriff.
- Keine Datenbankmigration im Rahmen des Smoke.

---

## 7. Bekannte P0/P1/P2-Gates (ehrlich getrennt)

| Gate | Klasse | Stand | Einordnung |
|---|---|---|---|
| Technischer Team-1-Kern-P0 | P0 | **aktuell nicht bekannt** | Kein offener technischer P0 im Team-1-Kernflow zum RC-Commit. |
| AG-03 — Load / Postgres / `pg_trgm` (10k/100k) | P1 | offen / reduziert | Prefilter + Trigramm-Indizes vorhanden; echter 10k/100k-Lasttest steht aus (Team 5 / Pedi). |
| AG-04 — Live-Modell-Eval (Anti-Halluzination) | P1 | offen / Entscheidung | Repo-lokales Eval-Set grün; echter Live-Modellbenchmark ist Pedi-/Team-5-Entscheidung (kein API-Key im Repo). |
| AG-07 — Penetration-Test | P1 | fehlt | Unabhängiger Security-Review/Pen-Test außerhalb Team-1-Scope. |
| AG-09 — Restore-/DR-Test | P1 | fehlt | Backup dokumentiert; Restore-Übung steht aus. |
| AG-08 — DSAR / Export / Erasure | P1 | scope-abhängig | Abhängig vom Pilot-Scope/Privacy-Grenze; nicht als RC-Blocker behauptet. |
| AG-12 — Gesamt-UX / weniger technisch | P1 | stark verbessert, Abnahme fehlt | Capture/Studio/Empty-States geführt (SCRUM-352/369/370/375/376/377); Usability-/Smoke-Abnahme durch Team 5 steht aus. |
| AG-13 — Story/Onboarding | P1 | stark verbessert, Abnahme fehlt | Rescue-Story app-weit verankert; globales Onboarding/Nav-Ersteinführung bleibt offen. |
| Mandantenfähigkeit / Tenant | — | scope-abhängig | Abhängig vom Pilot-Scope (Single-Pilot vs. Mehrkunden). |
| P2-Reste | P2 | bekannt, kein RC-Blocker | u. a. Object-Orphan-Cleanup nach Attach-Fehler, vollständige §3-Trust-Formel, breiteres Tenant-Thema. **Als bekannte Restpunkte geführt, nicht als Beta-Go-Blocker behauptet.** |

> Diese Tabelle stellt **keine** Freigabe-Bewertung dar. Ob ein Gate Beta-blockierend ist, entscheiden Pedi/Team 5.

---

## 8. Stop-Lines für Team 5

Team 5 **stoppt den Smoke und eskaliert an Pedi/Team 1**, sobald:

- echte Kundendaten nötig wären;
- Secrets auftauchen oder nötig wären;
- ein Deployment nötig wäre;
- Serverzugriff nötig wäre;
- eine Datenbankmigration nötig wäre;
- nicht-synthetische Daten nötig wären;
- ein Live-Modell-Eval ohne ausdrückliche Freigabe nötig wäre;
- ein P0/P1 im Kernflow (Capture → Studio → Review → Use) auftritt;
- die Daten-/Privacy-Abgrenzung unklar wird.

---

## 9. Übergabeformat an Team 5

| Handoff Item | Wert / Referenz | Pflicht für Smoke? | Status | Notiz |
|---|---|---|---|---|
| Repo | `/Users/peterkohnert/Documents/dev_Klarwerk` | ja | bereit | Team-1-Kernrepo |
| Branch | `main` | ja | bereit | — |
| Commit | `1e662e9` | ja | bereit | RC-Kandidat (SCRUM-377) |
| GitHub CI | grün (laut Codex-Review) | ja | bestätigt (Codex) | vor Smoke ggf. erneut prüfen |
| Lokale Gates | `npm run check` grün · FE-tsc grün (laut Codex-Review) | ja | bestätigt (Codex) | reproduzierbar durch Team 5 |
| Smoke-Pfade | Abschnitt 4 | ja | bereit | 14 Pfade als Checkliste |
| Testdaten-Grenze | Abschnitt 5 | ja | bereit | nur Demo/synthetisch |
| Team6-Gaps | Abschnitt 7 + `docs/TEAM6_UPDATE.md` | nein (Kontext) | bereit | AG-03/04/07/08/09/12/13 |
| Stop-Lines | Abschnitt 8 | ja | bereit | Eskalationskriterien |
| Nicht-Ziele | Abschnitt 6 | nein (Kontext) | bereit | Erwartungsklärung |
| Offene Fragen | Abschnitt 10 | ja | offen | für Pedi/Team 5 |

---

## 10. Offene Fragen an Pedi / Team 5

1. Soll Team 5 den Smoke **lokal ausführen** oder **review-basiert** (Codewalk/CI) prüfen?
2. Ist der **Live-Modellmodus** im Smoke **enthalten oder ausgeschlossen**?
3. Welche **Testnutzer/Testdaten** sollen verwendet werden (Rollen, Demo-Seed)?
4. Welcher **Browserumfang** ist für den Smoke maßgeblich (Chrome/Safari/Firefox, Mobile)?
5. Was gilt als **Conditional Go / No-Go** nach dem Smoke (Abnahmekriterien)?
6. Reicht **Single-Pilot** oder wird bereits **Mehrkundenfähigkeit** erwartet?
7. Ist der **10k/100k-Loadtest** ein **Beta-Gate** oder **Post-Beta**?
8. Welche **Daten-/Privacy-Grenze** gilt für den ersten Beta-Test verbindlich?

---

## 11. Abschluss-Satz

Dieses Dokument übergibt einen technischen RC-Kandidaten an Team 5. Es ist kein Beta-Go, keine Kundenfreigabe und kein Deploymentauftrag.
