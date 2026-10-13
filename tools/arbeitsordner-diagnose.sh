#!/usr/bin/env bash
# Aufnahme 20260922 · Arbeitsordner-Synchronisation (R-1303, R-1982/N6, R-2190) — Starter fuer den
# Diagnosewaechter `tools/arbeitsordner-diagnose.ts`.
#
# Als .sh benannt, damit der Starter nicht mit dem Modul kollidiert, das der Test endungslos
# importiert — dieselbe Trennung wie bei tools/zentrale-drift.sh und tools/modalgrenze.sh.
#
# AUFGERUFEN VON tools/check (Zeile mit `arbeitsordner-diagnose`), dort nur MELDEND.
#
# RUNNER: `node`, nicht `tsx` — Node 24 fuehrt TypeScript direkt aus (wie tools/zentrale-drift.sh).
# Kein `cd`: ein relativer Pfad fuer `--protokoll` oder die Wurzel gilt ab dem Aufruferordner.
#
# ARGUMENTE: [wurzel] [--json] [--protokoll <datei>]. Ohne Wurzel misst er diesen Arbeitsbaum.
#
# EXITCODES:
#   0 = keine Sync-Wirkung gefunden (belegt NICHT, dass keine Synchronisation aktiv ist)
#   1 = Synchronisation an der Wirkung erkannt (byte-identische ` 2`-Duplikate oder ausgelagerte
#       Dateien)
#   2 = nichts gefunden, aber unvollstaendig gemessen (Zugriffsfehler, unverglichene Paare)
set -euo pipefail
exec node "$(dirname "$0")/arbeitsordner-diagnose.ts" "$@"
