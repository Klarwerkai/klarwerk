#!/bin/bash
# KLARWERK Paul-Runner — Aufgabendatei des Cloud-Workers ([Paul]).
#
# AUFGABE v5 (03.07., Pedi-Feedback-Runde): GATES FÜR SCRUM-411 + 410 + 412 (v0.9.30-beta).
#   SCRUM-411: Extract-Bug — Antwort-Limit 4096 für extract + ehrliche Fehler-note
#              (statt falscher „kein KI-Modell"-Meldung bei grünem Schlüssel).
#   SCRUM-410: Interview-Prompt mit Sprach-Leitplanken (Du-Anrede, kurz, konkret, DE strikt).
#   SCRUM-412: CI-Audit Bestätigungs-Dialoge — neutrale Flächen, Rot nur am destruktiven
#              Element (Capture 2× · Admin-Purge · KO-Detail · Bibliothek · Mobile · Studio).
# Ablauf:
#   0: Format-Autofix (biome check --write).
#   1: apps/web bauen (vite build → dist v0.9.30-beta).
#   2: tools/check (Build · Lint · Architektur · Tests — inkl. neuem extract-failure.test).
#   3: npm run smoke:ui (4 Playwright-Kernflüsse).
#   4: After-Report-Nachtrag anhängen (nur falls fehlend — Marker-Prüfung).

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO="$HOME/Documents/dev_Klarwerk"
BRIDGE="$REPO/docs/team2-austausch"
LOG="$BRIDGE/paul-runner.log"
GRUEN=$'\033[32m'; ROT=$'\033[31m'; FETT=$'\033[1m'; AUS=$'\033[0m'
FEHL=0

{
echo "${FETT}KLARWERK Paul-Runner — $(date '+%d.%m.%Y %H:%M')${AUS}"
echo "Aufgabe v5: Gates für SCRUM-411/410/412 (v0.9.30-beta) — ca. 4–7 Minuten."
echo

cd "$REPO" || { echo "${ROT}FEHLER: Repo nicht gefunden.${AUS}"; exit 1; }

echo "${FETT}— Schritt 0/4: Format-Autofix (biome check --write)${AUS}"
npx @biomejs/biome check --write . >/dev/null 2>&1 || true
echo "${GRUEN}✓ Autofix gelaufen (Ergebnis prüft Schritt 2 ehrlich nach)${AUS}"
echo

echo "${FETT}— Schritt 1/4: apps/web bauen (vite build)${AUS}"
if (cd apps/web && npx vite build); then
  echo "${GRUEN}✓ Build/dist v0.9.30 erstellt${AUS}"
else
  echo "${ROT}✗ vite build ROT${AUS}"; FEHL=1
fi
echo

echo "${FETT}— Schritt 2/4: tools/check (Build · Lint · Architektur · Tests)${AUS}"
if ./tools/check; then
  echo "${GRUEN}✓ tools/check GRÜN${AUS}"
else
  echo "${ROT}✗ tools/check ROT${AUS}"; FEHL=1
fi
echo

echo "${FETT}— Schritt 3/4: npm run smoke:ui${AUS}"
if npm run smoke:ui; then
  echo "${GRUEN}✓ smoke:ui GRÜN${AUS}"
else
  echo "${ROT}✗ smoke:ui ROT${AUS}"; FEHL=1
fi
echo

echo "${FETT}— Schritt 4/4: After-Report-Nachträge (nur falls fehlend)${AUS}"
AR="$REPO/docs/qm/claude-after-report.md"
if ! grep -q "Feedback-Runde 03.07. mittags" "$AR" 2>/dev/null; then
  echo >> "$AR"
  cat "$BRIDGE/paul-nachtrag-fixes-0307.md" >> "$AR" && echo "${GRUEN}✓ Nachtrag Feedback-Runde angehängt${AUS}"
else
  echo "ℹ️ Nachtrag Feedback-Runde schon vorhanden — übersprungen."
fi
# QM-Ehrlichkeit: Korrektur zum Verifikations-Werkzeug (Lauf 1 war ROT, Ursache dokumentiert).
if ! grep -q "Werkzeug-Korrektur 03.07." "$AR" 2>/dev/null; then
  echo >> "$AR"
  cat "$BRIDGE/paul-nachtrag-korrektur-0307.md" >> "$AR" && echo "${GRUEN}✓ Nachtrag Werkzeug-Korrektur angehängt${AUS}"
else
  echo "ℹ️ Nachtrag Werkzeug-Korrektur schon vorhanden — übersprungen."
fi

echo
if [ "$FEHL" = "0" ]; then
  echo "${GRUEN}${FETT}ALLE GATES GRÜN — SCRUM-411/410/412 sind lieferbar (v0.9.30-beta).${AUS}"
  echo "WICHTIG für den Extract-Test: App neu starten (neues dist + Server-Code) und dann"
  echo "im Erfassen-Weg ein Dokument hochladen — jetzt mit echtem Ergebnis oder ehrlichem Grund."
  echo "Commit-Empfehlung (Boss-Session):"
  echo "  [Cloud-Worker] SCRUM-411/410/412: Extract-Fix (Token-Limit + ehrliche Fehler-note) · Interview-Sprache · CI-Bestätigungen (v0.9.30-beta)"
  echo "KEIN Push — KLARWERK Sync macht Pedi."
else
  echo "${ROT}${FETT}Mindestens ein Gate ROT — Paul analysiert docs/team2-austausch/paul-runner.log und liefert einen Fix.${AUS}"
fi
echo "Komplette Ausgabe für Paul: docs/team2-austausch/paul-runner.log"
echo "Dieses Fenster kannst du schließen (cmd+W)."
} 2>&1 | tee "$LOG"
