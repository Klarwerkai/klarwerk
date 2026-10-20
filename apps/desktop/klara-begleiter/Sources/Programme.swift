// produkt:20261011:assistenz-programmadapter (BPA-04) — DER MAC-BEGLEITER.
//
// Ein kleines Fenster, das NUR auf Klick handelt: verbinden (Übergabecode aus „Meine Assistenz"),
// eine Datei aus dem Finder aufnehmen, die Markierung im zuletzt benutzten Programm lesen, dazu eine
// Frage über den bestehenden Frageweg stellen. Es gibt keine Hintergrundbeobachtung, kein Mikrofon,
// keine Bildschirmaufnahme. „Trennen" verwirft Sitzung und gesammelten Kontext sofort.
//
// Gesammelter Kontext reist nur mit der Bindung, unter der er entstand; welcher davon erneut
// hinausgeht, entscheidet der Server (`uebermittelbarerKontext`) — nach einem Konto-, Programm- oder
// Dokumentwechsel ist das nichts.
//
// ÜBERNAHME IN DEN GEMEINSAMEN HOST (BPA-01 nacharbeit-18, QUELLEN-HOSTUEBERNAHME-20261011T231344Z):
// Quelle ist `Sources/KlaraBegleiter/KlaraBegleiter.swift` aus 345b4467 (sha256 5cc44b68…). Entfernt
// ist allein die eigene `@main`-App (`KlaraBegleiterApp` mit `WindowGroup`): Es gibt nur EINE App,
// den Menüleisten-Begleiter (`main.swift`, `Steuerung.swift`). Er öffnet diese Ansicht als Fenster
// über „In anderen Programmen …" (`ProgrammeFenster`). Zustand und Ansicht sind unverändert.
import AppKit
import SwiftUI

/// Das Fenster für die BPA-04-Funktionen im gemeinsamen Host — höchstens eines, auf Klick.
@MainActor
final class ProgrammeFenster {
  private var fenster: NSWindow?
  private var zustand: BegleiterZustand?

  func zeigen() {
    if fenster == nil {
      let neu = BegleiterZustand()
      let ansicht = BegleiterAnsicht()
        .environmentObject(neu)
        .frame(minWidth: 420, minHeight: 520)
      let w = NSWindow(contentViewController: NSHostingController(rootView: ansicht))
      w.title = "Klara · In anderen Programmen"
      w.isReleasedWhenClosed = false
      zustand = neu
      fenster = w
    }
    NSApp.activate(ignoringOtherApps: true)
    fenster?.makeKeyAndOrderFront(nil)
  }

  /// Beim Beenden: Sitzung, Markierung und Kontext verwerfen (wie „Trennen").
  func schliessen() {
    if zustand?.verbunden == true { zustand?.trennen() }
    fenster?.close()
  }
}

@MainActor
final class BegleiterZustand: ObservableObject {
  @Published var serverAdresse = "https://"
  @Published var code = ""
  @Published var meldung = ""
  @Published var markierung = ""
  @Published var antwort = ""
  @Published var verbunden = false
  @Published var bedienungshilfe = Bedienungshilfe.freigegeben
  @Published var letztesProgramm = "–"

  private var server: Server?
  /// Eine Begleiter-Sitzung je Start — sie wechselt mit jedem Neuverbinden.
  private var sitzung = UUID().uuidString
  /// Gesammelter Kontext MIT dem Ziel, unter dem er entstand. Hinaus geht nur, was zum aktuellen
  /// Ziel passt — gefiltert HIER, bevor etwas den Mac verlässt; der Server filtert zusätzlich.
  private var kontext: [(meldung: KontextMeldung, ziel: Ziel)] = []
  /// Bindung und Ziel der zuletzt gelesenen Markierung — „Klara dazu fragen" prüft gegen sie.
  private var leseStand: (bindung: String, ziel: Ziel, programm: NSRunningApplication)?
  /// Jede Verbindung, jede Trennung zählt hoch. Ein Ergebnis, das nach einem Wechsel eintrifft,
  /// gehört der alten Sitzung und wird verworfen.
  private var generation = 0
  /// Jedes Lesen und jeder Hostwechsel zählt hoch. Eine Prüfung oder Antwort zu einem älteren
  /// Lesestand wird verworfen, wenn sie eintrifft.
  private var leseGeneration = 0
  private var fremdesProgramm: NSRunningApplication?
  private var beobachter: NSObjectProtocol?

