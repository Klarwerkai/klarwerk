#!/usr/bin/env bash
# ================================================================================================
# B3 — KUNDENBETRIEB AUF EINER COMPOSE-INSTANZ: SICHERN, IN EINE LEERE DATENBANK ZURUECKHOLEN,
# AKTUALISIEREN, ZURUECKFALLEN — jedes davon gemessen, nicht vermutet.
# ================================================================================================
#
# Dieses Skript baut NICHTS neu, was es schon gibt. Es faehrt die vorhandenen Bausteine gegen eine
# laufende Compose-Instanz (docker-compose.prod.yml, unveraendert):
#
#   · scripts/backup/backup.sh       — UNVERAENDERT, ueber die Compose-Adapter in
#                                      scripts/backup/compose/ (pg_dump im Datenbankcontainer,
#                                      `docker compose exec`, KEIN Kennwort in Argument oder Log)
#   · scripts/backup/restore-drill.sh — UNVERAENDERT, im Pruefwerkzeug-Container (Abbild der
#                                      Instanz + postgresql-client-16), gegen eine FRISCHE Datenbank
#                                      derselben PostgreSQL
#   · tests/backup-drill W1–W4 und die Waechter (URL, sterbender Launcher, SIGKILL) u. a.
#                                     — im selben Pruefwerkzeug gegen dieselbe PostgreSQL, ohne Skip
#
# und ergaenzt, was fehlte: den Aktualisierungsweg (neue Ausgabe bauen, ausrollen, Gesundheit und
# Version messen) und den Rueckweg (bei rotem Start das vorherige Abbild erneut ausrollen).
#
# AUFRUF (auf dem Wirt der Instanz; Docker + Compose v2, bash, sha256sum oder shasum):
#
#   PROJEKT=<compose-projekt> STACK=<ordner der instanz> [COMPOSE_DATEIEN="a.yml b.yml"] \
#     bash scripts/backup/compose-drill.sh <schritt> [argument]
#
#   werkzeug            Pruefwerkzeug-Abbild aus dem LAUFENDEN App-Abbild bauen (wird wiederverwendet)
#   bestand             Kundenbestand ueber die echte Anwendung anlegen (Konto, Wissensobjekt, Anhang)
#   vergleichen [url]   Bestand gegen die Instanz (Vorgabe http://app:3001) Feld/Byte fuer Byte pruefen
#   sichern             K1: backup.sh ${SICHERUNGSLAEUFE:-3}x mit BACKUP_KEEP=${BACKUP_KEEP:-2}
#   wiederherstellen [dump]  K2: restore-drill.sh in eine frische Datenbank + Produktabbild dagegen
#   aktualisieren [quelle]   K3: neue Ausgabe bauen und ausrollen; bei rotem Start Rueckweg (K4)
#   neustart            echter Neustart von PostgreSQL und Anwendung, Postmaster-Startzeit vorher/nachher
#   pruefen             tests/backup-drill, tests/backup-parallel, Beziehungs-Restore gegen diese PG
#   gegenprobe          K5: manipulierter Dump / veraenderte Pruefsumme / ausgelassener Neustart -> rot
#   rueckweg            K4: absichtlich kaputte Aktualisierung (Abbild, Pflichtvariable) -> Rueckweg
#   sicherung           EINE Sicherung mit Herkunftsnachweis nach $SICHERUNGSZIEL (taeglicher Weg)
#   auslagern           R-0839: juengste Sicherung verschluesselt an $ZWEITER_ORT, gestaffelt
#                       (Tage/Wochen/Monate), Zweitkopie entschluesselt und nachgeprueft
#   taeglich            sicherung + auslagern — die Zeile fuer den Zeitplan (cron)
#   zurueckspielen [dump]  ERNSTFALL: Sicherung in $DB_NAME zurueckspielen; nur mit
#                       ZURUECKSPIELEN_BESTAETIGT=$DB_NAME; alter Bestand wird umbenannt, nie geloescht,
#                       und bei jedem Fehlschlag wieder eingesetzt
#   ablauf [quelle]     alles in Reihenfolge; Zusammenfassung belege/b3-<lauf>-ablauf.json
#
# INSTANZBINDUNG (R-0811): Jede Instanz traegt eine Kennung (`$ARBEIT/instanz.id`, einmal erzeugt;
# gehoert zur Instanzkonfiguration wie die .env). Jede Sicherung dieses Werkzeugs bekommt einen
# Herkunftsnachweis `<dump>.herkunft.json` (Instanzkennung, Projekt, Datenbank, PG-Systemkennung,
# /health-Stand, SHA-256 des Dumps). `wiederherstellen` und `zurueckspielen` verweigern eine
# Sicherung ohne passenden Nachweis (Exit 161) — ausser FREMDE_SICHERUNG_BESTAETIGT nennt genau
# die Instanzkennung der Sicherung (bewusster Umzug).
#
# BELEGE: jeder Schritt schreibt `$BELEGE/b3-<lauf>-<schritt>.log` und `.json` (flach, damit
# `PRUEFPLATZ-B.sh … holen` sie mitnimmt). Jeder Beleg traegt den Pruefstand-Commit (Stand dieses
# Werkzeugbaums) und den Stand der Instanz. Sicherungen und das Kennwort des Drill-Kontos liegen
# NICHT in den Belegen, sondern unter `$ARBEIT` (Vorgabe: <eltern von STACK>/b3-arbeit-<projekt>).
#
# WAS DIESES SKRIPT NICHT TUT: Ausser `zurueckspielen` (ausdruecklich bestaetigt) fasst es
# `klarwerk_prod` nur lesend an und legt eigene Datenbanken mit den Praefixen klarwerk_drill_ /
# klarwerk_gegenprobe_ / klarwerk_b3_test an. Es ist fuer Pruefplaetze und fuer Betreiber gedacht,
# die ihre eigene Instanz betreiben und ueben — nie gegen Produktivdaten eines anderen.
#
# EXITCODES (eigener Bereich ab 100, damit sie nie mit restore-drill.sh verwechselt werden):
#     0  Schritt bestanden
#     1  Aufruf/Umgebung (fehlendes Werkzeug, fehlende .env, unbekannter Schritt)
#     2  Aufbaufehler (Werkzeugabbild nicht baubar, Instanz nicht erreichbar) — KEIN Befund
#   10…80  wiederherstellen/gegenprobe: der Exitcode von restore-drill.sh, unveraendert
#   100  K1: backup.sh ist gescheitert
#   101  K1: Aufbewahrung nicht eingehalten
#   102  K1: Pruefsumme passt nicht, oder das Datenbank-Kennwort steht im Protokoll
#   110  Vergleich: BEFUND — der Bestand ist nicht unveraendert lesbar
#   111  Inhaltsmessung gescheitert — ohne Messung vorher/nachher ist nichts bewiesen
#   120  Aktualisierung: Bau der neuen Ausgabe gescheitert — vorheriger Stand laeuft unveraendert
#   121  Aktualisierung: Konfiguration unvollstaendig — vorheriger Stand laeuft unveraendert
#   122  Aktualisierung: neue Ausgabe nicht gesund — RUECKWEG ausgefuehrt, vorheriger Stand gesund
#   123  Aktualisierung: RUECKWEG GESCHEITERT — Handeln noetig (Grund im Protokoll)
#   124  Aktualisierung: /health meldet nicht die neue Ausgabe — Rueckweg ausgefuehrt
#   125  Aktualisierung: keine neuere Ausgabe (Stand vorher = Stand nachher) — nichts belegt
#   130  Neustart: kein echter Datenbank-Neustart belegt (Postmaster-Startzeit unveraendert)
#   131  Neustart: Datenbank oder Anwendung nach dem Neustart nicht wieder bereit
#   140  Pruefen: Tests rot
#   141  Pruefen: Tests uebersprungen — ein Skip ist hier kein Gruen
#   150  Gegenprobe/Rueckweg: das erwartete Rot (bzw. der erwartete Rueckweg) blieb aus
#   160  Zurueckspielen: Pruefsumme fehlt oder passt nicht — nichts angefasst
#   161  Instanzbindung: Sicherung ohne Herkunftsnachweis oder aus einer anderen Instanz
#   162  Zurueckspielen: ein Schritt ist gescheitert — der vorherige Bestand ist wieder eingesetzt
#   163  Zurueckspielen: gescheitert UND der vorherige Bestand liess sich nicht wieder einsetzen
#   164  Zurueckspielen: gelungen, aber Ausfallzeit/Stand-Alter ueber RTO_ZIEL_SEKUNDEN/RPO_ZIEL_SEKUNDEN
#   170  Auslagern: Verschluesselung, Ablage oder Nachpruefung der Zweitkopie gescheitert
set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
SCHRITT="${1:-}"
ARGUMENT="${2:-}"

PROJEKT="${PROJEKT:-}"
STACK="${STACK:-$WURZEL}"
COMPOSE_DATEIEN="${COMPOSE_DATEIEN:-docker-compose.prod.yml}"
# Je Instanz ein eigener Arbeitsordner: zwei Instanzen im selben Elternordner teilen sich weder
# Sicherungen noch Instanzkennung.
ARBEIT="${ARBEIT:-$(dirname "$STACK")/b3-arbeit-${PROJEKT:-ohne-projekt}}"
BELEGE="${BELEGE:-$STACK/belege}"
LAUF="${B3_LAUF:-$(date -u +%Y%m%dT%H%M%SZ)}"
LAUF_KLEIN="$(printf '%s' "$LAUF" | tr 'A-Z' 'a-z')"
DB_KONTO="${DB_KONTO:-klarwerk}"
DB_NAME="${DB_NAME:-klarwerk_prod}"
WARTEN_GESUND="${WARTEN_GESUND:-240}"
DRILL_LOGIN_EMAIL="${DRILL_LOGIN_EMAIL:-b3-drill@pruefplatz.test}"
export DRILL_LOGIN_EMAIL

if [ -z "$PROJEKT" ]; then
  echo "[b3] ABBRUCH: PROJEKT ist nicht gesetzt (Compose-Projektname der Instanz)." >&2
  exit 1
fi
for werkzeug in docker date od; do
  if ! command -v "$werkzeug" >/dev/null 2>&1; then
    echo "[b3] ABBRUCH: $werkzeug nicht gefunden." >&2
    exit 1
  fi
done
if command -v sha256sum >/dev/null 2>&1; then
  pruefsumme() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  pruefsumme() { shasum -a 256 "$1" | awk '{print $1}'; }
else
  echo "[b3] ABBRUCH: weder sha256sum noch shasum gefunden." >&2
  exit 1
fi
if [ ! -f "$STACK/.env" ]; then
  echo "[b3] ABBRUCH: $STACK/.env fehlt — die Instanz ist nicht eingerichtet." >&2
  exit 1
fi
mkdir -p "$ARBEIT/sicherungen" "$ARBEIT/geheim" "$ARBEIT/austausch" "$BELEGE"
chmod 700 "$ARBEIT/geheim"
# Das Pruefwerkzeug laeuft als Nutzer `node` des Abbilds; es schreibt nur hierher.
chmod 1777 "$ARBEIT/austausch"

# ------------------------------------------------------------------------------------------------
# Grundbausteine
# ------------------------------------------------------------------------------------------------
# EINMAL VEROEFFENTLICHEN, NIE ERSETZEN (Befunde R2-1/R2-2 der Pruefung Runde 2): Instanzkennung,
# Drill-Kennwort und Schluessel der Zweitkopie entstehen beim ersten Lauf. Zwei gleichzeitige erste
# Laeufe haben vorher je einen eigenen Wert geschrieben — der eine Dump trug danach eine Kennung, die
# nicht mehr in instanz.id stand, die eine Zweitkopie war mit einem Schluessel verschluesselt, den es
# nicht mehr gab. Jetzt: vollstaendig in eine eigene Datei im selben Ordner schreiben, dann `ln`
# (Hardlink) auf den Endnamen. `link(2)` ist atomar und scheitert, wenn der Name schon existiert —
# genau ein Lauf veroeffentlicht, jeder andere verwirft seinen Wert und liest den veroeffentlichten.
# B3_PAUSE_VOR_VEROEFFENTLICHUNG (Sekunden) haelt nur die Vertragstests an dieser Stelle an, damit
# der Wettlauf dort messbar ist statt zufaellig.
einmal_veroeffentlichen() { # <ziel> <wert>
  local ziel="$1"
  local wert="$2"
  local teil=""
  if [ ! -s "$ziel" ]; then
    teil="$(umask 077 && mktemp "$(dirname "$ziel")/.neu.XXXXXX")" || return 1
    printf '%s\n' "$wert" >"$teil"
    [ -z "${B3_PAUSE_VOR_VEROEFFENTLICHUNG:-}" ] || sleep "$B3_PAUSE_VOR_VEROEFFENTLICHUNG"
    ln "$teil" "$ziel" 2>/dev/null || true
    rm -f "$teil"
  fi
  if [ ! -s "$ziel" ]; then
    echo "[b3] ABBRUCH: $ziel liess sich nicht anlegen oder ist leer." >&2
    return 1
  fi
}

zufall_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

