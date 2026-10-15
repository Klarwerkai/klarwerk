# SAMMEL26 - Konsolidierte Ship-8-Abnahme

**Datum:** 22.07.2026  
**Pruefer:** ben / Codex  
**Baseline:** `2727b7e84d4a42056f0641174ac693121200ebbb` (`main`, Ship 7)  
**Pruefobjekt:** `_relay/patches57` bis `_relay/patches71`  
**Methode:** Alle Patches wurden in numerischer Reihenfolge in einem separaten, per `git archive` erzeugten Snapshot mit `git apply --check` geprueft und anschliessend dort nur fuer die statische Gesamtanalyse materialisiert. Das Arbeits-Repo wurde nicht veraendert. Kein Bau und kein Testlauf.

## Kurzfazit

**GESAMTVERDIKT: ROT / NO-GO. Ship 8 ist in der vorgelegten Kette noch nicht shipbar.**

Die Kette schliesst viele wesentliche Punkte: Prompt-Eigenprovenienz, aiCheck-Versionsbindung im regulaeren Abschluss, harte Queue-/Zeit-/Retry-Grenzen, final gemessenes Word-Payload, ein konsistenter Word-Auswahl-Snapshot, serverseitiges Retrieval-only fuer Word, Quellenpflicht und ehrliche Draft-/Quellenanzeige. Zwei bereits bekannte Abnahmebedingungen bleiben jedoch offen:

1. **aiCheck kann reale normale Providerfehler weiterhin als `done` abschliessen.** Der neue Wrapper sieht nur Fehler, die `Reasoner.judgeConflict/judgeDuplicate` verlassen. Der echte Reasoner verschluckt normale Provider-/HTTP-/Netz-/Parsefehler weiterhin und liefert `null`; der Test ersetzt den Reasoner durch einen Fake, der direkt wirft, und prueft deshalb nicht den realen Fehlerpfad.
2. **Cleanup kann einen parallel angenommenen Importkandidaten weiterhin loeschen.** Status-Re-Read und `removeByIds` sind zwei getrennte Operationen. Ein Accept zwischen beiden kann seinen Kandidaten verlieren; der neue Test legt den Accept frueher, vor den Status-Re-Read, und deckt das Restfenster nicht ab.

Zusaetzlich bleiben zwei bedingte Betriebsgrenzen: Der Beispielpaket-Claim ist prozesslokal, nicht storage-seitig, und die Token-Migration ist nur bei Stop-then-start/sicherer Einzelinstanz ohne Altprozess lockout-frei. Das Slides-Flag ist im Code default-aus; ob es in Coolify wirklich unset ist, ist aus dem lokalen Pruefobjekt nicht belegbar.

## Patchkette und Integritaet

- Es liegen **15** Patches vor (`57` bis `71` inklusive), nicht 14 wie einmal im Prueffokus formuliert.
- Alle 15 Patchdateien waren vorhanden und liessen sich in Reihenfolge sauber anwenden.
- Die Patches wurden nicht in das Arbeits-Repo eingespielt.
- Die im Auftrag genannte Gate-Evidence `404 Testdateien / 2999 Tests` wurde als Fremdbeleg uebernommen, nicht nachgerechnet.

## Kritische Restbefunde

### F1 - ROT - Reale normale Modellfehler werden im aiCheck weiter zu `done`

**Aufrufkette:**

- `services/app/src/ai-check-worker.ts:316-349` legt einen Beobachtungs-Wrapper um `deps.reasoner.judgeConflict` und `judgeDuplicate`. Er setzt `failure` nur, wenn diese Methoden werfen.
- Der echte `Reasoner` faengt in `services/reasoner/src/service.ts:958-979` und `:985-1007` normale Fehler seiner Provider ab. Nur `ModelCapacityError` wird erneut geworfen; alle anderen Fehler enden nach der Providerkette als `null`.
- Der Wrapper sieht damit bei zwei gescheiterten Providern keinen Fehler. `createAiCheckRunner` erreicht `services/app/src/ai-check-worker.ts:350-356` und liefert bei weiterhin aktiv gemeldetem Modell `{ ok: true }`.
- `tests/app/ship8-final-aicheck.test.ts:98-121` injiziert dagegen einen strukturellen Fake-Reasoner, dessen `judge*` direkt wirft. Der Test umgeht genau die produktive Fehler-Schluckstelle und waere auch gruen, wenn reale Providerfehler weiter verschluckt werden.

**Impact:** Eine in Wahrheit nicht durchgefuehrte oder fehlgeschlagene Konflikt-/Duplikatpruefung kann als abgeschlossen angezeigt werden. Das verletzt die Ehrlichkeitsgarantie und schliesst sammel23 P0-3 nicht.

