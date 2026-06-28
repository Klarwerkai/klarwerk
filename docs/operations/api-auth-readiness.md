# Klarwerk — API-Endpoint mit Authentifizierung: Readiness-Runbook

> Ehrliche Bestandsaufnahme der **real vorhandenen** API-Fläche, wie Auth/RBAC greifen, ob
> unautorisierte Anfragen abgewiesen werden, und was für eine **produktive externe/öffentliche**
> API-Schicht noch fehlt.
> **Keine neue API-Key-Infrastruktur, keine externen Domains/Reverse-Proxies provisioniert,
> kein Rate-Limit/Quota installiert, kein SDK gebaut.** Verwandt: `integration-workflows.md`,
> `secrets-management.md`, `scaling-cost-control-readiness.md`, `monitoring-logging.md`,
> `deploy-hetzner.md`.

---

## 1. API-Fläche (real)

Klarwerk stellt eine **interne, auth-geschützte REST-API** (`/api/*`, Fastify) als **Single-Origin-Dienst** bereit. Auswahl realer Routen:

| Bereich | Routen | Schutz |
| --- | --- | --- |
| **Liveness/Status** | `GET /health`, `/api/reasoner/status`, `/api/ai-status` | **öffentlich** (nur Status, **keine** Daten) |
| **Auth/Session** | `POST /api/auth/register`, `/api/auth/login`→`{token}`, `/api/auth/logout`, `GET /api/auth/me` | öffentlich (Login), sonst Session |
| **SSO/OIDC** | `GET /api/auth/oidc/start`, `POST /api/auth/oidc` | föderierte Anmeldung (PKCE) |
| **Wissen** | `GET/POST /api/kos`, `PUT /api/kos/:id`, `…/versions`/`/evidence` | **RBAC** (Lesen Viewer, Erfassen Experte …) |
| **Fragen** | `POST /api/ask`, `/api/ask/helpful` | RBAC (angemeldet) |
| **Import/Export** | `POST /api/library/import(/candidates)`, `GET /api/library/export` | RBAC |
| **Objekte/Anhänge** | `POST /api/objects`, `GET /api/objects/:id/raw` | RBAC |
| **Betrieb/Reporting** | `/api/model-runs`, `/api/audit`, `/api/management/snapshot`, `/api/analytics/impact` | RBAC |
| **Admin** | `POST /api/admin/demo-seed`, `/api/auth/users/*` | nur Admin |

---

## 2. Auth / RBAC (wie es heute funktioniert)

- **Session-Bearer-Token:** `POST /api/auth/login` → **opakes Session-Token**; Folgeaufrufe mit `Authorization: Bearer <token>`. Extraktion in `services/app/src/http.ts` (`tokenFromRequest` → `auth.authenticate`).
- **Guards:** `requireUser` → **401 `UNAUTHENTICATED`** ohne gültige Session; `requirePermission(perm)` → **403 `FORBIDDEN`** bei fehlendem Recht. RBAC-Rollen Viewer/Experte/Controller/Admin (SCRUM-212).
- **SSO/OIDC** (PKCE) zusätzlich verfügbar.
- **Security-Header/Transport (App-Ebene, `server.ts`):** `@fastify/helmet` (**HSTS** `maxAge=1J, includeSubDomains, preload`; **CSP** `default-src 'self'`…), **HTTPS-Kanonik-Redirect** (`app.<domain>` → `https://<domain>`), `X-Robots-Tag: noindex`.
- **Kein CORS** registriert → **same-origin** (keine Cross-Origin-/Browser-Drittnutzung konfiguriert).

---

## 3. Werden unautorisierte Anfragen abgewiesen? — **Ja (getestet + Smoke)**

**Testabdeckung:** 401/403-Fälle in nahezu allen Route-Test-Suiten (`admin/ask/capture/conflict/external/import-review/management/output/validation-routes.test.ts`) + Auth-Service-Tests + `build-app.test.ts`.

**Lokaler In-Memory-Smoke (real ausgeführt, kein Live-Netz, keine externe Domain):**

| Anfrage | Ergebnis |
| --- | --- |
| anonym `GET /api/kos` | **401** |
| anonym `POST /api/ask` | **401** |
| **falscher** Bearer `GET /api/kos` | **401** |
| öffentlich `GET /health` | **200** |
| autorisiert `GET /api/kos` | **200** |
| autorisiert `POST /api/ask` | **200** |
| autorisiert `GET /api/library/export?format=json` | **200** |

→ Auth/RBAC **greift**; geschützte Routen sind ohne gültiges Token nicht nutzbar.

---

## 4. Fehlende Service-Token / API-Keys (ehrlich benannt)

