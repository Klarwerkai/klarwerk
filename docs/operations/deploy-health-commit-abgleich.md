# Abgleich: Deployment-Commit ↔ `/health.commit` (Auftrag deploy-health-commit)

Stand 29.09.2026, Lauf `deploy-health-commit:4` (setzt Lauf 3 ab `cd688810` fort; Code unverändert,
nur Messung 7 ergänzt). Lauf 3 übernahm den Kandidaten
`9a8986c2` aus Lauf 2 (B1–B7, R-0786, R-1028) unverändert auf `1530dfeb` und schloss Bens
Befund B8 (R-0794, siehe unten). Server und Coolify wurden in keinem dieser Läufe verändert.

## Ergebnis

- **Commitkette für zwei reguläre Auslieferungen geschlossen** (Betreibernachweis 29.09.,
  Messungen 4 und 5): Coolify-Deployment-Commit = Build-Argument `SOURCE_COMMIT` = `/health.commit`
  = `github/main`, jeweils voller SHA, bei zwei verschiedenen aufeinanderfolgenden Commits.
- **Zuführungsweg belegt:** „Include Source Commit in Build“ ist seit 27.09.2026T21:55:29Z aktiv;
  der Buildbefehl übergibt `--build-arg SOURCE_COMMIT`, der Dockerfile legt ihn in
  `KLARWERK_BUILD_COMMIT` ab. Kein manueller Override `SOURCE_COMMIT`/`KLARWERK_BUILD_COMMIT` in den
  Nutzervariablen, kein statischer Hash. Der Laufzeit-Alias aus R-1610 wird damit nicht gebraucht.
- **Kein Konfigurationsvorschlag.** Es gibt keine Abweichung. Der K4-Befund „`unbekannt`“ gilt nur
  für den historischen Stand `.616`/`.618` vor der Aktivierung.

## Messungen 4 und 5 (Betreibernachweis 29.09.2026, in diesem Lauf nicht wiederholt)

Quelle: Betreiber-Nachprüfung (Codex-Führung, Kennung `01a0eb78`), Originale außerhalb des
Repositorys unter `klarwerk_steuerung/gespraech/neuaufbau-durchfuehrung-20260922/nachfolger-01a0eb78/COOLDOWN-COMMIT-20260929/`
(`BETREIBERNACHWEIS.json`, `COOLIFY-FOLGEDEPLOY-0628.json`, `HEALTH-FOLGEDEPLOY-0628.json`).
Dieser Lauf hat die Coolify-Angaben nicht selbst gelesen (kein Betreiber-Token).

| Messung | Coolify-Deployment | Status / Commit | Abfragezeit `/health` (UTC) | `/health` |
|---|---|---|---|---|
| 4 | `hagoyyb43hw6ums4fwyqxx0i` (Build 28.09.T15:51:30Z) | `finished`, `41fad46caa4e24863bd1882feeadca89eaf08e6f` | 29.09.T06:04Z | `ok`, `1.0.0-beta.1.627`, `41fad46caa4e24863bd1882feeadca89eaf08e6f` |
| 5 | `c2bnxbtjqmt3790remmmxap7` (06:10:37Z–06:12:07Z) | `finished`, `1530dfeba1576b674e15d3bbef4786072ec3936d` | 29.09.T06:35:18Z | HTTP 200, `ok`, `1.0.0-beta.1.628`, `1530dfeba1576b674e15d3bbef4786072ec3936d` |

Früher belegt: `.623` / `8bc3b5bad1591446795ea9010e8562975ff9c8f6` (Deploy
`u1264vhhfs15i28wx0fivk5u`, Erstbeleg 27.09.T23:11Z).

## Messung 6 (dieser Lauf, öffentlich, ohne Geheimnis)

