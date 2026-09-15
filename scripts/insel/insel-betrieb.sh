#!/usr/bin/env bash
# ================================================================================================
# JOB 4012 — DIE VIER HANDGRIFFE DES INSEL-BETRIEBS, an EINER Stelle.
# ================================================================================================
#
# Diese Datei wird GESOURCT (`update-einspielen.sh`, `rueckfall.sh`), nie gestartet. Sie enthält
# genau das, was beide Wege gemeinsam tun müssen: den alten Server beenden, den neuen starten, auf
# `/health` warten und die Version aus der Antwort lesen. Läge das zweimal da, liefe der Rückfall
# eines Tages anders als das Update — und ausgerechnet der Rückfall ist der Weg, den niemand übt.
#
# WARUM DIE GESUNDHEITSPROBE MIT `node` UND NICHT MIT `curl`: Die Insel liefert eine Node-Anwendung
# aus; ohne Node startet das Release gar nicht. `curl` dagegen ist auf einem abgeschotteten Rechner
# oder in einem schlanken Container nicht zugesagt. EIN Weg, der immer da ist, ist besser als zwei,
# von denen im Ernstfall der ungetestete läuft.
#
# cwd-unabhaengig: arbeitet ausschliesslich mit den absoluten Pfaden, die der Aufrufer übergibt.
#
# ZWEI KORREKTUREN AUS RUNDE 2 (Bens Gegenprobe BEN-R2-2 und Prüflücke 6) — beide betreffen die
# Frage, ob der Aufrufer WEISS, was hier geschehen ist:
#
#   STOPP   `insel_server_stoppen` gab in jedem Fall 0 zurück und sagte nichts. Im launchd-Fall hält
#           er den Server bewusst NICHT an (das wäre ein Kampf gegen KeepAlive) — der Aufrufer sah
#           aber keinen Unterschied zu „beendet" und konnte deshalb auch nicht sagen, dass er beim
#           Zurückspielen von Daten noch lief. Jeder Ausgang schreibt jetzt eine Zeile und legt seine
#           Antwort in `INSEL_STOPP_ANTWORT` ab: `beendet` · `kein-server` · `launchd-fuehrt`.
#   START   `launchctl kickstart` lief ungeprüft. Scheiterte er, beendete `set -e` den ganzen
#           Update-Weg an Ort und Stelle: `current` zeigte schon auf das neue Release, kein Rückfall,
#           keine Ergebniszeile — genau der Zustand, gegen den dieser Job gebaut ist. Der Rückgabewert
#           wird jetzt geprüft; `insel_server_starten` endet bei Fehler mit 1, und der Aufrufer führt
#           den Rückfall. Ein Startweg, der nicht scheitern KANN, braucht kein Netz — dieser kann.

# Was der letzte `insel_server_stoppen` getan hat. Vorbelegt, damit `set -u` beim Lesen vor dem
# ersten Aufruf nicht zuschlägt.
INSEL_STOPP_ANTWORT=""

# ------------------------------------------------------------------------------------------------
# EINE Gesundheitsabfrage. Gibt den Rumpf auf stdout aus und endet mit 0, wenn HTTP 2xx kam.
# ------------------------------------------------------------------------------------------------
insel_health_einmal() {
  node -e '
const url = process.argv[1];
fetch(url, { signal: AbortSignal.timeout(2000) })
  .then(async (antwort) => {
    const rumpf = await antwort.text();
    if (!antwort.ok) { process.exit(2); }
    process.stdout.write(rumpf);
  })
  .catch(() => process.exit(3));
' "$1"
}

# ------------------------------------------------------------------------------------------------
# Wartet bis zu <sekunden> auf eine grüne Gesundheitsantwort. Rumpf auf stdout, 0 bei Erfolg.
# ------------------------------------------------------------------------------------------------
insel_gesundheit_warten() {
  local url="$1" sekunden="$2" rumpf=""
  local versuch=0
  while [ "$versuch" -lt "$sekunden" ]; do
    if rumpf="$(insel_health_einmal "$url" 2>/dev/null)"; then
      printf '%s' "$rumpf"
      return 0
    fi
    versuch=$((versuch + 1))
    sleep 1
  done
  return 1
}

# ------------------------------------------------------------------------------------------------
# Ein Feld aus einer JSON-Antwort. Kein `jq` auf der Insel; `node` liegt ohnehin bereit.
# Ein fehlendes Feld ist eine leere Ausgabe — nie ein erfundener Wert.
# ------------------------------------------------------------------------------------------------
insel_json_feld() {
  local rumpf="$1" feld="$2"
  printf '%s' "$rumpf" | node -e '
let roh = "";
process.stdin.on("data", (d) => { roh += d; });
process.stdin.on("end", () => {
  try {
    const wert = JSON.parse(roh)[process.argv[1]];
    process.stdout.write(typeof wert === "string" ? wert : "");
  } catch {
    process.stdout.write("");
  }
});
' "$feld"
}

