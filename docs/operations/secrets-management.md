# Klarwerk — Secrets-Management (Betreiber-Runbook)

> Praktisches Ops-Runbook für API-Keys, Zugangsdaten, Zertifikate und sonstige Secrets.
> **Keine echten Secrets** in diesem Dokument. Konfig-Vorlage: `.env.example` (nur Platzhalter).
> Verwandte Doku: `docs/operations/deploy-hetzner.md`, `docs/operations/pre-launch-protection.md`,
> `docs/compliance/gdpr-compliance-runbook.md`. Grundregel G-7: **keine Geheimnisse im Client-Bundle.**

---

## 1. Secret-Inventar

| Secret | Env-Variable(n) | Pflicht? | Verhalten ohne Wert | Anbieter/Quelle |
| --- | --- | --- | --- | --- |
| **Datenbank-Zugang** | `DATABASE_URL` (enthält DB-Passwort) | für Persistenz | App läuft **In-Memory** (nur Dev/Smoke) | Postgres (Hosting) |
| **KI-Modell-Schlüssel** | `ANTHROPIC_API_KEY` (+ `REASONER_MODEL`) | optional | **deterministischer Fallback** (kein externer Call) | Modellanbieter |
| **SMTP-Zugang** | `SMTP_USER`, `SMTP_PASS` (+ `SMTP_HOST/PORT/FROM/SECURE`) | optional | **kein E-Mail-Versand** | Transaktions-Mailer (EU: Brevo/Mailjet) |
| **OIDC Client-Secret** | `OIDC_CLIENT_SECRET` | nur **confidential client** | bei public client (nur PKCE) leer | IdP |
| **Pre-Launch-Gate** | Basic-Auth am Reverse-Proxy (htpasswd-Hash) | für Vorab-Phase | kein Vorab-Gate | Traefik/Coolify |
| **Default-/Demo-Konten** | Demo-Seed-Admin, Pre-Launch-Gate-Passwort | — | — | **vor Produktion ändern** |

**Kein App-Signing-Secret nötig:** Session-Tokens sind **opake Zufallswerte** (`randomBytes(32)`, serverseitig gespeichert) — es gibt **kein** symmetrisches JWT-Signaturgeheimnis zu verwalten. OIDC-Tokens werden über **JWKS** (öffentliche Schlüssel) verifiziert.

**Nicht-geheime Konfiguration** (kein Secret, dürfen klar gesetzt werden): `PORT`, `APP_BASE_URL`, `CANONICAL_HOST`, `COOKIE_SECURE`, `REASONER_MODEL`, `OIDC_ISSUER/AUDIENCE/JWKS_URI/AUTHORIZE_URL/TOKEN_URL/CLIENT_ID/REDIRECT_URI/ROLE_CLAIM/GROUP_*`, `EXTERNAL_SEARCH*`, `SEED_ALLOW_PROD`.

---

## 2. Erlaubte Speicherorte

- **Runtime-Env-Variablen**, vom Hosting/Secret-Manager injiziert (Produktion).
- **`.env.local`** für lokale Entwicklung (per `.gitignore` ausgeschlossen).
- **Hosting Secret Manager** (Coolify-Env/Secrets je Service; optional externer Store).
- Verschlüsselte Secret-Referenzen (z. B. Manager-Verweise), nie der Klartext im Repo.

## 3. Verbotene Speicherorte (hart)