| Glied | Wert | Herkunft |
|---|---|---|
| Abfragezeit | 2026-09-29T06:55:30Z | `date -u` vor/nach, Server-Header `date: Tue, 29 Sep 2026 06:55:30 GMT` |
| HTTP-Antwort | `HTTP/2 200`, `{"status":"ok","version":"1.0.0-beta.1.628","commit":"1530dfeba1576b674e15d3bbef4786072ec3936d"}` | `curl -sS -i https://app.klarwerk.ai/health` |
| Gepushter Stand | `refs/heads/main` = `1530dfeba1576b674e15d3bbef4786072ec3936d` | `git ls-remote github refs/heads/main` |

Messung 6 stimmt mit Messung 5 überein. Die Live-Antwort trägt noch keine `ai`/`aiRuns`-Felder;
die liefert erst diese Fassung (R-0794) nach ihrer Auslieferung.

## Messung 7 (Lauf 4, öffentlich, ohne Geheimnis)

| Glied | Wert | Herkunft |
|---|---|---|
| Abfragezeit | 2026-09-29T20:12:44Z | `date -u` vor/nach, Server-Header `date: Tue, 29 Sep 2026 20:12:44 GMT` |
| HTTP-Antwort | `HTTP/2 200`, `{"status":"ok","version":"1.0.0-beta.1.632","commit":"8f0ec01ce491a951689bed0ff82b09fdd92d1a1e"}` | `curl -sS -i https://app.klarwerk.ai/health` |
| Gepushter Stand | `refs/heads/main` = `8f0ec01ce491a951689bed0ff82b09fdd92d1a1e` (`ship: 1.0.0-beta.1.632`, Autor `KLARWERK-Steuerung`) | `git ls-remote github refs/heads/main`; lokales Reflog: Push 2026-09-29 21:26:29 +02:00 |
| Deployment-Datensatz | nicht gelesen | Coolify-API (Betreiber-Token) — in diesem Lauf nicht verfügbar |

Dritter verschiedener regulärer Stand mit vollem `/health.commit` = `github/main` (nach `.627`,
`.628`). Ohne Deployment-Datensatz schließt Messung 7 die Kette nur HTTP ↔ Push, nicht
Deployment ↔ HTTP. Der Kandidat dieses Auftrags (`4321f460`…`cd688810`) ist **nicht** Vorfahr
von `8f0ec01c`; daher trägt `/health` live weiterhin keine `ai`/`aiRuns`-Felder.

## Vorige Fassung (Lauf 2): Ausgangslage vor dem Betreibernachweis

## Messung 3 (`.627`, Lauf 2)

| Glied | Wert | Herkunft | Status |
|---|---|---|---|
| Abfragezeit | 2026-09-29T04:32:15Z und 2026-09-29T04:32:57Z (UTC) | `date -u` direkt vor/nach dem Abruf; Server-Header `date: Tue, 29 Sep 2026 04:32:57 GMT` | belegt |
| HTTP-Antwort | `HTTP/2 200`, `{"status":"ok","version":"1.0.0-beta.1.627","commit":"41fad46caa4e24863bd1882feeadca89eaf08e6f"}`, bei beiden Abrufen gleich | `curl -sS https://app.klarwerk.ai/health`, öffentlich, ohne Geheimnis | belegt |
| Gepushter Stand | `refs/heads/main` = `41fad46caa4e24863bd1882feeadca89eaf08e6f` | `git ls-remote github refs/heads/main` am 29.09.; lokales Reflog: Push 2026-09-28 17:51:12 +02:00 | belegt |
| Commit-Inhalt | `ship: 1.0.0-beta.1.627`, Autor `KLARWERK-Steuerung`, ändert `apps/web/src/version.ts` und `package.json` | `git show --stat 41fad46c` | belegt |
| Deployment-Datensatz | UUID, Status `finished`, Commit, Zeit des Coolify-Deployments zu `41fad46c…` | Coolify-API (Betreiber-Token) | **fehlt** |
| Commit-Zuführung | `--build-arg SOURCE_COMMIT=…` im Build-Protokoll oder Laufzeitvariable in Coolify | Coolify-Einstellung/Build-Protokoll | **fehlt** |

