# Klarwerk — Anbindung an interne Tools & Workflows (Integrations-Runbook)

> Was Klarwerk **heute real** an Integrationsflächen bietet, wie man sie nutzt, und was eine
> saubere **erste** Integration braucht.
> **Ehrlichkeitsregel:** Es läuft **keine** produktive externe Integration (kein n8n/Slack/
> Teams/Jira/Confluence/Webhook). Diese Doku beschreibt die **vorhandene REST-API als
> Integrationsfläche** — sie behauptet **keine** aktive Drittanbindung.
> Verwandt: `docs/onboarding/user-quickstart.md`, `docs/demo/stage-1-demo-path.md`,
> `secrets-management.md`, `monitoring-logging.md`, `gdpr-compliance-runbook.md`, `deploy-hetzner.md`.

---

## 1. Vorhandene Integrationsflächen (real)

Klarwerk ist ein **Single-Origin-Dienst mit interner REST-API** (`/api/*`, Fastify), auth-geschützt. Relevante Flächen für Integrationen:

| Fläche | Endpunkt(e) | Zweck |
| --- | --- | --- |
| **Auth/Session** | `POST /api/auth/login` → `{token}`; `POST /api/auth/logout`; `GET /api/auth/me` | Bearer-Session-Token holen |
| **SSO/OIDC** | `GET /api/auth/oidc/start`, `POST /api/auth/oidc` | föderierte Anmeldung (PKCE) |
| **Wissen lesen/erfassen** | `GET/POST /api/kos`, `PUT /api/kos/:id`, `GET /api/kos/:id/versions`/`/evidence` | KO-CRUD + Aktionen |
| **Export (Pull)** | `GET /api/library/export?format=json\|markdown\|mediawiki\|html` | Wissensinhalte exportieren |
| **Import (Push)** | `POST /api/library/import {items}`, `…/import/candidates` | Wissen importieren/Vorschläge |
| **Fragen (Ask)** | `POST /api/ask {question}`, `POST /api/ask/helpful` | quellengebundene Antwort/Lücke |
| **Externe Suche** | `GET /api/external/search?q=…` | Server-Proxy (Default Wikipedia) |
| **Objekte/Anhänge** | `POST /api/objects`, `GET /api/objects/:id/raw` | Datei-Anhänge |
| **Status/Betrieb** | `GET /health`, `/api/reasoner/status`, `/api/ai-status`, `/api/model-runs`, `/api/audit`, `/api/management/snapshot`, `/api/analytics` | Health/QM/Reporting |
| **Admin** | `POST /api/admin/demo-seed`, `/api/auth/users/*` | Setup/Verwaltung |

> Es gibt **keine** OpenAI-kompatible API, **keinen** Webhook-/Event-Ausgang, **keine** vorgefertigte n8n-/Slack-/Jira-Anbindung.

---

## 2. Auth-/RBAC-Grenzen

- **Token:** Login liefert ein **opakes Session-Bearer-Token** (`Authorization: Bearer <token>`). **Keine** dedizierten Service-/Maschinen-Tokens, **keine** API-Keys, **kein** Rate-Limit/Quota im Produkt.
- **RBAC** gilt für jeden Endpunkt (serverseitig): Lesen ab Viewer, Erfassen ab Experte, Validierung ab Controller, Verwaltung nur Admin (`docs/qm/claude-after-report.md` SCRUM-212). Anonyme Zugriffe → 401.
- **Konsequenz für Integrationen:** Eine Integration meldet sich heute wie ein **Benutzer** an (eigenes Konto + Login → Bearer). Ein dediziertes **Service-Konto** mit Least-Privilege-Rolle ist möglich (anlegen + freigeben), aber **es gibt keine separate Token-/Key-Verwaltung** dafür (siehe §8).

---

## 3. Geeignete vs. ungeeignete Nutzungsfälle

**Geeignet (mit vorhandenen Endpunkten):**
- Periodischer **Export** von Wissensinhalten in ein Wiki/Drive (Pull via `/api/library/export`).
- **Import** kuratierter Inhalte/Kandidaten (Push via `/api/library/import`).
- **Ask-Abfrage** aus einem internen Tool (POST `/api/ask`) — mit ehrlicher Quellen-/Lücken-Antwort.
- **Status-/Health-Polling** (`/health`, `/api/reasoner/status`) für Monitoring.

**Heute ungeeignet / nicht vorhanden:**
- Event-getriebene Push-Integrationen (Webhooks) → nicht vorhanden.
- Hochfrequente/öffentliche API-Nutzung ohne Rate-Limit/Quota → Risiko, nicht abgesichert.
- „Drop-in"-LLM-Ersatz (OpenAI-kompatibel) → nicht vorhanden.

---

## 4. Beispiel-Flows (curl, vorhandene Endpunkte)

> Lokaler In-Memory-Server (`npm run start`, Port aus `PORT`); in Prod `https://app.klarwerk.ai`.

