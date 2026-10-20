/// Eine angenommene Suchabsicht überlebt gewöhnliche Kontrollabfragen, aber keine Entwertung.
/// Reine Entscheidung: keine Anmeldung, Registrierung oder Fensterbedienung.
struct Suchoeffnung<Sitzung: Equatable, Belegung: Equatable> {
    /// Wie bisher darf nur die jüngste begonnene Abfrage eine Antwort übernehmen.
    private(set) var abfrage = 0
    private var absicht: (sitzung: Sitzung, belegung: Belegung)?

    mutating func anfordern(sitzung: Sitzung, belegung: Belegung) {
        absicht = (sitzung, belegung)
    }

    mutating func abgleichBeginnen() -> Int {
        abfrage += 1
        return abfrage
    }

    /// Nur eine aktuelle passende Bestätigung löst ein; eine aktuelle Abweichung verwirft.
    /// Alte Antworten dürfen weder öffnen noch eine noch ausstehende Absicht verbrauchen.
    mutating func bestaetigen(auf antwort: Int, sitzung: Sitzung?, belegung: Belegung?) -> Bool {
        guard antwort == abfrage else { return false }
        guard let absicht else { return false }
        self.absicht = nil
        return sitzung == absicht.sitzung && belegung == absicht.belegung
    }

    mutating func entwerten() {
        abfrage += 1
        absicht = nil
    }
}
