# SAMMEL29 - Finaler Recheck Ship 8

**Erstellt:** 2026-07-22 09:54:05 CEST  
**Pruefer:** ben / Codex  
**Baseline:** `2727b7e84d4a42056f0641174ac693121200ebbb` (`main`, Ship 7)  
**Kettenannahme:** Patches 57-73 davor, danach Patches 74-76  
**Methode:** Statische Read-only-Pruefung. Die Patches 57-76 wurden in einem separaten `git archive`-Snapshot jeweils mit `git apply --check` geprueft und dort nur fuer die Analyse materialisiert. Das Arbeits-Repo blieb unveraendert. Kein Bau und kein Testlauf; die angegebene Evidence `416 Testdateien / 3067 Tests` wurde nicht nachgerechnet.

## Gesamtverdikt

**ROT / NO-GO. Das Ship-8-Paket 57-76 ist in der vorgelegten Fassung noch nicht shipbar.**

Patch 76 schliesst die beiden sammel28-Punkte funktional. Patch 75 schliesst den Generation-Reset und macht Schritt 5 waehrend eines laufenden Apply korrekt aktiv, setzt den Erledigt-Haken aber auch nach einem fehlgeschlagenen Apply. Patch 74 schliesst den produktiven Reasoner-Fehlerkanal, laesst jedoch zwei bereits beschriebene Race-Kanten offen: Ein bereits gestarteter, aber noch nicht persistierter Accept kann weiter vom Cleanup geloescht werden; die Queue-Eviction faellt bei fehlgeschlagener/asynchron ueberholter Versionsaufnahme explizit auf einen ungebundenen Write zurueck.

Damit sind die verlangten Vollstaendigkeits- und Ehrlichkeitsgarantien noch nicht erreicht. Die drei Restkorrekturen sind schmal, aber keine reine Deploy-Auflage kann sie ersetzen.

## Kritische Restbefunde

### F1 - ROT - Cleanup kann einen bereits laufenden Accept weiter verlieren

Patch 74 macht `removeByIds` selbst statusbedingt: Postgres loescht mit einem einzelnen `DELETE ... USING unnest(...) ... AND c.data->>'status' = erwartet.status RETURNING c.id`; InMemory prueft Status und loescht ohne `await` (`services/library-analytics/src/repo-pg.ts:197-205`, `services/library-analytics/src/repo.ts:127-137`). Das schliesst den Fall, in dem ein Accept **vollstaendig** zwischen Re-Read und Delete abgeschlossen wird.

Der zweite, bereits in sammel26 benannte Interleaving-Pfad bleibt aber offen:

1. `reviewImportCandidate` liest den Kandidaten mit Status `neu` (`services/library-analytics/src/service.ts:402-408`).
2. Es aendert den Status nur am lokalen Objekt und erzeugt gegebenenfalls zuerst das KO (`:415-425`).
3. Erst danach persistiert es den Kandidatenstatus (`:427-428`).
4. Startet der Accept vor dem Cleanup-Delete, wartet aber noch in `acceptToKo`, sieht das bedingte Delete in der Datenbank weiterhin `neu` und darf den Kandidaten loeschen.
5. `PgCandidateRepo.update` erzwingt keinen Rowcount (`services/library-analytics/src/repo-pg.ts:170-175`). Der Accept kann danach ein KO und Audit erzeugen, waehrend sein Queue-Eintrag verschwunden bleibt.

Der neue Gate-Test wartet den kompletten Accept innerhalb des zweiten `all()`-Hooks ab und ruft erst danach `removeByIds` auf (`tests/app/import-cleanup.test.ts:446-489`). Er prueft deshalb nicht das laufende Accept-Fenster. Der Query-Pin (`:395-443`) belegt die atomare Delete-Bedingung, aber keinen Claim am Beginn der Review-Aktion.

**Impact:** Queue-, Bilanz- und Audit-Wahrheit koennen auseinanderlaufen; ein angenommenes KO kann ohne zugehoerigen Review-Kandidaten zurueckbleiben.

**Erforderliche Korrektur:** Den Kandidaten zu Beginn von Accept/Reject/Info per atomarem Status-CAS claimen, oder Cleanup und Review ueber denselben storage-seitigen Lock/Claim serialisieren. `update` muss 0 Zeilen als Konflikt/NOT_FOUND behandeln. Der Test muss Accept in `acceptToKo` blockieren, waehrend Cleanup das bedingte Delete ausfuehrt, und beweisen, dass der Kandidat ueberlebt.

### F2 - ROT - Stepper markiert fehlgeschlagenen Apply als erledigt

