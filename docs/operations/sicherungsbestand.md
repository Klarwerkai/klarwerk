# Sicherungsbestand — welche Schutzwege es gibt, wo sie liegen, wer zuständig ist (ADMIN-13)

*Stand: 09.10.2026, Fassung auf Basis `1322621aa` (veröffentlicht zuletzt .796 / `9dc24b295`).
Erhoben am Quelltext und an den Betriebsanleitungen dieses Repositorys — **nicht** am produktiven
Server. Was nur dort feststellbar ist, steht unten als offene Voraussetzung.*

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
* Eine beschädigte Sicherung (Drill Exit 10/11) erscheint als *Fehler* mit Grund und dem Schritt
  „nicht verwenden, andere Sicherung proben oder neu sichern"; `pg_restore` läuft dabei gar nicht.
  Ein belegtes Ziel endet mit 20, bevor etwas eingespielt wird — die Produktion wird von der Probe
  nie überschrieben.

## Was ausdrücklich NICHT erfüllt ist — Restarbeit und externe Voraussetzungen

Diese Punkte sind **offen** und werden von keiner Anzeige als erfüllt ausgegeben:

1. **Unabhängige tägliche Offsite-Sicherung** — weder eingerichtet noch im Repository belegt
   (`docs/operations/backup-disaster-recovery.md` §3/§12, `scripts/backup/RESTORE.md`
   „Offene Betreiberpflicht"). Bleibt offen für den B3-Kandidaten `fe14fb08`.
2. **Verbindliche RPO/RTO-Ziele** — nur Vorschläge (≤ 24 h / ≤ 4 h,
   `backup-disaster-recovery.md` §4), nicht festgelegt und durch keinen produktiven Drill bestätigt.
3. **Verschlüsselung der Dumps** — liefert `backup.sh` nicht.
4. **Der Zeitplan am Produktionsserver** — ob eine Coolify-Aufgabe läuft, mit welchem `BACKUP_DIR`
   und ob dieses Verzeichnis im Anwendungscontainer eingehängt ist, ist nur am Server feststellbar.
   Liest die Anwendung ein anderes Verzeichnis als der Zeitplan beschreibt, meldet sie dort
   „Unbekannt" — das ist dann ein Befund über die Einrichtung, nicht über die Sicherung.
5. **Hetzner-Snapshots** — in `deploy-hetzner.md` als Weg genannt; ob sie aktiv sind und wie lange
   sie aufbewahrt werden, ist aus der Anwendung nicht feststellbar und wird nicht angezeigt.
6. **Ein datiertes Protokoll einer Probe gegen eine echte Sicherung des Produktionsbestands** —
   liegt nicht vor. Belegt ist die Probe in einer isolierten Umgebung mit fiktiven Daten
   (`tests/backup-drill/echter-wiederanlauf.integration.test.ts`: `backup.sh` → echte, leere
   PostgreSQL → laufende Anwendung → Protokoll → Verwaltungsroute). Eine Probe am produktiven
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
