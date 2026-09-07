#!/usr/bin/env bash
# JOB 3150 — EIN Platz für Vitest-Browser und jeden UI-Smoke, auch in anderen Arbeitsbäumen.
# Rangfolge: außen /tmp/klarwerk-test.lock ODER /tmp/klarwerk-smoke.lock (takt/tor.sh),
# innen dieser Browserdeckel. Er wartet NIE auf einen äußeren Ring. tools/test gibt ihn vor
# dem Rest-Aufruf frei; smoke:ui:frisch endet vor dem Playwright-Aufruf (keine Verschachtelung).
# Der übergebene Befehl darf folglich keinen äußeren Ring und keinen weiteren Deckel nehmen.
# CI/tools/check/direkte npm-Smokes durchlaufen dieselben inneren Aufrufe ohne äußere Ringe.
set -euo pipefail
art="${1:-}"
case "$art" in browser|smoke) shift ;; *) echo '✖ Browserdeckel: browser|smoke BEFEHL [ARG…] erwartet' >&2; exit 2 ;; esac
if [ "$#" = 0 ]; then echo '✖ Browserdeckel: Befehl fehlt' >&2; exit 2; fi

# Die Vorgabe ist absichtlich NICHT werkbaum- oder TMPDIR-abhängig. Messungen verwenden einen
# isolierten Pfad; der Regelbetrieb aller Tore teilt exakt /tmp/klarwerk-browserdeckel.lock.
lock="${KLARWERK_BROWSERDECKEL_LOCK:-/tmp/klarwerk-browserdeckel.lock}"
timeout="${KLARWERK_BROWSERDECKEL_TIMEOUT:-2700}"
case "$timeout" in ''|*[!0-9]*) echo '✖ Browserdeckel: Zeitgrenze muss ganze Sekunden enthalten' >&2; exit 2 ;; esac
an=1
if [ "${KLARWERK_BROWSERDECKEL:-1}" = 0 ]; then
  an=0
  echo '⚠ Browserdeckel aus — nur für Messungen' >&2
fi
wurzel="$(cd "$(dirname "$0")/.." && pwd)"
protokoll="$wurzel/.local/run/browserdeckel.jsonl"
# EIN Journal am gemeinsamen Schloss, werkbaumübergreifend. Die lokale Datei ist dessen
# überprüfter Schnappschuss, kein zweiter Messweg. Keine automatische Kürzung/Obergrenze:
# offene Fenster und alte Alarme dürfen nicht durch Rotation verschwinden. 50 000 Zeilen
# sind im Langdateifall geprüft; darüber ist keine Laufzeit zugesagt. Zum manuellen Verkürzen
# alle Tor- UND Messläufe beenden, das Journal zur Beweissicherung umbenennen, neu starten.
# Nie während eines Laufs löschen: sonst fehlte Tor A in Tor B. Der nächste Aufruf erneuert
# auch den lokalen Schnappschuss; dieser allein ist nicht die Quelle eines anhaltenden Alarms.
journal="$lock.jsonl"
mkdir -p "$wurzel/.local/run"
angefragt="$(node -e 'process.stdout.write(String(Date.now()))')"
kennung="$$-$angefragt"
piddatei="$lock/pid-$kennung"
genommen=0
besitzt=0
gewartet=0
kind=""

