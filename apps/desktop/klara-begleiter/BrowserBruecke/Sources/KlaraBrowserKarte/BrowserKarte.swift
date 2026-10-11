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
//   · Sitzung: eine Karte gilt nur, wenn die Brücke sie NACH dem Beginn der aktuellen
//              Anmeldesitzung übergeben hat (`uebergebenAm` > Sitzungsbeginn, beides die Uhr dieses
//              Macs). Jede neue Anmeldung — auch eine neue Sitzung desselben Nutzers am selben
//              Server —, jede Abmeldung und jeder Kontowechsel leert sie sofort und SPERRT jede
//              schon abgelegte Karte, bis eine frische Übergabe kommt (nacharbeit-12);
//   · Fassung: Folge und Fassung müssen vorhanden sein; was nicht passt, ist keine Karte.
//
// Gelöscht oder unlesbar heisst: KEINE Karte (nie die zuletzt gesehene). Die Datei muss diesem
// macOS-Konto gehören und darf nur für es lesbar sein (0600), sonst wird sie ignoriert.
//
// ANSCHLUSS IM HOST (zwei Stellen, s. docs/operations/klara/browser-kontextkarten.md):
//   1. Wenn die Webfläche `/begleiter` ihre Anmeldung meldet (oder Abmeldung), ruft der Host
//      `quelle.anmelden(Anmeldung(...))` bzw. `quelle.anmelden(nil)`.
//   2. `quelle.beiAenderung = { karte in … }` reicht die freigegebene Karte (oder `nil`) an die
//      Webfläche weiter; `quelle.beobachten()` startet das Beobachten der Ablage.
import Foundation

/// Die Karte, wie die Erweiterung sie übergeben hat — nur die angezeigten Felder.
public struct BrowserKarte: Equatable {
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

public final class BrowserKartenQuelle {
  /// Wird bei jeder Änderung aufgerufen: die freigegebene Karte oder `nil` (keine/ungültig).
  public var beiAenderung: ((BrowserKarte?) -> Void)?
  public private(set) var anmeldung: BegleiterAnmeldung?

  private let ablage: URL
  private var beobachter: DispatchSourceFileSystemObject?
  private var ordnerKennung: Int32 = -1
  private var zuletzt: BrowserKarte?
  /// Beginn der aktuellen Anmeldesitzung; `nil` = abgemeldet. Nur danach übergebene Karten gelten.
  private var sitzungsBeginn: Double?
  private let uhr: () -> Double

  public static var standardAblage: URL {
    FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/Klarwerk/Begleiter", isDirectory: true)
      .appendingPathComponent("browserkontext.json")
  }

  public init(
    ablage: URL = BrowserKartenQuelle.standardAblage,
    uhr: @escaping () -> Double = { Date().timeIntervalSince1970 }
  ) {
    self.ablage = ablage
    self.uhr = uhr
  }

  deinit { anhalten() }

  /// Neue Anmeldung, neue Sitzung, Abmeldung (`nil`) oder Kontowechsel: die bisherige Karte gilt
  /// nicht mehr. Eine schon abgelegte Karte bleibt GESPERRT, bis die Brücke eine frische übergibt —
  /// auch wenn Nutzer und Server gleich bleiben.
  public func anmelden(_ neu: BegleiterAnmeldung?) {
    if neu != anmeldung {
      anmeldung = neu
      sitzungsBeginn = neu == nil ? nil : uhr()
    }
    // Dieselbe Prüfung wie überall: vor dem Sitzungsbeginn übergebene Karten bleiben gesperrt.
    melde(aktuell())
  }

  /// Die freigegebene Karte — oder `nil`, wenn keine da ist oder sie nicht zur Anmeldung UND zur
  /// Sitzung passt. Diese eine Prüfung benutzen `anmelden`, `beobachten` und der Dateibeobachter.
  public func aktuell() -> BrowserKarte? {
    guard let anmeldung, let beginn = sitzungsBeginn, sicherAbgelegt(),
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
      // Sitzungsbindung: nur eine Übergabe NACH dem Beginn dieser Anmeldesitzung.
      let uebergebenAm = (roh["uebergebenAm"] as? NSNumber)?.doubleValue,
      uebergebenAm > beginn
    else { return nil }
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

  /// Nur eine Datei dieses macOS-Kontos, die niemand sonst lesen kann, ist eine Karte.
  private func sicherAbgelegt() -> Bool {
    guard let werte = try? FileManager.default.attributesOfItem(atPath: ablage.path),
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
