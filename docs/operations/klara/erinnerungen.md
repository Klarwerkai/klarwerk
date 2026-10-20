# Persönliche Erinnerungen — Betrieb (Klara 10 · AW-18)

Auftrag `produkt:20261007:klara-erinnerungen-kalender`. Fachliche Beschreibung: `docs/klara/klara-vorschau.md`
(Abschnitt „Erinnerungen verwalten und zustellen“).

## Was im Betrieb läuft

| Baustein | Ort | Hinweis |
| --- | --- | --- |
| Steuerung | `services/app/src/klara-erinnerung.ts` (`KlaraErinnerungSteuerung`) | Eine Instanz je Serverprozess, aus `buildApp`; kein Chat-Wecker, keine Codex-Automation. |
| Takt | `services/app/src/klara-erinnerung-start.ts`, gestartet in `server.ts` | Sofort beim Start (Neustart-Fall), dann alle 60 s. `KLARWERK_KLARA_ERINNERUNG_TAKT_MS` (Untergrenze 60000). Läuft auch im Wiederanlauf (interne Meldung, keine Außenwirkung). |
| Ablage | Tabellen `klara_erinnerungen`, `klara_erinnerung_laeufe`, `klara_erinnerung_meldungen`, `klara_erinnerung_einstellungen` (`KLARA_ERINNERUNG_SCHEMA`, additiv) | Im Dump, im Restore-Drill-Pflichtsatz und in der Drill-Kategorie `assistenz`. |
| Zustellweg | Glocke (`GET /api/notifications`, Art `erinnerung`) | Nur das eigene Konto bzw. die bewusst zuständige Person (Übergabe). Kein E-Mail- oder Push-Versand. |
| Bestellte Zusammenfassung | `ReasonerService.assistText` (vertraulich) | Folgt der zentralen KI-Freigabe (`oeffentlicheKi`, `vertraulicheInhalte`). Ohne Freigabe oder bei Ausfall: Erinnerung kommt, Lauf „teilweise“. |

## Persönliche Routinen (EQF-07)

Eine Routine ist eine Erinnerung mit Aktion `routine_bericht` und versionierter Definition
(`routine` in `klara_erinnerungen.data`). Sie nutzt dieselbe Steuerung und denselben Takt; es gibt
keinen eigenen Scheduler, keinen Chat-Wecker und keine Codex-Automation, und der Führungswecker
bleibt unberührt. Ihr Ergebnis ist eine Notiz in `klara_notizen` (Vorgang `routine-<Erinnerung>-<Termin>`,
höchstens eine je Termin); Ergebnis-ID, Fassungen und offener Rest stehen im Lauf
(`klara_erinnerung_laeufe.data.ergebnis.routine`) und in der Meldung. Keine neue Tabelle: Sicherung,
Drill und Wiederherstellung umfassen Routinen über die vorhandenen Tabellen. Routinen nutzen kein
Modell und keinen externen Anbieter.

Seit Nacharbeit 9 gilt für den Bericht dieselbe Strenge wie für Meldungen:

- **Bedingte Anlage.** Der Bericht wird mit EINEM Befehl angelegt
  (`INSERT … SELECT … WHERE EXISTS (… FOR SHARE) ON CONFLICT (konto_id, vorgang) DO NOTHING`):
  Routine aktiv in genau dieser Fassung, Konto vorhanden/freigegeben/nicht abgelaufen, jede gelesene
  Quelle (`klara_notizen`/`klara_aufgaben`) noch in der gelesenen Fassung. Pause, Ende, Löschung,
  Rechteentzug oder Quellenänderung zwischen Prüfung und Speichern → nichts angelegt, die
  Steuerung liest neu und entscheidet neu (Lauf „abgebrochen“, „gestoppt“ bzw. neuer Bericht aus dem
  neuen Stand). Speicherablage (nur Tests/Demo): synchron geprüft wird „Routine aktiv in dieser
  Fassung“; die Quellenfassung prüft die Steuerung unmittelbar davor.
