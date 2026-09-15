#!/usr/bin/env bash
# ================================================================================================
# JOB 4012 — DER RÜCKFALL. Ausführbar, nicht beschrieben.
# ================================================================================================
#
# WAS ES VORHER GAB: `build-current-release.mjs` schrieb in jedes Release eine `ROLLBACK.md` mit
# sieben Zeilen zum Abtippen — Symlink umbiegen, PID aus einer Datei lesen, `kill`, `nohup`,
# `curl`. Das ist keine Wiederherstellung, das ist eine Prüfung unter Zeitdruck. Wer sie im
# Ernstfall braucht, hat gerade eine kaputte App vor sich und keine Ruhe zum Abtippen.
#
# WAS ES JETZT GIBT: EINEN Befehl. Er schaltet `current` auf die Vorversion, beendet den alten
# Server sauber, startet, wartet auf grünes `/health` MIT der erwarteten Version und sagt in einem
# Satz, was jetzt läuft. `update-einspielen.sh` ruft denselben Weg automatisch, wenn ein Update
# nicht hochkommt — geübt wird er damit bei jedem Update, nicht nur im Ernstfall.
#
# DIE DATEN BLEIBEN UNANGETASTET. Ein Rückfall ist ein CODE-Weg. Nur `--daten-zurueck <sicherung>`
# spielt eine Sicherung ein, und auch dann nicht mit eigenem Code:
#   · Postgres-Dump (`*.dump`) → `scripts/backup/restore-drill.sh` (Sidecar-Prüfung, eigene, leere
#     Zieldatenbank; er fasst die Produktionsdatenbank ausdrücklich NICHT an).
#   · Journal (`*.jsonl`)      → die Sicherung IST die Datei. Es gibt kein Fremdwerkzeug dafür;
#     der Weg ist ein Zurückkopieren, und der bisherige Stand wird davor selbst gesichert.
#
# EXITCODES — jeder Ausgang hat seinen eigenen, damit ein Aufrufer (und `update-einspielen.sh`)
# unterscheiden kann, was schiefging:
#   0  Vorversion läuft
#   1  Aufruf-/Umgebungsfehler
#   6  keine Vorversion ermittelbar
#   7  Health nach dem Rückfall rot
#   8  Health grün, aber eine andere Version als erwartet — oder gar keine belegbare
#   9  Datenrückspielung gescheitert
#  10  Der Start der Vorversion kam gar nicht erst zustande (Korrektur Runde 3, BEN-R2-2)
#
# WOHER DIE ERWARTETE VERSION KOMMT (Korrektur aus Runde 2, Bens Gegenprobe BEN3): aus dem Vertrag
# des Releases, sonst aus seiner `package.json` — derselben Datei, aus der `/health` seine Version
# liest. NICHT aus dem Verzeichnisnamen. Vorher meldete dieser Weg bei jeder Altinstallation
# „gescheitert", obwohl die App sauber mit ihrer Version antwortete: ein falscher Alarm auf genau
# dem Weg, dem man im Ernstfall glauben muss. Ist die Version aus dem Release gar nicht belegbar,
# wird der Rückfall trotzdem geschaltet — aber kein „aktiv" behauptet.
set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/insel/insel-betrieb.sh
. "$WURZEL/scripts/insel/insel-betrieb.sh"

SHARED_ROOT="${KLARWERK_SHARED_ROOT:-/Users/Shared/Klarwerk_Insel}"
RELEASES="$SHARED_ROOT/releases"
CURRENT="$SHARED_ROOT/current"
PORT="${PORT:-3002}"
HEALTH_SEKUNDEN="${KLARWERK_HEALTH_SEKUNDEN:-60}"
LOGS="$SHARED_ROOT/logs"
PID_DATEI="$LOGS/server-${PORT}.pid"
LOG_DATEI="$LOGS/server-${PORT}.log"

ZIEL_NAME=""
SICHERUNG=""
GRUND=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --daten-zurueck)
      SICHERUNG="${2:-}"
      if [ -z "$SICHERUNG" ]; then
        echo "[rueckfall] ABBRUCH: --daten-zurueck braucht einen Pfad." >&2
        exit 1
      fi
      shift 2 ;;
    --grund)
      GRUND="${2:-}"
      shift 2 ;;
    -*)
      echo "[rueckfall] ABBRUCH: unbekannte Option $1" >&2
      exit 1 ;;
    *)
      ZIEL_NAME="$1"
      shift ;;
  esac
