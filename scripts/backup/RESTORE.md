# Klarwerk — Datenbank-Backup & Wiederherstellung (S1)

SCRUM-469 / MEGA-BATCH-1 WP7. Ein schlanker `pg_dump`-Wrapper + diese Anleitung. **Keine
Runtime-Integration** — rein manuell bzw. per Cron/Coolify-Scheduled-Task auszulösen.

## Backup erstellen

```bash
# DB-URL aus der Umgebung (bevorzugt KLARWERK_DATABASE_URL, sonst DATABASE_URL).
DATABASE_URL='postgres://user:pass@host:5432/klarwerk_prod' ./scripts/backup/backup.sh
# → schreibt ./backups/klarwerk-<ZEITSTEMPEL>.dump (Custom-Format, komprimiert)
# Zielverzeichnis überschreibbar: ./scripts/backup/backup.sh /pfad/zu/backups   (oder BACKUP_DIR=…)
```

Das Skript bricht ab, wenn keine DB-URL gesetzt ist (nie gegen die falsche DB), und loggt die URL nie.

**Der Dump wird gelesen, bevor er veröffentlicht wird.** Nach `pg_dump` und **vor** der Prüfsumme
läuft die Leseprüfung gegen den Arbeitsstand. Scheitert sie, endet das Skript mit **Exit 4** und es
bleibt *nichts* liegen.

Geprüft wird mit dem Werkzeug, **das da ist** — es gibt zwei Stufen, und jeder Lauf sagt, welche er
hatte:

| Stufe | Wann | Was sie belegt |
| --- | --- | --- |
| `pg_restore --list` | `pg_restore` ist auf dem PATH | Das **Archiv** ist lesbar: Header und Inhaltsverzeichnis. |
| Ersatzprüfung | `pg_restore` fehlt | Die **Datei** ist vollständig lesbar und nicht leer (jedes Byte wird zweimal über zwei unabhängige Wege gelesen, die Längen müssen gleich sein). Über das Archivformat sagt sie **nichts**. |

**Woran der Betreiber die Ersatzprüfung erkennt.** Der Lauf schreibt auf stderr:

```
[backup] HINWEIS: pg_restore nicht gefunden — die Lesepruefung laeuft als ERSATZ.
[backup] Der Dump wird vollstaendig gelesen, aber NICHT als Archiv geoeffnet.
[backup] Fuer die volle Pruefung: postgresql-client installieren (siehe RESTORE.md).
```

und auf stdout eine Zeile `[backup] Lesepruefung: Ersatz (pg_restore fehlt) — <n> Bytes vollstaendig
gelesen.` Dasselbe steht im `grund` der `letzter-lauf.json`: `Lesepruefung: Ersatz (pg_restore
fehlt)` statt `Lesepruefung: pg_restore --list`. **Die schwächere Prüfung gibt sich nie als die
stärkere aus.**

**So bekommt der Betreiber die volle Prüfung** (`pg_restore` steckt im Paket `postgresql-client`,
dasselbe Paket liefert auch `pg_dump`):

```bash
# Debian/Ubuntu (auch im Coolify-Container)
apt-get update && apt-get install -y postgresql-client
# Alpine
apk add --no-cache postgresql-client
# macOS
brew install libpq && brew link --force libpq
```

Danach fällt der Hinweis weg, und die Zeile im Protokoll lautet `Lesepruefung: pg_restore --list`.
Ein **fehlendes** `pg_restore` ist ausdrücklich **kein** Abbruchgrund: eine Leseprüfung, die die
Sicherung unmöglich macht, schützt nichts — sie nähme dem Betreiber das Backup weg, das er ohne sie
wenigstens gehabt hätte. Abgebrochen wird nur, wenn die Datei **tatsächlich** nicht lesbar ist.

> **Messgrenze, ausdrücklich:** `pg_restore --list` belegt, dass das **Archiv lesbar** ist (Header
> und Inhaltsverzeichnis); die Ersatzprüfung belegt nur, dass die **Datei** lesbar ist. **Keine von
> beiden** belegt, dass ein Restore in eine echte Datenbank gelingt — diesen Nachweis führt allein
> der Probelauf unten.

