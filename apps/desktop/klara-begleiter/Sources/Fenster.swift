// =================================================================================================
// KLARA-OFFICE-02 · DAS FENSTER DER FIGUR — schwebend, randlos, auf allen Spaces und im Vollbild.
// =================================================================================================
//
// Ein `NSPanel`, das NICHT aktiviert: die Figur liegt über Word und Chrome, ohne ihnen beim Anklicken
// den Fokus zu nehmen. Es erscheint auf jedem Space und neben Vollbild-Apps
// (`.canJoinAllSpaces`, `.fullScreenAuxiliary`) und gehört nicht in den Fensterwechsel (Cmd-`).
// Durchsichtig: in der Lage FIGUR ist es nur so gross wie die Figur selbst.
import AppKit
import WebKit

final class FigurPanel: NSPanel {
    /// Kein eigener Initialisierer (dann erbt die Klasse alle von NSPanel); erzeugt wird über diese
    /// Fabrik, eingerichtet in `einrichten()`.
    static func neu(rahmen: NSRect) -> FigurPanel {
        let panel = FigurPanel(
            contentRect: rahmen,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.einrichten()
        return panel
    }

    private func einrichten() {
        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        hidesOnDeactivate = false
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        isMovableByWindowBackground = false
        isReleasedWhenClosed = false
    }

    // Tastatureingaben (Pfeiltasten an der Figur, Texteingabe im Gespräch) brauchen ein Schlüsselfenster.
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// Der WKWebView mit EINER Besonderheit: in der Fläche der Figur („Griff", von der Webfläche
/// gemeldet) gehört die Maus der App — dort wird das Fenster gezogen. Ein Klick ohne Bewegung ist
/// ein Klick auf die Figur und geht als Befehl an die Webfläche zurück.
final class GriffWebView: WKWebView {
    /// Der Griff in Seitenkoordinaten (CSS-Pixel, Ursprung oben links).
    var griff: CGRect = .zero
    var beiZiehen: ((_ dx: CGFloat, _ dy: CGFloat) -> Void)?
    var nachZiehen: (() -> Void)?
    var beiKlick: (() -> Void)?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    private func imGriff(_ event: NSEvent) -> Bool {
        guard griff.width > 0, griff.height > 0 else { return false }
        let p = convert(event.locationInWindow, from: nil)
        let y = isFlipped ? p.y : bounds.height - p.y
        return griff.contains(CGPoint(x: p.x, y: y))
    }

    override func mouseDown(with event: NSEvent) {
        guard imGriff(event), let fenster = window else {
            super.mouseDown(with: event)
            return
        }
        let start = NSEvent.mouseLocation
        var bewegt = false
        var zuletzt = start
        while let e = fenster.nextEvent(matching: [.leftMouseDragged, .leftMouseUp]) {
            let jetzt = NSEvent.mouseLocation
            if !bewegt && abs(jetzt.x - start.x) + abs(jetzt.y - start.y) > 3 {
                bewegt = true
            }
            if bewegt {
                beiZiehen?(jetzt.x - zuletzt.x, jetzt.y - zuletzt.y)
                zuletzt = jetzt
            }
            if e.type == .leftMouseUp {
                break
            }
        }
        if bewegt {
            nachZiehen?()
        } else {
            beiKlick?()
        }
    }
}
