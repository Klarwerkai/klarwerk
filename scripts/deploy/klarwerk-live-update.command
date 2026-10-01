#!/bin/bash
# KLARWERK Live-Update — stößt den Coolify-Deploy für app.klarwerk.ai an (klarwerk-prod)
# und WARTET, bis er fertig ist — mit klarer Schluss-Meldung (GELIEFERT / NICHT GELIEFERT / AUSFALL).
#
# Ablauf, in dem dieses Skript benutzt wird (Reihenfolge ist wichtig):
#   1. Runner fahren → ALLE GATES GRÜN
#   2. Committen, dann KLARWERK Sync (Push zu GitHub — Coolify baut aus dem GitHub-Stand!)
#   3. DIESES Skript ausführen → Coolify zieht main (HEAD) und baut das Dockerfile neu.
#
# Aufruf: klarwerk-live-update.command <voller Commit, der live gehen soll>
#   (oder KLARWERK_ERWARTETER_COMMIT setzen). klarwerk-ship.command reicht den gepushten HEAD.
#
# R-0786 — GELIEFERT HEISST: der Server meldet über /health GESUND UND GENAU DIESEN Commit.
# `"status":"ok"` allein belegt nur, dass IRGENDEIN Stand antwortet — auch der alte. Deshalb:
#   Exit 0  geliefert: Deployment-Status genau `finished`, Coolify nennt für DIESES Deployment
#           genau den erwarteten vollen Commit, /health ok und /health.commit == derselbe Commit
#   Exit 1  AUSFALL (Deployment `failed` oder `cancelled-by-user`) oder Aufruf ohne erwarteten Commit
#   Exit 2  NICHT GELIEFERT: Status unbekannt/nicht abgeschlossen, Deployment-Commit fehlt, ist
#           verkürzt oder weicht ab, oder /health meldet einen anderen/unbekannten Commit. Passt
#           nur /health, heißt das TEILNACHWEIS — die Kette Deployment → HTTP ist dann nicht belegt.
# Jeder Exit ungleich 0 ist ein Fehlschlag; der Aufrufer darf danach NICHT „fertig" melden.
#
# Einmalige Einrichtung (Pedi): Coolify → Security → API Tokens → Token mit deploy-Recht,
# in den Schlüsselbund: security add-generic-password -a klarwerk -s KLARWERK-LiveUpdate -w 'TOKEN'
set -euo pipefail

APP_UUID="b3rgijsv5jtuhreh9ypyjase"   # Coolify-App „adventurous-ant"
COOLIFY_URL="https://deploy.klarwerk.ai"
LIVE_URL="https://app.klarwerk.ai"
ERWARTET="${1:-${KLARWERK_ERWARTETER_COMMIT:-}}"

echo "KLARWERK Live-Update — $(date '+%d.%m.%Y %H:%M')"
echo "Ziel: ${LIVE_URL} (Hetzner, Coolify klarwerk-prod)"
echo ""

# Nur ein VOLLER Commit (40 Hex) taugt als Vergleich — ein Kurz-SHA oder Branchname ist keiner.
if ! printf '%s' "${ERWARTET}" | grep -qE '^[0-9a-f]{40}$'; then
  echo "✗ Kein voller erwarteter Commit übergeben (40 Hex-Zeichen, z. B. \$(git rev-parse HEAD))."
  echo "  Ohne ihn lässt sich nicht prüfen, ob der neue Stand live ist — es wird nichts deployt."
  exit 1
fi
echo "Erwarteter Stand: ${ERWARTET}"

# Antworten werden STRUKTURELL gelesen (node liegt jedem KLARWERK-Arbeitsplatz bei, Node 20+):
# eine Textsuche nach `"status":"ok"` findet auch verschachtelte oder anders formatierte Stellen.
if ! command -v node >/dev/null 2>&1; then
  echo "✗ node fehlt — ohne JSON-Auswertung lässt sich keine Lieferung bestätigen; es wird nichts deployt."
  exit 1
fi

