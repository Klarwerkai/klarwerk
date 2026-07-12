#!/bin/bash
# KLARWERK Lokal — startet (und aktualisiert) deine LOKALE Instanz auf diesem Mac.
# Ersatz für den kaputten iCloud-Desktop-Launcher: läuft zuverlässig als .command.
#
# Was es tut:
#   1. Beendet eine evtl. laufende lokale Instanz (Port 3001) — sauberer Neustart.
#   2. Baut die Oberfläche frisch (apps/web/dist) → du siehst deinen aktuellen Stand.
#   3. Holt den Anthropic-Schlüssel aus dem kanonischen Schlüsselbund-Eintrag.
#      Fehlt er, läuft die App regelbasiert (KI-Funktionen aus) — fürs UI-Testen reicht das.
#   4. Startet den Server mit lokaler Persistenz (Daten überleben Neustarts) und öffnet den Browser.
#
# Beenden: dieses Fenster schließen oder Ctrl+C. Neu laden: Skript erneut ausführen.
# Wichtig: NUR deine lokale Instanz — der Hetzner (app.klarwerk.ai) wird davon NICHT berührt.
set -euo pipefail

REPO="$HOME/Documents/dev_Klarwerk"
PORT=3001
cd "$REPO" || { echo "✗ Repo nicht gefunden: $REPO"; exit 1; }

echo "KLARWERK Lokal — $(date '+%d.%m.%Y %H:%M')"
echo "Ziel: NUR lokale Instanz (http://localhost:${PORT}) — Hetzner bleibt unberührt."
echo ""

# 1) Laufende Instanz auf dem Port beenden (sauberer Neustart).
if lsof -ti "tcp:${PORT}" >/dev/null 2>&1; then
  echo "Beende laufende lokale Instanz auf Port ${PORT} …"
  lsof -ti "tcp:${PORT}" | xargs kill 2>/dev/null || true
  sleep 1
fi

# 2) Oberfläche frisch bauen (damit die lokale Instanz den aktuellen Stand zeigt).
echo "Baue Oberfläche … (ein paar Sekunden)"
( cd apps/web && npx vite build >/tmp/klarwerk-lokal-build.log 2>&1 ) || {
  echo "✗ Build fehlgeschlagen — Log: /tmp/klarwerk-lokal-build.log"; exit 1
}
echo "✓ Oberfläche gebaut"

# 3) Anthropic-Schlüssel aus dem Schlüsselbund (optional). Alt-Eintraege werden einmalig
# in den kanonischen Vertrag migriert; der Wert wird nie ausgegeben oder geloggt.
KEY="$(security find-generic-password -s Klarwerk -a ANTHROPIC_API_KEY -w 2>/dev/null || true)"
if [ -z "${KEY}" ]; then
  KEY="$(security find-generic-password -s KLARWERK-App-Anthropic -a team1 -w 2>/dev/null || true)"
  if [ -n "${KEY}" ]; then
    security add-generic-password -U -s Klarwerk -a ANTHROPIC_API_KEY -w "${KEY}" >/dev/null 2>&1 || true
  fi
fi
if [ -n "${KEY}" ]; then
  export ANTHROPIC_API_KEY="${KEY}"
  echo "✓ KI: Anthropic (Schlüssel gefunden)"
else
  echo "ℹ KI: regelbasiert (kein Schlüssel im Schlüsselbund Klarwerk/ANTHROPIC_API_KEY) — fürs UI-Testen ok"
fi
unset KEY

# 4) Lokale Persistenz + Port, dann starten. Browser öffnet + Schluss-Meldung, sobald gesund.
export KLARWERK_DEV_PERSIST=1
export PORT
VERSION="$(sed -n 's/.*APP_VERSION *= *"\([^"]*\)".*/\1/p' apps/web/src/version.ts | head -1)"
echo ""
echo "Starte lokale Instanz … (dieses Fenster offen lassen; schließen = stoppen)"
( for _ in $(seq 1 40); do
    if curl -s "http://localhost:${PORT}/health" | grep -q '"status":"ok"'; then
      open "http://localhost:${PORT}"
      echo ""
      echo "════════════════════════════════════════════════════════"
      echo "✓ LOKALER SERVER OK & AKTUALISIERT"
      echo "  → http://localhost:${PORT}  (Version ${VERSION:-?})"
      echo "  Nur lokal — der Hetzner (app.klarwerk.ai) ist NICHT betroffen."
      echo "  Fenster offen lassen; schließen = stoppen."
      echo "════════════════════════════════════════════════════════"
      break
    fi
    sleep 1
  done ) &
npm start
