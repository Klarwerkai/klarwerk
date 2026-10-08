# Bestandsaufnahme Importlaufprotokoll — Stand 08.10.2026

Auftrag `aufnahme:20260922:gesamt-import-laufprotokoll` (Revision 1), Basis `c62a9855` =
`1.0.0-beta.1.745`. Zugeordnete Anliegen: **R-0144**, **R-0701**, **P-IMPORT-REST** (dazu
`priority:IMPORT-REST:91fa6388071a` als doppelte Quellenfassung desselben Punkts). Diese Datei hält
je Anliegen fest, was im Repository geliefert ist, woran man es sieht, was dieser Lauf ändert und
was offen bleibt. Ein „Beleg“ ist eine Datei oder ein Test im Repository. Ob ein Test grün ist,
belegt erst der Prüflauf am festen Commit; dieser Lauf hat selbst **keine** Tests ausgeführt.

Legende: **geliefert** = im Code mit Test belegt · **dieser Lauf** = in diesem Lauf gebaut ·
**offen** = nicht gebaut · **ungeklärt** = ohne jüngeren Beleg.

## Übersicht

| Anliegen | Stand | Beleg |
|---|---|---|
| R-0144 Importlauf mit Zustand, Ergebnis, eigener Kennung | geliefert | Laufdomäne `ImportRun` mit neun kanonischen Zuständen, Zählern, `failureCode`/`failureReason` (`services/library-analytics/src/types.ts`, AUFTRAG-144; Ablage `repo.ts`/`repo-pg.ts`, Migration `IMPORT_RUN_SCHEMA`). Läufe entstehen auf allen vier Übernahmewegen: Confluence-Gesamtlauf, Confluence-Auswahl `/apply` (JOB 3288, `tests/import-volltext/selektivimport-hat-eine-lauf-kennung.test.ts`), SharePoint-Auswahl und SharePoint-Ordnerlos (JOB 4086, `sharepoint-import-routes.ts`). |
| R-0144 Lauf lesbar und weiterverarbeitbar | geliefert | `GET /api/admin/import/runs/:importId` und `…/result` (`services/app/src/routes/import-run-routes.ts`, AUFTRAG 148; `tests/app/w2a-import-run-routes-148.test.ts`); der Kopf der Importseite liest daraus den letzten erfolgreichen Lauf (`import-access-service.ts`, `tests/import-volltext/kopf-zeigt-den-selektivimport.test.tsx`). |
| R-0144 Abbruch samt Grund, wenn Zeit oder Datenvolumen nicht reichen | Gesamtlauf geliefert; **Übernahmewege dieser Lauf** | Gesamtlauf: `CONFLUENCE_TIMEOUT` / `CONFLUENCE_BUDGET` / `CONFLUENCE_RESPONSE_TOO_LARGE` am Lauf (R-0159, `tests/confluence-import-bedienung/folgeabruf-zeitlimit.test.tsx` Z1–Z3). **Dieser Lauf:** Confluence `/apply` und SharePoint-Übernahme schreiben den Grund jetzt ebenfalls an den gespeicherten Lauf (s. unten). |
| R-0144 dauerhafter Datensatz zur externen Quelle | Confluence geliefert; **SharePoint dieser Lauf** | `ExternalSourceRecord` (unveränderliche Quellrevision, `types.ts` W2-A), geschrieben beim Einreihen im Namen eines Laufs (`laufbindung.ts`, `LibraryService.bindeAnLauf`) und bei der Annahme (`quellrevisionFestschreiben`); lesbar über `GET /api/admin/import/source-records/:id`. Confluence: `tests/confluence-quellabgleich/r0142-ergebnisweg.test.ts` E1. **Dieser Lauf:** SharePoint reiht mit Laufbindung ein. |
| R-0144 Quelle und Fassung am Wissensobjekt | geliefert | Herkunftsanker `provider` + `externalId` + `sourceVersion` + `sourceRecordId` + `importRunId` (`buildSource`; R-0142 Lauf 5 R3 B11); `GET /api/admin/import/knowledge/:koId`, Anzeige `apps/web/src/components/bibliothek/ImportErgebnis.tsx`. SharePoint-Anker samt Fassung nach Neustart: `tests/sharepoint-inhalt/weg-am-draht-und-neustart.test.ts` W1. |
| R-0701 ein Weg zum Ergebnis eines Importlaufs | geliefert, **dieser Lauf für SharePoint vervollständigt** | Ein Vertrag, gebaut an einer Stelle: `laufNachAussen` (Lauf), `quelleNachAussen` (Quellrevision), `elementNachAussen` (Element) in `import-run-routes.ts`. Die Ergebnisfrage beantwortet `GET /api/admin/import/runs/:importId/result` quellneutral. Bis zu diesem Lauf lieferte sie für SharePoint-Läufe nach der Annahme `items: []`; jetzt dieselbe Antwort wie für Confluence. |
| P-IMPORT-REST Lauf-ID des Selektivimports in der Oberfläche | geliefert (JOB 3357) | Bilanz der Übernahme nennt jede Lauf-Kennung vollständig, abschreibbar und mit Ausgang (`apps/web/src/components/ImportGroups.tsx`, `LaufKennungen`/`LaufAusgang`); `tests/import-lauf-kennung/*` (u. a. `bilanz-zeigt-die-laufkennung.test.tsx`, `zwei-aufrufe-zwei-kennungen.test.tsx`, `ohne-lauf-keine-kennung.test.tsx`). |
| P-IMPORT-REST exakter Seitentitel als Freitext → 0 Treffer | geliefert (JOB 3356) | Die KI-Deutung bleibt unverändert sichtbar, daneben steht der deterministische Titelbefund `titleFallback` mit eigener Trefferzahl und übernehmbaren Kriterien (`confluence-import-routes.ts` `/select`; `tests/import-freitext-titel/titel-satz-findet-die-seite.test.ts`, `titel-filter-ist-deterministisch.test.ts`, Fläche `auswahl-sagt-was-die-ki-verstand.test.tsx`). |

