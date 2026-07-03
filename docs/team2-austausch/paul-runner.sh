#!/bin/bash
# KLARWERK Paul-Runner — Aufgabendatei des Cloud-Workers ([Paul]).
#
# AUFGABE v13 (03.07. abends): GATES FÜR SCRUM-414 (v0.9.38-beta) — prüft zugleich den
# gesamten Bestand (395/416/413/417-420/422/418-Härtung/424).
#   SCRUM-414: Admin-Regler „externe Wissensabfrage" — 4 Stufen (blockiert · nur Suche
#              auf Klick [Standard] · Suche+Anhängen · offen), persistiert, mit Server-Gate
#              (blockiert → externe Suche 403). Admin → KI: neue Karte.
# Ablauf:
#   0: Format-Autofix (biome check --write).
#   1: apps/web bauen (vite build → dist v0.9.38-beta).
#   2: tools/check (Build · Lint · Architektur · Tests).
#   3: npm run smoke:ui (4 Playwright-Kernflüsse).
#   4: After-Report-Nachträge anhängen (je nur falls fehlend — Marker-Prüfung).

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO="$HOME/Documents/dev_Klarwerk"
BRIDGE="$REPO/docs/team2-austausch"
LOG="$BRIDGE/paul-runner.log"
GRUEN=$'\033[32m'; ROT=$'\033[31m'; FETT=$'\033[1m'; AUS=$'\033[0m'
FEHL=0

{
echo "${FETT}KLARWERK Paul-Runner — $(date '+%d.%m.%Y %H:%M')${AUS}"
echo "Aufgabe v13: Gates für SCRUM-414 (v0.9.38-beta) + Gesamtbestand — ca. 4–7 Minuten."
echo

cd "$REPO" || { echo "${ROT}FEHLER: Repo nicht gefunden.${AUS}"; exit 1; }

echo "${FETT}— Schritt 0/4: Format-Autofix (biome check --write)${AUS}"
npx @biomejs/biome check --write . >/dev/null 2>&1 || true
echo "${GRUEN}✓ Autofix gelaufen (Ergebnis prüft Schritt 2 ehrlich nach)${AUS}"
echo

echo "${FETT}— Schritt 1/4: apps/web bauen (vite build)${AUS}"
if (cd apps/web && npx vite build); then
  echo "${GRUEN}✓ Build/dist v0.9.38 erstellt${AUS}"
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

echo "${FETT}— Schritt 4/4: After-Report-Nachträge (je nur falls fehlend)${AUS}"
AR="$REPO/docs/qm/claude-after-report.md"
anhaengen() { # $1 = Marker, $2 = Nachtrag-Datei
  if ! grep -q "$1" "$AR" 2>/dev/null; then
    echo >> "$AR"; cat "$BRIDGE/$2" >> "$AR" && echo "${GRUEN}✓ $2 angehängt${AUS}"
  else
    echo "ℹ️ $2 schon vorhanden — übersprungen."
  fi
}
anhaengen "SCRUM-422 — Papierkorb für gelöschte Artikel" "paul-nachtrag-422.md"
anhaengen "SCRUM-418 (Härtung 2) — Extraktion aus Datei robust" "paul-nachtrag-418b.md"
anhaengen "SCRUM-424 — Zwei KI-Backends" "paul-nachtrag-424.md"
anhaengen "SCRUM-425 — Validierung optisch an die Bibliothek angleichen" "paul-nachtrag-425.md"
anhaengen "SCRUM-414 — Admin-Regler „externe Wissensabfrage" "paul-nachtrag-414.md"

echo
if [ "$FEHL" = "0" ]; then
  echo "${GRUEN}${FETT}ALLE GATES GRÜN — Gesamtbestand lieferbar (v0.9.38-beta, inkl. 424 + 425 + 414).${AUS}"
  echo "Sichtabnahme: Admin → KI → Karte 'Externe Wissensabfrage' — Stufe wählen (z. B. Blockiert),"
  echo "dann Wissen erfassen: die externe Quellensuche ist ausgeblendet; bei Nicht-Blockiert sichtbar."
  echo "Commit-Empfehlung (Boss-Session):"
  echo "  [Cloud-Worker] SCRUM-414: Admin-Regler externe Wissensabfrage (4 Stufen, persistiert, Server-Gate) (v0.9.38-beta)"
  echo "KEIN Push — KLARWERK Sync macht Pedi."
else
  echo "${ROT}${FETT}Mindestens ein Gate ROT — Paul analysiert docs/team2-austausch/paul-runner.log und liefert einen Fix.${AUS}"
fi
echo "Komplette Ausgabe für Paul: docs/team2-austausch/paul-runner.log"
echo "Dieses Fenster kannst du schließen (cmd+W)."
} 2>&1 | tee "$LOG"
