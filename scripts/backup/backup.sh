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

# CWD-VERTRAG (JOB 943): Das Standardziel `./backups` war RELATIV zum Aufrufort. Wer dieses
# Skript aus einem anderen Verzeichnis startet — Cron, Coolify, ein Terminal irgendwo —, legte
# sein Backup dort ab und bekam trotzdem "fertig" gemeldet. Bei einem Backup ist das die
# gefaehrlichste Sorte Fehler: Man glaubt, eines zu haben. Der Vertragspruefer
# (`tools/check-cwd-contract.mjs`) hat genau das gefunden.
#
# Die Wurzel wird aus dem Skriptpfad abgeleitet, NICHT per `cd`: Ein `cd` wuerde auch ein
# relativ uebergebenes Zielverzeichnis ($1) anders aufloesen und damit das Verhalten fuer
# Aufrufer aendern, die es heute richtig benutzen. Nur der Standard wird absolut.
WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${1:-${BACKUP_DIR:-$WURZEL/backups}}"
mkdir -p "$DEST"

# Zeitstempel UTC, sortierbar. (date ist hier ok — reines Shell-Tool, kein App-Code.)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DEST/klarwerk-${STAMP}.dump"

# JOB 517 — ERZEUGUNG UND VEROEFFENTLICHUNG SIND GETRENNT.
#
# Vorher wurde der Dump DIREKT unter seinem Endnamen geschrieben. Daraus folgten zwei Loecher,
# beide ohne jede Fehlermeldung:
#
#   L1  Kein Hashwerkzeug vorhanden -> der Dump blieb OHNE Pruefsumme liegen, Exit 0, und der
#       Text "(sha256 nicht verfuegbar)" wurde als WERT gefuehrt. Ein unbeglaubigtes Backup,
#       das aussieht wie ein beglaubigtes.
#   L2  `pg_dump` scheitert mittendrin -> eine TEILDATEI blieb unter dem Endnamen liegen.
#       `set -euo pipefail` beendete das Skript, raeumte aber nichts weg. Wer im Verzeichnis
#       das juengste `klarwerk-*.dump` greift, greift die Teildatei — am Namen ist sie von
#       einem fertigen Backup nicht zu unterscheiden.
#
# Deshalb: NICHTS wird unter dem Endnamen geschrieben. Der Endname entsteht ausschliesslich
# durch Umbenennen, und zwar Sidecar zuerst, Dump zuletzt. So gibt es keinen Zeitpunkt, zu dem
# ein `*.dump` ohne seine Pruefsumme sichtbar ist — Konsumenten suchen nach genau diesem Muster.
#
# Der Arbeitsname liegt im SELBEN Verzeichnis, nicht in /tmp: `mv` ist nur innerhalb eines
# Dateisystems atomar (`rename(2)`). Zeigt BACKUP_DIR auf eine Netzfreigabe mit anderer
# Semantik, gilt die Atomizitaetszusage nicht — das steht so auch in RESTORE.md.
STAGE="${OUT}.partial"
trap 'rm -f "$STAGE" "${STAGE}.sha256"' EXIT

echo "[backup] Dump nach: $OUT"
# -Fc = Custom-Format (komprimiert, für pg_restore). Die URL steht NUR im Argument, nicht im Log.
pg_dump --format=custom --no-owner --no-privileges --file "$STAGE" "$DB_URL"

# Pruefsumme ist PFLICHT, nicht "best effort": ohne sie wird nichts veroeffentlicht.
if command -v shasum >/dev/null 2>&1; then
  SUM="$(shasum -a 256 "$STAGE" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  SUM="$(sha256sum "$STAGE" | awk '{print $1}')"
else
  echo "[backup] ABBRUCH: weder shasum noch sha256sum gefunden — ohne Pruefsumme wird kein" >&2
  echo "[backup] Backup veroeffentlicht. Der unvollstaendige Arbeitsstand wird verworfen." >&2
  exit 3
fi

SIZE="$(wc -c < "$STAGE" | tr -d ' ')"
# Sidecarformat wie `shasum -a 256`: 64 Hex, zwei Leerzeichen, DER ENDNAME (nicht der Arbeitsname).
echo "${SUM}  $(basename "$OUT")" > "${STAGE}.sha256"

# DIE VEROEFFENTLICHUNG. Reihenfolge ist nicht beliebig: Sidecar zuerst, Dump zuletzt.
mv "${STAGE}.sha256" "${OUT}.sha256"
mv "$STAGE" "$OUT"
trap - EXIT

echo "[backup] fertig — ${SIZE} Bytes, sha256=${SUM}"
echo "[backup] Pruefsumme: ${OUT}.sha256"
echo "[backup] Wiederherstellung: siehe scripts/backup/RESTORE.md"
