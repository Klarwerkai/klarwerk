#!/usr/bin/env bash
# ================================================================================================
# JOB 517 — RESTORE-DRILL. Ein Backup, das nie zurueckgespielt wurde, ist eine Vermutung.
# ================================================================================================
#
# Dieser Drill spielt einen Dump in eine FRISCHE, LEERE Datenbank zurueck, prueft JEDE Tabelle, die
# das Produkt anlegt (`PFLICHTTABELLEN` weiter unten), samt Zeilenzahlen gegen COPY-Daten AUS DEM
# DUMP und startet Klara mit `npx tsx services/app/src/server.ts` dagegen,
# meldet sich mit einem Konto AUS DEM DUMP an, fragt die Auditkette ab und liest ein
# wiederhergestelltes Wissensobjekt samt Beleg und Anhangsinhalt ueber die laufende Anwendung
# zurueck. Erst das ist ein Wiederherstellungsbeleg. Danach raeumt er den identifizierten Prozess
# wieder ab.
#
# JOB 4097 — WARUM DER PFLICHTSATZ NICHT MEHR AUS VIER NAMEN BESTEHT. Bis hierher prueften Struktur-
# und Zeilengate genau kos, users, audit und objects. Das Produkt migriert aber rund vierzig Tabellen
# (`services/app/src/db.ts`, `schemas`): ein Restore konnte die Entwuerfe (`drafts`), die Belege
# samt Anhangszuordnung (`ko_evidence`), die Validierungen, die Konfliktvermerke, die
# Import-Kandidaten und die Lesevarianten verlieren und trotzdem mit Exit 0 enden. Der Betreiber
# las „Drill bestanden" und glaubte, sein Bestand sei zurueck. Besonders `ko_evidence` trifft:
# dort steht die Zuordnung Datei→Wissensobjekt (`data->>'objectId'`). Ein Restore, der `objects`
# vollstaendig zurueckbringt, aber `ko_evidence` verliert, laesst die Dateien in der Ablage liegen
# und nimmt ihnen jede Zugehoerigkeit.
#
# EINE WAHRHEIT, KEIN ZWEITER PFLEGEORT: `tests/backup-drill/tabellensatz.test.ts` haelt
# `PFLICHTTABELLEN` gegen die `CREATE TABLE`-Anweisungen der migrierten Schemata. Kommt eine
# Migration dazu und diese Liste wird nicht erweitert, ist das Tor rot.
#
# ZUORDNUNG UEBER DIE PROZESSGRUPPE, NICHT UEBER PID-GLEICHHEIT (JOB 4010): Zwischen Drill und
# Server steht der npx-Launcher, dessen PID nachweislich eine andere ist als die, die der Server
# in die PID-Datei schreibt. Der Drill startet deshalb in einer EIGENEN PROZESSGRUPPE und erkennt
# daran seine eigene Nachkommenschaft; die PID-Datei wird gegen genau diese Gruppe gehalten und
# nicht geglaubt. Ein fremder Prozess bekommt nie ein Signal (Exit 80, fail-closed).
# Belege: tests/backup-drill/prozesszuordnung.test.ts (echtes npx/tsx, ohne Datenbank),
# tests/backup-drill/echter-wiederanlauf.integration.test.ts (echter Dump gegen echte PostgreSQL);
# Einzelheiten in docs/operations/restore-drill.md.
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
#  22   Fehlender Bestand: eine Pflichttabelle fehlt nach dem Restore ODER der Dump fuehrt fuer sie
#       gar keinen Bestand (kein COPY-Block UND kein Eintrag im Inhaltsverzeichnis) — alle Namen
#       in einer Meldung
#  23   Zeilenabweichung: Tabellenname und beide Zahlen (Dump / Datenbank)
#  24   Zeilen nicht messbar: Inhaltsverzeichnis, Extraktion, COPY-Format oder SQL-Zaehler;
#       nennt die Tabelle
#  30   Anwendung wurde nicht lebendig (keine PID-Datei / kein `listen` / health != 200)
#  31   Startwerkzeug node, npx oder lokales tsx fehlt oder ist nicht ausfuehrbar
#  60   LOGIN fehlgeschlagen (HTTP != 200) — Aufbaufehler, KEIN Auditbefund
#  61   Verifikation mit 403 abgelehnt — die Fixture hat kein `ko.validate`, Aufbaufehler
#  62   Wissensnachweis: AUFBAUFEHLER — der Bestand liess sich nicht befragen, oder Route/Recht
#       antworteten nicht mit 200. KEIN Befund am Bestand.
#  70   Auditkette: linkageBreaks != 0
#  71   Auditkette: unresolvedDeviations != 0
#  72   Auditkette: uncheckedDeviations != 0
#  73   Wissensnachweis: BEFUND — eine Belegzeile zeigt auf eine Anhangskennung, zu der `objects`
#       keine Zeile fuehrt, ODER das Wissensobjekt, sein Beleg oder der Anhangsinhalt kam nach dem
#       Restore nicht zurueck, obwohl die Datenbank sie fuehrt
#  74   Rechte: die Rollenverteilung der Konten (users.role/approved) weicht zwischen Dump und
#       Datenbank ab
#  80   REAPING fehlgeschlagen (fremde/wiederverwendete PID oder Prozess ueberlebt)
#
# ADMIN-13 — DAS PROTOKOLL DER PROBE. Jeder Lauf, der einen vorhandenen Dump erhalten hat, hinterlegt
# neben dem Dump `letzter-drill.json` — der gescheiterte genauso wie der bestandene, atomar
# geschrieben (Arbeitsname, dann umbenannt). Darin stehen Beginn, Ende, Ergebnis, Exitcode, ein
# fester Grund je Exitcode, der verwendete Sicherungsstand, der Pruefsummenbefund, das isolierte Ziel
# und der Vergleich fuer Beitraege, Anhaenge, Beziehungen und Rechte. Was nicht gemessen wurde, steht
# als `null` bzw. `nicht_gemessen` darin. KEINE Zugangsdaten: weder DRILL_LOGIN_EMAIL noch das
# Kennwort noch das Sitzungstoken gehen in die Datei. Die Verwaltung liest sie ueber
# `GET /api/admin/sicherungen` (services/app/src/routes/admin-routes.ts).
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

# ------------------------------------------------------------------------------------------------
# ADMIN-13 — DAS PROTOKOLL. Ab hier ist bekannt, WELCHER Sicherungsstand geprobt wird; ab hier
# hinterlaesst deshalb jeder Ausgang seine Spur, auch die Abbrueche in Glied 1 (Pruefsumme), die vor
# jedem Restore liegen. Der Zustand der Probe wird unterwegs in den Variablen unten gesammelt und
# erst beim Verlassen in EINEM Schritt geschrieben (`abschluss`).
# ------------------------------------------------------------------------------------------------
PROTOKOLL="$(dirname "$DUMP")/letzter-drill.json"
DRILL_BEGINN="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
PRUEFSUMME_ZUSTAND="nicht_geprueft"
PRUEFSUMME_WERT=""
ANHANG_WAISEN=""
ROLLEN_ZUSTAND=""
ROLLEN_DUMP=""
ROLLEN_DB=""
WISSENSNACHWEIS=""

