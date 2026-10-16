# BERICHT sammel33 - Finaler Recheck 5 Ship 8

## Kurzurteil

**GESAMTVERDIKT: ROT - NO-GO fuer Ship 8 in der vorliegenden Kette patches57-80.**

Patch80 repariert den in sammel32 beanstandeten sequenziellen Teilpersistenzfall: Fehlende Version-1-Snapshots und fehlende `ko.created`-Eintraege werden vor den benannten Adoptions-/Recovery-Abschluessen nachgezogen; bei komplett ausgefallenem Auditdienst bleibt der Claim fail-closed. Die neuen Bestands- und Fehlerpfadtests sind wesentlich aussagekraeftiger als in Patch79.

Die behauptete Gesamtgarantie "kein angenommen ohne vollstaendige Belege" gilt dennoch nicht. Drei konkrete Kanten bleiben:

1. `ko.created` wird per Query-then-Write nachgezogen und ist unter Konkurrenz nicht idempotent; doppelte Create-Audits sind moeglich.
2. Der bestehende externalId-Re-Sync-Zweig kann das teilpersistierte KO eines anderen Kandidaten uebernehmen und als angenommen abschliessen, ohne `ensureCreatedSideEffects` aufzurufen.
3. Das abschliessende `import.candidate-accept`-Audit darf dauerhaft fehlen; der Kandidat speichert weder `acceptedBy` noch `acceptedAt`, sodass Wer/Wann der Annahme dann nicht dauerhaft belegt ist. Anders als beim Cleanup meldet die API diesen Auditverlust nicht.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel33.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches80/0001-fix-server-WP-SHIP8-CLOSE-5-bens-sammel32-Blocker-ke.patch`
- Patch-SHA-256: `cdf3f0ce327cbc219d1f71bc16533bd810e034baaacb99ea654213cbe694419b`
- Patch-Statistik: **4 Dateien, +431/-52**; davon eine neue Pg-Integrationsdatei mit 159 Zeilen.
- Methode: Patch80 mit `git apply --check` gegen einen temporaer materialisierten Stand patches57-79 geprueft und nur dort zur statischen Analyse angewandt. Das Arbeitsrepo blieb unangetastet.
- Kein Bau und kein Testlauf gemaess Auftrag. `418 Testdateien / 3092 Tests gruen` sowie PostgreSQL 16.13 `3/3` sind uebernommene Evidence, nicht von Ben nachgerechnet.

## Findings

### [ROT-1] `ko.created`-Nachzug ist nicht konkurrenz-idempotent

**Beleg:** `ensureCreatedSideEffects` liest zuerst alle passenden Audit-Eintraege und schreibt danach bei leerem Ergebnis (`services/knowledge-object/src/service.ts:394-398`). Es gibt weder einen atomaren `recordOnce`-Vertrag noch einen Unique-/Idempotenzschluessel fuer `(action='ko.created', target=ko.id)`. Der Codekommentar bestaetigt selbst, dass ein Race doppelte Audit-Eintraege erzeugen kann (`service.ts:374-375`).

**Konkretes Interleaving:**

1. Recovery A und ein spaet fortsetzender Lauf B finden dasselbe gestempelte KO.
2. A und B lesen jeweils `ko.created = []`.
3. A schreibt den ersten Audit-Eintrag.
4. B ruft danach `AuditService.record` auf, sieht die inzwischen hoehere Audit-Sequenz und schreibt einen zweiten gueltigen `ko.created`-Eintrag.

Die Audit-Tabelle verhindert das nicht: Sie hat nur `seq` als Primary Key, keine Eindeutigkeit fuer Aktion und Ziel (`services/audit/src/repo-pg.ts:7-17`). Auch bei Einzelinstanz ist dieses Async-Interleaving moeglich; mehrere Prozesse sind dafuer nicht erforderlich.

**Impact:** Der Snapshot-Nachzug ist durch `(ko_id, version)` wirklich idempotent, der Audit-Nachzug dagegen nicht. Damit ist die geforderte Aussage "`ko.created` nicht doppelt" falsch und die Auditkette kann dieselbe Erzeugung zweimal behaupten.

**Erforderliche Korrektur:** Ein atomarer, persistenzgestuetzter `recordOnce`-/Idempotenzvertrag fuer diesen Beleg, etwa mit stabiler Event-ID `ko.created:<koId>` und Unique-Garantie. Query-then-Write ohne Arbiter reicht nicht. Pflichttest: Zwei Nachzuege passieren eine Barriere nach leerem Read und schreiben parallel; Endbestand enthaelt exakt einen `ko.created`-Eintrag.

### [ROT-2] ExternalId-Re-Sync ist eine vergessene Vollendungsstelle

**Beleg:** `acceptToKo` zieht Belege bei Vorab-Adoption ueber denselben `candidateId` nach (`services/library-analytics/src/service.ts:722-730`) und ebenso nach Create-Kollision (`service.ts:821-841`). Dazwischen existiert jedoch der separate Re-Sync-Zweig: Ein KO mit passendem `(provider, externalId)` wird gefunden, optional revidiert und direkt zurueckgegeben (`service.ts:740-788`). Dieser Zweig ruft `ensureCreatedSideEffects(existing)` nicht auf.

**Reproduzierbares Interleaving:**

1. Kandidat A, Quellversion 1, persistiert sein KO; Snapshot oder Audit scheitert. Sein Claim bleibt `in_bearbeitung`.
2. Eine neue Quellversion 2 darf als eigener Kandidat B in die Queue, weil der offene Idempotenzschluessel die `sourceVersion` enthaelt.
3. B findet As KO ueber provider/externalId im Re-Sync-Zweig.
4. B kann dieses KO revidieren bzw. direkt uebernehmen und seinen Kandidaten auf `angenommen` setzen, ohne As fehlenden Version-1-Snapshot oder `ko.created`-Beleg nachzuziehen.

Damit gibt es trotz Patch80 einen angenommenen Kandidaten, der auf ein unvollstaendig belegtes KO zeigt. Eine spaetere Recovery von A kann das irgendwann heilen, ist aber lazy und nicht Voraussetzung fuer Bs Erfolg. Wird vor dem Nachzug revidiert, rekonstruiert `ensureCreatedSideEffects` den angeblichen v1-Snapshot spaeter sogar aus dem aktuellen KO-Stand und setzt nur `version: 1` (`services/knowledge-object/src/service.ts:380-391`); das ist als "nachgezogen" markiert, aber keine historisch genaue Version 1.

**Erforderliche Korrektur:** Vor jeder Rueckgabe des `existing && externalId`-Zweigs muss bei einem KO mit `importCandidateId` ebenfalls `ensureCreatedSideEffects(existing)` erfolgreich sein. Der Nachzug muss vor Upgrade/Revision liegen, damit v1 aus dem tatsaechlichen Erstanlagezustand entsteht. Pflichttest: A bleibt nach Teilpersistenz offen, B mit hoeherer Source-Version akzeptiert; B darf erst nach vollstaendig belegtem v1/`ko.created` abschliessen.

### [ROT-3] Abschluss-Audit kann dauerhaft fehlen; Wer/Wann ist dann verloren

**Beleg:** Nach dem persistierten Kandidatenstatus wird jeder Fehler beim `import.candidate-${action}`-Audit geschluckt; es bleibt nur ein stderr-Log, die Methode liefert Erfolg (`services/library-analytics/src/service.ts:600-621`). Der Test verlangt ausdruecklich null `import.candidate-accept`-Eintraege bei erfolgreicher Antwort (`tests/app/review-claim-recovery.test.ts:474-504`).

Dieser Verlust ist nicht nur kosmetisch:

- `ImportCandidate` speichert `status`, `koId`, `createdAt`, Claim-opId und `claimedAt`, aber kein `acceptedBy` und kein `acceptedAt` (`services/library-analytics/src/types.ts:59-78`).
- Das stderr-Log nennt Kandidaten-ID, Aktion und Fehlerklasse, aber nicht den handelnden Nutzer; es ist kein Bestandteil der unveraenderlichen Auditkette.
- Es gibt keinen Outbox-, Pending-Audit- oder Recovery-Pfad fuer den fehlenden Aktionsbeleg.

Damit kann ein Kandidat dauerhaft als angenommen gelten, ohne dass im Produktbestand belegt ist, wer ihn wann angenommen hat. Beim Cleanup wird ein Auditfehler wenigstens als `auditFailed: true` in der Antwort ausgewiesen; der Review-Accept besitzt kein entsprechendes Signal.

**Impact:** Die Antwort ist zwar ehrlich hinsichtlich des vollzogenen Status, aber nicht hinsichtlich der Auditierbarkeit. Fuer ein Governance-Produkt ist ein dauerhaft unbelegter Review-Entscheid kein vollstaendiger Abschluss.

**Erforderliche Korrektur:** Entweder Kandidatenstatus und Aktionsaudit atomar persistieren, oder einen dauerhaften `auditPending`-/Outbox-Eintrag im selben Statuswrite speichern und bis zur erfolgreichen Auditaufzeichnung wiederholen. Mindestens muessen `acceptedBy` und `acceptedAt` im Kandidatenstatus unverlierbar sein; ein bloesses Prozesslog reicht nicht.

### [GELB] Neue Pg-Suite kann bei falsch gesetzter URL destruktiv gegen eine bestehende DB laufen

Die gespeicherte Suite prueft Upgrade, Re-Run, `23505`, Adoption und Trash-Anker substanziell (`services/knowledge-object/src/repo-pg.integration.test.ts:96-158`). Sie akzeptiert jedoch `KLARWERK_PG_URL` ungeprueft und fuehrt anschliessend `DROP TABLE IF EXISTS kos CASCADE` aus (`test.ts:51-62`, `92-94`). Es gibt keine Test-DB-Namenspruefung und keinen expliziten Destruktiv-Opt-in.

Das ist kein Runtime-Produktpfad, aber eine gefaehrliche Testkante. Vor Aufnahme sollte die Variable eindeutig als Test-URL benannt werden und die Suite eine harte Testdatenbank-/Schema-Sicherung verlangen. Die im Auftrag genannte lokale Pg-Evidence ist inhaltlich plausibel; ich habe sie regelkonform nicht erneut ausgefuehrt.

## Gruene Punkte

### Sequenzieller Snapshot-/Audit-Nachzug: GRUEN

- Fehlender v1-Snapshot wird vor Abschluss erkannt und mit sichtbarer Note `erstellt (nachgezogen)` angelegt (`services/knowledge-object/src/service.ts:379-393`).
- Pg `ON CONFLICT (ko_id, version) DO NOTHING` und InMemory-Map verhindern doppelte Version-1-Snapshots.
- Fehlender `ko.created`-Eintrag wird im nicht-konkurrierenden Fall nachgezogen.
- Wirft eine der Belegflaechen, propagiert `ensureCreatedSideEffects` den Fehler; die aufrufenden Adoptionen vollenden dann nicht.

### Fail-closed bei komplettem Audit-Ausfall: GRUEN

Der gemeinsame Auditdienst ist nun wie in Produktion an KoService und LibraryService verdrahtet. Solange er komplett ausfaellt, bleibt der Kandidat `in_bearbeitung`; nach Heilung und Lease-Ablauf zieht Recovery die harten Belege nach und vollendet erst danach (`tests/app/review-claim-recovery.test.ts:438-472`).

### Benannte Vollendungsstellen: GRUEN mit der ROT-2-Ausnahme

- Vorab-Adoption am Kandidatenanker: gesichert.
- Kollisions-Adoption nach Create-Fehler: gesichert.
- Aeusserer Fehlerpfad: Nachzug vor direkter Vollendung; Fehler bleibt fail-closed.
- Recovery: Nachzug je Kandidat; Fehler kippt nicht den ganzen Queue-Load.
- **Ausnahme:** provider/externalId-Re-Sync eines anderen Kandidaten, siehe ROT-2.

### Tests: weitgehend nicht-vakuoes

- Snapshot- und Auditvarianten pruefen den echten Versions-/Auditbestand.
- KoService und LibraryService teilen denselben Auditdienst.
- Der Vollausfall heilt und Recovery prueft anschliessend die Belege.
- Der doppelte Anker-Lookup-Wurf wird mit Zaehler `2` gepinnt; Claim bleibt sichtbar `in_bearbeitung` (`tests/app/review-claim-recovery.test.ts:506-530`).
- Es fehlen Konkurrenztest fuer Audit-Idempotenz, Re-Sync-Teilpersistenztest und dauerhafter Abschluss-Audit-Recoverytest.

### Regressionen 57-79: GRUEN in statischer Pruefung

Patch80 aendert weder den stabilen Kandidaten-Unique-Anker noch Claim-CAS, Cleanup-/Trash-Vertrag, ROT-2-Idempotenzraum, F2-Stepper, F3-aiCheck/Eviction oder die Egress-/Vertraulichkeitsgrenzen. Die sammel32-Gruenpunkte bleiben statisch erhalten.

## Verdikttabelle

| Pruefpunkt | Verdikt | Befund |
|---|---|---|
| Sequenzieller v1-Snapshot-Nachzug | **GRUEN** | Fehlender Snapshot wird sichtbar und PK-idempotent nachgezogen. |
| Sequenzieller `ko.created`-Nachzug | **GRUEN** | Fehlender Eintrag wird im Einzelablauf ergaenzt. |
| Konkurrenz-Idempotenz `ko.created` | **ROT** | Query-then-Write erlaubt doppelte Create-Audits. |
| Alle Vollendungsstellen | **ROT** | provider/externalId-Re-Sync umgeht den Nachzieh-Pfad. |
| Fail-closed bei Anker-/Belegfehler | **GRUEN** | Live-Accept und Recovery schliessen nicht im Ungewissen ab. |
| Abschluss-Audit-Semantik | **ROT** | Erfolg ist moeglich, obwohl Wer/Wann der Annahme dauerhaft unbelegt bleiben. |
| Drei geforderte Tests | **GRUEN fuer ihre Szenarien** | Bestandsassertions, gemeinsamer Auditdienst und Zweifach-Lookup sind echt; die drei neuen Restkanten fehlen. |
| Gespeicherte Pg-Suite | **GRUEN inhaltlich / GELB Betriebssicherheit** | Gute SQL-Evidence, aber ungesicherter `DROP TABLE ... CASCADE` bei Env-Override. |
| Regressionen 57-79 | **GRUEN statisch** | Keine Ruecknahme der vorherigen Gruenpunkte erkannt. |

## Ship-Entscheidung

**Explizite Antwort: NO-GO. Das Ship-8-Paket patches57-80 ist noch nicht shipbar.**

Vor Ship sind diese drei Codegarantien erforderlich:

1. `ko.created` atomar/idempotent genau einmal nachziehen, auch bei paralleler Recovery/Adoption.
2. Den provider/externalId-Re-Sync vor jeder Revision/Rueckgabe durch den Beleg-Nachzug fuehren.
3. Den Review-Aktionsbeleg dauerhaft sichern: atomar mit Status oder per persistenter Outbox/Pending-Markierung; Wer/Wann darf nicht nur im fluechtigen Log stehen.

Die Pg-Suite sollte ausserdem nur gegen eine hart erkannte Testdatenbank bzw. ein isoliertes Testschema loeschen duerfen.

Nach Schliessung bleiben die Deploy-Bedingungen:

- **stop-then-start und genau eine Instanz**; kein Mischbetrieb mit einem alten Writer.
- **`SLIDES`-Flag unset** vor Start nachweisen.
- **Finales Gate auf der wirklichen Endkette**; 418/3092 gilt nur fuer 57-80 und ist hier uebernommene Evidence.
- **Pg-Nachweis auf isolierter Test-DB:** Upgrade, idempotenter Re-Run, Unique-Kollision/Adoption und Trash-Anker.
- **Gezielte Integrations-Smokes vor Deploy:** paralleler Beleg-Nachzug; A-Teilpersistenz plus B-Re-Sync; vollstaendiger Audit-Ausfall und Heilung; fehlgeschlagenes Abschluss-Audit mit durablem Nachzug; Alt-Lauf-Fortsetzung; D-CLEAN-vs.-Claim.
- **Smoke nach Start:** Health/Version; Import Explore/Group/Apply; Accept samt Wer/Wann-Beleg; Review-vs.-Cleanup; Stepper Erfolg/Fehler/Snapshot-Expired; aiCheck Overflow/Retry; vertraulicher Ask-Prefill ohne Netzaufruf.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch im Arbeitsrepo angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 16:54:01 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): 021c8eb5c3a0a6f5ec57e6b64d8af60096c6c86a945ca15942d65378536eb9e1