Exitcodes von `backup.sh`: **0** veröffentlicht · **1** Aufruf-/Umgebungsfehler (keine DB-URL,
`pg_dump` fehlt, `BACKUP_KEEP` ungültig, Zielverzeichnis nicht anlegbar) ·
**3** kein Hashwerkzeug · **4** der erzeugte Dump ist nicht lesbar (je nach Stufe von
`pg_restore --list` oder der Ersatzprüfung festgestellt) · **5** der Endname und alle Ausweichnamen
sind belegt, der vorhandene Bestand bleibt unberührt · **sonst** der
Exitcode des fehlgeschlagenen Werkzeugs (`pg_dump`, `shasum`, `date`, `sort`, `mv`, …). **Jeder**
dieser Ausgänge hinterlegt eine Fehlerspur (siehe unten) — auch der unerwartete, und auch der, bei
dem das Werkzeug der Fehlerspur selbst ausfällt.

### Was neben dem Dump entsteht — und warum das kein Zubehör ist

Jeder Dump wird **zusammen mit einem Sidecar** `klarwerk-<ZEITSTEMPEL>.dump.sha256` veröffentlicht
(64 Hex + Dateiname, Format wie `shasum -a 256`). Beides entsteht unter einem `.partial`-Arbeitsnamen
und wird erst am Ende umbenannt — **Sidecar zuerst, Dump zuletzt**.

Daraus folgen zwei Zusagen, die vorher nicht galten:

- **Ein abgebrochener `pg_dump` hinterlässt nichts.** Vorher blieb eine Teildatei unter dem
  Endnamen liegen; am Namen war sie von einem fertigen Backup nicht zu unterscheiden.
- **Ohne Prüfsumme wird nichts veröffentlicht.** Fehlt jedes Hashwerkzeug, endet das Skript mit
  **Exit 3** und es bleibt *nichts* liegen — statt eines unbeglaubigten Dumps mit Exit 0.

Es gibt damit keinen Zeitpunkt, zu dem ein `*.dump` ohne seine Prüfsumme sichtbar ist. Konsumenten
suchen nach genau diesem Muster.

> **Ein gescheiterter Lauf beschädigt die letzte gültige Sicherung nie.** Was schon im Verzeichnis
> liegt, wird weder überschrieben noch gelöscht — egal, an welcher Stelle der Lauf abbricht. Nach
> jedem Fehlschlag ist die vorhandene Sicherung Byte für Byte dieselbe, und ihre Prüfsumme passt
> weiterhin zu ihrem Dump.

So wird das eingehalten: Der Zeitstempel im Namen ist auf die **Sekunde** genau; zwei Läufe in
derselben Sekunde treffen denselben Endnamen. Ist dieser Name für die Sekunde schon vergeben, hängt
der Lauf eine Nummer an — `klarwerk-<ZEITSTEMPEL>_02.dump`, `_03`, und so fort — und sagt das auf
stderr. **Beide** Sicherungen bleiben damit erhalten, und es wird **nie** in eine bestehende Dump-
oder Prüfsummendatei geschrieben. Der Pfad in der Zeile `[backup] Dump nach: …` ist dabei schon der
endgültige. Sind ausnahmsweise `_02` bis `_99` derselben Sekunde vergeben, endet der Lauf mit
**Exit 5**, ohne irgendetwas anzufassen — lieber keine neue Sicherung als eine vorhandene
beschädigen.

> **Die Nummer zählt weiter, sie füllt keine Lücke.** Hat die Aufbewahrung `klarwerk-<Z>.dump`
> bereits entfernt und liegt noch `_03` da, heißt die nächste Sicherung derselben Sekunde `_04` —
> nicht wieder `klarwerk-<Z>.dump`. Das ist kein Schönheitsfehler: die Aufbewahrung liest das Alter
> am **Namen** ab (`.dump` vor `_02` vor `_03` …). Ein wiederverwendeter Name ließe die **jüngste**
> Sicherung wie die älteste aussehen, und der nächste Lauf würde genau sie löschen statt der
> wirklich ältesten. Wer im Verzeichnis eine Lücke in der Nummernfolge sieht, sieht also kein
> fehlendes Backup, sondern eine aufgeräumte ältere Sicherung.

**Ein gescheiterter Lauf räumt nur auf, was er selbst angelegt hat.** Nur ein Sidecar, den dieser
Lauf selbst unter einen zuvor freien Namen gelegt hat, nimmt er im Fehlerfall wieder weg (der Fall:
das zweite `mv` der Veröffentlichung scheitert, dann bliebe ein Sidecar ohne Dump liegen). Fremder
Bestand wird auch beim Aufräumen nicht angefasst — auch nicht ohne `BACKUP_KEEP`.