- **Es gibt KEINE inbound API-Key-/Service-Token-Auth.** Maschinelle Clients melden sich heute **wie ein Benutzer** an (eigenes Konto → Login → Session-Bearer). (`apiKey`/`x-api-key` im Code betrifft nur den **ausgehenden** `ANTHROPIC_API_KEY` zum Modell-Provider — **nicht** den API-Zugang.)
- **Keine** dedizierte Token-/Key-Verwaltung, **keine** Rotation, **keine** Scopes für Maschinen (vgl. `integration-workflows.md` §8).

---

## 5. Fehlendes Rate-Limit / Quota (ehrlich benannt)

- **Kein** Rate-Limit, **keine** Quota, **kein** Concurrency-Throttle (bestätigt in `scaling-cost-control-readiness.md` §4, `integration-workflows.md` §2). Für **öffentliche/automatisierte** Nutzung ist das ein Risiko (Last/Kosten).

---

## 6. TLS / HTTPS / Reverse-Proxy — Verantwortungsteilung

- **App-Ebene:** erzwingt Security-Header (HSTS/CSP) und **leitet** auf HTTPS-Kanonik um — **terminiert TLS aber NICHT selbst**.
- **Betriebs-/Ops-Ebene:** **TLS-Terminierung erfolgt über Coolify/Reverse-Proxy** (Let's Encrypt) auf Hetzner (`deploy-hetzner.md`). „API über HTTPS erreichbar" ist damit eine **Deploy-/Ops-Eigenschaft** (Coolify), **nicht** im App-Prozess provisioniert.

> **Folge für das Jira-Kriterium:** Der **Auth-Teil** ist real, getestet und Smoke-belegt. Der **HTTPS-Teil** hängt am korrekt konfigurierten Coolify-Proxy (deploy-ready, aber Ops-Verantwortung) — in **diesem** Item wurde **keine** Domain/kein Proxy provisioniert.

---

## 7. Ist externe Nutzung heute produktiv „safe" möglich?

- **Intern/integrationsfähig: ja** — eine Integration kann sich mit einem (Service-)Konto anmelden und Export/Import/Ask/Status nutzen (`integration-workflows.md`).
- **Öffentlich/partner-fähig: nein** — ohne **API-Key/Scopes, Rate-Limit/Quota, CORS-Policy** und einen explizit gehärteten Proxy ist **kein** öffentliches API-Angebot „produktiv safe".

---

## 8. Anforderungen für ein späteres Public/Partner-API-Setup

1. **Maschinen-Auth:** dediziertes **Service-Token/API-Key** + Scopes + Rotation (statt User-Session).
2. **Rate-Limit/Quota** pro Token/Route (429 + Retry-After).
3. **CORS-Policy** (falls Browser-Clients) — explizite Allowlist.
4. **Gehärteter Reverse-Proxy** (TLS, Header, ggf. WAF) + dokumentierte Domain.
5. **Versionierung** (`/api/v1`) + öffentliches API-Schema/Doku.
6. **Monitoring/Alerts** für Auth-Fehler/Missbrauch (`monitoring-logging.md`).

---

## 9. Nicht-Ziele

- Keine API-Key-Infrastruktur, keine externen Domains/Reverse-Proxies provisioniert.
- Keine Rate-Limits/Quotas installiert, kein SDK gebaut, kein CORS aktiviert.
- Kein Produktcode geändert; reine **Readiness-Dokumentation**.

---

## 10. Empfehlung

**PARTIAL.** Klarwerk stellt eine **reale, auth-geschützte REST-API** bereit: Session-Bearer + OIDC, RBAC-Guards mit **401/403**, getestet und per lokalem Smoke belegt (anonym → 401, autorisiert → 200), plus Security-Header und HTTPS-Kanonik auf App-Ebene. **Aber:** es gibt **keine** inbound API-Key-/Service-Token-Auth, **kein** Rate-Limit/Quota, **kein** CORS, und **HTTPS wird per Coolify-Proxy (Ops) terminiert**, nicht im App-Prozess — eine **produktive externe/öffentliche** API-Schicht ist **nicht** aktiv. Das Kriterium „API über HTTPS mit Auth erreichbar" ist **auth-seitig erfüllt** und **transport-seitig deploy-/ops-abhängig** → **Partial**; die offenen Stücke sind teils Produkt- (API-Key/Rate-Limit/CORS), teils Ops-Aufgaben (Domain/Proxy), bewusst nicht in diesem Item provisioniert.

---

*Read-only Readiness-Runbook. Kein Produktcode geändert; keine API-Key-/Proxy-/Rate-Limit-Infrastruktur erzeugt; Evidence aus vorhandenen Tests + lokalem In-Memory-Smoke (§3).*