INSTANZ_DATEI="${INSTANZ_DATEI:-$ARBEIT/instanz.id}"
instanz_id() { # einmal veroeffentlicht, danach nur gelesen
  einmal_veroeffentlichen "$INSTANZ_DATEI" "klarwerk-instanz-$(zufall_hex 16)" || return 1
  head -n1 "$INSTANZ_DATEI" | tr -d '\r\n'
}

compose() {
  local args=(--project-directory "$STACK" -p "$PROJEKT")
  local f=""
  for f in $COMPOSE_DATEIEN; do
    args+=(-f "$STACK/$f")
  done
  docker compose "${args[@]}" "$@"
}

json() { # "" -> null, sonst JSON-String
  if [ -z "${1:-}" ]; then
    printf 'null'
    return 0
  fi
  local t="$1"
  t="${t//\\/\\\\}"
  t="${t//\"/\\\"}"
  t="${t//$'\n'/\\n}"
  t="${t//$'\r'/}"
  t="${t//$'\t'/ }"
  printf '"%s"' "$t"
}

json_roh() { # eingebettetes JSON-Objekt, sonst null
  case "${1:-}" in
    "{"*"}") printf '%s' "$1" ;;
    *) printf 'null' ;;
  esac
}

stand_von() { # Commit eines Baums: PRUEFPLATZ-STAND (git archive des Pruefplatzes) oder git
  local ordner="$1"
  local c=""
  if [ -f "$ordner/PRUEFPLATZ-STAND" ]; then
    c="$(sed -n 's/^commit=\([0-9a-f]*\).*/\1/p' "$ordner/PRUEFPLATZ-STAND" | head -n1)"
  elif [ -d "$ordner/.git" ] || [ -f "$ordner/.git" ]; then
    c="$(git -C "$ordner" rev-parse HEAD 2>/dev/null || true)"
  fi
  printf '%s' "${c:-unbekannt}"
}
PRUEFSTAND="$(stand_von "$WURZEL")"

# Das Datenbank-Kennwort: gelesen aus der .env der Instanz, NUR in die Umgebung der Aufrufe, die es
# brauchen — nie in ein Argument, nie in eine Ausgabe. Die Sicherung braucht es gar nicht (Adapter).
db_kennwort() {
  local roh=""
  roh="$(sed -n 's/^POSTGRES_PASSWORD=//p' "$STACK/.env" | tail -n1)"
  roh="${roh%\"}"
  roh="${roh#\"}"
  roh="${roh%\'}"
  roh="${roh#\'}"
  printf '%s' "$roh"
}

drill_kennwort() {
  local datei="$ARBEIT/geheim/drill-login"
  einmal_veroeffentlichen "$datei" "$(zufall_hex 24)" || return 1
  head -n1 "$datei" | tr -d '\r\n'
}

# Der Container eines Dienstes — ueber die Compose-Kennzeichen, nicht ueber `compose ps`: so zaehlt
# ein neu startender Container mit (`-a`), und ein Einmal-Container aus `compose run` (oneoff) nie.
container_von() {
  docker ps -aq --filter "label=com.docker.compose.project=$PROJEKT" \
    --filter "label=com.docker.compose.service=$1" \
    --filter "label=com.docker.compose.oneoff=False" 2>/dev/null | head -n1
}

inspiziere() { docker inspect -f "$2" "$1" 2>/dev/null || true; }

netz() {
  local db=""
  db="$(container_von db)"
  [ -n "$db" ] || return 1
  inspiziere "$db" '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | sed -n 1p
}

psql_db() { # <sql> [datenbank] — im Datenbankcontainer, lokaler Socket, ohne Kennwort
  compose exec -T db psql -X -v ON_ERROR_STOP=1 -U "$DB_KONTO" -d "${2:-$DB_NAME}" -tAc "$1"
}

app_health() {
  compose exec -T app node -e \
    "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>r.text()).then(t=>console.log(t)).catch(()=>process.exit(1))" \
    2>/dev/null | tr -d '\r\n' || true
}

health_feld() { # <json> <feld>
  printf '%s' "$1" | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p"
}

zustand() { # <container> -> status|health|exitcode|restarts|startedAt
  inspiziere "$1" '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}ohne{{end}}|{{.State.ExitCode}}|{{.RestartCount}}|{{.State.StartedAt}}'
}

# Wartet, bis der App-Container gesund ist. Rueckgabe 0 = gesund; sonst steht der Grund in GRUND.
GRUND=""
warte_gesund() {
  local cid="$1"
  local frist="$2"
  local start="" z="" status="" health="" code=""
  start="$(date +%s)"
  while :; do
    z="$(zustand "$cid")"
    IFS='|' read -r status health code _ _ <<<"$z"
    if [ "$health" = "healthy" ]; then
      return 0
    fi
    if [ "$status" = "exited" ] || [ "$status" = "dead" ] ||
      { [ "$status" = "restarting" ] && [ "${code:-0}" != "0" ]; }; then
      GRUND="der Container startet nicht (Status ${status}, Exitcode ${code})"
      return 1
    fi
    if [ "$health" = "unhealthy" ]; then
      GRUND="der Container meldet sich krank (Healthcheck unhealthy)"
      return 1
    fi
    if [ $(($(date +%s) - start)) -ge "$frist" ]; then
      GRUND="nach ${frist} s nicht gesund (Status ${status:-?}, Health ${health:-?})"
      return 1
    fi
    sleep 3
  done
}

# Das Pruefwerkzeug: Abbild der LAUFENDEN App + postgresql-client-16 + Entwicklungsabhaengigkeiten.
# Wiederverwendet, solange die App dasselbe Abbild hat (Kennzeichen im Namen).
WERKZEUG_BILD=""
werkzeug_sicherstellen() {
  local app="" bild_id="" kurz="" leer=""
  app="$(container_von app)"
  if [ -z "$app" ]; then
    echo "[b3] AUFBAUFEHLER: kein laufender app-Container im Projekt $PROJEKT." >&2
    return 2
  fi
  bild_id="$(inspiziere "$app" '{{.Image}}')"
  kurz="${bild_id#sha256:}"
  kurz="${kurz:0:12}"
  WERKZEUG_BILD="${PROJEKT}-pruefwerkzeug:${kurz}"
  if docker image inspect "$WERKZEUG_BILD" >/dev/null 2>&1; then
    return 0
  fi
  docker tag "$bild_id" "${PROJEKT}-app:pruefbasis"
  leer="$(mktemp -d)"
  cp "$WURZEL/scripts/backup/compose/pruefwerkzeug.Dockerfile" "$leer/Dockerfile"
  echo "[b3] Pruefwerkzeug wird gebaut: $WERKZEUG_BILD (aus App-Abbild $kurz)"
  if ! docker build -t "$WERKZEUG_BILD" --build-arg "APP_IMAGE=${PROJEKT}-app:pruefbasis" "$leer"; then
    rm -rf "$leer"
    echo "[b3] AUFBAUFEHLER: Pruefwerkzeug liess sich nicht bauen." >&2
    return 2
  fi
  rm -rf "$leer"
}

# Ein Lauf im Pruefwerkzeug, im Netz der Instanz. Umgebungswerte nur als NAMEN uebergeben
# (`-e NAME`), damit kein Wert in der Prozessliste des Wirts steht.
im_werkzeug() { # <einhaengen: sicherungsordner|""> <befehl…>
  local sicherungen="$1"
  shift
  local n=""
  n="$(netz)" || {
    echo "[b3] AUFBAUFEHLER: Netz der Instanz nicht feststellbar (laeuft db?)." >&2
    return 2
  }
  # B4 (Pruefung Runde 1): Die Testvorrichtungen legen Arbeitsordner UNTER tests/ an
  # (z. B. tests/backup-drill/restore-drill.test.ts: mkdtempSync(join(root, "tests/backup-drill/.probe-"))).
  # Ein schreibgeschuetzt eingehaengtes /app/tests laesst sie scheitern. Deshalb wird der Baum
  # schreibgeschuetzt unter /b3quelle eingehaengt und beim Start in das beschreibbare /app kopiert —
  # der Werkzeugbaum auf dem Wirt bleibt unberuehrt, die Tests laufen unveraendert.
  # `--init` (Lauf 2 R3, am echten Compose-Lauf gemessen): OHNE einen Init-Prozess ist der
  # Einstiegsbefehl PID 1 im Container. Beim Pruefen ist das `npx vitest` — Node sammelt verwaiste
  # Enkelprozesse nicht ein. Die vom Drill beendete Anwendung blieb als Zombie in ihrer
  # Prozessgruppe stehen, `kill -0` auf die Gruppe gelang weiter, und restore-drill.sh meldete
  # ehrlich „REAPING (80): Prozessgruppe hat SIGKILL ueberlebt" — W1–W4, P1/P2 und die
  # Parallel-/Beziehungsfaelle waren rot, obwohl jeder Drill bis Glied 7b bestanden hatte. Auf einem
  # Wirt mit Init (Testserver, Pruefplatz ausserhalb von Docker) tritt das nicht auf. Mit `--init`
  # ist tini PID 1 und sammelt ein, wie es jedes Init tut. Die Abraeumpruefung bleibt unveraendert.
  local args=(run --rm --init --network "$n" -e HOME=/tmp
    -e PGHOST=db -e "PGUSER=$DB_KONTO" -e PGPASSWORD
    -e DRILL_LOGIN_EMAIL -e DRILL_LOGIN_PASSWORT
    -v "$WURZEL/scripts:/b3quelle/scripts:ro"
    -v "$WURZEL/tests:/b3quelle/tests:ro"
    -v "$WURZEL/vitest.config.ts:/b3quelle/vitest.config.ts:ro"
    -v "$WURZEL/vitest.integration.config.ts:/b3quelle/vitest.integration.config.ts:ro"
    -v "$WURZEL/tsconfig.json:/b3quelle/tsconfig.json:ro"
    -v "$WURZEL/docs:/b3quelle/docs:ro"
    -v "$ARBEIT/austausch:/austausch")
  if [ -n "$sicherungen" ]; then
    args+=(-v "$sicherungen:/sicherungen:ro")
  fi
  local name=""
  for name in $IM_WERKZEUG_ENV; do
    args+=(-e "$name")
  done
  PGPASSWORD="$(db_kennwort)" DRILL_LOGIN_PASSWORT="$(drill_kennwort)" \
    docker "${args[@]}" "$WERKZEUG_BILD" \
    bash -c 'cp -R /b3quelle/. /app/ && cd /app && exec "$@"' b3 "$@"
}
IM_WERKZEUG_ENV=""

# Die Nutzlast braucht nur node und fetch — sie laeuft im App-Abbild selbst, ohne Pruefwerkzeug.
nutzlast() { # anlegen|vergleichen <basis-url> <ausgabe>
  local app="" bild="" n=""
  app="$(container_von app)"
  [ -n "$app" ] || {
    echo "[b3] AUFBAUFEHLER: kein laufender app-Container." >&2
    return 2
  }
  bild="$(inspiziere "$app" '{{.Image}}')"
  n="$(netz)" || return 2
  DRILL_LOGIN_PASSWORT="$(drill_kennwort)" docker run --rm --network "$n" \
    -e DRILL_LOGIN_EMAIL -e DRILL_LOGIN_PASSWORT \
    -v "$WURZEL/scripts/backup/compose:/b3:ro" -v "$ARBEIT/austausch:/austausch" \
    --entrypoint node "$bild" /b3/nutzlast.mjs "$@"
}

neueste_sicherung() { # <ordner>
  local d=""
  d="$(find "$1" -maxdepth 1 -name 'klarwerk-*.dump' -type f 2>/dev/null | LC_ALL=C sort | tail -n1)"
  printf '%s' "$d"
}

# ------------------------------------------------------------------------------------------------
# HERKUNFT JE SICHERUNG (R-0850) UND INSTANZBINDUNG (R-0811)
# ------------------------------------------------------------------------------------------------
#
# `backup.sh` bleibt unveraendert (Vorgabe JOB 4227). Den Herkunftsnachweis schreibt deshalb dieser
# Rahmen NACH einem gelungenen Lauf neben das veroeffentlichte Paar: `<dump>.herkunft.json`. Welcher
# Dump gemeint ist, liest er aus der Zeile „[backup] Dump nach: …" DIESES Laufs — nicht aus
# `letzter-lauf.json`, die ein gleichzeitiger Lauf ueberschrieben haben koennte. Der Nachweis traegt
# die SHA-256 des Dumps; ein Nachweis, der nicht zu seinem Dump passt, bindet nichts.
herkunft_datei() { printf '%s.herkunft.json' "$1"; }

herkunft_schreiben() { # <dump> <datenbank>
  local dump="$1"
  local db="$2"
  local health="" systemkennung="" arbeit=""
  health="$(app_health)"
  systemkennung="$(psql_db 'SELECT system_identifier FROM pg_control_system()' 2>/dev/null || true)"
  arbeit="$(herkunft_datei "$dump").$$"
  {
    printf '{\n "instanz_id": %s, "projekt": %s, "datenbank": %s,\n' \
      "$(json "$(instanz_id)")" "$(json "$PROJEKT")" "$(json "$db")"
    printf ' "db_systemkennung": %s, "instanz_stand": %s, "anwendung_health": %s,\n' \
      "$(json "$systemkennung")" "$(json "$(stand_von "$STACK")")" "$(json_roh "$health")"
    printf ' "dump": %s, "sha256": %s, "zeit": %s,\n' \
      "$(json "$(basename "$dump")")" "$(json "$(pruefsumme "$dump")")" "$(json "$(date -u +%Y-%m-%dT%H:%M:%SZ)")"
    printf ' "weg": "scripts/backup/backup.sh (unveraendert) ueber scripts/backup/compose, docker compose exec"\n}\n'
  } >"$arbeit" && mv "$arbeit" "$(herkunft_datei "$dump")"
  # Nachweise, deren Dump die Aufbewahrung entfernt hat, gehen mit.
  local h=""
  for h in "$(dirname "$dump")"/klarwerk-*.dump.herkunft.json; do
    [ -e "$h" ] || continue
    [ -f "${h%.herkunft.json}" ] || rm -f "$h"
  done
}

