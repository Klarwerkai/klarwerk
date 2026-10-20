// BPA-01 AC10 — DIE BROWSERBRÜCKE DES KLARA-BEGLEITERS.
//
// Chrome startet dieses Programm je Verbindung der Erweiterung (`chrome.runtime.connectNative`
// mit dem Host `ai.klarwerk.klara_begleiter`) und spricht mit ihm ausschliesslich über stdin/stdout:
// je Nachricht vier Byte Länge (native Byte-Reihenfolge) und JSON. Es gibt keinen offenen Port,
// keinen lokalen Webserver und keine Steuerschnittstelle für andere Programme.
//
// WER SPRECHEN DARF
//   1. Chrome startet den Host nur für Erweiterungen, die sein Manifest unter `allowed_origins`
//      nennt (`ai.klarwerk.klara_begleiter.json`, angelegt von `installieren.sh`).
//   2. Der Host prüft die übergebene Herkunft (erstes Argument) zusätzlich gegen die beim
//      Installieren hinterlegte Erweiterungskennung (`erweiterung` neben dem Programm). Fehlt die
//      Datei oder passt die Herkunft nicht, beendet er sich, ohne etwas zu lesen (fail-closed).
//   3. Die erste Nachricht muss `hallo` sein. Der Host antwortet mit dem Einmalwert der Erweiterung,
//      seiner Fassung und der macOS-Fassung — die Erweiterung verwirft jede andere Antwort.
//
// WAS ER TUT
//   · `karte`: nimmt GENAU die gebundene Karte an (nur für den Nutzer aus `hallo` und nur unter der
//     Begleitersitzung, die zu Beginn der Verbindung galt), legt sie mit dieser Sitzungsmarke für
//     den Begleiter ab — nur lesbar für dieses macOS-Konto (0600) — und quittiert Folge und Fassung.
//   · `verwerfen`: die Karte gilt in der Erweiterung nicht mehr — sofort weg, Verbindung bleibt.
//   · `widerrufen` oder Ende der Verbindung: verwirft die abgelegte Karte und endet.
//   Er liest keine Seiten, macht keine Bildschirmaufnahme, hat kein Mikrofon und spricht mit keinem
//   Server. Anmeldung und Schlüssel der Erweiterung erreichen ihn nie.
import Foundation

let fassung = "0.1.0"
let protokoll = 1
let groessteNachricht = 1_048_576

/// Die abgelegte Karte, die der Begleiter anzeigt — nur für dieses macOS-Konto lesbar.
let ablage: URL = {
  let basis = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/Klarwerk/Begleiter", isDirectory: true)
  return basis.appendingPathComponent("browserkontext.json")
}()

func lesen() -> [String: Any]? {
  let kopf = FileHandle.standardInput.readData(ofLength: 4)
  guard kopf.count == 4 else { return nil }
  let laenge = Int(kopf.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) })
  guard laenge > 0, laenge <= groessteNachricht else { return nil }
  let daten = FileHandle.standardInput.readData(ofLength: laenge)
  guard daten.count == laenge else { return nil }
  return (try? JSONSerialization.jsonObject(with: daten)) as? [String: Any]
}

func schreiben(_ nachricht: [String: Any]) {
  guard let daten = try? JSONSerialization.data(withJSONObject: nachricht) else { return }
  var laenge = UInt32(daten.count)
  let kopf = Data(bytes: &laenge, count: 4)
  FileHandle.standardOutput.write(kopf)
  FileHandle.standardOutput.write(daten)
}

func verwerfen() {
  try? FileManager.default.removeItem(at: ablage)
}

/// Die Sitzungsmarke des Begleiters (KlaraBrowserKarte schreibt sie bei jeder Anmeldung neu und
/// löscht sie bei der Abmeldung). Nur eine Datei dieses macOS-Kontos mit 0600 gilt.
let markenDatei = ablage.deletingLastPathComponent().appendingPathComponent("begleitersitzung")

func aktuelleMarke() -> String? {
  guard
    let werte = try? FileManager.default.attributesOfItem(atPath: markenDatei.path),
    let besitzer = werte[.ownerAccountID] as? NSNumber, besitzer.uint32Value == getuid(),
    let rechte = werte[.posixPermissions] as? NSNumber, (rechte.intValue & 0o077) == 0,
    let text = try? String(contentsOf: markenDatei, encoding: .utf8)
  else { return nil }
  let marke = text.trimmingCharacters(in: .whitespacesAndNewlines)
  return marke.range(of: "^[A-Za-z0-9-]{16,64}$", options: .regularExpression) != nil ? marke : nil
}

