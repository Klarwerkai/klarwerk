// =================================================================================================
// KLARA-OFFICE-02 · DIE STEUERUNG DER BEGLEITAPP — Fenster, Menüleiste, Tastenkürzel, Webfläche.
// =================================================================================================
//
// Die App hält GENAU ein Fenster (`FigurPanel`) mit der Webfläche `<Server>/begleiter`. Sie liest
// selbst nichts aus Word, Chrome oder vom Bildschirm: den Office-Kontext bekommt die Webfläche vom
// Office-Adapter über den Server (`/api/me/klara/begleiter/*`). Die App braucht deshalb weder
// Bildschirmaufnahme noch Bedienungshilfen; Mikrofon/Spracherkennung fragt macOS erst, wenn die
// Webfläche diktieren will.
//
// KEIN AUTOSTART: die App legt keinen Anmeldeeintrag, keinen LaunchAgent und keinen Hintergrunddienst
// an. Sie läuft, solange sie gestartet ist, und endet über „Beenden" in der Menüleiste.
//
// BPA-01 AC10 (nacharbeit-18) · DIE BROWSERKARTE IM GEMEINSAMEN HOST. Quelle dieser Datei ist
// `Sources/Steuerung.swift` aus ff96149e (sha256 e18932b5…); ergänzt sind nur die mit „BPA-01"
// markierten Stellen. Die App liest weiterhin nichts aus Chrome: die Karte legt die Browserbrücke ab
// (`BrowserBruecke`), `BrowserKartenQuelle` gibt sie nur unter der aktuellen Anmeldung frei.
//   · Anmeldung: die Anmeldung der Webfläche (Sitzung am Klarwerk-Server). Der Host fragt sie
//     selbst ab (`/api/me/klara/begleiter/sitzung` in einer eigenen Skriptwelt: Nutzer UND
//     Sitzungsfingerabdruck) — beim Öffnen des Menüs, alle 30 Sekunden und nach jedem gemeldeten
//     Wechsel. Ein gemeldeter Wechsel (Meldung `anmeldung` der Webfläche, Navigation, Neuladen,
//     offline) entwertet SOFORT, vor der Nachfrage (nacharbeit-19). Abgemeldet, offline oder nicht
//     feststellbar heisst `anmelden(nil)`: Marke weg, keine Karte.
//   · Anzeige: im Menü (immer frisch über `aktuell()`) und als Ereignis an die Webfläche;
//     `nil` leert beides sofort.
//   · Lebenszyklus: `beobachten()` beim Start, `anmelden(nil)` und `anhalten()` beim Beenden.
// Dazu die BPA-04-Funktionen (Finder, Markierung in Word) im Fenster „In anderen Programmen …".
//
// MACOS-20261014 · MAC-01/02 — übernommene Fensterkorrekturen aus BUG-KLARA-WINDOW-02
// (produkt:20261013:klara-fenster-bedienfehler, Original 90314201, Vergleich
// HILFE/d6ff826cd221f2d95193): Monitorwechsel/Skalierung begrenzen Grösse UND Lage, Wiederfinden auf
// dem Bildschirm des Zeigers, Wiederöffnen über den App-Start, „geschlossen bleibt geschlossen“
// (auch über einen Neustart), „eingeklappt bleibt eingeklappt“ bis zur eigenen Eingabe der Person,
// Rechtsklick-Einträge und ehrlicher Kürzelstatus. Browserkarte/BPA-01/BPA-04 bleiben aus der
// aktuellen Produktbasis erhalten.
//
// UI-MIN-06/14 (Ben, Nacharbeit 46): Schließen versteckt keinen laufenden Vorgang. Laufen Frage,
// Vorlesen oder eine Word-Aktion, klappt Schließen zur Figur MIT je einem Stopp ein; ausgeblendet
// wird erst, wenn die Webfläche auf die Anfrage geantwortet hat und keinen laufenden Vorgang mehr
// meldet (Nacharbeit 47: kein lokaler Modus, keine Frist als Ersatz — `Schliessen.swift`).
import AppKit
import WebKit
import os

/// Diagnose der Wiedereinstiege im Host, ohne Inhalte: nur Zustände und Statuscodes. Lesen:
/// `log stream --predicate 'subsystem == "ai.klarwerk.klara-begleiter"'`.
let fensterProtokoll = Logger(subsystem: "ai.klarwerk.klara-begleiter", category: "fenster")

// `swift build`: eigenes Modul aus `BrowserBruecke`. `begleiter-bauen.sh` übersetzt dieselben
// Quellen in EIN Modul mit der App — dann gibt es nichts zu importieren.
#if canImport(KlaraBrowserKarte)
    import KlaraBrowserKarte
#endif

struct Einstellungen {
    let server: URL
    let fassung: String
    let bau: String

    /// Nur https — ausser für eine lokale Entwicklungsinstanz auf diesem Rechner.
    static func erlaubt(_ url: URL) -> Bool {
        if url.scheme == "https" { return true }
        return url.scheme == "http" && (url.host == "localhost" || url.host == "127.0.0.1")
    }

    static func ausBundle() -> Einstellungen {
        let info = Bundle.main.infoDictionary ?? [:]
        let vorgabe = URL(string: "https://app.klarwerk.ai")!
        let roh = (info["KlarwerkServer"] as? String) ?? vorgabe.absoluteString
        let server = URL(string: roh).flatMap { erlaubt($0) && $0.host != nil ? $0 : nil } ?? vorgabe
        return Einstellungen(
            server: server,
            fassung: sauber(info["CFBundleShortVersionString"] as? String ?? "0.0.0"),
            bau: sauber(info["CFBundleVersion"] as? String ?? "0")
        )
    }

    /// Nur Zeichen, die eine Fassung tragen darf — sie landet in einem Skript der Seite.
    static func sauber(_ wert: String) -> String {
        let erlaubt = Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.+_-")
        let s = String(wert.filter { erlaubt.contains($0) }.prefix(40))
        return s.isEmpty ? "0" : s
    }
}

