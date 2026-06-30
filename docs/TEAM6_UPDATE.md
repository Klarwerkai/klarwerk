# Team 6 Update

## Current Snapshot

- Team: Team 1 / KLARWERK Produktkern / Knowledge OS / app.klarwerk.ai
- Scope: Knowledge Input, Capture, AI-assisted Editing, Validation, KO Detail, Library, Ask, Capture → Review → Use
- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Jira Project: SCRUM
- Last updated: 2026-06-30 18:08 CEST
- Current status: SCRUM-354 umgesetzt durch Claude, Codex-Prüfung/Commit/Push/CI/Jira ausstehend
- Active ticket: SCRUM-354 — Beta Draft Promote & Knowledge Rescue Submission Integrity v0
- Last completed ticket: SCRUM-353 — Beta Knowledge Studio Guided Workspace & Contribution Quality v0
- Last commit: `892082a390ba34a1fce84a886052da08a1d15fe7`
- GitHub/CI status: SCRUM-353 CI grün; SCRUM-354 noch nicht gepusht
- Beta impact: Fortgesetzte Capture-Entwürfe werden beim Einreichen als offenes Wissen promotet, aus dem Draft-Pool entfernt und bleiben review-pflichtig.
- Team6 review needed: yes
- Reason: Team6 P1 Gap FR-STR-06 / G-P1-2
- Next planned slice: nach Pedi-Signal; Empfehlung voraussichtlich weiterer Team6-P1/P2 Input-Gap oder Beta-Flow-Härtung

## Current Risks / Gaps

| ID | Risk / Gap | Priority | Affected area | Team6 relevance | Status |
|---|---|---|---|---|---|
| G-P1-2 | Fortgesetzter Entwurf wurde bisher beim Einreichen nicht serverseitig aus dem Draft-Pool entfernt. | P1 | Capture / Drafts / Validation | FR-STR-06 MUSS, Legacy-Gap | Mit SCRUM-354 adressiert; Codex-Abschluss ausstehend |
| FR-STR-06-ATOMIC | Update und Promote laufen in zwei Requests; Promote-Fehler lässt aktualisierten Draft im Pool. | P2 | Capture / Drafts | Folgeoptimierung, kein Datenverlust | Dokumentiert, nicht Teil von SCRUM-354 |
| G-P1-1 | Datei-Anhänge im Body fehlen gegenüber Legacy. | P1/P2 je Pedi-Entscheid | Knowledge Studio / RichTextEditor | Legacy Knowledge Input Gap | Offen, nicht Teil von SCRUM-354 |
| G-P2-1 | Drag&Drop / Paste fehlen gegenüber Legacy. | P2 | RichTextEditor / Studio | Legacy Komfortparität | Offen, nicht Teil von SCRUM-354 |

## Current Requirement Touchpoints

| Requirement / Gap | Source | Status | Notes |
|---|---|---|---|
| KG-UX-001 — nicht technisch/formularartig wirken | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Success-Copy erklärt Abschluss des fortgesetzten Entwurfs ruhig und verständlich. |
| KG-UX-002 — geführter Wizard / Rescue-Flow | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Draft-Fortsetzung führt nun sauber in den Rescue-Flow bis Review. |
| KG-UX-003 / KG-UX-010 — Vereinfachung / Progressive Disclosure | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Bestehende Funktion bleibt, Datenfluss wird unter der Oberfläche bereinigt. |
| KG-UX-012 — Legacy als Referenz | Team6 `UX_KNOWLEDGE_INPUT_FEEDBACK_REVIEW_V0.md` | touched | Legacy-Verhalten „Draft beim Einreichen entfernen“ wird wiederhergestellt. |
| FR-STR-06 — Einreichen erzeugt KO offen; verbundener Entwurf wird entfernt | Team6 `EDITOR_INPUT_GAP_REVIEW_V0.md` | addressed in SCRUM-354 | Fortgesetzter Draft wird aktualisiert und dann per Promote abgeschlossen. |
| G-P1-2 — Frontend nutzt Promote/Remove nicht | Team6 `LEGACY_KNOWLEDGE_INPUT_GAP_REVIEW_V0.md` | addressed in SCRUM-354 | Capture nutzt bei `draftId` nun `drafts.update` → `drafts.promote`. |

## Delta Log

### 2026-06-30 18:08 — SCRUM-354 — pending commit

- Changed areas: Capture Submit, Draft Promote, Success Copy, HTTP E2E, Team6 handoff.
- What changed: Bei vorhandenem `draftId` aktualisiert Capture den Draft mit den aktuellen Capture-/Studio-Inhalten und promotet ihn anschließend über die vorhandene Route. Dadurch entsteht ein KO mit Status `offen`; der Draft wird serverseitig entfernt. Frische Captures ohne `draftId` bleiben auf `ko.create`.
- Beta impact: G-P1-2 / FR-STR-06 wird geschlossen; fortgesetzte Entwürfe erzeugen keine Geister-Drafts mehr im gemeinsamen Pool.
- UX / Story / Knowledge-OS relevance: Nutzer erleben den Rescue-Flow konsistent: fortgesetzter Entwurf → offenes Wissen → Review/Validierung; die Success-Card bleibt ehrlich „offen/nicht validiert“ und ergänzt den Draft-Abschluss.
- New / touched requirements: KG-UX-001, KG-UX-002, KG-UX-003, KG-UX-010, KG-UX-012, FR-STR-06.
- Possible gaps: Update+Promote ist nicht atomar; bei Promote-Fehler bleibt der aktualisierte Draft erhalten und kann erneut eingereicht werden. Datei-Anhänge im Body und Drag&Drop/Paste bleiben separat offen.
- Team6 review needed: yes
- Reason: Team6 P1 Gap FR-STR-06 / G-P1-2
