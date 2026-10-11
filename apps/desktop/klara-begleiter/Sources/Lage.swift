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

    /// Schiebt den Rahmen VOLLSTÄNDIG auf die Fläche seines Bildschirms. Ist er grösser als die
    /// Fläche, bleibt die obere linke Ecke sichtbar (dort sitzt die Figur).
    static func eingepasst(_ rahmen: CGRect, in sichtbar: [CGRect]) -> CGRect {
        guard let flaeche = bildschirm(fuer: rahmen, in: sichtbar) else {
            return rahmen
        }
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

    /// Wiederfinden: auf den Bildschirm des Mauszeigers, neben den Zeiger.
    static func beimZeiger(_ zeiger: CGPoint, groesse: CGSize, in sichtbar: [CGRect]) -> CGRect {
        let r = CGRect(
            x: zeiger.x + 16,
            y: zeiger.y - groesse.height - 16,
            width: groesse.width,
            height: groesse.height
        )
        return eingepasst(r, in: sichtbar)
    }
}
