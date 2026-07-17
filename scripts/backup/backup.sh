#!/usr/bin/env bash
# SCRUM-469 / MEGA-BATCH-1 WP7 (S1) — Backup-Helper: pg_dump-Wrapper. Liest die DB-URL aus der Umgebung
# und schreibt ein ZEITGESTEMPELTES Dump-File. KEINE Runtime-Integration (rein manuell/Cron/Coolify).
#
# Nutzung:
#   DATABASE_URL=postgres://user:pass@host:5432/db  ./scripts/backup/backup.sh [ZIEL-VERZEICHNIS]
# Standard-Zielverzeichnis: ./backups (per BACKUP_DIR überschreibbar).
#
# Sicherheit: die DB-URL wird NICHT geloggt/ausgegeben. Ohne DATABASE_URL (bzw. KLARWERK_DATABASE_URL)
# bricht das Skript ab, statt gegen eine falsche DB zu laufen.
set -euo pipefail

# Konsistent zum App-Standard: bevorzugt KLARWERK_DATABASE_URL, sonst DATABASE_URL.
DB_URL="${KLARWERK_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "[backup] ABBRUCH: weder KLARWERK_DATABASE_URL noch DATABASE_URL gesetzt." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] ABBRUCH: pg_dump nicht gefunden (postgresql-client installieren)." >&2
  exit 1
fi

DEST="${1:-${BACKUP_DIR:-./backups}}"
mkdir -p "$DEST"

# Zeitstempel UTC, sortierbar. (date ist hier ok — reines Shell-Tool, kein App-Code.)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DEST/klarwerk-${STAMP}.dump"

echo "[backup] Dump nach: $OUT"
# -Fc = Custom-Format (komprimiert, für pg_restore). Die URL steht NUR im Argument, nicht im Log.
pg_dump --format=custom --no-owner --no-privileges --file "$OUT" "$DB_URL"

# Kleine Integritäts-Notiz: Größe + SHA-256 (best effort).
SIZE="$(wc -c < "$OUT" | tr -d ' ')"
if command -v shasum >/dev/null 2>&1; then
  SUM="$(shasum -a 256 "$OUT" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  SUM="$(sha256sum "$OUT" | awk '{print $1}')"
else
  SUM="(sha256 nicht verfügbar)"
fi
echo "[backup] fertig — ${SIZE} Bytes, sha256=${SUM}"
echo "[backup] Wiederherstellung: siehe scripts/backup/RESTORE.md"
