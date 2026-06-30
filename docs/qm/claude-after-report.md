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

---

## SCRUM-181 — Erststart sichtbar machen: Admin-Demodaten + Empty-State-CTAs

**Vorab-Befund (read-only):** `seedDemo` schreibt über echte Services, guardet aber auf `auth.needsSetup()` → für eine BEREITS eingerichtete Instanz (Login existiert) hätte er immer übersprungen. RBAC kennt `users.manage` (admin). Route-Plugins erhalten teils die vollen `services` (z. B. reasoner/capture). Empty-States existierten (QueryState/inline), führten aber nicht zu nächsten Handlungen. seed.ts importiert build-app → ein Route→seed-Import hätte einen Zyklus erzeugt (`no-circular`, `tsPreCompilationDeps:true`).

**Umsetzung:**
- Seed entkoppelt: neue `services/app/src/seed-demo.ts` (DOM-/build-app-frei, strukturelles `DemoSeedServices`-Interface aus den Modul-Indizes) enthält `seedDemo`, neue `seedDemoForAdmin(services, adminId)` und den geteilten `buildDemoContent`. `seed.ts` bleibt CLI-Runner und re-exportiert — `seed.test.ts` unverändert grün.
- `seedDemoForAdmin`: Idempotenz-Guard „Wissensbasis leer"; legt Demo-Mitnutzer über den **real angemeldeten Admin** an (keine gefälschten Rechte); ehrliche `seeded/skipped`-Rückgabe inkl. Counts.
- Backend-Route `POST /api/admin/demo-seed` (`admin-routes.ts`, Guard `users.manage`), in build-app registriert. Kein Auto-Seed, kein anonymer Zugriff.
- Frontend: `endpoints.admin.demoSeed` + `DemoSeedResult`-Typ; Admin-Card „Demodaten laden" (admin-only Seite) mit Query-Invalidierung (users/kos/gaps/conflicts/validation/notifications/analytics/evidence) und ehrlichem Toast (seeded mit Counts vs. skipped).
- Empty-State-CTAs: DOM-freier Helper `emptyStateActions.ts` (filtert Kandidaten über die vorhandene `ALL_ITEMS`+`canSee`-Logik nach Rolle/Stufe-2), kleine `EmptyStateCtas`-Komponente, `QueryState` um optionalen `emptyExtra`-Slot erweitert. Eingebunden in Start/MyTasks (inline) und Validation/Library (QueryState).
- i18n DE/EN `adm.seed*` + `empty.cta.*`.

**Geänderte/neue Dateien:** neu `services/app/src/seed-demo.ts`, `services/app/src/routes/admin-routes.ts`, `services/app/src/admin-routes.test.ts`, `apps/web/src/lib/emptyStateActions.ts`, `apps/web/src/components/EmptyStateCtas.tsx`, `tests/analytics/empty-state-actions.test.ts`; geändert `services/app/src/seed.ts`, `services/app/src/build-app.ts`, `apps/web/src/api/{endpoints,types}.ts`, `apps/web/src/components/ui.tsx`, `apps/web/src/pages/{Admin,Start,MyTasks,Validation,Library}.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **90 Dateien / 505 Tests** (+ admin-route: anonym→kein 200, Admin seeded auf leerer Instanz, zweiter Lauf skipped/keine Duplikate; + emptyStateActions: Rollen-/Stufe-2-Filter, echte Pfade; seed.test unverändert). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber (kein Zyklus dank seed-demo-Trennung).

**Restlücken/Nicht-Ziele:** kein Auto-Seed beim App-Start, keine Demo-Daten ohne Admin-Aktion, keine Alt-App-Parität, kein Live-Smoke-Pass, keine UI-Neugestaltung. `seedDemoForAdmin` setzt eine LEERE Wissensbasis voraus (sonst ehrlich „skipped").

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add services/app/src/seed-demo.ts services/app/src/seed.ts services/app/src/build-app.ts \
  services/app/src/routes/admin-routes.ts services/app/src/admin-routes.test.ts \
  apps/web/src/api/endpoints.ts apps/web/src/api/types.ts apps/web/src/components/ui.tsx \
  apps/web/src/components/EmptyStateCtas.tsx apps/web/src/lib/emptyStateActions.ts \
  apps/web/src/pages/Admin.tsx apps/web/src/pages/Start.tsx apps/web/src/pages/MyTasks.tsx \
  apps/web/src/pages/Validation.tsx apps/web/src/pages/Library.tsx apps/web/src/i18n.ts \
  tests/analytics/empty-state-actions.test.ts docs/qm/claude-after-report.md
git commit -m "feat(admin): demo-seed action + empty-state CTAs for first-run visibility (SCRUM-181)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-217 — Lifecycle-Lernpfad nach Demo-Seed sichtbar machen

**Vorab-Befund (read-only):** (1) Es gibt bereits eine echte Service-Methode `LifecycleService.createPath(role, steps)` (FR-LIF-03) samt Repo (`savePath`/`getPathByRole`) und unverändertem Progress-/Complete-Flow. (2) Der 404 in `GET /api/learning-paths/:role` ist bewusst („Lernpfad nicht gefunden"), aber der Demo-Seed erzeugte schlicht keinen Pfad → nach Seed 404. (3) Das FE (`Lifecycle.tsx`) crasht nicht: bei fehlendem `path.data` rendert es eine ehrliche Leer-Karte (`lcy.pathEmpty`).

**Entscheidung:** Option A (kleinster sauberer Fix). Der Demo-Seed legt über die **echte** `createPath`-Methode einen rollenspezifischen Beispiel-Lernpfad für `experte` an. Kein 200-Leer-Kontrakt-Umbau (Route/Status bleiben rückwärtskompatibel — andere Rollen liefern weiter 404 → FE-Leer-Karte), kein Editor, kein neues UI, kein neues Modell.

**Umsetzung:** In `seed-demo.ts#buildDemoContent` nach dem Lifecycle-Kopplungs-Block ein `await lifecycle.createPath("experte", [4 Schritte])`. Ausschließlich über den Service (nicht am UI/Repo vorbei). `SeedResult`-Typ unverändert (kein FE-Vertragsbruch). Route, Service-Verhalten, Progress/Complete und FE bleiben unangetastet.

**Geänderte Dateien:** `services/app/src/seed-demo.ts`, `services/app/src/admin-routes.test.ts`, `docs/qm/claude-after-report.md`. (Keine FE-Änderung.)

**Tests/Gates:** `npm run check` grün — **90 Dateien / 506 Tests** (+1: voller HTTP-Pfad register→login→demo-seed→`GET /api/learning-paths/experte` = 200 mit `role:"experte"` und ≥1 Schritt; deckt den SCRUM-216-Befund ab). Bestehende `seed.test`/Lifecycle-Tests unverändert grün. Biome + depcruise sauber. apps/web `tsc` nicht nötig (kein FE berührt).

**Restlücken/Nicht-Ziele:** kein Lernpfad-Editor, kein LMS, kein Browser-Smoke-Framework, keine Alt-App-Parität, kein Seed-Auto-Run. Lernpfade existieren nur für `experte` (per Ticket „bevorzugt experte, mindestens einen"); für andere Rollen bleibt der 404→Leer-Karte-Pfad bewusst unverändert. Persistenz nur, wenn der Seed gegen Postgres läuft (In-Memory-Seed ist nicht persistent — bestehende Eigenschaft).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
git add services/app/src/seed-demo.ts services/app/src/admin-routes.test.ts docs/qm/claude-after-report.md
git commit -m "fix(lifecycle): seed an experte learning path so the path section is visible after demo-seed (SCRUM-217)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-218 — Headless Browser-Smoke-light für Kernrouten

**Vorab-Befund (read-only):** Kein Browser-Tooling im Repo (kein Playwright/Puppeteer/Cypress/jsdom), kein System-Chromium, vitest läuft in Node-Env. FE-API-Client nutzt `credentials:"include"` gegen same-origin `/api`; Login setzt ein HttpOnly-Cookie `kw_session`; AuthContext bootstrappt über `/auth/status`+`/auth/me`. Vite proxyt `/api` → `VITE_API_TARGET`. Kein FE-ErrorBoundary. **Wichtig:** `/lebenszyklus` ist controller+-gesichert, SCRUM-217 hatte aber nur einen `experte`-Lernpfad geseedet → der reviewende Admin/Controller sah dort weiter die Leer-Karte.

**Entscheidung:** Option C (Sandbox kann keinen Browser starten) + ein kleiner, begründeter Testability-Fix. Statt einer schweren Blind-Dependency: ein eigenständiges, **lokal ausführbares** Playwright-Skript mit dynamischem Import (kein Eintrag in package-Dependencies, kein CI-Zwang). Zusätzlich SCRUM-217-Seed minimal erweitert, damit die Lifecycle-gesicherten Rollen (controller/admin) ebenfalls einen Pfad haben — sonst wäre das Smoke-Kriterium „/lebenszyklus kein 404-Datenloch" für die zugriffsberechtigten Rollen nicht erfüllbar.

**Umsetzung:**
- `scripts/smoke-browser.mjs`: launcht Chromium (headless), richtet via `context.request` ersten Admin ein (register→login→`POST /api/admin/demo-seed`, Cookie landet im Context), besucht die 10 Kernrouten und prüft je Route: App-Shell-Landmark (`a[href="/start"]`) sichtbar, URL nicht vom Auth-Gate zurückgeworfen, keine neuen `pageerror`-Crashes; für `/lebenszyklus` zusätzlich ein sichtbarer Lernpfad-Schritt. Fehlt Playwright/App → sauberer Exit-Code 2 mit Anleitung (kein Fake-Pass).
- `npm run smoke:browser` ergänzt; `scripts` in Biome-Ignore (Utility außerhalb der Lint-Surface). Root-`tsc` umfasst nur `services`/`tests` → Skript bricht den Build nicht.
- `seed-demo.ts`: SCRUM-217-`createPath("experte", …)` zu einer Schleife über `experte/controller/admin` erweitert (gleiche Schritte, echte Service-Methode). `viewer` bleibt bewusst ohne Pfad (404→Leer-Karte).

**Was lief wo:** In-Sandbox **verifiziert** — Skript-Syntax (`node --check`), sauberer Blocker-Exit (2) ohne Browser, und per In-Process-HTTP, dass nach Seed `learning-paths` für experte/controller/admin = **200 (4 Schritte)** und viewer = 404 liefert. **Lokal nötig (nicht im Sandbox):** der eigentliche Browser-Rundgang (`npm run smoke:browser`) — Chromium ist hier nicht verfügbar.

**Geänderte/neue Dateien:** neu `scripts/smoke-browser.mjs`; geändert `package.json` (Script), `biome.json` (Ignore), `services/app/src/seed-demo.ts`, `services/app/src/admin-routes.test.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **90 Dateien / 506 Tests** (SCRUM-217-Test auf experte/controller/admin=200 + viewer=404 erweitert). `seed.test` unverändert grün. Biome + depcruise sauber. Kein apps/web-FE berührt → apps/web-`tsc` nicht nötig.

**Restlücken/Nicht-Ziele:** kein E2E-Framework, keine Pixel-Screenshots, keine externen Secrets, keine Alt-App-Parität, kein Mobile/PWA-Offline-Test, kein Browser-Run im Sandbox. Playwright bleibt bewusst optionale lokale Dev-Dependency (kein Repo-Dependency-Eintrag). Der Browser-Smoke deckt Render/Navigation/Crash ab, nicht funktionale Tiefenpfade.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
# Browser-Smoke lokal:
PORT=3001 npm start &                                   # Terminal 1
VITE_API_TARGET=http://localhost:3001 npm --prefix apps/web run dev &   # Terminal 2
npm i -D playwright && npx playwright install chromium
npm run smoke:browser
git add scripts/smoke-browser.mjs package.json biome.json \
  services/app/src/seed-demo.ts services/app/src/admin-routes.test.ts docs/qm/claude-after-report.md
git commit -m "test(smoke): locally-runnable headless browser smoke for core routes + seed lifecycle paths for gated roles (SCRUM-218)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-219 — Hilfe-Seite mit echten Inhalten und Suche produktnäher machen

**Vorab-Befund (read-only):** `/hilfe` (`pages/Help.tsx`) hatte eine funktionierende, aber inline implementierte Suche über 6 generische Topics (title+body), KEINE Links auf echte Routen, keinen DOM-freien Helper/Test, keinen ehrlichen Leerzustand. Nav-Key `hilfe` → `/hilfe`. Es gibt etablierte UI-Patterns (`Card`, `PageHeader`, Pill-Chips, `Link`) und reale Zielrouten in `routes.tsx`/`navigation.ts`.

**Entscheidung:** Kein Redesign — die bestehende Card/Search-Struktur beibehalten und produktnah füllen. Such-/Datenlogik in einen DOM-freien Helper auslagern (testbar), 10 echte Hilfekapitel definieren, jeweils mit Tags und Link nur auf vorhandene App-Routen. Kein Backend, kein CMS, keine KI-Suche.

**Umsetzung:**
- Neuer DOM-freier Helper `apps/web/src/lib/helpTopics.ts`: `HELP_TOPICS` (10 Kapitel: Erststart/Demodaten, Erfassen, Fragen, Bibliothek, Validierung, Aufgaben, Risiko/Lücken/Konflikte, Lebenszyklus/Lernpfade, Stufe 2/QM/Kapital/Output, Mobil/Offline) mit `to` (echte Route) + Tags; `filterHelpTopics(items, query)` sucht case-insensitiv über Titel/Text/Tags, leere Query → alle, kein Treffer → leeres Ergebnis.
- `Help.tsx` neu verdrahtet: löst i18n-Texte auf, filtert über den Helper, rendert Kapitel-Cards mit Tag-Chips und „Bereich öffnen"-Link (react-router `Link` auf die echte Route), ehrlicher Leerzustand (`help.noResults`).
- i18n DE/EN: `help.intro`, `help.noResults`, `help.openRoute` + 8 neue Kapitel (firststart/library/tasks/risk/lifecycle/validation/stufe2/mobile); `help.capture`/`help.ask` wiederverwendet. Bestehende Alt-Keys unangetastet.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/helpTopics.ts`, `tests/analytics/help-topics.test.ts`; geändert `apps/web/src/pages/Help.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **91 Dateien / 512 Tests** (+6 Helper: leere/whitespace-Query → alle, Match in Titel/Text/Tags case-insensitiv, kein-Treffer-Leerzustand, 10 eindeutige Kapitel mit nur internen Routen). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber.

**Restlücken/Nicht-Ziele:** kein Backend, kein CMS/Confluence, keine KI-Suche, keine Alt-App-Parität, kein UI-Redesign, keine externen Links als Kernfunktion. Hilfeinhalte sind statisch/i18n-gepflegt (keine Server-Quelle). Verwaiste Alt-Help-Keys (validate/conflict/roles/trust) blieben bewusst stehen (mögliche Nutzung im Hilfe-Center) und können später separat aufgeräumt werden.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/helpTopics.ts apps/web/src/pages/Help.tsx apps/web/src/i18n.ts \
  tests/analytics/help-topics.test.ts docs/qm/claude-after-report.md
git commit -m "feat(help): product-near help chapters with client-side search and route links (SCRUM-219)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-220 — Notifications interaktiv: gelesen markieren und Zielnavigation

**Vorab-Befund (read-only):** Benachrichtigungen sind **abgeleitet**, nicht persistiert: `notification-feed.ts#buildNotifications({ conflicts, gaps })` aggregiert offene Konflikte + offene Wissenslücken zu `Notification { id, kind, title, at }` mit stabilen IDs `con-<id>`/`gap-<id>`. Route `GET /api/notifications` ist read-only; es gibt KEIN notifications-Repo und kein `read`/`seen`-Feld (das `notifications`-Modul ist nur der Mailer). Die Topbar-Glocke navigierte bereits per Klick (`/konflikte`/`/risiko`), zählte aber ALLE Items als Badge — ohne Gelesen-Konzept und ohne mark-read.

**Entscheidung:** Da Benachrichtigungen abgeleitet sind (kein Repo, kein Server-Status), wäre Server-Persistenz von „gelesen" ein neues Modell und semantisch fragwürdig (das Signal existiert ja weiter) → **kein** Backend-Eingriff. Stattdessen: client-seitiger Gelesen-Status pro Sitzung (stabil über die festen IDs) + Unread-Badge + Zielnavigation aus den vorhandenen Daten. Die Navigation wird in einen DOM-freien, getesteten Helper zentralisiert.

**Umsetzung:**
- Neuer DOM-freier Helper `apps/web/src/lib/notificationTarget.ts`: `notificationTarget(n)` → conflict `/konflikte`, gap `/risiko`, sonst `null` (kein Fake-Ziel).
- Topbar `NotificationBell`: `readIds`-State (Set), Badge = Unread-Count, „Alle gelesen"-Button, pro Zeile ✓-Button (mark-read ohne Navigation) und Klick auf den Titel = navigiert (per Helper-Ziel) **und** markiert gelesen. Gelesene Zeilen werden ausgegraut. `Link` durch `useNavigate` ersetzt (kein verschachteltes Interaktiv-Element). Badge aktualisiert sich sofort nach jeder Aktion.
- i18n DE/EN `topbar.notifMarkAll`/`notifMarkRead`/`notifOpen`.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/notificationTarget.ts`, `tests/analytics/notification-target.test.ts`; geändert `apps/web/src/shell/Topbar.tsx`, `apps/web/src/i18n.ts`, `docs/qm/claude-after-report.md`. (Kein Backend berührt.)

**Tests/Gates:** `npm run check` grün — **92 Dateien / 515 Tests** (+3 Helper: conflict→/konflikte, gap→/risiko, unbekannt→null). apps/web `tsc --noEmit` EXIT=0. Biome + depcruise sauber. Bestehende Notification-/Feed-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** kein Notification-Center, keine Push/WebPush/Realtime-Infrastruktur, keine E-Mail-Notifications, kein Backend-Read-Status. Gelesen-Status ist sitzungslokal (nach Reload zurückgesetzt) — bewusst, da Benachrichtigungen abgeleitet sind und beim Lösen/Schließen des Signals ohnehin verschwinden. Server-seitige Persistenz wäre ein eigenes Ticket (neues Modell).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check && (cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/notificationTarget.ts apps/web/src/shell/Topbar.tsx apps/web/src/i18n.ts \
  tests/analytics/notification-target.test.ts docs/qm/claude-after-report.md
git commit -m "feat(notifications): client-side mark-read + unread badge + tested target navigation (SCRUM-220)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-221 — Auth-Recovery runtime-smoke: Forgot/Reset mit Test-Mailer

**Vorab-Befund (read-only):** Der Service implementiert den Token-Flow bereits vollständig und sicher: `requestPasswordReset(email)` erzeugt einen Token (TTL), `resetPasswordWithToken(token, pw)` setzt das Passwort und **löscht den Token** (einmalig). Die Routen sind sauber: `POST /api/auth/forgot` antwortet **immer 204** (keine Existenz-Preisgabe) und stellt den Reset-Link nur per Mailer zu — der Token wird **NICHT** über die Produkt-API zurückgegeben; `POST /api/auth/reset` nimmt `{token, newPassword}`. Es existiert ein sammelnder Test-Mailer `ConsoleMailer` (`.sent[]`), und `buildServices().mailer` ist ohne SMTP-Env genau dieser. Die bestehenden `service.test`-Fälle decken login/logout/admin-reset ab, aber **nicht** den HTTP-Forgot→Reset→Login-Flow mit Token-Zustellung — genau die SCRUM-216-Lücke.

**Entscheidung:** Option A/B — keine Produktänderung nötig. Ein neuer **Route-Level-Smoke** über die echten HTTP-Routen (`app.inject`) schließt die Lücke: der Token wird ausschließlich aus dem injizierten `ConsoleMailer` (Mail-Text, `?token=…`) gelesen, nie aus einer API-Antwort. Kein SMTP, kein Secret, keine Produkt-API-Schwächung.

**Umsetzung:** Neuer Test `services/app/src/auth-recovery.test.ts`: baut die App mit einem eigenen `ConsoleMailer`, registriert einen Nutzer, löst `forgot` aus (prüft 204 + kein „token" im Body + genau eine Mail an die Adresse), extrahiert den Token aus der Mail, löst `reset` ein, verifiziert: altes Passwort-Login scheitert (≥400), neues Passwort-Login = 200 (Token erhalten), zweite Token-Einlösung scheitert (einmalig). Zweiter Test: `forgot` für unbekannte E-Mail → 204 und **keine** Mail (keine Existenz-Preisgabe).

**Geänderte/neue Dateien:** neu `services/app/src/auth-recovery.test.ts`; geändert `docs/qm/claude-after-report.md`. (Kein Produktcode, kein FE berührt.)

**Tests/Gates:** `npm run check` grün — **93 Dateien / 517 Tests** (+2 Recovery-Route-Smoke). Bestehende Auth-/OIDC-/Mailer-Tests unverändert grün. Biome + depcruise sauber. apps/web `tsc` nicht nötig (kein FE).

**Restlücken/Nicht-Ziele:** kein echtes Mail-Provider-Setup, kein OIDC/SSO, kein neues Auth-System, keine UI-Neugestaltung, keine Secrets. Token-TTL-Ablauf wird nicht zeitgesteuert geprüft (würde Zeitmanipulation erfordern) — Einmaligkeit und Erfolg/Fehler-Pfade sind abgedeckt. FE-Reset-Screen wurde nicht im Browser geprüft (Sandbox ohne Browser; siehe SCRUM-218-Pfad).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
git add services/app/src/auth-recovery.test.ts docs/qm/claude-after-report.md
git commit -m "test(auth): HTTP forgot→reset→login recovery smoke via ConsoleMailer (SCRUM-221)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-222 — Mobile/PWA-Runtime-Smoke: Service Worker & Offline-Queue verifizieren

**Vorab-Befund (read-only):** Alle PWA-Artefakte vorhanden: `apps/web/public/sw.js` (handgeschrieben, kein Workbox), `manifest.webmanifest` (standalone, 192/512 + maskable Icons), Icons. SW-Strategie sauber: `/api` + `/health` network-only (früher return, kein respondWith), Navigationen network-first → App-Shell-Fallback (`/index.html`), statische Assets stale-while-revalidate, nur GET behandelt. SW-Registrierung in `main.tsx` ist **PROD-only**. Offline-Queue-Kernlogik liegt als pure Funktionen in `lib/offlineQueue.ts` mit bestehendem Test `tests/capture/offline-queue.test.ts` (6 Tests). `/mobile` rendert innerhalb der AppShell (Shell-Landmark vorhanden). Browser-/SW-Runtime ist im Sandbox nicht ausführbar (kein Chromium) — SCRUM-218-Lücke.

**Entscheidung:** Kombination der kleinsten sinnvollen Schritte ohne Browser-Hack: (A) DOM-freier SW-Regel-Vertragstest über den Quelltext, (C) `/mobile` in den vorhandenen Browser-Smoke aufnehmen, (D) Production-Build-Artefakte nachweisen. Keine neue PWA-Architektur, kein Background-Sync, keine Push.

**Umsetzung:**
- Neuer Test `tests/capture/sw-rules.test.ts` (DOM-frei): liest `public/sw.js` + `manifest.webmanifest` und prüft die Kern-Invarianten statisch — `/api`/`/health` als nicht-cachebar erkannt, network-only-Early-Return, nur-GET, Navigation network-first + Shell-Fallback, Precache von Shell/manifest/Icons, stale-while-revalidate; Manifest standalone + 192/512 + maskable. Robust gegen Regressionen, ohne SW-Runtime.
- `scripts/smoke-browser.mjs`: `/mobile` zu den Smoke-Routen ergänzt (lädt in der Shell, kein Crash). Exit-2-Blocker ohne Playwright bleibt unverändert.
- Production-Build (Option D) ausgeführt und verifiziert: `dist/` enthält `sw.js`, `manifest.webmanifest`, `icon-192/512`, `icon-maskable-512`, `apple-touch-icon-180`; `index.html` referenziert manifest + apple-touch-icon. (dist danach wieder entfernt — regenerierbar/gitignored.)

**Geänderte/neue Dateien:** neu `tests/capture/sw-rules.test.ts`; geändert `scripts/smoke-browser.mjs`, `docs/qm/claude-after-report.md`. (Kein Produkt-/FE-Quellcode geändert.)

**Tests/Gates:** `npm run check` grün — **94 Dateien / 524 Tests** (+7 SW-Regel-Vertrag; offline-queue-6 unverändert grün). `node --check scripts/smoke-browser.mjs` ok. `cd apps/web && npm run build` erfolgreich, PWA-Artefakte im dist nachgewiesen. Biome + depcruise sauber. apps/web `tsc` nicht nötig (kein FE-Quellcode berührt).

**Restlücken/Nicht-Ziele:** kein PWA-E2E-Framework, keine Background-Sync-API, keine Push, kein neuer Offline-Speicher, keine Mobile-UI-Neugestaltung. Das **tatsächliche** Offline-/SW-Laufzeitverhalten (Cache-Hit offline, Install-Prompt, Sync-Trigger nach Reconnect) ist nur lokal im Browser-Smoke (`npm run smoke:browser`, SCRUM-218) bzw. manuell prüfbar — im Sandbox mangels Chromium nicht. Der SW-Vertragstest sichert die Regeln statisch; die Queue-Logik ist unit-getestet.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
node --check scripts/smoke-browser.mjs
(cd apps/web && npm run build && ls dist/sw.js dist/manifest.webmanifest)
git add tests/capture/sw-rules.test.ts scripts/smoke-browser.mjs docs/qm/claude-after-report.md
git commit -m "test(pwa): static SW-rule contract + /mobile in smoke + build-artifact verification (SCRUM-222)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-223 — Lifecycle-Lernpfad-Fortschritt end-to-end runtime-verifizieren

**Vorab-Befund (read-only):** (1) `POST /api/learning-paths/:pathId/complete` (Body `{stepId}`, Guard `ko.read`) markiert einen Schritt über `lifecycle.completeStep(pathId, user.id, stepId)` und gibt die Liste erledigter Schritt-IDs zurück; `GET /api/learning-paths/:pathId/progress` liefert sie. (2) Fortschritt wird **pro Nutzer** gespeichert (Schlüssel pathId + userId, `getProgress`/`setProgress`). (3) `GET /api/learning-paths/:role` liefert die **Pfad-Definition** (Schritte), nicht den Fortschritt — der Completed-State kommt aus `/progress` bzw. der Complete-Antwort. (4) FE ist korrekt verdrahtet (`endpoints.learningPaths.complete/progress`, Hooks, `Lifecycle.tsx`-Complete-Button). Service-Tests decken `completeStep`/`progress`/Idempotenz ab — es fehlte nur ein **Route-Level-HTTP-Test**.

**Entscheidung:** Option A — der kleinste saubere Fix ist genau dieser fehlende HTTP-Route-Smoke. Kein Produkt-/FE-Code, kein Editor, kein LMS.

**Umsetzung:** Neuer Test `services/app/src/learning-path-progress.test.ts` über `buildApp`/`app.inject`: Admin registrieren+login → Demo-Seed (legt Admin-Lernpfad an) → `GET /learning-paths/admin` (Pfad+Schritte) → `progress` anfangs `[]` → `complete` Schritt 1 (Antwort enthält Schritt) → `progress` = `[step1]` (persistent) → gleicher Schritt erneut → weiterhin Länge 1 (idempotent) → Schritt 2 → `progress` = beide. Zweiter Test: per-Nutzer-Trennung — erik (Seed-Account) sieht für denselben pathId `[]`.

**Geänderte/neue Dateien:** neu `services/app/src/learning-path-progress.test.ts`; geändert `docs/qm/claude-after-report.md`. (Kein Produkt-/FE-Code.)

**Tests/Gates:** `npm run check` grün — **95 Dateien / 527 Tests** (+2 Lernpfad-Route-E2E). Bestehende Lifecycle-/Seed-/Admin-Tests unverändert grün. Biome + depcruise sauber. apps/web `tsc` nicht nötig (kein FE berührt).

**Restlücken/Nicht-Ziele:** kein Lernpfad-Editor, kein LMS, kein Browser-E2E-Framework, keine Mobile-/Offline-Änderung, keine Alt-App-Parität. Die FE-Klickstrecke (Button → Mutation) ist verdrahtet und über den Browser-Smoke (`/lebenszyklus`, SCRUM-218) lokal prüfbar; der HTTP-Datenpfad ist jetzt voll abgedeckt. Persistenz über Reload/Server-Neustart greift nur im Postgres-Betrieb (In-Memory bleibt prozesslokal — bestehende Eigenschaft).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
git add services/app/src/learning-path-progress.test.ts docs/qm/claude-after-report.md
git commit -m "test(lifecycle): HTTP end-to-end learning-path progress (complete → progress, per-user, idempotent) (SCRUM-223)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-225 — External-Knowledge-Einstieg auf vorhandener Suche

**Vorab-Befund (read-only):** (1) Backend `GET /api/external/search?q=` existiert (`services/app/src/routes/external-routes.ts`, Guard `ko.read`); ist der Proxy nicht konfiguriert (`EXTERNAL_SEARCH=off`), antwortet die Route mit **501** `{error:"EXTERNAL_SEARCH_DISABLED"}`. Modul `services/external-search` liefert `ExternalResult{title,url,snippet,provider}` (stateless, kein KO-Bezug, kein Auto-Import). (2) FE-Endpoint `endpoints.external.search(q)` vorhanden; `ApiError` trägt `.status`+`.code`. (3) Bisher war die externe Suche **nur** im KO-Detail (`KnowledgeDetail.tsx`, „Als Quelle anhängen") erreichbar — exakt die SCRUM-224-Lücke. (4) Navigation/Routing leiten zentral aus `app/navigation.ts` ab (`ALL_ITEMS` → `routes.tsx` + Sidebar + Command Palette). (5) i18n hat einen `ext.*`-Block (DE/EN).

**Umsetzung (kleinster sauberer Eingriff):** Eigenständige Seite `apps/web/src/pages/ExternalKnowledge.tsx` unter Route `/extern`, Nav-Eintrag „Externes Wissen" in der Gruppe Arbeitsbereich (minRole `viewer`, Icon Globe). Nutzt **ausschließlich** `endpoints.external.search`. Suchfeld + Ergebnisliste mit Provider, Titel, Snippet, URL. **Kein** „Anhängen"-Button und **kein** Import ohne KO-Kontext. Sichtzustände werden über einen DOM-freien Helper `apps/web/src/lib/externalKnowledge.ts` abgeleitet (`buildExternalSearchView`: idle/loading/disabled/error/empty/results; `isSearchDisabled` erkennt 501 + `EXTERNAL_SEARCH_DISABLED`; `dedupeResults` entfernt URL-Dubletten). 501/off wird ehrlich als eigener „deaktiviert"-Zustand angezeigt. KO-Detail-Add-Source bleibt unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/pages/ExternalKnowledge.tsx`, `apps/web/src/lib/externalKnowledge.ts`, `tests/analytics/external-knowledge.test.ts`; geändert `apps/web/src/app/navigation.ts` (Nav-Item + Globe-Import), `apps/web/src/routes.tsx` (Route), `apps/web/src/i18n.ts` (nav.external + extpage.* DE/EN), `scripts/smoke-browser.mjs` (Route `/extern` im Tour), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **96 Dateien / 535 Tests** (+1 Datei, +8 Tests für externalKnowledge). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Bestehende `tests/ko/external-search.test.ts` (KO-Detail-Mapping) unverändert grün.

**Restlücken/Nicht-Ziele:** kein neues Backend, kein neuer Provider (weiter nur der konfigurierte Server-Proxy), kein Auto-Import, keine Peer-Validierung, keine Persistenz der Suchhistorie. Ohne KO-Kontext bewusst kein Anhängen — Übernahme bleibt der KO-Detail-Strecke vorbehalten. Live-Render von `/extern` lokal über den Browser-Smoke (SCRUM-218) prüfbar; im 501-Fall greift der ehrliche „deaktiviert"-Zustand.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/pages/ExternalKnowledge.tsx apps/web/src/lib/externalKnowledge.ts tests/analytics/external-knowledge.test.ts apps/web/src/app/navigation.ts apps/web/src/routes.tsx apps/web/src/i18n.ts scripts/smoke-browser.mjs docs/qm/claude-after-report.md
git commit -m "feat(external): standalone external-knowledge entry on existing search (SCRUM-225)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-226 — Output Factory: KO-Reihenfolge & Live-Kompositionsvorschau

**Vorab-Befund (read-only):** (1) Der Backend-Vertrag nimmt geordnete `koIds` bereits ehrlich entgegen: `OutputService.generate` iteriert `input.koIds` **in Reihenfolge** und baut `selected` genau so auf; die Renderer (`render.ts`) nummerieren in dieser Reihenfolge (`## ${i+1}. …`). **Kein Backend-Redesign, kein neuer Endpoint nötig.** (2) FE-seitig überschrieb die Output Factory die Nutzerwahl: `koIds: orderedSelection(selected, sourceIds)` sortierte die Auswahl zurück in **Quellenlistenreihenfolge** — bewusstes Ordnen war damit unmöglich. (3) Es gab keine Vorschau vor dem Generieren; die Markdown-Vorschau erscheint erst nach dem Generieren. (4) `endpoints.output.generate`, Copy und Download funktionieren und bleiben unangetastet.

**Umsetzung (kleinster sauberer Eingriff):** Neuer DOM-freier Helper `apps/web/src/lib/outputComposition.ts` — `sanitizeOrder` (behält Nutzer-Reihenfolge, verwirft Unbekanntes/Dubletten), `moveInOrder` (Hoch/Runter, randstabil), `buildCompositionPreview` (Output-Typ + geordnete KO-Liste + Provenance-/Unsicherheits-Signal, Schwelle `UNCERTAIN_TRUST_BELOW=60` analog Backend). In `Stufe2.tsx#Output`: Auswahl bleibt nutzer-geordnet; `koIds` an die Generation = exakt diese Reihenfolge (`sanitizeOrder(selected, sourceIds)`). Neue Card „Reihenfolge & Komposition" mit geordneter Liste (Position, Titel, Trust/Version, ↑/↓/×-Buttons) + ehrlicher Kompositionsvorschau (Typ, Anzahl Bausteine, Provenance-Hinweis, Unsicherheits-Zähler) und einem klaren Disclaimer „Vorschau der Komposition, nicht das fertige Dokument". Der Generieren-Button wandert in diese Card. **Keine DnD-Library, kein Editor.**

**Geänderte/neue Dateien:** neu `apps/web/src/lib/outputComposition.ts`, `tests/output/output-composition.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx` (Order-UI + Vorschau, Generation nutzt Nutzer-Reihenfolge, lucide-Icons ArrowUp/ArrowDown/X), `apps/web/src/i18n.ts` (out.compose*/out.preview* DE/EN), `docs/qm/claude-after-report.md`. `orderedSelection` in `outputDoc.ts` bleibt erhalten (weiter exportiert + getestet), wird nur nicht mehr für die Ordnung verwendet.

**Tests/Gates:** `npm run check` grün — **97 Dateien / 540 Tests** (+1 Datei, +5 Tests für outputComposition). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Bestehender `tests/output/output-doc.test.ts` (inkl. orderedSelection) unverändert grün.

**Restlücken/Nicht-Ziele:** kein vollwertiger Editor, keine DnD-Library, kein Backend-Redesign, keine Output-Persistenz, kein PDF-Export. Die Vorschau zeigt die Komposition (Typ + geordnete Bausteine + Provenance-Signal), nicht das gerenderte Enddokument — die echte Markdown-Erzeugung bleibt serverseitig und erscheint nach „Generieren" (Copy/Download unverändert).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/outputComposition.ts tests/output/output-composition.test.ts apps/web/src/pages/Stufe2.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(output): orderable KO selection + honest composition preview before generate (SCRUM-226)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-227 — Kapital-Dashboard: Sprungmarken für konsolidierte Alt-App-Sektionen

**Vorab-Befund (read-only):** Das Kapital-Dashboard (`Stufe2.tsx#CapitalDashboard`) rendert die in der Stufe-2-Kapital-Sicht konsolidierten Alt-App-Management-Flächen als 9 aufeinanderfolgende `<Card>`-Sektionen mit `SectionLabel`: Operativer Snapshot (`mgmt.overview`), Capital Score (`mgmt.capital`), Valuation (`mgmt.valuation`), Statement (`mgmt.statement`), Maturity (`mgmt.maturity`), Knowledge House (`mgmt.house`), Empfehlungen (`mgmt.recommendations`), Prioritäten (`mgmt.priorities`), Pilot 30/60/90 (`mgmt.pilot`). Es gab **keine** Anker-IDs und keine Orientierungsleiste. Die shared `Card`-Komponente (`components/ui.tsx`) akzeptierte kein `id`. Alle mgmt.*-Labels existieren bereits (DE/EN). Routing nutzt react-router; Hash-Anker innerhalb der Seite sind ausreichend (kein neuer Route-Eintrag nötig).

**Umsetzung (kleinster sauberer Eingriff):** (1) `Card` um eine **optionale, rein additive** `id`-Prop erweitert (kein Default-Verhalten geändert). (2) Neuer DOM-freier Helper `apps/web/src/lib/capitalSections.ts` als einzige Quelle: `CAPITAL_SECTIONS` (id + mgmt.*-labelKey in Renderreihenfolge), `sectionAnchor(id)` → `kapital-<id>` (Präfix gegen ID-Kollisionen), `sectionHref(id)` → `#kapital-<id>`. (3) In `CapitalDashboard` oben eine kompakte Sprungmarken-Leiste (`<nav>` mit Pill-Links aus `CAPITAL_SECTIONS`) ergänzt; jede der 9 vorhandenen Sektions-Cards bekommt `id={sectionAnchor(...)}` + `scroll-mt-4`. Klick springt nativ per Hash-Anker zur vorhandenen Sektion — **kein** UI-Redesign, keine neuen Seiten/Routen, keine neuen Daten.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/capitalSections.ts`, `tests/analytics/capital-sections.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx` (Jump-Bar + 9 Anker-IDs), `apps/web/src/components/ui.tsx` (Card optionale `id`-Prop), `apps/web/src/i18n.ts` (`mgmt.jumpTitle` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **98 Dateien / 544 Tests** (+1 Datei, +4 Tests für capitalSections). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Bestehende Kapital-/Snapshot-Anzeige unverändert (nur additive Anker + Leiste).

**Restlücken/Nicht-Ziele:** keine Wiederherstellung der alten Einzelseiten, kein Redesign, keine neue Management-Engine, keine neuen Backend-Daten, keine Pixel-Parität. Kein Scroll-Spy/aktiver Zustand (bewusst minimal — reine Orientierung + Deep-Link). Die Anker greifen innerhalb der bestehenden `/kapital`-Seite; ein direkter Deep-Link `…/kapital#kapital-pilot` funktioniert nach dem Laden.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/capitalSections.ts tests/analytics/capital-sections.test.ts apps/web/src/pages/Stufe2.tsx apps/web/src/components/ui.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(capital): section jump-bar + stable anchors for consolidated management sections (SCRUM-227)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-228 — Knowledge Graph: Knoten-Klick zum KO-Detail

**Vorab-Befund (read-only):** Der SVG-Graph (`Stufe2.tsx#GraphView`) rendert Knoten als `<g><circle/><text/></g>` — **bisher ohne Interaktion**. Das Layout (`lib/graphLayout.ts`, deterministisches Kreislayout) und seine Tests bleiben unberührt. Entscheidend: Graph-Knoten tragen die **echte KO-ID** (`services/library-analytics/src/service.ts`: `nodes = list.map((ko) => ({ id: ko.id, title: ko.title }))`), und die KO-Detail-Route `/wissen/:id` existiert (`routes.tsx`). `useNavigate` ist das etablierte Navigations-Pattern (Capture, CommandPalette, Topbar). Konflikt-/Tag-Kanten, Legende und Truncate-Hinweis sind eigenständig und bleiben read-only.

**Umsetzung (kleinster sauberer Eingriff):** Neuer DOM-freier Helper `apps/web/src/lib/graphNav.ts` — `koDetailPath(koId)` (`/wissen/<id>`, ID URL-kodiert) und `isNavigableNode(id, knownKoIds)` (navigierbar nur bei bekanntem KO im Bestand). In `GraphView`: `knownKoIds`-Set aus `useKos()`; jeder navigierbare Knoten-`<g>` erhält `role="link"`, `tabIndex={0}`, `aria-label` (`graph.openNode`), `cursor-pointer`, `onClick` → `navigate(koDetailPath(id))` sowie `onKeyDown` für Enter/Space (mit `preventDefault`). Knoten **ohne** passendes KO bleiben ehrlich neutral: kein role/tabIndex/Handler — sicher deaktiviert. Kleiner sichtbarer Hinweis `graph.clickHint` in der Kopfzeile. **Keine** Graph-Library, kein Editor, kein Zoom/Pan, kein Backend-Code.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/graphNav.ts`, `tests/analytics/graph-nav.test.ts`; geändert `apps/web/src/pages/Stufe2.tsx` (interaktive Knoten + `useNavigate`), `apps/web/src/i18n.ts` (`graph.openNode`/`graph.clickHint` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **99 Dateien / 547 Tests** (+1 Datei, +3 Tests für graphNav). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Bestehender `tests/analytics/graph-layout.test.ts` unverändert grün.

**Restlücken/Nicht-Ziele:** kein Graph-Editor, keine neue Layout-Engine, kein Drag/Zoom/Pan, kein Backend-Umbau, keine Alt-App-Pixel-Parität, keine Fake-Knoten/Kanten. Konflikt-/Tag-Kanten bleiben read-only. Während `useKos()` noch lädt, sind Knoten bewusst (kurz) nicht klickbar — sichere Deaktivierung statt Navigation ins Leere. Die Klickstrecke ist lokal über den Browser-Smoke (`/graph`) prüfbar; die ID-/Navigationslogik ist unit-getestet.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/graphNav.ts tests/analytics/graph-nav.test.ts apps/web/src/pages/Stufe2.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(graph): clickable/keyboard nodes navigate to KO detail /wissen/:id (SCRUM-228)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-229 — Audit-Log als Deep-Link in Analytics auffindbar

**Vorab-Befund (read-only):** Der Audit-Bereich lebt konsolidiert in `Analytics.tsx` (Abschnitt „SCRUM-143: Audit-Log mit Filtern", `<div>`-Wrapper mit `SectionLabel` + Actor/Action/Target-Filter + Audit-Liste über echte Daten). Er hatte **keine** stabile Anker-ID und war nicht verlinkbar. CommandPalette (`shell/CommandPalette.tsx`) leitet ihre Ziele aus `ALL_ITEMS` (navigation.ts) ab. Wichtig: react-router **scrollt nicht automatisch** zu Hash-Ankern beim Navigieren — ein Deep-Link braucht einen kleinen Scroll-Effekt. Audit-Daten kommen aus `useAudit()` (kein Backend-Bezug für diese Aufgabe).

**Umsetzung (kleinster sauberer Eingriff):** (1) Neuer DOM-freier Helper `apps/web/src/lib/analyticsSections.ts` — `ANALYTICS_AUDIT_ANCHOR="analytics-audit"`, `ANALYTICS_AUDIT_PATH="/analytics#analytics-audit"`, `hashToElementId(hash)` (sichere Element-ID aus Location-Hash). (2) Audit-Abschnitt erhält `id={ANALYTICS_AUDIT_ANCHOR}` + `scroll-mt-4` — der Wrapper rendert sofort (unabhängig vom Datenladen), daher ist der Anker stabil vorhanden. (3) Scroll-to-Hash-Effekt in `Analytics` (`useLocation` + `useEffect`): bei vorhandenem Hash `scrollIntoView` nach dem Mount → Deep-Link landet zuverlässig. (4) CommandPalette-Eintrag „Audit-Log (in Analytics)" → `ANALYTICS_AUDIT_PATH`, sichtbar nur, wenn Analytics für die Rolle sichtbar ist (gleiche `canSee`-Logik). **Keine** neue Route/Seite, kein neues Audit-System, kein Audit-Editor, keine Backend-Änderung.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/analyticsSections.ts`, `tests/analytics/analytics-sections.test.ts`; geändert `apps/web/src/pages/Analytics.tsx` (Anker + Scroll-to-Hash), `apps/web/src/shell/CommandPalette.tsx` (Deep-Link-Eintrag, rollen-gated), `apps/web/src/i18n.ts` (`cmd.audit` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **100 Dateien / 550 Tests** (+1 Datei, +3 Tests für analyticsSections). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Bestehender Analytics-/Audit-Renderpfad (SCRUM-143-Filter/Liste) unverändert.

**Restlücken/Nicht-Ziele:** kein neues Audit-System, kein Audit-Editor, keine eigene Audit-Route (Hash-Deep-Link genügt), keine Backend-Änderung, kein Audit-Modell-Umbau, keine Alt-App-Pixel-Parität, keine separate Alt-Audit-Seite wiederhergestellt. Kein Scroll-Spy/aktiver Zustand (bewusst minimal). Direkter Deep-Link `…/analytics#analytics-audit` springt nach dem Laden zum Abschnitt; per ⌘K als „Audit-Log (in Analytics)" auffindbar.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/analyticsSections.ts tests/analytics/analytics-sections.test.ts apps/web/src/pages/Analytics.tsx apps/web/src/shell/CommandPalette.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(analytics): stable audit deep-link anchor + scroll-to-hash + command-palette entry (SCRUM-229)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-230 — Risiko-Seite: Cockpit-Kennzahlen als kompakter Einstieg

**Vorab-Befund (read-only):** `Risk.tsx` hatte bereits eine Sektion „Risiko-Cockpit nach Domäne" (`risk.cockpit`, `domainRisk`-Grid pro Kategorie) sowie Bus-Faktor und die Gap-Liste mit voll funktionsfähigen Aktionen (Priorität via `setPriority`, Zuweisen, Schließen `close`, Löschen `remove`; SCRUM-115-Sortierung via `sortGapsByPriority`). **Es fehlte** ein kompakter, aggregierter Cockpit-Einstieg ganz oben. Die Seite lud **keine** Konflikte (`useConflicts` ungenutzt). Datentypen: `Gap{status:"offen"|"geschlossen", assignee, priority:"hoch"|…}`, `Conflict{status:"offen"|"eskaliert"|"zweitmeinung"|"geloest"}`. Hooks `useGaps`/`useConflicts` vorhanden.

**Umsetzung (kleinster sauberer Eingriff):** Neuer DOM-freier Helper `apps/web/src/lib/riskCockpit.ts` — `buildRiskCockpit(gaps, conflicts)` leitet rein aus vorhandenen Daten ab: offene Lücken, hohe Priorität (offen+hoch), zugewiesen/unzugewiesen (offen), geschlossene Lücken, offene Konflikte (alles außer `geloest`). **Kein Score, keine Engine.** In `Risk.tsx`: `useConflicts()` ergänzt; oben eine kompakte 6er-KPI-Kachelzeile (`risk.summary`), kritische Kennzahlen (hohe Priorität / offene Konflikte > 0) in Warnfarbe. Bestehende Domänen-Cockpit-, Bus-Faktor- und Gap-Sektion inkl. aller Aktionen unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/riskCockpit.ts`, `tests/analytics/risk-cockpit.test.ts`; geändert `apps/web/src/pages/Risk.tsx` (Konflikte-Hook + KPI-Zeile), `apps/web/src/i18n.ts` (`risk.summary` + 6 `risk.kpi*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **101 Dateien / 553 Tests** (+1 Datei, +3 Tests für riskCockpit). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Bestehende Risk-/Gap-/Conflict-Pfade unverändert.

**Restlücken/Nicht-Ziele:** keine neue Risiko-Engine, kein erfundener Score, kein Backend-Umbau, kein Konflikt-Workflow-Umbau, keine Alt-App-Pixel-Parität. Die KPI-Zeile ist rein additiv/abgeleitet; alle Gap-Aktionen (Priorität, Zuweisen, Schließen, Löschen) bleiben voll funktionsfähig. Bei noch ladenden Daten zeigen die Kacheln 0 und füllen sich nach dem Fetch.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/riskCockpit.ts tests/analytics/risk-cockpit.test.ts apps/web/src/pages/Risk.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(risk): compact cockpit summary row from existing gap/conflict data (SCRUM-230)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-231 — Startseite: Hero-Assist-Ersatz durch rollenbasierte „Nächste Schritte"

**Vorab-Befund (read-only):** Der Hero-Assist-Ersatz existiert bereits und ist sauber: `Start.tsx` rendert oben rollenbewusste „Missionen" aus `missionsForRole(role, stufe2)` (`lib/missions.ts`). Diese sind **DOM-frei, rollengesteuert** (Sichtbarkeit ausschließlich über die vorhandene `canSee`-Logik — keine zweite Berechtigungslogik), referenzieren **echte NavItems/Routen** (erfassen/validierung/risiko/fragen/bibliothek, aufgaben-orientiert, max. 4) und tragen je eine kurze Beschreibung (`missions.<id>.desc`). `tests/app/missions.test.ts` deckt Rollenfilter, echte Pfade und 2–4 Missionen ab. **Keine Logiklücke** — die einzige Schwäche war die Wiedererkennbarkeit: Überschrift „Missionen" kommuniziert nicht klar den „nächste Schritte für deine Rolle"-Charakter.

**Umsetzung (kleinster sauberer Eingriff, nur Beschriftung/Text):** `missions.title` zu „Nächste Schritte" / „Next steps" geschärft; neuer erklärender Untertitel `missions.subtitle` („Für deine Rolle empfohlene nächste Schritte — direkt in echte Abläufe, keine Demo." / EN analog), in `Start.tsx` unter der Überschrift gerendert. **Keine** neue Komponente, keine neue Logik, keine Fake-Aufgaben, kein Backend, keine Reasoner-Engine. Der Missions-Helper bleibt unverändert (DOM-frei, rollengesteuert) — daher kein neuer Helper/Test nötig.

**Geänderte/neue Dateien:** geändert `apps/web/src/pages/Start.tsx` (Untertitel + Heading-Abstand), `apps/web/src/i18n.ts` (`missions.title` neu betextet + `missions.subtitle` DE/EN), `docs/qm/claude-after-report.md`. Keine neuen Dateien.

**Tests/Gates:** `npm run check` grün — **101 Dateien / 553 Tests** (unverändert; reine Text-/Label-Änderung, keine neue Logik). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Bestehender `tests/app/missions.test.ts` unverändert grün; Start-KPIs/Todos/EmptyState unberührt.

**Restlücken/Nicht-Ziele:** keine Wiederherstellung von `HeroAssist.jsx`, keine neue Demo-Fläche, keine KI-/Reasoner-Next-Step-Engine, kein Backend-Umbau, keine Alt-App-Pixel-Parität, keine Fake-Aufgaben. Die „Nächsten Schritte" bleiben strikt aus Navigation/Rollenlogik abgeleitet; gezeigt werden nur echte, für die Rolle erlaubte Produktaktionen.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/pages/Start.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(start): reframe role-based missions as explicit next-steps assist (SCRUM-231)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-233 — Ask: Reasoner-Modus sichtbar machen

**Vorab-Befund (read-only):** `Ask.tsx` ist funktional vollständig (Frage → belegte Antwort, Quellen, Vertrauen, Lücken-Pfad), zeigte aber **nicht**, ob die Antwort über ein echtes Modell oder den deterministischen Fallback lief. Der passende Endpoint existiert bereits: `GET /reasoner/status` → `ReasonerStatus { active, provider, mode: "model" | "deterministic" }` (api/types.ts), Hook `useReasonerStatus` vorhanden, bislang in Ask ungenutzt. Backend `services/reasoner` nutzt Anthropic-`primary` nur bei gesetztem `ANTHROPIC_API_KEY`, sonst deterministischen Fallback — exakt dieser Modus soll ehrlich sichtbar werden. **Kein Backend-Bedarf** (Status reicht).

**Umsetzung (kleinster sauberer Eingriff):** Neuer DOM-freier Helper `apps/web/src/lib/reasonerBadge.ts` — `reasonerBadge({status, isLoading, isError})` bildet den Query-Zustand ehrlich auf einen Badge ab: `model`→pos, `deterministic`→warn (kein Fehler), `loading`/`unknown`→neutral und unaufdringlich; liefert `labelKey` (`ask.reasoner.<kind>`). In `Ask.tsx`: `useReasonerStatus()` eingebunden, kleiner Status-Pill neben der Intro-Zeile (Tonskala `REASONER_TONE`), Tooltip via `ask.reasoner.hint`. **Keine** Prompt-/Antwortdaten, keine Provider-Auswahl, kein Token-/Kosten-Accounting, kein Backend-/Engine-Umbau. Der Ask-Flow selbst ist unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/reasonerBadge.ts`, `tests/reasoner/reasoner-badge.test.ts`; geändert `apps/web/src/pages/Ask.tsx` (Status-Hook + Badge), `apps/web/src/i18n.ts` (`ask.reasoner.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **102 Dateien / 557 Tests** (+1 Datei, +4 Tests für reasonerBadge; deckt model/deterministic/loading/unknown ab). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Hinweis: Helper-Signatur `status: … | null | undefined` wegen `exactOptionalPropertyTypes` (Query-`data` ist `ReasonerStatus | undefined`).

**Restlücken/Nicht-Ziele:** keine neue Reasoner-Engine, kein Provider-Switching im UI, kein Prompt-/Antwort-Logging, kein Token-/Kosten-Accounting, kein Backend-Redesign. Der Badge spiegelt nur den read-only Modus; Quellen/Validierung der Antworten bleiben unverändert. Lade-/Fehlerzustand wird neutral statt alarmierend dargestellt (ehrlich, unaufdringlich).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/reasonerBadge.ts tests/reasoner/reasoner-badge.test.ts apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): honest reasoner mode badge (model vs deterministic) from existing status (SCRUM-233)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-234 — Konflikt-Workflow per HTTP-Routentest absichern

**Vorab-Befund (read-only):** Konflikt-Service (`services/conflicts/src/service.ts`) bietet `create/escalate/secondOpinion/resolve/unresolved/get`. HTTP-Oberfläche ist auf zwei Route-Dateien verteilt: `conflicts-routes.ts` (GET `/api/conflicts` ungelöst, GET `/api/conflicts/:id`, POST `/escalate` [conflict.resolve, nur `truth`], POST `/second-opinion` [ko.validate]) und der KO-Dispatcher `ko-routes.ts` (PUT `/api/kos/:id` mit `{action:"conflict"}` → 201 [ko.validate], `{action:"resolve-conflict", conflictId, decision}` → 200 [conflict.resolve]). Bisher gab es nur `services/conflicts/src/service.test.ts` (Service-Direkt) und `tests/conflicts/conflict-view.test.ts` (FE-Helfer) — **kein Route-Level-Test**. Auth-Pattern (register→login→Bearer, Demo-Seed) aus `admin-routes.test.ts`/`learning-path-progress.test.ts` übernommen.

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/conflict-routes.test.ts` über `buildApp`/`app.inject`. (1) Hauptworkflow: Admin-Setup + Demo-Seed → echte KO-IDs → Konflikt anlegen (`PUT /api/kos/:id {action:"conflict", type:"truth"}` → 201, Status `offen`) → in `GET /api/conflicts` enthalten → Zweitmeinung (`POST /second-opinion` → `zweitmeinung`, Opinion gesetzt, im GET verifiziert) → lösen (`PUT … {action:"resolve-conflict"}` → `geloest`, Entscheidung gesetzt, im GET verifiziert) → fällt aus der Ungelöst-Liste. (2) Eskalation: `truth`-Konflikt → `eskaliert`; `context`-Konflikt → ≥400 (NOT_ESCALATABLE, FR-CON-02). (3) Guard: anonym `GET /api/conflicts` → ≥400. **Kein Kopplungsbug gefunden** — alle Routen verhalten sich erwartungsgemäß, daher **kein Produktcode geändert**.

**Geänderte/neue Dateien:** neu `services/app/src/conflict-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **103 Dateien / 560 Tests** (+1 Datei, +3 Konflikt-Route-Tests). Biome + depcruise + tsc (services/tests) sauber. apps/web `tsc --noEmit` nicht nötig (kein FE berührt).

**Restlücken/Nicht-Ziele:** keine Browser-E2E-Suite, kein neuer Konflikt-Workflow, kein Backend-/UI-Redesign, keine neue Persistenz. Nicht abgedeckt (bewusst, da Aufwand/kein Routenpfad): Konflikt-Erzeugung aus dem KO-Detail-FE (nur Datenpfad getestet), sowie reine Pg-Persistenz (In-Memory ist prozesslokal — bestehende Eigenschaft). Der zentrale Status-Workflow (offen→zweitmeinung→geloest, plus Eskalation + Guard) ist jetzt routennah abgesichert.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
git add services/app/src/conflict-routes.test.ts docs/qm/claude-after-report.md
git commit -m "test(conflicts): HTTP route-level workflow (create → second-opinion → resolve, escalate, guard) (SCRUM-234)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-235 — Stufe-2-Funktionen für Admins besser auffindbar machen

**Vorab-Befund (read-only):** Stufe-2-Zugang ist doppelt gated: `effectiveStufe2(role, toggle)` (lib/effectiveRole.ts) liefert den Schalter-Wert **nur** bei `role === "admin"`, sonst `false`. Der Schalter selbst ist die Checkbox `role.stage2` im Sidebar-`RoleSwitcher` (nur bei Admin sichtbar). Die Nav-Gruppe „erweitert" (Items `output/import/graph/kapital`, je `stufe2:true`) erscheint erst, wenn der Schalter AN ist; Routen sind über `canSee` in `routes.tsx` hart gegated (Direktlink bei Schalter AUS → Redirect auf /start). Ergebnis: Ein Admin mit ausgeschaltetem Schalter sieht **keinerlei Hinweis**, dass Kapital/Output/Import/Graph existieren. `Start.tsx` kennt `role`+`stufe2` bereits (Missionen) — idealer Hinweis-Ort.

**Umsetzung (kleinster sauberer Eingriff):** Neuer DOM-freier Helper `apps/web/src/lib/stufe2Hint.ts` — `stufe2HintKind(role, stufe2)` → `"enable"` nur bei Admin + Schalter AUS, sonst `"none"`; `stufe2FeatureLabelKeys()` leitet die Stufe-2-Modul-Labels aus `NAV_GROUPS` ab (keine Hardcodes). In `Start.tsx`: dezente gestrichelte Hinweis-Card **nur** wenn `"enable"` — erklärt, dass erweiterte Funktionen (aus Nav abgeleitete Liste) existieren und über „Stufe 2" in der Seitenleiste eingeblendet werden. **Keine Links** auf die noch gesperrten Routen (kein Dead-Link), **kein** Hinweis für Nicht-Admins (kein falsches Versprechen), **keine** Entsperrung/Rechteänderung. Backend-RBAC und Gating unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/stufe2Hint.ts`, `tests/app/stufe2-hint.test.ts`; geändert `apps/web/src/pages/Start.tsx` (Hinweis-Card), `apps/web/src/i18n.ts` (`start.stufe2.title/body` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **104 Dateien / 564 Tests** (+1 Datei, +4 Tests für stufe2Hint; deckt admin/aus→enable, admin/an→none, Nicht-Admins→none, Label-Ableitung). apps/web DOM-`tsc --noEmit` grün. Biome + depcruise sauber. Sidebar-Schalter, Navigation und Stufe-2-Seiten unverändert.

**Restlücken/Nicht-Ziele:** kein neues Rollen-/Berechtigungsmodell, kein Backend-Umbau, keine neuen Stufe-2-Funktionen/Engine, kein UI-Redesign, keine umgangene Berechtigungslogik. Der Hinweis ist rein orientierend; das Einschalten bleibt eine bewusste Admin-Aktion am vorhandenen Schalter. Bei Schalter AN erscheint kein Hinweis (Navigation zeigt die Gruppe bereits).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/stufe2Hint.ts tests/app/stufe2-hint.test.ts apps/web/src/pages/Start.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(start): honest admin-only Stage-2 discoverability hint (no unlock, no fake links) (SCRUM-235)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-236 — Erfassen: fehlende Sprach-API ehrlich anzeigen

**Vorab-Befund (read-only):** Diktat nutzt die Web-Speech-API (`SpeechRecognition`/`webkitSpeechRecognition`) — Erkennung bislang **inline** in `Capture.tsx` via `speechCtor()` + `const speechSupported = Boolean(speechCtor())` (Zeile 124), DOM-gekoppelt und **untestbar**. Im Diktat-Modus war der Negativzustand bereits teilweise ehrlich: bei `speechSupported` erscheint der Mic-Button (`toggleDictation`), sonst ein Warnhinweis `capture.diktatUnsupported` — also **kein** stiller Button (der Button rendert nur bei Support; `toggleDictation` hatte zusätzlich einen `if (!Ctor) return`-Guard). Lücken: (1) Feature-Detection nicht DOM-frei/getestet (genau der Ticket-Auftrag), (2) der Diktat-**Modus-Tab** signalisierte die Nichtverfügbarkeit erst nach Auswahl. **Interview** nutzt den Reasoner per Text (`endpoints.reasoner.interview`), **keine** Sprach-API → nicht betroffen. Freitext/Formular/Upload/Strukturieren/Speichern hängen nicht an Speech. **Kein Backend-Change nötig (bestätigt).**

**Umsetzung (kleinster sauberer Eingriff):** Neuer DOM-freier Helper `apps/web/src/lib/speechSupport.ts` — `hasSpeechRecognition(win: unknown)` narrowt selbst auf die beiden optionalen Konstruktoren (akzeptiert `window` ohne Cast, testbar mit Fake-Objekten). In `Capture.tsx`: `speechSupported = hasSpeechRecognition(window)` statt Inline-`Boolean(speechCtor())`; der Diktat-Modus-Tab trägt jetzt bei fehlender API einen `title` (voller Hinweis) plus sichtbaren Suffix „· nicht verfügbar" (`capture.diktatNa`). Der bestehende In-Modus-Warnhinweis + gegateter Mic-Button bleiben. **Keine Fake-Diktatfunktion, kein Cloud-STT, kein Backend, kein Interview-Redesign.** Manuelle Eingabe, Upload, Strukturieren, Interview-Textfluss und Speichern unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/speechSupport.ts`, `tests/capture/speech-support.test.ts`; geändert `apps/web/src/pages/Capture.tsx` (Helper-Nutzung + Tab-Hinweis), `apps/web/src/i18n.ts` (`capture.diktatNa` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **105 Dateien / 568 Tests** (+1 Datei, +4 Tests: Standard-/webkit-/keine-API/null-window). apps/web DOM-`tsc --noEmit` grün (Helper auf `unknown` umgestellt wegen `exactOptionalPropertyTypes` beim Übergeben von `window`). Biome + depcruise sauber.

**Restlücken/Nicht-Ziele:** kein neues Speech-to-Text-System, kein Cloud-STT, kein Backend-Audio-Upload, kein Interview-Redesign, keine Alt-App-Parität. Der `speechCtor()` (Instanziierung in `toggleDictation`) bleibt unverändert; nur die Verfügbarkeitsprüfung ist jetzt ausgelagert/getestet. Echtes Mikrofon-Verhalten ist umgebungsabhängig und nur im Browser testbar — die reine Verfügbarkeitslogik ist unit-abgedeckt.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-237 — Validierung: HTTP-Workflow routennah absichern

**Vorab-Befund (read-only):** Zuweisen UND Bewerten laufen über den **KO-Dispatcher** `PUT /api/kos/:id` — `{action:"assign", userIds}` (Permission `ko.assign`) und `{action:"rate", verdict:"up"|"warn"|"down"}` (Permission `ko.validate`). Lese-Sichten: `GET /api/validation/board` (offene KOs) und `GET /api/validation/overview` (offen/erledigt je Nutzer), beide `ko.read`. RBAC (`services/rbac/src/policy.ts`): `ko.validate`/`ko.assign` haben **nur controller + admin**; experte nur `ko.create`. Status/Trust-Regeln (`services/validation/src/trust.ts`, bestätigt durch `service.test.ts`): `trust = clamp(round((up-down)/max(needed,1)*100))`, Status `"validiert"` **nur** bei `up >= neededValidations` UND `down === 0`; Bewertungen sind **pro Nutzer** (Upsert) → `needed` distinkte Validatoren nötig. KO-Default `neededValidations = 3` (1–5 erlaubt, im Body setzbar). Coverage bislang: nur `services/validation/src/service.test.ts` (Service-Direkt) + FE — **kein Route-Level-Test**. **Kein Produktbug** — ein Route-Level-Smoke genügt.

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/validation-routes.test.ts` über `buildApp`/`app.inject`, ohne Repo-Manipulation. Setup: Admin registrieren/login + Demo-Seed (legt Carla=controller, Erik=experte an), IDs via `GET /api/auth/me`. (1) Hauptpfad: KO erstellen (`neededValidations:2`, offen/trust 0) → an Carla+Erik zuweisen (204) → Overview zeigt offene Zuweisung → Erik (experte) `rate up` → ≥400 (Guard) → Admin `up` → bleibt offen (1<2) → Carla `up` → `validiert`, trust 100; Carlas Zuweisung ist danach `done`. (2) Eine rote Bewertung: Admin `up` + Carla `down` → trotz grüner Bewertung **nicht** validiert, trust 0. (3) Guards: anonym `rate` → ≥400; `rate` auf unbekanntes KO → ≥400 (NOT_FOUND). **Kein Produktcode geändert.**

**Geänderte/neue Dateien:** neu `services/app/src/validation-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **106 Dateien / 571 Tests** (+1 Datei, +3 Validierungs-Route-Tests). Biome + depcruise + tsc (services/tests) sauber. apps/web `tsc --noEmit` nicht nötig (kein FE berührt). Bestehende Service-/FE-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** kein neues Validierungsmodell, kein Status-Redesign, kein Browser-E2E, kein UI-Redesign, keine Alt-App-Parität. Nicht abgedeckt (bewusst): „warn"/return-to-author-Pfad (SCRUM-124) und Pg-Persistenz (In-Memory prozesslokal). Der Kern-Datenpfad Zuweisen→Bewerten→Status/Trust inkl. Guard-/Negativfällen ist jetzt routennah abgesichert.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-238 — Import/Review: HTTP-Workflow routennah absichern

**Vorab-Befund (read-only):** Drei HTTP-Routen (`services/app/src/routes/library-routes.ts`): **Kandidaten erzeugen** `POST /api/library/import/candidates` `{items: ImportItem[]}` → Permission `ko.create` → **201**, liefert `ImportCandidate[]` (Status `"neu"`, `duplicate`-Flag aus `title|statement`-Abgleich gegen Bestand, `koId: null`). **Listen** `GET /api/library/import/candidates` → `ko.read`. **Prüfen** `PUT /api/library/import/candidates/:id` `{action: "accept"|"reject"|"info", note?}` → `ko.validate`. Service-Regeln (`library-analytics/src/service.ts`): `accept` einer **Nicht-Dublette** ruft `koService.create(...)` → echtes KO im normalen Fluss (Status `"offen"`), `candidate.koId` = neue KO-ID, Status `"angenommen"`; **Dublette**-accept → `"angenommen"` aber `koId` bleibt `null` (kein KO); `reject` → `"abgelehnt"`; `info` → `"info-angefragt"` + Note; erneutes Prüfen (Status ≠ `"neu"`) → `ALREADY_REVIEWED`; unbekannte ID → `NOT_FOUND`. Coverage bislang: nur `library-analytics/src/service.test.ts` (Service) + FE-`importReview`-Helfer — **kein Route-Level-Test**. **Kein Produktbug** — Route-Level-Smoke genügt.

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/import-review-routes.test.ts` über `buildApp`/`app.inject`, ohne Repo-Manipulation. Setup: Admin registrieren/login + Demo-Seed (für Erik=experte als Review-Guard). (1) Hauptpfad: 2 Kandidaten erzeugen (201, `neu`/keine Dublette/`koId` null) → Liste enthält sie → Erik (experte) `accept` → ≥400 (Guard) → Admin `accept` → `angenommen`, `koId` gesetzt → `GET /api/kos/:koId` liefert echtes KO (Titel passt, Status `offen`) → erneutes Prüfen → ≥400 (ALREADY_REVIEWED). (2) `reject` → `abgelehnt`/koId null; `info` + Note → `info-angefragt` + Note. (3) Dublette: erst echtes KO anlegen, dann gleicher Inhalt als Kandidat → `duplicate:true`, accept → `angenommen` aber `koId` null (kein neues KO). (4) Guards: anonym `POST` → ≥400; Review auf unbekannte ID → ≥400. **Kein Produktcode geändert.**

**Geänderte/neue Dateien:** neu `services/app/src/import-review-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **107 Dateien / 575 Tests** (+1 Datei, +4 Import-Review-Route-Tests). Biome + depcruise + tsc (services/tests) sauber (kleiner Test-Typfix: `created[0]/[1]` explizit getypt wegen `noUncheckedIndexedAccess`). apps/web `tsc --noEmit` nicht nötig (kein FE berührt). Bestehende Service-/FE-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** kein neuer Import-Parser, kein OCR-/PDF-/DOCX-Umbau, kein Browser-E2E, kein UI-Redesign, keine Alt-App-Parität. Nicht abgedeckt (bewusst): FE-JSON-Datei-Parsing (`parseImportItems`, separat im Lib-Test) und Pg-Persistenz (In-Memory prozesslokal). Der Kern-Datenpfad Erzeugen→Listen→Accept(→echtes KO)/Reject/Info inkl. Dublette-, Guard- und ALREADY_REVIEWED-Fällen ist jetzt routennah abgesichert.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-239 — Output Factory: HTTP-Workflow routennah absichern

**Vorab-Befund (read-only):** Zwei HTTP-Routen (`services/app/src/routes/output-routes.ts`): **Quellen** `GET /api/output/sources` → Permission `ko.read` → `listEligible()` = `koService.list({status:"validiert"})` → nur validierte KOs als `OutputSource`. **Generieren** `POST /api/output/generate` `{kind, koIds, audienceRole?}` → `ko.read`. Erlaubte Typen (`OUTPUT_KINDS`): `instruction`, `checklist`, `troubleshooting`, `training`, `management_summary`. `generate` (services/output/src/service.ts): prüft Typ (`UNKNOWN_KIND`), nicht-leere koIds (`NO_SOURCES`), je KO Existenz (`UNKNOWN_KO`) und Status `validiert` (`NOT_VALIDATED`); iteriert koIds **in Reihenfolge** → Renderer nummerieren entsprechend, Provenance in derselben Ordnung. **Provenance** je Quelle: `koId, title, status("validiert"), trust, version, author, originalAuthor, category, type, validity (abgeleitet, kein Ablaufdatum), uncertain (trust<60)`. `OutputError`-Codes werden über `sendError` zu ≥400 gemappt. Coverage bislang: nur `services/output/src/service.test.ts` (Service) + FE (`outputComposition`/`outputDoc`) — **kein Route-Level-Test**. **Kein Produktbug** — Route-Level-Smoke genügt.

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/output-routes.test.ts` über `buildApp`/`app.inject`, ohne Repo-Manipulation. Setup: Admin + Demo-Seed (Carla=controller als zweiter Validator); validierte KOs werden **über echte HTTP-Aktionen** vorbereitet (`POST /api/kos` mit `neededValidations:2` → Admin+Carla je `PUT …{action:"rate",verdict:"up"}` → Status „validiert" per GET bestätigt). (1) Hauptpfad: `GET /api/output/sources` enthält die zwei validierten, **nicht** das offene KO, alle `status==="validiert"`; `POST …/generate {kind:"instruction", koIds:[koB,koA]}` → 200, `doc.kind==="instruction"`, nicht-leeres Markdown, **Provenance exakt in Reihenfolge [koB,koA]** mit strukturierten Feldern (status/validity/trust/version/uncertain), Markdown enthält beide Titel und respektiert die Reihenfolge (Beta vor Alpha). (2) Negativfälle: nicht-validiert (`NOT_VALIDATED`), unbekanntes KO (`UNKNOWN_KO`), leere Auswahl (`NO_SOURCES`), unbekannter Typ (`UNKNOWN_KIND`) → je ≥400. (3) Guard: anonym darf weder Quellen lesen noch generieren → ≥400. **Kein Produktcode geändert.**

**Geänderte/neue Dateien:** neu `services/app/src/output-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **108 Dateien / 578 Tests** (+1 Datei, +3 Output-Route-Tests). Biome + depcruise + tsc (services/tests) sauber (Test-Helper-Param `Record<string, unknown>` statt `unknown` wegen Inject-Payload-Typ). apps/web `tsc --noEmit` nicht nötig (kein FE berührt). Bestehende Service-/FE-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** kein neuer Output-Typ, kein PDF-Export, keine Output-Persistenz, kein Browser-E2E, kein UI-Redesign, keine Alt-App-Parität. Nicht abgedeckt (bewusst): typ-spezifische Markdown-Feinheiten je Renderer (Service-getestet) und FE-Copy/Download (DOM-only). Der Kern-Datenpfad Eligible→Generate(Typ+geordnete Provenance) inkl. aller Negativ-/Guardfälle ist jetzt routennah abgesichert.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-240 — Management Snapshot: HTTP-Endpoint routennah absichern

**Vorab-Befund (read-only):** Eine HTTP-Route (`services/app/src/routes/management-routes.ts`): `GET /api/management/snapshot` → Permission `ko.read` → `ManagementService.snapshot()`. **Live-Datenquellen** (parallel aggregiert): `koService.list({})`, `listGaps()` (→ offene Gaps), `countOpenConflicts()`, `pendingRevalidation()` (Lifecycle), `busFactor()`. Reine Metriken in `metrics.ts#computeSnapshot`. **Strukturierte Bereiche** (`types.ts ManagementSnapshot`): `generatedAt, overview, capital, valuationFacts, statement, maturity, priorities[], recommendations[], house[], pilot[]`. **Echte Aggregate**: overview-Zähler (totalKos/validated/open/openGaps/openConflicts), `avgTrust` (Mittel über KO-Trust, gerundet), `valuationFacts` (validatedKos/totalKos/avgTrust — reine Fakten), `house[].koCount/validatedRatio`, `pilot[].created/validated` (30/60/90-Fenster über `createdAt`), `statement.assets` (= validierte). **Abgeleitet/Modell**: healthScore/healthBand, `capital.score`+parts (gewichtet), `maturity.stage`, `priorities`-Scores, `recommendations`, `statement.net`-Index. Der **€-Wert ist NICHT im Snapshot** (entsteht erst im FE über offengelegte Annahmen — keine Bilanzbewertung). Coverage bislang: nur `service.test.ts`/`metrics.test.ts` (Service) + FE — **kein Route-Level-Test**. **Kein Produktbug** — Route-Level-Smoke genügt.

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/management-routes.test.ts` über `buildApp`/`app.inject`, **bewusst ohne Demo-Seed**, damit Aggregate exakt aus dem über HTTP erzeugten Bestand stammen (keine Beispielzahlen). (1) Leerer Bestand: Snapshot enthält alle 10 Bereiche, `pilot` hat Länge 3, `capital.parts` ist Array; Aggregate sind echte Nullen (totalKos/validated/avgTrust/openGaps/openConflicts = 0). (2) Realer Bestand: 3 KOs anlegen (`neededValidations:1`), 2 via `PUT …{action:"rate",verdict:"up"}` validieren → Snapshot spiegelt exakt: `overview.totalKos=3, validated=2, open=1, avgTrust=67` (=round((100+100+0)/3)); `valuationFacts={validatedKos:2,totalKos:3,avgTrust:67}`; `statement.assets=2`, `net`∈[0,100]; `house`-Etage „Mgmt 240" `koCount=3`; `pilot[0]` (30 Tage) `created=3,validated=2`; `capital.score`∈[0,100], `maturity.stage`∈[1,5]. (3) Guard: anonym → ≥400. **Kein Produktcode geändert.**

**Geänderte/neue Dateien:** neu `services/app/src/management-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **109 Dateien / 581 Tests** (+1 Datei, +3 Management-Snapshot-Route-Tests). Biome + depcruise + tsc (services/tests) sauber. apps/web `tsc --noEmit` nicht nötig (kein FE berührt). Bestehende Service-/FE-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine neue Management-Engine, keine Bilanzbewertung, kein UI-Redesign, kein Browser-E2E, keine Alt-App-Parität. Nicht abgedeckt (bewusst): exakte Werte der abgeleiteten Modellfelder (health/capital/maturity/priorities — in `metrics.test.ts` service-getestet, hier nur Wertebereich), Gap-/Conflict-/Lifecycle-Einfluss im Detail (KO-getriebene Aggregate sind voll geprüft) und Pg-Persistenz (In-Memory prozesslokal). Der Kern-Datenpfad GET-Snapshot inkl. echter Live-Aggregation (leer vs. realer Bestand) und Guard ist jetzt routennah abgesichert.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-241 — External Search: HTTP-Endpoint routennah absichern

**Vorab-Befund (read-only):** Eine HTTP-Route (`services/app/src/routes/external-routes.ts`): `GET /api/external/search?q=` → Permission `ko.read`. Ist der Proxy nicht konfiguriert (`services.externalSearch === undefined`), antwortet die Route mit **501 `EXTERNAL_SEARCH_DISABLED`**; sonst `200` mit `await search.search(q ?? "")`. **Aus-Verdrahtung:** `createExternalSearchFromEnv()` (build-app `assembleServices`) liefert bei `EXTERNAL_SEARCH=off` `undefined` → Route-501. **Service** (`external-search/src/service.ts`): `search(q)` trimmt; **leere Query → `[]` ohne Provider-Call** (also kein 4xx, sondern `200` + leeres Array — ehrliche Nuance ggü. der Ticket-Formulierung „abgewiesen"); sonst `provider.search(q)` auf `MAX_RESULTS=10` begrenzt. **Ergebnisfelder** `ExternalResult`: `title, url, snippet, provider`. **Injection ohne Live-Netz:** `buildApp(services)` nimmt `AppServices`; `externalSearch` ist `ExternalSearchService | undefined` und überschreibbar → Fake-`SearchProvider` (oder injizierter Fetch via `createWikipediaProvider({fetchImpl})`). `ExternalSearchService`/`SearchProvider`/`ExternalResult`/`ExternalSearchError` sind aus dem Modul exportiert. Provider-Fehler werden via `sendError` zu ≥400 gemappt. Coverage bislang: `service.test.ts` + `wikipedia.test.ts` (Service/Provider) + FE (`externalKnowledge`/`externalSearch`) — **kein Route-Level-Test**. **Kein Produktbug** — Route-Level-Smoke genügt (die Leerquery-Nuance ist bewusstes Design, FE sperrt den Submit).

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/external-routes.test.ts` über `buildApp`/`app.inject` mit **Fake-Provider** (Aufrufzähler, kein Netzwerk), injiziert über die bestehende `services.externalSearch`-Seam — keine Test-Seam im Produktcode nötig. (1) Autorisierte Suche `?q=ventil` → 200, strukturierte Treffer (`title/url/snippet/provider`), Provider 1× aufgerufen. (2) Leere/whitespace-Query → 200 `[]`, **0 Provider-Calls** (ehrlich, kein Fake-Treffer). (3) Deaktiviert (`externalSearch=undefined`) → **501 `EXTERNAL_SEARCH_DISABLED`**. (4) Provider-Fehler (`ExternalSearchError`) → ≥400 (kein 200 mit Müll). (5) Guard: anonym → ≥400, Provider 0× aufgerufen. **Kein Produktcode geändert, kein Live-Netzwerk.**

**Geänderte/neue Dateien:** neu `services/app/src/external-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **110 Dateien / 586 Tests** (+1 Datei, +5 External-Search-Route-Tests). Biome + depcruise + tsc (services/tests) sauber. apps/web `tsc --noEmit` nicht nötig (kein FE berührt). Bestehende Service-/FE-Tests unverändert grün. Kein Test macht Live-Netzwerkzugriffe.

**Restlücken/Nicht-Ziele:** kein neuer Provider, kein Auto-Import, keine Peer-Validierung, kein Browser-E2E, kein UI-Redesign, keine Alt-App-Parität. Nicht abgedeckt (bewusst): echtes Wikipedia-HTML-Parsing (`wikipedia.test.ts` mit injiziertem Fetch service-getestet) und das `MAX_RESULTS`-Limit im Detail (Service-getestet). **Befund-Nuance dokumentiert:** Leerquery wird per leerem Array (200) statt 4xx behandelt — bewusstes Design, kein Bug. Der Kern-Datenpfad (Treffer/leer/501/Fehler/Guard) ist jetzt routennah ohne Live-Netz abgesichert.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-242 — Ask: HTTP-Workflow routennah absichern

**Vorab-Befund (read-only):** Routen (`services/app/src/routes/ask-routes.ts`): **Frage** `POST /api/ask` `{question, locale?}` → Permission `ko.read` → `200` mit `AskResult { result: AnswerResult, gap: Gap|null }`. **Helpful** `POST /api/ask/helpful` `{koId}` → `ko.read` → `204` (Trust +2, gedeckelt auf 100; unbekanntes KO → NOT_FOUND). **Gaps** `GET /api/gaps` → `ko.read`; `PUT /api/gaps/:id` (Priorität/close/assign) → `ko.assign`; `DELETE /api/gaps/:id?confirm=true` → `ko.validate`. **Antwortform** `AnswerResult`: `answered, answer(string|null), knowledgeClass, trust, sources[], steps[], demo`. **Gap-Entstehung**: in `AskService.ask` ruft der Reasoner über alle KOs als `KnowledgeRef`; bei `answered === false` → `createGap(question)` (Status „offen", Priorität „mittel") + Rückgabe in `AskResult.gap`. Der deterministische Reasoner (`DeterministicProvider.answer` → `keywordSelect`/`tokenize`/`overlap`) antwortet, wenn die Frage ein Token (Länge >2) mit `title+statement` eines KO teilt; sonst keine Rateantwort. **Helpful** erhöht `ko.trust` um 2 + Audit. Coverage bislang: `services/ask/src/service.test.ts` (Service) + `build-app.test.ts` (breiter Smoke berührt /api/ask & /api/gaps) + FE (`askResponse`/`helpfulSignal`) — **kein dedizierter Ask-Route-Test**. **Kein Produktbug** — Route-Level-Smoke genügt.

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/ask-routes.test.ts` über `buildApp`/`app.inject`, **bewusst ohne Demo-Seed**, damit das Keyword-Matching kontrollierbar ist. (1) Treffer: KO mit distinktivem Stichwort („Zylinderkopfdichtung XQ42") via HTTP anlegen + per `rate up` (needed=1) validieren → Frage mit demselben Stichwort → `answered:true`, `sources` enthält die koId, `knowledgeClass:"gesichert"`, `answer` String, `steps`≥1, `gap:null`, `GET /api/gaps` leer. (2) Wissenslücke: leerer Bestand → Frage matcht nichts → `answered:false`, `sources` leer, `gap` gesetzt (`status:"offen"`, `question` exakt), in `GET /api/gaps` auffindbar. (3) Helpful: KO (Trust 0) → `POST /api/ask/helpful` → 204 → `GET /api/kos/:id` zeigt Trust 2; unbekanntes KO → ≥400. (4) Guards: anonym auf `/api/ask`, `/api/ask/helpful`, `/api/gaps` → je ≥400. **Kein Produktcode geändert.**

**Geänderte/neue Dateien:** neu `services/app/src/ask-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **111 Dateien / 590 Tests** (+1 Datei, +4 Ask-Route-Tests). Biome + depcruise + tsc (services/tests) sauber. apps/web `tsc --noEmit` nicht nötig (kein FE berührt). Bestehende Service-/FE-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** kein neuer Reasoner, kein RAG-/Vector-DB-Umbau, keine Antwortmodell-Änderung, kein Browser-E2E, kein UI-Redesign, keine Alt-App-Parität. Nicht abgedeckt (bewusst): echtes Modell (Anthropic-`primary`, nur mit Key; hier deterministischer Fallback — derselbe Vertrag), Gap-Verwaltung im Detail (Priorität/close/assign/delete — service-getestet) und Pg-Persistenz (In-Memory prozesslokal). Der Kern-Datenpfad Frage→Antwort+Quelle / unbeantwortbar→Gap / Helpful inkl. Guard-/Negativfällen ist jetzt routennah abgesichert.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-243 — Capture/KO-Erstellung: HTTP-Workflow mit Attachment/Evidence absichern

**Vorab-Befund (read-only):** **KO-Erstellung** `POST /api/kos` → Permission `ko.create` → 201; Payload-Felder (`CreateKoInput`): `title, statement, type, category` (Pflicht) + optional `conditions, measures, tags, confidence, neededValidations(1–5), asset, bodyHtml`; Autor wird **serverseitig** aus der Session gesetzt; Rückgabe-Basis: `id, status:"offen", trust:0, version:1, author, originalAuthor, …`. **Object-Store** (`object-routes.ts`): `POST /api/objects {name,mime,data,kind?}` → `ko.create` → 201 `ObjectRef` (nur Metadaten); `GET /api/objects/:id` & `GET /api/objects/:id/raw` → `ko.read` → roh dekodierte Bytes (Content-Type aus Ref) bzw. 404/415. **Anhängen** über den KO-Dispatcher `PUT /api/kos/:id`: `{action:"attach", attachment:{name,mime,objectId|dataUrl,thumbnail?,size?}}` (`ko.create`) und `{action:"add-source", source:{label,url?,excerpt?,provider?}}` (`ko.create`, Label Pflicht). **EvidenceRecords** (`knowledge-object/src/service.ts`): `addSource` schreibt **immer** `kind:"source"` (label/url/provider/sourceId/koVersion/createdBy/createdAt); `addAttachment` schreibt `kind:"attachment"` **nur bei gesetztem `objectId`** (Object-Store-Referenz), Inline-`dataUrl` erzeugt keine Evidence. Das Evidence-Repo ist optional, aber `buildServices()` (InMemory) wiret `InMemoryEvidenceRepo` → Evidence wird erzeugt und ist über `GET /api/kos/:id/evidence` (`ko.read`) sichtbar. Coverage bislang: `knowledge-object`/`object-store` `service.test.ts` (Service) + FE — **kein Route-Level-Test für den Capture→Attachment→Evidence-Pfad**. **Kein Produktbug** — Route-Level-Smoke genügt.

**Umsetzung (nur Test, kein Produktcode):** Neuer Route-Level-Test `services/app/src/capture-attachment-routes.test.ts` über `buildApp`/`app.inject`, ausschließlich HTTP. (1) KO-Create → 201 mit erwarteten Basisfeldern (id/title/statement/type/category/status `offen`/trust 0/version 1/author). (2) Object-Pfad: PNG-Data-URL via `POST /api/objects` → 201 `ObjectRef`; `GET …/raw` → 200, Content-Type `image/png`; `PUT …{action:"attach", attachment.objectId}` → 200, Attachment am KO; `GET /api/kos/:id/evidence` enthält `kind:"attachment"` mit `objectId`+`label`. (3) `add-source` → 200, Source (`kind:"external"`, `peerValidated:false`); Evidence `kind:"source"` mit `label/url/provider`. (4) Guards/Fehler: anonym (KO-Create/Object-Upload/raw) → ≥400; `add-source` ohne Label → 400; unbekanntes Objekt (auth) → 404. **Kein Produktcode geändert.**

**Geänderte/neue Dateien:** neu `services/app/src/capture-attachment-routes.test.ts`; geändert `docs/qm/claude-after-report.md`. Kein Produktcode, kein FE.

**Tests/Gates:** `npm run check` grün — **112 Dateien / 594 Tests** (+1 Datei, +4 Capture/Attachment/Evidence-Route-Tests). Biome + depcruise + tsc (services/tests) sauber. apps/web `tsc --noEmit` nicht nötig (kein FE berührt). Bestehende Service-/FE-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** kein neuer Upload-Parser, kein OCR-/PDF-/DOCX-Umbau, kein Browser-E2E, kein UI-Redesign, keine Alt-App-Parität. Nicht abgedeckt (bewusst): Inline-`dataUrl`-Anhang (legacy, erzeugt absichtlich keine Evidence), `MAX_ATTACHMENTS`-/Größen-Limits (service-/route-validiert, hier nicht durchgespielt) und Pg-/persistenter Object-Store (In-Memory prozesslokal). Der Kern-Datenpfad Capture→KO→Object/Attachment/Source→Evidence inkl. raw-Auslieferung und Guard-/Negativfällen ist jetzt routennah abgesichert.

Kein Git, kein Commit/Push, kein Jira durch Claude. No tickets closed. No new tickets.

---

## SCRUM-244 — Demo-Datensatz: reale Review-/Demo-Flows sichtbar machen

**Vorab-Befund (read-only):** Der Seed (`services/app/src/seed-demo.ts`) erzeugt schon AUSSCHLIESSLICH über echte Services (`auth/ko/validation/ask/conflicts/lifecycle/objects`) einen ehrlichen Bestand: 5 KOs, 1 validiertes (koValid, 2× grün), 1 offene Validierungs-/Review-Aufgabe (koOpen Carla zugewiesen), 1 priorisierte Gap (Ask „hoch"), 1 Wahrheitskonflikt (Vorwärmung), 1 pending Revalidation (`lifecycle.couple`+`assetChanged`), Lernpfade für experte/controller/admin, 1 Attachment via Object-Store + Attachment-Evidence. Guards: `seedDemo` (needsSetup + leere KB), `seedDemoForAdmin` (leere KB), idempotent (zweiter Lauf → `EMPTY_RESULT`), produktionsgeschützt (kein Auto-Start). **Zwei Akzeptanz-Lücken**: (1) nur **1** validiertes KO statt ≥2; (2) koValid trug nur ein **Attachment**, keine **Quelle** → keine „source"-Evidence. Alles andere war bereits erfüllt. Bestehende Tests (`seed.test.ts`, `admin-routes.test.ts`) nutzen `>=`-Schwellen → additivverträglich.

**Umsetzung (nur echte Services, keine Repo-Inserts):** In `buildDemoContent`: (1) `koFilter` als Variable erfasst und über `validation.rate(koFilter, carla, "up")` + `(…, admin, "up")` zu einem **zweiten validierten, output-fähigen KO** gemacht. (2) `validation.rate(koWarm, admin, "up")` → ein KO mit **mittlerem Trust** (≈50, bleibt „offen" = in Prüfung) → echte Trust-Varianz (100/50/0). (3) `ko.addSource(koValid, erik, {label, url, excerpt, provider})` → koValid trägt jetzt **Quelle UND Anhang**, der Evidence-Stand enthält beide Arten (`kind:"source"` + `kind:"attachment"`). (4) `SeedResult`/`EMPTY_RESULT` um das Feld `sources` (Zähler aus echten KO-Reads) ergänzt. Guards/Idempotenz/Produktionsschutz unverändert. **Keine** UI-Neugestaltung, **kein** neues Backend-Modell, **keine** Repo-Manipulation.

**Geänderte/neue Dateien:** geändert `services/app/src/seed-demo.ts` (2. Validierung, Teil-Review, addSource, `sources`-Feld), `services/app/src/seed.test.ts` (Assertions: `validated≥2`, `sources≥1`, Trust-Varianz, KO mit Quelle+Anhang + beide Evidence-Arten), `docs/qm/claude-after-report.md`. Kein FE.

**Tests/Gates:** `npm run check` grün — **112 Dateien / 594 Tests** (seed.test um 5 Assertions erweitert; `admin-routes.test`/`learning-path-progress.test` weiter grün). apps/web `tsc --noEmit` grün (FE-`DemoSeedResult` ist hand-getippt und ignoriert das additive `sources`-Feld — kein FE berührt). Biome + depcruise sauber.

**Restlücken/Nicht-Ziele:** keine direkten Repo-Inserts, kein Auto-Start, Produktionsschutz/Idempotenz unverändert, keine UI-Neugestaltung, kein Browser-E2E, kein neues Backend-Modell, keine Knowledge-OS-Metamorphose-Dokumente, keine weitere HTTP-/Audit-Ticketserie. Nach dem Seed sichtbar: ≥2 validierte/output-fähige KOs, ≥1 KO mit Quelle+Attachment+Evidence (beide Arten), offene Review-Aufgabe (MyTasks/Validation), priorisierte Gap (Risk/Ask), Konflikt (Risk/Graph/Conflict), pending Revalidation (Lifecycle), Lernpfade, Trust-Varianz (in Prüfung). Nicht erweitert (bewusst): mehrstufige Konflikt-Lösung/Zweitmeinung und Lernpfad-Fortschritt (separat route-getestet).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
git add services/app/src/seed-demo.ts services/app/src/seed.test.ts docs/qm/claude-after-report.md
git commit -m "feat(seed): 2nd validated KO + source+attachment evidence + trust variance in demo seed (SCRUM-244)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-245 — Bibliothek: Suche produktnäher machen ohne große Sucharchitektur

**Vorab-Befund (read-only):** `Library.tsx` holt Treffer über den **Server-Such-/Filterpfad** `useLibrarySearch(buildLibraryQuery(filter))` → `GET /api/library/search` (`library-analytics/src/service.ts#search`: filtert `q` als Substring auf **title ODER statement** + KoFilter type/status/category/tag) und rendert sie **unsortiert** in Empfangsreihenfolge, danach `windowList` (Limit 200, SCRUM-158). Vorhandene DOM-freie Helfer: `libraryQuery` (Query-Builder), `libraryDisplay` (Fenster/Limit), `libraryExport` (Export). Aktionen: Export (JSON/MD/MediaWiki/HTML), Re-Import-Link, KO-Detail-Links (`/wissen/:id`), Revalidieren, Facetten-Filter. **Lücke**: keine nachvollziehbare Relevanz-Sortierung, keine sichtbaren Match-Gründe, generischer Leerzustand. `tests/library/*` decken Query/Display/Export ab. **Kein Produktbug** — nur Produktreife-Hebel.

**Umsetzung (DOM-frei, keine neue Suchmaschine):** Neuer Helfer `apps/web/src/lib/librarySearch.ts` — `searchLibrary(kos, query)` **re-rankt** die bereits gelieferten Treffer (verwirft nichts) nach transparentem Substring-/Token-Score: **Titel (6/Token 3) > Tag (3) / Kategorie (2) / Wissensart (2) > Text/Statement (2/1)**; Tie-Breaker **nur** Status (validiert zuerst) → Trust desc → Titel → ID (deterministisch). `scoreKo` liefert zusätzlich die **Match-Gründe** (`title/tag/category/type/text`) in Prioritätsreihenfolge. Leere/whitespace-Query → Score 0 → stabile Default-Ordnung, keine Match-Gründe. In `Library.tsx`: Treffer werden vor `windowList` re-gerankt; je Zeile ein kompakter **„Treffer in: Titel/Tag/…"**-Hinweis (nur bei aktiver Suche); **query-bewusster ehrlicher Leerzustand** (`lib.emptyQuery` mit Tipp). **Keine** Vector-/RAG-/semantische Suche behauptet, **keine** Fake-Treffer, Export/Filter/KO-Links/Limit/Revalidieren unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/librarySearch.ts`, `tests/library/library-search.test.ts`; geändert `apps/web/src/pages/Library.tsx` (Re-Rank + Match-Hints + Leerzustand), `apps/web/src/i18n.ts` (`lib.match.*` + `lib.matchIn` + `lib.emptyQuery` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **113 Dateien / 601 Tests** (+1 Datei, +7 librarySearch-Tests: Titel>Text, Match-Gründe+Reihenfolge, Tag/Kategorie/Typ-Signale, Trust/Status nur Tie-Break, leere Query/Default-Ordnung, verwirft nichts, deterministisch). apps/web `tsc --noEmit` grün. Biome + depcruise sauber. Bestehende `tests/library/*` (query/display/export/revalidation) unverändert grün.

**Restlücken/Nicht-Ziele:** keine Vector-DB, keine RAG-/Reasoner-Suche, kein neues Backend-Großmodell, kein Bibliotheks-Redesign, keine neue Ticketserie, keine weiteren HTTP-Smoke-/Audit-Tickets. Bewusst: das Re-Ranking arbeitet auf der **Server-gefilterten Menge** (Server matcht q weiterhin auf title/statement) — Tag-/Kategorie-/Typ-only-Treffer werden also nicht zusätzlich eingeblendet, aber als Match-Signal transparent gemacht, wenn der Treffer ohnehin geliefert wurde. Demo-Seed-Bestand (SCRUM-244) ist damit nach Stichwort (z. B. „ventil", „pumpe", „filter") besser sortiert + erklärbar auffindbar.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/librarySearch.ts tests/library/library-search.test.ts apps/web/src/pages/Library.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(library): transparent relevance ranking + match reasons + honest empty state (SCRUM-245)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-246 — Live Basics Triage: Kernflüsse + P0/P1-Blocker

**Vorab-Befund (read-only; Live-Browser nicht ausführbar):** In dieser Sandbox ist **kein** echter Live-/Browser-Smoke möglich — `command -v chromium/google-chrome` = nicht vorhanden, `node_modules/playwright` = nicht installiert, keine bereitgestellte Live-URL. Daher wie vom Ticket vorgesehen **Ersatz-Triage** über Start-/Smoke-/Routing-/Auth-Pfad + bestehende Tests:
- **Start/Server-Auslieferung** (`services/app/src/server.ts`): Single-Origin, Security-Header (Helmet/HSTS/CSP), Kanonik-Redirect, **SPA-Fallback** (`setNotFoundHandler` → `index.html` für alles außer `/api`+`/health`) → Deep-Links/Refresh funktionieren; gehashte Assets immutable, `index.html` no-cache. Sauber.
- **FE-Bootstrap** (`main.tsx`, `App.tsx`, `AuthContext.tsx`): Auth-Gate Ersteinrichtung→Login→Shell, `/reset`+`/sso/callback` vor dem Gate, Splash bei Laden, Dev-Preview bei Backend-Fehler, robuster Logout (Hard-Reload). Kein Whitescreen-Pfad.
- **Netzwerk/CSP**: Einziger FE-Fetch ist `api/client.ts` → `/api` (**same-origin**), kompatibel zu `connectSrc 'self'`; `imgSrc 'self'+data:` deckt Objekt-Raw + Daten-URL-Thumbnails. Keine CSP-Blocker.
- **Routing**: alle Nav-Items in `routes.tsx` gemappt (inkl. `extern`), keine toten Routen; Topbar-Suche → `/bibliothek?q=` wird von Library gelesen.
- **Whitescreen-Risiken**: `grep` auf unguarded `.data.` zeigt nur **bewusst geschützte** Stellen (`Lifecycle` hinter `path.data ?`, `Stufe2` hinter `query.data && …`). Keine TODO/FIXME im Produktcode.
- **Backend-Kernflüsse**: durch die Route-Level-Smokes (SCRUM-234/237/238/239/240/241/242/243) end-to-end belegt — Auth/Login, KO-Create, Bibliothek/Suche, KO-Detail/Evidence, Ask/Gap, Validierung/Aufgaben, Demo-Seed-Sichtbarkeit (SCRUM-244): **113 Dateien / 601 Tests grün**.

**P0/P1/P2-Einstufung:**
- **P0 (blockiert Nutzung/Demo/Kernfluss): keine gefunden.** Server-Auslieferung, Auth-Gate, Routing und alle Kern-Backend-Endpunkte sind funktionsfähig und testabgedeckt.
- **P1 (stark sichtbar/produkthemmend): keine gefunden.**
- **P2 (später/Ops/Komfort, NICHT-Blocker, nur Notiz):**
  1. **Echter Browser-Live-Smoke** ist in dieser Umgebung nicht ausführbar (kein Chromium/Playwright). `scripts/smoke-browser.mjs` braucht eine lokale Maschine mit Browser → bei Pedi/Codex lokal laufen lassen, um die FE-Render-Strecke gegen das Live-Backend zu bestätigen.
  2. **Kanonik-Redirect** (`server.ts`: `app.<host>` → `<host>`, Default `CANONICAL_HOST=klarwerk.ai`): konsistent gedacht (App lebt auf der Apex-Domain, `app.` ist Alias). Ops-seitig EINMAL verifizieren, dass die Apex-Domain wirklich die App ausliefert und nicht nur die Marketing-Seite — reine Konfig-/Deployment-Prüfung, kein Codefehler.
  3. **Erststart-Sichtbarkeit**: frische Prod-Instanz ist bewusst leer; Demodaten kommen erst über Admin → „Demodaten laden" (SCRUM-181/244). Ehrlich, kein Blocker.

**Umsetzung:** **Kein Fix** — es wurde **kein** klarer P0/P1 gefunden. Gemäß Ticket-Regel (Schritt 6: nur P2/Kosmetik → keinen Fix, Befund dokumentieren) wird bewusst **kein** spekulativer Eingriff gemacht. Kein Produktcode, kein FE geändert.

**Geänderte/neue Dateien:** nur `docs/qm/claude-after-report.md` (dieser Befund, append-only). Kein Code.

**Tests/Gates:** `npm run check` grün — **113 Dateien / 601 Tests** (unverändert; kein Code berührt). apps/web `tsc --noEmit` nicht nötig (kein FE geändert). Biome + depcruise unverändert grün.

**Restlücken/Nicht-Ziele:** keine Ticket-Fabrik, keine 20 neuen Tickets, keine Jira-/Board-Änderung, keine Stufe-2-Feinschliffe, keine neuen Module/Features, keine Vector/RAG/Semantik. Echter Browser-/Live-Smoke bleibt offen (umgebungsbedingt) und sollte lokal mit Browser gegen die Live-URL nachgeholt werden; die P2-Punkte 2–3 sind Ops-/Konfig-Verifikationen, keine Codefixes.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
git add docs/qm/claude-after-report.md
git commit -m "docs(qm): SCRUM-246 live-basics triage — no P0/P1 found, P2 ops notes only"
git push
# Lokal (mit Browser) zur Live-Bestätigung:
#   PORT=3001 npm start    &    VITE_API_TARGET=http://localhost:3001 npm --prefix apps/web run dev
#   npm run smoke:browser
```

No Jira changes by Claude. No tickets closed. No new tickets. Danach Stopp.

---

## SCRUM-247 — Start/MyTasks: echte Arbeitszentrale aus vorhandenen Signalen

**Vorab-Befund (read-only):** `MyTasks.tsx` gruppierte Aufgaben bereits in **kritisch/heute/später** (Nacharbeit+Konflikte / Board+Revalidierung / offene Gaps) mit Typ-Filtern + Zählern (`taskFilters` getestet), aber die **Gruppierungslogik lag inline** im Component (nicht DOM-frei/testbar). `Start.tsx` zeigte eine **vermischte** „Heute zu tun"-Liste (erste 3 Board-KOs + erste 2 Gaps in EINER Liste) und blendete Konflikte/Revalidierung/Lernpfad **gar nicht** ein. Vorhandene echte Signale + Hooks: `useValidationBoard` (offene KOs), `useConflicts`, `useLifecyclePending` (Revalidierung), `useGaps` (inkl. Priorität), `useLearningPath`/`useLearningProgress`. Tests: `tests/foundation/task-filters.test.ts`, `tests/app/missions.test.ts`. **Kein Backend-Bedarf.**

**Umsetzung (minimal, produktnah, DOM-frei):** Neuer Helfer `apps/web/src/lib/workCenter.ts` — **Start**: `workSignalsFrom(rohdaten)` → echte Zähler (validationOpen, conflictsOpen, revalidationPending, **criticalGaps**=offen+hoch, learningOpenSteps); `learningOpenSteps(path, done)`; `buildWorkOverview(signals)` → **getrennte, nach Dringlichkeit geordnete** Kategorien (kritisch: Konflikte/kritische Lücken → heute: Revalidierung/Validierung → später: Lernpfad), **nur count>0** (keine Fake-Zeilen). **MyTasks**: `severityForType(typeKey)` (Quelle→Dringlichkeit) + `groupTasks(tasks)` (stabile Partition kritisch/heute/später). In `Start.tsx` ersetzt die getrennte „Nächste Handlungen"-Übersicht (Severity-Punkt + Label + Zähler + Link je Kategorie) die vermischte Todo-Liste; „Alle Aufgaben →"-Link, motivierender Leerzustand + `EmptyStateCtas` und die KPI-Spalte bleiben. In `MyTasks.tsx` läuft die Gruppierung jetzt über den testbaren Helfer (gleiches visuelles Ergebnis, gleiche Links/Filter/Aktionen). **Keine** neue Task-Engine, **keine** Fake-Aufgaben, Arten bleiben getrennt.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/workCenter.ts`, `tests/app/work-center.test.ts`; geändert `apps/web/src/pages/Start.tsx` (getrennte Work-Overview + Signal-Hooks), `apps/web/src/pages/MyTasks.tsx` (Gruppierung via Helfer), `apps/web/src/i18n.ts` (`start.workTitle` + `work.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **114 Dateien / 608 Tests** (+1 Datei, +7 workCenter-Tests: Start-Übersicht geordnet/getrennt, Leerzustand, Signal-Ableitung, Lernpfad-Restschritte, Severity-Zuordnung, Gruppierung stabil, leere Gruppen). apps/web `tsc --noEmit` grün. Biome + depcruise sauber. Bestehende `task-filters`/`missions`-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine neue Task-Engine, kein Backend-Großumbau, keine Knowledge-OS-Metamorphose, keine Stufe-2-Feinschliffe, keine Vector/RAG/Reasoner-Arbeit, keine Ticketserie, keine UI-Politur jenseits notwendiger Klarheit. Start zeigt bewusst die **aggregierten Kategorien** (Zähler+Link), nicht einzelne Items — Detail/Aktion bleibt MyTasks/den Zielseiten überlassen (Links erhalten). `criticalGaps` = offen+Priorität „hoch" (nicht-kritische offene Lücken bleiben als KPI/Risk sichtbar). Lernpfad-Hinweis erscheint nur bei vorhandenem Rollen-Pfad mit offenen Schritten.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/workCenter.ts tests/app/work-center.test.ts apps/web/src/pages/Start.tsx apps/web/src/pages/MyTasks.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(start,tasks): data-driven separated work overview + testable task grouping (SCRUM-247)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-248 — Capture produktnäher: von Rohinput zu sauberem KO sichtbar glätten

**Vorab-Befund (read-only):** `Capture.tsx` führt Rohinput (Freitext/Formular/Diktat/Interview/Upload) über `reasoner.structure` zu einem `draft: StructureResult` (Titel/Aussage/Body/Bedingungen/Maßnahmen), den der Nutzer rechts editiert; `submit` erzeugt daraus per `endpoints.ko.create` das KO und hängt Bilder als Objekt-Anhänge an. **Lücke (P2/Klarheit):** Der „Einreichen"-Button war **nur** durch `draft.title.trim()` gegated — eine leere **Aussage** rutschte durch (das Backend leitet sie zwar aus `bodyHtml` ab, aber bei leerem Body entsteht ein dünnes KO), und es gab **keine** sichtbare Übersicht „was landet im KO / was fehlt / welche Anhänge". Kein P0/P1 (Speichern, Modi, Anhänge funktionieren). `richText.isEmptyHtml` existiert zur Body-Inhaltsprüfung. Bestehende Capture-Tests: `tests/capture/*` (draft-form, extract, ocr/pdf/docx, interview, speech, attachment-preview) + Service/Route-Tests.

**Umsetzung (klein, ehrlich, DOM-frei):** Neuer Helfer `apps/web/src/lib/captureReadiness.ts` — `captureReadiness({title, statement, bodyHtml, category, type, attachmentCount})` → fünf Checks (`title`*, `content`*, `category`, `type`, `attachments`; * = Pflicht), `canSave` (alle Pflicht ok) und `missingRequired`. `content` ist erfüllt, wenn die Aussage Text trägt **oder** der WYSIWYG-Body echten Inhalt hat (`!isEmptyHtml`) — gleiche Ableitung wie das Backend. In `Capture.tsx`: kompakte **„Speicher-Check"-Liste** im Entwurfspanel (je Feld ✓ ok / ! fehlt / – optional, Anhänge mit Anzahl) plus ehrlicher Hinweis, wenn nicht speicherbereit; der Einreichen-Button wird jetzt aus `readiness.canSave` gegated (Titel **und** Inhalt statt nur Titel — kleiner, sicherer Guard-Fix). **Kein** Umbau des Speicherns/KO-Erstellens, **keine** neue Capture-/Reasoner-/OCR-Engine, **keine** Auto-Klassifikation behauptet; alle Modi + Anhang-/Quellen-Verhalten unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/captureReadiness.ts`, `tests/capture/capture-readiness.test.ts`; geändert `apps/web/src/pages/Capture.tsx` (Speicher-Check-Liste + Submit-Guard via canSave), `apps/web/src/i18n.ts` (`capture.ready*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **115 Dateien / 616 Tests** (+1 Datei, +8 captureReadiness-Tests: vollständig→speicherbereit, fehlender Titel, fehlende Aussage+leerer Body, Body-only-Inhalt zählt, Kategorie/Anhänge optional, Anhang-Zähler, leerer Entwurf→beide Pflichtfelder, stabile Check-Reihenfolge). apps/web `tsc --noEmit` grün. Biome + depcruise sauber. Bestehende Capture-Tests unverändert grün.

**Restlücken/Nicht-Ziele:** keine neue Capture-Engine, keine neue OCR/PDF/DOCX-Engine, keine neue Upload-Pipeline, keine KI-/Reasoner-Architektur, keine Auto-Erkennung/-Klassifikation, keine Knowledge-OS-Metamorphose, keine Stufe-2-Arbeit, keine UI-Politur jenseits der Klarheit. Bewusst nur ein additiver, ehrlicher Status (kein blockierendes „Magie"-Gating über Pflichtfelder hinaus); Kategorie bleibt optional (Server-Default „Allgemein"), Wissensart immer gesetzt. Dokumente (docx/pdf/txt) fließen weiter in den Rohtext (keine Anhänge), Bilder bleiben Anhänge — Verhalten unverändert.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/captureReadiness.ts tests/capture/capture-readiness.test.ts apps/web/src/pages/Capture.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(capture): honest save-readiness checklist + title+content guard (SCRUM-248)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-249 — Validierung: Review-Entscheidung produktnäher und handlungsfähiger

**Vorab-Befund (read-only):** `Validation.tsx` zeigt pro Review-Karte: Wissensart + Kategorie, Titel (Link zum KO-Detail), `ConfidenceBar` (Autor-**Confidence**), Validierungsziel (`neededValidations`), Autor/Originalautor (`KoAuthorLine`) und die Aktionen ✓/⚠/✗ (mit Pflicht-Kommentar bei Gelb/Rot) + Zuweisen. Filter (`validationFilters`) und Feedback (`validationFeedback`) sind getestet. **Lücke:** der für die Entscheidung zentrale **Trust** wird **nicht** angezeigt (nur Confidence), ebenso fehlen **Status-Pill**, **Version** und ein **„welche Entscheidung steht an"**-Hinweis; die Reihenfolge war unsortiert. `deriveStatus` (lib/displayStatus) + `StatusPill` existieren bereits. Kein P0/P1 — reine Produktreife/Klarheit.

**Umsetzung (minimal, ehrlich, DOM-frei):** Neuer Helfer `apps/web/src/lib/reviewSignals.ts` — `reviewSignals(ko)` leitet aus **vorhandenen Feldern** ab: `status` (deriveStatus), `trust`+`trustBand` (low<40/mid 40–69/high≥70), `version`, `needed`, `assigned` (Zuweisung vorhanden → „pruefung"), `authorTransferred` (Autor≠Originalautor); `sortByReviewPriority` (Autor-Transfer zuerst, dann niedrigster Trust, dann Titel/ID — deterministisch, verwirft nichts). In `Validation.tsx`: kompakter **Review-Signal-Strip** pro Karte — `StatusPill`, getönte **Trust**-Plakette, **v{version}**, Ziel, sowie „Autor übertragen"/„zugewiesen"-Chips — plus ein ehrlicher **Entscheidungs-Hinweis** je Trust-Band (low/mid/high), und das Board wird per `sortByReviewPriority` handlungsnah geordnet. **Keine** neue Bewertungslogik, **keine** neuen Backend-Felder, **kein** Pseudo-Workflow; bestehende Filter, ✓/⚠/✗-Bewertung (inkl. Pflicht-Feedback) und Zuweisen unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/reviewSignals.ts`, `tests/validation/review-signals.test.ts`; geändert `apps/web/src/pages/Validation.tsx` (Signal-Strip + Entscheidungshinweis + Priorisierung), `apps/web/src/i18n.ts` (`val.trust`/`val.transferred`/`val.assigned`/`val.decision*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **116 Dateien / 621 Tests** (+1 Datei, +5 reviewSignals-Tests: trustBand-Schwellen, Signal-Ableitung, Zuweisung→pruefung + Autor-Transfer, Priorisierung Transfer/Trust, Determinismus/Leerzustand). apps/web `tsc --noEmit` grün. Biome + depcruise sauber. Bestehende `tests/validation/*` (filters/feedback/status/return-revalidate) unverändert grün.

**Restlücken/Nicht-Ziele:** kein neues Validierungsmodell, kein Backend-Großumbau, keine neue Workflow-Engine, keine Knowledge-OS-Metamorphose, keine Stufe-2-Arbeit, keine Vector/RAG/Reasoner-Arbeit, keine Ticketserie, keine UI-Politur jenseits der Klarheit. Der Entscheidungs-Hinweis ist eine ehrliche, aus dem Trust-Band abgeleitete Orientierung (kein erfundener Score, keine Auto-Entscheidung). „Noch X Freigaben nötig" wird bewusst NICHT angezeigt, da der Rating-Breakdown nicht im Board-DTO liegt (kein neues Backend-Feld) — Trust-Band + Ziel geben den ehrlichen Näherungswert.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/reviewSignals.ts tests/validation/review-signals.test.ts apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): compact review signals (status/trust/version/transfer) + decision hint + priority sort (SCRUM-249)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-250 — Ask: Antwort, Quellen und Wissenslücke verständlicher

**Vorab-Befund (read-only):** `Ask.tsx` zeigt bereits Reasoner-Modus-Badge (SCRUM-233), eine Antwort-Karte (Evidence-Pill aus `knowledgeClassMeta`, `ConfidenceBar(trust)`, Antworttext, Schritte, Quellen, Helpful) und eine Gap-Karte (`noBasisTitle/Body` + Link `/risiko`). `AnswerResult = { answered, answer, knowledgeClass, trust, sources, steps, demo }`; `KNOWLEDGE_CLASS_META` mappt jede Klasse ehrlich auf Ton+Label. **Zwei Klarheits-/Ehrlichkeitslücken:** (1) der Antwort-Header zeigte **immer** die grüne Plakette „Aus validiertem Wissen" (`ask.fromValidated`) — auch wenn `knowledgeClass` `ungeprueft`/`meinung`/`annahme`/`extern`/`unbekannt` ist → potenziell falsche „validiert"-Behauptung; (2) Quellen wurden als **rohe KO-IDs** gerendert (nicht handlungsnah). Kein P0/P1. Tests: `tests/ask/*`, `tests/reasoner/*`.

**Umsetzung (minimal, ehrlich, DOM-frei):** Neuer Helfer `apps/web/src/lib/askView.ts` — `answerStatus(knowledgeClass)` → nur `gesichert` ⇒ `verified/pos`, alles andere ⇒ `unverified/warn` (aus vorhandener Klasse abgeleitet, keine neue Antwortlogik); `sourceRefs(ids, kos)` löst Quellen-IDs in lesbare KO-Titel auf (Fallback = ID, `known`-Flag, Reihenfolge stabil). In `Ask.tsx`: die irreführende `fromValidated`-Plakette durch eine **ehrliche Status-Plakette** (`ask.status.verified`/`unverified`, tone-getönt) ersetzt; die Evidence-Pill (Klassenlabel) bleibt komplementär; Quellen werden als **KO-Titel mit Link** (`useKos()`-Map, kein neuer Endpoint) statt roher IDs gerendert; die Gap-Karte erhält ein „Wissenslücke"-Badge + einen klaren **nächsten Schritt** (`ask.gapNext`). **Bestehende** Frage-/Helpful-/Gap-Funktion, Reasoner-Badge, Trust-Bar und Schritte unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/askView.ts`, `tests/ask/ask-view.test.ts`; geändert `apps/web/src/pages/Ask.tsx` (Status-Pill + lesbare Quellen + Gap-Schritt), `apps/web/src/i18n.ts` (`ask.status.*`/`ask.gapBadge`/`ask.gapNext` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **117 Dateien / 625 Tests** (+1 Datei, +4 askView-Tests: answerStatus gesichert vs. alle anderen, sourceRefs Titelauflösung/Reihenfolge, unbekannte-ID-Fallback+known=false, leere Quellen). apps/web `tsc --noEmit` grün. Biome + depcruise sauber. Bestehende `tests/ask/*` (ask-response/knowledge-class/gap-priority) + `tests/reasoner/*` unverändert grün.

**Restlücken/Nicht-Ziele:** kein neuer Reasoner, kein RAG, keine Vector-DB, kein ModelAdapter/Conductor, kein Backend-Großumbau, keine Metamorphose, keine Stufe-2-Arbeit, keine Ticketserie, keine UI-Politur jenseits der Klarheit. Der `ask.fromValidated`-Schlüssel bleibt in i18n erhalten (nur nicht mehr verwendet) — kein Aufräumen nötig. Quellen-Titel kommen aus dem bereits geladenen KO-Bestand; ist die Liste noch nicht geladen, greift ehrlich der ID-Fallback (kein Fake-Titel).

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/askView.ts tests/ask/ask-view.test.ts apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): honest verified/unverified status + readable KO sources + clear gap next step (SCRUM-250)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-251 — KO-Detail: Handlungsübersicht und Nutzbarkeit produktnäher

**Vorab-Befund (read-only):** `KnowledgeDetail.tsx` (~1300 Zeilen) rendert bereits alle Bausteine — `StatusPill(deriveStatus(ko))` + `v{version}`, Confidence, Statement/Bedingungen/Maßnahmen, Helpful, Quellen, Provenance, Lineage, Related, History, Evidence, Snapshots, Kommentare, Anhänge — sowie die echten Aktionen (edit, add-source/remove-source, comment, conflict melden, transfer, attach, revalidate, helpful). **Lücke:** die Info ist über **viele Karten verteilt**; es gab **keine kompakte „auf einen Blick"-Übersicht** (Zustand + Nutzbarkeit + nächste Handlung). Der DOM-freie `reviewSignals` (SCRUM-249) liefert bereits status/trust/trustBand/version. Kein P0/P1. KO-Felder `sources`/`attachments` sind bereits geladen.

**Umsetzung (minimal, ehrlich, DOM-frei):** Neuer Helfer `apps/web/src/lib/koOverview.ts` — `koOverview(ko)` (nutzt `reviewSignals`) leitet aus **bereits geladenen Feldern** ab: `usability` (validiert→`ready`, pruefung/revalidierung→`in-review`, sonst→`needs-work`), `status`, `trust`+`trustBand`, `version`, `sourceCount`/`attachmentCount`/`hasEvidence` sowie **genau eine** `nextAction`, die nur auf bestehende echte Aktionen verweist: `ready`→`use` (nutzbar), `in-review`→`review` (Bewertung abschließen), offen ohne Belege→`addSource` (Quelle ergänzen), offen mit Belegen→`validate` (zur Freigabe bewerten lassen). In `KnowledgeDetail.tsx`: ein **kompaktes Übersichts-Banner** ganz oben (Usability-Plakette getönt, `StatusPill`, Trust, Version, Quellen/Anhänge-Zähler + Hinweis „Nächste Handlung: …"). **Keine** Mutation, **keine** neue Card unter Stufe-2, **keine** falsche Validierungs-/Evidence-Behauptung (nutzbar nur bei status „validiert"); alle bestehenden Karten/Aktionen unverändert.

**Geänderte/neue Dateien:** neu `apps/web/src/lib/koOverview.ts`, `tests/ko/ko-overview.test.ts`; geändert `apps/web/src/pages/KnowledgeDetail.tsx` (Übersichts-Banner), `apps/web/src/i18n.ts` (`ko.use.*`/`ko.ov*`/`ko.next*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — **118 Dateien / 630 Tests** (+1 Datei, +5 koOverview-Tests: validiert→ready/use, zugewiesen→in-review/review, offen ohne Belege→needs-work/addSource, offen mit Beleg→validate, Quellen-/Anhang-Zähler). apps/web `tsc --noEmit` grün. Biome + depcruise sauber. Bestehende `tests/ko/*`, `tests/validation/*`, `tests/analytics/*` unverändert grün.

**Restlücken/Nicht-Ziele:** kein neues KO-Modell, kein Source/Evidence/Version-Großumbau, keine neue Stufe-2-Card, kein RAG, keine Vector-DB, kein Reasoner-/ModelAdapter-/Conductor-Umbau, kein Backend-Redesign, keine Ticketserie, keine UI-Politur ohne Produktwirkung. Die nächste Handlung ist eine ehrliche Orientierung (kein Mutations-Button) und verweist auf vorhandene Aktionen (Quellen-Card / Validierungsboard). `nextAction:"use"` wird bewusst nur bei status „validiert" gesetzt — keine Nutzbarkeits-Behauptung für offene/ungeprüfte KOs.

**Commit-/Push-Hinweis für Pedi/Codex (Sandbox pusht nicht):**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/koOverview.ts tests/ko/ko-overview.test.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): compact action/status overview banner + honest next-action (SCRUM-251)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-252 — Konflikte: Klärungsfluss und nächste Handlung produktnäher machen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex führt, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Conflicts.tsx` stellt bereits Art-/Status-Pills, Beschreibung, beide KO-Panels (Titel/Aussage/Bedingungen/Maßnahmen/Quellen + Detail-Link, ehrlicher „Objekt nicht gefunden"-Hinweis), den Eskalationspfad (nur Wahrheitskonflikt) und die echten Aktionen escalate/secondOpinion/resolve dar. `conflictView.ts` liefert `conflictKoPair` + `resolutionEffect` (dokumentierend, keine KO-Mutation). Lücke: keine **explizit empfohlene nächste Handlung** — die Buttons stehen flach nebeneinander, der sinnvolle nächste Schritt muss vom Nutzer selbst erschlossen werden. Backend (`services/conflicts`, KO-Dispatcher `resolve-conflict`, `conflicts-routes.ts`) unverändert tragfähig; non-truth ist serverseitig nicht eskalierbar. Kein P0/P1.

**Umsetzung (minimal, ehrlich, DOM-frei):** Neuer reiner Helfer `conflictNextStep(conflict)` in `conflictView.ts`: leitet aus Art+Status **genau eine** empfohlene nächste Handlung ab (`escalate` | `secondOpinion` | `resolve` | `done`), die nur auf bestehende echte Aktionen zeigt und die vorhandene Button-Verfügbarkeit spiegelt (Wahrheitskonflikt: offen→eskalieren, eskaliert→Zweitmeinung, zweitmeinung→entscheiden; Nicht-Wahrheit, nicht eskalierbar: offen→Zweitmeinung, zweitmeinung→entscheiden; gelöst→keine offene Handlung). In `Conflicts.tsx` ein kompakter „Nächster Schritt"-Hinweis über der Aktionsleiste (nur bei nicht gelösten Konflikten); bestehende Aktionen/Formulare unverändert. Keine automatische Lösung, keine neue Logik, keine neue Stufe-2-Card.

**Geänderte Dateien:** `apps/web/src/lib/conflictView.ts` (Helper+Typ), `tests/conflicts/conflict-view.test.ts` (+3 Tests), `apps/web/src/pages/Conflicts.tsx` (Hinweiszeile), `apps/web/src/i18n.ts` (`con.nextLabel`, `con.next.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 118 Dateien / 633 Tests (+3). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber.

**Restlücken/Nicht-Ziele:** Kein neues Konfliktmodell, kein Backend-Großumbau, keine automatische Konfliktlösung, keine neue Stufe-2-Card, kein RAG/Vector-DB/Reasoner-Umbau, keine Ticketserie, keine UI-Politur ohne Produktwirkung. Der Hinweis ist Orientierung (kein Auto-Trigger); fehlende KO-Referenzen bleiben über den bestehenden „Objekt nicht gefunden"-Hinweis ehrlich.

**Commit-/Push-Hinweis:**
```
git add apps/web/src/lib/conflictView.ts tests/conflicts/conflict-view.test.ts apps/web/src/pages/Conflicts.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(conflicts): honest next-step recommendation per conflict (SCRUM-252)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-253 — Wissenslücken: Priorisierung und nächste Handlung produktnäher machen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex führt, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Risk.tsx` zeigt die Gap-Liste bereits mit Prioritäts-Pill, Frage, Zuweisung/Status und (bei `offen`) den echten Aktionen: Prioritäts-Select, Zuweisen-Select, Schließen, Löschen. `gapPriority.ts` liefert `GAP_PRIORITIES`, `priorityRank`, `sortGapsByPriority`, `priorityTone`. `riskCockpit.ts` aggregiert Kennzahlen (offene/hoch/zugewiesen/…). Gap-Modell (`api/types.ts`): `{id, question, status: offen|geschlossen, assignee: string|null, priority: hoch|mittel|niedrig, createdAt}` — kein separates Origin-Feld (die Lücke entsteht aus der unbeantworteten Ask-Frage, deren Text die Karte zeigt). Lücke: **keine ausgewiesene nächste Handlung** je Gap; der nächste Schritt muss erschlossen werden. Backend (Ask-/Gap-Service, `ask-routes.ts`) unverändert tragfähig. Kein P0/P1.

**Umsetzung (minimal, ehrlich, DOM-frei):** Neuer reiner Helfer `gapNextStep(gap)` in `gapPriority.ts`: leitet aus Status+Priorität+Zuweisung **genau eine** nächste Handlung ab (`prioritize`/`assign`/`capture`/`done`), die nur auf bestehende echte Aktionen zeigt und dem Lebenszyklus folgt (geschlossen→erledigt; offen+zugewiesen→Wissen erfassen; offen ohne Owner & Prio hoch→zuweisen; offen ohne Owner & Prio<hoch→priorisieren). In `Risk.tsx` je offener Gap-Zeile ein kompakter „Nächster Schritt"-Hinweis unter der Frage; bestehende Controls (Priorität/Zuweisen/Schließen/Löschen) unverändert. Keine neue Engine, keine automatische KO-Erzeugung, keine Auto-Mutation. „close" wird bewusst NICHT automatisch empfohlen (ohne KO-Verknüpfung nicht ehrlich entscheidbar) — die Schließen-Aktion bleibt manuell.

**Geänderte Dateien:** `apps/web/src/lib/gapPriority.ts` (Helper+Typ), `tests/ask/gap-priority.test.ts` (+3 Tests), `apps/web/src/pages/Risk.tsx` (Hinweiszeile), `apps/web/src/i18n.ts` (`risk.gapNextLabel`, `risk.gapNext.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 118 Dateien / 636 Tests (+3). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber.

**Restlücken/Nicht-Ziele:** Keine neue Risiko-Engine, kein Backend-Großumbau, keine automatische KO-/Ticket-Erzeugung, keine neue Stufe-2-Card, kein RAG/Vector-DB/Reasoner-Umbau, keine Ticketserie, keine UI-Politur ohne Produktwirkung. Der Hinweis ist Orientierung (kein Auto-Trigger). „Herkunft aus Frage" = der vorhandene Fragetext (kein separates Origin-Feld im Modell — ehrlich so belassen). Geschlossene Lücken zeigen keinen Schritt (nur die bestehende Löschen-Aktion).

**Commit-/Push-Hinweis:**
```
git add apps/web/src/lib/gapPriority.ts tests/ask/gap-priority.test.ts apps/web/src/pages/Risk.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(risk): honest next-step recommendation per knowledge gap (SCRUM-253)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-254 — Lebenszyklus: Revalidierung und nächste Handlung produktnäher machen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex führt, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Lifecycle.tsx` bietet drei Blöcke: Anlagenänderung melden (`assetChanged` → markiert gekoppelte KOs „prüfen"), Pending-Revalidierung und rollenspezifischen Lernpfad. Die Pending-Liste rendert bislang nur **rohe KO-IDs** (`lifecycle.pending()` liefert `string[]`) mit StatusPill „revalidierung", Detail-Link und der echten Aktion „Noch gültig → neue Version" (`ko.act(revalidate)`). `revalidation.ts` enthielt nur `canRevalidate`. Backend (`services/lifecycle`: Kopplungen asset_ref→ko_id, Pending-Set, Lernpfade) unverändert tragfähig; das KO trägt ein optionales `asset`-Feld. Lücke: aus der ID ist weder Titel noch Anlagenbezug noch ein nächster Schritt erkennbar. Kein P0/P1.

**Umsetzung (minimal, ehrlich, DOM-frei):** Helfer `revalidationView(id, kos)` in `revalidation.ts` erweitert: löst die Pending-ID gegen den geladenen KO-Bestand auf und liefert `{found, title, asset, status, nextStep}`. `nextStep` ehrlich aus dem realen KO-Status abgeleitet — `validiert`→`review` (prüfen, ob nach Änderung noch gültig → dann über den vorhandenen „Noch gültig"-Button bestätigen), `offen`→`validate` (zuerst regulär validieren), nicht auflösbar→`openKo` (öffnen, Details liegen nicht vor). In `Lifecycle.tsx` zeigt jede Pending-Karte jetzt Titel statt ID, einen Anlagenbezug-Chip (nur falls vorhanden), den „Nächster Schritt"-Hinweis und einen ehrlichen „Details nicht im geladenen Bestand"-Hinweis, wenn das KO nicht auflösbar ist. Bestehender Revalidate-Button und Asset-Change-Flow unverändert. Keine neue Engine, keine Persistenz, keine automatische Mutation.

**Geänderte Dateien:** `apps/web/src/lib/revalidation.ts` (Helper+Typen), `tests/library/revalidation.test.ts` (+3 Tests), `apps/web/src/pages/Lifecycle.tsx` (Pending-Karte + `useKos`), `apps/web/src/i18n.ts` (`lcy.revalAsset`, `lcy.revalNextLabel`, `lcy.revalNext.*`, `lcy.revalMissing` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 118 Dateien / 639 Tests (+3). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber.

**Restlücken/Nicht-Ziele:** Kein neues Lifecycle-Modell, kein Backend-Großumbau, keine neue Persistenz, keine automatische Revalidierung/Mutation, keine neue Stufe-2-Card, kein RAG/Vector-DB/Reasoner-Umbau, keine Ticketserie, keine UI-Politur ohne Produktwirkung. Der Anlagenbezug stammt aus dem KO-Feld `asset` (Bezug des Objekts, nicht zwingend der konkrete Änderungsauslöser — daher neutral als „Anlagenbezug" benannt, keine falsche Kausalbehauptung). Keine Aussage über Gültigkeit/Aktualität; der Hinweis ist reine Orientierung, die Bestätigung bleibt manuell.

**Commit-/Push-Hinweis:**
```
git add apps/web/src/lib/revalidation.ts tests/library/revalidation.test.ts apps/web/src/pages/Lifecycle.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(lifecycle): resolve pending revalidation IDs to title/asset + honest next-step (SCRUM-254)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## Stage-1 Product Readiness — Industrial Knowledge Workflow schärfen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). Kein Demo-Hack — produktnahe Schärfung des echten Stage-1-Kerns.

**Vorab-Befund (read-only):** `seed-demo.ts` baut den Stage-1-Bestand ausschließlich über echte Services (KOs, Validierung, Quelle+Anhang, Konflikt, Lifecycle-Kopplung/Revalidierung, Lernpfade) — Guards/Idempotenz/Produktionsschutz intakt. Einziger testdatenhafter Störpunkt: die Wissenslücke „Welche Hauptstadt hat Australien?". `Capture`-i18n nutzte an Stage-1-Stellen technische Begriffe („Rohtext", „Mit Reasoner strukturieren", „Der Reasoner …"). Der Reasoner-Fallback (`services/reasoner/provider.ts`) entscheidet „Lücke" über Token-Überschneidung (`tokenize` filtert nur Wörter ≤2 Zeichen — KEIN Stoppwort-Filter) zwischen Frage und KO-Titel+Statement. Keine P0/P1.

**Umsetzung:**
1. *Seed-Lücke industriell ersetzt.* Neue Frage: „Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?" — empirisch gegen alle fünf geseedeten KOs geprüft (eigenes Token-Overlap-Skript mit der echten Reasoner-Logik): **null Überschneidung**, bleibt also eine echte Lücke. Bewusst NICHT die wörtlich vorgeschlagene Beispielformulierung „…die Dosiermenge … nach dem Schichtwechsel", weil deren Stoppwörter „die"/„dem" in geseedeten KO-Statements vorkommen und die Lücke aufgehoben hätten. Priorität wie gefordert auf „hoch".
2. *Capture-Texte produktnäher (nur Labels/Texte, keine Funktionsänderung, DE+EN):* „Rohtext" → „Erfahrungsnotiz", „Mit Reasoner strukturieren" → „Mit KI strukturieren", Platzhalter/Hilfe/Interview-Hinweis von „der Reasoner …" → „die KI …". Ehrliche Grundaussage erhalten: **KI strukturiert, Mensch prüft und reicht ein.** Technische Engine-Labels `capture.ivModel`/`capture.ivFallback` („Reasoner-Modell"/„Deterministischer Fallback") bewusst unverändert — sie tragen echte QM-/Stufe-2-Bedeutung.
3. *Ask/Risk/Validation/Lifecycle:* keine Logikänderung. Durch die Seed-Anpassung zeigt Ask bei Unbeantwortbarkeit eine industrielle Lücke statt Testbeispiel; Risk/Gap, Start/MyTasks und das Risiko-Cockpit zeigen denselben echten Betriebsfall.

**Geänderte Dateien:** `services/app/src/seed-demo.ts` (Lücke + Kommentar), `services/app/src/seed.test.ts` (Assertions), `apps/web/src/i18n.ts` (Capture-Texte DE+EN), `docs/qm/claude-after-report.md`.

**Entfernte Test-/Demo-Daten:** generische Wissenslücke „Welche Hauptstadt hat Australien?" vollständig entfernt (Seed + via Test gegen Regression abgesichert).

**Ergänzte produktnahe Industrieinhalte:** industrielle Wissenslücke „Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?" (Priorität hoch); produktnähere Capture-Sprache („Erfahrungsnotiz", „Mit KI strukturieren").

**Wirkung auf die Flows:** *Start/MyTasks* — offene Validierungsaufgabe + industrielle Lücke statt Testdaten. *Capture* — wirkt als „Expertenwissen sichern", ehrlich (KI strukturiert, Mensch prüft). *Library/KO-Detail* — unverändert (KOs waren bereits industriell: Ventil/Pumpe/Filter/Kaltstart, mit Quelle+Anhang+Trust+Status). *Ask* — unbeantwortbare Frage erzeugt eine betriebliche Lücke, keine Fake-Antwort; beantwortbare Fragen weiter auf validierte KOs+Quellen gestützt. *Validation* — echte Prüfobjekte (koOpen zugewiesen, koWarm in Teil-Review). *Lifecycle* — koValid an ANL-01 gekoppelt, Asset-Änderung → Revalidierung fällig, Lernpfade sichtbar.

**Tests/Gates:** `npm run check` grün — 118 Dateien / 639 Tests. `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. seed.test prüft jetzt zusätzlich: industrielle Lücke vorhanden, keine Australien-/Hauptstadt-Lücke, gaps ≥ 1, eine Lücke mit Priorität „hoch".

**Lokaler Review-Hinweis:** Vor einem lokalen UI-Review mit `npm run start` muss bei UI-Änderungen `apps/web` frisch gebaut sein (`apps/web` Build), sonst kann ein veraltetes `apps/web/dist` ausgeliefert/angezeigt werden (stale Bundle). Kein neues Runbook nötig.

**Restlücken/Nicht-Ziele:** keine neue Architektur, kein RAG, keine neue Suchmaschine/Retrieval-Logik, keine Stufe-2-Integration, kein Refactoring ohne Produktnutzen, keine neuen Module, kein ModelAdapter/Conductor, keine Ticketserie. Reine Inhalts-/Textschärfung des Stage-1-Kerns; Backend-Verhalten, Guards, Idempotenz und Produktionsschutz unverändert.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add services/app/src/seed-demo.ts services/app/src/seed.test.ts apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(seed,capture): sharpen Stage-1 industrial knowledge workflow"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-256 — Ask: Antwortquellen auf tatsächlich genutztes Wissen fokussieren
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):**
1. `AnswerResult.sources` entsteht im Reasoner-Provider (`services/reasoner/src/provider.ts` / `provider-model.ts`), NICHT im Ask-Service. `services/ask/src/service.ts` reicht `result` unverändert durch (nutzt nur `result.sources[0]` als Audit-Target).
2. Im **deterministischen** Provider (`DeterministicProvider.answer`, der Stage-1-Default ohne `ANTHROPIC_API_KEY`) wird die Antwort AUSSCHLIESSLICH aus `best = relevant[0]` gebildet: `answer = best.statement`, `trust`/`knowledgeClass` aus `best`, `steps = [best]` (genau ein Schritt). Aber `sources` war `relevant.map(r => r.id)` — also ALLE per `keywordSelect` lose gematchten KOs. Das ist die Ursache, dass bei der Überdruck-/Ventil-Frage thematisch schwächere Kaltstart-/Filter-KOs als gleichwertige Quellen erschienen.
3. Ein „tatsächlich genutztes" KO existiert bereits eindeutig: `best` (und der einzelne `steps`-Eintrag verweist nur auf `best`). Im **Modell**-Provider werden dagegen alle relevanten KOs real als nummerierte Grounding-Quellen an das Modell übergeben (mehrere Quellen tragen dort echt bei).
4. Kleinste korrekte Änderung: **Backend-seitig**, nur im deterministischen Provider — `sources` an die tatsächlich genutzte Quelle angleichen. Kein FE-Eingriff nötig (`askView.ts`/`Ask.tsx` rendern `sources` korrekt).

**Umsetzung:** In `DeterministicProvider.answer` `sources: relevant.map(...)` → `sources: [best.id]`. Damit sind `answer`, `trust`, `knowledgeClass`, `steps` UND `sources` konsistent aus genau dem einen verwendeten KO abgeleitet. Der Modell-Provider bleibt unverändert (dort speisen mehrere KOs nachweislich den Antwort-Prompt → mehrere Quellen sind ehrlich). Kein neues Retrieval/Ranking, kein RAG, keine Vector-Suche, keine API-Änderung. Helpful-/Gap-Pfad unberührt (unbeantwortbare Frage → weiterhin `answered:false`, `sources:[]` → Wissenslücke).

**Geänderte Dateien:** `services/reasoner/src/provider.ts` (fokussierte Quelle + Kommentar), `services/reasoner/src/service.test.ts` (+1 Test), `docs/qm/claude-after-report.md`.

**Warum das die Quellen-Ehrlichkeit verbessert:** Die deterministische Antwort IST der Statement-Text genau eines KOs; sekundäre Keyword-Treffer tragen nichts zur Antwort bei. Sie nicht mehr als Quellen auszuweisen, macht die angezeigte Evidenz belastbar und nachvollziehbar (eine klare Frage zu einem validierten KO zeigt dieses KO als benutzte Quelle statt einer breiten Kandidatenliste) und grenzt Klarwerk gegen die Chatbot-Wahrnehmung ab — Antwort bleibt quellengebunden. Bestehende Tests blieben grün, weil ihre Fixtures nur ein KO matchten; der neue Test belegt den Mehrfach-Match-Fall (starkes + schwaches KO → nur das genutzte erscheint).

**Tests/Gates:** `npm run check` grün — 118 Dateien / 640 Tests (+1). Kein FE berührt → DOM-tsc nicht erforderlich. Biome + dependency-cruiser sauber.

**Restlücken/Nicht-Ziele:** keine neue Retrieval-Engine, kein RAG, keine Vector-Suche, keine neue Sucharchitektur, kein ModelAdapter/Conductor, keine Stufe-2-Arbeit, keine Ticketserie, keine UI-Politur ohne Produktwirkung, keine Fake-Quellen, kein Speichern von Antworttexten/Prompt-Volltext. Der Modell-Provider behält bewusst Mehrfach-Quellen (echtes Multi-KO-Grounding); eine spätere Verfeinerung dort ist möglich, war hier aber nicht der minimal-sichere Eingriff.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add services/reasoner/src/provider.ts services/reasoner/src/service.test.ts docs/qm/claude-after-report.md
git commit -m "fix(ask): focus answer sources on actually used knowledge objects (SCRUM-256)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-257 — Capture: Beispielpfad für Expertenwissen produktnäher führen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Capture.tsx#loadExample()` setzte ein hartkodiertes Frost/Pumpe-P-12-Beispiel (Rohnotiz „Pumpe P-12 bei Frost vorwärmen … Kavitationsschäden", Kategorie „Instandhaltung", Asset „Pumpe P-12", Tags „Frost/Pumpe/Winter") und meldete nur „Beispiel geladen." Plausibel, aber nicht an die aktuelle Stage-1-Story (industrielle Lücke Linie L4 / Dosierwert / Schichtwechsel aus dem Seed) angeschlossen; der nächste Schritt blieb generisch. Kein eigener Capture-Beispiel-Helfer vorhanden (nur `captureReadiness.ts`). Alle übrigen Modi (Freitext/Formular/Diktat/Interview/Uploads/Draft/Strukturieren/Submit) unberührt. Kein P0/P1.

**Umsetzung (minimal, produktnah):** Beispielinhalt in einen DOM-freien Helper `apps/web/src/lib/captureExample.ts` ausgelagert (`CAPTURE_EXAMPLE`: raw/category/asset/tags/noticeKey). Inhalt industrialisiert und an die Stage-1-Story angeschlossen — eine ehrliche ROHE Erfahrungsnotiz: „Nach dem Schichtwechsel an Linie L4 schwankt der Dosierwert der Klebstoffdosierung. In der Praxis stabilisiert sich die Linie, wenn vor dem ersten Auftrag der Nullpunkt am HMI geprüft und die Dosierpumpe DP-4 entlüftet wird. Gilt besonders nach Gebindewechsel oder längerer Pause." Metadaten produktnah: Kategorie „Qualität", Asset „Linie L4 / Dosierstation DP-4", Tags „Dosierung, Linie L4, Schichtwechsel, Qualität". Wissensart bewusst unverändert (keine unerwartete Logikänderung). `loadExample()` nutzt jetzt diesen Helper. Notice `capture.exampleLoaded` (DE/EN) erklärt den nächsten Schritt: „Erfahrungsnotiz geladen — jetzt mit KI strukturieren und den Entwurf prüfen." Ehrliche Grundaussage erhalten: KI strukturiert, Mensch prüft und reicht ein.

**Geänderte Dateien:** NEU `apps/web/src/lib/captureExample.ts`, NEU `tests/capture/capture-example.test.ts` (4 Tests); geändert `apps/web/src/pages/Capture.tsx` (loadExample nutzt Helper), `apps/web/src/i18n.ts` (`capture.exampleLoaded` DE/EN), `docs/qm/claude-after-report.md`.

**Ersetzte alte Beispiel-/Testdaten:** Frost/Pumpe-P-12-Spielzeugbeispiel komplett entfernt (Rohnotiz, Kategorie „Instandhaltung", Asset „Pumpe P-12", Tags „Frost/Pumpe/Winter", Kavitations-Formulierung) — per Test gegen Rückkehr abgesichert (kein „Frost"/„P-12"/„Kavitation" mehr).

**Ergänzte produktnahe Industrieinhalte:** industrielle Erfahrungsnotiz Linie L4 / Klebstoffdosierung / Dosierpumpe DP-4 / Nullpunkt am HMI / Gebinde- und Schichtwechsel; Kategorie „Qualität", Asset „Linie L4 / Dosierstation DP-4", Tags „Dosierung, Linie L4, Schichtwechsel, Qualität".

**Wirkung auf Capture und Stage-1-Flow:** Der wichtigste Einstieg in den Knowledge-OS-Kreis wirkt jetzt als „echte Betriebserfahrung sichern" statt Spielzeugformular und ist inhaltlich an dieselbe industrielle Lücke angeschlossen, die in Ask/Risk/Start sichtbar ist — der Reviewer erlebt einen durchgängigen Stage-1-Fall. Nach „Beispiel laden" ist der nächste Schritt explizit benannt (strukturieren → Entwurf prüfen → einreichen).

**Tests/Gates:** `npm run check` grün — 119 Dateien / 644 Tests (+1 Datei, +4 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test prüft: produktnaher Inhalt (Linie L4 / Dosierwert|Dosierung / Schichtwechsel), Kategorie/Asset/Tags gesetzt und nicht leer, keine alten Frost/Pumpe-P12-Daten, Notice-Key vorhanden.

**Restlücken/Nicht-Ziele:** kein Capture-Redesign, kein Backend-Umbau, keine automatische Lücken-Schließung/KO-Erzeugung, keine neue KI-/Reasoner-Architektur, kein RAG/Vector, keine Stufe-2-Arbeit, keine Ticketserie. Das Beispiel bleibt eine rohe Erfahrungsnotiz (kein fertig validiertes Wissen); alle bestehenden Modi/Uploads/Diktat/Interview/Draft/Submit unverändert funktionsfähig.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/captureExample.ts tests/capture/capture-example.test.ts apps/web/src/pages/Capture.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(capture): guide example path with industrial experience note (SCRUM-257)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-258 — Validierung: Review-Entscheidung klarer und textlich führen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Validation.tsx` zeigt pro Karte Status/Trust/Version/Ziel/Transfer/Assigned + Entscheidungs-Hinweis. Die drei Review-Aktionen waren aber rein icon-lastig (grüner Check / gelbes Minus / rotes X) mit nur `title`-Tooltip. Mutationen: `up` → `rate(verdict:"up")`; `warn`/`down` → `openFeedback(...)` → öffnen das Pflicht-Feedback-Formular, das über `isFeedbackSubmittable`/`buildValidationFeedback` (`validationFeedback.ts`) eine Begründung erzwingt (warn=Bedingt, down=Ablehnung). Filter, `reviewSignals`, Trust/Status/Version, Zuweisung und `sortByReviewPriority` vorhanden. Kein P0/P1, keine Backend-Lücke.

**Umsetzung (minimal, FE-Text/Buttons):** Die drei Entscheidungen in einen DOM-freien Helper `apps/web/src/lib/reviewDecision.ts` ausgelagert (`REVIEW_DECISIONS`: verdict/labelKey/tone/requiresFeedback). In `Validation.tsx` werden die Icon-Buttons durch eine textlich geführte Entscheidungsleiste ersetzt: Icon + sichtbares Label **Freigeben / Rückfrage / Ablehnen**, getönt (pos/warn/crit). Warn/Ablehnen tragen ein „*" und darunter steht sichtbar „* Rückfrage und Ablehnung brauchen eine Begründung." Bestehende Verdict-Mutationen unverändert: `up` → dieselbe `rate`-Mutation; `warn`/`down` → dieselbe `openFeedback`-Logik → unverändertes Pflicht-Feedback-Formular (gleiche Texte, gleicher Guard). Aktiv-Ring bleibt, wenn das Feedback-Formular zur jeweiligen Entscheidung offen ist. Assign-Select, Filter, Signale, Sortierung unverändert. Keine Backend-Änderung, keine neue Validierungs-/Workflow-Logik.

**Geänderte Dateien:** NEU `apps/web/src/lib/reviewDecision.ts`, NEU `tests/validation/review-decision.test.ts` (3 Tests); geändert `apps/web/src/pages/Validation.tsx` (Entscheidungsleiste + DECISION_TONE), `apps/web/src/i18n.ts` (`val.actionApprove/Query/Reject`, `val.feedbackRequiredHint` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 120 Dateien / 647 Tests (+1 Datei, +3 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert: genau drei Entscheidungen in Reihenfolge up→warn→down, nur warn/down `requiresFeedback`, Tönung pos/warn/crit, korrekte Label-Keys.

**Restlücken/Nicht-Ziele:** keine Backend-Änderung, keine neue Validierungsengine, keine neue Workflow-Logik, keine Stufe-2-Arbeit, kein RAG/Vector/Reasoner-Umbau, keine Ticketserie, keine große Neugestaltung. Die Mutationen (up/warn/down/assign) und das Pflicht-Feedback bleiben exakt wie zuvor; nur die Entscheidung ist jetzt textlich klar geführt.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/reviewDecision.ts tests/validation/review-decision.test.ts apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): label review decisions (approve/query/reject) with required-reason hint (SCRUM-258)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-259 — KO-Detail: nächste Handlung als echten Arbeitsfluss führen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** Nach SCRUM-251 zeigt das KO-Detail-Banner (`KnowledgeDetail.tsx`, um Zeile 370) bereits Usability-Plakette, StatusPill, Trust, Version, Quellen/Anhänge und die abgeleitete `nextAction` (`koOverview.ts`, Typ `KoNextAction = "use"|"review"|"addSource"|"validate"`) — aber nur als erklärenden Text (`ko.next.*`). Vorhandene Routen (`navigation.ts`/`routes.tsx`): `/validierung`, `/fragen`, `/bibliothek`, `/wissen/:id`. `Link` ist bereits importiert. Es existiert ein echter Quellenbereich (`<Card>` mit `ko.sourcesTitle` + Add-Source-Formular), aber ohne Anker-id. Kein P0/P1.

**Umsetzung (minimal, ehrlich, DOM-frei):** Neuer reiner Helfer `apps/web/src/lib/koCta.ts`: `koCta(action) → { labelKey, href, kind: "route"|"anchor", tone }`. Abbildung nur auf vorhandene Ziele: `validate`/`review` → `/validierung` (offene/zu prüfende KOs ehrlich zur Validierung), `use` → `/fragen` (validiertes Wissen wird dort quellengebunden genutzt), `addSource` → lokaler Anker `#ko-sources` auf den vorhandenen Quellenbereich (KEIN neuer Import-/Source-Workflow, nur Orientierung). Im Banner wird neben dem Next-Action-Text die CTA gerendert: `route` → `<Link>` mit „→", `anchor` → `<a href="#ko-sources">` mit „↓"; getönt (primary/neutral). Am Quellenbereich `id="ko-sources"` + `scroll-mt-20` als Anker-Ziel ergänzt. Keine neue Mutation, kein Backend, keine neue Workflow-Engine.

**Geänderte Dateien:** NEU `apps/web/src/lib/koCta.ts`, NEU `tests/ko/ko-cta.test.ts` (4 Tests); geändert `apps/web/src/pages/KnowledgeDetail.tsx` (Banner-CTA + `#ko-sources`-Anker), `apps/web/src/i18n.ts` (`ko.cta.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 121 Dateien / 651 Tests (+1 Datei, +4 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert: validate/review → /validierung (route, primary), use → /fragen (route, primary), addSource → #ko-sources (anchor, neutral), jede Handlung mit nicht-leerem Label/Ziel.

**Restlücken/Nicht-Ziele:** keine neue Mutation, keine Backend-Änderung, keine neue Workflow-Engine, keine Stufe-2-Arbeit, keine Metamorphose, kein RAG/Vector/Reasoner-Umbau, keine Ticketserie. „Quelle ergänzen" bleibt bewusst lokale Orientierung (Anker zum vorhandenen Quellenformular), kein Fake-/Import-Flow. `use` führt zu `/fragen` (Ask nutzt validiertes Wissen quellengebunden) statt `/bibliothek`, da der aktive Nutzungsfluss fachlich ehrlicher ist; eine spätere Variante Richtung Bibliothek/Output bliebe möglich.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/koCta.ts tests/ko/ko-cta.test.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): turn next action into an honest CTA into existing flows (SCRUM-259)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-260 — MyTasks: Aufgaben als handlungsnahe Arbeitskarten führen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `/aufgaben` (`MyTasks.tsx`) verdichtet bereits echte Signale zu einer flachen Aufgabenliste mit `typeKey` (`task.returned`/`task.conflict`/`task.validation`/`task.revalidation`/`task.gap`), Severity (`workCenter.ts#severityForType`), Gruppierung (`groupTasks` → kritisch/heute/später), Typ-Filter + Counts (`taskFilters.ts`). Jede Zeile ist bereits ein `<Link to={it.to}>` in den passenden Flow (`/wissen/:id`, `/konflikte`, `/lebenszyklus`, `/risiko`). Lücke: die Zeile zeigt nur Typ-Chip + Titel (+ Autorzeile) — keine sichtbare nächste Handlung. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Neuer reiner Helfer `apps/web/src/lib/taskAction.ts`: `taskAction(typeKey) → { actionLabelKey, tone }` mit Fallback für unbekannte Typen. Abbildung an die bestehenden Ziel-Flows: Nacharbeit → „Entwurf überarbeiten" (crit), Konflikt → „Konflikt entscheiden" (crit), Validierung → „Wissen bewerten" (warn), Revalidierung → „Gültigkeit prüfen" (warn), Wissenslücke → „Lücke priorisieren" (neutral). In `MyTasks.tsx` zeigt jede Row die nächste Handlung rechtsbündig (getöntes Label + „→"); die Row bleibt derselbe `<Link>` zum vorhandenen Ziel. Typ-Chip, Titel, Autorzeile, Gruppierung, Filter und Counts unverändert. Keine neue Mutation, keine neue Task-Engine, keine neuen Datenquellen, kein Backend.

**Geänderte Dateien:** NEU `apps/web/src/lib/taskAction.ts`, NEU `tests/app/task-action.test.ts` (2 Tests); geändert `apps/web/src/pages/MyTasks.tsx` (Row-Handlung + ACTION_TONE), `apps/web/src/i18n.ts` (`task.action.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 122 Dateien / 653 Tests (+1 Datei, +2 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert die Abbildung aller fünf Aufgaben-Typen auf Label/Tönung und den neutralen Fallback für unbekannte Typen.

**Restlücken/Nicht-Ziele:** keine Fake-Aufgaben, keine neuen Mutationen, keine neue Task-Engine, keine Backend-Änderung, keine neuen Datenquellen, keine Stufe-2-Arbeit, keine Metamorphose, kein RAG/Vector/Reasoner-Umbau, keine Ticketserie. Die Aufgaben stammen weiterhin ausschließlich aus den vorhandenen Signalen; die nächste Handlung ist reine Orientierung über den bestehenden Row-Link.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/taskAction.ts tests/app/task-action.test.ts apps/web/src/pages/MyTasks.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(tasks): show next action per task row in work center (SCRUM-260)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-261 — Start: Knowledge-OS-Kreis als klare Arbeitsführung sichtbar machen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Start.tsx` zeigt bereits rollenbewusste Missionen (`missions.ts`), eine datengetriebene Arbeitsübersicht (`workCenter.ts#buildWorkOverview`/`workSignalsFrom`), KPIs und den ehrlichen Stufe-2-Hinweis (`stufe2Hint.ts`). `ArrowRight` und `Link` sind importiert; vorhandene Routen u. a. `/erfassen`, `/validierung`, `/fragen`, `/bibliothek`, `/lebenszyklus`. Lücke: keine kompakte, sofort verständliche Darstellung des Knowledge-OS-Kreises (Capture → Validate → Use → Maintain), die zeigt, dass Klarwerk kein Chatbot ist. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Neuer reiner Helfer `apps/web/src/lib/knowledgeCycle.ts` (`KNOWLEDGE_CYCLE`: vier Schritte `capture/validate/use/maintain` mit labelKey/descKey und NUR vorhandenen Routen `/erfassen`, `/validierung`, `/fragen`, `/lebenszyklus`). In `Start.tsx` direkt unter dem PageHeader eine kompakte Flow-Section: Titel + Untertitel („Kein Chatbot: Wissen wird erfasst, validiert, genutzt und aktuell gehalten.") und vier nummerierte Schritt-Karten (1→4 mit Pfeil), jede ein `<Link>` auf die bestehende Route. Missionen, Arbeitsübersicht, KPIs und Stufe-2-Hinweis unverändert. Keine neue Navigation, keine neuen Datenquellen, keine Mutation, kein Backend.

**Geänderte Dateien:** NEU `apps/web/src/lib/knowledgeCycle.ts`, NEU `tests/app/knowledge-cycle.test.ts` (3 Tests); geändert `apps/web/src/pages/Start.tsx` (Flow-Section), `apps/web/src/i18n.ts` (`cycle.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 123 Dateien / 656 Tests (+1 Datei, +3 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert: genau vier Schritte in Reihenfolge capture→validate→use→maintain, Ziele exakt die vorhandenen Routen, nicht-leere Label-/Beschreibungs-Keys.

**Restlücken/Nicht-Ziele:** keine neuen Datenquellen, keine neue Engine, keine neue Navigation, keine Backend-Änderung, keine Stufe-2-Arbeit, keine Metamorphose-/Architektur-Dokumente, kein RAG/Vector/Reasoner-Umbau, keine Ticketserie, keine Fake-Funktionen/Mutationen. „Use" zeigt auf `/fragen` (aktiver, quellengebundener Nutzungsfluss); `/bibliothek` bliebe als Alternative möglich. Die Section ist reine Arbeitsführung über bestehende Routen.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/knowledgeCycle.ts tests/app/knowledge-cycle.test.ts apps/web/src/pages/Start.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(start): show knowledge-OS cycle as clear work guidance (SCRUM-261)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-262 — Bibliothek: Nutzbarkeit und Reife je Treffer klarer anzeigen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Library.tsx` rendert pro Treffer StatusPill (`deriveStatus(k)`), `KnowledgeTypeTag`, Titel, Autorzeile, Match-Gründe (bei aktiver Suche), Kategorie, `ConfidenceBar` und — nur für validierte KOs (`canRevalidate`) — den Revalidate-Button. Server-Search/Filter (`buildLibraryQuery`/`useLibrarySearch`), client-seitiges Re-Ranking (`searchLibrary`) und Fensterung/Limit (`windowList`) sind intakt. `koOverview(ko).usability` (ready/in-review/needs-work) liefert bereits die ehrliche Reife (validiert → ready, pruefung → in-review, offen → needs-work). Lücke: die Zeile zeigt keine Klartext-Reife/Nutzbarkeit. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Neuer reiner Helfer `apps/web/src/lib/libraryMaturity.ts`: `libraryMaturity(ko) → { usability, labelKey, tone }`, abgeleitet über `koOverview` — `ready` → „Nutzbar" (pos), `in-review` → „In Prüfung" (warn), `needs-work` → „Zu prüfen" (neutral). In `Library.tsx` zeigt jede Trefferzeile zusätzlich eine kompakte Reife-Plakette (links neben StatusPill). Offene KOs erscheinen damit nie als „Nutzbar". StatusPill, KnowledgeTypeTag, Match-Gründe, ConfidenceBar, Revalidate-Button, Export, Filter und Limit-Hinweis unverändert. Keine neue Suche/Mutation, kein Backend.

**Geänderte Dateien:** NEU `apps/web/src/lib/libraryMaturity.ts`, NEU `tests/library/library-maturity.test.ts` (3 Tests); geändert `apps/web/src/pages/Library.tsx` (Reife-Plakette + MATURITY_TONE), `apps/web/src/i18n.ts` (`lib.maturity.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 124 Dateien / 659 Tests (+1 Datei, +3 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert: validiert → nutzbar/pos, zugewiesen-offen → in Prüfung/warn, offen → zu prüfen/neutral und nie „nutzbar".

**Restlücken/Nicht-Ziele:** keine neue Suche, keine Vector-/RAG-/Semantik-Suche, keine Backend-Änderung, keine neue Mutation außer dem bestehenden Revalidate-Button, keine Stufe-2-Arbeit, kein Redesign, keine Ticketserie. Die Reife wird ehrlich aus dem vorhandenen KO abgeleitet (kein neues Statusmodell). „Aktuell halten/revalidieren" bleibt über den vorhandenen Revalidate-Button (für validierte KOs) abgebildet; die Reife-Plakette ergänzt die Klartext-Nutzbarkeit, ohne ihn zu duplizieren.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/libraryMaturity.ts tests/library/library-maturity.test.ts apps/web/src/pages/Library.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(library): show maturity/usability per result (SCRUM-262)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-263 — Risk/Gaps: Wissenslücke in Capture-Kontext überführen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Risk.tsx` zeigt offene Gap-Zeilen mit Prioritäts-Pill, Frage, nächster Handlung (`gapNextStep`) und den Controls (Priorität/Zuweisen/Schließen/Löschen) — aber keinen Übergang nach `/erfassen`; der Nutzer müsste die Frage manuell kopieren. `Capture.tsx` seedet `raw` über `setRaw` (Beispiel/Diktat/Upload), las aber KEINEN Query-Parameter; `useNavigate` ist importiert, `useSearchParams` nicht. Kein P0/P1, keine Backend-Lücke.

**Umsetzung (minimal, DOM-frei):** Neuer reiner Helfer `apps/web/src/lib/captureFromGap.ts`: `captureGapHref(question)` baut `/erfassen?gap=<encoded>`, `readGapContext(params)` liest die Frage zurück (null bei leer/fehlend). In `Risk.tsx` erhält jede OFFENE Gap-Zeile einen sichtbaren CTA „Wissen erfassen" (`<Link>` auf `captureGapHref(g.question)`) — geschlossene Gaps (Controls nur bei `status==="offen"`) bekommen keinen CTA. In `Capture.tsx` wird `?gap=` via `useSearchParams` gelesen: die Rohnotiz `raw` startet (lazy init) mit der Frage als Startkontext, und ein gestrichelter Kontext-Banner zeigt die Frage + den ehrlichen Hinweis „Ergänze deine Erfahrung — die KI strukturiert daraus einen Entwurf, du prüfst und reichst ein." Kein automatisches KO, keine Lücken-Schließung, kein Backend; der bestehende Capture-Flow (Modi/Uploads/Diktat/Interview/Draft/Strukturieren/Submit) bleibt unverändert (ohne `?gap=` startet `raw` leer wie bisher).

**Geänderte Dateien:** NEU `apps/web/src/lib/captureFromGap.ts`, NEU `tests/capture/capture-from-gap.test.ts` (4 Tests); geändert `apps/web/src/pages/Risk.tsx` (Link-Import + CTA), `apps/web/src/pages/Capture.tsx` (`useSearchParams` + raw-Seed + Banner), `apps/web/src/i18n.ts` (`risk.gapCapture`, `capture.gapContext*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 125 Dateien / 663 Tests (+1 Datei, +4 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert: Link mit URL-encodierter Frage, Round-Trip read/build, Trimmen, leerer/fehlender Parameter → kein Kontext.

**Restlücken/Nicht-Ziele:** keine Backend-Änderung, keine neue Task-Engine, keine automatische KO-Erzeugung/Lücken-Schließung, keine Stufe-2-Arbeit, kein RAG/Vector/Reasoner-Umbau, kein Redesign, keine Ticketserie. Der Nutzer bleibt in Kontrolle (Kontext sehen → Erfahrung ergänzen → mit KI strukturieren → Entwurf prüfen → einreichen). Die Gap-Frage ist nur Startkontext für die Rohnotiz, kein fertiges Wissen; die Lücke wird nicht automatisch geschlossen.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/captureFromGap.ts tests/capture/capture-from-gap.test.ts apps/web/src/pages/Risk.tsx apps/web/src/pages/Capture.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(risk,capture): start capture from an open knowledge gap (SCRUM-263)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-264 — Ask: unbeantwortete Frage direkt in Capture-Kontext führen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Ask.tsx` zeigt bei unbeantworteter Frage (`result.answered === false`) eine Gap-Karte mit Badge, Titel/Body, Nächster-Schritt-Text und genau EINEM Link „Zu den Wissenslücken" (`/risiko`). Der beantwortete Pfad (Antwort/Trust/Quellen/Helpful) ist davon getrennt. Die gestellte Frage liegt im `q`-State (wird nach dem Fragen nicht geleert, könnte aber vom Nutzer im Eingabefeld nachträglich editiert werden). `captureGapHref(question)` aus SCRUM-263 (`lib/captureFromGap.ts`) baut bereits `/erfassen?gap=<encoded>`. Kein P0/P1, keine Backend-Lücke.

**Umsetzung (minimal, FE-only):** Neuer `asked`-State hält die zuletzt tatsächlich gestellte Frage (gesetzt im Submit-Handler vor `ask.mutate()`), damit der Capture-Kontext exakt die gestellte Frage ist — unabhängig von späterer Eingabe-Bearbeitung. In der Gap-Karte eine zweite klare CTA „Wissen erfassen" als `<Link>` auf `captureGapHref(asked)` ergänzt (gefüllter Button), daneben bleibt der bestehende Link „Zu den Wissenslücken" erhalten (beide in einer flex-wrap-Reihe). Damit nutzt Ask exakt denselben Mechanismus wie SCRUM-263 (`?gap=` → Capture-Banner + Rohnotiz-Seed). Der beantwortete Pfad und Helpful/Quellen sind komplett unverändert. Kein automatisches KO, keine Lücken-Schließung, kein Backend, kein Reasoner-/RAG-Umbau.

**Geänderte Dateien:** `apps/web/src/pages/Ask.tsx` (asked-State + zweite CTA + Import `captureGapHref`), `apps/web/src/i18n.ts` (`ask.toCapture` DE/EN), `docs/qm/claude-after-report.md`. (Helper/Tests aus SCRUM-263 wiederverwendet — `tests/capture/capture-from-gap.test.ts` deckt `captureGapHref` bereits ab.)

**Tests/Gates:** `npm run check` grün — 125 Dateien / 663 Tests. `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Kein neuer Test nötig: die CTA verwendet ausschließlich den bereits getesteten `captureGapHref`; die UI-Verdrahtung ist trivial und durch tsc abgesichert.

**Restlücken/Nicht-Ziele:** keine Backend-Änderung, keine neue Reasoner-/RAG-/Vector-Architektur, kein automatisches KO, keine automatische Lücken-Schließung, keine Stufe-2-Arbeit, kein Redesign, keine Ticketserie. Die „Wissen erfassen"-CTA erscheint nur, wenn eine gestellte Frage vorliegt (`asked` gesetzt); beantwortete Fragen zeigen weiterhin ausschließlich Antwort/Quellen/Helpful.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): offer capture-from-question CTA on unanswered gap card (SCRUM-264)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-265 — Ask: produktnahe Beispielfragen als Startimpuls
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Ask.tsx` hat ein Eingabefeld (`q`/`setQ`) + Submit; der Platzhalter („Warum verliert Presse P2 Druck?") war NICHT seed-konform (Presse P2 existiert nicht im Demo-Bestand). Bestehende Ask-Helfer: `askResponse.ts`, `askView.ts`, `mobileAsk.ts`. Der Seed (SCRUM-257) enthält validierte KOs (Ventil X/Überdruck, Filter F3 — beide 2× grün → validiert) und die offene Industrie-Lücke „Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?". Diese Daten erlauben ehrliche Beispiele für beide Ausgänge (quellengebundene Antwort vs. Wissenslücke). Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Neuer reiner Helfer `apps/web/src/lib/askExamples.ts` (`ASK_EXAMPLES`: drei produktnahe Beispiele mit `id`/`questionKey`/`kind`): `valve` & `filter` (kind „answerable" → treffen validiertes Demo-Wissen → quellengebundene Antwort), `dosing` (kind „gap" → Linie L4 / Dosierwert / Schichtwechsel → ehrliche Wissenslücke → Capture-Folge). In `Ask.tsx` werden die Beispiele als klickbare Chips direkt unter dem Eingabefeld gerendert; ein Klick setzt NUR `q` (`setQ(t(questionKey))`) und löst KEINE Anfrage aus (`type="button"`). Platzhalter (DE/EN) produktnäher und seed-konform aktualisiert. Antwort-/Gap-/Capture-CTA-/Helpful-Pfade unverändert. Kein Backend, kein Reasoner-/RAG-/Vector-Umbau, keine Auto-Ausführung.

**Geänderte Dateien:** NEU `apps/web/src/lib/askExamples.ts`, NEU `tests/ask/ask-examples.test.ts` (3 Tests); geändert `apps/web/src/pages/Ask.tsx` (Beispiel-Chips + Import), `apps/web/src/i18n.ts` (`ask.examplesLabel`, `ask.example.*` + Platzhalter DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 126 Dateien / 666 Tests (+1 Datei, +3 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert: 2–3 Beispiele mit eindeutigen IDs und `ask.example.`-Keys, beide Ausgänge (answerable + gap) vertreten, Linie-L4-Dosing-Beispiel als „gap".

**Restlücken/Nicht-Ziele:** kein Backend, keine Reasoner-/RAG-/Vector-Architektur, keine automatische Frage-Ausführung, keine neue Suchmaschine, keine Stufe-2-Arbeit, kein Redesign, keine Ticketserie. Hinweis: Die „answerable"-Beispiele treffen das deutschsprachige Demo-Wissen über Token-Überschneidung; in EN-Locale kann dieselbe Frage zur Lücke führen (Seed ist deutsch) — bewusst akzeptiert, da der Stage-1-Demo-Bestand deutschsprachig ist. Die Chips sind reine Vorlagen; der Nutzer entscheidet, ob/wann er fragt.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/askExamples.ts tests/ask/ask-examples.test.ts apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): product-near example questions as starting impulse (SCRUM-265)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-266 — Ask: Beispiel-Fragen mit Ergebnis-Erwartung kennzeichnen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** Aus SCRUM-265 liefert `askExamples.ts` `ASK_EXAMPLES` mit `kind` („answerable"/„gap"); `Ask.tsx` rendert sie als klickbare Chips (Klick setzt nur `q`, kein Auto-Ask). Bisher zeigte der Chip nur die Frage — keine Ergebnis-Erwartung. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Helper `askExamples.ts` um einen reinen View-Mapper `askExpectation(kind) → { labelKey, tone }` erweitert: `answerable` → „findet validiertes Wissen" (tone „answer"), `gap` → „zeigt Wissenslücke" (tone „gap"). In `Ask.tsx` zeigt jeder Chip jetzt zusätzlich ein dezent getöntes Erwartungs-Badge (answer = pos-Tönung, gap = warn-Tönung) neben der Frage — answerable und gap sind damit visuell und semantisch unterscheidbar. Klickverhalten exakt gleich: der Button setzt weiterhin nur das Eingabefeld (`setQ(t(questionKey))`), keine Anfrage. Antwort-/Gap-/Capture-/Helpful-Pfade unverändert. Kein Backend, kein Reasoner-/RAG-/Vector-Umbau, keine neuen Beispiele.

**Geänderte Dateien:** `apps/web/src/lib/askExamples.ts` (Mapper + Typen), `tests/ask/ask-examples.test.ts` (+3 Tests), `apps/web/src/pages/Ask.tsx` (Badge + EXPECT_TONE), `apps/web/src/i18n.ts` (`ask.expect.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 126 Dateien / 669 Tests (+3 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: answerable → Antwort-Erwartung, gap → Lücken-Erwartung, beide unterscheidbar (Tönung + Label), jedes Beispiel hat eine auflösbare `ask.expect.`-Erwartung.

**Restlücken/Nicht-Ziele:** kein Backend, keine automatische Frage-Ausführung, keine RAG-/Vector-/Reasoner-Architektur, kein Redesign, keine Stufe-2-Arbeit, keine Ticketserie. Die Erwartung ist ehrliche Orientierung (was das Beispiel demonstriert), keine Garantie über das konkrete Reasoner-Ergebnis; sie bleibt konsistent mit dem deutschsprachigen Demo-Bestand (EN-Hinweis aus SCRUM-265 bleibt gültig).

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/askExamples.ts tests/ask/ask-examples.test.ts apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): label example questions with result expectation (SCRUM-266)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-267 — Library: Reife-Filter für nutzbares Wissen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Library.tsx` rankt server-gefilterte Treffer client-seitig (`searchLibrary` → `ScoredKo[] = {ko, score, matches}`), fenstert dann mit `windowList` (`libraryDisplay.ts`) und zeigt die Count-Linie aus `win.total`. `libraryMaturity.ts` (SCRUM-262) leitet die Reife (`koOverview(ko).usability`: ready/in-review/needs-work) inkl. Plaketten-Label/Tönung ab. Es gab nur die Plakette pro Treffer, keinen Reife-Filter. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** `libraryMaturity.ts` erweitert um `MaturityFilter` (`all` + die drei Reifearten), `MATURITY_FILTERS`, `filterByMaturity(items, filter)` (generisch über `{ ko }`, `all` lässt unverändert, sonst exakt die Plaketten-Reife → `ready` enthält nie offene/ungeprüfte KOs), `countByMaturity(items)` (ehrliche Zähler, `all` = Gesamtzahl) und `maturityFilterLabelKey(filter)` (gleiche Labels wie die Plakette, `all` eigener Key). In `Library.tsx` Reihenfolge geschärft: `ranked → countByMaturity(ranked) → filterByMaturity(ranked, maturity) → windowList(filtered)` — Reife-Zähler über die volle gerankte Liste, Count-/Limit-Linie passend zur sichtbaren (gefilterten) Menge. Filter-Chips „Alle / Nutzbar / In Prüfung / Zu prüfen" mit Counts ergänzt; aktiver Chip hervorgehoben. ReRanking, Match-Gründe, Windowing, Export, Links, Revalidate, Status-/Typ-/Domäne-/Tag-Filter unverändert. Keine neue Suche, kein Backend, keine Vector-/RAG-/Semantik-Suche.

**Geänderte Dateien:** `apps/web/src/lib/libraryMaturity.ts` (Filter-Logik + Typen), `tests/library/library-maturity.test.ts` (+6 Tests), `apps/web/src/pages/Library.tsx` (Filter-State + Chips + Reihenfolge), `apps/web/src/i18n.ts` (`lib.maturity.all` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 126 Dateien / 675 Tests (+6 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: Filterumfang (all + drei Reifearten), `all` unverändert, `ready` nur validierte (nie offene), `in-review`/`needs-work` unterscheidbar, ehrliche Counts (`all` = Gesamtzahl), korrekte Label-Keys.

**Restlücken/Nicht-Ziele:** kein Backend, keine neue Suchmaschine, keine Vector-/RAG-/Semantik-Suche, kein Redesign, keine Stufe-2-Arbeit, keine Ticketserie. Der Reife-Filter nutzt exakt dieselbe `libraryMaturity`/`koOverview`-Logik wie die Plakette (eine Quelle der Wahrheit) und arbeitet rein client-seitig auf der bereits gelieferten/gerankten Liste; der bestehende serverseitige Status-Filter bleibt unabhängig nutzbar.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/libraryMaturity.ts tests/library/library-maturity.test.ts apps/web/src/pages/Library.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(library): maturity filter for usable knowledge (SCRUM-267)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-268 — Lifecycle: Pending-Revalidierungen mit Validierungs-CTA führen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Lifecycle.tsx` zeigt je fälliger Revalidierung (aus SCRUM-254) StatusPill „revalidierung", Anlagenbezug-Chip, Titel als Detail-Link (`/wissen/:id`), den nächsten Schritt (`revalidationView.nextStep`: review|validate|openKo), einen Missing-Hinweis bei nicht auflösbarem KO und den bestehenden „Noch gültig → neue Version"-Button (`confirm` → `revalidate`). `revalidation.ts` lieferte `revalidationView`, aber keine geführte CTA in den Review-/Validierungsfluss. Route `/validierung` vorhanden. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** `revalidation.ts` um `revalidationCta(view) → { labelKey, href } | null` erweitert: `review` (validiert) → „Zur Prüfung" / `/validierung`, `validate` (offen) → „Zur Validierung" / `/validierung`, `openKo` (nicht auflösbar) → `null` (KEIN Fake-Review-Link). In `Lifecycle.tsx` je auflösbarer Pending-Karte eine sichtbare CTA (`<Link>` auf die bestehende Route) unter dem Nächster-Schritt-Hinweis; bei nicht gefundenem KO erscheint keine CTA, nur Detail-Link + Missing-Hinweis. Der bestehende Detail-Link und der „Noch gültig"-Button bleiben unverändert (keine Auto-Bestätigung, keine automatische Revalidierung). Kein Backend, keine neue Workflow-Engine.

**Geänderte Dateien:** `apps/web/src/lib/revalidation.ts` (CTA-Helper + Typ), `tests/library/revalidation.test.ts` (+3 Tests), `apps/web/src/pages/Lifecycle.tsx` (CTA-Link), `apps/web/src/i18n.ts` (`lcy.revalCta.*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 126 Dateien / 678 Tests (+3 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: review→/validierung, validate→/validierung (nicht zur Auto-Bestätigung), openKo→null (keine CTA).

**Restlücken/Nicht-Ziele:** kein Backend, keine automatische Revalidierung, keine neue Lifecycle-/Workflow-Engine, kein Redesign, keine Stufe-2-Arbeit, keine Ticketserie. Beide Review-Pfade (validiert wie offen) führen ehrlich in den vorhandenen Validierungsfluss; die endgültige Bestätigung bleibt der manuelle „Noch gültig"-Button. Nicht auflösbare KOs erhalten bewusst keine CTA.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/revalidation.ts tests/library/revalidation.test.ts apps/web/src/pages/Lifecycle.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(lifecycle): guide pending revalidations with a validation CTA (SCRUM-268)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-269 — Ask: Beispiel-Fragen seed-sicher auch in EN-Locale halten
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `askExamples.ts` (SCRUM-265/266) liefert drei Beispiele mit `kind` + Erwartungs-Badge; `Ask.tsx` rendert Chips (Klick setzt nur `q`). Die Beispieltexte liegen als i18n-Keys (`ask.example.*`) in DE/EN. Der Reasoner-Fallback entscheidet „Treffer vs. Lücke" über Token-Überschneidung (`tokenize`, Wörter >2 Zeichen) zwischen Frage und KO-Titel+Statement. Der Demo-Seed ist deutschsprachig (Ventil X/Überdruck, Filter F3, …). Empirisch geprüft: die bisherige EN-Frage „What to do when valve X must close on overpressure?" verliert „Ventil"/„Überdruck" → erzeugt eine LÜCKE, obwohl das Badge „finds validated knowledge" sagt — ein Ehrlichkeitsbruch in der EN-Demo. EN-Filter (enthält „filter") und EN-Dosing (Lücke) waren bereits konsistent. Kein P0/P1.

**Umsetzung (minimal, DOM-frei + i18n-Konvention):** `AskExample` um `seedTokens: readonly string[]` erweitert — die technischen Seed-Begriffe, die in JEDER Sprache wörtlich erhalten bleiben müssen (valve → „Ventil X"/„Überdruck", filter → „Filter F3", dosing → „Dosierwert"/„Linie L4"/„Schichtwechsel"). Die EN-Strings `ask.example.valve` und `ask.example.dosing` so umformuliert, dass sie die deutschen Seed-Begriffe behalten (Anlagen-/Prozessnamen sind im Werk ohnehin deutsch), mit englischer Klammer-Erklärung wo sinnvoll: „What to do when Ventil X must close on Überdruck (overpressure)?" / „Why does the Dosierwert on Linie L4 fluctuate after each Schichtwechsel (shift change)?". Empirisch verifiziert: valve EN → Treffer KO1 (ventil, überdruck), filter EN → Treffer KO5 (filter), dosing EN → weiterhin Lücke (korrekt). Erwartungs-Badges und Klickverhalten (nur `setQ`, kein Auto-Ask) unverändert. Kein Backend, kein Reasoner/RAG/Vector, keine Übersetzungsengine.

**Geänderte Dateien:** `apps/web/src/lib/askExamples.ts` (seedTokens), `apps/web/src/i18n.ts` (EN `ask.example.valve`/`ask.example.dosing`), `tests/ask/ask-examples.test.ts` (+2 Tests inkl. DE/EN-Seed-Token-Prüfung), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 126 Dateien / 680 Tests (+2 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test liest beide Locales über die i18n-Instanz (`i18n.getResource`) und sichert: jedes Beispiel deklariert Seed-Tokens, und DE- wie EN-Beispieltext enthalten alle deklarierten Seed-Tokens (case-insensitiv) — antwortbare Beispiele verlieren ihre Treffer also nie durch Übersetzung.

**Restlücken/Nicht-Ziele:** kein Backend, keine neue Retrieval-/Matching-Logik, keine Übersetzungsengine, keine neue Suchmaschine, keine Stufe-2-Arbeit, keine Ticketserie. Die Lösung folgt der „originale Seed-Begriffe erhalten"-Variante (sichtbarer Text = gesetzte Query, voll ehrlich) statt sichtbaren Text und Query zu trennen. Der Test prüft die Token-Präsenz in den Strings, nicht den Reasoner-Lauf selbst (kein Backend im Test); die tatsächliche Treffer-Wirkung wurde separat empirisch gegen den Seed bestätigt.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/askExamples.ts apps/web/src/i18n.ts tests/ask/ask-examples.test.ts docs/qm/claude-after-report.md
git commit -m "fix(ask): keep example questions seed-safe in EN locale (SCRUM-269)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-270 — Capture: Gap-Kontext als offene Frage statt fertige Rohnotiz kennzeichnen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `captureFromGap.ts` (SCRUM-263) liefert `captureGapHref`/`readGapContext`. `Capture.tsx` seedet bei `?gap=…` die Rohnotiz `raw` (lazy init) mit der BLOSSEN Gap-Frage und zeigt einen Kontext-Banner (`capture.gapContext*`). Das konnte in der Demo als „fertige Rohnotiz/Wissen" missverstanden werden — eine Frage ist noch kein Wissen. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Helper `captureFromGap.ts` um `gapContextDraft(question, labels) → string` erweitert: erzeugt eine klare Schreibvorlage „`<Offene Frage>`: <Frage>\n\n`<Eigene Erfahrung/Beobachtung ergänzen>`:\n" — die Frage ist explizit als offene Frage markiert, darunter lädt eine leere Zeile zur eigenen Erfahrung ein. Labels werden übergeben (DOM-frei, i18n-fähig). In `Capture.tsx` nutzt die `raw`-Lazy-Init jetzt `gapContextDraft(gapContext, { question: t("capture.gapDraftQuestion"), experience: t("capture.gapDraftExperience") })`; ohne `?gap=` startet `raw` unverändert leer. Banner-Body (DE/EN) geschärft: „Das ist eine offene Frage, noch kein Wissen — sie dient nur als Startkontext. …". Submit/Strukturieren/Reasoner und der gesamte normale Capture-Flow unverändert. Keine KO-Erzeugung, keine Lücken-Schließung, kein Backend.

**Geänderte Dateien:** `apps/web/src/lib/captureFromGap.ts` (Vorlage-Helper + Typ), `tests/capture/capture-from-gap.test.ts` (+2 Tests), `apps/web/src/pages/Capture.tsx` (raw-Seed als Vorlage), `apps/web/src/i18n.ts` (`capture.gapDraftQuestion`/`Experience` + geschärfter `gapContextBody` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 126 Dateien / 682 Tests (+2 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: die Vorlage kennzeichnet die Frage als „Offene Frage", enthält die Erfahrungs-Aufforderung, trennt beides per Leerzeile und endet offen für Eingabe; die Frage wird getrimmt.

**Restlücken/Nicht-Ziele:** kein automatisches KO, keine automatische Gap-Schließung, kein Backend, keine Reasoner-/RAG-/Vector-Architektur, kein Redesign, keine Ticketserie. Die Vorlage ist reiner Startkontext (vom Nutzer frei editierbar); der Nutzer sieht die Gap-Frage weiterhin im Banner. Normaler Capture ohne Gap bleibt exakt wie zuvor (leerer Start).

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/captureFromGap.ts tests/capture/capture-from-gap.test.ts apps/web/src/pages/Capture.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(capture): mark gap context as an open question, not finished note (SCRUM-270)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-271 — Start: besten nächsten Einstieg aus Arbeitsübersicht hervorheben
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `workCenter.ts#buildWorkOverview` liefert die Arbeitssignale bereits in fester Priorität (`WORK_OVERVIEW`-Reihenfolge: conflicts/criticalGaps = critical, revalidation/validation = today, learning = later), gefiltert auf count>0. `Start.tsx` rendert daraus eine Liste (Severity-Punkt, `work.<key>`-Titel, Count, Link) und einen Leerzustand (`start.todoEmpty` + EmptyStateCtas) bei `overview.length === 0`. Es fehlte eine hervorgehobene Führung „fang hier an". Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Helper `workCenter.ts#primaryWorkItem(items) → WorkOverviewItem | null`: deterministisch nach Severity (critical<today<later) **stabil** sortiert → innerhalb derselben Dringlichkeit bleibt die bestehende Reihenfolge; `null` bei leerer Übersicht (Leerzustand bleibt). Keine neue Datenquelle, keine Task-Engine. In `Start.tsx` wird `focus = primaryWorkItem(overview)` berechnet und — nur wenn vorhanden — innerhalb der Arbeitsübersicht-Card oberhalb der Liste eine kompakte Fokus-Card gerendert: Label „Bester nächster Einstieg" / „Start here", Titel aus `work.<key>`, Count, Severity-Punkt und Link auf das vorhandene `it.to`. Bei leerer Übersicht (`focus === null`) erscheint keine Fokus-Card; der bestehende Leerzustand bleibt unverändert. Kein Auto-Handeln, kein Backend.

**Geänderte Dateien:** `apps/web/src/lib/workCenter.ts` (Helper + Severity-Rang), `tests/app/work-center.test.ts` (+4 Tests), `apps/web/src/pages/Start.tsx` (Fokus-Card), `apps/web/src/i18n.ts` (`start.focusLabel` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 126 Dateien / 686 Tests (+4 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: leere Übersicht → null, critical vor today vor later, innerhalb derselben Severity stabile Reihenfolge (erstes Item gewinnt), und das vorhandene Item-Ziel (`to`) wird genutzt.

**Restlücken/Nicht-Ziele:** keine neue Task-Engine, keine neuen Datenquellen, kein Backend, keine Stufe-2-Arbeit, kein Redesign, keine Ticketserie. Es wird genau EIN Einstieg hervorgehoben (deterministisch aus der bestehenden Priorität); die volle Liste und „Alle Aufgaben" bleiben erhalten. Die Auswahl nutzt ausschließlich die vorhandene `buildWorkOverview`-Reihenfolge/Severity.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/workCenter.ts tests/app/work-center.test.ts apps/web/src/pages/Start.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(start): highlight the best next entry from the work overview (SCRUM-271)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-272 — Ask: Query-Parameter als Startfrage unterstützen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Ask.tsx` initialisierte `q` mit `useState("")` und nutzte KEIN `useSearchParams`; ein Deep-Link mit vorbefüllter Frage war nicht möglich. Beispielchips (SCRUM-265/266) setzen `q` über `setQ`. `captureFromGap.ts` (SCRUM-263) etabliert die Query-Konvention (`?gap=…` → `readGapContext`/`captureGapHref`, getrimmt, null bei leer). Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** Neuer reiner Helfer `apps/web/src/lib/askQuestion.ts` analog zu `captureFromGap.ts`: `askQuestionHref(question)` baut `/fragen?q=<encoded>`, `readAskQuestion(params)` liest die Frage zurück (getrimmt, null bei leer/fehlend). In `Ask.tsx` wird `q` via `useSearchParams` lazy aus `?q=` initialisiert (`useState(() => readAskQuestion(params) ?? "")`); ohne/leerem Parameter startet `q` wie bisher leer. KEIN Auto-Submit — der Nutzer klickt weiterhin selbst „Fragen". Beispielchips, Antwort-/Gap-/Helpful-/Capture-CTA-Pfade unverändert. Kein Backend, keine Suche, kein Reasoner/RAG/Vector. Kein i18n nötig (die vorbefüllte Frage ist selbsterklärend).

**Geänderte Dateien:** NEU `apps/web/src/lib/askQuestion.ts`, NEU `tests/ask/ask-question.test.ts` (4 Tests); geändert `apps/web/src/pages/Ask.tsx` (`useSearchParams` + lazy q-Init), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 127 Dateien / 690 Tests (+1 Datei, +4 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Der neue Test sichert: Link mit URL-encodierter Frage, Round-Trip read/build, Trimmen, leerer/fehlender Parameter → null (kein Effekt).

**Restlücken/Nicht-Ziele:** kein Backend, keine automatische Frage-Ausführung, keine neue Retrieval-/RAG-/Vector-Architektur, keine neue Suche, keine Stufe-2-Arbeit, keine Ticketserie. Der Helper ist bereitgestellt; bestehende CTAs (Library/KO-Detail/Hilfe) können künftig `askQuestionHref` nutzen, ohne dass dieses Ticket sie ändert. `q` wird nur beim ersten Render aus der URL übernommen (lazy init); spätere Eingaben/Chips überschreiben frei.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/askQuestion.ts tests/ask/ask-question.test.ts apps/web/src/pages/Ask.tsx docs/qm/claude-after-report.md
git commit -m "feat(ask): support query parameter as starting question (SCRUM-272)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-273 — KO-Detail: Use-CTA mit Ask-Startfrage vorbefüllen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `koCta(action)` (SCRUM-259) bildet `KoNextAction` auf eine CTA ab: `use` → `/fragen`, `review`/`validate` → `/validierung`, `addSource` → `#ko-sources` (Anker). `KnowledgeDetail.tsx` rief `koCta(ov.nextAction)` im Banner auf (Link/Anchor). `askQuestionHref(question)` aus SCRUM-272 (`askQuestion.ts`) baut bereits `/fragen?q=<encoded>`. Bisher führte die Use-CTA nur generisch nach `/fragen` ohne KO-spezifische Startfrage. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** `koCta` um einen optionalen KO-Kontext erweitert: `koCta(action, ko?: { title: string })`. Für `action === "use"` mit nicht-leerem Titel wird der `href` über `askQuestionHref(ko.title)` zu `/fragen?q=<URL-encodierter KO-Titel>`; ohne KO-Kontext bleibt es neutral `/fragen` (Fallback). `review`/`validate` (→ `/validierung`) und `addSource` (→ `#ko-sources`) unverändert, auch mit KO-Kontext. Die Startfrage ist der KO-Titel — KO-spezifisch, lesbar und ohne falsche Behauptung (nur Vorbefüllung, kein Auto-Submit). In `KnowledgeDetail.tsx` Aufruf auf `koCta(ov.nextAction, ko)` umgestellt; das bestehende Link-Rendering trägt den Query-Parameter unverändert. Kein Backend, keine Suche, kein Reasoner/RAG/Vector.

**Geänderte Dateien:** `apps/web/src/lib/koCta.ts` (optionaler ko-Param + use-Deep-Link), `tests/ko/ko-cta.test.ts` (+2 Tests, use-Fall aktualisiert), `apps/web/src/pages/KnowledgeDetail.tsx` (`koCta(ov.nextAction, ko)`), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 127 Dateien / 692 Tests (+2 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die Tests sichern: `use` ohne KO → neutral `/fragen`; `use` + KO → `/fragen?q=…` mit URL-encodierter KO-spezifischer Startfrage; `review`/`validate` bleiben `/validierung`; `addSource` bleibt `#ko-sources` (auch mit KO-Kontext).

**Restlücken/Nicht-Ziele:** kein Auto-Submit (der Nutzer klickt in Ask selbst „Fragen"), kein Backend, keine neue Suche, keine RAG-/Vector-/Reasoner-Architektur, keine Stufe-2-Arbeit, keine Ticketserie. Die Startfrage ist bewusst der KO-Titel (Topic) statt einer generierten Frage — keine grammatische Umformung, damit keine falsche Behauptung entsteht; der Nutzer verfeinert die Frage in Ask frei.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/koCta.ts tests/ko/ko-cta.test.ts apps/web/src/pages/KnowledgeDetail.tsx docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): prefill ask question on use CTA (SCRUM-273)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-274 — Bibliothek: nutzbares Wissen direkt als Ask-Startfrage verwenden
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Library.tsx` rendert je Treffer eine Zeile mit Detail-`<Link>` (Reife-Plakette, StatusPill, TypeTag, Titel, Autor, Match-Gründe, Kategorie, ConfidenceBar) und — nur für validierte KOs — dem Revalidate-Button. Reife-Filter (SCRUM-267), Match-Gründe, Export und Revalidate sind intakt. `askQuestionHref(question)` (SCRUM-272, `askQuestion.ts`) baut `/fragen?q=<encoded>`. Es fehlte ein direkter Sprung aus einem Treffer in den Ask-/Use-Flow. Kein P0/P1.

**Umsetzung (minimal, FE-only):** `askQuestionHref` in `Library.tsx` importiert und je Trefferzeile eine kleine CTA „Fragen" / „Ask" als `<Link to={askQuestionHref(k.title)}>` ergänzt — als Geschwister NEBEN dem Detail-Link (eigener Klickbereich, führt nach `/fragen?q=<KO-Titel>`, nicht ins KO-Detail). Die Startfrage ist der KO-Titel: KO-spezifisch, lesbar, URL-encodiert, ohne falsche Behauptung; Ask füllt nur das Eingabefeld vor (kein Auto-Submit, siehe SCRUM-272). Detail-Links, Reife-Filter/-Plakette, Match-Gründe, Export und Revalidate unverändert. Kein Backend, keine neue Suche, kein Reasoner/RAG/Vector.

**Geänderte Dateien:** `apps/web/src/pages/Library.tsx` (Import + Ask-CTA je Zeile), `apps/web/src/i18n.ts` (`lib.ask` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 127 Dateien / 692 Tests. `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Kein neuer Test nötig: die CTA nutzt ausschließlich den bereits getesteten `askQuestionHref` (`tests/ask/ask-question.test.ts`); die UI-Verdrahtung ist durch tsc abgesichert; alle bestehenden Library-Tests bleiben grün.

**Restlücken/Nicht-Ziele:** kein Auto-Submit, kein Backend, keine neue Suche, keine RAG-/Vector-/Reasoner-Architektur, keine Stufe-2-Arbeit, keine Ticketserie. Die Startfrage ist bewusst der KO-Titel (Topic) statt einer generierten Frage — keine grammatische Umformung, damit keine falsche Behauptung entsteht; der Nutzer verfeinert die Frage in Ask frei. Die CTA erscheint für ALLE sichtbaren Treffer (auch offene/in Prüfung) — das ist ehrlich, da Ask selbst die Quellenbindung/Lücke transparent macht; eine spätere Beschränkung auf „nutzbare" Treffer wäre möglich, war hier aber nicht gefordert.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/pages/Library.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(library): use a knowledge result directly as an ask question (SCRUM-274)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-275 — Start: Use-Schritt im Knowledge-OS-Kreis mit Ask-Beispielfrage verknüpfen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `knowledgeCycle.ts` (SCRUM-261) beschreibt die vier Schritte Capture→Validate→Use→Maintain mit fixen Routen; `use` zeigte generisch auf `/fragen`. `Start.tsx` rendert jeden Schritt als `<Link to={step.to}>`. `askQuestionHref(question)` (SCRUM-272) baut `/fragen?q=<encoded>`. Das Ask-Beispiel `valve` (SCRUM-265/269) nutzt die Seed-Tokens „Ventil X"/„Überdruck", die das deutschsprachige validierte Demo-Wissen treffen. Kein P0/P1.

**Umsetzung (minimal, DOM-frei):** `knowledgeCycle.ts` um `askQuestionHref` ergänzt und den `use`-Schritt von `to: "/fragen"` auf `to: askQuestionHref(USE_QUESTION)` umgestellt. `USE_QUESTION = "Wann muss Ventil X bei Überdruck geschlossen werden?"` — demo-/seed-sicher (enthält „Ventil X"/„Überdruck" → quellengebundene Antwort statt Lücke), lesbar, in der URL encodiert. Capture (`/erfassen`), Validate (`/validierung`) und Maintain (`/lebenszyklus`) unverändert. `Start.tsx` rendert den `to`-Wert unverändert als Link → kein Auto-Submit (Ask füllt nur das Eingabefeld vor), kein UI-Redesign. Kein Backend, keine neue Suche, kein Reasoner/RAG/Vector.

**Geänderte Dateien:** `apps/web/src/lib/knowledgeCycle.ts` (use-Ziel via askQuestionHref + USE_QUESTION), `tests/app/knowledge-cycle.test.ts` (use-Erwartung aktualisiert), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 127 Dateien / 693 Tests. `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die Tests sichern: vier Schritte in Reihenfolge capture→validate→use→maintain; Capture/Validate/Maintain unverändert auf ihren Routen; Use → `/fragen?q=…` mit URL-encodierten Seed-Tokens („Ventil X"/„Überdruck"); nicht-leere Label-/Beschreibungs-Keys.

**Restlücken/Nicht-Ziele:** kein Auto-Submit, kein Backend, keine neue Suche, keine RAG-/Vector-/Reasoner-Architektur, keine Stufe-2-Arbeit, keine Ticketserie, kein UI-Redesign. Die Startfrage ist eine feste, demo-sichere literale Frage mit Seed-Tokens (nicht der i18n-Beispieltext, da `knowledgeCycle.ts` bewusst DOM-/i18n-frei bleibt); inhaltlich deckt sie sich mit dem Ask-Beispiel `valve`. Da der Seed deutschsprachig ist, bleibt die Frage auch im EN-UI seed-sicher (gleiche Begründung wie SCRUM-269).

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/knowledgeCycle.ts tests/app/knowledge-cycle.test.ts docs/qm/claude-after-report.md
git commit -m "feat(start): link knowledge-cycle use step to ask with a demo-safe question (SCRUM-275)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-276 — Capture: nach Einreichen den nächsten Schritt zur Validierung sichtbar machen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Capture.tsx#submit` erstellt das KO über `endpoints.ko.create` (+ optional Anhänge) und leitete bei Erfolg **still um** (`onSuccess: (ko) => navigate(\`/wissen/${ko.id}\`)`). Der Nutzer sah auf Capture selbst keine „gespeichert"-Bestätigung und keinen sichtbaren nächsten Schritt zur Validierung. `useNavigate`/`useToast`/`useQueryClient` vorhanden; Routen `/wissen/:id` und `/validierung` existieren. Kein P0/P1.

**Umsetzung (minimal, DOM-frei + UI):** Neuer reiner Helfer `apps/web/src/lib/captureSuccess.ts` mit `captureNextSteps(koId) → [{labelKey:"capture.savedViewKo", to:/wissen/:id}, {labelKey:"capture.savedValidate", to:/validierung}]`. `submit.onSuccess` setzt jetzt `savedKoId`, zeigt einen Erfolgs-Toast, invalidiert `["validation"]`/`["kos"]` und **setzt das Formular zurück** (kein versehentlicher Doppel-Submit; Modus bleibt) — KEIN stilles Weiterleiten mehr. Eine Success-Card oben auf Capture meldet „Wissensobjekt gespeichert." + ehrlichen Hinweis „automatisch validiert wird nichts" und rendert die echten nächsten Schritte als `<Link>`-CTAs (Objekt ansehen / Zur Validierung) plus „Weiteres erfassen" (verwirft nur die Card). Der nun ungenutzte `useNavigate`-Import/`navigate` wurde entfernt. Bestehende Modi, Strukturieren, Anhänge, Save-Readiness und Gap-Kontext unverändert. Kein Backend, keine automatische Validierung, keine neue Engine, kein Redesign.

**Geänderte Dateien:** NEU `apps/web/src/lib/captureSuccess.ts`, NEU `tests/capture/capture-success.test.ts` (3 Tests); geändert `apps/web/src/pages/Capture.tsx` (savedKoId-State, onSuccess→Success-Card+Reset, Link-Import, navigate entfernt), `apps/web/src/i18n.ts` (`capture.saved*` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 128 Dateien / 696 Tests (+1 Datei, +3 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: nächste Schritte führen zum erstellten KO (`/wissen/:id`) und zur Validierung (`/validierung`), nicht-leere Labels/Ziele, KO-ID korrekt im Detail-Link.

**Restlücken/Nicht-Ziele:** kein Backend, keine automatische Validierung (nur „gespeichert / nächster Schritt", keine Fake-Erledigung), keine neue Task-Engine, keine neue Capture-/OCR-/Reasoner-Architektur, keine Stufe-2-Arbeit, keine Ticketserie, kein UI-Redesign. Das bisherige stille Auto-Weiterleiten wurde bewusst durch die explizite, nutzergesteuerte Success-Card ersetzt (entspricht „Kein automatisches Weiterleiten" und macht den Speichern-Erfolg auf Capture klar sichtbar). Das Formular wird nach Erfolg geleert, um Doppel-Submits zu vermeiden; der Modus bleibt erhalten.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/captureSuccess.ts tests/capture/capture-success.test.ts apps/web/src/pages/Capture.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(capture): show next step to validation after submit (SCRUM-276)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-277 — Validation: nach Entscheidung den nächsten Use-/Detail-Schritt sichtbar machen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Validation.tsx` hat zwei Entscheidungs-Mutationen — `rate` (grün/up) und `reviewWithFeedback` (gelb/rot = warn/down, mit Pflicht-Kommentar) — die im Erfolg NUR `invalidate()` (und beim Feedback das Formular schließen) ausführten; keine Rückmeldung/Next-Step. `Verdict = "up"|"warn"|"down"` = `ReviewVerdict` (`reviewDecision.ts`). `Link` ist importiert, die KO-Karte (`k`) trägt `k.id`/`k.title`. `askQuestionHref` (SCRUM-272) baut `/fragen?q=…`. Routen `/wissen/:id` und `/fragen` vorhanden. Kein P0/P1.

**Umsetzung (minimal, DOM-frei + UI):** `reviewDecision.ts` um `reviewNextSteps({id,title,verdict}) → ReviewNextStep[]` erweitert: immer „Objekt ansehen" (`/wissen/:id`); NUR bei Freigabe-Stimme (`up`) zusätzlich „Wissen nutzen (fragen)" via `askQuestionHref(title)` (`/fragen?q=<KO-Titel>`). In `Validation.tsx` führen `rate`/`reviewWithFeedback` jetzt den `title` mit; ihre `onSuccess` setzen `lastDecision = {id,title,verdict}` (zusätzlich zum bestehenden `invalidate`/Feedback-Reset). Eine kompakte Success-Card oben am Board meldet „Bewertung erfasst." + den KO-Titel und rendert die nächsten Schritte als `<Link>`-CTAs (+ Schließen-„×"). Keine automatische Navigation, keine automatische Freigabe/Nutzung (der Ask-CTA prefilled nur das Eingabefeld — kein Auto-Submit; Ask zeigt selbst den echten Status/Lücke). Warn/Ablehnen-Feedback-Flow, Pflichtbegründung, Review-Aktionen, Zuweisung, Filter und Sortierung unverändert. Kein Backend, keine neue Engine, kein Redesign.

**Geänderte Dateien:** `apps/web/src/lib/reviewDecision.ts` (reviewNextSteps + Import askQuestionHref), `tests/validation/review-decision.test.ts` (+2 Tests), `apps/web/src/pages/Validation.tsx` (lastDecision-State, title in Mutationen, Next-Step-Card, Imports), `apps/web/src/i18n.ts` (`val.decisionSaved`/`val.nextViewKo`/`val.nextUse` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 128 Dateien / 698 Tests (+2 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: Freigabe (up) → KO ansehen (`/wissen/:id`) + Wissen nutzen (`/fragen?q=` mit URL-encodiertem KO-Titel); Rückfrage/Ablehnung (warn/down) → nur KO-Detail-Link, kein Use-Schritt.

**Restlücken/Nicht-Ziele:** kein Backend, keine neue Validierungsengine, keine automatische Freigabe/Nutzung, keine neue Task-Engine, keine RAG-/Vector-/Reasoner-Architektur, keine Stufe-2-Arbeit, keine Ticketserie, kein UI-Redesign. Der Use-CTA erscheint bewusst nur bei der Freigabe-Stimme — und auch dann ohne Anspruch auf „validiert" (mehrere Stimmen können nötig sein); die Wortwahl bleibt „Bewertung erfasst" + „Wissen nutzen (fragen)". Die Rückmeldung referenziert das KO über den Titel; das KO-Detail bleibt jederzeit verlinkt.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/reviewDecision.ts tests/validation/review-decision.test.ts apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): show next use/detail step after a review decision (SCRUM-277)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-278 — Lifecycle: nach Revalidierung den nächsten Detail-/Use-Schritt sichtbar machen
**Datum:** 2026-06-27 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung).

**Vorab-Befund (read-only):** `Lifecycle.tsx#confirm` führt die Revalidierung über `endpoints.ko.act(id, {action:"revalidate"})` aus und invalidierte im Erfolg NUR `["lifecycle"]` — keine Rückmeldung/Next-Step. Jede Pending-Karte löst die ID per `revalidationView(id, kos)` auf (`view.found`, `view.title`); `Link` ist importiert, `askQuestionHref` (SCRUM-272) vorhanden, Routen `/wissen/:id` und `/fragen` existieren. Pending-Liste, Asset-Change-Flow und Lernpfad sonst intakt. Kein P0/P1.

**Umsetzung (minimal, DOM-frei + UI):** `revalidation.ts` um `revalidationNextSteps({id,title,found}) → RevalidationNextStep[]` erweitert: immer „Objekt ansehen" (`/wissen/:id`); NUR wenn der Titel bekannt ist (`found`, KO im geladenen Bestand auflösbar) zusätzlich „Wissen nutzen (fragen)" via `askQuestionHref(title)` (`/fragen?q=<KO-Titel>`). In `Lifecycle.tsx` führt `confirm` jetzt den KO-Kontext mit (`{id, title, found}` aus dem vorhandenen `view`); `onSuccess` setzt zusätzlich zum bestehenden Invalidate `lastRevalidated`. Eine kompakte Success-Card oben in der Pending-Sektion meldet „Revalidierung erfasst." + KO-Titel und rendert die nächsten Schritte als `<Link>`-CTAs (+ Schließen-„×"). Keine automatische Navigation, keine zusätzliche/automatische Revalidierung, keine automatische Nutzung (Ask-CTA prefilled nur, kein Auto-Submit). Pending-Liste, Asset-Change-Flow und Lernpfad unverändert. Kein Backend, keine neue Engine, kein Redesign.

**Geänderte Dateien:** `apps/web/src/lib/revalidation.ts` (revalidationNextSteps + Import askQuestionHref), `tests/library/revalidation.test.ts` (+2 Tests), `apps/web/src/pages/Lifecycle.tsx` (lastRevalidated-State, confirm trägt KO-Kontext, Next-Step-Card, X-Import), `apps/web/src/i18n.ts` (`lcy.revalSaved`/`lcy.nextViewKo`/`lcy.nextUse` DE/EN), `docs/qm/claude-after-report.md`.

**Tests/Gates:** `npm run check` grün — 128 Dateien / 700 Tests (+2 Tests). `apps/web` `tsc --noEmit` grün. Biome + dependency-cruiser sauber. Die neuen Tests sichern: auflösbares KO (found) → KO ansehen (`/wissen/:id`) + Wissen nutzen (`/fragen?q=` mit URL-encodiertem Titel); nicht auflösbares KO (found=false) → nur KO-Detail-Link.

**Restlücken/Nicht-Ziele:** kein Backend, keine automatische Revalidierung über die bestehende Aktion hinaus, keine automatische Nutzung, keine neue Lifecycle-/Task-Engine, keine RAG-/Vector-/Reasoner-Architektur, keine Stufe-2-Arbeit, keine Ticketserie, kein UI-Redesign. Der Use-CTA erscheint nur bei auflösbarem KO (Titel bekannt); bei nicht auflösbarem KO bleibt der ehrliche KO-Detail-Link (über die ID). Die Rückmeldung benennt das KO über den Titel.

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/revalidation.ts tests/library/revalidation.test.ts apps/web/src/pages/Lifecycle.tsx apps/web/src/i18n.ts docs/qm/claude-after-report.md
git commit -m "feat(lifecycle): show next detail/use step after revalidation (SCRUM-278)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-279 — End-to-End Demo-Review: Kernzyklus Capture → Validate → Use → Maintain (read-only, kein Code-Fix)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft (Codex steuert, Pedi entscheidet Richtung). Nur Prüfung/Dokumentation.

**Prüfumfang & -methode:** Code-/Route-/Test-Level-Review (kein Live-Klickpfad — der Sandbox fehlt Chromium/Live-Server, dokumentiert seit SCRUM-241/246). Geprüft: `npm run check` (128 Dateien / 700 Tests grün), `apps/web tsc --noEmit` grün; Seed-Garantien (`seed.test`); Verdrahtung aller Kernzyklus-Verknüpfungen (SCRUM-251…278) per Quellsichtung.

### 1. Kurzfazit
Der Stage-1-Kernzyklus Capture → Validate → Use → Maintain ist durchgängig verdrahtet und mit echten, getesteten Cross-CTAs verbunden. Der Seed liefert einen vollständigen industriellen Demo-Zustand (≥5 KOs, ≥2 validiert, 1 industrielle Wissenslücke „Dosierwert/Linie L4/Schichtwechsel", ≥1 Konflikt, ≥1 fällige Revalidierung, ≥1 Quelle + ≥1 Anhang). Klarwerk präsentiert sich klar als Knowledge OS, nicht als Chatbot. Keine P0/P1-Demo-Blocker auf Code-/Test-Ebene gefunden.

### 2. Demo-Readiness: GELB-GRÜN
Grün auf Code-/Test-Ebene (Build/Tests grün, Flows verdrahtet, Seed vollständig). „Gelb"-Vorbehalt rein umgebungsbedingt: (a) Live-Klickpfad im Sandbox nicht verifizierbar → vor der echten Demo ein manueller Durchklick auf frisch geseedeter Instanz nötig; (b) Reasoner läuft per Default als deterministischer Fallback (ohne `ANTHROPIC_API_KEY`) — ehrlich und funktional, wirkt aber „dünn" als KI; (c) EN-Locale zeigt gemischte Sprache (deutscher Demo-Seed). Keiner dieser Punkte ist ein Blocker.

### 3. P0/P1-Blocker
Keine. (Voraussetzung: Demo läuft gegen eine frisch geseedete Instanz — der Seed ist idempotent und produktionsgeschützt. Ohne Seed wirkt die Oberfläche leer, das ist aber kein Code-Defekt.)

### 4. P2-Verbesserungen (sammeln, nicht jetzt fixen)
- EN-Locale: KO-Titel/Inhalte des Seeds bleiben deutsch → gemischtsprachige Demo im EN-UI. Ask-Beispiele sind dank Seed-Tokens (SCRUM-269) weiter treffsicher, aber die Inhalte nicht. Option: EN-konsistenter Demo-Seed ODER kurzer „Demo-Sprache: DE"-Hinweis.
- Ask-Startfrage aus KO-Titel: ehrlicher KO-Titel (Aussage) statt grammatischer Frage — leicht holprig als „Frage". Bewusst so gewählt (keine Falschbehauptung), aber als Demo-Feinschliff vermerkbar.
- Library-Ask-CTA auf ALLEN Treffern (auch offen/in Prüfung): ehrlich (Ask zeigt selbst Status/Lücke), könnte aber „nutzbar?"-Erwartung verwischen; optional auf „nutzbare" Treffer beschränken.
- Deterministischer Reasoner-Default: für eine starke KI-Wirkung in der Demo optional Modell-Key-Pfad vorbereiten (kein Stage-2-Umbau).
- Informationsdichte auf Risk (Cockpit + Busfactor + Domänenrisiko + Gaps) und Lifecycle (Asset-Change + Pending + Lernpfad) — für Investorenblick ggf. straffen.
- Capture-Success setzt das Formular zurück (inkl. Gap-Banner); für „weitere Lücke erfassen" muss erneut navigiert werden — minor.

### 5. Gut funktionierende Screens/Flows
- Start: Knowledge-OS-Kreis (4 Schritte mit Routen, Use→`/fragen?q=…`), „Bester nächster Einstieg", Arbeitsübersicht, KPIs — vermittelt „kein Chatbot" sofort.
- KO-Detail: Übersichtsbanner (Nutzbarkeit/Status/Trust/Version/Quellen/Anhänge) + ehrliche Next-Action-CTA (Use→Ask mit KO-Frage, review/validate→Validierung, addSource→Anker).
- Ask: Reasoner-Modus-Badge, Beispielchips mit Ergebnis-Erwartung, quellengebundene Antwort (fokussierte Quelle, SCRUM-256), ehrliche Gap-Karte mit „Wissen erfassen"→Capture.
- Validation: textlich geführte Entscheidungen (Freigeben/Rückfrage/Ablehnen) + Pflicht-Feedback + Next-Step-Card.
- Library: Reife-Plakette + Reife-Filter + Ask-CTA je Treffer.

### 6. Schwächer wirkende Screens/Flows
- Lifecycle: funktional vollständig (Asset-Change → Pending → Revalidierung → Next-Step), aber dicht gestapelt.
- Risk/Gaps: sehr informationsdicht für einen Investorenblick.
- EN-Locale: gemischte Sprache (deutscher Seed) wirkt unrund.

### 7. Empfehlung für genau EINEN nächsten Block
„**Geführter Demo-Pfad / Stage-1-Storyline**": ein kurzes, seed-gestütztes Demo-Skript (Klickpfad Capture → Validate → Use → Maintain) + minimaler Leerzustands-/Sprachhinweis — KEIN neues Feature, kein Stage-2. Damit wird der bereits vollständig verdrahtete Kernzyklus für Investor/Pedi reibungslos vorführbar; die offenen Punkte sind Präsentation/Führung, nicht fehlende Funktion.

**Gates/Hinweis:** Kein Code-Fix, kein Commit durch Claude. `npm run check` grün, `apps/web tsc --noEmit` grün (nur zur Bestätigung der Demo-Build-Gesundheit ausgeführt). Codex übernimmt Commit/Push/Jira; dieser Review-Eintrag ist append-only dokumentiert.

---

## SCRUM-280 — Geführter Demo-Pfad: Stage-1-Storyline (Capture → Validate → Use → Maintain)
**Datum:** 2026-06-27 · **Rolle:** Claude dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only, kein Feature-Code.

**Vorab-Befund (read-only):** `seed-demo.ts`/`seed.test.ts` liefern einen reproduzierbaren, industrienahen Demo-Bestand: User **Demo Admin** (`admin@demo.klarwerk` / `demo-admin-pass`), **Carla Controller** (controller), **Erik Experte** (experte); KOs „Ventil X bei Überdruck…" (validiert), „Filter F3…" (validiert), „Pumpe P2…" (offen/zugewiesen), Kaltstart/Vorwärmung (Konflikt), Wissenslücke „Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?" (Prio hoch), Revalidierung über Anlage ANL-01, Quelle „Anlagenhandbuch 4.2" + Anhang „skizze.png". Routen `/start /erfassen /validierung /fragen /bibliothek /wissen/:id /risiko /lebenszyklus` vorhanden; alle Kernzyklus-Cross-CTAs (SCRUM-251…278) verdrahtet; SCRUM-279-Review im QM-Log als Grundlage genutzt. Seed-Trigger: CLI (`seedDemo`) oder `POST /api/admin/demo-seed`.

**Dokument erstellt:** `docs/demo/stage-1-demo-path.md` (neu).

**Wichtigste Inhalte:** (1) Demo-Ziel — Klarwerk ist kein Chatbot, sondern Knowledge OS; Leitsatz „The AI may change. Your knowledge never does." (2) Vorbedingungen — frisch geseedete Instanz, Demo-User/Rollen, Reasoner-Modus (deterministisch ohne / Modell mit API-Key), Demo-Sprache deutsch. (3) 7–10-Minuten-Klickpfad in 8 Schritten (Start-Kreis → Capture-Beispiel+Success → Validation-Entscheidung+Next-Step → Ask Ventil X/Überdruck+Quellen → Library/KO-Detail Reife/Trust/Version/Use-CTA → Risk Linie-L4-Lücke→Capture → Lifecycle Revalidierung), je mit Route/Aktion/sichtbarem Beleg/Sprecherhinweis. (4) Seed-Begriffe als Tabelle. (5) P2-Hinweise transparent (EN/DE-Mix, deterministischer Reasoner, Risk/Lifecycle-Dichte). (6) Abschluss-/Entscheidungsfragen für Pedi + genau ein vorgeschlagener nächster Block (Demo-Politur/EN-Seed ODER definierter Stage-1.5-Schritt) — bewusst ohne automatisches Folge-Ticket.

**Geänderte Dateien:** NEU `docs/demo/stage-1-demo-path.md`, `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, keine FE-Dateien.

**Gates:** `npm run check` grün — 128 Dateien / 700 Tests (zur Bestätigung der Demo-Build-Gesundheit; kein Code geändert). `apps/web tsc --noEmit` nicht nötig (keine FE-Dateien berührt). Biome/dependency-cruiser unverändert.

**Restlücken/Nicht-Ziele:** kein Produktcode geändert, kein UI-Fix, kein Refactoring, keine Jira-Strukturänderung, keine Ticketserie, keine Stufe-2-/Metamorphose-/RAG-/Vector-/Reasoner-Arbeit. Das Dokument führt durch die bestehende Oberfläche; die genannten P2-Punkte werden bewusst nur benannt, nicht gelöst. Der Live-Klickpfad sollte vor der echten Demo einmal manuell auf einer frisch geseedeten Instanz verifiziert werden (Sandbox ohne Chromium, vgl. SCRUM-279).

**Commit-/Push-Hinweis:**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
git add docs/demo/stage-1-demo-path.md docs/qm/claude-after-report.md
git commit -m "docs(demo): guided Stage-1 demo path (capture→validate→use→maintain) (SCRUM-280)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-281 — Stage-1 Demo-Dry-Run
**Datum:** 2026-06-27 · **Rolle:** Claude prüft (Codex steuert, Pedi entscheidet Richtung). Kein neuer Produktbau.

**Dry-Run-Art: ECHTE RUNTIME (Backend/HTTP), KEIN Browser-Klickpfad.** Die Klarwerk-App wurde im Sandbox real gestartet (`tsx services/app/src/server.ts`, In-Memory ohne DATABASE_URL), frisch über die Admin-Route demo-geseedet und der komplette Demo-Pfad auf API-/Routen-Ebene durchgeprüft. Ein visueller Browser-Klickpfad ist im Sandbox weiterhin nicht möglich (kein Chromium); die ausgelieferte SPA stammt aus dem vorhandenen `apps/web/dist` (ggf. nicht tagesaktuell — vor echter Demo `apps/web` frisch bauen, vgl. SCRUM-255).

**Ablauf & Belege (live gegen die laufende App):**
- Server-Start grün (`GET /health` → `{status:"ok"}`); SPA-Fallback liefert alle Kernrouten aus: `/start /erfassen /validierung /fragen /bibliothek /risiko /lebenszyklus` → je HTTP 200.
- Admin registriert (erstes Konto), `POST /api/admin/demo-seed` → `{skipped:false, users:3, kos:5, validated:2, gaps:1, conflicts:1, pendingRevalidation:1, attachments:1, sources:1}` — exakt die erwarteten Stage-1-Signale.
- **Capture/Library-Bestand** (`/api/kos`): 5 KOs, validiert = „Ventil X bei Überdruck manuell schließen." + „Filter F3 monatlich auf Verschmutzung prüfen.".
- **Validate** (`/api/validation/board`): echte Prüfobjekte „Pumpe P2…" (trust 0), „Bei Kaltstart… Vorwärmung…" (trust 50, Teil-Review), „Vorwärmung… nicht nötig." (trust 0).
- **Use** (`/api/ask`): „Wann muss Ventil X bei Überdruck geschlossen werden?" → **answered=true, knowledgeClass=gesichert, trust=100, sources=[KO]**, keine Lücke. „…Dosierwert an Linie L4 nach jedem Schichtwechsel?" → **answered=false, ehrliche Wissenslücke erzeugt**. Der quellengebundene/Gap-Kern funktioniert auch im deterministischen Default (ohne API-Key).
- **Risk/Gaps** (`/api/gaps`): „hoch: Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?".
- **Konflikt** (`/api/conflicts`): „truth: Widerspruch: Vorwärmung bei Kaltstart nötig vs. nicht nötig.".
- **Maintain** (`/api/lifecycle/pending`): 1 fällige Revalidierung (KO „Ventil X", Kopplung ANL-01).
- **Analytics** (`/api/analytics`): total=5, byStatus `{validiert:2, offen:3}`.

**Befund:**
- **P0/P1-Blocker: KEINE.** Capture → Validate → Use → Maintain ist gegen die real laufende App praktisch funktionsfähig; Trust, Quellen, Status, Version und die quellengebundene Antwort vs. ehrliche Lücke sind über die API belegt. (Ein 415 beim Seeden im Zwischenlauf war ein Fehler im Prüf-curl — fehlender `content-type` —, KEIN Produktdefekt; mit korrektem Header seedet die Route sauber.)
- **P2 (nur dokumentiert, kein Fix):** (1) Demo muss gegen frisch geseedete Instanz laufen; sonst leere Oberfläche (Seed idempotent/produktionsgeschützt — kein Defekt). (2) Ausgeliefertes `apps/web/dist` ist potenziell stale → vor echter Demo `apps/web` frisch bauen. (3) Deterministischer Reasoner wirkt „dünner" als Modellmodus (ehrlich, funktional). (4) EN/DE-Seed-Mix. (5) Informationsdichte auf Risk/Lifecycle. (6) Visueller Browser-Klickpfad im Sandbox nicht verifizierbar → vor der echten Demo einmal manuell durchklicken.

**Umgesetzter Fix:** keiner (nur P2/Kosmetik gefunden → laut Regel kein Fix, nur Dokumentation).

**Gates:** `npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Kein Produktcode geändert.

**Restlücken:** Browser-/Visual-Dry-Run steht aus (Umgebungslimit); empfohlen als manueller Schritt vor der echten Demo auf frisch gebautem `apps/web` + geseedeter Instanz. Funktional/Daten-seitig sind alle vier Kernzyklus-Stationen live bestätigt.

**Commit-/Push-Hinweis:** (nur dieser After-Report-Eintrag, kein Code)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/qm/claude-after-report.md
git commit -m "docs(qm): Stage-1 demo dry-run report (real runtime, no blockers) (SCRUM-281)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-214 — Audit-Logging & Nachvollziehbarkeit (Bestandsprüfung, kein Neubau)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft (Codex steuert, Pedi entscheidet Richtung). Read-only Nachweis; kein Code geändert.

### 1. Vorab-Befund
Eigenständiges Audit-Modul `services/audit/*` mit append-only **Hash-Kette**:
- `types.ts`: `AuditEntry { seq, at (ISO-Zeit), actor (wer), action, target (ziel), payload, prevHash, hash }`.
- `service.ts`: `record(actor/action/target/payload)` (verkettet via `prevHash`/`hashEntry`), `list(filter: actor/action/target)`, `verify()` (Integrität der Kette).
- `chain.ts`: `GENESIS`, `hashEntry`, `verifyChain` (Manipulationserkennung). Repos: `InMemoryAuditRepo` + `PgAuditRepo` (Persistenz vorhanden).
- Verdrahtung (`build-app.ts`): EINE Audit-Instanz wird an auth, ko, validation, conflicts, ask, library injiziert. Route `auditRoutes` registriert.
- **Event-Abdeckung** (real `audit.record(...)` quer durch die Services): `auth.login/logout`, `ko.created/rated/assigned/attached/commented/revised/deleted/detached`, `conflict.created/escalated/resolved`, `gap.created`, `ask.query`/`answer.helpful`, `library.import`, `user.approve/delete`.
- **Route + RBAC** (`routes/audit-routes.ts`): `GET /api/audit` (mit Filter-Querystring) hinter `guards.requirePermission("ko.validate")` → nur Controller/Admin.
- **UI/Report** (`Analytics.tsx`): Audit-Sektion mit Filtern (Actor/Action/Target), Anzahl „N von M", ehrlicher Leer-/Kein-Treffer-Zustand; stabiler Deep-Link-Anker `#analytics-audit` (SCRUM-229). Zusätzlich Impact-Report-Route nutzt das Audit.
- **Tests** (`services/audit/src/service.test.ts`): FR-AUD-01 (wer/was/wann + fortlaufende Sequenz), append-only (Einträge eingefroren), intakte Kette verifiziert, Filter nach Aktion, **Manipulationserkennung** (nachträglich geänderter Eintrag bricht die Kette → `verifyChain=false`). `seed.test.ts` prüft, dass der Demo-Seed echte Audit-Einträge erzeugt und `audit.verify()===true`. Routen-Tests (`build-app.test`/`.integration.test`) belegen `GET /api/audit` → 200 mit Einträgen.

### 2. Was ist bereits erfüllt (gegen Jira-Akzeptanzkriterien)
- **Audit-Events definiert (wer/wann/Aktion/Ziel):** ✓ `AuditEntry` mit actor/at/action/target/payload; breite, echte Event-Abdeckung.
- **Logs vorhanden & auswertbar:** ✓ append-only Hash-Kette, filterbares `list`, `verify`; In-Memory + Postgres-Repo.
- **UI/Report-Sicht vorhanden/erreichbar:** ✓ Analytics-Audit-Sektion mit Filtern + Deep-Link `#analytics-audit`.
- **Zugriff/RBAC geschützt:** ✓ `GET /api/audit` nur mit `ko.validate` (Controller/Admin).
- **Integrität/Nachvollziehbarkeit (NFR-TAI-01):** ✓ Hash-Kette + Manipulationserkennung getestet; jede Datenänderung ist über die Action-Events rückverfolgbar.

Damit sind die FR-AUD-01/02 und die kerntechnischen SCRUM-214-Kriterien **erfüllt**.

### 3. Ggf. minimaler Fix
**Keiner.** Die bestehende Umsetzung reicht für die technischen Akzeptanzkriterien; es wurde kein echter Code-Gap gefunden. Die offenen Punkte sind ausschließlich Dokumentations-/Scope-Aspekte (siehe Restlücken) — gemäß Auftrag werden sie ehrlich dokumentiert, nicht „gefixt".

### 4. Geänderte Dateien
Nur `docs/qm/claude-after-report.md` (dieser Nachweis-Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests (build/lint/arch/test). Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele (ehrlich dokumentiert)
- **Aufbewahrung/DSGVO:** Das Audit-Log ist **bewusst append-only/unveränderlich** (FR-AUD-02) — es gibt **keine** Lösch-/Purge-/Retention-Mechanik, und das ist Absicht (Manipulationsschutz). Eine selektive DSGVO-Löschung einzelner Audit-Einträge ist damit **technisch nicht vorgesehen**; die breitere DSGVO-Anforderung **NFR-PRV-04** (Auskunft/Löschung/Verarbeitungsverzeichnis) ist ein **separates, noch offenes** Produktthema und nicht Teil von SCRUM-214. Keine Rechtsberatung, keine Persistenz-Migration in diesem Ticket.
- **Missbrauchs-/Anomalie-Erkennung:** **nicht vorhanden** → bewusst als **P2/Nicht-Ziel** dokumentiert (kein neues Audit-/Erkennungssystem in diesem Ticket).
- **Integritäts-Anzeige in der UI:** `verify()` ist serverseitig/getestet, aber in der Analytics-UI gibt es (noch) keinen „Kette geprüft"-Indikator → optionales P2, kein Blocker.

**Empfehlung:** SCRUM-214 ist aus Code-/Test-Sicht schließbar (FR-AUD-01/02 erfüllt). Die DSGVO-/Anomalie-Punkte gehören in eigene, separate Items (NFR-PRV-04 bzw. Security-P2), nicht in dieses Bestandsticket.

### 7. Commit-/Push-Hinweis (nur Nachweis-Doc, kein Code)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/qm/claude-after-report.md
git commit -m "docs(qm): SCRUM-214 audit-logging evidence (sufficient, no code change)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-212 — Zugriffs- & Rechtekonzept (Bestandsprüfung, kein Neubau)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft (Codex steuert, Pedi entscheidet Richtung). Read-only Nachweis; kein Code geändert.

### 1. Vorab-Befund
- **Rollenmodell** (`services/auth`): `Role = viewer | experte | controller | admin`; Nutzer mit `approved`-Flag (Freigabe-Workflow), Passwort-Login + OIDC.
- **Rechtematrix** (`services/rbac/src/policy.ts`): `Permission = ko.read | ko.create | ko.validate | ko.assign | conflict.resolve | users.manage`; `ROLE_PERMISSIONS` (viewer→read; experte→read/create; controller→+validate/assign/conflict.resolve; admin→+users.manage). `can(role, perm)`, `canManageUsers`, `canChangeRole` (Admin kann sich nicht selbst die Admin-Rolle entziehen).
- **Server-Guards** (`services/app/src/http.ts#makeGuards`): `requireUser` → 401 `UNAUTHENTICATED`; `requirePermission(perm)` → 403 `FORBIDDEN: Recht fehlt: <perm>`; Rolle wird aus dem Auth-Token aufgelöst.
- **Routen-Schutz** (`services/app/src/routes/*`): durchgängige Guards — `ko.read` (31×), `ko.create` (20×), `ko.validate` (8×), `ko.assign` (2×), `conflict.resolve` (2×), `users.manage` (2×). Audit-Route ebenfalls `ko.validate`-gated.
- **Auth/OIDC** (`services/auth`): Passwort-Login, Freigabe/Approve, Rollenwechsel, Passwort-Reset, generisches OIDC (`loginWithOidc`, PKCE-Pair, State/Nonce/Verifier-Cookies). 
- **FE-Gating** (`apps/web/src/app/navigation.ts` + `lib/effectiveRole.ts`): `ROLE_RANK` (viewer 0 … admin 3), `minRole` je Nav-Sektion/Item (Erfassen=experte, Validierung/Konflikte/Risiko=controller, Admin=admin, Lesen/Fragen/Bibliothek=viewer), `stufe2`-Flag für Stufe-2-Items; rollengefilterte Command Palette (`canSee`).
- **Tests:** `rbac/policy.test.ts` FR-RBAC-01 (Matrix je Rolle), FR-RBAC-02 (nur Admin verwaltet Nutzer), FR-RBAC-03 (kein Selbst-Entzug), FR-RBAC-04 (`requirePermission`-Guard: Admin 200 / Experte 403 / anonym 401). `auth/service.test.ts` (Approve, FR-RBAC-04 Approve-ohne-Adminrecht→403), `auth/oidc.test.ts` (FR-AUTH-07). Route-Tests (`build-app.test`, diverse `*-routes.test`) belegen Guard-Wirkung (anonym → ≥400, geschützte Routen → 401/403).

### 2. Was ist bereits erfüllt (gegen Jira-Akzeptanzkriterien)
- **Rollen definiert:** ✓ viewer/experte/controller/admin + Rechtematrix.
- **Authentifizierung angebunden:** ✓ Passwort-Login + OIDC (PKCE) + Freigabe-Workflow.
- **Rechte pro Rolle/Datenbereich technisch umgesetzt:** ✓ `ROLE_PERMISSIONS` + `can` + Guards je Aktion/Datenbereich.
- **API-/Routen-Zugriffe geschützt:** ✓ `requirePermission`/`requireUser` durchgängig, 401/403 belegt.
- **UI-Gating konsistent mit Backend-Gating:** ✓ `minRole`-Mapping spiegelt die Backend-Permissions (Erfassen=experte↔ko.create, Validierung=controller↔ko.validate, Admin=admin↔users.manage); Backend ist die autoritative Durchsetzung.

Damit sind FR-RBAC-01…04 + FR-AUTH-07 und die SCRUM-212-Kernkriterien **erfüllt**.

### 3. Ggf. minimaler Fix
**Keiner.** Kein echter Code-Gap; die bestehende Umsetzung deckt die Akzeptanzkriterien ab. Offene Punkte sind betrieblich/Scope (siehe Restlücken) und werden ehrlich dokumentiert, nicht „gefixt".

### 4. Geänderte Dateien
Nur `docs/qm/claude-after-report.md` (dieser Nachweis). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele (ehrlich dokumentiert)
- **OIDC/SSO scharfschalten:** OIDC ist implementiert + getestet, aber für den Live-Betrieb noch zu **konfigurieren/aktivieren** (bekannte Betriebs-Aufgabe, separates Item — kein Code-Gap in SCRUM-212).
- **Zugriffsreview/Least-Privilege-Report:** keine periodische **Access-Review-/Re-Zertifizierungs**-Funktion vorhanden → **P2/Nicht-Ziel** (betrieblich; Admin sieht Nutzer/Rollen live in `Admin.tsx`, aber kein dedizierter Review-Report).
- **FE-Nav-Sichtbarkeit (`canSee`) ist Komfort-Schicht:** in der Vorab-Phase teils über Rollen-Vorschau steuerbar; die **echte Durchsetzung erfolgt serverseitig** (RBAC-Guards) und ist getestet — die FE-`canSee`-Logik selbst ist nicht separat unit-getestet (optionales P2). Keine Sicherheitslücke, da Backend autoritativ.

**Empfehlung:** SCRUM-212 ist aus Code-/Test-Sicht schließbar (Rollen/Auth/RBAC dokumentiert + technisch durchgesetzt, UI konsistent). OIDC-Aktivierung und Access-Review gehören in eigene Betriebs-/P2-Items.

### 7. Commit-/Push-Hinweis (nur Nachweis-Doc, kein Code)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/qm/claude-after-report.md
git commit -m "docs(qm): SCRUM-212 access & permission concept evidence (sufficient, no code change)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-210 — Dokumentation & Onboarding für Nutzer (Bestandsprüfung + kleiner Doku-Fix)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only, kein Produktcode.

### 1. Vorab-Befund
- **Architektur-/Betriebsdoku:** `README.md` (Harness-/Struktur-Überblick, „Loslegen"), `SETUP.md`, `docs/operations/*` (`deploy-hetzner.md`, `gitea-setup.md`, `governance-and-teams.md`, `pre-launch-protection.md`), `docs/knowledge-os/*` (Dossier + Projekt-Status), `docs/demo/stage-1-demo-path.md` (SCRUM-280).
- **Nutzer-facing Hilfe (in-App):** `apps/web/src/pages/Help.tsx` + `apps/web/src/lib/helpTopics.ts` — **10 durchsuchbare Kapitel** (Erststart/Demodaten **„firststart/onboarding"**, Capture, Ask, Library, Validation, Tasks, Risk, Lifecycle, Stufe-2, Mobile), jedes mit Direktlink auf eine echte App-Route, DOM-freie Suche über Titel/Text/Tags, ehrlicher Leerzustand. Getestet: `tests/analytics/help-topics.test.ts` (SCRUM-219: leere/Treffer/Tag/Kein-Treffer).
- **Beispiele:** Capture „Beispiel laden", Ask-Beispielchips mit Ergebnis-Erwartung, geführter Demo-Pfad.
- **Datenschutz/Grenzen:** in Teilen vorhanden (Quellenbindung/Lücke, Reasoner-Modus-Badge, append-only Audit), aber **nicht konsolidiert nutzerseitig** benannt.

### 2. Was ist bereits erfüllt (gegen Jira-Akzeptanzkriterien)
- **Architektur-/Betriebsdoku vorhanden:** ✓ README/SETUP/operations/knowledge-os.
- **Nutzer-Anleitung vorhanden:** ✓ in-App Hilfe (10 Kapitel, durchsuchbar) + Demo-Pfad — ergänzt durch das neue Schnellstart-Dokument (siehe 3).
- **Beispiele vorhanden:** ✓ Capture-/Ask-Beispiele + Demo-Pfad.
- **FAQ/Support bzw. Hilfe-Einstieg vorhanden:** ✓ Hilfe-Seite als zentraler Einstieg (dedizierter Support-Kontakt/FAQ = Restlücke, benannt).
- **Nutzer können selbstständig starten:** ✓ „firststart"-Hilfekapitel + Demo-Seed-Hinweis + Schnellstart.

### 3. Minimaler Doku-Fix
**Neu:** `docs/onboarding/user-quickstart.md` — ein konsolidierter **Nutzer-Schnellstart**, der die vorhandenen Bausteine zusammenführt: Was ist Klarwerk (kein Chatbot), 5-Minuten-Start (Anmelden, Demo-Seed via `/admin`, Hilfe öffnen), Arbeitskreis **Capture→Validate→Use→Maintain** mit Rollen-Wer-darf-was-Tabelle, In-App-Hilfe als Einstieg, Beispiele (Verweis Demo-Pfad), **Grenzen** (Quellenbindung statt Bluff, deterministischer vs. Modellmodus, Demo-Sprache, Mensch entscheidet) und **Datenschutz/Nachvollziehbarkeit** (append-only Audit, RBAC, keine Secrets im Client; DSGVO-Betroffenenrechte als offene Betreiber-Pflicht ehrlich benannt — keine Rechtsberatung) sowie FAQ/Support + Support-Restlücke. Verweist ausschließlich auf vorhandene Routen/Doku. **Kein Produktcode**, kein UI-Eingriff.

### 4. Geänderte Dateien
NEU `docs/onboarding/user-quickstart.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. (Bestehende Hilfe-Logik bleibt durch `help-topics.test.ts` abgedeckt.)

### 6. Restlücken / Nicht-Ziele (ehrlich dokumentiert)
- **Dedizierter Support-Kontakt/FAQ im Produkt:** nicht eingebaut (Support-Weg pro Instanz organisatorisch) → P2/Nicht-Ziel; im Schnellstart benannt.
- **DSGVO-Selbstbedienung (Auskunft/Löschung/Verarbeitungsverzeichnis, NFR-PRV-04):** organisatorisch beim Betreiber, nicht als Produktfunktion → bewusst nur dokumentiert (keine Rechtsberatung, vgl. SCRUM-214).
- **In-App-Verlinkung des neuen Schnellstarts:** Das Onboarding-Dokument liegt im Repo (`docs/onboarding/`); eine zusätzliche Verlinkung aus der Hilfe-Seite wäre ein optionaler FE-Schritt (P2), wurde hier bewusst NICHT gemacht (kein Produktcode).

### 7. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/onboarding/user-quickstart.md docs/qm/claude-after-report.md
git commit -m "docs(onboarding): user quickstart guide (SCRUM-210)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-215 — DSGVO-/Compliance-Konformität laufend sicherstellen (Betreiber-Runbook, docs-only)
**Datum:** 2026-06-27 · **Rolle:** Claude dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only, keine Rechtsberatung, kein Produktcode.

### 1. Vorab-Befund
Kein `docs/compliance/`-Verzeichnis und **kein konsolidiertes DSGVO-Runbook** vorhanden; DSGVO-/Privacy-Bezüge lagen verstreut (Dossier, `user-quickstart.md` Datenschutz-Abschnitt, After-Report SCRUM-214/212, `pre-launch-protection.md`). Technische Grundlagen belegt: append-only Audit-Hash-Kette (SCRUM-214), RBAC/Auth + OIDC (SCRUM-212), keine Secrets im Client, Vorab-Schutz (noindex + Basic-Auth-Gate). Datenfelder geprüft: `users` (Name/E-Mail/Passwort-Hash+Salt/Rolle/approved), `password_resets`, KO (inkl. Autorbezug/Quellen/Anhänge/Historie/Kommentare), Audit-Einträge; vorhandene Aktionen `user.delete`, `ko.deleted`, Passwort-Reset, KO-/Bibliotheks-Export (fachbezogen).

### 2. Was ist bereits erfüllt
- **Technische Schutzmaßnahmen** (Nachweis, kein Neubau): RBAC/Auth/OIDC, append-only Audit + Manipulationserkennung, keine Client-Secrets, noindex/Pre-Launch-Gate, TLS/Backups über Hosting.
- **Teil-Doku** vorhanden: Datenschutz-Hinweis im User-Quickstart, Audit-/RBAC-Nachweise im After-Report, Betriebsschutz in `docs/operations/*`.
- Es fehlte die **bündige Betreiber-Sicht** (VVT-Check, DSFA-Entscheidungshilfe, Betroffenenrechte, AUP, Review-Kadenz) — genau das wurde ergänzt.

### 3. Minimaler Doku-Fix
**Neu:** `docs/compliance/gdpr-compliance-runbook.md` — kompaktes, betreiberorientiertes Runbook (keine Rechtsberatung) mit: Rollen/Verantwortung (Verantwortlicher = Betreiber; ggf. AVV); **VVT-Check** (Verarbeitungen + Datenkategorien als Tabelle + Betreiber-To-dos); **DSFA-Entscheidungshilfe** (Schwellwert-Checkliste, insb. Modellmodus/externer KI-Anbieter); **Betroffenenrechte** (Auskunft/Berichtigung/Löschung/Einschränkung/Export/Widerspruch — was das Produkt heute unterstützt vs. manuell, inkl. ehrlichem Hinweis auf unveränderliches Audit + fehlenden Self-Service-Export); **technische Schutznachweise** (Verweise SCRUM-212/214, G-7, Pre-Launch); **AUP/Nutzungsrichtlinie** für KI-/Knowledge-OS-Nutzung (Datenminimierung, Quellenbindung, KI≠Wahrheit, Modellmodus-Hinweis); **Review-Kadenz** (quartalsweise Checkliste + Trigger-Events + Terminierungsempfehlung); **offene Betreiberpflichten/Restlücken**. Verweist klar auf Audit append-only/Analytics-Audit, RBAC/Auth, `user-quickstart.md` und offene Pflichten.

### 4. Geänderte Dateien
NEU `docs/compliance/gdpr-compliance-runbook.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele (ehrlich)
- **Keine Rechtsberatung:** Rechtsgrundlagen, AVV/Subprozessoren, DSFA-Pflicht und Löschfristen verantwortet der Betreiber/DSB.
- **Self-Service DSGVO-Workflows** (personenbezogener Komplettexport/Auskunft, Löschung im unveränderlichen Audit) sind **nicht** als Produktfeature umgesetzt (NFR-PRV-04) → manuell durch Admin/DSB; mögliches künftiges Item, nicht Teil dieses Runbooks.
- **Server-/Proxy-Logs/IP** außerhalb des App-Audits = Betreiber-Logging-Policy. **Betriebsvereinbarung** zur Audit-Zweckbindung = organisatorisch.

### 7. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/compliance/gdpr-compliance-runbook.md docs/qm/claude-after-report.md
git commit -m "docs(compliance): GDPR/compliance operator runbook (SCRUM-215)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-213 — Secrets-Management einrichten (Betreiber-Runbook, docs-only)
**Datum:** 2026-06-27 · **Rolle:** Claude dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; keine echten Secrets; kein externer Secret-Store installiert.

### 1. Vorab-Befund
- **`.env.example` vorhanden** und gut strukturiert (Header „NIEMALS .env committen") mit dem vollständigen Secret-/Konfig-Inventar: `DATABASE_URL`, `ANTHROPIC_API_KEY` (+`REASONER_MODEL`), `SMTP_USER/PASS` (+Host/Port/From), `OIDC_CLIENT_SECRET` (+öffentliche OIDC-IDs), `EXTERNAL_SEARCH*`, Server-Config. Optional-Design: fehlende Schlüssel → sicherer Fallback (deterministischer Reasoner / kein Versand / SSO ehrlich deaktiviert).
- **`.gitignore`** schließt `.env` und `.env.local` aus.
- **Server-Env-Nutzung** (`services/*`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `OIDC_*`, `SMTP_*`, `APP_BASE_URL`, `CANONICAL_HOST`, `COOKIE_SECURE`, `PORT`, `SEED_ALLOW_PROD`.
- **Client (`apps/web/src`)**: nur Build-Flags `import.meta.env.DEV/PROD` — **keine** `VITE_*`-Secrets, keine API-Keys (G-7 erfüllt).
- **Session-Tokens**: opake Zufallswerte (`randomBytes(32)`, serverseitig gespeichert) → **kein** symmetrisches Signaturgeheimnis; OIDC-Verifikation via **JWKS** (öffentliche Schlüssel).
- **Hardcoded-Secret-Scan** (ohne node_modules/tests/docs): **keine** echten Secrets gefunden (nur i18n-Label `"password"`). 
- Einziger Default-Credential-Hinweis: Pre-Launch-Gate-Passwort steht im **Ops-Doc** `pre-launch-protection.md` (bcrypt-Hash für Traefik + Klartext-Hinweis) — temporäres Vorab-Gate, **kein Code-Secret**; vom Betreiber zu ändern.
- **Kein** `docs/operations/secrets-management.md` vorhanden → Doku-Gap.

### 2. Was ist bereits erfüllt
- Secrets sind aus Code/Repo **ausgeschlossen** (kein hardcoded Secret, `.env`/`.env.local` gitignored, nur Platzhalter in `.env.example`).
- Runtime-Secrets werden **serverseitig via Env** erwartet; sichere Fallbacks ohne Werte.
- **Client-Bundle frei von Secrets** (G-7) — belegt.
- Hosting-/TLS-/Vorab-Schutz dokumentiert (`deploy-hetzner.md`, `pre-launch-protection.md`).
- Es fehlte nur das **konsolidierte Secrets-Runbook** (Inventar/Stores/Rotation/Least-Privilege/Scanning) — ergänzt.

### 3. Minimaler Fix
**Neu:** `docs/operations/secrets-management.md` — Betreiber-Runbook mit: **Secret-Inventar** (Tabelle inkl. „kein App-Signing-Secret nötig" + Trennung Secret vs. Nicht-Secret-Config); **erlaubte/verbotene Speicherorte**; **Store pro Umgebung** (Dev `.env.local`, Prod Coolify-Secrets, optional externer Store als Empfehlung — nicht installiert); **lokale Entwicklung**; **Produktion/Hosting**; **Rotation + Notfallrotation** (inkl. Session-Invalidierung + Audit-Prüfung); **Least Privilege**; **Client-Bundle-Regel (G-7)**; **Secret Scanning/Review** (gitleaks-Empfehlung + Quartals-Review-Verweis); **offene Betreiberpflichten**. Referenziert Audit append-only/Analytics-Audit, RBAC/Auth, `gdpr-compliance-runbook.md` und `deploy-hetzner.md`.

**Kein Produktcode geändert** — es wurde kein echter Security-Bug gefunden (Inventar sauber, keine Client-/Repo-Secrets).

### 4. Geänderte Dateien
NEU `docs/operations/secrets-management.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
- **Externer Secret-Store** (Vault/Doppler/Cloud SM) als Empfehlung dokumentiert, **nicht installiert** (Sandbox-/Scope-Grenze).
- **Secret-Scanning in CI** (gitleaks/trufflehog) = Ops-Aufgabe, nicht eingerichtet.
- **Default-Credentials** (Pre-Launch-Gate, Demo-Seed-Admin) müssen vom Betreiber vor Produktion geändert werden — im Runbook benannt.
- Keine echten Secrets erzeugt; keine Architektur-/Persistenzarbeit; keine Tickets.

### 7. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/secrets-management.md docs/qm/claude-after-report.md
git commit -m "docs(ops): secrets-management runbook (SCRUM-213)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-211 — Wartungs- & Update-Prozess etablieren (Betreiber-Runbook, docs-only)
**Datum:** 2026-06-27 · **Rolle:** Claude dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; keine Infrastruktur-/Runtime-/Modell-Installation; kein Produktcode.

### 1. Vorab-Befund
- **CI-Gates** (`.github/workflows/ci.yml`): build (`tsc --noEmit`) · lint (Biome) · arch (dependency-cruiser) · test (Vitest); Regel „nichts nach `main` ohne grüne Pipeline". Lokal äquivalent `npm run check`.
- **package.json scripts:** `check`, `build`, `lint`, `arch`, `test`, `test:integration`, `start`, `seed:demo`, `smoke:browser`.
- **Deploy/Backup** (`docs/operations/deploy-hetzner.md`): Hetzner + **Coolify** (Git-verbundener Deploy → Push baut/rollt aus), Postgres, Cloudflare; **Backups** (Hetzner-Snapshots + `pg_dump`-Scheduled-Task); Post-Deploy-Smoke `GET /health` → `{"status":"ok"}`; Verwaltungs-Landkarte.
- **Reasoner/Provider** (`build-app.ts` + `reasoner/service.ts`): anbieteragnostisch — ohne `ANTHROPIC_API_KEY` deterministischer Fallback, mit Key Modellmodus (`ModelProvider`/`createModelClientFromEnv`); `Reasoner.status()` exponiert Modus/Provider/Modell (Badge auf `/fragen`). Provider-/Modellwechsel = **Env-Änderung**, kein Umbau.
- **Bezugsdoku** vorhanden: `secrets-management.md`, `gdpr-compliance-runbook.md`, `pre-launch-protection.md`, `governance-and-teams.md`.
- **Kein** `docs/operations/maintenance-update-process.md` → Doku-Gap (Wartungsrhythmus/Rollback/Staging-Verfahren nicht konsolidiert).

### 2. Was ist bereits erfüllt
- **Pflicht-Gates vor Produktiv-Update** vorhanden (CI + `npm run check`).
- **Backups + Health-Smoke + Git-Deploy** dokumentiert.
- **Modell-/Provider-Wechsel ohne Architektur** technisch gegeben (Env + Status-Badge).
- **Security-/Secrets-/DSGVO-/Backup-Bezüge** existieren (separate Runbooks).
- Es fehlte nur das **konsolidierte Wartungs-/Update-Runbook** (Rhythmus, Update-Klassen, Staging, Rollback, Fenster/Rollen, Provider-Evaluation, Post-Update-Monitoring, Notfallpfad) — ergänzt.

### 3. Minimaler Fix
**Neu:** `docs/operations/maintenance-update-process.md` — Betreiber-Runbook mit: Verwaltungs-Landkarte; **Wartungsrhythmus** (wöchentlich/monatlich/quartalsweise/jährlich/ad-hoc); **Update-Klassen** (App, Dependencies, OS/Runtime, DB, Reasoner/Model-Provider, Secrets/Zertifikate); **Vorab-Checkliste**; **Test-/Staging-Verfahren** (Smoke `/health` + Kernpfad); **Pflicht-Gates** (CI/`npm run check`); **Backup-/Rollback-Schritte** (Snapshot/`pg_dump`, Coolify-Redeploy-previous/Git-Revert, DB-Restore, Provider-Env-Rollback); **Wartungsfenster & Rollen**; **Modell-/Provider-Evaluation** (Env-basiert, Status-Badge, DSFA-Check, Fallback-Rollback — keine Architektur); **Security-/Compliance-Review** (an Updates gekoppelt); **Post-Update-Monitoring**; **Notfallpfad**; **offene Betreiberpflichten**. Verweist auf CI-Gates, Deploy-, Secrets- und Compliance-Doku sowie den Demo-Kernpfad.

**Kein Produktcode** — kein echter Betriebs-Bug gefunden (Gates, Backups, Rollback-via-Redeploy, Health, Provider-Switch vorhanden).

### 4. Geänderte Dateien
NEU `docs/operations/maintenance-update-process.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
- **Staging-Umgebung real bereitstellen**, **Restore-Probe regelmäßig durchführen**, **Monitoring/Alerting einrichten**, **Wartungstermine + namentliche Rollen festlegen** — alles **Betreiber-/Ops-Aufgaben** (im Runbook benannt, hier nicht ausgeführt).
- Keine neue Runtime/Infrastruktur, keine Modellinstallation, keine RAG/Vector/Conductor-Arbeit, keine Tickets/Strukturänderung.

### 7. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/maintenance-update-process.md docs/qm/claude-after-report.md
git commit -m "docs(ops): maintenance & update process runbook (SCRUM-211)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-209 — Backups & Disaster Recovery (Bestandsprüfung + Runbook + ehrliche Evidence)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only + sandbox-sichere Evidence; kein Produktcode, keine Infrastruktur, keine produktiven Backups erzeugt/vorgetäuscht.

### 1. Vorab-Befund
- **Persistenz vollständig Postgres-basiert** (`services/app/src/db.ts#migrate` führt 13 Modul-Schemas mit `IF NOT EXISTS`-DDL aus): Auth, KO + Versionen + Evidence, Audit, Capture, Ask, Validation, Conflicts, Lifecycle, **Object-Store (`objects`-Tabelle = Anhänge)**, Import-Candidates, Model-Runs. **In-Memory** (ohne `DATABASE_URL`) = keine Persistenz (nur Dev/Smoke).
- **Kern-Erkenntnis:** Ein vollständiger `pg_dump` sichert **KOs, Anhänge UND Audit gemeinsam** — kein separater Datei-/Objektspeicher. Secrets + Coolify-Config liegen **außerhalb** der DB.
- **Bestehende Backup-Hinweise** (`deploy-hetzner.md`): Hetzner-Snapshots + `pg_dump`-Scheduled-Task, verschlüsselt ablegen; Health-Smoke `/health`.
- **Logischer Export** vorhanden: `GET /api/library/export` (JSON/Markdown/MediaWiki/HTML).
- **Kein** `docs/operations/backup-disaster-recovery.md`, **kein** konsolidiertes Artefakt-Inventar/RTO-RPO/Restore-Runbook/Drill-Protokoll → Doku-Gap.

### 2. Was ist bereits erfüllt
- Automatische Backup-Hinweise (Snapshots + `pg_dump`) und Health-Smoke dokumentiert.
- Schema-Wiederherstellung code-seitig belegt (`migrate`, idempotente DDL).
- Anhänge in Postgres → durch DB-Backup automatisch mitgesichert (kein separater Datei-Restore).
- Logischer Content-Backup-Pfad (Export) **funktioniert** (siehe Evidence).

### 3. Minimaler Fix / bzw. Evidence
**Neu:** `docs/operations/backup-disaster-recovery.md` — Runbook mit: **Artefakt-Inventar** (Postgres inkl. Anhänge+Audit, Env/Secrets, Coolify/Deploy-Config, Git, logische Exporte); **Backup-Zeitplan**; **Aufbewahrung/Offsite/Verschlüsselung**; **RTO/RPO** (Vorschlag RPO ≤ 24 h / RTO ≤ 4 h, vom Betreiber zu bestätigen); **Restore-Runbook** (Stop → Restore → `migrate` → Redeploy → Smoke → Audit-`verify`); **Restore-Drill-Protokoll** (Vorlage, **noch nicht produktiv ausgeführt**); **Objekt-/Attachment-Hinweis**; **Audit-Besonderheit** (nur vollständiger Restore, sonst Kette gebrochen); **Notfall-Kommunikation**; **Sandbox-Evidence**; **offene Betreiberpflichten**.

**Sandbox-Evidence (ehrlich):** Realer **logischer Export-Smoke** gegen lokale In-Memory-Instanz nach Demo-Seed: `GET /api/library/export` → **5 KOs als JSON (4264 Bytes)** mit `title/status/sources` + Markdown-Export. → **Logischer Content-Backup-Pfad belegt.** **NICHT** geprüft (nicht möglich): produktiver `pg_dump`/`pg_restore`-Drill — **kein Postgres/Docker im Sandbox**. „Restore getestet" gilt **ausschließlich** für den logischen Export, **nicht** für Postgres.

**Kein Produktcode** — kein echter Backup-/Restore-Bug gefunden.

### 4. Geänderte Dateien
NEU `docs/operations/backup-disaster-recovery.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Zusätzlich: realer logischer Export-Smoke (siehe Evidence) erfolgreich.

### 6. Restlücken / Nicht-Ziele
- **Produktiver `pg_dump`/Restore-Drill** gegen isolierte Test-DB: **steht aus** (Sandbox-Limit) → Betreiber-/Ops-Aufgabe.
- **Offsite-Kopie + Verschlüsselung** tatsächlich einrichten; **verbindliche RTO/RPO** festlegen und per Drill bestätigen; **Coolify-Config-Export** etablieren.
- Keine Infrastrukturänderung, keine produktiven Backups erzeugt/vorgetäuscht, keine Tickets.

### 7. Empfehlung: **PARTIAL** (nicht voll Done)
**Begründung (gemäß Ehrlichkeits-Leitplanke):** Der **Dokumentations-/Konzept-Teil ist vollständig** (Artefakt-Inventar, Zeitplan, Offsite/Verschlüsselung, RTO/RPO-Vorschlag, Restore-Runbook, Drill-Vorlage) und der **logische Backup-Pfad ist real verifiziert**. ABER das Akzeptanzkriterium „Restore prüfbar/getestet" ist für den **produktiven Postgres-Restore NICHT erfüllt** — ein echter `pg_dump`-Restore-Drill war in der Sandbox nicht möglich und ist nicht durchgeführt. **Empfehlung:** SCRUM-209 als **Partial/Blocked-on-Ops** führen — Doku-Teil abschließbar, aber **erst nach einem protokollierten produktiven Restore-Drill** voll „Done". Das Restore-Drill-Protokoll (§7 des Runbooks) ist die offene Pflicht.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/backup-disaster-recovery.md docs/qm/claude-after-report.md
git commit -m "docs(ops): backup & disaster recovery runbook + honest restore-drill status (SCRUM-209)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-208 — Monitoring & Logging einrichten (Bestandsprüfung + Runbook + ehrliche Evidence)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only + sandbox-sichere Evidence; kein Produktcode, kein Dashboard/Alert installiert oder vorgetäuscht.

### 1. Vorab-Befund
- **Health/Status real vorhanden:** `GET /health` → `{status:"ok"}`; `GET /api/reasoner/status` (FR-RSN-05); `GET /api/ai-status`; `GET /api/reasoner/config`.
- **KI-Betriebsprotokoll:** `GET /api/model-runs` (SCRUM-164/165, RBAC `ko.read`) — pro Reasoner-Lauf Metadaten (`task/provider/model?/status/fallback/demo/startedAt/finishedAt/error?`), **explizit ohne Prompt-/Antworttexte**.
- **Audit (fachlich):** append-only Hash-Kette + Analytics-Audit + `GET /api/audit`.
- **Technische Logs:** `Fastify()` läuft **ohne aktivierten Request-Logger** → Runtime-/Access-Logs entstehen auf **Coolify/Traefik/Container-Ebene** (kein App-interner Request-Log).
- **Kein Prompt-/Content-Logging** im Code (grep leer) — Datenschutz-by-design.
- **Retention:** Session-TTL 14 d, Reset-Token 1 h; keine explizite Audit-/ModelRun-/Log-Retention (Audit append-only by design).
- **Kein** `docs/operations/monitoring-logging.md` → Doku-Gap.

### 2. Was ist bereits erfüllt
- Liveness-/KI-Status-Endpunkte + KI-Betriebsprotokoll + fachliches Audit **vorhanden und real abrufbar** (siehe Evidence).
- **Datenschutzkonforme Logging-Politik** (keine Inhalte/Secrets) belegt.
- Post-Deploy-Smoke (`/health`) bereits im Deploy-/Wartungs-Runbook.
- Es fehlte die **konsolidierte Monitoring-/Logging-Doku** (Scope, Metriken-Katalog, Dashboards/Alerts, Retention, Incident-Triage) — ergänzt.

### 3. Minimaler Fix / Evidence
**Neu:** `docs/operations/monitoring-logging.md` — Runbook mit: Monitoring-Scope; vorhandene Health-/Status-Signale; Audit vs. technische Logs; **datenschutzkonforme Logging-Regeln** (kein Content/Secret); **Metriken-Katalog** (inkl. „Token/Kosten nicht erfasst" P2 und „Latenz ableitbar, nicht aggregiert"); **empfohlene Dashboards** (nicht installiert); **Alert-Regeln** (nicht aktiv, Vorschlag); **Aufbewahrungsfristen**; **Incident-Triage**; **Post-Deploy-Smoke**; **offene Betreiberpflichten**; **Sandbox-Evidence**.

**Sandbox-Evidence (ehrlich, lokal gegen In-Memory):** `/health` → ok; `/api/reasoner/status` & `/api/ai-status` → `{active:false, provider:"deterministic", mode:"deterministic"}`; `/api/model-runs?limit=5` → **3 Läufe** (task=answer, provider=deterministic, status=success, fallback=false, demo=true) **ohne** question/answer/prompt-Felder; `/api/audit` → **24 lückenlos verkettete Events**. → Health/KI-Status/ModelRun/Audit **funktionieren**. **NICHT** geprüft/aktiv: Dashboards, Produktiv-Alerts, externes Uptime-Monitoring, zentrales Log-Management.

**Kein Produktcode** — kein echter Observability-Bug (das fehlende Fastify-Request-Logging ist eine bewusste, ops-delegierte Konstellation, als P2-Option dokumentiert, nicht „gefixt").

### 4. Geänderte Dateien
NEU `docs/operations/monitoring-logging.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Zusätzlich: realer Health/Status/ModelRun/Audit-Smoke erfolgreich.

### 6. Restlücken / Nicht-Ziele
- **Dashboards + Produktiv-Alerts + externes Uptime-Monitoring + zentrales Log-Management:** **ops-seitig offen** (im Runbook benannt).
- **KI-Token/Kosten-Tracking:** nicht erfasst (P2, Provider-Usage nötig).
- Optional Fastify-Request-Logger aktivieren (strukturierte App-Logs) — bewusst nicht in diesem Doku-Ticket geändert.
- Keine Prometheus/Grafana/Cloud-Installation, keine vorgetäuschten Alerts, keine Tickets.

### 7. Empfehlung: **PARTIAL** (nicht voll Done)
**Begründung (Ehrlichkeits-Leitplanke):** Die **Observability-Grundlagen sind real vorhanden und lokal belegt** (Health, KI-Status, KI-Betriebsprotokoll, fachliches Audit, datenschutzkonforme Logging-Politik) und die **Doku ist konsolidiert**. ABER ein zentrales Akzeptanzkriterium — **aktives Monitoring-Dashboard + Produktiv-Alerts** — ist **nicht real aktiv** (in der Sandbox auch nicht herstellbar). **Empfehlung:** SCRUM-208 als **Partial/Blocked-on-Ops** führen; der Code-/Endpunkt-/Doku-Teil ist abschließbar, voll „Done" erst nach Einrichtung von Uptime-Monitor, Dashboard und Alerts durch den Betreiber.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/monitoring-logging.md docs/qm/claude-after-report.md
git commit -m "docs(ops): monitoring & logging runbook + honest dashboards/alerts status (SCRUM-208)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-207 — Anbindung an interne Tools & Workflows (Bestandsprüfung + Runbook + ehrliche Evidence)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only + sandbox-sichere Evidence; kein Produktcode; keine produktive Integration erzeugt/vorgetäuscht.

### 1. Vorab-Befund
- **Integrationsfläche = interne REST-API** (`/api/*`, ~60 Routen, Fastify, auth-geschützt). Relevant: Auth/Session (`/api/auth/login`→Bearer, `/me`, OIDC), **Export** (`/api/library/export` JSON/MD/MediaWiki/HTML), **Import** (`/api/library/import` + `/import/candidates`), **Ask** (`/api/ask`, `/ask/helpful`), **External Search** (`/api/external/search`), Objekte/Anhänge, Status (`/health`, `/api/reasoner/status`, `/api/ai-status`, `/api/model-runs`, `/api/management/snapshot`, `/api/analytics`).
- **Keine** Outbound-Integration im Code (kein Webhook/n8n/Slack/Teams/Jira/Confluence). Einziger externer Client = Anthropic-Modell (`x-api-key`) = LLM-Provider, **keine** Tool-Integration.
- **Kein** Service-/Maschinen-Token, **kein** API-Key-Mechanismus, **kein** Rate-Limit/Quota, **keine** OpenAI-kompatible API. Integrationen nutzen heute ein **Benutzer-Session-Bearer-Token**.
- **Kein** `docs/operations/integration-workflows.md` → Doku-Gap.

### 2. Was ist bereits erfüllt
- **Auth-geschützte, integrationsfähige REST-API** mit Export/Import/Ask/Status — real und nutzbar (siehe Evidence).
- RBAC pro Endpunkt (SCRUM-212); datenschutzkonformes Logging (kein Prompt-Content, SCRUM-208).
- OIDC/SSO vorhanden (föderierte Anmeldung).
- Es fehlte die **konsolidierte Integrationsdoku** + die ehrliche Readiness-Bewertung — ergänzt.

### 3. Minimaler Fix / Evidence
**Neu:** `docs/operations/integration-workflows.md` — Runbook mit: vorhandene Integrationsflächen (Tabelle), Auth-/RBAC-Grenzen (Session-Bearer, keine Service-Token/Rate-Limits), geeignete vs. ungeeignete Use-Cases, **curl-Beispielflows** (Login→Export→Import→Ask→Status), Import/Export-Workflow, Ask-/Knowledge-OS-Workflow, Datenschutz-/Logging-Grenzen, **Anforderungen für erste echte Integration** (Service-Konto, Token/Rate-Limit-Entscheidung, Zielsystem), offene Produktentscheidungen, und die ehrliche Begründung, warum **keine** produktive Integration behauptet wird.

**Sandbox-Evidence (lokal, In-Memory + Seed):** anonym `/api/kos` → **401**; `GET /library/export` → **5 KOs**; `POST /ask` (Ventil X) → **answered=true, gesichert, quellengebunden**; `/api/reasoner/status` → deterministic; `GET /external/search?q=Ventil` → **400** (kein Netz in Sandbox; Endpunkt vorhanden). → Interne API-Integrationsfläche **funktioniert**; produktive externe Integration **nicht belegt (existiert nicht)**.

**Kein Produktcode** — kein echter Integrations-Bug gefunden (External-Search-400 = Sandbox-Netzlimit, kein Defekt).

### 4. Geänderte Dateien
NEU `docs/operations/integration-workflows.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Zusätzlich: realer API-Smoke (Auth/Export/Ask/Status) erfolgreich.

### 6. Restlücken / Nicht-Ziele
- **Keine produktive externe Integration** (n8n/Slack/Jira/Webhook) — existiert nicht.
- **Service-Token/API-Key + Rate-Limit/Quota** nicht vorhanden → Produktentscheidung vor automatisierter/öffentlicher Nutzung.
- **External-Search** in Prod gegen konfigurierten Provider zu verifizieren (Sandbox ohne Netz).
- Kein SDK/RAG/Vector/OpenAI-API, keine Drittanbindung implementiert, keine Tickets.

### 7. Empfehlung: **PARTIAL / Blocked-on-product-decision** (nicht Done)
**Begründung (Ehrlichkeits-Leitplanke):** Die **Integrationsfläche (interne REST-API) ist real, auth-geschützt und lokal verifiziert** (Export/Import/Ask/Status), und die Doku ist konsolidiert. ABER das zentrale Akzeptanzkriterium — **mindestens eine produktive Integration mit einem externen Tool** — ist **nicht erfüllt** (keine vorhanden; in der Sandbox auch nicht herstellbar). **Empfehlung:** SCRUM-207 als **Partial/Blocked-on-product-decision** führen: Readiness/Doku abschließbar, voll „Done" erst nach Produkt-/Ops-Entscheidung (welche Integration, Service-Konto/Token, Zielsystem) + einer real laufenden Erst-Integration.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/integration-workflows.md docs/qm/claude-after-report.md
git commit -m "docs(ops): integration & workflows readiness runbook + honest status (SCRUM-207)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-206 — Evaluation & Qualitätssicherung (Bestandsprüfung + Runbook + Evidence)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; kein Produktcode; keine Eval-Infrastruktur gebaut.

### 1. Vorab-Befund
- **Reasoner-QA** (`services/reasoner/src/service.test.ts`): FR-RSN-01..05 — Aufgaben verfügbar, semantische Auswahl, **keine Halluzination ohne Grundlage**, deterministisches Assist, validiert→`gesichert` mit Quelle, **fokussierte Quelle (SCRUM-256)**, Fallback bei Modell-Offline/-Fehler, Status spiegelt Modell, Interview-Turns, **ModelRun-Protokoll** (success/fallback/error, **kein Prompttext**), configStatus (**keine Secrets**).
- **Ask-QA** (`services/ask/src/service.test.ts`): FR-ASK-01..05 — begründete Antwort mit Quelle; ohne Grundlage → Lücke; Helpful→Trust+Audit; Gap-Lebenszyklus/Priorität.
- **HTTP-E2E** (`services/app/src/ask-routes.test.ts`, SCRUM-242): validiertes KO → Antwort+Quelle, keine Gap; unbeantwortbar → Gap erzeugt+gelistet; Helpful +2; anonym → Guard.
- **DOM-frei** (`tests/ask/*`): ask-view, ask-response, knowledge-class, ask-examples (seed-sicher), gap-priority.
- **Seed** als wiederholbares Eval-Szenario (Ventil X→gesichert; Dosierwert/Quantenflux→Gap), durch `seed.test.ts` gegen Regression gesichert.
- **CI-Gate** (`ci.yml`): kein Merge nach `main` ohne grünen `check` → Qualitätseigenschaften regressionsgeschützt.
- **Kein** `docs/operations/evaluation-quality-assurance.md` → Doku-Gap.

### 2. Was ist bereits erfüllt
- **Wiederholbares, gated Eval-Verfahren vorhanden** = die Test-Suiten (reasoner/ask/HTTP-e2e + DOM-frei), laufen in CI + lokal (`npm run check`).
- **Typische Fragen + erwartetes Verhalten** über den Demo-Seed (Baseline-Paar), live verifiziert.
- **Quellenbindung, Wissenslücke, Trust/Klasse, fokussierte Quelle, Fallback-Stabilität** sind getestet.
- **Regression-Gates** bei Code-/Datenänderung vorhanden (CI + seed.test).
- **ModelRun-Protokoll** als Run-Level-QA (ohne Inhalte).
- Es fehlte nur das **konsolidierte QA-/Eval-Runbook** (Baseline, Metriken, manuelles Review, Modell-Update-Eval) — ergänzt.

### 3. Minimaler Fix / Evidence
**Neu:** `docs/operations/evaluation-quality-assurance.md` — QA-Runbook mit: Eval-Zielen; **Baseline-Fragen** (B1–B4, seed-sicher); **erwartetem Verhalten**; **Metriken** (Answered-Rate, Gap-Honesty, Quellenbindung, Knowledge-Class, Fallback-/Fehlerrate, Latenz); **wiederholbarem Verfahren** (automatisiert via `npm run check`/gezielter Vitest-Lauf + manuelles Review); **Regression-Gates**; **Modell-/Provider-Update-Eval** (Verweis Wartungs-Runbook §8); **Halluzinations-/Quellenbindungsregeln** (geprüft); **ModelRun-Nachweise**; **Evidence**; **P2/Nicht-Ziele** (LLM-as-judge explizit ausgeschlossen).

**Evidence (real ausgeführt):** Gezielter Eval-Testlauf (reasoner+ask+ask-routes+`tests/ask`) → **9 Dateien / 68 Tests grün**. Live-Eval-Paar (In-Memory+Seed): B1 „Ventil X/Überdruck" → `answered=true, gesichert, trust=100, sources#=1`; B2 „Quantenflux ZZZ" → `answered=false, gap=JA`. Gesamtgate `npm run check` grün — 128 Dateien / 700 Tests.

**Kein Produktcode / kein neuer Test** — die vorhandene Abdeckung (FR-RSN/FR-ASK + SCRUM-242 HTTP-e2e + SCRUM-256) ist breit genug; ein zusätzlicher Test wäre redundant.

### 4. Geänderte Dateien
NEU `docs/operations/evaluation-quality-assurance.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Gezielter Eval-Lauf 9/68 grün. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
- **LLM-as-judge / qualitatives Scoring** großer Korpora — bewusstes Nicht-Ziel.
- **Größeres Eval-Korpus** mit Snapshots — optionales P2.
- **Automatisiertes Modellmodus-Eval** (echter Key, Token/Kosten/Latenz-Schwellen) — P2/Ops (Sandbox ohne Key/Netz).
- Keine RAG-/Vector-/ModelAdapter-Arbeit, keine neue Architektur, kein Framework.

### 7. Empfehlung: **DONE**
**Begründung:** Anders als bei rein ops-/produktabhängigen Items (SCRUM-207/208/209) existiert hier das geforderte **wiederholbare Eval-Verfahren bereits real** — als CI-gated Test-Suite (Reasoner-/Ask-Eigenschaften + HTTP-e2e + seed-sicheres Baseline-Paar) — und die **Baseline ist dokumentiert** (neues Runbook). Quellenbindung, ehrliche Wissenslücke, Trust/Klasse und Fallback-Stabilität sind getestet und gegen Regression gesichert; das fehlende Stück (geschriebenes QA-Runbook) ist ergänzt. Tieferes qualitatives Scoring (LLM-as-judge) ist ausdrücklich Nicht-Ziel und als P2 dokumentiert. → **SCRUM-206 ist schließbar (Done).**

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/evaluation-quality-assurance.md docs/qm/claude-after-report.md
git commit -m "docs(qa): evaluation & quality-assurance runbook + evidence (SCRUM-206)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-205 — Optional: Fine-Tuning / LoRA auf eigenen Daten (Entscheidungsnotiz, docs-only)
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; kein Training/Adapter/GPU/RAG; kein Produktcode.

### 1. Vorab-Befund
- **Reasoner anbieteragnostisch:** `ModelProvider` (mit `ANTHROPIC_API_KEY`/`REASONER_MODEL`) **oder** `DeterministicProvider`-Fallback. Schlüssel nur serverseitig. Modell ist **optional**.
- **Anti-Halluzination by design:** das Modell **formuliert nur**, „Quellen/Trust kommen aus den Daten" (vorhandene, validierte KOs) — Antworten sind **quellengebunden**, ohne Beleg → ehrliche **Wissenslücke** (getestet, SCRUM-206).
- **Kein RAG/Vector/Embedding/Fine-Tuning/LoRA im Code** — die einzigen Treffer sind Kommentare, die diese Ansätze **bewusst ausschließen** (`askView.ts`, `askExamples.ts`, `librarySearch.ts`). Retrieval = deterministische Keyword-/KO-Auswahl.
- **Eval-Baseline vorhanden** (`evaluation-quality-assurance.md`, B1–B4) + ModelRun-Protokoll (Run-Level-QA, ohne Inhalte).
- **Kuratierte Trainingsdaten:** Stage-1-Seed = wenige KOs → zu klein für Training.
- **Kein** `docs/operations/fine-tuning-decision.md` → Doku-Gap.

### 2. Entscheidung
**Fine-Tuning/LoRA ist jetzt NICHT nötig und wird NICHT durchgeführt.** Begründung: Klarwerk verankert Wissen in **Knowledge Objects + Quellenbindung + Validierung + Revalidierung**, nicht in Modellgewichten (Leitprinzip „The AI may change. Your knowledge never does."). RAG/Vector ist nicht einmal vorhanden — die richtige Reihenfolge ist Quellenbindung (✓) → ggf. Retrieval/RAG → **erst zuletzt** ggf. LoRA für **Stil/Strukturierung** (nie zum Faktenspeichern). Es gibt kein gemessenes Qualitätsproblem, das nur Training löste; Datenmenge, DSGVO-Pfad und Eval-Vorher/Nachher fehlen. Fine-Tuning würde Risiken bringen (Overfitting, Wissensverfall, falsche Autorität, DSGVO-Konflikt durch eingebackenes/nicht löschbares Wissen, Lock-in/Kosten).

### 3. Minimaler Fix
**Neu:** `docs/operations/fine-tuning-decision.md` — Entscheidungsnotiz mit: Entscheidung; Begründung (Quellenbindung statt Gewichte); Problem-Gegenüberstellung (was FT löste vs. was Klarwerk schon besser macht); RAG-vor-FT-Reihenfolge; **Datenanforderungen**; **Eval-Anforderungen** (Baseline + Vorher/Nachher); **Datenschutz/Compliance** (DSFA, nicht löschbare Gewichte); **Risiken**; **Kriterien, wann LoRA später erwogen werden könnte** (§9); **Overfitting-/Rollback-Regeln** (Adapter per Env deaktivierbar); **Nicht-Ziele**; Fazit. **Kein Produktcode** (kein Konfig-Bug gefunden).

### 4. Geänderte Dateien
NEU `docs/operations/fine-tuning-decision.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
- Kein Training/Adapter/GPU/RAG/Vector/Embedding erzeugt; keine Modellarchitektur; keine produktive Modellumstellung.
- Spätere LoRA-Erwägung nur unter den dokumentierten Kriterien (§9): großer validierter Korpus, RAG ausgereizt, gemessenes Stil-/Strukturierungs-Defizit, DSGVO-Pfad, Eval-Baseline, abschaltbarer Adapter.

### 7. Empfehlung: **DONE**
**Begründung:** Das Item ist explizit ein **Entscheidungsitem** („optional"). Die Architektur erlaubt eine **klare, begründete Entscheidung („jetzt nicht nötig")**, und die geforderten Inhalte (Begründung, Wann-später-Kriterien, Daten-/Eval-/Datenschutz-/Rollback-Regeln, Nicht-Ziele) sind dokumentiert. Es gibt **keinen Blocker** — kein Training war beauftragt, und die Entscheidung ist final dokumentiert. → **SCRUM-205 ist schließbar (Done).**

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/fine-tuning-decision.md docs/qm/claude-after-report.md
git commit -m "docs(ops): fine-tuning/LoRA decision note (not needed now + later criteria) (SCRUM-205)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-204 — RAG-Pipeline bauen (Embeddings + Retrieval) — Readiness-/Entscheidungsprüfung
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Embeddings/Vector-DB/RAG gebaut; kein Produktcode.

### 1. Vorab-Befund
- **Retrieval heute = lexikalisch** (`services/reasoner/src/provider.ts` → `keywordSelect`/`tokenize`/`overlap`): Fragetokens vs. KO-Titel+Aussage, nach Überschneidung sortiert. Synchron, modellunabhängig.
- **Quellenbindung real:** `AnswerResult` mit `sources` (KO-IDs), `steps` + `snippet` (Belegstelle FR-ASK-06), `knowledgeClass` (`gesichert` nur validiert). Ohne Treffer → ehrliche Wissenslücke (getestet, SCRUM-206).
- **Kein RAG-Stack:** **keine** Embeddings/Vector-DB/Chunking/Framework — grep nach `embedding|pgvector|qdrant|chroma|weaviate|pinecone|faiss|langchain|llamaindex|haystack` im Code **leer**; vorhandene „RAG/Vector"-Nennungen sind Kommentare, die diese Ansätze **ausschließen**.
- **Evidence (live, In-Memory+Seed):** „Ventil X/Überdruck" → `answered=true, gesichert, 1 Quelle`; eine umformulierte Variante traf ebenfalls (Keyword-Toleranz). → Kontext+Quellen-Antworten funktionieren **lexikalisch**.
- **Kein** `docs/operations/rag-readiness-decision.md` → Doku-Gap.

### 2. Entscheidung
**Jetzt keine RAG-Pipeline bauen.** Klarwerk erfüllt das fachliche Ziel „Antworten mit Kontext + Quellen aus eigenen Daten" bereits **lexikalisch + KO-quellengebunden** — das ist aber **ausdrücklich keine** RAG-Pipeline (keine Embeddings/Vektor-Retrieval). Das wörtliche Akzeptanzkriterium „RAG **gebaut**" ist damit **nicht** erfüllt; ein Bau ist in diesem Item untersagt und aktuell auch nicht erforderlich. Reihenfolge bleibt: **Quellenbindung (✓) → RAG (bei Bedarf) → Fine-Tuning (zuletzt)**.

### 3. Minimaler Fix
**Neu:** `docs/operations/rag-readiness-decision.md` — Readiness-/Entscheidungsnotiz mit: aktuellem Zustand (KO-Quellenbindung + Keyword); was erfüllt ist; **was NICHT RAG ist** (keine Embeddings/Vector/Chunking); Problem-Mehrwert von RAG (semantischer Recall, Skalierung, Chunking, Ranking); **Risiken für Klarwerk** (untergräbt Validierung, falsche Autorität, DSGVO/Infra); **fehlende Bausteine** (Embedding-Modell, Vector-Store/pgvector, Chunking, Hybrid-Retrieval, Index-Lifecycle, Eval/Rollback); **Architektur-Skizze für später** (Hybrid → Re-Ranking nur validierte KOs → Reasoner → ehrliche Lücke); **Eval-/Datenschutz-/Retention-Anforderungen**; **klare Empfehlung „jetzt nicht / später unter Bedingungen"**; Nicht-Ziele. **Kein Produktcode** (kein Konfig-Bug).

### 4. Geänderte Dateien
NEU `docs/operations/rag-readiness-decision.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
- **Keine** Vector-DB/Embeddings/RAG-Pipeline/LangChain/LlamaIndex/Haystack gebaut; keine neue Sucharchitektur.
- Spätere RAG-Einführung nur unter den dokumentierten Bedingungen (großer KO-Bestand, gemessenes Recall-Defizit, DSGVO-/Eval-/Rollback-Pfad), unter Erhalt von Quellenbindung/Validierung/ehrlicher Lücke.

### 7. Empfehlung: **PARTIAL / Blocked-on-product-architecture-decision** (nicht Done)
**Begründung (Ehrlichkeit):** Das **fachliche Teilziel** (Kontext+Quellen aus eigenen Daten) ist über **lexikalisches Retrieval + KO-Quellenbindung** bereits erfüllt und belegt — aber das **wörtliche Akzeptanzkriterium „RAG-Pipeline (Embeddings + Retrieval) gebaut" ist NICHT erfüllt**, und ein Bau ist in diesem Item ausgeschlossen (zu Recht: nicht jetzt nötig). Die vorhandene Lösung darf **nicht** „RAG" genannt werden (keine Embeddings/Vektor-Retrieval). **Empfehlung:** SCRUM-204 als **Partial/Blocked-on-product-architecture-decision** führen — Readiness/Entscheidung dokumentiert; eine echte RAG-Pipeline bleibt eine bewusste, später zu treffende Architekturentscheidung.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/rag-readiness-decision.md docs/qm/claude-after-report.md
git commit -m "docs(ops): RAG readiness & decision note (source-binding today, RAG not built) (SCRUM-204)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-203 — Vektor-Datenbank aufsetzen — Readiness-/Entscheidungsprüfung
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Vector-DB/Embeddings/Extension erzeugt; kein Produktcode.

### 1. Vorab-Befund
- **Keine Vektor-DB vorhanden:** grep nach `pgvector|qdrant|chroma|weaviate|pinecone|faiss|hnsw|ivfflat|embedding` in Code/Deps/Compose **leer**. `package.json` enthält nur `pg`/`@types/pg`. Keine Embedding-Daten/Collections/Schemas.
- **Postgres = zentrale Persistenz:** `postgres:16` (Dev) / `postgres:16-alpine` (Prod); `db.ts#migrate` legt 13 Modul-Schemas an (inkl. Object-Store/Audit) — alles in einer DB.
- Retrieval heute **lexikalisch** + KO-quellengebunden (`rag-readiness-decision.md`).
- **Kein** `docs/operations/vector-db-readiness-decision.md` → Doku-Gap.

### 2. Entscheidung
**Jetzt keine Vector-DB aufsetzen.** Eine Vektor-Schicht ist erst nach **positiver RAG-Entscheidung** sinnvoll. **Bevorzugte Option für Klarwerk dann: `pgvector`** (Postgres-Extension) statt eines separaten Dienstes (Qdrant/Chroma/Weaviate) — minimale neue Backup-/Security-/Betriebsfläche, transaktionale Konsistenz mit KOs, einheitliche DSGVO-Löschpfade. Das Jira-Kriterium „Vektor-DB **aufgesetzt**" ist **nicht** erfüllt.

### 3. Minimaler Fix
**Neu:** `docs/operations/vector-db-readiness-decision.md` — Readiness-/Entscheidungsnotiz mit: aktuellem Zustand; Entscheidung/Empfehlung; **Vergleich pgvector vs. Qdrant/Chroma/Weaviate** (Infra/Backup/Auth/Konsistenz/DSGVO/Skalierung); bevorzugter Option (pgvector); **Collection-/Schema-Vorschlag** (`ko_embeddings`, nur Konzept) + **Metadata-Pflichtfelder** (ko_id/version/status/chunk/model/dim); **Indexing-/Embedding-Lifecycle** (Re-Embedding bei Änderung/Revalidierung, Löschung spiegelt KO); **Backup-/Restore-Auswirkung** (in `pg_dump`; Extension + ANN-Index-Neuaufbau beim Restore); **Security/DSGVO/Retention**; **offene Voraussetzungen**; **Nicht-Ziele**; klare Partial/Blocked-Empfehlung. **Kein Produktcode** (kein Konfig-Bug; SQL nur als Konzept, nicht ausgeführt).

### 4. Geänderte Dateien
NEU `docs/operations/vector-db-readiness-decision.md`; `docs/qm/claude-after-report.md` (dieser Eintrag). Kein Produktcode, kein FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
- **Keine** Vector-DB/Embeddings/Extension/Integration gebaut; kein Schema angelegt; keine neue Sucharchitektur.
- Spätere Einrichtung nur nach positiver RAG-Entscheidung + entschiedenem Embedding-Modell/Chunking + Eval-Baseline + Betriebspfad (Extension/Index/Re-Embedding/Backup-Erweiterung).

### 7. Empfehlung: **PARTIAL / Blocked-on-product-architecture-decision** (nicht Done)
**Begründung (Ehrlichkeit):** Es läuft **keine** Vektor-DB und es gibt **keine** Embeddings/Collections — das Jira-Kriterium „aufgesetzt" ist **nicht** erfüllt, und ein Aufbau ist in diesem Item ausgeschlossen (sowie ohne positive RAG-Entscheidung nicht sinnvoll). **Entschieden ist die Option** (pgvector auf vorhandener Postgres) inkl. Schema/Backup/Security-Anforderungen. **Empfehlung:** SCRUM-203 als **Partial/Blocked-on-product-architecture-decision** führen — Readiness/Entscheidung dokumentiert; das tatsächliche Aufsetzen bleibt eine spätere Architekturentscheidung, abhängig von SCRUM-204 (RAG).

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/vector-db-readiness-decision.md docs/qm/claude-after-report.md
git commit -m "docs(ops): vector-DB readiness & decision note (pgvector preferred, not set up) (SCRUM-203)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-202 — Datenquellen sammeln & aufbereiten — Datenquellen-/RAG-Input-Readiness
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Ingestion/Chunking/Embedding/Scraping/Massenimport; kein Produktcode.

### 1. Vorab-Befund
- **Reale Quellenflächen vorhanden:** Capture (Rohnotiz→KO); **FE-Dokument-Volltext** `txt/md/csv/json/log/docx/pdf` (`apps/web/src/lib/extract.ts`/`docx.ts`/`pdf.ts`/`files.ts`); **Bild-OCR** optional (`ocr.ts`); **Object-Store** (`services/object-store`, MIME→`image/document/binary`); **KoSource** (url/excerpt/provider, `peerValidated=false`); **EvidenceRecord** (source/attachment, objectId/mime/url/provider); **Import-Kandidaten** (`services/library-analytics`, `/api/library/import(/candidates)`); **Export** (`json/markdown/mediawiki/html`); externe Suche (Proxy, in Sandbox 400/kein Netz).
- **Metadaten reichhaltig:** KO mit type(5)/category/tags/status/version/confidence/trust/author/asset/history/comments/attachments/sources; Evidence mit koVersion/kind/objectId/mime/url/provider.
- **Kein bereinigter/chunkbarer Bestand:** `chunk` im Code **leer**; keine Normalisierung/Anonymisierung/Ingestion-Pipeline. Dokument-/OCR-Extraktion läuft **clientseitig** (keine serverseitige OCR/PDF/DOCX-Pipeline). Bestand klein (Demo-Seed).
- Keine `data-sources-ingestion-readiness.md` → Doku-Gap.

### 2. Entscheidung
„Sammeln/Verwalten" ist real und metadatenreich belegt; „**Aufbereiten** für RAG" (bereinigt + chunkbar + embedding-fertig) **fehlt**. Doku-Gap mit Readiness-Runbook schließen; **Partial** empfehlen.

### 3. Minimaler Fix
**Neu:** `docs/operations/data-sources-ingestion-readiness.md` — vorhandene Quellenflächen (Tabelle), belegte Formate, Metadaten (KO/Evidence/Attachment), Rechte/PII/DSGVO, Qualität/Validierung, **Befund „kein chunkbarer Bestand"**, Chunking-Konzept (Konzept), Anonymisierung/Bereinigung, RAG-/Vector-Voraussetzungskette, offene Datenowner-Entscheidungen, Nicht-Ziele, Empfehlung. **Kein Produktcode** (kein Doku-/Konfig-Bug aufgefallen; FE-Extract deckt sich mit i18n-Labels).

### 4. Geänderte Dateien
NEU `docs/operations/data-sources-ingestion-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
Keine Ingestion-/OCR-/Chunking-/Embedding-/Vector-Pipeline gebaut; kein Scraping/Massenimport; keine externen Systeme angezapft. Spätere RAG-Aufbereitung erst nach RAG-/Vector-Entscheidung + Bereinigung/Anonymisierung + Chunking + Eval-Baseline.

### 7. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Die „Sammeln/Verwalten"-Hälfte ist **real** und mit reichen Metadaten belegt (Capture inkl. Dokument-Volltext/OCR, Anhänge/Object-Store, Quellen/Evidence, Import, Export). Aber ein **bereinigter, chunkbarer, RAG-tauglicher** Datenbestand **existiert nicht** (kein Chunking/Normalisierung/Anonymisierung/Ingestion), und der Bestand ist klein. Das Kriterium „**aufbereitet**" ist daher **nicht** erfüllt → **Partial**, abhängig von SCRUM-204 (RAG) / SCRUM-203 (Vector-DB).

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/data-sources-ingestion-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): data-sources & ingestion readiness (collect real, RAG-prep missing) (SCRUM-202)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-201 — Skalierung & Kostenkontrolle einrichten — Readiness
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Cloud-/GPU-Provisionierung, **keine** Auto-Scaling-/Budget-Alerts, **kein** Lasttest gegen fremde Systeme; kein Produktcode.

### 1. Vorab-Befund
- **Single-Instance-Deploy:** App + Postgres (`docker-compose.prod.yml`, `restart: unless-stopped`) über Coolify/Hetzner; **keine** Replikas/Load-Balancer/Auto-Scaling/Ressourcen-Limits/Idle-Shutdown. **Kein GPU** (Reasoner = externer Provider **oder** deterministischer Fallback; kein self-hosted Modell).
- **Reale Signale:** `/health`, `/api/reasoner/status`, `/api/ai-status`, `/api/model-runs`, `/api/management/snapshot`. `ModelRunRecord`-Keys: `id,task,provider,demo,fallback,locale,startedAt,finishedAt,status` → **Latenz/Fallback/Fehlerquote/Provider-Mix ableitbar**.
- **Keine Token-/Kostenerfassung** im Produkt (ModelRun ohne tokens/cost/usage). **Kein Rate-Limit/Quota** (bestätigt `integration-workflows.md`). **Keine** aktiven Kosten-/Budget-Alerts. **Kein** durchgeführter Lasttest.
- Keine `scaling-cost-control-readiness.md` → Doku-Gap.
- **Lokaler In-Memory-Smoke (sicher, real):** `/health`=ok; status=deterministic; 3× `POST /api/ask` http=200; `/api/model-runs`=4 Records, Latenz ableitbar, provider=deterministic, fallback=false, status=success. Kein Loadtest, keine fremde Infrastruktur.

### 2. Entscheidung
Signale sind real und teilweise nutzbar (Latenz/Fallback/Fehler), aber Kostenerfassung/Rate-Limit/Scaling/Alerts/Lasttest sind **nicht aktiv**. Doku-Gap mit Readiness-Runbook schließen; **Partial** empfehlen (Honesty-Leitplanke: nicht „eingerichtet" behaupten).

### 3. Minimaler Fix
**Neu:** `docs/operations/scaling-cost-control-readiness.md` — heutiger Runtime-/Deploy-Zustand, verfügbare Messsignale (+Smoke-Evidence), **fehlende Token-/Kostenerfassung** (ehrlich), Rate-Limit-/Quota-Konzept, Auto-Scaling-/Idle-Shutdown-Optionen, **Kosten-Alerts/Budget als Betreiberpflicht**, Lasttest-Strategie (nur Staging), Aktivierungs-Runbook (Reihenfolge), Nicht-Ziele, Empfehlung. **Kein Produktcode** (kein Doku-/Konfig-Bug aufgefallen).

### 4. Geänderte Dateien
NEU `docs/operations/scaling-cost-control-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Zusätzlich lokaler In-Memory-HTTP-Smoke (health/status/ask/model-runs), Server danach gestoppt.

### 6. Restlücken / Nicht-Ziele
Keine Token-/Kostenerfassung, kein Rate-Limit/Quota, kein Auto-Scaling/Idle-Shutdown, keine Budget-Alerts gebaut/aktiviert; kein Lasttest; keine Infrastruktur/GPU provisioniert; kein RAG/Vector/ModelAdapter/Conductor. Spätere Aktivierung in dokumentierter Reihenfolge (Rate-Limit → Usage-Felder → Provider-Budget-Alerts → Staging-Lasttest → Scaling-Entscheidung → Alerts).

### 7. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Reale Mess-Signale (Liveness/KI-Status/Latenz/Fallback/Fehler) sind vorhanden und der modulare Monolith ist gut skalierbar — aber **produktinterne Kostenmessung, Rate-Limit/Quota, Auto-Scaling/Idle-Shutdown, aktive Kosten-/Budget-Alerts und ein Lasttest fehlen**. Das Kriterium „eingerichtet" ist **nicht** erfüllt → **Partial**; offene Stücke sind teils Produkt- (Rate-Limit/Usage-Felder), teils Betreiber-/Ops-Aufgaben, bewusst nicht provisioniert.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/scaling-cost-control-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): scaling & cost-control readiness (signals real, cost/scaling not active) (SCRUM-201)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-200 — API-Endpoint mit Authentifizierung bereitstellen — API/Auth-Readiness
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** API-Key-Infrastruktur/Proxy/Domain/Rate-Limit provisioniert; kein SDK; kein Produktcode.

### 1. Vorab-Befund
- **Reale auth-geschützte REST-API** (`/api/*`, Fastify, Single-Origin). Öffentlich nur `health`/`reasoner/status`/`ai-status` (Status, keine Daten); alles übrige RBAC-geschützt.
- **Auth:** Session-**Bearer** (`login`→token, `Authorization: Bearer`) via `http.ts` (`tokenFromRequest`→`auth.authenticate`); **Guards** `requireUser`→**401**, `requirePermission`→**403**; RBAC Viewer/Experte/Controller/Admin; zusätzlich **OIDC/PKCE**.
- **Transport (App):** `@fastify/helmet` (HSTS+CSP), **HTTPS-Kanonik-Redirect**, `noindex`. **TLS-Terminierung via Coolify-Proxy** (Ops), nicht im App-Prozess.
- **Keine inbound API-Key-/Service-Token-Auth** (`apiKey`/`x-api-key` nur **ausgehend** = ANTHROPIC_API_KEY zum Modell). **Kein Rate-Limit/Quota. Kein CORS** (same-origin).
- **Abweisung getestet:** 401/403 in nahezu allen Route-Test-Suiten + Auth-Service-Tests + build-app.
- Keine `api-auth-readiness.md` → Doku-Gap.
- **Lokaler In-Memory-Smoke (real, kein Live-Netz):** anonym `/api/kos`→**401**, anonym `/api/ask`→**401**, **falscher** Bearer→**401**, `/health`→**200**; autorisiert `/api/kos`→**200**, `/api/ask`→**200**, `/api/library/export`→**200**.

### 2. Entscheidung
Auth/RBAC real, getestet und Smoke-belegt; HTTPS deploy-/ops-abhängig (Coolify); externe Public-API-Schicht (API-Key/Quota/CORS) fehlt. Doku-Gap mit Readiness-Runbook schließen; **Partial** empfehlen.

### 3. Minimaler Fix
**Neu:** `docs/operations/api-auth-readiness.md` — API-Fläche (Tabelle), Auth/RBAC, Abweisungs-Tests+**Smoke-Evidence**, **fehlende Service-Token/API-Keys** (ehrlich), **fehlendes Rate-Limit/Quota**, **TLS/Proxy-Verantwortung** (Coolify), externe Nutzbarkeit, Public/Partner-API-Anforderungen, Nicht-Ziele, Empfehlung. **Kein Produktcode** (kein Doku-/Konfig-Bug aufgefallen).

### 4. Geänderte Dateien
NEU `docs/operations/api-auth-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Zusätzlich lokaler In-Memory-HTTP-Smoke (401/403/200), Server danach gestoppt.

### 6. Restlücken / Nicht-Ziele
Keine API-Key-/Service-Token-Auth, kein Rate-Limit/Quota, kein CORS, keine Domain/Proxy/SDK gebaut/provisioniert. Späteres Public/Partner-API-Setup: Maschinen-Token+Scopes+Rotation → Rate-Limit/Quota → CORS → gehärteter Proxy/TLS+Domain → API-Versionierung/Doku → Missbrauchs-Monitoring.

### 7. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Der **Auth-Teil** des Kriteriums ist **real erfüllt** (Bearer+OIDC, RBAC, 401/403 getestet+Smoke). Der **HTTPS-Teil** ist **deploy-/ops-abhängig** (Coolify-TLS, in diesem Item nicht provisioniert), und eine **produktive externe/öffentliche** API-Schicht (API-Key, Quota, CORS) ist **nicht aktiv**. Daher **Partial**; offene Stücke teils Produkt-, teils Ops-Aufgaben.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/api-auth-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): API auth readiness (internal auth real, public API layer not active) (SCRUM-200)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-199 — Inferenz-Server aufsetzen (vLLM / TGI) — Readiness-/Entscheidung
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **kein** Container/GPU/Modell/OpenAI-API/Infra-Änderung; kein Produktcode.

### 1. Vorab-Befund
- **Provider real:** **Anthropic** (`anthropicClient`, `${baseUrl}/v1/messages`, `x-api-key`; aktiv nur mit `ANTHROPIC_API_KEY`, `REASONER_MODEL` Default `claude-sonnet-4-6`) **+ deterministischer Fallback** (`DeterministicProvider`, kein Modell/Netz). Auto-Fallback bei Modellfehler (`service.ts`).
- **Kein OpenAI-kompatibler Endpoint:** `baseUrl` existiert, ist aber (a) **Anthropic-Protokoll** und (b) **NICHT env-verdrahtet** (`createModelClientFromEnv` übergibt nur apiKey+model; Default hartkodiert) → ohne Codeänderung nicht auf self-hosted umlenkbar.
- **Kein vLLM/TGI/Ollama/llama.cpp** in Code/Docker/Env; `.env.example` nur ANTHROPIC_API_KEY+REASONER_MODEL; compose nur App+Postgres(+n8n Dev). Doku-Treffer (Dossier) **bestätigen Abwesenheit**.
- **Signale real:** `/api/reasoner/status`, `/api/ai-status`, `/api/model-runs` (provider/demo/fallback/status + Latenz). **Kein** Rate-Limit/Quota, **keine** Token-/Kostenerfassung für Inferenz.
- Keine `inference-server-readiness.md` → Doku-Gap.
- **Lokaler In-Memory-Smoke (real, kein Modellcall/Netz):** status=`{active:false,provider:"deterministic",mode:"deterministic"}`; ai-status identisch; `POST /api/ask`→200 (deterministisch); model-runs `provider=deterministic, demo=true, fallback=false`.

### 2. Entscheidung
Swap-fähige Architektur + Fallback + Signale real, aber **kein** Inferenz-Server läuft/vorbereitet. Doku-Gap mit Readiness-/Entscheidungsnotiz schließen; **Partial** empfehlen (Honesty-Leitplanke).

### 3. Minimaler Fix
**Neu:** `docs/operations/inference-server-readiness.md` — Provider-Architektur, deterministischer Fallback, externer Anthropic-Provider, **fehlender vLLM/TGI/Ollama/OpenAI-Server** (+ `baseUrl`-nicht-env-verdrahtet als ehrlicher Enabler-Hinweis), Health/ModelRun-Signale (+Smoke), Anforderungen für später (GPU/Container/Modell/Adapter/Auth/TLS/Rate-Limit/Monitoring/Kosten/DSGVO/Rollback), Auswahl vLLM-vs-TGI-vs-Ollama, Nicht-Ziele, Empfehlung. **Kein Produktcode** (auch der `baseUrl`-Enabler bewusst nicht gefixt).

### 4. Geänderte Dateien
NEU `docs/operations/inference-server-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Zusätzlich lokaler In-Memory-HTTP-Smoke (status/ai-status/ask/model-runs), Server danach gestoppt.

### 6. Restlücken / Nicht-Ziele
Kein Inferenz-Server/GPU/Modell/Container; kein OpenAI-Client; `baseUrl`/`REASONER_PROVIDER` nicht env-konfigurierbar; kein Rate-Limit/Cost-Control für Inferenz. Spätere Einrichtung = Produkt-/Ops-Entscheidung in dokumentierter Reihenfolge.

### 7. Empfehlung: **PARTIAL / Blocked-on-product-/ops-decision** (nicht Done)
**Begründung (Ehrlichkeit):** Anbieteragnostische Architektur (`ReasonerProvider`/`ModelClient`) + Anthropic-Adapter + deterministischer Fallback + Signale sind real — aber es **läuft kein** Inferenz-Server und **keiner ist vorbereitet** (kein vLLM/TGI/Ollama, kein OpenAI-Client, baseUrl nicht env-verdrahtet). Das Kriterium „aufgesetzt" ist **nicht** erfüllt → **Partial**; Einrichtung als spätere Produkt-/Ops-Entscheidung.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/inference-server-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): inference-server readiness (Anthropic+deterministic today, no vLLM/TGI/Ollama) (SCRUM-199)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-198 — Server bereitstellen & absichern — Hardening-Readiness
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Server-/SSH-/Firewall-/fail2ban-/Docker-/CUDA-/Cloud-Änderung; kein Produktcode.

### 1. Vorab-Befund
- **Deploy real beschrieben:** Hetzner + Coolify + Postgres + Cloudflare (TLS/Let's Encrypt) (`deploy-hetzner.md`). `docker-compose.prod.yml`: App+Postgres, `restart: unless-stopped`, **DB-Healthcheck** (`pg_isready`) + `depends_on healthy`, `COOKIE_SECURE=true`, **DB-Port nicht veröffentlicht**; App `3000:3000` (Proxy-gefrontet).
- **App-seitig real abgesichert:** helmet **HSTS+CSP**, **HTTPS-Kanonik-Redirect**, `X-Robots-Tag: noindex` (`server.ts`); Auth/RBAC (401/403); Prelaunch **Traefik-Basic-Auth** + robots/noindex (`pre-launch-protection.md`); Secrets via Coolify-Env (`secrets-management.md`).
- **Fehlt/nicht verifiziert:** konsolidiertes **OS-Hardening-Runbook** (SSH-Key-only, Root-Deaktivierung, UFW/Firewall, fail2ban, unattended-upgrades, Docker-/Port-Härtung) und **live-verifizierte** Evidenz (kein Remote-Zugriff). Port-Binding-Hinweis: `3000:3000` bindet auf alle Interfaces — hinter Proxy besser `127.0.0.1`.
- **GPU/CUDA:** für App-Server (Node+Postgres) **irrelevant**; nur für späteren Inferenz-Server (`inference-server-readiness.md`).
- Keine `server-hardening-readiness.md` → Doku-Gap.

### 2. Entscheidung
App-/Deploy-Absicherung real; OS-Härtung weder konsolidiert noch live verifiziert. Doku-Gap mit Hardening-Readiness-Runbook schließen; **Partial** empfehlen (Honesty-Leitplanke: keine „abgesichert"-Behauptung ohne Live-Verifikation).

### 3. Minimaler Fix
**Neu:** `docs/operations/server-hardening-readiness.md` — heutiger Deploy-Stand, app-seitige Maßnahmen, **OS-Hardening-Checkliste** (SSH/Root/Firewall/fail2ban/Updates/Docker/TLS), **Port-/Firewall-Soll-Modell**, Backup/Monitoring/Secrets-Bezug, **GPU/CUDA als Nicht-Ziel für App-Server**, **Verifikationsplan** (für Done), Nicht-Ziele, Empfehlung. **Kein Produktcode** (Port-Binding-Hinweis bewusst nicht gefixt).

### 4. Geänderte Dateien
NEU `docs/operations/server-hardening-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Kein Remote-Server-Zugriff (per Vorgabe).

### 6. Restlücken / Nicht-Ziele
OS-Härtung (SSH/Root/Firewall/fail2ban/Updates/Docker) nicht durchgeführt/verifiziert; keine Server-/Cloud-/GPU-Änderung. Verifikation = Betreiber-/Ops-Aufgabe (Plan §7 der Doku).

### 7. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** App-/Deploy-seitige Absicherung (helmet/HSTS/CSP, HTTPS-Kanonik, noindex, COOKIE_SECURE, Auth/RBAC, Prelaunch-Gate) ist **real**, und der Deploy-Pfad (Hetzner/Coolify/Cloudflare-TLS + Snapshots) ist dokumentiert. Aber die **Server-/OS-Härtung** ist **nicht live verifiziert** (kein Remote-Zugriff, in diesem Item ausgeschlossen). „Server bereitgestellt **& abgesichert**" ist daher nicht vollständig erfüllt → **Partial**; offene Schritte = Betreiber-/Ops mit Verifikationsplan.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/server-hardening-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): server hardening readiness (app-side real, OS hardening operator-verified pending) (SCRUM-198)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-197 — Cloud-Provider & GPU-Instanz auswählen — Decision-Readiness
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Konten/GPU-Buchung/Provisionierung/Modell-Downloads; **keine** verbindlichen Live-Preise; kein Produktcode.

### 1. Vorab-Befund
- **Keine verbindliche GPU-/Provider-Wahl** vorhanden; alle GPU-Erwähnungen = „nicht provisioniert/Nicht-Ziel/Frage für später".
- **Downstream nicht-getroffener Entscheidungen:** Inferenz-Server Partial/Blocked, Fine-Tuning „jetzt nicht", RAG „jetzt nicht" → heute **keine** GPU-Last (Anthropic-API oder deterministischer Fallback).
- **DSGVO:** EU/DE-Region nötig; Stack bereits Hetzner DE + Cloudflare; AVV/DSFA bei KI-Anbieter aktualisieren.
- Keine `gpu-provider-decision.md` → Doku-Gap.

### 2. Entscheidung / Shortlist
Decision-Readiness dokumentieren, **Partial** empfehlen. **Shortlist:** (1) **Hetzner DE** (bester DSGVO-/Ops-Fit, Same-Vendor) wenn passende GPU verfügbar; (2) **RunPod/Lambda** (EU-Region/AVV geprüft) für günstigen PoC; (3) **EU-Hyperscaler** (AWS/GCP/Azure Frankfurt) bei Skalierungsbedarf; (4) **lokaler Apple-Silicon-Mac nur Dev/PoC**. **Instanzklasse:** **L4/A10 (~24 GB)** genügt für kleines–mittleres Modell; A100/H100 vorerst Overkill. **Beschaffung:** On-Demand-PoC mit Idle-Abschaltung; reserviert erst bei 24/7-Last; Spot nur Batch/Eval.

### 3. Minimaler Fix
**Neu:** `docs/operations/gpu-provider-decision.md` — Einordnung/Abhängigkeit, Anforderungen (EU/DSGVO/VRAM/Ops/Kosten/Datenfluss/Rollback), **Vergleichsmatrix** Provider, Instanzklassen, On-Demand/Reserviert/Spot, **Shortlist + PoC-erster-Schritt**, offene Budget-/DSGVO-/Ops-Entscheidungen, **Done-Kriterien**, Nicht-Ziele, Empfehlung. Preise **qualitativ/nicht verbindlich**. **Kein Produktcode** (kein Doku-/Konfig-Bug aufgefallen).

### 4. Geänderte Dateien
NEU `docs/operations/gpu-provider-decision.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
Keine verbindliche Provider-/Region-/Instanzwahl, kein Budget, kein bestätigter Inferenz-Bedarf, keine Konten/GPU/Infra/Modell. Verbindliche Auswahl = Pedi-/Budget-/DSGVO-Entscheidung (Kriterien §8 der Doku).

### 7. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Anforderungen + qualitative Shortlist + Instanzklassen + Beschaffungsmodell sind dokumentiert — aber **keine** verbindliche Provider-/Region-/Instanzwahl, **kein** Budget, **kein** bestätigter Bedarf; eine GPU-Buchung wäre verfrüht (Inferenz-/Fine-Tuning-/RAG-Entscheidungen alle „nicht jetzt"). „Ausgewählt" ist **nicht** erfüllt → **Partial**; verbindliche Wahl ist Pedi-/Budget-/DSGVO-Entscheidung.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/gpu-provider-decision.md docs/qm/claude-after-report.md
git commit -m "docs(ops): cloud/GPU provider decision-readiness (shortlist, no binding choice) (SCRUM-197)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-196 — Lokale Chat-Oberfläche bereitstellen (Open WebUI) — Readiness
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** WebUI-/Docker-/Ollama-/Modell-Installation; kein Produktcode.

### 1. Vorab-Befund
- **Keine lokale Chat-Oberfläche** (Open WebUI o. Ä.) und **keine lokale Modellruntime** (kein Ollama/llama.cpp) in Code/Docker/Env; Suche `open-webui|webui|11434|OPENAI_BASE_URL|ollama|llama.cpp` ohne Implementierung (nur Dossier bestätigt Abwesenheit). Reasoner = Anthropic-API oder deterministischer Fallback.
- **Klarwerk-Ask real & reichhaltig:** `POST /api/ask` → AnswerResult mit `knowledgeClass`/`gesichert`, `sources`, `trust` (ConfidenceBar), Reasoner-Status-Badge, Beispiele, Helpful, **Gap→Capture**; RBAC-geschützt. Quellengebunden, **kein** generischer Chat.
- Keine `local-chat-ui-readiness.md` → Doku-Gap.

### 2. Entscheidung
Keine lokale Chat-UI/Runtime vorhanden; Klarwerk hat bereits eine überlegene wissensgebundene Ask-UI. Doku-Gap mit Readiness-Notiz schließen (inkl. Abgrenzung), **Partial** empfehlen.

### 3. Minimaler Fix
**Neu:** `docs/operations/local-chat-ui-readiness.md` — heutiger Zustand, **Unterschied Klarwerk-Ask vs. Open WebUI** (Tabelle: Quellenbindung/Validierung/Trust/ehrliche Lücke/Audit), Nutzen einer lokalen WebUI (Dev/PoC), **PoC-Schritte** (Runtime→WebUI→Auth→Datenfluss→Abgrenzung), Auth/Privacy/Datenfluss, **Done-Kriterien**, Nicht-Ziele, Empfehlung. **Kein Produktcode** (kein Doku-/Konfig-Bug aufgefallen).

### 4. Geänderte Dateien
NEU `docs/operations/local-chat-ui-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
Keine Open WebUI/Ollama/Modell installiert/verbunden; keine lokale Modellruntime; keine Nutzer/Logins in fremden Systemen. PoC erst nach lokaler Runtime (`inference-server-readiness.md`), als Dev-Werkzeug — nicht als End-User-Zugang zum Werkswissen.

### 7. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Es existiert **keine** lokale Chat-Oberfläche und **keine** lokale Modellruntime → Kriterium **nicht** erfüllt. Klarwerk hat bereits eine produktive, **wissensgebundene** Ask-UI (Quellen/Trust/Validierung/ehrliche Lücke), die einem generischen Chat überlegen ist. Open WebUI bleibt ein **Dev-/PoC-Werkzeug** (erst nach lokaler Runtime sinnvoll), **kein** Ersatz für Ask/Knowledge OS → **Partial**.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/local-chat-ui-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): local chat UI (Open WebUI) readiness (none today; Ask already source-bound) (SCRUM-196)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-195 — Lokale Funktions- & Performance-Tests — Baseline
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/misst/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** WebUI/Ollama/Modell/Docker/GPU; **kein** Live-Lasttest; kein Produktcode.

### 1. Vorab-Befund
- Lokales Setup = In-Memory-Runtime, **deterministischer** Reasoner (kein Key), **keine** lokale Modellruntime. ModelRun ohne tokens/cost. Keine `local-function-performance-baseline.md` → Doku-Gap.

### 2. Durchgeführte Tests/Messungen
- `npm run check`; gezielter Eval-Lauf (reasoner/ask/ask-routes/tests-ask); Live-Ask-Latenz je Fragetyp (5 Läufe); 5 parallele Asks; Langkontext (~4 KB); ModelRun-Metadaten.

### 3. Ergebnisse (real gemessen, In-Memory/deterministisch)
- **Gates grün:** 128 Dateien / 700 Tests (Vitest ~19 s, Gesamt ~24 s wall). Eval-Suiten grün.
- **Ask-Latenz:** B1 Ventil ~1,5 ms (answered, gesichert, trust 100, 1 Quelle); B3 Filter ~0,9 ms (answered, gesichert); B2 Quantenflux ~0,5 ms (**Gap**); B4 Dosierwert L4 ~0,6 ms (**Gap**).
- **Parallel 5 (wall):** ~2,5 ms. **Langkontext ~4 142 Z.:** ~0,8 ms.
- **ModelRun:** 28 Records, `provider=deterministic`, `fallback=false`, `status=success`; Latenz ~0–1 ms; **keine tokens/cost**.

### 4. Nicht messbar / Blocker
- **Tokens/sec & Modell-Generierungslatenz: NICHT messbar** (keine lokale Modellruntime; deterministisch generiert keine Tokens) → blocked, **nicht geschätzt**.
- Modellmodus-Qualität/-Latenz (echter Key) in Sandbox nicht prüfbar; produktiver Lasttest nicht durchgeführt (per Vorgabe).
- **P1-Qualitätsbeobachtung:** langer **Offtopic**-Kontext → fälschlich `answered=true` statt Gap (lexikalische Über-Überschneidung, bekannte Keyword-Grenze, vgl. `rag-readiness-decision.md`). Empfehlung: Eval-Set erweitern; semantisches Retrieval würde es adressieren. **Kein P0** (Trust/Klasse bleiben KO-gebunden, keine freie Halluzination).

### 5. Geänderte Dateien
NEU `docs/operations/local-function-performance-baseline.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 6. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Lokale In-Memory-Smokes ausgeführt, Server danach gestoppt.

### 7. Restlücken / Nicht-Ziele
Keine Tokens/sec-/Modellgenerierungs-Messung (kein lokales Modell); kein Modellmodus-Eval; kein Lasttest; keine WebUI/Runtime/GPU. Offene Teile abhängig von lokaler Modellruntime + späterem Eval-/Lasttest.

### 8. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Funktions-/Latenz-Baseline des deterministischen lokalen Setups ist **real gemessen** und belastbar (Gates grün, Sub-ms–wenige ms, korrekte Quellenbindung, ehrliche Gaps, kleine Parallelität ok). Aber **Performance-/Modellseite (Tokens/sec) ist mangels lokaler Runtime nicht messbar (blocked)** und es gibt eine **P1-Qualitätsbeobachtung**. „Funktions- **& Performance**-Tests" daher **funktional erfüllt, performance-seitig blockiert** → **Partial**.

### 9. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/local-function-performance-baseline.md docs/qm/claude-after-report.md
git commit -m "docs(ops): local function & performance baseline (deterministic measured; tokens/sec blocked) (SCRUM-195)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-193 — Runtime installieren (Ollama / llama.cpp) — Readiness/Verifikation
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Runtime-Installation/Modell-Download/Docker/GPU/Autostart; kein Produktcode.

### 1. Vorab-Befund
- **Prüfumgebung ≠ Zielrechner:** Shell läuft in **Linux-Sandbox** (`uname`: Linux aarch64), **kein** macOS, **kein** ollama; `system_profiler` nicht vorhanden. → `which ollama`/`curl :11434`/`system_profiler` **können den Mac nicht prüfen**; Terminal-Eingabe auf dem Mac gesperrt. **Maschinen-Verifikation aus dieser Umgebung nicht möglich** — kein erfundener „installiert"-Befund.
- **Repo:** Runtime **nirgends verdrahtet** (grep `ollama|llama.cpp|11434|GGUF|Metal|OLLAMA|MODEL_PATH` leer). Heute deterministischer Reasoner (kein Modell).
- Keine `local-runtime-readiness.md` → Doku-Gap.

### 2. Durchgeführte Checks
`uname`/`which` (Umgebung einordnen), Repo-Suche nach Runtime-Verdrahtung, Doku-Kontext (`inference-server-readiness.md`, `gpu-provider-decision.md`, `local-chat-ui-readiness.md`, `local-function-performance-baseline.md`).

### 3. Ergebnisse
- **Installation/Runtime vorhanden:** **nicht verifizierbar aus dieser Umgebung** (Sandbox≠Mac); im Repo **nicht** verdrahtet.
- **Modellantwort / GPU-Metal-Verifikation:** **nein/nicht belegt** (kein Zugriff auf den Mac, kein Modellcall).

### 4. Minimaler Fix
**Neu:** `docs/operations/local-runtime-readiness.md` — Prüfumgebungs-Einschränkung (ehrlich), prüfbarer Repo-Befund, **Ollama-vs-llama.cpp** (Ollama zuerst), macOS/Apple-Silicon-Installpfad (Konzept), **Modell-Speicherort** (`~/.ollama/models`), Größen/RAM (Unified Memory), **Metal/GPU-Verifikation**, **Selbst-Verifikationsbefehle** für Pedi, Datenschutz/Logging, Done-Kriterien, Blocker/Nicht-Ziele. **Kein Produktcode.**

### 5. Geänderte Dateien
NEU `docs/operations/local-runtime-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 6. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 7. Restlücken / Nicht-Ziele
Keine Runtime/Modell installiert; keine Mac-Verifikation möglich; keine Produkt-Anbindung (Adapter fehlt). Verifikation/Installation = Pedi lokal (Befehle §7 der Doku) + späterer Inferenz-Adapter.

### 8. Empfehlung: **PARTIAL / Blocked-on-local-verification** (nicht Done)
**Begründung (Ehrlichkeit):** Im Repo ist keine Runtime verdrahtet; ob auf dem Mac Ollama/llama.cpp installiert/lauffähig ist, **kann aus der Linux-Sandbox nicht geprüft werden** (kein Terminal-Zugriff auf den Mac). Kein Nachweis für laufende Runtime/Modellantwort/Metal → **kein Fake-Done**. Entscheidung (Ollama zuerst) + Install-/Verifikationspfad dokumentiert → **Partial**; Verifikation durch Pedi lokal.

### 9. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/local-runtime-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): local runtime (Ollama/llama.cpp) readiness (not verifiable from sandbox; Ollama preferred) (SCRUM-193)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-192 — Hardware prüfen & vorbereiten (GPU/RAM/Storage) — Readiness/Selbstverifikation
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Treiber-/OS-/CUDA-/Metal-/Runtime-/Modell-Installation; kein Produktcode.

### 1. Vorab-Befund / Durchgeführte Checks
- `uname -a`/`arch`: **Linux aarch64** (Sandbox). `sw_vers`/`sysctl hw.memsize`/`system_profiler`: **nicht vorhanden** (kein macOS). `nvidia-smi`: **nicht vorhanden**. Sandbox-RAM ~4 GB / Disk ~9,6 GB — **Sandbox-Werte, NICHT der Mac**.
- → **Zielhardware (Mac) aus dieser Umgebung nicht prüfbar**; keine erfundenen Mac-Werte.
- Repo/Deploy belegbar: App braucht **keine** GPU (Node+Postgres); keine lokale Runtime verdrahtet; GPU nur für separaten Inferenz-Server relevant.
- Keine `local-hardware-readiness.md` → Doku-Gap.

### 2. Ergebnisse
- **Hardware-Eignung (Mac): nicht belegt** (Sandbox≠Mac).
- **Treiber/Metal/CUDA: nicht belegt** (macOS-Tools fehlen; kein NVIDIA in Sandbox; kein Mac-Zugriff).
- **Modellgrößen-Einschätzung:** nur als **Beispielmatrix** (16 GB→3B–8B Q4 vorsichtig; 24/32 GB→7B–13B Q4; 64 GB+→größer/mehr Kontext) — verbindlich erst mit echten Werten.

### 3. Minimaler Fix
**Neu:** `docs/operations/local-hardware-readiness.md` — Prüfumgebungsgrenze (Tabelle), belegbarer Repo/Deploy-Stand, **Selbst-Verifikationsbefehle** (sw_vers/system_profiler/sysctl/df/SPStorage), **Hardware-Eignungsmatrix** (RAM-Klassen), **Storage-Bedarf pro Modellklasse**, Metal/GPU-Verifikation, Done-Kriterien, Blocker/Nicht-Ziele. **Kein Produktcode.**

### 4. Geänderte Dateien
NEU `docs/operations/local-hardware-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 5. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Restlücken / Nicht-Ziele
Mac-Hardware nicht verifizierbar aus Sandbox; keine Treiber-/OS-/Runtime-/Modell-Arbeit. Verifikation = Pedi lokal (§3 der Doku), danach verbindliche Modellklasse.

### 7. Empfehlung: **PARTIAL / Blocked-on-local-hardware-verification** (nicht Done)
**Begründung (Ehrlichkeit):** Reale Mac-GPU/Metal/RAM/Storage sind **aus der Linux-Sandbox nicht belegbar** — keine erfundenen Werte. Belegbar nur: App braucht keine GPU; GPU-Eignung betrifft nur späteren lokalen LLM-PoC. Selbst-Verifikation + Eignungs-/Storage-Matrix + Done-Kriterien dokumentiert → **Partial**; Hardware-Check durch Pedi lokal.

### 8. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/local-hardware-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): local hardware readiness (Mac not verifiable from sandbox; suitability matrix) (SCRUM-192)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-191 — Budget- & Kostenplanung (Hardware + Cloud) — Readiness
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Buchung/Installation; **keine** verbindlichen Preise; **keine** vorgetäuschte Budgetfreigabe; kein Produktcode.

### 1. Vorab-Befund
- **Status quo:** deterministisch (0 € Modellkosten) oder optional Anthropic-API (extern/pro Token, intern nicht erfasst). **Keine** GPU/Cloud/lokale Runtime. Hosting/Postgres/Backups bestehen bereits.
- **Keine Budgetfreigabe** und **keine** verbindlichen Preise in Docs/Repo.
- Keine `budget-cost-planning-readiness.md` → Doku-Gap.

### 2. Kostenübersicht / Szenarien
- **Kategorien K1–K8:** vorhandene HW, Zusatz-HW, lokale Runtime/Storage, Cloud-GPU on-demand, Cloud-GPU 24/7, API-Modellkosten, Hosting/Backups/Monitoring, DSGVO/AVV/Ops.
- **Szenarien S0–S4:** S0 Status quo (0 €) · S1 lokaler PoC vorhandene HW · S2 + Zusatzhardware · S3 Cloud-GPU on-demand · S4 Cloud-GPU 24/7. Reihenfolge: **S0→S1→S3→S4** (24/7 nur bei Lastnachweis).
- **Kostenformeln statt Preise** (on-demand/24-7/API/Break-even); konkrete Zahlen live einzusetzen.

### 3. Budgetfreigabe: **nicht vorhanden**
Kein bestätigter Bedarf, keine verifizierten Live-Preise, keine dokumentierte Freigabe.

### 4. Minimaler Fix
**Neu:** `docs/operations/budget-cost-planning-readiness.md` — heutiger Stand, Kostenkategorien, Szenario-Matrix (einmalig/laufend/DSGVO), Kostenformeln, einmalig-vs-laufend, **Budgetfreigabe-Checkliste**, Entscheidungspunkte Pedi, Nicht-Ziele, Done-Kriterien. **Kein Produktcode** (kein Doku-/Konfig-Bug aufgefallen).

### 5. Geänderte Dateien
NEU `docs/operations/budget-cost-planning-readiness.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 6. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 7. Restlücken / Nicht-Ziele
Keine verifizierten Preise, keine Budgetfreigabe, kein bestätigter Bedarf; keine Buchung/Installation. Verbindliche Planung = Pedi-/Budget-Entscheidung (Checkliste §6, Done §9 der Doku).

### 8. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Kategorien, Szenario-Matrix, **Kostenformeln statt erfundener Preise**, Freigabe-Checkliste und Entscheidungspunkte sind dokumentiert — aber **keine** verifizierten Live-Preise und **keine** Budgetfreigabe; Bedarf unbestätigt (heute S0 = kostenneutral). „Budget- & Kostenplanung abgeschlossen/freigegeben" **nicht** erfüllt → **Partial**.

### 9. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/budget-cost-planning-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(ops): budget & cost planning readiness (formulas+scenarios, no binding prices/approval) (SCRUM-191)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-190 — Datenschutz- & DSGVO-Anforderungen festhalten — Anforderungsprüfung
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Rechtsberatung/AVV/DSFA-Freigabe; **keine** Massen-Folge-Tickets; kein Produktcode.

### 1. Vorab-Befund
- **Bestehendes `gdpr-compliance-runbook.md` ist stark:** Rollen/Verantwortung, VVT-Check (mit Datenkategorien), DSFA-Schwellwert, Betroffenenrechte (Auskunft/Löschung, append-only Audit), techn. Schutznachweise, AUP, Quartals-Review, offene Betreiberpflichten.
- **Code-Datenfakten:** ModelRuns speichern **nie** Prompt/Antwort (nur Metadaten; „NIE Prompt-/Antwortinhalt"). **Ask** persistiert die Frage **nicht** als Prompt — **aber** unbeantwortete Fragen werden als **`Gap` mit `question`-Freitext** gespeichert (`createGap`→`gaps.insert`). Anhänge = Original-Bytes (Art. 9 möglich). Audit append-only, personenbezogen.
- **Lücke:** konsolidierte **Datenklassifikation über alle Flächen** + **lokal-vs-Cloud** (inkl. neuer Readiness-Docs) + **explizites Prompt-/Log-/ModelRun-/Gap-Aufbewahrungskonzept** fehlte als fokussierte Anforderungs-Doku. → Doku-Gap.

### 2. Erfüllte Anforderungen (bereits im Runbook)
Verantwortlichkeiten/DSB, VVT, DSFA-Entscheidungshilfe, AVV-Hinweis, Betroffenenrechte, AUP-Datenminimierung, Review-Kadenz — vorhanden.

### 3. Minimaler Fix
**Neu:** `docs/compliance/data-protection-requirements.md` (ergänzend, **nicht** dupliziert) — Datenklassifikation je Fläche (KO/Anhang/Quelle/Audit/**ModelRun=keine Inhalte**/**Gap=Frage-Freitext**/Konto/Server-Logs), **lokal-vs-Cloud** (Default/Anthropic/lokale Runtime/Cloud-GPU/RAG/Fine-Tuning als DSFA-Trigger), **Aufbewahrung** (Prompts=nicht gespeichert; ModelRun-Metadaten Betreiberfrist z. B. 90 T; Gap-Frage; Audit unveränderlich+Abwägung), **AVV-/DSFA-Checkpunkte**, **Verantwortlichkeiten**, kritische offene Punkte, Done-Kriterien. **Kein Produktcode.**

### 4. Kritische Punkte
Retention-Fristen (ModelRun/Server-Logs) offen; Audit-Löschungs-Abwägung organisatorisch zu dokumentieren; Self-Service Auskunft/Löschung nur manuell (NFR-PRV-04); Gap-Frage kann PII enthalten; AVV/DSFA vor Modell-/Cloud-/RAG-/Fine-Tuning-Aktivierung.

### 5. Geänderte Dateien
NEU `docs/compliance/data-protection-requirements.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 6. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 7. Restlücken / Nicht-Ziele
Keine Rechtsbewertung/AVV/DSFA-Durchführung/Retention-Freigabe (Betreiber/DSB); keine Self-Service-DSGVO-Features; keine Folge-Ticketflut.

### 8. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Anforderungen sind nun **konsolidiert dokumentiert** (Klassifikation inkl. ehrlicher Befunde, lokal-vs-Cloud, Aufbewahrung, AVV/DSFA, Verantwortlichkeiten) — aber **rechtliche Bewertung, AVV-/DSFA-Durchführung und konkrete Fristen** sind Betreiber-/DSB-Aufgaben und liegen **nicht** vor (nicht erfunden). Dokumentationsseitig erfüllt, freigabeseitig offen → **Partial**.

### 9. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/compliance/data-protection-requirements.md docs/qm/claude-after-report.md
git commit -m "docs(compliance): consolidated data-protection requirements (classification, local-vs-cloud, retention) (SCRUM-190)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-189 — Open-Source-Modell auswählen und vergleichen — Auswahl/Vergleich
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **kein** Modell-Download/Runtime/GPU; **keine** erfundenen Benchmarks; kein Produktcode.

### 1. Vorab-Befund
- **Use-Cases (aus `provider-model.ts`):** Modell **formuliert nur** — `structure`→JSON („do not invent"), `answer` **nur aus nummerierten Quellen** (ehrliche Lücke), `assist` Wortlaut ohne Inhaltsänderung, `interview` eine Frage. Deutsch/industriell; **KOs = Wahrheit**, deterministischer Fallback bleibt Sicherheitsnetz → **kleines, permissives Modell genügt**.
- Keine `open-source-model-selection.md` → Doku-Gap.

### 2. Kandidaten / Bewertungsmatrix (Lizenz primärquellen-verifiziert)
- **Qwen2.5-7B-Instruct** Apache 2.0 (außer 3B/72B) · **Mistral-7B-Instruct/Mixtral** Apache 2.0 (neuere Mistral teils **MNPL**) · **Llama 3.1-8B** Community License (custom, 700M-MAU-Klausel) · **Gemma** Gemma Terms (custom) · **Phi-3-mini** MIT. GGUF/Ollama für alle; 7B Q4 ~5–6 GB. Deutsch-/Reasoning-Qualität **nicht** als Zahlen (keine erfundenen Benchmarks).

### 3. Zielmodell + Fallback: **empfohlen, nicht verbindlich festgelegt**
- **Ziel (Empfehlung): Qwen2.5-7B-Instruct (Apache 2.0)** — sauberste Lizenz, mehrsprachig inkl. DE, gutes Instruction-Following/JSON, passt auf Mac ≥16 GB.
- **Fallback: Mistral-7B-Instruct (Apache 2.0)**; Sparoption **Phi-3-mini (MIT)**; Llama/Gemma nur mit Custom-Lizenzakzeptanz.

### 4. Lizenz-/Hardware-/Runtime-Abhängigkeiten
Lizenz am konkreten Tag final prüfen (Versionsabweichungen). Hardware (Mac) + Runtime (Ollama) + Budget alle **Partial/unverifiziert**; Tokens/sec nicht gemessen. DSGVO: lokal = Daten im Haus (Vorteil), VVT/DSFA bei Aktivierung.

### 5. Minimaler Fix
**Neu:** `docs/operations/open-source-model-selection.md` — Anforderungen, Kandidatenmatrix (verifizierte Lizenzen + Quellen), Shortlist, Ziel/Fallback, Abhängigkeiten, Lizenz-/DSGVO-Prüfpunkte, Testplan (Klarwerk-Tasks + Eval-Baseline), Done-Kriterien, Nicht-Ziele, **Quellenliste** (HF/Mistral/Meta/Google/Microsoft). **Kein Produktcode.**

### 6. Geänderte Dateien
NEU `docs/operations/open-source-model-selection.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 7. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich. Lizenz-Recherche über offizielle Quellen (Web), als „vor Einsatz final zu prüfen" markiert.

### 8. Restlücken / Nicht-Ziele
Deutsch-/Aufgabenqualität nicht gemessen; Hardware/Runtime/Budget unverifiziert; Tokens/sec offen; keine harte Lizenzzusage ohne Tag-Verifikation; kein Download/Runtime/GPU.

### 9. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Kandidatenmatrix mit **primärquellen-verifizierten Lizenzen** + Shortlist + **empfohlenes Ziel (Qwen2.5-7B, Apache 2.0)/Fallback (Mistral-7B, Apache 2.0)** sind dokumentiert (verantwortbar, da Modell nur formuliert). Aber **Qualität nicht gemessen** und **Hardware/Runtime/Budget fehlen** → begründete Empfehlung, **keine** verbindliche Festlegung → **Partial**; verbindlich erst nach lokalem Test + Lizenz-Final-Check des Tags.

### 10. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/open-source-model-selection.md docs/qm/claude-after-report.md
git commit -m "docs(ops): open-source model selection (target Qwen2.5-7B / fallback Mistral-7B, licenses verified) (SCRUM-189)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-188 — Ziele & Use-Cases für das interne LLM definieren — Definition
**Datum:** 2026-06-27 · **Rolle:** Claude prüft/dokumentiert (Codex steuert, Pedi entscheidet Richtung). Docs-only; **keine** Modell-/Runtime-/RAG-/Fine-Tuning-Arbeit; **keine** erfundenen Benchmarks; **keine** vorgetäuschte Freigabe; kein Produktcode.

### 1. Vorab-Befund
- **Reale LLM-Aufgaben** (`ModelRunTask`): `structure | assist | interview | answer | select`. **Anti-Halluzination** in jedem Systemprompt (`provider-model.ts`: „Do not invent", „NUR auf Basis der nummerierten Quellen", „without changing content", „ask exactly ONE").
- **RBAC-Nutzergruppen:** viewer/experte/controller/admin.
- Prinzip belegt: **Modell formuliert, KOs = Wahrheit, deterministischer Fallback** als Sicherheitsnetz.
- Keine `internal-llm-use-cases.md` → Doku-Gap.

### 2. Use-Cases / Nutzergruppen / KPIs
- **Use-Cases:** Capture-Strukturierung (`structure`, JSON), Ask-Antwort (`answer`, nur aus Quellen, ehrliche Lücke), Text-Assist (`assist`, keine Inhaltsänderung), Erfassungs-Interview (`interview`, eine Frage), Quellenauswahl (`select`).
- **Nutzergruppen:** Experte (Capture/Interview/Assist), Controller (Review-Vorschlag), Admin (Betrieb), Management/Viewer (Ask/Lesen), Entwickler (separater Dev-Use-Case, kein Produkt-Wissenszugang).
- **KPIs:** Quellenbindungsrate, Gap-statt-Halluzination, JSON-Validität, hilfreiche Capture-Strukturierung, Review-Akzeptanz, Latenz, **keine Prompt-/Antwort-Persistenz** — verankert an Eval-Baseline B1–B4.
- **Volumen:** nicht gemessen → als **Annahmen/Szenarien** (Pilot/Abteilung/Werk) markiert.

### 3. Abgrenzung / Nicht-Ziele
Modell als Wissensspeicher; generischer Chat als Ask-Ersatz; ungeprüfte Entscheidungen; ungeprüfte PII/sensible Freitexte; Code-Hilfe/Kundensupport als Produktkern (nicht beschlossen).

### 4. Abstimmung/Freigabe: **nicht vorhanden**
Keine dokumentierte Pedi-/Stakeholder-Freigabe; Volumen nicht erhoben; Umsetzungs-Abhängigkeiten (Modell/Runtime/Hardware/Budget) offen.

### 5. Minimaler Fix
**Neu:** `docs/operations/internal-llm-use-cases.md` — Zweck, Nutzergruppen, Use-Cases (Code-belegt), Volumenannahmen, funktionale Anforderungen (Deutsch/Quellenbindung/JSON/Assist/Latenz/Kontext/Datenschutz/Fallback), KPIs (an Eval-Baseline), Nicht-Ziele, Abhängigkeiten, Done-Kriterien. **Kein Produktcode.**

### 6. Geänderte Dateien
NEU `docs/operations/internal-llm-use-cases.md`; `docs/qm/claude-after-report.md`. Kein Produktcode/FE.

### 7. Tests/Gates
`npm run check` grün — 128 Dateien / 700 Tests. Kein FE berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 8. Restlücken / Nicht-Ziele
Keine Stakeholder-Freigabe, kein gemessenes Volumen, offene Abhängigkeiten; keine Modell-/Runtime-Arbeit.

### 9. Empfehlung: **PARTIAL** (nicht Done)
**Begründung (Ehrlichkeit):** Ziele/Nutzergruppen/Use-Cases/Anforderungen/KPIs/Nicht-Ziele sind **dokumentiert und code-belegt** (Prinzip gewahrt) — aber es liegt **keine** dokumentierte Abstimmung/Freigabe vor und Volumen ist **nicht gemessen**. Dokumentationsseitig erfüllt, freigabeseitig offen → **Partial**.

### 10. Commit-/Push-Hinweis (nur Doku)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/operations/internal-llm-use-cases.md docs/qm/claude-after-report.md
git commit -m "docs(ops): internal LLM goals & use-cases (model formulates, KOs stay truth) (SCRUM-188)"
git push
```

No Jira changes by Claude. No tickets closed. No new tickets.

---

## SCRUM-282 — Ask-Qualität: Offtopic-Kontext ehrlich als Wissenslücke statt Scheinquelle
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **Produkt-Code-Fix** (Reasoner + Test); kein RAG/Vector/Embedding; kein Reasoner-/Provider-Refactor; keine Modelladapter-Änderung; keine UI-Änderung.

### 1. Ziel des Workflow-Slice
Flow Ask → Quellen/Trust → ehrliche Wissenslücke → Capture härten: lange/offtopic Fragen dürfen im deterministischen Fallback nicht über lose Keyword-Überschneidung als belegte Antwort erscheinen.

### 2. Vorab-Befund / Root Cause
- `keywordSelect`/`tokenize`/`overlap` (`services/reasoner/src/provider.ts`): `tokenize` filterte nur `length>2`. Dadurch zählten **Funktions-/Stoppwörter** (z. B. „ist", „die", „von") als Treffer. Eine lange Offtopic-Frage überschnitt sich über solche Stopwörter mit KOs → `score>0` → `answered=true` mit Scheinquelle (P1 aus `local-function-performance-baseline.md`).
- Numerisches Repro (Seed): Offtopic-Frage → base-Tokenizer k1/k3/k4:1 (Stopwort-Treffer); mit Stopwort-Filter → **(none)**. B1 (k1:2) und B3 (k5:1) bleiben erhalten.

### 3. Geänderte Dateien
- `services/reasoner/src/provider.ts` — **Stopwort-Set (DE/EN)** + `tokenize` filtert Stopwörter (nur generische Funktionswörter, keine Fach-/Domänenbegriffe).
- `services/reasoner/src/service.test.ts` — 2 DOM-freie Tests: Offtopic-Langkontext → `answered=false`+leere Quellen; seed-sichere Fachfrage (Ventil/Überdruck) bleibt `gesichert` mit genau einer Quelle.

### 4. Was verbessert wurde
- **Offtopic-/Langkontext → `answered=false` + Gap** (ehrliche Wissenslücke) statt Scheinquelle.
- **B1 Ventil/Überdruck** und **B3 Filter F3** weiterhin quellengebunden beantwortet (gesichert, je 1 Quelle).
- **B2 Quantenflux** bleibt Gap. **Quellen bleiben fokussiert** (SCRUM-256 intakt: nur tatsächlich genutztes KO).
- **Gap→Capture-Pfad unverändert** (keine FE-Änderung).
- Live über `/api/ask` verifiziert (In-Memory + Seed): B1 answered=true/gesichert/1 Quelle; B3 answered=true/gesichert/1 Quelle; B2 gap; Offtopic-Langkontext **gap**.

### 5. Gates
`npm run check` grün — **128 Dateien / 702 Tests** (2 neue). Biome/tsc/depcruise grün. FE nicht berührt → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Commit-/Push-Hinweis
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add services/reasoner/src/provider.ts services/reasoner/src/service.test.ts docs/qm/claude-after-report.md
git commit -m "fix(reasoner): offtopic/long context yields honest gap, not pseudo-source (stopword filter) (SCRUM-282)"
git push
```

### 7. Offene Risiken
- Stopwort-Liste ist bewusst klein/generisch; eine **einzelne seltene Inhaltswort-Überschneidung** in einem langen Blob könnte theoretisch noch einen schwachen Treffer erzeugen. Mitigation heute ausreichend (Stopwörter waren die reale Ursache); robusteres semantisches Retrieval wäre erst mit RAG (bewusst außer Scope).
- Stopwort-Filter wirkt auch auf `keywordSelect` (Kandidatenauswahl beider Provider) — Verhalten verbessert (keine Stopwort-Treffer), durch Gates abgedeckt; keine Architektur-/Modelladapter-Änderung.

### 8. Empfehlung nächster Slice
- Eval-Set in `evaluation-quality-assurance.md` um „langer Offtopic-Kontext → erwartete Gap" als festen Regressionsfall ergänzen (B5).
- Optional: schwacher Mindest-Relevanz-Score (ratio) als zusätzliche Leitplanke, falls künftig längere Freitext-Fragen auftreten.

### 9. Stop-Status
**Slice abgeschlossen, Gates grün, gestoppt.** Keine Jira-Änderungen durch Claude. Codex übernimmt Commit, Push, Jira-Kommentar und Status.

## SCRUM-283 — Ask/Risk/Capture: gespeicherte Wissenslücken datensparsam & verständlich führen
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (Anzeigetext + DOM-freier Helper + Test); kein Backend/Persistenz; kein RAG/Suche; keine PII-Erkennung; keine DSGVO-Self-Service-Funktion.

### 1. Ziel des Workflow-Slice
Flow Ask → Wissenslücke/Risk → Capture datensparsam & verständlich schärfen: bei einer gespeicherten unbeantworteten Frage soll klar sein — Fragetext wird als Lücke gespeichert, ist keine Antwort/kein validiertes Wissen, sensible/personenbezogene Details vermeiden, in Capture nur Startkontext + eigene geprüfte Erfahrung ergänzen.

### 2. Vorab-Befund / Root Cause
- **Ask-Gap-Karte:** zeigte bereits „kein validiertes Wissen … Wissenslücke angelegt" (Gap≠Antwort/Wissen), aber **keinen Datensparsamkeits-Hinweis** (keine sensiblen Details) → die eigentliche Lücke.
- **Capture:** `capture.gapContextBody` (SCRUM-270) deckt „offene Frage, kein Wissen, Startkontext, eigene Erfahrung ergänzen, prüfen & einreichen" bereits **voll** ab → **bewusst nicht verändert** (nicht verwässern).
- **Risk:** Gaps bereits als „Offene Wissenslücken" + Status „offen" + handlungsfähig; ein knapper, konsistenter Hinweis ergänzt Produktwirkung.
- Wiederverwendbare Helfer vorhanden (`captureFromGap.ts`) — idealer Ort für einen gemeinsamen Hinweis.

### 3. Geänderte Dateien
- `apps/web/src/lib/captureFromGap.ts` — DOM-freier Helper `gapPrivacyNoticeKey()` + `GAP_PRIVACY_NOTICE_KEY` (eine Quelle der Wahrheit für Ask + Risk).
- `apps/web/src/i18n.ts` — neuer Schlüssel `gap.privacyNotice` (DE + EN): „Frage wird als Wissenslücke gespeichert — keine Antwort und kein validiertes Wissen. Bitte keine sensiblen/personenbezogenen Details; ergänze später geprüfte Erfahrung."
- `apps/web/src/pages/Ask.tsx` — Hinweis in der Gap-Karte (unter „nächster Schritt").
- `apps/web/src/pages/Risk.tsx` — Hinweis als kompakte Subline unter der „Offene Wissenslücken"-Überschrift.
- `tests/capture/capture-from-gap.test.ts` — 3 neue DOM-freie Tests (Helper stabil; DE/EN benennen Lücke + Datensparsamkeit + Erfahrung).

### 4. Was verbessert wurde
- **Ask:** bei Wissenslücke jetzt explizit datensparsam + ehrlich (Frage wird als Lücke gespeichert, keine Antwort, keine sensiblen Details, später geprüfte Erfahrung).
- **Risk:** gespeicherte Frage bleibt handlungsfähig, jetzt mit ehrlichem Kontext „offene Lücke, keine Antwort/kein validiertes Wissen".
- **Capture:** unverändert (SCRUM-270-Kontext bleibt; Gap = Startkontext + eigene Erfahrung).
- **Bestehende Gap→Capture-Links** (`captureGapHref`) unverändert; **keine** Backend-/Persistenzänderung.
- Konsistenz: Ask + Risk teilen denselben i18n-Schlüssel (eine Quelle der Wahrheit).

### 5. Gates
`npm run check` grün — **128 Dateien / 705 Tests** (3 neue). `apps/web tsc --noEmit` grün (nur Sandbox-Junk-Duplikate `@types/* 2` entfernt — kein Repo-Code; null Fehler in Quelldateien). Biome/depcruise grün.

### 6. Commit-/Push-Hinweis
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/captureFromGap.ts apps/web/src/i18n.ts apps/web/src/pages/Ask.tsx apps/web/src/pages/Risk.tsx tests/capture/capture-from-gap.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ask/risk): honest, data-minimising notice for stored knowledge gaps (SCRUM-283)"
git push
```

### 7. Offene Risiken
- Reiner Hinweis-Text — **keine** technische Durchsetzung der Datensparsamkeit (Nutzer kann weiterhin sensible Details eingeben). Bewusst so (keine PII-Erkennung/Schwärzung im Scope). Backend speichert die Gap-Frage weiterhin verbatim (vgl. SCRUM-190 Befund) — unverändert.
- Hinweis erscheint generisch (nicht pro Gap-Zeile in Risk, sondern einmal pro Sektion) → bewusst, um Cluttering zu vermeiden.

### 8. Empfehlung nächster sinnvoller Slice
- Optionales Produkt-Item: serverseitige **Gap-Frage-Datenminimierung** (z. B. Längenhinweis/optionale Kürzung beim Anlegen) — als bewusste Produktentscheidung, nicht automatische PII-Erkennung.
- Capture: kurze Inline-Erinnerung „keine sensiblen Details" direkt am Rohtext-Feld, falls Nutzertests Bedarf zeigen.

### 9. Stop-Status
**Slice abgeschlossen, Gates grün, gestoppt.** Keine Jira-Änderungen durch Claude. Codex übernimmt Commit, Push, Jira-Kommentar und Status.

---

## SCRUM-284 — Ask/Risk/Capture: Gap-Fragen datensparsam begrenzen & lesbar halten
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **Backend-Produkt-Slice** (reiner Helper + Anwendung in createGap + Tests); keine PII-Erkennung/Schwärzung; keine Persistenzarchitekturänderung; kein RAG/Vector/Suche.

### 1. Ziel des Workflow-Slice
Gespeicherte Gap-Fragen datensparsam, lesbar, handhabbar halten: sehr lange Freitexte/Kontext-Blobs sollen nicht unkontrolliert als Wissenslücke gespeichert und in Risk/Capture unübersichtlich angezeigt werden.

### 2. Vorab-Befund / Root Cause
- `AskService.createGap(question)` speicherte den Fragetext **verbatim** — **kein** Trim, **keine** Whitespace-Normalisierung, **kein** Längenlimit (`services/ask/src/service.ts`).
- Folge: ein langer Blob landet voll in der Persistenz (`Gap.question`) und wird unverändert an Risk (`g.question`) und Capture (`captureGapHref(g.question)`) weitergereicht (in Risk nur per CSS visuell truncatet, aber voll gespeichert/übergeben).
- **Kleinster sicherer Ort:** ein reiner Helper, angewandt an EINER Stelle (`createGap`) → Risk/Capture erben den begrenzten Text; kein Routen-/Persistenzumbau.

### 3. Geänderte Dateien
- `services/ask/src/gap-text.ts` (neu) — reiner Helper `normalizeGapQuestion()` + `MAX_GAP_QUESTION_LENGTH=200`: trimmt, zieht Whitespace/Zeilenumbrüche zusammen, begrenzt deterministisch an Wortgrenze (sonst harter Schnitt) mit Ellipse „…". Keine PII-Erkennung/semantische Analyse.
- `services/ask/src/service.ts` — `createGap` nutzt `normalizeGapQuestion(question)`.
- `services/ask/src/gap-text.test.ts` (neu) — 6 DOM-/service-freie Tests (kurz unverändert; Whitespace/Trim; Langbegrenzung+Ellipse; Wortgrenze; eigene Maxlen; leere Eingabe).
- `services/ask/src/service.test.ts` — 1 Integrationstest (lange unbeantwortbare Frage → Gap.question ≤ 201 + endet mit „…").

### 4. Was verbessert wurde
- **Datensparsam + lesbar:** sehr lange/Offtopic-/Kontext-Fragen erzeugen keine überlange Gap-Frage mehr in Persistenz/Anzeige (deterministisch auf ≤ 200 + Ellipse begrenzt, Whitespace normalisiert).
- **Kurze normale Fragen unverändert** (z. B. „Wie kalibriere ich das Quantenflux ZZZ?" bleibt 1:1).
- **Risk/Capture erben** automatisch den begrenzten Text (eine Quelle, kein FE-Eingriff nötig).
- **Ask→Gap→Risk→Capture** bleibt funktional; **keine** Antwort-/Retrieval-Logik berührt (Normalisierung nur beim Speichern, nach der Antwortentscheidung).
- **Live verifiziert** (In-Memory + Seed): 1113-Zeichen-Blob → gespeicherte Gap-Frage **195 Zeichen**, endet mit „…", Anfang lesbar; kurze Frage **39 Zeichen** unverändert.

### 5. Gates
`npm run check` grün — **129 Dateien / 712 Tests** (+1 Datei, +7 Tests). Biome/tsc/depcruise grün. FE **nicht** berührt (Risk/Capture rendern bereits `g.question`) → `apps/web tsc --noEmit` nicht erforderlich.

### 6. Commit-/Push-Hinweis
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add services/ask/src/gap-text.ts services/ask/src/gap-text.test.ts services/ask/src/service.ts services/ask/src/service.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): normalise & length-limit stored gap questions (data-minimising, readable) (SCRUM-284)"
git push
```

### 7. Offene Risiken
- Reine **Längen-/Whitespace-Normalisierung** — **keine** semantische Beurteilung, **keine** PII-Erkennung (bewusst außer Scope); sensible Details in der ersten ~200 Zeichen bleiben erhalten (vgl. SCRUM-283 Hinweistext als ergänzende Maßnahme).
- Bestehende Alt-Gaps in der DB werden **nicht** rückwirkend normalisiert (nur neue beim Anlegen) — bewusst keine Migration/Persistenzänderung.
- `MAX_GAP_QUESTION_LENGTH=200` ist eine konservative, lesbare Wahl; bei Bedarf zentral anpassbar.

### 8. Empfehlung nächster sinnvoller Slice
- Optional: gleiche Normalisierung defensiv auch beim **Capture-Startkontext** (`readGapContext`/`gapContextDraft`) anwenden, falls Gap-Fragen aus Altbeständen/extern kommen.
- Optional: einmaliger Wartungs-Task (Codex/Ops) zur Normalisierung bestehender überlanger Alt-Gaps — bewusst getrennt, kein Auto-Migrationscode hier.

### 9. Stop-Status
**Slice abgeschlossen, Gates grün, gestoppt.** Keine Jira-Änderungen durch Claude. Codex übernimmt Commit, Push, Jira-Kommentar und Status.

---

## SCRUM-285 — Ask/Capture: Gap-Startkontext auch bei Direkt-CTA normalisieren
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + Anwendung in captureGapHref/readGapContext + Tests); keine PII-Erkennung/Schwärzung; keine Backend-/Persistenzänderung; kein RAG/Suche.

### 1. Ziel des Workflow-Slice
Ask → Wissenslücke → Capture vollständig konsistent: nicht nur gespeicherte Gap-Fragen (SCRUM-284), sondern auch **direkt per Ask-CTA** übergebene Gap-Startkontexte normalisieren/begrenzen. Lange Originalfragen dürfen nicht über `/erfassen?gap=…` als langer URL-/Capture-Kontext durchrutschen.

### 2. Vorab-Befund / Root Cause
- Ask-Gap-Karte „Wissen erfassen" baute `captureGapHref(asked)` mit **rohem** `asked`-State (nur `q.trim()`, gesetzt in `onSubmit`) → langer Originaltext → langer `?gap=…`-Kontext.
- `captureGapHref`/`readGapContext` **normalisierten nicht** (nur trim).
- `gap.question` (vom Backend per SCRUM-284 bereits normalisiert) ist im Ask-Result vorhanden, wurde aber nicht genutzt.
- **Risk→Capture** nutzt `g.question` aus der Persistenz (bereits begrenzt) → war schon sicher.
- **Kleinster sicherer Ort:** Normalisierung defensiv in `captureGapHref` (Schreiben) **und** `readGapContext` (Lesen) → deckt Ask-Direkt-CTA, externe/alte Links und Risk (idempotent) ab, ohne State-Umbau. Kein cross-package Import (Architekturgrenze) → FE-Helper spiegelt die Backend-Regel.

### 3. Geänderte Dateien
- `apps/web/src/lib/captureFromGap.ts` — neuer DOM-freier Helper `normalizeGapContext()` + `MAX_GAP_CONTEXT_LENGTH=200` (Spiegel von `services/ask/gap-text.ts`, gleiche Regel/MAX, ohne Import); `captureGapHref` und `readGapContext` normalisieren jetzt defensiv.
- `tests/capture/capture-from-gap.test.ts` — 6 neue DOM-freie Tests (kurz unverändert; Whitespace/Trim; Langbegrenzung+Ellipse; captureGapHref begrenzt rohen CTA-Text; readGapContext normalisiert externe Links; Konsistenz roh == normalisiert).

### 4. Was verbessert wurde
- **Ask→Capture Direkt-CTA** nutzt keinen überlangen Rohtext mehr — `captureGapHref(asked)` begrenzt deterministisch (≤ 200 + Ellipse). Da die FE-Regel die Backend-Regel spiegelt, ist der CTA-Kontext **identisch** zur persistierten `gap.question` (konsistenter Fluss).
- **Externe/alte `/erfassen?gap=…`-Links** werden beim Lesen defensiv normalisiert.
- **Kurze normale Gap-Fragen** bleiben unverändert; **Risk→Capture** unverändert kompatibel (idempotent); **Capture-Gap-Draft** bleibt „Offene Frage" + eigene Erfahrung (`gapContextDraft` unberührt).
- **Keine** Backend-/Persistenzänderung.

### 5. Gates
`npm run check` grün — **129 Dateien / 718 Tests** (+6). `apps/web tsc --noEmit` grün (keine Quellfehler). Biome/depcruise grün.

### 6. Commit-/Push-Hinweis
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/captureFromGap.ts tests/capture/capture-from-gap.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ask/capture): normalise gap start-context on direct CTA & external links (SCRUM-285)"
git push
```

### 7. Offene Risiken
- FE-Regel **spiegelt** die Backend-Regel (zwei Stellen, gleiche Logik/MAX) — bewusst dupliziert wegen Architekturgrenze; bei künftiger Regeländerung beide Stellen pflegen (Tests sichern beide ab).
- Reine Längen-/Whitespace-Normalisierung — keine PII-Erkennung (außer Scope); SCRUM-283-Hinweistext ergänzt die Datensparsamkeit.

### 8. Empfehlung nächster sinnvoller Slice
- Optional: gemeinsame Regel als geteiltes, architekturkonformes Util (z. B. `packages/shared`) extrahieren, um die Duplikation FE/Backend zu beseitigen — größerer, separat zu planender Refactor (kein Quick-Fix).
- Optional: einmaliger Ops-Task zur Normalisierung bestehender überlanger Alt-Gaps (wie SCRUM-284 empfohlen).

### 9. Stop-Status
**Slice abgeschlossen, Gates grün, gestoppt.** Keine Jira-Änderungen durch Claude. Codex übernimmt Commit, Push, Jira-Kommentar und Status.

---

## SCRUM-286 — Capture→Validation→Use: frisch erfasstes Wissen bis zur Nutzung führen
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + Texte + Test); kein neues Statusmodell/Engine; keine automatische Validierung/Nutzung; kein Backend; kein RAG/Suche.

### 1. Ziel des Workflow-Slice
Kernfluss Capture → Validation → Use für frisch erfasste KOs sichtbarer/verständlicher: nach dem Speichern klar machen, dass das KO gespeichert, aber **offen/zu prüfen** ist, in den Validierungsfluss gehört, erst nach ausreichender Bewertung nutzbar wird, und der Nutzer eine klare nächste Handlung Richtung Review hat.

### 2. Vorab-Befund / Root Cause
- Capture-Success-Card sagte „gespeichert" + „automatisch validiert wird nichts", aber **nicht explizit**, dass das KO **offen / noch nicht validiert** ist und erst nach Bewertung nutzbar wird → Hauptlücke.
- Die beiden Next-Steps (Objekt ansehen / Zur Validierung) waren visuell gleichwertig → Review nicht betont.
- **KO-Detail** (`koOverview`/`koCta`) zeigt offene KOs bereits ehrlich: usability „Noch in Arbeit" + nextAction „zur Freigabe bewerten lassen (Validierung)" / „Quelle/Beleg ergänzen, bevor validiert wird" → ausreichend, **nicht** verändert.
- **Validation/MyTasks** zeigen offene Arbeit bereits → kompatibel, **nicht** verändert.

### 3. Geänderte Dateien
- `apps/web/src/lib/captureSuccess.ts` — `CaptureNextStep.primary?` (Validierung = primäre Handlung); neuer DOM-freier `captureSavedStatus()` → `{badgeKey, hintKey}` für „offen — noch nicht validiert".
- `apps/web/src/i18n.ts` — neuer `capture.savedStatusBadge` (DE+EN); `capture.savedBody` geschärft („Gespeichert, aber noch nicht validiert. Erst nach ausreichender Bewertung … bitte zur Prüfung geben."); `capture.savedValidate` → „Zur Prüfung geben" / „Send for review" (DE+EN).
- `apps/web/src/pages/Capture.tsx` — Success-Card: Status-Badge neben Titel; primäre vs. neutrale CTA-Styles.
- `tests/capture/capture-success.test.ts` — 3 neue DOM-freie Tests (Validierung primary; captureSavedStatus-Schlüssel; DE/EN-Texte benennen „nicht validiert" + „Prüfung"/„review").

### 4. Was verbessert wurde
- Nach Capture ist **explizit klar**: gespeichert, aber **offen/nicht validiert**, erst nach Bewertung nutzbar, **„zur Prüfung geben"** als betonte (primary) nächste Handlung.
- Status-Badge „Status: offen — noch nicht validiert" direkt in der Success-Card.
- **Keine** automatische Validierung/Nutzung; **kein** neues Statusmodell (nutzt vorhandenes `status: offen`); **kein** Backend.
- KO-Detail/Validation/MyTasks unverändert kompatibel (offene KOs bereits ehrlich als Review-Arbeit).

### 5. Gates
`npm run check` grün — **129 Dateien / 721 Tests** (+3). `apps/web tsc --noEmit` grün. Biome/depcruise grün.

### 6. Commit-/Push-Hinweis
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/captureSuccess.ts apps/web/src/i18n.ts apps/web/src/pages/Capture.tsx tests/capture/capture-success.test.ts docs/qm/claude-after-report.md
git commit -m "feat(capture): honest 'open/not validated' status + emphasised review step after save (SCRUM-286)"
git push
```

### 7. Offene Risiken
- Status-Badge nimmt an, dass ein frisch erfasstes KO „offen" ist (per Datenmodell-Default `status: "offen"` korrekt) — kein Live-Status-Fetch (bewusst, kein Backend-Call). Falls künftig Capture KOs in anderem Status anlegt, Badge nachziehen.
- Reine Anzeige-/Führungsverbesserung — keine erzwungene Validierung; Nutzer kann das KO weiterhin liegen lassen (gewollt: keine Automatik).

### 8. Empfehlung nächster sinnvoller Slice
- Optional: In MyTasks/Validation den **gerade erfassten** offenen KO leicht hervorheben (z. B. „neu erfasst"), damit der Review-Übergang noch direkter ist — kleiner FE-Slice.
- Optional: KO-Detail-Banner für offene KOs sprachlich minimal angleichen an die neue Capture-Formulierung (Konsistenz), falls Nutzertests Bedarf zeigen.

### 9. Stop-Status
**Slice abgeschlossen, Gates grün, gestoppt.** Keine Jira-Änderungen durch Claude. Codex übernimmt Commit, Push, Jira-Kommentar und Status.

---

## SCRUM-287 — Capture→MyTasks→Validation: neu erfasste offene KOs als Review-Arbeit sichtbar machen
**Datum:** 2026-06-28 · **Rolle:** Codex setzt den Team-1-Workflow-Slice um. **FE-Produkt-Slice** (DOM-freier Helper + MyTasks/Validation + Texte + Tests); kein neues Statusmodell; keine neue Task-Engine; keine automatische Validierung; kein Backend; kein RAG/Suche.

### 1. Ziel des Workflow-Slice
Den Anschluss an SCRUM-286 schließen: Nach Capture ist klar „gespeichert, aber offen/nicht validiert". Dieses offene KO soll in **MyTasks** und **Validation** als konkrete Review-Arbeit sichtbar werden — mit derselben ehrlichen Sprache: neu/offen, noch keine Bewertung, jetzt fachlich prüfen.

### 2. Vorab-Befund / Root Cause
- **MyTasks** zeigte Validierungsaufgaben mit Typ, Titel, Autorzeile und Aktion „Wissen bewerten", aber ohne Review-Zustand.
- **Validation** zeigte Trust/Status/Version/Needed und Entscheidungshinweis, aber kein explizites „neu erfasst/offen/noch keine Bewertung"-Signal.
- Es gibt kein separates „frisch"-Feld. Sichere Ableitung aus vorhandenen Feldern: `status === "offen"` + `trust <= 0` + keine Zuweisung ⇒ „neu erfasst / offen / noch keine Bewertung". Zuweisung und bereits begonnene Bewertung werden getrennt ausgewiesen.
- Datumsheuristik wurde bewusst vermieden (keine „innerhalb X Tage"-Fiktion).

### 3. Geänderte Dateien
- `apps/web/src/lib/reviewSignals.ts` — neuer DOM-freier `reviewWorkView(ko)` mit Zuständen `new|assigned|inReview|validated`, Label-/Hint-Keys und Tone.
- `apps/web/src/pages/MyTasks.tsx` — Validierungsaufgaben zeigen zusätzlich einen kleinen Review-Zustandschip (z. B. „Neu erfasst · offen").
- `apps/web/src/pages/Validation.tsx` — Karten zeigen denselben Review-Zustandschip und ergänzen den Entscheidungshinweis um den passenden Review-Hinweis.
- `apps/web/src/i18n.ts` — `val.reviewState.*` und `val.reviewHint.*` in DE/EN.
- `tests/validation/review-signals.test.ts` — 4 neue DOM-freie Tests für `reviewWorkView`.

### 4. Was verbessert wurde
- Capture → MyTasks → Validation spricht nun konsistent: frisch erfasste KOs sind gespeichert, aber offen und **noch nicht bewertet**.
- MyTasks macht Validierungsarbeit handlungsnäher, ohne neue Aufgaben zu erzeugen.
- Validation zeigt direkt, ob ein KO neu/offen, zugewiesen, bereits in Prüfung oder validiert ist.
- Keine automatische Mutation, keine Fake-Aufgabe, kein neues Statusmodell; ausschließlich vorhandene KO-Felder (`status`, `trust`, `assignments`) werden genutzt.

### 5. Tests/Gates
- `npm run check` grün — **129 Dateien / 725 Tests** (+4).
- `apps/web tsc --noEmit` grün.
- Biome + dependency-cruiser grün.
- Hinweis: Ein erster Vitest-Lauf in der Sandbox traf EPERM beim temporären Vite/Vitest-Config-File; der identische Gate-Lauf außerhalb der Sandbox war grün.

### 6. Commit-/Push-Hinweis
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/reviewSignals.ts apps/web/src/pages/MyTasks.tsx apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts tests/validation/review-signals.test.ts docs/qm/claude-after-report.md
git commit -m "feat(review): show newly captured open KOs as review work (SCRUM-287)"
git push
```

### 7. Offene Risiken
- `trust <= 0` steht für „noch keine Bewertung" — entspricht dem aktuellen Modell für frisch erfasste offene KOs. Falls später initiale Trust-Werte anders gesetzt werden, muss die Ableitung angepasst werden.
- Alt-KOs mit `trust=0` werden ebenfalls als „neu/offen" angezeigt. Das ist fachlich nicht falsch (noch keine Bewertung), aber nicht zwingend kalendarisch „neu"; daher bewusst Label „Neu erfasst · offen" statt eines Datumsversprechens.

### 8. Empfehlung nächster sinnvoller Slice
Ask/Library/KO-Detail Konsistenz: Wenn ein Nutzer ein noch offenes KO fragt/nutzt, die Anzeige der Knowledge-Class/Quellen/Trust noch stärker gegen „gesichert"-Missverständnisse absichern (ohne neue Suche/RAG).

### 9. Stop-Status
**Slice implementiert, Gates grün.** Codex übernimmt Commit, Push, GitHub-CI, Jira-Kommentar und Status.

---

## SCRUM-288 — Ask→Library→KO Detail: offene KOs beim Nutzen klar von gesichertem Wissen trennen
**Datum:** 2026-06-28 · **Rolle:** Codex setzt den Team-1-Workflow-Slice um. **FE-Produkt-Slice** (DOM-freie Helper + Library/Ask + Texte + Tests); kein RAG; keine neue Suche; kein neues Statusmodell; keine automatische Validierung; kein Backend.

### 1. Ziel des Workflow-Slice
Den Nutzungsfluss gegen Missverständnisse absichern: Offene/ungeprüfte KOs dürfen beim Fragen/Nutzen nicht wie gesichertes Wissen wirken. Validiertes Wissen soll weiterhin direkt nutzbar sein; offene/in Prüfung befindliche Treffer führen Richtung Review/Validation.

### 2. Vorab-Befund / Root Cause
- **KO Detail** war bereits sauber: `koOverview/koCta` führt nur `ready`/validierte KOs in Ask; offene KOs gehen zu Quelle ergänzen oder Validierung.
- **Library** hatte zwar Reife-Plaketten/Filter, bot aber die CTA „Fragen" für **alle** Treffer an — auch offene/in Prüfung befindliche KOs.
- **Ask** zeigte bei nicht-gesicherten Antworten bereits „Noch ungeprüft", aber ohne klaren Review-/Validierungs-Hinweis und ohne Auswertung, ob die angezeigte Quelle selbst offen ist.

### 3. Geänderte Dateien
- `apps/web/src/lib/askView.ts` — `sourceRefs` liefert zusätzlich `validated`; neuer DOM-freier `answerReviewGuard(knowledgeClass, sources)` für ungeprüfte/offene Antworten.
- `apps/web/src/lib/libraryMaturity.ts` — neuer DOM-freier `libraryUseCta(ko)`: validiert → Ask-Deep-Link; offen/in Prüfung → `/validierung`.
- `apps/web/src/pages/Ask.tsx` — Review-Warnbox + CTA „Zur Validierung" bei ungeprüften/offenen Antworten; Quellen bleiben sichtbar.
- `apps/web/src/pages/Library.tsx` — Zeilen-CTA nutzt `libraryUseCta`: nur nutzbare KOs zeigen „Fragen"; offene/in Prüfung zeigen „Prüfen".
- `apps/web/src/i18n.ts` — `ask.reviewGuard.*` und `lib.review` in DE/EN.
- `tests/ask/ask-view.test.ts` — 3 neue Tests für Review-Guard + Quellenvalidierung in `sourceRefs`.
- `tests/library/library-maturity.test.ts` — 3 neue Tests für Library-CTA-Entscheidung.

### 4. Was verbessert wurde
- Library trennt nun **Use** von **Review**: validiertes Wissen geht in Ask, offene KOs in die Validierung.
- Ask bleibt quellengebunden, zeigt aber bei ungeprüfter/offener Quelle jetzt zusätzlich: nicht als gesichertes Wissen nutzen, erst prüfen/bewerten.
- KO-Detail musste nicht geändert werden, weil die bestehende `koOverview/koCta`-Führung bereits dem Ziel entspricht.
- Keine neue Antwortlogik, keine Retrieval-Änderung, keine Backend-Mutation — nur ehrliche Arbeitsführung auf bestehenden Feldern/Knowledge-Class.

### 5. Tests/Gates
- `npm run check` grün — **129 Dateien / 731 Tests** (+6).
- `apps/web tsc --noEmit` grün.
- Biome + dependency-cruiser grün.
- Hinweis: Der erste Gate-Lauf in der Sandbox traf erneut EPERM beim temporären Vite/Vitest-Config-File; der vollständige Gate-Lauf außerhalb der Sandbox war grün.

### 6. Commit-/Push-Hinweis
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
npm run check
(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)
git add apps/web/src/lib/askView.ts apps/web/src/lib/libraryMaturity.ts apps/web/src/pages/Ask.tsx apps/web/src/pages/Library.tsx apps/web/src/i18n.ts tests/ask/ask-view.test.ts tests/library/library-maturity.test.ts docs/qm/claude-after-report.md
git commit -m "feat(use): route open knowledge to review, not ask (SCRUM-288)"
git push
```

### 7. Offene Risiken
- Ask-Review-Hinweis basiert auf Knowledge-Class und bekannten KO-Quellen. Unbekannte Quellen bleiben generisch „ungeprüft" und führen ebenfalls zur Validierung.
- Library führt offene KOs pauschal zum Validierungsboard, nicht direkt zur konkreten Karte. Das ist konsistent mit vorhandenen Routen, aber ein späterer Deep-Link ins Board wäre möglich.

### 8. Empfehlung nächster sinnvoller Slice
Demo-/Pilot-Führung: Start/Library/Ask können einen kurzen „gesichert vs. zu prüfen"-Leitfaden oder Demo-Hinweis bekommen, damit Investor/Pilotnutzer den Unterschied sofort verstehen — ohne neue Architektur.

### 9. Stop-Status
**Slice implementiert, Gates grün.** Codex übernimmt Commit, Push, GitHub-CI, Jira-Kommentar und Status.

---

## SCRUM-289 — Demo-/Pilot-Führung: Gesichert vs. zu prüfen in Start, Library und Ask erklären
**Datum:** 2026-06-28 · **Rolle:** Codex setzt den Team-1-Workflow-Slice um. **FE-Produkt-Slice** (DOM-freier Helper + Start/Library/Ask + Texte + Tests); kein RAG; keine neue Suche; kein neues Statusmodell; keine Backend- oder Architekturänderung.

### 1. Ziel des Workflow-Slice
Pilot- und Demo-Nutzer sollen sofort verstehen: Klarwerk ist kein Chatbot. Wissen wird erfasst, geprüft, genutzt und gepflegt. Validiertes/gesichertes Wissen ist nutzbar; offenes oder in Prüfung befindliches Wissen gehört in den Review-/Validierungsfluss.

### 2. Vorab-Befund
- Start zeigt den Knowledge-OS-Kreis, erklärt aber den Unterschied „gesichert/nutzbar" vs. „offen/zu prüfen" noch nicht explizit.
- Library hat Reife-Plaketten und den Reife-Filter („Nutzbar / In Prüfung / Zu prüfen"), aber keine kurze Interpretation direkt am Filter.
- Ask ist quellengebunden und markiert ungeprüfte/offene Quellen, erklärt aber vor dem Fragen noch nicht kompakt, warum das kein generischer Chat ist.
- Vorhandene Flows/Routen reichen aus: `/bibliothek`, `/validierung`, `/fragen`. Kein neues Statusmodell nötig.

### 3. Umsetzung
Neuer DOM-freier Helper `knowledgeGuidance(surface)` mit surface-spezifischer Führung:
- **Start:** gesichert, zu prüfen, quellengebunden nutzen.
- **Library:** Reife/Nutzbarkeit erklären — gesichertes Wissen vs. Review-Arbeit.
- **Ask:** Quellenbindung + Review-Hinweis vor dem Fragen.

Die UI rendert diese Guidance als kompakte Cards/Chips mit Links ausschließlich in vorhandene Produktflüsse. Keine Mutation, kein Backend, keine neue Suchlogik.

### 4. Geänderte Dateien
- `apps/web/src/lib/knowledgeGuidance.ts` — gemeinsamer DOM-freier Guidance-Helper.
- `tests/app/knowledge-guidance.test.ts` — 5 Tests für Surface-Zuschnitt, erlaubte Routen und Tönungen.
- `apps/web/src/pages/Start.tsx` — Pilot-Führung unter dem Knowledge-OS-Kreis.
- `apps/web/src/pages/Library.tsx` — Reife-Erklärung bei Filter/Plaketten.
- `apps/web/src/pages/Ask.tsx` — Quellenbindungs-/Review-Hinweis vor dem Fragen.
- `apps/web/src/i18n.ts` — DE/EN-Texte `kg.*`.
- `docs/qm/claude-after-report.md` — dieser append-only Bericht.

### 5. Was verbessert wurde
- Der Knowledge-OS-Gedanke wird an drei Pilot-relevanten Stellen sichtbar: Start erklärt das Prinzip, Library erklärt Reife, Ask erklärt Quellenbindung.
- Validiertes Wissen bleibt direkt nutzbar; offene/in Prüfung befindliche Inhalte bleiben Review-Arbeit.
- Hinweise verlinken nur echte vorhandene Flows, keine Fake-Funktion.
- Ask wirkt stärker wie Knowledge OS statt Chatbot: Antwort nur aus Knowledge Objects; ohne Grundlage entsteht eine Lücke.

### 6. Tests/Gates
- `npm run check` grün — **130 Dateien / 736 Tests** (+1 Datei, +5 Tests).
- `apps/web tsc --noEmit` grün.
- Biome + dependency-cruiser grün.
- Hinweis: Biome musste die vier FE-Dateien mechanisch formatieren/importsortieren; danach waren alle Gates grün.

### 7. Offene Risiken
- Die Guidance ist bewusst kompakt. Für eine Investor-Demo kann später zusätzlich ein geführter Demo-Skript-/Tour-Hinweis sinnvoll sein.
- Library verlinkt Review-Arbeit weiterhin auf das vorhandene Validierungsboard, nicht auf eine einzelne gefilterte Karte.

### 8. Empfehlung nächster sinnvoller Slice
Demo-/Pilot-Storyline verdichten: Start → Ask-Beispiel → Library/KO-Detail → Validation in einem kurzen, sichtbaren „Demo-Pfad"-Hinweis oder einer Help-/Start-Verlinkung bündeln (ohne neue Engine, ohne RAG, ohne Architekturänderung).

### 9. Stop-Status
**Slice implementiert, Gates grün.** Codex übernimmt Commit, Push, GitHub-CI, Jira-Kommentar und Status.

---

## SCRUM-290 — Demo-/Pilotpfad: Start → Ask → KO-Detail → Validation sichtbar führen
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + Start-Karte + i18n + Test); keine neue Route/Search/Architektur; kein neues Statusmodell; keine Backend-Änderung; keine automatische Validierung; **kein Git/Jira durch Claude**.

### 1. Vorab-Befund
- Start rendert bereits den **Knowledge-OS-Kreis** (`KNOWLEDGE_CYCLE`) und die **SCRUM-289-Guidance** (gesichert vs. zu prüfen vs. quellengebunden). Ein konkreter, schrittweiser Demo-/Pilot-*Pfad* fehlte.
- Vorhandene Bausteine wiederverwendbar: `askQuestionHref` (Deep-Link `/fragen?q=…`, kein Auto-Submit), demo-sichere Frage „Ventil X / Überdruck" (trifft validiertes Seed-Wissen), Routen `/fragen`, `/bibliothek`, `/validierung`.
- KO-Detail braucht eine KO-ID → statisch nicht verfügbar; daher Schritt 2 über **Library** (führt zu KO-Detail), kein toter Deep-Link.

### 2. Umsetzung
- **Neuer DOM-freier Helper** `demoPilotPath.ts` mit 3 nummerierten Schritten auf **vorhandenen Routen**: (1) Ask quellengebunden via demo-sicherer Startfrage, (2) Library → Quelle/Trust/Status/Reife/Version, (3) Validation → offenes/ungeprüftes Wissen prüfen.
- **Start-Karte** „Demo-/Pilotpfad in 3 Schritten" direkt nach der SCRUM-289-Guidance (gestrichelte Karte, nummerierte Links) — kompakt, stört die normale Nutzung nicht.
- **i18n DE/EN** für Titel/Untertitel + je Schritt Label/Beschreibung; Texte machen sichtbar: Ask quellengebunden, Library zeigt Quelle/Trust/Status/Version, Validation ist der Ort für offene Inhalte.
- **Bewusst nur Start angefasst** (eine Stelle verbindet Ask/Library/Validation) statt überall Text zu verteilen; Ask/Library/Validation/KO-Detail unverändert (bereits ehrlich quellengebunden bzw. Review-Ort).

### 3. Geänderte Dateien
- NEU `apps/web/src/lib/demoPilotPath.ts` — `DEMO_PILOT_PATH` + `demoPilotPath()`.
- `apps/web/src/pages/Start.tsx` — kompakte Demo-Pfad-Karte.
- `apps/web/src/i18n.ts` — `demo.*` Schlüssel (DE+EN).
- NEU `tests/app/demo-pilot-path.test.ts` — 6 DOM-freie Tests (Schrittfolge/Nummern; Ask quellengebunden/?q=/Ventil-Überdruck; Library/Validation-Routen; nur vorhandene Routen; i18n DE/EN vollständig; Knowledge-OS-Kernbegriffe sichtbar).

### 4. Tests/Gates
`npm run check` grün — **131 Dateien / 742 Tests** (+6 neu). `apps/web tsc --noEmit` grün (keine Quellfehler). Biome/depcruise grün.

### 5. Restlücken/Nicht-Ziele
- Schritt 2 nutzt **Library** als Einstieg zu KO-Detail (kein statischer KO-Deep-Link, da KO-ID dynamisch) — bewusst, kein toter Link.
- Keine neue Route/Search/RAG/Architektur; kein neues Statusmodell; keine automatische Validierung; validiertes Wissen bleibt nutzbar, offene Inhalte bleiben Review-Arbeit; normale Nutzung unverändert.
- Optionale Ask-„Das zeigt dieser Schritt"-Orientierung bewusst weggelassen (Ask hat bereits SCRUM-289-Guidance → nicht überladen).

### 6. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoPilotPath.ts apps/web/src/pages/Start.tsx apps/web/src/i18n.ts tests/app/demo-pilot-path.test.ts docs/qm/claude-after-report.md
git commit -m "feat(start): visible Stage-1 demo/pilot path Start→Ask→Library→Validation (SCRUM-290)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff, führt Gates, committet, pusht, wartet CI ab, schließt Jira.

---

## SCRUM-291 — Demo-/Pilotpfad auf Zielseiten wiedererkennbar machen
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freie Helper + kleine Komponente + i18n + Tests); keine neue Route/Search/RAG; keine Reasoner-/Backend-Änderung; kein neues Statusmodell; **kein Git/Jira durch Claude**.

### 1. Vorab-Befund
- SCRUM-290 brachte den Demo-Pfad nur auf **Start**. Ask/Library nutzen bereits `useSearchParams`; Validation noch nicht; KO-Detail nutzt `useParams` (Route-ID).
- Query-Param-Muster vorhanden (`?q=` askQuestion, `?gap=` captureFromGap) → konsistentes Vorbild für `?demo=stage1`.
- KO-Detail braucht KO-ID → pro Ticket lieber **Ask + Library + Validation** sauber verbinden (kein statischer Fake-KO-Link).

### 2. Umsetzung
- `demoPilotPath.ts` erweitert: `DEMO_PARAM`/`DEMO_VALUE`, **`withDemo(href)`** (hängt `?demo=stage1` an, bewahrt bestehende Query), **`isDemoContext(params)`**, **`demoSurfaceBanner(surface)`** (DOM-frei). Jeder Pfad-Schritt trägt jetzt den Demo-Kontext weiter.
- Neue kleine Komponente `DemoBanner.tsx` — kompakte, wiedererkennbare Hinweisbox (Schrittnummer, „was hier zu sehen ist", optional „nächster Schritt" mit erhaltenem Demo-Kontext).
- **Ask/Library/Validation**: rendern den Banner **nur** bei `isDemoContext(params)` (Validation: `useSearchParams` ergänzt). Ohne Demo-Kontext **keinerlei** Änderung der normalen Nutzung.
- i18n DE/EN: `demo.banner.*` (Tag + je Seite Titel/Body + Ask/Library „nächster Schritt").

### 3. Geänderte Dateien
- `apps/web/src/lib/demoPilotPath.ts` (erweitert), NEU `apps/web/src/components/DemoBanner.tsx`.
- `apps/web/src/pages/Ask.tsx`, `Library.tsx`, `Validation.tsx` (je Banner + Gate; Validation zusätzlich `useSearchParams`).
- `apps/web/src/i18n.ts` (`demo.banner.*` DE+EN).
- `tests/app/demo-pilot-path.test.ts` (erweitert: +Demo-Kontext-Tests; bestehende Pfad-`to`-Assertions auf `split("?")[0]` umgestellt).

### 4. Tests/Gates
`npm run check` grün — **131 Dateien / 748 Tests** (Demo-Pfad-Suite jetzt 12 Tests). `apps/web tsc --noEmit` grün (keine Quellfehler). Biome/depcruise grün.

### 5. Restlücken/Nicht-Ziele
- **KO-Detail bewusst ausgelassen** (kein stabiler statischer Demo-Link ohne KO-ID); Library deckt „Quelle/Trust/Status/Reife/Version" + Übergang zur Validierung ab.
- Demo-Kontext ist reine **Anzeige-/Orientierungsschicht** (Query-Param + Banner); keine neue Route/Search/RAG, keine Reasoner-/Backend-/Statusmodell-Änderung, keine automatische Validierung. **Normale Nutzung ohne `?demo=stage1` unverändert.** Ask bleibt quellengebunden; Validation bleibt Review-Ort.

### 6. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoPilotPath.ts apps/web/src/components/DemoBanner.tsx apps/web/src/pages/Ask.tsx apps/web/src/pages/Library.tsx apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts tests/app/demo-pilot-path.test.ts docs/qm/claude-after-report.md
git commit -m "feat(demo): recognisable Stage-1 pilot path banners on Ask/Library/Validation via ?demo=stage1 (SCRUM-291)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff, führt Gates, korrigiert minimal, committet, pusht, wartet CI ab, schließt Jira.

---

## SCRUM-292 — Validation → Use: nach Bewertung Nutzbarkeit & nächste Verwendung klar führen
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + Card-Status-Zeile + i18n + Tests); keine Backend-/Reasoner-Änderung; keine Review-Mutationsänderung; kein neues Statusmodell; keine automatische/Fake-Validierung.

### 1. Vorab-Befund
- SCRUM-277-Success-Card zeigt nach `rate` `val.decisionSaved` („Bewertung erfasst.") + KO-Titel + `reviewNextSteps` (KO ansehen immer; „Wissen nutzen" nur bei `up`).
- **Fehlte:** ehrliche, verdict-abhängige **Folge-Aussage** („was passiert jetzt mit dem Wissen") — bei `up` nutzbar (wenn Status/Trust tragen), bei `warn`/`down` weiter Review-Arbeit.
- KO-Detail (`koOverview`/`koCta`) zeigt Nutzbarkeit bereits ehrlich (Produktionsnah nutzbar/In Prüfung/Noch in Arbeit) → konsistent, **unverändert**. Review-Mutation/Pflicht-Feedback unverändert.

### 2. Umsetzung
- `reviewDecision.ts`: neuer DOM-freier `reviewOutcome(verdict)` → `{statusKey, tone, usable}`. `up` = pos/usable (grundsätzlicher Weg in quellengebundene Nutzung, **wenn Status/Trust tragen**); `warn`/`down` = warn/crit, usable=false (Review-/Feedback-Arbeit). **Behauptet keine automatische/vollständige Validierung.**
- Validation-Success-Card: ehrliche **Status-Zeile** (`reviewOutcome(...).statusKey`) zwischen Titel und CTAs. Bestehende CTAs (KO ansehen; „Wissen nutzen" nur bei `up` via `askQuestionHref`) unverändert.
- i18n DE/EN: `val.outcome.up/warn/down`.

### 3. Geänderte Dateien
- `apps/web/src/lib/reviewDecision.ts` (reviewOutcome ergänzt; reviewNextSteps unverändert).
- `apps/web/src/pages/Validation.tsx` (Status-Zeile + Import).
- `apps/web/src/i18n.ts` (`val.outcome.*` DE+EN).
- `tests/validation/review-decision.test.ts` (4 neue Tests: tone/usable; statusKeys; up-Ehrlichkeit „keine automatische/vollständige Validierung"; warn/down = Review-Arbeit DE/EN).

### 4. Tests/Gates
`npm run check` grün — **131 Dateien / 752 Tests** (+4). `apps/web tsc --noEmit` grün. Biome/depcruise grün.

### 5. Restlücken/Nicht-Ziele
- KO-Detail bewusst unverändert (bereits ehrliche Nutzbarkeits-Anzeige). Keine neue Route/Search/RAG; keine Reasoner-/Backend-Änderung; keine Mutationsänderung; kein neues Statusmodell.
- `up` führt in **bestehende** Use-Flows (KO ansehen/Ask via askQuestionHref) — Ask zeigt selbst echten Status/Lücke (kein Fake-Flow). `warn`/`down` bleiben sichtbar Review-/Feedback-Arbeit. Normale Review-Mutationen + Pflicht-Feedback unverändert.

### 6. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/reviewDecision.ts apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts tests/validation/review-decision.test.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): honest post-review outcome (usable vs still-review) without fake validation (SCRUM-292)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff, führt Gates, korrigiert minimal, committet, pusht, wartet CI ab, schließt Jira.

---

## SCRUM-293 — Use-Flow konsistent: Nutzbarkeit/Trust/Quellen über KO-Detail/Library/Ask angleichen
**Datum:** 2026-06-28 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + 2 Produktstellen + i18n + Tests); keine Backend-/Reasoner-Änderung; kein neues Statusmodell; keine automatische/Fake-Validierung; kein Git/Jira durch Claude.

### 1. Vorab-Befund
- `koOverview` (KO-Detail) und `libraryMaturity` (Library) nutzen **denselben** `KoUsability`-Typ (ready/in-review/needs-work), aber **divergente Labels**: ready = „Produktionsnah nutzbar" (KO-Detail) vs „Nutzbar" (Library); needs-work = „Noch in Arbeit" vs „Zu prüfen" → echte Begriffs-Inkonsistenz.
- Ask nutzt für die **Antwort** „Gesichert/Noch ungeprüft" + reviewGuard (SCRUM-250) — bereits ehrlich & konsistent mit „gesichert"; bewusst **nicht** verändert (kein Text-Aufblähen).

### 2. Umsetzung
- **Neuer geteilter, DOM-freier Helper** `useReadiness(usability)` → `{labelKey, hintKey, tone}` als **eine Quelle der Wahrheit** für die Use-Readiness-Sprache.
- **KO-Detail**: Plaketten-Label + neue ehrliche **Hint-Zeile** aus `useReadiness`.
- **Library**: `libraryMaturity`-META (Plakette **und** Reife-Filter-Chips) zieht Label/Tone aus `useReadiness` → identische Begriffe wie KO-Detail.
- i18n DE/EN `use.ready/review/open.label` + `.hint` (ehrlich: „nutzbar" nur WEIL validiert; „in Prüfung" = noch nicht als gesichert nutzen; „zu prüfen" = erst bewerten lassen).

### 3. Geänderte Dateien
- NEU `apps/web/src/lib/useReadiness.ts`.
- `apps/web/src/lib/libraryMaturity.ts` (META → useReadiness; Plakette+Filter konsistent).
- `apps/web/src/pages/KnowledgeDetail.tsx` (Label via useReadiness + Hint-Zeile + Import).
- `apps/web/src/i18n.ts` (`use.*` DE+EN).
- NEU `tests/ko/use-readiness.test.ts` (kanonische Map; **Cross-Surface-Konsistenz** libraryMaturity==useReadiness; i18n DE/EN; Ehrlichkeit). `tests/library/library-maturity.test.ts` (Label-Erwartungen auf `use.*` angepasst).

### 4. Tests/Gates
`npm run check` grün — **132 Dateien / 756 Tests** (+4 netto). `apps/web tsc --noEmit` grün. Biome/depcruise grün.

### 5. Restlücken/Nicht-Ziele
- KO-Detail und Library nutzen jetzt **identische Begriffe** (Nutzbar/In Prüfung/Zu prüfen) für denselben Zustand; Trust/Status/Version/Quellen werden weiterhin aus den vorhandenen, nicht-widersprüchlichen Feldern gezeigt.
- **Ask unverändert** (bereits ehrlich „gesichert/ungeprüft" + reviewGuard) — bewusst nicht aufgebläht. Alte `ko.use.*`/`lib.maturity.usable/review/open`-Keys bleiben unbenutzt im i18n (harmlos; können später entfernt werden).
- Keine neue Suche/RAG/Reasoner-/Backend-Änderung; keine automatische Validierung; offene/ungeprüfte Inhalte bleiben „Zu prüfen" (nie nutzbar); validiertes Wissen führt unverändert in bestehende Use-Flows (Ask via askQuestionHref / KO-Detail / Library).

### 6. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/useReadiness.ts apps/web/src/lib/libraryMaturity.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/ko/use-readiness.test.ts tests/library/library-maturity.test.ts docs/qm/claude-after-report.md
git commit -m "feat(use-flow): shared, honest use-readiness vocabulary across KO detail & library (SCRUM-293)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff/Gates, korrigiert minimal, committet, pusht, wartet CI ab, schließt Jira.

---

## SCRUM-294 — Demo-/Pilotpfad: Library → KO-Detail → Ask als sichtbaren Use-Fluss führen
**Datum:** 2026-06-29 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + KO-Detail-Surface + Kontext-Propagierung + i18n + Tests); keine Backend-/Reasoner-/Suchänderung; kein neues Statusmodell; keine automatische/Fake-Validierung; kein Git/Jira durch Claude.

### 1. Vorab-Befund
- Demo-Pfad (SCRUM-290/291) deckte Start/Ask/Library/Validation ab; **KO-Detail fehlte** als Demo-Surface, und der Use-Fluss **Library → KO-Detail → Ask** trug den Demo-Kontext nicht weiter (KO-Links/Use-CTA ohne `?demo=stage1`; KO-Detail/Ask lasen ihn nicht für die dynamischen Links).
- `withDemo` ist bereits robust (Hash/Dedupe); Library/Ask nutzen `useSearchParams`, KO-Detail nicht.

### 2. Umsetzung
- `demoPilotPath.ts`: **`detail`** als `DemoSurface` + KO-Detail-Banner (Status/Trust/Version/Quellen → unten quellengebunden fragen; kein statischer `next`-Link, da KO-ID dynamisch). Neuer DOM-freier Helper **`demoHref(href, params)`** = trägt `?demo=stage1` **nur** im Demo-Kontext weiter (sonst unverändert).
- **Library**: KO-Titel-Link (`/wissen/:id`) und Use-CTA via `demoHref(…, params)` → Library → KO-Detail / Library → Ask behalten den Kontext.
- **KO-Detail**: `useSearchParams`; im Demo-Kontext `DemoBanner surface="detail"`; Route-Use-CTA (`koCta` → Ask) via `demoHref` → KO-Detail → Ask quellengebunden mit Kontext.
- **Ask**: unverändert — zeigt im Demo-Kontext bereits sein Banner (quellengebunden, „auf Trust/Quelle achten"); der Kontext kommt jetzt automatisch über KO-Detail an (kein neuer Ask-Text → kein Aufblähen).
- i18n DE/EN: `demo.banner.detail.title/body` (ehrlich: quellengebunden, „nichts wird automatisch gesichert").

### 3. Geänderte Dateien
- `apps/web/src/lib/demoPilotPath.ts` (detail-Surface + demoHref).
- `apps/web/src/pages/Library.tsx` (KO-Link + Use-CTA via demoHref).
- `apps/web/src/pages/KnowledgeDetail.tsx` (useSearchParams + DemoBanner surface=detail + Route-CTA via demoHref).
- `apps/web/src/i18n.ts` (`demo.banner.detail.*` DE+EN).
- `tests/app/demo-pilot-path.test.ts` (+4: detail-Surface ohne next; demoHref Propagierung/Dedupe; i18n-Ehrlichkeit).

### 4. Tests/Gates
`npm run check` grün — **132 Dateien / 760 Tests** (Demo-Pfad-Suite 16). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

### 5. Restlücken/Nicht-Ziele
- **Normale Nutzung ohne `?demo=stage1` unverändert**: `demoHref` lässt Links unangetastet, KO-Detail-Banner erscheint nicht.
- Validiertes/nutzbares Wissen führt über bestehende Use-Flows (Library-Ask-CTA / KO-Detail-Use-CTA → Ask quellengebunden); offene/ungeprüfte Inhalte werden nicht als gesichert behauptet (useReadiness/Status/Trust unverändert sichtbar). KO-Detail hat keinen statischen Demo-„next"-Link (KO-ID dynamisch) — die vorhandene Use-CTA ist der nächste Schritt.
- Keine neue Suche/RAG/Reasoner-/Backend-Änderung; keine automatische Validierung/Fake-Freigabe.

### 6. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoPilotPath.ts apps/web/src/pages/Library.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/demo-pilot-path.test.ts docs/qm/claude-after-report.md
git commit -m "feat(demo): visible Library→KO-detail→Ask use-flow via demo context propagation (SCRUM-294)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff/Gates, korrigiert minimal, committet, pusht, wartet GitHub CI ab, schließt Jira.

---

## SCRUM-295 — Demo-/Pilotpfad live prüfen & sichtbare Reibungen im Stage-1-Flow glätten
**Datum:** 2026-06-29 · **Rolle:** Claude prüft live + setzt minimal um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + gated Ask-Hinweis + i18n + Test); keine Backend-/Reasoner-/Suchänderung; kein neues Statusmodell; keine automatische/Fake-Validierung.

### 1. Vorab-Befund
- Demo-Pfad (SCRUM-290–294): Start-Karte (Ask/Library/Validation), DemoBanner-Surfaces ask/library/detail/validation, `withDemo`/`isDemoContext`/`demoHref`-Propagierung. Seed (`seed-demo.ts`): 5 KOs (Ventil validiert+1 Quelle; Filter validiert ohne Quelle; 3 offen), Validation-Board = `list({status:"offen"})`.

### 2. Live-/Runtime-Review (In-Memory + Seed, real ausgeführt)
- **reasoner-status:** `{active:false, provider:"deterministic"}`.
- **Ask „Ventil X / Überdruck":** answered=true, **gesichert, trust=100, 1 Quelle** (validiertes KO). ✓
- **/api/kos:** 5 KOs; Demo-Ziel Ventil = validiert, trust 100, v1, **1 Quelle** — Status/Trust/Version/Quellen konsistent. ✓
- **/api/validation/board:** **3 offene Review-KOs** (Pumpe, Kaltstart×2) → „Validation = Review-Arbeit" ist real belegt. ✓ (erste Abfrage hatte falsche URL `/api/validation` → 0; korrekter Endpoint ist `/api/validation/board`.)
- **Fluss kohärent:** Start→Ask→Library→KO-Detail→Ask→Validation; Demo-Kontext propagiert über `demoHref` (Library→KO-Detail→Ask); keine Fake-Validierung; offene KOs (z. B. Pumpe/Kaltstart-Review) erscheinen nicht als gesichert.
- **Sichtbare Reibung (P2):** Kommt ein Pilot über die KO-Detail-„Wissen nutzen"-CTA mit **vorbefüllter** Startfrage nach Ask (`?q=…&demo=stage1`), gibt es **keinen** Hinweis, dass die Frage nur Startpunkt ist und „Fragen" zu klicken ist (kein Auto-Submit; Antwort bleibt quellengebunden). → einzige sinnvolle kleine Glättung.
- Übrige Beobachtungen = **keine** Reibung: KO-Detail use-CTA bei offenem KO führt korrekt zur Validierung (nicht Ask); Library-Banner-„next"→Validierung ist Pfad-Schritt 3; Seed-„Filter ohne Quelle" ist nicht das Demo-Ziel.

### 3. Umsetzung (minimal, 1 Reibung)
- `askQuestion.ts`: DOM-freier `isPrefilledAskQuestion(params)` (true bei vorbefüllter `?q=…`).
- `Ask.tsx`: **gated Hinweis** nur bei `isDemoContext(params) && isPrefilledAskQuestion(params) && !result` — „Startfrage übernommen, auf ‚Fragen' klicken; Antwort bleibt quellengebunden; Status/Trust entscheiden, nichts wird automatisch gesichert." Ohne Demo-Kontext **unverändert**.
- i18n DE/EN `ask.demoPrefillHint`.

### 4. Geänderte Dateien
- `apps/web/src/lib/askQuestion.ts` (isPrefilledAskQuestion).
- `apps/web/src/pages/Ask.tsx` (gated Hinweis + Import).
- `apps/web/src/i18n.ts` (`ask.demoPrefillHint` DE+EN).
- `tests/ask/ask-question.test.ts` (+2: Helper-Erkennung; i18n-Ehrlichkeit DE/EN).

### 5. Tests/Gates
`npm run check` grün — **132 Dateien / 762 Tests** (+2). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. Zusätzlich: realer In-Memory-Live-Run (Ask/KOs/Validation-Board), Server gestoppt.

### 6. Restlücken/Nicht-Ziele
- **Normale Nutzung ohne `?demo=stage1` unverändert** (Hinweis erscheint nicht; kein Auto-Submit). Trust/Status/Version/Quellen unverändert sichtbar & widerspruchsfrei; offene Inhalte nicht als gesichert behauptet.
- Bewusst **nicht** geändert: Seed (Filter-KO ohne Quelle), Library-Banner-„next", KO-Detail-CTA-Logik — alle kohärent/ehrlich. Keine neue Suche/RAG/Reasoner-/Backend-Änderung, keine automatische Validierung.

### 7. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/askQuestion.ts apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts tests/ask/ask-question.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): honest prefilled-question hint in demo/use context (source-bound, no auto-validate) (SCRUM-295)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff/Gates, korrigiert minimal, committet, pusht, wartet GitHub CI ab, schließt Jira.

---

## SCRUM-296 — Demo-/Pilotpfad: Capture → Validation → Use als vollständigen Wissensfluss führen
**Datum:** 2026-06-29 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + Capture-Surface + Demo-Kontext-Propagierung + Start-Einstieg + i18n + Tests); keine Backend-/Reasoner-/Suchänderung; kein neues Statusmodell; keine automatische/Fake-Validierung; kein Git/Jira durch Claude.

### 1. Vorab-Befund
- Capture-Success ist seit SCRUM-286 ehrlich (Badge „offen — noch nicht validiert", Body „erst nach Bewertung nutzbar — zur Prüfung geben", primärer „Zur Prüfung geben"-Schritt). **Aber:** die Success-Next-Step-Links trugen den Demo-Kontext **nicht** weiter, und **Capture war keine Demo-Surface** (kein Banner, kein Demo-Einstieg) → der aktive Erfassungsfluss fehlte im Demo-Pfad.
- `demoHref`/`withDemo`/DemoBanner-Infrastruktur (SCRUM-291/294) vorhanden; Capture nutzt `useSearchParams` bereits (gapContext).

### 2. Umsetzung
- `demoPilotPath.ts`: **`capture`** als `DemoSurface` + Banner (gespeichert wird ein OFFENES KO → zur Prüfung → erst danach quellengebunden nutzbar; `next` → /validierung?demo=stage1). Neuer DOM-freier **`captureDemoHref()`** = `withDemo("/erfassen")` (Demo-Einstieg).
- **Capture.tsx**: `DemoBanner surface="capture"` bei `isDemoContext`; Success-Next-Step-Links via `demoHref(s.to, params)` → Capture→Validation/KO-Detail behalten `?demo=stage1`.
- **Start.tsx**: kleiner Einstiegslink in der Demo-Karte „Aktiv ausprobieren: Erfassen → Prüfen → Nutzen" → `captureDemoHref()`.
- i18n DE/EN: `demo.banner.capture.title/body/next` + `demo.captureEntry`.
- Capture-Success-Copy selbst (SCRUM-286) **unverändert** — bereits ehrlich (offen/nicht validiert, primär zur Prüfung).

### 3. Geänderte Dateien
- `apps/web/src/lib/demoPilotPath.ts` (capture-Surface + captureDemoHref).
- `apps/web/src/pages/Capture.tsx` (DemoBanner + Success-Links demoHref + Imports).
- `apps/web/src/pages/Start.tsx` (Capture-Einstiegslink).
- `apps/web/src/i18n.ts` (`demo.banner.capture.*` + `demo.captureEntry` DE+EN).
- `tests/app/demo-pilot-path.test.ts` (+3: capture-Surface/next; captureDemoHref; i18n-Ehrlichkeit DE/EN).

### 4. Tests/Gates
`npm run check` grün — **132 Dateien / 765 Tests** (Demo-Pfad-Suite 19). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

### 5. Restlücken/Nicht-Ziele
- **Demo-/Pilotnutzer können Capture → Validation → Use verstehen**: Start-Einstieg → Capture-Banner (OFFENES KO, nicht validiert) → Success führt mit Demo-Kontext zur Validierung → von dort (SCRUM-292) ehrliche Use-Folge.
- **Normale Nutzung ohne `?demo=stage1` unverändert**: Capture-Banner erscheint nicht; `demoHref` lässt Success-Links unangetastet; Capture-Success-Copy gleich.
- Frisch erfasstes KO bleibt offen/nicht validiert; keine automatische Validierung/Fake-Freigabe; Nutzung bleibt quellengebunden & status/trust-abhängig. Keine neue Suche/RAG/Reasoner-/Backend-Änderung.

### 6. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoPilotPath.ts apps/web/src/pages/Capture.tsx apps/web/src/pages/Start.tsx apps/web/src/i18n.ts tests/app/demo-pilot-path.test.ts docs/qm/claude-after-report.md
git commit -m "feat(demo): active Capture→Validation→Use flow in demo context (open KO, no fake validation) (SCRUM-296)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff/Gates, korrigiert minimal, committet, pusht, wartet GitHub CI ab, schließt Jira.

---

## SCRUM-297 — Start/MyTasks: nächste Review-/Use-Arbeit nach Capture schneller finden
**Datum:** 2026-06-29 · **Rolle:** Claude setzt um (Codex steuert, Pedi entscheidet Richtung). **FE-Produkt-Slice** (DOM-freier Helper + 2 Produktstellen + i18n + Tests); keine neue Task-Engine/Datenquelle; kein neues Statusmodell; keine Backend-/Reasoner-/Suchänderung; keine automatische Validierung; kein Git/Jira durch Claude.

### 1. Vorab-Befund
- `taskAction(typeKey)` liefert Action+Tone, `workCenter` liefert Severity + Work-Overview-Items, aber **keine sichtbare Knowledge-OS-Phase** (Erfassen/Validieren/Nutzen/Aktuell halten) je Arbeit. MyTasks-Typen (`task.gap/returned/validation/conflict/revalidation`) und Start-Work-Keys (`conflicts/criticalGaps/revalidation/validation/learning`) sind zwei Vokabulare ohne gemeinsame Phasen-Sprache. Die Kreis-Labels `cycle.*.label` existieren bereits (wiederverwendbar).

### 2. Umsetzung
- `taskAction.ts`: neuer DOM-freier `knowledgeOsPhase(key)` → mappt **beide** Vokabulare (MyTasks-typeKeys **und** Start-Work-Keys) auf eine Knowledge-OS-Phase (capture/validate/maintain; „use" reserviert), plus `phaseLabelKey(phase)` → `cycle.<phase>.label` (eine Sprache für Start, MyTasks, Kreis). Offene Lücke/Nacharbeit → Erfassen; Validierung/Konflikt → Validieren; Revalidierung/Lernpfad → Aktuell halten.
- **MyTasks.tsx**: je Task-Zeile ein **Phase-Chip** (`Phase: Erfassen/Validieren/Aktuell halten`) neben dem Typ-Badge → sofort erkennbar, in welche Kreis-Phase die Arbeit gehört.
- **Start.tsx**: Fokus-Card (bester nächster Einstieg) zeigt zusätzlich die **Phase** der nächsten Arbeit — gleiche Sprache wie MyTasks.
- i18n DE/EN: `task.phaseLabel` („Phase:"); die Phasenbezeichnungen kommen aus den vorhandenen `cycle.*.label` (keine doppelten Texte).

### 3. Geänderte Dateien
- `apps/web/src/lib/taskAction.ts` (knowledgeOsPhase + phaseLabelKey + KnowledgeOsPhase).
- `apps/web/src/pages/MyTasks.tsx` (Phase-Chip + Import).
- `apps/web/src/pages/Start.tsx` (Phase in Fokus-Card + Import).
- `apps/web/src/i18n.ts` (`task.phaseLabel` DE+EN).
- `tests/app/task-action.test.ts` (+5: typeKey-Phasen; Work-Key-Phasen; Cross-Konsistenz Task==Start; Fallback; i18n cycle.*.label + phaseLabel DE/EN).

### 4. Tests/Gates
`npm run check` grün — **132 Dateien / 770 Tests** (+5). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

### 5. Restlücken/Nicht-Ziele
- Start/MyTasks zeigen jetzt klar die Knowledge-OS-Phase: **offene Review-Arbeit → Validieren** (Validierung/Konflikt), **Lücken → Erfassen** (führen über vorhandene Flows nach /risiko→Capture), **Aktuell halten** (Revalidierung/Lernpfad). Nutzbares Wissen führt unverändert über die bestehenden Use-Flows (kein Task-Typ — „Use" entsteht nach Validierung).
- **Normale Nutzung unverändert**: nur ein zusätzlicher Phase-Chip; gleiche Routen/CTAs; keine neue Datenquelle/Task-Engine, kein neues Statusmodell, keine Fake-Erledigung. Validation/Library/Ask **nicht** angefasst (Links/CTAs waren korrekt). Phase nutzt die bestehende Kreis-Sprache (Konsistenz).

### 6. Commit-/Push-Hinweis (nur Hinweis — Claude führt NICHT aus)
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/taskAction.ts apps/web/src/pages/MyTasks.tsx apps/web/src/pages/Start.tsx apps/web/src/i18n.ts tests/app/task-action.test.ts docs/qm/claude-after-report.md
git commit -m "feat(start/tasks): show Knowledge-OS phase (capture/validate/maintain) on Start & MyTasks (SCRUM-297)"
git push
```
Keine Jira-Änderungen durch Claude. Codex prüft Diff/Gates, korrigiert minimal, committet, pusht, wartet GitHub CI ab, schließt Jira.

---

## SCRUM-298 — Gap/Risk → Capture → Validation: Wissenslücken als Arbeitsfluss klar führen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
Risk-Gap-Zeilen zeigen Priorität, `gapNextStep` (priorisieren/zuweisen/erfassen) und die Capture-CTA (`captureGapHref` → `/erfassen?gap=`). Der Capture-aus-Gap-Banner (`capture.gapContextTitle/Body` + `gapPrivacyNotice`, SCRUM-270/283) markiert die Gap-Frage ehrlich als offene Frage ohne Wissen; die Capture-Success-Card führt mit primärem Schritt „Zur Prüfung geben" nach `/validierung` (SCRUM-286). **Lücke:** Die Knowledge-OS-**Phase** (SCRUM-297: `task.gap→capture`) war auf den Risk-Gap-Zeilen nicht sichtbar — Gaps lasen sich wie eine lose Liste, nicht als „Erfassen"-Arbeit im Kreis.

**2. Umsetzung**
Kleiner Workflow-Slice, der den Gap→Capture→Validation-Fluss als Knowledge-OS-Arbeit sichtbar macht, ohne Logik-/Backend-Änderung:
- Neuer DOM-freier Helper `gapPhase(gap)` in `apps/web/src/lib/gapPriority.ts`: offene Lücke → `capture` (Erfassen), geschlossene → `maintain`. Konsistent mit `knowledgeOsPhase("task.gap")` (Start/MyTasks) — eine Kreis-Sprache an allen Stellen.
- `Risk.tsx`: je offene Gap-Zeile ein Phase-Chip „Phase: Erfassen" neben dem bestehenden nächsten Schritt (gleiche Optik wie MyTasks/Start). i18n **wiederverwendet** (`task.phaseLabel` + `cycle.capture.label`) — keine neuen Keys nötig.
- Capture-Banner + Success unverändert: bereits ehrlich (Gap = Startkontext, kein Wissen → Review/Validation). Keine Auto-Schließung, keine KO-Erzeugung außerhalb des bestehenden Capture-Flows.

**3. Geänderte Dateien**
- `apps/web/src/lib/gapPriority.ts` (neuer `gapPhase`-Helper)
- `apps/web/src/pages/Risk.tsx` (Phase-Chip je offene Gap-Zeile + Imports)
- `tests/ask/gap-priority.test.ts` (+3 Tests: offen→capture, geschlossen→maintain, Konsistenz mit knowledgeOsPhase)

**4. Tests/Gates**
`npm run check` grün — **132 Dateien / 773 Tests** (+3). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Offene Gaps führen unverändert über `captureGapHref` in den bestehenden Capture-Flow; neu lesbar als „Erfassen"-Phase. Capture aus Gap markiert weiterhin klar: Gap-Frage = Startkontext, kein fertiges Wissen; neues KO bleibt offen → Validation/Review. Keine automatische Lücken-Schließung, keine KO-Erzeugung über bestehendes Capture hinaus, keine neue Task-Engine/Suche/RAG, keine Backend-/Reasoner-/Statusmodell-Änderung, keine Fake-Erledigung. Validation nicht angefasst (Übergang war bereits sichtbar).

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/gapPriority.ts apps/web/src/pages/Risk.tsx tests/ask/gap-priority.test.ts docs/qm/claude-after-report.md
git commit -m "feat(risk): show Knowledge-OS phase (Erfassen) on open gaps; gapPhase helper (SCRUM-298)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira.

---

## SCRUM-299 — Lifecycle/Revalidation → Validation/Use als Maintain-Arbeitsfluss klar führen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
Die Pending-Revalidierungs-Card (`Lifecycle.tsx`) zeigt StatusPill „revalidierung", Anlagenbezug, KO-Titel-Link, den ehrlichen nächsten Schritt (`revalidationView.nextStep`: review/validate/openKo), Missing-Hinweis, CTA in den bestehenden Validierungsfluss (`revalidationCta` → `/validierung`, null bei nicht auflösbarem KO) und den „Noch gültig"-Confirm; nach Bestätigung führt die Success-Card über `revalidationNextSteps` zu `/wissen/:id` und optional `/fragen?q=<Titel>` (kein Auto-Submit). **Lücke:** Wie zuvor `gapPhase` auf Risk (SCRUM-298) fehlte die Knowledge-OS-**Phase „Aktuell halten"** (Maintain) auf der Revalidierungs-Card — fällige Revalidierungen lasen sich wie eine Sonderliste statt als Maintain-Arbeit im Kreis.

**2. Umsetzung**
Kleiner Workflow-Slice analog SCRUM-298, ohne Logik-/Backend-Änderung:
- Neuer DOM-freier Helper `revalidationPhase(view)` in `apps/web/src/lib/revalidation.ts`: review/openKo → `maintain` (Aktuell halten), validate → `validate`. Damit wird ehrlich unterschieden: re-zu-prüfendes/validiertes Wissen ist Maintain-Arbeit; ein noch **nicht** freigegebenes KO ist ehrlich „Validieren" (keine Maintain-/Gültigkeits-Suggestion). Konsistent mit `knowledgeOsPhase("task.revalidation")` (Start/MyTasks).
- `Lifecycle.tsx`: je fällige Revalidierung ein Phase-Chip „Phase: Aktuell halten" (bzw. „Validieren") neben der StatusPill — gleiche Optik/Kreis-Sprache wie Risk/MyTasks/Start. i18n **wiederverwendet** (`task.phaseLabel` + `cycle.maintain.label`/`cycle.validate.label`), keine neuen Keys.
- Übergänge unverändert: CTA → `/validierung`, Success → KO-Detail/Ask. Keine automatische Revalidierung, keine Fake-Gültigkeit; nach „Noch gültig" wird weiterhin nur der nächste Schritt gezeigt, keine dauerhafte Auto-Gültigkeit suggeriert.

**3. Geänderte Dateien**
- `apps/web/src/lib/revalidation.ts` (neuer `revalidationPhase`-Helper)
- `apps/web/src/pages/Lifecycle.tsx` (Phase-Chip je pending Revalidierung + Imports)
- `tests/library/revalidation.test.ts` (+4 Tests: review/openKo→maintain, validate→validate, Konsistenz mit knowledgeOsPhase)

**4. Tests/Gates**
`npm run check` grün — **132 Dateien / 777 Tests** (+4). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Fällige Revalidierungen sind jetzt sichtbar „Aktuell halten"-Arbeit; der nächste Schritt führt unverändert über vorhandene Review-/Validation-/Detail-/Ask-Flows. Noch nicht freigegebenes KO wird ehrlich als „Validieren" geführt. Normale Nutzung unverändert (nur ein Phase-Chip). Keine automatische Revalidierung, keine Fake-Gültigkeit/-Freigabe, keine neue Lifecycle-/Workflow-/Task-Engine, kein neues Statusmodell, keine neue Suche/RAG, keine Backend-Architekturänderung. Start/MyTasks nicht angefasst (Maintain dort bereits korrekt über SCRUM-297).

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/revalidation.ts apps/web/src/pages/Lifecycle.tsx tests/library/revalidation.test.ts docs/qm/claude-after-report.md
git commit -m "feat(lifecycle): show Knowledge-OS phase (Aktuell halten) on due revalidations; revalidationPhase helper (SCRUM-299)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira.

---

## SCRUM-300 — Ask-Antwort → Quellen → KO-Detail als klarer Use-Fluss
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
Ask zeigt bei beantworteten Fragen schon: ehrlichen Antwort-Status (`answerStatus` aus knowledgeClass: gesichert/ungeprüft), Trust-Bar (`ConfidenceBar`), Evidenzklasse, Review-Leitplanke für ungeprüfte/offene Quellen (`answerReviewGuard` → `/validierung`) und die Quellen als Links zu `/wissen/:id` (`sourceRefs` löst KO-Titel auf). Der Gap-Pfad (keine Basis) ist ehrlich und führt nach Capture/Risiko. **Produktreibung:** (a) je Quelle fehlte der **Nutzbarkeits-Kontext** — die Quellen-Liste sagte nicht, ob das benutzte KO „Nutzbar/In Prüfung/Zu prüfen" ist, obwohl KO-Detail & Library dafür bereits eine kanonische Sprache haben (`useReadiness`); (b) die Quell-/Review-Links trugen den **Demo-Kontext** (`?demo=stage1`) nicht weiter, obwohl KO-Detail & Validation Demo-Surfaces sind (`demoHref`); (c) die Kernaussage „Antwort ist nur so belastbar wie ihre Quelle" war nicht explizit. Status/Trust waren konsistent, aber Nutzbarkeit fehlte ganz.

**2. Umsetzung**
Kleiner Use-Fluss-Slice, ohne neue Such-/Retrieval-/Reasoner-Logik:
- `apps/web/src/lib/askView.ts`: `SourceRef` um `usability: KoUsability | null` erweitert; `sourceRefs` leitet die Nutzbarkeit je bekannter Quelle **kanonisch** über `koOverview(ko).usability` ab — exakt dieselbe Ableitung wie KO-Detail/Library, also kein Widerspruch und kein neues Statusmodell. Unbekannte Quelle → `null` (kein Fake-Zustand).
- `apps/web/src/pages/Ask.tsx`: je Quelle ein Nutzbarkeits-Chip über `useReadiness(s.usability)` (gleiche Labels/Tönung wie KO-Detail/Library, Hint als `title`); Quell-Links und die Review-Guard-CTA über `demoHref(href, params)` (trägt `?demo=stage1` ehrlich weiter, no-op außerhalb Demo, kein Auto-Use); ein kurzer Quellen-Hinweis `ask.sourcesHint`, der die Quellenbindung explizit macht.
- `apps/web/src/i18n.ts`: `ask.sourcesHint` DE + EN (Nutzbarkeits-Labels `use.*` wiederverwendet, keine neuen Readiness-Keys).
- Gap-/unbeantwortet-Pfad unverändert (bleibt ehrlich, führt in Capture).

**3. Geänderte Dateien**
- `apps/web/src/lib/askView.ts` (SourceRef.usability + koOverview-Ableitung)
- `apps/web/src/pages/Ask.tsx` (Quellen-Readiness-Chip, demoHref-Links, Quellen-Hinweis)
- `apps/web/src/i18n.ts` (`ask.sourcesHint` DE/EN)
- `tests/ask/ask-view.test.ts` (sourceRefs-Erwartungen um usability erweitert + Konsistenz mit koOverview + i18n-Präsenz)

**4. Tests/Gates**
`npm run check` grün — **132 Dateien / 779 Tests**. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Beantwortete Ask-Ergebnisse zeigen jetzt klar, welche Quelle/KO benutzt wurde und wie belastbar sie ist (Status/Trust + kanonische Nutzbarkeit), und führen über den Quell-Link nachvollziehbar ins KO-Detail bzw. (im Demo) mit Kontext weiter. Status/Trust/Nutzbarkeit stammen aus derselben Ableitung wie KO-Detail/Library → kein Widerspruch. Unbeantwortete Fragen/Gaps bleiben unverändert ehrlich und führen in Capture. Normale Nutzung unverändert, nur klarer geführt. Keine neue Suche/RAG/Retrieval, keine Reasoner-/Backend-Architekturänderung, keine neue Quellen-Engine, keine Fake-Quellen, keine automatische Validierung/Freigabe, keine neue Task-Engine, kein Refactoring ohne Produktnutzen.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/askView.ts apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts tests/ask/ask-view.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ask): source usability (useReadiness) + demo-aware KO links in answered results (SCRUM-300)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira.

---

## SCRUM-301 — Pilot-Story Start → Library → KO-Detail als sichtbare Proof-Linie schärfen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
Library-Treffer zeigt bereits vollständig: Reife/Nutzbarkeit (`libraryMaturity` → `useReadiness`-Label/Tönung), `StatusPill`, Typ, Titel, `ConfidenceBar` (Trust/Confidence) und den Weg ins KO-Detail (`demoHref('/wissen/:id')`) plus Use-CTA. KO-Detail-Overview zeigt vollständig: Nutzbarkeit (`useReadiness(koOverview(ko).usability)`), Status (`StatusPill`), Trust, Version (`v{ov.version}`), Quellen/Anhänge und die nächste Handlung — alles aus `koOverview` (kein neues Modell). Die Demo-Banner (`demoSurfaceBanner` library/detail) erklären die Beweisaussage, `?demo=stage1` wird über `withDemo`/`demoHref` ehrlich weitergetragen. **Eine echte Reibung:** Start beschreibt den Pfad Ask-zentriert (`demo.subtitle`), aber die konkrete Beweiskette „Wissen finden → Nutzbarkeit erkennen → Quelle/Trust/Version prüfen" — die Library (Schritt 2) und KO-Detail dann demonstrieren — wird auf Start nicht als sichtbare Linie benannt. Library/KO-Detail/useReadiness selbst sind bereits konsistent; kein Eingriff dort nötig.

**2. Umsetzung**
Minimaler Slice, der die Proof-Linie auf Start sichtbar macht und an die vorhandene Belegkette koppelt — keine neue Funktion/Architektur/Route:
- Neuer DOM-freier Helper `apps/web/src/lib/proofChain.ts`: `PROOF_CHAIN`/`proofChain()` als EINE Quelle der Wahrheit mit drei Beats (`find` → `usability` → `verify`) und stabilen i18n-Keys. Nur Datenbeschreibung, keine Logik/Route/Engine.
- `apps/web/src/pages/Start.tsx`: auf der vorhandenen Demo-/Pilotpfad-Karte eine kompakte Beweisketten-Zeile „Beweiskette: Wissen finden → Nutzbarkeit erkennen → Quelle/Trust/Version prüfen" unter dem Untertitel (keine Layout-Neugestaltung, gleiche Karte). Begriff „Nutzbarkeit" identisch zur `useReadiness`-Plakette, die der Betrachter dann in Library/KO-Detail sieht.
- `apps/web/src/i18n.ts`: `demo.proof.label/find/usability/verify` DE + EN.

**3. Geänderte Dateien**
- `apps/web/src/lib/proofChain.ts` (NEU, DOM-freie Beweisketten-Daten)
- `apps/web/src/pages/Start.tsx` (Beweisketten-Zeile auf der Demo-Karte + Import)
- `apps/web/src/i18n.ts` (`demo.proof.*` DE/EN)
- `tests/app/proof-chain.test.ts` (NEU: Reihenfolge/ids/Keys + DE/EN-Präsenz)

**4. Tests/Gates**
`npm run check` grün — **133 Dateien / 782 Tests** (+3). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Start/Library/KO-Detail erzählen jetzt denselben Pilot-Beweis: Start verspricht die Linie „finden → Nutzbarkeit erkennen → Quelle/Trust/Version prüfen", Library löst „finden + Nutzbarkeit + Status/Trust + Weg ins Detail" ein, KO-Detail belegt „Status/Trust/Version/Quellen". Begriffe konsistent mit `useReadiness`/Trust/Status/KO-Detail-Banner (kein Widerspruch). Normale Nutzung ohne Demo-Kontext unverändert (die Beweiszeile steht auf der vorhandenen Demo-Karte, keine neue Mechanik); Demo-Kontext weiterhin nur über `withDemo`/`demoHref`, kein Fake-Deep-Link. Keine neue Suche/RAG/Retrieval, keine Reasoner-/Backend-Änderung, keine neue Datenquelle/Fake-Quellen, keine automatische Validierung, keine neue Task-/Workflow-Engine, keine große UI-Neugestaltung, kein Refactoring ohne Produktnutzen. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` unberührt.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/proofChain.ts apps/web/src/pages/Start.tsx apps/web/src/i18n.ts tests/app/proof-chain.test.ts docs/qm/claude-after-report.md
git commit -m "feat(start): visible pilot proof line (find -> usability -> verify) on demo card; proofChain helper (SCRUM-301)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira.

---

## SCRUM-302 — Pilot-Finalcheck: Stage-1-Pfad browsernah prüfen und letzte echte Reibung bündeln
**Datum:** 2026-06-29 · **Rolle:** Claude (Finalcheck) · **Ergebnis:** keine Codeänderung nötig (kein Fix erzwungen)

**1. Vorab-Befund (runtime-/API-nah, frisch geseedet)**
In-Memory-App gebaut (`buildApp(buildServices())`), Admin registriert, Demo via `POST /api/admin/demo-seed` geseedet (5 KOs, 2 validiert, 1 Lücke, 1 Konflikt, 1 fällige Revalidierung) und der Stage-1-Pfad API-nah durchgespielt:
- **Start → Demo-/Proof-Linie:** Demo-Pilotpfad (3 Schritte) + Beweiskette „Wissen finden → Nutzbarkeit erkennen → Quelle/Trust/Version prüfen" sind vorhanden und greifen auf reale Routen (SCRUM-290/301).
- **Ask (demo-sichere Frage „Wann muss Ventil X bei Überdruck geschlossen werden?")** → `POST /api/ask`: `answered=true`, `knowledgeClass=gesichert`, `trust=100`, genau **1 Quelle** (das validierte Ventil-X-KO), kein Gap. Quellengebunden, kein Chatbot-Verhalten, keine erfundene Antwort.
- **Ask-Quelle → KO-Detail:** Quelle löst auf ein KO `status=validiert, trust=100, v1, sources=1, attachments=1` → `koOverview.usability=ready` → `useReadiness`-Label „Nutzbar". Antwort-Status (gesichert) ↔ Quelle ↔ Status ↔ Trust ↔ Nutzbarkeit **widerspruchsfrei**. Quell-Link trägt im Demo-Kontext `?demo=stage1` über `demoHref` weiter (SCRUM-294/300), Readiness-Chip je Quelle (SCRUM-300).
- **Library:** 5 Treffer; validierte KOs `trust=100` → „Nutzbar"; offene KOs `trust=0/50` → „Zu prüfen". Wichtig und ehrlich: das offene KO mit `trust=50` erscheint **nicht** als „nutzbar"/„validiert" — Reife folgt dem Status, nicht allein dem Trust (keine falsche Nutzbarkeits-Suggestion). Jede Zeile: Reife + StatusPill + Trust-Bar + Weg ins Detail.
- **KO-Detail:** Overview belegt Nutzbarkeit + Status + Trust + Version + Quellen/Anhänge + nächste Handlung aus `koOverview` (SCRUM-251/293).
- **Validation-Board:** 3 offene KOs → echte Review-Arbeit (keine Fake-Freigabe).

**2. Umsetzung**
**Keine Codeänderung.** Der Pfad ist nach den Slices SCRUM-296…301 bereits konsistent und ehrlich; es wurde keine echte Produktreibung gefunden, die einen sichtbaren Fix rechtfertigt. Es wurde bewusst kein Fix erzwungen (Nicht-Ziel „kein Refactoring/Feature ohne direkten Produktnutzen"). Der temporäre Walkthrough wurde nur lokal zur Prüfung genutzt und wieder entfernt (nicht eingecheckt).

**Trennung des Befunds:**
- *Bereits gut:* Ask quellengebunden (gesichert/trust100/1 Quelle); Konsistenz Trust/Status/Nutzbarkeit/Quellen über `koOverview`/`useReadiness`; Library-Reife folgt Status (offen≠nutzbar trotz trust50); KO-Detail-Proof vollständig; `?demo=stage1` über `withDemo`/`demoHref` weitergetragen; normale Nutzung ohne Demo-Kontext unverändert.
- *Echte Reibung:* keine gefunden.
- *Nicht-Ziel:* keine neue Suche/RAG/Retrieval, keine Reasoner-/Backend-Änderung, keine neue Datenquelle/Fake-Quellen, keine Auto-Validierung, keine neue Task-/Workflow-Engine, keine UI-Neugestaltung.

**3. Geänderte Dateien**
Keine (nur dieser After-Report-Eintrag). Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bewusst unberührt.

**4. Tests/Gates**
`npm run check` grün — **133 Dateien / 782 Tests** (unverändert zu SCRUM-301). Keine FE-Quelländerung → kein erneuter FE-tsc-Lauf nötig (zuletzt SCRUM-301 grün). Runtime-Walkthrough manuell grün (Seed + Ask + KO + Library + Board konsistent).

**5. Restlücken/Nicht-Ziele**
Stage-1-Pilotpfad ist runtime-nah verifiziert und intern konsistent. Offene größere Themen bleiben außerhalb von Stage-1/diesem Ticket (z. B. echte lokale LLM-Runtime/RAG/Vector — siehe frühere Readiness-Dokumente, durchgängig ehrlich als Partial/Blocked markiert). Kein neues Statusmodell, keine Ticketserie, keine Jira-Strukturänderung, keine Team-2/3-Arbeit.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/qm/claude-after-report.md
git commit -m "docs(qm): SCRUM-302 pilot final check — Stage-1 verified runtime-near, no code change needed"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-303 — Pilot-Readiness: Team-1 Knowledge-OS Status und Go/No-Go dokumentieren
**Datum:** 2026-06-29 · **Rolle:** Claude (Doku) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
After-Report SCRUM-296…302 und vorhandene Doku gesichtet: Slices SCRUM-296 (Capture→Validation→Use), 297 (Knowledge-OS-Phase auf Start/MyTasks), 298 (Gap→Capture-Phase), 299 (Lifecycle/Maintain-Phase), 300 (Ask-Quellen-Nutzbarkeit + demoHref), 301 (Proof-Linie auf Start). Zuletzt belegte Gates: `npm run check` grün — 133 Dateien / 782 Tests (SCRUM-301/302). SCRUM-302 Runtime-Befund: Ask Ventil X → gesichert/trust100/1 Quelle, KO validiert/trust100/v1/1 Quelle+1 Anhang → ready; Library validierte trust100 (Nutzbar), offene trust0/50 (Zu prüfen); Board 3 offen; keine Widersprüche. Vorhandene Quellen: `docs/demo/stage-1-demo-path.md` (Seed/Rollen/Reasoner-Modus/Demo-Sprache), `docs/operations/evaluation-quality-assurance.md` (gated Eval 9 Dateien/68 Tests, deterministisch vs. Modellmodus), `docs/operations/monitoring-logging.md`. `docs/demo/stage-1-pilot-readiness.md` existierte noch nicht.

**2. Umsetzung**
Genau ein kompaktes Readiness-Dokument neu erstellt: `docs/demo/stage-1-pilot-readiness.md` mit den geforderten Abschnitten — (1) Kurzfazit/Go-No-Go: **GO mit P2-Hinweisen**, managementtauglich; (2) belegte Kernflows (Start/Demo, Capture→Validation, Ask→Quellen→KO-Detail, Library/Nutzbarkeit, Gap/Risk→Capture, Lifecycle/Revalidation); (3) Evidence (lokale Gates 133/782, GitHub CI grün laut Codex/Pedi zu `9bb18f3`, SCRUM-302-Runtime-Befund, gated Eval 9/68, Seed-Mindestsignale); (4) Was bereit ist; (5) P2/Pilot-Hinweise; (6) Nicht Stage-1 (kein RAG, keine neue Suche, keine lokale LLM-Runtime, keine automatische Validierung, keine Fake-Quellen, keine Backend-/Reasoner-Architekturänderung); (7) Demo-Voraussetzungen (frischer Seed, Rollen, Demo-Sprache DE, deterministischer Fallback vs. Modellmodus); (8) Empfehlung nächster Schritt nach dem Pilot. Nur belegte Aussagen, Testzahlen ausschließlich aus dem After-Report übernommen.

**3. Geänderte Dateien**
- `docs/demo/stage-1-pilot-readiness.md` (NEU)
- `docs/qm/claude-after-report.md` (dieser Eintrag)
Kein Produktcode, keine FE-Datei berührt. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` unberührt.

**4. Tests/Gates**
`npm run check` grün — **133 Dateien / 782 Tests** (unverändert). FE-tsc nicht nötig (keine FE-Datei berührt).

**5. Restlücken/Nicht-Ziele**
Reines Statusdokument, keine fachliche Arbeit, keine UI-Politur, keine Architekturentscheidung, keine Jira-Strukturänderung, keine Team-2/3-Arbeit. P2/Ops-Themen (automatisiertes Modellmodus-Eval, produktives Monitoring, lokale Runtime/RAG/Vector) bleiben außerhalb Stage-1 und sind im Dokument ehrlich als nicht-Stage-1 markiert.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/demo/stage-1-pilot-readiness.md docs/qm/claude-after-report.md
git commit -m "docs(demo): Stage-1 pilot readiness & Go/No-Go status for Team-1 Knowledge-OS (SCRUM-303)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-304 — Pilot-Datenlauf: reale Erfahrungsnotiz durch Capture → Validation → Use führen
**Datum:** 2026-06-29 · **Rolle:** Claude (Pilot-Datenlauf) · **Ergebnis:** kein Fix nötig (Flow ehrlich & konsistent)

**1. Vorab-Befund**
API-Vertrag des Flows gesichtet (Route-Tests): Capture `POST /api/kos` → 201, KO `status=offen, trust=0`; Validierung über `PUT /api/kos/:id` mit `action:"assign"` bzw. `action:"rate" {verdict}`; Board `GET /api/validation/board`; Ask `POST /api/ask` → `{result, gap}`. FE-Helfer für Ehrlichkeit vorhanden: `captureSavedStatus` (offen-Badge), `koOverview`/`useReadiness` (Nutzbarkeit aus Status), `askView.answerStatus`/`answerReviewGuard`/`sourceRefs.usability` (ungeprüft → Review-Guard + „Zu prüfen").

**2. Umsetzung — Pilot-Datenlauf (In-Memory, API-nah) — kein Fix nötig**
Frisch geseedet (`POST /api/admin/demo-seed`), dann eine realistische industrielle Erfahrungsnotiz als Experte (Erik) erfasst: „Hydraulikpumpe HP-7 bei Kavitationsgeräusch sofort abstellen" mit Statement, 2 conditions, 3 measures, Kategorie „Anlage 3", neededValidations=2. Beobachtet:
- **Capture:** `status=offen, trust=0, v1`; strukturierte Felder laufen verlustfrei durch (`conditions`/`measures`/`category` exakt zurückgelesen). ✓ frisch erfasst = offen/nicht validiert.
- **Ask vor Validierung:** `answered=true`, aber `knowledgeClass=ungeprueft, trust=0`, Quelle = das offene KO. Im FE damit als **ungeprüft** (answerStatus warn) + **Review-Guard → /validierung** + Quellen-Chip „Zu prüfen" (needs-work) markiert — also **nicht** als gesichert/nutzbar. ✓ ehrlich.
- **Validation:** das neue offene KO ist im Board auffindbar (Boardgröße 4). 1. grüne Bewertung → bleibt `offen, trust=50`; 2. grüne Bewertung (distinct User) → `validiert, trust=100`. ✓ keine Auto-/Fake-Freigabe.
- **Ask nach Validierung:** `answered=true, knowledgeClass=gesichert, trust=100`, quellengebunden auf dasselbe KO. ✓ Use nur statusbewusst.
- **Echter Gap:** unpassende Frage („Drehmomentwert Förderbandrolle FB-12") → `answered=false, knowledgeClass=unbekannt`, Lücke ehrlich erfasst. ✓ kein Erfinden.

**Bewertung:** Der Flow ist mit realistischen Eingaben durchgängig ehrlich und widerspruchsfrei (offen↔ungeprüft↔„Zu prüfen", validiert↔gesichert↔trust100). Es wurde **keine echte Produktreibung** gefunden, die einen sichtbaren Fix rechtfertigt; entsprechend wurde kein Fix erzwungen (Nicht-Ziel: kein Mini-Polish, keine erzwungene Änderung). Die geprüften Eigenschaften sind bereits durch bestehende Route-Tests (`validation-routes`, `ask-routes`) und DOM-freie Helfer-Tests (`askView`, `captureSuccess`, `useReadiness`) abgesichert → keine neuen Tests nötig. Der temporäre Walkthrough wurde nur lokal genutzt und wieder entfernt (nicht eingecheckt).

**3. Geänderte Dateien**
Keine (nur dieser After-Report-Eintrag). Kein Produktcode, keine FE-Datei, keine Tests geändert. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` unberührt.

**4. Tests/Gates**
`npm run check` grün — **133 Dateien / 782 Tests** (unverändert). Keine FE-Quelländerung → FE-tsc nicht erforderlich. Zusätzlich: realer In-Memory-Pilot-Datenlauf (Capture→Ask→Validation→Ask→Gap) manuell durchgespielt, Server geschlossen.

**5. Restlücken/Nicht-Ziele**
Reiner Verifikationslauf — keine neue Architektur/Suche/RAG/Task-Engine, keine automatische Validierung, keine Fake-Quellen, keine Seed-Massenänderung, keine Team-2/3-Arbeit, kein Deployment. Hinweis (kein Bug): Ask kann ein noch offenes KO als Antwort liefern, kennzeichnet es aber ehrlich als „ungeprüft" mit Review-Pfad — bewusstes Stage-1-Verhalten (SCRUM-288/300), kein Widerspruch zu „offene Inhalte nie als gesichert/nutzbar".

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add docs/qm/claude-after-report.md
git commit -m "docs(qm): SCRUM-304 pilot data run Capture->Validation->Use verified honest, no code change"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-305 — Pilot-Feedback: In-App-Checkliste für ersten Nutzerlauf sichtbar machen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
`helpTopics.ts` hat eine saubere DOM-freie Topic-Struktur (HELP_TOPICS + `filterHelpTopics`), `Help.tsx` rendert sie als durchsuchbares Kapitel-Grid; Routen-Links nur intern. Eine **kompakte Pilot-Checkliste für den ersten Nutzerlauf existiert in-app nicht** — die Stage-1-Ehrlichkeit (frisch erfasst = offen, Review nötig, Use quellen-/statusbewusst, Gap bleibt Gap, Revalidation = Maintain) steht bisher nur in `docs/demo/stage-1-pilot-readiness.md`/`stage-1-demo-path.md`. Start trägt bereits Demo-Pfad + Proof-Linie; weitere Hinweise dort wären „Demo-Politur" (Nicht-Ziel). **Am wenigsten störend: Help** — ein fixer Orientierungspunkt, der die normale Hilfe-Suche nicht verändert.

**2. Umsetzung**
Kleiner Produkt-Slice, kein Backend/Tracking/keine neue Route:
- Neuer DOM-freier Helper `apps/web/src/lib/pilotChecklist.ts`: `PILOT_CHECKLIST`/`pilotChecklist()` als EINE Quelle der Wahrheit mit 5 ehrlichen Stage-1-Prüfpunkten in fester Reihenfolge (Capture → Validation → Use → Gap → Maintain), jeweils mit i18n-Key und Verweis auf eine **vorhandene** App-Route (`/erfassen`, `/validierung`, `/fragen`, `/risiko`, `/lebenszyklus`).
- `apps/web/src/pages/Help.tsx`: kompakte, nicht durchsuchbare Pilot-Checklisten-Karte oberhalb des Suchfelds (fixer Orientierungspunkt; stört die Hilfe-Suche nicht, keine neue Pflichtstrecke). Jede Zeile: Nummer + ehrlicher Prüfpunkt + Link „Bereich öffnen" (vorhandener Key `help.openRoute`).
- `apps/web/src/i18n.ts`: `pilot.title`, `pilot.subtitle`, `pilot.check.capture/validation/use/gap/maintain` DE + EN (Parität). Texte ohne Stage-2-Versprechen, ausdrücklich: „speichert offen", „keine automatische Freigabe/Dauergültigkeit", „kein erfundenes Wissen".

**3. Geänderte Dateien**
- `apps/web/src/lib/pilotChecklist.ts` (NEU, DOM-freie Checklisten-Daten)
- `apps/web/src/pages/Help.tsx` (Pilot-Checklisten-Karte + Import)
- `apps/web/src/i18n.ts` (`pilot.*` DE/EN)
- `tests/app/pilot-checklist.test.ts` (NEU: Reihenfolge/ids/n, Routen ⊆ vorhandene Help-Routen, DE/EN-Präsenz, Stage-1-Ehrlichkeits-Assertions)

**4. Tests/Gates**
`npm run check` grün — **134 Dateien / 786 Tests** (+4). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Pilotführer/Nutzer sehen jetzt kompakt im Hilfe-Center, was im ersten echten Lauf zu prüfen ist — ehrlich, Stage-1-nah, mit Direktlinks. Start unberührt (keine zusätzliche Demo-Politur). Keine neue Feedback-DB, keine Backend-API, keine Analytics-/Tracking-Architektur, keine neue Route/Task-Engine, kein RAG/keine neue Suche, keine Architekturänderung, keine Stage-2-Versprechen, keine Team-2/3-Arbeit. Doku (`stage-1-pilot-readiness.md`) blieb unverändert (kein Verweis nötig, da die Checkliste jetzt in-app steht). Normale Nutzung unverändert (Karte ist nur ein zusätzlicher, nicht durchsuchbarer Orientierungsblock).

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/pilotChecklist.ts apps/web/src/pages/Help.tsx apps/web/src/i18n.ts tests/app/pilot-checklist.test.ts docs/qm/claude-after-report.md
git commit -m "feat(help): in-app Stage-1 pilot checklist for first user run; pilotChecklist helper (SCRUM-305)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-306 — Pilot-Start: nach Demodaten direkt in den Stage-1-Lauf führen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
`Admin.tsx` lädt Demodaten über `demoSeed`-Mutation (`POST /api/admin/demo-seed`); bei Erfolg nur ein **transienter Toast** (`adm.seedDone` mit kos/users bzw. `adm.seedSkipped`), danach bleibt der Operator im Admin-Kontext **ohne sichtbaren Next-Step**. Vorhandene Routen/Helfer nutzbar: Start `/start`, Hilfe `/hilfe` (SCRUM-305-Pilot-Checkliste sitzt dort oben), demo-sicherer Ask-Deep-Link bereits als `DEMO_PILOT_PATH[0].to` (`/fragen?q=…&demo=stage1`). **Echte Lücke:** kein In-Context-Übergang in den Stage-1-Lauf nach dem Seed.

**2. Umsetzung**
Kleiner Produkt-Slice, keine Auto-Navigation/keine neue Route/kein Backend:
- Neuer DOM-freier Helper `apps/web/src/lib/pilotNextSteps.ts`: `PILOT_NEXT_STEPS`/`pilotNextSteps()` mit 3 Operator-Next-Steps auf **vorhandene** Routen — Start (`/start`), Pilot-Checkliste (`/hilfe`), demo-sichere Beispiel-Frage (`DEMO_PILOT_PATH[0].to`, kein Fake-Link, kein Auto-Submit).
- `apps/web/src/pages/Admin.tsx`: in der Demodaten-Karte ein Next-Step-Block, der **nur nach erfolgreichem Seed und nicht bei „übersprungen"** erscheint (`demoSeed.isSuccess && !demoSeed.data?.skipped`) — Links, keine automatische Weiterleitung. Ohne Seed bzw. bei übersprungenem Seed bleibt Admin exakt unverändert.
- `apps/web/src/i18n.ts`: `pilot.next.title/hint/start/checklist/ask` DE + EN. Der Hinweis bleibt ehrlich: „Demodaten sind Beispiele, kein produktiver Beweis."

**3. Geänderte Dateien**
- `apps/web/src/lib/pilotNextSteps.ts` (NEU, DOM-freie Next-Step-Daten)
- `apps/web/src/pages/Admin.tsx` (Next-Step-Block nach Seed + Imports)
- `apps/web/src/i18n.ts` (`pilot.next.*` DE/EN)
- `tests/app/pilot-next-steps.test.ts` (NEU: Reihenfolge/ids, Routen = vorhandene/Deep-Link aus Demo-Pilotpfad, DE/EN-Präsenz, Ehrlichkeits-Assertion „Beispiele/examples")

**4. Tests/Gates**
`npm run check` grün — **135 Dateien / 790 Tests** (+4). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Nach dem Demodaten-Start sind die nächsten Handlungen sichtbar (Stage-1 öffnen, Pilot-Checkliste, Beispiel-Frage) — ehrlich (Demodaten = Beispiele), ohne Auto-Validierung und ohne Auto-Weiterleitung. Normale Admin-Nutzung unverändert (Block nur nach echtem Seed). Nur vorhandene Routen/Helper, keine Fake-Deep-Links. Keine neue Seed-Logik, keine Datenbank/Tracking-/Feedback-API, keine neue Task-Engine/Suche/RAG, keine Architekturänderung, keine Team-2/3-Arbeit, kein Deployment.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/pilotNextSteps.ts apps/web/src/pages/Admin.tsx apps/web/src/i18n.ts tests/app/pilot-next-steps.test.ts docs/qm/claude-after-report.md
git commit -m "feat(admin): show Stage-1 pilot next steps after demo seed; pilotNextSteps helper (SCRUM-306)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-307 — Pilot-Befunde: Reibungen in bestehende Knowledge-OS-Flows übersetzen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
`pilotChecklist.ts` (SCRUM-305) liefert die ehrliche Stage-1-Checkliste, `Help.tsx` rendert sie als Karte oberhalb der Suche; `pilotNextSteps.ts` (SCRUM-306) führt nach dem Seed in den Lauf. **Es fehlte** eine sichtbare **Einordnung beobachteter Reibungen** in die bestehenden Flows — Pilotführer hatten kein „so etwas gesehen → gehört in diesen vorhandenen Klarwerk-Fluss". Vorhandene Routen für die Zuordnung sind da: `/risiko`, `/validierung`, `/lebenszyklus`, `/bibliothek` (alle in HELP_TOPICS). Lücke bestätigt; reine UX-Notizen dürfen ausdrücklich keinen Fake-Flow/keine Fake-Speicherung suggerieren.

**2. Umsetzung**
Kleiner Produkt-Slice, kein Backend/keine Speicherung/keine Automatik:
- Neuer DOM-freier Helper `apps/web/src/lib/pilotObservationGuide.ts`: `PILOT_OBSERVATIONS`/`pilotObservationGuide()` mit 5 Kategorien — fehlendes Wissen → `/risiko`, unfertig/ungeprüft → `/validierung`, veraltet → `/lebenszyklus`, unklare Quelle/Trust/Nutzbarkeit → `/bibliothek` (Einstieg, **keine** Fake-KO-ID), reine UX-/Pilotnotiz → `to: null` (bewusst kein Produktlink). Verweist ausschließlich auf vorhandene Routen.
- `apps/web/src/pages/Help.tsx`: kompakte „Pilot-Befund einordnen"-Karte direkt unter der Pilot-Checkliste (nicht durchsuchbar, nicht überladen). Jede Zeile: beobachtete Reibung + „Gehört in" + Flow-Link; die UX-Notiz zeigt bewusst **keinen** Link.
- `apps/web/src/i18n.ts`: `pilot.obs.title/subtitle/mapLabel/openFlow` + je Kategorie `.label`/`.map` DE + EN. Untertitel + UX-Notiz machen ehrlich klar: „Nichts wird gespeichert" / „nicht im Produkt gespeichert, kein Workflow".

**3. Geänderte Dateien**
- `apps/web/src/lib/pilotObservationGuide.ts` (NEU, DOM-freie Befund→Flow-Zuordnung)
- `apps/web/src/pages/Help.tsx` (Einordnungs-Karte + Import)
- `apps/web/src/i18n.ts` (`pilot.obs.*` DE/EN)
- `tests/app/pilot-observation-guide.test.ts` (NEU: Kategorien/Reihenfolge, korrekte Routen, /bibliothek statt Fake-KO-ID, UX-Notiz ohne Link + „nicht gespeichert"-Text, alle i18n-Keys DE/EN auflösbar)

**4. Tests/Gates**
`npm run check` grün — **136 Dateien / 795 Tests** (+5). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Pilot-Befunde werden jetzt sichtbar und verständlich auf die bestehenden Flows gemappt; alle Links führen auf vorhandene Routen; die reine UX-/Pilotnotiz hat bewusst keinen Link und keine (Fake-)Speicherung — es wird nicht behauptet, dass UX-Feedback im Produkt verarbeitet wird. Normale Help-Nutzung unverändert (zusätzliche, nicht durchsuchbare Karte). Kein Backend, keine Feedback-DB, kein Tracking/Analytics, keine Jira-/Task-Automatik, keine neue Task-Engine/Suche/RAG, keine Architekturänderung, keine Team-2/3-Arbeit, kein Deployment.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/pilotObservationGuide.ts apps/web/src/pages/Help.tsx apps/web/src/i18n.ts tests/app/pilot-observation-guide.test.ts docs/qm/claude-after-report.md
git commit -m "feat(help): map pilot observations to existing Knowledge-OS flows; pilotObservationGuide helper (SCRUM-307)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-308 — Demo-/Pilotdaten als Beispielwissen sichtbar kennzeichnen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
Der Demo-Seed (`services/app/src/seed-demo.ts`) erzeugt 5 KOs jeweils über `ko.create({…, tags: [...] })`; `KnowledgeObject.tags: string[]` existiert bereits. Demo-KOs erscheinen sichtbar in Library (Trefferzeile), KO-Detail (Overview), Ask-Quellen. Es gab **keine** Kennzeichnung als Beispielwissen — Pilotnutzer könnten validiertes Demo-Wissen mit produktivem verwechseln. Kleinste, schemafreie Erkennung: ein eindeutiger Herkunfts-Tag im vorhandenen `tags`-Feld (keine Migration, kein neues Datenmodell). Produktiv erfasste KOs tragen diesen Tag nicht.

**2. Umsetzung**
- **Seed (Marker):** `seed-demo.ts` setzt `DEMO_TAG = "pilot-demo"` auf alle 5 Demo-KOs (`tags: [..., DEMO_TAG]`). Keine Schemaänderung, kein neues Feld.
- **DOM-freier Helper:** `apps/web/src/lib/demoKnowledge.ts` — `DEMO_TAG`, `isDemoKnowledge(ko)` (= `tags` enthält `DEMO_TAG`), `demoKnowledgeBadge(ko)` → `{labelKey, hintKey, tone:"neutral"}` nur für Demo-KOs, sonst `null`. Bewusst neutrale Tönung: Herkunft, kein Qualitäts-/Status-/Trust-Signal.
- **Badge sichtbar:** Library-Trefferzeile (neben Status/Reife), KO-Detail-Overview (in der Status-/Trust-Zeile) und Ask-Quellen. Für Ask wurde `askView.SourceRef` um `demo: boolean` erweitert (dieselbe Erkennung über `isDemoKnowledge`) — sauber und klein, ohne Umbau; Ask zeigt je Quelle einen neutralen „Demo-Beispiel"-Marker.
- **i18n:** `demo.badge.label` („Demo-Beispiel"/„Example data") + `demo.badge.hint` DE/EN. Hint ist ehrlich: „Nur Herkunft — ersetzt nicht Status, Trust, Quelle oder Validierung. Validiert bleibt validiert, offen bleibt offen."

**3. Geänderte Dateien**
- `services/app/src/seed-demo.ts` (DEMO_TAG auf alle Seed-KOs)
- `apps/web/src/lib/demoKnowledge.ts` (NEU, DOM-freier Helper)
- `apps/web/src/lib/askView.ts` (`SourceRef.demo` + Ableitung)
- `apps/web/src/pages/Library.tsx`, `KnowledgeDetail.tsx`, `Ask.tsx` (Demo-Badge/-Marker)
- `apps/web/src/i18n.ts` (`demo.badge.*` DE/EN)
- `tests/app/demo-knowledge.test.ts` (NEU), `tests/ask/ask-view.test.ts` (um `demo` erweitert), `services/app/src/seed.test.ts` (alle Seed-KOs tragen den Demo-Tag)

**4. Tests/Gates**
`npm run check` grün — **137 Dateien / 800 Tests** (+5). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. Abgesichert: Demo-KO wird erkannt, normales/leeres/undefined-tags-KO NICHT; Badge-/Label-/Hint-Keys korrekt; Cross-Surface-Konsistenz (Library/KO-Detail/Ask nutzen denselben Helper, `sourceRefs.demo` == `isDemoKnowledge`); Seed enthält die Demo-Markierung.

**5. Restlücken/Nicht-Ziele**
Demo-/Seed-Wissen ist jetzt in Library, KO-Detail und Ask-Quellen sichtbar und ehrlich als Beispielwissen markiert; das Badge ersetzt **nicht** Status/Trust/Quelle/Nutzbarkeit/Validierung (neutral, nur Herkunft). Produktiv neu erfasste KOs werden nie fälschlich als Demo markiert (Tag nur im Seed gesetzt). Kein neues Datenmodell, keine Migration, keine Mandanten-/Produktionsdaten-Trennung, keine Lösch-/Reset-Funktion, kein Backend-Tracking, keine neue Suche/RAG, keine Architekturänderung, keine Team-2/3-Arbeit, kein Deployment. Hinweis: Ein Nutzer könnte theoretisch `pilot-demo` manuell als Tag vergeben — bewusst akzeptierter Randfall (kein Schutzmechanismus gefordert); der Tag ist absichtlich unüblich gewählt.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add services/app/src/seed-demo.ts services/app/src/seed.test.ts apps/web/src/lib/demoKnowledge.ts apps/web/src/lib/askView.ts apps/web/src/pages/Library.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/pages/Ask.tsx apps/web/src/i18n.ts tests/app/demo-knowledge.test.ts tests/ask/ask-view.test.ts docs/qm/claude-after-report.md
git commit -m "feat(demo): mark demo/seed knowledge as example data via tag; demoKnowledge helper + badges (SCRUM-308)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-309 — Demo-Beispielwissen in der Library gezielt finden und von eigenem Wissen trennen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
SCRUM-308 markiert Demo-/Seed-Wissen über `isDemoKnowledge`/`DEMO_TAG` (`pilot-demo`). Die Library-Filterkette ist: `ranked = searchLibrary(items, q)` → `maturityCounts = countByMaturity(ranked)` → `filtered = filterByMaturity(ranked, maturity)` → `win = windowList(filtered)`. Es gab **keinen Herkunftsfilter**, um Demo-Beispiele gezielt zu finden bzw. von eigenem Wissen zu trennen. Einhakpunkt: ergänzend **vor** dem Reife-Filter, damit beide Filter sauber komponieren; Counts ehrlich.

**2. Umsetzung**
Kleiner, client-seitiger Slice (keine Suche/Backend/Schemaänderung):
- **DOM-freie Helfer (`demoKnowledge.ts`):** `DemoKnowledgeFilter = "all"|"demo"|"non-demo"`, `DEMO_KNOWLEDGE_FILTERS`, `filterByDemoKnowledge(items, filter)`, `countByDemoKnowledge(items)`, `demoKnowledgeFilterLabelKey(filter)`. Alle nutzen **dieselbe** Erkennung `isDemoKnowledge` (keine zweite Logik).
- **Library-Pipeline:** `ranked` → `demoCounts = countByDemoKnowledge(ranked)` (Zähler über die volle Liste) → `byDemo = filterByDemoKnowledge(ranked, demoFilter)` → `maturityCounts = countByMaturity(byDemo)` → `filterByMaturity(byDemo, maturity)` → `windowList`. So sind beide Filter ergänzend: Herkunft ist der breitere Schnitt, Reife verfeinert darin; die Reife-Counts spiegeln die nach Herkunft gefilterte Menge (ehrlich zur sichtbaren Liste). Diese Reihenfolge entspricht exakt dem im Ticket vorgeschlagenen Ablauf.
- **UI:** zweite Chip-Reihe „Herkunft: Alle Herkünfte / Demo-Beispiele / Eigenes Wissen" mit ehrlichen Zählern, über der bestehenden Reife-Chip-Reihe. Label als Herkunft (keine Qualitätsaussage). Demo-Badges aus SCRUM-308 bleiben sichtbar.
- **i18n:** `lib.originLabel`, `lib.demoFilter.all/demo/nonDemo` DE/EN.

**3. Geänderte Dateien**
- `apps/web/src/lib/demoKnowledge.ts` (Filter-/Count-/Label-Helfer)
- `apps/web/src/pages/Library.tsx` (demoFilter-State + Pipeline + Herkunfts-Chips)
- `apps/web/src/i18n.ts` (`lib.originLabel` + `lib.demoFilter.*` DE/EN)
- `tests/app/demo-knowledge.test.ts` (+5 Tests: all unverändert/neue Liste, demo nur Demo, non-demo nur ohne Tag, Counts demo+non-demo=all, Label-Keys + DE/EN)

**4. Tests/Gates**
`npm run check` grün — **137 Dateien / 805 Tests** (+5). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Die Library kann sichtbare Treffer client-seitig nach Herkunft filtern (alle / Demo-Beispiele / eigenes Wissen). Produktiv erfasste KOs ohne Demo-Tag erscheinen im „Eigenes Wissen"-Filter. Der Herkunftsfilter ist **ergänzend** und ersetzt nicht Status/Trust/Nutzbarkeit/Reife-Filter/Suche; er nutzt dieselbe Erkennung wie das Demo-Badge. Kein neues Datenmodell, keine Migration/Schemaänderung, keine Server-/Backend-Filterung, keine Mandanten-Trennung, keine Lösch-/Reset-Funktion, kein Tracking/Analytics, keine neue Suche/RAG, keine Architekturänderung, keine Team-2/3-Arbeit, kein Deployment. Help/Admin bewusst nicht angefasst (kein Hinweis nötig).

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoKnowledge.ts apps/web/src/pages/Library.tsx apps/web/src/i18n.ts tests/app/demo-knowledge.test.ts docs/qm/claude-after-report.md
git commit -m "feat(library): client-side origin filter (demo / own knowledge) reusing isDemoKnowledge (SCRUM-309)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-310 — Nach Capture eigenes Wissen in Library finden und zur Validierung führen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
`captureNextSteps(koId)` lieferte zwei Schritte: KO ansehen (`/wissen/:id`) und Validierung (`/validierung`, `primary`). Die Capture-Success-Card rendert sie generisch (`demoHref(s.to, params)`, `s.primary`-Styling). Der Herkunftsfilter aus SCRUM-309 (`DemoKnowledgeFilter` + `isDemoKnowledge`) ist client-seitig; Library hält `params` (`useSearchParams`) und `demoFilter`-State. Es gab **keinen** Weg, frisch erfasstes eigenes Wissen direkt gefiltert in der Library wiederzufinden, und Library las den Herkunftsfilter **nicht** aus der URL. Query-Muster wie `askQuestion.ts` (`readAskQuestion`) als Vorlage vorhanden.

**2. Umsetzung**
Kleiner, client-seitiger Slice (kein Backend/keine Server-Filterung/keine Schemaänderung):
- **Query-Helfer (`demoKnowledge.ts`):** `DEMO_FILTER_PARAM = "origin"`, `readDemoKnowledgeFilter(params)` (fehlend/ungültig → `all`, nur gültige `DemoKnowledgeFilter`-Werte), `libraryOriginHref(filter)` (`all` → `/bibliothek`, sonst `/bibliothek?origin=<filter>`). Nutzt denselben `DemoKnowledgeFilter` wie der Chip-Filter — keine zweite Logik.
- **Library:** initialisiert `demoFilter` **lazy** aus dem Query-Param (`useState(() => readDemoKnowledgeFilter(params))`). Ohne Query bleibt es `all`; die Chips überschreiben den State weiter frei. Keine serverseitige Filterung.
- **Capture-Success (`captureSuccess.ts`):** dritter, **nicht-primärer** Next Step „In der Bibliothek ansehen (eigenes Wissen)" → `libraryOriginHref("non-demo")` (`/bibliothek?origin=non-demo`). Bestehende Schritte KO-Detail und Validierung bleiben; **Validierung bleibt `primary`** (betont, als letzter Schritt). Der Library-Link ist Auffinden/Übersicht, **keine** Validierung, **keine** Autor-/User-Zuordnung.
- **i18n:** `capture.savedViewLibrary` DE/EN. Copy ehrlich: „eigenes Wissen" = technisch ohne Demo-Tag, keine User-Zuordnung; kein Demo-Wissen wird als eigenes umgedeutet.

**3. Geänderte Dateien**
- `apps/web/src/lib/demoKnowledge.ts` (`DEMO_FILTER_PARAM`, `readDemoKnowledgeFilter`, `libraryOriginHref`)
- `apps/web/src/lib/captureSuccess.ts` (Library-Next-Step)
- `apps/web/src/pages/Library.tsx` (lazy demoFilter-Init aus Query)
- `apps/web/src/i18n.ts` (`capture.savedViewLibrary` DE/EN)
- `tests/capture/capture-success.test.ts` (+3: Reihenfolge inkl. Library, nicht-primärer Library-Schritt, Label DE/EN)
- `tests/app/demo-knowledge.test.ts` (+4: read missing/invalid→all, valid→Filter, href-Aufbau, Round-Trip)

**4. Tests/Gates**
`npm run check` grün — **137 Dateien / 811 Tests** (+6). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Library initialisiert den Herkunftsfilter aus `?origin=…` (mind. `non-demo`); ungültig/fehlend → neutral `all`. Capture-Success bietet einen ehrlichen Library-Einstieg (eigenes/nicht-Demo); KO-Detail + Validierung bleiben, Review bleibt betont primär. Der Origin-Filter nutzt weiterhin `isDemoKnowledge`/`DemoKnowledgeFilter` (keine zweite Logik). Kein Backend, keine Server-Filterung, keine neue Suche, kein neues Datenmodell/Migration/Schemaänderung, keine automatische Validierung, **keine** User-/Author-„mein Wissen"-Zuordnung (rein „ohne Demo-Tag"), keine Mandanten-Trennung, kein Tracking/RAG, keine Architekturänderung, keine Team-2/3-Arbeit, kein Deployment.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoKnowledge.ts apps/web/src/lib/captureSuccess.ts apps/web/src/pages/Library.tsx apps/web/src/i18n.ts tests/capture/capture-success.test.ts tests/app/demo-knowledge.test.ts docs/qm/claude-after-report.md
git commit -m "feat(capture/library): find own/non-demo knowledge after capture via ?origin= deep link (SCRUM-310)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-311 — Nach Capture eigenes Wissen im Validation-Board finden und prüfen
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**1. Vorab-Befund**
`captureNextSteps` (nach SCRUM-310): KO-Detail, Library `non-demo` (nicht-primär), Validierung `/validierung` (`primary`). `Validation.tsx` liest bereits `useSearchParams` (`params`), rendert das Board aus `useValidationBoard` (volle KOs **mit** `tags`) und filtert an EINER Stelle: `sortByReviewPriority(items.filter(matchesValidationFilter(...)))`. `isDemoKnowledge` ist direkt auf den Board-KOs nutzbar; `filterByDemoKnowledge` erwartet jedoch `{ko}`-Form. Es fehlte ein Herkunftsfilter im Board und das Lesen von `?origin=`.

**2. Umsetzung**
Kleiner Slice, **eine** geteilte Logik (kein Backend/keine Server-Filterung):
- **`demoKnowledge.ts`:** neues geteiltes Prädikat `matchesDemoKnowledgeFilter(ko, filter)` — von Library (`filterByDemoKnowledge` nutzt es jetzt) UND Validation-Board (rohe KOs) verwendet, keine zweite Logik. Privater `originHref(route, filter)`; `libraryOriginHref` darauf umgestellt; neu `validationOriginHref(filter)` (`all` → `/validierung`, sonst `/validierung?origin=<filter>`).
- **`Validation.tsx`:** `demoFilter` lazy aus `?origin=…` (`readDemoKnowledgeFilter`, fehlend/ungültig → `all`); Herkunfts-Zähler über die review-gefilterte Menge; `visible = boardFiltered.filter(matchesDemoKnowledgeFilter(k, demoFilter))`; Chip-Reihe „Herkunft: Alle Herkünfte / Demo-Beispiele / Eigenes Wissen" (Labels konsistent mit Library, `lib.originLabel`/`lib.demoFilter.*` wiederverwendet). Nur Ansicht — Review-Entscheidungen, Feedbackpflicht und Success-Card unverändert.
- **`captureSuccess.ts`:** primärer Review-Step zeigt jetzt auf `validationOriginHref("non-demo")` = `/validierung?origin=non-demo` (direkt ins vorgefilterte Board, keine Vermischung mit Demo). Bleibt `primary`; Library-Link (SCRUM-310) bleibt nicht-primäres Auffinden.

**3. Geänderte Dateien**
- `apps/web/src/lib/demoKnowledge.ts` (`matchesDemoKnowledgeFilter`, `originHref`, `validationOriginHref`, `filterByDemoKnowledge` nutzt Prädikat)
- `apps/web/src/lib/captureSuccess.ts` (Review-Step → `validationOriginHref("non-demo")`)
- `apps/web/src/pages/Validation.tsx` (demoFilter aus Query + Chips + Counts via Prädikat)
- `tests/capture/capture-success.test.ts` (Review-Href + „nur ein primärer Schritt")
- `tests/app/demo-knowledge.test.ts` (+3: `validationOriginHref`, Round-Trip beider Hrefs, `matchesDemoKnowledgeFilter`-Konsistenz)
Keine neuen i18n-Keys (Labels aus Library wiederverwendet).

**4. Tests/Gates**
`npm run check` grün — **137 Dateien / 815 Tests** (+4). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**5. Restlücken/Nicht-Ziele**
Validation-Board filtert sichtbare Review-KOs client-seitig nach Herkunft (alle/Demo/eigenes); initialisiert aus `?origin=non-demo` (ungültig/fehlend → `all`); Chips überschreiben weiter. Capture-Success führt den **primären** Review-Step vorgefiltert auf eigenes/nicht-Demo. Herkunftsfilter nutzt dieselbe Erkennung wie Demo-Badge/Library (`isDemoKnowledge`/`matchesDemoKnowledgeFilter`). Der Filter ist nur Ansicht — ersetzt **nicht** Status, Trust, Review-Entscheidung oder Validierung; „eigenes Wissen" = technisch ohne Demo-Tag, **keine** User-/Author-Zuordnung. Kein Backend/Server-Filterung/neue Suche/Datenmodell/Migration/Auto-Validierung/Mandanten-Trennung/Tracking/RAG/Architekturänderung/Team-2-3/Deployment.

**6. Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt)**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoKnowledge.ts apps/web/src/lib/captureSuccess.ts apps/web/src/pages/Validation.tsx tests/capture/capture-success.test.ts tests/app/demo-knowledge.test.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): client-side origin filter + capture review step to own/non-demo board (SCRUM-311)"
git push
```
Kein Git/Push/Jira durch Claude. Codex prüft Diff/Gates, korrigiert minimal falls nötig, committet, pusht, wartet GitHub CI ab und schließt Jira. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` bleibt unangetastet.

---

## SCRUM-312 — Beta AI-assisted Knowledge Editing / Nachbearbeitung v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** Capture (`apps/web/src/pages/Capture.tsx`) hatte KI-Hilfe nur als kleine, **still mutierende** Links: `assistRaw` → `setRaw(r.text)`, `assistStatement` → `setDraft(statement)`; `structure` erzeugt den Draft. `reasoner.assist(text, locale)` nahm **keine** Instruktion; der deterministische Provider (`assistText`) glättet generisch, der Modell-Provider nutzt `assistSystem`. `RichTextEditor` kann bereits H2/H3, Bold/Italic, Listen, Link, Panel, Bild, Vorschau. — **Legacy-Pfad geprüft (read-only):** `/Users/peterkohnert/Documents/Klarwerk/app/src/components/WikiEditor.jsx`, `AiAssist.jsx`, `CaseEditor.jsx`, `pages/Knowledge.jsx`, `store/KnowledgeContext.jsx` lokal verfügbar; nur Funktionsmuster geprüft, nichts blind kopiert.

**Wichtigste alte Funktionen (Legacy, lt. Ticket):** geführte Aktionen (Klarer/Strukturieren/Erweitern/Rechtschreibung), freies KI-Anweisungsfeld + Fragen/Ausführen, Vorschau + Übernehmen/Einfügen/Verwerfen. **Aktuelle Gaps (vorher):** keine sichtbare KI-Box, keine geführten Aktionen, keine freie Anweisung, keine Vorschau (stille Direkt-Mutation), Reasoner-Entwurf schlecht nachbearbeitbar.

**Umsetzter Umfang (v0).**
1. **Sichtbare KI-Nachbearbeitungsbox** (`AiAssistBox` in Capture.tsx) im Freitext/Diktat-Bereich **und** am Reasoner-Draft-Statement: eigener Bereich mit Titel + ehrlichem Hinweis („KI macht einen Vorschlag — du übernimmst bewusst; keine Auto-Speicherung/Validierung; keine erfundenen Fakten").
2. **Geführte KI-Aktionen** (DOM-freier Helper `apps/web/src/lib/captureAiAssist.ts`): Klarer/Strukturieren/Erweitern/Rechtschreibung + freies Anweisungsfeld + „Ausführen". Nutzt den vorhandenen `reasoner.assist`-Endpunkt, erweitert um eine **optionale `instruction`** (kleinster sauberer Weg, Variante b): `endpoints.assist` → `/api/reasoner` → `reasoner.assistText(text, locale, instruction)` → Provider-Interface. Modell-Provider hängt die Anweisung als Leitplanke an `assistSystem` (Schutz „keine Inhalte/Fakten erfinden" bleibt); deterministischer Fallback ignoriert sie bewusst (generische Glättung). Keine neue Provider-Architektur.
3. **Ergebnis-Vorschau + bewusste Übernahme:** KI-Ergebnis schreibt **nicht** mehr still in raw/draft.statement, sondern erscheint als Vorschau mit **Ersetzen / Anhängen / Verwerfen** (`applyAssist`). Save-/Submit-/Draft-Logik unverändert.

**Bewusst nicht umgesetzte Gaps (später).**
- RichTextEditor Panel-Differenzierung (Info/Hinweis/Warnung/Erfolg) — größer als risikoarm, daher v0 ausgelassen (Editor unverändert funktionsfähig).
- „In ausführlichen Inhalt einfügen" (bodyHtml) aus der KI-Box — bewusst später (Plaintext→HTML-Übernahme braucht eigene, risikoarme Lösung).
- Echte aktionsspezifische Differenzierung im **deterministischen** Modus — nicht möglich ohne Modell; im Modellmodus aktiv. Ehrlich dokumentiert.

**Geänderte Dateien.**
- FE: `apps/web/src/lib/captureAiAssist.ts` (NEU), `apps/web/src/pages/Capture.tsx` (AiAssistBox + Vorschau, stille Mutationen entfernt), `apps/web/src/api/endpoints.ts` (assist optional instruction), `apps/web/src/i18n.ts` (`capture.ai.*` DE/EN).
- Backend (alle Team-1): `services/app/src/routes/reasoner-routes.ts` (Body `instruction?`), `services/reasoner/src/service.ts`, `services/reasoner/src/provider.ts` (Interface), `services/reasoner/src/provider-model.ts` (assistGuidance).
- Tests: `tests/capture/capture-ai-assist.test.ts` (NEU), `services/reasoner/src/service.test.ts` (instruction-Durchreichung).

**Tests/Gates.** `npm run check` grün — **138 Dateien / 821 Tests**. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. Gezielt: `service.test` + `capture-ai-assist` + `ask-routes` grün.

**Restlücken/Nicht-Ziele.** Kein RAG, keine neue Suche, keine Local-LLM-Abhängigkeit, keine Architekturänderung, keine neue Provider-Architektur; kein Auto-Submit/keine Auto-Validierung; keine Team-2/3/4-Dateien. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk` gearbeitet. Untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` unberührt.

**Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/captureAiAssist.ts apps/web/src/pages/Capture.tsx apps/web/src/api/endpoints.ts apps/web/src/i18n.ts services/app/src/routes/reasoner-routes.ts services/reasoner/src/service.ts services/reasoner/src/provider.ts services/reasoner/src/provider-model.ts tests/capture/capture-ai-assist.test.ts services/reasoner/src/service.test.ts docs/qm/claude-after-report.md
git commit -m "feat(capture): beta AI post-editing — guided actions + free instruction + preview/apply; optional assist instruction (SCRUM-312)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-319 — Beta Editor Body-Strukturvorlagen v0
**Datum:** 2026-06-29 · **Rolle:** Codex (Umsetzung/Prüfung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` zeigte eine saubere Basis bis auf das bekannte untracked Infra-Doc. Nach SCRUM-314/315/316/317 existieren Body-Blöcke, Body-KI und Orientierung am ausführlichen Inhalt, aber Beta-Nutzer starten im `bodyHtml`-Feld weiterhin mit leerem Editor. `RichTextEditor` ist value-getrieben (`bodyHtml`/`setBodyHtml` in Capture, `edit.bodyHtml`/`setEdit` in KO-Detail), Sanitizer/Block-Allowlist sind vorhanden. Lücke: kein schneller, risikoarmer Startpunkt für typische Knowledge-Editor-Strukturen.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/bodyTemplates.ts` (NEU): drei stabile Vorlagen `procedure`, `troubleshooting`, `safety`; i18n-Key-Schema `editor.template.<id>.*`; DE/EN-HTML mit H2/H3, Listen und vorhandenen statischen Panel-Klassen; `bodyTemplateHtml()` normalisiert + sanitisiert; `applyBodyTemplate()` ersetzt bei leerem Body und hängt bei vorhandenem Body an.
2. **UI-Komponente** `apps/web/src/components/BodyTemplateChooser.tsx` (NEU): kompakte Karte „Strukturvorlage starten" mit drei expliziten Buttons; keine Auto-Befüllung, kein Speichern, keine Validierung.
3. **Einbindung** in `Capture.tsx` und `KnowledgeDetail.tsx` direkt am Body-Feld nach `EditorGuidance` und vor dem `RichTextEditor`; bestehende Body-KI/Block-Funktionen bleiben unverändert.
4. **i18n** `editor.template.*` DE+EN (Titel, Hinweis, Label/Beschreibung je Vorlage).
5. **Tests** `tests/app/body-templates.test.ts` (NEU, DOM-frei): stabile IDs/Reihenfolge + i18n-Keys, Locale-Normalisierung, sichere HTML-Ausgabe/erlaubte Klassen, EN-Vorlage, Replace-vs-Append-Verhalten.

**Bewusst nicht umgesetzte Gaps (später).** Kein Cursor-/Inline-Insert, kein Template-Editor, keine Persistenz eigener Vorlagen, keine blockweise Formularlogik, kein automatisches Ausfüllen aus KI/Reasoner, keine Änderung am RichTextEditor/Sanitizer über die vorhandene Nutzung hinaus.

**Geänderte Dateien.**
- `apps/web/src/lib/bodyTemplates.ts` (NEU)
- `apps/web/src/components/BodyTemplateChooser.tsx` (NEU)
- `apps/web/src/pages/Capture.tsx` (Template-Chooser am Body-Feld)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Template-Chooser am Body-Feld im Edit-Modus)
- `apps/web/src/i18n.ts` (`editor.template.*` DE+EN)
- `tests/app/body-templates.test.ts` (NEU)

**Tests/Gates.** Gezielte Tests: `npx vitest run tests/app/body-templates.test.ts tests/app/editor-guidance.test.ts tests/app/editor-blocks.test.ts tests/structure/rich-text.test.ts` → 21/21 grün. `npm run check` grün — **143 Dateien / 854 Tests**. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SCRUM-314/315/316/317-Flows bleiben intakt.

**Nicht-Ziele eingehalten.** Kein neuer Editor, keine neue Toolbar-Logik, kein RAG/neue Suche/Local-LLM, keine Auto-Validierung, kein Auto-Speichern, keine Backend-/Datenmodelländerung, keine Team-2/3/4-Dateien, keine Migration/Deployment. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis.**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/bodyTemplates.ts apps/web/src/components/BodyTemplateChooser.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/body-templates.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): add body structure templates in Capture and KO detail (SCRUM-319)"
git push
```
Codex übernimmt Commit, Push, GitHub-CI-Prüfung und Jira-Abschluss.

---

## SCRUM-322 — Beta Editor Link-Einfügen v0
**Datum:** 2026-06-29 · **Rolle:** Codex (Umsetzung/Prüfung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** Der `RichTextEditor` hatte einen Link-Button, nutzte aber `window.prompt(t("editor.linkPrompt"))` + `document.execCommand("createLink", url)`. Das wirkt nicht beta-reif, verlangt meist markierten Text und gibt wenig Kontrolle über Linktext/Sicherheitsfeedback. Capture und KO-Detail teilen denselben Editor, also ist ein kleiner Editor-Slice ausreichend.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/editorLinks.ts` (NEU): `normalizeEditorLinkUrl()` erlaubt `https`, `http`, `mailto`, interne Routen `/…` und Anker `#…`; Bare Domains werden zu `https://…`; unsichere Protokolle/Whitespace-URLs werden verworfen. `editorLinkHtml()` erzeugt escaped Link-HTML oder `null`.
2. **RichTextEditor-Linkpanel**: Browser-Prompt ersetzt durch Inline-Panel mit URL + optionalem Linktext. Ohne Linktext wird die normalisierte URL als Text genutzt. Markierte Selection wird als Vorschlag für Linktext übernommen, wenn vorhanden.
3. **Fehler-/Abbruchfluss**: ungültige URL zeigt inline `editor.linkInvalid`; Abbrechen schließt das Panel ohne Änderung.
4. **Sanitizer bleibt maßgeblich**: eingefügtes HTML läuft weiter über `emit()`/`sanitizeHtml`; Links bekommen wie bisher in der Anzeige/Preview sichere Attribute.
5. **i18n** `editor.linkUrl/linkUrlPlaceholder/linkLabel/linkLabelPlaceholder/linkInsert/linkCancel/linkInvalid` DE+EN.
6. **Tests** `tests/app/editor-links.test.ts` (NEU, DOM-frei): Bare-Domain-Normalisierung, erlaubte URL-Arten, unsichere Protokolle, escaping + Sanitizer-Kompatibilität, i18n-Keys.

**Bewusst nicht umgesetzte Gaps (später).** Kein vollständiger Link-Editor für bestehende Links, kein komplexer Selection-/Cursor-Komfort, kein Datei-Link-Embed, kein neuer Datei-Viewer. V0 ist bewusst „sicher einfügen", nicht „Links verwalten".

**Geänderte Dateien.**
- `apps/web/src/lib/editorLinks.ts` (NEU)
- `apps/web/src/components/RichTextEditor.tsx` (Inline-Linkpanel statt Browser-Prompt)
- `apps/web/src/i18n.ts` (`editor.link*` DE+EN)
- `tests/app/editor-links.test.ts` (NEU)

**Tests/Gates.** Gezielte Tests: `npx vitest run tests/app/editor-links.test.ts tests/structure/rich-text.test.ts` → 13/13 grün. `npm run check` grün — **146 Dateien / 866 Tests**. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**Nicht-Ziele eingehalten.** Keine neue Editor-Library, keine Backend-/Datenmodelländerung, kein Datei-Embed/Viewer, kein RAG/neue Suche/Local-LLM, keine Auto-Validierung, kein Auto-Speichern, keine Team-2/3/4-Dateien, keine Migration/Deployment. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis.**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorLinks.ts apps/web/src/components/RichTextEditor.tsx apps/web/src/i18n.ts tests/app/editor-links.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): inline safe link insert panel in RichTextEditor (SCRUM-322)"
git push
```
Codex übernimmt Commit, Push, GitHub-CI-Prüfung und Jira-Abschluss.

---

## SCRUM-321 — Beta Editor Bild-Anhänge im Capture nutzbar machen v0
**Datum:** 2026-06-29 · **Rolle:** Codex (Umsetzung/Prüfung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** Der `RichTextEditor` hatte bereits einen Bild-Button und KO-Detail übergab Object-Store-Bildanhänge (`objectId`) an `images`. Capture hatte lokale Bildanhänge (`LocalImage` mit `dataUrl`/`original`) und lud sie beim Speichern in den Object-Store, übergab sie aber nicht an den Body-Editor. Dadurch war die Legacy-nahe Funktion „Bild aus Anhang in den Inhalt einfügen" ausgerechnet beim Erfassen noch nicht nutzbar.

**Umsetzung (v0).**
1. **Editor-Bildquellen erweitert**: `RichTextEditor.EditorImage` unterstützt jetzt `objectId` (KO-Detail, unverändert) oder `src` (Capture-lokale sichere Data-URL). `addImage()` wählt sicher zwischen `insertImageHtml()` und neuem `insertImageSrcHtml()`.
2. **RichText-Helfer** `insertImageSrcHtml(src, alt)` in `richText.ts`: baut sicheres `<img>`-Markup für bereits erlaubte Bildquellen; Sanitizer bleibt autoritativ und erlaubt weiterhin nur Object-Store-Raw oder sichere Raster-`data:image`-URLs (kein SVG).
3. **DOM-freier Capture-Mapping-Helfer** `apps/web/src/lib/editorImages.ts` (NEU): `editorImagesFromLocalImages()` bietet nur echte Bild-MIMEs mit sicheren Raster-Data-URLs an; Dokumente/SVG/unsichere Daten werden nicht als Inline-Bild angeboten.
4. **Capture-Integration**: `RichTextEditor` im Capture-Body bekommt `images={editorImagesFromLocalImages(images)}`. Der vorhandene Bild-Button zeigt damit lokale Bildanhänge vor dem Speichern an; Datei-Anhänge bleiben normale Anhänge/Evidence.
5. **Tests** `tests/app/editor-images.test.ts` (NEU) + `tests/structure/rich-text.test.ts` erweitert.

**Bewusst nicht umgesetzte Gaps (später).** Kein neuer Upload-/Object-Store-Flow, kein Inline-Datei-Embed, kein Datei-Viewer, kein Drag&Drop-Umbau, keine Body-HTML-Nachmigration auf Object-Store-URLs. v0 nutzt bewusst die bereits erlaubten sicheren Raster-Data-URLs im Capture-Editor; KO-Detail bleibt Object-Store-basiert.

**Geänderte Dateien.**
- `apps/web/src/lib/editorImages.ts` (NEU)
- `apps/web/src/components/RichTextEditor.tsx` (Object-Store- oder lokale Bildquelle)
- `apps/web/src/lib/richText.ts` (`insertImageSrcHtml`)
- `apps/web/src/pages/Capture.tsx` (lokale Bildanhänge an Editor übergeben)
- `tests/app/editor-images.test.ts` (NEU)
- `tests/structure/rich-text.test.ts` (Bildquellen-Test)

**Tests/Gates.** Gezielte Tests: `npx vitest run tests/app/editor-images.test.ts tests/structure/rich-text.test.ts tests/capture/attachment-preview.test.ts` → 13/13 grün. `npm run check` grün — **145 Dateien / 861 Tests**. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**Nicht-Ziele eingehalten.** Keine Upload-/Backend-/Datenmodelländerung, kein neuer Datei-Viewer, kein Inline-Datei-Embed, kein Drag&Drop-Umbau, kein RAG/neue Suche/Local-LLM, keine Auto-Validierung, kein Auto-Speichern, keine Team-2/3/4-Dateien, keine Migration/Deployment. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis.**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorImages.ts apps/web/src/components/RichTextEditor.tsx apps/web/src/lib/richText.ts apps/web/src/pages/Capture.tsx tests/app/editor-images.test.ts tests/structure/rich-text.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): offer local Capture image attachments in RichTextEditor (SCRUM-321)"
git push
```
Codex übernimmt Commit, Push, GitHub-CI-Prüfung und Jira-Abschluss.

---

## SCRUM-320 — Beta Editor Übernahme-Sicherheit v0
**Datum:** 2026-06-29 · **Rolle:** Codex (Umsetzung/Prüfung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** Nach SCRUM-312/313/315/316 zeigt `AiAssistBox` Vorschläge mit „Ersetzen" und „Anhängen"; das ist bewusst, aber bei vorhandenem Inhalt fehlte ein sichtbarer Warn-/Kontext-Hinweis, dass „Ersetzen" den aktuellen Inhalt überschreibt. Nach SCRUM-319 setzen Strukturvorlagen leeren Body und hängen bei bestehendem Body an; diese Regel war im Code korrekt, aber in der UI nur generisch beschrieben.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/editorApplySafety.ts` (NEU): `hasEditableContent`, `shouldWarnBeforeReplace`, `templateApplyMode`, `templateApplyModeHintKey`. Keine DOM-/Editor-Abhängigkeit; nutzt nur `isEmptyHtml` für Body-Template-Setzen vs. Anhängen.
2. **KI-Vorschau-Sicherheit** in `AiAssistBox`: Bei vorhandenem Quelltext erscheint in der Vorschau ein kleiner Warnhinweis: „Ersetzen überschreibt den aktuellen Inhalt; Anhängen lässt den Bestand stehen." Buttons/Übernahme-Logik unverändert.
3. **Vorlagen-Kontext** in `BodyTemplateChooser`: zeigt dynamisch „Leerer Inhalt: Vorlage wird eingesetzt" oder „Bestehender Inhalt: Vorlage wird angehängt, nichts wird ersetzt." Die bestehende sichere Apply-Regel bleibt unverändert.
4. **i18n** `editor.applySafety.replaceWarning` und `editor.template.mode.set/append` DE+EN.
5. **Tests** `tests/app/editor-apply-safety.test.ts` (NEU, DOM-frei): Content-Erkennung, Replace-Warnung, Template-Modus set/append, stabile i18n-Keys.

**Bewusst nicht umgesetzte Gaps (später).** Kein Diff/Merge-Editor, kein Undo-System, keine zusätzliche Bestätigungs-Modalität, kein Cursor-/Inline-Insert, keine neue Editor-Library. Die Änderung ist bewusst leichte Klarheitsschicht statt schwerer Workflow.

**Geänderte Dateien.**
- `apps/web/src/lib/editorApplySafety.ts` (NEU)
- `apps/web/src/components/AiAssistBox.tsx` (Replace-Warnhinweis in Vorschau)
- `apps/web/src/components/BodyTemplateChooser.tsx` (Setzen/Anhängen-Hinweis)
- `apps/web/src/i18n.ts` (`editor.applySafety.*`, `editor.template.mode.*` DE+EN)
- `tests/app/editor-apply-safety.test.ts` (NEU)

**Tests/Gates.** Gezielte Tests: `npx vitest run tests/app/editor-apply-safety.test.ts tests/app/body-templates.test.ts tests/app/body-ai-assist.test.ts` → 21/21 grün. `npm run check` grün — **144 Dateien / 858 Tests**. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün.

**Nicht-Ziele eingehalten.** Kein neuer Editor, keine neue Toolbar-Logik, kein RAG/neue Suche/Local-LLM, keine Auto-Validierung, kein Auto-Speichern, keine Backend-/Datenmodelländerung, keine Team-2/3/4-Dateien, keine Migration/Deployment. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis.**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorApplySafety.ts apps/web/src/components/AiAssistBox.tsx apps/web/src/components/BodyTemplateChooser.tsx apps/web/src/i18n.ts tests/app/editor-apply-safety.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): clarify replace vs append safety in AI/template apply flows (SCRUM-320)"
git push
```
Codex übernimmt Commit, Push, GitHub-CI-Prüfung und Jira-Abschluss.

---

## SCRUM-313 — Beta AI-assisted KO Detail Revision / Nachbearbeitung v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** KO-Detail-Edit (`apps/web/src/pages/KnowledgeDetail.tsx`) hat `edit.statement` (textarea), `edit.bodyHtml` (RichTextEditor), conditions/measures (ListEditor), Save-Mutation mit `action:"revise"`, und `ko.editNote` weist bereits auf neue Version / Review-Neustart hin. KI-Hilfe war hier **nicht** vorhanden. SCRUM-312 lieferte bereits den DOM-freien Helfer `lib/captureAiAssist.ts` (ASSIST_ACTIONS, applyAssist, Label/Instruction-Keys), `endpoints.reasoner.assist(text, locale, instruction?)` und i18n `capture.ai.*`. Die KI-Box lag als **lokale** `AiAssistBox` in `Capture.tsx` (self-contained Props: text/runAssist/onApply) → sauber extrahierbar.

**Umgesetzter Umfang (v0).**
1. **Wiederverwendbare Komponente:** `AiAssistBox` aus Capture.tsx in `apps/web/src/components/AiAssistBox.tsx` extrahiert (1:1, weiterhin auf den DOM-freien `captureAiAssist`-Helfern). Capture.tsx nutzt jetzt dieselbe Komponente — SCRUM-312-Verhalten unverändert.
2. **KO-Detail-Edit KI-Box** unter der Statement-Textarea: Aktionen Klarer/Strukturieren/Erweitern/Rechtschreibung + freies Anweisungsfeld + Ausführen; **Vorschau** mit Ersetzen/Anhängen/Verwerfen. `runAssist` ruft `reasoner.assist(input, locale, instruction)`; Ergebnis wird **nicht** still in `edit.statement` geschrieben, sondern bewusst übernommen (`onApply → setEdit(statement)`).
3. **Revision-Ehrlichkeit:** Box-Hinweis (`capture.ai.hint`: „Vorschlag, keine Auto-Speicherung/Validierung, keine erfundenen Fakten") + Inline-Kommentar; `ko.editNote` (neue Version / Review-Neustart) bleibt unverändert sichtbar. Keine Auto-Validierung/Fake-Freigabe.

**Bewusst nicht umgesetzte Gaps (später).**
- **Body/ausführlicher Inhalt (bodyHtml):** KI-Vorschlag (Plaintext) ins HTML-Body anhängen — bewusst NICHT umgesetzt, da Plaintext→HTML-Übernahme (Escaping/Absatzstruktur) eine eigene risikoarme Lösung braucht; RichTextEditor nicht umgebaut.
- RichTextEditor Panel-Differenzierung (aus SCRUM-312) bleibt weiterhin offen.
- Kein WikiEditor-/CaseEditor-Nachbau, keine Datei-/Bild-Inline-Neuerfindung.

**Geänderte Dateien.**
- `apps/web/src/components/AiAssistBox.tsx` (NEU, extrahiert)
- `apps/web/src/pages/Capture.tsx` (lokale Box entfernt, importiert Komponente)
- `apps/web/src/pages/KnowledgeDetail.tsx` (runAssist + AiAssistBox unter Statement; `i18n`/`toReasonerLocale`)
- Kein neuer i18n-Key nötig (Wiederverwendung `capture.ai.*`). Helfer/Backend/Reasoner **unverändert** (SCRUM-312 lieferte `instruction` bereits).

**Tests/Gates.** `npm run check` grün — **138 Dateien / 821 Tests** (unverändert; Extraktion + Verdrahtung über tsc/Biome/depcruise abgesichert, bestehender `tests/capture/capture-ai-assist.test.ts` deckt die DOM-freie Logik weiter ab). `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SCRUM-312-Capture-KI bleibt intakt (nutzt jetzt dieselbe Komponente).

**Nicht-Ziele eingehalten.** Kein RAG, keine neue Suche, keine Local-LLM-Abhängigkeit, keine neue Provider-/Backend-/Reasoner-Änderung, kein WikiEditor-/CaseEditor-Nachbau, keine Datei-/Bild-Inline-Neuerfindung, keine Auto-Validierung, keine Team-2/3/4-Dateien. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk` gearbeitet; untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` unberührt.

**Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/components/AiAssistBox.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): reuse AiAssistBox for statement revision; extract from Capture (SCRUM-313)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-314 — Beta Editor Body Blocks v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** Der `RichTextEditor` (`apps/web/src/components/RichTextEditor.tsx`) bot H2/H3, Bold/Italic, Listen, Link, **ein** generisches Panel (`addPanel()` → `<div class="panel"><p>…</p></div>`), Bild aus Anhang und Vorschau. Beide Sanitizer (FE `apps/web/src/lib/richText.ts`, Server `services/structure/src/sanitize.ts`) erlaubten in `sanitizeDivClass` exakt `panel`/`callout` (identische Logik: split → filter → join, Reihenfolge bleibt erhalten). CSS `.prose-kw .panel` in `apps/web/src/index.css` vorhanden. i18n `editor.panel`/`editor.image` DE+EN vorhanden. Capture und KO-Detail nutzen denselben RichTextEditor für „Ausführlicher Inhalt".

**Umgesetzter Umfang (v0).**
1. **DOM-freie Blocktyp-Modellierung** `apps/web/src/lib/editorBlocks.ts` (NEU): `EditorBlock = info|note|warning|success`, `EDITOR_BLOCKS` (stabile Reihenfolge), `editorBlockLabelKey` → `editor.block.<typ>`, `editorBlockClass` → `panel panel-<typ>` (sichere, statische Klassen), `editorBlockHtml` → `<div class="panel panel-<typ>"><p>…</p></div>`.
2. **Toolbar:** der eine generische Panel-Button ersetzt durch vier kleine Text-Buttons Info/Hinweis/Warnung/Erfolg (SquareStack-Icon + Label), Insert über bestehenden `exec("insertHTML", editorBlockHtml(block))`. Kein UI-Umbau, kein Drag&Drop/Bild-Neuerfindung.
3. **Sanitizer FE + Server:** beide `sanitizeDivClass` auf eine `ALLOWED_DIV_CLASSES`-Allowlist umgestellt: `panel`, `callout` (Bestandsschutz), `panel-info`, `panel-note`, `panel-warning`, `panel-success`. Fremde Klassen, `style` und `on*`-Handler werden weiterhin entfernt; Reihenfolge/Normalisierung stabil; bestehende `panel`-Inhalte funktionieren weiter.
4. **Styling/Preview:** `apps/web/src/index.css` um `.prose-kw .panel-info/-note/-warning/-success` ergänzt (dezenter Links-Akzent + leichte Tönung über vorhandene Tokens Trust-Info/AI/Trust-Warn/Trust-Pos). Wirkt in Editor-Vorschau **und** KO-Detail-Anzeige (beide `.prose-kw`).
5. **i18n:** `editor.block.info/note/warning/success` in DE+EN ergänzt.
6. **Tests:** `tests/app/editor-blocks.test.ts` (NEU, DOM-frei: Reihenfolge, Label-Keys DE+EN-Parität, sichere Klassen, sanitizer-konformes Insert-HTML); `tests/structure/rich-text.test.ts` + `services/structure/src/sanitize.test.ts` je um Block-Klassen-Allowlist + Verwurf fremder Klassen/`style`/`on*` erweitert.

**Bewusst nicht umgesetzte Gaps (später).** Kein KI-Body-Insert in diesem Slice. Keine weiteren Blocktypen/Verschachtelung. Kein Block-Editing/Umwandeln bestehender Blöcke (nur Einfügen). Kein WYSIWYG-Neubau.

**Geänderte Dateien.**
- `apps/web/src/lib/editorBlocks.ts` (NEU)
- `apps/web/src/components/RichTextEditor.tsx` (vier Block-Buttons statt Panel-Button + Import)
- `apps/web/src/lib/richText.ts` (sanitizeDivClass Allowlist)
- `services/structure/src/sanitize.ts` (sanitizeDivClass Allowlist)
- `apps/web/src/index.css` (vier `.panel-*`-Regeln)
- `apps/web/src/i18n.ts` (`editor.block.*` DE+EN)
- `tests/app/editor-blocks.test.ts` (NEU), `tests/structure/rich-text.test.ts`, `services/structure/src/sanitize.test.ts`

**Tests/Gates.** `npm run check` grün — **139 Dateien / 827 Tests**. Gezielt: `npx vitest run tests/structure/rich-text.test.ts services/structure/src/sanitize.test.ts tests/app/editor-blocks.test.ts` → 23/23 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SCRUM-312/313-AiAssistBox-Flows unberührt (RichTextEditor-Änderung betrifft nur die Body-Toolbar).

**Nicht-Ziele eingehalten.** Kein RAG, keine neue Suche, keine Local-LLM-Abhängigkeit, kein WYSIWYG-Neubau, keine blinde Legacy-Kopie, keine neue Editor-Library, keine Backend-Architekturänderung außer Sanitizer-Allowlist, keine Auto-Validierung, keine Team-2/3/4-Dateien. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk` gearbeitet; untracked `docs/KLARWERK_Infrastruktur_Domain_Server_Aufteilung_v2.md` unberührt.

**Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorBlocks.ts apps/web/src/components/RichTextEditor.tsx apps/web/src/lib/richText.ts services/structure/src/sanitize.ts apps/web/src/index.css apps/web/src/i18n.ts tests/app/editor-blocks.test.ts tests/structure/rich-text.test.ts services/structure/src/sanitize.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): beta body block types info/note/warning/success; sanitizer allowlist + styling (SCRUM-314)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-315 — Beta Editor Body AI Assist v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). Nach SCRUM-312/313 gibt es KI-Hilfe für Freitext/Statement (`AiAssistBox` + DOM-freie `captureAiAssist`-Helfer), nach SCRUM-314 vier Body-Blocktypen. Der ausführliche Inhalt (`bodyHtml` via `RichTextEditor`) hatte **keine** KI-Hilfe. Vorhanden: `reasoner.assist(text, locale, instruction?)`; FE/Server-Sanitizer `sanitizeHtml` mit SCRUM-314-Allowlist; `htmlToPlainText`/`isEmptyHtml` in `richText.ts`. Capture: `bodyHtml`/`setBodyHtml`. KO-Detail: `edit.bodyHtml`. `AiAssistBox` war auf Plaintext-`applyAssist` festverdrahtet → für Body generalisierungsbedürftig.

**Umgesetzter Umfang (v0).**
1. **DOM-freier Body-Helfer** `apps/web/src/lib/bodyAiAssist.ts` (NEU): `bodyTextForAssist(bodyHtml)` (Text aus Body via `htmlToPlainText`, leer→""); `suggestionToBodyHtml(text)` (Plaintext→Absätze/`<br>`, eigenes Text-Escaping, leer→""); `applyBodyAssist(mode, currentHtml, suggestionText)` (replace/append). Sicherheit: KI-Text wird escaped und erzeugt nur statische `<p>/<br>`-Tags; bestehender Body gilt als bereits sanitisiert und wird NICHT erneut escaped (sanitizeHtml ist bei Entities nicht idempotent → Doppel-Maskierung vermieden). Leerer Vorschlag = No-Op (Body bleibt erhalten).
2. **Generische `AiAssistBox`** (`apps/web/src/components/AiAssistBox.tsx`): optionale Props `applyFn` (Default = bestehendes Plaintext-`applyAssist`) und `hintKey` (Default = `capture.ai.hint`). Signatur `(mode, original, suggestion)` unverändert → SCRUM-312/313-Aufrufer bleiben 1:1 intakt.
3. **Capture Body-KI** (`apps/web/src/pages/Capture.tsx`): `AiAssistBox` unter dem Body-`RichTextEditor`, `text={bodyTextForAssist(bodyHtml)}`, `applyFn` = `applyBodyAssist(mode, bodyHtml, …)`, `onApply={setBodyHtml}`, `hintKey="capture.ai.bodyHint"`.
4. **KO-Detail Body-KI** (`apps/web/src/pages/KnowledgeDetail.tsx`): analoge Box unter dem Body-`RichTextEditor` im Edit-Modus, Textbasis `edit.bodyHtml`, Übernahme → `setEdit({...edit, bodyHtml})`. Statement-KI (SCRUM-313) und `ko.editNote` unverändert.
5. **i18n** `capture.ai.bodyHint` DE+EN (ehrlich: Vorschlag, keine Auto-Speicherung/Validierung, Inhalte/Quellen selbst prüfen).
6. **Tests** `tests/app/body-ai-assist.test.ts` (NEU, DOM-frei): Textableitung, Absatz-/`<br>`-Umwandlung, Leerbehandlung, Sicherheit (Plaintext-HTML wie `<script>`/`<img onerror>` wird escaped und nicht aktiv), replace/append, No-Op bei leerem Vorschlag, kein Doppel-Escaping beim Anhängen.

**Bewusst nicht umgesetzte Legacy-Gaps (später).** Kein KI-Insert direkt an Cursorposition/Block (nur replace/append des Gesamt-Body). Keine block-typ-bewusste KI (Info/Hinweis/…). Kein Diff-/Merge-View. Kein WikiEditor-/CaseEditor-Nachbau, keine neue Editor-Library, keine Datei-/Bild-Inline-Neuerfindung. Markup im Body (Bilder/Blöcke) geht bei `replace` verloren — bewusst, da KI Plaintext liefert; `append` erhält den Bestand.

**Geänderte Dateien.**
- `apps/web/src/lib/bodyAiAssist.ts` (NEU)
- `apps/web/src/components/AiAssistBox.tsx` (optionale `applyFn`/`hintKey`, Defaults erhalten)
- `apps/web/src/pages/Capture.tsx` (Body-KI-Box + Import)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Body-KI-Box + Import)
- `apps/web/src/i18n.ts` (`capture.ai.bodyHint` DE+EN)
- `tests/app/body-ai-assist.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **140 Dateien / 834 Tests**. Gezielt: `npx vitest run tests/app/body-ai-assist.test.ts tests/structure/rich-text.test.ts tests/capture/capture-ai-assist.test.ts` → 19/19 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SCRUM-312/313-Statement/Freitext-KI intakt (Default-`applyFn`); SCRUM-314-Blocktypen unberührt (Sanitizer unverändert).

**Nicht-Ziele eingehalten.** Kein RAG, keine neue Suche, keine Local-LLM-Abhängigkeit, kein WYSIWYG-Neubau, keine neue Editor-Library, keine blinde Legacy-Kopie, keine Datei-/Bild-Inline-Neuerfindung, keine Auto-Validierung, kein Auto-Speichern, keine Team-2/3/4-Dateien, keine Migration/Datenmodell, kein Deployment. Backend/Reasoner/Sanitizer unverändert. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk` gearbeitet; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/bodyAiAssist.ts apps/web/src/components/AiAssistBox.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/body-ai-assist.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): beta body AI assist — derive/sanitize/apply body suggestions in Capture + KO-Detail (SCRUM-315)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-316 — Beta Editor AI Vorschlag als Body-Block übernehmen v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). SCRUM-314 liefert `EditorBlock`/`editorBlockClass`/`editorBlockHtml` + Sanitizer-Allowlist (`panel`, `callout`, `panel-info/-note/-warning/-success`). SCRUM-315 liefert `bodyAiAssist.ts` (`bodyTextForAssist`/`suggestionToBodyHtml`/`applyBodyAssist`, escapt Plaintext direkt — kein sanitizeHtml-Roundtrip) + `AiAssistBox` mit `applyFn`/`hintKey`; Body-KI in Capture + KO-Detail (nur replace/append als Absätze).

**Umsetzung (v0).**
1. **DOM-freie Block-Helfer** (`apps/web/src/lib/bodyAiAssist.ts`): gemeinsame private `escapedParagraphs(text)` (von `suggestionToBodyHtml` mitgenutzt → keine Duplikat-Logik); `suggestionToBodyBlockHtml(block, text)` → `<div class="${editorBlockClass(block)}"><p>…</p></div>` (sichere statische Klasse aus editorBlocks, escapter Text, nur `<div>/<p>/<br>`, leer→""); `applyBodyAssistBlock(currentHtml, suggestionText, block)` (immer ANHÄNGEN; leerer Vorschlag = No-Op; bestehender Body unverändert → kein Doppel-Escaping).
2. **AiAssistBox** (`apps/web/src/components/AiAssistBox.tsx`): optionale Prop `extraApplyActions` (`{labelKey, apply(original, suggestion)}[]`), nur in der Vorschau gerendert (unter Ersetzen/Anhängen/Verwerfen, mit Trennlinie). Leeres Array (Default) → keine Buttons → Statement/Freitext-Flows unverändert. Klick = bewusste Übernahme über `onApply`.
3. **Capture** (`apps/web/src/pages/Capture.tsx`): Body-Box bekommt vier `extraApplyActions` aus `EDITOR_BLOCKS` (`applyBodyAssistBlock(bodyHtml, suggestion, block)` → `setBodyHtml`).
4. **KO-Detail** (`apps/web/src/pages/KnowledgeDetail.tsx`): identische vier Block-Aktionen im Edit-Modus (`edit.bodyHtml` → `setEdit`). `ko.editNote`, Statement-KI und Save-Flow unverändert.
5. **i18n** `capture.ai.applyAs.info/note/warning/success` DE+EN (kurze Labels „Als … anhängen" / „Append as …").
6. **Tests** `tests/app/body-ai-assist.test.ts` (erweitert, DOM-frei): Block-HTML mit sicherer statischer Klasse + escaptem Text + `<br>`/Absätzen; Escaping gefährlichen Plaintexts (script/`<img onerror>` → kein aktives Tag); Leer→""; `applyBodyAssistBlock` anhängen/leerer Body/No-Op; kein Doppel-Escaping.

**Bewusst nicht umgesetzte Gaps (später).** Kein Cursor-/Inline-Insert (Block wird ans Body-Ende angehängt). Keine blocktyp-bewusste Modellgenerierung (Modell liefert Plaintext, Typ wählt der Mensch). Kein Diff/Merge-View. Kein „Block ersetzen"-Modus (nur Anhängen, wie im Ticket). Kein WikiEditor-/CaseEditor-Nachbau, keine neue Editor-Library.

**Geänderte Dateien.**
- `apps/web/src/lib/bodyAiAssist.ts` (escapedParagraphs + suggestionToBodyBlockHtml + applyBodyAssistBlock)
- `apps/web/src/components/AiAssistBox.tsx` (optionale extraApplyActions)
- `apps/web/src/pages/Capture.tsx` (vier Block-Aktionen + EDITOR_BLOCKS-Import)
- `apps/web/src/pages/KnowledgeDetail.tsx` (vier Block-Aktionen + EDITOR_BLOCKS-Import)
- `apps/web/src/i18n.ts` (`capture.ai.applyAs.*` DE+EN)
- `tests/app/body-ai-assist.test.ts` (Block-Übernahme-Tests)

**Tests/Gates.** `npm run check` grün — **140 Dateien / 839 Tests**. Gezielt: `npx vitest run tests/app/body-ai-assist.test.ts tests/app/editor-blocks.test.ts tests/structure/rich-text.test.ts tests/capture/capture-ai-assist.test.ts` → 28/28 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SCRUM-312/313 (Statement/Freitext) und SCRUM-315 (replace/append) unverändert; SCRUM-314-Sanitizer-Allowlist deckt die Block-Klassen serverseitig ab.

**Nicht-Ziele eingehalten.** Kein Cursor-/Inline-Insert, keine blocktyp-bewusste Modellgenerierung, kein Diff/Merge, kein WikiEditor-/CaseEditor-Nachbau, keine neue Editor-Library, kein RAG/neue Suche/Local-LLM, keine Auto-Validierung, kein Auto-Speichern, keine Team-2/3/4-Dateien, keine Migration/Datenmodell, kein Deployment. Sanitizer unverändert (Allowlist genügt). Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/bodyAiAssist.ts apps/web/src/components/AiAssistBox.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/body-ai-assist.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): apply AI suggestion as body block (info/note/warning/success) in Capture + KO-Detail (SCRUM-316)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-317 — Beta Editor Orientierung am ausführlichen Inhalt v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). RichTextEditor (SCRUM-314) bietet H2/H3, Listen, Links, Bild/Datei und vier Blocktypen; Body-KI (SCRUM-315/316) liefert Ersetzen/Anhängen + Block-Übernahme. Lücke: keine kurze Orientierung direkt am Feld „Ausführlicher Inhalt" (`Field label={t("capture.fBody")}`) in Capture und KO-Detail Edit — Beta-Nutzer sehen Werkzeuge ohne Erklärung.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/editorGuidance.ts` (NEU): `EditorGuidanceId = structure|action|blocks|ai`, `EDITOR_GUIDANCE` (stabile Reihenfolge/IDs, `labelKey` = `editor.guidance.<id>`), der Blöcke-Punkt trägt `blocks: EDITOR_BLOCKS` (Bezug auf die real existierenden Blocktypen aus SCRUM-314/316). `editorGuidance()` gibt die Liste zurück. Keine DOM-Abhängigkeit.
2. **Kompakte Komponente** `apps/web/src/components/EditorGuidance.tsx` (NEU): kleine Hilfekarte (Titel + vier Zeilen) auf Basis des Helfers; verdrängt den Editor nicht.
3. **Einbindung**: in `Capture.tsx` und `KnowledgeDetail.tsx` jeweils direkt am Body-Feld VOR dem `RichTextEditor` gerendert. Bestehende Body-KI/Block-Funktionen unverändert.
4. **i18n** `editor.guidance.title/structure/action/blocks/ai` DE+EN (kurz, produktnah, ehrlich: Struktur = H2/H3+Absätze; Handlung = Listen/Links; Blöcke = Info/Hinweis/Warnung/Erfolg; KI = Vorschlag bewusst übernehmen, keine Auto-Validierung).
5. **Tests** `tests/app/editor-guidance.test.ts` (NEU, DOM-frei): genau 4 Items + stabile IDs/Reihenfolge; Titel + alle Labels DE+EN nicht leer; labelKey-Schema `editor.guidance.<id>`; Blöcke-Punkt == `EDITOR_BLOCKS` (4); Ehrlichkeit im KI-Punkt (bewusst/keine Auto).

**Bewusst nicht umgesetzte Gaps (später).** Keine interaktive Hervorhebung/Verknüpfung der Toolbar-Buttons (nur Textorientierung). Kein Onboarding-Overlay/Tour. Keine kontextsensitive Anzeige (immer dieselben vier Punkte). Kein neuer Editor, keine neue Toolbar-Logik.

**Geänderte Dateien.**
- `apps/web/src/lib/editorGuidance.ts` (NEU)
- `apps/web/src/components/EditorGuidance.tsx` (NEU)
- `apps/web/src/pages/Capture.tsx` (Card am Body-Feld + Import)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Card am Body-Feld + Import)
- `apps/web/src/i18n.ts` (`editor.guidance.*` DE+EN)
- `tests/app/editor-guidance.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **141 Dateien / 844 Tests**. Gezielt: `npx vitest run tests/app/editor-guidance.test.ts tests/app/editor-blocks.test.ts` → 9/9 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. Body-KI/Block-Flows (SCRUM-315/316) unberührt.

**Nicht-Ziele eingehalten.** Kein neuer Editor, keine neue Toolbar-Logik, kein RAG/neue Suche/Local-LLM, kein Cursor-/Inline-Insert, keine Auto-Validierung, kein Auto-Speichern, keine Team-2/3/4-Dateien, keine Backend-Änderung, keine Migration/Datenmodell, kein Deployment. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorGuidance.ts apps/web/src/components/EditorGuidance.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/editor-guidance.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): compact orientation card at detailed-content field in Capture + KO-Detail (SCRUM-317)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-318 — Beta KO Detail Lesemodus für ausführlichen Inhalt schärfen v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). KO-Detail Lesemodus (`apps/web/src/pages/KnowledgeDetail.tsx`) rendert unter `SectionLabel ko.statement` bei vorhandenem `ko.bodyHtml` ein `<SanitizedHtml className="prose-kw …">`, sonst Fallback auf `ko.statement`. `.prose-kw` (inkl. SCRUM-314 `.panel-*`) existiert in `index.css`. Lücke: `bodyHtml` wirkt wie nackter HTML-Block ohne Knowledge-Seiten-Rahmung/Orientierung.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/bodyReadMode.ts` (NEU): reine String-/Regex-Erkennung (keine DOM-Abhängigkeit, keine Parsing-Engine, nichts wird ausgewertet/gerendert). `hasBody` (via `isEmptyHtml` → leeres/`<p></p>` zählt nicht), `hasBodyBlocks` (Regex `\bpanel(?:-(?:info|note|warning|success))?\b` auf den statischen Block-Klassen), `bodyReadMode(bodyHtml)` → `{hasBody, hasBlocks}`. i18n-Key-Konstanten `BODY_READ_TITLE/NOTE/BLOCKS_KEY`.
2. **KO-Detail Read-Card**: nur bei vorhandenem `ko.bodyHtml` umschließt jetzt eine leichte Card (`rounded-card border bg-surface`) das `SanitizedHtml`. Kopf: Titel „Ausführlicher Inhalt aus dem Knowledge-Editor" + optionaler Chip „strukturierter Inhalt" (wenn `hasBlocks`). Fuß: kurzer ehrlicher Hinweis, dass Blöcke/KI redaktionelle Struktur sind und Status/Trust/Quellen maßgeblich bleiben. Statement-Fallback unverändert.
3. **i18n** `ko.body.readTitle/readNote/readBlocksChip` DE+EN.
4. **Tests** `tests/app/body-read-mode.test.ts` (NEU, DOM-frei): leeres/whitespace-Body = kein Body; panel/panel-info/-note/-warning/-success-Erkennung; kein Fehlalarm bei „Panel" als Fließtext; `bodyReadMode`-Kombination; stabile i18n-Keys DE+EN; Ehrlichkeit (Status/Quellen im Hinweis).

**Bewusst nicht umgesetzte Gaps (später).** Keine Auswertung/Zählung einzelner Blocktypen (nur „enthält Blöcke ja/nein"). Kein Inhaltsverzeichnis/Anker aus H2/H3. Keine Lesezeit/Wortzahl. Keine Sanitizer-/HTML-Änderung, kein neuer Editor, keine Parsing-Engine über die einfachen Marker hinaus.

**Geänderte Dateien.**
- `apps/web/src/lib/bodyReadMode.ts` (NEU)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Read-Card um SanitizedHtml + Import)
- `apps/web/src/i18n.ts` (`ko.body.*` DE+EN)
- `tests/app/body-read-mode.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **142 Dateien / 849 Tests**. Gezielt: `npx vitest run tests/app/body-read-mode.test.ts` → 5/5 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SanitizedHtml/Sanitizer/`.prose-kw` unverändert → Body-Blöcke bleiben sichtbar; Statement-Fallback unverändert; Status/Trust/Quellen weder ersetzt noch beschönigt.

**Nicht-Ziele eingehalten.** Kein neuer Editor, keine neue Toolbar-Logik, keine Body-Parsing-Engine über einfache Marker hinaus, kein RAG/neue Suche/Local-LLM, keine Auto-Validierung, kein Auto-Speichern, keine Backend-/Datenmodelländerung, keine Team-2/3/4-Dateien, keine Migration/Deployment. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Hinweis — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/bodyReadMode.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/body-read-mode.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): sharpen read-mode for detailed content with editor-content framing (SCRUM-318)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-323 — Beta Editor Attachment-Kontext v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `pwd` = Repo-Root; `git status -sb` sauber (nur untracked Infra-Doc). Capture hält lokale Anhänge getrennt: `images: LocalImage[]` (id/name/mime/dataUrl/original) und `docs: {id,name}[]` (Nicht-Bild-Dateien, ohne mime); Bild-Einfügen via `editorImagesFromLocalImages(images)` (SCRUM-321) an `RichTextEditor images=…`. KO-Detail nutzt `ko.attachments` (objectId/mime/name), Bilder gefiltert über `mime.startsWith("image/")`. `editorImages.ts` wandelt nur sichere data:image-Raster in `EditorImageRef`. Bester risikoarmer Platz: kompakte Karte direkt am Body-Feld VOR dem `RichTextEditor` (analog `EditorGuidance` SCRUM-317), keine Upload-/Object-Store-Änderung.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/editorAttachmentContext.ts` (NEU): `AttachmentLike { mime? }`, `isImageAttachment` (mime startet case-insensitiv mit `image/`), `attachmentContext(items)` → `{ imageCount, fileCount, total, hasAny }` (fehlende/leere/ungültige mime defensiv = Datei). i18n-Key-Konstanten `ATTACH_TITLE/IMAGES/FILES/IMAGE_HINT/FILE_HINT_KEY`.
2. **Kompakte Komponente** `apps/web/src/components/EditorAttachmentContext.tsx` (NEU): Karte am Body-Feld mit Anzahl Bilder + Dateien und ehrlichen Hinweisen (Bilder per Bild-Button einfügbar; Dateien bleiben Anhang/Evidence, NICHT inline). Ohne Anhänge → `null` (keine leere Karte).
3. **Einbindung**: `Capture.tsx` mit `attachments={[...images, ...docs.map(() => ({ mime: null }))]}` (docs = Nicht-Bild → Datei); `KnowledgeDetail.tsx` Edit-Modus mit `attachments={ko.attachments ?? []}`. Beide direkt am Body-Feld. Bild-Einfügefunktion (SCRUM-321) unverändert; keine Upload-/Backend-Änderung.
4. **i18n** `editor.attach.title/images/files/imageHint/fileHint` DE+EN (knapp, beta-tauglich; keine Inline-Datei-Behauptung).
5. **Tests** `tests/app/editor-attachment-context.test.ts` (NEU, DOM-frei): keine Anhänge → empty; nur Bilder; nur Dateien (keine Inline-Behauptung); gemischt; defensiv bei fehlender/leerer/ungültiger mime (case-insensitiv); stabile i18n-Keys DE+EN; Datei-Hinweis nennt „nicht inline".

**Bewusst nicht umgesetzte Gaps (später).** Keine Liste/Namensanzeige einzelner Anhänge in der Karte (nur Counts). Kein Klick „dieses Bild einfügen" aus der Karte (Bild-Button im Editor bleibt der Weg). Kein Hinweis-/Lint, ob Dateien tatsächlich im Text referenziert sind. Kein Empty-State-Hinweis (Karte erscheint bewusst nur bei vorhandenen Anhängen).

**Rest-Risiken.** Capture-`docs` tragen keinen mime → werden generell als Datei gezählt (korrekt, da Nicht-Bild-Uploads). Bilder, die als `docs` statt `images` landen würden, gibt es nicht (Capture trennt nach Bild/Datei beim Upload). KO-`attachments` ohne mime würden defensiv als Datei gezählt — bei seltenen Altdaten leicht ungenau, aber nie fälschlich „inline einfügbar".

**Geänderte Dateien.**
- `apps/web/src/lib/editorAttachmentContext.ts` (NEU)
- `apps/web/src/components/EditorAttachmentContext.tsx` (NEU)
- `apps/web/src/pages/Capture.tsx` (Karte + Import)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Karte + Import)
- `apps/web/src/i18n.ts` (`editor.attach.*` DE+EN)
- `tests/app/editor-attachment-context.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **147 Dateien / 873 Tests**. Gezielt: `npx vitest run tests/app/editor-attachment-context.test.ts` → 7/7 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün (Interface auf `string | null | undefined` für `exactOptionalPropertyTypes`). Biome/depcruise grün. Bild-Einfügen/Upload/Object-Store unverändert.

**Nicht-Ziele eingehalten.** Kein neuer Datei-Viewer, kein Inline-Datei-Embed, kein Drag&Drop-Umbau, kein neuer RichTextEditor, kein RAG/neue Suche/Local-LLM, keine Backend-/Datenmodelländerung, keine Auto-Validierung, kein Auto-Speichern, keine Team-2/3/4-Dateien, keine Migration/Deployment. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorAttachmentContext.ts apps/web/src/components/EditorAttachmentContext.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/editor-attachment-context.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): attachment context card at detailed-content field — images vs files (SCRUM-323)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-324 — Beta Editor Inhaltsqualität-Check v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund / Gap-Liste.** `git status -sb` sauber (nur untracked Infra-Doc). Vorhanden: `EditorGuidance` (SCRUM-317), `EditorAttachmentContext` (SCRUM-323), `BodyTemplateChooser` (SCRUM-319), Body-KI/Blöcke (312–316), `richText.ts` (`htmlToPlainText`/`isEmptyHtml`), `bodyReadMode.hasBodyBlocks` (class-attr-genau), `editorAttachmentContext.attachmentContext`. **Legacy-Erwartung:** Editor als Arbeitsfläche, nicht Formular. **Neue App:** KI/Blöcke/Templates/Bilder/Links/Attachment-Kontext da. **Beta-Lücke:** kein kompakter Struktur-/Nachvollziehbarkeits-Check vor Save/Revise. **Übernehmen:** leichte Inhaltsqualitätskarte. **Später:** Diff/Merge, Cursor-Insert, Pflichtregeln, KI-Scoring. **Nicht übernehmen:** Auto-Validierung, fachliche Wahrheitsbewertung, blockierender Save.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/editorContentQuality.ts` (NEU): `editorContentQuality({ bodyHtml, attachments })` → `{ isEmpty, isThin, hasHeadings, hasLists, hasBlocks, hasLinks, hasAttachments, mentionsAttachments, attachmentsUnreferenced }`. Nutzt `isEmptyHtml`/`htmlToPlainText` (richText), `hasBodyBlocks` (bodyReadMode) und `attachmentContext` (editorAttachmentContext) wieder; Heading/List/Link via Regex auf sanitisiertem HTML. `isThin` = nicht leer & Klartext < 80 Zeichen (nur Hinweis). `attachmentsUnreferenced` = Anhänge vorhanden, aber kein typischer Begriff (Bild/Foto/Datei/Anhang/PDF/… DE+EN) im Text. Keine fachliche Bewertung, keine KI, keine DOM-Abhängigkeit, robust gegen leere/kaputte Strings.
2. **Kompakte Komponente** `apps/web/src/components/EditorContentQuality.tsx` (NEU): kleine Karte mit Titel + ehrlichem Hinweis („prüft Struktur, nicht fachliche Richtigkeit, keine Validierung"), grüne Chips für vorhandene Struktur (Überschriften/Listen/Blöcke/Links) und amber Warn-Zeilen (leer / dünn / Anhänge nicht erwähnt). Kein Blockieren.
3. **Einbindung**: `Capture.tsx` direkt nach `EditorAttachmentContext` (vor `BodyTemplateChooser`), `attachments=[...images, ...docs→{mime:null}]`; `KnowledgeDetail.tsx` Edit-Modus nach `EditorAttachmentContext`, `bodyHtml=edit.bodyHtml`, `attachments=ko.attachments`. Bestehende Reihenfolge/Flows unverändert; Save/Revise unberührt.
4. **i18n** `editor.quality.title/hint/empty/thin/headings/lists/blocks/links/attachmentsUnreferenced` DE+EN (kurz, ehrlich, Strukturhilfe ohne Validierungs-Versprechen).
5. **Tests** `tests/app/editor-content-quality.test.ts` (NEU, DOM-frei): leerer Body; H2/H3; Liste; Panel/Block; Link; dünn vs. ausreichend; Anhänge unerwähnt → `attachmentsUnreferenced`; Anhänge sinngemäß erwähnt → kein Hinweis; ohne Anhänge nie unreferenced; kaputter/harmloser HTML-String crasht nicht.

**Geänderte Dateien.**
- `apps/web/src/lib/editorContentQuality.ts` (NEU)
- `apps/web/src/components/EditorContentQuality.tsx` (NEU)
- `apps/web/src/pages/Capture.tsx` (Karte + Import)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Karte + Import)
- `apps/web/src/i18n.ts` (`editor.quality.*` DE+EN)
- `tests/app/editor-content-quality.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **148 Dateien / 883 Tests**. Gezielt: `npx vitest run tests/app/editor-content-quality.test.ts` → 10/10 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. KI-/Template-/Block-/Bild-/Link-/Attachment-Flows unverändert; Speichern/Revidieren weiter möglich.

**Bewusst nicht umgesetzte Gaps (später).** Kein Diff/Merge, kein Cursor-/Inline-Insert, keine Pflichtregeln/Blocking-Submit, kein KI-Scoring/fachliche Bewertung. Keine Zählung einzelner Blocktypen/Überschriftenebenen. Kein Verweis-Lint pro einzelnem Anhang (nur Gesamt-Erwähnung).

**Rest-Risiken.** `mentionsAttachments` ist eine grobe Begriffsheuristik — false negatives möglich (Verweis ohne Standardbegriff) → harmlos, nur ein zusätzlicher Hinweis, kein Zwang. `isThin`-Schwelle (80 Zeichen) ist konservativ gewählt; rein beratend. Heuristik bewertet nie fachliche Korrektheit.

**Nicht-Ziele eingehalten.** Kein RAG/neue Suche/Local-LLM, keine Backend-/Datenmodelländerung, keine Auto-Validierung/Freigabe, kein Blocking-Submit/Pflichtfeld, keine neue Editor-Library, keine blinde Legacy-Kopie, keine Team-2/3/4-Dateien, keine Migration/Deployment, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorContentQuality.ts apps/web/src/components/EditorContentQuality.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/editor-content-quality.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): compact content-quality structure check at body field (SCRUM-324)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-325 — Beta KO-Revision Änderungsüberblick v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund / Gap-Liste.** `git status -sb` sauber (nur untracked Infra-Doc). KO-Detail Edit-State (`EditState`) = `title/statement/bodyHtml/type/category/conditions[]/measures[]/tags[]` (aus `ko` initialisiert in `startEdit`). Save-Mutation nutzt `action:"revise"` (Titel/Statement/Body/Typ/Listen/Tags) + separat `action:"category"`; `ko.editNote` weist auf Versions-/Review-Folge hin. Vorhandene Editor-Karten: `EditorGuidance`/`EditorAttachmentContext`/`EditorContentQuality`/`BodyTemplateChooser`/`AiAssistBox`. **Beta-Erwartung:** Nachbearbeitung kontrolliert, Nutzer weiß was beim Revidieren passiert. **Neue App:** Editor stark, `ko.editNote` da, aber kein konkreter Änderungsüberblick. **Beta-Lücke:** vor Save nicht sichtbar, welche Bereiche geändert wurden. **Übernommen:** kompakte Änderungsübersicht. **Später:** Text-Diff, Merge-Viewer, Review-Diff. **Nicht übernommen:** Auto-Validierung, fachliche Wahrheitsbewertung, Blocking.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/koRevisionSummary.ts` (NEU): `koRevisionSummary(original, edit)` → `{ hasChanges, changedCount, titleChanged, statementChanged, bodyChanged, conditionsChanged, measuresChanged, tagsChanged, categoryChanged, typeChanged, items[] }`. Vergleichsregeln dokumentiert: Texte (title/statement/category/type) getrimmt; `bodyHtml` getrimmt (kein HTML-Diff); `conditions`/`measures` **geordnet** (Schritt-/Reihenfolge-relevant, nach trim + Drop leerer Einträge — Umsortierung = Änderung); `tags` als **Menge** (sortiert, Reihenfolge irrelevant). `items` = geänderte Felder in fester Reihenfolge mit `labelKey = ko.revision.field.<id>`. Robust gegen null/undefined; keine fachliche Bewertung, kein Backend, kein Text-Diff.
2. **Kompakte Komponente** `apps/web/src/components/KoRevisionSummary.tsx` (NEU): Karte im Edit-Modus — bei Änderungen Chips der geänderten Bereiche, sonst neutraler Hinweis „Noch keine Änderungen erkannt"; immer ehrlicher Revisions-Hinweis (neue Version + Review, keine automatische Freigabe). Kein Blocking.
3. **Einbindung** nur in `KnowledgeDetail.tsx`, im Edit-Modus direkt vor `ko.editNote`/den Save-Buttons (`original={ko}`, `edit={edit}`). `ko.editNote` und der `action:"revise"`-Flow bleiben unverändert.
4. **i18n** `ko.revision.title/none/note` + `ko.revision.field.title/statement/body/conditions/measures/tags/category/type` DE+EN (ehrlich: „Review nötig / keine automatische Freigabe", kein „validiert/freigegeben").
5. **Tests** `tests/ko/ko-revision-summary.test.ts` (NEU, DOM-frei): keine Änderung; Statement/Body/Conditions(+Umsortierung)/Measures/Tags(Menge, Reihenfolge egal)/Typ/Kategorie geändert; Whitespace-only zählt nicht; leere Array-Einträge ignoriert; `changedCount` + Item-IDs/Reihenfolge + labelKey-Schema stabil; robust null/undefined.

**Geänderte Dateien.**
- `apps/web/src/lib/koRevisionSummary.ts` (NEU)
- `apps/web/src/components/KoRevisionSummary.tsx` (NEU)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Karte im Edit-Modus + Import)
- `apps/web/src/i18n.ts` (`ko.revision.*` DE+EN)
- `tests/ko/ko-revision-summary.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **149 Dateien / 894 Tests**. Gezielt: `npx vitest run tests/ko/ko-revision-summary.test.ts` → 11/11 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. `action:"revise"`-Vertrag + bestehende Editor-/KI-/Template-/Attachment-/Quality-Flows unverändert; Revidieren weiter möglich (kein Blocking).

**Bewusst nicht umgesetzte Gaps (später).** Kein vollständiger Text-Diff, kein Merge-/Review-Diff-Viewer, keine Vorher/Nachher-Vorschau pro Feld. Keine Änderungs-Gewichtung/Größenanzeige. Keine fachliche Wahrheitsbewertung. Kein Blocking-Submit/Pflichtfeld.

**Rest-Risiken.** `bodyChanged` per Trim-Vergleich → rein kosmetische Whitespace-Unterschiede im Inneren (z. B. doppelte Leerzeichen) zählen weiter als Änderung; bewusst konservativ (lieber „geändert" anzeigen als verschlucken). Conditions/Measures-Umsortierung gilt als Änderung (dokumentiert, fachlich gewollt da Schrittfolge). Category wird im Save separat (`action:"category"`) gespeichert — der Überblick zeigt sie dennoch korrekt als geändert.

**Nicht-Ziele eingehalten.** Kein RAG/neue Suche/Local-LLM, keine Backend-/Datenmodelländerung, keine Änderung am `action:"revise"`-Vertrag, keine Auto-Validierung/Freigabe, kein Text-Diff/Merge-Viewer, kein Blocking-Submit/Pflichtfeld, keine blinde Legacy-Kopie, keine Team-2/3/4-Dateien, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/koRevisionSummary.ts apps/web/src/components/KoRevisionSummary.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/ko/ko-revision-summary.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): change overview before revise (field/structure diff signals) (SCRUM-325)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-326 — Beta Validation Review-Kontext für neue und revidierte KOs v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund / Gap-Liste.** `git status -sb` sauber (nur untracked Infra-Doc). `KnowledgeObject` trägt `version: number`, `status: KoStatus`, `trust: number`. Validation Board (`Validation.tsx`) rendert je Review-KO via `reviewSignals(k)` Status/Trust/Version/Ziel + `reviewWorkView` Hinweis + `reviewDecision`-Buttons. **Beta-Erwartung:** Revisor erkennt im Board, ob KO neu oder überarbeitet. **Stand:** KO-Edit zeigt Änderungsüberblick (SCRUM-325); Board zeigt Review-Aufgaben, aber nicht explizit neu vs. revidiert. **Beta-Lücke:** Review-Kontext (neu/Revision) fehlt im Board. **Übernommen:** kompakte Review-Kontextzeile. **Später:** Vorher/Nachher-Diff, Merge-/Review-Diff-Viewer. **Nicht übernommen:** Auto-Validierung, Änderung am Review-Vertrag, Blocking.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/validationReviewContext.ts` (NEU): `validationReviewContext(ko)` → `{ kind: "new"|"revision", version, status, trust, labelKey, hintKey, tone }`. `kind = revision`, wenn normalisierte Version > 1, sonst `new`. Version defensiv normalisiert (nur endliche Zahlen ≥ 1, sonst 1; Floor); `status` durchgereicht (`""`-Default), `trust` durchgereicht (ungültig→0). `labelKey/hintKey` = `val.reviewContext.<kind>` / `val.reviewContext.hint.<kind>`; `tone = kind`. Keine fachliche Bewertung, kein Backend, robust gegen null/undefined.
2. **Komponente** `apps/web/src/components/ValidationReviewContext.tsx` (NEU): kompakte Zeile je Review-KO — Chip „Neu/Überarbeitet · v{N}" + kurzer Review-Hinweis (neu: Quelle/Aussage/Struktur prüfen; revidiert: Version/Inhalt erneut bewerten, keine automatische Freigabe). Trust/Status werden NICHT gedoppelt (Board zeigt sie bereits).
3. **Einbindung** in `Validation.tsx`: `<ValidationReviewContext ko={k} />` direkt nach der bestehenden Signal-Zeile, vor der Author-Zeile. Review-/Rate-Buttons/-Mutationen unverändert.
4. **i18n** `val.reviewContext.new/revision` + `val.reviewContext.hint.new/revision` DE+EN (ehrlich; „keine automatische Freigabe", keine Fake-Diff-Versprechen).
5. **Tests** `tests/validation/validation-review-context.test.ts` (NEU, DOM-frei): v1→new; v2→revision; fehlend/0/negativ/NaN/Infinity→new(v1); 3.9→gefloored 3/revision; status/trust nur durchgereicht (ungültig→0/""); robust null/undefined; Label-/Hint-Keys DE+EN; Ehrlichkeit (keine automatische Freigabe).

**Geänderte Dateien.**
- `apps/web/src/lib/validationReviewContext.ts` (NEU)
- `apps/web/src/components/ValidationReviewContext.tsx` (NEU)
- `apps/web/src/pages/Validation.tsx` (Kontextzeile im Board + Import)
- `apps/web/src/i18n.ts` (`val.reviewContext.*` DE+EN)
- `tests/validation/validation-review-context.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **150 Dateien / 902 Tests**. Gezielt: `npx vitest run tests/validation/validation-review-context.test.ts` → 8/8 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. Validation-/Rate-/Review-Vertrag + bestehende reviewSignals/reviewDecision-Flows unverändert.

**Bewusst nicht umgesetzte Gaps (später).** Kein KO-Detail-Review-Hinweis (Board allein sauber, nicht nötig). Kein Vorher/Nachher-Diff, kein Merge-/Review-Diff-Viewer, keine Liste der konkret geänderten Felder im Board (das zeigt der Edit-Modus über SCRUM-325). Keine Sortierung/Filterung neu vs. revidiert.

**Rest-Risiken.** „Revision" basiert allein auf `version > 1` — falls das Backend Versionen anders zählt (z. B. Start bei 0 oder nicht-monoton), könnte die Einordnung abweichen; defensiv aber immer „new" als sichere Default-Lesart, nie „validiert/freigegeben". Der Hinweis ist rein orientierend und ändert keine Entscheidung.

**Nicht-Ziele eingehalten.** Kein RAG/neue Suche/Local-LLM, keine Backend-/Datenmodelländerung, keine Änderung am Validation-/Rate-/Review-Vertrag, keine Auto-Validierung/Freigabe, kein Vorher/Nachher-Diff, kein Merge-/Review-Diff-Viewer, kein Blocking/Pflichtfeld, keine blinde Legacy-Kopie, keine Team-2/3/4-Dateien, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/validationReviewContext.ts apps/web/src/components/ValidationReviewContext.tsx apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts tests/validation/validation-review-context.test.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): review context (new vs revised) on board cards (SCRUM-326)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-327 — Beta Validation Review-Fokusfilter neu vs. revidiert v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund / Gap-Liste.** `git status -sb` sauber (nur untracked Infra-Doc). `validationReviewContext(ko)` (SCRUM-326) klassifiziert `new`/`revision` über `version > 1`. Board-Pipeline: `boardFiltered = items.filter(matchesValidationFilter)` → `demoCounts` darüber → `visible = sortByReviewPriority(boardFiltered.filter(matchesDemoKnowledgeFilter(demoFilter)))`. Herkunftsfilter lazy aus `?origin=` (`readDemoKnowledgeFilter`). **Beta-Erwartung:** Revisor kann gezielt neue/revidierte KOs abarbeiten. **Stand:** Kontext neu/revidiert sichtbar (326). **Lücke:** kein Fokusfilter nach neu/revidiert. **Übernommen:** Filter-Chip-Reihe mit Counts. **Später:** Sortierung, gespeicherte Ansichten, Review-Diff. **Nicht übernommen:** Backend-Filter, Diff-Viewer, Auto-Validierung, Blocking.

**Umsetzung (v0).**
1. **Helfer ergänzt** in `apps/web/src/lib/validationReviewContext.ts`: `ReviewFocusFilter = "all"|"new"|"revision"`, `REVIEW_FOCUS_FILTERS`, `REVIEW_FOCUS_PARAM = "review"`, `reviewFocusLabelKey`, `matchesReviewFocus(ko, filter)` (nutzt `validationReviewContext(...).kind`, also dieselbe `version > 1`-Logik), `countByReviewFocus(kos)` → `{all, new, revision}`, `readReviewFocusFilter(params)` (fehlend/ungültig → `all`). DOM-frei, robust gegen seltsame Versionen, kein Backend.
2. **Board-UI** `apps/web/src/pages/Validation.tsx`: kompakte Chip-Reihe „Review-Fokus" (Alle/Neu/Überarbeitet) mit Counts, unter der Herkunfts-Chip-Reihe. Pipeline: `focusBase = boardFiltered.filter(matchesDemoKnowledgeFilter(demoFilter))` → `reviewFocusCounts = countByReviewFocus(focusBase)` → `visible = sortByReviewPriority(focusBase.filter(matchesReviewFocus(reviewFocus)))`. Counts also exakt über die fachlich + herkunfts-gefilterte Menge, bevor der Review-Fokus greift. Bestehende fachliche + Demo-Filter, Sortierung und Review-/Rate-Buttons unverändert.
3. **Query-Param** `?review=all|new|revision`: lazy init via `readReviewFocusFilter(params)` analog zum bestehenden `demoFilter`/`?origin=`-Muster (nur Init, kein `setSearchParams` — konsistent risikoarm, keine URL-Mutation eingeführt).
4. **i18n** `val.reviewFocus.label/all/new/revision` DE+EN (kurze Labels; keine „freigegeben/validiert"-Begriffe).
5. **Tests** (`tests/validation/validation-review-context.test.ts` erweitert, DOM-frei): FILTERS-Reihenfolge; `all` matcht alles; `new` matcht v1 + defensive Defaults (0/NaN/null); `revision` matcht v>1; `countByReviewFocus` gemischt (`{all:5,new:3,revision:2}`); `readReviewFocusFilter` gültig/ungültig/leer→all; Label-Keys stabil + DE/EN vorhanden.

**Geänderte Dateien.**
- `apps/web/src/lib/validationReviewContext.ts` (ReviewFocusFilter-API ergänzt)
- `apps/web/src/pages/Validation.tsx` (Chip-Reihe + Pipeline + State/Import)
- `apps/web/src/i18n.ts` (`val.reviewFocus.*` DE+EN)
- `tests/validation/validation-review-context.test.ts` (SCRUM-327-Block ergänzt)

**Tests/Gates.** `npm run check` grün — **150 Dateien / 909 Tests**. Gezielt: `npx vitest run tests/validation/validation-review-context.test.ts` → 15/15 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. Validation-/Rate-/Filter-Flows + Herkunfts-/fachliche Filter unverändert.

**Bewusst nicht umgesetzte Gaps (später).** Keine Sortierung nach neu/revidiert, keine gespeicherten Ansichten, kein Review-Diff. Kein Schreiben des `?review=`-Params in die URL beim Klick (nur Lese-Init, wie beim Herkunftsfilter). Keine Kombination als Mehrfachauswahl (genau ein Fokus).

**Rest-Risiken.** Fokus basiert allein auf `version > 1` (geteilte Logik mit SCRUM-326) — bei abweichender Backend-Versionszählung könnte die Zuordnung abweichen; defensiv stets „new" als sichere Default-Lesart. Counts hängen an der vorgelagerten Filterkette: ändert sich ein fachlicher/Herkunfts-Filter, ändern sich die Fokus-Counts entsprechend (gewollt, nachvollziehbar).

**Nicht-Ziele eingehalten.** Kein RAG/neue Suche/Local-LLM, keine Backend-/Datenmodelländerung, keine Änderung am Validation-/Rate-/Review-Vertrag, keine Auto-Validierung/Freigabe, kein Vorher/Nachher-Diff, kein Merge-/Review-Diff-Viewer, kein Blocking/Pflichtfeld, keine blinde Legacy-Kopie, keine Team-2/3/4-Dateien, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/validationReviewContext.ts apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts tests/validation/validation-review-context.test.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): review focus filter (all/new/revised) with counts on board (SCRUM-327)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-328 — Beta Validation Board Fokusansichten: URL-Sync, Reset und Empty-State v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). `Validation.tsx` las `params` nur (`const [params] = useSearchParams()`) — kein Setter, also keine URL-Mutation. `demoFilter`/`reviewFocus` lazy aus `?origin=`/`?review=` (SCRUM-311/327). Pipeline: `boardFiltered = items.filter(matchesValidationFilter)` → `focusBase = boardFiltered.filter(matchesDemoKnowledgeFilter(demoFilter))` → `reviewFocusCounts` → `visible = focusBase.filter(matchesReviewFocus(reviewFocus))`. `QueryState` zeigt `val.empty` nur bei komplett leerer Datenmenge; der per-Filter-Leerstand (`visible=0` bei vorhandenen Daten) war unbehandelt. `DEMO_FILTER_PARAM="origin"`, `REVIEW_FOCUS_PARAM="review"`.

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/validationBoardFocus.ts` (NEU): `boardFocusActive({origin, review})`; `applyBoardFocusParams(params, state)` (Standard „all" → Param entfernen, sonst setzen; übrige Query — z. B. `demo=stage1` — bleibt erhalten); `resetBoardFocusParams(params)`; `boardEmptyKind({totalItems, visibleCount})` → `"not-empty" | "none" | "filtered"`. Nutzt die Param-Konstanten aus demoKnowledge + validationReviewContext.
2. **URL-Sync** in `Validation.tsx`: `const [params, setSearchParams] = useSearchParams()`. Klick auf Herkunfts-Chip bzw. Review-Fokus-Chip aktualisiert State UND URL via `setSearchParams((prev) => applyBoardFocusParams(prev, …), { replace: true })`. Deep-Link/Refresh bleibt über die bestehende Lazy-Init erhalten.
3. **Aktive Filter / Reset**: wenn `boardFocusActive`, kompakte Zeile mit benannten aktiven Filtern (Herkunft/Review-Fokus) + Button „Filter zurücksetzen" → `resetBoardFocus()` setzt beide Fokusfilter auf „all" (State + URL).
4. **Empty-State**: `boardEmptyKind` unterscheidet — `QueryState`/`val.empty` deckt „gar keine Review-Arbeit" (items leer) ab; im Listenbereich erscheint bei `filtered` (Daten vorhanden, aber `visible=0`) eine ehrliche Karte „Keine Treffer mit den aktuellen Filtern." mit Reset-Button (wenn Fokusfilter aktiv) bzw. Hinweis auf Suche/Typ/Kategorie/Tag (wenn nur fachliche Filter greifen). Keine Behauptung „erledigt".
5. **i18n** `val.focusActive.label`, `val.focusReset`, `val.focusEmpty.filtered`, `val.focusEmpty.otherFilters` DE+EN.
6. **Tests** `tests/validation/validation-board-focus.test.ts` (NEU, DOM-frei): `boardFocusActive`; `applyBoardFocusParams` setzt/entfernt + erhält Fremd-Params (`demo=stage1`); `resetBoardFocusParams`; `boardEmptyKind` (not-empty/none/filtered); i18n DE+EN.

**Geänderte Dateien.**
- `apps/web/src/lib/validationBoardFocus.ts` (NEU)
- `apps/web/src/pages/Validation.tsx` (setSearchParams, URL-Sync, Reset-Zeile, Empty-State, Imports)
- `apps/web/src/i18n.ts` (`val.focusActive/focusReset/focusEmpty.*` DE+EN)
- `tests/validation/validation-board-focus.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **151 Dateien / 915 Tests**. Gezielt: `npx vitest run tests/validation/validation-board-focus.test.ts` → 6/6 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SCRUM-326/327-Kontext/Counts + Review-/Rate-Aktionen unverändert; Counts weiter über die richtige Filterbasis.

**Bewusst nicht umgesetzte Gaps (später).** Kein URL-Sync der fachlichen Filter (`search`/type/category/tag bleiben reiner State, wie zuvor — Scope ausdrücklich Fokusfilter). Keine gespeicherten Ansichten/Profile. Kein Sortier-State in der URL. Empty-State unterscheidet „filtered" nicht weiter nach „nur fachlich" vs. „nur Fokus" (Reset-Button erscheint kontextabhängig über `boardFocusActive`).

**Rest-Risiken.** `replace: true` hält die History flach (kein Zurück-Stack pro Filterklick) — bewusst, um die Browser-History nicht mit Filterschritten zu fluten; Deep-Link/Teilen funktioniert weiterhin. Reset setzt nur die Fokusfilter zurück; aktive fachliche Filter (Suche etc.) bleiben — der Empty-State weist in dem Fall korrekt auf diese hin.

**Nicht-Ziele eingehalten.** Kein Backend-Filter, keine Datenmodelländerung, keine gespeicherten Ansichten, kein Review-Diff/Merge-Viewer, keine Auto-Validierung/Freigabe, kein Blocking, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4-Dateien, kein Refactoring ohne Produktnutzen, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/validationBoardFocus.ts apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts tests/validation/validation-board-focus.test.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): board focus URL sync, active-filter reset and honest empty-state (SCRUM-328)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-329 — Beta Validation Entscheidung: Folgearbeit nach Review sichtbar machen v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). `reviewDecision.ts` liefert `REVIEW_DECISIONS` (up/warn/down), `reviewOutcome(verdict)` (ehrliche Folge-Aussage `val.outcome.*` + tone + usable, SCRUM-292) und `reviewNextSteps(decision)` (bisher: immer „KO ansehen" `val.nextViewKo`; bei `up` zusätzlich „Wissen nutzen" `val.nextUse` via `askQuestionHref`). `Validation.tsx` rendert nach einer Entscheidung (`lastDecision`) eine getönte Outcome-Card mit `reviewOutcome.statusKey` + `reviewNextSteps(...)` als CTAs. Lücke: `warn`/`down` boten nur das generische „KO ansehen" — wirkten wie Sackgasse, ohne klare Folgearbeit.

**Umsetzung (v0).**
1. **`reviewNextSteps` verdict-bewusst** (`apps/web/src/lib/reviewDecision.ts`): `up` unverändert (KO ansehen + Wissen nutzen). `warn`/`down` liefern jetzt genau eine klare Nacharbeits-Folgehandlung „Im Objekt nacharbeiten" (`val.nextRework` → `/wissen/:id`, wo Kommentare/Revision liegen) statt des generischen „ansehen". Kein Use-Schritt für warn/down (bleiben Review-/Feedback-Arbeit); keine automatische Rückgabe/Schließung. `reviewOutcome` unverändert (ehrliche Statuszeile bleibt).
2. **UI**: keine Strukturänderung nötig — die bestehende Outcome-Card mappt `reviewNextSteps` automatisch; warn/down zeigen damit die Nacharbeits-CTA, up den unveränderten ansehen+nutzen-Flow. Validation-/Rate-Mutationen unberührt.
3. **i18n** `val.nextRework` DE („Im Objekt nacharbeiten") + EN („Rework in the object").
4. **Tests** (`tests/validation/review-decision.test.ts` angepasst): warn/down → genau eine Folgehandlung mit `val.nextRework` → `/wissen/:id`; `val.nextRework` DE+EN vorhanden. Bestehende up-/Outcome-/Ehrlichkeits-Tests unverändert grün.

**Geänderte Dateien.**
- `apps/web/src/lib/reviewDecision.ts` (reviewNextSteps verdict-bewusst)
- `apps/web/src/i18n.ts` (`val.nextRework` DE+EN)
- `tests/validation/review-decision.test.ts` (warn/down-Erwartung + i18n)

**Tests/Gates.** `npm run check` grün — **151 Dateien / 916 Tests**. Gezielt: `npx vitest run tests/validation/review-decision.test.ts` → 10/10 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. up-Flow (ansehen + nutzen) unverändert; Review-/Rate-API + Outcome-Texte unverändert.

**Bewusst nicht umgesetzte Gaps (später).** Keine zweite warn/down-Aktion „zurück ins Board" (Success-Card sitzt bereits auf dem Board → Self-Link ohne Nutzen, bewusst weggelassen). Kein Capture-/Anstoß-Flow für Reviewer (Nacharbeit gehört zum KO, nicht zu einer Neuerfassung). Keine verdict-spezifische Tönung der CTA-Buttons (bleiben einheitlich), keine Status-/Statusmodelländerung.

**Rest-Risiken.** „Im Objekt nacharbeiten" führt auf `/wissen/:id` — dieselbe Route wie „ansehen", aber mit klarer Nacharbeits-Framing-Copy; semantisch korrekt, da Edit/Revise + Kommentare dort liegen. Wer kein Edit-Recht hat (Viewer), sieht das KO weiterhin nur lesend — der CTA bleibt sinnvoll (Kontext/Feedback prüfen), erzwingt nichts.

**Nicht-Ziele eingehalten.** Keine Änderung an Review-/Rate-API, keine automatische Rückgabe, kein neues Statusmodell, kein Backend, keine Datenmigration, kein Review-Diff/Merge-Viewer, kein Blocking, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4-Dateien, kein Refactoring ohne Produktnutzen, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/reviewDecision.ts apps/web/src/i18n.ts tests/validation/review-decision.test.ts docs/qm/claude-after-report.md
git commit -m "feat(validation): post-review follow-up — verdict-aware next step (warn/down rework CTA) (SCRUM-329)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-330 — Beta Review-Nacharbeit im KO-Detail sichtbar machen v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). SCRUM-329: `reviewNextSteps` liefert für warn/down die CTA „Im Objekt nacharbeiten" (`val.nextRework` → `/wissen/:id`) — semantisch aber bisher nur die normale Leseansicht. KO-Detail (`KnowledgeDetail.tsx`) nutzt `useSearchParams` (`params`), hat `startEdit(ko)` (setzt Edit-State, risikoarm), `canEdit`, einen „Bearbeiten"-Button und einen bestehenden Rückgabe-Banner aus Audit (`isReturnedForRework`, SCRUM-124). Query-Param-Lesen ist etabliert (`demoHref`/`?origin=`).

**Umsetzung (v0).**
1. **DOM-freier Helfer** `apps/web/src/lib/reviewReworkContext.ts` (NEU): `REWORK_PARAM = "rework"`, `REWORK_REVIEW_VALUE = "review"`, `reworkHref(id)` → `/wissen/:id?rework=review`, `isReviewReworkContext(params)` (nur exaktes `rework=review`). Kein Backend, keine DOM-Abhängigkeit.
2. **Nacharbeitslink mit Query** in `reviewDecision.ts`: warn/down nutzen jetzt `reworkHref(decision.id)` statt des nackten `/wissen/:id`. `up`-Next-Steps unverändert (ohne rework-Query).
3. **KO-Detail Nacharbeitsbanner**: liest `isReviewReworkContext(params)`; nur bei `rework=review` erscheint ein kompakter Banner (Titel „Review-Nacharbeit" + ehrlicher Hinweis: aus Review-Entscheidung angestoßen, Bearbeiten erzeugt neue Version/Review, keine automatische Freigabe/Rückgabe) mit Handlungen „Bearbeiten / Revision" (ruft den vorhandenen `startEdit(ko)`, nur wenn `canEdit && !edit`) und „Zurück zur Validierung" (`/validierung`). Ohne Query bleibt die normale Ansicht unverändert.
4. **i18n** `ko.rework.title/hint/edit/back` DE+EN (ehrlich: keine Auto-Freigabe/-Rückgabe).
5. **Tests** `tests/ko/review-rework-context.test.ts` (NEU, DOM-frei: `reworkHref`, `isReviewReworkContext` exakt/neben anderen Params, Banner-i18n DE+EN, Ehrlichkeit) + `tests/validation/review-decision.test.ts` erweitert (up ohne `rework=`, warn/down → `/wissen/ko-7?rework=review`).

**Geänderte Dateien.**
- `apps/web/src/lib/reviewReworkContext.ts` (NEU)
- `apps/web/src/lib/reviewDecision.ts` (warn/down → reworkHref)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Nacharbeitsbanner + Import)
- `apps/web/src/i18n.ts` (`ko.rework.*` DE+EN)
- `tests/ko/review-rework-context.test.ts` (NEU), `tests/validation/review-decision.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **152 Dateien / 921 Tests**. Gezielt: `npx vitest run tests/validation/review-decision.test.ts tests/ko/review-rework-context.test.ts` → 15/15 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. up-Flow + Edit-/Revise-Flow + Audit-Rückgabe-Banner unverändert.

**Bewusst nicht umgesetzte Gaps (später).** Kein automatisches Umschalten in den Edit-State beim Laden (bewusst per Button, da Auto-Edit über Query riskant/überraschend wäre). Kein Übertragen des konkreten Review-Kommentars in die Nacharbeit (nicht im Query verfügbar; Kommentare liegen am KO). Kein Diff/Merge-Viewer. „Zurück zur Validierung" ohne Übernahme bestehender Board-Filter-Query (einfacher Link, wie vom Ticket erlaubt).

**Rest-Risiken.** Banner zeigt sich rein query-getrieben (`rework=review`) — ein manuell gesetzter Query zeigt ihn ebenfalls; harmlos, da reine Anzeige ohne Statuswirkung. Bei Viewer (`canEdit=false`) erscheint nur „Zurück zur Validierung" (kein Bearbeiten-Button) — korrekt, keine Sackgasse. Der bestehende Audit-Rückgabe-Banner (SCRUM-124) kann zusätzlich erscheinen; beide sind komplementär (Audit = belegte Rückgabe, rework = Navigationskontext).

**Nicht-Ziele eingehalten.** Kein Backend, keine Datenmodelländerung, kein Speichern/Übertragen des Review-Kommentars, kein Review-Diff/Merge-Viewer, kein automatisches Editieren, keine automatische Rückgabe/Freigabe, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4-Dateien, kein Refactoring ohne Produktnutzen, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/reviewReworkContext.ts apps/web/src/lib/reviewDecision.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/ko/review-rework-context.test.ts tests/validation/review-decision.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): review rework context banner via ?rework=review from warn/down decisions (SCRUM-330)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-331 — Beta Review-Nacharbeit: nach Revision zurück in den Validation-Fokus führen v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). KO-Detail Save-Mutation (`action:"revise"` + tags + ggf. category) hat `onSuccess: invalidate; setEdit(null); setErr(null)` — kein Success-State; danach Read-Mode. SCRUM-330 zeigt bei `?rework=review` einen Nacharbeitsbanner (Bearbeiten/Revision + zurück). `reviewReworkContext.ts` (REWORK_PARAM/reworkHref/isReviewReworkContext). `validationReviewContext.ts` liefert `REVIEW_FOCUS_PARAM = "review"` + `review=revision`; `validationBoardFocus.ts` die Query-Konvention (SCRUM-328). KO-Detail nutzt `useSearchParams` (`params`).

**Umsetzung (v0).**
1. **DOM-freier Helfer** `reviewReworkContext.reworkValidationHref()` (NEU) → `/validierung?review=revision` (nutzt `REVIEW_FOCUS_PARAM` aus validationReviewContext). Bewusst KEIN `origin=…`: Demo/Eigenes hängt am KO, nicht an der Nacharbeit — ein fixes origin könnte ein Demo-KO fälschlich ausblenden.
2. **KO-Detail Revision-Success-Card**: neuer State `reworkSaved`; in der Save-`onSuccess` wird er gesetzt, wenn `isReviewReworkContext(params)`. Nach erfolgreichem Revise (aus dem Rework-Kontext) erscheint eine positive Card „Revision gespeichert" + ehrlicher Hinweis (neue Version, erneute Review, keine Auto-Freigabe/-Rückgabe) + CTA „Zur Validierung der Revision" (`reworkValidationHref()`) + Schließen. Der SCRUM-330-Nacharbeitsbanner wird auf `isReviewReworkContext(params) && !reworkSaved` gegated, damit nach dem Speichern die Success-Card führt.
3. **Copy/i18n** `ko.rework.savedTitle/savedHint/toValidation` DE+EN (ehrlich). Bestehende `ko.editNote` + SCRUM-330-Banner unverändert.
4. **Tests** `tests/ko/review-rework-context.test.ts` erweitert: `reworkValidationHref` → `/validierung?review=revision` ohne origin; Erfolg-i18n (savedTitle/savedHint/toValidation) DE+EN; Ehrlichkeit (keine automatische Freigabe) im savedHint. Bestehende SCRUM-330-Tests unverändert grün.

**Geänderte Dateien.**
- `apps/web/src/lib/reviewReworkContext.ts` (reworkValidationHref + REVIEW_FOCUS_PARAM-Import)
- `apps/web/src/pages/KnowledgeDetail.tsx` (reworkSaved-State, Save-onSuccess, Revision-Success-Card, Banner-Gate, Import)
- `apps/web/src/i18n.ts` (`ko.rework.saved*` + `toValidation` DE+EN)
- `tests/ko/review-rework-context.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **152 Dateien / 924 Tests**. Gezielt: `npx vitest run tests/ko/review-rework-context.test.ts` → 8/8 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün (kein Import-Zyklus: reviewReworkContext → validationReviewContext, einseitig). Normale Edit-/Revise-Flows ohne `?rework=review` unverändert (reworkSaved bleibt false → keine Card).

**Bewusst nicht umgesetzte Gaps (später).** Kein automatisches Entfernen des `?rework=review` aus der URL nach Save (Card steuert die Folge; Banner ist gegated). Kein `origin`-Parameter im Rückweg (bewusst, s. o.). Kein Toast zusätzlich zur Card. Kein Übertragen des Review-Kommentars. Kein Diff/Merge-Viewer.

**Rest-Risiken.** `reworkSaved` ist client-seitiger Anzeige-State; bei Reload geht er verloren — dann greift wieder der SCRUM-330-Banner (rework=review noch in URL), was konsistent bleibt (Nutzer kann erneut bearbeiten oder zur Validierung). Die Validierungs-Fokusansicht zeigt nur KOs mit `version > 1` als „überarbeitet" (geteilte Logik mit SCRUM-326/327) — die soeben gespeicherte Revision erscheint dort, sobald der Board-Datenstand sie mit erhöhter Version liefert.

**Nicht-Ziele eingehalten.** Kein Backend, keine Datenmodelländerung, keine Auto-Validierung/-Freigabe/-Rückgabe, kein Review-Kommentar im Query, kein Review-Diff/Merge-Viewer, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4-Dateien, kein Refactoring ohne Produktnutzen, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/reviewReworkContext.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/ko/review-rework-context.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): after rework revision, guide back to validation revision focus (SCRUM-331)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-332 — Beta Review-Feedback im KO-Detail fokussiert sichtbar machen v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc). `validationFeedback.ts` schreibt Pflichtfeedback mit stabilem, sprachunabhängigem Präfix (`feedbackPrefix`: „Validierungsfeedback (Bedingt)" / „Validierungsfeedback (Ablehnung)") via `buildValidationFeedback(verdict, text)` → `"<Präfix>: <Text>"`. `KoComment` = `{id, author, text, at}`; `ko.comments?: KoComment[]`. KO-Detail hat allgemeine Kommentarliste unten, den SCRUM-330-Rework-Banner bei `?rework=review` (const `reviewReworkContext`) und die SCRUM-331-Revision-Success-Card (`reworkSaved`). Der Rework-Banner zeigte bisher nur den generischen Hinweis, nicht das konkrete Feedback.

**Umsetzung (v0).**
1. **DOM-freier Leser** in `apps/web/src/lib/validationFeedback.ts`: `parseValidationFeedback(text)` erkennt am `feedbackPrefix` (warn/down) und liefert `{verdict, body}` (Text ohne Präfix) bzw. null; `latestValidationFeedback(comments)` liefert das jüngste passende Feedback `{verdict, body, author, at}` (per ISO-`at`, bei Gleichstand/fehlendem `at` die spätere Array-Position). Robust gegen leere/fehlende/normale/unbekannte Kommentare; nutzt exakt das bestehende Präfix (kein neuer Kommentar-Typ, kein Backend).
2. **Rework-Banner erweitert** (`KnowledgeDetail.tsx`): nur im Rework-Kontext (`reviewReworkContext && !reworkSaved`) erscheint — falls vorhanden — eine kompakte Feedback-Card direkt unter dem Hinweis: Label „Review-Feedback" + Verdict-Chip (Rückfrage/Ablehnung), der reine Feedback-Text, sowie Autor (via `nameOf`) + Datum (`toLocaleDateString`), beides nur wenn sicher vorhanden. Ohne erkennbares Feedback bleibt nur der bestehende generische Hinweis.
3. **Allgemeine Kommentarliste** und **normale KO-Detail-Ansicht ohne `?rework=review`** unverändert.
4. **i18n** `ko.rework.feedbackTitle` + `ko.rework.feedback.warn/down` DE+EN.
5. **Tests** `tests/ko/validation-feedback-read.test.ts` (NEU, DOM-frei): `parseValidationFeedback` (warn/down erkannt, normale/unbekannte/leere/null → null); `latestValidationFeedback` (leer/normal → null; jüngstes per ISO-`at` inkl. Autor/Zeit; fehlendes `at` → spätere Array-Position; fehlender `text` robust); Banner-i18n DE+EN.

**Geänderte Dateien.**
- `apps/web/src/lib/validationFeedback.ts` (parseValidationFeedback + latestValidationFeedback + Typen)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Feedback-Card im Rework-Banner + Import)
- `apps/web/src/i18n.ts` (`ko.rework.feedback*` DE+EN)
- `tests/ko/validation-feedback-read.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **153 Dateien / 932 Tests**. Gezielt: `npx vitest run tests/ko/validation-feedback-read.test.ts` → 8/8 grün. `(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)` grün. Biome/depcruise grün. SCRUM-330/331-Banner/Card + Kommentarliste + normale Ansicht unverändert. Codex-Korrektur nach Prüfung: Die Fallback-Regel „fehlender Zeitstempel → spätere Array-Position" wurde auch für gemischte Zeitstempel explizit abgesichert.

**Bewusst nicht umgesetzte Gaps (später).** Keine Liste mehrerer Feedbacks (nur das jüngste). Kein Editieren/Beantworten des Feedbacks im Banner. Kein Verlinken/Scrollen zur passenden Stelle in der allgemeinen Kommentarliste. Kein neuer Kommentar-Typ/Backend, keine Migration alter Kommentare.

**Rest-Risiken.** Erkennung hängt am exakten Präfix (`<Präfix>: `) — vor SCRUM-332 geschriebene Feedbacks ohne dieses Format würden nicht erkannt (kein Risiko, nur keine Fokus-Anzeige; fallen weiter in die allgemeine Liste). `toLocaleDateString` rendert nur ein Datum (keine Uhrzeit) — bewusst kompakt; ungültiges `at` würde „Invalid Date" zeigen, ist aber durch die `fb.at`-Guard auf real gesetzte Werte beschränkt (seedete/echte Kommentare liefern ISO).

**Nicht-Ziele eingehalten.** Kein neuer Kommentar-Typ, keine Backend-/Datenmodelländerung, keine Migration, kein Editieren/Beantworten im Banner, kein Diff/Merge-Viewer, keine Auto-Validierung/-Rückgabe/-Freigabe, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4-Dateien, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/validationFeedback.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/ko/validation-feedback-read.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): show focused validation feedback in rework context (SCRUM-332)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-333 — Beta Review-Nacharbeit: Feedback während der Revision als Arbeitshilfe anzeigen v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Umsetzung) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** SCRUM-332 zeigt das fokussierte Validierungsfeedback nur im Read-Modus-Rework-Banner (`reviewReworkContext && !reworkSaved`). Im Edit-Modus rendert KO-Detail bereits `KoRevisionSummary` (SCRUM-325) + `ko.editNote`, aber das konkrete Feedback ist beim Bearbeiten/Speichern nicht mehr sichtbar. `latestValidationFeedback(ko.comments)` existiert in `validationFeedback.ts` und wurde wiederverwendet. `git status -sb` sauber (nur untracked Infra-Doc).

**Umsetzung (v0).**
1. Bestehende Erkennung `latestValidationFeedback` wiederverwendet (kein neuer Helper, kein Backend, kein Kommentarformat-Change).
2. Im Edit-Modus, nur bei `reviewReworkContext` und vorhandenem Feedback, oben im Edit-Formular eine kompakte Rework-Edit-Hilfe: Titel `ko.rework.editTitle`, darin dieselbe Feedback-Card wie SCRUM-332 (Label „Review-Feedback" + Verdict-Chip Rückfrage/Ablehnung + reiner Text + optional Autor/Datum), darunter ehrlicher Hinweis `ko.rework.editHint`.
3. Platzierung am Anfang des Edit-Blocks (vor Titel/Body/Save) — sichtbar während der ganzen Bearbeitung, ohne den Editor zu überfrachten; `KoRevisionSummary`/`ko.editNote` unten unverändert.
4. Copy macht klar: Feedback abarbeiten · Speichern erzeugt neue Version · erneute Prüfung · keine automatische Freigabe.
5. Kein Backend-/Kommentarformat-Change. Bestehender Banner/Success-Card-Flow (SCRUM-330/331/332) unverändert: Read-Banner gated auf `!edit`-Pfad/`!reworkSaved`, Edit-Hilfe nur im `edit`-Pfad.
6. i18n `ko.rework.editTitle`/`editHint` DE+EN.
7. Tests in `tests/ko/validation-feedback-read.test.ts` erweitert: editTitle/editHint DE+EN vorhanden; Ehrlichkeit (DE „neue Version" + „keine automatische Freigabe"; EN „new version" + „no automatic approval").

**Geänderte Dateien.**
- `apps/web/src/pages/KnowledgeDetail.tsx` (Rework-Edit-Hilfe im Edit-Block)
- `apps/web/src/i18n.ts` (`ko.rework.editTitle`/`editHint` DE+EN)
- `tests/ko/validation-feedback-read.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **153 Dateien / 934 Tests**. Gezielt 10/10 grün. FE-tsc grün (EXIT=0). Biome/depcruise grün.

**Bewusst nicht umgesetzte Gaps.** Kein Auto-Prefill in Felder; kein automatisches Abhaken des Feedbacks; kein Diff/Merge-Viewer; kein neues Review-Statusmodell; kein Editieren/Beantworten des Feedbacks in der Hilfe; keine eigene Komponente (kleine Inline-Render-Wiederholung des SCRUM-332-Musters bewusst akzeptiert, da Copy/Platzierung edit-spezifisch).

**Rest-Risiken.** Erkennung hängt weiter am exakten Präfix (`<Präfix>: `) — Feedbacks ohne dieses Format erscheinen nicht in der Edit-Hilfe (kein Datenverlust, fallen in allgemeine Liste). Das Feedback-Render-Muster existiert nun an zwei Stellen (Read-Banner + Edit-Hilfe); bei künftigen Layout-Änderungen ggf. in eine kleine Komponente extrahieren.

**Nicht-Ziele eingehalten.** Kein Backend-/Datenmodell-/Kommentarformat-Change, kein Auto-Prefill/-Abhaken, kein Diff/Merge-Viewer, kein neues Statusmodell, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4-Dateien, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/ko/validation-feedback-read.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): keep review feedback visible as a working aid during rework revision (SCRUM-333)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-334 — Beta Review-Nacharbeitsfluss E2E prüfen und echte Reibung beheben v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Verifikation) · **Status:** geprüft, Flow kohärent, keine Reibung — Smoke als Regressionstest ergänzt, Gates grün

**Vorab-Befund.** SCRUM-330 (`?rework=review`), 331 (`reworkValidationHref` → `/validierung?review=revision`), 332 (`latestValidationFeedback` fokussiert im Banner) und 333 (Feedback als Edit-Arbeitshilfe) lagen jeweils lokal getestet vor, aber noch nicht als zusammenhängender runtime-naher Flow. Backend-Mechanik bestätigt: KO-Dispatcher `PUT /api/kos/:id` mit `action: "comment"` (jeder Nutzer, FR-KO-06), `"rate"` (ko.validate), `"revise"` (ko.create); `KnowledgeObjectService.revise` setzt `version+1`, `trust=0`, `status="offen"` (services/knowledge-object/src/service.ts) — eine Revision ist also automatisch wieder review-pflichtig. `git status -sb` sauber (nur untracked Infra-Doc).

**Smoke-Evidence (runtime-nah, ECHTE HTTP-Routen + FE-Helfer).** Neuer Test `tests/validation/rework-flow-e2e.test.ts` fährt den vollen Flow über `buildApp(buildServices())` per `app.inject` und prüft den Übergang in die FE-Entscheidungs-/Anzeige-Helfer:
1. Admin registriert, `demo-seed`, Carla (controller, ko.validate) eingeloggt.
2. Reales offenes KO (needed=2) angelegt → `status: "offen"`, `trust: 0`.
3. Carla entscheidet `down` **mit Pflichtfeedback wie im FE-Flow**: erst `action:"comment"` mit `buildValidationFeedback("down", …)`, dann `action:"rate" verdict:"down"` → beide 200.
4. `GET /api/kos/:id`: Feedback-Kommentar real gespeichert (beginnt mit `"Validierungsfeedback (Ablehnung): "`); `down` hält das KO `offen` (keine Validierung).
5. `reviewNextSteps({…, verdict:"down"})` → genau **ein** Schritt nach `reworkHref(id)` = `/wissen/:id?rework=review`; `isReviewReworkContext` erkennt den Kontext.
6. `latestValidationFeedback(ko.comments)` erkennt das Feedback fokussiert: `verdict:"down"`, `body` == Originaltext (ohne Präfix).
7. `action:"revise"` (statement ergänzt) → `version: 2`, `status: "offen"`, `trust: 0` (review-pflichtig).
8. `validationReviewContext(revisedKo).kind === "revision"`; `reworkValidationHref()` == `/validierung?review=revision`; `readReviewFocusFilter` der Rückweg-URL == `"revision"`. Version-1-KO bleibt `"new"` (Fokus trennt neu vs. überarbeitet).

**Umsetzung.** Keine Produktcode-Änderung nötig — der Flow ist kohärent, kein Fake, keine Auto-Freigabe (Scope-Punkt 5: Ergebnis ehrlich dokumentiert, keine erzwungene Änderung). Einziger Zuwachs: der E2E-Smoke als dauerhafte Regressionssicherung der Kette über vier Tickets.

**Geänderte Dateien.**
- `tests/validation/rework-flow-e2e.test.ts` (NEU, E2E-Smoke HTTP + FE-Helfer)

**Tests/Gates.** Gezielt `npx vitest run tests/validation/rework-flow-e2e.test.ts` → 1/1 grün (227 ms). `npm run check` grün — **154 Dateien / 935 Tests**. Architektur-Gate (`depcruise --config … services`, wie `tools/check`) sauber; der neue Test liegt unter `tests/` und führt keine Modulgrenzen-Verletzung ein. Keine FE-Datei geändert → FE-tsc unberührt.

**Bewusst nicht umgesetzte Gaps.** Kein vollständiger UI-Render-/Browser-E2E (DOM-frei über Helfer + HTTP geprüft); kein Notifications-/Assignment-Pfad im Smoke (nicht Teil des Nacharbeitsflusses); kein Mehrfach-Reviewer-Szenario (ein warn/down genügt für den Flow); keine neue Architektur/Status, kein Diff/Merge-Viewer.

**Rest-Risiken.** Der Smoke koppelt FE-Feedback-Erkennung an das exakte Backend-Kommentarpräfix — ändert sich `feedbackPrefix`, schlägt der Test fehl (gewollt: er sichert genau diese Kopplung). Der Test importiert sowohl `services/app` (build-app) als auch `apps/web`-Helfer; das ist nur in `tests/` zulässig (außerhalb der `services`-Modulgrenzen-Regel) und bewusst dort verortet.

**Nicht-Ziele eingehalten.** Keine neue Architektur, kein Backend-Datenmodellwechsel, kein neuer Review-Status, kein Diff/Merge-Viewer, keine Fake-Validierung/Auto-Freigabe, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4-Dateien, kein Deployment, keine produktiven Daten, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add tests/validation/rework-flow-e2e.test.ts docs/qm/claude-after-report.md
git commit -m "test(validation): runtime-near E2E smoke for review rework flow (SCRUM-334)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-335 — Beta Capture-Editor bis Validation E2E prüfen und echte Reibung beheben v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Verifikation) · **Status:** geprüft, Flow kohärent, keine Reibung — E2E-Smoke als Regressionssicherung ergänzt, Gates grün

**Vorab-Befund.** Der Beta-Kernflow Capture/Editor → offenes KO → Validation war über viele Einzeltests, aber nicht runtime-nah zusammenhängend abgesichert. Backend-Mechanik bestätigt: `POST /api/kos` ruft `KnowledgeObjectService.create`, das `bodyHtml` per `cleanBody → sanitizeHtml` (services/structure) reinigt und das KO mit `status:"offen"`, `trust:0`, `version:1` anlegt; Sanitizer-Allowlist (SCRUM-314) = `panel/callout/panel-info/panel-note/panel-warning/panel-success`. Validation Board = `GET /api/validation/board` (validation.board). FE-Helfer: `hasBodyBlocks`/`bodyReadMode`/`editorContentQuality` werten sanitisiertes HTML DOM-frei aus; `koOverview` leitet Nutzbarkeit aus dem abgeleiteten Status ab (offen → `needs-work`), `useReadiness` ist kanonisch („ready" nur bei validiert). `git status -sb` sauber (nur untracked Infra-Doc). Vorab per Sanitizer-Probe das exakte Reinigungsergebnis verifiziert.

**Smoke-Evidence (runtime-nah, ECHTE HTTP-Routen + Server-Sanitizer + FE-Helfer).** Neuer Test `tests/structure/capture-to-validation-e2e.test.ts`:
1. Admin registriert/eingeloggt; `POST /api/kos` mit ausführlichem Body: `<h2>` + `<div class="panel panel-info" onclick=… style=…>` + `<div class="evil panel panel-warning">` + `<ul><li>…` + `<script>` + externes `<img src="https://evil/…">`.
2. Antwort: `status:"offen"`, `trust:0`, `version:1` — nicht automatisch validiert.
3. **Sanitizer konsistent:** `bodyHtml` enthält `class="panel panel-info"` und `class="panel panel-warning"`; entfernt sind `evil` (fremde Klasse), `onclick`, `style=`, `<script`, `https://evil` (externes Bild).
4. FE-Anzeige: `hasBodyBlocks` true; `bodyReadMode` = `{hasBody:true, hasBlocks:true}`; `editorContentQuality` → `isEmpty:false, hasBlocks:true, hasHeadings:true, hasLists:true`.
5. Ehrliche Nutzbarkeit: `koOverview.usability === "needs-work"`, `status !== "validiert"`, `trust 0`; `useReadiness(...).usability !== "ready"`; `validationReviewContext.kind === "new"`.
6. KO erscheint im `GET /api/validation/board` mit `status:"offen"` (Review-Arbeit sichtbar).
7. Erste `up`-Bewertung bei `needed=2` → KO bleibt `offen`, weiterhin nicht „ready" (keine Fake-Freigabe).

**Umsetzung.** Keine Produktcode-Änderung nötig — der Capture-to-Validation-Flow ist kohärent: Sanitizer hält erlaubte Blöcke und strippt Unerlaubtes, Status/Trust/Nutzbarkeit sind nicht irreführend, das offene KO ist im Board sichtbar (Scope-Punkt 5: ehrlich dokumentiert, keine erzwungene Änderung). Einziger Zuwachs: der E2E-Smoke als dauerhafte Regressionssicherung.

**Geänderte Dateien.**
- `tests/structure/capture-to-validation-e2e.test.ts` (NEU, E2E-Smoke HTTP + Sanitizer + FE-Helfer)

**Tests/Gates.** Gezielt `npx vitest run tests/structure/capture-to-validation-e2e.test.ts` → 1/1 grün (214 ms). `npm run check` grün — **155 Dateien / 936 Tests**. Architektur-Gate (`depcruise … services`) unberührt; der Test liegt unter `tests/`. Keine FE-Datei geändert → FE-tsc unberührt.

**Bewusst nicht umgesetzte Gaps.** Kein Browser-/Playwright-Render-E2E (DOM-frei über Helfer + HTTP geprüft); kein echter Attachment-Upload-Pfad im Smoke (Body-Block-/Sanitizer-Fokus); kein Mehrfach-Reviewer-/Vollvalidierungs-Durchlauf (eine `up`-Stimme genügt, um „keine Fake-Freigabe" zu zeigen); keine neue Architektur/Editor.

**Rest-Risiken.** Der Smoke koppelt die FE-Block-Erkennung an die exakte Server-Sanitizer-Allowlist (`panel*`); ändert sich eine Seite, schlägt er fehl (gewollt — er sichert genau diese Konsistenz). Test importiert `services/app` + `apps/web` gemeinsam, nur in `tests/` zulässig (außerhalb der `services`-Modulgrenzen-Regel), bewusst dort verortet.

**Nicht-Ziele eingehalten.** Kein neuer Editor, kein neuer Upload-/Attachment-Backendflow, kein Browser-E2E, keine neue Architektur, kein RAG/neue Suche, keine Team-2/3/4-Dateien, kein Deployment, keine produktiven Daten, kein Git/Push/Jira. Nur in `/Users/peterkohnert/Documents/dev_Klarwerk`; untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add tests/structure/capture-to-validation-e2e.test.ts docs/qm/claude-after-report.md
git commit -m "test(structure): runtime-near E2E smoke for capture editor to validation flow (SCRUM-335)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-336 — Beta Review Assignment & Work Ownership v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc, unberührt). Read-only der genannten Helfer/Seiten: Work-Ownership-Signale bestehen für Validation Board UND MyTasks bereits über `reviewWorkView` (`apps/web/src/lib/reviewSignals.ts`, SCRUM-287): ehrliche Zustände `validated/assigned/new/inReview` mit `val.reviewState.*`/`val.reviewHint.*` + tone — kein Assignee-Datenmodell, keine Fake-Verantwortlichkeit. `validationReviewContext` (neu/revidiert) + Review-Fokusfilter + `reviewNextSteps` (verdict-bewusst → `reworkHref`) sind verdrahtet. `knowledgeOsPhase`/`phaseLabelKey` (taskAction.ts) liefern die Kreis-Sprache für Start/MyTasks. Echte verbleibende Lücke = Priorität 3: im `?rework=review`-Kontext fehlte die explizite, geordnete „Was als Nächstes?"-Schrittfolge — der Banner zeigte Hinweis + Feedback + Buttons, aber nicht den zusammenhängenden Ablauf Feedback → Revision → zurück in den Fokus.

**Umsetzung (v0, contained slice, Priorität 3).**
1. **DOM-freier Helfer** `reworkNextSteps()` in `apps/web/src/lib/reviewReworkContext.ts`: geordnete Schritte `feedback → revise → back` (`ReworkStep`/`ReworkStepKey`, `REWORK_STEPS`). Reine Konstante, kein Backend, keine Mutation, keine Auto-Freigabe; ehrliche Formulierung ohne Assignee.
2. **KO-Detail Rework-Banner** (`KnowledgeDetail.tsx`): nur bei `reviewReworkContext && !reworkSaved` eine kompakte nummerierte Schrittliste (`stepsTitle` + 1./2./3.) zwischen Feedback-Card und Buttons. Macht die Nacharbeit als zusammenhängenden Arbeitsfluss sichtbar; bestehende SCRUM-330/331/332/333-Elemente unverändert.
3. **i18n** `ko.rework.stepsTitle` + `ko.rework.step.feedback/revise/back` DE+EN. Schritt 2 nennt ehrlich „neue Version, erneute Prüfung"; Schritt 3 führt in den Validation-Fokus „überarbeitet".
4. **Test** `tests/ko/review-rework-context.test.ts` erweitert: feste Reihenfolge `feedback/revise/back` + labelKeys + Schritt-i18n DE/EN.

Work-Ownership für Start/MyTasks/Validation bleibt bewusst auf den bestehenden, ehrlichen `reviewWorkView`-Signalen (SCRUM-287) — kein neues Task-/Rollen-/Notification-System, keine Doppelung.

**Geänderte Dateien.**
- `apps/web/src/lib/reviewReworkContext.ts` (reworkNextSteps + Typen)
- `apps/web/src/pages/KnowledgeDetail.tsx` (nummerierte Schrittfolge im Rework-Banner + Import)
- `apps/web/src/i18n.ts` (`ko.rework.stepsTitle` + `step.*` DE+EN)
- `tests/ko/review-rework-context.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **155 Dateien / 938 Tests**. Gezielt `tests/ko/review-rework-context.test.ts` → 10/10 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Bewusst nicht umgesetzte Gaps.** Kein Assignee-/Ownership-Datenmodell (ehrlich „Nächster Arbeitsschritt"/„Review-Arbeit"/„Nacharbeit" statt „zugewiesen an X"). Keine zusätzliche Start/MyTasks-Politur (Work-State dort schon über reviewWorkView). Kein neues Rollen-/Notification-System, kein Backend, kein Capture-Success-Wording-Eingriff (risikoarm, aber nicht nötig — Validierung bleibt primary).

**Rest-Risiken.** Die Schrittfolge ist statisch (immer 3 Schritte im Rework-Kontext) — sie beschreibt den Ablauf, nicht den individuellen Fortschritt (kein Abhaken); bewusst, um keine Fake-Ownership/State zu behaupten. Konsistenz mit `reworkValidationHref` (Schritt 3 ↔ Rückweg-CTA) ist sprachlich, nicht erzwungen verlinkt.

**Nicht-Ziele eingehalten.** Kein neues Rollen-/Notification-System, keine Architektur-/Backend-Datenmodelländerung, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4/5-Dateien, kein Demo-Hack/Demo-only, kein Deployment, keine produktiven Daten, kein Git/Push/Jira. Untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/reviewReworkContext.ts apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/ko/review-rework-context.test.ts docs/qm/claude-after-report.md
git commit -m "feat(ko-detail): show ordered rework next-steps to clarify work ownership (SCRUM-336)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-338 — Beta Own-Knowledge Work Queue v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc, unberührt). Read-only: `captureSuccess.captureNextSteps` führt bereits nach `/wissen/:id`, `libraryOriginHref("non-demo")` und `validationOriginHref("non-demo")` (Validierung primary); `captureSavedStatus` liefert „offen — noch nicht validiert". `demoKnowledge.ts` kapselt die Herkunftserkennung (DEMO_TAG `pilot-demo`) inkl. Filter/Counts/Labels/Deep-Links; `lib.demoFilter.nonDemo` = „Eigenes Wissen". Validation- und Library-Board nutzen die geteilten Herkunfts-Helfer. Echte Lücke: filtert ein Beta-Nutzer auf „Eigenes Wissen" (origin=non-demo) und es existiert (noch) keins, zeigt weder Library noch Validation eine Orientierung zurück ins Erfassen — die Liste ist stumm leer. Außerdem nannte die Capture-Success-Card das gespeicherte KO nicht ausdrücklich als „eigenes Wissen".

**Umsetzung (v0, contained slice, 3 Stellen).**
1. **DOM-freier Helfer** `ownKnowledgeEmptyHint({ filter, count })` in `apps/web/src/lib/demoKnowledge.ts` (+ `OWN_KNOWLEDGE_FILTER`, `OwnKnowledgeEmptyHint`): liefert NUR bei aktiver „non-demo"-Linse UND `count === 0` einen Hinweis (`own.empty.title/hint/cta`, Ziel `/erfassen`), sonst `null`. Keine Fake-Zahlen, keine Ownership-Behauptung, kein Backend.
2. **Library** (`Library.tsx`): bei „Eigenes Wissen" ohne eigene Treffer (`demoCounts["non-demo"] === 0`) eine kompakte Hinweis-Card mit CTA „Eigenes Wissen erfassen" → `/erfassen`.
3. **Validation Board** (`Validation.tsx`): analog im gefilterten Leerzustand, wenn die „non-demo"-Linse aktiv und 0 eigene KOs vorhanden sind.
4. **Capture-Success** (i18n `capture.savedBody`): sprachlich geschärft — „Gespeichert als dein eigenes Wissen (kein Demo-Beispiel), aber noch nicht validiert …". Validierung bleibt primary (unverändert).
5. **i18n** `own.empty.title/hint/cta` DE+EN; `capture.savedBody` DE+EN aktualisiert.
6. **Test** `tests/app/demo-knowledge.test.ts` erweitert: Hinweis nur bei non-demo & count 0; `null` bei vorhandenem Eigenwissen / „all" / „demo"; `own.empty.*`-i18n DE+EN.

Start/MyTasks bewusst nicht angefasst — die vorhandenen Work-Center-/Phasen-Helfer decken die Arbeitsorientierung dort bereits ehrlich ab; eine zusätzliche „eigenes Wissen"-Zahl ohne Author-Datenmodell wäre Fake-Ownership.

**Geänderte Dateien.**
- `apps/web/src/lib/demoKnowledge.ts` (ownKnowledgeEmptyHint + Typen/Konstante)
- `apps/web/src/pages/Library.tsx` (Eigenwissen-Leerzustand-Card + Import)
- `apps/web/src/pages/Validation.tsx` (Eigenwissen-Leerzustand-Card + Import)
- `apps/web/src/i18n.ts` (`own.empty.*` DE+EN; `capture.savedBody` DE+EN geschärft)
- `tests/app/demo-knowledge.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **155 Dateien / 941 Tests**. Gezielt `tests/app/demo-knowledge.test.ts` → 21/21 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Bewusst nicht umgesetzte Gaps.** Kein User-/Author-/Ownership-Datenmodell (keine echte „von mir erfasst"-Zuordnung — die „non-demo"-Linse ist Herkunft, nicht Urheberschaft). Keine Start/MyTasks-Eigenwissen-Zähler (würden Fake-Ownership behaupten). Kein Assignee-/Notification-System, kein Backend-/Serverfilter. KO-Detail (Priorität 4) nicht zusätzlich angefasst — useReadiness/koOverview kommunizieren „needs-work/offen" bereits ehrlich (siehe SCRUM-335-Smoke).

**Rest-Risiken.** Der Eigenwissen-Leerzustand stützt sich auf die Herkunftserkennung über `DEMO_TAG`: produktiv erfasste KOs tragen den Tag nie, also ist „non-demo" = eigenes/produktives Wissen — korrekt, solange der Demo-Seed der einzige Tag-Setzer bleibt (unverändert). Die Hinweis-Card erscheint auch, wenn andere fachliche Filter die Liste leeren, aber die non-demo-Linse aktiv ist und 0 eigene KOs existieren — gewollt (der Weg ins Erfassen bleibt der richtige nächste Schritt).

**Nicht-Ziele eingehalten.** Kein User-/Author-/Ownership-Datenmodell, kein Assignee-System, keine Notifications, kein Backend-Datenmodellwechsel, kein RAG/neue Suche/Local-LLM, keine Team-2/3/4/5-Dateien, kein Demo-Hack/Demo-only-Politur, kein Deployment, keine produktiven Daten. `pilot-demo`-Markierung + origin-Filter unverändert kompatibel. Untracked Infra-Doc unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/demoKnowledge.ts apps/web/src/pages/Library.tsx apps/web/src/pages/Validation.tsx apps/web/src/i18n.ts tests/app/demo-knowledge.test.ts docs/qm/claude-after-report.md
git commit -m "feat(own-knowledge): empty-state guidance back to capture + sharpen own-knowledge wording (Own-Knowledge Work Queue v0)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-337 — Beta Knowledge Input Studio / Fullscreen AI Editing v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund / Repo-Stand.** `git status -sb`: auf `main`, uncommitted Änderungen vorhanden (i18n.ts, demoKnowledge.ts, Library.tsx, Validation.tsx, tests/app/demo-knowledge.test.ts, docs/qm/claude-after-report.md — der noch nicht committete „Own-Knowledge Work Queue"-Slice) plus untracked Infra-Doc. KEIN Konflikt mit SCRUM-337 (andere Dateien); bestehende Änderungen respektiert, nichts überschrieben; Infra-Doc unberührt.

**Legacy-Pfad geprüft / nicht verfügbar.** Verfügbar (read-only): `Klarwerk/app/src/components/WikiEditor.jsx`, `Klarwerk/demo/src/components/WikiEditor.jsx`, `Klarwerk/demo/src/components/AiAssist.jsx`, `Klarwerk/app/src/pages/TeacherStudio.jsx`. (CaseEditor.jsx an den genannten Pfaden nicht zwingend vorhanden — Studio-Logik steckt in WikiEditor/TeacherStudio.) Nur analysiert, NICHT kopiert.

**Wichtigste alte Funktionen.** Großer WikiEditor-Arbeitsraum; Toolbar H2/H3/Absatz, Bold/Italic, Listen, Link, Bild, Datei; Blöcke Info/Hinweis/Warnung/Erfolg (`cf-info/note/warning/success`); KI-Schaltfläche direkt im Editor; KI-Aktionen Klarer/Strukturieren/Erweitern/Rechtschreibung; freies KI-Anweisungsfeld; Ergebnisvorschau + Übernehmen/Einfügen/Verwerfen; Bild/Datei-Import per Button/Drag&Drop/Paste (inline, 8 MB).

**Aktuelle Gaps (vor diesem Slice).** Die neue App hatte alle Bausteine (RichTextEditor mit H2/H3, Bold/Italic, Listen, Link, Bild + 4 Block-Buttons; AiAssistBox mit Aktionen/Anweisung/Vorschau/Ersetzen-Anhängen + Block-Übernahme; EditorGuidance/AttachmentContext/ContentQuality/BodyTemplateChooser), aber verteilt und formularartig unter dem Body-Feld — kein großer „Studio"-Arbeitsraum, KI-Hilfe optisch nachrangig.

**Umsetzter Umfang.**
1. **Neue Komponente** `apps/web/src/components/KnowledgeInputStudio.tsx`: Fullscreen-Overlay (`fixed inset-0 z-50`), Kopf/Arbeitsfläche/Fuß. Arbeitet auf einem internen `draft` (beim Öffnen aus `bodyHtml` initialisiert) und schreibt NUR bei „In den Entwurf übernehmen" via `onApply` zurück. Bündelt auf großer Fläche: EditorGuidance, EditorAttachmentContext, EditorContentQuality, BodyTemplateChooser, großer RichTextEditor und die AiAssistBox (Klarer/Strukturieren/Erweitern/Rechtschreibung + freies Anweisungsfeld + Vorschau Ersetzen/Anhängen/Verwerfen + Übernahme als Info/Hinweis/Warnung/Erfolg-Block). Kein Auto-Save, keine Auto-Validierung, kein Backend, keine neue Editor-Library.
2. **Geteilter Helfer** `bodyAssistBlockActions(bodyHtml)` in `bodyAiAssist.ts` (DOM-frei): die vier Block-Übernahme-Aktionen, vom Studio genutzt (Capture/KO-Detail behalten ihre bestehende, identische Inline-Variante).
3. **Einstiegspunkte:** Capture (Button „Im Knowledge Studio bearbeiten" mit Sparkles oben am Body-Feld; Studio auf `bodyHtml`/`setBodyHtml`) und KO-Detail-Edit (gleicher Button im Body-Feld; Studio auf `edit.bodyHtml`). Inline-Feld bleibt darunter erhalten; bestehende Save/Submit/Revise-Flows unverändert.
4. **i18n** `studio.open/title/subtitle/apply/cancel/close` DE+EN.
5. **Tests** `tests/app/body-ai-assist.test.ts` erweitert: `bodyAssistBlockActions` (vier labelKeys + Append-Verhalten) + Studio-i18n DE/EN.

**Bewusst nicht umgesetzte Gaps.** Kein vollständiger Legacy-Nachbau; kein eigener Datei-/Bild-Upload im Studio (Anhänge/Bilder werden über die bestehenden Capture/KO-Detail-Flows bereitgestellt und als Kontext/Palette gereicht — Dateien bleiben Anhänge/Evidence); kein Drag&Drop/Paste-Import im Overlay; kein Auto-Save/Auto-Validate; keine neue Editor-Library; kein Backend. Capture-Variante des Body-Felds nicht auf den geteilten Helfer umgestellt (Scope-Schonung; Verhalten identisch).

**Geänderte Dateien.**
- `apps/web/src/components/KnowledgeInputStudio.tsx` (NEU)
- `apps/web/src/lib/bodyAiAssist.ts` (bodyAssistBlockActions + Typ)
- `apps/web/src/pages/Capture.tsx` (Studio-State + Einstiegsbutton + Mount)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Studio-State + Einstiegsbutton + Mount im Edit)
- `apps/web/src/i18n.ts` (`studio.*` DE+EN)
- `tests/app/body-ai-assist.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **155 Dateien / 944 Tests**. Gezielt `tests/app/body-ai-assist.test.ts` → 15/15 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Das Studio teilt sich `bodyHtml` mit dem Inline-Feld: gleichzeitige Änderungen im Inline-Feld bei offenem Studio werden beim „Übernehmen" durch den Studio-Draft überschrieben (Draft beim Öffnen gesetzt) — bewusst, der Studio ist die fokussierte Arbeitsfläche. Reines Composition-Overlay ohne eigene Logik außer Draft/Confirm; der testbare Kern (Block-Aktionen) ist DOM-frei abgesichert, die reine UI-Komposition nicht per Browser-E2E (projektüblich nicht erzwungen).

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).** Hinweis: die unten gelisteten Dateien enthalten teils auch den noch nicht committeten „Own-Knowledge"-Slice (i18n.ts) — Codex trennt/committet nach Diff-Prüfung.
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/components/KnowledgeInputStudio.tsx apps/web/src/lib/bodyAiAssist.ts apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/body-ai-assist.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): Knowledge Input Studio — large AI-assisted editing overlay for Capture and KO detail (SCRUM-337)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-339 — Beta Knowledge Studio Safety & Apply Feedback v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc — Codex hatte SCRUM-337 + Own-Knowledge bereits committet). `KnowledgeInputStudio.tsx` (SCRUM-337) arbeitet auf internem `draft`, schrieb aber Schließen/Verwerfen unmittelbar (still) und zeigte keinen Dirty-Status; nach Übernahme gab es kein Feedback auf der Seite. Bereits vorhanden: `editorApplySafety.ts` (SCRUM-320, `hasEditableContent`/`shouldWarnBeforeReplace`/`templateApplyMode`) + `tests/app/editor-apply-safety.test.ts` — der natürliche Ort für den neuen Studio-Zustandshelfer.

**Umsetzung (FE-only, contained).**
1. **DOM-freier Helfer** `knowledgeStudioState(draft, applied)` in `editorApplySafety.ts`: `dirty = draft !== applied` + `statusKey` (`studio.state.dirty`/`.clean`) + `tone` (warn/neutral).
2. **Dirty-Status sichtbar** im Studio-Header als Badge („Nicht übernommen" warn / „Keine Studio-Änderungen" neutral).
3. **Discard-Schutz:** Schließen/Verwerfen geht über `requestClose()` — bei `dirty` erscheint eine **Inline-Bestätigung** in der Fußzeile („Nicht übernommene Änderungen verwerfen?" + „Weiter bearbeiten"/„Verwerfen"), kein `confirm()`. Ohne Änderungen schließt es direkt. Apply bleibt bewusst (`onApply(draft)` → schließen). Beim Öffnen werden Draft + Confirm-State zurückgesetzt.
4. **Apply-Feedback** in Capture und KO-Detail-Edit: `studioApplied`-State, im `onApply`-Wrapper gesetzt, beim Öffnen des Studios zurückgesetzt; rendert einen kurzen grünen Hinweis `studio.applied` („… in den Entwurf übernommen. Speichern/Revision erfolgt erst über den bestehenden Button — nichts wird automatisch gespeichert oder validiert."). Save/Submit/Revise unverändert.
5. **i18n** `studio.state.*`, `studio.confirmDiscard.*`, `studio.applied` DE+EN (ehrlich: kein Auto-Save/Validate).
6. **Tests** `tests/app/editor-apply-safety.test.ts` erweitert: `knowledgeStudioState` dirty/clean, Studio-Safety-i18n DE/EN, Ehrlichkeits-Check `studio.applied`.

**Geänderte Dateien.**
- `apps/web/src/lib/editorApplySafety.ts` (knowledgeStudioState + Typ)
- `apps/web/src/components/KnowledgeInputStudio.tsx` (Dirty-Badge + requestClose + Inline-Discard-Confirm)
- `apps/web/src/pages/Capture.tsx` (studioApplied + Apply-Feedback-Banner)
- `apps/web/src/pages/KnowledgeDetail.tsx` (studioApplied + Apply-Feedback-Banner)
- `apps/web/src/i18n.ts` (`studio.state/confirmDiscard/applied` DE+EN)
- `tests/app/editor-apply-safety.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **155 Dateien / 948 Tests**. Gezielt `tests/app/editor-apply-safety.test.ts` → 8/8 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Bewusst nicht umgesetzt.** Kein `beforeunload`/Routenwechsel-Schutz (nur Studio-eigener Schließen/Verwerfen-Pfad); kein Auto-Dismiss/Timer für das Apply-Feedback (verschwindet beim nächsten Studio-Öffnen); keine Persistenz/Autosave; kein Backend; kein neues Datenmodell.

**Rest-Risiken.** Das Apply-Feedback bleibt sichtbar, bis der Studio erneut geöffnet wird — bewusst, da es den letzten Studio-Apply widerspiegelt (kein Live-Diff zum aktuellen Body). Der Dirty-Vergleich ist String-genau (`draft !== bodyHtml`); reine Whitespace-/Reihenfolgeunterschiede im sanitisierten HTML würden als „dirty" gelten — akzeptabel, da konservativ (schützt eher zu viel als zu wenig).

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorApplySafety.ts apps/web/src/components/KnowledgeInputStudio.tsx apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/editor-apply-safety.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): studio dirty-state, discard guard and apply feedback (SCRUM-339)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-340 — Beta Knowledge Studio Draft-to-Article v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Legacy-Pfad geprüft / nicht verfügbar.** Verfügbar (read-only): `Klarwerk/app/src/components/{WikiEditor,AiAssist,CaseEditor}.jsx`, `Klarwerk/app/src/pages/TeacherStudio.jsx` + die Demo-Pendants. Nur analysiert, nicht kopiert. Wichtigste alte Funktionen: großer WikiEditor-Arbeitsraum, KI-Aktionen, Panels (Info/Hinweis/Warnung/Erfolg), CaseEditor/TeacherStudio als Editier-/Strukturierungsraum.

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337/339 + Own-Knowledge committet). Nach dem Reasoner-/Structure-Draft blieb `bodyHtml` im Capture-Flow oft leer; Nutzer sahen weiter die Formularfelder (Titel/Aussage/Bedingungen/Maßnahmen) ohne strukturierten Artikel. Vorhandene Bausteine: `StructureResult` (title/statement/conditions/measures/tags/…), `bodyTemplates.ts` (Set/Append via `applyBodyTemplate`, statisches HTML durch `sanitizeHtml`), `editorBlocks.editorBlockClass`, `richText.sanitizeHtml/isEmptyHtml`. KnowledgeInputStudio + Safety (SCRUM-337/339) intakt.

**Umsetzter Umfang.**
1. **DOM-freier Helfer** `apps/web/src/lib/captureDraftArticle.ts`: `draftArticleHtml(input, locale)` erzeugt aus Statement/Bedingungen/Maßnahmen/Tags ein sicheres Body-HTML: `<h2>Kernaussage</h2>` + Info-Block (`editorBlockClass("info")`) für die Aussage, `<h3>` + `<ul>` für Bedingungen/Maßnahmen, `<h3>Kontext</h3>` + Tags. Leere Felder werden ausgelassen (leerer Entwurf → `""`). Lokalisierte Überschriften (de/en) wie bei bodyTemplates. Nutzereingaben werden NICHT roh übernommen: das komplette Fragment läuft EINMAL durch `sanitizeHtml` (entfernt Skripte/Eventhandler/externe Bilder, escapt Sonderzeichen — kein Doppel-Escaping). `applyDraftArticle(currentHtml, input, locale)` spiegelt das Set/Append-Verhalten von `applyBodyTemplate`: leer → setzen, sonst NICHT-destruktiv anhängen. Der Titel ist das separate KO-Feld und wird bewusst nicht in den Body dupliziert.
2. **Capture-UI:** im `draft`-Block eine sichtbare primäre CTA „Entwurf als Artikel im Studio strukturieren" (Sparkles) + sekundär „Im Knowledge Studio bearbeiten". Klick erzeugt/ergänzt `bodyHtml` via `applyDraftArticle(prev, draft, …)` (nicht-destruktiv) und öffnet direkt den KnowledgeInputStudio; kurzer Hinweis „aus Draft erzeugt, bitte prüfen, nicht automatisch validiert". Bestehende Komponenten (Studio, BodyTemplateChooser, AiAssistBox, EditorContentQuality/AttachmentContext) + Save/Submit/Validation-Flow unverändert.
3. **i18n** `studio.fromDraft.cta`/`hint` DE+EN (ehrlich: Vorschlag, anhängen statt überschreiben, nichts automatisch validiert).
4. **Tests** `tests/app/capture-draft-article.test.ts` (NEU, DOM-frei): H2/H3/Listen aus statement/conditions/measures; englische Überschriften; leere Felder ausgelassen + leerer Entwurf → `""`; Tags als Kontext; Sanitisierung gefährlicher Eingaben (kein Skript/Eventhandler, einmaliges Escaping); `applyDraftArticle` set/append + nicht-destruktiv; `normalizeDraftArticleLocale`; CTA-i18n DE/EN + Ehrlichkeit.

**Bewusst nicht umgesetzt.** Kein Cursor-Insert; kein vollständiger Legacy-WikiEditor-Nachbau; keine Bild-/Datei-Parität; keine neue KI-Architektur; keine automatische Validierung; kein Titel-Duplikat im Body; KO-Detail-Edit nicht um die Draft-Artikel-CTA erweitert (dort gibt es keinen frischen Reasoner-Draft — Fokus auf Capture).

**Geänderte Dateien.**
- `apps/web/src/lib/captureDraftArticle.ts` (NEU)
- `apps/web/src/pages/Capture.tsx` (CTA + Hinweis + Studio-Öffnung, nicht-destruktiv)
- `apps/web/src/i18n.ts` (`studio.fromDraft.*` DE+EN)
- `tests/app/capture-draft-article.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **156 Dateien / 957 Tests**. Gezielt `tests/app/capture-draft-article.test.ts` → 9/9 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** `sanitizeHtml` ENTFERNT gefährliche Tags (Skript/externe Bilder) ganz statt sie als sichtbaren Text zu escapen — für einen Plaintext-Entwurf erwünscht, könnte aber selten beabsichtigte spitze Klammern aus dem Statement entfernen (akzeptabel, konservativ). Append-Modus kann bei wiederholtem Klick denselben Artikel mehrfach anhängen — bewusst nicht-destruktiv; der Dirty-/Safety-Flow (SCRUM-339) + Studio-Bearbeitung fangen das ab.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/captureDraftArticle.ts apps/web/src/pages/Capture.tsx apps/web/src/i18n.ts tests/app/capture-draft-article.test.ts docs/qm/claude-after-report.md
git commit -m "feat(capture): generate a structured article from the draft and open it in the studio (SCRUM-340)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-341 — Beta Knowledge Studio Workspace Layout v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Legacy-Pfad geprüft / nicht verfügbar.** Verfügbar (read-only): `Klarwerk/app/src/pages/TeacherStudio.jsx` (+ WikiEditor/AiAssist/CaseEditor, demo-Pendants). Nur analysiert, nicht kopiert. Wichtigste alte Funktionen: großer Arbeitsraum mit mehrspaltigem `grid-2`-Layout, eigener KI-/Assist-Spalte (`AiAssist`) und Strukturierung — der Editor war sichtbar der Hauptbereich, nicht eine Formularliste.

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337/339/340 committet). Das KnowledgeInputStudio bündelte alle Bausteine, aber rein linear (Guidance → Anhänge → Qualität → Templates → Editor → KI) in einer schmalen `max-w-4xl`-Spalte — funktional, aber noch listenartig, kein klarer Arbeitsraum.

**Umsetzter Umfang.**
1. **DOM-freier Helfer** `apps/web/src/lib/knowledgeStudioLayout.ts`: drei stabile Bereiche `context/editor/assist` (`KNOWLEDGE_STUDIO_SECTIONS`, `knowledgeStudioSectionLabelKey`) als gemeinsame Quelle für Komponente + Tests.
2. **Studio-Layout** (`KnowledgeInputStudio.tsx`): die Arbeitsfläche ist nun ein responsives 3-Spalten-Grid (`max-w-6xl`, `lg:grid-cols-[17rem_minmax(0,1fr)_19rem]`):
   - **Links „Struktur & Kontext":** EditorGuidance, EditorAttachmentContext, EditorContentQuality, BodyTemplateChooser.
   - **Mitte „Inhalt bearbeiten":** RichTextEditor in einer klaren Card mit mehr vertikaler Fläche (`min-h-[55vh]`) — sichtbar der Hauptarbeitsbereich.
   - **Rechts „KI-Hilfe":** AiAssistBox direkt sichtbar.
   Auf schmalen Viewports stapelt das Grid (`grid-cols-1`) sinnvoll. Jeder Bereich trägt ein kompaktes Bereichslabel (mono/uppercase, aus dem Helfer + i18n).
3. **i18n** `studio.section.context/editor/assist` DE+EN.
4. **Safety/Verhalten unverändert:** Header mit Dirty-Badge, Close/Cancel-Discard-Guard (SCRUM-339), Apply (bewusste Übernahme + Schließen), Capture-/KO-Detail-Apply-Feedback — alles intakt. Keine neue Editor-API, kein Cursor-Insert, keine neuen Blocktypen, keine Prop-Änderung (Capture/KO-Detail nutzen die Komponente unverändert).
5. **Tests** `tests/app/knowledge-studio-layout.test.ts` (NEU, DOM-frei): drei Bereiche + Reihenfolge, stabile labelKeys, Bereichs-i18n DE+EN. Bestehende `editor-apply-safety`/`body-templates`/`editor-content-quality`-Tests bleiben grün.

**Bewusst nicht umgesetzte Gaps.** Kein vollständiger Legacy-WikiEditor-Nachbau; kein Drag-and-drop-Layout; kein Split-Pane mit persistenter Größe; kein Cursor-Insert; keine neue Editor-Library; keine Backend-/Reasoner-Änderung; keine automatische Validierung. Die Spaltenbreiten sind feste Tailwind-Werte (kein Resizing).

**Geänderte Dateien.**
- `apps/web/src/lib/knowledgeStudioLayout.ts` (NEU)
- `apps/web/src/components/KnowledgeInputStudio.tsx` (3-Spalten-Workspace + Bereichslabels)
- `apps/web/src/i18n.ts` (`studio.section.*` DE+EN)
- `tests/app/knowledge-studio-layout.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **157 Dateien / 960 Tests**. Gezielt `knowledge-studio-layout` + `editor-apply-safety` + `body-templates` + `editor-content-quality` → 26/26 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Reine Layout-/Markup-Änderung — Editor-, Safety- und Apply-Logik unberührt; das responsive Verhalten ist nicht per Browser-Snapshot geprüft (projektüblich DOM-frei via Helfer/i18n abgesichert). Bei sehr schmalen Editorinhalten kann `min-h-[55vh]` viel Leerraum zeigen — bewusst, um die Editorfläche als Hauptbereich zu betonen.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/knowledgeStudioLayout.ts apps/web/src/components/KnowledgeInputStudio.tsx apps/web/src/i18n.ts tests/app/knowledge-studio-layout.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): structure Knowledge Studio as workspace layout (SCRUM-341)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-342 — Beta Knowledge Studio Template Preview & Apply v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Legacy-Pfad geprüft / nicht verfügbar.** Verfügbar (read-only): `Klarwerk/app/src/components/WikiEditor.jsx` (+ AiAssist/CaseEditor/TeacherStudio, demo-Pendants). Nur analysiert, nicht kopiert. Wichtigste alte Funktionen: WikiEditor mit Sofort-Insert von Snippets/Panels (`insertHTML`/`insertPanel`) per Cursor — also eher Direkt-Einfügen als bewusste Vorschau-Auswahl.

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337/339/340/341 committet). `BodyTemplateChooser` wendete die Vorlage bisher SOFORT beim Klick an (`onApply(applyBodyTemplate(...))`) — kleine Sofort-Buttons, kein Vorschau-/Auswahl-Arbeitsmodus. Vorhanden: `bodyTemplates.bodyTemplateHtml`/`applyBodyTemplate` (sanitisiert, Set/Append), `editorApplySafety.templateApplyMode`/`templateApplyModeHintKey`, `SanitizedHtml`-Komponente (einziger Ort mit dangerouslySetInnerHTML, allowlist-sanitisiert).

**Umsetzter Umfang.**
1. **BodyTemplateChooser → Preview-&-Apply** (`BodyTemplateChooser.tsx`): lokaler `selected`-State (Default = erste Vorlage „Vorgehen"). Klick auf eine Vorlage WÄHLT sie aus (aktiver Chip hervorgehoben, `aria-pressed`), wendet sie NICHT mehr sofort an. Darunter Beschreibung der ausgewählten Vorlage, eine **Vorschau** über `SanitizedHtml html={bodyTemplateHtml(selected, locale)}` (nur sichere Template-Konstanten, scrollbar/`max-h-56`, `.prose-kw`), der Set/Append-Hinweis (`templateApplyModeHintKey(templateApplyMode(bodyHtml))`) und ein eigener Button **„Vorlage übernehmen"** → `onApply(applyBodyTemplate(bodyHtml, selected, locale))`. Kein stilles Überschreiben (leer → setzen, sonst anhängen) — Verhalten unverändert.
2. **i18n** `editor.template.selected`/`preview`/`apply` DE+EN; `editor.template.hint` ehrlicher geschärft (Auswahl→Vorschau→bewusst übernehmen; Startstruktur/Vorschlag; bei Append nicht ersetzt; nichts automatisch gespeichert/validiert).
3. **Tests** `tests/app/body-templates.test.ts` erweitert: jede Vorlage liefert nicht-leere, sanitisierte Vorschau (DE+EN, kein on*-Handler/Skript); Preview-&-Apply-i18n DE+EN + Ehrlichkeit. Bestehende `bodyTemplateHtml`-Sanitize- und `applyBodyTemplate`-Set/Append-Tests bleiben grün.

Das Studio (SCRUM-341) profitiert direkt, da der BodyTemplateChooser in der Kontext-Spalte eingebettet ist; Capture/KO-Detail nutzen die Komponente unverändert über `bodyHtml`/`onApply` (keine Prop-Änderung).

**Bewusst nicht umgesetzte Gaps.** Kein Template-Editor, keine User-Templates, kein Persistieren der zuletzt gewählten Vorlage (Default beim Mount), kein Cursor-Insert, kein Drag&Drop, kein Legacy-Nachbau, keine Backend-/Reasoner-Änderung, keine automatische Validierung. Kein separater Helfer angelegt (die Logik `bodyTemplateHtml`/`applyBodyTemplate`/`templateApplyMode` ist bereits getestet; reine Auswahl-State-UI).

**Geänderte Dateien.**
- `apps/web/src/components/BodyTemplateChooser.tsx` (Preview-&-Apply-Fluss)
- `apps/web/src/i18n.ts` (`editor.template.selected/preview/apply` DE+EN; `hint` geschärft)
- `tests/app/body-templates.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **157 Dateien / 962 Tests**. Gezielt `body-templates` + `editor-apply-safety` + `knowledge-studio-layout` → 18/18 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Die Vorschau rendert über `SanitizedHtml` (allowlist-sanitisiert) ausschließlich statische Template-Konstanten — kein User-HTML, keine neue dangerouslySetInnerHTML-Stelle. Reine UI-/State-Änderung; das Set/Append-Verhalten ist unverändert und durch bestehende Tests gedeckt. Der Default-Select setzt beim erneuten Mount auf die erste Vorlage zurück (bewusst, kein Persistieren).

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/components/BodyTemplateChooser.tsx apps/web/src/i18n.ts tests/app/body-templates.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): template preview and conscious apply in Knowledge Studio (SCRUM-342)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-343 — Beta Knowledge Studio AI Insert Modes v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–342 committet). Die AiAssistBox bot bisher Ersetzen/Anhängen (Plaintext) + via `extraApplyActions` die vier Body-Blöcke (Info/Hinweis/Warnung/Erfolg), im Studio über `bodyAssistBlockActions(draft)`. Die strukturierten Modi standen als flache Knopfreihe ohne Gruppen-Label; ein „als Abschnitt"-Modus (Überschrift + Absätze) fehlte. `bodyAiAssist.ts` hat bereits sichere Bausteine (`escapeBodyText`, `escapedParagraphs`, `editorBlockClass`).

**Legacy-Pfad geprüft / nicht verfügbar.** Verfügbar (read-only): `Klarwerk/app/src/components/{WikiEditor,AiAssist,CaseEditor}.jsx`, `TeacherStudio.jsx`. Nur gelesen. Relevant: der Legacy-AiAssist fügte das KI-Ergebnis per `insertHTML` an der Cursorposition ein (Cursor-Insert) — bewusst NICHT übernommen (Nicht-Ziel); stattdessen modusbasierte, sichere Übernahme.

**Aktuelle Gap.** Die KI-Übernahme fühlte sich noch nach „nur ersetzen/anhängen" an; es fehlte ein klar gegliederter, editor-naher Einfügemodus „als strukturierter Abschnitt".

**Umsetzter Umfang.**
1. **DOM-freie Helfer** in `apps/web/src/lib/bodyAiAssist.ts`:
   - `suggestionToBodySectionHtml(text)` — erste nicht-leere Zeile → `<h3>`, Rest → sichere `<p>`-Absätze; Text wird escaped, nur statische `<h3>/<p>/<br>`; leer → `""`.
   - `applyBodyAssistSection(currentHtml, suggestionText)` — nicht-destruktiv anhängen (leerer Body → setzen); leerer Vorschlag = No-Op; bestehender Body wird nicht erneut escaped.
   - `bodyAssistSectionAction(currentHtml)` (gleiche Form wie Block-Aktionen) + `bodyAssistStructuredActions(currentHtml)` = `[Abschnitt, …vier Blöcke]`.
2. **KnowledgeInputStudio** nutzt jetzt `bodyAssistStructuredActions(draft)` statt `bodyAssistBlockActions(draft)` → die KI-Vorschau zeigt im Studio: Ersetzen / Anhängen / Verwerfen + (gruppiert) als Abschnitt / als Info / Hinweis / Warnung / Erfolg.
3. **AiAssistBox**: die `extraApplyActions`-Reihe bekommt eine kleine Gruppen-Überschrift „Als Struktur übernehmen" (`capture.ai.applyAsLabel`), damit die strukturierten Einfügemodi klar gruppiert und verständlicher sind. Vorschau, Ersetzen/Anhängen/Verwerfen, Dirty-/Discard-/Apply-Flows unverändert; Mensch entscheidet bewusst; keine Auto-Speicherung/-Validierung.
4. **i18n** `capture.ai.applyAsLabel` + `capture.ai.applyAs.section` DE+EN.
5. **Tests** `tests/app/body-ai-assist.test.ts` erweitert: Section-HTML (Heading+Absätze, Escaping gefährlicher Eingaben, leer→""), `applyBodyAssistSection` (set/append/No-Op), `bodyAssistStructuredActions` Reihenfolge + Apply, i18n DE+EN. Bestehende Block-/Replace-/Append-Tests bleiben grün.

Capture/KO-Detail behalten ihren bestehenden Inline-Body-AI (4 Block-Buttons) unverändert — der neue Abschnitt-Modus ist im großen Studio integriert, wo der Ticket-Fokus liegt.

**Bewusst nicht umgesetzte Gaps.** Kein Cursor-genauer Insert; kein Drag&Drop; kein Diff/Merge; kein Backend/Reasoner-Change; keine neue Editor-Library; keine Auto-Validierung/-Speicherung; Capture/KO-Detail-Inline-AI nicht umgestellt (Scope-Schonung).

**Geänderte Dateien.**
- `apps/web/src/lib/bodyAiAssist.ts` (Section-Helfer + structured actions)
- `apps/web/src/components/KnowledgeInputStudio.tsx` (structured actions)
- `apps/web/src/components/AiAssistBox.tsx` (gruppierte Übernahme-Label-Zeile)
- `apps/web/src/i18n.ts` (`capture.ai.applyAsLabel` + `applyAs.section` DE+EN)
- `tests/app/body-ai-assist.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **157 Dateien / 967 Tests**. Gezielt `tests/app/body-ai-assist.test.ts` → 20/20 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Der Abschnitt-Modus erzeugt nur statische, escapte Tags — kein User-HTML, keine neue XSS-Fläche; bestehender Body bleibt unverändert (nur Anhängen). Die Überschrift wird aus der ersten Zeile des KI-Plaintexts abgeleitet — bei sehr langer erster Zeile entsteht eine lange `<h3>` (akzeptabel; der Mensch prüft die Vorschau vor der Übernahme). Reine FE-/Helfer-Änderung; AiAssistBox-Mechanik (Vorschau/Discard) unberührt.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/bodyAiAssist.ts apps/web/src/components/KnowledgeInputStudio.tsx apps/web/src/components/AiAssistBox.tsx apps/web/src/i18n.ts tests/app/body-ai-assist.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): AI insert modes — apply suggestion as a structured section in Knowledge Studio (SCRUM-343)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-344 — Beta Knowledge Studio Save Confidence v0
**Datum:** 2026-06-29 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–343 committet). Studio hat Dirty-State/Discard-Guard/Apply-Feedback (`studio.applied` nahe dem Body-Feld). Capture-Success macht nach dem Speichern bereits ehrlich klar „offen/nicht validiert". `editorApplySafety.ts` ist der etablierte Ort für DOM-freie Übernahme-/Safety-Helfer; `KoRevisionSummary` + `ko.editNote` bestehen im KO-Detail-Revise-Bereich. Es fehlte ein „Confidence/Next-Step"-Hinweis direkt AM Speichern-/Einreichen-/Revidieren-Button: dass Studio-Inhalt im Entwurf liegt, aber noch nicht gespeichert/validiert ist, und welcher echte nächste Schritt folgt.

**Legacy-Pfad geprüft / nicht verfügbar.** `Klarwerk/app/src/{components/{WikiEditor,AiAssist,CaseEditor}.jsx,pages/TeacherStudio.jsx}` verfügbar (read-only), nur gelesen, nicht kopiert. Kein „Save-Confidence/Next-Step"-Muster im Legacy vorhanden (Legacy speicherte direkt im Editor) — bewusst keine Übernahme.

**Aktuelle Gap.** Nach Studio-Apply wirkte der Save/Submit/Revise-Bereich wie eine Formular-Sackgasse: kein klarer Hinweis, dass der übernommene Inhalt noch gespeichert/revidiert und danach geprüft werden muss; Risiko, KI-/Studio-Inhalte als bereits gesichert/validiert misszuverstehen.

**Umsetzter Umfang.**
1. **DOM-freier Helfer** `studioSaveConfidence(context)` in `apps/web/src/lib/editorApplySafety.ts` (`StudioSaveContext = "capture" | "revision"`): liefert `titleKey/hintKey/nextStepKey/tone` je Kontext. Kein neues Statusmodell, kein Auto-Save.
2. **Capture** (`Capture.tsx`): bei `studioApplied` direkt VOR dem Einreichen-Button eine kompakte Confidence-Card — „Studio-Inhalt im Entwurf — noch nicht gespeichert", Hinweis (nicht gespeichert/validiert) + nächster echter Schritt „speichern/einreichen → danach Review/Validierung; automatisch validiert wird nichts".
3. **KO-Detail Edit** (`KnowledgeDetail.tsx`): bei `studioApplied` im Revise-Bereich NACH `KoRevisionSummary` + `ko.editNote` (ergänzt, nicht dupliziert) eine Confidence-Card — „Studio-Inhalt im Revisionsentwurf — noch nicht gespeichert"; nächster Schritt „Speichern erzeugt eine neue Version und startet die Prüfung neu — keine automatische Freigabe".
4. **i18n** `studio.save.capture.{title,hint,next}` + `studio.save.revision.{title,hint,next}` DE+EN, ehrlich formuliert.
5. **Tests** `tests/app/editor-apply-safety.test.ts` erweitert: `studioSaveConfidence` (Keys + Tönung je Kontext), i18n-Präsenz DE+EN, Ehrlichkeits-Checks (Capture: Review/Validierung, „automatisch validiert wird nichts"; Revision: „neue Version" + „keine automatische Freigabe"). Bestehende Dirty-/Template-/apply-safety-Tests bleiben grün.

**Bewusst nicht umgesetzte Gaps.** Kein Backend; kein neues Rollen-/Notification-/Statusmodell; kein Auto-Save/Auto-Validate; KoRevisionSummary/ko.editNote unverändert (nur ergänzt); kein Blocking des Save-Buttons (nur Hinweis). Die Confidence erscheint nur nach einem Studio-Apply (`studioApplied`), nicht bei rein inline bearbeitetem Body — bewusst, der Hinweis bezieht sich auf die Studio-Übernahme.

**Geänderte Dateien.**
- `apps/web/src/lib/editorApplySafety.ts` (studioSaveConfidence + Typen)
- `apps/web/src/pages/Capture.tsx` (Confidence-Card vor Submit)
- `apps/web/src/pages/KnowledgeDetail.tsx` (Confidence-Card im Revise-Bereich)
- `apps/web/src/i18n.ts` (`studio.save.*` DE+EN)
- `tests/app/editor-apply-safety.test.ts` (erweitert)

**Tests/Gates.** `npm run check` grün — **157 Dateien / 970 Tests**. Gezielt `tests/app/editor-apply-safety.test.ts` → 11/11 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Reine FE-/Anzeige-/Text-Änderung — keine Save/Submit/Revise-Logik berührt. Die Confidence-Anzeige hängt am `studioApplied`-State (SCRUM-339); dieser wird beim erneuten Studio-Öffnen zurückgesetzt — der Hinweis spiegelt also „seit dem letzten Studio-Apply noch nicht gespeichert", nicht einen Live-Diff zum gespeicherten Stand (akzeptabel, konservativ ehrlich).

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/editorApplySafety.ts apps/web/src/pages/Capture.tsx apps/web/src/pages/KnowledgeDetail.tsx apps/web/src/i18n.ts tests/app/editor-apply-safety.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): studio save confidence — clarify next real step before save/revise (SCRUM-344)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-345 — Beta Knowledge Studio Keyboard & Formatting Guidance v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–344 committet). KnowledgeInputStudio ist ein 3-Spalten-Arbeitsraum (Kontext · Editor · KI). RichTextEditor-Toolbar real: Bold/Italic, H2/H3 (formatBlock), UL/OL, Link, vier Block-Buttons (info/note/warning/success), Bild, Preview/Edit-Toggle — Bold/Italic laufen über `execCommand`, also auch via native ⌘B/⌘I in contentEditable. EditorGuidance erklärt Struktur/Aktion/Blöcke/KI grob; BodyTemplateChooser + AiAssistBox + Dirty-State + Save Confidence bestehen. Es fehlte eine editor-nahe Bedien-/Formatierungs-Hilfe direkt im Studio.

**Legacy-Pfad geprüft.** `Klarwerk/app/src/{WikiEditor,AiAssist,CaseEditor}.jsx` + `TeacherStudio.jsx` verfügbar (read-only), nur gelesen, nicht kopiert — kein wiederverwendbares Shortcut-/Formatierungs-Hilfemuster vorhanden.

**Aktuelle Gap.** Im großen Arbeitsraum mussten Nutzer Toolbar/Formatierung/Arbeitslogik selbst entdecken; die Bedienung wirkte noch nicht eindeutig wie ein professioneller Editor-Arbeitsraum.

**Umgesetzter Umfang.**
1. **DOM-freier Helfer** `knowledgeStudioTips.ts`: stabile Item-Liste `select → structure → ai → blocks` mit `labelKey/hintKey` (Schema `studio.tips.<id>.{label,hint}`) und optionalem reinen Anzeige-`shortcut` (nur beim Formatier-Tipp `⌘B · ⌘I` — KEIN echtes Shortcut-System, nur Hinweis auf native contentEditable-Tasten).
2. **Komponente** `KnowledgeStudioTips.tsx`: kompakte Karte (Titel + 2-spaltiges Grid aus Label/Shortcut-Chip/Hint) — kein Onboarding-Overlay, keine State-Maschine.
3. **Studio**: Karte direkt über der zentralen Editorfläche eingehängt (Editor-Spalte, zwischen Bereichslabel und RichTextEditor-Card). Header/Footer/Safety/Props unverändert.
4. **i18n** `studio.tips.title` + `studio.tips.{select,structure,ai,blocks}.{label,hint}` DE+EN, ehrlich (KI-Tipp: „erst prüfen, dann bewusst übernehmen. Nichts wird automatisch gespeichert.").
5. **Test** `tests/app/knowledge-studio-tips.test.ts`: Reihenfolge/IDs, Key-Schema, nur `select` trägt Shortcut, i18n-Präsenz DE+EN, Ehrlichkeits-Check.

**Bewusst nicht umgesetzte Gaps.** Kein Backend; keine neue Editor-Library; kein echtes globales Keyboard-Shortcut-System (nur Anzeige-Hinweis); kein Cursor-genauer Insert; kein Drag&Drop; kein Diff/Merge; keine Toolbar-Neuerfindung; keine Auto-Speicherung/-Validierung. EditorGuidance bewusst unverändert gelassen (komplementär: Guidance = was die Werkzeuge bewirken, Tips = wie man im Studio arbeitet).

**Geänderte Dateien.**
- `apps/web/src/lib/knowledgeStudioTips.ts` (NEU)
- `apps/web/src/components/KnowledgeStudioTips.tsx` (NEU)
- `apps/web/src/components/KnowledgeInputStudio.tsx` (Karte über Editor + Import)
- `apps/web/src/i18n.ts` (`studio.tips.*` DE+EN)
- `tests/app/knowledge-studio-tips.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **158 Dateien / 975 Tests**. Gezielt `knowledge-studio-tips.test.ts` → 5/5 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Reine FE-/Anzeige-/Text-Änderung — keine Editor-/Toolbar-/Datenmodell-Logik berührt. Der `⌘B·⌘I`-Hinweis ist nur Anzeige; die tatsächliche Tastenwirkung kommt aus dem nativen contentEditable-Verhalten des Browsers (von Bold/Italic-Buttons über `execCommand` ohnehin genutzt) — keine eigene Tastatur-Implementierung, kein Bruchrisiko. Karte nimmt vertikalen Platz über dem Editor; bewusst kompakt gehalten.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/knowledgeStudioTips.ts apps/web/src/components/KnowledgeStudioTips.tsx apps/web/src/components/KnowledgeInputStudio.tsx apps/web/src/i18n.ts tests/app/knowledge-studio-tips.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): knowledge studio keyboard & formatting guidance card (SCRUM-345)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-346 — Beta Knowledge Studio Live Preview & Apply Review v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–345 committet). KnowledgeInputStudio = 3-Spalten-Arbeitsraum (Kontext · Editor · KI) mit Dirty-State, Discard-Guard, KnowledgeStudioTips, Save Confidence. KO-Detail rendert den Body im Read-Mode über `SanitizedHtml` (`className="prose-kw …"`) + Titel/Blöcke-Chip aus `bodyReadMode` (`BODY_READ_TITLE_KEY`/`BODY_READ_BLOCKS_KEY`/`BODY_READ_NOTE_KEY`). `SanitizedHtml` ist der einzige `dangerouslySetInnerHTML`-Ort (allowlist-sanitisiert FE+Server). Es fehlte eine Live-Vorschau im Studio selbst.

**Legacy-Pfad geprüft.** `Klarwerk/app/src/{WikiEditor,AiAssist,CaseEditor}.jsx` + `TeacherStudio.jsx` verfügbar (read-only); `Klarwerk/demo/src/...` nicht geprüft/nicht nötig. Nur gelesen, nichts kopiert.

**Gap-Liste (alt → neu → beta-Lücke → Entscheidung).**
- Live-Vorschau des bearbeiteten Bodys: Legacy-WikiEditor hatte teils eine Edit/Preview-Umschaltung → im Studio gab es nur den RichTextEditor (RichTextEditor hat zwar einen internen Preview-Toggle, aber keine KO-Detail-getreue Read-Mode-Vorschau) → Beta-Nutzer sahen vor dem Übernehmen nicht, wie der strukturierte Body später aussieht → **jetzt umgesetzt** (eigene, KO-Detail-getreue Vorschau über `SanitizedHtml`+`prose-kw`).
- Ehrliche Einordnung „Vorschau ≠ validiertes Wissen": Legacy mischte Vorschau/Freigabe teils → **jetzt umgesetzt** als klarer Hinweis (Entwurf, kein validiertes Wissen).
- Cursor-genauer Insert / Diff-Merge / WYSIWYG-Live-Side-by-Side: Legacy teils vorhanden → **nicht übernehmen** (Nicht-Ziele, Risiko/Aufwand zu hoch für Beta-Slice).

**Umgesetzter Umfang.**
1. **DOM-freier Helfer** `knowledgeStudioPreview.ts`: `StudioEditorView = "edit" | "preview"` + `STUDIO_EDITOR_VIEWS` + `studioEditorViewLabelKey` (Schema `studio.view.<view>`); `studioPreviewState(draft)` leitet über den bestehenden `bodyReadMode` `{ hasBody, hasBlocks, emptyHintKey }` ab (leerer Body → `studio.preview.empty`, sonst null).
2. **Studio Edit/Vorschau-Umschalter**: segmentierter Toggle im Kopf der zentralen Editor-Spalte (kein Layout-Umbau, 3-Spalten bleibt). „Bearbeiten" zeigt den RichTextEditor wie bisher; „Vorschau" rendert eine sichere Karte, die die KO-Detail-Read-Mode-Darstellung spiegelt (`SanitizedHtml` + `prose-kw` + Blöcke-Chip via `BODY_READ_TITLE_KEY`/`BODY_READ_BLOCKS_KEY`), bei leerem Body den ehrlichen Leer-Hinweis.
3. **Apply-Review-Hinweis**: `studio.preview.note` — Vorschau = Entwurf, kein validiertes Wissen; Übernehmen schreibt nur in den lokalen Entwurf; Speichern/Einreichen/Revidieren danach über die bestehenden Buttons.
4. **i18n** `studio.view.edit/preview`, `studio.preview.empty/note` DE+EN.
5. **Test** `tests/app/knowledge-studio-preview.test.ts` (Views/Reihenfolge, labelKey-Schema, Preview-State leer/Text/Block, i18n-Präsenz DE+EN, Ehrlichkeits-Check).

Beide Einstiegspunkte (Capture-Studio und KO-Detail-Studio) profitieren ohne getrennte Implementierung, da die Vorschau Teil der gemeinsamen KnowledgeInputStudio-Komponente ist. Header/Footer/Dirty-State/Discard-Guard/KI/Templates/Apply unverändert.

**Bewusst nicht umgesetzte Gaps.** Kein neues Editor-Framework; kein Cursor-Insert; kein Diff/Merge; kein Side-by-Side-Live-Split; kein Backend/Reasoner-Change; kein Auto-Save/-Validate; keine Fake-Freigabe; keine Demo-Hacks; `SanitizedHtml` nur genutzt, nicht neu erfunden.

**Geänderte Dateien.**
- `apps/web/src/lib/knowledgeStudioPreview.ts` (NEU)
- `apps/web/src/components/KnowledgeInputStudio.tsx` (Edit/Vorschau-Umschalter + sichere Vorschau-Karte + State/Reset + Imports)
- `apps/web/src/i18n.ts` (`studio.view.*` + `studio.preview.*` DE+EN)
- `tests/app/knowledge-studio-preview.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **159 Dateien / 981 Tests**. Gezielt `knowledge-studio-preview.test.ts` → 6/6 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Vorschau nutzt denselben sanitisierten Renderpfad wie KO-Detail (`SanitizedHtml`) — keine neue XSS-Fläche. View-State ist rein lokal/Anzeige, wird beim Öffnen auf „edit" zurückgesetzt; Dirty-/Apply-Logik arbeitet unverändert auf `draft`. Toggle steht in „edit" beim Öffnen — der Nutzer wechselt bewusst in die Vorschau (kein Auto-Switch). Reine FE-Änderung.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/lib/knowledgeStudioPreview.ts apps/web/src/components/KnowledgeInputStudio.tsx apps/web/src/i18n.ts tests/app/knowledge-studio-preview.test.ts docs/qm/claude-after-report.md
git commit -m "feat(editor): knowledge studio live preview & apply review (SCRUM-346)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-347 — Beta Knowledge Studio Browser Smoke & Usability v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt, Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–346 committet). Wichtig: Es existiert KEIN Browser-/DOM-Test-Harness — `vitest.config.ts` nutzt das Node-Env (kein `environment: "jsdom"`), und es sind weder `@testing-library/*`, `jsdom`, `happy-dom` noch Playwright als Dependency vorhanden; kein bestehender Test rendert Komponenten. Das Ticket verbietet ausdrücklich, einen neuen E2E-/Browser-Harness einzuführen. Daher: Code-/DOM-naher Durchlauf der echten Studio-Verdrahtung (Read-Through der gerenderten Struktur) + DOM-freie Flow-Smoke-Regression über die real genutzte Helfer-Kette.

**Legacy-Pfad geprüft.** `Klarwerk/app/src/{WikiEditor,AiAssist,CaseEditor}.jsx` + `TeacherStudio.jsx` (read-only) gesichtet, nichts kopiert; `demo/src/...` nicht nötig.

**Smoke-Evidence Capture-Studio (Code-Durchlauf).** Capture rendert `<KnowledgeInputStudio open onApply=setBodyHtml … />`; Öffnen initialisiert `draft=bodyHtml`, `view="edit"`, `confirmDiscard=false` (useEffect on open). Kontext-Spalte: Guidance/Attachment/Quality/`BodyTemplateChooser(onApply=setDraft)`. Editor-Spalte: Edit/Vorschau-Toggle (aria-pressed), `KnowledgeStudioTips`, `RichTextEditor(value=draft,onChange=setDraft)`. KI-Spalte: `AiAssistBox(applyFn=applyBodyAssist, extraApplyActions=bodyAssistStructuredActions(draft))`. Footer: Dirty-Badge `knowledgeStudioState`, Discard-Guard (Inline-Confirm), `Apply→onApply(draft)+onClose`. Nach Apply zeigt Capture den `studioApplied`-Banner + Save-Confidence `capture` vor dem Einreichen. Flow „open→Vorlage→KI-Abschnitt→Vorschau→Apply→Save-Confidence" als Test reproduziert (grün).

**Smoke-Evidence KO-Detail-Studio (Code-Durchlauf).** KO-Detail-Edit rendert dieselbe Komponente mit `bodyHtml=edit.bodyHtml`, `onApply` schreibt in den Edit-State + setzt `studioApplied`. Vorschau erkennt vorhandenen Body/Blöcke; nach Apply erscheint im Revise-Bereich die Save-Confidence `revision` (neue Version + erneute Prüfung). Flow „open(vorhandener Body)→Vorschau→KI-Ergänzung→Apply→Revise-Confidence" als Test reproduziert (grün).

**Gefundene Reibung (P2, behoben).** Die Formatierungs-/Shortcut-Hilfe `KnowledgeStudioTips` („markieren → formatieren", „⌘B · ⌘I") wurde unbedingt über der zentralen Spalte gerendert — also AUCH in der „Vorschau", wo gar kein Editor sichtbar ist. Das ist in der Read-Only-Vorschau irreführend (Shortcuts ohne bedienbaren Editor). **Fix:** `KnowledgeStudioTips` nur noch im `view === "edit"`. Keine weitere echte Reibung gefunden — Toggle hat `aria-pressed`, alle Buttons haben Textlabels, Safety-Flows (Dirty/Discard/Apply-Feedback/Save-Confidence/Preview-Hinweis) korrekt verdrahtet.

**Umgesetzter Umfang.**
1. P2-Fix: `KnowledgeStudioTips` nur im Bearbeiten-View sichtbar (in der Vorschau ausgeblendet).
2. Dauerhafte Regression `tests/app/knowledge-studio-flow.test.ts`: zwei Flow-Smokes (Capture-Einstieg leer→Vorlage→KI-Abschnitt→Vorschau-Zustand→Dirty→Apply→Save-Confidence=capture; KO-Detail-Einstieg vorhandener Body→Vorschau hasBody/hasBlocks→KI-Ergänzung nicht-destruktiv→Dirty→Apply→Save-Confidence=revision) über die echten Helfer `applyBodyTemplate`, `bodyAssistStructuredActions`/`applyBodyAssistSection`, `knowledgeStudioState`, `studioPreviewState`, `studioSaveConfidence`.

**Bewusst nicht umgesetzte Gaps.** Kein neuer Browser-/jsdom-/Playwright-Harness (Nicht-Ziel; nicht vorhanden) — daher kein echtes Pixel-/Event-Rendering, sondern Flow-Smoke über die identische Helfer-Kette. Keine UI-Neuerfindung, kein Editor-Framework, kein Backend/Reasoner-Change, kein Auto-Save/-Validate.

**Geänderte Dateien.**
- `apps/web/src/components/KnowledgeInputStudio.tsx` (Tips nur im Edit-View)
- `tests/app/knowledge-studio-flow.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **160 Dateien / 983 Tests**. Gezielt `knowledge-studio-flow.test.ts` → 2/2 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Der Smoke ist Flow-/Helfer-nah, nicht echtes DOM-Rendering — JSX-Verzweigungen (z. B. Tips-Sichtbarkeit pro View) sind durch Code-Review belegt, nicht durch einen gerenderten Assert (kein Harness verfügbar/erlaubt). Wenn Team 1 später einen DOM-Harness einführt, sollten diese Flows auf echte Render-Asserts gehoben werden. P2-Fix ist rein additiv (Bedingung), keine Logikänderung an Draft/Apply/Safety.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/components/KnowledgeInputStudio.tsx tests/app/knowledge-studio-flow.test.ts docs/qm/claude-after-report.md
git commit -m "test(editor): knowledge studio flow smoke + hide formatting tips in preview (SCRUM-347)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-348 — Beta Fresh Capture → Studio → Review → Use Hardening v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt (Regression abgesichert, keine echte Reibung), Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–347 committet). Bestehend: `tests/structure/capture-to-validation-e2e.test.ts` deckt Capture→offenes KO→Board (eine Up-Stimme reicht bei needed=2 nicht); `ask-routes.test.ts` deckt validiertes KO→gesicherte Antwort und unbeantwortbar→Gap. Der durchgehende Pfad „Fresh Capture (Studio-Body) → offen → Validierung → validiert → Use VOR vs. NACH Validierung" war noch NICHT als zusammenhängender Regressionstest gesichert. Reasoner-Mechanik geprüft: `ask` nutzt `koService.list()` (ALLE KOs), `keywordSelect` matcht per Token-Overlap, `knowledgeClass = best.status === "validiert" ? "gesichert" : "ungeprueft"` → ein offenes KO wird beantwortet, aber ehrlich als ungeprüft markiert. Validierung: needed=1 + ein Admin-Up → `validiert`/Trust 100.

**Legacy-Pfad geprüft.** `Klarwerk/app/src/{WikiEditor,AiAssist,CaseEditor}.jsx` + `TeacherStudio.jsx` (read-only) gesichtet, nichts kopiert.

**Runtime-/Flow-Evidence (neuer E2E, 2 Tests grün).**
- Studio-Body über die ECHTEN Helfer gebaut: `applyBodyTemplate("","procedure","de")` → `applyBodyAssistSection(...)` (H3 + Absatz).
- Fresh Capture via `POST /api/kos` → `offen`, Trust 0, Version 1.
- Server-Sanitizer hält die Studio-Struktur: `<h2>`, `<h3>Sicherheitshinweis</h3>`, `class="panel panel-info"`; `editorContentQuality` = hasHeadings/hasLists/hasBlocks; `bodyReadMode` = {hasBody, hasBlocks}.
- Capture-Success ehrlich: `captureSavedStatus`, `captureNextSteps(koId)` mit „KO ansehen" (`/wissen/:id`), primär „zur Validierung" (`/validierung…`), „eigenes Wissen" (`non-demo`).
- Nutzbarkeit vor Review: `koOverview.usability = needs-work`, `useReadiness ≠ ready`, `validationReviewContext.kind = new`. KO erscheint im `GET /api/validation/board`.
- **USE VOR Validierung:** `POST /api/ask` → `answered=true`, `sources=[koId]`, aber `knowledgeClass ≠ gesichert`; `answerStatus = unverified`; `sourceRefs.validated=false`, `usability ≠ ready` (ehrlich ungeprüft, nicht als gesichert dargestellt).
- Validierung via `PUT /api/kos/:id {rate, up}` (needed=1) → `validiert`, Trust 100; `koOverview.usability = ready`.
- **USE NACH Validierung:** `answered=true`, `knowledgeClass=gesichert`, `sources=[koId]` (quellengebunden auf genau dieses KO), `answerStatus=verified`, `gap=null`, `sourceRefs.validated=true`/`usability=ready`.
- Quellenbindung (Anti-Chatbot): Frage ohne passendes Wissen → `answered=false`, `sources=[]`, ehrliche Lücke (`gap.status=offen`).

**Gefundene Reibung / keine Reibung.** Keine echte P1/P2-Reibung gefunden. Der Beta-Pfad ist durchgängig konsistent und ehrlich: offenes Wissen bleibt offen/ungeprüft und ist beim Fragen klar als nicht-gesichert markiert; erst echte Validierung macht die Antwort gesichert und quellengebunden. Status/Trust/Nutzbarkeit sagen über alle Flächen (KO-Detail/Validation/Ask-Quellen) dasselbe (`koOverview` → `useReadiness`). Daher wie im Ticket vorgesehen: ehrlich berichtet + den Flow als dauerhafte Regression abgesichert.

**Umgesetzter Umfang.** Neuer Runtime-/API-naher E2E `tests/structure/fresh-capture-to-use-e2e.test.ts` (2 Tests) über die echten HTTP-Routen + Server-Sanitizer + deterministischen Reasoner + echte Studio-/Anzeige-Helfer. Kein Produktcode geändert (keine Reibung zu beheben).

**Bewusst nicht umgesetzte Gaps.** Keine Multi-Voter-Quorum-Variante (needed≥2 mit mehreren approvten Validatoren) — RBAC-Approval-Plumbing ist nicht Ziel dieses Slices; das Quorum-Verhalten ist bereits in `capture-to-validation-e2e` (eine Stimme reicht nicht) und `validation-routes.test` abgedeckt. Kein neues Testframework, kein Backend/Reasoner-Change, keine Demo-Politur.

**Geänderte Dateien.**
- `tests/structure/fresh-capture-to-use-e2e.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **161 Dateien / 985 Tests**. Gezielt `fresh-capture-to-use-e2e.test.ts` → 2/2 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Der E2E nutzt needed=1 für einen deterministischen Validierungsschritt; das Mehr-Stimmen-Quorum ist anderweitig abgedeckt. Der deterministische Reasoner ist Keyword-basiert — die Quellenbindung „genau dieses KO" gilt für den getesteten eindeutigen Token (Hydraulikzylinder/HZ7); bei mehreren ähnlichen KOs entscheidet das Token-Overlap-Ranking (bestehendes, getestetes Verhalten). Reiner Test-Zusatz, kein Produktverhalten geändert.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add tests/structure/fresh-capture-to-use-e2e.test.ts docs/qm/claude-after-report.md
git commit -m "test(flow): fresh capture -> studio -> validation -> use e2e hardening (SCRUM-348)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-349 — Beta Review → Rework → Revalidation → Use Hardening v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt (Regression abgesichert, keine echte Reibung), Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–348 committet). Das bestehende `tests/validation/rework-flow-e2e.test.ts` (SCRUM-334) deckt warn/down + Feedback → `reworkHref` → `latestValidationFeedback` → revise (Version 2, offen, Trust 0) → `reworkValidationHref`/`review=revision` — endet aber beim Validation-Fokus „revision". Noch NICHT als zusammenhängende Regression gesichert: Studio-getriebener Revisions-Body, `studioSaveConfidence("revision")`, `reworkNextSteps()`-Reihenfolge, die **erneute Validierung** der Revision (→ validiert/Trust 100) und **Use/Ask** auf der revidierten Fassung. `revise` akzeptiert + sanitisiert `changes.bodyHtml` (`cleanBody → sanitizeHtml`), setzt Version+1, Trust 0, Status offen, behält Quellen.

**Legacy-Pfad geprüft.** `Klarwerk/app/src/{WikiEditor,AiAssist,CaseEditor}.jsx` + `TeacherStudio.jsx` (read-only) gesichtet, nichts kopiert.

**Runtime-/Flow-Evidence (neuer E2E, 1 Test grün).**
- Offenes KO mit strukturiertem Studio-Body (`applyBodyTemplate("","procedure","de")`), eindeutiges Stichwort „SPX9".
- Review „down" mit Pflichtfeedback (`buildValidationFeedback("down", …)` als Kommentar, dann `rate down`) → bleibt `offen`.
- FE-Entscheidung: `reviewNextSteps(down)` → genau ein Schritt = `reworkHref(id)` = `/wissen/:id?rework=review`; `isReviewReworkContext` true.
- Rework-Kontext: `latestValidationFeedback` erkennt verdict `down` + Body; `reworkNextSteps()` = `["feedback","revise","back"]`.
- Studio-Revision: `applyBodyAssistSection(body, "Quelle\n…")` adressiert das Feedback (`<h3>Quelle</h3>`); `studioSaveConfidence("revision")` ehrlich (`studio.save.revision.title`, tone warn).
- `revise` via `PUT /api/kos/:id {action:revise, changes:{statement,bodyHtml}}` → Version 2, `offen`, Trust 0; sanitisierter Body behält `<h3>Quelle</h3>` + `panel panel-info`, kein `<script`.
- Validation-Fokus: `validationReviewContext(revidiert).kind = "revision"`; `reworkValidationHref()` = `/validierung?review=revision`; `readReviewFocusFilter` = `revision`; revidiertes KO im `GET /api/validation/board`.
- **USE VOR Revalidierung:** `answered=true`, `sources` enthält id, aber `knowledgeClass ≠ gesichert`; `answerStatus = unverified`; `koOverview.usability ≠ ready`.
- Erneute Validierung (`rate up`, needed=1) → `validiert`, Trust 100, Version 2; `koOverview.usability = ready` (konsistent über `useReadiness`).
- **USE NACH Revalidierung:** `gesichert`, `sources = [id]` (quellengebunden auf genau diese Revision), `verified`, `gap=null`, `sourceRefs.validated=true`/`usability=ready`.

**Gefundene Reibung / keine Reibung.** Keine echte P1/P2-Reibung gefunden. Der Review→Rework→Revalidation→Use-Pfad ist durchgängig konsistent und ehrlich: Feedback bleibt im Rework-Kontext sichtbar und führt über geordnete Schritte zur Nacharbeit; die gespeicherte Revision bleibt offen/ungeprüft (Trust 0, Version 2), Review-Fokus `revision` ist konsistent mit `version > 1`; erst die erneute Validierung macht die Revision gesichert/quellengebunden nutzbar. Wie im Ticket vorgesehen daher ehrlich berichtet + als dauerhafte Regression abgesichert.

**Umgesetzter Umfang.** Neuer Runtime-/API-naher E2E `tests/validation/rework-revalidation-use-e2e.test.ts` (1 Test) über die echten HTTP-Routen + Server-Sanitizer + deterministischen Reasoner + echte Review-/Rework-/Studio-/Anzeige-Helfer. Kein Produktcode geändert (keine Reibung).

**Bewusst nicht umgesetzte Gaps.** Kein getrennter Reviewer (Autor≠Reviewer) in diesem Test — bereits in `rework-flow-e2e` (Carla via demo-seed) abgedeckt; hier bewusst sauberer Bestand (admin-only) für deterministische Quellenbindung. Kein Multi-Voter-Quorum (anderweitig abgedeckt). Kein neues Testframework, kein Backend/Reasoner-Change, kein Rollen-/Notification-System, keine Demo-Politur.

**Geänderte Dateien.**
- `tests/validation/rework-revalidation-use-e2e.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **162 Dateien / 986 Tests**. Gezielt `rework-revalidation-use-e2e.test.ts` → 1/1 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** E2E nutzt needed=1 für einen deterministischen (Re-)Validierungsschritt; das Mehr-Stimmen-Quorum ist anderweitig abgedeckt. Quellenbindung „genau diese Revision" gilt für den eindeutigen Token (SPX9); bei mehreren ähnlichen KOs entscheidet das bestehende Token-Overlap-Ranking. Reiner Test-Zusatz, kein Produktverhalten geändert.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add tests/validation/rework-revalidation-use-e2e.test.ts docs/qm/claude-after-report.md
git commit -m "test(flow): review -> rework -> revalidation -> use e2e hardening (SCRUM-349)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-350 — Beta Evidence & Attachments → Review → Use Hardening v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt (Regression abgesichert, keine echte Reibung), Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–349 committet). Attachment-/Evidence-Mechanik vorhanden und einzeln getestet (`capture-attachment-routes.test.ts`, SCRUM-243): `POST /api/objects` (ObjectRef + `/raw`), `PUT /api/kos/:id {action:attach}` (mit `objectId` → Attachment-Evidence), `{action:add-source}` (externe Quelle, `peerValidated:false`, Source-Evidence), `GET /api/kos/:id/evidence`. FE-Helfer: `editorAttachmentContext.attachmentContext` trennt Bild (inline einfügbar) von Datei (bleibt Anhang/Evidence); `koOverview` leitet `usability` AUSSCHLIESSLICH aus dem Status ab (nicht aus Anhängen/Quellen) — `hasEvidence`/`attachmentCount`/`sourceCount` sind reine Zähler, `nextAction` unterscheidet bei needs-work nur addSource vs validate. Befund: Evidence bläht Nutzbarkeit/Trust NICHT auf (ehrlich). Was fehlte: ein zusammenhängender Regressionstest, der genau das über Capture→Evidence→Review→Use beweist (die bestehende Attachment-Suite verbindet Evidence NICHT mit Validierungs-/Use-Ehrlichkeit).

**Read-only-Befund (Fragen aus dem Ticket).**
- Anhänge fließen von Capture/KO über `attach` (objectId/dataUrl) in `ko.attachments` + Evidence-Records; Quellen über `add-source` in `ko.sources` + Source-Evidence.
- Bilder/Dateien sind im KO-Detail sichtbar (Attachment-Liste, `openAttachment` via dataUrl/objectId; `EditorAttachmentContext`-Karte Bild vs. Datei).
- Review/Validation sieht denselben KO-Zustand inkl. Counts/Evidence über `koOverview` (`ov.attachmentCount`/`ov.sourceCount`).
- Ask/Use bleibt quellengebunden: `answerStatus`/`sourceRefs` aus `koOverview` → gesichert nur bei validiertem Quell-KO.
- **Keine echte P1/P2-Reibung gefunden** — die Status/Trust/Nutzbarkeits-Aussage ist über alle Flächen konsistent und Evidence-unabhängig.

**Runtime-/Flow-Evidence (neuer E2E, 1 Test grün).**
- KO mit Studio-Body („Förderband FB12", needed=1) → offen.
- Bild-Object (`image/png`) + Datei-Object (`application/pdf`) via `POST /api/objects`; beide via `attach` (objectId) referenziert; externe Quelle via `add-source`.
- `GET …/evidence`: 2 `attachment`-Records + 1 `source`-Record; Attachment-Record verweist auf die Bild-`objectId`.
- KO-Zustand: 2 Anhänge; externe Quelle `peerValidated=false`/`kind=external`.
- **KERN:** `koOverview` zeigt `attachmentCount=2`, `sourceCount=1`, `hasEvidence=true` — aber `status=offen`, `trust=0`, `usability=needs-work` (Evidence ≠ Validierung); `useReadiness ≠ ready`.
- `attachmentContext` → `imageCount=1`, `fileCount=1` (Bild vs. Datei korrekt getrennt).
- **USE VOR Validierung:** trotz Evidence `answered=true`, aber `knowledgeClass ≠ gesichert` → `answerStatus=unverified`.
- Echte Validierung (`rate up`, needed=1) → `validiert`/Trust 100; **Anhänge bleiben erhalten** (2); `koOverview.usability=ready`, `hasEvidence` weiterhin true.
- **USE NACH Validierung:** `gesichert`, `sources=[id]` (quellengebunden), `verified`, `gap=null`, `sourceRefs.validated=true`/`usability=ready`.

**Gefundene Reibung / keine Reibung.** Keine echte P1/P2-Reibung. Anhänge/Evidence werden glaubwürdig als Kontext/Beleg geführt (sichtbar in Counts, Attachment-Kontext-Karte, Evidence-Records), ersetzen aber an keiner Stelle Status/Trust/Validierung. Wie im Ticket vorgesehen daher ehrlich berichtet + als dauerhafte Regression abgesichert.

**Umgesetzter Umfang.** Neuer Runtime-/API-naher E2E `tests/structure/evidence-attachments-to-use-e2e.test.ts` (1 Test) über die echten Object-Store-/Attachment-/Evidence-Routen + die echten Anzeige-Helfer. Kein Produktcode geändert (keine Reibung).

**Bewusst nicht umgesetzte Gaps.** Kein neues Upload-/Object-Store-System; keine Inline-Datei-Vorschau über Bilder hinaus; kein Evidence-Scoring/Gewichtung (bewusst — Evidence soll Validierung NICHT ersetzen). Kein Multi-Voter-Quorum (anderweitig abgedeckt). Kein neues Testframework, kein Backend/Reasoner-Change, keine Demo-Politur.

**Geänderte Dateien.**
- `tests/structure/evidence-attachments-to-use-e2e.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **163 Dateien / 987 Tests**. Gezielt `evidence-attachments-to-use-e2e.test.ts` → 1/1 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** E2E nutzt needed=1 für deterministische Validierung (Quorum anderweitig abgedeckt). Object-Store speichert Metadaten/Bytes ohne Format-Validierung (PDF-Datenblob nur als Beispiel-Metadatum) — das ist bestehendes Verhalten, nicht Teil dieses Slices. Quellenbindung „genau dieses KO" gilt für den eindeutigen Token (FB12). Reiner Test-Zusatz, kein Produktverhalten geändert.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add tests/structure/evidence-attachments-to-use-e2e.test.ts docs/qm/claude-after-report.md
git commit -m "test(flow): evidence & attachments -> review -> use e2e hardening (SCRUM-350)"
git push
```
Kein Git/Push/Jira durch Claude.

---

## SCRUM-351 — Beta Personal Work Queue & Review Ownership v0
**Datum:** 2026-06-30 · **Rolle:** Claude (Hauptumsetzer) · **Status:** umgesetzt (P2-Fix + Regression), Gates grün

**Vorab-Befund.** `git status -sb` sauber (nur untracked Infra-Doc; SCRUM-337–350 committet). Die persönliche Arbeitsqueue ist bereits stark und ehrlich ausgebaut:
- `workCenter` (Start): leitet die getrennte Arbeitsübersicht (Konflikte/kritische Lücken/Revalidierung/Validierung/Lernpfad) + `primaryWorkItem` ausschließlich aus echten Signalen ab; keine Fake-Aufgaben.
- `MyTasks`: verdichtet echte Signale zu einer Aufgabenliste — `returnedToAuthor` (audit-basierte Nacharbeit, **author-scoped** via `user.id` → keine falsche Verantwortlichkeit), Konflikte, Validierungs-Board, Revalidierung, Gaps; gruppiert nach Severity (`groupTasks`).
- `taskAction` (Typ→nächste Handlung+Tönung), `knowledgeOsPhase`/`phaseLabelKey` (eine Kreis-Sprache Erfassen→Validieren→Nutzen→Aktuell halten über Start UND MyTasks), `reviewWorkView` (Review-Zustand neu/zugewiesen/in Prüfung/validiert), `validationReviewContext` (neu vs. revision), `reviewReworkContext` (`reworkHref`/`reworkValidationHref`/`reworkNextSteps`).
- Befund Begriffe/Verantwortlichkeit: konsistent und ehrlich; **kein Assignee-Modell wird vorgetäuscht** (Returned-Arbeit ist autorbezogen, Validierung ist offene Board-Arbeit).

**Read-only-Befund (Fragen aus dem Ticket).**
- Start/MyTasks zeigen offene Review-/Rework-/Revalidation-Arbeit korrekt als getrennte, priorisierte Quellen.
- Validation zeigt Review-State/Fokus/neu-vs-revidiert (SCRUM-326/327/328).
- KO-Detail führt im Rework-Kontext (`?rework=review`) fokussiertes Feedback + geordnete Schritte + Rückweg in die Validation (SCRUM-330/332/336).
- **Gefundene P2-Reibung (genau eine, real):** Die persönliche „zurückgegeben/Nacharbeit"-Karte in MyTasks (`task.returned`) verlinkte auf `/wissen/:id` OHNE `?rework=review`. Der Autor landete dadurch auf der nackten KO-Detailseite — NICHT im fokussierten Rework-Kontext (der nur mit `?rework=review` Feedback-Card + nummerierte Schritte zeigt). Damit brach die Kette Review→Rework→Validation genau an der persönlichen Einstiegsstelle, an der sie am wichtigsten ist. Sonst keine Reibung.

**Umgesetzter Umfang.**
- **Minimal-Fix** in `apps/web/src/pages/MyTasks.tsx`: die Returned-Karte routet jetzt über den bestehenden Helfer `reworkHref(r.koId)` (= `/wissen/:id?rework=review`) statt auf den nackten Pfad — der Autor landet direkt im fokussierten Rework-Kontext. Keine neue Engine, kein neues Statusmodell, keine geänderte Datenquelle; nur das Ziel-Href der vorhandenen, author-scoped Karte.
- **Dauerhafte Regression** `tests/app/personal-work-queue.test.ts`: sichert die Work-Queue-Semantik der Returned-Arbeit DOM-frei — `reworkHref` trägt den Fokus + `isReviewReworkContext` erkennt ihn (Round-Trip), nackter Pfad ist KEIN Rework-Kontext, `taskAction("task.returned")` = crit + `knowledgeOsPhase("task.returned")` = capture (eine Kreis-Sprache), i18n-Präsenz DE+EN.

**Bewusst nicht umgesetzte Gaps.** Kein Assignee-/Rollen-/Notification-System (Returned-Arbeit bleibt autorbezogen, keine vorgetäuschte Zuständigkeit). Kein neues Workflow-/Task-Backend, keine neue Severity-/Phasen-Engine. Validierungs-/Revalidierungs-/Konflikt-/Gap-Karten unverändert (führen bereits korrekt an ihre echten Ziele). Kein DOM-Render-Harness eingeführt (nicht vorhanden) — der MyTasks-Wiring-Fix ist per Code-Review + FE-tsc belegt, die Semantik per Helfer-Regression.

**Geänderte Dateien.**
- `apps/web/src/pages/MyTasks.tsx` (Returned-Karte → `reworkHref` + Import)
- `tests/app/personal-work-queue.test.ts` (NEU)

**Tests/Gates.** `npm run check` grün — **164 Dateien / 991 Tests**. Gezielt `personal-work-queue.test.ts` → 4/4 grün. `(cd apps/web && tsc --noEmit)` grün (FE-EXIT=0). Biome/depcruise grün.

**Rest-Risiken.** Reine FE-Routing-Änderung (ein Ziel-Href) — kein Datenmodell, keine Backend-/Statuslogik berührt. Der Rework-Kontext im KO-Detail ist bestehend und getestet (SCRUM-330/332/333/336); der Fix nutzt ihn nur konsequent. Ohne DOM-Render-Harness ist die konkrete Komponenten-Verdrahtung nicht durch einen gerenderten Klick-Test gedeckt, wohl aber durch FE-tsc + die Helfer-Regression.

**Commit-/Push-Hinweis (nur Vorschlag — nicht ausgeführt).**
```
cd /Users/peterkohnert/Documents/dev_Klarwerk
git add apps/web/src/pages/MyTasks.tsx tests/app/personal-work-queue.test.ts docs/qm/claude-after-report.md
git commit -m "fix(tasks): route returned-work card into focused rework context (SCRUM-351)"
git push
```
Kein Git/Push/Jira durch Claude.
