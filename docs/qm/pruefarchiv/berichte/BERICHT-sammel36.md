# BERICHT sammel36 - Finaler Recheck 8 Ship 8

## Kurzurteil

**GESAMTVERDIKT: GELB - BEDINGTES GO fuer Ship 8 nach einer eng begrenzten Vor-Ship-Korrektur.**

Patch83 schliesst den harten sammel35-Blocker: Ein Kandidat mit `auditPending` kann im produktiven Cleanup nicht mehr geloescht werden. Die Sperre sitzt korrekt im atomaren Pg-DELETE und ist synchron im InMemory-Repo gespiegelt. Der Recovery-Payload ueberlebt den Audit-Retry, und die Kandidaten-API nutzt nun eine echte Allowlist-DTO-Grenze. Fuer die Kernfragen Belegverlust, Exactly-once und Claim-Interna ist die Kette 57-83 statisch gruen.

Eine kleinere, aber echte Vertragsregression bleibt: `runImportCleanup` ruft den best-effort Audit-Retry **vor** der Digest-Pruefung auf. Dadurch kann selbst ein fehlender oder veralteter Confirm bereits `recordOnce` schreiben und `auditPending` loeschen, bevor die Route mit `CLEANUP_DRIFT` abbricht. Das widerspricht dem bestehenden Cleanup-Vertrag "Digest validieren, bevor irgendein Write passiert". Die Wirkung ist in sicherer Richtung und erzeugt weder Belegverlust noch Doppelbeleg; fuer ein unbedingt freigegebenes Ship sollte die Reihenfolge dennoch korrigiert und gepinnt werden.

