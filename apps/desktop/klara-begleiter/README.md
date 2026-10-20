# Klara Begleiter (macOS, Apple Silicon)

Stand 20.10.2026: Version 0.1.2 führt den erhaltenen gemeinsamen Host, die native
Fensterkorrektur aus 74cd8d154 und den ausdrücklichen Beenden-Button aus 61ce2c7e zusammen.
Gespräch: native Schließen-/Minimieren-/Größenbedienung; Beenden: Button oder ⌘Q.
Vor Anmeldung oder bei fehlender Verbindung bleibt beim Einklappen ein nativer Öffnen-Einstieg.
Der gemeinsame Web-/Office-/Figurenkern bleibt erhalten.

Der reguläre Ursprung ist `https://app.klarwerk.ai`, derselbe wie bei der Browserbrücke.
Es wird kein systemweites Kürzel automatisch registriert: Peters Option 1 und VoiceOver
bleiben erhalten. Interne Kürzel stehen im bestehenden Klara-Setup; Wiederöffnen ist über
Menü oder erneuten App-Aufruf möglich. Details und Einbau:
`docs/operations/klara-office/mac-kandidat-20261020.md`.

J ergänzt die bewusst belegbare Desktop-Suche im selben Host. Standard bleibt unbelegt;
Einbau- und Prüfgrenzen: `docs/operations/klara/desktop-schnellsuche.md`.

Die Herkunftstabelle und älteren Prüfgrenzen unten beschreiben den übernommenen Ausgangsstand.

Der gemeinsame Begleiter laut O06 ist **eine** Menüleisten-App. Sie setzt sich aus drei Teilen
zusammen:

- **Host** aus `klara-office-mac-maskottchen` (`ff96149e`, KLARA-OFFICE-02): Figur, schwebendes
  Fenster, Menüleiste, Control-Option-K und die Webfläche `<Server>/begleiter`.
  - Seite, Kontextkanal und Word-Adapter `begleiter.js` liegen im selben Arbeitsbaum.
- **BPA-04-Funktionen** aus `345b4467`: Finder-Aufnahme, Markierung in Word und Übergabe-Anmeldung.
  - Sie stehen im Fenster „In anderen Programmen …“.
  - Den Code dafür gibt es unter „Meine Assistenz → In anderen Programmen“.
- **Browserkarte** (BPA-01 AC10): Anzeige der Karte, die die Chrome-Erweiterung über die
  Browserbrücke übergibt.

Die Dateien stammen aus `QUELLEN-HOSTUEBERNAHME-20261011T231344Z`; das Layout ist das des Hosts:

| Datei | Herkunft | Inhalt |
| --- | --- | --- |
| `Sources/main.swift` | ff96149e, unverändert | Einstieg (Menüleisten-App, kein Dock-Symbol) |
| `Sources/Steuerung.swift` | ff96149e + BPA-01-Stellen | Fenster, Menü, Webfläche; Anschluss der Browserkarte |
| `Sources/Fenster.swift` | ff96149e, unverändert | schwebendes Panel, WKWebView mit Ziehgriff |
| `Sources/Lage.swift` | ff96149e, unverändert | Geometrie |
| `Sources/Programme.swift` | 345b4467 `KlaraBegleiter.swift` ohne eigene `@main`-App | BPA-04-Zustand und -Ansicht, als Fenster geöffnet |
| `Sources/Server.swift`, `FinderAufnahme.swift`, `Bedienungshilfe.swift` | 345b4467, unverändert | BPA-04-Serverdraht, Finder, Bedienungshilfe |
| `Info.plist.vorlage`, `VERSION` | ff96149e, unverändert | Bündelangaben, Fassung |
| `BrowserBruecke/` | BPA-01 | Native-Messaging-Brücke und Bibliothek `KlaraBrowserKarte` |

## Browserkarte im Host

- **Anmeldung:** Der Host fragt `GET /api/me/klara/begleiter/sitzung` in einer eigenen
  Skriptwelt der Webfläche ab und erhält Nutzer und Sitzungsfingerabdruck.
  - Gebunden wird an beides. Jeder Sitzungswechsel, auch desselben Nutzers, ergibt eine neue
    Sitzungsmarke.
- **Sofort entwerten:** Ein gemeldeter Wechsel entwertet die Karte, bevor nachgefragt wird.
  Gemeldet wird er über:
  - die Meldung `anmeldung` der Webfläche;
  - eine Navigation;
  - Neuladen;
  - Verbindungsverlust.
- **Nachfragen** ohne vorheriges Entwerten: alle 30 Sekunden und beim Öffnen des Menüs.
- **Anzeige:** Im Menü steht „Browserkarte: …“, beim Öffnen frisch geprüft. Zusätzlich geht
  das Ereignis `klara-begleiter-browserkarte` an die Webfläche; `null` leert sie.
- **Lebenszyklus:** `beobachten()` beim Start; `anmelden(nil)` und `anhalten()` beim Beenden.
- **Gleicher Server nötig:** Karten gelten nur, wenn der Server des Begleiters (`KlarwerkServer`,
  im Bauskript `KLARWERK_SERVER`) derselbe ist wie der der Erweiterung
  (`https://app.klarwerk.ai`).

## Bauen

```
bash scripts/klara-office/begleiter-bauen.sh      # Bündel (Host + BPA-04 + Browserkarte, ein Modul)
cd apps/desktop/klara-begleiter && swift build    # dasselbe als Swift-Paket
cd BrowserBruecke && swift build -c release      # Brücke
xcrun swift test --disable-xctest --enable-swift-testing -j2   # Kartentests (Swift Testing, im Ordner BrowserBruecke)
```

Installieren, Entfernen und die lokale Bedienabnahme beschreibt
`docs/operations/klara-office/begleitapp-mac.md`.

## Stand

- Die Quellen sind übernommen und angeschlossen, aber in dieser Bahn **nicht** übersetzt und
  nicht ausgeführt; hier gibt es kein Swift.
- Die Kartentests (`SitzungsbindungTests.swift`, `KartenMenueTests.swift`) laufen seit
  Nacharbeit 22 auf **Swift Testing** statt XCTest. Auf diesem Mac fehlt XCTest, das vorhandene
  `Testing`-Framework (Swift 6.1.2) genügt. Auf älteren Werkzeugketten ist das nicht zugesagt.
- Die Bedienungshilfe steht nur in `Bedienungshilfe.swift`. Sie liest nur, nur Word, und fragt
  die Freigabe nur auf Klick an. Die Abgrenzung zur Host-Zusage KO-02-06 ist zur Bestätigung
  durch die Führung offen (`docs/operations/klara/browser-kontextkarten.md`).
