# BERICHT sammel37 - Finaler Recheck Ship 8 CLOSE-9

## Kurzurteil

**GESAMTVERDIKT: GRUEN - GO fuer Ship 8 (Patchkette 57-84).**

Patch84 setzt die beiden Vor-Ship-Auflagen aus `BERICHT-sammel36.md` eng und korrekt um. Ein fehlender oder veralteter Confirm-Digest kann vor dem ersten `CLEANUP_DRIFT` keine Mutation mehr ausloesen. Nach erfolgreicher Digest-Pruefung darf der Audit-Nachzug laufen; anschliessend werden Zielmenge und Digest erneut geprueft, bevor KO- oder Queue-Loeschungen beginnen. Der Ergebniszaehler `auditPendingCandidates` stammt nun aus der tatsaechlichen Restmenge nach dem bedingten DELETE.

Es wurden keine neuen roten oder gelben Befunde im Patchumfang gefunden. Die drei geforderten Regressionstests bilden die beanstandeten Fenster wirksam ab. Damit hebt Patch84 das bisherige Gesamt-GELB auf **GRUEN**.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel37.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches84/0001-fix-server-WP-SHIP8-CLOSE-9-bens-Vor-Ship-Korrektur-.patch`
- Patch-SHA-256: `3bf86b063fb98defe74a82d7b2c4f904b8832bfc40ffc4e57963bd519f6016c9`
- Patchumfang: 2 Dateien, +178/-15; keine neue Datei.
- Methode: Patch84 mit `git apply --check` gegen den temporaer materialisierten Stand patches57-83 geprueft, anschliessend nur in einer separaten Temp-Kopie statisch analysiert. Das Arbeitsrepo blieb unangetastet.
- Kein Bau und kein Testlauf gemaess Auftrag. `419 Testdateien / 3118 Tests gruen` sowie PostgreSQL `11/11` sind uebernommene Evidence, nicht von Ben nachgerechnet.

## Findings

**Keine blockierenden oder auflagenpflichtigen Findings.**

## Pruefung der Vor-Ship-Korrekturen

### 1. Fehlender oder veralteter Digest bleibt vor der ersten Ablehnung schreibfrei: GRUEN

`runImportCleanup` fuehrt jetzt zuerst ausschliesslich `cleanupTargets()` aus und berechnet daraus den Digest (`services/library-analytics/src/service.ts:329-338`). Bei fehlendem oder abweichendem `confirmedDigest` wird unmittelbar `CLEANUP_DRIFT` geworfen (`service.ts:338-343`).

Die dabei verwendeten Helfer sind im materialisierten Endstand read-only:

- `cleanupTargets()` liest nur `candidates.all()` und `koService.list()` (`service.ts:231-261`).
- `KoService.list()` delegiert auf `repo.list()` und filtert geloeschte KOs; der fruehere schreibende Trash-Sweep ist aus dem Lesepfad entfernt (`services/knowledge-object/src/service.ts:604-608`).
- Vor Zeile 343 gibt es weder Audit-, Marker-, KO- noch Queue-Write.

Der best-effort Beleg-Retry folgt erst nach erfolgreicher erster Digest-Pruefung (`service.ts:344-346`). Damit ist der konkrete sammel36-Befund geschlossen: Ein ungebundener Confirm kann weder `recordOnce` schreiben noch `auditPending` entfernen.

### 2. Zweite Pruefung nach dem Retry: GRUEN

Nach dem erlaubten Retry liest der Service Kandidaten, Statuswerte, KO-Ziele und Claim-Zaehler neu (`service.ts:347-350`). Der Digest dieser frischen Zielmenge muss weiterhin dem zuerst bestaetigten Digest entsprechen; andernfalls folgt erneut `CLEANUP_DRIFT`, noch bevor die KO-Phase beginnt (`service.ts:351-361`).

Das ist fachlich konsistent:

- Der Retry darf nur den Aktionsbeleg schreiben und die dazugehoerige Pending-Markierung entfernen.
- Kandidaten-IDs, Kandidatenstatus und KO-Ziele werden durch den Retry nicht veraendert und bleiben deshalb digest-stabil.
- Eine andere parallele Aenderung der Zielmenge wird vor KO-/Queue-Loeschungen erkannt.

Bei einer Drift erst nach dem gueltigen ersten Confirm kann der erlaubte Recovery-Retry bereits stattgefunden haben. Das ist kein Rueckfall in den beanstandeten Vertrag: Der erste Confirm war gueltig, der Beleg-Nachzug ist exactly-once und in sicherer Richtung; die zweite Pruefung verhindert anschliessend jede destruktive Cleanup-Mutation.

### 3. Ergebniszaehler aus der echten Restmenge: GRUEN

Nach dem bedingten Kandidaten-DELETE wird die Queue genau einmal neu gelesen (`service.ts:466-470`). Aus diesem selben Nachzustand werden berechnet:

- `newCandidates`: Kandidaten, die nicht zur bestaetigten ID-Menge gehoeren;
- `auditPendingCandidates`: noch vorhandene, bestaetigte Kandidaten mit tatsaechlich verbleibendem Marker (`service.ts:471-478`).

Der Wert fliesst identisch in Abschluss-Audit und API-Antwort (`service.ts:479-510`). Damit kann eine parallele erfolgreiche Marker-Raeumung nicht mehr zu der falschen Aussage fuehren, der bereits geloeschte Kandidat sei wegen eines Pending-Belegs ausgenommen worden. Die Vorschau bleibt korrekt ein klarer Snapshot (`service.ts:267-290`).

### 4. Pflichttests: GRUEN und beweiskraeftig

#### Test 1 - fehlender/veralteter Digest

Der Test erzeugt einen angenommenen Kandidaten mit echtem `auditPending`, heilt danach die Audit-Senke und sendet zuerst keinen, dann einen durch einen Neuzugang veralteten Digest (`tests/app/import-cleanup.test.ts:757-816`). Geprueft werden:

- beide Antworten `409`;
- kein `import.candidate-accept`-Beleg;
- Pending-Marker unveraendert;
- keine Kandidatenloeschung;
- kein KO im Papierkorb.

Ohne die neue Reihenfolge wuerde bereits der erste Request den nun moeglichen Retry ausfuehren, einen Beleg schreiben und den Marker entfernen. Der Test ist daher real rot ohne Fix.

#### Test 2 - gueltiger Digest

Mit geheilter Audit-Senke und gueltigem Digest wird der Retry nach der Validierung ausgefuehrt. Der Test fordert zwei entfernte Kandidaten, keinen Pending-Rest, leere Queue und genau einen `retried:true`-Beleg (`tests/app/import-cleanup.test.ts:818-847`). Damit ist sowohl der positive Cleanup-Weg als auch Exactly-once gepinnt.

#### Test 3 - parallele Marker-Raeumung

Der Test injiziert den parallelen Retry am vierten realen `candidates.all()`-Aufruf, unmittelbar nach dem Vorab-Read der Delete-Phase und vor `removeByIds` (`tests/app/import-cleanup.test.ts:849-894`). Der Marker wird dabei wirklich geraeumt, das atomare Delete darf den Kandidaten entfernen, und die Antwort muss `auditPendingCandidates: 0` liefern.

Mit dem alten Vorab-Snapshot waere der Rueckgabewert `1`; der Test wuerde rot. Die Injektion prueft somit die Orchestrator-Reihenfolge und nicht bloss eine selbstdeckelnde Testattrappe.

### 5. Patchdisziplin und Regressionen: GRUEN

- Produktiv geaendert wurde nur `runImportCleanup`; Repo-Vertraege, Pg-SQL und InMemory-Delete blieben unberuehrt.
- Das Pg-DELETE bleibt atomar an ID, bestaetigten Status und fehlenden `auditPending`-Marker gebunden (`services/library-analytics/src/repo-pg.ts:286-303`).
- Der InMemory-Spiegel prueft Status, Marker und Delete synchron (`services/library-analytics/src/repo.ts:291-309`).
- Der Preview-Vertrag, Claim-Schutz, Versions-CAS der KO-Phase, Exactly-once-Event-ID, DTO-Grenze und Recovery-Payload wurden nicht abgeschwaecht.
- Ein bestehender Race-Test wurde nur an den zusaetzlichen, absichtlich eingefuehrten Read angepasst (`all #3` auf `all #4`); seine Injektion bleibt unmittelbar vor dem bedingten Delete wirksam (`tests/app/import-cleanup.test.ts:571-594`).
- Keine neue Datei, Route, API-Flaeche, Migration, HTML-Senke oder Berechtigungsaenderung.

