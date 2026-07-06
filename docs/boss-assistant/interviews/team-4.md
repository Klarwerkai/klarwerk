# Interview — Team 4

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Team 4 (unverifiziert, wo markiert)._

## 1. Rolle & Domäne
- **Team 4 = öffentliche KLARWERK-Marketing-Website** (`klarwerk.ai` / `www.klarwerk.ai`), **nicht** die Produkt-App.
  Quelle: `docs/TEAM4_CHARTER.md`.
- Auftrag: KLARWERK als „Enterprise Knowledge OS für industrielles Erfahrungswissen" positionieren —
  **nicht** als Chatbot, Dokumentensuche oder generisches Wissensmanagement.
- Claude-Rolle = Hauptautor je Slice, ausschließlich auf Codex-Prompt.

## 2. Aufgaben & Verantwortung
- Website-Struktur, Positionierung, Copy, Sitemap/Seitenarchitektur, Demo-/Kontakt-Konzept, Investor-Page-Konzept,
  GoDaddy-/Hetzner-Planung (nur nach Pedi-Freigabe), Abgrenzung gegen Produkt/AI-Infra/Ops.
- **Repo: `klarwerk-public-website`**, Remote `git@github.com:Klarwerkai/klarwerk-public-website.git`, Branch `main`.
- Gepflegt: `site/` (HTML/CSS/JS/SVG), `site/scripts/smoke-check.mjs` (lokaler Prüf-Runner), `site/robots.txt`,
  `site/transfer-manifest.json`, `site/hetzner-preview-manifest.json`, `docs/` (83 Blueprints).
- **Non-Goals (Charter):** Produkt-App, Login/Auth, APIs, DB, DNS, Live-Deployment, echte Kundendaten/-logos,
  finale Legal-Texte.

## 3. Aktueller Stand
- **Grün:** vollständige lokale, nicht-live, noindex-geschützte Static Preview; Smoke Runner PASS
  (zuletzt 140 PASS / 1 WARN / 0 FAIL). Branch `main` sauber, letzter Commit `22af124` (KWEB-103).
- **Zuletzt:** UI/UX-Redesign — DE-Marketing-Route (Start, Problem/Lösung, Funktion, Use Cases, FAQ, Kontakt, Beta)
  + EN-Start auf Marketing-Niveau; internes Scaffolding von öffentlichen Seiten entfernt.
- **Blockiert (Freigabe-Gates, kein techn. Fehler):** DNS, Publish, Deployment, Legal/Privacy, Claims, App-Link,
  Contact-Flow, Assets — alle offen. **Kein Livegang.**

## 4. Entscheidungen & Änderungen
- Anfangs (KWEB-71 ff.): lokale Static Preview mit sichtbarem Review-/Gate-Scaffolding (Preview-Banner, Stop-Lines,
  `[OFFEN]`/`[PLATZHALTER]`, ASCII-Workaround `ue/oe/ae/ss`) — bewusst dokumentartig für interne Reviews.
- Prüf-Infra (KWEB-89 ff.): Node-Smoke-Runner (`smoke-check.mjs`, nur Builtins, kein Netz/Schreiben) +
  `transfer-manifest.json`; Signoff-Board (KWEB-92), Gate-Closure (KWEB-95), Device-/Browser-Evidence (KWEB-93/94),
  MVP-Page-Split + Navigation (KWEB-96/97), MVP-Evidence (KWEB-98).
- Hetzner-Preview-Schutz (KWEB-100): `robots.txt` Disallow/noindex, nginx-Basic-Auth-Runbook; htpasswd nur am
  Server, kein Credential im Repo.
- Bilingual (KWEB-101): DE/EN (`en.html`).
- **Verworfen:** (a) gesamtes Public-Scaffolding als Fehlrichtung → in KWEB-102/103 von Public-Seiten entfernt,
  lebt nur noch auf internen Seiten (Vorgabe `docs/PUBLIC_WEBSITE_UI_UX_BRIEF_V0.md`); (b) ASCII-Umlaut-Workaround
  öffentlich → echte UTF-8-Umlaute (intern bleibt ASCII); (c) kein echtes `<form>`/mailto für Beta/Kontakt →
  gestaltete CTA-Seite, Formular „erst nach Freigabe scharf schalten".
