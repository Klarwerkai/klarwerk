#!/bin/bash
# KLARWERK Ship — der ganze Weg nach Live in EINEM Befehl:
#   Runner-Gate → Versions-Zähler +1 → Commit → Push GitHub (+ Gitea-Spiegel) → Live-Update.
#
# WICHTIG (Befund 06.07.2026): Coolify baut vom Remote `github`
# (git@github.com:Klarwerkai/klarwerk.git). KLARWERK Sync pusht aber nur nach Gitea
# (`origin`, localhost:3000), NICHT nach GitHub — deshalb blieb Live auf dem alten Stand.
# Darum pusht DIESES Skript den Deploy-Stand direkt auf `github` (SSH-Auth ist eingerichtet)
# und spiegelt zusätzlich nach `origin` (Gitea). Siehe Sync-Ticket (Dauer-Fix).
#
# Versions-Zähler: Die LETZTE Zahl in APP_VERSION (1.0.0-beta.<Freeze>.<Zähler>) ist ein interner,
# laufender Push-Zähler. Erhöht wird ERST nach grünem Gate und NUR wenn du bestätigst.
#
# Aufruf (Terminal):   bash ~/Documents/dev_Klarwerk/scripts/deploy/klarwerk-ship.command "Commit-Text"
set -euo pipefail

REPO="$HOME/Documents/dev_Klarwerk"
VERSION_FILE="apps/web/src/version.ts"
DEPLOY_REMOTE="github"   # Coolify baut von hier
MIRROR_REMOTE="origin"   # Gitea-Spiegel (best effort)
BRANCH="main"
cd "$REPO" || { echo "✗ Repo nicht gefunden: $REPO"; exit 1; }

echo "KLARWERK Ship — $(date '+%d.%m.%Y %H:%M')"
echo "Weg: Runner-Gate → Zähler +1 → Commit → Push GitHub(+Gitea) → Live-Update"
echo ""

# 0) Stale Lock der Bridge entfernen (sonst hakt Git beim Committen).
rm -f "$REPO/.git/index.lock"

# 1) Runner-Gate — das harte Tor. Rot = sofort Stopp, nichts wird geändert/gepusht/deployt.
echo "▶ 1/5  Runner-Gate (paul-runner.sh) …"
if ! bash "$REPO/docs/team2-austausch/paul-runner.sh"; then
  echo ""
  echo "✗ Runner ROT — nichts wird hochgezählt, committet, gepusht oder deployt. Erst Fehler beheben."
  exit 1
fi
echo "✓ 1/5  Runner grün."
echo ""

# 2) Nächste Versionsnummer BERECHNEN (noch nicht schreiben) — letzte Zahl +1.
CUR="$(sed -n 's/.*APP_VERSION *= *"\([^"]*\)".*/\1/p' "$VERSION_FILE" | head -1)"
if [ -z "${CUR}" ]; then
  echo "✗ APP_VERSION nicht gefunden in ${VERSION_FILE} — abgebrochen."; exit 1
fi
BASE="${CUR%.*}"; LAST="${CUR##*.}"
case "${LAST}" in
  ''|*[!0-9]*) NEXT="${CUR}.1" ;;
  *)           NEXT="${BASE}.$((LAST + 1))" ;;
esac
echo "ℹ 2/5  Versions-Zähler: ${CUR} → ${NEXT}"
echo ""

# 3) EINE Sicherheits-Nachfrage vor den festen Schritten (Commit + Push + Deploy).
read -r -p "Jetzt v${NEXT} committen, nach GitHub pushen und live deployen? [j/N] " ANS
case "${ANS}" in
  j|J|ja|Ja|JA|y|Y) ;;
  *) echo "Abgebrochen — nichts geändert, gepusht oder deployt."; exit 0 ;;
esac

# 3a) Neue Version schreiben (BSD-sed: -i '') + committen.
sed -i '' "s/\(APP_VERSION *= *\"\)[^\"]*\(\"\)/\1${NEXT}\2/" "$VERSION_FILE"
MSG="${1:-KLARWERK Ship v${NEXT}}"
git add -A
git commit -m "${MSG}"
echo "✓ 3/5  Commit ${NEXT}: ${MSG}"
echo ""

# 4a) Push nach GitHub (Deploy-Quelle) — mit Retry. Schlägt das fehl, NICHT deployen.
echo "▶ 4/5  Push nach GitHub (${DEPLOY_REMOTE}/${BRANCH}) …"
N=0
until git push "${DEPLOY_REMOTE}" "${BRANCH}"; do
  N=$((N + 1))
  if [ "${N}" -ge 4 ]; then
    echo "✗ GitHub-Push fehlgeschlagen — es wird NICHT deployt (Coolify baut sonst den alten Stand)."
    echo "  Prüfen: ssh -T git@github.com  |  git -C \"$REPO\" push ${DEPLOY_REMOTE} ${BRANCH}"
    exit 1
  fi
  echo "… Netzwerk/Push-Fehler, Versuch ${N} — warte $((2 ** N))s …"
  sleep $((2 ** N))
done
echo "✓ GitHub aktuell (v${NEXT})."

# 4b) Gitea-Spiegel (best effort) — Fehler hier blockieren den Deploy NICHT.
if git push "${MIRROR_REMOTE}" "${BRANCH}"; then
  echo "✓ Gitea-Spiegel aktualisiert."
else
  echo "⚠ Gitea-Spiegel-Push fehlgeschlagen (nur Mirror) — Deploy läuft trotzdem weiter."
fi
echo "✓ 4/5  Push erledigt."
echo ""

# 5) Live-Update: stößt den Coolify-Deploy an, wartet und prüft die Live-Seite.
echo "▶ 5/5  Live-Update (Coolify) …"
bash "$REPO/scripts/deploy/klarwerk-live-update.command"

echo ""
echo "════════════════════════════════════════════════════════"
echo "✓ LIVE fertig: Topbar zeigt v${NEXT} auf https://app.klarwerk.ai"
echo "════════════════════════════════════════════════════════"

# 6) Lokale Instanz gleich mit-aktualisieren und starten, damit du nach dem Deploy NICHT mehr
#    manuell neu starten musst (Pedi 06.07.). Dies ist der letzte Schritt und hält das Fenster
#    offen (der lokale Server läuft im Vordergrund). Willst du NICHT lokal starten: hier Strg+C.
echo ""
echo "▶ Lokale Instanz aktualisieren & starten (localhost:3001) — Fenster bleibt offen; schließen = lokal stoppen."
echo "  (Nur lokal starten willst du nicht? Dann jetzt Strg+C — live ist bereits aktualisiert.)"
bash "$REPO/scripts/local/klarwerk-lokal-starten.command"