# Eine Zeichenkette als JSON-Text: Rueckstrich und Anfuehrungszeichen maskiert, Steuerzeichen weg.
json_text() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="$(printf '%s' "$s" | tr -d '\000-\037')"
  printf '"%s"' "$s"
}

json_text_oder_null() {
  if [ -z "$1" ]; then
    printf 'null'
  else
    json_text "$1"
  fi
}

# Der Grund im Protokoll ist ein FESTER Satz je Exitcode — keine Abbruchmeldung im Wortlaut. So
# kann keine Meldung, die einen Wert aus der Umgebung zitiert, in die Datei geraten.
grund_fuer() {
  case "$1" in
    0) echo "Drill bestanden: Restore in ein leeres Ziel, Pflichttabellen und Vergleich wie im Dump, Anwendung gestartet, Anmeldung und Auditkette tragen." ;;
    1) echo "Aufruf- oder Umgebungsfehler: Variable oder Werkzeug fehlt." ;;
    10) echo "Pruefsummendatei fehlt oder traegt keine 64-Hex-Pruefsumme - es wurde nichts wiederhergestellt." ;;
    11) echo "Pruefsumme passt nicht zum Dump - die Sicherung ist beschaedigt, es wurde nichts wiederhergestellt." ;;
    20) echo "Zieldatenbank nicht anlegbar, nicht erreichbar oder nicht leer - es wurde nichts wiederhergestellt." ;;
    21) echo "pg_restore ist gescheitert - die Sicherung liess sich nicht einspielen." ;;
    22) echo "Fehlender Bestand: eine Pflichttabelle fehlt nach dem Restore oder der Dump fuehrt fuer sie keinen Bestand." ;;
    23) echo "Zeilenabweichung zwischen Dump und wiederhergestellter Datenbank." ;;
    24) echo "Vergleich nicht messbar: Inhaltsverzeichnis, Extraktion, COPY-Format oder SQL-Abfrage." ;;
    30) echo "Die Anwendung wurde gegen die wiederhergestellte Datenbank nicht lebendig." ;;
    31) echo "Startwerkzeug node, npx oder lokales tsx fehlt." ;;
    60) echo "Anmeldung mit dem Konto aus dem Dump gescheitert - Aufbaufehler der Probe." ;;
    61) echo "Auditverifikation abgelehnt - dem Konto fehlt ko.validate, Aufbaufehler der Probe." ;;
    62) echo "Wissensnachweis nicht befragbar - Aufbaufehler der Probe, kein Befund am Bestand." ;;
    70) echo "Auditkette gebrochen (linkageBreaks)." ;;
    71) echo "Auditkette mit unerklaerter Hashabweichung (unresolvedDeviations)." ;;
    72) echo "Auditkette mit ungeprueften Abweichungen (uncheckedDeviations)." ;;
    73) echo "Anhaenge: ein Beleg zeigt ins Leere oder kam nach dem Restore nicht zurueck." ;;
    74) echo "Rechte: die Rollenverteilung der Konten weicht zwischen Dump und Datenbank ab." ;;
    80) echo "Zuordnung oder Abraeumen des Probeprozesses fehlgeschlagen." ;;
    *) echo "Abbruch mit Exitcode $1." ;;
  esac
}

# Eine Vergleichskategorie: je Tabelle Dump- und Datenbankzahl aus dem Zeilenabgleich (Glied 3).
# Fehlt eine Zahl, wurde die Tabelle nicht gemessen — dann ist die Kategorie nie `gleich`. Der erste
# Parameter traegt den Befund einer Zusatzpruefung (leer = bestanden).
vergleich_json() {
  local zusatz="$1"
  shift
  local zustand="gleich" eintraege="" tabelle name wert
  for tabelle in "$@"; do
    name="VG_${tabelle}"
    wert="${!name:-}"
    if [ -z "$wert" ]; then
      [ "$zustand" = "abweichend" ] || zustand="nicht_gemessen"
      eintraege="${eintraege}${eintraege:+,}{\"tabelle\":\"${tabelle}\",\"dump\":null,\"datenbank\":null}"
    else
      [ "${wert% *}" = "${wert#* }" ] || zustand="abweichend"
      eintraege="${eintraege}${eintraege:+,}{\"tabelle\":\"${tabelle}\",\"dump\":${wert% *},\"datenbank\":${wert#* }}"
    fi
  done
  case "$zusatz" in
    abweichend) zustand="abweichend" ;;
    nicht_gemessen) [ "$zustand" = "abweichend" ] || zustand="nicht_gemessen" ;;
  esac
  printf '{"zustand":"%s","tabellen":[%s]' "$zustand" "$eintraege"
}

schreibe_protokoll() {
  local code="$1" ergebnis="fehler" ende waisen="null" anhang_zusatz="nicht_gemessen"
  local rechte_zusatz="nicht_gemessen" arbeitsname="${PROTOKOLL}.partial.$$"
  [ "$code" = "0" ] && ergebnis="erfolg"
  ende="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
  if [[ "$ANHANG_WAISEN" =~ ^[0-9]+$ ]]; then
    waisen="$ANHANG_WAISEN"
    if [ "$ANHANG_WAISEN" -eq 0 ]; then anhang_zusatz=""; else anhang_zusatz="abweichend"; fi
  fi
  # 73 ist immer ein Befund an den Anhaengen — auch der, der erst beim Zuruecklesen auffiel.
  [ "$code" = "73" ] && anhang_zusatz="abweichend"
  case "$ROLLEN_ZUSTAND" in
    gleich) rechte_zusatz="" ;;
    abweichend) rechte_zusatz="abweichend" ;;
  esac
  if ! {
    printf '{"format":"klarwerk-restore-drill","formatVersion":1,'
    printf '"beginn":%s,"zeit":%s,' "$(json_text_oder_null "$DRILL_BEGINN")" "$(json_text_oder_null "$ende")"
    printf '"ergebnis":"%s","exitcode":%s,"grund":%s,' "$ergebnis" "$code" "$(json_text "$(grund_fuer "$code")")"
    printf '"sicherung":%s,' "$(json_text "$(basename "$DUMP")")"
    printf '"pruefsumme":{"zustand":"%s","sha256":%s},' "$PRUEFSUMME_ZUSTAND" "$(json_text_oder_null "$PRUEFSUMME_WERT")"
    printf '"ziel":%s,' "$(json_text_oder_null "${RESTORE_DB:-}")"
    printf '"vergleich":{'
    printf '"beitraege":%s},' "$(vergleich_json "" kos ko_versions)"
    printf '"anhaenge":%s,"belegeOhneAnhang":%s},' "$(vergleich_json "$anhang_zusatz" objects ko_evidence)" "$waisen"
    printf '"beziehungen":%s},' "$(vergleich_json "" ko_kanten ko_kanten_beitrag)"
    printf '"rechte":%s,"rollenDump":%s,"rollenDatenbank":%s}' "$(vergleich_json "$rechte_zusatz" users)" \
      "$(json_text_oder_null "$ROLLEN_DUMP")" "$(json_text_oder_null "$ROLLEN_DB")"
    printf '},"wissensnachweis":%s}\n' "$(json_text_oder_null "$WISSENSNACHWEIS")"
  } > "$arbeitsname" 2>/dev/null || ! mv -f "$arbeitsname" "$PROTOKOLL" 2>/dev/null; then
    rm -f "$arbeitsname" 2>/dev/null || true
    echo "[drill] HINWEIS: $PROTOKOLL liess sich NICHT schreiben — fuer diesen Lauf liegt kein Protokoll vor." >&2
    return 0
  fi
  echo "[drill] Protokoll hinterlegt: $PROTOKOLL (Exitcode $code)"
}

