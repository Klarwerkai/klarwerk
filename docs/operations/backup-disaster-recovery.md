# Klarwerk — Backups & Disaster Recovery (Betreiber-Runbook)

> Ops-Runbook zur Absicherung von Daten/Konfiguration gegen Verlust.
> Die historischen Sandbox-Aussagen in §11 beschreiben ihren damaligen Stand. Die erhaltenen
> Compose-Backup-/Restore-/Update-/Rückfallbelege vom 05.10.2026 gehören zum Kunden-Prüfplatz
> (§13). Der aktuelle native Live-Datenbankbetrieb wird gesondert in §14 dokumentiert.
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

- **Aktueller Live-Betrieb:** nativer PostgreSQL auf `klarwerk-db`, täglicher Weg über
  `/etc/cron.daily/klarwerk-pgdump`; Einrichtung und Nachweise siehe §14.
- **Coolify-Beispiel:** automatischer `pg_dump` als Coolify-Scheduled-Task, verschlüsselt ablegen.

> **Unbestätigt (U4) · Das tägliche Backup der Datenbank läuft als Coolify-Scheduled-Task (`pg_dump`).**
> **Vorbehalt:** durch Ops/Pedi zu bestätigen — beschrieben ist das Verfahren, nicht seine Einrichtung.
> **Restrisiko:** ist die Aufgabe nicht eingerichtet, existiert im Wiederherstellungsfall kein aktueller Dump.
> **Bestätiger:** Ops/Pedi

> **Unbestätigt (U8) · Die Coolify-Postgres-Ressource wird durch ein Coolify-Backup gesichert.**
> **Vorbehalt:** durch Ops/Pedi zu bestätigen — früher erwähnt, aber der DR-Drill steht aus.
> **Restrisiko:** ohne belegtes Backup ist die Wiederherstellbarkeit der Live-Daten unbewiesen.
> **Bestätiger:** Ops/Pedi

- **Täglich/Snapshot-Kadenz:** Hetzner-Server-/Volume-Snapshot.
- **Bei jedem Update:** zusätzlicher manueller `pg_dump` vor riskanten Migrationen (`maintenance-update-process.md` §6).
- **Bei Secret-/Config-Änderung:** Env-Inventar im Passwort-Manager aktualisieren.

---

## 3. Aufbewahrung / Offsite / Verschlüsselung

**Was das Skript durchsetzt** (`scripts/backup/backup.sh`, Details in `scripts/backup/RESTORE.md`):

- **Aufbewahrung im Zielverzeichnis:** `BACKUP_KEEP=<n≥1>` behält höchstens `n` **vollständige**
  Sicherungen (Dump **mit** Sidecar) und entfernt die ältesten darüber hinaus — Reihung nach dem
  Dateinamen (UTC), Dump und Sidecar immer gemeinsam, die soeben erzeugte Sicherung nie. `*.dump`
  ohne Sidecar und `*.partial` bleiben unberührt. **`BACKUP_KEEP` nicht gesetzt = es wird nichts
  gelöscht** (Standard). Die Zahl wird **dezimal** gelesen, auch mit führender Null (`08` = acht).
  `BACKUP_KEEP=0`, leer oder nicht-numerisch: Abbruch mit Exit 1, ohne zu löschen und ohne zu
  sichern.
- **Lesbarkeit vor Veröffentlichung, mit dem Werkzeug das da ist:** Ist `pg_restore` installiert,
  läuft `pg_restore --list` gegen den Arbeitsstand — das belegt ein lesbares **Archiv**. Fehlt es,
  läuft eine **Ersatzprüfung**, die die Datei vollständig liest (nicht leer, von Anfang bis Ende
  lesbar) — das belegt nur eine lesbare **Datei**, nichts über das Archivformat. Scheitert die
  jeweilige Prüfung, wird nichts veröffentlicht (Exit 4); ein **fehlendes** `pg_restore` ist
  dagegen **kein** Abbruchgrund, sonst nähme die Prüfung dem Betreiber genau das Backup weg, das sie
  schützen soll. Welche Stufe lief, steht im Protokoll und im `grund` der `letzter-lauf.json`
  (`Lesepruefung: pg_restore --list` bzw. `Lesepruefung: Ersatz (pg_restore fehlt)`); die volle
  Prüfung bekommt der Betreiber mit `apt-get install -y postgresql-client` (weitere Systeme:
  `scripts/backup/RESTORE.md`). **Keine** der beiden Stufen belegt einen gelungenen Restore — dafür
  steht der Drill (§7, `docs/operations/restore-drill.md`).
