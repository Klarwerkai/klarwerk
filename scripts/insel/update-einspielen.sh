#!/usr/bin/env bash
# ================================================================================================
# JOB 4012 — UPDATE MIT NETZ: sichern, Vertrag prüfen, umschalten, und bei Rot von selbst zurück.
# ================================================================================================
#
# DIE AUSGANGSLAGE, gemessen an `build-current-release.mjs:216-228`: Das Release schaltet `current`
# um, startet und wartet sechzig Sekunden auf `/health`. Kommt nichts, schreibt es
# „healthcheck fehlgeschlagen; previous=…" und endet mit 1 — und lässt die kaputte App stehen.
# Gesichert wurde vorher nur die Journaldatei, und nur im `install.command`; der kleine Update-Weg
# (`UPDATE-einspielen.command`, Übergabe §4.4) sichert gar nichts. Ob das neue Release überhaupt
# zu den vorhandenen Daten passt, hat noch nie jemand gefragt.
#
# DIE VIER GLIEDER DIESES WEGES, in dieser Reihenfolge und nicht in einer anderen:
#
#   1  SICHERUNG    Postgres über `scripts/backup/backup.sh`, Journal als Kopie mit Prüfsumme.
#                   Ohne gelungene Sicherung wird NICHT umgeschaltet. Der Grund ist einfach:
#                   ab dem Umschalten läuft `migrate()`, und danach ist die Sicherung das einzige,
#                   was eine irreversible Stufe noch zurückholt.
#   2  VERTRAG      Das neue Release nennt seine Stufen (`SCHEMA-VERTRAG`), die Daten nennen ihre
#                   (`SCHEMA-STAND`). Downgrade oder eine nicht umkehrbare Stufe ohne Zustimmung:
#                   Abbruch VOR dem Umschalten, die alte Fassung läuft ununterbrochen weiter.
#   3  UMSCHALTEN   Alten Server beenden, `current` umbiegen, starten.
#   4  BEWEIS       `/health` muss grün sein UND die Version des neuen Releases nennen. Nur beides
#                   zusammen heisst „aktiv". Sonst: Rückfall (`rueckfall.sh`) und Exit ungleich 0.
#
# WARUM DER STAND VOR DEM START GESCHRIEBEN WIRD, mit `bestaetigt=nein`: Sobald der neue Server
# startet, läuft `migrate()`. Wird der Health-Check danach rot, KÖNNEN die neuen Stufen bereits in
# den Daten stehen. Ein Stand, der das verschweigt, liesse ein späteres Update der alten Fassung
# als harmlos durchgehen — und das wäre genau der Downgrade, den Glied 2 verhindern soll. Der
# Zweifel fällt deshalb auf die vorsichtige Seite.
#
# ZWEI KORREKTUREN AUS RUNDE 2, beide aus Gegenproben von Ben und beide am selben Punkt: Ein Netz
# hilft nur, wenn es an etwas hängt, das es noch gibt.
#
#   KOLLISION   Ein vorhandenes Release wird NIE überschrieben. Vorher löschte dieser Weg sein
#               Zielverzeichnis („rm -rf") und packte neu aus. Bei zwei gleichnamigen Fassungen war
#               danach die Vorversion weg, auf die der Rückfall zurückgreifen wollte — er startete
#               das kaputte Release erneut (BEN1: Exit 9, danach HTTP 500). Seit Runde 2 trägt jeder
#               Baulauf seinen eigenen Namen (`release-texte.mjs: releaseIdentitaet`); trifft
#               trotzdem ein gleichnamiges Paket ein, bricht der Weg ab, BEVOR er etwas anfasst.
#
# DREI KORREKTUREN AUS RUNDE 3, alle drei aus Bens Gegenproben BEN-R2-1 und BEN-R2-2:
#
#   WIEDERHOLUNG  Die Kollisionsprüfung liess EINEN Fall durch: das Einspielen eines Releases, das
#                 schon in `releases/` liegt — insbesondere des GERADE LAUFENDEN. Der Weg lief bis
#                 zum Ende durch, schrieb dabei aber `VORVERSION` auf die laufende Fassung selbst,
#                 und danach fiel `rueckfall.sh` ohne Argument auf genau die Fassung „zurück", die
#                 ohnehin lief (BEN-R2-1: „Vorversion 1.1.0 aktiv", 1.0.0 unerreichbar). Ein zweites
#                 Einspielen darf den Rückfallpunkt nicht kosten: Quelle gleich Ziel ist jetzt
#                 derselbe Abbruch wie jede andere Namensgleichheit (Exit 6), und `VORVERSION` wird
#                 nie auf die Fassung geschrieben, auf die gerade umgeschaltet wird.
#   SICHERUNG     Der Zeitstempel hat Sekundenauflösung. Zwei Läufe in derselben Sekunde schrieben in
#                 dasselbe Sicherungsverzeichnis, der zweite über den ersten. Jeder Lauf bekommt sein
#                 eigenes Verzeichnis (`mktemp -d`), und der Name steht in der Ergebniszeile.
#   START         Scheitert der Startaufruf selbst (`launchctl kickstart`, BEN-R2-2), riss `set -e`
#                 den Weg mit — nach dem Umschalten, ohne Rückfall, ohne Ergebniszeile. Ein
#                 gescheiterter Start ist jetzt ein Grund wie „health": Rückfall und Exit 11.
#   DATENSTAND  Liegen Daten vor, ohne dass ein Stand oder ein Vertrag der laufenden Fassung sagt,
#               wie weit ein Release an ihnen gefahren ist, wird NICHT umgeschaltet. Vorher galt
#               „kein Stand" als „keine Daten", und eine irreversible Stufe lief über eine
#               Altinstallation (BEN2). Der Mensch kommt mit
#               `--datenstand-unbekannt-uebernehmen` darüber hinweg; dann gilt jede Stufe als neu.
#
# DREI KORREKTUREN AUS JOB 4127 — alle am ZIP, dem Weg, den der Betreiber wirklich geht (das Paket
# wird gezippt, weil sich auf den Mac Studio nicht direkt schreiben lässt; Übergabe §1) und der
# trotzdem bis dahin nur in seinem guten Fall gefahren war:
#
#   PAKET       `unzip` lief ungeprüft. Ein beschädigtes oder abgeschnittenes Archiv riss `set -e`
#               mit — kein Grund, keine Ergebniszeile, nur der rohe Exitcode von `unzip`. Dieselbe
#               Lehre wie „START", nur eine Zeile früher. Jetzt: Grund „paket", Exit 1.
#   MEHRDEUTIG  Trug das Zip seinen Vertrag nicht in der Wurzel, nahm eine Schleife wortlos den
#               ERSTEN Unterordner mit Vertrag. Bei zwei Releases im Paket entschied damit die
#               Sortierreihenfolge eines Globs, welche Fassung auf der Insel landet. Jetzt: die
#               Wahl wird ausgesprochen, und zwei Kandidaten sind ein Abbruch (Grund „mehrdeutig",
#               Exit 1), bevor irgendetwas angefasst ist. NACHTRAG AUS RUNDE 2 (BEN): Die Zählung
#               lief zuerst über `*` allein und übersah damit jeden VERSTECKTEN Unterordner — mit
#               `sichtbar/` und `.zweiter/` im Paket meldete der Weg „der einzige mit
#               SCHEMA-VERTRAG", sicherte und schaltete um. Eine Prüfung, die einen Kandidaten
#               nicht sieht, ist keine; gezählt werden jetzt alle unmittelbaren Einträge.
#   PAKETPFAD   Die Abbruchmeldung „trägt keinen SCHEMA-VERTRAG" nannte das Auspackverzeichnis unter
#               `${TMPDIR}/klarwerk-update-…`, das der Trap im selben Augenblick löscht. Genannt
#               wird jetzt das Zip, das der Mensch in der Hand hat.
#
# EXITCODES:
#   0  Update aktiv
#   1  Aufruf-/Umgebungsfehler
#   2  Sicherung gescheitert (nicht umgeschaltet)
#   3  Vertrag: Downgrade (nicht umgeschaltet)
#   4  Vertrag: nicht umkehrbare Migration ohne Zustimmung (nicht umgeschaltet)
#   5  Vertrag: unlesbar (nicht umgeschaltet)
#   6  Releasename kollidiert mit einer vorhandenen Fassung (nicht umgeschaltet)
#   7  Health rot — Rückfall gelaufen
#   8  Health grün, aber falsche Version — Rückfall gelaufen
#   9  Rückfall selbst gescheitert
#  10  Datenstand unbekannt, keine Zustimmung (nicht umgeschaltet)
#  11  Der Start des neuen Releases kam nicht zustande — Rückfall gelaufen
set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/insel/insel-betrieb.sh
. "$WURZEL/scripts/insel/insel-betrieb.sh"