# Der Ausgang: erst abraeumen (Glied 8, sobald `reap` definiert ist), dann protokollieren — mit dem
# Code, mit dem der Drill WIRKLICH endet. Scheitert das Abraeumen, ist das 80 und nicht der Code davor.
abschluss() {
  local rc=$?
  local ende_rc="$rc"
  set +e
  if declare -F reap >/dev/null; then
    reap "$rc"
    ende_rc=$?
  fi
  schreibe_protokoll "$ende_rc"
  exit "$ende_rc"
}
trap abschluss EXIT

RESTORE_DB="${RESTORE_DB:-}"
if [ -z "$RESTORE_DB" ]; then
  echo "[drill] ABBRUCH: RESTORE_DB ist nicht gesetzt (eigener, leerer Zielname)." >&2
  exit 1
fi

DRILL_PORT="${DRILL_PORT:-3097}"
ARBEIT="${DRILL_WORKDIR:-$(dirname "$DUMP")}"
PID_FILE="${ARBEIT}/klarwerk-drill.pid"
# Ablage der Jobliste fuer die Abstammungspruefung (s. `eigene_gruppe`). `jobs` schreibt sie mit
# einer Umlenkung der laufenden Shell; eine Ersetzung `$(jobs)` liefe in einer Subshell.
JOBS_DATEI="${ARBEIT}/klarwerk-drill.jobs"
# JOB 4097: Glied 7b holt den Anhangsinhalt als Datei ab — ein Anhang ist binaer, und eine
# Shell-Variable verschluckt Nullbytes. Gemessen wird deshalb an der Datei, nicht an einer
# Zeichenkette. `reap` raeumt sie mit der PID-Datei zusammen wieder weg.
ANHANG_DATEI="${ARBEIT}/klarwerk-drill.anhang"
# JOB 4097 R2: die Belegantwort wird STRUKTURIERT ausgewertet (s. Glied 7b), nicht nach Text
# durchsucht. Sie geht dafuer durch eine Datei — eine JSON-Antwort ueber die Befehlszeile zu
# reichen, waere eine Groessen- und Zitierfalle. `reap` raeumt auch sie wieder weg.
BELEG_DATEI="${ARBEIT}/klarwerk-drill.belege.json"
WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"

# `ps` gehoert zu den Pflichtwerkzeugen: ohne die Prozessgruppe eines PID laesst sich die
# Abstammung des Serverprozesses nicht feststellen, und der Drill duerfte dann kein Signal senden.
for werkzeug in pg_restore createdb psql ps; do
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
  PRUEFSUMME_ZUSTAND="fehlt"
  echo "[drill] ABBRUCH (10): kein Sidecar zu $DUMP — pg_restore wird nicht gestartet." >&2
  exit 10
fi

ERWARTET="$(awk '{print $1}' < "$SIDECAR" | tr -d '[:space:]')"
if ! printf '%s' "$ERWARTET" | grep -Eq '^[0-9a-f]{64}$'; then
  PRUEFSUMME_ZUSTAND="ungueltig"
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

PRUEFSUMME_WERT="$IST"
if [ "$IST" != "$ERWARTET" ]; then
  PRUEFSUMME_ZUSTAND="abweichend"
  echo "[drill] ABBRUCH (11): Pruefsumme weicht ab — pg_restore wird nicht gestartet." >&2
  echo "[drill]   erwartet $ERWARTET" >&2
  echo "[drill]   gemessen $IST" >&2
  exit 11
fi
PRUEFSUMME_ZUSTAND="passt"
echo "[drill] Glied 1 — Sidecar geprueft: $ERWARTET"

# ------------------------------------------------------------------------------------------------
# GLIED 8 vorbereitet — REAPING. Der Trap raeumt auch bei jedem Abbruch weiter unten auf.
# ------------------------------------------------------------------------------------------------
#
# `reap` beendet AUSSCHLIESSLICH, was dieser Drill selbst gestartet hat. Die PID allein genuegt
# dafuer nicht — PIDs werden wiederverwendet —, und ein Vergleich der Launcher-PID mit der
# PID-Datei genuegt ebenfalls nicht: zwischen beiden steht der npx-Launcher, beide Zahlen sind
# verschieden (gemessen in tests/backup-drill/start-identitaet.test.ts). Dieser Vergleich konnte
# deshalb nur scheitern und liess Launcher und Server als Waisen zurueck.
#
# DIE ZUORDNUNG IST EINE ABSTAMMUNGSFRAGE. Der Drill startet den Launcher in einer EIGENEN
# PROZESSGRUPPE (Job Control, `set -m`); jeder Nachkomme — npx, tsx, der Serverprozess — erbt sie.
#
#   `eigene_gruppe`      belegt, dass diese Gruppe DIESEM Drill gehoert, aus zwei unabhaengigen
#                        Tatsachen: (1) die Shell fuehrt den Launcher noch als eigenen, nicht
#                        abgeholten Job — solange kann sein PID nicht neu vergeben werden;
#                        (2) zu diesem PID existiert wirklich eine Prozessgruppe. Ohne (2) haette
#                        Job Control keine angelegt, und `-$GESTARTETE_PID` waere die Gruppe
#                        DIESER Shell gewesen. Einmal belegt bleibt es belegt, solange die Gruppe
#                        nicht leer ist: eine Gruppen-Id wird erst danach wieder vergeben.
#   `gehoert_zur_gruppe` haelt die PID AUS DER PID-DATEI gegen genau diese Gruppe. Die Datei wird
#                        also nicht geglaubt, sondern gegen die Abstammung vom eigenen Start
#                        geprueft.
#
# FAIL-CLOSED: Laesst sich eines von beiden nicht feststellen, faellt KEIN Signal und es bleibt bei
# Exit 80. Eine fremde oder wiederverwendete PID wird niemals getroffen — auch dann nicht, wenn sie
# in der PID-Datei steht.
GESTARTETE_PID=""
GRUPPE_BESTAETIGT=""
SERVER_PID=""

