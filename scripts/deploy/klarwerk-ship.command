#!/bin/bash
# KLARWERK Ship — EIN Skript für den ganzen Weg nach Live:
#   Runner-Gate  →  Commit  →  Push zu GitHub (main)  →  Live-Update (Coolify) + Prüfung.
#
# Warum ein Gate zuerst? Ist der Runner ROT, wird NICHTS gepusht und NICHTS deployt —
# so kann kein kaputter Stand auf app.klarwerk.ai landen. Vor den unwiderruflichen Schritten
# (Push/Deploy) kommt genau EINE Sicherheits-Nachfrage.
#
# Aufruf (Terminal):   bash ~/Documents/dev_Klarwerk/scripts/deploy/klarwerk-ship.command "Commit-Text"
#   Der Commit-Text ist optional; ohne wird ein Zeitstempel gesetzt.
set -euo pipefail

REPO="$HOME/Documents/dev_Klarwerk"
cd "$REPO" || { echo "✗ Repo nicht gefunden: $REPO"; exit 1; }

echo "KLARWERK Ship — $(date '+%d.%m.%Y %H:%M')"
echo "Weg: Runner-Gate → Commit → Push (GitHub main) → Live-Update (Coolify)"
echo ""

# 0) Stale Lock der Bridge entfernen (sonst hakt Git beim Committen).
rm -f "$REPO/.git/index.lock"

# 1) Runner-Gate — das harte Tor. Rot = sofort Stopp, kein Push/Deploy.
echo "▶ 1/4  Runner-Gate (paul-runner.sh) …"
if ! bash "$REPO/docs/team2-austausch/paul-runner.sh"; then
  echo ""
  echo "✗ Runner ROT — es wird NICHT gepusht und NICHT deployt. Erst Fehler beheben."
  exit 1
fi
echo "✓ 1/4  Runner grün."
echo ""

# 2) Commit — nur wenn es etwas Neues gibt. Sonst werden vorhandene Commits gepusht.
MSG="${1:-KLARWERK Ship $(date '+%Y-%m-%d %H:%M')}"
git add -A
if git diff --cached --quiet; then
  echo "ℹ 2/4  Nichts Neues zu committen — pushe vorhandene Commits."
else
  git commit -m "$MSG"
  echo "✓ 2/4  Commit angelegt: ${MSG}"
fi
echo ""

# 3) Sicherheits-Nachfrage vor den unwiderruflichen Schritten (Push + Deploy).
read -r -p "Jetzt Push zu GitHub + Live-Deploy auslösen? [j/N] " ANS
case "${ANS}" in
  j|J|ja|Ja|JA|y|Y) ;;
  *) echo "Abgebrochen — nichts gepusht, nichts deployt. (Commit ist lokal gespeichert.)"; exit 0 ;;
esac

# 4a) Push zu GitHub main (mit Retry bei Netzwerkfehlern: 2s, 4s, 8s).
echo "▶ 3/4  Push zu GitHub (main) …"
N=0
until git push -u origin main; do
  N=$((N + 1))
  if [ "${N}" -ge 4 ]; then
    echo "✗ Push nach mehreren Versuchen fehlgeschlagen — nichts wird deployt."
    exit 1
  fi
  echo "… Netzwerkfehler, Versuch ${N} — warte $((2 ** N))s …"
  sleep $((2 ** N))
done
echo "✓ 3/4  Push durch — GitHub main ist aktuell."
echo ""

# 4b) Live-Update: stößt den Coolify-Deploy an, wartet und prüft die Live-Seite.
echo "▶ 4/4  Live-Update (Coolify) …"
bash "$REPO/scripts/deploy/klarwerk-live-update.command"