```bash
BASE=http://127.0.0.1:3001/api
# 1) Token holen
TOKEN=$(curl -s -X POST $BASE/auth/login -H 'content-type: application/json' \
  -d '{"email":"bot@example.com","password":"<pw>"}' | jq -r .token)
AUTH="Authorization: Bearer $TOKEN"

# 2) Wissen exportieren (Pull)
curl -s "$BASE/library/export?format=json" -H "$AUTH" > export.json

# 3) Wissen importieren (Push)
curl -s -X POST $BASE/library/import -H "$AUTH" -H 'content-type: application/json' \
  -d '{"items":[{"title":"…","statement":"…","type":"best_practice","category":"…"}]}'

# 4) Fragen (Ask)
curl -s -X POST $BASE/ask -H "$AUTH" -H 'content-type: application/json' \
  -d '{"question":"Wann muss Ventil X bei Überdruck geschlossen werden?"}'

# 5) Betrieb/Health
curl -s http://127.0.0.1:3001/health
curl -s $BASE/reasoner/status -H "$AUTH"
```

---

## 5. Import/Export-Workflow

- **Export:** `GET /api/library/export` (Default JSON; `markdown`/`mediawiki`/`html`) liefert die Wissensobjekte als portables Artefakt (auch als logisches Backup, `backup-disaster-recovery.md`).
- **Import:** `POST /api/library/import {items}` legt Wissensobjekte an (RBAC-gebunden); `…/import/candidates` für Kandidaten/Review. Importiertes Wissen durchläuft denselben Kreis (Validierung) — **keine** automatische Freigabe.

## 6. Ask-/Knowledge-OS-Workflow

`POST /api/ask {question}` → quellengebundene Antwort (Status/Trust/Quellen) **oder** ehrliche **Wissenslücke** (`gap`). Keine erfundenen Antworten. Eine Integration kann so Werkswissen abfragen und bei Lücken einen Capture-/Erfassungs-Trigger anstoßen (UI-Pfad `/erfassen?gap=…`).

## 7. Datenschutz-/Logging-Grenzen

- **Keine** Prompt-/Antwort-Inhalte werden geloggt (nur ModelRun-Metadaten, `monitoring-logging.md`).
- Integrationen dürfen **keine** Secrets in URLs/Logs schreiben; Token im Header, nicht in Query.
- DSGVO: importierte/abgefragte Daten unterliegen denselben Pflichten (`gdpr-compliance-runbook.md`).

---

## 8. Anforderungen für eine **erste echte Integration** (Produkt-/Ops-Entscheidung)

Damit eine produktive Drittintegration sauber läuft, ist mindestens zu klären/ergänzen:

1. **Service-Konto + Least-Privilege-Rolle** (eigenes Konto, freigegeben, minimale Rechte).
2. **Authentisierung für Maschinen:** heute Session-Bearer via Login — Entscheidung, ob ein **dediziertes Service-Token/API-Key + Rotation** nötig ist (Produktentscheidung; nicht vorhanden).
3. **Rate-Limit/Quota** vor öffentlicher/automatisierter Nutzung (nicht vorhanden).
4. **Zielsystem + Richtung** festlegen (z. B. n8n-Flow „Export → Wiki", oder „Ticket → Capture") — **eine** konkrete Integration zuerst.
5. **Datenschutz-/Scope-Freigabe** für den Datenfluss (welche Inhalte, wohin).
6. **Monitoring/Alerts** für die Integration (Fehlerquote, Auth-Fehler).

---

## 9. Offene Produktentscheidungen / Nicht-Ziele

- **Welche** erste Integration (n8n? Wiki-Export? Ticket→Capture?) und in **welche Richtung** — Produktentscheidung Pedi.
- **Service-Token/API-Key + Rate-Limit** bauen oder bewusst beim Session-Token bleiben — Produktentscheidung (kein Bau in diesem Ticket).
- **Webhook-/Event-Ausgang** — nicht vorhanden, optionales künftiges Item.
- In diesem Ticket: **kein** SDK, **kein** RAG/Vector, **keine** OpenAI-kompatible API, **keine** n8n-/Slack-/Jira-Implementierung.

---

## 10. Warum keine produktive Integration behauptet wird

Es existiert **keine** aktive, produktive Anbindung an ein externes Tool. Klarwerk bietet eine **integrationsfähige, auth-geschützte REST-API** (Export/Import/Ask/Status), aber bis eine konkrete Integration (Service-Konto, Zielsystem, ggf. Token/Rate-Limit) **vom Betreiber/Produkt entschieden und eingerichtet** ist, gilt das Akzeptanzkriterium „mindestens eine produktive Integration läuft" als **nicht erfüllt**.

---

## 11. Sandbox-Verifikation (ehrliche Evidence)

Real geprüft (lokal, In-Memory + Demo-Seed):
- **Auth-Schutz:** anonym `GET /api/kos` → **401**.
- **Export-Pull:** `GET /api/library/export` → **5 KOs** (JSON).
- **Ask-API:** `POST /api/ask` (Ventil X/Überdruck) → **answered=true, gesichert, quellengebunden**.
- **Status:** `GET /api/reasoner/status` → `{active:false, provider:"deterministic", mode:"deterministic"}`.
- **Externe Suche:** `GET /api/external/search?q=Ventil` → **400** (kein Netz/Wikipedia in der Sandbox) — Endpunkt vorhanden, in Prod gegen den konfigurierten Provider zu testen.

→ Die **interne API-Integrationsfläche funktioniert**; eine **produktive externe Integration** ist **nicht** belegt (existiert nicht).

---

*Read-only Integrations-Runbook. Kein Produktcode geändert; keine produktive Integration erzeugt/vorgetäuscht; kein SDK/RAG/OpenAI-API gebaut.*
