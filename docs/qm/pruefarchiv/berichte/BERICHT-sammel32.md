# BERICHT sammel32 - Finaler Recheck 4 Ship 8

## Kurzurteil

**GESAMTVERDIKT: ROT - NO-GO fuer Ship 8 in der vorliegenden Kette patches57-79.**

Patch79 schliesst die zwei gefaehrlichsten Doppel-KO-Kanten technisch nachvollziehbar: Der stabile `importCandidateId`-Anker ist in PostgreSQL und InMemory eindeutig, ein spaet fortsetzender Alt-Lauf adoptiert das Gewinner-KO, und Recovery findet den Anker auch im Papierkorb. Auch der D-CLEAN-Ausschluss fuer einen bereits sichtbaren offenen Claim ist korrekt verdrahtet.

Die explizit geforderte ROT-1A-Garantie "Adoption nach create-Fehler sauber - kein halber Zustand" ist jedoch nicht erfuellt. `KoService.create` persistiert weiterhin zuerst das KO und schreibt danach Snapshot und Audit. Wirft einer dieser Seiteneffekte, adoptiert Patch79 das KO und setzt den Kandidaten auf `angenommen`, repariert aber weder den fehlenden Version-1-Snapshot noch den fehlenden `ko.created`-Auditbeleg. Der neue Test beweist nur "genau ein KO", nicht einen vollstaendig initialisierten und auditierbaren Zustand; zudem weicht sein Audit-Harness von der Produktionsverdrahtung ab.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel32.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches79/0001-fix-server-WP-SHIP8-CLOSE-4-bens-drei-sammel31-Kante.patch`
- Patch-SHA-256: `db5dbe02b182b7bd09dc71cbd9dd893bf50e52f4ee79c5c95d7c94b69e042a62`
- Patch-Statistik: **14 Dateien, +513/-109**, keine neue Datei.
- Methode: Patch79 mit `git apply --check` gegen einen temporaer materialisierten Stand patches57-78 geprueft und nur dort zur statischen Analyse angewandt. Das Arbeitsrepo blieb unangetastet.
- Kein Bau und kein Testlauf gemaess Auftrag. `418 Testdateien / 3089 Tests gruen` und der angegebene PostgreSQL-Lauf sind uebernommene Evidence, nicht von Ben nachgerechnet.

## Findings

### [ROT-1A] Adoption verhindert das Doppel-KO, vollendet aber einen halben KO-Zustand

**Beleg:** Die Erstanlage schreibt in dieser Reihenfolge:

1. `repo.insert(ko)`
2. Version-1-Snapshot
3. `ko.created`-Audit

Das steht unveraendert in `services/knowledge-object/src/service.ts:356-360`. Anders als die transaktional kompensierten Mutationen in `mutateKoTx` (`service.ts:220-252`) besitzt `create` weder Transaktion noch Rollback noch einen idempotenten Reparaturpfad.

Patch79 faengt den Fehler in `acceptToKo` und adoptiert jedes bereits auffindbare KO (`services/library-analytics/src/service.ts:750-793`). Danach wird der Kandidat regulaer als `angenommen` abgeschlossen (`service.ts:519-524`). Dabei wird nicht geprueft oder nachgezogen, ob Snapshot und `ko.created`-Audit vorhanden sind.

Konkrete Restzustaende:

- **Snapshot wirft:** KO ist vorhanden, Version-1-Snapshot fehlt, `ko.created` wurde nie versucht; Kandidat wird trotzdem `angenommen`.
- **Audit wirft:** KO und Snapshot sind vorhanden, `ko.created` fehlt; Kandidat wird trotzdem `angenommen`.

Das ist kein Doppel-KO mehr, aber weiterhin ein fachlich halber Zustand. Versionshistorie und Auditkette koennen fuer ein angenommenes Import-KO unvollstaendig sein.

### [ROT-1A-Test] Der neue Test ist fuer Vollstaendigkeit und Produktions-Audit nicht beweiskraeftig

Der Test in `tests/app/review-claim-recovery.test.ts:343-398` injiziert Snapshot- bzw. Auditfehler und prueft danach nur:

- Kandidat `angenommen`
- genau ein KO
- Retry abgewiesen

Er prueft **nicht**, dass Version-1-Snapshot und `ko.created`-Audit nach Adoption vorhanden oder repariert sind. Beim Snapshot-Fake liefert `listByKo` sogar immer leer (`test.ts:354-360`), ohne dass dies als Fehler behauptet wird.

Zusaetzlich erhaelt im Test nur `KoService` den werfenden Auditdienst; `LibraryService` wird ohne Audit gebaut (`test.ts:361-372`). In Produktion teilen beide denselben Auditdienst (`services/app/src/build-app.ts:263-267` und `315-318`). Bei einem realen Audit-Ausfall kann daher nach der Adoption auch der abschliessende `import.candidate-accept`-Audit ausserhalb des inneren Fehlerblocks werfen (`services/library-analytics/src/service.ts:591-596`): Der Kandidat ist dann bereits angenommen, waehrend der Client einen Fehler sieht und beide Auditbelege fehlen koennen.

**Erforderliche Korrektur vor Ship:** Adoption darf erst erfolgreich abschliessen, wenn die Create-Nacharbeiten idempotent hergestellt sind. Tragfaehig sind:

- eine gemeinsame Transaktion fuer KO-Basiswrite, Version-1-Snapshot und Audit, oder
- ein expliziter idempotenter `ensureCreatedSideEffects`-/Recovery-Pfad, der Snapshot und Audit nachzieht und den Claim bis zum erfolgreichen Nachweis fail-closed stehen laesst.

Pflichttests muessen Snapshot- und Auditbestand selbst pruefen und die Produktionsverdrahtung mit gemeinsamem Auditdienst abbilden. Ein Auditfehler darf nicht zu "angenommen, aber Fehlerantwort und fehlende Belege" fuehren.

### [GELB] PostgreSQL-Unique-Evidence ist im Patch nicht als echter Integrationstest enthalten

Der DDL-Vertrag ist statisch korrekt: additive Generated-Spalte und partieller Unique-Index ohne `deletedAt`-Ausschluss (`services/knowledge-object/src/repo-pg.ts:55-69`), direkt nach `KO_SCHEMA` migriert (`services/app/src/db.ts:30-39`). Da `importCandidateId` neu ist, sind Bestandszeilen beim Upgrade `NULL`; unter stop-then-start entsteht daraus kein Alt-Dublettenproblem.

Der neue Test pinnt jedoch nur den DDL-String und prueft die InMemory-Kollision (`tests/app/review-claim-recovery.test.ts:428-457`). Im materialisierten Baum gibt es keinen gespeicherten echten PostgreSQL-Test fuer `kos_import_candidate_uq`. Der im Auftrag genannte Pg-Nachweis ist daher externe Evidence. Das ist kein statischer SQL-Blocker, muss aber vor Deploy auf echtem PostgreSQL erneut belegt werden: Upgrade, Re-Run der Migration, zweiter Insert desselben `importCandidateId`, Adoption nach `23505`, Trash behaelt den Unique-Anker.

## Gruene Punkte

### ROT-1B - stabiler Kandidatenanker und spaeter Alt-Lauf: GRUEN

- `importCandidateId = candidate.id` ist ueber Claims und Retries stabil; `opId` bleibt auf das Kandidaten-CAS begrenzt (`services/library-analytics/src/service.ts:465-480`).
- PostgreSQL erzwingt hoechstens eine nichtleere Kandidaten-ID; InMemory spiegelt die Regel synchron und einschliesslich Papierkorb (`services/knowledge-object/src/repo-pg.ts:55-69`; `repo.ts:114-135`).
- `acceptToKo` sucht vorab und nach jedem Create-Fehler nach dem stabilen Anker und adoptiert das gefundene KO (`services/library-analytics/src/service.ts:682-688`, `750-793`).
- Der 1B-Test ist nicht vakuoes: Lauf A wird wirklich angehalten, Recovery gibt frei, Lauf B akzeptiert vollstaendig, danach wird A fortgesetzt. A kollidiert, adoptiert B und endet am alten Claim-CAS ehrlich mit `CONFLICT`; exakt ein KO bleibt (`tests/app/review-claim-recovery.test.ts:83-149`).

Damit ist die sammel31-Kante "Lease abgelaufen, Alt-Lauf schreibt spaeter" gegen Doppel- und Orphan-KOs geschlossen.

### ROT-1C - D-CLEAN und Trash-Anker: GRUEN fuer den festgelegten Vertrag

- `cleanupTargets` ermittelt offene Claims und nimmt deren gestempelte, lebende KOs aus der Cleanup-Zielmenge; `claimedKos` macht den Ausschluss in Vorschau, Ergebnis und Audit sichtbar (`services/library-analytics/src/service.ts:225-256`, `259-279`, `298-453`).
- Recovery und Adoption verwenden `findByImportCandidateId`, das bewusst die rohe Repo-Sicht einschliesslich Papierkorb liest (`services/knowledge-object/src/service.ts:558-564`). Ein Trash-Treffer wird als bereits materialisierter Accept abgeschlossen; es entsteht kein Ersatz-KO (`services/library-analytics/src/service.ts:600-666`).
- Beide 1C-Tests sind konkret: D-CLEAN laeuft waehrend eines offenen Claims und trasht nichts; im zweiten Test wird das Stempel-KO ausdruecklich getrasht und Recovery verweist danach auf genau dieses KO (`tests/app/review-claim-recovery.test.ts:459-512`).

Der Ausschluss ist kein gemeinsamer DB-Snapshot ueber Kandidaten- und KO-Tabelle. Der Digest-Neuvergleich und die statusbedingte Kandidatenloeschung machen die normalen Interleavings jedoch fail-closed; unter dem vereinbarten Einzelinstanz-/stop-then-start-Betrieb sehe ich daraus keinen neuen Ship-Blocker.

### Aeusserer Fehlerpfad bei unbekanntem Anker: GRUEN im Code, Testluecke GELB

Wenn `acceptToKo` wirft, sucht der aeussere Catch erneut nach dem stabilen Anker. Scheitert diese Auskunft selbst, setzt `ankerUnknown = true`, laesst den Claim unveraendert `in_bearbeitung` und wirft den Fehler (`services/library-analytics/src/service.ts:531-572`). Nur ein sicher negativer Lookup erlaubt das CAS-Reset auf `neu` (`service.ts:573-585`). Das ist korrekt fail-closed.

Ein direkter Test "Anker-Lookup wirft zweimal -> Claim bleibt stehen" fehlt. Das ist eine sinnvolle Pflicht-Ergaenzung zum ROT-1A-Fix, aber fuer sich allein kein weiterer Architekturblocker.

### Migration und Deploymentform: GRUEN unter Bedingungen

- Die neue Spalte ist generated aus dem JSONB-Feld und der Index ist idempotent benannt.
- Der Index umfasst auch getrashte KOs und passt damit zum Recovery-/Trash-Vertrag.
- `ko-routes` entfernt `importCandidateId` aus Client-Create-Eingaben; Nutzer koennen den internen Anker nicht selbst setzen (`services/app/src/routes/ko-routes.ts:173-194`).
- **Stop-then-start und genau eine Instanz sind zwingend:** Kein alter Prozess darf nach Migration noch ungestempelte Accepts schreiben.

### Regressionen gegen patches57-78: GRUEN in statischer Pruefung

- ROT-2-Idempotenzraum, Claim-CAS und offene Pg-Indexpraedikate wurden nicht zurueckgebaut.
- Provider-/externalId-Re-Sync, F2-Stepper, F3-aiCheck/Eviction und Bonus-Netztest bleiben ausserhalb der geaenderten Logik.
- Patch79 fuegt fuer die Cleanup-Bilanz nur `claimedKos` durch API-Typen und DE/EN/NL-Anzeige hinzu; keine neue Egress-, HTML- oder Berechtigungsflaeche.

## Verdikttabelle

| Pruefpunkt | Verdikt | Befund |
|---|---|---|
| Stabiler Kandidatenanker / Unique | **GRUEN** | Kandidaten-ID ist claim-uebergreifend stabil; Pg und InMemory erzwingen hoechstens ein KO, einschliesslich Trash. |
| ROT-1A Doppel-KO | **GRUEN** | Create-Fehler fuehrt dank Anker-Lookup nicht mehr zu einem zweiten KO. |
| ROT-1A kein halber Zustand | **ROT** | Fehlender Snapshot bzw. fehlendes `ko.created`-Audit wird nicht repariert; Kandidat wird dennoch angenommen. |
| Aeusserer Fehlerpfad / Anker unbekannt | **GRUEN** | Code bleibt fail-closed; direkter Negativtest fehlt (**GELB Evidence**). |
| ROT-1B Alt-Lauf setzt fort | **GRUEN** | Test setzt A wirklich fort; Unique + Adoption + opId-CAS verhindern Doppel-/Orphan-KO. |
| ROT-1C offener Claim vs. D-CLEAN | **GRUEN** | Gestempeltes KO ist aus Zielmenge ausgeschlossen und ehrlich gezaehlt. |
| ROT-1C Trash-Treffer | **GRUEN** | Recovery findet Trash-Anker und erzeugt keinen Ersatz. |
| Pg-Migration | **GRUEN statisch / GELB Evidence** | DDL und Reihenfolge plausibel; echter Pg-Test liegt nicht im Patch, Nachweis ist uebernommen. |
| Regressionen 57-78 | **GRUEN statisch** | Keine Ruecknahme der benannten Gruen-Punkte erkannt. |

## Ship-Entscheidung

**Explizite Antwort: NO-GO. Das Ship-8-Paket patches57-79 ist noch nicht shipbar.**

Der einzige verbleibende Code-Blocker ist eng, aber wesentlich: Ein angenommener Import darf nicht ohne seinen Version-1-Snapshot bzw. ohne den erforderlichen Create-Auditbeleg bestehen bleiben. Patch79 beweist "hoechstens ein KO", aber noch nicht "ein vollstaendiges KO".

Nach einem ROT-1A-Reparaturslice gelten folgende Deploy-Bedingungen:

1. **stop-then-start, genau eine Instanz**, kein Mischbetrieb mit einem Writer ohne `importCandidateId`.
2. **`SLIDES`-Flag unset** vor Start nachweisen.
3. **Finales Gate auf der wirklichen Endkette**; 418/3089 gilt nur fuer 57-79 und ist hier uebernommene Evidence.
4. **Echter Pg-Nachweis:** Bestands-Upgrade, idempotenter Migrations-Re-Run, Unique-Kollision/Adoption und Trash-Anker.
5. **Gezielte Fehler-Integration:** Snapshotfehler, gemeinsamer Auditfehler, doppelt fehlschlagender Anker-Lookup, spaeter Alt-Lauf und D-CLEAN-vs.-Claim. Jeweils genau ein vollstaendiges KO, eindeutiger Kandidatenstatus und vollstaendige Belege.
6. **Smoke nach Start:** Health/Version; Import Explore/Group/Apply; Accept und Kandidatenstatus; Review-vs.-Cleanup; Stepper Erfolg/Fehler/Snapshot-Expired; aiCheck Overflow/Retry; vertraulicher Ask-Prefill ohne Netzaufruf.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch im Arbeitsrepo angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 15:28:24 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): 6a91cd1f74a005e155b0d0cee3c05df4bf6334e84b336dde49a04091e1d3dfff
