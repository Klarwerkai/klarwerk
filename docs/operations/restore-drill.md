# Restore-Drill — Betriebsanleitung

Ein Backup, das nie zurückgespielt wurde, ist eine Vermutung. Dieser Drill macht daraus eine
Messung: Er prüft die Prüfsumme, spielt in eine **frische, leere** Datenbank zurück,
prüft **jede Tabelle, die das Produkt anlegt**, samt Zeilenzahlen gegen den Dump,
startet Klara dagegen, meldet sich mit einem Konto **aus dem Dump** an, fragt die Auditkette ab,
liest **ein wiederhergestelltes Wissensobjekt samt Beleg und Anhangsinhalt** über die laufende
Anwendung zurück und räumt anschließend alles restlos ab, was er selbst gestartet hat — und nur das.

> **Was sich mit JOB 4097 geändert hat.** Bis dahin prüfte der Drill vier Tabellen (`kos`, `users`,
> `audit`, `objects`) und konnte mit **Exit 0** enden, während die Entwürfe (`drafts`), die Belege
> samt Anhangszuordnung (`ko_evidence`), die Validierungen, die Konfliktvermerke, die
> Import-Kandidaten und die Lesevarianten verloren waren. Besonders `ko_evidence` trifft: dort steht
> die Zuordnung Datei→Wissensobjekt. Ein Restore, der `objects` vollständig zurückbringt, aber
> `ko_evidence` verliert, lässt die Dateien in der Ablage liegen und nimmt ihnen jede Zugehörigkeit
> — und war ein bestandener Drill.

## Der Befehl

```bash
RESTORE_DB=klarwerk_drill_20260817 \
DRILL_LOGIN_EMAIL=controller@example.org \
DRILL_LOGIN_PASSWORT='…' \
./scripts/backup/restore-drill.sh /pfad/zu/backups/klarwerk-20260817T031500Z.dump
```

Optional: `DRILL_PORT` (Vorgabe `3097`), `DRILL_WORKDIR` (Vorgabe: Verzeichnis des Dumps).

**`RESTORE_DB` muss ein eigener Zielname sein.** Der Drill legt ihn an und **weigert sich**, in
eine nicht leere Datenbank zu restaurieren (Exit 20). Er fasst keine Produktionsdatenbank an.

**Die Anmeldefixture braucht `ko.validate`** — Controller oder Admin. `GET /api/audit/verify`
verlangt genau dieses Recht (`services/app/src/routes/audit-routes.ts:19`). Ein gewöhnliches
Konto endete mit 403, und das hätte wie ein Auditbefund ausgesehen. Deshalb hat dieser Fall einen
eigenen Exitcode (61).

## Exitcodes — jeder Fehlschlag ist unterscheidbar

| Code | Bedeutung |
|---|---|
| `0` | Drill bestanden |
| `1` | Aufruf-/Umgebungsfehler (fehlende Variable, fehlendes Werkzeug) |
| `10` | **Sidecar fehlt oder ist kein 64-Hex** — `pg_restore` wird nicht gestartet |
| `11` | **Sidecar stimmt nicht** mit dem Dump überein — `pg_restore` wird nicht gestartet |
| `20` | Zieldatenbank nicht anlegbar oder **nicht leer** |
| `21` | `pg_restore` gescheitert |
| `22` | **Fehlender Bestand**: eine Pflichttabelle fehlt nach dem Restore, oder der Dump führt für sie gar keinen Bestand (kein COPY-Block **und** kein Eintrag im Inhaltsverzeichnis). Alle Namen in einer Meldung |
| `23` | Zeilenabweichung: Tabellenname, `Dump=<Zahl>` und `Datenbank=<Zahl>` |
| `24` | Zeilenzählung nicht messbar: Inhaltsverzeichnis, Datenextraktion, COPY-Format oder SQL-Abfrage fehlgeschlagen; Tabellenname wird genannt |
| `30` | Anwendung wurde nicht lebendig (keine PID-Datei, `/health` ≠ 200) |
| `31` | Startwerkzeug fehlt oder ist nicht ausführbar: `node`, `npx` oder lokal installiertes `tsx` |
| `60` | **Login fehlgeschlagen** — Aufbaufehler, *kein* Auditbefund |
| `61` | **403 bei der Verifikation** — die Fixture hat kein `ko.validate`, Aufbaufehler |
| `62` | **Wissensnachweis: Aufbaufehler** — der Bestand ließ sich nicht befragen, oder Route/Recht antworteten nicht mit 200. *Kein* Befund am Bestand |
| `70` | `linkageBreaks ≠ 0` — echter Kettenbruch |
| `71` | `unresolvedDeviations ≠ 0` — unerklärte Hashabweichung |
| `72` | `uncheckedDeviations ≠ 0` — ungeprüfte Abweichung (Deckel gerissen) |
| `73` | **Wissensnachweis: Befund** — eine Belegzeile zeigt auf eine Anhangskennung, zu der `objects` keine Zeile führt, **oder** das Wissensobjekt, sein Beleg oder der Anhangsinhalt kam nach dem Restore nicht zurück, obwohl die Datenbank sie führt |
| `80` | **Zuordnung oder Reaping fehlgeschlagen** — die PID-Datei nennt einen Prozess außerhalb der eigenen Prozessgruppe, die Abstammung ist nicht feststellbar, oder ein Prozess hat SIGKILL überlebt |

Die Trennung von 60/61/62 gegen 70/71/72/73 ist der Kern: **Ein Aufbaufehler darf nicht wie ein
Befund am Bestand aussehen.**

## Was ausdrücklich KEIN Abnahmekriterium ist

`report.ok` und `serialisationDeviations`.

`ok` ist definiert als `linkageBreaks === 0 && payloadDeviations === 0`. Der Bestand kennt
**erklärbare** Serialisierungsabweichungen: `hashEntry` hasht `JSON.stringify(payload)` in
JS-Einfügereihenfolge, PostgreSQL speichert `jsonb` kanonisch sortiert und liest so zurück
(`services/audit/src/chain.ts`, Forensik 25.07.2026 — 871 Einträge, 0 Kettenbrüche, 182
Nutzdatenabweichungen, davon 182 durch reine Schlüsselumordnung reproduziert).

Ein Drill, der `ok === true` verlangte, wäre auf dem echten Bestand **dauerhaft rot** — ohne dass
am Restore irgendetwas falsch wäre. Er hätte wie ein Restore-Fehler ausgesehen und war keiner.
Die drei gebundenen Zähler sind genau die Regel, die das Produkt seinen Nutzern schon zeigt
(`apps/web/src/lib/auditVerifyState.ts:40-56`: grün bei `ok`, **gelb** wenn kein Kettenbruch und
jede Abweichung erklärt ist).

## Stub-Evidenz und echte Evidenz — die Grenze

