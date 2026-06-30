# Team 6 Update

## Current Snapshot

- Team: Team 1 / KLARWERK Produktkern / Knowledge OS / app.klarwerk.ai
- Scope: Knowledge Input, Capture, AI-assisted Editing, Validation, KO Detail, Library, Ask, Capture → Review → Use, App-Auth/Security, Trust/Conflict-Integrity
- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Jira Project: SCRUM
- Last updated: 2026-06-30 21:05 CEST
- Current status: SCRUM-360 umgesetzt durch Claude, Codex-Prüfung/Commit/Push/CI/Jira ausstehend
- Active ticket: SCRUM-360 — Beta Ask Retrieval & Status-Aware Top-K v0
- Last completed ticket: SCRUM-359 — Beta Trust Formula Spec Alignment v1
- Last commit: `f71ae589e78c4dfaedab647d8ce5407e80da011a`
- GitHub/CI status: SCRUM-359 CI grün; SCRUM-360 noch nicht gepusht
- Beta impact: Ask reicht NICHT mehr blind alle KOs an den Reasoner/das Modell durch. Neue zentrale, DOM-freie, status-/trust-bewusste Top-K-Kandidatenauswahl (`selectCandidates`/`rankCandidates` in `services/reasoner/src/provider.ts`, `DEFAULT_TOP_K=8`): Keyword-Relevanz bleibt der dominante Gate (irrelevante Störer steigen nie auf), ein gedeckelter Status-/Trust-Bonus (< 1) bevorzugt bei gleicher Relevanz validierte/„ready" Quellen und höheren Trust (Trust hilft, ist aber keine Wahrheit, PI-K2). `AskService.ask` bildet die begrenzte Kandidatenmenge VOR dem Reasoner-Aufruf und schreibt Pool-/Kandidatengröße ins Audit. Ungeprüftes Wissen bleibt möglich, aber ehrlich gekennzeichnet (knowledgeClass/answerStatus unverändert). Konflikt-/Trust-Signale (SCRUM-357/358/359) fließen über Status/Trust ein und werden nicht widersprochen.
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-03 / FR-ASK-02 / NFR-PERF-03
- Next planned slice: nach Pedi-Signal; verbleibend für AG-03 ist der DB-seitige Prefilter/Index + der 100k-Lasttest (AG-03-DBINDEX, Team 1/Team 5), außerdem AG-05-TRUST-FORMULA-REST (mehrstufige §3-Formel), G-P2-1 (Drag&Drop/Paste) oder weiterer Team6-Gap

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
| AG-14 / VC-P1-1 | Konflikte wirkten nicht auf KO-Trust/-Status; Truth-Konflikt holte validiertes KO nicht in Prüfung zurück. | P1 | Conflicts / KO / Validation / Ask / Library | FR-VAL-01, Anhang §3, Top Requirement #16 | FE-Ehrlichkeit (SCRUM-357) + serverseitige Wirkung (SCRUM-358) abgeschlossen |
| AG-14-SERVER-TRUST | Truth-Konflikt holt validiertes KO serverseitig nicht in Review zurück; Trust unverändert. | P1 | Validation / KO / Trust | Anhang §3, AG-05/EK-22, Top Requirement #16 | Mit SCRUM-358 abgeschlossen: validiert→offen + konservative Trust-Strafe (markTruthConflictReview) |
| AG-05-TRUST-FORMULA | Trust-Formel (warn/down-Gewichte, Deckel) war provisorisch: `warn` wirkte gar nicht auf den Trust (Amber = stilles Voll-OK); kein 0..99-Deckel (PI-K2). | P1 | Validation / Trust-Formel | Anhang §3, EK-22, Top Requirement #7 | Mit SCRUM-359 abgeschlossen: zentrale `computeOutcome` mit warn −0.5 / down −1 / Deckel 99 + Trust-Transparenz |
| AG-05-TRUST-FORMULA-REST | Vollständig spec-konforme §3-Formel (abgestufte Konflikt-/Quellen-Gewichte je Art, mehrstufig) bleibt offen. | P2 | Validation / Trust-Formel | Anhang §3, EK-22 | Bewusst zurückgestellt: SCRUM-359 liefert die zentrale, beta-plausible Teilableitung; die mehrstufige Vollformel als Folge-Slice |
| AG-03 | Ask/Retrieval lädt alle KOs in-memory; nur Keyword; Antwortkontext unbegrenzt an Reasoner/Modell; 100k nicht belegt. | P1 | Ask / Reasoner / Retrieval | FR-ASK-02, NFR-PERF-03, A-P1-1 | Mit SCRUM-360 teilweise adressiert: begrenzte, status-/trust-bewusste Top-K-Kandidatenauswahl (kein blindes Durchreichen mehr); DB-Prefilter/100k-Lasttest bleibt offen (AG-03-DBINDEX); Codex-Abschluss ausstehend |
| AG-03-DBINDEX | Das Laden selbst (`koService.list()`) bleibt in-memory; kein DB-seitiges Ranking/Prefilter, kein Index, 100k unbelegt. | P1 | Ask / Persistence / Scale | FR-ASK-02, NFR-PERF-03, EK-23 | Bewusst zurückgestellt: SCRUM-360 begrenzt die an den Reasoner gereichte Kandidatenmenge; DB-Ranking/Prefilter (Team 1) + Lasttest 10k/100k (Team 5) als Folge-Slice |
| AG-P2-2 | Copy „ausschließlich validiert" ↔ Verhalten (antwortet aus ungeprüft, gekennzeichnet). | P2 | Ask / Copy | A-P2-1, EK-23 | Berührt: SCRUM-360 hält ungeprüfte Antworten ehrlich gekennzeichnet (answerStatus/knowledgeClass unverändert) und bevorzugt validierte Quellen; finale Copy-/„validiert-only"-Entscheidung bleibt Pedi/EK-23 |

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
| Top Requirement #7 — Trust-Formel/Vertrauensmodell | Team6 `TEAM6_CURRENT_TOP_REQUIREMENTS.md` | addressed in SCRUM-359 | Zentrale, nachvollziehbare `computeOutcome` (up +1 / warn −0.5 / down −1, Deckel 99); Amber ≠ Vollfreigabe, Trust nie „100 % wahr" (PI-K2). Mehrstufige Vollformel (AG-05-TRUST-FORMULA-REST) als Folge-Slice. |
| AG-05 / EK-22 — Trust-Formel zentral & nachvollziehbar | Team6 `TEAM6_ACTIVE_GAPS_AND_RECOMMENDATIONS.md` | addressed in SCRUM-359 | `services/validation/src/trust.ts` ist die EINE Quelle der Trust-/Status-Ableitung; warn senkt Trust messbar, down hält offen, Deckel 99 (auch Ask-Helpful-Bump). FE-Helfer (koOverview/useReadiness/libraryMaturity/trustExplainer) spiegeln konsistent. |
| PI-K2 — Trust ist keine Wahrheitsgarantie | Team6 `TEAM6_CURRENT_TOP_REQUIREMENTS.md` | addressed in SCRUM-359 | Trust deckelt bei 99 (TRUST_MAX), nie 100; KO-Detail erklärt per progressive disclosure „Review-/Evidenzsignal, kein Wahrheitsversprechen" (`trustExplainer` + i18n `trust.explain.*`). |
| AG-03 / FR-ASK-02 — relevante Wissensobjekte finden, begrenzt | Team6 `TEAM6_ACTIVE_GAPS_AND_RECOMMENDATIONS.md` | partially addressed in SCRUM-360 | Begrenzte, status-/trust-bewusste Top-K-Kandidatenauswahl (`selectCandidates`/`rankCandidates`, `DEFAULT_TOP_K`); Relevanz dominiert, validierte/ready bevorzugt; Ask reicht nicht mehr blind alles durch. DB-Prefilter/100k (AG-03-DBINDEX) offen. |
| NFR-PERF-03 — Skalierungs-/Performance-Risiko | Team6 `TEAM6_CURRENT_TOP_REQUIREMENTS.md` | partially addressed in SCRUM-360 | Antwortkontext an Reasoner/Modell ist jetzt auf topK gedeckelt (kein unbegrenztes Durchreichen). Voller 10k/100k-Lasttest bleibt Team 5 (AG-03-DBINDEX). |
| EK-23 — Ask-Semantik/Skalierung + validiert-only | Team6 `TEAM6_ACTIVE_GAPS_AND_RECOMMENDATIONS.md` | touched in SCRUM-360 | Ranking bevorzugt validierte/ready Quellen; ungeprüftes Wissen bleibt nur ehrlich gekennzeichnet (answerStatus). Endgültige „validiert-only"-Entscheidung bleibt Pedi/EK-23. |

