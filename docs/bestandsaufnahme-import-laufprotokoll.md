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
| R-0144 dauerhafter Datensatz zur externen Quelle | Confluence geliefert; **SharePoint Nacharbeit 3, Beleg ausstehend** | `ExternalSourceRecord` (unveränderliche Quellrevision, `types.ts` W2-A), geschrieben beim Einreihen im Namen eines Laufs (`laufbindung.ts`, `LibraryService.bindeAnLauf`) und bei der Annahme (`quellrevisionFestschreiben`); lesbar über `GET /api/admin/import/source-records/:id`. Confluence: `tests/confluence-quellabgleich/r0142-ergebnisweg.test.ts` E1 (grün). SharePoint: gebaut in Nacharbeit 3 (s. „Was dieser Lauf ändert“ 3), Nachweis `tests/import-laufprotokoll/sharepoint-lauf-traegt-quellrevision.test.ts` SP1 und SP2 (zwei Fassungen derselben Minute) — grün an `d4b4deb3` (Sekundenzählung, HISTORIE/nacharbeit-5). |
| R-0144 Quelle und Fassung am Wissensobjekt | Confluence geliefert; **SharePoint Beleg ausstehend** | Herkunftsanker `provider` + `externalId` + `sourceVersion` + `sourceRecordId` + `importRunId` (`buildSource`; R-0142 Lauf 5 R3 B11); `GET /api/admin/import/knowledge/:koId`, Anzeige `apps/web/src/components/bibliothek/ImportErgebnis.tsx`. Confluence: `r0142-ergebnisweg.test.ts` (grün). SharePoint: `tests/sharepoint-inhalt/weg-am-draht-und-neustart.test.ts` W1 war an allen drei bisherigen Kandidaten **rot** (Widerspruch 11) und ist deshalb **kein** Herkunftsnachweis; Nachweis über W1 und SP1/SP2 (Neustart); grün an `d4b4deb3` (HISTORIE/nacharbeit-5). |
| R-0701 ein Weg zum Ergebnis eines Importlaufs | Vertrag geliefert; **SharePoint-Elemente Nacharbeit 3, Beleg ausstehend** | Ein Vertrag, gebaut an einer Stelle: `laufNachAussen` (Lauf), `quelleNachAussen` (Quellrevision), `elementNachAussen` (Element) in `import-run-routes.ts`. Die Ergebnisfrage beantwortet `GET /api/admin/import/runs/:importId/result` quellneutral. Für SharePoint-Läufe lieferte sie bis Nacharbeit 3 `items: []`; mit der Laufbindung nennt sie nach der Annahme Element, Objekt, Ausgang und Revision (SP1; SP2 auch für eine zweite Fassung derselben Minute mit `BOUND`); grün an `d4b4deb3`. |
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
3. **SharePoint-Quellstand passend zur Revisionsidentität (Nacharbeit 3, korrigiert in
   Nacharbeit 4).** Der Mapper zählte die Fassung in Sekunden seit 1970 (heute ≈ 1,79 Mrd.); die
   Revisionsidentität trägt höchstens 999.999.999. Nacharbeit 3 zählte in Minuten — Ben hat
   belegt, dass damit zwei Fassungen derselben Minute zu einem Stand wurden und die zweite als
   „schon vorhanden“ verloren ging. **Jetzt** zählt `sharepointQuellstand`
   (`services/sharepoint/src/mapper.ts`) in **Sekunden seit 2025-01-01T00:00:00Z** (heute
   ≈ 54 Mio.), Zeitpunkte davor als 1. Das ist die volle Auflösung, die Graph liefert, und passt bis
   2056-09-09T01:46:39Z (Nacharbeit 5: zuvor um vier Tage falsch als 09-05 angegeben, gemessen
   und berichtigt). Die eingefrorenen Dateien bleiben unverändert (eine Erweiterung der
   Revisionsidentität verlangte eine Freigabe nach FREEZE-144, die dieser Auftrag nicht hat). Die
   Sollwerte der SharePoint-Tests rechnen exakt dieselbe Vorschrift, keine Prüfung ist gelockert.
   `mapper.test.ts`: Grenze bis 2056 und erste Sekunde darüber (nicht gekappt), gleiche Minute
   = zwei Stände (Abstand 58), vor der Epoche = 1.