## Verdikttabelle

| Pruefpunkt | Verdikt | Beleg |
|---|---|---|
| Erster Digest-Check vor jedem Write | **GRUEN** | Reine Zielermittlung, unmittelbarer 409-Abbruch, Retry erst danach. |
| Zweiter Digest-Check nach Retry | **GRUEN** | Frischer Zustand; Drift stoppt vor KO-/Queue-Loeschung. |
| Ergebniszaehler nach DELETE | **GRUEN** | Zaehlt nur verbleibende bestaetigte Markertraeger. |
| Pflichttest fehlend/veraltet | **GRUEN** | Waere ohne Reihenfolgefix rot; prueft Audit, Marker und Loeschung. |
| Pflichttest gueltig | **GRUEN** | Genau ein Retry-Beleg, Marker weg, Cleanup erlaubt. |
| Pflichttest paralleles Clear | **GRUEN** | Waere mit altem Vorabzaehler rot. |
| Regressionen 57-83 | **GRUEN statisch** | Enger Zwei-Dateien-Diff, Kernvertraege unveraendert. |

## Ship-Entscheidung

**Explizite Antwort: GO. Patches57-84 sind aus diesem Review shipbar.**

Die zwei Restauflagen aus sammel36 sind geschlossen. Ein weiterer Architekturreview fuer diesen engen Patch ist nicht erforderlich. Die bereits dokumentierten Folgehaertungen aus sammel34 - insbesondere eine spaetere Hash-Bindung der Audit-`eventId` und die allgemeine Pg-Sequenzierung verschiedener paralleler Audit-Events - bleiben Post-Ship-Haertung und blockieren Ship 8 nicht.