**Bedingung der Atomizitätszusage:** `mv` ist nur *innerhalb eines Dateisystems* atomar
(`rename(2)`). Deshalb liegt der Arbeitsname im selben Verzeichnis. Zeigt `BACKUP_DIR` auf eine
Netzfreigabe mit anderer Semantik, gilt die Zusage nicht — einmal am echten Zielverzeichnis prüfen.

### Coolify / Cron
Als Scheduled-Task (z. B. täglich) hinterlegen:
```
DATABASE_URL="$KLARWERK_DATABASE_URL" BACKUP_DIR=/data/backups BACKUP_KEEP=14 \
  /app/scripts/backup/backup.sh
```

### Aufbewahrung: `BACKUP_KEEP`

Das Skript räumt selbst auf — nach einer angesagten Regel, nicht nach Bedarf:

- **`BACKUP_KEEP` nicht gesetzt = es wird nichts gelöscht.** Das ist der Standard; ein Update nimmt
  keiner bestehenden Installation ein Backup weg. Wer nicht aufräumt, braucht nichts zu tun.
- **`BACKUP_KEEP=<n≥1>`:** nach jeder erfolgreichen Veröffentlichung bleiben höchstens `n`
  **vollständige** Sicherungen (Dump **mit** Sidecar) im Zielverzeichnis; die ältesten darüber hinaus
  werden entfernt, Dump und Sidecar immer gemeinsam. Die Reihung kommt aus dem **Dateinamen** (UTC,
  sortierbar), nicht aus der Änderungszeit — ein Kopiervorgang verstellt mtime, den Namen nicht.
- **Welche bleibt, welche geht:** Es bleiben die `n` Sicherungen mit dem **spätesten** Zeitstempel im
  Namen; bei gleicher Sekunde entscheidet die angehängte Nummer (`_04` ist jünger als `_03`, und
  `klarwerk-<Z>.dump` ohne Nummer ist die erste dieser Sekunde, also die älteste). Weil eine Nummer
  nie ein zweites Mal vergeben wird, ist diese Reihenfolge auch nach vielen Aufräumläufen noch die
  Altersreihenfolge.
- **Die Zahl wird dezimal gelesen, auch mit führender Null:** `BACKUP_KEEP=08` heißt **acht**,
  `BACKUP_KEEP=010` heißt **zehn**. (In Shell-Arithmetik wäre eine führende Null eine Basisangabe —
  `010` wäre oktal 8. Der Lauf meldet bei einer führenden Null beide Werte:
  `BACKUP_KEEP=08 (dezimal gelesen: 8)`.)
- **Vier Zusagen:** (a) die soeben veröffentlichte Sicherung wird nie gelöscht, auch bei
  `BACKUP_KEEP=1` nicht; (b) ein `*.dump` **ohne** Sidecar wird weder mitgezählt noch gelöscht — es
  ist kein regulär entstandenes Backup dieses Skripts; (c) ein `*.partial` eines gleichzeitig
  laufenden Laufs wird nie angefasst; (d) gelöscht wird Dump zuerst, Sidecar zuletzt, damit nie ein
  Dump ohne seine Prüfsumme dasteht.
- **`BACKUP_KEEP=0`, leer oder nicht-numerisch: Abbruch mit Exit 1, ohne zu löschen und ohne zu
  sichern.** Ein Tippfehler in einer Coolify-Maske darf niemals den Bestand räumen.
- Der Lauf meldet auf stdout, wie viele Sicherungen bleiben und welche Dateien er entfernt hat.

**Offene Betreiberpflicht bleibt:** Offsite-Kopie und Verschlüsselung der Dumps
(`docs/operations/backup-disaster-recovery.md` §3/§12). Beides liefert dieses Skript nicht.

### Was der letzte Lauf getan hat: `letzter-lauf.json`

Jeder Lauf hinterlegt `<ZIEL>/letzter-lauf.json` — **der gescheiterte zuerst**. Vorher endete ein
Fehlschlag in einem Cron-Log, das niemand liest: im Verzeichnis war „gestern ist die Sicherung
gescheitert" nicht von „gestern lief kein Cron" zu unterscheiden.

