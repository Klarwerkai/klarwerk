# Klarwerk — Wartungs- & Update-Prozess (Betreiber-Runbook)

> Praktisches Ops-Runbook für **stabilen, aktuellen Langzeitbetrieb**: Wartungsrhythmus,
> Update-Klassen, Test-/Staging-Gates, Backup/Rollback, Modell-/Provider-Evaluation.
> Verwandte Doku: `docs/operations/deploy-hetzner.md`, `secrets-management.md`,
> `pre-launch-protection.md`, `governance-and-teams.md`, `docs/compliance/gdpr-compliance-runbook.md`,
> `SETUP.md`, `README.md`. **Keine** Infrastrukturänderung / keine neue Runtime in diesem Dokument.

---

## 0. Verwaltungs-Landkarte (kurz)

| Aufgabe | Ort |
| --- | --- |
| Code, CI-Gates, Secret-**Referenzen** | Git-Repo |
| Deploys, Laufzeit-Secrets, Logs, TLS | Coolify (Hetzner-Server) |
| Domain, DNS, Schutz | Cloudflare |
| App-/Transaktions-E-Mail | Brevo/Mailjet |
| DB-Daten & Backups | Postgres + Hetzner-Snapshots + `pg_dump` |

---

## 1. Wartungsrhythmus

| Kadenz | Aktivität |
| --- | --- |
| **Wöchentlich** | Health/Logs sichten (`/health`), Fehlerquote, Backup-Lauf erfolgreich? |
| **Monatlich** | Dependency-/Security-Updates (Patch), `npm run check` lokal, kleine App-Updates ausrollen |
| **Quartalsweise** | Minor-Updates (Dependencies/Runtime), Modell-/Provider-Review, **Compliance-/Secrets-Review** (siehe `gdpr-compliance-runbook.md` §6, `secrets-management.md` §10), Rollback-Probe |
| **Halbjährlich/Jährlich** | Major-Updates (Node/Postgres-Major), Rotation langlebiger Secrets, DSFA-Schwelle neu prüfen |
| **Ad hoc (sofort)** | Sicherheits-Patches (CVE), Provider-Ausfall, Vorfall → Notfallpfad §11 |

---

## 2. Update-Klassen

| Klasse | Was | Verfahren | Risiko |
| --- | --- | --- | --- |
| **App-Code** | Klarwerk-Features/Fixes | Git-Push → CI grün → Coolify-Deploy | niedrig (CI deckt ab) |
| **Dependencies** | npm-Pakete | gestaffelt (patch→minor→major), `npm run check` + Tests | mittel bei Major |
| **OS/Runtime** | Node 20.x, Server-OS, Coolify | erst Staging, dann Prod-Fenster | mittel/hoch bei Major |
| **Datenbank** | Postgres-Version/Migrationen | **erst Backup**, Migration prüfen, Restore-Probe | hoch |
| **Reasoner/Model-Provider** | `ANTHROPIC_API_KEY`, `REASONER_MODEL` | reine **Env-Änderung** + Verifikation (§8) — **keine Architektur** | niedrig |
| **Secrets/Zertifikate** | Keys, SMTP, OIDC-Secret, TLS | per `secrets-management.md` (Rotation §7) | mittel |

---

## 3. Vorab-Checkliste (vor jedem Prod-Update)

- [ ] Änderung klassifiziert (§2) und Risiko bewertet.
- [ ] **Backup frisch** (Snapshot + `pg_dump`) und Restore-Pfad bekannt.
- [ ] Lokal/Staging: `npm run check` **grün** (build/lint/arch/test); bei FE zusätzlich `cd apps/web && tsc --noEmit` + Vite-Build.
- [ ] Changelog/Commit-Hinweis vorhanden; Rollback-Punkt notiert (Commit/Image).
- [ ] Wartungsfenster + Verantwortliche festgelegt (§7).
- [ ] Secrets/Env unverändert oder bewusst angepasst (kein Secret ins Repo).

---

## 4. Test-/Staging-Verfahren