eigene_gruppe() {
  [ -n "$GESTARTETE_PID" ] || return 1
  if [ "$GRUPPE_BESTAETIGT" = "1" ]; then
    kill -0 -"$GESTARTETE_PID" 2>/dev/null || return 1
    return 0
  fi
  jobs -pr > "$JOBS_DATEI" 2>/dev/null || return 1
  grep -qE "^[[:space:]]*${GESTARTETE_PID}[[:space:]]*$" "$JOBS_DATEI" || return 1
  kill -0 -"$GESTARTETE_PID" 2>/dev/null || return 1
  GRUPPE_BESTAETIGT=1
  return 0
}

gehoert_zur_gruppe() {
  local pid="$1"
  local pgid
  case "$pid" in "" | *[!0-9]*) return 1 ;; esac
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]')" || return 1
  [ -n "$pgid" ] || return 1
  [ "$pgid" = "$GESTARTETE_PID" ]
}

reap() {
  # ADMIN-13: `abschluss` reicht den Ausgang als Parameter herein — in einer Funktion waere `$?`
  # sonst der Status ihrer eigenen vorigen Anweisung.
  local rc="${1:-$?}"
  if [ -z "$GESTARTETE_PID" ]; then
    rm -f "$PID_FILE" "$JOBS_DATEI" "$ANHANG_DATEI" "$BELEG_DATEI"
    return $rc
  fi
  if ! kill -0 -"$GESTARTETE_PID" 2>/dev/null; then
    echo "[drill] Glied 8 — Reaping: die eigene Prozessgruppe $GESTARTETE_PID lebt nicht mehr;"
    echo "[drill] nur die PID-Datei wird geraeumt."
    rm -f "$PID_FILE" "$JOBS_DATEI" "$ANHANG_DATEI" "$BELEG_DATEI"
    return $rc
  fi
  if ! eigene_gruppe; then
    echo "[drill] REAPING (80): die Prozessgruppe $GESTARTETE_PID ist nicht als die eigene" >&2
    echo "[drill] belegbar — es wird KEIN Signal gesendet." >&2
    rm -f "$JOBS_DATEI" "$ANHANG_DATEI" "$BELEG_DATEI"
    return 80
  fi
  kill -TERM -"$GESTARTETE_PID" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 -"$GESTARTETE_PID" 2>/dev/null || break
    sleep 1
  done
  if kill -0 -"$GESTARTETE_PID" 2>/dev/null; then
    # Zweite Stufe an DIESELBE, nachweislich eigene Gruppe: solange sie nicht leer ist, kann ihre
    # Id nicht neu vergeben worden sein — der Nachweis von oben gilt also weiter.
    echo "[drill] REAPING: SIGTERM hat nicht gereicht — SIGKILL an die eigene Gruppe $GESTARTETE_PID." >&2
    kill -KILL -"$GESTARTETE_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 -"$GESTARTETE_PID" 2>/dev/null || break
      sleep 1
    done
  fi
  if kill -0 -"$GESTARTETE_PID" 2>/dev/null; then
    echo "[drill] REAPING (80): Prozessgruppe $GESTARTETE_PID hat SIGKILL ueberlebt." >&2
    rm -f "$JOBS_DATEI" "$ANHANG_DATEI" "$BELEG_DATEI"
    return 80
  fi
  wait "$GESTARTETE_PID" 2>/dev/null || true
  rm -f "$PID_FILE" "$JOBS_DATEI" "$ANHANG_DATEI" "$BELEG_DATEI"
  echo "[drill] Glied 8 — Reaping: Prozessgruppe $GESTARTETE_PID restlos beendet (Serverprozess ${SERVER_PID:-nicht zugeordnet}), PID-Datei geraeumt."
  return $rc
}
# Kein eigener Trap: `abschluss` (oben, seit ADMIN-13) ruft `reap` beim Verlassen auf und schreibt
# danach das Protokoll mit dem endgueltigen Exitcode.

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
# DER PFLICHTSATZ — jede Tabelle, die `migrate()` anlegt, in der Reihenfolge ihrer Schema-Stufen.
# Gepflegt wird er NICHT von Hand nachgezaehlt, sondern gegen die eine Wahrheit gehalten:
# `tests/backup-drill/tabellensatz.test.ts` liest die `CREATE TABLE`-Anweisungen aus
# `services/app/src/db.ts` (`schemas`) und verlangt genau diese Menge. Keine Zeilenkommentare
# innerhalb der Klammern — der Pruefstand liest die Klammer als reine Namensliste.
# JOB 4309: die drei Tabellen der Gesamtanweisung stehen am Ende dieser Liste. Sie werden seit
# JOB 4309 wirklich migriert; ein Restore, der Kopf, Reihenfolge oder die festgehaltenen
# Pruefstaende verloere, kaeme ohne sie mit Exit 0 durch. KEIN Kommentar INNERHALB der Klammern:
# tests/backup-drill/pflichtsatz.ts liest den Inhalt als Wortliste bis zur ersten Klammer zu.
PFLICHTTABELLEN=(
  users
  sessions
  password_resets
  user_second_factors
  kos
  ko_schreibstand
  ko_versions
  ko_halbwertszeit_beobachtungen
  ko_search_projections
  ko_metadata_projections
  ko_projection_control
  ko_evidence
  ko_kanten
  ko_kanten_beitrag
  audit
  drafts
  gaps
  answer_records
  answer_snapshots
  ratings
  assignments
  conflicts
  conflict_pair_memory
  conflict_pair_obligation_runs
  conflict_pair_obligations
  ko_overlaps
  overlap_settings
  lifecycle_couplings
  lifecycle_pending
  lifecycle_verlauf
  lifecycle_paths
  lifecycle_progress
  objects
  import_candidates
  external_source_records
  import_runs
  import_run_item_refs
  model_runs
  notification_seen
  assist_presets
  reasoner_policy
  klara_sessions
  klara_session_consents
  validation_settings
  external_knowledge_policy
  upload_limits
  lesevarianten
  branding_settings
  gesamtanweisungen
  gesamtanweisung_bausteine
  gesamtanweisung_staende
  ko_bearbeitungen
  office_sitzungen
  office_gesichert
  import_run_source_sync
  dokument_fassungen
  confluence_import_schalter
  begriffe_fassungen
  kenntnisnahme_anforderungen
  kenntnisnahme_empfaenger
  veroeffentlichung_zustellungen
  spaces_fassungen
  livewall_fotos
  interaktions_gedaechtnis
  ko_embeddings
  loeschantraege
  teams_fassungen
  ui_uebersetzungen
  ui_sprachen
  unternehmensprofil_fassungen
  richtlinien_fassungen
  richtlinien_handlungen
  klara_gespraeche
  ko_mitgelesen
  instanz_bindung
)
FEHLENDE_TABELLEN=()
for tabelle in "${PFLICHTTABELLEN[@]}"; do
  VORHANDEN="$(psql -d "$RESTORE_DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${tabelle}';")"
  if [ "$VORHANDEN" != "1" ]; then
    FEHLENDE_TABELLEN+=("$tabelle")
  fi
