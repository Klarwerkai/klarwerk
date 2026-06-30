# Team 6 Update

## Current Snapshot

- Team: Team 1 / KLARWERK Produktkern / Knowledge OS / app.klarwerk.ai
- Scope: Knowledge Input, Capture, AI-assisted Editing, Validation, KO Detail, Library, Ask, Capture → Review → Use
- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Jira Project: SCRUM
- Last updated: 2026-06-30 18:32 CEST
- Current status: SCRUM-355 umgesetzt durch Claude, Codex-Prüfung/Commit/Push/CI/Jira ausstehend
- Active ticket: SCRUM-355 — Beta Body File Attachments via Object Store v0
- Last completed ticket: SCRUM-354 — Beta Draft Promote & Knowledge Rescue Submission Integrity v0
- Last commit: `57d1596d5d17919538b287cac34d62c119cc3a5e`
- GitHub/CI status: SCRUM-354 CI grün; SCRUM-355 noch nicht gepusht
- Beta impact: Nicht-Bild-Dateien lassen sich als sichtbarer, sicherer Link (interner Object-Store-Raw-Pfad) im ausführlichen Wissenstext referenzieren; kein Legacy-Data-URL, Sanitizer-Allowlist nur minimal erweitert.
- Team6 review needed: yes
- Reason: Team6 P1 Gap FR-STR-02 / G-P1-1
- Next planned slice: nach Pedi-Signal; Empfehlung voraussichtlich G-P2-1 (Drag&Drop/Paste) oder weiterer Team6-Input-Gap

## Current Risks / Gaps

| ID | Risk / Gap | Priority | Affected area | Team6 relevance | Status |
|---|---|---|---|---|---|
| G-P1-2 | Fortgesetzter Entwurf wurde bisher beim Einreichen nicht serverseitig aus dem Draft-Pool entfernt. | P1 | Capture / Drafts / Validation | FR-STR-06 MUSS, Legacy-Gap | Mit SCRUM-354 abgeschlossen |
| FR-STR-06-ATOMIC | Update und Promote laufen in zwei Requests; Promote-Fehler lässt aktualisierten Draft im Pool. | P2 | Capture / Drafts | Folgeoptimierung, kein Datenverlust | Dokumentiert, nicht Teil von SCRUM-354 |
| G-P1-1 | Datei-Anhänge im Body fehlen gegenüber Legacy. | P1 | Knowledge Studio / RichTextEditor | Legacy Knowledge Input Gap | Mit SCRUM-355 adressiert (sicherer Object-Store-Link); Codex-Abschluss ausstehend |
| FR-STR-02-SESSION | Capture-Session-Dateien haben noch keine objectId und sind daher nicht body-verlinkbar (ehrlich leerer Dropdown). | P2 | Capture / Object Store | Komfort-/Upload-Folgeoptimierung, kein Datenverlust | Dokumentiert, nicht Teil von SCRUM-355 |
| G-P2-1 | Drag&Drop / Paste fehlen gegenüber Legacy. | P2 | RichTextEditor / Studio | Legacy Komfortparität | Offen, nicht Teil von SCRUM-355 |

## Current Requirement Touchpoints

| Requirement / Gap | Source | Status | Notes |
|---|---|---|---|
| KG-UX-001 — nicht technisch/formularartig wirken | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Success-Copy erklärt Abschluss des fortgesetzten Entwurfs ruhig und verständlich. |
| KG-UX-002 — geführter Wizard / Rescue-Flow | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Draft-Fortsetzung führt nun sauber in den Rescue-Flow bis Review. |
| KG-UX-003 / KG-UX-010 — Vereinfachung / Progressive Disclosure | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Bestehende Funktion bleibt, Datenfluss wird unter der Oberfläche bereinigt. |
| KG-UX-012 — Legacy als Referenz | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Legacy-Verhalten „Draft beim Einreichen entfernen“ wird wiederhergestellt. |
| FR-STR-06 — Einreichen erzeugt KO offen; verbundener Entwurf wird entfernt | Team6 `EDITOR_INPUT_GAP_REVIEW_V0.md` | addressed in SCRUM-354 | Fortgesetzter Draft wird aktualisiert und dann per Promote abgeschlossen. |
| G-P1-2 — Frontend nutzt Promote/Remove nicht | Team6 `LEGACY_KNOWLEDGE_INPUT_GAP_REVIEW_V0.md` | addressed in SCRUM-354 | Capture nutzt bei `draftId` nun `drafts.update` → `drafts.promote`. |
| FR-STR-02 — Datei im Body als sichere Referenz | Team6 `EDITOR_INPUT_GAP_REVIEW_V0.md` | addressed in SCRUM-355 | Nicht-Bild-Datei wird als `div.attachment > a(/api/objects/:id/raw)` eingefügt; kein Data-URL. |
| G-P1-1 — Body-Datei-Anhänge gegenüber Legacy | Team6 `LEGACY_KNOWLEDGE_INPUT_GAP_REVIEW_V0.md` | addressed in SCRUM-355 | Paperclip-Toolbar verlinkt vorhandene KO-Attachments mit objectId; Status/Trust unverändert (Evidence ≠ Validierung). |
| KG-UX-012 — Legacy als Referenz | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Legacy-Verhalten „Datei im Text verlinken“ wird sicher (interner Raw-Pfad statt Data-URL) wiederhergestellt. |

