#!/usr/bin/env bash
# ==================================================================================================
# R-2057 — TLS VOM PROXY ZUR ANWENDUNG: SERVERSEITIGE EINRICHTUNG (Schritt 1 von 3)
# ==================================================================================================
#
# Läuft als root auf dem Server der Installation app.klarwerk.ai (gemessen im Betriebsbefund vom
# 08.10.2026: Coolify-Anwendung b3rgijsv5jtuhreh9ypyjase, Proxy-Container coolify-proxy mit
# traefik:v3.6, gemeinsames Docker-Netz coolify). Anleitung: docs/operations/tls-bis-zur-anwendung.md
#
# WAS ES TUT (idempotent, ohne Neustart, ohne die laufende Anwendung zu berühren):
#   1. prüft, dass der Proxy Dateikonfiguration aus /traefik/dynamic liest — sonst Abbruch;
#   2. legt eine interne CA an (nur wenn noch keine da ist) und stellt ein Serverzertifikat für
#      `klarwerk-app` und 127.0.0.1 aus (neu, wenn es fehlt oder in weniger als 30 Tagen abläuft);
#   3. legt den Vertrauensanker für den Proxy ab und schreibt die serversTransport-Datei.
# Die Datei aus 3. wirkt erst, wenn die Labels der Anwendung auf sie zeigen (Schritt 2, Coolify).
#
# Es gibt nie einen Schlüssel aus. Der CA-Schlüssel bleibt auf dem Server unter /data/klarwerk/tls-ca
# (nur root); wer ihn offline lagern will, verschiebt ihn nach diesem Lauf. Alle Pfade sind absolut.
set -euo pipefail

PROXY="coolify-proxy"
TLS_DIR="/data/klarwerk/tls"           # wird in den App-Container nach /run/klarwerk-tls eingebunden
CA_DIR="/data/klarwerk/tls-ca"         # CA-Schlüssel, nur root
SERVERNAME="klarwerk-app"
APP_UID="1000"                         # Benutzer `node` im Image node:20-bookworm-slim

fehler() {
  echo "ABBRUCH: $*" >&2
  exit 1
}

[ "$(id -u)" = "0" ] || fehler "als root ausführen"
command -v openssl >/dev/null || fehler "openssl fehlt"
command -v docker >/dev/null || fehler "docker fehlt"
docker inspect "$PROXY" >/dev/null 2>&1 || fehler "Container $PROXY nicht gefunden"

# 1. Der Proxy muss Dateikonfiguration lesen, und /traefik muss vom Wirt eingebunden sein.
docker inspect -f '{{json .Config.Cmd}} {{json .Args}}' "$PROXY" | grep -q -- '--providers.file.directory=/traefik/dynamic' \
  || fehler "$PROXY liest keine Dateikonfiguration aus /traefik/dynamic"
PROXY_WURZEL="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/traefik"}}{{.Source}}{{end}}{{end}}' "$PROXY")"
[ -n "$PROXY_WURZEL" ] && [ -d "$PROXY_WURZEL/dynamic" ] \
  || fehler "kein Wirtsverzeichnis für /traefik/dynamic in $PROXY gefunden"

install -d -m 0700 "$CA_DIR"
install -d -m 0750 -o root -g "$APP_UID" "$TLS_DIR"

# 2a. Interne CA — nur beim ersten Lauf.
if [ ! -s "$CA_DIR/ca.key" ]; then
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 825 \
    -subj "/CN=KLARWERK interne CA" -keyout "$CA_DIR/ca.key" -out "$CA_DIR/ca.pem" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
  chmod 0400 "$CA_DIR/ca.key"
  echo "interne CA angelegt"
fi

# 2b. Serverzertifikat — neu, wenn es fehlt oder in weniger als 30 Tagen abläuft.
if [ ! -s "$TLS_DIR/app.pem" ] || ! openssl x509 -checkend 2592000 -noout -in "$TLS_DIR/app.pem"; then
  printf 'subjectAltName=DNS:%s,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\n' \
    "$SERVERNAME" >"$CA_DIR/app.ext"
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
    -subj "/CN=$SERVERNAME" -keyout "$TLS_DIR/app.key" -out "$CA_DIR/app.csr"
  openssl x509 -req -in "$CA_DIR/app.csr" -CA "$CA_DIR/ca.pem" -CAkey "$CA_DIR/ca.key" \
    -CAcreateserial -days 397 -out "$TLS_DIR/app.pem" -extfile "$CA_DIR/app.ext"
  echo "Serverzertifikat ausgestellt — die Anwendung liest es beim nächsten Start"