SHARED_ROOT="${KLARWERK_SHARED_ROOT:-/Users/Shared/Klarwerk_Insel}"
RELEASES="$SHARED_ROOT/releases"
CURRENT="$SHARED_ROOT/current"
DATEN="$SHARED_ROOT/data"
BACKUPS="$SHARED_ROOT/backups"
LOGS="$SHARED_ROOT/logs"
PORT="${PORT:-3002}"
HEALTH_SEKUNDEN="${KLARWERK_HEALTH_SEKUNDEN:-60}"
PID_DATEI="$LOGS/server-${PORT}.pid"
LOG_DATEI="$LOGS/server-${PORT}.log"
STAND_DATEI="$DATEN/SCHEMA-STAND"
STATE_DATEI="${KLARWERK_DEV_PERSIST_FILE:-$DATEN/state.jsonl}"
VERTRAG_MJS="$WURZEL/scripts/insel/schema-vertrag.mjs"
RUECKFALL_SH="$WURZEL/scripts/insel/rueckfall.sh"
BACKUP_SH="${KLARWERK_BACKUP_SH:-$WURZEL/scripts/backup/backup.sh}"

QUELLE=""
VERTRAG_FLAGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --nicht-umkehrbar-einspielen)
      VERTRAG_FLAGS+=("$1")
      shift ;;
    --datenstand-unbekannt-uebernehmen)
      VERTRAG_FLAGS+=("--unbekannten-stand-uebernehmen")
      shift ;;
    -*)
      echo "[update] ABBRUCH: unbekannte Option $1" >&2
      exit 1 ;;
    *)
      QUELLE="$1"
      shift ;;
  esac
