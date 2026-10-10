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
#   N2  Konfiguration: App-Umgebung trägt KLARWERK_TLS_CERT_FILE/KEY_FILE; JEDER Traefik-Dienst
#       der App (jedes Label `…services.<dienst>.loadbalancer.server.port`) steht auf scheme=https
#       und serversTransport=klarwerk-intern@file — darunter mindestens die beiden gemessenen
#       HTTPS-Dienste https-0 (klarwerk.ai) und https-1 (app.klarwerk.ai); die Transportdatei des
#       Proxys trägt rootCAs und kein insecureSkipVerify.
#   N3  Klartext abgewiesen — als PROTOKOLLABLEHNUNG, nicht als irgendein Fehler:
#       N3a (Socket, im Docker-Netz): TCP-Verbindung zu <app-ip>:<port> kommt zustande, eine
#           HTTP-Anfrage im Klartext bekommt KEINE HTTP-Antwort, die Gegenstelle baut ab.
#       N3b (aus coolify-proxy): wget ist vorhanden, die Verbindung kommt zustande und wird beim
#           Lesen der Antwort abgebrochen. Verweigerte Verbindung, Zeitüberschreitung, unbekannte
#           Adresse oder fehlendes Werkzeug heissen „ungeklärt", nie „abgewiesen".
#   N4  TLS mit Prüfung: im Docker-Netz liefert https://<app-ip>:<port>/health mit Servername
#       klarwerk-app und der internen CA als Anker 200 und <commit>.
#   N5  Gegenprobe Prüfung: dieselbe Verbindung OHNE den internen Anker scheitert mit einem
#       ZERTIFIKATSPRÜFFEHLER (Liste unten). Jeder andere Fehler — oder ein gescheitertes N4 — heisst
#       „ungeklärt".
#   N6  Tatsächliche Proxywege: https://klarwerk.ai/health UND https://app.klarwerk.ai/health
#       antworten je mit Status 200, und das JSON trägt genau <commit>. Da die Anwendung Klartext
#       abweist (N3) und der Proxy ohne insecureSkipVerify prüft (N2), kommen diese Antworten nur
#       über den geprüften TLS-Upstream. Scheitert einer der beiden Wege, scheitert der Nachweis.
# Jede Probe steht mit ihrem Grund im Beleg. Der Beleg geht als JSON auf die Standardausgabe und nach
# /data/klarwerk/tls-nachweis/. Exitcode 0 nur, wenn N1 bis N6 bestanden sind; „ungeklärt" ist
# nicht bestanden.
set -euo pipefail

ERWARTET="${1:-}"
[[ "$ERWARTET" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Aufruf: tls-intern-nachweis.sh <40-stelliger Commit des Kandidaten>" >&2
  exit 2
}

APP_UUID="b3rgijsv5jtuhreh9ypyjase"
# Die beiden gemessenen HTTPS-Dienste (Abgleich 08.10.2026): https-0 → klarwerk.ai,
# https-1 → app.klarwerk.ai, beide auf denselben App-Port.
PFLICHT_DIENSTE="https-0-${APP_UUID} https-1-${APP_UUID}"
TRANSPORT_SOLL="klarwerk-intern@file"
PROXY="coolify-proxy"
NETZ="coolify"
OEFFENTLICH="https://klarwerk.ai/health https://app.klarwerk.ai/health"
BELEGE="${KLARWERK_TLS_NACHWEIS_DIR:-/data/klarwerk/tls-nachweis}"

APP="$(docker ps --filter "name=^${APP_UUID}-" --format '{{.Names}}' | head -n 1)"
[ -n "$APP" ] || { echo "ABBRUCH: kein laufender App-Container ${APP_UUID}-*" >&2; exit 1; }
IP="$(docker inspect -f "{{(index .NetworkSettings.Networks \"${NETZ}\").IPAddress}}" "$APP")"
label() { docker inspect -f "{{index .Config.Labels \"traefik.http.services.$1.loadbalancer.$2\"}}" "$APP"; }
PORT="$(label "https-1-${APP_UUID}" server.port)"
IMAGE="$(docker inspect -f '{{.Config.Image}}' "$APP")"
DIENSTE="$(docker inspect -f '{{range $k, $v := .Config.Labels}}{{println $k}}{{end}}' "$APP" \
  | sed -n 's/^traefik\.http\.services\.\([^.]*\)\.loadbalancer\.server\.port$/\1/p' | sort -u | tr '\n' ' ')"
ENV_NAMEN="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$APP" | sed -n 's/^\(KLARWERK_TLS_[A-Z_]*\)=.*/\1/p' | sort | tr '\n' ' ')"
PROXY_WURZEL="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/traefik"}}{{.Source}}{{end}}{{end}}' "$PROXY")"
TRANSPORTDATEI="${PROXY_WURZEL}/dynamic/klarwerk-intern.yml"