1. Änderung auf einem **Staging-Deploy** (separate Coolify-App/Branch) ausrollen.
2. **Smoke-Test:** `GET /health` → `{"status":"ok"}`; Login; Kernpfad Capture → Validate → Use → Maintain (siehe `docs/demo/stage-1-demo-path.md`).
3. Bei DB-/Provider-Änderungen: gezielt prüfen (Migration, Reasoner-Status-Badge).
4. Erst nach grünem Staging → Prod.

---

## 5. Pflicht-Gates (nicht verhandelbar)

- **CI (`.github/workflows/ci.yml`)**: `npm run build` (tsc) · `npm run lint` (Biome) · `npm run arch` (dependency-cruiser) · `npm run test` (Vitest). **Nichts nach `main` ohne grüne Pipeline.**
- Lokal äquivalent: **`npm run check`**.
- Coolify-Deploy nur nach grünem Build; **Post-Deploy-Smoke** `/health` Pflicht.

---

## 6. Backup- & Rollback-Schritte

Dieser Abschnitt beschreibt **zwei verschiedene Betriebsarten**, und sie sind unterschiedlich belegt.
Wer sie verwechselt, greift im Ernstfall zum falschen Weg:

| | **6.1 Insel / On-Prem** (Mac Studio, Release-Ordner) | **6.2 Cloud / Coolify** (Hetzner) |
| --- | --- | --- |
| Backup | `scripts/insel/update-einspielen.sh` sichert **vor** jedem Umschalten | Snapshot + `pg_dump` (Verfahren beschrieben) |
| Rollback | `scripts/insel/rueckfall.sh`, automatisch bei rotem Health | Redeploy des vorherigen Stands in Coolify |
| Stand | **ausführbar und getestet** (`tests/insel-update/`) | **unbestätigt** — siehe U4/U5 unten |

### 6.1 Insel / On-Prem — Update mit Netz (ausführbar)

Ein Update ist **ein** Befehl. Er endet immer mit genau einer Ergebniszeile:

```bash
bash /Users/Shared/Klarwerk_Insel/current/scripts/insel/update-einspielen.sh <paket.zip|paket-ordner>
```

Denselben Weg fährt der **Doppelklick**: `install.command` im Paket schaltet seit JOB 4012 nichts
mehr selbst um, sondern übergibt an `update-einspielen.sh` (mit allen Argumenten). Es gibt damit
**einen** Einstieg ins Release und keinen zweiten an Sicherung, Vertrag und Rückfall vorbei.

Der Ablauf, in dieser Reihenfolge — jeder Schritt kann den nächsten verhindern:

0. **Release-Identität.** Jeder Baulauf trägt einen eigenen Namen
   (`klarwerk-insel-<app-version>-<commit8>-<bauzeit>`), und ein **vorhandenes Release-Verzeichnis
   wird nie überschrieben**. Trifft trotzdem ein gleichnamiges Paket ein (umbenanntes Zip, Paket von
   Hand gebaut), bricht der Weg ab, bevor er irgendetwas anfasst: Exit 6, Ergebniszeile
   `… Grund: kollision`. Grund: Das Verzeichnis der Vorversion ist das Netz. Wer es überschreibt,
   hat beim roten Health nichts mehr, worauf er zurückfallen kann. **Dasselbe gilt für die
   Wiederholung**: Ein Paket, dessen Release schon unter `releases/` liegt — auch das gerade
   laufende, auch wenn man genau dieses Verzeichnis als Quelle angibt — wird abgelehnt. Ein Update
   auf sich selbst gewinnt nichts und würde den Rückfallpunkt kosten, weil der Weg danach die
   laufende Fassung als Vorversion vermerkt. Eine bereits vorhandene Fassung fährt man mit
   `rueckfall.sh <release>` an, nicht durch erneutes Einspielen.