feld() { # <datei> <feld> — Zeichenkettenfeld aus einem flachen JSON-Nachweis
  sed -n "s/.*\"$2\": \"\([^\"]*\)\".*/\1/p" "$1" 2>/dev/null | head -n1
}

# Rueckgabe 0 = die Sicherung gehoert nachweislich zu DIESER Instanz; sonst steht der Grund in GRUND.
bindung_pruefen() { # <dump>
  local dump="$1"
  local h=""
  h="$(herkunft_datei "$dump")"
  if [ ! -f "$h" ]; then
    GRUND="kein Herkunftsnachweis $(basename "$h") — die Sicherung ist an keine Instanz gebunden"
    return 1
  fi
  if [ "$(feld "$h" sha256)" != "$(pruefsumme "$dump")" ]; then
    GRUND="der Herkunftsnachweis gehoert nicht zu diesem Dump (SHA-256 verschieden)"
    return 1
  fi
  local quelle="" ziel=""
  quelle="$(feld "$h" instanz_id)"
  ziel="$(instanz_id)"
  if [ "$quelle" != "$ziel" ]; then
    if [ -n "$quelle" ] && [ "${FREMDE_SICHERUNG_BESTAETIGT:-}" = "$quelle" ]; then
      echo "[b3] HINWEIS: Sicherung aus Instanz $quelle, Ziel ist $ziel — ausdruecklich bestaetigt (FREMDE_SICHERUNG_BESTAETIGT)."
      return 0
    fi
    GRUND="die Sicherung stammt aus Instanz ${quelle:-?}, das Ziel ist Instanz $ziel"
    return 1
  fi
  return 0
}

SICHERUNG_DATEI=""
sichern_in() { # <ordner> <keep> [datenbank] — backup.sh UNVERAENDERT, ueber die Compose-Adapter
  local ordner="$1"
  local keep="$2"
  local db="${3:-$DB_NAME}"
  local protokoll="" code=0
  mkdir -p "$ordner"
  protokoll="$(mktemp)"
  env -u KLARWERK_DATABASE_URL \
    PATH="$WURZEL/scripts/backup/compose:$PATH" \
    KLARWERK_COMPOSE_PROJEKT="$PROJEKT" \
    KLARWERK_COMPOSE_VERZEICHNIS="$STACK" \
    KLARWERK_COMPOSE_DATEIEN="$COMPOSE_DATEIEN" \
    DATABASE_URL="postgresql://${DB_KONTO}@db/${db}" \
    BACKUP_KEEP="$keep" \
    bash "$WURZEL/scripts/backup/backup.sh" "$ordner" >"$protokoll" 2>&1 || code=$?
  cat "$protokoll"
  SICHERUNG_DATEI="$(sed -n 's/^\[backup\] Dump nach: //p' "$protokoll" | tail -n1)"
  rm -f "$protokoll"
  if [ "$code" -eq 0 ] && [ -n "$SICHERUNG_DATEI" ] && [ -f "$SICHERUNG_DATEI" ]; then
    herkunft_schreiben "$SICHERUNG_DATEI" "$db"
  fi
  return "$code"
}

# B5: Die Compose-Dateien, mit denen dieses Skript arbeitet, muessen GENAU die sein, mit denen die
# Instanz laeuft (Kennzeichen `com.docker.compose.project.config_files` des app-Containers). Sonst
# baute oder startete es eine andere Konfiguration als die, die es misst.
compose_dateien_pruefen() {
  local app="" laufend="" soll="" ist="" f=""
  app="$(container_von app)"
  [ -n "$app" ] || return 0
  laufend="$(inspiziere "$app" '{{index .Config.Labels "com.docker.compose.project.config_files"}}')"
  [ -n "$laufend" ] || return 0
  ist="$(printf '%s' "$laufend" | tr ',' '\n' | sed 's#.*/##' | LC_ALL=C sort | tr '\n' ' ')"
  soll="$(for f in $COMPOSE_DATEIEN; do printf '%s\n' "${f##*/}"; done | LC_ALL=C sort | tr '\n' ' ')"
  if [ "$ist" != "$soll" ]; then
    echo "[b3] ABBRUCH: COMPOSE_DATEIEN ($soll) sind nicht die Dateien, mit denen die Instanz laeuft ($ist)." >&2
    return 1
  fi
  for f in $COMPOSE_DATEIEN; do
    if [ ! -f "$STACK/$f" ]; then
      echo "[b3] ABBRUCH: $STACK/$f fehlt." >&2
      return 1
    fi
  done
}

bestand_liste() { # <ordner> -> "name bytes sha256" je Paar, aelteste zuerst
  local d=""
  for d in $(find "$1" -maxdepth 1 -name 'klarwerk-*.dump' -type f | LC_ALL=C sort); do
    printf '%s %s %s\n' "$(basename "$d")" "$(wc -c <"$d" | tr -d ' ')" "$(pruefsumme "$d")"
  done
}

beleg() { printf '%s' "$BELEGE/b3-${LAUF}-$1"; }

kopf_json() { # gemeinsame Felder jedes Belegs
  printf '"lauf": %s, "schritt": %s, "pruefstand": %s, "instanz_stand": %s, "projekt": %s' \
    "$(json "$LAUF")" "$(json "$1")" "$(json "$PRUEFSTAND")" "$(json "$(stand_von "$STACK")")" \
    "$(json "$PROJEKT")"
}

# ================================================================================================
# SCHRITTE
# ================================================================================================

schritt_werkzeug() {
  werkzeug_sicherstellen || return $?
  echo "[b3] Pruefwerkzeug bereit: $WERKZEUG_BILD"
}

schritt_bestand() {
  local code=0
  nutzlast anlegen http://app:3001 /austausch/bestand.json || code=$?
  if [ "$code" -ne 0 ]; then
    return 2
  fi
  cp "$ARBEIT/austausch/bestand.json" "$(beleg bestand.json)"
}

VERGLEICH_ERGEBNIS=""
vergleiche_gegen() { # <basis-url> <belegname>
  local code=0
  # Ohne angelegten Bestand (Schritt `bestand`) gibt es nichts zu vergleichen. Das ist KEIN Befund
  # und KEIN Erfolg — es wird als „nicht gemessen" belegt, wie der Drill es fuer Glied 7b tut.
  if [ ! -f "$ARBEIT/austausch/bestand.json" ]; then
    VERGLEICH_ERGEBNIS="nicht gemessen (kein Bestand angelegt)"
    echo "[b3] Vergleich $2: NICHT gemessen — kein Bestand angelegt (Schritt 'bestand')."
    return 0
  fi
  # Ein Ergebnis eines FRUEHEREN Laufs darf nie als dieses durchgehen.
  rm -f "$ARBEIT/austausch/vergleich-$2.json"
  nutzlast vergleichen "$1" /austausch/bestand.json "/austausch/vergleich-$2.json" || code=$?
  if [ -f "$ARBEIT/austausch/vergleich-$2.json" ]; then
    cp "$ARBEIT/austausch/vergleich-$2.json" "$(beleg "vergleich-$2.json")"
  fi
  case "$code" in
    0) VERGLEICH_ERGEBNIS=gleich ;;
    1) VERGLEICH_ERGEBNIS=abweichung ;;
    *) VERGLEICH_ERGEBNIS=aufbaufehler ;;
  esac
  return "$code"
}

schritt_vergleichen() {
  local code=0
  if [ ! -f "$ARBEIT/austausch/bestand.json" ]; then
    echo "[b3] AUFBAUFEHLER: kein Bestand angelegt (Schritt 'bestand' zuerst)." >&2
    return 2
  fi
  vergleiche_gegen "${1:-http://app:3001}" "${2:-instanz}" || code=$?
  case "$code" in
    0) return 0 ;;
    1) return 110 ;;
    *) return 2 ;;
  esac
}

