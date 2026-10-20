// produkt:20261011:assistenz-programmadapter (BPA-04) — DER FINDER-WEG: GENAU EINE GEWÄHLTE DATEI.
//
// Der Systemdialog erlaubt genau eine Datei — keinen Ordner, keine Mehrfachauswahl. Gelesen wird
// ausschliesslich die URL, die der Dialog zurückgibt; Nachbardateien werden nie aufgezählt oder
// geöffnet. Die Datei wird weder verschoben noch geändert noch gelöscht.
//
// Ist die Datei nicht (mehr) lesbar — Dateirechte entzogen, Datenschutz-Freigabe für Ordner
// zurückgenommen, Datei während der Aufnahme verschwunden —, meldet der Begleiter
// `dateizugriff: false` OHNE Inhalt. Der Server stoppt dann mit seinem Satz; es gibt keinen
// Umweg über ein Bildschirmbild. Der Pfad geht nie an den Server, nur eine opake Kennung.
import AppKit
import CryptoKit
import UniformTypeIdentifiers

enum FinderAufnahme {
  @MainActor
  static func waehlen() -> URL? {
    let dialog = NSOpenPanel()
    dialog.allowsMultipleSelection = false
    dialog.canChooseDirectories = false
    dialog.canChooseFiles = true
    dialog.resolvesAliases = true
    dialog.message = "Genau eine Datei auswählen, die Klara aufnehmen soll."
    dialog.prompt = "Aufnehmen"
    return dialog.runModal() == .OK ? dialog.url : nil
  }

  static func aufnehmen(
    url: URL,
    server: Server,
    sitzung: String,
    hostKonto: String
  ) async throws -> FinderErgebnis {
    let zugriff = url.startAccessingSecurityScopedResource()
    defer {
      if zugriff { url.stopAccessingSecurityScopedResource() }
    }
    let schluessel: Set<URLResourceKey> = [
      .fileResourceIdentifierKey, .volumeIdentifierKey, .fileSizeKey,
      .contentModificationDateKey, .nameKey, .contentTypeKey,
    ]
    let werte = try? url.resourceValues(forKeys: schluessel)
    let dateiId = opakeKennung(url: url, werte: werte)
    let groesse = werte?.fileSize ?? 0

    // Gelesen wird NUR diese eine URL — und nur, wenn das System sie lesbar meldet.
    var inhalt = Data()
    var lesbar = FileManager.default.isReadableFile(atPath: url.path)
    if lesbar {
      if let daten = try? Data(contentsOf: url) {
        inhalt = daten
      } else {
        lesbar = false
      }
    }

    let fassung = sha256(inhalt)
    let ziel = Ziel(
      programm: "finder",
      sitzung: sitzung,
      hostKonto: hostKonto,
      objekt: dateiId,
      auswahl: "",
      fassung: fassung
    )
    let bindung = try await server.verbinden(ziel)
    let geaendert = werte?.contentModificationDate ?? Date()
    let meldung = DateiMeldung(
      dateiId: dateiId,
      name: werte?.name ?? url.lastPathComponent,
      groesse: lesbar ? inhalt.count : groesse,
      geaendertAm: ISO8601DateFormatter().string(from: geaendert),
      mime: werte?.contentType?.preferredMIMEType ?? "application/octet-stream",
      inhalt: lesbar ? inhalt.base64EncodedString() : ""
    )
    let rechte = Rechte(
      bedienungshilfe: Bedienungshilfe.freigegeben,
      dateizugriff: lesbar,
      bildschirmaufnahme: false
    )
    return try await server.finder(bindung: bindung, aktuell: ziel, rechte: rechte, datei: meldung)
  }

  /// Volume- und Dateikennung des Systems, gehasht — kein Pfad, kein Benutzername.
  static func opakeKennung(url: URL, werte: URLResourceValues?) -> String {
    let datei = werte?.fileResourceIdentifier.map { "\($0)" } ?? url.standardizedFileURL.path
    let volume = werte?.volumeIdentifier.map { "\($0)" } ?? ""
    return "datei-" + sha256(Data("\(volume)|\(datei)".utf8)).prefix(32)
  }

  static func sha256(_ daten: Data) -> String {
    SHA256.hash(data: daten).map { String(format: "%02x", $0) }.joined()
  }
}