- **Ein Fehlschlag beschädigt nie die letzte gültige Sicherung:** Vorhandene Dumps und Prüfsummen
  werden weder überschrieben noch gelöscht — egal, an welcher Stelle ein Lauf abbricht. Treffen
  zwei Läufe dieselbe Sekunde und damit denselben Namen, weicht der zweite auf
  `klarwerk-<ZEITSTEMPEL>_02.dump` aus; beide Sicherungen bleiben. Nach jedem Fehlschlag ist der
  vorhandene Bestand byte-gleich und seine Prüfsumme passt weiterhin.
- **Ergebnisspur:** jeder Lauf hinterlegt `<ZIEL>/letzter-lauf.json` (auch und zuerst der
  gescheiterte) — einschließlich unerwarteter Werkzeugfehler und einschließlich des Falls, dass das
  Werkzeug der Spur selbst ausfällt, damit nie die Erfolgsmeldung des Vortags stehen bleibt. Kommt
  der Fehler **nach** der Veröffentlichung, ist der Lauf gescheitert (`"fehler"`), die Sicherung
  aber gültig — die Spur nennt sie dann in `datei`/`bytes`/`sha256`, statt sie zu bestreiten. Fehlt
  die Datei, hat nie ein Lauf ein Ergebnis hinterlegt — das ist **nicht** „alles in Ordnung".

**Was Betreiberpflicht bleibt** (das Skript liefert es nicht, siehe §12):

- **Aufbewahrungsstufen über ein Zielverzeichnis hinaus (Vorschlag):** täglich 7–14 Tage, wöchentlich 4–8 Wochen, monatlich 6–12 Monate (DSGVO-Löschfristen beachten, `gdpr-compliance-runbook.md`). `BACKUP_KEEP` kennt nur EINE Stufe je Verzeichnis; gestufte Aufbewahrung heißt: mehrere Ziele mit je eigener Kadenz und eigenem `BACKUP_KEEP`.
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
>
> **Compose-Kundeninstanz:** der Drill samt Aktualisierung und Rückweg ist dort ein Befehl (§13); sein JSON-Beleg füllt diese Tabelle. Der Prüfplatz-Lauf (B3, `pruefplatz-b3`) ist am 26.09.2026 **noch nicht gefahren**; derselbe Ablauf ist lokal unter Docker gefahren (`restore-drill.md` E2).

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

## 13. Compose-Kundeninstanz (Ein-Befehl-Weg) — Sicherung, Wiederherstellung, Aktualisierung, Rückweg

Gilt für eine Instanz nach `kundeninstanz-neuinstallation.md` (`docker-compose.prod.yml`, Dienste
`db` + `app`, Volume `pgdata`). §1–§12 oben beschreiben den Coolify-Betrieb; die Befehle hier sind
die des Compose-Wegs. Einzelheiten, Exitcodes und die Gegenproben stehen in
`docs/operations/restore-drill.md`, Abschnitt „Compose-Kundeninstanz".

**Werkzeuge:** `scripts/backup/backup.sh` (unverändert) mit den Adaptern `scripts/backup/compose/`
— `pg_dump` läuft **im Datenbankcontainer** per `docker compose exec`, ohne Kennwort — und
`scripts/backup/compose-drill.sh` als Rahmen für Sicherung mit Herkunft, Zweitkopie, Übung,
Ernstfall, Aktualisierung und Rückweg.

### 13.1 Voraussetzungen

