# HTTP-API-Referenz

*R-2076 / NFR-MNT-02 (Aufnahme 20260922, zentrale-module-aufteilen). Stand: Kandidat `69ac08a3`.
Gilt für die App, die `buildApp` (`services/app/src/build-app.ts`) baut — dieselbe Wurzel für
Server, Tests und Rollenabnahme. Die statische Auslieferung der Web-Oberfläche (`web-static.ts`,
nur `server.ts`) ist keine API und hier nicht geführt.*

**Vollständigkeit wird gemessen, nicht behauptet.** `tests/architektur-vertrag/http-api-referenz.test.ts`
baut die App mit allen Schaltern (`tests/beta-rollenabnahme/buehne.ts`), zählt die registrierten
Routen am Router (`registrierte-routen.ts`) und verlangt: jede Route (ohne die automatischen
`HEAD`-Spiegel) hat genau eine Zeile in den Tabellen unten, und keine Zeile nennt eine Route, die es
nicht gibt. Ändert jemand eine Route, wird der Prüfstand rot, bis diese Datei nachgezogen ist.

**Was die Spalten bedeuten.** *Recht* ist das serverseitige Tor der Route (`requirePermission`,
`requireUser`, `requireAdmin` oder keines). *Eingaben* sind die Parameter, die die Route liest — aus
den Typangaben der Registrierung und dem Rumpf der Route abgeschrieben. *Erfolg* nennt Status und,
wo der Rumpf nicht offensichtlich ist, den Dienstaufruf, der ihn liefert. *Fehler* nennt die
Codes, die die Route **selbst** setzt; dazu kommen immer die allgemeinen Fälle aus Abschnitt 2.

## 1 Anmeldung und Rechte

**Sitzung.** `POST /api/auth/login` liefert `{ user, token }` und setzt das Cookie `kw_session`
(HttpOnly, `Path=/`, `SameSite=Lax`, `Secure` in Produktion — `services/app/src/csrf.ts`,
`COOKIE_STRATEGY`). Jede geschützte Route nimmt den Token aus `Authorization: Bearer <token>` oder
aus diesem Cookie (`tokenFromRequest`, `services/app/src/http.ts`). Der Web-Client nutzt nur das
Cookie; der Token im Rumpf ist der Weg für Clients ohne Cookies.

**CSRF.** Kein eigener Anti-CSRF-Token, sondern eine Herkunftsprüfung (`registerHerkunftspruefung`,
`csrf.ts`; R-0544, R-0797): ein `POST`/`PUT`/`DELETE`/`PATCH` mit Cookie wird nur angenommen, wenn
`Sec-Fetch-Site` `same-origin` oder `none` meldet — ohne diesen Kopf, wenn `Origin` auf den eigenen
Host zeigt. Fremde Herkunft, auch eine Nachbar-Unteradresse derselben Site, bekommt `403 FORBIDDEN`,
bevor Anmeldung oder Rumpf ausgewertet werden. Ohne beide Köpfe (Programmclients) gilt nur
`SameSite=Lax`. Mit Bearer ist ein Aufruf nicht cookie-gefährdet und wird nicht geprüft;
Einschätzung und Restrisiko stehen in `csrfAssessment`.

**Rollen und Rechte** (`services/rbac`):

| Rolle | Rechte |
| --- | --- |
| `viewer` | `ko.read` |
| `experte` | `ko.read`, `ko.create` |
| `controller` | wie `experte`, dazu `ko.validate`, `ko.assign`, `ko.relate`, `conflict.resolve` |
| `admin` | wie `controller`, dazu `users.manage` |

`requireAdmin` (nur im Anmeldemodul, `services/auth/src/routes.ts`) verlangt die Rolle `admin`.

**Add-in-Zugang.** Mit `KLARWERK_ADDON_API=1` nimmt die App zusätzlich den Kopf
`x-klarwerk-addon-key` an (`ADDON_KEY_HEADER`, `addon-api.ts`). Ein gültiger Schlüssel öffnet
ausschliesslich `POST /api/ask` und `POST /api/check-text` (je mit eigener Fähigkeit), jede andere
Route antwortet ihm `403 FORBIDDEN`; ein ungültiger Schlüssel bekommt `401 UNAUTHENTICATED`.
Fehlversuche werden je IP gedrosselt (`429 RATE_LIMITED` mit `retry-after`). CORS gilt nur für
diese zwei Pfade und nur für die eine eingestellte Add-in-Herkunft.

## 2 Fehler, die jede Route haben kann

Jede Fehlerantwort ist JSON `{ "error": "<CODE>", "message": "<Text>" }`. Der Text folgt dem Kopf
`Accept-Language` (de/en/nl), wo er aus dem Meldungskatalog kommt.

| Status | `error` | Wann |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | Gemeinsamer Wächter (`makeGuards`, `http.ts`): kein oder ungültiger Token. |
| 401 | `INVALID_CREDENTIALS` | Dasselbe an den Routen des Anmeldemoduls (eigener `requireUser`), dazu falsche Zugangsdaten. |
| 403 | `FORBIDDEN` | Recht fehlt (`requirePermission`; die Meldung nennt das fehlende Recht) oder Rolle ist nicht `admin` (`requireAdmin`). Ausserdem: schreibender Cookie-Aufruf fremder Herkunft (`registerHerkunftspruefung`, s. §1 CSRF). |
| 404 | `NOT_FOUND` | Unbekannte Route (Fastify) oder Objekt fehlt bzw. ist für den Anfragenden nicht sichtbar — bewusst dieselbe Antwort. |
| 400 | Domänencode | `sendError`: jeder Dienstfehler mit Code aus Grossbuchstaben/Unterstrich, Status aus `STATUS_BY_CODE`, sonst 400. |
| 409 | `CONFLICT`, `STAND_VERALTET`, `EMAIL_TAKEN`, `CLEANUP_DRIFT`, `CREATE_ANCHOR_TAKEN`, `IDEMPOTENCY_PAYLOAD_MISMATCH`, `CREATE_REPAIR_REQUIRED` | `STATUS_BY_CODE` — der Stand hat sich bewegt oder der Schlüssel ist belegt. |
| 403 | `NOT_APPROVED`, `DOWNGRADE_FORBIDDEN`, `EXTERNAL_ATTACH_BLOCKED` | `STATUS_BY_CODE`. |
| 503 | `KI_ABGESCHALTET`, `JOURNAL_AUSGANG_UNGEWISS` | `STATUS_BY_CODE` — Betriebszustand, kein Fehler des Aufrufers. |
| 503 | Modell ausgelastet | `modelBusyErrorHandler` (`build-app.ts`): Kapazitätsüberlauf des Modells, mit `Retry-After`. |
| 500 | `INTERNAL` | Alles Übrige, auch Datenbankfehler und der rein interne Code `SEARCH_PROJECTION_NOT_READY` — ohne Ursache im Text. `CREATE_ROLLBACK_FAILED` ist der eine Domänencode mit 500. |
| 400 | Fastify-Formfehler | Rumpf kein JSON oder grösser als die Grenze der Route (Standard 1 MiB; eigene Grenzen tragen `PUT /api/kos/:id`, `POST /api/objects`, `POST /api/drafts`, `POST /api/reasoner/describe`, `POST /api/capture/slides`). |

## 3 Endpunkte

Pfadparameter stehen als `:name` im Pfad und werden in *Eingaben* nicht wiederholt. „Sichtbar"
heisst: die Route prüft zusätzlich die Vertraulichkeit des Objekts für den Anfragenden
(`services/app/src/sichtbarkeit.ts`) und antwortet sonst `404`.

