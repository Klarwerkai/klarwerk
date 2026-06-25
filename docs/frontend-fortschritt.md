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

### Nachtrag (6. Batch — Namensauflösung + Verzeichnis-Endpunkt)
- ✅ **Anzeigenamen statt UUIDs**: Kommentare, Historie, Herkunft (KO-Detail) und Lücken-Zuweisung zeigen jetzt den Nutzernamen.
- ✅ **Bugfix:** `GET /api/users` ist admin-only → Zuweisungs-Dropdowns (Validierung/Risiko) funktionierten für Controller nicht. Neuer `GET /api/directory` (id+name, requireUser) für alle Rollen; `useDirectory()`-Hook. Live-Befund aus der Verifikation behoben.

### Nachtrag (7. Batch — Wissenserfassung vollständig ausgebaut)
Fokus-Überarbeitung der Capture-Seite zur 100%-Parität mit der Vorgänger-App:
- ✅ **Autor**-Feld (read-only, aktueller Nutzer).
- ✅ **Metadaten vorab**: Wissensart, Kategorie, Anlage/Asset, #Tags, Nötige Validierungen — mit **Hilfe-Tooltips** („?"-Popover inkl. „Im Hilfe-Center öffnen", `HelpTip`-Komponente, FE-FND-05).
- ✅ **KI-Hilfe** (Reasoner-`assist`) auf Rohtext **und** Aussage.
- ✅ **Bilder anhängen** (FR-CAP-05): client-seitige Verkleinerung, Vorschau-Galerie, werden beim Einreichen am erzeugten Objekt angehängt.
- ✅ **Dokumente** (FR-CAP-06, Teil): txt/md/csv werden client-seitig als Volltext gelesen und als Kontext übernommen.
- ✅ **Als Entwurf speichern** (echte drafts-API) und **Beispiel laden**.
- Geteilte Helfer: `lib/files.ts` (Thumbnail/Text-Lesen), `components/HelpTip.tsx`; `Field`-Label akzeptiert jetzt ReactNode.
- **Ehrliche Grenze:** pdf/docx-Volltext + Bild-OCR brauchen eine Parser-Lib (z. B. `pdfjs-dist`, `mammoth`, `tesseract.js`) → npm-Install durch Stakeholder; die Upload-UI ist vorbereitet. Große Dateien/Video brauchen Objektspeicher (S3).

### Noch offen
- **FE-CAP-06 OCR**: braucht eine neue Client-Lib (z. B. tesseract.js) — npm-Install nötig (kann ich im Sandbox nicht sicher ausführen) → Stakeholder installiert.
- **FE-OUT/IMP/MGMT (Stufe 2)**: je ein neues Backend-Modul (Neubau, war auch in der Vorgänger-App nur Stufe-2-Platzhalter).
- Mobile-responsive Shell (Hamburger); kleinere Zusatzfilter (FE-VAL-02/FE-LIB).

### Nachtrag (8. Batch — FE-CAP-06 stabilisiert: DOCX echt, Dependencies bereinigt) — SCRUM-100
Auftrag aus Codex-QM-Logbuch Abschnitt 6 (Freigabe Option A):
- ✅ **DOCX-Textextraktion** echt, client-seitig: `mammoth` wird **lazy** geladen (`await import("mammoth")`). Neuer Kern `extractDocxText(ArrayBuffer)` (in Node testbar) + Browser-Wrapper `readDocxFile(File)` + `isWordDocument()` in `apps/web/src/lib/files.ts`. `Capture.tsx` (`onDocs`) hängt DOCX wie Textdateien als Kontext an; `accept` um `.docx` erweitert. **Kein Capture-Flow-Umbau** — gleiche Upload-Fläche/Logik.
- ✅ **Engine-/Bundle-Risiko entfernt:** `pdfjs-dist@6` (verlangte Node ≥22, Konflikt zu Node ≥20) und `tesseract.js` aus `apps/web/package.json` **entfernt**; `package-lock.json` via `npm install --package-lock-only` konsistent regeneriert (0 Referenzen, kein `22.13.0` mehr). Keine ungenutzten schweren Dependencies.
- ✅ **Ehrliche UI-Texte** (DE/EN): `capture.documentsHint`/`docUnsupported` nennen unterstützte Typen (txt/md/csv/json/log/docx) und „pdf & OCR: noch nicht unterstützt"; neuer `capture.docParseError`.
- ✅ **Test:** `tests/capture/docx-extract.test.ts` (+ Fixture `tests/fixtures/sample.docx`) — extrahiert Klartext, prüft Typ-Erkennung. **Lauf nur auf Mac** (`vitest` in Sandbox nicht ausführbar).
- ✅ **Spec** `specs/stories/capture.md` (FR-CAP-05) aktualisiert: txt+docx erledigt, PDF/OCR als eigene Resttickets.
- **Verifiziert (Sandbox):** `tsc` (apps/web), Biome (geänderte Dateien), dependency-cruiser. **Mac-Gate offen:** `npm install` + `npm run check` (inkl. `vitest` + `vite build`).
- **Restticket-Vorschlag (Jira):** PDF-Extraktion (pdfjs Node-20-kompatibel pinnen) und Bild-OCR (lazy/performant/testbar) als eigene Tickets unter SCRUM-100/FE-CAP-06.