4. **SharePoint-Übernahme mit Laufbindung (Nacharbeit 3).** `createImportCandidates` bekommt den
   Lauf (`importId` + Position der Kennung), wie Confluence `/apply`. Damit schreibt das Einreihen
   die Quellrevision und die Annahme die Elementreferenz; `/runs/:id/result` und
   `/knowledge/:koId` lesen sie. Der Dublettenport bleibt leer wie zuvor (Register `ALTFAELLE`).

*Verlauf:* Nacharbeit 1 hatte die Laufbindung zurückgenommen und als Ursache der roten
SharePoint-Fälle benannt — das war falsch (Nacharbeit 2: identisch rot mit und ohne Bindung). Die
tatsächliche Ursache war die Fassung (Widerspruch 9/11); mit Punkt 3 ist die Bindung wieder drin.

Tests: `tests/import-laufprotokoll/abbruchgrund-am-lauf.test.ts` — C1–C3 (Confluence `/apply`:
Grenzgrund, kein erfundener Grund, Kalibrierung ohne Störung), S1–S2 (SharePoint: Volumengrund,
leer ist keine Grenze); grün an drei Kandidaten. `tests/import-laufprotokoll/sharepoint-lauf-traegt-quellrevision.test.ts`
SP1 — echter Adapter und Mapper, realistischer Zeitpunkt, Annahme über die Prüf-Warteschlange,
`/result`, `/source-records`, `/knowledge`, danach echter Neustart aus derselben Journaldatei
(grün an `890b7827` mit Minutenzählung und an `d4b4deb3` mit Sekundenzählung). SP2 (Nacharbeit 4,
Bens Befund) — zwei Fassungen um 09:15:01 und 09:15:59: die zweite wird eingereiht (nicht
„schon vorhanden“), angenommen (`BOUND`, dasselbe Objekt), trägt eine eigene Quellrevision, und
der Anker am Objekt nennt Lauf und Fassung der zweiten; dasselbe nach Neustart (grün an
`d4b4deb3`, HISTORIE/nacharbeit-5).

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
7. **PostgreSQL.** Bis Nacharbeit 2 schrieben die Änderungen nur `failureCode`/`failureReason` über
   `advance`. Seit Nacharbeit 3 landet der SharePoint-Quellstand im PG-Bestand; die Gegenprobe
   `tests/sharepoint-inhalt-gesamtweg/gesamtweg-pg-im-browser.integration.test.ts` (PG + Chromium)
   war an `890b7827` (Minutenzählung) und an `d4b4deb3` (Sekundenzählung) grün.
8. **Echte Quellsysteme.** Weder eine echte Confluence-Instanz noch ein echter Microsoft-365-Mandant
   wurde angesprochen; Grenzfälle sind über Adapterattrappen gemessen.
