Stand der Integration 20.10.2026: Der eigene Kalender verwendet jetzt denselben persistenten
Erinnerungsdienst und denselben vorhandenen Kalenderadapter. Ausführungsstände, Absagen und
Serienpause kommen aus dem echten internen Dienst. Ein aktiver Lauf ist derzeit nicht einzeln
abbrechbar; die Oberfläche bietet dafür keine bestätigte Wirkung an. Externe Termine erfordern
weiterhin einen konkreten autorisierten Kalenderzugang. Eine vorhandene Adapterfunktion allein
wird ohne konfigurierte Anbindung nicht als verbundener Kalender angezeigt.

# Eigener Kalender ohne externen Dienst (AW-16)

Auftrag `produkt:20261010:klara-eigener-kalender`. Stand: Nacharbeit 8 (Integration mit main
25f2ea02; Anschluss der gelieferten Aufgaben aus Bens Befund zu Kandidat 0b88f41b).

## Was es gibt

- **Seite** `/kalender` („Mein Kalender", erreichbar über das Konto-Menü): Tages-, Wochen- und
  Agendaansicht, Formular zum Anlegen und Ändern, Einzelansicht mit den drei getrennten Abschnitten
  *Kalendereintrag*, *Auszuführender Auftrag* und *Tatsächliches Ergebnis*.
- **Office-Begleitung**: im Word-Seitenfenster von Klara der zugeklappte Block „Mein Kalender"
  (`apps/web/public/word-addin/kalender.js`, Markup `#kalender-block` in `taskpane.html`). Er liest
  beim Aufklappen DIESELBE Route mit derselben Sitzung (`GET /api/me/kalender`), zeigt dieselben
  Einträge mit derselben Kennung (`event_id`) für die nächsten 14 Tage, persönlich oder Team, mit
  Einzelansicht (Eintrag, Auftrag, Ergebnis) und einem Verweis auf `/kalender`. Das Fenster liest
  und schreibt nichts im Dokument und löst nichts aus. Jedes Aufklappen fragt den Server neu; ein
  früher geladener Stand wird beim Zuklappen verworfen und nie wieder angezeigt — nach einem
  Teamaustritt oder Quellrechteentzug erscheint nur, was die heutigen Rechte hergeben.
- **Server** `services/app/src/eigener-kalender.ts` und `services/app/src/routes/eigener-kalender-routes.ts`:

  | Tür | Zweck |
  | --- | --- |
  | `GET /api/me/kalender?bereich=persoenlich\|team` | Ansicht, Sichtwahl, Termine des vorhandenen Kalenders, Stand der Anbindungen |
  | `PUT /api/me/kalender/einstellungen` | Sichtwahl `eigen`, `vorhanden` oder `beide` |
  | `POST /api/me/kalender/eintraege` | Eintrag anlegen |
  | `GET/PUT/DELETE /api/me/kalender/eintraege/:id` | öffnen, ändern (mit gesehener `fassung`), löschen |
  | `POST /api/me/kalender/eintraege/:id/folgen` | Folgen einer Aktion zeigen — ändert und löst nichts |
  | `POST /api/me/kalender/eintraege/:id/aktionen` | Aktion ausführen, nur mit `bestaetigt: true` |

- **Daten**: Tabellen `kalender_eintraege` (eine Zeile je `event_id`) und `kalender_einstellungen`
  (Sichtwahl je Konto). Additiv, ohne Fremdschlüssel; im Restore-Drill Pflichttabellen, im
  Dateninventar die Datenart `eigenerkalender`.

## Auftrag, Lauf, Ergebnis und Serie

Der Kalender speichert dazu NUR Verweise: `fristId` (deadline_id), `auftrag.taskId` (task_id),
`lauf.runId` (run_id), `serie.seriesId` (series_id). Titel des Auftrags, Stand des Laufs, das
tatsächliche Ergebnis und der Pausenstand der Serie werden bei jeder Anzeige aus dem
**Ausführungsnachweis** gelesen (`AusfuehrungsNachweis`), mit den heutigen Rechten der lesenden
Person. Ein Ergebnis lässt sich über die Kalenderbearbeitung nicht eintragen (400); eine Kennung,
die der Nachweis nicht kennt, wird abgewiesen (404).

Absagen eines Laufs, Abbrechen laufender Arbeit und Pausieren/Fortsetzen der Serie gehen an den
Ausführungsdienst. Als vollzogen gilt nur, was der Dienst bestätigt UND was danach zurückgelesen so
dasteht; sonst antwortet der Kalender `409 nicht_bestaetigt` und zeigt den Stand des Dienstes.
„Aus der eigenen Ansicht entfernen" bleibt eine reine Kalenderaktion.

**Auftragsverknüpfung über die Aufgabenablage** (Nacharbeit 7): Die reine Verknüpfung `task_id`
braucht nur die Aufgabenablage (`AufgabenNachweis`, `services.kalenderAufgaben`). Für die
gelieferten persönlichen Aufgaben (`produkt:20261008:klara-aufgaben`, 1.0.0-beta.1.944 / 25f2ea02)
geht der Anschluss über ihren berechtigten Leseweg: `aufgabenNachweisAus(klaraAufgabeDienst)`. Der Kalender liest
damit nur Aufgaben des eigenen Kontos, löst den Titel bei jeder Anzeige neu auf und weist fremde
oder unbekannte Kennungen ab (`404 verweis_unbekannt`). Eine gelöschte Aufgabe steht danach als
„nicht auflösbar“ ohne Titel da. Eine persönliche Aufgabe lässt sich nicht in den Teamkalender
verknüpfen (`409 aufgabe_persoenlich`).

**Ausführungsdienst im integrierten Kandidaten**: Der eigene Kalender verwendet dieselbe
persistente Erinnerungs-/Routinensteuerung wie die persönlichen Erinnerungen. Auftrag, Lauf und
Serie werden mit ihren tatsächlichen Kennungen gelesen; die Uhrzeit allein belegt kein Ergebnis.
`services.kalenderAusfuehrung` ist der bestehende austauschbare Anschluss für isolierte Prüfstände.

**Aktive Arbeit abbrechen** zeigt zuerst die Folgen und benötigt die ausdrückliche Bestätigung.
Der Dienst sperrt genau den eigenen aktiven Lauf gegen weitere Meldungs- und Berichtswirkungen.
Kalendereintrag, Serie, andere Läufe und bereits gespeicherte Ergebnisse bleiben erhalten. Eine
schon begonnene Wirkung wird vor dem Abbruch fertig gelesen; ein vorhandener Bericht steht als
„Bericht gespeichert“ beim abgebrochenen Lauf, ohne den gesamten Lauf als abgeschlossen auszugeben.
Eine noch laufende Modellantwort kann zurückkommen; sie darf danach keine neue Wirkung speichern.
Der nächste reguläre Serientermin läuft weiter. Abbruch ist keine Rücknahme einer früheren Wirkung.

**Stand im Kandidaten** (Nacharbeit 8, integriert mit main 25f2ea02): `buildApp` verdrahtet den
Kalender mit DEMSELBEN `KlaraAufgabeDienst`, der auch `/api/me/klara/aufgaben` bedient
(`services.kalenderAufgaben` überschreibt das nur in Prüfständen). Belegt in
`tests/eigener-kalender/kalender-aufgaben.test.ts` an echten Aufgaben, die über die gelieferten
Türen angelegt, umbenannt und gelöscht werden.

## Vorhandener Kalender

Die Sichtwahl `vorhanden`/`beide` liest die Termine des vorhandenen Kalenders über den Zugang
`VorhandenerKalender` (nur lesend) und zeigt sie in Tag, Woche und Agenda als „aus dem vorhandenen
Kalender". Interne Fristen und zeitgesteuerte Einträge bleiben in jedem Modus sichtbar und wirksam.

**Externer Anschluss im integrierten Kandidaten**: Die technische Kalenderanbindung ist
vorhanden; verbunden wird sie ausschließlich mit einer tatsächlich zugewiesenen bestehenden
Betreiberkonfiguration. Ohne diese bleibt die Anzeige „nicht verbunden“. Echte externe
Providerwirkung, Kalendergrant und Hostprobe sind getrennt zu belegen. Anschluss:
`services.vorhandenerKalender` in `build-app.ts`.

## Rechte

- Persönlich ist Standard und privat; auch Administratoren lesen fremde persönliche Einträge nicht.
  Persönliche Einträge erscheinen nie im Teamkalender — weder auf der Seite noch im Word-Fenster.
- Teameinträge sehen die HEUTIGEN Mitglieder eines nicht archivierten Teams. Auftrag, Lauf, Serie und
  Löschen steuern nur die Verantwortlichen des Eintrags oder die Teamzuständigen. Eine
  Serienaktion ist nur erlaubt, wenn die Person JEDEN Eintrag dieser Serie heute steuern darf.
- Ohne Verantwortliche („unzugeordnet") gibt es keinen Ausführungsauftrag.
- Ein aus einem Wissensobjekt abgeleiteter Eintrag zeigt Titel, Notiz und Quelle nur, solange die
  lesende Person das Objekt heute sehen darf (`darfSehen`).

## Was der Kalender nicht tut

Kein Modell, keine Einladung oder Nachricht, keine Verlängerung, keine Systemänderung aus eigenem
Antrieb.

## Offen (getrennt von dieser Lieferung)

- Reale externe Kalender-/Providerprobe mit zugewiesenem Anbieterzugang. Interner
  Ausführungsdienst und aktiver Einzelabbruch sind am Kandidaten technisch angeschlossen;
  unabhängige Abnahme und zentrale Bereitstellung bleiben eigene Nachweise.
- Bedienbeleg im echten Word-Host (Menschen-/Hostprobe); belegt ist der Block am echten Server in
  jsdom (`tests/eigener-kalender/word-kalender.test.tsx`).
- Vollständiger AW19-Umfang: beliebige Dokument-/Anhangstexte, weitere Sprachformen und alle ursprünglichen Betriebs-/Fachnachweise. Der nachfolgende begrenzte persönliche Erfassungsweg ist im Code angeschlossen.

## Engste Nachweise zum aktiven Einzelabbruch

`tests/klara-einzelabbruch/kalender-am-server.test.ts` fährt die tatsächlichen authentifizierten
Kalender-/Erinnerungs-APIs auf derselben App-Ablage, mit kontrollierter Uhr und Modellantwort:
Folgen lesen, Dialog abbrechen, Fremdzugriff ablehnen, aktiven Lauf abbrechen, späte Antwort
verwerfen, Folgetermin ausführen und bereits gespeicherten Originalbericht erhalten.

F5–F7 in `tests/klara-erinnerungen/erinnerung-pg.integration.test.ts` benutzen echte getrennte
PG-Pools und den gated-pool: Abbruch unmittelbar vor Meldungs- bzw. Berichts-INSERT; echte
Wirkungssperre mit `pg_blocking_pids`, Readback bereits gespeicherter Meldung/Notiz, Erhalt eines
anderen aktiven Laufs. Keine zusätzlichen Tabellen oder Scheduler. Code-Rücknahme erhält bereits
abgebrochene Läufe und ihre Ergebnisse; sie aktiviert sie nicht erneut.


## AW19: Fristen aus ausdrücklich gewählten Informationen

Die Seite „Mein Kalender“ enthält den zunächst geschlossenen Bereich „Fristen aus Informationen“.
Eine Regel nennt konkrete Quellen, erlaubte Fristarten, die persönliche Sicht, die IANA-Zeitzone für
„heute/vergangen“ und die Änderungsregel. Die aktive Regel verarbeitet beim Speichern sowie beim
bewussten Neulesen eindeutig belegte Fristaussagen ohne weitere Bestätigung je Termin. Die Vorschau
schreibt nichts. Es entsteht durch die Auswahl kein dauernder Quellen-Watchauftrag und kein weiterer
Zeitgeber; die ausdrücklich beauftragte Wissenspflege ist ein eigener ursprünglicher Auftrag.

Quellen dieses begrenzten Anschlusses sind die heute berechtigt gelesene Kernaussage eines
Wissensobjekts, der Inhalt einer eigenen Notiz und eine bewusst ausgewählte eigene gespeicherte
Gesprächsnachricht. Bei Nachrichten nennt die interne Quellenkennung Gespräch und Nachricht; ein
weiteres Gespräch oder eine Modellantwort wird nicht mitbeobachtet. Der Anhangsleser ist noch nicht
angeschlossen und liefert keine vorgetäuschten Fristbelege.

Der kostenfreie deutsche Erkenner verlangt eine konkrete Objektkennung und einen Fristanlass mit
Datum in derselben Aussage. Numerische Kennungen wie L-17 oder Z-8 und ausdrücklich bezeichnete
Großbuchstabencodes werden erkannt. Andere Sprachformen sind damit nicht allgemein abgenommen.
Satz- und Aussagegrenzen bleiben erhalten; ein Nachbarsatz liefert kein Objekt oder Datum hinzu.
Unklare Daten, fehlende Zeitzonen bei Uhrzeiten, Sommerzeitlücken/-doppelungen, widersprüchliche
Belege und unklare Geltung bleiben zur Klärung offen. Ein erstes unklar belegtes Datum erzeugt keinen
verbindlichen Kalendertermin. Ein schon vorher übernommener Termin zeigt einen späteren Konflikt
oder Widerruf sichtbar als unverlässlich; er wird dadurch nicht als fachlich gekündigt behauptet.

`klara_fristen` hält je Konto Regel, Vorgänge, Quellfassungen/Fundstellen, Ablehnungsmarken und
Änderungsverlauf. Die Fristidentität besteht aus Konto, Objekt und Anlass; Beleg und Quellfassung
sind davon getrennt. Der Kalender projiziert denselben Vorgang über `FristenKalenderRepo`, ohne
zweiten Fristdatenspeicher. Löschen im Kalender verwirft die Frist und behält die geschützte Marke.
Eine manuelle Datumsänderung behält dieselbe Frist- und Ereigniskennung; sie wird als manuell
festgelegt angezeigt und durch einen Quellenabruf nicht still überschrieben. Vergangen ist keine
Erledigungsbestätigung. Unbekannte fachliche Verantwortung bleibt unbekannt; Kalenderbesitz erteilt
keine Ausführungsbefugnis.

Die fünf persönlichen Fristenrouten verlangen die Sitzung. PostgreSQL bindet das tatsächliche
Schreiben an Konto, gelesene Quelle und heutige Rechte, mit dem vorhandenen Space-Schreibschutz.
Ein struktureller Inhaltsvergleich verhindert neue Fassungen allein durch JSONB-Schlüsselreihenfolge.
Die eigene Anzeige prüft heutige Quellenrechte auch bei historischen Belegen; die Kalender- und
Word-Sicht schützen den abgeleiteten Text. Berichtstexte im Audit werden nicht gespeichert.

Der synthetische Sollbestand und seine vor der Prüfung gesetzten Grenzen stehen unter
`tests/klara-fristen/sollbestand.ts`; Erkennung, Nicht-Erkennung, Datum, Objekt und Klärung werden
getrennt gemessen. Das ist kein allgemeiner Sprach-, Rechts- oder Normnachweis. Technische Quellen-,
Konto-, Konkurrenz- und Rollbackfälle sowie ein echter Dump/Restore laufen im eigenen begrenzten
PG-Test. Der Restore baut Pool und App neu, bleibt jedoch im selben Testprozess. Ein neuer echter
Node-Prozess, Office-Host oder Kalenderprovider wird dadurch nicht behauptet; die bereits vorhandenen
entsprechenden Belege bleiben getrennt erhalten.

Die Erfassung legt keinen Vorlauf, Versand, Auftrag, Normersatz oder externe Einladung an. Eine
weitergehende Wirkung braucht den dafür vorgesehenen gesonderten begrenzten Auftrag. Die vollständigen
sieben ursprünglichen D-Verträge bleiben maßgeblich; die neue Teilfunktion allein schließt sie nicht.
