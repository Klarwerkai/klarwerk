# Klarwerk — Datenbank-Backup & Wiederherstellung (S1)

SCRUM-469 / MEGA-BATCH-1 WP7. Ein schlanker `pg_dump`-Wrapper + diese Anleitung. **Keine
Runtime-Integration** — rein manuell bzw. per Cron/Coolify-Scheduled-Task auszulösen.

## Backup erstellen

```bash
# DB-URL aus der Umgebung (bevorzugt KLARWERK_DATABASE_URL, sonst DATABASE_URL).
DATABASE_URL='postgres://user:pass@host:5432/klarwerk_prod' ./scripts/backup/backup.sh
# → schreibt ./backups/klarwerk-<ZEITSTEMPEL>.dump (Custom-Format, komprimiert)
# Zielverzeichnis überschreibbar: ./scripts/backup/backup.sh /pfad/zu/backups   (oder BACKUP_DIR=…)
```

Das Skript bricht ab, wenn keine DB-URL gesetzt ist (nie gegen die falsche DB), und loggt die URL nie.

### Was neben dem Dump entsteht — und warum das kein Zubehör ist

Jeder Dump wird **zusammen mit einem Sidecar** `klarwerk-<ZEITSTEMPEL>.dump.sha256` veröffentlicht
(64 Hex + Dateiname, Format wie `shasum -a 256`). Beides entsteht unter einem `.partial`-Arbeitsnamen
und wird erst am Ende umbenannt — **Sidecar zuerst, Dump zuletzt**.

Daraus folgen zwei Zusagen, die vorher nicht galten:

- **Ein abgebrochener `pg_dump` hinterlässt nichts.** Vorher blieb eine Teildatei unter dem
  Endnamen liegen; am Namen war sie von einem fertigen Backup nicht zu unterscheiden.
- **Ohne Prüfsumme wird nichts veröffentlicht.** Fehlt jedes Hashwerkzeug, endet das Skript mit
  **Exit 3** und es bleibt *nichts* liegen — statt eines unbeglaubigten Dumps mit Exit 0.

Es gibt damit keinen Zeitpunkt, zu dem ein `*.dump` ohne seine Prüfsumme sichtbar ist. Konsumenten
suchen nach genau diesem Muster.

**Bedingung der Atomizitätszusage:** `mv` ist nur *innerhalb eines Dateisystems* atomar
(`rename(2)`). Deshalb liegt der Arbeitsname im selben Verzeichnis. Zeigt `BACKUP_DIR` auf eine
Netzfreigabe mit anderer Semantik, gilt die Zusage nicht — einmal am echten Zielverzeichnis prüfen.

### Coolify / Cron
Als Scheduled-Task (z. B. täglich) hinterlegen:
```
DATABASE_URL="$KLARWERK_DATABASE_URL" BACKUP_DIR=/data/backups /app/scripts/backup/backup.sh
```
Aufbewahrung/Rotation nach Bedarf am Zielverzeichnis (z. B. `find /data/backups -mtime +14 -delete`).

## Wiederherstellung (Schritt für Schritt)

> Die Dumps sind im **Custom-Format** (`pg_dump -Fc`) → Wiederherstellung mit `pg_restore`.

0. **Prüfsumme prüfen — vor allem anderen.**
   ```bash
   shasum -a 256 ./backups/klarwerk-<ZEITSTEMPEL>.dump
   cat ./backups/klarwerk-<ZEITSTEMPEL>.dump.sha256
   ```
   Stimmen die 64 Hex nicht überein oder fehlt der Sidecar, **wird nicht restauriert**. Der
   automatisierte Drill (`scripts/backup/restore-drill.sh`) erzwingt genau das und startet
   `pg_restore` in diesem Fall gar nicht erst (Exit 10 bzw. 11).

1. **App stoppen** (kein Schreibzugriff während des Restores) — in Coolify den Service pausieren.
2. **Ziel-DB bereitstellen.** In eine LEERE Datenbank restoren (empfohlen: neue DB anlegen, dann
   umschalten):
   ```bash
   createdb -h host -U user klarwerk_restore
   ```
3. **Restore einspielen:**
   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists \
     -h host -U user -d klarwerk_restore ./backups/klarwerk-<ZEITSTEMPEL>.dump
   ```
   - `--clean --if-exists`: vorhandene Objekte werden vor dem Einspielen entfernt (idempotenter
     Restore in eine bereits teilbefüllte DB).
   - `--no-owner --no-privileges`: passt zum Dump (Rollen/Rechte werden nicht erzwungen).
4. **Integrität prüfen** (stichprobenartig):
   ```bash
   psql -h host -U user -d klarwerk_restore -c "SELECT count(*) FROM kos;"
   ```
5. **Umschalten:** `KLARWERK_DATABASE_URL`/`DATABASE_URL` der App auf die wiederhergestellte DB zeigen
   lassen (Coolify-Env), App **wieder starten**.
6. **Verifizieren:** einloggen und ein bekanntes Wissensobjekt öffnen.

   **`/health` ist dabei kein Restorebeleg.** Die Route ist datenbankfrei und sagt nur: „Der
   Prozess antwortet." Der eigentliche Beleg ist die Anmeldung mit einem Konto **aus dem Dump**
   und anschließend `GET /api/audit/verify` — die Abfrage läuft durch die gestartete Anwendung
   gegen die wiederhergestellte Datenbank. Erfolgreich ist sie bei
   `linkageBreaks === 0`, `unresolvedDeviations === 0` und `uncheckedDeviations === 0`.
   `report.ok` und `serialisationDeviations` sind **kein** Abnahmekriterium (Begründung:
   `docs/operations/restore-drill.md`).

## Der automatisierte Probelauf

Statt die Schritte 0–6 von Hand zu gehen:

```bash
RESTORE_DB=klarwerk_drill_<DATUM> \
DRILL_LOGIN_EMAIL=<konto-mit-ko.validate> \
DRILL_LOGIN_PASSWORT='…' \
./scripts/backup/restore-drill.sh ./backups/klarwerk-<ZEITSTEMPEL>.dump
```

Vollständige Anleitung, alle Exitcodes und die Grenzen: `docs/operations/restore-drill.md`.

## Hinweise
- Der Dump ist konsistent (pg_dump snapshot). Für Point-in-Time-Recovery bräuchte es zusätzlich WAL-
  Archivierung — bewusst außerhalb dieses schlanken S1-Helfers.
- Secrets: die DB-URL nur über Env/Coolify-Secrets reichen, nie ins Repo/Log.
