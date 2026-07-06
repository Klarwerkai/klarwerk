#!/bin/bash
# KLARWERK Live-Update — stößt den Coolify-Deploy für app.klarwerk.ai an (klarwerk-prod).
#
# Ablauf, in dem dieses Skript benutzt wird (Reihenfolge ist wichtig):
#   1. Runner fahren → ALLE GATES GRÜN
#   2. Committen, dann KLARWERK Sync (Push zu GitHub — Coolify baut aus dem GitHub-Stand!)
#   3. DIESES Skript doppelklicken → Coolify zieht main (HEAD) und baut das Dockerfile neu.
#
# Einmalige Einrichtung (Pedi, ~2 Minuten):
#   a) Coolify (deploy.klarwerk.ai) → Keys & Tokens → API tokens → neues Token anlegen
#      (nur Deploy-Rechte reichen). Token NICHT in Dateien/Chats — nur in den Schlüsselbund:
#   b) Im Terminal (Token einsetzen, Zeile wird durch das Leerzeichen am Anfang
#      nicht in der Shell-History gespeichert):
#       security add-generic-password -a klarwerk -s KLARWERK-LiveUpdate -w 'TOKEN-HIER'
#   c) Skript ausführbar machen: chmod +x scripts/deploy/klarwerk-live-update.command
#      (und bei Bedarf auf den Schreibtisch kopieren).
set -euo pipefail

APP_UUID="b3rgijsv5jtuhreh9ypyjase"   # Coolify-App „adventurous-ant" (aus der Coolify-URL)
COOLIFY_URL="https://deploy.klarwerk.ai"

echo "KLARWERK Live-Update — $(date '+%d.%m.%Y %H:%M')"
echo "Ziel: app.klarwerk.ai (Coolify klarwerk-prod, App ${APP_UUID})"
echo ""

TOKEN="$(security find-generic-password -s KLARWERK-LiveUpdate -w 2>/dev/null || true)"
if [ -z "${TOKEN}" ]; then
  echo "✗ Kein API-Token im Schlüsselbund (Eintrag: KLARWERK-LiveUpdate)."
  echo "  Einrichtung: siehe Kommentar-Kopf dieses Skripts (Coolify → Keys & Tokens)."
  exit 1
fi

echo "Erinnerung: Deployt wird der GitHub-Stand von main — vorher Runner grün + Sync!"
echo "Stoße Deploy an …"
# --connect-timeout/--max-time: der Aufruf bricht garantiert ab (nie ein hängendes Terminal),
# falls Coolify gerade lahm ist oder das Netz klemmt — der Deploy läuft serverseitig ohnehin weiter.
HTTP="$(curl -sS --connect-timeout 10 --max-time 30 \
  -o /tmp/klarwerk-live-update.json -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${COOLIFY_URL}/api/v1/deploy?uuid=${APP_UUID}&force=false")" || {
  echo "✗ Coolify nicht erreichbar oder Zeitüberschreitung (${COOLIFY_URL})."
  echo "  Der Deploy kann trotzdem laufen — im Coolify unter Deployments prüfen."
  exit 1
}

if [ "${HTTP}" = "200" ] || [ "${HTTP}" = "201" ]; then
  echo "✓ Deploy gestartet. Antwort von Coolify:"
  cat /tmp/klarwerk-live-update.json
  echo ""
  echo "Fortschritt live: ${COOLIFY_URL} → Projects → klarwerk → production → App → Deployments"
  echo "Abnahme danach: https://app.klarwerk.ai/health  +  Versionsnummer oben rechts."
else
  echo "✗ Coolify hat mit HTTP ${HTTP} geantwortet:"
  cat /tmp/klarwerk-live-update.json
  echo ""
  echo "  Häufigste Ursachen: Token abgelaufen/falsch (Schlüsselbund-Eintrag erneuern)"
  echo "  oder Token ohne Deploy-Recht (in Coolify unter Keys & Tokens prüfen)."
  exit 1
fi
