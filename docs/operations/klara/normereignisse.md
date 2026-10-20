# Persönliche Normereignisse

Der enge Ereignisvertrag verwendet den vorhandenen persönlichen Fristenbestand
(`klara_fristen.data.normereignisse`), seinen Versionsvergleich, Quellschutz und
regulären Datenbankbackup. Er legt keinen Normenkatalog, Scheduler oder zweiten
Aufgabenverlauf an. Die Auswahl und die Geschichte gehören dem aktuellen Konto.

Auf **Mein Kalender → Normbekanntmachungen und fachliche Ablösung** wählt die Person
1–20 heute lesbare Wissensobjekte und bestätigt ausdrücklich ihr Verarbeitungsrecht
für die begrenzten Bekanntmachungen. Vorschau liest nur. Erst **Ereignisbelege
erfassen** speichert die erkannten Ereignisse. Dieser erste Anschluss ist eine
bewusste persönliche Erfassung; er aktiviert keinen Quellenwatcher.

Gelesen werden ausschließlich kurze Kernaussagen vorhandener Wissensobjekte:
höchstens 4.000 Zeichen insgesamt und 1.000 Zeichen je Bekanntmachungszeile. Eine
Zeile nennt ausdrücklich beispielsweise `Norm N-17 v2`, `Ankündigung am
2026-11-01` und `Geltung: Werk A`. Unterstützt sind gesonderte deutsche Angaben zu
Ankündigung, Veröffentlichung, Inkrafttreten und Übergangsfrist sowie ISO- und
deutsche numerische Daten. URLs, Anhänge und vollständige Normtexte werden nicht
beschafft oder als solche verarbeitet. Zu große, mehrdeutige oder nicht
unterstützte Bekanntmachungen werden als ungeprüft ausgewiesen. Eine Längenprüfung
ersetzt keine Bezugs- oder Verarbeitungslizenz.

Jeder Beleg hält Originalkennung, Quellfassung, Zeichenpositionen und begrenzten
Wortlaut getrennt für Norm, Ereignis und Geltung. Fehlende, geplante, negierte oder
widersprüchliche Daten bleiben offen. Ein anderer Termin derselben Quelle wird
nicht automatisch maßgeblich: Der ältere Beleg bleibt in der Geschichte erhalten.
Bei einem Widerspruch sperrt der Fachweg und verlangt Klärung. **Konflikt fachlich
klären** erlaubt einem Konto mit aktuellem `ko.validate`, für jede widersprüchliche
Ereignisart genau einen heute eindeutigen belegten Termin samt Geltungsbereich
begründet zu wählen. Freie Ersatzdaten oder vom Browser behauptete Entscheidende
und Zeitpunkte sind unzulässig. Wenn kein vollständiger eindeutiger Beleg vorliegt,
ist zuerst eine neue begrenzte Bekanntmachung zu erfassen.

Die Entscheidung hält die tatsächliche Person, Serverzeit, Begründung, ausgewählten
Ereigniskennungen und den strukturierten widersprüchlichen Sachstand fest. Sie
entfernt oder korrigiert keinen ursprünglichen Beleg. Gleiche Kopien erhalten die
Auswahl; neue gegensätzliche Fakten oder der Wegfall aktueller gewählter Belege
öffnen die Klärung erneut. Frühere Entscheidungen bleiben als historisch sichtbar.
Eine andere Auswahl braucht eine neue ausdrückliche Entscheidung. Quellen,
Fachrolle, Space und persönlicher Versionsvergleich gelten gemeinsam beim echten
Schreiben im vorhandenen Fristenbestand. Eine identische Wiederholung liest nur
die aktuelle Originalentscheidung nach.

Konfliktklärung ist noch keine fachliche Annahme einer Anleitung. Die nachfolgende
gesonderte Fachannahme bindet die konkrete aktuelle Klärungskennung zusätzlich zu
ihren tatsächlichen Anleitungsfassungen und Freigabebelegen.