1. **Sicherung.** Jeder Lauf legt zuerst sein **eigenes** Verzeichnis `backups/<zeitstempel>-<lauf>/`
   an, und **beide** Betriebsarten sichern hinein: Postgres-Betrieb
   (`DATABASE_URL`/`KLARWERK_DATABASE_URL` gesetzt) → Aufruf von `scripts/backup/backup.sh` mit
   diesem Verzeichnis als Ziel (Dump **mit** Prüfsummen-Sidecar, daneben das Protokoll
   `backup.log`); Journalbetrieb → Kopie von `state.jsonl` dorthin, Prüfsumme daneben, Inhalt gegen
   das Original geprüft. Der Zusatz `<lauf>` ist nicht Zierde: Beide Namen — der des Journalordners
   wie der des Dumps (`klarwerk-<zeitstempel>.dump`) — haben nur Sekundenauflösung. Zwei Updates in
   derselben Sekunde hätten sonst die erste Sicherung samt Prüfsumme durch die zweite ersetzt, und
   zwar genau dann, wenn man sie am nötigsten braucht. **Ohne gelungene Sicherung wird nicht
   umgeschaltet** (Exit 2, Ergebniszeile
   `Update abgebrochen, Vorversion <version> läuft weiter, Grund: sicherung`).
2. **Schema-Vertrag.** Jedes Release trägt seine Migrationsstufen in `SCHEMA-VERTRAG` (erzeugt von
   `scripts/insel/build-current-release.mjs` aus `services/app/src/migrationsbeleg.ts`); neben den
   Daten steht der erreichte Stand in `data/SCHEMA-STAND`. Verglichen wird **vor** dem Umschalten:
   * **Downgrade** (die Daten tragen Stufen, die das Release nicht kennt) → Abbruch, Exit 3.
   * **neue irreversible Stufe** (`DROP`/`DELETE`/`UPDATE … SET`) → Abbruch, Exit 4. Sie läuft nur
     nach ausdrücklicher Zustimmung: `--nicht-umkehrbar-einspielen`. Danach trägt der Rückweg nur
     noch die Sicherung — deshalb ist das eine menschliche Entscheidung und kein Automatismus.
   * **unbekannter Datenstand** → Abbruch, Exit 10, Ergebniszeile `… Grund: datenstand`. Dieser Fall
     trifft jede **Altinstallation**: Sie wurde mit dem alten `install.command` eingespielt, ihr
     Release trägt keinen `SCHEMA-VERTRAG`, und neben den Daten steht kein `SCHEMA-STAND` — welche
     Stufen an diesen Daten gelaufen sind, ist dann nicht sagbar, und jede Aussage über Downgrade
     oder Umkehrbarkeit wäre geraten. Der Übergang geht mit `--datenstand-unbekannt-uebernehmen`;
     ab da gilt **jede** Stufe des Releases als neu, eine irreversible braucht also zusätzlich
     `--nicht-umkehrbar-einspielen`. Nach dem ersten Update über diesen Weg ist der Stand bekannt
     und die Zustimmung nicht mehr nötig. Eine **leere** Journaldatei zählt ausdrücklich nicht als
     Datenbestand — die legt jedes Release beim ersten Start selbst an.
   * neue additive/transformierende Stufen laufen beim Serverstart in `migrate()` mit und werden
     in der Ausgabe namentlich genannt.
3. **Umschalten.** Alten Server beenden, `current` auf das neue Release, `start.command` starten.
   Der Stopp sagt dabei, was er getan hat (`beendet` · `kein-server` · `launchd-fuehrt`) — das ist
   keine Kosmetik: im launchd-Fall läuft der alte Prozess noch, und das muss ein Datenrückweg wissen.
   Hält nämlich ein launchd-Agent den Server (`de.klarwerk.insel`, so startet ihn die AppleScript-
   Verknüpfung), geschieht der Wechsel stattdessen mit `launchctl kickstart -k` — ein eigenes
   `kill` würde gegen `KeepAlive` arbeiten und die alte Fassung wiederbeleben. Erkannt wird das an
   einem wirklich geladenen Agenten. **Scheitert der Startaufruf selbst** (Agent entladen, Label
   falsch, fremde Sitzung), ist das ein Grund wie jeder andere: Rückfall und Exit 11 — nicht der
   wortlose Abbruch mitten im Umschalten, den es bis Runde 2 gab.