# ------------------------------------------------------------------------------------------------
# K1 — SICHERUNG
# ------------------------------------------------------------------------------------------------
schritt_sichern() {
  local ordner="$ARBEIT/sicherungen/laufend"
  local keep="${BACKUP_KEEP:-2}"
  local laeufe="${SICHERUNGSLAEUFE:-3}"
  local log="$ARBEIT/austausch/sichern-${LAUF}.protokoll"
  local i="" code="" datei="" bytes="" sha="" soll=""
  local laeufe_json="" ergebnis=0
  : >"$log"
  for i in $(seq 1 "$laeufe"); do
    code=0
    sichern_in "$ordner" "$keep" 2>&1 | tee -a "$log" || code=${PIPESTATUS[0]}
    datei="$(sed -n 's/.*"datei": "\([^"]*\)".*/\1/p' "$ordner/letzter-lauf.json" 2>/dev/null || true)"
    bytes="" sha="" soll=""
    if [ -n "$datei" ] && [ -f "$ordner/$datei" ]; then
      bytes="$(wc -c <"$ordner/$datei" | tr -d ' ')"
      sha="$(pruefsumme "$ordner/$datei")"
      soll="$(awk '{print $1}' "$ordner/$datei.sha256" 2>/dev/null || true)"
    fi
    laeufe_json="${laeufe_json}${laeufe_json:+, }{\"lauf\": $i, \"exit\": $code, \"datei\": $(json "$datei"), \"bytes\": ${bytes:-null}, \"sha256\": $(json "$sha"), \"sidecar\": $(json "$soll"), \"bestand_danach\": $(json "$(bestand_liste "$ordner")")}"
    echo "[b3] K1 Lauf $i: exit=$code datei=${datei:-—} bytes=${bytes:-—} sha256=${sha:-—}"
    if [ "$code" -ne 0 ]; then
      ergebnis=100
      break
    fi
    if [ -z "$sha" ] || [ "$sha" != "$soll" ]; then
      echo "[b3] K1 BEFUND: Pruefsumme der Sicherung $datei passt nicht zum Sidecar." >&2
      ergebnis=102
      break
    fi
  done
  local anzahl=""
  anzahl="$(find "$ordner" -maxdepth 1 -name 'klarwerk-*.dump' -type f | wc -l | tr -d ' ')"
  if [ "$ergebnis" -eq 0 ] && [ "$laeufe" -ge "$keep" ] && [ "$anzahl" -ne "$keep" ]; then
    echo "[b3] K1 BEFUND: nach $laeufe Laeufen liegen $anzahl Sicherungen, BACKUP_KEEP=$keep." >&2
    ergebnis=101
  fi
  # „ohne Passwort in Logs" — gemessen, nicht versprochen.
  local kennwort_im_log=nein
  local kw=""
  kw="$(db_kennwort)"
  if [ -n "$kw" ] && grep -qF -- "$kw" "$log" "$ordner/letzter-lauf.json" 2>/dev/null; then
    kennwort_im_log=ja
    ergebnis=102
    echo "[b3] K1 BEFUND: das Datenbank-Kennwort steht im Sicherungsprotokoll." >&2
  fi
  cp "$log" "$(beleg sichern-backup.log)"
  # AUS WELCHEM STAND, AUS WELCHER DATENBANK (R-0850, R-0811 als Nachweis — keine Sperre): der
  # laufende Anwendungsstand laut /health und die Systemkennung des PostgreSQL-Clusters, aus dem
  # gesichert wurde. Ein Dump einer anderen Instanz traegt eine andere Kennung.
  local stand_health="" systemkennung=""
  stand_health="$(app_health)"
  systemkennung="$(psql_db 'SELECT system_identifier FROM pg_control_system()' 2>/dev/null || true)"
  {
    printf '{%s,\n' "$(kopf_json sichern)"
    printf ' "anwendung_health": %s, "db_systemkennung": %s,\n' "$(json_roh "$stand_health")" "$(json "$systemkennung")"
    printf ' "backup_keep": %s, "laeufe_soll": %s, "anzahl_danach": %s, "kennwort_im_log": %s,\n' \
      "$keep" "$laeufe" "$anzahl" "$(json "$kennwort_im_log")"
    printf ' "weg": "backup.sh unveraendert; pg_dump/pg_restore --list ueber docker compose exec (scripts/backup/compose)",\n'
    printf ' "laeufe": [%s],\n "exit": %s}\n' "$laeufe_json" "$ergebnis"
  } >"$(beleg sichern.json)"
  echo "[b3] K1 Aufbewahrung: $anzahl Sicherung(en) bei BACKUP_KEEP=$keep:"
  bestand_liste "$ordner" | sed 's/^/[b3]   /'
  return "$ergebnis"
}

# ------------------------------------------------------------------------------------------------
# K2 — WIEDERHERSTELLUNG in eine frische Datenbank derselben PostgreSQL
# ------------------------------------------------------------------------------------------------
drill_fahren() { # <dump> <zieldatenbank> <protokoll> -> Exitcode von restore-drill.sh
  local dump="$1"
  local ziel="$2"
  local protokoll="$3"
  local code=0
  IM_WERKZEUG_ENV="RESTORE_DB DRILL_PORT DRILL_WORKDIR APP_BASE_URL"
  RESTORE_DB="$ziel" DRILL_PORT=3097 DRILL_WORKDIR=/tmp APP_BASE_URL=http://127.0.0.1:3097 \
    im_werkzeug "$(dirname "$dump")" bash /app/scripts/backup/restore-drill.sh \
    "/sicherungen/$(basename "$dump")" 2>&1 | tee "$protokoll" || code=${PIPESTATUS[0]}
  IM_WERKZEUG_ENV=""
  return "$code"
}

db_existiert() { [ "$(psql_db "SELECT count(*) FROM pg_database WHERE datname='$1'" postgres 2>/dev/null)" = "1" ]; }

db_entfernen() { psql_db "DROP DATABASE IF EXISTS \"$1\" WITH (FORCE)" postgres >/dev/null 2>&1 || true; }

schritt_wiederherstellen() {
  local dump="${1:-$(neueste_sicherung "$ARBEIT/sicherungen/laufend")}"
  local ziel="klarwerk_drill_${LAUF_KLEIN}"
  local protokoll="$(beleg wiederherstellen-drill.log)"
  local code=0 t0="" t1="" vcode=0 appname="" cid=""
  if [ -z "$dump" ] || [ ! -f "$dump" ]; then
    echo "[b3] AUFBAUFEHLER: keine Sicherung gefunden (Schritt 'sichern' zuerst)." >&2
    return 2
  fi
  # R-0811: nur eine Sicherung DIESER Instanz — geprueft, bevor irgendeine Datenbank entsteht.
  if ! bindung_pruefen "$dump"; then
    echo "[b3] ABBRUCH (161): $GRUND — es wird nichts wiederhergestellt." >&2
    printf '{%s, "dump": %s, "instanz_id": %s, "grund": %s, "exit": 161}\n' "$(kopf_json wiederherstellen)" \
      "$(json "$(basename "$dump")")" "$(json "$(instanz_id)")" "$(json "$GRUND")" >"$(beleg wiederherstellen.json)"
    return 161
  fi
  werkzeug_sicherstellen || return $?
  t0="$(date +%s)"
  drill_fahren "$dump" "$ziel" "$protokoll" || code=$?
  t1="$(date +%s)"
  echo "[b3] K2 restore-drill.sh: exit=$code in $((t1 - t0)) s, Ziel $ziel"

  # Dieselbe wiederhergestellte Datenbank, jetzt mit dem PRODUKTABBILD der Instanz (dieselbe
  # Dienstdefinition, derselbe Startbefehl) — und der Bestand Byte fuer Byte gegen den Vorzustand.
  if [ "$code" -eq 0 ]; then
    appname="${PROJEKT}-wiederhergestellt-${LAUF_KLEIN}"
    DATABASE_URL="postgresql://${DB_KONTO}:$(db_kennwort)@db:5432/${ziel}" \
      compose run -d --no-deps --name "$appname" -e DATABASE_URL app >/dev/null
    cid="$(docker ps -aq --filter "name=^/${appname}$" | head -n1)"
    if warte_gesund "$cid" "$WARTEN_GESUND"; then
      vergleiche_gegen "http://${appname}:3001" wiederhergestellt || vcode=$?
    else
      echo "[b3] K2 AUFBAUFEHLER: Produktabbild auf der wiederhergestellten Datenbank: $GRUND" >&2
      vcode=2
    fi
    docker logs --tail 20 "$cid" >"$(beleg wiederherstellen-app.log)" 2>&1 || true
    docker rm -f "$cid" >/dev/null 2>&1 || true
  fi
  if [ "${B3_BEHALTEN:-0}" != "1" ]; then
    db_entfernen "$ziel"
  fi
  {
    printf '{%s,\n' "$(kopf_json wiederherstellen)"
    printf ' "dump": %s, "dump_sha256": %s, "dump_bytes": %s, "sidecar": %s,\n' \
      "$(json "$(basename "$dump")")" "$(json "$(pruefsumme "$dump")")" \
      "$(wc -c <"$dump" | tr -d ' ')" "$(json "$(awk '{print $1}' "$dump.sha256")")"
    printf ' "zieldatenbank": %s, "drill_exit": %s, "drill_sekunden": %s,\n' "$(json "$ziel")" "$code" "$((t1 - t0))"
    printf ' "produktabbild_vergleich": %s, "vergleich_exit": %s,\n' "$(json "${VERGLEICH_ERGEBNIS:-nicht gelaufen}")" "$vcode"
    printf ' "protokoll": %s}\n' "$(json "$(basename "$protokoll")")"
  } >"$(beleg wiederherstellen.json)"
  if [ "$code" -ne 0 ]; then
    return "$code"
  fi
  case "$vcode" in
    0) return 0 ;;
    1) return 110 ;;
    *) return 2 ;;
  esac
}

# ------------------------------------------------------------------------------------------------
# K3/K4 — AKTUALISIEREN, mit Rueckweg
# ------------------------------------------------------------------------------------------------
# md5 ueber die Inhalte, die eine Aktualisierung nicht aendern darf. RUECKGABE ≠ 0, wenn die Messung
# scheitert oder nichts liefert (Befund B2 der Pruefung, Runde 1): zwei gescheiterte Messungen sind
# zweimal „nichts" — und waren vorher als „gleich" durchgegangen.
inhalt_pruefsumme() {
  local wert=""
  wert="$(psql_db "SELECT (SELECT count(*) FROM users)||':'||(SELECT count(*) FROM kos)||':'||
    (SELECT md5(coalesce(string_agg(id||data::text, '|' ORDER BY id), '')) FROM objects)||':'||
    (SELECT md5(coalesce(string_agg(id||data::text, '|' ORDER BY id), '')) FROM ko_evidence)" 2>/dev/null)" || return 1
  [[ "$wert" =~ ^[0-9]+:[0-9]+:[0-9a-f]{32}:[0-9a-f]{32}$ ]] || return 1
  printf '%s' "$wert"
}

# Was bei einer neuen Ausgabe der Instanz gehoert und nicht dem Release: die .env, die Belege und
# jede Compose-Datei ausser docker-compose.prod.yml (Befund B3: eine instanzeigene Override-Datei
# verschwand, wenn das neue Release sie nicht mitbrachte). Zusaetzliches nennt B3_ERHALTEN.
erhaltene_dateien() {
  local f=""
  printf '%s\n' .env belege
  for f in $COMPOSE_DATEIEN; do
    [ "$f" = docker-compose.prod.yml ] || printf '%s\n' "$f"
  done
  for f in ${B3_ERHALTEN:-}; do printf '%s\n' "$f"; done
}

ausgabe_einspielen() { # <quelle> — ersetzt den Quellbaum der Instanz, Erhaltenes bleibt
  local quelle="$1"
  local sicher="" f=""
  sicher="$(mktemp -d)"
  while IFS= read -r f; do
    if [ -e "$STACK/$f" ]; then
      mkdir -p "$sicher/$(dirname "$f")"
      cp -a "$STACK/$f" "$sicher/$f"
    fi
  done < <(erhaltene_dateien)
  # `--checksum`: der Schnellvergleich nach Groesse und Zeit uebersieht eine geaenderte Datei
  # gleicher Laenge aus derselben Sekunde (gemessen im Vertragstest U1) — eine halbe neue Ausgabe.
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --checksum --delete --exclude /.env --exclude /belege "$quelle/" "$STACK/"
  else
    find "$STACK" -mindepth 1 -maxdepth 1 ! -name .env ! -name belege -exec rm -rf {} +
    (cd "$quelle" && tar -cf - --exclude ./.env --exclude ./belege .) | (cd "$STACK" && tar -xf -)
  fi
  # Das Erhaltene wird zurueckgelegt — die Fassung der INSTANZ gilt, auch wenn das Release eine
  # gleichnamige Datei mitbringt.
  (cd "$sicher" && tar -cf - .) | (cd "$STACK" && tar -xf -)
  rm -rf "$sicher"
  for f in $COMPOSE_DATEIEN; do
    if [ ! -f "$STACK/$f" ]; then
      echo "[b3] ABBRUCH: $f fehlt nach dem Einspielen der neuen Ausgabe." >&2
      return 1
    fi
  done
}

