# BERICHT sammel30 - Finaler Recheck 2 Ship 8

## Kurzurteil

**GESAMTVERDIKT: ROT - NO-GO fuer Ship 8 in der vorliegenden Kette patches57-77.**

Patch77 schliesst das urspruengliche Cleanup-vs.-Accept-Fenster technisch: Der Status-CAS erfolgt vor `acceptToKo`, das Cleanup loescht bedingt und der geforderte In-flight-Test ist aussagekraeftig. Der neue persistierte Status `in_bearbeitung` erzeugt jedoch zwei neue, statisch belegte Integritaetsluecken: Nach einem Prozessabbruch kann ein Kandidat dauerhaft unrecoverbar festhaengen, und waehrend eines laufenden Claims faellt derselbe Kandidat aus dem bestehenden Unique-/Pending-Vertrag heraus, sodass ein zweiter offener Kandidat derselben Quelle eingereiht werden kann. F2, F3 und der vertrauliche Ask-Netztest sind gruen.

## Pruefrahmen

- Auftrag: `_relay/ben/inbox/AUFTRAG-sammel30.md`
- Repo-Basis: `/Users/peterkohnert/Documents/dev_Klarwerk`, HEAD `2727b7e84d4a42056f0641174ac693121200ebbb`
- Pruefobjekt: `_relay/patches77/0001-fix-server-web-WP-SHIP8-CLOSE-2-bens-drei-sammel29-R.patch`
- Patch-SHA-256: `24b94c2998f175e0c06dd6db08bd411a0275d47dbd8f2b61b39d34622bad136f`
- Methode: patches57-77 nacheinander in einem temporaeren Lesebaum jeweils mit `git apply --check` geprueft und dort materialisiert; alle Patches waren konfliktfrei. Das Arbeitsrepo wurde nicht veraendert.
- Kein Bau und kein Testlauf gemaess Auftrag. Die Angabe `417 Testdateien / 3077 Tests gruen` ist uebernommene Evidence, nicht von Ben nachgerechnet.
- Formale Abweichung: Der reale Patch-Stat lautet **21 Dateien, +604/-104**, nicht die im Auftrag genannten **20 Dateien, +491/-104**. Das ist kein Funktionsbeweis gegen den Patch, muss aber im Evidence-Satz korrigiert werden.

## Findings

### [ROT-1] Persistierter Claim kann nach Prozessabbruch dauerhaft festhaengen

**Beleg:** `reviewImportCandidate` persistiert den Claim zuerst als `neu -> in_bearbeitung` und wartet danach in `acceptToKo`; nur der normale `catch` versucht die Rueckgabe auf `neu` (`services/library-analytics/src/service.ts:420-464`). Ein Prozessabbruch, Kill oder Crash durchlaeuft diesen `catch` nicht. Es gibt weder Claim-Zeitstempel/Lease noch Startup-Recovery oder administrativen Retry fuer verwaiste Claims.

Der Zustand ist danach praktisch fest:

- Eine erneute Review-Aktion claimt nur aus `neu` und endet fuer `in_bearbeitung` mit `ALREADY_REVIEWED` (`service.ts:420-429`).
- Das Cleanup ueberspringt `in_bearbeitung` ausdruecklich (`service.ts:341-347`).
- Die UI zeigt Review-Aktionen nur fuer `status === "neu"` (`apps/web/src/pages/Stufe2.tsx:518-540`).

**Impact:** Ein Crash im langen Accept-Pfad kann einen Kandidaten dauerhaft der Bearbeitung und Bereinigung entziehen. Besonders kritisch ist ein Abbruch nach KO-Erzeugung, aber vor Kandidaten-Endstatus: Ein blindes Ruecksetzen auf `neu` kann bei Kandidaten ohne stabilen Quell-Anker beim Retry ein zweites KO erzeugen. Die im Kommentar behauptete Idempotenz von `acceptToKo` gilt nicht pauschal fuer jeden Importkandidaten.