### Nachtrag (9. Batch — FE-VAL-02 Validierungsfilter) — SCRUM-103
- ✅ **Kombinierbare Filter im Validation Board** (AND): Volltextsuche über Titel, Aussage, Bedingungen, Maßnahmen, Kategorie und Tags (case-insensitive) + Filter Wissensart/Kategorie/Tag + „Mir zugewiesen" (`assignments.includes(user.id)`, null-User-sicher).
- ✅ Reine, DOM-freie Logik in `apps/web/src/lib/validationFilters.ts` (`matchesValidationFilter`, `categoryOptions`/`tagOptions`/`typeOptions` — stabil sortiert, dedupliziert); Optionen aus den geladenen Board-Items abgeleitet. Test `tests/validation/validation-filters.test.ts` (6 Fälle).
- ✅ `Validation.tsx`: kompakte, responsive Filterleiste; **Board-Karten, Rating-Buttons und Zuweisungs-Select unverändert** (keine Regression). i18n DE/EN ergänzt.
- Kein Backend/Status-Filter neu erfunden (Board liefert offene KOs); leerer Filter = unveränderte Liste.

### Nachtrag (10. Batch — FE-VAL-06 Revisionsfeedback) — SCRUM-103
- ✅ **Pflicht-Feedback bei Gelb/Bedingt und Rot/Ablehnen**: Klick öffnet pro KO ein kompaktes Feedbackfeld an der Karte; Submit erst aktiv, wenn Text vorhanden; Abbrechen möglich; klar erkennbar „Bedingt" vs. „Ablehnung".
- ✅ **Reihenfolge beim Submit**: erst `comment` (mit neutralem Präfix „Validierungsfeedback (Bedingt|Ablehnung): …"), dann `rate` (`warn`/`down`), dann invalidieren + Form schließen. Grün/Bestätigen bleibt 1-Klick.
- ✅ Reiner, DOM-freier Helfer `apps/web/src/lib/validationFeedback.ts` (`buildValidationFeedback`, `feedbackPrefix`, `isFeedbackSubmittable`) + Test `tests/validation/validation-feedback.test.ts` (3 Fälle).
- ✅ `Validation.tsx`: Karte um optionales Feedback-Panel ergänzt (Wrapper-`div`), **Filterleiste, Zuweisungsselect, Grün-Button und Rating-Mechanik unverändert**; Buttons/Form während Submit deaktiviert; minimale Fehleranzeige. i18n DE/EN ergänzt.
- **Kein neues Backend-Statusmodell**: nutzt vorhandene Aktionen `comment`+`rate`. **Restlücke (nicht improvisiert):** eine echte „Rückgabe an Autor" als eigene Aufgabe/Status existiert im Backend nicht — das Feedback ist als KO-Kommentar nachvollziehbar, eine Aufgaben-/Statusrückgabe wäre ein separates Backend-Ticket.

### Offen — benötigt zuerst Backend-Endpunkte (Stufe 2 / BE-Lücke)
- FE-CAP-05 Anhänge/Foto-Upload (Objektspeicher); PDF-Extraktion + Bild-OCR (FE-CAP-06, neue Resttickets).
- FE-VAL-06 „Rückgabe an Autor" als eigene Aufgabe/Status (Backend-Restlücke; aktuell als KO-Kommentar gelöst).
- FE-OUT (Output Factory), FE-IMP (Import/Review), FE-MGMT/Kapital-Sichten.
- FE-RSN-03 `assistText`, voll reasoner-getriebenes Interview (eigener Endpunkt).
