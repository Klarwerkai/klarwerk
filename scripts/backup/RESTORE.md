# Klarwerk — Datenbank-Backup & Wiederherstellung (S1)

SCRUM-469 / MEGA-BATCH-1 WP7. Ein schlanker `pg_dump`-Wrapper + diese Anleitung. **Keine
Runtime-Integration** — rein manuell bzw. per Cron/Coolify-Scheduled-Task auszulösen.

## Backup erstellen

```bash
# DB-URL aus der Umgebung (bevorzugt KLARWERK_DATABASE_URL, sonst DATABASE_URL).
DATABASE_URL='postgres://user:pass@host:5432/klarwerk' ./scripts/backup/backup.sh
# → schreibt ./backups/klarwerk-<ZEITSTEMPEL>.dump (Custom-Format, komprimiert)
# Zielverzeichnis überschreibbar: ./scripts/backup/backup.sh /pfad/zu/backups   (oder BACKUP_DIR=…)
```

Das Skript bricht ab, wenn keine DB-URL gesetzt ist (nie gegen die falsche DB), und loggt die URL nie.

### Coolify / Cron
Als Scheduled-Task (z. B. täglich) hinterlegen:
```
DATABASE_URL="$KLARWERK_DATABASE_URL" BACKUP_DIR=/data/backups /app/scripts/backup/backup.sh
```
Aufbewahrung/Rotation nach Bedarf am Zielverzeichnis (z. B. `find /data/backups -mtime +14 -delete`).

## Wiederherstellung (Schritt für Schritt)

> Die Dumps sind im **Custom-Format** (`pg_dump -Fc`) → Wiederherstellung mit `pg_restore`.

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
6. **Verifizieren:** einloggen, ein bekanntes Wissensobjekt öffnen, `/health` prüfen.

## Hinweise
- Der Dump ist konsistent (pg_dump snapshot). Für Point-in-Time-Recovery bräuchte es zusätzlich WAL-
  Archivierung — bewusst außerhalb dieses schlanken S1-Helfers.
- Secrets: die DB-URL nur über Env/Coolify-Secrets reichen, nie ins Repo/Log.