  /// Das macOS-Konto, gehasht — der Server sieht nie den Benutzernamen.
  private let hostKonto = "mac-" + FinderAufnahme.sha256(Data(NSUserName().utf8)).prefix(24)

  init() {
    // Nur WELCHES Programm zuletzt vorn war (für „Markierung lesen") — kein Inhalt, kein Verlauf.
    beobachter = NSWorkspace.shared.notificationCenter.addObserver(
      forName: NSWorkspace.didActivateApplicationNotification,
      object: nil,
      queue: .main
    ) { [weak self] hinweis in
      guard
        let programm = hinweis.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
        programm.processIdentifier != ProcessInfo.processInfo.processIdentifier
      else { return }
      Task { @MainActor in
        guard let self else { return }
        self.fremdesProgramm = programm
        self.letztesProgramm = programm.localizedName ?? programm.bundleIdentifier ?? "–"
        // Ein anderes Programm kommt nach vorn: die gelesene Markierung gehört nicht mehr zum
        // aktuellen Host — sie, die Antwort und der Lesestand werden sofort entwertet; laufende
        // Prüfungen und Antworten dazu werden verworfen, wenn sie eintreffen.
        if let stand = self.leseStand, stand.programm.processIdentifier != programm.processIdentifier {
          self.lesestandVerwerfen(
            "Programm gewechselt — die Markierung aus \(stand.programm.localizedName ?? "dem vorigen Programm") ist verworfen."
          )
        }
      }
    }
  }

  func verbinden() async {
    guard let basis = URL(string: serverAdresse), basis.scheme == "https" || basis.host == "localhost"
    else {
      meldung = "Bitte die Adresse des KLARWERK-Servers eingeben (https://…)."
      return
    }
    // Ein Wechsel entwertet SOFORT alles, was unter der alten Verbindung gelesen wurde — auch bevor
    // die neue Anmeldung bestätigt ist. Nichts davon kann mit dem neuen Konto hinausgehen.
    verwerfen()
    let gen = generation
    let neu = Server(basis: basis)
    do {
      try await neu.einloesen(code: code.trimmingCharacters(in: .whitespacesAndNewlines))
      guard gen == generation else { return }
      server = neu
      sitzung = UUID().uuidString
      verbunden = true
      code = ""
      meldung = "Verbunden — mit deiner bestehenden Anmeldung."
    } catch {
      guard gen == generation else { return }
      meldung = error.localizedDescription
    }
  }

  func trennen() {
    verwerfen()
    meldung = "Getrennt. Sitzung, Markierung, Antwort und gesammelter Kontext sind verworfen."
  }

  /// Nur den Lesestand verwerfen (Hostwechsel): Markierung, Antwort, Bindung; laufende Prüfungen
  /// und Antworten dazu werden entwertet.
  private func lesestandVerwerfen(_ grund: String) {
    leseGeneration += 1
    leseStand = nil
    markierung = ""
    antwort = ""
    meldung = grund
  }

  /// Sitzung, Markierung, Antwort, Bindung und Kontext verwerfen; laufende Ergebnisse entwerten.
  private func verwerfen() {
    generation += 1
    leseGeneration += 1
    server?.trennen()
    server = nil
    verbunden = false
    kontext = []
    leseStand = nil
    markierung = ""
    antwort = ""
  }

