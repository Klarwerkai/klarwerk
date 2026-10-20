# tools/pruefstufen.sh — das Stufenbuch des Gesamttors. Wird von tools/check EINGEBUNDEN
# (`source`), nicht allein ausgeführt; es setzt eine EXIT-Falle im einbindenden Prozess.
#
# aufnahme:20260922:gesamt-prueftor-einheitlich (R-1330, R-1405; Kriterien 1 und 3):
#   · Fällt das Tor, nennt es die Stufe, in der es gefallen ist, statt nur rot zu enden — dazu, was
#     gelaufen ist und was nicht mehr erreicht wurde.
#   · Der Stufenplan kommt aus tools/pruefvertrag.json, demselben Vertrag, den der CI-Job `check`
#     über ./tools/check fährt. Eine Stufe, die dort nicht steht, bricht ab (Code 3). Endet der Lauf
#     mit Code 0, ohne genau die Stufen des Vertrags in seiner Reihenfolge erreicht zu haben, wird er
#     ROT — ein Tor, das eine Stufe still verliert, meldet sonst weiter grün.
#   · GELAUFEN IST NICHT GEMESSEN (R-1405, Bens Befund zu nacharbeit-2): jede gelaufene Stufe trägt
#     ihren Messstatus — `gemessen`, `nicht-gemessen` (lief, prüfte aber nichts, z. B. zentrale-drift
#     mit Code 2 „Lesefläche nicht da“), `auswahl` (nur ein Teil, z. B. tools/test mit Dateifilter)
#     oder `meldend` (Stufe der Art „meldend“ im Vertrag: sie meldet, sperrt nie). Das Tor setzt den
#     Status mit `stufe_status <status> [Grund]`; ohne Angabe gilt `gemessen` bzw. `meldend`. Der
#     Bericht führt die Klassen getrennt — nichts davon erscheint mehr pauschal als „bestanden“.
#   · Das Ergebnis steht beim Startverzeichnis, der Wurzel und dem geprüften Quellstand: Commit und
#     Abweichungen des Baums davon, erhoben VOR der ersten Stufe (der Lauf selbst legt Dateien an).
#   · Was das Tor NICHT fährt, druckt tools/tor-bericht.mjs am Ende aus demselben Vertrag.
#
# Erwartet: PRUEF_START (das Startverzeichnis des Aufrufers, VOR dem `cd` des Tors gesetzt) und als
# Arbeitsverzeichnis die Wurzel.

PRUEF_WURZEL="$(pwd -P)"
PRUEF_START="${PRUEF_START:-$PRUEF_WURZEL}"
PRUEF_BERICHT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/tor-bericht.mjs"

PRUEF_PLAN=()
PRUEF_ARTEN=()
pruef_plan_roh="$(node "$PRUEF_BERICHT" --stufen)" || {
  echo "✖ Prüfvertrag nicht lesbar — das Tor läuft ohne Stufenplan nicht los."
  exit 2
}
while IFS=' ' read -r pruef_name pruef_art; do
  if [ -n "$pruef_name" ]; then
    PRUEF_PLAN+=("$pruef_name")
    PRUEF_ARTEN+=("${pruef_art:-sperrend}")
  fi
done <<< "$pruef_plan_roh"

PRUEF_GELAUFEN=()
PRUEF_GELAUFEN_STATUS=()
PRUEF_STUFE=""
PRUEF_STUFE_STATUS=""

pruef_quellstand() {
  local commit status abweichungen
  if ! commit="$(git -C "$PRUEF_WURZEL" rev-parse HEAD 2>/dev/null)"; then
    echo "unbekannt (kein git-Stand lesbar)"
    return 0
  fi
  status="$(git -C "$PRUEF_WURZEL" status --porcelain 2>/dev/null || true)"
  abweichungen="$(printf '%s' "$status" | grep -c . || true)"
  if [ "$abweichungen" = "0" ]; then
    echo "$commit (Baum gleich dem Commit)"
  else
    echo "$commit + $abweichungen geänderte oder neue, nicht ignorierte Dateien"
  fi
}
PRUEF_QUELLSTAND="$(pruef_quellstand)"

# Schliesst die laufende Stufe mit ihrem Messstatus ab.
pruef_abschliessen() {
  if [ -n "$PRUEF_STUFE" ]; then
    PRUEF_GELAUFEN+=("$PRUEF_STUFE")
    PRUEF_GELAUFEN_STATUS+=("$PRUEF_STUFE_STATUS")
    PRUEF_STUFE=""
    PRUEF_STUFE_STATUS=""
  fi
}

