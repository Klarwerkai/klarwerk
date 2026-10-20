// BPA-01 AC10 — DER KARTENVERBRAUCHER FÜR DEN GEMEINSAMEN BEGLEITER (O06: Host
// `produkt:20261010:klara-office-mac-maskottchen`, Kandidat ff96149e).
//
// Die Browserbrücke (`KlaraBrowserBruecke`) legt die gebundene Karte der Erweiterung in
// `~/Library/Application Support/Klarwerk/Begleiter/browserkontext.json` ab und löscht sie bei
// `verwerfen`, `widerrufen` und Verbindungsende. Diese Bibliothek ist die Seite, die der Begleiter
// liest — und sie gibt eine Karte NUR frei, wenn sie zu seiner aktuellen Anmeldung passt:
//
//   · Nutzer:  `nutzer` der Karte == angemeldeter Klarwerk-Nutzer des Begleiters;
//   · Konto:   `mandant` der Karte == Klarwerk-Server, an dem der Begleiter angemeldet ist;
//   · Sitzung: jede Anmeldung bekommt eine neue zufällige SITZUNGSMARKE, die hier neben der Karte
//              abgelegt wird (`begleitersitzung`, 0600; bei Abmeldung gelöscht). Die Brücke liest
//              sie zu Beginn jeder Verbindung und legt eine Karte nur ab, wenn genau diese Marke noch
//              gilt — und schreibt sie in die Karte. Freigegeben wird nur eine Karte mit der
//              AKTUELLEN Marke. Eine neue Sitzung (auch desselben Nutzers am selben Server), eine
//              Abmeldung oder ein Kontowechsel sperrt damit alte Karten UND verspätete Übergaben
//              aus der früheren Sitzung (nacharbeit-13);
//   · Fassung: Folge und Fassung müssen vorhanden sein; was nicht passt, ist keine Karte.
//
// Gelöscht oder unlesbar heisst: KEINE Karte (nie die zuletzt gesehene). Die Datei muss diesem
// macOS-Konto gehören und darf nur für es lesbar sein (0600), sonst wird sie ignoriert.
//
// ANSCHLUSS IM HOST (nacharbeit-18/19): `apps/desktop/klara-begleiter/Sources/Steuerung.swift`.
// Der Host meldet die vom Server bestätigte Anmeldung (Nutzer + Sitzungsfingerabdruck) über
// `HostAnmeldungsFolge` an `anmelden(...)`; bei jedem gemeldeten Wechsel zuerst `anmelden(nil)`.
// `beiAenderung` zeigt die Karte bzw. leert die Anzeige; `beobachten()` beim Start, `anmelden(nil)`
// und `anhalten()` beim Beenden.
import Foundation

/// Die Karte, wie die Erweiterung sie übergeben hat — nur die angezeigten Felder.
public struct BrowserKarte: Equatable, Sendable {
  public let folge: Int
  public let fassung: String
  public let nutzer: String
  public let mandant: String
  public let url: String
  public let titel: String
  public let auswahl: String
  public let erfasstAm: String
  /// Wann die Brücke die Karte abgelegt hat (Sekunden seit 1970, Uhr dieses Macs).
  public let uebergebenAm: Double
}

/// Die Anmeldung des Begleiters, gegen die jede Karte geprüft wird.
public struct BegleiterAnmeldung: Equatable {
  public let nutzer: String
  /// Der Klarwerk-Server (Herkunft, z. B. `https://app.klarwerk.ai`).
  public let mandant: String
  /// Eine Kennung der Anmeldesitzung; jede neue Anmeldung hat eine neue.
  public let sitzung: String

  public init(nutzer: String, mandant: String, sitzung: String) {
    self.nutzer = nutzer
    self.mandant = mandant
    self.sitzung = sitzung
  }
}