### 3.1 Betrieb und öffentliche Auskünfte (`buildApp` direkt, `i18nRoutes`, `brandingRoutes`, `featuresRoutes`, `supportRoutes`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/health` | keines | — | 200 `{ status: "ok", version, commit, ai, aiRuns }` | — |
| `GET` | `/api/reasoner/status` | keines | — | 200 abstrakter KI-Status (`reasoner.publicStatus()`), ohne Anbieter- oder Modellnamen | — |
| `GET` | `/api/ai-status` | keines | — | 200 `{ ai: publicStatus() }` | — |
| `GET` | `/api/analytics/impact` | `ko.read` | — | 200 Wirkungsbericht (`impactReport`), sichtbarkeitsgefiltert | — |
| `GET` | `/api/i18n/locales` | keines | — | 200 `{ locales, sprachen: [{ kennung, name, grundsprache }] }` (mitgelieferte und angelegte Sprachen) | — |
| `GET` | `/api/i18n/:locale` | keines | — | 200 `{ sprache, texte }` — die im Betrieb gepflegten Texte dieser Sprache | 400 `INVALID_LOCALE` |
| `GET` | `/api/i18n/:locale/:key` | keines | — | 200 `{ value }` (gepflegter Text vor dem Serverkatalog) | — |
| `PUT` | `/api/admin/i18n/:locale/:key` | `users.manage` | Rumpf `{ text }` (≤ 4000 Zeichen) | 200 `{ sprache, schluessel, text }`; Prüfprotokoll `i18n.text-set` | 400 `UNKNOWN_LOCALE`, `INVALID_KEY`, `INVALID_TEXT` |
| `DELETE` | `/api/admin/i18n/:locale/:key` | `users.manage` | — | 200 `{ sprache, schluessel, entfernt }` — der mitgelieferte Text gilt wieder; Prüfprotokoll `i18n.text-reset` | 400 `INVALID_KEY` |
| `PUT` | `/api/admin/i18n-sprachen/:locale` | `users.manage` | Rumpf `{ name }` | 200 `{ kennung, name }`; Prüfprotokoll `i18n.language-set` | 400 `INVALID_LOCALE` (auch für de/en/nl), `INVALID_NAME` |
| `GET` | `/api/branding` | keines | — | 200 die Markenwahl der Instanz | — |
| `PUT` | `/api/admin/branding` | `users.manage` | Rumpf `{ profil?, aktiv? }` | 200 neue Markenwahl | 400 `UNKNOWN_PROFILE` |
| `GET` | `/api/features` | ohne Token keines, mit Token `requireUser` | — | 200 `{ features }` (vor der Anmeldung die verkürzte Fassung) | 401 bei ungültigem Token |
| `GET` | `/api/support` | `requireUser` | — | 200 der eingestellte Supportweg der Installation | — |
| `OPTIONS` | `/*` | keines | CORS-Vorflug | Antwort von `@fastify/cors`; Kopfzeilen nur für die zwei Add-in-Pfade | — |

### 3.2 Anmeldung und Konten (`authRoutes`, `services/auth/src/routes.ts`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | keines (Schalter Selbstregistrierung) | Rumpf `{ name, email, password }` | 201 Konto | 403 `REGISTRATION_DISABLED`; 429 `RATE_LIMITED`; 400 `BAD_REQUEST`, `WEAK_PASSWORD`; 409 `EMAIL_TAKEN` |
| `POST` | `/api/auth/login` | keines | Rumpf `{ email, password }` | 200 `{ user, token }`, setzt `kw_session`; bei eigenem zweiten Faktor stattdessen 200 `{ secondFactorRequired: true, challenge, expiresInMs }` ohne Cookie | 401 `INVALID_CREDENTIALS`; 403 `NOT_APPROVED`; 429 `RATE_LIMITED` |
| `POST` | `/api/auth/login/second-factor` | keines (Anmeldeanfrage + Code sind der Nachweis) | Rumpf `{ challenge, code }` | 200 `{ user, token }`, setzt `kw_session` | 401 `INVALID_CREDENTIALS`; 403 `NOT_APPROVED`; 429 `RATE_LIMITED` |
| `GET` | `/api/auth/second-factor` | `requireUser` (Modul) | — | 200 `{ active }` | 401 |
| `POST` | `/api/auth/second-factor/setup` | `requireUser` (Modul) | Rumpf `{ password }` | 200 `{ secret, otpauthUri }` (einmalig) | 401; 403 `FORBIDDEN` (schon eingerichtet / SSO-Konto) |
| `POST` | `/api/auth/second-factor/confirm` | `requireUser` (Modul) | Rumpf `{ code }` | 200 `{ active: true }` | 401; 403 `FORBIDDEN` (keine offene Einrichtung) |
| `POST` | `/api/auth/second-factor/disable` | `requireUser` (Modul) | Rumpf `{ password, code }` | 200 `{ active: false }` | 401; 403 `FORBIDDEN` (nicht eingerichtet) |
| `POST` | `/api/auth/logout` | keines (Token, falls vorhanden) | — | 204, löscht `kw_session` | — |
| `GET` | `/api/auth/me` | `requireUser` (Modul) | — | 200 eigenes Konto | 401 `INVALID_CREDENTIALS` |
| `POST` | `/api/auth/office-handover` | `requireUser` (Modul) | — | 201 `{ code, expiresInMs }` (Einmalcode für das Word-Add-in) | 401 `INVALID_CREDENTIALS` |
| `POST` | `/api/auth/office-handover/redeem` | keines (der Code ist der Nachweis) | Rumpf `{ code }` | 200 `{ token, user }` | 401 `INVALID_CREDENTIALS` |
| `GET` | `/api/auth/notice` | `requireUser` (Modul) | — | 200 Hinweisstand des Kontos | 401 |
| `POST` | `/api/auth/notice` | `requireUser` (Modul) | — | 200 Hinweis als gelesen vermerkt | 401 |
| `POST` | `/api/auth/password` | `requireUser` (Modul) | Rumpf `{ oldPassword, newPassword }` | 204 | 401; Dienstfehler (`WEAK_PASSWORD`, `INVALID_CREDENTIALS`) |
| `POST` | `/api/auth/forgot` | keines | Rumpf `{ email }` | 204, gleich für bekannte und unbekannte Adressen | — |
| `POST` | `/api/auth/reset` | keines | Rumpf `{ token, newPassword }` | 204 | 429 `RATE_LIMITED`; Dienstfehler |
| `GET` | `/api/auth/oidc/start` | keines | — | Weiterleitung zum Anbieter, setzt die Ablauf-Cookies (state, nonce, PKCE) | 501 `OIDC_DISABLED` |
| `POST` | `/api/auth/oidc` | keines | Rumpf `{ code, state }` | 200 `{ user, token }`, setzt `kw_session` | 501 `OIDC_DISABLED`; 400 `OIDC_INVALID` (state passt nicht); 401 `OIDC_INVALID` (Anmeldung gescheitert) |
| `GET` | `/api/auth/saml/start` | keines | — | Weiterleitung zum Anbieter mit AuthnRequest (Anfragekennung 10 min, einmalig), setzt den Browsernachweis `kw_saml_bindung` (HttpOnly, Pfad `/api/auth/saml`) | 501 `SAML_DISABLED` |
| `GET` | `/api/auth/saml/metadata` | keines | — | 200 SP-Metadaten (`application/samlmetadata+xml`) | 501 `SAML_DISABLED` |
| `POST` | `/api/auth/saml/acs` | keines (signierte SAML-Antwort ist der Nachweis) | Formularfeld `SAMLResponse` | 303 nach `/api/auth/saml/abschluss?code=…` (Abschlusscode 2 min, einmalig) — noch keine Sitzung | 501 `SAML_DISABLED`; 401 HTML-Seite mit `SAML_LOGIN_FAILED` |
| `GET` | `/api/auth/saml/abschluss` | keines (Abschlusscode und Browsernachweis des startenden Browsers) | Abfrage `code`, Cookie `kw_saml_bindung` | 303 nach `/` bzw. ins Word-Anmeldefenster, setzt `kw_session` | 501 `SAML_DISABLED`; 401 HTML-Seite mit `SAML_LOGIN_FAILED` (Nachweis fehlt/passt nicht, Code unbekannt/verbraucht) bzw. dem Kontogrund |
| `GET` | `/api/auth/status` | keines | — | 200 `{ needsSetup, oidcEnabled, samlEnabled, selfRegistrationEnabled, passwordLoginEnabled }` | — |
| `POST` | `/api/auth/setup` | keines (nur auf leerer Instanz) | Rumpf `{ name, email, password }` | 201 `{ user, token }`, setzt `kw_session` — erstes Konto, Admin | 409 `ALREADY_SETUP`; Dienstfehler |
| `POST` | `/api/auth/users/:id/approve` | `requireAdmin` | — | 200 freigegebenes Konto | 401; 403 `FORBIDDEN`; Dienstfehler |
| `POST` | `/api/auth/users/:id/reset` | `requireAdmin` | Rumpf `{ password }` | 204 | 401; 403; Dienstfehler |
| `DELETE` | `/api/auth/users/:id` | `requireAdmin` | — | 204 | 401; 403; Dienstfehler |
| `GET` | `/api/users` | `requireAdmin` | — | 200 Kontenliste (`listUsers`) | 401; 403 |
| `POST` | `/api/users` | `requireAdmin` | Rumpf `{ name, email, password, role?, accessExpiresAt? }` | 201 Konto | 400 `BAD_REQUEST`, `WEAK_PASSWORD`; 403 `FORBIDDEN` (Befristung unlesbar oder Rollenwechsel unzulässig); 409 `EMAIL_TAKEN` |
| `PUT` | `/api/users/:id` | `requireAdmin` | Rumpf `{ role?, approve?, password?, accessExpiresAt? }` | 200 Konto bzw. 204 | 400 `BAD_REQUEST`, `WEAK_PASSWORD`; 403 `FORBIDDEN` |
| `DELETE` | `/api/users/:id` | `requireAdmin` | — | 204 | 401; 403; Dienstfehler |
| `DELETE` | `/api/users/:id/second-factor` | `requireAdmin` | — | 204 (zweiter Faktor entfernt, z. B. bei verlorenem Gerät) | 401; 403 `FORBIDDEN` (nicht eingerichtet); 404 |
| `GET` | `/api/directory` | `requireUser` (Modul) | — | 200 `[{ id, name }]` — ohne E-Mail | 401 |