**Erforderlicher Fix:** Der echte Reasoner muss dem Runner unterscheidbar melden, ob `null` ein regelmaessiges Urteil ohne Treffer oder das Ergebnis gescheiterter Provider war. Alternativ braucht der Runner einen produktiven Fehlerkanal aus dem Reasoner. Der Test muss einen echten `Reasoner` mit werfendem Provider verwenden und HTTP-/Netz-/Timeout-/Parsefehler auf `failed/model-error` pinnen.

### F2 - ROT - Confirm-vs.-Accept-Rennen im Cleanup bleibt offen

**Aufrufkette:**

- `services/library-analytics/src/service.ts:330-350` liest alle aktuellen Kandidatenstatus und bildet danach die Liste `deletable`.
- `services/library-analytics/src/service.ts:352` ruft anschliessend `removeByIds(deletable)` auf.
- `services/library-analytics/src/repo-pg.ts:194-201` loescht nur nach ID: `DELETE ... WHERE id = ANY($1)`. Weder erwarteter Status noch Kandidatenversion werden in derselben atomaren DB-Operation geprueft.
- Parallel setzt `reviewImportCandidate` in `services/library-analytics/src/service.ts:400-419` erst den Status, erzeugt ggf. das KO und persistiert den Kandidaten danach. Ein Accept nach dem Status-Re-Read, aber vor dem DELETE kann deshalb seinen Kandidaten verlieren. Beginnt der Accept vor dem DELETE und persistiert danach, kann sein `UPDATE` wegen der bereits geloeschten Zeile still null Zeilen treffen; auch dieser Rowcount wird nicht erzwungen.
- `tests/app/import-cleanup.test.ts:447-479` startet den Accept bereits am ersten KO-Delete. Damit ist der Kandidat beim spaeteren Status-Re-Read schon `angenommen`; das schmalere Rennen zwischen Re-Read und `removeByIds` wird nicht geprueft.

**Impact:** Die Review-Queue kann einen angenommenen Kandidaten und dessen nachvollziehbaren Reviewstatus verlieren. Das erzeugte KO kann zwar bestehen bleiben, aber Queue-/Bilanz-/Audit-Wahrheit sind nicht mehr konsistent. Sammel23 Bedingung 3 ist nicht voll geschlossen.

**Erforderlicher Fix:** Kandidaten atomar per ID **und erwartetem Status/Version** loeschen, z. B. `DELETE ... WHERE id = ANY(...) AND data->>'status' = ...`, mit exakter Rowcount-/Restmengen-Auswertung. Noch sauberer ist ein Kandidaten-CAS/Claim. Ein Test muss den Accept gezielt zwischen Statuspruefung und DELETE legen.

### F3 - GELB - Queue-Eviction umgeht die neue aiCheck-Versionsbindung

- Der regulaere Abschluss uebergibt `expectedVersion` in `services/app/src/ai-check-worker.ts:186-206` und ist korrekt versionsgebunden.
- Beim Queue-Ueberlauf ruft `services/app/src/ai-check-worker.ts:155-161` `resolveAiCheck` dagegen ohne `expectedKoVersion` auf.
- Der Test `tests/app/ship8-final-aicheck.test.ts:129-159` prueft nur ID und Grund mit einem Fake-Repo, nicht Revision plus Eviction.

**Impact:** Eine alte wartende Queue-Instanz kann nach Revision den aktuellen pending-Vermerk als `failed/queue-overflow` markieren. Das ist kein stale-`done`, widerspricht aber dem behaupteten Vertrag, dass jeder Job hart an eine Inhaltsversion gebunden ist.

**Fix-Richtung:** Beim Enqueue die Zielversion im Jobobjekt tragen und auch bei Eviction bedingt mit dieser Version abschliessen.

### F4 - GELB - Beispielpaket-Claim ist nicht storage-seitig

- `services/app/src/example-packages.ts:253-265` bezeichnet den Claim als storage-seitig, implementiert ihn aber als `WeakMap<KoService, Map<...>>` im Prozessspeicher.
- Innerhalb einer App-Instanz ist die Check-and-set-Stelle ohne `await` serialisiert; der Owner scannt den Storage unter Claim erneut. Damit ist das Parallelrennen im aktuellen Einprozessvertrag geschlossen.
- Ueber zwei Prozesse/Replikas greift der Claim nicht; der Code dokumentiert diese Grenze selbst in `services/app/src/example-packages.ts:262-264`.

