# BPA-06 · Vorgeführte Arbeit lernen und als persönliche Funktion wiederholen

Auftrag: `produkt:20261011:assistenz-lernen-hostfortsetzung` (Revision 1), BPA-Gesamtpaket r2,
Quelle `6de15c5f…5a36b2`. Folgeumfang zu `produkt:20261011:peter-p06`.

## Ausgangslage im Produktbaum (Quelleninspektion, Stand dieses Kandidaten)

| Voraussetzung laut Auftrag | Im Baum vorhanden? |
| --- | --- |
| P06-Lern-/Routinenkern (`peter-p06`) | **Nein.** Kein Funktions-/Routinenspeicher, kein Lernmodus. P06 läuft laut Auftrag noch. |
| Vorhandene Zeitsteuerung für persönliche Routinen | **Nein.** Nur interne Zeitgeber (Hintergrundprüfung, Papierkorb); keine nutzerbezogene Routine mit Zeitzone. |
| Aktionskern (`klara-aktionen`) mit Außenaktionsbestätigung | **Nein.** |
| Hostadapter BPA-01 (Chrome) / BPA-04 (Word/Finder) mit Ereignismeldung | **Nein.** `extensions/klara-browser` liest Markierungen, meldet keine Bedienereignisse. |
| Bildschirmabläufe (`bildschirmablaeufe`) | Ja, als **Dateiimport** ohne eigenen Rekorder (`docs/aufnahme/bildschirmablauf-uebernahme.md`). Er erzeugt Anleitungen, keine ausführbare Funktion. |

Folge: Diese Lieferung baut **nur den hostunabhängigen, vorbereitenden Teil** (Auftrag, Reihenfolge
Schritt 4: „Vorbereitende Vorschau/Parameterisierung kann früher beginnen“). Sie baut **keinen**
zweiten Routinenspeicher, **keinen** Zeitgeber und **keinen** Hostzugriff (G03, AC05).

## Was geliefert ist

`services/app/src/assistenz-lernen.ts` — reine Funktionen, keine Ablage, kein Netz, kein Modell:

| Baustein | Inhalt |
| --- | --- |
| `beginneLernen`, `lernAnzeige` | Lernauftrag aus natürlicher Sprache nur mit erkennbarer Lernabsicht, freigegebener Anwendung und abgegrenztem Vorgang (aus dem Satz oder dem gemeldeten Objekt). Anzeige „Lernen“ mit Zustand; erste Steuerung ist immer „Pause“ bzw. „Fortsetzen“; Mikrofon nie an. |
| `nimmAuf`, `bereinige` | Nur im laufenden Lernmodus und nur aus dem abgegrenzten Fenster. Vor der Ablage im Trace: Kennwortfelder, Feldnamen wie Token/PIN/TAN/Schlüssel, tokenähnliche Werte (Bearer, JWT, Anbieterschlüssel, lange gemischte Zeichenketten) und ausgeschlossene Felder verlieren ihren Wert; Koordinaten werden nie übernommen. **Fensterbilder werden nie übernommen**, auch nicht mit gesonderter Bildfreigabe: Ein Bild zeigt das ganze Fenster samt geschützter Felder, und eine gesicherte Schwärzung ist hier nicht möglich (keine OCR/KI). Der Schritt trägt dann `bildAusgelassen`. |
| `pausiereLernen`, `setzeLernenFort`, `naechsteVorfuehrung`, `beendeLernen`, `brichLernenAb` | Pause, Wiederaufnahme, mehrere Vorführungen; Abbruch verwirft die Rohdaten nach der eingestellten Regel. |
| `entwerfeLernnotiz` | Richtet die Vorführungen über Art und benanntes Ziel (Zugänglichkeitsrolle/-name) aus. Wechselnde Werte, jeder Empfänger und Datumsangaben werden Eingaben **ohne** Beispielwert; gleiche harmlose Werte bleiben fest. Schritte, die nur in einer Vorführung vorkommen, Klicks ohne benanntes Ziel und geschützte Felder werden manuelle Entscheidungspunkte. |
| `vorschau`, `aendere` | Vorschau in einfacher Sprache: Stand, Zweck, Eingaben, Schritte, Ergebnis, Rechte, Haltepunkte. Änderbar vor der Aktivierung (Name, Zweck, Ergebnis, Beschriftung, Schritt entfernen, als Entscheidung, fester Wert → Eingabe). |
| `bestaetige`, `ueberarbeite`, `pausiere`, `setzeFort`, `loesche`, `darfStarten` | Nur die Eigentümerin bestätigt, mit ausdrücklich erlaubten Wirkungen und geprüftem Zeitplan. Jede Bestätigung ist eine neue Fassung; eine Überarbeitung auf veraltetem Stand wird abgewiesen. Pause/Löschen sperren künftige Läufe; Löschen entfernt Schritte und Zeitplan, Ergebniskennungen bleiben. |
| `pruefeZeitplan` | Angabe für die vorhandene Zeitsteuerung: sofort, ab Datum (Ortszeit + IANA-Zeitzone) oder wöchentlich (Wochentag, Uhrzeit, Zeitzone, Nachholregel). Nur Prüfung der Angabe — keine Fälligkeitsrechnung. |
| Zielbindung (`ZielBindung`, `bestaetige`) | Die bestätigte Funktion ist an Mandant, Host, Anwendung und ein **bestätigtes Zielobjekt** (Dokument, Vorlage oder Ordner) gebunden. Ohne Zielobjekt entsteht keine Funktion. |
| `planeLauf`, `pruefeErgebnis` | Vor jedem Lauf neu: Stand, Eigentümerin, gebundene Fassung, Mandant, Host, Anwendung, **Zielobjekt** (ein anderes Dokument mit gleich benannten Feldern wird abgewiesen) und **objekt- und fassungsbezogene Rechte**; Schreibrecht nötig, Beobachtung allein genügt nicht; Eingaben ohne Zugangsdaten. Eine **geänderte Hostfassung hält vor dem ersten Schritt**, auch wenn alle Bedienelemente gleich heißen; weiter geht es erst nach Überarbeitung (`aendere` → `hostfassung`) und neuer Bestätigung. Harmlose, erlaubte Schritte laufen ohne Einzelrückfrage; Halt am ersten Entscheidungspunkt, an nicht erlaubter Wirkung, an fehlendem Ziel und an folgenreicher Wirkung ohne passende Bestätigung. Der Plan trägt Lauf, Sitzung, Objekt und Fassung. Ergebnisprüfung vergleicht gesetzte Eingaben mit dem gemeldeten Ergebnis. |
| `aussenwirkung` | Was die Person vor einer folgenreichen Wirkung sieht: Funktion, Lauf, Fassung, Schritt, Ziel, Dokument mit Fassung und der **gesamte Inhalt** des Laufs, dazu ein SHA-256-Abdruck. Eine Bestätigung gilt nur mit genau diesem Abdruck für genau diese Funktion und diesen Lauf; ein geänderter Bericht, ein neuer Lauf, eine andere Funktion oder eine andere Dokumentfassung braucht eine neue Bestätigung. |
| `pruefeVorWirkung` | Unmittelbar vor jeder tatsächlichen Wirkung: dasselbe Dokument, eine Fassung, die geprüft war oder die dieser Lauf selbst erzeugt hat, und Schreibrecht für genau diese Fassung. Bei fremder Änderung wird nichts überschrieben. |

## Kriterien — was belegt ist und was offen bleibt

Belegt ist jeweils nur die **Logik** mit synthetischen Daten (`tests/assistenz-lernen/`). Das ist
Simulation im Sinn von G13 — keine reale Hostprobe, keine Installation, keine Gesamtabnahme.

| Kriterium | Logik geliefert und geprüft | Offen (abhängiger Teil) |
| --- | --- | --- |
| AC01 | Abgrenzung, Anzeige, Pause, Abbruch | Sichtbare Anzeige in einem echten Host (BPA-01/04) |
| AC02 | Zwei Berichte → Eingaben, keine Beispielwerte/Empfänger | — (an echten Hostereignissen nicht geprüft) |
| AC03 | Vorschau und Änderungen | Bedienfläche „Meine Funktion“ (P06) |
| AC04 | Lernnotiz startet nicht; harmlose Schritte ohne Einzelrückfrage | Ausführung über den Aktionskern |
| AC05 | Zeitplanangabe mit Zeitzone und Nachholregel; kein eigener Zeitgeber | **Offen:** Sofortstart/ab Datum/Wiederholung über die **vorhandene** Zeitsteuerung — im Baum nicht vorhanden (P06/`klara-erinnerungen-kalender`). Sommerzeit und Nachholen rechnet diese Zeitsteuerung. |
| AC06 | Bereinigung vor Ablage, Eingaben ohne Zugangsdaten | Persistenz im P06-Speicher |
| AC07 | Entscheidungspunkte statt Koordinaten; Halt bei geändertem Host | Echte Hostversionsmeldung |
| AC08 | Ohne Schreibrecht / nur Beobachtung kein Lauf; nachgebildeter Testbericht mit Ergebnisprüfung | **Offen:** tatsächlich erstellter Testbericht in Word/Chrome mit Ergebniskennung |
| AC09 | Außenaktion nur mit passender Bestätigung; Pause/Löschen | Bestätigungsweg des Aktionskerns |
| AC10 | — | **Offen:** Agentenvergleich gegen den bisherigen Weg (BPA-S12); setzt realen Host voraus |

## Einbindung, sobald die Voraussetzungen da sind

1. Hostadapter meldet `HostEreignis` (Rolle/Name des Bedienelements, Feldtyp, Wert, Hostfassung)
   und zeigt `lernAnzeige` dauerhaft mit Pause.
2. P06 legt `Lernnotiz` und `PersoenlicheFunktion` (samt `fassungen`) unter dem Konto ab.
3. Die vorhandene Zeitsteuerung liest `zeitplan`, fragt vor jedem Anstoß `darfStarten` und ruft
   `planeLauf` mit den **aktuellen** Rechten und Zielen des Hosts.
