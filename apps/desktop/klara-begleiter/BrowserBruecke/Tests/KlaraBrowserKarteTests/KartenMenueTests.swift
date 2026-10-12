// BPA-01 AC03/AC08 (nacharbeit-21) — der Menüabschnitt der Browserkarte im Begleiter.
// Ausführen auf einem Mac mit Xcode-Werkzeugen: `swift test` im Ordner `BrowserBruecke`.
#if canImport(AppKit)
  import AppKit
  import XCTest

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
  final class KartenMenueTests: XCTestCase {
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

    func testGeoeffnetesMenueLeertSofortBeiEntwertung() {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, karte())
      XCTAssertTrue(titel(menue).contains("Browserkarte: Ventil V-17"))
      XCTAssertTrue(titel(menue).contains("Auswahl: V-17 | 16 bar"))
      let alteEintraege = abschnitt.eintraege
      let alterOeffner = try? XCTUnwrap(alteEintraege.last)
      XCTAssertEqual(alterOeffner?.representedObject as? URL, URL(string: "https://shop.beispiel.test/v-17"))

      // Karte entwertet (Widerruf, Abmeldung, Sitzungswechsel) — das Menü ist noch offen.
      abschnitt.aktualisieren(karte: nil)

      XCTAssertEqual(
        titel(menue),
        ["Reduzierte Bewegung", "", "Browserkarte: keine", "In anderen Programmen …"])
      // Kein Eintrag im Menü trägt noch ein Quellziel oder eine Aktion zur alten Seite.
      XCTAssertTrue(menue.items.allSatisfy { $0.representedObject == nil })
      XCTAssertFalse(menue.items.contains { $0.title.contains("V-17") })
      // Auch ein noch gehaltener alter Eintrag öffnet nichts mehr.
      for alt in alteEintraege {
        XCTAssertNil(alt.representedObject)
        XCTAssertNil(alt.action)
        XCTAssertNil(alt.target)
        XCTAssertEqual(menue.index(of: alt), -1)
      }
      XCTAssertTrue(ziel.geoeffnet.isEmpty)
    }

    func testNeueKarteErsetztAlteAnDerselbenStelle() {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, karte())
      abschnitt.aktualisieren(karte: karte(titel: "Ventil V-18", url: "https://shop.beispiel.test/v-18"))
      let t = titel(menue)
      XCTAssertEqual(t.first, "Reduzierte Bewegung")
      XCTAssertEqual(t.last, "In anderen Programmen …")
      XCTAssertTrue(t.contains("Browserkarte: Ventil V-18"))
      XCTAssertFalse(t.contains("Browserkarte: Ventil V-17"))
      let oeffner = menue.items.filter { $0.representedObject != nil }
      XCTAssertEqual(oeffner.count, 1)
      XCTAssertEqual(oeffner.first?.representedObject as? URL, URL(string: "https://shop.beispiel.test/v-18"))
    }

    func testOhneKarteBeimAufbauKeinQuellziel() {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, nil)
      XCTAssertTrue(titel(menue).contains("Browserkarte: keine"))
      XCTAssertTrue(menue.items.allSatisfy { $0.representedObject == nil })
    }

    func testNichtWebSeiteBekommtKeinenOeffner() {
      let ziel = Ziel()
      let abschnitt = KartenMenueAbschnitt(ziel: ziel, oeffnenAktion: #selector(Ziel.oeffnen(_:)))
      let menue = menueMitAbschnitt(abschnitt, karte(url: "file:///etc/passwd"))
      XCTAssertTrue(menue.items.allSatisfy { $0.representedObject == nil })
    }
  }
#endif