- **Unsicherheit:** UI/UX-Brief-TL;DR beschreibt Stand vor KWEB-102; Startseite war zu KWEB-103-Start schon
  überarbeitet, Pass 2 zog v. a. Unterseiten nach.

## 5. Offene Punkte & Abhängigkeiten
- Offen (eigener Bereich): EN-Unterseiten (nur EN-Start existiert); `app-link.html`/`page-map.html` noch alter
  interner Stil; echte Assets (Logo-SVG, Screenshots) fehlen; scharfes Kontakt-/Beta-Formular + finale Legal/
  Privacy + finale Claims stehen aus.
- Abhängigkeiten: **Pedi** (Brand/Claims/Legal/Privacy/DNS/Publish), **Codex** (Review/Commit/Push/Jira/Browser-Tests),
  **Team 1** (echtes App-/CTA-Ziel für `app.klarwerk.ai`), **Team 3/Privacy** (Contact-Flow-Empfänger),
  **Team 6** (Story-Hoheit; `docs/TEAM6_UPDATE.md` als Nebenupdate). Server-Operator besitzt die geschützte Hetzner-Preview.

## 6. Risiken, Fallstricke & bekannte Widersprüche
- **Publish-Risiko = Hauptfallstrick:** solange Legal/Privacy/Claims/DNS offen, nichts live. Smoke Runner prüft
  Public-Seiten auf kein Scaffolding + noindex + kein `<form>`/mailto/externe Ressourcen
  (`PUBLIC_HTML_FILES`/`PUBLIC_SCAFFOLDING` in `smoke-check.mjs`).
- **Doku-Widerspruch:** UI/UX-Brief-TL;DR veraltet ggü. realem Stand nach KWEB-102.
- **Prozess-Mixup:** KWEB-91/93 mehrfach neu angefordert → verifiziert statt dupliziert (warteten auf Codex-Commit).
- **No-Go-Scan-Fallstrick:** Literale wie `sendBeacon`/`app.klarwerk.ai` lösen im Runner FAIL aus, auch als Negation
  → in KWEB-92/94 umformuliert.
- **Unsicher:** Jira-Ticketstatus nicht direkt bestätigbar (kein Jira-Zugriff, Ableitung aus Commits/Docs); echte
  Pixel-Darstellung nicht selbst gerendert (kein Browser; Pixel-Evidenz aus Codex-Läufen).

## 7. Übergabewissen + Referenzen
- Arbeitsweise/Slice: Pre-Check (`pwd`, `git status -sb`, `git remote -v`, `git log`) → Team6-Vorprüfung (read-only)
  → Umsetzung → `node site/scripts/smoke-check.mjs` = PASS → Secret-/Scope-Check → `docs/TEAM6_UPDATE.md` →
  Bericht → stopp. Nie git/commit/push/Jira/DNS/Deploy durch Claude.
- Öffentliche Seiten: `site/index.html`, `en.html`, `problem.html`, `funktion.html`, `use-cases.html`, `faq.html`,
  `kontakt.html`, `beta.html`; Designsystem `body.public-site` in `site/assets/css/styles.css` (Orange `#ED7D0E`,
  Stahl `#16222c`, IBM-Plex; Cache-Bust `?v=kweb103`).
- Interne Seiten (nicht öffentlich verlinken): review, review-run, signoff, gates, evidence, browser-evidence,
  mvp-evidence, health, page-map, server-preview.
- Leitplanken-Docs: `docs/TEAM4_CHARTER.md`, `docs/PUBLIC_WEBSITE_CLAIMS_GUARDRAILS_V0.md`,
  `docs/LEGAL_PRIVACY_PLACEHOLDERS_V0.md`, `docs/PUBLIC_WEBSITE_UI_UX_BRIEF_V0.md`.
- Jira (KWEB): KWEB-103 (UI/UX Pass 2), KWEB-102 (Pass 1), KWEB-100/101 (Preview + DE/EN), KWEB-88–98
  (Smoke/Signoff/Gate/MVP/Evidence), KWEB-71–87 (Aufbau).
- GitHub: `git@github.com:Klarwerkai/klarwerk-public-website.git`, `main`, aktuell `22af124`.
- Nächster Schritt: EN-Unterseiten nachziehen; dann Assets/Legal/Claims/Contact-Flow nach Pedi-Freigabe scharf.