@MainActor
final class Begleitsteuerung: NSObject, NSApplicationDelegate, NSMenuDelegate, WKScriptMessageHandler,
    WKNavigationDelegate, WKUIDelegate, NSWindowDelegate
{
    static let figurGroesse = CGSize(width: 96, height: 96)
    /// produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-06/14): eingeklappt MIT laufenden
    /// Vorgängen — Figur samt je einem Stopp pro Vorgang. Ohne Vorgang bleibt die Figur 96 × 96.
    static let figurVorgangGroesse = CGSize(width: 240, height: 236)
    static let gespraechGroesse = CGSize(width: 400, height: 640)

    private static func groesse(fuer modus: String) -> CGSize {
        switch modus {
        case "figur": return figurGroesse
        case "figur-vorgang": return figurVorgangGroesse
        default: return gemerkteGespraechGroesse() ?? gespraechGroesse
        }
    }

    /// MAC-02: die vom Menschen gezogene Gesprächsgröße gilt weiter — auch nach Einklappen und Neustart.
    private static func gemerkteGespraechGroesse() -> CGSize? {
        let d = UserDefaults.standard
        guard d.object(forKey: "gespraech.breite") != nil, d.object(forKey: "gespraech.hoehe") != nil
        else { return nil }
        let breite = max(FigurPanel.gespraechMindestgroesse.width, CGFloat(d.double(forKey: "gespraech.breite")))
        let hoehe = max(FigurPanel.gespraechMindestgroesse.height, CGFloat(d.double(forKey: "gespraech.hoehe")))
        return CGSize(width: breite, height: hoehe)
    }
    static let befehle: Set<String> = [
        "figur-klick", "gespraech-oeffnen", "gespraech-schliessen", "reduziert-an", "reduziert-aus",
        "vorgaenge-melden", "einstellungen-oeffnen",
    ]

    let einst = Einstellungen.ausBundle()
    private var panel: FigurPanel!
    private var webView: GriffWebView!
    private var fensterInhalt: BegleitInhalt!
    private var tastatur: Any?
    private var statusItem: NSStatusItem!
    private var modus = "gespraech"
    /// BUG-KLARA-WINDOW-02: „geschlossen“ ist eine bewusste Entscheidung und gilt auch nach Neustart.
    private var sichtbar = !UserDefaults.standard.bool(forKey: "klara.geschlossen")
    /// Die Person hat das Gespräch zur Figur eingeklappt; nur sie selbst öffnet es wieder.
    private var nutzerEingeklappt = false
    /// Wartet nach nativem Verschieben auf das Loslassen der Maustaste, um dann einzupassen.
    private var einpassTakt: Timer?
    /// UI-MIN-06/14: Schließen wartet auf die BESTÄTIGUNG der Webfläche, dass kein Vorgang läuft
    /// (`Schliessen.swift`) — bis dahin bleibt die Figur mit den Stopps der Webfläche sichtbar.
    private var schliessvorgang = Schliessvorgang()
    private var reduziert = false
    private var zustand = "ruhe"
    private var verbunden = false
    private var offline: String?
    private var webFassung: String?
    private var letzteWarBegleiter = false
    private var urlBeobachtung: NSKeyValueObservation?
    private var wiederholung: Timer?
    // BPA-01: Kartenverbraucher, Anmeldefolge und BPA-04-Fenster.
    private let kartenQuelle = BrowserKartenQuelle()
    private lazy var anmeldeFolge = HostAnmeldungsFolge(mandant: klarwerkHerkunft(einst.server) ?? "")
    private var anmeldeAbfrage = 0
    private var anmeldeTakt: Timer?
    private lazy var programme = ProgrammeFenster()
    // nacharbeit-21: der Menüabschnitt der Browserkarte — ersetzt seine Einträge bei jeder
    // Kartenänderung, auch im geöffneten Menü.
    private lazy var kartenMenue = KartenMenueAbschnitt(
        ziel: self, oeffnenAktion: #selector(browserQuelleOeffnen(_:)))

    private var begleiterURL: URL { einst.server.appendingPathComponent("begleiter") }

    // MARK: Start

    func applicationDidFinishLaunching(_ notification: Notification) {
        baueFenster()
        baueMenue()
        baueHauptmenue()
        // Option 1: keine automatische systemweite Registrierung; ⌃⌥ bleibt für VoiceOver frei.
        registriereFigurtasten()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(bildschirmeGeaendert),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
        browserKarteStarten()
        laden()
        if sichtbar {
            panel.orderFrontRegardless()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    // BPA-01: Beim Beenden gilt keine Sitzung mehr — die Brücke nimmt danach keine Karte an.
    func applicationWillTerminate(_ notification: Notification) {
        if let tastatur { NSEvent.removeMonitor(tastatur) }
        wiederholung?.invalidate()
        einpassTakt?.invalidate()
        anmeldeTakt?.invalidate()
        kartenQuelle.anmelden(nil)
        kartenQuelle.anhalten()
        programme.schliessen()
    }

    /// BUG-KLARA-WINDOW-02 · Bewusstes Wiederöffnen über den App-Start: Spotlight, Programme-Ordner
    /// oder Finder. macOS startet dabei keine zweite Instanz, sondern meldet der laufenden App
    /// „erneut öffnen“ — ohne Menüleistensymbol (kann hinter der Kamera-Aussparung liegen) und Kürzel.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        fensterProtokoll.notice("Wiederöffnen über App-Start; sichtbar vorher: \(self.sichtbar, privacy: .public)")
        gespraechOeffnen()
        return false
    }

    private func registriereFigurtasten() {
        // Nach dem Schließen des Gesprächs liegt der Web-Fokus nicht immer auf dem Avatar.
        // Nur in diesem App-Fenster und nur in Figurenansicht übernehmen wir die Pfeiltasten.
        tastatur = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            let behandelt = MainActor.assumeIsolated {
                guard let self, event.window === self.panel,
                      event.modifierFlags.intersection([.command, .control, .option]).isEmpty
                else { return false }
                if event.keyCode == 53, self.modus == "gespraech", !self.verbunden {
                    self.einklappen()
                    return true
                }
                guard self.modus == "figur" else { return false }
                let schritt: CGFloat = event.modifierFlags.contains(.shift) ? 60 : 12
                let dx: CGFloat
                let dy: CGFloat
                switch event.keyCode {
                case 123: (dx, dy) = (-schritt, 0)
                case 124: (dx, dy) = (schritt, 0)
                case 125: (dx, dy) = (0, schritt)
                case 126: (dx, dy) = (0, -schritt)
                default: return false
                }
                self.setzeRahmen(Lage.verschoben(self.panel.frame, dx: dx, dy: dy, in: self.flaechen()))
                return true
            }
            return behandelt ? nil : event
        }
    }

    private func flaechen() -> [CGRect] { NSScreen.screens.map(\.visibleFrame) }

    private func hauptflaeche() -> CGRect {
        (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
    }

    /// Das Gespräch passt immer auf den Bildschirm, auch auf einem kleinen.
    private func begrenzt(_ g: CGSize) -> CGSize {
        let f = Lage.bildschirm(fuer: panel?.frame ?? .zero, in: flaechen()) ?? hauptflaeche()
        return Lage.begrenzt(g, auf: f)
    }

    private func startRahmen() -> CGRect {
        let d = UserDefaults.standard
        let groesse = Self.groesse(fuer: "gespraech")
        if d.object(forKey: "lage.x") != nil, d.object(forKey: "lage.oben") != nil {
            let x = CGFloat(d.double(forKey: "lage.x"))
            let oben = CGFloat(d.double(forKey: "lage.oben"))
            let r = CGRect(x: x, y: oben - groesse.height, width: groesse.width, height: groesse.height)
            // Der gemerkte Bildschirm kann kleiner oder abgezogen sein: Grösse UND Lage begrenzen.
            return Lage.vollstaendigSichtbar(r, in: flaechen())
        }
        let figur = Lage.grundposition(groesse: Self.figurGroesse, haupt: hauptflaeche())
        return Lage.umgeformt(figur, auf: groesse, in: flaechen())
    }

    private func baueFenster() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "KlaraBegleiter/\(einst.fassung)"
        let inhalt = WKUserContentController()
        inhalt.add(self, name: "klaraBegleiter")
        // Was die App über sich sagt — vor dem ersten Skript der Seite, nur im Hauptrahmen.
        let skript =
            "window.__KLARA_BEGLEITER__ = Object.freeze({ fassung: \"\(einst.fassung)\", bau: \"\(einst.bau)\" });"
        inhalt.addUserScript(WKUserScript(source: skript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = inhalt

        let rahmen = startRahmen()
        panel = FigurPanel.neu(rahmen: rahmen)
        webView = GriffWebView(frame: NSRect(origin: .zero, size: rahmen.size), configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        webView.underPageBackgroundColor = .clear
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.beiZiehen = { [weak self] dx, dy in self?.ziehen(dx: dx, dy: dy) }
        webView.nachZiehen = { [weak self] in self?.zieheEnde() }
        webView.beiKlick = { [weak self] in self?.befehl("figur-klick") }
        webView.fensterEintraege = { [weak self] in self?.fensterEintraege() ?? [] }
        fensterInhalt = BegleitInhalt(webView: webView, ziel: self, aktion: #selector(beenden), oeffnen: #selector(gespraechOeffnen))
        panel.contentView = fensterInhalt
        // MAC-02: Systemknöpfe des Gesprächsfensters — Schließen, Einklappen, Größe.
        panel.delegate = self
        panel.beiEinklappen = { [weak self] in self?.einklappen() }
        panel.beiSchliessen = { [weak self] in self?.schliessen() }
        panel.beiEinstellungen = { [weak self] in self?.einstellungenOeffnen() }
        panel.alsGespraech(modus == "gespraech")
        urlBeobachtung = webView.observe(\.url, options: [.new]) { [weak self] wv, _ in
            let url = wv.url
            Task { @MainActor in self?.urlGeaendert(url) }
        }
    }

    // MARK: Lage

    private func merkeLage() {
        let d = UserDefaults.standard
        d.set(Double(panel.frame.minX), forKey: "lage.x")
        d.set(Double(panel.frame.maxY), forKey: "lage.oben")
    }

    private func setzeRahmen(_ r: CGRect) {
        panel.setFrame(r, display: true, animate: false)
        merkeLage()
    }

    private func ziehen(dx: CGFloat, dy: CGFloat) {
        // Während des Ziehens frei — auch über Bildschirmgrenzen; eingepasst wird beim Loslassen.
        panel.setFrameOrigin(NSPoint(x: panel.frame.minX + dx, y: panel.frame.minY + dy))
    }

    private func zieheEnde() {
        setzeRahmen(Lage.eingepasst(panel.frame, in: flaechen()))
    }

    /// `durchPerson`: ausgelöst von einer Eingabe der Person (Klick/Taste an der Figur, Menü,
    /// Kürzel) — nicht von einem Seiten-, Anmelde- oder Verbindungswechsel.
    private func setzeModus(_ neu: String, durchPerson: Bool) {
        guard neu == "figur" || neu == "figur-vorgang" || neu == "gespraech" else { return }
        if neu == "gespraech" && nutzerEingeklappt && !durchPerson {
            // BUG-KLARA-WINDOW-02: eingeklappt bleibt eingeklappt; die Webfläche folgt der Figur.
            befehl("gespraech-schliessen")
            return
        }
        if neu == "gespraech" {
            nutzerEingeklappt = false
            // Bewusst wieder geöffnet: ein noch wartendes Schließen gilt nicht mehr.
            schliessvorgang.aufheben()
        } else if durchPerson {
            nutzerEingeklappt = true
        }
        modus = neu
        fensterInhalt.figur = neu != "gespraech"
        panel.alsGespraech(neu == "gespraech")
        let groesse = begrenzt(Self.groesse(fuer: neu))
        if neu != "gespraech" && UserDefaults.standard.object(forKey: "lage.x") == nil {
            // Erster Start ohne gemerkte Lage: die Figur steht unten rechts auf dem Hauptbildschirm.
            setzeRahmen(Lage.grundposition(groesse: groesse, haupt: hauptflaeche()))
        } else {
            setzeRahmen(Lage.umgeformt(panel.frame, auf: groesse, in: flaechen()))
        }
        panel.hasShadow = neu == "gespraech"
        if neu == "gespraech" && sichtbar {
            // Das Gespräch nimmt Eingaben an; die Figur allein nimmt Word den Fokus nicht.
            NSApp.activate(ignoringOtherApps: true)
            panel.makeKeyAndOrderFront(nil)
        }
    }

    /// Bildschirm abgezogen, Auflösung oder Skalierung geändert: Grösse UND Lage passen wieder
    /// (BUG-KLARA-WINDOW-02). Die Figur wird nur verschoben, nie verkleinert.
    @objc private func bildschirmeGeaendert() {
        setzeRahmen(Lage.vollstaendigSichtbar(panel.frame, in: flaechen()))
    }

    @objc func zuruecksetzen() {
        let figur = Lage.grundposition(groesse: Self.figurGroesse, haupt: hauptflaeche())
        let groesse = begrenzt(Self.groesse(fuer: modus))
        setzeRahmen(Lage.umgeformt(figur, auf: groesse, in: flaechen()))
        einblenden()
    }

    @objc func linksAndocken() { andocken(rechts: false) }
    @objc func rechtsAndocken() { andocken(rechts: true) }

    private func andocken(rechts: Bool) {
        setzeRahmen(Lage.angedockt(panel.frame, rechts: rechts, in: flaechen()))
    }

    private func merkeSichtbar(_ an: Bool) {
        sichtbar = an
        UserDefaults.standard.set(!an, forKey: "klara.geschlossen")
    }

    @objc func einblenden() {
        merkeSichtbar(true)
        bildschirmeGeaendert()
        panel.orderFrontRegardless()
    }

    /// `orderOut`: kein Fenster, auch kein durchsichtiges, bleibt über der Arbeit liegen. Nur über
    /// `schliessen()` und die bestätigte Meldung der Webfläche (`Schliessvorgang`).
    private func ausblenden() {
        fensterProtokoll.notice("Klara geschlossen (ausgeblendet)")
        schliessvorgang.aufheben()
        merkeSichtbar(false)
        panel.orderOut(nil)
    }

    @objc func sichtbarUmschalten() {
        if sichtbar { schliessen() } else { einblenden() }
    }

    /// Menü „Figur wiederfinden“: die Figur einblenden und neben den Mauszeiger holen — auf dessen Bildschirm.
    func wiederfinden() {
        fensterProtokoll.notice("Wiederfinden ausgeführt; sichtbar vorher: \(self.sichtbar, privacy: .public)")
        merkeSichtbar(true)
        // Begrenzt wird in `Lage.beimZeiger` auf den ZIELbildschirm am Zeiger, nicht auf den bisherigen.
        setzeRahmen(Lage.beimZeiger(NSEvent.mouseLocation, groesse: panel.frame.size, in: flaechen()))
        panel.orderFrontRegardless()
    }

    /// Bewusstes Öffnen: auch dann gross, wenn die Webfläche gerade nicht antwortet.
    /// MAC-04/UI-05 (Ben, Nacharbeit 54 · MAC5-04): der übliche Mac-Weg „Einstellungen …“ (⌘,) im
    /// App- und im Statusmenü. Er führt in den VORHANDENEN Klara-Einstellungsbereich der Webfläche
    /// (Menü → Einstellungen, `pages/Begleiter.tsx`) — keine zweite Einstellungsverwaltung, keine
    /// neuen Rechte. Das Gespräch öffnet sich dafür; Entwurf, Gespräch und die Stopps laufender
    /// Vorgänge bleiben stehen (die Vorgangsleiste steht auch über der Unterseite).
    @objc func einstellungenOeffnen() {
        gespraechOeffnen()
        befehl("einstellungen-oeffnen")
        // Nacharbeit 56 (Ben · MAC5-04-REST): der ZENTRALE Klara-Bereich in Klarwerk (Profil › Klara,
        // vorhandener Direktweg `/profil?bereich=klara`). Er öffnet sich im Browser, NICHT in dieser
        // Webfläche — so bleiben Entwurf, Gespräch und die Stopps laufender Vorgänge hier stehen.
        if let ziel = zentraleKlaraEinstellungen() {
            NSWorkspace.shared.open(ziel)
        }
    }

    /// `<Server>/profil?bereich=klara` — nur auf dem eingestellten (geprüften) Server.
    private func zentraleKlaraEinstellungen() -> URL? {
        var teile = URLComponents(url: einst.server, resolvingAgainstBaseURL: false)
        teile?.path = "/profil"
        teile?.queryItems = [URLQueryItem(name: "bereich", value: "klara")]
        guard let url = teile?.url, Einstellungen.erlaubt(url) else { return nil }
        return url
    }

    @objc func gespraechOeffnen() {
        einblenden()
        setzeModus("gespraech", durchPerson: true)
        befehl("gespraech-oeffnen")
    }

    // MARK: MAC-02 — Systemknöpfe und Fenstermenü des Gesprächs

    /// Gelber Knopf / ⌘M: zur Figur einklappen. Das Gespräch und seine Eingabe bleiben erhalten.
    ///
    /// UI-MIN-06/14 (Ben, Nacharbeit 49): Mit geladener eigener Webfläche verkleinert die App das
    /// Fenster NICHT selbst. Die Webfläche klappt ein und meldet ihren kompakten Zustand — `figur`
    /// (96 × 96) oder `figur-vorgang` (Figur mit je einem Stopp); erst diese Meldung ändert die Größe
    /// (`case "modus"` → `setzeModus`). Bleibt sie aus, bleibt die bisherige Fläche samt ihren Stopps
    /// stehen. Nur ohne eigene Webfläche (keine Verbindung, Fehlerseite) — dort läuft kein Vorgang —
    /// klappt die App selbst zur Figur ein (BUG-KLARA-WINDOW-02: Einklappen auch ohne Antwort).
    @objc func einklappen() {
        // Bewusst eingeklappt: kein Seiten-/Kontextwechsel öffnet wieder (setzeModus prüft das).
        nutzerEingeklappt = true
        guard verbunden, offline == nil else {
            setzeModus("figur", durchPerson: true)
            befehl("gespraech-schliessen")
            return
        }
        befehl("gespraech-schliessen")
    }

    /// Roter Knopf / ⌘W / Menü / Rechtsklick: Klara ausblenden — kein unsichtbares Fenster bleibt über
    /// der Arbeit liegen, und nichts erscheint von selbst wieder. Zurück über die Menüleiste,
    /// das Menü oder den App-Start.
    ///
    /// UI-MIN-06/14 (Ben, Nacharbeit 47): Ein laufender Vorgang (Aufnahme, Frage, Vorlesen, Word-Aktion
    /// bis zur Bestätigung des Abbruchs) wird dabei NICHT versteckt. Das Gespräch klappt zur Figur ein,
    /// und die App FRAGT die Webfläche nach ihren laufenden Vorgängen (`vorgaenge-melden` mit
    /// Anfragenummer). Ausgeblendet wird erst, wenn die Antwort auf genau diese Anfrage vorliegt und
    /// kein Vorgang mehr läuft (`Schliessvorgang`). Ohne Antwort bleibt die Figur stehen; ein erneutes
    /// Schließen fragt neu. Entwurf und Gespräch bleiben in der geladenen Webfläche erhalten.
    @objc func schliessen() {
        switch schliessvorgang.anfordern(webflaecheBereit: verbunden && offline == nil) {
        case .ausblenden:
            // Keine eigene Webfläche geladen (keine Verbindung, Fehlerseite): dort läuft nichts.
            befehl("gespraech-schliessen")
            ausblenden()
        case .nachfragen(let nummer):
            if modus == "gespraech" {
                einklappen()
            }
            fensterProtokoll.notice("Schließen wartet auf die Bestätigung der Webfläche")
            befehl("vorgaenge-melden", wert: nummer)
        }
    }

    /// Meldung der Webfläche über ihre laufenden Vorgänge — als Antwort oder als spätere Änderung.
    private func vorgaengeGemeldet(anzahl: Int, antwortAuf: Int?) {
        if schliessvorgang.meldung(anzahl: anzahl, antwortAuf: antwortAuf) {
            ausblenden()
        }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        // Nicht zerstören: die Webfläche (Gespräch, Eingabe, Anmeldung) bleibt geladen.
        schliessen()
        return false
    }

    func windowDidEndLiveResize(_ notification: Notification) {
        guard modus == "gespraech" else { return }
        let d = UserDefaults.standard
        d.set(Double(panel.frame.width), forKey: "gespraech.breite")
        d.set(Double(panel.frame.height), forKey: "gespraech.hoehe")
        setzeRahmen(Lage.vollstaendigSichtbar(panel.frame, in: flaechen()))
    }

    /// Natives Verschieben an der Titelleiste (auch auf einen anderen, kleineren Bildschirm): Lage
    /// merken und — sobald die Maustaste losgelassen ist — Grösse und Lage auf die Fläche des
    /// Zielbildschirms begrenzen (BUG-KLARA-WINDOW-02). Während des Ziehens bleibt das Fenster frei.
    func windowDidMove(_ notification: Notification) {
        guard modus == "gespraech" else { return }
        merkeLage()
        guard einpassTakt == nil else { return }
        if NSEvent.pressedMouseButtons & 1 == 0 {
            // Nicht verschachtelt im laufenden `setFrame`; einmal angewandt ändert sich nichts mehr.
            Task { @MainActor [weak self] in self?.bildschirmeGeaendert() }
            return
        }
        einpassTakt = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, NSEvent.pressedMouseButtons & 1 == 0 else { return }
                self.einpassTakt?.invalidate()
                self.einpassTakt = nil
                self.bildschirmeGeaendert()
            }
        }
    }

    /// Rechtsklick in jeder Lage: Einklappen/Öffnen und Schließen.
    private func fensterEintraege() -> [NSMenuItem] {
        let wechsel =
            modus == "gespraech"
            ? eintrag("Zur Figur einklappen", #selector(einklappen))
            : eintrag("Gespräch öffnen", #selector(gespraechOeffnen))
        return [
            eintrag("Klara beenden", #selector(beenden), taste: "q"),wechsel, eintrag("\(panel.anzeigeName) schließen", #selector(schliessen))]
    }

    @objc private func einklappenAusMenue() { einklappen() }
    @objc private func schliessenAusMenue() { schliessen() }

    @objc func reduziertUmschalten() {
        reduziert.toggle()
        befehl(reduziert ? "reduziert-an" : "reduziert-aus")
    }

    @objc func neuLaden() { laden() }

    @objc func beenden() { NSApp.terminate(nil) }

    // MARK: Webfläche

    private func laden() {
        // BPA-01: Neuladen kann die Sitzung wechseln — die Browserkarte gilt bis zur neuen
        // Bestätigung nicht (`anmeldungGewechselt` fragt nach dem Laden selbst nach).
        if kartenQuelle.anmeldung != nil {
            anmeldungSetzen(nutzer: nil, sitzung: nil)
        }
        offline = nil
        verbunden = false
        fensterInhalt.webBereit = false
        webView.load(URLRequest(url: begleiterURL, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 20))
    }

    /// `wert`: eine ganze Zahl zum Befehl (z. B. die Anfragenummer von `vorgaenge-melden`).
    private func befehl(_ name: String, wert: Int? = nil) {
        guard Self.befehle.contains(name) else { return }
        let zusatz = wert.map { ", wert: \($0)" } ?? ""
        let js = "window.dispatchEvent(new CustomEvent('klara-begleiter', { detail: { befehl: '\(name)'\(zusatz) } }));"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    private func zahl(_ roh: Any?) -> CGFloat {
        guard let n = roh as? NSNumber else { return 0 }
        let w = n.doubleValue
        return w.isFinite ? CGFloat(max(-10_000, min(10_000, w))) : 0
    }

    private func vomServer(_ origin: WKSecurityOrigin) -> Bool {
        origin.protocol == einst.server.scheme && origin.host == einst.server.host
            && (einst.server.port ?? 0) == origin.port
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Nur die eigene Webfläche im Hauptrahmen darf das Fenster steuern.
        guard message.frameInfo.isMainFrame, vomServer(message.frameInfo.securityOrigin),
              let n = message.body as? [String: Any], let art = n["art"] as? String
        else { return }
        switch art {
        case "bereit":
            verbunden = true
            fensterInhalt.webBereit = true
            webFassung = (n["webFassung"] as? String).map(Einstellungen.sauber)
            wiederholung?.invalidate()
            anmeldungPruefen()
            karteAnWebflaeche(kartenQuelle.aktuell())
            if schliessvorgang.wartet {
                // Die Webfläche wurde neu geladen: die offene Anfrage noch einmal stellen.
                befehl("vorgaenge-melden", wert: schliessvorgang.anfrage)
            }
        case "modus":
            // Öffnen zählt nur nach einer Eingabe der Person an diesem Fenster (Klick, Taste).
            setzeModus(n["modus"] as? String ?? "", durchPerson: panel.kuerzlichBedient)
        case "vorgaenge":
            // UI-MIN-06/14: unlesbare Anzahl gilt als „läuft“ — im Zweifel bleibt der Stopp sichtbar.
            let anzahl = (n["anzahl"] as? NSNumber)?.intValue ?? 1
            vorgaengeGemeldet(anzahl: max(anzahl, 0), antwortAuf: (n["anfrage"] as? NSNumber)?.intValue)
        case "name":
            // UI-MIN-15: der persönliche Name aus dem Profil für Titelleiste und Bedienungshilfen.
            panel.setzeName(n["name"] as? String)
            fensterInhalt.setzeName(panel.anzeigeName)
        case "bewegen":
            setzeRahmen(Lage.verschoben(panel.frame, dx: zahl(n["dx"]), dy: zahl(n["dy"]), in: flaechen()))
        case "griff":
            webView.griff = CGRect(x: zahl(n["x"]), y: zahl(n["y"]), width: zahl(n["breite"]), height: zahl(n["hoehe"]))
        case "zustand":
            zustand = Einstellungen.sauber(n["zustand"] as? String ?? "ruhe")
            statusItem.button?.toolTip = "Klara · \(zustand)"
        case "zuruecksetzen":
            zuruecksetzen()
        case "andocken":
            andocken(rechts: (n["seite"] as? String) == "rechts")
        case "ausblenden":
            // „Ausblenden“ in den Einstellungen: derselbe Weg wie Schließen — kein Vorgang verschwindet.
            schliessen()
        case "reduziert":
            reduziert = (n["an"] as? Bool) ?? false
        case "anmeldung":
            // BPA-01: Die Webfläche meldet einen An-/Abmelde- oder Kontowechsel. Ihr Inhalt zählt
            // nicht: SOFORT entwerten, dann selbst beim Server nachfragen.
            anmeldungGewechselt()
        default:
            break
        }
    }

    /// Ein Link aus dem Gespräch öffnet im Browser; nach einer Anmeldung geht es zurück zur Fläche.
    private func urlGeaendert(_ url: URL?) {
        // BPA-01: Jede Navigation (Anmeldung, Abmeldung, Rückkehr) kann die Sitzung wechseln:
        // sofort entwerten, dann neu bestätigen lassen.
        anmeldungGewechselt()
        guard let url, url.host == einst.server.host else { return }
        let pfad = url.path
        if pfad == "/begleiter" {
            letzteWarBegleiter = true
            return
        }
        if pfad == "/sso/callback" || pfad == "/reset" || pfad.hasPrefix("/impressum") || pfad.hasPrefix("/datenschutz") {
            letzteWarBegleiter = false
            return
        }
        if letzteWarBegleiter {
            NSWorkspace.shared.open(url)
            webView.goBack()
            return
        }
        laden()
    }

    private func zeigeOffline(_ grund: String) {
        offline = grund
        verbunden = false
        fensterInhalt.webBereit = false
        // BPA-01: Ohne Verbindung ist die Anmeldung nicht feststellbar — keine Karte (fail-closed).
        anmeldungSetzen(nutzer: nil, sitzung: nil)
        setzeModus("gespraech", durchPerson: false)
        let host = einst.server.host ?? ""
        let text = grund.replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
        let html = """
        <!doctype html><html lang="de"><meta charset="utf-8"><body style="margin:0;font:13px -apple-system,sans-serif;background:#fff;color:#1d1d1f">
        <div style="padding:18px;border:1px solid #ddd;border-radius:12px;height:calc(100vh - 38px)">
        <p style="font-weight:600;font-size:15px">Keine Verbindung zu Klarwerk</p>
        <p>Die Begleitapp erreicht \(host) gerade nicht. Word und alle anderen Fenster laufen unverändert weiter.</p>
        <p style="color:#666">Grund: \(text)</p>
        <p><a href="klara-begleiter://neu-laden" style="display:inline-block;padding:6px 12px;border:1px solid #999;border-radius:8px;color:#1d1d1f;text-decoration:none">Erneut verbinden</a></p>
        <p style="color:#666">Ein neuer Versuch läuft automatisch alle 15 Sekunden.</p>
        </div></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
        wiederholung?.invalidate()
        wiederholung = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task { @MainActor in
                if self?.offline != nil { self?.laden() }
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .cancel }
        if url.scheme == "klara-begleiter" {
            laden()
            return .cancel
        }
        if url.scheme == "about" || (url.scheme == nil && navigationAction.targetFrame != nil) {
            return .allow
        }
        if !Einstellungen.erlaubt(url) {
            // mailto:, tel:, Dateien … gehören nicht in dieses Fenster.
            NSWorkspace.shared.open(url)
            return .cancel
        }
        if navigationAction.targetFrame == nil {
            NSWorkspace.shared.open(url)
            return .cancel
        }
        return .allow
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        anmeldungPruefen()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        zeigeOffline(error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        zeigeOffline(error.localizedDescription)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        laden()
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    /// Mikrofon nur für die eigene Webfläche — und auch dann fragt macOS bzw. die Person.
    func webView(
        _ webView: WKWebView,
        decideMediaCapturePermissionsFor origin: WKSecurityOrigin,
        initiatedBy frame: WKFrameInfo,
        type: WKMediaCaptureType
    ) async -> WKPermissionDecision {
        vomServer(origin) && type == .microphone ? .prompt : .deny
    }

    // MARK: Menüleiste

    private func baueMenue() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "bubble.left.fill", accessibilityDescription: "Klara Begleiter")
        statusItem.button?.toolTip = "Klara Begleiter"
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
    }

    /// MACOS-20261014 · MAC-04/UI-05: das Hauptmenü einer Mac-App. Eine Menüleisten-App zeigt es nicht
    /// an, aber ihre Tastenkürzel wirken, solange das Gespräch aktiv ist — ohne „Bearbeiten“ gingen im
    /// Gespräch weder Kopieren/Einsetzen noch Widerrufen (⌘Z) über die Tastatur.
    private func baueHauptmenue() {
        let haupt = NSMenu()

        let app = NSMenu(title: "Klara")
        app.addItem(eintrag("Einstellungen …", #selector(einstellungenOeffnen), taste: ","))
        app.addItem(.separator())
        app.addItem(eintrag("Klara Begleiter beenden", #selector(beenden), taste: "q"))
        let appEintrag = NSMenuItem()
        appEintrag.submenu = app
        haupt.addItem(appEintrag)

        let bearbeiten = NSMenu(title: "Bearbeiten")
        // Ziel `nil`: der Befehl geht über die Responder-Kette an das Textfeld im Gespräch.
        bearbeiten.addItem(NSMenuItem(title: "Widerrufen", action: Selector(("undo:")), keyEquivalent: "z"))
        let wiederholen = NSMenuItem(title: "Wiederholen", action: Selector(("redo:")), keyEquivalent: "z")
        wiederholen.keyEquivalentModifierMask = [.command, .shift]
        bearbeiten.addItem(wiederholen)
        bearbeiten.addItem(.separator())
        bearbeiten.addItem(NSMenuItem(title: "Ausschneiden", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        bearbeiten.addItem(NSMenuItem(title: "Kopieren", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        bearbeiten.addItem(NSMenuItem(title: "Einsetzen", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        bearbeiten.addItem(
            NSMenuItem(title: "Alles auswählen", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        )
        let bearbeitenEintrag = NSMenuItem()
        bearbeitenEintrag.submenu = bearbeiten
        haupt.addItem(bearbeitenEintrag)

        let fenster = NSMenu(title: "Fenster")
        fenster.addItem(eintrag("Einklappen", #selector(einklappenAusMenue), taste: "m"))
        fenster.addItem(eintrag("Schließen", #selector(schliessenAusMenue), taste: "w"))
        fenster.addItem(.separator())
        fenster.addItem(eintrag("Gespräch öffnen", #selector(gespraechOeffnen)))
        let fensterEintrag = NSMenuItem()
        fensterEintrag.submenu = fenster
        haupt.addItem(fensterEintrag)

        NSApp.mainMenu = haupt
        NSApp.windowsMenu = fenster
    }

    private func eintrag(_ titel: String, _ aktion: Selector?, taste: String = "", an: Bool = false) -> NSMenuItem {
        let item = NSMenuItem(title: titel, action: aktion, keyEquivalent: taste)
        item.target = aktion == nil ? nil : self
        item.isEnabled = aktion != nil
        item.state = an ? .on : .off
        return item
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        // BUG-KLARA-WINDOW-02: Schließen und Einklappen stehen immer hier — in jeder Lage.
        let name = panel.anzeigeName
        menu.addItem(eintrag(sichtbar ? "\(name) schließen" : "\(name) öffnen", #selector(sichtbarUmschalten)))
        menu.addItem(eintrag("Gespräch öffnen", #selector(gespraechOeffnen)))
        menu.addItem(eintrag("Einstellungen …", #selector(einstellungenOeffnen), taste: ","))
        menu.addItem(eintrag("Zur Figur einklappen", sichtbar && modus == "gespraech" ? #selector(einklappen) : nil))
        let finden = eintrag("Figur wiederfinden", #selector(wiederfindenAusMenue))
        menu.addItem(finden)
        menu.addItem(eintrag(kuerzelText, nil))
        if schliessvorgang.wartet {
            let grund =
                schliessvorgang.bestaetigt
                ? "Schließen wartet auf laufende Vorgänge (Stopp an der Figur)"
                : "Schließen wartet auf die Bestätigung der Webfläche"
            menu.addItem(eintrag(grund, nil))
        }
        menu.addItem(.separator())
        menu.addItem(eintrag("Position zurücksetzen", #selector(zuruecksetzen)))
        menu.addItem(eintrag("Links andocken", #selector(linksAndocken)))
        menu.addItem(eintrag("Rechts andocken", #selector(rechtsAndocken)))
        menu.addItem(eintrag("Reduzierte Bewegung", #selector(reduziertUmschalten), an: reduziert))
        menu.addItem(.separator())
        // BPA-01: die Browserkarte — beim Öffnen frisch geprüft, nie die zuletzt gesehene.
        anmeldungPruefen()
        kartenMenue.anhaengen(an: menu, karte: kartenQuelle.aktuell())
        menu.addItem(eintrag("In anderen Programmen …", #selector(programmeOeffnen)))
        menu.addItem(.separator())
        menu.addItem(eintrag("Neu verbinden", #selector(neuLaden)))
        let lage = offline != nil ? "keine Verbindung" : (verbunden ? "verbunden · Figur: \(zustand)" : "wird geladen")
        menu.addItem(eintrag("Status: \(lage)", nil))
        menu.addItem(eintrag("Klara Begleiter \(einst.fassung) (\(einst.bau))", nil))
        menu.addItem(eintrag("Webfläche \(webFassung ?? "–") · \(einst.server.host ?? "")", nil))
        menu.addItem(.separator())
        menu.addItem(eintrag("Klara Begleiter beenden", #selector(beenden), taste: "q"))
    }

    @objc private func wiederfindenAusMenue() { wiederfinden() }

    @objc private func programmeOeffnen() { programme.zeigen() }

    // MARK: BPA-01 · Browserkarte

    /// Fragt den Server in einer eigenen Skriptwelt, wer an der Webfläche angemeldet ist und unter
    /// WELCHER Sitzung (`/api/me/klara/begleiter/sitzung`: Nutzerkennung und Fingerabdruck des
    /// Sitzungsmerkmals — nie das Merkmal selbst; es bleibt in WebKit). Nichts sonst kommt zurück.
    private static let anmeldeSkript = """
    try {
      const antwort = await fetch("/api/me/klara/begleiter/sitzung", {
        credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" }
      });
      if (antwort.status !== 200) return "";
      const s = await antwort.json();
      if (!s || typeof s.nutzer !== "string" || typeof s.sitzung !== "string") return "";
      return s.nutzer + "\\n" + s.sitzung;
    } catch (fehler) {
      return "";
    }
    """

    private func browserKarteStarten() {
        kartenQuelle.beiAenderung = { [weak self] karte in
            // Die Quelle meldet auf dem Hauptthread (Aufruf aus dieser Steuerung oder `.main`-Queue).
            MainActor.assumeIsolated { self?.karteAnzeigen(karte) }
        }
        kartenQuelle.beobachten()
        anmeldeTakt = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.anmeldungPruefen() }
        }
    }

    /// Liegt die Webfläche auf genau dem eingestellten Server?
    private func aufServer(_ url: URL?) -> Bool {
        guard let url, let herkunft = klarwerkHerkunft(url) else { return false }
        return herkunft == klarwerkHerkunft(einst.server)
    }

    /// Ein MÖGLICHER Anmelde-/Sitzungswechsel ist gemeldet (Meldung `anmeldung` der Webfläche,
    /// Navigation, Neuladen, Verbindungsverlust): die bisherige Freigabe gilt SOFORT nicht mehr —
    /// Marke weg, Anzeige leer, laufende Nachfragen entwertet — und erst die anschliessende,
    /// gebundene Bestätigung des Servers gibt wieder frei. Eine Karte der alten Sitzung trägt die
    /// alte Marke und bleibt gesperrt.
    private func anmeldungGewechselt() {
        anmeldungSetzen(nutzer: nil, sitzung: nil)
        anmeldungPruefen()
    }

    /// Fragt beim Server nach (Takt, Menü, nach einem Wechsel). Ohne Antwort, mit Fehler, offline
    /// oder auf fremder Herkunft: keine Anmeldung.
    private func anmeldungPruefen() {
        anmeldeAbfrage += 1
        let abfrage = anmeldeAbfrage
        guard offline == nil, aufServer(webView?.url) else {
            anmeldungSetzen(nutzer: nil, sitzung: nil)
            return
        }
        webView.callAsyncJavaScript(Self.anmeldeSkript, arguments: [:], in: nil, in: .defaultClient) {
            [weak self] ergebnis in
            Task { @MainActor in
                // Nur die jüngste Abfrage zählt; eine verspätete Antwort — auch eine, die vor einem
                // gemeldeten Wechsel losging — ändert nichts mehr.
                guard let self, abfrage == self.anmeldeAbfrage else { return }
                guard self.offline == nil, self.aufServer(self.webView.url),
                      case .success(let wert) = ergebnis, let text = wert as? String
                else {
                    self.anmeldungSetzen(nutzer: nil, sitzung: nil)
                    return
                }
                let teile = text.split(separator: "\n", omittingEmptySubsequences: false)
                guard teile.count == 2 else {
                    self.anmeldungSetzen(nutzer: nil, sitzung: nil)
                    return
                }
                self.anmeldungSetzen(nutzer: String(teile[0]), sitzung: String(teile[1]))
            }
        }
    }

    /// Nutzer UND Serversitzung binden (`HostAnmeldungsFolge`): Abmelden, Nutzerwechsel und jeder
    /// Sitzungswechsel — auch desselben Nutzers — ergeben eine neue Marke; alte Karten und
    /// verspätete Übergaben bleiben gesperrt (`BrowserKartenQuelle`).
    private func anmeldungSetzen(nutzer: String?, sitzung: String?) {
        if nutzer == nil {
            // Entwerten macht jede noch laufende Nachfrage ungültig.
            anmeldeAbfrage += 1
            anmeldeFolge.entwerten()
            kartenQuelle.anmelden(nil)
            return
        }
        kartenQuelle.anmelden(anmeldeFolge.bestaetigt(nutzer: nutzer, sitzung: sitzung))
    }

    private func karteAnzeigen(_ karte: BrowserKarte?) {
        if let karte {
            statusItem?.button?.toolTip = "Klara · Browserkarte: \(kartenKurz(karte.titel, 60))"
        } else {
            statusItem?.button?.toolTip = "Klara · \(zustand)"
        }
        // nacharbeit-21: auch ein bereits GEÖFFNETES Menü zeigt sofort den neuen Stand; bei `nil`
        // verschwinden Titel, Seite, Fassung, Auswahl und das Quellziel.
        kartenMenue.aktualisieren(karte: karte)
        karteAnWebflaeche(karte)
    }

    /// Die Webfläche bekommt die Karte (oder `null` zum Leeren) — nur auf dem eigenen Server.
    private func karteAnWebflaeche(_ karte: BrowserKarte?) {
        guard webView != nil, offline == nil, aufServer(webView.url) else { return }
        let detail: Any = karte.map {
            [
                "folge": $0.folge, "fassung": $0.fassung, "url": $0.url, "titel": $0.titel,
                "auswahl": $0.auswahl, "erfasstAm": $0.erfasstAm,
            ] as [String: Any]
        } ?? NSNull()
        webView.callAsyncJavaScript(
            "window.dispatchEvent(new CustomEvent('klara-begleiter-browserkarte', { detail: karte }));",
            arguments: ["karte": detail], in: nil, in: .page, completionHandler: nil)
    }

    @objc private func browserQuelleOeffnen(_ sender: NSMenuItem) {
        // Nur, wenn die Karte beim Klick noch gilt und dieselbe Seite zeigt.
        guard let seite = sender.representedObject as? URL,
              kartenQuelle.aktuell()?.url == seite.absoluteString
        else { return }
        NSWorkspace.shared.open(seite)
    }

    // Systemweite Auslösung ist gemäß Peters Option 1 für später vorgemerkt.
    // Konfigurierbare interne Kürzel liegen unverändert im gemeinsamen Klara-Setup.
    private var kuerzelText: String { "Systemweiter Aufruf: nicht eingerichtet" }
}
