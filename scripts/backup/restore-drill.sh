#!/usr/bin/env bash
# ================================================================================================
# JOB 517 — RESTORE-DRILL. Ein Backup, das nie zurueckgespielt wurde, ist eine Vermutung.
# ================================================================================================
#
# Dieser Drill spielt einen Dump in eine FRISCHE, LEERE Datenbank zurueck, startet Klara dagegen,
# meldet sich mit einem Konto AUS DEM DUMP an und fragt die Auditkette ab. Erst das ist ein
# Wiederherstellungsbeleg. Danach raeumt er den gestarteten Prozess wieder ab.
#
# WAS DIESER DRILL NICHT TUT: Er fasst KEINE Produktionsdatenbank an. `RESTORE_DB` muss ein
# eigener, leerer Zielname sein; der Drill legt ihn an und weigert sich, in eine nicht leere
# Datenbank zu restaurieren.
#
# EXITCODES — jeder Fehlerfall hat einen eigenen, damit ein Fehlschlag nicht wie ein anderer
# aussieht. Das ist der Kern des Auftrags: Ein Aufbaufehler darf nicht wie ein Auditbefund wirken.
#
#   0   Drill bestanden
#   1   Aufruf-/Umgebungsfehler (fehlende Variable, fehlendes Werkzeug)
#  10   SIDECAR FEHLT oder ist kein 64-Hex — `pg_restore` wird NICHT gestartet
#  11   SIDECAR STIMMT NICHT mit dem Dump ueberein — `pg_restore` wird NICHT gestartet
#  20   Zieldatenbank liess sich nicht anlegen oder ist NICHT leer
#  21   `pg_restore` gescheitert
#  22   Strukturgate: erwartete Tabellen fehlen nach dem Restore
#  30   Anwendung wurde nicht lebendig (keine PID-Datei / kein `listen`)
#  60   LOGIN fehlgeschlagen (HTTP != 200) — Aufbaufehler, KEIN Auditbefund
#  61   Verifikation mit 403 abgelehnt — die Fixture hat kein `ko.validate`, Aufbaufehler
#  70   Auditkette: linkageBreaks != 0
#  71   Auditkette: unresolvedDeviations != 0
#  72   Auditkette: uncheckedDeviations != 0
#  80   REAPING fehlgeschlagen (fremde/wiederverwendete PID oder Prozess ueberlebt)
#
# WAS AUSDRUECKLICH KEIN ABNAHMEKRITERIUM IST: `report.ok` und `serialisationDeviations`.
# `ok` ist definiert als `linkageBreaks === 0 && payloadDeviations === 0`. Der Bestand kennt
# erklaerbare Serialisierungsabweichungen (JS-Einfuegereihenfolge gegen kanonisch sortiertes
# `jsonb`); ein Drill, der `ok === true` verlangte, waere dauerhaft rot — und zwar OHNE dass am
# Restore irgendetwas falsch waere. Er saehe wie ein Restorefehler aus und waere keiner.
set -euo pipefail

# ------------------------------------------------------------------------------------------------
# Aufruf und Umgebung
# ------------------------------------------------------------------------------------------------
DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "[drill] ABBRUCH: kein Dump angegeben." >&2
  echo "[drill] Nutzung: RESTORE_DB=klarwerk_drill ./scripts/backup/restore-drill.sh <dump>" >&2
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "[drill] ABBRUCH: Dump nicht gefunden: $DUMP" >&2
  exit 1
fi

RESTORE_DB="${RESTORE_DB:-}"
if [ -z "$RESTORE_DB" ]; then
  echo "[drill] ABBRUCH: RESTORE_DB ist nicht gesetzt (eigener, leerer Zielname)." >&2
  exit 1
fi

DRILL_PORT="${DRILL_PORT:-3097}"
ARBEIT="${DRILL_WORKDIR:-$(dirname "$DUMP")}"
PID_FILE="${ARBEIT}/klarwerk-drill.pid"
WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"

for werkzeug in pg_restore createdb psql; do
  if ! command -v "$werkzeug" >/dev/null 2>&1; then
    echo "[drill] ABBRUCH: $werkzeug nicht gefunden (postgresql-client installieren)." >&2
    exit 1
  fi
done