## Frühere Messungen (Quelle: Lauf `deploy-health-commit:1`, Commit `d8274680`, nicht in `main`)

| Messung | Abfragezeit (UTC) | `/health` | `github/main` (Push) |
|---|---|---|---|
| 1 | 2026-09-28T14:27:37Z, 14:28:37Z | `1.0.0-beta.1.625`, `267ad7895c7b90a0faf5586d6d617e128b14ddc5` | `267ad789…` (Push 2026-09-28 14:01:07 +02:00) |
| 2 | 2026-09-28T14:51:01Z | `1.0.0-beta.1.626`, `6430e9754505dd9f49279f96ad10f5b447d50895` | `6430e975…` (Push 2026-09-28 16:33:16 +02:00) |

Die Push-Zeiten sind im lokalen Reflog `refs/remotes/github/main` dieses Arbeitsbaums nachlesbar.
Die HTTP-Antworten selbst stammen aus dem ungemergten Lauf 1 und wurden hier nicht wiederholt.

## Quellenwiderspruch und Einordnung

- K4-Befund 27.09.2026T00:09Z: Deployment `vy40vfkowgiieauluukiakmm` zu `ba989208…` (`.616`),
  „Include Source Commit in Build“ **aus**, kein `SOURCE_COMMIT` im Buildbefehl, `/health` meldet
  `unbekannt`. K4-Nachprüfung 27.09.T02:15Z: für `.618` (`94dbf348…`) weiter kein voller Commit.
- Ab `.625` (28.09.) meldet `/health` den vollen Commit. Der Dockerfile ist seit `9daf5005`
  (02.09.) unverändert, `buildCommit()` liest weiterhin nur `KLARWERK_BUILD_COMMIT`. Die Änderung
  liegt also **außerhalb des Repositorys**, vermutlich in der Coolify-Konfiguration. Wer sie wann
  vorgenommen hat und welcher der beiden Wege nun aktiv ist, ist **unbelegt**.
- Ein `lage.json`-Ship-Commit ersetzt keinen dieser HTTP-Belege; die HTTP-Belege ersetzen weder
  Deployment-Datensatz noch Zuführungsnachweis.

## Nachprüfweg (Lauf 2; Schritte 1–3 durch den Betreibernachweis vom 29.09. erledigt, s. oben)

1. In Coolify, Anwendung `b3rgijsv5jtuhreh9ypyjase`, ablesen: Ist „Include Source Commit in Build“
   aktiv? Ist eine Laufzeitvariable `KLARWERK_BUILD_COMMIT` gesetzt, und womit (Alias wie
   `$SOURCE_COMMIT` oder fester Wert)? Nicht beide Wege gleichzeitig ändern, keinen statischen Hash
   eintragen.
2. Den Deployment-Datensatz zu `41fad46c…` sichern (UUID, Status, voller Commit, Zeit) und im
   Build-Protokoll die tatsächliche Übergabe nachweisen.
3. Mit Messung 3 vergleichen. Sind Deployment-Commit, Zuführung und `/health.commit` gleich, ist die
   Kette für diese Auslieferung geschlossen. Weicht ein Glied ab (z. B. fester Wert in
   `KLARWERK_BUILD_COMMIT`), ist das der betroffene Konfigurationspunkt; Korrektur dann nach dem
   K4-Vorschlag: Source-Commit-Buildübergabe aktivieren, festen Wert entfernen, nach dem nächsten
   gebundenen Deploy HTTP-Commit exakt gegen den vollen Deployment-Commit prüfen und mit einem
   zweiten regulären Commit wiederholen.

## Geliefert in dieser Fassung

### R-0786: Lieferweg bestätigt nur den neuen, gesunden Stand

Grundlage ist der ungemergte Kandidat von Lauf 1 (`d8274680`; die Skripte waren seit dessen Basis
`6430e975` unverändert), in Runde 3 nach Bens Befunden B5–B7 verschärft.

