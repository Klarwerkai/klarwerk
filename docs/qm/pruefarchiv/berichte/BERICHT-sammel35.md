# BERICHT sammel35 - Finaler Recheck 7 Ship 8

## Kurzurteil

**GESAMTVERDIKT: ROT - NO-GO fuer Ship 8 in der vorliegenden Kette patches57-82.**

Patch82 schliesst die beiden unmittelbar in sammel34 beanstandeten Implementierungsfenster im normalen Review-/Recovery-Ablauf weitgehend sauber: Endstatus, Reviewer, Aktion und `auditPending` werden in einem einzigen `resolveClaim`-CAS persistiert; der Claim traegt Reviewer und Aktion; `clearAuditPending` ist an die exakte Event-ID gebunden. Die neuen statischen und PostgreSQL-nahen Tests adressieren diese Mechanik substanziell.

Es bleibt jedoch ein anderer Loeschpfad offen, der dieselbe Garantie bricht: Der bestaetigte Admin-Import-Cleanup loescht auch terminale Kandidaten mit `auditPending`. Schlaegt `recordOnce` nach dem Status-CAS fehl und wird vor dem naechsten Queue-Load ein Cleanup ausgefuehrt, verschwinden Kandidat, Marker und alle Rekonstruktionsdaten, obwohl der Aktionsbeleg noch nicht existiert. Damit ist die Aussage "bei Fehler oder Crash bleibt die Markierung automatisch fuer den Retry stehen" noch nicht end-to-end wahr.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel35.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches82/0001-fix-server-WP-SHIP8-CLOSE-7-bens-zwei-sammel34-Kante.patch`
- Patch-SHA-256: `638e0933a3086d3ae12b67cff1f8588ca4345937e09085c0089bf37db4410c81`
- Patch-Statistik: 10 Dateien, +578/-67; keine neue Datei.
- Methode: Patch82 mit `git apply --check` gegen den temporaer materialisierten Stand patches57-81 geprueft und nur in einer separaten Temp-Kopie zur statischen Analyse angewandt. Das Arbeitsrepo blieb unangetastet.
- Kein Bau und kein Testlauf gemaess Auftrag. `419 Testdateien / 3111 Tests gruen` sowie PostgreSQL 16.13 `10/10` sind uebernommene Evidence, nicht von Ben nachgerechnet.

## Findings

### [ROT-1] Cleanup kann den einzigen Retry-Marker vor dem Aktionsbeleg loeschen

**Beleg:** Patch82 setzt `auditPending` korrekt im Endstatus-CAS (`services/library-analytics/src/service.ts:520-551`). Bei fehlgeschlagenem `recordOnce` bleibt die Markierung am terminalen Kandidaten stehen (`service.ts:639-669`) und wird normalerweise durch `retryPendingReviewAudits` nachgezogen (`service.ts:678-705`).

Der Admin-Cleanup behandelt diese Markierung jedoch nicht als Loeschsperre:

1. `cleanupTargets` nimmt ausnahmslos alle Kandidaten-IDs und nur deren Status in den Bestaetigungs-Snapshot auf (`service.ts:240-255`). `auditPending` ist weder Teil des Digests noch eine Schutzbedingung.
2. `runImportCleanup` schuetzt ausschliesslich `in_bearbeitung`; ein terminaler Kandidat mit `status="angenommen"` und `auditPending` wird als normaler Loeschversuch an `removeByIds` gegeben (`service.ts:376-397`).
3. Der Pg-Adapter loescht allein nach `id + status` (`services/library-analytics/src/repo-pg.ts:286-299`); der InMemory-Spiegel tut dasselbe (`repo.ts:285-295`). Beide ignorieren `auditPending`.
4. Es existiert kein Test fuer "Aktionsaudit fehlgeschlagen -> Kandidat pending -> Cleanup vor Queue-Retry"; die neuen CLOSE-7-Tests pruefen nur Status-CAS, direkten Retry und Crash nach Audit vor Clear.

Konkreter Fehlerablauf:

1. `resolveClaim` committet `angenommen` plus `reviewed*` plus `auditPending`.
2. `recordOnce` wirft oder der Prozess stirbt davor.
3. Ein Admin fuehrt Import-Cleanup mit einer aktuellen Vorschau aus.
4. `removeByIds` loescht den terminalen Kandidaten samt Marker.
5. Der naechste Queue-Load findet weder Kandidat noch Marker; der Aktionsbeleg fehlt dauerhaft.

**Impact:** Die in sammel34 geforderte Outbox-Garantie gilt nicht ueber alle bestehenden Loeschpfade. Es kann weiterhin eine vollzogene Review-Aktion ohne `import.candidate-<action>`-Beleg entstehen. Der Pfad ist admin-ausgeloest und damit enger als ein normaler Nutzerpfad, verletzt aber den ausdruecklichen Ship-8-Belegvertrag.

**Erforderliche Korrektur:** Kandidaten mit `auditPending` muessen fail-closed vom Cleanup ausgeschlossen werden. Die Schutzbedingung muss im atomaren Delete selbst liegen, nicht nur in einem Vorab-Read:

- Pg: `removeByIds` nur bei passendem Status **und fehlendem `auditPending`**.
- InMemory: dieselbe Bedingung synchron spiegeln.
- Cleanup-Bilanz muss einen nicht entfernten Pending-Kandidaten ehrlich als "Aktionsbeleg ausstehend" ausweisen.
- Optional vor dem Cleanup Retry versuchen; ein fehlgeschlagener Retry darf die Loeschsperre aber niemals aufheben.
- Pflichttest: Status-CAS mit Pending, Auditfehler, bestaetigter Cleanup; Kandidat/Marker muessen ueberleben. Nach erfolgreichem Retry darf ein neuer Cleanup ihn entfernen.

### [GELB-1] Recovery-Metadaten gehen verloren, wenn erst der Retry den Beleg schreibt

Die Recovery bewahrt den menschlichen Reviewer korrekt und schreibt bei sofort erfolgreichem Audit `recovered:true`, `recoveredBy:"system"` sowie fuer Altclaims `reviewerUnknown:true` (`services/library-analytics/src/service.ts:775-811`). Die persistierte Pending-Struktur traegt aber nur `eventId`, `action` und `actor` (`services/library-analytics/src/types.ts:93-98`).

Scheitert das Recovery-Audit, erzeugt der spaetere generische Retry den Beleg nur mit `{ duplicate, koId, retried:true }` (`service.ts:684-697`). `recovered`, `recoveredBy` und `reviewerUnknown` sind dann nicht rekonstruierbar. Der Kandidat behaelt zwar den richtigen `reviewedBy`, aber der geforderte ehrliche Ausweis der technischen Recovery fehlt gerade im Fehler-/Retry-Fall.

**Fix-Richtung:** `auditPending` sollte den fuer den Beleg erforderlichen, begrenzten Payload bzw. mindestens `recovered/recoveredBy/reviewerUnknown` mitpersistieren; der Retry muss diesen Payload unveraendert in `recordOnce` uebernehmen. Ein Test muss das Recovery-Audit gezielt werfen lassen und den spaeteren Beleg einschliesslich Recovery-Kennzeichnung pruefen.

Das ist fuer sich allein kein Datenverlust-Blocker, aber eine noch offene Ehrlichkeitskante im explizit verlangten Recovery-Vertrag.

### [GELB-2] Neue Claim-Identitaet liegt im rohen Kandidatenobjekt auf der `ko.read`-Route

`claimedBy` und `claimedAction` sind korrekt fuer die Recovery notwendig (`services/library-analytics/src/types.ts:78-84`). Die GET-Route gibt jedoch die Serviceobjekte ohne Response-DTO/Schema direkt aus und ist nur mit `ko.read` geschuetzt (`services/app/src/routes/library-routes.ts:135-148`). Damit koennen waehrend eines laufenden Claims neben den bereits vorhandenen Lease-Feldern nun auch Reviewer-ID und Aktion auf dem Wire erscheinen, obwohl die Web-Typen diese Felder nicht deklarieren (`apps/web/src/api/types.ts:485-500`).

Das ist kein neuer Endpoint und keine Privilegieneskalation, aber eine kleine neue Identitaets-Egressflaeche. Vor Ship sollte die Entscheidung bewusst sein: entweder als benoetigte Queue-Transparenz dokumentieren oder interne Lease-Felder ueber ein explizites Response-DTO entfernen. `auditPending` sollte im Client idealerweise nur als boolescher Schwebezustand erscheinen; Event-ID und Actor werden fuer die UI nicht benoetigt.

## Gruene Punkte

### Endstatus und Pending-Marker in einem CAS: GRUEN

- Alle normalen terminalen Aufloesungen (`reject`, `info`, Dubletten-Accept, KO-Accept) verwenden denselben `reviewedStamp` mit `reviewedBy`, `reviewedAt`, `reviewedAction` und `auditPending` (`service.ts:520-551`).
- Der Fehlerpfad mit bereits erzeugtem KO vollendet ebenfalls mit diesem Stamp (`service.ts:579-591`).
- Die Recovery-Vollendung setzt die Markierung im selben `resolveClaim` (`service.ts:783-791`).
- Rueckgaben auf `neu` sind bewusst keine fachliche Vollendung und erhalten daher keinen Aktionsbeleg.

### Pg-CAS und bedingtes Clear: GRUEN

- `resolveClaim` ist ein einzelnes bedingtes PostgreSQL-`UPDATE ... WHERE status='in_bearbeitung' AND opId=$2 RETURNING` und raeumt alle vier Claim-Felder im selben Statement (`services/library-analytics/src/repo-pg.ts:209-243`).
- `clearAuditPending` entfernt nur die exakt passende Event-ID in einem Statement und gibt bei fremder ID/fehlendem Kandidaten `false` zurueck (`repo-pg.ts:245-253`).
- Crash nach erfolgreichem `recordOnce`, aber vor Clear, ist harmlos: der Retry trifft `recordOnce=false` und kann danach die identische Markierung raeumen. Der neue Test bildet diese Kante sinnvoll ab (`tests/app/review-claim-recovery.test.ts:809-839`).

### Reviewer und Aktion ueber Claim/Recovery: GRUEN mit GELB-1

- Der produktive Claim-Aufruf persistiert `actor` und `action` gemeinsam mit `opId/claimedAt` (`service.ts:489-498`).
- Pg und InMemory spiegeln diese Felder im Claim-CAS; `resolveClaim` entfernt sie gemeinsam (`repo-pg.ts:185-243`; `repo.ts:191-249`).
- Recovery verwendet fuer neue Claims den echten Reviewer, persistiert `reviewedAction="accept"` und kennzeichnet Altclaims ohne Reviewer ehrlich als unbekannt (`service.ts:763-829`).
- Bei Rueckgabe eines Claims auf `neu` raeumt derselbe `resolveClaim` alle Claim-Felder aus (`service.ts:830-832`).
- Die Tests pruefen echten Reviewer, Action, Event-ID und Altclaim-Fallback substanziell (`tests/app/review-claim-recovery.test.ts:842-969`). Nur die Audit-Retry-Metadatenkante aus GELB-1 fehlt.

### ReviewedAction: GRUEN

`reviewedAction` ist nun in Servertyp, Claim-Patch, Pg-/InMemory-Repo und Web-API-Typ tatsaechlich vorhanden. Der Reject-Test beweist, dass das Feld persistiert und nicht nur aus dem Status abgeleitet wird (`tests/app/review-claim-recovery.test.ts:972-990`).

### Additivitaet und Betriebsmodus: GRUEN unter Stop-then-start

Die neuen Claim-/Review-Felder liegen im bestehenden JSONB-Dokument; es gibt keine destruktive Tabellenmigration. Die neue Repo-Mutation `clearAuditPending` ist in der Dev-Persist-Liste eingetragen (`services/app/src/dev-persist.ts:68-80`). Wegen geaenderter Repo-/Service-Vertraege bleibt stop-then-start mit genau einer Instanz die richtige Deploy-Form; Mischbetrieb ist nicht freigegeben.

### Regressionen 57-81: GRUEN in statischer Pruefung

`recordOnce`/Event-Unique, Re-Sync-Nachzug, stabiler Kandidatenanker, Create-Belege, Cleanup-Status-CAS, F2/F3 und der Pg-Testguard wurden durch Patch82 nicht zurueckgebaut. Die neue Cleanup-Luecke aus ROT-1 ist kein Rueckbau dieser Mechaniken, sondern die bislang fehlende Kopplung zwischen Pending-Outbox und bestehendem Kandidaten-Delete.

### Verbleibende Folgehaertung aus sammel34

`eventId` bleibt vom Audit-Hash ausgeschlossen. Das ist weiterhin kein normaler App-Bypass und kein zusaetzlicher Ship-Blocker zu ROT-1, sollte aber nach Ship rueckwaertskompatibel gehaertet werden. Ebenso bleibt die allgemeine Pg-Audit-Sequenzierung verschiedener paralleler Events eine separate Altbestandskante.

## Verdikttabelle

| Pruefpunkt | Verdikt | Befund |
|---|---|---|
| `resolveClaim` als ein Pg-CAS | **GRUEN** | Endstatus, Wer/Wann/Aktion und Pending reisen in einem Statement; Claim-Felder werden gemeinsam entfernt. |
| Abdeckung normaler Aufloesungen | **GRUEN** | Reject, Info, Dublette, normaler Accept und Accept-Fehlerabschluss nutzen den gemeinsamen Stamp. |
| Recovery-Vollendung | **GRUEN mit GELB** | Reviewer/Action bleiben erhalten; beim spaeteren Audit-Retry geht die Recovery-Kennzeichnung verloren. |
| `clearAuditPending` | **GRUEN** | Exakte Event-ID, bedingtes Clear; Crash nach Audit vor Clear ist exactly-once heilbar. |
| Cleanup gegen Pending-Outbox | **ROT** | Terminaler Pending-Kandidat kann vor dem Retry nach `id+status` geloescht werden; Beleg bleibt dauerhaft aus. |
| Reviewer-Erhalt | **GRUEN** | Neue Claims bewahren den echten Reviewer; Altclaim-Fallback ist gekennzeichnet. |
| `reviewedAction` | **GRUEN** | Tatsaechlich persistiert und getestet. |
| API-/Egressflaeche | **GELB** | Rohes Kandidatenobjekt kann neue Claim-Identitaetsfelder an alle `ko.read`-Nutzer ausgeben. |
| Additivitaet / stop-then-start | **GRUEN unter Auflage** | JSONB-additiv; kein Mischbetrieb, eine Instanz. |
| Regressionen 57-81 | **GRUEN statisch** | Keine Ruecknahme der bisherigen Gruenpunkte erkannt. |

## Ship-Entscheidung

**Explizite Antwort: NO-GO. Das Ship-8-Paket patches57-82 ist noch nicht shipbar.**

Vor Ship ist genau ein harter Codeblocker zu schliessen: Der Kandidaten-Cleanup muss `auditPending` atomar als Loeschsperre respektieren und den Pending-Fall ehrlich bilanzieren. Ohne diese Bedingung kann der letzte Aktionsbeleg trotz korrekt gesetzter Outbox-Markierung dauerhaft verloren gehen.

Die Recovery-Payload-Treue aus GELB-1 sollte im selben kleinen Slice mitgeschlossen werden, weil die notwendige Information direkt an der Pending-Struktur liegt. Die API-Feldreduktion aus GELB-2 kann bei dokumentierter bewusster Akzeptanz nachgezogen werden; sie ist kein eigener NO-GO-Grund.

Nach der Korrektur gelten folgende Deploy-Bedingungen:

- **Stop-then-start, genau eine Instanz**, kein Mischbetrieb alter/neuer Servicevertraege.
- **`SLIDES`-Flag unset** vor Start nachweisen.
- **Finales Gate auf der wirklichen Endkette**; `419/3111` gilt fuer 57-82 und ist hier nur uebernommene Evidence.
- **Pg-Nachweis auf isolierter Wegwerf-Test-DB:** bestehende 10/10 plus Pending-vs.-Cleanup-Test auf echtem Pg (`DELETE` muss 0 Zeilen treffen, solange Pending vorhanden ist; nach Retry muss Cleanup moeglich sein).
- **Gezielte Fehler-Smokes:** Crash direkt nach Status-CAS; Auditfehler; Cleanup-Versuch waehrend Pending; Retry und danach Cleanup; Crash nach Audit vor Clear; Recovery-Auditfehler mit erhaltener `recoveredBy`-/Altclaim-Kennzeichnung; paralleler Retry.
- **Bestehende Smokes unveraendert:** Health/Version; Import Explore/Group/Apply; Accept/Reject/Info und Dublette; Reviewer/Wann/Aktion; A-Teilpersistenz plus B-Re-Sync; Review-vs.-Cleanup; Stepper; aiCheck; vertraulicher Ask-Prefill ohne Netzaufruf.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch im Arbeitsrepo angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 19:56:05 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): f5a2d9c6708d7bb8eb8e2b452d6bef7367f10f0bcf296ed10c958116cd09e22b
