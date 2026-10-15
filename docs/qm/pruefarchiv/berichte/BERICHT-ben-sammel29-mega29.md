# BERICHT ben sammel29 - Gegenpruefung mega29

Erstellt: 2026-07-26 23:18:36 CEST
Arbeitsverzeichnis: `/Users/peterkohnert/Documents/dev_Klarwerk`
Gepruefte Basis: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
Pruefart: streng read-only; statische Code-, Diff-, Test- und Berichtsanalyse

## Kurzurteil

mega29 schliesst M28-4 und wesentliche Teile von M28-1 bis M28-3. Das ROT aus
sammel28 ist trotzdem nicht aufgehoben. Drei unmittelbar auftragsrelevante
Ehrlichkeitsfehler bleiben:

1. Strukturierte Modellfehler werden im Runner korrekt als fehlgeschlagener
   Lauf erkannt, in der Coverage aber trotzdem als `completed` gezaehlt.
2. Die neue Bestandszusammenfassung wertet den Laufstatus nicht aus und kann
   deshalb fehlgeschlagene Laeufe als vollstaendig sowie Altlaeufe ohne
   Coverage faelschlich als "gar nicht geprueft" darstellen.
3. Der Warnsatz der vier menschlichen Ausgabewege ist zwar vorhanden, steht
   aber jeweils erst hinter dem eigentlichen, potenziell langen Dokument.

M28-1 ist zusaetzlich betrieblich nur GELB: Import-Accept ruft den Runner
synchron ohne den 120-Sekunden-Timeout des Workers auf. Ein haengender Provider
kann die Accept-Route unbegrenzt festhalten, ohne dass ein Abschlussstatus
geschrieben wird.

## Findings

### ROT-1 - `completed` behauptet bei realen strukturierten Modellfehlern einen fehlerfreien Vergleich

Der neue Vertrag definiert `completed` als "ohne Fehler zu Ende verglichen":

- `services/conflicts/src/coverage.ts:46-55`

Der reale Runner beobachtet den strukturierten Reasoner-Ausgang, merkt sich
`providerFailure`, `model-error`, `model-timeout` und `confidential`, gibt an
die Erkennung aber nur `outcome.verdict` weiter:

- `services/app/src/ai-check-worker.ts:509-522`
- `services/app/src/ai-check-worker.ts:532-562`
- `services/app/src/ai-check-worker.ts:583-603`

Damit endet ein normaler 401-/429-/Netz-/Parsefehler nicht als Exception im
Detection-Kern, sondern als `null`-Verdict.

Im Konfliktweg wird nach jedem normal zurueckgekehrten `judge`-Aufruf
`completed += 1` ausgefuehrt. `skipped` steigt nur bei einer geworfenen
Exception:

- `services/conflicts/src/service.ts:333-352`

Im Duplikatweg wird nach `compareCandidate` ebenfalls `completed += 1`
ausgefuehrt. Zusaetzlich verschluckt `modelVerdict` alle geworfenen
Modellfehler ausser `ModelCapacityError` und macht daraus `null`:

- `services/conflicts/src/overlap-service.ts:252-267`
- `services/conflicts/src/overlap-service.ts:289-315`
- `services/conflicts/src/overlap-service.ts:487-507`

Konkrete Folge: Ein 429, `no-model` oder `confidential` kann den KO-Status
korrekt auf `failed` setzen, waehrend dieselben Kandidaten in der Coverage als
fehlerfrei `completed` stehen und `skipped === 0` bleibt. Der neue Test prueft
bei diesen drei Faellen nur Status und Ursache, nicht die Coverage:

- `tests/app/import-accept-aicheck-honesty.test.ts:185-233`

Nur der kuenstlich geworfene Konfliktfehler prueft `skipped` und
`completed === 0`:

- `tests/app/import-accept-aicheck-honesty.test.ts:254-272`

Impact: Die sichtbare Mindestabdeckung kann zu hoch sein. Der DE-/EN-/NL-Text
ist sprachlich korrekt formuliert, aber die zugrunde liegende Zahl ist nicht
zuverlaessig.