schritt_aktualisieren() {
  local quelle="${1:-}"
  local stoerung="${STOERUNG:-}"
  # BEFUND B1 (Lauf 2 R1): `local name` ohne Wert laesst die Variable ab bash 4 UNGESETZT — unter
  # `set -u` endete jeder Fehlerzweig, der `nachher_health` vor der ersten Zuweisung las, mit Exit 1
  # statt 121/122 und ohne Beleg. (macOS-bash 3.2 behandelt sie als leer; deshalb lief es dort gruen.)
  # Jede Variable dieses Schritts hat deshalb einen Anfangswert.
  local app="" bildname="" vorher_bild="" vorher_start="" vorher_health="" vorher_stand="" vorher_inhalt=""
  local neu_stand="" neu_cid="" nachher_bild="" nachher_start="" nachher_health="" nachher_inhalt=""
  local ergebnis=0 grund="" rueckweg="nicht noetig" rueck_health="" t_bau0=0 t_bau1=0 t_up0=0 t_up1=0
  local envargs=() envkopie=""

  app="$(container_von app)"
  if [ -z "$app" ]; then
    echo "[b3] AUFBAUFEHLER: kein laufender app-Container." >&2
    return 2
  fi
  bildname="$(inspiziere "$app" '{{.Config.Image}}')"
  vorher_bild="$(inspiziere "$app" '{{.Image}}')"
  vorher_start="$(inspiziere "$app" '{{.State.StartedAt}}')"
  vorher_health="$(app_health)"
  vorher_stand="$(stand_von "$STACK")"
  compose_dateien_pruefen || return 1
  if ! vorher_inhalt="$(inhalt_pruefsumme)"; then
    echo "[b3] ABBRUCH (111): die Inhaltsmessung VOR der Aktualisierung ist gescheitert — ohne" >&2
    echo "[b3] Vergleichsbasis wird nicht aktualisiert." >&2
    return 111
  fi
  docker tag "$vorher_bild" "${PROJEKT}-app:rueckfall"
  echo "[b3] Aktualisierung: vorher Abbild ${vorher_bild:7:12} Stand $vorher_stand /health $vorher_health"

  # DIE DATENHAELFTE DES RUECKWEGS: vor jeder Aktualisierung eine Sicherung. Ein Zurueckfallen auf
  # das alte Abbild stellt den Code wieder her, nicht die Daten — hat die neue Ausgabe das Schema
  # schon veraendert, braucht es diese Sicherung (Anleitung: docs/operations/restore-drill.md §C).
  if ! sichern_in "$ARBEIT/sicherungen/vor-aktualisierung" "${VOR_UPDATE_KEEP:-5}" >"$(beleg aktualisieren${stoerung:+-$stoerung}-vorab-sicherung.log)" 2>&1; then
    echo "[b3] ABBRUCH: die Vorab-Sicherung ist gescheitert — es wird NICHT aktualisiert." >&2
    return 100
  fi

  if [ -n "$quelle" ] && [ "$(cd "$quelle" && pwd)" != "$(cd "$STACK" && pwd)" ]; then
    # Die neue Ausgabe ersetzt den Quellbaum der Instanz — .env und belege bleiben. Vorher wird
    # geprueft, dass die Quelle wirklich ein Produktbaum ist: ein Tippfehler darf den Ordner der
    # Instanz nicht leeren.
    if [ ! -f "$quelle/docker-compose.prod.yml" ] || [ ! -f "$quelle/Dockerfile" ]; then
      echo "[b3] ABBRUCH: $quelle ist kein Produktbaum (docker-compose.prod.yml/Dockerfile fehlen)." >&2
      return 1
    fi
    ausgabe_einspielen "$quelle" || return 121
  fi
  neu_stand="$(stand_von "$STACK")"

  # 1) Konfiguration — VOR dem Bau. Fehlt eine Pflichtvariable, bricht Compose mit ihrem Namen ab,
  #    und der laufende Stand wird nicht angefasst.
  if [ "$stoerung" = "fehlende-variable" ]; then
    envkopie="$ARBEIT/geheim/env-ohne-app-base-url"
    (umask 077 && grep -v '^APP_BASE_URL=' "$STACK/.env" >"$envkopie")
    envargs=(--env-file "$envkopie")
  fi
  local konfig_fehler=""
  if ! konfig_fehler="$(env -u APP_BASE_URL -u POSTGRES_PASSWORD docker compose --project-directory "$STACK" -p "$PROJEKT" ${envargs[@]+"${envargs[@]}"} $(for f in $COMPOSE_DATEIEN; do printf -- '-f %s ' "$STACK/$f"; done) config --quiet 2>&1)"; then
    grund="Konfiguration unvollstaendig: $(printf '%s' "$konfig_fehler" | tail -n2 | tr '\n' ' ')"
    ergebnis=121
  fi
  [ -z "$envkopie" ] || rm -f "$envkopie"

  # 2) Bau der neuen Ausgabe (bzw. der absichtlich kaputten fuer die Gegenprobe K4).
  t_bau0="$(date +%s)"
  if [ "$ergebnis" -eq 0 ]; then
    if [ "$stoerung" = "kaputtes-abbild" ]; then
      if ! printf 'FROM %s\nCMD ["node","-e","console.error(\\"KLARWERK-Stoerprobe B3: diese Ausgabe startet absichtlich nicht\\");process.exit(3)"]\n' \
        "${PROJEKT}-app:rueckfall" | docker build -t "$bildname" -; then
        grund="Bau der Stoerprobe gescheitert"
        ergebnis=120
      fi
    elif ! compose build --build-arg "SOURCE_COMMIT=${neu_stand}" app; then
      grund="Bau der neuen Ausgabe (Stand $neu_stand) gescheitert"
      ergebnis=120
    fi
  fi
  t_bau1="$(date +%s)"

  # 3) Ausrollen und auf Gesundheit warten. Die Volumes bleiben, wie sie sind: nur `app` wird neu
  #    erzeugt (`--no-deps`), `db` und `pgdata` werden nicht angefasst.
  t_up0="$(date +%s)"
  if [ "$ergebnis" -eq 0 ]; then
    if ! compose up -d --no-deps --force-recreate app; then
      grund="docker compose up ist gescheitert"
      ergebnis=122
    else
      neu_cid="$(container_von app)"
      if ! warte_gesund "$neu_cid" "$WARTEN_GESUND"; then
        grund="neue Ausgabe nicht gesund: $GRUND; letzte Zeilen: $(docker logs --tail 3 "$neu_cid" 2>&1 | tr '\n' ' ')"
        ergebnis=122
      else
        nachher_health="$(app_health)"
        if [[ "$neu_stand" =~ ^[0-9a-f]{7,40}$ ]] && [ "$(health_feld "$nachher_health" commit)" != "$neu_stand" ]; then
          grund="/health meldet commit $(health_feld "$nachher_health" commit), erwartet $neu_stand"
          ergebnis=124
        fi
      fi
    fi
  fi
  t_up1="$(date +%s)"

  # 4) Rueckweg: das vorherige Abbild erneut ausrollen — nur, wenn die neue Ausgabe schon ausgerollt
  #    war. Bei 120/121 lief der vorherige Stand ununterbrochen weiter; das wird belegt, nicht behauptet.
  if [ "$ergebnis" -eq 122 ] || [ "$ergebnis" -eq 124 ]; then
    echo "[b3] RUECKWEG: $grund" >&2
    docker tag "${PROJEKT}-app:rueckfall" "$bildname"
    if compose up -d --no-deps --force-recreate app && warte_gesund "$(container_von app)" "$WARTEN_GESUND" &&
      [ "$(inspiziere "$(container_von app)" '{{.Image}}')" = "$vorher_bild" ]; then
      rueck_health="$(app_health)"
      rueckweg="ausgefuehrt: vorheriges Abbild ${vorher_bild:7:12} laeuft wieder und ist gesund"
    else
      rueckweg="GESCHEITERT: ${GRUND:-vorheriges Abbild laeuft nicht gesund}"
      ergebnis=123
    fi
  elif [ "$ergebnis" -eq 120 ] || [ "$ergebnis" -eq 121 ]; then
    if [ "$(container_von app)" = "$app" ] &&
      [ "$(inspiziere "$app" '{{.State.StartedAt}}')" = "$vorher_start" ] &&
      [ "$(inspiziere "$app" '{{.Image}}')" = "$vorher_bild" ]; then
      rueckweg="nicht noetig: vorheriger Stand lief ununterbrochen weiter (derselbe Container, dieselbe Startzeit)"
      rueck_health="$(app_health)"
    else
      rueckweg="GESCHEITERT: der vorherige Container laeuft nicht mehr unveraendert"
      ergebnis=123
    fi
  fi

  app="$(container_von app)"
  nachher_bild="$(inspiziere "$app" '{{.Image}}')"
  nachher_start="$(inspiziere "$app" '{{.State.StartedAt}}')"
  [ -n "$nachher_health" ] || nachher_health="$(app_health)"
  nachher_inhalt="$(inhalt_pruefsumme)" || nachher_inhalt=""
  if [ "$ergebnis" -eq 0 ] && [ "$vorher_stand" = "$neu_stand" ] && [ -z "$stoerung" ]; then
    grund="keine neuere Ausgabe: Stand vorher = Stand nachher ($neu_stand)"
    ergebnis=125
  fi

  local vcode=0
  vergleiche_gegen http://app:3001 "aktualisieren${stoerung:+-$stoerung}" || vcode=$?
  # Die Daten muessen auch nach einem RUECKWEG dieselben sein (K4: „Datenbestand bleibt"). Ein
  # gescheiterter oder abweichender Vergleich ueber die Anwendung ueberstimmt deshalb auch
  # 120/121/122/124/125 — nur ein gescheiterter Rueckweg (123) bleibt als der schwerere Befund stehen.
  # BEFUND B2 (Lauf 2 R1): bis hierher galt das nur bei `ergebnis=0`. Nach dem kaputten Abbild
  # (122) blieb `vergleich=abweichung` folgenlos, und der Schritt `rueckweg` meldete Exit 0.
  if [ "$vcode" -ne 0 ] && [ "$ergebnis" -ne 123 ]; then
    grund="${grund:+$grund; }Bestand ueber die Anwendung nicht unveraendert lesbar (Vergleich $VERGLEICH_ERGEBNIS, exit $vcode)"
    if [ "$vcode" -eq 1 ]; then ergebnis=110; else ergebnis=111; fi
  fi
  if [ "$ergebnis" -ne 123 ]; then
    if [ -z "$nachher_inhalt" ]; then
      grund="${grund:+$grund; }Inhaltsmessung NACH der Aktualisierung gescheitert — unveraenderte Daten sind nicht bewiesen"
      ergebnis=111
    elif [ "$vorher_inhalt" != "$nachher_inhalt" ]; then
      grund="${grund:+$grund; }Inhaltspruefsumme veraendert: vorher $vorher_inhalt nachher $nachher_inhalt"
      ergebnis=110
    fi
  fi

  {
    printf '{%s,\n' "$(kopf_json "aktualisieren${stoerung:+-$stoerung}")"
    printf ' "stoerung": %s, "stand_vorher": %s, "stand_neu": %s,\n' "$(json "$stoerung")" "$(json "$vorher_stand")" "$(json "$neu_stand")"
    printf ' "vorher": {"abbild": %s, "gestartet": %s, "health": %s},\n' "$(json "$vorher_bild")" "$(json "$vorher_start")" "$(json_roh "$vorher_health")"
    printf ' "nachher": {"abbild": %s, "gestartet": %s, "health": %s},\n' "$(json "$nachher_bild")" "$(json "$nachher_start")" "$(json_roh "$nachher_health")"
    printf ' "rueckweg_health": %s,\n' "$(json_roh "$rueck_health")"
    printf ' "bau_sekunden": %s, "ausrollen_bis_gesund_sekunden": %s,\n' "$((t_bau1 - t_bau0))" "$((t_up1 - t_up0))"
    printf ' "inhalt_vorher": %s, "inhalt_nachher": %s, "vergleich": %s,\n' "$(json "$vorher_inhalt")" "$(json "$nachher_inhalt")" "$(json "$VERGLEICH_ERGEBNIS")"
    printf ' "rueckweg": %s, "grund": %s, "exit": %s}\n' "$(json "$rueckweg")" "$(json "$grund")" "$ergebnis"
  } >"$(beleg "aktualisieren${stoerung:+-$stoerung}.json")"
  if [ "$ergebnis" -eq 0 ]; then
    echo "[b3] Aktualisierung bestanden: $vorher_stand -> $neu_stand, /health $nachher_health"
  else
    echo "[b3] Aktualisierung endet mit $ergebnis — Grund: $grund — Rueckweg: $rueckweg" >&2
  fi
  return "$ergebnis"
}

# ------------------------------------------------------------------------------------------------
# NEUSTART — echter Neustart von PostgreSQL und Anwendung, belegt ueber die Postmaster-Startzeit
# ------------------------------------------------------------------------------------------------
schritt_neustart() {
  local zusatz=""
  [ "${NEUSTART_AUSLASSEN:-0}" != "1" ] || zusatz="-ausgelassen"
  local pm_vorher="" pm_nachher="" db_vorher="" db_nachher="" app_vorher="" app_nachher="" ergebnis=0 grund="" i=""
  local inhalt_vorher="" inhalt_nachher=""
  compose_dateien_pruefen || return 1
  pm_vorher="$(psql_db 'SELECT pg_postmaster_start_time()' 2>/dev/null || true)"
  # Ohne Messung VORHER beweist auch eine veraenderte Startzeit nachher nichts (Befund B2).
  if [ -z "$pm_vorher" ] || ! inhalt_vorher="$(inhalt_pruefsumme)"; then
    echo "[b3] ABBRUCH (111): Postmaster-Startzeit oder Inhalt VOR dem Neustart nicht messbar." >&2
    return 111
  fi
  db_vorher="$(inspiziere "$(container_von db)" '{{.State.StartedAt}}')"
  app_vorher="$(inspiziere "$(container_von app)" '{{.State.StartedAt}}')"
  if [ "${NEUSTART_AUSLASSEN:-0}" = "1" ]; then
    echo "[b3] GEGENPROBE: der Neustart wird absichtlich AUSGELASSEN."
  else
    compose restart db app
  fi
  for i in $(seq 1 60); do
    compose exec -T db pg_isready -U "$DB_KONTO" >/dev/null 2>&1 && break
    sleep 2
  done
  pm_nachher="$(psql_db 'SELECT pg_postmaster_start_time()' 2>/dev/null || true)"
  if [ -z "$pm_nachher" ] || ! warte_gesund "$(container_von app)" "$WARTEN_GESUND"; then
    grund="nach dem Neustart nicht wieder bereit: ${GRUND:-PostgreSQL antwortet nicht}"
    ergebnis=131
  elif [ "$pm_nachher" = "$pm_vorher" ]; then
    grund="Postmaster-Startzeit unveraendert ($pm_nachher) — es gab keinen echten Datenbank-Neustart"
    ergebnis=130
  fi
  db_nachher="$(inspiziere "$(container_von db)" '{{.State.StartedAt}}')"
  app_nachher="$(inspiziere "$(container_von app)" '{{.State.StartedAt}}')"
  local vcode=0
  if [ "$ergebnis" -eq 0 ]; then
    if ! inhalt_nachher="$(inhalt_pruefsumme)"; then
      grund="Inhaltsmessung nach dem Neustart gescheitert"
      ergebnis=111
    elif [ "$inhalt_nachher" != "$inhalt_vorher" ]; then
      grund="Inhaltspruefsumme veraendert: vorher $inhalt_vorher nachher $inhalt_nachher"
      ergebnis=110
    fi
  fi
  if [ "$ergebnis" -eq 0 ]; then
    vergleiche_gegen http://app:3001 neustart || vcode=$?
    [ "$vcode" -eq 0 ] || {
      grund="Bestand nach dem Neustart nicht unveraendert lesbar"
      ergebnis=110
    }
  fi
  {
    printf '{%s,\n' "$(kopf_json "neustart${zusatz}")"
    printf ' "neustart_ausgelassen": %s,\n' "$(json "${NEUSTART_AUSLASSEN:-0}")"
    printf ' "postmaster_vorher": %s, "postmaster_nachher": %s,\n' "$(json "$pm_vorher")" "$(json "$pm_nachher")"
    printf ' "db_gestartet_vorher": %s, "db_gestartet_nachher": %s,\n' "$(json "$db_vorher")" "$(json "$db_nachher")"
    printf ' "app_gestartet_vorher": %s, "app_gestartet_nachher": %s,\n' "$(json "$app_vorher")" "$(json "$app_nachher")"
    printf ' "inhalt_vorher": %s, "inhalt_nachher": %s, "vergleich": %s,\n' "$(json "$inhalt_vorher")" "$(json "$inhalt_nachher")" "$(json "${VERGLEICH_ERGEBNIS:-nicht gelaufen}")"
    printf ' "grund": %s, "exit": %s}\n' "$(json "$grund")" "$ergebnis"
  } >"$(beleg "neustart${zusatz}.json")"
  echo "[b3] Neustart: Postmaster $pm_vorher -> $pm_nachher; exit $ergebnis ${grund:+— $grund}"
  return "$ergebnis"
}