## Was dieser Lauf ändert

1. **Confluence-Auswahl (`POST /api/admin/import/confluence/apply`).** Scheiterte der Einzelabruf
   einer Seite an Frist, Zeitbudget oder Antwortgröße, endete der Lauf `PARTIAL` mit
   `failureCode: null`; der Grund stand nur als Fehlerklasse in der Antwort. Jetzt trägt der
   gespeicherte Lauf den Code der ersten aufgetretenen Grenze (dieselben drei Codes wie beim
   Gesamtlauf) und einen Satz mit der Anzahl je Grund, ohne Seitenkennung
   (`uebernahmeGrenzgrund` in `services/app/src/routes/confluence-import-routes.ts`). Andere Fehler
   bekommen weiterhin keinen erfundenen Grund. Die Antwort des Aufrufs bleibt unverändert.
2. **SharePoint-Übernahme (Auswahl und Ordnerlos).** Eine Datei über der Inhaltskante (`zu-gross`)
   machte den Lauf `PARTIAL` ohne Grund am Lauf. Jetzt: `failureCode: SHAREPOINT_CONTENT_TOO_LARGE`
   und ein Satz mit der Anzahl, ohne Dateikennung (`volumengrund` in
   `services/app/src/routes/sharepoint-import-routes.ts`). `leer`/`unlesbar` sind keine Grenze von
   Zeit oder Volumen und bleiben ohne Code. Die HTTP-Ausgänge der Türen (JOB 4232: „kein neuer
   Fehlercode“) sind unverändert; der neue Code steht nur am Lauf.
3. **SharePoint-Übernahme mit Laufbindung.** `createImportCandidates` bekommt jetzt den Lauf
   (`importId` + Position der Kennung), genau wie Confluence `/apply`. Damit hält der Lauf je Datei
   die Quellrevision fest, und die Annahme schreibt die Elementreferenz. Der Dublettenport bleibt
   wie zuvor leer (Register `ALTFAELLE` in `tests/re-import-dubletten/port-aufrufer-waechter.test.ts`
   unverändert zutreffend).

Test: `tests/import-laufprotokoll/abbruchgrund-am-lauf.test.ts` — C1–C3 (Confluence `/apply`:
Grenzgrund, kein erfundener Grund, Kalibrierung ohne Störung), S1–S2 (SharePoint: Volumengrund,
leer ist keine Grenze), S3 (SharePoint: Ergebnisroute nach Annahme mit Element `CREATED`, Objekt
und lesbarer Quellrevision). Gemessen wird jeweils am gespeicherten Lauf über den echten Leseweg.

Die eingefrorenen Dateien des Laufvertrags (FREEZE-144: `library-analytics/index.ts`,
`src/types.ts`, `src/repo.ts`, `src/repo-pg.ts`) sind **nicht** geändert.

## Abgrenzung

- **Gesonderte, bereits gelieferte Teilumfänge**, hier nur wiederverwendet: Laufdomäne und
  Lesewege (AUFTRAG 144/148, W2-A), Ergebnisweg je Wissensobjekt und Laufbindung (R-0142 im Auftrag
  `gesamt-confluence-import`, `docs/bestandsaufnahme-confluence-import.md`), Abbruchcodes des
  Gesamtlaufs (R-0159), Lauf-Kennung in der Bilanz (JOB 3357), Titelbefund (JOB 3356),
  SharePoint-Türen und Inhaltsbefunde (JOB 4086/4232, R-0145/R-0190).