9. **SharePoint-Fassung gegen Revisionsidentität — technisch aufgelöst (Nacharbeit 3/4).**
   SharePoint führte als `sourceVersion` Unix-Sekunden (z. B. `1789029000`); die Quellrevision
   erlaubt höchstens `MAX_SOURCE_VERSION = 999_999_999` (`library-analytics/src/repo.ts`, in PG
   `^[0-9]{1,9}$`; FREEZE-144). Bis Nacharbeit 2 stand hier, das sei eine Entscheidung außerhalb
   des Auftrags; Ben hat zu Recht festgehalten, dass dafür weder eine externe Voraussetzung noch
   eine Entscheidungssperre in der Quelle belegt ist. Gewählt ist die Lösung ohne Eingriff in den
   eingefrorenen Vertrag. Nacharbeit 3 zählte in Minuten; das hob Ben in Nacharbeit 4 zu Recht
   auf (gleiche Minute = gleicher Stand, die zweite Fassung ging verloren). Jetzt: Sekunden seit
   2025-01-01 (s. „Was dieser Lauf ändert“ 3; Nachweis SP2 und `mapper.test.ts`). **Grenzen:**
   (a) zwei Änderungen in derselben SEKUNDE sind schon an der Quelle nicht unterscheidbar (Graph
   nennt Sekunden); (b) ab 2056-09-09T01:46:40Z liegt der Stand über der Revisionsgrenze und wird
   vom Kern abgewiesen, nicht gekappt — eine dauerhafte Lösung darüber hinaus verlangt die
   Erweiterung der Revisionsidentität mit Freigabe nach FREEZE-144; (c) Zeitpunkte vor 2025 werden
   zu 1 — unschädlich, weil SharePoint `lastModifiedDateTime` serverseitig setzt und jede spätere
   Änderung nach dem ersten Import liegt; (d) sollte es SharePoint-Anker oder offene Kandidaten
   mit einem Sekunden-seit-1970-Stand geben, liegt deren Stand über jedem neuen Stand, und ein
   späterer Import derselben Datei gälte nicht als neuer. Unter dem Anker-Strang sind solche
   Bestände seit der Fassungsprüfung im Kern nicht entstanden (Widerspruch 11); ob es ältere gibt,
   ist ohne Produktionszugriff nicht feststellbar. Minuten-Stände aus Nacharbeit 3 wurden nicht
   ausgeliefert.
10. **Fremde Basisfehler im Wächter `services/app/src/build-app.test.ts`.** Am Kandidaten rot:
   Fehlerklassen `HaengendeSitzungError`, `LmsExportError` und zwölf Codes (u. a.
   `ATTACHMENTS_NOT_INCLUDED`, `SCHUTZDATEN`, `TOO_MANY_SOURCES`) aus `services/db-tx`,
   `services/output` u. a. fehlen auf den Loglisten. Keiner stammt aus dieser Lieferung; der
   Wächter ist unverändert und aus dieser Prüfauswahl herausgenommen.
11. **Fremder Basisfehler: SharePoint-Übernahme mit echten Fassungen.** Bei eingeschaltetem
   SharePoint-Import (Anker-/Upsert-Strang) prüft der Import-Kern jede Ankerfassung vor dem Einreihen
   gegen `MAX_SOURCE_VERSION = 999_999_999` (`pruefeAnkerEintrag`,
   `services/library-analytics/src/service.ts`, NACHARBEIT 2 / bens F5). Der SharePoint-Mapper setzt
   die Fassung als Unix-Sekunden (`services/sharepoint/src/mapper.ts`, JOB 4086), heute rund
   1,79 Mrd. Jede solche Datei endet deshalb als `failed` mit `LibraryError`; rot sind 25 Fälle in
   `tests/sharepoint-inhalt/weg-am-draht-und-neustart.test.ts`,
   `tests/sharepoint-onedrive-import/{erster-weg,wiederholimport,ordner-in-losen}-am-draht.test.ts`.
   Der betroffene Aufruf war zeichengleich mit dem Ausgangsstand; das Bild war an zwei Kandidaten
   mit und ohne Änderung dieses Auftrags identisch. **Nacharbeit 3:** dieselbe Ursache wie
   Widerspruch 9 und mit demselben Schritt behoben (Quellstand passend zur Revisionsidentität;
   seit Nacharbeit 4 Sekunden seit 2025). Die 25 Fälle sind wieder in der Prüfauswahl — als
   Gegenprobe, nicht mehr als fremder Basisfehler; an `890b7827` grün. Ihre Sollwerte rechnen
   dieselbe Vorschrift; sonst sind sie unverändert.
