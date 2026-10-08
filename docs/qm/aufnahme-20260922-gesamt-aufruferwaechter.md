# Aufnahme 20260922 · Gesamt-Aufruferwächter: Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-aufruferwaechter`, Revision 1.

- **Stand dieses Dokuments:** Arbeitsbaum nach Nacharbeit 4. Grundlage ist der Kandidat `b7be5168`
  (**1.0.0-beta.1.775**), am 08.10.2026 abgeglichen.
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
| **R-1306** Ein Werkzeug findet Bausteine, die niemand aufruft (K1) | wie R-1192: derselbe Wächter; in diesem Auftrag geschärft (siehe „Wächter“) | A1 (Fang), A2 (Kalibrierung), A4/A5 (Gegenprobe), A7 (Methodenname), **A8** (Fremdlesekante), **A9** (Vorgabewert in der Destrukturierung) | erfüllt; zwei Messlücken in diesem Auftrag geschlossen |
| **R-1349** Jeder Fall wird angeschlossen oder begründet entfernt (K2) | dieser Auftrag, Nacharbeit 1–4 (siehe „R-1349 je Fall“) | A1 und A3 des Wächters, `tests/k3-bedarfsabgleich/bedarfsabgleich.test.ts` T3/T4/T6/T7 sowie die nachgezogenen Prüfstände | **jeder Fall einzeln abgeschlossen.** Kein eingefrorener Eintrag mehr. 15 Fälle warten mit Grund und Entscheider auf eine Produktentscheidung, 18 Prüfnähte stehen mit Grund. |
| **UX-16b-R** Klammerzugriff auf die Word-Vorschau-Fläche muss rot werden (K3) | JOB 3264 D1 `966874cb` · ship `72b2fd17` **1.0.0-beta.1.221** (09.09.2026) | `tests/klara-webhilfe-schmal/word-weg-naechster-schritt.test.tsx` F12 (Fixtures `kalibrierung/punkt.tsx`, `kalibrierung/klammer.tsx`), F12b–F12f | erfüllt im Bestand, in diesem Auftrag nicht neu gebaut |

## Zahlen: historisch und heute

Alle Zahlen dieses Abschnitts zählen Einträge im Wächter `tests/capture/aufrufer-waechter.test.ts`.

| Zeitpunkt | eingefroren (ohne Einzelbegründung) | mit Einzelbegründung | zusammen | Quelle |
|---|---|---|---|---|
| *historisch:* Abgleich 07.10.2026 (Dokument bis Nacharbeit 3) | „175“ bzw. „174“ | „22“ | „197“ | frühere Fassung dieses Dokuments — **widersprüchlich**, siehe unten |
| Kandidat `b7be5168` (gemessen mit `git grep` am Commit) | **171** (`ALTBESTAND` 57, `ALTBESTAND_WEB` 114) | **24** (`BEWUSST` 9, `DURCH_VERSCHAERFUNG_SICHTBAR` 3, `ERSETZT_*` 2, `BEWUSST_WEB` 10) | **195** | Zählung am Commit |
| **heute** (nach Nacharbeit 4) | **0** — die Register `ALTBESTAND`, `ALTBESTAND_WEB`, `DURCH_VERSCHAERFUNG_SICHTBAR` und `ERSETZT_*` sind abgebaut | **33**: `BEWUSST` 9, `BEWUSST_WEB` 9, `OFFENE_ENTSCHEIDUNG` 15 (jeder mit Entscheider), `NEUZUGANG_GEMELDET` 0 | **33** | Register im Arbeitsbaum |

Dazu kommen **31 gemessene Fremdlesekanten** (`FREMDLESER`), keine Ausnahmen:

- 29 Exporte aus `lib/wordAddin.ts`, die der Spiegel `public/word-addin/taskpane.js` definiert und ruft;
- 2 Listen aus `services/app/src/migrationsbeleg.ts`, die `scripts/insel/schema-vertrag.mjs` aus dem
  Quelltext liest.

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
| entfernt | 99 | überholt; der Weg, den das Produkt wirklich nimmt, ist benannt |
| angeschlossen | 17 | der Produktweg ruft jetzt genau diesen Baustein statt einer Abschrift daneben |
| in den Test gezogen | 13 | Prüfzeug; aus dem Produkt nach `tests/` verlegt |
| gemessene Fremdlesekante | 28 | Word-Spiegel bzw. Schema-Vertrag; der Wächter misst den Aufruf je Name |
| offene Produktentscheidung | 15 | mit Grund und Entscheider in `OFFENE_ENTSCHEIDUNG` |
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
- **Offen (9)** und **begründet behalten (1, `InMemoryKantenRepo`):** siehe die Tabellen unten.

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
  - Offen: die drei `librarySpace.ts`-Exporte.
  - Entfernt: alle übrigen. Für jeden gilt der Alternativweg aus R-0991 weiter (T4). Die Ausnahme
    sind die zwei Fälle, deren Belegdatei selbst entfernt ist (Nr. 33, Nr. 57; siehe unten).
