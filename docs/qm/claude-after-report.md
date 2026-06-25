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
