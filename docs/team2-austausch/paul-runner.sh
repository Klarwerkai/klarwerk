#!/bin/bash
# KLARWERK Paul-Runner — Aufgabendatei des Cloud-Workers ([Paul]).
#
# AUFGABE v7 (03.07. abends): GATES FÜR SCRUM-417/418/419/420 (v0.9.32-beta) —
# Pedis zweite Feedback-Runde mit Screenshots:
#   SCRUM-417: Validierungs-Board — Autor/Admin dürfen Artikel direkt bearbeiten (Stift →
#              KO-Detail im Bearbeiten-Modus) und löschen (Papierkorb → ruhige Rückfrage).
#   SCRUM-418: Extraktion — Arbeits-Animation (Spinner) während die KI sucht; Antwort-Limit
#              8192 Token + Prompt-Begrenzung (≤12 Punkte, kurze Belegstellen) + Rettung
#              vollständiger Punkte aus trotzdem gekürzten Antworten (ehrlicher Hinweis).
#   SCRUM-419: Lösch-Rückfragen — Layout repariert (Bibliothek: eigene Zeile mit Trennlinie;
#              KO-Detail: gestapelt statt gequetscht).
#   SCRUM-420: Geister-Karten „Re-Validierung" gelöschter KOs verschwinden (Selbstheilung).
# Ablauf:
#   0: Format-Autofix (biome check --write).
#   1: apps/web bauen (vite build → dist v0.9.32-beta).
#   2: tools/check (Build · Lint · Architektur · Tests — inkl. neuer 418/420-Tests).
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
echo "Aufgabe v7: Gates für SCRUM-417/418/419/420 (v0.9.32-beta) — ca. 4–7 Minuten."
echo

cd "$REPO" || { echo "${ROT}FEHLER: Repo nicht gefunden.${AUS}"; exit 1; }

echo "${FETT}— Schritt 0/4: Format-Autofix (biome check --write)${AUS}"
npx @biomejs/biome check --write . >/dev/null 2>&1 || true
echo "${GRUEN}✓ Autofix gelaufen (Ergebnis prüft Schritt 2 ehrlich nach)${AUS}"
echo

echo "${FETT}— Schritt 1/4: apps/web bauen (vite build)${AUS}"
if (cd apps/web && npx vite build); then
  echo "${GRUEN}✓ Build/dist v0.9.32 erstellt${AUS}"
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
if ! grep -q "SCRUM-417/418/419/420 — Feedback-Runde 2" "$AR" 2>/dev/null; then
  echo >> "$AR"
  cat "$BRIDGE/paul-nachtrag-417-420.md" >> "$AR" && echo "${GRUEN}✓ Nachtrag 417–420 angehängt${AUS}"
else
  echo "ℹ️ Nachtrag schon vorhanden — übersprungen."
fi

echo
if [ "$FEHL" = "0" ]; then
  echo "${GRUEN}${FETT}ALLE GATES GRÜN — SCRUM-417/418/419/420 sind lieferbar (v0.9.32-beta).${AUS}"
  echo "Sichtabnahme (3 Minuten):"
  echo "  1. Validierung: auf einer Karte Stift/Papierkorb testen (als Admin oder Autor)."
  echo "  2. Wissen erfassen → Aus Datei → PDF hochladen → 'Nach Wissen suchen': Spinner dreht,"
  echo "     Ergebnis kommt (bei sehr langen PDFs ggf. mit ehrlichem Gekürzt-Hinweis)."
  echo "  3. Bibliothek: Löschen drücken → Rückfrage sitzt sauber in eigener Zeile."
  echo "  4. Validierung: keine UUID-Geisterkarten mehr unter Re-Validierung."
  echo "Commit-Empfehlung (Boss-Session):"
  echo "  [Cloud-Worker] SCRUM-417/418/419/420: Board-Aktionen · Extraktion robust+Spinner · Lösch-Layouts · Geister-Karten (v0.9.32-beta)"
  echo "KEIN Push — KLARWERK Sync macht Pedi."
else
  echo "${ROT}${FETT}Mindestens ein Gate ROT — Paul analysiert docs/team2-austausch/paul-runner.log und liefert einen Fix.${AUS}"
fi
echo "Komplette Ausgabe für Paul: docs/team2-austausch/paul-runner.log"
echo "Dieses Fenster kannst du schließen (cmd+W)."
} 2>&1 | tee "$LOG"
