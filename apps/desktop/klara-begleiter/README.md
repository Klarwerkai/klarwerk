# Klara Begleiter (macOS, Apple Silicon)

Der gemeinsame Begleiter laut O06 ist **eine** Menüleisten-App. Sie setzt sich aus drei Teilen
zusammen:

- Host aus `klara-office-mac-maskottchen` (`ff96149e`): Figur, schwebendes Fenster, Menüleiste,
  Control-Option-K und die Webfläche `<Server>/begleiter`.
- BPA-04-Funktionen aus `345b4467`: Finder-Aufnahme, Markierung in Word und Übergabe-Anmeldung.
  Sie stehen im Fenster „In anderen Programmen …“.
- Browserkarte (BPA-01 AC10): Anzeige der Karte, die die Chrome-Erweiterung über die
  Browserbrücke übergibt.

Die Dateien stammen aus `QUELLEN-HOSTUEBERNAHME-20261011T231344Z`:

| Datei | Herkunft | Inhalt |
| --- | --- | --- |
| `Sources/KlaraBegleiter/main.swift` | ff96149e, unverändert | Einstieg (Menüleisten-App, kein Dock-Symbol) |
| `Sources/KlaraBegleiter/Steuerung.swift` | ff96149e + BPA-01-Stellen | Fenster, Menü, Webfläche; Anschluss der Browserkarte |
| `Sources/KlaraBegleiter/Fenster.swift` | ff96149e, unverändert | schwebendes Panel, WKWebView mit Ziehgriff |
| `Sources/KlaraBegleiter/Lage.swift` | ff96149e, unverändert | Geometrie |
| `Sources/KlaraBegleiter/Programme.swift` | 345b4467 `KlaraBegleiter.swift` ohne eigene `@main`-App | BPA-04-Zustand und -Ansicht, als Fenster geöffnet |
| `Sources/KlaraBegleiter/Server.swift`, `FinderAufnahme.swift`, `Bedienungshilfe.swift` | 345b4467, unverändert | BPA-04-Serverdraht, Finder, Bedienungshilfe |
| `Info.plist.vorlage`, `VERSION` | ff96149e, unverändert | Bündelangaben, Fassung |
| `BrowserBruecke/` | BPA-01 | Native-Messaging-Brücke und Bibliothek `KlaraBrowserKarte` |

## Browserkarte im Host

- **Anmeldung:** Der Host fragt `/api/auth/me` in einer eigenen Skriptwelt der Webfläche ab.
  - Das geschieht nach jedem Laden, bei jeder Navigation, auf die Meldung `anmeldung` der
    Webfläche, beim Öffnen des Menüs und alle 30 Sekunden.
  - Jeder Übergang ist eine neue Sitzung mit neuer Sitzungsmarke: abgemeldet → angemeldet oder
    Nutzerwechsel. Eine Abmeldung, Offline oder ein nicht feststellbarer Zustand führen zu
    `anmelden(nil)`.
- **Anzeige:** Die Karte erscheint im Menü unter „Browserkarte: …“ und wird beim Öffnen frisch
  geprüft. Zusätzlich geht sie als Ereignis `klara-begleiter-browserkarte` an die Webfläche,
  `null` leert sie.
- **Lebenszyklus:** `beobachten()` beim Start; `anmelden(nil)` und `anhalten()` beim Beenden.
- Karten gelten nur, wenn der Server des Begleiters (`KlarwerkServer`) derselbe ist wie der der
  Erweiterung (`https://app.klarwerk.ai`).

## Bauen

```
cd apps/desktop/klara-begleiter
swift build -c release            # App (Host + BPA-04 + Browserkarte)
cd BrowserBruecke && swift build -c release && swift test   # Brücke und Kartentests
```

Das Bündel (`Info.plist` aus der Vorlage) baute im Host-Kandidaten
`scripts/klara-office/begleiter-bauen.sh`. Dieses Skript ist noch nicht übernommen.

## Stand

- Die Quellen sind übernommen und angeschlossen, aber in dieser Bahn **nicht** übersetzt und nicht
  ausgeführt; hier gibt es kein Swift und kein XCTest.
- Die Serverwege der BPA-04-Funktionen (`/api/auth/office-handover/redeem`,
  `/api/klara/programme/*`) und die Webfläche `/begleiter` gehören zu den Kandidaten `345b4467`
  bzw. `ff96149e` und fehlen im Server dieses Arbeitsbaums. Bis zu ihrer regulären Integration
  antworten diese Wege mit dem Fehler des Servers.
- Die Browserkarte braucht keinen dieser Wege, nur `/api/auth/me`.