# `stufe <name> [Erläuterung]` — beginnt die nächste Stufe. Der Name muss im Vertrag stehen.
stufe() {
  local name="$1" i=0 art=""
  shift
  while [ "$i" -lt "${#PRUEF_PLAN[@]}" ]; do
    if [ "${PRUEF_PLAN[$i]}" = "$name" ]; then art="${PRUEF_ARTEN[$i]}"; fi
    i=$((i + 1))
  done
  pruef_abschliessen
  if [ -z "$art" ]; then
    echo "✖ Stufe „${name}“ steht nicht in tools/pruefvertrag.json — erst den Vertrag nachtragen."
    PRUEF_STUFE="$name (nicht im Vertrag)"
    exit 3
  fi
  PRUEF_STUFE="$name"
  if [ "$art" = "meldend" ]; then PRUEF_STUFE_STATUS="meldend"; else PRUEF_STUFE_STATUS="gemessen"; fi
  if [ "$#" -gt 0 ]; then echo "▶ $name ($*)"; else echo "▶ $name"; fi
}

# `stufe_status <gemessen|nicht-gemessen|auswahl|meldend> [Grund]` — der tatsächliche Messstatus der
# laufenden Stufe. Ein unbekannter Status oder ein Aufruf ohne laufende Stufe bricht ab (Code 3).
stufe_status() {
  local status="$1"
  shift
  case "$status" in
    gemessen|nicht-gemessen|auswahl|meldend) ;;
    *) echo "✖ unbekannter Messstatus „${status}“"; exit 3 ;;
  esac
  if [ -z "$PRUEF_STUFE" ]; then
    echo "✖ Messstatus „${status}“ ohne laufende Stufe"
    exit 3
  fi
  if [ "$#" -gt 0 ]; then PRUEF_STUFE_STATUS="$status: $*"; else PRUEF_STUFE_STATUS="$status"; fi
  echo "  ⓘ Messstatus $PRUEF_STUFE: $PRUEF_STUFE_STATUS"
}

pruef_enthalten() {
  local gesucht="$1" s
  shift
  for s in "$@"; do
    if [ "$s" = "$gesucht" ]; then return 0; fi
  done
  return 1
}

pruef_bericht() {
  local rc=$? s i=0 status grund gelaufen plan offen="" gem="" nicht="" ausw="" meld=""
  trap - EXIT
  if [ "$rc" = "0" ]; then pruef_abschliessen; fi
  plan="${PRUEF_PLAN[*]}"
  gelaufen="${PRUEF_GELAUFEN[*]+${PRUEF_GELAUFEN[*]}}"
  while [ "$i" -lt "${#PRUEF_GELAUFEN[@]}" ]; do
    s="${PRUEF_GELAUFEN[$i]}"
    status="${PRUEF_GELAUFEN_STATUS[$i]}"
    grund="${status#*: }"
    if [ "$grund" = "$status" ]; then grund=""; else grund=" ($grund)"; fi
    case "$status" in
      nicht-gemessen*) nicht="$nicht $s$grund" ;;
      auswahl*) ausw="$ausw $s$grund" ;;
      meldend*) meld="$meld $s$grund" ;;
      *) gem="$gem $s" ;;
    esac
    i=$((i + 1))
  done
  for s in "${PRUEF_PLAN[@]}"; do
    if [ "$s" != "$PRUEF_STUFE" ] &&
      ! pruef_enthalten "$s" ${PRUEF_GELAUFEN[@]+"${PRUEF_GELAUFEN[@]}"}; then
      offen="$offen $s"
    fi
  done
  echo ""
  echo "── Prüftor-Bericht (Vertrag: tools/pruefvertrag.json) ──"
  echo "  Startverzeichnis : $PRUEF_START"
  echo "  Wurzel           : $PRUEF_WURZEL"
  echo "  Quellstand       : $PRUEF_QUELLSTAND"
  if [ "$rc" = "0" ] && [ "$gelaufen" = "$plan" ]; then
    if [ -n "$nicht$ausw" ]; then
      echo "  Ergebnis         : grün — alle ${#PRUEF_PLAN[@]} Stufen des Vertrags in seiner Reihenfolge gelaufen, NICHT alle vollständig gemessen"
    else
      echo "  Ergebnis         : grün — alle ${#PRUEF_PLAN[@]} Stufen des Vertrags in seiner Reihenfolge gelaufen"
    fi
  elif [ "$rc" = "0" ]; then
    echo "  Ergebnis         : ROT — der Lauf endete ohne Fehler, fuhr aber nicht genau den Vertrag"
    echo "  gelaufen         : ${gelaufen:-keine}"
    echo "  Vertrag          : $plan"
    rc=1
  else
    echo "  Ergebnis         : ROT in Stufe „${PRUEF_STUFE:-vor der ersten Stufe}“ (Code $rc)"
  fi
  echo "  gemessen         :${gem:- keine}"
  if [ -n "$nicht" ]; then echo "  nicht gemessen   :$nicht"; fi
  if [ -n "$ausw" ]; then echo "  nur Auswahl      :$ausw"; fi
  if [ -n "$meld" ]; then echo "  nur meldend      :$meld"; fi
  if [ -n "$offen" ]; then echo "  nicht erreicht   :$offen"; fi
  node "$PRUEF_BERICHT" --ausserhalb || true
  if [ "$rc" = "0" ]; then echo "✓ check grün"; fi
  exit "$rc"
}

echo "▷ Prüftor · Wurzel $PRUEF_WURZEL · Quellstand $PRUEF_QUELLSTAND"
trap pruef_bericht EXIT