**Erforderliche Korrektur:** Ein crash-sicherer Recovery-Vertrag ist noetig. Moegliche tragfaehige Varianten sind ein transaktionaler/idempotenter Accept mit dauerhaftem Operationsanker oder ein Lease/Claim-Protokoll mit `claimedAt`, eindeutiger Operations-ID und sicherem Resume. Ein blosses Startup-Reset aller Claims auf `neu` reicht ohne globale Accept-Idempotenz nicht. Pflichttests muessen Prozessabbruch-Snapshots nach Claim, nach KO-Erzeugung und vor Endstatus simulieren und beweisen: Kandidat recoverbar, hoechstens ein KO, kein stiller Erfolg.

### [ROT-2] `in_bearbeitung` faellt aus dem Unique-/Pending-Vertrag und erlaubt Doppel-Kandidaten

**Beleg:** Der neue Status wird nicht als weiterhin offener Kandidat behandelt:

- `openCandidateKey` liefert nur bei `status === "neu"` einen Schluessel (`services/library-analytics/src/repo.ts:85-90`).
- Der partielle PostgreSQL-Unique-Index und `ON CONFLICT` gelten nur fuer `review_status = 'neu'` (`services/library-analytics/src/repo-pg.ts:107-129`, `150-159`).
- Import-Orchestrator und Statusanzeige beruecksichtigen bei Pending-Schluesseln ebenfalls nur `neu` (`services/app/src/confluence-import.ts:52-64`, `121-138`).

**Reproduzierbares Interleaving:** Kandidat A ist `neu`; Review claimt A auf `in_bearbeitung`; ein paralleler Importlauf sieht A nicht mehr als pending; `insertIfAbsent` darf Kandidat B mit identischem `(provider, externalId, sourceVersion)` einfuegen, weil A nicht mehr im partiellen Index liegt. Nach Abschluss bleibt B als zusaetzlicher offener Review-Kandidat bestehen.

**Impact:** Die zuvor hart abgesicherte Queue-Idempotenz wird genau waehrend einer Review-Aktion aufgehoben. Das erzeugt falsche Importzaehlungen und doppelte Review-Arbeit; bei spaeteren Fehler-/Retry-Kanten kann daraus auch mehrfacher KO-Fluss entstehen. Einzelinstanz-Betrieb verhindert diese asynchrone Konkurrenz nicht.

**Erforderliche Korrektur:** `neu` und `in_bearbeitung` muessen denselben offenen Idempotenzraum belegen: InMemory-Schluessel, Pending-Abgleiche, Statuskarten sowie Pg-Dedupe, Index-Praedikat und `ON CONFLICT`-Inference konsistent auf beide Statuswerte erweitern. Die bestehende Indexmigration muss den alten Index wirklich ersetzen, nicht nur `CREATE IF NOT EXISTS` ausfuehren. Pflichttests: Claim A, paralleles `insertIfAbsent` B mit gleichem Schluessel ergibt `false`, sowohl InMemory als auch gegen echtes PostgreSQL; Import-Status bleibt waehrend des Claims `alreadyImported`.

## Verdikttabelle