4. Der Aktionskern führt nur Schritte mit `ausfuehrung: "automatisch"` aus und hält am Rest;
   danach `pruefeErgebnis` mit dem tatsächlichen Ergebnis.

## Grenzen

- Lernabsicht und Vorgang werden ohne KI aus dem Satz erkannt (feste Wortliste, deutsch). Andere
  Formulierungen führen zur Rückfrage, nicht zu einem geratenen Auftrag.
- Die Erkennung von Zugangsdaten ist eine Regel, kein Beweis; sie schlägt eher zu oft an (Halt statt
  Übernahme). Fensterbilder werden nicht übernommen; ein Bildweg braucht erst eine gesicherte
  Schwärzung im Hostadapter.
- Die Außenbestätigung ist hier ein Abdruckvergleich. Der vorgesehene Bestätigungsweg des
  Aktionskerns (`klara-aktionen`) ist im Baum nicht vorhanden; sobald er da ist, trägt er den
  Abdruck aus `aussenwirkung`.
- Ausrichtung mehrerer Vorführungen über Art und Bedienelementname; ein im Host umbenanntes Element
  zwischen zwei Vorführungen erscheint als Verzweigung.
- Keine echte menschliche Bedienung, kein realer Host, keine Zeitsteuerung, keine Veröffentlichung
  sind Teil dieser Lieferung.

## Zugeordnete Originalkandidaten (Stand Nacharbeit 3, Kandidat `a548a5a0`)

Die frühere Aussage (Nacharbeit 1/2), es gebe keine lesbaren Originalkandidaten, ist **überholt**.
Die Koordination hat am 11.10.2026, 15:29:15 UTC zugeordnet
(`QUELLEN-HILFE-59471138-ORIGINALKANDIDATEN.json`); die Einstiege sind mit `git show` lesbar.
Keiner der drei ist geliefert (Phase „Prüfung“, keine Lieferung), keiner ist in diesem Zweig oder im
Hauptstand enthalten, und jeder liegt auf einer eigenen Basis.

| Baustein | Auftrag · Kandidat | Tatsächliche Fähigkeiten laut Kandidat | Eigene Grenzen laut Kandidat |
| --- | --- | --- | --- |
| P06 Vormachen und Routine | `peter-p06` · `d680a62f` (37 Dateien, +5802) | Lernsitzung mit gewähltem Host (Word-Taskpane, Klarwerk-Web) und gewählten Vorgängen; Lernanzeige auf jeder Seite und im Word-Panel mit sofortiger Pause; Mitschreiben nur bei sichtbarer Anzeige; Vorschau mit Beleg je Schritt, Korrektur, Bestätigung genau des gezeigten Stands; Abbruchregel; Rohdaten höchstens 24 h; **dauerhafte Routinen** (Postgres `persoenliche_routinen`, Restore-Drill); Außenschritt je Ausführung mit verbrauchter, 5 Minuten gültiger Ausführungskennung; Firmenübergabe als Entwurf; Privatlöschung; ausgeführter Agentenvergleich mit Skriptagent | kein Scheduler („läuft nur auf Anstoß“); Außenaktion wird nicht ausgeführt, nur freigegeben; Word-Hostbedienung offen; kein Modellagentenvergleich |
| Aktionskern | `klara-aktionen` · `bc3b90fd` (33 Dateien, +9325) | `klara-auftrag.ts`: Auftragsgrenze in Fassungen (erlaubte Aktionen, Ziele, Quellen, Ergebnisanforderung), nur engere Korrektur, Schrittprüfung gegen die aktuelle Fassung, Wiederholschlüssel, Abbruch, Rücknahme nur für rücknehmbar gemeldete Schritte | an das Klara-Gespräch gebunden |
| BPA-04 Programmadapter | `assistenz-programmadapter` · `ac640eba` (31 Dateien, +3863) | Word für Mac / Word im Browser (Office.js) und Finder-Datei; `pruefeZielVorWirkung` vor jedem Einfügen (Sitzung, Konto, Dokument, Markierung, Fassung); Bindungssiegel; Koordinate ist nie ein Ziel | `HOSTBELEGE` leer: nichts real belegt; keine Bedienung über die Bedienungshilfe; Office.js nennt keine Dokumentfassung |
| Persönliche Zeitsteuerung | `klara-erinnerungen-kalender` | **nicht zugeordnet** | — |
| BPA-01 Chrome | — | **nicht zugeordnet** | — |

### Abgleich mit BPA-06: was P06 schon trägt und was der Zusatzumfang ist

| Kriterium | Getragen von | BPA-06-Zusatz aus diesem Modul |
| --- | --- | --- |
| AC01 Lernmodus, Pause | P06 (Lernanzeige, Pause, Sichtbarkeit als Bedingung) | Lernabsicht und Vorgang aus natürlichem Satz |
| AC02 Parametrisierung aus zwei Berichten | — | `entwerfeLernnotiz` (P06 hat genau eine Sitzung je Routine) |
| AC03 Vorschau, Änderung | P06 (Vorschau mit Beleg, Korrektur) | Eingaben-, Rechte- und Haltepunktabschnitte |
| AC04 Lernnotiz vs. Routine | P06 (Bestätigung genau des Stands) | Zielbindung an Mandant/Host/Objekt |
| AC05 Zeitsteuerung | **keiner** (P06 ohne Scheduler; Zeitsteuerung nicht zugeordnet) | `pruefeZeitplan` als Angabe |
| AC06 Bereinigung | P06 (Rohdaten ≤ 24 h, nur Titel/Frage) | Zugangsdaten-/Feldausschluss, kein Fensterbild |
| AC07 Hostwechsel, Verzweigung | BPA-04 (`pruefeZielVorWirkung`, keine Koordinate) | Halt bei geänderter Hostfassung, Verzweigung als Entscheidungspunkt |
| AC08 Rechte, Testbericht | BPA-04 (Zielprüfung), Aktionskern (Schrittprüfung) | objekt- und fassungsbezogene Laufprüfung, `pruefeVorWirkung`, `pruefeErgebnis` |
| AC09 Außenaktion, Pause/Löschen | P06 (verbrauchte Ausführungskennung, Privatlöschung) | Inhaltsabdruck der Außenwirkung; nach Anbindung als Bindung der P06-Ausführungskennung, **nicht** als zweiter Bestätigungsweg |
| AC10 Agentenvergleich | P06 (ausgeführt, Skriptagent) | — |

### Warum die Anbindung in diesem Kandidaten noch nicht steht

Anbinden heißt, die BPA-06-Funktionen in `vormachen.ts`/`vormachen-routes.ts` (P06),
`klara-auftrag.ts` (Aktionskern) und `programmadapter.ts` (BPA-04) aufzurufen. Diese Dateien gibt es
in diesem Zweig nicht. Dafür müssten die drei fremden, noch nicht gelieferten Zweige in diesen Zweig
zusammengeführt werden. Das ist eine Git-Zusammenführung, die die Bearbeitung nicht ausführen darf
(keine Commits), und eine Integrationsentscheidung über nicht abgenommene Fremdkandidaten. Schon die
rein lesende Konfliktprobe (`git merge-tree`) wurde in der Bearbeitungssitzung technisch abgewiesen.
Die Dateien zu kopieren, wäre ein zweiter Kern neben den Originalen und wurde nicht getan.

Nötig ist also eine von zwei Entscheidungen der Koordination:
1. Die drei Kandidaten werden geliefert und in den Hauptstand übernommen; danach integriert dieser
   Zweig den Hauptstand (regulärer Schritt „Hauptstand integriert“), und die Anbindung folgt hier.
2. Oder die Koordination führt die drei Kandidatenzweige ausdrücklich in diesen Auftragszweig
   zusammen; danach folgt die Anbindung hier.

Zusätzlich offen und extern: Zuordnung der persönlichen Zeitsteuerung (AC05) und von BPA-01;
reale Host-Läufe (BPA-04 `HOSTBELEGE` leer, Word-Hostbedienung in P06 offen).

## Produktweg mit P06 (Nacharbeit 23)

Der P06-Stand (`vormachen.ts`, `vormachen-routes.ts`, Lernanzeige, „Vormachen und Routinen“,
dauerhafte Routinen) liegt jetzt im Arbeitsbaum. BPA-06 ist daran angeschlossen, ohne eigenen
Speicher und ohne eigenen Ausführungsweg:

| Teil | Wirkung |
| --- | --- |
| P06 (unverändert) | Lernsitzung mit Host und Vorgängen, sichtbare Lernanzeige mit Pause, Vorschau mit Korrektur, Bestätigung genau des Stands, dauerhafte Routine, Außenschritt-Freigabe je Ausführung, Privatlöschung. |
| `assistenz-lernen-p06.ts` | Sicht auf eine bestätigte P06-Routine des Hosts Klarwerk-Web als persönliche Funktion. `entwurf_anlegen` wird zu Titel und Kernaussage als Eingaben des Laufs plus Speichern, `entwurf_speichern` zu Speichern und `zur_pruefung_einreichen` zur folgenreichen Wirkung. Fassung, Eigentum und Löschung bleiben bei P06. |
| `POST /api/me/vormachen/routinen/:id/lauf` (`routes/assistenz-lernen-routes.ts`) | **Der Lauf**, den P06 nicht hat. Die Route lädt die eigene Routine (fremd 404) und prüft mit `planeLauf`: Fassung, keine Zugangsdaten als Eingabe, Anlagerecht der Rolle (sonst 403 `nur_beobachtung`) und Halt am Außenschritt (409 `haelt_an`). Ein freigegebener Plan wird über `alsKlaraAuftrag` ein Auftrag im eigenen Klara-Gespräch. |
| Aktionskern (unverändert) | `POST …/auftraege/:auftragId/schritte/:schluessel/ausfuehrung` legt den Bericht über `/api/drafts` mit den Rechten der Person an, liest nach, schützt vor Wiederholung und kann zurücknehmen. |

