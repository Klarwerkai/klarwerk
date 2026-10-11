# Sicherungsbestand — welche Schutzwege es gibt, wo sie liegen, wer zuständig ist (ADMIN-13)

*Stand: 09.10.2026, Fassung auf Basis `1322621aa` (veröffentlicht zuletzt .796 / `9dc24b295`).
Erhoben am Quelltext und an den Betriebsanleitungen dieses Repositorys; dazu die datierten,
lesenden Laufzeitbefunde vom 09.10.2026 im Abschnitt „Laufzeitbefunde". Was auch dort nicht
feststellbar war, steht unten als offene Voraussetzung.*

## Ausgangslage und die Regel, die daraus folgt

Die Verwaltung meldete am 09.10.2026 für die Sicherung: *Das Sicherungsverzeichnis gibt es nicht.*
Das Verzeichnis, in dem sie gesucht hat, war `/app/backups` — die **Vorgabe**, die gilt, wenn am
Server `BACKUP_DIR` nicht gesetzt ist (`scripts/backup/backup.sh:61-62`, gespiegelt in
`services/app/src/routes/admin-routes.ts`, `sicherungsVerzeichnis`). Der Zeitplan der
Betriebsanleitung schreibt aber mit `BACKUP_DIR=/data/backups`
(`scripts/backup/RESTORE.md`, Abschnitt „Coolify / Cron"), und Snapshots des Hosters liegen ganz
außerhalb der Anwendung (`docs/operations/deploy-hetzner.md:135`).

**Ein fehlendes `/app/backups` beweist deshalb nicht, dass es keine Sicherung gibt.** Es beweist
nur, dass an genau diesem Ort keine liegt. Seit ADMIN-13 sagt die Verwaltung das selbst: unter
*System → Sicherung* steht, ob der Ort aus `BACKUP_DIR` oder aus der Vorgabe stammt, und dass
andere Orte nicht geprüft wurden.

## Laufzeitbefunde vom 09.10.2026 (lesend, mit begrenztem Umfang)

Drei lesende Bestandsaufnahmen am Betrieb, ohne Änderung an Konfiguration, Konten, Dateien oder
Prozessen und ohne Geheimnisse oder Dateninhalte. Quelle sind die Hilfsbelege des Auftrags
(`QUELLEN-HILFE-ADMIN13-LAUFZEIT-INVENTAR.json`, `QUELLEN-HILFE-ADMIN13-COOLIFY-BESTAND.json`,
`QUELLEN-HILFE-ADMIN13-DATENBANK-ZUORDNUNG.json`); jede Aussage gilt nur für den genannten Ort.

| Erhoben (UTC) | Ort | Befund | Was der Befund NICHT sagt |
| --- | --- | --- | --- |
| 07:25:36 | Anwendungshost `116.203.127.201`, Container `e7daf1575147…`, Abbild `…:1322621aaa89` | `BACKUP_DIR` nicht gesetzt; keine Einhängungen (Mounts); `/data/backups`, `/app/backups` und `/srv/klarwerk-backups` existieren auf dem Host nicht; keine Root-Crontab (Rückgabe 1), keine Sicherungszeitpläne darin | nichts über andere Hosts, Provider-Snapshots oder Offsite-Kopien |
| 07:27:08 | Coolify zur Anwendung `b3rgijsv5jtuhreh9ypyjase` | keine Application Scheduled Tasks; `/app/backups` und `/data/backups` fehlen im Container; Coolify-Datenbanksicherungen: keine Zeitpläne, keine Läufe | siehe nächste Zeile: die Datenbank ist **keine** Coolify-Ressource |
| 07:30:47 | Datenbankhost `46.225.24.151`, native PostgreSQL 18.6 unter `10.10.0.3:5432`, Datenbank `klarwerk` | `archive_mode` aus, `wal_level` replica, `archive_command` gesetzt, aber 0 archivierte WAL-Segmente — **keine Point-in-Time-Wiederherstellung**; eine begrenzte Verzeichnissuche fand Namen mit „sicherung"/„backup" unter `/srv/klarwerk-memory` und `/srv/klarwerk-neubau` | ob eines dieser Verzeichnisse Sicherungen der Produktdatenbank enthält, ist nicht geprüft; ein Zeitplan auf dem Datenbankhost ist weder belegt noch ausgeschlossen |

**Was daraus folgt.** Der in `scripts/backup/RESTORE.md` beschriebene Weg — `backup.sh` als
Coolify-/Cron-Aufgabe der Anwendung mit `BACKUP_DIR` — ist am Anwendungshost **nicht
eingerichtet**: kein Zeitplan, kein Verzeichnis, keine Einhängung. Die Karte *System → Sicherung*
zeigt dort deshalb zu Recht „Unbekannt — das Sicherungsverzeichnis gibt es nicht".

**Was daraus NICHT folgt.** Die Produktdatenbank ist eine native PostgreSQL auf einem eigenen
Host. Die leere Coolify-Abfrage fand zu `10.10.0.3` gar kein Datenbankobjekt; sie ist deshalb
**kein** Nachweis, dass diese PostgreSQL nicht gesichert wird. Sicherungen auf dem Datenbankhost
selbst, Provider-Snapshots und Offsite-Kopien bleiben **unbekannt**, bis sie belegt sind.

## Die vier Schutzwege

| Weg | Ort / Dienst | Umfang | Aufbewahrung | Zuständig | Beleg im Repository |
| --- | --- | --- | --- | --- | --- |
| **Exportdatei** | Download beim Empfänger; der Server behält keine Kopie | Bibliothek als JSON/Markdown/MediaWiki/HTML (validierte Wissensobjekte, vertrauliche nur mit `ko.validate`); Auditkette als JSON | beim Empfänger, ohne Vorgabe | wer exportiert: `ko.read` (Bibliothek), `ko.validate` (Auditkette) | `services/app/src/routes/library-routes.ts` (`/api/library/export`, Auditeintrag `library.export`), `services/app/src/routes/audit-routes.ts` (`/api/audit/export`, Auditeintrag `audit.exported`) |
| **Automatische Sicherung** | `pg_dump`-Archiv + `.sha256` in `BACKUP_DIR` (Vorgabe `<Wurzel>/backups`), Ergebnis des letzten Laufs in `letzter-lauf.json` | die ganze Datenbank — Wissensobjekte, Fassungen, Belege, Anhänge (`objects`), Beziehungen, Konten mit Rollen, Audit | `BACKUP_KEEP` (ohne Wert: nichts wird gelöscht) | Betrieb: Zeitplan (Coolify-Aufgabe oder Cron) mit `scripts/backup/backup.sh` | `scripts/backup/backup.sh`, `scripts/backup/RESTORE.md`; Auslösung **nicht** im Repository (kein Dienst in `docker-compose.prod.yml`) |
| **Papierkorb** | in der Datenbank (`kos.deletedAt`) | gelöschte Wissensobjekte samt Fassungen, Belegen und Anhängen; Entwürfe haben einen eigenen Papierkorb je Autor | 30 Tage (`TRASH_RETENTION_DAYS`, `services/knowledge-object/src/service.ts`), Endlöschung beim Start und alle 6 h (`services/app/src/trash-sweep-scheduler.ts`) | Admins (`users.manage`): Wiederherstellen, endgültig Löschen | `services/app/src/routes/ko-routes.ts` (`/api/kos/trash`, `/api/kos/:id/restore`), Auditeinträge `ko.deleted`, `ko.restored`, `ko.purged` |
| **Restore-Nachweis** | `letzter-drill.json` neben dem geprobten Dump | Restore in eine eigene, leere Datenbank; Vergleich Beiträge, Anhänge, Beziehungen, Rechte; Start der Anwendung, Anmeldung, Auditkette, ein Objekt mit Beleg und Anhang | das letzte Protokoll; jeder Lauf ersetzt es | Betrieb: `scripts/backup/restore-drill.sh`, mindestens vierteljährlich (`docs/operations/backup-disaster-recovery.md` §7) | `scripts/backup/restore-drill.sh`, `docs/operations/restore-drill.md` |

Sichtbar sind alle vier unter *System → Sicherung* (`GET /api/admin/sicherungen`, nur
`users.manage`), je mit Zustand **Erfolg / Fehler / Unbekannt** (beim Restore zusätzlich
*Teilweise belegt*, beim Export *Keiner protokolliert*), Zeitpunkt, Grund und — wo etwas offen
ist — nächstem Schritt. Der Abruf selbst steht als `admin.sicherungen.gelesen` in der Auditkette
(einmal je Konto und Stunde).

## Prüfsumme und Wiederherstellung bleiben getrennt

* Die Liste der Sicherungsdateien sagt je Datei nur **„Prüfsummendatei vorhanden"** — die Route
  öffnet den Dump nicht und rechnet nichts nach.
* Der Restore-Nachweis wird **grün** nur aus einem Drillprotokoll mit Exit 0, nachgerechneter
  passender Prüfsumme, genanntem isoliertem Ziel und `gleich` in allen vier Vergleichen. Exit 0 mit
  einer nicht gemessenen Kategorie heißt *Teilweise belegt*.
* Ein Archiv, eine Prüfsummendatei oder ein Hashvergleich allein ergeben nie eine grüne
  Restore-Aussage.
* Fehlt einem „erfolg"-Protokoll ein Nachweis (Beginn, Ende, Sicherungsstand, Ziel, nachgerechneter
  Hash, eine Kategorie, Belege ohne Anhang, Rollenverteilung), heißt es *Teilweise belegt* und nennt
  die Lücken. Widerspricht es sich (Exitcode ≠ 0, Prüfsumme nicht passend, abweichende Kategorie,
  abweichende Rollenverteilung, Belege ohne Anhang > 0), ist es ein *Fehler* mit dem Schritt
  „nicht verlassen, Protokoll prüfen, Drill neu fahren" — auch wenn es selbst „gleich" behauptet.