  func dateiAufnehmen() async {
    guard let server else { meldung = "Nicht verbunden."; return }
    guard let url = FinderAufnahme.waehlen() else { return }
    let gen = generation
    do {
      let ergebnis = try await FinderAufnahme.aufnehmen(
        url: url, server: server, sitzung: sitzung, hostKonto: hostKonto
      )
      guard gen == generation else { return }
      meldung = "Aufgenommen: \(ergebnis.herkunft.name) · Fassung "
        + "\(ergebnis.herkunft.sha256.prefix(12))… · Objekt \(ergebnis.objektId)"
      // Erst nach erfolgreicher Übernahme und derselben noch gültigen Verbindung.
      // Der Browser nutzt seine bestehende Anmeldung; kein Sitzungstoken geht in die URL.
      if let ziel = ergebnis.ocrZiel(basis: server.basis) {
        NSWorkspace.shared.open(ziel)
      }
    } catch {
      guard gen == generation else { return }
      meldung = error.localizedDescription
    }
  }

  /// Das aktuelle Ziel des Programms — oder `nil`, wenn es kein freigegebener Lesehost ist. In dem
  /// Fall wird NICHTS gelesen (siehe `Bedienungshilfe.beobachten`).
  private func aktuellesZiel(_ programm: NSRunningApplication) -> (Beobachtung, Ziel)? {
    guard let gesehen = Bedienungshilfe.beobachten(programm) else { return nil }
    let (beobachtung, fenster) = gesehen
    let ziel = Ziel(
      programm: "word-mac",
      sitzung: sitzung,
      hostKonto: hostKonto,
      objekt: fenster,
      auswahl: FinderAufnahme.sha256(Data((beobachtung.markierung ?? "").utf8)),
      fassung: ""
    )
    return (beobachtung, ziel)
  }

  /// Nur Kontext, der unter genau diesem Konto, Programm, Fenster und dieser Sitzung entstand.
  private func passenderKontext(_ ziel: Ziel) -> [KontextMeldung] {
    kontext
      .filter {
        $0.ziel.sitzung == ziel.sitzung && $0.ziel.hostKonto == ziel.hostKonto
          && $0.ziel.programm == ziel.programm && $0.ziel.objekt == ziel.objekt
      }
      .map(\.meldung)
  }

  func markierungLesen() async {
    bedienungshilfe = Bedienungshilfe.freigegeben
    guard let server else { meldung = "Nicht verbunden."; return }
    guard let programm = fremdesProgramm else {
      meldung = "Bitte zuerst das Dokument in Word nach vorn holen und den Absatz markieren."
      return
    }
    // Erst der Host, dann der Inhalt: ein nicht freigegebenes Programm wird gar nicht gelesen.
    guard let gelesen = aktuellesZiel(programm) else {
      markierung = ""
      leseStand = nil
      meldung = Bedienungshilfe.nichtFreigegebenSatz(programm)
      return
    }
    let (beobachtung, ziel) = gelesen
    let rechte = Rechte(
      bedienungshilfe: bedienungshilfe,
      dateizugriff: false,
      bildschirmaufnahme: false
    )
    // Ein neues Lesen löst jeden älteren Lesestand ab.
    leseGeneration += 1
    leseStand = nil
    let gen = generation
    let lg = leseGeneration
    /// Gilt das Ergebnis noch? Dieselbe Verbindung, kein neueres Lesen, und das Programm, aus dem
    /// gelesen wurde, ist weiterhin das zuletzt vorn stehende.
    let gueltig = { [weak self] () -> Bool in
      guard let self else { return false }
      return gen == self.generation && lg == self.leseGeneration
        && self.fremdesProgramm?.processIdentifier == programm.processIdentifier
    }
    do {
      let bindung = try await server.verbinden(ziel)
      guard gueltig() else { return }
      let ergebnis = try await server.bedienungshilfe(
        bindung: bindung,
        aktuell: ziel,
        rechte: rechte,
        beobachtung: beobachtung,
        kontext: passenderKontext(ziel)
      )
      guard gueltig() else { return }
      markierung = ergebnis.markierung
      antwort = ""
      leseStand = (bindung, ziel, programm)
      let mitgenommen = ergebnis.kontext.count
      meldung = mitgenommen == 0
        ? "Markierung gelesen."
        : "Markierung gelesen; \(mitgenommen) frühere Stelle(n) aus demselben Dokument gehen mit."
      let eintrag = KontextMeldung(
        bindung: ergebnis.kontextBindung, privat: true, inhalt: ergebnis.markierung
      )
      kontext.append((eintrag, ziel))
      if kontext.count > 20 { kontext.removeFirst(kontext.count - 20) }
    } catch {
      guard gueltig() else { return }
      markierung = ""
      leseStand = nil
      meldung = error.localizedDescription
    }
  }

