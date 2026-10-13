# BERICHT-ben-sammel26-mega26

**Pruefer:** ben, unabhaengige read-only Gegenpruefung  
**Datum:** 26.07.2026  
**Basis:** `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`  
**Pruefobjekt:** `_relay/patches137/mega26.diff` und `_relay/hand/outbox/BERICHT-mega26.md`

## 1. Ausdrueckliche Erstantwort: Das Modelllauf-Protokoll erfasst die Urteilsflaeche nicht

**Ja. Der Befund der Hand stimmt.** Kein Konflikt- oder Duplikat-Urteilsweg erzeugt einen
`ModelRunRecord`.

- `Reasoner.runTask` ist der zentrale protokollierte Pfad: Erfolg und Fehler laufen dort ueber
  `recordRun` (`services/reasoner/src/service.ts:590-688`).
- `judgeConflictOutcome` ruft die Provider dagegen direkt auf
  (`services/reasoner/src/service.ts:1253-1305`).
- `judgeDuplicateOutcome` tut dasselbe
  (`services/reasoner/src/service.ts:1324-1372`).
- Beide Wege umgehen `runTask` und `recordRun` vollstaendig.
- `kon-v1` und `dup-v1` werden erst beim positiven Konflikt-/Overlap-Datensatz gesetzt
  (`services/conflicts/src/service.ts:309-316`,
  `services/conflicts/src/overlap-service.ts:228-238`). Sie versionieren nicht den tatsaechlich
  ausgefuehrten Provider-Aufruf.

Es gibt **keinen anderen vollstaendigen Ersatzbeleg**:

- Ein positiver automatisch erzeugter Konflikt oder Overlap traegt `detector`-Metadaten und erzeugt
  ein Audit-Ereignis. Das belegt nur den entstandenen Befund.
- Ein negatives Urteil, eine unverwertbare Modellantwort, ein Providerfehler oder ein Lauf ohne
  gespeicherten Befund hinterlaesst dort keinen einzelnen Laufdatensatz.
- Der AI-Check-Status bildet grobe Ergebnisse und Fehlerklassen ab, ist aber kein
  anbieter-/zeit-/modellbezogenes Laufprotokoll.

Damit ist das erklaerte Versprechen des Typs, KI-/Reasoner-Aufrufe nachvollziehbar zu machen
(`services/model-runs/src/types.ts:1-15`), **nur teilweise erfuellt**. Es ist kein Beweisverlust an
bereits erzeugten Konflikten, aber eine Vollstaendigkeitsluecke in Kosten-, Egress- und
Ausfuehrungsnachweisen.

Die Luecke ist sogar etwas breiter als im Hand-Bericht: Auch `deriveImportCriteria` ruft
`model.completeRaw` direkt auf (`services/reasoner/src/service.ts:1112-1149`), und
`enrichPublic` ruft Provider direkt auf (`services/reasoner/src/service.ts:1166-1187`). Auch diese
echten Modellwege laufen nicht ueber `recordRun`. Das aendert das Mega26-Verdikt nicht, bestaetigt
aber, dass `ModelRunRecord` heute kein vollstaendiges Modellaufruf-Inventar ist.

## 2. Reissleine und Jahresring

### Reissleine

**GRUEN: Die Reissleine war richtig.** Ein Protokolleintrag pro Paarurteil waere keine harmlose
Feldergaenzung, sondern eine neue Betriebs- und Aufbewahrungsentscheidung. Ohne Mengenmodell,
Retention, Aggregation und Kostenbudget durfte das nicht nebenbei in Mega26 eingebaut werden.

### 12.480-KO-Jahresring

**Vor dem Jahresring-Lauf ansehen: zwingend ja. Nicht pauschal bis Nach-VIP-2 verschieben.**

Der produktive Duplikatpfad laedt den gesamten Bestand
(`services/app/src/duplicate-detection.ts:75-99`). `OverlapService.detectForSubject` durchlaeuft
jedes noch nicht offene Paar und ruft auch nach der deterministischen Deckungspruefung den Judge auf
(`services/conflicts/src/overlap-service.ts:161-217`). Fuer ein neues KO gegen 12.480 bestehende KOs
sind daher grob bis zu 12.480 Judge-Aufrufe moeglich. Beim sukzessiven Aufbau eines ganzen Bestands
droht ohne Sondermodus eine quadratische Paarmenge.

Der Konfliktpfad setzt zwar `cap: Number.POSITIVE_INFINITY`
(`services/app/src/conflict-detection.ts:64-73`), hat aber innerhalb des ConflictService noch eine
fachliche Kandidatenauswahl. Er ist deshalb ebenfalls unbeschraenkt gegen seine Kandidatenmenge,
jedoch nicht automatisch identisch mit einem Vollscan ueber jedes Paar.

