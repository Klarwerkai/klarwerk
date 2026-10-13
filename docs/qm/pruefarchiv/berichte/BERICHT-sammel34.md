# BERICHT sammel34 - Finaler Recheck 6 Ship 8

## Kurzurteil

**GESAMTVERDIKT: ROT - NO-GO fuer Ship 8 in der vorliegenden Kette patches57-81.**

Patch81 schliesst zwei der drei sammel33-Kanten belastbar: `ko.created` besitzt jetzt einen persistenzgestuetzten Exactly-once-Arbiter, und der provider/externalId-Re-Sync zieht fehlende Create-Belege vor jeder Revision nach. Schema, InMemory-Spiegel und die neuen Konkurrenz-/Re-Sync-Tests passen zu diesen Garantien.

Die dritte Kante ist noch nicht crash-sicher. `reviewedBy` und `reviewedAt` reisen zwar im Endstatus-CAS mit, `auditPending` aber nicht. Die Markierung wird erst nach einem fehlgeschlagenen Audit in einem separaten unbedingten Kandidaten-Update gesetzt. Ein Prozessabsturz oder eine parallele Kandidatenloeschung zwischen Auditfehler und diesem zweiten Write hinterlaesst einen angenommenen Kandidaten ohne Aktionsaudit und ohne Retry-Marker. Zudem schreibt die Crash-Recovery `reviewedBy: "system"` und verliert damit den urspruenglichen menschlichen Reviewer.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel34.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches81/0001-fix-server-WP-SHIP8-CLOSE-6-bens-drei-sammel33-Beleg.patch`
- Patch-SHA-256: `ca87411c1ffd2f1a76714f5f00b8485d3c156a1ff40203571ba73a62d02862cf`
- Patch-Statistik: **24 Dateien, +826/-74**; davon drei neue Dateien. Das entspricht der Auftragsangabe 21 geaenderte Dateien plus drei neue Dateien.
- Methode: Patch81 mit `git apply --check` gegen einen temporaer materialisierten Stand patches57-80 geprueft und nur dort zur statischen Analyse angewandt. Das Arbeitsrepo blieb unangetastet.
- Kein Bau und kein Testlauf gemaess Auftrag. `419 Testdateien / 3105 Tests gruen` sowie PostgreSQL 16.13 `3/3 + 3/3` sind uebernommene Evidence, nicht von Ben nachgerechnet.

## Findings

### [ROT-1] `auditPending` liegt nicht im selben Statuswrite - Crashfenster bleibt offen

**Beleg:** Der Endstatus mit `reviewedBy` und `reviewedAt` wird zuerst per `resolveClaim` persistiert (`services/library-analytics/src/service.ts:504-537`). Erst danach versucht der Service das Aktionsaudit (`service.ts:618-625`). Wirft dieses, baut er ein neues Kandidatenobjekt mit `auditPending` und schreibt es ueber `candidates.update` in einem zweiten Schritt (`service.ts:626-645`).

Das ist nicht die im Auftrag verlangte Eine-Write-/Outbox-Semantik. Das konkrete Fenster lautet:

1. `resolveClaim` committet `angenommen`, `reviewedBy`, `reviewedAt` und entfernt `opId`/`claimedAt`.
2. `recordOnce` wirft.
3. Prozessabsturz vor `candidates.update(marked)` - oder Cleanup entfernt den Kandidaten, sodass das Update scheitert.
4. Es existiert weder `import.candidate-accept` noch `auditPending`.

Der Code behandelt das selbst nur mit einem stderr-Log (`service.ts:639-644`). Der Queue-Load kann diesen Zustand nicht rekonstruieren: `retryPendingReviewAudits` sucht ausschliesslich Kandidaten mit vorhandener Markierung (`service.ts:656-680`), und die fuer die Event-ID verwendete `opId` ist beim Statuswrite bereits geloescht.

**Impact:** Genau der sammel33-Befund "Aktionsbeleg kann dauerhaft fehlen" bleibt fuer Prozesscrash und Markierungs-Writefehler bestehen. Die API weist den Schwebezustand nur aus, wenn der zweite Write noch gelingt; sie ist daher nicht in allen Fehlerfaellen ehrlich.

**Erforderliche Korrektur:** Die Pending-Markierung muss **vorbeugend im selben `resolveClaim`-CAS** wie Endstatus, Wer und Wann persistiert werden. Danach:

1. `recordOnce` versuchen.
2. Bei Erfolg die Markierung mit einem bedingten `clearAuditPending(candidateId, eventId)` entfernen.
3. Bei Fehler oder Crash bleibt die Markierung automatisch fuer den Queue-Retry stehen.

Die Event-ID ist vor dem Statuswrite bekannt. Ein Test muss direkt nach erfolgreichem `resolveClaim`, aber vor Audit/Markierungsfolge einen simulierten Prozessabbruch setzen; nach Neustart muss der Queue-Load genau einen Beleg erzeugen und die bereits im Statuswrite vorhandene Markierung loeschen.

### [ROT-2] Recovery verliert den urspruenglichen Reviewer

**Beleg:** Der Claim persistiert nur `opId` und `claimedAt`, nicht Akteur und Aktion (`services/library-analytics/src/repo.ts:25-43`; Pg in `repo-pg.ts:183-188`). Wenn ein Accept nach KO-Erzeugung crasht, vollendet Recovery den Kandidaten mit:

- `reviewedBy: "system"`
- `reviewedAt: Zeitpunkt der Recovery`

(`services/library-analytics/src/service.ts:739-758`).

Der menschliche Reviewer, der den Accept ausgeloest hat, geht damit in den neuen unverlierbaren Wer/Wann-Feldern verloren. Das KO traegt zwar fuer die Import-Erstanlage den Reviewer als `author`, aber Recovery nutzt diesen vorhandenen Wert nicht und trennt auch nicht zwischen "entschieden von" und "technisch vollendet durch system".

**Impact:** Nach einem Crash ist die fachliche Aussage "Wer hat angenommen?" falsch bzw. unvollstaendig. Gerade der neue Belegvertrag soll diese Information dauerhaft sichern.

**Erforderliche Korrektur:** Claim-CAS muss mindestens `claimedBy` und `claimedAction` zusammen mit `opId/claimedAt` speichern. Recovery verwendet diese Werte fuer `reviewedBy` und die Aktions-Event-ID; optional kann ein zusaetzliches Feld/Audit-Payload `recoveredBy: system` die technische Vollendung ausweisen. Fuer Altclaims ist ein expliziter, ehrlicher Fallback zulaessig, aber neue Claims duerfen den Akteur nicht verlieren.

### [GELB] `reviewedAction` ist entgegen Auftragsbeschreibung nicht persistiert

Der Auftrag nennt `reviewedBy`/`reviewedAt`/`reviewedAction`. Implementiert sind nur `reviewedBy` und `reviewedAt` (`services/library-analytics/src/types.ts:78-89`; `repo.ts:194-203`; `repo-pg.ts:209-220`). Die Aktion ist bei den heutigen terminalen Statuswerten ableitbar:

- `angenommen` -> accept
- `abgelehnt` -> reject
- `info-angefragt` -> info

Das ist aktuell nicht mehrdeutig und deshalb kein eigener Ship-Blocker. Vertrag und Bericht sollten aber entweder die Ableitung explizit festschreiben oder `reviewedAction` tatsaechlich speichern. Fuer Recovery ist ein gespeichertes Claim-Action-Feld ohnehin wegen ROT-2 erforderlich.

### [GELB] `eventId` ist nicht durch die Audit-Hashkette geschuetzt

`AuditEntry.eventId` ist bewusst vom Hash ausgeschlossen (`services/audit/src/types.ts:11-14`). Dadurch bleibt der Altbestand verifizierbar, aber eine nachtraegliche Aenderung oder Entfernung von `event_id` wird von `AuditService.verify()` nicht erkannt. Ein manipulierter Idempotenzschluessel kann spaeter einen zweiten Beleg desselben logischen Ereignisses ermoeglichen, waehrend die Kettenpruefung weiterhin gruen bleibt.

Das ist kein Bypass im normalen App-Pfad, aber eine neue Integritaetsluecke in genau dem Feld, das Exactly-once garantieren soll. Rueckwaertskompatibel waere: `eventId` nur bei neuen Eintraegen optional in `hashEntry` einbeziehen; Altzeilen ohne Feld behalten ihren bisherigen Hash.

## Gruene Punkte

### ROT-1 aus sammel33 - `ko.created` Exactly-once: GRUEN

- `AuditService.recordOnce` erzeugt eine stabile Event-ID und delegiert an `appendOnce` (`services/audit/src/service.ts:43-65`).
- PostgreSQL besitzt eine additive nullable `event_id`-Spalte, partiellen Unique-Index und `ON CONFLICT ... DO NOTHING` mit ehrlicher Boolean-Rueckgabe (`services/audit/src/repo-pg.ts:20-30`, `85-106`).
- InMemory prueft und reserviert die Event-ID synchron ohne Await-Fenster (`services/audit/src/repo.ts:21-45`).
- `KoService.create` und `ensureCreatedSideEffects` nutzen denselben kollisionsfreien Schluessel `ko.created:<koId>` (`services/knowledge-object/src/service.ts:365-370`, `386-413`).
- Die Event-Namensraeume sind getrennt: `ko.created:<koId>` gegen `import.candidate-<action>:<candidateId>:<opId>`.
- InMemory- und echte Pg-Tests lassen zwei gleiche Events parallel schreiben und verlangen exakt einen Eintrag sowie eine intakte Kette (`services/audit/src/service.test.ts:57-102`; `repo-pg.integration.test.ts:98-143`).

Hinweis ohne neue Ship-Sperre: Zwei **verschiedene** parallele Audit-Events koennen weiterhin auf dieselbe vorab gelesene `seq` treffen; ein Schreiber kann dann am `seq`-Primary-Key scheitern. Die neuen Review-Pfade behandeln das als pending/retry. Das ist ein allgemeiner Altbestandspunkt des Audit-Sequenzierers, nicht ein Exactly-once-Bypass fuer dieselbe Event-ID.

### ROT-2 aus sammel33 - Re-Sync-Nachzug: GRUEN

Der `existing && externalId`-Zweig prueft bei gestempelten KOs `ensureCreatedSideEffects(existing)` **vor** Vertraulichkeits-Upgrade, Revision und Rueckgabe (`services/library-analytics/src/service.ts:822-846`). Damit kann Kandidat B As teilpersistiertes KO nicht mehr vor der v1-Reparatur revidieren.

Der neue Test ist nicht vakuoes: A hinterlaesst ein KO ohne Snapshot/Audit; B mit hoeherer Source-Version scheitert, solange der Nachzug nicht moeglich ist; nach Heilung entsteht v1 aus As Erstanlagezustand und erst danach Bs Revision (`tests/app/review-claim-recovery.test.ts:620-658`).

### ReviewedBy/At im normalen Endstatus-CAS: GRUEN

Fuer einen nicht crashenden Review reisen `reviewedBy` und `reviewedAt` im selben InMemory-/Pg-Statuswrite wie Endstatus und koId (`services/library-analytics/src/service.ts:504-531`; `repo.ts:175-203`; `repo-pg.ts:194-220`). Ein nachgelagerter Auditfehler kann diese beiden Felder nicht mehr entfernen.

### Audit-Retry nach erfolgreich gesetzter Markierung: GRUEN

Ist `auditPending` vorhanden, verwendet der Retry die gespeicherte Event-ID, schreibt per `recordOnce` und loescht die Markierung erst nach Erfolg (`services/library-analytics/src/service.ts:650-681`). Parallele Retries erzeugen keinen Doppelbeleg. Der Queue-GET ruft Recovery und danach den Audit-Retry auf (`services/app/src/routes/library-routes.ts:135-148`). Die Mechanik ist korrekt; ROT-1 betrifft das vorgelagerte Fenster, in dem die Markierung noch nicht persistiert ist.

### Migration und Pg-Testsicherung: GRUEN unter Betriebsbedingung

- `AUDIT_EVENT_ID_SCHEMA` ist additiv und liegt direkt nach `AUDIT_SCHEMA`; Altzeilen bleiben `NULL`, normale `record()`-Eintraege sind vom partiellen Index unberuehrt (`services/app/src/db.ts:30-44`).
- Stop-then-start verhindert Mischbetrieb eines Writers, der `recordOnce` nutzt, bevor die Spalte existiert.
- Die destruktiven Suiten verwenden nun `KLARWERK_PG_TEST_URL` und lehnen Datenbanknamen ohne `test` ab, sofern kein explizites `KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1` gesetzt ist (`services/db-tx/src/pg-test-guard.ts:1-34`).
- Der Guard ist im schnellen Gate getestet und beide Pg-Suiten verwenden ihn.

Die Namenspruefung ist eine Schutzkonvention, kein mathematischer Beweis, dass eine DB wertlos ist. Deploy-/CI-Anweisung muss deshalb weiterhin eine isolierte Wegwerf-Testdatenbank verlangen; der Destruktiv-Override darf in Produktionsumgebungen nicht gesetzt sein.

### Regressionen 57-80: GRUEN in statischer Pruefung

Stabiler Kandidatenanker, Claim-CAS, Cleanup-/Trash-Vertrag, sequenzieller Nachzieh-Pfad, F2-Stepper, F3-aiCheck/Eviction und Egress-/Vertraulichkeitsgrenzen wurden nicht geschwaecht. Die Erweiterung von `AuditRepo` wurde auch in der Dev-Journal-Mutationsliste erfasst.

## Verdikttabelle

| Pruefpunkt | Verdikt | Befund |
|---|---|---|
| `recordOnce` gleiche Event-ID | **GRUEN** | Pg-Unique/ON-CONFLICT und InMemory-Set erzwingen genau einen Beleg. |
| Event-ID-Schema | **GRUEN funktional / GELB Integritaet** | Kollisionsfreie Namensraeume; `eventId` selbst ist nicht hashgeschuetzt. |
| Re-Sync vor Revision | **GRUEN** | Nachzug ist korrekt vor Upgrade/Revision/Rueckgabe verdrahtet und getestet. |
| ReviewedBy/At normaler Abschluss | **GRUEN** | Beide Felder reisen im Endstatus-CAS mit. |
| ReviewedAction | **GELB** | Nicht gespeichert, heute eindeutig aus Status ableitbar; Auftragsbehauptung stimmt wörtlich nicht. |
| AuditPending crash-sicher | **ROT** | Markierung folgt erst in einem zweiten Write; Crash/Loeschung kann Beleg und Retry-Marker verlieren. |
| Recovery-Wer/Wann | **ROT** | Recovery schreibt `system`/Recovery-Zeit und verliert den urspruenglichen Reviewer. |
| Retry bei vorhandener Markierung | **GRUEN** | Exactly-once, Markierung erst nach erfolgreichem Beleg geloescht. |
| AuditPending API-Ausweis | **GELB** | Ehrlich, wenn Markierungswrite gelingt; im offenen Crashfenster fehlt das Signal. |
| Pg-Migration und Testguard | **GRUEN unter Auflage** | Additiv; destruktive Tests nur auf isolierter Test-DB/mit bewusstem Override. |
| Regressionen 57-80 | **GRUEN statisch** | Keine Ruecknahme der vorherigen Gruenpunkte erkannt. |

## Ship-Entscheidung

**Explizite Antwort: NO-GO. Das Ship-8-Paket patches57-81 ist noch nicht shipbar.**

Vor Ship sind zwei eng begrenzte Codekorrekturen erforderlich:

1. `auditPending` samt stabiler Event-ID muss vorbeugend im selben `resolveClaim`-Write wie Endstatus, `reviewedBy` und `reviewedAt` gesetzt werden; nach erfolgreichem `recordOnce` wird es bedingt geloescht. So bleibt der Retry-Marker bei jedem Crash automatisch stehen.
2. Der Claim muss den urspruenglichen Akteur und die Aktion persistieren; Recovery darf die fachliche Entscheidung nicht pauschal `system` zuschreiben. `system` kann separat als technischer Recovery-Akteur dokumentiert werden.

Empfohlene Folgehaertung: `eventId` bei neuen Auditzeilen in den Hash aufnehmen und die allgemeine Pg-Audit-Sequenzierung fuer verschiedene parallele Events serialisieren.

Nach Schliessung bleiben die Deploy-Bedingungen:

- **stop-then-start und genau eine Instanz**; kein Mischbetrieb alter/neuer Audit-Schemastaende.
- **`SLIDES`-Flag unset** vor Start nachweisen.
- **Finales Gate auf der wirklichen Endkette**; 419/3105 gilt nur fuer 57-81 und ist hier uebernommene Evidence.
- **Pg-Nachweis auf isolierter Wegwerf-Test-DB:** Audit-Migration/Re-Run, paralleles `recordOnce`, KO-Anker-Migration/Kollision/Trash. Kein Destruktiv-Override in Produktion.
- **Gezielte Fehler-Smokes vor Deploy:** Crash direkt nach Status-CAS; Auditfehler plus Markierungs-Retry; paralleler Retry; Recovery bewahrt Original-Reviewer; A-Teilpersistenz plus B-Re-Sync; Alt-Lauf-Fortsetzung; D-CLEAN-vs.-Claim.
- **Smoke nach Start:** Health/Version; Import Explore/Group/Apply; Accept mit Wer/Wann/Aktion; Queue-Load zieht Pending-Audit nach; Review-vs.-Cleanup; Stepper Erfolg/Fehler/Snapshot-Expired; aiCheck Overflow/Retry; vertraulicher Ask-Prefill ohne Netzaufruf.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch im Arbeitsrepo angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 18:23:47 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): bd58c405bd6eac1974f26414dc3f1ac98655901f76da6a2c556b640dab1fc771