### Nacharbeit 25: Wiederholung, Bedienung, Pause und Zeitplan, Vergleich

| Teil | Wirkung |
| --- | --- |
| Idempotenter Lauf (G12) | Die Laufkennung wird mit Konto, Routine, Fassung, Gespräch und Eingaben (Abdruck) **dauerhaft im JSON der Routine** an genau einen Auftrag gebunden (`VormachenDienst.einmalJeLauf`, je Routine nacheinander). Ablauf: erst reservieren, dann anlegen, dann eintragen. Dieselbe Anfrage liefert denselben Auftrag (200, `wiederholt`), dieselbe Kennung mit anderen Angaben 409 `lauf_widerspricht`. Fehlt nach einem Abbruch der Eintrag, wird der schon angelegte Auftrag über seinen Wortlaut wiedergefunden. |
| Pause der Routine | `PUT /api/me/vormachen/routinen/:id/zustand` (`aktiv`/`pausiert`) steht an der Routine. Pausiert lehnt `planeLauf` jeden Lauf ab (409 `pausiert`). Die Privatlöschung entfernt die Routine; ein späterer Lauf ergibt 404, der erstellte Entwurf bleibt. |
| Zeitplan | `PUT …/zeitplan` speichert die geprüfte Angabe an der Routine: sofort, ab Datum oder wöchentlich, mit IANA-Zeitzone und Nachholregel. **Ausgeführt wird sie nicht**: Eine persönliche Zeitsteuerung gibt es im Stand nicht, und ein eigener Zeitgeber wäre ein zweiter Scheduler. Sommerzeit und Nachholen rechnet erst die zugeordnete Zeitsteuerung. |
| Bedienung | „Meine Routinen“ (`RoutineLauf.tsx` in `VormachenFlaeche`) zeigt Zustand mit Pause/Fortsetzen sowie Titel und Kernaussage dieses Laufs. „Ausführen“ ist ein Klick: Gespräch beginnen, Lauf, Ausführung über den Aktionskern; danach erscheint der Entwurf mit Link oder der tatsächliche Grund. Ein erneuter Klick nach Abbruch nutzt dieselbe Laufkennung. |
| Agentenvergleich (AC10) | `tests/assistenz-lernen/agentenvergleich-bpa06.test.ts`, ergänzend zum P06-Vergleich. Ein Skriptagent erledigt dieselben drei Berichte auf dem bisherigen Weg und mit Routinenlauf. Getrennt erfasst werden Einrichtung, Arbeit, Korrektur, Wiederholung, Fehlersuche und Prüfung. Simulation, tatsächliche Wirkung und (nicht gemessener) menschlicher Nutzen sind getrennt ausgewiesen; kein Sieger behauptet. |

### Nacharbeit 27: Laufbindung dauerhaft, Herkunft strukturiert, Prüfung vor der Wirkung

| Teil | Wirkung |
| --- | --- |
| Laufbindung ohne Verfall | Die Läufe einer Routine werden nicht mehr gekürzt. Eine einmal verwendete Laufkennung bleibt gebunden, solange die Routine besteht; eine alte Wiederholung legt nichts neu an. |
| Strukturierte Herkunft | Ein Auftrag aus einem Routinenlauf trägt `herkunft` (Eigentümer, Routine, Fassung, Lauf, Abdruck). Gesetzt wird sie nur vom Server (`legeAuftragAn`, vierter Parameter); die Tür `POST …/auftraege` reicht sie nicht durch. Ein verwaister Lauf wird ausschließlich über diese Herkunft wiedergefunden, nicht über den Wortlaut. |
| Prüfung vor der Wirkung | Bevor der Aktionskern einen Auftrag mit Routinenherkunft ausführt (`klara-ausfuehrung.ts`), prüft `routineSperre` den aktuellen Stand: gelöscht, pausiert, andere Fassung oder fremdes Konto ergibt 409 `herkunft_gesperrt`, und es geschieht nichts. Ohne angeschlossene Prüfung wird ein solcher Auftrag nicht ausgeführt (fail-closed). Während der Pause gibt auch die Wiederholung des Laufs keinen Auftrag heraus. Schon erstellte Ergebnisse bleiben. |

Gegenproben:
- `tests/assistenz-lernen/laufbindung-dienst.test.ts`: 205 Läufe, danach liefert die erste Kennung denselben Auftrag; verwaiste Reservierung; Widerspruch.
- `tests/assistenz-lernen/routine-lauf-mounted.test.tsx`: echte Fläche gegen den echten Server, Ausführen mit Ergebnislink sowie Pause am Server.
- `tests/assistenz-lernen/p06-routine-lauf.test.ts`: Vormachen → Routine → Lauf → Ausführung → Entwurf nachgelesen und geprüft; fremde Routine, alte Fassung, Token als Eingabe, Rolle ohne Anlagerecht, Außenschritt.
- `tests/assistenz-lernen/produktanschluss-p06.test.ts`: unverändert, Sollwert 201.

Grenzen:
- **Bedienfläche:** „Ausführen“ in „Meine Routinen“ besteht seit Nacharbeit 25 (`RoutineLauf.tsx`).
- **Außenschritt:** Einreichen bleibt bei der P06-Freigabe je Ausführung. Der Lauf hält davor an.
- **Hosts:** Word-Routinen laufen nicht über diesen Weg; dafür braucht es BPA-04. *(Seit Nacharbeit 41 über den integrierten Programmadapter angeschlossen, s. u.)*

### Nacharbeit 28: zwei Vorführungen im P06-Produktweg (AC02, BPA-S06)

Vorher war die Ableitung aus zwei Vorführungen (`entwerfeLernnotiz`) nur als Modul belegt. Jetzt
läuft sie im P06-Weg selbst, ohne zweiten Lernweg (`assistenz-lernen-vorfuehrungen.ts`):

| Teil | Wirkung |
| --- | --- |
| Rohfelder | Beim Anlegen eines Entwurfs (`POST /api/drafts`, Klarwerk-Web) schreibt der Server zusätzlich die gesetzten Felder mit Wert mit: Titel, Kernaussage, Art, Kategorie, Vertraulichkeit, Fachgebiet, Prüfer. Sie sind Rohdaten wie der Rohwert: nur im Speicher der Lernsitzung, entfernt bei Bestätigung und Abbruch (auch bei `lernnotiz_behalten`). |
| Vorführungen | Jedes `entwurf_anlegen` beginnt eine neue Vorführung. Ab zwei Vorführungen mit Rohfeldern entsteht in der Vorschau eine `ableitung`. Sie ist Teil des Stands; bestätigt wird genau sie. Mit einer Vorführung bleibt alles wie bisher. |
| Ableitung | Bereinigen (`bereinige`) → `entwerfeLernnotiz`. Titel und Kernaussage werden immer Eingaben (`titel`, `inhalt`). Prüfer werden Empfänger-Eingabe. Ihr Setzen ist folgenreich (`senden`), der Lauf hält dort an. Gleiche Ordnungsangaben werden Festwerte; Abweichendes wird Eingabe. Was nur in einer Vorführung vorkommt, wird Entscheidungspunkt. |
| Ändern vor Bestätigung | `PUT /api/me/vormachen/:id/korrektur` mit `{ ableitung: { art, … } }`. Erlaubt sind Schritt herausnehmen, als Entscheidung markieren, Festwert zur Eingabe machen und Eingabe umbenennen. In der Fläche gibt es „Schritt n herausnehmen“. Eine Korrektur der Beobachtungen setzt diese Änderungen zurück. |
| Routine und Lauf | Die Routine trägt nur `ableitung` (Eingaben und Schritte). `funktionAusRoutine` nimmt dann genau diese Schritte. Der Lauf prüft sie mit `planeLauf` wie bisher. `RoutineLauf.tsx` zeigt die weiteren Eingaben an. |

Gegenprobe `tests/assistenz-lernen/p06-zwei-vorfuehrungen.test.ts`, am echten Server:
- Zwei Berichte mit wechselnden Titeln, Kernaussagen und Prüfern; Art und Kategorie sind gleich, das Fachgebiet steht nur in der zweiten Vorführung. Die Vorschau enthält keinen Beispielwert und keinen Prüfer.
- F1: Mit dem Entscheidungspunkt bestätigt hält der Lauf dort an (409 `haelt_an`); es entsteht kein Auftrag.
- F2: Ist der Entscheidungspunkt herausgenommen, fehlt ohne Prüfer-Eingabe der Lauf (`eingabe_fehlt`). Mit Prüfer hält er am Prüferschritt als Außenwirkung an, mit dem Wert aus dem Lauf.
- F3: Ist auch der Prüferschritt herausgenommen, entsteht der Entwurf mit den Laufwerten über den Aktionskern; er wird nachgelesen und mit `pruefeEntwurf` geprüft. Danach wird ein Startdatum mit Zeitzone gesetzt; die Pause sperrt den nächsten Lauf.

Grenzen:
- **Empfänger:** Der Aktionskern legt Entwürfe ohne Prüfer an. Ein Lauf setzt also keine Empfänger und benachrichtigt niemanden; mit Prüferschritt hält er an.
- **Ordnungsangaben (geändert in Nacharbeit 31):** siehe unten. Sie stehen nicht mehr als Textzeile in der Kernaussage.

### Nacharbeit 32: Zeitpläne an die vorhandene Zeitsteuerung angeschlossen (AC05)

Zeitpläne lösen jetzt Läufe aus. Den Takt gibt die Zeitsteuerung, die der Server schon hat: `startTrashSweepScheduler` in `server.ts`. Derselbe Baustein taktet Papierkorb, Gedächtnis, Fähigkeitsaufträge und Lückenerkennung. Die Routinen bekommen einen eigenen Takt von einer Minute, wie die Lückenerkennung ihren eigenen hat. Ein zweiter Scheduler entsteht nicht.

