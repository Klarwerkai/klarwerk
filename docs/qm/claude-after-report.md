# Claude — After-Reports (QM)

> Nur fertige Nachberichte je abgeschlossener Aufgabe. Keine Planung, kein zweites Backlog.
> Backlog-Wahrheit bleibt Jira (Projekt SCRUM).

---

Datum: 2026-06-25
Ticket: SCRUM-100 · FE-CAP-06 (Dokument-Parsing/OCR) — Freigabe Option A
Änderung: DOCX-Textextraktion echt umgesetzt; Engine-/Bundle-Risiko durch Entfernen ungenutzter schwerer Libs beseitigt; UI-Texte ehrlich gemacht; Test + Spec/Doku ergänzt. Kein Capture-Flow-Umbau (gleiche Upload-Fläche/Logik, nur zusätzlicher Dateityp-Zweig).
Gebaut:
- `apps/web/src/lib/files.ts`: `extractDocxText(ArrayBuffer)` (reiner, node-testbarer Kern, `mammoth` lazy via `await import`), `readDocxFile(File)`, `isWordDocument()`; lokaler Typ statt `any`, CJS/ESM-Interop abgesichert.
- `apps/web/src/pages/Capture.tsx`: `onDocs` liest `.docx` wie Textdateien als Kontext; `accept` um `.docx` erweitert; eigener `docParseError`-Pfad.
- `apps/web/src/i18n.ts` (DE+EN): ehrliche Hinweise (txt/md/csv/json/log/docx = Volltext; pdf & OCR = noch nicht unterstützt) + neuer Key `capture.docParseError`.
- `apps/web/package.json`: `pdfjs-dist` und `tesseract.js` entfernt, `mammoth` behalten; `package-lock.json` konsistent regeneriert (`npm install --package-lock-only`, ohne node_modules anzufassen).
- `specs/stories/capture.md` (FR-CAP-05) aktualisiert; `docs/frontend-fortschritt.md` 8. Batch ergänzt.
Getestet:
- Sandbox grün: `tsc --noEmit` (apps/web), Biome `check`, dependency-cruiser (keine Verstöße, 61 Module).
- Neuer Unit-Test `tests/capture/docx-extract.test.ts` + Fixture `tests/fixtures/sample.docx` (extrahiert „Ventil bei Überdruck schließen", prüft Typ-Erkennung).
- Lock-Verifikation: `pdfjs-dist`/`tesseract` = 0 Referenzen; `node >=22.13.0` = 0 → Engine-Konflikt weg.
Nicht ausführbare Checks + Grund:
- `vitest` (inkl. neuer DOCX-Test) — in Sandbox nicht ausführbar (native Binaries) → Mac-Gate.
- `vite build` / voller `npm run check` — nicht in Sandbox → Mac-Gate.
- `git push` — `.git` im Sandbox schreibgeschützt (`index.lock` Operation not permitted) → Commit/Push durch Stakeholder.
Offen:
- PDF-Extraktion — eigenes Restticket (pdfjs auf Node-20-kompatible Version pinnen, build-verifiziert).
- Bild-OCR — eigenes Restticket (nur lazy/performant/testbar, z. B. tesseract.js als Worker).
- FE-CAP-05 echter Objektspeicher (S3) bleibt SCRUM-121.
Risiko: gering. Restrisiko nur im Mac-Gate: `npm install` muss regenerierten Lock anwenden, dann `vitest` (DOCX-Test) + `vite build` grün. mammoth ist reines JS, Node-20-kompatibel, lazy → kein Haupt-Bundle-Gewicht.
Git-Status: nicht committed (Sandbox kann nicht pushen). Geändert: `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/src/i18n.ts`, `apps/web/src/lib/files.ts`, `apps/web/src/pages/Capture.tsx`, `docs/frontend-fortschritt.md`, `specs/stories/capture.md`; neu: `tests/capture/docx-extract.test.ts`, `tests/fixtures/sample.docx`, `docs/qm/claude-after-report.md`.
Jira-Kommentar-Vorschlag (SCRUM-100): „FE-CAP-06 stabilisiert: DOCX-Textextraktion client-seitig real (mammoth lazy; files.ts `extractDocxText`/`readDocxFile`, Capture.tsx onDocs) + Test `tests/capture/docx-extract.test.ts`. pdfjs-dist@6 (Node-≥22-Konflikt) und tesseract.js entfernt → kein Engine-/Bundle-Risiko, keine ungenutzten Deps; Lock regeneriert. UI-Texte ehrlich (pdf/OCR offen). Sandbox grün: tsc/Biome/dep-cruiser; vitest+build = Mac-Gate offen. PDF + OCR als separate Resttickets. FE-CAP-06 noch nicht abhaken (Test-/Build-Gate offen); Ticket bleibt In Progress."
Nächster Schritt: Mac-Gate (`cd apps/web && npm install`, dann Repo-Root `npm run check`). Bei grün: DOCX-Teil abhaken, zwei Resttickets (PDF-Pin, OCR-Worker) anlegen, danach FE-VAL-02 Facettenfilter.

---

Datum: 2026-06-25
Ticket: SCRUM-100 / FE-CAP-06 — Testpfad-Korrektur
Änderung: In `tests/capture/docx-extract.test.ts` den Fixture-Pfad korrigiert. `here` zeigt auf `tests/capture`, daher suchte `join(here, "fixtures/sample.docx")` fälschlich `tests/capture/fixtures/sample.docx`. Geändert auf `join(here, "..", "fixtures", "sample.docx")` → löst korrekt auf `tests/fixtures/sample.docx`. Nur die Testdatei angefasst; Fixture-Ablage unverändert (`tests/fixtures/sample.docx`). Produktcode (`Capture.tsx`, `files.ts`) und Capture-Flow nicht berührt.
Getestet: Pfadauflösung verifiziert (`node` prüft Existenz → `tests/fixtures/sample.docx` OK). Biome `check` auf der Testdatei grün.
Nicht ausführbare Checks + Grund: `vitest` (eigentlicher DOCX-Testlauf) — in Sandbox nicht ausführbar (native Binaries) → Mac-Gate. `git push` — `.git` im Sandbox schreibgeschützt → Commit/Push durch Stakeholder.
Offen: Mac-Gate (`npm install` + `npm run check` inkl. vitest) bestätigt den jetzt korrigierten Test. PDF-Extraktion + Bild-OCR weiterhin als eigene Resttickets.
Risiko: minimal — reine Pfadkorrektur in einer Testdatei, keine Verhaltensänderung im Produktcode.
Git-Status: nicht committed (Sandbox kann nicht pushen). Geändert in diesem Schritt: `tests/capture/docx-extract.test.ts`. (Übrige FE-CAP-06-Änderungen weiterhin uncommitted aus dem vorherigen Schritt.)
Jira-Kommentar-Vorschlag (SCRUM-100): „Nachtrag: Fixture-Pfad im DOCX-Test korrigiert (`tests/capture/docx-extract.test.ts` → `../fixtures/sample.docx`). Sandbox-Pfadauflösung + Biome grün. Checkbox weiterhin offen bis Mac-Gate (vitest+build)."
Nächster Schritt: Mac-Gate ausführen; bei grünem `vitest` FE-CAP-06-DOCX-Teil abhaken. Noch keine Jira-Checkbox/Status-Änderung.

---

Datum: 2026-06-25
Ticket: SCRUM-100 / FE-CAP-06 — Mac-Gate
Änderung: keine. Kein Code geändert (Gate rot → nicht weitergebaut). Nur Test-/Gate-Lauf zur Statusklärung.
Getestet: vitest lief real in der Linux-Sandbox (v2.1.9, Node) auf `tests/capture/docx-extract.test.ts`. Hinweis: KEIN Mac-Lauf (kein Zugriff auf Mac-Shell) und KEIN voller `npm run check`/`vite build`.
Ergebnis: ROT. 2 Tests, 1 grün (`isWordDocument`-Typ-Erkennung), 1 rot: `extractDocxText` → mammoth `Error: Could not find file in options` (mammoth/lib/unzip.js:18).
Ursache (Projektproblem im Test-Setup, NICHT Umgebung): mammoth mappt per `browser`-Feld zwei Builds. Browser-Build (`browser/unzip.js`, von Vite/Produktion genutzt) akzeptiert nur `{ arrayBuffer }`. Node-Build (`lib/unzip.js`, von vitest genutzt) akzeptiert nur `{ path | buffer | file }`. Unter Node wird `{ arrayBuffer }` abgelehnt. → Der Produktions-/Browser-Pfad ist plausibel korrekt; der Unit-Test unter Node kann so nicht grün werden. Der echte Mac-`npm run check` würde identisch rot laufen (vitest = Node-Resolution).
Nicht ausführbare Checks + Grund: Mac `npm install` + voller `npm run check` inkl. `vite build` — kein Zugriff auf Mac-Shell, `vite build` nicht in Sandbox. `git push` — `.git` schreibgeschützt.
Offen: Fix nötig, damit `extractDocxText` unter beiden mammoth-Builds funktioniert (Vorschlag, noch NICHT umgesetzt, wartet auf Freigabe): in `extractDocxText` beide Schlüssel übergeben — `{ arrayBuffer, buffer: new Uint8Array(arrayBuffer) }` (Browser nimmt `arrayBuffer`, Node nimmt `buffer`; `Uint8Array` ist umgebungsneutral, kein `Buffer` nötig). Alternative: mammoth in `vitest.config` auf den Browser-Build aliasen. Danach erneuter Gate-Lauf.
Risiko: niedrig–mittel. Produktions-Browser-Pfad voraussichtlich funktionsfähig, aber bis zum grünen Test/Build unbewiesen → FE-CAP-06/DOCX bleibt offen.
Git-Status: unverändert ggü. vorigem Schritt (FE-CAP-06-Änderungen weiterhin uncommitted; in diesem Schritt keine Datei geändert). Sandbox kann nicht pushen.
Jira-Kommentar-Vorschlag (SCRUM-100): „Mac-Gate-Vorlauf: DOCX-Unit-Test rot. Ursache: mammoth Browser-Build akzeptiert `arrayBuffer`, Node-Build (vitest) nicht. Produktions-/Browser-Pfad plausibel ok, Test/Build aber noch nicht grün. Fix in Arbeit (Übergabe an mammoth umgebungsneutral). FE-CAP-06 NICHT abhaken, Ticket bleibt In Progress."
Nächster Schritt: Freigabe für den 1-Zeilen-Fix in `apps/web/src/lib/files.ts` (umgebungsneutrale Übergabe an mammoth), dann erneuter vitest-Lauf; anschließend Mac-`npm run check` durch Stakeholder. Keine Jira-Checkbox/Status-Änderung bis grün.

---

Datum: 2026-06-25
Ticket: SCRUM-100 / FE-CAP-06 — Mammoth Node/Browser Fix
Änderung: `apps/web/src/lib/files.ts`: lokale mammoth-Typdefinition erweitert (`MammothInput = { arrayBuffer: ArrayBuffer; buffer?: Uint8Array }`) und `extractRawText` mit beiden Schlüsseln aufgerufen: `{ arrayBuffer: buffer, buffer: new Uint8Array(buffer) }`. Browser-Build nutzt `arrayBuffer`, Node-Build `buffer`; `Uint8Array` ist umgebungsneutral, kein Node-`Buffer`. Keine Änderung an Capture-Flow, Capture.tsx, i18n, package.json/lock.
Getestet: (1) gezielter vitest `tests/capture/docx-extract.test.ts` → 2/2 grün; (2) Biome `check apps/web/src/lib/files.ts` → grün; (3) `tsc --noEmit` (apps/web) → grün.
Ergebnis: GRÜN. DOCX-Unit-Test grün. Der volle Mac-Gate / `npm run check` (inkl. `vite build`) ist weiterhin offen.
Nicht ausführbare Checks + Grund: Mac `npm install` + voller `npm run check` inkl. `vite build` — kein Zugriff auf Mac-Shell, `vite build` nicht in Sandbox. `git push` — `.git` schreibgeschützt.
Offen: voller Mac-`npm run check` (vitest-Gesamtsuite + build) durch Stakeholder. PDF-Extraktion + Bild-OCR weiterhin separate Resttickets. Hinweis: zwei vitest-Temp-Artefakte `vitest.config.ts.timestamp-*.mjs` sind beim Lauf entstanden; sie erscheinen NICHT in `git status` (von git ignoriert) und ließen sich aus der Sandbox nicht löschen (`Operation not permitted`) → kein Commit-Risiko, ggf. auf dem Mac entfernen.
Risiko: niedrig. Fix ist additiv (zusätzlicher Schlüssel), ändert den Browser-Pfad nicht (nimmt weiterhin `arrayBuffer`), macht nur den Node-Test grün.
Git-Status: nicht committed (Sandbox kann nicht pushen). In diesem Schritt geändert: `apps/web/src/lib/files.ts`, `docs/qm/claude-after-report.md`. Gesamter FE-CAP-06-Satz weiterhin uncommitted.
Jira-Kommentar-Vorschlag (SCRUM-100): „mammoth Node/Browser-Fix: `extractDocxText` übergibt `arrayBuffer` UND `buffer` (Uint8Array). Gezielter DOCX-Unit-Test grün (2/2), Biome + tsc grün. Voller Mac-`npm run check` (inkl. build) noch offen → FE-CAP-06 weiterhin NICHT abhaken; Ticket bleibt In Progress."
Nächster Schritt: Stakeholder führt Mac-Gate (`cd apps/web && npm install`, dann `npm run check`). Bei grün: FE-CAP-06-DOCX-Teil abhaken, Resttickets PDF/OCR anlegen. Keine Jira-Änderung bis dahin.

---

Datum: 2026-06-25
Ticket: SCRUM-100 / FE-CAP-06 — Cleanup vor Gate
Änderung: `.gitignore` um `*.timestamp-*.mjs` ergänzt (mit Kommentar). Grund: Vite/Vitest erzeugen beim Transpilieren der TS-Configs flüchtige `*.config.ts.timestamp-*.mjs`-Dateien; die beiden vorhandenen ließen sich aus der Sandbox nicht löschen (`Operation not permitted`, host-owned) und entstehen bei jedem vitest-Lauf neu. Ein gezieltes `rm` ist somit nicht dauerhaft; das projektweite Ignore ist der richtige, standardkonforme Fix. Kein Produktcode/Capture-Flow/package.json berührt.
Getestet: `git status --short` vor und nach der Änderung; `git check-ignore -v` bestätigt, dass die Tempdateien jetzt durch `.gitignore:10` ignoriert werden.
Ergebnis: Arbeitsbaum commitfähig. Untracked-Tempdateien sind aus `git status` verschwunden. Verbleibend nur echte FE-CAP-06-Artefakte + `.gitignore`: M `.gitignore`, `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/src/i18n.ts`, `apps/web/src/lib/files.ts`, `apps/web/src/pages/Capture.tsx`, `docs/frontend-fortschritt.md`, `specs/stories/capture.md`; ?? `docs/qm/`, `tests/capture/`, `tests/fixtures/`.
Offen: voller Mac-`npm run check` (vitest-Gesamtsuite + `vite build`) durch Stakeholder. Physisches Löschen der zwei Tempdateien optional auf dem Mac (git ignoriert sie ohnehin). PDF/OCR weiterhin separate Resttickets.
Risiko: minimal — nur `.gitignore` ergänzt, kein Code/Verhalten geändert. `*.timestamp-*.mjs` ist ein eng gefasstes, branchenübliches Vite/Vitest-Muster ohne Nebenwirkung auf Produktdateien.
Git-Status: nicht committed (Sandbox kann nicht pushen). In diesem Schritt geändert: `.gitignore`, `docs/qm/claude-after-report.md`.
Jira-Kommentar-Vorschlag (SCRUM-100): „Arbeitsbaum vor Gate bereinigt: vitest-Temp `*.timestamp-*.mjs` in `.gitignore` aufgenommen (aus Sandbox nicht löschbar, regenerieren bei jedem Lauf). git status sauber. FE-CAP-06 weiterhin NICHT abhaken — erst nach vollem Mac-`npm run check`. Ticket bleibt In Progress."
Nächster Schritt: Stakeholder: `cd apps/web && npm install`, dann Repo-Root `npm run check`. Bei vollständig grün + sauberem Arbeitsbaum: FE-CAP-06-DOCX als getestet markieren, Resttickets PDF/OCR anlegen.

---

Datum: 2026-06-25
Ticket: SCRUM-100 / FE-CAP-06 — DOM-freier DOCX-Test-Fix
Änderung: DOCX-Kern in DOM-freies Modul ausgelagert. Neu `apps/web/src/lib/docx.ts`: `extractDocxText(buffer: ArrayBuffer)` + DOM-freie Erkennung `isDocxDocumentLike({ name, type? })` — ohne File/Image/document/FileReader; mammoth-Typ lokal, beide Schlüssel (`arrayBuffer` + `buffer: Uint8Array`). `apps/web/src/lib/files.ts` bleibt DOM-Modul, importiert nun aus `./docx`; `isWordDocument(file)` ist dünner Wrapper um `isDocxDocumentLike`, `readDocxFile(file)` bleibt Browser-Wrapper; Bild-Thumbnail/Text-Reader unverändert. `tests/capture/docx-extract.test.ts` importiert NUR noch `./docx`, kein `new File(...)`; Typ-Erkennung über `{ name, type }`; `toArrayBuffer` kopiert in frische `Uint8Array` → echtes `ArrayBuffer` (behebt `ArrayBuffer | SharedArrayBuffer`). Capture.tsx unverändert (Importe `isWordDocument`/`readDocxFile` bleiben aus files.ts gültig). Kein Root-tsconfig/DOM, kein package.json, kein pdfjs/tesseract.
Getestet: (1) Root `tsc --noEmit` (der zuvor rote Schritt) → grün. (2) apps/web `tsc --noEmit` → grün. (3) gezielter vitest `tests/capture/docx-extract.test.ts` → 2/2 grün. (4) volle vitest-Unit-Suite → 19 Dateien / 106 Tests grün. (5) `depcruise` (services + apps/web/src) → keine Verstöße. (6) Biome auf echtem Code (apps/services/tests, 162 Dateien) → sauber.
Ergebnis: GRÜN für alle echten Checks. EINSCHRÄNKUNG bei `biome check .`: 6 Fehler, ALLE aus `vitest.config.ts.timestamp-*.mjs` (4 Stück). Das sind transiente vite-Temp-Dateien (entstehen beim Laden der TS-Config), die vite normalerweise sofort löscht; die Sandbox kann sie nicht entfernen (`Operation not permitted`), daher sammeln sie sich nur hier. Auf dem Mac existieren sie zur Lint-Zeit nicht → kein echtes Lint-Problem. git ignoriert sie bereits (`*.timestamp-*.mjs`).
Nicht ausführbare Checks + Grund: voller `npm run check` als Mac-Lauf (inkl. `vite build`) — kein Mac-Zugriff, `vite build` nicht in Sandbox. `git push` — `.git` schreibgeschützt. Löschen der 4 Temp-Dateien — `Operation not permitted` (host-owned).
Offen: Mac-`npm run check` durch Stakeholder als finaler Gate (sollte jetzt grün sein; falls `biome check .` lokal stolpert, evtl. übrig gebliebene `vitest.config.ts.timestamp-*.mjs` mit `rm` entfernen — Peter hat Rechte; sie regenerieren nur während eines Laufs). PDF/OCR weiterhin separate Resttickets.
Risiko: niedrig. Saubere Modultrennung (DOM-frei vs. DOM), Verhalten im Browser unverändert (`readDocxFile`→`arrayBuffer`), Backend/Service-Code nicht berührt.
Git-Status: nicht committed (Sandbox kann nicht pushen). In diesem Schritt: neu `apps/web/src/lib/docx.ts`; geändert `apps/web/src/lib/files.ts`, `tests/capture/docx-extract.test.ts`, `docs/qm/claude-after-report.md`. (Gesamter FE-CAP-06-Satz weiterhin uncommitted.)
Jira-Kommentar-Vorschlag (SCRUM-100): „DOM-freier DOCX-Kern `apps/web/src/lib/docx.ts` ausgelagert; Test importiert nur noch das DOM-freie Modul. Root-tsc (zuvor rot) jetzt grün, apps/web-tsc grün, vitest 106/106 grün, depcruise grün, Biome auf echtem Code sauber. Einzige Lint-Auffälligkeit sind sandbox-lokale vite-Temp-Dateien (auf dem Mac nicht vorhanden). FE-CAP-06 weiterhin NICHT abhaken bis Mac-`npm run check` grün; Ticket bleibt In Progress."
Nächster Schritt: Stakeholder führt Mac-`npm run check`. Bei grün: FE-CAP-06-DOCX als getestet markieren (durch Peter/Codex), Resttickets PDF/OCR anlegen. Keine Jira-Änderung durch mich.

---

Datum: 2026-06-25
Ticket: SCRUM-100 / FE-CAP-06 — Biome-Ignore-Fix für Vitest-Tempdateien
Änderung: In `biome.json` die Ignore-Regel `**/vite.config.ts.timestamp-*.mjs` ersetzt durch `**/*.timestamp-*.mjs`. Damit werden sowohl Vite- (`vite.config.ts.timestamp-*.mjs`) als auch Vitest-Temp-Dateien (`vitest.config.ts.timestamp-*.mjs`) zuverlässig von Biome ignoriert. Nur `biome.json` + dieser Report geändert; kein Produktcode/Test/tsconfig/package.json.
Getestet: (1) `npx biome check .` → grün (168 Dateien, keine Fehler), obwohl 4 `vitest.config.ts.timestamp-*.mjs` physisch noch im Baum liegen (sandbox-seitig nicht löschbar) → Regel greift. (2) `git status --short` geprüft.
Ergebnis: GRÜN. `biome check .` sauber; die Vitest-Temp-Dateien werden jetzt ignoriert.
Offen: finaler Mac-`npm run check` durch Stakeholder (sollte nun durchlaufen: build + lint + arch + test). PDF/OCR weiterhin separate Resttickets.
Risiko: minimal — reine Lint-Ignore-Konfiguration, breiteres aber präzises Muster (`*.timestamp-*.mjs` ist das übliche Vite/Vitest-Temp-Schema), kein Einfluss auf Produktdateien.
Git-Status: nicht committed (Sandbox kann nicht pushen). In diesem Schritt geändert: `biome.json`, `docs/qm/claude-after-report.md`. Gesamter FE-CAP-06-Satz weiterhin uncommitted (M: `.gitignore`, `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/src/i18n.ts`, `apps/web/src/lib/files.ts`, `apps/web/src/pages/Capture.tsx`, `biome.json`, `docs/frontend-fortschritt.md`, `specs/stories/capture.md`; ??: `apps/web/src/lib/docx.ts`, `docs/qm/`, `tests/capture/`, `tests/fixtures/`).
Jira-Kommentar-Vorschlag (SCRUM-100): „Biome-Ignore korrigiert: `**/*.timestamp-*.mjs` deckt Vite- UND Vitest-Temp-Dateien ab. `biome check .` grün. Damit sind alle in der Sandbox ausführbaren Gates grün (Root-tsc, apps/web-tsc, vitest 106/106, depcruise, biome). FE-CAP-06 weiterhin NICHT abhaken bis finaler Mac-`npm run check`; Ticket bleibt In Progress."
Nächster Schritt: Peter führt finalen Mac-`npm run check`. Bei grün: Peter/Codex gibt Jira frei (FE-CAP-06-DOCX als getestet), Resttickets PDF/OCR anlegen. Keine Jira-Änderung durch mich.

---

Datum: 2026-06-25
Ticket: SCRUM-100 / FE-CAP-06 — Mac-Gate (final) GRÜN
Änderung: keine. Reiner Verifikationslauf durch Peter auf dem Mac (`npm run check`).
Getestet (Mac, durch Peter): `npm run check` = build + lint + arch + test.
Ergebnis: GRÜN.
- build (`tsc --noEmit`) → grün.
- lint (`biome check .`, 168 Dateien) → grün (Vitest-Temp jetzt korrekt ignoriert).
- arch (`depcruise … services`, 114 Module / 343 Dependencies) → keine Verstöße.
- test (`vitest run`) → 19 Dateien / 106 Tests grün, inkl. `tests/capture/docx-extract.test.ts` (2).
Nicht ausführbare Checks + Grund: keine offen für `npm run check`. Hinweis: `npm run check`/`build` deckt `tsc --noEmit` ab; ein separater `vite build` ist nicht Teil des Harness-Gates.
Offen: nur noch Prozess-Schritte außerhalb meines Mandats — (a) Commit/Push des FE-CAP-06-Satzes durch Peter (Sandbox kann nicht pushen); (b) Jira-Freigabe durch Peter/Codex (FE-CAP-06-DOCX abhaken, SCRUM-100 ggf. Statuspflege); (c) Resttickets PDF-Extraktion + Bild-OCR anlegen.
Risiko: gering. Vollständiger grüner Harness-Gate auf dem Mac; DOM-freie Modultrennung, Browser-Verhalten unverändert.
Git-Status (Mac, vor Commit): M `.gitignore`, `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/src/i18n.ts`, `apps/web/src/lib/files.ts`, `apps/web/src/pages/Capture.tsx`, `biome.json`, `docs/frontend-fortschritt.md`, `specs/stories/capture.md`; ?? `apps/web/src/lib/docx.ts`, `docs/qm/`, `tests/capture/`, `tests/fixtures/`. Arbeitsbaum commitfähig (Vitest-Temp via `.gitignore` ausgeschlossen).
Jira-Kommentar-Vorschlag (SCRUM-100): „Mac-`npm run check` final GRÜN: build/lint/arch/test (vitest 106/106 inkl. DOCX-Test). FE-CAP-06 DOCX-Textextraktion ist damit gebaut UND getestet → FE-CAP-06 (DOCX-Teil) kann abgehakt werden. Offen bleiben PDF-Extraktion und Bild-OCR als separate Resttickets (FE-CAP-06 wird dadurch nicht vollständig geschlossen). Freigabe durch Stakeholder/QM."
Nächster Schritt: Peter committet/pusht den FE-CAP-06-Satz; Peter/Codex hakt FE-CAP-06-DOCX in Jira ab und legt die Resttickets PDF/OCR an. Danach zurück zur vertikalen Stufe-1-Parität (Vorschlag: FE-VAL-02 Facettenfilter).

---

## SCRUM-103 / FE-VAL-02 — Validierungsfilter — Nachbericht
Datum: 25.06.2026
### Geändert
- `apps/web/src/lib/validationFilters.ts` (neu): reine, DOM-freie Filterlogik — `matchesValidationFilter(k, filter, userId)` (AND über Volltext/Typ/Kategorie/Tag/„mir zugewiesen"), `categoryOptions`/`tagOptions`/`typeOptions` (dedupliziert, `localeCompare`-sortiert), `EMPTY_VALIDATION_FILTER`. Volltext über Titel, Aussage, Bedingungen, Maßnahmen, Kategorie, Tags (case-insensitive).
- `tests/validation/validation-filters.test.ts` (neu): 6 Fälle (leerer Filter, Volltextfelder, Einzelfilter, AND-Kombination, „mir zugewiesen" inkl. null-User, Optionsableitung).
- `apps/web/src/pages/Validation.tsx`: einzelnes Textfeld → kompakte, responsive Filterleiste (Suche + Selects Wissensart/Kategorie/Tag + Checkbox „Mir zugewiesen"); Filterung über `matchesValidationFilter` mit `useSession().user?.id`. Optionen aus geladenen Board-Items.
- `apps/web/src/i18n.ts`: neue Keys DE/EN `val.filterAllTypes`, `val.filterAllCategories`, `val.filterAllTags`, `val.filterMine`.
- `docs/frontend-fortschritt.md`: 9. Batch ergänzt.
### Nicht geändert
- Board-Karten, Rating-Buttons (Grün/Gelb/Rot) und Zuweisungs-Select: unverändert, keine Regression.
- Keine Backend-/Service-/Schema-Änderung; kein Status-Filter neu erfunden (Board liefert offene KOs).
- Capture/DOCX/PDF/OCR, `Capture.tsx`, `files.ts`, `docx.ts`: nicht angefasst.
- package.json/package-lock/tsconfig: unverändert. Keine Trust-/Rating-/Assign-Logik geändert.
### Erfüllte Akzeptanzkriterien
- Mehrere Filter kombinierbar (AND) — getestet.
- Volltext findet Treffer über Titel, Aussage, Bedingungen, Maßnahmen, Kategorie, Tags — getestet.
- Typ-/Kategorie-/Tag-Filter einzeln und kombiniert — getestet.
- „Mir zugewiesen" über `assignments.includes(user.id)` — getestet; null-User bricht nicht (zeigt dann keine „mir"-Treffer).
- Leere Filter zeigen dieselbe Liste wie vorher.
- Bewertung Grün/Gelb/Rot und Zuweisung unverändert.
- i18n DE/EN vollständig. Kein Stufe-2-/Demo-Fake.
### Checks
- `npm run build` (= `tsc --noEmit`, Root): grün. Zusätzlich apps/web `tsc --noEmit`: grün.
- `npm run lint` (`biome check .`, 170 Dateien): grün.
- `npm run arch` (`depcruise services`, 114 Module): keine Verstöße. Zusätzlich `depcruise apps/web/src` (63 Module): keine Verstöße.
- `npm run test` (`vitest run`): 20 Dateien / 112 Tests grün (inkl. neuer 6 Filtertests).
- Nicht aus meiner Umgebung ausführbar: voller Mac-`npm run check` als End-to-End-Lauf inkl. `vite build` (kein Mac-Zugriff; `vite build` nicht in Sandbox) und `git push` (`.git` schreibgeschützt). Ersatz: oben genannte Einzelläufe (Root-tsc, apps/web-tsc, biome, depcruise services+FE, volle vitest-Suite) — alle grün.
### Offene Punkte / Grenzen
- Finaler Mac-`npm run check` durch Stakeholder als verbindliches Gate.
- Filterung clientseitig auf den geladenen Board-Items (bewusst, ohne Server-Roundtrip) — passend zur Board-Größe; serverseitige Filter wären erst bei sehr großen Boards nötig.
### Jira-Hinweis
- Keine Checkbox/kein Status geändert.
- Vorschlag für Codex/Peter nach grünem Gate: FE-VAL-02 kann als gebaut/getestet bewertet werden, sofern alle Gates grün sind.

---

## SCRUM-103 / FE-VAL-06 — Revisionsfeedback im Validation Board — Nachbericht
Datum: 25.06.2026
### Geändert
- `apps/web/src/lib/validationFeedback.ts` (neu): reiner, DOM-freier Helfer — `feedbackPrefix(verdict)`, `buildValidationFeedback(verdict, text)` (neutrales Präfix „Validierungsfeedback (Bedingt|Ablehnung): <getrimmter Text>", wirft bei leer), `isFeedbackSubmittable(text)`.
- `tests/validation/validation-feedback.test.ts` (neu): 3 Fälle (Präfix, Aufbau/Trim, leeres Feedback verweigert).
- `apps/web/src/pages/Validation.tsx`: Gelb/Bedingt + Rot/Ablehnen öffnen pro KO ein kompaktes Pflicht-Feedbackfeld (Wrapper-`div` um die bestehende `Card`, Card-Layout selbst unverändert). Submit → erst `endpoints.ko.act(id,{action:"comment",text})`, dann `…{action:"rate",verdict}`, dann `invalidate()` + Form schließen/Reset. Submit deaktiviert bei leerem/whitespace Text und während Pending; Abbrechen vorhanden; aktiver Verdict am Button via Ring markiert; minimale Fehleranzeige bei Mutationsfehler. Grün/Bestätigen unverändert (1 Klick).
- `apps/web/src/i18n.ts`: neue Keys DE/EN `val.feedback.condTitle`, `val.feedback.rejTitle`, `val.feedback.placeholder`, `val.feedback.submit`, `val.feedback.cancel`, `val.feedback.error`.
- `docs/frontend-fortschritt.md`: 10. Batch ergänzt.
### Nicht geändert
- Kein Backend/Service/Schema; kein neuer Status (`rejected`/`review`); keine Notification-/Aufgabenlogik erfunden.
- FE-VAL-02 Filterlogik (`validationFilters.ts`) inhaltlich unverändert; Filterleiste, Zuweisungsselect, Grün-Button, Rating-Mechanik nicht umgebaut.
- Capture/DOCX/PDF/OCR, package.json/lock/tsconfig: unangetastet.
### Erfüllte Akzeptanzkriterien
- Grün funktioniert weiter direkt (1 Klick).
- Gelb und Rot erfordern Feedback (Form mit Pflichttext).
- Leeres/whitespace Feedback nicht absendbar (`isFeedbackSubmittable`; Helper wirft zusätzlich) — getestet.
- Kommentar wird zuerst am KO gespeichert, danach Bewertung ausgeführt, danach Queries invalidiert (`["validation"]`).
- Nach Erfolg: Form schließt, Text zurückgesetzt; Board aktualisiert.
- Bestehende Filter/Zuweisung/Rating regressieren nicht; i18n DE/EN vollständig.
- Kein Stufe-2-/Demo-Fake.
### Checks
- `npm run build` (`tsc --noEmit`, Root): grün.
- `npm run lint` (`biome check .`): grün.
- `npm run arch` (`depcruise services`): keine Verstöße. Zusätzlich `depcruise apps/web/src`: keine Verstöße.
- `npm run test` (`vitest run`): 21 Dateien / 115 Tests grün (inkl. 3 neue Feedback-Tests). Gesamtlauf via `npm run check` exit 0.
- Aus meiner Umgebung nicht ausführbar: `vite build` (nicht Teil von `npm run check`) und `git push` (`.git` schreibgeschützt). Ersatz: vollständiger `npm run check` lief grün in der Sandbox.
### Offene Punkte / Grenzen
- **Restlücke (nicht improvisiert):** Eine echte „Rückgabe an Autor" als eigene Aufgabe/Status trägt das aktuelle Backend nicht. Das Feedback ist als nachvollziehbarer KO-Kommentar persistiert (im KO-Detail sichtbar); eine Aufgaben-/Status-Rückgabe wäre ein separates Backend-Ticket.
- Präfix bewusst neutral/fix (nicht i18n), damit der gespeicherte Kommentar sprachunabhängig als Validierungsfeedback erkennbar bleibt.
### Jira-Hinweis
- Keine Checkbox/kein Status geändert.
- Vorschlag für Codex/Peter nach grünem Gate: FE-VAL-06 kann nur dann abgehakt werden, wenn Feedback-Kommentar + Bewertung nachweislich funktionieren. Eine echte Autor-Rückgabe als separate Aufgabe/Status bleibt Restlücke (Backend trägt sie nicht).

---

## SCRUM-103 — Evidence-Sync Validation Board — Nachbericht
Datum: 25.06.2026
### Arbeitsbaum / Ausgangsstand
- Commit: 3951f2f ("feat(web): add required validation feedback for warn and reject").
- git status: clean (nur ignorierte `vitest.config.ts.timestamp-*.mjs`). Reiner Read-only-Audit, kein Code geändert.
### Prüfergebnis je Checkbox
#### FE-VAL-01 · Board: Arbeitsliste offener Objekte
- Bewertung: gebaut JA.
- Code-Evidenz: `services/validation/src/service.ts` `board()` → `koService.list({ status: "offen" })`; `apps/web/src/pages/Validation.tsx` via `useValidationBoard`.
- Test-Evidenz: `services/validation/src/service.test.ts` FR-VAL-03 (validierte KOs erscheinen nicht mehr im Board) + FR-VAL-04 (Board filtert, nur offene); Integration `services/app/src/build-app.test.ts` GET `/api/validation/board` → 200.
- Jira-Empfehlung: darf gesetzt werden.
#### FE-VAL-03 · Bewertung (Grün/Gelb/Rot) → Trust-Update
- Bewertung: gebaut JA (mit Hinweis).
- Code-Evidenz: `services/validation/src/trust.ts` `computeOutcome` (trust = clamp((up−down)/n·100), status offen|validiert); `service.ts` `rate` persistiert `outcome.trust`/`outcome.status`; FE-Buttons in `Validation.tsx`.
- Test-Evidenz: `service.test.ts` FR-VAL-01 (rote Bewertung senkt Trust, hält offen), FR-VAL-02 (n grün → validiert), FR-VAL-01/02 (zwei grün validieren), FR-AUD-01 (Audit); Integration build-app `rate` → 200.
- Jira-Empfehlung: darf gesetzt werden. Hinweis/Grenze: „Gelb/warn" ist in der aktuellen Trust-Formel neutral (zählt, ändert Trust nicht). Falls „Gelb senkt Trust" fachlich gefordert ist, wäre das ein eigenes kleines Ticket — sonst Designentscheidung ok.
#### FE-VAL-04 · Statuswechsel pending→review→validated/rejected
- Bewertung: TEILWEISE / Scope-Mismatch.
- Code-Evidenz: Kern-Enum ist nur `offen | validiert` (`apps/web/src/api/types.ts:12`, `services/validation/src/trust.ts`). Feinere Stufen sind reine Anzeige: `services/knowledge-object/src/display-status.ts` + `apps/web/src/lib/displayStatus.ts` leiten entwurf/pruefung/validiert/abgelehnt/revalidierung/konflikt ab. „review" = `pruefung` (aus `assignments.length>0`); „rejected/abgelehnt" nur über `rejected`-Flag, das im Code NIRGENDS auf true gesetzt wird (kein Live-Trigger; `KnowledgeDetail.tsx:199` ruft `deriveStatus(ko)` ohne Flags).
- Test-Evidenz: `services/knowledge-object/src/display-status.test.ts` prüft nur die Mapping-Funktion, nicht echte Statuswechsel.
- Jira-Empfehlung: NICHT als vollständig abhaken → teilweise. Restlücke: echtes Statusmodell pending→review→validated→rejected fehlt; „rejected" hat keinen Backend-Trigger. Eigenes Ticket für echtes Statusmodell oder Scope-Klärung (nicht improvisiert).
#### FE-VAL-05 · Zuweisung zur Validierung (Controller)
- Bewertung: gebaut JA.
- Code-Evidenz: `services/validation/src/service.ts` `assign()` → `assignments.create({status:"open"})` + Audit `ko.assigned`; `services/app/src/routes/ko-routes.ts` `case "assign"`; FE-Select in `Validation.tsx` (`action:"assign", userIds`).
- Test-Evidenz: `service.test.ts` FR-VAL-05 (Zuweisung wird durch Bewertung erledigt), FR-VAL-06 (Übersicht offen/erledigt pro Person); Integration build-app `assign`-Payload.
- Jira-Empfehlung: darf gesetzt werden.
#### FE-VAL-07 · Sichtbare Rückkehr „validiert → erneut in Prüfung"
- Bewertung: TEILWEISE (Bausteine vorhanden, dedizierter Nachweis dünn).
- Code-Evidenz: (a) Status-Reset: `services/knowledge-object/src/service.ts` `revise` setzt validiert→offen + trust 0; ausgelöst u. a. über `revalidate`→`services/lifecycle/src/service.ts` `confirmStillValid` (= `revise`). (b) Sichtbarkeit: `apps/web/src/pages/Lifecycle.tsx` listet Pending-KOs mit `StatusPill status="revalidierung"` + „Noch gültig"-Aktion; `displayStatus` liefert „revalidierung" bei validiert + revalidation-Flag.
- Test-Evidenz: `knowledge-object/src/service.test.ts` FR-KO-04 (revise: version+1, trust→0, status→offen) belegt den Reset; `display-status.test.ts` belegt das „revalidierung"-Mapping. KEIN End-to-End-Test, der die sichtbare Rückkehr validiert→Board/Lifecycle in einem Lauf prüft.
- Jira-Empfehlung: NICHT ohne dedizierten Nachweis abhaken → teilweise. Grenzen: (1) der Trigger, der KOs in die Lifecycle-Pending-Liste bringt, ist die periodische Re-Validierung (FR-LIF), keine Validation-Board-Aktion; (2) `KnowledgeDetail.tsx` ruft `deriveStatus(ko)` ohne revalidation-Flag → „revalidierung"-Pill erscheint im Detail nicht, nur (hartkodiert) in Lifecycle. Empfehlung: entweder einen Integrationstest „validiert → revalidierung sichtbar" ergänzen und den revalidation-Flag im Detail anbinden, oder den FE-VAL-07-Scope auf die Lifecycle-Sichtbarkeit präzisieren.
### Checks
- `npm run check`: grün (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests). Kein `vite build` (nicht Teil von `npm run check`); kein `git push` (Read-only-Audit, ohnehin keine Änderung).
### Offene Lücken / Resttickets
- FE-VAL-04: echtes Statusmodell pending→review→validated→rejected fehlt (Kern = offen|validiert); „rejected" ohne Backend-Trigger → eigenes Ticket / Scope-Klärung.
- FE-VAL-07: dedizierter sichtbarer Pfad + Test „validiert → erneut in Prüfung" (Detail-Pill-Anbindung oder Scope-Präzisierung).
- FE-VAL-06: echte Autor-Rückgabe als Aufgabe/Status bereits ausgelagert (SCRUM-124).
### Jira-Hinweis für Codex/Peter
- Welche Checkboxen dürfen gesetzt werden: FE-VAL-01, FE-VAL-03 (mit warn-Hinweis), FE-VAL-05.
- Welche bleiben offen: FE-VAL-04 (Scope-Mismatch), FE-VAL-07 (Nachweis dünn), FE-VAL-06 (SCRUM-124).
- Welche Kommentare/Resttickets sind nötig: FE-VAL-04 → Statusmodell-/Scope-Ticket; FE-VAL-07 → Test+Detail-Anbindung oder Scope-Präzisierung; optional FE-VAL-03 → Klärung, ob „Gelb" Trust beeinflussen soll. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-104 — Evidence-Sync Conflict Board — Nachbericht
Datum: 25.06.2026
### Arbeitsbaum / Ausgangsstand
- Commit: ed01ab5 ("docs(qm): add SCRUM-103 validation evidence audit").
- git status: clean (nur ignorierte `*.timestamp-*.mjs`). Reiner Read-only-Audit, kein Code geändert.
### Prüfergebnis je Checkbox
#### FE-CON-01 · Konflikt-Board: offene Fälle
- Bewertung: gebaut JA.
- Code-Evidenz: `services/conflicts/src/service.ts` `unresolved()`/`badgeCount()`; `services/app/src/routes/conflicts-routes.ts` `GET /api/conflicts` (→ unresolved); FE `apps/web/src/pages/Conflicts.tsx` listet via `useConflicts`. Zusätzliche Sichtbarkeit: Sidebar-Badge `apps/web/src/app/useNavBadges.ts` (`conflicts: conflicts.data?.length`), Notification-Feed `services/app/src/notification-feed.ts` (`buildNotifications` → kind "conflict"), Aufgabenliste `apps/web/src/pages/MyTasks.tsx` (Konflikte als Tasks → `/konflikte`).
- Test-Evidenz: `services/conflicts/src/service.test.ts` FR-CON-04 (ungelöste werden gelistet, Badge zählt korrekt: 2→1 nach resolve); `services/app/src/notification-feed.test.ts` (aggregiert Konflikte, neueste zuerst).
- Jira-Empfehlung: darf gesetzt werden.
#### FE-CON-02 · Gegenüberstellung widersprüchlicher Positionen + Quellen
- Bewertung: TEILWEISE / offen.
- Code-Evidenz: `Conflicts.tsx` zeigt `c.type` (Pill), `c.description` und **koA/koB nur als rohe IDs** im „vs"-Layout (Zeilen 78–86). Es werden NICHT die Aussagen/Bedingungen/Quellen der beiden KOs geladen und gegenübergestellt.
- Test-Evidenz: keine (es gibt nichts Inhaltliches zu testen).
- Jira-Empfehlung: NICHT setzen. Gemäß Bewertungsregel teilweise/offen, da nur IDs statt nachvollziehbarer Positionen + Quellen. Restticket: KO A/B laden und Aussagen/Quellen gegenüberstellen.
#### FE-CON-03 · Konflikt-Klassifikation (Kontext/Zeit/Rolle/Erfahrung/Wahrheit)
- Bewertung: gebaut JA.
- Code-Evidenz: Enum `ConflictType = truth|experience|context|temporal|role` (`services/conflicts/src/types.ts`); Erfassung im Create-Formular `KnowledgeDetail.tsx` (`CONFLICT_TYPES` mit allen 5, Typ-Select); Anzeige als Pill `con.type.${c.type}` in `Conflicts.tsx`.
- Test-Evidenz: `service.test.ts` FR-CON-01 (klassifizierter Konflikt, `type` = "context"); weitere Tests nutzen `type:"truth"`.
- Jira-Empfehlung: darf gesetzt werden.
#### FE-CON-04 · Eskalation (nur Wahrheitskonflikt zwingend)
- Bewertung: gebaut JA (Service + UI).
- Code-Evidenz: Service `escalate()` wirft `NOT_ESCALATABLE` für `type !== "truth"` (`service.ts`); Route `POST /api/conflicts/:id/escalate`. UI: Eskalations-Button nur bei `c.type === "truth" && c.status === "offen"` (`Conflicts.tsx:120`); Eskalationspfad nur für truth gerendert.
- Test-Evidenz: `service.test.ts` FR-CON-02 (truth eskaliert; Nicht-Wahrheit → `NOT_ESCALATABLE`).
- Jira-Empfehlung: darf gesetzt werden.
#### FE-CON-05 · Zweitmeinung einholen
- Bewertung: gebaut JA.
- Code-Evidenz: Service `secondOpinion()` speichert `secondOpinion` + Status `zweitmeinung` (`service.ts`); Route `POST /api/conflicts/:id/second-opinion`; UI Textarea + Confirm (`Conflicts.tsx:153–174`) und Anzeige `c.secondOpinion` (Zeilen 111–116).
- Test-Evidenz: `service.test.ts` FR-CON-03 (Eskalation → Zweitmeinung → Entscheidung; `secondOpinion` gespeichert/geprüft) + Audit-Lebenszyklus (`conflict.second-opinion`).
- Jira-Empfehlung: darf gesetzt werden.
#### FE-CON-06 · Auflösung + sichtbare Wirkung auf Status/Trust
- Bewertung: TEILWEISE / offen.
- Code-Evidenz: Auflösung gebaut: Service `resolve()` setzt `status:"geloest"` + `decidedBy`/`decision` (`service.ts`); Route via KO-Dispatcher `case "resolve-conflict"` (`ko-routes.ts`); UI zeigt Entscheidung (`Conflicts.tsx:147–151`). **ABER: keine Wirkung auf KO-Status/Trust** — der Conflict-Service mutiert nur das Conflict-Objekt, kein `revise`/`rate`/Trust am KO (grep bestätigt: kein KO-Trust/Status-Effekt). Das FE invalidiert zwar `["kos"]`, der Server ändert am KO aber nichts; die `konflikt`-Pill ist im KO-Detail nicht angebunden (`deriveStatus(ko)` ohne `conflict`-Flag).
- Test-Evidenz: `service.test.ts` FR-CON-03/04 belegen nur Konfliktstatus/Entscheidung, KEINE KO-Status-/Trust-Wirkung.
- Jira-Empfehlung: NICHT setzen. Gemäß Bewertungsregel teilweise/offen, da nur Entscheidung/`geloest` sichtbar, aber keine belegte Status-/Trust-Wirkung am KO. Restticket: definierte Wirkung der Auflösung auf KO-Status/Trust (Backend + Test) und ggf. `konflikt`-Pill im KO-Detail anbinden.
### Checks
- `npm run check`: grün (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests). Kein `vite build` (nicht Teil von `npm run check`); kein `git push` (Read-only-Audit).
### Offene Lücken / Resttickets
- FE-CON-02: UI lädt/gegenüberstellt KO A/B inhaltlich (Aussagen + Quellen) statt nur IDs → Restticket.
- FE-CON-06: Auflösung mit definierter Wirkung auf KO-Status/Trust (Backend-Logik + Test); optional `konflikt`-Pill im KO-Detail anbinden → Restticket.
### Jira-Hinweis für Codex/Peter
- Welche Checkboxen dürfen gesetzt werden: FE-CON-01, FE-CON-03, FE-CON-04, FE-CON-05.
- Welche bleiben offen: FE-CON-02 (nur IDs, keine Positionen/Quellen), FE-CON-06 (keine KO-Status-/Trust-Wirkung).
- Welche Kommentare/Resttickets sind nötig: FE-CON-02 → KO-Gegenüberstellung mit Quellen; FE-CON-06 → KO-Status/Trust-Wirkung bei Auflösung + Test. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-102 — Evidence-Sync Wissensobjekt-Detail — Nachbericht
Datum: 25.06.2026
### Arbeitsbaum / Ausgangsstand
- Commit: 2b62167 (lokal HEAD ed01ab5 + uncommitted Audit-Reports; Mac-Push 2b62167 lt. Auftrag). git status: nur `docs/qm/claude-after-report.md` (Audit-Berichte, uncommitted); kein Produktcode geändert. Reiner Read-only-Audit.
### Prüfergebnis je Checkbox
#### FE-KO-01 · Vollständige Anzeige (Aussage/Bedingungen/Maßnahmen/Tags/Quellen/Asset)
- Bewertung: TEILWEISE.
- Code-Evidenz: `apps/web/src/pages/KnowledgeDetail.tsx` zeigt Aussage (`ko.statement`), Bedingungen, Maßnahmen, Tags, Asset (Header `· ${ko.asset}`), Confidence, Provenance-Karte (`ProvenanceLine`: author/originalAuthor/domain/version), Anhänge. ABER: **kein echtes „Quellen"-Feld** — `KnowledgeObject` (`apps/web/src/api/types.ts`, `services/knowledge-object/src/types.ts`) hat kein `sources`; `sources`/`sourceId` existieren nur an `AnswerResult`/`AnswerStep` (Ask), nicht am KO.
- Test-Evidenz: `services/knowledge-object/src/service.test.ts` FR-KO-01 (KO mit allen Pflichtfeldern).
- Jira-Empfehlung: NICHT setzen (gemäß Regel teilweise: echte Quellen/Provenance-Quellen fehlen, nur Autor/Originalautor/Asset/Domain). Restticket: KO-Quellenfeld.
#### FE-KO-02 · Wiki-/Confluence-artige Seitenstruktur
- Bewertung: TEILWEISE.
- Code-Evidenz: strukturierte Detailseite mit Abschnitten (Aussage/Bedingungen/Maßnahmen/Tags) + getrennten Karten für Provenance, Historie, Kommentare, Anhänge (`KnowledgeDetail.tsx`). Das deckt „Abschnitte + Historie/Kommentare/Provenance" ab, aber KEINE echte Wiki-Mechanik (verlinkte Seiten, Freitext-/Confluence-Hierarchie, Seitenbaum).
- Test-Evidenz: indirekt über FR-KO-04 (Historie) / FR-KO-06 (Kommentare); kein Wiki-spezifischer Test.
- Jira-Empfehlung: Codex-Entscheidung. Aus QM-Sicht teilweise → eher NICHT setzen ohne Scope-Klärung, ob die strukturierte Detailseite + Historie/Kommentare/Provenance als „Wiki" genügt. Sonst Restticket für echte Wiki-Mechanik.
#### FE-KO-03 · Inline-/geführte Bearbeitung
- Bewertung: gebaut JA.
- Code-Evidenz: Edit-Modus in `KnowledgeDetail.tsx` (Titel/Aussage/Typ/Kategorie/Bedingungen/Maßnahmen/Tags) → `revise` + `tags` + `category` (`ko-routes.ts`); `ListEditor`/`TagEditor`.
- Test-Evidenz: `service.test.ts` FR-KO-03 (Kategorie/Tags nachträglich änderbar/filterbar) + FR-KO-04 (revise).
- Jira-Empfehlung: darf gesetzt werden.
#### FE-KO-04 · Versionierung & Historie
- Bewertung: gebaut JA.
- Code-Evidenz: `ko.version` im Header; Historie-Karte listet `ko.history` (Version/Datum/Note/Autor); Backend `revise` erhöht Version + schreibt History.
- Test-Evidenz: `service.test.ts` FR-KO-04 (Version+1, Bewertungen zurückgesetzt, History-Länge 2) + „protokolliert Anlegen und Überarbeiten".
- Jira-Empfehlung: darf gesetzt werden.
#### FE-KO-05 · Fünf Wissensarten sichtbar
- Bewertung: gebaut JA.
- Code-Evidenz: `apps/web/src/components/trust/types.ts` `KNOWLEDGE_TYPES` = bauchgefuehl/best_practice/lernkurve/technik/negativwissen (= intuition/practice/evolution/tech/negative); Anzeige via `KnowledgeTypeTag`; Auswahl im Edit-Select.
- Test-Evidenz: `service.test.ts` FR-KO-02 (Wissensart setzbar/filterbar; unbekannte abgewiesen).
- Jira-Empfehlung: darf gesetzt werden.
#### FE-KO-06 · Objekt-Aktionen
- Bewertung: TEILWEISE (Sammel-Checkbox, einige Teilfunktionen fehlen).
- Teilfunktionen:
  - validieren: JA — `act.mutate({action:"rate",verdict})` (Controller/Admin) in `KnowledgeDetail.tsx`; Test FR-VAL-01/02 (validation).
  - kommentieren: JA — `comment`-Aktion + Liste/Eingabe; Test FR-KO-06.
  - Beitrag/Quelle: FEHLT — keine Aktion „Beitrag"/„Quelle"; `attach` ist nur Bild-Thumbnail (`image/*`), keine Quellenangabe.
  - Konflikt: JA — Konflikt-Formular (`action:"conflict"`, alle 5 Typen); Test FR-CON-01.
  - hat geholfen: NICHT im KO-Detail — existiert nur in `Ask.tsx` (`/api/ask/helpful`, FR-ASK-04), nicht als Aktion auf der Detailseite.
  - noch gültig: JA — `act.mutate({action:"revalidate"})` Button „stillValid".
- Code-Evidenz: `KnowledgeDetail.tsx` (rate/comment/conflict/revalidate); `apps/web/src/api/endpoints.ts` `KoAction` (kein „helped"/„source"/„contribution").
- Test-Evidenz: FR-KO-06 (Kommentare), FR-CON-01 (Konflikt), FR-VAL (rate), FR-KO-04 (revalidate-Reset).
- Jira-Empfehlung: NICHT setzen (Beitrag/Quelle fehlt; „hat geholfen" nicht im Detail). Sammel-Checkbox bleibt offen.
#### FE-KO-07 · Externe Quelle anhängen („nicht peer-validiert", Stufe 2)
- Bewertung: nein / offen (Stufe 2).
- Code-Evidenz: nur Bild-Thumbnail-Anhang (`attach`/`detach`, `image/*`, Client-Thumbnail). KEINE „externe Quelle" mit „nicht peer-validiert"-Markierung im Modell/UI.
- Test-Evidenz: FR-CAP-05 (Anhänge anfügen/entfernen) — betrifft nur Bilder, nicht externe Quellen.
- Jira-Empfehlung: NICHT setzen. Stufe-2-Restticket (überlappt mit FE-KO-01 Quellenfeld).
### Checks
- `npm run check`: grün (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests). Kein `vite build` (nicht Teil von `npm run check`); kein `git push` (Read-only-Audit).
### Offene Lücken / Resttickets
- FE-KO-01: KO-Quellenfeld (echte Quellen/Provenance-Quellen) am Modell + Anzeige.
- FE-KO-02: echte Wiki-Mechanik oder Scope-Klärung „strukturierte Detailseite = Wiki".
- FE-KO-06: Teilfunktionen „Beitrag/Quelle" am KO + „hat geholfen" im Detail anbinden (oder Scope: helpful zählt via Ask).
- FE-KO-07: externe Quelle mit „nicht peer-validiert"-Markierung (Stufe 2; überlappt FE-KO-01).
### Jira-Hinweis für Codex/Peter
- Welche Checkboxen dürfen gesetzt werden: FE-KO-03, FE-KO-04, FE-KO-05.
- Welche bleiben offen: FE-KO-01 (Quellen fehlen), FE-KO-02 (teilweise/Scope), FE-KO-06 (Teilfunktionen fehlen), FE-KO-07 (Stufe 2).
- Welche Kommentare/Resttickets sind nötig: KO-Quellenfeld (FE-KO-01/07), „Beitrag/Quelle"+„hat geholfen" im Detail (FE-KO-06), Wiki-Mechanik/Scope (FE-KO-02). Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-101 Evidence-Audit — Reasoner-Assistenz
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD 1eff5a4; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### FE-RSN-01 · Strukturierung Rohtext → Wissensobjekt
- Ergebnis: gebaut JA (Service + UI + Test).
- Code-Evidenz: Route `services/app/src/routes/reasoner-routes.ts` `task:"structure"` → `reasoner.structure(text)` (→ KO-Vorschlag `StructureResult`). FE: `apps/web/src/api/endpoints.ts` `reasoner.structure`; `apps/web/src/pages/Capture.tsx` `structure`-Mutation (Button „Mit Reasoner strukturieren", Z. 109/401) → Entwurf wird im rechten Panel in `ReasonerDraft` geprüft/korrigiert.
- Test-Evidenz: `services/reasoner/src/service.test.ts` FR-RSN-01 (structure verfügbar/liefert Ergebnis); `services/reasoner/src/provider-model.test.ts` („structure parst das Modell-JSON, demo=false").
- Jira-Empfehlung: darf gesetzt werden.
### FE-RSN-02 · Interview-Turns zur Vervollständigung
- Ergebnis: TEILWEISE / offen.
- Code-Evidenz: Interview existiert als **deterministischer** Capture-Flow — `apps/web/src/pages/Capture.tsx` (Modus „interview", feste `IV_STEPS` title/statement/conditions/measures/tags, `ivAdvance`) und `services/capture/src/interview.ts` (Kommentar: „Deterministische Variante (ohne Modell); der Reasoner kann …"). KEINE Reasoner-Anbindung der Interview-Turns (kein `/api/reasoner`-Call im Interviewpfad).
- Test-Evidenz: `services/capture/src/service.test.ts` „InterviewSession (FR-CAP-02): stellt eine Frage pro Schritt …" — belegt den deterministischen Flow, NICHT reasoner-getriebene Turns.
- Jira-Empfehlung: NICHT setzen (gemäß Regel 3: deterministischer Capture-Interviewflow ohne Reasoner-Anbindung → teilweise/offen). Restticket: echte reasoner-getriebene Interview-Turns (eigener Endpunkt + Test).
### FE-RSN-03 · Textverbesserung/Präzisierung
- Ergebnis: gebaut JA (Service + UI + Test).
- Code-Evidenz: Route `reasoner-routes.ts` `task:"assist"` → `reasoner.assistText(text)`. FE: `endpoints.ts` `reasoner.assist`; `Capture.tsx` `assistRaw` (KI-Hilfe auf Rohtext, Z. 119/367) **und** `assistStatement` (KI-Hilfe auf Aussage, Z. 128/613).
- Test-Evidenz: `service.test.ts` FR-RSN-03 („assistText glättet deterministisch ohne Inhalt zu erfinden") + Fallback-/Fehlerfälle (FR-RSN-04: Laufzeitfehler → deterministischer Fallback, `assisted` demo=true).
- Jira-Empfehlung: darf gesetzt werden (auch wenn als Stufe 2 markiert — real angebunden + getestet).
### FE-RSN-04 · UI-Kennzeichnung Entwurf vs. Empfehlung vs. validiert
- Ergebnis: gebaut JA (UI gebaut, Status-Backbone getestet).
- Code-Evidenz: `apps/web/src/components/trust/ReasonerDraft.tsx` markiert Reasoner-Inhalte IMMER als Entwurf (gestrichelter violetter Rahmen, „✦", Label `reasoner.draftLabel` = „Reasoner-Entwurf · nicht validiert"); genutzt in `Capture.tsx` (Z. 596–640, Entwurfs-Review). Validiert/Status getrennt über `StatusPill`/`KnowledgeTypeTag`/`deriveStatus`. Serverseitiger Reasoner-Status in `shell/Topbar.tsx` (`ReasonerStatusPill`, `useReasonerStatus`, aktiv/offline).
- Test-Evidenz: Status-Backbone getestet — `service.test.ts` FR-RSN-04/05 (Status spiegelt Modellverfügbarkeit: offline/Fallback vs. model). `ReasonerDraft` selbst ist eine rein präsentationale Komponente ohne eigenen Test (FE hat generell keine Komponententests).
- Jira-Empfehlung: darf gesetzt werden. Hinweis: kein dedizierter FE-Komponententest für die Draft-Kennzeichnung (nur visuell/Status-getestet) — falls QM Komponententest verlangt, kleiner Restpunkt.
### Offene Restlücken / Resttickets
- FE-RSN-02: echte reasoner-getriebene Interview-Turns (Backend-Endpunkt + Anbindung im Capture-Interview + Test). Aktuell deterministisch.
- FE-RSN-04 (optional): FE-Komponententest für die Reasoner-Entwurf-Kennzeichnung, falls gefordert.
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: FE-RSN-01, FE-RSN-03, FE-RSN-04.
- Checkboxen, die offen bleiben: FE-RSN-02 (teilweise — deterministisch, ohne Reasoner-Anbindung).
- Empfohlene Resttickets: reasoner-getriebene Interview-Turns (FE-RSN-02); optional FE-Komponententest (FE-RSN-04).
- Statusvorschlag für SCRUM-101: von „To Do" auf „In Progress/In Review" — 3 von 4 Checkboxen erfüllt; Done erst nach FE-RSN-02. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-106 Evidence-Audit — Risiko / Gaps / Wissensgraph
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD f3eb3fa; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### FE-RISK-01 · Gaps-Dashboard
- Ergebnis: gebaut JA.
- Code-Evidenz: `apps/web/src/pages/Risk.tsx` zeigt offene Gaps (`useGaps`, Liste mit Frage/Status). API `GET /api/gaps` (`services/app/src/routes/ask-routes.ts`) → `ask.listGaps()` (`services/ask/src/service.ts`). Gap entsteht aus unbeantworteter Ask-Frage (`createGap`).
- Test-Evidenz: `services/ask/src/service.test.ts` FR-ASK-03 (ohne Grundlage entsteht Wissenslücke; `listGaps` Länge 1).
- Jira-Empfehlung: darf gesetzt werden.
### FE-RISK-02 · Gap zuweisen/priorisieren/schließen/löschen
- Ergebnis: TEILWEISE.
- Code-Evidenz: zuweisen/schließen/löschen gebaut — `Risk.tsx` (Assign-Select, Close-Button, Delete-Button); `endpoints.gaps` (`assign`/`close`/`remove`); `PUT /api/gaps/:id` + `DELETE /api/gaps/:id?confirm=true` (`ask-routes.ts`); Service `assignGap`/`closeGap`/`deleteGap`. **Priorisieren FEHLT** — kein `priority`-Feld am `Gap` (`apps/web/src/api/types.ts`, `services/ask/src/types.ts`), kein Endpoint/UI.
- Test-Evidenz: `services/ask/src/service.test.ts` (Gap-Lebenszyklus: `assignGap`→assignee, `closeGap`→geschlossen, `deleteGap` mit confirm). Kein Priorisieren-Test (existiert nicht).
- Jira-Empfehlung: NICHT setzen (gemäß Regel 3: Priorisieren fehlt → teilweise). Restticket: Gap-Priorität (Feld + Endpoint + UI + Test).
### FE-RISK-03 · Bus-Faktor / Single-Expert-Risiko sichtbar
- Ergebnis: gebaut JA (datenbasiert).
- Code-Evidenz: `services/library-analytics/src/service.ts` `busFactor()` liefert je Kategorie `koCount`/`authorCount`/`singleSource` (datenbasiert, kein statischer Text). `GET /api/analytics/busfactor` (`library-routes.ts`). `Risk.tsx` rendert Balken; `singleSource` → rot, sonst grün; Experten-Anzahl.
- Test-Evidenz: `services/library-analytics/src/service.test.ts` FR-LIB-03 (Bus-Faktor erkennt Einzelquellen; `singleSource === true`).
- Jira-Empfehlung: darf gesetzt werden.
### FE-RISK-04 · Risiko-Cockpit nach Bereichen/Domänen
- Ergebnis: TEILWEISE.
- Code-Evidenz: `Risk.tsx` zeigt Bus-Faktor je Kategorie (Domäne) + Gap-Liste. Es gibt KEIN eigenständiges, mehrdimensionales „Risiko-Cockpit nach Bereichen/Domänen" (z. B. aggregierte Risikometriken je Bereich) — nur die Bus-Faktor-Balken (nach Kategorie) und die Gap-Liste.
- Test-Evidenz: nur Bus-Faktor (FR-LIB-03); kein Cockpit-spezifischer Test.
- Jira-Empfehlung: NICHT setzen (gemäß Regel 5: Bus-Faktor-Balken/Gap-Liste sind nur Teilmenge). Restticket: echtes Risiko-Cockpit nach Bereichen/Domänen.
### FE-RISK-05 · Knowledge Graph (SVG aus Live-Daten, Stufe 2)
- Ergebnis: TEILWEISE / offen.
- Code-Evidenz: Daten + Endpoint vorhanden — `library.graph()` baut Knoten/Kanten aus gemeinsamen Tags (`service.ts`, FR-LIB-04); `GET /api/graph`; `useGraph`. ABER UI `apps/web/src/pages/Stufe2.tsx` `GraphView` rendert eine **textuelle Kantenliste** (`{e.a} —{e.via}→ {e.b}`), KEIN SVG/Graph-Visualisierung; als Stufe 2 (SCRUM-119) gekennzeichnet. Zusätzlich (vgl. SCRUM-119-Audit): Graph nur tag-basiert, keine Domänen-/Experten-Beziehungen.
- Test-Evidenz: `library-analytics/src/service.test.ts` FR-LIB-04 (Graph verbindet KOs mit gemeinsamem Tag; nodes/edges) — Datenebene getestet, KEINE SVG-Visualisierung.
- Jira-Empfehlung: NICHT setzen (gemäß Regel 6: nur Liste/minimale Stufe-2-Ansicht → teilweise/offen). Restticket: SVG-Graph aus Live-Daten + Graph-Erweiterung (SCRUM-119).
### Offene Restlücken / Resttickets
- FE-RISK-02: Gap-Priorisierung (Feld `priority` + Endpoint + UI + Test).
- FE-RISK-04: eigenständiges Risiko-Cockpit nach Bereichen/Domänen (mehrdimensional).
- FE-RISK-05: Knowledge-Graph als SVG aus Live-Daten; Graph-Daten um Domänen/Experten erweitern (überlappt SCRUM-119).
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: FE-RISK-01, FE-RISK-03.
- Checkboxen, die offen bleiben: FE-RISK-02 (Priorisieren fehlt), FE-RISK-04 (kein echtes Cockpit), FE-RISK-05 (kein SVG-Graph, Stufe 2).
- Empfohlene Resttickets: Gap-Priorität; Risiko-Cockpit; SVG-Graph (+ Graph-Erweiterung SCRUM-119).
- Statusvorschlag für SCRUM-106: bleibt „In Progress" — 2 von 5 Checkboxen erfüllt. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-107 Evidence-Audit — Bibliothek / Export / Re-Import
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD a1a5ae7; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### FE-LIB-01 · Volltextsuche + strukturierte Filter
- Ergebnis: TEILWEISE.
- Code-Evidenz: Service kann viel — `services/library-analytics/src/service.ts` `search(query, filter: KoFilter)` (Text + Art/Status/Kategorie/Tag); Route `GET /api/library/search?q=&type=&status=&category=&tag=` (`library-routes.ts`). ABER UI `apps/web/src/pages/Library.tsx` filtert nur clientseitig über `k.title` (Substring) + Status-Select (offen/validiert via `useKos`); **kein Art-/Domäne-/Tag-Filter** und es wird NICHT der Server-`/api/library/search`-Endpoint genutzt.
- Test-Evidenz: `service.test.ts` FR-LIB-01 (Suche über Text); Integration `services/app/src/build-app.test.ts` (`/api/library/search?q=überdruck` → 1 Treffer).
- Jira-Empfehlung: NICHT setzen (gemäß Regel 2: Service kann mehr als UI; UI nur Titel + Status). Restticket: UI-Filter Art/Domäne/Tags + Server-Search-Anbindung.
### FE-LIB-02 · Listen-/Detailzugriff
- Ergebnis: gebaut JA.
- Code-Evidenz: `Library.tsx` Liste (`useKos`) mit Status-Pill/Typ/Kategorie/Confidence und `Link to /wissen/:id`; Detailseite `KnowledgeDetail.tsx` (`useKo`, GET `/api/kos/:id`).
- Test-Evidenz: `library-analytics/service.test.ts` FR-LIB-01 (Suche) + Integration build-app (`/api/library/search`); KO-Detail über `knowledge-object/service.test.ts` FR-KO-01 (Erzeugen/Lesen).
- Jira-Empfehlung: darf gesetzt werden.
### FE-LIB-03 · Export JSON / Text-MD / MediaWiki / PDF
- Ergebnis: TEILWEISE (nicht vollständig).
- Code-Evidenz: Service-Export JSON (`exportJson`), MediaWiki (`exportMediaWiki`), HTML (`exportHtml`, druckfertiges HTML) — Route `GET /api/library/export?format=mediawiki|html` (Default JSON). **Text-MD (Markdown) FEHLT**; **echter PDF-Export FEHLT** (HTML ist Browser-Druck-HTML, kein PDF). UI `Library.tsx` bietet nur einen Default-Export-Link (`/api/library/export` → JSON), keine Format-Auswahl (MediaWiki/HTML/MD/PDF nicht in der UI wählbar).
- Test-Evidenz: `service.test.ts` FR-LIB-02 (Export JSON + MediaWiki + HTML; `<!doctype html>`/`<h2>`-Inhalt). Kein MD-/PDF-Test (existiert nicht).
- Jira-Empfehlung: NICHT vollständig setzen (gemäß Regel 4: Text-MD + echter PDF fehlen; Browser-HTML ≠ PDF; UI nur JSON). Restticket: MD-Export + echter PDF-Export + Format-Auswahl in der UI.
### FE-LIB-04 · Re-Import JSON inkl. Merge ohne Dubletten
- Ergebnis: TEILWEISE (Backend gebaut/getestet, UI fehlt — Stufe-2-Grenze).
- Code-Evidenz: Service `importJson(items, author)` mit Duplikat-Überspringen (`imported`/`skipped`) + Audit `library.import`; Route `POST /api/library/import`. **Keine UI/Source-Review** in `Library.tsx` (kein Import-Upload/Review).
- Test-Evidenz: `service.test.ts` FR-LIB-02 „Import ohne Duplikate" (`{imported:1, skipped:1}`) + „protokolliert den Import" (Audit, actor).
- Jira-Empfehlung: NICHT setzen (gemäß Regel 5: Service/API/Test ja, aber UI/Source-Review fehlt — Stufe 2, vgl. SCRUM-116). Restticket: Import-/Source-Review-UI.
### FE-LIB-05 · Re-Validierung aus der Bibliothek starten
- Ergebnis: nein / offen (nicht als Bibliotheksfunktion).
- Code-Evidenz: In `Library.tsx` gibt es KEINE Re-Validierungs-Aktion. Re-Validierung existiert nur im KO-Detail (`KnowledgeDetail.tsx` `act({action:"revalidate"})`) und im Lifecycle (`Lifecycle.tsx`).
- Test-Evidenz: Re-Validierung backseitig über `knowledge-object/service.test.ts` FR-KO-04 (revise/Reset) — aber nicht aus der Bibliothek angestoßen.
- Jira-Empfehlung: NICHT setzen (gemäß Regel 6: nur im Detail/Lifecycle vorhanden, keine Bibliotheksfunktion). Restticket: Re-Validierung-Start aus der Bibliothek (oder Scope-Klärung: zählt via Detail/Lifecycle).
### Offene Restlücken / Resttickets
- FE-LIB-01: UI-Filter Art/Domäne/Tags + Anbindung Server-`/api/library/search`.
- FE-LIB-03: Text-MD-Export + echter PDF-Export + Format-Auswahl in der UI.
- FE-LIB-04: Import-/Source-Review-UI (Stufe 2, vgl. SCRUM-116).
- FE-LIB-05: Re-Validierung-Start aus der Bibliothek (oder Scope-Klärung).
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: FE-LIB-02.
- Checkboxen, die offen bleiben: FE-LIB-01 (UI-Filter unvollständig), FE-LIB-03 (MD+PDF fehlen), FE-LIB-04 (UI fehlt, Stufe 2), FE-LIB-05 (keine Bibliotheksfunktion).
- Empfohlene Resttickets: UI-Filter+Server-Search (FE-LIB-01); MD/PDF-Export+Format-Auswahl (FE-LIB-03); Import-UI (FE-LIB-04); Re-Validierung aus Bibliothek (FE-LIB-05).
- Statusvorschlag für SCRUM-107: „In Progress" — 1 von 5 Checkboxen erfüllt. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-105 Evidence-Audit — Ask / Query Console
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD 6de12b9; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### Kritischer Shape-Check / UI-Funktion
- Backend-Response: `POST /api/ask` sendet `await ask.ask(...)` = **`AskResult = { result: AnswerResult, gap: Gap|null }`** (`services/app/src/routes/ask-routes.ts`, `services/ask/src/service.ts` Z. 42/61/63, `types.ts` `AskResult`).
- Frontend-Erwartung: `apps/web/src/api/endpoints.ts` `ask.ask` ist als **`AnswerResult`** typisiert; `apps/web/src/pages/Ask.tsx` setzt `setResult(r)` und liest direkt `result.answered/answer/trust/steps/sources`.
- Ergebnis: **Shape-Mismatch BESTÄTIGT.** Die echte Antwort ist in `r.result` verschachtelt; `r.answered` ist `undefined` → in `Ask.tsx` immer falsy → es wird **immer die „keine Grundlage"-Karte** gerendert, auch wenn die Frage tatsächlich beantwortet ist. Antwort, Quellen, Trust, Schritte und der „Hat geholfen"-Button werden nie angezeigt. `npm run check`/tsc fängt das NICHT, weil `endpoints` per Generic `<AnswerResult>` castet (Laufzeit-Mismatch, kein Typfehler). Die Integration `build-app.test.ts` prüft nur `statusCode 200`, nicht die FE-Shape.
- Auswirkung auf Checkboxen: UI-abhängige FE-ASK-Punkte (01–05) dürfen trotz grüner Service-Tests NICHT voll gesetzt werden (Regel 8).
### FE-ASK-01 · Betriebliche Frage stellen
- Ergebnis: TEILWEISE.
- Code-Evidenz: UI-Formular + `endpoints.ask.ask` → `POST /api/ask` (API liefert 200). Frage-Senden funktioniert; ABER Ergebnisanzeige durch Shape-Mismatch gebrochen.
- Test-Evidenz: `ask/service.test.ts` FR-ASK-01/02 (begründete Antwort); Integration build-app (`POST /api/ask` → 200).
- Jira-Empfehlung: NICHT voll setzen (Senden ok, Anzeige gebrochen). Abhängig vom Shape-Fix.
### FE-ASK-02 · Relevante Wissensobjekte heranziehen (Retrieval)
- Ergebnis: TEILWEISE.
- Code-Evidenz: Retrieval server-seitig — `ask.ask` baut Refs aus validierten KOs, `reasoner.answer(question, refs)`; Antwort bleibt in Quellen verankert. UI würde Quellen anzeigen, tut es aber wegen Shape-Mismatch nicht.
- Test-Evidenz: `reasoner/provider-model.test.ts` („answer bleibt in den Quellen verankert; Trust/Quellen aus den Daten", `sources` enthält ko1); `ask/service.test.ts` FR-ASK-01/02.
- Jira-Empfehlung: NICHT voll setzen (Retrieval+Test ja, UI-Anzeige gebrochen).
### FE-ASK-03 · Antwort mit Quellen, Evidenz-Level, Konfidenz
- Ergebnis: NICHT setzen / offen.
- Code-Evidenz: `AnswerResult` trägt `sources`, `knowledgeClass` (Evidenz-Level), `trust`. ABER: (a) Shape-Mismatch → in der UI nichts davon sichtbar; (b) selbst bei Fix rendert `Ask.tsx` nur Trust (`ConfidenceBar`) + Quellen-IDs, **nicht** `knowledgeClass`/Evidenz-Level.
- Test-Evidenz: `provider-model.test.ts` (`knowledgeClass === "gesichert"`, sources, trust) — Datenebene ja, UI-Anzeige nein.
- Jira-Empfehlung: NICHT setzen. Restticket: Shape-Fix + Evidenz-Level/KnowledgeClass in der UI anzeigen.
### FE-ASK-04 · Konflikt/Unsicherheit/fehlende Grundlage explizit
- Ergebnis: TEILWEISE.
- Code-Evidenz: Backend-Anti-Halluzination solide — ohne belastbare Quelle keine erfundene Antwort (`answered:false`), Gap entsteht. UI hat eine „keine Grundlage"-Karte, die aber durch den Shape-Mismatch UNZUVERLÄSSIG ist (wird immer angezeigt, auch bei beantworteter Frage).
- Test-Evidenz: `ask/service.test.ts` FR-ASK-03 (keine erfundene Antwort, Gap entsteht); `reasoner/provider-model.test.ts` FR-RSN-03 (ohne Quelle keine Rateantwort, `answered:false`).
- Jira-Empfehlung: NICHT voll setzen (Backend ja+getestet; UI-Trigger durch Shape-Mismatch unzuverlässig). Abhängig vom Shape-Fix.
### FE-ASK-05 · Feedback zur Antwort erfassen
- Ergebnis: TEILWEISE / offen.
- Code-Evidenz: Backend `markHelpful` → Trust hoch + Audit; Route `POST /api/ask/helpful`; UI-Button vorhanden. ABER der „Hat geholfen"-Button liegt im `answered`-Zweig, der wegen Shape-Mismatch nie rendert; zudem greift `result.sources[0]` auf `undefined` zu → faktisch unerreichbar.
- Test-Evidenz: `ask/service.test.ts` FR-ASK-04 („'Hat geholfen' erhöht Trust und erzeugt Audit-Eintrag", `answer.helpful`).
- Jira-Empfehlung: NICHT setzen (Backend ja+getestet, UI durch Shape-Mismatch unerreichbar). Abhängig vom Shape-Fix.
### FE-ASK-06 · Bei fehlendem Wissen Wissenslücke anlegen
- Ergebnis: gebaut JA.
- Code-Evidenz: `ask.ask` legt bei `!answered` server-seitig eine Gap an (`createGap`), unabhängig vom UI-Anzeigefehler; Gap ist in Risiko/Gaps sichtbar/auffindbar (`Risk.tsx` `useGaps`, FE-RISK-01). UI-„keine Grundlage"-Karte verlinkt zu `/risiko`.
- Test-Evidenz: `ask/service.test.ts` FR-ASK-03 (Gap entsteht, `listGaps` Länge 1) + FR-ASK-05 (Gap zuweisen/schließen/löschen); Integration build-app `GET /api/gaps` → 200.
- Jira-Empfehlung: darf gesetzt werden (Gap-Anlage + Auffindbarkeit unabhängig vom Ask-Shape-Bug). Hinweis: optional die erzeugte Gap direkt in der Ask-noBasis-Karte anzeigen.
### Offene Restlücken / Resttickets
- **Ask-Response-Shape-Fix (Hauptpunkt):** `endpoints.ask.ask` muss `{ result, gap }` entpacken (oder Route flach senden). Blockiert die UI-Funktion von FE-ASK-01/02/03/04/05.
- FE-ASK-03: Evidenz-Level/KnowledgeClass in der UI anzeigen (zusätzlich zum Shape-Fix).
- Optional: erzeugte Gap direkt in der Ask-„keine Grundlage"-Karte sichtbar machen.
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: FE-ASK-06.
- Checkboxen, die offen bleiben: FE-ASK-01, FE-ASK-02, FE-ASK-04, FE-ASK-05 (teilweise — durch Response-Shape-Mismatch), FE-ASK-03 (offen — Shape + fehlende Evidenz-Level-Anzeige).
- Empfohlene Resttickets: Ask-Response-Shape-Fix (Bug, hohe Priorität); Evidenz-Level/KnowledgeClass-Anzeige; optional Gap-Anzeige in der noBasis-Karte.
- Statusvorschlag für SCRUM-105: bleibt „In Progress". 1 von 6 setzbar; Kern (Ask-UI) durch bestätigten Shape-Bug blockiert. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-110 Evidence-Audit — Analytics / Audit
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD 7ff888c; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### FE-ANA-01 · Analytics-Dashboard (Status/Trust/Aufgaben/Kategorien)
- Empfehlung: TEILWEISE.
- Code-/Test-Evidenz: `apps/web/src/pages/Analytics.tsx` zeigt Total, Status (offen/validiert), Kategorien-Anzahl und Verteilung nach Wissensart (`a.byType`-Balken). Backend `library-analytics/service.ts` `analytics()` liefert `{ total, byStatus, byType, byCategory }` (`apps/web/src/api/types.ts` `Analytics`). Test: `service.test.ts` FR-ANA-01 (Aggregation nach Status/Art/Kategorie). **Trust und Aufgaben FEHLEN** im Dashboard (kein `byTrust`/`tasks` im `Analytics`-Typ, nicht in der UI).
- Restlücke: Trust- und Aufgaben-Dimension. Restticket nötig.
### FE-ANA-02 · Wirkungsmetriken (validierte/Woche, Antwortquote ohne Lücke, Zeitverlauf)
- Empfehlung: TEILWEISE / offen.
- Code-/Test-Evidenz: Backend vollständig — `services/app/src/impact.ts` `impactReport` (`validatedByWeek`, `askTotal`, `answeredWithoutGap`, `answerRate`); Route `GET /api/analytics/impact` (`build-app.ts:206`). Test: `build-app.test.ts` FR-ANA-02 (askTotal=2, answeredWithoutGap=1, answerRate≈0.5). **Keine UI-Anbindung**: `endpoints.ts` `analytics` kennt nur `overview`+`busfactor` (kein `impact`), kein Hook, keine Anzeige in `Analytics.tsx` (grep „impact" im FE leer).
- Restlücke: Impact-Endpoint/Hook + UI (Wirkungsmetriken/Zeitverlauf). Restticket nötig.
### FE-ANA-03 · Knowledge Health (datenbasiert, Stufe 2)
- Empfehlung: offen.
- Code-/Test-Evidenz: Kein eigenständiges Knowledge-Health-Konzept (kein Score/Zustand/Health-Ableitung). Nur Bestandszahlen (`analytics()`) + Bus-Faktor. Keine Health-Tests.
- Restlücke: datenbasiertes Knowledge-Health (Score/Zustand). Restticket (Stufe 2).
### FE-ANA-04 · Audit-Log (sicherheits-/wissensrelevante Aktionen)
- Empfehlung: abhaken (darf gesetzt werden).
- Code-/Test-Evidenz: UI — `Analytics.tsx` Audit-Abschnitt listet Einträge (Zeit/Aktion/Ziel/Actor = wer/was/wann), `useAudit`. API — `GET /api/audit` mit `AuditFilter` (actor/action) (`audit-routes.ts`). Service + Hash-Kette — `services/audit/src/chain.ts` `hashEntry`/`verifyChain` (prevHash-Kette, GENESIS), `types.ts` „append-only Hash-Kette" (seq/actor/action/target/at/prevHash/hash). Tests — `audit/service.test.ts`: FR-AUD-01 (wer/was/wann + Sequenz + Kette `prevHash===prev.hash`), FR-AUD-02 (append-only eingefroren; intakte Kette verifiziert; **Manipulationserkennung**: geänderter Eintrag → `verifyChain === false`), „filtert nach Aktion". Audit-Einträge entstehen breit (ko.created/validated/conflict.*/library.import/answer.helpful usw.).
- Restlücke: minimal — die UI exponiert keine Filter-Controls (Filter existiert + getestet auf API-Ebene; UI zeigt die letzten 20 unfiltered). Kein Blocker; optionaler Restpunkt „Audit-Filter in der UI".
### FE-ANA-05 · Lineage/Herkunftssicht (Stufe 2)
- Empfehlung: offen.
- Code-/Test-Evidenz: Nur einzelne Provenance-Felder im KO-Detail (`KnowledgeDetail.tsx` `ProvenanceLine`: author/originalAuthor/domain/version). KEINE eigenständige Lineage-/Herkunftssicht (keine Abstammungs-/Verknüpfungsansicht). Keine Lineage-Tests.
- Restlücke: echte Lineage-/Herkunftssicht. Restticket (Stufe 2).
### Offene Restlücken / Resttickets
- FE-ANA-01: Trust- + Aufgaben-Dimension im Analytics-Dashboard.
- FE-ANA-02: Impact-Endpoint/Hook + UI (validatedByWeek/answerRate/Zeitverlauf).
- FE-ANA-03: datenbasiertes Knowledge-Health (Score/Zustand) — Stufe 2.
- FE-ANA-05: Lineage-/Herkunftssicht — Stufe 2.
- Optional FE-ANA-04: Audit-Filter-Controls in der UI.
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: FE-ANA-04.
- Checkboxen, die offen bleiben: FE-ANA-01 (Trust/Aufgaben fehlen), FE-ANA-02 (keine UI-Anbindung), FE-ANA-03 (kein Health-Konzept), FE-ANA-05 (keine Lineage-Sicht).
- Empfohlene Resttickets: Trust/Aufgaben im Dashboard; Impact-UI; Knowledge-Health; Lineage-Sicht; optional Audit-Filter-UI.
- Statusvorschlag für SCRUM-110: bleibt „In Progress" — 1 von 5 Checkboxen erfüllt. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-108 Evidence-Audit — Import / Source-Review (Stufe 2)
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD ee6e5b5; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### FE-IMP-01 · Dateiannahme + Text/OCR-Extraktion
- Empfehlung: offen.
- Code-/Test-Evidenz: KEINE Import-Dateiannahme/Dropzone. `apps/web/src/pages/Stufe2.tsx` `ImportReview` ist ein reiner Stufe-2-Platzhalter (`Stufe2Header` + `Notice textKey="s2.import"`). Die DOCX-/Text-Extraktion (`apps/web/src/lib/docx.ts`/`files.ts`, `Capture.tsx`) gehört zum **Capture-Flow** (FE-CAP-06), nicht zum Import/Source-Review; PDF/OCR sind weiterhin separat offen (vgl. SCRUM-100-Resttickets).
- Restlücke: Datei-Dropzone + Extraktion für den Import-Pfad. SCRUM-108 bleibt Umsetzungsträger.
### FE-IMP-02 · Importkandidaten erzeugen + Queue
- Empfehlung: offen.
- Code-/Test-Evidenz: Es gibt keine Kandidaten-/Queue-Logik. `services/library-analytics/src/service.ts` `importJson` erzeugt **direkt KOs** (`koService.create`, Dedupe per `title|statement`), keine persistierte/sichtbare Queue, kein `ImportCandidate`-Typ (`types.ts` kennt nur `ImportItem`/`ImportResult={imported,skipped}`).
- Restlücke: Kandidaten + Review-Queue (persistiert/sichtbar). SCRUM-108 bleibt Umsetzungsträger.
### FE-IMP-03 · Source-Review: annehmen/ablehnen/Info anfordern
- Empfehlung: offen.
- Code-/Test-Evidenz: Nur Stufe-2-Platzhalter (`ImportReview` → `Notice`). Kein Review-UI/-Flow (annehmen/ablehnen/Nachinfo), kein Status-/Reviewmodell, keine Tests.
- Restlücke: vollständiger Source-Review-Flow. SCRUM-108 bleibt Umsetzungsträger.
### FE-IMP-04 · Akzeptierte Kandidaten → Validierung/Wissensobjektfluss
- Empfehlung: TEILWEISE.
- Code-/Test-Evidenz: `importJson` legt importierte Einträge als echte KOs an (`koService.create`) — diese landen im normalen Wissensobjekt-/Validierungsfluss (Status offen → erscheinen im Validation Board). Route `POST /api/library/import`. Test: `library-analytics/service.test.ts` FR-LIB-02 (Import ohne Duplikate, `{imported:1,skipped:1}`) + „protokolliert den Import" (Audit `library.import`). ABER: **kein Review-/Akzeptanz-Übergang** (kein Kandidat→Review→Annahme→Validierung); es ist ein direkter Bulk-JSON-Import.
- Restlücke: Review-/Validierungsübergang aus akzeptierten Kandidaten. Per Regel höchstens teilweise.
### Querbezug SCRUM-107 / FE-LIB-04
- Bestätigt: JSON-Import existiert Service-/API-seitig + getestet, aber UI/Source-Review fehlt. Diese Lücke ist mit FE-IMP-02/03 deckungsgleich und sollte hier (SCRUM-108) umgesetzt werden.
### Offene Restlücken / Resttickets
- FE-IMP-01/02/03 sind unbebaut (nur Platzhalter) → KEIN separates Restticket nötig; **SCRUM-108 bleibt der Sammel-/Umsetzungsträger** (Stufe 2), mit `SCRUM-116` als Backend-Lücke-Gegenstück.
- FE-IMP-04 teilweise: Review→Validierungs-Übergang ergänzen (Teil von SCRUM-108).
- FE-LIB-04 (SCRUM-107) als hier umzusetzende UI-Lücke verknüpfen.
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: keine.
- Checkboxen, die offen bleiben: FE-IMP-01, FE-IMP-02, FE-IMP-03 (offen); FE-IMP-04 (teilweise).
- Empfohlene Resttickets: keine neuen — SCRUM-108 bleibt Umsetzungsträger (Stufe 2); FE-LIB-04 verknüpfen; SCRUM-116 = Backend-Gegenstück.
- Statusvorschlag für SCRUM-108: bleibt „To Do/Stufe 2" (Backend-JSON-Import vorhanden, FE-Import/Review unbebaut). Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-109 Evidence-Audit — Output Factory / Instruction Builder (Stufe 2)
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD f23f14b; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### FE-OUT-01 · Instruction Builder: validierte Objekte → Arbeitsanweisung (MD-Export)
- Empfehlung: offen.
- Code-/Test-Evidenz: KEIN Instruction Builder. `apps/web/src/pages/Stufe2.tsx` `Output` ist ein reiner Stufe-2-Platzhalter (`Stufe2Header` ticket "SCRUM-117" + `Notice textKey="s2.output"`; i18n: „aktiv, sobald die Output-Logik steht"). Keine Quellenauswahl (nur validierte), keine MD-Arbeitsanweisungs-Erzeugung. Die `LibraryService`-Exporte (JSON/MediaWiki/HTML) sind Bibliotheks-Export, KEIN Instruction Builder und kein MD-Export.
- Restlücke: echter Instruction Builder (validierte Objekte auswählen → Arbeitsanweisung als MD). SCRUM-109 bleibt Umsetzungsträger.
### FE-OUT-02 · Output Factory: Checkliste/Troubleshooting/Schulung/Management-Summary
- Empfehlung: offen.
- Code-/Test-Evidenz: Keine Output-Typen/Factory im Code (grep nach instruction/SOP/Checkliste/Troubleshooting/Schulung/Management-Summary/Arbeitsanweisung findet nur Nav-Labels + Platzhalter-Notice-Text, keine Logik). Kein Service/Builder, keine Tests.
- Restlücke: Output-Factory mit den Output-Typen. SCRUM-109 bleibt Umsetzungsträger.
### FE-OUT-03 · Herkunftskennzeichnung an jedem Output (Quelle/Status/Trust/Version/Gültigkeit/Rolle)
- Empfehlung: offen.
- Code-/Test-Evidenz: Es wird kein Output erzeugt → keine Output-Herkunftskennzeichnung. Einzelne Provenance-Felder existieren nur im KO-Detail (`KnowledgeDetail.tsx` `ProvenanceLine`: author/originalAuthor/domain/version) bzw. als Export-Meta im HTML-Export (`service.ts`: „Trust … · Status … · Autor …"), aber das sind keine generierten Outputs mit vollständiger Kennzeichnung (Quelle/Status/Trust/Version/Gültigkeit/Rolle).
- Restlücke: vollständige Herkunftskennzeichnung an erzeugten Outputs (setzt FE-OUT-01/02 voraus). SCRUM-109 bleibt Umsetzungsträger.
### Offene Restlücken / Resttickets
- FE-OUT-01/02/03 sind unbebaut (nur Stufe-2-Platzhalter) → KEIN separates Restticket nötig; **SCRUM-109 bleibt der Sammel-/Umsetzungsträger** (Stufe 2), Aktivierung laut Jira erst, wenn Output-Logik / `SCRUM-117` steht.
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: keine.
- Checkboxen, die offen bleiben: FE-OUT-01, FE-OUT-02, FE-OUT-03 (alle offen).
- Empfohlene Resttickets: keine neuen — SCRUM-109 bleibt Umsetzungsträger; Backend-Gegenstück Output-Logik = SCRUM-117.
- Statusvorschlag für SCRUM-109: bleibt „To Do/Stufe 2" (blockiert durch Output-Logik SCRUM-117). Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-111 Evidence-Audit — Wissenslebenszyklus
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD cdfe879; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### FE-LCY-01 · Re-Validierung / Gültigkeitsprüfung
- Empfehlung: darf gesetzt werden (mit Restpunkt).
- Code-/Test-Evidenz: UI `apps/web/src/pages/Lifecycle.tsx` (Pending-Liste via `useLifecyclePending` → `GET /api/lifecycle/pending`, „revalidierung"-Pill, Banner `lcy.banner`), KO-Detail Re-Validierung (`act({action:"revalidate"})`). Service `lifecycle/service.ts` `assetChanged`→`markPending`, `pendingRevalidation`, `confirmStillValid`. Test `lifecycle/service.test.ts` FR-LIF-01 (Anlagenänderung markiert gekoppelte KOs, in Pending, Bestätigung erzeugt Version, danach nicht mehr pending).
- Restlücke: Die **Anlagenänderungs-Kopplung** (`couple`/`asset-changed`) ist nur API/Service (Routen `/api/lifecycle/couple`, `/asset-changed`) — KEIN UI-Auslöser/„Stimmt das noch?"-Banner an konkrete Anlagenänderung gebunden. Restpunkt (kein Blocker für die Re-Validierungs-Liste).
### FE-LCY-02 · „Noch gültig" bestätigen
- Empfehlung: darf gesetzt werden.
- Code-/Test-Evidenz: UI-Aktion in `Lifecycle.tsx` (Button „Noch gültig" → `revalidate`) und `KnowledgeDetail.tsx` (`act({action:"revalidate"})`). Dispatcher `ko-routes.ts` `case "revalidate"` → `lifecycle.confirmStillValid` → `koService.revise` (neue Version) + `clearPending`. Test `lifecycle/service.test.ts` FR-LIF-01 (Version erzeugt, Pending geleert); `knowledge-object/service.test.ts` FR-KO-04 (revise: Version+1).
- Restlücke: keine wesentliche.
### FE-LCY-03 · Signal „hat geholfen"
- Empfehlung: TEILWEISE / offen.
- Code-/Test-Evidenz: „Hat geholfen" existiert nur im Ask-Kontext (`apps/web/src/pages/Ask.tsx`, `POST /api/ask/helpful`, Service `ask.markHelpful` → Trust+Audit, getestet FR-ASK-04). Kein Lifecycle-/Bewährungs-spezifisches Signal. Zudem ist der Ask-Helpful-Button durch den bestätigten **Ask-Response-Shape-Bug (SCRUM-105)** in der UI faktisch unerreichbar.
- Restlücke: hängt am Ask-Shape-Fix (SCRUM-105); „hat geholfen" im Lifecycle-Kontext nicht eigenständig vorhanden.
### FE-LCY-04 · Autorenübergabe (Herkunft bleibt erhalten)
- Empfehlung: TEILWEISE.
- Code-/Test-Evidenz: Service `lifecycle.transferAuthor` → `koService.setAuthor` (Originalautor bleibt); Dispatcher `ko-routes.ts` `case "transfer-author"` (Permission `users.manage`); `KoAction` kennt `transfer-author`. Test `lifecycle/service.test.ts` FR-LIF-02 (Autor geändert, Originalautor bleibt). **Keine UI** — kein Autorenübergabe-Button/-Dialog in `KnowledgeDetail.tsx`/Admin (grep leer).
- Restlücke: Frontend-UI für Admin-Autorenübergabe. Backend+Test fertig.
### FE-LCY-05 · Versionen/Revisionen/Pflegebedarf sichtbar
- Empfehlung: darf gesetzt werden.
- Code-/Test-Evidenz: Versionen/Revisionen sichtbar — `KnowledgeDetail.tsx` Versionsnummer + Historie-Karte (`ko.history`); Backend `revise` erhöht Version + History (FR-KO-04). Pflegebedarf sichtbar — Lifecycle-Pending-Liste + `MyTasks.tsx` (Re-Validierungs-Aufgaben aus `useLifecyclePending`).
- Restlücke: detaillierte Pflegebedarf-Metriken (z. B. Fälligkeiten/Alter) fehlen; Kern (Version/History/Pending) ist sichtbar.
### FE-LCY-06 · Lernpfade je Rolle (datenbasiert, Stufe 2)
- Empfehlung: TEILWEISE / offen.
- Code-/Test-Evidenz: Service + Routen vollständig — `lifecycle.createPath`/`getPath`/`completeStep`/`progress`; Routen `/api/learning-paths`, `/:role`, `/:pathId/complete`, `/:pathId/progress`. Test `lifecycle/service.test.ts` FR-LIF-03 (Lernpfad mit Fortschritt). **Keine UI** im Frontend (grep nach learningPath/Lernpfad leer).
- Restlücke: Frontend für Lernpfade je Rolle (Stufe 2). Service/API/Test fertig.
### Offene Restlücken / Resttickets
- FE-LCY-03: Ask-Shape-Fix (SCRUM-105) Voraussetzung; ggf. „hat geholfen"-Sicht im Lifecycle.
- FE-LCY-04: Admin-Autorenübergabe-UI (Backend fertig).
- FE-LCY-06: Lernpfad-UI je Rolle (Backend fertig, Stufe 2).
- FE-LCY-01: optionaler Asset-Change-UI-Auslöser/Banner.
- Diese UI-Lücken können unter SCRUM-111 umgesetzt werden; FE-LCY-03 hängt zusätzlich an SCRUM-105.
### Zusammenfassung für Codex/Jira
- Checkboxen, die gesetzt werden dürfen: FE-LCY-01 (mit Restpunkt asset-change-UI), FE-LCY-02, FE-LCY-05.
- Checkboxen, die offen bleiben: FE-LCY-03 (Ask-Shape/teilweise), FE-LCY-04 (keine UI/teilweise), FE-LCY-06 (keine UI/Stufe 2).
- Empfohlene Resttickets: Autorenübergabe-UI (LCY-04), Lernpfad-UI (LCY-06), Asset-Change-UI (LCY-01-Rest); LCY-03 via SCRUM-105. Keine neuen Tickets zwingend — unter SCRUM-111 umsetzbar.
- Statusvorschlag für SCRUM-111: „In Progress" — 3 von 6 setzbar. Keine Checkbox/kein Status durch mich geändert.

---

## SCRUM-112 Evidence-Audit — Admin / Nutzerverwaltung
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD 516b8e3; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### Vorbefund (Codex) — verifiziert
- `Admin.tsx` zeigt Nutzerliste, Freigabe, Rollenwechsel, Löschen — BESTÄTIGT.
- Keine UI für „Nutzer anlegen" — BESTÄTIGT.
- Keine UI für Admin-Passwort-Reset — BESTÄTIGT.
- Backend-Routen können mehr: `GET/POST /api/users`, `PUT /api/users/:id {role?/approve?/password?}`, `DELETE /api/auth/users/:id`, `POST /api/auth/users/:id/approve`, `POST /api/auth/users/:id/reset` — BESTÄTIGT (`services/auth/src/routes.ts`).
- `endpoints.users.create` existiert, wird in `Admin.tsx` NICHT genutzt — BESTÄTIGT.
- `endpoints.users.resetPassword` fehlt im FE-Wrapper — BESTÄTIGT (grep leer).
### FE-ADM-01 · Nutzerliste
- Entscheidung: abhakbar.
- Evidenz: UI `Admin.tsx` (`useUsers`); API `GET /api/users` (admin-gated, `routes.ts:279`); Service-Liste. RBAC admin-only getestet (`rbac/policy.test.ts` FR-RBAC-01/02). 
- Grenze: keine wesentliche.
### FE-ADM-02 · Nutzer anlegen
- Entscheidung: teilweise (Backend/Endpoint vorhanden, UI fehlt).
- Evidenz: `endpoints.users.create` (POST `/api/users`); Route erstellt+freigibt+setzt Rolle (`routes.ts:299`); Service `register`/`approveUser`/`changeRole` getestet (`auth/service.test.ts` FR-AUTH-01/02). **Keine Anlegen-UI in `Admin.tsx`** (Endpoint ungenutzt).
- Grenze/Lücke: Admin-UI „Nutzer anlegen" fehlt.
### FE-ADM-03 · Freigabe erteilen
- Entscheidung: abhakbar.
- Evidenz: UI `Admin.tsx` `approve` → `POST /api/auth/users/:id/approve`; Service `approveUser`; Tests `auth/service.test.ts` FR-AUTH-02 (Freigabe), FR-RBAC-04 (Approve ohne Adminrecht → 403).
- Grenze: keine.
### FE-ADM-04 · Rolle ändern
- Entscheidung: abhakbar.
- Evidenz: UI `Admin.tsx` `setRole` → `PUT /api/users/:id {role}`; Service `changeRole`; RBAC `canChangeRole` (`rbac/policy.test.ts` FR-RBAC-03: Admin kann sich nicht selbst entziehen).
- Grenze: keine.
### FE-ADM-05 · Passwort-Reset (Admin)
- Entscheidung: teilweise (Backend/Service/Test vorhanden, FE-Endpoint + UI fehlen).
- Evidenz: Backend `service.resetPassword(id, pw, adminId)`; Routen `PUT /api/users/:id {password}` + `POST /api/auth/users/:id/reset`; **Test `auth/service.test.ts` FR-AUTH-06** (Admin-Reset macht alte Sitzungen ungültig, neues Passwort gilt). ABER: kein `endpoints.users.resetPassword`-Wrapper, keine Admin-UI. Self-Service-Reset (`/api/auth/reset` Token, FR-AUTH-08) ist NICHT der Admin-Reset.
- Grenze/Lücke: FE-Endpoint-Wrapper + Admin-UI für Passwort-Reset fehlen.
### FE-ADM-06 · Nutzer löschen
- Entscheidung: abhakbar.
- Evidenz: UI `Admin.tsx` `remove` → `DELETE /api/users/:id` (→ `/api/auth/users/:id`); Service `deleteUser`; Test `auth/service.test.ts` „löscht Nutzer und schreibt je Aktion einen Audit-Eintrag".
- Grenze: keine.
### FE-ADM-07 · Audit-Einsicht
- Entscheidung: teilweise (vorhanden, aber nicht Admin-spezifisch).
- Evidenz: Audit-Einsicht existiert in `Analytics.tsx` (Audit-Abschnitt, `useAudit` → `GET /api/audit`), Service + Hash-Kette + Tests (`audit/service.test.ts` FR-AUD-01/02, Manipulationserkennung) — vgl. SCRUM-110/FE-ANA-04 (abhakbar). **In `Admin.tsx` gibt es KEINE eigene Audit-Einsicht.**
- Grenze/Lücke: Audit-Einsicht ist über Analytics abgedeckt, aber nicht in der Admin-Seite. Codex/Peter entscheidet, ob das für FE-ADM-07 genügt oder eine Admin-spezifische Sicht gefordert ist.
### Resttickets / empfohlene Jira-Lücken (nur Nennung)
- FE-ADM-02: Admin-UI „Nutzer anlegen" (Endpoint `users.create` existiert).
- FE-ADM-05: FE-Endpoint `users.resetPassword` + Admin-UI für Passwort-Reset (Backend/Service/Test fertig, FR-AUTH-06).
- FE-ADM-07: Admin-spezifische Audit-Einsicht ODER Scope-Klärung (Analytics genügt).
### Zusammenfassung für Codex/Jira
- Abhakbar: FE-ADM-01, FE-ADM-03, FE-ADM-04, FE-ADM-06.
- Teilweise: FE-ADM-02 (UI fehlt), FE-ADM-05 (FE-Endpoint+UI fehlen), FE-ADM-07 (nicht Admin-spezifisch).
- Statusvorschlag SCRUM-112: „In Progress" — 4 von 7 setzbar. Keine Checkbox/kein Status durch mich geändert.
- Bestätigung: kein Produktcode geändert; nur `docs/qm/claude-after-report.md` append-only ergänzt.

---

## SCRUM-113 Evidence-Audit — Mobile / PWA
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD 5d3b725; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### Vorbefund (Codex) — verifiziert
- `Mobile.tsx` = statische Mobile/PWA-Vorschau im Geräterahmen — BESTÄTIGT (Imports nur Icons + `useTranslation`; KEINE `endpoints`/`useMutation`/`useQuery`/`navigate`/`Link`/`mutate`).
- `index.html` hat viewport + theme-color, aber KEINEN Manifest-Link — BESTÄTIGT.
- `apps/web/public/` enthält nur `robots.txt` (kein Manifest, keine Icons, kein Service Worker) — BESTÄTIGT.
- `vite.config.ts`/`package.json` ohne PWA-Plugin — BESTÄTIGT (kein VitePWA/workbox/registerSW).
- `/mobile`-Route + Topbar-Button existieren, Sonderroute (nicht Hauptnavigation) — BESTÄTIGT.
### FE-MOB-01 · Installierbare PWA (Vollbild, Icon, Offline-Start)
- Entscheidung: offen.
- Evidenz: `index.html` nur `viewport` + `theme-color` (kein `<link rel="manifest">`); `public/` nur `robots.txt`; kein `*.webmanifest`, keine App-Icons, kein Service Worker; kein PWA-Plugin in `vite.config.ts`.
- Grenze/Lücke: keine PWA-Infrastruktur (Manifest/Icons/SW/Offline-Shell). Nicht installierbar, kein Offline-Start.
### FE-MOB-02 · Mobile Erfassung (Entwurf als Primäraktion)
- Entscheidung: offen.
- Evidenz: `Mobile.tsx` zeigt statische Buttons (Diktat/Notiz/Foto/Interview) OHNE Handler/API. Kein Aufruf der Draft-/Capture-API aus dem mobilen Kontext. (Desktop-`Capture.tsx` existiert, ist aber nicht die mobile Aktion.)
- Grenze/Lücke: keine echte mobile Erfassung; Entwurf nicht als funktionale Primäraktion verdrahtet.
### FE-MOB-03 · Mobile Fragen/Abfrage
- Entscheidung: offen.
- Evidenz: kein mobiles Ask-UI; nur statischer „Nachschlagen"-Button. Desktop-`Ask.tsx` ist zudem durch den bestätigten Ask-Response-Shape-Bug (SCRUM-105) blockiert.
- Grenze/Lücke: keine mobile Abfrage gebaut.
### FE-MOB-04 · Mobile Entwürfe
- Entscheidung: offen.
- Evidenz: keine mobile Entwurfsliste/-fortsetzen in `Mobile.tsx`; nur allgemeine Draft-Endpoints (`endpoints.drafts`) + Desktop-Capture.
- Grenze/Lücke: keine mobile Entwurfsansicht.
### FE-MOB-05 · Mobile Wissenszugriff
- Entscheidung: offen.
- Evidenz: kein mobiler Wissenszugriff (statischer „Nachschlagen"-Button ohne Navigation). Desktop-`Library.tsx`/`KnowledgeDetail.tsx` sind responsive, aber nicht mobil-spezifisch im Mobile-Screen angebunden.
- Grenze/Lücke: kein mobiler Wissenszugriff verdrahtet.
### FE-MOB-06 · In-App-Bestätigung bei mobilen Aktionen
- Entscheidung: offen.
- Evidenz: Es gibt keine mobilen Aktionen (statische Vorschau) → keine In-App-Bestätigungen vorhanden. Abwesenheit destruktiver Aktionen zählt nicht als erfüllt.
- Grenze/Lücke: nicht vorhanden.
### FE-MOB-07 · Offline-Queue/Sync (Stufe 2)
- Entscheidung: offen.
- Evidenz: keine Offline-Queue/Sync-Logik (kein SW, kein lokaler Queue-Store). Stufe 2.
- Grenze/Lücke: nicht vorhanden.
### Resttickets / empfohlene Jira-Lücken (nur Nennung)
- PWA-Infrastruktur: Manifest + App-Icons + Service Worker/Offline-Shell + Vite-PWA-Plugin (FE-MOB-01).
- Mobile-Funktionsanbindung: Erfassung/Fragen/Entwürfe/Wissenszugriff real verdrahten (FE-MOB-02..05); FE-MOB-03 hängt zusätzlich an SCRUM-105.
- In-App-Bestätigungen für mobile Aktionen (FE-MOB-06).
- Offline-Queue/Sync (FE-MOB-07, Stufe 2).
- Empfehlung: SCRUM-113 bleibt der Sammel-/Umsetzungsträger; `Mobile.tsx` ist aktuell nur Vorschau.
### Zusammenfassung für Codex/Jira
- Abhakbar: keine.
- Offen: FE-MOB-01, FE-MOB-02, FE-MOB-03, FE-MOB-04, FE-MOB-05, FE-MOB-06, FE-MOB-07.
- Statusvorschlag SCRUM-113: „To Do" (UI-Vorschau vorhanden, Funktion/PWA unbebaut). Keine Checkbox/kein Status durch mich geändert.
- Bestätigung: kein Produktcode geändert; nur `docs/qm/claude-after-report.md` append-only ergänzt.

---

## SCRUM-114 Evidence-Audit — Management-/Kapital-Sichten (Stufe 2)
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
### Gate
- git status vor Audit: clean (HEAD 7e7acfc; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests).
- Produktcode geändert: nein.
- Geänderte Dateien: nur `docs/qm/claude-after-report.md` (dieser Bericht).
### Vorbefund (Codex) — verifiziert
- `Capital` (`Stufe2.tsx`) = reiner Stufe-2-Notice „…aktiv, sobald die Kennzahlen-Logik steht" (`s2.capital`), Label SCRUM-120 — BESTÄTIGT.
- `analytics()` aggregiert nur Status/Art/Kategorie — BESTÄTIGT (SCRUM-110/FE-ANA-01).
- `impact.ts` + `GET /api/analytics/impact` existieren backendseitig + getestet, aber KEIN FE-Endpoint/Hook/UI — BESTÄTIGT (SCRUM-110/FE-ANA-02).
- KEINE Kapital-/Management-Endpunkte in `endpoints.ts`/`hooks.ts` — BESTÄTIGT (grep leer).
- `GraphView` ist textuelle Kantenliste (SCRUM-119), kein Knowledge House — BESTÄTIGT.
- Keine Web-Umsetzung von Wissens-Priorisierung/Knowledge House — BESTÄTIGT (grep nach capital/valuation/statement/maturity/hero/house/priorisier im Source leer außer Nav-Label/Notice).
### FE-MGMT-01 · Overview / operativer Snapshot
- Entscheidung: offen.
- Evidenz: Nur Basis-Analytics (`Analytics.tsx` total/offen/validiert/Kategorien) — separat als FE-ANA-01 (teilweise) bewertet; kein dedizierter operativer Management-Snapshot. Per Regel zählen Basis-Analytics nicht als Management-Sicht.
- Grenze/Lücke: kein Management-Snapshot.
### FE-MGMT-02 · Pilot-Bericht (30/60/90, echte Kennzahlen, Druck/PDF)
- Entscheidung: offen.
- Evidenz: Backend `impact.ts` (`validatedByWeek`/`answerRate`) + `GET /api/analytics/impact` getestet (`build-app.test.ts` FR-ANA-02), aber KEIN 30/60/90-Bericht, kein FE-Endpoint/Hook/UI, kein Druck/PDF.
- Grenze/Lücke: kein Pilot-Bericht, keine PDF-Ausgabe, Impact nicht im FE angebunden.
### FE-MGMT-03 · Knowledge Capital Score (datenbasiert)
- Entscheidung: offen.
- Evidenz: Keine Score-Logik im Code (kein `capitalScore`/Regeln/Test). Stufe-2-Platzhalter; Backend-Gegenstück SCRUM-120.
- Grenze/Lücke: nicht vorhanden.
### FE-MGMT-04 · Knowledge Valuation (€-Modell)
- Entscheidung: offen.
- Evidenz: Kein €-Valuation-Modell, keine Annahmen/Transparenz, kein Code/Test.
- Grenze/Lücke: nicht vorhanden.
### FE-MGMT-05 · Knowledge Statement (Aktiva/Risiken/Netto)
- Entscheidung: offen.
- Evidenz: Kein Knowledge Statement (Aktiva/Risiken/Netto) im Code/UI/Test.
- Grenze/Lücke: nicht vorhanden.
### FE-MGMT-06 · Maturity Journey
- Entscheidung: offen.
- Evidenz: Keine Maturity-Journey-Sicht (i18n erwähnt „maturity grade" als Satz, aber keine Journey-Ansicht/Logik).
- Grenze/Lücke: nicht vorhanden.
### FE-MGMT-07 · Hero Assist (Handlungsempfehlungen)
- Entscheidung: offen.
- Evidenz: Keine Hero-Assist-/Empfehlungslogik (kein datenbasierter Empfehlungs-Generator) im Code/UI/Test.
- Grenze/Lücke: nicht vorhanden.
### FE-MGMT-08 · Knowledge House (Unternehmensgedächtnis visuell)
- Entscheidung: offen.
- Evidenz: Nur `GraphView` (textuelle Kantenliste, Stufe 2, SCRUM-119) — erfüllt die House-Anforderung NICHT; keine visuelle House-Darstellung.
- Grenze/Lücke: kein Knowledge House.
### FE-MGMT-09 · Wissens-Priorisierung (9-Faktoren-Score)
- Entscheidung: offen.
- Evidenz: Pflichtenheft/Extensions nennen die 9-Faktoren-Priorisierung, aber KEINE Web-/Service-Umsetzung (kein Priorisierungs-Score im Code/Test).
- Grenze/Lücke: nicht vorhanden.
### Resttickets / empfohlene Jira-Lücken (nur Nennung)
- SCRUM-114 bleibt der Sammel-/Umsetzungsträger (Stufe 2, datenbasiert), abhängig vom Kapital-/Kennzahlen-Backend (SCRUM-120) und Impact-FE-Anbindung (SCRUM-110/FE-ANA-02).
- Knowledge House visuell = eigener Ausbau (über GraphView/SCRUM-119 hinaus).
- 9-Faktoren-Priorisierung: Backend-Regelwerk + UI fehlen vollständig.
### Zusammenfassung für Codex/Jira
- Abhakbar: keine.
- Offen: FE-MGMT-01 bis FE-MGMT-09 (alle).
- Statusvorschlag SCRUM-114: „To Do/Stufe 2" — nur Platzhalter; keine datenbasierte Management-/Kapital-Sicht umgesetzt. Keine Checkbox/kein Status durch mich geändert.
- Bestätigung: kein Produktcode geändert; nur `docs/qm/claude-after-report.md` append-only ergänzt.

---

## SCRUM-98 Evidence-Audit — Foundation
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
Geprüfte Dateien: App.tsx, main.tsx, routes.tsx, shell/AppShell.tsx, shell/Sidebar.tsx, shell/Topbar.tsx, shell/CommandPalette.tsx, app/navigation.ts, app/RoleContext.tsx, app/AuthContext.tsx, app/useNavBadges.ts, auth/AuthScreens.tsx, auth/ResetScreen.tsx, pages/Start.tsx, pages/Help.tsx, pages/Mobile.tsx, pages/Profile.tsx, pages/UiKit.tsx, components/ui.tsx, components/HelpTip.tsx, i18n.ts; Tests services/** + tests/**.
### Gate
- git status vor Audit: clean (HEAD 6797bc1; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 21 Dateien / 115 Tests). FE selbst hat keine eigenen Komponententests (vitest scannt nur `tests/**`+`services/**`).
- Produktcode geändert: nein. Geänderte Dateien: nur `docs/qm/claude-after-report.md`.
### FE-FND-01 · App-Shells (Login, Desktop-Control-Room, Mobile)
- Status: teilweise.
- Source-Evidenz: Login-Shell (`App.tsx` `Gate` → `AuthScreens`/`ResetScreen`), Desktop-Control-Room (`AppShell.tsx`: Sidebar 252px + Topbar + Content + CommandPalette). Mobile: `Mobile.tsx` ist eine statische Vorschau-Seite INNERHALB der AppShell, keine eigene Mobile-Shell (vgl. SCRUM-113).
- Test-/Gate-Evidenz: Gate grün (tsc/biome); keine FE-Komponententests.
- Restlücke: echte Mobile-Shell fehlt (hängt an SCRUM-113).
### FE-FND-02 · Rollenabhängige Navigation / Sidebar
- Status: teilweise.
- Source-Evidenz: `Sidebar.tsx` + `navigation.ts` `canSee(item, role, stufe2)` + Routen-Gating (`routes.tsx`). ABER Rolle kommt aus `RoleContext.tsx` (`useState<Role>("experte")` + `setRole`-Dev-Schalter in der Sidebar), NICHT aus der echten Auth-Session (`session.user.role`).
- Test-/Gate-Evidenz: RBAC-Rechtematrix auf Service-Ebene getestet (`rbac/policy.test.ts` FR-RBAC-01/02); `canSee` (Nav-Sichtbarkeit) selbst nicht getestet.
- Restlücke: Nav-Rolle aus echter Session statt Dev-Schalter (Backend-RBAC erzwingt Rechte ohnehin; FE-Nav-Sichtbarkeit ist nur Vorschau-gesteuert).
### FE-FND-03 · Command Palette (⌘K)
- Status: abhakbar.
- Source-Evidenz: `CommandPalette.tsx` (⌘K/Strg+K, rollengefiltert via `canSee`, Pfeiltasten/Enter/Esc, Event `open-command-palette`); eingebunden in `AppShell`.
- Test-/Gate-Evidenz: Gate grün; funktional über Source belegt (kein eigener Unit-Test, da FE-Komponente).
- Restlücke: optional ein FE-Test; kein Blocker.
### FE-FND-04 · Toaster / Benachrichtigungs-Bus
- Status: teilweise/offen.
- Source-Evidenz: Es gibt einen Notification-Bell + Feed in `Topbar.tsx` (`useNotifications` → `/api/notifications`, aggregiert Konflikte/Lücken, `notification-feed.ts`). KEIN generischer Toaster-/Benachrichtigungs-Bus (grep nach toast/Toaster/Snackbar/useToast leer).
- Test-/Gate-Evidenz: Notification-Feed getestet (`app/notification-feed.test.ts`).
- Restlücke: generischer Toaster-/Event-Bus für UI-Rückmeldungen fehlt (Feed ≠ Toaster-Bus).
### FE-FND-05 · In-App-Hilfe (zweisprachig, durchsuchbar)
- Status: abhakbar.
- Source-Evidenz: `Help.tsx` Suchfeld (`q`-Filter über Topic-Titel+Body), Inhalte via `t(\`help.<topic>.*\`)` (DE/EN aus `i18n.ts`); zusätzlich `HelpTip.tsx` (Inline-„?"-Popover mit Link ins Hilfe-Center).
- Test-/Gate-Evidenz: Gate grün; i18n-DE/EN-Ressourcen vorhanden.
- Restlücke: keine wesentliche.
### FE-FND-06 · i18n DE/EN inkl. Umschalter
- Status: abhakbar (mit kleinem Restpunkt).
- Source-Evidenz: `i18n.ts` (DE+EN, `lng:"de"`); Umschalter in `Topbar.tsx` und `Profile.tsx` (`i18n.changeLanguage`); Status/Wissensarten/Formulare über `t(...)`.
- Test-/Gate-Evidenz: Gate grün.
- Restlücke: vereinzelte harte Strings (z. B. „KLARWERK", „Stufe 2 · SCRUM-xxx" im Stufe2-Header, „online"/„klarwerk.ai"). Marginal.
### FE-FND-07 · Design-System / UI-Bausteine
- Status: abhakbar.
- Source-Evidenz: `components/ui.tsx` (Button/Card/Field/TextInput/PageHeader/SectionLabel/QueryState/Avatar), `UiKit.tsx` (Showcase), `HelpTip.tsx`, `components/editors.tsx`, `components/trust/*`; durchgängig in allen Seiten genutzt; Tailwind-Tokens.
- Test-/Gate-Evidenz: Gate grün (tsc/biome/dep-cruiser über apps/web/src sauber). Keine FE-Komponententests.
- Restlücke: optional Komponententests; kein Blocker.
### FE-FND-08 · Auth-/Session-Context, optimistische Updates + periodisches Nachladen
- Status: teilweise.
- Source-Evidenz: `AuthContext.tsx` echte Session (`/auth/status` + `/auth/me` via react-query), `signOut` invalidiert `["auth"]` + Hard-Reload. KEIN `refetchInterval`/Polling (bestätigt), keine expliziten optimistischen Updates.
- Test-/Gate-Evidenz: Auth-Service getestet (`auth/service.test.ts` FR-AUTH-01..08, „register→login→me happy path; me ohne Token → 401").
- Restlücke: periodisches Nachladen (refetchInterval) + optimistische Updates fehlen.
### FE-FND-09 · „Missions"-Einstiegsseiten (optional)
- Status: offen / optional.
- Source-Evidenz: `Start.tsx` = normale Startseite mit rollenabhängigem CTA (`/fragen`/`/erfassen`/`/validierung`) + KPIs + Heute-zu-tun. Keine dedizierten Missions-Einstiegs-Flows.
- Test-/Gate-Evidenz: Gate grün.
- Restlücke: echte „Missions"-Einstiegsseiten (optional) nicht umgesetzt.
### Empfehlung für Codex/Jira
- Abhakbar: FE-FND-03, FE-FND-05, FE-FND-06, FE-FND-07.
- Nicht setzen (teilweise): FE-FND-01 (Mobile-Shell fehlt), FE-FND-02 (Nav-Rolle aus Dev-Schalter statt Session), FE-FND-04 (kein Toaster-Bus), FE-FND-08 (kein Polling/optimistic).
- Offen/optional: FE-FND-09.
- Resttickets/Blocker: echte Mobile-Shell (SCRUM-113); Nav-Rolle aus Auth-Session; generischer Toaster-Bus; AuthContext-Polling/optimistische Updates; optional Missions-Einstiegsseiten + FE-Komponententests.
- Statusvorschlag SCRUM-98: „In Progress" — 4 von 9 setzbar.
- Bestätigung: kein Produktcode geändert; nur `docs/qm/claude-after-report.md` append-only ergänzt.

---

## SCRUM-99 Evidence-Audit — Auth & Onboarding
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
Geprüfte Dateien: App.tsx, app/AuthContext.tsx, auth/AuthScreens.tsx, auth/ResetScreen.tsx, api/auth.ts, pages/Profile.tsx, pages/Admin.tsx, api/endpoints.ts, api/hooks.ts, i18n.ts; services/auth/src/{service.ts,routes.ts,service.test.ts,oidc.ts,oidc.test.ts}; services/app/src/build-app.test.ts.
### Gate
- git status vor Audit: nur `docs/qm/claude-after-report.md` geändert (SCRUM-98-Report aus Vorturn, uncommitted) — kein Produktcode.
- npm run check: GRÜN (exit 0) — build/lint/arch/test (21 Dateien / 115 Tests).
- Produktcode geändert: nein. Geänderte Dateien: nur `docs/qm/claude-after-report.md`.
### FE-AUTH-01 · Ersteinrichtung → erstes Konto = Admin
- Status: abhakbar.
- Source-Evidenz: `AuthScreens.tsx` Mode "setup" (`authApi.setup`); `App.tsx` `Gate` zeigt Setup bei `s.needsSetup` (aus `/auth/status`); `api/auth.ts` `status`/`setup`.
- Test-/Gate-Evidenz: `auth/service.test.ts` FR-AUTH-01 (erstes Konto wird Admin, approved). Gate grün.
- Restlücke: keine.
### FE-AUTH-02 · Registrierung (Name, E-Mail, Passwort ≥ 8)
- Status: abhakbar.
- Source-Evidenz: `AuthScreens.tsx` Mode "register" (Name/E-Mail/Passwort, `minLength={8}` für register/setup); `authApi.register`.
- Test-/Gate-Evidenz: `auth/service.test.ts` FR-AUTH-02 + „weist zu kurze Passwörter ab"; Integration `build-app.test.ts` (Registrierung→Login→KO-Liste). Gate grün.
- Restlücke: keine.
### FE-AUTH-03 · „Wartet auf Freigabe"-Hinweisbildschirm
- Status: abhakbar.
- Source-Evidenz: `AuthScreens.tsx` `register.onSuccess → setMode("waiting")`, Anzeige `auth.waitingNote`.
- Test-/Gate-Evidenz: `auth/service.test.ts` FR-AUTH-02 (weitere Konten Experte + bis Freigabe gesperrt). Freigabe-Kontext siehe SCRUM-112/FE-ADM-03 (nicht doppelt gezählt). Gate grün.
- Restlücke: keine.
### FE-AUTH-04 · Login / Logout / Session-Status
- Status: abhakbar.
- Source-Evidenz: `AuthScreens.tsx` login-Mutation (`authApi.login`); `AuthContext.tsx` `signOut` (Logout + Cache-Invalidate + Hard-Reload) + Session via `/auth/status`+`/auth/me`.
- Test-/Gate-Evidenz: `auth/service.test.ts` FR-AUTH-03/04 (falsche Daten abgewiesen; Logout beendet Sitzung) + „register→login→me happy path; me ohne Token → 401"; Integration build-app (geschützte KO-Liste 401 ohne Token). Gate grün.
- Restlücke: keine.
### FE-AUTH-05 · Eigenes Profil / „Me"
- Status: abhakbar.
- Source-Evidenz: `Profile.tsx` zeigt `useSession().user` (Name/E-Mail/Rolle, Initialen) + Sprache; zusätzlich **Passwortwechsel** (`authApi.changePassword` alt/neu, `prof.passwordTitle`). `AuthContext` `/auth/me`.
- Test-/Gate-Evidenz: `auth/service.test.ts` „Self-Service: eigenes Passwort ändern (altes nötig), alte Sitzung verfällt"; me-happy-path. Gate grün.
- Restlücke: keine. (Passwortwechsel im Profil vorhanden.)
### FE-AUTH-06 · Self-Service-Passwort-Reset per E-Mail (Stufe 2)
- Status: abhakbar.
- Source-Evidenz: Request-Flow `AuthScreens.tsx` Mode "forgot" → `authApi.forgot` → "forgotSent" (`auth.forgotNote`); Token-Reset-UI `ResetScreen.tsx` (`authApi.reset(token, newPassword)`, erreichbar über `/reset` ohne Login). Route `/api/auth/forgot` (immer 204, kein Existenz-Leak) + `/api/auth/reset`.
- Test-/Gate-Evidenz: `auth/service.test.ts` FR-AUTH-08 (Reset per Token; unbekannte E-Mail verschwiegen; Token einmalig); Mailer `notifications/mailer.test.ts`. Gate grün.
- Restlücke: keine funktionale (Brevo-Versand live durch Stakeholder konfiguriert).
### FE-AUTH-07 · SSO/OIDC-Login + Rollen-Mapping (Stufe 2)
- Status: teilweise.
- Source-Evidenz: Backend vorhanden — `services/auth/src/oidc.ts` (Verifier), Route `POST /api/auth/oidc` (`routes.ts`), `loginWithOidc`. ABER: KEINE FE-Anbindung — kein SSO/OIDC-Login-Button, kein `authApi.oidc`/idToken-Handling in `apps/web/src` (grep leer). Rollen-Mapping ist „erstes Konto → Admin" (Auto-Provisionierung), KEIN claim-basiertes Rollen-Mapping.
- Test-/Gate-Evidenz: `auth/oidc.test.ts` FR-AUTH-07 (gültiges Token/Claims, falsche Audience abgewiesen, loginWithOidc → erstes Konto Admin). Gate grün.
- Restlücke: FE-OIDC-Login-Flow + claim-basiertes Rollen-Mapping fehlen.
### Empfehlung für Codex/Jira
- Abhakbar: FE-AUTH-01, FE-AUTH-02, FE-AUTH-03, FE-AUTH-04, FE-AUTH-05, FE-AUTH-06.
- Nicht setzen (teilweise): FE-AUTH-07 (Backend-OIDC + Tests vorhanden, FE-Login-Flow + Rollen-Mapping fehlen).
- Resttickets/Blocker: FE-OIDC-Login-Anbindung + claim-basiertes Rollen-Mapping (FE-AUTH-07, Stufe 2).
- Statusvorschlag SCRUM-99: „In Progress/In Review" — 6 von 7 setzbar.
- Bestätigung: kein Produktcode geändert; nur `docs/qm/claude-after-report.md` append-only ergänzt.

---

## SCRUM-100 Evidence-Audit — Capture / Expert Studio
Datum: 2026-06-25
Modus: Read-only Evidence-Audit, kein Feature-Code
Geprüfte Dateien: pages/Capture.tsx, lib/files.ts, lib/docx.ts, components/editors.tsx, components/trust/ReasonerDraft.tsx, api/endpoints.ts, api/types.ts, i18n.ts, tests/capture/docx-extract.test.ts; services/capture/src/{service.ts,interview.ts,service.test.ts}, services/app/src/routes/{capture-routes.ts,reasoner-routes.ts}, services/app/src/build-app.test.ts, services/knowledge-object/src/{service.ts,service.test.ts}, specs/stories/capture.md.
### Gate
- git status vor Audit: clean (HEAD 83b0a7c; nur ignorierte `*.timestamp-*.mjs`).
- npm run check: GRÜN (exit 0) — build/lint/arch/test (21 Dateien / 115 Tests).
- Produktcode geändert: nein. Geänderte Dateien: nur `docs/qm/claude-after-report.md`.
### FE-CAP-01 · Erfassungsmodus Freitext
- Status: abhakbar.
- Source-Evidenz: `Capture.tsx` Mode "freitext" → Rohtext-Textarea → `endpoints.reasoner.structure(raw)` → Draft → `submit` → `endpoints.ko.create`.
- Test-/Gate-Evidenz: `reasoner/service.test.ts` FR-RSN-01 (structure); `knowledge-object/service.test.ts` FR-KO-01 (KO-Erstellung). Gate grün.
- Restlücke: keine.
### FE-CAP-02 · Erfassungsmodus Strukturiertes Formular
- Status: abhakbar.
- Source-Evidenz: Mode "formular" → `setDraft({...EMPTY_DRAFT})` → rechtes Editor-Panel mit editierbaren Feldern (Titel/Aussage via TextInput, Bedingungen/Maßnahmen via `ListEditor`, Tags via `TagEditor`) → `submit` erzeugt KO. Strukturierte Felder erstellbar/prüfbar/korrigierbar.
- Test-/Gate-Evidenz: KO-Erstellung getestet (FR-KO-01). Gate grün.
- Restlücke: keine wesentliche.
### FE-CAP-03 · Diktat/Spracheingabe (Web Speech)
- Status: abhakbar (mit Hinweis).
- Source-Evidenz: `speechCtor()` (`SpeechRecognition`/`webkitSpeechRecognition`), `toggleDictation` (`rec.onresult` hängt Transkript an Rohtext), `speechSupported`-Flag + Fallback-Hinweis `capture.diktatUnsupported`.
- Test-/Gate-Evidenz: Gate grün; kein Unit-Test (Browser-API).
- Restlücke: Browser-Support nur Chrome/Edge (Web Speech) — ehrlich per Fallback-Hinweis abgedeckt.
### FE-CAP-04 · Geführtes Wissens-Interview (Reasoner-Rückfragen)
- Status: teilweise.
- Source-Evidenz: Mode "interview" mit festen `IV_STEPS`; Backend `services/capture/src/interview.ts` `InterviewSession` mit **fester** `QUESTIONS`-Liste (Kommentar: „Deterministische Variante (ohne Modell); der Reasoner kann die Fragenfolge später ersetzen"). KEINE echten Reasoner-Rückfragen.
- Test-/Gate-Evidenz: `capture/service.test.ts` FR-CAP-02 (InterviewSession: eine Frage pro Schritt) — deterministisch. Gate grün.
- Restlücke: reasoner-getriebene Interview-Rückfragen (eigener Ausbau; vgl. SCRUM-101/FE-RSN-02).
### FE-CAP-05 · Anhänge/Fotos (+ Thumbnail) — Objektspeicher nötig
- Status: teilweise.
- Source-Evidenz: Bild-Upload → `fileToThumbDataUrl` (lokales JPEG-Thumbnail als Daten-URL) → beim Einreichen via `ko.act({action:"attach"})` ans KO; Backend `attach`/`detach` mit MIME-/Größen-/Anzahl-Guards. KEIN echter Objektspeicher.
- Test-/Gate-Evidenz: `knowledge-object/service.test.ts` FR-CAP-05 (Anhänge anfügen/entfernen). Gate grün.
- Restlücke: echter Objektspeicher (S3) — SCRUM-121.
### FE-CAP-06 · OCR + Dokument-Parsing (Text/MD/PDF/DOCX)
- Status: teilweise.
- Source-Evidenz: `onDocs` liest txt/md/csv/json/log (`readTextFile`) und **DOCX** (`readDocxFile`/`lib/docx.ts` mammoth) als Volltext. PDF + Bild-OCR NICHT umgesetzt.
- Test-/Gate-Evidenz: `tests/capture/docx-extract.test.ts` (DOCX-Extraktion + Typ-Erkennung). Gate grün.
- Restlücke: PDF-Textextraktion (SCRUM-122) + Bild-OCR (SCRUM-123) offen → NICHT komplett abhaken.
### FE-CAP-07 · Entwürfe speichern/fortsetzen (Desktop ↔ Mobile)
- Status: teilweise.
- Source-Evidenz: `saveDraft` → `endpoints.drafts.create`; Backend Draft-Pool `capture-routes.ts` (`POST/GET/PUT/DELETE /api/drafts`, `/promote`), `continueDraft`. ABER: keine Desktop-UI zum Auflisten/Fortsetzen gespeicherter Entwürfe in Capture; Mobile = statische Vorschau (SCRUM-113).
- Test-/Gate-Evidenz: `capture/service.test.ts` FR-CAP-06 (Entwurf im gemeinsamen Pool), FR-CAP-07 (Fortsetzen erhält Originalautor; KO-Eingabe trägt Entwurfs-Autor). Gate grün.
- Restlücke: Desktop-Fortsetzen-UI (Entwurfsliste/Resume) + Mobile-Abdeckung (SCRUM-113).
### FE-CAP-08 · Metadaten (Domäne, Asset/Anlage, Re-Validierung)
- Status: abhakbar.
- Source-Evidenz: `Capture.tsx` Felder Kategorie/Domäne (`category`), Anlage/Asset (`asset`), Tags (`TagEditor`), Nötige Validierungen (`neededValidations`); werden bei `ko.create`/`drafts.create` mitgesendet.
- Test-/Gate-Evidenz: `capture/service.test.ts` FR-CAP-08 (ungültige Validierungsanzahl abgewiesen); `knowledge-object` validiert neededValidations (1–5). Gate grün.
- Restlücke: keine wesentliche (Begriff „Re-Validierung" = nötige Validierungsanzahl).
### FE-CAP-09 · Strukturiertes Ergebnis im Editor prüfen/korrigieren
- Status: abhakbar.
- Source-Evidenz: rechtes Panel `ReasonerDraft` mit editierbarem Titel/Aussage (TextInput/Textarea), Bedingungen/Maßnahmen (`ListEditor`), „Aussage präzisieren" (`assistStatement`), `submit`. Reasoner-Ergebnis sichtbar + editierbar + korrigierbar.
- Test-/Gate-Evidenz: Gate grün; KO-Erstellung aus korrigiertem Draft (FR-KO-01).
- Restlücke: keine.
### Empfehlung für Codex/Jira
- Abhakbar: FE-CAP-01, FE-CAP-02, FE-CAP-03, FE-CAP-08, FE-CAP-09.
- Nicht setzen (teilweise): FE-CAP-04 (deterministisches Interview), FE-CAP-05 (kein Objektspeicher), FE-CAP-06 (PDF/OCR offen), FE-CAP-07 (Desktop-Resume-UI + Mobile).
- Resttickets/Blocker: SCRUM-121 (Objektspeicher/FE-CAP-05), SCRUM-122 (PDF) + SCRUM-123 (OCR) für FE-CAP-06, SCRUM-113 (Mobile) + Desktop-Resume-UI für FE-CAP-07, reasoner-getriebenes Interview für FE-CAP-04.
- Statusvorschlag SCRUM-100: „In Progress" — 5 von 9 setzbar.
- Bestätigung: kein Produktcode geändert; nur `docs/qm/claude-after-report.md` append-only ergänzt.

---

## SCRUM-138 — Ask-Response-Shape-Fix — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/api/types.ts`: neuer Typ `AskResponse = { result: AnswerResult; gap: Gap | null }` (spiegelt realen Backend-Shape).
- `apps/web/src/api/endpoints.ts`: `ask.ask` Rückgabetyp `AnswerResult` → `AskResponse` (Import entsprechend umgestellt).
- `apps/web/src/lib/askResponse.ts` (neu, DOM-frei): reine Selektoren `selectAnswer(r)` (→ `r.result`) und `selectGap(r)` (→ `r.gap`).
- `apps/web/src/pages/Ask.tsx`: `onSuccess` entpackt jetzt sauber via `setResult(selectAnswer(r))`; restliche UI unverändert.
- `tests/ask/ask-response.test.ts` (neu): Adaptervertrag-Test.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
### Erfüllte Akzeptanzkriterien
- Ask-UI zeigt beantwortete Fragen wieder als Antwortkarte (`result.answered` ist jetzt der echte Wert aus `r.result`).
- Quellen/Steps/Trust/„Hat geholfen" funktionieren wieder (UI liest jetzt das echte `AnswerResult`).
- Unbeantwortbare Fragen zeigen weiterhin No-Basis-/Gaps-Karte (Link zu `/risiko`).
- TypeScript-Typen spiegeln den echten Backend-Response (`AskResponse`).
- Test deckt den Shape-Fehler ab (beantwortet → Antwortdaten; unbeantwortbar → No-Basis + Gap).
- Kein Backend-Redesign; AskService/Reasoner/Gap-Features/Mobile/Analytics nicht angefasst.
### Tests / Gate
- Gezielter Lauf: `vitest run tests/ask/ask-response.test.ts` → 2/2 grün.
- `npm run check`: GRÜN (exit 0) — build (`tsc --noEmit`), lint (`biome check .`), arch (`depcruise services`), test (`vitest run`, 22 Dateien / 117 Tests).
- Hinweis: `vite build` und `git push` sind nicht Teil von `npm run check` bzw. nicht aus der Sandbox ausführbar (Commit/Push durch Stakeholder).
### Restlücken
- `gap` wird im Adapter bereitgestellt (`selectGap`), aber in der UI bewusst NICHT zusätzlich angezeigt (keine Feature-Ausweitung gemäß Scope). Optional späteres Restticket: erzeugte Gap direkt in der No-Basis-Karte sichtbar machen.
- FE-ASK-03 (Evidenz-Level/`knowledgeClass` in der UI anzeigen) bleibt separater Punkt aus SCRUM-105 (nicht Teil von SCRUM-138).
### Jira-Empfehlung
- SCRUM-138 darf nach grünem Gate auf erledigt gesetzt werden (Shape-Fix gebaut + getestet, `npm run check` grün).
- Folge für SCRUM-105: FE-ASK-01/02/04/05 sind jetzt nicht mehr durch den Shape-Bug blockiert und sollten in einem Folge-Audit erneut bewertet werden; FE-ASK-03 bleibt offen (Evidenz-Level-Anzeige).
- Keine Jira-Änderung durch Claude vorgenommen.

---

## SCRUM-137 — Evidenz-Level/KnowledgeClass in Ask-Antwort — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/lib/knowledgeClass.ts` (neu, DOM-frei): `KNOWLEDGE_CLASS_META: Record<KnowledgeClass, { labelKey; tone }>` (Record erzwingt Vollständigkeit) + `knowledgeClassMeta()`.
- `apps/web/src/pages/Ask.tsx`: Evidenz-Pill neben `ask.fromValidated`; `EVIDENCE_TONE`-Map (Tone→Tailwind-Tokens). Trust/ConfidenceBar, Schritte, Quellen, Helpful, No-Basis-Karte unverändert.
- `apps/web/src/i18n.ts`: DE/EN-Keys `ask.evidence` + `ask.knowledgeClass.{gesichert,ungeprueft,meinung,extern,annahme,unbekannt}` (verständliche Labels).
- `tests/ask/knowledge-class.test.ts` (neu): Mapping-Vollständigkeit + Tones.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
### Erfüllte Akzeptanzkriterien
- Ask-Antwortkarte zeigt KnowledgeClass/Evidenz-Level als Badge.
- Trust/ConfidenceBar bleibt sichtbar; Quellen + Argumentationsschritte bleiben sichtbar; Helpful-Button unverändert; No-Basis-Karte unverändert.
- DE/EN-i18n vollständig (alle 6 Klassen + allgemeines Label).
- Test deckt Mapping/Anzeige-Vorbereitung ab (alle Werte, Vollständigkeit, Tone für gesichert/unbekannt).
- Kein Backend/Reasoner/Gap/Mobile/Analytics angefasst.
### Tests / Gate
- Gezielter Lauf: `vitest run tests/ask/knowledge-class.test.ts` → 2/2 grün.
- `npm run check`: GRÜN (exit 0) — build/lint/arch/test (23 Dateien / 119 Tests).
- `vite build`/`git push` nicht Teil von `npm run check` bzw. nicht aus Sandbox (Stakeholder-Schritt).
### Restlücken
- Keine funktionalen. Optional: Evidenz-Badge auch im KO-Detail/anderen Stellen (separater Scope, nicht Teil von SCRUM-137).
### Jira-Empfehlung
- SCRUM-137 darf nach grünem Gate auf erledigt gesetzt werden.
- Folge für SCRUM-105/FE-ASK-03: Evidenz-Level ist jetzt in der Ask-Antwort sichtbar — FE-ASK-03 kann (zusammen mit dem SCRUM-138-Shape-Fix) neu bewertet/abgehakt werden.
- Keine Jira-Änderung durch Claude vorgenommen.

---

## SCRUM-150 — Echte Auth-Rolle an Navigation/Routing — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/lib/effectiveRole.ts` (neu, DOM-frei): `effectiveRole(sessionRole, previewRole)` (Session gewinnt, sonst Preview) + `effectiveStufe2(role, toggle)` (nur Admin).
- `apps/web/src/app/RoleContext.tsx`: `RoleProvider` liest jetzt `useSession()`; effektive Rolle = `user.role ?? previewRole`; `setRole` ändert nur den lokalen Preview-Wert; Stufe-2 über `effectiveStufe2`; neuer Flag `isSessionRole`.
- `apps/web/src/shell/Sidebar.tsx`: Rollen-Vorschau-Schalter nur noch im Preview (`!isSessionRole`); Stufe-2-Toggle bleibt für (effektive) Admin-Rolle. Keine UI-Neugestaltung.
- `tests/foundation/effective-role.test.ts` (neu): Rollenableitung.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
- Unverändert (konsumieren dieselbe `useRole()`-API → automatisch effektive Rolle): `CommandPalette.tsx`, `routes.tsx`, `Start.tsx`, `KnowledgeDetail.tsx`, `navigation.ts`.
### Erfüllte Akzeptanzkriterien
- Eingeloggte User: Navigation/Routen folgen der echten Session-Rolle (`user.role`), da diese in `effectiveRole` gewinnt.
- Lokaler Dev-/Preview-Schalter überschreibt eingeloggte User nicht mehr (`setRole` wirkt nur auf `previewRole`; Session dominiert) — und ist für eingeloggte User in der Sidebar ausgeblendet.
- CommandPalette + Route-Guards (`routes.tsx`) + Sidebar nutzen konsistent dieselbe effektive Rolle aus `useRole()`.
- Stufe-2 bleibt Admin-gebunden (`effectiveStufe2` → nur bei `role==="admin"`).
- Test deckt die Rollenableitung ab (Session gewinnt; Fallback ohne Session; Stufe-2 nur Admin inkl. Override-Fall).
- Kein Backend/Permission-System geändert (serverseitiges RBAC unangetastet).
### Tests / Gate
- Gezielter Lauf: `vitest run tests/foundation/effective-role.test.ts` → 3/3 grün.
- `npm run check`: GRÜN (exit 0) — build/lint/arch/test (24 Dateien / 122 Tests).
- `vite build`/`git push` nicht Teil von `npm run check` bzw. nicht aus Sandbox (Stakeholder-Schritt).
### Restlücken
- Dev-/Preview-Schalter bleibt absichtlich erhalten (nur ohne Session aktiv) — gewünschter Komfort, klar getrennt.
- Reiner Logik-/Helper-Test; eine FE-Komponentenrendertest-Abdeckung von Sidebar/RoleProvider gibt es projektweit nicht (FE ohne Komponententests) — kein Blocker.
### Jira-Empfehlung
- SCRUM-150 darf nach grünem Gate auf erledigt gesetzt werden.
- Folge für SCRUM-98/FE-FND-02: Navigation/Routing nutzen jetzt die echte Session-Rolle → FE-FND-02 kann von „teilweise" auf erfüllt neu bewertet werden.
- Keine Jira-Änderung durch Claude vorgenommen.

---

## SCRUM-152 — Session-Polling + sicherer Auth-Zustand (FE-FND-08) — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/lib/sessionState.ts` (neu, DOM-frei, ohne API-Client-Import): `SESSION_REFRESH_MS = 5 min`; generisch `resolveSessionUser<T>({ data, isError })` → bei Fehler `null` (kein stale User).
- `apps/web/src/app/AuthContext.tsx`: `status`- und `me`-Query mit `refetchInterval: SESSION_REFRESH_MS` + `refetchOnWindowFocus: true`; `user` = `resolveSessionUser({ data: me.data, isError: me.isError })`.
- `tests/foundation/session-state.test.ts` (neu): Ableitung + Intervall.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
- Unverändert: RoleContext (SCRUM-150-Logik), Navigation, Auth-API, Backend.
### Erfüllte Akzeptanzkriterien
- Session konsistent nach Login/Logout/Refresh: Login → `refresh()` (invalidate `["auth"]`) bestand; jetzt zusätzlich periodisches Nachladen (5 min) + Fokus-Refetch. Logout (`signOut`) leert Cache + Hard-Reload (bestand).
- Session-Ablauf/Backend-Fehler → kein stale User: `me.isError` ⇒ `user = null` (sicherer Zustand → Login-Gate).
- Profil-/Passwortänderung: `Profile.tsx` löst nach Passwortwechsel `signOut` aus (relevante Session-Daten werden invalidiert/zurückgesetzt) — unverändert, AK erfüllt.
- Verhalten getestet: neuer gezielter Test (4 Fälle) + bestehende Auth-Service-Tests (`auth/service.test.ts` FR-AUTH-04 Logout, „me ohne Token → 401").
- `npm run check` grün; zusätzlich apps/web-`tsc` grün.
- Kein Backend-Auth-Redesign, kein neues Rollenmodell, keine Navigation-/Sidebar-Änderung, SCRUM-150 unangetastet.
### Gelaufene Checks
- Gezielter Lauf: `vitest run tests/foundation/session-state.test.ts` → 4/4 grün.
- `npm run check`: GRÜN (exit 0) — build/lint/arch/test (25 Dateien / 126 Tests).
- apps/web `tsc --noEmit`: grün (deckt `AuthContext.tsx` im DOM-Kontext ab; `npm run check`/Root-tsc erreicht apps/web nur über Tests).
- Hinweis aufgetreten und behoben: `resolveSessionUser` zunächst mit `api/auth`-Import → zog `api/client.ts` (latente `exactOptionalPropertyTypes`-Strictness) in den Root-Typecheck. Durch generische, importfreie Variante gelöst — `client.ts` NICHT geändert (außerhalb Scope).
### Restlücken
- „Optimistische Updates" sind konservativ umgesetzt: Login/Logout aktualisieren den Zustand sofort über `refresh()`/`signOut` + Refetch; ein feiner-granularer optimistischer Cache-Write für Session wurde bewusst nicht ergänzt (UX/Test-Stabilität). Kein Blocker.
- Refetch-Intervall fix (5 min); falls gewünscht später konfigurierbar.
### Jira-Empfehlung
- SCRUM-152 darf nach grünem Gate auf erledigt gesetzt werden.
- FE-FND-08 (SCRUM-98) kann von „teilweise" auf erfüllt neu bewertet werden: periodisches Nachladen + Fokus-Refetch + stale-sicherer User-Zustand sind jetzt vorhanden und getestet.
- Keine Jira-Änderung durch Claude vorgenommen.

---

## SCRUM-151 — Toaster-/Benachrichtigungs-Bus (FE-FND-04) — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/lib/toastBus.ts` (neu, DOM-frei): Queue-/Reducer-Logik (`addToast`/`removeToast`, `MAX_TOASTS`-Cap, Typen `ToastKind=success|error|info`).
- `apps/web/src/app/ToastContext.tsx` (neu): `ToastProvider` + `useToast()` (`push(kind,message)`, `dismiss(id)`, Auto-Dismiss nach 4 s via `useReducer` über die reine Logik).
- `apps/web/src/shell/ToastViewport.tsx` (neu): zentraler Viewport (fixed unten rechts), schließbar (`<output>`-Element, Tone-Stile success/error/info).
- `apps/web/src/App.tsx`: `ToastProvider` um `Gate` (app-weit verfügbar, auch auf Auth-Screens).
- `apps/web/src/shell/AppShell.tsx`: `<ToastViewport/>` zentral gemountet.
- `apps/web/src/pages/Capture.tsx`: Pilot — „Als Entwurf speichern" pusht Erfolg-/Fehler-Toast.
- `apps/web/src/i18n.ts`: `toast.dismiss` (DE/EN).
- `tests/foundation/toast-bus.test.ts` (neu): Reducer/Queue/Cap.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
### Pilot-Anbindung
- Capture „Als Entwurf speichern" (`saveDraft`): `onSuccess` → `push("success", capture.draftSaved)`, `onError` → `push("error", state.error)`. Bestehende lokale `notice`/`err` bleiben erhalten (keine Flow-Änderung).
### Erfüllte Akzeptanzkriterien
- Wiederverwendbarer Bus: `useToast().push(kind, message)` app-weit.
- Einheitliche Erfolg/Fehler/Info-Meldungen (3 Tones).
- Toasts werden sichtbar gerendert (Viewport), sind schließbar (X) und verschwinden automatisch (4 s).
- Mindestens eine echte UI-Aktion nutzt den Bus (Capture-Speichern).
- Notification-Glocke/Feed (Konflikte/Lücken) unverändert — strikt getrennt vom Toast-Bus.
- Tests + Gate-Evidenz: reiner Reducer/Queue getestet (4 Fälle); apps/web-`tsc` deckt Provider/Viewport/Mount im DOM-Kontext ab.
- `npm run check` grün; kein Backend-Notification-Redesign.
### Gelaufene Checks
- Gezielter Lauf: `vitest run tests/foundation/toast-bus.test.ts` → 4/4 grün.
- apps/web `tsc --noEmit`: grün (Provider/Viewport/App/AppShell/Capture).
- `npm run check`: GRÜN (exit 0) — build/lint/arch/test (26 Dateien / 130 Tests).
- Lint-Hinweis behoben: `role="status"` → semantisches `<output>` (Biome `useSemanticElements`).
### Restlücken
- Nur eine Pilot-Anbindung (Capture-Speichern). Weitere Stellen (Profil/Login/Validation/Konflikt-Aktionen) können den Bus schrittweise nutzen — bewusst nicht breit refactored (Scope).
- Kein FE-Komponenten-Rendertest für den Viewport (FE projektweit ohne Komponententests); reine Bus-Logik ist getestet.
### Jira-Empfehlung
- SCRUM-151 darf nach grünem Gate auf erledigt gesetzt werden.
- FE-FND-04 (SCRUM-98) kann von „teilweise/offen" auf erfüllt neu bewertet werden (wiederverwendbarer Toast-Bus + zentrale Anzeige + Pilot vorhanden und getestet).
- Keine Jira-Änderung durch Claude vorgenommen.

---

## SCRUM-134 — Bibliothek: UI-Filter + Server-Search (FE-LIB-01) — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/api/endpoints.ts`: neuer `library.search(params: KoFilter & { q?: string })` → `GET /api/library/search?q=&type=&status=&category=&tag=` (über `qs`).
- `apps/web/src/api/hooks.ts`: neuer Hook `useLibrarySearch(params)`.
- `apps/web/src/lib/libraryQuery.ts` (neu, DOM-frei, ohne API-Client-Import): `LibraryFilterState`, `EMPTY_LIBRARY_FILTER`, `buildLibraryQuery(state)` (trimmt Volltext, lässt leere Felder weg).
- `apps/web/src/pages/Library.tsx`: kompakte Filterleiste (Volltext + Art + Status + Domäne/Kategorie + Tags); Ergebnisse via `useLibrarySearch`; Optionen Art/Status aus Konstanten, Domäne/Tags aus ungefiltertem Bestand (`useKos` + `categoryOptions`/`tagOptions`).
- `apps/web/src/i18n.ts`: `lib.allTypes`, `lib.allCategories`, `lib.allTags` (DE/EN).
- `tests/library/library-query.test.ts` (neu): Query-Builder.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
### Gewählter Such-/Filterpfad
- **Server-Search-/Filterpfad**: `GET /api/library/search` → `LibraryService.search(q, KoFilter)` (Volltext über Titel+Aussage + `koService.list`-Filter Art/Status/Kategorie/Tag). Belegt durch bestehende Backend-Tests: `library-analytics/service.test.ts` FR-LIB-01 (Volltext), `knowledge-object/service.test.ts` FR-KO-02 (Wissensart filterbar) + FR-KO-03 (Kategorie/Tags filterbar). FE-seitig getestet: `buildLibraryQuery` (Querystring-Aufbau, Trim, Weglassen leerer Felder).
### Erfüllte Akzeptanzkriterien
- UI-Suche + Filter sichtbar (Volltext + 4 Selects).
- Filter kombinierbar und wirken tatsächlich (alle als Query-Parameter an den Server; AND serverseitig).
- Server-Search-/Filterpfad belegt (Endpoint + Service + Tests); keine Fake-Filter (Backend filtert real, getestet).
- FE-LIB-01 erfüllt: Volltext (Titel/Aussage) + Art + Status + Domäne/Kategorie + Tags, kombinierbar.
- Test + Gate-Evidenz vorhanden; `npm run check` grün.
- Kein Export/Import (SCRUM-135/108), keine Re-Validierung (SCRUM-136), kein Backend-Redesign, keine Library-Neugestaltung.
### Gelaufene Checks
- Gezielter Lauf: `vitest run tests/library/library-query.test.ts` → 4/4 grün.
- apps/web `tsc --noEmit`: grün (Library.tsx/Endpoint/Hook im DOM-Kontext).
- `npm run check`: GRÜN (exit 0) — build/lint/arch/test (27 Dateien / 134 Tests).
### Restlücken
- Volltext serverseitig über Titel+Aussage (nicht zusätzlich Tags/Autor) — der vorhandene `LibraryService.search` deckt Titel/Aussage; Tag ist als eigener Filter abgedeckt. Erweiterung auf Autor/Tags im Volltext wäre ein kleines Backend-Restticket (außerhalb Scope).
- Domäne/Tag-Optionen aus dem ungefilterten Bestand (`useKos`) abgeleitet — stabil; bei sehr großen Beständen ggf. später ein dedizierter Facetten-Endpoint.
- Optionaler Toast für Fehler nicht ergänzt (QueryState zeigt Fehlerzustand); bewusst minimal.
### Jira-Empfehlung
- SCRUM-134 darf nach grünem Gate auf erledigt gesetzt werden.
- FE-LIB-01 (SCRUM-107) kann jetzt abgehakt werden: Volltextsuche + strukturierte Filter (Art/Status/Domäne/Tags) sind sichtbar, kombinierbar, über den getesteten Server-Search-/Filterpfad wirksam.
- Keine Jira-Änderung durch Claude vorgenommen.

---

## SCRUM-135 — Bibliothek: Text-MD-Export + Format-Auswahl (FE-LIB-03) — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `services/library-analytics/src/service.ts`: neue `exportMarkdown(ids?)` (echtes Text-Markdown: `# Titel`, Listen für Bedingungen/Maßnahmen, Herkunfts-Fußzeile, `---`-Trenner).
- `services/app/src/routes/library-routes.ts`: Route-Zweig `format=markdown` → `content-type: text/markdown; charset=utf-8`.
- `services/library-analytics/src/service.test.ts`: Backend-Test „Export als Text-Markdown".
- `apps/web/src/lib/libraryExport.ts` (neu, DOM-frei): `EXPORT_FORMATS`, `exportUrl(format)`, `exportFilename(format)`, `exportFormatMeta`.
- `apps/web/src/pages/Library.tsx`: Format-Auswahl (Select JSON/Text-MD/MediaWiki/HTML) + Download-Anchor mit `download`-Dateinamen.
- `apps/web/src/i18n.ts`: `lib.exportFormat` + `lib.format.{json,markdown,mediawiki,html}` (DE/EN).
- `tests/library/library-export.test.ts` (neu): Format-/URL-/Dateinamen-Logik.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
### Implementierte Exportformate
- **JSON** (Default), **Text (Markdown)** — neu, **MediaWiki**, **HTML (Druck/PDF)**. Alle über `GET /api/library/export?format=…` mit korrekten Content-Types; FE setzt `download`-Dateinamen (`klarwerk-export.{json,md,wiki,html}`).
### PDF-Entscheidung
- **Option B gewählt:** HTML ist bewusst die Druck-/„print to PDF"-Ansicht (`exportHtml`, `@media print`), KEIN dedizierter PDF-Export. Kein schweres PDF/NPM-Paket eingeführt, keine Fake-`.pdf`-Datei. In der UI klar als „HTML (Druck/PDF)" / „HTML (print/PDF)" beschriftet.
### Erfüllte Akzeptanzkriterien
- UI bietet Format-Auswahl (Select) — ja.
- JSON, MediaWiki, HTML/Print und Text-MD erreichbar — ja.
- Text-MD implementiert UND getestet (Backend-Test `exportMarkdown`; FE-URL-/Format-Test) — ja.
- PDF fachlich sauber entschieden + dokumentiert (Option B) — ja.
- Tests belegen Exportformate + Format-/URL-/MIME-Logik — ja.
- `npm run check` grün — ja.
- Kein Import/Re-Import (SCRUM-108), keine Re-Validierung (SCRUM-136), keine große Export-Architektur, kein schweres PDF-Paket.
### Gelaufene Checks
- Gezielter Lauf: `vitest run tests/library/library-export.test.ts services/library-analytics/src/service.test.ts` → 11/11 grün.
- apps/web `tsc --noEmit`: grün.
- `npm run check`: GRÜN (exit 0) — build/lint/arch/test (28 Dateien / 138 Tests).
### Restlücken
- Echter, eigenständiger PDF-Export (nicht Druck) bleibt bewusst offen (kein passendes leichtgewichtiges Paket im Scope) — falls fachlich gefordert, eigenes Ticket.
- Export immer über den gesamten Bestand (keine ID-Auswahl im UI) — `exportJson(ids?)` unterstützt IDs serverseitig; UI-Selektion wäre separater Ausbau.
### Jira-Empfehlung
- SCRUM-135 darf nach grünem Gate auf erledigt gesetzt werden.
- FE-LIB-03 (SCRUM-107): JSON/Text-MD/MediaWiki/HTML+Format-Auswahl sind erfüllt. Für „PDF" empfehle ich, die Checkbox als HTML/Druck-PDF zu interpretieren (Option B) ODER FE-LIB-03 als „erfüllt mit Hinweis: PDF = Druckansicht" abzuhaken; ein dedizierter PDF-Export wäre ein separates Ticket. Keine Jira-Änderung durch Claude.

---

## SCRUM-136 — Bibliothek: Re-Validierung pro KO (FE-LIB-05) — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/lib/revalidation.ts` (neu, DOM-frei): `canRevalidate(status)` — nur validierte KOs.
- `apps/web/src/pages/Library.tsx`: pro Zeile (nur `validiert`) Button „Re-Validierung starten"; Zeile von einzelnem `<Link>` zu `<div>` mit `<Link>`(Info) + Button (Sibling, kein Navigations-Bubbling). Mutation + Toast + Query-Invalidierung.
- `apps/web/src/i18n.ts`: `lib.revalidate`, `lib.revalidateDone` (DE/EN).
- `tests/library/revalidation.test.ts` (neu): `canRevalidate`.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
### Genutzter Endpoint/Service
- **Vorhandener Pfad** `endpoints.ko.act(id, { action: "revalidate" })` → KO-Dispatcher `ko-routes.ts` `case "revalidate"` → `lifecycle.confirmStillValid` → `koService.revise` (neue Version, Status zurück auf `offen`, Pending geleert). Kein neuer Endpoint, kein neues Statusmodell. Backend-getestet: `lifecycle/service.test.ts` FR-LIF-01, `knowledge-object/service.test.ts` FR-KO-04.
### UI-Verhalten
- Button nur bei `status === "validiert"` (kein widersprüchlicher Re-Validieren-Knopf für bereits offene/in-Prüfung-KOs; vorhandene Display-/Statuslogik respektiert).
- Während der Mutation für genau dieses KO deaktiviert (`isPending && variables === id`).
- Erfolg → Toast „Re-Validierung gestartet." + Invalidierung von `library`/`kos`/`validation`/`lifecycle` (das KO erscheint danach wieder im Validation Board). Fehler → Fehler-Toast.
### Erfüllte Akzeptanzkriterien
- Sichtbare Re-Validierungsaktion pro KO (für validierte) — ja.
- Nutzt vorhandenen Lifecycle-/KO-Pfad (`revalidate`) — ja.
- Erfolg-/Fehler-Rückmeldung über Toast-Bus (SCRUM-151) — ja.
- Kein neues Statusmodell, keine neuen Statuslabels — ja.
- Tests + Gate-Evidenz: `canRevalidate`-Test + bestehende Backend-Tests des revalidate-Pfads; apps/web-tsc deckt UI-Wiring ab.
- `npm run check` grün — ja.
- Kein Import/Re-Import, keine Bulk-Auswahl, keine Library-Neugestaltung.
### Gelaufene Checks
- Gezielter Lauf: `vitest run tests/library/revalidation.test.ts` → 1/1 grün.
- apps/web `tsc --noEmit`: grün.
- `npm run check`: GRÜN (exit 0) — build/lint/arch/test (29 Dateien / 139 Tests).
### Restlücken
- Keine Bulk-Re-Validierung (bewusst, Einzelaktion gefordert).
- Semantik: `revalidate` = `confirmStillValid` (Revise → zurück in Prüfung). Falls fachlich zwischen „noch gültig bestätigen" und „aktiv neu prüfen lassen" unterschieden werden soll, wäre das ein eigenes Lifecycle-Ticket (kein neues Statusmodell in diesem Scope).
### Jira-Empfehlung
- SCRUM-136 darf nach grünem Gate auf erledigt gesetzt werden.
- FE-LIB-05 (SCRUM-107) kann abgehakt werden: Re-Validierung ist nun direkt aus der Bibliotheksliste pro KO startbar (für validierte Objekte), mit Rückmeldung.
- Keine Jira-Änderung durch Claude vorgenommen.

---

## SCRUM-147 + SCRUM-148 + SCRUM-149 — Admin-Restpaket — Nachbericht
Datum: 2026-06-25
### Geänderte Dateien
- `apps/web/src/pages/Admin.tsx`: Create-User-Formular, per-Nutzer Passwort-Reset-Flow, Audit-Sektion. Bestehende Liste/Freigabe/Rolle/Löschen unverändert übernommen.
- `apps/web/src/api/endpoints.ts`: neuer Wrapper `users.resetPassword(id, password)` → `POST /api/auth/users/:id/reset`.
- `apps/web/src/lib/adminForms.ts` (neu, DOM-frei): `isNewUserValid`, `isPasswordResetValid`, `isUserAuditAction`, `MIN_PASSWORD`.
- `apps/web/src/i18n.ts`: `adm.*`-Keys (DE/EN) für Anlegen/Reset/Audit.
- `tests/foundation/admin-forms.test.ts` (neu): Validierung + Audit-Filter.
- `docs/qm/claude-after-report.md`: dieser Nachbericht.
### SCRUM-147 — Nutzer anlegen
- Formular Name/E-Mail/Passwort(≥8)/Rolle; Submit gesperrt bis `isNewUserValid`. Endpoint `endpoints.users.create` → `POST /api/users`. Erfolg → `["users"]` invalidiert + Erfolgs-Toast + Formular-Reset; Fehler → Fehler-Toast.
- AK erfüllt: UI gebaut, nutzt echte API, Liste invalidiert, Erfolg/Fehler sichtbar; kein neues Nutzermodell/RBAC-Redesign.
### SCRUM-148 — Admin-Passwort-Reset
- FE-Wrapper ergänzt (`users.resetPassword`) → bestehender Backend-Pfad `POST /api/auth/users/:id/reset` → `service.resetPassword(id, pw, admin.id)` (invalidiert Sitzungen, FR-AUTH-06). Per-Nutzer „Schlüssel"-Button öffnet inline Neues-Passwort + „Zurücksetzen" (gesperrt bis ≥8). Erfolg-Toast „…alle Sitzungen beendet"; Fehler-Toast.
- Self-Service-Reset (Token, `/auth/reset`) bleibt getrennt und unangetastet.
- AK erfüllt: sicherer Admin-Reset-Flow, echter Backend-Pfad, Sessions invalidiert (wie Backend-Test), Erfolg/Fehler sichtbar.
### SCRUM-149 — Admin-Audit-Einsicht
- **Entscheidung: kleine echte Audit-Sektion in Admin** (ohne Service-Umbau), gespeist aus der echten Audit-API `useAudit()` → `GET /api/audit`, gefiltert via `isUserAuditAction` (Aktionen mit Präfix `user.`/`auth.`: login/logout/approve/role-change/password-reset/delete/oidc-provisioned). Letzte 15, neueste zuerst; Leerzustand sonst. KEINE Mockdaten, kein Audit-Service-Redesign. (Analytics bleibt zusätzlich die globale Audit-Sicht.)
- AK erfüllt: Audit aus echter API, keine Mocks, kein Redesign; Entscheidung dokumentiert.
### Genutzte Endpoints
- `POST /api/users` (Anlegen), `POST /api/auth/users/:id/reset` (Reset), `GET /api/audit` (Audit), bestehende `approve`/`PUT /users/:id`/`DELETE`.
### Tests / Gates
- Gezielter Lauf: `vitest run tests/foundation/admin-forms.test.ts` → 3/3 grün. Backend-Reset getestet: `auth/service.test.ts` FR-AUTH-06 + „löscht Nutzer und schreibt Audit".
- apps/web `tsc --noEmit`: grün. `npm run check`: GRÜN (exit 0) — build/lint/arch/test (30 Dateien / 142 Tests).
### Restlücken
- Audit-Sektion zeigt globale user-/auth-Audit-Aktionen (nicht je-Nutzer gefiltert) — bewusst kompakt; je-Nutzer-Drilldown wäre ein kleiner Folgeausbau.
- „user.create" wird serverseitig nicht als eigene Audit-Aktion geführt (Register/Setup loggen keinen create-Event) — außerhalb dieses FE-Scopes; optionales Backend-Restticket.
- Reset-Passwort wird vom Admin in ein Feld eingegeben (kein generiertes Einmal-Link-Verfahren) — entspricht dem vorhandenen Backend-Pfad.
### Jira-Empfehlung
- SCRUM-147, SCRUM-148, SCRUM-149 dürfen nach grünem Gate auf erledigt gesetzt werden.
- FE-ADM-02 (Anlegen) + FE-ADM-05 (Admin-Reset) + FE-ADM-07 (Audit-Einsicht) aus SCRUM-112 können entsprechend abgehakt werden.
- Keine Jira-Änderung durch Claude vorgenommen.

---

## 2026-06-25 · SCRUM-108 + SCRUM-116 + FE-LIB-04 — Import/Re-Import-MVP (JSON + Source-Review-Queue)

**Ticket(s):** SCRUM-116 (Backend Import-/Source-Review-API) · SCRUM-108 (FE Import/Source-Review) · SCRUM-107/FE-LIB-04 (Re-Import JSON inkl. Merge ohne Dubletten). Bewusst begrenzter MVP: nur JSON, kein PDF/OCR.

**Änderung (geänderte/neue Dateien):**
- `services/library-analytics/src/types.ts` — neu: `ReviewStatus`, `ReviewAction`, `ImportCandidate`, `LibraryError` (code-basiert).
- `services/library-analytics/src/service.ts` — In-Memory-Candidate-Queue (kein neuer Persistenz-Layer); Methoden `createImportCandidates` (Dubletten-Erkennung über title|statement), `listImportCandidates`, `reviewImportCandidate` (accept→echtes KO via koService.create außer Dublette; reject; info+Notiz). Optionale deps genId/now (default randomUUID/Date). Audit-Events import.candidates-created / import.candidate-{accept,reject,info}.
- `services/library-analytics/index.ts` — Exporte ergänzt (ImportCandidate/ReviewStatus/ReviewAction/LibraryError).
- `services/app/src/routes/library-routes.ts` — POST /api/library/import/candidates (ko.create), GET /api/library/import/candidates (ko.read), PUT /api/library/import/candidates/:id (ko.validate). Bestehende /api/library/import (importJson) unangetastet.
- `services/library-analytics/src/service.test.ts` — 3 neue Tests (Kandidaten+Dublettenflag; accept erzeugt KO / Dublette übersprungen; reject/info + kein Doppel-Review).
- `apps/web/src/api/types.ts` — `ImportItemInput`, `ReviewStatus`, `ReviewAction`, `ImportCandidate`.
- `apps/web/src/api/endpoints.ts` — `library.importCandidates.{create,list,review}`.
- `apps/web/src/api/hooks.ts` — `useImportCandidates()`.
- `apps/web/src/lib/importReview.ts` — neu, DOM-frei: `parseImportItems` (strenge JSON-Validierung) + `ImportParseError`.
- `tests/library/import-review.test.ts` — 4 Tests (gültige Liste; ungültiges JSON; kein Array; fehlende/ungültige Felder).
- `apps/web/src/pages/Stufe2.tsx` — `ImportReview` als echte Seite: Datei-Upload (.json) → parse → Kandidaten erzeugen (Toast); Review-Queue mit Status-/Dubletten-Badge, Annehmen/Ablehnen/Info-anfordern (+Notizfeld); invalidiert import-candidates/kos/library/validation.
- `apps/web/src/pages/Library.tsx` — Header-Link „Re-Import (JSON)" → /import (FE-LIB-04: Re-Import über echten Review-Flow, keine stille Bulk-Anlage).
- `apps/web/src/i18n.ts` — `imp.*` + `lib.reimport` (DE+EN).

**Erfüllte AK:**
- SCRUM-116: Kandidaten erzeugen ✓ · listen ✓ · Review-Status verwalten ✓ · Aktionen annehmen/ablehnen/Info ✓ · angenommene → echte KOs im bestehenden Wissensobjektfluss ✓ · Dubletten nachvollziehbar (Flag, kein stilles Überschreiben) ✓ · keine neue Persistenzarchitektur (In-Memory) ✓ · keine Mock-API ✓.
- SCRUM-108: JSON-Dateiannahme/Re-Import-UI ✓ · erzeugt Kandidaten statt stiller Bulk-Anlage ✓ · Queue/Review mit Status ✓ · annehmen/ablehnen/Info ✓ · Erfolg/Fehler via Toast-Bus ✓ · echte API aus SCRUM-116 ✓ · keine Platzhalter-UI ✓.
- FE-LIB-04 (SCRUM-107): Bibliothek bietet JSON-Re-Import über echten Review-Flow ✓ · keine stille Bulk-Anlage ✓ · Dubletten/Merge sichtbar ✓ · akzeptierter Kandidat → echtes KO ✓.

**Genutzte Endpoints:** POST /api/library/import/candidates · GET /api/library/import/candidates · PUT /api/library/import/candidates/:id (+ bestehende /api/library/import unverändert).

**Tests/Gates:** `npm run check` GRÜN — 31 Testdateien / 149 Tests (7 neu). apps/web `tsc --noEmit` EXIT=0. depcruise: keine Verstöße (114 Module). Biome grün.

**Restlücken:** PDF/OCR weiterhin offen — bewusst NICHT Teil dieses MVP; bleibt separates Capture/Import-Restticket (FE-IMP-01 hier nur für JSON adressiert). Candidate-Queue ist In-Memory (MVP) — bei Server-Neustart leer; ggf. späteres Persistenz-Restticket. Merge-Strategie: Dublette wird übersprungen (kein Feld-Merge) — bewusst konservativ.

**Jira-Empfehlung:** Nach grünem Gate dürfen SCRUM-116 und SCRUM-108 auf erledigt; FE-LIB-04 erfüllt → SCRUM-107 schließbar. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab. Commit/Push bleibt Peters Schritt.

---

## 2026-06-25 · SCRUM-139 + SCRUM-140 + SCRUM-143 — Analytics-Kompaktblock (Trust/Aufgaben · Impact · Audit-Filter)

**Ticket(s):** SCRUM-139 (Trust & Aufgaben im Dashboard) · SCRUM-140 (Impact-Metriken anbinden) · SCRUM-143 (Audit-Filter). Bewusst kompakt; KEIN Knowledge-Health (SCRUM-141), KEINE Lineage (SCRUM-142), kein Management/Capital, kein Audit-Service-Redesign.

**Befund (read-only):** Impact-API existiert bereits (`GET /api/analytics/impact` → ImpactReport in services/app/src/impact.ts). Audit-Route unterstützt bereits AuditFilter (actor/action/target) als Querystring. → Block ist FE-/Mapping-Arbeit, kein Backend-Ausbau nötig.

**Änderung (geänderte/neue Dateien):**
- `apps/web/src/api/types.ts` — neu: `AuditFilter`, `ImpactReport` (spiegelt Backend-Shape).
- `apps/web/src/api/endpoints.ts` — `analytics.impact()` → /analytics/impact.
- `apps/web/src/api/hooks.ts` — `useImpact()`.
- `apps/web/src/lib/analyticsMetrics.ts` — neu, DOM-frei: averageTrust, validationRate, workloadSummary, formatRate, weeklyValidated, auditActors, auditActions, filterAudit.
- `apps/web/src/pages/Analytics.tsx` — Trust-/Validierungsquote-/Aufgaben-KPIs (datenbasiert aus useKos + useValidationOverview); Impact-Sektion (validatedTotal/askTotal/answeredWithoutGap/answerRate + validatedByWeek-Balken); Audit-Filterleiste (Actor-/Action-Dropdowns aus echten Daten, Target-Textfilter), leerer Filter = volle Liste, Trefferzähler.
- `apps/web/src/i18n.ts` — `ana.*` (avgTrust/validationRate/openTasks/doneTasks/impact*/weekly/filter*/auditCount/auditNoMatch), DE+EN.
- `tests/analytics/analytics-metrics.test.ts` — 8 Tests über die reinen Helfer.

**Erfüllte AK:**
- SCRUM-139: Trust-Kennzahl (Ø Vertrauen) + Validierungsquote sichtbar & datenbasiert ✓ · Aufgaben/Arbeitslast (offen/erledigt aus Validation-Overview) ✓ · keine Mock-/Demo-Zahlen ✓ · nur FE/Mapping, kein API-Ausbau ✓.
- SCRUM-140: Impact-API typisiert/angebunden ✓ · validatedByWeek, askTotal, answeredWithoutGap, answerRate sichtbar ✓ · keine neue Wirkungslogik ✓ · kein PDF/Management/Capital ✓.
- SCRUM-143: Audit filterbar nach Actor/Action/Target ✓ · Chain/Service unverändert ✓ · leerer Filter = aktuelle Liste ✓ · echte Daten, keine Mocks ✓ · keine Admin-UI-Änderung ✓.

**Genutzte Endpoints:** GET /api/analytics (bestehend) · GET /api/analytics/impact (neu angebunden) · GET /api/audit (bestehend, clientseitig gefiltert) · GET /api/kos · GET /api/validation/overview.

**Tests/Gates:** `npm run check` GRÜN — 32 Testdateien / 157 Tests (8 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Restlücken:** Audit-Filter clientseitig (über die geladene Liste) statt serverseitiger Query — bewusst, um Chain/Service nicht zu berühren; bei sehr großen Logs ggf. späterer Server-Filter-Umstieg. SCRUM-141 (Knowledge-Health-Score) und SCRUM-142 (Lineage/Herkunft) bleiben bewusst SEPARAT und unangetastet. Kein Management-/Capital-Dashboard.

**Jira-Empfehlung:** Nach grünem Gate dürfen SCRUM-139, SCRUM-140, SCRUM-143 auf erledigt. SCRUM-141/142 bleiben offen. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab. Commit/Push bleibt Peters Schritt.

---

## 2026-06-25 · SCRUM-144 + SCRUM-145 + SCRUM-146 — Lifecycle-/KO-Governance-Block (Autorenübergabe · Lernpfade · Asset-Change)

**Ticket(s):** SCRUM-144 (Autorenübergabe-UI) · SCRUM-145 (Lernpfad-UI je Rolle) · SCRUM-146 (Asset-Change/Revalidierungs-Auslöser). Reine FE-Anbindung an vorhandene Backend-Pfade; KEIN neues Autoren-/Provenance-/LMS-/Asset-Modell, keine Lineage (SCRUM-142), kein Management/Capital.

**Befund (read-only):** Alle Pfade existieren backendseitig:
- transfer-author: KO-Action `transfer-author` (ko-routes, Permission users.manage → Admin) → `lifecycle.transferAuthor` → `koService.setAuthor` (originalAuthor bleibt erhalten).
- Lernpfade: GET /api/learning-paths/:role · GET /api/learning-paths/:pathId/progress · POST /api/learning-paths/:pathId/complete.
- Asset-Change: POST /api/lifecycle/asset-changed (markiert gekoppelte KOs pending), GET /api/lifecycle/pending.
→ Kein Backend-Ausbau nötig.

**Änderung (geänderte/neue Dateien):**
- `apps/web/src/api/types.ts` — neu: `LearningStep`, `LearningPath` (spiegelt services/lifecycle).
- `apps/web/src/api/endpoints.ts` — `lifecycle.assetChanged`; `learningPaths.{byRole,progress,complete}`.
- `apps/web/src/api/hooks.ts` — `useLearningPath(role)` (retry:false), `useLearningProgress(pathId)` (enabled-gated).
- `apps/web/src/lib/learningPath.ts` — neu, DOM-frei: isStepDone, progressPercent, completedCount, nextOpenStep.
- `apps/web/src/pages/KnowledgeDetail.tsx` — SCRUM-144: Autor-Übergabe im Herkunfts-Card (Admin-only, Nutzerauswahl aus useDirectory ohne aktuellen Autor), transfer-author-Action, Toast-Erfolg/-Fehler, Queries invalidiert; Originalautor weiterhin via ProvenanceLine sichtbar + explizite „Originalautor"-Zeile.
- `apps/web/src/pages/Lifecycle.tsx` — SCRUM-146: Asset-Change-Auslöser (assetRef-Eingabe → assetChanged → Trefferzahl-Hinweis + invalidate lifecycle); bestehende Pending-Liste & „Noch gültig" unverändert erhalten. SCRUM-145: rollenspezifischer Lernpfad (Rolle aus useSession), Schritte mit Fortschrittsbalken/Abhaken (complete → invalidate progress), Leer-Zustand ohne Mock.
- `apps/web/src/i18n.ts` — `ko.transfer*` + `lcy.*` (asset/path/step), DE+EN.
- `tests/lifecycle/learning-path-ui.test.ts` — 4 Tests über die reine Lernpfad-Logik.

**Erfüllte AK:**
- SCRUM-144: nutzt echte KO-Action transfer-author ✓ · Nutzerauswahl aus vorhandener Directory-API ✓ · Originalautor sichtbar erhalten ✓ · neuer + ursprünglicher Autor nachvollziehbar ✓ · Rollenbeachtung (Admin) ohne neue Rechte-Logik ✓ · Toast + Invalidierung ✓.
- SCRUM-145: Learning-Path-API typisiert/angebunden ✓ · rollenspezifischer Pfad sichtbar ✓ · Schritte angezeigt ✓ · Fortschritt abhakbar/serverseitig gespeichert ✓ · echte API, keine Mock-Pfade, kein LMS/KI ✓.
- SCRUM-146: UI-Auslöser für Asset-Change/Revalidierung ✓ · nutzt vorhandenen asset-changed-Pfad ✓ · Pending-Liste aktualisiert (invalidate) ✓ · Nachvollziehbarkeit (Banner + Trefferzahl je Asset) ✓ · keine Regression bei „Noch gültig"/Library-Revalidierung ✓.

**Genutzte Endpoints:** PUT /api/kos/:id (action transfer-author) · GET /api/learning-paths/:role · GET /api/learning-paths/:pathId/progress · POST /api/learning-paths/:pathId/complete · POST /api/lifecycle/asset-changed · GET /api/lifecycle/pending · PUT /api/kos/:id (revalidate, bestehend) · GET /api/directory.

**Tests/Gates:** `npm run check` GRÜN — 33 Testdateien / 161 Tests (4 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Restlücken:** FE-LCY-03 „hat geholfen" bleibt bewusst SEPARAT und wurde hier nicht gebaut. Lernpfad-Anlage/-Pflege (createPath) bleibt Admin-/Seed-Aufgabe — diese UI zeigt/bearbeitet nur den rollenspezifischen Pfad; ohne hinterlegten Pfad erscheint ein ehrlicher Leer-Zustand (kein Mock). Asset-Kopplung (couple) wird hier nicht über UI gepflegt; nur der Change-Auslöser ist angebunden. SCRUM-142 (Lineage) unberührt.

**Jira-Empfehlung:** Nach grünem Gate dürfen SCRUM-144, SCRUM-145, SCRUM-146 auf erledigt. FE-LCY-03 bleibt offen. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab. Commit/Push bleibt Peters Schritt.

---

## 2026-06-25 · SCRUM-111/FE-LCY-03 + SCRUM-131 (Teil) — Bewährungssignal „Hat geholfen" im KO-Detail

**Ticket(s):** SCRUM-111 / FE-LCY-03 (Signal „hat geholfen") · SCRUM-131 NUR den „hat geholfen"-Teil im KO-Detail. „Beitrag/Quelle" wurde bewusst NICHT improvisiert.

**Befund (read-only):** Helpful-Pfad existiert backendseitig vollständig: POST /api/ask/helpful → ask.markHelpful → Trust +HELPFUL_TRUST_STEP (+2, gedeckelt) → Audit action answer.helpful; getestet in FR-ASK-04. Ask-UI hatte den Button bereits; KO-Detail nicht. → reine FE-Wiederverwendung, KEIN Backend-Eingriff.

**Änderung (geänderte/neue Dateien):**
- `apps/web/src/lib/helpfulSignal.ts` — neu, DOM-frei: helpfulDisabled (während Mutation/nach Erfolg/zusätzlicher Grund), helpfulLabel (Dank-/Aktions-Text).
- `apps/web/src/pages/KnowledgeDetail.tsx` — neue Bewährungs-Card mit Button „Hat geholfen" → endpoints.ask.helpful(ko.id); Button via helpfulDisabled während/nach Mutation gesperrt; Toast-Dank bei Erfolg/Fehler; invalidiert ko/validation/kos/conflicts + analytics + audit.
- `apps/web/src/pages/Ask.tsx` — bestehender Helpful-Button auf denselben Helper umgestellt (Vereinheitlichung, identisches Verhalten; ask.helpful/ask.thanked unverändert).
- `apps/web/src/i18n.ts` — `ko.helpful*` (Title/Hint/helpful/Done/Thanks), DE+EN.
- `tests/ko/helpful-signal.test.ts` — 3 Tests (Disabled-Logik, Zusatzgrund, Label-Wechsel).

**Backend:** UNVERÄNDERT. Trust/Audit-Pfad bleibt durch FR-ASK-04 belegt; keine neue Route, kein neues Trust-/Lifecycle-Statusmodell.

**Erfüllte AK:**
- KO-Detail zeigt „Hat geholfen" sichtbar ✓ · Klick ruft vorhandenen Helpful-Endpoint mit KO-ID ✓ · Button während Mutation deaktiviert (und nach Erfolg) ✓ · Erfolg → Toast-Dank + Button-Dank-Text ✓ · Trust/Audit backendseitig unverändert (FR-ASK-04) ✓ · Test deckt Helper-/Button-Entscheidung ab ✓.

**Genutzte Endpoints:** POST /api/ask/helpful (bestehend, mit KO-ID).

**Tests/Gates:** `npm run check` GRÜN — 34 Testdateien / 164 Tests (3 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Status / Restlücken:**
- SCRUM-111 / FE-LCY-03: erfüllt — Signal „hat geholfen" jetzt in Ask UND KO-Detail.
- SCRUM-131: nur TEILWEISE erfüllt — der „hat geholfen"-Teil im KO-Detail ist fertig; „Beitrag/Quelle" bleibt bewusst OFFEN (nicht improvisiert) und ist separat zu bauen.
- Kein neues Trust-/Lifecycle-Statusmodell, kein „Beitrag/Quelle"-Flow.

**Jira-Empfehlung:** Nach grünem Gate darf SCRUM-111 (FE-LCY-03) auf erledigt. SCRUM-131 NICHT vollständig schließen — nur den Helpful-Teil als erledigt vermerken, „Beitrag/Quelle" bleibt offen. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab.

---

## 2026-06-25 · SCRUM-131 (Rest) — „Quelle/Beitrag melden" im KO-Detail

**Ticket(s):** SCRUM-131 letzter offener Teil (Beitrag/Quelle). Der „Hat geholfen"-Teil ist bereits durch Commit 6c2c7f6 erledigt. Bezug: FE-KO-06 (SCRUM-102).

**Befund (read-only):** KnowledgeObject hat KEIN sources/external-Feld (bestätigt in services/knowledge-object/src/types.ts). Vorhandene KO-Aktion `comment` (FE: { action: "comment"; text }). → bewusst KEIN Fake-Quellenfeld, KEIN Backend-Redesign; Persistenz über Kommentar-Pfad.

**Änderung (geänderte/neue Dateien):**
- `apps/web/src/lib/sourceContribution.ts` — neu, DOM-frei: `isSourceContributionValid` (Pflichttext nicht leer), `formatSourceComment` (maschinenlesbare Präfixe `Quellenbeitrag:` / `Quelle/Referenz:`, Quelle-Zeile nur wenn ausgefüllt, getrimmt).
- `apps/web/src/pages/KnowledgeDetail.tsx` — neue Card „Quelle/Beitrag melden": Pflicht-Textarea + optionales Quelle/URL-Feld + Hinweis „Review-Kommentar, keine validierte Quelle"; Submit über bestehende comment-Aktion (formatSourceComment); Button bis gültiger Pflichttext gesperrt; Toast-Erfolg/-Fehler; Invalidierung wie bei Kommentaren (ko/validation/kos/conflicts).
- `apps/web/src/i18n.ts` — `ko.source*` (Title/Contribution/Ref/Hint/Submit/Saved), DE+EN.
- `tests/ko/source-contribution.test.ts` — 4 Tests (Pflichtvalidierung, Formatierung mit/ohne Quelle, Trim).

**Backend:** UNVERÄNDERT. Kein neues sources/external-Feld, keine neue Route, keine Fake-Provenance. Beiträge sind normale KO-Kommentare.

**Erfüllte AK:**
- KO-Detail bietet „Quelle/Beitrag melden" sichtbar an ✓ · Pflichttext validiert ✓ · optionaler Quellen-/URL-Text übernommen ✓ · Submit über vorhandene comment-Aktion ✓ · kein neues Backend/Feld/Fake-Provenance ✓ · UI macht klar: Review-Kommentar, keine validierte Quelle ✓ · Test deckt Helper/Formatierung/Validierung ab ✓.

**Genutzte Endpoints:** PUT /api/kos/:id (action comment) — bestehend.

**Tests/Gates:** `npm run check` GRÜN — 35 Testdateien / 168 Tests (4 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Status / Restlücken:**
- SCRUM-131: jetzt VOLLSTÄNDIG erfüllbar — „Hat geholfen" (6c2c7f6) + „Quelle/Beitrag" (dieser Block).
- SCRUM-102 / FE-KO-06: nach grünem Gate abhakbar, da die Beitrags-/Quellenfunktion im KO-Detail nun vorhanden ist.
- Echtes strukturiertes sources/external-Datenmodell bleibt Roadmap (separat, falls fachlich gewünscht) — hier bewusst nicht gebaut.

**Jira-Empfehlung:** Nach grünem Gate dürfen SCRUM-131 vollständig und SCRUM-102/FE-KO-06 auf erledigt. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab. Commit/Push bleibt Peters Schritt.

---

## 2026-06-25 · SCRUM-129 — Echtes Quellen-/External-Modell am Wissensobjekt (FR-KO-07 / FE-KO-01+07)

**Ticket(s):** SCRUM-129. Elternpunkte: SCRUM-102 / FE-KO-01 (Detailseite zeigt Quellen) + FE-KO-07 (externe Quelle anhängen, klar als nicht peer-validiert / Stufe 2). NICHT vermischt mit SCRUM-130 / FE-KO-02 (Wiki-/Confluence) — kein Wiki-/Hierarchie-/Backlink-Modell.

**Befund (read-only):** KnowledgeObject hatte KEIN sources/external-Feld. Beide Repos speichern das Vollobjekt (InMemory Map / pg `data jsonb`) → neues Feld transparent, KEINE DDL/Migration nötig.

**Änderung (geänderte/neue Dateien):**
- `services/knowledge-object/src/types.ts` — neu: `KoSourceKind = "external"`, `KoSource` (id/label/url/excerpt/kind/peerValidated/author/at); `sources: KoSource[]` an KnowledgeObject; KoErrorCode +`INVALID_SOURCE`.
- `services/knowledge-object/src/service.ts` — create initialisiert `sources: []`; revise erhält sources (`ko.sources ?? []`); neu `addSource` (Label-Pflicht, external → peerValidated=false, Audit `ko.source-added`) und `removeSource` (Audit `ko.source-removed`).
- `services/knowledge-object/index.ts` — exportiert KoSource/KoSourceKind/KoAttachment.
- `services/app/src/routes/ko-routes.ts` — PutBody +source/sourceId; neue Actions `add-source` / `remove-source` (Permission ko.create = Bearbeiterpfad; Label-Validierung).
- `services/knowledge-object/src/service.test.ts` — 2 neue Tests (Quelle hinzufügen → nie peer-validiert + über revise erhalten + Audit; leeres Label abgelehnt + entfernbar).
- `apps/web/src/api/types.ts` — `KoSource` + `sources?: KoSource[]`.
- `apps/web/src/api/endpoints.ts` — KoAction +`add-source`/`remove-source`.
- `apps/web/src/lib/koSource.ts` — neu, DOM-frei: isSourceFormValid, toSourcePayload, sourceBadgeKey, EMPTY_SOURCE_FORM.
- `apps/web/src/pages/KnowledgeDetail.tsx` — neue „Quellen"-Card: Liste mit Label/URL/Excerpt + Badge „extern · nicht peer-validiert", Add-Form (Label Pflicht, URL/Excerpt optional) und Entfernen (nur Bearbeiter), Toast + Invalidierung. Klar getrennt von der bestehenden „Quelle/Beitrag melden"-Review-Kommentar-Card (keine Migration).
- `apps/web/src/i18n.ts` — `ko.sources*` / `ko.source*` (DE+EN).
- `tests/ko/ko-source.test.ts` — 3 Tests (Label-Pflicht, Payload-Bau, Badge = nicht peer-validiert).

**Backend:** ERWEITERT (echtes Modell + API + Audit), wie in der Vorab-Meldung skizziert. Keine DDL/Migration, kein Import-Pipeline-Umbau, kein automatisches Peer-Validation-Verfahren.

**Erfüllte AK:** neues KoSource-Modell mit Minimalfeldern ✓ · sources:[] bei create ✓ · revise bewahrt sources ✓ · addSource/removeSource + Audit ko.source-added/-removed ✓ · externe Quelle peerValidated=false ✓ · KO-Action add-source/remove-source ✓ · Pflichtfeld (Label) validiert ✓ · FE zeigt Quellen + markiert klar „nicht peer-validiert / Stufe 2" ✓ · Review-Kommentare NICHT als echte Quelle migriert ✓ · keine Fake-Provenance, keine UI die extern als validiert zeigt ✓.

**Genutzte Endpoints:** PUT /api/kos/:id (action add-source / remove-source) — neu.

**Tests/Gates:** `npm run check` GRÜN — 36 Testdateien / 173 Tests (5 neu). Root-tsc grün, apps/web `tsc --noEmit` EXIT=0, depcruise sauber (Vollobjekt-JSONB, keine neuen Modulgrenzen-Verstöße), Biome grün.

**Restlücken:** Nur `kind: "external"` (Stufe 2) — interne/peer-validierte Quelltypen bleiben Roadmap. Kein Wiki-/Confluence-Linkmodell (SCRUM-130 / FE-KO-02 separat). Kein Import-Pipeline-Bezug.

**Jira-Empfehlung:** Nach grünem Gate dürfen SCRUM-129 sowie SCRUM-102 / FE-KO-01 und FE-KO-07 auf erledigt. SCRUM-102 bleibt danach voraussichtlich nur wegen FE-KO-02 / SCRUM-130 offen. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab.

---

## 2026-06-25 · SCRUM-130 + SCRUM-142 — Wissensnetz (verwandte KOs) & Lineage/Herkunft im KO-Detail

**Ticket(s):** SCRUM-130 (KO-Rest: „wiki-/confluence-artige" Struktur — hier definiert als verlinkbares Wissensnetz, KEIN Confluence-Klon/Seitenbaum/Page-Editor) + SCRUM-142 (Analytics-Rest: Lineage-/Herkunftssicht). Gemeinsam umgesetzt, da derselbe KO-Kontext (Quellen/Versionen/Herkunft/Beziehungen/Audit/Graph). Umsetzung exakt nach freigegebener Vorab-Meldung.

**Genutzte vorhandene Daten (keine neuen Modelle):** KnowledgeObject (originalAuthor, author, version, history[], tags[], category, sources[], createdAt), useKos() (Gesamtbestand für Beziehungsableitung), useAudit() (Ereignisse je KO über target===ko.id), useGraph()/Tags (Beziehungssignal). Kein Backend, keine Migration, keine Hash-Chain-Änderung.

**Änderung (geänderte/neue Dateien):**
- `apps/web/src/lib/koLineage.ts` — neu, DOM-frei: `relatedKos` (verwandte KOs über geteilte Tags / gleiche Kategorie / geteilte Quelle; Selbstausschluss, Dedup, Ranking nach Beziehungsstärke, Limit), `koAuditEvents` (target-Filter, nach seq sortiert), `lineageSummary` (Originalautor/Autor/authorTransferred/Versionen/History/Quellen/Verwandte).
- `apps/web/src/pages/KnowledgeDetail.tsx` — neue „Herkunft & Verlauf (Lineage)"-Card (SCRUM-142: Ursprung→aktueller Autor inkl. Transfer-Hinweis, Versionen/Änderungen, Quellenzahl, Verwandt-Zahl, letzte echte Audit-Ereignisse dieses KO, Link zur GraphView) und „Verwandte Wissensobjekte"-Card (SCRUM-130: verlinkte KOs mit Beziehungs-Badge Tag/Kategorie/Quelle + konkrete geteilte Werte, Navigation zu /wissen/:id). useAudit + Link ergänzt.
- `apps/web/src/i18n.ts` — `ko.lineage*` / `ko.related*` (DE+EN).
- `tests/ko/ko-lineage.test.ts` — 5 Tests (Tag/Kategorie/Quelle-Match + Selbstausschluss; Ranking mehrfach-verwandter zuerst; Limit; Audit-Filter+Sortierung; Lineage-Kennzahlen).

**Erfüllt SCRUM-130?** JA (im definierten Scope): verlinkbares Wissensnetz im KO-Kontext — verwandte KOs, Beziehungsgrund, nachvollziehbare Navigation + Graph-Link. KEIN Confluence-Klon/Seitenbaum/Editor (bewusst, scope-konform).

**Erfüllt SCRUM-142?** JA: datenbasierte Lineage/Herkunft aus echten Signalen (originalAuthor/author/version/history/sources/createdAt + Audit über target===ko.id + Beziehungen über Tags/Kategorie/Quellen), Verknüpfung KO-Detail ↔ Graph. Keine statische Demo-Karte.

**Genutzte Endpoints:** GET /api/kos, GET /api/audit, GET /api/graph (alle bestehend; nur clientseitige Ableitung).

**Tests/Gates:** `npm run check` GRÜN — 37 Testdateien / 178 Tests (5 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Restlücken / separates Restticket-Vorschlag:** Beziehungen & Lineage sind aktuell **ungerichtet** (Tag/Kategorie/Quellen-Ähnlichkeit), keine gerichtete Ableitung „KO B entstand aus KO A". Falls fachlich gewünscht, braucht das ein NEUES gerichtetes Beziehungsfeld am KO (z. B. `derivedFrom: koId[]`) inkl. Backend-Action/Audit — bewusst NICHT improvisiert. **Vorschlag: separates Restticket „Gerichtete KO-Herkunftskanten (derivedFrom)"** als echtes Modell-/API-Thema (analog SCRUM-129).

**Jira-Empfehlung:** Nach grünem Gate + Git-Sync dürfen SCRUM-130 und SCRUM-142 auf erledigt (im definierten Scope). Gerichtete Lineage als neues Restticket anlegen. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab.

---

## 2026-06-25 · SCRUM-127 + SCRUM-128 — Conflict Board: echte KO-Gegenüberstellung & definierte Auflösungswirkung

**Ticket(s):** SCRUM-127 (KO-Positionen/Quellen gegenüberstellen) + SCRUM-128 (Auflösungswirkung definieren+testen). Umsetzung exakt nach freigegebener Vorab-Meldung. KEINE Backend-Änderung, KEINE KO-Status-/Trust-Mutation, Conflict-Service-Vertrag erhalten.

**Befund (read-only):** Conflicts.tsx zeigte koA/koB nur als rohe IDs. ConflictService.resolve setzt nur Konflikt-Felder (status/decision/decidedBy) + Audit conflict.resolved und hat KEINE koService-Abhängigkeit → kann KO-Status/Trust strukturell nicht mutieren. useKos() liefert den Bestand für die Gegenüberstellung; KOs tragen Quellen seit SCRUM-129.

**Änderung (geänderte/neue Dateien):**
- `apps/web/src/lib/conflictView.ts` — neu, DOM-frei: `conflictKoPair(conflict, kos)` (koA/koB → echte KOs, null wenn fehlt — kein Fake); `resolutionEffect(conflict)` (codifiziert SCRUM-128: documented=true, koStatusChanged=false, koTrustChanged=false, revalidationRecommended = type==="truth").
- `apps/web/src/pages/Conflicts.tsx` — `KoPanel` zeigt echte KO-Daten (Titel, Aussage, Bedingungen, Maßnahmen, Quellen mit „extern · nicht peer-validiert"-Badge) + Link zu /wissen/:id; die zwei ID-Boxen ersetzt durch zwei Vergleichspanels; im Resolve-Formular Hinweis „Entscheidung wird dokumentiert/protokolliert, Trust/Status werden NICHT automatisch geändert" + Revalidierungs-Empfehlung bei Wahrheitskonflikten. Eskalations-/Zweitmeinungs-/Resolve-Flow unverändert.
- `apps/web/src/i18n.ts` — `con.versus/conditions/measures/sources/openKo/koMissing/resolveEffect/resolveRevalidate` (DE+EN).
- `tests/conflicts/conflict-view.test.ts` — 4 Tests (Pairing beide gefunden / einer fehlt→null; resolutionEffect ohne Status-/Trust-Mutation; Revalidierungs-Empfehlung nur bei truth).

**Backend:** UNVERÄNDERT. Conflict-Service-Vertrag (FR-CON-01..04) bleibt; bestehende Service-Tests belegen weiterhin, dass resolve nur Konflikt-Felder + Audit setzt.

**Erfüllt SCRUM-127?** JA — echte KO-Gegenüberstellung (Titel/Aussage/Bedingungen/Maßnahmen/Quellen/Link) statt roher IDs; fehlt ein KO, klarer Fallback statt Fake.

**Erfüllt SCRUM-128?** JA — Auflösungswirkung fachlich definiert und getestet: dokumentierend (Entscheidung + Audit) + hinweisend (Revalidierung bei truth), bewusst KEINE automatische KO-Status-/Trust-Mutation (Freitext-Entscheidung ⇒ kein maschinell eindeutiger Gewinner ⇒ kein stilles Überschreiben). Codifiziert in resolutionEffect + Test.

**Genutzte Endpoints:** GET /api/kos (bestehend, clientseitige Auflösung). Resolve weiterhin über PUT /api/kos/:id action resolve-conflict (unverändert).

**Tests/Gates:** `npm run check` GRÜN — 38 Testdateien / 182 Tests (4 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Restlücke (nicht improvisiert):** Ein echtes, maschinell-eindeutiges Trust-/Status-Resolutionskonzept (obsiegendes KO bestätigen / unterlegenes herabstufen oder zur Revalidierung markieren) wäre ein NEUES Backend-Konzept (KO-Mutation + Audit + Regeln). **Vorschlag: separates Restticket „Konfliktauflösung mit KO-Status-/Trust-/Revalidierungswirkung (Backend)"** — bewusst hier nicht gebaut.

**Jira-Empfehlung:** Nach grünem Gate + Git-Sync dürfen SCRUM-127 und SCRUM-128 auf erledigt. Echte Trust-/Status-Auflösungswirkung als neues Restticket. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab.

---

## 2026-06-26 · SCRUM-133 + SCRUM-141 — Risiko-Cockpit (Domäne) & datenbasiertes Knowledge Health

**Ticket(s):** SCRUM-133 (Risiko-Cockpit nach Bereichen/Domänen) + SCRUM-141 (Knowledge-Health-Konzept). Gemeinsam über EIN DOM-freies Modul (keine doppelte Logik). Umsetzung exakt nach freigegebener Vorab-Meldung. KEIN Backend-Umbau.

**Genutzte Datenquellen (alle bestehend, clientseitig):** useKos (status/trust/category), useGaps, useConflicts, useValidationOverview, useLifecyclePending (stale), useBusFactor (Single-Source je Kategorie). Keine Mock-/Demo-Zahlen.

**Änderung (geänderte/neue Dateien):**
- `apps/web/src/lib/knowledgeHealth.ts` — neu, DOM-frei, EIN Modul für beide: `knowledgeHealth(input)` (Score 0–100, Band gut/mittel/kritisch, erklärbare `factors[]` mit Richtung) und `domainRisk(kos, busFactor)` (je Kategorie: KO-Zahl, Validierungsquote, offene KOs, Autorenzahl, Single-Source, Risikolevel; nach Risiko sortiert) + `bandForScore`.
- `apps/web/src/pages/Analytics.tsx` — Knowledge-Health-Card oben: Score + Band + Klartext-Erklärung + Faktor-Aufschlüsselung (positiv/negativ). Ergänzt useGaps/useConflicts/useLifecyclePending/useBusFactor.
- `apps/web/src/pages/Risk.tsx` — Domänen-Risiko-Cockpit oben (Karten je Kategorie mit Risiko-Badge, Validierungsquote, offene KOs, Experten, Single-Source-Warnung). Ergänzt useKos. Bestehende Bus-Faktor-/Gaps-Sektionen unverändert.
- `apps/web/src/i18n.ts` — `health.*` + `risk.cockpit/level/...` (DE+EN).
- `tests/analytics/knowledge-health.test.ts` — 7 Tests.

**Health-Score-Modell (erklärbar, deterministisch):** Basis = Validierungsquote; Abzüge für staleRatio (×0,4), Single-Source-Anteil (×0,3), offene Gaps (×4, max 20) und offene Konflikte (×5, max 20); geklemmt 0–100. Bänder: ≥70 gut, ≥40 mittel, sonst kritisch. Jeder Faktor wird mit Wert + Richtung angezeigt → „warum gut/mittel/kritisch" ist sichtbar.

**Risk-Cockpit-Modell:** je Kategorie Risikolevel = kritisch bei Single-Source ODER Validierungsquote <40 %, mittel bei <70 %, sonst gut; Sortierung kritisch→gut.

**Erfüllt SCRUM-133?** JA — Risiko nach Domäne/Kategorie strukturiert, datenbasiert.
**Erfüllt SCRUM-141?** JA — datenbasierter, erklärbarer Health-Score (kein Mock).

**Genutzte Endpoints:** GET /api/kos, /api/gaps, /api/conflicts, /api/validation/overview, /api/lifecycle/pending, /api/analytics/busfactor (alle bestehend).

**Tests/Gates:** `npm run check` GRÜN — 39 Testdateien / 189 Tests (7 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Restlücke (nicht improvisiert):** Health-/Risiko-TREND über Zeit fehlt — bräuchte historische Snapshots, die das Modell nicht führt. **Vorschlag: separates Restticket „Knowledge-Health-Trend (Snapshots/Zeitreihe)"**. Hier bewusst nur der aktuelle datenbasierte Stand.

**Jira-Empfehlung:** Nach grünem Gate + Git-Sync dürfen SCRUM-133 und SCRUM-141 auf erledigt. Trend als neues Restticket. Ich setze keine Jira-Checkbox/Status selbst; Codex/Peter haken nach Gate ab.

---

## 2026-06-26 · SCRUM-124 + SCRUM-125 + SCRUM-126 — Autor-Rückgabe, Statusmodell-Präzisierung & Revalidierung

**Ticket(s):** SCRUM-124 (Autor-Rückgabe aus Validierungsfeedback als Aufgabe/Status/Workflow) · SCRUM-125 (Validation-Statusmodell klären) · SCRUM-126 (validiert → erneut in Prüfung end-to-end belegen). Gemeinsam umgesetzt. Schemafreie Audit-Variante nach freigegebener Vorab-Meldung.

**Fachliche Entscheidung (SCRUM-125):** Kein neues Kern-Enum. `KoStatus` bleibt `offen | validiert`; kein Hard-`rejected`. Die feineren Anzeigestufen bleiben abgeleitet (display-status). Echte Workflow-Marker werden über vorhandene Modelle (Assignment + Audit + abgeleitete Flags) ergänzt — mit Service/API/Tests, kein UI-only-Status.

**Änderung (geänderte/neue Dateien):**
- `services/validation/src/service.ts` — `rate()`: bei `warn`/`down` Rückgabe an den Autor über neue private `returnToAuthor()` → deduplizierte offene Zuweisung an `ko.author` (Key (koId,author)) + Audit `ko.returned-to-author` (payload verdict/author). Grün (`up`) erzeugt nichts. `computeOutcome`/Trust/Status UNVERÄNDERT, bestehender Rating-/Kommentarflow erhalten.
- `services/validation/src/service.test.ts` — 4 neue Tests (down→Autor-Aufgabe+Audit+Kernstatus offen; warn gibt zurück / up nicht; Deduplizierung).
- `tests/validation/return-and-revalidate.test.ts` — neu, end-to-end (KoService+ValidationService+LifecycleService In-Memory): warn→Autor-Rückgabe; **validiert → revalidate(confirmStillValid) → status offen + version+1 + wieder im Board** (SCRUM-126).
- `apps/web/src/lib/validationStatus.ts` — neu, DOM-frei: `deriveDisplayStatus` (konsistente Anzeige-Ableitung), `isReturnedForRework` (aktuelle Nacharbeit aus Audit; spätere ko.revised/ko.rated beenden sie), `returnedToAuthor` (eigene zurückgegebene KOs).
- `tests/validation/validation-status.test.ts` — neu, 6 Tests (Display-Ableitung offen/pruefung/validiert/revalidierung/konflikt/abgelehnt; Rückgabe-Erkennung; Reset durch Überarbeitung; autor-gefilterte Liste).
- `apps/web/src/pages/MyTasks.tsx` — neue „Nacharbeit (zurückgegeben)"-Aufgaben in der kritischen Gruppe (aus Audit `ko.returned-to-author`, gefiltert auf KOs des aktuellen Nutzers via useSession+useKos+useAudit). Keine neuen Endpoints.
- `apps/web/src/pages/KnowledgeDetail.tsx` — sichtbares Rückgabe-Banner „zur Nacharbeit zurückgegeben" wenn das KO aktuell zurückgegeben ist.
- `apps/web/src/i18n.ts` — `task.returned`, `ko.returnedBanner` (DE+EN).

**Wie erreicht Gelb/Rot den Autor wirklich?** Als echte, deduplizierte **offene Zuweisung** an `ko.author` (sichtbar in Validierungs-Overview und in „Meine Aufgaben") + Audit-Event — nicht nur Kommentar. Keine E-Mail/Push vorgetäuscht (nur In-App/Audit).

**validiert → erneut in Prüfung:** über den bestehenden `revalidate`→`confirmStillValid`→`revise`-Pfad (version+1, status offen, trust 0); end-to-end getestet und im KO-Detail/Board sichtbar.

**Genutzte Endpoints:** PUT /api/kos/:id (rate / revalidate) — unverändert. FE nutzt GET /api/audit, /api/kos, Session — keine neuen Endpoints.

**Tests/Gates:** `npm run check` GRÜN — 41 Testdateien / 200 Tests (11 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün.

**Restlücken (nicht improvisiert):**
- Kein Hard-`rejected`-Kernstatus (bewusst; Kern bleibt offen|validiert). Echter `rejected`-Zustand = separates Kern-Enum-Restticket, falls fachlich gewünscht.
- `Assignment` ohne `reason`-Feld → Unterscheidung validate/rework rein über Audit (schemafrei, wie freigegeben). Optionale `reason`-Erweiterung = separates Restticket.
- Bekannt (vorbestehend, nicht Teil dieses Blocks): `revise` setzt Ratings nicht zurück — nach Revalidierung zählt eine Neubewertung alte Verdicts mit. Falls fachlich „frische Validierung" gewünscht, eigenes Restticket „Ratings bei revise zurücksetzen".

**Jira-Empfehlung:** Nach grünem Gate + Peters Mac-Commit/Push dürfen SCRUM-124, SCRUM-125, SCRUM-126 auf erledigt. Hard-rejected / Assignment-reason / Rating-Reset als separate Resttickets. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-122 + SCRUM-123 — PDF-Textextraktion & optionale Bild-OCR in Capture

**Ticket(s):** SCRUM-122 (PDF→Text-Kontext) + SCRUM-123 (Bild-OCR optional). Gemeinsam, additiv. Knüpft an FE-CAP-06 an (DOCX bereits real; pdfjs/tesseract dort bewusst entfernt → hier nachgeliefert).

**Bibliotheks-/Engine-Befund:**
- `pdfjs-dist@4.10.38` — `engines.node = ">=20"` → passt exakt zum Projektziel Node ≥20, KEIN Engine-Konflikt (v6 verlangt ≥22.13 → bewusst nicht verwendet). Legacy build vorhanden (`legacy/build/pdf.mjs` + `pdf.worker.mjs`).
- `tesseract.js@5.1.1` — keine `engines`-Restriktion → kompatibel. Worker/WASM/Sprachdaten werden on-demand geladen.

**Architektur (additiv, DI-testbar):**
- `apps/web/src/lib/extract.ts` (neu, DOM-frei): `detectFileKind` (text/docx/pdf/image/unsupported, spiegelt bestehende Erkennung + pdf), `joinPdfPages`, `ExtractionStatus`.
- `apps/web/src/lib/pdf.ts` (neu, DOM-frei): `extractPdfText(buffer, engine)` mit **injizierbarer PdfEngine** (kein pdfjs-Import → in Node mit Stub testbar).
- `apps/web/src/lib/ocr.ts` (neu, DOM-frei): `recognizeImage(input, recognizer)` → Status success/failed/unavailable (kein tesseract-Import).
- `apps/web/src/lib/files.ts` (Browser-Wrapper): `isPdfDocument`/`readPdfFile` (lazy `import("pdfjs-dist/legacy/build/pdf.mjs")`, Worker via `new URL(..., import.meta.url)` — Vite-kompatibel, kein `?url`-Typproblem); `isOcrCandidate`/`runImageOcr` (lazy `import("tesseract.js")`, Engine nicht ladbar → `unavailable`). Lokale Typ-Verträge statt Lib-Typen (analog mammoth).
- `apps/web/src/pages/Capture.tsx`: `onDocs` um PDF-Zweig erweitert (Status: liest…/übernommen/leer/Fehler); pro Bild optionaler **OCR-Button (nur auf Klick)** mit Lade-/Erfolg-/Fehler-/Unavailable-Status; accept um `.pdf` ergänzt. Text/DOCX/Thumbnail-Pfade unverändert.
- `apps/web/src/i18n.ts`: `capture.docExtracting/docEmpty/ocr*` + Hint aktualisiert (DE+EN).
- `apps/web/package.json` + `package-lock.json`: `pdfjs-dist@^4`, `tesseract.js@^5` ergänzt, Lock regeneriert.

**Tests (DI-Stubs, keine echte Lib im Gate):**
- `tests/capture/extract-detect.test.ts` (8): File-Kind text/docx/pdf/image/unsupported + joinPdfPages.
- `tests/capture/pdf-extract.test.ts` (3): Seiten-Join, Trim, leeres PDF, Engine-Fehler propagiert.
- `tests/capture/ocr-extract.test.ts` (3): success/failed/unavailable.
- **Regression:** `tests/capture/docx-extract.test.ts` unverändert grün; detect-Test bestätigt Text/DOCX-Erkennung unberührt; Bild-Thumbnail-Pfad (`fileToThumbDataUrl`/`addImage`) nicht angefasst.

**Ehrliche UI-Status:** „läuft" (PDF liest…/OCR läuft inkl. Worker-Lade-Hinweis), „erfolgreich", „fehlgeschlagen", „kein Text/leer" (gescanntes PDF → OCR-Hinweis), „nicht unterstützt", „OCR nicht verfügbar". Keine Fake-OCR/Fake-PDF.

**Tests/Gates (Sandbox):** `npm run check` GRÜN — 44 Testdateien / 214 Tests (14 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün. **Echte Browser-/Bundle-Verifikation (lazy chunks, Worker, WASM-Last) = Peters Mac-Gate** (`cd apps/web && npm install` + `npm run build`).

**Restlücken:** OCR-Qualität/Sprachpaket (deu+eng) und Bundle-Größe der lazy chunks erst am Mac/Build final bewertbar. Gescanntes PDF ohne Textebene liefert leeren PDF-Text (ehrlicher Hinweis → Bild-OCR) — kein automatisches PDF-Seiten-Rendering+OCR (separates Restticket, falls gewünscht).

**Jira-Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen SCRUM-122 und SCRUM-123 auf erledigt. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-132 — Reasoner-getriebene Interview-Turns

**Ticket:** SCRUM-132. Neuer Reasoner-Task `interview` (stateless), exakt nach freigegebener Architektur. Ersetzt den alten statischen FE-`IV_STEPS`-Hauptpfad.

**Geänderte/neue Dateien:**
- `services/reasoner/src/types.ts` — `InterviewResult { question|null, done, draft, demo }`.
- `services/reasoner/src/provider.ts` — Interface +`interview(answers)`; `INTERVIEW_QUESTIONS`, `condenseInterview` (deterministische, nachvollziehbare Verdichtung Antwort→Feld), `deterministicInterview` (eine Frage/Turn, Abschluss bei Kernaussage+Bedingung+Maßnahme); `DeterministicProvider.interview` (demo:true).
- `services/reasoner/src/provider-model.ts` — `ModelProvider.interview`: Modell formuliert NUR die nächste Frage (INTERVIEW_SYSTEM), Abschluss + Draft-Verdichtung bleiben deterministisch (kein Erfinden von Inhalt); demo:false.
- `services/reasoner/src/service.ts` — `Reasoner.interview()` primary→fallback wie die anderen Tasks.
- `services/reasoner/index.ts` — Export `InterviewResult`.
- `services/app/src/routes/reasoner-routes.ts` — `task: "interview"`, Body `{ answers }`, Response `InterviewResult`.
- `apps/web/src/api/types.ts` — FE `InterviewResult`; `apps/web/src/api/endpoints.ts` — `reasoner.interview(answers)`.
- `apps/web/src/lib/interviewFlow.ts` (neu, DOM-frei) — appendAnswer, isInterviewDone, interviewSourceKey, answeredTurns.
- `apps/web/src/pages/Capture.tsx` — Interviewmodus auf Server-Turns umgestellt: `interview`-Mutation, eine Server-Frage pro Turn, Antwort senden, Draft aus `result.draft` übernommen, Quelle-Badge (Modell vs. deterministischer Fallback), „denkt…"-Status. Statische `IV_STEPS`/`IvField`/`ivAdvance` entfernt. Submit-/Draft-/KO-Flow unverändert.
- `apps/web/src/i18n.ts` — `capture.ivTurn/ivThinking/ivAnswerHint/ivSend/ivModel/ivFallback` (DE+EN).
- Tests: `services/reasoner/src/service.test.ts` (erweitert; bestehende Provider-Stubs um `interview` ergänzt) + `tests/capture/interview-flow.test.ts` (neu).

**Erfüllte AK:** neuer Reasoner-Task `interview` ✓ · stateless (answers rein → question/done/draft/demo raus) ✓ · eine Frage pro Turn ✓ · Modell formuliert nur, erfindet keinen Inhalt (Verdichtung deterministisch) ✓ · Draft nachvollziehbar aus Antworten verdichtet ✓ · deterministischer Fallback markiert (demo:true + Quelle-Badge + Reasoner-Status) ✓ · Submit-/Draft-/KO-Flow unverändert ✓ · keine UI-only-Simulation (Service-/Task-Logik dahinter) ✓ · `assist` nicht umgebaut, keine neue UI-Insel ✓.

**Gelaufene Checks:** `npm run check` GRÜN — 45 Testdateien / 222 Tests (10 neu: Reasoner-Interview Turn-Folge/Abschluss/Verdichtung/Modell-Umformulierung/Fallback-demo + 4 FE-Flow). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün. Bestehende Capture-/Reasoner-/`InterviewSession`-Tests bleiben grün.

**Statischer FE-Hauptpfad ersetzt:** JA — der alte `IV_STEPS`-Durchklick ist entfernt; der Interviewmodus ruft jetzt pro Turn `endpoints.reasoner.interview(answers)` (echte Service-/Task-Logik). Der bestehende deterministische `InterviewSession` (capture, FR-CAP-02) bleibt unangetastet und grün, ist aber nicht mehr der „reasoner-getriebene" FE-Hauptpfad.

**Restlücken:** Modellpfad (echtes LLM) wird im Gate nur über deterministischen Fallback geprüft (kein Key in Sandbox/CI) — der Modellpfad ist via Provider-Stub getestet, eine echte Live-Modellprüfung bleibt Betrieb/Mac. Verdichtung ist bewusst 1:1 (Antwort→Feld), keine modellbasierte Mehrfach-Antwort-Fusion (separates Restticket, falls gewünscht).

**Jira-Empfehlung:** Nach grünem Mac-Gate + Commit/Push darf SCRUM-132 auf erledigt. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-121 — Objekt-/Dateispeicher für Capture-Anhänge (schließt FE-CAP-05)

**Ticket:** SCRUM-121. Anhänge laufen jetzt über eine echte Objekt-/Attachment-Referenz statt als großes Inline-dataUrl im KO-Modell. In-Memory-Default, KEIN S3/Cloud/Pg/Disk in diesem Ticket.

**Storage-Entscheidung:** Neues internes Modul `services/object-store` (Repo-Pattern wie die anderen Module). `ObjectRef { id, name, mime, size, kind: image|document|binary, createdAt }` = nur Metadaten; `StoredObject = ref + data`. `ObjectStore`: `put` (Validierung name/mime/Inhalt + MAX_OBJECT_BYTES=5 MB → ObjectRef), `read` (ref+data), `metadata` (nur ref). In-Memory-Repo; Interface bereit für späteren Pg-/Disk-Adapter.

**Geänderte/neue Dateien:**
- Neu: `services/object-store/{index.ts, src/types.ts, src/repo.ts, src/service.ts, src/service.test.ts}`.
- `services/app/src/routes/object-routes.ts` (neu) + `services/app/src/build-app.ts` (AppServices/AppRepos +objects, In-Memory in beiden Kompositionen, Route registriert).
- `services/app/src/routes/ko-routes.ts` — attach-Case akzeptiert objectId+thumbnail+size (neu) ODER dataUrl (alt, rückwärtskompatibel).
- `services/knowledge-object/src/types.ts` — KoAttachment: dataUrl optional + objectId?/thumbnail?/size?.
- `services/knowledge-object/src/service.ts` — addAttachment übernimmt nur gesetzte Felder.
- `services/knowledge-object/src/service.test.ts` — Referenz-Anhang-Test (objectId+thumbnail+size, kein dataUrl).
- FE: `api/types.ts` (KoAttachment optional + ObjectRef/ObjectContent), `api/endpoints.ts` (objects.upload/read; KoAction attach optional), `lib/files.ts` (readFileAsDataUrl), `lib/attachment.ts` (neu: attachmentPreview/isObjectAttachment), `pages/Capture.tsx` (Original behalten → Object-Store-Upload → attach mit Ref+Thumbnail), `pages/KnowledgeDetail.tsx` (Upload via Store, Vorschau aus thumbnail??dataUrl, Original öffnen via objectId/dataUrl).
- Tests: `tests/capture/attachment-preview.test.ts` (neu).

**Endpoints:** POST /api/objects (ko.create) → ObjectRef · GET /api/objects/:id (ko.read) → {ref,data}|404. Anhängen weiterhin über PUT /api/kos/:id (action attach) — jetzt mit objectId.

**Erfüllte AK:** interner Object-/Attachment-Store ✓ · POST/GET /api/objects ✓ · KoAttachment rückwärtskompatibel (dataUrl? alt; objectId?/thumbnail?/size? neu) ✓ · neue Capture-Uploads speichern Original via ObjectRef ✓ · KO speichert nur Referenz + kleine Vorschau ✓ · Alt-dataUrl-Anhänge bleiben lesbar (Render fällt auf dataUrl zurück) ✓ · kein Pg/Disk/S3 ✓ · keine Migration ✓ · PDF/DOCX/OCR/Text unverändert (kein Eingriff) ✓ · Tests für Store + Referenz-Anhang + Preview ✓.

**Gelaufene Checks:** `npm run check` GRÜN — 47 Testdateien / 231 Tests (10 neu: ObjectStore 5, KO-Referenz 1, FE-Preview 3, +1). apps/web `tsc --noEmit` EXIT=0. depcruise sauber (120 Module, neues Modul ohne Verstöße). Biome grün. DOCX/PDF/OCR/Text-Tests bleiben grün.

**Restlücken:** Object-Store ist In-Memory → Inhalt überlebt keinen Neustart (bewusst; Pg-/Disk-Persistenz = klar abgegrenztes Folge-Restticket, Interface steht). Größenlimit 5 MB pro Objekt (Pilot). Keine Original-Bild-Komprimierung (Original wird 1:1 abgelegt); Thumbnail bleibt klein am KO.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **SCRUM-121 erledigt** und **SCRUM-100 / FE-CAP-05 abgehakt** werden (Anhänge laufen sauber über ObjectRef + Thumbnail, kein großes Base64 mehr im KO-Modell). Pg-/Disk-Persistenz als Folge-Restticket. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-113 (Block 1) — FE-CAP-07 + FE-MOB-02/04/06 (Mobile-Erfassung & Draft-Resume)

**Ticket(s):** SCRUM-113 erster Umsetzungsblock; schließt FE-CAP-07 (Draft-Resume) und FE-MOB-02/04/06. Umsetzung exakt nach freigegebener Vorab-Meldung.

**Befund:** Draft-Pool backendseitig vollständig (CaptureService createDraft/listDrafts/getDraft/**continueDraft (FR-CAP-07)**/deleteDraft/toKoInput; Routen GET/POST/PUT/DELETE /api/drafts + promote). FE-Lücke: kein `drafts.update` (PUT) angebunden; Mobile.tsx rein statisch; kein Desktop-Resume.

**Geänderte/neue Dateien:**
- `apps/web/src/api/endpoints.ts` — `drafts.update(id, payload)` → PUT /api/drafts/:id (continueDraft).
- `apps/web/src/lib/draftForm.ts` (neu, DOM-frei) — formToPayload, draftToForm, isDraftFormFillable, draftTitle, isPromotable.
- `apps/web/src/pages/Mobile.tsx` — von statischer Vorschau zu echter mobiler Erfassung: Formular (Titel/Aussage) → Entwurf speichern (drafts.create) bzw. fortsetzen (drafts.update), Entwurfsliste (useDrafts) mit Fortsetzen/Verwerfen, alle Aktionen mit Toast-Bestätigung. Gleicher Draft-Pool wie Desktop.
- `apps/web/src/pages/Capture.tsx` — Desktop-„Entwürfe fortsetzen"-Card (Liste, Fortsetzen lädt payload ins Formular + setzt draftId, Verwerfen via drafts.remove); saveDraft aktualisiert bei aktivem draftId (drafts.update) statt neu, mit Toast; invalidiert ["drafts"].
- `apps/web/src/i18n.ts` — `mob.*` (formTitle/save/saved/update/updated/drafts/resume/discard/...) + `capture.draftUpdated/draftDiscarded/resumeTitle/resume/discardDraft/editingDraft/editingBadge` (DE+EN).
- `tests/capture/draft-form.test.ts` (neu) — 5 Tests.

**Genutzte Endpoints:** GET /api/drafts, POST /api/drafts, **PUT /api/drafts/:id** (neu im FE), DELETE /api/drafts/:id. Kein Backend-Redesign, keine neue Backend-Route.

**Erfüllte AK:** drafts.update ergänzt ✓ · DOM-freies draftForm (Mapping/Resume/Vollständigkeit) ✓ · Mobile echt (speichern/listen/fortsetzen, Toast) ✓ · Desktop-Resume (anzeigen/fortsetzen/weiter speichern via update/verwerfen via remove) ✓ · Desktop+Mobile teilen denselben Draft-Pool ✓ · kein Backend-Redesign ✓ · keine statische Mobile-Demo mehr ✓.

**Nicht in diesem Block (leitplankenkonform):** PWA/Manifest/Service Worker (FE-MOB-01), Mobile Ask (FE-MOB-03), Mobile Wissenszugriff (FE-MOB-05), Offline/Sync (FE-MOB-07) — unangetastet. Promote-zu-KO bewusst nicht in Mobile mitgenommen (Fokus Speichern/Fortsetzen; isPromotable als Helper vorbereitet/getestet).

**Gelaufene Checks:** `npm run check` GRÜN — 48 Testdateien / 236 Tests (5 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber. Biome grün. Bestehende Capture-/Draft-Service-Tests bleiben grün.

**Restlücken:** Mobile-Formular ist schlank (Titel/Aussage) — volle Metadaten/Anhänge/Diktat bleiben Desktop bzw. spätere Mobile-Ausbaustufe. SCRUM-113 bleibt offen für FE-MOB-01/03/05/07.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **FE-CAP-07** abgehakt und damit **SCRUM-100 auf Done** gesetzt werden; **FE-MOB-02/04/06** in SCRUM-113 abhaken. **SCRUM-113 bleibt offen** für FE-MOB-01 (PWA), FE-MOB-03 (Ask), FE-MOB-05 (Wissenszugriff), FE-MOB-07 (Offline). Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-113 (Block 2) — FE-MOB-03 + FE-MOB-05 (Mobile Ask & Wissenszugriff)

**Ticket(s):** SCRUM-113 zweiter Umsetzungsblock; schließt FE-MOB-03 (Mobile Fragen/Abfrage) und FE-MOB-05 (Mobile Wissenszugriff). Umsetzung exakt nach freigegebener Vorab-Meldung.

**Befund:** Ask- und Library-Pfade backendseitig + im FE vollständig vorhanden. Wiederverwendbar: `endpoints.ask.ask(question)` → `AskResponse {result, gap}`; `selectAnswer/selectGap`; `knowledgeClassMeta` (Evidenz-Badge); `useLibrarySearch({q})` → `KnowledgeObject[]`; `deriveStatus` + `StatusPill`/`KnowledgeTypeTag`/`ConfidenceBar`. Mobile.tsx hatte nach Block 1 nur die Erfassungs-Sektion. Keine Backend-Lücke.

**Geänderte/neue Dateien:**
- `apps/web/src/lib/mobileAsk.ts` (neu, DOM-frei) — `summarizeAnswer(AnswerResult)` → kompaktes Mobile-View-Model (answered/text/trust/evidence via knowledgeClassMeta/sources/stepCount); keine Logikdopplung.
- `apps/web/src/pages/Mobile.tsx` — schlanker Tab-Umschalter **Erfassen · Fragen · Suchen** im bestehenden Geräterahmen. **Fragen:** Eingabe + Button → `endpoints.ask.ask`, `selectAnswer`; bei Antwort: Antworttext, Trust (ConfidenceBar), Evidenz-/KnowledgeClass-Badge, Quellen als Links zu `/wissen/:id`; bei `answered=false`: ehrliche No-Basis-Meldung (`ask.noBasisTitle/Body`) + Link zu `/risiko`; Fehler über Toast. **Suchen:** Suchfeld → `useLibrarySearch({q})`, kompakte KO-Liste mit StatusPill (deriveStatus) + Typ-Tag + Trust + Link `/wissen/:id`; ehrlicher Leer-/Kein-Treffer-Zustand.
- `apps/web/src/i18n.ts` — `mob.tabCapture/tabAsk/tabLookup`, `mob.searchPlaceholder/searchEmpty` (DE+EN). Ask-Anzeige nutzt bestehende `ask.*`-Keys (placeholder/evidence/sources/noBasisTitle/noBasisBody/toGaps/knowledgeClass.*).
- `tests/capture/mobile-ask.test.ts` (neu) — 2 Tests (beantwortet inkl. Evidenz/Trust/Quellen/Steps; No-Basis answered=false → Evidenz kritisch, keine Quellen/Steps).

**Genutzte Endpoints/Hooks:** POST /api/ask (`endpoints.ask.ask`), GET /api/library/search (`useLibrarySearch`). Keine neuen APIs, kein Backend-Redesign.

**Erfüllte AK:** Mobile Ask echt über bestehenden Ask-Shape ✓ · Antwort/Trust/Evidenz-Badge/Quellen/No-Basis ✓ · Fehler über Toast ✓ · Mobile Wissenszugriff über Library-Daten (Suche/Liste, Status/Trust/Typ, Link zu KO-Detail) ✓ · ehrlicher Leerzustand ✓ · DOM-freier Helper + Test ✓ · keine statische Vorschau ✓.

**Nicht in diesem Block (leitplankenkonform):** PWA/Manifest/Service Worker (FE-MOB-01), Offline-Queue/Sync (FE-MOB-07), Backend-Redesign, neue Ask-/Library-APIs — unangetastet.

**Gelaufene Checks:** `npm run check` GRÜN — 49 Testdateien / 238 Tests (2 neu). apps/web `tsc --noEmit` EXIT=0. depcruise sauber (120 Module). Biome grün.

**Restlücken:** Mobile-Ask zeigt Quellen-IDs kompakt (Link zu KO-Detail); Steps werden bewusst nicht ausgerollt (Platz). Such-Liste auf 20 Treffer begrenzt (Pilot). SCRUM-113 bleibt offen für FE-MOB-01 (PWA) + FE-MOB-07 (Offline).

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **FE-MOB-03** und **FE-MOB-05** in SCRUM-113 abgehakt werden. **SCRUM-113 bleibt offen** nur noch für FE-MOB-01 (PWA) und FE-MOB-07 (Offline). Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-113 (Block 3, final) — FE-MOB-01 PWA + FE-MOB-07 Offline-Queue/Sync

**Ticket(s):** SCRUM-113 finaler Block; schließt FE-MOB-01 (installierbare PWA) und FE-MOB-07 (Offline-Queue/Sync). Umsetzung exakt nach freigegebener Vorab-Meldung. **Keine neue npm-Dependency.**

**Befund:** Keine PWA-/SW-Infrastruktur vorhanden (kein Manifest/SW/Registrierung, kein Workbox/vite-plugin-pwa). SPA wird single-origin via `@fastify/static` aus `apps/web/dist` ausgeliefert (`/assets/*` immutable, sonst no-cache → passt für `sw.js`/Manifest). Online-Indikator in Mobile.tsx war hartkodiert. pdfjs/tesseract nur lazy dynamisch (`files.ts`). ImageMagick (`convert`) im Sandbox → PNG-Icons nativ erzeugt.

**PWA (FE-MOB-01) — neue/geänderte Dateien:**
- `apps/web/public/manifest.webmanifest` (neu) — name/short_name KLARWERK, start_url/scope „/", display standalone, theme/background #16222c, lang de, Icons (192/512 any + 512 maskable).
- `apps/web/public/icon.svg` (Quelle) + generierte PNGs `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png` (statisch committed, kein Runtime-Dep).
- `apps/web/public/sw.js` (neu, handgeschrieben, kein Workbox): versionierter Cache; **`/api` + `/health` strikt network-only (nie gecacht)**; Navigationen network-first mit App-Shell-Fallback (`index.html`); statische Assets stale-while-revalidate; alte Caches bei `activate` gelöscht.
- `apps/web/index.html` — Manifest-Link, `icon.svg`, `apple-touch-icon`, `apple-mobile-web-app-capable`/`-status-bar-style`/`-title`.
- `apps/web/src/main.tsx` — SW-Registrierung **nur in Produktion** (`import.meta.env.PROD`) auf `load` (CSP-konform, kein Inline-Script; Fehler schluckt App still).

**Offline-Queue/Sync (FE-MOB-07) — neue/geänderte Dateien:**
- `apps/web/src/lib/offlineQueue.ts` (neu, DOM-frei) — reine Queue-Logik: enqueue/replacePayload/markPending/markSynced/markFailed/clearSynced/syncableOps/pendingCount/countByStatus; Update auf nicht-synchronisierten Op desselben Drafts ersetzt Payload in place (kein Duplikat).
- `apps/web/src/app/useOfflineQueue.ts` (neu, dünner DOM-Hook) — Persistenz **localStorage `kw.offlineQueue.v1`**; echter Sync ruft `endpoints.drafts.create/update` (keine Fake-Sync, Stati spiegeln das fetch-Ergebnis); Auto-Sync bei `online`-Event + Tab-`focus`; `navigator.onLine`-Status; invalidiert `["drafts"]` nach Erfolg.
- `apps/web/src/pages/Mobile.tsx` — echter Online/Offline-Indikator; **Draft-Save geht offline in die Queue** statt direktem API-Call (create/update), Toast „offline gespeichert"; Warteschlangen-Sektion mit Stati **queued/pending/synced/failed** + Pending-Zähler + manueller „Synchronisieren"-Button; **Ask (FE-MOB-03) und Suche (FE-MOB-05) zeigen offline eine ehrliche Offline-Meldung** statt Ergebnissen (kein Fake-Offline); Toast bei Sync-Ergebnis.
- `apps/web/src/i18n.ts` — `mob.online/offline/queued/queue/syncNow/syncOk/syncFail/offlineSaveHint/offlineAsk/offlineSearch/offlineNeedsConn`, `mob.status.{queued,pending,synced,failed}` (DE+EN).
- `tests/capture/offline-queue.test.ts` (neu) — 6 Tests (enqueue→queued; Update-in-place; Status-Übergänge; failed bleibt synchronisierbar/synced nicht; replacePayload; clearSynced/pendingCount/countByStatus).

**Erfüllte AK:** Manifest/Icon/Theme/Standalone/SW/Offline-Start gebaut + per echtem Vite-Build geprüft ✓ · Queue nur für mobiles Draft-Speichern (create/update) ✓ · Delete/Promote nicht gequeued ✓ · Ask/Library offline ehrliche Meldung, kein Fake ✓ · Sync via online-Event/Focus/Button ✓ · sichtbare Stati queued/offline/pending/synced/failed ✓ · Toast bei Sync-Ergebnis ✓ · localStorage `kw.offlineQueue.v1` + DOM-freie Logik + Test ✓ · keine schwere Dependency ✓ · SW cached keine API-Responses ✓.

**Akzeptierte Grenzen (dokumentiert):** Offline-Start erst nach erstem Online-Besuch (gehashte Chunks via stale-while-revalidate on-demand gecacht, kein Precache-Manifest → keine neue Dependency). Queue ist pro Gerät/Browser, kein Cross-Device-Sync. Keine Background-Sync-API (Sync nur bei geöffneter App + online). Offline-Create bekommt temporäre lokale ID, beim Sync via `create` ersetzt.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · root `tsc` EXIT=0 · Biome grün (Manifest formatiert) · depcruise sauber · `npm run check` GRÜN — **50 Testdateien / 244 Tests** (6 neu) · **zwingend zusätzlich** `cd apps/web && npm run build` GRÜN (tsc + vite build, EXIT=0): Manifest/SW/Icons in `dist` verifiziert, pdfjs/tesseract-Lazy-Chunks (`pdf.worker`, `pdf`) bauen sauber.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **FE-MOB-01** und **FE-MOB-07** in SCRUM-113 abgehakt werden → **SCRUM-113 auf Done**. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-99 — FE-AUTH-07 SSO/OIDC-Login (Auth-Code + PKCE) + Rollen-Mapping

**Ticket(s):** SCRUM-99 / FE-AUTH-07. Freigegebener Weg: **Authorization Code + PKCE (S256)** — kein Implicit, kein id_token im Browser-Fragment. Umsetzung exakt nach freigegebenem Ziel-Flow.

**Befund (read-only):** Backend hatte OIDC-Verifier (jose/JWKS, iss/aud, getestet), Route `POST /api/auth/oidc` (verify-only, idToken), `loginWithOidc` (Auto-Provision). Lücken: (1) **kein Claim-basiertes Rollen-Mapping** (Rolle nur „erstes Konto=admin, sonst experte"), (2) **keine FE-Anbindung** (`authApi.oidc`/Button/Callback), (3) **kein echter Login-Flow** (nur Token-Verify, kein Authorize/Token-Exchange). SCRUM-25: kein lokaler/Spec-Treffer, kein Blocker.

**Backend — geänderte/neue Dateien:**
- `services/auth/src/oidc.ts` — Auth-Code+PKCE: `createPkcePair`/`codeChallengeS256` (S256), `OidcConfig` um authorize/token/clientId/redirectUri/clientSecret/roles erweitert, `OidcClaims.roles`, **lazy** JWKS, `verify(idToken, expectedNonce?)` mit **nonce-Prüfung**, injizierbarer `createTokenExchanger` (Form-POST an Token-Endpoint, optional client_secret), `createOidcProvider` (authorizeUrl/exchange/verify/mapRole), `createOidcProviderFromEnv` (nur aktiv bei vollständiger Config). **Rollen-Mapping**: reine `mapOidcRole(groups,cfg)` + `parseRolesClaim` — Default `viewer`, Präzedenz admin>controller>experte>viewer, **Admin nur bei exakt konfigurierter Gruppe** (kein stiller Admin).
- `services/auth/src/service.ts` — `loginWithOidc(claims, autoProvision, mappedRole?)`: mappedRole nur beim **Provisionieren** neuer Konten; Bootstrap-Erstkonto bleibt Admin; **bestehende Konten behalten ihre Admin-Rolle** (Claims überschreiben nie still).
- `services/auth/src/routes.ts` — `GET /api/auth/oidc/start` (state/nonce/PKCE-verifier als kurzlebige HttpOnly/SameSite-Cookies → Redirect zum IdP, response_type=code, S256); `POST /api/auth/oidc` (state==Cookie, Code-Tausch mit verifier, id_token+nonce-Verify, Rollen-Mapping, Session; Flow-Cookies werden gelöscht). `/api/auth/status` liefert zusätzlich `oidcEnabled`.
- `services/auth/index.ts`, `services/app/src/build-app.ts` — neue Exporte/`createOidcProviderFromEnv`-Wiring.
- `services/auth/src/oidc.test.ts` — erweitert: nonce-Reject, PKCE-S256, Rollen-Mapping (Präzedenz + kein stiller Admin + parseRolesClaim), Provider-Code-Flow (Exchange injiziert/stubbar, nonce-Verify, Rolle aus Claims), loginWithOidc (Provision mit mappedRole, bestehender Nutzer behält Admin-Rolle).

**Frontend — geänderte/neue Dateien:**
- `apps/web/src/lib/oidcCallback.ts` (neu, DOM-frei) `parseOidcCallback`/`isCompleteCallback` + `tests/auth/oidc-callback.test.ts`.
- `apps/web/src/api/auth.ts` — `AuthStatus.oidcEnabled`, `authApi.ssoStartUrl`, `authApi.oidc(code,state)`.
- `apps/web/src/app/AuthContext.tsx` — `oidcEnabled` aus Status durchgereicht.
- `apps/web/src/auth/AuthScreens.tsx` — SSO-Abschnitt im Login: Button „Mit SSO anmelden" **nur aktiv wenn `oidcEnabled`**, sonst ehrlicher Hinweis „nicht konfiguriert".
- `apps/web/src/auth/SsoCallback.tsx` (neu) — Callback **vor** dem Auth-Gate (`App.tsx` Pfad `/sso/callback`): verarbeitet code/state, postet, Fehler ehrlich, leitet weiter.
- `apps/web/src/App.tsx`, `i18n.ts` (`auth.sso*`, DE+EN).
- `.env.example` + `docs/operations/deploy-hetzner.md` — neue OIDC-Variablen (authorize/token/clientId/redirectUri/optional secret + Rollen-Gruppen), Flow-Beschreibung aktualisiert. **Keine echten Secrets im Repo.**

**Erfüllte AK:** Auth-Code+PKCE-Flow (start→IdP→/sso/callback→exchange) ✓ · state/nonce/PKCE serverseitig geprüft ✓ · Rollen-Mapping deterministisch + getestet, Default viewer, Admin nur via exakter Gruppe ✓ · bestehende Rollen nicht still überschrieben ✓ · Provision mit mappedRole, Bootstrap-Erstkonto bleibt ✓ · `oidcEnabled` im Status, SSO-UI ehrlich aktiv/deaktiviert ✓ · kein Fake-SSO, kein Implicit, keine hardcodierten Secrets ✓ · Passwort-/Setup-/Register-/Reset-Flows unverändert (nur additiv) ✓.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · `npm run check` GRÜN — **51 Testdateien / 257 Tests** (neu: oidc-Erweiterungen + `oidc-callback.test.ts`) · Biome grün · depcruise sauber.

**Risiken/Grenzen:** SSO erfordert vollständige Provider-Config (sonst UI ehrlich deaktiviert, Route 501). Implicit bewusst nicht verwendet. client_secret nur für confidential clients optional. Token-Exchange nutzt globales `fetch` (Node 20), in Tests injiziert.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push darf **FE-AUTH-07** abgehakt werden → **SCRUM-99 auf Done**, sofern die übrigen Auth-Checkboxen erledigt sind. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-98 — Foundation abschließen: FE-FND-01 (App-Shells) + FE-FND-09 (Missionen)

**Ticket(s):** SCRUM-98 / FE-FND-01 + FE-FND-09. Freigegeben: Option A (minimaler echter Missions-Block). Ziel: SCRUM-98 lückenlos schließen.

**Befund (Re-Audit vs. Erstprüfung Z. 883–934):** Die seinerzeit offenen Foundation-Punkte sind durch Folgetickets geschlossen: **FE-FND-02** (Nav-Rolle aus Session) via `RoleContext`/`effectiveRole` (SCRUM-150); **FE-FND-04** (Toaster-Bus) via `ToastContext`/`useToast` (SCRUM-151); **FE-FND-08** (periodisches Nachladen) via `AuthContext` `refetchInterval`+`refetchOnWindowFocus`. FE-FND-03/05/06/07 bereits abhakbar. Verblieben: FND-01 und FND-09.

**FE-FND-01 (App-Shells) — abhakbar, Evidenz:** Login-Shell (`App.tsx` Gate → AuthScreens/ResetScreen/SsoCallback), Desktop-Control-Room (`AppShell.tsx`: Sidebar+Topbar+Content+CommandPalette, Navigation aus `navigation.ts` als einzige Quelle), **Mobile/PWA-Shell** real durch SCRUM-113 (installierbare PWA: Manifest/standalone/Icons/Service-Worker/Offline-Start + echte mobile Erfassung/Fragen/Wissenszugriff + Offline-Queue). Der ursprüngliche Blocker („Mobile statische Vorschau") ist behoben.

**FE-FND-09 (Missionen) — umgesetzt (echt, kein Demo):**
- `apps/web/src/lib/missions.ts` (neu, DOM-frei) — `missionsForRole(role, stufe2)`: leitet kuratierte Deep-Links **aus den vorhandenen `NAV_GROUPS` + `canSee`** ab (keine zweite Berechtigungslogik), aufgaben-orientierte Reihenfolge (erfassen→validierung→risiko→fragen→bibliothek), max. 4, gefiltert nach Rollen-Sichtbarkeit. Liefert nur `id/path/labelKey/descKey` echter Flows.
- `apps/web/src/pages/Start.tsx` — neue rollenbewusste „Missionen"-Sektion (2–4 Kacheln) **über** den bestehenden KPIs/CTA/Todo; Kacheln sind `<Link>` auf echte Routen (`/erfassen`,`/validierung`,`/risiko`,`/fragen`,`/bibliothek`). Bestehende CTA/KPIs/Todo unverändert. Keine neuen Routen, keine Platzhalterseiten, kein Fake-Inhalt, keine Backend-Änderung.
- `apps/web/src/i18n.ts` — `missions.title` + `missions.<id>.desc` (DE+EN).
- `tests/app/missions.test.ts` (neu) — 5 Tests: viewer→[fragen,bibliothek]; experte→[erfassen,fragen,bibliothek]; controller/admin→[erfassen,validierung,risiko,fragen] (max 4, admin==controller); jede Mission echter Pfad+descKey; je Rolle 2–4 Missionen.

**Sichtbarkeitslogik (kein Doppel-RBAC):** ausschließlich `canSee(item, role, stufe2)` aus `navigation.ts`; Missionen sind eine Sicht auf bestehende Nav-Items, kein neues Rechtemodell. Backend-RBAC bleibt serverseitig maßgeblich.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · `npm run check` GRÜN — **52 Testdateien / 262 Tests** (5 neu) · Biome grün · depcruise sauber.

**Erfüllte AK:** rollenbewusste Missionen aus echter Nav/Role-Logik ✓ · 2–4 Kacheln je Rolle ✓ · nur Deep-Links in existierende Flows ✓ · Sichtbarkeit an Rollenrecht gebunden ✓ · keine neuen Routen/Platzhalter/Fake/Marketing ✓ · keine Backend-Änderung ✓ · KPIs/CTA unbeschädigt ✓.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **FE-FND-01** und **FE-FND-09** abgehakt werden → **SCRUM-98 auf Done** (die übrigen FND-Punkte sind belegt erledigt). Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-117 + SCRUM-109 — Output Factory (Backend-Modul + Frontend)

**Ticket(s):** SCRUM-117 (Backend-Modul `services/output`) + SCRUM-109 (Frontend-Factory in `Stufe2.tsx`). FR-EXT-03 / FE-OUT-01/02/03. Umsetzung exakt nach freigegebenem Read-only-Plan.

**Befund:** `Stufe2.tsx` `Output()` war reiner Platzhalter (`s2.output`-Notice). `LibraryService.exportMarkdown/Html/Json` ist roher KO-Dump ohne Status-Filter → laut Leitplanke **kein** Output-Ersatz. KO-Modell hat status/trust/version/originalAuthor/category/type/conditions/measures/createdAt, aber **kein** `validity_until` (FR-EXT-07 = Konzept) → Gültigkeit muss abgeleitet werden. Modulmuster (`index.ts`+`src/*`, Route, build-app-Wiring) und `KoService.list({status})` vorhanden.

**Backend — neues Modul `services/output` (SCRUM-117), stateless, keine Persistenz, keine KO-Mutation:**
- `src/types.ts` — `OutputKind` (5), `OUTPUT_KINDS`, `UNCERTAIN_TRUST_BELOW=60`, `OutputSource`, `OutputProvenance`, `OutputDocument`, `GenerateOutputInput`, `OutputError`.
- `src/render.ts` (rein, DOM-frei) — `toSource`/`toProvenance` + 5 Renderer (instruction/SOP, checklist, troubleshooting, training, management_summary) + `renderProvenance`. Gültigkeit ehrlich: `validiert · v{version} · Stand {createdAt}`, **kein Ablaufdatum**.
- `src/service.ts` — `OutputService`: `listEligible()` liefert **nur** `status:"validiert"`; `generate()` weist nicht-validierte/unbekannte IDs, leere Auswahl, unbekannten Typ ab (`OutputError`), baut Markdown (Kopf mit Adressat/Datum + Körper + Herkunftsblock) + strukturierte `provenance[]`. Deterministisch via injizierbarem `now`.
- `index.ts`, `src/service.test.ts` (8 Tests). Route `services/app/src/routes/output-routes.ts` (`GET /api/output/sources`, `POST /api/output/generate`, Guard `ko.read`, `sendError`-Mapping). Wiring in `build-app.ts` (`AppServices.output`, `assembleServices`, `app.register`).

**Frontend — Output Factory (SCRUM-109):**
- `api/types.ts` (`OutputKind/Source/Provenance/Document`), `api/endpoints.ts` (`output.sources/generate`), `api/hooks.ts` (`useOutputSources`).
- `pages/Stufe2.tsx` `Output()` ersetzt Platzhalter: Typ-Auswahl (5 Kacheln), Mehrfachauswahl **validierter** Quellen (ehrlicher Leerzustand via `QueryState`/`out.noValidated`), „Output erzeugen" → **Markdown-Vorschau** + **Herkunfts-Panel** (KO-ID·Status·Trust·Gültigkeit, Unsicherheit markiert) + **Kopieren** & **Download .md** (Blob). Adressat = aktuelle Rolle (`useRole`). Fehler über Toast.
- `lib/outputDoc.ts` (DOM-frei) — `OUTPUT_KIND_OPTIONS`, `downloadFilename`, `orderedSelection` + `tests/output/output-doc.test.ts` (3 Tests). i18n `out.*` (DE+EN).

**Erfüllte AK:** nur validierte KOs als Quelle (Service-Guard + UI) ✓ · kein Library-Export-Ersatz (eigene strukturierte Renderer) ✓ · 5 echte Output-Typen ✓ · Markdown-Export (Vorschau+Copy+Download) ✓ · Provenance je Quelle: KO-ID/Titel/Status/Trust/Version/Autor/Originalautor/Kategorie/Typ/abgeleitete Gültigkeit ✓ · Gültigkeit ehrlich (validiert+Version+Stand, kein Ablaufdatum) ✓ · keine Persistenz/PDF/KO-Mutation ✓.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · `npm run check` GRÜN — **54 Testdateien / 272 Tests** (11 neu: 8 Backend-Service + 3 FE-Helfer) · Biome grün · depcruise sauber (neues Modul `output`→`knowledge-object` über öffentliche index.ts erlaubt).

**Abgrenzung (nicht gebaut):** kein PDF/Print, keine Persistenz erzeugter Outputs (`generated_outputs` bleibt Konzept), kein `validity_until`/`freshness`/`ip_sensitivity`-Datenmodell, kein Backend-Redesign.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **FE-OUT-01/02/03** abgehakt werden → **SCRUM-117** und **SCRUM-109** auf Done. Ein kombinierter Commit wie gewünscht. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-120 + SCRUM-114 — Management/Wissenskapital (Backend-Modul + Frontend-Dashboard)

**Ticket(s):** SCRUM-120 (Backend-Modul `services/management`) + SCRUM-114 (Frontend `Capital()` in `Stufe2.tsx`). FE-MGMT-01…09. Freigegebene risikoarme Variante: bestehende FE-Primitives `knowledgeHealth`/`domainRisk` bleiben unverändert; Analytics/Risk nicht umgebaut; minimaler Rohquoten-Overlap akzeptiert.

**Befund:** `Capital()` war reiner Platzhalter (`s2.capital`). Datenquellen live vorhanden (`KoService.list`, `AskService.listGaps`, `ConflictService.unresolved`, `LifecycleService.pendingRevalidation`, `LibraryService.busFactor`). KO-Modell hat kein €-Feld → Valuation nur als Schätzmodell.

**Backend — neues Modul `services/management` (SCRUM-120), stateless, keine Persistenz/Snapshots, keine KO-Mutation:**
- `src/metrics.ts` (rein, DOM-frei, deterministisch, kein NaN bei leerem Bestand): `capitalScore` (5 gewichtete Teil-Scores, Σ Gewichte=1), `overview`, `valuationFacts` (nur Fakten), `statement` (Aktiva/Risiken/Netto + Breakdown), `maturity` (Stufen 1–5 aus Quoten), `priorities` (9-Faktoren-Dringlichkeit je Kategorie, gewichtet+sortiert), `recommendations` (deterministisch aus schlechtesten Signalen, nach Anzahl sortiert), `house` (Domänen-Stockwerke, fragil-Flag), `pilot` (30/60/90 aus `createdAt`), `computeSnapshot`.
- `src/service.ts` — `ManagementService` sammelt Live-Daten (Promise.all) und ruft `computeSnapshot`; `now` injizierbar; `GET`-tauglicher `snapshot()`.
- `index.ts`, `src/metrics.test.ts` (13 Tests), `src/service.test.ts` (2 Tests). Route `management-routes.ts` (`GET /api/management/snapshot`, Guard `ko.read`). Wiring in `build-app.ts`: ask/conflicts/library/lifecycle als Consts vorgezogen, `management`-Service mit deren Live-Lesern verdrahtet, `AppServices.management` + `app.register`.

**Frontend — `Capital()` (SCRUM-114):**
- `api/types.ts` `ManagementSnapshot`, `endpoints.management.snapshot`, `hooks.useManagementSnapshot`.
- `Capital()` ersetzt Platzhalter durch `CapitalDashboard`: **Overview-Snapshot** (FE-MGMT-01), **Capital Score** mit Teil-Score-Balken (03), **Valuation** (04) mit sichtbaren/änderbaren Annahmen + Formel + Disclaimer „Schätzmodell, keine Bilanzbewertung", **Statement** Aktiva/Risiken/Netto + Breakdown (05), **Maturity Journey** (06), **Knowledge House** mit fragil-Markierung (08), **Hero-Assist-Empfehlungen** (07), **Prioritäten (9 Faktoren)** (09), **Pilot 30/60/90** als Tabelle mit `window.print()` + ehrlichem Hinweis „Druck-/HTML-Ansicht, kein zertifiziertes PDF" (02). Ehrlicher Leerzustand bei `totalKos===0`.
- `lib/knowledgeValuation.ts` (DOM-frei): `estimateValuation(facts, assumptions)` = validierte Objekte × €/Std × Std/Objekt × Wiederverwendung × (Ø-Trust/100), Default-Annahmen offengelegt + im UI editierbar. `tests/management/knowledge-valuation.test.ts` (6 Tests). i18n `mgmt.*` (DE+EN).

**Erfüllte AK:** nur echte Live-Daten (keine Demo-/Beispielzahlen; leerer Bestand → Leeransicht) ✓ · Valuation als transparentes Schätzmodell mit Formel/Annahmen + „keine Bilanzbewertung" ✓ · Pilot als HTML-/Druckansicht ohne PDF-Paket ✓ · FE-Primitives `knowledgeHealth`/`domainRisk` unverändert, Analytics/Risk nicht umgebaut ✓ · keine Persistenz/Snapshots, keine KO-Mutation, kein Backend-Redesign ✓.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · `npm run check` GRÜN — **57 Testdateien / 293 Tests** (21 neu: 13 metrics + 2 service + 6 valuation) · Biome grün · depcruise sauber (`management`→`knowledge-object` über öffentliche index.ts erlaubt).

**Abgrenzung (nicht gebaut):** keine Bilanzbewertung, keine Snapshot-Persistenz/Zeitreihen über `createdAt`-Fenster hinaus, kein PDF-Paket, keine Duplizierung der Health-/Risk-Formeln.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **FE-MGMT-01…09** abgehakt werden → **SCRUM-120** und **SCRUM-114** auf Done. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-119 — SVG-Wissensgraph aus Live-Daten (FR-ANA-03)

**Ticket(s):** SCRUM-119. Freigegeben: textuelle `GraphView` durch echten SVG-Graph ersetzen, Konfliktkanten-Overlay aus echten Daten. Kein Backend-Umbau.

**Befund:** `Graph { nodes:{id,title}[], edges:{a,b,via}[] }`; `LibraryService.graph()` baut echte Tag-Kanten (`via`=geteilter Tag, getestet). Knoten-Payload ohne Status → Knotenfärbung per FE-Join `useKos()`+`deriveStatus`. `Conflict{koA,koB}` via `useConflicts()` → echte Konfliktkanten. Keine vorhandene Layout-/SVG-Graph-Logik.

**Umsetzung:**
- `apps/web/src/lib/graphLayout.ts` (neu, rein/DOM-frei, deterministisch): `layoutGraph` (Kreis-Layout, Knoten stabil nach id sortiert, Koordinaten gerundet → reproduzierbar; Einzelknoten mittig; leerer Graph sicher; Kanten ohne existierende Endpunkte verworfen), `layoutConflicts` (nur Paare mit beiden vorhandenen Knoten), `limitGraph` (ehrliche Anzeige-Begrenzung großer Graphen auf die am stärksten verbundenen Knoten — keine Fake-Daten). Keine Force-Simulation, keine Graph-Library.
- `apps/web/src/pages/Stufe2.tsx` `GraphView`: Textliste → **SVG** (`<svg viewBox>`): Tag-Relationen als graue Linien (mit `via`-Tooltip), **Konfliktkanten rot/gestrichelt** (eigener Typ, aus `useConflicts` koA/koB), Knoten als Kreise gefärbt nach abgeleitetem Status (`deriveStatus`, `currentColor`-Fill), gekürzte Titel-Labels. **Legende** (validiert/offen, Tag-Relation, Konflikt). Echter `nodes/edges`-Count; bei >60 Knoten ehrlicher Truncate-Hinweis. Leerzustand (`s2.graphEmpty`) bleibt.
- `apps/web/src/i18n.ts`: `graph.truncated`, `graph.legend*` (DE+EN).
- `tests/analytics/graph-layout.test.ts` (neu, 10 Tests): Determinismus, id-Sortierung, Bounds + paarweise verschieden, Einzel-/Leer-Sonderfälle, Kanten-Endpunkte, verworfene Geister-Kanten, Konflikt-Mapping, limitGraph (unverändert unter Limit / behält Top-Grad-Knoten).

**Erfüllte AK:** Knoten/Kanten visuell als SVG ✓ · echte Live-Daten aus `/api/graph` (+ FE-Join KO-Status, echte Konflikte) ✓ · Legende sichtbar ✓ · Knotenstatus aus vorhandenen Daten abgeleitet ✓ · deterministisches, ohne DOM testbares Layout ✓ · keine Fake-Knoten/-Kanten ✓ · kein Backend-Umbau, keine neuen Payload-Felder, keine anderen Stufe-2-Sichten verändert ✓.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · `npm run check` GRÜN — **58 Testdateien / 303 Tests** (10 neu) · Biome grün · depcruise sauber.

**Abgrenzung (nicht gebaut):** kein Backend/Payload-Umbau, keine schwere Graph-Lib, keine Force-Physik, keine Fake-Daten, keine Änderung an Output/Capital/Import.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push darf **SCRUM-119 / FR-ANA-03** abgehakt → auf Done. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-115 — Gap-Priorität (FE-RISK-02) + Close-Endpoint-Fix

**Ticket(s):** SCRUM-115 / FE-RISK-02 (letzte offene SCRUM-106-Lücke). Freigegeben: Priorisierung ergänzen UND den Close-Endpoint-Mismatch im selben Block klein mitfixen.

**Befund:** `Gap` ohne Priorität. `PgGapRepo` speichert das ganze Gap als JSON (`gaps(id,data)`) → **keine Migration** für ein neues Feld. Nebenbefund bestätigt: `endpoints.gaps.close` sendete `{action:"close"}`, Route prüfte `body.close` → Close FE/API-seitig nicht gekoppelt.

**Backend (services/ask):**
- `types.ts`: `GapPriority = "hoch"|"mittel"|"niedrig"`, `GAP_PRIORITIES`, `isGapPriority`, `Gap.priority`, AskErrorCode `+BAD_REQUEST`.
- `service.ts`: `createGap` setzt `priority:"mittel"`; neue `setGapPriority(id, priority)` (validiert, Audit `gap.priority-changed`); **Read-Normalisierung** `withPriority` in `require` + `listGaps` → **Legacy-Gaps ohne priority → Default "mittel"** auf allen Rückgabepfaden (list/assign/close/setPriority).
- `index.ts`: `GapPriority`/`GAP_PRIORITIES`/`isGapPriority` exportiert.
- `ask-routes.ts` `PUT /api/gaps/:id`: neuer `priority`-Zweig (ungültig → 400); **Close akzeptiert jetzt `{close:true}` UND `{action:"close"}`** (rückwärtskompatibel, keine neue Semantik); Assign/Delete unverändert.

**Frontend:**
- `api/types.ts`: `GapPriority` + `Gap.priority`. `endpoints.gaps.setPriority` (PUT `{priority}`); `gaps.close` sendet nun `{close:true}` (passt zur Route).
- `lib/gapPriority.ts` (neu, DOM-frei): `GAP_PRIORITIES`, `priorityRank`, `sortGapsByPriority` (hoch→mittel→niedrig→createdAt, Eingabe unverändert), `priorityTone`.
- `pages/Risk.tsx`: je Gap **Prioritäts-Badge** (Farbe nach Tone) + **Select zum Ändern** (offene Gaps), Liste **nach Priorität sortiert**. Assign/Close/Delete unverändert.
- `i18n.ts`: `risk.priority.*`, `risk.priorityLabel` (DE+EN).

**Tests:** `services/ask/src/service.test.ts` (+4): Default „mittel" bei neuer Lücke; `setGapPriority` ändert + Audit; ungültige Priorität → BAD_REQUEST; Legacy-Gap ohne priority → beim Lesen/Zuweisen „mittel". `tests/ask/gap-priority.test.ts` (neu, DOM-frei, 4): GAP_PRIORITIES, priorityRank, sortGapsByPriority (inkl. Unveränderlichkeit), priorityTone. Bestehende Gap-Literale (`notification-feed.test.ts`, `ask-response.test.ts`) um `priority` ergänzt.

**Erfüllte AK:** Datenmodell enthält Priorität ✓ · API setzt/ändert Priorität (400 bei ungültig) ✓ · Risk-UI zeigt Priorität + ändert + sortiert ✓ · Assign/Close/Delete unverändert (Close jetzt korrekt gekoppelt) ✓ · Service/API/DOM-freie Tests ✓ · Legacy-Default „mittel" ✓ · keine neue Gap-Engine, keine Demo-Prioritäten, keine Migration, kein Backend-Redesign ✓.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · `npm run check` GRÜN — **59 Testdateien / 311 Tests** (8 neu) · Biome grün · depcruise sauber.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push darf **FE-RISK-02** vollständig abgehakt werden → **SCRUM-115** auf Done (und damit SCRUM-106 vollständig). Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-118 — External-Knowledge-Proxy (FR-EXT-02)

**Ticket(s):** SCRUM-118 / FR-EXT-02. Optionaler Server-Proxy für externe Quellensuche; Ergebnis als externe, nicht peer-validierte Quelle anhängbar. Entscheidungen: Wikipedia/MediaWiki-Default (Lang `de`, Env `EXTERNAL_SEARCH_LANG`, abschaltbar `EXTERNAL_SEARCH=off`); Provider als optionales additives `KoSource.provider?`.

**Befund:** `KoSource` (external/peerValidated) + `addSource`/`add-source`-Pfad vollständig vorhanden → Anhängen wird wiederverwendet. KO als JSON persistiert → optionales `provider`-Feld ohne Migration. Fetch-Injektions-Muster (OIDC/PDF) als Vorlage; keine Live-Netzwerk-Tests im Repo.

**Backend — neues optionales Modul `services/external-search` (stateless, kein KO-Bezug):**
- `types.ts`: `ExternalResult {title,url,snippet,provider}`, `SearchProvider`, `ExternalSearchError`, injizierbarer `FetchLike`.
- `wikipedia.ts`: `createWikipediaProvider({lang?,fetchImpl?})` → MediaWiki-Such-API (kein Key); `stripHtml` (Tags+Entities) und `articleUrl` (Leerzeichen→`_`, encode). Ergebnis `provider:"Wikipedia"`.
- `service.ts`: `ExternalSearchService.search(q)` — leere Query → `[]`, Begrenzung auf 10, reicht echte Treffer durch; `createExternalSearchFromEnv` (undefined bei `EXTERNAL_SEARCH=off`).
- `index.ts`, `service.test.ts`, `wikipedia.test.ts` (injizierter Fetch, **kein Live-Netzwerk**).
- Route `external-routes.ts` `GET /api/external/search?q=` (Guard `ko.read`; deaktiviert → **501**). Wiring `build-app.ts` (`AppServices.externalSearch?` optional + `app.register`).

**Quellenmodell (additiv wiederverwendet):**
- `KoSource.provider?: string | null` (BE+FE), `addSource`-Input + `add-source`-Body um `provider?` erweitert. Quelle bleibt **immer** `kind:"external"` / `peerValidated:false`.

**Frontend (`KnowledgeDetail.tsx`):**
- `endpoints.external.search`; DOM-freier `lib/externalSearch.ts` (`toSourcePayload` Mapping + Excerpt-Cap + `isAttachable`) + `tests/ko/external-search.test.ts`.
- Panel „Externe Quelle suchen": Eingabe + Suche → Trefferliste (Titel, **Provider**, Snippet, Link); je Treffer „Als Quelle anhängen" → **bestehender** `add-source`-Pfad (label/url/excerpt/provider). Kein Auto-Anhängen. Provider-Badge auch an vorhandenen Quellen. Honest-Hinweis „externe, nicht peer-validierte Quelle — kein Ersatz für interne Validierung".
- i18n `ext.*` (DE+EN). `.env.example` ergänzt.

**Erfüllte AK:** Server-seitige externe Suche (Wikipedia) ✓ · nie auto-übernommen (nur per Klick) ✓ · Anhängen über bestehendes Quellenmodell, immer external/nicht peer-validiert ✓ · URL/Label/Excerpt/Provider sichtbar ✓ · Provider-Abstraktion mit injizierbarem Fetch, kein Live-Netzwerk in Tests ✓ · keine schwere Search-/Scraping-Lib ✓ · kein neues Quellenmodell (nur additives provider) ✓ · optional via Env (501 wenn aus) ✓ · kein Backend-Redesign ✓.

**Gelaufene Checks:** apps/web `tsc --noEmit` EXIT=0 · `npm run check` GRÜN — **62 Testdateien / 321 Tests** (10 neu: 4 wikipedia + 3 service + 3 FE-Mapping; KO-Service-Test um provider erweitert) · Biome grün · depcruise sauber (`external-search` ohne interne Cross-Modul-Deps).

**Abgrenzung (nicht gebaut):** kein Auto-Anhängen, keine Browser-Direktabfrage, keine schwere Such-/Scraping-Library, kein neues Quellenmodell, kein Live-Netzwerk in Tests, kein Backend-Redesign anderer Module.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push darf **SCRUM-118 / FR-EXT-02** abgehakt → auf Done. Externe Suche ist standardmäßig aktiv (Wikipedia); per `EXTERNAL_SEARCH=off` deaktivierbar. Ich setze keine Jira-Checkbox/Status selbst.

---

## 2026-06-26 · SCRUM-45/46/48 — KW-STR WYSIWYG-Editor (bodyHtml + Sanitizer + Bilder)

**Ticket(s):** SCRUM-45/46/48 (KW-STR / FR-STR-02/03/05/06, NFR-SEC-04). Freigegeben: bodyHtml additiv, server-autoritärer DOM-freier Allowlist-Sanitizer + FE-Defense, nativer contentEditable, `/api/objects/:id/raw`, in einem Rutsch sauber geschichtet.

**Befund:** KO-Inhalt war Plaintext (`statement`, `<p>{statement}</p>`); kein HTML-Feld, kein Sanitizer im Repo. Spec verlangt sanitisiertes HTML mit Bild-Refs auf den Asset-Store. Object-Store-Read lieferte nur JSON (keine einbettbare Bild-URL). KO/Draft sind JSON-persistiert → additives Feld ohne Migration.

**Schicht 1 — Sanitizer (`services/structure`, server-autoritär):**
- `sanitizeHtml` (rein, DOM-frei, Allowlist-Tokenizer): erlaubt p/br/h2/h3/strong/em/u/ul/ol/li/a/img/blockquote/div.panel; entfernt script/style/iframe, `on*`-Handler, `style`-Attribute, unbekannte Tags/Attrs; href nur sichere Schemes (kein `javascript:`); img-src nur `/api/objects/:id/raw` oder `data:image`; schließt offene Tags, idempotent, malformed-tolerant. `htmlToPlainText` für die statement-Ableitung. 10 Tests.

**Schicht 2 — KO-Modell + Service:**
- `KnowledgeObject.bodyHtml?`, `CreateKoInput`/`ReviseKoInput`/`DraftPayload` um `bodyHtml?` erweitert (additiv, keine Migration). `KoService.create`/`revise` sanitisieren `bodyHtml` **serverseitig** und leiten `statement` aus dem HTML ab, wenn leer (statement bleibt führend für Output/Ask/Suche). Capture `toKoInput` reicht bodyHtml an `create` (wird dort sanitisiert). 3 neue KO-Tests.

**Schicht 3 — Bild-Endpoint:** reiner `decodeDataUrl` (object-store) + `GET /api/objects/:id/raw` (Bytes + Content-Type, `ko.read`). 2 Tests.

**Schicht 4 — Frontend:**
- `lib/richText.ts` (DOM-frei): `sanitizeHtml`-Spiegel (Defense-in-Depth), `htmlToPlainText`, `isEmptyHtml`, `insertImageHtml`. `components/SanitizedHtml.tsx` (einziger `dangerouslySetInnerHTML`-Ort, sanitisiert). `components/RichTextEditor.tsx`: nativer `contentEditable` + Toolbar (Fett/Kursiv, H2/H3, UL/OL, Link, Panel/Callout, Bild-aus-Anhang), **Vorschau↔Bearbeiten ohne State-Verlust** (FR-STR-05). `.prose-kw`-Typo in `index.css`.
- `Capture.tsx`: `bodyHtml`-State, im Submit/saveDraft/Resume persistiert; Submit erzeugt KO „offen", Entwurf wie bisher entfernt (FR-STR-06). `KnowledgeDetail.tsx`: zeigt sanitisiertes `bodyHtml` (Fallback statement), Edit-Modus bearbeitet bodyHtml verlustfrei, Bildpalette nutzt vorhandene Image-Anhänge (`objectId` → `/api/objects/:id/raw`, FR-STR-03). i18n `editor.*`/`capture.fBody` (DE+EN). `tests/structure/rich-text.test.ts` (3 Gruppen).

**Erfüllte AK:** minimaler echter WYSIWYG (FR-STR-02) ✓ · Bilder via ObjectRef/raw-Endpoint platzierbar (FR-STR-03) ✓ · Vorschau/Bearbeiten verlustfrei (FR-STR-05) ✓ · Submit → KO offen + Entwurf entfernt (FR-STR-06) ✓ · sanitisiertes HTML server-autoritär + FE-Defense (NFR-SEC-04) ✓ · DOM-freie Sanitizer-/Editor-State-Helfer + Tests ✓ · statement bleibt Plaintext, bodyHtml additiv, keine Migration ✓.

**Gelaufene Checks:** apps/web `tsc` EXIT=0 · `npm run check` GRÜN — **64 Testdateien / 342 Tests** (~18 neu) · Biome grün · depcruise sauber (`knowledge-object`→`structure`, `app`→`structure`/`external-search`/`object-store` über öffentliche index.ts).

**Abgrenzung:** keine schwere Editor-Suite, kein Markdown-Roundtrip, keine Tabellen, kein kollaboratives Editing, kein HTML in `statement`, kein Backend-Redesign über bodyHtml + raw-Endpoint hinaus.

**Empfehlung:** Nach grünem Mac-Gate + Commit/Push dürfen **SCRUM-45/46/48 (FR-STR-02/03/05/06)** abgehakt → auf Done. Ich setze keine Jira-Checkbox/Status selbst.

---

## After-Report — SCRUM-87 (FR-MOB-03) + STR-Sanitizer-Härtung (NFR-SEC-04) — 2026-06-26

### SCRUM-87 / FR-MOB-03 — Mobile „Entwurf verwerfen" Inline-Bestätigung
- **Was:** destruktive Aktion bestätigt jetzt inline (kein window.confirm / nativer Dialog). Erster Klick auf „Verwerfen" zeigt nur für diesen Draft eine Bestätigung (✓/✗), zweiter Klick löscht über `endpoints.drafts.remove`, „Abbrechen" setzt zurück. Ein anderer Draft ersetzt die Markierung sauber (nur einer aktiv).
- **DOM-frei + testbar:** neuer Helfer `apps/web/src/lib/mobileConfirm.ts` (`ConfirmState`, `requestConfirm`/`clearConfirm`/`isPending`/`needsConfirmation`/`confirmsDelete`). Test `tests/capture/mobile-confirm.test.ts`.
- **Unverändert:** Draft-/Offline-/Toast-Logik, keine neue Draft-Architektur, keine Offline-Queue-Änderung.
- **i18n:** DE/EN `mob.discardConfirmHint`, `mob.confirmDiscard`, `mob.cancelDiscard`.

### STR-Sanitizer-Härtung — NFR-SEC-04
- **data:image-Allowlist verschärft:** nur noch sichere Rastertypen (png, jpeg, jpg, gif, webp). `image/svg+xml` explizit abgelehnt (SVG kann Skripte tragen → XSS). Server-autoritär in `services/structure/src/sanitize.ts`, FE-Spiegel in `apps/web/src/lib/richText.ts`.
- **script/style/iframe:** Inhalt wird jetzt komplett verworfen (`dropUntil`-Logik im Tokenizer) statt als Text behalten — kein Text-Leak; unbalancierte Drop-Tags verwerfen auch den Rest. Beidseitig gespiegelt.
- **Tests:** `sanitize.test.ts` + `tests/structure/rich-text.test.ts` erweitert (svg verworfen, alle Rastertypen erlaubt, script/style-Inhalt komplett entfernt, Idempotenz bleibt). KO-Service-Tests an das gehärtete Verhalten angepasst.
- **Abgrenzung gehalten:** keine neue Sanitizer-Lib, kein Editor-Umbau, nur Allowlist-Härtung.

### Gates
apps/web-tsc EXIT=0 · `npm run check` grün (**65 Dateien / 347 Tests**) · Biome · depcruise sauber.

---

## After-Report — SCRUM-70 (FR-LIF-04) · Autor überall am KO sichtbar — 2026-06-26

### Was
Vermächtnis-Framing vervollständigt: der Autorenname ist jetzt auch in den kompakten KO-Darstellungen sichtbar, nicht nur im KO-Detail/Capture.
- **Library.tsx** — kompakte Autorzeile unter jedem Titel (`Autor: <Name>`, bei Transfer `· Original: <Name>`).
- **Validation.tsx** — Autorzeile je KO-Karte unter Trust/Ziel.
- **MyTasks.tsx** — Autorzeile bei KO-bezogenen Tasks (Validierung, Revalidierung, zurückgegeben); Gaps/Conflicts ohne KO unverändert. Revalidierungs-Label nutzt jetzt den KO-Titel (Fallback ID).

### Wie (sauber geschichtet, kein Backend)
- **DOM-frei + testbar:** `apps/web/src/lib/koAuthor.ts` → `koAuthorParts(ko, nameOf?)` löst Autor + Originalautor (nur bei Transfer/Abweichung) zu Anzeigenamen auf, Fallback auf ID. Test `tests/ko/ko-author.test.ts` (current-only, current+original, ID-Fallback).
- **Präsentationskomponente:** `components/trust/KoAuthorLine.tsx` (bekommt aufgelöste Namen, i18n `ko.author`/`ko.originalAuthor`). Keine `api/hooks`-Importe in components → Architektur sauber; Namensauflösung (`useDirectory` + `nameOf`) bleibt in den Seiten.
- **i18n:** DE/EN `ko.author`, `ko.originalAuthor`.

### Abgrenzung gehalten
Kein Backend, keine neue Autor-Transfer-Logik, keine KO-Modell-Umbenennung, kein Listen-Redesign — nur kompakte Herkunftszeile an bestehenden Karten/Zeilen.

### Gates
apps/web-tsc EXIT=0 · Biome · depcruise · `npm run check` grün (**66 Dateien / 350 Tests**).

---

## After-Report — SCRUM-88 (FR-I18N-01) · DE/EN vollständig inkl. KI/Reasoner — 2026-06-26

### Befund
UI-i18n (apps/web/src/i18n.ts, useTranslation, Sprachumschaltung in Topbar/Profile) war breit vorhanden. Lücke: Reasoner/Ask waren hart deutsch (Interview-Fragen, Systemprompts, Step-Labels) und nicht sprachbewusst steuerbar.

### Umsetzung (sprachbewusst, ohne Inhaltsübersetzung)
- **Reasoner locale-typisiert:** `ReasonerLocale = "de" | "en"` (types.ts, exportiert via index.ts).
- **Provider-Interface locale-aware:** `structure/answer/assistText/interview` nehmen optional `locale` (Default "de"). `INTERVIEW_QUESTIONS` ist jetzt eine `Record<ReasonerLocale, …>`-Map (echte EN-Fragen); `sourceLabel(title, locale)` → "Quelle:"/"Source:"; `deterministicInterview` folgt der Sprache.
- **ModelProvider locale-aware:** Systemprompts als Funktionen `structureSystem/answerSystem/assistSystem/interviewSystem(locale)` (EN-Varianten: "Answer ONLY based on the numbered sources…", "Ask exactly ONE next question…", "Improve wording without changing content…", JSON-Contract identisch). User-Prompt-Labels lokalisiert (Frage/Quellen/Bisherige Antworten/Leitfrage ↔ Question/Sources/Previous answers/Guiding question). Quellen werden NICHT übersetzt.
- **Reasoner-Service:** reicht `locale` an primary UND fallback identisch durch; Modellfehler → deterministischer Fallback behält die Sprache.
- **AskService:** `ask(question, actor, locale="de")` → `reasoner.answer(question, refs, locale)`; Gap-Erzeugung/-Frage unverändert.
- **Routes:** `/api/reasoner` + `/api/ask` akzeptieren `locale?: "de"|"en"`, normalisieren ungültige Werte sauber auf "de" (keine 400).
- **FE:** `endpoints.ask.ask` + `endpoints.reasoner.{structure,assist,interview}` senden optional `locale`. DOM-freier Helper `apps/web/src/lib/reasonerLocale.ts` (`toReasonerLocale`); Ask.tsx, Capture.tsx (structure/assist/interview), Mobile.tsx (Ask) senden die aktuelle UI-Sprache.

### Tests
- reasoner/service.test.ts: EN-Interview-Frage, EN-Answer-Steps ("Source:"), Fallback behält Sprache; bestehende INTERVIEW_QUESTIONS-Asserts auf `.de` umgestellt.
- reasoner/provider-model.test.ts: capturing-Client prüft EN-System-/User-Prompts (answer/interview/structure/assist), DE bleibt Default.
- ask/service.test.ts: `ask(..., "en")` reicht locale an den Reasoner durch (capturing provider).
- tests/i18n/reasoner-locale.test.ts: `toReasonerLocale` (de/de-DE→de, en/en-US/EN-GB→en, leer/unbekannt→de).

### Abgrenzung gehalten
Keine automatische Übersetzung existierender KOs, kein neues i18n-Backend, kein Datenmodellumbau, nur DE/EN. Reasoner antwortet auf Basis der Quellen; Quelleninhalte bleiben in Originalsprache.

### Gates
apps/web-tsc EXIT=0 · Biome · depcruise · `npm run check` grün (**67 Dateien / 360 Tests**).

---

## After-Report — EXT-Restblock SCRUM-90/91/95/96 · Import-Pipeline & Validity/Protection-Konzept — 2026-06-26

### Was (risikoarmer Konzept-/Sicht-Block, keine Engine/Migration)
Ein einziges DOM-freies Konzeptmodul `apps/web/src/lib/extConcept.ts` plus zwei sichtbare Karten — alles ehrlich aus vorhandenen Daten abgeleitet.

- **SCRUM-90 — Import-Pipeline sichtbar:** `IMPORT_PIPELINE_STEPS` (upload → extract → structure → review → validate → release → reuse) als Pipeline-Card vor der Queue in Stufe2/ImportReview.
- **SCRUM-91 — Importstatus/Befunde/Quelle:** `summarizeImportQueue` (total/open/accepted/rejected/infoRequested/duplicates) als Queue-Zusammenfassung; `candidateFindings` als kompakte Badges je Kandidat (Dublette, Angaben fehlen, Info angefragt, KO erzeugt, Abgelehnt). Bestehende Review-Actions unverändert; angenommener Kandidat bleibt normaler KO-Flow (koId).
- **SCRUM-95 — Validity & Protection:** neue Card „Gültigkeit & Schutz" in KnowledgeDetail aus `useLifecyclePending` + `useConflicts` + `validityProtectionView`. Zeigt Aktualität (validiert / Revalidierung fällig / offen / Konflikt / unbekannt), IP-Sensitivität = „nicht bewertet" (bewusst NICHT erfunden), Output-Eignung (nur wenn validiert) und eine abgeleitete Empfehlung. Konflikt hat Vorrang vor Revalidierung.
- **SCRUM-96 — Konzeptfelder:** als Typ-Vertrag im genutzten FE-Modul dokumentiert (`FreshnessStatus`, `IpSensitivity`, `ValidityProtectionView`). Bewusst KEINE backend-`ext-concept.ts`: ein nirgends importiertes Modul würde depcruise-Orphan/„ungenutzte Exports" auslösen; keine Persistenz/Migration nötig.

### Tests
`tests/library/ext-concept.test.ts`: Pipeline-Reihenfolge, Queue-Summary, Candidate-Findings, Validity-Ableitung (validiert→outputEligible true; pending→revalidierung-faellig; conflict→konflikt mit Vorrang; gelöster Konflikt zählt nicht; offen→outputEligible false). i18n DE/EN für ext.pipeline.*/queue.*/finding.*/validity.*/freshness.*/protection.*/outputEligible.*/recommendation.*.

### Abgrenzung gehalten / Restlücke
Keine neue Import-Engine, keine Migration, keine Fake-Bewertung, kein erfundenes Ablaufdatum, keine IP-Klassifizierung. Echte IP-Klassifizierung und persistente `validityUntil`/`generatedOutputs` bleiben separate Modell-/Governance-Tickets.

### Gates
apps/web-tsc EXIT=0 · Biome · depcruise · `npm run check` grün (**68 Dateien / 368 Tests**).

---

## After-Report — SCRUM-155 · Stabilize: Object-Store persistent machen — 2026-06-26

### Persistenzentscheidung: Postgres (kein Disk/S3/MinIO)
Befund (SCRUM-153/154): `buildPgServices` setzte `objects` fest auf `InMemoryObjectRepo` — es gab kein `PgObjectRepo` und keine Migration. Attachment-/Evidence-Originale (`/api/objects/:id/raw`) verschwanden bei Neustart; KO behielt nur ObjectRef + Thumbnail. Das berührte Knowledge-OS-Invariante #8 (Herkunft/Evidence langfristig nachvollziehbar). Entscheidung: Pg-Adapter analog zu `PgDraftRepo` — niedrigstes Risiko, gleiche Konvention, kein neuer Storage-Stack.

### Umsetzung
- **Neu** `services/object-store/src/repo-pg.ts`: `OBJECTSTORE_SCHEMA` (`objects(id text PK, ref jsonb, data text)` — Metadaten als JSONB, Base64-Original getrennt im `text`-Feld, NICHT im KO-JSON) + `PgObjectRepo` (`insert`/`findById`, erfüllt das bestehende `ObjectRepo`-Interface unverändert).
- `services/object-store/index.ts`: `PgObjectRepo` + `OBJECTSTORE_SCHEMA` exportiert.
- `services/app/src/db.ts`: `OBJECTSTORE_SCHEMA` in `migrate()` aufgenommen (additive Tabelle, keine Migration anderer Module betroffen).
- `services/app/src/build-app.ts`: `buildPgServices` nutzt jetzt `new PgObjectRepo(pool)`; `buildServices` (Dev/Test) bleibt `InMemoryObjectRepo`. `ObjectStore.put/read/metadata` und FE-API unverändert.

### Tests / Gates
- `services/object-store/src/service.test.ts` +2 Tests: Persistenz über frische Store-/Repo-Instanzen am selben (Fake-)Pool (`put → neue Instanz → read/metadata`), unbekannte ID → undefined. Bestehende ObjectStore-/decodeDataUrl-Tests unverändert grün.
- `npm run check` grün: **68 Dateien / 370 Tests**, tsc + Biome + depcruise sauber. FE nicht berührt (kein apps/web-tsc nötig).

### Restlücken
- Echte Postgres-Persistenz wird durch den Testcontainers-Integrationstest auf Mac/CI abgedeckt (Unit-Gate nutzt Fake-Pool, kein Docker im Sandbox). Empfehlung: `build-app.integration.test.ts` bei nächstem Mac-Lauf gegen die neue `objects`-Tabelle gegenprüfen.
- 5-MB-Pilotlimit unverändert. Import-Kandidaten-Persistenz bleibt eigenes Ticket (nicht Teil von SCRUM-155).

### Jira-Empfehlung
SCRUM-155 nach grünem Mac-Gate auf Done. Object-Store-Persistenzlücke aus SCRUM-153/154 ist damit geschlossen. Claude setzt Jira nicht selbst.

---

## After-Report — SCRUM-156 · Stabilize: Demo-Seed/Fixture-Datensatz — 2026-06-26

### Seed-Entscheidung: Service-getriebener Seed (kein Fixture-Insert, kein Fake)
`seedDemo(services)` schreibt AUSSCHLIESSLICH über die echten Module (auth/ko/validation/ask/
conflicts/lifecycle/object-store). Dadurch entstehen Status, Trust, Zuweisungen, Konflikte,
Revalidierungssignale und **Audit-Events** ausschließlich über reale Service-Aktionen — nichts
wird manuell gefälscht. Idempotent über `auth.needsSetup()` (nur leere Instanz wird geseedet;
zweiter Lauf → skipped, keine Duplikate). Manuell via `npm run seed:demo`, in Produktion gesperrt
(außer `SEED_ALLOW_PROD=1`).

### Sichtbar gemachte Flows
3 Nutzer (Admin/Controller/Experte) · 5 KOs (Kategorien Anlage 1–3, alle Wissensarten-Mix, Trust
30–80, Tags) · 1 validiertes KO (2 echte „up"-Bewertungen) · 1 offenes KO als zugewiesene
Validierungsaufgabe · 1 Wissenslücke mit Priorität „hoch" (bestandsfremde Frage → echte Lücke) ·
1 Wahrheitskonflikt (Vorwärmung nötig vs. nicht) · 1 Revalidierungssignal (Asset-Kopplung +
Asset-Änderung) · 1 kleiner Bild-Anhang (1×1 PNG) im jetzt persistenten Object-Store. Deckt
Start/Library/Ask/Validation/Risk/Lifecycle/Analytics/MyTasks/KnowledgeDetail ab.

### Geänderte Dateien
- **Neu** `services/app/src/seed.ts` (`seedDemo` + CLI-`runSeed`, Prod-Guard, Main-Guard).
- **Neu** `services/app/src/seed.test.ts` (Mindestsignale + Audit-Verify + Idempotenz).
- `package.json`: Script `seed:demo`.

### Ausführung / Befehl
`DATABASE_URL=… npm run seed:demo` (persistent). Ohne `DATABASE_URL` läuft es In-Memory mit
Warnhinweis (nur Smoke, nicht persistent).

### Tests / Gates
`npm run check` grün: **69 Dateien / 372 Tests**, tsc + Biome + depcruise sauber. FE nicht berührt.

### Restlücken
- Seed setzt voraus, dass die Instanz leer ist (keine Nutzer). Für „nachträglich in bestehende
  DB" wäre ein separater Merge-Seed nötig (nicht Teil von SCRUM-156).
- Import-Kandidaten/Stufe-2-Tiefe weiterhin außerhalb des Scopes.

### Jira-Empfehlung
SCRUM-156 nach grünem Mac-Gate auf Done. Claude setzt Jira nicht selbst.

---

## After-Report — SCRUM-157 · Stabilize: Import-Kandidaten persistent machen — 2026-06-26

### Persistenzentscheidung: Postgres-Repo (analog Object-Store/Capture)
Befund (SCRUM-153/154): Import-/Source-Review-Kandidaten lagen im `LibraryService` in einem
privaten `ImportCandidate[]` → Review-Queue ging bei Neustart verloren. Entscheidung: Queue hinter
ein `CandidateRepo`-Interface ziehen (InMemory für Dev/Test, Pg für Betrieb), kein Import-Flow-Umbau.

### Umsetzung
- **Neu** `services/library-analytics/src/repo.ts`: `CandidateRepo` (insert/findById/update/all) +
  `InMemoryCandidateRepo` (Map, bewahrt Einfügereihenfolge).
- **Neu** `services/library-analytics/src/repo-pg.ts`: `IMPORT_CANDIDATES_SCHEMA`
  (`import_candidates(id text PK, data jsonb)`) + `PgCandidateRepo` (Vollkandidat als JSONB).
- `services/library-analytics/src/service.ts`: privates Array → `CandidateRepo`-Dep (optional,
  Default InMemory → rückwärtskompatibel). `createImportCandidates` insert(), `listImportCandidates`
  all(), `reviewImportCandidate` findById()+update() — Status/koId/Note werden persistiert.
  Review-Prinzip unverändert (keine stille Bulk-Anlage; accept→echtes KO nur bei nicht-Dublette).
- `services/library-analytics/index.ts`: Repo-Exporte + Schema.
- `services/app/src/db.ts`: `IMPORT_CANDIDATES_SCHEMA` in `migrate()`.
- `services/app/src/build-app.ts`: `AppRepos.candidates`; `buildServices` → InMemory,
  `buildPgServices` → `PgCandidateRepo(pool)`; `LibraryService` bekommt `candidates`.
- API unverändert (`POST/GET/PUT /api/library/import/candidates*`), FE unberührt.

### Tests / Gates
- `services/library-analytics/src/service.test.ts` +3 Tests: Kandidaten überleben neue
  Service-Instanz am selben Repo; Review-Status accept/reject/info + Duplicate/Note/koId/createdAt
  bleiben erhalten; `PgCandidateRepo`-Round-Trip über denselben Fake-Pool. Bestehende
  Import-Review-Tests unverändert grün.
- `npm run check` grün: **69 Dateien / 375 Tests**, tsc + Biome + depcruise sauber. FE nicht berührt.
- Hinweis: Sandbox-Umgebung verlor zwischenzeitlich die plattform-nativen Optional-Binaries
  (rollup/biome, arm64); per gezieltem `npm install @rollup/rollup-linux-arm64-gnu
  @biomejs/cli-linux-arm64 --no-save` wiederhergestellt — kein Code-/Lock-Effekt.

### Restlücken
- Echte Pg-Persistenz über Testcontainers-Integrationstest auf Mac/CI (Unit-Gate nutzt Fake-Pool).
- Kein Feld-Merge/PDF-OCR-Reimport (außerhalb Scope).

### Jira-Empfehlung
SCRUM-157 nach grünem Mac-Gate auf Done. Schließt die Import-Kandidaten-Persistenzlücke aus
SCRUM-153/154. Claude setzt Jira nicht selbst.

---

## After-Report — SCRUM-158 · Stabilize: Bibliothek-Virtualisierung & Aufgaben-Filter — 2026-06-26

### UI-/Helfer-Entscheidung
Zwei additive DOM-freie Helfer statt schwerer Virtualisierungs-Lib oder Backend-/Such-Umbau:
- **`apps/web/src/lib/libraryDisplay.ts`** — `windowList(items, limit=200)` → `{ visible, total,
  shown, limited }`. Begrenzt die gerenderte Menge und meldet ehrlich „N von M".
- **`apps/web/src/lib/taskFilters.ts`** — Typ-Filter (`all/validation/returned/conflict/gap/
  revalidation`) rein aus den vorhandenen Task-`typeKey`s + ehrliche Zähler je Filter.

### Umsetzung
- **Library.tsx**: Ergebnisse via `windowList` gefenstert; Kopfzeile „Treffer: M" + bei
  Begrenzung „zeige erste N von M" (warn-Farbe). Filter/StatusPill/Typ/Trust/Autor/Links/Export
  unverändert. Keine API-Änderung.
- **MyTasks.tsx**: Filter-Chips über allen Gruppen mit ehrlichem Zähler je Typ; `filterTasks`
  reduziert je Gruppe; leere gefilterte Gruppe zeigt `task.noneFiltered` (kein stilles
  Verschwinden). Aufgaben weiter aus bestehenden Hooks abgeleitet; Links/Aktionen unverändert,
  keine Batch-Mutation.
- **i18n** DE/EN: `lib.resultCount`, `lib.showingFirst`, `task.filter.*`, `task.noneFiltered`.

### Tests / Gates
- `tests/library/library-display.test.ts`: unter/über/genau Limit, Default-Limit.
- `tests/foundation/task-filters.test.ts`: matches/filter/count, Summe Typ-Filter = Gesamt.
- apps/web-tsc EXIT=0 · `npm run check` grün (**71 Dateien / 382 Tests**) · Biome · depcruise sauber.

### Restlücken
- Keine echte Virtualisierung/Pagination (bewusst: nur Limit + ehrlicher Hinweis); echte
  Server-Pagination/Virtual-Scroll wäre ein größeres, separates Ticket.
- Keine semantische/Volltext-Engine (Nicht-Ziel).

### Jira-Empfehlung
SCRUM-158 nach grünem Mac-Gate auf Done. Damit ist der Stabilize-Block (SCRUM-153…158)
abgeschlossen. Claude setzt Jira nicht selbst.

---

## After-Report — SCRUM-159 · Foundation: Persistente KO-Version-Snapshots — 2026-06-26

### Technische Entscheidung
Knowledge-OS-Foundation: vollständige, **unveränderliche** KO-Snapshots je Version, additiv
neben dem bestehenden Modell. Aktuelles KO bleibt canonical current state; `history[]` und
KO-JSON-Schema unverändert. Snapshot hinter `KoVersionRepo` (InMemory + Pg), DB-seitige
Immutabilität über `PRIMARY KEY (ko_id, version)` + `ON CONFLICT DO NOTHING`. Snapshot wird per
JSON-Deep-Copy abgelegt → spätere KO-Änderungen berühren frühere Versionen nie.

### Umsetzung
- `services/knowledge-object/src/types.ts`: neuer Typ `KoVersionSnapshot` (Voll-KO + Metadaten).
- `services/knowledge-object/src/repo.ts`: `KoVersionRepo` (append/listByKo) + `InMemoryKoVersionRepo`
  (überschreibt vorhandene Version nicht).
- `services/knowledge-object/src/repo-pg.ts`: `KO_VERSIONS_SCHEMA` (`ko_versions`, PK (ko_id,version))
  + `PgKoVersionRepo` (append-only, ON CONFLICT DO NOTHING).
- `services/knowledge-object/src/service.ts`: optionale `versions`-Dep; private `snapshot()`
  (JSON-Deep-Copy, No-op ohne Repo); `create` legt Version-1-Snapshot an, `revise` Version-N.
- `services/knowledge-object/index.ts`: Exporte (Typ/Repos/Schema).
- `services/app/src/db.ts`: `KO_VERSIONS_SCHEMA` in `migrate()`.
- `services/app/src/build-app.ts`: `AppRepos.koVersions`; `KoService` bekommt `versions`;
  `buildServices` → InMemory, `buildPgServices` → `PgKoVersionRepo`.
- Keine Änderung an API/Routes/UI/Ask/Output/Audit-Hash-Kette/Reasoner/RBAC.

### Tests / Gates
- `service.test.ts` +5 Tests: create→V1; revise→V2 + V1 unverändert; Snapshot ist echte Kopie
  (spätere Revision berührt V1 nicht); No-op ohne Versions-Repo; `PgKoVersionRepo`-Round-Trip +
  Immutabilität über Fake-Pool. Bestehende KO-/Library-/Output-Tests unverändert grün.
- `npm run check` grün: **71 Dateien / 387 Tests**, tsc + Biome + depcruise sauber. FE nicht berührt.

### Restlücken
- Kein UI-Version-Browser/Diff (bewusst, Nicht-Ziel; Foundation-Infrastruktur).
- Snapshots erfassen den Stand bei Versions-Erstellung (create/revise); reine Status-/Trust-
  Änderungen ohne Versions-Bump erzeugen bewusst keinen neuen Snapshot.
- Kein Backfill für Alt-KOs (Read-Fallback bleibt: aktuelles KO unverändert nutzbar).
- Echte Pg-Persistenz über Testcontainers auf Mac/CI (Unit-Gate nutzt Fake-Pool).

### Jira-Empfehlung
SCRUM-159 nach grünem Mac-Gate auf Done. Erstes Foundation-Work-Item; schließt das
Versions-Immutabilitäts-Risiko aus SCRUM-153. Claude setzt Jira nicht selbst.


## SCRUM-161 — KO-Version-Snapshots sichtbar machen

**1. Vorab-Befund:** SCRUM-159 persistiert unveränderliche Voll-Snapshots über `KoVersionRepo`, aber `KoService`/API/FE legten sie nicht lesbar frei. `KnowledgeDetail` zeigte nur `history[]`-Metadaten, nicht die echten Snapshot-Stände. Kein Backend-Modellumbau nötig.

**2. Umsetzung:** Read-only Service-Methode `versionsOf(id)` ergänzt (prüft KO-Existenz, liefert ohne Versions-Repo einen ehrlichen Leerzustand), Route `GET /api/kos/:id/versions`, FE-Endpunkt/Hook `useKoVersions`, DOM-freier Helper `koVersionRows`, Snapshot-Card im KO-Detail mit Version, Zeitpunkt, Autor, Titel, Status, Kurzinhalt und Notiz.

**3. Geänderte Dateien:** `services/knowledge-object/src/service.ts`, `services/knowledge-object/src/service.test.ts`, `services/app/src/routes/ko-routes.ts`, `apps/web/src/api/types.ts`, `apps/web/src/api/endpoints.ts`, `apps/web/src/api/hooks.ts`, `apps/web/src/lib/koVersionSnapshots.ts`, `apps/web/src/pages/KnowledgeDetail.tsx`, `apps/web/src/i18n.ts`, `tests/ko/ko-version-snapshots.test.ts`, `docs/qm/claude-after-report.md`.

**4. Technische Entscheidung:** Nur read-only Sichtbarkeit der bestehenden Snapshots; kein Diff, kein Restore, kein Backfill, keine Änderung an create/revise oder Versions-Persistenz. Anzeige sortiert neueste Version zuerst und bleibt bei fehlenden Snapshots ehrlich leer.

**5. Tests/Gates:** Gezielter Check grün: `services/knowledge-object/src/service.test.ts` + `tests/ko/ko-version-snapshots.test.ts` = 25 Tests. Root-`tsc --noEmit` grün. Voller Gate folgt im Codex-Lauf.

**6. Restlücken:** Kein Versionsdiff/Restore und keine Nachbefüllung historischer KOs ohne Snapshot — bewusst außerhalb Scope.


## SCRUM-162 — KO-Version-Snapshot-Diff read-only anzeigen

**1. Vorab-Befund:** Nach SCRUM-161 sind KO-Version-Snapshots per API/FE lesbar. Ein Feldvergleich zwischen direkt aufeinanderfolgenden Snapshots existierte noch nicht; Backend-Modell und API reichen dafür vollständig aus. Kein Backend-Umbau nötig.

**2. Umsetzung:** DOM-freier Helper `koVersionDiff.ts` ergänzt (`versionDiffs`, `diffForVersion`) für deterministischen Vergleich von Titel, Aussage, Bedingungen, Maßnahmen, Typ und Status. KnowledgeDetail Snapshot-Card zeigt pro Version ehrliche Änderungsmarker gegen die direkte Vorgängerversion; erste Version zeigt "kein Vorgänger-Diff", unveränderte Hauptfelder zeigen "keine Änderung".

**3. Geänderte Dateien:** `apps/web/src/lib/koVersionDiff.ts`, `tests/ko/ko-version-diff.test.ts`, `apps/web/src/pages/KnowledgeDetail.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**4. Technische Entscheidung:** Read-only Feld-Diff statt Wort-/Textdiff oder Restore. Keine Backend-/API-Änderung, kein neues Versionsmodell, kein Backfill.

**5. Tests/Gates:** `npm run check` grün — 73 Dateien / 395 Tests, root-tsc 0, Biome grün, depcruise sauber (148 Module / 451 Dependencies).

**6. Restlücken:** Kein Restore/Rollback, kein Side-by-Side-Diff und kein Wortdiff — bewusst separate, größere UI-/Governance-Themen.


## SCRUM-160 — Evidence-Records v1 für KO-Quellen und Anhänge

**1. Vorab-Befund:** KOs hatten `sources[]` und `attachments[]`; Audit protokolliert Aktionen, ist aber kein fachliches Evidence-Modell. Nach SCRUM-159 existiert persistente Versionierung, aber Quellen/Anhänge hatten keine separate, stabile Evidence-Schicht. Kein UI-/API-Bruch nötig.

**2. Umsetzung:** Additiver `EvidenceRecord` mit `kind: source|attachment`, KO-ID, KO-Version, Source-/Attachment-/ObjectRef, Label, Mime/URL/Provider, Ersteller und Zeitpunkt. Neues `EvidenceRepo` mit InMemory/Pg-Adapter, Tabelle `ko_evidence`. `KoService.addSource` erzeugt immer Evidence; `addAttachment` erzeugt Evidence für Object-Store-Anhänge mit `objectId`. `evidenceOf(id)` als minimaler read-only Service-Vertrag für Tests.

**3. Geänderte Dateien:** `services/knowledge-object/src/types.ts`, `repo.ts`, `repo-pg.ts`, `service.ts`, `service.test.ts`, `index.ts`, `services/app/src/db.ts`, `services/app/src/build-app.ts`, `docs/qm/claude-after-report.md`.

**4. Technische Entscheidung:** Evidence bleibt separat vom KO-JSON und append-only; bestehende Quellen/Anhänge bleiben canonical UI/API. Pg-Tabelle `ko_evidence(id, ko_id, ko_version, kind, data, created_at)` mit `ON CONFLICT DO NOTHING`. Inline-Altanhänge ohne `objectId` erzeugen bewusst keine Object-Evidence.

**5. Tests/Gates:** +4 Evidence-Tests (Source-Evidence, ObjectAttachment-Evidence, Leerzustand ohne Repo, Pg-Fake-Pool Round-Trip + Immutabilität). `npm run check` grün — 73 Dateien / 399 Tests, root-tsc 0, Biome grün, depcruise sauber (148 Module / 451 Dependencies).

**6. Restlücken:** Kein UI Evidence-Browser, kein Peer-Validation-Verfahren, kein vollständiges Source/Evidence/Version-Großmodell, kein Retrieval/ModelAdapter/ModelRun.


## SCRUM-163 — Evidence-Records read-only im KO-Detail anzeigen

**1. Vorab-Befund:** SCRUM-160 erzeugt EvidenceRecords und `KoService.evidenceOf(id)` liefert sie read-only. Es fehlten Route, FE-Typen/Hook und eine sichtbare KO-Detail-Darstellung. Kein neues Modell und keine Mutation nötig.

**2. Umsetzung:** Route `GET /api/kos/:id/evidence` mit `ko.read`-Guard, FE-Typ `EvidenceRecord`, Endpoint/Hook `useKoEvidence`, DOM-freier Helper `koEvidence.ts`, KnowledgeDetail-Card mit Quelle/Anhang-Badge, Ersteller/Zeitpunkt und Metadaten (Version, Provider, Mime, ObjectRef, URL).

**3. Geänderte Dateien:** `services/app/src/routes/ko-routes.ts`, `apps/web/src/api/types.ts`, `apps/web/src/api/endpoints.ts`, `apps/web/src/api/hooks.ts`, `apps/web/src/lib/koEvidence.ts`, `tests/ko/ko-evidence.test.ts`, `apps/web/src/pages/KnowledgeDetail.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**4. Technische Entscheidung:** Read-only KO-lokale Evidence-Card statt globalem Evidence-Browser. Bestehende Source-/Attachment-UI bleibt unverändert. Keine Mutation, kein Peer-Validation-Verfahren, kein Audit-Umbau.

**5. Tests/Gates:** `npm run check` grün — 74 Dateien / 401 Tests, root-tsc 0, Biome grün, depcruise sauber (148 Module / 451 Dependencies).

**6. Restlücken:** Kein globaler Evidence-Browser, kein Editieren/Löschen von Evidence, kein Retrieval/ModelAdapter/ModelRun.

---

## After-Report — SCRUM-164 · Foundation: ModelRun-Protokoll v1 für Reasoner-Aufrufe — 2026-06-26

### Vorab-Befund
Der Reasoner steuert primary/fallback intern in `structure/assistText/interview` (try primary →
catch → deterministischer Fallback). Bisher kein Trace der KI-Läufe. `answer`/Ask sind nicht im
Scope (eigener `ask.query`-Audit). Reasoner-Konstruktor positional `(primary?, fallback?)` → für
Rückwärtskompatibilität additiv erweitern.

### Umsetzung
- **Neues Modul `services/model-runs`**: `ModelRunRecord`/`ModelRunTask`/`ModelRunStatus` (Typen,
  nur Metadaten — **keine** Prompt-/Antworttexte), `ModelRunRepo` + `InMemoryModelRunRepo` +
  `PgModelRunRepo` + `MODEL_RUNS_SCHEMA` (`model_runs(id text PK, data jsonb)`), `index.ts`.
- **Reasoner**: optionaler 3. Ctor-Param `modelRuns?: ModelRunRepo` (No-op ohne Repo). Neue private
  `runTask(...)` kapselt die unveränderte primary→fallback-Logik und schreibt je Lauf einen Record:
  `success` (normal), `fallback:true`/`demo:true` (primary verfügbar, scheiterte → deterministisch),
  `status:"error"` (auch Fallback scheitert; generische `error`-Message, nie Prompttext). `provider`/
  `model` aus dem genutzten Provider; `locale` mitgeschrieben. `structure/assistText/interview` laufen
  jetzt über `runTask`. API-Shape der Reasoner-Endpunkte unverändert; `answer`/`select` unangetastet.
- **Migration** `MODEL_RUNS_SCHEMA` in `services/app/src/db.ts#migrate`.
- **Composition Root** `services/app/src/build-app.ts`: `AppRepos.modelRuns`; `buildServices` →
  InMemory, `buildPgServices` → `PgModelRunRepo`; Reasoner erhält das Repo.

### Geänderte/neue Dateien
neu: `services/model-runs/src/{types,repo,repo-pg,repo.test}.ts`, `services/model-runs/index.ts`;
geändert: `services/reasoner/src/service.ts`, `services/reasoner/src/service.test.ts`,
`services/app/src/db.ts`, `services/app/src/build-app.ts`, `docs/qm/claude-after-report.md`.

### Tests / Gates
- reasoner/service.test.ts +5: erfolgreicher structure-Run (success/kein Fallback/kein Demo,
  provider+model+locale); Fallback-Pfad (fallback:true, demo:true, provider deterministic);
  interview-Locale; Fehlerpfad (status error, kein Prompttext im Record); No-op ohne Repo.
- model-runs/repo.test.ts +2: InMemory append/recent (jüngste zuerst), Pg-Fake-Pool-Round-Trip.
- `npm run check` grün: **75 Dateien / 408 Tests**, tsc + Biome + depcruise sauber. Bestehende
  Reasoner-/Ask-/Capture-Tests unverändert grün. Keine Audit-Hash-/KO-/Evidence-Änderung.

### Restlücken
- Kein UI-Dashboard, kein Token-/Kosten-Accounting, kein Read-Endpoint/HTTP-Route (nur Service-/
  Repo-`recent()`-Vertrag) — bewusst Nicht-Ziele.
- `answer`/Ask wird (scope-konform) nicht protokolliert.
- Echte Pg-Persistenz über Testcontainers auf Mac/CI (Unit-Gate nutzt Fake-Pool).

### Commit-/Push-Hinweis für Pedi/Codex
cd /Users/peterkohnert/Documents/dev_Klarwerk && npm run check
git add services/model-runs services/reasoner/src/service.ts services/reasoner/src/service.test.ts \
  services/app/src/db.ts services/app/src/build-app.ts docs/qm/claude-after-report.md
git commit -m "feat(model-runs): add ModelRun protocol v1 for reasoner calls (SCRUM-164)" && git push

No Jira changes by Claude. No tickets closed. No new tickets.

---

## After-Report — SCRUM-165 · ModelRun read-only Endpoint & Stufe-2-Übersicht — 2026-06-26

### Vorab-Befund
SCRUM-164 persistiert ModelRun-Metadaten; bisher kein Lesezugriff. Read-only-Routen-Muster
vorhanden (management/output). `model-runs`-Modul hatte nur Repo, keinen Service. **Nebenbefund:**
`KnowledgeDetail.tsx` nutzte `diffForVersion` (SCRUM-162) ohne Import — vom Root-Gate (`tsc` ohne
DOM-Pages) nicht erfasst, erst durch apps/web-tsc sichtbar.

### Umsetzung
- **Backend** `services/model-runs`: `ModelRunService.recent(limit?)` + `normalizeModelRunLimit`
  (Default 50, Max 200, ungültig/negativ → Default); nur Lesen (kein Write/Delete/Replay).
  Route `GET /api/model-runs?limit=` mit `ko.read` (`routes/model-runs-routes.ts`), in build-app
  registriert; `AppServices.modelRuns` über dasselbe Protokoll-Repo wie der Reasoner. API liefert
  ausschließlich `ModelRunRecord`-Metadaten.
- **Frontend**: `ModelRunRecord`-Typen, `endpoints.modelRuns.recent`, `useModelRuns(limit?)`,
  DOM-freier Helper `lib/modelRuns.ts` (`summarizeModelRuns`, `modelRunStatusTone`,
  `limitModelRuns`). Kompakte read-only Card `ReasonerRunsCard` in der Stufe-2-`Capital`-Seite:
  Summary (total/errors/fallbacks/demo) + letzte Läufe (Task, Status, Provider, Locale,
  Fallback/Demo-Marker, Zeit), ehrlicher Leer-/Lade-/Fehlerzustand, **keine** Prompt-/Antworttexte.
- **i18n** DE/EN `mrun.*`.
- **Minimalkorrektur**: fehlender Import `diffForVersion` in `KnowledgeDetail.tsx` ergänzt
  (latenter SCRUM-162-apps/web-tsc-Fehler; nötig für „apps/web-tsc grün").

### Geänderte/neue Dateien
neu: `services/model-runs/src/{service,service.test}.ts`, `services/app/src/routes/model-runs-routes.ts`,
`apps/web/src/lib/modelRuns.ts`, `tests/reasoner/model-runs-view.test.ts`;
geändert: `services/model-runs/index.ts`, `services/app/src/build-app.ts`,
`apps/web/src/api/{types,endpoints,hooks}.ts`, `apps/web/src/pages/Stufe2.tsx`,
`apps/web/src/pages/KnowledgeDetail.tsx` (Import-Fix), `apps/web/src/i18n.ts`,
`docs/qm/claude-after-report.md`.

### Tests / Gates
- model-runs/service.test.ts: Limit default/max/negativ/NaN, recent read-only, **nur Metadaten
  (kein prompt/answer/text/input-Feld)**. tests/reasoner/model-runs-view.test.ts: summary/counts,
  tone, limit. 
- apps/web-tsc EXIT=0 · `npm run check` grün: **77 Dateien / 418 Tests**, Biome + depcruise sauber.
  Reasoner-Ausführung unverändert; keine KO-/Audit-/Evidence-Änderung.

### Restlücken
- Kein großes Dashboard, kein Token-/Kosten-Accounting, kein Delete/Edit/Replay (Nicht-Ziele).
- Echte Pg-Persistenz über Testcontainers auf Mac/CI (Unit-Gate nutzt In-Memory/Fake-Pool).

### Commit-/Push-Hinweis für Pedi/Codex
cd /Users/peterkohnert/Documents/dev_Klarwerk && npm run check
git add services/model-runs services/app/src/routes/model-runs-routes.ts services/app/src/build-app.ts \
  apps/web/src/api/types.ts apps/web/src/api/endpoints.ts apps/web/src/api/hooks.ts \
  apps/web/src/lib/modelRuns.ts apps/web/src/pages/Stufe2.tsx apps/web/src/pages/KnowledgeDetail.tsx \
  apps/web/src/i18n.ts tests/reasoner/model-runs-view.test.ts docs/qm/claude-after-report.md
git commit -m "feat(model-runs): read-only endpoint + stage-2 overview (SCRUM-165)" && git push

No Jira changes by Claude. No tickets closed. No new tickets.

---

## After-Report — SCRUM-166 · Reasoner Provider-/Model-Konfiguration sichtbar machen — 2026-06-26

### Vorab-Befund
`Reasoner.status()` (FR-RSN-05, active/provider/mode) existiert und wird von der Topbar genutzt —
unangetastet gelassen. Eine reichere Konfigurationssicht (model?, configured, supportsLocales,
tasks) fehlte. `provider.name` des Anthropic-Clients enthält das Modell-Label, NICHT den Schlüssel.

### Umsetzung (additiv, keine Reasoner-Execution-Änderung)
- **Backend** `services/reasoner`: neuer Typ `ReasonerConfigStatus` (provider, model?, configured,
  mode "model|fallback|demo", fallbackAvailable, supportsLocales, tasks) + `Reasoner.configStatus()`
  — ohne Modell ehrlich `configured:false`/`mode:"demo"`, mit Modell `configured:true`/`mode:"model"`.
  Nur Metadaten, keine Secrets/Prompttexte. Export via `reasoner/index.ts`.
- **Route** `GET /api/reasoner/config` (in `reasoner-routes.ts`, Guard `ko.read`). Bestehende
  `/api/reasoner` und `/api/reasoner/status` unverändert.
- **Frontend**: `ReasonerConfigStatus`-Typ, `endpoints.reasoner.config()`, `useReasonerConfig()`,
  DOM-freier Helper `lib/reasonerStatus.ts` (`reasonerModeTone`, `reasonerStatusSummary`,
  `isModelConfigured`). Kompakte `ReasonerConfigCard` in der Stufe-2-`Capital`-Seite (neben der
  ModelRun-Card): Modus-Badge, Provider, Modell oder „nicht konfiguriert", Sprachen, Tasks,
  ehrlicher Fallback/Demo-Hinweis. Keine Secrets/Prompttexte.
- **i18n** DE/EN `rcfg.*`.

### Geänderte/neue Dateien
neu: `apps/web/src/lib/reasonerStatus.ts`, `tests/reasoner/reasoner-status.test.ts`;
geändert: `services/reasoner/src/{types,service,service.test}.ts`, `services/reasoner/index.ts`,
`services/app/src/routes/reasoner-routes.ts`, `apps/web/src/api/{types,endpoints,hooks}.ts`,
`apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

### Tests / Gates
- reasoner/service.test.ts +3: ohne Modell (configured false/mode demo/Fallback), mit Modell
  (configured true/mode model/provider+model), **keine key/secret/token/prompt-Felder**.
- tests/reasoner/reasoner-status.test.ts: isModelConfigured, Mode-Tone (model→pos, demo/fallback→warn),
  Summary (model null bei Demo).
- apps/web-tsc EXIT=0 · `npm run check` grün: **78 Dateien / 424 Tests**, Biome + depcruise sauber.
  Reasoner-Execution & ModelRun-Protokoll unverändert; bestehende `status()`/Topbar intakt.

### Restlücken
- Kein neuer Modellanbieter, keine Provider-Auswahl im UI, kein Token-/Kosten-Accounting
  (Nicht-Ziele). `mode:"fallback"` ist im Typ vorgesehen, wird aber als statischer Config-Snapshot
  nicht emittiert (Fallback ist ein Laufzeit-Ereignis, im ModelRun-Protokoll erfasst).

### Commit-/Push-Hinweis für Pedi/Codex
cd /Users/peterkohnert/Documents/dev_Klarwerk && npm run check
cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit && cd ../..
git add services/reasoner/src/types.ts services/reasoner/src/service.ts services/reasoner/src/service.test.ts \
  services/reasoner/index.ts services/app/src/routes/reasoner-routes.ts \
  apps/web/src/api/types.ts apps/web/src/api/endpoints.ts apps/web/src/api/hooks.ts \
  apps/web/src/lib/reasonerStatus.ts apps/web/src/pages/Stufe2.tsx apps/web/src/i18n.ts \
  tests/reasoner/reasoner-status.test.ts docs/qm/claude-after-report.md
git commit -m "feat(reasoner): expose read-only provider/model config (SCRUM-166)" && git push

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-167 — ModelRun-Protokoll für Ask/answer/select vervollständigen

**Vorab-Befund (read-only):** `structure`/`assist`/`interview` liefen bereits über `runTask` (SCRUM-164) und erzeugten ModelRunRecords. `answer` nutzte noch das alte inline primary→fallback-Muster ohne Protokoll; `select` war synchron (reines Keyword-Ranking, kein Modell-/Netzaufruf) und schrieb keinen Record. `ModelRunTask` kannte nur `structure|assist|interview`.

**Umsetzung:**
- `ModelRunTask` (Backend + FE-Types) um `answer` und `select` erweitert.
- `Reasoner.answer` auf `runTask("answer", …)` umgestellt — gleiches Verhalten, jetzt protokolliert (success/fallback/demo/error ehrlich aus der bestehenden Provider-Logik). `recordRun` nimmt `locale?` optional an (für sprach-agnostisches select via Conditional-Spread).
- `Reasoner.select` bleibt **synchron** (keine API-Änderung); ModelRun wird fire-and-forget protokolliert (`logSelect`): `demo:true` (deterministisches Keyword-Ranking), `fallback:false`, kein `locale`, `status:"error"` bei echtem Fehler.
- Records enthalten weiterhin nur Metadaten — keine Frage-/Antwort-/Kandidaten-/Inhaltstexte.
- FE: `summarizeModelRuns.byTask` um `answer`/`select` ergänzt; i18n `mrun.task.answer`/`mrun.task.select` DE/EN. Stufe-2-Card unverändert, zeigt Labels statt Roh-Keys.

**Geänderte/neue Dateien:** `services/model-runs/src/types.ts`, `services/reasoner/src/service.ts`, `services/reasoner/src/service.test.ts`, `apps/web/src/api/types.ts`, `apps/web/src/lib/modelRuns.ts`, `apps/web/src/i18n.ts`, `tests/reasoner/model-runs-view.test.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **78 Dateien / 428 Tests** (+4: answer-Record, answer-Fallback, select-Record ohne Inhaltstext, select-No-op ohne Repo; +2 byTask-Erwartungen angepasst). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber.

**Restlücken (bewusst):** Kein Token-/Kosten-Accounting, kein Prompt-/Antwort-Volltext, kein UI-Dashboard-Ausbau, keine Änderung an Ask-Antwortlogik/Wissenssuche/KO-Modellen, kein Provider-Umbau. `select` läuft nie über ein echtes Modell → immer `demo:true` (ehrlich, keine künstliche Fallback-Simulation).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add services/model-runs/src/types.ts services/reasoner/src/service.ts services/reasoner/src/service.test.ts \
  apps/web/src/api/types.ts apps/web/src/lib/modelRuns.ts apps/web/src/i18n.ts \
  tests/reasoner/model-runs-view.test.ts docs/qm/claude-after-report.md
git commit -m "feat(reasoner): log answer/select in ModelRun protocol (SCRUM-167)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-168 — Evidence-/Source-Konsistenz read-only prüfen

**Vorab-Befund (read-only):** EvidenceRecords entstehen im Backend deterministisch: `addSource` → `kind:"source"` mit `sourceId` (+ url/provider); `addAttachment` → `kind:"attachment"` mit `attachmentId`+`objectId`, **nur wenn `objectId` gesetzt ist**. Legacy-Inline-Anhänge (`dataUrl` ohne `objectId`) erzeugen bewusst keine Evidence. `koEvidence.ts`/KO-Detail zeigten Evidence bereits, aber ohne Konsistenzabgleich gegen Quellen/Anhänge.

**Umsetzung (rein read-only, keine Datenänderung):**
- Neuer DOM-freier Helper `apps/web/src/lib/evidenceConsistency.ts` mit `analyzeEvidenceConsistency(ko, evidence)`. Match-Regeln spiegeln die Backend-Logik: Source ↔ `sourceId` (Fallback url/label), Attachment ↔ `attachmentId`/`objectId`.
- `EvidenceConsistencyResult`: `status "ok"|"warning"`, `sourceCount`, `attachmentCount`, `evidenceCount`, `findings[]`. Finding-Arten: `source-without-evidence`, `attachment-without-evidence`, `evidence-without-source`, `evidence-without-attachment` (alle `warning`) und `legacy-inline-attachment` (`info`, **kein** Fehler → status bleibt ok).
- KO-Detail: kompakter read-only Konsistenzblock in der bestehenden Evidence-Card — Status-Badge (trust-Tokens), Counts, Findings-Liste mit erklärenden Labels. Keine klickbaren Links, kein HTML-Rendering.
- i18n DE/EN `ko.evCons.*` (Titel, Status ok/warning, Counts mit `{{…}}`-Interpolation, allOk, 5 Finding-Labels).

**Geänderte/neue Dateien:** neu `apps/web/src/lib/evidenceConsistency.ts`, `tests/ko/evidence-consistency.test.ts`; geändert `apps/web/src/pages/KnowledgeDetail.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **79 Dateien / 434 Tests** (+6: vollständige Konsistenz, Source ohne Evidence, Object-Attachment ohne Evidence, Evidence ohne Gegenstück [source+attachment], Legacy-DataUrl-Ausnahme, url-Fallback-Match). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende `ko-evidence`-Tests unverändert grün.

**Restlücken (bewusst, Nicht-Ziele):** kein Auto-Backfill, kein Delete/Edit von Evidence, kein neues Evidence-Modell, keine Migration, keine Audit-Hash-Änderung, kein KO-übergreifender Browser. Analyse ist reine Lesesicht pro KO.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/evidenceConsistency.ts apps/web/src/pages/KnowledgeDetail.tsx \
  apps/web/src/i18n.ts tests/ko/evidence-consistency.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko): read-only evidence/source consistency check (SCRUM-168)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-169 — Evidence-Index read-only für QM/Stufe 2

**Vorab-Befund (read-only):** `EvidenceRepo` hatte nur `append`/`listByKo`; kein KO-übergreifender Zugriff. Evidence wird bereits append-only persistiert (InMemory + Pg, `ko_evidence`) — keine Migration nötig. ModelRuns liefern bereits ein bewährtes `recent(limit)`-Muster (Route + `normalize*Limit` + Stufe-2-Card), das ich gespiegelt habe.

**Umsetzung (read-only, additiv):**
- `EvidenceRepo.recent(limit)` ergänzt: InMemory (jüngste zuerst, `slice`) und Pg (`ORDER BY created_at DESC,id DESC LIMIT $1`). Bestehende KO-spezifische Evidence-Routen/Methoden unverändert.
- `KoService.recentEvidence(limit?)` + `normalizeEvidenceLimit` (Default 100, Max 500) — exportiert aus dem Modul-Index. No-op-Leerzustand ohne Evidence-Repo.
- Route `GET /api/evidence?limit=` in `ko-routes.ts` mit `ko.read`-Guard; liefert nur `EvidenceRecord`-Metadaten (keine Object-Rohdaten, kein dataUrl, kein Laden externer Inhalte).
- FE: `endpoints.evidence.recent`, `useEvidenceIndex`, DOM-freier Helper `lib/evidenceIndex.ts` (`summarizeEvidence`/`evidenceKindTone`/`limitEvidence`).
- Stufe 2 (`Capital`): neue read-only `EvidenceIndexCard` — Counts (Total/Quellen/Anhänge/distinkte KOs), jüngste Records mit Kind-Badge, KO-Ref, Provider/MIME/ObjectId/URL als Text-Pills. **URL nur als Text, nicht klickbar.** Kein Edit/Delete/Backfill. Ehrliche Loading/Error/Empty-States.
- i18n DE/EN `evx.*` vollständig.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/evidenceIndex.ts`, `tests/ko/evidence-index.test.ts`; geändert `services/knowledge-object/src/{repo,repo-pg,service,service.test}.ts`, `services/knowledge-object/index.ts`, `services/app/src/routes/ko-routes.ts`, `apps/web/src/api/{endpoints,hooks}.ts`, `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **80 Dateien / 442 Tests** (+8: Backend normalizeEvidenceLimit default/max/invalid, recentEvidence KO-übergreifend+limitiert, „nur Metadaten/kein dataUrl/THUMB", No-op ohne Repo; FE-Helper Summary/leer/Tone/limit). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende KO-/Evidence-/Konsistenztests unverändert grün.

**Restlücken (bewusst, Nicht-Ziele):** kein Edit/Delete/Backfill, kein Evidence-Browser mit Suche/Pagination, keine Migration, keine Änderung am Evidence-Modell, keine klickbaren Fremd-URLs, keine Object-Store-Rohdaten.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add services/knowledge-object/src/repo.ts services/knowledge-object/src/repo-pg.ts \
  services/knowledge-object/src/service.ts services/knowledge-object/src/service.test.ts \
  services/knowledge-object/index.ts services/app/src/routes/ko-routes.ts \
  apps/web/src/api/endpoints.ts apps/web/src/api/hooks.ts apps/web/src/lib/evidenceIndex.ts \
  apps/web/src/pages/Stufe2.tsx apps/web/src/i18n.ts tests/ko/evidence-index.test.ts \
  docs/qm/claude-after-report.md
git commit -m "feat(ko): read-only evidence index for QA/Stufe 2 (SCRUM-169)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-170 — Evidence nach KO-Version read-only gruppieren

**Vorab-Befund (read-only):** `EvidenceRecord` trägt bereits `koVersion`; KO-Versions-Snapshots (SCRUM-159) liefern die bekannten Versionen über `useKoVersions`. Bestehende Helper (`koEvidence`, `evidenceConsistency`, `evidenceIndex`) decken Sortierung/Counts ab, aber keine Version-Gruppierung. Versions-/Snapshot-Card sortiert Versionen absteigend (`b.version - a.version`) — diese Konvention wurde gespiegelt.

**Umsetzung (rein read-only, keine Datenänderung):**
- Neuer DOM-freier Helper `apps/web/src/lib/evidenceByVersion.ts` mit `groupEvidenceByVersion(evidence, versions?)`. Gruppierung **ausschließlich** über `EvidenceRecord.koVersion` (keine Zeitfenster-Heuristik).
- `EvidenceVersionGroup`: `version`, `total`, `sourceCount`, `attachmentCount`, `latestAt?`, `items`. Versionen absteigend; Items je Gruppe jüngste zuerst (id als Tiebreak). Optionales `versionsWithoutEvidence` (absteigend), wenn die bekannten Versionen übergeben werden.
- KO-Detail: read-only Subsektion „Evidence nach Version" in der Evidence-Card — Version-Badge, Counts (Quellen/Anhänge), letzte Evidence, ehrlicher Hinweis auf Versionen ohne Evidence. Keine klickbaren Fremd-URLs, keine Restore/Edit/Delete/Backfill-Buttons.
- i18n DE/EN `ko.evVer.*` (Titel, Version, Counts, Latest, Without).

**Geänderte/neue Dateien:** neu `apps/web/src/lib/evidenceByVersion.ts`, `tests/ko/evidence-by-version.test.ts`; geändert `apps/web/src/pages/KnowledgeDetail.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **81 Dateien / 447 Tests** (+5: Gruppierung+Kind-Counts, deterministische Item-Sortierung+latestAt, leere Evidence, Versionen-ohne-Evidence-Markierung, ohne versions-Argument leer). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende KO-Version-/Evidence-Tests unverändert grün.

**Restlücken (bewusst, Nicht-Ziele):** kein Diff von Evidence-Inhalten, kein Restore/Edit/Delete, kein neues Evidence-/Version-Modell, kein globaler Browser, keine klickbaren Fremd-URLs.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/evidenceByVersion.ts apps/web/src/pages/KnowledgeDetail.tsx \
  apps/web/src/i18n.ts tests/ko/evidence-by-version.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko): read-only evidence grouping by KO version (SCRUM-170)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-171 — KO-Provenance-/Lineage-Index read-only für Stufe 2

**Vorab-Befund (read-only):** Per-KO-Herkunft existiert bereits (`koLineage.lineageSummary`: author/originalAuthor/Transfer, Version/History, Quellen, verwandte KOs). Es fehlte nur die KO-übergreifende Aggregation. Stufe 2 hat bereits `useKos()` und `useEvidenceIndex()` — keine neuen Backend-Endpoints/Modelle nötig.

**Umsetzung (rein read-only, additiv):**
- Neuer DOM-freier Helper `apps/web/src/lib/provenanceIndex.ts` mit `buildProvenanceIndex({ kos, evidence? })`. Aggregiert **nur vorhandene Signale**: Transfer (`author !== originalAuthor`), `version`/`history`, `sources`/`attachments`, Evidence-Counts je `koId`.
- `ProvenanceIndexSummary` (totalKOs, withTransfer, withSources, withAttachments, withEvidence, withoutEvidence, multiVersion, warningCount) + `ProvenanceIndexRow` (Counts + `warningKinds[]`). Warnungen: `transferred-author`, `multi-version`, `no-evidence`.
- **Ehrlichkeit:** `no-evidence` wird NUR behauptet, wenn der Evidence-Stand bekannt ist (evidence-Argument übergeben) UND das KO Quellen/Anhänge ohne Evidence trägt. Ohne evidence-Argument bleibt der Stand „unbekannt" — keine Falschmeldung. Deterministische Sortierung (meiste Warnungen → höchste Version → Titel → koId).
- Stufe 2 (`Capital`): read-only `ProvenanceIndexCard` — Summary-Counts und auffälligste KOs zuerst, Version/Counts/Badges, KO-interner Link zu `/wissen/:id`. Keine Fremd-URLs, kein Edit/Restore/Backfill. Evidence-Stand wird nur als „bekannt" gewertet, wenn der Evidence-Index erfolgreich geladen ist (`isSuccess`).
- i18n DE/EN `prov.*` vollständig.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/provenanceIndex.ts`, `tests/ko/provenance-index.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **82 Dateien / 454 Tests** (+7: Leerzustand, Transfer-Erkennung, Multi-Version, EvidenceCount je koId, no-evidence nur bei bekanntem Stand+Signalen, sauberes KO ohne Warnung, deterministische Sortierung). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber.

**Restlücken (bewusst, Nicht-Ziele):** kein gerichtetes Lineage-Modell (`derivedFrom`), kein globaler Graph-Umbau, kein Edit/Restore/Backfill, kein Audit-Hash-Umbau, kein Prompt-/Object-Rohdatenzugriff. `no-evidence` spiegelt das geladene Evidence-Fenster (max. 500 jüngste).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/provenanceIndex.ts apps/web/src/pages/Stufe2.tsx \
  apps/web/src/i18n.ts tests/ko/provenance-index.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko): read-only provenance/lineage index for Stufe 2 (SCRUM-171)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-172 — Knowledge-OS QM-Hinweise aus vorhandenen Signalen bündeln

**Vorab-Befund (read-only):** Alle Foundation-Signale liegen bereits als DOM-freie Helper-Ergebnisse vor: `buildProvenanceIndex` (SCRUM-171), `summarizeEvidence` (169), `summarizeModelRuns` (165), `ReasonerConfigStatus`/`reasonerModeTone` (166), optional `knowledgeHealth` (141). Sie sind über mehrere Stufe-2-Cards verteilt — es fehlte nur die Bündelung.

**Umsetzung (rein read-only, additiv):**
- Neuer DOM-freier Helper `apps/web/src/lib/knowledgeOsHints.ts` mit `buildKnowledgeOsHints(input)`. Alle Eingaben optional; aggregiert nur strukturierte Helper-Ergebnisse (keine String-Heuristik aus UI-Texten).
- `KnowledgeOsHint` (id, severity, titleKey, detailKey, count?, source) + Summary (total/critical/warnings/info/ok) + `unknownSources[]`.
- **Priorisierung** (deterministisch, stabiler Sort nach Severity-Rang, Push-Reihenfolge als Tiebreak): ModelRun-Errors (critical) → Health kritisch → Reasoner Demo/Fallback → ModelRun-Fallbacks → KOs ohne Evidence → Health mittel → Transfer/Multi-Version (info) → keine Evidence (info). Sauberer Bestand mit mind. einem bekannten Signal → genau ein `ok`-Hinweis.
- **Ehrlichkeit:** Nicht übergebene Kernsignale (modelRuns/reasonerConfig/provenance/evidence) landen in `unknownSources` und werden NICHT als Fehler gezählt; ohne bekanntes Signal kein `ok`-Hinweis.
- Stufe 2 (`Capital`): read-only `KnowledgeOsHintsCard` ganz oben — Severity-Counts, Top-5-Hinweise mit Severity-Badge, ehrlicher Unknown-Hinweis. Quellen aus bestehenden Hooks (`useKos`/`useEvidenceIndex`/`useModelRuns`/`useReasonerConfig`), nur bei `isSuccess` als „bekannt" gewertet. Keine Buttons, keine Ticket-Erstellung, kein Alerting.
- i18n DE/EN `kos.*` vollständig (Titel, Severity, alle Hinweis-Texte, Unknown/None).

**Geänderte/neue Dateien:** neu `apps/web/src/lib/knowledgeOsHints.ts`, `tests/analytics/knowledge-os-hints.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **83 Dateien / 461 Tests** (+7: Leerzustand/unknown, alles-sauber→ok, ModelRun-Errors critical+oben, Reasoner-Demo-Warnung, Provenance no-evidence+lineage-Priorisierung, unknown nicht als Fehler, deterministische Severity-Sortierung). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber.

**Restlücken (bewusst, Nicht-Ziele):** kein neues Backend-Modell, kein Ticket-Auto-Create, kein Alerting/Notification-System, keine Datenänderung/Backfill, kein Dashboard-Umbau, keine neue Risiko-Engine. KnowledgeHealth wird vom Helper unterstützt, in der Card aber (mangels geladener gaps/conflicts/busFactor auf der Capital-Seite) noch nicht gespeist — bleibt als „unknown" ohne Falschmeldung.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/knowledgeOsHints.ts apps/web/src/pages/Stufe2.tsx \
  apps/web/src/i18n.ts tests/analytics/knowledge-os-hints.test.ts docs/qm/claude-after-report.md
git commit -m "feat(qm): bundle Knowledge-OS QA hints from existing signals (SCRUM-172)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-173 — KnowledgeHealth in Knowledge-OS-QM-Hinweise integrieren

**Vorab-Befund (read-only):** `buildKnowledgeOsHints` (SCRUM-172) unterstützte `knowledgeHealth` bereits (health-critical/health-mittel), wurde aber von der Stufe-2-`KnowledgeOsHintsCard` nicht gefüttert → Health blieb faktisch ungenutzt. Die Health-Logik existiert als DOM-freier Helper `knowledgeHealth({ kos, gaps, conflicts, pendingRevalidation, busFactor })` (SCRUM-141), in `Analytics.tsx` exakt so verdrahtet (Hooks `useKos`/`useGaps`/`useConflicts`/`useLifecyclePending`/`useBusFactor`). `unknownSources` führte „health" bisher nicht.

**Umsetzung (read-only-Aggregation, keine neue Engine):**
- `KnowledgeOsHintsCard` lädt jetzt zusätzlich `useGaps`/`useConflicts`/`useLifecyclePending`/`useBusFactor` und berechnet `knowledgeHealth(...)` mit demselben bestehenden Helper wie Analytics — keine neue Logik.
- `knowledgeHealth` wird nur übergeben, wenn **alle** benötigten Signale `isSuccess` sind (`healthKnown`). Sonst bleibt Health ehrlich unbekannt.
- Helper `knowledgeOsHints.ts`: `unknownSources` führt „health", wenn kein Score übergeben wurde; OK-Hinweis-Schwelle auf 5 Kernsignale erweitert. Keine Health-Hinweise/False-Positives ohne Daten.
- Keine UI-Neugestaltung, kein Backend, keine Persistenz, kein Trend/Snapshot.

**Geänderte Dateien:** `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/lib/knowledgeOsHints.ts`, `tests/analytics/knowledge-os-hints.test.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **83 Dateien / 465 Tests** (+4: Health kritisch→critical, Health mittel→warning, Health gut→kein Warnhinweis, Health bleibt nur unknown ohne Daten; 2 bestehende SCRUM-172-Asserts an „health" in unknownSources angepasst). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende `knowledge-health`-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine neue Health-Engine, kein Backend, keine Persistenz, kein Trend/Snapshot, keine Stufe-2-UI-Neugestaltung. Health gilt nur als „bekannt", wenn alle fünf Live-Signale geladen sind — bis dahin ehrlich „unknown" ohne Falschmeldung.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/pages/Stufe2.tsx apps/web/src/lib/knowledgeOsHints.ts \
  tests/analytics/knowledge-os-hints.test.ts docs/qm/claude-after-report.md
git commit -m "feat(qm): feed KnowledgeHealth into Knowledge-OS QA hints (SCRUM-173)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-174 — Evidence-Freshness für aktuelle KO-Versionen ausweisen

**Vorab-Befund (read-only):** `EvidenceRecord.koVersion` und `KnowledgeObject.version` existieren; Evidence-Index (169) liefert KO-übergreifende Records, Evidence-nach-Version (170) gruppiert im KO-Detail strikt nach `koVersion`. Es fehlte die KO-übergreifende Freshness-Auswertung: hat die aktuelle Version Evidence, nur ältere, oder gar keine?

**Umsetzung (rein read-only, additiv):**
- Neuer DOM-freier Helper `apps/web/src/lib/evidenceFreshness.ts` mit `analyzeEvidenceFreshness({ kos, evidence })`. Matching strikt über `koVersion` vs. `ko.version`.
- Pro KO: `currentCount` (koVersion === version), `olderCount` (koVersion < version), `sourceCount`, `objectAttachmentCount` (nur Anhänge mit `objectId` — Legacy-`dataUrl` zählt NICHT), `expectsEvidence`. Status: `current` (aktuelle Version belegt) → ok, `outdated` (nur ältere Versionen belegt) → warning, `missing` (Quellen/Object-Anhänge aber gar keine Evidence) → warning, `neutral` (kein Evidence-Anlass) → kein Fehler. Deterministische Sortierung (outdated < missing < current < neutral, dann Version desc, Titel, koId).
- In `knowledgeOsHints.ts` integriert: neue Quelle `evidenceFreshness`, Hinweise `evidence-outdated`/`evidence-missing` (beide warning, nach provenance-no-evidence). Fehlt das Signal → `unknownSources` führt „evidenceFreshness" (ehrlich, kein Fehler); OK-Schwelle auf 6 Kernsignale erweitert.
- Stufe-2-`KnowledgeOsHintsCard` speist Freshness aus den bereits geladenen `useKos`+`useEvidenceIndex(500)`. Keine neue UI-Card.
- i18n DE/EN `kos.hint.evidence-outdated.*`/`kos.hint.evidence-missing.*`.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/evidenceFreshness.ts`, `tests/ko/evidence-freshness.test.ts`; geändert `apps/web/src/lib/knowledgeOsHints.ts`, `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `tests/analytics/knowledge-os-hints.test.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **84 Dateien / 476 Tests** (+7 Freshness-Helper: current/outdated/missing-Quelle/missing-Objekt/Legacy-neutral/KO-neutral/Sortierung; +4 Hints: outdated→warning, missing→warning, sauber→kein Warnhinweis, unknown ohne Freshness; 2 bestehende SCRUM-172/173-Asserts an „evidenceFreshness" angepasst). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende evidence-by-version/-index/knowledge-os-hints-Tests grün.

**Restlücken/Nicht-Ziele:** keine Datenänderung, kein Backfill, kein Auto-Fix, kein Backend, keine Migration, keine neue große UI-Card. „missing" überschneidet sich bewusst mit dem provenance-no-evidence-Hinweis, ergänzt aber die Versions-Dimension (`outdated`).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/evidenceFreshness.ts apps/web/src/lib/knowledgeOsHints.ts \
  apps/web/src/pages/Stufe2.tsx apps/web/src/i18n.ts \
  tests/ko/evidence-freshness.test.ts tests/analytics/knowledge-os-hints.test.ts \
  docs/qm/claude-after-report.md
git commit -m "feat(qm): evidence freshness vs current KO version (SCRUM-174)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-175 — KO-Detail zeigt versionierte Evidence-Freshness im Kontext

**Vorab-Befund (read-only):** `analyzeEvidenceFreshness({ kos, evidence })` existiert aus SCRUM-174 (Status current/outdated/missing/neutral, Matching strikt über `koVersion`). KO-Detail lädt bereits KO + EvidenceRecords und zeigt Evidence-Konsistenz (168) und Evidence-nach-Version (170). Es fehlte nur die kompakte Freshness-Anzeige für genau dieses eine KO.

**Umsetzung (rein read-only, additiv):**
- Bestehenden Helper wiederverwendet: `analyzeEvidenceFreshness({ kos: [ko], evidence }).rows[0]` liefert den Status dieses KO.
- Keine Freshness-Logik im JSX dupliziert: neuer DOM-freier View-Mapper `apps/web/src/lib/evidenceFreshnessView.ts` (`evidenceFreshnessTone` → pos/warn/neutral, `evidenceFreshnessLabelKey` → `ko.evFresh.<status>`).
- KO-Detail: kompakte Freshness-Zeile in der bestehenden Evidence-Card (zwischen Konsistenz-Block und Evidence-nach-Version) — Status-Badge + Counts (`vN · aktuell X · älter Y`). Konsistenz- und Versions-Gruppen-Anzeige bleiben unverändert daneben.
- i18n DE/EN `ko.evFresh.title/current/outdated/missing/neutral/counts`.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/evidenceFreshnessView.ts`, `tests/ko/evidence-freshness-view.test.ts`; geändert `apps/web/src/pages/KnowledgeDetail.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **85 Dateien / 481 Tests** (+5 View-Mapper: current→pos, outdated→warn, missing→warn, neutral→neutral, Label-Key-Schema). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende evidence-freshness/-by-version/-consistency-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine Datenänderung, kein Backfill, kein Auto-Fix, kein Backend, keine Migration. Konsistenz- und Evidence-nach-Version-Anzeige werden nicht ersetzt, nur ergänzt.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/evidenceFreshnessView.ts apps/web/src/pages/KnowledgeDetail.tsx \
  apps/web/src/i18n.ts tests/ko/evidence-freshness-view.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko): versioned evidence freshness badge in KO detail (SCRUM-175)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-176 — Evidence-Freshness-Index in Stufe 2 anzeigen

**Vorab-Befund (read-only):** `analyzeEvidenceFreshness({ kos, evidence })` (174) und der View-Mapper `evidenceFreshnessTone`/`evidenceFreshnessLabelKey` (175) existieren. Stufe 2 lädt bereits `useKos()` + `useEvidenceIndex(500)` für die QM-Hints. Global sah man bisher nur die Freshness-Counts in den QM-Hinweisen, aber nicht, welche KOs betroffen sind.

**Umsetzung (rein read-only, additiv):**
- Neuer DOM-freier Helper `apps/web/src/lib/evidenceFreshnessIndex.ts` mit `buildEvidenceFreshnessIndex({ kos, evidence }, limit=20)` — wiederverwendet `analyzeEvidenceFreshness`, filtert betroffene KOs (nur `outdated`/`missing`), behält die vollständige Summary und liefert `affectedTotal` vor dem Limit. Deterministische Sortierung kommt unverändert aus `analyzeEvidenceFreshness`.
- Stufe 2 (`Capital`): read-only `EvidenceFreshnessCard` (nach dem Evidence-Index) — Summary-Counts (outdated/missing/current/neutral), Liste der betroffenen KOs mit Titel, Version, Status-Badge (View-Mapper), Counts `aktuell/älter`, KO-interner Link `/wissen/:id`. `current`/`neutral` nur als Counts, keine lange Liste. Echte Daten aus den vorhandenen Hooks — keine neue API, keine Fremd-URLs, keine Rohdaten.
- i18n DE/EN `evFresh.*` (Titel, Subtitle, Empty, Summary-Counts, Version, Counts, openKo).

**Geänderte/neue Dateien:** neu `apps/web/src/lib/evidenceFreshnessIndex.ts`, `tests/ko/evidence-freshness-index.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **86 Dateien / 485 Tests** (+4 Index-Helper: affected nur outdated/missing + Summary vollständig, sauberer Bestand → keine affected, deterministische Sortierung outdated<missing, Limit kappt affected aber nicht affectedTotal). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende Freshness-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine neue API, keine Fremd-URLs, keine Rohdaten, kein Backfill, kein Auto-Fix, kein Backend, keine Migration. Freshness spiegelt das geladene Evidence-Fenster (max. 500 jüngste).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/evidenceFreshnessIndex.ts apps/web/src/pages/Stufe2.tsx \
  apps/web/src/i18n.ts tests/ko/evidence-freshness-index.test.ts docs/qm/claude-after-report.md
git commit -m "feat(qm): evidence freshness index card in Stufe 2 (SCRUM-176)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-177 — QM-Fenstertransparenz für limitierte Indizes

**Vorab-Befund (read-only):** Mehrere Stufe-2-QM-Karten beruhen bewusst auf limitierten Queries: ModelRuns `useModelRuns(50)`, Evidence `useEvidenceIndex(500)`; EvidenceFreshness und Provenance leiten sich aus dem 500er-Evidence-Fenster ab. Korrekt, aber bisher ohne konsistenten Hinweis, ob ein Fenster abgeschnitten sein könnte.

**Umsetzung (rein read-only, additiv):**
- Neuer DOM-freier Helper `apps/web/src/lib/qmDataWindow.ts` mit `evaluateDataWindow({ loaded, limit, source })` → `withinWindow` (loaded < limit) bzw. `potentiallyLimited` (loaded >= limit). `limit <= 0` und nicht-finite Werte werden defensiv als `withinWindow` behandelt. **Kein Fehler** — zählt nicht in kritische QM-Hints.
- Kleine `WindowNote`-Komponente in `Stufe2.tsx` (nutzt den Helper) ergänzt eine kompakte, ehrliche Fenster-Zeile in: ModelRuns-Card (50), EvidenceIndex-Card (500), EvidenceFreshness-Card (500) und ProvenanceIndex-Card (500, da Evidence als „bekannt" genutzt). Text z. B. „Fenster: 500 jüngste EvidenceRecords · innerhalb des geladenen Fensters" bzw. „möglicherweise abgeschnitten".
- i18n DE/EN `qmWindow.within/limited/modelRuns/evidence`.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/qmDataWindow.ts`, `tests/analytics/qm-data-window.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **87 Dateien / 492 Tests** (+7 Window-Helper: within/limited bei <,==,>; Limit 0/negativ defensiv; loaded/limit/source-Übernahme + Floor; nicht-finite loaded). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende Index-/Hint-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine neuen Endpoints, keine Total-Count-API, keine Pagination, kein Backend, keine Persistenz. Der Hinweis ist heuristisch (loaded≥limit) — ohne Server-Gesamtzahl kann „möglicherweise abgeschnitten" auch genau-am-Limit bedeuten; das ist bewusst so formuliert.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/qmDataWindow.ts apps/web/src/pages/Stufe2.tsx \
  apps/web/src/i18n.ts tests/analytics/qm-data-window.test.ts docs/qm/claude-after-report.md
git commit -m "feat(qm): data-window transparency for limited indexes (SCRUM-177)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-178 — Knowledge-OS Readiness-Summary aus QM-Signalen ableiten

**Vorab-Befund (read-only):** `buildKnowledgeOsHints` (172/173/174) liefert bereits Summary (critical/warnings/info/ok), Hints und `unknownSources`; `evaluateDataWindow` (177) liefert den Fenster-Status. Die Stufe-2-`KnowledgeOsHintsCard` baut das Hints-Ergebnis bereits. Es fehlte nur eine knappe Readiness-Aggregation für den Review.

**Umsetzung (rein read-only, additiv, keine neue Engine):**
- Neuer DOM-freier Helper `apps/web/src/lib/knowledgeOsReadiness.ts` mit `buildKnowledgeOsReadiness({ hints, windows? })`. Aggregiert nur die strukturierten Helper-Ergebnisse.
- `readiness: "ready" | "attention" | "critical" | "incomplete"`, deterministische Regeln: critical-Hints → `critical`; sonst warnings ODER windowLimited → `attention`; sonst unknown-Kernsignale → `incomplete`; sonst → `ready`. Fenster-Limit ist kein Fehler, kann aber `attention` auslösen.
- `counts` (critical/warnings/unknown/windowLimited) + `reasons` (max. 3, feste Priorität critical > warning > window > unknown).
- Stufe 2: kompakter Readiness-Header direkt in der `KnowledgeOsHintsCard` (Badge + bis zu 3 Gründe) — reusing das schon vorhandene Hints-Ergebnis und die Fenster aus ModelRuns(50)/Evidence(500). Keine neuen Hooks/Datenquellen, bestehende Cards unverändert.
- i18n DE/EN `readiness.title/ready/attention/critical/incomplete` + `readiness.reason.*`.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/knowledgeOsReadiness.ts`, `tests/analytics/knowledge-os-readiness.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **88 Dateien / 498 Tests** (+6 Readiness: critical→critical, warning→attention, window→attention, unknown→incomplete, all-clear→ready, Gründe max 3 + deterministisch). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende Hints-/Window-/Index-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine neue fachliche Engine, keine neuen Datenquellen, kein Backend, keine Persistenz, kein Ticket-Auto-Create, keine Ersetzung bestehender Cards. Readiness aggregiert nur die bereits geladenen, fensterbasierten QM-Signale.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/knowledgeOsReadiness.ts apps/web/src/pages/Stufe2.tsx \
  apps/web/src/i18n.ts tests/analytics/knowledge-os-readiness.test.ts docs/qm/claude-after-report.md
git commit -m "feat(qm): Knowledge-OS readiness summary from QA signals (SCRUM-178)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-179 — Knowledge-OS Readiness-Reconciliation dokumentieren

**Vorab-Befund (read-only):** `docs/knowledge-os/` existiert (mit `current-state-dossier-2026-06-26.md`). Der Foundation-/QM-Strang SCRUM-164…178 ist im Repo und im After-Report durchgängig dokumentiert; Persistenz vorhanden für ModelRun-Protokoll (`MODEL_RUNS_SCHEMA`) und Evidence (`KO_EVIDENCE_SCHEMA`), alle Auswertungs-Sichten sind DOM-freie, abgeleitete Helper ohne eigene Persistenz. Es fehlte eine kompakte Reconciliation-Matrix vor dem Meilensteinwechsel.

**Dokument erstellt:** `docs/knowledge-os/foundation-readiness-2026-06-27.md` — Reference document mit klarem Status-Header (kein Backlog, schließt keine Tickets, Jira bleibt Source of Truth). Abschnitte: (1) Kurzüberblick, (2) Ticket-/Signal-Matrix SCRUM-164…178 mit Spalten Ticket/Signal/Zweck/Datenquelle/UI-Ort/Persistenz/Fenster-Limit/Status/Restlücke, (3) Readiness-Stand (grün / aufmerksam / bewusst unvollständig / nur im geladenen Fenster gültig), (4) Nicht-Ziele, (5) Empfehlung nächster Meilenstein = Frontend-Funktionsinventar/Produktionsreife-Audit (route-by-route), (6) Prüfhinweise. Ehrlicher Schlusssatz: Foundation-/QM-Strang abgeschlossen, Produkt-/Frontend-Reife NICHT behauptet, eigenes Audit nötig.

**Geänderte/neue Dateien:** neu `docs/knowledge-os/foundation-readiness-2026-06-27.md`; geändert `docs/qm/claude-after-report.md`. **Keine Codeänderung.**

**Tests/Gates:** root `npm run check` grün — **88 Dateien / 498 Tests** (unverändert, reine Doku). apps/web-`tsc` nicht nötig (keine Web-Codeänderung).

**Restlücken/Nicht-Ziele:** keine Codeänderung (außer wäre ein Doc-Link nötig gewesen — der bestehende Dossier-Link wurde im Dokument referenziert), keine Jira-Änderung, keine Tickets geschlossen, keine Behauptung der Gesamt-Produkt-/Frontend-Reife.

No Jira changes by Claude. No tickets closed. No new tickets.