done
if [ "${#FEHLENDE_TABELLEN[@]}" -ne 0 ]; then
  echo "[drill] ABBRUCH (22): Tabellen fehlen nach dem Restore: ${FEHLENDE_TABELLEN[*]}" >&2
  exit 22
fi

# DAS INHALTSVERZEICHNIS DES DUMPS — EINMAL, FUER DIE EINE UNTERSCHEIDUNG, DIE HIER ZAEHLT.
#
# Kein COPY-Block heisst NICHT „leere Tabelle". Es heisst entweder „der Dump fuehrt diese Tabelle
# mit null Zeilen" (dann steht sie im Inhaltsverzeichnis) oder „der Dump fuehrt fuer sie ueberhaupt
# keinen Bestand" (dann steht sie NICHT darin — z. B. nach `pg_dump --exclude-table-data`, aus einer
# aelteren Fassung des Produkts oder nach einem Teilverlust). Der zweite Fall ist ein FEHLENDER
# BESTAND (Exit 22) und darf nie als gemessene 0 durchgehen: die Tabelle steht dann leer in der
# Zieldatenbank, die Zeilenzahlen waeren 0 = 0, und der Drill waere gruen.
if ! DUMP_INHALT="$(pg_restore --list "$DUMP")"; then
  echo "[drill] ABBRUCH (24): Inhaltsverzeichnis des Dumps nicht lesbar (pg_restore --list)." >&2
  exit 24
fi

# `pg_restore --list` schreibt je Datenblock eine Zeile der Form
#   3195; 0 16456 TABLE DATA public kos eigentuemer
# Gefragt ist genau der Datenblock, nicht die Strukturzeile (`TABLE public kos`): eine Tabelle, die
# nur als Struktur im Archiv steht, bringt keinen Bestand zurueck.
fuehrt_bestand() {
  printf '%s\n' "$DUMP_INHALT" | grep -qE "TABLE DATA public \"?${1}\"?( |\$)"
}

# Custom-Archive liefern SQL mit COPY-Bloecken. Nur deren Datenzeilen zaehlen:
# Zeilenumbrueche in Werten sind escaped; der alleinstehende COPY-Abschluss ist keine Datenzeile.
# Doppelter / unvollstaendiger Block ist UNBEKANNT (Exit 24), niemals eine leere Tabelle; der
# fehlende Block entscheidet sich am Inhaltsverzeichnis (s. o.).
FEHLENDER_BESTAND=()
ABWEICHUNGEN=()
for tabelle in "${PFLICHTTABELLEN[@]}"; do
  if ! DUMP_ZEILEN="$(pg_restore --data-only --schema=public --table="$tabelle" -f - "$DUMP" |
    awk -v tabelle="$tabelle" '
      daten {
        if ($0 == "\\.") { daten = 0; next }
        zeilen++; next
      }
      /^COPY / {
        if ($0 !~ ("^COPY \"?public\"?\\.\"?" tabelle "\"? \\(.*\\) FROM stdin;$")) fehler = 1
        bloecke++; daten = 1
      }
      END {
        if (fehler || daten || bloecke > 1) exit 1
        if (bloecke == 0) { print "KEIN_BLOCK"; exit 0 }
        printf "%.0f\n", zeilen
      }
    ')"; then
    echo "[drill] ABBRUCH (24): $tabelle: Dump-Zeilen nicht messbar (Extraktion/COPY-Format)." >&2
    exit 24
  fi
  if [ "$DUMP_ZEILEN" = "KEIN_BLOCK" ]; then
    if ! fuehrt_bestand "$tabelle"; then
      FEHLENDER_BESTAND+=("$tabelle")
      continue
    fi
    DUMP_ZEILEN=0
  fi
  if ! DB_ZEILEN="$(psql -X -v ON_ERROR_STOP=1 -d "$RESTORE_DB" -tAc \
    "SELECT count(*) FROM public.\"${tabelle}\";")" || [[ ! "$DB_ZEILEN" =~ ^[0-9]+$ ]]; then
    echo "[drill] ABBRUCH (24): $tabelle: Datenbank-Zeilen nicht messbar (SQL-Zaehler)." >&2
    exit 24
  fi
  echo "[drill] $tabelle: Dump=$DUMP_ZEILEN Datenbank=$DB_ZEILEN"
  # ADMIN-13: dieselben zwei Zahlen fuer das Protokoll (`vergleich_json`).
  printf -v "VG_${tabelle}" '%s %s' "$DUMP_ZEILEN" "$DB_ZEILEN"
  if [ "$DUMP_ZEILEN" != "$DB_ZEILEN" ]; then
    ABWEICHUNGEN+=("$tabelle: Dump=$DUMP_ZEILEN Datenbank=$DB_ZEILEN")
  fi
done
if [ "${#FEHLENDER_BESTAND[@]}" -ne 0 ]; then
  echo "[drill] ABBRUCH (22): der Dump fuehrt keinen Bestand fuer: ${FEHLENDER_BESTAND[*]}" >&2
  exit 22
fi
if [ "${#ABWEICHUNGEN[@]}" -ne 0 ]; then
  echo "[drill] ABBRUCH (23): Zeilenabweichung: ${ABWEICHUNGEN[*]}" >&2
  exit 23
fi
echo "[drill] Glied 3 — Restore eingespielt, alle ${#PFLICHTTABELLEN[@]} Pflichttabellen vorhanden und Zeilenzahlen wie im Dump."