* Eine beschädigte Sicherung (Drill Exit 10/11) erscheint als *Fehler* mit Grund und dem Schritt
  „nicht verwenden, andere Sicherung proben oder neu sichern"; `pg_restore` läuft dabei gar nicht.
  Ein belegtes Ziel endet mit 20, bevor etwas eingespielt wird — die Produktion wird von der Probe
  nie überschrieben.

## Sicherungsumfang je Bereich und Wissenspaket (produkt:20261010:poc-wiederherstellung-export)

*Stand 11.10.2026, Fassung `1.0.0-beta.1.899` (Basis `906282fd2`).*

**Umfang je Bereich.** Was im Dump liegt, was bewusst nicht und was es in dieser Fassung gar nicht
gibt, steht einmal als Daten in `services/app/src/sicherungsumfang.ts` und unter
*System → Sicherung* als Abschnitt „Sicherungsumfang je Bereich" (`GET /api/admin/sicherungen`,
Feld `umfang`). Die Auskunft ist an die laufende Fassung gebunden (Version aus `package.json`, Commit
aus `KLARWERK_BUILD_COMMIT`, Zahl der Tabellen aus `migrate()`).

| Bereich | Einordnung | Ablage | Wiederherstellungsfolge |
| --- | --- | --- | --- |
| Datenbanksicherung | im Dump | alle Tabellen aus `migrate()` | ganze Datenbank in eine leere Ziel-DB |
| Anhangsdateien (Originalbytes) | im Dump, eigens gezählt | `objects` (Bytes) + `ko_evidence` (Zuordnung) — dieselbe Datenbank, keine zweite Objektablage | Byte für Byte zurück (Drill Glied 7b) |
| Assistenzprofil (Name, Avatar-Kennung, Bewegung) | im Dump | `assistenz_profile` | gehört wieder genau dem Konto; Motivbild kommt aus der Anwendung |
| Persönliche Klara-Gespräche | im Dump | `klara_gespraeche` | nur das Konto selbst liest sie |
| Interaktionsgedächtnis | im Dump | `interaktions_gedaechtnis` | inzwischen abgelaufene Einträge löscht der Aufräumlauf |
| Klara-Sitzungen und Zustimmungen | im Dump | `klara_sessions`, `klara_session_consents` | abgelaufene Sitzungen werden abgeräumt |
| Avatar-Motive (Bilddateien) | ausgeschlossen | Anwendungspaket (`apps/web`) | kommen mit derselben Fassung; unbekannte Kennung → neutrale Ersatzgrafik |
| Eigene/generierte Avatarbilder | nicht vorhanden | — | nichts gesichert, kein Beleg |
| Persönliche Aufgabenlisten | nicht vorhanden | — | nichts gesichert; der letzte Schritt liegt im Gespräch |
| Speicher im Browser | ausgeschlossen | Gerät der Person | neu anmelden; Geräteeinstellungen bleiben im Browser |

