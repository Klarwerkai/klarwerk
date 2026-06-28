# Klarwerk — Server bereitstellen & absichern: Hardening-Readiness-Runbook

> Ehrliche Trennung von **app-seitig bereits abgesicherten** Maßnahmen und den **Server-/Ops-
> Härtungsschritten**, die der **Betreiber** noch durchführen und **verifizieren** muss.
> **Kein Server provisioniert, keine SSH-/Firewall-/fail2ban-/Docker-/CUDA-Änderung, keine
> Cloud-/Coolify-/Hetzner-Konfiguration live geändert.** Verwandt: `deploy-hetzner.md`,
> `pre-launch-protection.md`, `backup-disaster-recovery.md`, `monitoring-logging.md`,
> `secrets-management.md`, `maintenance-update-process.md`, `api-auth-readiness.md`.

---

## 1. Heutiger Deploy-Stand (real beschrieben)

- **Stack:** Hetzner Cloud (DE) + **Coolify** (PaaS) + **Postgres** + **Cloudflare** (DNS/TLS) (`deploy-hetzner.md`).
- **`docker-compose.prod.yml`:** App + Postgres; `restart: unless-stopped`; **DB-Healthcheck** (`pg_isready`) + App `depends_on: db healthy`; `COOKIE_SECURE=true`; **DB-Port nicht veröffentlicht** (nur intern). App-Port `3000:3000` (vom Coolify-/Traefik-Proxy gefrontet).
- **TLS:** Let's Encrypt über Coolify/Traefik; DNS/Schutz über Cloudflare.
- **Backups:** Hetzner-Snapshots (täglich) + `pg_dump` (`backup-disaster-recovery.md`).

---

## 2. App-seitige Sicherheitsmaßnahmen (real, im Code)

- **Security-Header** (`services/app/src/server.ts`, `@fastify/helmet`): **HSTS** (`maxAge=1J, includeSubDomains, preload`), **CSP** (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, …), Standard-Header.
- **HTTPS-Kanonik-Redirect** (`app.<domain>` → `https://<domain>`), **`X-Robots-Tag: noindex`**.
- **Auth/RBAC:** Session-Bearer + OIDC, `requireUser`→401 / `requirePermission`→403 (`api-auth-readiness.md`).
- **Cookies:** `COOKIE_SECURE=true` in Prod.
- **Vorab-Schutz** (`pre-launch-protection.md`): `robots.txt`/noindex-Meta + **Traefik-Basic-Auth-Gate** + `X-Robots-Tag` am Proxy.
- **Secrets:** nie im Repo/Client-Bundle; Laufzeit über Coolify-Env (`secrets-management.md`).

> Diese Maßnahmen sind **app-/deploy-konfigurativ** vorhanden. Sie ersetzen **keine** OS-Härtung (§3).

---

## 3. Server-/OS-Hardening-Checkliste (Betreiberpflicht — NICHT live verifiziert)

Vom Betreiber (Pedi) auf dem Hetzner-Host durchzuführen und abzuhaken:

**SSH / Zugang**
- [ ] **Key-only Auth** (`PasswordAuthentication no`), starke Keys hinterlegt.
- [ ] **Root-Login deaktivieren** (`PermitRootLogin no`); Arbeit über sudo-User.
- [ ] SSH ggf. auf nicht-Standard-Port / nur über Cloudflare/Tunnel/VPN erreichbar.
- [ ] **fail2ban** für SSH (Brute-Force-Schutz).

**Firewall / Ports**
- [ ] **UFW/Hetzner-Firewall**: nur **80/443** (öffentlich) + **SSH** (möglichst eingeschränkt); alles andere **deny**.
- [ ] **App-Port 3000 NICHT öffentlich** — nur intern für den Proxy. *(Hardening-Hinweis: `ports: "3000:3000"` bindet auf alle Interfaces; hinter Coolify/Traefik besser an `127.0.0.1:3000:3000` bzw. internes Netz binden. **Kein** Codefix in diesem Item — Betreiber-/Deploy-Entscheidung.)*
- [ ] **Postgres-Port (5432) nie öffentlich** (heute korrekt nicht veröffentlicht — so belassen).
- [ ] **Coolify-Dashboard** nicht öffentlich (Subdomain + Auth / SSH-Tunnel, `deploy-hetzner.md` §2).

**Updates / Betriebssystem**
- [ ] **`unattended-upgrades`** (automatische Security-Patches) aktiv.
- [ ] Regelmäßiges OS-/Coolify-/Image-Update-Fenster (`maintenance-update-process.md`).