`runApply` meldet korrekt `reach("applying")`, bevor die erste Apply-Anfrage beginnt (`apps/web/src/components/ImportGroups.tsx:234-245`). Bei einem normalen Transportfehler wird der Batch als `transportFailed` markiert und die Schleife abgebrochen (`:249-275`). Danach wird jedoch **immer** eine Bilanz gesetzt (`:285-287`). Der Bilanz-Effekt meldet fuer jedes nicht-null-Ergebnis `reach("applied")` (`:202-205`). Damit erhalten alle fuenf Schritte auch nach einem Fehler den Erledigt-Haken.

Der `SNAPSHOT_EXPIRED`-Pfad setzt Daten und Bilanz zurueck (`:264-270`), meldet dem Stepper aber keinen Ruecksprung. Wegen `maxStage` bleibt der zuvor gesetzte Zustand `applying` aktiv, obwohl nur noch "Neu gruppieren" angeboten wird.

Der Mounted-Test prueft nur haengendes Apply und anschliessenden Erfolg (`tests/app/import-stepper-mounted.test.tsx:198-223`). Ein abgelehnter Apply-Promise und `SNAPSHOT_EXPIRED` fehlen. Die Auftragsvorgabe "Haken erst nach erfolgreichem Apply; Fehlschlag ohne Haken" ist daher nicht erfuellt.

**Impact:** Der zentrale VIP2-Weg behauptet bei einem realen Fehler einen abgeschlossenen Import oder zeigt den falschen aktiven Schritt.

**Erforderliche Korrektur:** `applied` nur setzen, wenn der Lauf nach der definierten Bilanz ohne Transportfehler/Snapshot-Abbruch erfolgreich abgeschlossen ist. Fehler und Snapshot-Verfall muessen den Fortschritt der aktuellen Generation auf `grouping` beziehungsweise den fachlich korrekten Schritt zuruecksetzen. Mounted-Tests fuer rejected Apply und `SNAPSHOT_EXPIRED` sind Pflicht.

### F3 - GELB - Queue-Eviction ist nur best-effort versionsgebunden

Patch 74 legt fuer wartende Jobs eine `Promise<number | undefined>` in `queuedVersions` ab (`services/app/src/ai-check-worker.ts:133-137`, `:188-197`) und reicht den Wert bei Eviction an `resolveAiCheck` weiter (`:165-183`). Der positive Test wartet ausdruecklich, bis der asynchrone `get` abgeschlossen ist, und revidiert erst danach (`tests/app/ship8-close-aicheck.test.ts:173-198`). Dieser Ablauf ist korrekt.

Die harte Originalauflage war jedoch, die Zielversion **beim Enqueue im Jobobjekt** zu tragen. Der Patch liest sie erst nach dem Enqueue asynchron aus dem Repository. Bei jedem Lesefehler wird sie bewusst zu `undefined` (`ai-check-worker.ts:188-197`). `resolveAiCheck` interpretiert `undefined` als ungebundenen Altpfad (`services/knowledge-object/src/repo-pg.ts:207-218`). Eine Revision plus Queue-Overflow nach einem solchen Lesefehler kann deshalb weiterhin den neuen pending-Vermerk als `failed/queue-overflow` markieren. Auch ein DB-Read, den eine Revision zeitlich ueberholt, kann die neue statt der eingereihten Version erfassen.

Der Submit-Pfad hat die Version bereits im nachgelesenen `submitted.aiCheck.koVersion`, uebergibt an `enqueue` aber nur die ID (`services/app/src/routes/ko-routes.ts:193-197`). Der neue Test deckt weder Read-Fehler noch eine blockierte Versionsabfrage mit dazwischenliegender Revision ab.

**Impact:** Seltene, aber reale Verletzung der behaupteten harten Job-zu-Inhaltsversion-Bindung.

**Erforderliche Korrektur:** `enqueue` muss die bereits bekannte Zielversion als synchrones Jobfeld erhalten. Fehlt sie wider Erwarten, muss die Eviction fail-closed bleiben (kein unversionierter Status-Write), nicht auf Altverhalten zurueckfallen. Tests: `ko.get` wirft sowie blockierter Read + Revision vor Aufloesung.

## Patch 74 - sammel26 F1-F3