# ------------------------------------------------------------------------------------------------
# GLIED 1 — SIDECARPRUEFUNG. Vor jedem Restore, ohne Ausnahme.
# ------------------------------------------------------------------------------------------------
#
# Die Reihenfolge ist der ganze Punkt: Erst wenn der Sidecar traegt, darf `pg_restore` ueberhaupt
# starten. Ein Dump ohne beglaubigte Pruefsumme ist kein Backup, sondern eine Datei.
SIDECAR="${DUMP}.sha256"
if [ ! -f "$SIDECAR" ]; then
  echo "[drill] ABBRUCH (10): kein Sidecar zu $DUMP — pg_restore wird nicht gestartet." >&2
  exit 10
fi

ERWARTET="$(awk '{print $1}' < "$SIDECAR" | tr -d '[:space:]')"
if ! printf '%s' "$ERWARTET" | grep -Eq '^[0-9a-f]{64}$'; then
  echo "[drill] ABBRUCH (10): Sidecar enthaelt keine 64-Hex-Pruefsumme — pg_restore wird nicht gestartet." >&2
  exit 10
fi

if command -v shasum >/dev/null 2>&1; then
  IST="$(shasum -a 256 "$DUMP" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  IST="$(sha256sum "$DUMP" | awk '{print $1}')"
else
  echo "[drill] ABBRUCH: weder shasum noch sha256sum gefunden." >&2
  exit 1
fi

if [ "$IST" != "$ERWARTET" ]; then
  echo "[drill] ABBRUCH (11): Pruefsumme weicht ab — pg_restore wird nicht gestartet." >&2
  echo "[drill]   erwartet $ERWARTET" >&2
  echo "[drill]   gemessen $IST" >&2
  exit 11
fi
echo "[drill] Glied 1 — Sidecar geprueft: $ERWARTET"

# ------------------------------------------------------------------------------------------------
# GLIED 8 vorbereitet — REAPING. Der Trap raeumt auch bei jedem Abbruch weiter unten auf.
# ------------------------------------------------------------------------------------------------
#
# `reap` beendet AUSSCHLIESSLICH den Prozess, den dieser Drill selbst gestartet hat. Die PID
# allein genuegt dafuer nicht: PIDs werden wiederverwendet. Deshalb wird die gemerkte PID gegen
# die PID-Datei gehalten und die Lebendigkeit mit `kill -0` geprueft, bevor irgendein Signal
# faellt. Eine fremde oder wiederverwendete PID wird fail-closed abgelehnt, statt sie zu treffen.
GESTARTETE_PID=""
reap() {
  local rc=$?
  if [ -z "$GESTARTETE_PID" ]; then
    rm -f "$PID_FILE"
    return $rc
  fi
  if [ ! -f "$PID_FILE" ]; then
    echo "[drill] REAPING (80): PID-Datei fehlt — der gestartete Prozess ist nicht identifizierbar." >&2
    return 80
  fi
  local datei_pid
  datei_pid="$(tr -d '[:space:]' < "$PID_FILE")"
  if [ "$datei_pid" != "$GESTARTETE_PID" ]; then
    echo "[drill] REAPING (80): PID-Datei nennt $datei_pid, gestartet wurde $GESTARTETE_PID —" >&2
    echo "[drill] fremder Prozess, es wird KEIN Signal gesendet." >&2
    return 80
  fi
  if ! kill -0 "$GESTARTETE_PID" 2>/dev/null; then
    echo "[drill] REAPING: Prozess $GESTARTETE_PID lebt nicht mehr; nur die PID-Datei wird geraeumt."
    rm -f "$PID_FILE"
    return $rc
  fi
  kill -TERM "$GESTARTETE_PID" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! kill -0 "$GESTARTETE_PID" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if kill -0 "$GESTARTETE_PID" 2>/dev/null; then
    echo "[drill] REAPING (80): Prozess $GESTARTETE_PID hat SIGTERM ueberlebt." >&2
    return 80
  fi
  rm -f "$PID_FILE"
  echo "[drill] Glied 8 — Reaping: Prozess $GESTARTETE_PID beendet, PID-Datei geraeumt."
  return $rc
}
trap reap EXIT

# ------------------------------------------------------------------------------------------------
# GLIED 2 — LEERE ZIELDATENBANK
# ------------------------------------------------------------------------------------------------
if ! createdb "$RESTORE_DB" 2>/dev/null; then
  echo "[drill] Hinweis: $RESTORE_DB existiert bereits — es wird auf Leerheit geprueft."
fi
TABELLEN="$(psql -d "$RESTORE_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "fehler")"
if [ "$TABELLEN" = "fehler" ]; then
  echo "[drill] ABBRUCH (20): Zieldatenbank $RESTORE_DB ist nicht erreichbar." >&2
  exit 20
