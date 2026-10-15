# Ben-Gegenpruefung Sammel28 / Mega28

Erstellt: 2026-07-26 21:49:13 CEST
Pruefmodus: streng read-only; statische Code-, Diff- und Testinspektion

## Pruefobjekte

- Repository: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Basis/HEAD: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
- Kumulativer Diff: `_relay/patches139/mega28.diff`
- Diff-SHA-256: `7d220bd73bbba2c948b792c1a405be1fb103250e0fb848b35a94ea1025286754` - stimmt
- Hand-Bericht: `_relay/hand/outbox/BERICHT-mega28.md`
- Hand-Inhalts-SHA-256: `47c0787ff7596ec18bf395346f5adea4257019f9c33df6d1220c595b0d8c6222` - stimmt
- Arbeitsbaum: erwarteter kumulativer Mega26-Mega28-Stand; keine Aenderung durch Ben

## Executive Summary

Der technische Deckel ist wirksam: Beide Live-Erkennungswege verwenden den
zentralen Wert 20, und ihre Auswahl ist durch Score plus `refId`-Stichentscheid
deterministisch. Auch die Sorge vor einem automatischen Import-Nachlauf
bestaetigt sich nicht: Import-Accept schreibt nur `done` oder `failed`, niemals
`pending`; das Validation Board reiht ausschliesslich veraltete
`pending`-Zustaende neu ein.

Mega28 erfuellt seinen eigentlichen Auftrag, die Ehrlichkeit des gedeckelten
Laufs, jedoch nicht vollstaendig:

1. `examined` zaehlt vorab ausgewaehlte Kandidaten, nicht durchgehend die im
   aktuellen Lauf tatsaechlich geprueften Paare. Bereits offene Paare werden
   mitgezaehlt, obwohl weder deterministische noch modellgestuetzte
   Vergleichslogik laeuft.
2. Die Import-Accept-Kante nutzt die alte `judgeConflict`-/`judgeDuplicate`-
   Fassade, die `no-model`, `confidential` und normale Providerfehler zu `null`
   verdichtet. Anschliessend wird mangels Throw/`skipped` ein `done`-Status
   geschrieben. Damit kann der neue Status gerade dort eine vollstaendige
   Pruefung behaupten, wo keine inhaltliche Modellpruefung stattfand.
3. Die Abdeckungskennzeichnung erscheint nur im Validation-Badge und in der
   kurzlebigen Erfolgs-Karte auf `/erfassen`. KO-Detail, Bibliothek,
   Konflikt-/Duplikat-Leerstaende, menschliche Exporte und Pruefspur tragen die
   Einschraenkung nicht.

Das sind keine kosmetischen Restpunkte, sondern direkte Verletzungen des
Mega28-Ehrlichkeitsvertrags. Gesamtverdikt daher ROT.

## Findings

### M28-1 - ROT - Import-Accept kann ohne verwertbares Modell faelschlich `done` schreiben

**Belegkette:**

- `services/app/src/routes/library-routes.ts:303-322` ruft die beiden
  Detection-Wrapper und danach `recordImportAcceptAiCheck`.
- `services/app/src/conflict-detection.ts:76-90` und
  `services/app/src/duplicate-detection.ts:97-111` verwenden
  `reasoner.judgeConflict` bzw. `reasoner.judgeDuplicate`.
- `services/reasoner/src/service.ts:1311-1317` und `:1376-1382` geben aus dem
  strukturierten Outcome ausschliesslich `.verdict` zurueck.
- Derselbe Service liefert bei keinem verfuegbaren Modell, gesperrter
  Vertraulichkeit oder einem normalen Providerfehler `verdict:null` plus einen
  Grund (`services/reasoner/src/service.ts:1253-1305` und `:1324-1372`). Die
  Bestandsfassade verwirft diesen Grund.
- `services/app/src/routes/library-routes.ts:103-117` wertet nur
  `coverage.aborted` und `coverage.skipped` als unvollstaendig. Ein
  rueckgegebenes `null` ist weder Throw noch `skipped`; der Status wird `done`.

**Konkrete Folge:**

Bei Cloud-only ohne Key, Reasoner offline, vertraulichem Paar ohne zulaessiges
lokales Modell oder einem intern abgefangenen Provider-/Parsefehler kann
Import-Accept `aiCheck.status="done"` schreiben. Der Konfliktweg hat dann kein
inhaltliches Urteil geliefert. Beim Duplikatweg kann nur die lokale
deterministische Deckung gelaufen sein.