Fix-Richtung: Der Vergleich muss einen expliziten Ausgang
`completed | skipped | aborted` bis in die Schleife tragen. Ein
`null`-Verdict darf nur dann `completed` bedeuten, wenn der Reasoner wirklich
ein gueltiges Nicht-Treffer-Urteil geliefert hat. Structured failures muessen
auf beiden Wegen `skipped` erhoehen und duerfen `completed` nicht erhoehen.

### ROT-2 - Coverage-Summary ignoriert `aiCheck.status` und kann leere Boards falsch entwarnen

`aiCheckCoverageSummary()` unterscheidet nur:

- kein Coverage-Objekt -> `unchecked`
- `capped || aborted || skipped > 0` -> `incomplete`
- sonst implizit vollstaendig

Beleg:

- `services/knowledge-object/src/service.ts:1485-1499`

Der Laufstatus `pending | done | failed` und `fallbackReason` werden nicht
ausgewertet. Dadurch entstehen zwei falsche Aussagen:

1. Ein `failed`-Lauf mit strukturiertem Providerfehler, `no-model` oder
   `confidential`, dessen Coverage nach ROT-1 keine Flags traegt, wird als
   vollstaendig behandelt. Sind alle Objekte so beschaffen, liefert die Route
   `incomplete=0, unchecked=0`; die Caveat-Komponente rendert dann gar nichts:
   `apps/web/src/components/AiCheckCoverageHint.tsx:52-70`.
2. Ein historischer oder anderweitig vorhandener `aiCheck`-Status ohne das neue
   Coverage-Feld wird als `unchecked` gezaehlt. Der Text sagt jedoch in DE
   "gar keinen", in EN "none at all" und in NL "helemaal geen" Lauf:
   `apps/web/src/i18n.ts:2073-2077`,
   `apps/web/src/i18n.ts:5822-5826`,
   `apps/web/src/i18n.ts:9508-9512`.

Die Summary-Tests decken capped, complete, aborted und ein Objekt ganz ohne
`aiCheck` ab, aber weder `failed` ohne Coverage-Flag noch einen Altstatus ohne
Coverage:

- `tests/library/ai-check-coverage-reach.test.ts:79-140`

Impact: Genau die beiden leeren Boards, die mega29 ehrlich machen soll, koennen
bei realem Modellfehler ohne Warnung erscheinen. Bei Altbestand wird dagegen
eine ungenaue Historienbehauptung angezeigt.

Fix-Richtung: `failed` immer als unvollstaendig zaehlen. `pending` separat oder
ebenfalls als nicht abgeschlossen behandeln. Fehlende Coverage bei vorhandenem
Laufstatus als "keine Abdeckung nachgewiesen" statt "gar kein Lauf"
formulieren. Tests fuer `failed/no-model`, `failed/provider`, `pending` und
Legacy-`done` ohne Coverage ergaenzen.

### ROT-3 - Alle vier menschlichen Warnhinweise sind am Dokumentende vergraben

Der verlangte Satz ist in allen vier Ausgabewegen vorhanden:

1. MediaWiki: `services/library-analytics/src/service.ts:1168-1176`
2. Markdown: `services/library-analytics/src/service.ts:1179-1205`
3. HTML: `services/library-analytics/src/service.ts:1208-1237`
4. Output Factory: `services/output/src/service.ts:69-81` und
   `services/output/src/render.ts:154-168`

Er steht jedoch in allen vier Faellen nach allen Wissensobjekten bzw. nach dem
gesamten Body im Herkunftsblock. Bei einem langen Export sieht der Leser den
Hinweis erst am Ende. Das erfuellt die ausdrueckliche Vorgabe "wo ein Leser ihn
sieht, statt am Ende eines langen Dokuments" nicht.

Die Tests pruefen nur `toContain`, nicht die Position:

- `tests/library/ai-check-coverage-reach.test.ts:143-183`

Fix-Richtung: Den Warnsatz direkt unter Titel/Exportkopf platzieren; optional am
Ende wiederholen. Tests muessen die Reihenfolge `Titel -> Warnsatz -> erster
Inhalt` pinnen.