/// Die Herkunft eines Klarwerk-Servers, wie die Erweiterung sie als `mandant` schreibt
/// (`https://app.klarwerk.ai`, mit Port nur, wenn einer angegeben ist). `nil` ohne Schema/Host.
public func klarwerkHerkunft(_ server: URL) -> String? {
  guard let schema = server.scheme?.lowercased(), let host = server.host?.lowercased(), !host.isEmpty
  else { return nil }
  if let port = server.port { return "\(schema)://\(host):\(port)" }
  return "\(schema)://\(host)"
}

/// Was der Server über die Anmeldung des Hosts bestätigt, wird hier zu `BegleiterAnmeldung`
/// (nacharbeit-19): Nutzer UND Sitzung kommen vom Server (`GET /api/me/klara/begleiter/sitzung`,
/// Fingerabdruck des Sitzungsmerkmals). Ein Ab- und Neuanmelden desselben Nutzers — auch ohne dass
/// der Host die Abmeldung je gesehen hat — ist damit eine ANDERE Sitzung und erzeugt eine neue
/// Sitzungsmarke in `BrowserKartenQuelle`. Was der Host nicht bestätigt bekommt, ist keine
/// Anmeldung (fail-closed).
public struct HostAnmeldungsFolge {
  public let mandant: String
  public private(set) var aktuell: BegleiterAnmeldung?

  public init(mandant: String) {
    self.mandant = mandant
  }

  /// Sofort entwerten — bei jedem gemeldeten Anmelde-/Sitzungswechsel, BEVOR nachgeprüft wird.
  public mutating func entwerten() {
    aktuell = nil
  }

  /// Die vom Server bestätigte Anmeldung — `nil` oder leer heisst abgemeldet bzw. nicht
  /// feststellbar.
  public mutating func bestaetigt(nutzer: String?, sitzung: String?) -> BegleiterAnmeldung? {
    guard let nutzer, !nutzer.isEmpty, let sitzung, !sitzung.isEmpty else {
      aktuell = nil
      return nil
    }
    let neu = BegleiterAnmeldung(nutzer: nutzer, mandant: mandant, sitzung: sitzung)
    aktuell = neu
    return neu
  }
}

public final class BrowserKartenQuelle {
  /// Wird bei jeder Änderung aufgerufen: die freigegebene Karte oder `nil` (keine/ungültig).
  public var beiAenderung: ((BrowserKarte?) -> Void)?
  public private(set) var anmeldung: BegleiterAnmeldung?

  private let ablage: URL
  private var beobachter: DispatchSourceFileSystemObject?
  private var ordnerKennung: Int32 = -1
  private var zuletzt: BrowserKarte?
  /// Die Marke der aktuellen Anmeldesitzung; `nil` = abgemeldet. Nur Karten mit ihr gelten.
  private(set) var sitzungsmarke: String?
  /// Hier liest die Brücke die Marke (neben der Karte).
  let markenDatei: URL

  public static var standardAblage: URL {
    FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/Klarwerk/Begleiter", isDirectory: true)
      .appendingPathComponent("browserkontext.json")
  }

  public init(ablage: URL = BrowserKartenQuelle.standardAblage) {
    self.ablage = ablage
    self.markenDatei = ablage.deletingLastPathComponent().appendingPathComponent("begleitersitzung")
  }

  deinit { anhalten() }

  /// Neue Anmeldung, neue Sitzung, Abmeldung (`nil`) oder Kontowechsel: neue Sitzungsmarke (bzw.
  /// keine). Alte Karten und verspätete Übergaben aus der früheren Sitzung tragen die alte Marke
  /// und bleiben gesperrt — auch wenn Nutzer und Server gleich bleiben.
  public func anmelden(_ neu: BegleiterAnmeldung?) {
    if neu != anmeldung {
      anmeldung = neu
      if neu == nil {
        sitzungsmarke = nil
        try? FileManager.default.removeItem(at: markenDatei)
      } else {
        let marke = UUID().uuidString
        // Erst die Marke ablegen, dann gelten lassen: schlägt das Ablegen fehl, gilt KEINE Marke.
        sitzungsmarke = markeAblegen(marke) ? marke : nil
      }
    }
    // Dieselbe Prüfung wie überall.
    melde(aktuell())
  }