ok() { if "$@"; then echo true; else echo false; fi; }
# Freitext für den JSON-Beleg: ohne Anführungszeichen, Rückstriche und Zeilenumbrüche, gekürzt.
# `$(cat)` streicht abschließende Zeilenumbrüche, sonst würde aus "https\n" ein "https ".
textfeld() {
  local t
  t="$(cat)"
  t="${t//[\"\\]/}"
  t="${t//[$'\n\r\t']/ }"
  printf '%s' "${t:0:300}"
}

# N1 — Kandidatenbezug
N1_IMAGE="$(ok grep -q "$ERWARTET" <<<"$IMAGE")"

# N2 — Konfiguration
if [[ " $ENV_NAMEN " == *" KLARWERK_TLS_CERT_FILE "* && " $ENV_NAMEN " == *" KLARWERK_TLS_KEY_FILE "* ]]; then
  N2_ENV=true
else
  N2_ENV=false
fi
# Jeder Dienst einzeln: ein fehlender Pflichtdienst oder ein einziger Dienst ohne geprüftes TLS
# lässt N2 scheitern.
N2_LABELS=true
N2_DIENSTE_JSON=""
[ -n "${DIENSTE// /}" ] || N2_LABELS=false
for d in $PFLICHT_DIENSTE; do
  if [[ " $DIENSTE " != *" $d "* ]]; then
    N2_LABELS=false
    N2_DIENSTE_JSON+="{\"dienst\":\"${d}\",\"fehlt\":true,\"ok\":false},"
  fi
done
for d in $DIENSTE; do
  d_schema="$(label "$d" server.scheme | textfeld)"
  d_transport="$(label "$d" serversTransport | textfeld)"
  d_port="$(label "$d" server.port | textfeld)"
  d_ok=false
  if [ "$d_schema" = "https" ] && [ "$d_transport" = "$TRANSPORT_SOLL" ] && [ "$d_port" = "$PORT" ]; then
    d_ok=true
  else
    N2_LABELS=false
  fi
  N2_DIENSTE_JSON+="{\"dienst\":\"$(textfeld <<<"$d")\",\"scheme\":\"${d_schema}\",\"serversTransport\":\"${d_transport}\",\"port\":\"${d_port}\",\"ok\":${d_ok}},"
done
N2_DIENSTE_JSON="[${N2_DIENSTE_JSON%,}]"
N2_DATEI="$( [ -s "$TRANSPORTDATEI" ] && grep -q 'rootCAs' "$TRANSPORTDATEI" && ! grep -qi 'insecureSkipVerify' "$TRANSPORTDATEI" && echo true || echo false )"

# N3b — Klartext aus dem Proxy-Container: nur eine abgebrochene Antwort zählt als Ablehnung.
N3B_EXIT=""
N3B_MELDUNG=""
if ! docker exec "$PROXY" sh -c 'command -v wget' >/dev/null 2>&1; then
  N3B="ungeklaert"
  N3B_MELDUNG="wget im Proxy-Container nicht vorhanden"
