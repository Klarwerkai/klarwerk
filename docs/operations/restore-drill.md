# Restore-Drill — Betriebsanleitung

Ein Backup, das nie zurückgespielt wurde, ist eine Vermutung. Dieser Drill macht daraus eine
Messung: Er prüft die Prüfsumme, spielt in eine **frische, leere** Datenbank zurück,
prüft die Kerntabellen `kos`, `users`, `audit`, `objects` samt Zeilenzahlen gegen den Dump,
startet Klara dagegen, meldet sich mit einem Konto **aus dem Dump** an, fragt die Auditkette ab und
räumt anschließend alles restlos ab, was er selbst gestartet hat — und nur das.

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
| `22` | Strukturgate: fehlende Kerntabellen (`kos`, `users`, `audit`, `objects`), alle Namen in einer Meldung |
| `23` | Zeilenabweichung: Tabellenname, `Dump=<Zahl>` und `Datenbank=<Zahl>` |
| `24` | Zeilenzählung nicht messbar: Datenextraktion, COPY-Format oder SQL-Abfrage fehlgeschlagen; Tabellenname wird genannt |
| `30` | Anwendung wurde nicht lebendig (keine PID-Datei, `/health` ≠ 200) |
| `31` | Startwerkzeug fehlt oder ist nicht ausführbar: `node`, `npx` oder lokal installiertes `tsx` |
| `60` | **Login fehlgeschlagen** — Aufbaufehler, *kein* Auditbefund |
| `61` | **403 bei der Verifikation** — die Fixture hat kein `ko.validate`, Aufbaufehler |
| `70` | `linkageBreaks ≠ 0` — echter Kettenbruch |
| `71` | `unresolvedDeviations ≠ 0` — unerklärte Hashabweichung |
| `72` | `uncheckedDeviations ≠ 0` — ungeprüfte Abweichung (Deckel gerissen) |
| `80` | **Zuordnung oder Reaping fehlgeschlagen** — die PID-Datei nennt einen Prozess außerhalb der eigenen Prozessgruppe, die Abstammung ist nicht feststellbar, oder ein Prozess hat SIGKILL überlebt |

Die Trennung von 60/61 gegen 70/71/72 ist der Kern: **Ein Aufbaufehler darf nicht wie ein
Auditbefund aussehen.**

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
| `tests/backup-drill/restore-drill.test.ts` | PATH-Stubs: Sidecar vor jedem Restore, leeres Ziel, vier Kerntabellen, Dumpabgleich, Startaufruf, Login-/Auditcodes und das Abweisen einer fremden PID | nein |
| `tests/backup-drill/start-identitaet.test.ts` | Echtes `npx tsx`: Launcher-PID und TypeScript-Prozess-PID sind verschieden | nein |
| `tests/backup-drill/prozesszuordnung.test.ts` | Echter Prozessbaum (echtes `npx`, `tsx`, `node`, `curl`, `ps`): der Drill trifft den Prozess, der wirklich horchte, räumt die ganze Gruppe ab und gibt den Port frei; eine fremde PID in der PID-Datei endet mit 80, und der fremde Prozess lebt danach noch | nein |
| `tests/backup-drill/echter-wiederanlauf.integration.test.ts` | Echter Custom-Dump aus `backup.sh` → echte, leere PostgreSQL → laufende Anwendung → dieselbe hochgeladene Datei Byte für Byte zurück | **ja** (oder eine lokale PostgreSQL, s. u.) |

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

## Zeilenabgleich und Anwendungsstart

Nach dem Restore sammelt das Strukturgate alle fehlenden Tabellen aus `kos`, `users`, `audit`,
`objects` (Exit 22). Für jede vorhandene Kerntabelle extrahiert
`pg_restore --data-only --schema=public --table=<tabelle> -f - "$DUMP"` die COPY-Daten aus dem
Archiv. Der Drill zählt ausschließlich deren Datenzeilen und vergleicht sie mit
`SELECT count(*) FROM public.<tabelle>` in der Ziel-DB, **vor** dem Anwendungsstart.
Er gibt jedes gemessene Paar als `<tabelle>: Dump=<Zahl> Datenbank=<Zahl>` aus; auch `0 = 0` gilt.
Abweichungen enden mit Exit 23 samt beiden Zahlen. Nicht lesbare, fehlende oder unvollständige
COPY-Blöcke und fehlgeschlagene SQL-Zählungen sind Exit 24; fehlende Daten werden nie als 0 ausgelegt.
Der Vergleich gilt für diese vier Kerntabellen, nicht für sämtliche Tabellen des Dumps.

Der Startbefehl lautet wie im Produktionsimage `npx tsx services/app/src/server.ts`.
Der Drill prüft vorher `node`, `npx` und das lokale `tsx` ohne Paketdownload (Exit 31).

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
fremder Prozess in der PID-Datei lebt nach dem Abbruch nachweislich noch.

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