**Getrennt erfasst und kein rückwirkender Beleg.** Der Drill schreibt die privaten Assistenzspeicher
als eigene Kategorie `vergleich.assistenz` ins Protokoll. Für Kernbereiche heißt ein Bereich
„belegt“, wenn die letzte Probe grün war UND jede seiner Tabellen mit beiden Zahlen gleich im
Protokoll steht. Für die privaten Assistenzbereiche zählt der Drill nur Zeilen; die Verwaltung zeigt
dort deshalb „nur Tabellenvergleich“ (`zeilen_gleich`) und nie „belegt“ — Inhalt, Kontozuordnung
und Fremdzugriffsschutz belegt allein die Abnahmeprobe, die die Inhalte je Konto zurückliest. Ein
Protokoll aus einer älteren Drillfassung ohne diese Kategorie lässt die Assistenzbereiche bei
„nicht gemessen". Die persönlichen Klara-Gespräche stehen seit diesem Auftrag auch im Dateninventar
(`klaragespraeche`).

**Wissenspaket.** In der Bibliothek unter *… → Export* gibt es das Format „Wissenspaket (ZIP mit
Fassungen und Anhängen)" (`GET /api/library/export?format=paket`). Dieselbe Grundmenge wie jeder
Export (validiert, Vertrauliches nur mit Prüfrecht, Sichtregel inkl. Space) und derselbe
Auditeintrag `library.export` (Format `paket`). Inhalt: `LIESMICH.md`, `MANIFEST.json` (Beiträge,
Fassungen, Anhänge, Quellen, Beziehungen, Verantwortung, Freigabe, Rechte, SHA-256 jeder Datei),
`zuordnungen.csv`, je Beitrag `aktuell.md`, `beitrag.json`, `fassungen/v<n>.md` (AKTUELL/HISTORISCH)
und die Originalanhänge. Eine früher vertrauliche Fassung und ein Anhang ohne gespeicherte Stufe
gehen nur an, wer Vertrauliches exportieren darf. Nicht enthalten (und im Paket so benannt):
nicht validierte Beiträge, Entwürfe, Papierkorb, persönliche Assistenzdaten, Konten und
Anmeldedaten, Auditkette, Anhangsdateien früherer Fassungen.

