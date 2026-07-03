#!/bin/bash
# KLARWERK Paul-Runner — Aufgabendatei des Cloud-Workers ([Paul]).
# Wird von der Schreibtisch-App „KLARWERK Paul Runner" sichtbar im Terminal ausgeführt.
# Paul schreibt diese Datei je Aufgabe neu über die Datei-Brücke; die komplette Ausgabe
# landet zusätzlich als Log in der Brücke, damit Paul sie lesen kann.
#
# AKTUELLE AUFGABE (v1, 03.07.): BASISLINIE — tools/check + smoke:ui auf Stand v0.9.22,
# BEVOR Paul für SCRUM-406 etwas ändert. Nur lesend/prüfend, ändert keinen Code.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO="$HOME/Documents/dev_Klarwerk"
BRIDGE="$REPO/docs/team2-austausch"
LOG="$BRIDGE/paul-runner.log"
GRUEN=$'\033[32m'; ROT=$'\033[31m'; FETT=$'\033[1m'; AUS=$'\033[0m'

{
echo "${FETT}KLARWERK Paul-Runner — $(date '+%d.%m.%Y %H:%M')${AUS}"
echo "Aufgabe: BASISLINIE v0.9.22 (tools/check + smoke:ui) — Dauer ca. 3–6 Minuten."
echo

cd "$REPO" || { echo "${ROT}FEHLER: Repo nicht gefunden.${AUS}"; exit 1; }

echo "${FETT}— Schritt 1/2: tools/check (Build · Lint · Architektur · Tests)${AUS}"
if ./tools/check; then
  echo "${GRUEN}✓ tools/check GRÜN${AUS}"
else
  echo "${ROT}✗ tools/check ROT — Ausgabe oben; Log liegt in der Brücke.${AUS}"
fi
echo

echo "${FETT}— Schritt 2/2: npm run smoke:ui (4 Playwright-Kernflüsse)${AUS}"
if npm run smoke:ui; then
  echo "${GRUEN}✓ smoke:ui GRÜN${AUS}"
else
  echo "${ROT}✗ smoke:ui ROT — Ausgabe oben; Log liegt in der Brücke.${AUS}"
fi

echo
echo "${FETT}Fertig.${AUS} Die komplette Ausgabe liegt für Paul in: docs/team2-austausch/paul-runner.log"
echo "Dieses Fenster kannst du schließen (cmd+W)."
} 2>&1 | tee "$LOG"