Ob der konkrete Jahresring-Aufbau diese Pfade ausloest, haengt vom noch nicht im Repository
belegten Ladeverfahren ab. Direkte Fixture-/DB-Beladung ohne AI-Worker ist anders zu bewerten als
Produktions-Create, Capture oder Import-Accept. Deshalb gilt vor dem Lauf ein hartes Gate:

1. Ladeweg und Worker-Verhalten explizit festlegen.
2. Paar- und Modellbudget vorab berechnen und begrenzen.
3. Fuer die Erstbeladung Erkennung deaktivieren oder kontrolliert batchen/cappen.
4. Telemetrie aggregiert und retention-begrenzt entwerfen; nicht blind einen Datensatz je Paar
   erzeugen.

**Einstufung:** kein Ship-Blocker fuer Mega26, aber ein **Vor-Jahresring-Blocker**, falls der
Jahresring Produktions-Erkennung ausloest.

## 3. Block A: Laufkontext

### Wahl des gebundenen Aufrufers

**GRUEN mit Reichweitengrenze.** `POST /api/reasoner` mit `task:"extract"` ist ein sinnvoller erster
gebundener Weg:

- Das Ergebnis kann unmittelbar in bleibendes Wissen und Belegstellen uebergehen.
- Die Route kennt den authentifizierten Nutzer.
- Beim Bearbeiten eines vorhandenen KOs liefert der Client eine koId, die serverseitig aufgeloest
  werden kann (`services/app/src/routes/reasoner-routes.ts:200-245`).

Die Begruendung ist fuer den **Subjektbezug** tragfaehig, aber nicht fuer den gesamten Actor-Kontext:
Auch `structure`, `assist` und `interview` kennen an derselben Route den authentifizierten Nutzer.
Sie koennten daher wenigstens einen Actor tragen. Noch wertvoller waere kuenftig die Bindung der
Urteilsflaeche an Paar, Ausloeser/Job und Prompt-Version.

Der Hand-Bericht benennt die Reichweite ehrlich: Alle uebrigen Zweige bleiben bewusst kontextlos
(`BERICHT-mega26.md`, Abschnitt 1.2). Es wird keine Vollstaendigkeit behauptet.

### Autoritativer Subject-Bezug

**GRUEN.** `subject.id` stammt ausschliesslich aus `stored.id`, nachdem `ko.get(koId)` ein reales
Objekt gefunden hat (`services/app/src/routes/reasoner-routes.ts:92-114`). Eine unbekannte oder
erfundene Client-Kennung erzeugt keinen Subject-Bezug. Das ist fail-safe und verhindert falsche
Audit-Zuordnungen.

### Durchreichung

**GRUEN.** Der optionale Kontext steht als letzter Parameter, wird im Erfolgs- und Fehlerfall an
`recordRun` gereicht und dort auf Kennungen begrenzt
(`services/reasoner/src/service.ts:595-688`,
`services/model-runs/src/types.ts:42-75`). Bestehende Aufrufe ohne Kontext bleiben kompatibel.

## 4. Rechtestufe von GET /api/model-runs

**GRUEN.** Die Route bleibt mit `ko.read` erreichbar. Nur `actor` und `subject` werden fuer Nutzer
ohne `ko.validate` aus der Projektion entfernt
(`services/app/src/routes/model-runs-routes.ts:19-47`). `/api/audit` verlangt ebenfalls
`ko.validate` (`services/app/src/routes/audit-routes.ts:5-13`). Diese Paritaet ist fachlich richtig:
Wer-woran ist eine personenbezogene Governance-Aussage, nicht bloss technische Betriebsmetrik.

**Feldgleichheit:** Fuer reine `ko.read`-Nutzer sind alle vor Mega26 vorhandenen Felder unveraendert;
es wird nur der neue Kontext nicht ausgeliefert. Das ist tatsaechlich feldgleich zum Altvertrag.

**Inferenzrisiko:** Aus dem Fehlen der Felder laesst sich hoechstens ableiten, dass Kontext verborgen
sein koennte. Actor und Objektkennung sind nicht erschliessbar. Da Task, Provider, Status und Zeiten
schon vorher sichtbar waren, entsteht kein relevantes neues Informationsleck.

## 5. Block B

### Evidence excerpt

**GRUEN mit Begriffsschaerfung.** Der `excerpt` ist kein menschlicher Entscheidungsgrund im Sinn von
"warum habe ich diese Quelle ausgewaehlt?". Er ist die Belegstelle, also der inhaltliche Grund,
warum die Quelle die Aussage stuetzt. Als Evidence-Feld ist das fachlich richtig; in einer spaeteren
UI sollte es **Belegstelle** oder **Auszug**, nicht pauschal **Begruendung**, heissen.

