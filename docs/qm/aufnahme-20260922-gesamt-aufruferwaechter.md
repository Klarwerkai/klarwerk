# Aufnahme 20260922 · Gesamt-Aufruferwächter: Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-aufruferwaechter`, Revision 1.

- **Stand dieses Dokuments:** Arbeitsbaum nach Nacharbeit 6, am Kandidaten `75adf52f`. Die
  Fallaufstellung wurde am Kandidaten `b7be5168` (**1.0.0-beta.1.775**) am 08.10.2026 erhoben.
- **Erster Abgleich:** 07.10.2026 gegen **1.0.0-beta.1.730** (Basis `863a0974`). Die Zahlen aus
  diesem Abgleich sind unten als **historisch** gekennzeichnet.

Die Fassungsangaben nennen die erste `ship:`-Fassung, die den Commit enthält. Die Zählung
`1.0.0-beta.1.N` beginnt mit `.30` am 02.09.2026; „ab .30“ heißt deshalb: schon vorher gebaut,
erstmals in dieser Zählung ausgeliefert. Der Lieferbeleg für die Änderung dieses Auftrags (K4)
entsteht erst mit ihrer Veröffentlichung und steht hier deshalb noch nicht.

## Die Anliegen

| Anliegen | Geliefert (Commit · Fassung) | Beleg heute | Stand |
|---|---|---|---|
| **R-1192** Aufrufer-Wächter: gebauter Code ohne Aufrufer fällt auf | JOB 2605 D3 `fd44fb52` · JOB 2609 D1 `af733b53` · JOB 2611 D1 `081f60f5` (alle 27.08.2026, ab .30) · dynamischer Import JOB 3030 D11 `7b37c385` | `tests/capture/aufrufer-waechter.test.ts` A1–A7 | historisch erledigt, Wächter läuft im regulären Unit-Lauf |
| **R-1306** Ein Werkzeug findet Bausteine, die niemand aufruft (K1) | wie R-1192: derselbe Wächter; in diesem Auftrag geschärft (siehe „Wächter“) | A1 (Fang), A2 (Kalibrierung), A4/A5 (Gegenprobe), A7 (Methodenname), **A8** (Fremdlesekante am Syntaxbaum, seit Nacharbeit 6), **A9** (Vorgabewert in der Destrukturierung) | erfüllt; drei Messlücken in diesem Auftrag geschlossen |
| **R-1349** Jeder Fall wird angeschlossen oder begründet entfernt (K2) | dieser Auftrag, Nacharbeit 1–6 (siehe „R-1349 je Fall“) | A1 und A3 des Wächters, `tests/k3-bedarfsabgleich/bedarfsabgleich.test.ts` T3/T4/T6/T7 sowie die nachgezogenen Prüfstände | **teilweise erfüllt.** 164 der 176 Fälle sind abgeschlossen. **12 Fälle sind unerledigter Rest** (`OFFENER_REST`): Sie haben weiterhin keinen Aufrufer. Jeder ist durch eine belegte Sperre oder einen gesonderten Auftrag vom Abschluss in diesem Auftrag ausgenommen. Kein eingefrorener Eintrag mehr. |
| **UX-16b-R** Klammerzugriff auf die Word-Vorschau-Fläche muss rot werden (K3) | JOB 3264 D1 `966874cb` · ship `72b2fd17` **1.0.0-beta.1.221** (09.09.2026) | `tests/klara-webhilfe-schmal/word-weg-naechster-schritt.test.tsx` F12 (Fixtures `kalibrierung/punkt.tsx`, `kalibrierung/klammer.tsx`), F12b–F12f | erfüllt im Bestand, in diesem Auftrag nicht neu gebaut |

## Zahlen: historisch und heute

Alle Zahlen dieses Abschnitts zählen Einträge im Wächter `tests/capture/aufrufer-waechter.test.ts`.

| Zeitpunkt | eingefroren (ohne Einzelbegründung) | mit Einzelbegründung | zusammen | Quelle |
|---|---|---|---|---|
| *historisch:* Abgleich 07.10.2026 (Dokument bis Nacharbeit 3) | „175“ bzw. „174“ | „22“ | „197“ | frühere Fassung dieses Dokuments — **widersprüchlich**, siehe unten |
| Kandidat `b7be5168` (gemessen mit `git grep` am Commit) | **171** (`ALTBESTAND` 57, `ALTBESTAND_WEB` 114) | **24** (`BEWUSST` 9, `DURCH_VERSCHAERFUNG_SICHTBAR` 3, `ERSETZT_*` 2, `BEWUSST_WEB` 10) | **195** | Zählung am Commit |
| *historisch:* nach Nacharbeit 4 | **0** | **33**: `BEWUSST` 9, `BEWUSST_WEB` 9, `OFFENE_ENTSCHEIDUNG` 15, `NEUZUGANG_GEMELDET` 0 | **33** | Register am Kandidaten `75adf52f` |
| **heute** (nach Nacharbeit 6) | **0** — die Register `ALTBESTAND`, `ALTBESTAND_WEB`, `DURCH_VERSCHAERFUNG_SICHTBAR` und `ERSETZT_*` sind abgebaut | **30**: `BEWUSST` 9, `BEWUSST_WEB` 9, `OFFENER_REST` 12 (unerledigt, je mit Sperre oder gesondertem Auftrag), `NEUZUGANG_GEMELDET` 0 | **30** | Register im Arbeitsbaum |

Dazu kommen **31 gemessene Fremdlesekanten** (`FREMDLESER`), keine Ausnahmen:

- 29 Exporte aus `lib/wordAddin.ts`, die der Spiegel `public/word-addin/taskpane.js` deklariert und
  außerhalb der Deklaration verwendet;