Gleiche Norm/Ausgabe und dasselbe Sachereignis behalten dieselben Kennungen. Eine
Kopie ergänzt nur ihren Quellenbeleg; ein tatsächlicher neuer Zustand ergänzt
dieselbe Geschichte. Betroffenheit wird ausschließlich durch heute lesbare,
kanonisch gespeicherte Zuordnung `Norm N-17` begründet. Titelähnlichkeit allein
belegt keine Abhängigkeit. Die Erfassung verändert weder Anleitungstext noch
Freigabestatus. Historische Auszüge bleiben hinter den heutigen Quellenrechten.
GET verändert den Bestand nicht. Nicht prüfbare fachliche Annahmebelege werden
als ungeprüft ausgewiesen, nicht als niemals erfolgte Annahme.

## Vorhandenen Prüfauftrag verknüpfen

Der bewusste Sessioncaller verwendet den bestehenden G-Auftragsport. Zunächst
beauftragt die Person im vorhandenen Klara-Weg eine persönliche Aufgabe aus ihrer
wirklichen gespeicherten Originalnotiz. Die explizite geschriebene Variante des
Ports führt `notizQuelle: {id, fassung, weg: "geschrieben"}`; ohne diesen Weg
verlangt G weiterhin eine echte Gesprächsnotiz mit Originalherkunft.

**Prüfauftrag am Original** zeigt geeignete bereits beauftragte Ein-Schritt-Pläne
des aktuellen eigenen Gesprächs. Die gebundene Originalnotiz muss Norm/Ausgabe,
Ereignis und Geltung als genaue Belege in derselben Zeile enthalten. Die Person
wählt den vorhandenen Auftrag bewusst. Dabei wird nur seine Originalreferenz
gespeichert, noch keine Aufgabe ausgeführt. Danach führt die Oberfläche genau den
ursprünglichen G-Schritt unter der tatsächlichen eigenen Sitzung aus oder liest
ihn erneut. Das bestehende G-Journal hält Stop, unklaren Ausgang und Ergebnis.

Eine Normgeschichte speichert nur Gesprächs-/Auftrags-/Schrittkennung. Kopie,
Reload und Wiederholung verwenden denselben ursprünglichen Schritt. Ein gelöschtes
Original, eine geänderte Notiz oder ein beendeter Auftrag rechtfertigen keinen
Ersatzauftrag. Fehlender Ergebnisreadback ist kein Nachweis der Nichtanlage. Die
UI liest die tatsächliche Aufgabe zusätzlich; ein entferntes Ergebnis bleibt als
entfernt sichtbar. Die private Originalnotiz wird nicht nachträglich als von einer
Person geschriebene Gesprächsnachricht ausgegeben.

Dieser Caller erzeugt keinen G-Auftrag, keine menschliche Beauftragung und keine
Laufsitzung im Hintergrund. Der automatische D-Quellenwatch → Prüfaufgabe braucht
noch die konkrete eigene D-Auftrags-/Fassungs-/Lauf-/Stopbindung an den vorhandenen
gemeinsamen Routinenport. Der H-Vormachkontext darf dafür nicht umgedeutet werden.

## Fachliche Ablösung

Ein berechtigtes Konto mit heutigem `ko.validate` wählt die konkrete früher
freigegebene Anleitungsfassung und einen heute freigegebenen Nachfolger aus der
gespeicherten Normzuordnung. Der Server prüft wirkliche Freigabe-Auditbelege,
Originalfassungen, aktuelle Metadaten und Quellen sowie den persönlichen
Fristenstand im selben bedingten Schreibweg. Person und Zeitpunkt stammen aus
dem tatsächlichen Konto und der Serverzeit. Browserbehauptungen dazu werden
abgewiesen. Noch nicht verarbeitete neue Bekanntmachungsfassungen sperren die
Annahme bis zur erneuten Erfassung.

Die Entscheidung dokumentiert Geltung, Begründung, alte/neue Originalfassung und
ihre tatsächlichen Freigabebelege. Die Links lesen genau diese Fassungen auch nach
einer späteren Überarbeitung; der heutige Leseschutz bleibt wirksam. Der Vorgang
ändert die Anleitung selbst nicht. Veröffentlichung, vergangener Termin,
Kalenderfälligkeit, Erinnerung und Modellvorschlag sind keine fachliche Annahme.

Technische Prüfungen, unabhängige Annahme, reguläre Veröffentlichung und ein
tatsächlicher Host-/Provider-/Office-/Modellbetrieb werden getrennt belegt. Die
persönliche manuelle Teilfunktion erfüllt nicht bereits den vollständigen
S10-Watchablauf, alle acht Normkriterien oder die 98 ursprünglichen D-Kriterien.