- `scripts/deploy/klarwerk-live-update.command` verlangt den vollen erwarteten Commit (Argument
  oder `KLARWERK_ERWARTETER_COMMIT`), sonst wird nicht deployt (Exit 1).
- **GELIEFERT (Exit 0)** nur, wenn alle drei Glieder derselben Auslieferung genau übereinstimmen:
  Deployment-Status ist genau `finished`, Coolify nennt für dieses Deployment genau den erwarteten
  **vollen** Commit (40 Hex), und `/health` meldet mit HTTP 200 `"status":"ok"` und genau diesen
  Commit. Antworten werden strukturell mit `node` gelesen.
- **Status (B5):** anerkannt werden nur die vollständigen Coolify-v4-Werte `finished`, `failed`,
  `cancelled-by-user`, `queued` und `in_progress`. Jeder andere Wert (z. B. `not_finished`,
  `success`, `done`) bleibt unklar — keine Teilwortsuche mehr.
- **Deployment-Commit (B6):** fehlt er, ist er verkürzt oder kein Commit (z. B. `HEAD`), gibt es
  keine Lieferbestätigung. Passt dann nur `/health`, meldet das Skript **TEILNACHWEIS** (Exit 2):
  Die Kette Deployment → HTTP ist nicht geschlossen.
- **AUSFALL (Exit 1)** bei `failed` oder `cancelled-by-user`; die frühere Meldung „kein Ausfall“
  ist entfernt. **NICHT GELIEFERT (Exit 2)** in allen übrigen Fällen.
- `scripts/deploy/klarwerk-ship.command` reicht `git rev-parse HEAD` weiter und bricht bei jedem
  Exit ungleich 0 vor „LIVE fertig“ mit diesem Exitcode ab.
- Beleg: `tests/deploy-liefernachweis/live-update-liefernachweis.test.ts` (40 Fälle). Das
  Live-Update läuft mit Platzhaltern für `curl`, `security`, `sleep`; das Ship-Skript läuft
  vollständig gegen ein Wegwerf-Repo unter eigenem `HOME` mit einem protokollierenden `git`-Platzhalter.
  Kein Netz, kein Deploy, kein echtes Git.
- **Offener Betreiberpunkt:** Ob Coolify v4.1.2 im Deployment-Datensatz tatsächlich den vollen
  Commit führt (und nicht z. B. `HEAD`), ist nicht gemessen. Führt er ihn nicht, meldet das Skript
  ehrlich TEILNACHWEIS statt GELIEFERT; das ist dann am Deployment-Datensatz zu klären (Nachprüfweg,
  Schritt 2), nicht im Skript aufzuweichen.
- Grenzen: „Sofort gemeldet“ heißt Terminal und Exitcode; einen Alarmkanal (Push, Mail) gibt es
  nicht. Der Lieferweg der externen Steuerung (`ship:`-Commits, B3-Veröffentlichung) liegt
  außerhalb des Repositorys; ob er R-0786 erfüllt, ist ungeklärt. Ein echter Lauf gegen Coolify
  fand nicht statt.

### R-1028: eine Programmversion für Word-Panel und Web-Konsole

Tatsächliche Versionswege (vor dieser Fassung, am Code von `41fad46c`):

| Ort | Was sichtbar ist | Quelle |
|---|---|---|
| Web-Topbar / Zahnradmenü | `1.0.0-beta.1.627` | `APP_VERSION`, `apps/web/src/version.ts` |
| `/health.version` | `1.0.0-beta.1.627` | `package.json` (`buildVersion()`); Gleichlauf mit `version.ts` erzwingt `tests/app/health-version-commit.test.ts` |
| Word-Panel, Fuß „Klara <Stand>“ (`#kw-stand`) | Bauzeit + Git-Kürzel, **keine** Programmversion | Build-Plugin `klara-stand`, `apps/web/vite.config.ts`, ersetzt `__KLARA_STAND__` in `apps/web/public/word-addin/taskpane.html` |
| Word-Panel, Fassungszeile (`#kw-fassung`) | „Stand 1.0.0.1 · aktuell“ | `KLARA_TASKPANE_FASSUNG` in `services/app/src/web-static.ts`, beim Ausliefern gestempelt (`registerWebStatic(app, dist)`, `services/app/src/server.ts:66`); = `<Version>` im Manifest `docs/word-addin/klara-manifest.xml` |

