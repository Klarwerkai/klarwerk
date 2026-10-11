# Klara-Begleiter · Browserbrücke (BPA-01, AC10)

Die Verbindung zwischen der Chrome-Erweiterung „Klara im Browser" und dem Klara-Begleiter auf
**diesem Mac**. Kanal ist Chrome **Native Messaging**: Chrome startet die Brücke je Verbindung und
spricht mit ihr nur über stdin/stdout. Es gibt keinen offenen Port und keinen lokalen Webserver.

| Schritt | Wer | Was |
| --- | --- | --- |
| Einrichten | Mensch, einmalig | `./installieren.sh <Erweiterungskennung>` — übersetzt die Brücke, legt Programm, Kennung und Host-Manifest im eigenen Benutzerordner ab |
| Verbinden | Klick in der Leiste | „Mit Begleiter verbinden": Chrome fragt das optionale Recht `nativeMessaging` an; die Erweiterung schickt `hallo` mit Einmalwert und Nutzerkennung |
| Ausweisen | Brücke | antwortet mit demselben Einmalwert, ihrer Fassung und der macOS-Fassung; die Leiste zeigt beides |
| Übergeben | Erweiterung → Brücke | genau die gebundene Karte (Seite, Markierung, Tabelle, Fassung, Folge); Quittung mit Folge und Fassung |
| Widerrufen | Leiste, Abmelden, Kontowechsel | `widerrufen` und Trennen; die Brücke verwirft die abgelegte Karte und endet |

## Sicherheit

- Chrome startet die Brücke nur für die Erweiterung, deren Kennung im Host-Manifest steht.
- Die Brücke prüft die Herkunft zusätzlich gegen die beim Einrichten hinterlegte Kennung und
  beendet sich ohne Lesen, wenn sie fehlt oder nicht passt.
- Eine Karte wird nur für den Nutzer aus `hallo` angenommen und nur für dieses macOS-Konto lesbar
  abgelegt (`~/Library/Application Support/Klarwerk/Begleiter/browserkontext.json`, 0600).
- Anmeldung, Schlüssel und Seiteninhalte jenseits der Karte erreichen die Brücke nie.

## Verhältnis zu den Begleiter-Kandidaten

Die Brücke ist ein eigenes Ziel in diesem Ordner und berührt keine Datei der beiden
Begleiter-Kandidaten (BPA-04, Maskottchen). Der Begleiter zeigt die übergebene Karte, indem er
`browserkontext.json` liest. Das Lesen in der Begleiter-Oberfläche gehört zu dessen Integration;
die Zuordnung steht in `docs/operations/klara/browser-kontextkarten.md`.

## Stand

Geschrieben, aber in dieser Bahn **weder übersetzt noch auf einem Mac ausgeführt**: Diese Bahn
startet keine Übersetzung, Installation oder Dienste. Der reale Lauf ist offen; was er
festhalten muss, steht in der Dokumentation.
