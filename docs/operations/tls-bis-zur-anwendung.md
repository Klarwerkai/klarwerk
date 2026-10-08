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

## Umstellung der Installation app.klarwerk.ai

Werte aus dem Betriebsbefund vom 08.10.2026 — vor dem Lauf nicht zu ändern, die Skripte prüfen sie:

| Gegenstand | Wert |
| --- | --- |
| Coolify-Anwendung | `b3rgijsv5jtuhreh9ypyjase` |
| Traefik-Dienst | `https-1-b3rgijsv5jtuhreh9ypyjase` (Port-Label `3000`) |
| Proxy-Container | `coolify-proxy` (traefik:v3.6), Dateikonfiguration aus `/traefik/dynamic` |
| Docker-Netz | `coolify` |
| Zertifikatsname | `klarwerk-app` (SAN zusätzlich `127.0.0.1` für den Selbsttest) |
| Zertifikatsdateien auf dem Wirt | `/data/klarwerk/tls/` (CA-Schlüssel getrennt in `/data/klarwerk/tls-ca/`, nur root) |
| Einbindung im App-Container | `/run/klarwerk-tls/` |

### Schritt 1 — Server (root): Zertifikate und Proxy-Transport

```sh
bash <repo>/scripts/betrieb/tls-intern-einrichten.sh
```

Das Skript bricht ab, wenn `coolify-proxy` keine Dateikonfiguration aus `/traefik/dynamic` liest.
Es legt die interne CA und das Serverzertifikat an, gibt den Vertrauensanker dem Proxy und schreibt
`<wirt-von-/traefik>/dynamic/klarwerk-intern.yml`:

```yaml
http:
  serversTransports:
    klarwerk-intern:
      serverName: klarwerk-app
      rootCAs:
        - /traefik/klarwerk-intern/ca.pem
```

Es ist idempotent, ändert nichts an der laufenden Anwendung und gibt keinen Schlüssel aus. Die
Datei wirkt erst, wenn die Labels aus Schritt 2 auf sie zeigen.

### Schritt 2 — Coolify-Anwendung `b3rgijsv5jtuhreh9ypyjase`, ein Ausrollen

Alles zusammen setzen und **in einem** Ausrollen des Kandidaten übernehmen — Anwendung und Proxy
wechseln damit gemeinsam. Getrennt ausgerollt spräche einer der beiden Klartext gegen TLS.

- Persistent Storage, Verzeichnis-Einbindung: `/data/klarwerk/tls` → `/run/klarwerk-tls`
- Umgebung:

  ```
  KLARWERK_TLS_CERT_FILE=/run/klarwerk-tls/app.pem
  KLARWERK_TLS_KEY_FILE=/run/klarwerk-tls/app.key
  KLARWERK_TLS_CA_FILE=/run/klarwerk-tls/ca.pem
  KLARWERK_TLS_SERVERNAME=klarwerk-app
  ```

- Container Labels, zusätzlich zu den vorhandenen:

  ```
  traefik.http.services.https-1-b3rgijsv5jtuhreh9ypyjase.loadbalancer.server.scheme=https
  traefik.http.services.https-1-b3rgijsv5jtuhreh9ypyjase.loadbalancer.serversTransport=klarwerk-intern@file
  ```

Kein `insecureSkipVerify`. Der Container-Selbsttest prüft danach selbst über HTTPS gegen die CA.

### Schritt 3 — Server (root): Nachweis mit Kandidatenbezug

```sh
bash <repo>/scripts/betrieb/tls-intern-nachweis.sh <40-stelliger-commit-des-kandidaten>
```

Misst an der laufenden Installation, ohne etwas zu ändern, und schreibt den Beleg nach
`/data/klarwerk/tls-nachweis/`. Bestanden nur, wenn alle sechs Proben gelten:

| Probe | Erwartung |
| --- | --- |
| N1 | Image-Tag des App-Containers trägt den Commit |
| N2 | App-Umgebung mit Zertifikat und Schlüssel; Labels `scheme=https`, `serversTransport=klarwerk-intern@file`; Transportdatei mit `rootCAs`, ohne `insecureSkipVerify` |
| N3 | aus `coolify-proxy`: `http://<app-ip>:3000/health` scheitert |
| N4 | im Netz `coolify`: `https://<app-ip>:3000/health` mit Servername `klarwerk-app` und interner CA → 200 und der Commit |
| N5 | dieselbe Verbindung ohne den internen Anker wird abgelehnt (die Prüfung wirkt) |
| N6 | `https://app.klarwerk.ai/health` → 200 und der Commit — über den Proxy, dessen Upstream nur noch geprüftes TLS annimmt |

Erst nach bestandenem Nachweis `KLARWERK_TLS_PFLICHT=1` in Coolify setzen und erneut ausrollen;
ab dann kann ein Neustart nicht mehr still in den Klartext fallen.

Grenze von N4: Das Traefik-Image bringt kein Werkzeug mit, das Zertifikate gegen eine eigene CA
prüft (sein `wget` kennt keinen Anker). Die geprüfte TLS-Verbindung wird deshalb im selben Netz aus
dem App-Container zur Container-IP gemessen; dass der Proxy selbst prüft, belegen N2 (Konfiguration
ohne Abschaltung) zusammen mit N3 und N6.

### Rückweg

Labels und die vier Umgebungswerte aus Schritt 2 entfernen, `KLARWERK_TLS_PFLICHT` entfernen, neu
ausrollen. Die Anwendung spricht dann wieder Klartext, mit Warnung im Protokoll. Die Dateien aus
Schritt 1 dürfen liegen bleiben; ohne Labels wirken sie nicht.

## Zertifikatswechsel

Das Serverzertifikat gilt 397 Tage. `tls-intern-einrichten.sh` stellt es neu aus, wenn es in weniger
als 30 Tagen abläuft; danach die Anwendung neu starten, sie liest die Dateien beim Start.
