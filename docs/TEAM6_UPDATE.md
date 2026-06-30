# Team 6 Update

## Current Snapshot

- Team: Team 1 / KLARWERK Produktkern / Knowledge OS / app.klarwerk.ai
- Scope: Knowledge Input, Capture, AI-assisted Editing, Validation, KO Detail, Library, Ask, Capture → Review → Use, App-Auth/Security, Trust/Conflict-Integrity
- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Jira Project: SCRUM
- Last updated: 2026-06-30 20:20 CEST
- Current status: SCRUM-358 umgesetzt durch Claude, Codex-Prüfung/Commit/Push/CI/Jira ausstehend
- Active ticket: SCRUM-358 — Beta Trust Formula & Server-Side Conflict Impact v0
- Last completed ticket: SCRUM-357 — Beta Trust & Conflict Integrity v0
- Last commit: `24717150f98d60aeb1cc5d0bca9129b119847442`
- GitHub/CI status: SCRUM-357 CI grün; SCRUM-358 noch nicht gepusht
- Beta impact: Konfliktwirkung jetzt auch SERVERSEITIG: ein offener Wahrheitskonflikt gegen ein validiertes KO holt es serverseitig zurück in Review (Status validiert→offen, Trust konservativ gesenkt — kein Reset, keine Fake-Wahrheit). Serverdaten widersprechen der FE-Ehrlichkeit aus SCRUM-357 nicht mehr; gelöste Konflikte blockieren nicht dauerhaft (KO bleibt review-pflichtig, normal erneut validierbar).
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-05 / AG-14-SERVER-TRUST / VC-P1-1 / FR-VAL-01
- Next planned slice: nach Pedi-Signal; Empfehlung voraussichtlich vollständige spec-konforme Trust-Formel (Anhang §3, EK-22) als Fortsetzung, G-P2-1 (Drag&Drop/Paste) oder weiterer Team6-Gap

## Current Risks / Gaps