| Teil | Wirkung |
| --- | --- |
| Fälligkeit (`assistenz-lernen-zeitplan.ts`) | Rein und ohne Uhr. **Sofort:** ein Lauf je Setzen. **Ab Datum:** ein Lauf, sobald die lokale Startzeit der Zone erreicht ist. **Wöchentlich:** der jüngste Termin nach Wochentag und Uhrzeit, frühestens ab dem Setzen und ab `ab`. Die Nachholregel `einmal_nachholen` holt nur den jüngsten versäumten Termin einmal nach. `auslassen` läuft nur innerhalb von zwei Takten nach dem Termin. **Sommerzeit:** Die übersprungene Stunde wird zur ersten gültigen Zeit danach (02:30 → 03:30). Bei der doppelten Stunde gilt das erste Auftreten. |
| Fälligkeitslauf (`assistenz-lernen-zeitsteuerung.ts`) | Für jede Routine mit Zeitplan gilt: pausiert heißt kein Lauf. Ein fälliger Termin wird über denselben Laufweg wie der Handlauf ausgeführt (`assistenz-lernen-lauf.ts`): `planeLauf`, Brücke, gebundener Auftrag. Die Terminkennung ist die Laufkennung; jeder Termin läuft also genau einmal, auch nach einem Neustart. Konto und Rolle werden JETZT gelesen: gesperrt, abgelaufen oder ohne Anlagerecht heißt kein Lauf. Ein abgelehnter Termin wird mit Grund vermerkt und nicht in jedem Takt neu versucht. Im Prüfprotokoll stehen nur Ereignis und Kennungen. |
| Zeitplan setzen | `PUT …/zeitplan` nimmt zusätzlich die `eingaben` der Person für fällige Läufe an. Zugangsdaten werden abgewiesen. Für die Aufträge entsteht ein eigenes Klara-Gespräch. Die Sicht der Routine nennt nur die Namen der Eingaben. Nach einer Pause werden versäumte Termine nicht nachgeholt; das Fortsetzen setzt `seit` neu. |

Gegenproben:
- `zeitplan-faelligkeit.test.ts`: Sommer- und Winterzeit (Berlin, New York), übersprungene und doppelte Stunde, Nachholregel, `seit` und `ab`, ab Datum, sofort.
- `zeitsteuerung-am-server.test.ts`: läuft am echten Server mit gestellter Zeit. Sofort: der Auftrag wird über den Aktionskern ausgeführt und der Bericht nachgelesen. Ab Datum, wöchentlich mit beiden Nachholregeln, Pause, Rolle ohne Anlagerecht, entfernter Zeitplan und Zugangsdaten als Eingabe.

Grenze (in Nacharbeit 33 ersetzt, s. u.): Damals legte der Fälligkeitslauf den Auftrag nur an; ausgeführt wurde er erst mit einem Klick der Person.

### Nacharbeit 33: fällige Läufe bis zur Wirkung, Zeitplan in der Fläche

| Teil | Wirkung |
| --- | --- |
| Ausführung | Nach dem Anlegen führt der Fälligkeitslauf den Auftrag über den vorhandenen Aktionskern aus (`KlaraAusfuehrung.fuehreAus`, Schritt `bericht-1`). Vor der Wirkung prüft `routineSperre` (`vorWirkung`) Pause, Löschung und Fassung. Dazu kommen die Grenze, die Rechte am Entwurfsweg und das Nachlesen. Danach prüft `pruefeEntwurf` den nachgelesenen Entwurf gegen den jetzt geprüften Plan. Ergebnis: `ausgefuehrt` mit Ergebniskennung, `abweichung` oder `nicht_ausgefuehrt` mit Grund. Folgenreiche Schritte erreichen die Ausführung nie: ihr Plan hält vorher an. |
| Laufsitzung | Hinter einem Takt steht kein Browser. Darum trägt der Lauf eine kurzlebige Sitzung der Person in derselben Sitzungsablage wie jede Anmeldung. Sie ist nur als Hash gespeichert und wird nie ausgegeben. Sie gilt zwei Minuten und wird nach dem Lauf sofort gelöscht (`build-app.ts`, `fuehreRoutinenauftragAus`). Jede Tür prüft sie wie jede Sitzung: Freigabe, Befristung und Rolle zum Zeitpunkt des Laufs. Es gibt keinen Umweg an den Wächtern vorbei und kein zusätzliches Recht. Die Person hat diese Ausführung mit der Bestätigung der Routine und dem Speichern des Zeitplans ausdrücklich beauftragt (G08). |
| Fläche | `RoutineZeitplan.tsx` unter „Ausführen“ in „Meine Routinen“: sofort einmal, einmal ab Datum (Ortszeit) oder jede Woche mit Wochentag, Uhrzeit und „Erst ab“. Dazu kommen Zeitzone (Vorgabe: die des Geräts) und Nachholregel. Gespeichert wird mit den Eingaben dieses Laufs. Der aktuelle Zeitplan steht im Klartext da und lässt sich entfernen. |

Gegenproben:
- `zeitsteuerung-am-server.test.ts`:
  - Z1: Der Takt allein erstellt und prüft den Bericht; ein späterer Klick legt nichts doppelt an.
  - Z2/Z3: führen jetzt ebenfalls aus.
  - Z6: Fehlt eine nötige Eingabe, wird der Lauf vor der Wirkung abgelehnt.
- `routine-lauf-mounted.test.tsx`:
  - L3: „Sofort einmal“ wird in der Fläche gespeichert; der Takt erstellt den Bericht; „Zeitplan entfernen“ wirkt.
  - L4: wöchentlich mit allen Angaben gespeichert.

### Nacharbeit 37: natürlicher Lernauftrag im Klara-Gespräch (AC01)

| Teil | Wirkung |
| --- | --- |
| Erkennen | Ein Satz im Klara-Eingabefeld, getippt oder gesprochen, der als Auftrag an die Assistenz beginnt („Verfolge …“, „Beobachte …“, „Lerne …“, „Schau mir zu …“, „Ich zeige dir …“), geht an den Lernstart statt an den Frageweg (`lib/lernauftrag.ts`). „Wie lerne ich …?“ bleibt eine Frage. Ein Lernauftrag braucht keine KI-Sendebereitschaft, denn er ruft kein Modell auf. |
| Lernbereich | Der vorhandene P06-Lernstart `POST /api/me/vormachen` nimmt zusätzlich `auftrag` an. Es gibt keine neue Route. `assistenz-lernen-lernauftrag.ts` bestimmt regelbasiert und ohne KI: **Anwendung** (genannt: Word, Klarwerk; sonst die Herkunft der Anfrage), **Vorgänge** (Bericht/Entwurf → anlegen und speichern; einreichen → zusätzlich „zur Prüfung einreichen“; Frage → Frage stellen; Word entsprechend) und **Zweck** (der Satz). |
| Rückfrage | Ohne erkennbaren Vorgang antwortet der Lernstart mit 422 `klaerung` und den Vorgangsbündeln der Anwendung. Die gewählte Option geht als ausdrückliche Angabe an denselben Lernstart. Nicht freigegebene Anwendungen (Excel, Outlook, Chrome …) werden benannt; es wird nichts beobachtet, auch nicht mit mitgeschickter Wahl. |
| Lernmodus | Gestartet wird über `VormachenDienst.starte`, also mit denselben Regeln wie über das Formular. Die Karte im Gespräch nennt den Bereich. Den Zustand mit sofortiger Pause zeigt die vorhandene Lernanzeige der Hülle (`VormachenAnzeige`). Mitgeschrieben wird nur bei sichtbarer Anzeige und nur für die gewählten Vorgänge. |

Gegenproben:
- `lernauftrag-am-server.test.ts`: Ableitung aus dem Satz, Abgrenzung von einer Frage, Start mit Bereich, Mitschreiben nur gewählter Vorgänge, Pause, Rückfrage mit Wahl, Excel und Satz ohne Lernabsicht ohne Sitzung.
- `lernauftrag-im-gespraech.test.tsx`: echtes Klara-Panel mit echter Hülle.
  - G1: Satz → Lernmodus mit Lernanzeige, Pause wirkt am Server.
  - G2: Rückfrage mit Option.
  - G3: Excel wird abgelehnt, keine Sitzung, keine Lernanzeige.

### Nacharbeit 38: genannte, unbekannte Anwendung wird geklärt (AC01/G09)

Die Herkunftsanwendung gilt nur noch, wenn der Satz keine Anwendung nennt. Gelesen wird, was nach einem Ortswort steht („in“, „im“, „bei“, „über“, „unter“) oder nach „mit“ plus Gattungswort („mit dem Programm …“). Füllwörter wie „der“ oder „meinem“ werden übersprungen.

| Angabe im Satz | Ergebnis |
| --- | --- |
| Word, MS/Microsoft Word | Host Word |
| Klarwerk, Klara, Browser | Host Klarwerk-Web |
| Excel, Outlook, Chrome … | abgewiesen (`anwendung_nicht_freigegeben`), keine Wahl |
| anderer großgeschriebener Name nach Ortswort (etwa „in LibreOffice“), ein Name nach Gattungswort oder widersprüchliche Angaben (Word und Klarwerk) | Rückfrage `anwendung_unklar` mit der Wahl „In Klarwerk“ / „In Word“; **keine Lernsitzung, bis die Person wählt** |
| keine Angabe | Herkunft der Anfrage |

Bewusst vorsichtig: Ein großgeschriebenes Wort nach „in“ (auch ein Ort wie „in Berlin“) führt zur Rückfrage statt zu einer stillen Annahme.