- **Nicht Gegenstand dieses Auftrags:** die gesperrte W2-Resultatfläche
  (`apps/web/src/components/confluence-import/ImportResultView.tsx`, ohne Aufrufer; Block 5 in
  `w2a-import-run-routes-148.test.ts`), Zerlegung einer Seite in mehrere Wissenseinheiten,
  Leserechte je Quellgruppe (Sperre „Variante B“).

## Widersprüche und fehlende Belege

1. **R-0144, Altquelle gegen Bestand.** Die Altquelle (FUNKTIONSREGISTER, 02.08.) sagt „KW-W2-17
   … KEINE IMPLEMENTIERUNG“ und „kein Commit im Produkt-Repo gefunden“. Heute stehen Laufdomäne,
   Ablage, Migration und Lesewege im Repository. Die Aussage ist historisch.
2. **R-0701, „vier getrennte Zugänge ohne gemeinsamen Vertrag“.** Die Quelle (ISTDELTA-07 §2
   Frage 7) nennt die vier Endpunkte nicht namentlich; eine Zuordnung zu den heutigen Routen ist
   deshalb nicht belegbar. Heute gibt es vier lesende Routen (`/runs/:id`, `/runs/:id/result`,
   `/knowledge/:koId`, `/source-records/:id`), aber **einen** Vertrag: alle bauen Lauf, Quelle und
   Element über dieselben drei Funktionen. Die Ergebnisfrage beantwortet `/runs/:id/result`. Ob
   Pedi unter „ein einziger Weg“ zusätzlich das Zusammenlegen der Routen versteht, ist offen.
3. **R-0701, Oberfläche.** Die Weboberfläche liest den Lauf über `/runs/:id` (Zustand, Zähler,
   Grund) und das Ergebnis je Objekt über `/knowledge/:koId`. Die Laufergebnisroute `/result` hat
   keinen Aufrufer in der Oberfläche: die dafür gebaute Fläche ist gesperrt (s. Abgrenzung).
4. **„Jeder Import“ und der JSON-Re-Import.** `POST /api/library/import` und
   `POST /api/library/import/candidates` (JSON-Re-Import direkt bzw. über die Prüfwarteschlange,
   `library-routes.ts`) legen **keinen** Lauf an. Die
   Quelle von R-0144 spricht von der „externen Quelle“ und nennt als Codepfad den
   Confluence-Adapter; ob eine eingespielte Sicherung ein Import im Sinne von R-0144 ist, legt
   sie nicht fest. **Nicht gebaut** — das wäre eine neue Festlegung jenseits der Quelle.
5. **SharePoint-Oberfläche.** Die SharePoint-Fläche zeigt die Lauf-Kennung nicht an, obwohl die
   Antwort sie trägt (`apps/web/src/components/sharepoint-import/api.ts`, Feld `importId`).
   P-IMPORT-REST betrifft ausdrücklich den Confluence-Selektivimport; für SharePoint gibt es dazu
   keinen Quellpunkt. **Nicht gebaut**, hier benannt.
6. **P-IMPORT-REST, Statusangabe der Quelle.** Die Quelle trägt „LIVE 09.09. 07:21:27 — JOB 3357
   R3, Version 1.0.0-beta.1.217, Commit 169be6c5“ mit dem Vermerk „Source claim, not independently
   accepted“. Im Repository stehen die Lieferungen von JOB 3357 und JOB 3356 samt Tests; eine
   erneute Livebeobachtung auf einer laufenden Instanz liegt **nicht** vor und wurde in diesem Lauf
   nicht gemacht. Den Commit `169be6c5` konnte dieser Lauf nicht nachsehen (keine
   Git-Befehle in dieser Sitzung).
7. **PostgreSQL nicht lokal gemessen.** Die Laufbindung des SharePoint-Wegs schreibt in
   `PgExternalSourceRepo` und `PgImportRunRepo` (beide unverändert). Der PG-Weg ist im Bestand durch
   `services/library-analytics/src/repo-pg.integration.test.ts` belegt; für diesen Lauf ist kein
   PG-Lauf bestellt.
8. **Echte Quellsysteme.** Weder eine echte Confluence-Instanz noch ein echter Microsoft-365-Mandant
   wurde angesprochen; Grenzfälle sind über Adapterattrappen gemessen.
