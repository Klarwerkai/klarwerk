# Klara-Mac-Kandidat · 20.10.2026

Version 0.1.2 integriert erhaltene Arbeit aus UI-MIN 74cd8d154, Fenster 90314201 und
Quit 61ce2c7e mit dem aktuellen Host einschließlich Browserkarte und „In anderen Programmen“.
Ein eigener Abhängigkeits-Commit erhält den gemeinsamen Word-Kontext aus 8fcd735fe.
Es gibt weiterhin einen Gesprächs-, Figuren-, Anmelde- und Office-Kern.

## Bedienung

- Rot oder ⌘W schließt die Fläche. Bei laufenden Vorgängen bleiben deren Stopps sichtbar,
  bis die Webfläche genau die aktuelle Schließanfrage mit keinem laufenden Vorgang bestätigt.
- Gelb oder ⌘M klappt ein. Vor Anmeldung und ohne Webverbindung zeigt der Host einen nativen
  Öffnen-Einstieg statt einer verkleinerten Anmeldeseite. Er lässt sich ziehen und per Pfeiltasten
  bewegen; Umschalt vergrößert den Schritt.
- Native Titelleiste verschiebt das Gespräch; Randziehen verändert die Größe. Größe und Lage
  bleiben auf der sichtbaren Bildschirmfläche. Die Mindestgröße beträgt 320 × 420 Punkte.
- „Klara beenden“ und ⌘Q beenden die App. Bewusstes Wiederöffnen erfolgt durch App-Aufruf,
  Menü oder den unterstützten internen Klarwerk-Shortcut. Normale Kontextwechsel öffnen sie nicht.
- ⌘, führt in den bestehenden zentralen Klara-Einstellungsbereich. Im aktiven Klarwerk-Kontext
  wirken die dort gespeicherten internen Kürzel. Es wird kein systemweites Control-Option-K
  registriert; diese Kombination bleibt insbesondere für VoiceOver frei.

## Vorhandene Erweiterungspunkte

Die Browserkarte und das Fenster „In anderen Programmen“ bleiben erhalten. Nach der eigenen,
expliziten Finder-Dateiaufnahme kann der Server optional `ocrUrl` zurückgeben. Nur
`/erfassen?weg=datei&finder=<objektId>` für genau das soeben übernommene Objekt wird gegen den
konfigurierten Server aufgelöst. Absolute/fremde URLs, zusätzliche Parameter und Fragmente werden
abgewiesen. Alte Antworten ohne das Feld funktionieren weiter. Die Brücke enthält keine Tokens,
keine zweite Dateiauswahl und keinen neuen Aufnahmeweg. Den fachlichen Capture-Anschluss liefert C.

## Einbau durch die Führung

1. Separaten Office-Bestands-Commit, dann B-Shell-/UI-Commit mit dem heutigen Hauptstand zusammenführen.
   OCR-Brücke zusammen mit C integrieren; fehlendes `ocrUrl` ist abwärtskompatibel.
2. Die gezielten Begleiter-/UI-/Shortcut-Prüfungen gegen den zusammengeführten Kandidaten ausführen;
   abschließende unabhängige Prüfung dieses Kandidaten einholen. Die vorbereitete Kriterienmatrix
   im B-Paket enthält alle 64 Originalkriterien und die tatsächlichen Nachweisgrenzen.
3. Webbundle über den vorhandenen Veröffentlichungsweg bereitstellen. Native App aus genau diesem
   Stand mit `KLARWERK_SERVER=https://app.klarwerk.ai` und exaktem Commit als
   `KLARA_BEGLEITER_BAU` über `scripts/klara-office/begleiter-bauen.sh` bauen.
4. Danach `scripts/klara-office/begleiter-installieren.sh` nutzen. Das Skript prüft eine Stufe vor
   dem Austausch, beendet regulär ausschließlich den exakten installierten Pfad und sichert die
   bisherige App unter `~/Library/Application Support/Klarwerk/Klara-Sicherungen/`. Eine laufende
   andere Prüffassung führt zum Abbruch; kein Kill und kein Doppelstart. Vorhandene WebKit-Daten bleiben.
5. Live: Version/Ursprung prüfen; öffnen → kleiner ziehen → verschieben → einklappen → öffnen →
   schließen → darunter synthetischen Text bearbeiten → bewusst öffnen → Beenden → Prozessende.
   Mit regulärer eigener Sitzung Kontextwechsel, Entwurf, Stopp, Quellen und Setup-Neuladen nachweisen.
   Word-/Chrome-Word-Web, physische DE/EN-Layouts, VoiceOver und echtes Audio getrennt protokollieren.

Rückweg: neue App regulär beenden und die gesicherte vorige App an denselben Installationspfad
zurücklegen. Web-/Adapterfassung ebenfalls über den vorhandenen Veröffentlichungsweg zurücknehmen.
Keine manuellen Produktionsphasen oder fertigen Auftragszustände setzen.

## Prüfgrenzen

Lokaler Bau, native Bedienprobe und Chromium-Prüfungen sind keine Veröffentlichung und keine
menschliche Gesamtabnahme. Der aktuelle B-Nachweis verwendet synthetische Inhalte. Keine
Microsoft-Anmeldung, Mikrofonfreigabe, Spracherkennungsfreigabe oder VoiceOver-Abnahme wird erfunden.
Die reguläre App-/Web-/Office-Gesamtkombination braucht nach dem Einbau ihre tatsächliche Liveprobe.