# ------------------------------------------------------------------------------------------------
# GLIED 3b — RECHTE: DIE ROLLENVERTEILUNG DER KONTEN, DUMP GEGEN DATENBANK (ADMIN-13)
# ------------------------------------------------------------------------------------------------
#
# Eine gleiche Zeilenzahl in `users` sagt nichts darueber, ob die Konten mit ihren RECHTEN
# zurueckkamen: zwei Konten koennen als zwei Konten wiederkommen und dabei ihre Rolle oder ihre
# Freigabe verloren haben. Verglichen wird deshalb je Paar (Rolle, Freigabe) die Zahl der Konten —
# im Dump aus dem COPY-Block, in der Datenbank per SQL. Namen, Adressen und Kennworthashes werden
# dabei weder gelesen noch ausgegeben; im Protokoll steht nur `rolle/freigabe=anzahl`.
#
# Fuehrt der Dump fuer `users` keine Spalten `role`/`approved`, ist die Verteilung nicht messbar;
# das steht dann so im Protokoll, und die Kategorie Rechte ist dort nie `gleich`.
normalisiere_rollen() {
  sed '/^$/d' | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//'
}
if ! ROLLEN_DUMP_ROH="$(pg_restore --data-only --schema=public --table=users -f - "$DUMP" |
  awk -F'\t' '
    daten {
      if ($0 == "\\.") { daten = 0; next }
      if (r > 0 && a > 0) z[$r "/" $a]++
      next
    }
    /^COPY / {
      kopf = $0
      sub(/^[^(]*\(/, "", kopf)
      sub(/\) FROM stdin;$/, "", kopf)
      n = split(kopf, spalten, ", ")
      for (i = 1; i <= n; i++) {
        s = spalten[i]
        gsub(/"/, "", s)
        if (s == "role") r = i
        if (s == "approved") a = i
      }
      bloecke++; daten = 1
    }
    END {
      if (daten || bloecke > 1) { print "UNMESSBAR"; exit 0 }
      if (bloecke == 1 && (r == 0 || a == 0)) { print "OHNE_ROLLENSPALTE"; exit 0 }
      for (k in z) print k "=" z[k]
    }
  ')"; then
  echo "[drill] ABBRUCH (24): users: Rollenverteilung im Dump nicht messbar (Extraktion)." >&2
  exit 24
fi
case "$ROLLEN_DUMP_ROH" in
  UNMESSBAR)
    echo "[drill] ABBRUCH (24): users: Rollenverteilung im Dump nicht messbar (COPY-Format)." >&2
    exit 24
    ;;
  OHNE_ROLLENSPALTE)
    ROLLEN_ZUSTAND="ohne_spalte"
    echo "[drill] Glied 3b — Rechte: der Dump fuehrt fuer users keine Spalten role/approved; die Rollenverteilung ist nicht messbar."
    ;;
  *)
    ROLLEN_DUMP="$(printf '%s\n' "$ROLLEN_DUMP_ROH" | normalisiere_rollen)"
    if ! ROLLEN_DB_ROH="$(psql -X -v ON_ERROR_STOP=1 -d "$RESTORE_DB" -tA -c \
      "SELECT role || '/' || CASE WHEN approved THEN 't' ELSE 'f' END || '=' || count(*) FROM public.users GROUP BY role, approved;")"; then
      echo "[drill] ABBRUCH (24): users: Rollenverteilung der Datenbank nicht messbar (SQL-Abfrage)." >&2
      exit 24
    fi
    ROLLEN_DB="$(printf '%s\n' "$ROLLEN_DB_ROH" | normalisiere_rollen)"
    if [ "$ROLLEN_DUMP" != "$ROLLEN_DB" ]; then
      ROLLEN_ZUSTAND="abweichend"
      echo "[drill] ABBRUCH (74): Rollenverteilung der Konten weicht ab: Dump=[${ROLLEN_DUMP}] Datenbank=[${ROLLEN_DB}]" >&2
      exit 74
    fi
    ROLLEN_ZUSTAND="gleich"
    echo "[drill] Glied 3b — Rechte: Rollenverteilung der Konten wie im Dump (${ROLLEN_DUMP:-keine Konten})."
    ;;
esac

# ------------------------------------------------------------------------------------------------
# GLIED 4 — ANWENDUNG STARTEN, MIT PID-DATEI
# ------------------------------------------------------------------------------------------------
# Keine implizite Installation durch npx: tsx muss lokal vorhanden und ausfuehrbar sein.
if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1 ||
   [ ! -x "$WURZEL/node_modules/.bin/tsx" ] ||
   ! (cd "$WURZEL" && npm_config_offline=true npx --no-install tsx --version >/dev/null 2>&1); then
  echo "[drill] ABBRUCH (31): Startwerkzeug node/npx/lokales tsx fehlt oder ist nicht ausfuehrbar." >&2
  exit 31
fi
rm -f "$PID_FILE" "$JOBS_DATEI" "$ANHANG_DATEI" "$BELEG_DATEI"
# EIGENE PROZESSGRUPPE. `set -m` schaltet Job Control ein: bash legt fuer diesen Hintergrundjob eine
# neue Prozessgruppe an, deren Id genau `$!` ist. `exec` entfernt zusaetzlich die Subshell, sodass
# der Launcher selbst der Gruppenfuehrer ist. npx, tsx und der Serverprozess erben diese Gruppe —
# genau daran erkennt der Drill unten seine eigene Nachkommenschaft, ohne eine PID zu glauben.
# `set +m` direkt danach haelt Jobmeldungen aus dem Drillprotokoll heraus; Gruppe und Jobeintrag
# bleiben davon unberuehrt.
set -m
(
  cd "$WURZEL"
  exec env \
    DATABASE_URL="postgres:///${RESTORE_DB}" \
    KLARWERK_PID_FILE="$PID_FILE" \
    PORT="$DRILL_PORT" \
    npm_config_offline=true \
    npx tsx services/app/src/server.ts
) &
GESTARTETE_PID=$!
set +m

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

# DIE ZUORDNUNG. Sie ist der Grund, warum dieser Block existiert: Die PID-Datei wird NICHT
# geglaubt, sondern gegen die Abstammung vom eigenen Start gehalten (Begruendung oben bei `reap`).
# Nennt sie einen Prozess ausserhalb der eigenen Prozessgruppe, ist der Drill in einer Lage, die er
# nicht aufloesen kann — an diesen Prozess geht dann niemals ein Signal.
DATEI_PID="$(tr -d '[:space:]' < "$PID_FILE")"
if ! eigene_gruppe; then
  echo "[drill] ABBRUCH (80): die eigene Prozessgruppe $GESTARTETE_PID ist nicht feststellbar —" >&2
  echo "[drill] die Abstammung des Serverprozesses bleibt unbelegt. Es wird KEIN Signal gesendet." >&2
  exit 80
fi
if ! gehoert_zur_gruppe "$DATEI_PID"; then
  echo "[drill] ABBRUCH (80): PID-Datei nennt $DATEI_PID; dieser Prozess gehoert NICHT zur" >&2
  echo "[drill] Prozessgruppe $GESTARTETE_PID dieses Drills — fremder oder wiederverwendeter" >&2
  echo "[drill] Prozess. Es wird KEIN Signal an ihn gesendet." >&2
  exit 80
fi
SERVER_PID="$DATEI_PID"
echo "[drill] Glied 4 — Anwendung laeuft, Serverprozess $SERVER_PID in der eigenen Prozessgruppe $GESTARTETE_PID, Port $DRILL_PORT"

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