- **Übrige Web-Einträge (35):**
  - Angeschlossen (3):
    - `d44Struktur.ts::D44_GLIEDERUNG_GRENZE`: `d44LeisteZeigen` liest die Mindestzahl.
    - `facets.ts::combinableFacetCounts`: `buildFacetGroups` zählt damit statt mit einer zweiten
      Schleife.
    - `libraryExport.ts::exportFormatMeta`: die Bibliothek liest den Formatschlüssel.
  - Offen (3): `ImportResultView`, `LibraryScopeBar`, `KoHomeLine`.
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

### Offene Produktentscheidungen (`OFFENE_ENTSCHEIDUNG`, 15)

| Baustein | warum nicht angeschlossen | entscheidet |
|---|---|---|
| `reindex-queue.ts::createReindexQueue` | Anschlusswahl (Service-Hook oder Route) und Herkunft der Kennungen „weiterhin nicht freigegeben“ | Produktverantwortung, Prüfung BEN |
| `audit/repo.ts::pruefeValidationDecisionRef` | Leseweg mit Kettenprüfung nicht beschlossen (Auftrag 67) | Produktverantwortung |
| `write-fence.ts::PgWriteFence`, `fenceKey` | gemeinsame Schreibsperre (JOB 1060 D7) an keinen Dienst gebunden; Einbau ändert das Schreibverhalten unter Last | Betriebs-/Architekturentscheidung |
| `bestandsreset.ts::fuehreBestandsresetAus`, `bestandsreset-audit.ts::bestandsresetBefund`, `SQL_SCHEMA_BESTANDSRESET`, `reset-lock.ts::SQL_SPERRE_WIRD_GEHALTEN` | Löschgraph laut Rückgabe JOB 596 D8 „Vorschlag, nicht Entscheidung“ (V-1); kein Betreiberweg | Produktverantwortung |
| `kanten-service.ts::netzQualitaet` | ob und wo die Netzqualität gezeigt wird | Produktverantwortung |
| `ImportResultView` | Sichtbarkeit der W2-Resultatfläche ist eine eigene Tranche (KW-S4-26); W2-A/148 Block 5 verlangt bis dahin keinen Aufrufer | Produktverantwortung |
| `LibraryScopeBar`, `KoHomeLine`, `librarySpace.ts::koHomePath`, `serializeSpace`, `spaceFromParams` | Server liefert kein `home`; das Wort für den Ort ist offen (PLAN PRO 378) | Owner |

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
  - Art `spiegel`: Der Leser definiert den Namen und nennt ihn auf einer weiteren Codezeile.
  - Art `quelltext`: Der Leser nennt Modulpfad und Name auf einer Codezeile.
  - Kalibrierung A8: Ein gerufener Spiegel deckt. Eine bloße Definition, ein Kommentar oder eine
    pfadlose Zeichenkette decken nicht. Ohne Leserliste deckt nichts.
- **Destrukturierung:** Ein Vorgabewert (`{ x = WERT } = o`) zählt als Leseoperation; Eigenschafts-
  und Bindungsnamen zählen nicht. Kalibrierung A9.
- **A3 erweitert:**
  - Grund-Pflicht in jedem Register;
  - Entscheider-Pflicht in `OFFENE_ENTSCHEIDUNG`;
  - kein Schlüssel in zwei Registern;
  - jeder Fremdleser mit Grund und vorhandener Leserdatei.

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
- **Die 15 offenen Produktentscheidungen** gehören nicht diesem Auftrag. Er führt sie nur sichtbar
  mit Entscheider; sie werden weder angeschlossen noch entfernt.

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
- **Fehlender Beleg:** Die Prüfläufe zu Nacharbeit 4 stehen noch aus. Sie sind im Prüfplan des
  Auftrags benannt; dieser Arbeitsgang hat keine Tests gestartet. Auch der Lieferbeleg (Fassung)
  entsteht erst mit der Veröffentlichung.