- Docker Engine + Compose v2, `bash`, `sha256sum` (oder `shasum`), `tar`, `openssl`; `rsync` empfohlen.
- Projektname der Instanz (`docker compose ls`; beim Ein-Befehl-Weg der Ordnername, hier `klarwerk`),
  Instanzordner mit `.env` (hier `/opt/klarwerk`). `COMPOSE_DATEIEN` = genau die Dateien, mit denen
  die Instanz läuft (Vorgabe `docker-compose.prod.yml`; das Skript prüft es).
- Arbeitsordner `/opt/b3-arbeit-klarwerk` (Vorgabe `<Elternordner>/b3-arbeit-<projekt>`) mit
  Sicherungen, **Instanzkennung** `instanz.id` und dem **Schlüssel** der Zweitkopie
  `geheim/auslagerung.schluessel` — beide wie die `.env` getrennt verwahren (Passwort-Manager).
- Ein **zweiter Ort**: ein eingehängter, vom Server getrennter Speicher (anderes Volume/Provider),
  hier `/mnt/zweitort/klarwerk`.

### 13.2 Täglich sichern — Herkunft, Aufbewahrung, verschlüsselte Zweitkopie (R-0839, R-0850)

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk ZWEITER_ORT=/mnt/zweitort/klarwerk \
  bash /opt/klarwerk/scripts/backup/compose-drill.sh taeglich
```

Zeitplan (Beispiel `/etc/cron.d/klarwerk-sicherung`):

```
15 3 * * * betrieb PROJEKT=klarwerk STACK=/opt/klarwerk ZWEITER_ORT=/mnt/zweitort/klarwerk bash /opt/klarwerk/scripts/backup/compose-drill.sh taeglich >> /var/log/klarwerk-sicherung.log 2>&1
```

- **Sicherung:** `backup.sh` mit `DATABASE_URL=postgresql://klarwerk@db/klarwerk_prod` (kein
  Kennwort) über die Adapter, `BACKUP_KEEP=14` Generationen in
  `/opt/b3-arbeit-klarwerk/sicherungen/taeglich`. Ein Dump deckt Wissensobjekte, Anhänge (`objects`)
  und Prüfspur (`audit`) gemeinsam ab (§1).
- **Herkunftsnachweis** je Sicherung (`<dump>.herkunft.json`): Instanzkennung, Datenbank,
  PostgreSQL-Systemkennung, Stand der Instanz, `/health` (Version, Commit), SHA-256, Zeitpunkt.
  Dasselbe gilt für die Vorab-Sicherung jeder Aktualisierung (§13.5).
- **Zweitkopie:** Dump + Prüfsumme + Herkunft, verschlüsselt (AES-256, `openssl enc -pbkdf2`),
  gestaffelt: `tage/` 14, `wochen/` 8, `monate/` 12 (`AUSLAGERUNG_TAGE/WOCHEN/MONATE`). Ohne
  Herkunftsnachweis oder bei gescheitertem Kopieren ins Paket wird **nichts** ausgelagert (Exit
  170) — eine Zweitkopie ohne Nachweis ließe sich nicht zurückspielen (161). Nach dem Schreiben
  entschlüsselt: Dump gegen die Prüfsumme, Herkunftsnachweis bytegleich gegen das Original, jede
  neue Stufenkopie gegen ihren eigenen Sidecar (Exit 170 sonst). Der Schlüssel liegt nie am zweiten Ort; er und die
  Instanzkennung werden beim ersten Lauf genau einmal atomar angelegt.
- Jede Sicherung hat ihre Prüfsumme (`.sha256`); stimmt sie nicht, startet weder der Drill (10/11)
  noch das Zurückspielen (160) `pg_restore`.

### 13.3 Wiederherstellung üben (monatlich)

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk DRILL_LOGIN_EMAIL=admin@kunde.de \
  bash /opt/klarwerk/scripts/backup/compose-drill.sh wiederherstellen \
  /opt/b3-arbeit-klarwerk/sicherungen/taeglich/klarwerk-<UTC>.dump