| ID | Risk / Gap | Priority | Affected area | Team6 relevance | Status |
|---|---|---|---|---|---|
| G-P1-2 | Fortgesetzter Entwurf wurde bisher beim Einreichen nicht serverseitig aus dem Draft-Pool entfernt. | P1 | Capture / Drafts / Validation | FR-STR-06 MUSS, Legacy-Gap | Mit SCRUM-354 abgeschlossen |
| FR-STR-06-ATOMIC | Update und Promote laufen in zwei Requests; Promote-Fehler lässt aktualisierten Draft im Pool. | P2 | Capture / Drafts | Folgeoptimierung, kein Datenverlust | Dokumentiert, nicht Teil von SCRUM-354 |
| G-P1-1 | Datei-Anhänge im Body fehlen gegenüber Legacy. | P1 | Knowledge Studio / RichTextEditor | Legacy Knowledge Input Gap | Mit SCRUM-355 abgeschlossen |
| FR-STR-02-SESSION | Capture-Session-Dateien haben noch keine objectId und sind daher nicht body-verlinkbar (ehrlich leerer Dropdown). | P2 | Capture / Object Store | Komfort-/Upload-Folgeoptimierung, kein Datenverlust | Dokumentiert, nicht Teil von SCRUM-355 |
| G-P2-1 | Drag&Drop / Paste fehlen gegenüber Legacy. | P2 | RichTextEditor / Studio | Legacy Komfortparität | Offen, nicht Teil von SCRUM-355/356 |
| AG-06 | Kein App-Login-Rate-Limit/Brute-Force-Schutz. | P1 | Auth / Login | NFR-SEC-04, Top Requirement #4, Team-1-Lieferung | Mit SCRUM-356 abgeschlossen |
| AG-06-RECOVERY | Forgot/Reset-Anforderung hat noch keinen eigenen Rate-Limit (Mail-Spam-Abuse). | P2 | Auth / Recovery | Folgeoptimierung; 204-immer-Semantik bewusst unangetastet | Bewusst zurückgestellt, nicht Teil von SCRUM-356 |
| AG-07 | Kein unabhängiger Security-Review/Pen-Test. | P1 | Security gesamt | NFR-SEC-04 AK | Bei Pedi/Team 5 (EK-17), nicht Team-1-Scope |
| AG-14 / VC-P1-1 | Konflikte wirkten nicht auf KO-Trust/-Status; Truth-Konflikt holte validiertes KO nicht in Prüfung zurück. | P1 | Conflicts / KO / Validation / Ask / Library | FR-VAL-01, Anhang §3, Top Requirement #16 | FE-Ehrlichkeit (SCRUM-357) + serverseitige Wirkung (SCRUM-358) abgeschlossen; Codex-Abschluss ausstehend |
| AG-14-SERVER-TRUST | Truth-Konflikt holt validiertes KO serverseitig nicht in Review zurück; Trust unverändert. | P1 | Validation / KO / Trust | Anhang §3, AG-05/EK-22, Top Requirement #16 | Mit SCRUM-358 adressiert: validiert→offen + konservative Trust-Strafe (markTruthConflictReview); Codex-Abschluss ausstehend |
| AG-05-TRUST-FORMULA | Vollständige spec-konforme Trust-Formel (Anhang §3: warn/down-Gewichte, abgestufte Konflikt-Impacts je Art) bleibt provisorisch. | P1 | Validation / Trust-Formel | Anhang §3, EK-22 | Bewusst zurückgestellt: SCRUM-358 liefert den Truth-Konflikt-Impact; vollständige Formel als Folge-Slice |

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
| AG-14 / VC-P1-1 — Konflikt-Trust-/Status-Kopplung | Team6 `VALIDATION_CONFLICTS_E2E_REVIEW_V0.md` | addressed (FE-Ebene) in SCRUM-357 | Zentrale `conflictImpact`/`conflictLimitedUsability` begrenzt Nutzbarkeit für konfliktbetroffene KOs; KO-Detail/Library/Ask konsistent; keine Server-Mutation/Fake-Wahrheit. |
| FR-VAL-01 — Peer-Bewertung → Status/Trust (Formel offen) | Team6 `VALIDATION_CONFLICTS_E2E_REVIEW_V0.md` | partially addressed in SCRUM-357 | Konfliktwirkung auf die EHRLICHE Anzeige geliefert; spec-konforme Trust-Formel (Anhang §3) bleibt offen (AG-05/EK-22). |
| FR-CON-01..04 — Konfliktworkflow | Team6 `VALIDATION_CONFLICTS_E2E_REVIEW_V0.md` | reused (unverändert) | Bestehender Workflow (create/escalate/secondOpinion/resolve, unresolved) bleibt; Wirkung wird daraus abgeleitet. |
| Top Requirement #16 — Konflikt-Trust-/Status-Kopplung | Team6 `TEAM6_CURRENT_TOP_REQUIREMENTS.md` | addressed (FE + Server) in SCRUM-357/358 | FE-Ehrlichkeit (357) + serverseitige Wirkung (358: validiert→offen + Trust-Strafe). |
| AG-14-SERVER-TRUST — serverseitige Trust-/Status-Kopplung | Team6 `VALIDATION_CONFLICTS_E2E_REVIEW_V0.md` | addressed in SCRUM-358 | Truth-Konflikt holt validiertes KO serverseitig in Review (`KoService.markTruthConflictReview`); Trust −12 (Anhang §3-nah), kein Reset. |
| AG-05 — Trust-Formel provisorisch | Team6 `TEAM6_ACTIVE_GAPS_AND_RECOMMENDATIONS.md` | partially addressed in SCRUM-358 | Truth-Konflikt-Trust-Impact geliefert + getestet; vollständige spec-konforme Formel (warn/down-Gewichte, abgestufte Konflikt-Impacts) bleibt Folge-Slice (EK-22). |
| Top Requirement #7 — Trust-Formel/Vertrauensmodell | Team6 `TEAM6_CURRENT_TOP_REQUIREMENTS.md` | partially addressed in SCRUM-358 | Erster spec-naher Trust-Impact (Konflikt) serverseitig wirksam; Restformel als Folge-Gap dokumentiert. |

## Delta Log

### 2026-06-30 20:20 — SCRUM-358 — pending commit

