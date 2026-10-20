// produkt:20261011:assistenz-programmadapter (BPA-04) — der Draht zum KLARWERK-Server.
//
// Der Begleiter hat KEINE eigene Anmeldung: er löst einen Übergabecode der bestehenden Sitzung ein
// (`POST /api/auth/office-handover/redeem`, derselbe Weg wie das Word-Anmeldefenster) und hält das
// Sitzungsmerkmal NUR im Arbeitsspeicher. Jede Entscheidung — Ziel, Rechte, Klärung, Kontext —
// trifft der Server (`services/app/src/routes/programmadapter-routes.ts`); der Begleiter meldet nur,
// was er gesehen hat, und zeigt die Antwort.
import Foundation

struct Ziel: Codable, Equatable {
  var programm: String
  var sitzung: String
  var hostKonto: String
  var objekt: String
  var auswahl: String
  var fassung: String
}

struct Rechte: Codable {
  var bedienungshilfe: Bool
  var dateizugriff: Bool
  var bildschirmaufnahme: Bool
}

struct DateiMeldung: Codable {
  var dateiId: String
  var name: String
  var groesse: Int
  var geaendertAm: String
  var mime: String
  var inhalt: String
}

struct Beobachtung: Codable {
  var bundleId: String
  var hostVersion: String
  var fensterTreffer: Int
  var elementTreffer: Int
  var rolle: String
  var markierung: String?
}

struct KontextMeldung: Codable {
  var bindung: String
  var privat: Bool
  var inhalt: String
}

struct Herkunft: Codable {
  var quelle: String
  var dateiId: String
  var name: String
  var groesse: Int
  var sha256: String
  var aufgenommenAm: String
}

struct FinderErgebnis: Codable {
  var objektId: String
  var herkunft: Herkunft
  /// Additive C→B-Brücke: alte Server antworten weiterhin ohne diesen Einstieg.
  var ocrUrl: String?

  /// Nur der relative Capture-Einstieg für genau das soeben übernommene Objekt.
  /// Keine Tokens, fremden Ursprünge, Protokolle oder zusätzlichen Parameter öffnen.
  func ocrZiel(basis: URL) -> URL? {
    guard let roh = ocrUrl, roh.hasPrefix("/erfassen?"),
          let pfad = URLComponents(string: roh),
          pfad.scheme == nil, pfad.host == nil, pfad.user == nil, pfad.password == nil,
          pfad.fragment == nil, pfad.path == "/erfassen",
          let parameter = pfad.queryItems, parameter.count == 2,
          parameter.filter({ $0.name == "weg" && $0.value == "datei" }).count == 1,
          parameter.filter({ $0.name == "finder" && $0.value == objektId }).count == 1,
          var ziel = URLComponents(url: basis, resolvingAgainstBaseURL: false),
          ziel.user == nil, ziel.password == nil, ziel.host != nil,
          ziel.scheme == "https" || (ziel.scheme == "http" && ["localhost", "127.0.0.1"].contains(ziel.host ?? ""))
    else { return nil }
    ziel.path = "/erfassen"
    ziel.queryItems = parameter
    ziel.fragment = nil
    return ziel.url
  }
}

struct LeseErgebnis: Codable {
  var markierung: String
  var kontext: [KontextInhalt]
  var verworfen: Int
  var kontextBindung: String
}

struct KontextInhalt: Codable {
  var privat: Bool
  var inhalt: String
}

/// Eine Ablehnung des Servers mit SEINEM Satz — der Begleiter erfindet keinen eigenen Grund.
struct ServerAbsage: Error, LocalizedError {
  let status: Int
  let text: String
  var errorDescription: String? { text }
}

final class Server {
  let basis: URL
  private var token: String?

  init(basis: URL) {
    self.basis = basis
  }

  var verbunden: Bool { token != nil }

  func trennen() {
    token = nil
  }

  func einloesen(code: String) async throws {
    struct Anfrage: Encodable { let code: String }
    struct Antwort: Decodable { let token: String }
    let antwort: Antwort = try await senden("/api/auth/office-handover/redeem", Anfrage(code: code), mitSitzung: false)
    token = antwort.token
  }