```

Prüft zuerst die **Instanzbindung** (Exit 161 bei fremder oder ungebundener Sicherung), spielt den
Dump dann mit dem **unveränderten** `restore-drill.sh` in eine frische Datenbank
`klarwerk_drill_<lauf>` derselben PostgreSQL, startet das Produktabbild dagegen und räumt beides
wieder weg. `klarwerk_prod` bleibt unberührt. Das Kennwort des Anmeldekontos liegt in
`<ARBEIT>/geheim/drill-login`. Beleg: `belege/b3-<lauf>-wiederherstellen.json` samt Sekunden.

### 13.4 Ernstfall: den eigenen Bestand zurückspielen

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk ZURUECKSPIELEN_BESTAETIGT=klarwerk_prod \
  bash /opt/klarwerk/scripts/backup/compose-drill.sh zurueckspielen \
  /opt/b3-arbeit-klarwerk/sicherungen/taeglich/klarwerk-<UTC>.dump
```

Kein Befehlsblock zum Abtippen mehr: bis zur Prüfung Runde 1 stand hier eine Folge, die nach einem
gescheiterten Umbenennen und einem gescheiterten `createdb` trotzdem `pg_restore` und `up` ausführte
und mit 0 endete. Der Schritt `zurueckspielen` prüft **jeden** Schritt:

1. Bestätigung (Exit 1), Prüfsumme (160), Instanzbindung (161) — bis hier ist nichts angefasst.
2. App anhalten → `klarwerk_prod` in `klarwerk_prod_vor_<lauf>` **umbenennen** (nie löschen) →
   leeres `klarwerk_prod` anlegen → **Leere feststellen** → `pg_restore --exit-on-error` → App
   starten und auf „healthy" warten → Inhalt und Bestand vergleichen.
3. Scheitert einer dieser Schritte: neues Ziel verwerfen, alten Bestand zurückbenennen, App wieder
   starten und auf „healthy" prüfen (Exit 162). Scheitert das Zurückbenennen, das `up` oder die
   Gesundheit: Exit 163, der Beleg nennt den Grund und den Namen des alten Bestands.

Der alte Bestand bleibt als `klarwerk_prod_vor_<lauf>` liegen, bis der Betreiber ihn nach Prüfung
selbst entfernt. Nach einem **Serverausfall** bekommt die neu aufgesetzte Instanz zuerst ihre
gesicherte `instanz.id` (und die `.env`) zurück; die Sicherung holt man vom zweiten Ort
(`openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:<schluessel> -in <kopie> | tar -xf -`).

Gemessen: dockerfrei mit Fehlschlag an jedem Schritt
(`tests/kundenbetrieb-compose/ernstfall-bindung-auslagerung.test.ts`, E1–E8); gegen die echte
PostgreSQL im Schritt `zurueckspielen` des `ablauf`: auf dem Prüfplatz **Stand 26.09.2026 noch nicht
gefahren**; lokal unter Docker gefahren (26.09.2026, `restore-drill.md` E2): Exit 0, Ausfallzeit 8 s,
eingespielter Stand 184 s alt, Inhaltsprüfsumme vorher = nachher, alter Bestand als
`klarwerk_prod_vor_20260926t110706z` erhalten.

### 13.5 Aktualisieren und Rückweg

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk \
  bash /opt/klarwerk-neu/scripts/backup/compose-drill.sh aktualisieren /opt/klarwerk-neu