# json_feld <pfad>: liest JSON von stdin, Pfad mit Punkten (z. B. deployments.0.deployment_uuid).
#   Exit 0 + Wert   Feld ist ein String
#   Exit 3          kein gültiges JSON-Objekt
#   Exit 4          Feld vorhanden, aber kein String
#   Exit 5          Feld fehlt
json_feld() {
  node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; }).on("end", () => {
  let o;
  try { o = JSON.parse(s); } catch { process.exit(3); }
  if (o === null || typeof o !== "object" || Array.isArray(o)) process.exit(3);
  for (const teil of process.argv[1].split(".")) {
    if (o === null || typeof o !== "object" || !Object.hasOwn(o, teil)) process.exit(5);
    o = o[teil];
  }
  if (typeof o !== "string") process.exit(4);
  process.stdout.write(o);
});' "$1"
}

# abruf <curl-Argumente…>: Body + Zeilenumbruch + HTTP-Code. Exit ≠ 0 bei jedem Transportfehler —
# eine teilweise gelieferte Antwort (z. B. curl-Exit 18) zählt NIE.
abruf() {
  curl -sS --connect-timeout 10 --max-time 15 -w '\n%{http_code}' "$@" 2>/dev/null
}
NL=$'\n'
abruf_code() { printf '%s' "${1##*"${NL}"}"; }
abruf_body() { printf '%s' "${1%"${NL}"*}"; }

TOKEN="$(security find-generic-password -s KLARWERK-LiveUpdate -w 2>/dev/null || true)"
if [ -z "${TOKEN}" ]; then
  echo "✗ Kein API-Token im Schlüsselbund (Eintrag: KLARWERK-LiveUpdate)."
  exit 1
fi

echo "Erinnerung: Deployt wird der GitHub-Stand von main — vorher Runner grün + Sync!"
echo "Stoße Deploy an …"
ANTWORT="${TMPDIR:-/tmp}/klarwerk-live-update.json"
HTTP="$(curl -sS --connect-timeout 10 --max-time 30 \
  -o "${ANTWORT}" -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${COOLIFY_URL}/api/v1/deploy?uuid=${APP_UUID}&force=false")" || {
  echo "✗ Coolify nicht erreichbar oder Zeitüberschreitung (${COOLIFY_URL})."
  exit 1
}
if [ "${HTTP}" != "200" ] && [ "${HTTP}" != "201" ]; then
  echo "✗ Coolify hat mit HTTP ${HTTP} geantwortet:"; cat "${ANTWORT}"; echo
  echo "  Token abgelaufen/ohne deploy-Recht? In Coolify → Security → API Tokens prüfen."
  exit 1
fi


# Deployment-UUID aus der Antwort ziehen — strukturell, nicht per Textsuche.
DUUID="$(json_feld deployments.0.deployment_uuid < "${ANTWORT}" 2>/dev/null)" || DUUID=""
echo "✓ Deploy angestoßen (${DUUID:-uuid unbekannt}). Warte auf Fertigstellung …"

# Auf den Deploy-Status warten (bis ~4 Min). Anerkannt werden NUR die vollständigen Werte, die
# Coolify v4 für Deployments kennt: `finished` = fertig; `failed` und `cancelled-by-user` = AUSFALL;
# `queued` und `in_progress` = weiter warten. Jeder andere Wert (auch `not_finished`, `success`,
# `done`) bleibt UNKLAR — keine Teilwortsuche, sonst würde aus „not_finished" ein „finished".
# DCOMMIT: der Commit, den Coolify für DIESES Deployment nennt. Anerkannt wird nur ein voller
# Commit (40 Hex). „fehlt" = Feld nicht vorhanden, „verkürzt" = Präfix, „ungültig" = sonst etwas
# (z. B. `HEAD`). Alle drei verhindern die Lieferbestätigung.
STATE="unbekannt"
STATUS_ROH="unbekannt"
DCOMMIT="fehlt"
if [ -n "${DUUID}" ]; then
  for _ in $(seq 1 48); do
    ROH="$(abruf -H "Authorization: Bearer ${TOKEN}" "${COOLIFY_URL}/api/v1/deployments/${DUUID}")" || ROH=""
    STATUS_ROH="unbekannt"
    if [ -n "${ROH}" ] && [ "$(abruf_code "${ROH}")" = "200" ]; then
      BODY="$(abruf_body "${ROH}")"
      STATUS_ROH="$(printf '%s' "${BODY}" | json_feld status 2>/dev/null)" || STATUS_ROH="unbekannt"
      STATUS_ROH="${STATUS_ROH:-unbekannt}"
      D_CODE=0
      D="$(printf '%s' "${BODY}" | json_feld commit 2>/dev/null)" || D_CODE=$?
      if [ "${D_CODE}" -eq 5 ]; then DCOMMIT="fehlt"
      elif [ "${D_CODE}" -eq 0 ] && printf '%s' "${D}" | grep -qE '^[0-9a-f]{40}$'; then DCOMMIT="${D}"
      elif [ "${D_CODE}" -eq 0 ] && printf '%s' "${D}" | grep -qE '^[0-9a-f]{7,39}$'; then DCOMMIT="verkürzt (${D})"
      else DCOMMIT="ungültig"; fi
    fi
    STATE="unbekannt"
    case "${STATUS_ROH}" in
      finished)                 STATE="finished"; break ;;
      failed|cancelled-by-user) STATE="failed";   break ;;
    esac
    printf "."
    sleep 5
  done
  echo ""
