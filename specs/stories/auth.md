# Modul: auth — Authentifizierung & Onboarding

> Quelle: Pflichtenheft §3.1 (FR-AUTH-01…08), NFR-SEC-01/02. Jira-Epic: KW-AUTH.
> Ausgearbeitetes Referenz-Spec (Vorlage für die übrigen Module).

## Ziel
Sichere Mehrbenutzer-Authentifizierung mit kontrolliertem Onboarding: erste Person wird Admin,
weitere Konten erst nach Freigabe nutzbar. Passwörter nur gehasht, Sitzungen serverseitig.

## User Stories & Akzeptanzkriterien

### FR-AUTH-01 · Ersteinrichtung (MUSS)
- Als erste Person einer leeren Instanz möchte ich automatisch Admin werden.
- [ ] **Gegeben** eine Instanz ohne Nutzer, **wenn** ich die App öffne, **dann** erscheint die Setup-Maske.
- [ ] **Gegeben** ich lege das erste Konto an, **dann** hat es Admin-Rechte.

### FR-AUTH-02 · Selbstregistrierung mit Freigabe (MUSS)
- Als neue Person möchte ich mich registrieren (Name, E-Mail, Passwort ≥ 8 Zeichen).
- [ ] **Gegeben** ein registriertes, nicht freigegebenes Konto, **wenn** ich mich anmelde, **dann** sehe ich einen Hinweis-Bildschirm und keinen Zugriff.
- [ ] **Gegeben** Admin gibt frei, **dann** ist Anmeldung möglich.

### FR-AUTH-03 · Login (MUSS)
- [ ] **Gegeben** korrekte Daten, **dann** entsteht eine ablaufende Sitzung.
- [ ] **Gegeben** falsche oder nicht freigegebene Daten, **dann** klare Abweisung, keine Sitzung.

### FR-AUTH-04 · Logout (MUSS)
- [ ] **Gegeben** ich logge mich aus, **dann** ist die Sitzung serverseitig beendet und das alte Token wertlos.

### FR-AUTH-05 · Passwort-Hashing (MUSS, NFR-SEC-01)
- [ ] **Gegeben** ein angelegtes Konto, **dann** enthält die DB ausschließlich Salt+Hash (etabliertes Verfahren, hohe Iteration) — kein Klartext, nichts Reversibles.

### FR-AUTH-06 · Admin-Passwort-Reset (MUSS)
- [ ] **Gegeben** Admin setzt ein Passwort zurück, **dann** wird der alte Login ungültig und bestehende Sitzungen des Nutzers verfallen.

### FR-AUTH-07 · SSO/OIDC (SOLL)
- [ ] **Gegeben** konfigurierter SSO (z. B. Azure AD/SAML), **dann** ist SSO-Login alternativ zum lokalen Login möglich, inkl. Rollen-Mapping.

### FR-AUTH-08 · Self-Service-Passwort-Reset per E-Mail (KANN)
- [ ] **Gegeben** ich fordere Reset an, **dann** setze ich das Passwort über einen E-Mail-Link zurück.

## API / Schnittstellen (Entwurf)
`POST /api/auth/setup` · `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/reset` (admin) · `GET /api/auth/me`. Sitzung als HttpOnly-Cookie. Fehlerfälle: 401 (falsch), 403 (nicht freigegeben), 409 (E-Mail vergeben).

## Datenmodell (Auszug, Technischer Anhang §1)
`users(id, name, email, password_salt, password_hash, role, approved, created_at)` · `sessions(token, user_id, expires_at)`. Audit-Eintrag je sicherheitsrelevanter Aktion.

## Nicht-Ziele (v1)
Social-Login (außer OIDC), 2FA (Roadmap), Self-Service-Mandantenprovisionierung (Out of Scope §6).

## Offene Fragen
SSO-Details und Provider (Pflichtenheft §7) · Passwort-Policy über die Mindestlänge hinaus · Session-Dauer.
