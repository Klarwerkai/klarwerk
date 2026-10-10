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

### FR-AUTH-02 · Selbstregistrierung mit Freigabe (MUSS) — historisch, abgelöst
> **Abgelöst durch „Registrierung nur per Einladung" (R-0527, Ship 8 vom 23.07.2026).** Niemand
> legt sich selbst ein Konto an; `POST /api/auth/register` antwortet im Auslieferungszustand 403
> `REGISTRATION_DISABLED` und legt nichts an (`services/auth/src/routes.ts`, Schalter
> `KLARWERK_SELF_REGISTRATION`, Vorgabe AUS — nur für Entwicklungs-/Testaufbauten). Zugang entsteht
> über die kontrollierte Ersteinrichtung (FR-AUTH-01) und danach ausschließlich über die persönliche
> Kontoanlage durch den Admin (`POST /api/users`, optional als befristeter Gast). Dort gelten Name,
> E-Mail und Passwort ≥ 8 Zeichen weiter. Der Wartebildschirm bleibt nur für den eingeschalteten
> Entwicklungsweg bestehen. Messung: `tests/registrierung-einladung/`, `tests/security/vip2-gate.test.ts`.
> Der Originalwortlaut unten bleibt als historische Anforderung erhalten.

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

### FR-AUTH-09 · Eigene Zwei-Faktor-Anmeldung (R-0562)
- Als Person mit Passwortkonto möchte ich beim Anmelden zusätzlich einen Code von meinem zweiten Gerät bestätigen — ohne Umweg über den Firmen-Anmeldedienst.
- [ ] **Gegeben** ich richte im Profil die Zwei-Faktor-Anmeldung ein (Passwort, Geheimnis in die Authenticator-App, ersten Code bestätigen), **dann** verlangt jede weitere Passwortanmeldung zusätzlich einen gültigen Code (TOTP, RFC 6238).
- [ ] **Gegeben** Passwort richtig, Code falsch oder fehlend, **dann** entsteht keine Sitzung; ein Code trägt höchstens eine Anmeldung; nach fünf falschen Codes ist erneut das Passwort nötig.
- [ ] **Gegeben** das zweite Gerät ist verloren, **dann** kann ein Admin den zweiten Faktor des Kontos entfernen.
- SSO-Konten bekommen ihren zweiten Faktor weiterhin vom Firmen-Anmeldedienst.

## API / Schnittstellen (Entwurf)
`POST /api/auth/setup` · `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/reset` (admin) · `GET /api/auth/me`. Sitzung als HttpOnly-Cookie. Fehlerfälle: 401 (falsch), 403 (nicht freigegeben), 409 (E-Mail vergeben).

## Datenmodell (Auszug, Technischer Anhang §1)
`users(id, name, email, password_salt, password_hash, role, approved, created_at)` · `sessions(token, user_id, expires_at)`. Audit-Eintrag je sicherheitsrelevanter Aktion.

## Nicht-Ziele (v1)
Social-Login (außer OIDC), Self-Service-Mandantenprovisionierung (Out of Scope §6).
(2FA stand hier bis 2026-06-22 als Roadmap mit der Begründung „zweiter Faktor kommt vom
Firmen-Anmeldedienst"; der Auftrag `aufnahme:20260922:gesamt-zweifaktor` (R-0562) verlangt die
eigene Zwei-Faktor-Anmeldung — umgesetzt als FR-AUTH-09.)

## Offene Fragen
SSO-Details und Provider (Pflichtenheft §7) · Passwort-Policy über die Mindestlänge hinaus · Session-Dauer.
