#!/bin/bash
# KLARWERK Paul-Runner — Aufgabendatei des Cloud-Workers ([Paul]).
#
# AUFGABE v9 (03.07. abends): GATES FÜR SCRUM-422 (v0.9.34-beta) — prüft zugleich den
# gesamten Bestand (a11y-Fix, 416/413, 417–420, 395 inkl. Entwurf-Bugfix).
#   SCRUM-422: Papierkorb — Löschen verschiebt Artikel in den Papierkorb (Admin → Daten:
#              Liste, Wiederherstellen, sofortige Endlöschung); automatische Endlöschung
#              nach 28 Tagen (lazy, ohne Cron); Demo-Daten IMMER sofort endgültig.
# Ablauf:
#   0: Format-Autofix (biome check --write).
#   1: apps/web bauen (vite build → dist v0.9.34-beta).
#   2: tools/check (Build · Lint · Architektur · Tests — inkl. trash-e2e + reviewer-defaults-e2e).
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
echo "Aufgabe v9: Gates für SCRUM-422 (v0.9.34-beta) + Gesamtbestand — ca. 4–7 Minuten."
echo

cd "$REPO" || { echo "${ROT}FEHLER: Repo nicht gefunden.${AUS}"; exit 1; }

echo "${FETT}— Schritt 0/4: Format-Autofix (biome check --write)${AUS}"
npx @biomejs/biome check --write . >/dev/null 2>&1 || true
echo "${GRUEN}✓ Autofix gelaufen (Ergebnis prüft Schritt 2 ehrlich nach)${AUS}"
echo

echo "${FETT}— Schritt 1/4: apps/web bauen (vite build)${AUS}"
if (cd apps/web && npx vite build); then
  echo "${GRUEN}✓ Build/dist v0.9.34 erstellt${AUS}"
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

echo "${FETT}— Schritt 4/4: After-Report-Nachtrag (nur falls fehlend)${AUS}"
AR="$REPO/docs/qm/claude-after-report.md"
if ! grep -q "SCRUM-422 — Papierkorb für gelöschte Artikel" "$AR" 2>/dev/null; then
  echo >> "$AR"
  cat "$BRIDGE/paul-nachtrag-422.md" >> "$AR" && echo "${GRUEN}✓ Nachtrag 422 angehängt${AUS}"
else
  echo "ℹ️ Nachtrag schon vorhanden — übersprungen."
fi

echo
if [ "$FEHL" = "0" ]; then
  echo "${GRUEN}${FETT}ALLE GATES GRÜN — Gesamtbestand lieferbar (v0.9.34-beta, inkl. 416/413 + 417-420 + 395 + 422).${AUS}"
  echo "Sichtabnahme (4 Minuten):"
  echo "  1. Einen eigenen (Nicht-Demo-)Beitrag löschen → Admin → Daten → Papierkorb: Eintrag da,"
  echo "     Wiederherstellen → Beitrag ist zurück (Version/Historie unverändert)."
  echo "  2. Nochmal löschen → im Papierkorb 'Endgültig löschen' (Rückfrage) → Eintrag weg."
  echo "  3. Wissen erfassen → Erweiterte Details: Block 'Prüfer vorschlagen' + Standard-Platzhalter."
  echo "  4. Admin → Daten → Prüfungen: Standard-Prüferanzahl setzen wirkt als Platzhalter im Erfassen."
  echo "Commit-Empfehlung (Boss-Session):"
  echo "  [Cloud-Worker] SCRUM-395/422: Prüfer-Vorschlag + Standard-Prüferanzahl · Papierkorb (v0.9.34-beta)"
  echo "KEIN Push — KLARWERK Sync macht Pedi."
else
  echo "${ROT}${FETT}Mindestens ein Gate ROT — Paul analysiert docs/team2-austausch/paul-runner.log und liefert einen Fix.${AUS}"
fi
echo "Komplette Ausgabe für Paul: docs/team2-austausch/paul-runner.log"
echo "Dieses Fenster kannst du schließen (cmd+W)."
} 2>&1 | tee "$LOG"
