# Desktop-Schnellsuche · J

Aufnahme `aufnahme:20260922:gesamt-desktop-schnellsuche`, Revision 2, R-1650.
Die Umsetzung ergänzt den bestehenden Klara Begleiter und seine Suchfläche. Sie erzeugt
keine zweite App, keinen Suchindex, keine Tabelle und keine Bildschirmbeobachtung.

## Bedienung und vorhandene Wege

- Im Menü des Begleiters „Suche öffnen“ wählen. Die vorhandene Klarwerk-Befehlspalette
  erscheint im selben schwebenden Gesprächsfenster. Sie verwendet dieselbe Rollennavigation
  und `GET /api/library/search`. Auswahl und Eingabe des Gesprächs bleiben erhalten.
- Ein Wissens-, Seiten- oder Frageziel öffnet sich im regulären Klarwerk-Fenster des Browsers.
  Der native Host akzeptiert ausschließlich relative Ziele desselben eingestellten Servers.
  Die Zielseite prüft die Anmeldung und Rechte ihres eigenen Browserkontexts wie bisher.
- Escape schließt die Palette; das Gespräch bleibt offen. Native Schließen-/Einklappen-Wege
  erhalten die bestehende Vorgangsprüfung und schließen zusätzlich die Palette.
- In Persönliche Einstellungen → Klara → Tastenkürzel die neue Aktion „Suche öffnen“
  bewusst belegen. Ab Werk ist sie unbelegt. Die vorhandene Kontoablage, Konfliktprüfung,
  Aufnahme, Entfernen und Rücksetzen gelten unverändert. Alle anderen Aktionen bleiben intern.
- Nur diese bewusst gesetzte Suchbelegung registriert der verbundene Mac-Begleiter systemweit
  über `RegisterEventHotKey`; kein Monitor liest fremde Eingaben. ⌘K bleibt die interne Palette,
  ⌃⌥ bleibt für VoiceOver frei. Das Klara-Menü zeigt Registrierung oder Fehlschlag mit Statuscode.
  Fremde Belegungen können die Registrierung verhindern; es gibt keine Freiverfügbarkeitszusage.
- Der vorhandene 30-Sekunden-Sitzungsabgleich und das Öffnen des Menüs lesen die Belegung erneut.
  Jede Auslösung prüft sie vor dem Öffnen frisch: ein inzwischen entferntes/geändertes Kürzel
  öffnet nichts mehr. Auf eine neue Belegung kann der Host erst nach dem nächsten Abgleich hören.
  Abmeldung, Navigation, Verbindungsfehler und Beenden lösen die Registrierung.
- Der bewusst aufrufbare URL `klara-begleiter://suche` öffnet ebenfalls diese Fläche, auch beim
  regulären Appstart. Er nimmt weder Suchtext noch Ziel, Konto oder zusätzliche Parameter an.
  Er kann in einem selbst eingerichteten macOS-Kurzbefehl verwendet werden; es wird keiner angelegt.

## Erhalt und Quellenwidersprüche

Der zentrale Originalvertrag hat als erstes Kriterium nur „---“. Der zugeordnete vollständige
Originalwortlaut in `desktop-schnellsuche.json` nennt ausdrücklich eine Tastenkombination und ein
über jeder Anwendung überlagerndes Klarwerk-Suchfeld. Dieser Wortlaut ist das Umsetzungsziel.
Die Empfehlungen vom 05.09.2026 („später“) sind historische Priorisierung, kein heutiger Abschluss.

B's Wahl „Option 1“ für die bisherigen Klara-Kürzel bleibt erhalten: kein allgemeiner Wechsel ihrer
Geltung, kein automatisches Control-Option-K. Der heutige J-Auftrag ergänzt ausschließlich die
bewusst belegbare Suche. B's Fenster-, Setup-, Diktat-, Stopp- und Gesprächswege bleiben bestehen.
Die ältere Entscheidungsvorlage vom 12.10.2026 bleibt als datierter Bestand stehen.

Die TaskAPI lieferte keinen separaten unveränderlichen Quellenkörper. Maßgeblich erhalten sind
Vollvertrag mit zwei History-Einträgen, source_id/Locator und das konkret gelieferte lokale
Quellenpaket; nicht aufgelöste Inhalte gelten nicht als gelesen. Versions-, Host- und Livebelege
werden in der revisionsgebundenen J-Übergabe getrennt geführt.

## Gezielte Prüfung und Einbau

Neue Proben: `tests/desktop-schnellsuche/` (echter nativer Abfragetext gegen echte Serverrouten,
Swift-Konflikt-/DE-Tastenentscheidung, Chromium-Nutzerweg) und die zwei J-Fälle in
`tests/klara-office/begleiter-seite-am-server.test.tsx`. Die vorhandenen Kürzel-/Rollenprüfungen
sichern die minimal betroffenen gemeinsamen Stellen. Transportgegenproben, InMemory-Bestand,
Browser und native Bedienung sind getrennte Nachweisarten.

Die Führung integriert den festen Commit, lässt ihn unabhängig prüfen und veröffentlicht regulär
Web und den daraus gebauten Begleiter. Native Versionsnummer und Produktversion bleiben hier
unverändert. Für das Bündel `scripts/klara-office/begleiter-bauen.sh` mit exakter Commitkennung
verwenden; keine eigene Installation aus dieser Arbeitsbahn.

Vor Originalgesamtabschluss fehlen tatsächliche native Proben der ausgelieferten Fassung:
Suchaufruf über anderer App/Space/Vollbild, DE/EN-Layout, Konfliktfehlschlag, Wechsel/Entfernen/
Abmeldung, VoiceOver und Fokus, Fensterbedienung samt laufenden Stopps. Build, Swift-Objektprobe,
Web-/Serverprobe und Chromium sind dafür kein Ersatz. Installation, unabhängige Prüfung,
Liveprobe und zentraler Abschluss liegen bei der Führung.