  /// Der Server stellt die Bindung aus; Mandant und Nutzer setzt ER aus der Sitzung.
  func verbinden(_ ziel: Ziel) async throws -> String {
    struct Anfrage: Encodable { let ziel: Ziel }
    struct Antwort: Decodable { let bindung: String }
    let antwort: Antwort = try await senden("/api/klara/programme/verbinden", Anfrage(ziel: ziel))
    return antwort.bindung
  }

  func finder(bindung: String, aktuell: Ziel, rechte: Rechte, datei: DateiMeldung) async throws -> FinderErgebnis {
    struct Anfrage: Encodable {
      let bindung: String
      let aktuell: Ziel
      let rechte: Rechte
      let dateien: [DateiMeldung]
    }
    return try await senden(
      "/api/klara/programme/finder",
      Anfrage(bindung: bindung, aktuell: aktuell, rechte: rechte, dateien: [datei])
    )
  }

  func bedienungshilfe(
    bindung: String,
    aktuell: Ziel,
    rechte: Rechte,
    beobachtung: Beobachtung,
    kontext: [KontextMeldung]
  ) async throws -> LeseErgebnis {
    struct Anfrage: Encodable {
      let bindung: String
      let aktuell: Ziel
      let rechte: Rechte
      let beobachtung: Beobachtung
      let kontext: [KontextMeldung]
    }
    return try await senden(
      "/api/klara/programme/bedienungshilfe",
      Anfrage(bindung: bindung, aktuell: aktuell, rechte: rechte, beobachtung: beobachtung, kontext: kontext)
    )
  }

  /// Zielprüfung VOR einer Übermittlung: wirft mit dem Satz des Servers, wenn das Ziel abweicht.
  func wirkung(bindung: String, aktuell: Ziel) async throws {
    struct Anfrage: Encodable {
      let bindung: String
      let aktuell: Ziel
    }
    struct Antwort: Decodable { let ok: Bool }
    let antwort: Antwort = try await senden(
      "/api/klara/programme/wirkung",
      Anfrage(bindung: bindung, aktuell: aktuell)
    )
    guard antwort.ok else {
      throw ServerAbsage(status: 409, text: "Das Ziel hat sich geändert. Bitte neu markieren.")
    }
  }

  /// Die Frage geht über den BESTEHENDEN Frageweg (retrieval-only) — kein eigener Assistent.
  func fragen(_ frage: String) async throws -> String {
    struct Anfrage: Encodable {
      let question: String
      let mode: String
    }
    struct Ergebnis: Decodable { let answer: String? }
    struct Antwort: Decodable { let result: Ergebnis? }
    let antwort: Antwort = try await senden("/api/ask", Anfrage(question: frage, mode: "retrieval-only"))
    return antwort.result?.answer ?? ""
  }

  private func senden<T: Decodable>(
    _ pfad: String,
    _ koerper: some Encodable,
    mitSitzung: Bool = true
  ) async throws -> T {
    guard let url = URL(string: pfad, relativeTo: basis) else {
      throw ServerAbsage(status: 0, text: "Die Serveradresse ist ungültig.")
    }
    var anfrage = URLRequest(url: url)
    anfrage.httpMethod = "POST"
    anfrage.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if mitSitzung {
      guard let token else {
        throw ServerAbsage(status: 401, text: "Nicht verbunden. Bitte zuerst den Code eingeben.")
      }
      anfrage.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    anfrage.httpBody = try JSONEncoder().encode(koerper)
    let (daten, antwort) = try await URLSession.shared.data(for: anfrage)
    let status = (antwort as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
      throw ServerAbsage(status: status, text: Server.satz(aus: daten, status: status))
    }
    return try JSONDecoder().decode(T.self, from: daten)
  }

  /// Der Satz des Servers (`text`, sonst `message`) — der Begleiter zeigt ihn unverändert.
  static func satz(aus daten: Data, status: Int) -> String {
    let objekt = (try? JSONSerialization.jsonObject(with: daten)) as? [String: Any]
    if let text = objekt?["text"] as? String { return text }
    if let text = objekt?["message"] as? String { return text }
    return status == 401 ? "Die Anmeldung gilt nicht mehr. Bitte neu verbinden." : "HTTP \(status)"
  }
}
