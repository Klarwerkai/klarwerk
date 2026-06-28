# Klarwerk — Backups & Disaster Recovery (Betreiber-Runbook)

> Ops-Runbook zur Absicherung von Daten/Konfiguration gegen Verlust.
> **Ehrlichkeitsregel:** Dieses Dokument behauptet **nicht**, dass ein produktiver Restore-Drill
> durchgeführt wurde. Sandbox-verifiziert ist nur ein **logischer Export** (siehe §11); der
> **produktive `pg_dump`/Restore-Drill bleibt offene Betreiber-/Ops-Aufgabe**.
> Verwandte Doku: `docs/operations/deploy-hetzner.md`, `maintenance-update-process.md`,
> `secrets-management.md`, `docs/compliance/gdpr-compliance-runbook.md`.

---

## 1. Backup-Scope / Artefakt-Inventar

| Artefakt | Wo | Wie sichern | Hinweis |
| --- | --- | --- | --- |
| **Postgres-Datenbank** | Coolify-Postgres (Hetzner-Volume) | `pg_dump` (logisch) + Hetzner-Snapshot (physisch) | **enthält ALLE Modul-Daten** |
| ↳ Wissensobjekte, Versionen, Evidence | Postgres-Tabellen | über Postgres-Backup | — |
| ↳ **Anhänge/Objekt-Store** | Postgres-Tabelle `objects` | über Postgres-Backup | **kein separater Datei-Store** → ein `pg_dump` deckt Anhänge mit ab |
| ↳ **Audit-Log** (append-only Hash-Kette) | Postgres-Tabelle | über Postgres-Backup | nur **vollständig** restoren (Teil-Restore bricht die Kette, siehe §9) |
| ↳ Auth/Users, Capture, Ask/Gaps, Validation, Conflicts, Lifecycle, Import-Candidates, Model-Runs | Postgres-Tabellen | über Postgres-Backup | DDL in `services/app/src/db.ts#migrate` |
| **Env/Secrets-Konfiguration** | Coolify-Env (Laufzeit) + Passwort-Manager | dokumentierter Wertbestand; **nie ins Repo** | Wiederherstellung = neu setzen (`secrets-management.md`) |
| **Deploy-/Coolify-Konfiguration** | Coolify | Export der App-/Service-Konfig + Notizen | Reproduktion via `deploy-hetzner.md` |
| **Git-Repo (Code + Runbooks)** | Git-Remote(s) | Remote = Backup; ggf. zweites Mirror | Code/Doku sind versioniert |
| **Logische Wissens-Exporte** | App `GET /api/library/export` (JSON/MD/MediaWiki/HTML) | periodisch ziehen + sichern | **portabler Zusatz-Backup** der Wissensinhalte (nicht DB-vollständig) |

**Kern-Erkenntnis:** Ein **vollständiger Postgres-Dump sichert KOs, Anhänge UND Audit gemeinsam** — es gibt **keinen** separaten Datei-/Objektspeicher. Secrets und Coolify-Config liegen **außerhalb** der DB und sind getrennt zu sichern.

---

## 2. Backup-Zeitplan (Vorschlag — Betreiber bestätigt/terminiert)

- **Täglich:** automatischer `pg_dump` (Coolify-Scheduled-Task), verschlüsselt ablegen.
- **Täglich/Snapshot-Kadenz:** Hetzner-Server-/Volume-Snapshot.
- **Bei jedem Update:** zusätzlicher manueller `pg_dump` vor riskanten Migrationen (`maintenance-update-process.md` §6).
- **Bei Secret-/Config-Änderung:** Env-Inventar im Passwort-Manager aktualisieren.

---

## 3. Aufbewahrung / Offsite / Verschlüsselung

- **Aufbewahrung (Vorschlag):** täglich 7–14 Tage, wöchentlich 4–8 Wochen, monatlich 6–12 Monate (DSGVO-Löschfristen beachten, `gdpr-compliance-runbook.md`).
- **Offsite:** Backups an einen vom Produktionsserver **getrennten** Ort kopieren (anderes Volume/Provider/Region) — Schutz gegen Server-Totalausfall.
- **Verschlüsselung:** Dumps **verschlüsselt** ablegen; Schlüssel im Passwort-Manager/Secret-Store, **nicht** neben dem Backup.

---

## 4. RTO / RPO (Vorschlag — Betreiber bestätigt)

| Kennzahl | Zielwert (Vorschlag) | Begründung |
| --- | --- | --- |
| **RPO** (max. Datenverlust) | **≤ 24 h** | tägliches Backup; bei Bedarf häufiger (z. B. 6 h) |
| **RTO** (max. Ausfallzeit bis Wiederherstellung) | **≤ 4 h** | Restore Dump + `migrate` + Redeploy + Smoke |

> Diese Werte sind **Vorschläge**. Der Betreiber legt verbindliche RTO/RPO nach Geschäftsbedarf fest und prüft sie im Restore-Drill (§7).

---

## 5. Restore-Runbook (Postgres)

1. **Stillstand sichern:** App/Service in Coolify stoppen (kein Schreibzugriff während Restore).
2. **Zielzustand wählen:** jüngstes konsistentes `pg_dump` (oder Snapshot) identifizieren.
3. **DB wiederherstellen:**
   - Logisch: neue/leere DB anlegen → `pg_restore`/`psql < dump.sql` einspielen.
   - Schema bei Bedarf erzeugen: Start der App ruft `migrate()` (idempotente DDL, `IF NOT EXISTS`) — sicher auch über bestehenden Restore.