**Nacharbeit 39:** Die Erkennung hängt nicht mehr von der Schreibweise ab. Was direkt nach einem Ortswort steht („in libreoffice“, „in LIBREOFFICE“, „im browser“), gilt als Anwendungsangabe; jede unbekannte wird geklärt, unabhängig von der Herkunft (Klarwerk oder Word-Panel). Nach einem Begleitwort (Artikel, „diesem“, „meinem“ …) steht ein Gegenstand („in diesem Bericht“). Eine Anwendung ist es dort nur mit Gattungswort („in der app notizblock“). Vorsichtig bleibt auch hier: Ein unmittelbar nach „in/im/bei/über/unter“ stehendes gewöhnliches Wort („im Anschluss“, „unter Zeitdruck“) führt zur Rückfrage. **Nacharbeit 40:** Ein Begleitwort beweist keinen Gegenstand mehr. „in meinem LibreOffice“ und „in der libreoffice“ werden geklärt. Ob nach Orts- oder Begleitwort ein Gegenstand steht, entscheidet allein das Wort selbst: Nur erkennbare Arbeitsgegenstände (Bericht, Dokument, Entwurf, Tabelle, Datei, Abschnitt …, gebeugt oder als Wortende wie „Wochenbericht“) gelten nicht als Anwendung. Wörter, die auch Anwendungsnamen sind oder enden (Mail/Gmail, Kalender, Notizen, Aufgaben), stehen bewusst nicht auf dieser Liste und werden geklärt. Dafür fragt „im Bericht“ jetzt nicht mehr unnötig nach.

Gegenproben: `lernauftrag-am-server.test.ts` prüft Schreibweisen × Herkunft (Klarwerk, Word, keine) sowie den Lernstart aus Klarwerk und aus dem Word-Panel ohne Sitzung; `lernauftrag-im-gespraech.test.tsx` G5.

Gegenproben:
- `lernauftrag-am-server.test.ts`: LibreOffice aus Klarwerk heraus; keine Sitzung und kein Mitschreiben vor der Klärung; die Wahl startet genau den gewählten Bereich. Dazu `mit dem Programm Notizblock`, Word und Klarwerk zugleich, „im Browser“ gegen die Herkunft Word, „in MS Word“.
- `lernauftrag-im-gespraech.test.tsx` G4: im Klara-Panel erst die Rückfrage ohne Lernanzeige, nach der Wahl der Lernmodus.

### Nacharbeit 41: Word-Routinen über den integrierten Programmadapter (AC07, AC08, BPA-S06)

Bens Befund zu `32e10b9d`: Der Laufweg kannte nur Klarwerk-Web, Word-Routinen wurden abgewiesen, und der BPA-04-Programmadapter war nicht integriert.

**Integration BPA-04.** Die Dateien des Originalkandidaten `ac640eba` sind unverändert übernommen: `programmadapter.ts`, `routes/programmadapter-routes.ts`, Fähigkeitsübersicht in „Meine Assistenz“ (`ProgrammeUebersicht.tsx`, `api/programme.ts`, `texte/programme.ts`), Klara-Begleiter (`apps/desktop/klara-begleiter`), `docs/operations/klara/programmadapter.md` und die Gegenproben unter `tests/programmadapter/`. Ebenfalls übernommen ist die Zielprüfung im Word-Fenster vor den drei Einfügewegen (`taskpane.js`, `bpaZiel*`) samt Anpassung der Fenster-Prüfstände. Registriert ist alles in `build-app.ts` mit **einem** Siegel je Instanz. Der Routinenlauf nutzt dasselbe Siegel.

**Word-Routine — derselbe Laufweg, kein zweiter Kern:**

| Teil | Wirkung |
| --- | --- |
| Funktion (`assistenz-lernen-word.ts`) | Eine P06-Routine des Hosts Word mit „Markierten Text/Dokument als Entwurf übernehmen“ wird zu: Titel (Eingabe der Person), Kernaussage = **Markierung** (Eingabe, die nur der Host liefert), Speichern. „Formulierung anfordern“ ist ein Entscheidungspunkt; im Lauf wird kein Modell gerufen. Eine Frage an das Firmenwissen läuft nicht mit. |
| Bindung an Word | `PUT /api/me/vormachen/routinen/:id/host`: Die Person bindet die Routine ausdrücklich an **dieses** Word. Gespeichert werden Programm (`word-mac`/`word-web`) und Hostfassung (Office meldet etwa „Mac 16.0.…“). Nötig ist eine gültige gesiegelte Bindung aus `POST /api/klara/programme/verbinden`. Ohne Bindung läuft keine Word-Routine (`host_nicht_gebunden`). |
| Lauf | `POST /api/me/vormachen/routinen/:id/word-lauf` prüft in dieser Reihenfolge: Pause; Siegel und **aktuelle** Lage über `pruefeZielVorWirkung` (Konto, Programm, Klara-Sitzung, Dokument, Markierung, sonst 409 mit Grund und nächstem Schritt); die mitgeschickte Markierung gegen ihre gebundene Prüfsumme (dieselbe FNV-1a-Regel wie `bpaPruefsumme` im Fenster). Danach folgt **derselbe** `fuehreDurch` der Zeitsteuerung: Konto und Rolle zum Laufzeitpunkt, `planeLauf` (anderes Programm: abgelehnt; andere Hostfassung: Halt vor dem ersten Schritt, AC07; Zugangsdaten in der Markierung: abgelehnt, AC06; nur Beobachtungsrecht: 403, AC08), gebundener Auftrag genau einmal je Kennung, Aktionskern mit `routineSperre` vor der Wirkung, Nachlesen, `pruefeEntwurf`. |
| Zeitsteuerung (AC05) | Ein fälliger Word-Termin wird **nicht** im Hintergrund ausgeführt, denn hinter dem Takt steht kein Word und keine gebundene Markierung. Er steht an (`anstehend`, dieselbe Fälligkeits- und Nachholregel) und wird im Word-Fenster gezeigt. Startet die Person ihn dort, läuft er mit Titel und Gespräch aus dem Zeitplan genau einmal. Eine erfundene Terminkennung wird abgewiesen. |
| Wiederaufnahme (G12) | Dieselbe Kennung mit derselben Markierung liefert denselben Auftrag und Bericht. Mit anderer Markierung ist es ein Widerspruch: Ein Handlauf bleibt offen, ein Zeitplantermin wird nach Nacharbeit 35 ohne Wirkung abgeschlossen. |
| Word-Fenster | Block KW-ROUTINEN in `vormachen.js`, nicht Teil des gepinnten Panels. Mit Klara-Sitzung zeigt „Meine Routinen in Word“: An dieses Word binden; Titel und „Mit Markierung ausführen“; einen anstehenden Termin. Die Markierung wird unmittelbar vor der Wirkung neu gelesen, über den Leseweg und die Mitlese-Einstellung des Fensters. Ergebnis mit Link oder der Grund des Servers. |
| Klarwerk-Web | „Meine Routinen“ zeigt für Word-Routinen den Weg nach Word, die Bindung, Pause/Fortsetzen und den Zeitplan mit Titel. |

**Wirkung:** ein Entwurf in Klarwerk. Das Word-Dokument ändert der Lauf nicht; Einfügen in Word bleibt der bewusste Klick mit Zielprüfung (BPA-04).

Gegenproben (am echten Server, ohne laufendes Word):
- `tests/assistenz-lernen/word-routine-am-server.test.ts`:
  - W1: ganzer Weg mit Nachlesen, Wiederholung ohne zweiten Bericht, Widerspruch.
  - W2: Hostfassung, Programm, Dokument, Markierung, falscher Text, gefälschtes Siegel, Kontowechsel.
  - W3: Beobachtungsrolle.
  - W4: Zugangsdaten und Pause.
  - W5: Word-Termin aus der Zeitsteuerung.
  - W6: Prüfsumme gleich der des Fensters.
- `tests/assistenz-lernen/word-routinen-fenster.test.tsx`: `vormachen.js` unverändert in jsdom mit den echten `bpa*`-Funktionen aus `taskpane.js`.
  - F1: Binden und Ausführen per Klick.
  - F2: Markierung vor der Wirkung geändert, nichts entsteht.
  - F3: ohne Klara-Sitzung keine Abfrage.
- `funktionslauf-aktionskern.test.ts`: Die Brücke weist Finder weiter ab und übersetzt Word.
- `tests/programmadapter/*`: die BPA-04-Gegenproben des Originals.

Grenzen:
- **Kein realer Word-Host belegt.** Die reale Hostprobe (Word für Mac mit diesem Kandidaten, tatsächliche Office-Hostfassung) bleibt offen; `HOSTBELEGE` ist leer.
- **Panel-Pins:** `taskpane.js` hat sich geändert. Der SHA-256-Pin (`mega69-klara-waechter.test.ts`) und der Blob (`panelquelle.ts`, `schnitt-echt.test.ts` E2) sind Platzhalter, bis sie gemessen sind. Ein Hash-Werkzeug war in dieser Bahn nicht zugelassen.
- **API-Referenz:** `docs/architektur/http-api-referenz.md` liegt außerhalb der erlaubten Bereiche. Die BPA-04- und BPA-06-Routen sind dort nicht eingetragen; `tests/architektur-vertrag/http-api-referenz.test.ts` meldet das.
- **Dokumentübernahme:** Auch „ganzes Dokument übernehmen“ läuft als Markierung mit höchstens 2 000 Zeichen Inhalt (Entwurf des Aktionskerns). Längeres wird abgewiesen (`zu_lang`), nicht gekürzt.

### Nacharbeit 43: fällige Word-Termine an den freigegebenen Host, Dokumentumfang treu (AC02–AC05, AC08)

Ben zu `a7834c45`: Der Takt übersprang Word-Routinen, und „ganzes Dokument übernehmen“ wurde still durch die Markierung ersetzt.