Das weicht vom normalen Worker ab: Dieser verwendet
`judgeConflictOutcome`/`judgeDuplicateOutcome`, beobachtet `no-model`,
`confidential` und Providerfehler und schreibt einen ehrlichen
`failed`-Grund (`services/app/src/ai-check-worker.ts:493-604`).

**Testschwaeche:**

`tests/app/import-accept-aicheck-honesty.test.ts:101-114` nennt den
Default-Aufbau einen "sauberen Lauf" und erwartet `done`, ohne zu beweisen,
dass ein Modell aktiv war oder ein einziges verwertbares Urteil geliefert
wurde. Damit pinnt der Test den problematischen Zustand statt ihn zu erkennen.

**Fix vor VIP:**

Import-Accept muss denselben Outcome-Vertrag wie `createAiCheckRunner` nutzen
oder den Runner selbst wiederverwenden. `done` darf nur entstehen, wenn alle
erforderlichen Ebenen ohne `no-model`, `confidential`, Providerfehler,
`skipped` oder `aborted` abgeschlossen wurden. Ein Test muss Reasoner-offline,
Confidential-Block und normalen Providerfehler jeweils als nicht-`done`
pinnen.

### M28-2 - ROT - `examined` ist nicht die behauptete Zahl tatsaechlich gepruefter Paare

Der Vertrag sagt:

- `services/conflicts/src/coverage.ts:26-27`: `examined` seien die Kandidaten,
  die dem Urteil tatsaechlich vorgelegt wurden.
- Die UI sagt "Geprueft gegen X von Y".

Die Implementierung setzt die Zahl jedoch vor der Schleife auf die gesamte
Auswahl:

- Duplikate: `services/conflicts/src/overlap-service.ts:185-193`
- Konflikte: `services/conflicts/src/service.ts:266-274`

In beiden Schleifen werden bereits offene Paare ohne neuen Vergleich
uebersprungen:

- Duplikate: `services/conflicts/src/overlap-service.ts:198-229`
- Konflikte: `services/conflicts/src/service.ts:279-304`

Beim Duplikatweg wird `processed` sogar vor der Open-Pair-Pruefung erhoeht.
Damit zaehlt ein vorhandener offener Befund als im aktuellen Lauf geprueft und
verbraucht zugleich einen der zwanzig Plaetze. Beispiel: 20 ausgewaehlte
Kandidaten, davon 5 mit offenem Paarbefund, ergeben `examined=20`, obwohl nur
15 aktuelle Vergleiche laufen; Rang 21 bleibt trotzdem ungeprueft.

Das ist keine reine Wortfrage. Der gespeicherte und sichtbare Satz nennt eine
falsche aktuelle Laufmenge. Die neuen Tests enthalten keinen Fall mit einem
bereits offenen Paar und koennen diese Abweichung daher nicht sehen.

**Zusaetzliche Praezisionsluecken:**

- `mergeCoverage` bildet `examined=min(conflict, duplicate)`. Das ist eine
  sichere Untergrenze der schwaecheren Teilpruefung, aber nicht die Zahl
  tatsaechlich gepruefter eindeutiger Paare. Die UI bezeichnet sie trotzdem
  als solche (`services/conflicts/src/coverage.ts:45-56`,
  `apps/web/src/i18n.ts:2068-2073`).
- Bei `aborted=true` gewinnt der Abbruchtext vor `skipped`; bereits
  aufgetretene Skip-Fehler sind fuer Menschen nicht mehr sichtbar
  (`apps/web/src/lib/aiCheckStatusCard.ts:146-161`).
- Normale, vom Reasoner in `verdict:null` verdichtete Fehler erhoehen
  `skipped` nicht. Im Worker bleibt wenigstens der `failed`-Grund erhalten;
  an Import-Accept nicht.

**Fix vor VIP:**

Coverage getrennt je Erkennungsweg fuehren oder mindestens folgende Begriffe
trennen: `available`, `selected`, `alreadyOpen`, `attempted`, `completed`,
`skipped`, `aborted`. Der Menschentext muss entweder beide Wege einzeln nennen
oder die zusammengefasste Zahl ehrlich als konservative Mindestabdeckung
bezeichnen. Tests brauchen Open-Pair-, gemischten Skip/Abort- und
unterschiedliche-Prefilter-Mengen.

### M28-3 - ROT - Die Abdeckungskennzeichnung erreicht nicht alle menschlichen Leseflaechen