Die Runde-1-Aussage „das Word-Panel zeigt keine Version“ war falsch: Sie stützte sich auf
`services/app/addin-static`, das Manifest adressiert aber `/word-addin/taskpane.html`. Dort
behauptete die Fassungszeile einen zweiten „Stand“ (`1.0.0.1`) neben der Web-Version.

Geändert:

- Das Build-Plugin `klara-stand` stempelt jetzt `APP_VERSION` — dieselbe Konstante wie die Web-Topbar —
  vorn in „Klara <Stand>“: `1.0.0-beta.1.627 · <Bauzeit>Z · <Git-Kürzel>`
  (Text aus `apps/web/src/lib/klaraStand.ts`).
- Die Fassungszeile heißt jetzt „Add-in-Fassung / Add-in version / Add-in-versie {n}“ statt
  „Stand/Build {n}“. Die Nummer bleibt: Office verlangt im Manifest vier Zahlen, sie steuert den
  Office-Cache und den Fassungswechsel (JOB 1077). Sie ist keine Programmversion und behauptet
  keine mehr. Inhalts-Pin in `tests/app/mega69-klara-waechter.test.ts` mit Begründung nachgezogen.
- `klarwerk-ship.command` hebt `package.json` im selben Schritt wie `version.ts` an (vorher nur
  `version.ts`). Trägt `package.json` nicht genau einmal die bisherige Nummer, bricht es **vor
  jedem Schreiben** ab; es gibt kein `git checkout` mehr, vorhandene Arbeitsänderungen bleiben
  erhalten (B7). Geändert wird nur die Versionszeile, portabel mit `sed -i.kwbak`.
- Beleg: `tests/deploy-health-commit/eine-programmversion.test.ts` führt das **echte** Plugin aus
  `vite.config.ts` aus und prüft `APP_VERSION` im gestempelten Panel; zusätzlich ein echter
  `npx vite build --outDir /tmp/kw-r1028-build` am 29.09.: Panel
  `var KLARA_STAND = "1.0.0-beta.1.627 · 2026-09-29 04:54Z · b49b9d3f"`, Web-Bundle enthält
  `1.0.0-beta.1.627`.
- Grenze: Physisch gibt es weiter zwei Dateien mit derselben Nummer (`version.ts` für die Oberfläche,
  `package.json` für `/health`), gekoppelt durch Skript und Wächter-Test. Angezeigt wird in Web und
  Word dieselbe Konstante. Ein Browser-/Word-Sichtnachweis wurde nicht geführt.

### R-0794 / Ben B8: eine feste Adresse für Laufzustand, KI, Version und Stand (Lauf 3)

`GET /health` (öffentlich, ohne Anmeldung) liefert jetzt zusätzlich zu `status`, `version`, `commit`:

- `ai` — derselbe Wert wie `/api/ai-status` (`services.reasoner.publicStatus()`: `active`, `mode`
  `cloud`/`local`/`deterministic`, `reachable`, `tasks`, `billable`, `kiAbgeschaltet`). Keine zweite
  Quelle. Anders als die Statusroute stößt `/health` keinen Erreichbarkeits-Probe an (der
  Container-Healthcheck fragt alle 30 s); `reachable` ist der zuletzt gemessene Stand.
