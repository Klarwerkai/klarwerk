#!/usr/bin/env bash
# AUFTRAG-mega80 Block C — READ-ONLY-Starter für die Altbestands-Feststellung.
# NUR SELECT. Kein INSERT/UPDATE/DELETE, keine Migration. NICHT Teil von tools/check.
# Verbindungs-String ausschliesslich aus der Umgebung (DATABASE_URL) — nichts steht im Code.
#
# Nutzung:
#   DATABASE_URL='postgres://…' tools/anhang-herkunft-feststellen.sh
# Zusaetzlich die Rohdaten als JSON:
#   KLARWERK_FESTSTELLUNG_JSON=1 DATABASE_URL='postgres://…' tools/anhang-herkunft-feststellen.sh
#
# Als .sh benannt (mega4 Block E): der Starter darf nicht mit dem Modul
# tools/anhang-herkunft-feststellen.ts kollidieren, das der Test endungslos importiert.
#
# AUFTRAG-mega82 Block B: OHNE `npx`. Ein Werkzeug fuer den Betrieb darf keinen Paketbezug
# versuchen koennen — `npx` faellt bei fehlendem lokalem Runner still auf einen Download aus dem
# Netz zurueck. Hier laeuft ausschliesslich der Runner aus node_modules; fehlt er, sagt das
# Werkzeug das und bricht ab, statt sich still etwas nachzuladen.
set -euo pipefail
cd "$(dirname "$0")/.."
RUNNER="node_modules/.bin/tsx"
if [ ! -x "$RUNNER" ]; then
  echo "tsx fehlt ($RUNNER). Erst 'npm ci' ausfuehren." >&2
  exit 2
fi
exec "$RUNNER" tools/anhang-herkunft-feststellen.ts "$@"