| Punkt | Verdikt | Befund |
|---|---|---|
| F1 Review-Claim / Cleanup-Race | **ROT** | Urspruengliches In-flight-Delete geschlossen und Test echt; neue Crash-Recovery- und Queue-Idempotenzluecke blockieren Ship. |
| F1 CONFLICT-Kante | **GRUEN** | Pg/InMemory melden fehlenden Update-Treffer ehrlich als `CONFLICT`; zentrale HTTP-Zuordnung liefert 409. Keine weiteren Produktaufrufer von `CandidateRepo.update` gefunden. |
| F2 Stepper-Fehlerweg | **GRUEN** | `applied` nur ohne Transportfehler; normaler Fehler spult auf `grouping`, `SNAPSHOT_EXPIRED` auf `previewed`. `rewindStage` kann nur abwaerts und veraendert die Generation nicht (`apps/web/src/lib/importStepper.ts:59-65`, `ImportGroups.tsx:230-298`). |
| F2 Testehrlichkeit | **GRUEN** | Mounted Tests durchlaufen den echten Cockpit-Pfad, erzwingen Promise-Reject bzw. `SNAPSHOT_EXPIRED` und pruefen Haken, aktiven Schritt und Regroup-CTA (`tests/app/import-stepper-mounted.test.tsx:252-283`). Der bestehende Erfolgsweg bleibt als Gegenprobe erhalten. |
| F3 Eviction-Version | **GRUEN** | Die vier Produktionsaufrufer lesen den frisch markierten Vermerk vor `enqueue`; interner Re-Enqueue reicht die Zielversion weiter. Eviction verwendet ausschliesslich den synchron gespeicherten Wert; ohne Wert erfolgt kein Status-Write und ein PII-freier Loghinweis (`services/app/src/ai-check-worker.ts:160-204`, Routen in `ko-routes.ts`, `capture-routes.ts`, `validation-routes.ts`). |
| F3 Testehrlichkeit | **GRUEN** | Tests belegen alte Version -> bedingter No-op, unveraenderte Version -> `failed/queue-overflow`, fehlende Version -> exakt null `resolveAiCheck`-Aufrufe (`tests/app/ship8-close-aicheck.test.ts:177-249`). |
| Bonus vertraulicher Ask-Link | **GRUEN** | Mounted Test prueft 0 `/api/ask` fuer vertraulichen Prefill und als nicht-vakuose Gegenprobe exakt 1 Aufruf fuer den normalen `?ask=1`-Pfad (`tests/app/ask-confidential-autoask-mounted.test.tsx:95-109`). |
| Regressionen 57-76 | **ROT wegen F1** | Stepper, aiCheck-Eviction und Bonus sind tragfaehig; der neue Claim-Status verletzt jedoch den bestehenden Queue-Idempotenzvertrag und besitzt keine Crash-Recovery. |
| Evidence-Formalia | **GELB** | Patch-Hash und Ketten-Anwendbarkeit belegt; im Auftrag genannter Datei-/Zeilenstat ist falsch. Gate-Zahlen wurden wegen No-Build-Regel nicht erneut ausgefuehrt. |

## Ship-Entscheidung

**Explizite Antwort: NO-GO. Das Ship-8-Paket patches57-77 ist in diesem Stand nicht shipbar.**

Vor einem neuen Ship-GO sind beide F1-Korrekturen zwingend:

1. Crash-sicherer, idempotenter Recovery-Vertrag fuer persistierte `in_bearbeitung`-Claims, einschliesslich Abbruchtests an den kritischen Accept-Grenzen.
2. `in_bearbeitung` in den gesamten offenen Unique-/Pending-Vertrag aufnehmen, einschliesslich echter Pg-Integration und Migrationsnachweis.
3. Evidence-Stat auf 21 Dateien und +604/-104 korrigieren und das finale Gate auf der dann vollstaendigen Endkette neu ausweisen.

Erst danach gelten die bisherigen Deploy-Bedingungen unveraendert weiter:

- **stop-then-start und genau eine Instanz**; kein Rolling-Mix verschiedener Schemas/Worker.
- **`SLIDES`-Flag unset nachweisen**, bevor der Prozess gestartet wird.
- **Finales Gate auf der korrigierten Endkette**; die 417/3077-Evidence von 57-77 reicht nach einem weiteren Fix naturgemaess nicht mehr.
- **Smoke nach Start**: Health/Version, Import-Explore/Group/Apply, paralleler Review-vs.-Cleanup-Nachweis, Stepper-Erfolg und beide Fehlerwege, aiCheck-Overflow/Retry sowie vertraulicher Ask-Prefill ohne Netzaufruf.

## No-Change-Nachweis

Kein Produktcode geaendert, kein Patch angewandt, kein Bau, kein Testlauf, kein Commit, kein Push, kein Jira. Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

Erstellt: 2026-07-22 12:40:43 CEST

SHA-256 (Inhalt oberhalb dieser Zeile): 009329a7ccdb8fe975239ec46d90e358b62efcd6c072897a8dbbc4a7c964bebc
