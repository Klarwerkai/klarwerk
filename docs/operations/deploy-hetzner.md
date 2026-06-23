# Deploy-Runbook — KLARWERK auf Hetzner (Deutschland)

Ziel: das Backend professionell, EU-konform und dauerhaft verwaltbar betreiben.
Stack: **Hetzner Cloud (DE)** + **Coolify** (PaaS) + **Postgres** + **Cloudflare** (DNS/TLS)
+ **klarwerk.ai**. Käufe/Accounts/DNS machst **du**; das Repo ist deploy-ready.

---

## 0. Gewählte Konfiguration (Empfehlung, festgelegt)

- **Server:** Hetzner Cloud **CAX21** (4 vCPU ARM, 8 GB RAM, 80 GB NVMe), Standort **Falkenstein**.
- **Backups:** aktivieren (tägliche Snapshots).
- **Volume:** 10 GB für die Postgres-Daten (überlebt Server-Neuaufsetzen).
- Realistisch ~10 €/Monat, komplett in Deutschland.

---

## 1. Server bestellen (Hetzner Cloud Console)

1. Konto auf [console.hetzner.com](https://console.hetzner.com) anlegen, Projekt „KLARWERK".
2. **Add Server** → Location **Falkenstein** → Image **Ubuntu 24.04** → Typ **CAX21 (Arm64)**.
3. **Backups** anhaken. **Volume** 10 GB hinzufügen. SSH-Key hinterlegen.
4. Erstellen. Notiere die **öffentliche IPv4**.

## 2. Coolify installieren (das „eine Dashboard" für alle Setups)

Per SSH auf den Server, dann das offizielle Skript:

```bash
ssh root@DEINE_SERVER_IP
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Danach Coolify unter `http://DEINE_SERVER_IP:8000` öffnen und Admin-Konto anlegen.
Coolify verwaltet ab jetzt Deploys, HTTPS (Let's Encrypt), Umgebungsvariablen, Logs.

## 3. DNS auf Cloudflare (zentrale Verwaltung)

1. Domain **klarwerk.ai** bei [Cloudflare](https://dash.cloudflare.com) hinzufügen (Free-Plan).
2. Cloudflare zeigt dir zwei **Nameserver** → bei **GoDaddy** als Nameserver eintragen
   (Registrar bleibt GoDaddy, DNS macht Cloudflare).
3. A-Records auf die Server-IP setzen:
   - `app` → SERVER_IP (das Produkt, zum Herzeigen)
   - `api` → SERVER_IP (Backend, optional getrennt)
   - `www` und `@` → später die Landingpage
4. Coolify-Dashboard absichern: eigene Subdomain `deploy` → SERVER_IP (oder per SSH-Tunnel).

## 4. App in Coolify anlegen

Variante A (empfohlen, Git-verbunden): in Coolify **New Resource → Application**, das
Git-Repo verbinden (Gitea via „Git mit eigener URL"/Deploy-Key), Build-Pack **Dockerfile**.
Variante B (ohne Git): **Docker Compose** → Inhalt aus `docker-compose.prod.yml`.

Domain der App in Coolify auf `https://app.klarwerk.ai` setzen → Coolify holt automatisch
das TLS-Zertifikat.

## 5. Secrets / Umgebungsvariablen (in Coolify, nicht im Repo)

Pflicht:

- `DATABASE_URL` = `postgresql://klarwerk:STARKES_PASSWORT@db:5432/klarwerk`
  (oder Coolify-Postgres-Service anlegen und dessen URL nutzen)
- `COOKIE_SECURE` = `true`
- `APP_BASE_URL` = `https://app.klarwerk.ai`

Optional (schalten Funktionen scharf):

- `ANTHROPIC_API_KEY` → echtes KI-Modell (sonst deterministisch)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` → E-Mail (siehe §7)
- `OIDC_ISSUER` / `OIDC_AUDIENCE` / `OIDC_JWKS_URI` / `OIDC_AUTOPROVISION` → SSO

Deploy auslösen. Smoke-Test: `https://app.klarwerk.ai/health` muss `{"status":"ok"}` liefern,
`https://app.klarwerk.ai/api/auth/status` zeigt `needsSetup`. Danach Ersteinrichtung
(erstes Konto wird Admin).

## 6. Postgres-Daten & Backups

- Coolify-Postgres-Service auf das **Hetzner-Volume** legen (oder das `pgdata`-Volume aus
  `docker-compose.prod.yml`).
- Zusätzlich zu Hetzner-Snapshots: regelmäßiger `pg_dump` (Coolify-Scheduled-Task), Dump
  verschlüsselt sichern.

## 7. E-Mail — Trennung Mensch vs. App

- **Menschen:** `info@klarwerk.ai` bleibt **Microsoft 365**.
- **App-Mails** (Reset, Benachrichtigungen): eigener Transaktions-Versender, EU-Anbieter
  empfohlen (**Brevo** oder **Mailjet**). Dort `noreply@klarwerk.ai` verifizieren, SMTP-Zugang
  in die Coolify-Secrets (`SMTP_*`) eintragen.
- **DNS-Einträge in Cloudflare (Zustellbarkeit, Pflicht):**
  - **SPF** (ein TXT-Record für `@`), der M365 **und** den Transaktions-Versender erlaubt,
    z. B. `v=spf1 include:spf.protection.outlook.com include:<versender> -all`
  - **DKIM**: die CNAME-/TXT-Einträge von M365 **und** vom Versender setzen.
  - **DMARC** (TXT auf `_dmarc`): `v=DMARC1; p=quarantine; rua=mailto:info@klarwerk.ai`

## 8. SSO später (FR-AUTH-07)

Beim IdP (Azure AD/Entra, Auth0, Keycloak …) eine App registrieren, dann `OIDC_ISSUER`,
`OIDC_AUDIENCE` (Client-ID) und `OIDC_JWKS_URI` als Secrets setzen. Der Endpunkt
`POST /api/auth/oidc` nimmt das vom Frontend gelieferte ID-Token entgegen und verifiziert es.

## 9. Was wohin gehört (Verwaltungs-Landkarte)

| Aufgabe | Ort |
|---|---|
| Code, CI, Secrets-Referenzen | Git-Repo (Gitea jetzt, später GitHub/GitLab) |
| Deploys, Laufzeit-Secrets, Logs, TLS | Coolify (auf dem Hetzner-Server) |
| Domain, DNS, Schutz | Cloudflare |
| Menschliche E-Mail | Microsoft 365 |
| App-/Transaktions-E-Mail | Brevo/Mailjet |
| Status & Runbooks | `SETUP.md` + dieses Dokument |

> Regel: keine Secrets ins Repo. Werte leben in Coolify (Laufzeit) bzw. im Passwort-Manager.
