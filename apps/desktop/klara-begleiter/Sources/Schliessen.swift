// =================================================================================================
// UI-MIN-06/14 · WANN SCHLIESSEN AUSBLENDEN DARF — reine Entscheidung, ohne Fenster.
// =================================================================================================
//
// produkt:20261011:assistenz-minimalistische-oberflaeche (Ben, Nacharbeit 47): Schließen darf keinen
// laufenden Vorgang samt Stopp verstecken. Ausgeblendet wird deshalb NUR, wenn die Webfläche auf
// GENAU DIESE Anfrage geantwortet hat und danach „kein laufender Vorgang“ meldet. Weder ein lokal
// gesetzter Modus („figur“) noch eine verstrichene Zeit gelten als Bestätigung. Bleibt die Antwort
// aus (ältere oder hängende Webfläche), bleibt die Figur mit dem stehen, was die Webfläche zeigt,
// und das Statusmenü sagt, dass Schließen wartet. Ein erneutes Schließen fragt neu nach — es blendet
// nicht sofort aus.
//
// Nur ohne geladene eigene Webfläche (keine Verbindung, Fehlerseite) läuft dort kein Vorgang, den
// man stoppen könnte; dann wird sofort ausgeblendet.
struct Schliessvorgang {
    enum Schritt: Equatable {
        /// Sofort ausblenden — es gibt keine Webfläche mit laufenden Vorgängen.
        case ausblenden
        /// Die Webfläche mit dieser Anfragenummer nach ihren laufenden Vorgängen fragen und warten.
        case nachfragen(Int)
    }

    /// Schließen ist angefordert und noch nicht ausgeführt.
    private(set) var wartet = false
    /// Nummer der jüngsten Anfrage; nur deren Antwort bestätigt.
    private(set) var anfrage = 0
    /// Die Antwort auf die jüngste Anfrage ist eingegangen.
    private(set) var bestaetigt = false

    mutating func anfordern(webflaecheBereit: Bool) -> Schritt {
        guard webflaecheBereit else {
            aufheben()
            return .ausblenden
        }
        wartet = true
        bestaetigt = false
        anfrage += 1
        return .nachfragen(anfrage)
    }

    /// Eine Meldung der Webfläche: Anzahl laufender Vorgänge, als Antwort auf `antwortAuf` oder als
    /// spätere Änderung. `true` heisst: jetzt ausblenden.
    mutating func meldung(anzahl: Int, antwortAuf: Int?) -> Bool {
        guard wartet else { return false }
        if let nummer = antwortAuf {
            // Eine veraltete Antwort (auf eine frühere Anfrage) bestätigt nichts.
            guard nummer == anfrage else { return false }
            bestaetigt = true
        } else if !bestaetigt {
            // Änderungen VOR der Antwort können älter sein als die Anfrage.
            return false
        }
        guard anzahl == 0 else { return false }
        aufheben()
        return true
    }

    /// Bewusst wieder geöffnet oder ausgeblendet: nichts wartet mehr.
    mutating func aufheben() {
        wartet = false
        bestaetigt = false
    }
}