else
  set +e
  N3B_MELDUNG="$(docker exec "$PROXY" wget -q -T 10 -O /dev/null "http://${IP}:${PORT}/health" 2>&1)"
  N3B_EXIT=$?
  set -e
  N3B_MELDUNG="$(textfeld <<<"$N3B_MELDUNG")"
  if [ "$N3B_EXIT" = "0" ]; then
    N3B="klartext_angenommen"
  elif grep -qiE 'refused|timed out|timeout|bad address|unreachable|no route|not found|no such' <<<"$N3B_MELDUNG"; then
    N3B="ungeklaert"
  elif grep -qiE 'error getting response|reset by peer|unexpected eof|short read' <<<"$N3B_MELDUNG"; then
    N3B="abgewiesen"
  else
    N3B="ungeklaert"
  fi
fi

# N3a/N4/N5 — Socket- und TLS-Proben im Docker-Netz (Node im App-Container, eigene Container-IP).
# Der Block zwischen den JS-Marken wird von tests/security/tls-betriebsskripte.test.ts wörtlich
# gegen einen echten Server ausgeführt — Änderungen hier ändern die Gegenprobe mit.
read -r -d '' PROBE <<'JS' || true
const https = require("node:https");
const net = require("node:net");
const fs = require("node:fs");
// Fehlercodes, die eine abgelehnte ZERTIFIKATSPRÜFUNG bedeuten — und nur diese zählen für N5.
const PRUEFFEHLER = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_UNTRUSTED",
  "CERT_SIGNATURE_FAILURE",
]);
function klartext() {
  return new Promise((fertig) => {
    const s = net.connect({ host: process.env.ZIEL_IP, port: Number(process.env.ZIEL_PORT) });
    let verbunden = false;
    let daten = Buffer.alloc(0);
    let gemeldet = false;
    const ende = (r) => {
      if (gemeldet) return;
      gemeldet = true;
      s.destroy();
      fertig({ ...r, erste_bytes: daten.subarray(0, 16).toString("hex") });
    };
    const http = () => daten.toString("latin1").startsWith("HTTP/");
    s.setTimeout(5000);
    s.on("connect", () => {
      verbunden = true;
      s.write("GET /health HTTP/1.1\r\nHost: klarwerk-app\r\nConnection: close\r\n\r\n");
    });
    s.on("data", (d) => {
      daten = Buffer.concat([daten, d]);
      if (http()) ende({ ergebnis: "klartext_angenommen", grund: "HTTP-Antwort im Klartext" });
    });
    s.on("timeout", () =>
      ende({ ergebnis: "ungeklaert", grund: verbunden ? "weder Antwort noch Abbau" : "keine Verbindung" }),
    );
    s.on("error", (e) => {
      const code = e.code || e.message;
      if (!verbunden) return ende({ ergebnis: "ungeklaert", grund: `keine Verbindung: ${code}` });
      ende(http() ? { ergebnis: "klartext_angenommen", grund: code } : { ergebnis: "abgewiesen", grund: code });
    });
    s.on("close", () => {
      if (!verbunden) return ende({ ergebnis: "ungeklaert", grund: "geschlossen vor der Verbindung" });
      ende(
        http()
          ? { ergebnis: "klartext_angenommen", grund: "HTTP-Antwort im Klartext" }
          : { ergebnis: "abgewiesen", grund: "Verbindung ohne HTTP-Antwort abgebaut" },
      );
    });
  });
}
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
Promise.all([klartext(), probe(true), probe(false)]).then(([n3a, mit, ohne]) => {
  const n4 = mit.verbunden && mit.status === 200 && mit.commit === process.env.ERWARTET;
  let n5 = "ungeklaert";
  let n5_grund = "N4 nicht bestanden — ohne funktionierenden geprüften Weg sagt die Ablehnung nichts";
  if (n4 && ohne.verbunden) {
    n5 = "angenommen_ohne_anker";
    n5_grund = "Verbindung ohne internen Anker kam zustande";
  } else if (n4 && PRUEFFEHLER.has(ohne.fehler)) {
    n5 = "zertifikat_abgelehnt";
    n5_grund = ohne.fehler;
  } else if (n4) {
    n5_grund = `kein Zertifikatsprüffehler: ${ohne.fehler}`;
  }
  console.log(JSON.stringify({ n3a, n4, n5, n5_grund, mit, ohne }));
});
JS
TLS_PROBE="$(docker exec -e ZIEL_IP="$IP" -e ZIEL_PORT="$PORT" -e ERWARTET="$ERWARTET" "$APP" node -e "$PROBE" 2>&1 || true)"
N3A="$(grep -q '"n3a":{"ergebnis":"abgewiesen"' <<<"$TLS_PROBE" && echo abgewiesen || echo nicht_abgewiesen_oder_ungeklaert)"
N3="$( [ "$N3A" = abgewiesen ] && [ "$N3B" = abgewiesen ] && echo true || echo false )"
N4="$(ok grep -q '"n4":true' <<<"$TLS_PROBE")"
N5="$(ok grep -q '"n5":"zertifikat_abgelehnt"' <<<"$TLS_PROBE")"

