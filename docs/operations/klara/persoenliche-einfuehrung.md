# Persönliche Einführung · Klara16

Profil → Klara → Persönliche Einführung und Übungen ist für neue und bestehende Konten freiwillig
aufrufbar. Das vorhandene Einrichtungsband verlinkt denselben Bereich. Die vorhandene Namens- und
Avatarauswahl bleibt maßgeblich; ein statischer Zauberhut kennzeichnet nur die Einrichtung.

Der Fortschritt liegt im **bestehenden Assistenzprofil** (`assistenz_profile.data.einfuehrung`),
nicht in einem weiteren Tutorial- oder Sitzungsspeicher. Er enthält nur Schritt, Begleitungswahl,
IANA-Zeitzone und Abschlusskennzeichen. Normale Profiländerungen erhalten ihn; derselbe bestehende
Fassungsvergleich verhindert stilles Überschreiben. Unterbrechen speichert den zuletzt gewählten
Schritt. Ein Speicherfehler lässt Auswahl und Eingaben stehen. „Neu laden“ liest nur den
Profilstand neu, bevor die Person die erhaltene Auswahl erneut speichern kann. Schließen einer
normalen Arbeit oder Weitergehen erfordert keine Einführung und keine zusätzliche Zustimmung.

Die vier Schritte sind:

1. Vorhandenes Formular „Name und Erscheinung“ zeigen, ohne einen zweiten Avatarbestand.
2. Kurze/ausführliche Erklärung und persönliche IANA-Zeitzone wählen; optionale Hinweise über die
   vorhandene Unterstützung einstellen. Systemwarnungen bleiben außerhalb abschaltbarer Hinweise.
3. Eine Leseübung im **vorhandenen `TutorialBereich`**: eine heutige zugängliche Wissensquelle über
   die bestehende Bibliothekssuche wählen, Frage zur Unabhängigkeit von Prüfstatus und persönlicher
   Darstellung beantworten. Die Rückmeldung liest die Quelle erneut; bei Quelllöschung oder
   fehlenden Rechten wird keine alte Rückmeldung angezeigt und die Trefferliste neu gelesen.
4. Ergebnis, gespeicherte Zeitzone, Wiedereinstieg und tatsächliche Text-/Office-Wege finden.

Die Übung schreibt kein Wissensobjekt, erteilt keine Fachfreigabe und sendet nichts an ein Modell.
Ohne zugängliche Quelle kann sie übersprungen werden. Ihre Reaktion ist anhand des heutigen
Quellenstands deterministisch; eine erfundene Wissensquelle oder Modellantwort wird nicht benötigt.
Die Begleitungswahl verkürzt nur Erklärtexte. Der Fachstatus der Quelle und die geforderte Warnung
bleiben gleich. Der bestehende allgemeine Tutorialrahmen/sein Register gehören weiter zu Paket I;
Klara16 liefert nur eigene Inhalte und eine bestehende Bereichsinstanz, keine zweite Engine.

## Zeitzone und Sommerzeit

Neue persönliche Erinnerungen übernehmen die gespeicherte Profilzone als sichtbare Vorgabe.
Die Gerätezone bleibt als ausdrückliche Auswahl verfügbar. Bestehende Erinnerungen behalten ihre
explizit gespeicherte Zone und Sommerzeitregel. Der eigene Kalender zeigt die Profilzone und
verwendet sie für neue Uhrzeitangaben. Beim Bearbeiten behält ein vorhandener Termin seine eigene
Zone. `datetime-local` wird mit **dem vorhandenen reinen Löser
`services/app/src/klara-erinnerung-zeit.ts`** gelesen, nicht weiter implizit mit der Gerätezone.

Die zwei UI-Konvertierungen sind nur Adapter dieses Lösers. Fehlende oder doppelte Ortszeiten im
internen Kalender werden sichtbar angehalten; die Eingabe bleibt stehen. Eine eindeutige Uhrzeit
oder die vorhandene ausdrückliche Sommerzeitwahl einer Erinnerung ist erforderlich. Ganztägige
Einträge behalten ihr Kalenderdatum ohne UTC-Verschiebung. Setup schreibt keine Kalenderzeilen
und erzeugt keinen Scheduler oder externen Kalenderanschluss.

## Tatsächliche Hostgrenzen

Die Anleitung nennt die vorhandenen Word-Add-in-Einstellungen (Zahnrad, Sprache, Text mitlesen,
Absatzblick) und verweist für native Word-Menüs auf die eigene Bedienung der Person. Sie behauptet
keine automatische Menülerkennung. Ein echter Word-/Mac-/Office-Bediennachweis für Klara16 liegt
hier nicht vor. Die headless Chromium-Probe ist ein Webhostnachweis mit Agentenbedienung, kein
VoiceOver-, Hardwaretastatur- oder Endanwendernachweis.

Diktieren füllt das Textfeld; Senden, Auftrag und Ausführung bleiben eigene vorhandene Schritte.
Text bleibt verfügbar. Die konkrete externe Audioempfängeridentität ist im vorhandenen Browserweg
nicht festgestellt. Sie wird nicht als Anbietername geraten. Diese ursprüngliche Grenze von
AW15-K03 bleibt offen, ebenso die wirkliche Office-Kontrollbindung/Hostprobe von AW15-K04.

## Pilotablauf vor echter Nutzung

Dies ist die vorab definierte Messung, kein bereits durchgeführter Pilot:

| Arbeitsweg | Schritte und Anwendungswechsel | Erfolg und Fortsetzung |
| --- | --- | --- |
| Eigene Vorliebe | Profil öffnen → Klara → Gedächtnis → anlegen/korrigieren/löschen → neu öffnen | Herkunft/Frist und bestätigter Serverstand; keine zweite Eingabe nach unklarem Ausgang ohne Readback |
| Quelle verstehen | Einführung starten → Begleitung wählen → Bibliotheksquelle suchen → Verständnisfrage → Rückmeldung | heutige Quelle/Fassung/Prüfstatus, keine echte Wissensänderung; Wiedereinstieg im gespeicherten Einrichtungsschritt |
| Persönliche Zeit | Zone wählen → Kalender öffnen → Uhrzeit kontrollieren → explizite Aktion bestätigen | sichtbare Zone, richtiger UTC-Zeitpunkt, einzelne gespeicherte Zone erhalten; DST-Klärung hält nur diesen Eingabeweg |
| Office-Hilfe | Klarwerk → tatsächliches Word-Add-in → Zahnrad → Textweg bzw. freiwilliges Diktat | nur erreichbare Kontrolle; bei unzugänglichem Host wird der Teil als nicht gemessen vermerkt |

Je Lauf werden Start/Ende, Zahl der Schritte, Wechsel zwischen Anwendungen, doppelte Eingaben,
Fehler und jeweilige Wiederaufnahme, Hilfebedarf sowie zusätzliche Prüf- und spätere Pflegezeit
festgehalten. Zeiten werden gemessen, nicht als Rechtsfrist oder bereits erzielte Verbesserung
vorgegeben. Fiktive Agentenläufe, echter Endanwenderpilot, externe Dienste und reale Modelle stehen
in getrennten Ergebnisfeldern. Es gibt keine Verpflichtung zu einer persönlichen Peterprobe.

Die unabhängige Prüfung, Integration, Veröffentlichung und tatsächliche Liveprüfung übernimmt
Führung im vorhandenen Lieferweg. Technisch umgesetzt, lokal geprüft, unabhängig beurteilt und
live sind verschiedene Zustände.
