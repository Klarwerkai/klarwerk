# Team 6 Update

## Current Snapshot

- Team: Team 1 / KLARWERK Produktkern / Knowledge OS / app.klarwerk.ai
- Scope: Knowledge Input, Capture, AI-assisted Editing, Validation, KO Detail, Library, Ask, Capture → Review → Use, App-Auth/Security
- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Jira Project: SCRUM
- Last updated: 2026-06-30 19:30 CEST
- Current status: SCRUM-356 umgesetzt durch Claude, Codex-Prüfung/Commit/Push/CI/Jira ausstehend
- Active ticket: SCRUM-356 — Beta Auth Rate-Limit & Brute-Force Guard v0
- Last completed ticket: SCRUM-355 — Beta Body File Attachments via Object Store v0
- Last commit: `d7d428c216785b64c4fb38187b8e18195a5f1c40`
- GitHub/CI status: SCRUM-355 CI grün; SCRUM-356 noch nicht gepusht
- Beta impact: Serverseitiger Login-Brute-Force-Schutz — wiederholte fehlgeschlagene Anmeldeversuche werden je IP + normalisierter Login-ID gedrosselt (429 + Retry-After); erfolgreiche Logins bleiben möglich, keine User-Enumeration.
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-06 / NFR-SEC-04
- Next planned slice: nach Pedi-Signal; Empfehlung voraussichtlich G-P2-1 (Drag&Drop/Paste), Recovery/Reset-Limit oder weiterer Team6-Security-/Input-Gap

## Current Risks / Gaps

| ID | Risk / Gap | Priority | Affected area | Team6 relevance | Status |
|---|---|---|---|---|---|
| G-P1-2 | Fortgesetzter Entwurf wurde bisher beim Einreichen nicht serverseitig aus dem Draft-Pool entfernt. | P1 | Capture / Drafts / Validation | FR-STR-06 MUSS, Legacy-Gap | Mit SCRUM-354 abgeschlossen |
| FR-STR-06-ATOMIC | Update und Promote laufen in zwei Requests; Promote-Fehler lässt aktualisierten Draft im Pool. | P2 | Capture / Drafts | Folgeoptimierung, kein Datenverlust | Dokumentiert, nicht Teil von SCRUM-354 |
| G-P1-1 | Datei-Anhänge im Body fehlen gegenüber Legacy. | P1 | Knowledge Studio / RichTextEditor | Legacy Knowledge Input Gap | Mit SCRUM-355 abgeschlossen |
| FR-STR-02-SESSION | Capture-Session-Dateien haben noch keine objectId und sind daher nicht body-verlinkbar (ehrlich leerer Dropdown). | P2 | Capture / Object Store | Komfort-/Upload-Folgeoptimierung, kein Datenverlust | Dokumentiert, nicht Teil von SCRUM-355 |
| G-P2-1 | Drag&Drop / Paste fehlen gegenüber Legacy. | P2 | RichTextEditor / Studio | Legacy Komfortparität | Offen, nicht Teil von SCRUM-355/356 |
| AG-06 | Kein App-Login-Rate-Limit/Brute-Force-Schutz. | P1 | Auth / Login | NFR-SEC-04, Top Requirement #4, Team-1-Lieferung | Mit SCRUM-356 adressiert (429 + Retry-After); Codex-Abschluss ausstehend |
| AG-06-RECOVERY | Forgot/Reset-Anforderung hat noch keinen eigenen Rate-Limit (Mail-Spam-Abuse). | P2 | Auth / Recovery | Folgeoptimierung; 204-immer-Semantik bewusst unangetastet | Bewusst zurückgestellt, nicht Teil von SCRUM-356 |
| AG-07 | Kein unabhängiger Security-Review/Pen-Test. | P1 | Security gesamt | NFR-SEC-04 AK | Bei Pedi/Team 5 (EK-17), nicht Team-1-Scope |

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
| AG-06 — App-Login-Rate-Limit/Brute-Force-Schutz | Team6 `TEAM6_ACTIVE_GAPS_AND_RECOMMENDATIONS.md` | addressed in SCRUM-356 | In-Memory-Limiter im Login (IP + normalisierte Login-ID); bei Überschreitung 429 + Retry-After; Erfolg setzt Zähler zurück. |
| NFR-SEC-04 — Security / Missbrauchsschutz | Team6 `TEAM6_CURRENT_TOP_REQUIREMENTS.md` | partially addressed in SCRUM-356 | Login-Brute-Force-Drosselung geliefert + Test (Top Requirement #4). Pen-Test (AG-07) bleibt separat bei Pedi/Team 5. |
| Top Requirement #4 — Rate-Limit (429) + Test | Team6 `TEAM6_CURRENT_TOP_REQUIREMENTS.md` | addressed in SCRUM-356 | Benötigte Evidenz (Rate-Limit-Test) liegt vor: `services/auth/src/rate-limit.test.ts`. |

## Delta Log

### 2026-06-30 18:48 — SCRUM-356 — pending commit

- Changed areas: Auth-Login-Route, neuer In-Memory-Rate-Limiter, Auth-Modul-Export, Tests, Team6 handoff. KEINE Frontend-Änderung.
- What changed: Neuer abhängigkeitsfreier `LoginRateLimiter` (`services/auth/src/rate-limit.ts`) mit fixem Zeitfenster je Schlüssel (IP + normalisierte Login-ID). `/api/auth/login` prüft vor dem Loginversuch den Limiter: bei Überschreitung `429` + `Retry-After`-Header und generische Meldung (`RATE_LIMITED`). Nur falsche Zugangsdaten (`INVALID_CREDENTIALS`) zählen als Fehlversuch; erfolgreicher Login setzt den Zähler zurück. Nach Fenster-/TTL-Ablauf wird der Schlüssel wieder frei. Limiter ist pro App-Instanz und über die Routen-Optionen injizierbar (Test-Isolation).
- Beta impact: AG-06 / NFR-SEC-04 (Top Requirement #4) — serverseitiger Brute-Force-Schutz für die Beta. Kein Redis/DB, kein neues Framework, passend zum modularen Monolithen.
- Security / Story relevance: Verhalten ist für bekannte UND unbekannte Login-IDs identisch (kein Enumeration-Signal). `NOT_APPROVED` (korrektes Passwort, Konto nicht freigegeben) erhöht den Zähler nicht. Bestehende Login-Fehlersemantik (401/403) bleibt unverändert.
- Bewusst zurückgestellt: separater Rate-Limit für die Forgot/Reset-Anforderung (würde die bewusst gewählte „immer 204"-Semantik berühren und kann legitime Nutzer hinter NAT treffen) — als P2 dokumentiert.
- New / touched requirements: AG-06, NFR-SEC-04, Top Requirement #4.
- Tests: `services/auth/src/rate-limit.test.ts` (Limiter-Einheit + HTTP-Route: Erfolg möglich, 429+Retry-After, Reset bei Erfolg, Freigabe nach Fenster, keine Enumeration, NOT_APPROVED zählt nicht). `npm run check` grün (169 Dateien / 1024 Tests). Keine FE-Dateien betroffen.
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-06 / NFR-SEC-04

### 2026-06-30 18:30 — SCRUM-355 — d7d428c

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
