#!/bin/bash
# KLARWERK Ship — EIN Skript für den ganzen Weg nach Live:
#   Runner-Gate  →  Versions-Zähler +1  →  Commit  →  Push (GitHub main)  →  Live-Update + Prüfung.
#
# Versions-Zähler (Pedi 06.07.2026): Die LETZTE Zahl in APP_VERSION (Format
# 1.0.0-beta.<Freeze>.<Zähler>) ist ein interner, laufender Push-Zähler. Dieses Skript erhöht
# sie bei JEDEM echten Push automatisch um 1 — so sieht man an der Topbar (live UND lokal)
# sofort, ob beide auf demselben Stand sind. Erhöht wird ERST nach grünem Gate und NUR wenn du
# den Push bestätigst — abgebrochene/rote Läufe verbrauchen keine Nummer.
#
# Warum ein Gate zuerst? Ist der Runner ROT, wird NICHTS hochgezählt, gepusht oder deployt —
# so kann kein kaputter Stand auf app.klarwerk.ai landen.
#
# Aufruf (Terminal):   bash ~/Documents/dev_Klarwerk/scripts/deploy/klarwerk-ship.command "Commit-Text"
#   Der Commit-Text ist optional; ohne wird "KLARWERK Ship v<neue Version>" gesetzt.
set -euo pipefail

REPO="$HOME/Documents/dev_Klarwerk"
VERSION_FILE="apps/web/src/version.ts"
cd "$REPO" || { echo "✗ Repo nicht gefunden: $REPO"; exit 1; }

echo "KLARWERK Ship — $(date '+%d.%m.%Y %H:%M')"
echo "Weg: Runner-Gate → Versions-Zähler +1 → Commit → Push → Live-Update"
echo ""

# 0) Stale Lock der Bridge entfernen (sonst hakt Git beim Committen).
rm -f "$REPO/.git/index.lock"

# 1) Runner-Gate — das harte Tor. Rot = sofort Stopp, kein Zähler/Push/Deploy.
echo "▶ 1/4  Runner-Gate (paul-runner.sh) …"
if ! bash "$REPO/docs/team2-austausch/paul-runner.sh"; then
  echo ""
  echo "✗ Runner ROT — es wird NICHT hochgezählt, gepusht oder deployt. Erst Fehler beheben."
  exit 1
fi
echo "✓ 1/4  Runner grün."
echo ""

# 2) Nächste Versionsnummer BERECHNEN (noch nicht schreiben) — letzte Zahl +1.
CUR="$(sed -n 's/.*APP_VERSION *= *"\([^"]*\)".*/\1/p' "$VERSION_FILE" | head -1)"
if [ -z "${CUR}" ]; then
  echo "✗ APP_VERSION nicht gefunden in ${VERSION_FILE} — abgebrochen."; exit 1
fi
BASE="${CUR%.*}"     # alles vor der letzten Zahl, z. B. 1.0.0-beta.1
LAST="${CUR##*.}"    # die letzte Zahl, z. B. 0
case "${LAST}" in
  ''|*[!0-9]*) NEXT="${CUR}.1" ;;   # Fallback: keine Zahl am Ende → .1 anhängen
  *)           NEXT="${BASE}.$((LAST + 1))" ;;
esac
echo "ℹ 2/4  Versions-Zähler: ${CUR} → ${NEXT}"
echo ""

# 3) Sicherheits-Nachfrage vor den unwiderruflichen Schritten (Push + Deploy).
read -r -p "Jetzt v${NEXT} pushen (GitHub) + Live-Deploy auslösen? [j/N] " ANS
case "${ANS}" in
  j|J|ja|Ja|JA|y|Y) ;;
  *) echo "Abgebrochen — nichts hochgezählt, nichts gepusht, nichts deployt."; exit 0 ;;
esac

# 3a) JETZT die neue Version schreiben (BSD-sed auf macOS: -i '' ).
sed -i '' "s/\(APP_VERSION *= *\"\)[^\"]*\(\"\)/\1${NEXT}\2/" "$VERSION_FILE"
echo "✓ APP_VERSION auf ${NEXT} gesetzt."

# 3b) Commit (Versionssprung + alle offenen Änderungen).
MSG="${1:-KLARWERK Ship v${NEXT}}"
git add -A
git commit -m "${MSG}"
echo "✓ 3/4  Commit: ${MSG}"
echo ""

# 4a) Push zu GitHub main (mit Retry bei Netzwerkfehlern: 2s, 4s, 8s).
echo "▶ 4/4  Push zu GitHub (main) …"
N=0
until git push -u origin main; do
  N=$((N + 1))
  if [ "${N}" -ge 4 ]; then
    echo "✗ Push nach mehreren Versuchen fehlgeschlagen — nichts wird deployt."
    echo "  Der Versionssprung ist lokal committet; beim nächsten Lauf wird weitergezählt."
    exit 1
  fi
  echo "… Netzwerkfehler, Versuch ${N} — warte $((2 ** N))s …"
  sleep $((2 ** N))
done
echo "✓ Push durch — GitHub main ist auf v${NEXT}."
echo ""

# 4b) Live-Update: stößt den Coolify-Deploy an, wartet und prüft die Live-Seite.
echo "▶ Live-Update (Coolify) …"
bash "$REPO/scripts/deploy/klarwerk-live-update.command"

echo ""
echo "════════════════════════════════════════════════════════"
echo "Fertig. Zum Gegencheck: Topbar oben rechts zeigt v${NEXT}"
echo "  – live:  https://app.klarwerk.ai"
echo "  – lokal: nach 'klarwerk-lokal-starten.command' auf http://localhost:3001"
echo "  Beide gleiche Nummer = alles up to date."
echo "════════════════════════════════════════════════════════"