**Das gilt auch für den unerwarteten Ausgang.** Schlägt irgendein Werkzeug fehl — `shasum` endet mit
einem Fehler, `mv` kann nicht schreiben, der Datenträger ist voll —, wird die Spur trotzdem
geschrieben, mit dem Exitcode dieses Werkzeugs. Ohne diese Zusage bliebe die **Erfolgsmeldung des
Vortags** stehen, und der Betreiber läse „letzter Lauf erfolgreich", während der letzte Lauf
gescheitert ist. Kann die Spur selbst nicht geschrieben werden (z. B. weil `mv` das Werkzeug ist, das
fehlschlägt), sagt das Skript ausdrücklich `Es konnte KEIN Ergebnis hinterlegt werden` — es erfindet
keine.

**Blieb das Aufräumen unvollständig** (Dateien konnten nicht entfernt werden), steht die Sicherung
weiter auf `"erfolg"` — sie liegt ja gelesen und beglaubigt da —, aber der `grund` nennt den Rest:
`Aufbewahrung unvollstaendig: <n> Sicherung(en) konnten nicht entfernt werden.`

**Bricht ein Werkzeug NACH der Veröffentlichung ab** (die Aufbewahrung ist der einzige Abschnitt, der
danach noch läuft), ist der **Lauf** gescheitert — `"ergebnis": "fehler"` mit dem Exitcode dieses
Werkzeugs —, aber die **Sicherung** ist es nicht: Dump und Prüfsumme liegen vollständig da. Die Spur
nennt sie dann in `datei`/`bytes`/`sha256` und sagt im `grund`, was offen blieb. Sie bestreitet die
Sicherung nicht; eine vorhandene zu leugnen richtet denselben Schaden an wie eine zu erfinden —
der Betreiber hielte sich für ungesichert.

Genau sieben Felder: `zeit` (UTC wie im Dateinamen), `ergebnis` (`"erfolg"` oder `"fehler"`),
`grund`, `exitcode`, `datei`, `bytes`, `sha256`. `datei`/`bytes`/`sha256` richten sich nach dem
**Dateibestand**, nicht nach dem Ausgang: ohne veröffentlichte Sicherung stehen sie auf `null` — nie
ein Teilwert, der wie ein Erfolg aussieht —, mit veröffentlichter Sicherung sind sie gefüllt, auch
wenn `ergebnis` auf `"fehler"` steht (Absatz darüber). `zeit` steht auf `null`, wenn `date` selbst
ausfällt: dann ist die Zeit unbekannt, und der `grund` sagt es. Eine erfundene Uhrzeit gibt es nicht.
Geschrieben wird atomar (Arbeitsname im selben Verzeichnis, dann umbenannt), ein gleichzeitig
lesender Betrachter sieht also immer einen vollständigen Datensatz. **Die DB-URL steht nie darin.**

Drei Dinge, die die Datei **nicht** sagt:

- **Fehlt sie, bedeutet das „kein Lauf hat je ein Ergebnis hinterlegt" — nicht „alles in Ordnung".**
- Sie sagt nie „aktuell" oder „eine Sicherung ist vorhanden", sondern ausschließlich, was der
  **letzte Lauf** getan hat, mit seinem Zeitstempel. Ob eine brauchbare Sicherung existiert,
  beantwortet das Verzeichnis.
- Lässt sich das Zielverzeichnis nicht anlegen oder beschreiben, sagt das Skript ausdrücklich, dass
  **kein** Ergebnis hinterlegt werden konnte. Eine erfundene Erfolgsmeldung gibt es nicht.

## Wiederherstellung (Schritt für Schritt)

> Die Dumps sind im **Custom-Format** (`pg_dump -Fc`) → Wiederherstellung mit `pg_restore`.

0. **Prüfsumme prüfen — vor allem anderen.**
   ```bash
   shasum -a 256 ./backups/klarwerk-<ZEITSTEMPEL>.dump
   cat ./backups/klarwerk-<ZEITSTEMPEL>.dump.sha256
   ```
   Stimmen die 64 Hex nicht überein oder fehlt der Sidecar, **wird nicht restauriert**. Der
   automatisierte Drill (`scripts/backup/restore-drill.sh`) erzwingt genau das und startet
   `pg_restore` in diesem Fall gar nicht erst (Exit 10 bzw. 11).

1. **App stoppen** (kein Schreibzugriff während des Restores) — in Coolify den Service pausieren.
2. **Ziel-DB bereitstellen.** In eine LEERE Datenbank restoren (empfohlen: neue DB anlegen, dann
   umschalten):
   ```bash
   createdb -h host -U user klarwerk_restore
   ```
