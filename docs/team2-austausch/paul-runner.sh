#!/bin/bash
# KLARWERK Paul-Runner — Aufgabendatei des Cloud-Workers ([Paul]).
#
# AUFGABE v8 (03.07. abends): GATES FÜR SCRUM-395 (v0.9.33-beta) — prüft zugleich den
# gesamten Bestand, also auch 416/413 + 417–420 + den a11y-Fix (ui.tsx) aus v7.
#   SCRUM-395: Prüfer-Zuweisung beim Einreichen (optionaler Prüfer-Vorschlag in
#              „Wissen erfassen", Server legt Zuweisungen an + benachrichtigt) und
#              Standard-Prüferanzahl als Admin-Einstellung (persistiert, 1–5,
#              Admin → Daten; gilt für neue Einreichungen ohne eigene Angabe).
#   Beifang-BUG behoben: Entwurf-Speichern schickte den Inhalt verschachtelt —
#              frisch gespeicherte Entwürfe verloren Titel/Inhalt bis zum ersten Update.
# Ablauf:
#   0: Format-Autofix (biome check --write).
#   1: apps/web bauen (vite build → dist v0.9.33-beta).
#   2: tools/check (Build · Lint · Architektur · Tests — inkl. reviewer-defaults-e2e).
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
echo "Aufgabe v8: Gates für SCRUM-395 (v0.9.33-beta) + Gesamtbestand — ca. 4–7 Minuten."
echo

cd "$REPO" || { echo "${ROT}FEHLER: Repo nicht gefunden.${AUS}"; exit 1; }

echo "${FETT}— Schritt 0/4: Format-Autofix (biome check --write)${AUS}"
npx @biomejs/biome check --write . >/dev/null 2>&1 || true
echo "${GRUEN}✓ Autofix gelaufen (Ergebnis prüft Schritt 2 ehrlich nach)${AUS}"
echo

echo "${FETT}— Schritt 1/4: apps/web bauen (vite build)${AUS}"
if (cd apps/web && npx vite build); then
  echo "${GRUEN}✓ Build/dist v0.9.33 erstellt${AUS}"
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
if ! grep -q "SCRUM-395 — Prüfer-Zuweisung + Standard-Prüferanzahl" "$AR" 2>/dev/null; then
  echo >> "$AR"
  cat "$BRIDGE/paul-nachtrag-395.md" >> "$AR" && echo "${GRUEN}✓ Nachtrag 395 angehängt${AUS}"
else
  echo "ℹ️ Nachtrag schon vorhanden — übersprungen."
fi

echo
if [ "$FEHL" = "0" ]; then
  echo "${GRUEN}${FETT}ALLE GATES GRÜN — Gesamtbestand lieferbar (v0.9.33-beta, inkl. 416/413 + 417-420 + 395).${AUS}"
  echo "Sichtabnahme (3 Minuten):"
  echo "  1. Wissen erfassen → Erweiterte Details: neuer Block 'Prüfer vorschlagen' (Personen-Chips)."
  echo "  2. Admin → Daten: neue Karte 'Prüfungen' — Standard-Prüferanzahl setzen (z. B. 2),"
  echo "     dann in Wissen erfassen: das Feld 'Nötige Validierungen' zeigt 'Standard: 2'."
  echo "  3. Als Experte einreichen mit gewählter Prüferin → sie bekommt eine Benachrichtigung (Glocke)."
  echo "Commit-Empfehlung (Boss-Session):"
  echo "  [Cloud-Worker] SCRUM-395: Prüfer-Vorschlag beim Einreichen + Standard-Prüferanzahl (Admin) · Entwurf-Speichern-Bug (v0.9.33-beta)"
  echo "KEIN Push — KLARWERK Sync macht Pedi."
else
  echo "${ROT}${FETT}Mindestens ein Gate ROT — Paul analysiert docs/team2-austausch/paul-runner.log und liefert einen Fix.${AUS}"
fi
echo "Komplette Ausgabe für Paul: docs/team2-austausch/paul-runner.log"
echo "Dieses Fenster kannst du schließen (cmd+W)."
} 2>&1 | tee "$LOG"