- **Quellenfassung vor der Wirkung.** Vor dem Schreiben liest die Steuerung jede gelesene Quelle
  erneut; abweichende Fassung oder Löschung → neue Runde (höchstens drei je Takt, danach
  „fehlgeschlagen“ mit Grund `quelle_geaendert`, Wiederaufnahme im nächsten Takt).
- **Fortsetzung eines Teilberichts.** Ein Teilbericht mit unlesbarem Rest
  (`ergebnis.routine.fortsetzbar = true`) wird von der vorhandenen Wiederaufnahme übernommen
  (gleiche Versuchsgrenze wie gescheiterte Läufe) und IM SELBEN Bericht vervollständigt — fertige
  Abschnitte bleiben, nur der Rest wird gelesen; geschrieben wird nur in der zuletzt geschriebenen
  Notizfassung und unter derselben Bedingung. Hat die Person den Bericht bearbeitet, bleibt er
  unangetastet (`bericht_geaendert`). Nach ausgeschöpften Versuchen setzt die Klärung
  „fortführen“ eine neue Versuchsreihe; „verwerfen“ beendet das Nachholen.
  Seit Nacharbeit 11: geprüft werden nur die JETZT gelesenen Quellen des Rests; fertige Abschnitte
  sind historische Belege ihres Laufs und bleiben auch bei später geänderter Quelle stehen. Vor der
  Berichtsänderung hält die Steuerung die beabsichtigte Fortsetzung (Zielfassung, SHA-256 des
  Inhalts, Ergebnis) am gehaltenen Lauf fest (`ergebnis.routine.fortsetzung`, `vermerke`). Stirbt
  der Prozess danach — vor Meldung und Laufabschluss — oder geht die Antwort verloren (Lauf
  „teilweise“, Grund `zustellung_gescheitert`, Ausgang offen), erkennt das Readback die eigene
  Fassung und schließt ab, ohne erneut zu schreiben; eine abweichende Fassung ist fremde Arbeit.
  Seit Nacharbeit 12 sind Berichts- und Meldungswirkung getrennt: nach der Berichtsänderung steht
  am gehaltenen Lauf „Bericht fertig, Meldung ausstehend“ (`ergebnis.routine.meldungAusstehend`).
  Die Meldung (feste Kennung `…-fortgesetzt-<Fassung>`) wird erst zurückgelesen, dann bedingt
  geschrieben. Abgeschlossen als „zugestellt“ wird erst mit tatsächlich vorhandener Meldung.
  `veraltet` → heutige Lage: Routine pausiert/beendet/gelöscht oder Konto nicht berechtigt → keine
  Meldung, Lauf „teilweise“ mit Grund, Bericht bleibt; nur neue Fassung → mit ihr erneut. Fehler
  oder unklarer Ausgang → Lauf „teilweise“ (`zustellung_gescheitert`), die Wiederaufnahme holt NUR
  die Meldung nach (Versuchsgrenze; danach Klärung „fortführen“). Keine erneute Berichtsänderung.

## Serienteilung („diesen und alle folgenden“)

Seit Nacharbeit 12 ist der erste Schreibvorgang die Folgeserie MIT ihrer Herkunft (`serieVon`,
ein Schreibvorgang) — sie ist die dauerhafte Teilungsabsicht. Danach wird die bisherige Serie
bedingt auf ihre Fassung begrenzt. Stirbt der Prozess dazwischen, wirkt die bisherige Serie ab dem
Teilungstermin trotzdem nicht mehr: vor jedem Termin fragt die Steuerung nach einer Folgeserie
(`nachfolger`), lässt Termine ab deren Beginn aus und holt die Begrenzung bedingt nach. Eine
Wiederholung mit demselben Vorgang ist idempotent.