# ------------------------------------------------------------------------------------------------
# PRUEFEN — die vorhandenen Tests gegen die PostgreSQL dieser Instanz, ohne Skip
# ------------------------------------------------------------------------------------------------
schritt_pruefen() {
  local testdb="klarwerk_b3_test"
  local ergebnis=0 c1=0 c2=0 log="$(beleg pruefen.log)"
  werkzeug_sicherstellen || return $?
  db_existiert "$testdb" || psql_db "CREATE DATABASE $testdb" postgres >/dev/null
  rm -f "$ARBEIT/austausch/pruefen-integration.json" "$ARBEIT/austausch/pruefen-vertrag.json"
  IM_WERKZEUG_ENV="KLARWERK_PG_TEST_URL NODE_ENV"
  KLARWERK_PG_TEST_URL="postgresql://${DB_KONTO}:$(db_kennwort)@db:5432/${testdb}" NODE_ENV=test \
    im_werkzeug "" npx vitest run --config vitest.integration.config.ts \
    tests/backup-drill/echter-wiederanlauf.integration.test.ts \
    tests/backup-drill/waechter-echte-pg.integration.test.ts \
    tests/backup-parallel/beide-dumps-lassen-sich-restaurieren.integration.test.ts \
    tests/beziehungs-restore-nutzerweg/beziehungen-ueberleben-den-produkt-restore.integration.test.ts \
    --reporter=verbose --reporter=json --outputFile.json=/austausch/pruefen-integration.json \
    2>&1 | tee "$log" || c1=${PIPESTATUS[0]}
  NODE_ENV=test im_werkzeug "" npx vitest run tests/backup-drill tests/backup-parallel \
    tests/sicherung-dauerbetrieb tests/kundenbetrieb-compose \
    --reporter=verbose --reporter=json --outputFile.json=/austausch/pruefen-vertrag.json \
    2>&1 | tee -a "$log" || c2=${PIPESTATUS[0]}
  IM_WERKZEUG_ENV=""
  local datei="" zahl="" skip=0 rot=0
  for datei in pruefen-integration.json pruefen-vertrag.json; do
    if [ ! -s "$ARBEIT/austausch/$datei" ]; then
      rot=1
      continue
    fi
    cp "$ARBEIT/austausch/$datei" "$(beleg "$datei")"
    zahl="$(grep -o '"numPendingTests":[0-9]*' "$ARBEIT/austausch/$datei" | head -n1 | cut -d: -f2)"
    [ "${zahl:-1}" = "0" ] || skip=1
    zahl="$(grep -o '"numTodoTests":[0-9]*' "$ARBEIT/austausch/$datei" | head -n1 | cut -d: -f2)"
    [ "${zahl:-0}" = "0" ] || skip=1
    zahl="$(grep -o '"numFailedTests":[0-9]*' "$ARBEIT/austausch/$datei" | head -n1 | cut -d: -f2)"
    [ "${zahl:-1}" = "0" ] || rot=1
  done
  # Die Suiten melden fehlende Werkzeuge/Datenbank auf stderr mit „UEBERSPRUNGEN" — auch das ist rot.
  if grep -qE 'ÜBERSPRUNGEN|UEBERSPRUNGEN' "$log"; then
    skip=1
  fi
  if [ "$c1" -ne 0 ] || [ "$c2" -ne 0 ] || [ "$rot" -ne 0 ]; then
    ergebnis=140
  elif [ "$skip" -ne 0 ]; then
    ergebnis=141
  fi
  {
    printf '{%s,\n' "$(kopf_json pruefen)"
    printf ' "vitest_integration_exit": %s, "vitest_vertrag_exit": %s, "uebersprungen": %s, "exit": %s}\n' \
      "$c1" "$c2" "$(json "$([ "$skip" -eq 0 ] && echo nein || echo ja)")" "$ergebnis"
  } >"$(beleg pruefen.json)"
  echo "[b3] Pruefen: integration exit $c1, vertrag exit $c2, uebersprungen=$skip -> $ergebnis"
  return "$ergebnis"
}

# ------------------------------------------------------------------------------------------------
# K5 — GEGENPROBE: jede Manipulation macht GENAU ihren Nachweis rot. Reversibel: gearbeitet wird
# an Kopien und eigenen Datenbanken; die echte Sicherung wird vorher und nachher gehasht.
# ------------------------------------------------------------------------------------------------
schritt_gegenprobe() {
  local dump=""
  dump="$(neueste_sicherung "$ARBEIT/sicherungen/laufend")"
  if [ -z "$dump" ]; then
    echo "[b3] AUFBAUFEHLER: keine Sicherung gefunden (Schritt 'sichern' zuerst)." >&2
    return 2
  fi
  werkzeug_sicherstellen || return $?
  local sha_vorher="" sha_nachher="" ordner="" ergebnis=0 code=""
  local g1="" g2="" g3=""
  sha_vorher="$(pruefsumme "$dump")"
  ordner="$ARBEIT/gegenprobe-${LAUF}"
  mkdir -p "$ordner/pruefsumme" "$ordner/ohne-tabelle"

  # G1 — veraenderte Pruefsumme: ein Byte der KOPIE kippt. Erwartet: 11, pg_restore nie gestartet.
  local kopie="$ordner/pruefsumme/$(basename "$dump")"
  cp "$dump" "$kopie"
  cp "$dump.sha256" "$kopie.sha256"
  printf '\377' | dd of="$kopie" bs=1 seek=64 conv=notrunc 2>/dev/null
  [ "$(pruefsumme "$kopie")" != "$sha_vorher" ] ||
    printf '\000' | dd of="$kopie" bs=1 seek=64 conv=notrunc 2>/dev/null
  local ziel1="klarwerk_gegenprobe_a_${LAUF_KLEIN}"
  code=0
  drill_fahren "$kopie" "$ziel1" "$(beleg gegenprobe-pruefsumme.log)" || code=$?
  local angelegt=nein
  db_existiert "$ziel1" && angelegt=ja
  g1="{\"fall\": \"veraenderte Pruefsumme\", \"erwartet\": 11, \"gemessen\": $code, \"zieldatenbank_angelegt\": $(json "$angelegt")}"
  if [ "$code" -ne 11 ] || [ "$angelegt" = ja ]; then
    ergebnis=150
  fi
  db_entfernen "$ziel1"

  # G2 — fehlende Tabelle: die Sicherung in eine eigene Quelle einspielen, ko_evidence entfernen,
  # mit dem UNVERAENDERTEN backup.sh sichern, Drill. Erwartet: 22 mit dem Tabellennamen.
  local quelle="klarwerk_gegenprobe_q_${LAUF_KLEIN}"
  local ziel2="klarwerk_gegenprobe_b_${LAUF_KLEIN}"
  db_entfernen "$quelle"
  psql_db "CREATE DATABASE $quelle" postgres >/dev/null
  code=0
  if compose exec -T db pg_restore --no-owner --no-privileges -U "$DB_KONTO" -d "$quelle" <"$dump" &&
    psql_db "DROP TABLE ko_evidence CASCADE" "$quelle" >/dev/null &&
    sichern_in "$ordner/ohne-tabelle" 1 "$quelle" >"$(beleg gegenprobe-ohne-tabelle-sicherung.log)" 2>&1; then
    drill_fahren "$(neueste_sicherung "$ordner/ohne-tabelle")" "$ziel2" "$(beleg gegenprobe-ohne-tabelle.log)" || code=$?
  else
    code=-1
  fi
  local nennt=nein
  grep -q 'ABBRUCH (22).*ko_evidence' "$(beleg gegenprobe-ohne-tabelle.log)" 2>/dev/null && nennt=ja
  g2="{\"fall\": \"fehlende Tabelle ko_evidence\", \"erwartet\": 22, \"gemessen\": $code, \"nennt_tabelle\": $(json "$nennt")}"
  if [ "$code" -ne 22 ] || [ "$nennt" != ja ]; then
    ergebnis=150
  fi
  db_entfernen "$quelle"
  db_entfernen "$ziel2"

  # G3 — ausgelassener echter Datenbank-Neustart. Erwartet: 130.
  code=0
  (NEUSTART_AUSLASSEN=1 schritt_neustart) >"$(beleg gegenprobe-neustart.log)" 2>&1 || code=$?
  g3="{\"fall\": \"ausgelassener Datenbank-Neustart\", \"erwartet\": 130, \"gemessen\": $code}"
  [ "$code" -eq 130 ] || ergebnis=150

  # G4/G5 — Instanzbindung (R-0811): dieselbe Sicherung mit dem Herkunftsnachweis einer FREMDEN
  # Instanz, und ohne jeden Nachweis. Erwartet: beide 161, und es entsteht keine Zieldatenbank.
  local g4="" g5="" fremd="$ordner/fremde-instanz" ohne="$ordner/ohne-herkunft"
  mkdir -p "$fremd" "$ohne"
  cp "$dump" "$dump.sha256" "$fremd/"
  sed 's/"instanz_id": "[^"]*"/"instanz_id": "klarwerk-instanz-fremd"/' "$(herkunft_datei "$dump")" \
    >"$(herkunft_datei "$fremd/$(basename "$dump")")"
  cp "$dump" "$dump.sha256" "$ohne/"
  code=0
  (BELEGE="$fremd" schritt_wiederherstellen "$fremd/$(basename "$dump")") >"$(beleg gegenprobe-fremde-instanz.log)" 2>&1 || code=$?
  angelegt=nein
  db_existiert "klarwerk_drill_${LAUF_KLEIN}" && angelegt=ja
  g4="{\"fall\": \"Sicherung einer fremden Instanz\", \"erwartet\": 161, \"gemessen\": $code, \"zieldatenbank_angelegt\": $(json "$angelegt")}"
  { [ "$code" -eq 161 ] && [ "$angelegt" = nein ]; } || ergebnis=150
  code=0
  (BELEGE="$ohne" schritt_wiederherstellen "$ohne/$(basename "$dump")") >"$(beleg gegenprobe-ohne-herkunft.log)" 2>&1 || code=$?
  g5="{\"fall\": \"Sicherung ohne Herkunftsnachweis\", \"erwartet\": 161, \"gemessen\": $code}"
  [ "$code" -eq 161 ] || ergebnis=150

  sha_nachher="$(pruefsumme "$dump")"
  [ "$sha_vorher" = "$sha_nachher" ] || ergebnis=150
  {
    printf '{%s,\n' "$(kopf_json gegenprobe)"
    printf ' "echte_sicherung": %s, "sha256_vorher": %s, "sha256_nachher": %s,\n' \
      "$(json "$(basename "$dump")")" "$(json "$sha_vorher")" "$(json "$sha_nachher")"
    printf ' "faelle": [%s, %s, %s, %s, %s],\n "exit": %s}\n' "$g1" "$g2" "$g3" "$g4" "$g5" "$ergebnis"
  } >"$(beleg gegenprobe.json)"
  echo "[b3] Gegenprobe: $g1"
  echo "[b3] Gegenprobe: $g2"
  echo "[b3] Gegenprobe: $g3"
  echo "[b3] Gegenprobe: $g4"
  echo "[b3] Gegenprobe: $g5"
  echo "[b3] Gegenprobe: echte Sicherung unveraendert: $([ "$sha_vorher" = "$sha_nachher" ] && echo ja || echo NEIN) -> $ergebnis"
  return "$ergebnis"
}

# ------------------------------------------------------------------------------------------------
# K4 — RUECKWEG: zwei absichtlich fehlschlagende Aktualisierungen
# ------------------------------------------------------------------------------------------------
schritt_rueckweg() {
  local ergebnis=0 c1=0 c2=0
  (STOERUNG=kaputtes-abbild schritt_aktualisieren) || c1=$?
  (STOERUNG=fehlende-variable schritt_aktualisieren) || c2=$?
  [ "$c1" -eq 122 ] || ergebnis=150
  [ "$c2" -eq 121 ] || ergebnis=150
  # Und danach: der Bestand ist unveraendert, die Instanz gesund.
  local vcode=0
  vergleiche_gegen http://app:3001 nach-rueckweg || vcode=$?
  [ "$vcode" -eq 0 ] || ergebnis=150
  {
    printf '{%s,\n' "$(kopf_json rueckweg)"
    printf ' "kaputtes_abbild": {"erwartet": 122, "gemessen": %s},\n' "$c1"
    printf ' "fehlende_variable": {"erwartet": 121, "gemessen": %s},\n' "$c2"
    printf ' "bestand_danach": %s, "exit": %s}\n' "$(json "$VERGLEICH_ERGEBNIS")" "$ergebnis"
  } >"$(beleg rueckweg.json)"
  echo "[b3] Rueckweg: kaputtes Abbild $c1 (erwartet 122), fehlende Variable $c2 (erwartet 121), Bestand $VERGLEICH_ERGEBNIS -> $ergebnis"
  return "$ergebnis"
}


# ------------------------------------------------------------------------------------------------
# SICHERUNG — der taegliche Weg: EINE Sicherung mit Herkunftsnachweis (R-0850, R-0811)
# ------------------------------------------------------------------------------------------------
schritt_sicherung() {
  local ziel="${SICHERUNGSZIEL:-$ARBEIT/sicherungen/taeglich}"
  local keep="${BACKUP_KEEP:-14}"
  local code=0
  compose_dateien_pruefen || return 1
  sichern_in "$ziel" "$keep" || code=$?
  if [ "$code" -ne 0 ] || [ -z "$SICHERUNG_DATEI" ]; then
    echo "[b3] ABBRUCH (100): backup.sh endete mit $code." >&2
    return 100
  fi
  if [ ! -f "$(herkunft_datei "$SICHERUNG_DATEI")" ]; then
    echo "[b3] ABBRUCH (100): kein Herkunftsnachweis zu $SICHERUNG_DATEI." >&2
    return 100
  fi
  printf '{%s, "datei": %s, "bytes": %s, "sha256": %s, "herkunft": %s, "backup_keep": %s, "exit": 0}\n' \
    "$(kopf_json sicherung)" "$(json "$(basename "$SICHERUNG_DATEI")")" \
    "$(wc -c <"$SICHERUNG_DATEI" | tr -d ' ')" "$(json "$(pruefsumme "$SICHERUNG_DATEI")")" \
    "$(tr -d '\n' <"$(herkunft_datei "$SICHERUNG_DATEI")")" "$keep" >"$(beleg sicherung.json)"
  echo "[b3] Sicherung: $SICHERUNG_DATEI mit Herkunftsnachweis (Instanz $(instanz_id))."
}