- Changed areas: `KoService.markTruthConflictReview` (neu) + Trust-Penalty-Konstante (knowledge-object), Dispatcher-Hook (ko-routes conflict-case), Tests; SCRUM-357-E2E an neue Serverwirkung angepasst. KEINE FE-Source-Änderung.
- What changed: Neue KO-Service-Methode `markTruthConflictReview(id, actor)` — ein offener WAHRHEITSKONFLIKT gegen ein VALIDIERTES KO setzt Status validiert→offen und senkt Trust um `TRUTH_CONFLICT_TRUST_PENALTY` (=12, Anhang-§3-nah), mit Audit `ko.conflict-review`. Idempotent/No-op für offene/fehlende KOs (robust bei Konflikten gegen nicht existierende/offene Bezugs-KOs). Der KO-Dispatcher ruft die Methode im `conflict`-Case für beide referenzierten KOs auf, wenn `type === "truth"`. `resolve` bleibt bewusst ohne Auto-Erholung: das KO bleibt review-pflichtig und wird über die normale Bewertung erneut validiert.
- Beta impact: AG-05 / AG-14-SERVER-TRUST / VC-P1-1 — Serverdaten widersprechen der FE-Ehrlichkeit (SCRUM-357) nicht mehr. Ein offener Truth-Konflikt lässt ein validiertes KO serverseitig nicht als voll vertrauenswürdig/status-ready stehen.
- Designentscheidung (begründet): Integration im KO-Service + App-Dispatcher (risikoärmste Stelle: KO besitzt die Status-/Trust-Transition; Dispatcher orchestriert, KEIN neuer Cross-Modul-Dependency, KEINE Trust-Engine). Kein Reset auf 0 → keine maschinelle „falsch"-Aussage (keine Fake-Wahrheit). Kein Auto-Validate nach resolve → kein Fake-Validate, kein Dauer-Block.
- „Trust-Formel / Amber / Down": `computeOutcome` (warn/down → Trust/Status) bleibt unverändert (provisorisch). Bewusst NICHT in diesem Slice angefasst — die vollständige spec-konforme Formel ist eng mit AG-05/EK-22 verbunden und bleibt Folge-Gap (AG-05-TRUST-FORMULA). Geliefert wird der konkret geforderte Truth-Konflikt-Impact.
- New / touched requirements: AG-05 (teilweise), AG-14-SERVER-TRUST, VC-P1-1, FR-VAL-01, FR-CON-01..04 (Dispatcher-Hook), EK-22/EK-25, Top Requirements #7/#16.
- Tests: `services/knowledge-object/src/service.test.ts` (markTruthConflictReview: validiert→offen+Strafe, No-op offen/fehlend, Floor bei 0) + `tests/validation/conflict-server-trust-impact-e2e.test.ts` (HTTP: validiert→Truth-Konflikt→offen+Trust gesenkt, Board listet, Ask konsistent, resolve→review-pflichtig→re-rate validiert; Nicht-Truth unverändert). `tests/validation/conflict-trust-integrity-e2e.test.ts` (SCRUM-357) an die neue Serverwirkung angepasst. `npm run check` grün (172 Dateien / 1040 Tests), FE-tsc strict grün.
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-05 / AG-14-SERVER-TRUST / VC-P1-1 / FR-VAL-01

### 2026-06-30 19:55 — SCRUM-357 — 2471715

- Changed areas: neuer DOM-freier Helfer `conflictImpact.ts`, `askView.ts` (konfliktbewusste Quellen), KO-Detail, Library, Ask, i18n, Tests, Team6 handoff. KEINE Backend-/Service-Änderung.
- What changed: Zentrale Ableitung `conflictImpact(koId, conflicts)` (offen/eskaliert/zweitmeinung wirken, Truth am stärksten, gelöst wirkt nicht) + `conflictLimitedUsability(base, impact)` (ready → in-review) + `conflictNotice`/`effectiveUsability` + `conflictAwareSourceRefs` für Ask. KO-Detail zeigt Konflikt-Badge + Banner und nutzt die begrenzte Nutzbarkeit; Library begrenzt die Reife-Plakette + leitet konfliktbetroffene Treffer auf die Konfliktseite statt in Ask; Ask markiert konfliktbetroffene Quellen, zeigt einen Antwort-Hinweis und stuft die Quellen-Nutzbarkeit herunter.
- Beta impact: AG-14 / VC-P1-1 / Top Requirement #16 — validiertes Wissen mit offenem (Truth-)Konflikt erscheint nicht mehr als „uneingeschränkt nutzbar/gesichert". Knowledge-OS-Ehrlichkeit über KO-Detail/Library/Ask konsistent.
- Designentscheidung (begründet): KEINE neue Trust-Formel-Architektur und KEINE serverseitige Status-Rückführung (validiert→offen). Das würde die Validierungs-/Trust-Logik (`computeOutcome`/`setValidationState`) und Modulgrenzen berühren (große Architekturänderung, im Ticket ausgeschlossen) und widerspräche der dokumentierten „keine maschinelle Wahrheitsfindung"-Entscheidung (`conflictView.resolutionEffect`). Stattdessen EINE zentrale, ehrliche „conflict-limited usability"-Ableitung — keine Fake-Wahrheit, kein Fake-Block. Server-Status/Trust/Antwortlogik unverändert.
- „Keine Fake-Wahrheit": ein Konflikt macht ein KO nicht falsch; ein offener Konflikt heißt „Review nötig" → Nutzbarkeit ehrlich „in Prüfung". Gelöste Konflikte fallen aus der unresolved-Liste → blockieren nicht weiter (getestet).
- New / touched requirements: AG-14, VC-P1-1, FR-VAL-01, FR-CON-01..04 (wiederverwendet), AG-05/EK-22 (zurückgestellt), Top Requirement #16.
- Tests: `tests/app/conflict-impact.test.ts` (Helper + konfliktbewusste Quellen) + `tests/validation/conflict-trust-integrity-e2e.test.ts` (HTTP-E2E: validiertes KO → Truth-Konflikt → Nutzbarkeit/Review begrenzt, Server-Status/Trust unverändert, Ask-Quelle nicht ready; resolve → wieder nutzbar). `npm run check` grün (171 Dateien / 1035 Tests), FE-tsc strict grün.
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-14 / VC-P1-1 / FR-VAL-01

### 2026-06-30 18:48 — SCRUM-356 — 27f59ee

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