- 2 Listen aus `services/app/src/migrationsbeleg.ts`: `scripts/insel/schema-vertrag.mjs` liest das
  Modul (`stufenAusBaum`), gibt den Text an `stufenAusQuelle` und wendet dort beide Listennamen auf
  ihn an.

BEN nannte „174 Altfälle bleiben eingefroren“. Das sind die 171 eingefrorenen Einträge plus die 3 aus
`DURCH_VERSCHAERFUNG_SICHTBAR`, die ausdrücklich als „NICHT behoben“ geführt waren.

*Historisch, nicht nachgemessen:* „587 Kandidaten, davon 194 mit belegtem Verbraucher“ (R-1349)
stammt aus einer früheren, weiteren Zählung (JOB 2386). Sie ist mit dem engen Schnitt des Wächters
nicht vergleichbar.

## R-1349 je Fall

Ausgangsmenge sind die **176 Einträge** am Kandidaten ohne Einzelabschluss:

- 171 eingefroren,
- 3 aus `DURCH_VERSCHAERFUNG_SICHTBAR` („NICHT behoben“),
- 2 aus `ERSETZT_*` („eigener Schnitt“).

| Ausgang | Anzahl | Bedeutung |
|---|---|---|
| entfernt | 102 | überholt; der Weg, den das Produkt wirklich nimmt, ist benannt (3 davon in Nacharbeit 6) |
| angeschlossen | 17 | der Produktweg ruft jetzt genau diesen Baustein statt einer Abschrift daneben |
| in den Test gezogen | 13 | Prüfzeug; aus dem Produkt nach `tests/` verlegt |
| gemessene Fremdlesekante | 28 | Word-Spiegel bzw. Schema-Vertrag; der Wächter misst die Verwendung je Name |
| **unerledigter Rest** | **12** | **nicht** angeschlossen und **nicht** entfernt; abgegrenzt durch belegte Sperre (6) oder gesonderten Auftrag (6), siehe unten |
| begründet behalten | 3 | Prüfnähte am Produktmodul (`BEWUSST`/`BEWUSST_WEB`) |
| Fehlalarm des Wächters | 1 | Wächter berichtigt (A9) |
| **zusammen** | **176** | |

Aus den Registern mit Einzelbegründung kommen zwei weitere Ausgänge hinzu:

- `ko-routes.ts::ohneImportHerkunft` ist entfernt.
- Die drei Word-Einträge aus `BEWUSST_WEB` laufen jetzt als Fremdlesekante.

### Server (`ALTBESTAND`, 57)

- **Angeschlossen (10):**
  - `csrf.ts::csrfAssessment`: `herkunftsUrteil` liest die Abwehrart.
  - `duplicate-signal.ts::A28_SIGNAL_GRENZE`: `signalStelle` liest `fremdesDupliziertMeines`.
  - `feature-flags.ts::vorgabeAn`: `schalterAn`.
  - `ko-routes.ts::KO_AKTIONEN_MIT_TORURTEIL`: das Tor der Aktionsroute.
  - `knowledge-object/types.ts::MAX_ATTACHMENTS` und `MAX_ATTACHMENT_BYTES`: `DEFAULT_UPLOAD_LIMITS`.
  - `library-analytics/repo.ts::OPEN_REVIEW_STATUSES`: `isOpenReviewStatus`.
  - `library-analytics/types.ts::pruefeGapBindung` und `pruefeInhaltsreferenzBindung`:
    `import-run-routes.ts`.
  - `model-runs/types.ts::KI_ERZEUGENDE_AUFGABEN`: der Typ von `aiGeneratedMark`.
- **Fremdlesekante (2):** `migrationsbeleg.ts::MIGRATIONS_SOLLLISTE` und
  `IRREVERSIBLE_DATENMIGRATIONEN`, gelesen von `scripts/insel/schema-vertrag.mjs`.
- **In den Test gezogen (10):**
  - `demo-corpus.ts` mit `DEMO_CORPUS_PAGE_COUNT`, `corpusConflictPairs` und `corpusImportItems`:
    nach `tests/demo-korpus/`.
  - `migrationsbeleg.ts::erzeugeStrukturbeleg` und `istStrukturstufe`: nach
    `tests/support/migrationsmodell.ts`.
  - `coverage.ts::singleRunBalances`: nach `tests/support/abdeckung-buchhaltung.ts`.
  - `confluence/adapter.ts::adapterFromConfig`: nach `tests/support/confluence-adapter.ts`.
  - `EFFECTIVE_SEARCH_DOCUMENT_FIELDS`, `METADATA_PROJECTION_FIELDS` und `SEARCH_PROJECTION_FIELDS`:
    nach `tests/support/projektion-feldvertrag.ts`.
- **Entfernt (25):**
  - `addon-principal.ts::ADDON_CAPABILITY`, `isLiteralAskPath`
  - `csrf.ts::COOKIE_STRATEGY` (der Test misst jetzt den echten Set-Cookie)
  - `demo-content.ts::DEMO_GAP_QUESTIONS`, `seed-demo.ts::DEMO_GAP_QUESTION`
  - `dev-persist.ts::readJournal`
  - `duplicate-signal.ts::befundFuerEigenesKo`
  - `example-packages.ts::EXAMPLE_PACKAGE_IDS`
  - `object-references.ts::isObjectReferenced` (Datei entfernt)
  - `reindex-queue.ts::REINDEX_CONCURRENCY`
  - `routes/naechster-schritt-entwurf.ts` (Datei entfernt, Parallelweg zu `capture-routes.ts`)
  - `capture/interview.ts::InterviewSession` (Datei entfernt)
  - `duplicate-detect.ts::overlapCandidacy`, `overlapScorePercent`
  - `METADATA_PROJECTION_MATCH_FIELDS`, `SEARCH_PROJECTION_MATCH_FIELDS`
  - `freigegebeneProjektionsfassung`, `S2_ERWEITERUNG_GRENZE`, `isReconstructedClassification`
  - `SEARCH_PROJECTION_BACKFILL_PER_QUERY`, `SEARCH_BACKFILL_LIMIT_PER_QUERY`
  - `search-captions.ts::captionsMatchQuery`
  - `lifecycle/types.ts::LifecycleError`
  - `reasoner/klara-policy.ts::KLARA_MODES`
  - `reasoner/provider.ts::keywordSelect`. Das war ein zweiter Auswahlweg, den kein Provider rief.
    14 Prüfstände messen dieselbe Menge jetzt am Produktweg `rankCandidates`, über
    `tests/support/auswahlweg.ts`.