**Erreicht und korrekt verdrahtet:**

- Validation-Liste:
  `apps/web/src/pages/Validation.tsx:704-755` -> `AiCheckBadge`
- Erfolgs-/Statuskarte der aktuellen Erfassen-Sitzung:
  `apps/web/src/pages/Capture.tsx:3422-3463`
- Der gemountete Test prueft das Validation-Badge:
  `tests/validation/ai-check-coverage-visible-mounted.test.tsx:48-115`

**Nicht erreicht:**

1. **KO-Detail:** Das geladene `KnowledgeObject` traegt `aiCheck.coverage`,
   aber `apps/web/src/pages/KnowledgeDetail.tsx:701-830` zeigt nur
   Reife/Trust/offene konkrete Konflikte. Coverage wird nirgends verwendet.
2. **Bibliothek:** Die Trefferzeile zeigt Reife, Status und konkrete offene
   Konflikte (`apps/web/src/pages/Library.tsx:854-924`), aber keine teilweise
   Erkennung.
3. **Konfliktseite:** `/api/conflicts` liefert nur offene Befunde
   (`services/app/src/routes/conflicts-routes.ts:9-15`). Der Leerzustand
   lautet "Keine offenen Konflikte"
   (`apps/web/src/pages/Conflicts.tsx:247-273`,
   `apps/web/src/i18n.ts:2197`), ohne Hinweis, dass nur gedeckelte Laeufe
   hinter dem Bestand stehen koennen.
4. **Duplikatseite:** `/api/duplicates` liefert nur offene Befunde
   (`services/app/src/routes/overlap-routes.ts:25-37`). Der Leerzustand
   "Keine offenen Ueberschneidungen"
   (`apps/web/src/pages/Duplicates.tsx:144-160`,
   `apps/web/src/i18n.ts:2260`) hat dieselbe Luecke.
5. **Vergleichsdetail:** `DuplicateCompare.tsx` liest ausschliesslich den
   vorhandenen Finding-Eintrag und die KOs; Coverage wird nicht gezeigt.
6. **Exporte:** JSON exportiert das rohe KO und damit das optionale Feld
   (`services/library-analytics/src/service.ts:1136-1144`). Markdown,
   MediaWiki und HTML lassen den Pruefstatus weg
   (`services/library-analytics/src/service.ts:1146-1204`). Die Output Factory
   nennt Status/Trust/Version, aber keine Teilpruefung
   (`services/output/src/render.ts:19-45` und `:146-156`).
7. **Pruefspur:** `recordAiCheckOutcome` und `resolveAiCheck` schreiben einen
   schmalen KO-Feldpatch ohne Audit
   (`services/knowledge-object/src/service.ts:1210-1226` und `:1521-1556`).
   ModelRun-Datensaetze dokumentieren einzelne Modellaufrufe, nicht die
   Gesamt-Coverage des Detection-Laufs.

