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
      "Bibliothek als JSON, Markdown, MediaWiki, HTML oder Wissenspaket (ZIP mit allen Fassungen, Originalanhängen und Verzeichnis) — validierte Wissensobjekte, vertrauliche nur mit Prüfrecht — und die Auditkette als JSON.",
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
    // Nacharbeit 2: was eine bestandene Probe nicht belegt (teilweise) oder ihr widerspricht (Fehler).
    "sicherungsnachweise.restore.luecken": "Fehlende Nachweise: {{liste}}",
    "sicherungsnachweise.restore.widersprueche": "Widersprüche im Protokoll: {{liste}}",
    "sicherungsnachweise.restore.nachweis.beginn": "Beginn der Probe",
    "sicherungsnachweise.restore.nachweis.zeit": "Ende der Probe",
    "sicherungsnachweise.restore.nachweis.sicherung": "Sicherungsstand",
    "sicherungsnachweise.restore.nachweis.ziel": "isoliertes Ziel",
    "sicherungsnachweise.restore.nachweis.pruefsumme": "Prüfsummenbefund",
    "sicherungsnachweise.restore.nachweis.sha256": "nachgerechnete Prüfsumme",
    "sicherungsnachweise.restore.nachweis.beitraege": "Vergleich Beiträge",
    "sicherungsnachweise.restore.nachweis.anhaenge": "Vergleich Anhänge",
    "sicherungsnachweise.restore.nachweis.beziehungen": "Vergleich Beziehungen",
    "sicherungsnachweise.restore.nachweis.rechte": "Vergleich Rechte",
    "sicherungsnachweise.restore.nachweis.belege_ohne_anhang": "Belege ohne Anhang",
    "sicherungsnachweise.restore.nachweis.rollen": "Rollenverteilung",
    "sicherungsnachweise.restore.nachweis.exitcode": "Ergebnis und Exitcode",
    "sicherungsnachweise.restore.schritt.widerspruch":
      "Das Protokoll widerspricht seinem eigenen Ergebnis — nicht auf diese Probe verlassen. Die Protokolldatei prüfen und den Restore-Drill neu fahren.",
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
    // produkt:20261010:poc-wiederherstellung-export — private Assistenzspeicher und Umfang je Bereich.
    "sicherungsnachweise.restore.kat.assistenz": "Private Assistenzspeicher",
    "sicherungsnachweise.restore.nachweis.assistenz": "Vergleich private Assistenzspeicher",
    "sicherungsnachweise.bereiche.titel": "Sicherungsumfang je Bereich",
    "sicherungsnachweise.bereiche.fassung":
      "Gebunden an KLARWERK {{version}} (Commit {{commit}}). Die Datenbanksicherung enthält alle {{tabellen}} Tabellen dieser Fassung; die Anhangsdateien liegen in derselben Datenbank — eine zweite Objektablage gibt es nicht.",
    "sicherungsnachweise.bereiche.tabellen": "Tabellen: {{liste}}",
    "sicherungsnachweise.bereiche.zustand.im_dump": "in der Datenbanksicherung",
    "sicherungsnachweise.bereiche.zustand.ausgeschlossen": "bewusst nicht in der Sicherung",
    "sicherungsnachweise.bereiche.zustand.nicht_vorhanden":
      "in dieser Fassung nicht vorhanden — nichts gesichert",
    "sicherungsnachweise.bereiche.beleg.belegt":
      "Letzte Wiederherstellungsprobe: zurückgekommen, Zeilen wie in der Sicherung.",
    "sicherungsnachweise.bereiche.beleg.abweichend": "Letzte Wiederherstellungsprobe: weicht ab.",
    "sicherungsnachweise.bereiche.beleg.nicht_gemessen":
      "Letzte Wiederherstellungsprobe: für diesen Bereich nicht gemessen — kein Wiederherstellungsbeleg.",
    "sicherungsnachweise.bereiche.beleg.kein_beleg":
      "Keine Wiederherstellung über die Datenbanksicherung.",
    "sicherungsnachweise.bereiche.datenbank.titel": "Datenbanksicherung (pg_dump)",
    "sicherungsnachweise.bereiche.datenbank.text":
      "Die ganze Produktdatenbank: Beiträge mit allen Fassungen, Quellen, Beziehungen, Verantwortung, Freigaben, Spaces, Konten mit Rollen und das Auditprotokoll.",
    "sicherungsnachweise.bereiche.anhangsbytes.titel": "Anhangsdateien (Originalbytes)",
    "sicherungsnachweise.bereiche.anhangsbytes.text":
      "Die Originaldateien liegen in der Objektablage derselben Datenbank und sind Teil des Dumps — eigens gezählt samt ihrer Zuordnung zum Beitrag.",
    "sicherungsnachweise.bereiche.assistenzprofil.titel":
      "Persönliches Assistenzprofil (Name, Avatar, Bewegung)",
    "sicherungsnachweise.bereiche.assistenzprofil.text":
      "Je Konto der gewählte Name und die Kennung des Motivs. Nach einer Wiederherstellung gehört das Profil wieder genau diesem Konto; das Motivbild selbst kommt aus der Anwendung.",
    "sicherungsnachweise.bereiche.gespraeche.titel": "Persönliche Klara-Gespräche",
    "sicherungsnachweise.bereiche.gespraeche.text":
      "Nachrichten, Objektbezug und der zuletzt begonnene Schritt je Konto. Nur das Konto selbst sieht sie — auch nach einer Wiederherstellung.",
    "sicherungsnachweise.bereiche.gedaechtnis.titel": "Interaktionsgedächtnis",
    "sicherungsnachweise.bereiche.gedaechtnis.text":
      "Gemerkte Fragen und Antworten je Konto mit Verfallsfrist. Folge einer Wiederherstellung: Einträge, deren Frist inzwischen abgelaufen ist, löscht der Aufräumlauf danach endgültig.",
    "sicherungsnachweise.bereiche.sitzungen.titel": "Klara-Sitzungen und KI-Zustimmungen",
    "sicherungsnachweise.bereiche.sitzungen.text":
      "Sitzung und Zustimmung je Konto. Folge einer Wiederherstellung: abgelaufene Sitzungen räumt die Anwendung danach ab; eine Zustimmung gilt nur für ihre Sitzung.",
    "sicherungsnachweise.bereiche.avatarmotive.titel": "Avatar-Motive (Bilddateien)",
    "sicherungsnachweise.bereiche.avatarmotive.text":
      "Grund: Die dreizehn Motive gehören zum Anwendungspaket, nicht zu den Nutzerdaten. Folge: Sie kommen mit derselben Anwendungsfassung zurück; ein gespeichertes Motiv, das es dort nicht gibt, erscheint als neutrale Ersatzgrafik.",
    "sicherungsnachweise.bereiche.eigeneavatare.titel": "Eigene oder generierte Avatarbilder",
    "sicherungsnachweise.bereiche.eigeneavatare.text":
      "Diese Fassung bietet weder Hochladen noch Generieren eines eigenen Avatars. Es wird nichts gesichert und kein Sicherungsbeleg dafür ausgegeben.",
    "sicherungsnachweise.bereiche.aufgaben.titel": "Persönliche Aufgabenlisten",
    "sicherungsnachweise.bereiche.aufgaben.text":
      "Diese Fassung hat keine eigene Ablage für persönliche Aufgaben. Der zuletzt begonnene Schritt eines Gesprächs liegt im Gespräch selbst.",
    "sicherungsnachweise.bereiche.endgeraet.titel": "Speicher im Browser",
    "sicherungsnachweise.bereiche.endgeraet.text":
      "Grund: Sitzungscookie und lokale Einstellungen liegen im Gerät der Person, nicht auf dem Server. Folge: Nach einer Wiederherstellung meldet man sich neu an; Geräteeinstellungen bleiben, wie sie im Browser waren.",
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
      "Library as JSON, Markdown, MediaWiki, HTML or knowledge package (ZIP with all versions, original attachments and an index) — validated knowledge objects, confidential ones only with review rights — and the audit chain as JSON.",
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
    "sicherungsnachweise.restore.luecken": "Missing evidence: {{liste}}",
    "sicherungsnachweise.restore.widersprueche": "Contradictions in the log: {{liste}}",
    "sicherungsnachweise.restore.nachweis.beginn": "start of the test",
    "sicherungsnachweise.restore.nachweis.zeit": "end of the test",
    "sicherungsnachweise.restore.nachweis.sicherung": "backup used",
    "sicherungsnachweise.restore.nachweis.ziel": "isolated target",
    "sicherungsnachweise.restore.nachweis.pruefsumme": "checksum finding",
    "sicherungsnachweise.restore.nachweis.sha256": "recomputed checksum",
    "sicherungsnachweise.restore.nachweis.beitraege": "posts comparison",
    "sicherungsnachweise.restore.nachweis.anhaenge": "attachments comparison",
    "sicherungsnachweise.restore.nachweis.beziehungen": "relationships comparison",
    "sicherungsnachweise.restore.nachweis.rechte": "rights comparison",
    "sicherungsnachweise.restore.nachweis.belege_ohne_anhang": "evidence without attachment",
    "sicherungsnachweise.restore.nachweis.rollen": "role distribution",
    "sicherungsnachweise.restore.nachweis.exitcode": "result and exit code",
    "sicherungsnachweise.restore.schritt.widerspruch":
      "The log contradicts its own result — do not rely on this test. Check the log file and run the restore drill again.",
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
    "sicherungsnachweise.restore.kat.assistenz": "Private assistant data",
    "sicherungsnachweise.restore.nachweis.assistenz": "private assistant data comparison",
    "sicherungsnachweise.bereiche.titel": "Backup scope by area",
    "sicherungsnachweise.bereiche.fassung":
      "Bound to KLARWERK {{version}} (commit {{commit}}). The database backup contains all {{tabellen}} tables of this version; attachment files are stored in the same database — there is no second object store.",
    "sicherungsnachweise.bereiche.tabellen": "Tables: {{liste}}",
    "sicherungsnachweise.bereiche.zustand.im_dump": "in the database backup",
    "sicherungsnachweise.bereiche.zustand.ausgeschlossen": "deliberately not in the backup",
    "sicherungsnachweise.bereiche.zustand.nicht_vorhanden":
      "does not exist in this version — nothing backed up",
    "sicherungsnachweise.bereiche.beleg.belegt":
      "Last restore test: came back, rows as in the backup.",
    "sicherungsnachweise.bereiche.beleg.abweichend": "Last restore test: differs.",
    "sicherungsnachweise.bereiche.beleg.nicht_gemessen":
      "Last restore test: not measured for this area — no restore evidence.",
    "sicherungsnachweise.bereiche.beleg.kein_beleg": "Not restored from the database backup.",
    "sicherungsnachweise.bereiche.datenbank.titel": "Database backup (pg_dump)",
    "sicherungsnachweise.bereiche.datenbank.text":
      "The whole product database: posts with all versions, sources, relationships, responsibility, approvals, spaces, accounts with roles and the audit log.",
    "sicherungsnachweise.bereiche.anhangsbytes.titel": "Attachment files (original bytes)",
    "sicherungsnachweise.bereiche.anhangsbytes.text":
      "The original files are kept in the object store of the same database and are part of the dump — counted separately together with their assignment to the post.",
    "sicherungsnachweise.bereiche.assistenzprofil.titel":
      "Personal assistant profile (name, avatar, motion)",
    "sicherungsnachweise.bereiche.assistenzprofil.text":
      "Per account the chosen name and the motif identifier. After a restore the profile belongs to exactly this account again; the motif image itself comes from the application.",
    "sicherungsnachweise.bereiche.gespraeche.titel": "Personal Klara conversations",
    "sicherungsnachweise.bereiche.gespraeche.text":
      "Messages, object reference and the last step started, per account. Only the account itself sees them — also after a restore.",
    "sicherungsnachweise.bereiche.gedaechtnis.titel": "Interaction memory",
    "sicherungsnachweise.bereiche.gedaechtnis.text":
      "Remembered questions and answers per account with an expiry period. Consequence of a restore: entries whose period has expired in the meantime are permanently deleted by the clean-up run afterwards.",
    "sicherungsnachweise.bereiche.sitzungen.titel": "Klara sessions and AI consents",
    "sicherungsnachweise.bereiche.sitzungen.text":
      "Session and consent per account. Consequence of a restore: expired sessions are cleaned up by the application afterwards; a consent applies only to its session.",
    "sicherungsnachweise.bereiche.avatarmotive.titel": "Avatar motifs (image files)",
    "sicherungsnachweise.bereiche.avatarmotive.text":
      "Reason: the thirteen motifs belong to the application package, not to user data. Consequence: they come back with the same application version; a stored motif that does not exist there is shown as a neutral placeholder.",
    "sicherungsnachweise.bereiche.eigeneavatare.titel": "Own or generated avatar images",
    "sicherungsnachweise.bereiche.eigeneavatare.text":
      "This version offers neither uploading nor generating an own avatar. Nothing is backed up and no backup evidence is issued for it.",
    "sicherungsnachweise.bereiche.aufgaben.titel": "Personal task lists",
    "sicherungsnachweise.bereiche.aufgaben.text":
      "This version has no separate store for personal tasks. The last step started in a conversation is kept in the conversation itself.",
    "sicherungsnachweise.bereiche.endgeraet.titel": "Browser storage",
    "sicherungsnachweise.bereiche.endgeraet.text":
      "Reason: the session cookie and local settings are kept on the person's device, not on the server. Consequence: after a restore you sign in again; device settings stay as they were in the browser.",
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
      "Bibliotheek als JSON, Markdown, MediaWiki, HTML of kennispakket (ZIP met alle versies, originele bijlagen en een overzicht) — gevalideerde kennisobjecten, vertrouwelijke alleen met controlerecht — en de auditketen als JSON.",
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
    "sicherungsnachweise.restore.luecken": "Ontbrekend bewijs: {{liste}}",
    "sicherungsnachweise.restore.widersprueche": "Tegenstrijdigheden in het logboek: {{liste}}",
    "sicherungsnachweise.restore.nachweis.beginn": "begin van de proef",
    "sicherungsnachweise.restore.nachweis.zeit": "einde van de proef",
    "sicherungsnachweise.restore.nachweis.sicherung": "gebruikte back-up",
    "sicherungsnachweise.restore.nachweis.ziel": "geïsoleerd doel",
    "sicherungsnachweise.restore.nachweis.pruefsumme": "controlesombevinding",
    "sicherungsnachweise.restore.nachweis.sha256": "herberekende controlesom",
    "sicherungsnachweise.restore.nachweis.beitraege": "vergelijking bijdragen",
    "sicherungsnachweise.restore.nachweis.anhaenge": "vergelijking bijlagen",
    "sicherungsnachweise.restore.nachweis.beziehungen": "vergelijking relaties",
    "sicherungsnachweise.restore.nachweis.rechte": "vergelijking rechten",
    "sicherungsnachweise.restore.nachweis.belege_ohne_anhang": "bewijzen zonder bijlage",
    "sicherungsnachweise.restore.nachweis.rollen": "rolverdeling",
    "sicherungsnachweise.restore.nachweis.exitcode": "resultaat en afsluitcode",
    "sicherungsnachweise.restore.schritt.widerspruch":
      "Het logboek spreekt zijn eigen resultaat tegen — niet op deze proef vertrouwen. Het logbestand controleren en de herstelproef opnieuw uitvoeren.",
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
    "sicherungsnachweise.restore.kat.assistenz": "Privégegevens van de assistent",
    "sicherungsnachweise.restore.nachweis.assistenz": "vergelijking privégegevens van de assistent",
    "sicherungsnachweise.bereiche.titel": "Omvang van de back-up per onderdeel",
    "sicherungsnachweise.bereiche.fassung":
      "Gebonden aan KLARWERK {{version}} (commit {{commit}}). De databaseback-up bevat alle {{tabellen}} tabellen van deze versie; bijlagebestanden staan in dezelfde database — een tweede objectopslag is er niet.",
    "sicherungsnachweise.bereiche.tabellen": "Tabellen: {{liste}}",
    "sicherungsnachweise.bereiche.zustand.im_dump": "in de databaseback-up",
    "sicherungsnachweise.bereiche.zustand.ausgeschlossen": "bewust niet in de back-up",
    "sicherungsnachweise.bereiche.zustand.nicht_vorhanden":
      "bestaat niet in deze versie — niets geback-upt",
    "sicherungsnachweise.bereiche.beleg.belegt":
      "Laatste herstelproef: teruggekomen, rijen zoals in de back-up.",
    "sicherungsnachweise.bereiche.beleg.abweichend": "Laatste herstelproef: wijkt af.",
    "sicherungsnachweise.bereiche.beleg.nicht_gemessen":
      "Laatste herstelproef: voor dit onderdeel niet gemeten — geen herstelbewijs.",
    "sicherungsnachweise.bereiche.beleg.kein_beleg": "Geen herstel via de databaseback-up.",
    "sicherungsnachweise.bereiche.datenbank.titel": "Databaseback-up (pg_dump)",
    "sicherungsnachweise.bereiche.datenbank.text":
      "De hele productdatabase: bijdragen met alle versies, bronnen, relaties, verantwoordelijkheid, vrijgaven, spaces, accounts met rollen en het auditlog.",
    "sicherungsnachweise.bereiche.anhangsbytes.titel": "Bijlagebestanden (originele bytes)",
    "sicherungsnachweise.bereiche.anhangsbytes.text":
      "De originele bestanden staan in de objectopslag van dezelfde database en horen bij de dump — apart geteld samen met hun koppeling aan de bijdrage.",
    "sicherungsnachweise.bereiche.assistenzprofil.titel":
      "Persoonlijk assistentprofiel (naam, avatar, beweging)",
    "sicherungsnachweise.bereiche.assistenzprofil.text":
      "Per account de gekozen naam en de aanduiding van het motief. Na een herstel hoort het profiel weer bij precies dit account; de afbeelding van het motief komt uit de applicatie.",
    "sicherungsnachweise.bereiche.gespraeche.titel": "Persoonlijke Klara-gesprekken",
    "sicherungsnachweise.bereiche.gespraeche.text":
      "Berichten, objectverwijzing en de laatst begonnen stap per account. Alleen het account zelf ziet ze — ook na een herstel.",
    "sicherungsnachweise.bereiche.gedaechtnis.titel": "Interactiegeheugen",
    "sicherungsnachweise.bereiche.gedaechtnis.text":
      "Onthouden vragen en antwoorden per account met een vervaltermijn. Gevolg van een herstel: items waarvan de termijn inmiddels is verlopen, verwijdert de opruimronde daarna definitief.",
    "sicherungsnachweise.bereiche.sitzungen.titel": "Klara-sessies en AI-toestemmingen",
    "sicherungsnachweise.bereiche.sitzungen.text":
      "Sessie en toestemming per account. Gevolg van een herstel: verlopen sessies ruimt de applicatie daarna op; een toestemming geldt alleen voor haar sessie.",
    "sicherungsnachweise.bereiche.avatarmotive.titel": "Avatarmotieven (afbeeldingen)",
    "sicherungsnachweise.bereiche.avatarmotive.text":
      "Reden: de dertien motieven horen bij het applicatiepakket, niet bij de gebruikersgegevens. Gevolg: ze komen terug met dezelfde applicatieversie; een opgeslagen motief dat daar niet bestaat, verschijnt als neutrale vervangende afbeelding.",
    "sicherungsnachweise.bereiche.eigeneavatare.titel": "Eigen of gegenereerde avatarafbeeldingen",
    "sicherungsnachweise.bereiche.eigeneavatare.text":
      "Deze versie biedt geen uploaden en geen genereren van een eigen avatar. Er wordt niets geback-upt en er wordt geen back-upbewijs voor afgegeven.",
    "sicherungsnachweise.bereiche.aufgaben.titel": "Persoonlijke takenlijsten",
    "sicherungsnachweise.bereiche.aufgaben.text":
      "Deze versie heeft geen eigen opslag voor persoonlijke taken. De laatst begonnen stap van een gesprek staat in het gesprek zelf.",
    "sicherungsnachweise.bereiche.endgeraet.titel": "Opslag in de browser",
    "sicherungsnachweise.bereiche.endgeraet.text":
      "Reden: de sessiecookie en lokale instellingen staan op het apparaat van de persoon, niet op de server. Gevolg: na een herstel meldt men zich opnieuw aan; apparaatinstellingen blijven zoals ze in de browser waren.",
  },
} satisfies Textmodul;
