#!/usr/bin/env bash
# ==================================================================================================
# R-2057 — NACHWEIS: DER PROXY ERREICHT DIE ANWENDUNG NUR NOCH ÜBER GEPRÜFTES TLS (Schritt 3 von 3)
# ==================================================================================================
#
# Aufruf als root auf dem Server, NACH Schritt 1 (tls-intern-einrichten.sh) und dem Ausrollen mit
# den Coolify-Einstellungen aus Schritt 2:
#
#   bash /pfad/zum/repo/scripts/betrieb/tls-intern-nachweis.sh <erwarteter-commit>
#
# Gemessen wird an der laufenden Installation, nichts wird verändert:
#   N1  Kandidatenbezug: Image-Tag des App-Containers und öffentliches /health nennen <commit>.
#   N2  Konfiguration: App-Umgebung trägt KLARWERK_TLS_CERT_FILE/KEY_FILE; Labels des Dienstes
#       stehen auf scheme=https und serversTransport=klarwerk-intern@file; die Transportdatei
#       des Proxys trägt rootCAs und kein insecureSkipVerify.
#   N3  Klartext abgewiesen: aus dem Proxy-Container scheitert http://<app-ip>:<port>/health.
#   N4  TLS mit Prüfung: im Docker-Netz liefert https://<app-ip>:<port>/health mit Servername
#       klarwerk-app und der internen CA als Anker 200 und <commit>.
#   N5  Gegenprobe Prüfung: dieselbe Verbindung OHNE den internen Anker wird abgelehnt — die
#       Prüfung in N4 ist also wirksam, nicht nur vorhanden.
#   N6  Tatsächlicher Proxyweg: https://app.klarwerk.ai/health liefert 200 und <commit>. Da die
#       Anwendung Klartext abweist (N3) und der Proxy ohne insecureSkipVerify prüft (N2), kommt diese
#       Antwort nur über den geprüften TLS-Upstream.
# Der Beleg geht als JSON auf die Standardausgabe und nach /data/klarwerk/tls-nachweis/.
# Exitcode 0 nur, wenn N1 bis N6 bestanden sind.
set -euo pipefail

