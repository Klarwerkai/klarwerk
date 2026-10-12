// BPA-01 AC03/AC08/AC10 (nacharbeit-21) — DER MENÜABSCHNITT DER BROWSERKARTE IM BEGLEITER.
//
// Der Host (`Steuerung.swift`) zeigt die freigegebene Karte im Menü der Menüleiste. Diese Klasse
// führt genau diese Einträge und ersetzt sie AN ORT UND STELLE bei jeder Kartenänderung — auch
// während das Menü offen ist. Bei `nil` (entwertet, widerrufen, abgemeldet, Sitzungswechsel)
// verschwinden Titel, Seite, Fassung, Auswahl UND das gespeicherte Quellziel sofort; die alten
// Einträge verlieren dabei Ziel, Aktion und Quell-URL, sodass auch ein noch gehaltener Verweis auf
// sie nichts mehr öffnen kann. Die Prüfung beim Klick (Karte gilt noch, dieselbe Seite) bleibt
// Sache des Hosts.
#if canImport(AppKit)
  import AppKit

  /// Kürzt auf eine Zeile mit höchstens `laenge` Zeichen.
  public func kartenKurz(_ text: String, _ laenge: Int) -> String {
    let einzeilig = text.split(whereSeparator: \.isNewline).joined(separator: " ")
    return einzeilig.count > laenge ? String(einzeilig.prefix(laenge)) + "…" : einzeilig
  }

  @MainActor
  public final class KartenMenueAbschnitt {
    /// Die aktuell im Menü stehenden Einträge dieses Abschnitts (in dieser Reihenfolge).
    public private(set) var eintraege: [NSMenuItem] = []
    private weak var menue: NSMenu?
    private weak var ziel: AnyObject?
    private let oeffnenAktion: Selector

    /// `ziel`/`oeffnenAktion`: wer „Quelle im Browser öffnen" ausführt (mit Klickprüfung).
    public init(ziel: AnyObject, oeffnenAktion: Selector) {
      self.ziel = ziel
      self.oeffnenAktion = oeffnenAktion
    }

    /// Beim Neuaufbau des Menüs: den Abschnitt ans Ende anhängen und sich die Lage merken.
    public func anhaengen(an menue: NSMenu, karte: BrowserKarte?) {
      self.menue = menue
      eintraege = baue(karte)
      for item in eintraege { menue.addItem(item) }
    }

    /// Bei JEDER Kartenänderung: die vorhandenen Einträge an derselben Stelle ersetzen — wirkt
    /// auch im geöffneten Menü. Ohne aufgebautes Menü gibt es nichts zu ersetzen; der nächste
    /// Aufbau liest die Karte ohnehin frisch.
    public func aktualisieren(karte: BrowserKarte?) {
      guard let menue, let erster = eintraege.first else { return }
      let lage = menue.index(of: erster)
      for item in eintraege {
        entwerten(item)
        if menue.index(of: item) >= 0 { menue.removeItem(item) }
      }
      eintraege = baue(karte)
      guard lage >= 0 else {
        eintraege = []
        return
      }
      for (versatz, item) in eintraege.enumerated() {
        menue.insertItem(item, at: min(lage + versatz, menue.numberOfItems))
      }
    }

    /// Ein entfernter Eintrag trägt nichts mehr: kein Ziel, keine Aktion, keine Quell-URL.
    private func entwerten(_ item: NSMenuItem) {
      item.representedObject = nil
      item.action = nil
      item.target = nil
      item.isEnabled = false
    }

    private func zeile(_ titel: String) -> NSMenuItem {
      let item = NSMenuItem(title: titel, action: nil, keyEquivalent: "")
      item.isEnabled = false
      return item
    }

    private func baue(_ karte: BrowserKarte?) -> [NSMenuItem] {
      guard let karte else { return [zeile("Browserkarte: keine")] }
      let seite = URL(string: karte.url)
      var neu = [
        zeile("Browserkarte: \(kartenKurz(karte.titel.isEmpty ? karte.url : karte.titel, 60))"),
        zeile("Seite: \(seite?.host ?? karte.url) · Fassung \(karte.fassung.prefix(12))"),
        zeile("Auswahl: \(kartenKurz(karte.auswahl, 80))"),
      ]
      if let seite, seite.scheme == "https" || seite.scheme == "http", let ziel {
        let oeffnen = NSMenuItem(
          title: "Quelle im Browser öffnen", action: oeffnenAktion, keyEquivalent: "")
        oeffnen.target = ziel
        oeffnen.isEnabled = true
        oeffnen.representedObject = seite
        neu.append(oeffnen)
      }
      return neu
    }
  }
#endif
