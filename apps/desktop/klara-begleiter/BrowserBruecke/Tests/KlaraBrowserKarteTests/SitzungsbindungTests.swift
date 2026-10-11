// BPA-01 AC10 (nacharbeit-13) — die Sitzungsbindung des Kartenverbrauchers über die Sitzungsmarke.
// Ausführen auf einem Mac mit Xcode-Werkzeugen: `swift test` im Ordner `BrowserBruecke`.
import Foundation
import XCTest

@testable import KlaraBrowserKarte

final class SitzungsbindungTests: XCTestCase {
  private var ordner: URL!
  private var ablage: URL!

  override func setUpWithError() throws {
    ordner = FileManager.default.temporaryDirectory
      .appendingPathComponent("klara-karte-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: ordner, withIntermediateDirectories: true)
    ablage = ordner.appendingPathComponent("browserkontext.json")
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: ordner)
  }

  /// So legt die Brücke ab: mit der Marke, die zu Beginn IHRER Verbindung galt.
  private func ablegen(marke: String?, nutzer: String = "nutzer-a", rechte: Int = 0o600) throws {
    var karte: [String: Any] = [
      "typ": "karte", "folge": 3, "fassung": "f1-abc", "nutzer": nutzer,
      "mandant": "https://app.klarwerk.ai", "url": "https://shop.beispiel.test/v-17",
      "titel": "Ventil V-17", "auswahl": "V-17 16 bar", "erfasstAm": "2026-10-11T14:00:00Z",
      "uebergebenAm": Date().timeIntervalSince1970,
    ]
    if let marke { karte["sitzungsmarke"] = marke }
    try JSONSerialization.data(withJSONObject: karte).write(to: ablage)
    try FileManager.default.setAttributes([.posixPermissions: rechte], ofItemAtPath: ablage.path)
  }

  private func anmeldung(_ sitzung: String) -> BegleiterAnmeldung {
    BegleiterAnmeldung(nutzer: "nutzer-a", mandant: "https://app.klarwerk.ai", sitzung: sitzung)
  }

  func testDieMarkeLiegtGeschuetztFuerDieBrueckeBereit() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    q.anmelden(anmeldung("s-1"))
    let gelesen = try String(contentsOf: q.markenDatei, encoding: .utf8)
    XCTAssertEqual(gelesen, q.sitzungsmarke)
    let rechte = try FileManager.default.attributesOfItem(atPath: q.markenDatei.path)[
      .posixPermissions] as? NSNumber
    XCTAssertEqual((rechte?.intValue ?? 0) & 0o077, 0)
    q.anmelden(nil)
    XCTAssertFalse(FileManager.default.fileExists(atPath: q.markenDatei.path))
  }

  func testVerspaeteteUebergabeAusFruehererSitzungWirdVerworfen() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var gemeldet: [BrowserKarte?] = []
    q.beiAenderung = { gemeldet.append($0) }
    q.anmelden(anmeldung("s-1"))
    let markeA = try XCTUnwrap(q.sitzungsmarke)
    try ablegen(marke: markeA)
    q.anmelden(anmeldung("s-1"))  // dieselbe Anmeldung: nur neu prüfen (wie der Dateibeobachter)
    XCTAssertNotNil(q.aktuell())

    // Wechsel zu Sitzung B — gleicher Nutzer, gleicher Server.
    q.anmelden(anmeldung("s-2"))
    let markeB = try XCTUnwrap(q.sitzungsmarke)
    XCTAssertNotEqual(markeA, markeB)
    XCTAssertNil(q.aktuell())
    XCTAssertNil(gemeldet.last ?? nil)

    // Die VERSPÄTETE Übergabe aus A wird jetzt erst abgelegt — mit neuem Zeitstempel, aber der
    // Marke ihrer Verbindung. Sie gilt in KEINEM Leseweg.
    try ablegen(marke: markeA)
    XCTAssertNil(q.aktuell())
    q.anmelden(anmeldung("s-2"))
    XCTAssertNil(gemeldet.last ?? nil)

    // Erst eine Übergabe unter B gilt.
    try ablegen(marke: markeB)
    XCTAssertNotNil(q.aktuell())
  }

  func testOhneMarkeFremderNutzerUnsichereDateiUndAbmeldungGebenNichtsFrei() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    q.anmelden(anmeldung("s-1"))
    let marke = try XCTUnwrap(q.sitzungsmarke)
    try ablegen(marke: nil)
    XCTAssertNil(q.aktuell())
    try ablegen(marke: marke, nutzer: "nutzer-b")
    XCTAssertNil(q.aktuell())
    try ablegen(marke: marke, rechte: 0o644)
    XCTAssertNil(q.aktuell())
    try ablegen(marke: marke)
    XCTAssertNotNil(q.aktuell())
    try FileManager.default.removeItem(at: ablage)  // `verwerfen` / `widerrufen` der Brücke
    XCTAssertNil(q.aktuell())
    try ablegen(marke: marke)
    q.anmelden(nil)
    XCTAssertNil(q.aktuell())
  }
}
