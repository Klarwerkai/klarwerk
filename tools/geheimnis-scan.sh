#!/usr/bin/env bash
# R-1420 / F-1420 — Starter fuer den Geheimnis-Scan (tools/geheimnis-scan.ts).
#
# Als .sh benannt, damit der Starter nicht mit dem Modul kollidiert, das der Test endungslos
# importiert — dieselbe Trennung wie bei tools/modalgrenze.sh und tools/zentrale-drift.sh.
#
# AUFGERUFEN VON tools/check (Zeile mit `geheimnis-scan`) als `bash tools/geheimnis-scan.sh` —
# ueber `bash`, damit der Schritt nicht am Ausfuehrungsbit dieser Datei haengt. Von Hand vor einem
# Commit genauso: er liest auch neue, noch nicht versionierte Dateien.
#
# RUNNER: `node`, nicht `tsx` und nicht `npx` — wie bei den anderen Tor-Werkzeugen: kein
# Unix-Socket, kein Nachladen aus dem Netz. Er liest nur und schreibt nichts.
#
# ARGUMENT (nur fuer den Aufrufertest): $1 = Wurzel. Ohne Argument prueft er den echten Bestand.
#
# EXITCODES: 0 = kein Fund · 1 = Fund · 2 = nichts gelesen (nichts geprueft)
set -euo pipefail
cd "$(dirname "$0")/.."
exec node tools/geheimnis-scan.ts "$@"
