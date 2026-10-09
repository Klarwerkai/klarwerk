// ================================================================================================
// ADMIN-13 · SICHERUNGSNACHWEISE — die Texte der vier Schutzwege in der Karte „Sicherung".
// ================================================================================================
//
// Exportdatei, Backup-Lauf, Papierkorb und Restore-Nachweis sind verschiedene Schutzwege mit
// verschiedenen Belegen (`services/app/src/routes/admin-routes.ts`, `schutzwegeFuer`). Jeder Weg
// nennt Umfang, Aufbewahrung, Zuständigkeit und seinen gemessenen Stand mit Zeitpunkt und Grund.
//
// WORTWAHL, AUSDRÜCKLICH: Grün („Erfolg") steht beim Restore nur, wenn der Server aus einem
// vollständigen Drillprotokoll `erfolg` gebildet hat. Prüfsumme und Wiederherstellung sind zwei
// Nachweise; kein Satz hier leitet das eine aus dem anderen ab.
//
// `audit.action.admin_sicherungen_gelesen` folgt der Namensregel der Prüfspur
// (`lib/auditAction.ts`: Aktionscode → `audit.action.<code>`) und trägt deshalb nicht das Präfix
// dieses Moduls — er steht aus demselben Grund in `legacySchluessel` wie die Aktionsnamen in
// `texte/auditprotokoll.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "sicherungsnachweise.",
  legacySchluessel: ["audit.action.admin_sicherungen_gelesen"],
  de: {
    "audit.action.admin_sicherungen_gelesen": "Sicherungsauskunft gelesen",
    "sicherungsnachweise.titel": "Schutzwege und Nachweise",
    "sicherungsnachweise.ort.env":
      "Gesucht wurde nur im Verzeichnis aus BACKUP_DIR. Sicherungen an anderen Orten — Snapshots des Hosters, Offsite-Kopien — prüft diese Anzeige nicht; sie sind damit weder belegt noch ausgeschlossen.",
    "sicherungsnachweise.ort.vorgabe":
      "BACKUP_DIR ist am Server nicht gesetzt; gesucht wurde nur im Vorgabeverzeichnis. Ein fehlendes Vorgabeverzeichnis beweist nicht, dass es keine Sicherung gibt: der Zeitplan der Betriebsanleitung schreibt nach /data/backups, und Snapshots des Hosters oder Offsite-Kopien prüft diese Anzeige nicht.",
    "sicherungsnachweise.zustand.erfolg": "Erfolg",
    "sicherungsnachweise.zustand.fehler": "Fehler",
    "sicherungsnachweise.zustand.unbekannt": "Unbekannt",
    "sicherungsnachweise.zustand.teilweise": "Teilweise belegt",
    "sicherungsnachweise.zustand.keiner": "Keiner protokolliert",
    "sicherungsnachweise.zeit": "Zeitpunkt: {{zeit}}",
    "sicherungsnachweise.grund": "Grund: {{grund}}",
    "sicherungsnachweise.schritt": "Nächster Schritt: {{schritt}}",
    "sicherungsnachweise.umfang": "Umfang: {{text}}",
    "sicherungsnachweise.aufbewahrung": "Aufbewahrung: {{text}}",
    "sicherungsnachweise.zustaendig": "Zuständig: {{text}}",
    "sicherungsnachweise.exitcode": "Exitcode {{code}}",
    "sicherungsnachweise.unbekannt.kein_verzeichnis":
      "Das Sicherungsverzeichnis gibt es nicht, also auch keine Spur darin.",
    "sicherungsnachweise.unbekannt.unlesbar": "Die Spur war nicht lesbar.",
    "sicherungsnachweise.unbekannt.fehlt":
      "Es liegt keine Spur vor — hier hat noch kein Lauf ein Ergebnis hinterlegt.",
    "sicherungsnachweise.unbekannt.ungueltig": "Die Spur hat nicht die zugesagte Form.",
    "sicherungsnachweise.unbekannt.kein_protokoll": "Ohne Auditprotokoll nicht feststellbar.",
    "sicherungsnachweise.unbekannt.protokoll_unlesbar": "Das Protokoll war nicht lesbar.",
    // Exportdatei.
    "sicherungsnachweise.export.titel": "Exportdatei",
    "sicherungsnachweise.export.umfang":
      "Bibliothek als JSON, Markdown, MediaWiki oder HTML (validierte Wissensobjekte; vertrauliche nur mit Prüfrecht) und die Auditkette als JSON.",
    "sicherungsnachweise.export.aufbewahrung":
      "Die Datei liegt beim Empfänger. Der Server behält keine Kopie; er protokolliert nur den Abruf.",
    "sicherungsnachweise.export.zustaendig":
      "Wer exportiert: Leserecht für die Bibliothek, Prüfrecht für die Auditkette.",
    "sicherungsnachweise.export.bibliothek":
      "Bibliothek zuletzt am {{zeit}} ({{format}}, {{anzahl}} Objekte), {{gesamt}} Exporte insgesamt",
    "sicherungsnachweise.export.auditkette":
      "Auditkette zuletzt am {{zeit}} ({{anzahl}} Einträge), {{gesamt}} Exporte insgesamt",
    "sicherungsnachweise.export.keiner": "Bisher ist kein Export protokolliert.",
    "sicherungsnachweise.export.schritt.unbekannt": "Das Auditprotokoll der Anlage prüfen.",
    // Automatische Sicherung — der letzte Lauf von backup.sh.
    "sicherungsnachweise.lauf.titel": "Automatische Sicherung (letzter Lauf)",
    "sicherungsnachweise.lauf.umfang":
      "Die ganze Datenbank als pg_dump-Archiv mit Prüfsummendatei: Beiträge, Anhänge, Beziehungen, Konten mit Rollen und das Auditprotokoll.",
    "sicherungsnachweise.lauf.aufbewahrung":
      "Nach BACKUP_KEEP; ohne Wert wird nichts gelöscht. Eine Offsite-Kopie und Verschlüsselung richtet das Skript nicht ein.",
    "sicherungsnachweise.lauf.zustaendig":
      "Betrieb: Zeitplan (Coolify oder Cron) mit scripts/backup/backup.sh.",
    "sicherungsnachweise.lauf.datei": "Sicherung: {{datei}}",
    "sicherungsnachweise.lauf.schritt.fehler":
      "Ausgabe des Laufs prüfen (Exitcodes in scripts/backup/RESTORE.md) und die Sicherung erneut starten.",
    "sicherungsnachweise.lauf.schritt.unbekannt":
      "Prüfen, ob der Zeitplan mit genau diesem BACKUP_DIR läuft. Ohne Spur ist hier kein Lauf belegt.",
    // Papierkorb.
    "sicherungsnachweise.papierkorb.titel": "Papierkorb",
    "sicherungsnachweise.papierkorb.umfang":
      "Gelöschte Wissensobjekte samt Fassungen, Belegen und Anhängen, bis zur Endlöschung wiederherstellbar. Entwürfe haben einen eigenen Papierkorb je Autor.",
    "sicherungsnachweise.papierkorb.aufbewahrung":
      "{{tage}} Tage ab dem Löschen, danach endgültige Löschung (geprüft beim Start und alle sechs Stunden).",
    "sicherungsnachweise.papierkorb.zustaendig":
      "Admins stellen wieder her oder löschen endgültig.",
    "sicherungsnachweise.papierkorb.anzahl_one": "{{count}} Wissensobjekt im Papierkorb",
    "sicherungsnachweise.papierkorb.anzahl_other": "{{count}} Wissensobjekte im Papierkorb",
    "sicherungsnachweise.papierkorb.naechste": "Nächste Endlöschung: {{zeit}}",
    "sicherungsnachweise.papierkorb.wiederhergestellt": "Zuletzt wiederhergestellt: {{zeit}}",
    "sicherungsnachweise.papierkorb.endgeloescht": "Zuletzt endgültig gelöscht: {{zeit}}",
    "sicherungsnachweise.papierkorb.nie": "bisher nie",
    "sicherungsnachweise.papierkorb.ohneProtokoll":
      "Wiederherstellungen und Endlöschungen sind ohne Auditprotokoll nicht feststellbar.",
    "sicherungsnachweise.papierkorb.schritt.unbekannt":
      "Den Papierkorb unter „Daten“ öffnen und das Serverprotokoll prüfen.",
    // Restore-Nachweis.
    "sicherungsnachweise.restore.titel": "Restore-Nachweis (Wiederherstellungsprobe)",
    "sicherungsnachweise.restore.umfang":
      "Eine Sicherung wird in eine eigene, leere Datenbank eingespielt und mit der laufenden Anwendung verglichen. Die Produktionsdatenbank wird dabei nicht angefasst.",
    "sicherungsnachweise.restore.aufbewahrung":
      "Das Protokoll des letzten Laufs liegt als letzter-drill.json neben der Sicherung; jeder neue Lauf ersetzt es.",
    "sicherungsnachweise.restore.zustaendig":
      "Betrieb: scripts/backup/restore-drill.sh, mindestens vierteljährlich.",
    "sicherungsnachweise.restore.sicherung": "Sicherungsstand: {{datei}} ({{zeit}})",
    "sicherungsnachweise.restore.ziel": "Isoliertes Ziel: {{ziel}}",
    "sicherungsnachweise.restore.dauer": "Probe von {{beginn}} bis {{ende}}",
    "sicherungsnachweise.restore.pruefsumme.passt": "Prüfsumme nachgerechnet: passt zur Sicherung",
    "sicherungsnachweise.restore.pruefsumme.abweichend": "Prüfsumme nachgerechnet: weicht ab",
    "sicherungsnachweise.restore.pruefsumme.fehlt": "Prüfsummendatei fehlt",
    "sicherungsnachweise.restore.pruefsumme.ungueltig": "Prüfsummendatei ohne gültige Prüfsumme",
    "sicherungsnachweise.restore.pruefsumme.nicht_geprueft": "Prüfsumme nicht nachgerechnet",
    "sicherungsnachweise.restore.getrennt":
      "Prüfsumme und Wiederherstellung sind getrennte Nachweise: eine passende Prüfsumme allein belegt keinen Restore.",
    "sicherungsnachweise.restore.kat.beitraege": "Beiträge",
    "sicherungsnachweise.restore.kat.anhaenge": "Anhänge",
    "sicherungsnachweise.restore.kat.beziehungen": "Beziehungen",
    "sicherungsnachweise.restore.kat.rechte": "Rechte",
    "sicherungsnachweise.restore.vergleich.gleich": "wie in der Sicherung",
    "sicherungsnachweise.restore.vergleich.abweichend": "weicht ab",
    "sicherungsnachweise.restore.vergleich.nicht_gemessen": "nicht gemessen",
    "sicherungsnachweise.restore.zeile": "{{kategorie}}: {{zustand}}",
    "sicherungsnachweise.restore.zahlen":
      "{{tabelle}} Sicherung {{dump}} / wiederhergestellt {{datenbank}}",
    "sicherungsnachweise.restore.waisen": "Belege ohne Anhang: {{n}}",
    "sicherungsnachweise.restore.rollen":
      "Rollen in der Sicherung: {{dump}} · wiederhergestellt: {{db}}",
    "sicherungsnachweise.restore.keineKonten": "keine Konten",
    "sicherungsnachweise.restore.gelesen": "Durch die Anwendung zurückgelesen: {{text}}",
    "sicherungsnachweise.restore.schritt.pruefsumme":
      "Diese Sicherung ist beschädigt oder ohne gültige Prüfsumme — nicht verwenden. Eine andere Sicherung proben oder neu sichern.",
    "sicherungsnachweise.restore.schritt.ziel":
      "Eine eigene, leere Zieldatenbank (RESTORE_DB) nennen und die Probe wiederholen. Die Produktion wurde nicht angefasst.",
    "sicherungsnachweise.restore.schritt.bestand":
      "Die Sicherung ist unvollständig oder weicht ab — neu sichern und die Probe mit der neuen Sicherung wiederholen.",
    "sicherungsnachweise.restore.schritt.aufbau":
      "Aufbaufehler der Probe, kein Befund an der Sicherung — Umgebung prüfen und die Probe wiederholen.",
    "sicherungsnachweise.restore.schritt.audit":
      "Die Auditkette der Sicherung trägt nicht — die Quelle prüfen, bevor auf diese Sicherung gebaut wird.",
    "sicherungsnachweise.restore.schritt.teilweise":
      "Die Probe lief durch, aber nicht jeder Vergleich ist gemessen. Die offenen Punkte stehen oben; bis sie gemessen sind, ist die Wiederherstellung nur teilweise belegt.",
    "sicherungsnachweise.restore.schritt.unbekannt":
      "Den Restore-Drill gegen eine eigene, leere Datenbank fahren (scripts/backup/restore-drill.sh). Bis dahin ist keine Wiederherstellung belegt.",
  },
  en: {
    "audit.action.admin_sicherungen_gelesen": "Backup information read",
    "sicherungsnachweise.titel": "Protection paths and evidence",
    "sicherungsnachweise.ort.env":
      "Only the directory from BACKUP_DIR was searched. This display does not check backups in other places — host snapshots, offsite copies; they are neither proven nor ruled out.",
    "sicherungsnachweise.ort.vorgabe":
      "BACKUP_DIR is not set on the server; only the default directory was searched. A missing default directory does not prove that there is no backup: the schedule in the operations guide writes to /data/backups, and this display does not check host snapshots or offsite copies.",
    "sicherungsnachweise.zustand.erfolg": "Success",
    "sicherungsnachweise.zustand.fehler": "Failure",
    "sicherungsnachweise.zustand.unbekannt": "Unknown",
    "sicherungsnachweise.zustand.teilweise": "Partially proven",
    "sicherungsnachweise.zustand.keiner": "None recorded",
    "sicherungsnachweise.zeit": "Time: {{zeit}}",
    "sicherungsnachweise.grund": "Reason: {{grund}}",
    "sicherungsnachweise.schritt": "Next step: {{schritt}}",
    "sicherungsnachweise.umfang": "Scope: {{text}}",
    "sicherungsnachweise.aufbewahrung": "Retention: {{text}}",
    "sicherungsnachweise.zustaendig": "Responsible: {{text}}",
    "sicherungsnachweise.exitcode": "Exit code {{code}}",
    "sicherungsnachweise.unbekannt.kein_verzeichnis":
      "The backup directory does not exist, so there is no trace in it either.",
    "sicherungsnachweise.unbekannt.unlesbar": "The trace was not readable.",
    "sicherungsnachweise.unbekannt.fehlt": "There is no trace — no run has left a result here yet.",
    "sicherungsnachweise.unbekannt.ungueltig": "The trace does not have the promised format.",
    "sicherungsnachweise.unbekannt.kein_protokoll": "Cannot be determined without an audit log.",
    "sicherungsnachweise.unbekannt.protokoll_unlesbar": "The log was not readable.",
    "sicherungsnachweise.export.titel": "Export file",
    "sicherungsnachweise.export.umfang":
      "Library as JSON, Markdown, MediaWiki or HTML (validated knowledge objects; confidential ones only with review rights) and the audit chain as JSON.",
    "sicherungsnachweise.export.aufbewahrung":
      "The file stays with the recipient. The server keeps no copy; it only records the download.",
    "sicherungsnachweise.export.zustaendig":
      "Whoever exports: read access for the library, review rights for the audit chain.",
    "sicherungsnachweise.export.bibliothek":
      "Library last on {{zeit}} ({{format}}, {{anzahl}} objects), {{gesamt}} exports in total",
    "sicherungsnachweise.export.auditkette":
      "Audit chain last on {{zeit}} ({{anzahl}} entries), {{gesamt}} exports in total",
    "sicherungsnachweise.export.keiner": "No export has been recorded so far.",
    "sicherungsnachweise.export.schritt.unbekannt": "Check the installation's audit log.",
    "sicherungsnachweise.lauf.titel": "Automatic backup (last run)",
    "sicherungsnachweise.lauf.umfang":
      "The whole database as a pg_dump archive with checksum file: posts, attachments, relationships, accounts with roles and the audit log.",
    "sicherungsnachweise.lauf.aufbewahrung":
      "According to BACKUP_KEEP; without a value nothing is deleted. The script does not set up an offsite copy or encryption.",
    "sicherungsnachweise.lauf.zustaendig":
      "Operations: schedule (Coolify or cron) running scripts/backup/backup.sh.",
    "sicherungsnachweise.lauf.datei": "Backup: {{datei}}",
    "sicherungsnachweise.lauf.schritt.fehler":
      "Check the run's output (exit codes in scripts/backup/RESTORE.md) and start the backup again.",
    "sicherungsnachweise.lauf.schritt.unbekannt":
      "Check whether the schedule runs with exactly this BACKUP_DIR. Without a trace, no run is proven here.",
    "sicherungsnachweise.papierkorb.titel": "Trash",
    "sicherungsnachweise.papierkorb.umfang":
      "Deleted knowledge objects with their versions, evidence and attachments, restorable until final deletion. Drafts have a separate trash per author.",
    "sicherungsnachweise.papierkorb.aufbewahrung":
      "{{tage}} days after deletion, then final deletion (checked at start-up and every six hours).",
    "sicherungsnachweise.papierkorb.zustaendig": "Admins restore or delete permanently.",
    "sicherungsnachweise.papierkorb.anzahl_one": "{{count}} knowledge object in the trash",
    "sicherungsnachweise.papierkorb.anzahl_other": "{{count}} knowledge objects in the trash",
    "sicherungsnachweise.papierkorb.naechste": "Next final deletion: {{zeit}}",
    "sicherungsnachweise.papierkorb.wiederhergestellt": "Last restored: {{zeit}}",
    "sicherungsnachweise.papierkorb.endgeloescht": "Last permanently deleted: {{zeit}}",
    "sicherungsnachweise.papierkorb.nie": "never so far",
    "sicherungsnachweise.papierkorb.ohneProtokoll":
      "Restores and final deletions cannot be determined without an audit log.",
    "sicherungsnachweise.papierkorb.schritt.unbekannt":
      "Open the trash under “Data” and check the server log.",
    "sicherungsnachweise.restore.titel": "Restore evidence (restore test)",
    "sicherungsnachweise.restore.umfang":
      "A backup is loaded into a separate, empty database and compared with the running application. The production database is not touched.",
    "sicherungsnachweise.restore.aufbewahrung":
      "The log of the last run is stored as letzter-drill.json next to the backup; every new run replaces it.",
    "sicherungsnachweise.restore.zustaendig":
      "Operations: scripts/backup/restore-drill.sh, at least quarterly.",
    "sicherungsnachweise.restore.sicherung": "Backup used: {{datei}} ({{zeit}})",
    "sicherungsnachweise.restore.ziel": "Isolated target: {{ziel}}",
    "sicherungsnachweise.restore.dauer": "Test from {{beginn}} to {{ende}}",
    "sicherungsnachweise.restore.pruefsumme.passt": "Checksum recomputed: matches the backup",
    "sicherungsnachweise.restore.pruefsumme.abweichend": "Checksum recomputed: does not match",
    "sicherungsnachweise.restore.pruefsumme.fehlt": "Checksum file missing",
    "sicherungsnachweise.restore.pruefsumme.ungueltig": "Checksum file without a valid checksum",
    "sicherungsnachweise.restore.pruefsumme.nicht_geprueft": "Checksum not recomputed",
    "sicherungsnachweise.restore.getrennt":
      "Checksum and restore are separate pieces of evidence: a matching checksum alone proves no restore.",
    "sicherungsnachweise.restore.kat.beitraege": "Posts",
    "sicherungsnachweise.restore.kat.anhaenge": "Attachments",
    "sicherungsnachweise.restore.kat.beziehungen": "Relationships",
    "sicherungsnachweise.restore.kat.rechte": "Rights",
    "sicherungsnachweise.restore.vergleich.gleich": "as in the backup",
    "sicherungsnachweise.restore.vergleich.abweichend": "differs",
    "sicherungsnachweise.restore.vergleich.nicht_gemessen": "not measured",
    "sicherungsnachweise.restore.zeile": "{{kategorie}}: {{zustand}}",
    "sicherungsnachweise.restore.zahlen": "{{tabelle}} backup {{dump}} / restored {{datenbank}}",
    "sicherungsnachweise.restore.waisen": "Evidence without attachment: {{n}}",
    "sicherungsnachweise.restore.rollen": "Roles in the backup: {{dump}} · restored: {{db}}",
    "sicherungsnachweise.restore.keineKonten": "no accounts",
    "sicherungsnachweise.restore.gelesen": "Read back through the application: {{text}}",
    "sicherungsnachweise.restore.schritt.pruefsumme":
      "This backup is damaged or has no valid checksum — do not use it. Test another backup or create a new one.",
    "sicherungsnachweise.restore.schritt.ziel":
      "Name a separate, empty target database (RESTORE_DB) and repeat the test. Production was not touched.",
    "sicherungsnachweise.restore.schritt.bestand":
      "The backup is incomplete or differs — create a new backup and repeat the test with it.",
    "sicherungsnachweise.restore.schritt.aufbau":
      "Set-up error of the test, not a finding about the backup — check the environment and repeat the test.",
    "sicherungsnachweise.restore.schritt.audit":
      "The backup's audit chain does not hold — check the source before relying on this backup.",
    "sicherungsnachweise.restore.schritt.teilweise":
      "The test passed, but not every comparison was measured. The open points are listed above; until they are measured, the restore is only partially proven.",
    "sicherungsnachweise.restore.schritt.unbekannt":
      "Run the restore drill against a separate, empty database (scripts/backup/restore-drill.sh). Until then, no restore is proven.",
  },
  nl: {
    "audit.action.admin_sicherungen_gelesen": "Back-upinformatie gelezen",
    "sicherungsnachweise.titel": "Beschermingswegen en bewijs",
    "sicherungsnachweise.ort.env":
      "Er is alleen gezocht in de map uit BACKUP_DIR. Back-ups op andere plaatsen — snapshots van de hoster, offsite-kopieën — controleert dit overzicht niet; ze zijn daarmee niet aangetoond en niet uitgesloten.",
    "sicherungsnachweise.ort.vorgabe":
      "BACKUP_DIR is op de server niet ingesteld; er is alleen in de standaardmap gezocht. Een ontbrekende standaardmap bewijst niet dat er geen back-up is: de planning uit de beheerhandleiding schrijft naar /data/backups, en snapshots van de hoster of offsite-kopieën controleert dit overzicht niet.",
    "sicherungsnachweise.zustand.erfolg": "Geslaagd",
    "sicherungsnachweise.zustand.fehler": "Mislukt",
    "sicherungsnachweise.zustand.unbekannt": "Onbekend",
    "sicherungsnachweise.zustand.teilweise": "Gedeeltelijk aangetoond",
    "sicherungsnachweise.zustand.keiner": "Geen vastgelegd",
    "sicherungsnachweise.zeit": "Tijdstip: {{zeit}}",
    "sicherungsnachweise.grund": "Reden: {{grund}}",
    "sicherungsnachweise.schritt": "Volgende stap: {{schritt}}",
    "sicherungsnachweise.umfang": "Omvang: {{text}}",
    "sicherungsnachweise.aufbewahrung": "Bewaartermijn: {{text}}",
    "sicherungsnachweise.zustaendig": "Verantwoordelijk: {{text}}",
    "sicherungsnachweise.exitcode": "Afsluitcode {{code}}",
    "sicherungsnachweise.unbekannt.kein_verzeichnis":
      "De back-upmap bestaat niet, dus er staat ook geen spoor in.",
    "sicherungsnachweise.unbekannt.unlesbar": "Het spoor was niet leesbaar.",
    "sicherungsnachweise.unbekannt.fehlt":
      "Er is geen spoor — hier heeft nog geen run een resultaat achtergelaten.",
    "sicherungsnachweise.unbekannt.ungueltig": "Het spoor heeft niet de toegezegde vorm.",
    "sicherungsnachweise.unbekannt.kein_protokoll": "Zonder auditlog niet vast te stellen.",
    "sicherungsnachweise.unbekannt.protokoll_unlesbar": "Het logboek was niet leesbaar.",
    "sicherungsnachweise.export.titel": "Exportbestand",
    "sicherungsnachweise.export.umfang":
      "Bibliotheek als JSON, Markdown, MediaWiki of HTML (gevalideerde kennisobjecten; vertrouwelijke alleen met controlerecht) en de auditketen als JSON.",
    "sicherungsnachweise.export.aufbewahrung":
      "Het bestand blijft bij de ontvanger. De server bewaart geen kopie; hij legt alleen de download vast.",
    "sicherungsnachweise.export.zustaendig":
      "Wie exporteert: leesrecht voor de bibliotheek, controlerecht voor de auditketen.",
    "sicherungsnachweise.export.bibliothek":
      "Bibliotheek laatst op {{zeit}} ({{format}}, {{anzahl}} objecten), {{gesamt}} exports in totaal",
    "sicherungsnachweise.export.auditkette":
      "Auditketen laatst op {{zeit}} ({{anzahl}} items), {{gesamt}} exports in totaal",
    "sicherungsnachweise.export.keiner": "Er is tot nu toe geen export vastgelegd.",
    "sicherungsnachweise.export.schritt.unbekannt": "Het auditlog van de installatie controleren.",
    "sicherungsnachweise.lauf.titel": "Automatische back-up (laatste run)",
    "sicherungsnachweise.lauf.umfang":
      "De hele database als pg_dump-archief met controlesombestand: bijdragen, bijlagen, relaties, accounts met rollen en het auditlog.",
    "sicherungsnachweise.lauf.aufbewahrung":
      "Volgens BACKUP_KEEP; zonder waarde wordt niets verwijderd. Een offsite-kopie en versleuteling richt het script niet in.",
    "sicherungsnachweise.lauf.zustaendig":
      "Beheer: planning (Coolify of cron) met scripts/backup/backup.sh.",
    "sicherungsnachweise.lauf.datei": "Back-up: {{datei}}",
    "sicherungsnachweise.lauf.schritt.fehler":
      "De uitvoer van de run controleren (afsluitcodes in scripts/backup/RESTORE.md) en de back-up opnieuw starten.",
    "sicherungsnachweise.lauf.schritt.unbekannt":
      "Controleren of de planning met precies deze BACKUP_DIR draait. Zonder spoor is hier geen run aangetoond.",
    "sicherungsnachweise.papierkorb.titel": "Prullenbak",
    "sicherungsnachweise.papierkorb.umfang":
      "Verwijderde kennisobjecten met hun versies, bewijzen en bijlagen, herstelbaar tot de definitieve verwijdering. Concepten hebben een eigen prullenbak per auteur.",
    "sicherungsnachweise.papierkorb.aufbewahrung":
      "{{tage}} dagen na het verwijderen, daarna definitieve verwijdering (gecontroleerd bij het starten en elke zes uur).",
    "sicherungsnachweise.papierkorb.zustaendig": "Beheerders herstellen of verwijderen definitief.",
    "sicherungsnachweise.papierkorb.anzahl_one": "{{count}} kennisobject in de prullenbak",
    "sicherungsnachweise.papierkorb.anzahl_other": "{{count}} kennisobjecten in de prullenbak",
    "sicherungsnachweise.papierkorb.naechste": "Volgende definitieve verwijdering: {{zeit}}",
    "sicherungsnachweise.papierkorb.wiederhergestellt": "Laatst hersteld: {{zeit}}",
    "sicherungsnachweise.papierkorb.endgeloescht": "Laatst definitief verwijderd: {{zeit}}",
    "sicherungsnachweise.papierkorb.nie": "tot nu toe nooit",
    "sicherungsnachweise.papierkorb.ohneProtokoll":
      "Herstellingen en definitieve verwijderingen zijn zonder auditlog niet vast te stellen.",
    "sicherungsnachweise.papierkorb.schritt.unbekannt":
      "De prullenbak onder „Gegevens“ openen en het serverlog controleren.",
    "sicherungsnachweise.restore.titel": "Herstelbewijs (herstelproef)",
    "sicherungsnachweise.restore.umfang":
      "Een back-up wordt in een eigen, lege database ingelezen en met de draaiende applicatie vergeleken. De productiedatabase wordt daarbij niet aangeraakt.",
    "sicherungsnachweise.restore.aufbewahrung":
      "Het logboek van de laatste run staat als letzter-drill.json naast de back-up; elke nieuwe run vervangt het.",
    "sicherungsnachweise.restore.zustaendig":
      "Beheer: scripts/backup/restore-drill.sh, minstens elk kwartaal.",
    "sicherungsnachweise.restore.sicherung": "Gebruikte back-up: {{datei}} ({{zeit}})",
    "sicherungsnachweise.restore.ziel": "Geïsoleerd doel: {{ziel}}",
    "sicherungsnachweise.restore.dauer": "Proef van {{beginn}} tot {{ende}}",
    "sicherungsnachweise.restore.pruefsumme.passt": "Controlesom herberekend: past bij de back-up",
    "sicherungsnachweise.restore.pruefsumme.abweichend": "Controlesom herberekend: wijkt af",
    "sicherungsnachweise.restore.pruefsumme.fehlt": "Controlesombestand ontbreekt",
    "sicherungsnachweise.restore.pruefsumme.ungueltig":
      "Controlesombestand zonder geldige controlesom",
    "sicherungsnachweise.restore.pruefsumme.nicht_geprueft": "Controlesom niet herberekend",
    "sicherungsnachweise.restore.getrennt":
      "Controlesom en herstel zijn afzonderlijke bewijzen: een passende controlesom alleen bewijst geen herstel.",
    "sicherungsnachweise.restore.kat.beitraege": "Bijdragen",
    "sicherungsnachweise.restore.kat.anhaenge": "Bijlagen",
    "sicherungsnachweise.restore.kat.beziehungen": "Relaties",
    "sicherungsnachweise.restore.kat.rechte": "Rechten",
    "sicherungsnachweise.restore.vergleich.gleich": "zoals in de back-up",
    "sicherungsnachweise.restore.vergleich.abweichend": "wijkt af",
    "sicherungsnachweise.restore.vergleich.nicht_gemessen": "niet gemeten",
    "sicherungsnachweise.restore.zeile": "{{kategorie}}: {{zustand}}",
    "sicherungsnachweise.restore.zahlen": "{{tabelle}} back-up {{dump}} / hersteld {{datenbank}}",
    "sicherungsnachweise.restore.waisen": "Bewijzen zonder bijlage: {{n}}",
    "sicherungsnachweise.restore.rollen": "Rollen in de back-up: {{dump}} · hersteld: {{db}}",
    "sicherungsnachweise.restore.keineKonten": "geen accounts",
    "sicherungsnachweise.restore.gelesen": "Via de applicatie teruggelezen: {{text}}",
    "sicherungsnachweise.restore.schritt.pruefsumme":
      "Deze back-up is beschadigd of heeft geen geldige controlesom — niet gebruiken. Een andere back-up beproeven of opnieuw back-uppen.",
    "sicherungsnachweise.restore.schritt.ziel":
      "Een eigen, lege doeldatabase (RESTORE_DB) opgeven en de proef herhalen. De productie is niet aangeraakt.",
    "sicherungsnachweise.restore.schritt.bestand":
      "De back-up is onvolledig of wijkt af — opnieuw back-uppen en de proef met de nieuwe back-up herhalen.",
    "sicherungsnachweise.restore.schritt.aufbau":
      "Opzetfout van de proef, geen bevinding over de back-up — omgeving controleren en de proef herhalen.",
    "sicherungsnachweise.restore.schritt.audit":
      "De auditketen van de back-up klopt niet — de bron controleren voordat op deze back-up wordt vertrouwd.",
    "sicherungsnachweise.restore.schritt.teilweise":
      "De proef is doorlopen, maar niet elke vergelijking is gemeten. De open punten staan hierboven; tot ze gemeten zijn, is het herstel maar gedeeltelijk aangetoond.",
    "sicherungsnachweise.restore.schritt.unbekannt":
      "De herstelproef tegen een eigen, lege database uitvoeren (scripts/backup/restore-drill.sh). Tot dan is geen herstel aangetoond.",
  },
} satisfies Textmodul;