# ------------------------------------------------------------------------------------------------
# GLIED 7b — EIN WIEDERHERGESTELLTES WISSENSOBJEKT, DURCH DIE LAUFENDE ANWENDUNG GELESEN
# ------------------------------------------------------------------------------------------------
#
# WARUM DIESES GLIED EXISTIERT (JOB 4097): Eine gleiche Zeilenzahl ist kein Inhaltsbeleg. Eine
# Tabelle kann vorhanden, gleich lang und trotzdem unbrauchbar sein — und der Meilenstein B3 fragt
# woertlich nach „Anmeldung, Quellen, Anhaenge und Auditdaten". Anmeldung und Auditdaten belegen
# Glied 6 und 7. Quellen und Anhaenge belegt dieses Glied, und zwar auf dem Weg, den auch der
# Betreiber ginge: Objekt aufschlagen, Beleg sehen, Anhang oeffnen.
#
# DIE TRENNUNG BLEIBT WOERTLICH DIESELBE WIE BEI 60/61 GEGEN 70/71/72: Ein AUFBAUFEHLER (der
# Bestand liess sich nicht befragen, die Route antwortet nicht, das Recht fehlt) bekommt 62 und
# darf nie wie ein BEFUND am Bestand aussehen; der Befund selbst bekommt 73.
#
# EHRLICHKEIT VOR OPTIK: Fuehrt der Bestand ueberhaupt kein Wissensobjekt mit Beleg, ist das kein
# Fehlschlag — aber auch kein Erfolg. Der Drill sagt dann ausdruecklich, dass dieser Punkt NICHT
# gemessen wurde, und der Abschlussbericht traegt den Satz mit.
#
# DAS RECHT IST SCHON GESICHERT: Die Fixture MUSS `ko.validate` tragen (Glied 6/7), und wer
# `ko.validate` hat, hat `ko.read` (services/rbac/src/policy.ts:15-17) und sieht jede Stufe
# (services/app/src/sichtbarkeit.ts:71-72). Ein 404 an dieser Stelle ist deshalb kein Rechtefall,
# sondern ein Befund: die Datenbank fuehrt das Objekt, die Anwendung findet es nicht.
#
# ------------------------------------------------------------------------------------------------
# 7b-1 — DER BESTANDSSCAN: JEDE BELEGZEILE, DIE AUF EINEN ANHANG ZEIGT, MUSS IHN AUCH FINDEN.
# ------------------------------------------------------------------------------------------------
#
# RUNDE 1 HATTE HIER EINEN `JOIN objects` IN DER KANDIDATENSUCHE — und damit den Fehler, der die
# Luecke dieses Auftrags an anderer Stelle wiederholte: Eine Belegzeile, deren Anhang nach dem
# Restore FEHLT, fiel aus der Auswahl heraus. Gab es nur sie, meldete der Zweig darunter „kein
# Wissensobjekt mit Beleg im Bestand — NICHT gemessen", obwohl die Datenbank sehr wohl einen Beleg
# fuehrte. Der schlimmste Fall sah aus wie der harmloseste.
#
# Deshalb wird jetzt ZUERST der ganze Bestand gescannt, ohne jede Filterung: jede Belegzeile eines
# lebenden Wissensobjekts, die eine `objectId` traegt, zu der `objects` keine Zeile hat. Das ist ein
# BEFUND (73) und keine Auslassung — die Zeilenzaehlung sieht ihn nicht: `ko_evidence` und `objects`
# koennen beide so lang sein wie im Dump und die Verbindung dazwischen trotzdem verloren.
#
# ABGRENZUNG, EHRLICH: Heute entfernt kein Weg im Produkt ein Objekt von sich aus
# (`services/object-store/src/service.ts`: „diese Methode ruft von sich aus niemand auf"), und mit
# einem endgueltig geloeschten Wissensobjekt verschwinden seine Belegzeilen mit. Eine solche Zeile
# ist deshalb ein Verlust und kein Normalzustand. Truege die QUELLE des Dumps diese Luecke schon,
# endete der Drill ebenfalls mit 73 — er vergleicht den wiederhergestellten Bestand, nicht die
# Gesundheit der Quelle; beide Anleitungen sagen das.
if ! WAISEN="$(psql -X -v ON_ERROR_STOP=1 -d "$RESTORE_DB" -tA -F' ' -c \
  "SELECT count(*), coalesce(min(e.ko_id || ' ' || (e.data->>'objectId')), '-')
     FROM ko_evidence e
     JOIN kos k ON k.id = e.ko_id
    WHERE e.data->>'objectId' IS NOT NULL
      AND k.data->>'deletedAt' IS NULL
      AND NOT EXISTS (SELECT 1 FROM objects o WHERE o.id = e.data->>'objectId');")"; then
  echo "[drill] ABBRUCH (62): der wiederhergestellte Bestand liess sich nicht nach verwaisten" >&2
  echo "[drill] Belegzeilen befragen (SQL) — Aufbaufehler, KEIN Befund am Bestand." >&2
  exit 62
fi
WAISEN_ZAHL="${WAISEN%% *}"
WAISEN_BEISPIEL="${WAISEN#* }"
if ! [[ "$WAISEN_ZAHL" =~ ^[0-9]+$ ]]; then
  echo "[drill] ABBRUCH (62): die Zahl verwaister Belegzeilen ist nicht lesbar ('$WAISEN') —" >&2
  echo "[drill] Aufbaufehler, KEIN Befund am Bestand." >&2
  exit 62
fi
ANHANG_WAISEN="$WAISEN_ZAHL"
if [ "$WAISEN_ZAHL" -ne 0 ]; then
  echo "[drill] ABBRUCH (73): ${WAISEN_ZAHL} Belegzeile(n) nennen eine Anhangskennung, zu der die" >&2
  echo "[drill] Tabelle objects nach dem Restore keine Zeile fuehrt (Wissensobjekt/Anhang:" >&2
  echo "[drill] ${WAISEN_BEISPIEL}) — der Beleg zeigt ins Leere." >&2
  exit 73
fi
echo "[drill] Glied 7b — Bestandsscan: keine Belegzeile ohne ihren Anhang in objects."

# ------------------------------------------------------------------------------------------------
# 7b-2 — EIN OBJEKT WIRKLICH LESEN. Die Auswahl filtert NICHTS: haette die erste Belegzeile ihren
# Anhang verloren, waere der Lauf schon oben bei 73 geendet.
# ------------------------------------------------------------------------------------------------
if ! KANDIDAT="$(psql -X -v ON_ERROR_STOP=1 -d "$RESTORE_DB" -tA -F' ' -c \
  "SELECT e.id, e.ko_id, e.data->>'objectId'
     FROM ko_evidence e
     JOIN kos k ON k.id = e.ko_id
    WHERE e.data->>'objectId' IS NOT NULL
      AND k.data->>'deletedAt' IS NULL
    ORDER BY e.created_at, e.id
    LIMIT 1;")"; then
  echo "[drill] ABBRUCH (62): der wiederhergestellte Bestand liess sich nicht nach einem Beleg" >&2
  echo "[drill] befragen (SQL) — Aufbaufehler, KEIN Befund am Bestand." >&2
  exit 62
fi

if [ -z "$KANDIDAT" ]; then
  WISSENSNACHWEIS="kein Wissensobjekt mit Beleg im Bestand — dieser Punkt wurde NICHT gemessen."
  echo "[drill] Glied 7b — $WISSENSNACHWEIS"
