# TLS vom Proxy bis zur Anwendung (R-2057 / NFR-SEC-02)

R-2057 verlangt „Transport durchgängig TLS … AK: kein Klartext-Transport". Der Betriebsbefund vom
08.10.2026 (Auftragsordner `QUELLEN-TLS-BETRIEBSBEFUND-20261008.json`) hat gemessen:

- öffentlich `app.klarwerk.ai` und `klarwerk.ai`: TLS 1.2/1.3, Zertifikat und Hostname geprüft;
- Traefik → Anwendung im Docker-Netz `coolify`: `http://10.0.1.10:3000/health` antwortet im
  Klartext, `https://` an denselben Port scheitert (`wrong version number`). Das Label
  `loadbalancer.server.scheme` fehlt, die Anwendung konnte kein TLS.

## Was die Anwendung jetzt kann

`services/app/src/transport-tls.ts`, verdrahtet in `server.ts` und `buildApp`:

| Variable | Wirkung |
| --- | --- |
| `KLARWERK_TLS_CERT_FILE` + `KLARWERK_TLS_KEY_FILE` | Der App-Port nimmt nur noch TLS an (mindestens 1.2). Klartext an denselben Port bekommt keine Antwort. |
| nur eine der beiden | Startabbruch mit beiden Namen. |
| Datei unlesbar | Startabbruch mit dem Variablennamen. |
| `KLARWERK_TLS_PFLICHT=1` | Startabbruch, wenn kein Zertifikat gesetzt ist. |
| `KLARWERK_TLS_CA_FILE`, `KLARWERK_TLS_SERVERNAME` | Nur für den Container-Selbsttest (`services/app/healthcheck.mjs`): Vertrauensanker und Name, gegen die er prüft. |

Ohne Zertifikat läuft die Anwendung wie bisher im Klartext; in Produktion steht dann eine Warnung
mit „R-2057" im Protokoll. Belegt in `tests/security/tls-bis-zur-anwendung.test.ts` (echter
Socket: HTTPS mit Prüfung 200, Klartext ohne Antwort, fremder Anker und falscher Name abgelehnt).

## Umstellung einer Installation (Coolify + Traefik)

Die Schritte brauchen Zugang zum Server und zur Coolify-Anwendung. Werte in spitzen Klammern sind
Platzhalter.

### 1. Interne CA und Serverzertifikat

Auf einem vertrauenswürdigen Rechner, nicht im Repository:

```sh
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 825 \
  -subj "/CN=KLARWERK interne CA" -keyout ca.key -out ca.pem \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -subj "/CN=klarwerk-app" -keyout app.key -out app.csr
printf 'subjectAltName=DNS:klarwerk-app,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\n' > app.ext
openssl x509 -req -in app.csr -CA ca.pem -CAkey ca.key -CAcreateserial -days 397 \
  -out app.pem -extfile app.ext
```

`ca.key` bleibt offline. `app.key` ist ein Geheimnis der Installation.

### 2. Dateien und Umgebung der Anwendung

In Coolify als schreibgeschützte Datei-Einbindung (lesbar für Benutzer `node`), z. B. unter
`/run/klarwerk-tls/`: `app.pem`, `app.key`, `ca.pem`. Umgebung:

```
KLARWERK_TLS_CERT_FILE=/run/klarwerk-tls/app.pem
KLARWERK_TLS_KEY_FILE=/run/klarwerk-tls/app.key
KLARWERK_TLS_CA_FILE=/run/klarwerk-tls/ca.pem
KLARWERK_TLS_SERVERNAME=klarwerk-app
```

### 3. Traefik: Upstream über HTTPS, mit Prüfung

Dynamische Datei im Konfigurationsordner des Coolify-Proxys (vor Ort prüfen, wo er eingebunden ist),
`ca.pem` daneben für den Proxy lesbar:

```yaml
http:
  serversTransports:
    klarwerk-intern:
      serverName: klarwerk-app
      rootCAs:
        - <pfad-im-proxy>/ca.pem
```

Labels der Anwendung (Coolify, „Container Labels"), zusätzlich zu den vorhandenen:

```
traefik.http.services.<dienst>.loadbalancer.server.scheme=https
traefik.http.services.<dienst>.loadbalancer.serversTransport=klarwerk-intern@file
```

`<dienst>` ist der Name aus dem vorhandenen Label `…loadbalancer.server.port` (gemessen:
`https-1-b3rgijsv5jtuhreh9ypyjase`). Kein `insecureSkipVerify`.

### 4. Reihenfolge

1. Datei aus Schritt 3 anlegen (wirkt erst mit den Labels).
2. Dateien, Umgebung und Labels aus Schritt 2 und 3 setzen und **in einem** Ausrollen übernehmen —
   Anwendung und Proxy wechseln damit gemeinsam. Getrennt ausgerollt, spräche einer der beiden
   Klartext gegen TLS, und die Instanz wäre bis zum zweiten Schritt nicht erreichbar.
3. Nachweis (unten). Erst danach `KLARWERK_TLS_PFLICHT=1` setzen.

### 5. Nachweis

Vom laufenden Proxy-Container, mit Bezug zur ausgelieferten Fassung:

```sh
docker exec coolify-proxy wget -q -O - --ca-certificate=<pfad-im-proxy>/ca.pem \
  https://klarwerk-app:3000/health          # muss {"status":"ok","commit":"<kandidat>"} liefern
docker exec coolify-proxy wget -q -T 10 -O - http://<app-ip>:3000/health   # muss scheitern
curl -s https://app.klarwerk.ai/health                                     # derselbe commit
```

`klarwerk-app` muss dazu im Docker-Netz auflösbar sein (Netzwerk-Alias); sonst die IP verwenden und
den Namen über `--header`/SNI-fähiges Werkzeug prüfen. Das Protokoll des Proxys darf nach dem
Ausrollen keine `x509`-Fehler für den Dienst zeigen.

### Rückweg

Labels aus Schritt 3 und die vier Umgebungswerte entfernen, `KLARWERK_TLS_PFLICHT` entfernen, neu
ausrollen. Die Anwendung spricht dann wieder Klartext, mit Warnung im Protokoll.

## Zertifikatswechsel

Die Anwendung liest Zertifikat und Schlüssel beim Start. Nach einem Wechsel der Dateien neu starten.