done

mkdir -p "$LOGS"

VERTRAG_MJS="$WURZEL/scripts/insel/schema-vertrag.mjs"

# Die App-Version eines Releases — Vertrag zuerst, sonst `package.json`, sonst leer. Derselbe eine
# Weg, den auch `update-einspielen.sh` benutzt.
app_version_von() {
  node "$VERTRAG_MJS" app-version "$1" 2>/dev/null || true
}

# ------------------------------------------------------------------------------------------------
# WELCHE VERSION IST DIE VORVERSION. Drei Quellen, in dieser Reihenfolge — und keine Raterei:
#   1. das Argument
#   2. `$SHARED_ROOT/VORVERSION`, die `update-einspielen.sh` VOR jedem Umschalten schreibt
#   3. das jüngste Release, das nicht das gerade aktive ist
# Führt keine zum Ziel, endet der Weg mit 6 statt mit einem zufällig gewählten Release.
# ------------------------------------------------------------------------------------------------
AKTUELL=""
if [ -L "$CURRENT" ]; then
  AKTUELL="$(basename "$(readlink "$CURRENT")")"
fi

if [ -z "$ZIEL_NAME" ] && [ -f "$SHARED_ROOT/VORVERSION" ]; then
  ZIEL_NAME="$(tr -d '[:space:]' < "$SHARED_ROOT/VORVERSION")"
fi
if [ -z "$ZIEL_NAME" ] && [ -d "$RELEASES" ]; then
  for kandidat in $(ls -1t "$RELEASES" 2>/dev/null); do
    if [ "$kandidat" != "$AKTUELL" ] && [ -d "$RELEASES/$kandidat" ]; then
      ZIEL_NAME="$kandidat"
      break
    fi
  done
fi
if [ -z "$ZIEL_NAME" ] || [ ! -d "$RELEASES/$ZIEL_NAME" ]; then
  echo "Rückfall gescheitert, Grund: keine Vorversion vorhanden"
  exit 6
fi

ZIEL="$RELEASES/$ZIEL_NAME"
ERWARTETE_VERSION="$(app_version_von "$ZIEL")"

if [ -n "$GRUND" ]; then
  echo "[rueckfall] Grund des Rueckfalls: $GRUND"
fi
if [ -n "$ERWARTETE_VERSION" ]; then
  echo "[rueckfall] Ziel: $ZIEL_NAME (App-Version $ERWARTETE_VERSION)"
else
  echo "[rueckfall] Ziel: $ZIEL_NAME (App-Version nicht belegbar — weder SCHEMA-VERTRAG noch package.json)"
fi

# ------------------------------------------------------------------------------------------------
# DIE SICHERUNG WIRD GEPRUEFT, BEVOR IRGENDETWAS ANGEHALTEN WIRD. Ein Tippfehler im Pfad darf nicht
# dazu fuehren, dass der laufende Server steht und der Rueckfall trotzdem abbricht.
# ------------------------------------------------------------------------------------------------
if [ -n "$SICHERUNG" ]; then
  if [ ! -f "$SICHERUNG" ]; then
    echo "Rückfall gescheitert, Grund: Sicherung nicht gefunden ($SICHERUNG)"
    exit 9
  fi
  case "$SICHERUNG" in
    *.dump|*.jsonl) ;;
    *)
      echo "Rückfall gescheitert, Grund: unbekannte Sicherungsart ($SICHERUNG)"
      exit 9 ;;
  esac
fi

insel_server_stoppen "$PID_DATEI"
ln -sfn "$ZIEL" "$CURRENT"
echo "[rueckfall] current -> $(readlink "$CURRENT")"

