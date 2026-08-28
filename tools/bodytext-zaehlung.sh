#!/usr/bin/env bash
# JOB 2614 D4 — Starter fuer die Read-only-Zaehlung (tools/bodytext-zaehlung.ts).
# NUR SELECT, keine Inhalte — nur Zahlen. Verbindungs-String ausschliesslich aus der Umgebung:
#   KLARWERK_DB_URL='postgres://…' tools/bodytext-zaehlung.sh
# Eindeutig als .sh benannt (endungsloser Modulimport im Test, wie audit-forensics.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx tools/bodytext-zaehlung.ts "$@"