| Teil | Wirkung |
| --- | --- |
| Umfang (`assistenz-lernen-word.ts`) | `word_auswahl_uebernehmen` hat die Eingabe `markierung`, `word_dokument_uebernehmen` die Eingabe `dokument`. Beide liefert allein der Host. Die Sicht `GET …/word-routinen` nennt `umfaenge`. |
| Bindung und Prüfung | Die Markierung ist gebunden als `auswahl`, das ganze Dokument als `fassung` des BPA-04-Ziels, beide mit derselben FNV-1a-Prüfsumme wie im Fenster. Der Server rechnet beide nach. Ändert sich das Dokument zwischen Bindung und Wirkung, ergibt das `fassung-geaendert`; fehlt der Dokumenttext, gibt es 400. `pruefeEntwurf` prüft, dass der Inhalt im nachgelesenen Entwurf steht. |
| Dokument über der Entwurfsgrenze | Über 2 000 Zeichen hält der Lauf vor der Wirkung an (`dokument_nicht_unterstuetzt`) und verweist auf die Übernahme von Hand. Gekürzt wird nicht. |
| Word-Fenster | `Word.run` liest `body.text` getrennt von der Markierung, nur mit „Mitlesen“. Ist das Dokument nicht lesbar, läuft die Dokumentroutine nicht; es gibt keinen Ersatz durch die Markierung. Die Schaltfläche heißt dann „Mit dem ganzen Dokument ausführen“. |
| Zeitsteuerung | Der Takt übergibt einen fälligen Word-Termin an den Host (`uebergabe`). Er protokolliert das einmal je Termin und Art (`bpa06.zeitplan.wartet`): `an_host_uebergeben` mit ausdrücklicher Freigabe, sonst `wartet_auf_start`. Pause bedeutet: keine Übergabe. Nachholregel und Laufkennung bleiben wie bisher. |
| Freigabe | Beim Binden wählt die Person ausdrücklich „Fällige Termine in diesem Dokument ohne Klick ausführen“ (`zeitplanImHost`, Vorgabe aus). Gespeichert werden dazu Programm, Hostfassung und Dokument. |
| Ohne Klick | Ein geöffnetes, gebundenes Word-Fenster holt einen übergebenen Termin beim nächsten Abruf (spätestens 60 s) ab. Es liest den bestätigten Umfang neu und ruft `word-lauf` mit `automatisch: true` auf. Der Server verlangt dafür die Freigabe, eine Zeitplankennung und genau das gebundene Programm und Dokument (sonst `nicht_freigegeben` bzw. `anderes-dokument`). Danach folgt derselbe Laufweg mit Rechten und Pause zum Laufzeitpunkt, Hostfassung, idempotenter Wiederaufnahme und Ergebnisprüfung. |

Gegenproben:
- `word-routine-am-server.test.ts` W7: Dokument mit zwei Abschnitten. Die Dokumentroutine übernimmt beide, die Auswahlroutine nur den markierten. Geprüft sind außerdem geändertes Dokument, falscher Text, fehlendes Dokument und Überlänge.
- `word-routine-am-server.test.ts` W8: Übergabe mit Freigabe, anderes Dokument, Handlauf als „automatisch“, Pause, Lauf ohne Klick genau einmal, identische Wiederaufnahme, Rechteentzug.
- `word-routine-am-server.test.ts` W5: ohne Freigabe nachvollziehbares Warten.
- `word-routinen-fenster.test.tsx` F4: Abholen ohne Klick nach Bindung mit Freigabe, ohne Freigabe nichts.
- `word-routinen-fenster.test.tsx` F5/F6: ganzes Dokument bzw. nicht lesbar.

Grenzen:
- **Kein realer Word-Host.** Ob `documentContextId` über Sitzungen gleich bleibt, ist nicht belegt. Ändert sie sich, wartet der Termin, bis die Person neu bindet.
- **Fenster muss offen sein.** Ohne geöffnetes, gebundenes Word-Fenster wartet ein Termin (bei `auslassen` nur innerhalb der Toleranz).
- **Markierung bei Läufen ohne Klick:** Eine Auswahlroutine nimmt die aktuelle Markierung im gebundenen Dokument; ohne Markierung wartet sie auf den nächsten Abruf.

### EQF-06-Aufnahme (16.10.2026): Korrektur in eigenen Worten, neue Fassung, sichtbare Nachholregel

Der Auftrag führt die zentral aufgenommenen EQF-06-Kriterien als K11–K20. Umgesetzt sind die Lücken im vorhandenen Lern- und Routinenweg. Es gibt keinen neuen Dienst und keine KI.

| Teil | Wirkung |
| --- | --- |
| Deutung (`assistenz-lernen-korrektur.ts`, K13) | Die Deutung ist regelbasiert. **Einmaligkeit:** „gilt nur heute“, „nur dieses Mal“, „ausnahmsweise“ → der Schritt entfällt. **Regel:** „gehört immer dazu“, „jedes Mal“ → aus einem Entscheidungspunkt wird ein fester Schritt; sein Wert wird je Lauf erfragt, nie als Beispielwert übernommen. **Entscheidungspunkt:** „hier entscheide ich selbst“ → die Person entscheidet an dieser Stelle selbst. Verneinte, doppeldeutige oder bedeutungslose Sätze lösen eine Rückfrage (422 `klaerung`) mit den drei Bedeutungen als Wahl aus. Sätze mit Zugangsdaten werden abgewiesen. |
| Quelle | Jede Korrektur trägt Bedeutung, Wortlaut, Zeitpunkt, Schritt und Nummer (`KorrekturQuelle`). Sie erscheint in der Vorschau unter „Deine Korrekturen“, an der Routine (`ableitung.korrekturen`) und im Fassungsverlauf. Im Prüfprotokoll stehen Fassung und Art, nie der Wortlaut. |
| Vorlage | Ein Entscheidungspunkt aus „nicht in jeder Vorführung“ merkt sich die beobachtete Art und das Ziel, **ohne Wert**. Unklare Handlungen und geschützte Felder bekommen keine Vorlage und werden nie fest. |
| Neue Fassung (K20) | `POST /api/me/vormachen/routinen/:id/korrektur` mit `{ fassung, ableitung: { nr, satz, bedeutung? } }` erzeugt Fassung n+1 mit Verlauf (`versionen`). Eine veraltete Fassung ergibt 409 `stand_veraltet`. Angelegte Läufe bleiben an ihre Fassung gebunden; `routineSperre` lässt sie ausdrücklich nicht mehr wirken („inzwischen geändert“). Ein offener Zeitplanlauf wird mit diesem Grund abgeschlossen. Korrigierbar sind nur Routinen mit Ableitung; andere werden neu vorgemacht (409 `nicht_korrigierbar`). |
| Bedienung | `KorrekturSatzFeld` steht in der Vorschau (Ableitung) und in „Meine Routinen“, dort samt Anzeige der Fassung und des Verlaufs. |
| Nachholregel (K15) | Bei einem Startdatum in der Vergangenheit zeigt `RoutineZeitplan` vor dem Speichern: Der Lauf wird einmal nachgeholt, beim nächsten Takt, und nicht wiederholt. |

Gegenprobe: `tests/assistenz-lernen/korrektur-und-fassung.test.ts`.
- D1: Deutung.
- K1: Vorschau mit Regel, Rückfrage, gewählter Bedeutung, Quelle und ohne Beispielwert.
- K2: Fassung 2, gebundener alter Lauf ohne Wirkung, veraltete Korrektur abgewiesen, neuer Lauf nach Fassung 2.

Offene Voraussetzungen, getrennt von der Umsetzung (Stand dieser Aufnahme; K11, K12, K15, K16 und K18 bearbeitet Nacharbeit 51 unten):
- **K12:** Ein Bericht aus mindestens zwei Quellen als ein wiederholbarer Lauf. Dafür braucht es eine Quellenaktion bzw. den Funktionsvertrag EQF-05.
- **K15:** Ein Auslöser „bei Ereignis“. Dafür muss die Ereignisquelle festgelegt werden.
- **K16:** Die Modi „selbstständig“ und „gemeinsam schrittweise“ neben „Ergebnis zur Prüfung“.
- **K18:** Ort und Name „Meine Funktionen“ statt „Meine Routinen“.
- **K11/K20/K7/K8:** Eine echte Hostprobe auf diesem Mac. Laut Ben fehlt dafür ein Bedienwerkzeug am Prüfhost.

### Nacharbeit 51: Umfang in der Anzeige, Quellenweg, „bei Ereignis“, drei Übergabearten, „Meine Funktionen“

Bens Befunde zu `45127fef`. Alles läuft über die vorhandenen Wege: P06-Beobachtung, Funktionsvertrag, Aktionskern, Zeitsteuerung und Routinenablage. Es gibt keinen zweiten Scheduler, keine zweite Registry und keine KI.