Seit Nacharbeit 13: Scheitert die Begrenzung oder ist ihr Ausgang unbekannt, liest der Dienst
zuerst den tatsächlichen Zustand zurück. Ist die bisherige Serie schon begrenzt (eigene Antwort
verloren oder von der Steuerung nachgeholt), gilt die Teilung als vollzogen. Ist der Zustand nicht
lesbar oder die bisherige Serie unverändert, bleibt die Folgeserie (Teilungsabsicht) stehen. Nur
bei nachweislich anderswo geänderter, nicht begrenzter Serie wird eine von DIESEM Aufruf angelegte,
seitdem unveränderte Folgeserie ohne Lauf wieder entfernt. Abgesagte, erledigte und verschobene
Folgetermine gehen im selben Schreibvorgang auf die Folgeserie über (bei geändertem Zeitplan der
Reihenfolge nach zugeordnet); dasselbe gilt für kommende Termine bei einer Änderung der ganzen
Serie. Termine der bisherigen Serie ab Folgeserienbeginn sind dort nicht mehr einzeln änderbar
(409); eine zweite, andere Teilung ab einem schon fortgeführten Termin ebenso.

Seit Nacharbeit 16: „schon begrenzt“ gilt nur, wenn der gespeicherte Plan der bisherigen Serie
genau der Begrenzungsplan dieser Teilung ist (Vergleich unabhängig von der Schlüsselreihenfolge).
Ist der Teilungstermin nur durch eine fremde Planänderung entfallen (z. B. andere Uhrzeit), ist das
ein Konflikt. Das Entfernen der Folgeserie ist EIN bedingter Schritt (`entferneBedingt`: Fassung
und „kein Lauf“ gelten beim Löschen selbst; PostgreSQL `DELETE … WHERE fassung = … AND NOT EXISTS
(Lauf)`). Wurde sie inzwischen geändert oder hat sie gewirkt, bleibt sie, und der Konflikt wird
gemeldet.

Seit Nacharbeit 17 gehen Laufübernahme und bedingtes Entfernen über DIESELBE Sperre, die Zeile der
Erinnerung: `uebernimm` legt bzw. übernimmt einen Lauf nur, solange die Erinnerung besteht
(`INSERT … SELECT … WHERE EXISTS (… FOR SHARE)`); `entferneBedingt` nimmt in einer Transaktion
zuerst `FOR UPDATE` und prüft DANACH (neuer Lesestand) Fassung und Laufbestand. Kommt die Übernahme
zuerst, sieht das Entfernen ihren Lauf und löscht nicht; kommt das Entfernen zuerst, findet die
Übernahme die Erinnerung nicht mehr und legt keinen verwaisten Lauf an.
- **Handlungsmeldung.** Scheitert ein Routinenlauf (nichts lesbar, Quelle ständig geändert, Ausgang
  unklar, letzter Schreibversuch gescheitert), erscheint in der Glocke EINE Meldung je Termin
  (`ke-handlung-<Lauf>`, Art `handlung`, mit Grund) — ohne Erfolgssiegel und ohne Verdopplung bei
  Wiederholungen.

## Prüfung vor jeder Wirkung

Vor JEDER Meldung — auch innerhalb eines Takts zwischen zwei Zustellungen, in Sammelmeldungen und in
der Wiederaufnahme — liest die Steuerung Status, Terminausnahme, Konto der Empfängerin und Quelle
neu — und nach abhängigen Schritten (Aufgabenstand, Modellaufruf der bestellten Zusammenfassung)
Konto und Quelle ein weiteres Mal. Die Meldung wird nur geschrieben, wenn in demselben Befehl die
Erinnerung in genau dieser Fassung noch aktiv ist, eine Kontozeile der Empfängerin VORHANDEN,
freigegeben und nicht abgelaufen ist (diese Zeile wird gehalten; ein gelöschtes Konto verhindert
die Zustellung) und die eigene Quelle (Notiz, Aufgabe, Gesprächsnachricht) noch besteht
(`INSERT … SELECT … WHERE EXISTS/NOT EXISTS (… FOR SHARE) ON CONFLICT DO NOTHING`). Eine Sperre
oder Löschung, die dazwischen bestätigt wird, führt zu „gestoppt“ bzw. „wartet auf Klärung“. Der Serverlog zählt solche
Fälle als „vor der Wirkung abgebrochen“.

## Mehrere Prozesse

