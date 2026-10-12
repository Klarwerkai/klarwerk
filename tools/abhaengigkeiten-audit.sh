#!/usr/bin/env bash
# R-1398 — Starter fuer die Abhaengigkeitspruefung vor der Auslieferung.
#
# Als .sh benannt, damit der Starter nicht mit dem Modul kollidiert, das der Test endungslos
# importiert — dieselbe Trennung wie bei tools/zentrale-drift.sh und tools/modalgrenze.sh.
#
# AUFGERUFEN VON scripts/deploy/klarwerk-ship.command (Schritt 0b), BEVOR hochgezaehlt, committet,
# gepusht oder deployt wird. Bewusst NICHT von tools/check: das Tor ist hermetisch, `npm audit`
# braucht die Registry (Begruendung im Kopf von tools/abhaengigkeiten-audit.ts).
#
# RUNNER: `node`, nicht `tsx`, kein `npx` — wie tools/zentrale-drift.sh.
#
# EXITCODES:
#   0 = jede gemeldete Advisory ist an der gebundenen Version bewertet
#   1 = unbewertete oder veraltete Meldung, oder das Register ist ungueltig
#   2 = nicht geprueft (Registry/npm nicht erreichbar, unbekanntes Format)
set -euo pipefail
cd "$(dirname "$0")/.."
exec node tools/abhaengigkeiten-audit.ts "$@"