| Punkt | Verdikt | Bewertung |
|---|---|---|
| F1 Reasoner-Fehlervertrag | **GRUEN** | `judgeConflictOutcome`/`judgeDuplicateOutcome` unterscheiden Urteil, `model-error`, `model-timeout` und `no-model` (`services/reasoner/src/service.ts:958-1004`, `:1017-1049`). Der Runner beobachtet diese echten Outcomes und setzt `failed`, bevor `status().active` bewertet wird (`services/app/src/ai-check-worker.ts:340-405`). |
| F1 Testauflage | **GRUEN** | Echter `Reasoner` + echter `ModelProvider` + Fake-Client pruefen HTTP-Fehler, Timeout, unparsebaren Output und eine erfolgreiche Gegenprobe end-to-end bis zum gespeicherten aiCheck (`tests/app/ship8-close-aicheck.test.ts:35-124`). Ein eigener Netzwerkfehler-Test fehlt, faellt im Code aber durch denselben generischen Catch auf `model-error`. |
| F2 bedingtes Delete | **GRUEN fuer abgeschlossenen Accept** | Statusbedingtes Ein-Statement-Delete plus `RETURNING` und ehrliche Survivor-Bilanz sind korrekt (`repo-pg.ts:197-205`, `service.ts:329-365`). |
| F2 gesamtes Accept-Rennen | **ROT** | Bereits laufender Accept ist vor seiner spaeten Statuspersistenz nicht geclaimt; der Test wartet den Accept vollstaendig ab. Siehe F1 dieses Berichts. |
| F3 normale Eviction nach erfasster Version | **GRUEN** | Erwartete Version 1 macht den Write am revidierten Vermerk Version 2 zum No-op. |
| F3 harte Enqueue-Bindung | **GELB** | Asynchroner Read und fail-open `undefined` statt synchronem Jobfeld. Siehe F3 dieses Berichts. |
| **Patch 74 gesamt** | **ROT** | Reasoner geschlossen; Cleanup-Race nicht vollstaendig, Versionsbindung nur best-effort. |

## Patch 75 - sammel27 Stepper

| Punkt | Verdikt | Bewertung |
|---|---|---|
| Schritt 5 waehrend Apply aktiv | **GRUEN** | Neue Stufe `applying`, `aria-current` auf Schritt 5 und Mounted-Test mit haengendem Promise (`apps/web/src/lib/importStepper.ts:11-40`, `ImportGroups.tsx:234-245`, `tests/app/import-stepper-mounted.test.tsx:198-210`). |
| Haken nur nach erfolgreichem Apply | **ROT** | Jede Bilanz, auch nach Transportfehler, loest `applied` aus; Snapshot-Verfall bleibt auf `applying`. Kein Negativtest. |
| Neue Eingrenzungs-Generation | **GRUEN** | `beginGeneration` und `rewindForNewGeneration` setzen downstream auf `explored`; der echte Mounted-Test aendert nach Bilanz einen Chip und erwartet Schritt 3 aktiv (`ImportStepper.tsx:32-65`, `ImportSelect.tsx:81-97`, `tests/app/import-stepper-mounted.test.tsx:225-234`). |
| Verlaufstitel | **GRUEN** | Titel und Zaehlung nennen offene und gesamte Review-Eintraege ehrlich (`apps/web/src/components/ImportHistory.tsx:15-35`, `tests/app/import-history-mounted.test.tsx:41-53`). |
| **Patch 75 gesamt** | **ROT** | Erfolgsweg/Generation verbessert, Fehlerweg verletzt die explizite Haken-Auflage. |

## Patch 76 - sammel28 Politur

| Punkt | Verdikt | Bewertung |
|---|---|---|
| Vertrauliche KO-Titel aus Chips | **GRUEN** | `buildAskExampleChips` filtert validierte KOs zusaetzlich ueber `isKnownNonConfidential`; vertraulich, streng vertraulich und unbekannt sind ausgeschlossen (`apps/web/src/lib/askExampleChips.ts:28-42`). |
| Bibliotheks-Auto-Ask | **GRUEN** | Nicht eindeutig interne KOs erhalten nur `?q=...&vertraulich=1`, nie `ask=1`; der Auto-Ask-Effekt verlangt weiterhin explizit `ask=1` (`apps/web/src/lib/libraryMaturity.ts:57-64`, `askQuestion.ts:31-54`, `pages/Ask.tsx:132-146`). DE/EN/NL-Hinweis ist sichtbar (`Ask.tsx:273-279`). |
| Abweichung fehlend = intern | **GRUEN / tragfaehig** | Der Server dokumentiert und implementiert fehlende Stufe als `intern`: Create speichert nur vertrauliche Stufen, nicht `intern` (`services/knowledge-object/src/service.ts:285-338`; Typvertrag `services/knowledge-object/src/types.ts:19-21`). Unbekannte Laufzeitwerte bleiben im neuen Helper fail-closed. Die Abweichung ist deshalb kein Sicherheitsloch. |
| Testtiefe Egress | **GELB, nicht blockierend** | Matrix und Linkparameter sind gut gepinnt (`tests/app/polish-close.test.ts:49-109`, `tests/ask/ask-example-chips.test.ts:48-79`). Ein Mounted-/Netz-Spy `0 Aufrufe` fuer den vertraulichen Bibliothekslink fehlt; die strukturelle Auto-Ask-Bedingung ist dennoch eindeutig geschlossen. |
| Editor A -> B -> A | **GRUEN** | Der Marker wird beim Value-Roundtrip verbraucht und bei externem Set geloescht (`RichTextEditor.tsx:166-198`). Der Mounted-Test prueft Nutzereingabe, externe A-B-A-Rueckkehr und den nicht-vakuoesen No-op-Blur (`tests/capture/richtext-emission-marker.test.tsx:68-121`). |
| **Patch 76 gesamt** | **GRUEN funktional** | Beide sammel28-Befunde geschlossen; nur ein nicht-blockierender Egress-Spy-Test fehlt. |