Die Konflikt-/Duplikat-Leertexte sind woertlich korrekt ("keine offenen
Befunde"), laden im Produktkontext aber genau zu dem Schluss ein, vor dem
Mega28 schuetzen soll. Nach Verlassen der Erfassen-Karte ist die Teilpruefung
fuer validierte bzw. nicht mehr auf dem Validation Board sichtbare KOs in der
normalen UI nicht mehr auffindbar.

**Fix vor VIP:**

Mindestens KO-Detail und die leeren Konflikt-/Duplikat-Boards muessen den
Coverage-Vertrag sichtbar machen. Fuer aggregierte Boards braucht es eine
serverseitige Summary, weil die Finding-Endpunkte heute keine Laufabdeckung
liefern. Menschliche Exporte sollten entweder Teilpruefung ausweisen oder
explizit sagen, dass sie keine Aussage zur Konflikt-/Duplikatfreiheit treffen.
Die Capture-Karte braucht zusaetzlich einen eigenen Mounted-Pin; der vorhandene
Mounted-Test prueft nur `AiCheckBadge`.

### M28-4 - GELB - Bulk-Nulltest ist nur teilweise beidseitig kalibriert

**Stark und gueltig:**

- Der Import wird wirklich ausgefuehrt (`imported:25`).
- Reasoner-, Konflikt- und Duplikatzaehler bleiben im Bulk-Pfad null.
- Die Gegenprobe ruft den echten AI-Runner auf und beweist fuer genau diese
  drei Zaehler Werte groesser null
  (`tests/library/import-json-zero-model-calls.test.ts:196-228`).
- Der zweite Bulk-Lauf bleibt statisch nachvollziehbar ohne Detection.

**Nicht beidseitig kalibriert:**

- `queue.enqueued` wird in der Gegenprobe nicht geprueft. Die Gegenprobe ruft
  den Runner direkt auf und umgeht die Queue. Ein falsch verdrahteter
  Queue-Spion koennte deshalb unbemerkt immer null liefern.
- `embedSpy.calls` wird in der Gegenprobe ebenfalls nicht geprueft. Der Runner
  wird dort ohne `semanticPrefilter` gebaut, und der Live-Duplikatpfad nutzt
  diesen Prefilter aktuell bewusst nicht zur Poolverengung. Auch dieser
  Nullzaehler ist nicht durch eine Positivprobe kalibriert.
- Der zweite Import prueft nicht noch einmal explizit
  `{imported:25, skipped:0}`; wegen geaenderter Titel ist der Pfad statisch
  echt, aber der Test sollte die Vorbedingung selbst pinnen.

Die Null-Call-Aussage des direkten Bulk-Pfads bleibt durch Codekette und die
kalibrierten Kernzaehler richtig. Hands Aussage, dieselbe Gegenprobe kalibriere
alle Zaehler, stimmt jedoch nicht.

**Fix-Richtung:** Eine regulaere HTTP-Einreichung muss denselben Queue-Spion
auf `>0` bringen. Fuer den Embedder braucht es eine gezielte Positivprobe des
tatsaechlich erlaubten Index-/Prefilter-Pfads. Danach erst sind alle Nullen
gegen Blindheit gepinnt.

## Bestaetigte gruene Teile

### Zentraler Deckel und Kandidatenwahl - GRUEN

- `services/app/src/detection-cap.ts:35` definiert den Wert 20 einmal.
- Konflikt- und Duplikat-Liveweg importieren denselben Wert.
- `check-text-detection.ts` ist ebenfalls daran gebunden.
- Beide Kandidatenwahlen sortieren nach ihrem fachlichen Score und bei Gleichstand
  nach `refId` (`services/conflicts/src/detect.ts:113-140`,
  `services/conflicts/src/duplicate-detect.ts:138-150`).
- Die Tests drehen den Pool um und pinnen Gleichstand in beiden Wegen. Fuer die
  im Produkt verwendeten stabilen IDs ist die Auswahl damit reproduzierbar.

### Import-Accept erzeugt keinen automatischen Massen-Nachlauf - GRUEN

- `recordAiCheckOutcome` schreibt ausschliesslich `done` oder `failed`
  (`services/knowledge-object/src/service.ts:1218-1225`).
- `shouldReEnqueueAiCheck` akzeptiert ausschliesslich `status="pending"`
  (`services/app/src/ai-check-worker.ts:225-232`).
- Das Validation Board ruft diesen Guard vor jedem Re-Enqueue auf
  (`services/app/src/routes/validation-routes.ts:30-40`).
- Ein Import-Accept-Status wird daher nicht automatisch erneut eingereiht.
  Ein `failed`-Status ist nur ueber die ausdrueckliche Retry-Aktion erneut
  startbar.

### Ordner-Key-Kollision aus Sammel27 - GRUEN

Mega28 kodiert Segmente mit `encodeURIComponent`; `/` und `%` kollidieren nicht
mehr mit echten Hierarchiegrenzen. Der neue Test bildet beide Strukturen im
selben Baum ab. Dieser Sammel27-Punkt ist geschlossen.

## Bewertung der vier bewusst offenen Punkte

### 1. Wert 20 ist uebernommen, nicht gemessen

**Urteil:** fuer den VIP als Betriebsdeckel vertretbar, sofern die
Ehrlichkeitsblocker M28-1 bis M28-3 geschlossen werden.

Nicht vertretbar ist die unbelegte Zusatzbehauptung in
`services/app/src/detection-cap.ts:25-27`, Rang 21 sei "lexikalisch bereits
deutlich entfernt". Das kann ohne Bestandsmessung nicht allgemein gelten.
Kommentar korrigieren: 20 ist ein Kosten-/Betriebswert, kein belegter
Recall-Schwellenwert.

Eine Vollmessung muss nicht vor dem VIP erfolgen. Fuer spaeter sind ein
gelabeltes Stichprobenset und Recall@20/Recall@k sinnvoller als ein
ungedeckelter Produktionslauf gegen alle 12.480 Objekte.

### 2. Konfliktweg prueft wegen Vorfilter weniger als der Duplikatweg

**Urteil:** fachlich als bestehender Unterschied vertretbar; die aktuelle
zusammengefasste Darstellung ist vor VIP nicht ausreichend.

`mergeCoverage` macht die schwache Seite konservativ sichtbar, verliert aber,
welcher Weg wie weit reichte. Wegen M28-2 darf die resultierende Mindestzahl
nicht als tatsaechliche Gesamtzahl beschriftet werden. Separates Coverage je
Konflikt/Duplikat oder eine klar als Mindestabdeckung benannte Summary ist vor
VIP erforderlich.

### 3. Ab Rang 21 keine Pruefung und kein Wiederaufnahme-Weg

**Urteil:** Wiederaufnahme/Rescan darf Post-VIP bleiben. Vor VIP muss aber jede
relevante Leseflaeche ehrlich anzeigen, dass ein leeres Ergebnis nur die
ausgewaehlte Menge betrifft. Solange M28-3 offen ist, ist das Offenlassen nicht
vertretbar.

### 4. Capacity-Ursache Accept=`capacity`, Worker=`model-error`

**Urteil:** fuer den VIP vertretbare Inkonsistenz, weil der Worker
`failed` plus `coverage.aborted=true` speichert und damit keinen erfolgreichen
Lauf behauptet. Eine einheitliche Ursache verbessert Handlung und Support,
ist aber kein Blocker.

Der wesentlich ernstere Import-Unterschied ist M28-1: nicht nur Capacity,
sondern auch `no-model`, Confidential-Block und normale Providerfehler koennen
dort zu `done` verdichtet werden.

## Trennung Mega28 / Jahresring

### Mega28 selbst

- Deckel: wirksam.
- Deterministische Auswahl: wirksam.
- Kein automatischer Import-Requeue: bestaetigt.
- Ehrlichkeitsprotokoll: semantisch ungenau bei Open-Pairs und Merge.
- Import-Accept-Status: kann falsch `done` sein.
- Sichtbarkeit: nur zwei Oberflaechen, nicht produktweit.
- Testkalibrierung: Reasoner/Detection gut, Queue/Embedder unbewiesen.
- **Mega28-Verdikt: ROT.**

### Jahresring

- Direkter Bulk-JSON-Import bleibt bei null Modell-, Embedder-, Detection- und
  Queue-Aufrufen; der Kernbefund aus Sammel27 wird nicht widerlegt.
- Der Deckel begrenzt spaetere regulaere Einreichungen auf hoechstens 20
  Kandidaten je Erkennungsweg.
- Der Jahresring ist nach Bulk-Import weiterhin nicht automatisch
  konflikt-/duplikatgeprueft.
- Ein spaeterer Rescan braucht Messkonzept, Wiederaufnahme und ehrliche
  Capacity-/Coverage-Semantik, ist aber nicht Voraussetzung fuer das reine
  Laden.
- **Jahresring-Ladeentscheidung: GELB, nicht durch Modellkosten blockiert;
  keine Aussage "vollstaendig geprueft".**

## Vor-VIP-Mindestkorrekturen

1. Import-Accept an den strukturierten Judge-/Worker-Ausgang anbinden; kein
   `done` bei no-model, confidential oder Providerfehler.
2. Coverage-Zahlen semantisch korrigieren: Open-Pairs und Merge nicht als
   aktuelle tatsaechliche Paarzahl ausgeben.
3. Coverage mindestens auf KO-Detail sowie Konflikt-/Duplikat-Leerstaenden
   sichtbar machen.
4. Nulltest fuer Queue und Embedder mit echten Positivproben kalibrieren.
5. Unbelegte Aussage ueber die Distanz von Rang 21 aus dem Kommentar entfernen.

## No-op-Nachweis

- Kein Produktcode geaendert.
- Kein Patch angewandt.
- Kein Build und keine Tests ausgefuehrt.
- Kein Commit, kein Push, kein Deploy.
- Kein Jira-Zugriff.
- Keine Secrets oder ENV-Werte gelesen oder ausgegeben.
- Ausgefuehrt wurden ausschliesslich lesende Datei-, Git-, Such- und
  Hash-Pruefungen sowie das Schreiben dieses angeforderten Berichts.

GESAMTVERDIKT: ROT
SHA-256: 374b58a375ca72c0372074e867329a87099d4012e723862f7913e94526923f82