- `aiRuns` — `{ available, recent }` mit den 5 jüngsten Läufen aus dem Laufprotokoll
  (`model-runs`), je Lauf nur `task`, `status`, `mode` (`model`/`deterministic`), `fallback`,
  `finishedAt`. Anbieter, Modell, Fehlertext, Laufkennung, Nutzer, Gegenstand und Verbrauch fehlen
  bewusst (`services/app/src/health-ki-laeufe.ts`).
- Robustheit: Fällt das Laufprotokoll aus oder antwortet es nicht binnen 1,5 s, bleibt `/health`
  HTTP 200 mit `status: "ok"`, nur `aiRuns` wird `{ available: false, recent: [] }`.
- Poolbegrenzung (Ben B9, Runde 2): Die Frist begrenzt nur das Warten, nicht die Datenbankarbeit.
  Deshalb hält `/health` je App-Instanz höchstens **eine** Laufprotokoll-Abfrage im Flug
  (`kiLaeufeAuskunft`): gleichzeitige und folgende Aufrufe hängen sich an die laufende an; eine
  neue startet erst, wenn die vorige zurück ist. Ein hängendes Laufprotokoll belegt damit höchstens
  einen Platz des gemeinsamen Pools (Standard 10), Nachbarabfragen laufen weiter.
  Beleg: `tests/deploy-health-commit/health-pool-begrenzung.test.ts` — echter `pg`-Pool, echtes
  `PgModelRunRepo`, nur der Drahtclient ohne Socket hält `model_runs`-Abfragen zurück. Kalibrierung:
  eine neue Abfrage je Aufruf (Stand Runde 1) füllt den Pool (10/10) und blockiert `SELECT 1`; mit
  der Korrektur: 11 wiederholte Zeitüberschreitungen → 1 Abfrage, 1 Poolplatz, `SELECT 1`
  beantwortet; ebenso über die echte `/health`-Route mit der echten 1,5-s-Frist.
- Serverprozess-Prüffall (Runde 3, Bens Prüfplanlücke zu `3958fa4d`):
  `tests/app/health-gesamtauskunft-pg.integration.test.ts`. Wegwerf-PostgreSQL (`…_test_…`,
  `DROP … WITH (FORCE)`), `services/app/src/server.ts` als eigener Prozess mit nicht geerbter
  Umgebung (`serverUmgebung` aus `tests/gesamtanweisung-nutzerweg/weg.ts`), `NODE_ENV=production`,
  eigener Port, Test-SHA in `KLARWERK_BUILD_COMMIT`, kein Anbieter (deterministisch). Genau ein
  `POST /api/reasoner`-Lauf; sein `model_runs`-Eintrag wird direkt aus PostgreSQL gelesen und muss
  per echtem `GET /health` in `aiRuns.recent` stehen (Aufgabe, Ausgang, Endzeit), dazu `status`,
  `ai.mode`, `version` = `package.json`, `commit` = Test-SHA, kein `provider`/`model`/`id`/`actor`-Feld,
  keine Laufkennung, kein Passwort. Gegenproben: (a) dieselbe Zuordnungsprüfung scheitert an der
  Historie vor dem Lauf; (b) zweiter Prozess ohne `KLARWERK_BUILD_COMMIT` meldet `unbekannt`;
  (c) ohne `KLARWERK_PG_TEST_URL` meldet der Laufzustand ausdrücklich „UEBERSPRUNGEN … NICHT
  belegt“, eine gesetzte, aber unerreichbare Verbindung wirft in `beforeAll`.
  **Auf dem Produktions-Mac nicht gegen PostgreSQL ausgeführt** (Serverregel); lokal belegt ist nur
  Gegenprobe (c). Die Ausführung gegen echtes PostgreSQL steht aus.
- Grenze B9: Die eine hängende Abfrage wird nicht abgebrochen; ihr Poolplatz bleibt belegt, bis
  die Datenbank antwortet oder die Verbindung fällt. Eine Abfragefrist auf Datenbankseite
  (`statement_timeout`/`query_timeout`) gibt es im Pool weiterhin nicht; sie würde alle Module
  betreffen und ist nicht Teil dieses Auftrags.
