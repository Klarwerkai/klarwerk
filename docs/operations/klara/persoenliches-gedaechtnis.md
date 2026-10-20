# Persönliches Gedächtnis · Klara09

Profil → Klara → Mein persönliches Gedächtnis liest die vorhandene Tabelle
`interaktions_gedaechtnis`. Es gibt keine zusätzliche persönliche Wissensablage. Die Sitzung
bestimmt das Konto; auch Administratoren bekommen keinen fremden Eintrag. Ein fremder und ein
unbekannter Eintrag ergeben denselben 404-Fehler. Korrekturen nennen die gelesene Fassung,
behalten Kennung/Herkunft und scheitern bei gleichzeitiger Änderung oder Löschung mit 409.

Die ausdrücklich gewählte Antwortdarstellung `kurz` klappt nur den Antwortkörper ein. Der
vollständige Wortlaut bleibt aufklappbar; Quellen, Fassung, Prüfstatus und Warnkennzeichen stehen
weiter außerhalb. Keine Gedächtnisinhalte gehen als Fachquelle oder als zusätzlicher Modellkontext
an die KI. Allgemeine Freitextvorlieben werden angezeigt und bearbeitet, aber nicht in unbekannte
Ausführungsregeln umgedeutet. Bei mehreren Darstellungswünschen gilt der jüngste noch gültige.

## Aktiver Umfang

Löschen entfernt die persönliche Gedächtniszeile; der Browser liest neu. Ihr Kontoindex verschwindet
mit der Zeile. Der Gedächtniskern hat keine Volltextprojektion, Anhänge, Werkzeugartefakte,
Modellwarteschlange oder Firmenwissensfassung. Es gibt daher in diesem Kern keine solchen Kopien
zu löschen. Der Query-Cache ist kontogebunden, wird bei Abmeldung geleert und nach jeder Änderung
aktualisiert; bei Fensterfokus wird erneut gelesen. Bei fehlendem bestätigten Abruf wird keine
kurze Präferenz angewandt.

**Nicht vom Gedächtnislöschen umfasst:** private Notizen, persönliche Aufgaben, Gespräche und
Kalenderkopien haben ihre bestehenden eigenen Löschwege. Deren historische Kopien und Quelltexte
werden durch diese Gedächtnisoperation nicht pauschal entfernt. Insbesondere gibt es im .994-Kern
keinen allgemeinen Quell-ID-zu-historischen-Kopien-Purge. AW09-K02/P10-AC04 bleiben insoweit offen.
Bewusst in Firmenwissen übernommene Inhalte haben eigene Herkunft, Rechte und Aufbewahrung;
der persönliche Widerruf ist kein Firmenwissenslöschauftrag. Der tatsächliche Übernahmeweg gehört
zum bestehenden Auftrag Klara08 (F), nicht zu einem zweiten Weg hier.

## Sicherung und Wiederherstellung

Die vorhandenen Backup-/Rotationsskripte werden weiterbenutzt. Dumpbestand enthält Gedächtnis und
`interaktions_gedaechtnis_loeschungen`. Diese zweite Tabelle enthält nur Eintragskennung,
Mindestfassung (Korrektur) bzw. endgültige Löschmarkierung und Zeitpunkt, keine Kontokennung,
Vorliebe oder Antwort. Korrekturmarken unterdrücken nach einem alten Restore die frühere Fassung;
ein neuerer Inhalt wird nicht rekonstruiert. Einträge mit aktueller Fassung bleiben erhalten.

Optional nennt `KLARWERK_GEDAECHTNIS_LOESCHJOURNAL` einen absoluten NDJSON-Dateipfad auf einem
**vom Datenbankhost unabhängigen, dauerhaft gemounteten Datenträger**. Der Betreiber legt diesen
Pfad und dessen Rechte fest und initialisiert dort eine leere Datei. Das Produkt schreibt vor
Bestätigung einer Mutation und synchronisiert Datei und Verzeichnis. Fehlender/defekter
konfigurierter Journalbestand blockiert den PG-Start; Schreibfehler bestätigen keine Löschung.
Ohne diese Konfiguration bestehen nur DB-Marken: ein früherer Dump nach Hostverlust kann später
entstandene Löschungen nicht kennen. Die Oberfläche nennt diese Grenze ausdrücklich.

Vor Freigabe einer PG-App (onReady) werden externe und interne Marken vereinigt und veraltete
bzw. gelöschte Einträge entfernt. Eine unklare Mutation nach Journal-fsync, aber vor DB-Commit kann
beim Restore vorsorglich den alten Eintrag unterdrücken. Sie wird nicht als bestätigte Korrektur
mit einem erfundenen neuen Inhalt ausgegeben. Unlesbare Journalzeilen führen zu einem Abbruch,
keinem stillen Überspringen.

