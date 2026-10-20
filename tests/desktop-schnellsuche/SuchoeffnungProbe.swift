@main
struct SuchoeffnungProbe {
    struct Sitzung: Equatable {
        let nutzer: String
        let mandant: String
        let sitzung: String
    }

    static func main() {
        let sitzung = Sitzung(nutzer: "j-fiktiv", mandant: "test.invalid", sitzung: "sitzung-a")
        let taste = "KeyU:ctrl+cmd"
        var faelle = 0
        func pruefe(_ name: String, _ fall: () -> Void) {
            fall()
            faelle += 1
            print("OK \(faelle): \(name)")
        }
        func neu() -> Suchoeffnung<Sitzung, String> { Suchoeffnung() }

        pruefe("gewöhnliche Bestätigung öffnet ohne Benutzerabsicht nichts") {
            var weg = neu()
            let n = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: n, sitzung: sitzung, belegung: taste))
        }
        pruefe("passende frische Bestätigung öffnet genau einmal") {
            var weg = neu()
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let n = weg.abgleichBeginnen()
            precondition(weg.bestaetigen(auf: n, sitzung: sitzung, belegung: taste))
            precondition(!weg.bestaetigen(auf: n, sitzung: sitzung, belegung: taste))
            let spaeter = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: spaeter, sitzung: sitzung, belegung: taste))
        }
        for altZuerst in [true, false] {
            pruefe("J-CODE-1: überholender Kontrollabruf, alte Antwort \(altZuerst ? "zuerst" : "zuletzt")") {
                var weg = neu()
                weg.anfordern(sitzung: sitzung, belegung: taste)
                let hotkey = weg.abgleichBeginnen()
                let takt = weg.abgleichBeginnen()
                if altZuerst {
                    precondition(!weg.bestaetigen(auf: hotkey, sitzung: sitzung, belegung: taste))
                }
                precondition(weg.bestaetigen(auf: takt, sitzung: sitzung, belegung: taste))
                if !altZuerst {
                    precondition(!weg.bestaetigen(auf: hotkey, sitzung: sitzung, belegung: taste))
                }
                precondition(!weg.bestaetigen(auf: takt, sitzung: sitzung, belegung: taste))
            }
        }
        pruefe("mehrere überholende Takt-/Menüabfragen verlieren die Absicht nicht") {
            var weg = neu()
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let hotkey = weg.abgleichBeginnen()
            let takt = weg.abgleichBeginnen()
            let menue = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: takt, sitzung: nil, belegung: nil))
            precondition(!weg.bestaetigen(auf: hotkey, sitzung: sitzung, belegung: taste))
            precondition(weg.bestaetigen(auf: menue, sitzung: sitzung, belegung: taste))
        }
        pruefe("Entwertung sperrt alte Antwort und spätere identische Wiederanmeldung") {
            var weg = neu()
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let alt = weg.abgleichBeginnen()
            weg.entwerten()
            precondition(!weg.bestaetigen(auf: alt, sitzung: sitzung, belegung: taste))
            let wieder = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: wieder, sitzung: sitzung, belegung: taste))
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let bewusstNeu = weg.abgleichBeginnen()
            precondition(weg.bestaetigen(auf: bewusstNeu, sitzung: sitzung, belegung: taste))
        }
        for anders in [
            Sitzung(nutzer: "anderer-fiktiver-nutzer", mandant: sitzung.mandant, sitzung: sitzung.sitzung),
            Sitzung(nutzer: sitzung.nutzer, mandant: "anderer.test.invalid", sitzung: sitzung.sitzung),
            Sitzung(nutzer: sitzung.nutzer, mandant: sitzung.mandant, sitzung: "sitzung-b"),
        ] {
            pruefe("aktuelle abweichende Sitzung verwirft ohne Wiederbelebung: \(anders)") {
                var weg = neu()
                weg.anfordern(sitzung: sitzung, belegung: taste)
                let n = weg.abgleichBeginnen()
                precondition(!weg.bestaetigen(auf: n, sitzung: anders, belegung: taste))
                let zurueck = weg.abgleichBeginnen()
                precondition(!weg.bestaetigen(auf: zurueck, sitzung: sitzung, belegung: taste))
            }
        }
        for andereTaste: String? in ["KeyI:ctrl+cmd", nil] {
            pruefe("aktuell geänderte/entfernte Belegung verwirft ohne Wiederbelebung") {
                var weg = neu()
                weg.anfordern(sitzung: sitzung, belegung: taste)
                let n = weg.abgleichBeginnen()
                precondition(!weg.bestaetigen(auf: n, sitzung: sitzung, belegung: andereTaste))
                let zurueck = weg.abgleichBeginnen()
                precondition(!weg.bestaetigen(auf: zurueck, sitzung: sitzung, belegung: taste))
            }
        }
        pruefe("aktuell fehlende Sitzungsbestätigung verwirft die Absicht") {
            var weg = neu()
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let n = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: n, sitzung: nil, belegung: taste))
            let spaeter = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: spaeter, sitzung: sitzung, belegung: taste))
        }
        pruefe("alte passende Antwort öffnet nach aktueller Ablehnung nicht") {
            var weg = neu()
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let alt = weg.abgleichBeginnen()
            let aktuell = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: aktuell, sitzung: sitzung, belegung: nil))
            precondition(!weg.bestaetigen(auf: alt, sitzung: sitzung, belegung: taste))
        }
        pruefe("mehrfach angefordert, zuletzt frisch bestätigt: eine Öffnung") {
            var weg = neu()
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let alt = weg.abgleichBeginnen()
            weg.anfordern(sitzung: sitzung, belegung: taste)
            let aktuell = weg.abgleichBeginnen()
            precondition(!weg.bestaetigen(auf: alt, sitzung: sitzung, belegung: taste))
            precondition(weg.bestaetigen(auf: aktuell, sitzung: sitzung, belegung: taste))
            precondition(!weg.bestaetigen(auf: aktuell, sitzung: sitzung, belegung: taste))
        }
        print("\(faelle) reine Suchabsichts-Gegenfälle bestanden; keine App, Anmeldung oder Carbon-Registrierung gestartet.")
    }
}
