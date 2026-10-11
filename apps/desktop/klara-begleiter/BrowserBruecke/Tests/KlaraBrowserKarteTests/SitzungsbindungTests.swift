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

  /// nacharbeit-19: Nutzer UND Sitzung kommen vom Server (`/api/me/klara/begleiter/sitzung`).
  func testHostAnmeldungsfolgeBindetAnServerSitzung() {
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    let a1 = folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1")
    XCTAssertEqual(a1?.sitzung, "srv-1")
    XCTAssertEqual(a1?.mandant, "https://app.klarwerk.ai")
    XCTAssertEqual(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"), a1)  // dieselbe bleibt
    // Sitzungswechsel DESSELBEN Nutzers, ohne dass je eine Abmeldung gemeldet wurde:
    let a2 = folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-2")
    XCTAssertNotEqual(a2, a1)
    XCTAssertEqual(folge.bestaetigt(nutzer: "nutzer-b", sitzung: "srv-3")?.nutzer, "nutzer-b")
    XCTAssertNil(folge.bestaetigt(nutzer: nil, sitzung: "srv-3"))
    XCTAssertNil(folge.bestaetigt(nutzer: "nutzer-a", sitzung: nil))
    XCTAssertNil(folge.bestaetigt(nutzer: "", sitzung: ""))
    _ = folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-4")
    folge.entwerten()
    XCTAssertNil(folge.aktuell)
  }

  /// nacharbeit-19, Befund 1: Sitzungswechsel desselben Nutzers OHNE gemeldete Abmeldung sperrt
  /// die alte Karte und eine verspätete Übergabe der alten Sitzung.
  func testSitzungswechselGleicherNutzerOhneAbmeldungSperrtAlteKarte() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    let alt = try XCTUnwrap(q.sitzungsmarke)
    try ablegen(marke: alt)
    XCTAssertNotNil(q.aktuell())
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-2"))
    XCTAssertNotEqual(q.sitzungsmarke, alt)
    XCTAssertNil(q.aktuell())
    try ablegen(marke: alt)  // verspätete Übergabe aus der alten Sitzung
    XCTAssertNil(q.aktuell())
  }

  /// nacharbeit-19, Befund 1: Bei einem gemeldeten Wechsel entwertet der Host SOFORT — vor der
  /// Nachfrage. Während die Nachfrage läuft, gibt es keine Karte; die Antwort gibt nur unter der
  /// bestätigten neuen Sitzung frei, nie die alte Karte.
  func testGemeldeterWechselEntwertetSofortVorDerNachfrage() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    var gemeldet: [BrowserKarte?] = []
    q.beiAenderung = { gemeldet.append($0) }
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    let alt = try XCTUnwrap(q.sitzungsmarke)
    try ablegen(marke: alt)
    q.anmelden(folge.aktuell)
    XCTAssertNotNil(q.aktuell())
    // Meldung „anmeldung" (Steuerung.anmeldungGewechselt): entwerten, dann erst nachfragen.
    folge.entwerten()
    q.anmelden(folge.aktuell)
    XCTAssertNil(q.aktuell())  // das Menü liest jetzt: keine Karte
    XCTAssertNil(gemeldet.last ?? nil)
    // Die Nachfrage bestätigt DIESELBE Serversitzung: trotzdem neue Marke, die alte Karte bleibt weg.
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    XCTAssertNotEqual(q.sitzungsmarke, alt)
    XCTAssertNil(q.aktuell())
  }

  func testKlarwerkHerkunftWieDieErweiterung() {
    XCTAssertEqual(
      klarwerkHerkunft(URL(string: "https://App.Klarwerk.ai/begleiter")!), "https://app.klarwerk.ai")
    XCTAssertEqual(
      klarwerkHerkunft(URL(string: "http://localhost:8080/")!), "http://localhost:8080")
    XCTAssertNil(klarwerkHerkunft(URL(string: "begleiter")!))
  }

  /// Host-Weg: Abmelden und erneutes Anmelden DESSELBEN Nutzers sperrt die Karte der alten Sitzung.
  func testHostAbmeldungUndNeuanmeldungSperrtAlteKarte() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    let alt = try XCTUnwrap(q.sitzungsmarke)
    try ablegen(marke: alt)
    XCTAssertNotNil(q.aktuell())
    q.anmelden(folge.bestaetigt(nutzer: nil, sitzung: nil))
    XCTAssertNil(q.aktuell())
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-2"))
    XCTAssertNotEqual(q.sitzungsmarke, alt)
    try ablegen(marke: alt)  // verspätete Übergabe aus der alten Sitzung
    XCTAssertNil(q.aktuell())
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