```

Reihenfolge: Compose-Dateien prüfen → Vorher-Stand festhalten (Abbild, Startzeit, `/health`,
**Inhaltsprüfsumme** — scheitert sie, keine Aktualisierung, Exit 111) → Abbild als
`klarwerk-app:rueckfall` markieren → **Vorab-Sicherung** mit Herkunft → Quellbaum ersetzen
(`.env`, `belege` und instanzeigene Compose-Dateien bleiben) → `docker compose config` → `build` mit
`SOURCE_COMMIT` → `up -d --no-deps --force-recreate app` (Volumes bleiben) → „healthy" + neuer
Commit in `/health` → Inhaltsprüfsumme und Bestand vergleichen (auch nach einem Rückweg).

- Fehlt eine Pflichtvariable: Compose nennt sie, **nichts** wird gebaut oder ausgerollt (Exit 121).
- Startet die neue Ausgabe nicht gesund oder meldet `/health` den falschen Stand: das vorherige
  Abbild wird **erneut ausgerollt** (Exit 122/124, die Meldung nennt den Grund); scheitert auch das,
  Exit 123.
- **Datenhälfte:** das alte Abbild bringt nicht den alten Datenstand zurück. Hat die neue Ausgabe
  schon migriert, wird die Vorab-Sicherung mit §13.4 eingespielt.

### 13.6 RPO/RTO — was gemessen wird und was festgelegt werden muss (R-0863, R-2070, NFR-OPS-02)

Gemessen wird bei jedem Lauf:

| Kennzahl | Messung | Beleg |
| --- | --- | --- |
| RTO (Ausfallzeit im Ernstfall) | `zurueckspielen`: App anhalten bis App wieder „healthy" | `b3-<lauf>-zurueckspielen.json` → `ausfall_sekunden` |
| RPO (Datenverlust) | Alter des eingespielten Stands zum Zeitpunkt des Zurückspielens (aus dem Herkunftsnachweis); beim Zeitplan „täglich" höchstens der Abstand zweier Läufe | `…-zurueckspielen.json` → `stand_alter_sekunden`; Zeitplan §13.2 |
| Übungsdauer | `wiederherstellen`: Drill-Sekunden | `…-wiederherstellen.json` → `drill_sekunden` |

Ein festgelegtes Ziel wird mit `RTO_ZIEL_SEKUNDEN` / `RPO_ZIEL_SEKUNDEN` geprüft; eine
Überschreitung ist Exit 164. **Die Zielwerte je Kundenklasse legt Pedi fest** — sie sind eine
Zusage an Kunden, keine technische Größe. Bis dahin gelten die **Vorschläge** aus §4 (RPO ≤ 24 h,
RTO ≤ 4 h) für alle Klassen; eine Festlegung je Kundenklasse liegt **nicht** vor.

**Erste echte Messung (26.09.2026, lokaler Compose-Lauf, `restore-drill.md` E2)** — ein Messpunkt an
einer kleinen Probeinstanz (Dump 71 556 Bytes), **keine** Zusage und keine Aussage über Kundengrößen:
Ausfallzeit beim Zurückspielen 8 s (`ausfall_sekunden`), Alter des eingespielten Stands 184 s
(`stand_alter_sekunden`), Übungs-Drill 7 s (`drill_sekunden`). Ohne `RTO_ZIEL_SEKUNDEN`/`RPO_ZIEL_SEKUNDEN`
lief keine Zielprüfung — es gibt keinen festgelegten Wert, gegen den sie prüfen könnte.

### 13.7 Stand der Nachweise (26.09.2026)

| Aussage | Beleg | Stand |
| --- | --- | --- |
| Sicherung über `docker compose exec`, ohne Kennwort, Aufbewahrung, Herkunft | `tests/kundenbetrieb-compose/*` (Docker-Attrappe); lokaler Compose-Lauf `sichern` (3 Läufe, `BACKUP_KEEP=2`, 2 bleiben, `kennwort_im_log=nein`) | dockerfrei gemessen; **echt gemessen** (Docker, 26.09.); Prüfplatz **offen** |
| verschlüsselte, gestaffelte Zweitkopie, zurückgelesen; gescheiterte Periodenkopie wird nachgeholt statt übergangen; Herkunftsnachweis Pflicht in der Zweitkopie | `ernstfall-bindung-auslagerung.test.ts` Z1–Z4, `parallel-und-rueckweg.test.ts` R3-1, `tests/kundenbetrieb-sicherung/zweitkopie-herkunft.test.ts` ZH1–ZH4 (echtes `openssl`, Kopierstörung auch im vollständigen `ablauf`); lokaler Lauf `taeglich` (nachgeprüft: ja, Fassung vor der B1-Korrektur) | gemessen; ein echter zweiter Ort beim Kunden ist **nicht eingerichtet** |
| Instanzbindung inkl. Gegenprobe gegen das falsche Ziel | I1–I4; `gegenprobe` G4/G5 (161, kein Ziel angelegt) | dockerfrei und **echt gemessen**; Prüfplatz **offen** |
| Ernstfall-Zurückspielen mit Rückweg an jedem Schritt | E1–E8; lokaler Lauf `zurueckspielen` (Exit 0, 8 s, Inhalt gleich) | Erfolgsweg **echt gemessen**; Fehlschlagszweige nur dockerfrei; Prüfplatz **offen** |
| Wiederherstellung in frische DB, Anwendung dagegen, Anhang byte-identisch | W1–W4 (Testserver-PG und lokaler Lauf `pruefen`: 10/10 Integrationsfälle, 272/272 Vertragsfälle, kein Skip); `wiederherstellen` (Drill exit 0, 45 Pflichttabellen, 512 Bytes Anhang zurückgelesen) | **echt gemessen**; Prüfplatz **offen** |
| Aktualisierung + Rückweg (kaputtes Abbild, fehlende Pflichtvariable) | U1/U2, R1–R4, B2/B3/B5; lokaler Lauf `aktualisieren` (`c38f2d71` → `1a51d968`, `/health` 1.0.0-beta.1.608 → .609, Inhalt gleich) und `rueckweg` (122/121, Bestand gleich) | **echt gemessen**; Prüfplatz **offen** |
| Aussagekraft (K5): veränderte Prüfsumme, fehlende Tabelle, ausgelassener Neustart | lokaler Lauf `gegenprobe`: 11 / 22 (nennt `ko_evidence`) / 130; echte Sicherung vorher = nachher | **echt gemessen**; Prüfplatz **offen** |
| RPO/RTO je Kundenklasse | Messfelder und Zielprüfung (164) | Festlegung **offen** (Entscheidung Pedi) |

Die Zuordnung aller Anforderungen dieses Auftrags steht in
`docs/operations/b3-sicherung-zuordnung.md`.

---

## 14. Nativer Live-Datenbankbetrieb (Bestandsabgleich 06.10.2026)

Die Live-Anwendung läuft auf `klarwerk-prod` (116.203.127.201), ihre tatsächliche
`DATABASE_URL` zeigt auf `klarwerk-db` (46.225.24.151 / 10.10.0.3), Datenbank `klarwerk`.
Dort läuft PostgreSQL 18.6 nativ. Die beiden PostgreSQL-16-Container auf `klarwerk-prod`
sind nicht die Datenbank der heutigen Live-Anwendung. Vor Änderungen immer die tatsächliche
Laufzeitkonfiguration prüfen; eine zweite Ablage auf `klarwerk-db` wäre für diese Datenbank
keine unabhängige Sicherung.

Der bestehende tägliche Einstieg ist `/etc/cron.daily/klarwerk-pgdump`, vom vorhandenen
System-Cron um 06:25 UTC ausgeführt. Seine bisherigen Dumps liegen unter
`/var/backups/klarwerk` und bleiben bei der Erweiterung erhalten. Der neue Betreiberweg ist:

```bash
runuser -u postgres -- bash /opt/klarwerk-sicherung/scripts/backup/betrieb-sicherung.sh \
  /etc/klarwerk/backup.env
```

`backup.env` wird vom Betreiber außerhalb des Repositorys verwaltet. Benötigt werden
`PGHOST`, `PGUSER`, `PGDATABASE`, `DATABASE_URL` (lokaler Socket, kein Kennwort),
`ARBEIT`, `VERSCHLUESSELT`, `PROJEKT`, `AUSLAGERUNG_SCHLUESSEL`, `HEALTH_URL`,
`SSH_KONFIG`, `ZWEITHOST` und `ZWEITPFAD`. Die PostgreSQL-Variablen sind zu exportieren.
`ZWEITPFAD` wird vom eingerichteten SSH-/Rsync-Zugang auf den freigegebenen Zielordner
abgebildet; auch dessen Wurzel `/` wird unterstützt.

- `datenstand.py` hält einen exportierten PostgreSQL-Snapshot offen. Das unveränderte
  `backup.sh` erhält ihn über den Adapter `native/pg_dump`. Dump und Messung sämtlicher
  öffentlicher Tabellen verwenden genau denselben Snapshot. Der Herkunftsnachweis nennt
  seinen Zeitpunkt, die Clusterkennung, Dump-SHA-256, Zeilenzahlen und SHA-256 über
  kanonische Zeilen sowie den unveränderten gesunden Anwendungsstand vor/nach dem Export.
- Die bestehende Funktion `compose-drill.sh auslagern` verpackt Dump, Sidecar und Herkunft
  mit AES-256-CBC/PBKDF2 (200.000 Iterationen). Dieser reine Dateischritt braucht auch im
  nativen Betrieb weder Docker noch eine Compose-`.env`. Alle übrigen Compose-Schritte
  behalten ihre bisherigen Voraussetzungen.
- `VERSCHLUESSELT` ist eine lokale Arbeitsablage. Erst die Übertragung auf den tatsächlich
  anderen Host **und die Rücklesung von dort** sind der Zweitortnachweis. Der zurückgelesene
  verschlüsselte Hash, entschlüsselte Dump und Herkunftsnachweis müssen bytegleich sein.
- Standardaufbewahrung: 14 vollständige lokale Dump-Paare; verschlüsselt 14 Tagesstände,
  die erste Sicherung aus jeweils 8 Wochen und 12 Monaten. Rsync gleicht die gestaffelte
  Ablage mit dem gewählten Zielordner ab. Es werden keine fremden Sicherungsordner verwendet.
- Ein paralleler täglicher Lauf wird durch `flock` abgewiesen. Ein Übertragungsfehler
  meldet keinen Erfolg. Jeder gestartete Lauf hinterlegt seinen tatsächlichen Exit in
  `<ARBEIT>/letzter-lauf.json` und einen eigenen Beleg unter `<ARBEIT>/belege`.
- Der Schlüssel liegt getrennt von der Zweitkopie unter `/etc/klarwerk/backup.key` auf
  dem Datenbankhost und im macOS-Schlüsselbund (`de.klarwerk.backup`, Konto
  `klarwerk-live-postgresql`). Schlüssel und Datenbankkennwörter gehören nicht in Git,
  Auftragsbelege oder Chat-Ausgaben.

Die erhaltenen Prüfplatzbelege vom 05.10.2026 erfüllen den Compose-Restore-, Update- und
Rückfallumfang: 16 Integrationsfälle und 273 Vertragsfälle ohne Skip, zehn erfolgreiche
Ablaufschritte und bytegleiche Anhänge. Die damals verwendete Zweitablage war nur ein Pfad
auf derselben temporären VM. Sie belegt keinen unabhängigen Sicherungsort.

Aktuelle Betriebsbelege werden im bestehenden Auftrag unter `BETRIEB-20261006` gesammelt.
Ein nativer Dump und die kalibrierte Verschlüsselungs-/Übertragungsstrecke sind ausgeführt.
Die korrigierte Auswahl des unabhängigen Zweithosts, die Aktivierung im täglichen Einstieg
und der Restore aus der tatsächlichen Zweitkopie stehen zu diesem Dokumentstand noch aus.
Ein lokaler Verschlüsselungsnachweis zählt nicht als deren Abschluss.

Verbindliche RPO-/RTO-Ziele je Kundenklasse fehlen weiterhin (R-0863, R-2070,
SOLL:NFR-OPS-02). Kundenklassen, maximal zulässiger Datenverlust und Ausfallzeit sowie
Geltungsumfang und Messbeginn/-ende müssen fachlich festgelegt werden. Die alten
Vorschläge von 24 Stunden / 4 Stunden sind keine Zusagen. Übungsdauer und Snapshotalter
sind Messwerte; ohne Ziele wird keine Einhaltung zugesagt. Der Datenbankdump enthält
keine Coolify-Konfiguration oder außerhalb der Datenbank verwahrten Anwendungsgeheimnisse.

*§13 beschreibt den Compose-Prüfplatz, §14 den tatsächlich vorgefundenen nativen Betrieb.
Ein technischer Teilfortschritt ist kein Gesamtabschluss des Auftrags.*
