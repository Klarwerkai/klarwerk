import AppKit
import Carbon

/// Nur die bewusst gespeicherte Suchbelegung. Kein Monitor für fremde Tastatureingaben.
struct Suchbelegung: Codable, Equatable {
    let code: String
    let taste: String
    let strg: Bool
    let alt: Bool
    let umschalt: Bool
    let meta: Bool

    // KeyboardEvent.code bezeichnet die physische Taste, unabhängig von DE/EN-Beschriftung.
    static let tasten: [String: UInt32] = [
        "KeyA": 0, "KeyS": 1, "KeyD": 2, "KeyF": 3, "KeyH": 4, "KeyG": 5,
        "KeyZ": 6, "KeyX": 7, "KeyC": 8, "KeyV": 9, "KeyB": 11, "KeyQ": 12,
        "KeyW": 13, "KeyE": 14, "KeyR": 15, "KeyY": 16, "KeyT": 17,
        "Digit1": 18, "Digit2": 19, "Digit3": 20, "Digit4": 21, "Digit6": 22,
        "Digit5": 23, "Digit9": 25, "Digit7": 26, "Digit8": 28, "Digit0": 29,
        "KeyO": 31, "KeyU": 32, "KeyI": 34, "KeyP": 35, "KeyL": 37,
        "KeyJ": 38, "KeyK": 40, "KeyN": 45, "KeyM": 46,
        "F1": 122, "F2": 120, "F3": 99, "F4": 118, "F5": 96, "F6": 97,
        "F7": 98, "F8": 100, "F9": 101, "F10": 109, "F11": 103, "F12": 111,
    ]

    var erlaubt: Bool {
        guard Self.tasten[code] != nil, strg || meta, !(strg && alt),
              !taste.isEmpty, taste.count <= 12,
              !taste.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
        else { return false }
        // Dieselben bestehenden Konfliktgrenzen wie im Klara-Setup, auch für API-Belegungen.
        let zeichen = [code.replacingOccurrences(of: "Key", with: "")
            .replacingOccurrences(of: "Digit", with: ""), taste.uppercased()]
        func trifft(_ liste: String) -> Bool { zeichen.contains { $0.count == 1 && liste.contains($0) } }
        if trifft("K") || ["F4", "F5", "F11", "F12"].contains(code) { return false }
        if strg != meta && !alt && !umschalt { return false }
        if meta && umschalt && trifft("3456") { return false }
        if strg != meta && umschalt && !alt && trifft("ABCDFGHIJLMNOPQRSTVWYZ") { return false }
        if meta && alt && trifft("BCDFHIJLMNPTUVW") { return false }
        if meta && strg && trifft("DFQ") { return false }
        return true
    }

    var modifikatoren: UInt32 {
        (strg ? UInt32(controlKey) : 0) | (alt ? UInt32(optionKey) : 0)
            | (umschalt ? UInt32(shiftKey) : 0) | (meta ? UInt32(cmdKey) : 0)
    }
    var beschriftung: String {
        "\(strg ? "⌃" : "")\(alt ? "⌥" : "")\(umschalt ? "⇧" : "")\(meta ? "⌘" : "")\(taste)"
    }
}

@MainActor
final class Suchkuerzel {
    private var registrierung: EventHotKeyRef?
    private var handler: EventHandlerRef?
    private(set) var belegung: Suchbelegung?
    private(set) var status = "Suchkürzel: nicht eingerichtet"
    var beiSuche: (() -> Void)?

    func setzen(_ neu: Suchbelegung?) {
        if neu == belegung && (neu == nil || registrierung != nil) { return }
        entfernen()
        guard let neu else { return }
        guard neu.erlaubt, let taste = Suchbelegung.tasten[neu.code] else {
            status = "Suchkürzel: Kombination nicht verfügbar"
            return
        }
        var typ = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let zeiger = Unmanaged.passUnretained(self).toOpaque()
        let erfolg = InstallEventHandler(GetApplicationEventTarget(), { _, event, daten in
            guard let event, let daten else { return OSStatus(eventNotHandledErr) }
            var id = EventHotKeyID()
            guard GetEventParameter(event, EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &id) == noErr,
                id.signature == 0x4B4C5355, id.id == 1 else { return OSStatus(eventNotHandledErr) }
            MainActor.assumeIsolated {
                Unmanaged<Suchkuerzel>.fromOpaque(daten).takeUnretainedValue().beiSuche?()
            }
            return noErr
        }, 1, &typ, zeiger, &handler)
        guard erfolg == noErr else { status = "Suchkürzel: Registrierung fehlgeschlagen (\(erfolg))"; return }
        let ergebnis = RegisterEventHotKey(taste, neu.modifikatoren,
            EventHotKeyID(signature: 0x4B4C5355, id: 1), GetApplicationEventTarget(), 0, &registrierung)
        guard ergebnis == noErr else {
            entfernen()
            status = "Suchkürzel: nicht verfügbar (\(ergebnis))"
            return
        }
        belegung = neu
        status = "Suche systemweit: \(neu.beschriftung)"
    }

    func entfernen() {
        if let registrierung { UnregisterEventHotKey(registrierung) }
        if let handler { RemoveEventHandler(handler) }
        registrierung = nil
        handler = nil
        belegung = nil
        status = "Suchkürzel: nicht eingerichtet"
    }
}