# Atomare JSONL-Zeilen (ein appendFileSync je Ereignis). Bei JEDEM Freigeben wird nachgerechnet,
# also auch NACH dem letzten Smoke, der zeitlich hinter dem Vitest-Messfall liegt.
# Ein offenes Fenster bleibt offen: beim nächsten Nehmen fällt jede Überschneidung auf.
schreibe() {
  node - "$journal" "$protokoll" "$1" "${2:-$kennung}" "${3:-$$}" "${4:-$art}" "$angefragt" "$an" "$gewartet" <<'NODE'
const fs = require('node:fs');
const [journal, lokal, ereignis, id, pid, art, angefragt, an, gewartet] = process.argv.slice(2);
const zeit = Date.now();
const e = { ereignis, id, pid: Number(pid), art, zeit, angefragt: Number(angefragt),
  gewartetMs: ereignis === 'nehmen' && gewartet === '1' ? zeit - Number(angefragt) : 0, deckel: an === '1' };
fs.appendFileSync(journal, JSON.stringify(e) + '\n');
const text = fs.readFileSync(journal, 'utf8');
// rename verhindert halbe Schnappschüsse bei einem gleichzeitig lesenden Vitest.
const tmp = lokal + '.' + process.pid;
fs.writeFileSync(tmp, text);
fs.renameSync(tmp, lokal);
if (ereignis === 'nehmen') console.log(`▶ Browserdeckel · ${art} · PID ${pid} · gewartet ${e.gewartetMs === 0 ? '0' : (e.gewartetMs / 1000).toFixed(3)}s`);
if (an !== '1') process.exit(0);
const offen = new Map();
for (const zeile of text.trim().split('\n')) {
  const z = JSON.parse(zeile);
  // Messläufe versprechen keine Serialisierung. Ihre Belege bleiben im Journal, zählen aber
  // weder als geschützte Halter noch als Freigabe eines geschützten Halters.
  if (z.deckel === false) continue;
  if (z.ereignis === 'nehmen') {
    if (offen.size) {
      console.error(`✖ Browserdeckel: überlappende Haltezeiträume: ${[...offen.keys()].join(', ')} ∥ ${z.id}`);
      console.error(`Journal: ${journal}`);
      console.error('Falls ein Messlauf diese Einträge geschrieben hat: korrekt mit deckel:false markierte Messungen lösen keinen Alarm aus. Hier überlappen geschützte oder unmarkierte Läufe.');
      console.error('Rückweg: Ursache prüfen und beheben, alle Tor- und Messläufe beenden, Journal zur Beweissicherung umbenennen, dann erneut starten. Nicht im laufenden Betrieb löschen.');
      process.exit(1);
    }
    offen.set(z.id, z);
  } else if (z.ereignis === 'freigeben' || z.ereignis === 'verwaist') {
    offen.delete(z.id);
  } else { throw new Error('Unbekanntes Browserdeckel-Ereignis'); }
}
NODE
}

aufraeumen() {
  rc=$?
  trap - EXIT INT TERM
  # Eigene Prozessgruppe: Abbruch beendet auch npm/npx-Kinder, BEVOR der Platz frei wird.
  if [ -n "$kind" ]; then
    kill -TERM -- "-$kind" 2>/dev/null || true
    # Bis zu fünf Sekunden für den geregelten Abbau. Nicht sofort wait: ein Kind, das TERM
    # ignoriert, würde den EXIT-Trap sonst für immer vor dem nachfolgenden KILL festhalten.
    for ((versuch=0; versuch<50; versuch++)); do
      kill -0 -- "-$kind" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- "-$kind" 2>/dev/null || true
    wait "$kind" 2>/dev/null || true
    while kill -0 -- "-$kind" 2>/dev/null; do sleep 0.1; done
  fi
  if [ "$genommen" = 1 ]; then schreibe freigeben || rc=1; fi
  if [ "$besitzt" = 1 ]; then
    rm -f "$piddatei"
    rmdir "$lock" || rc=1
  fi
  exit "$rc"
}
trap aufraeumen EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ "$an" = 1 ]; then
  while ! mkdir "$lock" 2>/dev/null; do
    gewartet=1
    halter='unbekannt (PID-Datei fehlt)'; seit='unbekannt'
    for datei in "$lock"/pid-*; do
      [ -f "$datei" ] || continue
      if ! read -r halter seit halterart halterid < "$datei"; then continue; fi
      case "$halter" in ''|*[!0-9]*|0) continue ;; esac
      if ! kill -0 "$halter" 2>/dev/null; then
        # Kein rm -rf: von konkurrierenden Aufräumern darf nur der Gewinner die alte PID-Datei
        # entfernen und rmdir versuchen. Sonst könnte der Verlierer einen NEUEN Halter löschen.
        if rm "$datei" 2>/dev/null; then
          echo "ⓘ Browserdeckel verwaist: PID $halter seit $seit (Unix-ms) — aufgeräumt"
          if [ -n "${halterid:-}" ]; then schreibe verwaist "$halterid" "$halter" "$halterart"; fi
          rmdir "$lock" 2>/dev/null || true
        fi
      fi
    done
    if (( SECONDS >= timeout )); then
      echo "✖ Browserdeckel Zeitgrenze ${timeout}s: PID $halter hält seit $seit (Unix-ms); Abbruch" >&2
      exit 1
    fi
    sleep 0.1
  done
  besitzt=1
  seit="$(node -e 'process.stdout.write(String(Date.now()))')"
  printf '%s %s %s %s\n' "$$" "$seit" "$art" "$kennung" > "$piddatei"
fi
genommen=1
schreibe nehmen
# Job-Control gibt dem Befehl eine eigene Prozessgruppe, ohne ps/pgrep und ohne setsid (macOS).
set -m
"$@" &
kind=$!
rc=0
wait "$kind" || rc=$?
exit "$rc"