# ------------------------------------------------------------------------------------------------
# AUSLAGERN — R-0839: verschluesselt an einen zweiten Ort, gestaffelt, und NACHGEPRUEFT
# ------------------------------------------------------------------------------------------------
#
# Paket = Dump + Pruefsumme + Herkunftsnachweis (ein Dump deckt Wissensobjekte, Anhaenge in
# `objects` und Pruefspur `audit` gemeinsam ab), als tar, verschluesselt mit AES-256 (openssl enc,
# PBKDF2). Stufen: tage/ (jede Sicherung), wochen/ (erste der ISO-Woche), monate/ (erste des Monats),
# je mit eigener Aufbewahrung. Danach wird die Zweitkopie ENTSCHLUESSELT und ihr Dump gegen die
# Pruefsumme gehalten — eine Kopie, die niemand zuruecklesen kann, ist keine.
#
# Der SCHLUESSEL liegt nie am zweiten Ort. Fehlt er, wird er einmal erzeugt; er muss dann getrennt
# verwahrt werden (Passwort-Manager) — ohne ihn ist jede Zweitkopie wertlos.
stufe_aufraeumen() { # <ordner> <behalten>
  local ordner="$1"
  local behalten="$2"
  local anzahl="" weg="" f=""
  anzahl="$(find "$ordner" -maxdepth 1 -name '*.tar.enc' -type f | wc -l | tr -d ' ')"
  weg=$((anzahl - behalten))
  [ "$weg" -gt 0 ] || return 0
  for f in $(find "$ordner" -maxdepth 1 -name '*.tar.enc' -type f | LC_ALL=C sort | head -n "$weg"); do
    rm -f "$f" "$f.sha256"
  done
}

periodenkopie_gueltig() { # <stufenordner> <zeitraum> — eine Kopie des Zeitraums, deren Sidecar sie nennt und passt
  local f=""
  for f in "$1/$2--"*.tar.enc; do
    [ -f "$f" ] && [ -f "$f.sha256" ] || continue
    if [ "$(awk '{print $2}' "$f.sha256")" = "$(basename "$f")" ] &&
      [ "$(awk '{print $1}' "$f.sha256")" = "$(pruefsumme "$f")" ]; then
      return 0
    fi
  done
  return 1
}

periodenkopie_abwarten() { # <stufenordner> <zeitraum> — ein gleichzeitiger Lauf haelt die Reservierung
  local rest="${AUSLAGERUNG_WARTEN:-60}"
  while ! periodenkopie_gueltig "$1" "$2"; do
    [ "$rest" -gt 0 ] || return 1
    sleep 1
    rest=$((rest - 1))
  done
}

schritt_auslagern() {
  local quelle="${SICHERUNGSZIEL:-$ARBEIT/sicherungen/taeglich}"
  local ort="${ZWEITER_ORT:-}"
  local schluessel="${AUSLAGERUNG_SCHLUESSEL:-$ARBEIT/geheim/auslagerung.schluessel}"
  local dump="" paket="" name="" enc="" woche="" monat="" pruef="" ergebnis=0 grund="" neu_schluessel=nein
  case "$ort" in
    /*) ;;
    *)
      echo "[b3] ABBRUCH: ZWEITER_ORT muss ein absoluter Pfad sein (eingehaengter zweiter Speicher)." >&2
      return 1
      ;;
  esac
  case "$ort/" in
    "$STACK"/* | "$ARBEIT"/*)
      echo "[b3] ABBRUCH: ZWEITER_ORT liegt in der Instanz oder im Arbeitsordner — das ist kein zweiter Ort." >&2
      return 1
      ;;
  esac
  command -v openssl >/dev/null 2>&1 || {
    echo "[b3] ABBRUCH: openssl fehlt." >&2
    return 1
  }
  # Ausgelagert wird die Sicherung DIESES Laufs (von `taeglich` uebergeben), sonst die juengste.
  # Zwei gleichzeitige `taeglich` lagerten vorher beide „die juengste" aus — dieselbe Datei, zweimal.
  dump="${1:-$(neueste_sicherung "$quelle")}"
  if [ -z "$dump" ] || [ ! -f "$dump" ]; then
    echo "[b3] AUFBAUFEHLER: keine Sicherung in $quelle." >&2
    return 2
  fi
  if [ "$(awk '{print $1}' "$dump.sha256" 2>/dev/null)" != "$(pruefsumme "$dump")" ]; then
    echo "[b3] ABBRUCH (170): $dump passt nicht zu seiner Pruefsumme — es wird nichts ausgelagert." >&2
    return 170
  fi
  if [ ! -s "$schluessel" ]; then
    neu_schluessel=ja
    echo "[b3] HINWEIS: Schluessel wird erzeugt ($schluessel) — JETZT getrennt verwahren (Passwort-Manager)."
  fi
  einmal_veroeffentlichen "$schluessel" "$(zufall_hex 48)" || return 170
  mkdir -p "$ort/tage" "$ort/wochen" "$ort/monate" || return 170
  paket="$(mktemp -d)"
  cp "$dump" "$dump.sha256" "$paket/"
  [ ! -f "$(herkunft_datei "$dump")" ] || cp "$(herkunft_datei "$dump")" "$paket/"
  name="$(basename "$dump").tar.enc"
  enc="$ort/tage/$name"
  if ! (cd "$paket" && tar -cf - .) |
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$schluessel" -out "$enc.teil.$$"; then
    rm -rf "$paket" "$enc.teil.$$"
    echo "[b3] ABBRUCH (170): Verschluesselung gescheitert." >&2
    return 170
  fi
  mv "$enc.teil.$$" "$enc"
  local enc_sha="" neue=("$enc") f=""
  enc_sha="$(pruefsumme "$enc")"
  printf '%s  %s\n' "$enc_sha" "$name" >"$enc.sha256"
  woche="$(date -u +%G-W%V)"
  monat="$(date -u +%Y-%m)"
  # Die erste Sicherung eines Zeitraums wird Wochen- bzw. Monatskopie. Wer den Zeitraum bekommt,
  # entscheidet ein `mkdir` (atomar) — zwei gleichzeitige Laeufe legen nie zwei Kopien an. JEDE
  # Kopie wird geprueft; ein gescheitertes `cp` ist ein Fehler dieses Laufs (Befund R2-3), und der
  # Sidecar nennt den TATSAECHLICHEN Dateinamen seiner Stufe (Befund R2-4).
  #
  # BEFUND R3-1: Die Reservierung allein galt als „Zeitraum erledigt". Scheiterte die Kopie, blieb
  # `.2026-W39.belegt` liegen, und JEDER spaetere Lauf derselben Woche meldete Exit 0 ohne eine
  # einzige Wochenkopie. Seither gilt: erledigt ist ein Zeitraum nur, wenn eine GUELTIGE Kopie samt
  # passendem Sidecar dort liegt (`periodenkopie_gueltig`). Ein gescheiterter Lauf gibt seine
  # Reservierung wieder frei (der naechste Lauf holt die Kopie nach). Steht eine Reservierung ohne
  # gueltige Kopie da, wartet der Lauf auf den anderen (AUSLAGERUNG_WARTEN Sekunden, Vorgabe 60)
  # und ist danach ROT — eine Reservierung wird nie geraten und nie weggeraeumt.
  for f in "wochen/$woche" "monate/$monat"; do
    local stufe="${f%%/*}" zeitraum="${f#*/}"
    local marke="$ort/$stufe/.$zeitraum.belegt"
    if periodenkopie_gueltig "$ort/$stufe" "$zeitraum"; then
      continue
    fi
    if ! mkdir "$marke" 2>/dev/null; then
      # Nur ein SCHON belegter Zeitraum ist ein Grund, keine Kopie anzulegen — jeder andere
      # Fehlschlag von mkdir (Rechte, voller Speicher) ist ein Fehler dieses Laufs.
      if [ ! -d "$marke" ]; then
        grund="${grund:+$grund; }Zeitraum ${f} in $stufe/ nicht belegbar"
        ergebnis=170
      elif ! periodenkopie_abwarten "$ort/$stufe" "$zeitraum"; then
        grund="${grund:+$grund; }Zeitraum ${f} ist reserviert ($marke), aber in $stufe/ liegt keine gueltige Kopie"
        ergebnis=170
      fi
    else
      local ziel="$ort/$stufe/$zeitraum--$name"
      if cp "$enc" "$ziel.teil.$$" && mv "$ziel.teil.$$" "$ziel" &&
        printf '%s  %s\n' "$enc_sha" "$(basename "$ziel")" >"$ziel.sha256"; then
        neue+=("$ziel")
      else
        rm -f "$ziel.teil.$$" "$ziel" "$ziel.sha256"
        rmdir "$marke" 2>/dev/null || true
        grund="${grund:+$grund; }Kopie nach $stufe/ gescheitert"
        ergebnis=170
      fi
    fi
  done
  stufe_aufraeumen "$ort/tage" "${AUSLAGERUNG_TAGE:-14}"
  stufe_aufraeumen "$ort/wochen" "${AUSLAGERUNG_WOCHEN:-8}"
  stufe_aufraeumen "$ort/monate" "${AUSLAGERUNG_MONATE:-12}"

  # Nachpruefung: die Zweitkopie entschluesseln und ihren Dump gegen die Pruefsumme halten.
  rm -rf "$paket"
  pruef="$(mktemp -d)"
  if openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$schluessel" -in "$enc" |
    (cd "$pruef" && tar -xf -) &&
    [ "$(pruefsumme "$pruef/$(basename "$dump")")" = "$(awk '{print $1}' "$pruef/$(basename "$dump").sha256")" ] &&
    [ "$(pruefsumme "$pruef/$(basename "$dump")")" = "$(pruefsumme "$dump")" ]; then
    :
  else
    grund="${grund:+$grund; }die Zweitkopie liess sich nicht entschluesseln oder ihr Dump passt nicht"
    ergebnis=170
  fi
  rm -rf "$pruef"
  # Jede in diesem Lauf erzeugte Kopie: vorhanden, gleich der entschluesselt geprueften, und ihr
  # Sidecar nennt genau sie und passt (entspricht `sha256sum -c` im Ordner der Stufe).
  for f in "${neue[@]}"; do
    if [ ! -f "$f" ] || [ "$(pruefsumme "$f")" != "$enc_sha" ] ||
      [ "$(awk '{print $2}' "$f.sha256" 2>/dev/null)" != "$(basename "$f")" ] ||
      [ "$(awk '{print $1}' "$f.sha256" 2>/dev/null)" != "$enc_sha" ]; then
      grund="${grund:+$grund; }$(basename "$(dirname "$f")")/$(basename "$f") fehlt oder passt nicht zu seinem Sidecar"
      ergebnis=170
    fi
  done
  {
    printf '{%s,\n' "$(kopf_json auslagern)"
    printf ' "zweiter_ort": %s, "datei": %s, "sha256_verschluesselt": %s, "verfahren": "tar + openssl enc aes-256-cbc pbkdf2 iter 200000",\n' \
      "$(json "$ort")" "$(json "$name")" "$(json "$(pruefsumme "$enc")")"
    printf ' "schluessel_neu_erzeugt": %s, "stufen": {"tage": %s, "wochen": %s, "monate": %s},\n' "$(json "$neu_schluessel")" \
      "$(find "$ort/tage" -name '*.tar.enc' | wc -l | tr -d ' ')" "$(find "$ort/wochen" -name '*.tar.enc' | wc -l | tr -d ' ')" \
      "$(find "$ort/monate" -name '*.tar.enc' | wc -l | tr -d ' ')"
    printf ' "nachgeprueft": %s, "grund": %s, "exit": %s}\n' "$(json "$([ "$ergebnis" -eq 0 ] && echo ja || echo nein)")" "$(json "$grund")" "$ergebnis"
  } >"$(beleg auslagern.json)"
  echo "[b3] Auslagern: $name nach $ort (tage/wochen/monate), nachgeprueft: $([ "$ergebnis" -eq 0 ] && echo ja || echo NEIN)"
  return "$ergebnis"
}

schritt_taeglich() {
  schritt_sicherung || return $?
  schritt_auslagern "$SICHERUNG_DATEI"
}

