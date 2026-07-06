#!/bin/bash
# KLARWERK Live-Update — stößt den Coolify-Deploy für app.klarwerk.ai an (klarwerk-prod)
# und WARTET, bis er fertig ist — mit klarer Schluss-Meldung „Live-Seite OK & aktualisiert".
#
# Ablauf, in dem dieses Skript benutzt wird (Reihenfolge ist wichtig):
#   1. Runner fahren → ALLE GATES GRÜN
#   2. Committen, dann KLARWERK Sync (Push zu GitHub — Coolify baut aus dem GitHub-Stand!)
#   3. DIESES Skript ausführen → Coolify zieht main (HEAD) und baut das Dockerfile neu.
#
# Einmalige Einrichtung (Pedi): Coolify → Security → API Tokens → Token mit deploy-Recht,
# in den Schlüsselbund: security add-generic-password -a klarwerk -s KLARWERK-LiveUpdate -w 'TOKEN'
set -euo pipefail

APP_UUID="b3rgijsv5jtuhreh9ypyjase"   # Coolify-App „adventurous-ant"
COOLIFY_URL="https://deploy.klarwerk.ai"
LIVE_URL="https://app.klarwerk.ai"

echo "KLARWERK Live-Update — $(date '+%d.%m.%Y %H:%M')"
echo "Ziel: ${LIVE_URL} (Hetzner, Coolify klarwerk-prod)"
echo ""

TOKEN="$(security find-generic-password -s KLARWERK-LiveUpdate -w 2>/dev/null || true)"
if [ -z "${TOKEN}" ]; then
  echo "✗ Kein API-Token im Schlüsselbund (Eintrag: KLARWERK-LiveUpdate)."
  exit 1
fi

echo "Erinnerung: Deployt wird der GitHub-Stand von main — vorher Runner grün + Sync!"
echo "Stoße Deploy an …"
HTTP="$(curl -sS --connect-timeout 10 --max-time 30 \
  -o /tmp/klarwerk-live-update.json -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${COOLIFY_URL}/api/v1/deploy?uuid=${APP_UUID}&force=false")" || {
  echo "✗ Coolify nicht erreichbar oder Zeitüberschreitung (${COOLIFY_URL})."
  exit 1
}
if [ "${HTTP}" != "200" ] && [ "${HTTP}" != "201" ]; then
  echo "✗ Coolify hat mit HTTP ${HTTP} geantwortet:"; cat /tmp/klarwerk-live-update.json; echo
  echo "  Token abgelaufen/ohne deploy-Recht? In Coolify → Security → API Tokens prüfen."
  exit 1
fi

# Deployment-UUID aus der Antwort ziehen (ohne jq — reines grep/sed).
DUUID="$(grep -oE '"deployment_uuid":"[^"]+"' /tmp/klarwerk-live-update.json | head -1 | sed 's/.*:"//; s/"$//')" || true
echo "✓ Deploy angestoßen (${DUUID:-uuid unbekannt}). Warte auf Fertigstellung …"

# Auf den Deploy-Status warten (bis ~4 Min). „finished/success" = fertig, „failed/error/cancel" = rot.
STATE="unbekannt"
if [ -n "${DUUID}" ]; then
  for _ in $(seq 1 48); do
    RESP="$(curl -sS --max-time 15 -H "Authorization: Bearer ${TOKEN}" \
      "${COOLIFY_URL}/api/v1/deployments/${DUUID}" 2>/dev/null || true)"
    STATE="$(printf '%s' "${RESP}" | grep -oE '"status":"[^"]+"' | head -1 | sed 's/.*:"//; s/"$//')" || true
    STATE="${STATE:-unbekannt}"
    case "${STATE}" in
      *finish*|*success*|*done*) STATE="finished"; break ;;
      *fail*|*error*|*cancel*)   STATE="failed";   break ;;
    esac
    printf "."
    sleep 5
  done
  echo ""
fi

# Live-Seite prüfen (nach dem Deploy startet der Container kurz neu).
HEALTH="nein"
for _ in $(seq 1 20); do
  if curl -s --max-time 8 "${LIVE_URL}/health" | grep -q '"status":"ok"'; then HEALTH="ja"; break; fi
  sleep 3
done

echo ""
echo "════════════════════════════════════════════════════════"
if [ "${STATE}" = "finished" ] && [ "${HEALTH}" = "ja" ]; then
  echo "✓ LIVE-SEITE OK & AKTUALISIERT"
  echo "  → ${LIVE_URL}  (Stand: GitHub main / Version aus version.ts)"
  echo "  Tipp: Browser mit Cmd+Shift+R hart neu laden (Cache)."
elif [ "${STATE}" = "failed" ]; then
  echo "✗ DEPLOY FEHLGESCHLAGEN"
  echo "  Log-Ende in Coolify → Deployments → oberster Eintrag."
  echo "  Die alte Live-Version läuft weiter (kein Ausfall)."
else
  echo "… DEPLOY LÄUFT NOCH ODER STATUS UNKLAR (Status: ${STATE}, Health: ${HEALTH})"
  echo "  Fortschritt: ${COOLIFY_URL} → Deployments. Seite: ${LIVE_URL}"
fi
echo "════════════════════════════════════════════════════════"