4. **Health mit Version.** `GET /health` muss grün sein **und** die Version des neuen Releases
   melden (`build-app.ts` liefert `version` aus `package.json`). Grün allein genügt nicht: hält der
   alte Prozess noch den Port, ist `/health` grün und meldet die alte Fassung.
5. **Rückfall.** Bleibt Health rot (Exit 7), meldet eine andere Version (Exit 8) oder kam der Start
   gar nicht erst zustande (Exit 11), läuft `scripts/insel/rueckfall.sh` **von selbst**: `current`
   zurück auf die Vorversion, Neustart, Health-Prüfung, Ergebniszeile
   `Update abgebrochen, Vorversion <version> läuft wieder, Grund: …` und Exit ungleich 0. Scheitert
   der Rückfall selbst, endet der Weg mit Exit 9 und sagt genau das
   (`… Rückfall auf <version> gescheitert, Grund: …`) — `current` zeigt dann wieder auf die
   Vorversion, es läuft aber nichts, und nichts anderes wird behauptet.

Von Hand geht derselbe Weg jederzeit:

```bash
bash /Users/Shared/Klarwerk_Insel/current/scripts/insel/rueckfall.sh            # auf die zuletzt aktive Fassung
bash /Users/Shared/Klarwerk_Insel/current/scripts/insel/rueckfall.sh <release>  # auf eine bestimmte
```

**Daten fasst der Rückfall nicht an.** Nur `--daten-zurueck <sicherung>` spielt eine Sicherung ein:
ein `*.dump` geht an `scripts/backup/restore-drill.sh` (Sidecar-Prüfung, eigene leere Zieldatenbank —
die Produktionsdatenbank wird dabei ausdrücklich nicht angefasst), ein `*.jsonl` wird
zurückkopiert, nachdem der bisherige Journalstand daneben gesichert wurde. Führt **launchd** den
Server, sagt der Rückfall dazu, dass der alte Prozess beim Zurückspielen noch lief (er wird erst beim
`kickstart` ersetzt) — was er nach dieser Zeile noch ins Journal geschrieben hat, stand nicht in der
Sicherung und ist nach dem Neustart weg.

> **Offen und ausdrücklich benannt · Postgres-Datenrückweg.** Im Journalbetrieb ist
> `--daten-zurueck` ein vollständiger Rückweg: die Sicherung *ist* die Datei, sie wird
> zurückkopiert, und die App liest danach aus ihr. Im **Postgres**-Betrieb ist er es **nicht**:
> `restore-drill.sh` stellt den Dump in einer **eigenen, leeren** Datenbank wieder her und belegt
> damit, dass die Sicherung trägt (Struktur, Zeilenzahlen, Login, Auditkette) — die laufende App
> bleibt auf ihrer Produktionsdatenbank. Der letzte Schritt (Produktionsdatenbank durch den
> wiederhergestellten Stand ersetzen) ist **bewusst kein Skript dieses Jobs**: er gehört zu Paket B3
> (`scripts/backup/**`), und ein eigener Restore-Pfad daneben wäre genau der zweite, ungeübte Weg,
> den dieser Job abgeschafft hat. Bis dahin gilt für Postgres: **Rückfall des Codes automatisch,
> Rückweg der Daten mit Beleg, aber von Hand.**

**Die Datenhaltung überlebt das Update.** `start.command` im Release übernimmt eine gesetzte
`DATABASE_URL`/`KLARWERK_DATABASE_URL`, statt sie wegzuwerfen; nur ohne sie schaltet es auf das
Journal. Vorher erzwang es Journalbetrieb — auf einer Postgres-Insel wäre also ein Dump gesichert
und die App danach gegen ein Journal gestartet worden.

**Der `SCHEMA-STAND` wird vor dem Start mit `bestaetigt=nein` geschrieben und erst nach grünem
Health auf `ja` gesetzt.** Grund: `migrate()` läuft beim Serverstart, also **bevor** der Health-Check
antwortet. Nach einem Rückfall bleibt der Stand deshalb beim neuen Release und gilt als
unbestätigt — ein späterer Versuch, die alte Fassung einzuspielen, wird korrekt als Downgrade
abgelehnt, statt still durchzugehen.