ERWARTET="${1:-}"
[[ "$ERWARTET" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Aufruf: tls-intern-nachweis.sh <40-stelliger Commit des Kandidaten>" >&2
  exit 2
}

APP_UUID="b3rgijsv5jtuhreh9ypyjase"
DIENST="https-1-${APP_UUID}"
PROXY="coolify-proxy"
NETZ="coolify"
OEFFENTLICH="https://app.klarwerk.ai/health"
BELEGE="/data/klarwerk/tls-nachweis"

APP="$(docker ps --filter "name=^${APP_UUID}-" --format '{{.Names}}' | head -n 1)"
[ -n "$APP" ] || { echo "ABBRUCH: kein laufender App-Container ${APP_UUID}-*" >&2; exit 1; }
IP="$(docker inspect -f "{{(index .NetworkSettings.Networks \"${NETZ}\").IPAddress}}" "$APP")"
PORT="$(docker inspect -f "{{index .Config.Labels \"traefik.http.services.${DIENST}.loadbalancer.server.port\"}}" "$APP")"
IMAGE="$(docker inspect -f '{{.Config.Image}}' "$APP")"
SCHEMA="$(docker inspect -f "{{index .Config.Labels \"traefik.http.services.${DIENST}.loadbalancer.server.scheme\"}}" "$APP")"
TRANSPORT="$(docker inspect -f "{{index .Config.Labels \"traefik.http.services.${DIENST}.loadbalancer.serversTransport\"}}" "$APP")"
ENV_NAMEN="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$APP" | sed -n 's/^\(KLARWERK_TLS_[A-Z_]*\)=.*/\1/p' | sort | tr '\n' ' ')"
PROXY_WURZEL="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/traefik"}}{{.Source}}{{end}}{{end}}' "$PROXY")"
TRANSPORTDATEI="${PROXY_WURZEL}/dynamic/klarwerk-intern.yml"

ok() { if "$@"; then echo true; else echo false; fi; }

# N1 — Kandidatenbezug
N1_IMAGE="$(ok grep -q "$ERWARTET" <<<"$IMAGE")"
OEFF_BODY="$(curl -sS --max-time 10 "$OEFFENTLICH" || true)"
N6="$(ok grep -q "\"commit\":\"${ERWARTET}\"" <<<"$OEFF_BODY")"

# N2 — Konfiguration
if [[ " $ENV_NAMEN " == *" KLARWERK_TLS_CERT_FILE "* && " $ENV_NAMEN " == *" KLARWERK_TLS_KEY_FILE "* ]]; then
  N2_ENV=true
else
  N2_ENV=false
fi
N2_LABELS="$( [ "$SCHEMA" = "https" ] && [ "$TRANSPORT" = "klarwerk-intern@file" ] && echo true || echo false )"
N2_DATEI="$( [ -s "$TRANSPORTDATEI" ] && grep -q 'rootCAs' "$TRANSPORTDATEI" && ! grep -qi 'insecureSkipVerify' "$TRANSPORTDATEI" && echo true || echo false )"

# N3 — Klartext aus dem Proxy-Container muss scheitern
if docker exec "$PROXY" wget -q -T 10 -O - "http://${IP}:${PORT}/health" >/dev/null 2>&1; then
  N3=false
else
  N3=true
fi

# N4/N5 — TLS im Docker-Netz, mit und ohne internen Anker (Node im App-Container, eigene IP)
read -r -d '' PROBE <<'JS' || true
const https = require("node:https");
const fs = require("node:fs");
function probe(mitAnker) {
  return new Promise((fertig) => {
    const optionen = {
      host: process.env.ZIEL_IP,
      port: Number(process.env.ZIEL_PORT),
      path: "/health",
      servername: "klarwerk-app",
      timeout: 5000,
      agent: false,
    };
    if (mitAnker) optionen.ca = fs.readFileSync(process.env.KLARWERK_TLS_CA_FILE || "/run/klarwerk-tls/ca.pem");
    const anfrage = https.get(optionen, (antwort) => {
      const protokoll = antwort.socket.getProtocol();
      let body = "";
      antwort.on("data", (t) => { body += t; });
      antwort.on("end", () => {
        let commit = null;
        try { commit = JSON.parse(body).commit ?? null; } catch {}
        fertig({ verbunden: true, status: antwort.statusCode, protokoll, commit });
      });
    });
    anfrage.on("timeout", () => anfrage.destroy(new Error("timeout")));
    anfrage.on("error", (e) => fertig({ verbunden: false, fehler: e.code || e.message }));
  });
}
Promise.all([probe(true), probe(false)]).then(([mit, ohne]) => {
  const n4 = mit.verbunden && mit.status === 200 && mit.commit === process.env.ERWARTET;
  const n5 = !ohne.verbunden;
  console.log(JSON.stringify({ n4, n5, mit, ohne }));
});
JS
TLS_PROBE="$(docker exec -e ZIEL_IP="$IP" -e ZIEL_PORT="$PORT" -e ERWARTET="$ERWARTET" "$APP" node -e "$PROBE" 2>&1 || true)"
N4="$(ok grep -q '"n4":true' <<<"$TLS_PROBE")"
N5="$(ok grep -q '"n5":true' <<<"$TLS_PROBE")"
# Nur eine JSON-Zeile der Probe geht in den Beleg; eine Fehlermeldung steht dort als null (N4/N5 false).
if [[ "$TLS_PROBE" == \{* ]]; then
  PROBE_JSON="$TLS_PROBE"
else
  PROBE_JSON="null"
  echo "TLS-Probe ohne Ergebnis: $TLS_PROBE" >&2
fi

ZEIT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BESTANDEN=false
if [ "$N1_IMAGE" = true ] && [ "$N2_ENV" = true ] && [ "$N2_LABELS" = true ] && [ "$N2_DATEI" = true ] \
  && [ "$N3" = true ] && [ "$N4" = true ] && [ "$N5" = true ] && [ "$N6" = true ]; then
  BESTANDEN=true
fi

BELEG="$(cat <<EOF
{
  "anforderung": "R-2057 / NFR-SEC-02",
  "zeit": "${ZEIT}",
  "erwarteter_commit": "${ERWARTET}",
  "app_container": "${APP}",
  "app_image": "${IMAGE}",
  "app_ziel": "${IP}:${PORT}",
  "n1_image_traegt_commit": ${N1_IMAGE},
  "n2_umgebung_tls": ${N2_ENV},
  "n2_labels": { "scheme": "${SCHEMA}", "serversTransport": "${TRANSPORT}", "ok": ${N2_LABELS} },
  "n2_transportdatei_mit_ca_ohne_skip": ${N2_DATEI},
  "n3_klartext_vom_proxy_abgewiesen": ${N3},
  "n4_n5_tls_probe": ${PROBE_JSON},
  "n4_tls_mit_pruefung": ${N4},
  "n5_ohne_anker_abgelehnt": ${N5},
  "n6_oeffentlicher_weg_commit": ${N6},
  "bestanden": ${BESTANDEN}
}
EOF
)"

install -d -m 0750 "$BELEGE"
DATEI="${BELEGE}/nachweis-${ZEIT}-${ERWARTET:0:12}.json"
printf '%s\n' "$BELEG" | tee "$DATEI"
echo "Beleg: $DATEI" >&2
[ "$BESTANDEN" = true ]