| Kriterium | Umsetzung |
| --- | --- |
| K11 (EQF-06-K01) | Die dauerhafte Lernanzeige (`VormachenAnzeige.tsx`) nennt neben Zustand und Pause den zulässigen Umfang: „Nur ‹Anwendung›: ‹Vorgänge›. Sonst nichts.“ Der Umfang kommt aus der offenen Lernsitzung und steht auch während der Pause da. |
| K12 (EQF-06-K02) | Ein neuer P06-Vorgang heißt `quelle_lesen`. Der Server beobachtet das Lesen eines Wissensobjekts über den vorhandenen Leseweg (`GET /api/kos/:id`, nur 2xx). Rohdaten der Lernsitzung sind nur Kennung und Fassung, nie der Inhalt. Ein unmittelbar wiederholtes Lesen derselben Quelle zählt nicht neu. Quellen werden vor dem Anlegen gelesen. In der Ableitung wird jede Quelle der Schritt „Quelle n“ mit der Kennung als Wert: Ist sie in allen Vorführungen gleich, ist sie fest, sonst eine Eingabe. Die Vorschau nennt die Originalereignisse je Vorführung mit Fassung („Gelesene Quellen“). Die Brücke gibt die Kennungen als `quellen` an den Planschritt `entwurf_erstellen` des Aktionskerns (höchstens 5). Der Aktionskern liest jede Quelle im Lauf **jetzt** mit den Rechten der Person. Er übernimmt Titel, aktuelle Fassung, Ort (`/wissen/<id>`) und Kernaussage in den Körper und liest sie nach. Ist eine Quelle nicht sichtbar, fehlt das Recht oder ist sie vertraulich eingestuft, entsteht nichts (`nichtGefunden`, `recht`, `schutzstufe`). `pruefeEntwurf` prüft den Bezug jeder Quelle im Ergebnis. Der natürliche Lernauftrag nimmt `quelle_lesen` dazu, wenn „Quelle“ oder „Wissensobjekt“ genannt ist. |
| K15 (EQF-06-K05) | Die Zeitplanart `bei_ereignis` nutzt einen festen Ereigniskatalog: `wissen_angelegt` (`ko.created`) und `wissen_ueberarbeitet` (`ko.revised`), jeweils nur Ereignisse, die die Person selbst ausgelöst hat. In Worten (`beschreibung`) wird nur ein eindeutiges Ereignis übernommen. Sonst folgt eine gezielte Rückfrage (422 `klaerung` mit dem Katalog), und die gewählte Kennung steht danach im Zeitplan der Routine. Der Takt der vorhandenen Zeitsteuerung fragt das Prüfprotokoll nach eigenen Ereignissen seit dem Setzen bzw. Fortsetzen. Je Ereignis entsteht genau ein Lauf über denselben Laufweg (Kennung `zeitplan-e-<Sequenz>`), je Takt einer. Word-Routinen haben diese Art nicht. |
| K16 (EQF-06-K06) | Die Übergabeart steht in der Routine (`ausfuehrung`, `PUT /api/me/vormachen/routinen/:id/ausfuehrung`) und im Funktionsvertrag (`PersoenlicheFunktion.ausfuehrung`). **Selbstständig** (Vorgabe, bisheriges Verhalten) hat einen Planschritt, der ohne weitere Rückfrage läuft. **Ergebnis zur Prüfung** hat im Aktionskern zusätzlich den Planschritt „Ergebnis öffnen“ (`oeffnen`, `ausSchritt: 1`). Der Server bestätigt Ziel und Rechte, und der Auftrag ist erst abgeschlossen, wenn die Person das Ergebnis geöffnet hat. Die Zeitsteuerung führt nur den Anlageschritt aus. **Gemeinsam schrittweise** hat dieselben zwei Schritte. Ausgeführt wird jeder erst auf den Klick der Person. Es gibt keinen Zeitplan (409 `schrittweise`) und keinen Hostlauf, und auch ein Termin der Zeitsteuerung wird abgelehnt. Die Art gehört zum Laufabdruck. Fachliche Regeln (Anlagerecht, Pause, Fassung, Halt an Außenwirkung) gelten in jeder Art. Bedienung: Auswahl „So übernimmt deine Assistenz“ mit Erklärung in `RoutineLauf.tsx`. |
| K18 (EQF-06-K08) | Der Einstieg heißt **„Meine Funktionen“**. Es gibt eine eigene Zeile im Profil und den Direktweg `/profil?bereich=funktionen`. Die Detailkarte zeigt dieselbe Routinenablage (`VormachenFlaeche nurFunktionen`) ohne Lernstart und ohne Löschen; jede Funktion ist dort direkt ausführbar. Die Überschrift in der Vormachen-Fläche und im Word-Fenster heißt ebenso. |

Gegenproben:
- `tests/assistenz-lernen/quellen-uebergabe-ereignis.test.ts`:
  - Q1/Q2: Quellenweg mit Folgelauf und nicht mehr sichtbarer Quelle.
  - E1: Ereignisauslöser mit Rückfrage, eigenem und fremdem Ereignis.
  - U1–U3: drei Übergabearten am Aktionskern.
- `tests/assistenz-lernen/routine-lauf-mounted.test.tsx`:
  - M1/M2: „Meine Funktionen“ und Direktweg.
  - M3/M4: Bedienweg der Übergabearten.
  - M5: Ereignis mit Rückfrage in der Fläche.
- `tests/assistenz-lernen/lernauftrag-im-gespraech.test.tsx` G1: Umfang in der Anzeige, auch pausiert.

Grenzen:
- **Hostprobe:** Die reale Hostprobe auf diesem Mac fehlt weiterhin. Das ist eine Werkzeugvoraussetzung am Prüfhost.
- **Quellen nur aus Klarwerk:** Quellen sind Wissensobjekte in Klarwerk. Fremde Programme (Excel, Outlook) haben keinen Quellenweg.
- **Ereignisse:** Der Ereigniskatalog umfasst nur die beiden eigenen Wissensereignisse; weitere Ereignisse (fremde Änderungen, Kalender, Postfach) sind nicht festgelegt. (Die frühere Lesegrenze von 50 Ereignissen je Takt ist mit Nacharbeit 52 entfallen.)
- **Schutzstufe:** siehe Nacharbeit 52. Die frühere Übernahme nicht eingestufter Quellen ist entfallen.

### Nacharbeit 52: Schutzklasse der Quellen, Ereignisse vollständig

Ben zu `c52b0e61`:

| Befund | Umsetzung |
| --- | --- |
| G05/EQF-06-K02: Quellen ohne oder mit unbekannter Schutzklasse wurden übernommen | `quellSchutz` (`klara-ausfuehrung.ts`) verlangt eine bekannte, zweckzulässige Klasse: ausdrücklich `intern`, am Wissensobjekt gespeichert (`confidentialityProvenance: "ko"`). `vertraulich`/`streng_vertraulich` → `schutzstufe`. Fehlend, `null`, unbekannter Wert oder unbekannte Herkunft → `schutzstufeUngeklaert`: die bestehende geschützte Klärung (Entscheidung 16, `sichtbarkeit.ts`): geschützt, bis jemand einstuft. In beiden Fällen entsteht kein Bericht, der Schritt steht mit Grund als fehlgeschlagen da. |
| EQF-06-K05/K09: nur die jüngsten 50 Ereignisse gelesen | `naechstesEreignis` liest das Prüfprotokoll seitenweise (50 je Seite) von jung nach alt bis zum dauerhaften Fortschritt `zeitplanLauf.ereignisseBis`. Gelaufen wird das älteste nicht erledigte Ereignis, je Takt eines. Über jede erledigte Folge (gelaufen, abgelehnt, in einer Pause geschehen) rückt der Fortschritt vor und wird an der Routine gespeichert (`vermerkeEreignisStand`). Gezählt wird ab `ereignisseAb` (Setzen des Zeitplans), das beim Fortsetzen nicht vorrückt. Pausen werden Abschnitte (`pausen`), deren Ereignisse ausdrücklich nicht laufen; ein Rückstand von vor der Pause bleibt erhalten. Laufkennung, Wiederaufnahme, Rechteprüfung zum Laufzeitpunkt und Idempotenz sind unverändert. |

Gegenproben in `tests/assistenz-lernen/quellen-uebergabe-ereignis.test.ts`:
- S1: Schutzklasse rein (frei, Klärung, gesperrt).
- Q3: nie eingestufte Quelle am Server ergibt keinen Bericht; Positivkontrolle ist Q1 mit ausdrücklich `intern`.
- E2: 51 Ereignisse vor dem ersten Takt, Neustart der App nach 20 Läufen, 4 neue Ereignisse währenddessen. Alle 55 laufen genau einmal in Reihenfolge, das älteste zuerst.
- E3: Pause mit Rückstand und Rechteentzug (abgelehnt, kehrt nach Wiederherstellung nicht wieder).

Grenze: Ein Takt liest so viele Seiten, wie der tatsächliche Rückstand hinter dem Fortschritt lang ist.
- **„Schrittweise“:** Dass ein Klick von einem Menschen kommt, kann der Server nicht unterscheiden. Er stellt nur sicher, dass Zeitsteuerung und Hostlauf diese Art nicht in einem Zug ausführen.

### Nacharbeit 46: Versuchsperre je Routine und Termin

Ben zu `4c1b9c55`: Das Word-Fenster merkte sich Läufe ohne Klick nur unter der Terminkennung. Wochentermine verschiedener Routinen heißen gleich (`zeitplan-w-<Datum>`). Nach dem ersten Lauf startete die zweite fällige Routine deshalb nicht mehr. Die Sperre und ihre Freigabe für einen erneuten Versuch hängen jetzt an Routine **und** Termin. Mehrere zugleich fällige Routinen laufen nacheinander, je genau einmal; die Idempotenz am Server gilt unverändert je Routine und Laufkennung.

Gegenprobe: `word-routinen-fenster.test.tsx` F7. Zwei freigegebene Routinen haben denselben Wochentermin. Beide laufen ohne Klick, je ein Bericht, und weitere Abrufe starten nichts erneut.

Nacharbeit 47: Die erste Fassung stellte die Uhr von Fenster und Server; an `faafbec3` entstand dabei kein Bericht. F7 braucht jetzt keine gestellte Uhr mehr. Der Wochentermin liegt eine Minute vor jetzt; fällig wird er, indem der Zeitplan in der Routinenablage als vor acht Tagen gesetzt hinterlegt wird. Geprüft wird zuerst „nicht fällig“, dann „beide fällig mit derselben Kennung und Übergabe automatisch“, dann die beiden Läufe und Berichte.

### Nacharbeit 45: Word-Inhalt als Volltext-Körper

Rot an `e6a6bb41` (W7, F5): Der vorhandene Entwurfsweg macht jede Kernaussage kanonisch (`kernaussageAusKlartext`: Leerraum gefaltet, höchstens 500 Zeichen, an einer Satzgrenze geschnitten). Aus „A↵B“ wurde „A B“, die Ergebnisprüfung meldete eine Abweichung. Längere Dokumente wären gekürzt worden.

