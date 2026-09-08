# Klara im Browser — laden und prüfen

Chrome-Erweiterung 0.2.0. Klara steht als **Seitenleiste neben der Webseite**: die Seite bleibt
sichtbar und bedienbar, während der Entwurf daneben entsteht. Benötigt Chrome 120 oder neuer
(die Seitenleiste selbst gibt es ab Chrome 114).

## In drei Schritten

**1 · Laden.** `chrome://extensions` öffnen → oben rechts **Entwicklermodus** einschalten →
**Entpackte Erweiterung laden** → diesen Ordner `extensions/klara-browser` wählen.
War die Erweiterung schon geladen, genügt **Aktualisieren** (das Kreispfeil-Symbol auf ihrer Kachel).

**2 · Öffnen.** Eine normale Webseite (`http` oder `https`) öffnen und die Leiste auf einem der
beiden Wege holen:

- auf das Klara-Symbol in der Chrome-Leiste klicken, oder `Alt+Shift+K` drücken;
- Text markieren → Rechtsklick → **In Klarwerk übernehmen**.

Die Leiste erscheint rechts neben der Seite. Sie bleibt offen, auch wenn du den Tab wechselst,
und zeigt weiter die Quelle, aus der die Auswahl stammt — wechselst du den Tab, sagt sie das
ausdrücklich, statt die Herkunft stillschweigend zu überschreiben.

**3 · Prüfen.** In der Leiste bei `https://app.klarwerk.ai` anmelden. Dann zeigt die Vorschau
Seitentitel, Quelle, Erfassungszeit und den übernommenen Originaltext. Titel und Kontext lassen
sich ändern, die Vertraulichkeit wählen; nach dem Häkchen speichert
**Als ungeprüften Entwurf sichern**, und **In Klarwerk öffnen** führt zum Entwurf.

Zum Vergleichen der Gestaltung: Leiste, die Web-App und Klara in Word nebeneinander stellen —
Farben, Schrift, Abstände und Begriffe stammen aus denselben Klarwerk-Token
(`apps/web/src/styles/themes.css`); jede Farbe in `panel.css` trägt ihre Herkunft im Kommentar,
und `tests/klara-browser/seitenleiste.test.ts` rechnet sie nach.

## Was diese Fassung tut — und was nicht

Übernommen wird **markierter Text** (CHR-03) in der Seitenleiste (CHR-02), in Klarwerk-Gestaltung
(CHR-01), auf Deutsch und Englisch. Die Sprache stellst du oben in der Leiste um.

Noch **nicht** enthalten und in eigenen Aufträgen unterwegs: ganzen Artikel bzw. ganze Seite wählen,
Bilder und Struktur übernehmen, Einfügen aus der Zwischenablage sowie der große
Weiterbearbeiten-Weg (CHR-04 bis CHR-08). Was die Leiste nicht erfassen kann, behauptet sie nicht.

Gespeichert wird **nur auf Knopfdruck**. Bis zur Bestätigung liegt die Auswahl flüchtig in der
Browsersitzung; Browserneustart, Neuladen der Erweiterung oder Abmelden löschen sie. Es gibt keine
automatische Speicherung und keinen KI-Aufruf. Die Erweiterung spricht ausschließlich mit
`https://app.klarwerk.ai` und liest die Zwischenablage nicht.