3. **Restore einspielen:**
   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists \
     -h host -U user -d klarwerk_restore ./backups/klarwerk-<ZEITSTEMPEL>.dump
   ```
   - `--clean --if-exists`: vorhandene Objekte werden vor dem Einspielen entfernt (idempotenter
     Restore in eine bereits teilbefüllte DB).
   - `--no-owner --no-privileges`: passt zum Dump (Rollen/Rechte werden nicht erzwungen).
4. **Integrität gegen den Dump prüfen:** Der automatisierte Drill unten prüft **jede Tabelle, die
   das Produkt anlegt**, und vergleicht pro Tabelle die COPY-Datenzeilen aus dem Custom-Dump mit
   `SELECT count(*) FROM public.<tabelle>` der restaurierten Datenbank. Die Ausgabe nennt
   `<tabelle>: Dump=<Zahl> Datenbank=<Zahl>`, einschließlich `0 = 0`. Für den Drill einen
   **weiteren leeren Zielnamen** verwenden, da die gerade restaurierte DB nicht mehr leer ist.
5. **Umschalten:** `KLARWERK_DATABASE_URL`/`DATABASE_URL` der App auf die wiederhergestellte DB zeigen
   lassen (Coolify-Env), App **wieder starten**.
6. **Verifizieren:** einloggen und ein bekanntes Wissensobjekt öffnen.

   **`/health` ist dabei kein Restorebeleg.** Die Route ist datenbankfrei und sagt nur: „Der
   Prozess antwortet." Der eigentliche Beleg ist die Anmeldung mit einem Konto **aus dem Dump**
   und anschließend `GET /api/audit/verify` — die Abfrage läuft durch die gestartete Anwendung
   gegen die wiederhergestellte Datenbank. Erfolgreich ist sie bei
   `linkageBreaks === 0`, `unresolvedDeviations === 0` und `uncheckedDeviations === 0`.
   `report.ok` und `serialisationDeviations` sind **kein** Abnahmekriterium (Begründung:
   `docs/operations/restore-drill.md`).

   **Und dann ein Objekt wirklich lesen.** Eine gleiche Zeilenzahl ist kein Inhaltsbeleg. Ein
   Wissensobjekt aufschlagen, seine Belegliste ansehen (`GET /api/kos/<id>/evidence`) und einen
   Anhang öffnen (`GET /api/objects/<id>/raw`). Genau diese zwei Abrufe fährt der Drill unten
   selbst — und er vergleicht dabei **den Belegdatensatz** aus der Datenbank mit dem in der
   Antwort (gleiche `id`, gleiche `objectId`). Ein Textvorkommen der Kennung irgendwo in der
   Antwort ist ausdrücklich **kein** Nachweis einer Zuordnung.

## Der automatisierte Probelauf

Statt die Schritte 0–6 von Hand zu gehen:

```bash
RESTORE_DB=klarwerk_drill_<DATUM> \
DRILL_LOGIN_EMAIL=<konto-mit-ko.validate> \
DRILL_LOGIN_PASSWORT='…' \
./scripts/backup/restore-drill.sh ./backups/klarwerk-<ZEITSTEMPEL>.dump
```

Der Startbefehl ist `npx tsx services/app/src/server.ts`, wie im Produktionsimage. Dass der Drill
dabei **den** Prozess trifft, der wirklich horchte — und einen fremden nie —, ist gemessen:
`tests/backup-drill/prozesszuordnung.test.ts` (echter `npx`/`tsx`-Baum, ohne Datenbank) und
`tests/backup-drill/echter-wiederanlauf.integration.test.ts` (echter Dump gegen echte PostgreSQL).
Einzelheiten und Messgrenzen: `docs/operations/restore-drill.md`.

### Welche Tabellen geprüft werden

**Jede, die das Produkt anlegt.** Die Liste steht einmal — `PFLICHTTABELLEN` in
`scripts/backup/restore-drill.sh` — und ist an die Migration gebunden:
`tests/backup-drill/tabellensatz.test.ts` hält sie gegen die DDL-Stufen, die `migrate()` wirklich
fährt (`services/app/src/db.ts`). Kommt eine Migration dazu und der Drill wächst nicht mit, ist das
Tor rot. Hier steht sie deshalb **bewusst nicht ein drittes Mal** abgeschrieben.

Bis JOB 4097 waren es vier Namen (`kos`, `users`, `audit`, `objects`). Ein Restore, der die
Entwürfe, die Belege samt Anhangszuordnung (`ko_evidence`), die Validierungen, die Konfliktvermerke,
die Import-Kandidaten oder die Lesevarianten verlor, kam damit mit **Exit 0** durch.

**Kein COPY-Block heißt nicht „leere Tabelle".** Steht die Tabelle mit einem Datenblock im
Inhaltsverzeichnis des Archivs (`pg_restore --list`), ist das eine gemessene 0. Steht sie nicht
darin, führt der Dump für sie **keinen Bestand** — Exit 22, kein stilles Grün.

### Was ein bestandener Drill belegt — und was nicht

**Belegt:** wiederherstellbarer Dump, vollständiger Tabellensatz mit gleichen Zeilenzahlen,
startende Anwendung, Anmeldung mit einem Konto aus dem Dump, tragende Auditkette, **jede Belegzeile
findet ihren Anhang in `objects`** — und, sofern der Bestand ein solches Objekt führt, ein
Wissensobjekt samt Beleg und Anhangsinhalt, über die laufende Anwendung zurückgelesen. Führt der
Bestand kein Objekt mit Beleg, sagt der Drill ausdrücklich, dass dieser Punkt **NICHT gemessen**
wurde — er behauptet ihn nie.

**Ein Beleg ohne seinen Anhang ist etwas anderes als kein Beleg.** Findet der Drill eine Belegzeile,
deren `objectId` in `objects` keine Zeile hat, endet er mit **73** und nennt Zahl und Beispiel; der
Satz „nicht gemessen" steht dann gerade nicht da. Die Zeilenzählung sieht diesen Schaden nicht —
beide Tabellen sind so lang wie im Dump, nur die Verbindung fehlt.

**Nicht belegt:** der Cloud-/Coolify-Weg (Umschalten der `DATABASE_URL`, Neustart des Dienstes;
`docs/operations/maintenance-update-process.md` U4/U5), eine **Dateiablage außerhalb der Datenbank**
(Anhänge liegen heute in `objects` und damit im Dump) sowie Offsite-Kopie und Verschlüsselung.

Exitcodes des Drills (dieselben wie in der Betriebsanleitung und im Skriptkopf):

| Code | Bedeutung |
|---|---|
| `0` | Drill bestanden |
| `1` | Aufruf-/Umgebungsfehler |
| `10` | Sidecar fehlt oder ist kein 64-Hex; kein `pg_restore` |
| `11` | Prüfsumme weicht ab; kein `pg_restore` |
| `20` | Ziel nicht anlegbar, nicht erreichbar oder nicht leer |
| `21` | Restore gescheitert |
| `22` | Fehlender Bestand: eine Pflichttabelle fehlt nach dem Restore oder der Dump führt für sie keinen Bestand; alle Namen in einer Meldung |
| `23` | Zeilenabweichung mit Tabellenname, `Dump=<Zahl>` und `Datenbank=<Zahl>` |
| `24` | Zeilenzählung nicht messbar: Inhaltsverzeichnis, Extraktion, COPY-Format oder SQL-Abfrage; Tabellenname wird genannt |
| `30` | Anwendung nicht lebendig (PID-Datei oder `/health`) |
| `31` | `node`, `npx` oder lokales `tsx` fehlt oder ist nicht ausführbar; kein Paketdownload |
| `60` | Login fehlgeschlagen |
| `61` | Auditverifikation abgelehnt, insbesondere fehlendes `ko.validate` |
| `62` | Wissensnachweis: Aufbaufehler (Bestand nicht befragbar, Route/Recht antworten nicht mit 200) — kein Befund |
| `70` | `linkageBreaks ≠ 0` |
| `71` | `unresolvedDeviations ≠ 0` |
| `72` | `uncheckedDeviations ≠ 0` |
| `73` | Wissensnachweis: Befund — eine Belegzeile zeigt auf einen Anhang, den `objects` nicht führt, oder Objekt, Beleg bzw. Anhangsinhalt kam nicht zurück, obwohl die Datenbank sie führt |
| `80` | Reaping-/PID-Identitätsprüfung fehlgeschlagen |

Vollständige Anleitung und Grenzen: `docs/operations/restore-drill.md`.

## Hinweise
- Der Dump ist konsistent (pg_dump snapshot). Für Point-in-Time-Recovery bräuchte es zusätzlich WAL-
  Archivierung — bewusst außerhalb dieses schlanken S1-Helfers.
- Secrets: die DB-URL nur über Env/Coolify-Secrets reichen, nie ins Repo/Log.