Ausnahme zu Abschnitt 2: Die Wächter dieses Moduls antworten bei fehlender Anmeldung mit
`401 INVALID_CREDENTIALS`, nicht `UNAUTHENTICATED`.

Bei `KLARWERK_SSO_ONLY=1` antworten `register`, `login`, `forgot` und `reset` mit
403 `PASSWORD_LOGIN_DISABLED` (Satz `PASSWORD_LOGIN_DISABLED`, ohne eingerichteten Firmen-Login
`SSO_ONLY_NOT_CONFIGURED`).

#### 3.2a Verzeichnispflege (SCIM 2.0, `verzeichnisRoutes`, nur mit `KLARWERK_SCIM_TOKEN`)

Diese Routen registriert `buildApp` nur, wenn ein Verzeichnisschlüssel (mindestens 32 Zeichen)
gesetzt ist. Recht: Bearer mit dem Verzeichnisschlüssel (`requireVerzeichnisSchluessel`), keine
Sitzungsrolle öffnet sie. Antworten als `application/scim+json`; Fehler im SCIM-Format mit
zusätzlichem Feld `error`. Der letzte Administrator kann über diesen Weg nicht gesperrt oder
herabgestuft werden (409 `mutability`).

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/scim/v2/ServiceProviderConfig` | Verzeichnisschlüssel | — | 200 Fähigkeiten (PATCH ja, Filter `userName eq`, kein Bulk) | 401 `SCIM_UNAUTHORIZED` |
| `GET` | `/scim/v2/Users` | Verzeichnisschlüssel | Query `filter` (`userName eq "…"`), `startIndex`, `count` | 200 `ListResponse` | 401 `SCIM_UNAUTHORIZED`; 400 `invalidFilter` |
| `GET` | `/scim/v2/Users/:id` | Verzeichnisschlüssel | — | 200 SCIM-User | 401 `SCIM_UNAUTHORIZED`; 404 |
| `POST` | `/scim/v2/Users` | Verzeichnisschlüssel | SCIM-User (`userName`, `displayName`, `active`, `roles`) | 201 angelegtes Konto (Rolle aus `roles`) | 401 `SCIM_UNAUTHORIZED`; 400; 409 `uniqueness` |
| `PUT` | `/scim/v2/Users/:id` | Verzeichnisschlüssel | SCIM-User (ersetzt Name, Adresse, `active`, `roles`) | 200 Konto | 401 `SCIM_UNAUTHORIZED`; 404; 409 |
| `PATCH` | `/scim/v2/Users/:id` | Verzeichnisschlüssel | PatchOp für `active`, `userName`, `displayName`, `roles` und den gefilterten Pfad `roles[value eq "…"]` (`remove`/`replace` nur dieses Eintrags) | 200 Konto; gleicht danach die Prüfzuweisungen bestehender Objekte ab | 401 `SCIM_UNAUTHORIZED`; 400 (`invalidPath` für jeden anderen Rollenpfad); 404; 409 |
| `DELETE` | `/scim/v2/Users/:id` | Verzeichnisschlüssel | — | 204 — Austritt: Konto GESPERRT (nicht gelöscht), Sitzungen enden | 401 `SCIM_UNAUTHORIZED`; 404; 409 `mutability` |

### 3.3 Wissensobjekte (`koRoutes`, `lesevarianten`, `kanten`, `bearbeitung`, `provenance`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/kos` | `ko.read` | Abfrage `type?`, `status?`, `category?`, `tag?` | 200 Liste, sichtbarkeitsgefiltert | — |
| `POST` | `/api/kos` | `ko.create` | Rumpf `CreateKoInput` ohne `author` (`title`, `statement`, `type`, `category`, `confidentiality`, …) und `reviewerIds?` | 201 Wissensobjekt | 400 `MISSING_CONFIDENTIALITY`; Dienstfehler |
| `POST` | `/api/kos/from-document` | `ko.create` | Rumpf `{ draftId?, create?, draftPayload?, … }` | 201 Wissensobjekt; 200 bei Wiederholung desselben Vorgangs | 400 `BAD_REQUEST`, `MISSING_CONFIDENTIALITY`, `DRAFT_STAND_FEHLT`; 409 `DRAFT_STALE`; 403 `EXTERNAL_ATTACH_BLOCKED` |
| `GET` | `/api/kos/trash` | `users.manage` | — | 200 Papierkorb (`ko.trashed()`) | — |
| `DELETE` | `/api/kos/trash/:id` | `users.manage` | — | 204 endgültig gelöscht | Dienstfehler |
| `GET` | `/api/kos/:id` | `ko.read`, sichtbar | — | 200 Wissensobjekt samt `metadata_revision` | 404 `NOT_FOUND` |
| `PUT` | `/api/kos/:id` | je Aktion (unten); Anmeldung vor dem Einlesen des Rumpfs | Rumpf `{ action, … }` | 200 bzw. 201/204 je Aktion | 400 `BAD_REQUEST`; 404; 409 `KO_STALE` (mit `currentVersion`); 403 `PROPOSAL_OWN`, `PROPOSAL_REQUIRED`, `EXTERNAL_ATTACH_BLOCKED`; 409 `PROPOSAL_DECIDED`; 404 `PROPOSAL_NOT_FOUND` |
| `DELETE` | `/api/kos/:id` | `ko.read`, sichtbar, dazu Autor oder `ko.validate` | — | 204 (in den Papierkorb) | 403 `FORBIDDEN`; 404 |
| `POST` | `/api/kos/:id/restore` | `users.manage` | — | 200 wiederhergestelltes Objekt | Dienstfehler |
| `GET` | `/api/kos/:id/versions` | `ko.read`, sichtbar | — | 200 Fassungen (`ko.versionsOf`) | 404 |
| `GET` | `/api/kos/:id/evidence` | `ko.read`, sichtbar | — | 200 Belegkette (`ko.evidenceOf`) | 404 |
| `POST` | `/api/kos/:id/ai-check` | `ko.validate` | — | 200 `{ status: "pending" }` | 404; 503 `AI_CHECK_UNAVAILABLE`; 409 `AI_CHECK_NOT_RETRYABLE` |
| `GET` | `/api/evidence` | `ko.read` | Abfrage `limit?` | 200 Belege der sichtbaren Objekte | — |
| `GET` | `/api/upload-limits` | `ko.read` | — | 200 Grenzen (Vorgabe, wenn keine gesetzt) | — |
| `PUT` | `/api/upload-limits` | `users.manage` | Rumpf `{ maxAttachments?, maxAttachmentBytes? }` | 200 neue Grenzen | Dienstfehler |
| `GET` | `/api/wissensnetz/luecken` | `ko.read` | Abfrage `deckel?` | 200 Lückenmetrik | — |
| `GET` | `/api/kos/:id/lesevariante/:lang` | `ko.read`, sichtbar | — | 200 Lesevariante mit Änderungsauskunft | 404 `NOT_FOUND`, `NO_LESEVARIANTE` |
| `GET` | `/api/lesevarianten` | `ko.read` | Abfrage `lang` | 200 `{ lang, eintraege }` | 400 `MISSING_LANG` |
| `GET` | `/api/library/import/candidates/:id/lesevariante/:lang` | `ko.read` | — | 200 Lesevariante des Kandidaten | 404 `NOT_FOUND`, `NO_LESEVARIANTE` |
| `POST` | `/api/admin/lesevarianten/laden` | `users.manage` | Rumpf `{ package }` | 200 Ladebilanz | 400 `UNKNOWN_PACKAGE` |
| `GET` | `/api/kos/:id/beziehungen` | `ko.read`, sichtbar | — | 200 kuratierte Beziehungen | 404 |
| `POST` | `/api/kos/:id/beziehungen` | `ko.relate` | Rumpf `{ zielId, art, richtung, beitragSchluessel?, gesehen }` | 201 neu angelegt, 200 Wiederholung desselben Beitrags (Ansicht der Beziehung) | 400 `VALIDATION`; 404; 409 `STAND_VERALTET` (mit den aktuellen Fassungen) |
| `POST` | `/api/beziehungen/:beziehungId/widerruf` | `ko.relate` | Rumpf `{ version }` | 200 widerrufene Beziehung | 400; 404; 409 `STAND_VERALTET` |
| `GET` | `/api/kos/:id/bearbeitungen` | `ko.read`, sichtbar | — | 200 laufende Bearbeitungshinweise | 404 `NOT_FOUND` |
| `PUT` | `/api/kos/:id/bearbeitungen/:sitzung` | `ko.create`, sichtbar | — | 200 `{ jetzt, …Takt, bearbeitung }` | 404; 400 `BAD_REQUEST` (Sitzungskennung ungültig) |
| `DELETE` | `/api/kos/:id/bearbeitungen/:sitzung` | `ko.create`, sichtbar | — | 200 `{ beendet }` | 404; 400 `BAD_REQUEST` (Sitzungskennung ungültig) |
| `GET` | `/api/kos/:id/provenance` | `ko.read`, sichtbar (Schalter `KLARWERK_PROVENANCE_ENABLED`) | — | 200 Herkunftsgraph | 404 |
| `GET` | `/api/kos/:id/neighbors` | `ko.read`, sichtbar | — | 200 Nachbarn im Wissensnetz | 404 |