- **Entfernt in Nacharbeit 6 (3):** `db-tx/src/write-fence.ts::PgWriteFence`, `fenceKey`
  (samt `write-fence.test.ts` und `tests/app/write-fence-race.test.ts`) und
  `kanten-service.ts::netzQualitaet` (samt dem Prüfstand `h3-551-netzqualitaet`). Gründe siehe
  „Unerledigter Rest“.
- **Unerledigter Rest (6)** und **begründet behalten (1, `InMemoryKantenRepo`):** siehe unten.

### Web (`ALTBESTAND_WEB`, 114)

- **Fremdlesekante (26):** die Exporte aus `lib/wordAddin.ts`.
- **R-0991-Kandidaten (53 B/C-Fälle ohne Word):** Der Ausgang je Fall steht maschinenlesbar in
  `tests/k3-bedarfsabgleich/bedarfsabgleich.ts` (`R1349_AUSGANG`). T7 zählt ihn nach:
  44 entfernt, 3 angeschlossen, 3 in den Test, 3 offen.
  - Angeschlossen:
    - `conflictImpact.ts::effectiveUsability`: Bibliotheks-„Mehr“ statt der eigenen Verkettung.
    - `importSelectView.ts::folderTreeSegmentKey`: der Ordnerbaum ruft ihn selbst.
    - `reviewerMinimum.ts::isNeededValidationsValid`: KI-Verwaltung statt der Literale 1 und 5.
  - In den Test gezogen: `stripAnswerMarkdown` (nach `tests/support/antwort-klartext.ts`),
    `EXAMPLE_PACKAGES_ALL_KEYS` und `KNOWLEDGE_STORY_SURFACES`.
  - Unerledigter Rest: die drei `librarySpace.ts`-Exporte.
  - Entfernt: alle übrigen. Für jeden gilt der Alternativweg aus R-0991 weiter (T4). Die Ausnahme
    sind die zwei Fälle, deren Belegdatei selbst entfernt ist (Nr. 33, Nr. 57; siehe unten).
- **Übrige Web-Einträge (35):**
  - Angeschlossen (3):
    - `d44Struktur.ts::D44_GLIEDERUNG_GRENZE`: `d44LeisteZeigen` liest die Mindestzahl.
    - `facets.ts::combinableFacetCounts`: `buildFacetGroups` zählt damit statt mit einer zweiten
      Schleife.
    - `libraryExport.ts::exportFormatMeta`: die Bibliothek liest den Formatschlüssel.
  - Unerledigter Rest (3): `ImportResultView`, `LibraryScopeBar`, `KoHomeLine`.
  - Begründet behalten (2): `ImageDescribeValueProvider` und `RICH_TEXT_ALLOWED_TAGS`.
  - Fehlalarm (1): `facetRail.ts::FACET_SEARCH_THRESHOLD`. Der Export wird als Vorgabewert einer
    Destrukturierung gelesen, das Bindungsmuster übersprang der Wächter bisher. Er ist berichtigt,
    A9 hält beide Richtungen fest.
  - Entfernt (26):
    - `GuardedNavLink`, `TopbarIcons`
    - `KoReadBody` (mit der ganzen Leseansicht)
    - `gapRescueSteps`, `conflictLead`, `ASSIST_APPLY_MODES`
    - `captureFlowSteps`, `recommendedFlowStep` (mit `CAPTURE_FLOW_STEPS`)
    - `imagesOnlyNoticeKey`, `importImageNotice`
    - `demoPilotPath`, `DUPLICATE_COMPARE_SAFETY`, `editorGuidance`, `externalAttachBlockedKey`
    - `isOcrCandidate`, `isPptxDocument` (mit `pptx.ts::isPptxDocumentLike`)
    - `knowledgeRescueImpact`, `knowledgeRescueSteps` (mit `lib/knowledgeRescue.ts`)
    - `studioGuideSteps`, `knowledgeStudioTips`, `orderedSelection`
    - `pilotChecklist`, `pilotNextSteps`, `pilotObservationGuide`, `proofChain`
    - `primaryWorkItem` (mit `canActOn`)

### Die übrigen fünf

- **Aus `DURCH_VERSCHAERFUNG_SICHTBAR`:**
  - `services/rbac/src/guard.ts::requirePermission`: entfernt samt Datei. Den 403-Satz
    `PERMISSION_DENIED` misst `tests/q9-entwurfsfehler/entwurfsfehler-sprachfaelle.test.ts` (G) jetzt
    an der Route, die ihn im Produkt sendet: Verfügen über einen fremden Pool-Entwurf.
  - `conflicts/detect.ts::pairKey`: entfernt.
  - `ask/types.ts::GAP_PRIORITIES`: angeschlossen, `isGapPriority` liest die Liste.