**Impact:** Fuer die derzeit dokumentierte Einzelinstanz akzeptabel. Bei Rolling-/Mehrprozessbetrieb koennen weiterhin doppelte Beispiel-KOs oder Konfliktanker entstehen. Sammel23 Bedingung 5 ist deshalb **bedingt geschlossen**, nicht allgemein/storage-seitig.

### F5 - GELB - Token-Dual-Read ist nicht mit einem gleichzeitig laufenden Altprozess kompatibel

- Neue Prozesse lesen Hash zuerst und migrieren Klartexttreffer in-place: `services/auth/src/service.ts:211-239` und `:367-378`.
- Beim Start konvertiert `migrateAuthTokensAtRest` den gesamten Klartextbestand: `services/auth/src/repo-pg.ts:51-75`; der Server ruft dies vor dem Servicebau auf (`services/app/src/server.ts:21-33`).
- Ein alter Prozess kennt den Hash-Lookup nicht. Sobald der neue Prozess eine Klartextzeile umgeschrieben hat, kann der alte Prozess diese Sitzung nicht mehr authentifizieren. Der Kommentar, ein paralleler Altprozess sei harmlos, ist daher zu weitgehend.
- Delete-then-create im requestseitigen Dual-Read ist zudem nicht atomar; Parallelzugriffe koennen einen transienten Fehler erzeugen, auch wenn die gespeicherte Endlage typischerweise korrekt bleibt.

**Impact:** Unter echtem Single-Instance Stop-then-start ist die Migration tragfaehig. Bei ueberlappenden Alt-/Neuprozessen besteht weiterhin Lockout-/401-Risiko.

**Deploy-Bedingung:** Neue Version ohne parallel routbaren Altprozess starten; Health pruefen und erst danach Traffic freigeben. Die Rolling-Kompatibilitaetsbehauptung in den Kommentaren korrigieren.

## Abnahme der eigenen offenen Listen

### Sammel23 - Bedingungen 1 bis 5

| Nr. | Gegenstand | Verdikt | Beleg / Rest |
|---:|---|---|---|
| 1 | Prompt-Eigenprovenienz | **GRUEN** | Pflicht-Boolean bei nichtleerem Prompt; fehlend/ungueltig 400; Cloud nur bei explizit `false` und freigegebenem Snapshot (`confluence-import-routes.ts:292-349`). UI defaultet fail-safe auf vertraulich (`ImportSelect.tsx:43-46`, `:73-84`, `:159-186`). |
| 2 | aiCheck-Version, Fehler, Queue/Timeout/Retry | **ROT** | Versions-CAS, 200er Queue, 120-s-Timeout und Retry-Deckel sind vorhanden. Reale normale Providerfehler bleiben als `done` moeglich (F1); Eviction ist nicht versionsgebunden (F3). |
| 3 | Cleanup Confirm-vs.-Accept/Revision | **ROT** | KO-Revision ist ueber `expectedVersion` geschuetzt. Kandidatenstatuspruefung und DELETE bleiben getrennt (F2). |
| 4 | KLARA-2 Snapshot + finales Payloadbudget | **GRUEN** | HTML-Erfolg nutzt genau einen Office-Snapshot, Text wird daraus abgeleitet; Text-Aufruf nur als HTML-Fallback (`taskpane.html:1013-1034`). Gemessen und gesendet wird derselbe JSON-String (`wordAddin.ts:377-421`). |
| 5 | Beispielpaket-Idempotenz/Trash/Restore | **GELB** | Trash-/Restore-Rand und Einprozessparallelitaet geschlossen; Claim ist prozesslokal, nicht storage-seitig (F4). |

### Sammel24 - Punkte 1 bis 4

| Nr. | Gegenstand | Verdikt | Beleg / Rest |
|---:|---|---|---|
| 1 | Prompt-Eigenprovenienz | **GRUEN** | Eigene Pflicht-Einstufung und monoton hebender Snapshot-Backstop vorhanden. |
| 2 | Token-Migration / Dual-Read | **GELB** | Stop-then-start-Einzelinstanz geschlossen; Rolling-/Altprozessbehauptung nicht erfuellt (F5). |
| 3 | `/api/reasoner/config` Admin-Sicht | **GRUEN** | GET und PUT verlangen `users.manage` (`reasoner-routes.ts:311-339`). |
| 4 | Formulierungen/Adminsicht | **GRUEN** | UI-/Metadatenformulierungen sind auf Adminsicht ausgerichtet; keine neue Secret-Ausgabe gefunden. |

### Sammel25 - Punkte 1 bis 5

