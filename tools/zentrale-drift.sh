#!/usr/bin/env bash
# JOB 2065 D3/D4/D5 (Register I39) — Starter fuer den Zentralen-Waechter.
#
# Als .sh benannt, damit der Starter nicht mit dem Modul kollidiert, das der Test endungslos
# importiert — dieselbe Trennung wie bei tools/modalgrenze.sh und tools/audit-forensics.sh.
#
# AUFGERUFEN VON tools/check (Zeile mit `zentrale-drift`).
#
# D5 — ER MELDET, ER SPERRT NICHT, solange der Fundort ein Kontrollwerkzeug ist. D4 hat mit
# denselben vier echten Funden das Tor rot gemacht und musste zurueckgerollt werden: die Fundstelle
# ist `_relay/board/klarwerk-board.html`, und die darf niemand anfassen. Ein Waechter, dessen Befund
# niemand beheben darf, haelt zwoelf Bahnen an und wird nach zwei Tagen abgeschaltet.
#
# RUNNER: `node`, nicht `tsx`. Node 24 fuehrt TypeScript direkt aus (Type-Stripping), und tsx
# oeffnet fuer seinen IPC einen Unix-Socket — den verweigert die Umgebung mancher Bahn mit
# `listen EPERM`. Kein `npx`: ein Werkzeug des Tors darf sich nichts aus dem Netz nachladen
# (mega82 Block B).
#
# ARGUMENTE (nur fuer den Aufrufertest): $1 = Wurzel, $2 = Lesefläche. Ohne Argumente misst er den
# echten Bestand.
#
# EXITCODES:
#   0 = gepflegt ODER Drift an einer unantastbaren Stelle (gemeldet, mit Adresse)
#   1 = Drift an einer AENDERBAREN Stelle — wer sie beheben darf, muss sie auch beheben
#   2 = Lesefläche nicht gefunden (nichts gemessen; Normalfall im Clone, `.gitignore:25`)
set -euo pipefail
cd "$(dirname "$0")/.."
exec node tools/zentrale-drift.ts "$@"
