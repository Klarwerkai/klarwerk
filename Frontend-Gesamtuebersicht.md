# KLARWERK — Frontend-Gesamtübersicht (Altbestand → Neubau)

> **Zweck:** Lückenlose Inventur **aller** Funktionen, Seiten, Business-Logik, Datenmodelle und
> API-Endpunkte aus der bestehenden App + Demo + Dokumenten — als verbindliche Grundlage für den
> **kompletten Frontend-Neubau** gegen das neue Backend (`dev_Klarwerk`, Node/Fastify/Postgres).
> **Ziel: nichts geht verloren.** Bitte Abschnitt für Abschnitt prüfen, ergänzen, streichen.
>
> **Quellen dieser Inventur:**
> - `Klarwerk/app/` — die echte Software (React 18 + React-Router + Cloudflare Worker + D1/SQLite), ~10.600 Zeilen, ~30 Seiten
> - `Klarwerk/demo/` — Investor-/Pitch-Demo (zusätzliche Marketing-Seiten + „Lite"-Variante)
> - `Klarwerk/dokumente/` — Funktionsbeschreibung, Pflichtenheft, **Function-Storyboard** (Szene für Szene), Beispiele, Handbuch
> - `Klarwerk/info/` — Roadmaps, Strategie, Screen-Recordings (`klarwerk-weld-studio.mp4/gif`, `klarwerk-weld-mobile.mp4/gif`)
>
> **Legende Übernahme-Entscheidung** (von dir auszufüllen): ✅ = neu bauen · ➖ = weglassen · ❓ = klären

---

## 0. Wie wir vorgehen (Vorschlag)

1. **Diese Übersicht** prüfst du und markierst je Punkt ✅/➖/❓.
2. Daraus wird ein **Frontend-Backlog** (Stories je Bereich), passend zum Harness-Ansatz (Spec → Test → Code).
3. **Lücken-Check Backend:** Wo das neue Backend noch keine API für eine Funktion hat, ergänzen wir sie zuerst (das Backend ist bewusst API-vollständig je Modul — siehe §13 Mapping).
4. Neubau in **vertikalen Schnitten** (eine Funktion komplett: UI + API + Test), nicht „erst alle Seiten leer".

---

## 1. Rollen & Berechtigungen

| Rolle | Rechte (Kurz) |
|---|---|
| **Viewer** | Lesen, Fragen stellen (Ask), Wissen ansehen — keine Bearbeitung. |
| **Expert** (früher „Teacher") | Wissen erfassen, Entwürfe, eigene Objekte bearbeiten, beitragen. |
| **Controller** | Validieren, Konflikte lösen, zuweisen, Analytics/Risiko, Governance. |
| **Admin** | Alles + Nutzerverwaltung, Freigaben, Rollen, Passwort-Reset, Audit. |

- Legacy: Rolle `teacher` wird zu `expert` normalisiert (Laufzeit + Migration `migrate-expert.sql`).
- **Onboarding-Regel:** Erste Person einer leeren Instanz wird automatisch **Admin**. Weitere Registrierungen sind erst nach **Admin-Freigabe** nutzbar.
- **Serverseitige Rechteprüfung bei jeder Operation** (nicht nur UI-Verstecken) — NFR-SEC-03.

---

## 2. Datenmodell (Altbestand)

**Tabellen (D1/SQLite):**
- `users(id, email, name, role, pw_salt, pw_hash, created_at)` (+ `approved` im Onboarding-Flow)
- `sessions(token, user_id, expires_at)` — serverseitige Sitzungen, HttpOnly-Cookie `kw_session`
- `kos(id, title, kind, status, author_id, author_name, payload JSON, updated_at)` + Indizes auf status/kind
- `drafts(id, author_id, payload JSON, updated_at)` — Entwürfe (auch aus Mobile)
- `gaps(id, payload JSON, updated_at)` — Wissenslücken
- `audit(seq, action, ko_id, ko_title, actor, at)` — Audit-Trail
- `imports` — Quellen-Import-Kandidaten (Queue)

**Wissensobjekt (KO) — Payload-Felder** (reichhaltiges JSON, gleiche Form wie Demo):
`title, statement, conditions[], actions[], tags[], sources[], domain, kind, status,
author/author_name, conflict, history[] (Versionen), ratings[], assignments[], trust (abgeleitet),
photos[], asset (Maschinen-/Anlagenbezug), revalidate (Termin/Intervall), helped (Nutzungszähler),
comments[], second_opinion[], created_at/updated_at`.

- **5 Wissensarten (`kind`):** `intuition` · `practice` · `evolution` · `tech` · `negative` (Gegenteil/Negativwissen „was nicht funktioniert").
- **Status:** `pending` → `review` → `validated` → `rejected`.
- **Trust-Score:** abgeleitet aus Bewertungen + Konfliktstatus (`deriveTrust`).

---

## 3. API-Oberfläche (Altbestand — vollständige Liste)

> Aus `public/_worker.js` (Produktion) und `vite.config.js` (lokale Dev-API) — beide deckungsgleich.

**Auth/Session:** `GET /api/auth/status` (needsSetup) · `POST /api/auth/setup` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/register` · `GET /api/auth/me` · `GET /api/ai-status`
**Users:** `GET /api/users` · `POST /api/users` · `PUT /api/users/:id` (Rolle/Freigabe/Passwort) · `DELETE /api/users/:id`
**Wissensobjekte:** `GET /api/kos` · `POST /api/kos` · `PUT /api/kos/:id` (mit `action` fürs Audit) · `DELETE /api/kos/:id`
**Entwürfe:** `GET /api/drafts` · `POST /api/drafts` · `DELETE /api/drafts/:id`
**Lücken:** `GET /api/gaps` · `POST /api/gaps` · `DELETE /api/gaps/:id`
**Importe:** `GET /api/imports` · `POST /api/imports` · `DELETE /api/imports/:id`
**Audit:** `GET /api/audit`
**KI:** `POST /api/claude` (direkt) · `POST /api/reasoner` (Tasks: `structure`, `ask`/Suche)

---

## 4. App-Struktur & Navigation

- **Drei Shells:**
  1. **Control Room** (`/classic/*`) — Desktop-Hauptanwendung mit Sidebar.
  2. **Mobile/PWA** (`/mobile`) — installierbare schlanke App (Erfassen/Fragen/Entwürfe/Wissen).
  3. **Login** (`/login`).
- **Geführte „Missions"** als Einstiegsseiten (FocusedMissions), die jeweils in die volle Konsole führen:
  - **Capture Mission** → **Expert Studio** (volle Erfassung)
  - **Trust Mission** → **Validation Board**
  - **Proof Mission** → **Query Console**
  - **Asset Mission** → **Library**
- **Command Palette** (⌘K) — Schnellnavigation/-aktionen.
- **Sidebar** — Bereichsnavigation, rollenabhängig.

---

## 5. Funktionsbereiche (jede Funktion einzeln)

### 5.1 Authentifizierung & Onboarding
- Ersteinrichtung: erste Person → Admin (Setup-Maske bei leerer Instanz).
- Selbstregistrierung (Name, E-Mail, Passwort ≥ 8) → Status „wartet auf Freigabe" → Admin gibt frei.
- Login/Logout (serverseitige, ablaufende Sitzung; klare Abweisung bei falsch/nicht freigegeben).
- Passwort: nur Salt+Hash (hohe Iteration). Admin-Passwort-Reset (entwertet alten Login + Sitzungen).
- Self-Service-Reset per E-Mail-Link (KANN).
- SSO/OIDC (SOLL) — alternativ zum lokalen Login, inkl. Rollen-Mapping.

### 5.2 Wissenserfassung (Capture / Expert Studio)
**Vier Erfassungsmodi:**
- **Freitext** — roher Text rein, Reasoner strukturiert.
- **Strukturiertes Formular** — Aussage, Bedingungen, Aktionen, Tags, Quellen direkt.
- **Diktat** (Web Speech API; Chrome/Edge Desktop/Android; graceful no-op auf iOS) — `speech.js`.
- **Geführtes Wissens-Interview** — der Reasoner stellt Rückfragen (`interviewTurn`), bis das Objekt vollständig ist.

**Weiteres:**
- **Anhänge/Fotos** + **OCR** (`docparse.js: parseFile, ocrImage`) — Bilder werden zu Thumbnails verkleinert (klein gehalten).
- **Dokument-Parsing** — Text/Markdown direkt, PDF/DOCX clientseitig.
- **Entwürfe (Drafts)** — parken & später fortsetzen; Entwürfe auch aus der Mobile-App; Auflistung im Studio.
- **Metadaten bei Erstellung** — Domäne, Asset/Anlagenbezug, Re-Validierungstermin.

### 5.3 Strukturierung (Reasoner → Wissensobjekt)
- **3-stufiges Claude-Wiring** (`lib/claude.js`): (1) echtes Modell mit Key, (2) lokaler Worker-Reasoner, (3) deterministischer Mock — App bleibt ohne Key nutzbar.
- Funktionen: `structureKnowledge`, `selectKnowledge`, `answerQuery`, `secondOpinion`, `interviewTurn`, `assistText`, `reasonerSearch`.
- **Knowledge-Object-Editor** — strukturiertes Ergebnis prüfen/korrigieren vor dem Speichern.

### 5.4 Das Wissensobjekt (Detail / Wiki)
- **Confluence-/Wiki-artige Detailseite** je Objekt (`CaseView`, `WikiEditor`, `wikipage.js: pageFromKO`): lesen, inline editieren, Version anlegen.
- **Versionierung/History** — jede Änderung erzeugt einen Verlaufseintrag (`version`).
- Aktionen direkt am Objekt: Validieren, Beitrag hinzufügen, externe Quelle anhängen, Konflikt eskalieren, „hat geholfen" markieren, „noch gültig" bestätigen.

### 5.5 Validierung / Peer-Review (Validation Board)
- **Arbeits-Posteingang** mit Status-Filtern (pending/review/validated/rejected).
- **Bewertung & Status** — Reviewer bewertet; Status ändert sich; Trust-Score aktualisiert.
- **Zuweisung zur Validierung** (`assignValidation`) — Controller weist Objekte gezielt zu.
- **Revisions-Schleife** (`reviseKnowledge`) — Rückgabe an Autor zur Überarbeitung.
- **Kommentare** (`commentKnowledge`).

### 5.6 Konflikte (Conflicts Board)
- **Erkennung & Klassifizierung** — widersprüchliche Beiträge tauchen auf dem Board auf.
- **Second Opinion** (`addSecondOpinion`) — zweite Fachmeinung einholen.
- **Eskalation** (`escalateConflict`) und **Auflösung** (`resolveConflict`).
- **Konflikt-Seite** — beide Positionen + Quellen gegenübergestellt.

### 5.7 Abfrage (Ask / Query Interface)
- **Reasoning-Pipeline** — Frage → relevantes Wissen auswählen → Antwort mit **Belegen/Quellen**, **Konfidenz** (low/med/high), **Evidenz-Level** (`insight.js: evidenceLevel, EVIDENCE_LEGEND`).
- Antwort zeigt: Quelle(n), Konflikte/Unsicherheiten, „kein Treffer → Lücke".
- **Feedback** zur Antwort + **Lücke anlegen** (`addGap`), wenn Wissen fehlt.
- **Query Console** (volle Konsole) vs. **Proof Mission** (geführter Einstieg).

### 5.8 Wissenslücken, Risiko & Graph
- **Risk & Gaps Dashboard** (`RiskGaps`) — offene Lücken, „at-risk experts" (Wissen an Einzelpersonen).
- **Risiko-Cockpit** (`RiskCockpit`) — Risiko nach Bereich, klickbare Mini-Zeilen → Objekt-Inspektion.
- **Bus-Faktor** — Domänen mit Einzelquelle sichtbar machen.
- **Lücken-Zuweisung** (`assignGap`) + Schließen (`closeGap`).
- **Knowledge Graph** (`KnowledgeGraph`) — interaktiver Wissensgraph (auch in „Lite → Insights" eingebettet).

### 5.9 Bibliothek (Library)
- **Durchsuchbare/filterbare** Wissensbibliothek (volltext, nach kind/status/domain/tags).
- **Portabilität / Export** (`exporters.js`): **JSON**, **MediaWiki/Wiki**, **PDF**, Textdatei — „Dein Wissen gehört dir".
- **Re-Import** — Backup wieder einlesen, **merge nach id/title (keine Duplikate)**.
- **Re-Validierung aus der Library** heraus anstoßen.

### 5.10 Analytics & Audit
- **Analytics Dashboard** (`Analytics`) — Validierungsquote, Kennzahlen über Zeit.
- **Wirkungs-Dashboard** — validierte Objekte/Woche, Antwortquote ohne Lücke (FR-ANA-02).
- **Knowledge Health** (`KnowledgeHealth`) — Gesundheit/Reife der Wissensbasis.
- **Audit-Log & Lineage** (`AuditLog`/`Audit`) — jede sicherheits-/wissensrelevante Aktion, Herkunftsnachweis.

### 5.11 Wissenslebenszyklus
- **Re-Validierung/Termine** (`confirmStillValid`, `revalidate`-Feld) — Wissen „verfällt" und muss bestätigt werden.
- **„Hat geholfen"** (`markHelped`) — Nutzungs-/Wirkungssignal.
- **Autoren-Übergabe** (`reassignAuthor`) — bei Personalwechsel.
- **Lernpfade** (im Backend `lifecycle` vorhanden) — Onboarding-Reihenfolge je Rolle.

### 5.12 Mobile / PWA
- **Installierbare PWA** (Vollbild, Icon, Offline-Start, „Zum Home-Bildschirm").
- Schlanke Mobilansicht: **Aufnehmen / Fragen / Entwürfe / Wissen**.
- **Entwurf als Primäraktion** + **In-App-Bestätigung** (FR-MOB-02/03).
- Recording vorhanden: `info/klarwerk-weld-mobile.mp4`.

### 5.13 Internationalisierung (i18n)
- **Komplett DE/EN** inkl. Reasoner-Antworten/Interview; **Umschalter** (FR-I18N-01).
- `store/i18n.jsx` — leichtgewichtig (englische Strings als Keys, UI-Chrome übersetzt).

### 5.14 Strategische Erweiterungen (Import / Output / Priorisierung / Company Memory)
- **Knowledge Import / Import Engine** (`/classic/import`) — externe Quellen (JSON/Dokumente) → **Source-Review-Queue**; ein **Mensch entscheidet** (`SourceReviewQueue`), was Wissensobjekt wird → landet in Validierung. (`addImportCandidates`, `reviewImportCandidate`, `clearReviewedImports`)
- **Output Factory** (`/classic/output`) — aus validiertem Wissen Formate erzeugen (Anweisung/Checkliste/Doku) — Format wählen → generieren.
- **Instruction Builder** (`/classic/builder`) — aus geprüftem Wissen eine **Arbeitsanweisung** machen.
- **Wissens-Priorisierung** (`/classic/prioritizer`) — welche Lücken/Themen zuerst.
- **External Knowledge** (`ExternalKnowledge`, `wikipedia.js`) — externe Quelle (z. B. Wikipedia) suchen/anhängen; klar als „nicht peer-validiert" markiert.
- **Knowledge House / Company Memory** (`KnowledgeHouse`) — Gesamtspeicher als „Unternehmensgedächtnis".

### 5.15 Wert-/Kapital-Sicht (Management)
- **Overview / Control Room** (`Overview`) — operativer Snapshot, „Entscheidungssicherheit zuerst".
- **Knowledge Capital** (`KnowledgeCapital`) — Wissenskapital-Score.
- **Knowledge Valuation** (`KnowledgeValuation`) — „was Ihr Wissen wert ist — nachvollziehbar".
- **Knowledge Statement** (`KnowledgeStatement`) — Wissenskapital auf einen Blick, Kennzahlen.
- **Maturity Journey** (`MaturityJourney`) — „wie aus einer Notiz Wissenskapital wird".
- **Pilot Report** (`PilotReport`) — Pilot → Business-Case (erfasst/validiert/Wirkung).
- **Hero Assist** (`HeroAssist`) — „Ihre nächsten Schritte" (geführte Empfehlungen).

---

## 6. Business-Logik-Bibliotheken (übernehmen)

| Lib | Funktionen | Zweck |
|---|---|---|
| `claude.js` | structureKnowledge, selectKnowledge, answerQuery, secondOpinion, interviewTurn, assistText, reasonerSearch | KI-Reasoning, 3 Stufen (Key/Worker/Mock) |
| `insight.js` | evidenceLevel, EVIDENCE_LEGEND, answerFormat, riskTone, domainRisk | erklärbare Signale auf dem Trust-Score |
| `exporters.js` | exportTextFile, exportJSON, toMediaWiki, exportMediaWiki, exportPDF | Datenportabilität |
| `docparse.js` | parseFile, ocrImage | Dokument-Parsing + OCR (clientseitig) |
| `speech.js` | dictationSupported, createDictation, listVoices, pickBestVoice, speakText, isIOS | Diktat & Vorlesen |
| `wikipedia.js` | searchWikipedia | externe Quelle |
| `wikipage.js` | pageFromKO | Confluence-artige Seite aus KO |
| `help.js` | HELP_CATS, HELP_TOPICS, searchHelp | zweisprachige In-App-Hilfe + Suche |
| `toast.js` | toast | Benachrichtigungs-Bus |

**Store-Aktionen (`KnowledgeContext.jsx`, ~50)** — die komplette Business-Logik des Frontends:
addKnowledge, importKnowledge, rateKnowledge, setCategory, reassignAuthor, assignValidation,
commentKnowledge, reviseKnowledge, addContribution, attachExternal, escalateConflict, addSecondOpinion,
resolveConflict, markHelped, confirmStillValid, deleteKnowledge, saveDraft/deleteDraft,
addGap/putGap/assignGap/closeGap/deleteGap, addImportCandidates/reviewImportCandidate/clearReviewedImports/resetImportQueue,
addExternal, logAction, toggleLearned, login/logout, resetDemo/prepareDemo/setScenario, enableSync/disableSync.

---

## 7. Gemeinsame Komponenten (UI-Bausteine)
- **CommandPalette** (⌘K), **Sidebar**, **Toaster**, **Help** (In-App-Hilfe), **ui.jsx** (Design-System-Bausteine)
- **WikiEditor** / **CaseEditor** — Inline-Bearbeitung der Wissensobjekte
- **AiAssist** — KI-Assistenz-Panel, **TagField** — Tag-Eingabe, **Contrib** — Beitrags-Komponente
- **StoryMode** — geführter Erklär-/Demo-Modus

---

## 8. Beispiel-/Seed-Daten
- **~82 fertige Beispiel-Wissensobjekte** (`seedData.js`, 630 Z.) — industrielles Erfahrungswissen (Kalibrierung, Schaltschrank-Temperatur, Tempo, Diagnosen, Konflikte, Lernpfade …).
- Wert für den Neubau: als **Demo-/Schulungsdatensatz** und als **Referenz für die KO-Felder/Inhalte**.

---

## 9. Nur in der Demo (Pitch/Marketing — Übernahme optional)
- **Investor-Front-Door:** `Pitch`, `site/Site`, `boardroom/Boardroom`, `Hub`, `Highlights`, `Tomorrow`, `MarketAnalysis`, `ProcessFlow`, `flow/FlowApp`.
- **KLARWERK „Lite"** (vereinfachte Produktvariante): `LiteLayout, LiteAsk, LiteInsights, LiteKnowledge, LiteReview, LiteTeach`.
- **Charts** (Demo-spezifische Diagramme).
- **Entscheidung nötig:** Gehört etwas davon ins Produkt (z. B. „Lite"-Modus, Boardroom-Ansicht) oder ist es reines Pitch-Material?

---

## 10. Querschnitt / nicht-funktionale Anforderungen
- **Sicherheit:** serverseitige Autorisierung bei jeder Operation; KI-Schlüssel nur serverseitig, nie im Client-Bundle (FR-RSN-06, NFR-SEC-03).
- **Performance:** UI < 200 ms; Listen/Filter < 1 s bei 10.000 Objekten (NFR-PERF-01).
- **Barrierefreiheit:** WCAG 2.1 AA (Kontrast, Tastatur, Screenreader) (NFR-UX-02).
- **Responsiv** Desktop + Mobile, PWA-installierbar (NFR-UX-03).
- **Bedienbar ohne Schulung**, klare Bestätigung vor destruktiven Aktionen (NFR-UX-01).
- **Audit** für jede sicherheits-/wissensrelevante Aktion.

---

## 11. Mapping: Alt-Funktion → neues Backend (`dev_Klarwerk`)

> Das neue Backend ist je Modul **API-vollständig** (alle Tests grün). Hier die Deckung — und wo das
> Frontend nur „andocken" muss vs. wo das Backend noch erweitert wird.

| Bereich (Alt) | Neues Backend-Modul | Status |
|---|---|---|
| Auth/Onboarding/Sessions/Reset/OIDC | `auth` | ✅ vorhanden |
| Rollen/Rechte | `rbac` | ✅ vorhanden |
| Wissensobjekte + Aktionen | `knowledge-object` (+ Action-Dispatcher) | ✅ vorhanden |
| Erfassung/Entwürfe/Interview | `capture` | ✅ vorhanden |
| Strukturierung/Ask/KI | `reasoner` (+ `ask`) | ✅ vorhanden (Anthropic-Adapter) |
| Validierung | `validation` | ✅ vorhanden |
| Konflikte/Second Opinion | `conflicts` | ✅ vorhanden |
| Bibliothek/Analytics/Export(PDF) | `library-analytics` | ✅ vorhanden |
| Lebenszyklus/Re-Validierung/Lernpfade | `lifecycle` | ✅ vorhanden |
| Audit/Lineage | `audit` | ✅ vorhanden |
| i18n | `i18n` | ✅ vorhanden |
| E-Mail (Reset/Benachrichtigung) | `notifications` | ✅ vorhanden (Brevo) |
| **Lücken/Gaps** als eigene API | — | ❓ prüfen (im Alt-Backend eigene `gaps`-Endpunkte) |
| **Import-Queue/Source-Review** | — | ❓ prüfen (Alt: `imports` + Review-Queue; Backend-Modul ggf. ergänzen) |
| **Output Factory / Instruction Builder / Priorisierung** | teils `lifecycle`/`reasoner` | ❓ prüfen / ggf. neues Modul |
| **External Knowledge (Wikipedia)** | — | ❓ clientseitig + optionaler Backend-Proxy |
| **Wert-/Kapital-Sichten** (Capital/Valuation/Statement/Maturity/Pilot) | `library-analytics` (Kennzahlen) | ❓ Berechnungslogik im Backend ergänzen |

**→ Vor dem Bauen klären:** die mit ❓ markierten Punkte (Gaps-API, Import/Review, Output/Builder/Priorisierung, Wert-Kennzahlen, External-Knowledge-Proxy).

---

## 12. Offene Entscheidungen für den Neubau (bitte beantworten)

1. **Scope:** Wirklich **alle** ~30 Control-Room-Seiten + Mobile + alle Wert-/Kapital-Sichten? Oder Priorisierung in Wellen?
2. **„Lite"-Variante & Boardroom/Pitch-Seiten:** ins Produkt übernehmen oder weglassen?
3. **Design:** bestehendes Look-and-feel/`ui.jsx`-Designsystem **übernehmen** oder neu/aktualisiert?
4. **Tech-Stack Frontend:** React (wie Alt) + welches State-Mgmt (Context wie Alt, oder Redux/Zustand/TanStack-Query)? Router, Build (Vite)?
5. **KI-Anbindung:** Reasoner ausschließlich über das neue Backend (Key serverseitig) — bestätigt.
6. **Mobile:** echte separate PWA-Shell (wie Alt) beibehalten?
7. **Seed-Daten:** die ~82 Beispiele als Demo-Datensatz übernehmen?
8. **Backend-Lücken (§11 ❓):** zuerst schließen, bevor das Frontend andockt — einverstanden?

---

## 13. Vollständigkeits-Erklärung

Diese Übersicht wurde **direkt aus dem Quellcode** (echte App + Demo) plus **Funktionsbeschreibung**,
**Pflichtenheft** und **Function-Storyboard** erstellt. Erfasst sind: alle **API-Endpunkte**, das
**Datenmodell**, **alle ~30 Control-Room-Seiten**, die **Mobile/PWA**, alle **Business-Logik-Libs** und
die **~50 Store-Aktionen**, plus die nur in der Demo vorhandenen Pitch-/Lite-Teile. Screen-Recordings
(`klarwerk-weld-studio/-mobile`) bestätigen die Studio- und Mobile-Flows.

**Nächster Schritt nach deiner Prüfung:** markierte ✅-Punkte werden zu Frontend-Stories; ❓-Punkte
klären wir; ➖-Punkte entfallen. Dann bauen wir vertikal Schnitt für Schnitt.
