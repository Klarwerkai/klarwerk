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
import AppKit
import Carbon.HIToolbox
import WebKit

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
        let vorgabe = URL(string: "https://klarwerk.ai")!
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

/// Ziel des globalen Tastenkürzels (Carbon ruft eine C-Funktion ohne Kontext).
@MainActor var hotKeyZiel: Begleitsteuerung?

@MainActor
final class Begleitsteuerung: NSObject, NSApplicationDelegate, NSMenuDelegate, WKScriptMessageHandler,
    WKNavigationDelegate, WKUIDelegate
{
    static let figurGroesse = CGSize(width: 96, height: 96)
    static let gespraechGroesse = CGSize(width: 400, height: 640)
    static let befehle: Set<String> = [
        "figur-klick", "gespraech-oeffnen", "gespraech-schliessen", "reduziert-an", "reduziert-aus",
    ]

    let einst = Einstellungen.ausBundle()
    private var panel: FigurPanel!
    private var webView: GriffWebView!
    private var statusItem: NSStatusItem!
    private var modus = "gespraech"
    private var sichtbar = true
    private var reduziert = false
    private var zustand = "ruhe"
    private var verbunden = false
    private var offline: String?
    private var webFassung: String?
    private var letzteWarBegleiter = false
    private var urlBeobachtung: NSKeyValueObservation?
    private var wiederholung: Timer?
    private var hotKey: EventHotKeyRef?
    // BPA-01: Kartenverbraucher, Anmeldefolge und BPA-04-Fenster.
    private let kartenQuelle = BrowserKartenQuelle()
    private lazy var anmeldeFolge = HostAnmeldungsFolge(mandant: klarwerkHerkunft(einst.server) ?? "")
    private var anmeldeAbfrage = 0
    private var anmeldeTakt: Timer?
    private lazy var programme = ProgrammeFenster()

    private var begleiterURL: URL { einst.server.appendingPathComponent("begleiter") }

    // MARK: Start

    func applicationDidFinishLaunching(_ notification: Notification) {
        baueFenster()
        baueMenue()
        registriereHotKey()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(bildschirmeGeaendert),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
        browserKarteStarten()
        laden()
        panel.orderFrontRegardless()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    // BPA-01: Beim Beenden gilt keine Sitzung mehr — die Brücke nimmt danach keine Karte an.
    func applicationWillTerminate(_ notification: Notification) {
        anmeldeTakt?.invalidate()
        kartenQuelle.anmelden(nil)
        kartenQuelle.anhalten()
        programme.schliessen()
    }

    private func flaechen() -> [CGRect] { NSScreen.screens.map(\.visibleFrame) }

    private func hauptflaeche() -> CGRect {
        (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
    }

    /// Das Gespräch passt immer auf den Bildschirm, auch auf einem kleinen.
    private func begrenzt(_ g: CGSize) -> CGSize {
        let f = Lage.bildschirm(fuer: panel?.frame ?? .zero, in: flaechen()) ?? hauptflaeche()
        return CGSize(width: min(g.width, f.width - Lage.rand * 2), height: min(g.height, f.height - Lage.rand * 2))
    }

    private func startRahmen() -> CGRect {
        let d = UserDefaults.standard
        let groesse = Self.gespraechGroesse
        if d.object(forKey: "lage.x") != nil, d.object(forKey: "lage.oben") != nil {
            let x = CGFloat(d.double(forKey: "lage.x"))
            let oben = CGFloat(d.double(forKey: "lage.oben"))
            let r = CGRect(x: x, y: oben - groesse.height, width: groesse.width, height: groesse.height)
            return Lage.eingepasst(r, in: flaechen())
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
        panel.contentView = webView
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

    private func setzeModus(_ neu: String) {
        guard neu == "figur" || neu == "gespraech" else { return }
        modus = neu
        let groesse = begrenzt(neu == "figur" ? Self.figurGroesse : Self.gespraechGroesse)
        if neu == "figur" && UserDefaults.standard.object(forKey: "lage.x") == nil {
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

    @objc private func bildschirmeGeaendert() {
        setzeRahmen(Lage.eingepasst(panel.frame, in: flaechen()))
    }

    @objc func zuruecksetzen() {
        let figur = Lage.grundposition(groesse: Self.figurGroesse, haupt: hauptflaeche())
        let groesse = begrenzt(modus == "figur" ? Self.figurGroesse : Self.gespraechGroesse)
        setzeRahmen(Lage.umgeformt(figur, auf: groesse, in: flaechen()))
        einblenden()
    }

    @objc func linksAndocken() { andocken(rechts: false) }
    @objc func rechtsAndocken() { andocken(rechts: true) }

    private func andocken(rechts: Bool) {
        setzeRahmen(Lage.angedockt(panel.frame, rechts: rechts, in: flaechen()))
    }

    @objc func einblenden() {
        sichtbar = true
        setzeRahmen(Lage.eingepasst(panel.frame, in: flaechen()))
        panel.orderFrontRegardless()
    }

    @objc func ausblenden() {
        sichtbar = false
        panel.orderOut(nil)
    }

    @objc func sichtbarUmschalten() {
        if sichtbar { ausblenden() } else { einblenden() }
    }

    /// Control-Option-K: die Figur einblenden und neben den Mauszeiger holen — auf dessen Bildschirm.
    func wiederfinden() {
        sichtbar = true
        let groesse = panel.frame.size
        setzeRahmen(Lage.beimZeiger(NSEvent.mouseLocation, groesse: groesse, in: flaechen()))
        panel.orderFrontRegardless()
    }

    @objc func gespraechOeffnen() {
        einblenden()
        befehl("gespraech-oeffnen")
    }

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
        webView.load(URLRequest(url: begleiterURL, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 20))
    }

    private func befehl(_ name: String) {
        guard Self.befehle.contains(name) else { return }
        let js = "window.dispatchEvent(new CustomEvent('klara-begleiter', { detail: { befehl: '\(name)' } }));"
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
            webFassung = (n["webFassung"] as? String).map(Einstellungen.sauber)
            wiederholung?.invalidate()
            anmeldungPruefen()
            karteAnWebflaeche(kartenQuelle.aktuell())
        case "modus":
            setzeModus(n["modus"] as? String ?? "")
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
            ausblenden()
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
        // BPA-01: Ohne Verbindung ist die Anmeldung nicht feststellbar — keine Karte (fail-closed).
        anmeldungSetzen(nutzer: nil, sitzung: nil)
        setzeModus("gespraech")
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

    private func eintrag(_ titel: String, _ aktion: Selector?, taste: String = "", an: Bool = false) -> NSMenuItem {
        let item = NSMenuItem(title: titel, action: aktion, keyEquivalent: taste)
        item.target = aktion == nil ? nil : self
        item.isEnabled = aktion != nil
        item.state = an ? .on : .off
        return item
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        menu.addItem(eintrag(sichtbar ? "Figur ausblenden" : "Figur einblenden", #selector(sichtbarUmschalten)))
        menu.addItem(eintrag("Gespräch öffnen", #selector(gespraechOeffnen)))
        let finden = eintrag("Figur wiederfinden", #selector(wiederfindenAusMenue), taste: "k")
        finden.keyEquivalentModifierMask = [.control, .option]
        menu.addItem(finden)
        menu.addItem(.separator())
        menu.addItem(eintrag("Position zurücksetzen", #selector(zuruecksetzen)))
        menu.addItem(eintrag("Links andocken", #selector(linksAndocken)))
        menu.addItem(eintrag("Rechts andocken", #selector(rechtsAndocken)))
        menu.addItem(eintrag("Reduzierte Bewegung", #selector(reduziertUmschalten), an: reduziert))
        menu.addItem(.separator())
        // BPA-01: die Browserkarte — beim Öffnen frisch geprüft, nie die zuletzt gesehene.
        anmeldungPruefen()
        for item in browserKartenEintraege(kartenQuelle.aktuell()) { menu.addItem(item) }
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
            statusItem?.button?.toolTip = "Klara · Browserkarte: \(kurz(karte.titel, 60))"
        } else {
            statusItem?.button?.toolTip = "Klara · \(zustand)"
        }
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

    private func kurz(_ text: String, _ laenge: Int) -> String {
        let einzeilig = text.split(whereSeparator: \.isNewline).joined(separator: " ")
        return einzeilig.count > laenge ? String(einzeilig.prefix(laenge)) + "…" : einzeilig
    }

    private func browserKartenEintraege(_ karte: BrowserKarte?) -> [NSMenuItem] {
        guard let karte else { return [eintrag("Browserkarte: keine", nil)] }
        let seite = URL(string: karte.url)
        var eintraege = [
            eintrag("Browserkarte: \(kurz(karte.titel.isEmpty ? karte.url : karte.titel, 60))", nil),
            eintrag("Seite: \(seite?.host ?? karte.url) · Fassung \(karte.fassung.prefix(12))", nil),
            eintrag("Auswahl: \(kurz(karte.auswahl, 80))", nil),
        ]
        if let seite, seite.scheme == "https" || seite.scheme == "http" {
            let oeffnen = eintrag("Quelle im Browser öffnen", #selector(browserQuelleOeffnen))
            oeffnen.representedObject = seite
            eintraege.append(oeffnen)
        }
        return eintraege
    }

    @objc private func browserQuelleOeffnen(_ sender: NSMenuItem) {
        // Nur, wenn die Karte beim Klick noch gilt und dieselbe Seite zeigt.
        guard let seite = sender.representedObject as? URL,
              kartenQuelle.aktuell()?.url == seite.absoluteString
        else { return }
        NSWorkspace.shared.open(seite)
    }

    // MARK: Tastenkürzel

    private func registriereHotKey() {
        hotKeyZiel = self
        var typ = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, _, _ -> OSStatus in
            Task { @MainActor in hotKeyZiel?.wiederfinden() }
            return noErr
        }, 1, &typ, nil, nil)
        let kennung = EventHotKeyID(signature: OSType(0x4B4C_4247), id: 1)
        RegisterEventHotKey(
            UInt32(kVK_ANSI_K),
            UInt32(controlKey | optionKey),
            kennung,
            GetApplicationEventTarget(),
            0,
            &hotKey
        )
    }
}