- **Aus `ERSETZT_*`:**
  - `KoReadView`: entfernt, samt `components/ko/KoRead.tsx` und beider Komponententests.
  - `KnowledgeRescueIntro`: entfernt, samt `lib/knowledgeRescue.ts`.

**Mitentfernt, weil der einzige Leser wegfiel:**

- `bodyReadMode.ts::BODY_READ_NOTE_KEY`
- `pptx.ts::isPptxDocumentLike`
- `captureFlowGuide.ts::CAPTURE_FLOW_STEPS`
- `intakeSimilarity.ts::textSimilarity` und `INTAKE_SIMILAR_THRESHOLD`
- `workCenter.ts::canActOn`

Die Wörterbuchschlüssel aller entfernten Bausteine bleiben stehen. Der Textbestand ist Wert für Wert
festgeschrieben (`tests/i18n-textmodule/bestand-unveraendert.test.ts`).

### Unerledigter Rest (`OFFENER_REST`, 12) und die drei Abschlüsse aus Nacharbeit 6

Nacharbeit 4 führte 15 Fälle als „offene Produktentscheidung“ und nannte R-1349 trotzdem
„abgeschlossen“. Das war falsch (BEN, Nacharbeit 6): Diese Bausteine haben weiterhin keinen
Aufrufer, R-1349 ist für sie **nicht erfüllt**. Jeder der 15 Fälle ist deshalb noch einmal einzeln
gegen die Quellen abgeglichen worden.

- **Ohne Sperre und ohne gesonderten Auftrag ⇒ abgeschlossen (3, entfernt):**
  - `kanten-service.ts::netzQualitaet` (JOB 1553, H3/SCRUM-551). Der Grund „ob und wo die Zahl
    gezeigt wird, ist offen“ trägt nicht mehr: Der Qualitätsblick des Wissensnetzes ist geliefert,
    und zwar ausdrücklich **ohne neuen Server-Weg**. Er steht in `apps/web/src/lib/netzQualitaet.ts`
    an `/graph` (R-0744, Auftrag `aufnahme:20260922:gesamt-wissensnetz`; dort
    `docs/knowledge-os/wissensnetz-themenkarte-bestandsaufnahme-2026-10-03.md`, „Es gibt keinen neuen
    Server-Weg“).
    - Entfernt sind die Funktion, ihre zwei Typen, die Fassadenexporte in
      `services/knowledge-object/index.ts` und der Prüfstand `tests/ko/h3-551-netzqualitaet.test.ts`.
  - `db-tx/src/write-fence.ts::PgWriteFence` und `fenceKey` (JOB 1060 D7). In den zugänglichen
    Quellen ist weder eine Sperre noch ein Auftrag für den Einbau belegt; der frühere Grund war eine
    Schnittgrenze („`db.ts` nicht in der D7-Lease“).
    - Die Sperre war nie scharf: Die Tabelle stand nur als Kommentar-DDL, kein Dienst band sie, und
      die Fassade `services/db-tx/index.ts` führte sie nicht.
    - Das Rennen beantwortet das Produkt heute über das versionsbedingte Einfügen
      (`services/conflicts/src/repo-pg.ts`, `insertIfVersionsCurrent`) und den fail-closed Leseweg.
      Die volle Schreib-Serialisierung ist dort als eigene Scheibe „Job-Queue“ vorgemerkt.
    - Entfernt sind das Modul, `services/db-tx/src/write-fence.test.ts` und
      `tests/app/write-fence-race.test.ts`. Die dynamische Ladestelle dieses Prüfstands ist aus
      `tests/legal/mega61-rechtsseiten.test.tsx` (`BEKANNT_UNAUFLOESBAR`) gestrichen; der
      `verwaist`-Fall dort verlangt genau das.
- **Mit belegter Sperre oder gesondertem Auftrag ⇒ unerledigter Rest (12):**

| Baustein | Abgrenzung | Beleg | Anschluss entscheidet |
|---|---|---|---|
| `reindex-queue.ts::createReindexQueue` | Sperre | BEN zu JOB 1163 (Kopf von `services/app/src/reindex-queue.ts`, Z. 16–18): Die Wahl zwischen Service-Hook und Routenanschluss ist „weiterhin nicht freigegeben“; `build-app.ts` bleibt unberührt | Produktverantwortung (Freigabe), Prüfung BEN |
| `audit/repo.ts::pruefeValidationDecisionRef` | gesonderter Auftrag | `aufnahme:20260922:gesamt-antwortbeleg` („Antwortbelege dauerhaft speichern und ihre Auflösung erklären“), R-0308. Der Anschlussort ist `AnswerExplanationService` (`services/app/src/services/answer-explanation.ts`); er liefert `evidenceValidationRefStates` heute nicht | Auftrag gesamt-antwortbeleg |
| `bestandsreset.ts::fuehreBestandsresetAus`, `bestandsreset-audit.ts::bestandsresetBefund`, `SQL_SCHEMA_BESTANDSRESET`, `reset-lock.ts::SQL_SPERRE_WIRD_GEHALTEN` | gesonderter Auftrag | `aufnahme:20260922:gesamt-bestandsreset`: R-0774 mit offenen Owner-Punkten OV-1 bis OV-5 (Sperrrichtung, Löschgraph, Auditwahrheit bei Absturz, Zielpfade, zweiter Server); R-1911 Entscheidung E9 „OFFEN“ | Owner (OV-1 bis OV-5) |
| `ImportResultView` | gesonderter Auftrag, dazu Sperre | `aufnahme:20260922:gesamt-confluence-import`, R-0142 (Original und abgeleitete Wissenseinheiten auf einer Fläche, hinter Rechte- und Funktionsschalter). Bis dahin verlangt `tests/app/w2a-import-run-routes-148.test.ts`: „ImportResultView hat weiterhin keinen Aufrufer in der Oberfläche“ | Auftrag gesamt-confluence-import (KW-S4-26) |
| `LibraryScopeBar`, `KoHomeLine`, `librarySpace.ts::koHomePath`, `serializeSpace`, `spaceFromParams` | Sperre | PLAN PRO 378 §9 führt B-1, B-2, B-3 und B-6 als **offene Sperren** („ohne Produktsprache bleiben P-1/P-2 unbenennbar“; zitiert im Kopf von `tests/library/wissensraum381-bauteile.test.tsx`). Der Server liefert kein `home` | Owner (PLAN PRO 378) |

