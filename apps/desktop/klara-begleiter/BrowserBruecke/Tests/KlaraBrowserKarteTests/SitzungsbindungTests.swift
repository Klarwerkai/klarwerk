// BPA-01 AC10 (nacharbeit-13) — die Sitzungsbindung des Kartenverbrauchers über die Sitzungsmarke.
// Ausführen auf einem Mac mit Xcode-Werkzeugen: `swift test` im Ordner `BrowserBruecke`.
import Foundation
import Testing

@testable import KlaraBrowserKarte

@Suite(.serialized)
final class SitzungsbindungTests {
  private var ordner: URL!
  private var ablage: URL!

  init() throws {
    ordner = FileManager.default.temporaryDirectory
      .appendingPathComponent("klara-karte-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: ordner, withIntermediateDirectories: true)
    ablage = ordner.appendingPathComponent("browserkontext.json")
  }

  deinit {
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

  @Test

  func testDieMarkeLiegtGeschuetztFuerDieBrueckeBereit() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    q.anmelden(anmeldung("s-1"))
    let gelesen = try String(contentsOf: q.markenDatei, encoding: .utf8)
    #expect((gelesen) == (q.sitzungsmarke))
    let rechte = try FileManager.default.attributesOfItem(atPath: q.markenDatei.path)[
      .posixPermissions] as? NSNumber
    #expect(((rechte?.intValue ?? 0) & 0o077) == (0))
    q.anmelden(nil)
    #expect(!(FileManager.default.fileExists(atPath: q.markenDatei.path)))
  }

  @Test

  func testVerspaeteteUebergabeAusFruehererSitzungWirdVerworfen() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var gemeldet: [BrowserKarte?] = []
    q.beiAenderung = { gemeldet.append($0) }
    q.anmelden(anmeldung("s-1"))
    let markeA = try #require(q.sitzungsmarke)
    try ablegen(marke: markeA)
    q.anmelden(anmeldung("s-1"))  // dieselbe Anmeldung: nur neu prüfen (wie der Dateibeobachter)
    #expect((q.aktuell()) != nil)

    // Wechsel zu Sitzung B — gleicher Nutzer, gleicher Server.
    q.anmelden(anmeldung("s-2"))
    let markeB = try #require(q.sitzungsmarke)
    #expect((markeA) != (markeB))
    #expect((q.aktuell()) == nil)
    #expect((gemeldet.last ?? nil) == nil)

    // Die VERSPÄTETE Übergabe aus A wird jetzt erst abgelegt — mit neuem Zeitstempel, aber der
    // Marke ihrer Verbindung. Sie gilt in KEINEM Leseweg.
    try ablegen(marke: markeA)
    #expect((q.aktuell()) == nil)
    q.anmelden(anmeldung("s-2"))
    #expect((gemeldet.last ?? nil) == nil)

    // Erst eine Übergabe unter B gilt.
    try ablegen(marke: markeB)
    #expect((q.aktuell()) != nil)
  }

  /// nacharbeit-19: Nutzer UND Sitzung kommen vom Server (`/api/me/klara/begleiter/sitzung`).
  @Test
  func testHostAnmeldungsfolgeBindetAnServerSitzung() {
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    let a1 = folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1")
    #expect((a1?.sitzung) == ("srv-1"))
    #expect((a1?.mandant) == ("https://app.klarwerk.ai"))
    #expect((folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1")) == (a1))  // dieselbe bleibt
    // Sitzungswechsel DESSELBEN Nutzers, ohne dass je eine Abmeldung gemeldet wurde:
    let a2 = folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-2")
    #expect((a2) != (a1))
    #expect((folge.bestaetigt(nutzer: "nutzer-b", sitzung: "srv-3")?.nutzer) == ("nutzer-b"))
    #expect((folge.bestaetigt(nutzer: nil, sitzung: "srv-3")) == nil)
    #expect((folge.bestaetigt(nutzer: "nutzer-a", sitzung: nil)) == nil)
    #expect((folge.bestaetigt(nutzer: "", sitzung: "")) == nil)
    _ = folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-4")
    folge.entwerten()
    #expect((folge.aktuell) == nil)
  }

