// =================================================================================================
// KLARA-OFFICE-02 · DIE LAGE DER FIGUR — reine Geometrie, ohne Fenster.
// =================================================================================================
//
// Die Figur muss auf JEDEM angeschlossenen Bildschirm erreichbar bleiben: nach Ziehen, Pfeiltasten,
// Bildschirmwechsel, geänderter Auflösung oder Skalierung, abgezogenem Monitor und im Vollbild. Die
// Regel steht hier einmal, als reine Funktionen über Rechtecken (AppKit-Koordinaten: Ursprung unten
// links, y nach oben). `sichtbar` sind die nutzbaren Bildschirmflächen (`NSScreen.visibleFrame`, also
// ohne Menüleiste und Dock).
import CoreGraphics

enum Lage {
    /// Abstand zum Rand beim Andocken und Zurücksetzen.
    static let rand: CGFloat = 12

    /// Übernommen aus BUG-KLARA-WINDOW-02 (Original 90314201): eine Fenstergrösse, die auf die
    /// Fläche passt (mit Rand) — auf kleinen Bildschirmen, nach Skalierung oder Monitorwechsel liegen
    /// Titelleiste und Bedienelemente nie ausserhalb.
    static func begrenzt(_ groesse: CGSize, auf flaeche: CGRect) -> CGSize {
        CGSize(
            width: max(1, min(groesse.width, flaeche.width - rand * 2)),
            height: max(1, min(groesse.height, flaeche.height - rand * 2))
        )
    }

    /// Der Bildschirm, dessen Fläche die Mitte des Rahmens enthält — sonst der nächstgelegene.
    static func bildschirm(fuer rahmen: CGRect, in sichtbar: [CGRect]) -> CGRect? {
        let mitte = CGPoint(x: rahmen.midX, y: rahmen.midY)
        if let treffer = sichtbar.first(where: { $0.contains(mitte) }) {
            return treffer
        }
        return sichtbar.min(by: { abstand(mitte, $0) < abstand(mitte, $1) })
    }

    /// Quadrierter Abstand eines Punktes zu einem Rechteck (0, wenn er darin liegt).
    static func abstand(_ p: CGPoint, _ r: CGRect) -> CGFloat {
        let dx = max(r.minX - p.x, 0, p.x - r.maxX)
        let dy = max(r.minY - p.y, 0, p.y - r.maxY)
        return dx * dx + dy * dy
    }

    /// Der Bildschirm, auf dem ein PUNKT liegt (z. B. der Mauszeiger) — sonst der nächstgelegene.
    static func bildschirm(am punkt: CGPoint, in sichtbar: [CGRect]) -> CGRect? {
        if let treffer = sichtbar.first(where: { $0.contains(punkt) }) {
            return treffer
        }
        return sichtbar.min(by: { abstand(punkt, $0) < abstand(punkt, $1) })
    }

    /// Schiebt den Rahmen VOLLSTÄNDIG auf die Fläche seines Bildschirms. Ist er grösser als die
    /// Fläche, bleibt die obere linke Ecke sichtbar (dort sitzt die Figur).
    static func eingepasst(_ rahmen: CGRect, in sichtbar: [CGRect]) -> CGRect {
        guard let flaeche = bildschirm(fuer: rahmen, in: sichtbar) else {
            return rahmen
        }
        return eingepasst(rahmen, auf: flaeche)
    }

    /// BUG-KLARA-WINDOW-02 · Grösse UND Lage auf die Fläche seines Bildschirms: ein gross gezogenes
    /// Gespräch, das auf einen kleineren Bildschirm kommt (Ziehen, Monitorwechsel, Skalierung),
    /// wird auf dessen Fläche verkleinert — Titelleiste und Knöpfe liegen nie ausserhalb.
    static func vollstaendigSichtbar(_ rahmen: CGRect, in sichtbar: [CGRect]) -> CGRect {
        guard let flaeche = bildschirm(fuer: rahmen, in: sichtbar) else {
            return rahmen
        }
        return aufFlaeche(rahmen, flaeche)
    }

