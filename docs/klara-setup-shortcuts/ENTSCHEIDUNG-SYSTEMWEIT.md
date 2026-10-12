# Entscheidungsvorlage · Klara-Kürzel nur innerhalb Klarwerks oder zusätzlich systemweit

Für: Peter Kohnert (Product Owner) · Stand 12.10.2026 · Grundlage [`BESTAND.md`](./BESTAND.md)
**Status: offen — keine Entscheidung getroffen, kein bestätigter Produktumfang.**

## Frage

Soll ein Klara-Kürzel (mindestens „Klara öffnen“, A01) auch wirken, wenn Klarwerk nicht das aktive
Fenster ist — etwa in Word, Mail oder dem Finder?

## Befund

- **Web-App (H01):** Ein Browser-Tab empfängt Tasten nur, solange er aktiv ist. Systemweit ist dort
  technisch ausgeschlossen.
- **Chrome-Erweiterung (H02):** Chrome kennt „globale“ Erweiterungskürzel, aber nur für
  Strg+Umschalt+0–9 und nur bei laufendem Chrome; außerdem öffnet die Erweiterung die
  Seitenleiste (A08), nicht die persönliche Assistenz (A01). Kein geeigneter Weg.
- **Word-Add-in (H03):** wirkt nur in Word; kein systemweiter Weg.
- **„KLARWERK App.app“ (H04):** ein Bash-Starter ohne eigenes Fenster und ohne Ereignisschleife.
  Er kann kein Kürzel registrieren.
- **„Klara Begleiter“ (C01, Kandidat):** einziger nativer Mac-Host. Er registriert bereits ein
  systemweites Kürzel (Control-Option-K „Figur wiederfinden“) über `RegisterEventHotKey` (Carbon).
  Dieser Weg braucht **keine** Bedienungshilfen-Freigabe und kein Mitlesen aller Tasten. Der
  Begleiter ist nicht im Hauptstand, nur ad hoc signiert, nicht notarisiert, und sein lokales
  Abnahmeprotokoll ist leer.

## Optionen

| | A · nur innerhalb Klarwerks | B · zusätzlich systemweit über den Mac-Begleiter |
| --- | --- | --- |
| Wirkung | in der Web-App, solange ihr Fenster aktiv ist | zusätzlich in jeder Mac-App, solange der Begleiter läuft |
| Voraussetzung | AA-02 bis AA-04 | C01 im Hauptstand und mit Hostabnahme; danach eigener Auftrag |
| Zusätzliche Arbeit | keine über AA-02–AA-04 hinaus | Kürzelstand aus dem Konto an den Begleiter übertragen; bei jeder Änderung alte Registrierung lösen (`UnregisterEventHotKey`) und neue setzen; Fehler der Registrierung anzeigen; „Klara öffnen“ auf den vorhandenen Begleiter-Eintrag „Gespräch öffnen“ abbilden; Hostabnahme am Mac mit DE/EN-Tastatur und VoiceOver |
| Berechtigungen | keine | keine Bedienungshilfen-Freigabe nötig; Verteilung an andere Macs erst mit Signatur und Notarisierung |
| Konfliktgrenzen | Browser- und Systemkürzel gehen vor; prüfbar ist nur die eigene Liste | Registrierung kann scheitern, wenn eine andere App dieselbe Kombination belegt hat — erkennbar ist nur dieser Fehlschlag, nicht jedes fremde Kürzel. Control-Option-… liegt im VoiceOver-Bereich (VO = ⌃⌥); das vorhandene Control-Option-K des Kandidaten ist vor einer Übernahme gegen die Apple-VoiceOver-Referenz der Quelle zu prüfen |
| Plattform | jeder Browser, jedes Betriebssystem | nur macOS auf Apple Silicon (Begleiter-Umfang) |
| Aufwand (grob) | in AA-02–AA-04 enthalten | ein zusätzlicher mittlerer Auftrag nach Abnahme von C01 |

## Empfehlung

**Jetzt A**, wie in der Arbeitsannahme des Auftrags. B als **eigenen** Folgeauftrag erst
beauftragen, wenn der Mac-Begleiter (C01) regulär integriert und am Mac abgenommen ist. Die
Kürzelablage aus AA-03 ist so angelegt (Konto, physische Taste plus Modifikatoren), dass B sie ohne
Umbau lesen kann.

Bis zu einer Entscheidung für B nennt die Oberfläche als Geltungsbereich ausschließlich „In
Klarwerk, solange das Fenster aktiv ist“ und verspricht keine systemweite Wirkung.

## Bitte um Entscheidung

1. A bestätigen (nur innerhalb Klarwerks) — ja / nein.
2. B als Folgeauftrag nach Abnahme des Mac-Begleiters vormerken — ja / nein / später.
3. Bereichsname im Setup: „Klara“ (Wunsch) trotz neutraler Assistenzbenennung seit
   `assistenz-name-avatar` — siehe Integrationsplan, Abschnitt 1.
4. Standardbelegung für „Klara öffnen“: unbelegt ausliefern (Vorschlag) oder Control+Command+K
   nach Konfliktprüfung — Control+Command+K ist kein zertifiziert freies Kürzel.
