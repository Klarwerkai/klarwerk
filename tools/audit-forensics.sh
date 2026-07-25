#!/usr/bin/env bash
# AUFTRAG-mega2 Block F — READ-ONLY-Starter für die Audit-Forensik (tools/audit-forensics.ts).
# NUR SELECT. Kein INSERT/UPDATE/DELETE, keine Migration. NICHT Teil von tools/check.
# Verbindungs-String ausschließlich aus der Umgebung (KLARWERK_AUDIT_DB_URL).
#
# AUFTRAG-mega4 Block E: eindeutig als .sh benannt — der Starter kollidiert nicht mehr mit dem Modul
# tools/audit-forensics.ts, das der Test dadurch ENDUNGSLOS importiert (allowImportingTsExtensions
# entfällt wieder).
# Nutzung:
#   KLARWERK_AUDIT_DB_URL='postgres://…' tools/audit-forensics.sh <export-pfad.json>
# oder Export-Pfad über KLARWERK_AUDIT_EXPORT_PATH.
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx tools/audit-forensics.ts "$@"