fi
if [ "$TABELLEN" != "0" ]; then
  echo "[drill] ABBRUCH (20): $RESTORE_DB ist NICHT leer ($TABELLEN Tabellen) — der Drill" >&2
  echo "[drill] restauriert nur in eine leere Datenbank." >&2
  exit 20
fi
echo "[drill] Glied 2 — leere Zieldatenbank: $RESTORE_DB"

# ------------------------------------------------------------------------------------------------
# GLIED 3 — RESTORE UND STRUKTURGATE
# ------------------------------------------------------------------------------------------------
if ! pg_restore --no-owner --no-privileges -d "$RESTORE_DB" "$DUMP"; then
  echo "[drill] ABBRUCH (21): pg_restore gescheitert." >&2
  exit 21
fi
for tabelle in kos users audit_events; do
  VORHANDEN="$(psql -d "$RESTORE_DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${tabelle}';")"
  if [ "$VORHANDEN" != "1" ]; then
    echo "[drill] ABBRUCH (22): Tabelle '$tabelle' fehlt nach dem Restore." >&2
    exit 22
  fi
done
echo "[drill] Glied 3 — Restore eingespielt, Struktur vollstaendig."

# ------------------------------------------------------------------------------------------------
# GLIED 4 — ANWENDUNG STARTEN, MIT PID-DATEI
# ------------------------------------------------------------------------------------------------
rm -f "$PID_FILE"
# `exec` ist hier wesentlich, nicht kosmetisch: Ohne `exec` waere `$!` die PID der SUBSHELL, und
# `node` liefe als deren Kind mit einer ANDEREN PID. Die Identitaetspruefung unten haette dann
# nichts zu vergleichen — man muesste der PID-Datei glauben. Mit `exec` ERSETZT node die Subshell,
# `$!` IST die PID des gestarteten Servers, und die Datei laesst sich dagegen halten.
(
  cd "$WURZEL"
  exec env \
    DATABASE_URL="postgres:///${RESTORE_DB}" \
    KLARWERK_PID_FILE="$PID_FILE" \
    PORT="$DRILL_PORT" \
    node services/app/dist/server.js
) &
GESTARTETE_PID=$!

for _ in $(seq 1 60); do
  if [ -f "$PID_FILE" ]; then
    break
  fi
  sleep 1
done
if [ ! -f "$PID_FILE" ]; then
  echo "[drill] ABBRUCH (30): keine PID-Datei — die Anwendung hat nie erfolgreich gehorcht." >&2
  exit 30
fi

# DIE IDENTITAETSPRUEFUNG. Sie ist der Grund, warum dieser Block existiert: Die PID-Datei wird
# NICHT geglaubt, sondern gegen den tatsaechlich gestarteten Prozess gehalten. Nennt sie etwas
# anderes, ist der Drill in einer Lage, die er nicht aufloesen kann — er beendet dann NICHTS.
# Eine wiederverwendete PID darf niemals dazu fuehren, dass ein fremder Prozess getroffen wird.
DATEI_PID="$(tr -d '[:space:]' < "$PID_FILE")"
if [ "$DATEI_PID" != "$GESTARTETE_PID" ]; then
  echo "[drill] ABBRUCH (80): PID-Datei nennt $DATEI_PID, gestartet wurde $GESTARTETE_PID —" >&2
  echo "[drill] fremder oder wiederverwendeter Prozess. Es wird KEIN Signal gesendet." >&2
  exit 80
fi
echo "[drill] Glied 4 — Anwendung laeuft, PID $GESTARTETE_PID, Port $DRILL_PORT"

# ------------------------------------------------------------------------------------------------
# GLIED 5 — /health IST LEBENDIGKEIT, NICHT MEHR
# ------------------------------------------------------------------------------------------------
#
# Ausdruecklich: `/health` belegt, dass der Prozess antwortet. Es belegt NICHT, dass der Restore
# gelungen ist — die Route ist datenbankfrei. Der Restorebeleg sind Glied 6 und 7.
HEALTH="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${DRILL_PORT}/health" || echo "000")"
if [ "$HEALTH" != "200" ]; then
  echo "[drill] ABBRUCH (30): /health antwortet mit $HEALTH." >&2
  exit 30
fi
echo "[drill] Glied 5 — /health 200 (Lebendigkeit, kein Restorebeleg)"

