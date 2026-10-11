// KLARA-OFFICE-02 · Einstieg der Begleitapp. Eine Menüleisten-App (LSUIElement): kein Dock-Symbol,
// ein schwebendes Fenster mit der Figur, ein Klara-Symbol in der Menüleiste.
import AppKit

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let steuerung = Begleitsteuerung()
    app.delegate = steuerung
    _ = app.setActivationPolicy(.accessory)
    app.run()
}
