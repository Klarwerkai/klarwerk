// produkt:20261011:assistenz-programmadapter (BPA-04) — DER BEGRENZTE BEDIENUNGSHILFE-WEG.
//
// EIN Zweck: die Markierung im vordersten Fenster des zuletzt benutzten Programms LESEN. Kein Klick,
// keine Eingabe, keine Bildschirmkoordinate, kein Bildschirmbild, keine Texterkennung. Gemeldet wird
// nur, was die Bedienungshilfe-Schnittstelle selbst liefert: Programm und Fassung, wie viele
// Hauptfenster und fokussierte Elemente in Frage kommen, die Rolle des Elements und `AXSelectedText`.
// Ob gelesen werden darf, entscheidet der Server (`bewerteBedienungshilfeLesen`): nur für Word für
// Mac, nur bei genau einem Fenster und Element, nur mit Freigabe — sonst Stopp oder Klärung.
//
// Die Freigabe wird nie still angefordert: `freigabeAnfragen()` läuft nur auf Klick. Wird sie in den
// Systemeinstellungen entzogen, meldet `freigegeben` sofort `false`, und der Server stoppt.
import AppKit
import ApplicationServices

enum Bedienungshilfe {
  static var freigegeben: Bool { AXIsProcessTrusted() }

  /// Die Programme mit eingetragenem Lesezweck — Spiegel von `bedienungshilfeLesen` im Register
  /// (`services/app/src/programmadapter.ts`). Geprüft VOR jedem Inhaltszugriff; der Server prüft
  /// dieselbe Regel noch einmal.
  static let freigegebeneLesehosts: Set<String> = ["com.microsoft.Word"]

  static func istFreigegebenerLesehost(_ programm: NSRunningApplication) -> Bool {
    guard let bundleId = programm.bundleIdentifier else { return false }
    return freigegebeneLesehosts.contains(bundleId)
  }

  static func nichtFreigegebenSatz(_ programm: NSRunningApplication) -> String {
    let name = programm.localizedName ?? programm.bundleIdentifier ?? "Dieses Programm"
    return "\(name) ist für das Lesen über die Bedienungshilfe nicht freigegeben. "
      + "Klara hat dort nichts gelesen und nichts gesendet. Freigegeben ist nur Word für Mac."
  }

  /// Öffnet den Systemdialog „Bedienungshilfen" — nur auf ausdrücklichen Klick.
  static func freigabeAnfragen() {
    let schluessel = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
    _ = AXIsProcessTrustedWithOptions([schluessel: true] as CFDictionary)
  }

  /// Die Beobachtung und eine opake Kennung des vordersten Fensters (Titel gehasht) — oder `nil`,
  /// wenn das Programm keinen freigegebenen Lesezweck hat. Dann wird KEIN Attribut gelesen: weder
  /// Fenster noch Titel noch Markierung.
  static func beobachten(_ programm: NSRunningApplication) -> (Beobachtung, fenster: String)? {
    guard istFreigegebenerLesehost(programm) else { return nil }
    let bundleId = programm.bundleIdentifier ?? ""
    let fassung = programm.bundleURL
      .flatMap { Bundle(url: $0)?.infoDictionary?["CFBundleShortVersionString"] as? String } ?? ""
    guard freigegeben else {
      let leer = Beobachtung(
        bundleId: bundleId,
        hostVersion: fassung,
        fensterTreffer: 0,
        elementTreffer: 0,
        rolle: "",
        markierung: nil
      )
      return (leer, "")
    }
    let app = AXUIElementCreateApplication(programm.processIdentifier)
    let hauptfenster = (wert(app, kAXWindowsAttribute) as? [AnyObject] ?? [])
      .compactMap(element)
      .filter { (wert($0, kAXMainAttribute) as? Bool) == true }
    let fokusFenster = wert(app, kAXFocusedWindowAttribute).flatMap(element)
    let titel = fokusFenster.flatMap { wert($0, kAXTitleAttribute) as? String } ?? ""
    let fokus = wert(app, kAXFocusedUIElementAttribute).flatMap(element)
    let rolle = fokus.flatMap { wert($0, kAXRoleAttribute) as? String } ?? ""
    let markierung = fokus.flatMap { wert($0, kAXSelectedTextAttribute) as? String }
    let beobachtung = Beobachtung(
      bundleId: bundleId,
      hostVersion: fassung,
      fensterTreffer: fokusFenster == nil ? 0 : max(hauptfenster.count, 1),
      elementTreffer: fokus == nil || markierung == nil ? 0 : 1,
      rolle: rolle,
      markierung: markierung
    )
    let fensterKennung = titel.isEmpty
      ? ""
      : "fenster-" + FinderAufnahme.sha256(Data("\(bundleId)|\(titel)".utf8)).prefix(32)
    return (beobachtung, fensterKennung)
  }

  private static func wert(_ element: AXUIElement, _ attribut: String) -> AnyObject? {
    var ergebnis: AnyObject?
    let status = AXUIElementCopyAttributeValue(element, attribut as CFString, &ergebnis)
    return status == .success ? ergebnis : nil
  }

  private static func element(_ objekt: AnyObject) -> AXUIElement? {
    guard CFGetTypeID(objekt) == AXUIElementGetTypeID() else { return nil }
    return (objekt as! AXUIElement)
  }
}
