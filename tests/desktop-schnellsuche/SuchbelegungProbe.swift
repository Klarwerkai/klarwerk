import Foundation

@main
struct SuchbelegungProbe {
    static func main() throws {
        func belegung(_ code: String, _ taste: String, _ strg: Bool, _ alt: Bool, _ umschalt: Bool, _ meta: Bool) throws -> Suchbelegung {
            let daten = try JSONSerialization.data(withJSONObject: ["code": code, "taste": taste,
                "strg": strg, "alt": alt, "umschalt": umschalt, "meta": meta])
            return try JSONDecoder().decode(Suchbelegung.self, from: daten)
        }
        let deutsch = try belegung("KeyZ", "Y", true, false, false, true)
        precondition(deutsch.erlaubt && Suchbelegung.tasten[deutsch.code] == 6)
        precondition(deutsch.beschriftung == "⌃⌘Y")
        let u = try belegung("KeyU", "U", false, false, true, true)
        precondition(u.erlaubt)
        for (code, taste, strg, alt, shift, meta) in [
            ("KeyK", "K", false, false, false, true),
            ("KeyE", "E", true, true, true, false),
            ("KeyW", "W", false, false, false, true),
            ("Digit4", "4", false, false, true, true),
            ("F5", "F5", false, false, true, true),
            ("KeyQ", "Q", true, false, false, true),
            ("F99", "F99", false, false, true, true),
        ] {
            let k = try belegung(code, taste, strg, alt, shift, meta)
            precondition(!k.erlaubt, "Geschützte Kombination wurde zugelassen")
        }
        print("10 native Entscheidungsproben bestanden; keine Registrierung und kein Fenster gestartet.")
    }
}
