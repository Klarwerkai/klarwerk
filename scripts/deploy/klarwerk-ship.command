#!/bin/bash
# KLARWERK Ship — der ganze Weg nach Live, in der RICHTIGEN Reihenfolge:
#   Runner-Gate  →  Versions-Zähler +1  →  Commit  →  KLARWERK Sync (Push)  →  Live-Update.
#
# WICHTIG (Regel aus PROJECT_CONTEXT): Der EINZIGE Push-Weg ist "KLARWERK Sync" — sie spiegelt
# GitHub UND Gitea und synct alle Repos. Dieses Skript pusht deshalb NICHT selbst, sondern
# übergibt nach dem Commit an KLARWERK Sync und wartet, bis du bestätigst. Erst danach deployt es.
#
# Versions-Zähler (Pedi 06.07.2026): Die LETZTE Zahl in APP_VERSION (Format
# 1.0.0-beta.<Freeze>.<Zähler>) ist ein interner, laufender Push-Zähler. Dieses Skript erhöht sie
# bei jedem echten Ship um 1 — so sieht man an der Topbar (live UND lokal) sofort, ob beide gleich
# sind. Erhöht wird ERST nach grünem Gate und NUR wenn du bestätigst.
#
# Aufruf (Terminal):   bash ~/Documents/dev_Klarwerk/scripts/deploy/klarwerk-ship.command "Commit-Text"
set -euo pipefail

REPO="$HOME/Documents/dev_Klarwerk"
VERSION_FILE="apps/web/src/version.ts"
cd "$REPO" || { echo "✗ Repo nicht gefunden: $REPO"; exit 1; }

echo "KLARWERK Ship — $(date '+%d.%m.%Y %H:%M')"
echo "Weg: Runner-Gate → Zähler +1 → Commit → KLARWERK Sync → Live-Update"
echo ""

# 0) Stale Lock der Bridge entfernen (sonst hakt Git beim Committen).
rm -f "$REPO/.git/index.lock"

# 1) Runner-Gate — das harte Tor. Rot = sofort Stopp, kein Zähler/Commit/Sync/Deploy.
echo "▶ 1/5  Runner-Gate (paul-runner.sh) …"
if ! bash "$REPO/docs/team2-austausch/paul-runner.sh"; then
  echo ""
  echo "✗ Runner ROT — nichts wird hochgezählt, committet, gesynct oder deployt. Erst Fehler beheben."
  exit 1
fi
echo "✓ 1/5  Runner grün."
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
echo "ℹ 2/5  Versions-Zähler: ${CUR} → ${NEXT}"
echo ""

# 3) Sicherheits-Nachfrage vor den festen Schritten (Commit + Sync/Push + Deploy).
read -r -p "Jetzt v${NEXT} committen, per KLARWERK Sync pushen und live deployen? [j/N] " ANS
case "${ANS}" in
  j|J|ja|Ja|JA|y|Y) ;;
  *) echo "Abgebrochen — nichts hochgezählt, committet, gesynct oder deployt."; exit 0 ;;
esac

# 3a) Neue Version schreiben (BSD-sed auf macOS: -i '' ) + committen.
sed -i '' "s/\(APP_VERSION *= *\"\)[^\"]*\(\"\)/\1${NEXT}\2/" "$VERSION_FILE"
echo "✓ APP_VERSION auf ${NEXT} gesetzt."
MSG="${1:-KLARWERK Ship v${NEXT}}"
git add -A
git commit -m "${MSG}"
echo "✓ 3/5  Commit: ${MSG}"
echo ""

# 4) Push AUSSCHLIESSLICH über KLARWERK Sync (GitHub + Gitea, alle Repos) — Übergabe an dich.
echo "▶ 4/5  KLARWERK Sync (Push nach GitHub + Gitea) …"
echo "   Regel: Gepusht wird NUR über KLARWERK Sync — nicht per direktem git push."
echo "   → Bitte JETZT die KLARWERK-Sync-App laufen lassen (wie gewohnt)."
echo ""
read -r -p "   Wenn der Sync DURCH ist (Commit ${NEXT} auf GitHub): hier Enter zum Live-Deploy … " _
echo "✓ 4/5  Sync bestätigt."
echo ""

# 5) Live-Update: stößt den Coolify-Deploy an, wartet und prüft die Live-Seite.
echo "▶ 5/5  Live-Update (Coolify) …"
bash "$REPO/scripts/deploy/klarwerk-live-update.command"

echo ""
echo "════════════════════════════════════════════════════════"
echo "Fertig. Gegencheck: Topbar oben rechts zeigt v${NEXT}"
echo "  – live:  https://app.klarwerk.ai"
echo "  – lokal: nach 'klarwerk-lokal-starten.command' auf http://localhost:3001"
echo "  Beide gleiche Nummer = alles up to date."
echo "════════════════════════════════════════════════════════"