else
  IFS=' ' read -r EVIDENZ_ID KO_ID OBJEKT_ID <<<"$KANDIDAT"
  if [ -z "${EVIDENZ_ID:-}" ] || [ -z "${KO_ID:-}" ] || [ -z "${OBJEKT_ID:-}" ]; then
    echo "[drill] ABBRUCH (62): die Belegzeile der Datenbank ist nicht lesbar ('$KANDIDAT') —" >&2
    echo "[drill] Aufbaufehler, KEIN Befund am Bestand." >&2
    exit 62
  fi

  BELEGE="$(curl -s -w '\n%{http_code}' -H "cookie: kw_session=${TOKEN}" \
    "http://127.0.0.1:${DRILL_PORT}/api/kos/${KO_ID}/evidence" || echo $'\n000')"
  BELEG_CODE="$(printf '%s' "$BELEGE" | tail -n1)"
  BELEG_BODY="$(printf '%s' "$BELEGE" | sed '$d')"
  if [ "$BELEG_CODE" = "404" ]; then
    echo "[drill] ABBRUCH (73): die Datenbank fuehrt das Wissensobjekt ${KO_ID}, die Anwendung" >&2
    echo "[drill] findet es nicht — Befund am wiederhergestellten Bestand." >&2
    exit 73
  fi
  if [ "$BELEG_CODE" != "200" ]; then
    echo "[drill] ABBRUCH (62): /api/kos/<id>/evidence antwortet mit ${BELEG_CODE} —" >&2
    echo "[drill] Aufbaufehler, KEIN Befund am Bestand." >&2
    exit 62
  fi
  # ----------------------------------------------------------------------------------------------
  # DIE ANTWORT WIRD GELESEN, NICHT DURCHSUCHT.
  # ----------------------------------------------------------------------------------------------
  #
  # RUNDE 1 STAND HIER `grep -qF "$OBJEKT_ID"` — ein Textvorkommen irgendwo in der Antwort. Das ist
  # kein Beleg fuer eine Zuordnung, und zwei Gegenproben haben es widerlegt: die Kennung als TEIL
  # einer anderen `objectId` und die Kennung im `label` eines Belegs ohne jede `objectId` liessen den
  # Drill mit „BESTANDEN" enden, obwohl die Anhangszuordnung fehlte.
  #
  # Gemessen wird deshalb der DATENSATZ, den die Datenbank genannt hat: In der Antwort muss der
  # Beleg mit GENAU dieser Kennung (`id`) stehen, und SEIN Feld `objectId` muss GENAU die Kennung
  # aus der Datenbank sein. `ko_evidence.id` und das `id` im gespeicherten Datensatz sind dieselbe
  # Zahl (services/knowledge-object/src/repo-pg.ts, `append`: Spalte `id` = `record.id`), und
  # `listByKo` gibt den Datensatz unveraendert aus — der Vergleich ist damit exakt.
  #
  # WARUM `node` UND KEIN ZWEITES grep: JSON ist nicht mit Textsuche zu lesen; jede Regel ueber
  # Anfuehrungszeichen faellt am naechsten Feld um. `node` ist an dieser Stelle sicher vorhanden —
  # Glied 4 bricht ohne lauffaehiges `node`/`npx`/`tsx` mit Exit 31 ab, lange bevor dieser Punkt
  # erreicht ist.
  printf '%s' "$BELEG_BODY" > "$BELEG_DATEI"
  BELEG_BEFUND="$(node -e '
const fs = require("node:fs");
const [datei, evidenzId, objektId] = process.argv.slice(1);
let liste;
try {
  liste = JSON.parse(fs.readFileSync(datei, "utf8"));
} catch {
  console.log("UNLESBAR");
  process.exit(0);
}
if (!Array.isArray(liste)) {
  console.log("UNLESBAR");
  process.exit(0);
}
const satz = liste.find((e) => e && typeof e === "object" && e.id === evidenzId);
if (!satz) {
  console.log("KEIN_DATENSATZ");
  process.exit(0);
}
console.log(satz.objectId === objektId ? "TREFFER" : "FALSCHE_ZUORDNUNG");
' "$BELEG_DATEI" "$EVIDENZ_ID" "$OBJEKT_ID" || echo "UNLESBAR")"
  case "$BELEG_BEFUND" in
    TREFFER) ;;
    KEIN_DATENSATZ)
      echo "[drill] ABBRUCH (73): die Belegliste von ${KO_ID} fuehrt den Beleg ${EVIDENZ_ID} nicht," >&2
      echo "[drill] den die Datenbank fuehrt — die Anhangszuordnung ist nach dem Restore verloren." >&2
      exit 73
      ;;
    FALSCHE_ZUORDNUNG)
      echo "[drill] ABBRUCH (73): der Beleg ${EVIDENZ_ID} zeigt in der Antwort NICHT auf" >&2
      echo "[drill] ${OBJEKT_ID} — die Anhangszuordnung ist nach dem Restore verloren." >&2
      exit 73
      ;;
    *)
      echo "[drill] ABBRUCH (62): die Belegliste von ${KO_ID} ist keine lesbare JSON-Liste —" >&2
      echo "[drill] Aufbaufehler, KEIN Befund am Bestand." >&2
      exit 62
      ;;
  esac

  rm -f "$ANHANG_DATEI"
  ANHANG="$(curl -s -o "$ANHANG_DATEI" -w '%{http_code} %{size_download}' \
    -H "cookie: kw_session=${TOKEN}" \
    "http://127.0.0.1:${DRILL_PORT}/api/objects/${OBJEKT_ID}/raw" || echo "000 0")"
  ANHANG_CODE="${ANHANG%% *}"
  ANHANG_BYTES="${ANHANG##* }"
  if [ "$ANHANG_CODE" = "404" ] || [ "$ANHANG_CODE" = "415" ]; then
    echo "[drill] ABBRUCH (73): der Anhangsinhalt zu ${OBJEKT_ID} kam mit ${ANHANG_CODE} nicht" >&2
    echo "[drill] zurueck — der Beleg zeigt ins Leere." >&2
    exit 73
  fi
  if [ "$ANHANG_CODE" != "200" ]; then
    echo "[drill] ABBRUCH (62): /api/objects/<id>/raw antwortet mit ${ANHANG_CODE} —" >&2
    echo "[drill] Aufbaufehler, KEIN Befund am Bestand." >&2
    exit 62
  fi
  if ! [[ "$ANHANG_BYTES" =~ ^[0-9]+$ ]] || [ "$ANHANG_BYTES" -eq 0 ]; then
    echo "[drill] ABBRUCH (73): der Anhangsinhalt zu ${OBJEKT_ID} kam mit 200, aber ohne Bytes" >&2
    echo "[drill] zurueck — eine leere Auslieferung ist kein wiederhergestellter Anhang." >&2
    exit 73
  fi
  WISSENSNACHWEIS="Wissensobjekt ${KO_ID} mit Beleg auf ${OBJEKT_ID} (Belegzeile ${EVIDENZ_ID}) und ${ANHANG_BYTES} Bytes Anhangsinhalt zurueckgelesen."
  echo "[drill] Glied 7b — $WISSENSNACHWEIS"
fi

echo "[drill] DRILL BESTANDEN — der Dump ist wiederherstellbar und die Kette traegt."
echo "[drill] Wissensnachweis: $WISSENSNACHWEIS"
exit 0
