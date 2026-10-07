# Die Produktionsdatenbank neu aufsetzen — Reihenfolge, Voraussetzungen, Abnahme

**Zweck:** Beim nächsten Neuaufsetzen der Produktionsdatenbank entstehen Rolle und Schema
**wirklich neu**, statt vorausgesetzt zu werden. Dieser Text legt **vorher** fest, in welcher
Reihenfolge das geschieht, was dafür vorliegen muss und woran die Abnahme gemessen wird
(Register R-1155, `OFFEN.md` E5). Er schließt zugleich den offenen Rest von `OFFEN.md` E7 an: Die
laufende Datenbank heißt noch `klarwerk`; der Quellstand nennt `klarwerk_prod`.

**Was dieser Text nicht tut:** Er führt nichts aus und gibt nichts frei. Pedi gibt frei, der Kopf
führt aus (E7). Die Coolify-Laufzeitumgebung ist aus dem Repository nicht messbar; jede Aussage
darüber steht unten als Prüfschritt, nicht als Befund.

---

## 0. Was entschieden ist — und was nicht

| Punkt | Stand | Quelle |
|---|---|---|
| Rolle und Schema werden **nicht** in die bestehende Datenbank nachgerüstet, sondern entstehen mit dem neuen Aufsetzen. | **Entschieden** („entfällt — wir starten neu“) | `OFFEN.md` E5 |
| Die Produktionsdatenbank heißt künftig `klarwerk_prod`; Entwicklung `klarwerk_dev`, Test `klarwerk_test`. | **Im Quellstand umgesetzt** (JOB 2354, Commit `46c9386`) | `docker-compose.prod.yml`, `tests/app/job2354-drei-datenbanknamen.test.ts` |
| Wird der Bestand der laufenden Datenbank `klarwerk` in die neue übernommen — oder beginnt sie leer? | **Offen — Entscheidung bei Pedi** | `ENTSCHEIDUNGEN/E-DATENBANKNAME-MIGRATION-20260826.json` (außerhalb des Repositorys) |

Der dritte Punkt bestimmt Schritt 4 der Reihenfolge. Er wird hier **nicht** vorweggenommen.

---

## 1. Voraussetzungen

1. **Eine geprüfte Sicherung der laufenden Datenbank `klarwerk`** — unabhängig davon, ob der
   Bestand übernommen wird. Gezogen mit `scripts/backup/backup.sh`, mit Prüfsumme daneben und mit
   der Lesestufe `pg_restore --list` (nicht der Ersatzprüfung; Unterschied in
   `scripts/backup/RESTORE.md`, Abschnitt „Backup erstellen“).
2. **PostgreSQL ab Version 13** (betrieben wird 16). Ab 13 ist `pg_trgm` eine vertrauenswürdige
   Erweiterung: die Eigentümerrolle der Datenbank darf sie ohne Superuser-Recht anlegen. Das
   Schema braucht sie (`KO_SCHEMA` in `services/knowledge-object/src/repo-pg.ts`).
3. **Ein leeres Ziel.** Compose-Weg: ein leeres Datenverzeichnis (neues Volume) — nur dann legt
   PostgreSQL `POSTGRES_USER` und `POSTGRES_DB` an. Coolify-Weg: eine neue PostgreSQL-Ressource
   (`docs/operations/deploy-hetzner.md` §2). Name der Datenbank: `klarwerk_prod`.
4. **Genau eine Rolle, und sie gehört zur Datenbank.** Die Anwendung legt keine Rolle an und setzt
   keine zweite voraus; sie arbeitet im Schema `public` mit der Rolle aus `DATABASE_URL`. Diese
   Rolle muss in der neuen Datenbank Tabellen und Erweiterungen anlegen dürfen (Eigentümerin der
   Datenbank). Im Compose-Weg ist das `POSTGRES_USER` (`klarwerk`); im Coolify-Weg die Rolle,
   die die Ressource anlegt.
