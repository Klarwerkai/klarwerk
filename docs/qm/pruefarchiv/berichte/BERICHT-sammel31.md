# BERICHT sammel31 - Finaler Recheck 3 Ship 8

## Kurzurteil

**GESAMTVERDIKT: ROT - NO-GO fuer Ship 8 in der vorliegenden Kette patches57-78.**

Der offene Idempotenzraum aus sammel30 ROT-2 ist jetzt konsistent geschlossen: `neu` und `in_bearbeitung` teilen InMemory-, Orchestrator- und PostgreSQL-Schluessel; die Migration ersetzt den Altindex und die statischen sowie echten Pg-Tests adressieren die richtige Kante. Der Lease-/opId-Vertrag aus ROT-1 ist jedoch noch nicht crash-sicher. Drei konkrete Interleavings koennen weiterhin ein gestempeltes KO vom Kandidaten entkoppeln oder einen Doppel-KO-Retry ermoeglichen. F2 Stepper, F3 Eviction, Bonus-Netztest und die 409-CONFLICT-Kante wurden von Patch78 nicht beruehrt.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel31.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches78/0001-fix-server-WP-SHIP8-CLOSE-3-bens-zwei-sammel30-Block.patch`
- Patch-SHA-256: `d8aac028a7d0ba757cf7bd135c5d9877f03246a162e4e667dfb953abc9f82066`
- Methode: Patch78 gegen einen temporaer materialisierten Stand patches57-77 mit `git apply --check` geprueft und nur dort zur statischen Analyse materialisiert. Das Arbeitsrepo blieb unangetastet.
- Reale Patch-Statistik: **15 Dateien, +799/-90**. Das entspricht der Auftragsangabe **14 Dateien +488/-90 plus eine neue Testdatei mit 311 Zeilen**.
- Kein Bau und kein Testlauf gemaess Auftrag. `418 Testdateien / 3084 Tests gruen` sowie der manuelle PostgreSQL-16.13-Lauf sind uebernommene Evidence, nicht von Ben nachgerechnet.

## Findings

### [ROT-1A] Teilpersistenz in `KoService.create` wird als „kein KO entstanden“ fehlklassifiziert

**Beleg:** `reviewImportCandidate` setzt `createdKoId` erst, nachdem `await acceptToKo(...)` vollstaendig zurueckkehrt (`services/library-analytics/src/service.ts:464-483`). Bei einem geworfenen Fehler und `createdKoId === null` gibt der Fehlerpfad den Claim sofort auf `neu` zurueck (`service.ts:494-505`).

Die Erstanlage ist aber kein atomarer Einzelwrite: `KoService.create` schreibt zuerst das KO inklusive `importOpId`, danach separat Snapshot und Audit (`services/knowledge-object/src/service.ts:344-358`). Wirft Snapshot oder Audit nach erfolgreichem `repo.insert`, lehnt `KoService.create` ab, obwohl das gestempelte KO bereits existiert. `createdKoId` bleibt im Aufrufer trotzdem `null`; der Claim wird auf `neu` freigegeben. Ein ankerloser Retry erzeugt danach ein zweites KO.

**Impact:** Die zentrale Behauptung „ohne `createdKoId` ist nichts Unumkehrbares passiert“ ist falsch. Diese Kante braucht keinen Prozesscrash; ein Snapshot-/Auditfehler nach dem Insert genuegt. Der neue Recovery-Anker existiert zwar, wird im Laufzeit-Fehlerpfad vor dem Reset aber nicht gesucht.

**Erforderliche Korrektur:** Vor jeder Claim-Freigabe eines Accepts muss serverseitig nach `importOpId === opId` gesucht werden; bei Treffer bleibt der Claim fuer die Vollendung stehen oder wird direkt vollendet. Robuster ist ein stabiler, eindeutig erzwungener Idempotenzschluessel je Kandidat bzw. eine gemeinsame Transaktion fuer KO-Basiswrite, Snapshot/Audit und Kandidatenabschluss. Pflichttest: KO-Insert gelingt, Snapshot oder Audit wirft; danach Recovery/Retry ergibt genau ein KO und einen eindeutigen Kandidaten-Endzustand.

### [ROT-1B] Zeitbasierte Lease hat kein Fencing gegen einen spaet fortsetzenden Original-Lauf

**Beleg:** Die Lease gilt allein nach `claimedAt + 10 Minuten` als abgelaufen (`services/library-analytics/src/service.ts:46-59`). Recovery sieht bei noch nicht vorhandenem Stempel kein KO und setzt den Claim per opId-CAS auf `neu` (`service.ts:539-582`). Es gibt keinen Heartbeat, keine Owner-/Boot-ID und keinen Fencing-Check unmittelbar vor dem KO-Insert.

**Interleaving:** Operation A claimt und haengt vor KO-Erzeugung laenger als zehn Minuten. Ein Queue-GET startet Recovery und gibt A auf `neu` frei. Danach setzt A fort und erzeugt ein KO mit alter opId; nur ihr spaeter Kandidatenabschluss scheitert am CAS. Inzwischen kann Operation B den wieder freien Kandidaten claimen und fuer denselben ankerlosen Kandidaten ein zweites KO erzeugen.

Der neue Test deckt das nicht: Im Szenario „nach Claim, vor KO“ bleibt der alte Promise dauerhaft haengend und wird nach Recovery nie wieder freigegeben (`tests/app/review-claim-recovery.test.ts:77-120`). Damit beweist er Crash-Recovery, aber nicht Lease-Split-Brain.

**Impact:** Zehn Minuten sind fuer den Normalfall grosszuegig, aber keine Sicherheitsgarantie. Ein DB-/Snapshot-Stall oder blockierter Adapter kann die Frist ueberschreiten. Der opId-CAS schuetzt nur den Kandidatenabschluss, nicht den zuvor moeglichen KO-Seiteneffekt.

**Erforderliche Korrektur:** Der irreversible KO-Write braucht ein Fencing gegen einen bereits freigegebenen Claim. Tragfaehig waeren beispielsweise ein stabiler Candidate-Idempotenzanker mit DB-Unique-Garantie oder ein transaktionaler Write, der den aktuellen Claim/opId unmittelbar beim KO-Insert prueft. Alternativ muss die Recovery anhand einer belastbaren Prozess-/Owner-Generation beweisen, dass der urspruengliche Besitzer nicht mehr fortsetzen kann. Pflichttest: Recovery gibt einen abgelaufenen Claim frei, danach setzt der alte Lauf fort; trotzdem entstehen weder Doppel-KO noch orphaned KO.

### [ROT-1C] D-CLEAN kann das gestempelte Anker-KO trashen, waehrend der Claim stehen bleibt

**Beleg:** Cleanup nimmt alle lebenden KOs mit Confluence-/Jira-Provenienz in seine Zielmenge auf (`services/library-analytics/src/service.ts:211-238`) und trasht sie vor der Kandidatenphase (`service.ts:299-339`). Einen Kandidaten mit `in_bearbeitung` ueberspringt es anschliessend bewusst (`service.ts:362-367`).

Ein neu erzeugtes Anker-KO kann zu diesem Zeitpunkt bereits `importOpId` und externe Quelle tragen, waehrend `resolveClaim` noch aussteht (`service.ts:652-679`). D-CLEAN trasht dieses KO und laesst den Claim stehen. Recovery sucht danach nur in `koService.list()`, das getrashte KOs ausblendet (`services/knowledge-object/src/service.ts:543-554`); sie sieht deshalb keinen Stempel und setzt den Kandidaten auf `neu`. Der Retry findet ebenfalls keinen lebenden Anker und erzeugt ein neues KO, waehrend das erste im Papierkorb liegt.

**Impact:** Die im Auftrag explizit verlangte Wechselwirkung Recovery vs. Cleanup ist nicht geschlossen. Das Ergebnis ist eine widerspruechliche Bereinigung und ein zweites KO nach Retry.

**Erforderliche Korrektur:** Cleanup muss KOs, deren `importOpId` zu einem offenen Claim gehoert, atomar aus der Zielmenge ausschliessen oder den zugehoerigen Claim und das KO als eine konsistente Operation behandeln. Recovery muss einen getrashten Stempel explizit erkennen und nach dem festgelegten Cleanup-Vertrag entscheiden, statt ihn als „KO nie entstanden“ zu interpretieren. Pflichttest: KO mit opId existiert, Kandidat ist `in_bearbeitung`, D-CLEAN laeuft vor Endstatus; danach kein Reset mit Doppel-KO und eine ehrliche Cleanup-Bilanz.

## Gruene Punkte

### ROT-2 - offener Idempotenzraum: GRUEN

- `isOpenReviewStatus` definiert zentral `neu | in_bearbeitung`; `openCandidateKey`, `pendingKeys` und `pendingCandidateVersions` verwenden diese Definition (`services/library-analytics/src/repo.ts:3-12`, `119-124`; `services/app/src/confluence-import.ts:57-71`, `128-146`).
- Pg-Dedupe, Index und `ON CONFLICT` verwenden dasselbe Praedikat `review_status IN ('neu', 'in_bearbeitung')` (`services/library-analytics/src/repo-pg.ts:104-135`, `152-167`).
- Die Migration droppt beide Altnamen und erstellt den neuen Index unter eigenem Namen. Unter der angegebenen Deploy-Lage patches8-56 LIVE und 57-78 gemeinsam ist kein produktiver Zwischenbetrieb mit dem alten Patch77-Claimstatus zu erwarten.
- InMemory-, Statuskarten- und echte Pg-Tests adressieren die richtige Konkurrenz: Claim A blockiert `insertIfAbsent` B bis zum Endstatus (`tests/app/review-claim-recovery.test.ts:219-310`; `services/library-analytics/src/repo-pg.integration.test.ts:220-287`).

### Claim-CAS-Grundmechanik: GRUEN

Claim und Abschluss sind jeweils einzelne bedingte Writes; `resolveClaim` prueft Status plus opId und entfernt Lease-Felder (`services/library-analytics/src/repo-pg.ts:178-213`; InMemory spiegelbildlich in `repo.ts:156-193`). Zwei Recovery-Instanzen koennen denselben Kandidaten daher nicht beide abschliessen. Diese CAS-Garantie behebt jedoch nicht die drei oben beschriebenen KO-Seiteneffekt-Kanten.

### Anker-/Re-Sync-Pfad: GRUEN mit enger Begrenzung

Die Begruendung ist fuer den reinen Ankerpfad stichhaltig: vorhandener `(provider, externalId)`-Anker wird nur bei hoeherer Version revidiert, sonst bleibt er No-op; Vertraulichkeit wird nur angehoben (`services/library-analytics/src/service.ts:600-649`). Das macht einen Retry dieses Pfads monoton. Es heilt nicht die ankerlose Erstanlage und nicht das Cleanup-vs.-Trash-Szenario.

## Verdikttabelle

| Punkt | Verdikt | Befund |
|---|---|---|
| ROT-1 Claim/Lease/opId | **ROT** | Grundidee und Crash-Snapshots sind sinnvoll, aber Teilpersistenz, Lease-Split-Brain und D-CLEAN-Interaktion erlauben weiter entkoppelte oder doppelte KOs. |
| Drei Crash-Snapshot-Tests | **GELB** | Aussagekraeftig fuer einen dauerhaft beendeten Prozess; sie simulieren weder Create-Teilpersistenz noch das Fortsetzen des alten Laufs nach Lease-Recovery noch D-CLEAN zwischen KO-Write und Claim-Abschluss. |
| 10-Minuten-Lease | **ROT als Sicherheitsgrenze** | Als Liveness-Frist plausibel, ohne Fencing/Heartbeat aber kein Beweis, dass der alte Besitzer nicht mehr schreibt. |
| ROT-2 offener Idempotenzraum | **GRUEN** | InMemory, Orchestrator, Statuskarte und Pg-Index/Inference konsistent; Altindex wird ersetzt. |
| Migration | **GRUEN unter Deploy-Annahme** | Fuer stop-then-start von LIVE 8-56 direkt auf 57-78 tragfaehig; Pg-Upgrade- und Re-Run-Evidence vorhanden. |
| Recovery vs. Cleanup | **ROT** | Cleanup kann gestempeltes Anker-KO trashen, Claim bleibt; Recovery blendet Trash aus und gibt auf `neu` frei. |
| Recovery vs. Eviction | **GRUEN** | Getrennte Aggregate/Statusfelder; Patch78 beruehrt aiCheck-Queue und Eviction nicht. |
| F2/F3/Bonus/CONFLICT aus sammel30 | **GRUEN unveraendert** | Patch78 aendert weder Stepper noch aiCheck-Worker noch Ask-Test; Claim-/HTTP-CAS bleibt erhalten. |
| Evidence-Formalia | **GRUEN** | Patch-Hash, 15 Dateien und +799/-90 stimmen; Gate/Pg-Lauf sind klar als externe Evidence getrennt. |

## Ship-Entscheidung

**Explizite Antwort: NO-GO. Das Ship-8-Paket patches57-78 ist in diesem Stand nicht shipbar.**

Vor einem neuen Ship-GO sind mindestens diese Nachweise erforderlich:

1. Create-Teilpersistenz: Nach erfolgreichem KO-Insert und anschliessendem Snapshot-/Auditfehler wird der gestempelte KO erkannt; kein Reset auf `neu`, kein Doppel-KO.
2. Lease-Fencing: Ein alter Lauf, der nach Recovery fortsetzt, kann keinen irreversiblen KO-Write mehr ausfuehren oder dieser Write ist durch einen stabilen Unique-Idempotenzanker unschaedlich.
3. D-CLEAN-Vertrag: Ein KO mit `importOpId` eines offenen Claims wird nicht unabhaengig vom Claim getrasht; Recovery behandelt vorhandene Trash-Stempel explizit und erzeugt keinen Ersatz-Doppelbestand.
4. Die drei Szenarien muessen als nicht-vakuose Tests vorliegen, danach finales Gate auf der neuen Endkette und echter Pg-Nachweis fuer die betroffenen CAS-/Unique-Grenzen.

Nach Schliessung dieser Punkte bleiben die Deploy-Bedingungen unveraendert:

- **stop-then-start und genau eine Instanz**; kein Mischbetrieb verschiedener Schemastaende.
- **`SLIDES`-Flag unset nachweisen**.
- **Finales Gate auf der dann vollstaendigen Endkette**; 418/3084 gilt nur fuer 57-78.
- **Smoke nach Start**: Health/Version; Import Explore/Group/Apply; Review-vs.-Cleanup; Claim-Recovery in allen drei korrigierten Kanten; Stepper Erfolg/Fehler/Snapshot-Expired; aiCheck Overflow/Retry; vertraulicher Ask-Prefill ohne Netzaufruf.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch im Arbeitsrepo angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 13:26:12 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): aeddee0f62ccf0c5c49c076fe978af247e9dcce31e1f3ec7e334b1ad1b49b9d4