Alle drei Quellschreibwege uebernehmen denselben bereits normalisierten Wert
(`services/knowledge-object/src/service.ts:910-925, 1403-1415, 1997-2012`). Der Wert wird nicht
erfunden und bleibt auch in der append-only Evidence erhalten.

### Manueller Konflikt

**GRUEN.** `Conflict.createdBy` wird aus demselben lokalen Parameter `actor` gesetzt, der unmittelbar
danach an `audit.record` geht (`services/conflicts/src/service.ts:77-97`). Es gibt keine zweite
Ableitung und keinen abweichenden Nutzerwert.

### Anhang ohne Grund

**GRUEN fuer das bewusste Nicht-Bauen.** Die drei Richtungen der Hand sind abschliessend; eine
zusaetzliche vierte Suche bestaetigt den Befund:

- `KoAttachment` enthaelt nur technische Metadaten und den Dateinamen
  (`services/knowledge-object/src/types.ts:54-68`).
- Alle drei Konstruktoren uebernehmen nur diese Felder
  (`services/knowledge-object/src/service.ts:827-842, 1307-1332, 1893-1907`).
- Request- und Frontend-Vertraege kennen keinen Caption-/Reason-/Description-Text
  (`apps/web/src/api/endpoints.ts:110-129`,
  `apps/web/src/lib/captureAttachments.ts:35-54`).
- Der Object-Store kennt lediglich den technischen Zweck `purpose:"attachment"`
  (`apps/web/src/pages/KnowledgeDetail.tsx:552-568`). Das ist eine Verwendungsart, kein
  menschlicher Verknuepfungsgrund.
- Der Evidence-Anhang nutzt `attachment.name` als Label; auch das ist nur der Dateiname
  (`services/knowledge-object/src/service.ts:897-908, 1986-1996`).

Ein echtes `reason`-Feld braeuchte daher zuerst eine Produktentscheidung und einen Eingabepunkt.
Mega26 durfte keinen Text aus Dateiname, Source-Excerpt oder technischem Purpose umdeuten.

## 6. Echte Ship-Blocker

**Keine.** Die geprueften Mega26-Aenderungen sind additiv, autoritativ gebunden und
berechtigungsseitig defensiv. Die bereits ausgelieferte Basis `d3fe69d` wird durch diesen
Zeitprojekt-Diff nicht als unsicher widerlegt.

## 7. Vor dem Jahresring

1. Ladepfad fuer 12.480 KOs festlegen und pruefen, ob AI-Worker/Produktions-Detection ausgeloest wird.
2. Bei aktivem Detection-Pfad: Modellurteile cappen/batchen oder fuer die Erstbeladung ausschalten.
3. Kosten-, Parallelitaets- und Retention-Budget festlegen.
4. Erst danach ein vollstaendiges, vorzugsweise aggregiertes ModelRun-/Judgement-Protokoll bauen.

## 8. Nach VIP-2

1. ModelRun-Inventar systematisch vervollstaendigen: Judge, Import-Criteria und Public-Enrich.
2. `kon-v1`/`dup-v1` an die tatsaechlichen Prompt-Bauer koppeln.
3. Actor-/Subject-Kontext schrittweise fuer weitere fachlich sichere Aufrufer binden.
4. Frontend-Task-Union und i18n fuer `extract`, `describe`, `group` nachziehen; derzeit kann
   `extract` als roher Key erscheinen und die Task-Summe `NaN` werden.
5. Sichtbare Oberflaechen fuer Evidence-Auszug, Konflikt-Urheber und berechtigten Laufkontext planen.
6. Einen Anhangsgrund nur mit echtem Nutzereingabefeld einfuehren.

## 9. No-op-Nachweis

Ich habe keinen Produktcode und keinen Index geaendert, nichts gebaut, keine Tests ausgefuehrt,
nichts committet, nichts gepusht und nicht nach Jira geschrieben. Ausgefuehrt wurden ausschliesslich
lesende Inspektions- und Hash-Kommandos; geschrieben wurde nur dieser angeforderte Bericht.

## GESAMTVERDIKT

**GELB.** Mega26 selbst hat **keinen Ship-Blocker** und die gebauten Aenderungen sind fachlich
abnahmefaehig. Das GELB gilt fuer das Zeitprojekt: Das ModelRun-Protokoll ist nachweislich
unvollstaendig, und ein Jahresring-Lauf ueber 12.480 KOs darf bei aktivem Produktions-Judgement erst
nach einem expliziten Mengen-, Kosten- und Betriebs-Gate starten. Die Reissleine der Hand war richtig;
die Protokoll- und Skalierungsflaeche ist ein eigener Schnitt.

SHA-256: 4711e4cf08fc2e89e02d169885e785213b22dda096ba419f257dfa6a283e637d