5. **Die Anwendungsumgebung ist vorbereitet, aber noch nicht umgestellt:** `DATABASE_URL` zeigt
   künftig auf `klarwerk_prod`; `APP_BASE_URL` ist gesetzt (Pflicht in Produktion,
   `services/app/src/start-vertrag.ts`).

---

## 2. Reihenfolge

1. **Sicherung ziehen und prüfen** (Voraussetzung 1). Ohne bestandene Prüfsumme geht es nicht weiter.
2. **Anwendung stoppen** — kein Schreibzugriff ab hier (in Coolify: Service pausieren).
3. **Neue Datenbank anlegen.** Hier entstehen Rolle und Datenbank `klarwerk_prod`, und zwar
   **neu** — nichts davon wird aus der alten Datenbank übernommen.
4. **Bestand — nach Pedis Entscheidung (§0):**
   - *Übernahme:* den Dump aus Schritt 1 nach `scripts/backup/RESTORE.md`, Schritte 0 bis 4, in
     `klarwerk_prod` einspielen (`--no-owner --no-privileges`: Eigentum und Rechte kommen aus der
     neuen Rolle, nicht aus dem Dump).
   - *Leerer Beginn:* nichts einspielen.
5. **Umschalten und starten:** `DATABASE_URL` auf `klarwerk_prod`, Anwendung starten. Beim Start
   legt `migrate()` (`services/app/src/db.ts`) das Schema an bzw. ergänzt es nach einem Restore —
   unter der datenbankweiten Migrationssperre (`MIGRATIONSSPERRE`), damit ein zweiter, gleichzeitig
   startender Prozess wartet, statt im Katalog zu scheitern. Danach laufen die Token-Migration
   (`migrateAuthTokensAtRest`) und die Bereitstellung der Suchprojektion.
6. **Bei leerem Beginn sofort die Ersteinrichtung durch Pedi selbst** (`docs/operations/deploy-hetzner.md`
   §3, Punkt 2) — bevor ein Link nach draußen geht.
7. **Die alte Datenbank `klarwerk` bleibt unangetastet**, bis die Abnahme (§3) bestanden ist. Ob
   und wann sie entfernt wird, entscheidet Pedi; dieser Text sieht dafür keinen Schritt vor.

---

## 3. Abnahme

Bestanden ist das Neuaufsetzen erst, wenn **jeder** Punkt mit dem genannten Ergebnis vorliegt.

| # | Prüfung | Erwartung |
|---|---|---|
| A1 | `SELECT current_database()` über die `DATABASE_URL` der Anwendung | `klarwerk_prod` — und kein `test` im Namen |
| A2 | `SELECT current_user` und `SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()` | dieselbe Rolle, angelegt in Schritt 3 |
| A3 | `SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'` | genau eine Zeile |
| A4 | Tabellen in `public` gegen den Pflichtsatz `PFLICHTTABELLEN` in `scripts/backup/restore-drill.sh` | jede Tabelle vorhanden |
| A5 | `SELECT projection_state FROM ko_projection_control` | `V2_ACTIVE` |
| A6 | Anwendung ein zweites Mal starten | Start gelingt; `migrate()` ist wiederholbar und folgenlos |
| A7a | *Leerer Beginn:* `GET /api/auth/status` vor der Ersteinrichtung | `needsSetup: true`; nach der Einrichtung antwortet ein zweiter Versuch mit 409 |
| A7b | *Übernahme:* Anmeldung mit einem Konto **aus dem Dump**, danach `GET /api/audit/verify` und ein Objekt mit Anhang öffnen | wie `scripts/backup/RESTORE.md`, Schritt 6 |

`/health` allein ist **kein** Abnahmebeleg: die Route ist datenbankfrei.

---

## 4. Was danach in `OFFEN.md` nachzutragen ist

- **E7:** „Migration ausgeführt“ mit Datum, gewähltem Weg (Übernahme oder leerer Beginn) und den
  Ergebnissen A1 bis A7.
- **E5:** „Rolle und Schema neu entstanden“ mit denselben Belegen A1 bis A3.

Bis dahin bleiben beide Punkte offen. Ein Eintrag ohne Ergebnis der Abnahme ist kein Abschluss.