Der Wächter führt diese 12 in `OFFENER_REST` mit Art der Abgrenzung, Beleg und Entscheider. A3
verlangt alle drei. Bei einem gesonderten Auftrag muss dessen Kennung genannt sein; eine genannte
Belegdatei muss im Baum stehen. Sobald ein Baustein einen Aufrufer hat oder entfernt ist, verlangt A3
die Streichung.

### Begründet behalten (Prüfnähte, keine halbe Funktion)

- **`BEWUSST` (9):**
  - die Testriegel `resetEmbedSemaphoreForTests`, `resetModelSemaphoreForTests`,
    `erteileKiFreigabe`, `guardedLocalPgTestUrl` und `warteAufOffeneImportLaeufe`;
  - die drei Vertragsprüfhilfen `integrationsOpenApi`, `vertragUndRoutenGleich` und
    `zustandErlaubt`;
  - `InMemoryKantenRepo` als Prüfstand des Kantenlesewegs. Er ist als Ablage falsch, die Wurzel nimmt
    `DeduplizierenderKantenBestand`.
- **`BEWUSST_WEB` (9):**
  - `clearPopAuthorityForTests` und die vier Testhilfen aus `src/test/render.tsx`;
  - `ADVANCED_FIELDS_TOTAL`, `KLARA_AVATAR_SHA256`;
  - `ImageDescribeValueProvider` (Naht in den echten Kontext);
  - `RICH_TEXT_ALLOWED_TAGS` (autoritative Allowlist für den Grenztest).

Jeder Eintrag nennt seinen Grund im Register, A3 prüft ihn.

## Der Wächter selbst (K1)

- **`FREMDLESER`:** Leser außerhalb von TypeScript werden gemessen statt geduldet.
  - Seit Nacharbeit 6 (BEN) wird am **Syntaxbaum** des Lesers gemessen, nicht an Textzeilen. Vorher
    genügten eine Zeile `console.log("name")` bzw. zwei ungenutzte Zeichenketten.
  - Art `spiegel`: Der Leser deklariert den Namen (Funktion, Klasse, Variable) und verweist
    außerhalb dieser Deklaration auf das Symbol. Zeichenketten, Kommentare, Eigenschafts- und
    Parameternamen sind keine Verweise; ein Selbstaufruf im eigenen Rumpf ist kein Aufrufer.
  - Seit Nacharbeit 9 (BEN) zählt die **Symbolbindung**, nicht der gleiche Name.
    - Der TypeScript-Prüfer (`getSymbolAtLocation`, ohne Standardbibliothek und ohne
      Modulauflösung) ordnet jeden Verweis seiner Deklaration zu.
    - Spiegel ist die äußerste gleichnamige Deklaration. Gezählt wird nur ein Verweis auf genau
      dieses Symbol.
    - Vorher deckte ein gleichnamiger Parameter (`function fremd(ziel) { ziel(); }`) oder eine
      lokale Schattenbindung den ungerufenen Spiegel.
  - Art `quelltext`: Die Kette muss im Leser stehen.
    1. `readFileSync` mit dem Modulpfad, direkt oder über eine Variable;
    2. das Gelesene geht als Argument an eine Funktion desselben Lesers;
    3. dort wird der Exportname auf genau diesen Parameter angewandt (direkt oder über eine
       Schleife über die Namensliste).
  - Kalibrierung A8 mit Positiv- und Negativfällen:
    - Es decken ein gerufener Spiegel und eine echte Lesekette.
    - Nicht decken: eine bloße Definition, ein Kommentar, eine Zeichenkette (`nurGenannt`), ein
      Eigenschaftsname (`nurEigenschaft`), ein Selbstaufruf (`nurSelbst`), ein gleichnamiger
      Parameter mit Verwendung (`nurParameter`), eine lokale Schattenbindung mit Verwendung
      (`nurGeschattet`, beide seit Nacharbeit 9), eine pfadlose
      Zeichenkette, BENs Fall mit Pfad und Name als losen Zeichenketten (`LISTE_D`) und ein Lesen
      ohne Anwendung des Namens (`LISTE_E`).
    - Ohne Leserliste deckt nichts.
- **Destrukturierung:** Ein Vorgabewert (`{ x = WERT } = o`) zählt als Leseoperation; Eigenschafts-
  und Bindungsnamen zählen nicht. Kalibrierung A9.
- **Mehrere dynamische Importe gemeinsam (Nacharbeit 7):** `Promise.all([import("./a"),
  import("./b")])` wird jetzt erkannt. Das gilt direkt mit `.then(([a, b]) => …)`, über eine
  Variable mit späterem `.then` und als `const [a, b] = await Promise.all(…)`.
  - Jede Ergebnisstelle deckt nur die Exporte ihres eigenen Moduls.
  - Kalibrierung A10 mit Negativfällen: Der Nachbar-Namensraum deckt nicht, und ein Export ohne
    Abgriff gilt nicht als gerufen.
  - Anlass waren drei Fehlalarme am Kandidaten `ed909e8e`: `allBibliothekEntries`,
    `bibliothekAuszuege` und `klaraBeispiel`, geladen in `KlaraAssistant.tsx`.