Laufen mehrere Instanzen gegen dieselbe Datenbank, übernimmt je Termin genau eine den Lauf
(`INSERT … ON CONFLICT … WHERE`, befristete Laufberechtigung 2 min). Eine abgestürzte Instanz hält
einen Lauf höchstens bis zum Ablauf der Berechtigung; die nächste übernimmt ihn, liest die Meldung
zurück und stellt nicht doppelt zu.

## Überwachung

`GET /api/me/klara/erinnerungen/ueberwachung` (je Person): Rückstau (fällige, noch nicht bearbeitete
Erinnerungen, älteste Fälligkeit), Läufe je Status (`fehlgeschlagen`, `unklar`, `gestoppt`, hängende
`laeuft` mit abgelaufener Berechtigung) und der letzte Takt dieser Instanz. Der Serverlog nennt je
Takt nur Zahlen (zugestellt, nachgeholt, verpasst gemeldet, zusammengefasst, übersprungen, per
Readback bestätigt, teilweise, fehlgeschlagen, unklar, gestoppt) — nie Titel oder Konten.

Ein Lauf scheitert höchstens fünfmal (`fehlgeschlagen`) und wartet dann — wie ein `unklar`er Lauf —
auf die Entscheidung der Person („Fortführen“ startet einen neuen Versuch mit Readback).

## Wiederherstellung

Meldungen tragen je Termin eine feste Kennung. Enthält eine Sicherung die Meldung, aber nicht den
Laufabschluss, erkennt der nächste Takt die vorhandene Meldung und schließt den Lauf als „bereits
zugestellt“ ab. Termine, die zwischen Sicherung und Wiederherstellung fällig waren, folgen der
Verpasst-Regel der jeweiligen Erinnerung.

Gegenprobe mit echten Serverprozessen, `scripts/backup/backup.sh` und
`scripts/backup/restore-drill.sh`: `tests/klara-erinnerungen/dienstneustart-restore.integration.test.ts`
(braucht PostgreSQL und `pg_dump`/`pg_restore`/`psql`/`createdb`/`ps`/`curl`; der Stillstand über
mehrere Tage ist dort als Zeitverschiebung im gespeicherten Zeitplan simuliert, Prozessende,
Neustart, Sicherung und Wiederherstellung sind echt).

## Grenzen dieser Fassung

Kein Kalender (folgende Lieferung): es gibt in diesem Schritt keinen Kalenderprovider und damit
keinen isolierten Testkalender, keine Projektion und keine externe Löschung eines Kalendertermins —
eine reale Kalenderprobe setzt die Kalenderlieferung und einen isolierten Prüfkalenderzugang voraus.
Keine E-Mail-/Push-Zustellung; Prüf- und Zusammenfassungsaufträge sind nicht übergebbar. Ein echter
Kundenhost ist mit dieser Lieferung nicht belegt.


## Integration 20.10.2026: Wiederanlauf und konkurrierende Wirkungen

Im gesperrten Wiederanlauf startet der gesamte Erinnerungstakt erst nach der vorhandenen
Außenaktionsgrenze: weder Startlauf noch periodischer Lauf werden eingerichtet. Erst die vorhandene
Freigabe und ein regulärer Neustart ohne `KLARWERK_WIEDERANLAUF` erlauben Quellenverarbeitung,
Modellzusammenfassungen und Routineberichte. Es gibt keinen zusätzlichen Freigabeschalter.

Parallele Ausführer können verschiedene Vorkommen desselben verpassten Stapels halten. Der
Sammelbeleg vereinigt ihre tatsächlich übernommenen Vorkommen atomar unter derselben Meldungs-ID.
Ein Readback gilt ausschließlich, wenn er den konkreten geplanten Zeitpunkt enthält. So verschwindet
kein als zusammengefasst oder übersprungen geschlossener Lauf aus dem dauerhaften Beleg.

Zusammenfassungen führen die gelesene Notiz-, Aufgaben- oder Gesprächsfassung mit. Wechselt sie
während der Modellantwort, wartet der Lauf mit Grund `quelle_geaendert` auf bewusste Fortführung;
die alte Antwort wird nicht zugestellt. Beim Schreiben hält zusätzlich dieselbe SQL-Bedingung wie
bei Routinenberichten die gelesene Fassung. Ergebnis und Lauf machen den Quellenstand nachlesbar.

