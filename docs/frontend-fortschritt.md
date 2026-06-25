# KLARWERK — Frontend-Fortschritt (Funktionsparität zur Vorgänger-App)

> Laufendes Protokoll der Frontend-Arbeit. Bezug: `Frontend-Funktions-Checkliste.md`.
> Verifikation je Änderung: `tsc --noEmit` (web + root), Biome `check`, dependency-cruiser.
> `vitest` läuft nur auf dem Mac (native Binaries) → finaler Gate-Lauf: `npm run check`.

## Stand 25.06.2026 — Session „Funktionsparität"

### Behobene Bugs
- **Logout** (FE-AUTH-04): `signOut` beendet die Server-Session, leert den Query-Cache **und** lädt hart auf `/` neu. Ursache war, dass React Query nach dem 401 die alten `/auth/me`-Daten behielt. Sidebar-Icon **und** Profil-Button wirken.
- **Tote Topbar-Controls**: globale Suche → `/bibliothek?q=…` (Library liest den Param), „Mobil"-Button → `/mobile`, Hilfe-Icon → `/hilfe`, Benachrichtigungen klickbar (Konflikt → `/konflikte`, Lücke → `/risiko`).
- **Forgot-Endpoint** (Backend, FR-AUTH-08): Mailfehler werden geschluckt → Antwort immer 204 (kein Existenz-Leak). Behebt das nach außen sichtbare „Missing credentials for PLAIN".
- Sidebar zeigt echten angemeldeten Nutzer statt Platzhalter „M. Brandt".

### Neu gebaut (vorher Stub/fehlend)
- **FE-CAP-01..04, FE-CAP-08, FE-RSN-01/02 — Capture/Expert Studio: alle 4 Modi.**
  - Freitext (Reasoner-`structure`), **Formular** (Direkteingabe), **Diktat** (Web Speech API, Chrome/Edge, mit Fallback-Hinweis), **Geführtes Interview** (Fragesequenz baut das Objekt).
  - Erweiterter Entwurfs-Editor: Bedingungen/Maßnahmen (Listen), Tags, **Asset/Anlage**, **Re-Validierung** — wird beim Anlegen mitgesendet.
- **FE-KO-03/04/06 — Wissensobjekt-Detail.**
  - **Inline-Bearbeitung** (Titel/Aussage/Typ/Bedingungen/Maßnahmen/Tags/Kategorie) via `revise` (+ `tags`/`category`). Versionierung & Trust-Reset serverseitig.
  - Validierungsaktionen vollständig: Validieren / Bedingt / Ablehnen (Controller/Admin) + „Noch gültig".
  - **Konflikt aus dem Objekt melden** (`conflict`-Aktion): Ziel-Objekt wählen, Typ, Beschreibung → `conflicts.create`.
- **FE-AUTH-05/06 — Profil: Self-Service „Passwort ändern"** (`POST /auth/password`), danach saubere Neuanmeldung.
- **FE-FND-03 — Command Palette (⌘K / Strg+K):** rollengefilterte Schnellnavigation, Pfeiltasten + Enter, Esc; ⌘K-Hinweis in der Topbar.
- **FE-FND-07 — geteilte Editor-Bausteine** (`components/editors.tsx`: List-/Tag-Editor), genutzt in Capture **und** KO-Detail.

### Geänderte/neue Dateien
`app/AuthContext.tsx`, `shell/Topbar.tsx`, `shell/AppShell.tsx`, `shell/Sidebar.tsx`, `shell/CommandPalette.tsx` (neu), `pages/Capture.tsx`, `pages/KnowledgeDetail.tsx`, `pages/Library.tsx`, `pages/Profile.tsx`, `auth/ResetScreen.tsx`, `components/editors.tsx` (neu), `api/auth.ts`, `api/endpoints.ts`, `i18n.ts`; Backend: `services/auth/src/routes.ts`.

### Nachtrag (gleiche Session, 2. Batch)
- ✅ **FE-CON Konflikt-Auflösung**: Konflikt-Board kann jetzt mit Entscheidung auflösen (`resolve-conflict`), zeigt die Entscheidung bei gelösten Fällen; Eskalation bleibt.
- ✅ **FE-VAL-05 Zuweisung zur Validierung**: pro Objekt Experte/Controller aus Nutzerliste zuweisen (`assign` → E-Mail via FR-VAL-07).
- ✅ **FE-RISK Lücken-Zuweisung**: offene Wissenslücke an Experten zuweisen (`gaps.assign`), Zuweisung wird angezeigt.

### Nachtrag (3. Batch — Backend + Frontend)
- ✅ **Kommentare am Wissensobjekt** (FR-KO-06 / FE-KO-06 / FE-VAL-06): neue Backend-Aktion `comment` (jeder Angemeldete), Persistenz als Teil des KO-JSONB (keine Migration), bleiben über `revise` erhalten, Audit `ko.commented`. Vitest ergänzt, Spec ergänzt (`specs/stories/knowledge-object.md`). Frontend: Kommentar-Liste + Eingabe im KO-Detail.

### Nachtrag (4. Batch — Konflikt-Workflow + Reasoner-Schreibhilfe)
- ✅ **FE-CON-05 Zweitmeinung**: Conflict-Board kann eine Zweitmeinung erfassen (Backend-Endpunkt war vorhanden), Anzeige am Konflikt.
- ✅ **FE-RSN-03 Schreibhilfe (`assist`)**: neue Backend-Aktion `POST /api/reasoner {task:"assist"}` (Modell glättet/präzisiert; deterministischer Fallback markiert `demo:true`). Vitest + Spec ergänzt. Frontend: „Aussage präzisieren"-Button im Capture-Editor.
- 🐞 **Bugfix:** `reasoner.structure` sendete kein `task`-Feld → „Strukturieren" wäre serverseitig auf 400 gelaufen. Jetzt `task:"structure"` gesetzt.

### Nachtrag (5. Batch — Anhänge/Fotos)
- ✅ **FE-CAP-05 Anhänge/Fotos** (Pilot, ohne Objektspeicher): Bild wird **client-seitig** auf ein Thumbnail (JPEG, max. 1024px, Canvas) verkleinert und als Daten-URL im KO-JSONB gespeichert. Backend-Aktionen `attach`/`detach` mit Größen-/Anzahl-/MIME-Guards (≤700 KB, ≤8, nur `image/*`), Audit `ko.attached`/`ko.detached`. Vitest + Spec ergänzt. Frontend: Foto-Anhängen + Thumbnail-Galerie mit Entfernen im KO-Detail.
- **Stufe-2-Upgrade dokumentiert:** Voll-Bilder/Dokumente über S3-Objektspeicher.

### Noch offen
- FE-CAP-06 OCR/Dokument-Parsing (clientseitig, größere Lib). FE-OUT/IMP/MGMT (Stufe-2-Module). Mobile-responsive Shell (Hamburger). Kleinere Zusatzfilter (FE-VAL-02/FE-LIB).

### Offen — benötigt zuerst Backend-Endpunkte (Stufe 2 / BE-Lücke)
- FE-CAP-05 Anhänge/Foto-Upload (Objektspeicher), FE-CAP-06 OCR.
- FE-OUT (Output Factory), FE-IMP (Import/Review), FE-MGMT/Kapital-Sichten.
- FE-RSN-03 `assistText`, voll reasoner-getriebenes Interview (eigener Endpunkt).