| Träger | Was er belegt | Braucht Docker |
|---|---|---|
| `tests/backup-drill/tabellensatz.test.ts` | Die Bindung des Pflichtsatzes an die Migration: jede Tabelle aus `schemas` steht in `PFLICHTTABELLEN` — und eine simulierte neue Schema-Stufe ohne Eintrag im Drill wird erkannt | nein |
| `tests/backup-drill/restore-drill.test.ts` | PATH-Stubs: Sidecar vor jedem Restore, leeres Ziel, der volle Pflichtsatz, Dumpabgleich (auch der Fall „kein Bestand für `ko_evidence`" und der Zeilenverlust in `drafts`), Startaufruf, Login-/Audit-/Wissensnachweis-Codes, die drei Antworten mit bloßem Textvorkommen der Kennung, die verwaiste Belegzeile und das Abweisen einer fremden PID | nein |
| `tests/backup-drill/start-identitaet.test.ts` | Echtes `npx tsx`: Launcher-PID und TypeScript-Prozess-PID sind verschieden | nein |
| `tests/backup-drill/prozesszuordnung.test.ts` | Echter Prozessbaum (echtes `npx`, `tsx`, `node`, `curl`, `ps`): der Drill trifft den Prozess, der wirklich horchte, räumt die ganze Gruppe ab und gibt den Port frei; eine fremde PID in der PID-Datei endet mit 80, und der fremde Prozess lebt danach noch | nein |
| `tests/backup-drill/echter-wiederanlauf.integration.test.ts` | Echter Custom-Dump aus `backup.sh` → echte, leere PostgreSQL → laufende Anwendung → dieselbe hochgeladene Datei Byte für Byte zurück; dazu die drei Gegenproben am echten Bestand: Anhang unbrauchbar (73), gar kein Beleg (nicht gemessen), Belegzeile ohne ihren Anhang (73) | **ja** (oder eine lokale PostgreSQL, s. u.) |
| `tests/backup-drill/waechter-echte-pg.integration.test.ts` | Die Wächter an derselben echten Strecke (unveränderte Skripte, echte Anwendung): URL-Regel der Suite (nur Namen mit `test`); `backup.sh` gegen eine nicht vorhandene Datenbank und mit einer nicht vorhandenen Rolle — nichts veröffentlicht, Spur „fehler", kein Kennwort in der Ausgabe; Drill mit nicht vorhandener Rolle → 20 vor `pg_restore`; **vorzeitig sterbende Anwendung** nach echtem Restore → 30, Gruppe leer, Port frei; **SIGTERM-taube Anwendung** → der Drill besteht, die zweite Stufe (SIGKILL) räumt die Gruppe restlos ab | **ja** (wie oben) |

Die drei zuvor genannten Dateien unter `tests/operations/` existieren im aktuellen Arbeitsbaum
nicht; auch die Suche im Testbestand findet keinen umgezogenen Drill-Träger.

**Der Stub-Lauf ist kein Datenbank- oder Startnachweis.** Er ersetzt externe Befehle und belegt
Aufrufreihenfolge und Entscheidungen des echten Shellskripts. Der Startstub schreibt seine eigene
PID und bildet die zusätzlichen Prozesse von `npx tsx` nicht ab; diese Grenze messen die beiden
Träger darunter.

So wird der vollständige Lauf an einem echten Custom-Dump gestartet — der Datenbankname **muss**
`test` enthalten, sonst weist ihn `services/db-tx/src/pg-test-guard.ts` ab:

```bash
KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
  npx vitest run --config vitest.integration.config.ts \
  tests/backup-drill/echter-wiederanlauf.integration.test.ts
```

Ohne `KLARWERK_PG_TEST_URL` nimmt die Suite eine Container-Laufzeit (Testcontainers,
`postgres:16-alpine`). Fehlt beides — oder fehlen `pg_dump`, `pg_restore`, `psql`, `createdb`
oder `ps` auf dem PATH —, meldet sie den Grund **sichtbar auf stderr** und überspringt. Ein
stiller Skip sähe aus wie ein bestandener Lauf. **Stand 14.09.2026: In der Prüfumgebung dieses
Auftrags war weder eine PostgreSQL noch eine Container-Laufzeit vorhanden; der PG-Lauf wurde
NICHT ausgeführt.** Was dort trägt, ist `prozesszuordnung.test.ts`.

## Der Pflichtsatz der Tabellen — eine Wahrheit, kein zweiter Pflegeort

Die Liste steht **einmal**, im Skript selbst: `PFLICHTTABELLEN` in
`scripts/backup/restore-drill.sh`. Sie ist hier **bewusst nicht abgeschrieben** — eine dritte
Abschrift von rund vierzig Namen wäre der nächste Pflegeort, der still ausläuft. Stattdessen ist sie
an die Migration **gebunden**: `tests/backup-drill/tabellensatz.test.ts` liest die
`CREATE TABLE`-Anweisungen aus den DDL-Stufen, die `migrate()` wirklich fährt
(`services/app/src/db.ts`, exportierte Liste `schemas`), und hält sie gegen `PFLICHTTABELLEN`.

**Kommt eine Migration dazu und der Drill wird nicht erweitert, ist das Tor rot.** Die Lücke, die
diesen Abschnitt nötig gemacht hat, kann so kein zweites Mal entstehen.

## Zeilenabgleich und Anwendungsstart

Nach dem Restore sammelt das Strukturgate **alle** fehlenden Pflichttabellen in einer Meldung
(Exit 22). Für jede vorhandene Tabelle extrahiert
`pg_restore --data-only --schema=public --table=<tabelle> -f - "$DUMP"` die COPY-Daten aus dem
Archiv. Der Drill zählt ausschließlich deren Datenzeilen und vergleicht sie mit
`SELECT count(*) FROM public.<tabelle>` in der Ziel-DB, **vor** dem Anwendungsstart.
Er gibt jedes gemessene Paar als `<tabelle>: Dump=<Zahl> Datenbank=<Zahl>` aus; auch `0 = 0` gilt.
Abweichungen enden mit Exit 23 samt beiden Zahlen. Doppelte, unvollständige oder nicht lesbare
COPY-Blöcke und fehlgeschlagene SQL-Zählungen sind Exit 24; fehlende Daten werden nie als 0 ausgelegt.

**Kein COPY-Block heißt nicht „leere Tabelle".** Der Drill liest einmal das Inhaltsverzeichnis des
Archivs (`pg_restore --list`) und entscheidet daran:

* Die Tabelle steht mit einem Datenblock (`TABLE DATA public <name>`) darin → der fehlende
  COPY-Block ist eine **gemessene 0**.
* Sie steht **nicht** darin → der Dump führt für sie **überhaupt keinen Bestand**, und das ist
  **Exit 22**, kein stilles Grün. Dieser Fall entsteht real durch `pg_dump --exclude-table-data`,
  durch einen Teilverlust oder durch einen Dump aus einer älteren Fassung des Produkts, die die
  Tabelle noch nicht kannte. Ohne diese Unterscheidung stünde die Tabelle nach dem Restore leer da,
  die Zählung läse 0 = 0, und der Drill wäre grün.

Ein Dump aus einer älteren Version endet damit **absichtlich** mit Exit 22 und nennt die Tabelle.

Der Startbefehl lautet wie im Produktionsimage `npx tsx services/app/src/server.ts`.
Der Drill prüft vorher `node`, `npx` und das lokale `tsx` ohne Paketdownload (Exit 31).

## Der Nutzennachweis: ein Objekt, ein Beleg, ein Anhang — durch die laufende Anwendung

Eine gleiche Zeilenzahl ist **kein** Inhaltsbeleg. Eine Tabelle kann vorhanden, gleich lang und
trotzdem unbrauchbar sein. Nach der Auditkette geht der Drill deshalb zwei Schritte.

**Erst der Bestandsscan über alle Belegzeilen.** Jede Zeile in `ko_evidence`, die zu einem lebenden
Wissensobjekt gehört und eine `objectId` trägt, muss ihren Anhang in `objects` auch finden. Fehlt
er, ist das ein **Befund (Exit 73)**; der Drill nennt die Zahl der betroffenen Zeilen und ein
Beispiel (`<Wissensobjekt> <Anhang>`). Diese Lücke sieht **keine** Zählung: `ko_evidence` und
`objects` können beide so lang sein wie im Dump, und die Verbindung dazwischen ist trotzdem weg.

> **Was hier nicht gefiltert wird — und warum das der Punkt ist.** Die Auswahl darf verwaiste
> Belegzeilen nicht überspringen. Täte sie es und wäre eine solche Zeile die einzige, meldete der
> Drill „kein Wissensobjekt mit Beleg im Bestand — nicht gemessen": Der schlimmste Fall sähe aus wie
> der harmloseste. **Ehrlichkeitsgrenze:** Trüge schon die *Quelle* des Dumps diese Lücke, endete
> der Drill ebenso mit 73 — er vergleicht den wiederhergestellten Bestand, nicht die Gesundheit der
> Quelle. Heute entsteht eine solche Zeile im Produkt nicht von selbst: kein Weg entfernt ein Objekt
> (`services/object-store/src/service.ts`), und mit einem endgültig gelöschten Wissensobjekt
> verschwinden seine Belegzeilen mit.

**Dann wird ein Objekt wirklich gelesen.** Der Drill nimmt die erste Belegzeile mit `objectId`
(ungefiltert) und holt sie über die laufende Anwendung zurück:

1. `GET /api/kos/<id>/evidence` — in der Antwort muss **genau der Belegdatensatz** stehen, den die
   Datenbank genannt hat (dieselbe `id`), und **sein** Feld `objectId` muss **genau** die Kennung
   aus der Datenbank sein.
2. `GET /api/objects/<id>/raw` — der Anhangsinhalt muss mit 200 und **mit Bytes** kommen.

> **Ein Textvorkommen ist keine Zuordnung.** Bis zur Prüfung dieses Auftrags suchte Schritt 1 die
> Kennung mit `grep` irgendwo in der Antwort. Damit bestanden drei Antworten, die *keine* Zuordnung
> tragen: die Kennung als Teil einer **anderen** `objectId`, die Kennung nur im `label`, und die
> Kennung an einem **fremden** Belegdatensatz. Die Antwort wird deshalb als JSON gelesen und Feld
> für Feld verglichen (Datensatz-`id`, dann `objectId`), nicht durchsucht. Ist sie keine lesbare
> JSON-Liste, ist das ein **Aufbaufehler (62)** — kein Befund.

Beide Routen verlangen `ko.read`; die Anmeldefixture trägt ohnehin `ko.validate` und damit `ko.read`
(`services/rbac/src/policy.ts:15-17`) sowie die Sicht auf jede Vertraulichkeitsstufe
(`services/app/src/sichtbarkeit.ts:71-72`). Ein `404` ist an dieser Stelle deshalb **kein**
Rechtefall, sondern ein Befund: Die Datenbank führt das Objekt, die Anwendung findet es nicht.

**Führt der Bestand gar kein Wissensobjekt mit Beleg, ist das kein Fehlschlag — und kein Erfolg.**
Der Drill schreibt dann wörtlich `kein Wissensobjekt mit Beleg im Bestand — dieser Punkt wurde
NICHT gemessen.`, und die Abschlusszeile `Wissensnachweis: …` trägt denselben Satz. Die starke
Aussage („Beleg und Anhang zurück") steht nur da, wo sie wirklich gemessen wurde. Dieser Satz
bedeutet **kein Beleg vorhanden** — ein vorhandener Beleg ohne seinen Anhang ist der Befund
darüber (73), nicht dieser Fall.

## Was ein bestandener Drill belegt — und was weiterhin nicht

**Er belegt:** Der Dump lässt sich in eine leere PostgreSQL zurückspielen; **jede** Tabelle, die das
Produkt anlegt, ist danach da und trägt so viele Zeilen wie der Dump; die Anwendung startet
dagegen; eine Anmeldung mit einem Konto aus dem Dump gelingt; die Auditkette trägt; und — sofern der
Bestand ein solches Objekt führt — ein Wissensobjekt kam samt Beleg und Anhangsinhalt zurück.

**Er belegt nicht:**

* den **Cloud-/Coolify-Weg**: Umschalten der `DATABASE_URL`, Neustart des Dienstes und das Verhalten
  der Plattform sind Betrieb und stehen in `docs/operations/maintenance-update-process.md` (U4/U5).
  Der Drill läuft gegen eine lokale Wegwerf-Datenbank.
* die **Dateiablage außerhalb der Datenbank**: Klarwerk legt Anhänge heute in `objects` ab, also im
  Dump. Ein Objektspeicher außerhalb der Datenbank wäre vom `pg_dump` nicht erfasst und von diesem
  Drill nicht geprüft.
* **Offsite-Kopie und Verschlüsselung** der Dumps (`docs/operations/backup-disaster-recovery.md`
  §3/§12) — Betreiberpflicht, die kein Probelauf ersetzt.

## Wen der Drill beendet — Zuordnung über die Prozessgruppe

Zwischen dem Drill und dem Server steht der `npx`-Launcher: die PID, die der Server in die
PID-Datei schreibt, ist **nachweislich** eine andere als `$!`
(`tests/backup-drill/start-identitaet.test.ts`). Ein Vergleich der beiden Zahlen konnte deshalb nur
scheitern — er endete mit Exit 80 und ließ Launcher und Server als Waisen auf `DRILL_PORT` zurück.

Der Drill startet den Launcher deshalb in einer **eigenen Prozessgruppe** (Job Control, `set -m`).
`npx`, `tsx` und der Serverprozess erben sie; am 14.09.2026 hingen an einem Start fünf Prozesse in
derselben Gruppe. Daran erkennt der Drill seine eigene Nachkommenschaft:

* Die **PID-Datei wird nicht geglaubt.** Der dort genannte Prozess wird über `ps -o pgid=` gegen
  genau diese Gruppe gehalten. Gehört er nicht dazu, endet der Drill mit Exit 80 und sendet ihm
  **niemals** ein Signal.
* Dass die Gruppe dem Drill gehört, steht auf zwei unabhängigen Tatsachen: Die Shell führt den
  Launcher noch als eigenen, nicht abgeholten Job (solange kann seine PID nicht neu vergeben
  werden), und zu dieser PID existiert wirklich eine Prozessgruppe. Fehlt eine der beiden, fällt
  **kein** Signal — fail-closed, Exit 80.
* **Das Reaping räumt restlos ab**, bei bestandenem wie bei abgebrochenem Lauf: SIGTERM an die
  ganze Gruppe, danach SIGKILL, und erst wenn kein Mitglied mehr lebt, meldet Glied 8 Vollzug.
  Überlebt etwas, ist das Exit 80 — nicht 0. Danach ist `DRILL_PORT` wieder frei.

`ps` gehört deshalb zu den Pflichtwerkzeugen (Exit 1, wie `pg_restore`, `createdb` und `psql`):
ohne Prozessgruppe eines PID ist die Abstammung nicht feststellbar, und dann darf der Drill nichts
beenden.

Gemessen wird das in `tests/backup-drill/prozesszuordnung.test.ts` — am echten `npx`/`tsx`-Baum,
ohne Datenbank und ohne Docker, mit beiden Ausgängen: der richtige Prozess wird beendet, und ein
fremder Prozess in der PID-Datei lebt nach dem Abbruch nachweislich noch. Die beiden Fälle, die
dort nicht vorkommen, misst `tests/backup-drill/waechter-echte-pg.integration.test.ts` an der
**echten Anwendung nach einem echten Restore**: eine Anwendung, die vor dem Horchen stirbt (Exit 30,
das Abräumen erkennt die tote Gruppe und sendet kein Signal), und eine Anwendung, die SIGTERM
ignoriert (die zweite Stufe SIGKILL greift, danach ist die Gruppe leer und der Port frei).

**Voraussetzung für das Abräumen:** Abgeräumte Prozesse, deren Elternprozess schon fort ist, sammelt
der Init-Prozess ein. Läuft der Drill in einem Container, dessen PID 1 das nicht tut (etwa
`npx vitest` als PID 1), bleiben sie als Zombies in der Gruppe stehen, und der Drill endet
richtigerweise mit 80. Container deshalb mit `docker run --init` starten — `compose-drill.sh` tut das.

## Die Grenze nachträglich erzeugter Sidecars

Nach der Umstellung tragen **neue** Dumps einen Sidecar; die bereits liegenden nicht. Der Drill
lehnt sie mit Exit 10 ab — richtig, aber es heißt: Der älteste wiederherstellbare Stand ist der
erste Dump **nach** der Umstellung.

Wer für Altbestände Sidecars nachzieht, muss sie so beschriften: **Eine nachträgliche Prüfsumme
belegt die Unversehrtheit ab dem Zeitpunkt ihrer Erzeugung, nicht rückwirkend.** Sie sagt „diese
Datei hat sich seither nicht verändert" — nicht „diese Datei ist der Dump von damals".

## Atomizität — eine Zusage mit Bedingung

`backup.sh` veröffentlicht durch zwei `mv` im **selben** Verzeichnis: Sidecar zuerst, Dump
zuletzt. Innerhalb einer Partition ist `mv` atomar (`rename(2)`); dadurch gibt es keinen
Zeitpunkt, zu dem ein `*.dump` ohne seine Prüfsumme sichtbar ist.

**Zeigt `BACKUP_DIR` auf eine Netzfreigabe mit anderer Semantik, gilt die Zusage nicht.** Das ist
keine theoretische Einschränkung: Sie gehört einmal am tatsächlichen Zielverzeichnis geprüft,
bevor man sich darauf verlässt.

## Wie oft

Der Drill legt eine Datenbank an und fährt einen Server hoch. Als Torbedingung in jedem CI-Lauf
wäre er zu schwer, als Vierteljahresübung zu selten. **Empfehlung: monatlich im Betrieb.** Ein
Restore-Drill, den niemand fährt, ist eine Datei.

## Compose-Kundeninstanz — sichern, zurückholen, aktualisieren, zurückfallen

Eine Kundeninstanz nach `docs/operations/kundeninstanz-neuinstallation.md` läuft mit
`docker-compose.prod.yml` (Dienste `db` und `app`, Volume `pgdata`). Auf ihrem Wirt liegt Docker,
aber **kein** PostgreSQL-Client — und ein Client aus dem Paketarchiv des Wirts passt selten zur
Serverversion. Für diesen Weg gibt es deshalb **keine neuen Sicherungs- oder Restore-Skripte**,
sondern einen Rahmen um die vorhandenen:

| Baustein | Rolle auf der Compose-Instanz |
|---|---|
| `scripts/backup/backup.sh` | **unverändert**; `pg_dump` und die Lesepruefung `pg_restore --list` laufen über die Adapter in `scripts/backup/compose/` **im Datenbankcontainer** (`docker compose exec`) |
| `scripts/backup/restore-drill.sh` | **unverändert**; läuft im *Prüfwerkzeug* — dem Abbild der laufenden App plus `postgresql-client-16`, `curl`, `ps` — gegen eine **frische** Datenbank derselben PostgreSQL |
| `scripts/backup/compose-drill.sh` | der Rahmen: `sicherung`, `auslagern`, `taeglich`, `wiederherstellen`, `zurueckspielen`, `aktualisieren`, `neustart`, `bestand`, `sichern`, `pruefen`, `gegenprobe`, `rueckweg`, `ablauf`; jeder Schritt schreibt Protokoll und JSON-Beleg |
| `scripts/backup/compose/nutzlast.mjs` | legt über die **echte Anwendung** einen Kundenbestand an (Konto, Wissensobjekt, Anhang mit Beleg) und vergleicht ihn später Feld für Feld und Byte für Byte |

### Voraussetzungen

* Docker Engine mit Compose v2 (`docker compose version`), `bash`, `sha256sum` oder `shasum`,
  `od`, `date`, `tar`, `openssl` (für die Zweitkopie); `rsync` empfohlen (ohne `rsync` spiegelt `tar`).
* Die Instanz läuft (`docker compose ls` zeigt ihren **Projektnamen** — beim Ein-Befehl-Weg ist das
  der Ordnername, z. B. `klarwerk`), ihr Ordner enthält `docker-compose.prod.yml` und `.env`.
* `COMPOSE_DATEIEN` nennt **genau** die Compose-Dateien, mit denen die Instanz gestartet wurde
  (Vorgabe `docker-compose.prod.yml`). Das Skript hält sie gegen das Kennzeichen
  `com.docker.compose.project.config_files` des laufenden `app`-Containers und bricht bei Abweichung
  ab (Exit 1), bevor es etwas baut, anhält oder startet.
* Arbeitsordner je Instanz: Vorgabe `<Elternordner der Instanz>/b3-arbeit-<projekt>` (`ARBEIT=`).
  Darin liegen Sicherungen, `instanz.id` und unter `geheim/` das Anmeldekennwort des Drill-Kontos und
  der Schlüssel der Zweitkopie. Belege nach `<Instanz>/belege` (`BELEGE=`).
* Instanzkennung, Drill-Kennwort und Schlüssel entstehen beim ersten Lauf **genau einmal**:
  vollständig geschrieben, dann per Hardlink (`ln`, atomar, scheitert bei vorhandenem Namen)
  veröffentlicht — zwei gleichzeitige Erstläufe verwenden denselben Wert, keiner ersetzt ihn.
* **`<ARBEIT>/instanz.id` und `<ARBEIT>/geheim/auslagerung.schluessel` gehören zur
  Instanzkonfiguration** — sie werden wie die `.env` getrennt verwahrt (Passwort-Manager). Ohne die
  Kennung verweigert eine neu aufgesetzte Instanz die eigenen Sicherungen (Instanzbindung), ohne den
  Schlüssel ist jede Zweitkopie wertlos.
* Für `wiederherstellen`, `pruefen` und `gegenprobe`: Netz beim **ersten** Bau des Prüfwerkzeugs
  (`apt.postgresql.org`, npm-Registry). Es wird aus `scripts/backup/compose/pruefwerkzeug.Dockerfile`
  aus einem **leeren** Baukontext gebaut und je App-Abbild wiederverwendet. Tests, Skripte und Doku
  werden schreibgeschützt unter `/b3quelle` eingehängt und beim Start in das beschreibbare `/app`
  kopiert (die Testvorrichtungen legen Arbeitsordner unter `tests/` an).

### A · Täglich sichern — mit Herkunft und verschlüsselter Zweitkopie

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk ZWEITER_ORT=/mnt/zweitort/klarwerk \
  bash /opt/klarwerk/scripts/backup/compose-drill.sh taeglich
```

Als Zeitplan (Beispiel `/etc/cron.d/klarwerk-sicherung`, Nutzer mit Docker-Recht):

```
15 3 * * * betrieb PROJEKT=klarwerk STACK=/opt/klarwerk ZWEITER_ORT=/mnt/zweitort/klarwerk bash /opt/klarwerk/scripts/backup/compose-drill.sh taeglich >> /var/log/klarwerk-sicherung.log 2>&1
```

`taeglich` = `sicherung` + `auslagern`:

1. **`sicherung`**: das unveränderte `backup.sh` über die Compose-Adapter nach
   `SICHERUNGSZIEL` (Vorgabe `<ARBEIT>/sicherungen/taeglich`), Aufbewahrung `BACKUP_KEEP`
   (Vorgabe 14). Die Adresse `DATABASE_URL=postgresql://klarwerk@db/klarwerk_prod` nennt Dienst,
   Konto und Datenbank — **kein Kennwort**; der Adapter verbindet über den lokalen Socket im
   Container und weist eine Adresse mit Kennwort oder ein unbekanntes Argument mit Exit 64 ab.
   Danach schreibt der Rahmen den **Herkunftsnachweis** `<dump>.herkunft.json`: Instanzkennung,
   Projekt, Datenbank, PostgreSQL-Systemkennung, Stand der Instanz, `/health` (Version, Commit),
   SHA-256 des Dumps, Zeitpunkt.
2. **`auslagern`**: Dump + Prüfsumme + Herkunftsnachweis als `tar`, verschlüsselt mit
   `openssl enc -aes-256-cbc -pbkdf2 -iter 200000`, nach `ZWEITER_ORT` (absoluter Pfad, nicht in
   Instanz oder Arbeitsordner — ein eingehängter zweiter Speicher). **Ohne Herkunftsnachweis wird
   nichts ausgelagert** (170): eine Zweitkopie ohne ihn verweigerte `wiederherstellen` später mit
   161. Jedes Kopieren ins Paket wird geprüft, der Nachweis vor dem Verschlüsseln bytegleich
   verglichen; scheitert eines davon, ist das 170 und am zweiten Ort entsteht keine Kopie
   (Befund B1, Lauf 3 — vorher wurde ein gescheitertes Kopieren des Nachweises übergangen und der
   Schritt meldete „nachgeprüft: ja"). Gestaffelt: `tage/` jede
   Sicherung (`AUSLAGERUNG_TAGE`, Vorgabe 14), `wochen/` die erste der ISO-Woche
   (`AUSLAGERUNG_WOCHEN`, 8), `monate/` die erste des Monats (`AUSLAGERUNG_MONATE`, 12). Danach wird
   die Zweitkopie **entschlüsselt**, ihr Dump gegen die Prüfsumme gehalten und ihr
   Herkunftsnachweis bytegleich mit dem Original verglichen (fehlt er oder weicht er ab: 170); jede in diesem Lauf
   angelegte Kopie (Tag, ggf. Woche und Monat) wird gegen ihren Sidecar geprüft, der **ihren eigenen**
   Dateinamen trägt (`sha256sum -c` gelingt in jeder Stufe). Ein gescheitertes Kopieren oder ein nicht
   belegbarer Zeitraum ist Exit 170. Als erledigt gilt ein Zeitraum nur, wenn in `wochen/` bzw.
   `monate/` eine **gültige Kopie samt passendem Sidecar** liegt — die Reservierung
   `.<zeitraum>.belegt` allein genügt nicht. Scheitert die Kopie, gibt der Lauf seine Reservierung
   wieder frei; der nächste Lauf desselben Zeitraums legt die Kopie nach. Steht eine Reservierung
   ohne gültige Kopie da (ein gleichzeitiger Lauf kopiert gerade), wartet der Lauf bis
   `AUSLAGERUNG_WARTEN` Sekunden (Vorgabe 60) und endet sonst mit 170 und dem Pfad der Reservierung
   — dann prüfen, dass kein Lauf mehr aktiv ist (z. B. nach einem Abbruch per `kill`), und die
   leere Reservierung von Hand entfernen. `taeglich` lagert genau **seine eigene** Sicherung aus. Der
   Schlüssel liegt nie am zweiten Ort; fehlt er, wird er einmal erzeugt und muss sofort getrennt
   verwahrt werden.

Direkt mit `backup.sh` (ohne Rahmen) zu sichern bleibt möglich — dann fehlt aber der
Herkunftsnachweis, und `wiederherstellen`/`zurueckspielen` verweigern die Sicherung (161).

### B · Wiederherstellung üben — in eine frische Datenbank derselben Instanz

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk DRILL_LOGIN_EMAIL=admin@kunde.de \
  bash /opt/klarwerk/scripts/backup/compose-drill.sh wiederherstellen \
  /opt/b3-arbeit-klarwerk/sicherungen/taeglich/klarwerk-20260925T031500Z.dump
```

Das Kennwort des Anmeldekontos (ein Konto **aus dem Dump** mit `ko.validate`) steht in
`<ARBEIT>/geheim/drill-login` (Rechte `600`, nur der Wert); ohne Datei erzeugt der Schritt ein
Zufallskennwort — das passt dann nur zu einem Bestand, den `bestand` selbst angelegt hat.

Reihenfolge im Schritt:

1. **Instanzbindung**: Herkunftsnachweis vorhanden, seine SHA-256 gleich der des Dumps, seine
   Instanzkennung gleich `<ARBEIT>/instanz.id` — sonst Exit 161, und es entsteht keine Datenbank.
2. Prüfwerkzeug sicherstellen (aus dem **laufenden** App-Abbild).
3. `restore-drill.sh` **unverändert** im Prüfwerkzeug, Ziel `klarwerk_drill_<lauf>` (eigene, leere
   Datenbank derselben PostgreSQL) — alle Glieder und Exitcodes wie oben; `klarwerk_prod` wird
   nicht angefasst.
4. Nur bei Exit 0: das **Produktabbild** der Instanz (`docker compose run app`, derselbe Startbefehl)
   gegen die wiederhergestellte Datenbank starten, auf „healthy" warten und — wenn ein Bestand
   angelegt wurde — Wissensobjekt, Beleg, Anhang (SHA-256) und Auditkette vergleichen.
5. Container und Drill-Datenbank wieder entfernen (`B3_BEHALTEN=1` behält die Datenbank).

Beleg: `belege/b3-<lauf>-wiederherstellen.json` (Dumpname, SHA-256, Bytes, Sidecar, Zieldatenbank,
Drill-Exit, Sekunden) und `…-wiederherstellen-drill.log` (jede Pflichttabelle `Dump=… Datenbank=…`).

### C · Ernstfall — eine Sicherung in den Bestand der Instanz zurückspielen

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk ZURUECKSPIELEN_BESTAETIGT=klarwerk_prod \
  bash /opt/klarwerk/scripts/backup/compose-drill.sh zurueckspielen \
  /opt/b3-arbeit-klarwerk/sicherungen/taeglich/klarwerk-20260925T031500Z.dump
```

Ohne `ZURUECKSPIELEN_BESTAETIGT=klarwerk_prod` geschieht nichts (Exit 1). Reihenfolge — **jeder
Schritt wird auf Erfolg geprüft**, beim ersten Fehlschlag geht es in den Rückweg:

1. Prüfsumme des Dumps (Exit 160 — nichts angefasst), Instanzbindung (Exit 161 — nichts angefasst),
   der Name `klarwerk_prod_vor_<lauf>` ist frei.
2. `docker compose stop app`.
3. Offene Verbindungen beenden, `ALTER DATABASE klarwerk_prod RENAME TO klarwerk_prod_vor_<lauf>` —
   der alte Bestand wird **umbenannt, nie gelöscht**.
4. `CREATE DATABASE klarwerk_prod`, danach die Leere **festgestellt** (0 Tabellen in `public`).
5. `pg_restore --no-owner --no-privileges --exit-on-error` im Datenbankcontainer.
6. `docker compose up -d --no-deps app`, warten auf „healthy".
7. Inhaltsprüfsumme und — wenn angelegt — Bestandsvergleich.

**Rückweg**: Scheitert 2–6, wird das neue `klarwerk_prod` verworfen, `klarwerk_prod_vor_<lauf>`
zurückbenannt und die App wieder gestartet **und auf „healthy" geprüft** (Exit 162). Scheitert das
Zurückbenennen, das erneute `up` oder die Gesundheit des zurückgeholten Stands, ist es Exit 163 —
der Beleg nennt den Grund („WIEDERANLAUF GESCHEITERT: …") und, wo nötig, unter welchem Namen der
alte Bestand liegt. Gemessen werden die **Ausfallzeit** (Anhalten bis
„healthy", RTO) und das **Alter des eingespielten Stands** (aus dem Herkunftsnachweis, RPO); mit
`RTO_ZIEL_SEKUNDEN`/`RPO_ZIEL_SEKUNDEN` endet eine Überschreitung mit Exit 164.
Beleg: `belege/b3-<lauf>-zurueckspielen.json`.

Eine **neu aufgesetzte** Instanz (Serverausfall) bekommt zuerst ihre gesicherte `instanz.id` zurück;
ein bewusster Umzug einer fremden Sicherung geht nur mit
`FREMDE_SICHERUNG_BESTAETIGT=<Instanzkennung der Sicherung>`.

### D · Aktualisieren — mit Rückweg

Die neue Ausgabe liegt als eigener Baum neben der Instanz (z. B. ausgepacktes Release oder
`git archive` des neuen Commits nach `/opt/klarwerk-neu`). Das Werkzeug **der neuen Ausgabe**
hebt die Instanz:

```bash
PROJEKT=klarwerk STACK=/opt/klarwerk \
  bash /opt/klarwerk-neu/scripts/backup/compose-drill.sh aktualisieren /opt/klarwerk-neu
```

Reihenfolge im Schritt:

1. Compose-Dateien gegen die laufende Instanz prüfen (Exit 1). Vorher-Stand festhalten:
   Abbild-ID, Startzeit, `/health` (Version, Commit), **Inhaltsprüfsumme** (`objects`,
   `ko_evidence`, Zahl der Konten und Wissensobjekte). Scheitert diese Messung, wird **nicht**
   aktualisiert (Exit 111). Das laufende Abbild wird als `<projekt>-app:rueckfall` markiert.
2. **Vorab-Sicherung** mit Herkunftsnachweis nach `<ARBEIT>/sicherungen/vor-aktualisierung`
   (`VOR_UPDATE_KEEP`, Vorgabe 5). Scheitert sie, wird **nicht** aktualisiert (Exit 100).
3. Quellbaum der Instanz durch die neue Ausgabe ersetzen. **Erhalten** bleiben `.env`, `belege`,
   jede Compose-Datei aus `COMPOSE_DATEIEN` außer `docker-compose.prod.yml` (in der Fassung der
   Instanz, auch wenn das Release eine gleichnamige mitbringt) und was `B3_ERHALTEN` zusätzlich nennt.
   Fehlt danach eine Compose-Datei: Exit 121.
4. `docker compose config` — fehlt eine Pflichtvariable, bricht Compose mit ihrem **Namen** ab; der
   laufende Stand wird nicht angefasst (Exit 121).
5. `docker compose build --build-arg SOURCE_COMMIT=<neuer Commit> app` (Exit 120 bei Baufehler; der
   laufende Stand bleibt).
6. `docker compose up -d --no-deps --force-recreate app` — **nur** `app` wird neu erzeugt; `db` und
   das Volume `pgdata` bleiben, wie sie sind. Warten auf „healthy" (`WARTEN_GESUND`, Vorgabe 240 s).
7. `/health` muss den **neuen** Commit melden (Exit 124 sonst).
8. **Rückweg**, falls 6 oder 7 scheitern: `<projekt>-app:rueckfall` wird wieder zum App-Abbild und
   erneut ausgerollt; bestanden ist er erst, wenn genau das vorherige Abbild wieder gesund läuft
   (Exit 122 — die Meldung nennt den Grund, z. B. „der Container startet nicht (Status restarting,
   Exitcode 3)"). Scheitert auch das: Exit 123.
9. Nachher: Inhaltsprüfsumme erneut und Bestandsvergleich über die Anwendung — gescheitert 111,
   abweichend 110, **auch nach einem Rückweg** (dann ersetzt 110/111 die 120/121/122/124: ein
   Rückweg mit verändertem Bestand ist kein bestandener Rückweg; nur 123 bleibt stehen). Der
   Schritt `rueckweg` verlangt deshalb genau 122 und 121; weicht einer der beiden Vergleiche ab,
   ist er 150 — auch wenn der Vergleich danach wieder gleich ist.

**Die Datenhälfte des Rückwegs.** Das alte Abbild bringt den alten **Code** zurück, nicht den alten
**Datenstand**. Hat die neue Ausgabe beim Start schon migriert und läuft die alte darauf nicht, wird
die Vorab-Sicherung aus Schritt 2 mit C (`zurueckspielen`) eingespielt. Die heutigen Migrationen
sind additiv (`CREATE … IF NOT EXISTS`); dass eine ältere Ausgabe auf einem neueren Schema läuft,
ist **nicht gemessen**.

### E · Der Prüfplatz-Lauf (B3) — alles in Reihenfolge

Der vollständige Nachweis läuft auf dem zweiten Prüfplatz-Stack (upcloud25, Compose-Projekt
`pruefplatz-b3`, eigenes Netz und eigene Volumes, **kein** Host-Port). Gefahren wird er von der
**Betriebsseite** über `PRUEFPLATZ-B.sh` (Ausführungsweg
`gespraech/steuerung-entwuerfe/pruefplatz-b-20260920/AUSFUEHRUNGSWEG.md`), nie von der Bahn.

**Welche Override-Datei.** `PRUEFPLATZ-B.sh vorbereiten` kopiert die mit `OVERRIDE` benannte Datei
(`docker-compose.pruefplatz-b3.override.yml`) zusätzlich unter dem Namen
`docker-compose.pruefplatz.override.yml` in den Zielbaum, und `hochfahren` startet den Stack mit
`-f docker-compose.prod.yml -f docker-compose.pruefplatz.override.yml`. Genau diese beiden Dateien
laufen — deshalb nennt `COMPOSE_DATEIEN` sie, und `compose-drill.sh` prüft das gegen das
Kennzeichen des laufenden Containers. `OVERRIDE` bestimmt nur, **welcher Inhalt** unter diesem
Namen liegt.

Einmalig auf dem Knoten (Betriebsseite; `einrichten` legt nur `/home/runner/pruefplatz/…` an):
`mkdir -p /home/runner/pruefplatz-b3/produkt/belege /home/runner/pruefplatz-b3/werkzeug
/home/runner/pruefplatz-b3/zweiter-ort` und eine eigene `/home/runner/pruefplatz-b3/produkt/.env`
(eigenes `POSTGRES_PASSWORD`, `APP_BASE_URL=https://pruefplatz.klarwerk.test`).

```bash
export PROJEKT=pruefplatz-b3 OVERRIDE=docker-compose.pruefplatz-b3.override.yml
H=87.58.155.37
# 1. Werkzeugbaum = PRÜFSTAND-Commit (liefert compose-drill.sh und die neue Ausgabe)
ZIEL=/home/runner/pruefplatz-b3/werkzeug PRUEFPLATZ-B.sh $H vorbereiten <PRÜFSTAND>
# 2. Instanz leer auf dem VORGÄNGER-Commit hochfahren (die „ältere Ausgabe" für K3)
ZIEL=/home/runner/pruefplatz-b3/produkt  PRUEFPLATZ-B.sh $H leeren
ZIEL=/home/runner/pruefplatz-b3/produkt  PRUEFPLATZ-B.sh $H belege-leeren
ZIEL=/home/runner/pruefplatz-b3/produkt  PRUEFPLATZ-B.sh $H vorbereiten <VORGÄNGER>
ZIEL=/home/runner/pruefplatz-b3/produkt  PRUEFPLATZ-B.sh $H hochfahren
# 3. Der Ablauf (auf dem Knoten, als runner)
ssh runner@$H 'cd /home/runner/pruefplatz-b3/werkzeug && PROJEKT=pruefplatz-b3 \
  STACK=/home/runner/pruefplatz-b3/produkt \
  COMPOSE_DATEIEN="docker-compose.prod.yml docker-compose.pruefplatz.override.yml" \
  ZURUECKSPIELEN_BESTAETIGT=klarwerk_prod ZWEITER_ORT=/home/runner/pruefplatz-b3/zweiter-ort \
  bash scripts/backup/compose-drill.sh ablauf /home/runner/pruefplatz-b3/werkzeug'
# 4. Stand- und Laufbelege holen
ZIEL=/home/runner/pruefplatz-b3/produkt  PRUEFPLATZ-B.sh $H belege
ZIEL=/home/runner/pruefplatz-b3/produkt  PRUEFPLATZ_BELEGE_ZIEL=<laufeigener Ordner> PRUEFPLATZ-B.sh $H holen
```

`ablauf` fährt: `bestand` → `aktualisieren` (Vorgänger → Prüfstand, K3) → `neustart` (echter
Neustart von `db` und `app`) → `sichern` (K1: drei Läufe, `BACKUP_KEEP=2`) → `wiederherstellen`
(K2) → `pruefen` (W1–W4 und die übrigen PG-/Backupfälle gegen diese PostgreSQL; ein Skip ist rot)
→ `gegenprobe` (K5 und Instanzbindung) → `zurueckspielen` (Ernstfall in `klarwerk_prod`) →
`taeglich` (Sicherung mit Herkunft, verschlüsselte Zweitkopie) → `rueckweg` (K4). Ohne Bestand hält
er an, ohne Sicherung überspringt er Wiederherstellung, Prüfen, Gegenprobe und Zurückspielen; fehlt
die Bestätigung oder `ZWEITER_ORT`, ist der betreffende Schritt **rot**, nicht ausgelassen. Die
Zusammenfassung steht in `belege/b3-<lauf>-ablauf.json`; jeder Beleg trägt `pruefstand` (Commit des
Werkzeugbaums) und `instanz_stand`.

**Grenze am Prüfplatz:** `zweiter-ort` liegt auf demselben Knoten — er belegt Verschlüsselung,
Staffelung und Zurücklesen, **nicht** die räumliche Trennung. Die gehört zum Betrieb der Kundeninstanz.

**Stand 26.09.2026: Dieser Lauf ist auf upcloud25 (`pruefplatz-b3`) NICHT gefahren.** Die Bahn
hat keinen Zugang zum Prüfplatz; die Belege kommen per `HINWEIS.md` von der Betriebsseite. Bis dahin
ist K7 **offen**. Gefahren ist derselbe `ablauf` auf einem isolierten Compose-Stack unter Docker
Desktop (E2) — das belegt K1–K5 gegen echte PostgreSQL und das echte App-Abbild, nicht den Prüfplatz.

### E2 · Derselbe Ablauf lokal unter Docker (am 26.09.2026 gefahren)

Genau so gefahren (Docker 29.5.3, Compose v5.1.4, arm64; Projekt `b3lokal`, eigene Volumes, **kein**
Host-Port). Instanz = ältere Ausgabe `c38f2d71` (`git archive`), Werkzeugbaum = neue Ausgabe mit
`PRUEFPLATZ-STAND` (`commit=1a51d968…`, dazu der Arbeitsstand der Runde, siehe Grenze unten):

```bash
B=/tmp/b3lokal
git archive <VORGÄNGER> | tar -x -C $B/produkt          # + PRUEFPLATZ-STAND commit=<VORGÄNGER>
git archive <PRÜFSTAND> | tar -x -C $B/werkzeug         # + PRUEFPLATZ-STAND commit=<PRÜFSTAND>
# Override ohne Host-Port, in beiden Bäumen:  services: { app: { ports: !reset [] } }
printf 'POSTGRES_PASSWORD=%s\nAPP_BASE_URL=https://b3lokal.klarwerk.test\n' "$(openssl rand -hex 16)" \
  > $B/produkt/.env && chmod 600 $B/produkt/.env
cd $B/produkt && docker compose -p b3lokal -f docker-compose.prod.yml \
  -f docker-compose.b3lokal.override.yml build --build-arg SOURCE_COMMIT=<VORGÄNGER> app
docker compose -p b3lokal -f docker-compose.prod.yml -f docker-compose.b3lokal.override.yml up -d
cd $B/werkzeug && PROJEKT=b3lokal STACK=$B/produkt \
  COMPOSE_DATEIEN="docker-compose.prod.yml docker-compose.b3lokal.override.yml" \
  ZURUECKSPIELEN_BESTAETIGT=klarwerk_prod ZWEITER_ORT=$B/zweiter-ort \
  bash scripts/backup/compose-drill.sh ablauf $B/werkzeug
```

Ergebnis (`b3-20260926T110706Z-ablauf.json`): **exit 0**, jeder Schritt 0 — `aktualisieren` 13 s,
`neustart` 8 s, `sichern` 3 s, `wiederherstellen` 14 s, `pruefen` 154 s, `gegenprobe` 6 s,
`zurueckspielen` 9 s, `taeglich` 1 s, `rueckweg` 14 s. Die Belege liegen als Archiv mit Prüfsummen unter
`docs/operations/b3-belege/lokal-docker-20260926/` (Lesehilfe dort).

**Befund dieses Laufs, behoben:** Der erste Lauf (`b3-20260926T105944Z`) endete mit 140. Jeder Drill im
Schritt `pruefen` bestand bis Glied 7b, endete aber mit **80** („Prozessgruppe hat SIGKILL
überlebt"): im Werkzeugcontainer war `npx vitest` PID 1 und sammelte die abgeräumte Anwendung nicht
ein — sie blieb als Zombie in ihrer Gruppe stehen. Seitdem startet `compose-drill.sh` jeden
Werkzeugcontainer mit `docker run --init`; die Abräumprüfung des Drills ist unverändert.

**Grenzen:** kein Caddy/TLS davor (der Lauf spricht die App im Compose-Netz über HTTP an), der zweite
Ort liegt auf demselben Rechner, und der Werkzeugbaum war `1a51d968` **plus** der Arbeitsstand dieser
Runde (derselbe Inhalt, den der Starter danach festhält) — der Commit in `/health` ist deshalb
`1a51d968`, nicht der Commit dieser Runde.

### F · Gegenprobe (K5) — jede Manipulation macht genau ihren Nachweis rot

Reversibel: gearbeitet wird an Kopien und an eigenen Datenbanken; die echte Sicherung wird vorher
und nachher gehasht (`gegenprobe.json`: `sha256_vorher` = `sha256_nachher`).

| Fall | Erwartet | Was er zeigt |
|---|---|---|
| ein Byte der **Kopie** eines Dumps gekippt, Sidecar unverändert | Drill **11**, Zieldatenbank **nicht** angelegt | die Prüfsumme hält `pg_restore` auf (R-0808) |
| Dump in eine eigene Quelle eingespielt, `ko_evidence` entfernt, mit `backup.sh` neu gesichert | Drill **22**, Meldung nennt `ko_evidence` | eine fehlende Tabelle wird benannt, nicht als 0 gezählt |
| Schritt `neustart` mit `NEUSTART_AUSLASSEN=1` | **130** | ein Neustart-Nachweis ohne echten Neustart ist rot (Postmaster-Startzeit unverändert) |
| Kopie der Sicherung mit dem Herkunftsnachweis einer **fremden** Instanz | **161**, keine Zieldatenbank | die Instanzbindung trifft (R-0811) |
| Kopie der Sicherung **ohne** Herkunftsnachweis | **161** | eine ungebundene Sicherung wird nicht eingespielt |

Der unveränderte Dump ist die Gegenseite: `wiederherstellen` endet mit 0.

### Exitcodes von compose-drill.sh

Eigener Bereich ab 100, damit sie nie mit denen von `restore-drill.sh` (oben) verwechselt werden;
`wiederherstellen` und `gegenprobe` reichen den Code des Drills unverändert durch.

| Code | Bedeutung |
|---|---|
| 0 | Schritt bestanden |
| 1 | Aufruf/Umgebung (fehlendes Werkzeug, fehlende `.env`, unbekannter Schritt, abweichende `COMPOSE_DATEIEN`, fehlende Bestätigung) |
| 2 | Aufbaufehler (Prüfwerkzeug nicht baubar, Instanz nicht erreichbar) — **kein** Befund |
| 100 | K1: `backup.sh` ist gescheitert |
| 101 | K1: Aufbewahrung nicht eingehalten |
| 102 | K1: Prüfsumme passt nicht, oder das Datenbank-Kennwort steht im Protokoll |
| 110 | Vergleich: **Befund** — der Bestand ist nicht unverändert lesbar |
| 111 | Inhaltsmessung gescheitert — ohne Messung vorher/nachher ist nichts bewiesen |
| 120 | Aktualisierung: Bau gescheitert — vorheriger Stand läuft unverändert |
| 121 | Aktualisierung: Konfiguration unvollständig (Pflichtvariable, fehlende Compose-Datei) — vorheriger Stand läuft unverändert |
| 122 | Aktualisierung: neue Ausgabe nicht gesund — **Rückweg ausgeführt**, vorheriger Stand gesund |
| 123 | Aktualisierung: **Rückweg gescheitert** — Handeln nötig |
| 124 | Aktualisierung: `/health` meldet nicht die neue Ausgabe — Rückweg ausgeführt |
| 125 | Aktualisierung: keine neuere Ausgabe (Stand vorher = nachher) — nichts belegt |
| 130 | Neustart: kein echter Datenbank-Neustart belegt |
| 131 | Neustart: Datenbank oder Anwendung danach nicht wieder bereit |
| 140 | Prüfen: Tests rot |
| 141 | Prüfen: Tests übersprungen — ein Skip ist hier kein Grün |
| 150 | Gegenprobe/Rückweg: das erwartete Rot bzw. der erwartete Rückweg blieb aus |
| 160 | Zurückspielen: Prüfsumme fehlt oder passt nicht — nichts angefasst |
| 161 | Instanzbindung: Sicherung ohne passenden Herkunftsnachweis oder aus einer anderen Instanz |
| 162 | Zurückspielen: ein Schritt gescheitert — der vorherige Bestand ist wieder eingesetzt |
| 163 | Zurückspielen: gescheitert **und** der vorherige Bestand ließ sich nicht wieder einsetzen oder nicht wieder gesund starten |
| 164 | Zurückspielen: gelungen, aber über `RTO_ZIEL_SEKUNDEN`/`RPO_ZIEL_SEKUNDEN` |
| 170 | Auslagern: Verschlüsselung, Ablage oder Nachprüfung der Zweitkopie gescheitert |

### Was dockerfrei gemessen ist — und was nur der Prüfplatz belegt

`tests/kundenbetrieb-compose/compose-drill.test.ts` und `ernstfall-bindung-auslagerung.test.ts`
fahren das echte `compose-drill.sh`, die echten Adapter und das **unveränderte** `backup.sh` gegen
eine zustandsbehaftete `docker`-Attrappe: Sicherung ohne Kennwort mit Aufbewahrung und
Herkunftsnachweis; Aktualisierung mit neuem Commit, erhaltener Override-Datei und Abbruch bei
gescheiterter Inhaltsmessung; Rückweg bei krankem Abbild (122), falschem Commit (124) und fehlender
Pflichtvariable (121); Zurückspielen mit Fehlschlag an jedem Schritt (162/163) und
Prüfsummen-/Bindungsabbruch (160/161); Neustart-Gegenprobe (130); der Prüfschritt mit
schreibbarem Testbaum und Skip = rot (141). `parallel-und-rueckweg.test.ts` fährt zwei **echte, gleichzeitige** Erstläufe (Instanzkennung, Schlüssel der Zweitkopie), gescheiterte Stufenkopien, die Sidecars aller drei Stufen und den gescheiterten Wiederanlauf nach dem Rückweg (163). Die Verschlüsselung der Zweitkopie läuft dort mit dem
**echten** `openssl` und wird unabhängig entschlüsselt. `tests/kundenbetrieb-compose/nutzlast.test.ts`
fährt `nutzlast.mjs` über HTTP gegen die echte Anwendung (In-Memory) samt Gegenprobe. **Dass
Docker, Compose, PostgreSQL und das gebaute Abbild sich so verhalten, belegt allein der
Prüfplatz-Lauf (E).**
