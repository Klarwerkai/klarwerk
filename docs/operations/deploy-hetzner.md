# Deploy auf den Hetzner-Server (Coolify) — Runbook

**Zweck:** KLARWERK auf dem vorgesehenen Hetzner-Server betreiben, damit Externe sich
per Browser anmelden und testen können (VIP-/Beta-Zugang). Stand: 05.07.2026 (Paul).

**Rollenteilung:** Pedi führt alle Schritte auf Server/Coolify/DNS aus (Konten, Zugänge,
Secrets). Paul liefert Repo-Bausteine (Dockerfile, dieses Runbook) und hilft bei Fehlern.

---

## 0. Was die App mitbringt (verifiziert am Code)

- `Dockerfile` (Repo-Wurzel): EIN Container, Fastify liefert API **und** gebaute Oberfläche
  auf Port **3001**; Healthcheck eingebaut (`/health` → `{"status":"ok"}`).
- Mit `DATABASE_URL` läuft der echte **Postgres-Modus**: Migration beim Start, Dev-Journal aus,
  **Werksreset nicht verfügbar** (gewollt für Produktion).
- Anmeldung über Bearer-Token → funktioniert hinter TLS-Proxy (Coolify/Traefik) ohne Extras.
- **Ersteinrichtung:** Bei leerer Instanz wird der ERSTE registrierte Anwender **Admin**.
- **Kanonik-Falle:** `server.ts` leitet `app.<CANONICAL_HOST>` per 301 auf `<CANONICAL_HOST>`
  um (Standard `klarwerk.ai`). Läuft die App unter `app.klarwerk.ai`, MUSS
  `CANONICAL_HOST=app.klarwerk.ai` gesetzt werden, sonst landet jeder Besucher auf der Website.

## 1. Voraussetzungen (einmalig)

1. Hetzner-Server erreichbar (Ubuntu 22.04/24.04, SSH als root/sudo-User).
2. **Coolify** installiert — falls noch nicht:
   `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`
   Danach Coolify-Weboberfläche öffnen (`http://<server-ip>:8000`), Admin-Konto anlegen.
3. **DNS:** A-Record der gewünschten Domain (z. B. `app.klarwerk.ai`) auf die Server-IP.
4. Das GitHub-Repo ist auf dem Stand mit `Dockerfile` (Pedi pusht — KLARWERK-Sync).

## 2. In Coolify anlegen

1. **Postgres:** Neues Projekt → „+ Resource" → PostgreSQL 16. Coolify zeigt danach die
   interne `DATABASE_URL` (Format `postgres://user:pass@host:5432/db`).
2. **App:** „+ Resource" → Application → Git-Repository (dev_Klarwerk), Branch `main`,
   Build Pack **Dockerfile**. Port-Mapping: Container-Port **3001**.
3. **Environment (App):**

   | Variable | Wert | Pflicht |
   |---|---|---|
   | `DATABASE_URL` | aus der Coolify-Postgres-Ressource | JA |
   | `CANONICAL_HOST` | die tatsächlich genutzte Domain, z. B. `app.klarwerk.ai` | JA (siehe Kanonik-Falle) |
   | `PORT` | `3001` (Default, nur bei Abweichung setzen) | nein |
   | `ANTHROPIC_API_KEY` | als **Coolify-Secret**, NUR wenn Cloud-KI auf dem Server laufen soll | nein |
   | `REASONER_MODEL` | optionales Modell-Override zum Key | nein |

   Ohne KI-Key läuft der Reasoner **regelbasiert** — ehrlich sichtbar in der Header-Pille
   („Interne KI · eigenes System (EU) · DSGVO: ja") und an den (!)-Infos der KI-Knöpfe.
   Schlüssel niemals ins Repo/Compose — nur Coolify-Secrets (Regel: Keys nur Schlüsselbund
   bzw. Betreiber-Secret-Store).
4. **Domain + TLS:** In der App-Ressource die Domain eintragen (`https://app.klarwerk.ai`);
   Coolify holt das Let's-Encrypt-Zertifikat selbst.
5. **Deploy** klicken; Build-Log beobachten (erster Build lädt npm-Pakete, dauert ein paar Minuten).

## 3. Nach dem Deploy — Reihenfolge ist sicherheitskritisch

1. **Smoke:** `https://<domain>/health` → `{"status":"ok"}`; danach Startseite laden.
2. **SOFORT Ersteinrichtung durchführen (Pedi selbst!):** Der erste registrierte Anwender wird
   Admin. Diesen Schritt NIEMALS dem Externen überlassen — erst wenn dein Admin-Konto steht,
   darf der Link nach draußen.
3. Optional **Demo-Daten** über die Verwaltung laden (nur Demo — keine echten Kundendaten
   auf den Testserver).
4. **Testnutzer für den Externen** anlegen: eigene Kennung, Rolle **Experte** (erfassen,
   fragen, stöbern) oder **Viewer** — kein Admin, kein Controller. Zugangsdaten getrennt vom
   Link übermitteln.
5. Link + Zugangsdaten an den Externen; nach der Testphase Nutzer deaktivieren oder
   Passwort ändern.

## 4. Betrieb (Kurzform)

- **Update (Ein-Klick):** `scripts/deploy/klarwerk-live-update.command` — stößt den Coolify-Deploy
  per API an (Token im Schlüsselbund `KLARWERK-LiveUpdate`; Einrichtung im Skript-Kopf).
  Reihenfolge IMMER: Runner grün → Commit → Sync (Push) → Live-Update.
- **Update (manuell):** Pedi pusht → in Coolify „Redeploy" (oder Auto-Deploy per Webhook aktivieren —
  bewusst NICHT eingeschaltet, damit Pedi entscheidet, wann Externe einen neuen Stand sehen).
- **Rollback:** Coolify → vorheriges Deployment redeployen.
- **Backup:** Hetzner-Snapshots + regelmäßiger `pg_dump` der Coolify-Postgres-Ressource —
  ein vollständiger Dump enthält Wissensobjekte, Anhänge UND Audit-Log gemeinsam.
- **Logs:** Coolify → App → Logs (der App-Prozess loggt Betriebsmodus und Fehler).

## 5. Ehrliche Grenzen dieses Stands

- Single-Instance, kein Load-Balancer, kein Rate-Limit vor dem Login — für VIP-/Beta-Tests
  gedacht, nicht für offenen Publikumsverkehr.
- Der Docker-Build ist syntaktisch geprüft, aber noch nie auf dem Server gelaufen —
  erster Build gemeinsam durchziehen und Fehler live fixen.
- E-Mail-Versand (nodemailer) ist ohne SMTP-Konfiguration inaktiv; Passwort-Resets dann
  nur über den Admin.