## Deploy-Bedingungen

1. Stop-then-start und genau eine Instanz; kein Mischbetrieb verschiedener Servicevertraege.
2. `SLIDES`-Flag vor Start als unset nachweisen.
3. Finales Gate auf der tatsaechlich angewandten Endkette 57-84 gruen nachweisen. Die gemeldeten `419/3118` und Pg `11/11` sind hier nur uebernommene Evidence.
4. PostgreSQL-Nachweis ausschliesslich auf isolierter Wegwerf-Test-DB; kein destruktiver Test-Override in Produktion.
5. Vor Deploy gezielt smoken:
   - Pending + fehlender/veralteter Digest: 409, kein Aktionsaudit, Marker und Daten unveraendert;
   - Pending + gueltiger Digest bei Auditfehler: Marker/Kandidat bleiben;
   - geheilte Audit-Senke: genau ein Beleg, Marker weg, Cleanup entfernt erst danach;
   - paralleler Retry/Queue-Load: kein Doppelbeleg, ehrliche Restmengenbilanz;
   - bestehende Crashfenster nach Status-CAS sowie nach Audit vor Clear;
   - Recovery-Auditfehler mit erhaltener `recoveredBy`-Kennzeichnung.
6. Nach Start: Health/Version, Import Explore/Group/Apply, Accept/Reject/Info/Dublette, Queue-DTO ohne Interna, D-CLEAN Preview/Confirm/Drift und Review-vs.-Cleanup pruefen.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch im Arbeitsrepo angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 21:03:19 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): 486c4001b1be13070316db5b5e6ea40936a5c66f28cf0c3611a614932a3377f9