- **Aktionskern (`klara-auftrag.ts`, additiv):** Ein Planschritt `entwurf_erstellen` kann einen Volltext `koerper` tragen (höchstens 20 000 Zeichen). `klara-ausfuehrung.ts` legt ihn wie den Word-Ganzdokumentweg als Körper (`bodyHtml`, je Zeile ein Absatz, maskiert) über denselben Entwurfsweg an. Der Schritt gilt erst als gespeichert, wenn der ganze Text im nachgelesenen Körper steht. Ohne `koerper` ändert sich nichts.
- **Brücke:** Bei Word wird der Host-Inhalt (Markierung bzw. ganzes Dokument) zum Körper. Die Kernaussage ist dessen kanonischer erster Satzteil, nach derselben Regel wie im Entwurfsweg. `pruefeEntwurf` prüft den Inhalt im Körper.
- **Grenze:** Ein Dokumentlauf hält erst über 20 000 Zeichen vor der Wirkung an (`dokument_nicht_unterstuetzt`). Gekürzt wird nicht.

Gegenproben:
- W7: Die Auswahl landet nur mit Abschnitt A im Körper. Ein Dokument über 2 000 Zeichen kommt vollständig an. Über 20 000 Zeichen hält der Lauf an.
- F5 unverändert.

### Nacharbeit 35: Wiederaufnahme unvollständiger Zeitplanläufe (AC05/G12)

Ein angelegter Auftrag gilt nicht mehr als erledigter Termin. Jeder Laufeintrag trägt `abgeschlossenAm`. Gesetzt wird es erst, wenn das Ergebnis nachgelesen und geprüft ist oder der Lauf endgültig scheitert. Dazu zählt der Eintrag seine `versuche`.

- **Wiederaufnahme zuerst:** Ein offener Zeitplanlauf wird vor jedem neuen Termin wieder aufgenommen, auch Tage nach seinem Termin. Er behält dieselbe Laufkennung, denselben Auftrag, sein Gespräch und seine Fassung.
- **Jedes Mal neu geprüft:** Konto und Rolle zum Laufzeitpunkt, Pause (pausiert heißt kein Fortsetzen), Fassung (über `planeLauf`), vor der Wirkung `routineSperre`. Ein endgültig abgelehnter offener Lauf wird abgeschlossen; nichts wirkt.
- **Ungeklärt** (Wirkung bekannt, Nachlesen offen): Der nächste Takt ruft denselben Schritt erneut auf. Der Aktionskern liest dann nur nach.
- **Vorübergehend gescheitert** (`server`, `anmeldung`): Nacharbeit 36 korrigiert den Weg aus Runde 35. Ein zweiter Schrittschlüssel liegt außerhalb der Auftragsgrenze, denn je Planschritt ist genau ein Schritt erlaubt. Deshalb beginnt **derselbe** Schritt `bericht-1` neu. Das geht nur über die Serverausführung der Zeitsteuerung (`wiederholeVoruebergehend` bzw. `zusatz.wiederholen` in `klara-auftrag.ts`), nur nach `server`/`anmeldung`, nie nach einem Abbruch oder einer Korrektur der Grenze. Es gibt höchstens fünf Versuche. Ohne diesen Wunsch bleibt „gescheitert“ im Aktionskern endgültig, auch beim Klick der Person. Die Entwurfsanlage ist je Auftrag und Planschritt idempotent (Vorgangsschlüssel), es entsteht also kein zweiter Bericht.
- **Grenze:** Wurden die Zeitplaneingaben inzwischen geändert, passt der Abdruck des offenen Laufs nicht mehr (`lauf_widerspricht`). Dann wird der offene Lauf abgeschlossen, ohne mit fremden Eingaben zu wirken.

Gegenproben (`zeitsteuerung-am-server.test.ts`):
- Z7: Abbruch nach der Auftragsanlage, Pause, Wiederaufnahme Tage später mit genau einem Auftrag und genau einem Bericht.
- Z8: vorübergehender Serverfehler; derselbe Schritt `bericht-1` beginnt neu und wird gespeichert. Es entsteht ein Bericht, kein zweiter Schritt.
- Z10: Ein Klick der Person führt einen gescheiterten Schritt nicht erneut aus; der Aktionskern bleibt ohne Zeitsteuerung unverändert.
- Z9: Rolle vor der Wiederaufnahme entzogen; der Lauf wird abgelehnt und es entsteht kein Bericht.

### Nacharbeit 31: Auswahl strukturiert setzen, sonst anhalten

| Teil | Wirkung |
| --- | --- |
| Aktionskern | Ein Planschritt `entwurf_erstellen` kann `felder` tragen (`type`, `category`, `confidentiality`, `domain`; `klara-auftrag.ts`, andere Namen 400). `klara-ausfuehrung.ts` übergibt sie dem vorhandenen Entwurfsweg und liest jedes Feld nach. Weicht ein Wert ab, steht der Schritt als `fehlgeschlagen` (`nichtNachgelesen`) da. |
| Brücke | Die Auswahlen Art, Kategorie, Vertraulichkeit und Fachgebiet werden zu `felder`. Jede andere Auswahl hält VOR dem Anlegen an (`auswahl_nicht_unterstuetzt`, 409 am Laufweg). Freitext-Eingaben außer Titel und Kernaussage bleiben Zeilen im Inhalt. |
| Ergebnisprüfung | `pruefeEntwurf` vergleicht eine Auswahl mit ihrem Feld. Steht der Wert nur im Text, ist das eine Abweichung. |

Gegenproben:
- `funktionslauf-aktionskern.test.ts`: Kategorie steht im Feld; „Region“ hält an; die Prüfung erkennt einen Wert, der nur im Text steht.
- `p06-zwei-vorfuehrungen.test.ts` F3: Art und Kategorie stehen in ihren Feldern.
- **AC05:** Das Startdatum wird gespeichert, aber nicht ausgeführt. Dafür muss die Koordination die vorhandene Zeitsteuerung zuordnen.

## Anschluss an den Aktionskern (Nacharbeit 18, Kandidat `0fc11895`)

Der Aktionskern (Klara 05, `klara-auftrag.ts`, `klara-ausfuehrung.ts`, erweitert um Verlauf und
Rücknahme) ist über den Hauptstand in diesen Zweig gekommen. P06 (`vormachen*`) und BPA-04
(`programmadapter*`) fehlen weiterhin.

`services/app/src/assistenz-lernen-auftrag.ts` verbindet BPA-06 jetzt mit diesem vorhandenen Weg:

| Teil | Wirkung |
| --- | --- |
| `alsKlaraAuftrag(funktion, plan)` | Übersetzt einen **vollständig freigegebenen** Laufplan einer bestätigten Funktion mit Host `klarwerk_web` in die Eingabe eines gebundenen Klara-Auftrags: ein Planschritt `entwurf_erstellen`, Titel aus dem Titelfeld des Laufs, Inhalt aus Kernaussage/Inhalt, weitere gesetzte Werte als „Feld: Wert“. Abgewiesen werden: haltender oder abgelehnter Plan, andere Fassung, anderes Zielobjekt, anderer Host (Word/Finder/Chrome), folgenreiche Wirkung, Lauf ohne Speichern, fehlender Titel, Überlänge. |
| Vorhandene Routen | `POST /api/me/klara/gespraeche/:id/auftraege` legt den Auftrag mit Grenze an; `POST …/schritte/:schluessel/ausfuehrung` führt ihn **am Server** über `/api/drafts` mit den Rechten der Person aus, mit Vorgangsschlüssel, Nachlesen, Protokoll und Rücknahme. Kein zweiter Ausführungs-, Rechte- oder Speicherweg. |
| `pruefeEntwurf(plan, entwurf)` | Ergebnisprüfung am nachgelesenen Entwurf: Titel genau, jeder weitere gesetzte Wert im Inhalt. |

Gegenprobe am echten Server: `tests/assistenz-lernen/funktionslauf-aktionskern.test.ts`.
- Zwei Vorführungen, Bestätigung, Lauf mit neuen Eingaben. Der Bericht entsteht als Entwurf, wird nachgelesen und geprüft; keine Beispielwerte aus den Vorführungen.
- Eine Wiederholung legt keinen zweiten Entwurf an.
- Rolle `viewer`: Der Entwurfsweg lehnt mit `recht` ab, es entsteht kein Bericht.
- Hostwechsel: Halt vor dem Aktionskern, kein Auftrag.
- Word-Funktion und Außenwirkung: nicht über diese Brücke.

Grenzen dieses Anschlusses:
- **Nur Klarwerk-Web.** Der Bericht ist ein Klarwerk-Entwurf, kein Word-Dokument.
- **`quelle` steht auf „getippt“**, weil der Aktionskern nur getippt oder gesprochen kennt. Der Wortlaut nennt Funktion, Fassung und Lauf.
- **Rechte:** Die Rechteangabe für `planeLauf` stellt der Aufrufer. Wirksam geprüft wird das Recht vom Entwurfsweg selbst.
- **Kein produktiver Aufrufer ohne P06.** Wer den Lauf anstößt, also P06-Routinenablage und -Bedienfläche oder die Zeitsteuerung, fehlt weiterhin. Die Brücke ist heute nur über die Gegenprobe aufgerufen.
- **Rote Gegenprobe bleibt rot.** `tests/assistenz-lernen/produktanschluss-p06.test.ts` bleibt bis zur Zusammenführung von P06 rot (404).

**Stand Nacharbeit 4 (Kandidat `b1cb8f73`):** Bens Befund weist die Zusammenführung der drei
Kandidaten ausdrücklich der Koordination zu. Sie ist in diesem Zweig noch nicht geschehen: Die
Dateien `vormachen*.ts`, `klara-auftrag.ts` und `programmadapter.ts` fehlen, und `d680a62f` ist kein
Vorfahr dieses Stands. Die Anbindung folgt, sobald die Zusammenführung vorliegt.