**Aktionen von `PUT /api/kos/:id`** (Feld `action`; Liste und Sichtbarkeitsurteil je Aktion in
`KO_AKTIONEN_MIT_TORURTEIL`, `ko-routes.ts`):

| `action` | Recht | weitere Felder |
| --- | --- | --- |
| `rate` | `ko.validate` | `verdict` |
| `assign` | `ko.assign` | `userIds` |
| `admin-validate` | `users.manage` | — |
| `revise` | `ko.create` | `changes`, `expectedVersion?` |
| `revise-release` | `requireUser` | `expectedVersion?` |
| `propose` | `ko.create` | `proposal { statement?, bodyHtml?, clearBody?, baseVersion, origin? }` |
| `decide-proposal` | `users.manage` | `proposalId`, `decision` (`uebernehmen`/`ablehnen`), `note?`, `expectedVersion?` |
| `comment`, `comment-resolve`, `comment-reopen` | `requireUser` | `text` bzw. die Fadenfelder |
| `attach`, `detach` | `ko.create` | Anhang bzw. `attachmentId` |
| `add-source`, `remove-source` | `ko.create` | Quelle bzw. `sourceId` |
| `append-document` | `ko.create` | Dokument |
| `category`, `tags` | `ko.create` | `category` bzw. `tags`, `expectedMetadataRevision?` |
| `confidentiality` | `ko.create` | Stufe |
| `ownership` | `ko.validate` | `ownership` |
| `owner-validate` | `ko.validate`; nur der benannte Eigentümer (sonst 403 `NOT_OWNER`); Dublettentor wie `rate` | `duplicateAcknowledged?` (Status „validiert“, Vertrauen unverändert; Audit `ko.owner-validated`; Eigentümer in `ownership.validators`) |
| `ownership-release` | `ko.read`; nur der benannte Eigentümer selbst (sonst 403 `NOT_OWNER`) | — (Spur `reviewers`/`validators` bleibt; Audit `ko.ownership-released`) |
| `conflict` | `ko.validate` | `conflict` (antwortet 201) |
| `resolve-conflict` | `conflict.resolve` | `conflictId`, `decision` |
| `transfer-author` | `users.manage` | `newAuthor` |
| `revalidate` | `ko.create` | — |
| `request-revalidation` | `ko.create` | — (antwortet 204; setzt den Merker „Stimmt das noch?" für dieses Objekt — erneute Prüfung aus der Bibliothek, R-1732) |
| `neighbors-changed` | `ko.validate` | — (antwortet 200 `{ markiert }`; meldet die Änderung aller an dieses Objekt gekoppelten Anlagen und markiert alle Objekte daran, R-0203; nur die Zahl, keine Kennungen) |
| `confirm-fresh` | `ko.read` | — (antwortet 200 Objekt; „Stimmt weiterhin" — Frische-Signal ohne neue Fassung und ohne Statuswechsel, nur an validierten Objekten, sonst 400 `INVALID`; vom Verantwortlichen verlängert es die Haltbarkeit; Audit `ko.freshness-confirmed`, R-0206/R-0248) |
| `schutz-oeffentlich` | `ko.validate` | `oeffentlich` (boolean; Schutzbedarf „öffentlich", nur an internen Objekten, sonst 400 `INVALID`; Audit `ko.oeffentlich-changed`, R-0652) |
| `helpful` | `ko.read` | — (antwortet 204; „Hat geholfen" am Objekt, Trust-Schritt + Audit `answer.helpful`, genau einmal je Person und Objekt, keine Prüfstimme) |

### 3.4 Entwürfe und Erfassung (`captureRoutes`, `slidesRoutes`, `objectRoutes`, `mediaRoutes`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/drafts` | `ko.create` | — | 200 eigene/sichtbare Entwürfe | — |
| `POST` | `/api/drafts` | `ko.create` | Rumpf `DraftPayload` (`title?`, `statement?`, `type?`, `category?`, `tags?`, `bodyHtml?`, `confidentiality?`, …), `operationId?`, `expectedOwner?`, `fortschreiben?` (mit `operationId`: geänderter Inhalt schreibt den Entwurf desselben Vorgangs fort, solange er unverändert ist) | 201 Entwurf; 200 bei Wiederholung derselben `operationId`, dann mit `anlage: "bestehend" \| "fortgeschrieben"` | 400 `BAD_REQUEST`; 409 `DRAFT_OWNER_MISMATCH`, `IDEMPOTENCY_PAYLOAD_MISMATCH`; 413 `PAYLOAD_TOO_LARGE` |
| `POST` | `/api/drafts/from-docx` | `ko.create` | Rumpf `{ data (Base64 .docx), name?, title? }` | 201 Entwurf aus dem Dokument | 400 `BAD_REQUEST`; 413 `DOCX_DRAFT_TOO_LARGE`, `PAYLOAD_TOO_LARGE`, `DOCX_BILDGRENZE` (höchstens 60 Bilder je Dokument, 3,5 MB `bodyHtml` nach der Bildverkleinerung und ein serialisierter Einreich-Rumpf `{ draftPayload }` von höchstens 5 MiB − 256 KiB; kein Entwurf, kein Bild weggelassen); 415 `UNSUPPORTED_MEDIA_TYPE`; 503 `BUSY` (mit `retry-after`); 408 `CLIENT_ABORTED` |
| `GET` | `/api/drafts/trash` | `ko.create` | — | 200 gelöschte, sichtbare Entwürfe | — |
| `DELETE` | `/api/drafts/trash/:id` | `ko.create` | — | 204 | 404 `NOT_FOUND` |
| `GET` | `/api/drafts/:id` | `ko.create` | — | 200 Entwurf | 404 `NOT_FOUND`; 403 `FORBIDDEN` (nicht sichtbar) |
| `PUT` | `/api/drafts/:id` | `ko.create` | Rumpf `DraftPayload`, `expectedUpdatedAt?` | 200 Entwurf | 400 `BAD_REQUEST`; 404; 403; 409 `DRAFT_STALE` |
| `DELETE` | `/api/drafts/:id` | `ko.create` | — | 204 (in den Papierkorb) | 404; 403 (nicht sichtbar oder nicht Autor, auch bei Pool-Entwurf) |
| `PUT` | `/api/drafts/:id/pool` | `ko.create`, nur Autor | Rumpf `{ imPool: boolean }` | 200 Entwurf (`imPool: true` im gemeinsamen Pool, ohne Feld privat) | 400 `BAD_REQUEST`; 404; 403 `FORBIDDEN` (nicht sichtbar oder nicht Autor) |
| `GET` | `/api/drafts/:id/naechster-schritt` | `ko.create` | — | 200 `{ naechsterSchritt }` oder `{}` | 404; 403 |
| `GET` | `/api/drafts/:id/gleicher-inhalt` | `ko.create` | — | 200 `{ indexStatus, entwuerfe: [{ id, titel }] }` — nur sichtbare Entwürfe mit gleichem Inhaltshash des technischen Index | 404; 403 |
| `POST` | `/api/drafts/:id/restore` | `ko.create` | — | 200 wiederhergestellter Entwurf | 404 |
| `POST` | `/api/drafts/:id/promote` | `ko.create` | Rumpf `{ reviewerIds?, operationId?, draftPayload?, expectedUpdatedAt? }` | 201 Wissensobjekt; 200 bei Wiederholung | 400 `BAD_REQUEST`; 409 `DRAFT_STALE`; 403 `FORBIDDEN` (nicht sichtbar oder nicht Autor, auch bei Pool-Entwurf); 403 `EXTERNAL_ATTACH_BLOCKED`; Idempotenzfehler aus Abschnitt 2 |
| `GET` | `/api/capture/slides/availability` | `ko.create` | — | 200 `{ available }` | — |
| `POST` | `/api/capture/slides` | `ko.create` (vor dem Einlesen) | Rumpf `{ data }` (Base64 PPTX) | 200 Folienbilder | 400 `BAD_REQUEST`; 413 `PAYLOAD_TOO_LARGE`; 415 `SLIDES_INVALID`; 422 `SLIDES_TIMEOUT`; 429 `RATE_LIMITED`, `CONVERSION_BUSY`; 408 `CLIENT_ABORTED`; 503 `SLIDES_UNAVAILABLE`; 500 `SLIDES_FAILED` |
| `POST` | `/api/objects` | `ko.create` (vor dem Einlesen) | Rumpf `{ name, mime, data, kind?, confidentiality?, purpose?, draftId? }` | 201 Objektbeschreibung | Dienstfehler |
| `GET` | `/api/objects/:id` | `ko.read`, nur Anhänge sichtbarer Träger | — | 200 Objekt (`Cache-Control` nach Trägerurteil: vertraulich `no-store`, sonst `private, no-cache, must-revalidate`; `Vary: Cookie, Authorization`) | 404 `NOT_FOUND` (`no-store`) |
| `GET` | `/api/objects/:id/raw` | `ko.read`, wie oben | — | 200 Rohbytes mit Inhaltstyp (Cachevertrag wie oben) | 404; 415 `UNSUPPORTED` (beide `no-store`) |
| `GET` | `/api/media/status` | `requireUser` | — | 200 Engine-Auskunft | — |
| `POST` | `/api/media/analyze` | `ko.read` | Rumpf `{ objectId, locale?, confidentiality? }` | 200 Analyse | 404 `NOT_FOUND` |
| `POST` | `/api/media/transcribe` | `ko.read` (Anmeldung vor dem Einlesen) | Rumpf `{ data, locale?, confidentiality? }` (Data-URL einer Audio-/Videoaufnahme, wird nicht gespeichert) | 200 `{ transcript, engineActive, engine, note }` | 400 `BAD_REQUEST`, `UNSUPPORTED_KIND`; 413 (über der Rumpfgrenze); 429 KI-Bremse; 502 `ENGINE_FAILED` |

### 3.5 Prüfung, Konflikte, Dubletten (`validationRoutes`, `conflictRoutes`, `overlapRoutes`, `aiCheckCoverageRoutes`, `auditRoutes`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/validation/board` | `ko.read` | Abfrage wie `GET /api/kos` ohne `status` | 200 Prüfboard | — |
| `GET` | `/api/validation/overview` | `ko.read` | — | 200 Übersicht | — |
| `GET` | `/api/validation/settings` | `ko.read` | — | 200 `{ defaultNeededValidations }` | — |
| `PUT` | `/api/validation/settings` | `users.manage` | Rumpf `{ defaultNeededValidations }` | 200 `{ defaultNeededValidations }` | Dienstfehler |
| `GET` | `/api/conflicts` | `ko.read` | — | 200 offene Konflikte, sichtbarkeitsgefiltert | — |
| `GET` | `/api/conflicts/:id` | `ko.read`, sichtbar | — | 200 Konflikt | 404 `NOT_FOUND` |
| `GET` | `/api/conflicts/vorrang/:id` | `ko.read`, Paar sichtbar | Pfad `:id` = Wissensobjekt | 200 Liste festgelegter Vorrang-Beziehungen (R-0263) | — |
| `POST` | `/api/conflicts/:id/escalate` | `conflict.resolve` | — | 200 Konflikt | Dienstfehler |
| `POST` | `/api/conflicts/:id/arbeitsart` | `conflict.resolve` | Rumpf `{ arbeitsart: regel\|sache\|version }` | 200 Konflikt (R-0252) | 400 `BAD_REQUEST`, Dienstfehler |
| `POST` | `/api/conflicts/:id/dismiss` | `conflict.resolve` | Rumpf `{ note? }` | 200 Konflikt | Dienstfehler |
| `POST` | `/api/conflicts/:id/second-opinion` | `ko.validate` | Rumpf `{ opinion }` | 200 Konflikt | Dienstfehler |
| `GET` | `/api/duplicate-signal` | `ko.read` | — | 200 eigene Objekte mit offenem Befund | — |
| `GET` | `/api/duplicates` | `ko.read` | — | 200 offene Überschneidungen | — |
| `GET` | `/api/duplicates/settings` | `ko.read` | — | 200 Anzeigeschwelle | — |
| `PUT` | `/api/duplicates/settings` | `users.manage` | Rumpf `{ minConfidence }` | 200 neue Schwelle | Dienstfehler |
| `GET` | `/api/duplicates/:id` | `ko.read`, sichtbar | — | 200 Überschneidung | 404 `NOT_FOUND` |
| `POST` | `/api/duplicates/:id/dismiss` | `ko.validate` | Rumpf `{ note? }` | 200 | Dienstfehler |
| `POST` | `/api/duplicates/:id/keep-separate` | `ko.validate` | Rumpf `{ note? }` | 200 | Dienstfehler |
| `POST` | `/api/duplicates/:id/link-related` | `ko.validate` | Rumpf `{ note? }` | 200 | Dienstfehler |
| `POST` | `/api/duplicates/:id/status` | `ko.validate` | Rumpf `{ status?, reason?, note? }` | 200 | Dienstfehler |
| `POST` | `/api/duplicates/:id/merge` | `ko.validate`, kein Autor einer Seite, beide Inhalte lesbar, gleicher Space | Rumpf `{ fuehrend: { id, version }, aufgehend: { id, version }, titel, kernaussage, bedingungen[], massnahmen[], quellen[], bestaetigt: true, vermerk? }` | 200 `{ befund, fuehrend, aufgehend }` | 400 `INVALID`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT` |
| `GET` | `/api/ai-check/coverage-summary` | `ko.read` | — | 200 Abdeckung der KI-Prüfung | — |
| `GET` | `/api/audit` | `ko.validate` | Abfrage `actor?`, `action?`, `target?` | 200 Protokolleinträge (Inhaltsfelder nicht lesbarer Objekte geschwärzt) | — |
| `GET` | `/api/audit/seite` | `ko.validate` | Abfrage `actor?`, `action?`, `actions?` (Komma-Liste), `target?`, `from?`, `to?` (ISO-Zeitpunkte), `before?`, `limit?` (höchstens 100) | 200 `{ entries, nextBefore, limit, objekte, namensbelege }` — jüngste zuerst; `objekte` nur für Objekte, die der Betrachter öffnen darf | 400 `BAD_REQUEST` (unlesbarer Zeitraum oder Zahl) |
| `GET` | `/api/audit/verify` | `ko.validate` | — | 200 Prüfbericht der Protokollkette mit Prüfzeitpunkt `checkedAt` | — |
| `GET` | `/api/audit/ko/:koId/findings` | `ko.validate` | Pfad `koId` | 200 `{ ids }` Kennungen der Konflikte und Überschneidungen des Objekts | — |
| `GET` | `/api/audit/export` | `ko.validate` | — | 200 Kettendatei `{ format, count, head, inspection, entries, geschwaerzt }` als Anhang; hängt `audit.exported` an; Inhaltsfelder nicht lesbarer Objekte geschwärzt | — |

### 3.6 Fragen, Klara und KI (`askRoutes`, `klaraAiRoutes`, `klaraZurufRoutes`, `klaraAnswerExplanationRoutes`, `knowledgeCheckRoutes`, `checkTextRoutes`, `reasonerRoutes`, `helpRoutes`, `modelRunRoutes`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/ask` | `ko.read` oder Add-in-Fähigkeit | Rumpf `{ question, locale?, mode?, selection?, selectionConfidentiality?, questionSource?, thread?, zweitmeinung? }` — `zweitmeinung: true` wirkt nur im Konsolenzweig (R-0305/R-1099) | 200 Antwort mit Belegen; mit `zweitmeinung` zusätzlich das Feld `zweitmeinung` (Gegenüberstellung oder Grund) | 401 `UNAUTHENTICATED`; 403 `FORBIDDEN`; 503 `KI_ABGESCHALTET` |
| `POST` | `/api/ask/helpful` | `ko.read` | Rumpf `{ koId, receipt? }` | 204 | Dienstfehler |
| `POST` | `/api/ask/report` | `ko.read` | Rumpf `{ koId, receipt, grund: "antwort-falsch" \| "quelle-passt-nicht" }` | 200 Quittung `{ meldungId, koId, koTitle, grund, at, zugestelltAn, bereitsGemeldet }` | 400 `BAD_REQUEST`; 403 `FORBIDDEN`; 404 `NOT_FOUND` |
| `POST` | `/api/ask/not-helpful` | `ko.read`; mit `alternative` zusätzlich `ko.create` | Rumpf `{ koId, receipt?, alternative?, entwurfTitel? }` | 200 `{ vermerkt, entwurfId }` (Audit `answer.not_helpful`, genau einmal je Person und Objekt; `alternative` wird ein Entwurf) | 403 `FORBIDDEN`; 404 `NOT_FOUND`; 400 Schema |
| `GET` | `/api/gaps` | `ko.read` | — | 200 Wissenslücken | — |
| `GET` | `/api/gaps/summary` | `ko.read` | — | 200 Zusammenfassung | — |
| `GET` | `/api/gaps/:id/ansprechpartner` | `ko.assign` (Schalter `KLARWERK_EXPERT_MATCHING`) | — | 200 Ansprechpartner nach Wissensspuren | 404 `not_found` ohne Schalter, vor dem Rechtetor; 404 `NOT_FOUND` unbekannte Lücke |
| `PUT` | `/api/gaps/:id` | `ko.assign` | Rumpf `{ expertId? \| close? \| priority? }` | 200 Lücke | 400 `BAD_REQUEST` |
| `DELETE` | `/api/gaps/:id` | `ko.validate` | Abfrage `confirm` | 204 | Dienstfehler |
| `GET` | `/api/klara/ai-status` | `ko.read` | Bindung aus Kopfzeilen des Add-ins | 200 Klara-Status der Sitzung | — |
| `POST` | `/api/klara/sessions` | `ko.read` | Rumpf `{ addinInstanceId?, documentDescriptor? }` | 201 Sitzung | Dienstfehler |
| `GET` | `/api/klara/sessions/:sessionId` | `ko.read` | — | 200 Sitzung | Dienstfehler |
| `POST` | `/api/klara/sessions/:sessionId/document-context` | `ko.read` | Rumpf `{ documentDescriptor? }` | 200 Sitzung | Dienstfehler |
| `POST` | `/api/klara/sessions/:sessionId/consent` | `ko.read` | — | 200 Sitzung mit Zustimmung | Dienstfehler |
| `DELETE` | `/api/klara/sessions/:sessionId/consent` | `ko.read` | — | 200 Sitzung ohne Zustimmung | Dienstfehler |
| `POST` | `/api/klara/sessions/:sessionId/close` | `ko.read` | — | 200 geschlossene Sitzung | Dienstfehler |
| `POST` | `/api/klara/sessions/:sessionId/zuruf` | `ko.read` | Rumpf `{ text, koIds, art }` | 200 Vorschlag (schreibt nichts) | 503 `NO_FORMULIERER`; Dienstfehler |
| `GET` | `/api/klara/answers/:answerId/explanation` | `ko.read` | — | 200 Erklärung der Antwort | 404 `NOT_FOUND` |
| `POST` | `/api/knowledge/check` | `ko.read` | Rumpf `{ text, source?, koId?, draftId?, confidentiality?, nichtEingestuft? }` | 200 Ähnlichkeits-/Widerspruchsbefund; bei ähnlichem Negativwissen zusätzlich `negativwissen[]` | — |
| `POST` | `/api/check-text` | `ko.read` oder Add-in-Fähigkeit (Schalter `KLARWERK_ADDON_API`) | Rumpf `{ text, title?, locale?, want?, source?, koId?, confidentiality?, nichtEingestuft?, ungeprueftEinbeziehen? }` — `ungeprueftEinbeziehen: false` beschränkt den Sitzungsweg auf validierten Bestand, `true`/fehlend lässt ihn wie bisher auch Eingereichtes einbeziehen; am Add-in-Schlüssel wirkungslos (immer nur validiert) | 200 Prüfergebnis | 403 `FORBIDDEN`; 400 Formfehler |
| `POST` | `/api/reasoner` | `ko.read` | Rumpf `{ task, text?, answers?, locale?, instruction?, query?, outputLanguage?, source?, koId?, confidentiality?, nichtEingestuft?, draftId? }` | 200 Ergebnis der Aufgabe | 400 `BAD_REQUEST`; 409 `CONFIDENTIAL_CLOUD_BLOCKED` (mit `reason`); 503 `KI_ABGESCHALTET` |
| `POST` | `/api/reasoner/describe` | `ko.read` (vor dem Einlesen) | Rumpf `{ dataUrl, locale?, source?, koId?, confidentiality?, nichtEingestuft?, draftId?, context? }` | 200 Bildbeschreibung | 400 `BAD_REQUEST`; 413 `PAYLOAD_TOO_LARGE` |
| `POST` | `/api/reasoner/enrich` | `ko.create` | Rumpf `{ query, locale? }` | 200 Anreicherung | 400 `BAD_REQUEST`; 403 `PUBLIC_AI_ENRICHMENT_BLOCKED` |
| `GET` | `/api/reasoner/config` | `users.manage` | — | 200 Konfiguration samt Anbietern (`configStatus()`) | — |
| `PUT` | `/api/reasoner/config` | `users.manage` | Rumpf `{ global?, perTask?, kiFreigabe? { oeffentlicheKi?, vertraulicheInhalte? }, zweitmeinung? }` — `zweitmeinung`: `openai`/`anthropic`/`local`, `null` = aus, weglassen = unverändert | 200 neuer Status | 400 `BAD_REQUEST`; 409 `REASONER_POLICY_ENV_LOCKED`; 503 `REASONER_FREIGABE_NICHT_PROTOKOLLIERBAR`; 503 `REASONER_ZWEITMEINUNG_NICHT_PROTOKOLLIERBAR` |
| `GET` | `/api/reasoner/assist-presets` | `ko.read` | — | 200 Vorlagen | — |
| `PUT` | `/api/reasoner/assist-presets` | `users.manage` | Rumpf `{ presets: [{ id?, name?, instruction? }] }` | 200 Vorlagen | 400 `BAD_REQUEST` |
| `POST` | `/api/reasoner/test` | `users.manage` | — | 200 Probe des Cloud-Wegs | — |
| `POST` | `/api/reasoner/test-local` | `users.manage` | — | 200 Probe des lokalen Wegs | — |
| `POST` | `/api/reasoner/conflict-self-test` | `users.manage` | — | 200 Selbsttest Widerspruch | — |
| `POST` | `/api/reasoner/duplicate-self-test` | `users.manage` | — | 200 Selbsttest Dublette | — |
| `POST` | `/api/help/explain` | `ko.read` | Rumpf `{ question, snippets, locale? }` | 200 Hilfeantwort | 400 `BAD_REQUEST` |
| `GET` | `/api/model-runs` | `ko.read` | Abfrage `limit?` | 200 Modellläufe (Kontext nur für Berechtigte) | — |
| `GET` | `/api/model-runs/auswertung` | `ko.read` | Abfrage `von?`, `bis?` (ISO 8601; Vorgabe 30 Tage, höchstens 366) | 200 `{ auswertung, preisgrundlage }` — nur Summen und Zähler | 400 `BAD_REQUEST` |

### 3.7 Bibliothek, Import, Auswertung (`libraryRoutes`, `categoryRoutes`, `outputRoutes`, `managementRoutes`, `externalRoutes`, `lifecycleRoutes`, `notificationsRoutes`, `livewallRoutes`, `impactRoutes`, `gesamtanweisungRoutes`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/library/search` | `ko.read` | Abfrage `q?` und Filter wie `GET /api/kos` | 200 Treffer | 500 `INTERNAL`, solange die Suchprojektion nicht bereit ist |
| `GET` | `/api/library/images` | `ko.read` | Abfrage `q?`, `limit?` | 200 Bildtreffer | 400 `BAD_REQUEST`; 503 `SEARCH_UNAVAILABLE` |
| `GET` | `/api/library/export` | `ko.read` | Abfrage `format?`, `ids?` (kommagetrennt; grenzt nur ein — validiert/Vertraulichkeit gelten weiter; leer = leere Auswahl) | 200 Export | — |
| `POST` | `/api/library/import` | `ko.create` | Rumpf `{ items }` | 200 Importbilanz | Dienstfehler |
| `GET` | `/api/library/import/candidates` | `ko.read` | — | 200 Prüfwarteschlange | — |
| `GET` | `/api/library/import/candidates/befunde` | `ko.read` | — | 200 je Kandidat `{ id, schutz, veraltet }` — schützenswert (Gründe ohne Werte) und veraltet (Stand der Quelle), jeweils mit `bewertet: false`, wo nichts zu bewerten war | — |
| `POST` | `/api/library/import/candidates` | `ko.create` | Rumpf `{ items }` | 201 Kandidaten | Dienstfehler |
| `PUT` | `/api/library/import/candidates/:id` | `ko.validate` | Rumpf `{ action: accept \| reject \| info, note? }` | 200 Kandidat | 400 `BAD_REQUEST` |
| `POST` | `/api/admin/import/cleanup` | `users.manage` | Rumpf `{ confirm?, digest? }` | 200 `{ preview: true, … }` bzw. `{ preview: false, … }` | 409 `CLEANUP_DRIFT` |
| `GET` | `/api/analytics` | `ko.read` | — | 200 Auswertung | — |
| `GET` | `/api/analytics/busfactor` | `ko.read` | — | 200 Busfaktor | — |
| `GET` | `/api/analytics/expertise` | `ko.assign` (Schalter `KLARWERK_EXPERT_MATCHING`) | — | 200 Expertise | 404 `not_found` ohne Schalter, vor dem Rechtetor |
| `GET` | `/api/graph` | `ko.read` | — | 200 Wissensgraph | — |
| `GET` | `/api/categories` | `requireUser` | — | 200 `{ categories }` | — |
| `GET` | `/api/output/sources` | `ko.read` | — | 200 geeignete Quellen | — |
| `POST` | `/api/output/generate` | `ko.read` | Rumpf `{ kind, koIds, audienceRole? }` | 200 Dokument | 400 `NO_SOURCES`, `NOT_VALIDATED`, `UNKNOWN_KO`, `UNKNOWN_KIND`, `CONFIDENTIAL` |
| `GET` | `/api/output/wochenupdate` | `ko.read` | Abfrage `bis?` (`JJJJ-MM-TT`, ohne Angabe heute; Zeitraum sieben Tage) | 200 Wissensupdate `{ title, von, bis, generatedAt, eintraege, markdown, provenance }` (nur validiert, nicht vertraulich; schreibt und verschickt nichts) | 400 `BAD_REQUEST` |
| `POST` | `/api/output/scorm/pruefen` | `ko.read` | Rumpf `{ koIds, sprache: de \| en, empfaenger, titel? }` | 200 Prüfung `{ exportierbar, format, empfaenger, befunde, fassung }` (erzeugt und schreibt nichts) | 400 `BAD_REQUEST` |
| `POST` | `/api/output/scorm/paket` | `ko.read` | Rumpf wie `/api/output/scorm/pruefen` | 200 `application/zip` (SCORM-1.2-Paket), Kopf `x-klarwerk-exportfassung`, `x-klarwerk-paket-sha256`; Auditeintrag `output.lms-export` | 400 `BAD_REQUEST`; 422 `EXPORT_BLOCKED` mit Prüfung |
| `GET` | `/api/management/snapshot` | `ko.read` | — | 200 Lagebild | — |
| `GET` | `/api/management/risk-horizon` | `ko.read` (alle Bereiche nur mit `users.manage`) | — | 200 Bereichsblick mit Ruhestandshorizonten, sichtbarkeitsgefiltert | — |
| `GET` | `/api/management/profiles` | `users.manage` | — | 200 `{ categories, retirement }` | — |
| `PUT` | `/api/management/profiles/category` | `users.manage` | Rumpf: Bereichsprofil einer Kategorie | 200 gespeichertes Profil | Dienstfehler |
| `PUT` | `/api/management/profiles/retirement/:userId` | `users.manage` | Rumpf `{ horizonMonths }` | 200 `{ entry }` | 404 `NOT_FOUND` (unbekanntes Konto); Dienstfehler |
| `GET` | `/api/external/policy` | `ko.read` | — | 200 `{ stage }` | — |
| `PUT` | `/api/external/policy` | `users.manage` | Rumpf `{ stage }` | 200 `{ stage }` | Dienstfehler |
| `GET` | `/api/external/search` | `ko.read` | Abfrage `q?` | 200 Treffer | 403 `EXTERNAL_SEARCH_BLOCKED`; 501 `EXTERNAL_SEARCH_DISABLED` |
| `POST` | `/api/lifecycle/couple` | `ko.create` | Rumpf `{ assetRef, koId }` | 204 | Dienstfehler |
| `GET` | `/api/lifecycle/couplings/:koId` | `ko.read`, sichtbar | — | 200 Kopplungen | 404 |
| `POST` | `/api/lifecycle/asset-changed` | `ko.validate` | Rumpf `{ assetRef }` | 200 betroffene Objekte | Dienstfehler |
| `POST` | `/api/lifecycle/handover/preview` | `users.manage` | Rumpf `{ from, to }` | 200 Vorschau der Wissensübergabe (Wissensobjekte mit Titel, Eigentum, Hauptverantwortung im Papierkorb mit Titel, Entwürfe/Lücken/Prüfaufgaben als Kennung — derselbe Umfang wie die Ausführung); schreibt nichts | 400 `INVALID` (leer/gleiche Person); 404 `NOT_FOUND` (Nachfolger kein freigeschaltetes Konto) |
| `POST` | `/api/lifecycle/handover` | `users.manage` | Rumpf `{ from, to }` | 200 `{ uebergeben, fehlgeschlagen }`; Protokoll `lifecycle.handover`, je Objekt `ko.author-transferred`/`ko.ownership` | wie Vorschau |
| `GET` | `/api/lifecycle/pending` | `ko.read` | — | 200 Kennungen sichtbarer offener Objekte | — |
| `POST` | `/api/learning-paths` | `ko.create` | Rumpf `{ role, steps: [{ title }] }` | 201 Lernpfad | Dienstfehler |
| `GET` | `/api/learning-paths/:role` | `ko.read` | — | 200 Lernpfad | 404 `NOT_FOUND` |
| `POST` | `/api/learning-paths/:pathId/complete` | `ko.read` | Rumpf `{ stepId }` | 200 Fortschritt | Dienstfehler |
| `GET` | `/api/learning-paths/:pathId/progress` | `ko.read` | — | 200 Fortschritt | — |
| `GET` | `/api/notifications` | `requireUser` | — | 200 Glockenliste | — |
| `POST` | `/api/notifications/seen` | `requireUser` | Rumpf `{ ids }` | 200 `{ unseenCount }` | 400 (`ids` fehlt) |
| `GET` | `/api/livewall` | `ko.read` | — | 200 Live-Wand (`saved`, `helped`, `helpedToday`, `validated` — Name/Foto nur mit Zustimmung) | — |
| `GET` | `/api/livewall/consent` | `requireUser` | — | 200 `{ nameConsent, photoConsent, photo? }` — eigenes Konto | — |
| `PUT` | `/api/livewall/photo` | `requireUser` | Rumpf `{ photo }` (PNG/JPEG/WebP als Daten-URL, begrenzt) | 200 `{ photoConsent: true }` — eigenes Foto, Hochladen ist die Zustimmung | 400 `BAD_REQUEST`, 503 `UNAVAILABLE` |
| `DELETE` | `/api/livewall/photo` | `requireUser` | — | 200 `{ photoConsent: false }` — Widerruf löscht die Bilddaten | — |
| `PUT` | `/api/livewall/consent` | `requireUser` | Rumpf `{ nameConsent: boolean }` | 200 `{ nameConsent }` — Zustimmung/Widerruf als Prüfprotokoll-Ereignis | 400 `BAD_REQUEST` |
| `GET` | `/api/me/impact` | `requireUser` | — | 200 eigene Wirkung | — |
| `GET` | `/api/gesamtanweisungen` | `ko.read` | — | 200 sichtbare Anweisungen | — |
| `POST` | `/api/gesamtanweisungen` | `ko.create` | Rumpf `{ titel?, zweck?, geltungsbereich?, voraussetzungen? }` | 201 Anweisung | Dienstfehler |
| `GET` | `/api/gesamtanweisungen/:id` | `ko.read`, sichtbar | — | 200 Anweisung | 404 |
| `PUT` | `/api/gesamtanweisungen/:id` | `ko.create` | Rumpf Kopf wie oben und `version` | 200 Anweisung | 400 `VALIDATION`; 409 `CONFLICT` (mit `stand`, `version`) |
| `POST` | `/api/gesamtanweisungen/:id/bausteine` | `ko.create` | Rumpf `{ version, koId, koVersion, nachweisHash?, voraussetzung? }` | 200 Anweisung | 400 `VALIDATION`; 409 `CONFLICT` |
| `PUT` | `/api/gesamtanweisungen/:id/reihenfolge` | `ko.create` | Rumpf `{ version, reihenfolge }` | 200 Anweisung | 400 `VALIDATION`; 409 `CONFLICT` |
| `PUT` | `/api/gesamtanweisungen/:id/bausteine/:bausteinId/voraussetzung` | `ko.create` | Rumpf `{ version, voraussetzung? }` | 200 Anweisung | 400 `VALIDATION`; 409 `CONFLICT` |
| `GET` | `/api/gesamtanweisungen/:id/staende` | `ko.read`, sichtbar | — | 200 `{ staende }` | 404 |
| `GET` | `/api/gesamtanweisungen/:id/vergleich` | `ko.read`, sichtbar | Abfrage `von`, `bis` | 200 Vergleich zweier Stände | 400 `VALIDATION`; 404 |
| `POST` | `/api/gesamtanweisungen/:id/vorlegen` | `ko.create` | Rumpf `{ version }` | 200 Anweisung | 400 `VALIDATION`; 409 `CONFLICT` |
| `POST` | `/api/gesamtanweisungen/:id/entscheiden` | `ko.validate` | Rumpf `{ version, entscheidung: angenommen \| abgelehnt }` | 200 Anweisung | 400 `VALIDATION`; 409 `CONFLICT` |

### 3.8 Verwaltung und Quellenimport (`adminRoutes`, `importAccessRoutes`, `confluenceImportRoutes`, `importRunRoutes`, `importLaufListeRoutes`, `sharepointImportRoutes`, `jiraImportRoutes`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/admin/demo-seed` | `users.manage` | — | 200 `{ present, count }` | — |
| `POST` | `/api/admin/demo-seed` | `users.manage` | — | 200 Ladebilanz | Dienstfehler |
| `DELETE` | `/api/admin/demo-seed` | `users.manage` | — | 200 Entfernbilanz | Dienstfehler |
| `POST` | `/api/admin/sim-corpus` | `users.manage` | — | 200 Ladebilanz | Dienstfehler |
| `POST` | `/api/admin/examples/load` | `users.manage` | Rumpf `{ package }` | 200 Ladebilanz | 400 `UNKNOWN_PACKAGE` |
| `GET` | `/api/admin/demo-packages` | `users.manage` | — | 200 Paketübersicht | — |
| `GET` | `/api/admin/demo-packages/:id/preview` | `users.manage` | Abfrage `aktion?` | 200 Vorschau | 404 `UNKNOWN_PACKAGE`; 400 `UNKNOWN_ACTION` |
| `POST` | `/api/admin/demo-packages/:id/load` | `users.manage` | — | 200 Ladebilanz | 404 `UNKNOWN_PACKAGE` |
| `POST` | `/api/admin/demo-packages/:id/reset` | `users.manage` | — | 200 Bilanz | 404 `UNKNOWN_PACKAGE` |
| `DELETE` | `/api/admin/demo-packages/:id` | `users.manage` | — | 200 Entfernbilanz | 404 `UNKNOWN_PACKAGE` |
| `GET` | `/api/admin/factory-reset` | `users.manage` | — | 200 `{ available }` | — |
| `POST` | `/api/admin/factory-reset` | `users.manage` | Rumpf `{ password }` (erneute Bestätigung) | 200 `{ ok: true }`, danach endet der Prozess | 403 `FORBIDDEN` (nicht verfügbar); 401 `INVALID_PASSWORD` |
| `GET` | `/api/admin/sicherungen` | `users.manage` | — | 200 `{ zustand, verzeichnis, gelesenUtc, sicherungen? }` | — |
| `GET` | `/api/import/confluence/zugang` | `users.manage` | — | 200 Zugangszustand | — |
| `PUT` | `/api/import/confluence/schalter` | `users.manage` | Rumpf `{ an: true \| false }` | 200 neuer Schalterstand | 400 `BAD_REQUEST`; 409 `IMPORT_NOT_RELEASED`; 503 `SWITCH_UNAVAILABLE` |
| `GET` | `/api/import/sharepoint/zugang` | `users.manage` | — | 200 Zugangszustand | — |
| `GET` | `/api/import/jira/zugang` | `users.manage` | — | 200 Zugangszustand | — |
| `POST` | `/api/import/confluence/verbindungstest` | `users.manage` | — | 200 `{ geprueftAm, umfang, ergebnis, dauerMs }` (auch bei negativem Ergebnis; liest eine Seite des Space ohne Inhalt, schreibt nur das Prüfprotokoll) | — |
| `GET` | `/api/admin/import/runs` | `users.manage` | Abfrage `limit` (1–200, Vorgabe 50) | 200 `{ verfuegbar, limit, ausloeserFestgehalten, runs[] }` (jüngste Läufe zuerst) | — |
| `POST` | `/api/import/sharepoint/verbindungstest` | `users.manage` | — | 200 `{ geprueftAm, umfang, ergebnis, dauerMs }` (auch bei negativem Ergebnis; liest eine Listenseite, schreibt nur das Prüfprotokoll) | — |
| `POST` | `/api/admin/import/confluence` | `users.manage` (Schalter `KLARWERK_CONFLUENCE_IMPORT`) | Rumpf `{ dryRun? }` | 200 Zusammenfassung bzw. 202 `{ importId, status: "QUEUED" }` | 503 `IMPORT_UNAVAILABLE`; 409 `IMPORT_ALREADY_RUNNING`; `IMPORT_FAILED` |
| `POST` | `/api/admin/import/confluence/explore` | `users.manage` (Schalter wie oben) | — | 200 Erkundung | 503 `IMPORT_UNAVAILABLE`; `EXPLORE_FAILED` |
| `POST` | `/api/admin/import/confluence/select` | `users.manage` (Schalter wie oben) | Rumpf `{ prompt?, criteria?, locale?, promptConfidential? }` | 200 Auswahlvorschau | 400 `BAD_REQUEST`; 503 `IMPORT_UNAVAILABLE`; `SELECT_FAILED` |
| `POST` | `/api/admin/import/confluence/group` | `users.manage` (Schalter wie oben) | Rumpf `{ criteria?, locale?, selectedCandidateIds? }` | 200 Gruppierung | 400 `GROUP_EMPTY_SELECTION`, `GROUP_TOO_MANY`, `GROUP_TOO_LARGE`; 503; `GROUP_FAILED` |
| `POST` | `/api/admin/import/confluence/apply` | `users.manage` (Schalter wie oben) | Rumpf `{ criteria?, includeIds?, snapshotToken? }` | 200 Übernahmebilanz | 400 `APPLY_TOO_MANY`; 409 `SNAPSHOT_EXPIRED`; 503; `APPLY_FAILED` |
| `GET` | `/api/admin/import/runs/:importId` | `users.manage` (Schalter wie oben) | — | 200 Lauf | 404 `NOT_FOUND` |
| `GET` | `/api/admin/import/runs/:importId/result` | `users.manage` (Schalter wie oben) | — | 200 Laufergebnis | 404 `NOT_FOUND` |
| `GET` | `/api/admin/import/source-records/:sourceRecordId` | `users.manage` (Schalter wie oben) | — | 200 Quellsatz | 404 `NOT_FOUND` |
| `POST` | `/api/admin/import/sharepoint/files` | `users.manage` (Schalter `KLARWERK_SHAREPOINT_IMPORT`) | Rumpf `{ folderId?, ids? }` | 200 `{ dateien, truncated, nurBefunde, befunde }` | 503 `IMPORT_UNAVAILABLE`; 400 `APPLY_TOO_MANY`; 403/404/502 `SHAREPOINT_*` |
| `POST` | `/api/admin/import/sharepoint/folder-apply` | `users.manage` (Schalter `KLARWERK_SHAREPOINT_IMPORT`) | Rumpf `{ folderId?, fortsetzung? }` | 200 Übernahmebilanz eines Ordners (in Losen) | 503 `IMPORT_UNAVAILABLE`; 400 `FORTSETZUNG_INVALID`, `FORTSETZUNG_ORDNER`; 409 `FORTSETZUNG_UNBEKANNT`, `FORTSETZUNG_BELEGT` |
| `POST` | `/api/admin/import/sharepoint/apply` | `users.manage` (Schalter wie oben) | Rumpf `{ ids }` | 200 Übernahmebilanz | 503 `IMPORT_UNAVAILABLE`; 400 `APPLY_EMPTY_SELECTION`, `APPLY_TOO_MANY` |
| `POST` | `/api/admin/import/jira/issues` | `users.manage` (Schalter `KLARWERK_JIRA_IMPORT`) | Rumpf `{ fortsetzung? }` | 200 `{ projekt, vorgaenge, fortsetzung }` (lesend) | 503 `IMPORT_UNAVAILABLE`; 400 `FORTSETZUNG_INVALID`; 403/404/502 `JIRA_*` |
| `POST` | `/api/admin/import/jira/apply` | `users.manage` (Schalter wie oben) | Rumpf `{ keys }` | 200 Übernahmebilanz `{ imported, alreadyQueued, failed, notFound, vorgaenge, importId? }` | 503 `IMPORT_UNAVAILABLE`; 400 `APPLY_EMPTY_SELECTION`, `APPLY_TOO_MANY`; 403 `JIRA_FORBIDDEN`, `JIRA_ROLES_FORBIDDEN`; 404/502 `JIRA_*` |
| `POST` | `/api/admin/import/jira/project-apply` | `users.manage` (Schalter wie oben) | Rumpf `{ fortsetzung? }` | 200 Übernahmebilanz einer Projektseite samt `fortsetzung`, `projektAbgeschlossen` | 503 `IMPORT_UNAVAILABLE`; 400 `FORTSETZUNG_INVALID`; 403 `JIRA_FORBIDDEN`, `JIRA_ROLES_FORBIDDEN`; 404/502 `JIRA_*` |

### 3.9 Älteres Klara-Add-in (`addinStaticRoutes`, Schalter `KLARWERK_ADDON_API`)

| Methode | Pfad | Recht | Eingaben | Erfolg | Fehler |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/addin` | keines | — | — (immer 404, kein Verzeichnislisting) | 404 `NOT_FOUND` |
| `GET` | `/addin/*` | keines | Dateipfad im Bündel | 200 Datei aus der festen Dateiliste | 404 `NOT_FOUND` |

## 4 Testabdeckung und Abdeckungsziel

Das Abdeckungsziel ist das vorhandene und wird hier nicht neu gesetzt: `vitest.config.ts`,
`GEMEINSAM.coverage` — Anbieter `v8`, `thresholds: { lines: 80, functions: 80 }`, Bericht nach
`docs/generated/coverage`.

**Ehrlicher Stand:** Kein Paketskript fährt Vitest mit `--coverage` (`package.json`: `test`,
`test:integration`, `check`), und das Anbieterpaket `@vitest/coverage-v8` steht nicht in den
Abhängigkeiten. Das Ziel ist also festgelegt, wird aber von keinem Tor durchgesetzt. Ein Lauf
braucht die Installation dieses Pakets — die ist in diesem Auftrag ausdrücklich nicht erlaubt
und deshalb nicht gemacht.

Gegen die Endpunkte dieser Referenz laufen heute schon die Rollenabnahme
(`tests/beta-rollenabnahme/`, jede Route gemessen oder mit Grund zurückgestellt) und die
Routentests unter `services/app/src/*.test.ts`. Der neue Prüfstand
`tests/architektur-vertrag/http-api-referenz.test.ts` hält diese Datei mit dem Router deckungsgleich.