| Nr. | Gegenstand | Verdikt | Beleg / Rest |
|---:|---|---|---|
| 1 | Word Ask serverseitig retrieval-only | **GRUEN** | Word sendet fest `mode: "retrieval-only"` (`wordAddin.ts:214-223`); Server erzwingt `validatedOnly + retrievalOnly` (`ask-routes.ts:110-127`); Ask nutzt `answerRetrievalOnly` (`ask/service.ts:98-127`). Integrationstest pinnt 0 Modell/0 Embedder. |
| 2 | Quellenpflicht und Einfuege-Gating | **GRUEN** | `answered` gilt nur mit Source-ID (`wordAddin.ts:231-256`); `canInsertAnswer` prueft erneut (`:274-285`); Button wartet auf Quellenaufloesung (`taskpane.html:1098-1105`). |
| 3 | Ehrliches Datum und Kappung | **GRUEN** | Quell-KO-Daten werden aufgeloest; ohne Beleg wird Abrufdatum verwendet. Kappung wandert in den Einfuegetext (`wordAddin.ts:300-334`). |
| 4 | Gap-Draft | **GRUEN** | Nur Gap-Zustand, laufender Knopf gesperrt, 403 getrennt, lokalisierter Titel, voller Fragetext im Body. Kein Auto-KO-Pfad gefunden. |
| 5 | Integration / Altmechanik | **GRUEN statisch** | Retrieval-only-Gegenprobe erhaelt den Konsolenpfad ohne `mode`; bestehender Add-on-Pfad bleibt separat. Die angegebene Gate-Evidence wurde nicht selbst ausgefuehrt. |

### Gesamtreview P0-1 / P0-3

- **P0-1 Prompt-Freitext-Egress: GRUEN.** Der Prompt besitzt jetzt ein eigenes Pflichtsignal; fehlend/unklar bleibt fail-safe.
- **P0-3 Modellfehler-Ehrlichkeit: ROT.** Siehe F1. Der neue Test bildet nicht den echten Reasoner-Providerpfad ab.

## Kettenkonsistenz

| Nahtstelle | Verdikt | Bewertung |
|---|---|---|
| aiCheck-Version vs. revise | **GELB** | Regulaerer Abschluss ist CAS-gebunden und stale-`done` geschlossen; Queue-Eviction umgeht die Version (F3). |
| aiCheck-Fehler vs. Reasoner | **ROT** | Wrapper liegt ausserhalb einer inneren Fehler-Schluckstelle; produktiver Fehlerstatus bleibt falsch (F1). |
| Cleanup-CAS vs. `removeByIds` | **ROT** | KO-CAS gruen; Kandidaten-DELETE prueft Status nicht atomar (F2). |
| Prompt-Provenienz vs. Route-Schema | **GRUEN** | UI und Route verlangen dieselbe boolesche Eigenklassifikation; Snapshot kann nur weiter anheben. |
| Dual-Read vs. Start-Migration | **GELB** | In einem Stop-then-start-Prozess konsistent; bei ueberlappendem Altprozess nicht. |
| Word Client vs. Ask-Route | **GRUEN** | Modus, Quellenpflicht und Lueckenweg passen zusammen; Konsole ohne Modus bleibt erhalten. |
| Beispielanker vs. Deploymentmodell | **GELB** | Einprozess konsistent; keine DB-weite Eindeutigkeit. |

## Regressionsblick auf Ship 7

**Statisches Ergebnis: keine neue direkte Regression in den benannten Ship-7-Vertraegen gefunden.**

- **Finalizer:** `Capture.tsx` nutzt weiter `finalizeCaptureSubmit`; die Ship-8-Patches bauen dort keine neue alternative Abschlussstrecke ein. Der Anhang-/KO-Verknuepfungsvertrag bleibt erhalten.
- **Describe:** `describeImage` und sein Modell-/Fallback-Vertrag bleiben im Reasoner bestehen; Patch 70 erweitert nur Metadaten/Adminsicht. Keine neue Egress-Umgehung gefunden.
- **Captions:** Server-Sanitizer, `captionTexts`-Ableitung bei Create/Revise und bodyHtml-freie Suchprojektion bleiben bestehen. Neue aiCheck-Feldpatches veraendern keine Inhaltsfelder.
- **Slot-Normalpfad:** Die Slides-Abbruch-/Settlement-Logik aus Patches 58/61/63 bleibt im materialisierten Endstand erhalten. Patches 69-71 beruehren die Slides-Routen nicht.
- **Sanitizer:** `sanitizeHtml` bleibt die serverseitige Persistenzgrenze; Word-Drafts laufen weiter durch den bestehenden Draft-/Sanitizerpfad. Keine neue rohe HTML-Persistenzkante in 69-71 gefunden.