  /// Vor dem Senden: der AKTUELLE Host — das zuletzt vorn stehende Programm — muss das Programm der
  /// Bindung sein; dazu dasselbe Konto, Fenster und dieselbe Markierung, geprüft am Server
  /// (`/api/klara/programme/wirkung`). Sonst geht NICHTS hinaus. Ein Wechsel während der Prüfung
  /// oder eine verspätete Antwort zu einem alten Lesestand wird verworfen.
  func fragen() async {
    guard let server, let stand = leseStand, !markierung.isEmpty else { return }
    guard let aktuellerHost = fremdesProgramm,
      aktuellerHost.processIdentifier == stand.programm.processIdentifier
    else {
      lesestandVerwerfen("Programm gewechselt — die Markierung ist verworfen und wird nicht gesendet.")
      return
    }
    guard let aktuell = aktuellesZiel(aktuellerHost)?.1 else {
      lesestandVerwerfen(Bedienungshilfe.nichtFreigegebenSatz(aktuellerHost))
      return
    }
    let frage = markierung
    let gen = generation
    let lg = leseGeneration
    let gueltig = { [weak self] () -> Bool in
      guard let self else { return false }
      return gen == self.generation && lg == self.leseGeneration
        && self.fremdesProgramm?.processIdentifier == stand.programm.processIdentifier
    }
    do {
      try await server.wirkung(bindung: stand.bindung, aktuell: aktuell)
      // Hat der Host während der Prüfung gewechselt, geht die Frage NICHT hinaus.
      guard gueltig() else { return }
      let ergebnis = try await server.fragen(frage)
      guard gueltig() else { return }
      antwort = ergebnis
    } catch {
      guard gueltig() else { return }
      lesestandVerwerfen(error.localizedDescription)
    }
  }
}

struct BegleiterAnsicht: View {
  @EnvironmentObject var zustand: BegleiterZustand

  var body: some View {
    Form {
      Section("Verbindung") {
        TextField("KLARWERK-Server", text: $zustand.serverAdresse)
        SecureField("Code aus „Meine Assistenz“", text: $zustand.code)
        HStack {
          Button("Verbinden") { Task { await zustand.verbinden() } }
            .disabled(zustand.code.isEmpty)
          Button("Trennen") { zustand.trennen() }
            .disabled(!zustand.verbunden)
        }
      }
      Section("In anderen Programmen") {
        Text("Zuletzt vorn: \(zustand.letztesProgramm)")
        Text(zustand.bedienungshilfe
          ? "Bedienungshilfe: erlaubt (nur zum Lesen der Markierung)"
          : "Bedienungshilfe: nicht erlaubt — „Markierung lesen“ stoppt")
        Button("Bedienungshilfe-Freigabe anfragen") { Bedienungshilfe.freigabeAnfragen() }
        Button("Datei aus dem Finder aufnehmen …") { Task { await zustand.dateiAufnehmen() } }
          .disabled(!zustand.verbunden)
        Button("Markierung im zuletzt benutzten Programm lesen") {
          Task { await zustand.markierungLesen() }
        }
        .disabled(!zustand.verbunden)
      }
      if !zustand.markierung.isEmpty {
        Section("Markierung") {
          Text(zustand.markierung).textSelection(.enabled)
          Button("Klara dazu fragen") { Task { await zustand.fragen() } }
          if !zustand.antwort.isEmpty {
            Text(zustand.antwort).textSelection(.enabled)
          }
        }
      }
      if !zustand.meldung.isEmpty {
        Section("Zustand") {
          Text(zustand.meldung).accessibilityAddTraits(.updatesFrequently)
        }
      }
    }
    .formStyle(.grouped)
    .padding()
  }
}
