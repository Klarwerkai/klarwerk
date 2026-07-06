# Nachtrag 05.07.2026 (abends) — KI-Status-Pille, Deploy-Paket, Go-Live app.klarwerk.ai

**Von:** Paul (Cloud-Worker) · **Session mit Pedi, VIP-Tag** · Runner-Gate: 05.07.2026 18:21 ALLE GATES GRÜN (254 Testdateien / 1536 Tests, Smoke 4/4) · Commits: `eb29fc9` (73 Dateien) + `c017a25` (FUSE-Cleanup), gepusht zu GitHub + Gitea.

## 1. KI-Status-Pille in der Topbar (Pedi-Auftrag, 2 Runden)

- **v1:** Header-Pille zeigt Betriebsart über alle Reasoner-Aufgaben aggregiert: Externe KI (Cloud) /
  Interne KI (lokal/regelbasiert) / KI gemischt. Quelle: vorhandene read-only `/reasoner/config`.
- **v2 (Pedi-Korrektur):** DSGVO-Bestätigung ist **immer „nein" — außer interne KI aus Europa**
  (regelbasiert = eigenes System (EU) → ja). Dazu **Herkunftsland der KI** in der Pille.
- Herkunft INTERIM aus der Anbieter-Kennung (`apps/web/src/lib/kiOrigin.ts`; nur eindeutige Präfixe:
  anthropic/openai/google/meta→USA, mistral→FR, aleph→DE, qwen/deepseek→CN; sonst ehrlich
  „Herkunft unbekannt" = nein). SPÄTER liefert Nerds KI-Zugangs-Steuerung das Feld —
  Datenvertrags-Vorschlag in `docs/team2-austausch/paul-notiz-ki-herkunft-fuer-nerd.md`.
- Gefangener Bug: „o**llama**" matchte die Meta/llama-Regel — jedes lokale Modell wäre als USA
  gegolten. Fix: Laufzeit-Kennung wird vor der Zuordnung entfernt; Regressionstest vorhanden.
- Dateien: `lib/kiOrigin.ts` + `lib/kiHeaderStatus.ts` (neu), `shell/Topbar.tsx`, `i18n.ts`
  (topbar.ki*, country.*), `tests/reasoner/ki-header-status.test.ts` (10 Tests).

## 2. Vormerkungen als Jira-Tickets (nur dokumentiert, nichts gebaut)

- **SCRUM-449** — Admin soll Zugriffsrechte vergeben können (Definition mit Pedi später).
- **SCRUM-450** — Werksreset nur mit Admin-Passwort (echte Re-Auth) + großer Warnung als zweiter
  Bestätigung; Desktop/Dev-Sperre bleibt.

## 3. Deploy-Paket im Repo (für Hetzner/Coolify)

- **`Dockerfile`** (Repo-Wurzel): 2-stufig, EIN Container = Fastify-API + gebaute SPA auf Port 3001,
  eingebauter `/health`-HEALTHCHECK, `USER node`, Laufzeit `npx tsx services/app/src/server.ts`.
- **`.dockerignore`**, **`docs/operations/deploy-hetzner.md`** (Runbook: Coolify, Postgres, Envs,
  Domain/TLS, Ersteinrichtungs-Reihenfolge, ehrliche Grenzen).
- Lokal verifiziert (Mac): Serverstart + `/health` ok + SPA-Auslieferung ok; vite build via Runner.
- **Kanonik-Falle dokumentiert:** `server.ts` leitet `app.<CANONICAL_HOST>` per 301 um →
  bei Betrieb unter app.klarwerk.ai MUSS `CANONICAL_HOST=app.klarwerk.ai` gesetzt sein.

## 4. Go-Live auf klarwerk-prod (Hetzner/Coolify) — Stand bei Sessionende

Befund vorab (auch als Kommentar in **SCRUM-447**): DNS `klarwerk.ai` UND `app.klarwerk.ai` →
116.203.127.201 (klarwerk-prod) — PMO-TODO-0004 in eine Richtung aufgelöst: DNS IST umgestellt;
dort lief die ALTE App-Version öffentlich.

Durchgeführt (Pedi klickt, Paul führt — Browser-Fernsteuerung war mangels Extension-Konto nicht möglich):

- Bestehende Coolify-App **adventurous-ant-…** wiederverwendet — war bereits korrekt verdrahtet:
  Quelle `git@github.com:Klarwerkai/klarwerk.git` (= dev_Klarwerk), Branch `main`, HEAD,
  Build Pack **Dockerfile**, Domains `https://klarwerk.ai,https://app.klarwerk.ai` (unverändert
  gelassen — Stoppen hätte auch klarwerk.ai getroffen).
- **Neue PostgreSQL-16-Ressource** angelegt (alte DB unangetastet — Schema der alten Generation).
- Envs: `DATABASE_URL` → neue DB; `CANONICAL_HOST=app.klarwerk.ai` neu; `ANTHROPIC_API_KEY`
  gesetzt (nur Pedi; Cloud-KI gewollt, Pille zeigt ehrlich „Externe KI · USA · DSGVO: nein");
  Altlast `APP_BASE_URL` bewusst stehen gelassen (Code liest sie nicht mehr).
- **Redeploy angestoßen; Build-/Abnahme-Status bei Sessionende OFFEN** (s. unten).

## 5. Offen (Übergabe an Dienstag 07.07., Erinnerung 09:00 ist gestellt)

1. **Abnahme ausstehend:** `/health`, Topbar zeigt v1.0.0-beta.1, KI-Pille korrekt; DANN SOFORT
   Ersteinrichtung durch Pedi (erster Nutzer = Admin!) — solange sie nicht gemacht ist, ist die
   leere Instanz öffentlich übernehmbar → notfalls App auf Stop.
2. Testnutzer (Rolle Experte) für den Externen; Link + Zugangsdaten getrennt.
3. **Basic-Auth-Tor** vor app.klarwerk.ai (Pedi-Wunsch, auf Dienstag verschoben): Traefik-Label
   `basicauth`, Hash via `htpasswd -nb gast '…'`, `$`→`$$`, ggf. nur app-Router.
4. Coolify-Env-Aufräumen (Altlasten), SCRUM-447-Rest (klarwerk.ai-Routing, klarwerk-ops,
   Server-Übersicht Schreibtisch), Boss-Session-Tag v1.0.0-beta.2.
