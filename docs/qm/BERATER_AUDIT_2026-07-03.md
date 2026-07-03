# BERATER-AUDIT KLARWERK — 03.07.2026

**Auftraggeber:** Pedi (einziger Stakeholder) · **Prüfer:** externer, unabhängiger Projekt-Berater (Claude-Session, nur lesend)
**Prüfgegenstand:** Gesamtprojekt KLARWERK — App (`dev_Klarwerk`), Jira (SCRUM/KLLM/KWEB/KGURU/KREL), Nebenrepos (`Klarwerk/*`), Reporting-PMO, Vorgängerprojekt ARGUS
**Bezugsstand:** Dateistand vom 03.07.2026 abends (App-Version `0.9.45-beta`, `apps/web/src/version.ts`; letzter Gate-Lauf 03.07. 21:36 Uhr: `tools/check` grün mit **232 Testdateien / 1.382 Tests**, `smoke:ui` 4/4 — `docs/team2-austausch/paul-runner.log`). Das Projekt bewegte sich während der Prüfung weiter; einzelne Zahlen können morgen bereits überholt sein.
**Methode & Grenzen:** Vollständige Lektüre von PROJECT_CONTEXT 00–12, CLAUDE.md, Boss-Stand, After-Report (10.874 Zeilen), Auswertung aller **676 Jira-Tickets** über die API, PMO-Datenbasis (144 Items), Prüfstand-Ergebnisse, Git-Historie (Reflog, 22.06.–03.07.), Code-Stichproben in `services/`, `apps/web/`, `tests/`, Vergleich mit ARGUS und den Specs. **Nicht** möglich waren: eigene Gate-Läufe auf dem Mac, Klick-Tests der laufenden App, Einsicht in Schlüsselbund/Keys (richtig so), Inhalte hinter Basic-Auth (Website-Preview). Jede Kernaussage trägt einen Beleg (Datei, Zeile „Z.", Ticket oder Commit).

---

## 1 · Management-Summary (für Pedi)

KLARWERK ist in **elf Tagen** (22.06.–03.07.) von null auf eine funktional geschlossene Beta-App gewachsen — mit einer Disziplin, die ich in Projekten mit zehnköpfigen Teams selten sehe: 1.382 automatisierte Tests, eine erzwungene Rechte-Matrix über alle 80+ API-Routen, ein lückenloses Projektgedächtnis und eine Ehrlichkeitskultur („lieber Wissenslücke als erfundene Antwort"), die sich durch Produkt, Doku und sogar Fehlerberichte zieht. Der lokale LLM-Track hat am 03.07. bewiesen, dass ein eigenes Modell (Qwen3-32B) die Claude-Referenz im Prüfstand erreicht (22/24 Punkte bei halber Antwortzeit) — das On-Premises-Versprechen ist damit technisch untermauert.

**Aber:** Das Tempo hat drei stille Schulden aufgebaut, die nicht im Code sichtbar sind. **Erstens:** Alles hängt an einem einzigen Mac und an dir — der PMO-Ordner (Projektsteuerung, bewusst ohne Git) und der SSH-Schlüssel existieren **nur dort**, ein geprüftes Backup gibt es nicht; ein Hardware-Defekt wäre der teuerste anzunehmende Unfall des Projekts. **Zweitens:** Die Qualitäts-Gates sind zuletzt weicher geworden — am 02./03.07. wurden 45 Versionsstände erzeugt, von denen keiner deine Sichtabnahme durchlaufen hat, ein Block wurde ausdrücklich ohne Gate-Lauf geliefert, und der Produktionspfad (Postgres statt Arbeitsspeicher) ist **noch nie** getestet worden. **Drittens:** Die drei Wahrheitsquellen — Jira, PMO-Dashboard, Projekt-Doku — erzählen inzwischen drei verschiedene Stände (Jira führt erledigte LLM-Arbeit als „To Do", das PMO meldet „Beta ~35 %, Trend verschlechtert", die Doku nennt v0.9.22 statt v0.9.45).

**Für den VIP-Termin am 05.07. ist die App inhaltlich bereit** — der Leitfaden von Paul ist gut. Was den Termin gefährden kann, sind nicht fehlende Features, sondern ein ungetesteter Tagesstand und veraltete Zahlen im Sprechtext. Meine dringendste Empfehlung: **Jetzt einfrieren** (kein neues Feature vor dem Termin), morgen eine Generalprobe auf exakt diesem Stand, und parallel die zwei Stunden investieren, die ein echtes Backup von PMO-Ordner und Schlüsseln kostet. Alles Weitere — Postgres-Nachweis, DSGVO-Paket, Sicherheits-Härtung — gehört in die zwei Wochen nach dem Termin, **bevor** der erste echte Pilotkunde Daten anfasst.

---

## 2 · Ist-Zustand kompakt

**Produkt (Team 1, `dev_Klarwerk`):** Modularer Monolith (19 Fastify-Module unter `services/`, React-Frontend `apps/web/`), Kernkreislauf Erfassen → Studio → Validierung → Bibliothek → Fragen vollständig verdrahtet (Funktions-Audit 02.07.: „alle 18 Seiten echte Seiten, kein Button ohne Funktion" — `docs/qm/APP_FUNKTIONS_AUDIT_2026-07-02.md`). Version `0.9.45-beta`; Gates zuletzt grün (232 Dateien/1.382 Tests, smoke:ui 4/4, 03.07. 21:36). Datenhaltung im Beta-Betrieb: **In-Memory + lokales Dev-Journal** (`services/app/src/dev-persist.ts`); Postgres-Adapter existieren für einen Teil der Module, sind aber ungeprüft (s. Befund K3). KI-Schicht anbieteragnostisch: Anthropic-Cloud, seit SCRUM-424 zusätzlich lokaler OpenAI-kompatibler Provider, deterministischer Fallback ehrlich gekennzeichnet.

**Arbeitsweise:** Extremes, dokumentiertes Tempo — 412 Reflog-Einträge in 12 Tagen, Spitzen 62 Commits (28.06.) und 70 Commits (02.07.); Testwachstum ~106 → 1.382 in 9 Tagen (After-Report-Kurve, Details Anhang A3). Rollenmodell: Pedi (Entscheidung, Abnahme, Push via Sync-App, Keys), Boss-Session (Koordination, Commits), seit 03.07. Cloud-Worker „Paul" (Umsetzung) mit Mac-Gate über die „Paul Runner"-App. Onboarding-/Gedächtnisschicht `PROJECT_CONTEXT/00–12` seit 03.07. — inhaltlich stark, einzelne Statusangaben bereits überholt.

**Jira (Stand 03.07. abends, per API gezählt):**

| Projekt | Tickets | Done | In Review | To Do | Blocked |
|---|---|---|---|---|---|
| SCRUM (App) | 438 | 378 | **50** | 10 | — |
| KLLM (LLM-Server) | 61 | 48 | — | 9 | 4 |
| KWEB (Website) | 111 | 104 | 4 | 3 | — |
| KGURU (Register) | 32 | 32 | — | — | — |
| KREL (Release) | 34 | 33 | — | 1 | — |
| **Summe** | **676** | **595 (88 %)** | 54 | 23 | 4 |

Auffällig: 50 SCRUM-Tickets warten gesammelt auf Pedi-Sichtabnahme (alle 02./03.07.); die KLLM-Karten 55–61 stehen auf „To Do", obwohl Phase 0 und Eval-Sitzung 1 nachweislich erledigt sind (Belege in Befund H5).

**PMO (Team 7, `KLARWERK_Reporting_PMO`, bewusst ohne Git):** 144 Items — 29 done, 33 partially_done, 53 recognized, 10 planned, 6 blocked, 5 paused, 5 in_progress, 2 deferred, 1 archiviert (`data/pmo-items.json`). Der automatische Status-Snapshot (03.07. 10:31) schätzt „Beta-Readiness ~35 %, Trend verschlechtert" — er liest aber veraltete Quelldateien (TEAM6_UPDATE der Teams, Team-1-Stand vom 01.07.) und führt Team 2 als „pausiert", am selben Tag, an dem Team 2 seinen größten Erfolg hatte. Die PMO-Zahlen sind als Schätzungen gekennzeichnet (README), werden aber durch die veralteten Quellen aktuell eher irreführend als orientierend.

**Team 2 / lokaler LLM:** Eval-Sitzung 1 am 03.07. erfolgreich: Qwen3-32B-AWQ auf UpCloud L40S erreicht **22/24 Punkte = Referenzniveau** (claude-sonnet-4-6: 22/24) bei Ø 1,7 s (Referenz 3,3 s), alle drei „Ehrlich-passen"-Fälle bestanden — Bedingung: Denkmodus aus (`docs/team2-austausch/KLLM-57-AUSWERTUNG-GERUEST.md`, `reports/pruefstand-latest.md`). Kosten der Sitzung ≈ 2,22 € aus Gratis-Credits (Verfall ~01.08.). Entscheidungsbrief-Entwurf (KLLM-59) liegt vor; Sitzung 2 (14B/Mistral) und App-Anbindung (KLLM-61) offen. Lehrgeld dokumentiert: manueller 50-GB-Deploy kostete den Vormittag.

**Website (Team 4):** Astro-5-Neubau (15 Seiten DE/EN) mit neuer Positionierung „Knowledge Continuity — für jede Organisation" (KWEB-108), KO-Rotation im Hero (KWEB-107), Video-Pipeline vorbereitet (KWEB-106/109–111). Preview auf Hetzner hinter Basic-Auth, noindex; **kein Livegang, Deploy der neuesten Stände durch Pedi ausstehend** (KWEB-104/106/107/108 In Review). `klarwerk.ai` und `app.klarwerk.ai` antworten von außen mit restriktiver robots.txt — konsistent zum Pre-Launch-Schutz.

**ARGUS (Vorgänger):** Diente als Konzept- und UI-Sollbild. Das Pflichtenheft wurde **byte-identisch** in `dev_Klarwerk/specs/reference/` übernommen (diff-verifiziert); der Cloudflare/D1-Stack der Alt-App wurde bewusst verworfen (On-Premises-Anforderung, `MEILENSTEIN-FAZIT.md` §3). Noch nutzbare Reste: Investor-Deck-Material (mit Auflage, Fantasie-Kennzahlen als Projektionen zu kennzeichnen), ~82 Beispiel-Wissensobjekte, Lookbook, Video-Assets. Altlasten: Klartext-Zugangsdaten in `ARGUS/PROJEKT-DOKUMENTATION.md`, laut Projekt-Handbuch §8 nicht rotierte Alt-Keys, `CHANGELOG.md` ist versehentlich der react-router-Changelog.

**Sicherheits-/Datenschutz-Doku:** Ungewöhnlich ehrlich („PARTIAL"-Kultur): Backup-Runbook sagt selbst, dass kein Restore-Drill stattfand; DSGVO-Doku benennt offene Betreiberpflichten (AVV, DSFA, Fristen, Self-Service-Rechte) klar als offen (`docs/operations/backup-disaster-recovery.md`, `docs/compliance/*`).

---

## 3 · Stärken (bewusst kurz — sie tragen das Projekt)

1. **Gate-Architektur mit Zähnen:** `tools/check` (Build · Lint · dependency-cruiser · 1.382 Tests) + Playwright-Smoke; die Guard-Matrix (`tests/security/routeGuardAudit.ts`) **erzwingt** einen Rechte-Eintrag für jede API-Route — ein neuer Endpunkt ohne Guard bricht den Lauf. Das ist Enterprise-Niveau.
2. **Ehrlichkeit als Systemeigenschaft:** deterministischer Fallback statt Schein-KI, „Wissenslücke" statt Halluzination, G-2-Belegstellenpflicht bei Dokument-Extraktion, ehrliche Leerzustände — konsistent von Spec (G-1…G-10) bis Code und Prüfstand („Ehrlich-passen"-Fälle).
3. **Projektgedächtnis:** After-Report (jede Aufgabe mit Was/Warum/Beweis/Offen), PROJECT_CONTEXT 00–12, Entscheidungs-Log mit Begründungen — eine neue Session/Person kann in Stunden produktiv werden. Fehler werden als „Harness-Korrektur" in Dauerregeln überführt (z. B. Pauls widerrufene Schein-Grün-Prüfung, Z. 10390).
4. **Bedienbarkeit für den Nicht-Techniker:** Schreibtisch-Apps mit Schlüsselbund-Integration, sichtbarem Terminal-Fortschritt, Selbstheilung (Key-Dialog bei 401) — der Stakeholder braucht kein Terminal. Konsequent durchgezogen bis zum Paul-Runner.
5. **Team-2-Beweis:** Der Prüfstand (12 deutsche Fälle inkl. Ehrlichkeits-K.-o.) ist ein echtes, wiederverwendbares Mess-Asset; das Eval-Ergebnis macht die On-Prem-Story glaubwürdig und beziffert sie (~0,52 €/1.000 Aufgaben GPU-Zeit).
6. **Saubere Architekturbasis:** Modul-Grenzen per dependency-cruiser erzwungen, Repos austauschbar (In-Memory/Pg), KI hinter `ModelClient`-Abstraktion — die teuren Architekturfehler früher Startups (Spaghetti, Vendor-Lock im Kern) sind hier vermieden.

---

## 4 · Schwachstellen nach Schweregrad

> Maßstab: Was gefährdet Beta-Erfolg und erste Kunden wirklich. Jeder Punkt: **Beleg → konkreter Fix → Aufwand**. Aufwände in Stunden (h) bzw. Tagen (T), konservativ geschätzt für eine Claude-Session + Pedi-Klicks.

### 🔴 KRITISCH

**K1 · Kein geprüftes Backup für die einzigen unversionierten Kernbestände (PMO-Ordner, Schlüssel).**
Der PMO-Ordner (144 Steuerungs-Items, Prüfstand-Historie, Audit-Log — „bewusst OHNE Git") und der SSH-Schlüssel `Klarwerk/llm-eval-zugang/` existieren nur auf einem einzigen Mac. Die eigene Doku benennt das Risiko („Ohne Backup wären sie bei einem Mac-Defekt verloren … der PMO-Ordner ist es NICHT [neu erzeugbar]" — `PROJECT_CONTEXT/10_GLOSSAR_UND_KONTEN.md` §Sicherung), verlässt sich aber auf ein unbestätigtes Time Machine. Die `data/backups/`-Kopien liegen **im selben Ordner auf derselben Platte** — sie schützen vor Fehlbedienung, nicht vor Defekt/Diebstahl/Ransomware. Das Backup-Runbook selbst: „produktiver Restore-Drill bleibt offene Aufgabe" (`docs/operations/backup-disaster-recovery.md`, Kopfnote). Auch der Code-Push-Weg hatte zeitweise ~350 ungesicherte lokale Commits (`docs/qm/BOSS_SESSION_STAND_2026-07-02.md` §1).
→ **Fix:** Heute: PMO-Ordner + `llm-eval-zugang` als verschlüsseltes Archiv auf ein externes Medium UND einen zweiten Ort (z. B. verschlüsselt in iCloud/USB); Time-Machine-Status verifizieren; danach als Schreibtisch-App „KLARWERK Backup" (wöchentlich, mit ✓/FEHLER) institutionalisieren; einmal Restore-Probe. **Aufwand: 2–4 h.**

**K2 · Gate-Erosion in der Schlussphase: Lieferungen ohne (protokollierten) Grün-Lauf.**
Die eigene oberste Regel („Nur ein grüner tools/check-Lauf erlaubt den nächsten Schritt", CLAUDE.md) wurde am 02./03.07. mehrfach gedehnt: ein kompletter Fünf-Ticket-Block wurde mit „**Gates stehen AUS** (niemand am Mac)" geliefert (After-Report Z. 10358–10360, v0.9.24–0.9.28); eine Cloud-Vorprüfung meldete Grün, obwohl sie nachweislich nichts prüfte (ehrlich widerrufen, Z. 10390); Runner-Lauf v15 war rot (Z. 10695); für mehrere Runner-Versionen fehlt das protokollierte Ergebnis. 45 Versionsstände (0.9.0→0.9.45) entstanden an zwei Tagen ohne eine einzige Pedi-Sichtabnahme dazwischen; der angekündigte RC-Freeze ist bis heute nicht vollzogen (Z. 10122, 10240). Der Lauf von heute 21:36 ist grün — akut ist der Bestand also in Ordnung; das **Prozessrisiko** bleibt: rote/ungeprüfte Stände können unbemerkt zum „lieferbaren Bestand" werden — zwei Tage vor einem VIP-Termin.
→ **Fix:** (a) Sofort Feature-Stopp + Freeze auf dem grünen 21:36-Stand; (b) Dauerregel: **kein Versions-Bump ohne im After-Report zitierte Runner-Schlusszeile** (Datum/Uhrzeit/Testzahl); (c) Runner hängt seine Schlusszeile automatisch an den After-Report an (kleine Erweiterung von Schritt 4). **Aufwand: Regel sofort; Runner-Erweiterung ~1 h.**

**K3 · Der Produktionspfad (Postgres) ist ungeprüft — Beta-Deploy würde auf unverifiziertem Fundament landen.**
Alle Gate-Läufe testen In-Memory/Fake-Pool; `npm run test:integration` (Testcontainers/echtes Postgres) ist **in der gesamten Projektgeschichte nie gelaufen** — Sandbox kann nicht (kein Docker), auf dem Mac wurde es nie nachgeholt, und die GitHub-CI führt es ebenfalls nicht aus (`.github/workflows/ci.yml` ruft nur build/lint/arch/test). Belege: Ist-Analyse 01.07. §2 „4b nicht ausführbar … muss lokal auf dem Mac laufen" (`docs/qm/IST_ANALYSE_DEV_KLARWERK_2026-07-01.md`); durchgängige After-Report-Restlücken „kein Testcontainers-Lauf in dieser Umgebung" (Z. 2154, 8893, 8945); selbst benanntes Migrationsrisiko `CREATE EXTENSION pg_trgm` (Z. 9082). Inzwischen hängen 13+ Tabellen-Schemas, Papierkorb, Seen-Status, Upload-Limits u. a. an diesem nie ausgeführten Pfad.
→ **Fix:** Einmal auf dem Mac (Docker Desktop): `npm run test:integration` — Ergebnis in After-Report + Jira; Job zusätzlich in die GitHub-CI (Postgres-Service-Container). Vor dem ersten Coolify-Deploy: Migrations- + Backup-/Restore-Drill gegen echtes Postgres (steht bereits als Fahrplan-Schritt 4 im Boss-Stand §3 — er muss nur stattfinden). **Aufwand: ½–1 T inkl. Fixes.**

**K4 · Bus-Faktor 1 — und zwar doppelt: Pedi UND die Session-Konstruktion.**
Pedi ist einziger Inhaber von Push (Sync-App), allen Keys/Konten (Anthropic, UpCloud, GitHub, Jira, Domain), Abnahmen und Außenkommunikation (`PROJECT_CONTEXT/10` Konten-Tabelle). Zusätzlich zeigt der 03.07. eine zweite Abhängigkeit: das Wochenbudget der Boss-Session war zu ~90 % verbraucht, worauf die inhaltliche Arbeit komplett auf Paul verlagert wurde (`04_AKTUELLER_STAND.md`, Nachtrag) — fällt eine Session aus (Budget/Kontext), hängt die Koordination an einer einzigen Datei-Brücke. Das Projekt hat das Risiko selbst erkannt (PMO-RISK-0001, After-Report Z. 9897), aber kein Notfall-Runbook.
→ **Fix:** Eine Seite „Notfallkarte" nach `PROJECT_CONTEXT/`: Was tun, wenn (a) der Mac ausfällt (Repos von GitHub, PMO aus Backup K1, Schlüssel neu erzeugen), (b) eine Claude-Session wegfällt (Faden-Ritual existiert bereits — um PMO/Brücke ergänzen), (c) Pedi ausfällt (Zugangs-Hinterlegung für Vertrauensperson). Zweiten Jira-/GitHub-Admin (Vertrauensperson) einladen. **Aufwand: 2–3 h.**

### 🟠 HOCH

**H1 · Beta-Datenhaltung = In-Memory + Dev-Journal: für den VIP-Test okay, für echte Nutzer nicht.**
Der lokale Betrieb rettet Daten über Neustarts per Journal (`services/app/src/dev-persist.ts`, `KLARWERK_DEV_PERSIST=1` im Desktop-Starter). Verifizierte Eigenschaften: Das Journal wird per `appendFileSync` **ohne `fsync`** geschrieben — bei Stromausfall drohen zerrissene Writes, und ein Torn-Write **mitten** im Journal verwirft ab dort alle folgenden gültigen Einträge (stiller Verlust). Es wächst **monoton, ohne Kompaktierung** (ehrlich als Folge-Ticket markiert, Z. 10012); **jeder Datei-Upload landet als Base64 komplett im Journal** und wird bei jedem Start vollständig in den RAM zurückgespielt (Start-Zeit/Speicher O(n)). Die `MUTATING_METHODS`-Liste muss bei jeder neuen Repo-Methode von Hand gepflegt werden — ein vergessener Eintrag journalisiert stillschweigend nicht (Datenverlust ohne Test-Rotwerdung; der Test prüft nur, dass jedes *Repo* vertreten ist, nicht jede Methode). Mehrbenutzer-Gleichzeitigkeit ist ungetestet und im Code Last-Write-Wins ohne Versions-/ETag-Prüfung → **Lost Update** bei zwei gleichzeitigen Kommentar-/Anhang-Adds an derselben Karte (`knowledge-object/src/service.ts`, Details Anhang B).
→ **Fix:** Für Beta mit >1 realem Nutzer: Postgres-Betrieb aktivieren (nach K3), Journal nur noch als Dev-Komfort; `fsync` + periodische Snapshot-Kompaktierung; Objekt-Blobs aus dem Journal auf Disk auslagern; Test „jede Mutationsmethode gelistet"; ein E2E-Test „zwei Nutzer, gleiche Ressource" + optimistische Sperre auf `version`. **Aufwand: 1–2 T (nach K3).**

**H2 · DSGVO ist dokumentiert, aber nicht abgeschlossen — und die Uhr läuft bereits (Cloud-KI in Nutzung).**
Die MUSS-Anforderung NFR-PRV-04 („Betroffenenrechte umsetzbar") ist nur manuell über Admin/DSB erfüllbar: kein Self-Service-Auskunfts-/Komplettexport, Löschung im append-only-Audit ungelöst (Abwägung nicht dokumentiert), AVV/DSFA/Retention-Fristen „liegen nicht vor" (`docs/compliance/gdpr-compliance-runbook.md` §3/§7; `data-protection-requirements.md` §9: „PARTIAL"). Gleichzeitig läuft der Reasoner real über die Anthropic-API — der in der eigenen Doku definierte AVV-/DSFA-Trigger „vor Aktivierung des externen Modellmodus" ist damit formal bereits gerissen (verkraftbar, solange **keine echten Kundendaten** fließen — Stop-Line D-010 wird eingehalten). Die versandfertige Kanzlei-Mail (D-010) liegt seit Tagen unversendet (`BOSS_SESSION_STAND` §6).
→ **Fix:** D-010-Mail senden (5 Min, nur Pedi); AVV mit Anthropic prüfen/abschließen + Retention-Entscheid (0,5 T mit Kanzlei-Input); Self-Service-Export als Ticket für „nach Beta" einplanen; bis dahin harte Regel: Beta nur mit synthetischen/Demo-Daten. **Aufwand: Pedi 5 Min + 0,5–1 T Folgearbeit.**

**H3 · Konkrete, verifizierte Sicherheits-/Betriebs-Schwächen im Auth-/Deploy-Pfad.**
Eine Code-Tiefenprüfung (verifiziert an Datei:Zeile, Details Anhang B) fand mehrere Punkte, die im lokalen Ein-Nutzer-Betrieb harmlos sind, **vor einem Internet-Deploy aber gefixt sein müssen**: (a) **`Fastify()` wird ohne `trustProxy` erzeugt** (`services/app/src/build-app.ts:349`) — hinter dem geplanten Reverse-Proxy (Coolify/Traefik) ist `request.ip` dann die Proxy-IP; der In-Memory-Rate-Limiter (`services/auth/src/rate-limit.ts`) verrechnet damit **alle** Nutzer in einen Topf → 10 „Passwort-vergessen"-Anfragen sperren die Funktion für alle, und 5 gezielte Fehllogins sperren ein Opferkonto. (b) **CSRF-Schutz ruht allein auf `SameSite=Lax`** — `services/app/src/csrf.ts` ist laut eigenem Kommentar „ändert das Verhalten NICHT", also Doku, kein Token/Origin-Check (für Beta vertretbar, aber ohne Defense-in-Depth). (c) **Session- und Reset-Token liegen im Postgres-Pfad als Klartext-Primärschlüssel** (`services/auth/src/repo-pg.ts`) — ein DB-Leak = direkte Sitzungsübernahme. (d) **Passwort-Hashing PBKDF2 mit 100.000 Iterationen** (`services/auth/src/password.ts`) — solide, aber unter der aktuellen OWASP-Empfehlung (210.000). (e) `POST /api/auth/register` ohne Rate-Limit. Kein Pen-Test (NFR-SEC-03/04, Pflichtenheft-Abnahmekriterium). Gleichzeitig kamen am 03.07. Features, die die Fläche vergrößern (externe Wissensabfrage SCRUM-414, Public-KI-Anreicherung SCRUM-426, lokaler LLM-Tunnel SCRUM-424/428).
→ **Fix:** Vor Internet-Deploy: `Fastify({ trustProxy: true })` + `COOKIE_SECURE=true`, Rate-Limits persistent/proxy-bewusst, Token nur als SHA-256-Hash speichern, PBKDF2 hochsetzen oder auf scrypt/Argon2id wechseln, Register drosseln, einmal „Pen-Test light" (kann eine Claude-Session strukturiert gegen die Staging-Instanz fahren) + `npm audit`-Bewertung. **Aufwand: 1–2 T.**

**H7 · RBAC-Lücke: Ein Admin kann sich selbst (oder den letzten Admin) aussperren — die Schutzregel ist geschrieben, aber nicht verdrahtet.**
Das ist der eine Befund, den ich für schwerwiegend genug halte, ihn eigenständig zu nennen, weil er **verifiziert** ist und einen irreversiblen Zustand erzeugen kann. Die Spezifikation FR-RBAC-03 („Admin kann sich nicht selbst die Admin-Rolle entziehen") ist als Funktion `canChangeRole(...)` in `services/rbac/src/policy.ts:31` vorhanden — aber eine projektweite Suche zeigt: **sie wird an keiner Stelle aufgerufen** (toter Code). Der tatsächliche Pfad `PUT /api/users/:id` → `AuthService.changeRole` (`services/auth/src/service.ts:195`) setzt `user.role = role` **ungeprüft**; ebenso hat `DELETE /api/users/:id` → `deleteUser` **keinen Last-Admin-Schutz**. Beide Routen verlangen nur „irgendein Admin". Folge: Der einzige Admin kann sich zu „experte" degradieren oder den letzten Admin löschen — danach kann **niemand mehr** Nutzer verwalten, Rollen vergeben oder freigeben; die Instanz ist administrativ tot und nur über direkten DB-/Journal-Eingriff zu retten. Bei einem Ein-Personen-Betrieb (Bus-Faktor K4) ist das ein reales Ausfallrisiko.
→ **Fix:** `canChangeRole` in `changeRole` verdrahten; in `changeRole`/`deleteUser` serverseitig blocken, wenn dadurch die Zahl aktiver Admins auf 0 fiele (`countAdmins()`-Check); ein Guard-Test „letzter Admin bleibt Admin". **Aufwand: 3–5 h.**

**H4 · Fachliche Kernschulden: binäres Statusmodell, Trust-Formel-Rest, keine Versions-Snapshots.**
Das Backend kennt nur `offen|validiert` — der spezifizierte Zustandsautomat (pending/review/validated/**rejected**, Technischer Anhang §3.1) und die 7 UI-Status sind nur abgeleitet („abgelehnt ist im Modell nicht vorhanden", `Frontend-API-Abgleich.md` Punkt 1). Die Trust-Formel ist zentralisiert und gedeckelt (TRUST_MAX 99, SCRUM-359), aber die spec-konforme mehrstufige Gewichtung bleibt offen (AG-05, Z. 8945); KO-Versionen haben keine unveränderlichen Snapshots („Verlustrisiko bei Revision", Dossier §6/§22 — Snapshots kamen später teilweise, Restore/Diff fehlen). Je später diese Modell-Fragen gelöst werden, desto teurer die Datenmigration bei Bestandskunden.
→ **Fix:** Vor dem ersten zahlenden Piloten entscheiden: `rejected` als echter Status + Migrationsnotiz; Trust-Formel-Rest als bewusstes „nicht jetzt" in specs dokumentieren (Harness-Prinzip); Snapshots/Restore als P1-Ticket. **Aufwand: Entscheidung 1 h; Umsetzung 1–2 T.**

**H5 · Drei Wahrheitsquellen driften auseinander (Jira ↔ PMO ↔ Doku ↔ Code).**
Belege: KLLM-55/56/57 stehen auf „To Do", obwohl Phase 0 „FERTIG gebaut" ist (`PROJECT_CONTEXT/05`) und Sitzung 1 heute lief (KLLM-57-Auswertung); KLLM-57-Titel nennt noch „Scaleway … Budget ≤ 50 €", entschieden ist UpCloud (Entscheidungs-Log 02.07.); KLLM-3/4/5/7 seit 27.06. „Blocked" für den beendeten MacBook-Pfad, KLLM-41/54 verwaist; PMO-Snapshot meldet „Beta ~35 %, Trend verschlechtert ▼" und „Team 2 pausiert" auf Basis veralteter TEAM6_UPDATE-Dateien (Team-1-Quelle: Stand 01.07., `reports/2026-07-03-1031-status.md`); `PROJECT_CONTEXT/04` nennt v0.9.22 bei realer 0.9.45; Team-4-README sagt „Planning only" trotz fertiger Astro-Site (`Klarwerk/CURRENT_STATE.md`, Driftpunkte). Für dich als Entscheider heißt das: **kein einzelnes Dashboard sagt dir gerade die Wahrheit.**
→ **Fix:** Ein 2–3-h-„Wahrheits-Sweep" (kann Paul): KLLM-Karten schließen/aktualisieren, 04_AKTUELLER_STAND + Team-READMEs nachziehen, PMO-Quellen (TEAM6_UPDATE) aktualisieren + Snapshot neu, Team 2-Status korrigieren. Dauerregel ergänzen: Ticket-/PMO-Update gehört in **denselben** Arbeitsschritt wie der After-Report (steht in 02_ARBEITSREGELN — wird für KLLM nur nicht gelebt). **Aufwand: 2–3 h + Disziplin.**

**H6 · VIP-Termin 05.07.: Das Risiko ist nicht die App, sondern der ungeprobte Tagesstand.**
Der Leitfaden (`docs/team2-austausch/VIP-VORTEST-LEITFADEN-0507.md`) ist gut, trägt aber veraltete Zahlen (v0.9.33/0.9.34, „über 1300 Tests" — real 0.9.45/1.382; der Leitfaden bittet selbst um Aktualisierung). Seit seiner Erstellung kamen ~12 weitere Versionsstände ohne Sichtabnahme (K2). Zwei Sprechtext-Details überzeichnen: „Vertraulichkeit … ist spezifiziert und **in der Umsetzung**" — SCRUM-415 steht auf To Do mit dem ehrlichen Befund „bisher NICHT integriert" (Ticket-Text); „Pilotkunde in Vorbereitung" — D-010-Mail ist noch nicht einmal versendet (H2). Genau diese Sorte Über-Behauptung widerspricht dem eigenen Markenkern „Ehrlichkeit vor Optik" — und ein Investor merkt so etwas.
→ **Fix:** Freeze (K2) → Generalprobe am 04.07. exakt nach Leitfaden-Checkliste (Demodaten frisch, Key-Test grün, kurzes Test-PDF, Prüferanzahl 2, Zahlen aktualisiert) → Sprechtext an zwei Stellen ehrlich machen („spezifiziert, Umsetzung eingeplant"; „Kanzlei-Briefing versandfertig"). **Aufwand: 1–2 h + Probe 30 Min.**

### 🟡 MITTEL

**M1 · Frontend-Monolithen als Wartbarkeits-/Kollisionsrisiko.** `apps/web/src/i18n.ts` ≈ 273 KB, `pages/Capture.tsx` ≈ 130 KB, `KnowledgeDetail.tsx` ≈ 109 KB, `Admin.tsx` ≈ 55 KB (Verzeichnis-Listing 03.07.). Bei zwei parallel arbeitenden Sessions (Boss + Paul) sind das die Dateien, in denen sich Änderungen treffen werden (mehrere Slices teilen sich Capture/i18n, Z. 10369). → Nach Beta: i18n je Namespace splitten, Capture in Teilkomponenten. **1–2 T.**

**M2 · Bundle & Abhängigkeiten unbewertet.** dist ≈ 5,1 MB inkl. pdf.worker 2,3 MB; „npm audit meldet Findings (nicht bewertet)" (Ist-Analyse §4). → Ein Audit-/Code-Splitting-Ticket nach Beta. **0,5 T.**

**M3 · Das Projektgedächtnis selbst hat Integritätslücken.** After-Report mit nicht-chronologischen Einschüben (Testzahlen springen zurück: Z. 7053–7235), Doppel-Eintrag SCRUM-406 (Z. 10342/10350), Datumsangaben fehlen ab ~Mitte, Datei 1,2 MB. Als Beweismittel/Gedächtnis dadurch geschwächt. → Monatliche Rotation (`claude-after-report-2026-07.md`), Append-only-Disziplin, Runner-Marker beibehalten. **1 h.**

**M4 · Dokument-Streuung und Alt-Secrets.** Vier parallele Ablagen mit teils veralteten Kopien (`KLARWERK_Data_GURU/` mit altem After-Report, „Klarwerk full out of argus", ARGUS-Ordner, dev_Klarwerk) — Verwechslungsgefahr für neue Sessions. In ARGUS: Basic-Auth-Zugangsdaten im Klartext (`PROJEKT-DOKUMENTATION.md`), laut Handbuch §8 einst im Chat geteilte, nicht rotierte Keys; `open-engine/.env.local` liegt im Klartext. → Alt-Keys rotieren (sofern noch aktiv), Klartext-Stellen schwärzen, veraltete Kopien in einen `_archiv/`-Ordner. **2 h.**

**M5 · Website-Momentum verpufft ohne Deploy + Sichtabnahme.** Neue Positionierung, KO-Rotation und Video-Slot sind gebaut, aber KWEB-104/106/107/108 warten auf Review und der Hetzner-Stand hinkt dem Repo hinterher („Deploy durch Pedi ausstehend"); Videos hängen an Gemini-Tageslimits. → 30 Min Pedi: Website-App klicken, Sichtabnahme, dann sind 4 Tickets zu. **0,5 h.**

**M6 · Specs (Quelle der Wahrheit) hinken der gelebten Positionierung hinterher.** Pflichtenheft/Glossar sagen „industrielle Organisationen", Kurs seit 02.07. ist „jede Organisation"; Wissensarten-Terminologie divergiert (Harness-Glossar vs. Pflichtenheft); Kategorielabel „Reasoning System" vs. „Knowledge OS" unentschieden (Website-Titel vs. Onboarding-Doku). Nach dem eigenen Prinzip „Code ist regenerierbares Ergebnis aus Spec+Harness" ist das ein Systemfehler, kein Schönheitsfehler. → Spec-Pflege-Slice nach Freeze: Positionierung, Statusmodell-Realität, Glossar. **2–3 h.**

**M7 · Betrieb ohne Augen:** Monitoring/Alerts „PARTIAL — keine aktiven Alerts" (Z. 4999), keine Token-/Kostenerfassung im Produkt (Z. 5284), kein Uptime-Check. Für den Mac-Betrieb egal — ab app.klarwerk.ai nicht mehr. → Mit dem Deploy: Coolify-Healthchecks + einfacher externer Uptime-Ping + Anthropic-Kostenlimit im Konto. **0,5 T.**

**M8 · Dockerfile-Härtung vor dem ersten echten Deploy.** Verifiziert: Der Prod-Container läuft **als root** (kein `USER`), startet die App über **`npx tsx services/app/src/server.ts`** — TypeScript zur Laufzeit statt kompiliertem Build — und nutzt `npm ci --omit=dev || npm install` (der `||`-Fallback verletzt die eigene „deterministisch, npm ci"-Regel aus dem Correction-Log). Die `.dockerignore` **existiert** und schließt `.env*`, `.git`, `node_modules`, `dist` korrekt aus (der erste Verdacht eines `.env`-Leaks bestätigte sich **nicht**) — sie listet aber **`.localdb/` nicht**, sodass `COPY . .` das Dev-Journal (mit Klartext-Session-Token) ins Image zöge, falls es beim Build vorhanden ist; im reinen CI-Build entsteht `.localdb` normalerweise nicht, im Build vom Arbeits-Mac aber schon. → `USER node` setzen, `.localdb` in `.dockerignore` ergänzen, `||`-Fallback entfernen, optional Backend vorkompilieren. **2–3 h.**

### ⚪ NIEDRIG

**N1 · Repo-/Ordner-Hygiene:** ~120 `vitest.config.ts.timestamp-*.mjs` im Repo-Root (gitignored, aber Müll; seit Ist-Analyse 01.07. bekannt), `.DS_Store` verstreut, `ARGUS/CHANGELOG.md` ist der react-router-Changelog. **15 Min.**
**N2 · Alt-Routen aufräumen:** `GET /api/ai-status` (redundant zu reasoner/status), doppelte User-Delete-Route (Funktions-Audit B5/B6). **1 h.**
**N3 · Zeitfenster Team 2:** Gratis-Credits verfallen ~01.08. — Sitzung 2 (14B/Mistral) und ggf. H100-Gegencheck bewusst terminieren, sonst verschenkt. **Planung 10 Min.**
**N4 · KGURU-Register-Frische:** Alle 32 Tickets Done, aber Master-Scope „muss nach den späten 03.07.-Änderungen aktualisiert werden" (CURRENT_STATE, Driftpunkte) — gehört in den H5-Sweep.
**N5 · Privates neben Projektdaten:** Im freigegebenen `Documents`-Ordner liegen hochpersönliche Dokumente (Gehaltsabrechnungen, Geburtsurkunden, Patientenverfügung) neben den Projektordnern, auf die jede Claude-Session Zugriff hat. Kein akutes Projekt-Risiko, aber unnötige Exposition. → Projektarbeit in einen dedizierten Unterordner bündeln bzw. Freigaben enger schneiden. **30 Min.**


---

## 5 · Top-10-Empfehlungen (priorisiert, auf zwei Horizonte)

> Reihenfolge = mein Vorschlag für die tatsächliche Abarbeitung. „Wer" ist ein Vorschlag im Rahmen eurer Rollen (Pedi = nur Klicks/Entscheidung; Paul/Boss = Umsetzung).

### A · VOR VIP-Termin 05.07. / für die Beta (diese ~48 Stunden)

| # | Empfehlung | Warum jetzt | Wer · Aufwand |
|---|---|---|---|
| 1 | **Backup von PMO-Ordner + Schlüsseln (K1)** — verschlüsselt an zwei Orte, Time Machine prüfen, einmal Restore-Probe | Einziger unwiederbringlicher Bestand; ein Mac-Defekt vor dem Termin wäre fatal — unabhängig vom VIP | Pedi klickt · **2–4 h** |
| 2 | **Feature-Freeze auf dem grünen 21:36-Stand (K2)** + RC-Tag setzen | Kein ungeprüfter Stand darf in die Demo geraten; beendet die 45-Versionen-ohne-Abnahme-Phase | Pedi sagt „einfrieren", Boss setzt Tag · **1 h** |
| 3 | **Generalprobe 04.07. exakt nach VIP-Leitfaden** (Demodaten frisch, Key-Test grün, Test-PDF, Prüferanzahl 2) + Sprechtext-Zahlen aktualisieren (v0.9.45, 1.382 Tests) | Der Leitfaden trägt veraltete Zahlen; der Stand ist ungeprobt (H6) | Pedi + Paul · **1,5 h** |
| 4 | **Sprechtext an 2 Stellen ehrlich machen (H6)**: Vertraulichkeit „spezifiziert, Umsetzung eingeplant" (nicht „in Umsetzung"); Pilot „Briefing versandfertig" | Über-Behauptung widerspricht dem Markenkern und fällt Investoren auf | Paul · **20 Min** |
| 5 | **„Wahrheits-Sweep" Jira/PMO/Doku (H5)**: KLLM-Karten schließen/aktualisieren, 04_AKTUELLER_STAND auf v0.9.45, Team-2-Status korrigieren, PMO-Snapshot neu | Damit du am Termin (und danach) ein Dashboard hast, das stimmt; heute widersprechen sich drei | Paul · **2–3 h** |

*Bewusst NICHT vor dem Termin:* Postgres, DSGVO-Paket, Security-Härtung, RBAC-Fix — die brauchen Ruhe und gehören nicht in ein Freeze-Fenster. Ausnahme, falls Zeit bleibt: der RBAC-Fix (A-6-Kandidat) ist klein und verhindert eine Selbst-Aussperrung während der Demo.

### B · NACH dem Termin (die ~2 Wochen bis zum ersten Pilotkunden)

| # | Empfehlung | Warum | Wer · Aufwand |
|---|---|---|---|
| 6 | **Postgres-Pfad real testen (K3)** — `test:integration` auf dem Mac, dann in die CI; Migrations-/Restore-Drill | Der Produktionspfad ist nie gelaufen; ohne diesen Nachweis ist „Beta deploybar" unbelegt | Pedi (Docker) + Paul · **½–1 T** |
| 7 | **RBAC-Selbstentrechtung + Last-Admin-Schutz (H7)** verdrahten | Verhindert irreversible administrative Aussperrung — bei Bus-Faktor 1 real | Paul · **3–5 h** |
| 8 | **Sicherheits-Härtung vor Internet-Deploy (H3 + M8)**: trustProxy, Token-Hashing, Rate-Limits, Register-Drossel, Dockerfile (USER/`.localdb`), Pen-Test-light | Sobald app.klarwerk.ai öffentlich (auch hinter Basic-Auth) erreichbar ist | Paul + Pedi (Deploy) · **2–3 T** |
| 9 | **DSGVO-Paket abschließen (H2)**: D-010-Mail senden, AVV Anthropic, Retention-Entscheid, Self-Service-Export als Ticket | MUSS-Anforderung; blockiert den ersten Piloten mit echten Daten | Pedi (Mail/Recht) + Paul · **0,5–1 T** |
| 10 | **Notfall-Runbook + zweiter Admin (K4)** und **fachliche Modell-Entscheidungen (H4)**: `rejected`-Status, Snapshots, Trust-Formel-Rest bewusst terminieren | Reduziert Bus-Faktor; verhindert teure Datenmigration bei Bestandskunden | Paul + Pedi · **1–2 T** |

**Terminierung Team 2 (Querschnitt):** Sitzung 2 (Qwen3-14B/Mistral) und die Dauerbetriebs-Entscheidung (KLLM-59) **vor ~25.07.** ansetzen — die UpCloud-Gratis-Credits verfallen ~01.08. (N3). App-Anbindung KLLM-61 mit der harten Auflage `enable_thinking=false` + `<think>`-Filter (steht schon im Entscheidungsbrief).

---

## 6 · Offene Fragen an Pedi

Die eigenständige Datei `BERATER_FRAGEN_2026-07-03.md` enthält diese Fragen ausführlich. Kurzfassung der acht wichtigsten:

1. **RC-Freeze — wann?** Der Fahrplan wartet seit dem 02.07. auf dein „RC einfrieren". Soll der grüne 21:36-Stand (v0.9.45) der RC werden, oder willst du erst die 50 In-Review-Tickets sichten?
2. **Pilot-Zeitplan & Datenschutz:** Wann ist der erste echte Pilotkunde realistisch geplant — und ist bis dahin die D-010-Kanzlei-Antwort da? Davon hängt ab, wie dringend das DSGVO-Paket (H2) ist.
3. **Wo läuft die Beta?** Bleibt sie vorerst lokal (Desktop-App, In-Memory/Journal), oder kommt app.klarwerk.ai via Coolify? Das entscheidet, ob K3/H3/M8 vor oder nach dem VIP-Termin dringlich werden.
4. **On-Premises vs. Cloud-Betrieb:** Ist der eigene LLM-Server strategisch gesetzt (dann KLLM-60 Dauerbetrieb einplanen), oder bleibt Anthropic der Betriebsweg und der lokale LLM nur Option für datensensible Kunden?
5. **Zielmarkt-Schärfung:** „Jede Organisation" (Website) vs. „industrielle Organisationen" (Pflichtenheft/Specs) — welche Positionierung ist verbindlich? Danach ziehen wir die Specs nach (M6).
6. **Zweiter Mensch im Projekt:** Ist eine Vertrauensperson vorgesehen, die im Notfall Zugänge/Push übernehmen könnte (Bus-Faktor K4)? Falls ja, als zweiten Jira-/GitHub-Admin einladen.
7. **Investor-Kennzahlen:** Sollen die ARGUS-Deck-Zahlen (98,5 %, 1.247 Konflikte/Monat, 99,9 % Uptime) als Projektionen gekennzeichnet werden, bevor Material extern geht? (Handbuch führt das als offen.)
8. **Privatdaten im freigegebenen Ordner:** Im Ordner `Documents` liegen sehr persönliche Dokumente neben dem Projekt. Sollen wir die Projektarbeit in einen dedizierten Unterordner bündeln, damit KI-Sessions nur das Nötige sehen?

---

## 7 · Anhang

### A · Kennzahlen (Belege)

**A1 — Jira-Statusverteilung (676 Tickets, API-Stand 03.07. abends):** SCRUM 438 (378 Done / 50 In Review / 10 To Do) · KLLM 61 (48 Done / 9 To Do / 4 Blocked) · KWEB 111 (104 Done / 4 In Review / 3 To Do) · KGURU 32 (alle Done) · KREL 34 (33 Done / 1 To Do). Erstellungs-Spitzen: 29.06. (131 Tickets projektübergreifend), 27.06. (127), 22.06. (92).

**A2 — Git-Aktivität (Reflog, 412 Einträge):** 22.06. 17 · 25.06. 43 · 26.06. 42 · 27.06. 49 · 28.06. 62 · 29.06. 42 · 30.06. 31 · 01.07. 18 · 02.07. 70 · 03.07. 28. Einziger menschlicher Committer/Pusher: Peter Kohnert.

**A3 — Testwachstum (After-Report-Kurve):** 25.06. ~106 → 26.06. ~408 → 27.06. ~700 (Plateau/Doku-Phase) → 29.06. ~948 → 30.06. ~1.131 → 01.07. 1.199 → 02.07. 1.281 → 03.07. 1.284 → letzter Lauf **1.382** (232 Dateien, `paul-runner.log`). ~13× in 9 Tagen.

**A4 — PMO (144 Items):** 53 recognized · 33 partially_done · 29 done · 10 planned · 6 blocked · 5 paused · 5 in_progress · 2 deferred · 1 archived. PMO-Snapshot-Schätzung Beta-Readiness ~35 % (auf veralteten Quellen, s. H5).

**A5 — LLM-Prüfstand (03.07.):** Qwen3-32B-AWQ 22/24 Punkte, Ø 1,7 s · Referenz claude-sonnet-4-6 22/24, Ø 3,3 s · beide Ehrlich-Fälle 3/3 bestanden (Denkmodus aus). Kosten Sitzung 1 ≈ 2,22 € aus Gratis-Credits.

### B · Verifizierte technische Detailbefunde (Code-Prüfung, Datei:Zeile)

> Diese Tabelle stützt die Befunde H1/H3/H7/M8. Jeder Punkt wurde an der Quelle geprüft. Aufwände konservativ.

| Sev | Befund (Beleg) | Fix | Aufwand |
|---|---|---|---|
| Hoch | **FR-RBAC-03 nicht verdrahtet:** `canChangeRole` (`rbac/src/policy.ts:31`) wird nirgends aufgerufen (toter Code); `changeRole` (`auth/src/service.ts:195`) setzt Rolle ungeprüft; `deleteUser` ohne Last-Admin-Schutz (`auth/src/routes.ts:453,481`) → Selbst-/Letzter-Admin-Aussperrung | Policy verdrahten + `countAdmins()`-Guard + Test | 3–5 h |
| Hoch | **`Fastify()` ohne `trustProxy`** (`build-app.ts:349`) → hinter Proxy Rate-Limiter global fehlgeleitet (Reset-DoS für alle, gezielter Login-Lockout) | `trustProxy: true`; Forgot-Limiter nicht pro Anfrage zählen | 2–4 h |
| Hoch | **Modell-`fetch` ohne Timeout/Abort** (`reasoner/src/model-client.ts:21-34,73-87`) → hängender lokaler LLM blockiert Requests | `AbortController` ~30 s, Fehler in Fallback-Kette | 2–3 h |
| Mittel | **Pg-Pfad nicht im grünen Gate** — CI (`.github/workflows/ci.yml`) fährt nur `vitest run`; `vitest.integration.config.ts` (Testcontainers) existiert, läuft aber nirgends automatisch | Postgres-Service + Integrationsjob in CI | 4–8 h |
| Mittel | **Dev-Persist: kein `fsync`, keine Kompaktierung, Objekt-Blobs im Journal, `MUTATING_METHODS` handgepflegt** (`app/src/dev-persist.ts:19,49,155`) | fsync, Snapshot-Kompaktierung, Blobs auf Disk, Methoden-Test | 6–10 h |
| Mittel | **Session-/Reset-Token Klartext-PK in Pg** (`auth/src/repo-pg.ts:17-27`) | Nur SHA-256-Hash speichern/vergleichen | 3–4 h |
| Mittel | **Objekt-Limit 5 MB vs. Fastify-`bodyLimit` 1 MB** (`object-store/types.ts:35` vs. `build-app.ts:349`) → Uploads >1 MB scheitern still (413) | `bodyLimit` bewusst setzen + angleichen, klare Meldung | 1–2 h |
| Mittel | **Guard-Audit rein statisch** — prüft nur, dass ein Guard im Text steht; `DELETE /api/kos/:id` über `ko.read` gegatet, echte Autorisierung inline unsichtbar (`routeGuardAudit.ts:184`, `ko-routes.ts:251`) | Ergänzende Runtime-Guard-Tests (echte 401/403) | 6–10 h |
| Mittel-Niedrig | **Kein CSRF-Token/Origin-Check**, nur `SameSite=Lax` (`csrf.ts:7`) | Origin-Check oder Double-Submit-Token | 3–6 h |
| Niedrig-Mittel | **SVG-Data-URL-Anhänge erlaubt** (`ko-routes.ts:354`, `image/*`); `/raw`-Auslieferung (object-/media-routes) nicht im Audit-Scope — separat prüfen | `image/svg+xml` sperren o. sanitisieren; `Content-Disposition: attachment` + `nosniff` | 2–4 h |
| Niedrig | **Register ohne Rate-Limit; PBKDF2 100k < OWASP 210k** (`auth/src/routes.ts:126`, `password.ts:4`) | Register drosseln; Iterationen hoch o. Argon2id | 2–4 h |
| Niedrig | **Dockerfile:** root-Betrieb, `npx tsx` in Prod, `npm ci||install`, `.localdb` fehlt in `.dockerignore` (`.env*` ist korrekt ausgeschlossen) | `USER node`, `.localdb` ergänzen, `||` entfernen | 2–3 h |

**Nicht abschließend bewertbar (nicht im Prüf-Scope, vor Produktivgang nachholen):** Integrität der Audit-Hash-Kette (`services/audit/*`), Qualität von `sanitizeHtml` gegen XSS (`services/structure/*`), Datei-Roh-Auslieferung (`object-routes.ts`/`media-routes.ts`).

### C · Positive Belege (damit der Bericht fair bleibt)

OIDC lehrbuchgerecht (PKCE S256 + state + nonce, kein Implicit; `auth/src/oidc.ts`) · KI-Schlüssel strikt serverseitig, nie über Routen setz-/auslesbar (`reasoner/src/model-client.ts`, `reasoner-routes.ts`) · `extract`-Belegstellen-Gate gegen Halluzination (`reasoner/src/provider-model.ts:249-295`) · Guard-Matrix fängt vergessene/herabgestufte mutierende Routen zuverlässig · saubere In-Memory/Pg-Trennung hinter Repo-Interfaces; SQL parametrisiert (kein Injection-Befund).

---

*Erstellt vom externen Projekt-Berater (unabhängige Claude-Audit-Session), 03.07.2026 — ausschließlich lesend. Zwei neue Dateien nach `docs/qm/`: dieser Bericht und `BERATER_FRAGEN_2026-07-03.md`. Kein Code, keine Tickets, keine Konfiguration verändert. Maßstab war nicht Perfektion, sondern: Was gefährdet Beta-Erfolg und erste Kunden wirklich. Kurzantwort: nicht der Funktionskern — der trägt —, sondern Backup/Bus-Faktor, die zuletzt weicheren Gates und der ungetestete Produktionspfad. Alles adressierbar, das meiste in Stunden bis wenigen Tagen.*
