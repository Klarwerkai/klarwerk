# Deploy auf den Hetzner-Server (Coolify) — Runbook

**Zweck:** KLARWERK auf dem vorgesehenen Hetzner-Server betreiben, damit Externe sich
per Browser anmelden und testen können (VIP-/Beta-Zugang). Stand: 05.07.2026 (Paul).

**Rollenteilung:** Pedi führt alle Schritte auf Server/Coolify/DNS aus (Konten, Zugänge,
Secrets). Paul liefert Repo-Bausteine (Dockerfile, dieses Runbook) und hilft bei Fehlern.

> **Welcher Weg gilt für Sie?** (JOB 4201)
> Dieses Runbook beschreibt **den Coolify-Betrieb auf dem Hetzner-Server** — also die von Pedi
> betriebene Instanz. Coolify baut dabei über das `Dockerfile`.
> Wer eine **eigenständige Kundeninstanz** auf einer leeren Linux-Maschine aufsetzt (Docker
> Compose, eigene Datenbank, eigene Domain), folgt stattdessen
> `docs/operations/kundeninstanz-neuinstallation.md`. Dort steht auch, was der Ein-Befehl-Weg
> zwingend verlangt und woran ein Fehlstart zu erkennen ist. Seit dem 25.09.2026 ist jener Weg
> als ausführbare Prüfstrecke hinterlegt — leere Compose-Installation, TLS-Proxy, Ersteinrichtung
> und Erfassung im echten Browser, Neustart von Anwendung und Datenbank (dort §9). **Ein
> erfolgreicher Lauf liegt noch nicht vor** (dort §9.1); gemessen ist der Weg erst damit. Für
> **dieses** Runbook gilt die Strecke ohnehin nicht: der Coolify-Betrieb baut über das `Dockerfile`,
> und sein TLS/Proxy ist hier nicht gemessen.
> Der Mac-Studio-Weg („Insel", nativ, ohne Docker) ist ein drittes Thema und steht in
> `scripts/insel/README.md`.

---

## 0. Was die App mitbringt (verifiziert am Code)

- `Dockerfile` (Repo-Wurzel): EIN Container, Fastify liefert API **und** gebaute Oberfläche
  auf Port **3001**; Healthcheck eingebaut (`/health` → `{"status":"ok"}`).
- Mit `DATABASE_URL` läuft der echte **Postgres-Modus**: Migration beim Start, Dev-Journal aus,
  **Werksreset nicht verfügbar** (gewollt für Produktion).
- Anmeldung über Bearer-Token → funktioniert hinter TLS-Proxy (Coolify/Traefik) ohne Extras.
- **Ersteinrichtung (berichtigt am 16.09.2026, JOB 4201 — am Code gemessen):** Bei leerer Instanz
  meldet `GET /api/auth/status` `needsSetup: true`, und **`POST /api/auth/setup`** legt das erste
  Konto an; dieses erste Konto wird **Admin** (`services/auth/src/service.ts:242-249`). Danach
  antwortet derselbe Weg mit **409 `ALREADY_SETUP`** — das Fenster schließt sich von selbst.
  **Der Satz „der erste *registrierte* Anwender wird Admin" galt so nicht:** der öffentliche
  Registrierweg `POST /api/auth/register` ist per Vorgabe **zu** (403 `REGISTRATION_DISABLED`,
  `services/auth/src/routes.ts:351`) und öffnet sich nur mit `KLARWERK_SELF_REGISTRATION=1`.
  Gemessen in `tests/neuinstallation/pflichtkonfiguration.test.ts` (E1/E2) und im echten Lauf
  `tests/neuinstallation/erstinstallation.integration.test.ts` (N1).
  **Was das für die Reihenfolge bedeutet, bleibt unverändert scharf:** zwischen dem ersten
  erfolgreichen Deploy und Ihrer Ersteinrichtung kann **jeder**, der die Adresse erreicht, das
  Admin-Konto beanspruchen. Ersteinrichtung deshalb sofort und selbst (siehe §3.2).
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
   | `ANTHROPIC_API_KEY` | als **Coolify-Secret**, NUR wenn Claude (Anthropic) auf dem Server antworten soll | nein |
   | `OPENAI_API_KEY` | als **Coolify-Secret**, NUR wenn ChatGPT (OpenAI) auf dem Server antworten soll | nein |
   | `OPENAI_BASE_URL` | nur für Azure/Proxy; Vorgabe `https://api.openai.com/v1` | nein |
   | `REASONER_MODEL` | der Modellbezeichner **zum gesetzten Schlüssel**: `claude-sonnet-4-6` (Anthropic) bzw. z. B. `gpt-4o-mini` (OpenAI) | nein (bei `OPENAI_API_KEY` faktisch ja, siehe unten) |

   Ohne KI-Key — also ohne `ANTHROPIC_API_KEY` **und** ohne `OPENAI_API_KEY` — läuft der Reasoner
   **regelbasiert**; ehrlich sichtbar in der Header-Pille („Interne KI · eigenes System (EU) ·
   DSGVO: ja") und an den (!)-Infos der KI-Knöpfe. Mit genau einem Schlüssel antwortet dieser
   Anbieter; sind beide gesetzt, gewinnt OpenAI.
   `REASONER_MODEL` MUSS zum gesetzten Schlüssel passen — es gibt nur diesen einen Modellnamen für
   beide Wege. Ein Claude-Bezeichner an OpenAI (oder umgekehrt) lässt den Aufruf beim Anbieter
   scheitern. **Wer `OPENAI_API_KEY` setzt, setzt deshalb IMMER auch `REASONER_MODEL`** — ohne ihn
   bliebe der OpenAI-Weg entweder stumm oder bekäme den Anthropic-Vorgabewert untergeschoben.
   Schlüssel niemals ins Repo/Compose — nur Coolify-Secrets (Regel: Keys nur Schlüsselbund
   bzw. Betreiber-Secret-Store).
4. **Domain + TLS:** In der App-Ressource die Domain eintragen (`https://app.klarwerk.ai`);
   Coolify holt das Let's-Encrypt-Zertifikat selbst.

> **Unbestätigt (U3) · Die TLS-Terminierung erfolgt über Coolify/Traefik mit Let's-Encrypt-Zertifikat.**
> **Vorbehalt:** durch Ops/Pedi zu bestätigen — Zertifikats- und Proxyzustand sind Laufzeit-Konfiguration und aus dem Repo nicht prüfbar.
> **Restrisiko:** trägt die Terminierung nicht, ist „API über HTTPS erreichbar" unerfüllt und die Verbindung ungeschützt.
> **Bestätiger:** Ops/Pedi

5. **Deploy** klicken; Build-Log beobachten (erster Build lädt npm-Pakete, dauert ein paar Minuten).

## 3. Nach dem Deploy — Reihenfolge ist sicherheitskritisch

1. **Smoke:** `https://<domain>/health` → `{"status":"ok"}`; danach Startseite laden.
2. **SOFORT Ersteinrichtung durchführen (Pedi selbst!):** Die Anmeldemaske zeigt auf einer leeren
   Instanz die Ersteinrichtung (`POST /api/auth/setup`); das dort angelegte erste Konto wird Admin,
   danach ist der Weg zu (409). Diesen Schritt NIEMALS dem Externen überlassen — erst wenn dein
   Admin-Konto steht, darf der Link nach draußen.
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

> **Unbestätigt (U6) · Auto-Deploy per Webhook ist in Coolify aktivierbar.**
> **Vorbehalt:** durch Ops/Pedi zu bestätigen — das ist eine Möglichkeit der Plattform, kein eingeschalteter Zustand.
> **Restrisiko:** wer ihn für aktiv hält, erwartet nach einem Push einen Deploy, der nicht stattfindet.
> **Bestätiger:** Ops/Pedi

> **Unbestätigt (U5) · Ein Rollback erfolgt durch erneutes Deployen des vorherigen Stands in Coolify.**
> **Vorbehalt:** durch Ops/Pedi zu bestätigen — der Weg ist beschrieben, aber nie geprobt; der DR-Drill steht aus.
> **Restrisiko:** trägt der Weg im Ernstfall nicht, bleibt nur der Wiederaufbau aus Snapshot und Dump.
> **Bestätiger:** Ops/Pedi

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