**Ship-Frage:** Nicht unbedingt GO in der vorliegenden Form. **Bedingtes GO**, sobald Retry und Bilanz hinter eine erfolgreiche Digest-Pruefung verschoben bzw. neu gelesen sind und das Endketten-Gate erneut gruen ist.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel36.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches83/0001-fix-server-web-WP-SHIP8-CLOSE-8-bens-sammel35-ROT-Cl.patch`
- Patch-SHA-256: `ec5c7667f0f8f5ba067923a8dc9bba93af9b39d0fdb1aaf856eba969dba6e089`
- Patch-Statistik: 12 Dateien, +450/-33; keine neue Datei.
- Methode: Patch83 mit `git apply --check` gegen den temporaer materialisierten Stand patches57-82 geprueft und ausschliesslich in einer separaten Temp-Kopie statisch analysiert. Das Arbeitsrepo blieb unangetastet.
- Kein Bau und kein Testlauf gemaess Auftrag. `419 Testdateien / 3115 Tests gruen` sowie PostgreSQL 16.13 `11/11` sind uebernommene Evidence, nicht von Ben nachgerechnet.

## Finding

### [GELB-1] Audit-Retry schreibt vor der Digest-Pruefung

**Beleg:** `runImportCleanup` ruft zuerst `retryPendingReviewAudits()` auf (`services/library-analytics/src/service.ts:329-333`). Erst danach werden Zielmenge und Digest berechnet und gegen `confirmedDigest` geprueft (`service.ts:334-345`).

Der Retry ist kein read-only Vorgang. Bei Erfolg:

1. schreibt `recordOnce` den ausstehenden Aktionsbeleg,
2. entfernt `clearAuditPending` die Marker-Struktur am Kandidaten

(`service.ts:713-741`).

Damit kann ein Request mit fehlendem oder veraltetem Digest Daten veraendern und anschliessend trotzdem `CLEANUP_DRIFT` liefern. Der vorbestehende Vertrag und Kommentar sagen dagegen: vollstaendige Zielmenge gegen Digest validieren, **bevor irgendein Write passiert** (`service.ts:296-308`). Der Drift-Test prueft nur, dass keine Kandidaten/KOs geloescht werden; er erzeugt keinen Pending-Kandidaten und bemerkt deshalb Audit-/Marker-Writes nicht (`tests/app/import-cleanup.test.ts:189-222`).

**Impact:** Kein Beleg geht verloren, kein Doppelbeleg entsteht, und keine unberechtigte Loeschung erfolgt. Die Abweichung ist dennoch relevant fuer API-Ehrlichkeit, Wiederholbarkeit und die bereits zugesicherte schreibfreie 409-Semantik. Ein Admin kann mit einem ungueltigen Confirm unbemerkt Recovery-Zustand veraendern.

**Erforderliche Vor-Ship-Korrektur:**

1. Zielmenge/Digest lesen und `confirmedDigest` validieren.
2. Nur nach erfolgreicher Validierung den best-effort Retry ausfuehren.
3. Danach Kandidatenzustand fuer Delete-Versuche und `auditPendingCandidates` neu lesen. Da der Retry keine Kandidaten-IDs, Statuswerte oder KO-Ziele aendern darf, bleibt der bestaetigte Digest stabil; bei sonstiger paralleler Drift erneut fail-closed abbrechen.
4. Pflichttest: Pending-Kandidat plus fehlender/veralteter Digest -> 409, kein Aktionsaudit geschrieben, Marker unveraendert. Mit gueltigem Digest -> Retry, genau ein Beleg, danach Cleanup erlaubt.

### [GELB-2] Ergebniszaehler ist ein Vorab-Snapshot, nicht zwingend die tatsaechliche Restmenge

`auditPendingCandidates` wird direkt nach dem Vorab-Retry in `cleanupTargets` gezaehlt (`service.ts:334-335`) und unveraendert in Audit und Antwort uebernommen (`service.ts:456-488`). Das atomare DELETE entscheidet spaeter nach dem dann aktuellen Marker. Raeumt ein paralleler Queue-Load den Marker zwischen Zaehlen und DELETE, darf der Kandidat fallen, waehrend die Antwort weiterhin "1 ... vom Aufraeumen ausgenommen" meldet. Umgekehrt ist ein neu auftauchender Marker strukturell unwahrscheinlich, weil er mit einem Statuswechsel einhergeht, aber die Bilanz sollte sich nicht auf diese Annahme stuetzen.

**Fix-Richtung:** Fuer die Ergebnisantwort `auditPendingCandidates` aus den nach dem DELETE tatsaechlich verbleibenden bestaetigten Kandidaten mit Marker berechnen. Die Vorschau darf weiterhin eine klar als Snapshot verstandene Zahl zeigen.

Diese Bilanzkante kann zusammen mit GELB-1 ohne Architekturumbau geschlossen werden.

## Gruene Punkte

### ROT-1 - atomare Pending-Loeschsperre: GRUEN

- Pg loescht nur bei passender ID, passendem Status und `data->'auditPending' IS NULL` in **einem** DELETE (`services/library-analytics/src/repo-pg.ts:286-303`).
- Das JSONB-Praedikat ist fail-closed fuer alle vorhandenen Markerformen: Objekt, String, Boolean oder JSON-`null` sind nicht SQL-`NULL` und bleiben geschuetzt. Nur ein wirklich fehlender Schluessel ist loeschbar.
- InMemory prueft Status und `auditPending === undefined` synchron direkt vor `Map.delete` (`services/library-analytics/src/repo.ts:291-309`).
- Der echte Pg-Test fordert bei identischem Status: Pending ueberlebt; nach exakt passendem `clearAuditPending` greift dasselbe Delete (`services/library-analytics/src/repo-pg.integration.test.ts:485-510`).
- Der E2E-Pflichttest geht ueber die echte Cleanup-Route und zeigt: Auditfehler -> Marker/Kandidat ueberleben; erfolgreicher Retry -> genau ein Beleg; erst der naechste Cleanup entfernt den Kandidaten (`tests/app/import-cleanup.test.ts:672-754`). Der Test wuerde ohne das neue Delete-Praedikat rot.

### Keine aktuelle produktive Kandidaten-Loeschumgehung: GRUEN

- `runImportCleanup` ist der einzige Produktaufrufer von `removeByIds`.
- `removeAll` bleibt im Repo-Vertrag, wird im aktuellen Baum aber nur von Tests/Werkzeugen aufgerufen, nicht von einer Produkt-Route oder einem Runtime-Service.
- Die additive Startup-Deduplizierung loescht nur offene `neu`/`in_bearbeitung`-Altdubletten. Produktseitiges `auditPending` existiert ausschliesslich an terminalen Review-Ergebnissen; diese Migration trifft den Markertraeger daher nicht (`services/library-analytics/src/repo-pg.ts:104-122`).
- KO-seitiger Trash/Hard-Purge entfernt keinen Importkandidaten und damit keinen Pending-Marker. Der Cleanup darf ein zugehoeriges KO in den Papierkorb verschieben; der spaetere Aktionsbeleg bleibt ueber Kandidat/Event-ID rekonstruierbar.

### Best-effort Retry / Exactly-once: GRUEN mit GELB-1

Der Retry verwendet weiterhin `recordOnce` mit gespeicherter Event-ID und entfernt den Marker erst danach bedingt. Parallele Cleanup-/Queue-Retries koennen daher keinen Doppelbeleg erzeugen. Scheitert Record oder Clear, bleibt die Delete-Sperre aktiv. Die einzige Beanstandung ist die Position vor der Digest-Pruefung, nicht die Exactly-once-Mechanik.

### GELB-1 aus sammel35 - Recovery-Payload: GRUEN

- Die Pending-Struktur traegt optional den begrenzten Recovery-Payload (`services/library-analytics/src/types.ts:93-108`).
- Recovery baut den Payload einmalig aus `duplicate`, `koId`, `recovered`, `recoveredBy` und optional `reviewerUnknown`, verwendet ihn fuer den Sofortbeleg und persistiert ihn im Marker (`services/library-analytics/src/service.ts:826-858`).
- Der Retry uebernimmt den Payload unveraendert und ergaenzt nur `retried:true` (`service.ts:723-737`).
- Der neue Test laesst gezielt das Recovery-Audit scheitern und prueft die Kennzeichnung im spaeteren Beleg (`tests/app/review-claim-recovery.test.ts:972-1031`).

Der Typ `Record<string, unknown>` ist breiter als die heutige fachliche Nutzlast, aber der Payload wird ausschliesslich serverseitig erzeugt und nicht aus Requestdaten uebernommen. Aktuell entsteht dadurch keine neue PII- oder Egressflaeche. Eine spaetere Haertung auf einen expliziten Recovery-Payload-Typ waere sinnvoll, ist aber kein Ship-Blocker.

### GELB-2 aus sammel35 - Response-DTO: GRUEN

- Die DTO-Grenze ist eine Allowlist, kein `Omit`/Spread. Kuenftige interne Felder gelangen dadurch standardmaessig nicht auf den Draht (`services/app/src/routes/library-routes.ts:34-68`).
- POST Create, GET Queue und PUT Review verwenden alle dieselbe DTO-Funktion (`library-routes.ts:165-191`, `225-275`).
- `opId`, `claimedAt`, `claimedBy`, `claimedAction`, Pending-Event-ID, Actor und Payload fehlen im Wire-Objekt. `auditPending` erscheint nur als Boolean.
- Confluence Apply gibt nur aggregierte Zaehler zurueck und sendet keine rohen Kandidatenobjekte. Weitere Produkt-Routen mit direkter Kandidatenausgabe wurden nicht gefunden.
- Der E2E-Test pinnt die Schluessel fuer GET und PUT sowie den Boolean-Typ (`tests/app/import-cleanup.test.ts:756-816`).

### Vorschau/UI/i18n: GRUEN mit GELB-2

Preview und Ergebnis besitzen `auditPendingCandidates` in Server- und Webtypen. Die UI zeigt den Schutzgrund separat; DE, EN und NL sind vorhanden und inhaltlich passend (`apps/web/src/i18n.ts:2208-2209`, `5475-5476`, `8703-8704`; `apps/web/src/components/ImportCleanup.tsx:100-112`, `150-160`). Der Digest bleibt bewusst an Kandidaten-/KO-IDs gebunden; ein Marker-Clear aendert die bestaetigte Objektmenge nicht. Fuer die finale Ergebniswahrheit gilt die kleine Nachlese-Auflage aus GELB-2.

### Regressionen 57-82: GRUEN in statischer Pruefung

Endstatus plus Pending in einem CAS, exaktes Clear, Reviewer/Aktion, `reviewedAction`, Kandidatenanker, Create-Belege, Re-Sync, Review-vs.-Cleanup, F2/F3 und Pg-Testguard wurden nicht geschwaecht. Normale Kandidaten ohne Pending werden weiterhin nach bestaetigtem Status geloescht; laufende Claims bleiben geschuetzt.

### Verbleibende Folgehaertung aus sammel34

`eventId` bleibt ausserhalb des Audit-Hashes. Das ist weiterhin kein normaler App-Bypass und kein Blocker fuer diesen Patch, sollte aber nach Ship rueckwaertskompatibel gehaertet werden. Gleiches gilt fuer die allgemeine Pg-Sequenzierung verschiedener paralleler Audit-Events.

## Verdikttabelle

| Pruefpunkt | Verdikt | Befund |
|---|---|---|
| Pending-Sperre im Pg-DELETE | **GRUEN** | Atomar, fail-closed fuer jeden vorhandenen JSONB-Wert. |
| InMemory-Spiegel | **GRUEN** | Status, Marker und Delete synchron in einer Bedingung. |
| Andere Kandidaten-Loeschwege | **GRUEN aktuell** | Kein produktiver Bypass; `removeAll` nur Test/Werkzeug, Startup-Dedupe nur offene Status. |
| KO-Trash/Purge-Wechselwirkung | **GRUEN** | Entfernt den Kandidatenmarker nicht; Beleg bleibt nachziehbar. |
| Best-effort Retry / Exactly-once | **GRUEN** | Kein Doppelbeleg, Marker bleibt bei Fehler aktiv. |
| Retry-Reihenfolge zum Digest | **GELB - Vor-Ship-Auflage** | Ungueltiger Confirm kann vor 409 bereits Audit/Marker schreiben. |
| Preview-/Ergebnisbilanz | **GRUEN Preview / GELB Ergebnisrace** | Resultat sollte verbleibende Pending-Kandidaten nach Delete neu zaehlen. |
| Recovery-Payload | **GRUEN** | Kennzeichnung ueberlebt Sofortfehler und Retry; keine Request-/Wire-Exposition. |
| Kandidaten-DTO | **GRUEN** | Allowlist an Create/List/Review; Interna entfernt, Pending nur Boolean. |
| i18n DE/EN/NL | **GRUEN** | Copy vorhanden und passend. |
| Regressionen 57-82 | **GRUEN statisch** | Keine Schwaechung der bisherigen Gruenpunkte erkannt. |

## Ship-Entscheidung

**Explizite Antwort: BEDINGTES GO. Der Kernblocker ist geschlossen; patches57-83 sind nach der folgenden kleinen Korrektur shipbar.**

Vor Deploy erforderlich:

1. Audit-Retry in `runImportCleanup` erst nach erfolgreicher Digest-Pruefung ausfuehren.
2. Nach Retry den Kandidatenzustand fuer Delete und Ergebniszaehler neu lesen; `auditPendingCandidates` im Ergebnis aus den tatsaechlich verbleibenden Markertraegern bilden.
3. Neuer Test: Pending plus falscher/fehlender Digest bleibt vollstaendig unveraendert - kein Audit, kein Clear, kein Delete.
4. Finales Gate auf der korrigierten Endkette und Pg-Pin erneut gruen.

Danach kann das Verdikt ohne weiteren Architekturreview auf **GO** angehoben werden, sofern der Diff eng auf Reihenfolge, Nachlese und Tests begrenzt bleibt.

## Deploy-Bedingungen nach Gruen

- **Stop-then-start und genau eine Instanz**, kein Mischbetrieb alter/neuer Servicevertraege.
- **`SLIDES`-Flag unset** vor Start nachweisen.
- **Finales Gate auf der wirklichen Endkette**; `419/3115` gilt fuer 57-83 und ist hier nur uebernommene Evidence.
- **Pg-Nachweis auf isolierter Wegwerf-Test-DB:** bestehende 11/11 plus die finale Reihenfolge-/Drift-Sicherung, soweit repo-relevant.
- **Kein destruktiver Pg-Test-Override in Produktion.**
- **Gezielte Fehler-Smokes vor Deploy:** Pending + falscher Digest (keine Mutation); Pending + gueltiger Digest + Audit down (Marker/Kandidat bleiben); Audit wieder da (genau ein Beleg, Marker weg, naechster Cleanup entfernt); Crash nach Status-CAS; Crash nach Audit vor Clear; Recovery-Auditfehler mit `recoveredBy`; paralleler Retry.
- **Bestehende Smokes nach Start:** Health/Version; Import Explore/Group/Apply; Accept/Reject/Info/Dublette; Reviewer/Wann/Aktion; Queue-DTO ohne Interna; D-CLEAN Preview/Confirm/Drift; Review-vs.-Cleanup; A-Teilpersistenz plus B-Re-Sync; Stepper; aiCheck; vertraulicher Ask-Prefill ohne Netzaufruf.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch im Arbeitsrepo angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 20:35:39 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): b43de8a1cc7f356bb762b2ac8b1b9b5a3a899badb187dda70bf43b9ee7813656