**Abnahmeprobe.** `tests/wiederherstellung-export/zusammenhang.integration.test.ts` fährt an einem
fiktiven, zusammenhängenden Bestand (zwei geschlossene Spaces, fünf Rollen, Fassungen, Anhang,
Quelle, Verantwortung, Freigabe, Beziehungen, Assistenzprofile, Gespräch) das unveränderte
`backup.sh` und `restore-drill.sh` in eine leere Datenbank, vergleicht Quelle und Ziel, die
Privatdaten je Konto und das Wissenspaket jeder Rolle, misst die Dauer des Drills und legt
Vergleichsbericht, Drillprotokoll und lesbare Exportstichproben unter
`test-results/poc-wiederherstellung-export/` ab. Weil der Prüfserver danach samt Speicher abgebaut
wird, steht jedes dieser Artefakte zusätzlich vollständig als Zeile `[PV-01 ARTEFAKT]` (Text
wörtlich, ZIP und Anhang als Base64, je mit SHA-256) im archivierten Protokoll des Laufs — dazu die
Exportmanifeste aller fünf Rollen und die Protokolle der beiden Fehlproben. Beschädigte (Exit 11) und unvollständige
(Exit 22) Sicherungen enden dort mit Protokoll; die Quelle bleibt unverändert.

## Was ausdrücklich NICHT erfüllt ist — Restarbeit und externe Voraussetzungen

Diese Punkte sind **offen** und werden von keiner Anzeige als erfüllt ausgegeben:

1. **Unabhängige tägliche Offsite-Sicherung** — weder eingerichtet noch im Repository belegt
   (`docs/operations/backup-disaster-recovery.md` §3/§12, `scripts/backup/RESTORE.md`
   „Offene Betreiberpflicht"). Bleibt offen für den B3-Kandidaten `fe14fb08`.
2. **Verbindliche RPO/RTO-Ziele** — nur Vorschläge (≤ 24 h / ≤ 4 h,
   `backup-disaster-recovery.md` §4), nicht festgelegt und durch keinen produktiven Drill bestätigt.
3. **Verschlüsselung der Dumps** — liefert `backup.sh` nicht.
4. **Der `backup.sh`-Weg am Anwendungshost ist nicht eingerichtet** (Laufzeitbefund 09.10.2026,
   oben): kein `BACKUP_DIR`, keine Einhängung, keine Application Scheduled Task, keine Root-Crontab,
   keines der untersuchten Verzeichnisse vorhanden. Ihn einzurichten wäre ein Betriebsauftrag (Nichtziel
   dieses Auftrags: keine neuen Backupdienste).
5. **Sicherung der nativen PostgreSQL auf `10.10.0.3`** — auf dem Datenbankhost weder belegt noch
   ausgeschlossen. Belegt ist nur: keine WAL-Archivierung (`archive_mode` aus, 0 archivierte
   Segmente), also keine Point-in-Time-Wiederherstellung. Ob Zeitpläne auf dem Datenbankhost laufen
   und was die gefundenen „sicherung"/„backup"-Verzeichnisse enthalten, ist ungeprüft.
5a. **Hetzner-/Provider-Snapshots und Offsite-Kopien** — in `deploy-hetzner.md` als Weg genannt;
   ob sie für Anwendungs- oder Datenbankhost aktiv sind und wie lange sie aufbewahrt werden, ist nicht
   belegt und wird nicht angezeigt.
6. **Ein datiertes Protokoll einer Probe gegen eine echte Sicherung des Produktionsbestands** —
   liegt nicht vor. Belegt ist die Probe in einer isolierten Umgebung mit fiktiven Daten
   (`tests/backup-drill/echter-wiederanlauf.integration.test.ts`: `backup.sh` → echte, leere
   PostgreSQL → laufende Anwendung → Protokoll → Verwaltungsroute). Das dort erzeugte
   Originalprotokoll wird seit Nacharbeit 2 unverändert unter
   `test-results/admin13-restore-drill/letzter-drill-w1-bestanden.json` (mit Begleitdatei: Kandidat,
   Zeit, SHA-256) und als Zeile `[ADMIN-13 DRILLPROTOKOLL]` in der Testausgabe erhalten. Eine Probe am produktiven
   Dump fährt der Betrieb, in eine eigene leere Datenbank; ein produktiver Restore ist nicht
   Gegenstand dieses Auftrags.
7. **Sicherungen in Unterverzeichnissen** — `scripts/insel/update-einspielen.sh` legt vor jedem
   Update eine eigene Sicherung unter `backups/<zeitstempel>-<lauf>/` ab. Die Verwaltung listet nur
   die oberste Ebene von `BACKUP_DIR`; diese Update-Sicherungen erscheinen dort nicht.
8. **Papierkorb der Entwürfe** — je Autor, nicht in der Verwaltungsauskunft gezählt.
9. **Echtheit der Spurdateien** — `letzter-lauf.json` und `letzter-drill.json` sind Dateien neben der
   Sicherung. Wer Schreibzugriff auf das Verzeichnis hat, kann sie ändern; die Verwaltung prüft
   Form und rechnet die Vergleichszahlen nach, kann aber eine von Hand geschriebene Datei nicht von
   einer echten unterscheiden.
10. **produkt:20261010:poc-wiederherstellung-export — offen.** Belegt ist die Probe ausschließlich
    in einer isolierten Umgebung mit fiktiven Daten. Offen bleiben: eine Probe am Sicherungsbestand
    der veröffentlichten Instanz (in eine eigene, leere Datenbank, durch den Betrieb), die Sicherung
    der nativen PostgreSQL selbst (Punkte 4–5), die reale fachliche PoC-Verantwortung, Vertretung
    und Schlussabnahme (keine Person benannt), eine Öffnungsprobe des Wissenspakets durch einen
    Menschen auf einem Kundenrechner sowie ein eigener Export der persönlichen Assistenzdaten für
    das Konto selbst (das Wissenspaket enthält sie bewusst nicht). Die Zustimmung zur externen KI
    legt die Probe über den Übergang der Produktablage an, nicht über `POST …/consent`: dieser Weg
    verlangt eine konfigurierte externe KI mit zentraler Freigabe, die der Prüfserver nicht hat.