  /// nacharbeit-19, Befund 1: Sitzungswechsel desselben Nutzers OHNE gemeldete Abmeldung sperrt
  /// die alte Karte und eine verspätete Übergabe der alten Sitzung.
  @Test
  func testSitzungswechselGleicherNutzerOhneAbmeldungSperrtAlteKarte() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    let alt = try #require(q.sitzungsmarke)
    try ablegen(marke: alt)
    #expect((q.aktuell()) != nil)
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-2"))
    #expect((q.sitzungsmarke) != (alt))
    #expect((q.aktuell()) == nil)
    try ablegen(marke: alt)  // verspätete Übergabe aus der alten Sitzung
    #expect((q.aktuell()) == nil)
  }

  /// nacharbeit-19, Befund 1: Bei einem gemeldeten Wechsel entwertet der Host SOFORT — vor der
  /// Nachfrage. Während die Nachfrage läuft, gibt es keine Karte; die Antwort gibt nur unter der
  /// bestätigten neuen Sitzung frei, nie die alte Karte.
  @Test
  func testGemeldeterWechselEntwertetSofortVorDerNachfrage() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    var gemeldet: [BrowserKarte?] = []
    q.beiAenderung = { gemeldet.append($0) }
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    let alt = try #require(q.sitzungsmarke)
    try ablegen(marke: alt)
    q.anmelden(folge.aktuell)
    #expect((q.aktuell()) != nil)
    // Meldung „anmeldung" (Steuerung.anmeldungGewechselt): entwerten, dann erst nachfragen.
    folge.entwerten()
    q.anmelden(folge.aktuell)
    #expect((q.aktuell()) == nil)  // das Menü liest jetzt: keine Karte
    #expect((gemeldet.last ?? nil) == nil)
    // Die Nachfrage bestätigt DIESELBE Serversitzung: trotzdem neue Marke, die alte Karte bleibt weg.
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    #expect((q.sitzungsmarke) != (alt))
    #expect((q.aktuell()) == nil)
  }

  @Test

  func testKlarwerkHerkunftWieDieErweiterung() {
    #expect((klarwerkHerkunft(URL(string: "https://App.Klarwerk.ai/begleiter")!)) == ("https://app.klarwerk.ai"))
    #expect((klarwerkHerkunft(URL(string: "http://localhost:8080/")!)) == ("http://localhost:8080"))
    #expect((klarwerkHerkunft(URL(string: "begleiter")!)) == nil)
  }

  /// Host-Weg: Abmelden und erneutes Anmelden DESSELBEN Nutzers sperrt die Karte der alten Sitzung.
  @Test
  func testHostAbmeldungUndNeuanmeldungSperrtAlteKarte() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    var folge = HostAnmeldungsFolge(mandant: "https://app.klarwerk.ai")
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-1"))
    let alt = try #require(q.sitzungsmarke)
    try ablegen(marke: alt)
    #expect((q.aktuell()) != nil)
    q.anmelden(folge.bestaetigt(nutzer: nil, sitzung: nil))
    #expect((q.aktuell()) == nil)
    q.anmelden(folge.bestaetigt(nutzer: "nutzer-a", sitzung: "srv-2"))
    #expect((q.sitzungsmarke) != (alt))
    try ablegen(marke: alt)  // verspätete Übergabe aus der alten Sitzung
    #expect((q.aktuell()) == nil)
  }

  @Test

  func testOhneMarkeFremderNutzerUnsichereDateiUndAbmeldungGebenNichtsFrei() throws {
    let q = BrowserKartenQuelle(ablage: ablage)
    q.anmelden(anmeldung("s-1"))
    let marke = try #require(q.sitzungsmarke)
    try ablegen(marke: nil)
    #expect((q.aktuell()) == nil)
    try ablegen(marke: marke, nutzer: "nutzer-b")
    #expect((q.aktuell()) == nil)
    try ablegen(marke: marke, rechte: 0o644)
    #expect((q.aktuell()) == nil)
    try ablegen(marke: marke)
    #expect((q.aktuell()) != nil)
    try FileManager.default.removeItem(at: ablage)  // `verwerfen` / `widerrufen` der Brücke
    #expect((q.aktuell()) == nil)
    try ablegen(marke: marke)
    q.anmelden(nil)
    #expect((q.aktuell()) == nil)
  }
}