- Beleg: `tests/deploy-health-commit/health-gesamtauskunft.test.ts` (9 Fälle, u. a. echter
  `POST /api/reasoner`-Lauf erscheint danach in `/health`; Gleichheit mit `/api/ai-status`;
  Feldbeschränkung; Ausfall/Hängen des Protokolls).
- Grenze: live erst nach der nächsten Auslieferung prüfbar; die Postgres-Variante des Protokolls
  (`PgModelRunRepo.recent`) ist hier nur über die In-Memory-Komposition geprüft, nicht gegen eine
  echte Datenbank.

## Stand der zugeordneten Anliegen (29.09.2026, Lauf 3)

| Anliegen | Stand | Beleg / Lücke |
|---|---|---|
| R-0786 Lieferung erst bei neuem Live-Stempel + gesund; Fehlschlag = Ausfall, sofort gemeldet | **im Repository-Lieferweg umgesetzt**, live ungeprüft | siehe oben; externer Steuerungsweg und Alarmkanal offen |
| R-0794 feste Adresse mit Laufzustand, KI-Modus, letzten KI-Läufen, Version, Auslieferungsstand | **im Repository umgesetzt** (Lauf 3), live erst nach Auslieferung | `/health` mit `status`, `version`, `commit`, `ai`, `aiRuns`; siehe Abschnitt R-0794 oben |
| R-0812 Version sichtbar, aus dem Bauvorgang, nie von Hand | **teilweise** | Sichtbar in Web-Topbar und jetzt auch im Word-Panel (`APP_VERSION`), Bauzeit und Git-Kürzel stempelt der Build. Die Nummer selbst zählen Skripte (`klarwerk-ship.command` bzw. die externe Steuerung per `ship:`-Commit), nicht der Docker-Build — „kommt aus dem Bauvorgang“ ist wörtlich nicht erfüllt. |
| R-1028 eine Versionsquelle | **für die Anzeige umgesetzt** | Web und Word zeigen `APP_VERSION`; `/health` liest die gekoppelte Kopie in `package.json`; Add-in-Fassung als eigene Größe benannt (siehe oben). |
| R-1501 Coolify-Argumentname, Deploy-Konfiguration, echtes Image, Live-Antwort | **laut Betreibernachweis belegt** | Argument `SOURCE_COMMIT`, „Include Source Commit in Build“ aktiv, real gebaute und gestartete Images `.627`/`.628` mit passender Live-Antwort (Messungen 4–6). Coolify-Angaben in diesem Lauf nicht selbst gelesen. |
| R-1610 Weg über Laufzeitumgebung prüfen | **nicht mehr nötig** | Der Build-Weg (A) kommt an (Messungen 4/5); kein Laufzeit-Override gesetzt. Nicht beide Wege gleichzeitig. |
| R-2189 ausgelieferten Code eindeutig identifizieren | **belegt** | Deployment ↔ `/health.commit` ↔ `github/main` gleich für `.627` und `.628` (Messungen 4–6); für `.632` `/health.commit` ↔ `github/main` gleich, Deployment-Datensatz nicht gelesen (Messung 7). |
| R-2215 Live, Hauptstand, Abnahme können auseinanderliegen | **belegbar** | Am 29.09.T06:55Z waren Live und `github/main` gleich (`1530dfeb`), am 29.09.T20:12Z ebenso (`8f0ec01c`, Messung 7). Diese Fassung ist nicht Vorfahr davon und nicht live. `/health.commit` und der Liefernachweis machen den Abstand prüfbar. |

Fehlende Prüfmittel (dieser Lauf): eigene Coolify-Einsicht (Messungen 4/5 sind übernommen),
ein Live-Nachweis der neuen `ai`/`aiRuns`-Felder nach Auslieferung, ein Word-/Browser-Sichtnachweis.