**Docker / Container**
- [ ] Container als **non-root** laufen lassen, wo möglich; minimale Images.
- [ ] Docker-Daemon nicht über TCP exponieren; Socket-Zugriff beschränkt.
- [ ] Ressourcen-/Restart-Policies gesetzt (`restart: unless-stopped` vorhanden).

**TLS / Proxy**
- [ ] Let's Encrypt-Auto-Renew verifiziert; nur TLS 1.2+; HSTS am Proxy konsistent zur App.
- [ ] Cloudflare-Proxy/WAF-Basisregeln aktiv.

---

## 4. Port-/Firewall-Modell (Soll)

```
Internet ──443/80──► Cloudflare ──► Hetzner (UFW: 443/80 + SSH only)
                                   └─► Coolify/Traefik (TLS-Terminierung)
                                          └─► App :3000 (intern, nicht öffentlich)
                                                 └─► Postgres :5432 (nur intern, kein Host-Port)
SSH :22 ──► nur Key-Auth, kein Root, fail2ban, möglichst IP-/Tunnel-beschränkt
```

---

## 5. Bezug zu Backup / Monitoring / Secrets

- **Backup/DR:** `backup-disaster-recovery.md` (Snapshots + `pg_dump`, RTO ≤ 4 h).
- **Monitoring/Logging:** `monitoring-logging.md` (`/health`, ModelRun-Metadaten; **keine** Prompt-/Antworttexte).
- **Secrets:** `secrets-management.md` (Coolify-Env + Passwort-Manager; nie im Repo/Client).

---

## 6. GPU / CUDA — **Nicht-Ziel für den App-Server**

Die Klarwerk-App ist **Node + Postgres** — **kein** GPU/CUDA nötig. GPU-Treiber/CUDA sind **ausschließlich** für einen späteren, **separaten** Inferenz-Server relevant (`inference-server-readiness.md`), **nicht** für diesen App-Server. In diesem Item bewusst **kein** GPU-Thema.

---

## 7. Nachweis-/Verifikationsplan (für „Done")

Erst wenn der Betreiber Folgendes **live** zeigt, ist Härtung verifiziert:
1. `ssh` mit Passwort schlägt fehl; Root-Login verweigert.
2. `ufw status` / Hetzner-Firewall: nur 80/443/SSH offen; `nmap` von außen zeigt **keine** 3000/5432.
3. `fail2ban-client status sshd` aktiv.
4. `unattended-upgrades` aktiv (Logs/Status).
5. TLS-Check (z. B. SSL-Labs ≥ A); HSTS-Header live.
6. Coolify-Dashboard nicht öffentlich erreichbar.
7. Smoke: `GET /health`=`{"status":"ok"}` über HTTPS; Login-Pfad ok.

→ Ergebnisse als Screenshot/Log im Ops-Nachweis ablegen.

---

## 8. Nicht-Ziele

- Keine Server-Provisionierung; keine SSH-/Firewall-/fail2ban-/Docker-/CUDA-Änderung auf realen Maschinen; keine GPU-Treiber.
- Keine Live-Änderung an Coolify/Hetzner/Cloudflare.
- Kein Produktcode geändert (auch der Port-Binding-Hinweis §3 bewusst **nicht** gefixt).
- Reine **Readiness-/Hardening-Dokumentation**.

---

## 9. Empfehlung

**PARTIAL.** Die **app-/deploy-seitige** Absicherung ist **real** vorhanden (helmet/HSTS/CSP, HTTPS-Kanonik, noindex, COOKIE_SECURE, Auth/RBAC, Prelaunch-Gate) und der Deploy-Pfad (Hetzner/Coolify/Cloudflare-TLS + Snapshots) ist dokumentiert. **Aber:** die **Server-/OS-Härtung** (SSH-Key-only, Root-Deaktivierung, UFW/Firewall, fail2ban, unattended-upgrades, Docker-/Port-Härtung) ist **nicht in einem Runbook konsolidiert gewesen** und vor allem **nicht live verifiziert** (kein Remote-Zugriff, in diesem Item ausgeschlossen). Das Kriterium „Server bereitgestellt **& abgesichert**" ist daher **nicht** vollständig erfüllt → **Partial**; offene Schritte sind **Betreiber-/Ops-Aufgaben** mit dem Verifikationsplan in §7.

---

*Read-only Readiness-Runbook. Kein Produktcode geändert; keine Server-/Infra-/GPU-Änderung; Evidence nur aus vorhandener Doku/Config (`docker-compose.prod.yml`, `server.ts`, Ops-Docs).*