# ------------------------------------------------------------------------------------------------
# WER FÜHRT DEN SERVER — launchd oder wir?
#
# Auf dem Mac Studio kann ein launchd-Agent (`de.klarwerk.insel`) den Server halten; die
# AppleScript-Verknüpfung startet ihn so (`tools/studio/klarwerk-app-launcher.applescript:9`), und
# das alte `install.command` kannte diesen Fall ebenfalls. Seit `install.command` an
# `update-einspielen.sh` übergibt, MUSS ihn dieser Weg kennen: Würde hier blind die PID aus der
# Datei erschlagen, startete launchd den Server mit dem ALTEN Zeiger sofort neu (KeepAlive) — der
# Rückfall liefe ins Leere, und niemand sähe warum.
#
# Der Dienstname wird gemeldet, wenn ein Agent DIESES Labels wirklich geladen ist. Alles andere —
# kein `launchctl` (Linux-Prüfstand), Label unbekannt, Abfrage rot — heisst: wir führen ihn selbst.
# `KLARWERK_LAUNCHD_LABEL` setzt das Label; die Proben setzen es auf ein Label, das es nicht geben
# kann, damit ein Testlauf AUF der Insel niemals deren echten Serverdienst anfasst.
# ------------------------------------------------------------------------------------------------
insel_launchd_dienst() {
  local label="${KLARWERK_LAUNCHD_LABEL:-de.klarwerk.insel}"
  if ! command -v launchctl >/dev/null 2>&1; then
    return 1
  fi
  local dienst="gui/$(id -u)/$label"
  if ! launchctl print "$dienst" >/dev/null 2>&1; then
    return 1
  fi
  printf '%s' "$dienst"
}

# ------------------------------------------------------------------------------------------------
# Beendet den Server aus der PID-Datei — und NUR den. Die Antwort steht danach in
# `INSEL_STOPP_ANTWORT` und auf stdout; der Rückgabewert bleibt 0, denn keiner dieser drei Ausgänge
# ist ein Fehler. Wer sie unterscheiden muss (etwa das Zurückspielen von Daten), liest die Antwort.
#
# Erst SIGTERM und zehn Sekunden Geduld, damit das Journal sauber geschlossen wird. Erst danach
# SIGKILL: ein Server, der nicht geht, blockiert sonst den Port und damit den ganzen Rückfall.
# Eine PID, die nicht mehr lebt, ist kein Fehler — nur eine liegengebliebene Datei.
# ------------------------------------------------------------------------------------------------
insel_server_stoppen() {
  local pid_datei="$1" pid="" dienst=""
  INSEL_STOPP_ANTWORT=""
  if dienst="$(insel_launchd_dienst)"; then
    # launchd hält ihn. Der Wechsel geschieht in EINEM Griff beim Starten (`kickstart -k`); ein
    # Beenden hier wäre ein Kampf gegen KeepAlive und würde die alte Fassung wiederbeleben.
    # Das heisst aber auch: der alte Prozess LÄUFT hier noch, und das wird gesagt.
    INSEL_STOPP_ANTWORT="launchd-fuehrt"
    echo "[insel] launchd fuehrt den Server ($dienst) — hier NICHT angehalten; der Wechsel geschieht beim kickstart."
    return 0
  fi
  if [ ! -f "$pid_datei" ]; then
    INSEL_STOPP_ANTWORT="kein-server"
    echo "[insel] kein laufender Server vermerkt ($pid_datei fehlt) — nichts anzuhalten."
    return 0
  fi
  pid="$(tr -d '[:space:]' < "$pid_datei")"
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$pid_datei"
    INSEL_STOPP_ANTWORT="kein-server"
    echo "[insel] vermerkte PID ${pid:-(leer)} lebt nicht mehr — nichts anzuhalten."
    return 0
  fi
  kill -TERM "$pid" 2>/dev/null || true
  local versuch=0
  while [ "$versuch" -lt 20 ]; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    versuch=$((versuch + 1))
    sleep 0.5
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "[insel] Server $pid hat SIGTERM ueberlebt — SIGKILL." >&2
    kill -KILL "$pid" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$pid_datei"
  INSEL_STOPP_ANTWORT="beendet"
  echo "[insel] Server $pid beendet."
}

# ------------------------------------------------------------------------------------------------
# Startet den Startbefehl im Hintergrund und legt seine PID ab. Endet mit 1, wenn der Start gar nicht
# erst zustande kam — der Aufrufer führt dann den Rückfall.
#
# Der Startbefehl der Releases endet auf `exec` — die PID von `$!` ist damit der Serverprozess
# selbst und nicht eine Zwischenschale. Genau diese Verwechslung hat `restore-drill.sh` den
# offenen Startkonflikt (Exit 80) eingebracht; hier ist sie durch den `exec` im Release vermieden.
#
# WARUM DER RÜCKGABEWERT VON `launchctl` GEPRÜFT WIRD (Ben, Gegenprobe BEN-R2-2): Ein `kickstart`
# kann scheitern — der Agent ist entladen worden, die Sitzung gehört einem anderen Benutzer, das
# Label stimmt nicht mehr. Ungeprüft riss der Fehler unter `set -e` den ganzen Update-Weg mit, und
# zwar an der schlimmstmöglichen Stelle: `current` zeigte bereits auf das neue Release. Der Kunde
# blieb mit einer nicht laufenden App und ohne einen einzigen Satz zurück.
# ------------------------------------------------------------------------------------------------
insel_server_starten() {
  local start_befehl="$1" log="$2" pid_datei="$3" dienst="" code=0
  if dienst="$(insel_launchd_dienst)"; then
    # `kickstart -k` beendet den laufenden Prozess und startet ihn neu — mit dem Zeiger, der JETZT
    # steht. Genau dieser Griff stand schon im alten `install.command`.
    echo "[insel] launchd fuehrt den Server: kickstart $dienst"
    launchctl kickstart -k "$dienst" || code=$?
    if [ "$code" != "0" ]; then
      echo "[insel] launchctl kickstart $dienst endete mit $code — der Server ist NICHT gestartet." >&2
      return 1
    fi
    rm -f "$pid_datei"
    return 0
  fi
  nohup "$start_befehl" >>"$log" 2>&1 &
  local pid=$!
  printf '%s\n' "$pid" > "$pid_datei"
}