    /// Verkleinert (nie vergrössert) auf die Fläche — die obere linke Ecke bleibt — und schiebt
    /// den Rahmen dann vollständig hinein. Zweimal angewandt ändert sich nichts mehr.
    static func aufFlaeche(_ rahmen: CGRect, _ flaeche: CGRect) -> CGRect {
        let breite = max(1, min(rahmen.width, flaeche.width))
        let hoehe = max(1, min(rahmen.height, flaeche.height))
        let r = CGRect(x: rahmen.minX, y: rahmen.maxY - hoehe, width: breite, height: hoehe)
        return eingepasst(r, auf: flaeche)
    }

    /// Schiebt den Rahmen auf genau diese Fläche (ohne Grössenänderung).
    static func eingepasst(_ rahmen: CGRect, auf flaeche: CGRect) -> CGRect {
        var r = rahmen
        if r.maxX > flaeche.maxX { r.origin.x = flaeche.maxX - r.width }
        if r.minX < flaeche.minX { r.origin.x = flaeche.minX }
        if r.minY < flaeche.minY { r.origin.y = flaeche.minY }
        if r.maxY > flaeche.maxY { r.origin.y = flaeche.maxY - r.height }
        return r
    }

    /// Ein um (dx, dy) verschobener Rahmen; dy in BILDSCHIRMRICHTUNG (positiv = nach unten), wie
    /// die Webfläche ihn meldet. Danach eingepasst.
    static func verschoben(_ rahmen: CGRect, dx: CGFloat, dy: CGFloat, in sichtbar: [CGRect]) -> CGRect {
        eingepasst(rahmen.offsetBy(dx: dx, dy: -dy), in: sichtbar)
    }

    /// Am linken oder rechten Rand des eigenen Bildschirms angedockt; die Höhe bleibt.
    static func angedockt(_ rahmen: CGRect, rechts: Bool, in sichtbar: [CGRect]) -> CGRect {
        guard let flaeche = bildschirm(fuer: rahmen, in: sichtbar) else {
            return rahmen
        }
        var r = rahmen
        r.origin.x = rechts ? flaeche.maxX - r.width - rand : flaeche.minX + rand
        return eingepasst(r, in: sichtbar)
    }

    /// Die Grundposition: unten rechts auf dem Hauptbildschirm.
    static func grundposition(groesse: CGSize, haupt: CGRect) -> CGRect {
        CGRect(
            x: haupt.maxX - groesse.width - rand * 2,
            y: haupt.minY + rand * 2,
            width: groesse.width,
            height: groesse.height
        )
    }

    /// Wechsel zwischen Figur und Gespräch: die OBERE LINKE Ecke (dort steht die Figur in beiden
    /// Lagen) bleibt, wo sie ist; danach eingepasst.
    static func umgeformt(_ rahmen: CGRect, auf groesse: CGSize, in sichtbar: [CGRect]) -> CGRect {
        let oben = rahmen.maxY
        let r = CGRect(x: rahmen.minX, y: oben - groesse.height, width: groesse.width, height: groesse.height)
        return eingepasst(r, in: sichtbar)
    }

    /// Wiederfinden: auf den Bildschirm des Mauszeigers, neben den Zeiger. Massgeblich ist der
    /// ZIELbildschirm am Zeiger — Grösse und Lage werden auf dessen Fläche begrenzt, nicht auf
    /// die des bisherigen (BUG-KLARA-WINDOW-02, Original 90314201).
    static func beimZeiger(_ zeiger: CGPoint, groesse: CGSize, in sichtbar: [CGRect]) -> CGRect {
        let r = CGRect(
            x: zeiger.x + 16,
            y: zeiger.y - groesse.height - 16,
            width: groesse.width,
            height: groesse.height
        )
        guard let ziel = bildschirm(am: zeiger, in: sichtbar) else {
            return r
        }
        return aufFlaeche(r, ziel)
    }
}