# ------------------------------------------------------------------------------------------------
# DATEN — nur auf ausdrückliche Ansage, und nur mit dem Werkzeug, das dafür gebaut ist.
# ------------------------------------------------------------------------------------------------
if [ -n "$SICHERUNG" ]; then
  case "$SICHERUNG" in
    *.dump)
      DRILL="$WURZEL/scripts/backup/restore-drill.sh"
      if [ ! -f "$DRILL" ]; then
        echo "Rückfall gescheitert, Grund: restore-drill.sh fehlt ($DRILL)"
        exit 9
      fi
      echo "[rueckfall] Postgres-Sicherung: uebergebe an restore-drill.sh (eigene, leere Zieldatenbank)"
      if ! bash "$DRILL" "$SICHERUNG"; then
        echo "Rückfall gescheitert, Grund: restore-drill.sh rot"
        exit 9
      fi ;;
    *.jsonl)
      # Was der Stopp geantwortet hat, zählt hier: Unter launchd läuft der alte Prozess noch (er wird
      # erst beim `kickstart` ersetzt), und dann wird die Journaldatei unter einem schreibenden
      # Server ersetzt. Das wird gesagt, nicht verschwiegen — was er nach dieser Zeile noch schreibt,
      # stand nicht in der Sicherung und ist nach dem Neustart weg.
      if [ "$INSEL_STOPP_ANTWORT" = "launchd-fuehrt" ]; then
        echo "[rueckfall] ACHTUNG: launchd fuehrt den Server — er lief beim Zurueckspielen weiter."
      fi
      STATE_DATEI="${KLARWERK_DEV_PERSIST_FILE:-$SHARED_ROOT/data/state.jsonl}"
      VORHER="$STATE_DATEI.vor-rueckfall-$(date -u +%Y%m%dT%H%M%SZ)"
      if [ -f "$STATE_DATEI" ]; then
        cp "$STATE_DATEI" "$VORHER"
        echo "[rueckfall] bisheriger Journalstand gesichert: $VORHER"
      fi
      mkdir -p "$(dirname "$STATE_DATEI")"
      cp "$SICHERUNG" "$STATE_DATEI"
      echo "[rueckfall] Journal zurueckgespielt: $SICHERUNG -> $STATE_DATEI" ;;
    *)
      echo "Rückfall gescheitert, Grund: unbekannte Sicherungsart ($SICHERUNG)"
      exit 9 ;;
  esac
fi

# Ein Start, der gar nicht zustande kommt, ist kein roter Health — er hat einen eigenen Grund und
# einen eigenen Code. Vorher riss er unter `set -e` den Rückfall wortlos mit (BEN-R2-2); der Zeiger
# steht dann zwar schon richtig, aber niemand erfährt, dass nichts läuft.
if ! insel_server_starten "$CURRENT/start.command" "$LOG_DATEI" "$PID_DATEI"; then
  echo "Rückfall gescheitert, Grund: start (current zeigt auf $ZIEL_NAME, es läuft nichts)"
  exit 10
fi

if ! RUMPF="$(insel_gesundheit_warten "http://127.0.0.1:${PORT}/health" "$HEALTH_SEKUNDEN")"; then
  echo "Rückfall gescheitert, Grund: health"
  tail -40 "$LOG_DATEI" >&2 || true
  exit 7
fi

GEMESSENE_VERSION="$(insel_json_feld "$RUMPF" version)"

# Ohne Vergleichsmass gibt es kein „aktiv". Der Zeiger steht, die App antwortet — mehr ist nicht
# gemessen, und mehr steht dann auch nicht da (Auftrag §9: keine Aussage „aktiv" ohne frischen
# grünen Health MIT Version).
if [ -z "$ERWARTETE_VERSION" ]; then
  printf '%s\n' "$ZIEL_NAME" > "$SHARED_ROOT/AKTIV"
  echo "Rückfall geschaltet, $ZIEL_NAME antwortet (gemeldet ${GEMESSENE_VERSION:-keine Version}), aber die erwartete Version ist aus dem Release nicht belegbar"
  exit 8
fi

if [ "$GEMESSENE_VERSION" != "$ERWARTETE_VERSION" ]; then
  echo "Rückfall gescheitert, Grund: version (gemeldet ${GEMESSENE_VERSION:-keine}, erwartet $ERWARTETE_VERSION)"
  exit 8
fi

printf '%s\n' "$ZIEL_NAME" > "$SHARED_ROOT/AKTIV"
echo "Vorversion $ERWARTETE_VERSION aktiv"
exit 0