done

if [ -z "$QUELLE" ]; then
  echo "[update] Nutzung: update-einspielen.sh <release-zip|release-verzeichnis> [--nicht-umkehrbar-einspielen]" >&2
  exit 1
fi
if [ ! -e "$QUELLE" ]; then
  echo "[update] ABBRUCH: $QUELLE gibt es nicht." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[update] ABBRUCH: node nicht gefunden — ohne Node startet kein Release." >&2
  exit 1
fi

mkdir -p "$RELEASES" "$DATEN" "$LOGS"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

vertragsfeld() {
  if [ -f "$1" ]; then
    sed -n "s/^$2=//p" "$1" | head -n1
  fi
}

# Die App-Version eines Releases — Vertrag zuerst, sonst `package.json`, sonst leer. EIN Weg für
# beide Skripte (`schema-vertrag.mjs app-version`); der Verzeichnisname ist ausdrücklich keine Quelle.
app_version_von() {
  node "$VERTRAG_MJS" app-version "$1" 2>/dev/null || true
}

# ------------------------------------------------------------------------------------------------
# Wer läuft gerade? Die Antwort steht im Symlink, nicht in einer Erinnerung.
# ------------------------------------------------------------------------------------------------
VOR_NAME=""
VOR_VERSION=""
if [ -L "$CURRENT" ]; then
  VOR_NAME="$(basename "$(readlink "$CURRENT")")"
  VOR_VERSION="$(app_version_von "$RELEASES/$VOR_NAME")"
  if [ -z "$VOR_VERSION" ]; then
    # Kein Beleg — dann wird der Name genannt UND dazugesagt, dass er keiner ist.
    VOR_VERSION="$VOR_NAME (Version nicht belegbar)"
  fi
fi

abbruch_ohne_umschalten() {
  local grund="$1" code="$2"
  if [ -n "$VOR_NAME" ]; then
    echo "Update abgebrochen, Vorversion $VOR_VERSION läuft weiter, Grund: $grund"
  else
    echo "Update abgebrochen, keine Vorversion vorhanden, Grund: $grund"
  fi
  exit "$code"
}

