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

/// Die native Kopfleiste bleibt auch bei einer fehlenden oder hängenden Webverbindung bedienbar.
/// In der kleinen Figurenansicht verdeckt sie weder den Avatar noch dessen Ziehgriff.
final class BegleitInhalt: NSView {
    let webView: GriffWebView
    private let kopf = NSVisualEffectView()
    private let beenden: NSButton
    private let titel = NSTextField(labelWithString: FigurPanel.neutralerName)
    private let einstieg = BegleitEinstieg()
    var webBereit = false { didSet { needsLayout = true } }
    func setzeName(_ name: String) { titel.stringValue = name }
    var figur = false {
        didSet { needsLayout = true }
    }

    init(webView: GriffWebView, ziel: AnyObject, aktion: Selector, oeffnen: Selector) {
        self.webView = webView
        beenden = NSButton(title: "Klara beenden", target: ziel, action: aktion)
        super.init(frame: webView.frame)
        autoresizingMask = [.width, .height]
        kopf.material = .headerView
        kopf.blendingMode = .withinWindow
        kopf.state = .active
        titel.font = .systemFont(ofSize: 13, weight: .semibold)
        titel.lineBreakMode = .byTruncatingTail
        kopf.addSubview(titel)
        beenden.bezelStyle = .rounded
        beenden.font = .systemFont(ofSize: 12)
        beenden.keyEquivalent = "q"
        beenden.keyEquivalentModifierMask = [.command]
        beenden.toolTip = "Klara vollständig beenden (⌘Q)"
        beenden.setAccessibilityHelp("Beendet die Klara-App. Gespräch schließen blendet dagegen nur das Gespräch aus.")
        kopf.addSubview(beenden)
        addSubview(webView)
        addSubview(kopf)
        einstieg.target = ziel
        einstieg.action = oeffnen
        einstieg.bezelStyle = .regularSquare
        einstieg.isBordered = false
        einstieg.image = NSImage(systemSymbolName: "bubble.left.fill", accessibilityDescription: "Klara öffnen")
        einstieg.imageScaling = .scaleProportionallyUpOrDown
        einstieg.toolTip = "Klara öffnen · Ziehen zum Verschieben"
        einstieg.setAccessibilityLabel("Klara öffnen")
        einstieg.beiZiehen = { dx, dy in webView.beiZiehen?(dx, dy) }
        einstieg.nachZiehen = { webView.nachZiehen?() }
        addSubview(einstieg)
    }

    required init?(coder: NSCoder) { nil }

    override func layout() {
        super.layout()
        let hoehe: CGFloat = figur ? 0 : 36
        let ersatz = figur && !webBereit
        einstieg.isHidden = !ersatz
        einstieg.frame = bounds.insetBy(dx: 16, dy: 16)
        webView.isHidden = ersatz
        kopf.isHidden = figur
        kopf.frame = NSRect(x: 0, y: bounds.height - hoehe, width: bounds.width, height: hoehe)
        titel.frame = NSRect(x: 12, y: 9, width: max(0, bounds.width - 152), height: 18)
        beenden.frame = NSRect(x: max(0, bounds.width - 124), y: 4, width: 116, height: 28)
        webView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: max(0, bounds.height - hoehe))
    }
}