- **A3 erweitert:**
  - Grund-Pflicht in jedem Register;
  - in `OFFENER_REST`: Entscheider, Beleg, Auftragskennung beim gesonderten Auftrag und eine
    vorhandene Belegdatei;
  - kein Schlüssel in zwei Registern;
  - jeder Fremdleser mit Grund und vorhandener Leserdatei.

## Neuzugänge aus dem Hauptstand (Nacharbeit 7)

Am Kandidaten `ed909e8e` meldete A1 neun Exporte ohne Produktaufrufer. Sie kamen mit dem
integrierten Hauptstand aus den Aufträgen gesamt-hilfen und Wissensereignisse (R-0710) ins Werk.
Genau dafür ist der Wächter da. Jeder Fall ist einzeln abgeschlossen:

| Export | Ausgang | Grund |
|---|---|---|
| `klaraBibliothek.ts::allBibliothekEntries`, `bibliothekAuszuege`, `klaraBeispiele.ts::klaraBeispiel` | **Fehlalarm, Wächter berichtigt** | `KlaraAssistant.tsx` lädt beide Module über `Promise.all([import(…), import(…)])` und ruft sie (A10) |
| `klaraRegistry.ts::rankKlara` | **in den Test gezogen** | Das Produkt ruft `klaraGrundlage`, laut Quelltext ohne Bibliotheksauszüge zeichengleich. Die fünf Prüfstände messen dieselbe Rangliste über `tests/support/klara-rangfolge.ts` am Produktweg. |
| `hilfeBibliothek.ts::GLIEDERUNG`, `artikelText` | **in den Test gezogen** | Prüferwartung des Bauplan-Wächters (`artikelText`: „für Prüfungen“). Unverändert nach `tests/support/hilfe-gliederung.ts`; die Artikel bleiben im Produkt. |
| `klaraBeispiele.ts::BEISPIEL_PFLICHT` | **in den Test gezogen** | Pflichtliste nur des Prüfstands, jetzt lokal in `elementbeispiel-mounted.test.tsx`, unverändert aus denselben Registern abgeleitet |
| `wissensereignisse.ts::WEBHOOKS_TAKT_ENV` | **angeschlossen** | `server.ts` las den Namen als zweite Schreibweise `process.env.KLARWERK_WEBHOOKS_TAKT_SEK`; jetzt `process.env[WEBHOOKS_TAKT_ENV]` |
| `wissensereignisse.ts::erhebeBefunde` | **entfernt** | Hülle um `befundeAus(await ladeStand(…))`, die weder der Melder noch ein Test rief |

## Mitgeführte Prüfstände anderer Aufträge

Diese Prüfstände maßen an Bausteinen ohne Produktaufrufer. Sie messen ihre **unveränderte Zusage**
jetzt an der Stelle, die das Produkt wirklich benutzt. Keiner ist abgeschwächt.

- **R-0991 (K3) Bedarfsabgleich:**
  - Die historische Einstufung (4 A, 73 B, 5 C), T1, T2 und T5 bleiben unverändert.
  - T3, T4 und T6 lesen den R-1349-Ausgang je Fall.
  - T7 verlangt für jeden B/C-Fall genau einen Ausgang.
- **JOB 3956 / JOB 3568 (Q9):**
  - Entwurfsfehler G misst `PERMISSION_DENIED` am Pool-Verfügen statt am entfernten
    RBAC-preHandler.
  - Wächter-Sprache R2 entfällt mit dem Wächter.
  - Die Herkunftszuordnung im Katalog ist nachgezogen.
- **Import-Kandidaten W6:** am echten `POST /api/kos` statt am Helfer `ohneImportHerkunft`.
- **mega34 C1 / WP-BILD-1d / UX-27:** am Balken von `MehrAbschnitte.tsx` bzw. an der Galerie in
  `BibliothekLesen.tsx` statt an der entfernten Leseansicht.
- **Import-Meldungen K3 (39 Meldungen):** `imagesOnlyNoText`/`imagesAllDropped` ohne den Beleg
  `slide-images.test.ts`, der sie nur über die entfernte Meldungswahl nannte. Die zwei übrigen Belege
  bleiben.
- **mega39 A:** Der Prüfstand maß ausschließlich `primaryWorkItem` und ist mit ihm entfallen (siehe
  Widersprüche).
- **Weitere nachgezogene Pins:**
  - mega51-Sammler (`focus.to`), PRO-337-Sammler (Einbindungszahl), Quickwins-Pin
    (`AdminKiDetails`);
  - SCRUM-374 Anhänge (an `finalizeCaptureSubmit`);
  - Lernpfad, Lade-Phasen, Mobil-Bestätigung, OIDC, Output, PDF, Reife, Sortierung, Studio,
    Funke, Demo-Wissen.

## Abgrenzung zu gesonderten Aufträgen

- **R-0991** bleibt ein eigener, abgeschlossener Auftrag. Seine Einstufung ist nicht verändert, nur
  um den R-1349-Ausgang ergänzt.
- **Die Folgeaufträge aus den Rückgaben zu JOB 3015, 3061, 3062 und 3063** (Abbau ersetzter
  Bausteine) sind mit diesem Auftrag erledigt. Ein eigener Auftrag dazu lag in den Quellen nicht vor.
