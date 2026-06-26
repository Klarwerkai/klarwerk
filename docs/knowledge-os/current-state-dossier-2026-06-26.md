# Klarwerk Current-State Dossier for Knowledge OS Metamorphosis

> **Status:** Reference document.  
> This document is **not** the Jira backlog.  
> This document does **not** close tickets.  
> Jira remains the backlog source of truth.

> Read-only Analyse. Kein Code geändert, kein Commit. Quelle der Befunde: Repository-Stand
> `main @ ab88340` (26.06.2026), Harness-/Spec-Dokumente, UI/UX-Handoff. Belegtypen sind je
> Aussage markiert: **FOUND IN CODE / FOUND IN DOCS / FOUND IN PROJECT DESCRIPTION /
> FOUND IN ADDITIONAL INFO / FOUND IN CODEX DIARY / FOUND IN UI/UX HANDOFF /
> FOUND ON PUBLIC WEBSITE / INFERRED / RECOMMENDED / UNKNOWN.**

**Hinweis zu fehlenden Eingaben:** Die Platzhalter `[PROJEKTBESCHREIBUNG HIER EINFÜGEN]`
(0.1) und `[WEITERE INFORMATIONEN HIER EINFÜGEN]` (0.2) wurden im Auftrag **nicht** ausgefüllt.
→ `UNKNOWN — not provided`. Als Ersatzquelle für die Produktabsicht dienen die im Repo
vorhandenen Dokumente (`README.md`, `MEILENSTEIN-FAZIT.md`, `harness/10-domain-glossary.md`,
`specs/reference/Pflichtenheft.md`, UI/UX-Handoff `UI:UX/design_handoff_klarwerk_frontend/BRIEF.md`).

**Hinweis zur benannten UI/UX-Datei:** Die im Auftrag genannte Datei
`KLARWERK_Claude_Design_UIUX_Optimierung_Prompt.md` existiert im Repo **nicht**
(`UNKNOWN — file not found`). Die inhaltlich deckungsgleiche, verbindliche UI/UX-Quelle ist
`UI:UX/design_handoff_klarwerk_frontend/BRIEF.md` (+ `Frontend-Anforderungsbeschreibung.md`).
Diese wird als „UI/UX HANDOFF" behandelt.

---

## 1. Executive Summary

**Was ist Klarwerk technisch (FOUND IN CODE):**
Ein **modularer Monolith** in TypeScript (strict): Backend = 19 Module unter `services/<modul>`
auf **Fastify 5**; Frontend = **React 18 + Vite + Tailwind + React Router 6 + TanStack Query +
react-i18next** unter `apps/web`. Ein Container liefert SPA **und** API unter einer Origin aus
(`Dockerfile`, Single-Origin). Persistenz: **In-Memory per Default**, **Postgres-Adapter**
(`repo-pg.ts`) für 8 Module, Vollobjekt als **JSONB** + indizierte Filterspalten. Qualitätstor:
`npm run check` (tsc + Biome + dependency-cruiser + Vitest), aktuell **68 Testdateien / 368 Tests
grün** (FOUND IN CODE, `docs/qm/claude-after-report.md`).

**Was ist Klarwerk produktseitig (FOUND IN DOCS / UI/UX HANDOFF):**
Eine **Enterprise Knowledge Capital Platform** für industrielles Erfahrungswissen mit
kontrolliertem Wissenskreislauf *Erfassen → Strukturieren → Validieren → Nutzen → Pflegen →
Auditieren*. Eine austauschbare **Reasoner-/KI-Schicht** hilft beim Strukturieren/Antworten,
**entscheidet aber nie über Wahrheit** (Leitplanke G-1…G-10 im BRIEF).

**Was funktioniert bereits (FOUND IN CODE):** Vollständige End-to-End-Vertikale
Erfassen → KO anlegen → bewerten/validieren → fragen/Wissenslücke, jede Aktion **auditiert über
eine append-only Hash-Kette**. Rollenbasierte Navigation, Vertrauens-/Evidenz-Komponenten,
deterministischer Reasoner-Fallback + optionaler Anthropic-Client, OIDC/PKCE (optional),
Mobile/PWA-Grundgerüst + Offline-Queue, Import-Review, Output-Factory, SVG-Graph, Kapital-Snapshot.

**Was ist unfertig / kritisch (FOUND IN CODE + ADDITIONAL INFO vom Nutzer):**
Der Nutzer berichtet, dass im Frontend „viele Funktionen kaum/gar nicht funktionell" sind und
Features der Alt-App fehlen. Belegbar dazu: Default-Persistenz ist In-Memory (kein Datenbestand
ohne `DATABASE_URL`); **keine echte semantische Suche** (Retrieval = Keyword-Überschneidung);
**keine Mandantenfähigkeit**; **Versionshistorie nur als Notiz-Liste, keine immutablen
Vorgänger-Snapshots**; mehrere Stufe-2-Sichten sind konzeptionell/dünn datenbasiert.

**Stand zu „Knowledge OS" (INFERRED aus Code):**
Klarwerk ist **bereits deutlich näher an einem Knowledge OS als an einer KI-/Chat-App**. Die
Wahrheit liegt schon heute im **Knowledge Core (KOs in der DB)**, nicht im Chatverlauf oder in
Embeddings — es gibt **weder Chat-History-als-Quelle noch eine Vector-DB**. Das LLM ist
architektonisch bereits **nur Formulierer/Selektor** mit deterministischem Fallback. Damit ist
der Kernsatz *„The AI may change. Your knowledge never does."* **strukturell zu großen Teilen
schon erfüllt** — die Lücken liegen in Mandantenfähigkeit, Versions-Immutabilität,
Quellen-/Evidence-Modellierung, Skalierung des Retrievals und einem echten Multi-Provider-Adapter.

**Was bedeutet die Metamorphose konkret (RECOMMENDED):** Nicht „neu bauen", sondern den
vorhandenen modularen Monolithen härten zu einem **Knowledge Node**: Knowledge Core formal
abgrenzen (Source/Evidence/Version/Review als eigene Entitäten), Model-Adapter-Layer öffnen
(OpenAI/Ollama), Retrieval als **ableitbare** Schicht ergänzen (Full-Text/Embeddings neu
aufbaubar), Mandantenfähigkeit + Ownership einziehen, ModelRun/AgentAction auditierbar machen.

---

## 2. Input Material Summary

### 2.1 Projektbeschreibung

`UNKNOWN — not provided` (Platzhalter im Auftrag nicht ausgefüllt). Ersatzweise die im Repo
belegte Produktabsicht (FOUND IN DOCS: `harness/10-domain-glossary.md`, `MEILENSTEIN-FAZIT.md`,
`specs/reference/Pflichtenheft.md`).

| Aussage (aus Repo-Doku als Ersatz) | Status | Beleg / Ort | Kommentar |
|---|---|---|---|
| KLARWERK = Enterprise Knowledge Capital Platform für industrielles Erfahrungswissen | CONFIRMED | `harness/10-domain-glossary.md` | Begriffsquelle |
| Zentrale Entität „KO (Wissensobjekt)" mit Status/Validierung/Bewährung | CONFIRMED | `services/knowledge-object/src/types.ts` | Reich modelliert |
| Reasoner = gekapselte, austauschbare KI-Schicht (Mock ohne Key, Claude mit Key) | PARTIALLY CONFIRMED | `services/reasoner/*` | Austauschbar am Interface; nur Anthropic-Client implementiert |
| Fünf Wissensarten | CONFIRMED | `knowledge-object/src/types.ts` (`KnowledgeType`) | bauchgefuehl/best_practice/lernkurve/technik/negativwissen |
| Re-Validierung bei Anlagenänderung | PARTIALLY CONFIRMED | `services/lifecycle/*`, `/api/lifecycle/asset-changed` | Vorhanden, aber regelarm |
| On-Premises + EU-Residenz als Treiber der Stack-Wahl | CONFIRMED | `MEILENSTEIN-FAZIT.md` §3 | Begründung gegen Cloudflare-Alt-Stack |
| Vier Rollen (Viewer/Experte/Controller/Admin), erstes Konto = Admin | CONFIRMED | `services/rbac/src/policy.ts`, `services/auth` | RBAC-Matrix vorhanden |

### 2.2 Zusätzliche Informationen

Auftrags-Platzhalter 0.2: `UNKNOWN — not provided`. **Belegbare Zusatzinformation aus dem
Chatverlauf (FOUND IN ADDITIONAL INFO):** Der Nutzer (Pedi) bewertet das aktuelle Frontend als
„viele Funktionen kaum/gar nicht funktionell, Features der Alt-App fehlen" und stuft den
aktuellen Stand als abgeschlossenen Meilenstein ein; nächster Schritt = Metamorphose Richtung
modellunabhängiges Knowledge OS.

| Zusatzinformation | Relevanz | Betroffener Bereich | Status | Kommentar |
|---|---|---|---|---|
| Frontend-Funktionen unfertig/teils tot | Hoch | Frontend, Backend-Anbindung | CONFIRMED (Nutzeraussage) + plausibel via In-Memory-Default | Milestone „Stabilize" sinnvoll vor Metamorphose |
| Features der Alt-App fehlen | Mittel | Produkt/Scope | UNKNOWN (Alt-App nicht im Repo greifbar) | Alt-App = Cloudflare/D1 (nur in Glossar referenziert) |
| Kernsatz „AI may change, knowledge never does" als Architekturprinzip | Hoch | Architektur, Datenmodell, KI | INFERRED bereits teils erfüllt | Größter strategischer Hebel |
| Lokaler In-house-KI-Node als Zielbild | Hoch | Infra, Modelladapter | RECOMMENDED | Heute keine lokale LLM-Runtime im Code |

### 2.3 Codex-Tagebuch

`UNKNOWN — no dedicated Codex diary found` (keine `CODEX.md/CODEX_LOG.md/DIARY.md/DEVLOG.md/
JOURNAL.md`). **Funktionales Äquivalent vorhanden (FOUND IN CODE/DOCS):**
`docs/qm/claude-after-report.md` (2.134 Zeilen, append-only **Claude-After-Reports**) und
`harness/90-correction-log.md` (Harness-Korrektur-Log). `AGENTS.md` bestätigt: Codex liest
`CLAUDE.md` als Systemkontext, führt aber kein eigenes Tagebuch. Die After-Reports sind das
de-facto Entwicklungstagebuch.