### GELB-1 - Import-Accept verwendet denselben Runner, aber nicht dessen Worker-Zeitgrenze

Positiv:

- Die Route ruft jetzt direkt `createAiCheckRunner` auf und schreibt genau
  einmal mit `recordAiCheckOutcome`:
  `services/app/src/routes/library-routes.ts:296-310`.
- `recordAiCheckOutcome` schreibt ohne pending-Voraussetzung ehrlich `done`
  oder `failed` samt Coverage:
  `services/knowledge-object/src/service.ts:1211-1227`.
- Es gibt an dieser Kante keine Queue und keinen zweiten Statusschreiber.
- `no-model`, `confidential`, strukturierte Providerfehler, geworfene Fehler
  und Capacity erreichen den Runner-Ausgang:
  `services/app/src/ai-check-worker.ts:493-604`.

Abweichung:

Der regulaere Worker kapselt denselben Runner in `runWithTimeout` und schliesst
nach der Frist mit `fallbackReason: "timeout"`:

- `services/app/src/ai-check-worker.ts:235-267`
- `services/app/src/ai-check-worker.ts:364-395`

Die Import-Accept-Route wartet dagegen direkt und synchron auf den Runner. Ein
Provider, der nie settled, blockiert die Route ohne Statusabschluss. Das ist
kein zweiter Regelausleger, aber eine echte abweichende Fehlerbehandlung und
Warteschlangenwirkung.

Fix-Richtung: Entweder Import-Accept wie den normalen Einreicheweg auf
pending+Queue umstellen oder denselben exportierten Timeout-Rahmen verwenden.
Der Statuswrite muss auch beim Timeout eindeutig und einmalig bleiben.

### GELB-2 - Eine achte irrefuehrende Leseflaeche bleibt sichtbar

Die sieben in sammel28 genannten Flaechen sind jetzt wie folgt:

**Kennzeichnung vorhanden**

- Validation-Liste: `AiCheckBadge`
- Capture-Erfolgskarte: Coverage-Text
- KO-Detail: `apps/web/src/pages/KnowledgeDetail.tsx:817`
- Konflikt-Leerstand: `apps/web/src/pages/Conflicts.tsx:261`
- Duplikat-Leerstand: `apps/web/src/pages/Duplicates.tsx:165`
- Menschliche Exporte: Warnsatz vorhanden, aber Position nach ROT-3 mangelhaft

**Bewusst nach VIP-2 verschoben**

- Bibliotheks-Trefferzeile: keine Coverage-Kennzeichnung
- `DuplicateCompare`: keine Coverage-Kennzeichnung
- Pruefspur/Audit: keine Lauf-Coverage

Diese drei Verschiebungen sind einzeln vertretbar. Die Bibliotheks-Trefferzeile
sollte als erste nachgezogen werden, weil sie eine haeufige Leseflaeche ist;
das KO-Detail stellt aber einen erreichbaren Nachweisweg bereit.
`DuplicateCompare` zeigt bereits einen konkreten Befund und ist fuer die
Negativaussage weniger kritisch. Die Pruefspur ist operativ wichtig, aber fuer
den VIP-Lesefluss nicht zwingend.

Als achte Flaeche wurde die Risikoansicht uebersehen. Sie zeigt den KPI
"offene Konflikte" auch als echte Null, ohne die Coverage-Zusammenfassung:

- `apps/web/src/pages/Risk.tsx:79-97`

Weitere abgeleitete Flaechen sind die Arbeitsuebersicht und der
Knowledge-Health-Score:

- `apps/web/src/pages/Start.tsx:203-220`
- `apps/web/src/pages/Analytics.tsx:102-109`

Die Risikoansicht sollte vor VIP-2 mindestens denselben knappen Caveat oder
einen Link auf die Coverage-Zusammenfassung erhalten. Die wörtliche Zahl
"offene Konflikte" ist korrekt, die Management-Inferenz "kein Risiko" aber
ebenso problematisch wie auf dem Konfliktboard.

## Weitere Pruefergebnisse

### M28-2 - Deckel, Begriffe und Rangfolge

Der Umbau der Schleifen ist strukturell korrekt:

- Beide Wege holen dieselbe deterministisch sortierte Kandidatenfolge wie
  vorher, jetzt mit `Infinity`; die relative Rangfolge bleibt unveraendert:
  `services/conflicts/src/overlap-service.ts:192-194`,
  `services/conflicts/src/service.ts:266-272`.
- Der Deckel prueft `attempted`, bevor ein neuer Vergleich startet.
- Bereits offene Paare erhoehen `selected` und `alreadyOpen`, aber nicht
  `attempted`; sie verbrauchen damit keinen Pruefplatz:
  `services/conflicts/src/overlap-service.ts:240-256`,
  `services/conflicts/src/service.ts:323-350`.
- `available`, `selected`, `alreadyOpen`, `attempted`, `capped` und `aborted`
  entsprechen ihrem dokumentierten Vertrag.

Nicht korrekt sind `completed` und daraus folgend `skipped`, wie ROT-1 zeigt.

Die Zusammenfuehrung nimmt fuer Reichweite das Minimum, fuer Auslassungen die
Summe/Maximalwirkung und fuer `available` das Maximum:

- `services/conflicts/src/coverage.ts:78-100`

DE, EN und NL sagen zutreffend, dass `completed` eine konservative
Mindestabdeckung beider Wege ist und der schwaechere Weg bestimmt:

- `apps/web/src/i18n.ts:2073-2081`
- `apps/web/src/i18n.ts:5822-5830`
- `apps/web/src/i18n.ts:9508-9516`

Der Text verspricht nicht zu viel ueber die Merge-Regel. Wegen ROT-1 kann aber
der eingesetzte Wert selbst zu hoch sein.

### M28-3 - Route und Sicherheitsgrenze

Die neue Route ist schmal und korrekt verdrahtet:

- Registrierung: `services/app/src/build-app.ts:921-924`
- Guard `ko.read`: `services/app/src/routes/ai-check-coverage-routes.ts:24-37`
- Waechter-Inventar: `tests/security/routeGuardAudit.ts:244-247`

Die Antwort enthaelt nur `total`, `incomplete`, `unchecked`. Unter dem
bestehenden Vertrag kann derselbe `ko.read`-Nutzer bereits `/api/kos` und
einzelne KOs lesen:

- `services/app/src/routes/ko-routes.ts:325-345`

Damit entsteht durch die drei Zaehler kein zusaetzlicher Bestands- oder
Vertraulichkeitsabfluss. Das fachliche Problem liegt in der Berechnung, nicht
in der Rechtestufe.

### M28-4 - Queue- und Embedder-Kalibrierung

Die Positivproben verwenden tatsaechlich dieselben Instrumente wie die
Nulltests:

- `queue` wird einmal pro Testaufbau erzeugt, vor `buildApp` als Worker
  eingesetzt und sowohl im Bulk-Nulltest als auch in der HTTP-Positivprobe
  gelesen:
  `tests/library/import-json-zero-model-calls.test.ts:119-143`,
  `tests/library/import-json-zero-model-calls.test.ts:146-166`,
  `tests/library/import-json-zero-model-calls.test.ts:249-271`.
- `embedSpy` ist ein hoisted gemeinsames Objekt im Provider-Mock und wird im
  Bulk-Nulltest sowie in der HTTP-Positivprobe gelesen:
  `tests/library/import-json-zero-model-calls.test.ts:25-45`,
  `tests/library/import-json-zero-model-calls.test.ts:161-166`,
  `tests/library/import-json-zero-model-calls.test.ts:274-296`.
- Der regulaere POST-Pfad sendet zwar zuerst 201, wartet im Handler aber danach
  auf `indexKoForDuplicatePrefilter`; `app.inject` wartet auf den Handler:
  `services/app/src/routes/ko-routes.ts:424-444`.
- Der zweite Bulk-Lauf pinnt mit `{ imported: 25, skipped: 0 }`, dass er
  wirklich 25 neue Objekte angelegt hat:
  `tests/library/import-json-zero-model-calls.test.ts:169-198`.

M28-4 ist damit GRUEN.

## Bewertung der Ersatzbelege

