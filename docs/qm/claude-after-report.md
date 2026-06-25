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