/// Legt die Karte ab — gebunden an die Sitzungsmarke, unter der DIESE Verbindung begann.
func ablegen(_ karte: [String: Any], marke: String) -> Bool {
  var abgelegt = karte
  abgelegt["sitzungsmarke"] = marke
  abgelegt["uebergebenAm"] = Date().timeIntervalSince1970
  guard let daten = try? JSONSerialization.data(withJSONObject: abgelegt) else { return false }
  let ordner = ablage.deletingLastPathComponent()
  do {
    try FileManager.default.createDirectory(
      at: ordner, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    try daten.write(to: ablage, options: [.atomic])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: ablage.path)
    return true
  } catch {
    verwerfen()
    return false
  }
}

/// Die beim Installieren hinterlegte Erweiterungskennung — ohne sie spricht der Host mit niemandem.
func erlaubteHerkunft() -> String? {
  let programm = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
  let datei = programm.deletingLastPathComponent().appendingPathComponent("erweiterung")
  guard let kennung = try? String(contentsOf: datei, encoding: .utf8) else { return nil }
  let sauber = kennung.trimmingCharacters(in: .whitespacesAndNewlines)
  guard sauber.range(of: "^[a-p]{32}$", options: .regularExpression) != nil else { return nil }
  return "chrome-extension://\(sauber)/"
}

// 1 · Herkunft prüfen, bevor irgendetwas gelesen wird.
let herkunft = CommandLine.arguments.dropFirst().first ?? ""
guard let erlaubt = erlaubteHerkunft(), herkunft == erlaubt else {
  exit(1)
}

// 2 · `hallo` mit Einmalwert und Nutzer.
guard
  let hallo = lesen(),
  hallo["typ"] as? String == "hallo",
  hallo["protokoll"] as? Int == protokoll,
  let nonce = hallo["nonce"] as? String, !nonce.isEmpty, nonce.count <= 128,
  let nutzer = hallo["nutzer"] as? String, !nutzer.isEmpty
else {
  schreiben(["typ": "fehler", "grund": "hallo_erwartet"])
  exit(1)
}
schreiben([
  "typ": "hallo",
  "protokoll": protokoll,
  "nonce": nonce,
  "version": fassung,
  "macos": ProcessInfo.processInfo.operatingSystemVersionString,
])

// Die Übergabegeneration dieser Verbindung: die Sitzungsmarke des Begleiters zu Beginn.
let verbindungsMarke = aktuelleMarke()

// 3 · Karten annehmen, bis widerrufen wird oder die Verbindung endet.
while let nachricht = lesen() {
  switch nachricht["typ"] as? String {
  case "karte":
    // Nur unter einer angemeldeten Begleitersitzung, und nur, wenn es NOCH dieselbe ist wie zu
    // Beginn dieser Verbindung. Eine verspätete Übergabe nach einem Sitzungswechsel wird abgelehnt.
    guard
      nachricht["nutzer"] as? String == nutzer,
      let folge = nachricht["folge"] as? Int,
      let kartenFassung = nachricht["fassung"] as? String,
      let marke = verbindungsMarke, aktuelleMarke() == marke,
      ablegen(nachricht, marke: marke)
    else {
      schreiben(["typ": "abgelehnt"])
      continue
    }
    schreiben(["typ": "angenommen", "folge": folge, "fassung": kartenFassung])
  case "verwerfen":
    // Die übergebene Karte gilt in der Erweiterung nicht mehr (Tabwechsel, Navigation,
    // Quelländerung, neue Erfassung): sofort weg, die Verbindung bleibt. Keine Antwort — die
    // Erweiterung wartet hier auf nichts.
    verwerfen()
  case "widerrufen":
    verwerfen()
    exit(0)
  default:
    schreiben(["typ": "abgelehnt"])
  }
}
// Chrome hat die Verbindung beendet (Leiste zu, Erweiterung neu geladen, Widerruf): Karte weg.
verwerfen()
exit(0)