**Welche Version läuft?** Die Antwort kommt aus dem Release, nicht aus seinem Verzeichnisnamen:
`SCHEMA-VERTRAG` (`app_version`), sonst `package.json` (`version`) — dieselbe Datei, aus der
`/health` liest. Trägt ein Release keine von beiden, schaltet der Rückfall trotzdem, behauptet aber
kein „aktiv", sondern sagt, dass die Version nicht belegbar ist (Exit 8).

Belegt durch `tests/insel-update/` (Update grün, Rückfall bei rotem Health, Rückfall bei falscher
Version, Downgrade, irreversible Stufe, Sicherung als Vorbedingung, Namenskollision, Wiederholung mit
erhaltenem Rückfallpunkt, gescheiterter launchd-Start mit Wiederanlauf der Vorversion, Übergang einer
Altinstallation, Doppelklick über `install.command`). Dass zwei Läufe in **derselben Sekunde**
einander die Sicherung nicht nehmen, misst `tests/insel-update/sicherung-eindeutig.test.ts` für den
Postgres-Zweig und `wiederholung-und-startfehler.test.ts` (W3) für den Journalzweig — beide mit
festgenageltem Zeitstempel, damit der Kollisionsfall wirklich gefahren wird und nicht bloss
wahrscheinlich ist. Die Postgres-Variante mit echtem `pg_dump` **gegen eine echte Datenbank** steht
zusätzlich in `tests/insel-update/update-postgres.integration.test.ts`
(`npm run test:integration`, sichtbarer Skip ohne Datenbank oder ohne `postgresql-client`).

### 6.2 Cloud / Coolify — Verfahren, nicht Zustand

**Backup (vor Update):**
- Hetzner-**Snapshot** des Servers/Volumes.
- **`pg_dump`** (Coolify-Scheduled-Task, verschlüsselt ablegen) — zusätzlich manuell vor riskanten Updates.

> **Unbestätigt (U4) · Das tägliche Backup der Datenbank läuft als Coolify-Scheduled-Task (`pg_dump`).**
> **Vorbehalt:** durch Ops/Pedi zu bestätigen — beschrieben ist das Verfahren, nicht seine Einrichtung.
> **Restrisiko:** ist die Aufgabe nicht eingerichtet, existiert im Wiederherstellungsfall kein aktueller Dump.
> **Bestätiger:** Ops/Pedi


**Rollback (wenn Update fehlschlägt):**
1. **App-Code:** in Coolify auf das **vorherige Deployment/Image** zurücksetzen (Redeploy previous) **oder** Git-Revert + Push → CI → Deploy.
2. **Datenbank:** bei fehlerhafter Migration **Restore** aus letztem `pg_dump`/Snapshot.
3. **Provider/Model:** Env auf vorherigen Wert (`REASONER_MODEL`/Key entfernen → deterministischer Fallback bleibt verfügbar).
4. **Secrets:** bei Rotation-Problem alten Wert (sofern noch gültig) reaktivieren bzw. neu rotieren (`secrets-management.md` §7).
5. Nach Rollback: `/health` + Kernpfad-Smoke; Vorfall dokumentieren.

> **Unbestätigt (U5) · Ein Rollback erfolgt durch erneutes Deployen des vorherigen Stands in Coolify.**
> **Vorbehalt:** durch Ops/Pedi zu bestätigen — der Weg ist beschrieben, aber nie geprobt; der DR-Drill steht aus.
> **Restrisiko:** trägt der Weg im Ernstfall nicht, bleibt nur der Wiederaufbau aus Snapshot und Dump.
> **Bestätiger:** Ops/Pedi


---

## 7. Wartungsfenster & Rollen