- **Im Code / im Repo** (auch nicht „temporär").
- **Committetes `.env`** (nur `.env.example` mit Platzhaltern ist erlaubt).
- **Im Client-Bundle** (`apps/web`) — siehe §9 (G-7).
- **In Logs / Audit-Payloads / Fehlermeldungen** im Klartext.
- **In Tickets / Chat / Wiki / Screenshots** im Klartext.

---

## 4. Empfohlener Secret-Store pro Umgebung

| Umgebung | Quelle | Hinweis |
| --- | --- | --- |
| **Lokal/Dev** | `.env.local` (aus `.env.example` kopiert) | niemals committen; ohne `DATABASE_URL` läuft In-Memory |
| **Staging/Prod** | **Coolify-Env/Secrets** je Service (Hetzner via Coolify, `deploy-hetzner.md`) | Secrets pro Service, nicht global; TLS/Reverse-Proxy über Coolify |
| **Optional/später** | externer Secret-Store (Vault/Doppler/Cloud SM) | **Empfehlung**, in diesem Ticket bewusst **nicht installiert** |

---

## 5. Lokale Entwicklung

1. `.env.example` → `.env` bzw. `.env.local` kopieren.
2. Nur die benötigten Werte setzen (ohne `DATABASE_URL` = In-Memory-Schnellstart; ohne `ANTHROPIC_API_KEY` = deterministischer Reasoner).
3. **Niemals committen** (`.gitignore` deckt `.env` und `.env.local` ab — vor jedem Push prüfen).

## 6. Produktion / Hosting

- Secrets als **Service-Env in Coolify** hinterlegen (nicht im Image, nicht im Repo).
- HTTPS/TLS-Zertifikate verwaltet der Reverse-Proxy (Traefik/Coolify) — keine Zertifikats-Keys ins Repo.
- `COOKIE_SECURE=true`, `APP_BASE_URL`/`CANONICAL_HOST` korrekt setzen.
- **Default-Credentials sofort ändern:** Pre-Launch-Gate-Passwort (`pre-launch-protection.md`) und das Demo-Seed-Admin-Passwort vor jeder echten Nutzung rotieren.

---

## 7. Rotation & Notfallrotation

**Reguläre Rotation** (Empfehlung, Betreiber terminiert):
- API-Keys (`ANTHROPIC_API_KEY`), SMTP-Passwort, OIDC-Client-Secret: **≤ 12 Monate** bzw. nach Anbieter-Policy.
- DB-Passwort (`DATABASE_URL`): bei Personal-/Infra-Wechsel, mind. jährlich.
- Pre-Launch-Gate-Passwort: bei Personenwechsel / Phasenwechsel.

**Notfallrotation** (bei Leak/Verdacht/Offboarding mit Zugriff) — sofort:
1. Betroffenes Secret beim Anbieter **widerrufen** und **neu** erzeugen.
2. Neuen Wert im Secret-Store/Coolify setzen, Service neu starten.
3. Bei kompromittiertem Auth: **Sessions invalidieren** (Tokens sind serverseitig → Session-Store leeren/Nutzer neu anmelden), betroffene Konten prüfen/sperren.
4. **Audit-Log prüfen** (Analytics-Audit / `GET /api/audit`, append-only Hash-Kette) auf auffällige Aktionen.
5. Vorfall dokumentieren; ggf. DSGVO-Meldepflichten prüfen (`gdpr-compliance-runbook.md`).

---

## 8. Least Privilege

- **DB-User** nur mit nötigen Rechten (kein Superuser für die App).
- **API-Key** mit minimalem Scope/Budget; getrennte Keys je Umgebung (Dev/Prod nicht teilen).
- **OIDC-Client** minimal konfiguriert; Admin-Rolle nur bei exakt gesetzter Gruppe (`OIDC_GROUP_ADMIN`).
- **Service-/Personenkonten** trennen; keine geteilten „Sammel"-Secrets.

## 9. Client-Bundle-Regel (G-7) — KEINE Secrets in `apps/web`

- Das Frontend darf **keine** Secrets enthalten. Belegt: `apps/web/src` nutzt nur Build-Flags `import.meta.env.DEV/PROD` — **keine** `VITE_*`-Secrets, keine API-Keys.
- **Alle** Modell-/OIDC-/SMTP-/DB-Secrets leben **ausschließlich serverseitig**. Ein im JS-Bundle hinterlegtes Geheimnis ist für jeden lesbar — daher verboten.
- Pre-Launch-Zugangsschutz sitzt **vor** der App (Reverse-Proxy), nicht im Bundle.

## 10. Secret Scanning / Review

- **Pre-Commit/CI-Scan** empfohlen (z. B. `gitleaks`/`trufflehog`) gegen versehentliche Secret-Commits — Einrichtung ist Betreiber-/Ops-Aufgabe (in diesem Ticket nicht installiert).
- **PR-Review:** `.env.example` enthält nur Platzhalter; keine echten Werte in Diffs/Logs.
- **Periodischer Review:** Secret-/Zugriffs-Check im **Quartals-Compliance-Review** (`gdpr-compliance-runbook.md` §6) mitführen.

---

## 11. Offene Betreiberpflichten / Nicht-Ziele

- Auswahl/Einrichtung eines **externen Secret-Stores** (Vault/Doppler/Cloud SM) — Empfehlung, **nicht** Teil dieses Tickets/der Sandbox.
- **Secret-Scanning-Tooling** in CI aktivieren — Ops-Aufgabe.
- **Zertifikats-/Key-Lifecycle** (TLS) über Hosting/Reverse-Proxy — Ops.
- **Rotation tatsächlich terminieren** und Verantwortlichen benennen — organisatorisch.

---

*Read-only Ops-Runbook. Kein Produktcode geändert; keine echten Secrets erzeugt; kein externer Secret-Store installiert. Verweist nur auf vorhandene Konfiguration/Doku.*