## Delta Log

### 2026-06-30 18:30 — SCRUM-355 — pending commit

- Changed areas: bodyFileLink-Helfer, Sanitizer (FE+Server) Allowlist, RichTextEditor (Paperclip-Toolbar), Knowledge Studio, KO-Detail, Capture, index.css, i18n, Tests, Team6 handoff.
- What changed: Neuer DOM-freier Helfer `bodyFileLink.ts` (`objectRawHref`, `fileLinkHtml`, `applyBodyFileLink`, `editorFilesFromAttachments`) baut eine sichere Body-Datei-Referenz `div.attachment > a(href="/api/objects/:id/raw", title=name) > name` mit escaptem Namen. FE- und Server-Sanitizer-Allowlist um genau eine Klasse `attachment` erweitert; Anker erhalten weiterhin `rel="noopener noreferrer nofollow"`. RichTextEditor bekommt eine `files`-Prop und einen Paperclip-Dropdown (Bild-Einfügen unverändert). Studio reicht `files` durch; KO-Detail liefert `editorFilesFromAttachments(ko.attachments)`, Capture nutzt den leeren Default (Session-Dateien ohne objectId → ehrlich kein Link).
- Beta impact: G-P1-1 / FR-STR-02 wird sicher geschlossen; kein Legacy-Data-URL, keine breite Sanitizer-Öffnung, Link zeigt ausschließlich auf den internen Object-Store-Raw-Pfad.
- UX / Story / Knowledge-OS relevance: Datei-Referenz ist Evidence/Anhang, KEIN Status-/Trust-/Validierungssignal — Status, Vertrauen und Validierung bleiben unverändert. Honest UI: ohne objectId wird kein Link angeboten.
- New / touched requirements: FR-STR-02, G-P1-1, KG-UX-012, G-P2-1 (weiterhin offen).
- Possible gaps: Capture-Session-Dateien sind erst nach Upload (objectId) body-verlinkbar; Drag&Drop/Paste (G-P2-1) bleibt offen.
- Tests: `tests/app/body-file-link.test.ts` (Helper + FE/Server-Sanitizer-Parität + KO-Detail-kompatibler Flow). `npm run check` grün (1015 Tests), FE-tsc strict grün.
- Team6 review needed: yes
- Reason: Team6 P1 Gap FR-STR-02 / G-P1-1

### 2026-06-30 18:08 — SCRUM-354 — 57d1596

- Changed areas: Capture Submit, Draft Promote, Success Copy, HTTP E2E, Team6 handoff.
- What changed: Bei vorhandenem `draftId` aktualisiert Capture den Draft mit den aktuellen Capture-/Studio-Inhalten und promotet ihn anschließend über die vorhandene Route. Dadurch entsteht ein KO mit Status `offen`; der Draft wird serverseitig entfernt. Frische Captures ohne `draftId` bleiben auf `ko.create`.
- Beta impact: G-P1-2 / FR-STR-06 wird geschlossen; fortgesetzte Entwürfe erzeugen keine Geister-Drafts mehr im gemeinsamen Pool.
- UX / Story / Knowledge-OS relevance: Nutzer erleben den Rescue-Flow konsistent: fortgesetzter Entwurf → offenes Wissen → Review/Validierung; die Success-Card bleibt ehrlich „offen/nicht validiert“ und ergänzt den Draft-Abschluss.
- New / touched requirements: KG-UX-001, KG-UX-002, KG-UX-003, KG-UX-010, KG-UX-012, FR-STR-06.
- Possible gaps: Update+Promote ist nicht atomar; bei Promote-Fehler bleibt der aktualisierte Draft erhalten und kann erneut eingereicht werden. Datei-Anhänge im Body und Drag&Drop/Paste bleiben separat offen.
- Team6 review needed: yes
- Reason: Team6 P1 Gap FR-STR-06 / G-P1-2
