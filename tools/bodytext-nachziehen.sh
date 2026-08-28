#!/usr/bin/env bash
# JOB 2614 D3 — Starter für die Suchtext-Bestandsreparatur (tools/bodytext-nachziehen.ts).
#
# TROCKENLAUF IST DER DEFAULT: ohne --ausfuehren wird nur gelesen und gezählt (Zahl betroffener
# KOs), nichts geschrieben. --ausfuehren stößt den VORHANDENEN Nachzug an (reconcile);
# --ausfuehren --rebuild ist die Eskalationsstufe (voller Neuaufbau der aktiven Projektionen).
#
# NIE gegen die Live-Datenbank ausführen ohne Pedis ausdrückliche Freigabe (Auftrag 2614 §6).
# Verbindungs-String ausschließlich aus der Umgebung:
#   KLARWERK_DB_URL='postgres://…' tools/bodytext-nachziehen.sh [--ausfuehren] [--rebuild]
#
# Eindeutig als .sh benannt, damit der Test das Modul tools/bodytext-nachziehen.ts endungslos
# importieren kann (gleiche Bauform wie tools/audit-forensics.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx tools/bodytext-nachziehen.ts "$@"