fi

# Live-Seite prüfen (nach dem Deploy startet der Container kurz neu). Gesund reicht nicht:
# /health muss GENAU den erwarteten vollen Commit melden, sonst antwortet noch der alte Stand.
# Gezählt wird nur ein Abruf ohne Transportfehler, mit HTTP 200 und gültigem JSON-Objekt, dessen
# EIGENE Felder `status` == "ok" und `commit` == erwarteter Commit sind.
HEALTH="nein"
LCOMMIT="unbekannt"
if [ "${STATE}" = "finished" ]; then
  for _ in $(seq 1 40); do
    HEALTH="nein"
    LCOMMIT="unbekannt"
    ROH="$(abruf "${LIVE_URL}/health")" || ROH=""
    if [ -n "${ROH}" ] && [ "$(abruf_code "${ROH}")" = "200" ]; then
      BODY="$(abruf_body "${ROH}")"
      S="$(printf '%s' "${BODY}" | json_feld status 2>/dev/null)" || S=""
      if [ "${S}" = "ok" ]; then
        HEALTH="ja"
        LCOMMIT="$(printf '%s' "${BODY}" | json_feld commit 2>/dev/null)" || LCOMMIT=""
        LCOMMIT="${LCOMMIT:-unbekannt}"
        if [ "${LCOMMIT}" = "${ERWARTET}" ]; then break; fi
      fi
    fi
    sleep 3
  done
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Erwartet: ${ERWARTET}"
echo "  Coolify:  ${DCOMMIT} (Deployment ${DUUID:-unbekannt}, Status ${STATUS_ROH})"
echo "  /health:  ${LCOMMIT} (gesund: ${HEALTH})"
if [ "${STATE}" = "failed" ]; then
  echo "✗ AUSFALL: AUSLIEFERUNG FEHLGESCHLAGEN — der neue Stand ist NICHT live."
  echo "  Log-Ende in Coolify → Deployments → oberster Eintrag."
  echo "════════════════════════════════════════════════════════"
  exit 1
fi
# Geliefert heißt: EINE Kette. Der erwartete Commit ist genau der, den Coolify für dieses
# Deployment nennt, und genau der, den /health meldet. Kein Präfix, kein fehlendes Feld.
if [ "${STATE}" = "finished" ] && [ "${DCOMMIT}" = "${ERWARTET}" ] && [ "${HEALTH}" = "ja" ] \
  && [ "${LCOMMIT}" = "${ERWARTET}" ]; then
  echo "✓ GELIEFERT: LIVE-SEITE GESUND UND AUF DEM ERWARTETEN STAND"
  echo "  → ${LIVE_URL}"
  echo "  Tipp: Browser mit Cmd+Shift+R hart neu laden (Cache)."
  echo "════════════════════════════════════════════════════════"
  exit 0
fi
if [ "${STATE}" = "finished" ] && [ "${HEALTH}" = "ja" ] && [ "${LCOMMIT}" = "${ERWARTET}" ]; then
  echo "✗ NICHT GELIEFERT (TEILNACHWEIS): /health meldet gesund den erwarteten Commit, aber der"
  echo "  Deployment-Commit ist nicht als genau dieser volle Commit belegt (Coolify: ${DCOMMIT})."
  echo "  Die Kette Deployment → HTTP ist damit nicht geschlossen."
  echo "════════════════════════════════════════════════════════"
  exit 2
fi
echo "✗ NICHT GELIEFERT: der erwartete Stand ist live NICHT bestätigt."
echo "  Fortschritt: ${COOLIFY_URL} → Deployments. Seite: ${LIVE_URL}/health"
echo "════════════════════════════════════════════════════════"
exit 2