- **Der unerledigte Rest (12)** ist **nicht** erledigt. Er ist je Fall abgegrenzt:
  - Gesonderte Aufträge: `gesamt-bestandsreset` (4), `gesamt-antwortbeleg` (1),
    `gesamt-confluence-import` (1, dazu die Sperre in `w2a-import-run-routes-148`).
  - Ausdrückliche Sperren: BEN zu JOB 1163 (1) und PLAN PRO 378 §9 (5).
  - Dieser Auftrag schließt sie weder an noch entfernt er sie. Er erfindet auch keine Freigabe dafür.
- **Grenze der Quellenprüfung:** Die Auftragsliste in `QUELLEN.json` reicht nur von
  `gesamt-abhaengigkeiten-sicherheit` bis `deploy-health-commit`. Spätere Aufträge (alphabetisch nach
  „d“) konnten nicht nachgesehen werden. `gesamt-wissensnetz` ist über sein Dokument im Baum belegt,
  nicht über `QUELLEN.json`. Die Zuordnung von R-0308 zu `gesamt-antwortbeleg` beruht auf der Lage
  in derselben Quelle, unmittelbar nach der Auftragskennung.

## Quellenwidersprüche und fehlende Belege

- **Zahlen der früheren Fassung dieses Dokuments:** „174“ (Nacharbeit 3) und „175 eingefroren / 22
  begründet / 197“ (Restübersicht) widersprachen sich. Gemessen waren es am Kandidaten 171
  eingefroren und 24 begründet, zusammen 195 (siehe Tabelle). Die alten Zahlen sind oben als
  historisch markiert.
- **`conflicts/detect.test.ts`** sagte zu `pairKey`: „dasselbe Paar darf verschiedene Typen offen
  haben“. Die Anlegestelle (`service.ts`, `hasOpenPair`) entdoppelt typunabhängig. Der Test
  beschrieb eine Regel, die das Produkt nicht anwendet.
- **Import-Kandidaten W6** hieß „die öffentlichen Schreibrouten verwerfen origin=import und lassen
  andere Herkunft stehen“, prüfte aber den Helfer. Die Routen verwerfen jede Herkunft (R-0139).
  Die zweite Hälfte galt nie für die Routen.
- **`oidcCallback.ts::isCompleteCallback`** wertete einen leeren `code` als vorhanden. Der
  SSO-Rückruf (`SsoCallback.tsx`) wertet ihn als fehlend. Es war eine abweichende Zweitfassung.
- **`AdminKiDetails.tsx`** schrieb das Band 1–5 als Literale aus, neben der Bedingung in
  `reviewerMinimum.ts`.
- **R-0991 Nr. 33 und Nr. 57** belegten ihren Alternativweg mit `KnowledgeRescueIntro.tsx` bzw.
  `KoReadView.tsx`. Beide Dateien hatten selbst keinen Produktaufrufer und sind entfernt. Nr. 57
  belegt den Weg jetzt an `MehrAbschnitte.tsx`. Für Nr. 33 gibt es keinen Ersatzweg: Der
  Rettungseinstieg ist als Ganzes von der Fläche genommen (JOB 3062).
- **mega39 A (Empfehlung nur, wohin die Rolle darf):** Die Empfehlung gibt es seit JOB 3064 H5
  nicht mehr. mega39 hielt die Zahlen der Arbeitsliste ausdrücklich für alle Rollen sichtbar.
  - Ob die Karte „FÜR DICH“ Arbeitszeilen zu Zielen zeigen soll, die die Rolle nicht öffnen darf,
    ist **nicht entschieden**.
  - Dieser Auftrag entscheidet es nicht; das ist eine Produktfrage an den Owner.
- **UX-16b-R** nennt `word-weg-naechster-schritt.test.tsx:302` und einen bestehenden Wächter, der
  nur `PropertyAccessExpression` erkennt. Der Befund beim Schnitt von JOB 3264 berichtigt das
  bereits: Die Datei hatte damals 77 Zeilen und keinen Wächter. JOB 3264 hat ihn neu gebaut, mit
  Klammererkennung von Anfang an.
- **R-1306** führt den Wächter als „angedacht / IN_ARBEIT“. **R-1192** belegt Einbau und Wirkung
  (JOB 2609, 27.08.2026). Der jüngere Beleg gilt.
- **R-1349** sagt „Einbau nicht belegt“ (JOB 2386 zuletzt ROT). Aus den Quellen geht nicht hervor,
  welche drei Funktionen JOB 2386 meinte.
- **Der allgemeine Wächter** (`aufrufer-waechter.test.ts`, `namensraumZugriffe`) wertet `ns["X"]`
  nicht als Zugriff. Das macht ihn strenger, nicht blind: Der Export wird dann als „ohne Aufrufer“
  gemeldet. K3 betrifft nur den Flächenwächter der Word-Vorschau.
- **Prüfbeleg zu Nacharbeit 4** (Kandidat `efed3d49`, 1.0.0-beta.1.781; Archiv
  `HISTORIE/nacharbeit-5/PRUEFUNG`):
  - grün: Build und Format;
  - grün: Wächter und Bedarfsabgleich, 16 von 16;
  - grün: die Web-Prüfstände, 517 von 517 in 65 Dateien;
  - grün: der Auswahlweg, 193 von 193;
  - Server-Suite: 52 von 56 Dateien grün. Die vier roten sind fremde Basisstellen, siehe den
    nächsten Punkt.