  /// Die freigegebene Karte — oder `nil`, wenn keine da ist oder sie nicht zur Anmeldung UND zur
  /// aktuellen Sitzungsmarke passt. Diese eine Prüfung benutzen `anmelden`, `beobachten` und der
  /// Dateibeobachter.
  public func aktuell() -> BrowserKarte? {
    guard let anmeldung, let marke = sitzungsmarke, sicherAbgelegt(ablage),
      let daten = try? Data(contentsOf: ablage),
      daten.count <= 1_048_576,
      let roh = (try? JSONSerialization.jsonObject(with: daten)) as? [String: Any],
      roh["typ"] as? String == "karte",
      let folge = roh["folge"] as? Int,
      let fassung = roh["fassung"] as? String, !fassung.isEmpty,
      let nutzer = roh["nutzer"] as? String, nutzer == anmeldung.nutzer,
      let mandant = roh["mandant"] as? String, mandant == anmeldung.mandant,
      let url = roh["url"] as? String,
      let auswahl = roh["auswahl"] as? String,
      // Sitzungsbindung: nur eine Übergabe unter GENAU der aktuellen Sitzungsmarke.
      roh["sitzungsmarke"] as? String == marke
    else { return nil }
    let uebergebenAm = (roh["uebergebenAm"] as? NSNumber)?.doubleValue ?? 0
    return BrowserKarte(
      folge: folge,
      fassung: fassung,
      nutzer: nutzer,
      mandant: mandant,
      url: url,
      titel: (roh["titel"] as? String) ?? "",
      auswahl: auswahl,
      erfasstAm: (roh["erfasstAm"] as? String) ?? "",
      uebergebenAm: uebergebenAm)
  }

  /// Beobachtet den Ablageordner; jede Änderung (auch das Löschen) wird sofort gemeldet.
  public func beobachten() {
    anhalten()
    let ordner = ablage.deletingLastPathComponent()
    try? FileManager.default.createDirectory(
      at: ordner, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    ordnerKennung = open(ordner.path, O_EVTONLY)
    guard ordnerKennung >= 0 else { return }
    let quelle = DispatchSource.makeFileSystemObjectSource(
      fileDescriptor: ordnerKennung, eventMask: [.write, .delete, .rename], queue: .main)
    quelle.setEventHandler { [weak self] in
      guard let self else { return }
      self.melde(self.aktuell())
    }
    quelle.setCancelHandler { [weak self] in
      guard let self, self.ordnerKennung >= 0 else { return }
      close(self.ordnerKennung)
      self.ordnerKennung = -1
    }
    beobachter = quelle
    quelle.resume()
    melde(aktuell())
  }

  public func anhalten() {
    beobachter?.cancel()
    beobachter = nil
  }

  /// Die Sitzungsmarke ablegen — nur für dieses macOS-Konto lesbar (0600), atomar.
  private func markeAblegen(_ marke: String) -> Bool {
    let ordner = markenDatei.deletingLastPathComponent()
    do {
      try FileManager.default.createDirectory(
        at: ordner, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
      try Data(marke.utf8).write(to: markenDatei, options: [.atomic])
      try FileManager.default.setAttributes(
        [.posixPermissions: 0o600], ofItemAtPath: markenDatei.path)
      return true
    } catch {
      try? FileManager.default.removeItem(at: markenDatei)
      return false
    }
  }

  /// Nur eine Datei dieses macOS-Kontos, die niemand sonst lesen kann, gilt.
  private func sicherAbgelegt(_ datei: URL) -> Bool {
    guard let werte = try? FileManager.default.attributesOfItem(atPath: datei.path),
      let besitzer = werte[.ownerAccountID] as? NSNumber,
      let rechte = werte[.posixPermissions] as? NSNumber
    else { return false }
    return besitzer.uint32Value == getuid() && (rechte.intValue & 0o077) == 0
  }

  private func melde(_ karte: BrowserKarte?) {
    guard karte != zuletzt else { return }
    zuletzt = karte
    beiAenderung?(karte)
  }
}
