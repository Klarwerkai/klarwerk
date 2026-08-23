#!/usr/bin/env bash
# JOB 2008 D2 (Register A17) — Gate-Starter fuer die Modalgrenzen-Erhebung.
#
# Als .sh benannt, damit der Starter nicht mit dem Modul kollidiert, das der Test endungslos
# importiert — dieselbe Trennung wie bei tools/audit-forensics.sh (mega4 Block E).
#
# TEIL VON tools/check, anders als die beiden anderen tools-Werkzeuge: das hier ist ein Gate,
# kein Betriebswerkzeug. Es liest ausschliesslich Quelltext, schreibt nichts und ruft nichts
# im Netz.
#
# RUNNER: `node`, nicht `tsx`. Node 24 fuehrt TypeScript direkt aus (Type-Stripping), und tsx
# oeffnet fuer seinen IPC einen Unix-Socket — den verweigert die Umgebung mancher Bahn mit
# `listen EPERM`. Ein Gate darf nicht daran haengen, ob ein Socket erlaubt ist.
# Kein `npx`: ein Werkzeug des Tors darf sich nichts aus dem Netz nachladen (mega82 Block B).
set -euo pipefail
cd "$(dirname "$0")/.."
exec node tools/modalgrenze.ts "$@"