## Delta Log

### 2026-06-30 21:05 — SCRUM-360 — pending commit

- Changed areas: Reasoner-Kandidatenauswahl `services/reasoner/src/provider.ts` (neu: `DEFAULT_TOP_K`, `statusTrustBoost`, `rankCandidates`, `selectCandidates`, Typ `RankedCandidate`), `services/reasoner/src/provider-model.ts` (select/answer nutzen `selectCandidates`), `services/reasoner/index.ts` (Exporte), `services/ask/src/service.ts` (begrenzte Kandidatenmenge vor `reasoner.answer` + Audit-Payload), Tests. KEINE FE-Source-Änderung.
- What changed: Ask reicht nicht mehr blind alle KOs an den Reasoner/das Modell durch. Neue zentrale, DOM-freie, nachvollziehbare Top-K-Kandidatenauswahl: `rankCandidates(question, candidates, topK)` (1) Relevanz-Gate über Keyword-Überschneidung (>0), (2) stabile Sortierung nach `rankScore = keywordScore + statusTrustBoost`, (3) harte Begrenzung auf `topK` (Default 8). `statusTrustBoost` ist STRIKT < 1 (validiert +0.5, Trust/100·0.4) → eine höhere Keyword-Überschneidung gewinnt IMMER (irrelevante Störer steigen nie auf), bei gleicher Relevanz werden validierte/„ready" Quellen und höherer Trust bevorzugt (Trust hilft, ist keine Wahrheit). `AskService.ask` bildet die begrenzte Menge VOR dem Reasoner-Aufruf (`selectCandidates(question, refs, DEFAULT_TOP_K)`) und schreibt `poolSize`/`candidateCount`/`topK` ins `ask.query`-Audit; der Reasoner rankt defensiv erneut (idempotent: Top-K von Top-K = Top-K). Beide Provider (deterministisch + Modell) nutzen dieselbe Auswahl; das Modell bekommt nur die gedeckelte, relevant gerankte Quellenmenge.
- Beta impact: AG-03 / FR-ASK-02 / NFR-PERF-03 — sichtbarer, beta-tauglicher Retrieval-Fortschritt ohne RAG/Embeddings/Suchmaschine/DB-Umbau. Antworten bleiben quellengebunden; validierte/relevante Quellen werden bevorzugt; ungeprüftes Wissen bleibt nur ehrlich gekennzeichnet; ohne Treffer entsteht eine ehrliche Wissenslücke.
- Designentscheidung (begründet): Ranking lebt im Reasoner-Modul (kennt nur `KnowledgeRef` mit Status/Trust — keine Modulgrenzverletzung, kein FE-Import). Status-/Trust-Bonus bewusst < 1, damit Relevanz dominant bleibt (kein „validiertes Offtopic schlägt relevantes Offenes"). Konfliktwirkung (SCRUM-357/358) fließt bereits über Status/Trust ein (Truth-Konflikt → Status offen + Trust gesenkt) → kein Widerspruch zu diesen Signalen. `keywordSelect` bleibt rückwärtskompatibel erhalten (reine Relevanz), wird aber nicht mehr für die Provider-Auswahl genutzt.
- Bewusst NICHT umgesetzt: kein RAG, keine Embeddings, keine neue Suchmaschine, keine DB-/Repo-Architekturänderung, kein DB-seitiger Prefilter/Index (das Laden bleibt `koService.list()` in-memory → AG-03-DBINDEX), kein 100k-Lasttest (Team 5). Ehrlich dokumentiert: der tiefere AG-03-Teil (DB-Ranking/Prefilter + 100k-Beleg) bleibt offen.
- New / touched requirements: AG-03 (teilweise), AG-03-DBINDEX (neu, offen), FR-ASK-02, NFR-PERF-03, EK-23/AG-P2-2 (berührt). FR-RSN-03/SCRUM-256 (Quellenbindung) unverändert.
- Tests: `services/reasoner/src/candidate-ranking.test.ts` (statusTrustBoost < 1; Relevanz-Gate; Relevanz dominiert; Status/Trust-Tiebreak bei gleicher Relevanz; topK-Bound default+explizit; leer bleibt leer) + `services/ask/src/retrieval-topk.test.ts` (Scale-Smoke ~220 KOs: Kandidatenmenge ≤ topK auditierbar, Antwort quellengebunden auf validiertes Ziel-KO, kein Störer; ohne Treffer ehrliche Lücke) + `tests/ask/ask-retrieval-topk-e2e.test.ts` (HTTP-E2E über `/api/ask`: validiertes Ziel-KO trotz vieler Störer als Quelle; ohne Treffer Lücke). Bestehende Reasoner-/Ask-Tests unverändert grün. `npm run check` grün (175 Module / 177 Dateien / 1063 Tests), Build/Biome/dependency-cruiser grün. Keine FE-Dateien geändert → FE-tsc nicht erforderlich.
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-03 / FR-ASK-02 / NFR-PERF-03

### 2026-06-30 20:45 — SCRUM-359 — f71ae58

- Changed areas: zentrale Trust-Formel `services/validation/src/trust.ts` (`computeOutcome` + neue Exporte `TRUST_WEIGHTS`, `TRUST_MAX`), `services/validation/index.ts` (Re-Export), `services/ask/src/service.ts` (Helpful-Bump-Deckel via `TRUST_MAX`), neuer FE-Helfer `apps/web/src/lib/trustExplainer.ts` + KO-Detail progressive disclosure + i18n `trust.explain.*`, Tests + Test-Assertion-Updates (Trust-Deckel 99), Team6 handoff. SCRUM-358-Truth-Penalty UNVERÄNDERT.
- What changed: `computeOutcome(verdicts, needed)` ist die EINE nachvollziehbare Trust-/Status-Ableitung. Gewichte je Peer-Bewertung: up +1, warn −0.5 (Amber = „mit Vorbehalt", KEIN volles OK), down −1 (rote Bewertung senkt stark + hält Status offen). Normierung `weighted/max(needed,1)*100`, geklemmt auf `0..TRUST_MAX (=99)`. Status `validiert` weiterhin nur bei `up >= needed && down === 0` (FR-VAL-02) — Amber blockiert die Freigabe nicht, senkt aber den Trust → „validiert mit Vorbehalt" statt stiller Vollfreigabe. Vorher wirkte `warn` GAR NICHT auf den Trust (Amber = stilles Voll-OK) — das war der Kern-Gap. Trust-Deckel 99 (`TRUST_MAX`) setzt PI-K2 um: nichts gilt je als „100 % wahr"; der „Hat geholfen"-Bump in Ask respektiert denselben Deckel (vorher `Math.min(100, …)`). KO-Detail erklärt Trust ruhig per `<details>` (Review-/Evidenzsignal, keine Wahrheitsgarantie; Band-Erklärung; Review-Hinweis nur wenn nicht ready).
- Beta impact: AG-05 / EK-22 / Top Requirement #7 / PI-K2 — Warn/Down/Amber wirken beta-plausibel und nicht wie eine Vollfreigabe; Trust ist zentral, nachvollziehbar, getestet und nie als Wahrheitsversprechen dargestellt.
- Designentscheidung (begründet): KEINE neue Trust-Engine, KEINE Migration, KEIN Auto-Truth, KEINE Statusmodell-Änderung. Pragmatische, ehrlich dokumentierte Teilableitung von Technischem Anhang §3 (lineare Gewichte + Deckel); die mehrstufige, abgestufte Vollformel (Konflikt-/Quellen-Gewichte je Art) bleibt bewusst Folge-Slice (AG-05-TRUST-FORMULA-REST). Der Trust-Deckel ist EINE Konstante (`TRUST_MAX`), über die öffentliche Modul-API auch im Ask-Modul wiederverwendet (kein Magic-Number-Duplikat; dependency-cruiser grün, kein Zyklus).
- Konsistenz Server↔FE: die FE-Helfer `koOverview`/`useReadiness`/`libraryMaturity`/`trustExplainer` spiegeln die Formel-Wirkung konsistent (validiert→ready, Amber→Band nicht „high"/Ton warn, down→nicht ready + Review-Hinweis). SCRUM-357/358-Konfliktwirkung bleibt unangetastet.
- New / touched requirements: AG-05, EK-22, PI-K2, FR-VAL-01, FR-VAL-02, Top Requirement #7. SCRUM-358-Truth-Konflikt-Penalty (AG-14-SERVER-TRUST) bleibt konsistent.
- Tests: `services/validation/src/service.test.ts` (computeOutcome: Deckel 99, warn senkt Trust, down→offen/0, Klemmung 0..99) + `tests/app/trust-explainer.test.ts` (Band→Erklärung/Ton, Review-Hinweis nur wenn nicht ready, i18n DE/EN) + `tests/validation/trust-formula-consistency-e2e.test.ts` (HTTP-E2E: up→99/ready, warn→validiert aber Trust gedrückt + Band/Explainer vorbehaltlich, down→offen/0 + überall Nacharbeit). Test-Assertion-Updates Trust 100→99 (validation-routes, conflict-trust-integrity, conflict-server-trust-impact, rework-revalidation-use, evidence-attachments-to-use, fresh-capture-to-use, service.test) und Management-Snapshot avgTrust 67→66. `npm run check` grün (174 Dateien / 1051 Tests), Build/Biome/dependency-cruiser grün, FE-tsc strict grün.
- Team6 review needed: yes
- Reason: Team6 P1 Gap AG-05 / EK-22 / Top Requirement #7

### 2026-06-30 20:20 — SCRUM-358 — a59fd65

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