# N6 — jeder öffentliche Weg: Status 200 UND das JSON trägt genau den Commit (ausgewertet von Node).
oeffentlich_pruefen() {
  local url="$1" datei status commit ok=false
  datei="$(mktemp)"
  set +e
  status="$(curl -sS --max-time 10 -o "$datei" -w '%{http_code}' "$url" 2>/dev/null)"
  commit="$(docker exec -i -e ERWARTET="$ERWARTET" "$APP" node -e '
let t = "";
process.stdin.on("data", (d) => { t += d; });
process.stdin.on("end", () => {
  try { console.log(JSON.parse(t).commit === process.env.ERWARTET ? "true" : "false"); }
  catch { console.log("false"); }
});' <"$datei" 2>/dev/null)"
  set -e
  rm -f "$datei"
  [ "$commit" = "true" ] || commit=false
  [[ "$status" =~ ^[0-9]{3}$ ]] || status="000"
  if [ "$status" = "200" ] && [ "$commit" = "true" ]; then ok=true; fi
  printf '{"url":"%s","status":"%s","commit_passt":%s,"ok":%s}' "$url" "$status" "$commit" "$ok"
}
N6=true
N6_JSON=""
for url in $OEFFENTLICH; do
  eintrag="$(oeffentlich_pruefen "$url")"
  [[ "$eintrag" == *'"ok":true}' ]] || N6=false
  N6_JSON+="${eintrag},"
done
N6_JSON="[${N6_JSON%,}]"
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
  "n2_dienste": ${N2_DIENSTE_JSON},
  "n2_labels_ok": ${N2_LABELS},
  "n2_transportdatei_mit_ca_ohne_skip": ${N2_DATEI},
  "n3a_socket": "${N3A}",
  "n3b_proxy": { "ergebnis": "${N3B}", "exit": "${N3B_EXIT}", "meldung": "${N3B_MELDUNG}" },
  "n3_klartext_als_protokoll_abgewiesen": ${N3},
  "n3a_n4_n5_probe": ${PROBE_JSON},
  "n4_tls_mit_pruefung": ${N4},
  "n5_ohne_anker_zertifikat_abgelehnt": ${N5},
  "n6_oeffentlich": ${N6_JSON},
  "n6_ok": ${N6},
  "bestanden": ${BESTANDEN}
}
EOF
)"

install -d -m 0750 "$BELEGE"
DATEI="${BELEGE}/nachweis-${ZEIT}-${ERWARTET:0:12}.json"
printf '%s\n' "$BELEG" | tee "$DATEI"
echo "Beleg: $DATEI" >&2
[ "$BESTANDEN" = true ]
