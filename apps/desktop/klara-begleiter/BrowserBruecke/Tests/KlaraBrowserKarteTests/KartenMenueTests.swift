// BPA-01 AC03/AC08 (nacharbeit-21) — der Menüabschnitt der Browserkarte im Begleiter.
// Ausführen auf einem Mac mit Xcode-Werkzeugen: `swift test` im Ordner `BrowserBruecke`.
#if canImport(AppKit)
  import AppKit
  import Testing

  @testable import KlaraBrowserKarte

  /// Steht für den Host: nimmt „Quelle im Browser öffnen" entgegen.
  @MainActor
  private final class Ziel: NSObject {
    var geoeffnet: [URL] = []
    @objc func oeffnen(_ sender: NSMenuItem) {
      if let url = sender.representedObject as? URL { geoeffnet.append(url) }
    }
  }

  @MainActor
  @Suite(.serialized)
  struct KartenMenueTests {
    private func karte(titel: String = "Ventil V-17", url: String = "https://shop.beispiel.test/v-17")
      -> BrowserKarte
    {
      BrowserKarte(
        folge: 3, fassung: "f1-abcdef123456789", nutzer: "nutzer-a",
        mandant: "https://app.klarwerk.ai", url: url, titel: titel,
        auswahl: "V-17 | 16 bar", erfasstAm: "2026-10-11T14:00:00Z", uebergebenAm: 0)
    }

    /// Das Menü wie im Host: Einträge davor, der Abschnitt, Einträge danach.
    private func menueMitAbschnitt(_ abschnitt: KartenMenueAbschnitt, _ k: BrowserKarte?) -> NSMenu {
      let menue = NSMenu()
      menue.addItem(withTitle: "Reduzierte Bewegung", action: nil, keyEquivalent: "")
      menue.addItem(.separator())
      abschnitt.anhaengen(an: menue, karte: k)
      menue.addItem(withTitle: "In anderen Programmen …", action: nil, keyEquivalent: "")
      return menue
    }

    private func titel(_ menue: NSMenu) -> [String] { menue.items.map(\.title) }

    @Test

    func testGeoeffnetesMenueLeertSofortBeiEntwertung() throws {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, karte())
      #expect(titel(menue).contains("Browserkarte: Ventil V-17"))
      #expect(titel(menue).contains("Auswahl: V-17 | 16 bar"))
      let alteEintraege = abschnitt.eintraege
      let alterOeffner: NSMenuItem = try #require(alteEintraege.last)
      #expect((alterOeffner.representedObject as? URL) == (URL(string: "https://shop.beispiel.test/v-17")))

      // Karte entwertet (Widerruf, Abmeldung, Sitzungswechsel) — das Menü ist noch offen.
      abschnitt.aktualisieren(karte: nil)

      #expect((titel(menue)) == (["Reduzierte Bewegung", "", "Browserkarte: keine", "In anderen Programmen …"]))
      // Kein Eintrag im Menü trägt noch ein Quellziel oder eine Aktion zur alten Seite.
      #expect(menue.items.allSatisfy { $0.representedObject == nil })
      #expect(!(menue.items.contains { $0.title.contains("V-17") }))
      // Auch ein noch gehaltener alter Eintrag öffnet nichts mehr.
      for alt in alteEintraege {
        #expect((alt.representedObject) == nil)
        #expect((alt.action) == nil)
        #expect((alt.target) == nil)
        #expect((menue.index(of: alt)) == (-1))
      }
      #expect(ziel.geoeffnet.isEmpty)
    }

    @Test

    func testNeueKarteErsetztAlteAnDerselbenStelle() {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, karte())
      abschnitt.aktualisieren(karte: karte(titel: "Ventil V-18", url: "https://shop.beispiel.test/v-18"))
      let t = titel(menue)
      #expect((t.first) == ("Reduzierte Bewegung"))
      #expect((t.last) == ("In anderen Programmen …"))
      #expect(t.contains("Browserkarte: Ventil V-18"))
      #expect(!(t.contains("Browserkarte: Ventil V-17")))
      let oeffner = menue.items.filter { $0.representedObject != nil }
      #expect((oeffner.count) == (1))
      #expect((oeffner.first?.representedObject as? URL) == (URL(string: "https://shop.beispiel.test/v-18")))
    }

    @Test

    func testOhneKarteBeimAufbauKeinQuellziel() {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, nil)
      #expect(titel(menue).contains("Browserkarte: keine"))
      #expect(menue.items.allSatisfy { $0.representedObject == nil })
    }

    @Test

    func testNichtWebSeiteBekommtKeinenOeffner() {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, karte(url: "file:///etc/passwd"))
      #expect(menue.items.allSatisfy { $0.representedObject == nil })
    }
  }
#endif
