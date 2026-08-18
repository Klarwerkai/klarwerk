# Restore-Drill — Betriebsanleitung

Ein Backup, das nie zurückgespielt wurde, ist eine Vermutung. Dieser Drill macht daraus eine
Messung: Er prüft die Prüfsumme, spielt in eine **frische, leere** Datenbank zurück, startet
Klara dagegen, meldet sich mit einem Konto **aus dem Dump** an, fragt die Auditkette ab und
räumt den gestarteten Prozess wieder ab.

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
| `22` | Strukturgate: erwartete Tabellen fehlen nach dem Restore |
| `30` | Anwendung wurde nicht lebendig (keine PID-Datei, `/health` ≠ 200) |
| `60` | **Login fehlgeschlagen** — Aufbaufehler, *kein* Auditbefund |
| `61` | **403 bei der Verifikation** — die Fixture hat kein `ko.validate`, Aufbaufehler |
| `70` | `linkageBreaks ≠ 0` — echter Kettenbruch |
| `71` | `unresolvedDeviations ≠ 0` — unerklärte Hashabweichung |
| `72` | `uncheckedDeviations ≠ 0` — ungeprüfte Abweichung (Deckel gerissen) |
| `80` | **Reaping fehlgeschlagen** — fremde/wiederverwendete PID oder Prozess überlebt |

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
| `tests/operations/restore-drill.backup.test.ts` | **Veröffentlichungsdisziplin** von `backup.sh`: was bei Abbruch und ohne Hashwerkzeug liegen bleibt | nein |
| `tests/operations/restore-drill.test.ts` | **Aufrufdisziplin** des Drills: dass `pg_restore` bei schlechtem Sidecar *nicht startet*; Reaping-Identität | nein |
| `tests/operations/restore-drill.integration.test.ts` | **der Restore selbst**: leere DB, `pg_restore`, Login aus dem Dump, Auditzähler | **ja** |

**Ein grüner Lauf der ersten beiden ist kein Datenbanknachweis.** Sie benutzen PATH-Stubs — und
das ist Absicht: Die tragende Zusage „`pg_restore` wird *nicht* gestartet" lässt sich nur mit
einem Rekorder belegen. Ein echtes `pg_restore` könnte man nicht auf „wurde nicht aufgerufen"
prüfen, ohne es zu ersetzen.

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
