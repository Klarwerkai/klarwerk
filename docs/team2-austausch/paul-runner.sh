#!/bin/bash
# KLARWERK Paul-Runner — Aufgabendatei des Cloud-Workers ([Paul]).
#
# AUFGABE v19 (03.07. abends): SCRUM-434 Auffindbarkeit-Feinschliff + PMO-Automatik (v0.9.43-beta) —
# prüft zugleich den gesamten Bestand (395/414/416/413/417-428/433).
#   SCRUM-434 (Pedi 03.07., VIP, „ich stimme allen zu"): reines Frontend (Browser-Reload genügt):
#     1) Nach „Verbinden" öffnet sich direkt das Studio (durchgehender Fluss, kein Zwischenstopp).
#     2) Ein-Klick-Sprung „Zu den Admin-Einstellungen" im gesperrten Public-KI-Hinweis.
#     3) Public-KI-Anreicherung jetzt auch im Verfeinern-Studio verdrahtet (war still gesperrt).
#   NEU Schritt 5: PMO-Fortschritt aktualisieren (Weg b) — Drafts aus pmo-drafts/ auf dem Mac anwenden.
#   (Basis v18: SCRUM-433 Auffindbarkeit, bereits committet.)
# Ablauf:
#   0: Format-Autofix (biome check --write).
#   1: apps/web bauen (vite build → dist v0.9.43-beta).
#   2: tools/check (Build · Lint · Architektur · Tests).
#   3: npm run smoke:ui (4 Playwright-Kernflüsse).
#   4: After-Report-Nachträge anhängen (je nur falls fehlend — Marker-Prüfung).
#   5: PMO-Fortschritt aktualisieren (nur bei grünen Gates; PMO-Fehler macht den Lauf NICHT rot).

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO="$HOME/Documents/dev_Klarwerk"
BRIDGE="$REPO/docs/team2-austausch"
LOG="$BRIDGE/paul-runner.log"
GRUEN=$'\033[32m'; ROT=$'\033[31m'; FETT=$'\033[1m'; AUS=$'\033[0m'
FEHL=0

{
echo "${FETT}KLARWERK Paul-Runner — $(date '+%d.%m.%Y %H:%M')${AUS}"
echo "Aufgabe v19: SCRUM-434 Feinschliff + PMO-Automatik (v0.9.43-beta) + Gesamtbestand — ca. 4–7 Minuten."
echo

cd "$REPO" || { echo "${ROT}FEHLER: Repo nicht gefunden.${AUS}"; exit 1; }

echo "${FETT}— Schritt 0/4: Format-Autofix (biome check --write)${AUS}"
npx @biomejs/biome check --write . >/dev/null 2>&1 || true
echo "${GRUEN}✓ Autofix gelaufen (Ergebnis prüft Schritt 2 ehrlich nach)${AUS}"
echo

echo "${FETT}— Schritt 1/4: apps/web bauen (vite build)${AUS}"
if (cd apps/web && npx vite build); then
  echo "${GRUEN}✓ Build/dist v0.9.43 erstellt${AUS}"
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
anhaengen "SCRUM-426 — Public-KI-Anreicherung" "paul-nachtrag-426.md"
anhaengen "SCRUM-421 + 427 — Upload-Grenzen + Extraktion in Abschnitten" "paul-nachtrag-421-427.md"
anhaengen "SCRUM-428 — Key-Test für den lokalen LLM" "paul-nachtrag-428.md"
anhaengen "SCRUM-433 — Auffindbarkeit (Erkenntnisse verbinden + Public-KI)" "paul-nachtrag-433.md"
anhaengen "SCRUM-434 — Auffindbarkeit-Feinschliff + PMO-Automatik" "paul-nachtrag-434.md"

echo
echo "${FETT}— Schritt 5/5: PMO-Fortschritt aktualisieren (Weg b, nur bei grünen Gates)${AUS}"
PMO="$HOME/Documents/KLARWERK_Reporting_PMO"
DRAFTS="$BRIDGE/pmo-drafts"
ANGEWENDET="$DRAFTS/angewendet"
if [ "$FEHL" != "0" ]; then
  echo "ℹ️ Gates nicht grün — PMO-Update übersprungen (Fortschritt nur bei grünem Bestand)."
elif [ ! -d "$PMO" ] || [ ! -f "$PMO/scripts/apply-item-update.mjs" ]; then
  echo "ℹ️ PMO-Ordner/Skript nicht gefunden ($PMO) — PMO-Update übersprungen (kein Fehler)."
else
  mkdir -p "$PMO/data/intake-drafts" "$ANGEWENDET"
  PMO_ANZ=0
  for draft in "$DRAFTS"/*.json; do
    [ -e "$draft" ] || continue   # keine Drafts → Schleife nicht mit Literal laufen
    name="$(basename "$draft")"
    cp "$draft" "$PMO/data/intake-drafts/$name"
    echo "→ wende an: $name"
    if (cd "$PMO" && node scripts/apply-item-update.mjs "data/intake-drafts/$name"); then
      mv "$draft" "$ANGEWENDET/$name" && echo "${GRUEN}✓ $name angewendet → nach pmo-drafts/angewendet/ verschoben${AUS}"
      PMO_ANZ=$((PMO_ANZ+1))
    else
      # PMO-Fehler blockiert die Code-Lieferung NICHT — nur sichtbar protokollieren.
      echo "${ROT}✗ $name nicht angewendet — Draft bleibt in pmo-drafts/ (Paul prüft).${AUS}"
    fi
  done
  echo "${GRUEN}✓ PMO-Schritt fertig ($PMO_ANZ Draft(s) angewendet).${AUS}"
fi
echo

if [ "$FEHL" = "0" ]; then
  echo "${GRUEN}${FETT}ALLE GATES GRÜN — Gesamtbestand lieferbar (v0.9.43-beta, inkl. SCRUM-434 + PMO-Automatik).${AUS}"
  echo "Sichtabnahme SCRUM-434: Erzählen → 'Aus Datei' → 2 Punkte anhaken → 'Verbinden' →"
  echo "  das Studio öffnet sich direkt mit dem zusammengeführten Artikel."
  echo "Und: im gesperrten Public-KI-Hinweis führt 'Zu den Admin-Einstellungen' mit einem Klick zum Regler."
  echo "Commit-Empfehlung (Boss-Session):"
  echo "  [Cloud-Worker] SCRUM-434: Auffindbarkeit-Feinschliff (Verbinden→Studio, Admin-Sprung) + PMO-Automatik (v0.9.43-beta)"
  echo "KEIN Push — KLARWERK Sync macht Pedi."
else
  echo "${ROT}${FETT}Mindestens ein Gate ROT — Paul analysiert docs/team2-austausch/paul-runner.log und liefert einen Fix.${AUS}"
fi
echo "Komplette Ausgabe für Paul: docs/team2-austausch/paul-runner.log"
echo "Dieses Fenster kannst du schließen (cmd+W)."
} 2>&1 | tee "$LOG"
