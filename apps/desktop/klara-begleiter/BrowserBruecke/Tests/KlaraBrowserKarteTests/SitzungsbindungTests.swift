// BPA-01 AC10 (nacharbeit-12) — die Sitzungsbindung des Kartenverbrauchers.
// Ausführen auf dem Mac: `swift test` im Ordner `BrowserBruecke`.
import Foundation
import XCTest

@testable import KlaraBrowserKarte

final class SitzungsbindungTests: XCTestCase {
  private var ordner: URL!
  private var ablage: URL!
  private var jetzt: Double = 1_000

  override func setUpWithError() throws {
    ordner = FileManager.default.temporaryDirectory
      .appendingPathComponent("klara-karte-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: ordner, withIntermediateDirectories: true)
    ablage = ordner.appendingPathComponent("browserkontext.json")
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: ordner)
  }

  private func ablegen(nutzer: String = "nutzer-a", uebergebenAm: Double, rechte: Int = 0o600) throws {
    let karte: [String: Any] = [
      "typ": "karte", "folge": 3, "fassung": "f1-abc", "nutzer": nutzer,
      "mandant": "https://app.klarwerk.ai", "url": "https://shop.beispiel.test/v-17",
      "titel": "Ventil V-17", "auswahl": "V-17 16 bar", "erfasstAm": "2026-10-11T14:00:00Z",
      "uebergebenAm": uebergebenAm,
    ]
    try JSONSerialization.data(withJSONObject: karte).write(to: ablage)
    try FileManager.default.setAttributes([.posixPermissions: rechte], ofItemAtPath: ablage.path)
  }

  private func quelle() -> BrowserKartenQuelle {
    BrowserKartenQuelle(ablage: ablage, uhr: { [unowned self] in self.jetzt })
  }

  private let peter = BegleiterAnmeldung(
    nutzer: "nutzer-a", mandant: "https://app.klarwerk.ai", sitzung: "s-1")

  func testKarteAusFrueherSitzungBleibtGesperrt() throws {
    try ablegen(uebergebenAm: 900)  // vor der Anmeldung abgelegt
    let q = quelle()
    q.anmelden(peter)
    XCTAssertNil(q.aktuell())
  }

  func testNeueSitzungDesselbenNutzersSperrtDieAlteKarte() throws {
    let q = quelle()
    var gemeldet: [BrowserKarte?] = []
    q.beiAenderung = { gemeldet.append($0) }
    q.anmelden(peter)
    jetzt = 1_100
    try ablegen(uebergebenAm: 1_050)
    q.anmelden(peter)  // dieselbe Anmeldung: nur neu prüfen (wie der Dateibeobachter)
    XCTAssertNotNil(q.aktuell())
    XCTAssertNotNil(gemeldet.last ?? nil)
    // Neue Sitzung, gleicher Nutzer, gleicher Server: die alte Karte erscheint NICHT wieder.
    jetzt = 1_200
    let zweite = BegleiterAnmeldung(
      nutzer: "nutzer-a", mandant: "https://app.klarwerk.ai", sitzung: "s-2")
    q.anmelden(zweite)
    XCTAssertNil(q.aktuell())
    XCTAssertNil(gemeldet.last ?? nil)
    // Erst eine frische Übergabe in dieser Sitzung gilt wieder.
    try ablegen(uebergebenAm: 1_250)
    XCTAssertEqual(q.aktuell()?.uebergebenAm, 1_250)
  }

  func testFremderNutzerAbmeldungUndUnsichereDateiGebenNichtsFrei() throws {
    let q = quelle()
    q.anmelden(peter)
    try ablegen(nutzer: "nutzer-b", uebergebenAm: 1_050)
    XCTAssertNil(q.aktuell())
    try ablegen(uebergebenAm: 1_050, rechte: 0o644)
    XCTAssertNil(q.aktuell())
    try ablegen(uebergebenAm: 1_050)
    XCTAssertNotNil(q.aktuell())
    q.anmelden(nil)
    XCTAssertNil(q.aktuell())
  }

  func testGeloeschteKarteIstKeineKarte() throws {
    let q = quelle()
    q.anmelden(peter)
    try ablegen(uebergebenAm: 1_050)
    XCTAssertNotNil(q.aktuell())
    try FileManager.default.removeItem(at: ablage)  // `verwerfen` / `widerrufen` der Brücke
    XCTAssertNil(q.aktuell())
  }
}