4. **Secrets/Env prüfen:** `DATABASE_URL` auf die wiederhergestellte DB; übrige Secrets vorhanden (`secrets-management.md`).
5. **Redeploy** in Coolify; **Smoke-Test:** `GET /health` → `{"status":"ok"}`, Login, Kernpfad (`docs/demo/stage-1-demo-path.md`).
6. **Audit-Integrität prüfen:** `verify`/Analytics-Audit (Hash-Kette) — vollständiger Restore erhält die Kette.
7. **Freigabe** durch Verantwortlichen; Vorfall/Restore dokumentieren.

**Server-Totalverlust:** neuen Hetzner-Server + Coolify aufsetzen (`deploy-hetzner.md`), Repo verbinden, Secrets neu setzen, DB-Restore wie oben, DNS/TLS prüfen.

---

## 6. Objekt-/Attachment-Daten

Anhänge liegen in der Postgres-Tabelle `objects` → **durch den Postgres-Restore automatisch mit wiederhergestellt**. Kein separater Datei-Restore nötig. (Falls künftig ein externer Objektspeicher angebunden wird, ist dieser separat in den Backup-Scope aufzunehmen — derzeit nicht der Fall.)

---

## 7. Restore-Drill-Protokoll (Vorlage — **noch nicht produktiv ausgeführt**)

| Feld | Eintrag |
| --- | --- |
| Datum / Verantwortlicher | _offen_ |
| Backup-Quelle (Datum/Größe) | _offen_ |
| Restore-Ziel (isolierte Test-DB/-Instanz) | _offen_ |
| Schritte 1–7 (§5) erfolgreich? | _offen_ |
| Smoke `/health` + Kernpfad ok? | _offen_ |
| Audit `verify` true? | _offen_ |
| Gemessene RTO / Datenstand (RPO) | _offen_ |
| Abweichungen / Findings | _offen_ |

> **Pflicht:** mindestens **quartalsweise** einen Restore-Drill gegen eine **isolierte** Test-DB/-Instanz fahren (nie gegen Produktion), Ergebnis hier protokollieren. Erst ein bestandener Drill belegt RTO/RPO.

---

## 8. Secrets / Env-Config & Deploy-Konfiguration

- **Secrets:** Wiederherstellung = im Secret-Store/Coolify neu setzen (Quelle: Passwort-Manager). **Nicht** im DB-Backup enthalten — bewusst getrennt (`secrets-management.md`).
- **Coolify/Deploy-Config:** App-/Service-Definition, Domains, TLS, Scheduled-Tasks dokumentieren/exportieren, um sie reproduzierbar neu anzulegen.
- **Git:** Remote(s) sind das Code-/Doku-Backup; optional zweites Mirror-Remote.

---

## 9. Audit-/Evidence-Besonderheiten

- Das Audit-Log ist **append-only mit Hash-Kette** (`gdpr-compliance-runbook.md`, SCRUM-214). Beim Restore **immer den vollständigen Audit-Bestand** zurückspielen — ein selektiver/teilweiser Restore würde die Kette brechen (`verify` → false).
- Nach Restore `verify`/Analytics-Audit prüfen, um Integrität/Nachvollziehbarkeit zu bestätigen.

---

## 10. Notfall-Kommunikation

1. Vorfall feststellen → **Stabilisieren** (letztes gutes Backup/Deployment, §5).
2. Stakeholder/Pedi + Verantwortliche informieren (Rollen: `governance-and-teams.md`, `maintenance-update-process.md` §7).
3. Bei Datenverlust/-leck **DSGVO-Meldepflichten** prüfen (`gdpr-compliance-runbook.md`).
4. Nachbereitung: Ursache + Restore protokollieren, Lücke im Runbook/Drill schließen.

---

## 11. Sandbox-Verifikation (ehrliche Evidence)

**Real geprüft (sandbox-sicher, gegen lokale In-Memory-Instanz):** Der **logische Wissens-Export** als portables Backup-Artefakt funktioniert — `GET /api/library/export` lieferte nach Demo-Seed **5 KOs** als **JSON (4264 Bytes)** mit Feldern `title/status/sources` sowie ein **Markdown-Export**. Damit ist der **logische Content-Backup-Pfad** belegt.

**NICHT geprüft (nicht möglich in der Sandbox):** Ein produktiver **`pg_dump`/`pg_restore`-Drill** — es läuft **kein Postgres** und kein Docker/Testcontainers im Sandbox. Schema-Wiederherstellung ist code-seitig belegt (`db.ts#migrate` mit `IF NOT EXISTS`-DDL aller 13 Modul-Schemas), aber **der echte Restore-Drill steht aus**.

> **Kein Überclaiming:** „Restore getestet" gilt **nur** für den logischen Export, **nicht** für den Postgres-Restore.

---

## 12. Offene Betreiberpflichten / Nicht-Ziele

- **Produktiver `pg_dump`/Restore-Drill** gegen eine isolierte Test-DB **durchführen und protokollieren** (§7) — **offener Ops-Blocker** für die volle Akzeptanz.
- **Offsite-Kopie + Verschlüsselung** der Dumps tatsächlich einrichten (Schlüssel getrennt verwahren).
- **Verbindliche RTO/RPO** festlegen und durch Drill bestätigen.
- **Coolify-/Deploy-Konfig-Export** als Teil des Backups etablieren.
- Keine Infrastrukturänderung, keine produktiven Backups in diesem Dokument erzeugt/vorgetäuscht.

---

*Read-only Ops-Runbook. Kein Produktcode geändert; keine produktiven Backups erzeugt; keine Infrastruktur angefasst. Sandbox-Evidence ausschließlich logischer Export (§11).*