### Kalibrierung durch Abklemmen der Spione - traegt

Eine Positivkalibrierung muss im reparierten Aufbau gruen sein. Die dokumentiert
ausgefuehrten Mutationen entfernen jeweils die echte Verdrahtung und lassen die
Positivprobe rot werden, waehrend die vier Bulk-Nullen gruen bleiben:

- Queue: `expected 0 to be greater than 0`
- Embedder: `expected 0 to be greater than 0`
- Hand-Bericht: `_relay/hand/outbox/BERICHT-mega29.md:350-387`

Das ist fuer die konkrete Frage "misst der Nulltest einen lebenden Zaehler?"
beweiskraeftiger als ein Rot-zuerst-Lauf.

### Oberflaechentests durch Ruecknahme der Einfuegung - traegt mit kleiner Prozessauflage

Das nachtraegliche Entfernen genau der neuen Render-Einfuegung prueft, dass der
Mounted-Test nicht nur Quelltext oder Hilfsfunktionen misst. Als
Diskriminierungsbeleg traegt es. Ein konservierter Pre-Fix-Lauf waere
reproduzierbarer, ist fuer diesen additiven Render-Fall aber keine materielle
Beweisluecke. Die Tests sollten kuenftig vor dem Fix eingecheckt oder der
Mutationsdiff als Artefakt aufbewahrt werden.

## Diff- und Eingangsevidenz

- HEAD: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
- Branch: `main`, gegen `origin/main` ahead 5 / behind 1
- Diff-SHA-256:
  `24e99e86a7b725dac7f4f762a14f7020fc44d8bef4197527ed9c0d80646fe6e2`
- Hand-Bericht Inhalts-SHA-256 ohne dessen letzte Hashzeile:
  `05ee9bf62a57de6c786b9c22ecd3682ac72d9a22b065636737a184ed614aa035`
- Gegenueber `_relay/patches139/mega28.diff` sind exakt 18 Pfade neu; aus
  mega28 ist in der Dateiliste nichts verschwunden.
- `git diff --check`: ohne Ausgabe, also keine Whitespace-Fehler.
- Die unversionierten `LOT/`-Artefakte wurden als ausdruecklicher Nicht-Scope
  weder bewertet noch veraendert.

## Mega29 versus Jahresring

**mega29 selbst:** ROT. M28-4 ist geschlossen; M28-1 ist funktional weitgehend
geschlossen, aber ohne Timeout nicht betriebsgleich; M28-2 und M28-3 enthalten
weiterhin direkte Ehrlichkeitsfehler. Das ROT aus sammel28 ist daher
ausdruecklich **nicht aufgehoben**.

**Jahresring:** Kein Verdikt in diesem Bericht. SCRUM-552 bis SCRUM-555, der
Deckelwert, Rescan/Wiederaufnahme, Coverage-Auditspur sowie Jahresring- und
Artefaktinhalte waren laut Auftrag Nicht-Scope. Das mega29-ROT ist davon
unabhaengig.

## No-op-Nachweis

- Kein Produktcode und keine bestehende Datei geaendert.
- Kein Build und kein Testlauf ausgefuehrt.
- Keine Anwendung, kein Server und kein Migrationslauf gestartet.
- Kein `git add`, kein Commit und kein Push ausgefuehrt.
- Kein Jira-Zugriff und keine Jira-Aenderung ausgefuehrt.
- Index unveraendert: `git diff --cached --quiet` lieferte Exit 0.
- Tracked-Diff vor Bericht: SHA-256
  `ec671ba5ded3e9fc6ac271b052021dbed962549e05fc3a9e3369504391d4547d`.
- Status-Snapshot vor Bericht: SHA-256
  `54b0077cebcec44850f3430bfefff711fb516c7f353b4ef095552d3b83a3aef8`.
- Einzige erzeugte Projektdatei ist der verlangte Bericht
  `_relay/ben/outbox/BERICHT-ben-sammel29-mega29.md`.

GESAMTVERDIKT: ROT
SHA-256: 6b3b2ffe678a1e8abd186bf06d99e49a85d3b7b8df72a5eedafe73f744069aa1