## Regressionen 57-73

**Statisches Verdikt: keine weitere direkte Regression ausser den oben benannten Restkanten gefunden.**

- Patch 74 erhaelt die alten `judgeConflict`-/`judgeDuplicate`-Fassaden und damit andere Reasoner-Aufrufer; nur der aiCheck-Runner nutzt die neuen Outcome-Methoden.
- Das Cleanup loescht weiter nur die im bestaetigten Digest enthaltenen IDs; neue Kandidaten werden nicht mitgerissen. Die Review-Invariante "Kandidat statt Auto-KO" wird nicht zurueckgebaut.
- Patch 75 aendert nur Frontend-State, Copy und Tests; Import-Endpunkte, Prompt-Eigenprovenienz, Snapshot-Token, Batchbildung und Bilanzdaten bleiben unveraendert.
- Patch 76 aendert keine Backend-, Persistenz- oder Modellroute. Der Nutzer kann eine vertraulich vorbefuellte Frage weiterhin bewusst absenden; der fruehere **automatische** Titel-Egress ist entfernt und sichtbar markiert.
- Keine neue HTML-Senke, Secret-Ausgabe oder Vertraulichkeits-Herabstufung gefunden.

## Ship-Frage und erforderlicher Weg zum GO

**Aktuelles Urteil: NO-GO.** Ein bedingtes Deploy-GO waere nicht ehrlich, weil F1/F2 Codepfade betreffen, die durch keine Betriebsbedingung sicher ausgeschlossen werden.

Vor einem erneuten finalen Recheck sind mindestens erforderlich:

1. Kandidaten-Review am Beginn storage-seitig claimen/CASen und einen echten in-flight-Accept-vs.-Cleanup-Test liefern.
2. Stepper nach Apply-Fehler und `SNAPSHOT_EXPIRED` ohne Erledigt-Haken in einen fachlich korrekten Zustand zuruecksetzen; beide Negativwege mounted testen.
3. Queue-Jobs mit synchron uebergebener Zielversion speichern; bei fehlender Version keinen ungebundenen Eviction-Write ausfuehren; Fehler-/Race-Tests ergaenzen.

Erst nach diesen Codekorrekturen gelten zusaetzlich die bekannten Deploy-Bedingungen:

- **Stop-then-start, Einzelinstanz:** Kein parallel routbarer Altprozess waehrend der Tokenmigration; Beispielpaket-Claim und Queue sind prozesslokal.
- **Slides-Flag beweisen:** `KLARWERK_SLIDES_ENABLED` in der Zielumgebung nachweislich **unset**/aus, bevor Ship 8 aktiviert wird.
- **Finales Gate:** Die komplette, tatsaechlich materialisierte Kette 57 bis zum letzten Fix erneut mit dem vereinbarten Gate pruefen; die gelieferte `416/3067`-Evidence reicht fuer einen danach geaenderten Endstand nicht mehr.
- **Smoke nach Start:** Health, Login/Sitzung, KO-Submit mit aiCheck, Import Explore/Select/Group/Apply inklusive Fehlerpfad und Word/Klara-Goldpfad auf der Einzelinstanz pruefen.

## No-Code-Nachweis

- Produktcode geaendert: nein.
- Patch im Arbeits-Repo angewandt: nein.
- Bau/Test ausgefuehrt: nein.
- Commit/Push/Jira: nein/nein/nein.
- Secrets oder ENV-Werte gelesen/ausgegeben: nein.
- Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

SHA-256 des Berichtsinhalts oberhalb dieser Zeile: `246388f4c33bbd625249de6d7426b68f3b7a99ded56fb5129a95825b8774b041`