Die konkrete Produktionskonfiguration, der unabhängige Datenträger, Sicherungskette und ein
Restore des veröffentlichten Sicherungsbestands nach Hostausfall sind **nicht durch lokale
Agentenproben belegt**. Die Teststrecke verwendet fiktive Daten, einen echten PostgreSQL-Dump,
eine neue Ziel-Datenbank und eine getrennte lokale Datei; das ist ein technischer Restorebeleg,
kein Produktions-Desastertest.

## Zwecke, Verantwortlichkeit, Fristen und Restkopien

| Bestand | Zweck und Verantwortung | Frist / aktuelle Grenze |
| --- | --- | --- |
| Gedächtniseintrag | Persönliche Darstellung; Kontoinhaber wählt/löscht | Vorhandene Betriebswahl 30/90/365 Tage, Standard 90; keine Rechtsfrist |
| Diagnose | Betrieb; Betreiber | Bestehende `protokoll-frist.ts`-Pflege/Loggingregel, getrennt vom Gedächtnis |
| Sicherheit / Audit | Integrität/Nachweis; Betreiber | Bestehende eigene Auditregel, kein Inhaltsvolltext aus Gedächtnisrouten |
| Löschmarken | Unterdrückung älterer Sicherungskopien; Betreiber | Erhalten, solange eine relevante ältere Sicherung rückspielbar ist; nicht aus dem Dumpalter allein kürzen |
| Backups / externe Kopien | Wiederanlauf; Betreiber und jeweiliger Empfänger | Bestehende Rotation (`BACKUP_KEEP`); externe Restkopien und konkrete Produktionsfristen separat nachweisen |

Die Meldung einer Umgebungsvariable ist kein Beweis für einen unabhängigen Datenträger. Für alle
Zwecke gemeinsam eine einzige Frist zu behaupten wäre falsch. Eine neue getrennte konfigurierbare
Sicherheits-/Auditfrist oder befristete Aufbewahrungsausnahme wird hier nicht als geliefert
behauptet. P10-AC01/AC03/AC08 bleiben hinsichtlich dieser zusätzlichen Betriebskonfiguration offen.
Schon erzeugte Antworten und externe Restkopien werden nicht rückwirkend umgeschrieben.

## P10-Nachfolger nach der festen Übergabe f341

Die offene technische Ausnahme ist nun am selben Gedächtniseintrag angebunden: Das eigene Konto
setzt eine private Begründung und einen ausdrücklichen UTC-Endzeitpunkt nach der regulären Frist.
Die vorhandene technische Höchstspanne von 365 Tagen bleibt die Grenze für den neuen Endzeitpunkt.
Die verantwortliche Kennung kommt ausschließlich aus der Sitzung, nicht aus dem Formular.
Regulärer Ablauf und Ausnahmeende werden getrennt gespeichert und angezeigt. Lesen, Zählen,
Ändern und derselbe bestehende Aufräumlauf berücksichtigen das wirksame Ende. Am Ende ist der
Eintrag nicht mehr lesbar; der nächste vorhandene Sweep löscht ihn physisch und hinterlegt die
bestehende minimale Restore-Marke. Es entsteht weder ein neuer Scheduler noch ein Ausnahmebestand.
Manuelles Löschen bleibt auch während einer Ausnahme möglich; die Ausnahme ist keine Löschsperre.

Die bestehende Auditaktion führt zusätzlich nur das Ausnahmeende, weder Begründung noch Name
oder Inhaltsvolltext. Die private Begründung verschwindet mit der privaten Zeile; die vorhandene
Auditkette bleibt unverändert append-only. Ein tatsächlicher isolierter PG-/Dump-/Restorelauf
weist das Fristende und die Unterdrückung der alten Ausnahme nach. Produktionshost- und
veröffentlichte Sicherungsbelege bleiben getrennte offene Betriebsnachweise.

Die getrennten Zweck-/Frist-/Verantwortungsangaben erscheinen im vorhandenen geschützten
Verarbeitungsverzeichnis (JSON und Markdown). Diagnose verwendet den vorhandenen Datei-/Dockerweg;
der 14-Tage-Standard bleibt erhalten. Sicherheit und Audit bekommen getrennte Verantwortungs- und
Begründungsangaben, übernehmen aber keine Diagnosefrist. Für ihre zusätzliche Zahlenfrist gibt es
weiter keine festgelegte Regel der bestehenden Nachweiskette. Ein gesetztes
`KLARWERK_SICHERHEIT_FRIST_TAGE` oder `KLARWERK_AUDIT_FRIST_TAGE` wird deshalb ausdrücklich
abgewiesen, statt eine nicht durchgesetzte Auditlöschung zu behaupten. Diese fachliche Grenze bleibt
offen; ihre Auflösung erfordert eine konkrete Betreiberfestlegung, keine erfundene Zahl.