Die PostgreSQL-Löschung von Erinnerung, Läufen und Meldungen ist ein einziges SQL-Statement und damit
auch am vorhandenen gated-pool atomar. Ein Fehler beim Löschen einer Meldung rollt alle drei Teile
zurück; eine Wiederholung kann den vollständigen Vorgang entfernen. Fremde Konten löschen nichts.

## Persönliche Wissenspflegevorlagen (AW20)

Unter „Erinnerungen“ auf `/aufgaben` bietet „Bericht in den eigenen Notizen“ drei
Pflegevorlagen: offene Prüfungen erinnern, geänderte Quellen melden und regelmäßige
Aktualitätsprüfung. Die Person wählt ausdrücklich ein bis zwanzig lesbare Wissensobjekte,
Zeitpunkt, IANA-Zeitzone, Wiederholung und Ende. Zuständig und Empfänger bleibt die
beauftragende Person. Die Quellenvorschau liest nur; beim Speichern wird der tatsächliche
Ausgangsstand erneut gelesen. Vorlage oder Quellen lassen sich nach erneuter Vorschau
fassungsgebunden ändern. Pause, Fortsetzen, Beenden und Einzelabbruch verwenden die
bestehende Erinnerungssteuerung.

Es gibt keinen zusätzlichen Zeitgeber. Der vorhandene Minutentakt liest zum Termin die
heutigen Konto-, Space- und Quellrechte, die gespeicherte KO-Fassung, tatsächliche offene
Folgeprüfungen und die zentrale Klarwerk-Frische. Er erstellt begrenzte Prüfunterlagen in
den eigenen Notizen und einen internen Hinweis. Titel und Kernaussagen sind ausdrücklich
als Auszüge begrenzt; Originalverweise und tatsächliche Prüfzeitpunkte bleiben sichtbar.
Das bestätigt keine fachliche Gültigkeit, erledigte Wartung, Einarbeitung oder Übergabe.

Die Änderungsvorlage vergleicht gespeicherte Quellfassungen mit dem gelesenen Ausgangsstand.
Zeitablauf allein erzeugt keinen Änderungshinweis. Derselbe geänderte Quellenstand erhält
auch nach Wiederanlauf nur denselben Originalbericht und Hinweis. Wird dieser Bericht
bewusst zurückgenommen, erzeugt derselbe Stand keine Ersatzkopie. Eine neue Quellfassung
kann wieder Prüfunterlagen ergeben. Unlesbare Quellen bleiben „ungeprüft“, bewahren nur
den letzten tatsächlich belegten erfolgreichen Prüfzeitpunkt und pausieren den Auftrag.

Vor Notiz und Meldung gelten der aktuelle Auftrag und der tatsächlich vorbereitete
Quellenstand erneut. Ein später geänderter Prüfstand darf einen alten Bericht nicht als
aktuelles Ergebnis zustellen; eine bereits gespeicherte Originalnotiz bleibt am Lauf
belegt. Fehlgeschlagene, gestoppte und ungeklärte Läufe sind keine erfolgreiche Pflege.
Die bestehenden PostgreSQL-Tabellen, Notiz-Idempotenz, Sperren und Backupwege werden
verwendet. Es werden keine externen Empfänger, Modelle, Kalender oder Webhooks beauftragt.

Dieser persönliche Vorlagenweg erfüllt noch keinen allgemeinen Team- oder Quellenwatch:
Er legt insbesondere keine Lebenszyklus-Folgeaufgabe aus nachgewiesenen Abhängigkeiten an.
Vollständige Dokumenttexte, Konfliktbewertung und fachliche Entscheidungen gehören weiter
an das Original und in die vorhandenen Fachabläufe. Eine Browserprobe am lokalen Kandidaten
ist kein Nachweis für eine veröffentlichte Version oder einen tatsächlichen Office-Host.