# ------------------------------------------------------------------------------------------------
# ZURUECKSPIELEN — der Ernstfall (Befund B1): jeder Schritt geprueft, der alte Bestand bleibt
# ------------------------------------------------------------------------------------------------
#
# Reihenfolge: Bestaetigung → Pruefsumme (160) → Instanzbindung (161) → App anhalten → alten Bestand
# UMBENENNEN (nie loeschen) → leeres Ziel anlegen → Leere FESTSTELLEN → pg_restore mit
# --exit-on-error → App starten und gesund → Inhalt und Bestand vergleichen. Scheitert irgendein
# Schritt, wird das neue Ziel verworfen, der alte Bestand zurueckbenannt und die App wieder
# gestartet (162); gelingt nicht einmal das, ist es 163. Die Ausfallzeit wird gemessen (RTO), das
# Alter des eingespielten Stands ebenso (RPO); RTO_ZIEL_SEKUNDEN / RPO_ZIEL_SEKUNDEN pruefen sie (164).
schritt_zurueckspielen() {
  local dump="${1:-$(neueste_sicherung "${SICHERUNGSZIEL:-$ARBEIT/sicherungen/taeglich}")}"
  local alt="${DB_NAME}_vor_${LAUF_KLEIN}"
  local ergebnis=0 grund="" rueckweg="nicht noetig" umbenannt=nein t0=0 t1=0 n="" soll="" ist=""
  local inhalt_vorher="" inhalt_nachher="" alter="" stand_zeit=""
  if [ "${ZURUECKSPIELEN_BESTAETIGT:-}" != "$DB_NAME" ]; then
    echo "[b3] ABBRUCH: zurueckspielen ersetzt $DB_NAME. Nur mit ZURUECKSPIELEN_BESTAETIGT=$DB_NAME." >&2
    return 1
  fi
  if [ -z "$dump" ] || [ ! -f "$dump" ]; then
    echo "[b3] AUFBAUFEHLER: keine Sicherung gefunden." >&2
    return 2
  fi
  compose_dateien_pruefen || return 1
  soll="$(awk '{print $1}' "$dump.sha256" 2>/dev/null || true)"
  ist="$(pruefsumme "$dump")"
  if ! [[ "$soll" =~ ^[0-9a-f]{64}$ ]] || [ "$soll" != "$ist" ]; then
    echo "[b3] ABBRUCH (160): Pruefsumme fehlt oder passt nicht — $DB_NAME wird NICHT angefasst." >&2
    return 160
  fi
  if ! bindung_pruefen "$dump"; then
    echo "[b3] ABBRUCH (161): $GRUND — $DB_NAME wird NICHT angefasst." >&2
    return 161
  fi
  if db_existiert "$alt"; then
    echo "[b3] ABBRUCH (162): der Sicherungsname $alt ist schon vergeben — nichts angefasst." >&2
    return 162
  fi
  inhalt_vorher="$(inhalt_pruefsumme || true)"
  t0="$(date +%s)"

  if ! compose stop app; then
    grund="die Anwendung liess sich nicht anhalten"
    ergebnis=162
  fi
  if [ "$ergebnis" -eq 0 ]; then
    psql_db "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid()" postgres >/dev/null 2>&1 || true
    if psql_db "ALTER DATABASE \"$DB_NAME\" RENAME TO \"$alt\"" postgres >/dev/null; then
      umbenannt=ja
    else
      grund="Umbenennen von $DB_NAME nach $alt gescheitert"
      ergebnis=162
    fi
  fi
  if [ "$ergebnis" -eq 0 ] && ! psql_db "CREATE DATABASE \"$DB_NAME\"" postgres >/dev/null; then
    grund="leere Datenbank $DB_NAME liess sich nicht anlegen"
    ergebnis=162
  fi
  if [ "$ergebnis" -eq 0 ]; then
    n="$(psql_db "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo fehler)"
    if [ "$n" != "0" ]; then
      grund="das Ziel $DB_NAME ist nicht nachweislich leer ($n)"
      ergebnis=162
    fi
  fi
  if [ "$ergebnis" -eq 0 ] &&
    ! compose exec -T db pg_restore --no-owner --no-privileges --exit-on-error -U "$DB_KONTO" -d "$DB_NAME" <"$dump"; then
    grund="pg_restore gescheitert"
    ergebnis=162
  fi
  if [ "$ergebnis" -eq 0 ]; then
    if ! compose up -d --no-deps app || ! warte_gesund "$(container_von app)" "$WARTEN_GESUND"; then
      grund="die Anwendung ist auf dem zurueckgespielten Bestand nicht gesund: ${GRUND:-up gescheitert}"
      ergebnis=162
    fi
  fi

  if [ "$ergebnis" -ne 0 ]; then
    if [ "$umbenannt" = ja ]; then
      compose stop app >/dev/null 2>&1 || true
      if psql_db "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" postgres >/dev/null &&
        psql_db "ALTER DATABASE \"$alt\" RENAME TO \"$DB_NAME\"" postgres >/dev/null; then
        rueckweg="vorheriger Bestand wieder als $DB_NAME eingesetzt"
      else
        rueckweg="VORHERIGER BESTAND NICHT WIEDER EINGESETZT — er liegt als $alt"
        ergebnis=163
      fi
    else
      rueckweg="vorheriger Bestand unberuehrt"
    fi
    # Der Rueckweg ist erst gelungen, wenn der vorherige Stand wieder LAEUFT (Befund R2-5): ein
    # gescheitertes `up` oder eine kranke App ist ein gescheiterter Wiederanlauf — 163, mit Grund.
    if ! compose up -d --no-deps app; then
      rueckweg="$rueckweg; WIEDERANLAUF GESCHEITERT: docker compose up fuer app ist gescheitert"
      ergebnis=163
    elif ! warte_gesund "$(container_von app)" "$WARTEN_GESUND"; then
      rueckweg="$rueckweg; WIEDERANLAUF GESCHEITERT: $GRUND"
      ergebnis=163
    fi
  fi
  t1="$(date +%s)"

  if [ "$ergebnis" -eq 0 ]; then
    if ! inhalt_nachher="$(inhalt_pruefsumme)"; then
      grund="Inhaltsmessung nach dem Zurueckspielen gescheitert"
      ergebnis=111
    else
      local vcode=0
      vergleiche_gegen http://app:3001 zurueckspielen || vcode=$?
      if [ "$vcode" -ne 0 ]; then
        grund="Bestand nach dem Zurueckspielen nicht wie gesichert lesbar"
        ergebnis=110
      fi
    fi
  fi
  stand_zeit="$(feld "$(herkunft_datei "$dump")" zeit)"
  local epoche=""
  if [ -n "$stand_zeit" ] && epoche="$(stand_epoche "$stand_zeit" 2>/dev/null)" && [[ "$epoche" =~ ^[0-9]+$ ]]; then
    alter=$(($(date -u +%s) - epoche))
  fi
  if [ "$ergebnis" -eq 0 ]; then
    if [ -n "${RTO_ZIEL_SEKUNDEN:-}" ] && [ $((t1 - t0)) -gt "$RTO_ZIEL_SEKUNDEN" ]; then
      grund="Ausfallzeit $((t1 - t0)) s ueber dem Ziel ${RTO_ZIEL_SEKUNDEN} s"
      ergebnis=164
    elif [ -n "${RPO_ZIEL_SEKUNDEN:-}" ] && { [ -z "$alter" ] || [ "$alter" -gt "$RPO_ZIEL_SEKUNDEN" ]; }; then
      grund="Alter des eingespielten Stands ${alter:-unbekannt} s ueber dem Ziel ${RPO_ZIEL_SEKUNDEN} s"
      ergebnis=164
    fi
  fi
  {
    printf '{%s,\n' "$(kopf_json zurueckspielen)"
    printf ' "dump": %s, "sha256": %s, "instanz_id": %s, "vorheriger_bestand": %s,\n' \
      "$(json "$(basename "$dump")")" "$(json "$ist")" "$(json "$(instanz_id)")" "$(json "$alt")"
    printf ' "ausfall_sekunden": %s, "stand_alter_sekunden": %s, "rto_ziel_sekunden": %s, "rpo_ziel_sekunden": %s,\n' \
      "$((t1 - t0))" "${alter:-null}" "${RTO_ZIEL_SEKUNDEN:-null}" "${RPO_ZIEL_SEKUNDEN:-null}"
    printf ' "inhalt_vorher": %s, "inhalt_nachher": %s, "vergleich": %s,\n' \
      "$(json "$inhalt_vorher")" "$(json "$inhalt_nachher")" "$(json "${VERGLEICH_ERGEBNIS:-nicht gelaufen}")"
    printf ' "rueckweg": %s, "grund": %s, "exit": %s}\n' "$(json "$rueckweg")" "$(json "$grund")" "$ergebnis"
  } >"$(beleg zurueckspielen.json)"
  if [ "$ergebnis" -eq 0 ]; then
    echo "[b3] Zurueckgespielt: $(basename "$dump") -> $DB_NAME in $((t1 - t0)) s; vorheriger Bestand liegt als $alt."
  else
    echo "[b3] Zurueckspielen endet mit $ergebnis — $grund — $rueckweg" >&2
  fi
  return "$ergebnis"
}

stand_epoche() { # 2026-09-25T08:00:00Z -> Sekunden seit 1970 (GNU date oder BSD date)
  date -u -d "$1" +%s 2>/dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s
}

# ------------------------------------------------------------------------------------------------
# ABLAUF — alles in der Reihenfolge der Anleitung; jeder Schritt mit eigenem Protokoll
# ------------------------------------------------------------------------------------------------
ABLAUF_JSON=""
ABLAUF_ERGEBNIS=0
fahre() { # <name> <funktion> [argumente]
  local name="$1"
  shift
  local code=0 t0="" t1=""
  t0="$(date +%s)"
  echo "[b3] ===== $name ====="
  set +e
  (
    set -e
    "$@"
  ) 2>&1 | tee "$(beleg "$name.log")"
  code=${PIPESTATUS[0]}
  set -e
  t1="$(date +%s)"
  ABLAUF_JSON="${ABLAUF_JSON}${ABLAUF_JSON:+, }{\"schritt\": $(json "$name"), \"exit\": $code, \"sekunden\": $((t1 - t0))}"
  if [ "$code" -ne 0 ] && [ "$ABLAUF_ERGEBNIS" -eq 0 ]; then
    ABLAUF_ERGEBNIS="$code"
  fi
  return "$code"
}

schritt_ablauf() {
  local quelle="${1:-$WURZEL}"
  local stand_start=""
  stand_start="$(stand_von "$STACK")"
  # Ohne Bestand traegt nichts danach, ohne Sicherung keine Wiederherstellung — dort wird
  # angehalten. Jeder andere rote Schritt wird protokolliert, und der Ablauf geht weiter: ein
  # roter Neustart soll nicht verdecken, ob die Wiederherstellung traegt.
  if fahre bestand schritt_bestand; then
    fahre aktualisieren schritt_aktualisieren "$quelle" || true
    fahre neustart schritt_neustart || true
    if fahre sichern schritt_sichern; then
      fahre wiederherstellen schritt_wiederherstellen || true
      fahre pruefen schritt_pruefen || true
      fahre gegenprobe schritt_gegenprobe || true
      # Der Ernstfall am Pruefplatz: die juengste Sicherung in klarwerk_prod zurueckspielen.
      # Ohne ausdrueckliche Bestaetigung ist das ein ROTER Schritt, kein stilles Auslassen.
      fahre zurueckspielen schritt_zurueckspielen "$(neueste_sicherung "$ARBEIT/sicherungen/laufend")" || true
    fi
    # Der taegliche Weg (Sicherung mit Herkunft + verschluesselte Zweitkopie); ZWEITER_ORT ist Pflicht.
    fahre taeglich schritt_taeglich || true
    fahre rueckweg schritt_rueckweg || true
  fi
  {
    printf '{%s,\n' "$(kopf_json ablauf)"
    printf ' "instanz_stand_zu_beginn": %s, "quelle": %s,\n' "$(json "$stand_start")" "$(json "$quelle")"
    printf ' "schritte": [%s],\n "exit": %s}\n' "$ABLAUF_JSON" "$ABLAUF_ERGEBNIS"
  } >"$(beleg ablauf.json)"
  echo "[b3] ABLAUF beendet: exit $ABLAUF_ERGEBNIS — Belege unter $BELEGE/b3-${LAUF}-*"
  return "$ABLAUF_ERGEBNIS"
}

case "$SCHRITT" in
  werkzeug) schritt_werkzeug ;;
  bestand) schritt_bestand ;;
  vergleichen) schritt_vergleichen "$ARGUMENT" ;;
  sichern) schritt_sichern ;;
  wiederherstellen) schritt_wiederherstellen "$ARGUMENT" ;;
  aktualisieren) schritt_aktualisieren "$ARGUMENT" ;;
  neustart) schritt_neustart ;;
  pruefen) schritt_pruefen ;;
  gegenprobe) schritt_gegenprobe ;;
  rueckweg) schritt_rueckweg ;;
  sicherung) schritt_sicherung ;;
  auslagern) schritt_auslagern "$ARGUMENT" ;;
  taeglich) schritt_taeglich ;;
  zurueckspielen) schritt_zurueckspielen "$ARGUMENT" ;;
  ablauf) schritt_ablauf "$ARGUMENT" ;;
  *)
    echo "[b3] Nutzung: PROJEKT=<projekt> STACK=<ordner> bash scripts/backup/compose-drill.sh" >&2
    echo "[b3]   werkzeug|bestand|vergleichen|sichern|wiederherstellen|aktualisieren|neustart|pruefen|gegenprobe|rueckweg|sicherung|auslagern|taeglich|zurueckspielen|ablauf" >&2
    exit 1
    ;;
esac