- **Vier rote Prüfstände, die dieser Auftrag nur über einen Importpfad berührt.** Sie sind aus der
  Auftragsauswahl genommen; die roten Originalberichte bleiben im Archiv.
  - `tests/confluence-quellabgleich/abgleich.test.ts` (3 rot) und `runde3.test.ts` (4 rot)
    erwarten, dass eine gelöschte Seite nur einen Vermerk `sourceRemovedAt` bekommt und dass
    `fetchItem` eine 2xx-Antwort ohne Seite als Fehler wirft.
    - Die zusammengeführte Fassung in `services/app/src/confluence-import.ts` (Kommentare
      „ZUSAMMENFÜHRUNG (Nacharbeit 4)“ und „seit main“) legt das Objekt stattdessen in den
      Papierkorb. `fetchItem`/`getPageById` liefern dort „nicht vorhanden“.
    - Diese Datei ändert der Auftrag nicht. In beiden Tests ist nur der Import von
      `adapterFromConfig` auf `tests/support/confluence-adapter.ts` umgestellt; dahinter steht
      derselbe `adapterFromClient`.
    - Die übrigen Fälle beider Dateien sind grün.
  - `tests/app/job1042-hierarchie-bestandsmatrix.test.ts` M1: Die Matrix nennt 10 Dateien nicht, die
    die Hierarchiebegriffe tragen, darunter `services/jira/*`, `texte/importordner.ts` und
    `routes/jira-import-routes.ts`. Keine davon hat dieser Auftrag angelegt oder um einen solchen
    Begriff ergänzt. Seine Zeile `tests/demo-korpus/demo-corpus.ts` steht korrekt in beiden Listen.
  - `tests/q9-fremde-flaechen/keine-deutschen-literale.test.ts` R5/R6/R7: Drei neue Literale in
    `capture-routes.ts` sind ohne Ausnahme: `DOKUMENT_UNBEKANNT`, der Satz zur Dokumentkennung und
    der `confidentiality`-Satz der .docx-Übernahme.
    - Sie gehören zum fremden Dokumentkennungs- bzw. Übernahmeweg. Dieser Auftrag ändert in der
      Datei nur einen Kommentar.
    - Der eigene Teil des Auftrags (`guard.ts` aus `DATEIEN`, Ausnahmezahl 5) ist grün.
    - Ausnahmen nachzutragen hieße, den Wächter für fremden Code zu lockern; das unterbleibt.
- **Prüfbeleg am Kandidaten `75adf52f`** (Archiv `HISTORIE/nacharbeit-6/PRUEFUNG`): Build, Format
  und Wächter/Bedarfsabgleich (16 von 16) grün. Dieser Stand ist mit Nacharbeit 6 überholt, weil
  sich Wächter und Register geändert haben.
- **Prüfbeleg am Kandidaten `ed909e8e`** (Archiv `HISTORIE/nacharbeit-7/PRUEFUNG`):
  - Wächter: 8 von 9 grün, darunter A2, A3 (mit `OFFENER_REST`) und A8 (Fremdleser am
    Syntaxbaum). Bedarfsabgleich 7 von 7 grün.
  - Rot war allein A1, mit den neun Neuzugängen oben. A1 nannte keinen Namen aus `wordAddin.ts` oder
    `migrationsbeleg.ts`: Beide echten Fremdlesekanten decken also auch unter der strengeren
    Messung aus Nacharbeit 6.
  - `kanten-lesekette-sichtbarkeit` und `modulgrenze` grün.
  - In `mega61-rechtsseiten` ist der eigene Fall grün („jede benannte Ausnahme zeigt noch auf eine
    wirklich unauflösbare Stelle“, also die Streichung der Schreibsperren-Ladestelle). Rot ist
    allein die neue, fremde Ladestelle
    `tests/audit-gesamt/vorher-nachher.integration.test.ts:131` (`await import(eintritt)` des
    Vorher/Nachher-Gerüsts aus `audit-gesamt`). Diese Datei berührt der Auftrag nicht; `mega61`
    ist deshalb aus der Auswahl genommen, der rote Bericht bleibt im Archiv.
- **Prüfbeleg zu Nacharbeit 7** (Kandidat `63026488`; Archiv `HISTORIE/nacharbeit-8/PRUEFUNG`):
  - Wächter und Bedarfsabgleich: 17 von 17 grün, darunter A1 (keine Neuzugänge mehr) und A10
    (`Promise.all`).
  - Grün sind auch `klara-registry`, `bibliothek-bauplan`, `ranking-sprachweise`,
    `faq-sagt-kein-verschmelzen`, `elementbeispiel-mounted` und `melder`.
  - `tests/demo-zugang-start/vertrag-vollstaendig.test.ts` D1 ist rot. Gemeldet werden vier
    fremde Umgebungswerte ohne Startvertragseintrag: `KLARWERK_SERVICE_KEYS`
    (`dienst-schluessel.ts:37`), `KLARWERK_KI_ANFRAGEN_MAX` und
    `KLARWERK_KI_ANFRAGEN_FENSTER_SEK` (`ki-anfragebremse.ts`) sowie
    `KLARWERK_KLARA_AUFRAEUM_INTERVAL_MS` (`server.ts:242`, der Klara-Aufräumtakt).
    - Keinen davon liest dieser Auftrag. Sein eigener Anschluss (`process.env[WEBHOOKS_TAKT_ENV]`,
      `server.ts:278`) steht nicht in der Liste; der Name ist weiter im Vertrag und wird über die
      Konstante erhoben.
    - Der Prüfstand ist aus der Auswahl genommen, der rote Bericht bleibt im Archiv.
- **Fehlender Beleg:** Der Prüflauf zu Nacharbeit 9 (Symbolbindung im Spiegel, A8 mit
  `nurParameter` und `nurGeschattet`) steht aus; dieser Arbeitsgang hat keine Tests gestartet.
  Er muss auch zeigen, dass die 29 Word-Namen in `taskpane.js` unter der Bindungsprüfung weiter
  decken (A1).
  - Der Lieferbeleg (Fassung) entsteht erst mit der Veröffentlichung.