# ------------------------------------------------------------------------------------------------
# GLIED 6 — ANMELDUNG MIT EINEM KONTO AUS DEM DUMP
# ------------------------------------------------------------------------------------------------
#
# Die Fixture MUSS `ko.validate` tragen (Controller oder Admin): `GET /api/audit/verify` verlangt
# genau dieses Recht (`services/app/src/routes/audit-routes.ts:19`). Mit einem gewoehnlichen Konto
# endete Glied 7 mit 403 — und haette wie ein Auditbefund ausgesehen. Deshalb hat dieser Fall
# einen EIGENEN Exitcode.
DRILL_LOGIN_EMAIL="${DRILL_LOGIN_EMAIL:-}"
DRILL_LOGIN_PASSWORT="${DRILL_LOGIN_PASSWORT:-}"
if [ -z "$DRILL_LOGIN_EMAIL" ] || [ -z "$DRILL_LOGIN_PASSWORT" ]; then
  echo "[drill] ABBRUCH: DRILL_LOGIN_EMAIL und DRILL_LOGIN_PASSWORT muessen gesetzt sein" >&2
  echo "[drill] (ein Konto MIT ko.validate, das im Dump enthalten ist)." >&2
  exit 1
fi

ANTWORT="$(curl -s -w '\n%{http_code}' -X POST \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${DRILL_LOGIN_EMAIL}\",\"password\":\"${DRILL_LOGIN_PASSWORT}\"}" \
  "http://127.0.0.1:${DRILL_PORT}/api/auth/login" || echo $'\n000')"
LOGIN_CODE="$(printf '%s' "$ANTWORT" | tail -n1)"
LOGIN_BODY="$(printf '%s' "$ANTWORT" | sed '$d')"
if [ "$LOGIN_CODE" != "200" ]; then
  echo "[drill] ABBRUCH (60): Login endete mit HTTP $LOGIN_CODE — Aufbaufehler, kein Auditbefund." >&2
  exit 60
fi
TOKEN="$(printf '%s' "$LOGIN_BODY" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
if [ -z "$TOKEN" ]; then
  echo "[drill] ABBRUCH (60): Login lieferte kein Token." >&2
  exit 60
fi
echo "[drill] Glied 6 — Anmeldung erfolgreich (Konto aus dem Dump)"

# ------------------------------------------------------------------------------------------------
# GLIED 7 — DIE DREI AUDITBEDINGUNGEN
# ------------------------------------------------------------------------------------------------
VERIFY="$(curl -s -w '\n%{http_code}' -H "cookie: kw_session=${TOKEN}" \
  "http://127.0.0.1:${DRILL_PORT}/api/audit/verify" || echo $'\n000')"
VERIFY_CODE="$(printf '%s' "$VERIFY" | tail -n1)"
VERIFY_BODY="$(printf '%s' "$VERIFY" | sed '$d')"
if [ "$VERIFY_CODE" = "403" ]; then
  echo "[drill] ABBRUCH (61): /api/audit/verify mit 403 abgelehnt — die Fixture hat kein" >&2
  echo "[drill] ko.validate. Aufbaufehler, KEIN Auditbefund." >&2
  exit 61
fi
if [ "$VERIFY_CODE" != "200" ]; then
  echo "[drill] ABBRUCH (61): /api/audit/verify antwortet mit $VERIFY_CODE." >&2
  exit 61
fi

zaehler() {
  printf '%s' "$VERIFY_BODY" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p" | head -n1
}
LINKAGE="$(zaehler linkageBreaks)"
UNRESOLVED="$(zaehler unresolvedDeviations)"
UNCHECKED="$(zaehler uncheckedDeviations)"
echo "[drill] Auditkette: linkageBreaks=${LINKAGE:-?} unresolvedDeviations=${UNRESOLVED:-?} uncheckedDeviations=${UNCHECKED:-?}"

if [ "${LINKAGE:-1}" != "0" ]; then
  echo "[drill] ABBRUCH (70): linkageBreaks=${LINKAGE} — echter Kettenbruch." >&2
  exit 70
fi
if [ "${UNRESOLVED:-1}" != "0" ]; then
  echo "[drill] ABBRUCH (71): unresolvedDeviations=${UNRESOLVED} — unerklaerte Hashabweichung." >&2
  exit 71
fi
if [ "${UNCHECKED:-1}" != "0" ]; then
  echo "[drill] ABBRUCH (72): uncheckedDeviations=${UNCHECKED} — ungepruefte Abweichung (Deckel)." >&2
  exit 72
fi
echo "[drill] Glied 7 — die drei Auditbedingungen sind erfuellt."
echo "[drill] (report.ok und serialisationDeviations sind ausdruecklich KEIN Abnahmekriterium.)"

echo "[drill] DRILL BESTANDEN — der Dump ist wiederherstellbar und die Kette traegt."
exit 0