fi
cp "$CA_DIR/ca.pem" "$TLS_DIR/ca.pem"
chown "$APP_UID:$APP_UID" "$TLS_DIR/app.key" "$TLS_DIR/app.pem" "$TLS_DIR/ca.pem"
chmod 0400 "$TLS_DIR/app.key"
chmod 0444 "$TLS_DIR/app.pem" "$TLS_DIR/ca.pem"
openssl verify -CAfile "$TLS_DIR/ca.pem" "$TLS_DIR/app.pem" >/dev/null \
  || fehler "Serverzertifikat lässt sich gegen die eigene CA nicht prüfen"

# 3. Vertrauensanker und serversTransport für den Proxy.
install -d -m 0755 "$PROXY_WURZEL/klarwerk-intern"
install -m 0444 "$CA_DIR/ca.pem" "$PROXY_WURZEL/klarwerk-intern/ca.pem"
cat >"$PROXY_WURZEL/dynamic/klarwerk-intern.yml" <<YAML
# R-2057: Upstream der KLARWERK-Anwendung über HTTPS, geprüft gegen die interne CA.
# Geschrieben von scripts/betrieb/tls-intern-einrichten.sh. Die Prüfung bleibt eingeschaltet.
http:
  serversTransports:
    klarwerk-intern:
      serverName: ${SERVERNAME}
      rootCAs:
        - /traefik/klarwerk-intern/ca.pem
YAML

echo
echo "Fertig. Fingerabdruck des Serverzertifikats:"
openssl x509 -noout -fingerprint -sha256 -in "$TLS_DIR/app.pem"
echo
echo "Weiter mit Schritt 2 in Coolify (docs/operations/tls-bis-zur-anwendung.md):"
echo "  Verzeichnis einbinden: $TLS_DIR  ->  /run/klarwerk-tls"
echo "  Umgebung: KLARWERK_TLS_CERT_FILE=/run/klarwerk-tls/app.pem"
echo "            KLARWERK_TLS_KEY_FILE=/run/klarwerk-tls/app.key"
echo "            KLARWERK_TLS_CA_FILE=/run/klarwerk-tls/ca.pem"
echo "            KLARWERK_TLS_SERVERNAME=$SERVERNAME"
echo "  Labels für JEDEN Traefik-Dienst der Anwendung — die beiden gemessenen HTTPS-Dienste"
echo "  (https-0: klarwerk.ai, https-1: app.klarwerk.ai) teilen sich den App-Port, der danach nur"
echo "  noch TLS spricht; ein ausgelassener Dienst fiele aus:"
echo "    traefik.http.services.https-0-b3rgijsv5jtuhreh9ypyjase.loadbalancer.server.scheme=https"
echo "    traefik.http.services.https-0-b3rgijsv5jtuhreh9ypyjase.loadbalancer.serversTransport=klarwerk-intern@file"
echo "    traefik.http.services.https-1-b3rgijsv5jtuhreh9ypyjase.loadbalancer.server.scheme=https"
echo "    traefik.http.services.https-1-b3rgijsv5jtuhreh9ypyjase.loadbalancer.serversTransport=klarwerk-intern@file"

# Weitere Dienste mit Port-Label am laufenden App-Container: auch sie zeigen auf den App-Port.
APP="$(docker ps --filter "name=^b3rgijsv5jtuhreh9ypyjase-" --format '{{.Names}}' | head -n 1)"
if [ -z "$APP" ]; then
  echo "  HINWEIS: kein laufender App-Container gefunden — weitere Dienste nicht abgeglichen."
else
  WEITERE="$(docker inspect -f '{{range $k, $v := .Config.Labels}}{{println $k}}{{end}}' "$APP" \
    | sed -n 's/^traefik\.http\.services\.\([^.]*\)\.loadbalancer\.server\.port$/\1/p' | sort -u \
    | grep -vx -e 'https-0-b3rgijsv5jtuhreh9ypyjase' -e 'https-1-b3rgijsv5jtuhreh9ypyjase' || true)"
  for d in $WEITERE; do
    echo "    traefik.http.services.${d}.loadbalancer.server.scheme=https"
    echo "    traefik.http.services.${d}.loadbalancer.serversTransport=klarwerk-intern@file"
  done
fi
echo "  Der Nachweis (tls-intern-nachweis.sh) verlangt das für jeden Dienst mit Port-Label."