/// Vor der Anmeldung oder bei Verbindungsfehlern gibt es noch keinen Web-Avatar.
/// Derselbe Host behält dann einen erreichbaren nativen Einstieg; kein verkleinertes Anmeldeformular.
final class BegleitEinstieg: NSButton {
    var beiZiehen: ((_ dx: CGFloat, _ dy: CGFloat) -> Void)?
    var nachZiehen: (() -> Void)?
    override func mouseDown(with event: NSEvent) {
        guard let fenster = window else { return }
        let start = NSEvent.mouseLocation
        var zuletzt = start
        var bewegt = false
        while let e = fenster.nextEvent(matching: [.leftMouseDragged, .leftMouseUp]) {
            let jetzt = NSEvent.mouseLocation
            if abs(jetzt.x - start.x) + abs(jetzt.y - start.y) > 3 { bewegt = true }
            if bewegt { beiZiehen?(jetzt.x - zuletzt.x, jetzt.y - zuletzt.y) }
            zuletzt = jetzt
            if e.type == .leftMouseUp { break }
        }
        if bewegt { nachZiehen?() }
        else if let action { NSApp.sendAction(action, to: target, from: self) }
    }
}

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

    // MARK: MACOS-20261014 · MAC-02 — Standardbedienung im Gespräch
    //
    // Die FIGUR bleibt randlos und schwebend (oben). Das GESPRÄCH ist ein gewöhnliches Mac-Fenster:
    // Titelleiste „Klara“ zum Verschieben, Schließen, Minimieren (= zur Figur einklappen) und
    // tatsächliche Größenänderung — keine nachgebauten Knöpfe, sondern die des Systems.

    static let gespraechMaske: NSWindow.StyleMask = [
        .titled, .closable, .miniaturizable, .resizable, .nonactivatingPanel,
    ]
    static let figurMaske: NSWindow.StyleMask = [.borderless, .nonactivatingPanel]
    /// Kleinste Gesprächsgröße — die Eingabe bleibt erreichbar (UI-MIN-02: 320 Pixel Breite).
    static let gespraechMindestgroesse = CGSize(width: 320, height: 420)

    /// Gelber Knopf bzw. ⌘M: Klara klappt zur Figur ein (eine Menüleisten-App hat kein Dock-Symbol,
    /// in das ein Fenster verkleinert werden könnte).
    var beiEinklappen: (() -> Void)?
    /// ⌘W (BUG-KLARA-WINDOW-02, Original 90314201): Schließen auch ohne aktives Hauptmenü.
    var beiSchliessen: (() -> Void)?

    override func performMiniaturize(_ sender: Any?) {
        beiEinklappen?()
    }

    override func miniaturize(_ sender: Any?) {
        beiEinklappen?()
    }

    /// Ein nicht aktivierendes Panel kann Schlüsselfenster sein, während die App nicht aktiv ist —
    /// dann erreicht das Hauptmenü ⌘W/⌘M nicht. Hier wirken sie in jedem Fall, genau einmal.
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let tasten = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if tasten == .command, let zeichen = event.charactersIgnoringModifiers?.lowercased() {
            if zeichen == "w" {
                beiSchliessen?()
                return true
            }
            if zeichen == "m" && styleMask.contains(.titled) {
                beiEinklappen?()
                return true
            }
            // MAC-04/UI-05 (Nacharbeit 54): ⌘, öffnet die Einstellungen — der übliche Mac-Weg.
            if zeichen == "," {
                beiEinstellungen?()
                return true
            }
        }
        return super.performKeyEquivalent(with: event)
    }

    /// ⌘, (Nacharbeit 54 · MAC5-04): die vorhandenen Klara-Einstellungen öffnen.
    var beiEinstellungen: (() -> Void)?

    // MARK: Bewusste Bedienung (BUG-KLARA-WINDOW-02, Original 90314201)

    /// Zeitpunkt (Systemlaufzeit) der letzten Maus- oder Tastatureingabe IN diesem Fenster.
    private var letzteBedienung: TimeInterval = -1_000

    /// Kam die letzte Eingabe der Person in diesem Fenster gerade eben (Klick oder Taste)?
    /// Unterscheidet ein bewusstes Öffnen an der Figur von einem Seiten- oder Kontextwechsel.
    var kuerzlichBedient: Bool {
        ProcessInfo.processInfo.systemUptime - letzteBedienung < 2
    }

    override func sendEvent(_ event: NSEvent) {
        switch event.type {
        case .leftMouseDown, .rightMouseDown, .keyDown:
            letzteBedienung = ProcessInfo.processInfo.systemUptime
        default:
            break
        }
        super.sendEvent(event)
    }

    // MARK: UI-MIN-15 — der persönliche Name in der Titelleiste

    /// Neutral, bis die Webfläche den gewählten Namen aus dem Profil meldet (`art: "name"`).
    static let neutralerName = "Deine Assistenz"
    private(set) var anzeigeName = FigurPanel.neutralerName

    /// Übernimmt den Profilnamen; leer, zu lang oder mit Steuerzeichen gilt die neutrale Bezeichnung.
    func setzeName(_ roh: String?) {
        let name = Self.sichererName(roh)
        anzeigeName = name
        if styleMask.contains(.titled) {
            title = name
        }
        setAccessibilityLabel(name)
    }

    static func sichererName(_ roh: String?) -> String {
        let name = (roh ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name.count <= 40,
              !name.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
        else { return neutralerName }
        return name
    }

    /// Schaltet zwischen Figur (randlos, durchsichtig) und Gespräch (Mac-Fenster) um.
    func alsGespraech(_ an: Bool) {
        if an {
            styleMask = Self.gespraechMaske
            title = anzeigeName
            titleVisibility = .visible
            isOpaque = true
            backgroundColor = .windowBackgroundColor
            isMovable = true
            minSize = Self.gespraechMindestgroesse
        } else {
            styleMask = Self.figurMaske
            isOpaque = false
            backgroundColor = .clear
            // Die Figur wird über ihren Griff gezogen (`GriffWebView`), nicht über den Hintergrund.
            isMovable = false
            minSize = .zero
        }
    }
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
    /// BUG-KLARA-WINDOW-02 (Original 90314201): Rechtsklick in jeder Lage — auch auf einer fremden
    /// Seite oder in der randlosen Figur — bietet Schließen und Einklappen/Öffnen an.
    var fensterEintraege: (() -> [NSMenuItem])?

    override func rightMouseDown(with event: NSEvent) {
        if imGriff(event), let eintraege = fensterEintraege?() {
            let menu = NSMenu()
            eintraege.forEach { menu.addItem($0) }
            NSMenu.popUpContextMenu(menu, with: event, for: self)
        } else {
            super.rightMouseDown(with: event)
        }
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        super.willOpenMenu(menu, with: event)
        guard let eintraege = fensterEintraege?(), !eintraege.isEmpty else { return }
        menu.insertItem(.separator(), at: 0)
        for eintrag in eintraege.reversed() {
            menu.insertItem(eintrag, at: 0)
        }
    }

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