Diese Aussagen sind statisch. Es wurde regelgemaess keine Test-/Browser-/Produktionsprobe ausgefuehrt.

## Dark-Ship-Bedingung Slides

- **Code-Default: GRUEN.** `services/app/src/routes/slides-routes.ts:53-58` aktiviert Slides nur bei explizitem `KLARWERK_SLIDES_ENABLED=1|true`; ohne Variable antwortet die Verfuegbarkeit negativ und der Konvertierungsweg bleibt gesperrt.
- **Coolify-ENV: NICHT VERIFIZIERT.** Das lokale Patch-/Repo-Objekt belegt nicht, dass `KLARWERK_SLIDES_ENABLED` in Coolify unset ist. Dies muss im Deploy-Verify explizit als reine Existenz-/Wertklasse geprueft werden, ohne Secrets auszugeben.
- Die sammel18-Auflagenlage bleibt damit **code-seitig unveraendert**, operativ aber weiterhin beweispflichtig.

## Verdikttabelle

| Bereich | Verdikt | Kern |
|---|---|---|
| Patchkette 57-71 formal | **GRUEN** | 15 Patches vorhanden und sequenziell anwendbar |
| Prompt-Eigenprovenienz | **GRUEN** | Pflichtsignal + fail-safe Backstop |
| aiCheck Versions-CAS | **GELB** | Regulaerer Abschluss gruen, Eviction ungebunden |
| aiCheck Fehlerwahrheit | **ROT** | Reale Providerfehler werden vor dem Wrapper verschluckt |
| Queue/Timeout/Retry | **GRUEN mit F3-Rand** | Harte Grenzen vorhanden; Eviction-Version offen |
| Cleanup KO-Revision | **GRUEN** | `expectedVersion` verhindert Loeschen revidierter KOs |
| Cleanup Kandidaten-Accept | **ROT** | Statuspruefung und DELETE nicht atomar |
| KLARA-2 Snapshot/Payload | **GRUEN** | Ein Snapshot; finaler JSON-Body gemessen |
| Beispielpakete | **GELB** | Einprozess/Trash gruen; kein storage-/DB-weiter Claim |
| Token-at-Rest | **GELB** | Stop-then-start gruen; kein sicherer Altprozess-Ueberlapp |
| Reasoner-Config Adminsicht | **GRUEN** | `users.manage` fuer GET/PUT |
| Word Ask 1-5 | **GRUEN** | Retrieval-only, Quellenpflicht, ehrliche Anzeige, Gap-Draft |
| Ship-7-Regressionsblick | **GRUEN statisch** | Kein neuer Bruch gefunden; Gates nicht selbst gelaufen |
| Slides dark ship | **GELB operativ** | Code default-aus; Coolify unset nicht lokal belegt |
| **Ship 8 gesamt** | **ROT / NO-GO** | F1 und F2 sind konkrete Restblocker |

## Ship-Entscheidung

**Ship 8 (patches57-71) ist derzeit NO-GO.** Ein bedingtes Deploy-GO reicht nicht, weil F1 und F2 produktive Wahrheits-/Datenintegritaetsfehler sind und nicht nur Betriebsauflagen.

Vor einer erneuten Freigabe muessen mindestens:

1. reale normale Providerfehler durch den aiCheck-Runner als `failed/model-error` erkennbar sein, mit produktionsnahen Reasoner+Provider-Tests;
2. der Kandidaten-Cleanup Status/Version und Delete in **einer atomaren Bedingung** verbinden, mit Test fuer Accept exakt zwischen bisherigem Re-Read und Delete;
3. die Queue-Eviction die erwartete KO-Version mitfuehren und bedingt abschliessen.

Danach gelten fuer den Deploy weiterhin diese Bedingungen:

- Stop-then-start ohne parallel routbaren Altprozess fuer die Token-Migration;
- genau eine App-Instanz, solange Beispielanker nur prozesslokal geclaimt werden;
- `KLARWERK_SLIDES_ENABLED` in Coolify bewusst unset/aus nachweisen;
- Gate/Integration/Smoke auf der final materialisierten Kette wiederholen.

## No-Code-Nachweis

- Produktcode geaendert: nein.
- Patch im Arbeits-Repo angewandt: nein.
- Bau/Test ausgefuehrt: nein.
- Commit/Push/Jira: nein/nein/nein.
- Geheimnisse/ENV-Werte gelesen oder ausgegeben: nein.
- Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

SHA-256 des Berichtsinhalts oberhalb dieser Zeile: `0e22a5e64b04b2a07ce951ebb59799a3be8c344a12fab933ebe076531b7810d1`