# ------------------------------------------------------------------------------------------------
# DAS NEUE RELEASE BEREITSTELLEN. Sein Name kommt aus seinem eigenen Vertrag, nicht aus dem
# Dateinamen des Pakets: ein umbenanntes Zip darf kein anderes Release werden.
# ------------------------------------------------------------------------------------------------
AUSPACK=""
# Der Pfad des ZIPS, wenn die Quelle eines war — leer beim Ordnerweg. Jede Meldung über „das Paket"
# nennt ihn statt des Auspackverzeichnisses: das liegt unter `${TMPDIR}/klarwerk-update-…` und ist in
# dem Augenblick, in dem der Mensch die Meldung liest, vom Trap unten schon gelöscht.
PAKET=""
aufraeumen() {
  if [ -n "$AUSPACK" ] && [ -d "$AUSPACK" ]; then
    rm -rf "$AUSPACK"
  fi
}
trap aufraeumen EXIT

case "$QUELLE" in
  *.zip)
    if ! command -v unzip >/dev/null 2>&1; then
      echo "[update] ABBRUCH: unzip nicht gefunden — Paket kann nicht geöffnet werden." >&2
      exit 1
    fi
    PAKET="$QUELLE"
    AUSPACK="$(mktemp -d "${TMPDIR:-/tmp}/klarwerk-update-XXXXXX")"
    # DIESELBE LEHRE WIE „START" (Kopf :55), nur für das Auspacken nie gezogen: ungeprüft riss
    # `set -e` den Weg an dieser Zeile mit. Ein beschädigtes, abgeschnittenes oder gar kein Zip
    # endete mit dem rohen Exitcode von `unzip`, ohne Grund und ohne Ergebniszeile — und das ist der
    # Regelfall des echten Betriebs, denn das Paket kommt über eine Übertragung. Der geordnete
    # Ausgang ist `abbruch_ohne_umschalten` (:176, hier schon verwendbar) mit Exit 1
    # („Aufruf-/Umgebungsfehler", Tabelle :82): es ist nichts gesichert und nichts umgeschaltet.
    AUSPACK_MELDUNG=""
    if ! AUSPACK_MELDUNG="$(unzip -q "$QUELLE" -d "$AUSPACK" 2>&1)"; then
      echo "[update] ABBRUCH: $PAKET liess sich nicht auspacken — kein lesbares Zip-Paket." >&2
      if [ -n "$AUSPACK_MELDUNG" ]; then
        printf '%s\n' "$AUSPACK_MELDUNG" | sed -n '1,5p' >&2
      fi
      abbruch_ohne_umschalten "paket" 1
    fi
    NEU_QUELLE="$AUSPACK"
    if [ ! -f "$AUSPACK/SCHEMA-VERTRAG" ]; then
      # WELCHES RELEASE EINGESPIELT WIRD, DARF KEINE SORTIERREIHENFOLGE ENTSCHEIDEN. Vorher nahm
      # diese Stelle wortlos den ERSTEN Unterordner mit Vertrag; lagen zwei Releases im Paket,
      # entschied das Glob, und der Mensch erfuhr weder das eine noch das andere. Das ist derselbe
      # Grundsatz, den „KOLLISION" (:35) und „WIEDERHOLUNG" (:44) schon durchsetzen: im Zweifel
      # abbrechen, BEVOR etwas angefasst wird — und die getroffene Wahl aussprechen.
      #
      # DIE DREI MUSTER SIND EINS: alle unmittelbaren Einträge, AUCH die versteckten. `*` allein
      # übergeht jeden Punkteintrag — und eine Mehrdeutigkeitsprüfung, die einen Kandidaten nicht
      # sieht, ist keine: sie spielte den sichtbaren Ordner ein und nannte ihn dabei „den einzigen
      # mit SCHEMA-VERTRAG" (BEN, Runde 1, mit `sichtbar/` und `.zweiter/` gemessen). Was in einem
      # Paket liegt, das gepackt, übertragen und ausgepackt wurde, bestimmt nicht der Betreiber.
      # `.[!.]*` fängt `.name`, `..?*` fängt `..name`; `.` und `..` selbst bleiben damit draussen,
      # anders als bei `shopt -s dotglob`, das sie in älteren bash-Fassungen mitbringt.
      KANDIDATEN=""
      ANZAHL=0
      for kandidat in "$AUSPACK"/* "$AUSPACK"/.[!.]* "$AUSPACK"/..?*; do
        [ -f "$kandidat/SCHEMA-VERTRAG" ] || continue
        KANDIDATEN="${KANDIDATEN}${KANDIDATEN:+, }$(basename "$kandidat")"
        ANZAHL=$((ANZAHL + 1))
        NEU_QUELLE="$kandidat"
      done
      if [ "$ANZAHL" -gt 1 ]; then
        echo "[update] ABBRUCH: $PAKET enthält $ANZAHL Ordner mit SCHEMA-VERTRAG ($KANDIDATEN)." >&2
        echo "[update]   Welches Release gemeint ist, darf keine Sortierreihenfolge entscheiden — packe genau eines ein." >&2
        abbruch_ohne_umschalten "mehrdeutig" 1
      fi
      if [ "$ANZAHL" -eq 1 ]; then
        echo "[update] Paketordner gewählt: $KANDIDATEN (der einzige mit SCHEMA-VERTRAG)"
      fi
    fi ;;
  *)
    NEU_QUELLE="$(cd "$QUELLE" && pwd)" ;;
esac

NEU_VERTRAG="$NEU_QUELLE/SCHEMA-VERTRAG"
if [ ! -f "$NEU_VERTRAG" ]; then
  echo "[update] ABBRUCH: ${PAKET:-$NEU_QUELLE} trägt keinen SCHEMA-VERTRAG — Herkunft und Stufen unbekannt." >&2
  abbruch_ohne_umschalten "vertrag" 5
fi
NEU_NAME="$(vertragsfeld "$NEU_VERTRAG" release)"
NEU_VERSION="$(vertragsfeld "$NEU_VERTRAG" app_version)"
if [ -z "$NEU_NAME" ] || [ -z "$NEU_VERSION" ]; then
  echo "[update] ABBRUCH: SCHEMA-VERTRAG nennt release oder app_version nicht." >&2
  abbruch_ohne_umschalten "vertrag" 5
fi
echo "[update] Paket: $NEU_NAME (App-Version $NEU_VERSION)"

# ------------------------------------------------------------------------------------------------
# GLIED 0 — DIE VORVERSION MUSS DIE VORVERSION BLEIBEN.
#
# Diese Prüfung steht VOR der Sicherung, weil ihr Abbruch nichts kosten darf: Es wird nichts
# gesichert, nichts ausgepackt, nichts angefasst. Ein vorhandenes Release-Verzeichnis ist ab hier
# unantastbar — auch bei Namensgleichheit durch ein umbenanntes oder von Hand gebautes Paket.
#
# OHNE AUSNAHME, und das ist die Korrektur aus Runde 3 (BEN-R2-1): Runde 2 liess „die Quelle IST
# schon das Zielverzeichnis" durch, weil das nach einem harmlosen Wiederholungslauf aussieht. Es ist
# das Gegenteil. Wer die laufende Fassung noch einmal einspielt, hat nichts zu gewinnen — sie läuft
# ja — und verliert den Rückfallpunkt, weil der Weg danach sie selbst als Vorversion vermerkt. Ein
# Update auf sich selbst ist kein Update. Wer eine vorhandene Fassung anfahren will, nimmt den Weg,
# der dafür gebaut ist: `rueckfall.sh <release>`.
# ------------------------------------------------------------------------------------------------
ZIEL="$RELEASES/$NEU_NAME"
if [ -e "$ZIEL" ]; then
  if [ "$NEU_QUELLE" = "$ZIEL" ]; then
    echo "[update] ABBRUCH: $NEU_NAME liegt bereits unter releases/ — ein Update auf sich selbst hätte keine Vorversion." >&2
  else
    echo "[update] ABBRUCH: releases/$NEU_NAME gibt es schon — ein Release wird nie überschrieben." >&2
  fi
  echo "[update]   Diese Fassung anfahren: rueckfall.sh $NEU_NAME" >&2
  abbruch_ohne_umschalten "kollision" 6
fi

# ------------------------------------------------------------------------------------------------
# GLIED 1 — SICHERUNG. Vor allem anderen, und ohne sie geht es nicht weiter.
# ------------------------------------------------------------------------------------------------
echo "Sicherung läuft …"
DB_URL="${KLARWERK_DATABASE_URL:-${DATABASE_URL:-}}"
SICHERUNG=""
SICHERUNGSART=""

sha256_von() {
  node -e '
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
process.stdout.write(createHash("sha256").update(readFileSync(process.argv[1])).digest("hex"));
' "$1"
}

if ! mkdir -p "$BACKUPS" 2>/dev/null || [ ! -d "$BACKUPS" ]; then
  echo "[update] ABBRUCH: Sicherungsverzeichnis $BACKUPS lässt sich nicht anlegen." >&2
  abbruch_ohne_umschalten "sicherung" 2
fi

# JEDER LAUF BEKOMMT SEIN EIGENES VERZEICHNIS (Korrektur aus Runde 3). Der Zeitstempel allein hat
# Sekundenauflösung; zwei Läufe in derselben Sekunde — im Prüfstand der Normalfall, auf der Insel der
# unglückliche — schrieben sonst in dasselbe Verzeichnis, und die zweite Sicherung überschrieb die
# erste. Eine Sicherung, die eine andere Sicherung löscht, ist keine. `mktemp -d` legt das
# Verzeichnis in EINEM Schritt an und vergibt den Namen dabei; ein „gibt es schon?"-Blick davor wäre
# ein Wettlauf. Der Name steht am Ende in der Ergebniszeile.
LAUF_ORDNER=""
if ! LAUF_ORDNER="$(mktemp -d "$BACKUPS/$STAMP-XXXXXX" 2>/dev/null)"; then
  echo "[update] ABBRUCH: in $BACKUPS lässt sich kein Sicherungsverzeichnis für diesen Lauf anlegen." >&2
  abbruch_ohne_umschalten "sicherung" 2
fi

if [ -n "$DB_URL" ]; then
  SICHERUNGSART="postgres"
  if [ ! -f "$BACKUP_SH" ]; then
    echo "[update] ABBRUCH: backup.sh fehlt ($BACKUP_SH)." >&2
    abbruch_ohne_umschalten "sicherung" 2
  fi
  BACKUP_LOG="$LAUF_ORDNER/backup.log"
  # DAS ZIEL IST DER LAUFORDNER, NICHT `$BACKUPS` (Korrektur Runde 4, Bens Postgres-Gegenprobe).
  # Runde 3 gab dem Lauf zwar ein eigenes Verzeichnis, schickte `backup.sh` aber weiter in das
  # gemeinsame — nur das Protokoll lag eindeutig. `backup.sh` baut seinen Dateinamen aus seinem
  # EIGENEN `date` (`$DEST/klarwerk-<stempel>.dump`, Sekundenauflösung): zwei Läufe in derselben
  # Sekunde schrieben denselben Namen, und der zweite Dump ersetzte den ersten samt Prüfsumme.
  # Damit war die Sicherung, die das Netz sein soll, selbst das Loch. Im Laufordner kann kein
  # zweiter Lauf hinzielen, weil `mktemp -d` den Ordnernamen vergibt.
  if ! bash "$BACKUP_SH" "$LAUF_ORDNER" >"$BACKUP_LOG" 2>&1; then
    echo "[update] backup.sh rot:" >&2
    tail -20 "$BACKUP_LOG" >&2 || true
    abbruch_ohne_umschalten "sicherung" 2
  fi
  cat "$BACKUP_LOG"
  SICHERUNG="$(sed -n 's/^\[backup\] Dump nach: //p' "$BACKUP_LOG" | head -n1)"
  if [ -z "$SICHERUNG" ] || [ ! -f "$SICHERUNG" ] || [ ! -f "$SICHERUNG.sha256" ]; then
    echo "[update] ABBRUCH: backup.sh meldete Erfolg, aber Dump oder Prüfsumme fehlen." >&2
    abbruch_ohne_umschalten "sicherung" 2
  fi
elif [ -f "$STATE_DATEI" ]; then
  SICHERUNGSART="journal"
  SICHERUNG="$LAUF_ORDNER/state.jsonl"
  if ! cp "$STATE_DATEI" "$SICHERUNG" 2>/dev/null; then
    echo "[update] ABBRUCH: Journal liess sich nicht kopieren ($STATE_DATEI)." >&2
    abbruch_ohne_umschalten "sicherung" 2
  fi
  QUELL_HASH="$(sha256_von "$STATE_DATEI")"
  KOPIE_HASH="$(sha256_von "$SICHERUNG")"
  if [ -z "$QUELL_HASH" ] || [ "$QUELL_HASH" != "$KOPIE_HASH" ]; then
    echo "[update] ABBRUCH: die Journalkopie weicht vom Original ab — keine gültige Sicherung." >&2
    abbruch_ohne_umschalten "sicherung" 2
  fi
  printf '%s  %s\n' "$KOPIE_HASH" "state.jsonl" > "$SICHERUNG.sha256"
elif [ -n "$VOR_NAME" ]; then
  # Eine laufende Fassung ohne auffindbare Daten ist kein Erstlauf, sondern ein Befund.
  echo "[update] ABBRUCH: weder Datenbank-URL noch Journal ($STATE_DATEI) gefunden." >&2
  abbruch_ohne_umschalten "sicherung" 2
else
  SICHERUNGSART="erstinstallation"
  SICHERUNG="(keine — Erstinstallation, es gibt noch keine Daten)"
  # Kein Inhalt, kein Verzeichnis: ein leerer Ordner neben echten Sicherungen sähe aus wie eine.
  rmdir "$LAUF_ORDNER" 2>/dev/null || true
fi
echo "[update] Sicherung ($SICHERUNGSART): $SICHERUNG"

# ------------------------------------------------------------------------------------------------
# GLIED 2 — DER SCHEMA-VERTRAG. Noch ist nichts umgeschaltet; ein Abbruch hier kostet nichts.
# ------------------------------------------------------------------------------------------------
if [ ! -f "$STAND_DATEI" ] && [ -n "$VOR_NAME" ] && [ -f "$RELEASES/$VOR_NAME/SCHEMA-VERTRAG" ]; then
  # Kein Stand, aber eine laufende Fassung: deren Vertrag IST der belegte Mindeststand der Daten —
  # sie ist an ihnen gefahren. Das ist gemessen, nicht angenommen.
  node "$VERTRAG_MJS" stand-schreiben "$RELEASES/$VOR_NAME/SCHEMA-VERTRAG" "$STAND_DATEI" \
    --bestaetigt ja
fi

# GIBT ES ÜBERHAUPT DATEN? Das ist die Frage, die „kein Stand" erst deutbar macht — und die Runde 1
# nicht gestellt hat. Eine LEERE Journaldatei zählt nicht: die legt jedes Release beim ersten Start
# selbst an (`start.command`), sie ist ein belegter leerer Stand und kein unbekannter.
if [ -n "$DB_URL" ] || [ -s "$STATE_DATEI" ]; then
  VERTRAG_FLAGS+=("--daten-vorhanden")
fi

VERTRAG_CODE=0
node "$VERTRAG_MJS" pruefen "$STAND_DATEI" "$NEU_VERTRAG" \
  ${VERTRAG_FLAGS[@]+"${VERTRAG_FLAGS[@]}"} || VERTRAG_CODE=$?
if [ "$VERTRAG_CODE" = "10" ]; then
  # Eigener Grund, eigener Code: „ich weiss es nicht" ist kein Vertragsbruch, sondern eine Lücke im
  # Wissen über die Daten. Wer sie schliesst, tut es ausdrücklich.
  abbruch_ohne_umschalten "datenstand" 10
fi
if [ "$VERTRAG_CODE" != "0" ]; then
  abbruch_ohne_umschalten "vertrag" "$VERTRAG_CODE"
fi

# ------------------------------------------------------------------------------------------------
# GLIED 3 — UMSCHALTEN. Ab hier ist der Rückfall der einzige Weg zurück, und er ist gebaut.
# ------------------------------------------------------------------------------------------------
# `$ZIEL` steht seit Glied 0 fest und ist dort als frei belegt worden — es gab es nicht, also wird es
# hier angelegt. Gelöscht wird nichts.
mkdir -p "$ZIEL"
tar -C "$NEU_QUELLE" -cf - . | tar -C "$ZIEL" -xf -
if [ ! -x "$ZIEL/start.command" ]; then
  echo "[update] ABBRUCH: $ZIEL/start.command fehlt oder ist nicht ausführbar." >&2
  abbruch_ohne_umschalten "paket" 1
fi

# DER RÜCKFALLPUNKT. Er wird festgehalten, BEVOR irgendetwas umgeschaltet wird — und er wird nie auf
# die Fassung geschrieben, die gleich läuft (BEN-R2-1). Glied 0 fängt diesen Fall bereits ab; hier
# steht die zweite Sperre, weil dieser eine Wert entscheidet, ob es im Ernstfall überhaupt ein Ziel
# gibt. Ein Verzeichnis, das es nicht mehr gibt, wird ebenfalls nicht eingetragen: ein bisheriger,
# noch erreichbarer Eintrag ist mehr wert als ein frischer, der ins Leere zeigt.
if [ -n "$VOR_NAME" ] && [ "$VOR_NAME" != "$NEU_NAME" ] && [ -d "$RELEASES/$VOR_NAME" ]; then
  printf '%s\n' "$VOR_NAME" > "$SHARED_ROOT/VORVERSION"
fi
node "$VERTRAG_MJS" stand-schreiben "$NEU_VERTRAG" "$STAND_DATEI" --bestaetigt nein

# ------------------------------------------------------------------------------------------------
# GLIED 4 — DER BEWEIS. Grün UND die richtige Version, sonst zurück.
#
# `zurueck` steht VOR dem Umschalten da, weil ab der nächsten Zeile jeder Ausgang ihn braucht — auch
# der, den Runde 2 nicht hatte: ein Start, der gar nicht erst zustande kommt.
# ------------------------------------------------------------------------------------------------
zurueck() {
  local grund="$1" code="$2"
  if [ -z "$VOR_NAME" ]; then
    echo "Update abgebrochen, keine Vorversion vorhanden, Grund: $grund"
    exit "$code"
  fi
  if ! bash "$RUECKFALL_SH" "$VOR_NAME" --grund "$grund"; then
    echo "Update abgebrochen, Rückfall auf $VOR_VERSION gescheitert, Grund: $grund"
    exit 9
  fi
  echo "Update abgebrochen, Vorversion $VOR_VERSION läuft wieder, Grund: $grund"
  exit "$code"
}

insel_server_stoppen "$PID_DATEI"
ln -sfn "$ZIEL" "$CURRENT"
echo "[update] current -> $(readlink "$CURRENT")"
if ! insel_server_starten "$CURRENT/start.command" "$LOG_DATEI" "$PID_DATEI"; then
  echo "[update] Der Start von $NEU_NAME kam nicht zustande." >&2
  zurueck "start" 11
fi

if ! RUMPF="$(insel_gesundheit_warten "http://127.0.0.1:${PORT}/health" "$HEALTH_SEKUNDEN")"; then
  echo "[update] /health bleibt rot. Letzte Protokollzeilen:" >&2
  tail -40 "$LOG_DATEI" >&2 || true
  zurueck "health" 7
fi

GEMESSENE_VERSION="$(insel_json_feld "$RUMPF" version)"
if [ "$GEMESSENE_VERSION" != "$NEU_VERSION" ]; then
  echo "[update] /health meldet Version ${GEMESSENE_VERSION:-keine}, erwartet $NEU_VERSION." >&2
  zurueck "version" 8
fi

node "$VERTRAG_MJS" stand-schreiben "$NEU_VERTRAG" "$STAND_DATEI" --bestaetigt ja
printf '%s\n' "$NEU_NAME" > "$SHARED_ROOT/AKTIV"
echo "Update auf $NEU_VERSION aktiv, Sicherung $SICHERUNG"
exit 0