| Reihenfolge | Eintrag / Thema | Entscheidung | Offener Punkt | Relevanz Metamorphose |
|---|---|---|---|---|
| SCRUM-98/99/100 | Foundation, Auth/OIDC, Capture | App-Shell + echte Auth-Rolle an Nav | Onboarding 1. Admin (Task #45 offen) | Rollen-/Auth-Fundament steht |
| SCRUM-101…112 | Evidence-Audits aller Screens | UI an Modul-APIs gekoppelt | Stufe-2-Tiefe | Belegt End-to-End-Verdrahtung |
| SCRUM-121 | Objekt-/Dateispeicher | In-house Object-Store (kein S3) | Skalierung/Storage-Abstraktion | Storage-Layer existiert lokal |
| SCRUM-129/130/142 | Quellenmodell, Wissensnetz, Lineage | `KoSource` am KO; relatedKos-Heuristik | Source als eigene Entität fehlt | Evidence-Modell halbiert |
| SCRUM-132 | Reasoner-Interview-Turns | Modell formuliert, Verdichtung deterministisch | Prompt-Versionierung | KI als Worker bestätigt |
| SCRUM-117/119/120 | Output Factory, Graph, Kapital | Nur validierte KOs; Live-Daten | Tiefe der Kapital-Logik | Stufe-2 vorbereitet |
| SCRUM-88 (zuletzt) | DE/EN inkl. Reasoner-Locale | `ReasonerLocale` durch alle Schichten | Weitere Sprachen | Provider-Neutralität gestärkt |
| SCRUM-90/91/95/96 (zuletzt) | Import-Pipeline + Validity/Protection-Konzept | DOM-freie Konzept-Sichten, keine Persistenz | echte IP-Klasse, `validityUntil` persistent | Konzept sichtbar, Modell offen |

**Wichtigste Architekturentscheidungen (FOUND IN CODEX DIARY/DOCS):** modularer Monolith mit
harten Modulgrenzen (dependency-cruiser erzwingt Import nur über `index.ts`); Persistenz hinter
Repo-Interfaces (In-Memory + Postgres-Adapter); Reasoner als austauschbare Schicht; append-only
Audit-Hash-Kette; additive Felder als JSONB (keine Migrationen).
**Nicht kaputt machen:** grüner `npm run check`; Modulgrenzen; Audit-Hash-Kette; additive
JSONB-Felder ohne Migration; `statement` bleibt Plaintext-Wahrheitsquelle (kein HTML).

### 2.4 UI/UX-Anleitung (BRIEF.md)

Verbindlicher Maßstab (FOUND IN UI/UX HANDOFF). Kernpunkte:
- **Produktprinzipien G-1…G-10:** Vertrauen=Evidenz; keine erfundenen Antworten (Lücke statt
  Antwort); KI immer als Entwurf erkennbar (violett/gestrichelt/„nicht validiert"); Herkunft
  sichtbar; kein stilles Überschreiben (geführte Konflikte); Rollen bestimmen Sicht; keine
  Secrets im Client; DE/EN; Desktop+Mobile/PWA; unveränderliches Audit-Log.
- **Rollenmodell:** Viewer < Experte < Controller < Admin; Standardrolle Experte; nicht erlaubte
  Bereiche **gar nicht** anzeigen.
- **Navigation:** radikal rollenbasiert; Stufe-2-Module nur per Admin-Schalter; Sidebar-Matrix
  exakt spezifiziert.
- **Dashboard/Meine Aufgaben:** persönliche Arbeitszentrale mit „Heute zu tun", rollenabhängigem
  Primär-CTA; „Meine Aufgaben" bündelt alle Aufgabentypen mit Priorität Kritisch/Heute/Später.
- **Mobile/PWA:** Kernworkflow „Entwurf an der Anlage festhalten" (<2 min, ohne Schulung).
- **Bibliothek:** Liste als Default, kompakte Metadaten-Zeile, Filter inkl. Vertrauen,
  virtualisiert bei ≥100.000 Objekten.
- **Validierung/Konflikte/Fragen/WO-Detail/Audit/Admin:** je präzise Akzeptanzkriterien
  (A-1…A-7), Wissensobjekt-Detail als zentrales UI-Pattern.

**Umsetzungsstand im Code (FOUND IN CODE):** App-Shell, rollenbasierte Nav (`navigation.ts`),
Stufe-2-Toggle, Trust-Komponenten (`StatusPill`, `ConfidenceBar`, `KnowledgeTypeTag`,
`ProvenanceLine`, `ReasonerDraft`, `KoAuthorLine`), alle 19 Screens als Pages vorhanden. Tiefe/
Funktionalität teils dünn (Nutzeraussage 2.2). Detailbewertung in Abschnitt 9.

### 2.5 Public Website / klarwerk.ai

**FOUND ON PUBLIC WEBSITE:** `curl -fsSL https://klarwerk.ai` liefert eine clientseitig
gerenderte App-Shell. Belegbar sichtbar sind: `<html lang="de">`, `robots` = `noindex,
nofollow, noarchive, nosnippet`, PWA-Metadaten (`/manifest.webmanifest`, `/icon.svg`,
Apple-Touch-Icon, `apple-mobile-web-app-capable=yes`) und der Seitentitel
**`KLARWERK · Reasoning System`**. Der Body enthält nur `<div id="root"></div>` plus gebundelte
JS/CSS-Assets; eingeloggte Produktinhalte wurden in diesem Read-only-Pass nicht interaktiv
geprüft.

**UNKNOWN — public website could not be fully inspected beyond the HTML shell.** Es wurden keine
weiteren sichtbaren Marketing-Claims erfunden. **Belegbare Außensicht-Spannung:** Die öffentliche
HTML-Shell und das Design-Logo verwenden **„Reasoning System"**, während der neue
Kernstandpunkt **„Knowledge OS"** lautet. Empfehlung: „Reasoning System" als Schicht/Capability
rahmen, **„Knowledge OS"** als Produktkategorie führen.

---

## 3. Repository Overview

Ein einzelnes Repo (`klarwerk`), Frontend und Backend im selben Tree, Single-Origin-Deployment.
Branch `main`, letzter Commit `ab88340 feat(web): complete author visibility i18n reasoner and
ext concept views`. (FOUND IN CODE)

| Bereich | Pfad | Zweck | Relevanz für Knowledge OS |
|---|---|---|---|
| Backend (modularer Monolith) | `services/<modul>` | 19 Fastify-Module, Domänenlogik + eigene Persistenz | **Kern** — hier liegt der Knowledge Core |
| Composition-Root + Routen | `services/app/src` (`build-app.ts`, `routes/*`, `db.ts`, `server.ts`) | Verdrahtung, HTTP-API, SPA-Auslieferung, Migration | Hoch — Einstiegspunkt + DDL |
| Frontend (SPA) | `apps/web/src` | React-App: pages/components/lib/shell/api | Hoch — UI-Metamorphose |
| Tests | `tests/*` + `services/*/src/*.test.ts` | Vitest, Akzeptanz-/Unit-Tests (368) | Mittel — Sicherheitsnetz |
| Specs (WAS) | `specs/` (`reference/Pflichtenheft.md`, `stories/*`) | Anforderungen, 14 Modul-Stories | Hoch — Produktquelle |
| Harness (WIE) | `harness/00…90` | Architektur-/Coding-/Test-/Security-Regeln + Correction-Log | Hoch — Leitplanken |
| UI/UX-Handoff | `UI:UX/design_handoff_klarwerk_frontend/` | BRIEF.md, Anforderungsbeschreibung, 27 Screenshots, `.dc.html` | Hoch — UI-Maßstab |
| QM / Diary | `docs/qm/claude-after-report.md` | After-Reports (de-facto Tagebuch) | Mittel — Entscheidungs-Historie |
| Betrieb/Infra | `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile`, `.env.example`, `docs/operations/*` | Postgres+n8n (dev), App+Postgres (prod), Deploy-Doku | Hoch — Knowledge-Node-Vorbereitung |
| Agentenregeln | `CLAUDE.md`, `AGENTS.md`, `agents/*` | Agent-Regelwerk (aus `/harness`) | Mittel — Agent-Layer-Governance |
| Blueprint | `Blueprint/` | Harness-Methodik-Doku | Niedrig |
| Workflows | `workflows/`, n8n | Orchestrierung (extern) | Niedrig (heute) |

**Wichtige Konfigs:** `package.json` (root, Backend-Scripts), `apps/web/package.json`,
`.dependency-cruiser.cjs`, `biome.json`, `tsconfig.json`, `vitest.config.ts` (+
`vitest.integration.config.ts`). **Aufräum-Hinweis (FOUND IN CODE):** ~70 verwaiste
`vitest.config.ts.timestamp-*.mjs` im Root → harmloser Müll, sollte ignoriert/gelöscht werden.

---

## 4. Tech Stack

### Frontend (FOUND IN CODE — `apps/web/package.json`)
- **Framework/Sprache:** React 18.3 + TypeScript 5.6, Vite 5.4.
- **Routing:** react-router-dom 6.27 (Routen aus zentraler `navigation.ts` abgeleitet).
- **Styling:** Tailwind 3.4 (+ PostCSS/autoprefixer), Design-Tokens aus BRIEF; Fonts
  `@fontsource/ibm-plex-sans` + `-mono`.
- **State:** TanStack Query 5 (Server-State, `api/hooks.ts`) + React-Context (`AuthContext`,
  `RoleContext`, `ToastContext`); kein Redux.
- **Forms:** handgerollt (keine Form-Lib).
- **Auth-Anbindung:** Session-Cookie via `api/client.ts` + `api/auth.ts`; OIDC-Callback-Helfer.
- **API-Client:** dünner Fetch-Wrapper (`api/client.ts`), Endpunkt-Registry (`api/endpoints.ts`),
  geteilte Typen (`api/types.ts`).
- **Wichtige Libs:** lucide-react (Icons), i18next/react-i18next (DE/EN), **pdfjs-dist**
  (PDF-Textextraktion), **tesseract.js** (Bild-OCR), **mammoth** (DOCX) — alles clientseitig.
- **PWA/Mobile:** `public/manifest.webmanifest`, `public/sw.js`, Service-Worker-Registrierung in
  `src/main.tsx` nur in Production, Offline-Queue (`lib/offlineQueue.ts`, `app/useOfflineQueue.ts`),
  Mobile-Seite (`pages/Mobile.tsx`). Kein Workbox/Framework — handgeschriebener SW.
- **Design-System:** eigene Komponentenschicht (`components/ui.tsx`, `components/trust/*`).

### Backend (FOUND IN CODE — root `package.json`, `services/*`)
- **Framework/Sprache:** Fastify 5 + TypeScript (strict, ES2022, `exactOptionalPropertyTypes`).
- **API-Stil:** REST (`/api/...`), pro Modul ein Routen-Plugin (`services/app/src/routes/*`).
- **Auth:** eigenes `auth`-Modul (Session-Cookie; Pflichtenheft nennt PBKDF2-SHA256); **OIDC
  Authorization-Code + PKCE (S256)** optional (`jose`), env-gesteuert.
- **DB:** Postgres (`pg`), **optional** — ohne `DATABASE_URL` läuft alles In-Memory.
- **ORM:** keiner. Roh-SQL in `repo-pg.ts`; **Vollobjekt als JSONB** + indizierte Filterspalten;
  DDL als `*_SCHEMA`-Strings, ausgeführt in `services/app/src/db.ts#migrate`.
- **Background Jobs/Queue/Event-System:** keines im Code (n8n nur in `docker-compose.yml` für
  Dev). `INFERRED`: synchron, request-gebunden.
- **File Storage:** internes `object-store`-Modul (Base64/Daten-URL, In-Memory/JSONB, **kein S3**),
  `MAX_OBJECT_BYTES = 5 MB`.
- **LLM Provider:** `reasoner`-Modul; `ModelClient` = **Anthropic Messages API**
  (`anthropicClient`), env `ANTHROPIC_API_KEY` / `REASONER_MODEL` (Default `claude-sonnet-4-6`).
- **Embedding Provider / Vector DB:** **keine** (Retrieval = Keyword-Überschneidung).
- **Logging:** Fastify-Default; **Audit** = eigenes Modul mit append-only **Hash-Kette**
  (`audit/src/chain.ts`, `verifyChain`).
- **E-Mail:** `notifications`-Modul, SMTP-agnostisch (`nodemailer`), optional.
- **Externe Suche:** `external-search` (Wikipedia/MediaWiki-Proxy, kein Key), optional.
- **Tests:** Vitest (+ Testcontainers für Postgres-Integration).
- **Security-Mid:** `@fastify/helmet`; SPA via `@fastify/static`.

### Infrastruktur (FOUND IN CODE — Dockerfiles, `.env.example`)
- **Docker:** Multi-Stage `Dockerfile` (Stage 1 baut SPA, Stage 2 Node 22-alpine liefert
  SPA+API), Healthcheck `/health`. `docker-compose.prod.yml` = App + Postgres 16-alpine
  (Volume `pgdata`). `docker-compose.yml` (dev) = Postgres + n8n.
- **Lokale Entwicklung:** `npm install`, `docker compose up -d`, `./tools/check`.
- **Deployment-Ziel:** Single-Origin-Container (Coolify/Traefik); `app.klarwerk.ai`
  (FOUND IN DOCS `docs/operations/deploy-hetzner.md`, `.env.example`).
- **Ports:** App `3000`, Postgres `5432`, n8n `5678`.
- **Env-Variablen (Namen, keine Werte):** `PORT`, `APP_BASE_URL`, `COOKIE_SECURE`,
  `DATABASE_URL`, `ANTHROPIC_API_KEY`, `REASONER_MODEL`, `SMTP_*`, `OIDC_*`, `EXTERNAL_SEARCH*`.
  Keine Secrets im Repo gefunden (`.env.example` enthält nur Platzhalter/leere Werte).
- **Lokale KI / On-Prem:** Stack ist bewusst On-Prem-/EU-tauglich (Node/Fastify/Postgres,
  kein Cloud-Lock-in außer optionalem Anthropic-Key). **Lokale LLM-Runtime fehlt** (kein Ollama).

---

## 5. Current Product Model

(FOUND IN CODE, sofern nicht anders markiert)

| Konzept | Existiert? | Code-Ort | Aktuelle Bedeutung | Knowledge-OS-Lücke |
|---|---|---|---|---|
| Organisation/Workspace/Mandant | **Nein** | — | App ist single-tenant | **P0**: keine Mandantenfähigkeit |
| Benutzer | Ja | `services/auth` | Konto + Rolle + Status (Freigabe) | ok; Owner-Bezug fehlt am KO |
| Rollen | Ja | `auth`/`rbac` (`policy.ts`) | viewer/experte/controller/admin, Matrix mit 6 Permissions | grob; keine Objekt-Rechte |
| Projekte | Nein | — | — | optional |
| Dokumente/Quelldateien | Teilweise | `object-store`, `KoAttachment` | Anhänge am KO, Original im Object-Store | Source/SourceFile nicht erstklassig |
| Chats | **Nein** | — | Es gibt keinen Chatverlauf als Speicher | **Stärke** für Knowledge-OS |
| Wissenseinheiten (KO) | Ja | `knowledge-object` | Zentrale, reiche Entität | ok |
| Quellen | Teilweise | `KoSource` (eingebettet), `external-search` | Externe Quelle als Feld am KO | Evidence/Source als eigene Entität fehlt |
| Experten/Owner | Teilweise | `author`/`originalAuthor` am KO | Autor + Originalautor | kein expliziter „Owner/Steward" |
| Freigaben/Validierung | Ja | `validation` | Bewertung (✓/~/✗), Schwellen, Status | Review nicht als eigene Entität |
| Versionierung | Teilweise | `version` + `history[]` | Zähler + Notiz-Timeline | **P1**: keine immutablen Vorgänger-Snapshots |
| Audit Logs | Ja | `audit` (Hash-Kette) | append-only, verifizierbar | ModelRun/AgentAction fehlen |
| KI-generierte Inhalte | Ja | `reasoner` (`demo`-Flag, Draft) | als Vorschlag markiert, nie als Wahrheit | ok (Prinzip erfüllt) |
| Manuelle Validierung | Ja | `validation` | Peer-Bewertung + Schwelle | ok |
| Statusmodell | Teilweise | `KoStatus`="offen\|validiert" + FE-`displayStatus` | binär im Backend, 7 Anzeige-Zustände im FE | **P1**: dünner als UI suggeriert |
| Wissenslücken | Ja | `ask`/`gaps` | Frage ohne Grundlage → Gap | ok |
| Konflikte | Ja | `conflicts` | Konfliktarten, Eskalation, Auflösung | ok |
| Revalidierung | Teilweise | `lifecycle` (`/lifecycle/pending`, `asset-changed`) | berechnete Fälligkeit | RevalidationRule als Entität fehlt |
| Lebenszyklus-Logik | Teilweise | `lifecycle` + FE-`extConcept` (Freshness) | abgeleitete Sicht | LifecycleEvent/State nicht persistiert |

---

## 6. Data Model / Database Analysis

**Persistenzmuster (FOUND IN CODE):** Jedes persistente Modul hat `repo.ts` (Interface +
In-Memory) und `repo-pg.ts` (Postgres). Postgres speichert das **Vollobjekt als JSONB** plus
wenige indizierte Filterspalten; DDL als `*_SCHEMA`-String, zentral in
`services/app/src/db.ts#migrate` ausgeführt. **Kein ORM, keine Migrationsversionierung** →
additive Felder brauchen keine Migration, aber es gibt auch **keine Schema-Evolutionshistorie**.
Persistente Module mit `repo-pg.ts`: `auth, knowledge-object, audit, capture, ask, validation,
conflicts, lifecycle`. **Nicht in `migrate()` (nur In-Memory zur Laufzeit):** `object-store`,
`library-analytics`, `management`, `output`, `external-search`, `notifications`, `structure`,
`i18n`, `rbac` (`UNKNOWN`, ob bewusst flüchtig).

Zentrale Entitäten:

- **KnowledgeObject** (`knowledge-object/src/types.ts`) — Kern. Felder u. a. `id, title,
  statement, bodyHtml?, conditions[], measures[], type(5), category, tags[], confidence, trust,
  status(offen|validiert), version, originalAuthor, author, neededValidations, assignments[],
  asset, createdAt, history[], comments[], attachments[], sources[]`. Schreibt: `KoService`
  (create/revise/validate/attach/...). Liest: ask/validation/conflicts/library/output/management.
  Versionierung: `version` + `history[]` (Notizen), **kein** Vorgänger-Snapshot. Ownership:
  `author`/`originalAuthor`. Status/Freigabe: ja. Quellenbezug: eingebettetes `KoSource[]`.
  Audit: extern. Mandantenfähig: **nein**. Persistenz: `kos(id,type,status,category,data jsonb)`.
- **KoSource** (eingebettet) — externe Quelle (`label,url,excerpt,kind="external",peerValidated,
  provider?`). Nicht erstklassig/verlinkbar; keine Datei-Bindung.
- **KoAttachment / ObjectRef / StoredObject** (`object-store`) — Anhänge; Original als Base64 im
  Object-Store, KO trägt Referenz + Thumbnail. Kein S3.
- **Draft (Capture)** — Entwurf inkl. `bodyHtml?`, geräteübergreifend fortsetzbar.
- **Gap (ask)** — Wissenslücke (`question,status,assignee,priority,createdAt`).
- **Conflict (conflicts)** — `koA,koB,type,status(offen/eskaliert/zweitmeinung/geloest),
  secondOpinion,decision`.
- **ValidationTask/Feedback (validation)** — Bewertungen, Schwellen, Rückgabe an Autor.
- **AuditEntry (audit)** — `seq,at,actor,action,target,payload,prevHash,hash`. **Append-only
  Hash-Kette**, `verifyChain`. Stärkstes Knowledge-OS-Asset.
- **User/Session (auth)** — Konto, Rolle, Freigabestatus; OIDC optional.
- **ImportCandidate (library-analytics)** — `item,status,duplicate,note,koId`.

**Knowledge-OS-Soll-Entitäten — Abgleich:**

| Soll-Entität | Status im Code |
|---|---|
| Organization / Workspace | **not implemented** |
| User / Role / Permission | implemented (Role global; Permission als Enum, nicht objektgebunden) |
| Source / SourceFile | partial (`KoSource` eingebettet; `object-store` für Bytes) — **nicht erstklassig** |
| Document / Chunk | partial (Capture-Rohtext/Attachment) / **Chunk not implemented** |
| Embedding | **not implemented** |
| KnowledgeObject | implemented (reich) |
| Claim / Decision / Process / Entity / Relationship | **not implemented** (KO monolithisch; „Relationship" nur via `koLineage`-Heuristik + Conflict-Kanten) |
| Evidence | partial (Trust-Zähler + `KoSource`; keine `Evidence`-Entität) |
| Review | partial (Validation-Bewertung; keine `Review`-Entität) |
| Version | partial (`version`+`history`; keine immutablen Snapshots) |
| AuditEvent | implemented (Hash-Kette) |
| ModelRun / RecallTrace / AgentAction | **not implemented** |
| KnowledgeGap | implemented (`Gap`) |
| Conflict | implemented |
| Task | partial (FE aggregiert `MyTasks` aus mehreren Quellen; keine `Task`-Entität) |
| LifecycleEvent / RevalidationRule | partial (berechnet; nicht persistiert als Regel/Event) |
| Notification | implemented (`notifications` + Feed) |

---

## 7. Backend API Analysis

Routen unter `services/app/src/routes/*`, registriert in `build-app.ts`; jede Route prüft
`guards.requirePermission(...)`. Auswahl (FOUND IN CODE; Permissions aus `rbac/policy.ts`):

| Method | Path | Purpose | Reads | Writes | Auth | Role Check | Knowledge-OS-Relevanz |
|---|---|---|---|---|---|---|---|
| GET | `/api/kos` (+filter) | KO-Liste | kos | – | ja | ko.read | Kern (Library/Retrieval-Basis) |
| GET | `/api/kos/:id` | KO-Detail | kos | – | ja | ko.read | Kern |
| POST | `/api/kos` | KO anlegen | – | kos, audit | ja | ko.create | Kern (Write-back nur als „offen") |
| PUT | `/api/kos/:id` | Aktions-Dispatcher (rate/assign/revise/comment/attach/detach/category/tags/conflict/resolve-conflict/transfer-author/add-source/remove-source/revalidate) | kos | kos, audit, conflicts | ja | je Aktion | Kern (Validierung/Konflikt/Quelle) |
| POST | `/api/ask` | Frage beantworten | kos | gaps, audit | ja | ko.read | Kern; `locale` (DE/EN); Lücke statt Halluzination |
| POST | `/api/ask/helpful` | „Hat geholfen" | kos | kos(trust), audit | ja | ko.read | Bewährung durch Nutzung |
| GET/PUT/DELETE | `/api/gaps[/:id]` | Wissenslücken | gaps | gaps, audit | ja | ko.read/assign/validate | Lücken-Workflow |
| POST | `/api/reasoner` | structure\|ask\|assist\|interview | kos | (ask schreibt gaps) | ja | ko.read | **Model Adapter Einstieg**; `locale` |
| GET | `/api/reasoner/status` | echte Modell-Verfügbarkeit | – | – | ja | ko.read | Provider-Status (U-8) |
| GET | `/api/validation/board` `/overview` | Validierungsqueue | kos | – | ja | ko.read/validate | Review-Workflow |
| GET | `/api/conflicts` (+detail/escalate/second-opinion) | Konflikte | conflicts/kos | conflicts, audit | ja | conflict.resolve | Konfliktklärung |
| GET/POST | `/api/objects` `/objects/:id` `/objects/:id/raw` | Objekt-Store | objects | objects | ja | ko.read | Source-Bytes (Bild-Endpoint) |
| GET/PUT | `/api/library/search` `/import/candidates` | Suche + Import-Review | kos/candidates | candidates→kos | ja | ko.read/validate | Retrieval (SQL/Mem) + Import |
| GET | `/api/analytics` `/busfactor` `/impact` | Kennzahlen | kos/audit | – | ja | ko.read | Analytics |
| GET | `/api/audit` | Audit-Log | audit | – | ja | (rollenabhängig) | Governance |
| GET/POST | `/api/lifecycle/pending` `/asset-changed` | Revalidierung | kos | – | ja | ko.read | Lebenszyklus |
| GET | `/api/management/snapshot` | Kapital-Snapshot | kos/gaps/conflicts | – | ja | ko.read | Stufe-2 |
| GET/POST | `/api/output/sources` `/generate` | Output Factory | kos(validiert) | – | ja | ko.read | Stufe-2; nur validierte Quellen |
| GET | `/api/external/search` | externe Quellensuche | (Wikipedia) | – | ja | ko.read | kein Auto-Anhängen |
| GET | `/api/i18n/locales` · `/api/notifications` · `/api/health` | i18n/Feed/Health | – | – | teils | – | Betrieb |

**Antworten auf die geforderten Prüf-Fragen:** APIs für **Knowledge Objects** (ja),
**Sources/Evidence** (teilweise — `add-source`/`remove-source` am KO, externe Suche; keine eigene
Source-API), **Drafts** (ja, `/api/drafts`), **Review/Freigabe** (ja, über `/api/kos/:id`
rate/assign + `/validation/*`), **Audit** (ja, read-only), **Model Runs** (**nein**),
**Aufgaben** (**keine eigene API** — FE aggregiert), **Wissenslücken** (ja), **Konflikte** (ja),
**Revalidierung** (teilweise, lifecycle).

---

## 8. Frontend Analysis

Routen aus `apps/web/src/app/navigation.ts`, gerendert über `routes.tsx` mit `Guarded`
(Rollen-Gate, Deep-Link → `/start`). Alle Seiten existieren als Komponenten. (FOUND IN CODE)

| Route / Page | Zweck | Zielrolle | Stufe | Knowledge-OS-Konzepte sichtbar | Empfehlung |
|---|---|---|---|---|---|
| `/start` `Start.tsx` | Arbeitszentrale | alle | 1 | rollen-CTA, „Heute" | behalten, schärfen (9.2) |
| `/aufgaben` `MyTasks.tsx` | Aufgabenbündel | ab Experte | 1 | Validierung/Konflikt/Lücke/Revalidierung + Autorzeile | behalten, Filter/Priorität ausbauen |
| `/erfassen` `Capture.tsx` | Expert Studio (Freitext/Formular/Diktat/Interview, OCR/PDF/DOCX, RichText) | ab Experte | 1 | Reasoner-Entwurf (violett), bodyHtml | behalten (Kern) |
| `/fragen` `Ask.tsx` | Query Console | alle | 1 | Antwort mit Quellen/Evidenz/Trust **oder Lücke** | behalten; „nicht wie Chatbot" sichern (9.8) |
| `/bibliothek` `Library.tsx` | Suche/Liste + Filter + Export + Autorzeile | alle | 1 | Status/Art/Trust/Autor/Validity | behalten; Virtualisierung+Semantik fehlen |
| `/wissen/:id` `KnowledgeDetail.tsx` | **WO-Detail (zentrales Pattern)** | alle | 1 | Status, Trust, Herkunft, Version-Historie, Lineage, Quellen, „Gültigkeit & Schutz", rollen-Aktionen | behalten (Leitpattern) |
| `/validierung` `Validation.tsx` | Validation Board | ab Controller | 1 | ✓/~/✗, Feedback, Ziel x/3, Autorzeile | behalten; Stapel-Aktion prüfen |
| `/konflikte` `Conflicts.tsx` | Conflict Board | ab Controller | 1 | A/B-Gegenüberstellung, Eskalation | behalten |
| `/risiko` `Risk.tsx` | Bus-Faktor/Lücken | ab Controller | 1 | Domänen-Risiko, Gaps | behalten |
| `/lebenszyklus` `Lifecycle.tsx` | Pflege/Revalidierung | ab Controller | 1 | „Stimmt das noch?", Autorenübergabe | behalten |
| `/analytics` `Analytics.tsx` | Analytics & Audit | Admin | 1 | KPIs, Audit-Log | behalten |
| `/admin` `Admin.tsx` | Nutzerverwaltung | Admin | 1 | Rollen, Freigabe, Selbstschutz | behalten |
| `/output` `Stufe2.Output` | Output Factory | Admin+Schalter | 2 | nur validierte Quellen, Provenance | behalten, nicht dominant |
| `/import` `Stufe2.ImportReview` | Source-Review + Pipeline | Admin+Schalter | 2 | Pipeline upload→reuse, Befunde | behalten |
| `/graph` `Stufe2.GraphView` | Wissensgraph (SVG) | Admin+Schalter | 2 | Knoten/Kanten, Konfliktkanten | behalten |
| `/kapital` `Stufe2.Capital` | Kapital-Sichten | Admin+Schalter | 2 | Score/Statement/Reife | behalten, Datenbasis härten |
| `/mobile` `Mobile.tsx` | PWA-Kern | alle | 1 | Schnellerfassung, Ask, Offline-Queue, Inline-Confirm | behalten (Kernworkflow) |
| `/hilfe` `/profil` `/ui-kit` | Hilfe/Profil/Designsystem | – | 1 | – | behalten |

**Prüf-Fragen:** Chat-Interface = **nein** (vertrauensbasierter Fragebereich, gut so);
Dokumenten-Upload = ja (Capture, clientseitige Extraktion); mobile Erfassung = ja; Reasoner-
Entwürfe = ja (violett, `ReasonerDraft`); Quellen-/Beleganzeige = ja (Ask-Steps, KoSource);
Review-/Freigabe-UI = ja; Dashboard/„Meine Aufgaben" = ja; Org/Admin = ja (single-tenant);
WO-Darstellung = ja; Versionen = ja (Historie); Audit-Hinweise = ja; **Modell-/Provider-Auswahl
im UI = nein** (nur Status); Rollennavigation = ja; Stufe-2 zu prominent = **nein** (per Schalter
versteckt). Funktionstiefe teils dünn (Nutzeraussage 2.2; In-Memory-Default).

---

## 9. UI/UX Metamorphosis Analysis

Maßstab = BRIEF.md. (Bewertung: FOUND IN CODE vs. UI/UX HANDOFF)

### 9.1 Navigation
Rollenbasiert **umgesetzt** (`navigation.ts` + `canSee`, `routes.tsx` Guarded, Stufe-2-Toggle).
Entspricht der Sidebar-Matrix gut. Empfehlung je Rolle:

| Rolle | Aktuell sichtbar | Sollte sichtbar sein | Ausblenden/Verschieben | Kommentar |
|---|---|---|---|---|
| Viewer | Start, Fragen, Bibliothek, Hilfe, Profil | identisch | – | konform |
| Experte (Default) | + Aufgaben, Erfassen | identisch | – | konform |
| Controller | + Validierung, Konflikte, Risiko, Lebenszyklus | identisch | – | konform |
| Admin | + Analytics, Admin (+ Stufe-2 via Schalter) | identisch | Stufe-2 default aus | konform |

Risiko: `RoleContext` erlaubt **lokalen Rollen-Umschalter**, wenn keine Session existiert
(Preview/Dev). In Produktion mit Session greift die echte Rolle. → für Demo ok, aber **nie** als
Sicherheitsersatz behandeln (Server-RBAC bleibt maßgeblich; ist gegeben).

### 9.2 Dashboard/Start
`Start.tsx` hat rollen-CTA + „Heute". **RECOMMENDED:** Priorität (Kritisch/Heute/Später)
konsistent mit `MyTasks` machen; rollenabhängige KPIs aus echten Daten statt In-Memory-Demo.

### 9.3 Meine Aufgaben
`MyTasks.tsx` bündelt Rückgaben/Konflikte/Validierungen/Revalidierung/Lücken + Autorzeile.
**Lücke:** Filter (Typ/Priorität/Domäne) und Stapel-Aktion für Prüfer noch nicht voll
ausgeprägt; keine `Task`-Entität (Aggregation im Client).

### 9.4 Mobile/PWA
Kernworkflow umgesetzt: Schnellerfassung, Ask, Offline-Queue/Sync, Inline-Bestätigung (SCRUM-87).
**Lücke/UNKNOWN:** Kamera/QR/Asset-Auswahl nur teilweise; Service Worker ist im Code vorhanden
und wird in Production registriert, aber ein echter Browser-/Installationslauf wurde in diesem
Read-only-Pass nicht ausgeführt.

### 9.5 Bibliothek/Suche
Liste-Default, Filter (Art/Status/Domäne/Tags), Export, Autorzeile, Re-Validierung vorhanden.
**Lücken (P1):** keine Virtualisierung für ≥100.000; **keine semantische Suche** (nur
Keyword/SQL); „Vertrauen" als Filter teilweise.

### 9.6 Validierung
Queue + ✓/~/✗ + Feedback + Schwelle x/3 vorhanden. **Prüfen:** Stapel-Bestätigung/Zuweisung
gemäß BRIEF §7.6 (teilweise).

### 9.7 Konflikte
Conflict Board mit Klassifikation + A/B + Eskalation vorhanden; „kein stilles Überschreiben"
durch Konflikt-Mechanik abgesichert (Lineage + resolve-conflict).

### 9.8 Fragen
`Ask.tsx` liefert Antwort **mit Quellen/Evidenzlevel/Trust oder Lücke** (nicht chatbot-artig).
Konform zu G-2/A-3. **RECOMMENDED:** CTAs „Quelle öffnen / Konflikt melden / Lücke ergänzen"
prominenter.

### 9.9 Wissensobjekt-Detail
Zentrales Pattern umgesetzt: Status/Trust/Art/Aussage/Bedingungen/Maßnahmen/Quelle/Autor/
Version/Historie/Lineage + neue „Gültigkeit & Schutz"-Karte; Aktionen rollenabhängig. Stark.

### 9.10 Audit/Admin
Audit read-only, Hash-Kette unveränderbar; Admin mit Selbstschutz. **Lücke:** abgestufte
Audit-Sichten (Nutzer=Historie / Owner=Light / Admin=voll) nur teilweise differenziert.

---

## 10. AI / LLM / Agent Integration Analysis

(FOUND IN CODE — `services/reasoner/*`)
- **Aufrufort:** ausschließlich im `reasoner`-Modul, serverseitig. FE ruft `/api/reasoner` +
  `/api/ask`. Kein LLM-Call im Client (G-7 erfüllt; Key bleibt server).
- **Provider:** `ModelClient` mit **einer** Implementierung `anthropicClient` (Anthropic
  Messages API). Auswahl env-gesteuert; ohne Key → `DeterministicProvider`.
- **Abstraktion:** **ja** — `ReasonerProvider`-Interface + `ModelClient`-Interface +
  `Reasoner`-Service (primary/fallback). Adapter-Muster vorhanden, aber **nur Anthropic**.
- **Prompts:** **inline** in `provider-model.ts` (locale-aware Funktionen `structureSystem/
  answerSystem/assistSystem/interviewSystem`), **nicht** als versionierte Dateien, **nicht**
  persistiert.
- **Tool Calls / Agenten / RAG / Embeddings / Memory / Recall:** **keine**. „Retrieval" =
  `keywordSelect` (Token-Überschneidung) über KOs.
- **Write-back-Prüfung:** KI-Output wird **als Vorschlag** behandelt: `structure`/`interview`
  liefern Entwürfe (Capture), neue KOs entstehen über den normalen Create-Pfad als **„offen"**
  (Review-pflichtig). `answer` formuliert nur über vorhandene Quellen; ohne Treffer → keine
  Antwort/Lücke. → **G-2/G-3 erfüllt: KI ist nie Source of Truth.**
- **Quellenbindung:** Antwort-Steps tragen `sourceId`/`snippet` aus echten KOs; `demo`-Flag
  markiert deterministischen Fallback.
- **Traces:** **nur** ein Audit-Eintrag `ask.query` (`answered`-Flag + erste Quelle). **Kein**
  provider-unabhängiges `ModelRun`-Objekt, **keine** Prompt-Versionierung, **keine**
  `AgentAction`-Logs.

**Bewertung gegen die Knowledge-OS-Regel:** **Weitgehend erfüllt.** Die Wahrheit liegt im
Knowledge Core; das LLM ist Interpreter/Worker. **Verletzungen/Lücken:** fehlende
ModelRun-/AgentAction-Persistenz (Nachvollziehbarkeit von Modellläufen), fehlende
Prompt-Versionierung, nur ein Provider-Adapter.

---

## 11. Storage / Index / Retrieval Analysis

(FOUND IN CODE)
- **Originaldateien:** `object-store` (Base64/Daten-URL, In-Memory/JSONB; **kein S3**).
- **Extrahierte Texte:** clientseitig (pdfjs/tesseract/mammoth) → fließen in Capture-Rohtext/KO;
  **nicht** als eigene `Document/Chunk`-Entität gespeichert.
- **Chunks/Embeddings/Vektor-Index:** **existieren nicht.**
- **Full-Text Search:** `/api/library/search` filtert über KO-Felder (SQL/In-Memory), keine
  echte FTS-Engine.
- **Graph:** `/api/graph` + FE-`graphLayout` erzeugen einen Graph **aus den KOs/Konflikten zur
  Laufzeit** (kein persistenter Graphspeicher).

**Bewertung nach „Index ist ableitbar":**
- Vector DB gelöscht → **kein Wissensverlust** (es gibt keine).
- Embeddings neu erzeugt → n/a.
- Chatverlauf gelöscht → **kein Wissensverlust** (es gibt keinen als Quelle).
- Modell gewechselt → **kein Wissensverlust** (Antworten werden live aus KOs berechnet).
→ **Sehr starke Knowledge-OS-Eigenschaft.** Klare Trennung Raw Sources (object-store) /
Canonical Knowledge (KOs) / Index (keiner) ist gegeben — **weil** noch kein Index existiert.
**Kehrseite (P1):** ohne semantisches Retrieval/FTS skaliert „Fragen/Bibliothek" nicht auf große
Bestände (BRIEF A-7 / ≥100.000). Source/Evidence-Links sind nur als eingebettetes `KoSource`
vorhanden, nicht als auflösbare Entität.

---

## 12. Auth, Roles, Permissions, Governance

(FOUND IN CODE)
- **Login:** ja (`auth`); Session-Cookie; **OIDC/PKCE** optional (env). Registrierung →
  „wartet auf Freigabe" bis Admin freischaltet; erstes Konto leerer Instanz = Admin.
- **Rollen:** viewer/experte/controller/admin (`auth`), Rang-Modell.
- **Permissions:** `rbac/policy.ts` — 6 Permissions (`ko.read/create/validate/assign,
  conflict.resolve, users.manage`), pro Route geprüft. **Objekt-/dokumentgebundene Rechte:
  nein** (nur globale Rollenrechte).
- **Organisation/Mandant:** **nein.**
- **Knowledge Owner:** implizit via `author`; **keine** Steward-Rolle.
- **Audit:** append-only Hash-Kette, `verifyChain`.
- **Freigaben/Ownership:** Validierungs-/Freigabeprozess ja; Autorenübergabe (`transfer-author`,
  nur Admin).
- **Datenlöschung/Export:** Export ja (JSON/Markdown/PDF in Library/Output); Lösch-/DSGVO-Pfade
  `UNKNOWN`/teilweise.
- **Rollenbasierte Navigation + Aktionen:** ja (FE + Server).
- **Enterprise-Fähigkeit:** Auth/RBAC/Audit solide; **fehlt für Enterprise:** Mandantenfähigkeit,
  Objekt-Rechte, SCIM/Provisioning-Tiefe, Lösch-/Retention-/Export-Governance.

---

## 13. Current Gaps Toward Knowledge OS

### Product Gaps
- **P0** Keine Mandantenfähigkeit/Organisation → ein Knowledge Node pro Kunde nur als getrennte
  Instanz. Betroffen: gesamtes Datenmodell, auth.
- **P1** Statusmodell binär (offen/validiert) vs. 7 Anzeige-Zustände → Lebenszyklus dünn.
- **P2** „Features der Alt-App fehlen" — Scope unklar (`UNKNOWN`, Alt-App nicht vorliegend).

### Frontend Gaps
- **P1** Funktionstiefe/echte Daten (In-Memory-Default) → viele Sichten wirken „leer/tot".
- **P1** Bibliothek ohne Virtualisierung/semantische Suche (A-7).
- **P2** „Meine Aufgaben"-Filter/Stapelaktionen unvollständig.

### Backend Gaps
- **P1** Keine `Task`/`Review`/`Source`/`Evidence`-Entitäten (in KO eingebettet/aggregiert).
- **P1** Mehrere Module nur In-Memory (`object-store, management, output, library-analytics, …`)
  → nicht persistent/migriert.
- **P2** Keine Background-Jobs/Events (synchron).

### Data Model Gaps
- **P0** Source/SourceFile/Evidence/Version-Snapshots/ModelRun/AgentAction nicht erstklassig.
- **P1** Versionshistorie ohne immutable Vorgänger → Verlustrisiko bei Revision.

### AI/Agent Gaps
- **P1** Nur Anthropic-Adapter (kein OpenAI/Ollama). 
- **P1** Keine ModelRun-/AgentAction-Persistenz, keine Prompt-Versionierung.
- **P2** Keine Agent-Schreibregeln formalisiert (heute: alle Writes über RBAC-Routen).

### Security/Governance Gaps
- **P1** Objekt-/dokumentgebundene Rechte fehlen.
- **P2** Retention/Lösch-/Export-Governance unvollständig.

### Infrastructure Gaps
- **P1** Keine lokale LLM-Runtime/Embedding-Runtime (On-Prem-KI-Node).
- **P1** Storage nur In-Memory/JSONB (kein Objektspeicher-Backend, kein Backup-Konzept im Code).
- **P2** Repo-Müll (`vitest.config.ts.timestamp-*`).

### UI/UX Gaps
- **P1** Virtualisierung, abgestufte Audit-Sichten, vollständige Stapelaktionen.
- **P2** Provider-/Modell-Transparenz im UI (nur Status, keine Auswahl/Trace).

### Local In-house AI Node Gaps
- **P0/P1** Keine `compose`-Profile für lokale Modelle/Embeddings/Objektspeicher; keine
  Backup-/Export-Import-Automatik; Hardware-Annahmen nicht im Code.

---

## 14. What Should Not Be Broken

| Existing element | Why it matters | Risk if changed | Recommended handling |
|---|---|---|---|
| `npm run check` (tsc+Biome+depcruise+Vitest) grün | Definition of Done, einziges Freigabetor | Regressionen unbemerkt | Immer grün halten; neue Tests additiv |
| Modulgrenzen (Import nur via `index.ts`, depcruise) | Architektur-Integrität | Schleichende Kopplung | Neue Layer als eigene Module mit `index.ts` |
| Audit-Hash-Kette (`audit/chain.ts`) | Unveränderlichkeit/Compliance | Vertrauensverlust, kaputte Kette | Nur additiv erweitern, nie umschreiben |
| Reasoner Fallback-Prinzip (deterministisch, `demo`-Flag) | „KI nie Source of Truth" | Halluzination als Wahrheit | Adapter ergänzen, Prinzip beibehalten |
| KO-`statement` = Plaintext-Wahrheitsquelle (HTML additiv in `bodyHtml`) | Such-/Output-/Ask-Konsistenz | Datenverlust/XSS | Sanitizer + Plaintext beibehalten |
| Rollen-/Permission-Matrix (`rbac/policy.ts`) + Server-Guards | Sicherheit, A-5 | Rechtelecks | Erweitern, nicht ersetzen |
| Additive JSONB-Felder ohne Migration | Schnelle, migrationsfreie Evolution | Schema-Brüche | Weiterhin additiv; bei Bedarf echte Migrationen einführen |
| Trust-/Evidenz-Komponenten (`components/trust/*`) | G-1…G-4 visuell | Vertrauenssignale verlieren | Wiederverwenden |
| After-Report-Konvention (`docs/qm/claude-after-report.md`) | Nachvollziehbarkeit/Diary | Wissensverlust über Entscheidungen | Fortführen (append-only) |
| Single-Origin-Build/Deploy (`Dockerfile`) | Betrieb/On-Prem | Deploy-Bruch | Beibehalten; lokale Profile ergänzen |

---

## 15. Recommended Knowledge OS Architecture for This Codebase

(RECOMMENDED — passend zum bestehenden modularen Monolithen; Namen an vorhandene Konvention
`services/<modul>` angelehnt.)

- **Bleiben:** `auth`, `rbac`, `audit`, `knowledge-object`, `validation`, `conflicts`, `ask`,
  `lifecycle`, `capture`, `notifications`, `reasoner` (Interface), `object-store`,
  `library-analytics`, `output`, `management`, `external-search`, `i18n`, `structure`.
- **Erweitern:**
  - `knowledge-object` → **Knowledge Core**-Kern; `version` zu **immutablen Snapshots**
    (`ko_versions`) ausbauen; Owner/Steward-Feld.
  - `reasoner` → **Model Adapter Layer** öffnen (siehe unten); Prompts versioniert.
  - `audit` → `ModelRun`/`AgentAction` als auditierte Ereignistypen.
  - `library-analytics` → **Retrieval Layer** (FTS-Index, optional Embedding-Adapter), strikt
    **ableitbar** aus dem Core.
- **Neu (eigene Module mit `index.ts`):**
  - `services/sources` — Source/SourceFile/Evidence als erstklassige, verlinkbare Entitäten.
  - `services/model-adapters` — `ModelClient`-Implementierungen (anthropic, openai, ollama) +
    Registry + `ModelRun`-Persistenz.
  - `services/retrieval` — FTS + optional Embeddings; **rebuild-fähig** aus Core.
  - `services/tasks` — `Task`-Entität (heute FE-Aggregation).
  - `services/tenancy` — Organization/Workspace + Mandanten-Scoping (P0, invasiv → eigener
    Meilenstein).
  - `services/agent-gateway` — Schreibregeln für Agenten (Draft-only, Review-Pflicht, Audit).
- **Verortung der Layer:** Knowledge Core = `knowledge-object` + `sources` + `audit`;
  Model Layer = `model-adapters` (+ `reasoner` als Orchestrator); Agent Layer =
  `agent-gateway`; Retrieval = `retrieval`; Audit/Versionierung = `audit` + `ko_versions`;
  Task/Workflow = `tasks` + `validation`/`conflicts`/`lifecycle`; UI-Rollenlogik =
  `apps/web/src/app/navigation.ts` (+ Server-RBAC).
- **UI-Ergänzungen:** Provider-/ModelRun-Transparenz, Source/Evidence-Detailsicht,
  Versions-Diff, Bibliotheks-Virtualisierung.

**Zielstruktur (Vorschlag, additiv):**
```
services/
  knowledge-object/   (Core: KO + ko_versions)
  sources/            (Source, SourceFile, Evidence)   [neu]
  reasoner/           (Orchestrator)
  model-adapters/     (anthropic|openai|ollama + ModelRun) [neu]
  retrieval/          (FTS + optional embeddings, rebuildbar) [neu]
  tasks/              (Task)                            [neu]
  conflicts/ gaps(ask)/ validation/ lifecycle/
  audit/              (+ ModelRun/AgentAction events)
  tenancy/            (Organization/Workspace)          [neu, P0-Meilenstein]
  agent-gateway/      (Agent-Schreibregeln)             [neu]
  admin/ object-store/ output/ management/ external-search/ notifications/ i18n/
```

---

## 16. Proposed Domain Model for Knowledge OS

(RECOMMENDED; „existiert?" = FOUND IN CODE)

| Entity | Zweck | Wichtigste Felder | Beziehungen | Existiert? | Priorität | FE | BE | KO-OS |
|---|---|---|---|---|---|---|---|---|
| Organization | Mandant | id,name,plan | hat Workspaces/User | neu | P0 | mittel | hoch | hoch |
| Workspace | Bereich/Anlage | id,orgId,name | scoping KO | neu | P1 | mittel | hoch | hoch |
| User | Konto | id,name,email,role,status | Org/Workspace | ja | – | hoch | hoch | hoch |
| Role/Permission | Rechte | role, permission[] | User; objektgebunden? | teilweise | P1 | mittel | hoch | hoch |
| Source | Quelle (erstklassig) | id,label,url,kind,provider | hat SourceFiles; ↔ KO | teilweise (embedded) | P0 | hoch | hoch | hoch |
| SourceFile | Originaldatei | id,sourceId,objectRef,mime | Source; object-store | teilweise | P1 | mittel | hoch | hoch |
| Document/Chunk | Extrakt/Segment | text, offset | SourceFile | nein | P2 | niedrig | mittel | mittel |
| KnowledgeObject | Wissenskern | (s. §6) | Sources,Versions,Reviews,Conflicts | ja | – | hoch | hoch | hoch |
| Claim/Decision/Process | feinere Wissenstypen | – | Teil von KO | nein | P2 | mittel | mittel | mittel |
| Entity/Relationship | Wissensgraph-Kanten | from,to,type | KO↔KO | teilweise (Heuristik) | P2 | mittel | mittel | hoch |
| Evidence | Beleg | id,koId,sourceId,quote | KO↔Source | teilweise | P1 | hoch | hoch | hoch |
| Review | Validierungsakt | id,koId,reviewer,verdict | KO,User | teilweise | P1 | hoch | hoch | hoch |
| Version | immutabler Snapshot | id,koId,version,snapshot,at | KO | teilweise | P1 | mittel | hoch | hoch |
| AuditEvent | Audit | seq,actor,action,hash | alles | ja | – | mittel | hoch | hoch |
| ModelRun | Modelllauf | id,provider,prompt,version,inputRef,outputRef,at | KO/Answer | nein | P1 | mittel | hoch | hoch |
| RecallTrace | Retrieval-Spur | query,selectedKoIds | Answer | nein | P2 | niedrig | mittel | mittel |
| AgentAction | Agent-Aktion | agent,action,target,decision | Audit | nein | P1 | niedrig | hoch | hoch |
| KnowledgeGap | Lücke | id,question,status,priority | Ask | ja | – | hoch | hoch | hoch |
| Conflict | Widerspruch | koA,koB,type,status | KO | ja | – | hoch | hoch | hoch |
| Task | Aufgabe | id,type,refId,assignee,priority | viele | nein (FE-Aggregat) | P1 | hoch | hoch | mittel |
| LifecycleEvent | Pflege-Ereignis | id,koId,kind,at | KO | nein | P2 | mittel | mittel | mittel |
| RevalidationRule | Regel | trigger,interval,assetRef | KO/Asset | nein | P2 | niedrig | mittel | mittel |
| Notification | Hinweis | id,user,kind,read | User | ja | – | mittel | mittel | niedrig |

---

## 17. Model Independence / Model Swap Readiness

(FOUND IN CODE + INFERRED)
- **Providerabhängige Stellen:** nur `services/reasoner/src/model-client.ts` (Anthropic) +
  `provider-model.ts` (Prompts). Sonst **nichts** providergebunden.
- **Providerabhängige Prompts:** Systemprompts inline, generisch formuliert; nicht
  Anthropic-spezifisch außer Aufrufformat im Client.
- **Providerabhängige Daten/Memories:** **keine** — keine Embeddings, keine Chat-History als
  Quelle. KOs/Audit sind provider-neutral.
- **Neutrale Persistenz:** ja (Postgres/In-Memory JSONB).
- **Adapter:** `ModelClient`/`ReasonerProvider` vorhanden; nur eine Implementierung.
- **Für echten Swap nötig:** zusätzliche `ModelClient`-Implementierungen (OpenAI, Ollama) +
  Registry/Env-Auswahl; optional `ModelRun`-Persistenz für Trace-Erhalt.
- **Für lokale In-house-Modelle nötig:** Ollama-`ModelClient` (HTTP an lokale Runtime),
  Env `REASONER_PROVIDER=ollama|openai|anthropic`, optional lokale Embedding-Runtime (erst mit
  Retrieval-Layer relevant).

**Model Swap Test (Bewertung):**
1. Antwort mit Modell A → ✅ möglich (mit Key) / deterministisch ohne Key.
2. Modell A deaktivieren → ✅ (Key entfernen → Fallback).
3. Modell B aktivieren → ⚠️ **nur** wenn B = Anthropic-Modell (kein OpenAI/Ollama-Adapter).
4. Gleiches KO gefunden → ✅ (Retrieval modellunabhängig, `keywordSelect`).
5. Gleiche Quellen → ✅ (Quellen kommen aus KOs, nicht aus dem Modell).
6. Audit Trail erhalten → ⚠️ teilweise (`ask.query`-Eintrag, aber kein `ModelRun`).
7. Kein Wissensverlust → ✅ (Core unberührt).

**Gesamt: TEILWEISE BESTANDEN.** Persistenz-/Wissensseite **bestanden** (großer Vorsprung);
Adapter-/Trace-Seite **offen** (nur ein Provider, keine ModelRun-Spur).

---

## 18. Local In-house AI Node Preparation

(RECOMMENDED; FOUND IN CODE: Stack ist On-Prem-tauglich, aber lokale KI fehlt.)
- **Lokale Services:** App-Container (vorhanden), Postgres (vorhanden), **Ollama** (LLM-Runtime,
  neu), optional **Embedding-Runtime** (neu, erst mit Retrieval), Objektspeicher (heute
  In-Memory → MinIO/Volume empfohlen).
- **DB:** Postgres 16 (vorhanden); optional `pgvector` **nur** wenn Embedding-Retrieval kommt.
- **Vector DB:** keine nötig zum Start; bei Bedarf `pgvector` (im selben Postgres → einfach).
- **Object Storage:** heute In-Memory/JSONB; für Node → Volume oder MinIO hinter
  `object-store`-Interface.
- **LLM/Embedding Runtime:** Ollama-Container; `ModelClient`-Adapter.
- **Ports/Services:** App 3000, Postgres 5432, (Ollama 11434), (MinIO 9000/9001).
- **Compose:** `docker-compose.prod.yml` um optionales Profil `local-ai` (ollama/minio)
  erweitern.
- **Admin/Monitoring:** Reasoner-Status-Endpoint vorhanden; Healthcheck vorhanden;
  Monitoring/Backup-Dashboards fehlen.
- **Backup:** Postgres-Dump (Doku erwähnt tägliche Backups in Coolify) → für Node als Cron +
  Volume-Snapshot formalisieren.
- **Export/Import:** Library-Export (JSON/MD/PDF) vorhanden; **vollständiger Core-Export/Import
  (Sources+KO+Versions+Audit)** als Knowledge-Node-Portabilität fehlt → empfohlen.
- **Hardware-Annahmen:** keine im Code sichtbar (`UNKNOWN`).
- **Cloud-Abhängigkeiten zu abstrahieren:** nur optionaler Anthropic-Key (via Adapter ersetzbar),
  optionaler SMTP/OIDC-Anbieter.

**Zielbild „Klarwerk Knowledge Node":** ein dedizierter Rechner mit App + Postgres (+ optional
Ollama/MinIO/pgvector), der Knowledge Core, Retrieval, lokale Modelle, Adapter, Audit und Admin
für **ein** Unternehmen bereitstellt — vollständig EU-/On-Prem, ohne Cloud-Zwang.

---

## 19. Suggested Task Backlog

(Tasks formuliert, **keine** Implementierung. Tool-Empfehlung: Claude Code = UI/Refactor/Tests;
Codex = Backend-Module/Datenmodell; beide = größere vertikale Schnitte.)

### Milestone 1: Stabilize Current App
- **M1-T1 Echte Persistenz als Default-Pfad dokumentieren/absichern.** Ziel: keine „leeren"
  Sichten durch In-Memory. Dateien: `services/app/src/db.ts`, fehlende `repo-pg.ts`
  (object-store/management/output/library-analytics). Ergebnis: alle Kern-Reads aus Postgres.
  AK: Seed + Smoke zeigt Daten in allen Hauptscreens. Risiko: mittel. Tool: Codex. Stufe 1.
- **M1-T2 Frontend-„tote" Funktionen inventarisieren.** Ziel: Liste real funktionierender vs.
  Platzhalter-Flows (Nutzeraussage 2.2). Dateien: `apps/web/src/pages/*`. Ergebnis: Audit-Tabelle.
  AK: jede Route mit Status funktional/teilweise/Platzhalter. Risiko: niedrig. Tool: Claude Code.
- **M1-T3 Repo-Hygiene.** `vitest.config.ts.timestamp-*` entfernen (gitignore). Risiko: niedrig.

### Milestone 2: Knowledge OS Metamorphosis Foundation
- **M2-T1 Positionierung „Knowledge OS" vs. „Reasoning System" zusammenführen** (Logo/Untertitel,
  i18n-Copy). Dateien: `BRIEF`-Abstimmung, `apps/web/src/shell/Logo.tsx`, `i18n.ts`. Tool: Claude
  Code. Stufe 1.
- **M2-T2 Knowledge-Core-Grenze formal dokumentieren** (welche Module = Core, Invarianten,
  Export/Import-Vertrag). Dateien: `harness/20-system-architecture.md`. Tool: beide.

### Milestone 3: UI/UX Role-Based App Shell
- **M3-T1 Bibliotheks-Virtualisierung + „Vertrauen"-Filter** (A-7). Dateien: `pages/Library.tsx`.
  Tool: Claude Code. Stufe 1.
- **M3-T2 „Meine Aufgaben": Filter + Stapelaktion.** Dateien: `pages/MyTasks.tsx`,
  `pages/Validation.tsx`. Tool: Claude Code.
- **M3-T3 Abgestufte Audit-Sichten** (Nutzer/Owner/Admin). Dateien: `pages/Analytics.tsx`,
  `routes/audit-routes.ts`. Tool: beide.

### Milestone 4: Knowledge Core Data Model
- **M4-T1 `sources`-Modul** (Source/SourceFile/Evidence erstklassig, KoSource migrieren).
  Tool: Codex. Stufe später (invasiv).
- **M4-T2 Immutable `ko_versions`** (Snapshot bei Revise). Dateien: `knowledge-object/*`.
  Tool: Codex.

### Milestone 5: Source / Evidence / Versioning
- **M5-T1 Evidence-Links in Ask/Validation** (Antwort/Bewertung referenziert Evidence-Entität).
  Tool: beide.
- **M5-T2 Versions-Diff-UI.** Dateien: `pages/KnowledgeDetail.tsx`. Tool: Claude Code.

### Milestone 6: Tasks, Validation, Conflicts, Gaps
- **M6-T1 `tasks`-Modul** (heute FE-Aggregat → Backend-Entität). Tool: Codex.
- **M6-T2 RevalidationRule/LifecycleEvent persistieren.** Tool: Codex.

### Milestone 7: Model Adapter Layer
- **M7-T1 `model-adapters`-Modul + Registry** (`anthropic|openai|ollama`), Env-Auswahl. Dateien:
  `services/reasoner/*` → ausgliedern. Tool: Codex. Stufe 2.
- **M7-T2 `ModelRun`-Persistenz + Prompt-Versionierung.** Tool: Codex.

### Milestone 8: Agent Rules and Write-back Review
- **M8-T1 `agent-gateway`** (Draft-only, Review-Pflicht, Audit für Agent-Writes). Tool: Codex.
- **M8-T2 AgentAction-Log + UI-Transparenz.** Tool: beide.

### Milestone 9: Local In-house AI Node Preparation
- **M9-T1 Ollama-Adapter + compose-Profil `local-ai`.** Tool: Codex.
- **M9-T2 Objektspeicher-Backend (Volume/MinIO) hinter `object-store`.** Tool: Codex.
- **M9-T3 Core-Export/Import (Node-Portabilität).** Tool: beide.
- **M9-T4 Optional Retrieval-Layer (FTS, dann pgvector).** Tool: Codex. Stufe später.

---

## 20. Questions for the Human / ChatGPT

**Produkt**
- Soll Klarwerk **multi-tenant** (mehrere Organisationen in einer Instanz) oder **ein Node pro
  Kunde** sein? (entscheidet P0 Tenancy)
- Welche konkreten Alt-App-Features gelten als „fehlend/pflicht"? (Scope von Milestone 1)

**Architektur**
- Knowledge Core als Teil des Monolithen belassen oder perspektivisch herauslösen?
- Export/Import-Format des Knowledge Core (Node-Portabilität) — JSON-Bundle? Standard?

**Datenmodell**
- KO atomar lassen oder in Claim/Decision/Process zerlegen?
- Versions-Retention: jede Revision als Snapshot oder nur bei „validiert"?

**UI/UX**
- „Reasoning System" vs. „Knowledge OS": welche Marke nach außen, welche im Produkt?
- Virtualisierungs-Zielgröße real (10k? 100k? 1M)?

**KI/LLM**
- Welche Provider initial (OpenAI? lokale Ollama-Modelle?) und welches Default-Modell on-prem?
- Müssen Modellläufe revisionssicher (ModelRun) gespeichert werden (Compliance)?

**Agenten**
- Dürfen Agenten KOs als Draft anlegen (Review-Pflicht) — bestätigt? Welche Tools über
  `agent-gateway`?

**Infrastruktur**
- Zielhardware des Knowledge Node (GPU? RAM?) für lokale Modelle?
- Backup-/DR-Anforderungen (RPO/RTO)?

**Security**
- Objekt-/dokumentgebundene Rechte nötig (z. B. Domänen-Sichtbarkeit)?
- Retention/Lösch-/DSGVO-Pflichten?

**Lokale In-house-KI**
- Embedding-/semantische Suche jetzt schon vorbereiten oder bewusst aufschieben?

**Demo / Investor**
- Welche Story zuerst zeigbar sein muss (Model-Swap-Demo? Audit-Integrität? On-Prem-Node?) —
  steuert die Milestone-Reihenfolge.

---

## 21. Final Assessment

- **Bereit für die Metamorphose?** **Ja, mit gezielter Vorarbeit.** Das Fundament (Core in DB,
  Audit-Hash-Kette, austauschbarer Reasoner mit deterministischem Fallback, klare Modulgrenzen,
  grünes Qualitätstor) ist überdurchschnittlich gut für den Knowledge-OS-Weg.
- **Größte Stärke:** Die Wahrheit liegt bereits **modellunabhängig im Knowledge Core**; kein
  Chatverlauf/Vector-DB als Quelle → *„AI may change, knowledge never does"* ist strukturell
  großteils erfüllt; Audit ist unveränderlich.
- **Größte Schwäche:** **Keine Mandantenfähigkeit**, **dünne/teils In-Memory-Datenbasis** und
  **kein erstklassiges Source/Evidence/Version-Modell** → Wissensobjekt ist reich, aber der
  „Apparat drumherum" (Herkunft als Entität, Versions-Immutabilität) fehlt.
- **Größter UI/UX-Konflikt:** Anspruch (BRIEF: 100k-Skalierung, volle Aufgaben-/Audit-Tiefe) vs.
  reale Funktionstiefe (In-Memory-Default, „tote" Flows) + Marken-Spannung „Reasoning System"
  ↔ „Knowledge OS".
- **Größter Architekturkonflikt:** Retrieval als **fehlende** (statt ableitbare) Schicht — heute
  reicht Keyword-Überschneidung nicht für Skalierung; gleichzeitig ist genau dieses Fehlen der
  Grund für die starke Wissens-Persistenz. Auflösung: Retrieval **additiv** und **rebuild-fähig**
  ergänzen, ohne es zur Wahrheitsquelle zu machen.
- **Vor dem nächsten Meilenstein klären:** Multi-Tenant ja/nein; Provider-Set & On-Prem-Default;
  Versions-Retention; konkreter Alt-App-Scope; Marke.
- **Claude Code als Nächstes:** Frontend-Funktionsinventar (M1-T2), Positionierung/Copy (M2-T1),
  Bibliotheks-Virtualisierung + Aufgaben-Filter (M3).
- **Codex als Nächstes:** Persistenz-Default härten (M1-T1), `sources`/`ko_versions` entwerfen
  (M4), `model-adapters`-Ausgliederung vorbereiten (M7-T1).
- **Nicht parallel verändern:** Audit-Hash-Kette, Modulgrenzen/`index.ts`-Regel, Reasoner-
  Fallback-Prinzip und das Qualitätstor — diese gleichzeitig anzufassen würde das Sicherheitsnetz
  destabilisieren.

**In einem Satz ist Klarwerk aktuell** ein getesteter, regelkonformer modularer Monolith mit
reichem, modell- und index-unabhängigem Wissenskern und vollständiger, aber teils dünn
funktionierender Knowledge-Workflow-UI — also **näher an einem frühen Knowledge OS als an einer
KI-/Chat-App**.

**Der nächste sinnvolle Schritt ist** den Knowledge Core formal abzugrenzen und zu härten
(Persistenz-Default, Source/Evidence/Version als Entitäten) und parallel den Model-Adapter-Layer
für einen echten Provider-Swap zu öffnen — bevor neue Features gebaut werden.

---

## 22. Compact Context for ChatGPT

# Compact Context for ChatGPT

**Projektbeschreibung (Ersatz, da Auftrags-Platzhalter leer):** Klarwerk = Enterprise Knowledge
Capital Platform für **industrielles Erfahrungswissen**; kontrollierter Kreislauf Erfassen →
Strukturieren → Validieren → Nutzen → Pflegen → Auditieren. Neuer Kernstandpunkt: **„Knowledge
OS — The AI may change. Your knowledge never does."** Das LLM ist nur Interpreter/Worker; Wahrheit
liegt im Knowledge Core.

**Zusatzinfos:** Auftrags-Platzhalter 0.2 leer. Belegt: Nutzer bewertet Frontend als teils
„kaum/gar nicht funktionell, Alt-App-Features fehlen"; aktueller Stand = abgeschlossener
Meilenstein; nächster Schritt = Metamorphose Richtung modellunabhängiges Knowledge OS + späterer
lokaler In-house-KI-Node. Die im Auftrag genannte UI/UX-Datei existiert nicht; verbindlich ist
`UI:UX/.../BRIEF.md`. Website klarwerk.ai: HTML-Shell ist lesbar mit Titel
**„KLARWERK · Reasoning System"**, Noindex-Robots und PWA-Metadaten; eingeloggter Produktinhalt
wurde nicht interaktiv geprüft. Spannung: öffentlicher Titel/Logo-Untertitel „REASONING SYSTEM"
vs. neue Primärpositionierung „Knowledge OS".

**Diary:** Kein dediziertes Codex-Tagebuch; de-facto Diary = `docs/qm/claude-after-report.md`
(append-only After-Reports, 2.134 Zeilen) + `harness/90-correction-log.md`. Wichtige
Entscheidungen: modularer Monolith mit harten Modulgrenzen; Persistenz hinter Repo-Interfaces
(In-Memory + Postgres-JSONB, keine Migrationsversionierung); Reasoner austauschbar mit
deterministischem Fallback; Audit-Hash-Kette; additive JSONB-Felder. Nicht kaputt machen:
grünes `npm run check`, Modulgrenzen, Audit-Kette, `statement`=Plaintext-Wahrheit.

**Tech Stack:** Backend Node 20+/TypeScript strict, **Fastify 5**, 19 Module `services/<modul>`,
Postgres optional (`pg`, JSONB, kein ORM), Audit-Hash-Kette, `@fastify/helmet/static`, `jose`
(OIDC PKCE), `nodemailer`. Frontend React 18 + Vite + Tailwind + React Router 6 + TanStack Query
+ react-i18next, lucide, clientseitig pdfjs/tesseract/mammoth. Single-Origin Docker (Backend
liefert SPA). Tests Vitest (368 grün). Ports 3000/5432/5678.

**Frontend-Stand:** Rollenbasierte Nav (`navigation.ts`, Stufe-2-Toggle), alle 19 Screens als
Pages vorhanden, Trust-/Evidenz-Komponenten, WO-Detail als zentrales Pattern, Mobile/PWA +
Offline-Queue, DE/EN inkl. Reasoner-Locale. Funktionstiefe teils dünn (In-Memory-Default).
Lücken: Virtualisierung (≥100k), semantische Suche, abgestufte Audit-Sichten, Aufgaben-Filter/
Stapelaktionen.

**Backend-Stand:** REST `/api/...` pro Modul, RBAC-Guards (6 Permissions, 4 Rollen, erstes Konto
= Admin), OIDC optional. Kern-APIs: KOs (+Aktions-Dispatcher rate/validate/conflict/source/…),
ask (Antwort mit Quellen oder Lücke), reasoner (structure/ask/assist/interview, locale),
validation/conflicts/lifecycle/library/output/management/external/objects/audit. Keine
ModelRun-/Task-/Source-API als eigene Entität.

**Datenmodell:** Zentral `KnowledgeObject` (reich: status offen|validiert, version+history,
trust/confidence, author/originalAuthor, comments, attachments, embedded `KoSource`). Vorhanden:
Gap, Conflict, AuditEntry (Hash-Kette), Draft, ImportCandidate, ObjectRef. **Fehlt erstklassig:**
Organization/Workspace (keine Mandantenfähigkeit), Source/SourceFile/Evidence, immutable Version-
Snapshots, Claim/Decision/Process/Entity/Relationship, ModelRun/RecallTrace/AgentAction, Task,
RevalidationRule/LifecycleEvent, Chunk/Embedding.

**KI/LLM:** Nur im `reasoner`-Modul, serverseitig. Adapter-Interfaces `ReasonerProvider` +
`ModelClient`; einzige Implementierung **Anthropic Messages API**; ohne Key deterministischer
Fallback. Prompts inline (nicht versioniert/persistiert). **Kein** Embedding/Vector/RAG/Agent/
Memory. Retrieval = Keyword-Überschneidung über KOs. KI-Output = Vorschlag (`demo`-Flag, Draft),
nie Source of Truth. Audit nur `ask.query`-Eintrag, kein ModelRun-Trace.

**UI/UX-Vorgaben (BRIEF):** G-1…G-10 (Vertrauen=Evidenz, keine Halluzination, KI immer als
Entwurf erkennbar/violett, Herkunft sichtbar, kein stilles Überschreiben, rollenbasiert, keine
Client-Secrets, DE/EN, Desktop+Mobile, unveränderliches Audit). Standardrolle Experte; Stufe-2
nur per Admin-Schalter; A-1…A-7 Akzeptanzkriterien (mobil <2min, Prüfer-Effizienz, Antwort mit
Quellen/Vertrauen oder ehrliche Lücke, Trust/Status/Herkunft ohne Klick, Rollensicht, kein
stiller Datenverlust, Skalierung).

**Größte Knowledge-OS-Lücken:** (P0) Mandantenfähigkeit; Source/Evidence/Version-Entitäten.
(P1) ModelRun/AgentAction-Trace; Multi-Provider-Adapter (OpenAI/Ollama); echte Persistenz-Default;
Retrieval-Skalierung; Task/Review als Entität. (Infra) lokale LLM-Runtime, Objektspeicher-Backend,
Core-Export/Import.

**Wichtigste Risiken:** In-Memory-Default lässt Sichten „leer" wirken; JSONB-Overwrite ohne
Versions-Snapshots = Verlustrisiko bei Revise; nur ein LLM-Provider; Skalierung der Suche;
Marken-/Positionierungs-Spannung.

**Empfohlene nächste Tasks:** M1 Stabilisieren (Persistenz-Default, Funktionsinventar), M2
Positionierung + Core-Grenze, M3 UI (Virtualisierung, Aufgaben), M4/5 Source/Evidence/Version,
M7 Model-Adapter + ModelRun, M9 lokaler KI-Node (Ollama/MinIO/Export-Import). Tool: Claude Code
für UI/Refactor/Tests, Codex für Backend-Module/Datenmodell.

**Offene Fragen (Top):** Multi-Tenant ja/nein? Provider-Set & On-Prem-Default-Modell?
Versions-Retention-Strategie? Konkreter Alt-App-Scope? Marke „Reasoning System" vs. „Knowledge
OS"? Embedding-Suche jetzt vorbereiten?

**Einschätzung Metamorphose:** Klarwerk ist architektonisch **gut vorbereitet** — Core ist schon
modell-/index-unabhängig, Audit unveränderlich, Reasoner austauschbar. Die Metamorphose ist
primär **Härten + Ergänzen** (Tenancy, Source/Evidence/Version, Model-Adapter, Retrieval als
ableitbare Schicht), **nicht** Neubau. Zuerst Core härten und Provider-Swap öffnen, dann Features.

---

*Ende des Dossiers. Read-only erstellt; keine Code-Änderung, kein Commit. Alle Empfehlungen sind
als Tasks markiert (Abschnitt 19) und nicht umgesetzt.*