- **Fenster:** außerhalb der Hauptarbeitszeit; Dauer/Termin vorab kommunizieren. Major-DB/Runtime-Updates immer im geplanten Fenster.
- **Rollen** (Betreiber benennt namentlich):
  - **Release-/Deploy-Verantwortlicher:** führt Update + Smoke + Rollback aus.
  - **DB-/Infra-Verantwortlicher:** Backup/Restore, Server/Coolify.
  - **DSB/Security:** Compliance-/Secrets-Review (quartalsweise), Vorfallbewertung.
  - Governance/Eskalation: `docs/operations/governance-and-teams.md`.

---

## 8. Modell-/Provider-Evaluation (ohne neue Architektur)

Klarwerk ist **anbieteragnostisch**: ohne `ANTHROPIC_API_KEY` läuft der **deterministische Fallback**, mit Schlüssel der **Modellmodus** (`build-app.ts` → `ModelProvider`/`createModelClientFromEnv`). Ein Provider-/Modellwechsel ist eine **Env-Änderung**, kein Umbau:

1. Neues Modell/Provider in **Staging** via `REASONER_MODEL`/Key setzen.
2. **Reasoner-Status-Badge** (`/fragen`) prüft Modus/Provider/Modell transparent (`Reasoner.status()`).
3. Kernfragen testen: validiertes KO → quellengebundene Antwort; ohne Basis → ehrliche Wissenslücke (Antwortlogik/Quellenbindung bleibt unverändert).
4. **DSFA-/Datenfluss-Check** bei externem Anbieter (`gdpr-compliance-runbook.md` §2): verlässt der Modellmodus Daten an Dritte?
5. Erst nach grünem Staging + Compliance-Ok → Prod-Env umstellen. Rollback = Env zurück (Fallback immer verfügbar).

> Regel: **keine** Modellinstallation/RAG-/Vector-/Conductor-Arbeit — nur Konfiguration der vorhandenen Provider-Schicht.

---

## 9. Security-/Compliance-Review (an Updates gekoppelt)

- Nach jedem größeren Update: Secret-/Zugriffs-Check (`secrets-management.md`), RBAC unverändert, Audit-Integrität (`verify`/Analytics-Audit, `gdpr-compliance-runbook.md`).
- Default-/Demo-Credentials weiterhin geändert? Pre-Launch-Gate/TLS aktiv?
- Security-Patches der Update-Klasse „ad hoc" nicht aufschieben.

---

## 10. Post-Update-Monitoring

- **Sofort:** `/health` grün, Login, Kernpfad-Smoke, Coolify-Logs ohne Fehler-Spikes.
- **24–72 h:** Fehlerquote/Latenz beobachten; Backup-Lauf nach Update erfolgreich; Nutzer-Rückmeldungen.
- Auffälligkeiten → Rollback (§6) erwägen.

---

## 11. Notfallpfad

1. **Stabilisieren:** auf letztes funktionierendes Deployment/Backup zurück (§6).
2. **Eingrenzen:** Logs/Audit prüfen; betroffene Komponente/Update identifizieren.
3. **Secrets:** bei Verdacht auf Kompromittierung → Notfallrotation (`secrets-management.md` §7), Sessions invalidieren.
4. **Kommunizieren:** Stakeholder/Pedi informieren; bei DSGVO-Relevanz Meldepflichten prüfen.
5. **Nacharbeit:** Ursache dokumentieren, Gate/Checkliste ergänzen (Harness-Correction-Gedanke), erst dann erneut ausrollen.

---

## 12. Offene Betreiberpflichten / Nicht-Ziele

- **Staging-Umgebung** real bereitstellen (separate Coolify-App/DB) — Ops-Aufgabe.
- **Backup-Restore-Probe** regelmäßig tatsächlich durchführen (nicht nur dokumentiert).
- **Monitoring/Alerting** (Uptime, Fehlerraten) einrichten — Hosting-/Ops-Aufgabe.
- **Termine + namentliche Rollen** für Wartungsfenster festlegen.
- Keine neue Runtime/Infrastruktur, keine Modellinstallation in diesem Runbook.

---

*Read-only Ops-Runbook. Kein Produktcode geändert; keine Infrastruktur-/Runtime-/Modell-Installation. Verweist nur auf vorhandene Gates, Deploy- und Compliance-Doku.*
